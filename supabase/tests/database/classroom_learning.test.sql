begin;
-- A single TAP assertion covers the transaction; every ASSERT below must pass.
select '1..1';
insert into fontex_beta.invitations(email) values('learning-teacher@example.invalid'),('learning-student@example.invalid'),('learning-outsider@example.invalid');
insert into auth.users(id,email) values
('c0920000-0000-4000-8000-000000000001','learning-teacher@example.invalid'),
('c0920000-0000-4000-8000-000000000002','learning-student@example.invalid'),
('c0920000-0000-4000-8000-000000000003','learning-outsider@example.invalid');
update auth.users set email_confirmed_at=now(),created_at=now() where id::text like 'c0920000%';
insert into public.organizations(id,name,created_by) values('c0920001-0000-4000-8000-000000000001','Prueba de aprendizaje','c0920000-0000-4000-8000-000000000001');
insert into public.classrooms(id,organization_id,title,owner_id) values('c0920002-0000-4000-8000-000000000001','c0920001-0000-4000-8000-000000000001','Clase modelo','c0920000-0000-4000-8000-000000000001');
insert into public.class_members(classroom_id,user_id,role) values('c0920002-0000-4000-8000-000000000001','c0920000-0000-4000-8000-000000000002','student');
insert into public.visual_scenes(user_id,id,scene) values('c0920000-0000-4000-8000-000000000001','learning-test','{"id":"learning-test","schemaVersion":2,"format":"primitive-scene","title":"Fracciones","level":"primaria","updatedAt":"2026-11-16T00:00:00Z","variables":[],"primitives":[],"conversation":[{"role":"user","content":"Conversación privada"}]}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c0920000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('test.learning_invite',public.create_classroom_join_link('c0920002-0000-4000-8000-000000000001')::text,true);
select set_config('test.learning_lesson',public.publish_class_lesson('c0920002-0000-4000-8000-000000000001','learning-test','Sumar fracciones','Fracciones','2026-11-16',1,'Responde en el lienzo',null,'[]')::text,true);
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('test.learning_guest',public.start_classroom_guest(current_setting('test.learning_invite')::jsonb->>'token','Invitado de prueba')::text,true);
do $$declare l jsonb;g text:=current_setting('test.learning_guest')::jsonb->>'token';begin
 assert not has_function_privilege('anon','public.class_smtp_password()','execute'),'SMTP secret is server-only';
 assert not has_function_privilege('authenticated','public.class_smtp_password()','execute'),'Accounts cannot read SMTP credentials';
 assert has_function_privilege('anon','public.save_class_attempt(uuid,text,uuid,jsonb,boolean)','execute')=false,'Guests cannot bypass submission validation';
 assert not has_function_privilege('authenticated','public.guest_ai_build(text,uuid,text,jsonb,text,jsonb)','execute'),'Clients cannot grant guest credits';
 assert jsonb_array_length(public.list_class_lessons('c0920002-0000-4000-8000-000000000001',g))=1;
 l:=public.get_class_lesson(current_setting('test.learning_lesson')::uuid,g);
 assert l->'scene'->'conversation'='[]'::jsonb,'Private conversation must be removed';
 assert (l->>'teacher')::boolean=false;
 assert (public.get_guest_ai_status(g)->>'balance')::integer=5;
 begin perform public.get_class_lesson(current_setting('test.learning_lesson')::uuid,'invalid');raise exception 'Invalid guest accepted';exception when insufficient_privilege then null;end;
end$$;
set local role service_role;
do $$declare g text:=current_setting('test.learning_guest')::jsonb->>'token';l uuid:=current_setting('test.learning_lesson')::uuid;r jsonb;b uuid:='c0920003-0000-4000-8000-000000000001';begin
 r:=public.guest_ai_usage(g,'c0920004-0000-4000-8000-000000000001','chat',100);assert (r->>'allowed')::boolean;
 perform public.guest_ai_usage(g,'c0920004-0000-4000-8000-000000000001',p_finish=>true);
 r:=public.guest_ai_build(g,b,'begin','{"id":"learning-test"}','Pregunta');assert (r->>'allowed')::boolean;
 assert (public.get_guest_ai_status(g)->>'balance')::integer=4;
 assert not (public.guest_ai_build(g,b,'begin','{"id":"learning-test"}','Pregunta')->>'allowed')::boolean;
 perform public.guest_ai_build(g,b,'fail');perform public.guest_ai_build(g,b,'fail');
 assert (public.get_guest_ai_status(g)->>'balance')::integer=5,'Refund is idempotent';
 perform public.save_class_attempt(l,g,null,'{"id":"learning-test","answer":"2/3"}',true);
 begin perform public.class_lesson_for_service(l,null,'c0920000-0000-4000-8000-000000000003');raise exception 'Outsider accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Account predates the guest, so it receives one explicit linking bonus.
update auth.users set created_at=now()-interval '1 day' where id='c0920000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c0920000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$declare l uuid:=current_setting('test.learning_lesson')::uuid;g text:=current_setting('test.learning_guest')::jsonb->>'token';before_balance integer;begin
 before_balance:=(public.get_ai_credit_status()->>'balance')::integer;
 perform public.complete_classroom_guest(g);
 assert (public.get_ai_credit_status()->>'balance')::integer=before_balance+10,'Transfer remaining 5 and one 5-credit bonus';
 perform public.complete_classroom_guest(g);
 assert (public.get_ai_credit_status()->>'balance')::integer=before_balance+10,'Linking must be idempotent';
 assert public.get_class_lesson(l)->'submission'->>'status'='submitted','Guest submission follows account';
 begin perform public.publish_class_lesson('c0920002-0000-4000-8000-000000000001','learning-test','Forged class','','2026-11-16',1,'',null,'[]');raise exception 'Student published';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Confirmation on a different browser transfers work without a second redemption.
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('test.learning_new_guest',public.start_classroom_guest(current_setting('test.learning_invite')::jsonb->>'token','Nueva cuenta')::text,true);
reset role;
insert into auth.users(id,email,created_at,raw_user_meta_data) values('c0920000-0000-4000-8000-000000000004','learning-new@example.invalid',now(),jsonb_build_object('classroom_guest_token',current_setting('test.learning_new_guest')::jsonb->>'token'));
do $$begin
 assert not exists(select 1 from private.guest_credit_promotions where user_id='c0920000-0000-4000-8000-000000000004'),'Unverified accounts receive no guest transfer';
end$$;
update auth.users set email_confirmed_at=now() where id='c0920000-0000-4000-8000-000000000004';
do $$begin
 assert (select balance from fontex_ai.wallets where user_id='c0920000-0000-4000-8000-000000000004')=10,'5 remaining guest credits plus 5 account credits';
 assert (select count(*) from private.guest_credit_promotions where user_id='c0920000-0000-4000-8000-000000000004')=1;
end$$;
update auth.users set email_confirmed_at=now() where id='c0920000-0000-4000-8000-000000000004';
do $$begin
 assert (select balance from fontex_ai.wallets where user_id='c0920000-0000-4000-8000-000000000004')=10,'Repeated confirmation cannot grant extra credits';
end$$;
-- A disabled or expired invitation immediately stops temporary learning access.
update private.classroom_join_links set revoked_at=now() where classroom_id='c0920002-0000-4000-8000-000000000001';
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$begin
 begin perform public.get_class_lesson(current_setting('test.learning_lesson')::uuid,current_setting('test.learning_guest')::jsonb->>'token');raise exception 'Revoked guest accepted';exception when insufficient_privilege then null;end;
end$$;
select 'ok 1 - classroom access, protected publication, guest credits and permanent submissions';
rollback;
