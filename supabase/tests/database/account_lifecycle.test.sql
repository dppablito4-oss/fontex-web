begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('accc0000-0000-4000-8000-000000000001','control-admin@example.invalid',now(),'{}'),
('accc0000-0000-4000-8000-000000000002','control-user@example.invalid',now(),'{}'),
('accc0000-0000-4000-8000-000000000003','control-peer@example.invalid',now(),'{}');
insert into fontex_ai.admins(user_id) values('accc0000-0000-4000-8000-000000000001');
insert into public.organizations(id,name,created_by) values
('accc3000-0000-4000-8000-000000000001','Aula de prueba','accc0000-0000-4000-8000-000000000001'),
('accc3000-0000-4000-8000-000000000002','Organización compartida','accc0000-0000-4000-8000-000000000003'),
('accc3000-0000-4000-8000-000000000003','Espacio personal','accc0000-0000-4000-8000-000000000002');
insert into public.classrooms(id,organization_id,title,owner_id) values('accc4000-0000-4000-8000-000000000001','accc3000-0000-4000-8000-000000000001','Clase preservada','accc0000-0000-4000-8000-000000000001'),
('accc4000-0000-4000-8000-000000000002','accc3000-0000-4000-8000-000000000002','Clase compartida','accc0000-0000-4000-8000-000000000003'),
('accc4000-0000-4000-8000-000000000003','accc3000-0000-4000-8000-000000000003','Clase personal','accc0000-0000-4000-8000-000000000002');
insert into public.class_members(classroom_id,user_id,role) values('accc4000-0000-4000-8000-000000000001','accc0000-0000-4000-8000-000000000002','teacher'),
('accc4000-0000-4000-8000-000000000002','accc0000-0000-4000-8000-000000000001','teacher'),
('accc4000-0000-4000-8000-000000000003','accc0000-0000-4000-8000-000000000002','teacher') on conflict (classroom_id,user_id) do nothing;
select set_config('request.jwt.claims','{"sub":"accc0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into public.documents(id,owner_id,classroom_id,title,original_filename,mime_type,size_bytes,page_count,content_sha256,storage_path) values('accc5000-0000-4000-8000-000000000001','accc0000-0000-4000-8000-000000000002','accc4000-0000-4000-8000-000000000003','PDF personal','personal.pdf','application/pdf',100,1,repeat('a',64),'accc0000-0000-4000-8000-000000000002/accc5000-0000-4000-8000-000000000001.pdf');
do $$ declare who uuid; begin
 foreach who in array array['accc0000-0000-4000-8000-000000000002'::uuid,'accc0000-0000-4000-8000-000000000003'::uuid] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
  insert into public.visual_scenes(user_id,id,scene) values(who,'personal',jsonb_build_object('id','personal','format','primitive-scene','schemaVersion',2,'title','Prueba','updatedAt','2026-11-24T00:00:00Z','level','secundaria','variables','[]'::jsonb,'primitives','[]'::jsonb,'conversation','[]'::jsonb));
 end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"accc0000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select extensions.throws_ok($$select public.admin_account_access('accc0000-0000-4000-8000-000000000003','ban',0,'Intento sin permisos',gen_random_uuid())$$,'42501',null,'ordinary accounts cannot manage other users');
select set_config('request.jwt.claims','{"sub":"accc0000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok($$select public.admin_account_access('accc0000-0000-4000-8000-000000000002','ban',0,'Sin segundo factor',gen_random_uuid())$$,'42501','admin_mfa_required','administration requires MFA');
select set_config('request.jwt.claims','{"sub":"accc0000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select extensions.throws_ok($$select public.admin_account_access('accc0000-0000-4000-8000-000000000001','ban',0,'Proteger administrador',gen_random_uuid())$$,'42501','protected_admin_account','administrator cannot lock itself out');
select public.admin_account_access('accc0000-0000-4000-8000-000000000002','suspend',24,'Prueba de suspensión','accc1000-0000-4000-8000-000000000001');
select extensions.is((public.get_beta_access_status()->>'allowed')::boolean,true,'administrator keeps access');
reset role;
select extensions.is(fontex_beta.allowed('accc0000-0000-4000-8000-000000000002'),false,'suspension immediately denies an existing token');
select extensions.is(fontex_beta.allowed('accc0000-0000-4000-8000-000000000003'),true,'other accounts are unaffected');
update fontex_beta.members set suspended_until=now()-interval '1 minute' where user_id='accc0000-0000-4000-8000-000000000002';
select extensions.ok(fontex_beta.allowed('accc0000-0000-4000-8000-000000000002'),'suspension expires without a background job');
set local role authenticated;
select public.admin_account_access('accc0000-0000-4000-8000-000000000002','ban',0,'Prueba de bloqueo','accc1000-0000-4000-8000-000000000002');
select public.admin_account_access('accc0000-0000-4000-8000-000000000002','ban',0,'Prueba de bloqueo','accc1000-0000-4000-8000-000000000002');
select extensions.is(jsonb_array_length(public.admin_account_history('accc0000-0000-4000-8000-000000000002')),2,'retries do not duplicate audit events');
select public.admin_account_access('accc0000-0000-4000-8000-000000000002','restore',0,'Reactivar cuenta',gen_random_uuid());
select extensions.throws_ok($$select public.admin_prepare_account_deletion('accc0000-0000-4000-8000-000000000002','otro@example.invalid','Eliminar cuenta',gen_random_uuid())$$,'22023','account_confirmation_required','deletion requires the selected account identity');
select extensions.throws_ok($$select public.admin_prepare_account_deletion('accc0000-0000-4000-8000-000000000003','control-peer@example.invalid','Proteger recursos ajenos',gen_random_uuid())$$,'22023','account_owns_shared_resources','shared ownership must be resolved before deletion');
select set_config('test.delete_plan',public.admin_prepare_account_deletion('accc0000-0000-4000-8000-000000000002','control-user@example.invalid','Eliminar solo Fontex','accc1000-0000-4000-8000-000000000003')::text,true);
select extensions.is(jsonb_array_length(current_setting('test.delete_plan')::jsonb->'paths'),1,'deletion prepares the owned PDF manifest');
select extensions.throws_ok($$select public.admin_finish_account_deletion('accc0000-0000-4000-8000-000000000002','accc1000-0000-4000-8000-000000000003','accc0000-0000-4000-8000-000000000001')$$,'42501',null,'browser cannot bypass Storage cleanup');
reset role;
select extensions.is(fontex_beta.allowed('accc0000-0000-4000-8000-000000000002'),false,'deletion in progress denies new writes and access');
select extensions.is((select count(*)::int from auth.users where id='accc0000-0000-4000-8000-000000000002'),1,'shared Auth identity is preserved during deletion');
set local role service_role;
select public.admin_finish_account_deletion('accc0000-0000-4000-8000-000000000002','accc1000-0000-4000-8000-000000000003','accc0000-0000-4000-8000-000000000001');
select public.admin_finish_account_deletion('accc0000-0000-4000-8000-000000000002','accc1000-0000-4000-8000-000000000003','accc0000-0000-4000-8000-000000000001');
reset role;
select extensions.ok((select deleted_at is not null from fontex_beta.members where user_id='accc0000-0000-4000-8000-000000000002'),'completed deletion creates a permanent Fontex tombstone');
select extensions.is((select count(*)::int from auth.users where id='accc0000-0000-4000-8000-000000000002'),1,'shared account is never removed');
select extensions.is((select count(*)::int from public.documents where owner_id='accc0000-0000-4000-8000-000000000002'),0,'personal document metadata is purged after Storage');
select extensions.is((select count(*)::int from public.visual_scenes where user_id='accc0000-0000-4000-8000-000000000002'),0,'personal canvases are removed');
select extensions.is((select count(*)::int from public.visual_scenes where user_id='accc0000-0000-4000-8000-000000000003'),1,'other accounts retain their content');
select extensions.is((select count(*)::int from public.classrooms where id='accc4000-0000-4000-8000-000000000001'),1,'another teacher classroom is preserved');
select extensions.is((select display_name from public.profiles where id='accc0000-0000-4000-8000-000000000002'),'Cuenta eliminada','Fontex profile is anonymized');
select extensions.throws_ok($$update fontex_beta.members set active=true where user_id='accc0000-0000-4000-8000-000000000002'$$,'22023','account_deleted','legacy invitations cannot reactivate a deleted account');
select extensions.throws_ok($$insert into public.studio_workspaces(user_id,state) values('accc0000-0000-4000-8000-000000000002','{}')$$,'42501','account_deleted','late callbacks cannot recreate personal content');
select extensions.is((select count(*)::int from public.organizations where id='accc3000-0000-4000-8000-000000000003'),0,'private workspace ownership does not block personal deletion');
select extensions.ok(not has_table_privilege('authenticated','fontex_beta.account_events','insert'),'audit data is server controlled');
select extensions.is((select balance from fontex_ai.wallets where user_id='accc0000-0000-4000-8000-000000000003'),5,'peer credits remain unchanged');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"accc0000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select extensions.is(jsonb_array_length(public.admin_list_ai_accounts('control-user@example.invalid', 25, 0)->'accounts'),
  0, 'completed deletions disappear from account search');
select extensions.is(jsonb_array_length(public.admin_list_ai_accounts('control-peer@example.invalid', 25, 0)->'accounts'),
  1, 'other accounts remain visible');
reset role;
select * from extensions.finish();
rollback;
