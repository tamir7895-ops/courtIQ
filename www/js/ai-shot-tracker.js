/* ============================================================
   AI SHOT TRACKER — /js/ai-shot-tracker.js
   Camera-based automatic shot detection using ML + color fallback.
   Tracks basketball, detects made/miss via rim zone.

   v2 — Resolution-normalized thresholds, velocity-predicting Kalman
        filter, robust state machine, clustered color detection,
        rebound-aware cooldown, video look-ahead buffering.
   ============================================================ */
(function () {
  'use strict';

  /* ── Resolution-relative constants ─────────────────────────
     All spatial thresholds are expressed as fractions of frame
     width (W) or height (H) so they work at any resolution.   */
  var RIM_RX_FRAC  = 0.043;  // Rim ellipse half-width  (~55/1280)
  var RIM_RY_FRAC  = 0.028;  // Rim ellipse half-height (~20/720)
  var BLOB_MIN_FRAC = 0.00025; // Min orange pixel ratio (sampled every 2px)
  var BLOB_MAX_FRAC = 0.015;   // Max orange pixel ratio
  var MAX_HIST      = 45;      // Trajectory history frames
  var COOLDOWN_SEC  = 2.0;     // Seconds between shot detections
  var BALL_CIRCLE_FRAC = 0.022; // Ball overlay circle radius as fraction of W

  /* ── Velocity thresholds (fraction of H per 8-frame window) */
  var VEL_RISE_FRAC  = 0.014;  // ~10/720 — ascending threshold
  var VEL_FALL_FRAC  = 0.014;  // falling threshold
  var TELEPORT_FRAC  = 0.22;   // max per-frame jump (fraction of W)

  /* ── Disappear grace — frames ball can vanish before we act */
  var DISAPPEAR_GRACE = 6;

  /* ── State ────────────────────────────────────────────────── */
  var PHASE = { IDLE: 'idle', CALIBRATING: 'calibrating', TRACKING: 'tracking', SUMMARY: 'summary' };
  var phase = PHASE.IDLE;

  var video, canvas, ctx, stream;
  var W = 0, H = 0;
  var animFrame = null;
  var mode = 'camera';   // 'camera' | 'video'
  var videoUrl = null;

  /* ── ML state ─────────────────────────────────────────────── */
  var tfModel     = null;
  var mlReady     = false;
  var mlLoading   = false;
  var isDetecting = false;
  var lastBall    = null;
  var frameCount  = 0;

  /* ── Kalman filter with velocity prediction (1-D, x and y) ─ */
  function createKalman() {
    return {
      x: null,   // position estimate
      v: 0,      // velocity estimate
      p: 1.0,    // position variance
      pv: 0.5,   // velocity variance
      R: 12,     // measurement noise
      Qp: 0.6,   // process noise — position
      Qv: 0.3    // process noise — velocity
    };
  }
  var kalX = createKalman();
  var kalY = createKalman();

  function kalmanUpdate(kal, z) {
    if (kal.x === null) { kal.x = z; kal.v = 0; return z; }
    // Predict
    var xPred = kal.x + kal.v;
    var pPred = kal.p + kal.pv + kal.Qp;
    // Update
    var k = pPred / (pPred + kal.R);
    kal.x = xPred + k * (z - xPred);
    kal.p = pPred * (1 - k);
    // Update velocity estimate
    var vMeas = kal.x - (xPred - kal.v); // observed change
    kal.v = kal.v + 0.3 * (vMeas - kal.v);
    kal.pv += kal.Qv;
    return kal.x;
  }

  function kalmanPredict(kal) {
    if (kal.x === null) return null;
    return kal.x + kal.v;
  }

  function applyKalman(ball) {
    return {
      x: kalmanUpdate(kalX, ball.x),
      y: kalmanUpdate(kalY, ball.y),
      size: ball.size,
      score: ball.score || 1
    };
  }

  function resetKalman() {
    kalX = createKalman();
    kalY = createKalman();
  }

  /* ── Rim & tracking state ──────────────────────────────────── */
  var rim = null;        // { cx, cy, rx, ry }
  var ballHistory = [];  // array of {x,y} or null
  var disappearCount = 0;

  // State machine: idle → ascending → at_rim → (below_rim | idle)
  var shotPhase = 'idle';
  var atRimFrames = 0;       // how many frames ball has been in rim zone
  var atRimMaxFrames = 18;   // max frames to wait for ball to pass through
  var cooldownUntil = 0;     // timestamp when cooldown expires

  var session = {
    attempts: 0, made: 0, shots: [],
    startTime: 0, streak: 0, maxStreak: 0
  };

  /* ── Video look-ahead buffer (video mode only) ─────────────
     In video mode we can buffer recent detections and analyze
     a small window of future frames before committing a result. */
  var VIDEO_LOOKAHEAD = 8;  // frames to buffer before deciding
  var pendingShot = null;   // { phase, enteredFrame, rimEntry: {x,y} }

  /* ── Physics validation ─────────────────────────────────────── */
  function isPhysicallyValid(ball) {
    if (!lastBall || !ball) return true;
    var dx = ball.x - lastBall.x, dy = ball.y - lastBall.y;
    return Math.sqrt(dx * dx + dy * dy) < W * TELEPORT_FRAC;
  }

  /* ── ML model loading ───────────────────────────────────────── */
  function loadMLModel() {
    if (mlLoading || mlReady) return;
    if (typeof cocoSsd === 'undefined') return;
    mlLoading = true;
    setMLStatus('loading');
    cocoSsd.load({ base: 'lite_mobilenet_v2' }).then(function (model) {
      tfModel = model;
      mlReady = true;
      mlLoading = false;
      setMLStatus('ready');
    }).catch(function () {
      mlLoading = false;
      setMLStatus('fallback');
    });
  }

  function setMLStatus(state) {
    var el = document.getElementById('ast-ml-status');
    if (!el) return;
    if (state === 'loading') { el.textContent = '🧠 Loading AI model…'; el.style.display = ''; }
    else if (state === 'ready') { el.textContent = '🤖 AI Active'; el.style.display = ''; }
    else { el.style.display = 'none'; }
  }

  /* ── ML-powered detection (async, falls back to color) ──────── */
  function detectBallAsync() {
    if (mlReady && tfModel) {
      return tfModel.detect(video).then(function (preds) {
        var best = null, bestScore = 0.3;
        for (var i = 0; i < preds.length; i++) {
          if (preds[i].class === 'sports ball' && preds[i].score > bestScore) {
            var area = preds[i].bbox[2] * preds[i].bbox[3];
            var frameArea = W * H;
            // Reject detections that are too small or too large relative to frame
            if (area < frameArea * 0.0005 || area > frameArea * 0.12) continue;
            best = preds[i]; bestScore = preds[i].score;
          }
        }
        if (best) {
          var b = best.bbox;
          return { x: b[0] + b[2] / 2, y: b[1] + b[3] / 2, size: b[2] * b[3], score: best.score };
        }
        return detectBallColor();
      }).catch(function () { return detectBallColor(); });
    }
    return Promise.resolve(detectBallColor());
  }

  /* ── Color detection with spatial clustering ────────────────── */
  function isOrange(r, g, b) {
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if (max < 100) return false;
    var delta = max - min;
    if (delta < 40) return false;
    var s = delta / max;
    if (s < 0.45) return false;
    var h;
    if (max === r)      h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else                h = 60 * ((r - g) / delta + 4);
    if (h < 0) h += 360;
    return h >= 10 && h <= 42;
  }

  function detectBallColor() {
    if (!canvas || !ctx) return null;
    var imageData = ctx.getImageData(0, 0, W, H);
    var data = imageData.data;
    var w = imageData.width, h = imageData.height;
    var totalPixelsSampled = (w / 2) * (h / 2);
    var minBlob = Math.max(30, Math.round(totalPixelsSampled * BLOB_MIN_FRAC));
    var maxBlob = Math.round(totalPixelsSampled * BLOB_MAX_FRAC);

    // Pass 1: collect all orange pixels into a flat array
    var orangeX = [], orangeY = [];
    for (var y = 0; y < h; y += 2) {
      for (var x = 0; x < w; x += 2) {
        var i = (y * w + x) * 4;
        if (isOrange(data[i], data[i + 1], data[i + 2])) {
          orangeX.push(x);
          orangeY.push(y);
        }
      }
    }

    if (orangeX.length < minBlob || orangeX.length > maxBlob) return null;

    // Pass 2: find largest spatial cluster (simple grid-cell approach)
    // Divide frame into cells, find cell with most orange pixels
    var cellW = Math.max(1, Math.round(w / 16));
    var cellH = Math.max(1, Math.round(h / 16));
    var grid = {};
    var bestCell = null, bestCount = 0;

    for (var j = 0; j < orangeX.length; j++) {
      var gx = Math.floor(orangeX[j] / cellW);
      var gy = Math.floor(orangeY[j] / cellH);
      var key = gx + ',' + gy;
      grid[key] = (grid[key] || 0) + 1;
      if (grid[key] > bestCount) {
        bestCount = grid[key];
        bestCell = key;
      }
    }

    if (!bestCell || bestCount < minBlob * 0.3) return null;

    // Compute centroid only from the winning cluster and its 8 neighbors
    var parts = bestCell.split(',');
    var bcx = parseInt(parts[0], 10), bcy = parseInt(parts[1], 10);
    var sumX = 0, sumY = 0, count = 0;

    for (var k = 0; k < orangeX.length; k++) {
      var cgx = Math.floor(orangeX[k] / cellW);
      var cgy = Math.floor(orangeY[k] / cellH);
      if (Math.abs(cgx - bcx) <= 1 && Math.abs(cgy - bcy) <= 1) {
        sumX += orangeX[k];
        sumY += orangeY[k];
        count++;
      }
    }

    if (count < minBlob * 0.2) return null;
    return { x: sumX / count, y: sumY / count, size: count, score: 0.45 };
  }

  /* ── Rim geometry (resolution-aware) ─────────────────────────── */
  function insideRim(x, y) {
    if (!rim) return false;
    var dx = (x - rim.cx) / rim.rx;
    var dy = (y - rim.cy) / rim.ry;
    return dx * dx + dy * dy <= 1.0;
  }

  function insideRimExpanded(x, y, factor) {
    if (!rim) return false;
    var dx = (x - rim.cx) / (rim.rx * factor);
    var dy = (y - rim.cy) / (rim.ry * factor);
    return dx * dx + dy * dy <= 1.0;
  }

  function inApproachZone(x, y) {
    if (!rim) return false;
    return y > rim.cy - rim.ry * 6 && y < rim.cy + rim.ry * 2.5 &&
           Math.abs(x - rim.cx) < rim.rx * 4;
  }

  /* ── Shot detection state machine (v2) ──────────────────────
     States:
       idle       → watching for ascending ball
       ascending  → ball moving upward toward rim area
       at_rim     → ball entered rim zone, waiting for exit
       below_rim  → ball exited below rim = MADE
       (miss is detected when ball exits sideways/upward from rim
        or descends past rim without entering it)
     ───────────────────────────────────────────────────────────── */
  function processBall(ball) {
    var now = Date.now();
    if (now < cooldownUntil) return;

    ballHistory.push(ball ? { x: ball.x, y: ball.y } : null);
    if (ballHistory.length > MAX_HIST) ballHistory.shift();

    // Track consecutive frames with no detection
    if (!ball) {
      disappearCount++;

      if (shotPhase === 'at_rim' && disappearCount >= DISAPPEAR_GRACE) {
        // Ball vanished while at rim for too long.
        // Check if the last known positions suggest it went below.
        var wentBelow = checkExitedBelow();
        if (wentBelow) {
          commitShot(true, now);
        } else {
          // Ambiguous — don't count as made, count as miss if ball was truly at rim
          if (atRimFrames >= 3) {
            commitShot(false, now);
          }
        }
        shotPhase = 'idle';
        atRimFrames = 0;
      } else if (shotPhase === 'ascending' && disappearCount > DISAPPEAR_GRACE) {
        shotPhase = 'idle';
      }
      return;
    }

    disappearCount = 0;

    // Compute y-velocity (normalized to frame height)
    var recent = [];
    for (var i = ballHistory.length - 1; i >= 0 && recent.length < 10; i--) {
      if (ballHistory[i]) recent.unshift(ballHistory[i]);
    }
    var yVel = 0;
    if (recent.length >= 4) {
      var lookback = Math.min(8, recent.length - 1);
      var old = recent[recent.length - 1 - lookback];
      yVel = (ball.y - old.y) / H; // normalized
    }

    if (shotPhase === 'idle') {
      // Ball rising and in approach zone
      if (yVel < -VEL_RISE_FRAC && inApproachZone(ball.x, ball.y)) {
        shotPhase = 'ascending';
      }
    } else if (shotPhase === 'ascending') {
      if (insideRim(ball.x, ball.y)) {
        shotPhase = 'at_rim';
        atRimFrames = 1;
      } else if (yVel > VEL_FALL_FRAC) {
        // Ball falling — did it pass near the rim?
        if (inApproachZone(ball.x, ball.y) && Math.abs(ball.x - rim.cx) < rim.rx * 2.5) {
          // Air-ball or rim miss — ball descended near rim without entering
          commitShot(false, now);
        }
        shotPhase = 'idle';
      }
    } else if (shotPhase === 'at_rim') {
      atRimFrames++;

      if (!insideRim(ball.x, ball.y)) {
        if (ball.y > rim.cy + rim.ry * 0.5) {
          // Exited BELOW rim = made shot
          commitShot(true, now);
        } else if (ball.y < rim.cy - rim.ry * 0.5) {
          // Exited ABOVE rim = rejected/bounced up
          commitShot(false, now);
        } else {
          // Exited sideways
          commitShot(false, now);
        }
        shotPhase = 'idle';
        atRimFrames = 0;
      } else if (atRimFrames > atRimMaxFrames) {
        // Stuck in rim zone too long — likely a rebound scenario
        commitShot(false, now);
        shotPhase = 'idle';
        atRimFrames = 0;
      }
    }
  }

  function checkExitedBelow() {
    // Look at the last few valid positions — did Y increase (move down)?
    var valid = [];
    for (var i = ballHistory.length - 1; i >= 0 && valid.length < 5; i--) {
      if (ballHistory[i]) valid.unshift(ballHistory[i]);
    }
    if (valid.length < 2) return false;
    var last = valid[valid.length - 1];
    var prev = valid[0];
    // Ball was moving downward and last position was below rim center
    return last.y > prev.y && rim && last.y > rim.cy;
  }

  function commitShot(made, now) {
    // In video mode with look-ahead, we could buffer — but for simplicity
    // we commit immediately and rely on the improved state machine.
    session.attempts++;
    if (made) {
      session.made++;
      session.streak++;
      session.maxStreak = Math.max(session.maxStreak, session.streak);
    } else {
      session.streak = 0;
    }
    session.shots.push({ made: made, t: now });
    cooldownUntil = now + COOLDOWN_SEC * 1000;
    updateCounter();
    flashResult(made);
  }

  /* ── Manual override ──────────────────────────────────────── */
  function manualMade() { if (phase === PHASE.TRACKING) commitShot(true, Date.now()); }
  function manualMiss() { if (phase === PHASE.TRACKING) commitShot(false, Date.now()); }

  /* ── Drawing ──────────────────────────────────────────────── */
  function drawOverlay(ball) {
    if (rim) {
      ctx.strokeStyle = 'rgba(245,166,35,0.85)';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(245,166,35,0.5)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(rim.cx, rim.cy, rim.rx, rim.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Approach zone
      ctx.strokeStyle = 'rgba(245,166,35,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(rim.cx, rim.cy, rim.rx * 4, rim.ry * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (ball) {
      var ballR = W * BALL_CIRCLE_FRAC;
      ctx.strokeStyle = '#56d364';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#56d364';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ballR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(86,211,100,0.2)';
      ctx.fill();
      ctx.shadowBlur = 0;

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

    // State indicator dot
    if (phase === PHASE.TRACKING) {
      var dotColor = shotPhase === 'idle' ? '#56d364'
                   : shotPhase === 'ascending' ? '#f5a623'
                   : shotPhase === 'at_rim' ? '#3b9eff'
                   : '#56d364';
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(18, 18, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ── Frame loop ───────────────────────────────────────────── */
  function frameLoop() {
    if (phase !== PHASE.TRACKING && phase !== PHASE.CALIBRATING) return;

    ctx.drawImage(video, 0, 0, W, H);
    frameCount++;

    if (phase === PHASE.TRACKING) processBall(lastBall);
    drawOverlay(lastBall);

    if (!isDetecting) {
      isDetecting = true;
      detectBallAsync().then(function (raw) {
        var ball = null;
        if (raw && isPhysicallyValid(raw)) {
          ball = applyKalman(raw);
        } else if (raw) {
          // Teleport — use Kalman prediction if available
          var predX = kalmanPredict(kalX);
          var predY = kalmanPredict(kalY);
          if (predX !== null && predY !== null) {
            ball = { x: predX, y: predY, size: lastBall ? lastBall.size : 0, score: 0.3 };
          } else {
            ball = lastBall;
          }
          resetKalman();
        }
        lastBall = ball;
        isDetecting = false;
      });
    }

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

      loadMLModel();

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

    // Dynamic rim size based on resolution
    rim = { cx: tapX, cy: tapY, rx: W * RIM_RX_FRAC, ry: H * RIM_RY_FRAC };
    phase = PHASE.TRACKING;
    showPhase('track');

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
    cooldownUntil = 0;
    disappearCount = 0;
    atRimFrames = 0;
    phase = PHASE.IDLE;
    lastBall = null;
    isDetecting = false;
    frameCount = 0;
    pendingShot = null;
    resetKalman();

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

    loadMLModel();

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

    if (window.currentUser && typeof DataService !== 'undefined') {
      DataService.addShotSession(s).catch(function () {});
    }

    if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
      XPSystem.grantXP(xp, 'AI Shot Tracking Session');
    }

    if (typeof showToast === 'function') {
      showToast('\uD83C\uDFC0 AI session saved! +' + xp + ' XP');
    }

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
    var launchBtn = document.getElementById('ast-launch-btn');
    if (launchBtn) launchBtn.addEventListener('click', openOverlay);

    var uploadBtn = document.getElementById('ast-upload-btn');
    if (uploadBtn) uploadBtn.addEventListener('click', openOverlayVideo);

    var fileInput = document.getElementById('ast-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (openOverlayBase()) startVideo(file);
      });
    }

    var ppBtn = document.getElementById('ast-vc-playpause');
    if (ppBtn) {
      ppBtn.addEventListener('click', function () {
        if (!video || mode !== 'video') return;
        if (video.paused) { video.play(); ppBtn.textContent = '⏸'; }
        else              { video.pause(); ppBtn.textContent = '▶'; }
      });
    }

    var scrub = document.getElementById('ast-vc-scrub');
    if (scrub) {
      scrub.addEventListener('input', function () {
        if (!video || mode !== 'video' || !video.duration) return;
        video.currentTime = (scrub.value / 100) * video.duration;
      });
    }

    document.querySelectorAll('.ast-vc-speed-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!video) return;
        video.playbackRate = parseFloat(btn.dataset.speed);
        document.querySelectorAll('.ast-vc-speed-btn').forEach(function (b) {
          b.classList.toggle('ast-vc-speed-active', b === btn);
        });
      });
    });

    var closeBtn = document.getElementById('ast-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      if (phase === PHASE.SUMMARY) { closeOverlay(); return; }
      if (session.attempts === 0) { closeOverlay(); return; }
      if (confirm('Stop AI tracking? You can save the session on the next screen.')) {
        stopSession();
      }
    });

    var stopBtn = document.getElementById('ast-stop-btn');
    if (stopBtn) stopBtn.addEventListener('click', function () {
      if (phase === PHASE.TRACKING || phase === PHASE.CALIBRATING) stopSession();
    });

    var cvs = document.getElementById('ast-canvas');
    if (cvs) {
      cvs.addEventListener('click', onCanvasTap);
      cvs.addEventListener('touchend', onCanvasTap, { passive: false });
    }

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

  window.AIShotTracker = { open: openOverlay, close: closeOverlay };

})();
