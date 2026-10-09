begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(34);

select extensions.has_table('public', 'profiles', 'profiles exists');
select extensions.has_table('public', 'organizations', 'organizations exists');
select extensions.has_table('public', 'classrooms', 'classrooms exists');
select extensions.has_table('public', 'class_members', 'class_members exists');
select extensions.has_table('public', 'classroom_invitations', 'classroom_invitations exists');
select extensions.has_table('public', 'study_groups', 'study_groups exists');
select extensions.has_table('public', 'group_members', 'group_members exists');

select extensions.is(
  (
    select count(*)::integer
    from pg_catalog.pg_class
    where oid in (
      'public.profiles'::regclass,
      'public.organizations'::regclass,
      'public.classrooms'::regclass,
      'public.class_members'::regclass,
      'public.classroom_invitations'::regclass,
      'public.study_groups'::regclass,
      'public.group_members'::regclass
    )
      and relrowsecurity
  ),
  7,
  'RLS is enabled on every Block 1 table'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'teacher@fontex.test',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Docente Fontex"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'authenticated',
    'authenticated',
    'student@fontex.test',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Estudiante Fontex"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'authenticated',
    'authenticated',
    'outsider@fontex.test',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Persona Ajena"}',
    now(),
    now()
  );

select extensions.is(
  (select count(*)::integer from public.profiles where id in (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000103'
  )),
  3,
  'Auth trigger provisions one profile per user'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000101","email":"teacher@fontex.test","role":"authenticated"}';

select extensions.lives_ok(
  $$
    select set_config(
      'test.classroom_id',
      public.create_workspace('Institución piloto', 'Aula segura', '2026-II')::text,
      true
    )
  $$,
  'The first authenticated user can atomically bootstrap the workspace'
);

select extensions.is(
  (
    select role::text
    from public.class_members
    where classroom_id = current_setting('test.classroom_id')::uuid
      and user_id = '00000000-0000-0000-0000-000000000101'
  ),
  'teacher',
  'The classroom owner is provisioned as teacher'
);

do $$
declare
  invitation jsonb;
begin
  invitation := public.create_classroom_invitation(
    current_setting('test.classroom_id')::uuid,
    'student@fontex.test',
    'student',
    interval '1 day'
  );
  perform set_config('test.invitation_token', invitation ->> 'token', true);
end;
$$;

select extensions.ok(
  char_length(current_setting('test.invitation_token')) = 64,
  'A teacher can generate a single-use invitation token'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000103","email":"outsider@fontex.test","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.classrooms),
  0,
  'An outsider cannot see the private classroom'
);

select extensions.throws_ok(
  format(
    'select public.accept_classroom_invitation(%L)',
    current_setting('test.invitation_token')
  ),
  '42501',
  'invitation email does not match authenticated user',
  'An invitation cannot be used by a different email'
);

select extensions.throws_like(
  $$
    insert into public.class_members (classroom_id, user_id, role)
    values (
      current_setting('test.classroom_id')::uuid,
      '00000000-0000-0000-0000-000000000103',
      'teacher'
    )
  $$,
  '%permission denied%',
  'An outsider cannot insert a privileged membership directly'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000102","email":"student@fontex.test","role":"authenticated"}';

select extensions.lives_ok(
  format(
    'select public.accept_classroom_invitation(%L)',
    current_setting('test.invitation_token')
  ),
  'The intended student can accept the invitation'
);

select extensions.is(
  (select count(*)::integer from public.classrooms),
  1,
  'The enrolled student can read the classroom'
);

select extensions.throws_ok(
  $$
    select public.create_workspace(
      'Organización indebida',
      'Aula indebida',
      '2026-II'
    )
  $$,
  '42501',
  'an active teacher role is required to create another workspace',
  'A student cannot self-assign teacher privileges by creating a workspace'
);

select extensions.throws_like(
  $$
    update public.class_members
    set role = 'teacher'
    where classroom_id = current_setting('test.classroom_id')::uuid
      and user_id = '00000000-0000-0000-0000-000000000102'
  $$,
  '%permission denied%',
  'A student cannot update their role directly'
);

select extensions.throws_ok(
  $$
    select public.set_classroom_member_role(
      current_setting('test.classroom_id')::uuid,
      '00000000-0000-0000-0000-000000000102',
      'teacher'
    )
  $$,
  '42501',
  'only the classroom owner can change roles',
  'A student cannot promote themselves through the role RPC'
);

select extensions.throws_like(
  $$
    insert into public.study_groups (id, classroom_id, name)
    values (
      '30000000-0000-0000-0000-000000000001',
      current_setting('test.classroom_id')::uuid,
      'Grupo indebido'
    )
  $$,
  '%row-level security%',
  'A student cannot create a study group'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000101","email":"teacher@fontex.test","role":"authenticated"}';

select extensions.lives_ok(
  $$
    insert into public.study_groups (id, classroom_id, name)
    values (
      '30000000-0000-0000-0000-000000000001',
      current_setting('test.classroom_id')::uuid,
      'Horizonte'
    )
  $$,
  'A teacher can create a study group'
);

select extensions.lives_ok(
  $$
    insert into public.group_members (group_id, user_id)
    values (
      '30000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000102'
    )
  $$,
  'A teacher can assign an active classroom member to a group'
);

select extensions.throws_like(
  $$
    insert into public.group_members (group_id, user_id)
    values (
      '30000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000103'
    )
  $$,
  '%row-level security%',
  'A teacher cannot assign an outsider to a group'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000102","email":"student@fontex.test","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.study_groups),
  1,
  'A classroom member can see groups in their classroom'
);

select extensions.is(
  (select count(*)::integer from public.group_members where user_id = auth.uid()),
  1,
  'An assigned student can read their group membership'
);

select extensions.throws_like(
  $$
    insert into public.group_members (group_id, user_id)
    values (
      '30000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000103'
    )
  $$,
  '%row-level security%',
  'A student cannot assign another user to a group'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000101","email":"teacher@fontex.test","role":"authenticated"}';

select extensions.lives_ok(
  $$
    delete from public.group_members
    where group_id = '30000000-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-000000000102'
  $$,
  'A teacher can remove a member from a group'
);

select extensions.is(
  (
    select count(*)::integer
    from public.group_members
    where group_id = '30000000-0000-0000-0000-000000000001'
  ),
  0,
  'The group assignment is removed'
);

insert into public.group_members (group_id, user_id)
values (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000102'
);

select extensions.lives_ok(
  $$
    select public.remove_classroom_member(
      current_setting('test.classroom_id')::uuid,
      '00000000-0000-0000-0000-000000000102'
    )
  $$,
  'A teacher can remove a non-owner classroom member'
);

select extensions.is(
  (
    select count(*)::integer
    from public.group_members
    where user_id = '00000000-0000-0000-0000-000000000102'
  ),
  0,
  'Removing a classroom member also removes group assignments'
);

select extensions.throws_ok(
  $$
    select public.remove_classroom_member(
      current_setting('test.classroom_id')::uuid,
      '00000000-0000-0000-0000-000000000101'
    )
  $$,
  '22023',
  'the classroom owner cannot be removed',
  'The classroom owner cannot be removed'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000102","email":"student@fontex.test","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.classrooms),
  0,
  'A removed member immediately loses classroom access'
);

reset role;
set local role anon;
set local "request.jwt.claims" = '{}';

select extensions.throws_like(
  $$ select * from public.classrooms $$,
  '%permission denied%',
  'Anonymous users have no table privileges'
);

select * from extensions.finish();
rollback;
