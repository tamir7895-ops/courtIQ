/* ══════════════════════════════════════════════════════════════
   SHOT TRACKING SCREEN — Vanilla JS / HTML5 / Canvas
   Self-contained UI module for the AI Shot Tracker feature.

   Phases:
     1. TRACKING — Camera preview opens; YOLOX auto-locks the rim
                   on first stable hoop detection, then continuously
                   EMA-tracks it. Manual tap appears as a fallback
                   if no auto-lock within MANUAL_FALLBACK_MS.
     2. SUMMARY  — Post-session results + shot chart + save

   Legacy "rim lock" / "3-point calibration" overlays are still in
   the DOM and bound (see onRimTap, enterThreePtCalibration) but
   are bypassed by the default flow. Kept for a future settings
   entry that lets users force-calibrate manually.

   Dependencies:
     - ShotDetectionEngine  (shotDetection.js)
     - ShotService           (shotService.js)
     - Global `sb`           (supabase-client.js)
     - Global `currentUser`  (dashboard.js auth guard)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Constants ──────────────────────────────────────────────── */
  var DEFAULT_RIM_W = 0.18;
  var DEFAULT_RIM_H = 0.04;
  var XP_PER_MADE   = 10;
  var XP_PER_ATTEMPT = 2;

  /* ── Half-court SVG dimensions (for shot chart) ─────────────── */
  var COURT_W = 500;
  var COURT_H = 470;
  var RIM_SVG_X = COURT_W / 2;
  var RIM_SVG_Y = 63;
  var THREE_PT_R = 190;

  /* ── Auto rim-tracking constants ────────────────────────────── */
  // Per-detection EMA on rim center / size. 0.3 ≈ 80% convergence in 4
  // frames (~0.8s at 5Hz YOLOX cadence) — enough to track a phone that
  // gets nudged, slow enough to ignore single-frame bbox noise.
  var RIM_EMA_ALPHA         = 0.3;
  // Time after the first auto-lock before the state machine is allowed
  // to count shots. The rim is still drifting toward its true position
  // during this window.
  var RIM_STABILIZATION_MS  = 2000;
  // No hoop detection for this long → rim is "lost", state machine is
  // re-gated until detections resume. ~10 frames at 5Hz.
  var HOOP_LOST_MS          = 2000;
  // No auto-lock within this window → reveal the manual-tap fallback UI.
  var MANUAL_FALLBACK_MS    = 5000;

  /* ── State ──────────────────────────────────────────────────── */
  var phase = 'idle'; // idle | rimlock | threept | tracking | summary
  var stream = null;
  var videoFileUrl = null; // set when opening from a local video file (upload mode)
  var videoEl, canvasEl, canvasCtx;
  var overlayAnimFrame = null;

  // Rim lock state
  var rimCenter = null;       // { x, y } normalized (0-1)
  var rimSize   = { w: DEFAULT_RIM_W, h: DEFAULT_RIM_H };
  var rimLocked = false;

  // Auto rim-tracking state (reset each session in openScreen)
  var rimAutoMode         = true;   // false once user manually taps
  var rimStabilizationT   = null;   // setTimeout handle
  var lastHoopDetectAt    = 0;      // timestamp of last accepted hoop detection
  var lastHoopConfidence  = 0;
  var hoopLost            = false;
  var manualFallbackShown = false;

  // 3PT calibration state
  var threePtPoint = null;    // { x, y } normalized — user-tapped 3PT line point
  var threePtDistance = 0;    // Euclidean distance from 3PT point to rim center

  // Tracking state
  var sessionId     = null;
  var sessionStart  = 0;
  var elapsedSec    = 0;
  var timerInterval = null;
  var shots         = [];
  var streak        = 0;
  var maxStreak     = 0;

  // Debug overlay state
  var debugMode = false;
  var debugData = { balls: [], hoops: [], shotState: 'idle', frameCount: 0 };

  // DOM refs (populated in buildHTML)
  var els = {};

  /* ══════════════════════════════════════════════════════════════
     HTML INJECTION
     ══════════════════════════════════════════════════════════════ */
  function buildHTML() {
    var screen = document.getElementById('shot-tracking-screen');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'shot-tracking-screen';
      document.body.appendChild(screen);
    }

    screen.innerHTML = [
      /* Video + Canvas layer */
      '<div class="st-video-wrap">',
        '<video id="st-video" playsinline muted></video>',
        '<canvas id="st-canvas"></canvas>',
      '</div>',

      /* ── Rim Lock overlay ── */
      '<div id="st-rimlock" class="st-rimlock-overlay">',
        '<div class="st-rimlock-scrim" id="st-rimlock-tap"></div>',
        '<div class="st-rimlock-instruction"><p id="st-rimlock-text">Tap the center of the basketball rim</p></div>',
        '<div class="st-crosshair-h" id="st-crosshair-h"></div>',
        '<div class="st-crosshair-v" id="st-crosshair-v"></div>',
        '<div class="st-crosshair-center" id="st-crosshair-center"></div>',
        '<div class="st-rim-indicator" id="st-rim-indicator"></div>',
        '<div class="st-rim-size-controls" id="st-size-controls">',
          '<button class="st-rim-size-btn" id="st-size-minus">&minus;</button>',
          '<span class="st-rim-size-label">Rim Size</span>',
          '<button class="st-rim-size-btn" id="st-size-plus">+</button>',
        '</div>',
        '<button class="st-lock-btn" id="st-lock-btn">Lock Rim & Start</button>',
        '<button class="st-cancel-btn" id="st-cancel-btn">Cancel</button>',
      '</div>',

      /* ── 3PT Calibration overlay ── */
      '<div id="st-threept" class="st-rimlock-overlay">',
        '<div class="st-rimlock-scrim" id="st-threept-tap"></div>',
        '<div class="st-rimlock-instruction"><p id="st-threept-text">Tap the 3-point line (anywhere on the arc)</p></div>',
        '<div class="st-threept-marker" id="st-threept-marker"></div>',
        '<div class="st-threept-line" id="st-threept-line"></div>',
        '<button class="st-lock-btn" id="st-threept-confirm">Confirm & Start</button>',
        '<button class="st-cancel-btn" id="st-threept-skip">Skip (use defaults)</button>',
      '</div>',

      /* ── Tracking overlay ── */
      '<div id="st-tracking" class="st-tracking-overlay">',
        '<div class="st-top-bar">',
          '<div class="st-stat-row">',
            '<div class="st-stat-block"><div class="st-stat-value" id="st-made">0</div><div class="st-stat-label">Made</div></div>',
            '<div class="st-stat-divider"></div>',
            '<div class="st-stat-block"><div class="st-stat-value" id="st-attempts">0</div><div class="st-stat-label">Attempts</div></div>',
            '<div class="st-stat-divider"></div>',
            '<div class="st-stat-block"><div class="st-stat-value" id="st-accuracy" style="color:#f5a623;">0%</div><div class="st-stat-label">Accuracy</div></div>',
          '</div>',
          '<div class="st-timer" id="st-timer">0:00</div>',
        '</div>',
        '<div class="st-status-badge" id="st-status-badge">',
          '<div class="st-status-dot loading" id="st-status-dot"></div>',
          '<span class="st-status-text" id="st-status-text">Loading model...</span>',
        '</div>',
        '<div class="st-zone-badge" id="st-zone-badge"></div>',
        '<div class="st-flash" id="st-flash"></div>',
        '<div class="st-result-text" id="st-result-text"></div>',
        '<div class="st-bottom-bar">',
          '<button class="st-debug-toggle" id="st-debug-toggle" title="Toggle Debug Overlay">&#x1f41b;</button>',
          '<button class="st-stop-btn" id="st-stop-btn">',
            '<div class="st-stop-icon"></div>',
            '<span class="st-stop-text">End Session</span>',
          '</button>',
        '</div>',
        /* ── Debug info panel (hidden by default) ── */
        '<div class="st-debug-panel" id="st-debug-panel">',
          '<div id="st-debug-info"></div>',
        '</div>',
        /* ── End session confirmation modal ── */
        '<div class="st-confirm-modal" id="st-confirm-modal">',
          '<div class="st-confirm-box">',
            '<p>End session and view your results?</p>',
            '<div class="st-confirm-btns">',
              '<button class="st-confirm-yes" id="st-confirm-yes">End Session</button>',
              '<button class="st-confirm-no" id="st-confirm-no">Keep Going</button>',
            '</div>',
          '</div>',
        '</div>',
      '</div>',

      /* ── Summary overlay ── */
      '<div id="st-summary" class="st-summary-overlay">',
        '<div class="st-summary-content" id="st-summary-content"></div>',
      '</div>'
    ].join('');

    // Cache refs
    els.screen           = screen;
    els.video            = document.getElementById('st-video');
    els.canvas           = document.getElementById('st-canvas');
    els.rimlock          = document.getElementById('st-rimlock');
    els.rimlockTap       = document.getElementById('st-rimlock-tap');
    els.rimlockText      = document.getElementById('st-rimlock-text');
    els.crosshairH       = document.getElementById('st-crosshair-h');
    els.crosshairV       = document.getElementById('st-crosshair-v');
    els.crosshairCenter  = document.getElementById('st-crosshair-center');
    els.rimIndicator     = document.getElementById('st-rim-indicator');
    els.sizeControls     = document.getElementById('st-size-controls');
    els.sizeMinus        = document.getElementById('st-size-minus');
    els.sizePlus         = document.getElementById('st-size-plus');
    els.lockBtn          = document.getElementById('st-lock-btn');
    els.cancelBtn        = document.getElementById('st-cancel-btn');
    els.threept          = document.getElementById('st-threept');
    els.threeptTap       = document.getElementById('st-threept-tap');
    els.threeptText      = document.getElementById('st-threept-text');
    els.threeptMarker    = document.getElementById('st-threept-marker');
    els.threeptLine      = document.getElementById('st-threept-line');
    els.threeptConfirm   = document.getElementById('st-threept-confirm');
    els.threeptSkip      = document.getElementById('st-threept-skip');
    els.tracking         = document.getElementById('st-tracking');
    els.made             = document.getElementById('st-made');
    els.attempts         = document.getElementById('st-attempts');
    els.accuracy         = document.getElementById('st-accuracy');
    els.timer            = document.getElementById('st-timer');
    els.statusBadge      = document.getElementById('st-status-badge');
    els.statusDot        = document.getElementById('st-status-dot');
    els.statusText       = document.getElementById('st-status-text');
    els.zoneBadge        = document.getElementById('st-zone-badge');
    els.flash            = document.getElementById('st-flash');
    els.resultText       = document.getElementById('st-result-text');
    els.stopBtn          = document.getElementById('st-stop-btn');
    els.debugToggle      = document.getElementById('st-debug-toggle');
    els.debugPanel       = document.getElementById('st-debug-panel');
    els.debugInfo        = document.getElementById('st-debug-info');
    els.summary          = document.getElementById('st-summary');
    els.summaryContent   = document.getElementById('st-summary-content');

    videoEl   = els.video;
    canvasEl  = els.canvas;
    canvasCtx = canvasEl.getContext('2d');

    bindEvents();
  }

  /* ══════════════════════════════════════════════════════════════
     EVENT BINDING
     ══════════════════════════════════════════════════════════════ */
  function bindEvents() {
    els.rimlockTap.addEventListener('click', onRimTap);
    els.sizeMinus.addEventListener('click', function () { adjustRimSize(-0.02); });
    els.sizePlus.addEventListener('click', function () { adjustRimSize(0.02); });
    els.lockBtn.addEventListener('click', onLockAndStart);
    els.cancelBtn.addEventListener('click', closeScreen);
    els.threeptTap.addEventListener('click', onThreePtTap);
    els.threeptConfirm.addEventListener('click', onThreePtConfirm);
    els.threeptSkip.addEventListener('click', onThreePtSkip);
    els.stopBtn.addEventListener('click', onStopSession);
    els.debugToggle.addEventListener('click', function () {
      debugMode = !debugMode;
      els.debugToggle.classList.toggle('active', debugMode);
      els.debugPanel.classList.toggle('active', debugMode);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════ */
  /* ── Calibration persistence ─────────────────────────────────── */
  var CALIBRATION_KEY = 'courtiq-rim-calibration';

  function saveCalibration() {
    try {
      var data = {
        rimCenter: rimCenter,
        rimSize: rimSize,
        threePtPoint: threePtPoint,
        threePtDistance: threePtDistance,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(CALIBRATION_KEY, JSON.stringify(data));
    } catch (e) { /* silent */ }
  }

  function loadCalibration() {
    try {
      var raw = localStorage.getItem(CALIBRATION_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data && data.rimCenter && data.rimSize) return data;
    } catch (e) { /* silent */ }
    return null;
  }

  function openScreen() {
    buildHTML();
    els.screen.classList.add('active');
    shots = [];
    streak = 0;
    maxStreak = 0;

    // Reset rim/3PT state
    rimCenter = null;
    rimLocked = false;
    rimSize = { w: DEFAULT_RIM_W, h: DEFAULT_RIM_H };
    threePtPoint = null;
    threePtDistance = 0;

    // Reset auto rim-tracking state
    rimAutoMode = true;
    if (rimStabilizationT) { clearTimeout(rimStabilizationT); rimStabilizationT = null; }
    lastHoopDetectAt = 0;
    lastHoopConfidence = 0;
    hoopLost = false;
    manualFallbackShown = false;

    // Skip rimlock — go straight to tracking with auto-detection
    els.rimlock.classList.remove('active');
    els.threept.classList.remove('active');
    els.tracking.classList.remove('active');
    els.summary.classList.remove('active');

    startCamera();

    // Go straight to tracking phase (auto-detect hoop via YOLOX)
    setTimeout(function () {
      startTrackingWithAutoDetect();
    }, 300);
  }

  function closeScreen() {
    stopCamera();
    stopTracking();
    phase = 'idle';
    if (els.screen) els.screen.classList.remove('active');
  }

  /* ══════════════════════════════════════════════════════════════
     CAMERA
     ══════════════════════════════════════════════════════════════ */
  function startCamera() {
    // ── File-upload mode ─────────────────────────────────────────
    if (videoFileUrl) {
      // Create a FRESH video element to avoid any stale state
      var freshVideo = document.createElement('video');
      freshVideo.id          = 'st-video';
      freshVideo.playsInline = true;
      freshVideo.muted       = true;
      freshVideo.loop        = false;
      freshVideo.preload     = 'auto';
      freshVideo.setAttribute('playsinline', '');
      freshVideo.setAttribute('muted', '');
      freshVideo.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';

      // Replace old video element in the DOM
      var wrap = videoEl.parentNode;
      wrap.replaceChild(freshVideo, videoEl);
      videoEl = freshVideo;
      els.video = freshVideo;

      // Resize canvas once metadata is available
      freshVideo.addEventListener('loadedmetadata', function () {
        resizeCanvas();
      });

      // When ready — play briefly then pause to show a visible frame
      freshVideo.oncanplay = function () {
        freshVideo.oncanplay = null;
        resizeCanvas();
        // Play briefly to decode a frame, then pause for calibration
        freshVideo.play().then(function () {
          setTimeout(function () {
            if (phase === 'rimlock' || phase === 'threept') {
              freshVideo.pause();
            }
          }, 200);
        }).catch(function () {
          // Autoplay blocked — that's fine, browser shows poster frame
        });
      };

      // Auto-advance to summary when file finishes playing
      freshVideo.onended = function () {
        if (phase === 'tracking') enterSummaryPhase();
      };

      // Log errors but do NOT block — let the user retry or cancel
      freshVideo.onerror = function () {
        var err = freshVideo.error;
        console.warn('Video error:', err ? 'code=' + err.code + ' ' + err.message : 'unknown');
      };

      // Set the source — this triggers loading
      freshVideo.src = videoFileUrl;
      return;
    }

    // ── Live camera mode ─────────────────────────────────────────
    if (stream) return;

    // 1280×720 chosen for visual quality of the live preview and the
    // recorded video-replay clip. Detection itself downscales to 640px wide,
    // so a smaller capture (e.g. 854×480) would save ~30% of camera/encoder
    // power on battery-bound devices without affecting accuracy. Worth
    // revisiting on mobile if thermal throttling becomes an issue.
    var constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(function (s) {
        stream = s;
        videoEl.srcObject = s;
        videoEl.play();
        videoEl.addEventListener('loadedmetadata', function onMeta() {
          videoEl.removeEventListener('loadedmetadata', onMeta);
          resizeCanvas();
        });
      })
      .catch(function (err) {
        console.error('Camera access failed:', err);
        // Distinguish common failure modes so the user sees an actionable message.
        var name = (err && err.name) || '';
        var msg;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          msg = 'Camera access was denied. Please allow camera permissions in your browser settings and try again.';
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          msg = 'The camera is in use by another app. Close other apps using the camera and try again.';
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          msg = 'No camera was found on this device.';
        } else if (name === 'OverconstrainedError') {
          msg = 'Your camera does not support the requested resolution. Please try again on a different device.';
        } else {
          msg = 'Camera access is required for shot tracking. Please allow camera permissions and try again.';
        }
        alert(msg);
        closeScreen();
      });
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.srcObject = null;
      // Do NOT call videoEl.load() — it fires error events on empty src
    }
    if (videoFileUrl) {
      URL.revokeObjectURL(videoFileUrl);
      videoFileUrl = null;
    }
  }

  function resizeCanvas() {
    if (!canvasEl || !videoEl) return;
    /* Match canvas to visible video area (respects object-fit:contain) */
    var containerW = videoEl.clientWidth;
    var containerH = videoEl.clientHeight;
    var vidW = videoEl.videoWidth || containerW;
    var vidH = videoEl.videoHeight || containerH;

    if (containerW > 0 && containerH > 0 && vidW > 0 && vidH > 0) {
      /* Calculate displayed size with object-fit:contain */
      var vidAspect = vidW / vidH;
      var containerAspect = containerW / containerH;
      var displayW, displayH, offsetX, offsetY;
      if (vidAspect > containerAspect) {
        /* Video wider than container — letterbox top/bottom */
        displayW = containerW;
        displayH = containerW / vidAspect;
        offsetX = 0;
        offsetY = (containerH - displayH) / 2;
      } else {
        /* Video taller than container — pillarbox left/right */
        displayH = containerH;
        displayW = containerH * vidAspect;
        offsetX = (containerW - displayW) / 2;
        offsetY = 0;
      }
      canvasEl.width = Math.round(displayW);
      canvasEl.height = Math.round(displayH);
      canvasEl.style.position = 'absolute';
      canvasEl.style.left = Math.round(offsetX) + 'px';
      canvasEl.style.top = Math.round(offsetY) + 'px';
    } else {
      canvasEl.width = containerW || vidW;
      canvasEl.height = containerH || vidH;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     RIM LOCK PHASE
     ══════════════════════════════════════════════════════════════ */
  function onRimTap(e) {
    var rect = els.rimlockTap.getBoundingClientRect();
    var normX = (e.clientX - rect.left) / rect.width;
    var normY = (e.clientY - rect.top) / rect.height;

    // Manual-fallback path during tracking — single tap commits and turns
    // off the auto-EMA so the user's choice sticks. Allowed even if an
    // auto-lock just happened: the explicit tap means "use my position".
    if (phase === 'tracking') {
      rimCenter = { x: normX, y: normY };
      rimLocked = true;
      rimAutoMode = false;
      hoopLost = false;
      if (rimStabilizationT) { clearTimeout(rimStabilizationT); rimStabilizationT = null; }

      var engine = window.ShotDetectionEngine;
      engine.setRimZone(rimCenter.x, rimCenter.y, rimSize.w, rimSize.h);
      engine.setRimStabilized(true);

      els.rimlock.classList.remove('active');
      manualFallbackShown = false;
      setAutoStatus('Manual rim set', 'tracking');
      console.log('[ShotTracker] Manual rim tap → ' + normX.toFixed(3) + ',' + normY.toFixed(3));
      return;
    }

    // Legacy multi-step calibration path — kept intact for future use
    // (e.g. surfacing as an explicit "calibrate manually" settings entry).
    if (rimLocked) return;
    rimCenter = { x: normX, y: normY };
    updateRimIndicator();
    toggleCrosshairs(false);
    els.sizeControls.classList.add('active');
    els.lockBtn.classList.add('active');
    els.rimlockText.textContent = 'Adjust position or tap "Lock Rim & Start"';
  }

  function adjustRimSize(delta) {
    if (rimLocked || !rimCenter) return;
    rimSize.w = Math.max(0.08, Math.min(0.35, rimSize.w + delta));
    rimSize.h = Math.max(0.02, Math.min(0.12, rimSize.h + delta * 0.3));
    updateRimIndicator();
  }

  function updateRimIndicator() {
    if (!rimCenter) return;
    var el = els.rimIndicator;
    var pw = els.rimlockTap.clientWidth;
    var ph = els.rimlockTap.clientHeight;
    var w = rimSize.w * pw;
    var h = rimSize.h * ph;
    el.style.display = 'block';
    el.style.left   = (rimCenter.x * pw - w / 2) + 'px';
    el.style.top    = (rimCenter.y * ph - h / 2) + 'px';
    el.style.width  = w + 'px';
    el.style.height = h + 'px';
  }

  function toggleCrosshairs(show) {
    var v = show ? '' : 'none';
    els.crosshairH.style.display = v;
    els.crosshairV.style.display = v;
    els.crosshairCenter.style.display = v;
  }

  function onLockAndStart() {
    if (!rimCenter) return;
    rimLocked = true;
    els.rimIndicator.classList.add('locked');
    els.sizeControls.classList.remove('active');
    els.lockBtn.classList.remove('active');
    els.rimlockText.textContent = 'Rim locked!';

    setTimeout(function () {
      enterThreePtCalibration();
    }, 400);
  }

  /* ══════════════════════════════════════════════════════════════
     3-POINT LINE CALIBRATION PHASE
     ══════════════════════════════════════════════════════════════ */
  function enterThreePtCalibration() {
    phase = 'threept';
    els.rimlock.classList.remove('active');
    els.threept.classList.add('active');
    els.threeptMarker.style.display = 'none';
    els.threeptLine.style.display = 'none';
    els.threeptConfirm.classList.remove('active');
    els.threeptText.textContent = 'Tap the 3-point line (anywhere on the arc)';
    threePtPoint = null;
    threePtDistance = 0;
  }

  function onThreePtTap(e) {
    if (phase !== 'threept') return;

    var rect = els.threeptTap.getBoundingClientRect();
    var normX = (e.clientX - rect.left) / rect.width;
    var normY = (e.clientY - rect.top) / rect.height;

    threePtPoint = { x: normX, y: normY };

    // Calculate distance from this point to rim center
    var dx = normX - rimCenter.x;
    var dy = normY - rimCenter.y;
    threePtDistance = Math.sqrt(dx * dx + dy * dy);

    // Show marker at the tapped point
    var marker = els.threeptMarker;
    marker.style.display = 'block';
    marker.style.left = (normX * rect.width - 10) + 'px';
    marker.style.top  = (normY * rect.height - 10) + 'px';

    // Draw a dashed line from rim to the tapped point
    var line = els.threeptLine;
    var pw = rect.width;
    var ph = rect.height;
    var x1 = rimCenter.x * pw;
    var y1 = rimCenter.y * ph;
    var x2 = normX * pw;
    var y2 = normY * ph;
    var angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    var len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    line.style.display = 'block';
    line.style.left = x1 + 'px';
    line.style.top  = y1 + 'px';
    line.style.width = len + 'px';
    line.style.transform = 'rotate(' + angle + 'deg)';

    els.threeptConfirm.classList.add('active');
    els.threeptText.textContent = '3PT distance set. Tap again to adjust.';
  }

  function onThreePtConfirm() {
    if (!threePtPoint) return;
    els.threept.classList.remove('active');
    saveCalibration();
    enterTrackingPhase();
  }

  function onThreePtSkip() {
    threePtPoint = null;
    threePtDistance = 0;
    els.threept.classList.remove('active');
    saveCalibration();
    enterTrackingPhase();
  }

  /* ══════════════════════════════════════════════════════════════
     AUTO-DETECT TRACKING (skips rimlock)
     ══════════════════════════════════════════════════════════════ */
  function startTrackingWithAutoDetect() {
    enterTrackingPhase();
  }

  /* ══════════════════════════════════════════════════════════════
     TRACKING PHASE
     ══════════════════════════════════════════════════════════════ */
  function enterTrackingPhase() {
    phase = 'tracking';
    els.rimlock.classList.remove('active');
    els.tracking.classList.add('active');

    // Session init
    sessionId = 'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    sessionStart = Date.now();
    elapsedSec = 0;
    shots = [];
    streak = 0;
    maxStreak = 0;

    // Reset UI
    els.made.textContent = '0';
    els.attempts.textContent = '0';
    els.accuracy.textContent = '0%';
    els.timer.textContent = '0:00';

    // Auto-tracking initial state — the watchdog and onHoopDetected
    // path will move us through 'found' → 'tracking' as detections arrive.
    setAutoStatus('Looking for hoop...', 'searching');

    // Start timer
    timerInterval = setInterval(function () {
      elapsedSec++;
      els.timer.textContent = formatTime(elapsedSec);
    }, 1000);

    // For file upload mode — seek to start, then play
    if (videoFileUrl && videoEl) {
      resizeCanvas();

      function startPlayback() {
        videoEl.play().then(function () {
          resizeCanvas();
        }).catch(function (err) {
          console.warn('[ShotTracker] Video play failed:', err.message);
        });
      }

      if (videoEl.readyState >= 2) {
        videoEl.currentTime = 0;
        startPlayback();
      } else {
        // Video lost buffered data — wait for canplay before playing
        videoEl.addEventListener('canplay', function onReady() {
          videoEl.removeEventListener('canplay', onReady);
          videoEl.currentTime = 0;
          startPlayback();
        });
      }
    }

    // Configure detection engine
    var engine = window.ShotDetectionEngine;
    if (rimCenter) {
      engine.setRimZone(rimCenter.x, rimCenter.y, rimSize.w, rimSize.h);
    }
    engine.setThreePtDistance(threePtDistance);
    engine.onShotDetected = onShotDetected;
    engine.onBallUpdate   = onBallUpdate;
    engine.onStatusChange = onDetectionStatus;
    engine.onDebugFrame   = function (data) { debugData = data; };

    // Auto-detect hoop from YOLOX + continuous re-anchoring
    // Smoothing buffer: accumulate detections before locking/re-anchoring
    var hoopBuffer = [];
    var HOOP_BUFFER_SIZE = 5;

    // The detected hoop bbox often covers backboard-and-rim or just the
    // rim itself — we can't tell which from confidence alone. Pulling the
    // rim estimate down to 75% of the bbox height (bottom quarter) lands
    // close to the real rim either way, and never above it. Manual taps
    // in onRimTap write the user's exact (x,y) — this offset is auto-only.
    var BBOX_RIM_OFFSET_FRAC = 0.25;  // shift down by 25% of bbox-h → rim ≈ 75% of bbox

    engine.onHoopDetected = function (hoop) {
      // Reject garbage detections near edges or with impossible size
      if (hoop.cx < 0.05 || hoop.cx > 0.95 || hoop.cy < 0.03 || hoop.cy > 0.95) return;
      if (hoop.bw < 0.02 || hoop.bh < 0.005) return;
      if (hoop.bw > 0.30 || hoop.bh > 0.25) return;
      if (hoop.score < 0.10) return;

      // Accept this detection — record liveness
      lastHoopDetectAt = Date.now();
      lastHoopConfidence = hoop.score;

      // Recovery from a previous "lost" period — re-enable counting
      // immediately. The rim was already calibrated; brief occlusions
      // (player crossing in front, etc.) shouldn't force re-stabilization.
      if (hoopLost) {
        hoopLost = false;
        if (rimLocked && rimAutoMode) {
          engine.setRimStabilized(true);
          setAutoStatus('Tracking', 'tracking');
        }
      }

      // Manual mode: user already tapped — auto-EMA stays out of the way.
      if (!rimAutoMode) return;

      // Accumulate detections for the INITIAL lock only — once locked,
      // we EMA on every accepted detection for smooth tracking.
      if (!rimLocked) {
        hoopBuffer.push({ cx: hoop.cx, cy: hoop.cy, bw: hoop.bw, bh: hoop.bh, score: hoop.score });
        if (hoopBuffer.length > HOOP_BUFFER_SIZE) hoopBuffer.shift();
        if (hoopBuffer.length < 3) return;

        // Average over buffer
        var avgCX = 0, avgCY = 0, avgBW = 0, avgBH = 0;
        for (var hi = 0; hi < hoopBuffer.length; hi++) {
          avgCX += hoopBuffer[hi].cx;
          avgCY += hoopBuffer[hi].cy;
          avgBW += hoopBuffer[hi].bw;
          avgBH += hoopBuffer[hi].bh;
        }
        avgCX /= hoopBuffer.length;
        avgCY /= hoopBuffer.length;
        avgBW /= hoopBuffer.length;
        avgBH /= hoopBuffer.length;

        // Reject if buffer is too spread out — wait for a calmer window
        var maxSpread = 0;
        for (var hj = 0; hj < hoopBuffer.length; hj++) {
          var spread = Math.abs(hoopBuffer[hj].cx - avgCX) + Math.abs(hoopBuffer[hj].cy - avgCY);
          if (spread > maxSpread) maxSpread = spread;
        }
        if (maxSpread > 0.08) return;

        // First lock — commit and arm the stabilization timer
        var anchoredCY = avgCY + avgBH * BBOX_RIM_OFFSET_FRAC;
        rimCenter = { x: avgCX, y: anchoredCY };
        rimSize = {
          w: Math.min(Math.max(avgBW, 0.08), 0.25),
          h: Math.min(Math.max(avgBH, 0.03), 0.15)
        };
        rimLocked = true;
        engine.setRimZone(rimCenter.x, rimCenter.y, rimSize.w, rimSize.h);
        onDetectionStatus('detecting');
        setAutoStatus('Hoop found - calibrating...', 'found');
        // Don't count shots until the EMA has had time to settle.
        if (rimStabilizationT) clearTimeout(rimStabilizationT);
        rimStabilizationT = setTimeout(function () {
          if (rimLocked && rimAutoMode && !hoopLost) {
            engine.setRimStabilized(true);
            setAutoStatus('Tracking', 'tracking');
          }
        }, RIM_STABILIZATION_MS);

        console.log('[ShotTracker] Auto-lock at (' + rimCenter.x.toFixed(3) + ',' + rimCenter.y.toFixed(3) +
          ') [bbox cy=' + avgCY.toFixed(3) + ', +' + (avgBH * BBOX_RIM_OFFSET_FRAC).toFixed(3) +
          '] from ' + hoopBuffer.length + ' detections');
        return;
      }

      // Already locked + auto mode: continuous EMA on every detection.
      // FREEZE during active shot states — the ball can occlude the rim,
      // shifting the bbox; updating mid-flight would skew the near_hoop
      // zone the state machine is using to judge make/miss.
      var st = engine._shotState;
      if (st === 'shot_started' || st === 'near_hoop') return;

      var anchoredCYNew = hoop.cy + hoop.bh * BBOX_RIM_OFFSET_FRAC;
      var newW = Math.min(Math.max(hoop.bw, 0.08), 0.25);
      var newH = Math.min(Math.max(hoop.bh, 0.03), 0.15);
      var a = RIM_EMA_ALPHA;
      rimCenter.x = (1 - a) * rimCenter.x + a * hoop.cx;
      rimCenter.y = (1 - a) * rimCenter.y + a * anchoredCYNew;
      rimSize.w   = (1 - a) * rimSize.w   + a * newW;
      rimSize.h   = (1 - a) * rimSize.h   + a * newH;
      engine.setRimZone(rimCenter.x, rimCenter.y, rimSize.w, rimSize.h);
    };

    // Initialize adaptive learning system
    var learningReady = window.AdaptiveLearning
      ? window.AdaptiveLearning.init()
      : Promise.resolve();

    // Initialize and start
    Promise.all([engine.init(), learningReady]).then(function (results) {
      var ok = results[0];
      if (ok && phase === 'tracking') {
        engine.start(videoEl);
        startOverlayLoop();

        // Start video recording for replay
        if (typeof VideoReview !== 'undefined' && VideoReview.isSupported() && stream) {
          VideoReview.startRecording(stream);
        }

        // Show learning status
        if (window.AdaptiveLearning) {
          var stats = window.AdaptiveLearning.getStats();
          if (stats.overallConfidence > 0.1) {
            onDetectionStatus('detecting-learned');
          }
        }
      }
    });
  }

  function stopTracking() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (overlayAnimFrame) { cancelAnimationFrame(overlayAnimFrame); overlayAnimFrame = null; }
    if (rimStabilizationT) { clearTimeout(rimStabilizationT); rimStabilizationT = null; }
    var engine = window.ShotDetectionEngine;
    if (engine) engine.stop();
    if (window.TrailRenderer) TrailRenderer.reset();
  }

  function onDetectionStatus(status) {
    var dot = els.statusDot;
    var txt = els.statusText;
    dot.className = 'st-status-dot';
    switch (status) {
      case 'loading':
        dot.classList.add('loading');
        txt.textContent = 'Loading AI model...';
        break;
      case 'retrying':
        dot.classList.add('loading');
        txt.textContent = 'Retrying model load...';
        break;
      case 'ready':
        txt.textContent = rimLocked ? 'AI + Color active' : 'Scanning for hoop...';
        break;
      case 'color-only':
        txt.textContent = 'Color tracking active';
        break;
      case 'detecting':
        txt.textContent = rimLocked ? 'Tracking' : 'Looking for hoop...';
        if (!rimLocked) dot.classList.add('loading');
        break;
      case 'detecting-learned':
        txt.textContent = rimLocked ? 'Tracking (AI learned)' : 'Looking for hoop...';
        if (!rimLocked) dot.classList.add('loading');
        break;
      case 'error':
        dot.classList.add('error');
        txt.textContent = 'Detection error';
        break;
      default:
        txt.textContent = status;
    }
  }

  // Auto-tracking status writer — used by the EMA path and the watchdog
  // to surface where we are in the lock lifecycle. `kind` controls the
  // dot styling: 'searching' / 'lost' use the loading pulse, others are
  // the steady green dot.
  function setAutoStatus(text, kind) {
    if (!els.statusText || !els.statusDot) return;
    els.statusText.textContent = text;
    els.statusDot.className = 'st-status-dot';
    if (kind === 'searching' || kind === 'lost') {
      els.statusDot.classList.add('loading');
    } else if (kind === 'error') {
      els.statusDot.classList.add('error');
    }
  }

  // Reveal the legacy rim-lock overlay in single-tap fallback mode —
  // used when YOLOX hasn't found the hoop after MANUAL_FALLBACK_MS.
  function showManualRimFallback() {
    if (!els.rimlock || !els.rimlockText) return;
    els.rimlock.classList.add('active');
    els.rimlockText.textContent = "Can't find the hoop - tap the rim to set it manually";
    if (els.sizeControls) els.sizeControls.classList.remove('active');
    if (els.lockBtn) els.lockBtn.classList.remove('active');
    toggleCrosshairs(false);
  }

  /* ── Shot callback ──────────────────────────────────────────── */
  function onShotDetected(data) {
    if (window.TrailRenderer) TrailRenderer.snapshotArc(data.result);
    var isMade = data.result === 'made';

    // Record shot with launch point and zone
    var userId = window.currentUser ? window.currentUser.id : 'anonymous';
    shots.push({
      session_id:  sessionId,
      user_id:     userId,
      shot_result: data.result,
      shot_x:      data.shotX,
      shot_y:      data.shotY,
      launch_x:    data.launchPoint ? data.launchPoint.x : data.shotX,
      launch_y:    data.launchPoint ? data.launchPoint.y : data.shotY,
      shot_zone:   data.shotZone || 'midrange',
      ball_trajectory_points: data.trajectory,
      timestamp:   new Date(data.timestamp).toISOString(),
      shot_number: shots.length + 1
    });

    // Record shot event for video replay
    if (typeof VideoReview !== 'undefined') VideoReview.recordShotEvent(data);
    // Save shot position for heatmap
    if (typeof CourtHeatmap !== 'undefined') CourtHeatmap.savePosition(data);

    // Streak
    if (isMade) {
      streak++;
      if (streak > maxStreak) maxStreak = streak;
    } else {
      streak = 0;
    }

    // Update UI
    var engine = window.ShotDetectionEngine;
    els.made.textContent = engine.stats.made;
    els.attempts.textContent = engine.stats.attempts;
    var pct = engine.stats.attempts > 0
      ? Math.round((engine.stats.made / engine.stats.attempts) * 100)
      : 0;
    els.accuracy.textContent = pct + '%';
    els.accuracy.style.color = getAccuracyColor(pct);

    // Zone badge
    showZoneBadge(data.shotZone || 'midrange');

    // Flash
    showFlash(isMade ? 'made' : 'missed');

    // Result text
    showResultText(isMade ? 'SWISH!' : 'MISS', isMade ? 'made' : 'missed');

    // Haptic (if available)
    if (navigator.vibrate) {
      navigator.vibrate(isMade ? [50, 30, 50] : [100]);
    }
  }

  var ZONE_LABELS = {
    paint: 'PAINT',
    midrange: 'MID',
    threePoint: '3PT',
    freeThrow: 'FT'
  };
  var ZONE_COLORS = {
    paint: '#ff4444',
    midrange: '#ffaa00',
    threePoint: '#4da6ff',
    freeThrow: '#ba68c8'
  };

  function showZoneBadge(zone) {
    var el = els.zoneBadge;
    el.textContent = ZONE_LABELS[zone] || zone;
    el.style.borderColor = ZONE_COLORS[zone] || '#888';
    el.style.color = ZONE_COLORS[zone] || '#888';
    el.className = 'st-zone-badge show';
    setTimeout(function () { el.classList.remove('show'); }, 1200);
  }

  function showFlash(cls) {
    var el = els.flash;
    el.className = 'st-flash ' + cls + ' show';
    setTimeout(function () { el.classList.remove('show'); }, 300);
  }

  function showResultText(text, cls) {
    var el = els.resultText;
    el.textContent = text;
    el.className = 'st-result-text ' + cls + ' show';
    setTimeout(function () { el.classList.remove('show'); }, 800);
  }

  /* ── Ball update callback → canvas overlay ──────────────────── */
  var currentBall = null;
  function onBallUpdate(pos) {
    currentBall = pos;
    if (window.TrailRenderer) {
      if (pos) TrailRenderer.update(pos.normX, pos.normY, Date.now());
      else TrailRenderer.clearCurrent();
    }
  }

  function startOverlayLoop() {
    function draw() {
      if (phase !== 'tracking') return;
      overlayAnimFrame = requestAnimationFrame(draw);

      // ── Auto-tracking watchdog ───────────────────────────────
      // Runs at the rAF cadence (~60Hz); both checks are time-based,
      // so the cost is just two timestamp comparisons per frame.
      var nowTs = Date.now();
      var engRef = window.ShotDetectionEngine;
      // Hoop lost — gate the state machine until we see it again.
      if (rimLocked && rimAutoMode && lastHoopDetectAt > 0 && !hoopLost &&
          (nowTs - lastHoopDetectAt > HOOP_LOST_MS)) {
        hoopLost = true;
        if (engRef) engRef.setRimStabilized(false);
        setAutoStatus('Searching for hoop...', 'lost');
      }
      // Manual fallback reveal — auto-detect hasn't found the hoop yet.
      if (!rimLocked && !manualFallbackShown && sessionStart > 0 &&
          (nowTs - sessionStart > MANUAL_FALLBACK_MS)) {
        manualFallbackShown = true;
        showManualRimFallback();
      }

      var cw = canvasEl.width;
      var ch = canvasEl.height;
      if (cw === 0 || ch === 0) { resizeCanvas(); return; }

      canvasCtx.clearRect(0, 0, cw, ch);

      // Draw rim zone indicator (dashed orange circle)
      if (rimCenter) {
        var rx = rimSize.w * cw / 2;
        var ry = rimSize.h * ch / 2;
        canvasCtx.save();
        canvasCtx.strokeStyle = 'rgba(245,166,35,0.5)';
        canvasCtx.lineWidth = 2;
        canvasCtx.setLineDash([8, 6]);
        canvasCtx.beginPath();
        canvasCtx.ellipse(
          rimCenter.x * cw, rimCenter.y * ch,
          rx, ry, 0, 0, Math.PI * 2
        );
        canvasCtx.stroke();
        // Light fill
        canvasCtx.fillStyle = 'rgba(245,166,35,0.06)';
        canvasCtx.fill();
        canvasCtx.restore();
      }

      // Draw motion trail
      if (window.TrailRenderer) {
        TrailRenderer.draw(canvasCtx, cw, ch);
      }

      // Draw ball tracking dot (color by detection source)
      if (currentBall) {
        var bx = currentBall.normX * cw;
        var by = currentBall.normY * ch;
        var dotColor = currentBall.source === 'ml' ? '#00ff88' :
                       currentBall.source === 'predicted' ? '#ff66ff' : '#ffaa00';
        canvasCtx.save();
        canvasCtx.beginPath();
        canvasCtx.arc(bx, by, 7, 0, Math.PI * 2);
        canvasCtx.fillStyle = dotColor;
        canvasCtx.fill();
        canvasCtx.strokeStyle = '#fff';
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
        // Glow
        canvasCtx.shadowColor = dotColor;
        canvasCtx.shadowBlur = 10;
        canvasCtx.beginPath();
        canvasCtx.arc(bx, by, 4, 0, Math.PI * 2);
        canvasCtx.fillStyle = dotColor;
        canvasCtx.fill();
        canvasCtx.restore();
      }

      // ── DEBUG MODE: Draw bounding boxes + labels ──────────────
      // Detections arrive in PROCESSING-CANVAS space (the cropped, downscaled
      // working buffer). To draw correctly on the display canvas we have to
      // walk the same chain the engine used:
      //   proc canvas → cropped video region (× cropScale)
      //                 → full video (+ cropOffset)
      //                 → display canvas (× cw/videoW)
      // Without the crop step the boxes drift on screen-recorded sources
      // that have UI chrome cropped out. Engine fields fall back to safe
      // defaults so older payloads (no crop info) still render reasonably.
      if (debugMode && debugData) {
        var dd        = debugData;
        var fullVw    = dd.videoW || (dd.procW || cw);
        var fullVh    = dd.videoH || (dd.procH || ch);
        var cropOX    = dd.cropOffsetX || 0;
        var cropOY    = dd.cropOffsetY || 0;
        var cropSX    = dd.cropScaleX  || 1;
        var cropSY    = dd.cropScaleY  || 1;
        var displaySX = cw / fullVw;
        var displaySY = ch / fullVh;

        // proc-canvas (cx, cy) → display-canvas px
        var toDispX = function (cx) { return (cx * cropSX + cropOX) * displaySX; };
        var toDispY = function (cy) { return (cy * cropSY + cropOY) * displaySY; };
        // proc-canvas size → display-canvas size (no offset on a width/height)
        var toDispW = function (bw) { return bw * cropSX * displaySX; };
        var toDispH = function (bh) { return bh * cropSY * displaySY; };

        // Draw hoop detections — BLUE bbox = what the model returned
        if (dd.hoops) {
          for (var hi = 0; hi < dd.hoops.length; hi++) {
            var h = dd.hoops[hi];
            var hx = toDispX(h.cx);
            var hy = toDispY(h.cy);
            var hw = toDispW(h.bw);
            var hh = toDispH(h.bh);
            canvasCtx.save();
            canvasCtx.strokeStyle = '#3b82f6';
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeRect(hx - hw/2, hy - hh/2, hw, hh);
            canvasCtx.fillStyle = 'rgba(59,130,246,0.15)';
            canvasCtx.fillRect(hx - hw/2, hy - hh/2, hw, hh);
            // Label
            var hLabel = 'HOOP ' + (h.score * 100).toFixed(0) + '%';
            canvasCtx.font = 'bold 12px monospace';
            canvasCtx.fillStyle = '#000';
            canvasCtx.fillRect(hx - hw/2, hy - hh/2 - 18, canvasCtx.measureText(hLabel).width + 8, 18);
            canvasCtx.fillStyle = '#3b82f6';
            canvasCtx.fillText(hLabel, hx - hw/2 + 4, hy - hh/2 - 4);
            canvasCtx.restore();
          }
        }

        // ── State machine badge (top-left corner) ──
        if (dd.shotState) {
          var stColor = dd.shotState === 'idle' ? '#888' :
                        dd.shotState === 'shot_started' ? '#ffaa00' :
                        dd.shotState === 'near_hoop' ? '#facc15' :
                        dd.shotState === 'cooldown' ? '#3b82f6' : '#ff4444';
          var stLabel = 'STATE: ' + dd.shotState.toUpperCase();
          canvasCtx.save();
          canvasCtx.font = 'bold 12px monospace';
          var stW = canvasCtx.measureText(stLabel).width + 12;
          canvasCtx.fillStyle = 'rgba(0,0,0,0.7)';
          canvasCtx.fillRect(8, 8, stW, 22);
          canvasCtx.fillStyle = stColor;
          canvasCtx.fillText(stLabel, 14, 24);
          canvasCtx.restore();
        }

        // ── Rim-region overlays (estimated rim line + near_hoop zone) ──
        // Help visually verify whether auto-rim-lock landed where the
        // actual rim is, vs. drifting up onto the backboard.
        // rim coords are in FULL-VIDEO normalized space (0..1 of the
        // visible video), so the display canvas (which is sized to the
        // visible video) maps directly via cw / ch — no crop step.
        var rimZ = (engRef && engRef.rimZone) ? engRef.rimZone : null;
        if (rimZ) {
          var rimDX = rimZ.centerX * cw;
          var rimDY = rimZ.centerY * ch;
          var rimDW = rimZ.width * cw;
          var rimDH = rimZ.height * ch;
          canvasCtx.save();

          // Estimated rim line — solid red horizontal line at rim.centerY
          // (or grey-dashed if the EMA is currently frozen during a shot,
          //  since the rim won't move until the shot resolves).
          var rimFrozen = (dd.shotState === 'shot_started' || dd.shotState === 'near_hoop');
          canvasCtx.strokeStyle = rimFrozen ? '#9ca3af' : '#ff3b3b';
          canvasCtx.lineWidth = 2;
          if (rimFrozen) canvasCtx.setLineDash([4, 4]);
          canvasCtx.beginPath();
          canvasCtx.moveTo(0, rimDY);
          canvasCtx.lineTo(cw, rimDY);
          canvasCtx.stroke();
          canvasCtx.setLineDash([]);
          canvasCtx.font = 'bold 11px monospace';
          // Compose the rim label: mode + confidence (auto only) + FROZEN
          var rimLbl = 'RIM ' + (rimAutoMode ? 'AUTO' : 'MANUAL');
          if (rimAutoMode && lastHoopConfidence > 0) {
            rimLbl += ' ' + (lastHoopConfidence * 100).toFixed(0) + '%';
          }
          if (rimFrozen) rimLbl += ' [FROZEN]';
          canvasCtx.fillStyle = rimFrozen ? '#9ca3af' : '#ff3b3b';
          canvasCtx.fillText(rimLbl, 6, rimDY - 4);

          // near_hoop zone — dashed yellow rectangle centred on rim
          // (matches the state-machine geometry: ±1.5 rim widths
          // horizontally, ±2.5 rim heights vertically)
          var nzW = rimDW * 3.0;
          var nzH = rimDH * 5.0;
          canvasCtx.strokeStyle = '#facc15';
          canvasCtx.lineWidth = 2;
          canvasCtx.setLineDash([6, 4]);
          canvasCtx.strokeRect(rimDX - nzW / 2, rimDY - nzH / 2, nzW, nzH);
          canvasCtx.setLineDash([]);
          canvasCtx.fillStyle = '#facc15';
          canvasCtx.fillText('NEAR_HOOP', rimDX - nzW / 2 + 4, rimDY - nzH / 2 - 4);

          canvasCtx.restore();
        }

        // Draw ball detections (green boxes)
        if (dd.balls) {
          for (var bi = 0; bi < dd.balls.length; bi++) {
            var b = dd.balls[bi];
            var bx2 = toDispX(b.cx);
            var by2 = toDispY(b.cy);
            var bw2 = toDispW(b.bw);
            var bh2 = toDispH(b.bh);
            canvasCtx.save();
            canvasCtx.strokeStyle = '#00ff88';
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeRect(bx2 - bw2/2, by2 - bh2/2, bw2, bh2);
            canvasCtx.fillStyle = 'rgba(0,255,136,0.12)';
            canvasCtx.fillRect(bx2 - bw2/2, by2 - bh2/2, bw2, bh2);
            // Label
            var bLabel = 'BALL ' + (b.score * 100).toFixed(0) + '%';
            canvasCtx.font = 'bold 12px monospace';
            canvasCtx.fillStyle = '#000';
            canvasCtx.fillRect(bx2 - bw2/2, by2 - bh2/2 - 18, canvasCtx.measureText(bLabel).width + 8, 18);
            canvasCtx.fillStyle = '#00ff88';
            canvasCtx.fillText(bLabel, bx2 - bw2/2 + 4, by2 - bh2/2 - 4);
            canvasCtx.restore();
          }
        }

        // Update debug info panel
        if (els.debugInfo && dd.frameCount % 5 === 0) {
          var stateColor = dd.shotState === 'idle' ? '#888' :
                           dd.shotState === 'shot_started' ? '#ffaa00' :
                           dd.shotState === 'near_hoop' ? '#00ff88' : '#ff4444';
          els.debugInfo.innerHTML =
            '<b>Frame:</b> ' + dd.frameCount +
            ' &nbsp; <b>State:</b> <span style="color:' + stateColor + '">' + (dd.shotState || 'idle') + '</span>' +
            '<br><b>Balls:</b> ' + (dd.balls ? dd.balls.length : 0) +
            ' &nbsp; <b>Hoops:</b> ' + (dd.hoops ? dd.hoops.length : 0) +
            (dd.balls && dd.balls[0] ? '<br><b>Best ball:</b> ' + (dd.balls[0].score * 100).toFixed(1) + '%' : '') +
            (dd.hoops && dd.hoops[0] ? ' &nbsp; <b>Best hoop:</b> ' + (dd.hoops[0].score * 100).toFixed(1) + '%' : '') +
            (currentBall ? '<br><b>Track:</b> ' + currentBall.source + ' (' + currentBall.normX.toFixed(2) + ', ' + currentBall.normY.toFixed(2) + ')' : '');
        }
      }
    }

    draw();
  }

  /* ── Stop session ───────────────────────────────────────────── */
  function onStopSession() {
    var modal = document.getElementById('st-confirm-modal');
    if (!modal) return;
    modal.classList.add('active');
    document.getElementById('st-confirm-yes').onclick = function () {
      modal.classList.remove('active');
      stopTracking();
      enterSummaryPhase();
    };
    document.getElementById('st-confirm-no').onclick = function () {
      modal.classList.remove('active');
    };
  }

  /* ══════════════════════════════════════════════════════════════
     SUMMARY PHASE
     ══════════════════════════════════════════════════════════════ */
  var _videoReviewData = null; // Stored for replay button

  function enterSummaryPhase() {
    phase = 'summary';

    // Stop video recording and save
    if (typeof VideoReview !== 'undefined') {
      VideoReview.stopRecording().then(function (data) {
        if (data && data.blob) {
          _videoReviewData = data;
          VideoReview.saveClip(sessionId, data.blob, data.shots).catch(function () {});
          // Show replay button
          var replayBtn = document.getElementById('st-video-replay-btn');
          if (replayBtn) replayBtn.style.display = '';
        }
      }).catch(function () {});
    }

    stopCamera();
    els.tracking.classList.remove('active');
    els.summary.classList.add('active');

    var engine = window.ShotDetectionEngine;
    var totalMade     = engine.stats.made;
    var totalAttempts = engine.stats.attempts;
    var accuracy      = totalAttempts > 0 ? Math.round((totalMade / totalAttempts) * 1000) / 10 : 0;
    var durationMs    = Date.now() - sessionStart;
    var durationFmt   = formatDuration(durationMs);

    // XP calculation (per spec: 10 per made, 2 per attempt)
    var xpMade    = totalMade * XP_PER_MADE;
    var xpAttempt = totalAttempts * XP_PER_ATTEMPT;
    var xpTotal   = xpMade + xpAttempt;
    var xpBreakdown = [];
    if (xpMade > 0)    xpBreakdown.push({ reason: totalMade + ' made shots (\u00d710)', amount: xpMade });
    if (xpAttempt > 0) xpBreakdown.push({ reason: totalAttempts + ' attempts (\u00d72)', amount: xpAttempt });

    var summary = {
      sessionId:      sessionId,
      userId:         window.currentUser ? window.currentUser.id : 'anonymous',
      startTime:      new Date(sessionStart).toISOString(),
      durationMs:     durationMs,
      durationFmt:    durationFmt,
      totalMade:      totalMade,
      totalAttempts:  totalAttempts,
      accuracy:       accuracy,
      maxStreak:      maxStreak,
      xpEarned:       xpTotal,
      xpBreakdown:    xpBreakdown,
      shots:          shots
    };

    renderSummary(summary);
  }

  /* ── Zone history integration ─────────────────────────────────── */
  var ZONE_HISTORY_KEY = 'courtiq-zone-history';

  function saveZoneHistory(sessionId, zones) {
    try {
      var raw = localStorage.getItem(ZONE_HISTORY_KEY);
      var history = raw ? JSON.parse(raw) : [];
      var snapshot = {
        date: new Date().toISOString(),
        sessionId: sessionId,
        zones: {}
      };
      var keys = ['paint', 'midrange', 'threePoint', 'freeThrow'];
      for (var k = 0; k < keys.length; k++) {
        var z = zones[keys[k]] || { made: 0, missed: 0 };
        snapshot.zones[keys[k]] = { made: z.made, total: z.made + z.missed };
      }
      history.push(snapshot);
      if (history.length > 100) history = history.slice(-100);
      localStorage.setItem(ZONE_HISTORY_KEY, JSON.stringify(history));
    } catch (e) { /* silent */ }
  }

  function getWeeklyZoneStats() {
    try {
      var raw = localStorage.getItem(ZONE_HISTORY_KEY);
      if (!raw) return null;
      var history = JSON.parse(raw);
      var cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      var filtered = history.filter(function (s) { return new Date(s.date).getTime() >= cutoff; });
      if (filtered.length < 2) return null;

      var agg = { paint: { made: 0, total: 0 }, midrange: { made: 0, total: 0 }, threePoint: { made: 0, total: 0 }, freeThrow: { made: 0, total: 0 } };
      for (var i = 0; i < filtered.length; i++) {
        var zones = filtered[i].zones;
        for (var zone in agg) {
          if (zones[zone]) {
            agg[zone].made += zones[zone].made;
            agg[zone].total += zones[zone].total;
          }
        }
      }
      for (var z in agg) {
        agg[z].pct = agg[z].total > 0 ? Math.round((agg[z].made / agg[z].total) * 1000) / 10 : 0;
      }
      agg._sessions = filtered.length;
      return agg;
    } catch (e) { return null; }
  }

  function generateAlerts(currentZones, weeklyStats) {
    var alerts = [];
    var NAMES = { paint: 'Paint', midrange: 'Mid-Range', threePoint: '3-Point', freeThrow: 'Free Throw' };
    if (!weeklyStats) return alerts;

    for (var zone in currentZones) {
      var name = NAMES[zone] || zone;
      var curr = currentZones[zone];
      var total = curr.made + curr.missed;
      if (total < 3) continue;
      var pct = Math.round((curr.made / total) * 100);
      var weekPct = weeklyStats[zone] ? weeklyStats[zone].pct : 0;

      if (weekPct > 0 && pct - weekPct >= 15) {
        alerts.push('<div class="st-alert-card"><span class="st-alert-text"><span class="st-alert-highlight">' + name + ': ' + pct + '%</span> today vs ' + weekPct + '% weekly avg — great session!</span></div>');
      }
      if (pct === 100 && total >= 3) {
        alerts.push('<div class="st-alert-card"><span class="st-alert-text"><span class="st-alert-highlight">Perfect ' + total + '/' + total + '</span> from ' + name + '!</span></div>');
      }
    }

    // Check for improvements/declines vs previous week
    try {
      var raw = localStorage.getItem(ZONE_HISTORY_KEY);
      var history = raw ? JSON.parse(raw) : [];
      var now = Date.now();
      var prevCutoff = now - 14 * 24 * 60 * 60 * 1000;
      var currCutoff = now - 7 * 24 * 60 * 60 * 1000;
      var prev = history.filter(function (s) { var t = new Date(s.date).getTime(); return t >= prevCutoff && t < currCutoff; });
      if (prev.length >= 2) {
        var prevAgg = {};
        for (var pz in NAMES) {
          prevAgg[pz] = { made: 0, total: 0 };
          for (var pi = 0; pi < prev.length; pi++) {
            if (prev[pi].zones[pz]) {
              prevAgg[pz].made += prev[pi].zones[pz].made;
              prevAgg[pz].total += prev[pi].zones[pz].total;
            }
          }
          prevAgg[pz].pct = prevAgg[pz].total > 0 ? Math.round((prevAgg[pz].made / prevAgg[pz].total) * 1000) / 10 : 0;
        }
        for (var az in NAMES) {
          if (weeklyStats[az] && prevAgg[az] && weeklyStats[az].total > 0 && prevAgg[az].total > 0) {
            var change = Math.round((weeklyStats[az].pct - prevAgg[az].pct) * 10) / 10;
            if (change >= 10) {
              alerts.push('<div class="st-alert-card"><span class="st-alert-text">Your <span class="st-alert-highlight">' + NAMES[az] + '</span> shooting improved by <span class="st-alert-highlight">+' + change + '%</span> this week!</span></div>');
            }
            if (change <= -10) {
              alerts.push('<div class="st-alert-card"><span class="st-alert-text">Your <span class="st-alert-highlight">' + NAMES[az] + '</span> shooting dropped by <span class="st-alert-highlight">' + change + '%</span> this week. Keep practicing!</span></div>');
            }
          }
        }
      }
    } catch (e) { /* silent */ }

    return alerts;
  }

  function renderSummary(summary) {
    var html = [];

    // Header
    html.push(
      '<div class="st-summary-header">',
        '<div class="st-summary-title">Session Complete</div>',
        '<div class="st-summary-duration">' + summary.durationFmt + '</div>',
      '</div>'
    );

    // Big stats
    html.push(
      '<div class="st-big-stats">',
        '<div class="st-big-stat">',
          '<div class="st-big-stat-value" style="color:' + getAccuracyColor(Math.round(summary.accuracy)) + '">' + Math.round(summary.accuracy) + '%</div>',
          '<div class="st-big-stat-label">Accuracy</div>',
        '</div>',
        '<div class="st-big-stat-divider"></div>',
        '<div class="st-big-stat">',
          '<div class="st-big-stat-value">' + summary.totalMade + '</div>',
          '<div class="st-big-stat-label">Made</div>',
        '</div>',
        '<div class="st-big-stat-divider"></div>',
        '<div class="st-big-stat">',
          '<div class="st-big-stat-value">' + summary.totalAttempts + '</div>',
          '<div class="st-big-stat-label">Attempts</div>',
        '</div>',
      '</div>'
    );

    // Save zone history + generate alerts
    var currentZones = categorizeShotsByZone(summary.shots);
    saveZoneHistory(summary.sessionId, currentZones);
    var weeklyStats = getWeeklyZoneStats();
    var smartAlerts = generateAlerts(currentZones, weeklyStats);

    // Smart alerts (if any)
    if (smartAlerts.length > 0) {
      html.push('<div class="st-alert-section">', '<div class="st-section-title">Insights</div>');
      for (var a = 0; a < smartAlerts.length; a++) {
        html.push(smartAlerts[a]);
      }
      html.push('</div>');
    }

    // Shot chart
    html.push(
      '<div class="st-chart-section">',
        '<div class="st-section-title">Shot Chart</div>',
        '<div class="st-chart-wrap">',
          buildShotChartSVG(summary.shots),
          '<div class="st-chart-legend">',
            '<div class="st-legend-item"><div class="st-legend-dot" style="background:#ff4444;"></div>Paint</div>',
            '<div class="st-legend-item"><div class="st-legend-dot" style="background:#ffaa00;"></div>Mid</div>',
            '<div class="st-legend-item"><div class="st-legend-dot" style="background:#4da6ff;"></div>3PT</div>',
            '<div class="st-legend-item"><div class="st-legend-dot" style="background:#ba68c8;"></div>FT</div>',
          '</div>',
        '</div>',
      '</div>'
    );

    // Zone breakdown
    var zones = categorizeShotsByZone(summary.shots);
    var zoneEntries = [
      { key: 'paint', label: 'Paint', color: '#ff4444' },
      { key: 'midrange', label: 'Mid-Range', color: '#ffaa00' },
      { key: 'threePoint', label: '3-Point', color: '#4da6ff' },
      { key: 'freeThrow', label: 'Free Throw', color: '#ba68c8' }
    ];
    var hotZone = '', coldZone = '', bestPct = -1, worstPct = 101;
    html.push('<div class="st-zone-section">', '<div class="st-section-title">Zone Breakdown</div>');
    for (var z = 0; z < zoneEntries.length; z++) {
      var ze = zoneEntries[z];
      var zd = zones[ze.key];
      var total = zd.made + zd.missed;
      var pct = total > 0 ? Math.round((zd.made / total) * 100) : 0;
      var barColor = total > 0 && pct >= 50 ? '#00ff88' : ze.color;
      if (total > 0 && pct > bestPct) { bestPct = pct; hotZone = ze.label; }
      if (total > 0 && pct < worstPct) { worstPct = pct; coldZone = ze.label; }
      html.push(
        '<div class="st-zone-row">',
          '<span class="st-zone-label">' + ze.label + '</span>',
          '<div class="st-zone-bar-bg"><div class="st-zone-bar-fill" style="width:' + (total > 0 ? pct : 0) + '%;background:' + barColor + '"></div></div>',
          '<span class="st-zone-pct">' + (total > 0 ? pct + '%' : '--') + '</span>',
          '<span class="st-zone-count">' + zd.made + '/' + total + '</span>',
        '</div>'
      );
    }
    if (hotZone) {
      html.push('<div class="st-zone-insight">Hot zone: ' + hotZone + ' | Cold zone: ' + coldZone + '</div>');
    }
    html.push('</div>');

    // XP
    html.push(
      '<div class="st-xp-section">',
        '<div class="st-xp-title">XP Earned</div>',
        '<div class="st-xp-total">+' + summary.xpEarned + ' XP</div>'
    );
    for (var i = 0; i < summary.xpBreakdown.length; i++) {
      var item = summary.xpBreakdown[i];
      html.push(
        '<div class="st-xp-row">',
          '<span class="st-xp-reason">' + item.reason + '</span>',
          '<span class="st-xp-amount">+' + item.amount + '</span>',
        '</div>'
      );
    }
    html.push('</div>');

    // AI Learning Stats
    if (window.AdaptiveLearning) {
      var learnStats = window.AdaptiveLearning.getStats();
      html.push(
        '<div class="st-learn-section">',
          '<div class="st-section-title">AI Learning</div>',
          '<div class="st-learn-row">',
            '<span class="st-learn-label">Color calibration</span>',
            '<span class="st-learn-value">' + Math.round(learnStats.color.confidence * 100) + '% (' + learnStats.color.sampleCount + ' samples)</span>',
          '</div>',
          '<div class="st-learn-row">',
            '<span class="st-learn-label">Shot patterns</span>',
            '<span class="st-learn-value">' + (learnStats.trajectory.madeCount + learnStats.trajectory.missCount) + ' learned</span>',
          '</div>',
          '<div class="st-learn-row">',
            '<span class="st-learn-label">Ball recognition</span>',
            '<span class="st-learn-value">' + (learnStats.transfer.isReady ? Math.round(learnStats.transfer.confidence * 100) + '% trained' : learnStats.transfer.positiveSamples + ' samples') + '</span>',
          '</div>',
          '<div class="st-learn-overall">AI Confidence: ' + Math.round(learnStats.overallConfidence * 100) + '%</div>',
        '</div>'
      );
    }

    // Actions
    html.push(
      '<div class="st-actions">',
        '<button class="st-save-btn" id="st-save-btn">Save to CourtIQ</button>',
        '<button class="st-done-btn" id="st-video-replay-btn" style="display:none;background:rgba(245,166,35,0.12);color:#f5a623;border-color:rgba(245,166,35,0.3);" onclick="if(_videoReviewData)VideoReview.openReplay(\'' + (sessionId || '') + '\',_videoReviewData.blob,_videoReviewData.shots);">\uD83C\uDFAC Video Review</button>',
        '<button class="st-done-btn" id="st-done-btn">Done</button>',
      '</div>'
    );

    els.summaryContent.innerHTML = html.join('');

    // Bind action buttons
    var saveBtn = document.getElementById('st-save-btn');
    var doneBtn = document.getElementById('st-done-btn');
    var isSaving = false;

    saveBtn.addEventListener('click', function () {
      if (isSaving) return;
      isSaving = true;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      saveSessionData(summary).then(function (ok) {
        if (ok) {
          saveBtn.textContent = '\u2713 Saved';
          saveBtn.classList.add('saved');
        } else {
          saveBtn.textContent = 'Save Failed \u2014 Retry';
          saveBtn.disabled = false;
          isSaving = false;
        }
      });
    });

    doneBtn.addEventListener('click', function () {
      closeScreen();
    });
  }

  /* ── Save to Supabase ───────────────────────────────────────── */
  // The session row + every shot row land in a single transaction via
  // the save_ai_session_atomic RPC (see supabase/migrations/). On
  // projects that haven't deployed the migration yet, ShotService falls
  // back to a two-write path; both saveSession (ON CONFLICT id) and
  // saveShots (ON CONFLICT session_id, shot_number) are idempotent now,
  // so partial-failure retries no longer duplicate rows.
  async function saveSessionData(summary) {
    try {
      var zones = categorizeShotsByZone(summary.shots);

      var sessionPayload = {
        id:             summary.sessionId,
        user_id:        summary.userId,
        session_date:   summary.startTime,
        session_type:   'ai_tracking',
        duration_ms:    summary.durationMs,
        total_attempts: summary.totalAttempts,
        total_made:     summary.totalMade,
        accuracy:       summary.accuracy,
        max_streak:     summary.maxStreak,
        xp_earned:      summary.xpEarned,
        fg_made:        zones.midrange.made,
        fg_missed:      zones.midrange.missed,
        three_made:     zones.threePoint.made,
        three_missed:   zones.threePoint.missed,
        ft_made:        (zones.paint.made || 0) + (zones.freeThrow.made || 0),
        ft_missed:      (zones.paint.missed || 0) + (zones.freeThrow.missed || 0)
      };

      await window.ShotService.saveSessionAtomic(sessionPayload, summary.shots);

      await window.ShotService.grantXP(
        summary.userId,
        summary.xpEarned,
        'AI Shot Session: ' + summary.totalMade + '/' + summary.totalAttempts
      );

      return true;
    } catch (err) {
      console.error('Save failed:', err);
      return false;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     SHOT CHART SVG (half-court diagram)
     ══════════════════════════════════════════════════════════════ */
  function buildShotChartSVG(shotList) {
    var lines = [];
    lines.push('<svg viewBox="0 0 ' + COURT_W + ' ' + COURT_H + '" xmlns="http://www.w3.org/2000/svg">');

    // Court background
    lines.push('<rect x="0" y="0" width="' + COURT_W + '" height="' + COURT_H + '" rx="8" fill="#1a1a2e"/>');

    // Court lines
    lines.push('<g stroke="rgba(255,255,255,0.15)" stroke-width="1.5" fill="none">');
    // Boundary
    lines.push('<rect x="5" y="5" width="' + (COURT_W - 10) + '" height="' + (COURT_H - 10) + '" rx="4"/>');
    // Three-point arc
    lines.push('<path d="M 30 0 L 30 ' + (RIM_SVG_Y + 80) + ' A ' + THREE_PT_R + ' ' + THREE_PT_R + ' 0 0 0 ' + (COURT_W - 30) + ' ' + (RIM_SVG_Y + 80) + ' L ' + (COURT_W - 30) + ' 0"/>');
    // Paint
    lines.push('<path d="M ' + (RIM_SVG_X - 60) + ' 0 L ' + (RIM_SVG_X - 60) + ' ' + (RIM_SVG_Y + 150) + ' L ' + (RIM_SVG_X + 60) + ' ' + (RIM_SVG_Y + 150) + ' L ' + (RIM_SVG_X + 60) + ' 0"/>');
    // FT circle
    lines.push('<circle cx="' + RIM_SVG_X + '" cy="' + (RIM_SVG_Y + 150) + '" r="60"/>');
    // Backboard
    lines.push('<path d="M ' + (RIM_SVG_X - 30) + ' ' + (RIM_SVG_Y - 10) + ' L ' + (RIM_SVG_X + 30) + ' ' + (RIM_SVG_Y - 10) + '" stroke-width="3"/>');
    lines.push('</g>');

    // Rim
    lines.push('<circle cx="' + RIM_SVG_X + '" cy="' + RIM_SVG_Y + '" r="12" stroke="#f5a623" stroke-width="2" fill="rgba(245,166,35,0.2)"/>');

    // Zone color mapping
    var zoneColorMap = {
      paint: '#ff4444',
      midrange: '#ffaa00',
      threePoint: '#4da6ff',
      freeThrow: '#ba68c8'
    };

    // Shot dots — use launch point for positioning (where player shot from)
    // Misses first (semi-transparent, zone-colored)
    for (var i = 0; i < shotList.length; i++) {
      var s = shotList[i];
      var posX = s.launch_x !== undefined ? s.launch_x : s.shot_x;
      var posY = s.launch_y !== undefined ? s.launch_y : s.shot_y;
      var cx = 50 + posX * (COURT_W - 100);
      var cy = RIM_SVG_Y + (1 - posY) * (COURT_H - RIM_SVG_Y - 40);
      var isMade = s.shot_result === 'made';
      var dotColor = zoneColorMap[s.shot_zone] || '#ffaa00';
      if (!isMade) {
        lines.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="5" fill="' + dotColor + '" opacity="0.4" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>');
      }
    }
    // Made on top (brighter, zone-colored with white stroke)
    for (var j = 0; j < shotList.length; j++) {
      var s2 = shotList[j];
      var posX2 = s2.launch_x !== undefined ? s2.launch_x : s2.shot_x;
      var posY2 = s2.launch_y !== undefined ? s2.launch_y : s2.shot_y;
      var cx2 = 50 + posX2 * (COURT_W - 100);
      var cy2 = RIM_SVG_Y + (1 - posY2) * (COURT_H - RIM_SVG_Y - 40);
      var dotColor2 = zoneColorMap[s2.shot_zone] || '#ffaa00';
      if (s2.shot_result === 'made') {
        lines.push('<circle cx="' + cx2.toFixed(1) + '" cy="' + cy2.toFixed(1) + '" r="6" fill="' + dotColor2 + '" opacity="0.9" stroke="#fff" stroke-width="1"/>');
      }
    }

    lines.push('</svg>');
    return lines.join('');
  }

  /* ══════════════════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════════════════ */
  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function formatDuration(ms) {
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return min > 0 ? min + 'm ' + sec + 's' : sec + 's';
  }

  function getAccuracyColor(pct) {
    if (pct >= 65) return '#00ff88';
    if (pct >= 50) return '#ffaa00';
    return '#ff4444';
  }

  function categorizeShotsByZone(shotList) {
    var zones = {
      paint:      { made: 0, missed: 0 },
      midrange:   { made: 0, missed: 0 },
      threePoint: { made: 0, missed: 0 },
      freeThrow:  { made: 0, missed: 0 }
    };
    for (var i = 0; i < shotList.length; i++) {
      var s = shotList[i];
      var zone = s.shot_zone || 'midrange';
      if (!zones[zone]) zone = 'midrange';
      if (s.shot_result === 'made') zones[zone].made++;
      else zones[zone].missed++;
    }
    return zones;
  }

  /* ══════════════════════════════════════════════════════════════
     VIDEO UPLOAD ENTRY POINT
     ══════════════════════════════════════════════════════════════ */
  /**
   * Open the shot tracker using a local video file instead of the live camera.
   * The detection engine processes frames just like live camera mode.
   * The session auto-advances to Summary when the video finishes playing.
   *
   * @param {File} file  A video File object from an <input type="file"> element.
   */
  function openFromFile(file) {
    if (!file) {
      alert('Please select a video file.');
      return;
    }
    // Accept any file — let the browser decide if it can play it
    console.log('Opening video file:', file.name, file.type, (file.size / 1048576).toFixed(1) + ' MB');

    // Revoke any previous object URL to free memory
    if (videoFileUrl) {
      URL.revokeObjectURL(videoFileUrl);
      videoFileUrl = null;
    }
    videoFileUrl = URL.createObjectURL(file);
    console.log('Blob URL created:', videoFileUrl);
    openScreen();
  }

  /* ══════════════════════════════════════════════════════════════
     EXPOSE GLOBALLY
     ══════════════════════════════════════════════════════════════ */
  window.ShotTrackingScreen = {
    open:         openScreen,
    close:        closeScreen,
    openFromFile: openFromFile
  };

})();
