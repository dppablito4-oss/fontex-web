begin;

create extension if not exists pgtap with schema extensions;

select extensions.no_plan();

select extensions.has_table('public', 'documents', 'documents exists');
select extensions.has_table('public', 'document_shares', 'document_shares exists');
select extensions.has_table('public', 'document_limits', 'document_limits exists');

select extensions.is(
  (
    select count(*)::integer
    from pg_catalog.pg_class
    where oid in (
      'public.documents'::regclass,
      'public.document_shares'::regclass,
      'public.document_limits'::regclass
    )
      and relrowsecurity
  ),
  3,
  'RLS is enabled on every Block 2 public table'
);

select extensions.is(
  (select public from storage.buckets where id = 'fontex-documents'),
  false,
  'The document bucket is private'
);

select extensions.is(
  (select file_size_limit from storage.buckets where id = 'fontex-documents'),
  5242880::bigint,
  'The bucket enforces the 5 MiB file limit'
);

select extensions.is(
  (select allowed_mime_types from storage.buckets where id = 'fontex-documents'),
  array['application/pdf']::text[],
  'The bucket accepts only PDF MIME type'
);

select extensions.is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'fontex_documents_download_authorized'
      and cmd = 'SELECT'
  ),
  1,
  'Storage exposes exactly the authenticated download policy for Fontex documents'
);

select extensions.is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'fontex_documents_%'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ),
  0,
  'Direct upload, replacement and deletion receive no Storage policies'
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
    '00000000-0000-4000-8000-000000000201',
    'authenticated',
    'authenticated',
    'teacher.block2@fontex.test',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Docente Bloque 2"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'authenticated',
    'authenticated',
    'student-a@fontex.test',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Estudiante A"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    'authenticated',
    'authenticated',
    'student-b@fontex.test',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Estudiante B"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    'authenticated',
    'authenticated',
    'student-c@fontex.test',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Estudiante C"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000205',
    'authenticated',
    'authenticated',
    'outsider.block2@fontex.test',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Persona Ajena"}',
    now(),
    now()
  );

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000205","email":"outsider.block2@fontex.test","role":"authenticated"}';

select extensions.throws_ok(
  $$ select public.create_workspace('Apropiación', 'Aula indebida', null) $$,
  '42501',
  'workspace bootstrap requires prior authorization',
  'A public account cannot claim the empty pilot workspace'
);

reset role;
insert into private.workspace_bootstrap_authorizations (user_id)
values ('00000000-0000-4000-8000-000000000201');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000201","email":"teacher.block2@fontex.test","role":"authenticated"}';

select extensions.lives_ok(
  $$
    select set_config(
      'test.block2_classroom_id',
      public.create_workspace('Institución Bloque 2', 'Aula documental', '2026-II')::text,
      true
    )
  $$,
  'The pre-authorized account can bootstrap the pilot workspace once'
);

reset role;

select extensions.is(
  (
    select count(*)::integer
    from private.workspace_bootstrap_authorizations
    where user_id = '00000000-0000-4000-8000-000000000201'
  ),
  0,
  'Bootstrap authorization is consumed atomically'
);

insert into public.class_members (classroom_id, user_id, role, status, invited_by)
values
  (
    current_setting('test.block2_classroom_id')::uuid,
    '00000000-0000-4000-8000-000000000202',
    'student',
    'active',
    '00000000-0000-4000-8000-000000000201'
  ),
  (
    current_setting('test.block2_classroom_id')::uuid,
    '00000000-0000-4000-8000-000000000203',
    'student',
    'active',
    '00000000-0000-4000-8000-000000000201'
  ),
  (
    current_setting('test.block2_classroom_id')::uuid,
    '00000000-0000-4000-8000-000000000204',
    'student',
    'active',
    '00000000-0000-4000-8000-000000000201'
  );

insert into public.study_groups (id, classroom_id, name, created_by)
values
  (
    '30000000-0000-4000-8000-000000000101',
    current_setting('test.block2_classroom_id')::uuid,
    'Grupo A',
    '00000000-0000-4000-8000-000000000201'
  ),
  (
    '30000000-0000-4000-8000-000000000102',
    current_setting('test.block2_classroom_id')::uuid,
    'Grupo B',
    '00000000-0000-4000-8000-000000000201'
  );

insert into public.group_members (group_id, user_id, added_by)
values
  (
    '30000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000201'
  ),
  (
    '30000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000201'
  ),
  (
    '30000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000201'
  );

