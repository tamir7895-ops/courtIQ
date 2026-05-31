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
  var rimLockedAt = 0;        // Date.now() when rim first locked — drives the pulse animation

  // Auto rim-tracking state (reset each session in openScreen)
  var rimAutoMode         = true;   // false once user manually taps
  var rimStabilizationT   = null;   // setTimeout handle
  var lastHoopDetectAt    = 0;      // timestamp of last accepted hoop detection
  var lastHoopConfidence  = 0;
  var hoopLost            = false;
  var manualFallbackShown = false;  // legacy: only true if we promoted saved calibration to locked
  var hasSavedCalibration = false;  // true when openScreen warm-started from localStorage
  var savedFallbackUsed   = false;  // true when watchdog auto-promoted saved calibration to locked
  var lockToastT          = null;   // setTimeout for "Hoop locked!" toast → "Tracking" transition

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

  // Debug overlay state.
  // Currently ALWAYS-ON during development — the user wants to see the
  // pose skeleton, ball/hoop/player boxes, trajectory + crossing point
  // while tuning the model. Once accuracy is dialed in we flip this
  // back to `false` so end users get a clean view. The 🐛 toggle still
  // works as an override mid-session.
  var debugMode = true;
  var debugData = { balls: [], hoops: [], shotState: 'idle', frameCount: 0 };
  // L9.3: latest shot banner — fades out after 3s. Holds the actual dist/thresh
  // values so the user can see WHY a shot was classified made/missed.
  var lastShotBanner = null;

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
    // Reflect the initial debugMode in the toggle UI (always-on by default
    // during the tuning phase — see debugMode declaration).
    els.debugToggle.classList.toggle('active', debugMode);
    els.debugPanel.classList.toggle('active', debugMode);
    // Keep canvas aligned with the displayed video on browser resize,
    // device rotation, or app entering/leaving fullscreen. resizeCanvas
    // is cheap (a few math ops + a couple style writes) so debouncing
    // is unnecessary at typical resize cadence.
    window.addEventListener('resize', function () {
      if (phase === 'tracking' || phase === 'rimlock' || phase === 'threept') {
        resizeCanvas();
      }
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
    rimLockedAt = 0;
    rimSize = { w: DEFAULT_RIM_W, h: DEFAULT_RIM_H };
    threePtPoint = null;
    threePtDistance = 0;

    // Reset auto rim-tracking state
    rimAutoMode = true;
    if (rimStabilizationT) { clearTimeout(rimStabilizationT); rimStabilizationT = null; }
    if (lockToastT) { clearTimeout(lockToastT); lockToastT = null; }
    lastHoopDetectAt = 0;
    lastHoopConfidence = 0;
    hoopLost = false;
    manualFallbackShown = false;
    hasSavedCalibration = false;
    savedFallbackUsed   = false;

    // ── Warm-start from saved calibration ───────────────────────
    // If the user has shot here before, we have a localStorage record of
    // where the rim was. Pre-populate rimCenter/rimSize so we have an
    // initial guess to draw the rim ring with. We DON'T set rimLocked
    // yet — YOLOX still gets to confirm or correct the position over
    // the next few seconds. If YOLOX fails (lighting / different angle),
    // the watchdog promotes the saved values to "locked" after the
    // fallback window so the user never has to tap anything.
    var saved = loadCalibration();
    if (saved && saved.rimCenter && saved.rimSize) {
      rimCenter = { x: saved.rimCenter.x, y: saved.rimCenter.y };
      rimSize   = { w: saved.rimSize.w,   h: saved.rimSize.h   };
      threePtPoint    = saved.threePtPoint || null;
      threePtDistance = saved.threePtDistance || 0;
      hasSavedCalibration = true;
    }

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
      // Internal drawing buffer == displayed video area (1:1 pixel
      // mapping, no scaling distortion). Inline width/height/left/top
      // ALSO set the CSS display size so the overlay sits exactly on
      // the visible video. Without inline width/height the canvas would
      // either fall back to 300×150 default or get stretched by a CSS
      // 100% rule, shifting every pose / ball / hoop draw.
      var dW = Math.round(displayW);
      var dH = Math.round(displayH);
      canvasEl.width  = dW;
      canvasEl.height = dH;
      canvasEl.style.position = 'absolute';
      canvasEl.style.left   = Math.round(offsetX) + 'px';
      canvasEl.style.top    = Math.round(offsetY) + 'px';
      canvasEl.style.width  = dW + 'px';
      canvasEl.style.height = dH + 'px';
    } else {
      canvasEl.width = containerW || vidW;
      canvasEl.height = containerH || vidH;
      canvasEl.style.width  = canvasEl.width + 'px';
      canvasEl.style.height = canvasEl.height + 'px';
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
      rimLockedAt = Date.now();
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
    // If we warm-started from localStorage, show a subtly different message
    // so the user knows the rim ring on screen is a guess pending verification.
    if (hasSavedCalibration) {
      setAutoStatus('Verifying rim position...', 'searching');
    } else {
      setAutoStatus('Looking for hoop...', 'searching');
    }

    // Start timer
    timerInterval = setInterval(function () {
      elapsedSec++;
      els.timer.textContent = formatTime(elapsedSec);
    }, 1000);

    // L13: For file upload mode — HOLD the video paused until the model
    // is loaded. Previously the video began playing immediately while the
    // YOLOX ONNX model was still loading (1-3 seconds). Any shots in those
    // opening seconds were silently dropped because the engine wasn't yet
    // detecting. We now pause + rewind here, then the Promise.all callback
    // below calls play() once both the model and the video buffer are
    // ready.
    if (videoFileUrl && videoEl) {
      resizeCanvas();
      try { videoEl.pause(); } catch (e) {}
      try { videoEl.currentTime = 0; } catch (e) {}
      setAutoStatus('Loading detection model…', 'searching');
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

    // The detected hoop bbox: with the v71 2-class model the hoop
    // annotations frequently covered the full backboard, so a 0.25
    // offset was needed to pull the estimated rim Y down to the
    // bottom quarter. The v6_polished 3-class model was trained on
    // cleaned annotations where huge "hoop"-tagged backboards were
    // dropped (Phase G), so the bbox is much closer to the actual rim
    // ring. A real-device test (outdoor screen recording) showed the
    // 0.25 offset pushed the rim Y noticeably below the visible ring,
    // and a clear made shot scored MISS because the trajectory
    // crossing fired below the actual rim. 0.10 keeps a small downward
    // bias (so we never lock ABOVE the rim) without overshooting.
    //
    // L11: Aspect-ratio-aware offset. Different setups produce different
    // YOLOX bboxes:
    //   • Outdoor rim with no backboard visible → bbox tight on the orange
    //     ring, aspect ratio 3.5+ (wide-flat). Offset 0.10 lands ON the rim.
    //   • Indoor gym with backboard included → bbox covers backboard+ring,
    //     aspect ratio 1.5-2 (squarer). Offset 0.10 lands ABOVE the rim
    //     (in the middle of the backboard) — user-visible bug: makes get
    //     classified as miss because the trajectory crosses a phantom rim
    //     line above the real one.
    // Linear interpolation between aspect 1.5 (offset 0.40) and 3.5 (offset
    // 0.10). Clamped at both ends.
    function computeRimOffsetFrac(bw, bh) {
      var aspect = bw / Math.max(0.001, bh);
      if (aspect >= 3.5) return 0.10;
      if (aspect <= 1.5) return 0.40;
      return 0.40 - (aspect - 1.5) * 0.15;
    }
    // Kept for the warm-start path below (saved-calibration restore) which
    // doesn't have the live bbox dimensions. Effectively a fallback.
    var BBOX_RIM_OFFSET_FRAC = 0.10;

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
      // we EMA on every accepted detection for smooth tracking. Buffer
      // is enlarged so the clustering pass has more data to work with.
      if (!rimLocked) {
        hoopBuffer.push({ cx: hoop.cx, cy: hoop.cy, bw: hoop.bw, bh: hoop.bh, score: hoop.score, colorRefined: !!hoop.colorRefined });
        if (hoopBuffer.length > HOOP_BUFFER_SIZE) hoopBuffer.shift();
        if (hoopBuffer.length < 3) return;

        // ── Cluster detections ────────────────────────────────────
        // v2 (and many real courts) have TWO hoops in the frame; YOLOX
        // detects both. Averaging straight across the buffer lands the
        // lock between them, on a position where no hoop actually is.
        // Instead we group detections by spatial proximity (cluster
        // radius 0.08 — same magnitude as the legacy spread tolerance)
        // and lock on the LARGEST cluster's centroid. Ties are broken
        // by preferring the HIGHER hoop (smaller cy = closer to the
        // top of the frame), since shooting hoops are mounted high.
        var CLUSTER_RADIUS = 0.08;
        var clusters = [];
        for (var bi = 0; bi < hoopBuffer.length; bi++) {
          var det = hoopBuffer[bi];
          var assigned = false;
          for (var ci = 0; ci < clusters.length; ci++) {
            var cMean = clusters[ci].mean;
            if (Math.abs(det.cx - cMean.cx) + Math.abs(det.cy - cMean.cy) <= CLUSTER_RADIUS) {
              clusters[ci].items.push(det);
              // Recompute running mean for this cluster
              var sCX = 0, sCY = 0;
              for (var mi = 0; mi < clusters[ci].items.length; mi++) {
                sCX += clusters[ci].items[mi].cx;
                sCY += clusters[ci].items[mi].cy;
              }
              clusters[ci].mean = { cx: sCX / clusters[ci].items.length, cy: sCY / clusters[ci].items.length };
              assigned = true;
              break;
            }
          }
          if (!assigned) {
            clusters.push({ mean: { cx: det.cx, cy: det.cy }, items: [det] });
          }
        }
        // Pick the largest cluster; on ties, prefer the higher hoop.
        clusters.sort(function (a, b) {
          if (b.items.length !== a.items.length) return b.items.length - a.items.length;
          return a.mean.cy - b.mean.cy; // smaller cy wins
        });
        var winner = clusters[0];
        if (winner.items.length < 3) return;  // need at least 3 detections of THIS hoop

        var avgCX = 0, avgCY = 0, avgBW = 0, avgBH = 0;
        for (var wi = 0; wi < winner.items.length; wi++) {
          avgCX += winner.items[wi].cx;
          avgCY += winner.items[wi].cy;
          avgBW += winner.items[wi].bw;
          avgBH += winner.items[wi].bh;
        }
        avgCX /= winner.items.length;
        avgCY /= winner.items.length;
        avgBW /= winner.items.length;
        avgBH /= winner.items.length;

        // Tight spread check within the winning cluster — if the cluster
        // itself is wobbly (low confidence detections drifting), wait.
        var maxSpread = 0;
        for (var hj = 0; hj < winner.items.length; hj++) {
          var spread = Math.abs(winner.items[hj].cx - avgCX) + Math.abs(winner.items[hj].cy - avgCY);
          if (spread > maxSpread) maxSpread = spread;
        }
        if (maxSpread > 0.06) return;

        // First lock — commit and arm the stabilization timer.
        // L11: use aspect-aware offset (see computeRimOffsetFrac above).
        // L11.2: when the engine reports colorRefined=true the cy is already
        // snapped to the orange-ring band — applying the offset again would
        // push it BELOW the real rim. Skip offset entirely for color-refined
        // detections. We treat the buffer's MAJORITY as the trustworthy
        // signal: if most samples were color-refined, trust the average cy
        // directly.
        var colorRefinedCount = 0;
        for (var hRi = 0; hRi < winner.items.length; hRi++) {
          if (winner.items[hRi].colorRefined) colorRefinedCount++;
        }
        var mostColorRefined = colorRefinedCount * 2 >= winner.items.length;
        var lockOffsetFrac = mostColorRefined ? 0 : computeRimOffsetFrac(avgBW, avgBH);
        var anchoredCY = avgCY + avgBH * lockOffsetFrac;
        rimCenter = { x: avgCX, y: anchoredCY };
        rimSize = {
          w: Math.min(Math.max(avgBW, 0.08), 0.25),
          h: Math.min(Math.max(avgBH, 0.03), 0.15)
        };
        rimLocked = true;
        rimLockedAt = Date.now();
        // If watchdog already used a saved-calibration fallback, cancel the
        // status text and use the YOLOX-locked one instead.
        savedFallbackUsed = true;
        engine.setRimZone(rimCenter.x, rimCenter.y, rimSize.w, rimSize.h);
        onDetectionStatus('detecting');
        setAutoStatus('Hoop locked!', 'found');
        // Don't count shots until the EMA has had time to settle.
        if (rimStabilizationT) clearTimeout(rimStabilizationT);
        rimStabilizationT = setTimeout(function () {
          if (rimLocked && rimAutoMode && !hoopLost) {
            engine.setRimStabilized(true);
            setAutoStatus('Tracking', 'tracking');
          }
        }, RIM_STABILIZATION_MS);

        // Persist for warm-start on the next session. We save just the
        // rim — 3PT is set separately by enterThreePtCalibration (skipped
        // in auto-detect flow) so we leave any existing 3PT entry alone.
        saveCalibration();

        console.log('[ShotTracker] Auto-lock at (' + rimCenter.x.toFixed(3) + ',' + rimCenter.y.toFixed(3) +
          ') [bbox cy=' + avgCY.toFixed(3) + ', offset=' + lockOffsetFrac.toFixed(2) +
          ' (aspect=' + (avgBW / Math.max(0.001, avgBH)).toFixed(2) + ')' +
          ', shift=+' + (avgBH * lockOffsetFrac).toFixed(3) +
          '] from ' + hoopBuffer.length + ' detections');
        return;
      }

      // Already locked + auto mode: continuous EMA on every detection.
      // FREEZE during active shot states — the ball can occlude the rim,
      // shifting the bbox; updating mid-flight would skew the near_hoop
      // zone the state machine is using to judge make/miss.
      var st = engine._shotState;
      if (st === 'shot_started' || st === 'near_hoop') return;

      // L11: live EMA also uses aspect-aware offset, so per-frame bbox
      // shape changes (e.g. ball briefly inside the rim) tighten/loosen
      // the anchor toward the real ring. L11.2: skip offset when the
      // engine already snapped cy to the orange ring.
      var emaOffsetFrac = hoop.colorRefined ? 0 : computeRimOffsetFrac(hoop.bw, hoop.bh);
      var anchoredCYNew = hoop.cy + hoop.bh * emaOffsetFrac;
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

        // L13: Now that the model is loaded, start the video playback.
        // For file uploads we held the element paused above so no frame is
        // wasted before detection is ready. For live camera there is no
        // play() needed — the MediaStream is already live.
        if (videoFileUrl && videoEl) {
          var doFilePlay = function () {
            try { videoEl.currentTime = 0; } catch (e) {}
            videoEl.play().then(function () {
              resizeCanvas();
            }).catch(function (err) {
              console.warn('[ShotTracker] Video play failed:', err.message);
            });
          };
          if (videoEl.readyState >= 2) {
            doFilePlay();
          } else {
            videoEl.addEventListener('canplay', function onReady() {
              videoEl.removeEventListener('canplay', onReady);
              doFilePlay();
            });
          }
        }

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
    // L9.3: capture the made/miss decision for the on-screen banner. Reads
    // _lastCrossing off the engine — it has the actual dist/thresh values
    // that drove the decision.
    var engRefBanner = window.ShotDetectionEngine;
    var lc = engRefBanner && engRefBanner._lastCrossing ? engRefBanner._lastCrossing : null;
    if (lc) {
      lastShotBanner = {
        result:   data.result,
        dist:     lc.distFromRim,
        thresh:   lc.madeThresh,
        ratio:    lc.distFromRim / (lc.madeThresh || 1),
        t:        Date.now()
      };
    } else {
      lastShotBanner = { result: data.result, dist: null, thresh: null, ratio: null, t: Date.now() };
    }

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
      // Auto-fallback — YOLOX hasn't locked the rim within the window.
      // Two paths:
      //   A. We have a saved calibration → promote it to "locked" silently.
      //      The dashed rim ring is already on screen from the warm-start.
      //   B. No saved calibration → nudge the status text only. The user
      //      never sees a "tap the rim" UI; the tracker keeps searching.
      if (!rimLocked && !savedFallbackUsed && sessionStart > 0 &&
          (nowTs - sessionStart > MANUAL_FALLBACK_MS)) {
        savedFallbackUsed = true;
        if (hasSavedCalibration && rimCenter && engRef) {
          rimLocked = true;
          rimLockedAt = Date.now();
          engRef.setRimZone(rimCenter.x, rimCenter.y, rimSize.w, rimSize.h);
          setAutoStatus('Using saved rim position', 'found');
          if (rimStabilizationT) clearTimeout(rimStabilizationT);
          rimStabilizationT = setTimeout(function () {
            if (rimLocked && rimAutoMode && !hoopLost) {
              engRef.setRimStabilized(true);
              setAutoStatus('Tracking', 'tracking');
            }
          }, RIM_STABILIZATION_MS);
          console.log('[ShotTracker] Auto-fallback to saved calibration');
        } else {
          setAutoStatus('Point camera at the hoop', 'searching');
        }
      }

      var cw = canvasEl.width;
      var ch = canvasEl.height;
      if (cw === 0 || ch === 0) { resizeCanvas(); return; }

      canvasCtx.clearRect(0, 0, cw, ch);

      // Draw rim zone indicator (dashed ring)
      // States:
      //   - rimLocked false: dashed grey ring (warm-start / searching)
      //   - just locked (< 1.5s ago): green ring with expanding pulse halo
      //   - locked steady: dashed orange ring
      if (rimCenter) {
        var rx = rimSize.w * cw / 2;
        var ry = rimSize.h * ch / 2;
        var rcx = rimCenter.x * cw;
        var rcy = rimCenter.y * ch;
        canvasCtx.save();

        // Determine ring color/state
        var sinceLock = rimLocked ? (nowTs - rimLockedAt) : -1;
        var inPulse = rimLocked && sinceLock < 1500;

        if (!rimLocked) {
          // Warm-start preview — faded grey ring
          canvasCtx.strokeStyle = 'rgba(160,160,160,0.45)';
          canvasCtx.lineWidth = 2;
          canvasCtx.setLineDash([6, 8]);
        } else if (inPulse) {
          // Lock-on flash — bright green ring
          canvasCtx.strokeStyle = 'rgba(0,255,136,0.9)';
          canvasCtx.lineWidth = 3;
          canvasCtx.setLineDash([]);
        } else {
          // Steady tracking — orange dashed
          canvasCtx.strokeStyle = 'rgba(245,166,35,0.5)';
          canvasCtx.lineWidth = 2;
          canvasCtx.setLineDash([8, 6]);
        }

        canvasCtx.beginPath();
        canvasCtx.ellipse(rcx, rcy, rx, ry, 0, 0, Math.PI * 2);
        canvasCtx.stroke();

        // Light fill (skip when in pulse — the halo provides the wash)
        if (!inPulse) {
          canvasCtx.fillStyle = rimLocked
            ? 'rgba(245,166,35,0.06)'
            : 'rgba(160,160,160,0.04)';
          canvasCtx.fill();
        }

        // Expanding halo for the first 1.5s after lock — gives the user
        // a clear visual confirmation that auto-detect committed.
        if (inPulse) {
          var t = sinceLock / 1500;            // 0 → 1
          var ease = 1 - Math.pow(1 - t, 3);   // ease-out cubic
          var haloRx = rx * (1 + ease * 0.8);
          var haloRy = ry * (1 + ease * 0.8);
          canvasCtx.strokeStyle = 'rgba(0,255,136,' + (0.6 * (1 - t)).toFixed(3) + ')';
          canvasCtx.lineWidth = 2;
          canvasCtx.setLineDash([]);
          canvasCtx.beginPath();
          canvasCtx.ellipse(rcx, rcy, haloRx, haloRy, 0, 0, Math.PI * 2);
          canvasCtx.stroke();
        }

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

        // Draw hoop detections — BLUE bbox = what the model returned.
        // The engine emits ALL post-NMS hoop candidates above the 10%
        // confidence floor, which can be 20+ overlapping boxes on a noisy
        // frame. The state machine only ever uses hoops[0] (highest score),
        // so the overlay only renders the TOP-3 — anything else is visual
        // noise that obscures the actual best candidate.
        if (dd.hoops && dd.hoops.length) {
          var hoopsTop = dd.hoops.slice().sort(function(a,b){ return b.score - a.score; }).slice(0, 3);
          for (var hi = 0; hi < hoopsTop.length; hi++) {
            var h = hoopsTop[hi];
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

          // L9.3: BIG rim-center X marker + made-threshold bracket so the user
          // can see exactly where the algorithm thinks the rim center is and
          // how wide the "made" zone is. Without this, off-center rim auto-
          // lock looks identical to a real miss.
          var madeThresh = rimDW * 1.0; // displayed as 2.0×rimHalfW = 1.0×rimDW
          canvasCtx.save();
          canvasCtx.strokeStyle = '#00ff88';
          canvasCtx.lineWidth = 3;
          // Crosshair at rim center
          canvasCtx.beginPath();
          canvasCtx.moveTo(rimDX - 14, rimDY - 14);
          canvasCtx.lineTo(rimDX + 14, rimDY + 14);
          canvasCtx.moveTo(rimDX + 14, rimDY - 14);
          canvasCtx.lineTo(rimDX - 14, rimDY + 14);
          canvasCtx.stroke();
          // Made-threshold bracket — vertical lines at ±madeThresh
          canvasCtx.strokeStyle = 'rgba(0,255,136,0.6)';
          canvasCtx.lineWidth = 2;
          canvasCtx.setLineDash([3, 3]);
          canvasCtx.beginPath();
          canvasCtx.moveTo(rimDX - madeThresh, rimDY - 30);
          canvasCtx.lineTo(rimDX - madeThresh, rimDY + 30);
          canvasCtx.moveTo(rimDX + madeThresh, rimDY - 30);
          canvasCtx.lineTo(rimDX + madeThresh, rimDY + 30);
          canvasCtx.stroke();
          canvasCtx.setLineDash([]);
          canvasCtx.fillStyle = '#00ff88';
          canvasCtx.font = 'bold 10px monospace';
          canvasCtx.fillText('MADE ZONE', rimDX - madeThresh, rimDY - 34);
          canvasCtx.restore();

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

        // ── Pose skeleton overlay ──────────────────────────────
        // Visualises the 33-point pose landmarks the shooting-motion
        // detector is consuming. Pose coords are normalised to the
        // FULL video frame (same space as the rim line), so we use
        // the cw/ch mapping — no crop transform needed.
        //
        // QUALITY GATE: MediaPipe Pose Lite returns 33 landmarks even
        // when no real person is in the frame — it "hallucinates" a
        // person-shaped skeleton on whatever structural pattern looks
        // most human-like (metal beams, ball cart, etc.). The user saw
        // this on the dashboard: skeleton drawn on empty warehouse, far
        // from the actual shooter. We require a minimum number of
        // upper-body landmarks (shoulders/hips/elbows/wrists/nose) with
        // visibility ≥ 0.5 before drawing OR feeding the heuristic.
        // Low-quality frames get a small "[low pose]" indicator instead.
        if (window.PoseDetector && window.PoseDetector.isReady() && videoEl) {
          var poseFrame = window.PoseDetector.detect(videoEl, videoEl.currentTime);
          if (poseFrame && poseFrame.landmarks) {
            var lms = poseFrame.landmarks;
            var pdx = function (i) { return lms[i] ? lms[i].x * cw : 0; };
            var pdy = function (i) { return lms[i] ? lms[i].y * ch : 0; };
            var pvis = function (i) { return lms[i] ? (lms[i].visibility || 0) : 0; };

            // Pose quality — mirrors the engine's narrow gate in
            // _pollPoseShot: require nose + at least one complete arm
            // chain (shoulder→elbow→wrist) at vis ≥ 0.5. This catches
            // partially-framed shooters (e.g. lower body cropped) while
            // still rejecting hallucinated skeletons on empty frames.
            // The full 11-joint count is still computed for the label so
            // the user can see roughly how confident the model is.
            var KEY_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26];
            var goodJoints = 0;
            var avgVis = 0;
            for (var qi = 0; qi < KEY_JOINTS.length; qi++) {
              var v = pvis(KEY_JOINTS[qi]);
              avgVis += v;
              if (v >= 0.5) goodJoints++;
            }
            avgVis = avgVis / KEY_JOINTS.length;
            var noseOk = pvis(0) >= 0.5;
            var leftArmOk  = pvis(11) >= 0.5 && pvis(13) >= 0.5 && pvis(15) >= 0.5;
            var rightArmOk = pvis(12) >= 0.5 && pvis(14) >= 0.5 && pvis(16) >= 0.5;
            var poseGood = noseOk && (leftArmOk || rightArmOk);

            if (poseGood) {
              // MediaPipe Pose connection pairs (upper body + legs)
              var bones = [
                [11,12],[11,13],[13,15],[12,14],[14,16],     // arms + shoulders
                [11,23],[12,24],[23,24],                      // torso
                [23,25],[24,26],[25,27],[26,28],              // legs
                [27,29],[27,31],[28,30],[28,32]              // feet
              ];

              canvasCtx.save();
              canvasCtx.strokeStyle = 'rgba(0,229,255,0.8)';
              canvasCtx.lineWidth   = 2;
              for (var biSke = 0; biSke < bones.length; biSke++) {
                var a = bones[biSke][0], b = bones[biSke][1];
                if (pvis(a) > 0.3 && pvis(b) > 0.3) {
                  canvasCtx.beginPath();
                  canvasCtx.moveTo(pdx(a), pdy(a));
                  canvasCtx.lineTo(pdx(b), pdy(b));
                  canvasCtx.stroke();
                }
              }
              // All visible joints as pink dots
              canvasCtx.fillStyle = '#ec4899';
              for (var ki = 0; ki < lms.length; ki++) {
                if (pvis(ki) > 0.3) {
                  canvasCtx.beginPath();
                  canvasCtx.arc(pdx(ki), pdy(ki), 3, 0, Math.PI * 2);
                  canvasCtx.fill();
                }
              }
              // Highlight WRISTS (shooting-hand detector inputs) larger
              canvasCtx.fillStyle = '#fbbf24';
              [15, 16].forEach(function (idx) {
                if (pvis(idx) > 0.3) {
                  canvasCtx.beginPath();
                  canvasCtx.arc(pdx(idx), pdy(idx), 6, 0, Math.PI * 2);
                  canvasCtx.fill();
                }
              });
              // Pose quality label near nose (or upper-center if nose hidden)
              var labelX, labelY;
              if (pvis(0) > 0.3) {
                labelX = pdx(0);
                labelY = pdy(0) - 14;
              } else {
                // Fall back to midpoint of shoulders
                labelX = (pdx(11) + pdx(12)) / 2;
                labelY = (pdy(11) + pdy(12)) / 2 - 30;
              }
              var poseLbl = 'POSE ' + goodJoints + '/' + KEY_JOINTS.length +
                ' avgVis=' + (avgVis * 100).toFixed(0) + '%';
              canvasCtx.font = 'bold 11px monospace';
              var plW = canvasCtx.measureText(poseLbl).width + 8;
              canvasCtx.fillStyle = 'rgba(0,0,0,0.7)';
              canvasCtx.fillRect(labelX - plW / 2, labelY - 14, plW, 16);
              canvasCtx.fillStyle = '#00e5ff';
              canvasCtx.fillText(poseLbl, labelX - plW / 2 + 4, labelY - 2);
              canvasCtx.restore();
            } else {
              // Low-quality pose — draw a small indicator at top-left of canvas
              // so the user knows the detector is rejecting hallucinated poses.
              canvasCtx.save();
              canvasCtx.font = 'bold 11px monospace';
              var lqLbl = 'pose: ' + goodJoints + '/' + KEY_JOINTS.length + ' good (rejected)';
              var lqW = canvasCtx.measureText(lqLbl).width + 8;
              canvasCtx.fillStyle = 'rgba(0,0,0,0.7)';
              canvasCtx.fillRect(8, 38, lqW, 16);
              canvasCtx.fillStyle = '#9ca3af';
              canvasCtx.fillText(lqLbl, 12, 50);
              canvasCtx.restore();
            }
          }
        }

        // Draw ball detections (green boxes).
        // The engine uses a 5% confidence floor (BALL_CONFIDENCE=0.05) and
        // post-NMS still emits dozens-to-hundreds of low-score candidates
        // per frame. Drawing all of them floods the display with overlapping
        // 25-29% noise boxes and obscures the actual signal. The state machine
        // only uses balls[0] (best after NMS), so the overlay renders just
        // the TOP-5 and only those with score ≥ 30% — enough to see what the
        // model is considering without burying the frame.
        if (dd.balls && dd.balls.length) {
          var BALL_OVERLAY_MIN = 0.30;
          var BALL_OVERLAY_TOPN = 5;
          var ballsTop = dd.balls
            .filter(function(b){ return b.score >= BALL_OVERLAY_MIN; })
            .sort(function(a,b){ return b.score - a.score; })
            .slice(0, BALL_OVERLAY_TOPN);
          for (var bi = 0; bi < ballsTop.length; bi++) {
            var b = ballsTop[bi];
            var bx2 = toDispX(b.cx);
            var by2 = toDispY(b.cy);
            var bw2 = toDispW(b.bw);
            var bh2 = toDispH(b.bh);
            canvasCtx.save();
            // Highlight the best candidate (#0) with thicker stroke
            canvasCtx.strokeStyle = '#00ff88';
            canvasCtx.lineWidth = bi === 0 ? 3 : 2;
            canvasCtx.strokeRect(bx2 - bw2/2, by2 - bh2/2, bw2, bh2);
            canvasCtx.fillStyle = bi === 0 ? 'rgba(0,255,136,0.18)' : 'rgba(0,255,136,0.08)';
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

        // Draw player detections (cyan boxes) — only added for the 3-class
        // v6_polished model. Cap to top-3 so even crowded NBA-style frames
        // don't get cluttered.
        if (dd.players && dd.players.length) {
          var PLAYER_OVERLAY_MIN = 0.35;
          var PLAYER_OVERLAY_TOPN = 3;
          var playersTop = dd.players
            .filter(function(p){ return p.score >= PLAYER_OVERLAY_MIN; })
            .sort(function(a,b){ return b.score - a.score; })
            .slice(0, PLAYER_OVERLAY_TOPN);
          for (var pi = 0; pi < playersTop.length; pi++) {
            var pp = playersTop[pi];
            var ppx = toDispX(pp.cx);
            var ppy = toDispY(pp.cy);
            var ppw = toDispW(pp.bw);
            var pph = toDispH(pp.bh);
            canvasCtx.save();
            canvasCtx.strokeStyle = '#00e5ff';
            canvasCtx.lineWidth = pi === 0 ? 3 : 2;
            canvasCtx.strokeRect(ppx - ppw/2, ppy - pph/2, ppw, pph);
            canvasCtx.fillStyle = pi === 0 ? 'rgba(0,229,255,0.12)' : 'rgba(0,229,255,0.06)';
            canvasCtx.fillRect(ppx - ppw/2, ppy - pph/2, ppw, pph);
            var pLabel = 'PLAYER ' + (pp.score * 100).toFixed(0) + '%';
            canvasCtx.font = 'bold 12px monospace';
            canvasCtx.fillStyle = '#000';
            canvasCtx.fillRect(ppx - ppw/2, ppy - pph/2 - 18, canvasCtx.measureText(pLabel).width + 8, 18);
            canvasCtx.fillStyle = '#00e5ff';
            canvasCtx.fillText(pLabel, ppx - ppw/2 + 4, ppy - pph/2 - 4);
            canvasCtx.restore();
          }
        }

        // ── Phase L3: Ball trajectory + crossing-point overlay ──
        // Trajectory points are in normalized video coords (0..1) — same
        // space as rim. Map straight to canvas via cw/ch (the canvas is
        // already sized to the displayed video area, no crop step needed).
        if (dd.trajectory && dd.trajectory.length >= 2) {
          canvasCtx.save();
          // Draw the path as a fading polyline (newest segments brighter).
          for (var ti = 1; ti < dd.trajectory.length; ti++) {
            var a = dd.trajectory[ti - 1];
            var b = dd.trajectory[ti];
            var alpha = 0.25 + 0.75 * (ti / dd.trajectory.length); // fade tail
            canvasCtx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(2) + ')';
            canvasCtx.lineWidth = 2;
            canvasCtx.beginPath();
            canvasCtx.moveTo(a.x * cw, a.y * ch);
            canvasCtx.lineTo(b.x * cw, b.y * ch);
            canvasCtx.stroke();
          }
          // Mark the head of the trajectory (most recent ball position).
          var head = dd.trajectory[dd.trajectory.length - 1];
          canvasCtx.fillStyle = '#fff';
          canvasCtx.beginPath();
          canvasCtx.arc(head.x * cw, head.y * ch, 5, 0, Math.PI * 2);
          canvasCtx.fill();
          canvasCtx.restore();
        }

        // L12: Preflight calibration overlay. Until ALL three entities
        // (ball / hoop / player) are reliably detected, a translucent panel
        // covers the canvas with a progress checklist. The engine refuses
        // to count shots while this is showing — guarantees we don't spam
        // wrong misses on top of a half-calibrated rim position.
        if (dd.preflight && !dd.preflight.ready) {
          canvasCtx.save();
          // Background tint over the whole canvas
          canvasCtx.fillStyle = 'rgba(8, 12, 24, 0.78)';
          canvasCtx.fillRect(0, 0, cw, ch);
          // Center panel
          var panelW = Math.min(440, cw - 32);
          var panelH = 230;
          var panelX = (cw - panelW) / 2;
          var panelY = (ch - panelH) / 2;
          canvasCtx.fillStyle = 'rgba(20, 24, 40, 0.95)';
          canvasCtx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
          canvasCtx.lineWidth = 2;
          canvasCtx.fillRect(panelX, panelY, panelW, panelH);
          canvasCtx.strokeRect(panelX, panelY, panelW, panelH);

          canvasCtx.fillStyle = '#00e5ff';
          canvasCtx.font = 'bold 20px monospace';
          canvasCtx.textAlign = 'center';
          canvasCtx.fillText('CALIBRATING…', cw / 2, panelY + 38);

          canvasCtx.font = '12px monospace';
          canvasCtx.fillStyle = '#9ca3af';
          canvasCtx.fillText('Looking for ball, hoop and player', cw / 2, panelY + 60);

          // Three checklist rows
          var rows = [
            { key: 'hoop',   label: 'Hoop',   icon: '🟧' },
            { key: 'player', label: 'Player', icon: '👤' },
            { key: 'ball',   label: 'Ball',   icon: '🏀' }
          ];
          var rowY = panelY + 100;
          canvasCtx.textAlign = 'left';
          for (var pi = 0; pi < rows.length; pi++) {
            var r = rows[pi];
            var got = dd.preflight.checks[r.key] || 0;
            var need = dd.preflight.thresholds[r.key] || 1;
            var done = got >= need;
            var rx = panelX + 32;
            var ry = rowY + pi * 36;
            // Status pill
            canvasCtx.fillStyle = done ? '#00ff88' : '#facc15';
            canvasCtx.fillRect(rx, ry - 14, 16, 16);
            canvasCtx.fillStyle = '#000';
            canvasCtx.font = 'bold 13px monospace';
            canvasCtx.textAlign = 'center';
            canvasCtx.fillText(done ? '✓' : '…', rx + 8, ry - 2);
            // Label + count
            canvasCtx.textAlign = 'left';
            canvasCtx.fillStyle = done ? '#e5e7eb' : '#d1d5db';
            canvasCtx.font = 'bold 16px monospace';
            canvasCtx.fillText(r.label, rx + 28, ry);
            canvasCtx.font = '13px monospace';
            canvasCtx.fillStyle = done ? '#00ff88' : '#facc15';
            var status = done ? 'detected' : ('searching ' + Math.min(got, need) + '/' + need);
            canvasCtx.fillText(status, rx + 110, ry);
            // L12.2: last rejection reason inline
            var reasons = dd.preflight.checks && dd.preflight.checks.lastReason || null;
            if (!done && reasons && reasons[r.key]) {
              canvasCtx.font = '11px monospace';
              canvasCtx.fillStyle = '#ff7b7b';
              canvasCtx.fillText('(' + reasons[r.key] + ')', rx + 230, ry);
            }
          }
          canvasCtx.textAlign = 'left';
          canvasCtx.restore();
        }

        // L9.3: BIG made/missed banner across the top of the canvas for 3s
        // after each shot. Shows the actual dist/thresh values so the user
        // can immediately see WHY the algorithm decided MADE or MISSED.
        if (lastShotBanner) {
          var bSince = Date.now() - lastShotBanner.t;
          if (bSince < 3000) {
            var bFade = bSince < 2700 ? 1 : (1 - (bSince - 2700) / 300);
            var bMade = lastShotBanner.result === 'made';
            canvasCtx.save();
            // Background bar — green for made, red for miss
            canvasCtx.fillStyle = (bMade ? 'rgba(0,200,100,' : 'rgba(220,40,40,') + (bFade * 0.85).toFixed(2) + ')';
            canvasCtx.fillRect(0, 0, cw, 64);
            // Big main label
            canvasCtx.fillStyle = 'rgba(255,255,255,' + bFade.toFixed(2) + ')';
            canvasCtx.font = 'bold 32px monospace';
            canvasCtx.textAlign = 'center';
            canvasCtx.fillText(bMade ? '✓ MADE' : '✗ MISSED', cw / 2, 38);
            // Sub-line with dist/thresh — only if we have the numbers
            if (lastShotBanner.dist != null && lastShotBanner.thresh != null) {
              canvasCtx.font = 'bold 14px monospace';
              var pct = (lastShotBanner.ratio * 100).toFixed(0);
              var sub = 'dist=' + (lastShotBanner.dist * 100).toFixed(1) + '% ' +
                        'thresh=' + (lastShotBanner.thresh * 100).toFixed(1) + '% ' +
                        '(' + pct + '% of thresh)';
              canvasCtx.fillText(sub, cw / 2, 58);
            }
            canvasCtx.textAlign = 'left';
            canvasCtx.restore();
          }
        }

        // Draw the last crossing point as a big circle, color-coded by
        // result, so we can see WHERE the ball passed the rim line.
        // Fades out after 2 seconds — no point staring at old crossings.
        if (dd.lastCrossing) {
          var since = Date.now() - dd.lastCrossing.t;
          if (since < 2000) {
            var fade = 1 - since / 2000;
            var color = dd.lastCrossing.result === 'made' ? '0,255,136' : '255,68,68';
            canvasCtx.save();
            canvasCtx.strokeStyle = 'rgba(' + color + ',' + fade.toFixed(2) + ')';
            canvasCtx.fillStyle   = 'rgba(' + color + ',' + (fade * 0.25).toFixed(2) + ')';
            canvasCtx.lineWidth = 4;
            var cxPx = dd.lastCrossing.x * cw;
            var cyPx = dd.lastCrossing.y * ch;
            var rPx  = 22 + (1 - fade) * 30;  // pulse outward as it fades
            canvasCtx.beginPath();
            canvasCtx.arc(cxPx, cyPx, rPx, 0, Math.PI * 2);
            canvasCtx.stroke();
            canvasCtx.fill();
            canvasCtx.font = 'bold 14px monospace';
            canvasCtx.fillStyle = 'rgba(' + color + ',' + fade.toFixed(2) + ')';
            var crossLbl = dd.lastCrossing.result.toUpperCase() +
              ' (Δ=' + (dd.lastCrossing.distFromRim * 100).toFixed(1) + '%)';
            canvasCtx.fillText(crossLbl, cxPx + rPx + 6, cyPx + 5);
            canvasCtx.restore();
          }
        }

        // Update debug info panel
        if (els.debugInfo && dd.frameCount % 5 === 0) {
          var stateColor = dd.shotState === 'idle' ? '#888' :
                           dd.shotState === 'shot_started' ? '#ffaa00' :
                           dd.shotState === 'near_hoop' ? '#00ff88' : '#ff4444';
          // L7 diagnostic: pose-trigger counters + last decision reason
          var psHtml = '';
          if (dd.poseStats) {
            var ps = dd.poseStats;
            var trigPct = ps.checks > 0 ? ((ps.triggers / ps.checks) * 100).toFixed(1) : '0.0';
            psHtml = '<br><b>Pose:</b> ' + ps.checks + ' checks, ' +
                     '<span style="color:#00ff88">' + ps.triggers + ' triggers</span> (' + trigPct + '%)' +
                     ' &nbsp; <b>last conf:</b> ' + (ps.lastConfidence || 0).toFixed(2);
          }
          var reasonHtml = dd.lastShotReason
            ? '<br><b>Last decision:</b> <span style="color:#facc15">' + dd.lastShotReason + '</span>'
            : '';
          els.debugInfo.innerHTML =
            '<b>Frame:</b> ' + dd.frameCount +
            ' &nbsp; <b>State:</b> <span style="color:' + stateColor + '">' + (dd.shotState || 'idle') + '</span>' +
            '<br><b>Balls:</b> ' + (dd.balls ? dd.balls.length : 0) +
            ' &nbsp; <b>Hoops:</b> ' + (dd.hoops ? dd.hoops.length : 0) +
            ' &nbsp; <b>Players:</b> ' + (dd.players ? dd.players.length : 0) +
            (dd.balls && dd.balls[0] ? '<br><b>Best ball:</b> ' + (dd.balls[0].score * 100).toFixed(1) + '%' : '') +
            (dd.hoops && dd.hoops[0] ? ' &nbsp; <b>Best hoop:</b> ' + (dd.hoops[0].score * 100).toFixed(1) + '%' : '') +
            (dd.players && dd.players[0] ? ' &nbsp; <b>Best player:</b> ' + (dd.players[0].score * 100).toFixed(1) + '%' : '') +
            '<br><b>Trajectory:</b> ' + (dd.trajectory ? dd.trajectory.length : 0) + ' points' +
            (dd.lastCrossing ? ' &nbsp; <b>Last crossing:</b> <span style="color:' + (dd.lastCrossing.result === 'made' ? '#00ff88' : '#ff4444') + '">' + dd.lastCrossing.result + ' (Δ=' + (dd.lastCrossing.distFromRim * 100).toFixed(1) + '%)</span>' : '') +
            psHtml +
            reasonHtml +
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
