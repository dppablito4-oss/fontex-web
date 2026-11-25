begin;

alter table fontex_assessments.forms add column question_version integer not null default 1;
alter table fontex_assessments.questions drop constraint questions_kind_check;
alter table fontex_assessments.questions add constraint questions_kind_check
  check (kind in ('text', 'choice', 'multiple'));
alter table fontex_assessments.answers drop constraint answers_answer_check;
alter table fontex_assessments.answers add constraint answers_answer_check
  check (char_length(answer) between 1 and 1500);
alter table fontex_assessments.submissions add column browser_id uuid;
create unique index assessment_one_submission_per_browser
  on fontex_assessments.submissions (form_id, browser_id) where browser_id is not null;

-- Old publications and their recorded answers keep their existing identities.
create or replace function fontex_assessments.create_form(
  p_request uuid, p_title text, p_kind text, p_description text, p_questions jsonb, p_code_count integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := fontex_ai.require_admin();
  item jsonb;
  item_position integer;
  item_prompt text;
  item_kind text;
  item_options jsonb;
  normalized_options text[];
begin
  if p_request is null or p_title is null or char_length(btrim(p_title, E' \t\r\n')) not between 1 and 120
     or p_kind is null or p_kind not in ('survey', 'pretest')
     or p_description is null or char_length(p_description) > 600
     or p_code_count is null or p_code_count not between 0 and 200
     or jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'assessment_invalid_form' using errcode = '22023';
  end if;
  if jsonb_array_length(p_questions) not between 1 and 30 or octet_length(p_questions::text) > 200000 then
    raise exception 'assessment_invalid_form' using errcode = '22023';
  end if;

  insert into fontex_assessments.forms (id, created_by, title, kind, description)
    values (p_request, actor, btrim(p_title, E' \t\r\n'), p_kind, btrim(p_description, E' \t\r\n'))
    on conflict (id) do nothing;
  if not found then
    if exists (select 1 from fontex_assessments.forms where id = p_request and created_by = actor) then
      return p_request;
    end if;
    raise exception 'assessment_unavailable' using errcode = '42501';
  end if;

  for item, item_position in
    select e.value, e.ordinality::integer from jsonb_array_elements(p_questions) with ordinality e
  loop
    item_prompt := btrim(item->>'prompt', E' \t\r\n');
    item_kind := item->>'kind';
    item_options := item->'options';
    if jsonb_typeof(item->'prompt') is distinct from 'string'
       or char_length(item_prompt) not between 1 and 400
       or item_kind is null or item_kind not in ('text', 'choice', 'multiple')
       or jsonb_typeof(item_options) is distinct from 'array' then
      raise exception 'assessment_invalid_question' using errcode = '22023';
    end if;
    if (item_kind = 'text' and jsonb_array_length(item_options) <> 0)
       or (item_kind <> 'text' and jsonb_array_length(item_options) not between 2 and 8)
       or exists (select 1 from jsonb_array_elements(item_options) o(value) where jsonb_typeof(o.value) <> 'string') then
      raise exception 'assessment_invalid_question' using errcode = '22023';
    end if;
    normalized_options := array(
      select btrim(o.value, E' \t\r\n')
      from jsonb_array_elements_text(item_options) with ordinality o(value, position)
      order by o.position
    );
    if exists (select 1 from unnest(normalized_options) v(option) where char_length(v.option) not between 1 and 180 or v.option ~ E'[\\r\\n]')
       or cardinality(normalized_options) <> (select count(distinct v.option) from unnest(normalized_options) v(option)) then
      raise exception 'assessment_invalid_question' using errcode = '22023';
    end if;
    insert into fontex_assessments.questions (form_id, position, prompt, kind, options)
      values (p_request, item_position, item_prompt, item_kind, normalized_options);
  end loop;

  insert into fontex_assessments.codes (form_id, code)
  select p_request, upper(left(replace(gen_random_uuid()::text, '-', ''), 12))
  from generate_series(1, p_code_count);

  return p_request;
end;
$$;

create or replace function fontex_assessments.submit_answers(
  p_token uuid, p_code text, p_name text, p_request uuid, p_answers jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  open_now boolean;
  student_code text := upper(btrim(p_code, E' \t\r\n'));
  student_name text := btrim(p_name, E' \t\r\n');
  previous_request uuid;
begin
  select f.id, f.is_open into target, open_now
  from fontex_assessments.forms f
  where f.token = p_token and f.question_version = 1 and fontex_beta.allowed(f.created_by)
    and exists (select 1 from fontex_ai.admins where user_id = f.created_by)
  for share;
  if not found then raise exception 'assessment_closed' using errcode = '22023'; end if;
  if student_code is null or student_code !~ '^[0-9A-F]{12}$'
     or student_name is null or char_length(student_name) not between 1 and 100 or p_request is null then
    raise exception 'assessment_invalid_submission' using errcode = '22023';
  end if;

  perform 1 from fontex_assessments.codes c where c.form_id = target and c.code = student_code for update;
  if not found then raise exception 'assessment_invalid_code' using errcode = '22023'; end if;
  select s.request_id into previous_request from fontex_assessments.submissions s
    where s.form_id = target and s.code = student_code;
  if found then
    if previous_request = p_request then return true; end if;
    raise exception 'assessment_code_used' using errcode = '22023';
  end if;
  if not open_now then raise exception 'assessment_closed' using errcode = '22023'; end if;

  if jsonb_typeof(p_answers) is distinct from 'array' or octet_length(p_answers::text) > 105000 then
    raise exception 'assessment_invalid_answers' using errcode = '22023';
  end if;
  if jsonb_array_length(p_answers) <> (select count(*) from fontex_assessments.questions where form_id = target)
     or exists (
       select 1
       from jsonb_array_elements(p_answers) with ordinality a(value, position)
       join fontex_assessments.questions q on q.form_id = target and q.position = a.position
       cross join lateral (select btrim(a.value #>> '{}', E' \t\r\n') as answer) normalized
       where jsonb_typeof(a.value) <> 'string' or char_length(normalized.answer) not between 1 and 800
          or (q.kind = 'choice' and not (normalized.answer = any(q.options)))
     ) then
    raise exception 'assessment_invalid_answers' using errcode = '22023';
  end if;

  insert into fontex_assessments.submissions (form_id, code, request_id, student_name)
    values (target, student_code, p_request, student_name);
  insert into fontex_assessments.answers (form_id, code, position, answer)
    select target, student_code, a.position::integer, btrim(a.value, E' \t\r\n')
    from jsonb_array_elements_text(p_answers) with ordinality a(value, position);
  return true;
end;
$$;

create or replace function fontex_assessments.form_detail(p_form uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := fontex_ai.require_admin();
begin
  return (
    select jsonb_build_object(
      'id', f.id, 'token', f.token, 'title', f.title, 'description', f.description,
      'kind', f.kind, 'is_open', f.is_open, 'created_at', f.created_at,
      'questions', fontex_assessments.read_questions(f.id),
      'codes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'code', c.code, 'student_name', s.student_name, 'submitted_at', s.submitted_at
        ) order by c.code), '[]'::jsonb)
        from fontex_assessments.codes c
        left join fontex_assessments.submissions s using (form_id, code)
        where c.form_id = f.id
      )
    )
    from fontex_assessments.forms f where f.id = p_form and f.created_by = actor
  );
end;
$$;

create function fontex_assessments.read_for_browser(p_token uuid, p_browser uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare target fontex_assessments.forms;
begin
  if p_browser is null then return jsonb_build_object('state', 'closed'); end if;
  select f.* into target from fontex_assessments.forms f
  where f.token = p_token and fontex_beta.allowed(f.created_by)
    and exists (select 1 from fontex_ai.admins where user_id = f.created_by);
  if not found then return jsonb_build_object('state', 'closed'); end if;
  if exists (select 1 from fontex_assessments.submissions s where s.form_id = target.id and s.browser_id = p_browser) then
    return jsonb_build_object('state', 'submitted', 'title', target.title);
  end if;
  if not target.is_open then return jsonb_build_object('state', 'closed', 'title', target.title); end if;
  return jsonb_build_object('state', 'open', 'title', target.title, 'kind', target.kind,
    'description', target.description, 'question_version', target.question_version,
    'questions', fontex_assessments.read_questions(target.id));
end;
$$;

create function fontex_assessments.submit_for_browser(
  p_token uuid, p_browser uuid, p_name text, p_question_version integer, p_answers jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare
  target fontex_assessments.forms;
  student_name text := btrim(p_name, E' \t\r\n');
  receipt_code text;
  item record;
  stored_answer text;
  selected_options text[];
begin
  if p_browser is null or student_name is null or char_length(student_name) not between 1 and 100 then
    raise exception 'assessment_invalid_submission' using errcode = '22023';
  end if;
  -- Serialize with question removal and concurrent submissions for the same evaluation.
  select f.* into target from fontex_assessments.forms f
  where f.token = p_token and fontex_beta.allowed(f.created_by)
    and exists (select 1 from fontex_ai.admins where user_id = f.created_by)
  for update;
  if not found then return 'closed'; end if;
  if exists (select 1 from fontex_assessments.submissions s where s.form_id = target.id and s.browser_id = p_browser) then
    return 'submitted';
  end if;
  if not target.is_open then return 'closed'; end if;
  if target.question_version is distinct from p_question_version then return 'changed'; end if;
  if jsonb_typeof(p_answers) is distinct from 'array' or octet_length(p_answers::text) > 190000 then
    raise exception 'assessment_invalid_answers' using errcode = '22023';
  end if;
  if jsonb_array_length(p_answers) <> (select count(*) from fontex_assessments.questions where form_id = target.id) then
    raise exception 'assessment_invalid_answers' using errcode = '22023';
  end if;

  -- Retain the existing internal receipt key and answer relations for print and export.
  receipt_code := upper(left(replace(gen_random_uuid()::text, '-', ''), 12));
  insert into fontex_assessments.codes (form_id, code) values (target.id, receipt_code);
  insert into fontex_assessments.submissions (form_id, code, request_id, student_name, browser_id)
    values (target.id, receipt_code, p_browser, student_name, p_browser);

  for item in
    select q.*, p_answers->((row_number() over (order by q.position))::integer - 1) as value
    from fontex_assessments.questions q where q.form_id = target.id order by q.position
  loop
    if item.kind = 'multiple' then
      if jsonb_typeof(item.value) is distinct from 'array' then
        raise exception 'assessment_invalid_answers' using errcode = '22023';
      end if;
      if jsonb_array_length(item.value) not between 1 and cardinality(item.options)
         or exists (select 1 from jsonb_array_elements(item.value) a(v) where jsonb_typeof(a.v) <> 'string') then
        raise exception 'assessment_invalid_answers' using errcode = '22023';
      end if;
      selected_options := array(select jsonb_array_elements_text(item.value));
      if exists (select 1 from unnest(selected_options) s(v) where not (s.v = any(item.options)))
         or cardinality(selected_options) <> (select count(distinct s.v) from unnest(selected_options) s(v)) then
        raise exception 'assessment_invalid_answers' using errcode = '22023';
      end if;
      stored_answer := array_to_string(array(
        select o.v from unnest(item.options) with ordinality o(v, n) where o.v = any(selected_options) order by o.n
      ), E'\n');
    else
      stored_answer := btrim(item.value #>> '{}', E' \t\r\n');
      if jsonb_typeof(item.value) is distinct from 'string' or char_length(stored_answer) not between 1 and 800
         or (item.kind = 'choice' and not (stored_answer = any(item.options))) then
        raise exception 'assessment_invalid_answers' using errcode = '22023';
      end if;
    end if;
    insert into fontex_assessments.answers (form_id, code, position, answer)
      values (target.id, receipt_code, item.position, stored_answer);
  end loop;
  return 'submitted';
end;
$$;

create function fontex_assessments.delete_form(p_form uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := fontex_ai.require_admin();
begin
  delete from fontex_assessments.forms f where f.id = p_form and f.created_by = actor;
end;
$$;

create function fontex_assessments.delete_question(p_form uuid, p_position integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := fontex_ai.require_admin();
begin
  perform 1 from fontex_assessments.forms f where f.id = p_form and f.created_by = actor for update;
  if not found then raise exception 'assessment_unavailable' using errcode = '42501'; end if;
  if not exists (select 1 from fontex_assessments.questions q where q.form_id = p_form and q.position = p_position) then
    return;
  end if;
  if (select count(*) from fontex_assessments.questions q where q.form_id = p_form) <= 1 then
    raise exception 'assessment_last_question' using errcode = '22023';
  end if;
  delete from fontex_assessments.questions q where q.form_id = p_form and q.position = p_position;
  update fontex_assessments.forms f set question_version = question_version + 1 where f.id = p_form;
end;
$$;

revoke all on function fontex_assessments.read_for_browser(uuid, uuid),
  fontex_assessments.submit_for_browser(uuid, uuid, text, integer, jsonb),
  fontex_assessments.delete_form(uuid), fontex_assessments.delete_question(uuid, integer)
  from public, anon, authenticated;
grant execute on function fontex_assessments.read_for_browser(uuid, uuid),
  fontex_assessments.submit_for_browser(uuid, uuid, text, integer, jsonb) to anon, authenticated;
grant execute on function fontex_assessments.delete_form(uuid),
  fontex_assessments.delete_question(uuid, integer) to authenticated;

create function public.get_browser_assessment(p_token uuid, p_browser uuid) returns jsonb
language sql stable set search_path = '' as $$
  select fontex_assessments.read_for_browser(p_token, p_browser);
$$;
create function public.submit_browser_assessment(
  p_token uuid, p_browser uuid, p_name text, p_question_version integer, p_answers jsonb
) returns text language sql set search_path = '' as $$
  select fontex_assessments.submit_for_browser(p_token, p_browser, p_name, p_question_version, p_answers);
$$;
create function public.admin_delete_assessment(p_form uuid) returns void
language sql set search_path = '' as $$ select fontex_assessments.delete_form(p_form); $$;
create function public.admin_delete_assessment_question(p_form uuid, p_position integer) returns void
language sql set search_path = '' as $$ select fontex_assessments.delete_question(p_form, p_position); $$;

revoke all on function public.get_browser_assessment(uuid, uuid),
  public.submit_browser_assessment(uuid, uuid, text, integer, jsonb),
  public.admin_delete_assessment(uuid), public.admin_delete_assessment_question(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_browser_assessment(uuid, uuid),
  public.submit_browser_assessment(uuid, uuid, text, integer, jsonb) to anon, authenticated;
grant execute on function public.admin_delete_assessment(uuid),
  public.admin_delete_assessment_question(uuid, integer) to authenticated;

create or replace function fontex_beta.check_request() returns void
language plpgsql security definer set search_path = '' as $$
declare path text := ltrim(coalesce(current_setting('request.path', true), ''), '/');
begin
  if path in ('rpc/get_public_assessment', 'rpc/submit_public_assessment',
              'rpc/get_browser_assessment', 'rpc/submit_browser_assessment') then return; end if;
  perform fontex_beta.check_request_before_assessments();
end;
$$;

-- Filter deletions before applying the offset, keeping each page and its sentinel accurate.
create or replace function fontex_beta.list_admin_accounts(p_search text, p_limit integer, p_offset integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  term text := lower(trim(coalesce(p_search, '')));
  page_size integer := greatest(1, least(coalesce(p_limit, 25), 50));
  start_at integer := greatest(0, least(coalesce(p_offset, 0), 50000));
  rows jsonb;
begin
  perform fontex_ai.require_admin();
  if char_length(term) > 120 then raise exception 'Search too long' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc, page.user_id), '[]'::jsonb) into rows
  from (
    select u.id as user_id, u.email, coalesce(p.display_name, 'Usuario Fontex') as display_name,
      w.balance as credits, u.created_at, m.suspended_until,
      exists(select 1 from fontex_ai.admins a where a.user_id = u.id) as is_admin,
      case when m.deletion_request_id is not null then 'deleting'
        when not coalesce(m.active, false) then 'blocked'
        when m.suspended_until > now() then 'suspended'
        else 'active' end as status
    from auth.users u join fontex_ai.wallets w on w.user_id = u.id
    left join public.profiles p on p.id = u.id
    left join fontex_beta.members m on m.user_id = u.id
    where m.deleted_at is null
      and (term = '' or strpos(lower(coalesce(u.email, '')), term) > 0
        or strpos(lower(coalesce(p.display_name, '')), term) > 0)
    order by u.created_at desc, u.id limit page_size + 1 offset start_at
  ) page;
  return jsonb_build_object('accounts', rows, 'page_size', page_size);
end;
$$;

notify pgrst, 'reload schema';
commit;