insert into public.documents (
  id,
  owner_id,
  classroom_id,
  title,
  original_filename,
  mime_type,
  size_bytes,
  page_count,
  content_sha256,
  storage_path,
  status
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000202',
    current_setting('test.block2_classroom_id')::uuid,
    'Privado de A',
    'privado-a.pdf',
    'application/pdf',
    1000,
    2,
    repeat('a', 64),
    '40000000-0000-4000-8000-000000000001/41000000-0000-4000-8000-000000000001.pdf',
    'ready'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000202',
    current_setting('test.block2_classroom_id')::uuid,
    'Compartido con grupo A',
    'grupo-a.pdf',
    'application/pdf',
    2000,
    3,
    repeat('b', 64),
    '40000000-0000-4000-8000-000000000002/41000000-0000-4000-8000-000000000002.pdf',
    'ready'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000201',
    current_setting('test.block2_classroom_id')::uuid,
    'Material del aula',
    'material-aula.pdf',
    'application/pdf',
    3000,
    4,
    repeat('c', 64),
    '40000000-0000-4000-8000-000000000003/41000000-0000-4000-8000-000000000003.pdf',
    'ready'
  );

insert into public.document_shares (
  document_id,
  scope_type,
  group_id,
  granted_by
)
values (
  '40000000-0000-4000-8000-000000000002',
  'group',
  '30000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000202'
);

insert into public.document_shares (
  document_id,
  scope_type,
  classroom_id,
  granted_by
)
values (
  '40000000-0000-4000-8000-000000000003',
  'classroom',
  current_setting('test.block2_classroom_id')::uuid,
  '00000000-0000-4000-8000-000000000201'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000202","email":"student-a@fontex.test","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.documents),
  3,
  'Student A can read owned private documents and classroom material'
);

select extensions.throws_like(
  $$
    insert into public.documents (
      classroom_id, title, original_filename, mime_type, size_bytes,
      page_count, content_sha256, storage_path
    ) values (
      current_setting('test.block2_classroom_id')::uuid,
      'Ataque', 'ataque.pdf', 'application/pdf', 100,
      1, repeat('f', 64),
      '42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001.pdf'
    )
  $$,
  '%permission denied%',
  'Authenticated users cannot bypass reservation with direct document inserts'
);

select extensions.throws_like(
  $$ update public.documents set owner_id = '00000000-0000-4000-8000-000000000203' where id = '40000000-0000-4000-8000-000000000001' $$,
  '%permission denied%',
  'A manipulated request cannot change document ownership'
);

select extensions.throws_like(
  $$ delete from public.documents where id = '40000000-0000-4000-8000-000000000003' $$,
  '%permission denied%',
  'Students cannot delete documents directly'
);

select extensions.lives_ok(
  $$
    insert into public.document_shares (document_id, scope_type, group_id)
    values (
      '40000000-0000-4000-8000-000000000001',
      'group',
      '30000000-0000-4000-8000-000000000101'
    )
  $$,
  'Student A can share an owned ready PDF with their own group'
);

select extensions.throws_like(
  $$
    insert into public.document_shares (document_id, scope_type, group_id)
    values (
      '40000000-0000-4000-8000-000000000001',
      'group',
      '30000000-0000-4000-8000-000000000102'
    )
  $$,
  '%row-level security%',
  'A student cannot share a document with a group they do not belong to'
);

select extensions.throws_like(
  format(
    'insert into public.document_shares (document_id, scope_type, classroom_id) values (%L, %L, %L)',
    '40000000-0000-4000-8000-000000000001',
    'classroom',
    current_setting('test.block2_classroom_id')
  ),
  '%row-level security%',
  'A student cannot publish a document to the classroom'
);

select extensions.throws_ok(
  format(
    'select public.reserve_document_upload(%L, %L, %L, %L, %s, %s, %L)',
    current_setting('test.block2_classroom_id'),
    'Archivo inválido',
    'archivo.txt',
    'text/plain',
    500,
    1,
    repeat('d', 64)
  ),
  '22023',
  'only application/pdf is accepted',
  'Trusted reservation rejects a non-PDF MIME type'
);

select extensions.throws_ok(
  format(
    'select public.reserve_document_upload(%L, %L, %L, %L, %s, %s, %L)',
    current_setting('test.block2_classroom_id'),
    'Archivo grande',
    'grande.pdf',
    'application/pdf',
    5242881,
    1,
    repeat('d', 64)
  ),
  '22023',
  'document exceeds the allowed file size',
  'Trusted reservation enforces the 5 MiB limit'
);

select extensions.throws_ok(
  format(
    'select public.reserve_document_upload(%L, %L, %L, %L, %s, %s, %L)',
    current_setting('test.block2_classroom_id'),
    'Demasiadas páginas',
    'paginas.pdf',
    'application/pdf',
    500,
    101,
    repeat('d', 64)
  ),
  '22023',
  'document exceeds the allowed page count',
  'Trusted reservation enforces the 100-page limit'
);

select extensions.lives_ok(
  format(
    'select public.reserve_document_upload(%L, %L, %L, %L, %s, %s, %L)',
    current_setting('test.block2_classroom_id'),
    'Reserva segura',
    'reserva.pdf',
    'application/pdf',
    500,
    1,
    repeat('d', 64)
  ),
  'Student A can reserve quota for a valid PDF'
);

