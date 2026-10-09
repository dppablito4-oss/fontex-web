begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.classroom_role as enum ('teacher', 'student');
create type public.membership_status as enum ('active', 'removed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_by uuid not null default auth.uid() references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  title text not null check (char_length(title) between 2 and 120),
  term text check (term is null or char_length(term) between 1 and 40),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_members (
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.classroom_role not null default 'student',
  status public.membership_status not null default 'active',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

create table public.classroom_invitations (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  invited_email text not null check (
    invited_email = lower(invited_email)
    and invited_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  role public.classroom_role not null default 'student',
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_by uuid not null default auth.uid() references public.profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((accepted_at is null) = (accepted_by is null))
);

create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (classroom_id, name)
);

create table public.group_members (
  group_id uuid not null references public.study_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index class_members_user_active_idx
  on public.class_members (user_id, classroom_id)
  where status = 'active';
create index classroom_invitations_classroom_idx
  on public.classroom_invitations (classroom_id, expires_at);
create index study_groups_classroom_idx
  on public.study_groups (classroom_id);
create index group_members_user_idx
  on public.group_members (user_id, group_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();
create trigger classrooms_set_updated_at
before update on public.classrooms
for each row execute function private.set_updated_at();
create trigger class_members_set_updated_at
before update on public.class_members
for each row execute function private.set_updated_at();
create trigger study_groups_set_updated_at
before update on public.study_groups
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_name text;
begin
  candidate_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Usuario'
  );

  insert into public.profiles (id, display_name)
  values (new.id, left(candidate_name, 80));

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.is_classroom_member(target_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_members
    where classroom_id = target_classroom_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function private.is_classroom_teacher(target_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_members
    where classroom_id = target_classroom_id
      and user_id = (select auth.uid())
      and role = 'teacher'
      and status = 'active'
  );
$$;

create or replace function private.shares_active_classroom(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_members own_membership
    join public.class_members other_membership
      on other_membership.classroom_id = own_membership.classroom_id
    where own_membership.user_id = (select auth.uid())
      and own_membership.status = 'active'
      and other_membership.user_id = other_user_id
      and other_membership.status = 'active'
  );
$$;

create or replace function private.can_access_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classrooms classroom
    join public.class_members membership on membership.classroom_id = classroom.id
    where classroom.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function private.can_access_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.study_groups study_group
    join public.class_members membership on membership.classroom_id = study_group.classroom_id
    where study_group.id = target_group_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function private.is_group_teacher(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.study_groups study_group
    join public.class_members membership on membership.classroom_id = study_group.classroom_id
    where study_group.id = target_group_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'teacher'
      and membership.status = 'active'
  );
$$;

create or replace function private.is_active_class_member_for_group(
  target_group_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.study_groups study_group
    join public.class_members membership on membership.classroom_id = study_group.classroom_id
    where study_group.id = target_group_id
      and membership.user_id = target_user_id
      and membership.status = 'active'
  );
$$;

revoke all on function private.is_classroom_member(uuid) from public, anon;
revoke all on function private.is_classroom_teacher(uuid) from public, anon;
revoke all on function private.shares_active_classroom(uuid) from public, anon;
revoke all on function private.can_access_organization(uuid) from public, anon;
revoke all on function private.can_access_group(uuid) from public, anon;
revoke all on function private.is_group_teacher(uuid) from public, anon;
revoke all on function private.is_active_class_member_for_group(uuid, uuid) from public, anon;
grant execute on function private.is_classroom_member(uuid) to authenticated;
grant execute on function private.is_classroom_teacher(uuid) to authenticated;
grant execute on function private.shares_active_classroom(uuid) to authenticated;
grant execute on function private.can_access_organization(uuid) to authenticated;
grant execute on function private.can_access_group(uuid) to authenticated;
grant execute on function private.is_group_teacher(uuid) to authenticated;
grant execute on function private.is_active_class_member_for_group(uuid, uuid) to authenticated;

create or replace function private.provision_classroom_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.class_members (classroom_id, user_id, role, status)
  values (new.id, new.owner_id, 'teacher', 'active');
  return new;
end;
$$;

revoke all on function private.provision_classroom_owner() from public, anon, authenticated;

create trigger on_classroom_created
after insert on public.classrooms
for each row execute function private.provision_classroom_owner();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.classrooms enable row level security;
alter table public.class_members enable row level security;
alter table public.classroom_invitations enable row level security;
alter table public.study_groups enable row level security;
alter table public.group_members enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.classrooms from anon, authenticated;
revoke all on table public.class_members from anon, authenticated;
revoke all on table public.classroom_invitations from anon, authenticated;
revoke all on table public.study_groups from anon, authenticated;
revoke all on table public.group_members from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select, insert on table public.organizations to authenticated;
grant update (name) on table public.organizations to authenticated;
grant select, insert on table public.classrooms to authenticated;
grant update (title, term) on table public.classrooms to authenticated;
grant select on table public.class_members to authenticated;
grant select on table public.classroom_invitations to authenticated;
grant select, insert, delete on table public.study_groups to authenticated;
grant update (name) on table public.study_groups to authenticated;
grant select, insert, delete on table public.group_members to authenticated;

create policy profiles_select_related
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.shares_active_classroom(id))
);

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organizations_select_members
on public.organizations for select
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.can_access_organization(id))
);

