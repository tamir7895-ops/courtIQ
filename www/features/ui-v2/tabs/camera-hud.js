/* CourtIQ UI v2 — Camera HUD screen (Wave 1 redesign)
 *
 * Full port of design-export-v2/camera-hud-overlay.jsx + camera-hud-app.jsx.
 * Boots the camera, initializes the sealed ShotDetector (YOLOX-tiny
 * v6 ONNX), and renders the broadcast-style HUD on top of the live
 * video through 4 phases:
 *   Phase 0 — Calibration (rim detection, "Point camera at hoop")
 *   Phase 1 — Rim Lock confirmation ("RIM LOCKED")
 *   Phase 2 — 3PT calibration
 *   Phase 3 — Live tracking (full HUD)
 * End Session → transitions to the v2 Post-Session screen.
 *
 * Fullscreen overlay — NO bottom nav. hideLegacyPanels on render,
 * restoreLegacyPanels on cleanup.
 *
 * Renderer exposed as window.CourtIQ_V2_CameraHUD = { render, cleanup }.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.SHELL_ACTIVE) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[camera-hud-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  /* ── Zone geometry (500×470 coord space, matches TLShotChart) ───── */
  var ZONES = [
    { id: 'lc',  name: 'L CORNER 3', path: 'M 0 0 L 30 0 L 30 142 L 0 142 Z' },
    { id: 'rc',  name: 'R CORNER 3', path: 'M 470 0 L 500 0 L 500 142 L 470 142 Z' },
    { id: 'lw',  name: 'L WING 3',   path: 'M 0 142 L 30 142 A 237.5 237.5 0 0 0 170 222 L 170 470 L 0 470 L 0 142 Z' },
    { id: 'rw',  name: 'R WING 3',   path: 'M 500 142 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 470 L 500 470 L 500 142 Z' },
    { id: 'top', name: 'TOP 3',      path: 'M 170 222 A 237.5 237.5 0 0 0 330 222 L 330 470 L 170 470 L 170 222 Z' },
    { id: 'mid', name: 'MID-RANGE',  path: 'M 30 0 L 170 0 L 170 222 A 237.5 237.5 0 0 1 30 142 L 30 0 Z M 330 0 L 470 0 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 0 Z M 170 190 L 330 190 L 330 222 A 237.5 237.5 0 0 0 170 222 L 170 190 Z' },
    { id: 'pnt', name: 'PAINT',      path: 'M 170 0 L 330 0 L 330 190 L 170 190 Z' }
  ];

  /* ── State ─────────────────────────────────────────────────────────── */
  var state = {
    phase: 'idle',           // idle | calibrating | rimlock | threept | live | ending
    made: 0, att: 0,
    startMs: 0,
    pulseKey: 0,
    detector: null,
    stream: null,
    rafId: 0,
    lastShots: [],           // last N made/missed booleans
    activeZone: 'top',
    zoneAcc: { lc: 0, rc: 0, lw: 0, rw: 0, top: 0, mid: 0, pnt: 0 },
    rimLocked: false,
    threePtCalibrated: false,
    celebrate: null,
    celebrateTimer: 0
  };
  var hostRef = null;
  var videoEl = null;
  var canvasEl = null;
  var timerInterval = 0;
  var phaseTimer = 0;

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
      if (videoEl) {
        videoEl.srcObject = stream;
        return videoEl.play().catch(function () {});
      }
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

  /* ── Helpers ──────────────────────────────────────────────────────── */
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function getZoneName(id) {
    for (var i = 0; i < ZONES.length; i++) {
      if (ZONES[i].id === id) return ZONES[i].name;
    }
    return '—';
  }

  /* ── Celebration system ───────────────────────────────────────────── */
  var CELEBRATIONS = {
    swish:   { txt: 'SWISH',        color: '#56d364', sub: '+2' },
    heating: { txt: 'HEATING UP',   color: '#f5a623', sub: '3 IN A ROW' },
    splash:  { txt: 'SPLASH PARTY', color: '#ff3a14', sub: '5 IN A ROW · COOKING' },
    miss:    { txt: 'OFF',          color: 'rgba(232,64,64,0.85)', sub: '' }
  };

  function triggerCelebration(kind) {
    if (!kind) return;
    state.celebrate = kind;
    if (state.celebrateTimer) clearTimeout(state.celebrateTimer);
    state.celebrateTimer = setTimeout(function () {
      state.celebrate = null;
      state.celebrateTimer = 0;
      updateCelebration();
    }, 1100);
    updateCelebration();
  }

  function updateCelebration() {
    if (!hostRef) return;
    var existing = hostRef.querySelector('.hud-burst');
    if (existing) existing.remove();
    if (!state.celebrate) return;
    var c = CELEBRATIONS[state.celebrate];
    if (!c) return;
    var burst = h('div', { class: 'hud-burst' }, [
      h('div', { class: 'hud-burst__txt', style: { color: c.color, textShadow: '0 0 40px ' + c.color } }, [c.txt]),
      c.sub ? h('div', { class: 'hud-burst__sub' }, [c.sub]) : null,
      h('div', { class: 'hud-burst__vignette ' + state.celebrate, style: { '--burst-c': c.color } })
    ].filter(Boolean));
    var hudEl = hostRef.querySelector('.hud');
    if (hudEl) hudEl.appendChild(burst);
  }

  /* ── Shot registration (called by detector or externally) ────────── */
  function registerShot(made, zone) {
    state.att += 1;
    if (made) state.made += 1;
    state.lastShots.push(made);
    if (state.lastShots.length > 12) state.lastShots = state.lastShots.slice(-12);
    if (zone) state.activeZone = zone;
    state.pulseKey += 1;

    // update zone accuracy
    if (zone && state.zoneAcc.hasOwnProperty(zone)) {
      var acc = state.zoneAcc[zone];
      state.zoneAcc[zone] = Math.max(0.15, Math.min(0.95, acc + (made ? 0.03 : -0.02)));
    }

    // determine celebration
    var recent = state.lastShots.slice(-5);
    var streak = 0;
    for (var i = recent.length - 1; i >= 0; i--) {
      if (recent[i]) streak++; else break;
    }
    var burst = null;
    if (!made) { burst = 'miss'; }
    else if (streak >= 5) { burst = 'splash'; }
    else if (streak >= 3) { burst = 'heating'; }
    else { burst = 'swish'; }

    triggerCelebration(burst);
    repaintLiveHUD();
  }

  // Expose for external detector integration
  window._ciqRegisterShot = registerShot;

  /* ── HUD building blocks ──────────────────────────────────────────── */

  function buildScoreboard() {
    return h('div', { class: 'hud-score' }, [
      h('div', { class: 'hud-score__label', style: { color: '#56d364' } }, ['MADE']),
      h('div', { class: 'hud-score__num', style: { color: '#56d364' } }, [pad2(state.made)]),
      h('div', { class: 'hud-score__sep' }, ['/']),
      h('div', { class: 'hud-score__att' }, [pad2(state.att)])
    ]);
  }

  function buildLivePill() {
    var on = state.phase === 'live';
    return h('div', { class: 'hud-live' + (on ? ' is-on' : '') }, [
      h('span', { class: 'hud-live__dot' }),
      h('span', { class: 'hud-live__txt' }, [on ? 'LIVE' : 'SYNCING']),
      h('span', { class: 'hud-live__sep' }, ['·']),
      h('span', { class: 'hud-live__ai' }, ['AI TRACKING'])
    ]);
  }

  function buildTimer(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = pad2(Math.floor(total / 60));
    var s = pad2(total % 60);
    return h('div', { class: 'hud-timer' }, [
      h('div', { class: 'hud-timer__lbl' }, ['SESSION']),
      h('div', { class: 'hud-timer__val' }, [
        h('span', {}, [m]),
        h('span', { class: 'hud-timer__col' }, [':']),
        h('span', {}, [s])
      ])
    ]);
  }

  function buildFocusBrackets(size) {
    size = size || 220;
    var gap = size / 2 - 4, arm = 22;
    // corner brackets
    var corners = svg('g', { stroke: 'currentColor', 'stroke-width': '2.4', fill: 'none', 'stroke-linecap': 'square' });
    [
      'M ' + (size/2 - gap) + ' ' + (size/2 - gap + arm) + ' L ' + (size/2 - gap) + ' ' + (size/2 - gap) + ' L ' + (size/2 - gap + arm) + ' ' + (size/2 - gap),
      'M ' + (size/2 + gap - arm) + ' ' + (size/2 - gap) + ' L ' + (size/2 + gap) + ' ' + (size/2 - gap) + ' L ' + (size/2 + gap) + ' ' + (size/2 - gap + arm),
      'M ' + (size/2 + gap) + ' ' + (size/2 + gap - arm) + ' L ' + (size/2 + gap) + ' ' + (size/2 + gap) + ' L ' + (size/2 + gap - arm) + ' ' + (size/2 + gap),
      'M ' + (size/2 - gap + arm) + ' ' + (size/2 + gap) + ' L ' + (size/2 - gap) + ' ' + (size/2 + gap) + ' L ' + (size/2 - gap) + ' ' + (size/2 + gap - arm)
    ].forEach(function (d) { corners.appendChild(svg('path', { d: d })); });

    // center crosshair micro-tick
    var cross = svg('g', { stroke: 'currentColor', 'stroke-width': '1.4', opacity: '0.55' });
    cross.appendChild(svg('line', { x1: size/2 - 6, y1: size/2, x2: size/2 + 6, y2: size/2 }));
    cross.appendChild(svg('line', { x1: size/2, y1: size/2 - 6, x2: size/2, y2: size/2 + 6 }));

    // tick marks on each axis
    var ticks = svg('g', { stroke: 'currentColor', 'stroke-width': '1', opacity: '0.45' });
    [-1, 1].forEach(function (d) {
      ticks.appendChild(svg('line', { x1: size/2 + d*30, y1: size/2 - 3, x2: size/2 + d*30, y2: size/2 + 3 }));
      ticks.appendChild(svg('line', { x1: size/2 - 3, y1: size/2 + d*30, x2: size/2 + 3, y2: size/2 + d*30 }));
    });

    // animated pulse circle
    var pulse = svg('circle', {
      class: 'hud-focus__pulse',
      cx: size/2, cy: size/2, r: 26,
      stroke: 'currentColor', 'stroke-width': '2', fill: 'none'
    });

    var s = svg('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size },
      [corners, cross, ticks, pulse]);

    // status chips rail beneath the bracket
    var rimChip = h('span', { class: 'hud-focus__chip' }, ['RIM · ' + (state.rimLocked ? 'LOCKED' : 'SEARCHING')]);
    var ptChip = h('span', { class: 'hud-focus__chip' }, ['3PT · ' + (state.threePtCalibrated ? 'CALIBRATED' : 'PARTIAL')]);
    var rail = h('div', { class: 'hud-focus__rail' }, [rimChip, ptChip]);

    return h('div', { class: 'hud-focus', style: { width: size + 'px', height: size + 'px' } }, [s, rail]);
  }

  function buildZoneMini() {
    var paths = [];
    for (var i = 0; i < ZONES.length; i++) {
      var z = ZONES[i];
      var active = z.id === state.activeZone;
      var acc = state.zoneAcc[z.id] || 0;
      var fill = active
        ? 'rgba(86,211,100,0.32)'
        : acc > 0
          ? 'rgba(86,211,100,' + (0.05 + 0.18 * acc).toFixed(2) + ')'
          : 'rgba(255,255,255,0.03)';
      var strokeColor = active ? '#56d364' : 'rgba(255,255,255,0.18)';
      var strokeW = active ? '4' : '2';
      paths.push(svg('path', {
        d: z.path, 'fill-rule': 'evenodd',
        fill: fill, stroke: strokeColor, 'stroke-width': strokeW
      }));
    }
    var courtSvg = svg('svg', {
      viewBox: '0 0 500 470', class: 'hud-zone__svg',
      preserveAspectRatio: 'xMidYMid meet'
    }, paths);

    return h('div', { class: 'hud-zone' }, [
      h('div', { class: 'hud-zone__label' }, ['ZONE']),
      courtSvg,
      h('div', { class: 'hud-zone__name' }, [getZoneName(state.activeZone)])
    ]);
  }

  function buildRecentString() {
    var lastFive = state.lastShots.slice(-5);
    while (lastFive.length < 5) lastFive.unshift(null);
    var pips = lastFive.map(function (s) {
      var cls = 'hud-recent__pip ' + (s == null ? 'is-empty' : s ? 'is-make' : 'is-miss');
      var txt = s == null ? '·' : s ? 'M' : 'X';
      return h('span', { class: cls }, [txt]);
    });
    return h('div', { class: 'hud-recent' }, [
      h('div', { class: 'hud-recent__lbl' }, ['LAST 5']),
      h('div', { class: 'hud-recent__row' }, pips)
    ]);
  }

  function buildHeroFG() {
    var pct = state.att > 0 ? (state.made / state.att) * 100 : 0;
    var intPart = Math.floor(pct);
    return h('div', { class: 'hud-hero' }, [
      h('div', { class: 'hud-hero__label' }, ['FIELD GOAL']),
      h('div', { class: 'hud-hero__num' }, [
        h('span', { class: 'hud-hero__int' }, [String(intPart)]),
        h('span', { class: 'hud-hero__pct' }, ['%'])
      ]),
      h('div', { class: 'hud-hero__delta' }, [
        h('span', { class: 'hud-hero__arrow' }, ['▲']),
        ' +4 vs last session'
      ])
    ]);
  }

  function buildEndButton() {
    return h('button', { class: 'hud-end', onclick: function () { endSession(); } }, [
      h('span', { class: 'hud-end__icon' }),
      h('span', { class: 'hud-end__txt' }, ['END SESSION'])
    ]);
  }

  /* ── Phase screens ────────────────────────────────────────────────── */

  function buildCalibrationScreen() {
    return h('div', { class: 'hud hud--phase-cal' }, [
      videoEl, canvasEl,
      h('div', { class: 'hud-cal' }, [
        h('div', { class: 'hud-cal__icon' }, ['🎯']),
        h('div', { class: 'hud-cal__title' }, ['CALIBRATING']),
        h('div', { class: 'hud-cal__instruction' }, ['Point camera at the hoop']),
        h('div', { class: 'hud-cal__sub' }, ['Hold steady — detecting rim position']),
        h('div', { class: 'hud-cal__spinner' })
      ])
    ]);
  }

  function buildRimLockScreen() {
    return h('div', { class: 'hud hud--phase-lock' }, [
      videoEl, canvasEl,
      h('div', { class: 'hud-cal' }, [
        h('div', { class: 'hud-cal__icon hud-cal__icon--ok' }, ['✓']),
        h('div', { class: 'hud-cal__title hud-cal__title--ok' }, ['RIM LOCKED']),
        h('div', { class: 'hud-cal__sub' }, ['Rim detected and locked. Calibrating 3PT line…'])
      ])
    ]);
  }

  function buildThreePtScreen() {
    return h('div', { class: 'hud hud--phase-3pt' }, [
      videoEl, canvasEl,
      h('div', { class: 'hud-cal' }, [
        h('div', { class: 'hud-cal__icon' }, ['📍']),
        h('div', { class: 'hud-cal__title' }, ['3PT CALIBRATION']),
        h('div', { class: 'hud-cal__sub' }, ['Mapping three-point arc…']),
        h('div', { class: 'hud-cal__spinner' })
      ])
    ]);
  }

  function buildLiveHUD() {
    return h('div', { class: 'hud', 'data-mode': 'broadcast' }, [
      videoEl, canvasEl,

      /* TOP BAR */
      h('div', { class: 'hud-top' }, [
        buildScoreboard(),
        buildLivePill(),
        buildTimer(Date.now() - (state.startMs || Date.now()))
      ]),

      /* RIGHT RAIL — zone mini + recent */
      h('div', { class: 'hud-rail' }, [
        buildZoneMini(),
        buildRecentString()
      ]),

      /* CENTER — detection bracket */
      h('div', { class: 'hud-center' }, [
        buildFocusBrackets(220)
      ]),

      /* BOTTOM — hero FG% + end session */
      h('div', { class: 'hud-bottom' }, [
        buildHeroFG(),
        buildEndButton()
      ])
    ]);
  }

  /* ── Render orchestration ─────────────────────────────────────────── */

  function ensureVideoCanvas() {
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.className = 'hud-video';
      videoEl.autoplay = true; videoEl.muted = true; videoEl.playsInline = true;
    }
    if (!canvasEl) {
      canvasEl = document.createElement('canvas');
      canvasEl.className = 'hud-detect-canvas';
      canvasEl.style.display = 'none';
    }
  }

  function repaint() {
    if (!hostRef) return;
    DOM.clearChildren(hostRef);
    ensureVideoCanvas();

    var screen;
    switch (state.phase) {
      case 'calibrating': screen = buildCalibrationScreen(); break;
      case 'rimlock':     screen = buildRimLockScreen(); break;
      case 'threept':     screen = buildThreePtScreen(); break;
      case 'live':        screen = buildLiveHUD(); break;
      default:            screen = buildCalibrationScreen(); break;
    }
    hostRef.appendChild(screen);
  }

  /** Incremental update for the live phase — avoids full DOM rebuild */
  function repaintLiveHUD() {
    if (state.phase !== 'live' || !hostRef) return;
    // Update scoreboard
    var scoreNum = hostRef.querySelector('.hud-score__num');
    if (scoreNum) scoreNum.textContent = pad2(state.made);
    var scoreAtt = hostRef.querySelector('.hud-score__att');
    if (scoreAtt) scoreAtt.textContent = pad2(state.att);

    // Update hero FG
    var heroInt = hostRef.querySelector('.hud-hero__int');
    if (heroInt) {
      var pct = state.att > 0 ? Math.floor((state.made / state.att) * 100) : 0;
      heroInt.textContent = String(pct);
    }

    // Update recent pips
    var recentRow = hostRef.querySelector('.hud-recent__row');
    if (recentRow) {
      DOM.clearChildren(recentRow);
      var lastFive = state.lastShots.slice(-5);
      while (lastFive.length < 5) lastFive.unshift(null);
      lastFive.forEach(function (s) {
        var cls = 'hud-recent__pip ' + (s == null ? 'is-empty' : s ? 'is-make' : 'is-miss');
        var txt = s == null ? '·' : s ? 'M' : 'X';
        recentRow.appendChild(h('span', { class: cls }, [txt]));
      });
    }

    // Update zone mini
    var zoneContainer = hostRef.querySelector('.hud-rail');
    if (zoneContainer) {
      DOM.clearChildren(zoneContainer);
      zoneContainer.appendChild(buildZoneMini());
      zoneContainer.appendChild(buildRecentString());
    }
  }

  function tickTimer() {
    if (state.phase !== 'live') return;
    var timerEl = hostRef && hostRef.querySelector('.hud-timer');
    if (!timerEl) return;
    var parent = timerEl.parentNode;
    var newTimer = buildTimer(Date.now() - state.startMs);
    parent.replaceChild(newTimer, timerEl);
  }

  /* ── Phase management ─────────────────────────────────────────────── */

  function advancePhase(nextPhase, delayMs) {
    if (phaseTimer) clearTimeout(phaseTimer);
    phaseTimer = setTimeout(function () {
      state.phase = nextPhase;
      repaint();
      runPhaseLogic();
    }, delayMs);
  }

  function runPhaseLogic() {
    switch (state.phase) {
      case 'calibrating':
        // Simulate rim detection taking ~2s (real: detector callback)
        advancePhase('rimlock', 2000);
        break;
      case 'rimlock':
        state.rimLocked = true;
        advancePhase('threept', 1500);
        break;
      case 'threept':
        state.threePtCalibrated = true;
        advancePhase('live', 1800);
        break;
      case 'live':
        startLiveTracking();
        break;
    }
  }

  function startLiveTracking() {
    state.startMs = Date.now();
    state.made = 0; state.att = 0;
    state.lastShots = [];
    repaint();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tickTimer, 1000);
    state.rafId = requestAnimationFrame(detectionLoop);
  }

  function endSession() {
    state.phase = 'ending';
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = 0;
    if (phaseTimer) clearTimeout(phaseTimer);
    phaseTimer = 0;
    if (state.celebrateTimer) clearTimeout(state.celebrateTimer);
    state.celebrateTimer = 0;
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

  /* ── Public API ───────────────────────────────────────────────────── */

  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-camera-hud');

    // Reset state for fresh session
    state.phase = 'calibrating';
    state.rimLocked = false;
    state.threePtCalibrated = false;
    state.celebrate = null;
    state.made = 0; state.att = 0;
    state.lastShots = [];
    state.activeZone = 'top';
    state.zoneAcc = { lc: 0, rc: 0, lw: 0, rw: 0, top: 0, mid: 0, pnt: 0 };
    state.pulseKey = 0;

    ensureVideoCanvas();
    repaint();

    initDetector().then(function (ok) {
      console.log('[camera-hud-v2] detector ready =', ok);
      return startCamera();
    }).then(function () {
      // Begin phase progression
      runPhaseLogic();
    }).catch(function (e) {
      console.warn('[camera-hud-v2] start error', e);
      // Still run phases even without camera
      runPhaseLogic();
    });
  }

  function cleanup() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = 0;
    if (phaseTimer) clearTimeout(phaseTimer);
    phaseTimer = 0;
    if (state.celebrateTimer) clearTimeout(state.celebrateTimer);
    state.celebrateTimer = 0;
    stopCamera();
    if (hostRef) DOM.clearChildren(hostRef);
    videoEl = null;
    canvasEl = null;
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_CameraHUD = { render: render, cleanup: cleanup };
})();
