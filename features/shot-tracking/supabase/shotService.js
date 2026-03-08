/**
 * shotService.js — Supabase Insert Functions
 *
 * Handles persisting AI tracking sessions and individual shots to Supabase.
 * Reuses the existing Supabase client from the app.
 *
 * Tables used:
 *  - ai_shot_sessions: Session-level data (duration, totals, XP)
 *  - ai_shots: Individual shot records (position, result, trajectory)
 *  - shot_sessions: Existing table — also written to for dashboard compatibility
 *
 * NOTE: Adjust the import path to match your Supabase client location.
 * The existing app uses `window.sb` (CDN) but RN would use a module import.
 */

// ── Supabase client import ──
// Option A: If you have a shared module:
// import { supabase } from '../../lib/supabase';
//
// Option B: If using the existing web client pattern, adapt it:
// import { createClient } from '@supabase/supabase-js';
// const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
//
// For now, we'll export a factory that accepts the client:

let _supabase = null;

/**
 * Initialize the shot service with a Supabase client instance.
 * Call this once at app startup.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export function initShotService(client) {
  _supabase = client;
}

function getClient() {
  if (!_supabase) {
    throw new Error(
      'Shot service not initialized. Call initShotService(supabaseClient) first.'
    );
  }
  return _supabase;
}

/**
 * Save an AI tracking session record.
 *
 * @param {Object} session
 * @param {string} session.id
 * @param {string} session.user_id
 * @param {string} session.session_date - ISO 8601
 * @param {string} session.session_type - 'ai_tracking'
 * @param {number} session.duration_ms
 * @param {number} session.total_attempts
 * @param {number} session.total_made
 * @param {number} session.accuracy - Percentage (0–100)
 * @param {number} session.max_streak
 * @param {number} session.xp_earned
 * @param {number} session.fg_made - For dashboard compat
 * @param {number} session.fg_missed
 * @param {number} session.three_made
 * @param {number} session.three_missed
 * @param {number} session.ft_made
 * @param {number} session.ft_missed
 * @returns {Promise<Object>} Inserted record
 */
export async function saveSession(session) {
  const sb = getClient();

  // 1. Insert into ai_shot_sessions (new table for AI tracking)
  const { data: aiSession, error: aiError } = await sb
    .from('ai_shot_sessions')
    .insert({
      id: session.id,
      user_id: session.user_id,
      session_date: session.session_date,
      session_type: session.session_type,
      duration_ms: session.duration_ms,
      total_attempts: session.total_attempts,
      total_made: session.total_made,
      accuracy: session.accuracy,
      max_streak: session.max_streak,
      xp_earned: session.xp_earned,
    })
    .select()
    .single();

  if (aiError) {
    console.error('Failed to save AI session:', aiError);
    throw aiError;
  }

  // 2. Also insert into existing shot_sessions for dashboard compatibility
  const { error: legacyError } = await sb.from('shot_sessions').insert({
    user_id: session.user_id,
    session_date: session.session_date,
    fg_made: session.fg_made || 0,
    fg_missed: session.fg_missed || 0,
    three_made: session.three_made || 0,
    three_missed: session.three_missed || 0,
    ft_made: session.ft_made || 0,
    ft_missed: session.ft_missed || 0,
  });

  if (legacyError) {
    // Non-blocking — log but don't throw
    console.warn('Legacy shot_sessions insert failed:', legacyError);
  }

  return aiSession;
}

/**
 * Save individual shot records in bulk.
 *
 * @param {Array<Object>} shots - Array of shot objects
 * @returns {Promise<number>} Number of shots saved
 */
export async function saveShots(shots) {
  if (!shots || shots.length === 0) return 0;

  const sb = getClient();

  // Prepare records (strip any client-only fields)
  const records = shots.map((shot) => ({
    session_id: shot.session_id,
    user_id: shot.user_id,
    shot_result: shot.shot_result,
    shot_x: shot.shot_x,
    shot_y: shot.shot_y,
    ball_trajectory_points: shot.ball_trajectory_points,
    timestamp: shot.timestamp,
    shot_number: shot.shot_number,
  }));

  // Batch insert (Supabase handles arrays)
  const { data, error } = await sb.from('ai_shots').insert(records).select();

  if (error) {
    console.error('Failed to save shots:', error);
    throw error;
  }

  return data?.length ?? 0;
}

/**
 * Fetch all AI sessions for a user (for history screen).
 *
 * @param {string} userId
 * @param {number} limit - Max records (default 20)
 * @returns {Promise<Array>}
 */
export async function fetchSessions(userId, limit = 20) {
  const sb = getClient();

  const { data, error } = await sb
    .from('ai_shot_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('session_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch sessions:', error);
    return [];
  }

  return data;
}

/**
 * Fetch shots for a specific session (for replay/detail view).
 *
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
export async function fetchSessionShots(sessionId) {
  const sb = getClient();

  const { data, error } = await sb
    .from('ai_shots')
    .select('*')
    .eq('session_id', sessionId)
    .order('shot_number', { ascending: true });

  if (error) {
    console.error('Failed to fetch shots:', error);
    return [];
  }

  return data;
}

/**
 * Update user XP in the profiles table.
 * Mirrors the existing gamification.js pattern.
 *
 * @param {string} userId
 * @param {number} xpToAdd
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
export async function grantXP(userId, xpToAdd, reason) {
  const sb = getClient();

  try {
    // Fetch current user data
    const { data: profile, error: fetchErr } = await sb
      .from('profiles')
      .select('user_data')
      .eq('id', userId)
      .single();

    if (fetchErr) throw fetchErr;

    const userData = profile?.user_data || {};
    const xpData = userData.xp_data || { xp: 0, history: [] };

    // Add XP
    xpData.xp = (xpData.xp || 0) + xpToAdd;
    xpData.history = [
      { amount: xpToAdd, reason, date: new Date().toISOString() },
      ...(xpData.history || []).slice(0, 49), // Keep last 50
    ];

    // Save back
    const { error: updateErr } = await sb
      .from('profiles')
      .update({
        user_data: { ...userData, xp_data: xpData },
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    return true;
  } catch (err) {
    console.error('Failed to grant XP:', err);
    return false;
  }
}

/**
 * Delete a session and its shots (for cleanup/undo).
 *
 * @param {string} sessionId
 * @returns {Promise<boolean>}
 */
export async function deleteSession(sessionId) {
  const sb = getClient();

  try {
    // Delete shots first (FK constraint)
    await sb.from('ai_shots').delete().eq('session_id', sessionId);

    // Delete session
    await sb.from('ai_shot_sessions').delete().eq('id', sessionId);

    return true;
  } catch (err) {
    console.error('Failed to delete session:', err);
    return false;
  }
}
