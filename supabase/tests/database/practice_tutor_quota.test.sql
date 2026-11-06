begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(7);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.practice_tutor_quota'::regclass),
  'The practice quota table has RLS enabled'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.take_practice_tutor_quota(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.take_practice_tutor_quota(uuid)', 'execute'),
  'Browser roles cannot spend another user quota'
);
select extensions.ok(
  has_function_privilege('service_role', 'public.take_practice_tutor_quota(uuid)', 'execute'),
  'The Edge Function role can reserve a request'
);

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000501', 'authenticated', 'authenticated',
    'practice-a@fontex.test', '{"display_name":"Estudiante A"}', now(), now()),
  ('00000000-0000-4000-8000-000000000502', 'authenticated', 'authenticated',
    'practice-b@fontex.test', '{"display_name":"Estudiante B"}', now(), now());

set local role service_role;

select extensions.is(
  (select count(*)::integer from generate_series(1, 11)
   where public.take_practice_tutor_quota('00000000-0000-4000-8000-000000000501')),
  10, 'An account can reserve only ten calls per hour'
);
select extensions.ok(
  public.take_practice_tutor_quota('00000000-0000-4000-8000-000000000502'),
  'The hourly limit is independent per account'
);

update public.practice_tutor_quota set
  hour_start = hour_start - interval '1 hour',
  daily_requests = 25
where user_id = '00000000-0000-4000-8000-000000000501';

select extensions.ok(
  not public.take_practice_tutor_quota('00000000-0000-4000-8000-000000000501'),
  'A new hour does not reset the daily cap'
);

update public.practice_tutor_quota set day_start = day_start - interval '1 day'
where user_id = '00000000-0000-4000-8000-000000000501';

select extensions.ok(
  public.take_practice_tutor_quota('00000000-0000-4000-8000-000000000501'),
  'A new day allows requests again'
);

reset role;
select * from extensions.finish();
rollback;
