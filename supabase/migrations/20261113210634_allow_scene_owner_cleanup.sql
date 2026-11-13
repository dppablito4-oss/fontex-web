-- Owners can remove their own exported or temporary scenes; other accounts remain isolated.
grant delete on public.visual_scenes to authenticated;
create policy visual_scene_delete on public.visual_scenes for delete to authenticated using(user_id=(select auth.uid()));
