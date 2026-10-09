begin;

create type public.document_status as enum ('pending', 'uploading', 'ready', 'failed');
create type public.document_share_scope as enum ('group', 'classroom');

create table public.document_limits (
  id smallint primary key default 1 check (id = 1),
  max_file_bytes bigint not null check (max_file_bytes between 1 and 52428800),
  max_pages integer not null check (max_pages between 1 and 1000),
  max_documents_per_user integer not null check (max_documents_per_user between 1 and 1000),
  max_bytes_per_user bigint not null check (max_bytes_per_user >= max_file_bytes),
  max_bytes_per_classroom bigint not null check (max_bytes_per_classroom >= max_file_bytes),
  max_bytes_global bigint not null check (max_bytes_global >= max_bytes_per_classroom),
  updated_at timestamptz not null default now()
);

insert into public.document_limits (
  max_file_bytes,
  max_pages,
  max_documents_per_user,
  max_bytes_per_user,
  max_bytes_per_classroom,
  max_bytes_global
)
values (
  5242880,
  100,
  10,
  52428800,
  524288000,
  786432000
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  classroom_id uuid not null references public.classrooms (id) on delete restrict,
  title text not null check (
    title = btrim(title)
    and char_length(title) between 1 and 180
  ),
  original_filename text not null check (
    original_filename = btrim(original_filename)
    and char_length(original_filename) between 1 and 255
    and original_filename !~ '[/\\]'
  ),
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  page_count integer not null check (page_count between 1 and 100),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]pdf$'
  ),
  status public.document_status not null default 'pending',
  failure_code text check (failure_code is null or char_length(failure_code) between 1 and 80),
  upload_expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (upload_expires_at >= created_at),
  check (status = 'failed' or failure_code is null)
);

create table public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  scope_type public.document_share_scope not null,
  classroom_id uuid references public.classrooms (id) on delete cascade,
  group_id uuid references public.study_groups (id) on delete cascade,
  granted_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (scope_type = 'classroom' and classroom_id is not null and group_id is null)
    or (scope_type = 'group' and group_id is not null and classroom_id is null)
  )
);

create index documents_owner_status_created_idx
  on public.documents (owner_id, status, created_at desc);
create index documents_classroom_status_created_idx
  on public.documents (classroom_id, status, created_at desc);
create unique index documents_owner_classroom_hash_active_idx
  on public.documents (owner_id, classroom_id, content_sha256)
  where status in ('pending', 'uploading', 'ready');
create index document_shares_document_id_idx
  on public.document_shares (document_id);
create index document_shares_granted_by_idx
  on public.document_shares (granted_by);
create unique index document_shares_unique_classroom_idx
  on public.document_shares (document_id, classroom_id)
  where scope_type = 'classroom';
create unique index document_shares_unique_group_idx
  on public.document_shares (document_id, group_id)
  where scope_type = 'group';
create index document_shares_classroom_lookup_idx
  on public.document_shares (classroom_id, document_id)
  where scope_type = 'classroom';
create index document_shares_group_lookup_idx
  on public.document_shares (group_id, document_id)
  where scope_type = 'group';

create trigger documents_set_updated_at
before update on public.documents
for each row execute function private.set_updated_at();

create trigger document_limits_set_updated_at
before update on public.document_limits
for each row execute function private.set_updated_at();

