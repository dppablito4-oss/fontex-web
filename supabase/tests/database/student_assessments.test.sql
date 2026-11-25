begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(id, email) values
  ('ac000000-0000-4000-8000-000000000001', 'assessment-owner@example.invalid'),
  ('ac000000-0000-4000-8000-000000000002', 'assessment-admin@example.invalid'),
  ('ac000000-0000-4000-8000-000000000003', 'assessment-user@example.invalid');
update auth.users set email_confirmed_at = now() where id::text like 'ac000000-%';
insert into fontex_ai.admins(user_id) values
  ('ac000000-0000-4000-8000-000000000001'), ('ac000000-0000-4000-8000-000000000002');

select set_config('test.assessment_form', 'ac000000-0000-4000-8000-000000000010', true);
select set_config('test.assessment_questions',
  '[{"prompt":"¿Cuánto es 2 + 2?","kind":"choice","options":["3","4"]},{"prompt":"Explica tu cálculo.","kind":"text","options":[]}]', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ac000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
select extensions.throws_ok($$select public.admin_list_assessments(0)$$, '42501', 'admin_mfa_required', 'administration requires MFA');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ac000000-0000-4000-8000-000000000003","aal":"aal2"}', true);
select extensions.throws_ok($$select public.admin_list_assessments(0)$$, '42501', null, 'a participant with MFA cannot list assessments');
select extensions.throws_ok($$select public.admin_create_assessment(current_setting('test.assessment_form')::uuid,
  'Pretest de prueba', 'pretest', '', current_setting('test.assessment_questions')::jsonb, 2)$$,
  '42501', null, 'a participant cannot publish an assessment');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ac000000-0000-4000-8000-000000000001","aal":"aal2"}', true);
select extensions.is(public.admin_create_assessment(current_setting('test.assessment_form')::uuid,
  'Pretest de prueba', 'pretest', 'Lee las preguntas.', current_setting('test.assessment_questions')::jsonb, 2),
  current_setting('test.assessment_form')::uuid, 'administrator publishes one assessment');
select extensions.is(public.admin_create_assessment(current_setting('test.assessment_form')::uuid,
  'Pretest de prueba', 'pretest', 'Lee las preguntas.', current_setting('test.assessment_questions')::jsonb, 2),
  current_setting('test.assessment_form')::uuid, 'author can retry publication without creating duplicates');
select extensions.throws_ok($$select public.admin_create_assessment(gen_random_uuid(), 'Inválida', 'survey', '',
  '[{"prompt":"Duplicada","kind":"choice","options":["uno","uno"]}]', 1)$$,
  '22023', 'assessment_invalid_question', 'bad questions roll back publication');
select extensions.is(jsonb_array_length(public.admin_list_assessments(0)), 1, 'failed and retried requests do not add forms');
select extensions.is(jsonb_array_length(public.admin_get_assessment(current_setting('test.assessment_form')::uuid)->'codes'), 2,
  'each form has its own individual codes');
select set_config('test.assessment_token', public.admin_get_assessment(current_setting('test.assessment_form')::uuid)->>'token', true);
select set_config('test.assessment_code', public.admin_get_assessment(current_setting('test.assessment_form')::uuid)#>>'{codes,0,code}', true);
select set_config('test.assessment_other_code', public.admin_get_assessment(current_setting('test.assessment_form')::uuid)#>>'{codes,1,code}', true);

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ac000000-0000-4000-8000-000000000002","aal":"aal2"}', true);
select extensions.is(jsonb_array_length(public.admin_list_assessments(0)), 0, 'a second administrator does not list another owner’s forms');
select extensions.ok(public.admin_get_assessment(current_setting('test.assessment_form')::uuid) is null, 'another administrator cannot read the codes or names');
select extensions.throws_ok($$select public.admin_assessment_answers(current_setting('test.assessment_form')::uuid,
  array[current_setting('test.assessment_code')])$$, '42501', null, 'another administrator cannot read answers');
select extensions.throws_ok($$select public.admin_set_assessment_open(current_setting('test.assessment_form')::uuid, false)$$,
  '42501', null, 'another administrator cannot close an assessment');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.path', '/rpc/get_public_assessment', true);
select extensions.lives_ok($$select public.check_beta_request()$$, 'an anonymous QR reader can reach the public form');
select set_config('request.path', '/rpc/submit_public_assessment', true);
select extensions.lives_ok($$select public.check_beta_request()$$, 'an anonymous student can reach the submission endpoint');
select set_config('request.path', '/rpc/admin_get_assessment', true);
select extensions.throws_ok($$select public.check_beta_request()$$, '42501', 'beta_invitation_required', 'private endpoints keep the beta guard');

select extensions.is(jsonb_array_length(public.get_public_assessment(current_setting('test.assessment_token')::uuid)->'questions'), 2, 'shared form exposes its questions');
select extensions.ok(not (public.get_public_assessment(current_setting('test.assessment_token')::uuid) ?| array['codes','id','student_name']), 'shared form does not expose the roster');
select extensions.ok(public.get_public_assessment(gen_random_uuid()) is null, 'unknown token reveals no form');
select extensions.ok(not has_table_privilege('anon','fontex_assessments.answers','select'), 'anonymous clients cannot read answer rows');
select extensions.ok(not has_function_privilege('anon','public.admin_get_assessment(uuid)','execute'), 'anonymous clients cannot run admin RPCs');
select extensions.throws_ok($$select public.submit_public_assessment(current_setting('test.assessment_token')::uuid, '000000000000',
  'Estudiante de prueba', gen_random_uuid(), '["4","Sumé dos y dos."]')$$, '22023', 'assessment_invalid_code', 'valid links still require a valid individual code');
select extensions.throws_ok($$select public.submit_public_assessment(current_setting('test.assessment_token')::uuid,
  current_setting('test.assessment_code'), 'Estudiante de prueba', gen_random_uuid(), '["5","Sumé dos y dos."]')$$,
  '22023', 'assessment_invalid_answers', 'invalid choice is rejected without using up the code');
select extensions.throws_ok($$select public.submit_public_assessment(current_setting('test.assessment_token')::uuid,
  current_setting('test.assessment_code'), 'Estudiante de prueba', gen_random_uuid(), '["4","\t\n"]')$$,
  '22023', 'assessment_invalid_answers', 'blank answers are rejected without using up the code');
select extensions.ok(public.submit_public_assessment(current_setting('test.assessment_token')::uuid,
  lower(current_setting('test.assessment_code')), 'Estudiante de prueba', 'ac000000-0000-4000-8000-000000000011', '["4","Sumé dos y dos."]'),
  'valid submission stores all answers');
select extensions.ok(public.submit_public_assessment(current_setting('test.assessment_token')::uuid,
  current_setting('test.assessment_code'), 'Estudiante de prueba', 'ac000000-0000-4000-8000-000000000011', '["4","Sumé dos y dos."]'),
  'same operation can safely retry');
select extensions.throws_ok($$select public.submit_public_assessment(current_setting('test.assessment_token')::uuid,
  current_setting('test.assessment_code'), 'Otro estudiante', gen_random_uuid(), '["3","Respuesta modificada"]')$$,
  '22023', 'assessment_code_used', 'a used code cannot replace the recorded submission');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ac000000-0000-4000-8000-000000000001","aal":"aal2"}', true);
select extensions.is(
  public.admin_assessment_answers(current_setting('test.assessment_form')::uuid, array[current_setting('test.assessment_code')])#>'{0,answers}',
  '["4","Sumé dos y dos."]'::jsonb, 'owner can read each answer in question order');
select extensions.is(public.admin_get_assessment(current_setting('test.assessment_form')::uuid)#>>'{codes,0,student_name}',
  'Estudiante de prueba', 'submission is linked to the student and their code');
select extensions.is(public.admin_set_assessment_open(current_setting('test.assessment_form')::uuid, false), false, 'owner can close submissions');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select extensions.is(jsonb_array_length(public.get_public_assessment(current_setting('test.assessment_token')::uuid)->'questions'), 0, 'closed forms no longer show questions');
select extensions.throws_ok($$select public.submit_public_assessment(current_setting('test.assessment_token')::uuid,
  current_setting('test.assessment_other_code'), 'Otra estudiante', gen_random_uuid(), '["4","Sumé dos y dos."]')$$,
  '22023', 'assessment_closed', 'closed forms reject new entries');
select extensions.ok(public.submit_public_assessment(current_setting('test.assessment_token')::uuid,
  current_setting('test.assessment_code'), 'Estudiante de prueba', 'ac000000-0000-4000-8000-000000000011', '["4","Sumé dos y dos."]'),
  'closure preserves receipts for previously accepted retries');

reset role;
select extensions.is((select count(*)::integer from fontex_assessments.answers), 2, 'the database has one row per answered question');
select * from extensions.finish();
rollback;
