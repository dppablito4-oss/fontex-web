begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(id, email) values
  ('ae000000-0000-4000-8000-000000000001', 'tics-pretest-owner@example.invalid');
update auth.users set email_confirmed_at = now() where id = 'ae000000-0000-4000-8000-000000000001';
insert into fontex_ai.admins(user_id) values ('ae000000-0000-4000-8000-000000000001');
select set_config('test.tics_form', 'ae000000-0000-4000-8000-000000000002', true);
select set_config('test.tics_browser', 'ae000000-0000-4000-8000-000000000003', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ae000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
select extensions.throws_ok($$select public.admin_get_tics_pretest()$$, '42501', 'admin_mfa_required', 'template answer keys require MFA');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ae000000-0000-4000-8000-000000000001","aal":"aal2"}', true);
select set_config('test.tics_questions', (public.admin_get_tics_pretest()->'questions')::text, true);
select extensions.is(public.admin_get_tics_pretest()->>'title', 'Pretest TICs 1', 'the requested title is loaded from admin');
select extensions.is(public.admin_get_university_pretest()->>'title', 'Pretest universitario de Fontex', 'the technical template remains available');

select extensions.is(jsonb_array_length(current_setting('test.tics_questions')::jsonb), 10, 'template has ten questions');
select extensions.ok(not exists (
  select 1 from jsonb_array_elements(current_setting('test.tics_questions')::jsonb) q(item)
  where char_length(item->>'prompt') not between 1 and 400
     or jsonb_array_length(item->'options') <> 4
     or not (item->'options' @> jsonb_build_array(item->>'correct_option'))
     or exists (select 1 from jsonb_array_elements_text(item->'options') o(value) where char_length(value) not between 1 and 180)
), 'all cases and answer keys fit the published assessment contract');
select extensions.ok(not exists (
  select 1 from jsonb_array_elements(current_setting('test.tics_questions')::jsonb) q(item)
  where item->>'prompt' ~* '(JSON|endpoint|esquema|primitiva|sintáctico)'
), 'cases do not require implementation vocabulary');
reset role;
select extensions.is((select count(*)::integer from fontex_assessments.forms where created_by='ae000000-0000-4000-8000-000000000001'), 0, 'loading a template does not publish it');
set local role authenticated;

select extensions.throws_ok($$select public.admin_create_assessment(
  gen_random_uuid(), 'Inválida', 'pretest', '', current_setting('test.tics_questions')::jsonb - 0, 0
)$$, '22023', 'assessment_invalid_form', 'scored publication requires ten questions');

select extensions.is(public.admin_create_assessment(
  current_setting('test.tics_form')::uuid, 'Pretest TICs 1', 'pretest', '',
  current_setting('test.tics_questions')::jsonb, 0
), current_setting('test.tics_form')::uuid, 'admin publishes the template with its answer key');
select extensions.throws_ok($$select public.admin_delete_assessment_question(
  current_setting('test.tics_form')::uuid, 1
)$$, '22023', 'assessment_fixed_grade', 'the published score always has the same denominator');
select set_config('test.tics_token', public.admin_get_assessment(current_setting('test.tics_form')::uuid)->>'token', true);

-- Eight correct, then two wrong. Use the saved option text, as the browser does.
select set_config('test.tics_answers', (
  select jsonb_agg(case when n <= 8 then item->>'correct_option' else (
    select option from jsonb_array_elements_text(item->'options') o(option) where option <> item->>'correct_option' limit 1
  ) end order by n)
  from jsonb_array_elements(current_setting('test.tics_questions')::jsonb) with ordinality q(item, n)
)::text, true);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select extensions.ok(not has_function_privilege('anon', 'public.admin_get_tics_pretest()', 'execute'), 'anonymous students cannot call the template endpoint');
select extensions.ok(not has_function_privilege('anon', 'fontex_assessments.tics_pretest_template()', 'execute'), 'the private template also denies anonymous calls');
select extensions.is(public.get_browser_assessment(current_setting('test.tics_token')::uuid, current_setting('test.tics_browser')::uuid)->>'title', 'Pretest TICs 1', 'the published student page uses the requested title');
select extensions.ok(not has_table_privilege('anon', 'fontex_assessments.questions', 'select'), 'anonymous students cannot read the private question table');
select extensions.ok(not jsonb_path_exists(public.get_browser_assessment(
  current_setting('test.tics_token')::uuid, current_setting('test.tics_browser')::uuid
), '$.questions[*].correct_option'), 'the student payload has no answer keys');
select extensions.is(public.submit_browser_assessment(
  current_setting('test.tics_token')::uuid, current_setting('test.tics_browser')::uuid,
  'Estudiante de prueba', 1, current_setting('test.tics_answers')::jsonb
), 'submitted', 'student submits the pretest');
select extensions.is((public.get_browser_assessment(
  current_setting('test.tics_token')::uuid, current_setting('test.tics_browser')::uuid
)->>'score')::integer, 8, 'receipt returns one point per correct answer');
select extensions.is(public.submit_browser_assessment(
  current_setting('test.tics_token')::uuid, current_setting('test.tics_browser')::uuid,
  'Otro nombre', 1, '[]'::jsonb
), 'submitted', 'one browser cannot replace an existing delivery or score');
select extensions.is(public.get_browser_assessment(
  current_setting('test.tics_token')::uuid, gen_random_uuid()
)->>'state', 'open', 'the same link can be opened by a different browser');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ae000000-0000-4000-8000-000000000001","aal":"aal2"}', true);
select extensions.is((public.admin_get_assessment(current_setting('test.tics_form')::uuid)#>>'{codes,0,score}')::integer, 8,
  'the owner receives the same score for the export and result sheet');
select extensions.is(public.admin_get_assessment(current_setting('test.tics_form')::uuid)#>>'{codes,0,student_name}',
  'Estudiante de prueba', 'a retry leaves the original submission intact');

reset role;
insert into auth.users(id,email,email_confirmed_at) values('ae000000-0000-4000-8000-000000000004','tics-participant@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ae000000-0000-4000-8000-000000000004","aal":"aal2"}', true);
select extensions.throws_ok($$select public.admin_get_tics_pretest()$$, '42501', null, 'non-admin accounts cannot retrieve answer keys');
reset role;
select * from extensions.finish();
rollback;
