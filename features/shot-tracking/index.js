/* ══════════════════════════════════════════════════════════════
   SHOT TRACKING — Module Entry Point

   Initializes the AI Shot Tracking feature.
   Load order (all via <script> tags in dashboard.html):
     1. shotDetection.js   → window.ShotDetectionEngine
     2. shotService.js     → window.ShotService
     3. ShotTrackingScreen.js → window.ShotTrackingScreen
     4. index.js (this)    → wires everything + creates launch UI

   Call:  ShotTracking.launch()  — opens the fullscreen shot tracker
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /**
   * Launch the shot tracking flow.
   * Opens the fullscreen camera → rim lock → tracking → summary.
   */
  function launch() {
    if (!window.ShotDetectionEngine) {
      console.error('ShotDetectionEngine not loaded');
      return;
    }
    if (!window.ShotTrackingScreen) {
      console.error('ShotTrackingScreen not loaded');
      return;
    }

    window.ShotTrackingScreen.open();
  }

  /**
   * Wire up any existing dashboard launch buttons.
   * Looks for elements with data-action="launch-shot-tracker".
   * NOTE: Do NOT hook into .ast-launch-btn or #ast-launch-btn / #ast-upload-btn
   * — those are handled by the legacy ai-shot-tracker.js which manages the
   * overlay, camera, and upload video flows.
   */
  function bindLaunchButtons() {
    var buttons = document.querySelectorAll('[data-action="launch-shot-tracker"]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        e.preventDefault();
        launch();
      });
    }
  }

  // Auto-bind when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLaunchButtons);
  } else {
    bindLaunchButtons();
  }

  /* ── Expose globally ────────────────────────────────────────── */
  window.ShotTracking = {
    launch: launch
  };

})();
