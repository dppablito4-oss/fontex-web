begin;

create extension if not exists vector with schema extensions;

create type public.document_processing_status as enum ('pending', 'processing', 'ready', 'failed');
create type public.document_processing_phase as enum ('extracting', 'embedding', 'complete');

create table public.rag_limits (
  id smallint primary key default 1 check (id = 1),
  max_extracted_characters integer not null check (max_extracted_characters between 10000 and 1000000),
  max_chunks_per_document integer not null check (max_chunks_per_document between 1 and 1000),
  max_embedding_tokens_per_document integer not null check (max_embedding_tokens_per_document between 1000 and 250000),
  target_chunk_tokens integer not null check (target_chunk_tokens between 100 and 2000),
  chunk_overlap_tokens integer not null check (chunk_overlap_tokens between 0 and target_chunk_tokens / 2),
  embedding_batch_size integer not null check (embedding_batch_size between 1 and 64),
  max_concurrent_jobs_per_user integer not null check (max_concurrent_jobs_per_user between 1 and 5),
  max_processing_failures integer not null check (max_processing_failures between 1 and 10),
  processing_lease_seconds integer not null check (processing_lease_seconds between 30 and 300),
  max_search_results integer not null check (max_search_results between 1 and 20),
  max_searches_per_hour integer not null check (max_searches_per_hour between 1 and 500),
  updated_at timestamptz not null default now()
);

insert into public.rag_limits (
  max_extracted_characters,
  max_chunks_per_document,
  max_embedding_tokens_per_document,
  target_chunk_tokens,
  chunk_overlap_tokens,
  embedding_batch_size,
  max_concurrent_jobs_per_user,
  max_processing_failures,
  processing_lease_seconds,
  max_search_results,
  max_searches_per_hour
)
values (400000, 240, 100000, 600, 100, 16, 1, 3, 150, 10, 60);

