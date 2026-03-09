/* ============================================================
   AI SHOT TRACKER — /js/ai-shot-tracker.js
   Camera-based automatic shot detection using ML + color fallback.

   v3 — Major detection overhaul:
     - ROI-based search: only look for ball in the upper court area
       near the rim (not in video overlays or player body zones)
     - Person exclusion: COCO-SSD "person" bboxes mask out color search
     - Better ML model: mobilenet_v2 (full) for improved outdoor accuracy
     - Stricter color filtering: aspect + size + compactness + proximity
     - Resolution-normalized everything
   ============================================================ */
(function () {
  'use strict';

  /* ── Resolution-relative constants ────────────────────────── */
  var RIM_RX_FRAC    = 0.043;   // Rim ellipse half-width
  var RIM_RY_FRAC    = 0.028;   // Rim ellipse half-height
  var MAX_HIST       = 45;
  var COOLDOWN_SEC   = 2.0;
  var BALL_CIRCLE_FRAC = 0.022;

  /* ── Velocity thresholds (fraction of H per 8-frame window) */
  var VEL_RISE_FRAC  = 0.014;
  var VEL_FALL_FRAC  = 0.014;
  var TELEPORT_FRAC  = 0.22;
  var DISAPPEAR_GRACE = 6;

  /* ── Ball size for color detection (fraction of frame width) */
  var BALL_DIAM_MIN_FRAC = 0.012;
  var BALL_DIAM_MAX_FRAC = 0.14;
  var BALL_ASPECT_MAX    = 2.2;

  /* ── ROI: Region of Interest for ball search ────────────────
     After rim calibration, we only search in this region:
     - Horizontally: full width (ball can come from any angle)
     - Vertically: from top of frame down to rim + some margin below
     - Excludes bottom 15% of frame (video overlays/watermarks)  */
  var ROI_BOTTOM_MARGIN_FRAC = 0.15; // ignore bottom 15% of frame
  var ROI_BELOW_RIM_FRAC = 0.12;     // search only this far below rim

  /* ── Rim auto-detection constants ────────────────────────── */
  var RIM_DETECT_INTERVAL  = 500;   // ms between auto-detect attempts
  var RIM_DETECT_MAX_TRIES = 12;    // give up after this many attempts
  var RIM_MIN_WIDTH_FRAC   = 0.03;  // rim blob must be at least 3% of frame width
  var RIM_MAX_WIDTH_FRAC   = 0.25;  // rim blob can't be more than 25% of frame width
  var RIM_SCAN_TOP_FRAC    = 0.60;  // only scan the top 60% of the frame for rim

  /* ── State ────────────────────────────────────────────────── */
  var PHASE = { IDLE: 'idle', CALIBRATING: 'calibrating', TRACKING: 'tracking', SUMMARY: 'summary' };
  var phase = PHASE.IDLE;
  var calibMode = 'auto';  // 'auto' | 'confirm' | 'manual'
  var autoRimCandidate = null;  // { cx, cy } — candidate from auto-detect
  var rimDetectTimer = null;
  var rimDetectTries = 0;

  var video, canvas, ctx, stream;
  var W = 0, H = 0;
  var animFrame = null;
  var mode = 'camera';
  var videoUrl = null;

  /* ── ML state ─────────────────────────────────────────────── */
  var tfModel     = null;
  var mlReady     = false;
  var mlLoading   = false;
  var isDetecting = false;
  var lastBall    = null;
  var frameCount  = 0;
  var personBoxes = [];  // bboxes of detected people (for exclusion)

  /* ── Kalman filter with velocity prediction ────────────────── */
  function createKalman() {
    return { x: null, v: 0, p: 1.0, pv: 0.5, R: 12, Qp: 0.6, Qv: 0.3 };
  }
  var kalX = createKalman();
  var kalY = createKalman();

  function kalmanUpdate(kal, z) {
    if (kal.x === null) { kal.x = z; kal.v = 0; return z; }
    var xPred = kal.x + kal.v;
    var pPred = kal.p + kal.pv + kal.Qp;
    var k = pPred / (pPred + kal.R);
    kal.x = xPred + k * (z - xPred);
    kal.p = pPred * (1 - k);
    var vMeas = kal.x - (xPred - kal.v);
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
      x: kalmanUpdate(kalX, ball.x), y: kalmanUpdate(kalY, ball.y),
      size: ball.size, score: ball.score || 1
    };
  }

  function resetKalman() { kalX = createKalman(); kalY = createKalman(); }

  /* ── Rim & tracking state ──────────────────────────────────── */
  var rim = null;
  var ballHistory = [];
  var disappearCount = 0;
  var shotPhase = 'idle';
  var atRimFrames = 0;
  var atRimMaxFrames = 18;
  var cooldownUntil = 0;

  var session = {
    attempts: 0, made: 0, shots: [],
    startTime: 0, streak: 0, maxStreak: 0
  };

  /* ── ROI helpers ────────────────────────────────────────────── */
  function getROI() {
    // Before calibration, search most of the frame (exclude bottom 15% for overlays)
    if (!rim) {
      return { x: 0, y: 0, w: W, h: Math.round(H * (1 - ROI_BOTTOM_MARGIN_FRAC)) };
    }
    // After calibration, focus on the area around the rim
    var roiTop = 0;
    var roiBottom = Math.min(
      Math.round(rim.cy + H * ROI_BELOW_RIM_FRAC),
      Math.round(H * (1 - ROI_BOTTOM_MARGIN_FRAC))
    );
    return { x: 0, y: roiTop, w: W, h: roiBottom - roiTop };
  }

  function isInsideROI(x, y) {
    var roi = getROI();
    return x >= roi.x && x <= roi.x + roi.w && y >= roi.y && y <= roi.y + roi.h;
  }

  function isInsidePersonBox(x, y) {
    for (var i = 0; i < personBoxes.length; i++) {
      var pb = personBoxes[i];
      // Shrink person box by 20% on each side to allow ball near hands
      var shrink = 0.2;
      var px = pb.x + pb.w * shrink;
      var py = pb.y + pb.h * shrink;
      var pw = pb.w * (1 - 2 * shrink);
      var ph = pb.h * (1 - 2 * shrink);
      if (x >= px && x <= px + pw && y >= py && y <= py + ph) return true;
    }
    return false;
  }

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
    // Use full mobilenet_v2 for better accuracy (larger but more reliable)
    cocoSsd.load({ base: 'mobilenet_v2' }).then(function (model) {
      tfModel = model;
      mlReady = true;
      mlLoading = false;
      setMLStatus('ready');
    }).catch(function () {
      // Fallback to lite if full model fails
      cocoSsd.load({ base: 'lite_mobilenet_v2' }).then(function (model) {
        tfModel = model;
        mlReady = true;
        mlLoading = false;
        setMLStatus('ready');
      }).catch(function () {
        mlLoading = false;
        setMLStatus('fallback');
      });
    });
  }

  function setMLStatus(state) {
    var el = document.getElementById('ast-ml-status');
    if (!el) return;
    if (state === 'loading') { el.textContent = '🧠 Loading AI model…'; el.style.display = ''; }
    else if (state === 'ready') { el.textContent = '🤖 AI Active'; el.style.display = ''; }
    else { el.style.display = 'none'; }
  }

  /* ── ML detection with person exclusion ─────────────────────── */
  var ML_BALL_CLASSES = { 'sports ball': 1.0, 'frisbee': 0.8, 'orange': 0.65 };
  var mlMissCount = 0;

  function detectBallAsync() {
    if (mlReady && tfModel) {
      return tfModel.detect(video).then(function (preds) {
        var best = null, bestAdjScore = 0.25;
        var frameArea = W * H;

        // First pass: collect person bounding boxes for exclusion
        personBoxes = [];
        for (var p = 0; p < preds.length; p++) {
          if (preds[p].class === 'person' && preds[p].score > 0.4) {
            var pb = preds[p].bbox;
            personBoxes.push({ x: pb[0], y: pb[1], w: pb[2], h: pb[3] });
          }
        }

        // Second pass: find best ball detection
        for (var i = 0; i < preds.length; i++) {
          var cls = preds[i].class;
          var classWeight = ML_BALL_CLASSES[cls];
          if (!classWeight) continue;
          var adjScore = preds[i].score * classWeight;
          if (adjScore <= bestAdjScore) continue;

          var bbox = preds[i].bbox;
          var area = bbox[2] * bbox[3];
          if (area < frameArea * 0.0003 || area > frameArea * 0.10) continue;

          // Shape check
          var bAspect = Math.max(bbox[2] / bbox[3], bbox[3] / bbox[2]);
          if (bAspect > 2.2) continue;

          // Center of detection
          var cx = bbox[0] + bbox[2] / 2;
          var cy = bbox[1] + bbox[3] / 2;

          // Must be inside ROI
          if (!isInsideROI(cx, cy)) continue;

          best = preds[i];
          bestAdjScore = adjScore;
        }

        if (best) {
          mlMissCount = 0;
          var b = best.bbox;
          return { x: b[0] + b[2] / 2, y: b[1] + b[3] / 2, size: b[2] * b[3], score: bestAdjScore };
        }

        mlMissCount++;
        if (mlMissCount >= 3) {
          return detectBallColor();
        }
        return null;
      }).catch(function () { return detectBallColor(); });
    }
    return Promise.resolve(detectBallColor());
  }

  /* ── Color detection: shape-aware, ROI-limited, person-excluded ── */
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

    // Only scan within the ROI
    var roi = getROI();
    if (roi.w < 10 || roi.h < 10) return null;

    var imageData = ctx.getImageData(roi.x, roi.y, roi.w, roi.h);
    var data = imageData.data;
    var rw = imageData.width, rh = imageData.height;

    // Collect orange pixels (skip every 2px for speed)
    var orangeX = [], orangeY = [];
    for (var y = 0; y < rh; y += 2) {
      for (var x = 0; x < rw; x += 2) {
        var i = (y * rw + x) * 4;
        if (isOrange(data[i], data[i + 1], data[i + 2])) {
          // Convert to full-frame coordinates
          var fx = x + roi.x;
          var fy = y + roi.y;
          // Skip if inside a person bounding box (core body area)
          if (isInsidePersonBox(fx, fy)) continue;
          orangeX.push(fx);
          orangeY.push(fy);
        }
      }
    }

    if (orangeX.length < 15) return null;

    // Grid clustering
    var cellW = Math.max(1, Math.round(W / 24));
    var cellH = Math.max(1, Math.round(H / 24));
    var cells = {};

    for (var j = 0; j < orangeX.length; j++) {
      var gx = Math.floor(orangeX[j] / cellW);
      var gy = Math.floor(orangeY[j] / cellH);
      var key = gx + ',' + gy;
      if (!cells[key]) {
        cells[key] = { count: 0, minX: orangeX[j], maxX: orangeX[j], minY: orangeY[j], maxY: orangeY[j], gx: gx, gy: gy };
      }
      var c = cells[key];
      c.count++;
      if (orangeX[j] < c.minX) c.minX = orangeX[j];
      if (orangeX[j] > c.maxX) c.maxX = orangeX[j];
      if (orangeY[j] < c.minY) c.minY = orangeY[j];
      if (orangeY[j] > c.maxY) c.maxY = orangeY[j];
    }

    // Evaluate each cell+neighbors as a blob candidate
    var ballMinPx = W * BALL_DIAM_MIN_FRAC;
    var ballMaxPx = W * BALL_DIAM_MAX_FRAC;
    var bestBlob = null, bestScore = -1;
    var cellKeys = Object.keys(cells);
    var visited = {};

    for (var ci = 0; ci < cellKeys.length; ci++) {
      var ck = cellKeys[ci];
      if (visited[ck]) continue;

      var center = cells[ck];
      var bMinX = center.minX, bMaxX = center.maxX;
      var bMinY = center.minY, bMaxY = center.maxY;
      var bCount = 0, bSumX = 0, bSumY = 0;

      for (var ni = -1; ni <= 1; ni++) {
        for (var nj = -1; nj <= 1; nj++) {
          var nk = (center.gx + ni) + ',' + (center.gy + nj);
          if (!cells[nk]) continue;
          var nc = cells[nk];
          bCount += nc.count;
          if (nc.minX < bMinX) bMinX = nc.minX;
          if (nc.maxX > bMaxX) bMaxX = nc.maxX;
          if (nc.minY < bMinY) bMinY = nc.minY;
          if (nc.maxY > bMaxY) bMaxY = nc.maxY;
        }
      }

      // Centroid for this blob
      for (var pk = 0; pk < orangeX.length; pk++) {
        var pgx = Math.floor(orangeX[pk] / cellW);
        var pgy = Math.floor(orangeY[pk] / cellH);
        if (Math.abs(pgx - center.gx) <= 1 && Math.abs(pgy - center.gy) <= 1) {
          bSumX += orangeX[pk];
          bSumY += orangeY[pk];
        }
      }

      var blobW = bMaxX - bMinX + 1;
      var blobH = bMaxY - bMinY + 1;
      if (blobW < 4 || blobH < 4) continue;

      var aspect = Math.max(blobW / blobH, blobH / blobW);
      var diameter = Math.max(blobW, blobH);

      if (aspect > BALL_ASPECT_MAX) continue;
      if (diameter < ballMinPx || diameter > ballMaxPx) continue;

      var fillRatio = bCount / ((blobW / 2) * (blobH / 2));
      if (fillRatio < 0.15) continue;

      // Centroid must not be inside person core body
      var centX = bSumX / bCount;
      var centY = bSumY / bCount;
      if (isInsidePersonBox(centX, centY)) continue;

      // Scoring: roundness + fill + proximity to rim (if calibrated)
      var roundness = 1.0 / aspect;
      var sizeScore = 1.0 - Math.abs(diameter - ballMaxPx * 0.35) / (ballMaxPx * 0.65);
      var proximityScore = 0;
      if (rim) {
        var distToRim = Math.sqrt(Math.pow(centX - rim.cx, 2) + Math.pow(centY - rim.cy, 2));
        var maxDist = Math.sqrt(W * W + H * H) * 0.5;
        proximityScore = Math.max(0, 1.0 - distToRim / maxDist);
      }

      var score = roundness * 0.35 + Math.min(fillRatio, 1.0) * 0.25 +
                  Math.max(sizeScore, 0) * 0.2 + proximityScore * 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestBlob = { x: centX, y: centY, size: bCount, score: 0.3 + score * 0.2 };
      }

      visited[ck] = true;
    }

    return bestBlob;
  }

  /* ── Rim auto-detection ─────────────────────────────────────
     Scans the upper portion of the frame for orange/red horizontal
     blobs that look like a basketball rim. Returns { cx, cy } or null.
     Strategy:
       1. isRimColor: detect orange-red pixels (rim is orange/red metal)
       2. Only scan top 60% of frame (rim is always in upper half)
       3. Cluster into blobs, pick the most "rim-shaped" one:
          - Wider than tall (aspect ratio > 1.5)
          - Correct size range
          - In upper portion of frame
     ──────────────────────────────────────────────────────────── */
  function isRimColor(r, g, b) {
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if (max < 80) return false;
    var delta = max - min;
    if (delta < 30) return false;
    var s = delta / max;
    if (s < 0.35) return false;
    var h;
    if (max === r)      h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else                h = 60 * ((r - g) / delta + 4);
    if (h < 0) h += 360;
    // Rim orange/red: hue 0-25 (red-orange range, slightly wider than ball)
    return (h >= 0 && h <= 25) || h >= 350;
  }

  function detectRimAuto() {
    if (!canvas || !ctx || W === 0 || H === 0) return null;

    // Draw current frame to canvas first
    ctx.drawImage(video, 0, 0, W, H);

    var scanH = Math.round(H * RIM_SCAN_TOP_FRAC);
    var imageData = ctx.getImageData(0, 0, W, scanH);
    var data = imageData.data;

    // Collect rim-colored pixels (skip every 3px for speed)
    var rimPxX = [], rimPxY = [];
    for (var y = 0; y < scanH; y += 3) {
      for (var x = 0; x < W; x += 3) {
        var i = (y * W + x) * 4;
        if (isRimColor(data[i], data[i + 1], data[i + 2])) {
          rimPxX.push(x);
          rimPxY.push(y);
        }
      }
    }

    if (rimPxX.length < 8) return null;

    // Grid clustering (coarser grid for rim — it's larger than a ball)
    var cellW = Math.max(1, Math.round(W / 16));
    var cellH = Math.max(1, Math.round(scanH / 16));
    var cells = {};

    for (var j = 0; j < rimPxX.length; j++) {
      var gx = Math.floor(rimPxX[j] / cellW);
      var gy = Math.floor(rimPxY[j] / cellH);
      var key = gx + ',' + gy;
      if (!cells[key]) {
        cells[key] = { count: 0, minX: rimPxX[j], maxX: rimPxX[j], minY: rimPxY[j], maxY: rimPxY[j], gx: gx, gy: gy };
      }
      var c = cells[key];
      c.count++;
      if (rimPxX[j] < c.minX) c.minX = rimPxX[j];
      if (rimPxX[j] > c.maxX) c.maxX = rimPxX[j];
      if (rimPxY[j] < c.minY) c.minY = rimPxY[j];
      if (rimPxY[j] > c.maxY) c.maxY = rimPxY[j];
    }

    var minRimW = W * RIM_MIN_WIDTH_FRAC;
    var maxRimW = W * RIM_MAX_WIDTH_FRAC;
    var bestCandidate = null, bestScore = -1;
    var cellKeys = Object.keys(cells);

    for (var ci = 0; ci < cellKeys.length; ci++) {
      var center = cells[cellKeys[ci]];

      // Merge with neighbors (3x3 grid)
      var bMinX = center.minX, bMaxX = center.maxX;
      var bMinY = center.minY, bMaxY = center.maxY;
      var bCount = 0, bSumX = 0, bSumY = 0;

      for (var ni = -1; ni <= 1; ni++) {
        for (var nj = -1; nj <= 1; nj++) {
          var nk = (center.gx + ni) + ',' + (center.gy + nj);
          if (!cells[nk]) continue;
          var nc = cells[nk];
          bCount += nc.count;
          bSumX += (nc.minX + nc.maxX) / 2 * nc.count;
          bSumY += (nc.minY + nc.maxY) / 2 * nc.count;
          if (nc.minX < bMinX) bMinX = nc.minX;
          if (nc.maxX > bMaxX) bMaxX = nc.maxX;
          if (nc.minY < bMinY) bMinY = nc.minY;
          if (nc.maxY > bMaxY) bMaxY = nc.maxY;
        }
      }

      var blobW = bMaxX - bMinX + 1;
      var blobH = bMaxY - bMinY + 1;

      // Rim should be wider than tall (horizontal shape)
      var aspect = blobW / Math.max(blobH, 1);
      if (aspect < 1.3) continue;  // must be horizontal-ish

      // Size checks
      if (blobW < minRimW || blobW > maxRimW) continue;

      // Rim shouldn't be too thick vertically
      if (blobH > blobW * 0.6) continue;

      var cx = bSumX / bCount;
      var cy = bSumY / bCount;

      // Score: prefer wider, higher-up, well-populated blobs
      var widthScore = Math.min(blobW / (W * 0.08), 1.0);
      var heightScore = 1.0 - (cy / scanH);  // higher in frame = better
      var countScore = Math.min(bCount / 30, 1.0);
      var score = widthScore * 0.4 + heightScore * 0.3 + countScore * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = { cx: cx, cy: cy };
      }
    }

    return bestCandidate;
  }

  /* ── Rim geometry ───────────────────────────────────────────── */
  function insideRim(x, y) {
    if (!rim) return false;
    var dx = (x - rim.cx) / rim.rx;
    var dy = (y - rim.cy) / rim.ry;
    return dx * dx + dy * dy <= 1.0;
  }

  function inApproachZone(x, y) {
    if (!rim) return false;
    return y > rim.cy - rim.ry * 6 && y < rim.cy + rim.ry * 2.5 &&
           Math.abs(x - rim.cx) < rim.rx * 4;
  }

  /* ── Shot detection state machine ───────────────────────────── */
  function processBall(ball) {
    var now = Date.now();
    if (now < cooldownUntil) return;

    ballHistory.push(ball ? { x: ball.x, y: ball.y } : null);
    if (ballHistory.length > MAX_HIST) ballHistory.shift();

    if (!ball) {
      disappearCount++;
      if (shotPhase === 'at_rim' && disappearCount >= DISAPPEAR_GRACE) {
        var wentBelow = checkExitedBelow();
        if (wentBelow) {
          commitShot(true, now);
        } else if (atRimFrames >= 3) {
          commitShot(false, now);
        }
        shotPhase = 'idle';
        atRimFrames = 0;
      } else if (shotPhase === 'ascending' && disappearCount > DISAPPEAR_GRACE) {
        shotPhase = 'idle';
      }
      return;
    }

    disappearCount = 0;

    var recent = [];
    for (var i = ballHistory.length - 1; i >= 0 && recent.length < 10; i--) {
      if (ballHistory[i]) recent.unshift(ballHistory[i]);
    }
    var yVel = 0;
    if (recent.length >= 4) {
      var lookback = Math.min(8, recent.length - 1);
      var old = recent[recent.length - 1 - lookback];
      yVel = (ball.y - old.y) / H;
    }

    if (shotPhase === 'idle') {
      if (yVel < -VEL_RISE_FRAC && inApproachZone(ball.x, ball.y)) {
        shotPhase = 'ascending';
      }
    } else if (shotPhase === 'ascending') {
      if (insideRim(ball.x, ball.y)) {
        shotPhase = 'at_rim';
        atRimFrames = 1;
      } else if (yVel > VEL_FALL_FRAC) {
        if (inApproachZone(ball.x, ball.y) && Math.abs(ball.x - rim.cx) < rim.rx * 2.5) {
          commitShot(false, now);
        }
        shotPhase = 'idle';
      }
    } else if (shotPhase === 'at_rim') {
      atRimFrames++;
      if (!insideRim(ball.x, ball.y)) {
        if (ball.y > rim.cy + rim.ry * 0.5) {
          commitShot(true, now);
        } else {
          commitShot(false, now);
        }
        shotPhase = 'idle';
        atRimFrames = 0;
      } else if (atRimFrames > atRimMaxFrames) {
        commitShot(false, now);
        shotPhase = 'idle';
        atRimFrames = 0;
      }
    }
  }

  function checkExitedBelow() {
    var valid = [];
    for (var i = ballHistory.length - 1; i >= 0 && valid.length < 5; i--) {
      if (ballHistory[i]) valid.unshift(ballHistory[i]);
    }
    if (valid.length < 2) return false;
    var last = valid[valid.length - 1];
    var prev = valid[0];
    return last.y > prev.y && rim && last.y > rim.cy;
  }

  function commitShot(made, now) {
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
      // During confirm phase, draw with pulsing highlight
      var isPreview = phase === PHASE.CALIBRATING && calibMode === 'confirm';
      if (isPreview) {
        var pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
        ctx.strokeStyle = 'rgba(86,211,100,' + pulse + ')';
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(86,211,100,0.7)';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(rim.cx, rim.cy, rim.rx * 1.5, rim.ry * 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshair at center
        var chSize = 12;
        ctx.beginPath();
        ctx.moveTo(rim.cx - chSize, rim.cy);
        ctx.lineTo(rim.cx + chSize, rim.cy);
        ctx.moveTo(rim.cx, rim.cy - chSize);
        ctx.lineTo(rim.cx, rim.cy + chSize);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = 'rgba(245,166,35,0.85)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(245,166,35,0.5)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(rim.cx, rim.cy, rim.rx, rim.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw ROI boundary (subtle, only during tracking)
      if (phase === PHASE.TRACKING) {
        var roi = getROI();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
        ctx.setLineDash([]);
      }
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

    // State indicator
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

    if (phase === PHASE.TRACKING) processBall(lastBall);
    drawOverlay(lastBall);

    if (!isDetecting) {
      isDetecting = true;
      detectBallAsync().then(function (raw) {
        var ball = null;
        if (raw && isPhysicallyValid(raw)) {
          ball = applyKalman(raw);
        } else if (raw) {
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
    var videoCalib = document.getElementById('ast-calib-video');
    var liveCalib  = document.getElementById('ast-calib-live');
    var trackEl    = document.getElementById('ast-track-msg');

    if (videoCalib) videoCalib.style.display = (p === 'calibrate' && mode === 'video') ? '' : 'none';
    if (liveCalib)  liveCalib.style.display  = (p === 'calibrate' && mode === 'camera') ? '' : 'none';
    if (trackEl)    trackEl.style.display    = p === 'track' ? '' : 'none';
  }

  /* ── Mode-specific calibration state helpers ─────────────── */
  function showCalibState(state) {
    calibMode = state;
    if (mode === 'video') {
      showVideoCalibState(state);
    } else {
      showLiveCalibState(state);
    }
  }

  function showVideoCalibState(state) {
    var scanning = document.getElementById('ast-vcalib-scanning');
    var confirm  = document.getElementById('ast-vcalib-confirm');
    var manual   = document.getElementById('ast-vcalib-manual');
    var linkBtn  = document.getElementById('ast-vcalib-switch');
    if (scanning) scanning.style.display = state === 'auto' ? '' : 'none';
    if (confirm)  confirm.style.display  = state === 'confirm' ? '' : 'none';
    if (manual)   manual.style.display   = state === 'manual' ? '' : 'none';
    if (linkBtn)  linkBtn.textContent    = state === 'manual' ? 'Back to auto-detect' : 'Or set manually';
  }

  function showLiveCalibState(state) {
    var setup    = document.getElementById('ast-lcalib-setup');
    var scanning = document.getElementById('ast-lcalib-scanning');
    var confirm  = document.getElementById('ast-lcalib-confirm');
    var manual   = document.getElementById('ast-lcalib-manual');
    var linkWrap = document.getElementById('ast-lcalib-manual-link');
    var linkBtn  = document.getElementById('ast-lcalib-switch');
    if (setup)    setup.style.display    = state === 'setup' ? '' : 'none';
    if (scanning) scanning.style.display = state === 'auto' ? '' : 'none';
    if (confirm)  confirm.style.display  = state === 'confirm' ? '' : 'none';
    if (manual)   manual.style.display   = state === 'manual' ? '' : 'none';
    // Show manual link only after setup phase
    if (linkWrap) linkWrap.style.display = (state !== 'setup') ? '' : 'none';
    if (linkBtn)  linkBtn.textContent    = state === 'manual' ? 'Back to auto-detect' : 'Or set manually';
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
        // Live mode: show setup guide first, don't auto-detect yet
        showLiveCalibState('setup');
        animFrame = requestAnimationFrame(frameLoop);
      };
    }).catch(function (err) {
      showCameraError('Camera error: ' + err.message + '. Please allow camera access and try again.');
    });
  }

  function stopCamera() {
    stopRimDetectTimer();
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

  /* ── Rim calibration ─────────────────────────────────────── */

  function confirmRimAndStart(cx, cy) {
    stopRimDetectTimer();
    autoRimCandidate = null;
    rim = { cx: cx, cy: cy, rx: W * RIM_RX_FRAC, ry: H * RIM_RY_FRAC };
    phase = PHASE.TRACKING;
    session.startTime = Date.now();
    showPhase('track');

    if (mode === 'video' && video) {
      video.play();
      var ppBtn = document.getElementById('ast-vc-playpause');
      if (ppBtn) ppBtn.textContent = '⏸';
    }
  }

  function onCanvasTap(e) {
    if (phase !== PHASE.CALIBRATING) return;
    // Only accept taps in manual mode (both video and live)
    if (calibMode !== 'manual') return;
    e.preventDefault();

    var rect = canvas.getBoundingClientRect();
    var scaleX = W / rect.width;
    var scaleY = H / rect.height;

    var src = e.touches ? e.touches[0] : e;
    var tapX = (src.clientX - rect.left) * scaleX;
    var tapY = (src.clientY - rect.top)  * scaleY;

    confirmRimAndStart(tapX, tapY);
  }

  function startRimAutoDetect() {
    rimDetectTries = 0;
    autoRimCandidate = null;
    showCalibState('auto');
    stopRimDetectTimer();

    rimDetectTimer = setInterval(function () {
      if (phase !== PHASE.CALIBRATING) { stopRimDetectTimer(); return; }
      rimDetectTries++;

      var candidate = detectRimAuto();
      if (candidate) {
        // Found a candidate — show it and ask for confirmation
        autoRimCandidate = candidate;
        // Set temporary rim for drawing the preview ellipse
        rim = { cx: candidate.cx, cy: candidate.cy, rx: W * RIM_RX_FRAC, ry: H * RIM_RY_FRAC };
        showCalibState('confirm');
        stopRimDetectTimer();
        return;
      }

      if (rimDetectTries >= RIM_DETECT_MAX_TRIES) {
        // Give up, switch to manual
        stopRimDetectTimer();
        showCalibState('manual');
      }
    }, RIM_DETECT_INTERVAL);
  }

  function stopRimDetectTimer() {
    if (rimDetectTimer) { clearInterval(rimDetectTimer); rimDetectTimer = null; }
  }

  /* ── Open overlay ─────────────────────────────────────────── */
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
    mlMissCount = 0;
    personBoxes = [];
    autoRimCandidate = null;
    calibMode = 'auto';
    stopRimDetectTimer();
    rimDetectTries = 0;
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

  function openOverlay() {
    mode = 'camera';
    if (openOverlayBase()) startCamera();
  }

  function openOverlayVideo() {
    mode = 'video';
    var fileInput = document.getElementById('ast-file-input');
    if (fileInput) { fileInput.value = ''; fileInput.click(); }
  }

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
      // Draw first frame so auto-detect has pixels to scan
      ctx.drawImage(video, 0, 0, W, H);
      phase = PHASE.CALIBRATING;
      showPhase('calibrate');
      showVideoControls(true);
      var ppBtn = document.getElementById('ast-vc-playpause');
      if (ppBtn) ppBtn.textContent = '▶';
      startRimAutoDetect();
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

    /* ── Video mode calibration buttons ──────────────────── */
    bindBtn('ast-vcalib-yes', function () {
      if (autoRimCandidate && phase === PHASE.CALIBRATING) {
        confirmRimAndStart(autoRimCandidate.cx, autoRimCandidate.cy);
      }
    });
    bindBtn('ast-vcalib-retry', function () {
      if (phase !== PHASE.CALIBRATING) return;
      rim = null; autoRimCandidate = null;
      startRimAutoDetect();
    });
    bindBtn('ast-vcalib-switch', function () {
      if (phase !== PHASE.CALIBRATING) return;
      if (calibMode === 'manual') {
        rim = null; autoRimCandidate = null;
        startRimAutoDetect();
      } else {
        stopRimDetectTimer();
        rim = null; autoRimCandidate = null;
        showCalibState('manual');
      }
    });

    /* ── Live camera calibration buttons ─────────────────── */
    bindBtn('ast-lcalib-ready', function () {
      if (phase !== PHASE.CALIBRATING) return;
      startRimAutoDetect();
    });
    bindBtn('ast-lcalib-yes', function () {
      if (autoRimCandidate && phase === PHASE.CALIBRATING) {
        confirmRimAndStart(autoRimCandidate.cx, autoRimCandidate.cy);
      }
    });
    bindBtn('ast-lcalib-retry', function () {
      if (phase !== PHASE.CALIBRATING) return;
      rim = null; autoRimCandidate = null;
      startRimAutoDetect();
    });
    bindBtn('ast-lcalib-switch', function () {
      if (phase !== PHASE.CALIBRATING) return;
      if (calibMode === 'manual') {
        rim = null; autoRimCandidate = null;
        startRimAutoDetect();
      } else {
        stopRimDetectTimer();
        rim = null; autoRimCandidate = null;
        showCalibState('manual');
      }
    });
  }

  function bindBtn(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AIShotTracker = { open: openOverlay, close: closeOverlay };

})();
