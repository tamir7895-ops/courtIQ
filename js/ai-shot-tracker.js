/* ============================================================
   AI SHOT TRACKER — /js/ai-shot-tracker.js
   Camera-based automatic shot detection using color segmentation.
   Tracks orange basketball, detects made/miss via rim zone.
   No external dependencies — pure browser APIs + canvas.
   ============================================================ */
(function () {
  'use strict';

  /* ── Constants ────────────────────────────────────────────── */
  var RIM_RX_DEFAULT = 55;
  var RIM_RY_DEFAULT = 20;
  var MIN_BLOB = 80;   // Min orange pixels to count as ball (sampled every 2px)
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

  /* ── Shot type ───────────────────────────────────────────── */
  var shotType = 'fg';   // 'fg' | '3pt' | 'ft'

  /* ── Adjustable rim size ─────────────────────────────────── */
  var rimScale = 1.0;    // multiplier from slider (0.5–2.0)

  /* ── ML state ─────────────────────────────────────────────── */
  var tfModel    = null;
  var mlReady    = false;
  var mlLoading  = false;
  var isDetecting = false;
  var lastBall   = null;
  var frameCount = 0;

  /* ── Kalman filter state (x and y independently) ─────────── */
  var kalX = { x: null, p: 1.0, R: 18, Q: 0.8 };
  var kalY = { x: null, p: 1.0, R: 18, Q: 0.8 };

  var rim = null;       // { cx, cy, rx, ry }
  var ballHistory = []; // array of {x,y} or null
  var shotPhase = 'idle'; // idle | ascending | at_rim
  var cooldownFrames = 0;

  var session = {
    attempts: 0, made: 0, shots: [],
    startTime: 0, streak: 0, maxStreak: 0
  };

  /* ── Audio context (lazy init) ──────────────────────────── */
  var audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { /* silent — no audio support */ }
    }
    return audioCtx;
  }

  function playTone(freq, duration, type) {
    var ac = getAudioCtx();
    if (!ac) return;
    try {
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + duration);
    } catch (e) { /* silent */ }
  }

  function playMadeSound() {
    playTone(880, 0.12, 'sine');
    setTimeout(function () { playTone(1320, 0.18, 'sine'); }, 80);
  }

  function playMissSound() {
    playTone(280, 0.25, 'triangle');
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* silent */ }
    }
  }

  /* ── Kalman filter (1D) ───────────────────────────────────── */
  function kalmanUpdate(kal, z) {
    if (kal.x === null) { kal.x = z; return z; }
    kal.p += kal.Q;
    var k = kal.p / (kal.p + kal.R);
    kal.x += k * (z - kal.x);
    kal.p *= (1 - k);
    return kal.x;
  }

  function applyKalman(ball) {
    return { x: kalmanUpdate(kalX, ball.x), y: kalmanUpdate(kalY, ball.y),
             size: ball.size, score: ball.score || 1 };
  }

  function resetKalman() {
    kalX.x = null; kalX.p = 1.0;
    kalY.x = null; kalY.p = 1.0;
  }

  /* ── Physics validation (no teleportation) ────────────────── */
  function isPhysicallyValid(ball) {
    if (!lastBall || !ball) return true;
    var dx = ball.x - lastBall.x, dy = ball.y - lastBall.y;
    return Math.sqrt(dx * dx + dy * dy) < W * 0.22;
  }

  /* ── ML model loading ─────────────────────────────────────── */
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
    if (state === 'loading') { el.textContent = 'Loading AI model\u2026'; el.style.display = ''; }
    else if (state === 'ready') { el.textContent = 'AI Active'; el.style.display = ''; }
    else { el.style.display = 'none'; }
  }

  /* ── ML-powered detection (async, falls back to color) ────── */
  function detectBallAsync() {
    if (mlReady && tfModel) {
      return tfModel.detect(video).then(function (preds) {
        var best = null, bestScore = 0.3;
        for (var i = 0; i < preds.length; i++) {
          if (preds[i].class === 'sports ball' && preds[i].score > bestScore) {
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

  /* ── Improved Color detection ──────────────────────────────── */
  function isOrangeBall(r, g, b) {
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if (max < 100) return false;
    var delta = max - min;
    if (delta < 40) return false;
    var s = delta / max;
    if (s < 0.45) return false;

    // Hue (0-360)
    var h;
    if (max === r)      h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else                h = 60 * ((r - g) / delta + 4);
    if (h < 0) h += 360;

    // Orange hue range: 10-42 deg
    if (h < 10 || h > 42) return false;

    // Skin tone rejection: skin has lower saturation and higher green/blue ratio
    // Basketball orange is more vivid (higher saturation) and red-dominant
    if (s < 0.55 && g > r * 0.65) return false;

    // Reject brownish tones (low brightness + low saturation)
    var brightness = (r + g + b) / 3;
    if (brightness < 110 && s < 0.6) return false;

    return true;
  }

  function detectBallColor() {
    if (!canvas || !ctx) return null;
    var imageData = ctx.getImageData(0, 0, W, H);
    var data = imageData.data;
    var w = imageData.width, h = imageData.height;

    // Search zone: upper 75% of frame (ball unlikely at very bottom)
    var searchH = Math.round(h * 0.75);

    var sumX = 0, sumY = 0, count = 0;
    // Collect pixel positions for circularity check
    var minPX = w, maxPX = 0, minPY = h, maxPY = 0;

    for (var y = 0; y < searchH; y += 2) {
      for (var x = 0; x < w; x += 2) {
        var i = (y * w + x) * 4;
        if (isOrangeBall(data[i], data[i + 1], data[i + 2])) {
          sumX += x; sumY += y; count++;
          if (x < minPX) minPX = x;
          if (x > maxPX) maxPX = x;
          if (y < minPY) minPY = y;
          if (y > maxPY) maxPY = y;
        }
      }
    }

    if (count < MIN_BLOB || count > MAX_BLOB) return null;

    // Circularity check: bounding box aspect ratio should be roughly square (0.4-2.5)
    var blobW = maxPX - minPX;
    var blobH = maxPY - minPY;
    if (blobW > 0 && blobH > 0) {
      var aspect = blobW / blobH;
      if (aspect < 0.4 || aspect > 2.5) return null;
    }

    // Fill ratio: orange pixels should fill at least 25% of bounding box
    var bboxArea = ((blobW / 2) + 1) * ((blobH / 2) + 1); // adjusted for 2px sampling
    if (bboxArea > 0 && count / bboxArea < 0.25) return null;

    return { x: sumX / count, y: sumY / count, size: count, score: 0.5 };
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
    return y > rim.cy - rim.ry * 5 && y < rim.cy + rim.ry * 1.5;
  }

  /* ── Shot detection state machine ────────────────────────── */
  function processBall(ball) {
    if (cooldownFrames > 0) { cooldownFrames--; return; }

    ballHistory.push(ball ? { x: ball.x, y: ball.y } : null);
    if (ballHistory.length > MAX_HIST) ballHistory.shift();

    if (!ball) {
      if (shotPhase === 'at_rim') {
        recordShot(true);
        shotPhase = 'idle';
        cooldownFrames = COOLDOWN;
      } else if (shotPhase === 'ascending') {
        shotPhase = 'idle';
      }
      return;
    }

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
      playMadeSound();
      vibrate([50, 30, 50]);
    } else {
      session.streak = 0;
      playMissSound();
      vibrate([120]);
    }
    // Store shot with position and type
    var pos = lastBall ? { x: lastBall.x / W, y: lastBall.y / H } : null;
    session.shots.push({ made: made, t: Date.now(), type: shotType, pos: pos });
    updateCounter();
    flashResult(made);
  }

  /* ── Manual override ──────────────────────────────────────── */
  function manualMade() { if (phase === PHASE.TRACKING) recordShot(true); }
  function manualMiss() { if (phase === PHASE.TRACKING) recordShot(false); }

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

      ctx.strokeStyle = 'rgba(245,166,35,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(rim.cx, rim.cy, rim.rx * 1.8, rim.ry * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

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

      ctx.fillStyle = '#56d364';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

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

    ctx.drawImage(video, 0, 0, W, H);
    frameCount++;

    if (phase === PHASE.TRACKING && lastBall) processBall(lastBall);
    drawOverlay(lastBall);

    if (!isDetecting) {
      isDetecting = true;
      detectBallAsync().then(function (raw) {
        var ball = null;
        if (raw && isPhysicallyValid(raw)) {
          ball = applyKalman(raw);
        } else if (raw) {
          ball = lastBall;
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
        : '\u2014%';
    }
  }

  function flashResult(made) {
    var el = document.getElementById('ast-flash');
    if (!el) return;
    el.textContent = made ? '+ MADE!' : '\u00d7 MISS';
    el.className = 'ast-flash ' + (made ? 'ast-flash-made' : 'ast-flash-miss') + ' ast-flash-show';
    setTimeout(function () { el.classList.remove('ast-flash-show'); }, 900);
  }

  function showPhase(p) {
    var calibEl = document.getElementById('ast-calib-msg');
    var trackEl = document.getElementById('ast-track-msg');
    if (calibEl) calibEl.style.display = p === 'calibrate' ? '' : 'none';
    if (trackEl) trackEl.style.display = p === 'track' ? '' : 'none';

    // Show/hide rim slider during calibration
    var sliderWrap = document.getElementById('ast-rim-slider-wrap');
    if (sliderWrap) sliderWrap.style.display = p === 'calibrate' ? '' : 'none';
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

    rim = { cx: tapX, cy: tapY, rx: RIM_RX_DEFAULT * rimScale, ry: RIM_RY_DEFAULT * rimScale };
    phase = PHASE.TRACKING;
    showPhase('track');

    // Resume AudioContext on user gesture (required by browsers)
    var ac = getAudioCtx();
    if (ac && ac.state === 'suspended') ac.resume();

    if (mode === 'video' && video) {
      video.play();
      var ppBtn = document.getElementById('ast-vc-playpause');
      if (ppBtn) ppBtn.textContent = '\u23f8';
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
    lastBall = null;
    isDetecting = false;
    frameCount = 0;
    resetKalman();

    var cameraView  = document.getElementById('ast-camera-view');
    var summaryView = document.getElementById('ast-summary-view');
    if (cameraView)  cameraView.style.display  = '';
    if (summaryView) summaryView.style.display = 'none';

    // Reset rim slider
    var slider = document.getElementById('ast-rim-slider');
    if (slider) { slider.value = 100; rimScale = 1.0; }
    var sliderVal = document.getElementById('ast-rim-slider-val');
    if (sliderVal) sliderVal.textContent = '100%';

    updateCounter();
    updateShotTypeUI();
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
      if (ppBtn) ppBtn.textContent = '\u25b6';
      animFrame = requestAnimationFrame(frameLoop);
    };

    video.ontimeupdate = function () {
      var scrub = document.getElementById('ast-vc-scrub');
      if (scrub && video.duration) {
        scrub.value = (video.currentTime / video.duration) * 100;
      }
      var ppBtn = document.getElementById('ast-vc-playpause');
      if (ppBtn) ppBtn.textContent = video.paused ? '\u25b6' : '\u23f8';
    };

    video.onended = function () {
      if (phase === PHASE.TRACKING || phase === PHASE.CALIBRATING) stopSession();
    };

    video.load();
  }

  /* ── Stop -> Summary ───────────────────────────────────────── */
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

  /* ── Shot Chart (half-court canvas) ─────────────────────── */
  function buildShotChart() {
    var shotsWithPos = session.shots.filter(function (s) { return s.pos; });
    if (shotsWithPos.length === 0) return '';

    var cw = 300, ch = 200;
    // Build SVG half-court with shot dots
    var svg = '<svg viewBox="0 0 ' + cw + ' ' + ch + '" class="ast-shot-chart" xmlns="http://www.w3.org/2000/svg">';

    // Court outline
    svg += '<rect x="2" y="2" width="' + (cw - 4) + '" height="' + (ch - 4) + '" rx="4" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>';

    // Paint area
    svg += '<rect x="' + (cw / 2 - 50) + '" y="0" width="100" height="60" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>';

    // Free throw circle
    svg += '<circle cx="' + (cw / 2) + '" cy="60" r="30" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';

    // 3-point arc
    svg += '<path d="M 40 0 Q 40 140 ' + (cw / 2) + ' 150 Q ' + (cw - 40) + ' 140 ' + (cw - 40) + ' 0" fill="none" stroke="rgba(245,166,35,0.15)" stroke-width="1"/>';

    // Rim
    svg += '<circle cx="' + (cw / 2) + '" cy="18" r="6" fill="none" stroke="rgba(245,166,35,0.6)" stroke-width="1.5"/>';

    // Plot shots
    for (var i = 0; i < shotsWithPos.length; i++) {
      var s = shotsWithPos[i];
      var sx = s.pos.x * cw;
      var sy = s.pos.y * ch;
      var color = s.made ? '#56d364' : '#f85149';
      var opacity = s.made ? '0.8' : '0.6';
      svg += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="4" fill="' + color + '" opacity="' + opacity + '"/>';
    }

    svg += '</svg>';
    return '<div class="ast-sum-chart-wrap">' +
      '<div class="ast-sum-chart-label">Shot Chart</div>' +
      svg +
      '</div>';
  }

  /* ── Shot type breakdown for summary ──────────────────────── */
  function buildTypeBreakdown() {
    if (session.shots.length === 0) return '';

    var types = { fg: { made: 0, att: 0 }, '3pt': { made: 0, att: 0 }, ft: { made: 0, att: 0 } };
    for (var i = 0; i < session.shots.length; i++) {
      var t = session.shots[i].type || 'fg';
      types[t].att++;
      if (session.shots[i].made) types[t].made++;
    }

    var html = '<div class="ast-sum-type-breakdown">';
    var labels = { fg: 'FG', '3pt': '3PT', ft: 'FT' };
    var colors = { fg: '#4ca3ff', '3pt': '#bc8cff', ft: '#56d364' };

    for (var key in labels) {
      if (types[key].att > 0) {
        var p = Math.round((types[key].made / types[key].att) * 100);
        html += '<div class="ast-sum-type-item">' +
          '<span class="ast-sum-type-dot" style="background:' + colors[key] + '"></span>' +
          '<span class="ast-sum-type-label">' + labels[key] + '</span>' +
          '<span class="ast-sum-type-val">' + types[key].made + '/' + types[key].att + '</span>' +
          '<span class="ast-sum-type-pct" style="color:' + colors[key] + '">' + p + '%</span>' +
          '</div>';
      }
    }
    html += '</div>';
    return html;
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

      buildTypeBreakdown() +

      buildShotChart() +

      '<div class="ast-sum-xp-box">' +
        '<div class="ast-sum-xp-val">\u26a1 +' + xp + ' XP</div>' +
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

    // Count by type
    var typeCounts = { fg: { made: 0, missed: 0 }, '3pt': { made: 0, missed: 0 }, ft: { made: 0, missed: 0 } };
    for (var i = 0; i < session.shots.length; i++) {
      var t = session.shots[i].type || 'fg';
      if (session.shots[i].made) typeCounts[t].made++;
      else typeCounts[t].missed++;
    }

    var s = {
      id:            Date.now(),
      date:          new Date().toISOString(),
      fg_made:       typeCounts.fg.made,
      fg_missed:     typeCounts.fg.missed,
      three_made:    typeCounts['3pt'].made,
      three_missed:  typeCounts['3pt'].missed,
      ft_made:       typeCounts.ft.made,
      ft_missed:     typeCounts.ft.missed,
      session_type:  'ai_tracking',
      accuracy:      pct,
      max_streak:    session.maxStreak
    };

    // Write to localStorage
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

    // Refresh history panel
    renderHistory();

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

  /* ── Shot type toggle UI ─────────────────────────────────── */
  function updateShotTypeUI() {
    document.querySelectorAll('.ast-type-btn').forEach(function (btn) {
      btn.classList.toggle('ast-type-active', btn.dataset.type === shotType);
    });
  }

  /* ── History panel ───────────────────────────────────────── */
  function renderHistory() {
    var container = document.getElementById('ast-history-list');
    if (!container) return;

    var sessions = [];
    try {
      var raw = localStorage.getItem('courtiq-shot-sessions');
      if (raw) sessions = JSON.parse(raw);
    } catch (e) { return; }

    // Filter AI tracking sessions only
    var aiSessions = sessions.filter(function (s) { return s.session_type === 'ai_tracking'; });

    if (aiSessions.length === 0) {
      container.innerHTML = '<div class="ast-hist-empty">No AI tracking sessions yet. Start one above!</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < Math.min(aiSessions.length, 15); i++) {
      var s = aiSessions[i];
      var totalMade = (s.fg_made || 0) + (s.three_made || 0) + (s.ft_made || 0);
      var totalMissed = (s.fg_missed || 0) + (s.three_missed || 0) + (s.ft_missed || 0);
      var totalAtt = totalMade + totalMissed;
      var pct = totalAtt > 0 ? Math.round((totalMade / totalAtt) * 100) : 0;
      var hex = pctHex(pct);

      var dateStr = '';
      try {
        var d = new Date(s.date);
        dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch (e) { dateStr = 'Unknown'; }

      var details = [];
      if (s.fg_made > 0 || s.fg_missed > 0) details.push('FG: ' + s.fg_made + '/' + ((s.fg_made || 0) + (s.fg_missed || 0)));
      if (s.three_made > 0 || s.three_missed > 0) details.push('3PT: ' + s.three_made + '/' + ((s.three_made || 0) + (s.three_missed || 0)));
      if (s.ft_made > 0 || s.ft_missed > 0) details.push('FT: ' + s.ft_made + '/' + ((s.ft_made || 0) + (s.ft_missed || 0)));

      html += '<div class="ast-hist-item">' +
        '<div class="ast-hist-date">' + dateStr + '</div>' +
        '<div class="ast-hist-main">' +
          '<span class="ast-hist-score">' + totalMade + '/' + totalAtt + '</span>' +
          (details.length > 0 ? '<span class="ast-hist-details">' + details.join(' \u00b7 ') + '</span>' : '') +
        '</div>' +
        '<div class="ast-hist-pct" style="color:' + hex + '">' + pct + '%</div>' +
        (s.max_streak > 0 ? '<div class="ast-hist-streak">' + s.max_streak + ' streak</div>' : '') +
      '</div>';
    }

    container.innerHTML = html;
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    // Live camera button
    var launchBtn = document.getElementById('ast-launch-btn');
    if (launchBtn) launchBtn.addEventListener('click', openOverlay);

    // Upload video button
    var uploadBtn = document.getElementById('ast-upload-btn');
    if (uploadBtn) uploadBtn.addEventListener('click', openOverlayVideo);

    // Hidden file input
    var fileInput = document.getElementById('ast-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (openOverlayBase()) startVideo(file);
      });
    }

    // Video playback controls
    var ppBtn = document.getElementById('ast-vc-playpause');
    if (ppBtn) {
      ppBtn.addEventListener('click', function () {
        if (!video || mode !== 'video') return;
        if (video.paused) { video.play(); ppBtn.textContent = '\u23f8'; }
        else              { video.pause(); ppBtn.textContent = '\u25b6'; }
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

    // Close (X) button
    var closeBtn = document.getElementById('ast-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      if (phase === PHASE.SUMMARY) { closeOverlay(); return; }
      if (session.attempts === 0) { closeOverlay(); return; }
      if (confirm('Stop AI tracking? You can save the session on the next screen.')) {
        stopSession();
      }
    });

    // Stop -> summary button
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

    // Shot type buttons
    document.querySelectorAll('.ast-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        shotType = btn.dataset.type || 'fg';
        updateShotTypeUI();
      });
    });

    // Rim size slider
    var rimSlider = document.getElementById('ast-rim-slider');
    if (rimSlider) {
      rimSlider.addEventListener('input', function () {
        rimScale = parseInt(rimSlider.value, 10) / 100;
        var valEl = document.getElementById('ast-rim-slider-val');
        if (valEl) valEl.textContent = rimSlider.value + '%';
        // Update rim if already placed
        if (rim) {
          rim.rx = RIM_RX_DEFAULT * rimScale;
          rim.ry = RIM_RY_DEFAULT * rimScale;
        }
      });
    }

    // Render history on load
    renderHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.AIShotTracker = { open: openOverlay, close: closeOverlay };

})();
