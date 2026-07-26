-- ═══════════════════════════════════════════════════════════════════
-- PRODUCTION READINESS — security holes, account-deletion completeness,
-- and the RLS/index work that only starts to hurt once real users land.
--
-- Audited 2026-07-26 against project txnsuzlgfafjdipfqkqe.
-- Every statement here is idempotent-safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. SECURITY: two UPDATE policies had no WITH CHECK ───────────────
-- USING is evaluated against the OLD row only. With no WITH CHECK, a user
-- could update a row they legitimately own and rewrite its owner column —
-- moving the row into another user's account (training_weeks.user_id), or
-- onto another user's id (profiles.id). Closing both.

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "weeks: update own" on public.training_weeks;
create policy "weeks: update own" on public.training_weeks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- ── 2. PRIVACY: make account deletion actually complete ──────────────
-- Every other user-owned table has an ON DELETE CASCADE FK to auth.users,
-- so removing the auth user wipes them. coach_usage and client_errors had
-- NO foreign key at all, so a deleted account left rows behind forever —
-- including client_errors stack traces tagged with the user's id.
-- (Verified 0 orphan rows before adding these constraints.)

alter table public.coach_usage
  drop constraint if exists coach_usage_user_id_fkey;
alter table public.coach_usage
  add constraint coach_usage_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.client_errors
  drop constraint if exists client_errors_user_id_fkey;
alter table public.client_errors
  add constraint client_errors_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;


-- ── 3. PERFORMANCE: stop re-evaluating auth.uid() per row ────────────
-- A bare auth.uid() inside a policy is re-run for EVERY row scanned.
-- Wrapping it in a scalar subquery makes Postgres evaluate it once per
-- statement (InitPlan). Free ~orders-of-magnitude win on the big tables
-- (ai_shots already has 767 rows for 3 users). Also pins each policy to
-- `authenticated` — anon could never match auth.uid() anyway, and it
-- lets the planner skip these policies entirely for anon requests.

-- profiles
drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

-- training_weeks
drop policy if exists "weeks: select own" on public.training_weeks;
create policy "weeks: select own" on public.training_weeks
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "weeks: insert own" on public.training_weeks;
create policy "weeks: insert own" on public.training_weeks
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "weeks: delete own" on public.training_weeks;
create policy "weeks: delete own" on public.training_weeks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- training_sessions
drop policy if exists "sessions: select own" on public.training_sessions;
create policy "sessions: select own" on public.training_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "sessions: insert own" on public.training_sessions;
create policy "sessions: insert own" on public.training_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "sessions: delete own" on public.training_sessions;
create policy "sessions: delete own" on public.training_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- shot_sessions (legacy dashboard table, still written by shotService)
drop policy if exists "Users can manage own shot sessions" on public.shot_sessions;
create policy "Users can manage own shot sessions" on public.shot_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ai_shot_sessions
drop policy if exists "ai sessions: manage own" on public.ai_shot_sessions;
create policy "ai sessions: manage own" on public.ai_shot_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ai_shots — the hottest table, biggest win
drop policy if exists "ai shots: manage own" on public.ai_shots;
create policy "ai shots: manage own" on public.ai_shots
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- coach_memory
drop policy if exists "own row select" on public.coach_memory;
create policy "own row select" on public.coach_memory
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own row insert" on public.coach_memory;
create policy "own row insert" on public.coach_memory
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "own row update" on public.coach_memory;
create policy "own row update" on public.coach_memory
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- challenge_claims
drop policy if exists "own claims select" on public.challenge_claims;
create policy "own claims select" on public.challenge_claims
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own claims insert" on public.challenge_claims;
create policy "own claims insert" on public.challenge_claims
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "own claims update" on public.challenge_claims;
create policy "own claims update" on public.challenge_claims
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- client_errors (telemetry: user inserts + reads only their own)
drop policy if exists "own errors insert" on public.client_errors;
create policy "own errors insert" on public.client_errors
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "own errors select" on public.client_errors;
create policy "own errors select" on public.client_errors
  for select to authenticated using ((select auth.uid()) = user_id);


-- ── 4. INDEXES ───────────────────────────────────────────────────────
-- Unindexed foreign keys: every one of these is scanned on a cascade
-- delete (i.e. on every account deletion) and on any owner-filtered read.
create index if not exists training_sessions_user_idx
  on public.training_sessions (user_id);
create index if not exists training_sessions_week_idx
  on public.training_sessions (week_id);
create index if not exists training_weeks_user_idx
  on public.training_weeks (user_id);
create index if not exists coach_usage_user_idx
  on public.coach_usage (user_id);

-- Telemetry is always read "newest first, mine only".
create index if not exists client_errors_user_at_idx
  on public.client_errors (user_id, at desc);

-- Redundant: ai_shots_session_shot_unique(session_id, shot_number) already
-- serves every lookup on session_id as a leading-column prefix. Keeping
-- both costs an extra write on each of the ~700 shot inserts per session.
drop index if exists public.ai_shots_session_idx;


-- ── 5. profiles.updated_at was never actually updated ────────────────
-- The column defaults to now() on insert and then stays frozen forever,
-- so it silently lies about freshness. Make it mean what it says.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ── 6. Telemetry retention ───────────────────────────────────────────
-- client_errors grows without bound and nothing ever prunes it. Ninety
-- days is well past the point a crash report is actionable. Callable by
-- service_role only (a cron job or the dashboard), never by users.
create or replace function public.prune_client_errors(keep_days integer default 90)
returns integer
language sql
security definer
set search_path to 'public'
as $$
  with gone as (
    delete from client_errors
    where at < now() - (keep_days || ' days')::interval
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function public.prune_client_errors(integer) from public, anon, authenticated;
grant execute on function public.prune_client_errors(integer) to service_role;