create or replace function private.can_access_document(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.documents document
    where document.id = target_document_id
      and (
        document.owner_id = (select auth.uid())
        or (
          document.status = 'ready'
          and exists (
            select 1
            from public.document_shares share
            join public.class_members membership
              on membership.classroom_id = document.classroom_id
             and membership.user_id = (select auth.uid())
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
                     and group_membership.user_id = (select auth.uid())
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

create or replace function private.can_share_document(
  target_document_id uuid,
  target_scope public.document_share_scope,
  target_classroom_id uuid,
  target_group_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.documents document
    join public.class_members membership
      on membership.classroom_id = document.classroom_id
     and membership.user_id = (select auth.uid())
     and membership.status = 'active'
    where document.id = target_document_id
      and document.owner_id = (select auth.uid())
      and document.status = 'ready'
      and (
        (
          target_scope = 'classroom'
          and target_classroom_id = document.classroom_id
          and target_group_id is null
          and membership.role = 'teacher'
        )
        or (
          target_scope = 'group'
          and target_classroom_id is null
          and exists (
            select 1
            from public.study_groups study_group
            join public.group_members group_membership
              on group_membership.group_id = study_group.id
             and group_membership.user_id = (select auth.uid())
            where study_group.id = target_group_id
              and study_group.classroom_id = document.classroom_id
          )
        )
      )
  );
$$;

create or replace function private.can_download_document_object(target_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.documents document
    where document.storage_path = target_storage_path
      and document.status = 'ready'
      and (select private.can_access_document(document.id))
  );
$$;

revoke all on function private.can_access_document(uuid) from public, anon;
revoke all on function private.can_share_document(uuid, public.document_share_scope, uuid, uuid) from public, anon;
revoke all on function private.can_download_document_object(text) from public, anon;
grant execute on function private.can_access_document(uuid) to authenticated;
grant execute on function private.can_share_document(uuid, public.document_share_scope, uuid, uuid) to authenticated;
grant execute on function private.can_download_document_object(text) to authenticated;

create or replace function private.validate_document_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_record public.documents%rowtype;
  group_classroom_id uuid;
begin
  select * into document_record
  from public.documents
  where id = new.document_id;

  if not found then
    raise exception 'document not found' using errcode = '23503';
  end if;

  if new.granted_by <> document_record.owner_id then
    raise exception 'only the document owner can grant access' using errcode = '42501';
  end if;

  if new.scope_type = 'classroom' then
    if new.classroom_id is distinct from document_record.classroom_id or new.group_id is not null then
      raise exception 'classroom share must match the document classroom' using errcode = '23514';
    end if;
  else
    select classroom_id into group_classroom_id
    from public.study_groups
    where id = new.group_id;

    if group_classroom_id is null
      or group_classroom_id <> document_record.classroom_id
      or new.classroom_id is not null then
      raise exception 'group share must belong to the document classroom' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_document_share() from public, anon, authenticated;

create trigger document_shares_validate
before insert or update on public.document_shares
for each row execute function private.validate_document_share();

alter table public.document_limits enable row level security;
alter table public.documents enable row level security;
alter table public.document_shares enable row level security;

revoke all on table public.document_limits from anon, authenticated;
revoke all on table public.documents from anon, authenticated;
revoke all on table public.document_shares from anon, authenticated;

grant select on table public.document_limits to authenticated;
grant select on table public.documents to authenticated;
grant select, insert, delete on table public.document_shares to authenticated;

create policy document_limits_select_authenticated
on public.document_limits for select
to authenticated
using (true);

create policy documents_select_authorized
on public.documents for select
to authenticated
using ((select private.can_access_document(id)));

create policy document_shares_select_authorized
on public.document_shares for select
to authenticated
using ((select private.can_access_document(document_id)));

create policy document_shares_insert_owner
on public.document_shares for insert
to authenticated
with check (
  granted_by = (select auth.uid())
  and (select private.can_share_document(document_id, scope_type, classroom_id, group_id))
);

create policy document_shares_delete_owner
on public.document_shares for delete
to authenticated
using (
  exists (
    select 1
    from public.documents document
    where document.id = document_id
      and document.owner_id = (select auth.uid())
  )
);

create or replace function public.reserve_document_upload(
  target_classroom_id uuid,
  document_title text,
  source_filename text,
  source_mime_type text,
  source_size_bytes bigint,
  source_page_count integer,
  source_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  limits public.document_limits%rowtype;
  document_id uuid := gen_random_uuid();
  object_id uuid := gen_random_uuid();
  normalized_hash text := lower(btrim(source_sha256));
  current_document_count integer;
  current_user_bytes bigint;
  current_classroom_bytes bigint;
  current_global_bytes bigint;
  expires_at timestamptz := now() + interval '30 minutes';
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.class_members membership
    where membership.classroom_id = target_classroom_id
      and membership.user_id = caller_id
      and membership.status = 'active'
  ) then
    raise exception 'active classroom membership required' using errcode = '42501';
  end if;

  select * into strict limits from public.document_limits where id = 1;

  if source_mime_type <> 'application/pdf' then
    raise exception 'only application/pdf is accepted' using errcode = '22023';
  end if;
  if source_size_bytes < 1 or source_size_bytes > limits.max_file_bytes then
    raise exception 'document exceeds the allowed file size' using errcode = '22023';
  end if;
  if source_page_count < 1 or source_page_count > limits.max_pages then
    raise exception 'document exceeds the allowed page count' using errcode = '22023';
  end if;
  if normalized_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid document hash' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fontex:documents:global', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fontex:documents:classroom:' || target_classroom_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('fontex:documents:user:' || caller_id::text, 0)
  );

  select count(*)::integer, coalesce(sum(size_bytes), 0)
  into current_document_count, current_user_bytes
  from public.documents
  where owner_id = caller_id
    and status in ('pending', 'uploading', 'ready');

  select coalesce(sum(size_bytes), 0)
  into current_classroom_bytes
  from public.documents
  where classroom_id = target_classroom_id
    and status in ('pending', 'uploading', 'ready');

  select coalesce(sum(size_bytes), 0)
  into current_global_bytes
  from public.documents
  where status in ('pending', 'uploading', 'ready');

  if current_document_count >= limits.max_documents_per_user then
    raise exception 'document count quota exceeded' using errcode = '54000';
  end if;
  if current_user_bytes + source_size_bytes > limits.max_bytes_per_user then
    raise exception 'user storage quota exceeded' using errcode = '54000';
  end if;
  if current_classroom_bytes + source_size_bytes > limits.max_bytes_per_classroom then
    raise exception 'classroom storage quota exceeded' using errcode = '54000';
  end if;
  if current_global_bytes + source_size_bytes > limits.max_bytes_global then
    raise exception 'global storage quota exceeded' using errcode = '54000';
  end if;

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
    status,
    upload_expires_at
  )
  values (
    document_id,
    caller_id,
    target_classroom_id,
    btrim(document_title),
    btrim(source_filename),
    source_mime_type,
    source_size_bytes,
    source_page_count,
    normalized_hash,
    document_id::text || '/' || object_id::text || '.pdf',
    'pending',
    expires_at
  );

  return jsonb_build_object(
    'document_id', document_id,
    'storage_path', document_id::text || '/' || object_id::text || '.pdf',
    'expires_at', expires_at
  );
exception
  when unique_violation then
    raise exception 'an active copy of this document already exists' using errcode = '23505';
end;
$$;

revoke all on function public.reserve_document_upload(uuid, text, text, text, bigint, integer, text)
  from public, anon, authenticated;
grant execute on function public.reserve_document_upload(uuid, text, text, text, bigint, integer, text)
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'fontex-documents',
  'fontex-documents',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();

create policy fontex_documents_download_authorized
on storage.objects for select
to authenticated
using (
  bucket_id = 'fontex-documents'
  and storage.allow_only_operation('object.get_authenticated')
  and (select private.can_download_document_object(name))
);

create table private.workspace_bootstrap_authorizations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  authorized_at timestamptz not null default now()
);

revoke all on table private.workspace_bootstrap_authorizations from public, anon, authenticated;

with existing_user as (
  select id
  from auth.users
  order by created_at, id
  limit 2
)
insert into private.workspace_bootstrap_authorizations (user_id)
select id
from existing_user
where (select count(*) from existing_user) = 1
  and not exists (select 1 from public.organizations);

create or replace function public.create_workspace(
  organization_name text,
  classroom_title text,
  classroom_term text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  organization_id uuid;
  classroom_id uuid;
  caller_is_teacher boolean;
  workspace_exists boolean;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('fontex:first-workspace'));

  select exists (select 1 from public.organizations) into workspace_exists;
  select exists (
    select 1
    from public.class_members membership
    where membership.user_id = caller_id
      and membership.role = 'teacher'
      and membership.status = 'active'
  ) into caller_is_teacher;

  if not workspace_exists then
    if not exists (
      select 1
      from private.workspace_bootstrap_authorizations bootstrap_auth
      where bootstrap_auth.user_id = caller_id
    ) then
      raise exception 'workspace bootstrap requires prior authorization'
        using errcode = '42501';
    end if;

    delete from private.workspace_bootstrap_authorizations
    where user_id = caller_id;
  elsif not caller_is_teacher then
    raise exception 'an active teacher role is required to create another workspace'
      using errcode = '42501';
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(organization_name), caller_id)
  returning id into organization_id;

  insert into public.classrooms (organization_id, title, term, owner_id)
  values (
    organization_id,
    btrim(classroom_title),
    nullif(btrim(classroom_term), ''),
    caller_id
  )
  returning id into classroom_id;

  return classroom_id;
end;
$$;

revoke all on function public.create_workspace(text, text, text) from public, anon, authenticated;
grant execute on function public.create_workspace(text, text, text) to authenticated;

commit;
