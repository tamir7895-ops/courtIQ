/**
 * useSessionManager.js — Session Lifecycle + XP Calculation
 *
 * Manages the full lifecycle of an AI tracking session:
 *  - Start session (create session record)
 *  - Track shots in real-time (accumulate in memory)
 *  - End session (finalize stats)
 *  - Calculate XP rewards
 *  - Save to Supabase via shotService
 *
 * XP Schema (aligned with existing gamification.js):
 *  - Base: 25 XP for completing a session (matches logSession)
 *  - Bonus: +2 XP per made shot
 *  - Streak: +5 XP per 3-in-a-row streak
 *  - Accuracy: +10 XP if session accuracy >= 60%
 *  - Volume: +15 XP if 50+ attempts in a session
 */
import { useState, useRef, useCallback } from 'react';
import { saveSession, saveShots } from '../supabase/shotService';

// XP reward constants
const XP_BASE_SESSION = 25;
const XP_PER_MADE = 2;
const XP_STREAK_BONUS = 5;
const XP_STREAK_THRESHOLD = 3;
const XP_ACCURACY_BONUS = 10;
const XP_ACCURACY_THRESHOLD = 0.6; // 60%
const XP_VOLUME_BONUS = 15;
const XP_VOLUME_THRESHOLD = 50;

/**
 * @param {string} userId - Supabase auth user ID
 * @returns {Object} Session management interface
 */
