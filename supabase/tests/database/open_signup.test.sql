begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(id,email,raw_user_meta_data) values
('09e10000-0000-4000-8000-000000000001','open-signup@example.invalid','{}'),
('09e10000-0000-4000-8000-000000000002','open-other@example.invalid','{"is_admin":true,"role":"teacher","beta":true,"classroom_guest_token":"forged"}');
select extensions.is((select count(*)::int from fontex_beta.members where user_id::text like '09e10000-%'),2,'all public email registrations receive membership');
select extensions.is((select count(*)::int from fontex_ai.wallets where user_id::text like '09e10000-%' and balance=5),2,'each new account receives exactly five credits');
select extensions.is((select count(*)::int from fontex_ai.events where user_id::text like '09e10000-%' and kind='initial' and delta=5),2,'initial grants have one ledger event per account');
select extensions.is(fontex_beta.allowed('09e10000-0000-4000-8000-000000000001'),false,'email confirmation is still required');
select extensions.is((select count(*)::int from fontex_ai.admins where user_id::text like '09e10000-%'),0,'metadata cannot grant AI administration');
select extensions.is((select count(*)::int from public.class_members where user_id::text like '09e10000-%'),0,'registration does not join private classrooms');
select extensions.is((select count(*)::int from private.guest_credit_promotions where user_id::text like '09e10000-%'),0,'ordinary registration does not receive a guest promotion bonus');
update auth.users set email_confirmed_at=now() where id='09e10000-0000-4000-8000-000000000001';
select extensions.ok(fontex_beta.allowed('09e10000-0000-4000-8000-000000000001'),'confirmed public registration can use the app');
select fontex_ai.ensure_wallet('09e10000-0000-4000-8000-000000000001');
select fontex_ai.ensure_wallet('09e10000-0000-4000-8000-000000000001');
select extensions.is((select balance from fontex_ai.wallets where user_id='09e10000-0000-4000-8000-000000000001'),5,'repeated initialization cannot mint more credits');
select extensions.is((select count(*)::int from fontex_ai.events where user_id='09e10000-0000-4000-8000-000000000001' and kind='initial'),1,'the welcome grant is unique');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"09e10000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select extensions.is((public.get_ai_credit_status()->>'balance')::int,5,'a public account can read its five credits');
select extensions.throws_ok($$select public.admin_list_ai_accounts()$$,'42501',null,'public signup does not grant administration');
select extensions.ok(not has_function_privilege('authenticated','fontex_ai.ensure_wallet(uuid)','execute'),'clients cannot mint credits');
reset role;
update fontex_ai.wallets set balance=2 where user_id='09e10000-0000-4000-8000-000000000001';
select fontex_ai.ensure_wallet('09e10000-0000-4000-8000-000000000001');
select extensions.is((select balance from fontex_ai.wallets where user_id='09e10000-0000-4000-8000-000000000001'),2,'initialization never resets spent or granted balances');
update fontex_beta.members set active=false where user_id='09e10000-0000-4000-8000-000000000001';
select extensions.is(fontex_beta.allowed('09e10000-0000-4000-8000-000000000001'),false,'explicitly revoked accounts stay blocked');
select extensions.ok(not exists(select 1 from pg_trigger where tgname='fontex_beta_check_signup' and tgrelid='auth.users'::regclass),'the invitation-only registration trigger is removed');
select * from extensions.finish();
rollback;