create policy organizations_insert_owner
on public.organizations for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy organizations_update_creator
on public.organizations for update
to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy classrooms_select_members
on public.classrooms for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.is_classroom_member(id))
);

create policy classrooms_insert_owner
on public.classrooms for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.organizations organization
    where organization.id = organization_id
      and organization.created_by = (select auth.uid())
      and organization.status = 'active'
  )
);

create policy classrooms_update_teachers
on public.classrooms for update
to authenticated
using ((select private.is_classroom_teacher(id)))
with check ((select private.is_classroom_teacher(id)));

create policy class_members_select_classmates
on public.class_members for select
to authenticated
using ((select private.is_classroom_member(classroom_id)));

create policy classroom_invitations_select_teachers
on public.classroom_invitations for select
to authenticated
using ((select private.is_classroom_teacher(classroom_id)));

create policy study_groups_select_class_members
on public.study_groups for select
to authenticated
using ((select private.is_classroom_member(classroom_id)));

create policy study_groups_insert_teachers
on public.study_groups for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_classroom_teacher(classroom_id))
);

create policy study_groups_update_teachers
on public.study_groups for update
to authenticated
using ((select private.is_classroom_teacher(classroom_id)))
with check ((select private.is_classroom_teacher(classroom_id)));

create policy study_groups_delete_teachers
on public.study_groups for delete
to authenticated
using ((select private.is_classroom_teacher(classroom_id)));

create policy group_members_select_class_members
on public.group_members for select
to authenticated
using ((select private.can_access_group(group_id)));

create policy group_members_insert_teachers
on public.group_members for insert
to authenticated
with check (
  added_by = (select auth.uid())
  and (select private.is_group_teacher(group_id))
  and (select private.is_active_class_member_for_group(group_id, user_id))
);

create policy group_members_delete_teachers
on public.group_members for delete
to authenticated
using ((select private.is_group_teacher(group_id)));

create or replace function public.create_classroom_invitation(
  target_classroom_id uuid,
  target_email text,
  target_role public.classroom_role default 'student',
  valid_for interval default interval '7 days'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(target_email));
  raw_token text;
  invitation_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not (select private.is_classroom_teacher(target_classroom_id)) then
    raise exception 'teacher membership required' using errcode = '42501';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid invitation email' using errcode = '22023';
  end if;

  if valid_for <= interval '0 seconds' or valid_for > interval '30 days' then
    raise exception 'invitation duration must be between 1 second and 30 days' using errcode = '22023';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.classroom_invitations (
    classroom_id,
    invited_email,
    role,
    token_hash,
    created_by,
    expires_at
  )
  values (
    target_classroom_id,
    normalized_email,
    target_role,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    (select auth.uid()),
    now() + valid_for
  )
  returning id into invitation_id;

  return jsonb_build_object('invitation_id', invitation_id, 'token', raw_token);
