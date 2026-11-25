begin;

create schema fontex_assessments;
revoke all on schema fontex_assessments from public, anon, authenticated;
grant usage on schema fontex_assessments to anon, authenticated;

create table fontex_assessments.forms (
  id uuid primary key,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null check (kind in ('survey', 'pretest')),
  description text not null check (char_length(description) <= 600),
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create index assessment_forms_by_owner on fontex_assessments.forms (created_by, created_at desc, id desc);

create table fontex_assessments.questions (
  form_id uuid not null references fontex_assessments.forms(id) on delete cascade,
  position integer not null check (position between 1 and 30),
  prompt text not null check (char_length(prompt) between 1 and 400),
  kind text not null check (kind in ('text', 'choice')),
  options text[] not null,
  primary key (form_id, position)
);

create table fontex_assessments.codes (
  form_id uuid not null references fontex_assessments.forms(id) on delete cascade,
  code text not null check (code ~ '^[0-9A-F]{12}$'),
  primary key (form_id, code)
);

create table fontex_assessments.submissions (
  form_id uuid not null,
  code text not null,
  request_id uuid not null,
  student_name text not null check (char_length(student_name) between 1 and 100),
  submitted_at timestamptz not null default now(),
  primary key (form_id, code),
  foreign key (form_id, code) references fontex_assessments.codes(form_id, code) on delete cascade
);

create table fontex_assessments.answers (
  form_id uuid not null,
  code text not null,
  position integer not null,
  answer text not null check (char_length(answer) between 1 and 800),
  primary key (form_id, code, position),
  foreign key (form_id, code) references fontex_assessments.submissions(form_id, code) on delete cascade,
  foreign key (form_id, position) references fontex_assessments.questions(form_id, position) on delete cascade
);

create index assessment_answers_by_question on fontex_assessments.answers (form_id, position);
alter table fontex_assessments.forms enable row level security;
alter table fontex_assessments.questions enable row level security;
alter table fontex_assessments.codes enable row level security;
alter table fontex_assessments.submissions enable row level security;
alter table fontex_assessments.answers enable row level security;
revoke all on all tables in schema fontex_assessments from public, anon, authenticated;

create function fontex_assessments.read_questions(p_form uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'position', q.position, 'prompt', q.prompt, 'kind', q.kind, 'options', q.options
  ) order by q.position), '[]'::jsonb)
  from fontex_assessments.questions q where q.form_id = p_form;
$$;

create function fontex_assessments.create_form(
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
     or p_code_count is null or p_code_count not between 1 and 200
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
       or item_kind is null or item_kind not in ('text', 'choice')
       or jsonb_typeof(item_options) is distinct from 'array' then
      raise exception 'assessment_invalid_question' using errcode = '22023';
    end if;
    if (item_kind = 'text' and jsonb_array_length(item_options) <> 0)
       or (item_kind = 'choice' and jsonb_array_length(item_options) not between 2 and 8)
       or exists (select 1 from jsonb_array_elements(item_options) o(value) where jsonb_typeof(o.value) <> 'string') then
      raise exception 'assessment_invalid_question' using errcode = '22023';
    end if;
    normalized_options := array(
      select btrim(o.value, E' \t\r\n')
      from jsonb_array_elements_text(item_options) with ordinality o(value, position)
      order by o.position
    );
    if exists (select 1 from unnest(normalized_options) v(option) where char_length(v.option) not between 1 and 180)
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

create function fontex_assessments.list_forms(p_offset integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := fontex_ai.require_admin();
begin
  return (
    select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc, f.id desc), '[]'::jsonb)
    from (
      select id, title, kind, is_open, created_at
      from fontex_assessments.forms where created_by = actor
      order by created_at desc, id desc limit 26 offset greatest(coalesce(p_offset, 0), 0)
    ) f
  );
end;
$$;

