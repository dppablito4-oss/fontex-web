-- Public snapshots require the unguessable link. Personal scenes stay private.
create table public.canvas_public_shares (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_id text not null,
  scene jsonb not null check (octet_length(scene::text) <= 1048576),
  updated_at timestamptz not null default now(),
  foreign key (user_id, scene_id) references public.visual_scenes(user_id, id) on delete cascade,
  unique (user_id, scene_id)
);
alter table public.canvas_public_shares enable row level security;
revoke all on public.canvas_public_shares from public, anon, authenticated;
grant select, delete on public.canvas_public_shares to authenticated;
create policy owner_read on public.canvas_public_shares for select to authenticated
  using (user_id = (select auth.uid()));
create policy owner_revoke on public.canvas_public_shares for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.publish_canvas(p_scene_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare snapshot jsonb; share_token uuid;
begin
  if auth.uid() is null or not fontex_beta.allowed(auth.uid()) then
    raise exception 'Sign in with an authorized account';
  end if;
  select jsonb_build_object(
    'format', scene->'format', 'schemaVersion', scene->'schemaVersion',
    'id', scene->'id', 'title', scene->'title', 'level', scene->'level',
    'variables', scene->'variables', 'primitives', scene->'primitives',
    'updatedAt', scene->'updatedAt',
    'conversation', '[]'::jsonb)
  into snapshot from public.visual_scenes
  where user_id = auth.uid() and id = p_scene_id and scene->>'format' = 'primitive-scene';
  if snapshot is null then raise exception 'Save your canvas first'; end if;
  insert into public.canvas_public_shares(user_id, scene_id, scene)
  values(auth.uid(), p_scene_id, snapshot)
  on conflict(user_id, scene_id) do update set scene = excluded.scene, updated_at = now()
  returning token into share_token;
  return share_token;
end; $$;
revoke all on function public.publish_canvas(text) from public, anon, authenticated;
grant execute on function public.publish_canvas(text) to authenticated;

create function public.read_public_canvas(p_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select scene from public.canvas_public_shares where token = p_token;
$$;
revoke all on function public.read_public_canvas(uuid) from public, anon, authenticated;
grant execute on function public.read_public_canvas(uuid) to anon, authenticated;

create policy beta_members_only on public.canvas_public_shares as restrictive for all
to authenticated using ((select fontex_beta.allowed((select auth.uid()))))
with check ((select fontex_beta.allowed((select auth.uid()))));

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
  if path in ('rpc/get_release_contract','rpc/read_public_canvas') then return; end if;
  if current_setting('role',true)='authenticated' and path='rpc/get_beta_access_status' then return; end if;
  if not fontex_beta.allowed(auth.uid()) then
    raise exception 'beta_invitation_required' using errcode='42501';
  end if;
end $$;
notify pgrst, 'reload schema';
