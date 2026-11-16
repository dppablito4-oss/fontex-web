begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

set local role anon;
select set_config('request.path', '/rpc/get_release_contract', true);
select extensions.lives_ok($$select public.check_beta_request()$$, 'release metadata stays public without granting beta access');
select extensions.is(public.get_release_contract(), 'closed-beta-v4', 'release v4 includes canvas sharing');
select set_config('request.path', '/rpc/read_public_canvas', true);
select extensions.lives_ok($$select public.check_beta_request()$$, 'the release probe can reach the public reader');
select extensions.is(public.read_public_canvas(null), null::jsonb, 'a null-token probe reads no shared document');
select extensions.ok(not has_function_privilege('anon', 'public.publish_canvas(text)', 'execute'), 'release checks do not enable anonymous publishing');
select extensions.ok(not has_table_privilege('anon', 'public.canvas_public_shares', 'select'), 'release checks do not enable listing shared documents');
reset role;

alter function public.read_public_canvas(uuid) rename to audit_missing_public_reader;
select extensions.is(public.get_release_contract(), null::text, 'missing sharing RPCs cannot advertise release v4');
alter function public.audit_missing_public_reader(uuid) rename to read_public_canvas;
grant execute on function public.publish_canvas(text) to anon;
select extensions.is(public.get_release_contract(), null::text, 'anonymous publication cannot advertise release v4');

select * from extensions.finish();
rollback;