create function fontex_assessments.form_detail(p_form uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := fontex_ai.require_admin();
begin
  return (
    select jsonb_build_object(
      'id', f.id, 'token', f.token, 'title', f.title, 'description', f.description,
      'kind', f.kind, 'is_open', f.is_open, 'created_at', f.created_at,
      'questions', fontex_assessments.read_questions(f.id),
      'codes', (
        select jsonb_agg(jsonb_build_object(
          'code', c.code, 'student_name', s.student_name, 'submitted_at', s.submitted_at
        ) order by c.code)
        from fontex_assessments.codes c
        left join fontex_assessments.submissions s using (form_id, code)
        where c.form_id = f.id
      )
    )
    from fontex_assessments.forms f where f.id = p_form and f.created_by = actor
  );
end;
$$;

create function fontex_assessments.set_form_open(p_form uuid, p_open boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := fontex_ai.require_admin();
begin
  if p_open is null then raise exception 'assessment_invalid_form' using errcode = '22023'; end if;
  update fontex_assessments.forms set is_open = p_open where id = p_form and created_by = actor;
  if not found then raise exception 'assessment_unavailable' using errcode = '42501'; end if;
  return p_open;
end;
$$;

create function fontex_assessments.read_answers(p_form uuid, p_codes text[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := fontex_ai.require_admin();
begin
  if not exists (select 1 from fontex_assessments.forms where id = p_form and created_by = actor) then
    raise exception 'assessment_unavailable' using errcode = '42501';
  end if;
  if p_codes is null or cardinality(p_codes) not between 1 and 25 then
    raise exception 'assessment_invalid_codes' using errcode = '22023';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.code), '[]'::jsonb)
    from (
      select s.code, jsonb_agg(a.answer order by a.position) as answers
      from fontex_assessments.submissions s
      join fontex_assessments.answers a using (form_id, code)
      where s.form_id = p_form and s.code = any(p_codes)
      group by s.code
    ) r
  );
end;
$$;

create function fontex_assessments.read_public_form(p_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', f.title, 'kind', f.kind, 'is_open', f.is_open,
    'description', case when f.is_open then f.description else '' end,
    'questions', case when f.is_open then fontex_assessments.read_questions(f.id) else '[]'::jsonb end
  )
  from fontex_assessments.forms f
  where f.token = p_token and fontex_beta.allowed(f.created_by)
    and exists (select 1 from fontex_ai.admins where user_id = f.created_by);
$$;

create function fontex_assessments.submit_answers(
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
  where f.token = p_token and fontex_beta.allowed(f.created_by)
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

-- The API exposes invoker wrappers only. Elevated code and student data live outside exposed schemas.
revoke all on all functions in schema fontex_assessments from public, anon, authenticated;
grant execute on function fontex_assessments.create_form(uuid, text, text, text, jsonb, integer),
  fontex_assessments.list_forms(integer), fontex_assessments.form_detail(uuid),
  fontex_assessments.set_form_open(uuid, boolean), fontex_assessments.read_answers(uuid, text[])
  to authenticated;
grant execute on function fontex_assessments.read_public_form(uuid),
  fontex_assessments.submit_answers(uuid, text, text, uuid, jsonb) to anon, authenticated;

create function public.admin_create_assessment(
  p_request uuid, p_title text, p_kind text, p_description text, p_questions jsonb, p_code_count integer
) returns uuid language sql set search_path = '' as $$
  select fontex_assessments.create_form(p_request, p_title, p_kind, p_description, p_questions, p_code_count);
$$;
create function public.admin_list_assessments(p_offset integer) returns jsonb
language sql stable set search_path = '' as $$ select fontex_assessments.list_forms(p_offset); $$;
create function public.admin_get_assessment(p_form uuid) returns jsonb
language sql stable set search_path = '' as $$ select fontex_assessments.form_detail(p_form); $$;
create function public.admin_set_assessment_open(p_form uuid, p_open boolean) returns boolean
language sql set search_path = '' as $$ select fontex_assessments.set_form_open(p_form, p_open); $$;
create function public.admin_assessment_answers(p_form uuid, p_codes text[]) returns jsonb
language sql stable set search_path = '' as $$ select fontex_assessments.read_answers(p_form, p_codes); $$;
create function public.get_public_assessment(p_token uuid) returns jsonb
language sql stable set search_path = '' as $$ select fontex_assessments.read_public_form(p_token); $$;
create function public.submit_public_assessment(
  p_token uuid, p_code text, p_name text, p_request uuid, p_answers jsonb
) returns boolean language sql set search_path = '' as $$
  select fontex_assessments.submit_answers(p_token, p_code, p_name, p_request, p_answers);
$$;

revoke all on function public.admin_create_assessment(uuid, text, text, text, jsonb, integer),
  public.admin_list_assessments(integer), public.admin_get_assessment(uuid),
  public.admin_set_assessment_open(uuid, boolean), public.admin_assessment_answers(uuid, text[]),
  public.get_public_assessment(uuid), public.submit_public_assessment(uuid, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_create_assessment(uuid, text, text, text, jsonb, integer),
  public.admin_list_assessments(integer), public.admin_get_assessment(uuid),
  public.admin_set_assessment_open(uuid, boolean), public.admin_assessment_answers(uuid, text[])
  to authenticated;
grant execute on function public.get_public_assessment(uuid),
  public.submit_public_assessment(uuid, text, text, uuid, jsonb) to anon, authenticated;

alter function fontex_beta.check_request() rename to check_request_before_assessments;
create function fontex_beta.check_request() returns void
language plpgsql security definer set search_path = '' as $$
declare path text := ltrim(coalesce(current_setting('request.path', true), ''), '/');
begin
  if path in ('rpc/get_public_assessment', 'rpc/submit_public_assessment') then return; end if;
  perform fontex_beta.check_request_before_assessments();
end;
$$;
revoke all on function fontex_beta.check_request() from public, anon, authenticated;
grant execute on function fontex_beta.check_request() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
