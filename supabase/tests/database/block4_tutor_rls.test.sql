begin;

create extension if not exists pgtap with schema extensions;

select extensions.no_plan();

select extensions.has_table('public', 'tutor_limits', 'tutor limits table exists');
select extensions.has_table('public', 'tutor_conversations', 'tutor conversations table exists');
select extensions.has_table('public', 'tutor_messages', 'tutor messages table exists');
select extensions.has_table('public', 'tutor_message_citations', 'tutor message citations table exists');
select extensions.has_table('public', 'tutor_usage_events', 'tutor usage events table exists');

select extensions.is(
  (
    select count(*)::integer
    from pg_catalog.pg_class
    where oid in (
      'public.tutor_limits'::regclass,
      'public.tutor_conversations'::regclass,
      'public.tutor_messages'::regclass,
      'public.tutor_message_citations'::regclass,
      'public.tutor_usage_events'::regclass
    )
      and relrowsecurity
  ),
  5,
  'RLS is enabled on all Block 4 public tables'
);

-- Setup test users
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000401', 'authenticated', 'authenticated',
    'teacher.block4@fontex.test', '{"provider":"email","providers":["email"]}',
    '{"display_name":"Docente Bloque 4"}', now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000402', 'authenticated', 'authenticated',
    'student-a.block4@fontex.test', '{"provider":"email","providers":["email"]}',
    '{"display_name":"Estudiante A Bloque 4"}', now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000403', 'authenticated', 'authenticated',
    'student-b.block4@fontex.test', '{"provider":"email","providers":["email"]}',
    '{"display_name":"Estudiante B Bloque 4"}', now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000404', 'authenticated', 'authenticated',
    'outsider.block4@fontex.test', '{"provider":"email","providers":["email"]}',
    '{"display_name":"Persona Ajena Bloque 4"}', now(), now()
  );

insert into private.workspace_bootstrap_authorizations (user_id)
values ('00000000-0000-4000-8000-000000000401');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000401","role":"authenticated"}';

select set_config(
  'test.block4_classroom_id',
  public.create_workspace('Institución Bloque 4', 'Aula Tutor', '2026-II')::text,
  true
);

reset role;

insert into public.class_members (classroom_id, user_id, role, status, invited_by)
values
  (
    current_setting('test.block4_classroom_id')::uuid,
    '00000000-0000-4000-8000-000000000402',
    'student', 'active', '00000000-0000-4000-8000-000000000401'
  ),
  (
    current_setting('test.block4_classroom_id')::uuid,
    '00000000-0000-4000-8000-000000000403',
    'student', 'active', '00000000-0000-4000-8000-000000000401'
  )
on conflict do nothing;

insert into public.study_groups (id, classroom_id, name, created_by)
values
  (
    '40000000-0000-4000-8000-000000000401',
    current_setting('test.block4_classroom_id')::uuid,
    'Grupo Tutor A',
    '00000000-0000-4000-8000-000000000401'
  ),
  (
    '40000000-0000-4000-8000-000000000402',
    current_setting('test.block4_classroom_id')::uuid,
    'Grupo Tutor B',
    '00000000-0000-4000-8000-000000000401'
  );

insert into public.group_members (group_id, user_id, added_by)
values
  (
    '40000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000402',
    '00000000-0000-4000-8000-000000000401'
  ),
  (
    '40000000-0000-4000-8000-000000000402',
    '00000000-0000-4000-8000-000000000403',
    '00000000-0000-4000-8000-000000000401'
  );

-- Test 1: Student A creates conversation
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000402","role":"authenticated"}';

insert into public.tutor_conversations (
  id, user_id, classroom_id, title, mode, guided
)
values (
  'c0000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000402',
  current_setting('test.block4_classroom_id')::uuid,
  'Consulta sobre Cinemática',
  'strict',
  false
);

select extensions.is(
  (select count(*)::integer from public.tutor_conversations where id = 'c0000000-0000-4000-8000-000000000001'),
  1,
  'Student A can see own conversation'
);

-- Student A inserts a message
insert into public.tutor_messages (
  id, conversation_id, user_id, role, content, order_index
)
values (
  'ba000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000402',
  'user',
  '¿Cuál es la segunda ley de Newton?',
  1
);

select extensions.is(
  (select count(*)::integer from public.tutor_messages where id = 'ba000000-0000-4000-8000-000000000001'),
  1,
  'Student A can read own message'
);

-- Test 2: Student B cannot see Student A conversation
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000403","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.tutor_conversations where id = 'c0000000-0000-4000-8000-000000000001'),
  0,
  'Student B cannot see Student A conversation'
);

select extensions.is(
  (select count(*)::integer from public.tutor_messages where id = 'ba000000-0000-4000-8000-000000000001'),
  0,
  'Student B cannot see Student A messages'
);

-- Test 3: Teacher cannot see Student A private conversation
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000401","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.tutor_conversations where id = 'c0000000-0000-4000-8000-000000000001'),
  0,
  'Teacher cannot read student private conversation'
);

-- Test 4: Outsider cannot create conversation in classroom
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000404","role":"authenticated"}';

