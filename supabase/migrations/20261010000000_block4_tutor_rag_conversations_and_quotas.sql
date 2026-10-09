-- Block 4: Academic Tutor RAG Integration, Conversational History, and Quotas
-- Migration: 20261010000000_block4_tutor_rag_conversations_and_quotas.sql

create table if not exists public.tutor_limits (
  id integer primary key check (id = 1),
  is_enabled boolean not null default true,
  max_queries_per_user_per_hour integer not null default 30 check (max_queries_per_user_per_hour between 1 and 500),
  max_queries_per_user_per_day integer not null default 150 check (max_queries_per_user_per_day between 1 and 2000),
  max_global_queries_per_day integer not null default 2000 check (max_global_queries_per_day between 10 and 50000),
  max_retrieved_chunks integer not null default 5 check (max_retrieved_chunks between 1 and 20),
  max_input_tokens integer not null default 8000 check (max_input_tokens between 500 and 32000),
  max_output_tokens integer not null default 1500 check (max_output_tokens between 100 and 8000),
  max_concurrent_requests_per_user integer not null default 1 check (max_concurrent_requests_per_user between 1 and 5),
  default_model text not null default 'gpt-6-astra' check (char_length(btrim(default_model)) between 2 and 60),
  reasoning_effort text not null default 'low' check (reasoning_effort in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tutor_limits enable row level security;

insert into public.tutor_limits (id)
values (1)
on conflict (id) do nothing;

create policy tutor_limits_select_authenticated
  on public.tutor_limits
  for select
  to authenticated
  using (true);

-- Conversations table
create table if not exists public.tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  mode text not null default 'strict' check (mode in ('strict', 'comparative')),
  guided boolean not null default false,
  selected_document_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tutor_conversations enable row level security;

create index if not exists tutor_conversations_user_classroom_idx
  on public.tutor_conversations (user_id, classroom_id, updated_at desc);

create policy tutor_conversations_select_owner
  on public.tutor_conversations
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy tutor_conversations_insert_owner
  on public.tutor_conversations
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      exists (
        select 1
        from public.class_members cm
        where cm.classroom_id = tutor_conversations.classroom_id
          and cm.user_id = auth.uid()
          and cm.status = 'active'
      )
      or exists (
        select 1
        from public.classrooms c
        where c.id = tutor_conversations.classroom_id
          and c.owner_id = auth.uid()
      )
    )
  );

create policy tutor_conversations_update_owner
  on public.tutor_conversations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tutor_conversations_delete_owner
  on public.tutor_conversations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Messages table
create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tutor_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) > 0),
  model text,
  metadata jsonb not null default '{}'::jsonb,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tutor_messages enable row level security;

create index if not exists tutor_messages_conversation_idx
  on public.tutor_messages (conversation_id, order_index asc, created_at asc);

create index if not exists tutor_messages_user_idx
  on public.tutor_messages (user_id);

create policy tutor_messages_select_owner
  on public.tutor_messages
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.tutor_conversations conv
      where conv.id = tutor_messages.conversation_id
        and conv.user_id = auth.uid()
    )
  );

create policy tutor_messages_insert_owner
  on public.tutor_messages
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.tutor_conversations conv
      where conv.id = tutor_messages.conversation_id
        and conv.user_id = auth.uid()
    )
  );

create policy tutor_messages_delete_owner
  on public.tutor_messages
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.tutor_conversations conv
      where conv.id = tutor_messages.conversation_id
        and conv.user_id = auth.uid()
    )
  );

-- Citations table
create table if not exists public.tutor_message_citations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.tutor_messages(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_id bigint not null references public.document_chunks(id) on delete cascade,
  citation_index integer not null default 1 check (citation_index >= 1),
  page_start integer not null check (page_start >= 1),
  page_end integer not null check (page_end >= page_start),
  document_title text not null,
  document_version text,
  created_at timestamptz not null default now()
);

alter table public.tutor_message_citations enable row level security;

create index if not exists tutor_message_citations_message_idx
  on public.tutor_message_citations (message_id, citation_index asc);

create index if not exists tutor_message_citations_document_idx
  on public.tutor_message_citations (document_id);

