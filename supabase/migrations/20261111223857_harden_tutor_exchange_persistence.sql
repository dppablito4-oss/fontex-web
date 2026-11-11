-- Browser clients manage conversations, while exchanges and citations are server-authored.

-- Cache the requesting identity once per statement in the remaining RLS policies.
drop policy if exists tutor_conversations_select_owner on public.tutor_conversations;
create policy tutor_conversations_select_owner
  on public.tutor_conversations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists tutor_conversations_insert_owner on public.tutor_conversations;
create policy tutor_conversations_insert_owner
  on public.tutor_conversations
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      exists (
        select 1
        from public.class_members cm
        where cm.classroom_id = tutor_conversations.classroom_id
          and cm.user_id = (select auth.uid())
          and cm.status = 'active'
      )
      or exists (
        select 1
        from public.classrooms c
        where c.id = tutor_conversations.classroom_id
          and c.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists tutor_conversations_update_owner on public.tutor_conversations;
create policy tutor_conversations_update_owner
  on public.tutor_conversations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists tutor_conversations_delete_owner on public.tutor_conversations;
create policy tutor_conversations_delete_owner
  on public.tutor_conversations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists tutor_messages_select_owner on public.tutor_messages;
create policy tutor_messages_select_owner
  on public.tutor_messages
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.tutor_conversations conv
      where conv.id = tutor_messages.conversation_id
        and conv.user_id = (select auth.uid())
    )
  );

drop policy if exists tutor_message_citations_select_owner on public.tutor_message_citations;
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
        and conv.user_id = (select auth.uid())
    )
  );

drop policy if exists tutor_usage_events_select_owner on public.tutor_usage_events;
create policy tutor_usage_events_select_owner
  on public.tutor_usage_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.tutor_limits, public.tutor_conversations,
  public.tutor_messages, public.tutor_message_citations, public.tutor_usage_events
  from public, anon, authenticated;
grant select on public.tutor_limits, public.tutor_messages,
  public.tutor_message_citations, public.tutor_usage_events to authenticated;
grant select, insert, update, delete on public.tutor_conversations to authenticated;
grant select, insert, update, delete on public.tutor_limits, public.tutor_conversations,
  public.tutor_messages, public.tutor_message_citations, public.tutor_usage_events to service_role;
drop policy if exists tutor_messages_insert_owner on public.tutor_messages;
drop policy if exists tutor_messages_delete_owner on public.tutor_messages;
drop policy if exists tutor_message_citations_insert_owner on public.tutor_message_citations;

-- Repair legacy indices using creation time before enforcing unique message order.
with ordered as (
  select id, row_number() over (
    partition by conversation_id order by created_at, order_index, id
  )::integer as position
  from public.tutor_messages
)
update public.tutor_messages m set order_index = ordered.position
from ordered where m.id = ordered.id;
create unique index if not exists tutor_messages_order_unique
  on public.tutor_messages (conversation_id, order_index);

-- This is one short transaction, after generation, with no provider calls under lock.
grant usage on schema private to service_role;
grant execute on function private.can_user_access_document(uuid, uuid) to service_role;
create or replace function public.internal_store_tutor_exchange(
  requesting_user_id uuid,
  target_conversation_id uuid,
  question text,
  answer text,
  response_model text,
  response_metadata jsonb default '{}'::jsonb,
  cited_chunk_ids bigint[] default '{}'::bigint[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_classroom uuid;
  next_order integer;
  user_message_id uuid;
  assistant_message_id uuid;
  unique_ids bigint[];
begin
  if nullif(btrim(question), '') is null or nullif(btrim(answer), '') is null then
    raise exception 'nonempty exchange required' using errcode = '22023';
  end if;
  select classroom_id into target_classroom
  from public.tutor_conversations
  where id = target_conversation_id and user_id = requesting_user_id
  for update;
  if not found or not (
    exists (select 1 from public.class_members where classroom_id = target_classroom
      and user_id = requesting_user_id and status = 'active')
    or exists (select 1 from public.classrooms where id = target_classroom and owner_id = requesting_user_id)
  ) then
    raise exception 'conversation access denied' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct chunk_id order by chunk_id), '{}'::bigint[])
  into unique_ids from unnest(coalesce(cited_chunk_ids, '{}'::bigint[])) as chunk_id;
  if cardinality(unique_ids) <> (
    select count(*) from public.document_chunks c
    join public.documents d on d.id = c.document_id
    join public.document_processing_jobs j on j.id = c.job_id
    where c.id = any(unique_ids) and d.classroom_id = target_classroom
      and d.status = 'ready' and j.status = 'ready' and j.phase = 'complete'
      and private.can_user_access_document(requesting_user_id, d.id)
  ) then
    raise exception 'citation access denied' using errcode = '42501';
  end if;

  select coalesce(max(order_index), 0) + 1 into next_order
  from public.tutor_messages where conversation_id = target_conversation_id;
  insert into public.tutor_messages (conversation_id, user_id, role, content, order_index)
  values (target_conversation_id, requesting_user_id, 'user', question, next_order)
  returning id into user_message_id;
  insert into public.tutor_messages (conversation_id, user_id, role, content, model, order_index, metadata)
  values (target_conversation_id, requesting_user_id, 'assistant', answer, response_model,
    next_order + 1, coalesce(response_metadata, '{}'::jsonb))
  returning id into assistant_message_id;
  insert into public.tutor_message_citations
    (message_id, document_id, chunk_id, citation_index, page_start, page_end, document_title, document_version)
  select assistant_message_id, d.id, c.id, row_number() over (order by c.id)::integer,
    c.page_start, c.page_end, d.title, c.chunk_version
  from public.document_chunks c join public.documents d on d.id = c.document_id
  where c.id = any(unique_ids);
  update public.tutor_conversations set updated_at = now() where id = target_conversation_id;
  return jsonb_build_object('user_message_id', user_message_id, 'message_id', assistant_message_id);
end;
$$;
revoke all on function public.internal_store_tutor_exchange(uuid, uuid, text, text, text, jsonb, bigint[])
  from public, anon, authenticated;
grant execute on function public.internal_store_tutor_exchange(uuid, uuid, text, text, text, jsonb, bigint[])
  to service_role;

-- Serialize global budget reservations as well as per-user quotas.
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

  select * into limits from public.tutor_limits where id = 1 for update;
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


-- Completion can be retried after a lost network response.
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

  if not found and not exists (
    select 1 from public.tutor_usage_events
    where id = target_event_id and user_id = requesting_user_id and status = result_status
  ) then
    raise exception 'active tutor usage event not found' using errcode = '42501';
  end if;
end;
$$;
