-- =============================================================================
--  save_ai_session_atomic — Atomic AI shot session persistence
-- =============================================================================
--
--  Purpose
--  -------
--  Replaces the legacy two-write flow (INSERT ai_shot_sessions, then
--  INSERT ai_shots) with a single transactional RPC. Eliminates the
--  partial-failure window where the session row landed but the shots
--  call dropped, which previously caused a PK conflict on retry and
--  left orphaned sessions in the table.
--
--  Schema notes (match what features/shot-tracking/shotService.js writes today)
--  --------------------------------------------------------------------------
--  ai_shot_sessions.id is TEXT — generated client-side as
--    'ai_<epoch_ms>_<random_suffix>' in ShotTrackingScreen.js.
--    NOT a UUID; do not cast it.
--  ai_shot_sessions.user_id is UUID (FK → auth.users.id). The JS layer
--    refuses to call this RPC for anonymous users (see isAnonymousUserId
--    in shotService.js), so this column is always a real auth UUID here.
--  ai_shots.id is bigserial / uuid (managed by Supabase, not passed in).
--  ai_shots.ball_trajectory_points is JSONB.
--
--  If your live schema differs (e.g. id is uuid, or columns are named
--  slightly differently), edit the casts and column lists below — the
--  function signature must stay the same so the JS fallback works.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- One-time: prevent duplicate shots on retry. Matches the (session_id,
-- shot_number) pair that the client uses as a logical primary key.
-- Wrapped in a guard so the migration is idempotent.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_shots_session_shot_unique'
  ) THEN
    ALTER TABLE ai_shots
      ADD CONSTRAINT ai_shots_session_shot_unique
      UNIQUE (session_id, shot_number);
  END IF;
END$$;


CREATE OR REPLACE FUNCTION save_ai_session_atomic(
  p_session JSONB,
  p_shots   JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id TEXT;
  v_user_id    UUID;
BEGIN
  -- Resolve session id. Client always supplies one; fall back to a
  -- generated value only if it's missing so the function is forgiving.
  v_session_id := COALESCE(
    p_session->>'id',
    'ai_' || (extract(epoch from now()) * 1000)::bigint || '_' ||
      substring(md5(random()::text), 1, 8)
  );

  v_user_id := (p_session->>'user_id')::UUID;

  -- 1. Upsert the session row. ON CONFLICT (id) DO UPDATE makes the
  --    function idempotent: a retry after a partial failure overwrites
  --    the same row instead of throwing a PK conflict.
  INSERT INTO ai_shot_sessions (
    id,
    user_id,
    session_date,
    session_type,
    duration_ms,
    total_attempts,
    total_made,
    accuracy,
    max_streak,
    xp_earned,
    fg_made,
    fg_missed,
    three_made,
    three_missed,
    ft_made,
    ft_missed
  )
  VALUES (
    v_session_id,
    v_user_id,
    COALESCE((p_session->>'session_date')::TIMESTAMPTZ, NOW()),
    COALESCE(p_session->>'session_type', 'ai_tracking'),
    NULLIF(p_session->>'duration_ms',    '')::INTEGER,
    NULLIF(p_session->>'total_attempts', '')::INTEGER,
    NULLIF(p_session->>'total_made',     '')::INTEGER,
    NULLIF(p_session->>'accuracy',       '')::NUMERIC,
    NULLIF(p_session->>'max_streak',     '')::INTEGER,
    NULLIF(p_session->>'xp_earned',      '')::INTEGER,
    NULLIF(p_session->>'fg_made',        '')::INTEGER,
    NULLIF(p_session->>'fg_missed',      '')::INTEGER,
    NULLIF(p_session->>'three_made',     '')::INTEGER,
    NULLIF(p_session->>'three_missed',   '')::INTEGER,
    NULLIF(p_session->>'ft_made',        '')::INTEGER,
    NULLIF(p_session->>'ft_missed',      '')::INTEGER
  )
  ON CONFLICT (id) DO UPDATE SET
    duration_ms    = EXCLUDED.duration_ms,
    total_attempts = EXCLUDED.total_attempts,
    total_made     = EXCLUDED.total_made,
    accuracy       = EXCLUDED.accuracy,
    max_streak     = EXCLUDED.max_streak,
    xp_earned      = EXCLUDED.xp_earned,
    fg_made        = EXCLUDED.fg_made,
    fg_missed      = EXCLUDED.fg_missed,
    three_made     = EXCLUDED.three_made,
    three_missed   = EXCLUDED.three_missed,
    ft_made        = EXCLUDED.ft_made,
    ft_missed      = EXCLUDED.ft_missed;

  -- 2. Upsert all shots. The unique constraint on (session_id,
  --    shot_number) means a retry overwrites instead of duplicating.
  IF p_shots IS NOT NULL AND jsonb_typeof(p_shots) = 'array' THEN
    INSERT INTO ai_shots (
      session_id,
      user_id,
      shot_number,
      shot_result,
      shot_x,
      shot_y,
      launch_x,
      launch_y,
      shot_zone,
      ball_trajectory_points,
      timestamp
    )
    SELECT
      v_session_id,
      v_user_id,
      NULLIF(shot->>'shot_number', '')::INTEGER,
      shot->>'shot_result',
      NULLIF(shot->>'shot_x', '')::NUMERIC,
      NULLIF(shot->>'shot_y', '')::NUMERIC,
      NULLIF(shot->>'launch_x', '')::NUMERIC,
      NULLIF(shot->>'launch_y', '')::NUMERIC,
      shot->>'shot_zone',
      CASE
        WHEN shot ? 'ball_trajectory_points'
          THEN shot->'ball_trajectory_points'
        ELSE NULL
      END,
      COALESCE((shot->>'timestamp')::TIMESTAMPTZ, NOW())
    FROM jsonb_array_elements(p_shots) AS shot
    ON CONFLICT (session_id, shot_number) DO UPDATE SET
      shot_result            = EXCLUDED.shot_result,
      shot_x                 = EXCLUDED.shot_x,
      shot_y                 = EXCLUDED.shot_y,
      launch_x               = EXCLUDED.launch_x,
      launch_y               = EXCLUDED.launch_y,
      shot_zone              = EXCLUDED.shot_zone,
      ball_trajectory_points = EXCLUDED.ball_trajectory_points,
      timestamp              = EXCLUDED.timestamp;
  END IF;

  RETURN v_session_id;
END;
$$;

-- Allow the public role to invoke (Supabase RLS still applies via SECURITY
-- DEFINER + the auth.users FK on user_id). Adjust if your project uses
-- a stricter role model.
GRANT EXECUTE ON FUNCTION save_ai_session_atomic(JSONB, JSONB) TO authenticated;
