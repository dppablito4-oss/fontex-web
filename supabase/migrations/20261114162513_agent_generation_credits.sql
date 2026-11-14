begin;
create schema if not exists fontex_ai;
revoke all on schema fontex_ai from public, anon, authenticated;
grant usage on schema fontex_ai to authenticated, service_role;

create table fontex_ai.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table fontex_ai.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 5 check (balance between 0 and 1000000),
  updated_at timestamptz not null default now()
);
create table fontex_ai.reservations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','succeeded','refunded')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '2 minutes'),
  finished_at timestamptz
);
create unique index ai_one_pending_generation on fontex_ai.reservations(user_id) where status='pending';
create index ai_reservations_user_created on fontex_ai.reservations(user_id,created_at desc);
create table fontex_ai.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  reservation_id uuid references fontex_ai.reservations(id) on delete cascade,
  request_key uuid,
  kind text not null check (kind in ('initial','grant','reserve','complete','refund')),
  delta integer not null,
  balance_after integer not null,
  reason text not null default '' check (length(reason)<=200),
  created_at timestamptz not null default now()
);
create unique index ai_one_initial_grant on fontex_ai.events(user_id) where kind='initial';
create unique index ai_grant_request_once on fontex_ai.events(request_key) where kind='grant';
create unique index ai_reservation_event_once on fontex_ai.events(reservation_id,kind) where reservation_id is not null;
create index ai_events_user_created on fontex_ai.events(user_id,created_at desc,id);
alter table fontex_ai.admins enable row level security;
alter table fontex_ai.wallets enable row level security;
alter table fontex_ai.reservations enable row level security;
alter table fontex_ai.events enable row level security;
revoke all on all tables in schema fontex_ai from public, anon, authenticated;
-- No direct table access is needed, including for the Edge Function: all writes use the RPCs.

