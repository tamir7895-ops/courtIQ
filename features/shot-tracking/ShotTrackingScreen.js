/* ══════════════════════════════════════════════════════════════
   SHOT TRACKING SCREEN — Vanilla JS / HTML5 / Canvas
   Self-contained UI module for the AI Shot Tracker feature.

   Phases:
     1. RIM LOCK — Camera preview, user taps rim to calibrate
     2. TRACKING — Live detection overlay with stats
     3. SUMMARY  — Post-session results + shot chart + save

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

  /* ── State ──────────────────────────────────────────────────── */
  var phase = 'idle'; // idle | rimlock | threept | tracking | summary
  var stream = null;
  var videoEl, canvasEl, canvasCtx;
  var overlayAnimFrame = null;

  // Rim lock state
  var rimCenter = null;       // { x, y } normalized (0-1)
  var rimSize   = { w: DEFAULT_RIM_W, h: DEFAULT_RIM_H };
  var rimLocked = false;

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
        '<video id="st-video" autoplay playsinline muted></video>',
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
        '<div class="st-flash" id="st-flash"></div>',
        '<div class="st-result-text" id="st-result-text"></div>',
        '<div class="st-bottom-bar">',
          '<button class="st-stop-btn" id="st-stop-btn">',
            '<div class="st-stop-icon"></div>',
            '<span class="st-stop-text">End Session</span>',
          '</button>',
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
    els.flash            = document.getElementById('st-flash');
    els.resultText       = document.getElementById('st-result-text');
    els.stopBtn          = document.getElementById('st-stop-btn');
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
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════ */
  function openScreen() {
    buildHTML();
    els.screen.classList.add('active');
    phase = 'rimlock';
    rimCenter = null;
    rimLocked = false;
    rimSize = { w: DEFAULT_RIM_W, h: DEFAULT_RIM_H };
    shots = [];
    streak = 0;
    maxStreak = 0;

    // Reset 3PT state
    threePtPoint = null;
    threePtDistance = 0;

    // Show rim lock overlay
    els.rimlock.classList.add('active');
    els.threept.classList.remove('active');
    els.tracking.classList.remove('active');
    els.summary.classList.remove('active');

    // Show crosshairs
    toggleCrosshairs(true);
    els.rimIndicator.style.display = 'none';
    els.sizeControls.classList.remove('active');
    els.lockBtn.classList.remove('active');
    els.rimlockText.textContent = 'Tap the center of the basketball rim';

    startCamera();
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
    if (stream) return;

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
        alert('Camera access is required for shot tracking. Please allow camera permissions and try again.');
        closeScreen();
      });
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
  }

  function resizeCanvas() {
    if (!canvasEl || !videoEl) return;
    canvasEl.width = videoEl.videoWidth || videoEl.clientWidth;
    canvasEl.height = videoEl.videoHeight || videoEl.clientHeight;
  }

  /* ══════════════════════════════════════════════════════════════
     RIM LOCK PHASE
     ══════════════════════════════════════════════════════════════ */
  function onRimTap(e) {
    if (rimLocked) return;

    var rect = els.rimlockTap.getBoundingClientRect();
    var normX = (e.clientX - rect.left) / rect.width;
    var normY = (e.clientY - rect.top) / rect.height;

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
    enterTrackingPhase();
  }

  function onThreePtSkip() {
    threePtPoint = null;
    threePtDistance = 0;
    els.threept.classList.remove('active');
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

    // Start timer
    timerInterval = setInterval(function () {
      elapsedSec++;
      els.timer.textContent = formatTime(elapsedSec);
    }, 1000);

    // Configure detection engine
    var engine = window.ShotDetectionEngine;
    engine.setRimZone(rimCenter.x, rimCenter.y, rimSize.w, rimSize.h);
    engine.setThreePtDistance(threePtDistance);
    engine.onShotDetected = onShotDetected;
    engine.onBallUpdate   = onBallUpdate;
    engine.onStatusChange = onDetectionStatus;

    // Initialize and start
    engine.init().then(function (ok) {
      if (ok && phase === 'tracking') {
        engine.start(videoEl);
        startOverlayLoop();
      }
    });
  }

  function stopTracking() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (overlayAnimFrame) { cancelAnimationFrame(overlayAnimFrame); overlayAnimFrame = null; }
    var engine = window.ShotDetectionEngine;
    if (engine) engine.stop();
  }

  function onDetectionStatus(status) {
    var dot = els.statusDot;
    var txt = els.statusText;
    dot.className = 'st-status-dot';
    switch (status) {
      case 'loading':
        dot.classList.add('loading');
        txt.textContent = 'Loading model...';
        break;
      case 'ready':
        txt.textContent = 'Model ready';
        break;
      case 'detecting':
        txt.textContent = 'Tracking';
        break;
      case 'error':
        dot.classList.add('error');
        txt.textContent = 'Detection error';
        break;
      default:
        txt.textContent = status;
    }
  }

  /* ── Shot callback ──────────────────────────────────────────── */
  function onShotDetected(data) {
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

    // Flash
    showFlash(isMade ? 'made' : 'missed');

    // Result text
    showResultText(isMade ? 'SWISH!' : 'MISS', isMade ? 'made' : 'missed');

    // Haptic (if available)
    if (navigator.vibrate) {
      navigator.vibrate(isMade ? [50, 30, 50] : [100]);
    }
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
  function onBallUpdate(pos) { currentBall = pos; }

  function startOverlayLoop() {
    function draw() {
      if (phase !== 'tracking') return;
      overlayAnimFrame = requestAnimationFrame(draw);

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

      // Draw ball tracking dot
      if (currentBall) {
        var bx = currentBall.normX * cw;
        var by = currentBall.normY * ch;
        canvasCtx.save();
        canvasCtx.beginPath();
        canvasCtx.arc(bx, by, 7, 0, Math.PI * 2);
        canvasCtx.fillStyle = '#ffaa00';
        canvasCtx.fill();
        canvasCtx.strokeStyle = '#fff';
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
        // Glow
        canvasCtx.shadowColor = '#ffaa00';
        canvasCtx.shadowBlur = 10;
        canvasCtx.beginPath();
        canvasCtx.arc(bx, by, 4, 0, Math.PI * 2);
        canvasCtx.fillStyle = '#ffaa00';
        canvasCtx.fill();
        canvasCtx.restore();
      }
    }

    draw();
  }

  /* ── Stop session ───────────────────────────────────────────── */
  function onStopSession() {
    if (!confirm('End session and view your results?')) return;
    stopTracking();
    enterSummaryPhase();
  }

  /* ══════════════════════════════════════════════════════════════
     SUMMARY PHASE
     ══════════════════════════════════════════════════════════════ */
  function enterSummaryPhase() {
    phase = 'summary';
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

    // Shot chart
    html.push(
      '<div class="st-chart-section">',
        '<div class="st-section-title">Shot Chart</div>',
        '<div class="st-chart-wrap">',
          buildShotChartSVG(summary.shots),
          '<div class="st-chart-legend">',
            '<div class="st-legend-item"><div class="st-legend-dot" style="background:#00ff88;"></div>Made</div>',
            '<div class="st-legend-item"><div class="st-legend-dot" style="background:#ff4444;"></div>Missed</div>',
          '</div>',
        '</div>',
      '</div>'
    );

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

    // Actions
    html.push(
      '<div class="st-actions">',
        '<button class="st-save-btn" id="st-save-btn">Save to CourtIQ</button>',
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
  async function saveSessionData(summary) {
    try {
      var zones = categorizeShotsByZone(summary.shots);

      await window.ShotService.saveSession({
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
        ft_made:        zones.paint.made,
        ft_missed:      zones.paint.missed
      });

      await window.ShotService.saveShots(summary.shots);

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

    // Shot dots — use launch point for positioning (where player shot from)
    // Misses first
    for (var i = 0; i < shotList.length; i++) {
      var s = shotList[i];
      var posX = s.launch_x !== undefined ? s.launch_x : s.shot_x;
      var posY = s.launch_y !== undefined ? s.launch_y : s.shot_y;
      var cx = 50 + posX * (COURT_W - 100);
      var cy = RIM_SVG_Y + (1 - posY) * (COURT_H - RIM_SVG_Y - 40);
      var isMade = s.shot_result === 'made';
      if (!isMade) {
        lines.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="5" fill="#ff4444" opacity="0.6"/>');
      }
    }
    // Made on top
    for (var j = 0; j < shotList.length; j++) {
      var s2 = shotList[j];
      var posX2 = s2.launch_x !== undefined ? s2.launch_x : s2.shot_x;
      var posY2 = s2.launch_y !== undefined ? s2.launch_y : s2.shot_y;
      var cx2 = 50 + posX2 * (COURT_W - 100);
      var cy2 = RIM_SVG_Y + (1 - posY2) * (COURT_H - RIM_SVG_Y - 40);
      if (s2.shot_result === 'made') {
        lines.push('<circle cx="' + cx2.toFixed(1) + '" cy="' + cy2.toFixed(1) + '" r="6" fill="#00ff88" opacity="0.9" stroke="#fff" stroke-width="1"/>');
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
      threePoint: { made: 0, missed: 0 }
    };
    for (var i = 0; i < shotList.length; i++) {
      var s = shotList[i];
      // Use the pre-classified shot_zone if available (distance-based)
      var zone = s.shot_zone || 'midrange';
      if (zone === 'threePoint' || zone === 'paint' || zone === 'midrange') {
        // valid zone
      } else {
        zone = 'midrange';
      }
      if (s.shot_result === 'made') zones[zone].made++;
      else zones[zone].missed++;
    }
    return zones;
  }

  /* ══════════════════════════════════════════════════════════════
     EXPOSE GLOBALLY
     ══════════════════════════════════════════════════════════════ */
  window.ShotTrackingScreen = {
    open:  openScreen,
    close: closeScreen
  };

})();
