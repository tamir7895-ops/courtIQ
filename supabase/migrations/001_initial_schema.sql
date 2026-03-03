-- ══════════════════════════════════════════════════════════════
--  CourtIQ — Initial Schema
--  Run this in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ─── PROFILES ────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  first_name   text not null default '',
  last_name    text not null default '',
  position     text not null default 'Point Guard',
  skill_level  text not null default 'Intermediate',
  goal         text not null default 'All-Around Improvement',
  plan         text not null default 'starter',
  streak       int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── TRAINING WEEKS (completed, AI-summarised) ───────────────
create table if not exists training_weeks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  week_number  int  not null,
  label        text not null,           -- e.g. "W4"
  summary_json jsonb,                   -- full AI result JSON
  created_at   timestamptz not null default now()
);

-- ─── TRAINING SESSIONS (individual days logged) ──────────────
create table if not exists training_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  week_id          uuid references training_weeks(id) on delete set null,
  day              text not null,       -- "Mon", "Tue", …
  shots_made       numeric not null default 0,
  shots_attempted  numeric not null default 0,
  dribbling_min    numeric not null default 0,
  vertical_in      numeric not null default 0,
  sprint_sec       numeric not null default 0,
  intensity        text not null default 'High',
  notes            text not null default '',
  created_at       timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════
--  ROW-LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════

alter table profiles          enable row level security;
alter table training_weeks    enable row level security;
alter table training_sessions enable row level security;

-- profiles
create policy "profiles: select own"  on profiles for select using (auth.uid() = id);
create policy "profiles: insert own"  on profiles for insert with check (auth.uid() = id);
create policy "profiles: update own"  on profiles for update using (auth.uid() = id);

-- training_weeks
create policy "weeks: select own"  on training_weeks for select using (auth.uid() = user_id);
create policy "weeks: insert own"  on training_weeks for insert with check (auth.uid() = user_id);
create policy "weeks: delete own"  on training_weeks for delete using (auth.uid() = user_id);

-- training_sessions
create policy "sessions: select own"  on training_sessions for select using (auth.uid() = user_id);
create policy "sessions: insert own"  on training_sessions for insert with check (auth.uid() = user_id);
create policy "sessions: delete own"  on training_sessions for delete using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════
--  AUTO-CREATE PROFILE ON SIGNUP
-- ══════════════════════════════════════════════════════════════
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
