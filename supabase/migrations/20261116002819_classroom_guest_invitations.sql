SET local check_function_bodies = off;

GRANT EXECUTE ON FUNCTION "fontex_beta"."check_request"() TO "service_role";

CREATE TABLE "private"."classroom_guests" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "link_id"      uuid                     NOT NULL,
  "token_hash"   text                     NOT NULL,
  "display_name" text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"   timestamp with time zone NOT NULL,
  "claimed_by"   uuid,
  "promoted_at"  timestamp with time zone,
  CONSTRAINT "classroom_guests_display_name_check" CHECK (((char_length(display_name) >= 1) AND (char_length(display_name) <= 80))),
  CONSTRAINT "classroom_guests_pkey" PRIMARY KEY (id),
  CONSTRAINT "classroom_guests_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "private"."classroom_guests"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."classroom_join_links" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "classroom_id" uuid                     NOT NULL,
  "token_hash"   text                     NOT NULL,
  "code_hash"    text                     NOT NULL,
  "created_by"   uuid                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"   timestamp with time zone NOT NULL,
  "revoked_at"   timestamp with time zone,
  CONSTRAINT "classroom_join_links_code_hash_key" UNIQUE (code_hash),
  CONSTRAINT "classroom_join_links_pkey" PRIMARY KEY (id),
  CONSTRAINT "classroom_join_links_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "private"."classroom_join_links"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION fontex_beta.admit_signup()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare inviter uuid; guest_id uuid;
begin
  select l.created_by,g.id into inviter,guest_id from private.classroom_guests g join private.classroom_join_links l on l.id=g.link_id
    where g.token_hash=encode(extensions.digest(new.raw_user_meta_data->>'classroom_guest_token','sha256'),'hex')
    and g.claimed_by is null and g.expires_at>now() and l.expires_at>now() and l.revoked_at is null for update of g;
  if found then
    insert into fontex_beta.members(user_id,granted_by) values(new.id,inviter);
    update private.classroom_guests set claimed_by=new.id where id=guest_id;
    return new;
  end if;
  select invited_by into inviter from fontex_beta.invitations where email=lower(btrim(new.email)) and enabled and expires_at>now() for update;
  if not found then return new; end if;
  insert into fontex_beta.members(user_id,granted_by) values(new.id,inviter);
  update fontex_beta.invitations set enabled=false where email=lower(btrim(new.email));
  return new;
end $function$;

CREATE OR REPLACE FUNCTION fontex_beta.check_request()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare path text:=ltrim(coalesce(current_setting('request.path',true),''),'/');
begin
  if path in ('rpc/get_classroom_join_info','rpc/start_classroom_guest','rpc/get_classroom_guest','rpc/join_classroom_by_invite','rpc/complete_classroom_guest') then return; end if;
  perform fontex_beta.check_request_before_classroom_guests();
end $function$;

CREATE OR REPLACE FUNCTION fontex_beta.check_request_before_classroom_guests()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  path text:=ltrim(coalesce(current_setting('request.path',true),''),'/');
  headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  profile text;
