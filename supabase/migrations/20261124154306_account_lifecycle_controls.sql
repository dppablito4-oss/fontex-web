begin;
alter table fontex_beta.members
  add column suspended_until timestamptz,
  add column deletion_request_id uuid,
  add column deleted_at timestamptz;
create table fontex_beta.account_events (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check(action in ('suspend','ban','restore','delete')),
  reason text not null check(length(reason) between 3 and 500),
  suspended_until timestamptz,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
-- Keep anonymous usage totals after erasing a promoted guest's personal data.
alter table private.guest_ai_requests drop constraint guest_ai_requests_guest_id_fkey;
alter table private.guest_ai_requests alter column guest_id drop not null;
alter table private.guest_ai_requests add constraint guest_ai_requests_guest_id_fkey foreign key(guest_id) references private.classroom_guests(id) on delete set null;
create index account_events_user_created on fontex_beta.account_events(user_id,created_at desc);
alter table fontex_beta.account_events enable row level security;
revoke all on fontex_beta.account_events from public,anon,authenticated;
create or replace function fontex_beta.allowed(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from fontex_beta.members m join auth.users u on u.id=m.user_id
 where m.user_id=p_user and m.active and m.deleted_at is null and m.deletion_request_id is null
 and (m.suspended_until is null or m.suspended_until<=now()) and u.email_confirmed_at is not null)
$$;
create function fontex_beta.protect_deleted_member() returns trigger language plpgsql set search_path='' as $$
begin
 if old.deleted_at is not null and (new.active or new.deleted_at is null) then
  raise exception 'account_deleted' using errcode='22023';
 end if;
 return new;
end $$;
create trigger protect_deleted_member before update on fontex_beta.members for each row execute function fontex_beta.protect_deleted_member();
revoke all on function fontex_beta.protect_deleted_member() from public,anon,authenticated;

create function fontex_beta.account_access(p_user uuid,p_action text,p_hours integer,p_reason text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=fontex_ai.require_admin(); m fontex_beta.members; prior fontex_beta.account_events; expiry timestamptz;
begin
 if p_request is null or p_action is null or p_action not in ('suspend','ban','restore') or length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'invalid_account_action' using errcode='22023'; end if;
 if exists(select 1 from fontex_ai.admins where user_id=p_user) then raise exception 'protected_admin_account' using errcode='42501'; end if;
 select * into m from fontex_beta.members where user_id=p_user for update;
 if not found then raise exception 'account_not_found' using errcode='22023'; end if;
 select * into prior from fontex_beta.account_events where request_id=p_request;
 if found then
  if prior.user_id<>p_user or prior.actor_id<>actor or prior.action<>p_action or prior.reason<>btrim(p_reason) then raise exception 'account_request_mismatch' using errcode='22023'; end if;
  return jsonb_build_object('ok',true,'duplicate',true);
 end if;
 if m.deleted_at is not null then raise exception 'account_deleted' using errcode='22023'; end if;
 if m.deletion_request_id is not null then raise exception 'account_deletion_pending' using errcode='22023'; end if;
 if p_action='suspend' then
  if p_hours is null or p_hours not between 1 and 8760 then raise exception 'invalid_suspension' using errcode='22023'; end if;
  if not m.active then raise exception 'account_blocked' using errcode='22023'; end if;
  expiry:=now()+make_interval(hours=>p_hours);
 end if;
 update fontex_beta.members set active=(p_action<>'ban'),suspended_until=expiry where user_id=p_user;
 insert into fontex_beta.account_events(request_id,user_id,actor_id,action,reason,suspended_until,completed_at)
 values(p_request,p_user,actor,p_action,btrim(p_reason),expiry,now());
 return jsonb_build_object('ok',true,'duplicate',false);
end $$;

create function fontex_beta.prepare_account_deletion(p_user uuid,p_confirm text,p_reason text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=fontex_ai.require_admin(); m fontex_beta.members; prior fontex_beta.account_events; expected text; paths jsonb;
begin
 if p_request is null or length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'invalid_account_action' using errcode='22023'; end if;
 if exists(select 1 from fontex_ai.admins where user_id=p_user) then raise exception 'protected_admin_account' using errcode='42501'; end if;
 select coalesce(email,id::text) into expected from auth.users where id=p_user;
 if expected is null or lower(btrim(coalesce(p_confirm,'')))<>lower(expected) then raise exception 'account_confirmation_required' using errcode='22023'; end if;
 -- Serialize with AI admission before checking pending requests and blocking access.
 perform 1 from fontex_beta.runtime_limits where id for update;
 select * into m from fontex_beta.members where user_id=p_user for update;
 if not found then raise exception 'account_not_found' using errcode='22023'; end if;
 if m.deleted_at is not null then return jsonb_build_object('deleted',true,'request_id',p_request,'paths','[]'::jsonb); end if;
 if m.deletion_request_id is null then
  if exists(select 1 from fontex_beta.account_events where request_id=p_request) then raise exception 'account_request_mismatch' using errcode='22023'; end if;
  if exists(select 1 from public.organizations o where o.created_by=p_user and exists(select 1 from public.classrooms c where c.organization_id=o.id and c.owner_id<>p_user))
    or exists(select 1 from public.classrooms c where c.owner_id=p_user and (
      exists(select 1 from public.class_members cm where cm.classroom_id=c.id and cm.user_id<>p_user)
      or exists(select 1 from public.documents d where d.classroom_id=c.id and d.owner_id<>p_user)
      or exists(select 1 from public.tutor_conversations t where t.classroom_id=c.id and t.user_id<>p_user)
      or exists(select 1 from private.class_lessons l where l.classroom_id=c.id)
      or exists(select 1 from public.study_groups g where g.classroom_id=c.id and g.created_by<>p_user)
      or exists(select 1 from public.classroom_invitations i where i.classroom_id=c.id and i.created_by<>p_user)
      or exists(select 1 from private.classroom_guests g join private.classroom_join_links l on l.id=g.link_id where l.classroom_id=c.id and g.claimed_by is distinct from p_user)))
    or exists(select 1 from public.study_groups g where g.created_by=p_user and exists(select 1 from public.group_members gm where gm.group_id=g.id and gm.user_id<>p_user))
    or exists(select 1 from private.class_lessons where created_by=p_user) then
   raise exception 'account_owns_shared_resources' using errcode='22023';
  end if;
  if exists(select 1 from fontex_beta.requests where user_id=p_user and status='pending' and expires_at>now())
    or exists(select 1 from fontex_ai.reservations where user_id=p_user and status='pending' and expires_at>now()) then
   raise exception 'account_generation_pending' using errcode='22023';
  end if;
  insert into fontex_beta.account_events(request_id,user_id,actor_id,action,reason,completed)
    values(p_request,p_user,actor,'delete',btrim(p_reason),false);
  update private.classroom_join_links set revoked_at=now() where revoked_at is null and classroom_id in (select id from public.classrooms where owner_id=p_user);
  update fontex_beta.members set active=false,suspended_until=null,deletion_request_id=p_request where user_id=p_user;
  m.deletion_request_id:=p_request;
 end if;
 select coalesce(jsonb_agg(storage_path),'[]'::jsonb) into paths from public.documents where owner_id=p_user;
 return jsonb_build_object('deleted',false,'request_id',m.deletion_request_id,'paths',paths);
end $$;

create function fontex_beta.finish_account_deletion(p_user uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=fontex_ai.require_admin(); m fontex_beta.members;
begin
 if exists(select 1 from fontex_ai.admins where user_id=p_user) then raise exception 'protected_admin_account' using errcode='42501'; end if;
 select * into m from fontex_beta.members where user_id=p_user for update;
 if not found then raise exception 'account_not_found' using errcode='22023'; end if;
 if m.deleted_at is not null then return jsonb_build_object('deleted',true); end if;
 if m.deletion_request_id is distinct from p_request or not exists(select 1 from fontex_beta.account_events where request_id=p_request and user_id=p_user and action='delete' and not completed) then raise exception 'account_request_mismatch' using errcode='22023'; end if;
 -- This RPC is service-role only: the Edge Function removes Storage first.
 if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 delete from public.document_shares where granted_by=p_user;
 delete from public.documents where owner_id=p_user;
 delete from public.visual_scenes where user_id=p_user;
 delete from public.studio_workspaces where user_id=p_user;
 delete from public.canvas_public_shares where user_id=p_user;
 delete from fontex_archive.visual_scenes_pre_v071 where user_id=p_user;
 delete from fontex_ai.canvas_builds where user_id=p_user;
 delete from public.tutor_conversations where user_id=p_user;
 delete from public.tutor_messages where user_id=p_user;
 delete from public.rag_search_events where user_id=p_user;
 delete from private.lesson_submissions where user_id=p_user;
 delete from private.lesson_notifications where user_id=p_user;
 delete from public.class_members where user_id=p_user;
 delete from public.group_members where user_id=p_user;
 delete from private.lesson_submissions where guest_id in (select id from private.classroom_guests where claimed_by=p_user);
 delete from private.guest_ai_builds where guest_id in (select id from private.classroom_guests where claimed_by=p_user);
 delete from private.guest_credit_promotions where user_id=p_user or guest_id in (select id from private.classroom_guests where claimed_by=p_user);
 delete from private.classroom_guests where claimed_by=p_user;
 delete from private.workspace_bootstrap_authorizations where user_id=p_user;
 delete from public.study_groups where created_by=p_user;
 delete from public.classrooms where owner_id=p_user;
 delete from public.organizations where created_by=p_user;
 update public.profiles set display_name='Cuenta eliminada' where id=p_user;
 update fontex_beta.members set active=false,deleted_at=now() where user_id=p_user;
 update fontex_beta.account_events set completed=true,completed_at=now() where request_id=p_request;
 return jsonb_build_object('deleted',true);
end $$;

-- Writers serialize with deletion, including callbacks from an expired request.
create function fontex_beta.protect_deleted_content() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; m fontex_beta.members;
begin
 target:=(to_jsonb(new)->>tg_argv[0])::uuid;
 if target is null then return new; end if;
 select * into m from fontex_beta.members where user_id=target for key share;
 if found and (m.deleted_at is not null or m.deletion_request_id is not null) then raise exception 'account_deleted' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function fontex_beta.protect_deleted_content() from public,anon,authenticated;
do $$ declare entry text; parts text[]; begin
 foreach entry in array array['public.documents:owner_id','public.visual_scenes:user_id','public.studio_workspaces:user_id','public.canvas_public_shares:user_id','public.tutor_conversations:user_id','public.tutor_messages:user_id','private.lesson_submissions:user_id','fontex_ai.canvas_builds:user_id','public.organizations:created_by','public.classrooms:owner_id','public.study_groups:created_by','private.class_lessons:created_by','public.document_shares:granted_by'] loop
  parts:=string_to_array(entry,':');
  execute format('create trigger protect_deleted_content before insert or update on %s for each row execute function fontex_beta.protect_deleted_content(%L)',parts[1],parts[2]);
 end loop;
end $$;
-- A stale invite cannot introduce another participant during personal-workspace deletion.
create function fontex_beta.protect_deleting_classroom() returns trigger language plpgsql security definer set search_path='' as $$
declare class_id uuid; m fontex_beta.members;
begin
 class_id:=(to_jsonb(new)->>'classroom_id')::uuid;
 if class_id is null and tg_table_name='classroom_guests' then
  select classroom_id into class_id from private.classroom_join_links where id=(to_jsonb(new)->>'link_id')::uuid;
 elsif class_id is null and tg_table_name='group_members' then
  select classroom_id into class_id from public.study_groups where id=(to_jsonb(new)->>'group_id')::uuid;
 end if;
 if class_id is null then return new; end if;
 select b.* into m from public.classrooms c join fontex_beta.members b on b.user_id=c.owner_id where c.id=class_id for key share of b;
 if found and (m.deleted_at is not null or m.deletion_request_id is not null) then raise exception 'classroom_owner_unavailable' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function fontex_beta.protect_deleting_classroom() from public,anon,authenticated;
do $$ declare relation text; begin
 foreach relation in array array['public.class_members','public.documents','public.study_groups','public.classroom_invitations','private.classroom_join_links','private.class_lessons','private.classroom_guests','public.group_members','public.tutor_conversations'] loop
  execute format('create trigger protect_deleting_classroom before insert or update on %s for each row execute function fontex_beta.protect_deleting_classroom()',relation);
 end loop;
end $$;

create index account_events_actor on fontex_beta.account_events(actor_id);

-- The old credit listing gains lifecycle data without changing its pagination.
create function fontex_beta.list_admin_accounts(p_search text,p_limit integer,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; rows jsonb;
begin
 result:=fontex_ai.list_accounts(p_search,p_limit,p_offset);
 select coalesce(jsonb_agg(a || jsonb_build_object('status',case when m.deleted_at is not null then 'deleted' when m.deletion_request_id is not null then 'deleting' when not coalesce(m.active,false) then 'blocked' when m.suspended_until>now() then 'suspended' else 'active' end,'suspended_until',m.suspended_until) order by ord),'[]'::jsonb)
 into rows from jsonb_array_elements(result->'accounts') with ordinality as item(a,ord) left join fontex_beta.members m on m.user_id=(a->>'user_id')::uuid;
 return jsonb_set(result,'{accounts}',rows);
end $$;
create or replace function public.admin_list_ai_accounts(p_search text default '',p_limit integer default 25,p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select fontex_beta.list_admin_accounts(p_search,p_limit,p_offset)$$;
create function public.admin_account_access(p_user_id uuid,p_action text,p_hours integer,p_reason text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fontex_beta.account_access(p_user_id,p_action,p_hours,p_reason,p_request_id)$$;
create function public.admin_prepare_account_deletion(p_user_id uuid,p_confirm text,p_reason text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fontex_beta.prepare_account_deletion(p_user_id,p_confirm,p_reason,p_request_id)$$;
-- Service wrapper receives the verified actor through its JWT claims from the Edge handler.
create function public.admin_finish_account_deletion(p_user_id uuid,p_request_id uuid,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 if not exists(select 1 from fontex_ai.admins where user_id=p_actor) or not fontex_beta.allowed(p_actor) then raise exception 'Admin required' using errcode='42501'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'aal','aal2','role','service_role')::text,true);
 return fontex_beta.finish_account_deletion(p_user_id,p_request_id);
end $$;
create function public.admin_account_history(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform fontex_ai.require_admin();
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into result from (select action,reason,suspended_until,completed,created_at from fontex_beta.account_events where user_id=p_user_id order by created_at desc,request_id desc limit 20)t;
 return result;
end $$;
revoke all on function fontex_beta.account_access(uuid,text,integer,text,uuid),fontex_beta.prepare_account_deletion(uuid,text,text,uuid),fontex_beta.finish_account_deletion(uuid,uuid),fontex_beta.list_admin_accounts(text,integer,integer) from public,anon,authenticated;
grant execute on function fontex_beta.account_access(uuid,text,integer,text,uuid),fontex_beta.prepare_account_deletion(uuid,text,text,uuid),fontex_beta.list_admin_accounts(text,integer,integer) to authenticated;
revoke all on function public.admin_account_access(uuid,text,integer,text,uuid),public.admin_prepare_account_deletion(uuid,text,text,uuid),public.admin_finish_account_deletion(uuid,uuid,uuid),public.admin_account_history(uuid) from public,anon,authenticated;
grant execute on function public.admin_account_access(uuid,text,integer,text,uuid),public.admin_prepare_account_deletion(uuid,text,text,uuid),public.admin_account_history(uuid) to authenticated;
grant execute on function public.admin_finish_account_deletion(uuid,uuid,uuid) to service_role;
commit;