select extensions.throws_ok(
  format(
    'insert into public.tutor_conversations (id, user_id, classroom_id, title) values (gen_random_uuid(), ''00000000-0000-4000-8000-000000000404'', %L, ''Intruso'')',
    current_setting('test.block4_classroom_id')
  ),
  '42501',
  null,
  'Outsider cannot insert conversation into non-enrolled classroom'
);

-- Test 5: Direct RPC execution blocked for authenticated user
select extensions.throws_like(
  'select public.internal_begin_tutor_request(''00000000-0000-4000-8000-000000000404'', gen_random_uuid(), gen_random_uuid(), ''strict'', false, 10)',
  '%permission denied%',
  'internal_begin_tutor_request is blocked for authenticated users'
);

select extensions.throws_like(
  'select * from public.internal_search_tutor_chunks(''00000000-0000-4000-8000-000000000404'', gen_random_uuid(), ''test'', (''['' || ''0.1,'' || repeat(''0,'', 1534) || ''0]'')::extensions.vector(1536))',
  '%permission denied%',
  'internal_search_tutor_chunks is blocked for authenticated users'
);

-- Test 6: Verify internal RPC behavior as service_role
reset role;

-- Setup document chunks for RAG search testing
insert into public.documents (
  id, owner_id, classroom_id, title, original_filename, mime_type, size_bytes,
  page_count, storage_path, status, content_sha256
)
values
  (
    'd0000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000401', -- Teacher
    current_setting('test.block4_classroom_id')::uuid,
    'Física I — Mecánica Clásica',
    'fisica1.pdf', 'application/pdf', 2048, 20,
    'd0000000-0000-4000-8000-000000000001/41000000-0000-4000-8000-000000000401.pdf', 'ready',
    repeat('4', 64)
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000403', -- Student B private
    current_setting('test.block4_classroom_id')::uuid,
    'Apuntes Privados de Student B',
    'apuntes_b.pdf', 'application/pdf', 1024, 10,
    'd0000000-0000-4000-8000-000000000002/41000000-0000-4000-8000-000000000402.pdf', 'ready',
    repeat('5', 64)
  );

-- Share Teacher doc with classroom
insert into public.document_shares (
  document_id, scope_type, classroom_id, group_id, granted_by
)
values (
  'd0000000-0000-4000-8000-000000000001',
  'classroom',
  current_setting('test.block4_classroom_id')::uuid,
  null,
  '00000000-0000-4000-8000-000000000401'
);

-- Processing jobs (ready and complete)
insert into public.document_processing_jobs (
  id, document_id, owner_id, status, phase, chunk_count, embedded_chunk_count, embedding_tokens
)
values
  (
    'ea000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000401',
    'ready', 'complete', 1, 1, 100
  ),
  (
    'ea000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000403',
    'ready', 'complete', 1, 1, 100
  );

-- Document chunks
insert into public.document_chunks (
  document_id, job_id, chunk_index, page_start, page_end,
  content, content_sha256, estimated_tokens, embedding,
  embedding_model, chunk_version, embedded_at
)
values
  (
    'd0000000-0000-4000-8000-000000000001',
    'ea000000-0000-4000-8000-000000000001',
    0, 14, 14,
    'La segunda ley de Newton establece que la fuerza neta es igual al producto de la masa por la aceleración: F = m * a.',
    repeat('7', 64),
    25,
    ('[' || repeat('0.05,', 1535) || '0.05]')::extensions.vector(1536),
    'text-embedding-3-small',
    'page-paragraph-v1',
    now()
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    'ea000000-0000-4000-8000-000000000002',
    0, 1, 1,
    'Contenido privado de B que Student A no debe ver.',
    repeat('8', 64),
    15,
    ('[' || repeat('0.05,', 1535) || '0.05]')::extensions.vector(1536),
    'text-embedding-3-small',
    'page-paragraph-v1',
    now()
  );

-- Test begin tutor request
select set_config(
  'test.block4_usage_event_id',
  (
    select (public.internal_begin_tutor_request(
      '00000000-0000-4000-8000-000000000402',
      current_setting('test.block4_classroom_id')::uuid,
      'c0000000-0000-4000-8000-000000000001',
      'strict',
      false,
      30
    )->>'event_id')::text
  ),
  true
);

-- Test concurrency limit: second active request should be rejected
select extensions.throws_ok(
  format(
    'select public.internal_begin_tutor_request(''00000000-0000-4000-8000-000000000402'', %L, ''c0000000-0000-4000-8000-000000000001'', ''strict'', false, 30)',
    current_setting('test.block4_classroom_id')
  ),
  '54000',
  null,
  'Concurrent tutor request is blocked by quota'
);

-- Complete the first request
select extensions.lives_ok(
  format(
    'select public.internal_complete_tutor_request(%L::uuid, ''00000000-0000-4000-8000-000000000402'', ''completed'', 1, 100, 50, 0, 450, null)',
    current_setting('test.block4_usage_event_id')
  ),
  'internal_complete_tutor_request completes successfully'
);

