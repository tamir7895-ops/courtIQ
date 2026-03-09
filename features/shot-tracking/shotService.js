/* ══════════════════════════════════════════════════════════════
   SHOT SERVICE — Supabase Insert Functions
   Reuses the global `sb` client from /js/supabase-client.js.

   Tables:
     ai_shot_sessions — session-level data
     ai_shots         — individual shot records
     shot_sessions    — legacy table for dashboard compat
     profiles         — XP grant via user_data column
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function getClient() {
    if (typeof sb !== 'undefined') return sb;
    throw new Error('Supabase client (sb) not found — load supabase-client.js first');
  }

  /* ── Save session ───────────────────────────────────────────── */
  /**
   * @param {Object} session
   * @returns {Promise<Object>} Inserted record
   */
  async function saveSession(session) {
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
    var client = getClient();

    var records = shots.map(function (s) {
      return {
        session_id:             s.session_id,
        user_id:                s.user_id,
        shot_result:            s.shot_result,
        shot_x:                 s.shot_x,
        shot_y:                 s.shot_y,
        ball_trajectory_points: s.ball_trajectory_points,
        timestamp:              s.timestamp,
        shot_number:            s.shot_number
      };
    });

    var res = await client.from('ai_shots').insert(records).select();
    if (res.error) {
      console.error('Failed to save shots:', res.error);
      throw res.error;
    }
    return res.data ? res.data.length : 0;
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

  /* ── Expose globally ────────────────────────────────────────── */
  window.ShotService = {
    saveSession: saveSession,
    saveShots:   saveShots,
    grantXP:     grantXP
  };

})();
