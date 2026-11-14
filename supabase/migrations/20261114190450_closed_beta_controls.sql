begin;
create schema fontex_beta;
revoke all on schema fontex_beta from public, anon, authenticated;
grant usage on schema fontex_beta to authenticated, service_role;

create table fontex_beta.invitations (
  email text primary key check(email=lower(btrim(email)) and length(email) between 3 and 254 and email like '%@%'),
  enabled boolean not null default true,
  expires_at timestamptz not null default now()+interval '30 days',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table fontex_beta.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- Preserve the verified pilot cohort; all later registrations require an invitation.
insert into fontex_beta.members(user_id) select id from auth.users where email_confirmed_at is not null;
insert into fontex_beta.members(user_id) select user_id from fontex_ai.admins on conflict do nothing;

create function fontex_beta.allowed(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from fontex_beta.members m join auth.users u on u.id=m.user_id where m.user_id=p_user and m.active and u.email_confirmed_at is not null)
$$;
create function fontex_beta.check_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from fontex_beta.invitations where email=lower(btrim(new.email)) and enabled and expires_at>now() for update;
  if not found then raise exception 'Beta cerrada: se requiere invitación para este correo' using errcode='42501'; end if;
  return new;
end $$;
create function fontex_beta.admit_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into fontex_beta.members(user_id,granted_by) select new.id,invited_by from fontex_beta.invitations where email=lower(btrim(new.email)) and enabled and expires_at>now();
  if not found then raise exception 'Beta invitation unavailable' using errcode='42501'; end if;
  update fontex_beta.invitations set enabled=false where email=lower(btrim(new.email));
  return new;
end $$;
create trigger fontex_beta_check_signup before insert on auth.users for each row execute function fontex_beta.check_signup();
create trigger fontex_beta_admit_signup after insert on auth.users for each row execute function fontex_beta.admit_signup();

create table fontex_beta.runtime_limits (
  id boolean primary key default true check(id),
  ai_enabled boolean not null default true,
  max_user_hour integer not null default 20 check(max_user_hour between 1 and 1000),
  max_user_day integer not null default 60 check(max_user_day between 1 and 5000),
  max_global_day integer not null default 300 check(max_global_day between 1 and 10000),
  max_global_concurrent integer not null default 4 check(max_global_concurrent between 1 and 20),
  max_reserved_tokens_day bigint not null default 2000000 check(max_reserved_tokens_day between 1 and 100000000)
);
insert into fontex_beta.runtime_limits default values;
create table fontex_beta.requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null check(task in ('chat','build')),
  reserved_tokens integer not null check(reserved_tokens between 1 and 150000),
  status text not null default 'pending' check(status in ('pending','finished','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '90 seconds'
);
create index beta_requests_user_created on fontex_beta.requests(user_id,created_at desc);
create index beta_requests_created on fontex_beta.requests(created_at desc);
create index beta_requests_pending on fontex_beta.requests(expires_at) where status='pending';

create function fontex_beta.access_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('allowed',fontex_beta.allowed(auth.uid()),'is_admin',exists(select 1 from fontex_ai.admins where user_id=auth.uid()))
$$;
create function fontex_beta.check_request() returns void language plpgsql security definer set search_path='' as $$
begin
  if current_setting('role',true)='service_role' then return; end if;
  if ltrim(coalesce(current_setting('request.path',true),''),'/')='rpc/get_release_contract' then return; end if;
  if current_setting('role',true)='authenticated' and ltrim(coalesce(current_setting('request.path',true),''),'/')='rpc/get_beta_access_status' then return; end if;
  if not fontex_beta.allowed(auth.uid()) then raise exception 'beta_invitation_required' using errcode='42501'; end if;
end $$;
create function public.check_beta_request() returns void language sql security invoker set search_path='' as $$select fontex_beta.check_request()$$;
-- The pre-request guard covers definer RPCs too; RLS below also covers Storage/Realtime.
do $$ begin
  if exists(select 1 from pg_roles r cross join lateral unnest(r.rolconfig) as cfg(setting) where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%' and setting not in ('pgrst.db_pre_request=','pgrst.db_pre_request=public.check_beta_request')) then
    raise exception 'An existing API pre-request hook must be composed with the beta guard before applying this migration';
  end if;
end $$;
alter role authenticator set pgrst.db_pre_request='public.check_beta_request';
notify pgrst,'reload config';

create function fontex_beta.internal_access(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  return jsonb_build_object('allowed',fontex_beta.allowed(p_user),'ai_enabled',(select ai_enabled from fontex_beta.runtime_limits where id));
end $$;
create function fontex_beta.invite(p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; normalized text:=lower(btrim(coalesce(p_email,'')));
begin
  if current_setting('role',true) is distinct from 'service_role' then actor:=fontex_ai.require_admin(); end if;
  if length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Invalid email' using errcode='22023'; end if;
  select id into target from auth.users where lower(email)=normalized;
  insert into fontex_beta.invitations(email,enabled,expires_at,invited_by) values(normalized,target is null,now()+interval '30 days',actor)
  on conflict(email) do update set enabled=excluded.enabled,expires_at=excluded.expires_at,invited_by=excluded.invited_by;
  if target is not null then insert into fontex_beta.members(user_id,granted_by) values(target,actor) on conflict(user_id) do update set active=true,granted_by=actor; end if;
  return jsonb_build_object('email',normalized,'existing_user',target is not null,'expires_at',now()+interval '30 days');
end $$;
create function fontex_beta.revoke_member(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform fontex_ai.require_admin();
  if exists(select 1 from fontex_ai.admins where user_id=p_user) then raise exception 'Administrator access cannot be revoked here' using errcode='22023'; end if;
  update fontex_beta.members set active=false where user_id=p_user;
  update fontex_beta.invitations set enabled=false where email=(select lower(email) from auth.users where id=p_user);
end $$;
create function fontex_beta.overview() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform fontex_ai.require_admin();
  select jsonb_build_object('ai_enabled',(select ai_enabled from fontex_beta.runtime_limits where id),
    'members',coalesce((select jsonb_agg(to_jsonb(m)) from (select b.user_id,u.email,b.active from fontex_beta.members b join auth.users u on u.id=b.user_id order by b.created_at desc limit 200) m),'[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(to_jsonb(i)) from (select email,expires_at from fontex_beta.invitations where enabled and expires_at>now() order by created_at desc limit 200) i),'[]'::jsonb)) into result;
  return result;
end $$;
create function fontex_beta.set_enabled(p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin perform fontex_ai.require_admin();
  if p_enabled is null then raise exception 'Enabled flag required' using errcode='22023'; end if;
  update fontex_beta.runtime_limits set ai_enabled=p_enabled where id;
end $$;
create function fontex_beta.reserve(p_user uuid,p_id uuid,p_task text,p_tokens integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare limits fontex_beta.runtime_limits%rowtype; reason text; user_hour bigint; user_day bigint; global_day bigint; tokens bigint;
begin
  if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if p_user is null or p_id is null or p_task not in ('chat','build') or p_task is null or p_tokens is null or p_tokens<1 or p_tokens>150000 then raise exception 'Invalid request reservation' using errcode='22023'; end if;
  select * into strict limits from fontex_beta.runtime_limits where id for update;
  if not fontex_beta.allowed(p_user) then reason:='beta_invitation_required';
  elsif not limits.ai_enabled then reason:='ai_paused'; end if;
  if reason is not null then return jsonb_build_object('allowed',false,'reason',reason); end if;
  delete from fontex_beta.requests where created_at<now()-interval '7 days';
  update fontex_beta.requests set status='expired' where status='pending' and expires_at<=now();
  if exists(select 1 from fontex_beta.requests where id=p_id) then reason:='duplicate_request';
  elsif exists(select 1 from fontex_beta.requests where user_id=p_user and status='pending') then reason:='request_busy';
  elsif (select count(*) from fontex_beta.requests where status='pending')>=limits.max_global_concurrent then reason:='global_busy';
  end if;
  select count(*) filter(where user_id=p_user and created_at>=now()-interval '1 hour'),count(*) filter(where user_id=p_user),count(*),coalesce(sum(reserved_tokens),0)
    into user_hour,user_day,global_day,tokens from fontex_beta.requests where created_at>=now()-interval '24 hours';
  if reason is null then
    if user_hour>=limits.max_user_hour or user_day>=limits.max_user_day then reason:='user_rate_limit';
    elsif global_day>=limits.max_global_day or tokens+p_tokens>limits.max_reserved_tokens_day then reason:='global_budget'; end if;
  end if;
  if reason is not null then return jsonb_build_object('allowed',false,'reason',reason); end if;
  insert into fontex_beta.requests(id,user_id,task,reserved_tokens) values(p_id,p_user,p_task,p_tokens);
  return jsonb_build_object('allowed',true,'reason','reserved');
end $$;
create function fontex_beta.finish(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  update fontex_beta.requests set status='finished' where id=p_id and status='pending';
end $$;

create function public.get_beta_access_status() returns jsonb language sql security invoker set search_path='' as $$select fontex_beta.access_status()$$;
create function public.internal_beta_access(p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fontex_beta.internal_access(p_user_id)$$;
create function public.admin_invite_beta(p_email text) returns jsonb language sql security invoker set search_path='' as $$select fontex_beta.invite(p_email)$$;
create function public.admin_revoke_beta(p_user_id uuid) returns void language sql security invoker set search_path='' as $$select fontex_beta.revoke_member(p_user_id)$$;
create function public.admin_beta_overview() returns jsonb language sql security invoker set search_path='' as $$select fontex_beta.overview()$$;
create function public.admin_set_beta_ai_enabled(p_enabled boolean) returns void language sql security invoker set search_path='' as $$select fontex_beta.set_enabled(p_enabled)$$;
create function public.reserve_canvas_ai_request(p_user_id uuid,p_request_id uuid,p_task text,p_reserved_tokens integer) returns jsonb language sql security invoker set search_path='' as $$select fontex_beta.reserve(p_user_id,p_request_id,p_task,p_reserved_tokens)$$;
create function public.finish_canvas_ai_request(p_request_id uuid) returns void language sql security invoker set search_path='' as $$select fontex_beta.finish(p_request_id)$$;
create function public.get_release_contract() returns text language sql immutable security invoker set search_path='' as $$select 'closed-beta-v1'::text$$;

-- Guard existing authenticated definer RPCs in their bodies as well. This keeps
-- membership enforcement independent of the PostgREST pre-request hook.
do $guard_rpcs$
declare fn record; definition text; guarded text;
begin
  for fn in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where n.nspname in ('public','fontex_ai') and l.lanname='plpgsql' and p.prosecdef
      and has_function_privilege('authenticated',p.oid,'execute')
  loop
    definition:=pg_get_functiondef(fn.oid);
    guarded:=regexp_replace(fn.prosrc,'\mbegin\M','begin if not fontex_beta.allowed(auth.uid()) then raise exception ''beta_invitation_required'' using errcode=''42501''; end if;','i');
    if guarded=fn.prosrc or strpos(definition,'$function$'||fn.prosrc||'$function$')=0 then raise exception 'Cannot safely guard beta RPC %',fn.oid::regprocedure; end if;
    execute replace(definition,'$function$'||fn.prosrc||'$function$','$function$'||guarded||'$function$');
  end loop;
end $guard_rpcs$;

do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='fontex_beta' loop
    execute format('alter table fontex_beta.%I enable row level security',t.tablename);
    execute format('revoke all on table fontex_beta.%I from public,anon,authenticated',t.tablename);
  end loop;
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('create policy beta_members_only on public.%I as restrictive for all to authenticated using((select fontex_beta.allowed((select auth.uid())))) with check((select fontex_beta.allowed((select auth.uid()))))',t.tablename);
  end loop;
end $$;
create policy fontex_beta_storage_access on storage.objects as restrictive for all to authenticated
using(bucket_id<>'fontex-documents' or (select fontex_beta.allowed((select auth.uid()))))
with check(bucket_id<>'fontex-documents' or (select fontex_beta.allowed((select auth.uid()))));

alter table public.visual_scenes add column scene_title text generated always as (scene->>'title') stored;
alter table public.visual_scenes add column scene_bytes integer generated always as (octet_length(scene::text)) stored;
create function fontex_beta.scene_quota() returns trigger language plpgsql security definer set search_path='' as $$
declare amount bigint; total bigint; previous integer:=0;
begin
  perform 1 from auth.users where id=new.user_id for update;
  select count(*),coalesce(sum(scene_bytes),0) into amount,total from public.visual_scenes where user_id=new.user_id and id<>new.id;
  if tg_op='UPDATE' then previous:=octet_length(old.scene::text); end if;
  if (tg_op='INSERT' and amount>=100) or (total+octet_length(new.scene::text)>20971520 and octet_length(new.scene::text)>previous) then
    raise exception 'Scene library quota exceeded (100 scenes / 20 MiB)' using errcode='54000';
  end if;
  return new;
end $$;
create trigger visual_scene_quota before insert or update on public.visual_scenes for each row execute function fontex_beta.scene_quota();

revoke all on all functions in schema fontex_beta from public,anon,authenticated;
grant execute on function fontex_beta.allowed(uuid),fontex_beta.access_status(),fontex_beta.check_request(),fontex_beta.invite(text),fontex_beta.revoke_member(uuid),fontex_beta.overview(),fontex_beta.set_enabled(boolean) to authenticated;
grant usage on schema fontex_beta to anon;
grant execute on function fontex_beta.check_request() to anon,service_role;
grant execute on function fontex_beta.internal_access(uuid),fontex_beta.reserve(uuid,uuid,text,integer),fontex_beta.finish(uuid),fontex_beta.invite(text) to service_role;
revoke all on function public.check_beta_request(),public.get_beta_access_status(),public.internal_beta_access(uuid),public.admin_invite_beta(text),public.admin_revoke_beta(uuid),public.admin_beta_overview(),public.admin_set_beta_ai_enabled(boolean),public.reserve_canvas_ai_request(uuid,uuid,text,integer),public.finish_canvas_ai_request(uuid),public.get_release_contract() from public,anon,authenticated;
grant execute on function public.check_beta_request() to anon,authenticated,service_role;
grant execute on function public.get_release_contract() to anon,authenticated,service_role;
grant execute on function public.get_beta_access_status(),public.admin_invite_beta(text),public.admin_revoke_beta(uuid),public.admin_beta_overview(),public.admin_set_beta_ai_enabled(boolean) to authenticated;
grant execute on function public.internal_beta_access(uuid),public.admin_invite_beta(text),public.reserve_canvas_ai_request(uuid,uuid,text,integer),public.finish_canvas_ai_request(uuid) to service_role;
commit;