create function fontex_ai.ensure_wallet(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  insert into fontex_ai.wallets(user_id) values(p_user) on conflict do nothing;
  if found then
    insert into fontex_ai.events(user_id,kind,delta,balance_after,reason) values(p_user,'initial',5,5,'Créditos iniciales');
  end if;
end $$;
create function fontex_ai.new_account_wallet() returns trigger language plpgsql security definer set search_path='' as $$
begin perform fontex_ai.ensure_wallet(new.id); return new; end $$;
create trigger fontex_ai_new_account after insert on auth.users for each row execute function fontex_ai.new_account_wallet();
select fontex_ai.ensure_wallet(id) from auth.users;
-- Bootstrap only the existing, verified owner account. Later signups cannot inherit this permission by email.
insert into fontex_ai.admins(user_id)
select id from auth.users where lower(email)='pabloclsa87@gmail.com' and email_confirmed_at is not null;

create function fontex_ai.require_admin() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists(select 1 from fontex_ai.admins where user_id=actor) then
    raise exception 'AI credit administration requires an authorized administrator' using errcode='42501';
  end if;
  return actor;
end $$;
-- Call with this user's wallet already locked, so cleanup and reservation cannot race.
create function fontex_ai.expire_reservations(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare pending record; remaining integer;
begin
  for pending in select id from fontex_ai.reservations where user_id=p_user and status='pending' and expires_at<=now() for update loop
    update fontex_ai.reservations set status='refunded',finished_at=now() where id=pending.id;
    update fontex_ai.wallets set balance=balance+1,updated_at=now() where user_id=p_user returning balance into remaining;
    insert into fontex_ai.events(user_id,reservation_id,kind,delta,balance_after,reason) values(p_user,pending.id,'refund',1,remaining,'Generación interrumpida: reserva vencida');
  end loop;
end $$;
create function fontex_ai.credit_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); remaining integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform fontex_ai.ensure_wallet(actor);
  perform 1 from fontex_ai.wallets where user_id=actor for update;
  perform fontex_ai.expire_reservations(actor);
  select balance into remaining from fontex_ai.wallets where user_id=actor;
  return jsonb_build_object('balance',remaining,'initial_credits',5,'is_admin',exists(select 1 from fontex_ai.admins where user_id=actor),'active_generation',exists(select 1 from fontex_ai.reservations where user_id=actor and status='pending'));
end $$;
create function fontex_ai.reserve_generation(p_user uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare remaining integer;
begin
  if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if p_user is null or p_request is null then raise exception 'Generation identity required' using errcode='22023'; end if;
  perform fontex_ai.ensure_wallet(p_user);
  select balance into remaining from fontex_ai.wallets where user_id=p_user for update;
  perform fontex_ai.expire_reservations(p_user);
  select balance into remaining from fontex_ai.wallets where user_id=p_user;
  if exists(select 1 from fontex_ai.reservations where id=p_request) then return jsonb_build_object('allowed',false,'balance',remaining,'reason','duplicate_request'); end if;
  if exists(select 1 from fontex_ai.reservations where user_id=p_user and status='pending') then return jsonb_build_object('allowed',false,'balance',remaining,'reason','generation_busy'); end if;
  if remaining<1 then return jsonb_build_object('allowed',false,'balance',remaining,'reason','credits_exhausted'); end if;
  update fontex_ai.wallets set balance=balance-1,updated_at=now() where user_id=p_user returning balance into remaining;
  insert into fontex_ai.reservations(id,user_id) values(p_request,p_user);
  insert into fontex_ai.events(user_id,reservation_id,kind,delta,balance_after,reason) values(p_user,p_request,'reserve',-1,remaining,'Crear en el lienzo');
  return jsonb_build_object('allowed',true,'balance',remaining,'reason','reserved');
end $$;
create function fontex_ai.finish_generation(p_request uuid,p_success boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; reservation fontex_ai.reservations%rowtype; remaining integer; completed boolean;
begin
  if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if p_success is null then raise exception 'Completion status required' using errcode='22023'; end if;
  select user_id into target from fontex_ai.reservations where id=p_request;
  if target is null then raise exception 'Unknown generation' using errcode='22023'; end if;
  perform 1 from fontex_ai.wallets where user_id=target for update;
  select * into reservation from fontex_ai.reservations where id=p_request for update;
  if reservation.status='pending' then
    completed:=p_success and reservation.expires_at>now();
    update fontex_ai.reservations set status=case when completed then 'succeeded' else 'refunded' end,finished_at=now() where id=p_request returning * into reservation;
    if not completed then update fontex_ai.wallets set balance=balance+1,updated_at=now() where user_id=target; end if;
    select balance into remaining from fontex_ai.wallets where user_id=target;
    insert into fontex_ai.events(user_id,reservation_id,kind,delta,balance_after,reason) values(target,p_request,case when completed then 'complete' else 'refund' end,case when completed then 0 else 1 end,remaining,case when completed then 'Generación completada' else 'Generación no completada' end);
  end if;
  select balance into remaining from fontex_ai.wallets where user_id=target;
  return jsonb_build_object('balance',remaining,'status',reservation.status);
end $$;
create function fontex_ai.list_accounts(p_search text,p_limit integer,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; term text:=lower(trim(coalesce(p_search,''))); page_size integer:=greatest(1,least(coalesce(p_limit,25),50)); start_at integer:=greatest(0,least(coalesce(p_offset,0),50000));
begin
  perform fontex_ai.require_admin();
  if length(term)>120 then raise exception 'Search too long' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc,page.user_id),'[]'::jsonb) into result from (
    select u.id as user_id,u.email,coalesce(p.display_name,'Usuario Fontex') as display_name,w.balance as credits,u.created_at,
      exists(select 1 from fontex_ai.admins a where a.user_id=u.id) as is_admin
    from auth.users u join fontex_ai.wallets w on w.user_id=u.id left join public.profiles p on p.id=u.id
    where term='' or strpos(lower(coalesce(u.email,'')),term)>0 or strpos(lower(coalesce(p.display_name,'')),term)>0
    order by u.created_at desc,u.id limit page_size+1 offset start_at
  ) page;
  return jsonb_build_object('accounts',result,'page_size',page_size);
end $$;
create function fontex_ai.grant_credits(p_user uuid,p_amount integer,p_reason text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=fontex_ai.require_admin(); remaining integer; previous fontex_ai.events%rowtype; reason text:=trim(coalesce(p_reason,''));
begin
  if p_user is null or p_request is null or p_amount is null or p_amount<1 or p_amount>1000 or length(reason)>200 then raise exception 'Grant requires 1 to 1000 credits and a valid request' using errcode='22023'; end if;
  if not exists(select 1 from auth.users where id=p_user) then raise exception 'Account not found' using errcode='22023'; end if;
  perform fontex_ai.ensure_wallet(p_user);
  perform 1 from fontex_ai.wallets where user_id=p_user for update;
  select * into previous from fontex_ai.events where request_key=p_request and kind='grant';
  if found then
    if previous.user_id<>p_user or previous.actor_id<>actor or previous.delta<>p_amount or previous.reason<>reason then raise exception 'Grant identity mismatch' using errcode='22023'; end if;
    select balance into remaining from fontex_ai.wallets where user_id=p_user;
    return jsonb_build_object('balance',remaining,'duplicate',true);
  end if;
  perform fontex_ai.expire_reservations(p_user);
  select balance into remaining from fontex_ai.wallets where user_id=p_user;
  if remaining+p_amount+(select count(*) from fontex_ai.reservations where user_id=p_user and status='pending')>1000000 then raise exception 'Credit balance limit exceeded' using errcode='22023'; end if;
  update fontex_ai.wallets set balance=balance+p_amount,updated_at=now() where user_id=p_user returning balance into remaining;
  insert into fontex_ai.events(user_id,actor_id,request_key,kind,delta,balance_after,reason) values(p_user,actor,p_request,'grant',p_amount,remaining,reason);
  return jsonb_build_object('balance',remaining,'duplicate',false);
end $$;
create function fontex_ai.credit_history(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform fontex_ai.require_admin();
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc,page.id),'[]'::jsonb) into result from (
    select id,kind,delta,balance_after,reason,created_at from fontex_ai.events where user_id=p_user order by created_at desc,id limit 20
  ) page;
  return result;
end $$;

-- Exposed wrappers are invoker functions. Privileged bodies stay in the non-exposed schema.
create function public.get_ai_credit_status() returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.credit_status()$$;
create function public.reserve_ai_generation(p_user_id uuid,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.reserve_generation(p_user_id,p_request_id)$$;
create function public.finish_ai_generation(p_request_id uuid,p_success boolean) returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.finish_generation(p_request_id,p_success)$$;
create function public.admin_list_ai_accounts(p_search text default '',p_limit integer default 25,p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.list_accounts(p_search,p_limit,p_offset)$$;
create function public.admin_grant_ai_credits(p_user_id uuid,p_amount integer,p_reason text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.grant_credits(p_user_id,p_amount,p_reason,p_request_id)$$;
create function public.admin_ai_credit_history(p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fontex_ai.credit_history(p_user_id)$$;

revoke all on all functions in schema fontex_ai from public,anon,authenticated;
grant execute on function fontex_ai.credit_status(),fontex_ai.list_accounts(text,integer,integer),fontex_ai.grant_credits(uuid,integer,text,uuid),fontex_ai.credit_history(uuid) to authenticated;
grant execute on function fontex_ai.reserve_generation(uuid,uuid),fontex_ai.finish_generation(uuid,boolean) to service_role;
revoke all on function public.get_ai_credit_status(),public.admin_list_ai_accounts(text,integer,integer),public.admin_grant_ai_credits(uuid,integer,text,uuid),public.admin_ai_credit_history(uuid) from public,anon,authenticated;
grant execute on function public.get_ai_credit_status(),public.admin_list_ai_accounts(text,integer,integer),public.admin_grant_ai_credits(uuid,integer,text,uuid),public.admin_ai_credit_history(uuid) to authenticated;
revoke all on function public.reserve_ai_generation(uuid,uuid),public.finish_ai_generation(uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_ai_generation(uuid,uuid),public.finish_ai_generation(uuid,boolean) to service_role;
commit;
