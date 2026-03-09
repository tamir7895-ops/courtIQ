/**
 * zoneHistory.js — Zone-Level History Tracking & Smart Alerts
 *
 * Tracks shooting accuracy per zone over time (weekly/monthly).
 * Generates smart insight alerts by comparing current session to historical data.
 *
 * Storage: Uses AsyncStorage (React Native) or localStorage (web) to cache
 * zone history locally for quick access. Supabase is the source of truth.
 */

// ── Storage adapter (works in both web and RN) ──

let _storage = null;

function getStorage() {
  if (_storage) return _storage;
  // Try AsyncStorage first (React Native)
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    _storage = {
      getItem: (k) => AsyncStorage.getItem(k),
      setItem: (k, v) => AsyncStorage.setItem(k, v),
    };
    return _storage;
  } catch (e) {
    // Fall back to localStorage (web)
    _storage = {
      getItem: (k) => Promise.resolve(localStorage.getItem(k)),
      setItem: (k, v) => Promise.resolve(localStorage.setItem(k, v)),
    };
    return _storage;
  }
}

const HISTORY_KEY = 'courtiq-zone-history';

/**
 * @typedef {Object} ZoneSnapshot
 * @property {string} date - ISO date string
 * @property {string} sessionId
 * @property {Object} zones - { paint, midrange, threePoint, freeThrow }
 *   each with { made: number, total: number }
 */

/**
 * Load zone history from local storage.
 * @returns {Promise<ZoneSnapshot[]>}
 */
