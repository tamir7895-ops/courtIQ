/* ============================================================
   AI SHOT TRACKER — /js/ai-shot-tracker.js
   Camera-based automatic shot detection using color segmentation.
   Tracks orange basketball, detects made/miss via rim zone.
   No external dependencies — pure browser APIs + canvas.
   ============================================================ */
(function () {
  'use strict';

  /* ── Constants ────────────────────────────────────────────── */
  var RIM_RX = 55;     // Rim ellipse half-width (px in canvas coords)
  var RIM_RY = 20;     // Rim ellipse half-height
  var MIN_BLOB = 120;  // Min orange pixels to count as ball (sampled every 2px)
  var MAX_BLOB = 8000; // Max orange pixels (avoid floor/jersey noise)
  var MAX_HIST = 45;   // Max trajectory history frames
  var COOLDOWN = 48;   // Frames between shot detections (~1.6s at 30fps)

  /* ── State ────────────────────────────────────────────────── */
  var PHASE = { IDLE: 'idle', CALIBRATING: 'calibrating', TRACKING: 'tracking', SUMMARY: 'summary' };
  var phase = PHASE.IDLE;

  var video, canvas, ctx, stream;
  var W = 0, H = 0;
  var animFrame = null;
  var mode = 'camera';   // 'camera' | 'video'
  var videoUrl = null;   // object URL for uploaded video file

  var rim = null;       // { cx, cy, rx, ry }
  var ballHistory = []; // array of {x,y} or null
  var shotPhase = 'idle'; // idle | ascending | at_rim
  var cooldownFrames = 0;

  var session = {
    attempts: 0, made: 0, shots: [],
    startTime: 0, streak: 0, maxStreak: 0
  };

  /* ── Color detection ──────────────────────────────────────── */
  function isOrange(r, g, b) {
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if (max < 100) return false;        // Too dark
    var delta = max - min;
    if (delta < 40) return false;       // Too grey/desaturated
    var s = delta / max;
    if (s < 0.45) return false;

    // Hue (0-360)
    var h;
    if (max === r)      h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else                h = 60 * ((r - g) / delta + 4);
    if (h < 0) h += 360;

    // Orange hue range: 10–42 deg
    return h >= 10 && h <= 42;
  }

  function detectBall(imageData) {
    var data = imageData.data;
    var w = imageData.width, h = imageData.height;
    var sumX = 0, sumY = 0, count = 0;

    // Sample every 2 pixels for ~4x speedup
    for (var y = 0; y < h; y += 2) {
      for (var x = 0; x < w; x += 2) {
        var i = (y * w + x) * 4;
        if (isOrange(data[i], data[i + 1], data[i + 2])) {
          sumX += x; sumY += y; count++;
        }
      }
    }

    if (count < MIN_BLOB || count > MAX_BLOB) return null;
    return { x: sumX / count, y: sumY / count, size: count };
  }

  /* ── Rim geometry ─────────────────────────────────────────── */
  function insideRim(x, y) {
    if (!rim) return false;
    var dx = (x - rim.cx) / rim.rx;
    var dy = (y - rim.cy) / rim.ry;
    return dx * dx + dy * dy <= 1.0;
  }

  function inApproachZone(y) {
    if (!rim) return false;
    // Ball must be between 5 rim heights above and 1 below the rim center
    return y > rim.cy - rim.ry * 5 && y < rim.cy + rim.ry * 1.5;
  }

  /* ── Shot detection state machine ────────────────────────── */
  function processBall(ball) {
    if (cooldownFrames > 0) { cooldownFrames--; return; }

    ballHistory.push(ball ? { x: ball.x, y: ball.y } : null);
    if (ballHistory.length > MAX_HIST) ballHistory.shift();

    if (!ball) {
      // Ball disappeared while at rim → likely passed through
      if (shotPhase === 'at_rim') {
        recordShot(true);
        shotPhase = 'idle';
        cooldownFrames = COOLDOWN;
      } else if (shotPhase === 'ascending') {
        shotPhase = 'idle';
      }
      return;
    }

    // y-velocity over last 8 valid frames (canvas y: up = negative)
    var recent = ballHistory.filter(Boolean);
    var yVel = 0;
    if (recent.length >= 4) {
      var old = recent[Math.max(0, recent.length - 8)];
      yVel = ball.y - old.y;
    }

    if (shotPhase === 'idle') {
      if (yVel < -10 && inApproachZone(ball.y)) {
        shotPhase = 'ascending';
      }
    } else if (shotPhase === 'ascending') {
      if (insideRim(ball.x, ball.y)) {
        shotPhase = 'at_rim';
      } else if (yVel > 10) {
        // Fell without reaching rim — miss if it was near the rim zone
        if (inApproachZone(ball.y)) {
          recordShot(false);
          shotPhase = 'idle';
          cooldownFrames = COOLDOWN;
        } else {
          shotPhase = 'idle';
        }
      }
    } else if (shotPhase === 'at_rim') {
      if (!insideRim(ball.x, ball.y)) {
        // Exited rim zone: below = made, above = rejected
        recordShot(ball.y > rim.cy);
        shotPhase = 'idle';
        cooldownFrames = COOLDOWN;
      }
    }
  }

  function recordShot(made) {
    session.attempts++;
    if (made) {
      session.made++;
      session.streak++;
      session.maxStreak = Math.max(session.maxStreak, session.streak);
    } else {
      session.streak = 0;
    }
    session.shots.push({ made: made, t: Date.now() });
    updateCounter();
    flashResult(made);
  }

  /* ── Manual override ──────────────────────────────────────── */
  function manualMade() { if (phase === PHASE.TRACKING) recordShot(true); }
  function manualMiss() { if (phase === PHASE.TRACKING) recordShot(false); }

  /* ── Drawing ──────────────────────────────────────────────── */
  function drawOverlay(ball) {
    // Rim ellipse
    if (rim) {
      ctx.strokeStyle = 'rgba(245,166,35,0.85)';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(245,166,35,0.5)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(rim.cx, rim.cy, rim.rx, rim.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Approach zone dashed ellipse
      ctx.strokeStyle = 'rgba(245,166,35,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(rim.cx, rim.cy, rim.rx * 1.8, rim.ry * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ball detected circle
    if (ball) {
      ctx.strokeStyle = '#56d364';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#56d364';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(86,211,100,0.2)';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Center dot
      ctx.fillStyle = '#56d364';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Trajectory trail
    var valid = ballHistory.filter(Boolean);
    if (valid.length > 2) {
      ctx.strokeStyle = 'rgba(86,211,100,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(valid[0].x, valid[0].y);
      for (var i = 1; i < valid.length; i++) {
        ctx.lineTo(valid[i].x, valid[i].y);
      }
      ctx.stroke();
    }

    // Shot phase indicator dot (top-left corner)
    if (phase === PHASE.TRACKING) {
      var dotColor = shotPhase === 'idle' ? '#56d364'
                   : shotPhase === 'ascending' ? '#f5a623'
                   : '#3b9eff';
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(18, 18, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ── Frame loop ───────────────────────────────────────────── */
  function frameLoop() {
    if (phase !== PHASE.TRACKING && phase !== PHASE.CALIBRATING) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, W, H);

    // Read pixels + detect ball
    var imageData = ctx.getImageData(0, 0, W, H);
    var ball = detectBall(imageData);

    // Run shot detection
    if (phase === PHASE.TRACKING) processBall(ball);

    // Draw overlays
    drawOverlay(ball);

    animFrame = requestAnimationFrame(frameLoop);
  }

  /* ── UI helpers ───────────────────────────────────────────── */
  function updateCounter() {
    var elMade = document.getElementById('ast-made');
    var elAtt  = document.getElementById('ast-attempts');
    var elPct  = document.getElementById('ast-pct');
    if (elMade) elMade.textContent = session.made;
    if (elAtt)  elAtt.textContent  = session.attempts;
    if (elPct) {
      elPct.textContent = session.attempts > 0
        ? Math.round((session.made / session.attempts) * 100) + '%'
        : '—%';
    }
  }

  function flashResult(made) {
    var el = document.getElementById('ast-flash');
    if (!el) return;
    el.textContent = made ? '+ MADE!' : '× MISS';
    el.className = 'ast-flash ' + (made ? 'ast-flash-made' : 'ast-flash-miss') + ' ast-flash-show';
    setTimeout(function () { el.classList.remove('ast-flash-show'); }, 900);
  }

  function showPhase(p) {
    var calibEl = document.getElementById('ast-calib-msg');
    var trackEl = document.getElementById('ast-track-msg');
    if (calibEl) calibEl.style.display = p === 'calibrate' ? '' : 'none';
    if (trackEl) trackEl.style.display = p === 'track' ? '' : 'none';
  }

  /* ── Camera ───────────────────────────────────────────────── */
  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraError('Camera API not supported. Use Chrome or Safari on a modern device.');
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      }
    }).then(function (s) {
      stream = s;
      video  = document.getElementById('ast-video');
      canvas = document.getElementById('ast-canvas');
      ctx    = canvas.getContext('2d');

      video.srcObject = stream;
      video.onloadedmetadata = function () {
        video.play();
        W = video.videoWidth  || 1280;
        H = video.videoHeight || 720;
        canvas.width  = W;
        canvas.height = H;
        phase = PHASE.CALIBRATING;
        showPhase('calibrate');
        animFrame = requestAnimationFrame(frameLoop);
      };
    }).catch(function (err) {
      showCameraError('Camera error: ' + err.message + '. Please allow camera access and try again.');
    });
  }

  function stopCamera() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (mode === 'video' && video) { video.pause(); video.src = ''; video.load(); }
    if (videoUrl) { URL.revokeObjectURL(videoUrl); videoUrl = null; }
    showVideoControls(false);
  }

  function showVideoControls(show) {
    var vc = document.getElementById('ast-video-controls');
    if (vc) vc.style.display = show ? '' : 'none';
  }

  function showCameraError(msg) {
    var el = document.getElementById('ast-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  /* ── Rim calibration (tap on canvas) ─────────────────────── */
  function onCanvasTap(e) {
    if (phase !== PHASE.CALIBRATING) return;
    e.preventDefault();

    var rect = canvas.getBoundingClientRect();
    var scaleX = W / rect.width;
    var scaleY = H / rect.height;

    var src = e.touches ? e.touches[0] : e;
    var tapX = (src.clientX - rect.left) * scaleX;
    var tapY = (src.clientY - rect.top)  * scaleY;

    rim = { cx: tapX, cy: tapY, rx: RIM_RX, ry: RIM_RY };
    phase = PHASE.TRACKING;
    showPhase('track');

    // In video mode, begin playback once rim is set
    if (mode === 'video' && video) {
      video.play();
      var ppBtn = document.getElementById('ast-vc-playpause');
      if (ppBtn) ppBtn.textContent = '⏸';
    }
  }

  /* ── Open overlay (shared reset) ─────────────────────────── */
  function openOverlayBase() {
    var overlay = document.getElementById('ast-overlay');
    if (!overlay) return false;

    session = { attempts: 0, made: 0, shots: [], startTime: Date.now(), streak: 0, maxStreak: 0 };
    ballHistory = [];
    shotPhase = 'idle';
    rim = null;
    cooldownFrames = 0;
    phase = PHASE.IDLE;

    var cameraView  = document.getElementById('ast-camera-view');
    var summaryView = document.getElementById('ast-summary-view');
    if (cameraView)  cameraView.style.display  = '';
    if (summaryView) summaryView.style.display = 'none';

    updateCounter();
    showVideoControls(false);

    var errEl = document.getElementById('ast-error');
    if (errEl) errEl.style.display = 'none';

    overlay.classList.add('ast-visible');
    document.body.style.overflow = 'hidden';
    return true;
  }

  /* ── Open with live camera ────────────────────────────────── */
  function openOverlay() {
    mode = 'camera';
    if (openOverlayBase()) startCamera();
  }

  /* ── Open with uploaded video ─────────────────────────────── */
  function openOverlayVideo() {
    mode = 'video';
    var fileInput = document.getElementById('ast-file-input');
    if (fileInput) { fileInput.value = ''; fileInput.click(); }
  }

  /* ── Start from a File object ─────────────────────────────── */
  function startVideo(file) {
    video  = document.getElementById('ast-video');
    canvas = document.getElementById('ast-canvas');
    ctx    = canvas.getContext('2d');

    if (videoUrl) { URL.revokeObjectURL(videoUrl); }
    videoUrl = URL.createObjectURL(file);

    video.srcObject = null;
    video.src = videoUrl;
    video.loop = false;
    video.playbackRate = 1;

    video.onloadedmetadata = function () {
      W = video.videoWidth  || 1280;
      H = video.videoHeight || 720;
      canvas.width  = W;
      canvas.height = H;
      video.currentTime = 0;
      video.pause();
      phase = PHASE.CALIBRATING;
      showPhase('calibrate');
      showVideoControls(true);
      var ppBtn = document.getElementById('ast-vc-playpause');
      if (ppBtn) ppBtn.textContent = '▶';
      animFrame = requestAnimationFrame(frameLoop);
    };

    video.ontimeupdate = function () {
      var scrub = document.getElementById('ast-vc-scrub');
      if (scrub && video.duration) {
        scrub.value = (video.currentTime / video.duration) * 100;
      }
      var ppBtn = document.getElementById('ast-vc-playpause');
      if (ppBtn) ppBtn.textContent = video.paused ? '▶' : '⏸';
    };

    video.onended = function () {
      if (phase === PHASE.TRACKING || phase === PHASE.CALIBRATING) stopSession();
    };

    video.load();
  }

  /* ── Stop → Summary ───────────────────────────────────────── */
  function stopSession() {
    stopCamera();
    phase = PHASE.SUMMARY;
    buildSummary();
  }

  function pctHex(pct) {
    if (pct >= 65) return '#56d364';
    if (pct >= 50) return '#f5a623';
    return '#f85149';
  }

  function fmtDuration(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function calcXP() {
    var pct = session.attempts > 0 ? Math.round((session.made / session.attempts) * 100) : 0;
    var xp = 25;
    xp += session.made * 2;
    xp += Math.floor(session.maxStreak / 3) * 5;
    if (pct >= 60 && session.attempts >= 10) xp += 10;
    if (session.attempts >= 50) xp += 15;
    return xp;
  }

  function buildSummary() {
    var cameraView  = document.getElementById('ast-camera-view');
    var summaryView = document.getElementById('ast-summary-view');
    var sumContent  = document.getElementById('ast-sum-content');
    if (!summaryView || !sumContent) return;

    if (cameraView) cameraView.style.display = 'none';
    summaryView.style.display = '';

    var dur = Math.round((Date.now() - session.startTime) / 1000);
    var pct = session.attempts > 0 ? Math.round((session.made / session.attempts) * 100) : 0;
    var xp  = calcXP();
    var hex = pctHex(pct);

    sumContent.innerHTML =
      '<div class="ast-sum-ring-wrap">' +
        '<div class="ast-sum-ring" id="ast-sum-ring" style="background:conic-gradient(' + hex + ' ' + (pct * 3.6) + 'deg,var(--c-surface2) 0deg);">' +
          '<div class="ast-sum-ring-inner"><span class="ast-sum-pct" style="color:' + hex + '">' + pct + '%</span></div>' +
        '</div>' +
        '<div class="ast-sum-ring-label">Overall Shooting %</div>' +
      '</div>' +

      '<div class="ast-sum-stats">' +
        '<div class="ast-sum-stat">' +
          '<div class="ast-sum-stat-val">' + session.made + ' / ' + session.attempts + '</div>' +
          '<div class="ast-sum-stat-lbl">Made / Attempts</div>' +
        '</div>' +
        '<div class="ast-sum-stat">' +
          '<div class="ast-sum-stat-val">' + session.maxStreak + '</div>' +
          '<div class="ast-sum-stat-lbl">Best Streak</div>' +
        '</div>' +
        '<div class="ast-sum-stat">' +
          '<div class="ast-sum-stat-val">' + fmtDuration(dur) + '</div>' +
          '<div class="ast-sum-stat-lbl">Duration</div>' +
        '</div>' +
      '</div>' +

      '<div class="ast-sum-xp-box">' +
        '<div class="ast-sum-xp-val">⚡ +' + xp + ' XP</div>' +
        '<div class="ast-sum-xp-breakdown">' +
          '<span>Base: 25</span>' +
          (session.made > 0 ? '<span>Made shots: +' + (session.made * 2) + '</span>' : '') +
          (session.maxStreak >= 3 ? '<span>Streaks: +' + (Math.floor(session.maxStreak / 3) * 5) + '</span>' : '') +
          (pct >= 60 && session.attempts >= 10 ? '<span>Accuracy bonus: +10</span>' : '') +
          (session.attempts >= 50 ? '<span>Volume bonus: +15</span>' : '') +
        '</div>' +
      '</div>' +

      '<div class="ast-sum-actions">' +
        (session.attempts > 0
          ? '<button class="ast-sum-save-btn" id="ast-save-btn">Save Session</button>'
          : '') +
        '<button class="ast-sum-discard-btn" id="ast-discard-btn">' + (session.attempts > 0 ? 'Discard' : 'Close') + '</button>' +
      '</div>';

    // Bind buttons
    var saveBtn = document.getElementById('ast-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function () { saveAndClose(xp); });

    var discardBtn = document.getElementById('ast-discard-btn');
    if (discardBtn) discardBtn.addEventListener('click', closeOverlay);
  }

  /* ── Save session ─────────────────────────────────────────── */
  function saveAndClose(xp) {
    var pct = session.attempts > 0 ? Math.round((session.made / session.attempts) * 100) : 0;

    var s = {
      id:            Date.now(),
      date:          new Date().toISOString(),
      fg_made:       session.made,
      fg_missed:     session.attempts - session.made,
      three_made:    0,
      three_missed:  0,
      ft_made:       0,
      ft_missed:     0,
      session_type:  'ai_tracking',
      accuracy:      pct,
      max_streak:    session.maxStreak
    };

    // Write to localStorage via ShotTracker
    try {
      var existing = [];
      var raw = localStorage.getItem('courtiq-shot-sessions');
      if (raw) existing = JSON.parse(raw);
      existing.unshift(s);
      if (existing.length > 50) existing = existing.slice(0, 50);
      localStorage.setItem('courtiq-shot-sessions', JSON.stringify(existing));
      if (window.ShotTracker && window.ShotTracker.renderHistory) {
        window.ShotTracker.renderHistory(existing);
      }
    } catch (e) { /* silent */ }

    // Async Supabase sync
    if (window.currentUser && typeof DataService !== 'undefined') {
      DataService.addShotSession(s).catch(function () {});
    }

    // XP
    if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
      XPSystem.grantXP(xp, 'AI Shot Tracking Session');
    }

    // Toast
    if (typeof showToast === 'function') {
      showToast('\uD83C\uDFC0 AI session saved! +' + xp + ' XP');
    }

    // Refresh charts
    if (typeof ProgressCharts !== 'undefined' && ProgressCharts.refresh) {
      ProgressCharts.refresh();
    }

    closeOverlay();
  }

  /* ── Close overlay ────────────────────────────────────────── */
  function closeOverlay() {
    stopCamera();
    var overlay = document.getElementById('ast-overlay');
    if (overlay) overlay.classList.remove('ast-visible');
    document.body.style.overflow = '';
    phase = PHASE.IDLE;
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    // Launch button
    var launchBtn = document.getElementById('ast-launch-btn');
    if (launchBtn) launchBtn.addEventListener('click', openOverlay);

    // Close (X) button
    var closeBtn = document.getElementById('ast-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      if (phase === PHASE.SUMMARY) { closeOverlay(); return; }
      if (session.attempts === 0) { closeOverlay(); return; }
      if (confirm('Stop AI tracking? You can save the session on the next screen.')) {
        stopSession();
      }
    });

    // Stop → summary button
    var stopBtn = document.getElementById('ast-stop-btn');
    if (stopBtn) stopBtn.addEventListener('click', function () {
      if (phase === PHASE.TRACKING || phase === PHASE.CALIBRATING) stopSession();
    });

    // Canvas tap (rim calibration)
    var cvs = document.getElementById('ast-canvas');
    if (cvs) {
      cvs.addEventListener('click', onCanvasTap);
      cvs.addEventListener('touchend', onCanvasTap, { passive: false });
    }

    // Manual override buttons
    var madeBtn = document.getElementById('ast-manual-made');
    if (madeBtn) madeBtn.addEventListener('click', manualMade);

    var missBtn = document.getElementById('ast-manual-miss');
    if (missBtn) missBtn.addEventListener('click', manualMiss);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.AIShotTracker = { open: openOverlay, close: closeOverlay };

})();
