SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_release_contract()
  RETURNS text
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select case when
    exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.canvas_public_shares')
        and relrowsecurity
    )
    and pg_catalog.to_regprocedure('public.publish_canvas(text)') is not null
    and pg_catalog.to_regprocedure('public.read_public_canvas(uuid)') is not null
    and pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.publish_canvas(text)'), 'EXECUTE')
    and not pg_catalog.has_function_privilege('anon', pg_catalog.to_regprocedure('public.publish_canvas(text)'), 'EXECUTE')
    and pg_catalog.has_function_privilege('anon', pg_catalog.to_regprocedure('public.read_public_canvas(uuid)'), 'EXECUTE')
    and pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.read_public_canvas(uuid)'), 'EXECUTE')
    and not pg_catalog.has_table_privilege('anon', pg_catalog.to_regclass('public.canvas_public_shares'), 'SELECT')
    then 'closed-beta-v3'::text else null::text end;
$function$;