select extensions.is(
  (
    select owner_id
    from public.documents
    where content_sha256 = repeat('d', 64)
  ),
  '00000000-0000-4000-8000-000000000202'::uuid,
  'Reservation derives ownership from the authenticated JWT'
);

select extensions.ok(
  (
    select storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]pdf$'
    from public.documents
    where content_sha256 = repeat('d', 64)
  ),
  'Reservation generates an unguessable UUID object path'
);

select extensions.throws_ok(
  format(
    'select public.reserve_document_upload(%L, %L, %L, %L, %s, %s, %L)',
    current_setting('test.block2_classroom_id'),
    'Duplicado',
    'duplicado.pdf',
    'application/pdf',
    500,
    1,
    repeat('d', 64)
  ),
  '23505',
  'an active copy of this document already exists',
  'An active duplicate is rejected by its trusted hash'
);

reset role;
update public.document_limits set max_documents_per_user = 3 where id = 1;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000202","email":"student-a@fontex.test","role":"authenticated"}';

select extensions.throws_ok(
  format(
    'select public.reserve_document_upload(%L, %L, %L, %L, %s, %s, %L)',
    current_setting('test.block2_classroom_id'),
    'Exceso de cuota',
    'cuota.pdf',
    'application/pdf',
    500,
    1,
    repeat('e', 64)
  ),
  '54000',
  'document count quota exceeded',
  'The database rejects reservations beyond the user document quota'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000203","email":"student-b@fontex.test","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.documents),
  1,
  'Student B cannot read Student A private or Group A documents'
);

select extensions.is(
  (
    select count(*)::integer
    from public.documents
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  0,
  'Knowing a private document UUID does not reveal its metadata'
);

set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000204","email":"student-c@fontex.test","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.documents),
  3,
  'Student C can read both Group A shares and classroom material'
);

select extensions.lives_ok(
  $$ delete from public.document_shares where document_id = '40000000-0000-4000-8000-000000000001' $$,
  'A non-owner delete request is harmless under RLS'
);

select extensions.is(
  (
    select count(*)::integer
    from public.document_shares
    where document_id = '40000000-0000-4000-8000-000000000001'
  ),
  1,
  'A non-owner cannot revoke another owner share'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000202","email":"student-a@fontex.test","role":"authenticated"}';

delete from public.document_shares
where document_id = '40000000-0000-4000-8000-000000000001';

set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000204","email":"student-c@fontex.test","role":"authenticated"}';

select extensions.is(
  (
    select count(*)::integer
    from public.documents
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  0,
  'Revoking a share immediately removes future metadata access'
);

reset role;
delete from public.group_members
where group_id = '30000000-0000-4000-8000-000000000101'
  and user_id = '00000000-0000-4000-8000-000000000204';

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000204","email":"student-c@fontex.test","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.documents),
  1,
  'Removing Group A membership revokes group document access'
);

reset role;
insert into public.group_members (group_id, user_id, added_by)
values (
  '30000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000204',
  '00000000-0000-4000-8000-000000000201'
);
update public.class_members
set status = 'removed'
where classroom_id = current_setting('test.block2_classroom_id')::uuid
  and user_id = '00000000-0000-4000-8000-000000000204';

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000204","email":"student-c@fontex.test","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.documents),
  0,
  'Revoking classroom membership removes classroom and group document access'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000201","email":"teacher.block2@fontex.test","role":"authenticated"}';

select extensions.is(
  (
    select count(*)::integer
    from public.documents
    where owner_id = '00000000-0000-4000-8000-000000000202'
  ),
  0,
  'A teacher cannot automatically read student private documents'
);

select extensions.is(
  (select count(*)::integer from public.documents),
  1,
  'A teacher can read their own published classroom document'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000205","email":"outsider.block2@fontex.test","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.documents),
  0,
  'An outsider cannot read any document metadata'
);

select extensions.throws_ok(
  format(
    'select public.reserve_document_upload(%L, %L, %L, %L, %s, %s, %L)',
    current_setting('test.block2_classroom_id'),
    'Ataque externo',
    'externo.pdf',
    'application/pdf',
    500,
    1,
    repeat('f', 64)
  ),
  '42501',
  'active classroom membership required',
  'An outsider cannot reserve upload quota in the classroom'
);

reset role;
set local role anon;
set local "request.jwt.claims" = '{}';

select extensions.throws_like(
  $$ select * from public.documents $$,
  '%permission denied%',
  'Anonymous users cannot read document metadata'
);

select extensions.throws_like(
  $$ select * from public.document_shares $$,
  '%permission denied%',
  'Anonymous users cannot read document shares'
);

select * from extensions.finish();
rollback;
