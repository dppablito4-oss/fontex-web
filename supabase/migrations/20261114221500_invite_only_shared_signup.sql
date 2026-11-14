begin;
-- The operator explicitly chose invite-only signup for the entire shared
-- project. Existing forma API access and stored content remain independent.
create function fontex_beta.check_signup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from fontex_beta.invitations
    where email=lower(btrim(new.email)) and enabled and expires_at>now() for update;
  if not found then
    raise exception 'Beta cerrada: se requiere invitación para este correo' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function fontex_beta.check_signup() from public,anon,authenticated;
create trigger fontex_beta_check_signup before insert on auth.users
for each row execute function fontex_beta.check_signup();
commit;
