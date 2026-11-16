begin;
alter table private.classroom_guests add column ai_balance integer not null default 5 check(ai_balance between 0 and 1000000);
create table private.class_lessons(
 id uuid primary key default gen_random_uuid(), classroom_id uuid not null references public.classrooms(id) on delete cascade,
 created_by uuid not null references auth.users(id), title text not null check(length(title) between 1 and 160),
 topic text not null default '' check(length(topic)<=160), class_date date not null default current_date,
 week integer not null default 1 check(week between 1 and 100), instructions text not null default '' check(length(instructions)<=4000),
 due_at timestamptz, scene jsonb not null check(octet_length(scene::text)<=1048576),
 attachments jsonb not null default '[]' check(jsonb_typeof(attachments)='array' and jsonb_array_length(attachments)<=5),
 created_at timestamptz not null default now()
);
create index class_lessons_class_date on private.class_lessons(classroom_id,class_date desc,created_at desc);
create index class_lessons_author on private.class_lessons(created_by);
create table private.lesson_submissions(
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references private.class_lessons(id) on delete cascade,
 user_id uuid references auth.users(id), guest_id uuid references private.classroom_guests(id),
 scene jsonb not null check(octet_length(scene::text)<=1048576),
 status text not null default 'draft' check(status in ('draft','submitted','reviewed')),
 feedback text not null default '' check(length(feedback)<=4000), updated_at timestamptz not null default now(),
 check(num_nonnulls(user_id,guest_id)=1)
);
create unique index lesson_submission_user on private.lesson_submissions(lesson_id,user_id) where user_id is not null;
create unique index lesson_submission_guest on private.lesson_submissions(lesson_id,guest_id) where guest_id is not null;
create index lesson_submission_guest_lookup on private.lesson_submissions(guest_id);
create index lesson_submission_user_lookup on private.lesson_submissions(user_id);
create table private.lesson_notifications(
 id uuid primary key default gen_random_uuid(), lesson_id uuid not null references private.class_lessons(id) on delete cascade,
 user_id uuid not null references auth.users(id), status text not null default 'pending' check(status in('pending','sending','sent','failed','skipped')),
 error text, updated_at timestamptz not null default now(), unique(lesson_id,user_id)
);
create index lesson_notifications_user on private.lesson_notifications(user_id);
create index lesson_notifications_queue on private.lesson_notifications(status,updated_at);
create table private.guest_ai_builds(
 id uuid primary key, guest_id uuid not null references private.classroom_guests(id), source jsonb not null, question text not null,
 reply jsonb, state text not null default 'pending' check(state in('pending','ready','refunded')), applied_at timestamptz,
 created_at timestamptz not null default now()
);
create index guest_builds_owner on private.guest_ai_builds(guest_id,created_at desc);
create table private.guest_ai_requests(
 id uuid primary key,guest_id uuid not null references private.classroom_guests(id), task text not null check(task in('chat','build')),
 tokens integer not null check(tokens between 1 and 150000), finished boolean not null default false, created_at timestamptz not null default now()
);
create index guest_ai_requests_owner on private.guest_ai_requests(guest_id,created_at desc);
create index guest_ai_requests_pending on private.guest_ai_requests(created_at) where not finished;
create table private.guest_credit_promotions(
 user_id uuid not null references auth.users(id), guest_id uuid primary key references private.classroom_guests(id),
 transferred integer not null, bonus integer not null,created_at timestamptz not null default now()
);
create index guest_promotions_user on private.guest_credit_promotions(user_id);
do $$ declare t text; begin foreach t in array array['class_lessons','lesson_submissions','lesson_notifications','guest_ai_builds','guest_ai_requests','guest_credit_promotions'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
end loop;end $$;

create function private.learning_guest(p_token text) returns private.classroom_guests
language sql stable security definer set search_path='' as $$
 select g from private.classroom_guests g join private.classroom_join_links l on l.id=g.link_id
 where g.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and g.expires_at>now()
 and g.promoted_at is null and l.revoked_at is null and l.expires_at>now()
$$;
create function private.learning_allowed(p_class uuid,p_guest text,p_user uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare g private.classroom_guests;
begin
 if coalesce(p_guest,'')<>'' then
  g:=private.learning_guest(p_guest);
  return g.id is not null and exists(select 1 from private.classroom_join_links where id=g.link_id and classroom_id=p_class);
 end if;
 return coalesce(fontex_beta.allowed(p_user),false) and exists(select 1 from public.class_members where classroom_id=p_class and user_id=p_user and status='active');
end $$;
create function public.teacher_classrooms() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title) order by c.title),'[]')
 from public.classrooms c join public.class_members m on m.classroom_id=c.id
 where m.user_id=auth.uid() and m.role='teacher' and m.status='active' and fontex_beta.allowed(auth.uid())