create policy tutor_message_citations_select_owner
  on public.tutor_message_citations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tutor_messages msg
      join public.tutor_conversations conv on conv.id = msg.conversation_id
      where msg.id = tutor_message_citations.message_id
        and conv.user_id = auth.uid()
    )
  );

create policy tutor_message_citations_insert_owner
  on public.tutor_message_citations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tutor_messages msg
      join public.tutor_conversations conv on conv.id = msg.conversation_id
      where msg.id = tutor_message_citations.message_id
        and conv.user_id = auth.uid()
    )
  );

-- Usage accounting & quota events
create table if not exists public.tutor_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  conversation_id uuid references public.tutor_conversations(id) on delete set null,
  mode text not null check (mode in ('strict', 'comparative')),
  guided boolean not null default false,
  query_characters integer not null check (query_characters >= 1),
  retrieved_chunks_count integer not null default 0,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  reasoning_tokens integer not null default 0,
  total_tokens integer not null default 0,
  latency_ms integer,
  status text not null check (status in ('active', 'completed', 'failed')),
  error_code text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.tutor_usage_events enable row level security;

create index if not exists tutor_usage_events_user_idx
  on public.tutor_usage_events (user_id, created_at desc);

create index if not exists tutor_usage_events_classroom_idx
  on public.tutor_usage_events (classroom_id, created_at desc);

create index if not exists tutor_usage_events_idempotency_idx
  on public.tutor_usage_events (user_id, idempotency_key)
  where idempotency_key is not null;

create policy tutor_usage_events_select_owner
  on public.tutor_usage_events
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Internal reservation RPC for Tutor requests
create or replace function public.internal_begin_tutor_request(
  requesting_user_id uuid,
  target_classroom_id uuid,
  target_conversation_id uuid,
  requested_mode text,
  requested_guided boolean,
  query_characters integer,
  request_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits public.tutor_limits%rowtype;
  usage_event_id uuid;
  classroom_accessible boolean := false;
  active_concurrent integer := 0;
  hourly_queries integer := 0;
  daily_queries integer := 0;
  global_daily_queries integer := 0;
  normalized_idempotency text := nullif(btrim(request_idempotency_key), '');
begin
  if requesting_user_id is null or not exists (
    select 1 from public.profiles where id = requesting_user_id
  ) then
    raise exception 'valid requesting user required' using errcode = '42501';
  end if;

  select (
    exists (
      select 1
      from public.class_members cm
      where cm.classroom_id = target_classroom_id
        and cm.user_id = requesting_user_id
        and cm.status = 'active'
    )
    or exists (
      select 1
      from public.classrooms c
      where c.id = target_classroom_id
        and c.owner_id = requesting_user_id
    )
  ) into classroom_accessible;

  if not classroom_accessible then
    raise exception 'classroom access denied' using errcode = '42501';
  end if;

  if requested_mode not in ('strict', 'comparative') then
    raise exception 'invalid tutor mode' using errcode = '22023';
  end if;

  if query_characters < 1 or query_characters > 16000 then
    raise exception 'query length out of bounds' using errcode = '22023';
  end if;

  -- Atomic advisory lock per user for tutor reservations
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requesting_user_id::text, 89));

  select * into limits from public.tutor_limits where id = 1;
  if not limits.is_enabled then
    raise exception 'tutor service is temporarily disabled' using errcode = '55P03';
  end if;

  -- Idempotency check: if already active within 2 minutes with same key, reject duplicate
  if normalized_idempotency is not null then
    if exists (
      select 1
      from public.tutor_usage_events
      where user_id = requesting_user_id
        and idempotency_key = normalized_idempotency
        and status = 'active'
        and created_at >= now() - interval '2 minutes'
    ) then
      raise exception 'duplicate active tutor request' using errcode = '55P03';
    end if;
  end if;

  -- Concurrency check: count active requests for user in last 2 minutes
  select count(*) into active_concurrent
  from public.tutor_usage_events
  where user_id = requesting_user_id
    and status = 'active'
    and created_at >= now() - interval '2 minutes';

  if active_concurrent >= limits.max_concurrent_requests_per_user then
    raise exception 'concurrent tutor request limit exceeded' using errcode = '54000';
  end if;

  -- Hourly rate limit per user
  select count(*) into hourly_queries
  from public.tutor_usage_events
  where user_id = requesting_user_id
    and created_at >= now() - interval '1 hour'
    and status in ('active', 'completed');

  if hourly_queries >= limits.max_queries_per_user_per_hour then
    raise exception 'hourly tutor query limit exceeded' using errcode = '54000';
  end if;

  -- Daily rate limit per user
  select count(*) into daily_queries
  from public.tutor_usage_events
  where user_id = requesting_user_id
    and created_at >= now() - interval '24 hours'
    and status in ('active', 'completed');

  if daily_queries >= limits.max_queries_per_user_per_day then
    raise exception 'daily tutor query limit exceeded' using errcode = '54000';
  end if;

  -- Global daily pilot budget limit
  select count(*) into global_daily_queries
  from public.tutor_usage_events
  where created_at >= now() - interval '24 hours'
    and status in ('active', 'completed');

  if global_daily_queries >= limits.max_global_queries_per_day then
    raise exception 'global tutor daily budget reached' using errcode = '54000';
  end if;

  insert into public.tutor_usage_events (
    user_id,
    classroom_id,
    conversation_id,
    mode,
    guided,
    query_characters,
    status,
    idempotency_key
  ) values (
    requesting_user_id,
    target_classroom_id,
    target_conversation_id,
    requested_mode,
    requested_guided,
    query_characters,
    'active',
    normalized_idempotency
  )
  returning id into usage_event_id;

  return jsonb_build_object(
    'event_id', usage_event_id,
    'max_retrieved_chunks', limits.max_retrieved_chunks,
    'max_input_tokens', limits.max_input_tokens,
    'max_output_tokens', limits.max_output_tokens,
    'default_model', limits.default_model,
    'reasoning_effort', limits.reasoning_effort
  );
