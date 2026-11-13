create table public.visual_scenes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 140),
  scene jsonb not null check (jsonb_typeof(scene)='object' and scene ? 'id' and jsonb_typeof(scene->'id')='string' and octet_length(scene::text)<=1048576 and scene->>'id'=id),
  revision bigint not null default 1 check (revision>0),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);
alter table public.visual_scenes enable row level security;
revoke all on public.visual_scenes from public,anon,authenticated;
grant select on public.visual_scenes to authenticated;
grant insert(user_id,id,scene,revision) on public.visual_scenes to authenticated;
grant update(scene,revision) on public.visual_scenes to authenticated;
create policy visual_scene_read on public.visual_scenes for select to authenticated using(user_id=(select auth.uid()));
create policy visual_scene_create on public.visual_scenes for insert to authenticated with check(user_id=(select auth.uid()) and revision=1);
create policy visual_scene_update on public.visual_scenes for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.advance_visual_scene_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.user_id is distinct from old.user_id or new.id is distinct from old.id or new.revision<>old.revision+1 then raise exception 'Invalid scene revision' using errcode='23514'; end if;
 new.updated_at:=now(); return new;
end; $$;
revoke all on function public.advance_visual_scene_revision() from public,anon,authenticated;
create trigger visual_scene_revision before update on public.visual_scenes for each row execute function public.advance_visual_scene_revision();
-- Copy the previous account materials and conversations; keep originals for rollback.
insert into public.visual_scenes(user_id,id,scene,revision)
select w.user_id, 'import-'||(d->>'id'),
 jsonb_build_object('version',1,'id','import-'||(d->>'id'),'updatedAt',coalesce(d->>'updatedAt',now()::text),'title',coalesce(d->>'title','Material importado'),'parameters',jsonb_build_object('a',1,'b',0,'c',-1),'expressions','[]'::jsonb,'conversation',coalesce(w.state->'conversations'->(d->>'id'),'[]'::jsonb),'elements',coalesce((select jsonb_agg(jsonb_build_object('id','e-'||(n-1),'kind','legacy','object',o) order by n) from jsonb_array_elements(case when jsonb_typeof(d->'objects')='array' then d->'objects' else '[]'::jsonb end) with ordinality as objects(o,n)),'[]'::jsonb)),1
from public.studio_workspaces w cross join lateral jsonb_array_elements(w.state->'documents') as documents(d)
where length(d->>'id') between 1 and 100 and jsonb_typeof(d->'objects')='array'
on conflict(user_id,id) do nothing;
