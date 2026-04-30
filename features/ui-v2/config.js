/* CourtIQ UI v2 — feature flags
 *
 * As of Phase 7 (2026-04-20), the v2 UI is the DEFAULT experience for
 * every user: shell + 5 tab ports are all enabled out of the box.
 *
 * Emergency rollback:
 *   ?ui=v1   — opens the dashboard with the legacy UI (all flags off)
 *   ?ui=v2   — force the new UI (same as default)
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

  // Default = all on (Phase 7 graduation).
  var DEFAULT_FLAGS = {
    SHELL_ACTIVE: true,   // global — enables body.ciq-active + new topbar/bottom-nav
    HOME_TAB:     true,   // Phase 2 — Home screen port
    TRACK_TAB:    true,   // Phase 3 — Shot Tracker + YOLOX flagship
    TRAIN_TAB:    true,   // Phase 4 — Training program
    COACH_TAB:    true,   // Phase 5 — AI Coach chat intro + form
    ME_TAB:       true    // Phase 6 — Profile + Trophy Case + Account
  };

  function readMode() {
    try {
      var url = new URL(location.href);
      var qp = url.searchParams.get('ui');
      if (qp === 'v1' || qp === 'v2') {
        sessionStorage.setItem('courtiq-ui-mode', qp);
        return qp;
      }
    } catch (e) { /* some browsers choke on location in sandboxed frames */ }
    try { return sessionStorage.getItem('courtiq-ui-mode') || 'v2'; }
    catch (e) { return 'v2'; }
  }

  var mode = readMode();
  var flags;
  if (mode === 'v1') {
    flags = { SHELL_ACTIVE: false, HOME_TAB: false, TRACK_TAB: false, TRAIN_TAB: false, COACH_TAB: false, ME_TAB: false };
  } else {
    flags = DEFAULT_FLAGS;
  }

  window.COURTIQ_UI_V2 = Object.freeze(flags);
  window.COURTIQ_UI_V2_MODE = mode;
})();