$$;
create function public.publish_class_lesson(p_classroom uuid,p_scene_id text,p_title text,p_topic text,p_date date,p_week integer,p_instructions text,p_due timestamptz,p_attachments jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare s jsonb; result uuid; file jsonb;
begin
 if not fontex_beta.allowed(auth.uid()) or not private.is_classroom_teacher(p_classroom) then raise exception 'classroom_permission_denied' using errcode='42501';end if;
 perform 1 from public.classrooms where id=p_classroom for update;
 if (select count(*) from private.class_lessons where classroom_id=p_classroom)>=1000 then raise exception 'Classroom lesson limit';end if;
 select scene into s from public.visual_scenes where user_id=auth.uid() and id=p_scene_id and scene->>'format'='primitive-scene';
 if s is null then raise exception 'Save the source canvas first';end if;
 if jsonb_typeof(p_attachments)<>'array' or jsonb_array_length(p_attachments)>5 then raise exception 'Invalid attachments';end if;
 for file in select * from jsonb_array_elements(p_attachments) loop
  if file->>'path' not like p_classroom::text||'/'||auth.uid()::text||'/%' or file->>'type'<>'application/pdf'
    or not exists(select 1 from storage.objects where bucket_id='class-materials' and name=file->>'path') then raise exception 'Invalid attachment ownership';end if;
 end loop;
 s:=jsonb_set(s,'{conversation}','[]');
 s:=s-'appliedBuildIds';
 s:=jsonb_set(s,'{primitives}',coalesce((select jsonb_agg(case when p->>'kind'='answer_field' then jsonb_set(p,'{data,answer}','""') else p end) from jsonb_array_elements(s->'primitives') p),'[]'));
 insert into private.class_lessons(classroom_id,created_by,title,topic,class_date,week,instructions,due_at,scene,attachments)
 values(p_classroom,auth.uid(),btrim(p_title),p_topic,p_date,p_week,p_instructions,p_due,s,p_attachments) returning id into result;
 insert into private.lesson_notifications(lesson_id,user_id)
 select result,m.user_id from public.class_members m join auth.users u on u.id=m.user_id
 where m.classroom_id=p_classroom and m.status='active' and m.user_id<>auth.uid() and u.email_confirmed_at is not null;
 return result;
end $$;
create function public.list_class_lessons(p_classroom uuid,p_guest text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare g private.classroom_guests; teacher boolean;
begin
 if not private.learning_allowed(p_classroom,p_guest,auth.uid()) then raise exception 'classroom_permission_denied' using errcode='42501';end if;
 g:=private.learning_guest(p_guest);
 teacher:=coalesce(p_guest,'')='' and private.is_classroom_teacher(p_classroom);
 return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'topic',l.topic,'class_date',l.class_date,'week',l.week,'instructions',l.instructions,'due_at',l.due_at,'created_at',l.created_at,
 'status',(select s.status from private.lesson_submissions s where s.lesson_id=l.id and (s.user_id=auth.uid() or s.guest_id=g.id or (coalesce(p_guest,'')='' and exists(select 1 from private.classroom_guests claimed where claimed.id=s.guest_id and claimed.claimed_by=auth.uid()))) order by s.updated_at desc limit 1),
 'deliveries',case when teacher then (select count(*) from private.lesson_submissions where lesson_id=l.id and status<>'draft') else 0 end)
 order by l.class_date desc,l.created_at desc) from private.class_lessons l where l.classroom_id=p_classroom),'[]');
