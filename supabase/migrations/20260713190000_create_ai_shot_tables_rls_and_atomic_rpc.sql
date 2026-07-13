-- =============================================================================
-- AI shot-tracking tables + hardened atomic save RPC.
-- Applied to production 2026-07-13 (MCP migration
-- `create_ai_shot_tables_rls_and_atomic_rpc`).
--
-- History: features/shot-tracking/shotService.js has written to
-- ai_shot_sessions / ai_shots since March, but the tables never existed in
-- the live database — every signed-in save failed. This migration creates
-- them with RLS, and replaces the earlier RPC draft which trusted a
-- client-supplied user_id inside SECURITY DEFINER (cross-user write hole):
-- user_id is now derived from auth.uid() server-side, and the upserts are
-- additionally guarded so a conflicting row belonging to another user can
-- never be overwritten.
--
-- Schema notes:
--   ai_shot_sessions.id is TEXT — generated client-side as
--   'ai_<epoch_ms>_<suffix>' in ShotTrackingScreen.js. Not a UUID.
--   ai_shots (session_id, shot_number) is unique so retries upsert
--   instead of duplicating.
-- =============================================================================

create table if not exists public.ai_shot_sessions (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  session_date   timestamptz not null default now(),
  session_type   text not null default 'ai_tracking',
  duration_ms    integer,
  total_attempts integer,
  total_made     integer,
  accuracy       numeric,
  max_streak     integer,
  xp_earned      integer,
  fg_made        integer,
  fg_missed      integer,
  three_made     integer,
  three_missed   integer,
  ft_made        integer,
  ft_missed      integer,
  created_at     timestamptz not null default now()
);

create table if not exists public.ai_shots (
  id                     bigint generated always as identity primary key,
  session_id             text not null references public.ai_shot_sessions(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  shot_number            integer,
  shot_result            text,
  shot_x                 numeric,
  shot_y                 numeric,
  launch_x               numeric,
  launch_y               numeric,
  shot_zone              text,
  ball_trajectory_points jsonb,
  "timestamp"            timestamptz default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_shots_session_shot_unique') then
    alter table public.ai_shots
      add constraint ai_shots_session_shot_unique unique (session_id, shot_number);
  end if;
end$$;

create index if not exists ai_shot_sessions_user_date_idx
  on public.ai_shot_sessions (user_id, session_date desc);
create index if not exists ai_shots_session_idx
  on public.ai_shots (session_id);
create index if not exists ai_shots_user_idx
  on public.ai_shots (user_id);

alter table public.ai_shot_sessions enable row level security;
alter table public.ai_shots enable row level security;

drop policy if exists "ai sessions: manage own" on public.ai_shot_sessions;
create policy "ai sessions: manage own" on public.ai_shot_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai shots: manage own" on public.ai_shots;
create policy "ai shots: manage own" on public.ai_shots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.save_ai_session_atomic(
  p_session jsonb,
  p_shots   jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text;
  v_user_id    uuid;
begin
  -- SECURITY: the caller's identity is the ONLY accepted user_id.
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'save_ai_session_atomic requires an authenticated user';
  end if;

  v_session_id := coalesce(
    p_session->>'id',
    'ai_' || (extract(epoch from now()) * 1000)::bigint || '_' ||
      substring(md5(random()::text), 1, 8)
  );

  insert into ai_shot_sessions (
    id, user_id, session_date, session_type, duration_ms,
    total_attempts, total_made, accuracy, max_streak, xp_earned,
    fg_made, fg_missed, three_made, three_missed, ft_made, ft_missed
  )
  values (
    v_session_id,
    v_user_id,
    coalesce((p_session->>'session_date')::timestamptz, now()),
    coalesce(p_session->>'session_type', 'ai_tracking'),
    nullif(p_session->>'duration_ms',    '')::integer,
    nullif(p_session->>'total_attempts', '')::integer,
    nullif(p_session->>'total_made',     '')::integer,
    nullif(p_session->>'accuracy',       '')::numeric,
    nullif(p_session->>'max_streak',     '')::integer,
    nullif(p_session->>'xp_earned',      '')::integer,
    nullif(p_session->>'fg_made',        '')::integer,
    nullif(p_session->>'fg_missed',      '')::integer,
    nullif(p_session->>'three_made',     '')::integer,
    nullif(p_session->>'three_missed',   '')::integer,
    nullif(p_session->>'ft_made',        '')::integer,
    nullif(p_session->>'ft_missed',      '')::integer
  )
  on conflict (id) do update set
    duration_ms    = excluded.duration_ms,
    total_attempts = excluded.total_attempts,
    total_made     = excluded.total_made,
    accuracy       = excluded.accuracy,
    max_streak     = excluded.max_streak,
    xp_earned      = excluded.xp_earned,
    fg_made        = excluded.fg_made,
    fg_missed      = excluded.fg_missed,
    three_made     = excluded.three_made,
    three_missed   = excluded.three_missed,
    ft_made        = excluded.ft_made,
    ft_missed      = excluded.ft_missed
  where ai_shot_sessions.user_id = auth.uid();

  if p_shots is not null and jsonb_typeof(p_shots) = 'array' then
    insert into ai_shots (
      session_id, user_id, shot_number, shot_result,
      shot_x, shot_y, launch_x, launch_y, shot_zone,
      ball_trajectory_points, "timestamp"
    )
    select
      v_session_id,
      v_user_id,
      nullif(shot->>'shot_number', '')::integer,
      shot->>'shot_result',
      nullif(shot->>'shot_x', '')::numeric,
      nullif(shot->>'shot_y', '')::numeric,
      nullif(shot->>'launch_x', '')::numeric,
      nullif(shot->>'launch_y', '')::numeric,
      shot->>'shot_zone',
      case when shot ? 'ball_trajectory_points'
        then shot->'ball_trajectory_points' else null end,
      coalesce((shot->>'timestamp')::timestamptz, now())
    from jsonb_array_elements(p_shots) as shot
    on conflict (session_id, shot_number) do update set
      shot_result            = excluded.shot_result,
      shot_x                 = excluded.shot_x,
      shot_y                 = excluded.shot_y,
      launch_x               = excluded.launch_x,
      launch_y               = excluded.launch_y,
      shot_zone              = excluded.shot_zone,
      ball_trajectory_points = excluded.ball_trajectory_points,
      "timestamp"            = excluded."timestamp"
    where ai_shots.user_id = auth.uid();
  end if;

  return v_session_id;
end;
$$;

revoke execute on function public.save_ai_session_atomic(jsonb, jsonb) from public, anon;
grant execute on function public.save_ai_session_atomic(jsonb, jsonb) to authenticated;

-- Advisor fix: handle_new_user is a trigger function — nobody should call
-- it through the REST RPC surface.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
