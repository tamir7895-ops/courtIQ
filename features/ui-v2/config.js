/* CourtIQ UI v2 — feature flags
 *
 * As of Phase 7 (2026-04-20), the v2 UI is the DEFAULT experience for
 * every user: shell + 5 tab ports are all enabled out of the box.
 * Phase 8 (2026-04-28) adds 10 restoration units that fill v2 feature
 * gaps — they default ON.
 *
 * Emergency rollback:
 *   ?ui=v1     — legacy UI, all flags off
 *   ?ui=v2     — full v2 (same as default)
 *   ?ui=core   — Phase 1–6 v2 core only; Phase 8 restorations OFF
 *                (use to bisect v2-restoration regressions)
 *
 * The override is persisted in sessionStorage for the tab's lifetime,
 * so you can navigate within the app without losing the mode. Close
 * the tab or open a fresh one to return to the default (v2).
 *
 * Hard rollback for production:
 *   Edit this file and set the DEFAULT constants below to `false`.
 */
(function () {
  'use strict';

  // Default = all on. Phase 8 restoration units default ON too.
  var DEFAULT_FLAGS = {
    // Phase 1–6 (shell + 5 tab ports)
    SHELL_ACTIVE: true,
    HOME_TAB:     true,
    TRACK_TAB:    true,
    TRAIN_TAB:    true,
    COACH_TAB:    true,
    ME_TAB:       true,

    // Phase 8 — restoration units (Tier A + B)
    COACH_RECS:      true,  // 8.1 — wire drill-rec clicks in coach.js
    ME_TROPHIES:     true,  // 8.2 — sync Trophy Case from XP/sessions/FG%
    ME_SETTINGS:     true,  // 8.3 — Account row → Settings sheet
    TRAIN_DRILL_GEN: true,  // 8.4 — Drill Generator
    TRAIN_PLAYER:    true,  // 8.5 — Daily Workout Player
    TRACK_HEATMAP:   true,  // 8.6 — Heatmap
    TRACK_ZONES:     true,  // 8.6 — Zone breakdown
    TRACK_SESSIONS:  true,  // 8.7 — Recent sessions detail
    HOME_CALENDAR:   true,  // 8.8 — Calendar event builder
    ME_SOCIAL:       true   // 8.9 — Social leaderboards + challenges
  };

  // Mask used for ?ui=core — turns off Phase 8 only.
  var CORE_MASK = {
    COACH_RECS: false, ME_TROPHIES: false, ME_SETTINGS: false,
    TRAIN_DRILL_GEN: false, TRAIN_PLAYER: false,
    TRACK_HEATMAP: false, TRACK_ZONES: false, TRACK_SESSIONS: false,
    HOME_CALENDAR: false, ME_SOCIAL: false
  };

  // Mask used for ?ui=v1 — everything off.
  function v1Flags() {
    var out = {};
    for (var k in DEFAULT_FLAGS) { out[k] = false; }
    return out;
  }

  function applyMask(base, mask) {
    var out = {};
    for (var k in base) { out[k] = base[k]; }
    for (var m in mask) { out[m] = mask[m]; }
    return out;
  }

  function readMode() {
    // v2 is the only production mode. ?ui=core is kept for debugging only.
    // v1 fallback removed — legacy UI is no longer supported.
    try {
      var url = new URL(location.href);
      var qp = url.searchParams.get('ui');
      if (qp === 'core') return 'core';
    } catch (e) { /* some browsers choke on location in sandboxed frames */ }
    // Clear any stale v1 session override from previous visits
    try { sessionStorage.removeItem('courtiq-ui-mode'); } catch (e) {}
    return 'v2';
  }

  var mode = readMode();
  var flags;
  if (mode === 'v1')        flags = v1Flags();
  else if (mode === 'core') flags = applyMask(DEFAULT_FLAGS, CORE_MASK);
  else                      flags = DEFAULT_FLAGS;

  window.COURTIQ_UI_V2 = Object.freeze(flags);
  window.COURTIQ_UI_V2_MODE = mode;
})();