end $$;
create function private.learning_lesson(p_id uuid,p_guest text,p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare l private.class_lessons;g private.classroom_guests; teacher boolean; result jsonb;
begin
 select * into l from private.class_lessons where id=p_id;
 if l.id is null or not private.learning_allowed(l.classroom_id,p_guest,p_user) then raise exception 'classroom_permission_denied' using errcode='42501';end if;
 g:=private.learning_guest(p_guest);
 teacher:=coalesce(p_guest,'')='' and exists(select 1 from public.class_members where classroom_id=l.classroom_id and user_id=p_user and role='teacher' and status='active');
 result:=to_jsonb(l)-'created_by';
 return result||jsonb_build_object('teacher',teacher,'submission',
  (select to_jsonb(s)-'user_id'-'guest_id' from private.lesson_submissions s where s.lesson_id=p_id and (s.user_id=p_user or s.guest_id=g.id or (coalesce(p_guest,'')='' and exists(select 1 from private.classroom_guests claimed where claimed.id=s.guest_id and claimed.claimed_by=p_user))) order by s.updated_at desc limit 1));
end $$;
create function public.get_class_lesson(p_id uuid,p_guest text default null) returns jsonb
language sql stable security definer set search_path='' as $$select private.learning_lesson(p_id,p_guest,auth.uid())$$;
create function public.class_lesson_for_service(p_id uuid,p_guest text,p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$select private.learning_lesson(p_id,p_guest,p_user)$$;
create function public.save_class_attempt(p_id uuid,p_guest text,p_user uuid,p_scene jsonb,p_submit boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare lesson jsonb;g private.classroom_guests;result uuid;member uuid;
begin
 lesson:=private.learning_lesson(p_id,p_guest,p_user);
 if octet_length(p_scene::text)>1048576 then raise exception 'Attempt too large';end if;
 g:=private.learning_guest(p_guest);
 member:=case when g.id is null then p_user else null end;
 perform pg_advisory_xact_lock(hashtext(p_id::text||coalesce(member,g.id)::text));
 select id into result from private.lesson_submissions where lesson_id=p_id and (user_id=member or guest_id=g.id) for update;
 if result is null then
  insert into private.lesson_submissions(lesson_id,user_id,guest_id,scene,status) values(p_id,member,g.id,p_scene,case when p_submit then 'submitted' else 'draft' end) returning id into result;
 else
  update private.lesson_submissions set scene=p_scene,status=case when p_submit then 'submitted' else 'draft' end,updated_at=now(),feedback='' where id=result;
 end if;
 return result;
end $$;
create function public.class_lesson_submissions(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare l private.class_lessons;
begin
 select * into l from private.class_lessons where id=p_id;
 if l.id is null or not fontex_beta.allowed(auth.uid()) or not private.is_classroom_teacher(l.classroom_id) then raise exception 'classroom_permission_denied' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('name',coalesce(p.display_name,g.display_name,'Participante')) order by s.updated_at desc)
 from private.lesson_submissions s left join public.profiles p on p.id=s.user_id left join private.classroom_guests g on g.id=s.guest_id where s.lesson_id=p_id),'[]');
end $$;
create function public.review_class_attempt(p_submission uuid,p_feedback text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.lesson_submissions s join private.class_lessons l on l.id=s.lesson_id where s.id=p_submission and private.is_classroom_teacher(l.classroom_id) and fontex_beta.allowed(auth.uid())) then raise exception 'classroom_permission_denied' using errcode='42501';end if;
 update private.lesson_submissions set feedback=p_feedback,status='reviewed',updated_at=now() where id=p_submission and status<>'draft';
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('class-materials','class-materials',false,10485760,array['application/pdf']) on conflict(id) do nothing;
create policy class_material_teacher_insert on storage.objects for insert to authenticated with check(
 bucket_id='class-materials' and (storage.foldername(name))[2]=auth.uid()::text
 and fontex_beta.allowed(auth.uid()) and exists(select 1 from public.class_members where classroom_id::text=(storage.foldername(name))[1] and user_id=auth.uid() and role='teacher' and status='active')
);
create policy class_material_teacher_read on storage.objects for select to authenticated using(
 bucket_id='class-materials' and (storage.foldername(name))[2]=auth.uid()::text and fontex_beta.allowed(auth.uid())
);
create policy class_material_teacher_delete on storage.objects for delete to authenticated using(
 bucket_id='class-materials' and (storage.foldername(name))[2]=auth.uid()::text and fontex_beta.allowed(auth.uid())
 and not exists(select 1 from private.class_lessons l where l.attachments @> jsonb_build_array(jsonb_build_object('path',name)))
);
-- Storage policies must not expose the private lesson table to ordinary clients.
drop policy class_material_teacher_delete on storage.objects;
create function private.material_in_use(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.class_lessons where attachments @> jsonb_build_array(jsonb_build_object('path',p_name)))
$$;
create policy class_material_teacher_delete on storage.objects for delete to authenticated using(
 bucket_id='class-materials' and (storage.foldername(name))[2]=auth.uid()::text and fontex_beta.allowed(auth.uid()) and not private.material_in_use(name)
);
grant execute on function private.material_in_use(text) to authenticated;
create function public.class_material_access(p_id uuid,p_path text,p_user uuid,p_guest text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare l jsonb;
begin
 l:=private.learning_lesson(p_id,p_guest,p_user);
 return exists(select 1 from jsonb_array_elements(l->'attachments') a where a->>'path'=p_path);
end $$;

create function public.get_guest_ai_status(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.classroom_guests;
begin
 g:=private.learning_guest(p_token);
 if g.id is null then raise exception 'classroom_guest_expired' using errcode='42501';end if;
 perform 1 from private.classroom_guests where id=g.id for update;
 with expired as(update private.guest_ai_builds set state='refunded' where guest_id=g.id and state='pending' and created_at<now()-interval '100 seconds' returning id)
 update private.classroom_guests set ai_balance=ai_balance+(select count(*) from expired) where id=g.id;
 return (select jsonb_build_object('id',id,'balance',ai_balance,'initial_credits',5,'is_admin',false,'active_generation',exists(select 1 from private.guest_ai_builds where guest_id=g.id and state='pending')) from private.classroom_guests where id=g.id);
end $$;
create or replace function fontex_beta.reserve(p_user uuid,p_id uuid,p_task text,p_tokens integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare limits fontex_beta.runtime_limits%rowtype; reason text; user_hour bigint; user_day bigint; global_day bigint; tokens bigint;
begin
  if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if p_user is null or p_id is null or p_task not in ('chat','build') or p_task is null or p_tokens is null or p_tokens<1 or p_tokens>150000 then raise exception 'Invalid request reservation' using errcode='22023'; end if;
  select * into strict limits from fontex_beta.runtime_limits where id for update;
  if not fontex_beta.allowed(p_user) then reason:='beta_invitation_required';
  elsif not limits.ai_enabled then reason:='ai_paused'; end if;
  if reason is not null then return jsonb_build_object('allowed',false,'reason',reason); end if;
  delete from fontex_beta.requests where created_at<now()-interval '7 days';
  update fontex_beta.requests set status='expired' where status='pending' and expires_at<=now();
  if exists(select 1 from fontex_beta.requests where id=p_id) then reason:='duplicate_request';
  elsif exists(select 1 from fontex_beta.requests where user_id=p_user and status='pending') then reason:='request_busy';
  elsif (select count(*) from fontex_beta.requests where status='pending')+(select count(*) from private.guest_ai_requests where not finished and created_at>now()-interval '100 seconds')>=limits.max_global_concurrent then reason:='global_busy';
  end if;
  select count(*) filter(where user_id=p_user and created_at>=now()-interval '1 hour'),count(*) filter(where user_id=p_user),count(*),coalesce(sum(reserved_tokens),0)
    into user_hour,user_day,global_day,tokens from fontex_beta.requests where created_at>=now()-interval '24 hours';
  global_day:=global_day+(select count(*) from private.guest_ai_requests where created_at>=now()-interval '24 hours');
  tokens:=tokens+coalesce((select sum(gr.tokens) from private.guest_ai_requests gr where created_at>=now()-interval '24 hours'),0);
  if reason is null then
    if user_hour>=limits.max_user_hour or user_day>=limits.max_user_day then reason:='user_rate_limit';
    elsif global_day>=limits.max_global_day or tokens+p_tokens>limits.max_reserved_tokens_day then reason:='global_budget'; end if;
  end if;
  if reason is not null then return jsonb_build_object('allowed',false,'reason',reason); end if;
  insert into fontex_beta.requests(id,user_id,task,reserved_tokens) values(p_id,p_user,p_task,p_tokens);
  return jsonb_build_object('allowed',true,'reason','reserved');
end $$;

create function public.guest_ai_usage(p_token text,p_request uuid,p_task text default null,p_tokens integer default 0,p_finish boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.classroom_guests;limits fontex_beta.runtime_limits;
begin
 if p_finish then update private.guest_ai_requests set finished=true where id=p_request;return '{"allowed":true,"reason":"finished"}';end if;
 g:=private.learning_guest(p_token);
 if g.id is null then return '{"allowed":false,"reason":"guest_expired"}';end if;
 select * into strict limits from fontex_beta.runtime_limits where id for update;
 if not limits.ai_enabled then return '{"allowed":false,"reason":"ai_paused"}';end if;
 if p_request is null or p_task not in('chat','build') or p_tokens not between 1 and 150000 then raise exception 'Invalid reservation';end if;
 if (select count(*) from private.guest_ai_requests where guest_id=g.id and created_at>now()-interval '1 hour')>=limits.max_user_hour
 or (select count(*) from private.guest_ai_requests where guest_id=g.id and created_at>now()-interval '1 day')>=limits.max_user_day
 or (select count(*) from private.guest_ai_requests where not finished and created_at>now()-interval '100 seconds')+(select count(*) from fontex_beta.requests where status='pending' and expires_at>now())>=limits.max_global_concurrent
 or (select count(*) from private.guest_ai_requests where guest_id=g.id and not finished and created_at>now()-interval '100 seconds')>0
 or (select count(*) from private.guest_ai_requests where created_at>now()-interval '1 day')+(select count(*) from fontex_beta.requests where created_at>now()-interval '1 day')>=limits.max_global_day
 or coalesce((select sum(tokens) from private.guest_ai_requests where created_at>now()-interval '1 day'),0)+coalesce((select sum(reserved_tokens) from fontex_beta.requests where created_at>now()-interval '1 day'),0)+p_tokens>limits.max_reserved_tokens_day
 then return '{"allowed":false,"reason":"usage_limit"}';end if;
 insert into private.guest_ai_requests(id,guest_id,task,tokens) values(p_request,g.id,p_task,p_tokens);
 return '{"allowed":true,"reason":"reserved"}';
end $$;
create function public.guest_ai_build(p_token text,p_request uuid,p_operation text,p_scene jsonb default null,p_question text default null,p_reply jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.classroom_guests;b private.guest_ai_builds;
begin
 perform public.get_guest_ai_status(p_token);
 g:=private.learning_guest(p_token);
 perform 1 from private.classroom_guests where id=g.id for update;
 select * into b from private.guest_ai_builds where id=p_request;
 if p_operation='begin' then
  if b.id is not null then return jsonb_build_object('allowed',false,'balance',g.ai_balance,'reason','duplicate_request');end if;
  if g.ai_balance<1 then return jsonb_build_object('allowed',false,'balance',0,'reason','credits_exhausted');end if;
  if exists(select 1 from private.guest_ai_builds where guest_id=g.id and state='pending') then return jsonb_build_object('allowed',false,'balance',g.ai_balance,'reason','request_busy');end if;
  if octet_length(p_scene::text)>1048576 or length(p_question)>4000 then raise exception 'Build too large';end if;
  insert into private.guest_ai_builds(id,guest_id,source,question) values(p_request,g.id,p_scene,p_question);
  update private.classroom_guests set ai_balance=ai_balance-1 where id=g.id returning * into g;
  return jsonb_build_object('allowed',true,'balance',g.ai_balance,'reason','reserved');
 end if;
 if b.guest_id is distinct from g.id then raise exception 'classroom_permission_denied' using errcode='42501';end if;
 if b.state='pending' then
  if p_operation='complete' then
   update private.guest_ai_builds set reply=p_reply,state='ready' where id=b.id;
  elsif p_operation='fail' then
   update private.guest_ai_builds set state='refunded' where id=b.id;
   update private.classroom_guests set ai_balance=ai_balance+1 where id=g.id returning * into g;
  else raise exception 'Invalid operation';end if;
 end if;
 return jsonb_build_object('balance',g.ai_balance,'status',case when b.state='ready' or (b.state='pending' and p_operation='complete') then 'succeeded' else 'refunded' end);
end $$;
create function public.guest_canvas_receipts(p_token text,p_scene text default null,p_request uuid default null,p_ack boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.classroom_guests; result jsonb;
begin
 perform public.get_guest_ai_status(p_token);g:=private.learning_guest(p_token);
 if p_ack then update private.guest_ai_builds set applied_at=now() where id=p_request and guest_id=g.id and state='ready';return 'null';end if;
 if p_request is not null then
  select jsonb_build_object('id',id,'state',state,'source',source,'question',question,'reply',reply,'created_at',created_at,'applied_at',applied_at) into result from private.guest_ai_builds where id=p_request and guest_id=g.id;
  return result;
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'state',state,'created_at',created_at,'applied_at',applied_at)) from private.guest_ai_builds where guest_id=g.id and source->>'id'=p_scene),'[]');
end $$;

create function private.promote_guest_learning(p_guest uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare g private.classroom_guests;remaining integer;bonus integer;new_account boolean;
begin
 perform 1 from auth.users where id=p_user for update;
 select * into g from private.classroom_guests where id=p_guest for update;
 if g.claimed_by is distinct from p_user or g.promoted_at is null or not fontex_beta.allowed(p_user)
 or exists(select 1 from private.guest_credit_promotions where guest_id=g.id) then return;end if;
 remaining:=g.ai_balance+(select count(*) from private.guest_ai_builds where guest_id=g.id and state='pending');
 update private.guest_ai_builds set state='refunded' where guest_id=g.id and state='pending';
 select created_at>=g.created_at into new_account from auth.users where id=p_user;
 bonus:=case when new_account or exists(select 1 from private.guest_credit_promotions promotion where promotion.user_id=p_user and promotion.bonus>0) then 0 else 5 end;
 perform fontex_ai.ensure_wallet(p_user);
 perform 1 from fontex_ai.wallets where user_id=p_user for update;
 update fontex_ai.wallets set balance=balance+remaining+bonus,updated_at=now() where user_id=p_user;
 insert into fontex_ai.events(user_id,kind,delta,balance_after,reason)
 select p_user,'grant',remaining+bonus,balance,'Participación en aula: saldo conservado y bono de vinculación' from fontex_ai.wallets where user_id=p_user;
 insert into private.guest_credit_promotions(user_id,guest_id,transferred,bonus)
 values(p_user,g.id,remaining,case when new_account then 5 else bonus end);
 update private.classroom_guests set ai_balance=0 where id=g.id;
 update private.lesson_submissions s set user_id=p_user,guest_id=null where s.guest_id=g.id
 and not exists(select 1 from private.lesson_submissions old where old.lesson_id=s.lesson_id and old.user_id=p_user);
end $$;
revoke all on function private.promote_guest_learning(uuid,uuid) from public,anon,authenticated;
create function private.confirm_guest_learning() returns trigger
language plpgsql security definer set search_path='' as $$
declare g record;
begin
 if new.email_confirmed_at is null or not fontex_beta.allowed(new.id) then return new;end if;
 for g in select id from private.classroom_guests where claimed_by=new.id and promoted_at is not null
 loop perform private.promote_guest_learning(g.id,new.id);end loop;
 return new;
end $$;
revoke all on function private.confirm_guest_learning() from public,anon,authenticated;
-- Runs after the existing confirmation/enrollment trigger, also on another device.
create trigger zzz_confirm_guest_learning after insert or update of email_confirmed_at on auth.users
for each row execute function private.confirm_guest_learning();
alter function public.complete_classroom_guest(text) rename to complete_classroom_guest_before_learning;
revoke all on function public.complete_classroom_guest_before_learning(text) from public,anon,authenticated;
create function public.complete_classroom_guest(p_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare g private.classroom_guests;result uuid;
begin
 perform 1 from auth.users where id=auth.uid() for update;
 select * into g from private.classroom_guests where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if g.id is null then raise exception 'classroom_guest_expired' using errcode='42501';end if;
 if exists(select 1 from private.guest_ai_builds where guest_id=g.id and state='pending' and created_at>now()-interval '100 seconds') then raise exception 'Espera a que termine la generación de IA.';end if;
 result:=public.complete_classroom_guest_before_learning(p_token);
 perform private.promote_guest_learning(g.id,auth.uid());
 return result;
end $$;

create function public.class_notification_batch(p_lesson uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l private.class_lessons;items jsonb;remaining integer;
begin
 select * into l from private.class_lessons where id=p_lesson;
 if l.created_by is distinct from p_user or not fontex_beta.allowed(p_user) then raise exception 'classroom_permission_denied' using errcode='42501';end if;
 update private.lesson_notifications n set status='skipped',updated_at=now() where lesson_id=p_lesson and status in('pending','failed','sending') and (not exists(select 1 from public.class_members m where m.classroom_id=l.classroom_id and m.user_id=n.user_id and m.status='active') or not exists(select 1 from auth.users u where u.id=n.user_id and u.email_confirmed_at is not null));
 update private.lesson_notifications set status='pending' where lesson_id=p_lesson and status='sending' and updated_at<now()-interval '10 minutes';
 items:=coalesce((with picked as (select id from private.lesson_notifications where lesson_id=p_lesson and status in('pending','failed') order by updated_at limit 50 for update skip locked),
 claimed as(update private.lesson_notifications set status='sending',updated_at=now() where id in(select id from picked) returning *)
 select jsonb_agg(jsonb_build_object('id',n.id,'email',u.email,'title',l.title)) from claimed n join auth.users u on u.id=n.user_id where u.email_confirmed_at is not null),'[]');
 select count(*) into remaining from private.lesson_notifications where lesson_id=p_lesson and status not in('sent','skipped');
 return jsonb_build_object('items',items,'remaining',remaining);
end $$;
create function public.finish_class_notification(p_id uuid,p_success boolean) returns void
language sql security definer set search_path='' as $$update private.lesson_notifications set status=case when p_success then 'sent' else 'failed' end,updated_at=now() where id=p_id and status='sending'$$;

create or replace function fontex_beta.check_request() returns void language plpgsql security definer set search_path='' as $$
declare path text:=ltrim(coalesce(current_setting('request.path',true),''),'/');
begin
 if path in('rpc/get_classroom_join_info','rpc/start_classroom_guest','rpc/get_classroom_guest','rpc/join_classroom_by_invite','rpc/complete_classroom_guest','rpc/list_class_lessons','rpc/get_class_lesson','rpc/get_guest_ai_status','rpc/guest_canvas_receipts','rpc/class_learning_contract') then return;end if;
 perform fontex_beta.check_request_before_classroom_guests();
end $$;
-- No direct client access to the private learning data. Only narrowly checked RPCs.

revoke all on function private.learning_guest(text),private.learning_allowed(uuid,text,uuid),private.learning_lesson(uuid,text,uuid) from public,anon,authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(
 'teacher_classrooms','publish_class_lesson','list_class_lessons','get_class_lesson','class_lesson_for_service','save_class_attempt','class_lesson_submissions','review_class_attempt','class_material_access','get_guest_ai_status','guest_ai_usage','guest_ai_build','guest_canvas_receipts','complete_classroom_guest','class_notification_batch','finish_class_notification')
 loop execute format('revoke all on function %s from public,anon,authenticated',f.name);execute format('grant execute on function %s to service_role',f.name);end loop;
end $$;
grant execute on function public.teacher_classrooms(),public.publish_class_lesson(uuid,text,text,text,date,integer,text,timestamptz,jsonb),public.class_lesson_submissions(uuid),public.review_class_attempt(uuid,text),public.complete_classroom_guest(text) to authenticated;
grant execute on function public.list_class_lessons(uuid,text),public.get_class_lesson(uuid,text),public.get_guest_ai_status(text),public.guest_canvas_receipts(text,text,uuid,boolean) to anon,authenticated;
-- SMTP stays encrypted in Vault (or can be supplied as an Edge Function secret).
-- Only the trusted server can decrypt it. No browser role can call this RPC.
create function public.class_smtp_password() returns text language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 return (select decrypted_secret from vault.decrypted_secrets where name='fontex_smtp_password' limit 1);
end $$;
revoke all on function public.class_smtp_password() from public,anon,authenticated;
grant execute on function public.class_smtp_password() to service_role;
create function public.class_learning_contract() returns text language sql immutable set search_path='' as $$select 'classroom-learning-v092'::text$$;
revoke all on function public.class_learning_contract() from public;
grant execute on function public.class_learning_contract() to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
