/* CourtIQ UI v2 — Track tab module ("The Lab.")
 *
 * When COURTIQ_UI_V2.TRACK_TAB is true:
 *   1. Injects #ciq-track-screen into the main dashboard area.
 *   2. Syncs the 4 stats (sessions, shooting %, XP, streak) from the
 *      legacy #db-panel-shots hooks so whatever data layer writes
 *      (supabase, gamification, shot analysis), the v2 view reflects.
 *   3. Wires "Launch Camera" to ShotTrackingScreen.openCamera() — the
 *      exact same entry point the legacy button used. Detection
 *      engine contract is untouched.
 *   4. Wires "Upload Video" to the existing hidden <input id="ast-file-input">.
 *
 * Hard rule: zero changes to features/shot-tracking/*.js.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRACK_TAB) return;

  function ICON_CAMERA() {
    return '<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  }
  function ICON_UPLOAD() {
    return '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
  }

  function buildScreen() {
    var host = document.createElement('section');
    host.id = 'ciq-track-screen';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Track');

    host.innerHTML = ''
      + '<div class="ciq-track-eyebrow">Your Analytics</div>'
      + '<h1 class="ciq-track-title">The Lab.</h1>'

      + '<div class="ciq-track-stats">'
      +   '<div class="ciq-track-stat"><div class="lbl">Sessions</div><div class="val" data-ciq-slot="sessions">—</div></div>'
      +   '<div class="ciq-track-stat"><div class="lbl">Shooting %</div><div class="val accent-track" data-ciq-slot="fg">—</div></div>'
      +   '<div class="ciq-track-stat"><div class="lbl">Total XP</div><div class="val accent-amber" data-ciq-slot="xp">—</div></div>'
      +   '<div class="ciq-track-stat"><div class="lbl">Day Streak</div><div class="val" data-ciq-slot="streak">—</div></div>'
      + '</div>'

      + '<section class="ciq-track-hero">'
      +   '<div class="ciq-track-ai-badge"><span class="dot"></span>AI Powered · YOLOX-tiny v6</div>'
      +   '<div class="ciq-track-hero-body">'
      +     '<div class="ciq-track-hero-copy">'
      +       '<div class="ciq-track-hero-name">Shot Tracker</div>'
      +       '<div class="ciq-track-hero-desc">Analyze every shot in real-time. Works live from your camera or from uploaded video. Made and missed shots are logged automatically with make/miss %, shot trail, and heatmap.</div>'
      +     '</div>'
      +     '<div class="ciq-track-hero-last">'
      +       '<div class="lbl">Last Session</div>'
      +       '<div class="pct" data-ciq-slot="last-fg">—</div>'
      +       '<div class="lbl">Field Goal %</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="ciq-track-actions">'
      +     '<button class="ciq-track-btn primary" data-ciq-action="launch-camera">' + ICON_CAMERA() + ' Launch Camera</button>'
      +     '<button class="ciq-track-btn secondary" data-ciq-action="upload-video">' + ICON_UPLOAD() + ' Upload Video</button>'
      +   '</div>'
      + '</section>'

      + '<section class="ciq-track-section">'
      +   '<div class="ciq-track-section-title">Recent Sessions</div>'
      +   '<div class="ciq-track-empty" data-ciq-slot="recent">Log your first session to see a shot-by-shot breakdown here.</div>'
      + '</section>';

    return host;
  }

  /* ─── Data sync from legacy #db-panel-shots ─────────────── */
  function textOf(sel) {
    var el = document.querySelector(sel);
    return el ? (el.textContent || '').trim() : '';
  }
  function setSlot(host, slot, value) {
    var el = host.querySelector('[data-ciq-slot="' + slot + '"]');
    if (!el) return;
    el.textContent = value || '—';
  }

  function syncFromLegacy(host) {
    var sessions = textOf('#lab-stat-pts');
    if (sessions && sessions !== '—') setSlot(host, 'sessions', sessions);

    var fg = textOf('#lab-stat-fg');
    if (fg && fg !== '—') {
      setSlot(host, 'fg', fg);
      setSlot(host, 'last-fg', fg);
    }

    var xp = textOf('#lab-stat-vol');
    if (xp && xp !== '—') setSlot(host, 'xp', xp);

    var streak = textOf('#lab-stat-vert');
    if (streak && streak !== '—') setSlot(host, 'streak', streak);
  }

  function wireActions(host) {
    host.addEventListener('click', function (e) {
      var t = e.target.closest('[data-ciq-action]');
      if (!t) return;
      var act = t.getAttribute('data-ciq-action');

      if (act === 'launch-camera') {
        if (window.ShotTrackingScreen && typeof window.ShotTrackingScreen.openCamera === 'function') {
          window.ShotTrackingScreen.openCamera();
        } else {
          console.warn('[ciq-track] ShotTrackingScreen.openCamera not available yet');
        }
      } else if (act === 'upload-video') {
        var input = document.getElementById('ast-file-input');
        if (input) {
          input.click();
        } else {
          console.warn('[ciq-track] #ast-file-input not found');
        }
      }
    });
  }

  function init() {
    var main = document.querySelector('.db-main-inner, #db-main-inner, .db-main, main');
    if (!main) {
      console.warn('[ciq-track] main container not found; skipping');
      return;
    }

    var host = buildScreen();
    main.appendChild(host);
    wireActions(host);

    syncFromLegacy(host);
    setTimeout(function () { syncFromLegacy(host); }, 400);
    setTimeout(function () { syncFromLegacy(host); }, 1500);

    var legacyPanel = document.getElementById('db-panel-shots');
    if (legacyPanel && 'MutationObserver' in window) {
      var mo = new MutationObserver(function () { syncFromLegacy(host); });
      mo.observe(legacyPanel, { subtree: true, childList: true, characterData: true });
    }

    // Mark body so CSS knows v2 track is enabled (shown only when shell routes to .ciq-tab-track)
    document.body.classList.add('ciq-v2-track');

    window.CIQ_TRACK = { host: host, syncNow: function () { syncFromLegacy(host); } };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
