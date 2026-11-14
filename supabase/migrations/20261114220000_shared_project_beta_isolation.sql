begin;
-- Auth and the forma API belong to a shared project. A new account is not a
-- Fontex participant until an administrator has invited its verified email.
drop trigger fontex_beta_check_signup on auth.users;
drop function fontex_beta.check_signup();
create or replace function fontex_beta.admit_signup() returns trigger
language plpgsql security definer set search_path='' as $$
declare inviter uuid;
begin
  select invited_by into inviter from fontex_beta.invitations
    where email=lower(btrim(new.email)) and enabled and expires_at>now() for update;
  if not found then return new; end if;
  insert into fontex_beta.members(user_id,granted_by) values(new.id,inviter);
  update fontex_beta.invitations set enabled=false where email=lower(btrim(new.email));
  return new;
end $$;
create or replace function fontex_beta.check_request() returns void
language plpgsql security definer set search_path='' as $$
declare
  path text:=ltrim(coalesce(current_setting('request.path',true),''),'/');
  headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  profile text;
begin
  if current_setting('role',true)='service_role' then return; end if;
  -- PostgREST selects Accept-Profile for reads and Content-Profile for writes.
  -- Checking either header indiscriminately would let a conflicting header
  -- bypass the guard on a request that actually targets public.
  if current_setting('request.method',true) in ('GET','HEAD') then
    profile:=coalesce(headers->>'accept-profile','public');
  else
    profile:=coalesce(headers->>'content-profile','public');
  end if;
  if profile='forma' or path='forma_connection_checks' then return; end if;
  if path='rpc/get_release_contract' then return; end if;
  if current_setting('role',true)='authenticated' and path='rpc/get_beta_access_status' then return; end if;
  if not fontex_beta.allowed(auth.uid()) then
    raise exception 'beta_invitation_required' using errcode='42501';
  end if;
end $$;
do $$ begin
  if to_regclass('public.forma_connection_checks') is not null then
    execute 'drop policy if exists beta_members_only on public.forma_connection_checks';
  end if;
end $$;
notify pgrst,'reload config';
commit;
