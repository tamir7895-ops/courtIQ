/* CourtIQ UI v2 — Camera HUD screen (Wave 1 redesign · new file)
 *
 * Compact port of _design-import/v2/components/camera-hud-overlay.jsx.
 * Boots the camera, initializes the sealed ShotDetector (YOLOX-tiny
 * v6 ONNX), and renders the broadcast-style HUD on top of the live
 * video. End Session → transitions to the v2 Post-Session screen.
 *
 * Renderer is exposed as window.CourtIQ_V2_CameraHUD.render(host) and
 * is opened explicitly from the Track tab or Home "Track Shots" CTA —
 * not from the bottom nav.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.SHELL_ACTIVE) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[camera-hud-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  /* ── State ─────────────────────────────────────────────────────────── */
  var state = {
    phase: 'idle',           // idle | live | ending
    made: 0, att: 0,
    startMs: 0,
    pulseKey: 0,
    detector: null,
    stream: null,
    rafId: 0,
    lastShots: []            // last 5 made/missed flags
  };
  var hostRef = null;
  var videoEl = null;
  var canvasEl = null;
  var timerInterval = 0;

  /* ── ShotDetector wiring ──────────────────────────────────────────── */
  function initDetector() {
    return new Promise(function (resolve) {
      try {
        if (typeof window.ShotDetector === 'function') {
          state.detector = new window.ShotDetector();
          if (typeof state.detector.initialize === 'function') {
            state.detector.initialize().then(function () { resolve(true); }).catch(function (e) {
              console.warn('[camera-hud-v2] detector init failed', e); resolve(false);
            });
            return;
          }
        }
      } catch (e) { console.warn('[camera-hud-v2] detector ctor failed', e); }
      resolve(false);
    });
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(null);
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    }).then(function (stream) {
      state.stream = stream;
      videoEl.srcObject = stream;
      return videoEl.play().catch(function () {});
    }).catch(function (e) {
      console.warn('[camera-hud-v2] camera permission denied', e);
      return null;
    });
  }

  function stopCamera() {
    try {
      if (state.stream) {
        state.stream.getTracks().forEach(function (t) { t.stop(); });
        state.stream = null;
      }
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = 0;
      if (videoEl) videoEl.srcObject = null;
    } catch (e) { /* ignore */ }
  }

  function detectionLoop() {
    if (!state.detector || !videoEl || state.phase !== 'live') {
      state.rafId = requestAnimationFrame(detectionLoop);
      return;
    }
    try {
      if (canvasEl) {
        canvasEl.width = videoEl.videoWidth || 640;
        canvasEl.height = videoEl.videoHeight || 640;
        var ctx2 = canvasEl.getContext('2d');
        ctx2.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        if (typeof state.detector.detect === 'function') {
          var p = state.detector.detect(canvasEl);
          if (p && typeof p.then === 'function') p.then(function () {}).catch(function () {});
        }
      }
    } catch (e) { /* tolerate */ }
    state.rafId = requestAnimationFrame(detectionLoop);
  }

  /* ── HUD building blocks ──────────────────────────────────────────── */
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function buildScoreboard(label, made, att, accent) {
    return h('div', { class: 'hud-score' }, [
      h('div', { class: 'hud-score__label', style: { color: accent }, text: label }),
      h('div', { class: 'hud-score__num',   style: { color: accent }, text: pad2(made) }),
      h('div', { class: 'hud-score__sep', text: '/' }),
      h('div', { class: 'hud-score__att', text: pad2(att) })
    ]);
  }

  function buildLivePill(phase) {
    var on = phase === 'live';
    return h('div', { class: 'hud-live' + (on ? ' is-on' : '') }, [
      h('span', { class: 'hud-live__dot' }),
      h('span', { class: 'hud-live__txt', text: on ? 'LIVE' : 'SYNCING' }),
      h('span', { class: 'hud-live__sep', text: '·' }),
      h('span', { class: 'hud-live__ai', text: 'YOLOX-TINY · v6' })
    ]);
  }

  function buildTimer(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = pad2(Math.floor(total / 60));
    var s = pad2(total % 60);
    return h('div', { class: 'hud-timer' }, [
      h('div', { class: 'hud-timer__lbl', text: 'SESSION' }),
      h('div', { class: 'hud-timer__val' }, [
        h('span', { text: m }),
        h('span', { class: 'hud-timer__col', text: ':' }),
        h('span', { text: s })
      ])
    ]);
  }

  function buildFocusBrackets(size) {
    size = size || 220;
    var gap = size / 2 - 4, arm = 22;
    var grp = svg('g', { stroke: 'currentColor', 'stroke-width': '2.4', fill: 'none' });
    [
      'M ' + (size/2 - gap) + ' ' + (size/2 - gap + arm) + ' L ' + (size/2 - gap) + ' ' + (size/2 - gap) + ' L ' + (size/2 - gap + arm) + ' ' + (size/2 - gap),
      'M ' + (size/2 + gap - arm) + ' ' + (size/2 - gap) + ' L ' + (size/2 + gap) + ' ' + (size/2 - gap) + ' L ' + (size/2 + gap) + ' ' + (size/2 - gap + arm),
      'M ' + (size/2 + gap) + ' ' + (size/2 + gap - arm) + ' L ' + (size/2 + gap) + ' ' + (size/2 + gap) + ' L ' + (size/2 + gap - arm) + ' ' + (size/2 + gap),
      'M ' + (size/2 - gap + arm) + ' ' + (size/2 + gap) + ' L ' + (size/2 - gap) + ' ' + (size/2 + gap) + ' L ' + (size/2 - gap) + ' ' + (size/2 + gap - arm)
    ].forEach(function (d) { grp.appendChild(svg('path', { d: d })); });

    var s = svg('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size }, [grp]);
    return h('div', { class: 'hud-focus', style: { width: size + 'px', height: size + 'px' } }, [s]);
  }

  function buildHeroFG() {
    var fg = state.att > 0 ? Math.round((state.made / state.att) * 100) : 0;
    return h('div', { class: 'hud-hero' }, [
      h('div', { class: 'hud-hero__lbl', text: 'FG%' }),
      h('div', { class: 'hud-hero__num', text: String(fg) }),
      h('div', { class: 'hud-hero__sub', text: state.made + '/' + state.att })
    ]);
  }

  /* ── Render orchestration ─────────────────────────────────────────── */
  function repaint() {
    if (!hostRef) return;
    DOM.clearChildren(hostRef);

    videoEl = document.createElement('video');
    videoEl.className = 'hud-video';
    videoEl.autoplay = true; videoEl.muted = true; videoEl.playsInline = true;

    canvasEl = document.createElement('canvas');
    canvasEl.className = 'hud-detect-canvas';
    canvasEl.style.display = 'none';

    var hud = h('div', { class: 'hud' }, [
      videoEl,
      canvasEl,
      h('div', { class: 'hud-tl' },
        [buildScoreboard('SHOTS', state.made, state.att, '#56d364')]),
      h('div', { class: 'hud-tc' }, [buildLivePill(state.phase)]),
      h('div', { class: 'hud-tr' }, [buildTimer(Date.now() - (state.startMs || Date.now()))]),
      h('div', { class: 'hud-mid' }, [buildFocusBrackets(220)]),
      h('div', { class: 'hud-bottom' }, [
        buildHeroFG(),
        h('button', { class: 'hud-end-btn',
          onclick: function () { endSession(); } }, ['END SESSION'])
      ])
    ]);
    hostRef.appendChild(hud);
  }

  function tickTimer() {
    if (state.phase !== 'live') return;
    var tr = hostRef && hostRef.querySelector('.hud-tr');
    if (!tr) return;
    DOM.clearChildren(tr);
    tr.appendChild(buildTimer(Date.now() - state.startMs));
  }

  function startSession() {
    state.phase = 'live';
    state.startMs = Date.now();
    state.made = 0; state.att = 0;
    repaint();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tickTimer, 1000);
    state.rafId = requestAnimationFrame(detectionLoop);
  }

  function endSession() {
    state.phase = 'ending';
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = 0;
    stopCamera();
    var session = {
      made: state.made, att: state.att,
      durationMs: Date.now() - state.startMs,
      shots: state.lastShots.slice()
    };
    try {
      if (window.shotService && typeof window.shotService.saveSession === 'function') {
        window.shotService.saveSession(session);
      }
    } catch (e) { console.warn('[camera-hud-v2] save session', e); }
    if (window.CourtIQ_V2_PostSession && typeof window.CourtIQ_V2_PostSession.render === 'function') {
      window.CourtIQ_V2_PostSession.render(session);
    } else if (window.CIQ_SHELL) {
      window.CIQ_SHELL.switchTo('track');
    }
  }

  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-camera-hud');
    repaint();
    initDetector().then(function (ok) {
      console.log('[camera-hud-v2] detector ready =', ok);
      return startCamera();
    }).then(function () {
      startSession();
    }).catch(function (e) { console.warn('[camera-hud-v2] start error', e); });
  }

  function cleanup() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = 0;
    stopCamera();
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_CameraHUD = { render: render, cleanup: cleanup };
})();
