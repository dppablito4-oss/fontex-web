begin;

-- The old workspace and its automatic imports were disposable test content.
-- Retain the historical table for migration history, but stop old clients restoring it.
revoke all on public.studio_workspaces from public, anon, authenticated;
delete from public.studio_workspaces;

delete from public.visual_scenes
where id like 'import-%'
   or jsonb_path_exists(scene, '$.elements[*] ? (@.kind == "legacy")');

-- New scenes are native expression/text documents. No legacy modules or imports.
alter table public.visual_scenes add constraint visual_scene_native check (
  id not like 'import-%'
  and not jsonb_path_exists(scene, '$.elements[*] ? (@.kind == "legacy")')
);

comment on table public.studio_workspaces is 'Retired test materials. Client access revoked; the general canvas uses visual_scenes.';
comment on table public.visual_scenes is 'Private native expression scenes; owner RLS and revision compare-and-set protect edits.';

commit;
