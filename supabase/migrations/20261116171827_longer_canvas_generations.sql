begin;
alter table fontex_ai.reservations alter column expires_at set default (now()+interval '180 seconds');
alter table fontex_beta.requests alter column expires_at set default (now()+interval '180 seconds');


create or replace function public.get_guest_ai_status(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.classroom_guests;
begin
 g:=private.learning_guest(p_token);
 if g.id is null then raise exception 'classroom_guest_expired' using errcode='42501';end if;
 perform 1 from private.classroom_guests where id=g.id for update;
 with expired as(update private.guest_ai_builds set state='refunded' where guest_id=g.id and state='pending' and created_at<now()-interval '180 seconds' returning id)
 update private.classroom_guests set ai_balance=ai_balance+(select count(*) from expired) where id=g.id;
 return (select jsonb_build_object('id',id,'balance',ai_balance,'initial_credits',5,'is_admin',false,'active_generation',exists(select 1 from private.guest_ai_builds where guest_id=g.id and state='pending')) from private.classroom_guests where id=g.id);
end $$;

create or replace function public.guest_ai_usage(p_token text,p_request uuid,p_task text default null,p_tokens integer default 0,p_finish boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.classroom_guests;limits fontex_beta.runtime_limits;
begin
 if p_finish then update private.guest_ai_requests set finished=true where id=p_request;return '{"allowed":true,"reason":"finished"}';end if;
 g:=private.learning_guest(p_token);
 if g.id is null then return '{"allowed":false,"reason":"guest_expired"}';end if;
 select * into strict limits from fontex_beta.runtime_limits where id for update;
 if not limits.ai_enabled then return '{"allowed":false,"reason":"ai_paused"}';end if;
 if p_request is null or p_task not in('chat','build') or p_tokens not between 1 and 150000 then raise exception 'Invalid reservation';end if;
 if (select count(*) from private.guest_ai_requests where guest_id=g.id and created_at>now()-interval '1 hour')>=limits.max_user_hour
 or (select count(*) from private.guest_ai_requests where guest_id=g.id and created_at>now()-interval '1 day')>=limits.max_user_day
 or (select count(*) from private.guest_ai_requests where not finished and created_at>now()-interval '180 seconds')+(select count(*) from fontex_beta.requests where status='pending' and expires_at>now())>=limits.max_global_concurrent
 or (select count(*) from private.guest_ai_requests where guest_id=g.id and not finished and created_at>now()-interval '180 seconds')>0
 or (select count(*) from private.guest_ai_requests where created_at>now()-interval '1 day')+(select count(*) from fontex_beta.requests where created_at>now()-interval '1 day')>=limits.max_global_day
 or coalesce((select sum(tokens) from private.guest_ai_requests where created_at>now()-interval '1 day'),0)+coalesce((select sum(reserved_tokens) from fontex_beta.requests where created_at>now()-interval '1 day'),0)+p_tokens>limits.max_reserved_tokens_day
 then return '{"allowed":false,"reason":"usage_limit"}';end if;
 insert into private.guest_ai_requests(id,guest_id,task,tokens) values(p_request,g.id,p_task,p_tokens);
 return '{"allowed":true,"reason":"reserved"}';
end $$;

create or replace function public.complete_classroom_guest(p_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare g private.classroom_guests;result uuid;
begin
 perform 1 from auth.users where id=auth.uid() for update;
 select * into g from private.classroom_guests where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if g.id is null then raise exception 'classroom_guest_expired' using errcode='42501';end if;
 if exists(select 1 from private.guest_ai_builds where guest_id=g.id and state='pending' and created_at>now()-interval '180 seconds') then raise exception 'Espera a que termine la generación de IA.';end if;
 result:=public.complete_classroom_guest_before_learning(p_token);
 perform private.promote_guest_learning(g.id,auth.uid());
 return result;
end $$;

create or replace function fontex_beta.reserve(p_user uuid,p_id uuid,p_task text,p_tokens integer) returns jsonb language plpgsql security definer set search_path='' as $$
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
  elsif (select count(*) from fontex_beta.requests where status='pending')+(select count(*) from private.guest_ai_requests where not finished and created_at>now()-interval '180 seconds')>=limits.max_global_concurrent then reason:='global_busy';
  end if;
  select count(*) filter(where user_id=p_user and created_at>=now()-interval '1 hour'),count(*) filter(where user_id=p_user),count(*),coalesce(sum(reserved_tokens),0)
    into user_hour,user_day,global_day,tokens from fontex_beta.requests where created_at>=now()-interval '24 hours';
  global_day:=global_day+(select count(*) from private.guest_ai_requests where created_at>=now()-interval '24 hours');
  tokens:=tokens+coalesce((select sum(gr.tokens) from private.guest_ai_requests gr where created_at>=now()-interval '24 hours'),0);
  if reason is null then
    if user_hour>=limits.max_user_hour or user_day>=limits.max_user_day then reason:='user_rate_limit';
    elsif global_day>=limits.max_global_day or tokens+p_tokens>limits.max_reserved_tokens_day then reason:='global_budget'; end if;
  end if;
  if reason is not null then return jsonb_build_object('allowed',false,'reason',reason); end if;
  insert into fontex_beta.requests(id,user_id,task,reserved_tokens) values(p_id,p_user,p_task,p_tokens);
  return jsonb_build_object('allowed',true,'reason','reserved');
end $$;

create or replace function public.get_release_contract() returns text language sql immutable security invoker set search_path='' as $$select 'closed-beta-v4'::text$$;
notify pgrst,'reload schema';
commit;
