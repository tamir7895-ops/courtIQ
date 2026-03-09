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

  /* ── Court size presets ─────────────────────────────────── */
  var COURT_PRESETS = {
    nba:  { label: 'NBA',  threeLineFt: 23.75, ftLineFt: 15, courtW: 50, courtL: 94 },
    fiba: { label: 'FIBA', threeLineFt: 22.15, ftLineFt: 15.09, courtW: 49.21, courtL: 91.86 },
    hs:   { label: 'HS',   threeLineFt: 19.75, ftLineFt: 15, courtW: 50, courtL: 84 }
  };
  var courtPreset = 'nba';

  /* ── Shot arc analysis state ───────────────────────────── */
  var shotArcData = [];  // { peakY, startY, endY, angle, made }

  /* ── Shot replay state ─────────────────────────────────── */
  var replayTrajectory = null; // array of {x,y} from last shot
  var replayFrame = 0;
  var replayTimer = null;

  /* ── HORSE competition state ───────────────────────────── */
  var horseMode = false;
  var horsePlayers = [
    { name: 'Player 1', letters: '', score: [] },
    { name: 'Player 2', letters: '', score: [] }
  ];
  var horseCurrentPlayer = 0;
  var horseWord = 'HORSE';
  var horseChallengeActive = false; // P1 made a shot, P2 must match

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

    // Compute shot arc data from trajectory
    var arcInfo = computeArc(ballHistory);
    session.shots.push({ made: made, t: Date.now(), type: shotType, pos: pos, arc: arcInfo });

    // Store arc data for analysis
    if (arcInfo) {
      shotArcData.push({ peakY: arcInfo.peakY, startY: arcInfo.startY, endY: arcInfo.endY, angle: arcInfo.angle, made: made });
    }

    // Trigger shot replay animation
    triggerReplay(ballHistory);

    // HORSE mode logic
    if (horseMode) processHorseShot(made);

    updateCounter();
    flashResult(made);
  }

  /* ── Shot Arc Analysis ──────────────────────────────────── */
  function computeArc(history) {
    var pts = history.filter(Boolean);
    if (pts.length < 5) return null;

    // Find peak (lowest y = highest point on screen)
    var peakY = Infinity, peakIdx = 0;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i].y < peakY) { peakY = pts[i].y; peakIdx = i; }
    }

    var startY = pts[0].y;
    var endY = pts[pts.length - 1].y;

    // Arc height in pixels relative to start
    var arcHeight = startY - peakY;
    // Horizontal distance
    var dx = Math.abs(pts[pts.length - 1].x - pts[0].x);
    // Entry angle (angle of descent at end of trajectory)
    var angle = 0;
    if (pts.length >= 3) {
      var last = pts[pts.length - 1];
      var prev = pts[Math.max(0, pts.length - 4)];
      var dxEnd = last.x - prev.x;
      var dyEnd = last.y - prev.y;
      angle = Math.round(Math.atan2(Math.abs(dyEnd), Math.abs(dxEnd)) * (180 / Math.PI));
    }

    // Classify arc type
    var arcType = 'flat';
    if (arcHeight > H * 0.15) arcType = 'high';
    else if (arcHeight > H * 0.08) arcType = 'medium';

    return { peakY: peakY / H, startY: startY / H, endY: endY / H, angle: angle, arcHeight: arcHeight, arcType: arcType, dx: dx };
  }

  /* ── Shot Replay Animation ─────────────────────────────── */
  function triggerReplay(history) {
    var pts = history.filter(Boolean);
    if (pts.length < 4) return;
    replayTrajectory = pts.slice();
    replayFrame = 0;
    if (replayTimer) clearInterval(replayTimer);
    replayTimer = setInterval(function () {
      replayFrame++;
      if (replayFrame > replayTrajectory.length + 10) {
        clearInterval(replayTimer);
        replayTimer = null;
        replayTrajectory = null;
      }
    }, 35);
  }

  function drawReplay() {
    if (!replayTrajectory || replayTrajectory.length < 2) return;
    var count = Math.min(replayFrame, replayTrajectory.length);
    if (count < 2) return;

    // Draw ghosted arc
    ctx.save();
    ctx.strokeStyle = 'rgba(59,158,255,0.6)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(59,158,255,0.4)';
    ctx.shadowBlur = 10;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(replayTrajectory[0].x, replayTrajectory[0].y);
    for (var i = 1; i < count; i++) {
      ctx.lineTo(replayTrajectory[i].x, replayTrajectory[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw animated ball dot at current position
    if (count > 0 && count <= replayTrajectory.length) {
      var p = replayTrajectory[count - 1];
      ctx.fillStyle = 'rgba(59,158,255,0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* ── HORSE Competition Mode ──────────────────────────────── */
  function processHorseShot(made) {
    var cp = horseCurrentPlayer;
    horsePlayers[cp].score.push(made);

    if (horseChallengeActive) {
      // Player 2 is matching Player 1's shot
      if (!made) {
        // Failed to match — gets a letter
        horsePlayers[cp].letters += horseWord[horsePlayers[cp].letters.length] || '';
      }
      horseChallengeActive = false;
      // Switch back to Player 1
      horseCurrentPlayer = 0;
    } else {
      // Player 1 shooting
      if (made) {
        // Challenge — Player 2 must match
        horseChallengeActive = true;
        horseCurrentPlayer = 1;
      }
      // If missed, just switch turns (no challenge)
      // Player 1 stays, no letter given
    }

    updateHorseUI();

    // Check for game over
    for (var i = 0; i < horsePlayers.length; i++) {
      if (horsePlayers[i].letters.length >= horseWord.length) {
        endHorseGame(i);
        return;
      }
    }
  }

  function updateHorseUI() {
    var el = document.getElementById('ast-horse-status');
    if (!el) return;

    var html = '<div class="ast-horse-players">';
    for (var i = 0; i < horsePlayers.length; i++) {
      var active = i === horseCurrentPlayer ? ' ast-horse-active' : '';
      var letters = horsePlayers[i].letters || '';
      var display = '';
      for (var j = 0; j < horseWord.length; j++) {
        display += j < letters.length
          ? '<span class="ast-horse-letter-lit">' + horseWord[j] + '</span>'
          : '<span class="ast-horse-letter-dim">' + horseWord[j] + '</span>';
      }
      html += '<div class="ast-horse-player' + active + '">' +
        '<div class="ast-horse-name">' + horsePlayers[i].name + '</div>' +
        '<div class="ast-horse-letters">' + display + '</div>' +
      '</div>';
    }
    html += '</div>';
    if (horseChallengeActive) {
      html += '<div class="ast-horse-challenge">Match the shot!</div>';
    }
    html += '<div class="ast-horse-turn">' + horsePlayers[horseCurrentPlayer].name + '\'s turn</div>';
    el.innerHTML = html;
    el.style.display = '';
  }

  function endHorseGame(loserIdx) {
    var winnerIdx = loserIdx === 0 ? 1 : 0;
    var el = document.getElementById('ast-horse-status');
    if (el) {
      el.innerHTML = '<div class="ast-horse-gameover">' +
        '<div class="ast-horse-winner">' + horsePlayers[winnerIdx].name + ' Wins!</div>' +
        '<div class="ast-horse-loser">' + horsePlayers[loserIdx].name + ' spelled ' + horseWord + '</div>' +
      '</div>';
    }
    horseMode = false;
  }

  function startHorseMode() {
    var p1 = (document.getElementById('ast-horse-p1') || {}).value || 'Player 1';
    var p2 = (document.getElementById('ast-horse-p2') || {}).value || 'Player 2';
    horsePlayers = [
      { name: p1, letters: '', score: [] },
      { name: p2, letters: '', score: [] }
    ];
    horseCurrentPlayer = 0;
    horseChallengeActive = false;
    horseMode = true;
    var setup = document.getElementById('ast-horse-setup');
    if (setup) setup.style.display = 'none';
    updateHorseUI();
  }

  function toggleHorseSetup() {
    var setup = document.getElementById('ast-horse-setup');
    if (!setup) return;
    setup.style.display = setup.style.display === 'none' ? '' : 'none';
    // Reset horse mode if toggling off
    if (setup.style.display === 'none' && horseMode) {
      horseMode = false;
      var status = document.getElementById('ast-horse-status');
      if (status) status.style.display = 'none';
    }
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

    // Draw shot replay animation
    drawReplay();
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

    // Reset arc/replay/horse state
    shotArcData = [];
    replayTrajectory = null;
    if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
    horseMode = false;
    horsePlayers = [
      { name: 'Player 1', letters: '', score: [] },
      { name: 'Player 2', letters: '', score: [] }
    ];
    horseCurrentPlayer = 0;
    horseChallengeActive = false;

    var horseStatus = document.getElementById('ast-horse-status');
    if (horseStatus) horseStatus.style.display = 'none';
    var horseSetup = document.getElementById('ast-horse-setup');
    if (horseSetup) horseSetup.style.display = 'none';

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

  /* ── Arc Analysis for Summary ─────────────────────────────── */
  function buildArcAnalysis() {
    if (shotArcData.length < 2) return '';
    var totalAngle = 0, madeAngle = 0, madeCount = 0, missAngle = 0, missCount = 0;
    var highMade = 0, highTotal = 0, medMade = 0, medTotal = 0, flatMade = 0, flatTotal = 0;

    for (var i = 0; i < shotArcData.length; i++) {
      var d = shotArcData[i];
      totalAngle += d.angle;
      if (d.made) { madeAngle += d.angle; madeCount++; }
      else { missAngle += d.angle; missCount++; }
    }

    // Correlate arc type with session shots
    for (var j = 0; j < session.shots.length; j++) {
      var s = session.shots[j];
      if (!s.arc) continue;
      if (s.arc.arcType === 'high') { highTotal++; if (s.made) highMade++; }
      else if (s.arc.arcType === 'medium') { medTotal++; if (s.made) medMade++; }
      else { flatTotal++; if (s.made) flatMade++; }
    }

    var avgAngle = Math.round(totalAngle / shotArcData.length);
    var avgMade = madeCount > 0 ? Math.round(madeAngle / madeCount) : 0;
    var avgMiss = missCount > 0 ? Math.round(missAngle / missCount) : 0;

    var html = '<div class="ast-arc-analysis">' +
      '<div class="ast-arc-title">Shot Arc Analysis</div>' +
      '<div class="ast-arc-stats">' +
        '<div class="ast-arc-stat">' +
          '<div class="ast-arc-val">' + avgAngle + '\u00b0</div>' +
          '<div class="ast-arc-lbl">Avg Entry Angle</div>' +
        '</div>';
    if (madeCount > 0) {
      html += '<div class="ast-arc-stat">' +
        '<div class="ast-arc-val" style="color:#56d364">' + avgMade + '\u00b0</div>' +
        '<div class="ast-arc-lbl">Avg (Made)</div>' +
      '</div>';
    }
    if (missCount > 0) {
      html += '<div class="ast-arc-stat">' +
        '<div class="ast-arc-val" style="color:#f85149">' + avgMiss + '\u00b0</div>' +
        '<div class="ast-arc-lbl">Avg (Miss)</div>' +
      '</div>';
    }
    html += '</div>';

    // Arc type breakdown
    if (highTotal + medTotal + flatTotal > 0) {
      html += '<div class="ast-arc-breakdown">';
      if (highTotal > 0) {
        var hp = Math.round((highMade / highTotal) * 100);
        html += '<div class="ast-arc-row"><span class="ast-arc-type">High Arc</span><span class="ast-arc-bar-wrap"><span class="ast-arc-bar" style="width:' + hp + '%;background:#56d364"></span></span><span class="ast-arc-pct">' + hp + '% (' + highMade + '/' + highTotal + ')</span></div>';
      }
      if (medTotal > 0) {
        var mp = Math.round((medMade / medTotal) * 100);
        html += '<div class="ast-arc-row"><span class="ast-arc-type">Medium</span><span class="ast-arc-bar-wrap"><span class="ast-arc-bar" style="width:' + mp + '%;background:#f5a623"></span></span><span class="ast-arc-pct">' + mp + '% (' + medMade + '/' + medTotal + ')</span></div>';
      }
      if (flatTotal > 0) {
        var fp = Math.round((flatMade / flatTotal) * 100);
        html += '<div class="ast-arc-row"><span class="ast-arc-type">Flat</span><span class="ast-arc-bar-wrap"><span class="ast-arc-bar" style="width:' + fp + '%;background:#f85149"></span></span><span class="ast-arc-pct">' + fp + '% (' + flatMade + '/' + flatTotal + ')</span></div>';
      }
      html += '</div>';
    }

    // Tip
    var tip = '';
    if (avgAngle < 40) tip = 'Try increasing your arc — shots with a higher angle have a larger target window.';
    else if (avgAngle > 55) tip = 'Your arc is high. Good for accuracy, but watch for consistency.';
    else tip = 'Your entry angle is in the optimal range (40-55\u00b0). Keep it up!';
    html += '<div class="ast-arc-tip">' + tip + '</div>';

    html += '</div>';
    return html;
  }

  /* ── Progress Sparkline (history-based) ─────────────────── */
  function buildProgressSparkline() {
    var sessions = [];
    try {
      var raw = localStorage.getItem('courtiq-shot-sessions');
      if (raw) sessions = JSON.parse(raw);
    } catch (e) { return ''; }

    var aiSessions = sessions.filter(function (s) { return s.session_type === 'ai_tracking'; });
    if (aiSessions.length < 2) return '';

    // Get last 15 sessions (oldest first)
    var recent = aiSessions.slice(0, 15).reverse();

    var cw = 300, ch = 80;
    var svg = '<svg viewBox="0 0 ' + cw + ' ' + ch + '" class="ast-sparkline-svg" xmlns="http://www.w3.org/2000/svg">';

    // Background grid
    svg += '<line x1="0" y1="' + (ch * 0.5) + '" x2="' + cw + '" y2="' + (ch * 0.5) + '" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="4,4"/>';

    // Calculate points for overall, FG, 3PT
    var lines = {
      overall: { pts: [], color: '#f5a623' },
      fg: { pts: [], color: '#4ca3ff' },
      '3pt': { pts: [], color: '#bc8cff' }
    };

    for (var i = 0; i < recent.length; i++) {
      var s = recent[i];
      var x = (i / (recent.length - 1)) * (cw - 20) + 10;
      var totalMade = (s.fg_made || 0) + (s.three_made || 0) + (s.ft_made || 0);
      var totalAtt = totalMade + (s.fg_missed || 0) + (s.three_missed || 0) + (s.ft_missed || 0);
      var overallPct = totalAtt > 0 ? totalMade / totalAtt : 0;

      var fgAtt = (s.fg_made || 0) + (s.fg_missed || 0);
      var fgPct = fgAtt > 0 ? s.fg_made / fgAtt : -1;

      var threeAtt = (s.three_made || 0) + (s.three_missed || 0);
      var threePct = threeAtt > 0 ? s.three_made / threeAtt : -1;

      var yPad = 8;
      lines.overall.pts.push({ x: x, y: yPad + (1 - overallPct) * (ch - yPad * 2) });
      if (fgPct >= 0) lines.fg.pts.push({ x: x, y: yPad + (1 - fgPct) * (ch - yPad * 2) });
      if (threePct >= 0) lines['3pt'].pts.push({ x: x, y: yPad + (1 - threePct) * (ch - yPad * 2) });
    }

    // Draw lines
    for (var key in lines) {
      var line = lines[key];
      if (line.pts.length < 2) continue;
      svg += '<polyline points="';
      for (var j = 0; j < line.pts.length; j++) {
        svg += line.pts[j].x.toFixed(1) + ',' + line.pts[j].y.toFixed(1) + ' ';
      }
      svg += '" fill="none" stroke="' + line.color + '" stroke-width="2" opacity="0.8"/>';

      // Dot at end
      var last = line.pts[line.pts.length - 1];
      svg += '<circle cx="' + last.x.toFixed(1) + '" cy="' + last.y.toFixed(1) + '" r="3" fill="' + line.color + '"/>';
    }

    svg += '</svg>';

    return '<div class="ast-sparkline-wrap">' +
      '<div class="ast-sparkline-title">Shooting Trend</div>' +
      '<div class="ast-sparkline-legend">' +
        '<span style="color:#f5a623">Overall</span>' +
        '<span style="color:#4ca3ff">FG</span>' +
        '<span style="color:#bc8cff">3PT</span>' +
      '</div>' +
      svg +
    '</div>';
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

      buildArcAnalysis() +

      buildProgressSparkline() +

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
      max_streak:    session.maxStreak,
      court_preset:  courtPreset
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

    // Also render dashboard sparkline
    renderDashSparkline(aiSessions);
  }

  /* ── Dashboard Sparkline ───────────────────────────────── */
  function renderDashSparkline(aiSessions) {
    var el = document.getElementById('ast-dash-sparkline');
    if (!el) return;

    if (!aiSessions || aiSessions.length < 2) { el.innerHTML = ''; return; }

    var recent = aiSessions.slice(0, 15).reverse();
    var cw = 300, ch = 80;
    var svg = '<svg viewBox="0 0 ' + cw + ' ' + ch + '" class="ast-sparkline-svg" xmlns="http://www.w3.org/2000/svg">';
    svg += '<line x1="0" y1="' + (ch * 0.5) + '" x2="' + cw + '" y2="' + (ch * 0.5) + '" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="4,4"/>';

    var pts = [];
    for (var i = 0; i < recent.length; i++) {
      var s = recent[i];
      var x = (i / (recent.length - 1)) * (cw - 20) + 10;
      var totalMade = (s.fg_made || 0) + (s.three_made || 0) + (s.ft_made || 0);
      var totalAtt = totalMade + (s.fg_missed || 0) + (s.three_missed || 0) + (s.ft_missed || 0);
      var pct = totalAtt > 0 ? totalMade / totalAtt : 0;
      var yPad = 8;
      pts.push({ x: x, y: yPad + (1 - pct) * (ch - yPad * 2) });
    }

    if (pts.length >= 2) {
      // Gradient area fill
      svg += '<defs><linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f5a623" stop-opacity="0.2"/><stop offset="100%" stop-color="#f5a623" stop-opacity="0.02"/></linearGradient></defs>';
      svg += '<polygon points="' + pts[0].x.toFixed(1) + ',' + ch + ' ';
      for (var j = 0; j < pts.length; j++) { svg += pts[j].x.toFixed(1) + ',' + pts[j].y.toFixed(1) + ' '; }
      svg += pts[pts.length - 1].x.toFixed(1) + ',' + ch + '" fill="url(#sparkGrad)"/>';

      svg += '<polyline points="';
      for (var k = 0; k < pts.length; k++) { svg += pts[k].x.toFixed(1) + ',' + pts[k].y.toFixed(1) + ' '; }
      svg += '" fill="none" stroke="#f5a623" stroke-width="2" opacity="0.85"/>';

      var last = pts[pts.length - 1];
      svg += '<circle cx="' + last.x.toFixed(1) + '" cy="' + last.y.toFixed(1) + '" r="4" fill="#f5a623"/>';
    }

    svg += '</svg>';

    el.innerHTML = '<div class="ast-sparkline-wrap">' +
      '<div class="ast-sparkline-title">Shooting Trend (AI Sessions)</div>' +
      svg +
    '</div>';
  }

  /* ── Push Notifications / Reminders ──────────────────────── */
  var NOTIF_KEY = 'courtiq-notif-settings';

  function getNotifSettings() {
    try {
      var raw = localStorage.getItem(NOTIF_KEY);
      return raw ? JSON.parse(raw) : { enabled: false, interval: 2, lastSession: 0 };
    } catch (e) { return { enabled: false, interval: 2, lastSession: 0 }; }
  }

  function saveNotifSettings(settings) {
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  function requestNotifPermission(callback) {
    if (!('Notification' in window)) { callback(false); return; }
    if (Notification.permission === 'granted') { callback(true); return; }
    if (Notification.permission === 'denied') { callback(false); return; }
    Notification.requestPermission().then(function (perm) {
      callback(perm === 'granted');
    });
  }

  function scheduleReminder() {
    var settings = getNotifSettings();
    if (!settings.enabled) return;

    // Check how many days since last session
    var sessions = [];
    try {
      var raw = localStorage.getItem('courtiq-shot-sessions');
      if (raw) sessions = JSON.parse(raw);
    } catch (e) {}

    var lastDate = 0;
    for (var i = 0; i < sessions.length; i++) {
      var d = new Date(sessions[i].date).getTime();
      if (d > lastDate) lastDate = d;
    }

    var daysSince = lastDate > 0 ? Math.floor((Date.now() - lastDate) / 86400000) : 999;

    if (daysSince >= settings.interval) {
      sendNotification(daysSince);
    }
  }

  function sendNotification(daysSince) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    var msgs = [
      { title: 'Time to train!', body: 'You haven\'t practiced in ' + daysSince + ' days. Let\'s get some shots up!' },
      { title: 'Don\'t break the streak!', body: daysSince + ' days without practice. Your shooting needs you!' },
      { title: 'Your court is calling', body: 'It\'s been ' + daysSince + ' days. Even 50 shots can make a difference.' }
    ];
    var msg = msgs[Math.floor(Math.random() * msgs.length)];

    try {
      new Notification(msg.title, {
        body: msg.body,
        icon: '/assets/favicon.svg',
        badge: '/assets/favicon.svg',
        tag: 'courtiq-reminder'
      });
    } catch (e) {}
  }

  function initNotifications() {
    var toggle = document.getElementById('ast-notif-toggle');
    var intervalSel = document.getElementById('ast-notif-interval');
    if (!toggle) return;

    var settings = getNotifSettings();
    toggle.checked = settings.enabled;
    if (intervalSel) intervalSel.value = String(settings.interval);

    toggle.addEventListener('change', function () {
      if (toggle.checked) {
        requestNotifPermission(function (granted) {
          if (granted) {
            var s = getNotifSettings();
            s.enabled = true;
            saveNotifSettings(s);
          } else {
            toggle.checked = false;
            if (typeof showToast === 'function') showToast('Notifications blocked by browser');
          }
        });
      } else {
        var s = getNotifSettings();
        s.enabled = false;
        saveNotifSettings(s);
      }
    });

    if (intervalSel) {
      intervalSel.addEventListener('change', function () {
        var s = getNotifSettings();
        s.interval = parseInt(intervalSel.value, 10) || 2;
        saveNotifSettings(s);
      });
    }

    // Check on load
    scheduleReminder();
  }

  /* ── Court Preset UI ───────────────────────────────────── */
  function initCourtPreset() {
    var btns = document.querySelectorAll('.ast-court-btn');
    if (btns.length === 0) return;

    // Load saved preset
    try {
      var saved = localStorage.getItem('courtiq-court-preset');
      if (saved && COURT_PRESETS[saved]) courtPreset = saved;
    } catch (e) {}

    updateCourtPresetUI();

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        courtPreset = btn.dataset.preset || 'nba';
        try { localStorage.setItem('courtiq-court-preset', courtPreset); } catch (e) {}
        updateCourtPresetUI();
      });
    });
  }

  function updateCourtPresetUI() {
    document.querySelectorAll('.ast-court-btn').forEach(function (btn) {
      btn.classList.toggle('ast-court-active', btn.dataset.preset === courtPreset);
    });
    var info = document.getElementById('ast-court-info');
    if (info) {
      var p = COURT_PRESETS[courtPreset];
      info.textContent = p.label + ': 3PT line at ' + p.threeLineFt + ' ft, Court ' + p.courtW + '\u00d7' + p.courtL + ' ft';
    }
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

    // HORSE mode buttons
    var horseToggleBtn = document.getElementById('ast-horse-toggle');
    if (horseToggleBtn) horseToggleBtn.addEventListener('click', toggleHorseSetup);

    var horseStartBtn = document.getElementById('ast-horse-start');
    if (horseStartBtn) horseStartBtn.addEventListener('click', startHorseMode);

    // Court preset
    initCourtPreset();

    // Notifications
    initNotifications();

    // Render history on load
    renderHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.AIShotTracker = { open: openOverlay, close: closeOverlay, startHorse: startHorseMode };

})();
