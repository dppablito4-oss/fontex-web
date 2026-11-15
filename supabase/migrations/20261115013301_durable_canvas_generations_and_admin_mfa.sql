begin;

-- Private receipts retain a validated proposal for seven days. No direct API table access.
create table fontex_ai.canvas_builds (
  id uuid primary key references fontex_ai.reservations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_id text not null check (length(scene_id) between 1 and 100),
  source_scene jsonb not null check (octet_length(source_scene::text)<=65536),
  question text not null check (length(question) between 1 and 4000),
  reply jsonb check (octet_length(reply::text)<=262144),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  applied_at timestamptz,
  failure_code text check (failure_code in ('generation_failed','cancelled','settlement_pending'))
);
create index canvas_builds_owner_scene_created on fontex_ai.canvas_builds(user_id,scene_id,created_at desc);
create index canvas_builds_retention on fontex_ai.canvas_builds(created_at);
alter table fontex_ai.canvas_builds enable row level security;
revoke all on fontex_ai.canvas_builds from public,anon,authenticated,service_role;

create function fontex_ai.begin_canvas_build(p_user uuid,p_request uuid,p_scene jsonb,p_question text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous fontex_ai.canvas_builds; reserved jsonb;
begin
  if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if not fontex_beta.allowed(p_user) then raise exception 'beta_invitation_required' using errcode='42501'; end if;
  if p_request is null or p_scene is null or jsonb_typeof(p_scene)<>'object' or
    p_scene->>'format' is distinct from 'primitive-scene' or p_scene->>'schemaVersion' is distinct from '2' or
    length(coalesce(p_scene->>'id','')) not between 1 and 100 or octet_length(p_scene::text)>65536 or
    length(coalesce(p_question,'')) not between 1 and 4000 then raise exception 'Invalid build receipt' using errcode='22023'; end if;
  perform fontex_ai.ensure_wallet(p_user);
  perform 1 from fontex_ai.wallets where user_id=p_user for update;
  select * into previous from fontex_ai.canvas_builds where id=p_request;
  if found then
    if previous.user_id<>p_user or previous.source_scene<>p_scene or previous.question<>p_question then
      raise exception 'Request identity already used' using errcode='22023';
    end if;
    return jsonb_build_object('allowed',false,'reason','duplicate_request','balance',(select balance from fontex_ai.wallets where user_id=p_user));
  end if;
  delete from fontex_ai.canvas_builds where created_at<now()-interval '7 days';
  if (select count(*) from fontex_ai.canvas_builds where user_id=p_user)>=100 then
    return jsonb_build_object('allowed',false,'reason','receipt_limit','balance',(select balance from fontex_ai.wallets where user_id=p_user));
  end if;
  reserved:=fontex_ai.reserve_generation(p_user,p_request);
  if (reserved->>'allowed')::boolean then
    insert into fontex_ai.canvas_builds(id,user_id,scene_id,source_scene,question)
      values(p_request,p_user,p_scene->>'id',p_scene,p_question);
  end if;
  return reserved;
end $$;

create function fontex_ai.complete_canvas_build(p_request uuid,p_reply jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare settled jsonb; target fontex_ai.canvas_builds;
begin
  if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  select * into strict target from fontex_ai.canvas_builds where id=p_request;
  if p_reply is null or jsonb_typeof(p_reply)<>'object' or jsonb_typeof(p_reply->'actions') is distinct from 'array' or
    jsonb_array_length(p_reply->'actions')=0 or octet_length(p_reply::text)>262144 then raise exception 'Invalid proposal' using errcode='22023'; end if;
  -- Wallet then receipt: same lock order as reserve/fail. Reply and charge commit together.
  perform 1 from fontex_ai.wallets where user_id=target.user_id for update;
  select * into strict target from fontex_ai.canvas_builds where id=p_request for update;
  if target.reply is not null and target.reply<>p_reply then raise exception 'Proposal already completed' using errcode='22023'; end if;
  settled:=fontex_ai.finish_generation(p_request,true);
  if settled->>'status'='succeeded' then
    update fontex_ai.canvas_builds set reply=p_reply,completed_at=coalesce(completed_at,now()),failure_code=null where id=p_request;
  end if;
  return settled;
end $$;

create function fontex_ai.fail_canvas_build(p_request uuid,p_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if p_code not in ('generation_failed','cancelled','settlement_pending') or p_code is null then raise exception 'Invalid failure code' using errcode='22023'; end if;
  update fontex_ai.canvas_builds set failure_code=p_code where id=p_request and reply is null;
end $$;

create function fontex_ai.canvas_build(p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
  if actor is null or not fontex_beta.allowed(actor) then raise exception 'beta_invitation_required' using errcode='42501'; end if;
  perform 1 from fontex_ai.wallets where user_id=actor for update;
  perform fontex_ai.expire_reservations(actor);
  select jsonb_build_object('id',b.id,'state',case when r.status='succeeded' and b.reply is not null then 'ready' else r.status end,
    'source',b.source_scene,'question',b.question,'reply',b.reply,'created_at',b.created_at,'applied_at',b.applied_at)
    into result from fontex_ai.canvas_builds b join fontex_ai.reservations r on r.id=b.id
    where b.id=p_request and b.user_id=actor and b.created_at>=now()-interval '7 days';
  return result;
end $$;

create function fontex_ai.list_canvas_builds(p_scene text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
  if actor is null or not fontex_beta.allowed(actor) then raise exception 'beta_invitation_required' using errcode='42501'; end if;
  perform 1 from fontex_ai.wallets where user_id=actor for update;
  perform fontex_ai.expire_reservations(actor);
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at),'[]'::jsonb) into result from (
    select b.id,b.scene_id,b.created_at,b.applied_at,case when r.status='succeeded' and b.reply is not null then 'ready' else r.status end as state
    from fontex_ai.canvas_builds b join fontex_ai.reservations r on r.id=b.id
    where b.user_id=actor and b.scene_id=p_scene and b.created_at>=now()-interval '7 days'
    order by b.created_at desc limit 100
  ) page;
  return result;
end $$;

create function fontex_ai.ack_canvas_build(p_request uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not fontex_beta.allowed(auth.uid()) then raise exception 'beta_invitation_required' using errcode='42501'; end if;
  update fontex_ai.canvas_builds set applied_at=coalesce(applied_at,now()) where id=p_request and user_id=auth.uid() and reply is not null;
end $$;

-- Existing admin wrappers delegate here, including invitation and credit administration.
create or replace function fontex_ai.require_admin() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not fontex_beta.allowed(actor) or not exists(select 1 from fontex_ai.admins where user_id=actor) then
    raise exception 'Administration requires an authorized administrator' using errcode='42501';
  end if;
  if auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'admin_mfa_required' using errcode='42501'; end if;
  return actor;
end $$;

create function fontex_ai.canvas_diagnostics() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform fontex_ai.require_admin();
  select jsonb_build_object('window_hours',24,'total',count(*),
    'completed',count(*) filter(where r.status='succeeded'), 'refunded',count(*) filter(where r.status='refunded'),
    'pending',count(*) filter(where r.status='pending' and r.expires_at>now()),
    'awaiting_application',count(*) filter(where b.reply is not null and b.applied_at is null),
    'average_seconds',round(avg(extract(epoch from b.completed_at-b.created_at))::numeric,1)) into result
    from fontex_ai.canvas_builds b join fontex_ai.reservations r on r.id=b.id where b.created_at>=now()-interval '24 hours';
  return result;
end $$;

create function public.begin_canvas_build(p_user_id uuid,p_request_id uuid,p_scene jsonb,p_question text) returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.begin_canvas_build(p_user_id,p_request_id,p_scene,p_question)$$;
create function public.complete_canvas_build(p_request_id uuid,p_reply jsonb) returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.complete_canvas_build(p_request_id,p_reply)$$;
create function public.fail_canvas_build(p_request_id uuid,p_code text) returns void language sql security invoker set search_path='' as $$select fontex_ai.fail_canvas_build(p_request_id,p_code)$$;
create function public.get_canvas_build(p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.canvas_build(p_request_id)$$;
create function public.list_canvas_builds(p_scene_id text) returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.list_canvas_builds(p_scene_id)$$;
create function public.ack_canvas_build(p_request_id uuid) returns void language sql security invoker set search_path='' as $$select fontex_ai.ack_canvas_build(p_request_id)$$;
create function public.admin_canvas_diagnostics() returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.canvas_diagnostics()$$;

revoke all on function fontex_ai.begin_canvas_build(uuid,uuid,jsonb,text),fontex_ai.complete_canvas_build(uuid,jsonb),fontex_ai.fail_canvas_build(uuid,text),fontex_ai.canvas_build(uuid),fontex_ai.list_canvas_builds(text),fontex_ai.ack_canvas_build(uuid),fontex_ai.canvas_diagnostics() from public,anon,authenticated;
revoke all on function public.begin_canvas_build(uuid,uuid,jsonb,text),public.complete_canvas_build(uuid,jsonb),public.fail_canvas_build(uuid,text),public.get_canvas_build(uuid),public.list_canvas_builds(text),public.ack_canvas_build(uuid),public.admin_canvas_diagnostics() from public,anon,authenticated;
grant execute on function fontex_ai.begin_canvas_build(uuid,uuid,jsonb,text),fontex_ai.complete_canvas_build(uuid,jsonb),fontex_ai.fail_canvas_build(uuid,text),public.begin_canvas_build(uuid,uuid,jsonb,text),public.complete_canvas_build(uuid,jsonb),public.fail_canvas_build(uuid,text) to service_role;
grant execute on function fontex_ai.canvas_build(uuid),fontex_ai.list_canvas_builds(text),fontex_ai.ack_canvas_build(uuid),fontex_ai.canvas_diagnostics(),public.get_canvas_build(uuid),public.list_canvas_builds(text),public.ack_canvas_build(uuid),public.admin_canvas_diagnostics() to authenticated;

notify pgrst,'reload schema';
create or replace function public.get_release_contract() returns text language sql immutable security invoker set search_path='' as $$select 'closed-beta-v2'::text$$;
commit;
