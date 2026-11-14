begin;
-- Existing test rows are left untouched: the connector's destructive confirmation expired.
-- NOT VALID protects all new inserts/updates while retiring existing v1 records logically.
alter table public.visual_scenes add constraint primitive_scene_shape check (
 id <> 'canvas-workspace-v1' and id not like 'import-%' and octet_length(scene::text)<=1048576
 and scene ?& array['schemaVersion','format','title','level','updatedAt','variables','primitives','conversation']
 and scene->'schemaVersion'='2'::jsonb and jsonb_typeof(scene->'format')='string' and scene->>'format'='primitive-scene'
 and jsonb_typeof(scene->'title')='string' and length(scene->>'title')<=160
 and jsonb_typeof(scene->'level')='string' and scene->>'level' in ('inicial','primaria','secundaria','universidad')
 and jsonb_typeof(scene->'updatedAt')='string'
 and case when jsonb_typeof(scene->'variables')='array' then jsonb_array_length(scene->'variables')<=24 else false end
 and case when jsonb_typeof(scene->'primitives')='array' then jsonb_array_length(scene->'primitives')<=80 else false end
 and case when jsonb_typeof(scene->'conversation')='array' then jsonb_array_length(scene->'conversation')<=80 else false end
) not valid;
comment on table public.visual_scenes is 'Private primitive scenes v2. New writes require the primitive contract; existing retired test rows remain until an explicitly confirmed cleanup. Owner RLS and revision compare-and-set remain active.';
commit;
