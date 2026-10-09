begin;

create extension if not exists pgtap with schema extensions;

select extensions.no_plan();

select extensions.has_extension('vector', 'pgvector is installed');
select extensions.has_table('public', 'document_processing_jobs', 'processing jobs exist');
select extensions.has_table('public', 'document_chunks', 'document chunks exist');
select extensions.has_table('public', 'rag_limits', 'RAG limits exist');
select extensions.has_table('public', 'rag_search_events', 'RAG usage events exist');

select extensions.is(
  (
    select count(*)::integer
    from pg_catalog.pg_class
    where oid in (
      'public.document_processing_jobs'::regclass,
      'public.document_chunks'::regclass,
      'public.rag_limits'::regclass,
      'public.rag_search_events'::regclass
    )
      and relrowsecurity
  ),
  4,
  'RLS is enabled on every Block 3 public table'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000301', 'authenticated', 'authenticated',
    'teacher.block3@fontex.test', '{"provider":"email","providers":["email"]}',
    '{"display_name":"Docente Bloque 3"}', now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000302', 'authenticated', 'authenticated',
    'student-a.block3@fontex.test', '{"provider":"email","providers":["email"]}',
    '{"display_name":"Estudiante A Bloque 3"}', now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000303', 'authenticated', 'authenticated',
    'student-b.block3@fontex.test', '{"provider":"email","providers":["email"]}',
    '{"display_name":"Estudiante B Bloque 3"}', now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000304', 'authenticated', 'authenticated',
    'outsider.block3@fontex.test', '{"provider":"email","providers":["email"]}',
    '{"display_name":"Persona Ajena Bloque 3"}', now(), now()
  );

insert into private.workspace_bootstrap_authorizations (user_id)
values ('00000000-0000-4000-8000-000000000301');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated"}';

select set_config(
  'test.block3_classroom_id',
  public.create_workspace('Institución Bloque 3', 'Aula RAG', '2026-II')::text,
  true
);

reset role;

insert into public.class_members (classroom_id, user_id, role, status, invited_by)
values
  (
    current_setting('test.block3_classroom_id')::uuid,
    '00000000-0000-4000-8000-000000000302',
    'student', 'active', '00000000-0000-4000-8000-000000000301'
  ),
  (
    current_setting('test.block3_classroom_id')::uuid,
    '00000000-0000-4000-8000-000000000303',
    'student', 'active', '00000000-0000-4000-8000-000000000301'
  );

insert into public.study_groups (id, classroom_id, name, created_by)
values
  (
    '30000000-0000-4000-8000-000000000301',
    current_setting('test.block3_classroom_id')::uuid,
    'Grupo RAG A',
    '00000000-0000-4000-8000-000000000301'
  ),
  (
    '30000000-0000-4000-8000-000000000302',
    current_setting('test.block3_classroom_id')::uuid,
    'Grupo RAG B',
    '00000000-0000-4000-8000-000000000301'
  );

insert into public.group_members (group_id, user_id, added_by)
values
  (
    '30000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000301'
  ),
  (
    '30000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000303',
    '00000000-0000-4000-8000-000000000301'
  );

insert into public.documents (
  id, owner_id, classroom_id, title, original_filename, mime_type,
  size_bytes, page_count, content_sha256, storage_path, status
)
values
  (
    '40000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000302',
    current_setting('test.block3_classroom_id')::uuid,
    'Privado A', 'privado-a.pdf', 'application/pdf', 1000, 1, repeat('a', 64),
    '40000000-0000-4000-8000-000000000301/41000000-0000-4000-8000-000000000301.pdf', 'ready'
  ),
  (
    '40000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000302',
    current_setting('test.block3_classroom_id')::uuid,
    'Grupo A', 'grupo-a.pdf', 'application/pdf', 1000, 1, repeat('b', 64),
    '40000000-0000-4000-8000-000000000302/41000000-0000-4000-8000-000000000302.pdf', 'ready'
  ),
  (
    '40000000-0000-4000-8000-000000000303',
    '00000000-0000-4000-8000-000000000301',
    current_setting('test.block3_classroom_id')::uuid,
    'Material del aula', 'aula.pdf', 'application/pdf', 1000, 1, repeat('c', 64),
    '40000000-0000-4000-8000-000000000303/41000000-0000-4000-8000-000000000303.pdf', 'ready'
  ),
  (
    '40000000-0000-4000-8000-000000000304',
    '00000000-0000-4000-8000-000000000303',
    current_setting('test.block3_classroom_id')::uuid,
    'Privado B', 'privado-b.pdf', 'application/pdf', 1000, 1, repeat('d', 64),
    '40000000-0000-4000-8000-000000000304/41000000-0000-4000-8000-000000000304.pdf', 'ready'
  ),
  (
    '40000000-0000-4000-8000-000000000305',
    '00000000-0000-4000-8000-000000000302',
    current_setting('test.block3_classroom_id')::uuid,
    'Índice parcial', 'parcial.pdf', 'application/pdf', 1000, 1, repeat('e', 64),
    '40000000-0000-4000-8000-000000000305/41000000-0000-4000-8000-000000000305.pdf', 'ready'
  );

