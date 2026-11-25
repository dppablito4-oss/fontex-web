begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(id, email) values
  ('ad000000-0000-4000-8000-000000000001', 'university-pretest-owner@example.invalid');
update auth.users set email_confirmed_at = now() where id = 'ad000000-0000-4000-8000-000000000001';
insert into fontex_ai.admins(user_id) values ('ad000000-0000-4000-8000-000000000001');
select set_config('test.university_form', 'ad000000-0000-4000-8000-000000000002', true);
select set_config('test.university_browser', 'ad000000-0000-4000-8000-000000000003', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ad000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
select extensions.throws_ok($$select public.admin_get_university_pretest()$$, '42501', 'admin_mfa_required', 'template answer keys require MFA');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ad000000-0000-4000-8000-000000000001","aal":"aal2"}', true);
select set_config('test.university_questions', (public.admin_get_university_pretest()->'questions')::text, true);
select extensions.is(jsonb_array_length(current_setting('test.university_questions')::jsonb), 10, 'template has ten questions');
select extensions.throws_ok($$select public.admin_create_assessment(
  gen_random_uuid(), 'Inválida', 'pretest', '', current_setting('test.university_questions')::jsonb - 0, 0
)$$, '22023', 'assessment_invalid_form', 'scored publication requires ten questions');

select extensions.is(public.admin_create_assessment(
  current_setting('test.university_form')::uuid, 'Pretest universitario de prueba', 'pretest', '',
  current_setting('test.university_questions')::jsonb, 0
), current_setting('test.university_form')::uuid, 'admin publishes the template with its answer key');
select extensions.throws_ok($$select public.admin_delete_assessment_question(
  current_setting('test.university_form')::uuid, 1
)$$, '22023', 'assessment_fixed_grade', 'the published score always has the same denominator');
select set_config('test.university_token', public.admin_get_assessment(current_setting('test.university_form')::uuid)->>'token', true);

-- Eight correct, then two wrong. Use the saved option text, as the browser does.
select set_config('test.university_answers', (
  select jsonb_agg(case when n <= 8 then item->>'correct_option' else (
    select option from jsonb_array_elements_text(item->'options') o(option) where option <> item->>'correct_option' limit 1
  ) end order by n)
  from jsonb_array_elements(current_setting('test.university_questions')::jsonb) with ordinality q(item, n)
)::text, true);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select extensions.ok(not has_function_privilege('anon', 'public.admin_get_university_pretest()', 'execute'), 'anonymous students cannot call the template endpoint');
select extensions.ok(not has_table_privilege('anon', 'fontex_assessments.questions', 'select'), 'anonymous students cannot read the private question table');
select extensions.ok(not jsonb_path_exists(public.get_browser_assessment(
  current_setting('test.university_token')::uuid, current_setting('test.university_browser')::uuid
), '$.questions[*].correct_option'), 'the student payload has no answer keys');
select extensions.is(public.submit_browser_assessment(
  current_setting('test.university_token')::uuid, current_setting('test.university_browser')::uuid,
  'Estudiante de prueba', 1, current_setting('test.university_answers')::jsonb
), 'submitted', 'student submits the pretest');
select extensions.is((public.get_browser_assessment(
  current_setting('test.university_token')::uuid, current_setting('test.university_browser')::uuid
)->>'score')::integer, 8, 'receipt returns one point per correct answer');
select extensions.is(public.submit_browser_assessment(
  current_setting('test.university_token')::uuid, current_setting('test.university_browser')::uuid,
  'Otro nombre', 1, '[]'::jsonb
), 'submitted', 'one browser cannot replace an existing delivery or score');
select extensions.is(public.get_browser_assessment(
  current_setting('test.university_token')::uuid, gen_random_uuid()
)->>'state', 'open', 'the same link can be opened by a different browser');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ad000000-0000-4000-8000-000000000001","aal":"aal2"}', true);
select extensions.is((public.admin_get_assessment(current_setting('test.university_form')::uuid)#>>'{codes,0,score}')::integer, 8,
  'the owner receives the same score for the export and result sheet');
select extensions.is(public.admin_get_assessment(current_setting('test.university_form')::uuid)#>>'{codes,0,student_name}',
  'Estudiante de prueba', 'a retry leaves the original submission intact');

reset role;
select * from extensions.finish();
rollback;