end;
$$;

-- Internal completion RPC for Tutor requests
create or replace function public.internal_complete_tutor_request(
  target_event_id uuid,
  requesting_user_id uuid,
  result_status text,
  retrieved_chunks integer default 0,
  prompt_tokens_used integer default 0,
  completion_tokens_used integer default 0,
  reasoning_tokens_used integer default 0,
  latency_ms_used integer default null,
  result_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_tokens_calc integer := greatest(coalesce(prompt_tokens_used, 0) + coalesce(completion_tokens_used, 0), 0);
begin
  if result_status not in ('completed', 'failed') then
    raise exception 'invalid completion status' using errcode = '22023';
  end if;

  update public.tutor_usage_events
  set status = result_status,
      retrieved_chunks_count = greatest(coalesce(retrieved_chunks, 0), 0),
      prompt_tokens = greatest(coalesce(prompt_tokens_used, 0), 0),
      completion_tokens = greatest(coalesce(completion_tokens_used, 0), 0),
      reasoning_tokens = greatest(coalesce(reasoning_tokens_used, 0), 0),
      total_tokens = total_tokens_calc,
      latency_ms = latency_ms_used,
      error_code = result_error_code,
      completed_at = now()
  where id = target_event_id
    and user_id = requesting_user_id
    and status = 'active';

  if not found then
    raise exception 'active tutor usage event not found' using errcode = '42501';
  end if;
end;
$$;

-- Internal search RPC for Tutor RAG retrieval with classroom and document filtering
create or replace function public.internal_search_tutor_chunks(
  requesting_user_id uuid,
  target_classroom_id uuid,
  search_query text,
  query_embedding extensions.vector(1536),
  selected_document_ids uuid[] default null,
  requested_scope text default 'all',
  requested_match_count integer default 5,
  requested_embedding_model text default 'text-embedding-3-small'
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
  combined_score real,
  chunk_version text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits public.rag_limits%rowtype;
  tlimits public.tutor_limits%rowtype;
  effective_count integer;
  normalized_query text := btrim(search_query);
  has_selection boolean := false;
  classroom_accessible boolean := false;
begin
  if requesting_user_id is null or not exists (
    select 1 from public.profiles where id = requesting_user_id
  ) then
    raise exception 'valid requesting user required' using errcode = '42501';
  end if;

  select (
    exists (
      select 1
      from public.class_members cm
      where cm.classroom_id = target_classroom_id
        and cm.user_id = requesting_user_id
        and cm.status = 'active'
    )
    or exists (
      select 1
      from public.classrooms c
      where c.id = target_classroom_id
        and c.owner_id = requesting_user_id
    )
  ) into classroom_accessible;

  if not classroom_accessible then
    raise exception 'classroom access denied' using errcode = '42501';
  end if;

  if normalized_query is null or char_length(normalized_query) < 1 then
    raise exception 'search query cannot be empty' using errcode = '22023';
  end if;

  if requested_scope not in ('all', 'private', 'group', 'classroom') then
    raise exception 'invalid search scope' using errcode = '22023';
  end if;

  if requested_embedding_model <> 'text-embedding-3-small' then
    raise exception 'unsupported embedding model' using errcode = '22023';
  end if;

  select * into limits from public.rag_limits where id = 1;
  select * into tlimits from public.tutor_limits where id = 1;

  effective_count := least(
    greatest(coalesce(requested_match_count, 5), 1),
    tlimits.max_retrieved_chunks,
    limits.max_search_results
  );

  has_selection := selected_document_ids is not null and cardinality(selected_document_ids) > 0;

  return query
  with eligible as materialized (
    select
      chunk.id,
      chunk.document_id,
      document.title,
      chunk.page_start,
      chunk.page_end,
      chunk.content,
      chunk.chunk_version,
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
      and document.classroom_id = target_classroom_id
      and private.can_user_access_document(requesting_user_id, document.id)
      and (not has_selection or document.id = any(selected_document_ids))
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
        ) desc,
        eligible.id
      ) as rank,
      pg_catalog.ts_rank_cd(
        eligible.search_vector,
        pg_catalog.websearch_to_tsquery('spanish', normalized_query)
      )::real as score
    from eligible
    where eligible.search_vector @@ pg_catalog.websearch_to_tsquery('spanish', normalized_query)
    order by score desc, eligible.id
    limit effective_count * 4
  ),
  fused as (
    select
      candidate.id,
      coalesce(semantic.similarity, 0.0::real) as semantic_similarity,
      coalesce(lexical.score, 0.0::real) as lexical_rank,
      (
        coalesce(1.0 / (60.0 + semantic.rank), 0.0) +
        coalesce(1.0 / (60.0 + lexical.rank), 0.0)
      )::real as combined_score
    from (
      select id from semantic
      union
      select id from lexical
    ) candidate
    left join semantic on semantic.id = candidate.id
    left join lexical on lexical.id = candidate.id
  )
  select
    eligible.id as chunk_id,
    eligible.document_id,
    eligible.title as document_title,
    eligible.page_start,
    eligible.page_end,
    eligible.content,
    fused.semantic_similarity,
    fused.lexical_rank,
    fused.combined_score,
    eligible.chunk_version
  from fused
  join eligible on eligible.id = fused.id
  order by fused.combined_score desc, eligible.id
  limit effective_count;
end;
$$;

-- Secure execution permissions
revoke all on function public.internal_begin_tutor_request(uuid, uuid, uuid, text, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.internal_begin_tutor_request(uuid, uuid, uuid, text, boolean, integer, text) to service_role;

revoke all on function public.internal_complete_tutor_request(uuid, uuid, text, integer, integer, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.internal_complete_tutor_request(uuid, uuid, text, integer, integer, integer, integer, integer, text) to service_role;

revoke all on function public.internal_search_tutor_chunks(uuid, uuid, text, extensions.vector(1536), uuid[], text, integer, text) from public, anon, authenticated;
grant execute on function public.internal_search_tutor_chunks(uuid, uuid, text, extensions.vector(1536), uuid[], text, integer, text) to service_role;

grant select, insert, update, delete on public.tutor_conversations to authenticated;
grant select, insert, delete on public.tutor_messages to authenticated;
grant select, insert on public.tutor_message_citations to authenticated;
grant select on public.tutor_limits to authenticated;
grant select on public.tutor_usage_events to authenticated;