create table public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  status public.document_processing_status not null default 'pending',
  phase public.document_processing_phase not null default 'extracting',
  embedding_model text not null default 'text-embedding-3-small' check (char_length(embedding_model) between 1 and 100),
  embedding_dimensions integer not null default 1536 check (embedding_dimensions = 1536),
  chunk_version text not null default 'page-paragraph-v1' check (char_length(chunk_version) between 1 and 80),
  extracted_pages integer not null default 0 check (extracted_pages between 0 and 100),
  extracted_characters integer not null default 0 check (extracted_characters between 0 and 1000000),
  chunk_count integer not null default 0 check (chunk_count between 0 and 1000),
  embedded_chunk_count integer not null default 0 check (embedded_chunk_count between 0 and chunk_count),
  embedding_tokens integer not null default 0 check (embedding_tokens between 0 and 250000),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  failure_count integer not null default 0 check (failure_count between 0 and 10),
  failure_code text check (failure_code is null or char_length(failure_code) between 1 and 80),
  failure_detail text check (failure_detail is null or char_length(failure_detail) between 1 and 240),
  lease_token uuid,
  locked_until timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lease_token is null) = (locked_until is null)),
  check (status <> 'processing' or (lease_token is not null and locked_until is not null)),
  check (status <> 'ready' or (phase = 'complete' and embedded_chunk_count = chunk_count and chunk_count > 0)),
  check (phase <> 'complete' or status = 'ready')
);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  job_id uuid not null references public.document_processing_jobs (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  page_start integer not null check (page_start between 1 and 100),
  page_end integer not null check (page_end between page_start and 100),
  content text not null check (content = btrim(content) and char_length(content) between 1 and 20000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  estimated_tokens integer not null check (estimated_tokens between 1 and 5000),
  embedding extensions.vector(1536),
  embedding_model text not null check (char_length(embedding_model) between 1 and 100),
  chunk_version text not null check (char_length(chunk_version) between 1 and 80),
  search_vector tsvector generated always as (
    pg_catalog.to_tsvector('spanish', content) || pg_catalog.to_tsvector('simple', content)
  ) stored,
  created_at timestamptz not null default now(),
  embedded_at timestamptz,
  unique (document_id, chunk_version, chunk_index),
  check ((embedding is null) = (embedded_at is null))
);

create table public.rag_search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null check (scope in ('all', 'private', 'group', 'classroom')),
  query_characters integer not null check (query_characters between 1 and 500),
  embedding_model text not null check (char_length(embedding_model) between 1 and 100),
  embedding_tokens integer not null default 0 check (embedding_tokens between 0 and 8192),
  result_count integer not null default 0 check (result_count between 0 and 20),
  latency_ms integer check (latency_ms is null or latency_ms between 0 and 600000),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index document_processing_jobs_owner_status_idx
  on public.document_processing_jobs (owner_id, status, updated_at desc);
create index document_chunks_document_job_idx
  on public.document_chunks (document_id, job_id, chunk_index);
create index document_chunks_pending_embedding_idx
  on public.document_chunks (job_id, chunk_index)
  where embedding is null;
create index document_chunks_search_vector_idx
  on public.document_chunks using gin (search_vector);
create index rag_search_events_user_created_idx
  on public.rag_search_events (user_id, created_at desc);

create trigger rag_limits_set_updated_at
before update on public.rag_limits
for each row execute function private.set_updated_at();

create trigger document_processing_jobs_set_updated_at
before update on public.document_processing_jobs
for each row execute function private.set_updated_at();

create or replace function private.can_user_access_document(
  requesting_user_id uuid,
  target_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requesting_user_id is not null and exists (
    select 1
    from public.documents document
    where document.id = target_document_id
      and (
        document.owner_id = requesting_user_id
        or (
          document.status = 'ready'
          and exists (
            select 1
            from public.document_shares share
            join public.class_members membership
              on membership.classroom_id = document.classroom_id
             and membership.user_id = requesting_user_id
             and membership.status = 'active'
            where share.document_id = document.id
              and (
                (
                  share.scope_type = 'classroom'
                  and share.classroom_id = document.classroom_id
                )
                or (
                  share.scope_type = 'group'
                  and exists (
                    select 1
                    from public.study_groups study_group
                    join public.group_members group_membership
                      on group_membership.group_id = study_group.id
                     and group_membership.user_id = requesting_user_id
                    where study_group.id = share.group_id
                      and study_group.classroom_id = document.classroom_id
                  )
                )
              )
          )
        )
      )
  );
$$;

create or replace function public.claim_document_processing(target_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user_id uuid := auth.uid();
  document_record public.documents%rowtype;
  limits public.rag_limits%rowtype;
  job_record public.document_processing_jobs%rowtype;
  next_lease uuid;
begin
  if requesting_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into document_record
  from public.documents
  where id = target_document_id
    and owner_id = requesting_user_id
    and status = 'ready';

  if not found then
    raise exception 'ready owned document not found' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requesting_user_id::text, 37));
  select * into limits from public.rag_limits where id = 1;

  select * into job_record
  from public.document_processing_jobs
  where document_id = target_document_id
  for update;

  if found and job_record.status = 'ready' then
    return jsonb_build_object(
      'job_id', job_record.id,
      'document_id', target_document_id,
      'status', job_record.status,
      'phase', job_record.phase,
      'ready', true,
      'lease_token', null
    );
  end if;

  if found and job_record.status = 'processing' and job_record.locked_until > now() then
    raise exception 'document processing is already active' using errcode = '55P03';
  end if;

  if found and job_record.failure_count >= limits.max_processing_failures then
    raise exception 'document processing retry limit exceeded' using errcode = '54000';
  end if;

  if (
    select count(*)
    from public.document_processing_jobs active_job
    where active_job.owner_id = requesting_user_id
      and active_job.status = 'processing'
      and active_job.locked_until > now()
      and active_job.document_id <> target_document_id
  ) >= limits.max_concurrent_jobs_per_user then
    raise exception 'concurrent document processing limit exceeded' using errcode = '54000';
  end if;

  if job_record.id is null then
    insert into public.document_processing_jobs (document_id, owner_id)
    values (target_document_id, requesting_user_id)
    returning * into job_record;
  end if;

  next_lease := gen_random_uuid();
  update public.document_processing_jobs
  set status = 'processing',
      lease_token = next_lease,
      locked_until = now() + pg_catalog.make_interval(secs => limits.processing_lease_seconds),
      attempt_count = attempt_count + 1,
      failure_code = null,
      failure_detail = null,
      started_at = coalesce(started_at, now()),
      completed_at = null
  where id = job_record.id
  returning * into job_record;

  return jsonb_build_object(
    'job_id', job_record.id,
    'document_id', document_record.id,
    'status', job_record.status,
    'phase', job_record.phase,
    'ready', false,
    'lease_token', next_lease,
    'storage_path', document_record.storage_path,
    'content_sha256', document_record.content_sha256,
    'expected_pages', document_record.page_count,
    'embedding_model', job_record.embedding_model,
    'embedding_dimensions', job_record.embedding_dimensions,
    'chunk_version', job_record.chunk_version,
    'max_extracted_characters', limits.max_extracted_characters,
    'max_chunks_per_document', limits.max_chunks_per_document,
    'max_embedding_tokens_per_document', limits.max_embedding_tokens_per_document,
    'target_chunk_tokens', limits.target_chunk_tokens,
    'chunk_overlap_tokens', limits.chunk_overlap_tokens,
    'embedding_batch_size', limits.embedding_batch_size
  );
end;
$$;

create or replace function public.internal_store_extracted_chunks(
  target_job_id uuid,
  target_lease_token uuid,
  actual_page_count integer,
  chunks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.document_processing_jobs%rowtype;
  document_record public.documents%rowtype;
  limits public.rag_limits%rowtype;
  chunk_record jsonb;
  total_characters integer;
  total_estimated_tokens integer;
  chunk_total integer;
begin
  select * into job_record
  from public.document_processing_jobs
  where id = target_job_id
    and status = 'processing'
    and phase = 'extracting'
    and lease_token = target_lease_token
    and locked_until >= now()
  for update;

  if not found then
    raise exception 'active extraction lease not found' using errcode = '55P03';
  end if;

  select * into document_record
  from public.documents
  where id = job_record.document_id
    and owner_id = job_record.owner_id
    and status = 'ready';
  if not found then
    raise exception 'ready processing document not found' using errcode = '42501';
  end if;

  select * into limits from public.rag_limits where id = 1;
  if actual_page_count <> document_record.page_count then
    raise exception 'server page count does not match upload metadata' using errcode = '22000';
  end if;
  if jsonb_typeof(chunks) <> 'array' or jsonb_array_length(chunks) < 1 then
    raise exception 'at least one extracted chunk is required' using errcode = '22023';
  end if;

  chunk_total := jsonb_array_length(chunks);
  select
    coalesce(sum(char_length(value->>'content')), 0)::integer,
    coalesce(sum((value->>'estimated_tokens')::integer), 0)::integer
  into total_characters, total_estimated_tokens
  from jsonb_array_elements(chunks);

  if chunk_total > limits.max_chunks_per_document
    or total_characters > limits.max_extracted_characters
    or total_estimated_tokens > limits.max_embedding_tokens_per_document then
    raise exception 'extracted document exceeds RAG limits' using errcode = '54000';
  end if;

  delete from public.document_chunks where job_id = job_record.id;

  for chunk_record in select value from jsonb_array_elements(chunks)
  loop
    insert into public.document_chunks (
      document_id,
      job_id,
      chunk_index,
      page_start,
      page_end,
      content,
      content_sha256,
      estimated_tokens,
      embedding_model,
      chunk_version
    ) values (
      document_record.id,
      job_record.id,
      (chunk_record->>'chunk_index')::integer,
      (chunk_record->>'page_start')::integer,
      (chunk_record->>'page_end')::integer,
      chunk_record->>'content',
      chunk_record->>'content_sha256',
      (chunk_record->>'estimated_tokens')::integer,
      job_record.embedding_model,
      job_record.chunk_version
    );
  end loop;

  update public.document_processing_jobs
  set phase = 'embedding',
      extracted_pages = actual_page_count,
      extracted_characters = total_characters,
      chunk_count = chunk_total,
      embedded_chunk_count = 0,
      embedding_tokens = 0
  where id = job_record.id;

  return jsonb_build_object(
    'job_id', job_record.id,
    'phase', 'embedding',
    'chunk_count', chunk_total,
    'estimated_tokens', total_estimated_tokens
  );
end;
$$;

create or replace function public.internal_store_chunk_embeddings(
  target_job_id uuid,
  target_lease_token uuid,
  embeddings jsonb,
  batch_embedding_tokens integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.document_processing_jobs%rowtype;
  limits public.rag_limits%rowtype;
  embedding_record jsonb;
  updated_rows integer := 0;
  affected_rows integer;
  embedded_total integer;
  next_status public.document_processing_status;
begin
  select * into job_record
  from public.document_processing_jobs
  where id = target_job_id
    and status = 'processing'
    and phase = 'embedding'
    and lease_token = target_lease_token
    and locked_until >= now()
  for update;

  if not found then
    raise exception 'active embedding lease not found' using errcode = '55P03';
  end if;

  select * into limits from public.rag_limits where id = 1;
  if jsonb_typeof(embeddings) <> 'array'
    or jsonb_array_length(embeddings) < 1
    or jsonb_array_length(embeddings) > limits.embedding_batch_size then
    raise exception 'invalid embedding batch size' using errcode = '22023';
  end if;
  if batch_embedding_tokens < 1
    or job_record.embedding_tokens + batch_embedding_tokens > limits.max_embedding_tokens_per_document then
    raise exception 'embedding token budget exceeded' using errcode = '54000';
  end if;

  for embedding_record in select value from jsonb_array_elements(embeddings)
  loop
    update public.document_chunks
    set embedding = (embedding_record->'embedding')::text::extensions.vector(1536),
        embedded_at = now()
    where id = (embedding_record->>'chunk_id')::bigint
      and job_id = job_record.id
      and embedding is null;
    get diagnostics affected_rows = row_count;
    updated_rows := updated_rows + affected_rows;
  end loop;

  if updated_rows <> jsonb_array_length(embeddings) then
    raise exception 'embedding batch contains stale or foreign chunks' using errcode = '22000';
  end if;

  select count(*)::integer into embedded_total
  from public.document_chunks
  where job_id = job_record.id
    and embedding is not null;

  if embedded_total = job_record.chunk_count then
    next_status := 'ready';
    update public.document_processing_jobs
    set status = 'ready',
        phase = 'complete',
        embedded_chunk_count = embedded_total,
        embedding_tokens = embedding_tokens + batch_embedding_tokens,
        lease_token = null,
        locked_until = null,
        completed_at = now()
    where id = job_record.id;
  else
    next_status := 'pending';
    update public.document_processing_jobs
    set status = 'pending',
        embedded_chunk_count = embedded_total,
        embedding_tokens = embedding_tokens + batch_embedding_tokens,
        lease_token = null,
        locked_until = null
    where id = job_record.id;
  end if;

  return jsonb_build_object(
    'job_id', job_record.id,
    'status', next_status,
    'phase', case when next_status = 'ready' then 'complete' else 'embedding' end,
    'chunk_count', job_record.chunk_count,
    'embedded_chunk_count', embedded_total,
    'complete', next_status = 'ready'
  );
end;
$$;

create or replace function public.internal_fail_document_processing(
  target_job_id uuid,
  target_lease_token uuid,
  target_failure_code text,
  target_failure_detail text,
  permanent_failure boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits public.rag_limits%rowtype;
begin
  select * into limits from public.rag_limits where id = 1;
  update public.document_processing_jobs
  set status = 'failed',
      failure_count = case
        when permanent_failure then limits.max_processing_failures
        else least(failure_count + 1, limits.max_processing_failures)
      end,
      failure_code = left(coalesce(nullif(btrim(target_failure_code), ''), 'processing_failed'), 80),
      failure_detail = left(coalesce(nullif(btrim(target_failure_detail), ''), 'Processing failed.'), 240),
      lease_token = null,
      locked_until = null
  where id = target_job_id
    and status = 'processing'
    and lease_token = target_lease_token;

  if not found then
    raise exception 'active processing lease not found' using errcode = '55P03';
  end if;
end;
$$;

create or replace function public.internal_begin_rag_search(
  requesting_user_id uuid,
  requested_scope text,
  query_characters integer,
  requested_embedding_model text default 'text-embedding-3-small'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits public.rag_limits%rowtype;
  search_event_id uuid;
begin
  if requesting_user_id is null or not exists (
    select 1 from public.profiles where id = requesting_user_id
  ) then
    raise exception 'valid requesting user required' using errcode = '42501';
  end if;
  if requested_scope not in ('all', 'private', 'group', 'classroom')
    or query_characters not between 3 and 500
    or requested_embedding_model <> 'text-embedding-3-small' then
    raise exception 'invalid search reservation' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requesting_user_id::text, 73));
  select * into limits from public.rag_limits where id = 1;
  if (
    select count(*)
    from public.rag_search_events event
    where event.user_id = requesting_user_id
      and event.created_at >= now() - interval '1 hour'
  ) >= limits.max_searches_per_hour then
    raise exception 'hourly RAG search limit exceeded' using errcode = '54000';
  end if;

  delete from public.rag_search_events event
  where event.user_id = requesting_user_id
    and event.created_at < now() - interval '7 days';

  insert into public.rag_search_events (
    user_id, scope, query_characters, embedding_model
  ) values (
    requesting_user_id, requested_scope, query_characters, requested_embedding_model
  ) returning id into search_event_id;

  return search_event_id;
end;
$$;

create or replace function public.internal_search_document_chunks(
  requesting_user_id uuid,
  search_event_id uuid,
  search_query text,
  query_embedding extensions.vector(1536),
  requested_scope text default 'all',
  requested_match_count integer default 5,
  requested_embedding_model text default 'text-embedding-3-small',
  query_embedding_tokens integer default 0,
  embedding_latency_ms integer default null
)
returns table (
  chunk_id bigint,
  document_id uuid,
  document_title text,
  page_start integer,
  page_end integer,
  content text,
  semantic_similarity real,
  lexical_rank real,
  combined_score real
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits public.rag_limits%rowtype;
  effective_count integer;
  normalized_query text := btrim(search_query);
  returned_rows integer;
begin
  if requesting_user_id is null or not exists (
    select 1 from public.profiles where id = requesting_user_id
  ) then
    raise exception 'valid requesting user required' using errcode = '42501';
  end if;
  if normalized_query is null or char_length(normalized_query) not between 3 and 500 then
    raise exception 'search query must contain between 3 and 500 characters' using errcode = '22023';
  end if;
  if requested_scope not in ('all', 'private', 'group', 'classroom') then
    raise exception 'invalid search scope' using errcode = '22023';
  end if;
  if requested_embedding_model <> 'text-embedding-3-small' then
    raise exception 'unsupported embedding model' using errcode = '22023';
  end if;
  if query_embedding_tokens < 0 or query_embedding_tokens > 8192
    or (embedding_latency_ms is not null and embedding_latency_ms not between 0 and 600000) then
    raise exception 'invalid search metrics' using errcode = '22023';
  end if;

  select * into limits from public.rag_limits where id = 1;
  perform 1
  from public.rag_search_events event
  where event.id = search_event_id
    and event.user_id = requesting_user_id
    and event.scope = requested_scope
    and event.query_characters = char_length(normalized_query)
    and event.embedding_model = requested_embedding_model
    and event.completed_at is null
    and event.created_at >= now() - interval '5 minutes'
  for update;
  if not found then
    raise exception 'valid search reservation required' using errcode = '42501';
  end if;

  effective_count := least(greatest(coalesce(requested_match_count, 5), 1), limits.max_search_results);

  return query
  with eligible as materialized (
    select
      chunk.id,
      chunk.document_id,
      document.title,
      chunk.page_start,
      chunk.page_end,
      chunk.content,
      chunk.search_vector,
      chunk.embedding,
      (chunk.embedding operator(extensions.<=>) query_embedding) as semantic_distance
    from public.document_chunks chunk
    join public.document_processing_jobs job
      on job.id = chunk.job_id
     and job.document_id = chunk.document_id
    join public.documents document on document.id = chunk.document_id
    where chunk.embedding is not null
      and chunk.embedding_model = requested_embedding_model
      and job.status = 'ready'
      and job.phase = 'complete'
      and job.embedding_model = requested_embedding_model
      and private.can_user_access_document(requesting_user_id, document.id)
      and (
        requested_scope = 'all'
        or (
          requested_scope = 'private'
          and document.owner_id = requesting_user_id
          and not exists (
            select 1
            from public.document_shares share
            where share.document_id = document.id
          )
        )
        or (
          requested_scope = 'classroom'
          and exists (
            select 1
            from public.document_shares share
            join public.class_members membership
              on membership.classroom_id = document.classroom_id
             and membership.user_id = requesting_user_id
             and membership.status = 'active'
            where share.document_id = document.id
              and share.scope_type = 'classroom'
              and share.classroom_id = document.classroom_id
          )
        )
        or (
          requested_scope = 'group'
          and exists (
            select 1
            from public.document_shares share
            join public.study_groups study_group
              on study_group.id = share.group_id
             and study_group.classroom_id = document.classroom_id
            join public.group_members membership
              on membership.group_id = study_group.id
             and membership.user_id = requesting_user_id
            join public.class_members class_membership
              on class_membership.classroom_id = document.classroom_id
             and class_membership.user_id = requesting_user_id
             and class_membership.status = 'active'
            where share.document_id = document.id
              and share.scope_type = 'group'
          )
        )
      )
  ),
  semantic as (
    select
      eligible.id,
      row_number() over (order by eligible.semantic_distance, eligible.id) as rank,
      (1 - eligible.semantic_distance)::real as similarity
    from eligible
    order by eligible.semantic_distance, eligible.id
    limit effective_count * 4
  ),
  lexical as (
    select
      eligible.id,
      row_number() over (
        order by pg_catalog.ts_rank_cd(
          eligible.search_vector,
          pg_catalog.websearch_to_tsquery('spanish', normalized_query)
            || pg_catalog.websearch_to_tsquery('simple', normalized_query)
        ) desc,
        eligible.id
      ) as rank,
      pg_catalog.ts_rank_cd(
        eligible.search_vector,
        pg_catalog.websearch_to_tsquery('spanish', normalized_query)
          || pg_catalog.websearch_to_tsquery('simple', normalized_query)
      )::real as score
    from eligible
    where eligible.search_vector @@ (
      pg_catalog.websearch_to_tsquery('spanish', normalized_query)
        || pg_catalog.websearch_to_tsquery('simple', normalized_query)
    )
    order by score desc, eligible.id
    limit effective_count * 4
  ),
  fused as (
    select
      coalesce(semantic.id, lexical.id) as id,
      semantic.similarity,
      coalesce(lexical.score, 0::real) as lexical_score,
      (
        coalesce(0.65 / (60 + semantic.rank), 0)
        + coalesce(0.35 / (60 + lexical.rank), 0)
      )::real as score
    from semantic
    full join lexical on lexical.id = semantic.id
  )
  select
    eligible.id,
    eligible.document_id,
    eligible.title,
    eligible.page_start,
    eligible.page_end,
    eligible.content,
    coalesce(fused.similarity, 0::real),
    fused.lexical_score,
    fused.score
  from fused
  join eligible on eligible.id = fused.id
  order by fused.score desc, eligible.id
  limit effective_count;

  get diagnostics returned_rows = row_count;
  update public.rag_search_events
  set embedding_tokens = query_embedding_tokens,
      latency_ms = embedding_latency_ms,
      result_count = returned_rows,
      completed_at = now()
  where id = search_event_id;
end;
$$;

alter table public.rag_limits enable row level security;
alter table public.document_processing_jobs enable row level security;
alter table public.document_chunks enable row level security;
alter table public.rag_search_events enable row level security;

revoke all on table public.rag_limits from anon, authenticated;
revoke all on table public.document_processing_jobs from anon, authenticated;
revoke all on table public.document_chunks from anon, authenticated;
revoke all on table public.rag_search_events from anon, authenticated;

grant select on table public.rag_limits to authenticated;
grant select on table public.document_processing_jobs to authenticated;

create policy rag_limits_select_authenticated
on public.rag_limits for select
to authenticated
using (true);

create policy document_processing_jobs_select_authorized
on public.document_processing_jobs for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (
    status = 'ready'
    and (select private.can_access_document(document_id))
  )
);

revoke all on function private.can_user_access_document(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_document_processing(uuid) from public, anon;
grant execute on function public.claim_document_processing(uuid) to authenticated;
revoke all on function public.internal_store_extracted_chunks(uuid, uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.internal_store_extracted_chunks(uuid, uuid, integer, jsonb)
  to service_role;
revoke all on function public.internal_store_chunk_embeddings(uuid, uuid, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.internal_store_chunk_embeddings(uuid, uuid, jsonb, integer)
  to service_role;
revoke all on function public.internal_fail_document_processing(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.internal_fail_document_processing(uuid, uuid, text, text, boolean)
  to service_role;
revoke all on function public.internal_begin_rag_search(uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.internal_begin_rag_search(uuid, text, integer, text)
  to service_role;
revoke all on function public.internal_search_document_chunks(uuid, uuid, text, extensions.vector, text, integer, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.internal_search_document_chunks(uuid, uuid, text, extensions.vector, text, integer, text, integer, integer)
  to service_role;

commit;
