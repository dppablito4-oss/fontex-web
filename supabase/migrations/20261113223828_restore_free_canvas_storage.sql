begin;

-- Reuse the current private scene table for newly created free-canvas materials.
-- Retired studio_workspaces remains empty and inaccessible; no content is copied.
alter table public.visual_scenes drop constraint visual_scenes_check;
alter table public.visual_scenes add constraint visual_scenes_check check (
  jsonb_typeof(scene) = 'object'
  and scene ? 'id'
  and jsonb_typeof(scene->'id') = 'string'
  and scene->>'id' = id
  and octet_length(scene::text) <= case when id = 'canvas-workspace-v1' then 2097152 else 1048576 end
);
alter table public.visual_scenes add constraint canvas_workspace_shape check (
  (id <> 'canvas-workspace-v1' and scene->>'format' is distinct from 'canvas-workspace')
  or (
    id = 'canvas-workspace-v1'
    and scene ?& array['format','version','state']
    and scene->>'format' = 'canvas-workspace'
    and scene->'version' = '1'::jsonb
    and jsonb_typeof(scene->'state') = 'object'
    and (scene->'state') ?& array['activeId','documents','conversations']
    and jsonb_typeof(scene->'state'->'activeId') in ('string','null')
    and jsonb_typeof(scene->'state'->'conversations') = 'object'
    and case when jsonb_typeof(scene->'state'->'documents') = 'array'
      then jsonb_array_length(scene->'state'->'documents') <= 100 else false end
  )
);

comment on table public.visual_scenes is 'Private expression scenes and new free-canvas workspaces; owner RLS, isolated formats, and revision compare-and-set protect edits.';

commit;
