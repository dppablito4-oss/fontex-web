begin;
select '1..1';
insert into fontex_beta.invitations(email) values('duration-teacher@example.invalid');
insert into auth.users(id,email,created_at,email_confirmed_at) values('ce093000-0000-4000-8000-000000000001','duration-teacher@example.invalid',now(),now());
insert into public.organizations(id,name,created_by) values('ce093001-0000-4000-8000-000000000001','Duration test','ce093000-0000-4000-8000-000000000001');
insert into public.classrooms(id,organization_id,title,owner_id) values('ce093002-0000-4000-8000-000000000001','ce093001-0000-4000-8000-000000000001','Long generation','ce093000-0000-4000-8000-000000000001');
insert into private.classroom_join_links(id,classroom_id,token_hash,code_hash,created_by,expires_at) values('ce093003-0000-4000-8000-000000000001','ce093002-0000-4000-8000-000000000001',encode(extensions.digest(repeat('a',64),'sha256'),'hex'),encode(extensions.digest('duration-code','sha256'),'hex'),'ce093000-0000-4000-8000-000000000001',now()+interval '1 day');
insert into private.classroom_guests(id,link_id,token_hash,display_name,expires_at) values('ce093004-0000-4000-8000-000000000001','ce093003-0000-4000-8000-000000000001',encode(extensions.digest(repeat('b',64),'sha256'),'hex'),'Guest',now()+interval '8 hours');
set local role service_role;
select public.begin_canvas_build('ce093000-0000-4000-8000-000000000001','ce093005-0000-4000-8000-000000000001','{"schemaVersion":2,"format":"primitive-scene","id":"duration-scene"}','Test a complete exercise');
select public.reserve_canvas_ai_request('ce093000-0000-4000-8000-000000000001','ce093005-0000-4000-8000-000000000002','build',60000);
select public.guest_ai_build(repeat('b',64),'ce093005-0000-4000-8000-000000000003','begin','{"id":"duration-guest"}','Test a complete exercise');
reset role;
update fontex_ai.reservations set created_at=created_at-interval '130 seconds',expires_at=expires_at-interval '130 seconds' where id='ce093005-0000-4000-8000-000000000001';
update fontex_beta.requests set created_at=created_at-interval '130 seconds',expires_at=expires_at-interval '130 seconds' where id='ce093005-0000-4000-8000-000000000002';
update private.guest_ai_builds set created_at=created_at-interval '130 seconds' where id='ce093005-0000-4000-8000-000000000003';
do $$begin
 assert exists(select 1 from fontex_ai.reservations where id='ce093005-0000-4000-8000-000000000001' and expires_at>now()),'Credit survives a 130-second build';
 assert exists(select 1 from fontex_beta.requests where id='ce093005-0000-4000-8000-000000000002' and expires_at>now()),'Shared usage lease survives the client deadline';
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ce093000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare s jsonb;begin
 s:=public.get_ai_credit_status();assert (s->>'balance')::integer=4 and (s->>'active_generation')::boolean,'Polling cannot refund a long active build';
end$$;
set local role service_role;
do $$declare s jsonb;begin
 s:=public.get_guest_ai_status(repeat('b',64));assert (s->>'balance')::integer=4 and (s->>'active_generation')::boolean,'Guest polling keeps a long active build';
 s:=public.complete_canvas_build('ce093005-0000-4000-8000-000000000001','{"message":"Completed","actions":[{"kind":"load_template","templateId":"fractions"}]}');
 assert s->>'status'='succeeded','A late valid receipt settles successfully';
end$$;
reset role;
update private.guest_ai_builds set created_at=now()-interval '181 seconds' where id='ce093005-0000-4000-8000-000000000003';
set local role anon;
do $$declare s jsonb;begin
 s:=public.get_guest_ai_status(repeat('b',64));assert (s->>'balance')::integer=5 and not (s->>'active_generation')::boolean,'An abandoned guest build still refunds';
 s:=public.get_guest_ai_status(repeat('b',64));assert (s->>'balance')::integer=5,'Expiry refund remains idempotent';
end$$;
select 'ok 1 - long builds keep their leases and abandoned builds still refund';
rollback;
