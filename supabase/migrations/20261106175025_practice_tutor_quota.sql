create table public.practice_tutor_quota (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hour_start timestamptz not null,
  day_start timestamptz not null,
  hourly_requests integer not null check (hourly_requests between 1 and 10),
  daily_requests integer not null check (daily_requests between 1 and 25)
);

alter table public.practice_tutor_quota enable row level security;
revoke all on public.practice_tutor_quota from public, anon, authenticated;
grant select, insert, update on public.practice_tutor_quota to service_role;

create function public.take_practice_tutor_quota(p_user_id uuid)
returns boolean
language sql
set search_path = ''
as $$
  with consumed as (
    insert into public.practice_tutor_quota as quota
      (user_id, hour_start, day_start, hourly_requests, daily_requests)
    values (
      p_user_id,
      date_trunc('hour', statement_timestamp(), 'UTC'),
      date_trunc('day', statement_timestamp(), 'UTC'),
      1,
      1
    )
    on conflict (user_id) do update set
      hourly_requests = case when quota.hour_start = excluded.hour_start then quota.hourly_requests + 1 else 1 end,
      daily_requests = case when quota.day_start = excluded.day_start then quota.daily_requests + 1 else 1 end,
      hour_start = excluded.hour_start,
      day_start = excluded.day_start
    where quota.hour_start <= excluded.hour_start
      and quota.day_start <= excluded.day_start
      and (quota.hour_start <> excluded.hour_start or quota.hourly_requests < 10)
      and (quota.day_start <> excluded.day_start or quota.daily_requests < 25)
    returning 1
  )
  select exists (select 1 from consumed);
$$;

revoke all on function public.take_practice_tutor_quota(uuid) from public, anon, authenticated;
grant execute on function public.take_practice_tutor_quota(uuid) to service_role;