insert into public.document_shares (document_id, scope_type, group_id, granted_by)
values (
  '40000000-0000-4000-8000-000000000302', 'group',
  '30000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000302'
);

insert into public.document_shares (document_id, scope_type, classroom_id, granted_by)
values (
  '40000000-0000-4000-8000-000000000303', 'classroom',
  current_setting('test.block3_classroom_id')::uuid,
  '00000000-0000-4000-8000-000000000301'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000302","role":"authenticated"}';

select extensions.lives_ok(
  $$ select public.claim_document_processing('40000000-0000-4000-8000-000000000301') $$,
  'The owner can claim a ready document for processing'
);

select extensions.throws_ok(
  $$ select public.claim_document_processing('40000000-0000-4000-8000-000000000304') $$,
  '42501',
  'ready owned document not found',
  'A user cannot claim another owner document'
);

select extensions.throws_like(
  $$ insert into public.document_chunks (
       document_id, job_id, chunk_index, page_start, page_end, content,
       content_sha256, estimated_tokens, embedding_model, chunk_version
     ) values (
       '40000000-0000-4000-8000-000000000301', gen_random_uuid(), 0, 1, 1,
       'Ataque directo', repeat('f', 64), 3, 'text-embedding-3-small', 'page-paragraph-v1'
     ) $$,
  '%permission denied%',
  'Authenticated clients cannot insert chunks directly'
);

select extensions.throws_like(
  $$ select * from public.internal_search_document_chunks(
       '00000000-0000-4000-8000-000000000302',
       gen_random_uuid(),
       'consulta manipulada',
       ('[' || '1,' || repeat('0,', 1534) || '0]')::extensions.vector(1536),
       'all', 10, 'text-embedding-3-small'
     ) $$,
  '%permission denied%',
  'Authenticated clients cannot invoke the internal retrieval RPC directly'
);

reset role;

delete from public.document_processing_jobs
where document_id = '40000000-0000-4000-8000-000000000301';

insert into public.document_processing_jobs (
  id, document_id, owner_id, status, phase, extracted_pages, extracted_characters,
  chunk_count, embedded_chunk_count, embedding_tokens, attempt_count, started_at, completed_at
)
values
  (
    '50000000-0000-4000-8000-000000000301', '40000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000302', 'ready', 'complete', 1, 40, 1, 1, 10, 1, now(), now()
  ),
  (
    '50000000-0000-4000-8000-000000000302', '40000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000302', 'ready', 'complete', 1, 40, 1, 1, 10, 1, now(), now()
  ),
  (
    '50000000-0000-4000-8000-000000000303', '40000000-0000-4000-8000-000000000303',
    '00000000-0000-4000-8000-000000000301', 'ready', 'complete', 1, 40, 1, 1, 10, 1, now(), now()
  ),
  (
    '50000000-0000-4000-8000-000000000304', '40000000-0000-4000-8000-000000000304',
    '00000000-0000-4000-8000-000000000303', 'ready', 'complete', 1, 40, 1, 1, 10, 1, now(), now()
  ),
  (
    '50000000-0000-4000-8000-000000000305', '40000000-0000-4000-8000-000000000305',
    '00000000-0000-4000-8000-000000000302', 'pending', 'embedding', 1, 40, 1, 0, 0, 1, now(), null
  );

insert into public.document_chunks (
  document_id, job_id, chunk_index, page_start, page_end, content,
  content_sha256, estimated_tokens, embedding, embedding_model, chunk_version, embedded_at
)
values
  (
    '40000000-0000-4000-8000-000000000301', '50000000-0000-4000-8000-000000000301', 0, 1, 1,
    'La fotosíntesis privada usa clorofila.', repeat('1', 64), 10,
    ('[' || '1,' || repeat('0,', 1534) || '0]')::extensions.vector(1536),
    'text-embedding-3-small', 'page-paragraph-v1', now()
  ),
  (
    '40000000-0000-4000-8000-000000000302', '50000000-0000-4000-8000-000000000302', 0, 1, 1,
    'El grupo A estudia ATP y energía celular.', repeat('2', 64), 10,
    ('[' || '0.95,0.05,' || repeat('0,', 1533) || '0]')::extensions.vector(1536),
    'text-embedding-3-small', 'page-paragraph-v1', now()
  ),
  (
    '40000000-0000-4000-8000-000000000303', '50000000-0000-4000-8000-000000000303', 0, 1, 1,
    'El aula comparte mitosis y ADN.', repeat('3', 64), 10,
    ('[' || '0.9,0.1,' || repeat('0,', 1533) || '0]')::extensions.vector(1536),
    'text-embedding-3-small', 'page-paragraph-v1', now()
  ),
  (
    '40000000-0000-4000-8000-000000000304', '50000000-0000-4000-8000-000000000304', 0, 1, 1,
    'Contenido secreto del estudiante B.', repeat('4', 64), 10,
    ('[' || '1,' || repeat('0,', 1534) || '0]')::extensions.vector(1536),
    'text-embedding-3-small', 'page-paragraph-v1', now()
  ),
  (
    '40000000-0000-4000-8000-000000000305', '50000000-0000-4000-8000-000000000305', 0, 1, 1,
    'Este fragmento aún no está embebido.', repeat('5', 64), 10,
    null, 'text-embedding-3-small', 'page-paragraph-v1', null
  );

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-000000000303","role":"authenticated"}';

select extensions.is(
  (select count(*)::integer from public.document_processing_jobs),
  2,
  'A user sees only their own job and ready classroom-shared jobs'
);

select extensions.throws_like(
  $$ select * from public.document_chunks $$,
  '%permission denied%',
  'Even authorized users cannot read raw chunks directly'
);

reset role;
set local role service_role;

select set_config(
  'test.block3_search_event',
  public.internal_begin_rag_search(
    '00000000-0000-4000-8000-000000000302', 'all', 28, 'text-embedding-3-small'
  )::text,
  true
);

select extensions.is(
  (
    select count(*)::integer
    from public.internal_search_document_chunks(
      '00000000-0000-4000-8000-000000000302',
      current_setting('test.block3_search_event')::uuid,
      'energía celular fotosíntesis',
      ('[' || '1,' || repeat('0,', 1534) || '0]')::extensions.vector(1536),
      'all', 10, 'text-embedding-3-small'
    )
  ),
  3,
  'Hybrid retrieval returns only private, group and classroom documents authorized for Student A'
);

select set_config(
  'test.block3_search_event',
  public.internal_begin_rag_search(
    '00000000-0000-4000-8000-000000000302', 'private', 28, 'text-embedding-3-small'
  )::text,
  true
);

select extensions.is(
  (
    select count(*)::integer
    from public.internal_search_document_chunks(
      '00000000-0000-4000-8000-000000000302',
      current_setting('test.block3_search_event')::uuid,
      'energía celular fotosíntesis',
      ('[' || '1,' || repeat('0,', 1534) || '0]')::extensions.vector(1536),
      'private', 10, 'text-embedding-3-small'
    )
  ),
  1,
  'Private scope cannot be manipulated to include shared documents'
);

select set_config(
  'test.block3_search_event',
  public.internal_begin_rag_search(
    '00000000-0000-4000-8000-000000000304', 'all', 28, 'text-embedding-3-small'
  )::text,
  true
);

select extensions.is(
  (
    select count(*)::integer
    from public.internal_search_document_chunks(
      '00000000-0000-4000-8000-000000000304',
      current_setting('test.block3_search_event')::uuid,
      'energía celular fotosíntesis',
      ('[' || '1,' || repeat('0,', 1534) || '0]')::extensions.vector(1536),
      'all', 10, 'text-embedding-3-small'
    )
  ),
  0,
  'An outsider cannot retrieve any chunk even through the service-only RPC'
);

reset role;
delete from public.document_shares
where document_id = '40000000-0000-4000-8000-000000000302';

set local role service_role;
select set_config(
  'test.block3_search_event',
  public.internal_begin_rag_search(
    '00000000-0000-4000-8000-000000000302', 'group', 19, 'text-embedding-3-small'
  )::text,
  true
);
select extensions.is(
  (
    select count(*)::integer
    from public.internal_search_document_chunks(
      '00000000-0000-4000-8000-000000000302',
      current_setting('test.block3_search_event')::uuid,
      'ATP energía celular',
      ('[' || '1,' || repeat('0,', 1534) || '0]')::extensions.vector(1536),
      'group', 10, 'text-embedding-3-small'
    )
  ),
  0,
  'Revoking a group share removes its chunks from future retrieval'
);

reset role;
update public.rag_limits set max_searches_per_hour = 3 where id = 1;
set local role service_role;

select extensions.throws_ok(
  $$ select public.internal_begin_rag_search(
       '00000000-0000-4000-8000-000000000302', 'all', 19, 'text-embedding-3-small'
     ) $$,
  '54000',
  'hourly RAG search limit exceeded',
  'The rate limit is reserved before a provider embedding can be requested'
);

select extensions.is(
  (
    select count(*)::integer
    from public.rag_search_events
    where completed_at is null
  ),
  0,
  'Successful diagnostic searches finalize their usage metrics'
);

select * from extensions.finish();
rollback;
