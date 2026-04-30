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
   */
  function bindLaunchButtons() {
    var buttons = document.querySelectorAll('[data-action="launch-shot-tracker"]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        e.preventDefault();
        launch();
      });
    }

    // Also hook into the existing AI Shot Tracker launch card if present
    var astLaunchBtn = document.getElementById('ast-launch-btn');
    if (astLaunchBtn) {
      astLaunchBtn.addEventListener('click', function (e) {
        e.preventDefault();
        launch();
      });
    }

    // Upload Video button — opens file picker, then launches from file
    var astUploadBtn = document.getElementById('ast-upload-btn');
    var astFileInput = document.getElementById('ast-file-input');
    if (astUploadBtn && astFileInput) {
      astUploadBtn.addEventListener('click', function (e) {
        e.preventDefault();
        astFileInput.click();
      });
      astFileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        // Reset so the same file can be re-selected next time
        astFileInput.value = '';
        if (!file) return;
        if (!window.ShotTrackingScreen || !window.ShotTrackingScreen.openFromFile) {
          console.error('ShotTrackingScreen.openFromFile not available');
          return;
        }
        window.ShotTrackingScreen.openFromFile(file);
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