-- Search tutor chunks as Student A: should find chunk for classroom doc, NOT chunk for B
select extensions.is(
  (
    select count(*)::integer
    from public.internal_search_tutor_chunks(
      '00000000-0000-4000-8000-000000000402',
      current_setting('test.block4_classroom_id')::uuid,
      'Newton aceleración masa',
      ('[' || repeat('0.05,', 1535) || '0.05]')::extensions.vector(1536),
      null,
      'all',
      5
    )
    where document_id = 'd0000000-0000-4000-8000-000000000001'
  ),
  1,
  'Student A retrieves authorized classroom chunk'
);

-- Ensure chunk for private doc B is never returned to Student A
select extensions.is(
  (
    select count(*)::integer
    from public.internal_search_tutor_chunks(
      '00000000-0000-4000-8000-000000000402',
      current_setting('test.block4_classroom_id')::uuid,
      'Contenido privado',
      ('[' || repeat('0.05,', 1535) || '0.05]')::extensions.vector(1536),
      null,
      'all',
      5
    )
    where document_id = 'd0000000-0000-4000-8000-000000000002'
  ),
  0,
  'Student A never retrieves Student B private chunk'
);

-- Test document selection filtering:
-- When selected_document_ids contains ONLY a non-existent doc, returns 0 chunks
select extensions.is(
  (
    select count(*)::integer
    from public.internal_search_tutor_chunks(
      '00000000-0000-4000-8000-000000000402',
      current_setting('test.block4_classroom_id')::uuid,
      'Newton',
      ('[' || repeat('0.05,', 1535) || '0.05]')::extensions.vector(1536),
      array['00000000-0000-0000-0000-000000000099'::uuid],
      'all',
      5
    )
  ),
  0,
  'Document selection correctly restricts search to selected documents'
);

-- Test document selection filtering:
-- When selected_document_ids contains doc 1, returns classroom chunk
select extensions.is(
  (
    select count(*)::integer
    from public.internal_search_tutor_chunks(
      '00000000-0000-4000-8000-000000000402',
      current_setting('test.block4_classroom_id')::uuid,
      'Newton',
      ('[' || repeat('0.05,', 1535) || '0.05]')::extensions.vector(1536),
      array['d0000000-0000-4000-8000-000000000001'::uuid],
      'all',
      5
    )
    where document_id = 'd0000000-0000-4000-8000-000000000001'
  ),
  1,
  'Document selection returns selected chunk'
);

-- Verify completed usage event metrics

select extensions.is(
  (
    select status
    from public.tutor_usage_events
    where id = current_setting('test.block4_usage_event_id')::uuid
  ),
  'completed',
  'Usage event is recorded as completed'
);

select extensions.is(
  (
    select total_tokens
    from public.tutor_usage_events
    where id = current_setting('test.block4_usage_event_id')::uuid
  ),
  150,
  'Usage event correctly sums total tokens'
);

-- Test admin killswitch
update public.tutor_limits set is_enabled = false where id = 1;

select extensions.throws_ok(
  format(
    'select public.internal_begin_tutor_request(''00000000-0000-4000-8000-000000000402'', %L, ''c0000000-0000-4000-8000-000000000001'', ''strict'', false, 10)',
    current_setting('test.block4_classroom_id')
  ),
  '55P03',
  null,
  'Tutor reservation fails when admin killswitch is enabled'
);

update public.tutor_limits set is_enabled = true where id = 1;

select set_config(
  'test.block4_sample_chunk_id',
  (select id::text from public.document_chunks where document_id = 'd0000000-0000-4000-8000-000000000001' limit 1),
  true
);

-- Test Citation RLS and cascade delete
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000402","role":"authenticated"}';

insert into public.tutor_message_citations (
  id, message_id, document_id, chunk_id, citation_index, page_start, page_end, document_title
)
values (
  'e0000000-0000-4000-8000-000000000001',
  'ba000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  current_setting('test.block4_sample_chunk_id')::bigint,
  1, 14, 14, 'Física I — Mecánica Clásica'
);

select extensions.is(
  (select count(*)::integer from public.tutor_message_citations where id = 'e0000000-0000-4000-8000-000000000001'),
  1,
  'Student A can see own message citation'
);

-- Student B cannot see Student A citation
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000403","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.tutor_message_citations where id = 'e0000000-0000-4000-8000-000000000001'),
  0,
  'Student B cannot see Student A message citation'
);

-- Student A deletes conversation -> cascade removes message and citation
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000402","role":"authenticated"}';

delete from public.tutor_conversations where id = 'c0000000-0000-4000-8000-000000000001';

select extensions.is(
  (select count(*)::integer from public.tutor_conversations where id = 'c0000000-0000-4000-8000-000000000001'),
  0,
  'Conversation deleted by owner'
);

select extensions.is(
  (select count(*)::integer from public.tutor_messages where id = 'ba000000-0000-4000-8000-000000000001'),
  0,
  'Messages cascaded on conversation deletion'
);

select extensions.is(
  (select count(*)::integer from public.tutor_message_citations where id = 'e0000000-0000-4000-8000-000000000001'),
  0,
  'Citations cascaded on message deletion'
);

select * from extensions.finish();

rollback;
