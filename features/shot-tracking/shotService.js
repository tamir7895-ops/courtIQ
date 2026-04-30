/* ══════════════════════════════════════════════════════════════
   SHOT SERVICE — Supabase Insert Functions
   Reuses the global `sb` client from /js/supabase-client.js.

   Tables:
     ai_shot_sessions — session-level data
     ai_shots         — individual shot records
     shot_sessions    — legacy table for dashboard compat
     profiles         — XP grant via user_data column

   Anonymous users: Supabase has FK constraints on user_id columns.
   When the visitor is not signed in, every persistence call writes
   to localStorage instead and surfaces a one-time toast asking the
   user to sign in. Returning early prevents FK errors and silent
   data loss.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── localStorage fallback keys (offline / signed-out mode) ──── */
  var LS_OFFLINE_SESSIONS = 'courtiq-ai-sessions-offline';
  var LS_OFFLINE_SHOTS    = 'courtiq-ai-shots-offline';

  /* ── Auth helpers ───────────────────────────────────────────── */
  function isAnonymousUserId(userId) {
    return !userId || userId === 'anonymous' || typeof userId !== 'string';
  }

  /* Show one toast per session when an offline write happens,
     so we don't spam the user with a toast on every shot. */
  var _toastShownThisSession = false;
  function notifySignInRequired() {
    if (_toastShownThisSession) return;
    _toastShownThisSession = true;
    if (typeof showToast === 'function') {
      showToast('Sign in to save your sessions to the cloud', 'warning');
    } else {
      console.warn('[ShotService] Sign in to save sessions to the cloud');
    }
  }

  function appendOffline(lsKey, record) {
    try {
      var raw = localStorage.getItem(lsKey);
      var arr = raw ? JSON.parse(raw) : [];
      arr.push(record);
      // Cap offline buffer at 200 records to avoid quota errors.
      if (arr.length > 200) arr = arr.slice(-200);
      localStorage.setItem(lsKey, JSON.stringify(arr));
    } catch (e) {
      // localStorage full or disabled — there's no graceful recovery here.
      console.warn('[ShotService] offline append failed:', e);
    }
  }

  function getClient() {
    if (typeof sb !== 'undefined') return sb;
    throw new Error('Supabase client (sb) not found — load supabase-client.js first');
  }

  /* ── Save session ───────────────────────────────────────────── */
  /**
   * @param {Object} session
   * @returns {Promise<Object>} Inserted record (or offline stub)
   */
  async function saveSession(session) {
    // Anonymous path — never call Supabase.
    if (isAnonymousUserId(session.user_id)) {
      notifySignInRequired();
      var offlineRecord = Object.assign({}, session, {
        offline:    true,
        savedAt:    new Date().toISOString()
      });
      appendOffline(LS_OFFLINE_SESSIONS, offlineRecord);
      return offlineRecord;
    }

    var client = getClient();

    // 1. Insert into ai_shot_sessions
    var res = await client
      .from('ai_shot_sessions')
      .insert({
        id:              session.id,
        user_id:         session.user_id,
        session_date:    session.session_date,
        session_type:    session.session_type || 'ai_tracking',
        duration_ms:     session.duration_ms,
        total_attempts:  session.total_attempts,
        total_made:      session.total_made,
        accuracy:        session.accuracy,
        max_streak:      session.max_streak,
        xp_earned:       session.xp_earned
      })
      .select()
      .single();

    if (res.error) {
      console.error('Failed to save AI session:', res.error);
      throw res.error;
    }

    // 2. Also insert into existing shot_sessions for dashboard compat
    var legacy = await client.from('shot_sessions').insert({
      user_id:      session.user_id,
      session_date: session.session_date,
      fg_made:      session.fg_made   || 0,
      fg_missed:    session.fg_missed || 0,
      three_made:   session.three_made   || 0,
      three_missed: session.three_missed || 0,
      ft_made:      session.ft_made   || 0,
      ft_missed:    session.ft_missed || 0
    });

    if (legacy.error) {
      console.warn('Legacy shot_sessions insert failed:', legacy.error);
    }

    return res.data;
  }

  /* ── Save individual shots ──────────────────────────────────── */
  /**
   * @param {Array} shots
   * @returns {Promise<number>} Count saved
   */
  async function saveShots(shots) {
    if (!shots || shots.length === 0) return 0;

    // Anonymous path — buffer to localStorage instead of failing FK.
    var firstUid = shots[0] && shots[0].user_id;
    if (isAnonymousUserId(firstUid)) {
      notifySignInRequired();
      shots.forEach(function (s) { appendOffline(LS_OFFLINE_SHOTS, s); });
      return shots.length;
    }

    var client = getClient();

    var records = shots.map(function (s) {
      return {
        session_id:             s.session_id,
        user_id:                s.user_id,
        shot_result:            s.shot_result,
        shot_x:                 s.shot_x,
        shot_y:                 s.shot_y,
        launch_x:               s.launch_x,
        launch_y:               s.launch_y,
        shot_zone:              s.shot_zone,
        ball_trajectory_points: s.ball_trajectory_points,
        timestamp:              s.timestamp,
        shot_number:            s.shot_number
      };
    });

    // Upsert (instead of insert) so a retry after a partial failure
    // overwrites the same logical shot rather than creating a duplicate.
    // Requires the (session_id, shot_number) unique constraint installed
    // by supabase/migrations/save_ai_session_atomic.sql.
    var res = await client
      .from('ai_shots')
      .upsert(records, { onConflict: 'session_id,shot_number' })
      .select();
    if (res.error) {
      console.error('Failed to save shots:', res.error);
      throw res.error;
    }
    return res.data ? res.data.length : 0;
  }

  /* ── Save session + shots atomically (preferred) ────────────────
     Calls the save_ai_session_atomic Postgres function so the session
     row and every shot row land in a single transaction. If the RPC
     is unavailable (older project that hasn't run the migration yet,
     network error, permission issue), we fall back to the legacy
     two-write path. The legacy path is now also idempotent thanks
     to the upsert on saveShots — partial-failure retries no longer
     duplicate rows on the second call.

     Returns the session id on success, or null on full failure.
   ─────────────────────────────────────────────────────────────── */
  async function saveSessionAtomic(session, shots) {
    // Anonymous path — same buffering as the individual functions.
    if (isAnonymousUserId(session && session.user_id)) {
      notifySignInRequired();
      var offlineRecord = Object.assign({}, session, {
        offline: true,
        savedAt: new Date().toISOString()
      });
      appendOffline(LS_OFFLINE_SESSIONS, offlineRecord);
      if (shots && shots.length) {
        shots.forEach(function (s) { appendOffline(LS_OFFLINE_SHOTS, s); });
      }
      return null;
    }

    var client = getClient();

    try {
      var rpc = await client.rpc('save_ai_session_atomic', {
        p_session: session,
        p_shots:   shots || []
      });
      if (rpc.error) throw rpc.error;
      // Postgres function returns the session id (TEXT). The client
      // surfaces it via rpc.data.
      return rpc.data || (session && session.id) || null;
    } catch (err) {
      // Fall back to the legacy two-write so users on projects that
      // haven't deployed the migration yet keep working. The upsert
      // on saveShots makes the fallback safe to retry after a flake.
      console.warn('[ShotService] atomic RPC unavailable, falling back to two-write:', err && err.message);
      try {
        await saveSession(session);
        if (shots && shots.length) await saveShots(shots);
        return session && session.id;
      } catch (fallbackErr) {
        console.error('[ShotService] legacy save also failed:', fallbackErr);
        throw fallbackErr;
      }
    }
  }

  /* ── Grant XP ───────────────────────────────────────────────── */
  /**
   * Mirrors gamification.js pattern.
   * Also writes to localStorage for immediate UI update.
   */
  async function grantXP(userId, xpToAdd, reason) {
    // 1. Update localStorage (immediate feedback)
    try {
      var lsKey = 'courtiq-xp';
      var raw = localStorage.getItem(lsKey);
      var data = raw ? JSON.parse(raw) : { xp: 0, history: [] };
      data.xp = (data.xp || 0) + xpToAdd;
      data.history = [
        { amount: xpToAdd, reason: reason, date: new Date().toISOString() }
      ].concat((data.history || []).slice(0, 49));
      localStorage.setItem(lsKey, JSON.stringify(data));
    } catch (e) { /* silent */ }

    // Anonymous: localStorage XP only — no profile to sync.
    if (isAnonymousUserId(userId)) {
      notifySignInRequired();
      return false;
    }

    // 2. Sync to Supabase profiles table
    var client = getClient();
    try {
      var profileRes = await client
        .from('profiles')
        .select('user_data')
        .eq('id', userId)
        .single();

      if (profileRes.error) throw profileRes.error;

      var userData = (profileRes.data && profileRes.data.user_data) || {};
      var xpData = userData.xp_data || { xp: 0, history: [] };
      xpData.xp = (xpData.xp || 0) + xpToAdd;
      xpData.history = [
        { amount: xpToAdd, reason: reason, date: new Date().toISOString() }
      ].concat((xpData.history || []).slice(0, 49));

      var updateRes = await client
        .from('profiles')
        .update({
          user_data: Object.assign({}, userData, { xp_data: xpData }),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateRes.error) throw updateRes.error;
      return true;
    } catch (err) {
      console.error('Failed to grant XP:', err);
      return false;
    }
  }

  /* ── Fetch sessions ─────────────────────────────────────────── */
  async function fetchSessions(userId, limit) {
    if (isAnonymousUserId(userId)) return [];
    var client = getClient();
    limit = limit || 20;
    var res = await client
      .from('ai_shot_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('session_date', { ascending: false })
      .limit(limit);
    if (res.error) { console.error('Failed to fetch sessions:', res.error); return []; }
    return res.data || [];
  }

  /* ── Fetch shots for a session ──────────────────────────────── */
  async function fetchSessionShots(sessionId) {
    var client = getClient();
    var res = await client
      .from('ai_shots')
      .select('*')
      .eq('session_id', sessionId)
      .order('shot_number', { ascending: true });
    if (res.error) { console.error('Failed to fetch shots:', res.error); return []; }
    return res.data || [];
  }

  /* ── Fetch zone history ─────────────────────────────────────── */
  async function fetchZoneHistory(userId, period) {
    if (isAnonymousUserId(userId)) return null;
    var client = getClient();
    period = period || 'week';
    var query = client.from('ai_shots').select('shot_zone, shot_result').eq('user_id', userId);
    if (period !== 'all') {
      var cutoff = new Date();
      if (period === 'week') cutoff.setDate(cutoff.getDate() - 7);
      else if (period === 'month') cutoff.setDate(cutoff.getDate() - 30);
      query = query.gte('timestamp', cutoff.toISOString());
    }
    var res = await query;
    if (res.error) { console.error('Failed to fetch zone history:', res.error); return null; }
    var zones = {
      paint:      { made: 0, total: 0, pct: 0 },
      midrange:   { made: 0, total: 0, pct: 0 },
      threePoint: { made: 0, total: 0, pct: 0 },
      freeThrow:  { made: 0, total: 0, pct: 0 }
    };
    (res.data || []).forEach(function (shot) {
      var zone = shot.shot_zone || 'midrange';
      if (!zones[zone]) return;
      zones[zone].total++;
      if (shot.shot_result === 'made') zones[zone].made++;
    });
    Object.keys(zones).forEach(function (z) {
      zones[z].pct = zones[z].total > 0
        ? Math.round((zones[z].made / zones[z].total) * 1000) / 10
        : 0;
    });
    return zones;
  }

  /* ── Delete session + its shots ─────────────────────────────── */
  async function deleteSession(sessionId) {
    var client = getClient();
    try {
      await client.from('ai_shots').delete().eq('session_id', sessionId);
      await client.from('ai_shot_sessions').delete().eq('id', sessionId);
      return true;
    } catch (err) {
      console.error('Failed to delete session:', err);
      return false;
    }
  }

  /* ── Expose globally ────────────────────────────────────────── */
  window.ShotService = {
    saveSession:        saveSession,
    saveShots:          saveShots,
    saveSessionAtomic:  saveSessionAtomic,
    grantXP:            grantXP,
    fetchSessions:      fetchSessions,
    fetchSessionShots:  fetchSessionShots,
    fetchZoneHistory:   fetchZoneHistory,
    deleteSession:      deleteSession
  };

})();
