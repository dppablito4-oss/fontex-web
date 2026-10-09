begin;

-- Event trigger installed only on hosted projects: it must not be callable as an API RPC.
do $$
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- PostgreSQL does not create indexes automatically for the referencing side of FKs.
create index organizations_created_by_idx on public.organizations (created_by);
create index classrooms_organization_id_idx on public.classrooms (organization_id);
create index classrooms_owner_id_idx on public.classrooms (owner_id);
create index class_members_user_id_idx on public.class_members (user_id);
create index classroom_invitations_created_by_idx on public.classroom_invitations (created_by);
create index classroom_invitations_accepted_by_idx
  on public.classroom_invitations (accepted_by)
  where accepted_by is not null;
create index study_groups_created_by_idx on public.study_groups (created_by);
create index group_members_added_by_idx on public.group_members (added_by);

drop policy organizations_insert_owner on public.organizations;
drop policy classrooms_insert_owner on public.classrooms;
revoke insert on table public.organizations from authenticated;
revoke insert on table public.classrooms from authenticated;

create or replace function public.create_workspace(
  organization_name text,
  classroom_title text,
  classroom_term text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  organization_id uuid;
  classroom_id uuid;
  caller_is_teacher boolean;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Serializes the one-time bootstrap so two new accounts cannot both claim it.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('fontex:first-workspace'));

  select exists (
    select 1
    from public.class_members membership
    where membership.user_id = caller_id
      and membership.role = 'teacher'
      and membership.status = 'active'
  ) into caller_is_teacher;

  if exists (select 1 from public.organizations) and not caller_is_teacher then
    raise exception 'an active teacher role is required to create another workspace'
      using errcode = '42501';
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(organization_name), caller_id)
  returning id into organization_id;

  insert into public.classrooms (organization_id, title, term, owner_id)
  values (
    organization_id,
    btrim(classroom_title),
    nullif(btrim(classroom_term), ''),
    caller_id
  )
  returning id into classroom_id;

  return classroom_id;
end;
$$;

revoke all on function public.create_workspace(text, text, text) from public, anon, authenticated;
grant execute on function public.create_workspace(text, text, text) to authenticated;

commit;
