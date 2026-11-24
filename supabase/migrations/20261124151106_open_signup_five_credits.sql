begin;

-- Registration is public; verified membership and account revocation still
-- protect the application, API, Storage and AI endpoints.
drop trigger if exists fontex_beta_check_signup on auth.users;
drop function if exists fontex_beta.check_signup();

create or replace function fontex_beta.admit_signup()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare inviter uuid; guest_id uuid;
begin
  -- A valid classroom credential can still link a guest's existing work.
  -- Arbitrary metadata never selects a role or another user's membership.
  select l.created_by,g.id into inviter,guest_id
  from private.classroom_guests g
  join private.classroom_join_links l on l.id=g.link_id
  where g.token_hash=encode(extensions.digest(new.raw_user_meta_data->>'classroom_guest_token','sha256'),'hex')
    and g.claimed_by is null and g.expires_at>now()
    and l.expires_at>now() and l.revoked_at is null
  for update of g;
  if found then
    insert into fontex_beta.members(user_id,granted_by)
      values(new.id,inviter) on conflict(user_id) do nothing;
    update private.classroom_guests set claimed_by=new.id where id=guest_id;
    return new;
  end if;

  select invited_by into inviter from fontex_beta.invitations
    where email=lower(btrim(new.email)) and enabled and expires_at>now()
    for update;
  insert into fontex_beta.members(user_id,granted_by)
    values(new.id,inviter) on conflict(user_id) do nothing;
  update fontex_beta.invitations set enabled=false
    where email=lower(btrim(new.email)) and enabled and expires_at>now();
  return new;
end;
$$;

-- Admit existing email accounts without undoing an explicit revocation.
insert into fontex_beta.members(user_id)
  select id from auth.users
  where email is not null and not coalesce(is_anonymous,false)
  on conflict(user_id) do nothing;

-- The existing initializer grants five once and records its ledger event.
-- Reusing it preserves balances, spent credits and guest promotion rules.
alter table fontex_ai.wallets alter column balance set default 5;
select fontex_ai.ensure_wallet(id) from auth.users
  where email is not null and not coalesce(is_anonymous,false);

commit;
