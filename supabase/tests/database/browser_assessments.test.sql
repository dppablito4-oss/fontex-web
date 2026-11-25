begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(id, email) values
  ('ac552580-0000-4000-8000-000000000001', 'browser-assessment-owner@example.invalid'),
  ('ac552580-0000-4000-8000-000000000002', 'browser-assessment-other@example.invalid');
update auth.users set email_confirmed_at = now() where id::text like 'ac552580-%';
insert into fontex_ai.admins(user_id) values
  ('ac552580-0000-4000-8000-000000000001'), ('ac552580-0000-4000-8000-000000000002');

select set_config('test.browser_form', 'ac552580-0000-4000-8000-000000000010', true);
select set_config('test.browser_first', 'ac552580-0000-4000-8000-000000000011', true);
select set_config('test.browser_second', 'ac552580-0000-4000-8000-000000000012', true);
select set_config('test.browser_third', 'ac552580-0000-4000-8000-000000000013', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ac552580-0000-4000-8000-000000000001","aal":"aal2"}', true);
select extensions.is(public.admin_create_assessment(current_setting('test.browser_form')::uuid, 'Encuesta de navegador', 'survey', '',
  '[{"kind":"choice","prompt":"Elige un número","options":["2","3"]},{"kind":"multiple","prompt":"Elige colores","options":["Rojo","Azul","Verde"]},{"kind":"text","prompt":"¿Por qué?","options":[]}]', 0),
  current_setting('test.browser_form')::uuid, 'publishes all three formats without allocating codes');
select set_config('test.browser_token', public.admin_get_assessment(current_setting('test.browser_form')::uuid)->>'token', true);
select extensions.ok(public.admin_get_assessment(current_setting('test.browser_form')::uuid)->'codes' is null
  or public.admin_get_assessment(current_setting('test.browser_form')::uuid)->'codes' = '[]'::jsonb, 'no individual codes are allocated');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.path', '/rpc/get_browser_assessment', true);
select extensions.lives_ok($$select public.check_beta_request()$$, 'anonymous QR reader can open the new endpoint');
select set_config('request.path', '/rpc/submit_browser_assessment', true);
select extensions.lives_ok($$select public.check_beta_request()$$, 'anonymous QR reader can submit through the new endpoint');
select extensions.ok(not has_function_privilege('anon','public.admin_delete_assessment(uuid)','execute'), 'anonymous browser cannot delete evaluations');
select extensions.is(public.get_browser_assessment(current_setting('test.browser_token')::uuid,current_setting('test.browser_first')::uuid)->>'state',
  'open', 'first visit shows the form');
select extensions.is(public.get_browser_assessment(gen_random_uuid(),current_setting('test.browser_first')::uuid)->>'state',
  'closed', 'missing link has the closed state');
select extensions.throws_ok($$select public.submit_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_first')::uuid, 'Nombre uno', 1, '["2",["Rojo","Rojo"],"Texto"]')$$,
  '22023', 'assessment_invalid_answers', 'repeated choices are rejected');
select extensions.throws_ok($$select public.submit_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_first')::uuid, 'Nombre uno', 1, '["2",["Fuera"],"Texto"]')$$,
  '22023', 'assessment_invalid_answers', 'unknown choices are rejected');
select extensions.is(public.submit_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_first')::uuid, 'Nombre uno', 1, '["2",["Verde","Rojo"],"Texto"]'),
  'submitted', 'valid multiple selection is accepted after previous invalid attempts');
select extensions.is(public.submit_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_first')::uuid, 'Otro nombre', 1, '["3",["Azul"],"Cambiado"]'),
  'submitted', 'another submission from the same browser gets the receipt');
select extensions.is(public.get_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_first')::uuid)->>'state', 'submitted', 'reload shows receipt');
select extensions.ok(not (public.get_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_first')::uuid) ? 'questions'), 'receipt does not repeat the questions');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ac552580-0000-4000-8000-000000000002","aal":"aal2"}', true);
select extensions.throws_ok($$select public.admin_delete_assessment_question(current_setting('test.browser_form')::uuid, 1)$$,
  '42501', 'assessment_unavailable', 'another administrator cannot remove a question');
select public.admin_delete_assessment(current_setting('test.browser_form')::uuid);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ac552580-0000-4000-8000-000000000001","aal":"aal2"}', true);
select extensions.is(jsonb_array_length(public.admin_get_assessment(current_setting('test.browser_form')::uuid)->'codes'),
  1, 'duplicate did not add a record and another administrator did not delete it');
select set_config('test.browser_receipt', public.admin_get_assessment(current_setting('test.browser_form')::uuid)#>>'{codes,0,code}', true);
select extensions.is(public.admin_assessment_answers(current_setting('test.browser_form')::uuid,
  array[current_setting('test.browser_receipt')])#>'{0,answers}', jsonb_build_array('2',E'Rojo\nVerde','Texto'),
  'export answers preserve option order and the original submission');
select public.admin_delete_assessment_question(current_setting('test.browser_form')::uuid, 1);
select extensions.is(public.admin_assessment_answers(current_setting('test.browser_form')::uuid,
  array[current_setting('test.browser_receipt')])#>'{0,answers}', jsonb_build_array(E'Rojo\nVerde','Texto'),
  'deleting a question removes only its answers and preserves the remaining order');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select extensions.is(public.submit_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_second')::uuid, 'Nombre dos', 1, '["2",["Azul"],"V1"]'), 'changed',
  'in-flight forms must reload after their questions change');
select extensions.is((public.get_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_second')::uuid)->>'question_version')::int, 2, 'updated form includes the new version');
select extensions.is(public.submit_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_second')::uuid, 'Nombre dos', 2, '[["Azul"],"V2"]'), 'submitted',
  'another browser can submit the remaining questions');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ac552580-0000-4000-8000-000000000001","aal":"aal2"}', true);
select public.admin_delete_assessment_question(current_setting('test.browser_form')::uuid, 2);
select extensions.throws_ok($$select public.admin_delete_assessment_question(current_setting('test.browser_form')::uuid, 3)$$,
  '22023', 'assessment_last_question', 'a published form retains at least one question');
select public.admin_set_assessment_open(current_setting('test.browser_form')::uuid, false);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select extensions.is(public.get_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_third')::uuid)->>'state', 'closed', 'new visitors see the closed state');
select extensions.is(public.get_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_first')::uuid)->>'state', 'submitted', 'previous submission still receives thanks after closure');
select extensions.is(public.submit_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_third')::uuid, 'Nombre tres', 3, '["Texto"]'), 'closed', 'closed evaluation rejects new submissions');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ac552580-0000-4000-8000-000000000001","aal":"aal2"}', true);
select public.admin_delete_assessment(current_setting('test.browser_form')::uuid);
select extensions.ok(public.admin_get_assessment(current_setting('test.browser_form')::uuid) is null, 'owner can delete the evaluation');
reset role;
select extensions.is((select count(*)::integer from fontex_assessments.submissions where form_id = current_setting('test.browser_form')::uuid), 0,
  'deleting an assessment removes its submissions');
select extensions.is(public.get_browser_assessment(current_setting('test.browser_token')::uuid,
  current_setting('test.browser_first')::uuid)->>'state', 'closed', 'deleted assessment link is now closed');
select * from extensions.finish();
rollback;
