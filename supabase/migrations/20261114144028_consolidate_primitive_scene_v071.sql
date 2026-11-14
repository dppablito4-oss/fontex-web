-- Retire only pre-v2 canvas rows. New primitive scenes, Auth and academic data are preserved.
begin;
set local lock_timeout = '5s';
create schema if not exists fontex_archive;
revoke all on schema fontex_archive from public, anon, authenticated;
create table if not exists fontex_archive.visual_scenes_pre_v071
  (like public.visual_scenes including defaults);
alter table fontex_archive.visual_scenes_pre_v071 enable row level security;
revoke all on table fontex_archive.visual_scenes_pre_v071 from public, anon, authenticated;

-- Keep a private recovery copy before removing retired scenes from the active table.
insert into fontex_archive.visual_scenes_pre_v071
select * from public.visual_scenes
where scene->>'format' is distinct from 'primitive-scene'
   or scene->'schemaVersion' is distinct from '2'::jsonb;
delete from public.visual_scenes
where scene->>'format' is distinct from 'primitive-scene'
   or scene->'schemaVersion' is distinct from '2'::jsonb;

alter table public.visual_scenes validate constraint primitive_scene_shape;
comment on constraint primitive_scene_shape on public.visual_scenes is
  'Fontex primitive-scene v2: validated on all rows; legacy scenes archived privately in v0.7.1.';
commit;
