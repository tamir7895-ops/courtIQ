-- =============================================================================
-- BASELINE — core schema as it exists in production (introspected 2026-07-13).
-- The original March-2026 migrations (add_weeks_update_policy,
-- update_handle_new_user_trigger, add_user_data_and_shot_sessions) were
-- applied straight from the dashboard and never committed; this file lets a
-- fresh project bootstrap to the same state. Idempotent by construction.
-- =============================================================================

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text not null default '',
  last_name   text not null default '',
  position    text not null default 'Point Guard',
  skill_level text not null default 'Intermediate',
  goal        text not null default 'All-Around Improvement',
  plan        text not null default 'starter',
  streak      integer not null default 0,
  user_data   jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- ── training_weeks ──────────────────────────────────────────────────────────
create table if not exists public.training_weeks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id),
  week_number  integer not null,
  label        text not null,
  summary_json jsonb,
  created_at   timestamptz not null default now()
);
alter table public.training_weeks enable row level security;
drop policy if exists "weeks: select own" on public.training_weeks;
create policy "weeks: select own" on public.training_weeks
  for select using (auth.uid() = user_id);
drop policy if exists "weeks: insert own" on public.training_weeks;
create policy "weeks: insert own" on public.training_weeks
  for insert with check (auth.uid() = user_id);
drop policy if exists "weeks: update own" on public.training_weeks;
create policy "weeks: update own" on public.training_weeks
  for update using (auth.uid() = user_id);
drop policy if exists "weeks: delete own" on public.training_weeks;
create policy "weeks: delete own" on public.training_weeks
  for delete using (auth.uid() = user_id);

-- ── training_sessions ───────────────────────────────────────────────────────
create table if not exists public.training_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id),
  week_id         uuid references public.training_weeks(id),
  day             text not null,
  shots_made      numeric not null default 0,
  shots_attempted numeric not null default 0,
  dribbling_min   numeric not null default 0,
  vertical_in     numeric not null default 0,
  sprint_sec      numeric not null default 0,
  intensity       text not null default 'High',
  notes           text not null default '',
  created_at      timestamptz not null default now()
);
alter table public.training_sessions enable row level security;
drop policy if exists "sessions: select own" on public.training_sessions;
create policy "sessions: select own" on public.training_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "sessions: insert own" on public.training_sessions;
create policy "sessions: insert own" on public.training_sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists "sessions: delete own" on public.training_sessions;
create policy "sessions: delete own" on public.training_sessions
  for delete using (auth.uid() = user_id);

-- ── shot_sessions (legacy manual counter) ───────────────────────────────────
create table if not exists public.shot_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id),
  session_date timestamptz not null default now(),
  fg_made      integer not null default 0,
  fg_missed    integer not null default 0,
  three_made   integer not null default 0,
  three_missed integer not null default 0,
  ft_made      integer not null default 0,
  ft_missed    integer not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.shot_sessions enable row level security;
drop policy if exists "Users can manage own shot sessions" on public.shot_sessions;
create policy "Users can manage own shot sessions" on public.shot_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── new-user trigger: auto-create the profile row ───────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, first_name, last_name, position)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'position', 'Point Guard')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger functions must not be callable through the REST RPC surface.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end$$;