begin
  if current_setting('role',true)='service_role' then return; end if;
  -- PostgREST selects Accept-Profile for reads and Content-Profile for writes.
  -- Checking either header indiscriminately would let a conflicting header
  -- bypass the guard on a request that actually targets public.
  if current_setting('request.method',true) in ('GET','HEAD') then
    profile:=coalesce(headers->>'accept-profile','public');
  else
    profile:=coalesce(headers->>'content-profile','public');
  end if;
  if profile='forma' or path='forma_connection_checks' then return; end if;
  if path in ('rpc/get_release_contract','rpc/read_public_canvas') then return; end if;
  if current_setting('role',true)='authenticated' and path='rpc/get_beta_access_status' then return; end if;
  if not fontex_beta.allowed(auth.uid()) then
    raise exception 'beta_invitation_required' using errcode='42501';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION fontex_beta.check_signup()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform 1 from private.classroom_guests g join private.classroom_join_links l on l.id=g.link_id
    where g.token_hash=encode(extensions.digest(new.raw_user_meta_data->>'classroom_guest_token','sha256'),'hex')
    and g.claimed_by is null and g.expires_at>now() and l.expires_at>now() and l.revoked_at is null for update of g;
  if found then return new; end if;
  perform 1 from fontex_beta.invitations where email=lower(btrim(new.email)) and enabled and expires_at>now() for update;
  if not found then raise exception 'Beta cerrada: se requiere invitación para este correo' using errcode='42501'; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.classroom_link (
  p_invite text
)
  RETURNS private.classroom_join_links
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select l from private.classroom_join_links l
  where l.revoked_at is null and l.expires_at > now() and (
    l.token_hash=encode(extensions.digest(lower(btrim(p_invite)), 'sha256'),'hex') or
    (regexp_replace(p_invite,'[-[:space:]]','','g') ~ '^[a-fA-F0-9]{12}$' and
     l.code_hash=encode(extensions.digest(lower(regexp_replace(p_invite,'[-[:space:]]','','g')),'sha256'),'hex')))
$function$;

