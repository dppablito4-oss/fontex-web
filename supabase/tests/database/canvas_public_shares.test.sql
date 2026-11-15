begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into fontex_beta.invitations(email) values ('canvas-share-owner@example.invalid'),('canvas-share-other@example.invalid');
insert into auth.users(id,email,email_confirmed_at) values
('cafe0000-0000-4000-8000-000000000001','canvas-share-owner@example.invalid',now()),
('cafe0000-0000-4000-8000-000000000002','canvas-share-other@example.invalid',now());
insert into fontex_beta.members(user_id) values
('cafe0000-0000-4000-8000-000000000001'),('cafe0000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.visual_scenes(user_id,id,revision,scene) values
('cafe0000-0000-4000-8000-000000000001','share-test',1,
'{"schemaVersion":2,"format":"primitive-scene","id":"share-test","title":"Fracciones","level":"primaria","updatedAt":"2026-11-15T00:00:00Z","variables":[],"primitives":[],"conversation":[{"role":"user","content":"Private chat"}]}'::jsonb);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cafe0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select extensions.throws_ok($$select public.publish_canvas('share-test')$$,'P0001','Save your canvas first','another user cannot publish a private canvas');
select set_config('request.jwt.claims','{"sub":"cafe0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('test.share_token',public.publish_canvas('share-test')::text,true);
select extensions.is((select count(*)::int from public.canvas_public_shares),1,'owner can inspect their share');
select extensions.is(public.publish_canvas('share-test')::text,current_setting('test.share_token'),'repeated export retains its link');
select extensions.is(public.read_public_canvas(current_setting('test.share_token')::uuid)->'conversation','[]'::jsonb,'public snapshot excludes the private chat');
select set_config('request.jwt.claims','{"sub":"cafe0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select extensions.is((select count(*)::int from public.canvas_public_shares),0,'another account cannot list shares');
delete from public.canvas_public_shares;
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.path','/rpc/read_public_canvas',true);
select extensions.lives_ok($$select public.check_beta_request()$$,'public viewer bypasses membership only for its read RPC');
select extensions.ok(not has_table_privilege('anon','public.canvas_public_shares','select'),'anonymous clients cannot enumerate public tokens');
select extensions.ok(not has_function_privilege('anon','public.publish_canvas(text)','execute'),'anonymous visitors cannot publish');
select extensions.is(public.read_public_canvas(current_setting('test.share_token')::uuid)->>'title','Fracciones','link opens without a session');
select extensions.is(public.read_public_canvas('cafe0000-0000-4000-8000-999999999999'::uuid),null::jsonb,'unknown tokens return no scene');
select set_config('request.path','/visual_scenes',true);
select extensions.throws_ok($$select public.check_beta_request()$$,'42501','beta_invitation_required','personal scenes still require membership');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cafe0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
delete from public.canvas_public_shares where scene_id='share-test';
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select extensions.is(public.read_public_canvas(current_setting('test.share_token')::uuid),null::jsonb,'revocation invalidates the link');
reset role;
select * from extensions.finish();
rollback;