export default function useSessionManager(userId) {
  const [sessionState, setSessionState] = useState('idle'); // idle | active | ended
  const [sessionData, setSessionData] = useState(null);
  const [shots, setShots] = useState([]);
  const [xpEarned, setXpEarned] = useState(0);

  const sessionIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const streakRef = useRef(0); // Current consecutive made shots
  const maxStreakRef = useRef(0);

  /**
   * Start a new tracking session.
   */
  const startSession = useCallback(() => {
    const sessionId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionIdRef.current = sessionId;
    startTimeRef.current = Date.now();
    streakRef.current = 0;
    maxStreakRef.current = 0;

    setSessionState('active');
    setShots([]);
    setXpEarned(0);
    setSessionData({
      id: sessionId,
      userId,
      startTime: new Date().toISOString(),
      type: 'ai_tracking',
    });

    return sessionId;
  }, [userId]);

  /**
   * Record a detected shot.
   *
   * @param {Object} shotData - From useShotDetection callback
   * @param {string} shotData.result - 'made' | 'missed'
   * @param {number} shotData.shotX - Normalized X (0–1)
   * @param {number} shotData.shotY - Normalized Y (0–1)
   * @param {Array} shotData.trajectory - Last 20 trajectory points
   * @param {number} shotData.timestamp - Detection timestamp
   */
  const recordShot = useCallback(
    (shotData) => {
      if (sessionState !== 'active') return;

      const shot = {
        session_id: sessionIdRef.current,
        user_id: userId,
        shot_result: shotData.result,
        shot_x: shotData.shotX,
        shot_y: shotData.shotY,
        launch_x: shotData.launchPoint ? shotData.launchPoint.x : shotData.shotX,
        launch_y: shotData.launchPoint ? shotData.launchPoint.y : shotData.shotY,
        shot_zone: shotData.shotZone || null,
        ball_trajectory_points: shotData.trajectory,
        timestamp: new Date(shotData.timestamp).toISOString(),
        shot_number: shots.length + 1,
      };

      // Update streak
      if (shotData.result === 'made') {
        streakRef.current += 1;
        if (streakRef.current > maxStreakRef.current) {
          maxStreakRef.current = streakRef.current;
        }
      } else {
        streakRef.current = 0;
      }

      setShots((prev) => [...prev, shot]);
    },
    [sessionState, userId, shots.length]
  );

  /**
   * End the current session and calculate final stats + XP.
   *
   * @returns {Object} Session summary
   */
  const endSession = useCallback(() => {
    if (sessionState !== 'active') return null;

    const endTime = Date.now();
    const duration = endTime - startTimeRef.current;
    const durationMin = Math.round(duration / 60000);

    // Calculate stats
    const totalAttempts = shots.length;
    const totalMade = shots.filter((s) => s.shot_result === 'made').length;
    const accuracy = totalAttempts > 0 ? totalMade / totalAttempts : 0;

    // Calculate XP
    let xp = XP_BASE_SESSION;
    const xpBreakdown = [{ reason: 'Session completed', amount: XP_BASE_SESSION }];

    // Per-made bonus
    const madeXP = totalMade * XP_PER_MADE;
    if (madeXP > 0) {
      xp += madeXP;
      xpBreakdown.push({ reason: `${totalMade} made shots`, amount: madeXP });
    }

    // Streak bonuses
    const streakBonuses = Math.floor(maxStreakRef.current / XP_STREAK_THRESHOLD);
    const streakXP = streakBonuses * XP_STREAK_BONUS;
    if (streakXP > 0) {
      xp += streakXP;
      xpBreakdown.push({
        reason: `${maxStreakRef.current}-shot streak`,
        amount: streakXP,
      });
    }

    // Accuracy bonus
    if (totalAttempts >= 10 && accuracy >= XP_ACCURACY_THRESHOLD) {
      xp += XP_ACCURACY_BONUS;
      xpBreakdown.push({
        reason: `${Math.round(accuracy * 100)}% accuracy`,
        amount: XP_ACCURACY_BONUS,
      });
    }

    // Volume bonus
    if (totalAttempts >= XP_VOLUME_THRESHOLD) {
      xp += XP_VOLUME_BONUS;
      xpBreakdown.push({
        reason: `${totalAttempts}+ attempts`,
        amount: XP_VOLUME_BONUS,
      });
    }

    setXpEarned(xp);

    const summary = {
      sessionId: sessionIdRef.current,
      userId,
      startTime: new Date(startTimeRef.current).toISOString(),
      endTime: new Date(endTime).toISOString(),
      durationMs: duration,
      durationFormatted: formatDuration(duration),
      totalAttempts,
      totalMade,
      totalMissed: totalAttempts - totalMade,
      accuracy: Math.round(accuracy * 1000) / 10, // e.g., 67.5
      maxStreak: maxStreakRef.current,
      xpEarned: xp,
      xpBreakdown,
      shots,
      // Breakdown by zone (for potential FG/3PT classification)
      shotsByZone: categorizeShotsByZone(shots),
    };

    setSessionData(summary);
    setSessionState('ended');

    return summary;
  }, [sessionState, shots, userId]);

  /**
   * Save session and shots to Supabase.
   * Also triggers XP grant on the existing gamification system.
   *
   * @returns {Promise<boolean>} Success
   */
  const saveToSupabase = useCallback(
    async (summary) => {
      if (!summary) return false;

      try {
        // Save session record
        await saveSession({
          id: summary.sessionId,
          user_id: summary.userId,
          session_date: summary.startTime,
          session_type: 'ai_tracking',
          duration_ms: summary.durationMs,
          total_attempts: summary.totalAttempts,
          total_made: summary.totalMade,
          accuracy: summary.accuracy,
          max_streak: summary.maxStreak,
          xp_earned: summary.xpEarned,
          // Map to existing shot_sessions columns for dashboard compatibility
          fg_made: summary.shotsByZone.midrange.made,
          fg_missed: summary.shotsByZone.midrange.missed,
          three_made: summary.shotsByZone.threePoint.made,
          three_missed: summary.shotsByZone.threePoint.missed,
          ft_made: (summary.shotsByZone.paint.made || 0) + (summary.shotsByZone.freeThrow?.made || 0),
          ft_missed: (summary.shotsByZone.paint.missed || 0) + (summary.shotsByZone.freeThrow?.missed || 0),
        });

        // Save individual shot records
        await saveShots(summary.shots);

        return true;
      } catch (err) {
        console.error('Failed to save session:', err);
        return false;
      }
    },
    []
  );

  /**
   * Reset everything for a new session.
   */
  const resetSession = useCallback(() => {
    setSessionState('idle');
    setSessionData(null);
    setShots([]);
    setXpEarned(0);
    sessionIdRef.current = null;
    startTimeRef.current = null;
    streakRef.current = 0;
    maxStreakRef.current = 0;
  }, []);

  return {
    sessionState,
    sessionData,
    shots,
    xpEarned,
    startSession,
    recordShot,
    endSession,
    saveToSupabase,
    resetSession,
    currentStreak: streakRef.current,
  };
}

// ── Helpers ──

/**
 * Format milliseconds into "Xm Ys" string.
 */
function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

/**
 * Categorize shots into zones.
 *
 * Uses the pre-classified shot_zone field (distance-based from launch point
 * to rim, calibrated against the 3PT line) when available. Falls back to
 * the rough Y-based heuristic for legacy shots without shot_zone.
 */
function categorizeShotsByZone(shots) {
  const zones = {
    paint: { made: 0, missed: 0 },
    midrange: { made: 0, missed: 0 },
    threePoint: { made: 0, missed: 0 },
    freeThrow: { made: 0, missed: 0 },
  };

  for (const shot of shots) {
    let zone;
    if (shot.shot_zone && zones[shot.shot_zone]) {
      zone = shot.shot_zone;
    } else {
      // Legacy fallback: Y-based approximation
      if (shot.shot_y > 0.6) zone = 'paint';
      else if (shot.shot_y > 0.35) zone = 'midrange';
      else zone = 'threePoint';
    }

    if (shot.shot_result === 'made') {
      zones[zone].made++;
    } else {
      zones[zone].missed++;
    }
  }

  return zones;
}