CREATE OR REPLACE FUNCTION private.enroll_classroom_student (
  p_classroom_id uuid,
  p_inviter      uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'classroom_verified_account_required' using errcode='42501';
  end if;
  -- A revoked beta account cannot use a class link to reactivate itself.
  if exists(select 1 from fontex_beta.members where user_id=auth.uid() and not active) then
    raise exception 'classroom_permission_denied' using errcode='42501';
  end if;
  if exists(select 1 from public.class_members where classroom_id=p_classroom_id and user_id=auth.uid() and status='removed') then
    raise exception 'classroom_membership_removed' using errcode='42501';
  end if;
  insert into fontex_beta.members(user_id,granted_by) values(auth.uid(),p_inviter) on conflict(user_id) do nothing;
  insert into public.class_members(classroom_id,user_id,role,status,invited_by)
  values(p_classroom_id,auth.uid(),'student','active',p_inviter) on conflict(classroom_id,user_id) do nothing;
end $function$;

CREATE OR REPLACE FUNCTION public.complete_classroom_guest (
  p_token text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare guest private.classroom_guests; link private.classroom_join_links;
begin
  select * into guest from private.classroom_guests where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
  select * into link from private.classroom_join_links where id=guest.link_id;
  if guest.id is null or auth.uid() is null or (guest.claimed_by is not null and guest.claimed_by<>auth.uid()) or link.revoked_at is not null
    or (guest.claimed_by is null and (guest.expires_at<=now() or link.expires_at<=now()))
    or (guest.claimed_by is not null and guest.created_at+interval '8 days'<=now()) then
    raise exception 'classroom_guest_expired' using errcode='42501';
  end if;
  perform private.enroll_classroom_student(link.classroom_id,link.created_by);
  update private.classroom_guests set claimed_by=auth.uid(),promoted_at=coalesce(promoted_at,now()) where id=guest.id;
  return link.classroom_id;
end $function$;

REVOKE ALL ON FUNCTION "public"."complete_classroom_guest"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.create_classroom_join_link (
  p_classroom_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare raw_token text; raw_code text; result private.classroom_join_links;
begin
  if not fontex_beta.allowed(auth.uid()) or not private.is_classroom_teacher(p_classroom_id) then
    raise exception 'classroom_permission_denied' using errcode='42501';
  end if;
  -- Serialize rotation so two clicks cannot leave two active links.
  perform 1 from public.classrooms where id=p_classroom_id for update;
  update private.classroom_join_links set revoked_at=now() where classroom_id=p_classroom_id and revoked_at is null;
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  raw_code:=encode(extensions.gen_random_bytes(6),'hex');
  insert into private.classroom_join_links(classroom_id,token_hash,code_hash,created_by,expires_at)
  values(p_classroom_id,encode(extensions.digest(raw_token,'sha256'),'hex'),encode(extensions.digest(raw_code,'sha256'),'hex'),auth.uid(),now()+interval '7 days') returning * into result;
  return jsonb_build_object('id',result.id,'token',raw_token,'code',upper(substr(raw_code,1,4)||'-'||substr(raw_code,5,4)||'-'||substr(raw_code,9,4)),'expires_at',result.expires_at);
end $function$;

REVOKE ALL ON FUNCTION "public"."create_classroom_join_link"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.get_classroom_guest (
  p_token text
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object('id',g.id,'display_name',g.display_name,'classroom_id',l.classroom_id,'title',c.title,'expires_at',g.expires_at)
  from private.classroom_guests g join private.classroom_join_links l on l.id=g.link_id join public.classrooms c on c.id=l.classroom_id
  where g.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and g.expires_at>now() and l.expires_at>now() and l.revoked_at is null and g.promoted_at is null
$function$;

CREATE OR REPLACE FUNCTION public.get_classroom_join_info (
  p_invite text
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object('id',c.id,'title',c.title,'term',c.term,'expires_at',l.expires_at)
  from private.classroom_link(p_invite) l join public.classrooms c on c.id=l.classroom_id
$function$;

CREATE OR REPLACE FUNCTION public.join_classroom_by_invite (
  p_invite text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare link private.classroom_join_links;
begin
  link:=private.classroom_link(p_invite);
  if link.id is null then raise exception 'classroom_invite_expired' using errcode='22023'; end if;
  perform private.enroll_classroom_student(link.classroom_id,link.created_by);
  return link.classroom_id;
end $function$;

REVOKE ALL ON FUNCTION "public"."join_classroom_by_invite"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.list_classroom_guests (
  p_classroom_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not fontex_beta.allowed(auth.uid()) or not private.is_classroom_teacher(p_classroom_id) then
    raise exception 'classroom_permission_denied' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'display_name',g.display_name,'expires_at',g.expires_at) order by g.created_at)
    from private.classroom_guests g join private.classroom_join_links l on l.id=g.link_id
    where l.classroom_id=p_classroom_id and l.revoked_at is null and l.expires_at>now() and g.expires_at>now() and g.promoted_at is null),'[]'::jsonb);
end $function$;

REVOKE ALL ON FUNCTION "public"."list_classroom_guests"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.revoke_classroom_join_link (
  p_classroom_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not fontex_beta.allowed(auth.uid()) or not private.is_classroom_teacher(p_classroom_id) then
    raise exception 'classroom_permission_denied' using errcode='42501';
  end if;
  update private.classroom_join_links set revoked_at=now() where classroom_id=p_classroom_id and revoked_at is null;
end $function$;

REVOKE ALL ON FUNCTION "public"."revoke_classroom_join_link"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.start_classroom_guest (
  p_invite text,
  p_name   text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare link private.classroom_join_links; guest private.classroom_guests; raw_token text; title text;
begin
  link:=private.classroom_link(p_invite);
  if link.id is null then raise exception 'classroom_invite_expired' using errcode='22023'; end if;
  if char_length(btrim(p_name)) not between 1 and 80 or p_name is null then
    raise exception 'classroom_name_required' using errcode='22023';
  end if;
  perform 1 from private.classroom_join_links where id=link.id for update;
  if (select count(*) from private.classroom_guests where link_id=link.id) >= 500 then
    raise exception 'classroom_guest_limit' using errcode='54000';
  end if;
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into private.classroom_guests(link_id,token_hash,display_name,expires_at)
  values(link.id,encode(extensions.digest(raw_token,'sha256'),'hex'),btrim(p_name),least(now()+interval '8 hours',link.expires_at)) returning * into guest;
  select c.title into title from public.classrooms c where c.id=link.classroom_id;
  return jsonb_build_object('id',guest.id,'token',raw_token,'display_name',guest.display_name,'classroom_id',link.classroom_id,'title',title,'expires_at',guest.expires_at);
end $function$;

ALTER TABLE "private"."classroom_guests"
  ADD CONSTRAINT "classroom_guests_claimed_by_fkey" FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "private"."classroom_join_links"
  ADD CONSTRAINT "classroom_join_links_classroom_id_fkey" FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;

ALTER TABLE "private"."classroom_join_links"
  ADD CONSTRAINT "classroom_join_links_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE "private"."classroom_guests"
  ADD CONSTRAINT "classroom_guests_link_id_fkey" FOREIGN KEY (link_id) REFERENCES private.classroom_join_links(id) ON DELETE CASCADE;

CREATE INDEX classroom_guests_claimed_by_idx ON private.classroom_guests USING btree (claimed_by);

CREATE INDEX classroom_guests_link_idx ON private.classroom_guests USING btree (link_id);

CREATE UNIQUE INDEX classroom_join_links_active_idx ON private.classroom_join_links USING btree (classroom_id)
  WHERE (revoked_at IS NULL);

CREATE INDEX classroom_join_links_created_by_idx ON private.classroom_join_links USING btree (created_by);

REVOKE ALL ON FUNCTION "fontex_beta"."check_request_before_classroom_guests"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "fontex_beta"."check_request_before_classroom_guests"() TO "anon", "authenticated", "service_role";

REVOKE ALL ON FUNCTION "private"."classroom_link"(text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."enroll_classroom_student"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."complete_classroom_guest"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."complete_classroom_guest"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."complete_classroom_guest"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."complete_classroom_guest"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_classroom_join_link"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_classroom_join_link"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_classroom_join_link"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_classroom_join_link"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_classroom_guest"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_classroom_guest"(text) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_classroom_guest"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_classroom_guest"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_classroom_guest"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_classroom_join_info"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_classroom_join_info"(text) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."get_classroom_join_info"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_classroom_join_info"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_classroom_join_info"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."join_classroom_by_invite"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."join_classroom_by_invite"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."join_classroom_by_invite"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."join_classroom_by_invite"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."list_classroom_guests"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."list_classroom_guests"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."list_classroom_guests"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."list_classroom_guests"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."revoke_classroom_join_link"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."revoke_classroom_join_link"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."revoke_classroom_join_link"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."revoke_classroom_join_link"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."start_classroom_guest"(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."start_classroom_guest"(text, text) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."start_classroom_guest"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."start_classroom_guest"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."start_classroom_guest"(text, text) TO "service_role";
create function private.confirm_classroom_guest() returns trigger
language plpgsql security definer set search_path='' as $$
declare guest record;
begin
  if new.email_confirmed_at is null or not fontex_beta.allowed(new.id) then return new; end if;
  -- Complete enrollment when email is confirmed, including on another device.
  -- The canvas copy remains on the original browser until its owner imports it.
  for guest in select g.id,l.classroom_id,l.created_by from private.classroom_guests g
    join private.classroom_join_links l on l.id=g.link_id
    where g.claimed_by=new.id and g.promoted_at is null and l.revoked_at is null
    and g.created_at>now()-interval '8 days'
    and not exists(select 1 from public.class_members m where m.classroom_id=l.classroom_id and m.user_id=new.id and m.status='removed')
  loop
    insert into public.class_members(classroom_id,user_id,role,status,invited_by)
    values(guest.classroom_id,new.id,'student','active',guest.created_by) on conflict(classroom_id,user_id) do nothing;
    update private.classroom_guests set promoted_at=now() where id=guest.id;
  end loop;
  return new;
end $$;
revoke all on function private.confirm_classroom_guest() from public,anon,authenticated;
-- Auth insert triggers run alphabetically; the profile must already exist.
create trigger zz_confirm_classroom_guest after insert or update of email_confirmed_at on auth.users
for each row execute function private.confirm_classroom_guest();

notify pgrst, 'reload schema';