export async function loadZoneHistory() {
  try {
    const storage = getStorage();
    const raw = await storage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

/**
 * Save a session's zone data to history.
 * Keeps the last 100 sessions.
 *
 * @param {string} sessionId
 * @param {Object} zones - { paint, midrange, threePoint, freeThrow }
 */
export async function saveZoneSnapshot(sessionId, zones) {
  try {
    const history = await loadZoneHistory();
    const snapshot = {
      date: new Date().toISOString(),
      sessionId,
      zones: {
        paint: { made: zones.paint?.made || 0, total: (zones.paint?.made || 0) + (zones.paint?.missed || 0) },
        midrange: { made: zones.midrange?.made || 0, total: (zones.midrange?.made || 0) + (zones.midrange?.missed || 0) },
        threePoint: { made: zones.threePoint?.made || 0, total: (zones.threePoint?.made || 0) + (zones.threePoint?.missed || 0) },
        freeThrow: { made: zones.freeThrow?.made || 0, total: (zones.freeThrow?.made || 0) + (zones.freeThrow?.missed || 0) },
      },
    };

    history.push(snapshot);
    // Keep last 100 sessions
    const trimmed = history.slice(-100);

    const storage = getStorage();
    await storage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // Silent
  }
}

/**
 * Get aggregated zone stats for a time period.
 *
 * @param {'week' | 'month' | 'all'} period
 * @returns {Promise<Object>} { paint, midrange, threePoint, freeThrow } each with { made, total, pct }
 */
export async function getZoneStatsForPeriod(period = 'week') {
  const history = await loadZoneHistory();
  const now = Date.now();
  let cutoff = 0;

  if (period === 'week') {
    cutoff = now - 7 * 24 * 60 * 60 * 1000;
  } else if (period === 'month') {
    cutoff = now - 30 * 24 * 60 * 60 * 1000;
  }

  const filtered = history.filter((s) => new Date(s.date).getTime() >= cutoff);

  const agg = {
    paint: { made: 0, total: 0, pct: 0 },
    midrange: { made: 0, total: 0, pct: 0 },
    threePoint: { made: 0, total: 0, pct: 0 },
    freeThrow: { made: 0, total: 0, pct: 0 },
  };

  for (const snap of filtered) {
    for (const zone of Object.keys(agg)) {
      if (snap.zones[zone]) {
        agg[zone].made += snap.zones[zone].made;
        agg[zone].total += snap.zones[zone].total;
      }
    }
  }

  for (const zone of Object.keys(agg)) {
    agg[zone].pct = agg[zone].total > 0
      ? Math.round((agg[zone].made / agg[zone].total) * 1000) / 10
      : 0;
  }

  return agg;
}

/**
 * Get zone trend data — compare current period to previous period.
 *
 * @param {'week' | 'month'} period
 * @returns {Promise<Object>} { zone: { current, previous, change } }
 */
export async function getZoneTrends(period = 'week') {
  const history = await loadZoneHistory();
  const now = Date.now();
  const periodMs = period === 'week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;

  const currentCutoff = now - periodMs;
  const previousCutoff = now - periodMs * 2;

  const current = history.filter((s) => new Date(s.date).getTime() >= currentCutoff);
  const previous = history.filter((s) => {
    const t = new Date(s.date).getTime();
    return t >= previousCutoff && t < currentCutoff;
  });

  function aggregate(sessions) {
    const agg = {};
    for (const zone of ['paint', 'midrange', 'threePoint', 'freeThrow']) {
      agg[zone] = { made: 0, total: 0 };
      for (const s of sessions) {
        if (s.zones[zone]) {
          agg[zone].made += s.zones[zone].made;
          agg[zone].total += s.zones[zone].total;
        }
      }
      agg[zone].pct = agg[zone].total > 0
        ? Math.round((agg[zone].made / agg[zone].total) * 1000) / 10
        : 0;
    }
    return agg;
  }

  const currAgg = aggregate(current);
  const prevAgg = aggregate(previous);

  const trends = {};
  for (const zone of ['paint', 'midrange', 'threePoint', 'freeThrow']) {
    trends[zone] = {
      current: currAgg[zone].pct,
      previous: prevAgg[zone].pct,
      change: currAgg[zone].total > 0 && prevAgg[zone].total > 0
        ? Math.round((currAgg[zone].pct - prevAgg[zone].pct) * 10) / 10
        : null,
      currentTotal: currAgg[zone].total,
      previousTotal: prevAgg[zone].total,
    };
  }

  return trends;
}

// Zone display names
const ZONE_NAMES = {
  paint: 'Paint',
  midrange: 'Mid-Range',
  threePoint: '3-Point',
  freeThrow: 'Free Throw',
};

/**
 * Generate smart alert messages based on current session vs history.
 *
 * @param {Object} currentZones - Current session zone breakdown { paint, midrange, threePoint, freeThrow }
 * @returns {Promise<string[]>} Array of alert messages
 */
export async function generateSmartAlerts(currentZones) {
  const alerts = [];

  try {
    const trends = await getZoneTrends('week');
    const weekStats = await getZoneStatsForPeriod('week');

    for (const [zone, data] of Object.entries(trends)) {
      const name = ZONE_NAMES[zone] || zone;

      // Improvement alert: zone improved by 10%+ this week
      if (data.change !== null && data.change >= 10) {
        alerts.push({
          type: 'improvement',
          text: `Your ${name} shooting improved by ${data.change}% this week!`,
          zone,
          value: data.change,
        });
      }

      // Decline alert: zone dropped by 10%+ this week
      if (data.change !== null && data.change <= -10) {
        alerts.push({
          type: 'decline',
          text: `Your ${name} shooting dropped by ${Math.abs(data.change)}% this week. Keep practicing!`,
          zone,
          value: data.change,
        });
      }
    }

    // Current session highlights
    for (const [zone, data] of Object.entries(currentZones)) {
      const name = ZONE_NAMES[zone] || zone;
      const total = (data.made || 0) + (data.missed || 0);
      if (total < 3) continue;

      const pct = Math.round((data.made / total) * 100);
      const weekPct = weekStats[zone]?.pct || 0;

      // Session beat weekly average by 15%+
      if (weekPct > 0 && pct - weekPct >= 15) {
        alerts.push({
          type: 'session_high',
          text: `${name}: ${pct}% today vs ${weekPct}% weekly average — great session!`,
          zone,
          value: pct - weekPct,
        });
      }

      // Perfect zone (100% from a zone with 3+ shots)
      if (pct === 100 && total >= 3) {
        alerts.push({
          type: 'perfect',
          text: `Perfect ${total}/${total} from ${name}!`,
          zone,
          value: 100,
        });
      }
    }

    // Volume milestone
    const history = await loadZoneHistory();
    const totalSessions = history.length;
    if ([10, 25, 50, 100].includes(totalSessions)) {
      alerts.push({
        type: 'milestone',
        text: `${totalSessions} sessions tracked! Keep up the consistency.`,
        zone: null,
        value: totalSessions,
      });
    }
  } catch (e) {
    // Silent — alerts are non-critical
  }

  return alerts;
}
