-- One versioned private snapshot keeps each material and its conversation together.
create table public.studio_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint studio_workspace_bounded check (
    octet_length(state::text) <= 2097152
    and jsonb_typeof(state) = 'object'
    and state ?& array['documents','activeId','conversations']
    and jsonb_typeof(state->'documents') = 'array'
    and jsonb_array_length(state->'documents') <= 100
    and jsonb_typeof(state->'conversations') = 'object'
    and jsonb_typeof(state->'activeId') in ('string','null')
  )
);
alter table public.studio_workspaces enable row level security;
revoke all on public.studio_workspaces from public, anon, authenticated;
grant select on public.studio_workspaces to authenticated;
grant insert (user_id, state, revision) on public.studio_workspaces to authenticated;
grant update (state, revision) on public.studio_workspaces to authenticated;
create policy studio_workspace_read on public.studio_workspaces for select to authenticated
  using (user_id = (select auth.uid()));
create policy studio_workspace_create on public.studio_workspaces for insert to authenticated
  with check (user_id = (select auth.uid()) and revision = 1);
create policy studio_workspace_update on public.studio_workspaces for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create function public.advance_studio_workspace_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id or new.revision <> old.revision + 1 then
    raise exception 'Invalid workspace revision' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.advance_studio_workspace_revision() from public, anon, authenticated;
create trigger studio_workspace_revision before update on public.studio_workspaces
  for each row execute function public.advance_studio_workspace_revision();
comment on table public.studio_workspaces is 'Private Studio materials and chat history; clients use revision compare-and-set to preserve concurrent edits.';