end;
$$;

create or replace function public.accept_classroom_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.classroom_invitations%rowtype;
  caller_id uuid := (select auth.uid());
  caller_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select *
  into invitation
  from public.classroom_invitations
  where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invitation is invalid or expired' using errcode = '22023';
  end if;

  if caller_email = '' or caller_email <> invitation.invited_email then
    raise exception 'invitation email does not match authenticated user' using errcode = '42501';
  end if;

  insert into public.class_members (
    classroom_id,
    user_id,
    role,
    status,
    invited_by
  )
  values (
    invitation.classroom_id,
    caller_id,
    invitation.role,
    'active',
    invitation.created_by
  )
  on conflict (classroom_id, user_id) do update
  set role = excluded.role,
      status = 'active',
      invited_by = excluded.invited_by,
      updated_at = now();

  update public.classroom_invitations
  set accepted_at = now(), accepted_by = caller_id
  where id = invitation.id;

  return invitation.classroom_id;
end;
$$;

create or replace function public.set_classroom_member_role(
  target_classroom_id uuid,
  target_user_id uuid,
  target_role public.classroom_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  classroom_owner_id uuid;
begin
  select owner_id into classroom_owner_id
  from public.classrooms
  where id = target_classroom_id;

  if classroom_owner_id is null or classroom_owner_id <> (select auth.uid()) then
    raise exception 'only the classroom owner can change roles' using errcode = '42501';
  end if;

  if target_user_id = classroom_owner_id then
    raise exception 'the classroom owner role cannot be changed' using errcode = '22023';
  end if;

  update public.class_members
  set role = target_role
  where classroom_id = target_classroom_id
    and user_id = target_user_id
    and status = 'active';

  if not found then
    raise exception 'active classroom membership not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.remove_classroom_member(
  target_classroom_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  classroom_owner_id uuid;
begin
  if not (select private.is_classroom_teacher(target_classroom_id)) then
    raise exception 'teacher membership required' using errcode = '42501';
  end if;

  select owner_id into classroom_owner_id
  from public.classrooms
  where id = target_classroom_id;

  if target_user_id = classroom_owner_id then
    raise exception 'the classroom owner cannot be removed' using errcode = '22023';
  end if;

  update public.class_members
  set status = 'removed'
  where classroom_id = target_classroom_id
    and user_id = target_user_id
    and status = 'active';

  if not found then
    raise exception 'active classroom membership not found' using errcode = 'P0002';
  end if;

  delete from public.group_members membership
  using public.study_groups study_group
  where membership.group_id = study_group.id
    and study_group.classroom_id = target_classroom_id
    and membership.user_id = target_user_id;
end;
$$;

create or replace function public.revoke_classroom_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_classroom_id uuid;
begin
  select classroom_id into target_classroom_id
  from public.classroom_invitations
  where id = target_invitation_id
    and accepted_at is null
    and revoked_at is null;

  if target_classroom_id is null
    or not (select private.is_classroom_teacher(target_classroom_id)) then
    raise exception 'active invitation not found or permission denied' using errcode = '42501';
  end if;

  update public.classroom_invitations
  set revoked_at = now()
  where id = target_invitation_id;
end;
$$;

revoke all on function public.create_classroom_invitation(uuid, text, public.classroom_role, interval) from public, anon;
revoke all on function public.accept_classroom_invitation(text) from public, anon;
revoke all on function public.set_classroom_member_role(uuid, uuid, public.classroom_role) from public, anon;
revoke all on function public.remove_classroom_member(uuid, uuid) from public, anon;
revoke all on function public.revoke_classroom_invitation(uuid) from public, anon;
grant execute on function public.create_classroom_invitation(uuid, text, public.classroom_role, interval) to authenticated;
grant execute on function public.accept_classroom_invitation(text) to authenticated;
grant execute on function public.set_classroom_member_role(uuid, uuid, public.classroom_role) to authenticated;
grant execute on function public.remove_classroom_member(uuid, uuid) to authenticated;
grant execute on function public.revoke_classroom_invitation(uuid) to authenticated;

commit;
