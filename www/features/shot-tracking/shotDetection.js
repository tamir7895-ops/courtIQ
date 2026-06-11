/* ══════════════════════════════════════════════════════════════
   SHOT DETECTION — ML + Color Fallback Ball Detection
   + Centroid Tracker + Shot Result Analysis

   v10 — Custom YOLOX-tiny v6 (Apache 2.0) trained on basketball dataset.
        2 classes: Basketball (0), Basketball Hoop (1).
        Input: 640x640. Output: [1, 8400, 7] = [cx, cy, w, h, objectness, ball_score, hoop_score]
        Best AP@0.5 = 0.885, AP@0.5:0.95 = 0.548 (30 epochs, phase3_human exp)
        YOLOX runs every 3rd frame. Color detection every frame as fallback.

   Runs entirely in-browser using:
     - ONNX Runtime Web (WASM backend) + YOLOX-tiny (custom trained, 20 MB)
     - Canvas color analysis (always available)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Debug flag ─────────────────────────────────────────────────
     Gate verbose console.log spam behind a flag. Errors and warnings
     are not gated — those signal real production issues. Override at
     runtime: window.ShotDetectionDebug = true; (then reload).
     ──────────────────────────────────────────────────────────────── */
  var DEBUG = (typeof window !== 'undefined' && window.ShotDetectionDebug === true);
  function dlog() {
    if (!DEBUG) return;
    console.log.apply(console, arguments);
  }

  /* ── Script-relative base URL ───────────────────────────────────
     Assets (model, preprocessing worker) live relative to the REPO
     ROOT, two levels above this script. Resolving against
     document.currentScript.src instead of the page URL keeps fetches
     working on pages served from sub-paths (debug harnesses, deep
     links) — a page-relative path 404s there and silently dumps the
     engine into color-only mode. Empty string = legacy page-relative
     fallback. */
  var SCRIPT_BASE = '';
  try {
    var _scriptSrc = document.currentScript && document.currentScript.src;
    if (_scriptSrc) SCRIPT_BASE = new URL('../../', _scriptSrc).href;
  } catch (e) { /* keep '' */ }

  /* ── Constants ──────────────────────────────────────────────── */
  var DEBOUNCE_MS          = 400;   // L14.A: was 700 — matches looser pose cooldown
  var MIN_TRAJECTORY_PTS   = 3;    // Fewer points needed before analyzing
  var MAX_HISTORY          = 50;   // Larger rolling buffer
  var MAX_GAP_FRAMES       = 24;   // Grace frames for ball vanishing (ball in air ~0.8s = ~24 frames)
  var MIN_MOVEMENT_PX      = 2;    // Lower jitter threshold
  var BALL_CONFIDENCE      = 0.05;  // Raised threshold — 0.005 was too low, tracked players
  var MADE_MAX_FRAMES      = 22;   // More frames allowed for rim transit
  var DETECTION_INTERVAL   = 33;   // ~30 FPS color detection (YOLOX runs async every 6th frame)
  // YOLOX cadence is hardcoded as `_frameCount % 6 === 0` below. 6 was picked as a
  // safe floor for low-end devices on the WASM backend (~5 inferences/sec). On WebGPU
  // we have headroom for every-3rd or every-4th frame; consider auto-tuning the
  // divisor based on observed inference latency once we see real-device numbers.

  /* ── YOLOX-tiny constants (custom 3-class model: v6_polished) ──
     Output shape is [1, 8400, 8] — every detection row carries:
       [0..3]  box (cx, cy, w, h) in 640x640 pixel space
       [4]     objectness score
       [5]     ball score
       [6]     hoop score
       [7]     player score
     The 2-class v71 model had stride=7; v6_polished is 8. */
  var YOLOX_INPUT_SIZE     = 640;
  var YOLOX_NUM_CLASSES    = 3;
  var YOLOX_BALL_CLASS     = 0;    // Basketball
  var YOLOX_HOOP_CLASS     = 1;    // Basketball Hoop
  var YOLOX_PLAYER_CLASS   = 2;    // Player (NEW in v6_polished)
  var YOLOX_STRIDE         = 8;    // 4 (box) + 1 (objectness) + 3 (classes)

  // Pre-allocated buffers for ONNX inference (avoid GC)
  var _yoloxBuf    = null;
  var _yoloxCanvas = null;
  var _yoloxCtx    = null;

  // Web Worker for CHW preprocessing (offloads ~520K array writes from main thread)
  var _chwWorker   = null;
  try {
    _chwWorker = new Worker(SCRIPT_BASE + 'features/shot-tracking/yoloxWorker.js');
  } catch (e) {
    console.warn('[ShotDetection] Web Worker unavailable, using main thread CHW');
  }

  /* Area thresholds as fractions of total frame area */
  var BALL_MIN_AREA_FRAC   = 0.00005;  // Very small — distant shots
  var BALL_MAX_AREA_FRAC   = 0.18;     // Very large — close-up shots

  /* Color detection constants */
  var COLOR_SCAN_STEP      = 4;    // Pixel step for color scanning (performance)
  var COLOR_MIN_PIXELS     = 12;   // Minimum orange pixels to count as ball
  var COLOR_MAX_PIXELS     = 8000; // Maximum (too large = not a ball)

  /* ── 2D Kalman Filter (position + velocity) ─────────────────── */
  /* State: [x, y, vx, vy]  —  constant-velocity model with gravity */
  var KALMAN_PROCESS_NOISE = 0.5;   // How much we trust the physics model
  var KALMAN_MEASURE_NOISE = 3.0;   // How noisy the detections are (pixels)
  var KALMAN_GRAVITY       = 0.6;   // Gravity pull per frame (0.4 was too weak, ball stalled mid-flight)
  var KALMAN_MAX_PREDICT   = 60;    // Max frames to predict (~2s at 30fps — covers long 3-pointers)

  function createKalman() {
    return {
      x: 0, y: 0, vx: 0, vy: 0,    // State estimate
      // Covariance diagonal (simplified — no cross-terms needed for this use case)
      px: 100, py: 100, pvx: 100, pvy: 100,
      initialized: false,
      predictCount: 0                 // Frames since last measurement
    };
  }

  function kalmanPredict(kf) {
    // State prediction (constant velocity + gravity on Y)
    kf.x  += kf.vx;
    kf.y  += kf.vy + KALMAN_GRAVITY * 0.5;
    kf.vy += KALMAN_GRAVITY;
    // Covariance grows with process noise
    kf.px  += kf.pvx + KALMAN_PROCESS_NOISE;
    kf.py  += kf.pvy + KALMAN_PROCESS_NOISE;
    kf.pvx += KALMAN_PROCESS_NOISE;
    kf.pvy += KALMAN_PROCESS_NOISE;
    kf.predictCount++;
  }

  function kalmanUpdate(kf, mx, my) {
    if (!kf.initialized) {
      kf.x = mx; kf.y = my; kf.vx = 0; kf.vy = 0;
      kf.px = KALMAN_MEASURE_NOISE; kf.py = KALMAN_MEASURE_NOISE;
      kf.pvx = 10; kf.pvy = 10;
      kf.initialized = true;
      kf.predictCount = 0;
      return;
    }
    // Kalman gains (simplified diagonal)
    var kx  = kf.px  / (kf.px  + KALMAN_MEASURE_NOISE);
    var ky  = kf.py  / (kf.py  + KALMAN_MEASURE_NOISE);
    // Innovation (measurement residual)
    var ix = mx - kf.x;
    var iy = my - kf.y;
    // Update velocity from position correction (clamped to prevent jitter explosions)
    kf.vx = Math.max(-100, Math.min(100, kf.vx + ix * 0.3));
    kf.vy = Math.max(-120, Math.min(120, kf.vy + iy * 0.3));
    // Update position
    kf.x += kx * ix;
    kf.y += ky * iy;
    // Update covariance
    kf.px  *= (1 - kx);
    kf.py  *= (1 - ky);
    kf.pvx *= 0.95;  // Velocity covariance decays slowly
    kf.pvy *= 0.95;
    kf.predictCount = 0;
  }

  function kalmanReset(kf) {
    kf.x = 0; kf.y = 0; kf.vx = 0; kf.vy = 0;
    kf.px = 100; kf.py = 100; kf.pvx = 100; kf.pvy = 100;
    kf.initialized = false;
    kf.predictCount = 0;
  }

  /* ── Tracker (with Kalman filter) ──────────────────────────── */
  function createTracker() {
    return {
      positions: [],
      lastSeenFrame: -1,
      isTracking: false,
      frameCount: 0,
      kalman: createKalman()
    };
  }

  function updateTracker(tracker, x, y) {
    var frameNum = tracker.frameCount++;
    var kf = tracker.kalman;

    if (x !== null && y !== null) {
      // Measurement available — update Kalman
      kalmanUpdate(kf, x, y);
      // Use Kalman-smoothed position
      var sx = kf.x;
      var sy = kf.y;

      var last = tracker.positions[tracker.positions.length - 1];
      if (last) {
        var dx = Math.abs(sx - last.x);
        var dy = Math.abs(sy - last.y);
        if (dx < MIN_MOVEMENT_PX && dy < MIN_MOVEMENT_PX) {
          tracker.lastSeenFrame = frameNum;
          return;
        }
      }
      tracker.positions.push({ x: sx, y: sy, frame: frameNum, ts: Date.now() });
      if (tracker.positions.length > MAX_HISTORY) {
        tracker.positions = tracker.positions.slice(-MAX_HISTORY);
      }
      tracker.lastSeenFrame = frameNum;
      tracker.isTracking = true;
    } else {
      // No measurement — predict with Kalman if still within prediction window
      // Extended window during active shot (RISING/FALLING) via _activeShot flag
      var maxPredict = tracker._activeShotExtend ? Math.floor(KALMAN_MAX_PREDICT * 1.5) : KALMAN_MAX_PREDICT;
      // L31: stop predicting once the ghost leaves the frame (10% slack).
      // Eval logs showed the constant-velocity ghost sailing to x = 4.4×
      // frame width over several seconds, feeding the UI and bloating the
      // position buffer with fiction.
      var ghostInFrame = true;
      if (tracker._vw > 0 && tracker._vh > 0) {
        ghostInFrame = kf.x >= -tracker._vw * 0.1 && kf.x <= tracker._vw * 1.1 &&
                       kf.y >= -tracker._vh * 0.3 && kf.y <= tracker._vh * 1.1;
      }
      if (kf.initialized && kf.predictCount < maxPredict && ghostInFrame) {
        kalmanPredict(kf);
        // Push predicted position (marked as predicted)
        tracker.positions.push({ x: kf.x, y: kf.y, frame: frameNum, ts: Date.now(), predicted: true });
        if (tracker.positions.length > MAX_HISTORY) {
          tracker.positions = tracker.positions.slice(-MAX_HISTORY);
        }
        tracker.lastSeenFrame = frameNum;
        // Keep tracking alive during prediction
      } else if (tracker.isTracking && frameNum - tracker.lastSeenFrame > MAX_GAP_FRAMES) {
        tracker.isTracking = false;
      }
    }
  }

  function resetTracker(tracker) {
    tracker.positions = [];
    tracker.lastSeenFrame = -1;
    tracker.isTracking = false;
    kalmanReset(tracker.kalman);
  }

  function getTrajectoryNormalized(tracker, w, h, count) {
    count = count || 20;
    return tracker.positions.slice(-count).map(function (pt) {
      return { x: pt.x / w, y: pt.y / h, frame: pt.frame };
    });
  }

  /* ── Time-based rising detector ───────────────────────────────
     Returns true if the ball rose (Y decreased) by at least
     `minDeltaNorm` of the frame height across any window ending
     "now" with span up to `windowMs`. Cadence-agnostic — works
     whether YOLOX runs at 30 Hz, 5 Hz, or 1 Hz.
   ──────────────────────────────────────────────────────────── */
  function ballRoseInWindow(tracker, vh, windowMs, minDeltaNorm) {
    var pts = tracker.positions;
    if (!pts || pts.length < 2) return false;
    var now = Date.now();
    // L30: only MEASURED detections count as motion evidence. Kalman-
    // PREDICTED ghosts (pure physics, no pixels) used to satisfy this
    // trigger — one fired with the "ball" above the frame (normY=-0.07).
    var newestIdx = -1;
    for (var n = pts.length - 1; n >= 0; n--) {
      if (!pts[n].predicted) { newestIdx = n; break; }
    }
    if (newestIdx < 1) return false;
    var newest = pts[newestIdx];
    if (now - newest.ts > windowMs) return false;  // last real sighting is stale
    var oldest = null;
    for (var i = newestIdx - 1; i >= 0; i--) {
      if (now - pts[i].ts > windowMs) break;
      if (pts[i].predicted) continue;
      oldest = pts[i];
    }
    if (!oldest) return false;
    var deltaPx = oldest.y - newest.y;          // positive when ball moved up
    var deltaNorm = deltaPx / (vh || 720);
    return deltaNorm >= minDeltaNorm;
  }

  /* ── Rim Zone ───────────────────────────────────────────────── */
  function createRimZone(cx, cy, w, h) {
    return {
      centerX: cx, centerY: cy, width: w, height: h,
      left: cx - w / 2, right: cx + w / 2,
      top: cy - h / 2, bottom: cy + h / 2,
      approachLeft: cx - w * 2.5,
      approachRight: cx + w * 2.5,
      approachTop: cy - h * 8.0,
      approachBottom: cy + h * 10.0
    };
  }

  function isInsideRim(x, y, rim) {
    // Use expanded vertical zone (2x rim height) for more forgiving transit detection
    var expandedTop = rim.top - rim.height;
    var expandedBottom = rim.bottom + rim.height;
    return x >= rim.left && x <= rim.right && y >= expandedTop && y <= expandedBottom;
  }

  function isInApproachZone(x, y, rim) {
    return x >= rim.approachLeft && x <= rim.approachRight &&
           y >= rim.approachTop && y <= rim.approachBottom;
  }

  function isAboveRim(y, rim) { return y < rim.top; }
  function isBelowRim(y, rim) { return y > rim.bottom; }

  function isWithinHorizontalBounds(x, rim) {
    var margin = rim.width * 0.5;
    return x >= rim.left - margin && x <= rim.right + margin;
  }

  /* ── Shot Analysis ──────────────────────────────────────────── */
  function analyzeMade(trajectory, rim) {
    if (trajectory.length < 3) return { isMade: false, entryPoint: null };
    var enteredAbove = false, enteredRim = false, exitedBelow = false;
    var entryFrame = -1, entryPoint = null;
    var nearRim = false;

    for (var i = 0; i < trajectory.length; i++) {
      var pt = trajectory[i];
      if (!enteredAbove && isAboveRim(pt.y, rim)) {
        enteredAbove = true;
      }
      if (enteredAbove && !enteredRim && isInsideRim(pt.x, pt.y, rim)) {
        enteredRim = true;
        entryFrame = pt.frame;
        entryPoint = { x: pt.x, y: pt.y };
      }
      if (enteredAbove && !nearRim && isInApproachZone(pt.x, pt.y, rim) && Math.abs(pt.y - rim.centerY) < rim.height * 1.5) {
        nearRim = true;
        if (!entryPoint) entryPoint = { x: pt.x, y: pt.y };
        if (entryFrame < 0) entryFrame = pt.frame;
      }
      if ((enteredRim || nearRim) && isBelowRim(pt.y, rim)) {
        var frameLimit = enteredRim ? MADE_MAX_FRAMES : MADE_MAX_FRAMES * 1.5;
        if (pt.frame - entryFrame <= frameLimit && isWithinHorizontalBounds(pt.x, rim)) {
          exitedBelow = true;
          break;
        }
      }
      if (enteredRim && pt.frame - entryFrame > MADE_MAX_FRAMES) break;
    }
    var isMade = enteredAbove && (enteredRim || nearRim) && exitedBelow;
    return { isMade: isMade, entryPoint: entryPoint };
  }

  function analyzeMiss(trajectory, rim) {
    if (trajectory.length < 3) return { isMiss: false, entryPoint: null };
    var approached = false, approachPoint = null;

    for (var i = 0; i < trajectory.length; i++) {
      var pt = trajectory[i];
      if (!approached && isInApproachZone(pt.x, pt.y, rim)) {
        approached = true;
        approachPoint = { x: pt.x, y: pt.y };
      }
      if (approached && !isInApproachZone(pt.x, pt.y, rim)) {
        var exitedSide = pt.x < rim.approachLeft || pt.x > rim.approachRight;
        var exitedUp = pt.y < rim.approachTop;
        if (exitedSide || exitedUp) {
          return { isMiss: true, entryPoint: approachPoint };
        }
      }
    }
    if (approached) {
      var last = trajectory[trajectory.length - 1];
      // Don't trigger miss if ball is above or inside the rim zone — it could still go through!
      if (isAboveRim(last.y, rim)) return { isMiss: false, entryPoint: null };
      var nearRimVertically = Math.abs(last.y - rim.centerY) < rim.height * 3;
      if (nearRimVertically && isWithinHorizontalBounds(last.x, rim)) return { isMiss: false, entryPoint: null };
      // Need at least 8 trajectory points before deciding miss (give ball time to transit)
      if (trajectory.length < 8) return { isMiss: false, entryPoint: null };
      if (!isBelowRim(last.y, rim) || !isWithinHorizontalBounds(last.x, rim)) {
        return { isMiss: true, entryPoint: approachPoint };
      }
    }
    return { isMiss: false, entryPoint: null };
  }

  /* ── Launch Point Detection ────────────────────────────────── */
  function getLaunchPoint(tracker, vw, vh) {
    var pts = tracker.positions;
    if (pts.length < 3) return null;

    for (var i = 0; i < pts.length - 2; i++) {
      var dy1 = pts[i + 1].y - pts[i].y;
      var dy2 = pts[i + 2].y - pts[i + 1].y;
      if (dy1 < -MIN_MOVEMENT_PX && dy2 < -MIN_MOVEMENT_PX) {
        return { x: pts[i].x / vw, y: pts[i].y / vh };
      }
    }
    return { x: pts[0].x / vw, y: pts[0].y / vh };
  }

  function classifyShotZone(launchPt, rim, threePtDist) {
    if (!launchPt || !rim) return 'midrange';

    var dx = launchPt.x - rim.centerX;
    var dy = launchPt.y - rim.centerY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var xOffset = Math.abs(dx);

    if (!threePtDist || threePtDist <= 0) {
      if (xOffset < 0.08 && launchPt.y > rim.centerY + 0.15 && launchPt.y < rim.centerY + 0.30) return 'freeThrow';
      if (launchPt.y > rim.centerY + 0.25) return 'paint';
      if (launchPt.y > rim.centerY + 0.10) return 'midrange';
      return 'threePoint';
    }

    var paintThreshold = threePtDist * 0.40;
    var ftMinThreshold = threePtDist * 0.28;
    var ftMaxThreshold = threePtDist * 0.45;
    var midrangeThreshold = threePtDist * 0.85;

    if (xOffset < threePtDist * 0.10 && dist >= ftMinThreshold && dist <= ftMaxThreshold) return 'freeThrow';
    if (dist <= paintThreshold) return 'paint';
    if (dist <= midrangeThreshold) return 'midrange';
    return 'threePoint';
  }

  /* ── Color-Based Ball Detection (fallback) ─────────────────── */
  /* Uses AdaptiveLearning if available, otherwise hardcoded ranges */
  function detectBallByColor(canvas, ctx, vw, vh) {
    /* Prefer learned color model if available */
    if (window.AdaptiveLearning && window.AdaptiveLearning.color.confidence > 0.3) {
      return window.AdaptiveLearning.detectBallByLearnedColor(canvas, ctx, vw, vh);
    }
    return _detectBallByDefaultColor(canvas, ctx, vw, vh);
  }

  function _detectBallByDefaultColor(canvas, ctx, vw, vh) {
    if (!canvas || !ctx || vw < 10 || vh < 10) return null;

    try {
      var imgData = ctx.getImageData(0, 0, vw, vh);
      var data = imgData.data;
    } catch (e) {
      return null;
    }

    /* Grid-based clustering: divide frame into cells, find dense orange cells,
       then cluster adjacent cells to locate the basketball.
       This avoids the gym-floor problem where scattered orange pixels
       create a bounding box covering 40%+ of the frame. */
    var CELL = 16;  // cell size in pixels
    var gridW = Math.ceil(vw / CELL);
    var gridH = Math.ceil(vh / CELL);
    var grid = new Uint16Array(gridW * gridH);  // orange pixel count per cell

    // Count orange pixels per cell
    for (var y = 0; y < vh; y += COLOR_SCAN_STEP) {
      for (var x = 0; x < vw; x += COLOR_SCAN_STEP) {
        var idx = (y * vw + x) * 4;
        var r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (r > 120 && g > 40 && g < 180 && b < 100 && r > g * 1.15 && r > b * 1.6) {
          var gx = Math.floor(x / CELL);
          var gy = Math.floor(y / CELL);
          grid[gy * gridW + gx]++;
        }
      }
    }

    // Find dense cells (>= 2 orange pixels per cell = roughly 50% density at step 4)
    var DENSE_THRESH = 2;
    var visited = new Uint8Array(gridW * gridH);
    var bestCluster = null;
    var bestCount = 0;

    for (var cy = 0; cy < gridH; cy++) {
      for (var cx = 0; cx < gridW; cx++) {
        var gi = cy * gridW + cx;
        if (grid[gi] < DENSE_THRESH || visited[gi]) continue;

        // BFS flood-fill to find connected cluster of dense cells
        var queue = [gi];
        visited[gi] = 1;
        var clMinX = cx, clMaxX = cx, clMinY = cy, clMaxY = cy;
        var clCount = 0;
        var clSumX = 0, clSumY = 0;

        while (queue.length > 0) {
          var cur = queue.shift();
          var curY = Math.floor(cur / gridW);
          var curX = cur % gridW;
          var cellPx = grid[cur];
          clCount += cellPx;
          clSumX += (curX * CELL + CELL / 2) * cellPx;
          clSumY += (curY * CELL + CELL / 2) * cellPx;
          if (curX < clMinX) clMinX = curX;
          if (curX > clMaxX) clMaxX = curX;
          if (curY < clMinY) clMinY = curY;
          if (curY > clMaxY) clMaxY = curY;

          // Check 4-connected neighbors
          var neighbors = [
            curY > 0 ? (curY - 1) * gridW + curX : -1,
            curY < gridH - 1 ? (curY + 1) * gridW + curX : -1,
            curX > 0 ? curY * gridW + (curX - 1) : -1,
            curX < gridW - 1 ? curY * gridW + (curX + 1) : -1
          ];
          for (var ni = 0; ni < 4; ni++) {
            var n = neighbors[ni];
            if (n >= 0 && !visited[n] && grid[n] >= DENSE_THRESH) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }

        if (clCount > bestCount) {
          bestCount = clCount;
          bestCluster = {
            count: clCount,
            cx: clSumX / clCount,
            cy: clSumY / clCount,
            minX: clMinX * CELL,
            minY: clMinY * CELL,
            maxX: (clMaxX + 1) * CELL,
            maxY: (clMaxY + 1) * CELL
          };
        }
      }
    }

    if (!bestCluster || bestCluster.count < COLOR_MIN_PIXELS) return null;
    if (bestCluster.count > COLOR_MAX_PIXELS) return null;

    var blobW = bestCluster.maxX - bestCluster.minX;
    var blobH = bestCluster.maxY - bestCluster.minY;

    if (blobW < 3 || blobH < 3) return null;
    var aspect = Math.max(blobW, blobH) / Math.min(blobW, blobH);
    if (aspect > 3.0) return null;

    // Cluster compactness: w/h ratio between 0.5-2.0 rejects elongated shapes (arms/legs)
    var whRatio = blobW / (blobH || 1);
    if (whRatio < 0.5 || whRatio > 2.0) return null;

    var blobArea = blobW * blobH;
    var frameArea = vw * vh;
    if (blobArea < frameArea * BALL_MIN_AREA_FRAC || blobArea > frameArea * BALL_MAX_AREA_FRAC) return null;

    var fillRatio = (bestCluster.count * COLOR_SCAN_STEP * COLOR_SCAN_STEP) / blobArea;
    if (fillRatio < 0.10) return null;  // slightly relaxed for grid approach

    return { x: bestCluster.cx, y: bestCluster.cy, w: blobW, h: blobH, score: 0.5 + fillRatio * 0.3 };
  }

  /* ── Main Detection Engine ──────────────────────────────────── */
  var ShotDetectionEngine = {
    model: null,
    tracker: null,
    rimZone: null,
    threePtDistance: 0,
    lastShotTime: 0,
    isRunning: false,
    detectionTimer: null,
    videoEl: null,
    _canvas: null,
    _ctx: null,
    stats: { made: 0, attempts: 0 },
    ballPosition: null,
    onShotDetected: null,
    onBallUpdate: null,
    onHoopDetected: null,
    onStatusChange: null,
    onDebugFrame: null,     // callback({ balls: [], hoops: [], shotState, kalman, frameCount })
    _isDetecting: false,
    _colorOnlyMode: false,
    _mlMissCount: 0,
    _frameCount: 0,
    _detectorType: 'none',   // 'yolox' | 'none'
    _procW: 0,
    _procH: 0,
    _shotState: 'idle',      // idle | shot_started | near_hoop | cooldown
    _shotStateTime: 0,       // timestamp when current state started
    _ballMinY: 1.0,          // lowest Y (highest point) seen during current shot arc
    _shotStartY: 1.0,        // Y position when shot arc started (for min arc height check)
    _sawBallAboveRim: false, // sticky flag: was ball ever above rim during this shot?
    _rimStabilized: false,   // gate: state machine ignores rim until screen flips this on
    _shotTriggerSrc: null,   // 'pose' | 'ball' — what fired the current shot_started
    _releaseConfidence: null,// 0-1, only meaningful when _shotTriggerSrc === 'pose'
    _shooterFeetX: null,     // normalized x of shooter hip centroid at release (pose-only)
    _shooterFeetY: null,     // normalized y of shooter hip centroid at release (pose-only)

    init: function () {
      var self = this;
      self.tracker = createTracker();
      self._colorOnlyMode = false;
      self._mlMissCount = 0;
      self._frameCount = 0;
      self._detectorType = 'none';

      // Create internal canvas for color detection
      if (!self._canvas) {
        self._canvas = document.createElement('canvas');
        self._ctx = self._canvas.getContext('2d', { willReadFrequently: true });
      }

      if (self.model) {
        self._detectorType = 'yolox';
        return Promise.resolve(true);
      }

      self._setStatus('loading');

      return new Promise(function (resolve) {
        self._tryLoadModel(resolve);
      });
    },

    _tryLoadModel: function (resolve) {
      var self = this;

      /* Guard: ONNX Runtime must be available */
      if (typeof ort === 'undefined') {
        console.warn('[ShotDetection] ONNX Runtime not available — color-only mode');
        self._colorOnlyMode = true;
        self._detectorType = 'none';
        self._setStatus('color-only');
        resolve(true);
        return;
      }

      // Model path resolves against THIS SCRIPT's URL (see SCRIPT_BASE).
      // A page-relative path 404s on pages served from a sub-path and the
      // engine silently became color-only.
      var modelPath = SCRIPT_BASE + 'models/basketball_yolox_tiny_v6_polished.onnx?v=v6polished';

      // executionProviders WITHOUT 'webgl' on purpose: the v6 ONNX graph
      // contains int64 initializers, and ORT-Web's WebGL EP rejects int64
      // with "int64 is not supported" during InferenceSession.create.
      // Crucially, ORT does NOT auto-fall-through to the next EP on parse
      // failure — so each backend gets its own create() attempt:
      //   1. webgpu       — GPU inference. Requires the ort.webgpu.min.js
      //      bundle; plain ort.min.js ships WITHOUT the WebGPU EP, which
      //      used to silently fall through to a main-thread WASM session
      //      (~1.4s per inference, ~0.7Hz instead of the ~5Hz the state
      //      machine assumes).
      //   2. wasm + proxy — WASM inside a dedicated worker. Same latency,
      //      but off the main thread so video/pose/color keep flowing.
      //   3. wasm         — last resort (proxy can fail under file:// or
      //      a restrictive CSP).
      var attempts = [
        { eps: ['webgpu'], proxy: false, label: 'webgpu' },
        { eps: ['wasm'],   proxy: true,  label: 'wasm-proxy' },
        { eps: ['wasm'],   proxy: false, label: 'wasm-main-thread' }
      ];

      var tryAttempt = function (i) {
        if (i >= attempts.length) {
          console.error('[ShotDetection] YOLOX-tiny load failed on every backend — color-only mode');
          self._colorOnlyMode = true;
          self._detectorType = 'none';
          self._setStatus('color-only');
          resolve(true);
          return;
        }
        var att = attempts[i];
        // proxy must be set BEFORE the wasm backend first initializes;
        // attempt order guarantees that (webgpu failing does not init wasm).
        try { ort.env.wasm.proxy = att.proxy; } catch (e) { /* read-only in exotic builds */ }

        ort.InferenceSession.create(modelPath, {
          executionProviders: att.eps,
          graphOptimizationLevel: 'all'
        }).then(function (session) {
          self.model = session;
          self._detectorType = 'yolox';
          self._backend = att.label;
          // Pre-allocate reusable buffers
          var sz = YOLOX_INPUT_SIZE;
          _yoloxBuf = new Float32Array(1 * 3 * sz * sz);
          _yoloxCanvas = document.createElement('canvas');
          _yoloxCanvas.width = sz;
          _yoloxCanvas.height = sz;
          _yoloxCtx = _yoloxCanvas.getContext('2d');
          if (att.label === 'webgpu') {
            console.log('[ShotDetection] YOLOX-tiny v6 loaded — backend: webgpu');
          } else {
            // Degraded performance is a real production signal — not gated.
            console.warn('[ShotDetection] YOLOX-tiny v6 loaded — backend: ' + att.label +
              ' (degraded: expect ~1.4s/inference; check that ort.webgpu.min.js is the loaded bundle and WebGPU is available)');
          }
          // Kick off PoseDetector load in PARALLEL. It is not awaited — the
          // engine works fine with ball-only detection if pose never arrives.
          // When pose IS ready, _analyzeShotState picks it up automatically
          // because isReady() returns true.
          if (window.PoseDetector && typeof window.PoseDetector.init === 'function') {
            window.PoseDetector.init().then(function () {
              dlog('[ShotDetection] PoseDetector ready — pose-driven shot trigger active');
            }).catch(function (poseErr) {
              console.warn('[ShotDetection] PoseDetector init failed — ball-only mode:', poseErr && poseErr.message);
            });
          }
          self._setStatus('ready');
          resolve(true);
        }).catch(function (err) {
          console.warn('[ShotDetection] YOLOX load failed on ' + att.label + ': ' +
            (err && err.message ? err.message : err));
          tryAttempt(i + 1);
        });
      };
      tryAttempt(0);
    },

    setRimZone: function (normCX, normCY, normW, normH) {
      this.rimZone = createRimZone(normCX, normCY, normW, normH);
    },

    // Toggled by the screen once the auto-locked rim has had time to converge.
    // When false, _analyzeShotState short-circuits — keeps the state machine
    // from counting shots while the rim position is still drifting in.
    setRimStabilized: function (b) {
      this._rimStabilized = !!b;
    },

    setThreePtDistance: function (dist) {
      this.threePtDistance = dist;
    },

    start: function (videoEl) {
      if (this.isRunning) return;
      // Allow start even without ML model — color detection works
      if (!this.model && !this._colorOnlyMode) {
        console.warn('Model not loaded yet, enabling color-only mode');
        this._colorOnlyMode = true;
      }

      this.videoEl = videoEl;
      this.isRunning = true;
      this.stats = { made: 0, attempts: 0 };
      this.lastShotTime = 0;
      this._mlMissCount = 0;
      this._frameCount = 0;
      // Crop region is per-video — a previous session's UI-overlay crop
      // must not leak into a new video with different dimensions/chrome.
      this._cropRegion = undefined;
      this._shotState = 'idle';
      this._shotStateTime = 0;
      this._ballMinY = 1.0;
      this._shotStartY = 1.0;
      this._sawBallAboveRim = false;
      this._rimStabilized = false;
      this._shotTriggerSrc = null;
      this._releaseConfidence = null;
      this._shooterFeetX = null;
      this._shooterFeetY = null;
      // L7 diagnostic state — fresh per session so counters reflect this run only
      this._lastShotReason = null;
      this._poseStats = { checks: 0, triggers: 0, lastConfidence: 0 };
      this._shotTrajectory = [];
      this._lastCrossing = null;
      // L9.2: post-crossing watch state
      this._postCrossingWatch = null;
      // L12: preflight safety check — accumulate detection counts for the
      // three entities (ball / hoop / player). Shot counting is gated until
      // all three thresholds are met, so we never spam false misses while
      // the model is still warming up or the scene hasn't fully revealed
      // its contents.
      // L15: drop ball from preflight requirement. The strict ball verifier
      // (orange + round + small) blocks for 15-20s on TikTok-style compressed
      // footage where YOLOX's "ball" detections are mostly on logos and the
      // rim. Hoop + player are sufficient as a calibration gate. Keep ball
      // counter in the struct so the overlay still shows it as "seen N".
      this._preflightChecks = { ball: 0, hoop: 0, player: 0 };
      this._preflightThresholds = { ball: 0, hoop: 5, player: 3 };
      this._preflightReady = false;
      this._preflightStartedAt = Date.now();
      // L14.B / L14.C: ball-near-rim tracker + per-shot event log
      this._ballSeenAtRim = false;
      this._ballNearRimHits = 0;
      // L30: ordered through-rim evidence (above the rim → below it within
      // the made span) — the only signal allowed to convert miss → made.
      this._ballAboveRimAt = 0;
      this._ballThroughRimAt = 0;
      this._lastBallDetMs = 0;
      // L31: rim-transit detector state
      this._transitBaseA = null;
      this._transitBaseB = null;
      this._transitSadBaseA = 0;
      this._transitSadBaseB = 0;
      this._transitAboveAt = 0;
      this._transitPrev = null;
      this._transitEventAt = 0;
      this._shotEventLog = [];
      this._sessionStartedAt = Date.now();
      // Reset pose history so the new session starts fresh — important when
      // re-using a single engine for several uploaded videos in a row.
      if (window.PoseDetector) {
        if (typeof window.PoseDetector.reset === 'function')      window.PoseDetector.reset();
        if (typeof window.PoseDetector.resetMotion === 'function') window.PoseDetector.resetMotion();
      }
      resetTracker(this.tracker);
      this._setStatus('detecting');
      this._scheduleDetection();
      // Pose loop kicks itself off via requestVideoFrameCallback (or
      // a setInterval fallback). It self-schedules from inside, so we
      // just call it once here.
      if (this._poseInterval) { clearInterval(this._poseInterval); this._poseInterval = null; }
      if (this._poseRafId)    { cancelAnimationFrame(this._poseRafId); this._poseRafId = null; }
      this._poseLoop();
    },

    stop: function () {
      // L32: flush a pending rim event before tearing down — a shot in the
      // final second of a video used to vanish with the session (eval v3
      // lost its last put-back to truncation). Through-evidence → made;
      // an armed event older than 500ms with no through → missed.
      if (this._transitEventAt && this.videoEl) {
        var flushVw = this.videoEl.videoWidth  || 1;
        var flushVh = this.videoEl.videoHeight || 1;
        var flushRes = this._ballThroughRimAt > 0 ? 'made'
                     : (Date.now() - this._transitEventAt > 500 ? 'missed' : null);
        this._transitEventAt = 0;
        if (flushRes) {
          if (this._shotState === 'idle') {
            this._shotTriggerSrc    = 'rim-event';
            this._releaseConfidence = 0.6;
          }
          this._logShotEvent('rim-event-flushed', { result: flushRes });
          this._countShot(flushRes, flushVw, flushVh,
            this.rimZone ? this.rimZone.centerX : 0.5,
            this.rimZone ? this.rimZone.centerY : 0.4, Date.now());
        }
      }
      this.isRunning = false;
      if (this.detectionTimer) {
        clearTimeout(this.detectionTimer);
        this.detectionTimer = null;
      }
      if (this._poseInterval) { clearInterval(this._poseInterval); this._poseInterval = null; }
      if (this._poseRafId)    { cancelAnimationFrame(this._poseRafId); this._poseRafId = null; }
      this.ballPosition = null;
      this._setStatus('stopped');
    },

    resetStats: function () {
      this.stats = { made: 0, attempts: 0 };
      resetTracker(this.tracker);
      this.lastShotTime = 0;
      this.ballPosition = null;
    },

    /* ── L14.C: per-shot event log (public API) ──────────────────
       Returns the in-memory event log as JSON so the user can paste it
       back for diagnosis. Each entry has: tElapsed (ms since session
       start), type (pose-trigger, pose-rejected, shot-counted, …), and
       a payload object. Capped at 200 events (oldest dropped). */
    dumpShotLog: function () {
      var log = this._shotEventLog || [];
      var summary = {
        sessionMs: this._sessionStartedAt ? Date.now() - this._sessionStartedAt : 0,
        events:    log.length,
        stats:     this.stats,
        log:       log
      };
      return JSON.stringify(summary, null, 2);
    },

    /* ── Internal ──────────────────────────────────────────────── */

    _logShotEvent: function (type, payload) {
      if (!this._shotEventLog) this._shotEventLog = [];
      this._shotEventLog.push({
        tElapsed: Date.now() - (this._sessionStartedAt || Date.now()),
        type:     type,
        state:    this._shotState,
        payload:  payload || {}
      });
      // Cap log size — 200 events covers a long session without
      // ballooning memory.
      if (this._shotEventLog.length > 200) this._shotEventLog.shift();
    },

    _scheduleDetection: function () {
      var self = this;
      if (!self.isRunning) return;
      self.detectionTimer = setTimeout(function () {
        self._detectFrame();
      }, DETECTION_INTERVAL);
    },

    _drawToCanvas: function () {
      var vw = this.videoEl.videoWidth;
      var vh = this.videoEl.videoHeight;
      if (vw < 10 || vh < 10) return false;

      /* ── Auto-detect UI overlay (screen recording) ──────────── */
      /* If video has overlay UI (nav bar at top, buttons at bottom),
         crop it out before processing. Detected once on first frame. */
      if (this._cropRegion === undefined) {
        this._cropRegion = this._detectUIOverlay(vw, vh);
      }
      var crop = this._cropRegion;

      /* Source region from video (after crop) */
      var srcX = crop.x, srcY = crop.y;
      var srcW = crop.w, srcH = crop.h;

      /* Downscale to max 640px wide for processing (was 480 — too small for distant balls) */
      var maxW = 640;
      var scale = srcW > maxW ? maxW / srcW : 1;
      var pw = Math.floor(srcW * scale);
      var ph = Math.floor(srcH * scale);

      if (this._canvas.width !== pw) this._canvas.width = pw;
      if (this._canvas.height !== ph) this._canvas.height = ph;
      /* Draw only the cropped region of the video */
      this._ctx.drawImage(this.videoEl, srcX, srcY, srcW, srcH, 0, 0, pw, ph);

      /* Store crop info for coordinate mapping back to full video */
      this._procW = pw;
      this._procH = ph;
      this._cropOffsetX = srcX;
      this._cropOffsetY = srcY;
      this._cropScaleX = srcW / pw;
      this._cropScaleY = srcH / ph;
      return true;
    },

    /* ── Detect if video has UI overlay (screen recording) ─────── */
    /* Checks for dark bands at top/bottom that indicate app chrome */
    _detectUIOverlay: function (vw, vh) {
      /* Draw first frame to a temp canvas for analysis */
      var tc = document.createElement('canvas');
      tc.width = vw; tc.height = vh;
      var tctx = tc.getContext('2d');
      tctx.drawImage(this.videoEl, 0, 0, vw, vh);

      /* Sample darkness at top and bottom bands */
      var topDark = 0, botDark = 0;
      var sampleRows = Math.min(Math.floor(vh * 0.12), 100);
      var step = 8;

      try {
        /* Top band */
        var topData = tctx.getImageData(0, 0, vw, sampleRows).data;
        var topTotal = 0;
        for (var i = 0; i < topData.length; i += step * 4) {
          var brightness = (topData[i] + topData[i+1] + topData[i+2]) / 3;
          if (brightness < 50) topDark++;
          topTotal++;
        }
        /* Bottom band */
        var botData = tctx.getImageData(0, vh - sampleRows, vw, sampleRows).data;
        var botTotal = 0;
        for (var i = 0; i < botData.length; i += step * 4) {
          var brightness = (botData[i] + botData[i+1] + botData[i+2]) / 3;
          if (brightness < 50) botDark++;
          botTotal++;
        }
      } catch(e) {
        return { x: 0, y: 0, w: vw, h: vh };
      }

      var topDarkRatio = topTotal > 0 ? topDark / topTotal : 0;
      var botDarkRatio = botTotal > 0 ? botDark / botTotal : 0;

      /* If >60% of top/bottom is dark = likely UI overlay from screen recording */
      var cropTop = topDarkRatio > 0.6 ? Math.floor(vh * 0.13) : 0;
      var cropBot = botDarkRatio > 0.6 ? Math.floor(vh * 0.12) : 0;

      if (cropTop > 0 || cropBot > 0) {
        dlog('[ShotDetection] UI overlay detected — cropping top=' + cropTop + 'px bottom=' + cropBot + 'px (darkRatio top=' + topDarkRatio.toFixed(2) + ' bot=' + botDarkRatio.toFixed(2) + ')');
      }

      return { x: 0, y: cropTop, w: vw, h: vh - cropTop - cropBot };
    },

    /* ── Pose detection loop (independent of _detectFrame cadence)
       The YOLOX inference path inside _detectFrame can backlog the
       main setInterval, dragging _detectFrame's effective cadence
       from 30 Hz down to ~5 Hz — too slow for pose to catch a
       release peak (~200 ms window).

       We use BOTH primitives:
         - requestAnimationFrame fires on foreground frames (30-60 Hz)
         - setInterval is the fallback when the page is backgrounded
       Whichever ticks first calls _pollPoseShot. _pollPoseShot itself
       has a small dedupe (per-currentTime caching inside the
       PoseDetector) so double-fires are cheap no-ops.
     ──────────────────────────────────────────────────────────── */
    _poseLoop: function () {
      var self = this;
      if (!self.isRunning || !self.videoEl) return;

      var doPoll = function () {
        if (!self.isRunning) return;
        if (self.videoEl && self.videoEl.readyState >= 2 && self.rimZone &&
            window.PoseDetector && window.PoseDetector.isReady()) {
          self._pollPoseShot();
        }
      };

      // setInterval fallback — guaranteed to fire (just throttled when
      // backgrounded). 33 ms = 30 Hz when foreground.
      self._poseInterval = setInterval(doPoll, 33);

      // rAF loop — also calls doPoll. Higher cadence when foreground.
      var rafTick = function () {
        if (!self.isRunning) return;
        doPoll();
        self._poseRafId = requestAnimationFrame(rafTick);
      };
      self._poseRafId = requestAnimationFrame(rafTick);
    },

    _pollPoseShot: function () {
      var self = this;
      var pose = window.PoseDetector.detect(self.videoEl, self.videoEl.currentTime);
      if (!pose || !pose.landmarks) return;

      // Quality gate — narrow version. We only need the joints the
      // shooting-motion heuristic actually consumes (nose + at least one
      // wrist/elbow/shoulder triple). MediaPipe Pose Lite still emits 33
      // landmarks even when no real person is in the frame, but the
      // motion heuristic already filters with visibilityMin: 0.15 on the
      // specific joints it inspects. The earlier full 11-joint quality
      // gate (≥5 with visibility ≥0.5 across hips/knees too) was rejecting
      // legitimate shooters who were partially framed — the standalone
      // bench got 84% recall on v2 indoor; this version dropped to 8%
      // (2/25) because of over-strict gating. We just require nose +
      // ONE complete shooting-arm chain (shoulder→elbow→wrist) at vis ≥
      // 0.5. Hallucinated poses almost never satisfy a full chain.
      var lms = pose.landmarks;
      var visEnough = function (i) { return lms[i] && (lms[i].visibility || 0) >= 0.5; };
      var noseOk = visEnough(0);
      var leftArmOk  = visEnough(11) && visEnough(13) && visEnough(15); // L-shoulder, L-elbow, L-wrist
      var rightArmOk = visEnough(12) && visEnough(14) && visEnough(16); // R-shoulder, R-elbow, R-wrist
      if (!noseOk || (!leftArmOk && !rightArmOk)) return;

      var vw = self.videoEl.videoWidth  || 1;
      var vh = self.videoEl.videoHeight || 1;

      // ── L7 REVERT: Pose-shot trigger (baseline — no L1/L4c gates) ──
      // L1 (ball-in-hand) and L4c (ball-velocity-up) gates were removed because
      // they hurt recall more than they helped — real shots were being rejected.
      // We now accept any pose-detected shooting motion directly. False positives
      // are visible in the debug overlay so gates can be re-introduced one-by-one
      // with measured impact (Step 3 of L7 plan).
      //
      // _poseStats tracks every pose check so the debug overlay can show how
      // often PoseDetector is even seeing a shooting motion — that helps
      // distinguish "trigger didn't fire" from "trigger fired but state machine
      // dropped it later".
      if (self._shotState === 'idle') {
        if (!self._poseStats) self._poseStats = { checks: 0, triggers: 0, lastConfidence: 0 };
        self._poseStats.checks++;
        var motion = window.PoseDetector.detectShootingMotion(pose.landmarks, Date.now());
        // L23: if the strict heuristic didn't fire, try the universal
        // "hand-at-head" set-point heuristic. Tag the trigger source so
        // we can tell them apart in logs.
        if (!motion.isShot && typeof window.PoseDetector.detectSetPointMotion === 'function') {
          var sp = window.PoseDetector.detectSetPointMotion(pose.landmarks, Date.now());
          if (sp.isShot) {
            motion = sp;
          }
        }
        if (!motion.isShot && motion.reason && motion.reason !== 'cooldown') {
          // Log non-cooldown rejections only; cooldown spams too much.
          // Throttle to one rejection log per unique reason per 500ms.
          var nowR = Date.now();
          if (!self._lastPoseRejectAt) self._lastPoseRejectAt = {};
          if (!self._lastPoseRejectAt[motion.reason] ||
              (nowR - self._lastPoseRejectAt[motion.reason]) > 500) {
            self._lastPoseRejectAt[motion.reason] = nowR;
            self._logShotEvent('pose-rejected', { reason: motion.reason });
          }
        }
        if (motion.isShot) {
          self._poseStats.triggers++;
          self._poseStats.lastConfidence = motion.releaseConfidence;

          var sx = (pose.landmarks[15].y < pose.landmarks[16].y ? pose.landmarks[15] : pose.landmarks[16]);
          self._shotState         = 'shot_started';
          self._shotStateTime     = Date.now();
          self._ballMinY          = sx.y;
          self._shotStartY        = sx.y;
          self._sawBallAboveRim   = (sx.y < self.rimZone.centerY);
          // L23: tag set-point triggers separately so logs / upgrade code
          // can distinguish them from strict shooting-motion triggers.
          self._shotTriggerSrc    = motion.detector === 'setpoint' ? 'pose-setpoint' : 'pose';
          self._releaseConfidence = motion.releaseConfidence;
          self._shooterFeetX      = motion.shooterCenterX;
          self._shooterFeetY      = motion.shooterCenterY;
          self._shotTrajectory    = [];   // Phase L2: reset trajectory for this shot
          self._postCrossingWatch = null; // L9.2: clear any stale watch state
          self._ballSeenAtRim     = false;// L14.B: reset rim-proximity flag
          self._ballNearRimHits   = 0;
          self._ballAboveRimAt    = 0;    // L30: reset through-rim evidence
          self._ballThroughRimAt  = 0;
          self._lastShotReason    = 'TRIGGER conf=' + motion.releaseConfidence.toFixed(2) +
                                    ' hand=' + (motion.shootingHand || '?') +
                                    ' src=' + self._shotTriggerSrc;
          self._logShotEvent(motion.detector === 'setpoint' ? 'pose-setpoint-trigger' : 'pose-trigger', {
            confidence:  motion.releaseConfidence,
            shootingHand: motion.shootingHand,
            detector:    motion.detector || 'shooting-motion'
          });
          dlog('[ShotState] shot_started (' + self._shotTriggerSrc + ') conf=' +
               motion.releaseConfidence.toFixed(2));
        }
      }

      // Pose-triggered shot fallback:
      // When the shot was triggered by pose and YOLOX never picks up
      // the ball (red ball, off-camera arc, etc.), wrist position is
      // not a valid proxy once the ball leaves the shooter's hand.
      // After POSE_SHOT_FALLBACK_MS we conservatively count it as a
      // miss so the attempt isn't silently dropped.
      //
      // IMPORTANT: defer the fallback while ball detection is still
      // hot. _processBallDetection stamps _lastBallDetMs every time
      // YOLOX detects the ball. If the ball was seen within the last
      // BALL_HOT_WINDOW_MS, we give the legacy state machine more time
      // to drive shot_started→near_hoop→made. This is what allows a
      // pose-triggered shot to be UPGRADED from "missed by fallback"
      // to "made via ball-trajectory" when both signals are present.
      // L29: was 700 — still slightly too eager. Real ball travel from the
      // release point to the rim Y line is 800-1200ms depending on shot
      // distance. The L26 ball-cross-rim trigger fires AS the ball crosses
      // the rim and pre-empts this fallback when YOLOX caught the ball.
      // Pose-fallback only kicks in for shots where ball tracking was lost
      // mid-arc — and there the right banner moment is "when the ball
      // would have arrived", i.e. ~1.1s after release.
      // L31.2: the rim-event counter (transit detector) is the PRIMARY
      // resolver for any shot whose ball reaches the rim. This fallback is
      // now hard-timeout-only: the old soft window (1.1-1.6s) kept ruling
      // "missed" while the ball was still mid-air (eval arcs ran 1.2-2.3s
      // from pose trigger to rim) and the rim event then counted the same
      // attempt AGAIN — every long make became a miss+made double.
      //
      // At the hard timeout the policy is evidence-based:
      //   • through-rim evidence  → made (rim event was consumed by a
      //     concurrent verdict path; count it)
      //   • rim activity happened but no through → missed (ball got there
      //     and bounced away; normally the rim event already resolved it
      //     and we never reach here)
      //   • ZERO rim activity since the trigger → DROP without counting.
      //     On eval footage pose triggers in verified-empty spans
      //     outnumber true never-reaches-rim airballs by a wide margin —
      //     counting these as misses poisons the stats with phantoms.
      var BALL_HOT_WINDOW_MS    = 600;
      var POSE_HARD_TIMEOUT_MS  = 3200;
      if (self._shotState === 'shot_started' && self._shotTriggerSrc === 'pose') {
        var elapsed = Date.now() - self._shotStateTime;
        var ballHot = self._lastBallDetMs && (Date.now() - self._lastBallDetMs) < BALL_HOT_WINDOW_MS;
        var transitHot = self._transitAboveAt && (Date.now() - self._transitAboveAt) < BALL_HOT_WINDOW_MS;
        // A pending rim event ALWAYS outranks the fallback — it resolves
        // within 1.4s with a real verdict for this very shot.
        var transitPending = !!self._transitEventAt;
        if (!transitPending && !ballHot && !transitHot && elapsed > POSE_HARD_TIMEOUT_MS) {
          // L33: pose timeouts NEVER self-count a miss. Every real miss
          // that reaches the rim arms a rim event (A-window) and gets
          // counted there with correct timing; the timeout-miss branch
          // only ever produced phantoms (pose fired, ball never came) and
          // miss+made doubles on tip plays (timeout verdict landing
          // mid-play, rim event counting the same attempt again seconds
          // later). Through-evidence → made stays: it is evidence-backed
          // and covers makes whose A-spike the detector missed.
          var fallbackResult = self._ballThroughRimAt > 0 ? 'made' : null;
          self._logShotEvent('pose-fallback', {
            elapsedMs:      elapsed,
            ballSeenAtRim:  !!self._ballSeenAtRim,
            ballThroughRim: !!self._ballThroughRimAt,
            resolvedAs:     fallbackResult || 'dropped-no-through'
          });
          if (fallbackResult) {
            var feetX = self._shooterFeetX != null ? self._shooterFeetX : 0.5;
            var feetY = self._shooterFeetY != null ? self._shooterFeetY : 0.8;
            self._countShot(fallbackResult, vw, vh, feetX, feetY, Date.now());
          } else {
            // Phantom trigger — reset without polluting the stats.
            self._shotState         = 'idle';
            self._shotStateTime     = Date.now();
            self._ballMinY          = 1.0;
            self._shotStartY        = 1.0;
            self._sawBallAboveRim   = false;
            self._shotTriggerSrc    = null;
            self._releaseConfidence = null;
            self._shooterFeetX      = null;
            self._shooterFeetY      = null;
          }
        }
      }
    },

    _detectFrame: function () {
      var self = this;
      if (!self.isRunning || !self.videoEl) return;
      if (self.videoEl.readyState < 2) { self._scheduleDetection(); return; }

      var vw = self.videoEl.videoWidth;
      var vh = self.videoEl.videoHeight;

      /* ── Draw to processing canvas ──────────────────────────── */
      var canvasReady = self._drawToCanvas();
      var pw = self._procW || vw;
      var ph = self._procH || vh;

      /* ── Color detection runs EVERY frame (not blocked by YOLOX) ── */
      var colorBall = null;
      if (canvasReady) {
        colorBall = detectBallByColor(self._canvas, self._ctx, pw, ph);
        // L32: global camera-motion estimate FIRST — its callback shifts
        // the locked rim, so the transit windows below sample the rim's
        // current (post-pan) position.
        self.tracker._vw = vw;
        self.tracker._vh = vh;
        self._estimateGlobalMotion(pw, ph, vw, vh);
        // L31: rim-transit detector — pixel-level through-rim evidence at
        // full loop cadence. Runs on footage where YOLOX cannot see the
        // in-flight ball at all (compressed/blurred video).
        self._updateRimTransit(pw, ph, vw, vh);
      }

      /* Scale ball positions from processing canvas back to FULL video coords
         (accounts for UI crop: proc canvas → cropped region → full video) */
      var scaleX = self._cropScaleX || (pw > 0 ? vw / pw : 1);
      var scaleY = self._cropScaleY || (ph > 0 ? vh / ph : 1);
      var offsetX = self._cropOffsetX || 0;
      var offsetY = self._cropOffsetY || 0;

      /* Process color detection — skip on frames where YOLOX will run */
      var isYoloxFrame = self.model && !self._colorOnlyMode && canvasReady &&
                         (self._frameCount + 1) % 6 === 0;
      if (!self._isDetecting && !isYoloxFrame) {
        if (colorBall) {
          self._processBallDetection(colorBall.x * scaleX + offsetX, colorBall.y * scaleY + offsetY, vw, vh);
        } else {
          self._processNoBall();
        }
      }

      /* ── YOLOX detection (async, non-blocking) ──
         L30: divisor 6 → 3 on the WebGPU backend. 6 was a safe floor for
         main-thread WASM (~1.4s/inference); on webgpu inference is tens of
         ms and the loop itself runs ~15-20Hz, so %6 starved ball sampling
         to ~2.7Hz (0-2 samples per shot arc). %3 restores ~5Hz. WASM
         backends keep the conservative 6. */
      self._frameCount++;
      var yoloxDivisor = (self._backend === 'webgpu') ? 3 : 6;
      if (self.model && !self._colorOnlyMode && !self._isDetecting && canvasReady && self._frameCount % yoloxDivisor === 0) {
        self._isDetecting = true;
        self._runYoloxInference(vw, vh, pw, ph, scaleX, scaleY, offsetX, offsetY, colorBall);
      }

      self._scheduleDetection();
    },

    /* ── YOLOX ONNX inference (async) ─────────────────────────── */
    _runYoloxInference: function (vw, vh, pw, ph, scaleX, scaleY, offsetX, offsetY, colorBall) {
      var self = this;
      var sz = YOLOX_INPUT_SIZE;

      // Letterbox preprocess: fit processing canvas into 640×640 with gray padding.
      // NOTE: image is drawn at (0,0), not centered. The decode at _yoloxDecode uses
      // `cx / ratio` with no offset, which matches this top-left placement. If you
      // ever centre the letterbox here, you must subtract the same offsets there.
      var ratio = Math.min(sz / ph, sz / pw);
      var newW = Math.round(pw * ratio);
      var newH = Math.round(ph * ratio);

      _yoloxCtx.fillStyle = 'rgb(114,114,114)';
      _yoloxCtx.fillRect(0, 0, sz, sz);
      _yoloxCtx.drawImage(self._canvas, 0, 0, pw, ph, 0, 0, newW, newH);

      var imgData = _yoloxCtx.getImageData(0, 0, sz, sz).data;

      // CHW transposition: use Web Worker if available, else inline.
      // Reassigning onmessage per call is safe ONLY because the _isDetecting
      // guard ensures one inference is in flight at a time. If that ever
      // changes, switch to a request-id keyed map of pending resolvers.
      var chwReady;
      if (_chwWorker) {
        chwReady = new Promise(function (resolve) {
          _chwWorker.onmessage = function (ev) { resolve(ev.data.buffer); };
          _chwWorker.postMessage({ imageData: imgData, size: sz }, [imgData.buffer]);
        });
      } else {
        // YOLOX trained on cv2.imread (BGR); canvas gives RGB. Must swap so
        // channel 0 = B, channel 2 = R. See yoloxWorker.js for full rationale
        // and training/v7/verify_channel_order.py for the empirical check.
        var chSize = sz * sz;
        for (var i = 0; i < chSize; i++) {
          _yoloxBuf[i]              = imgData[i * 4 + 2]; // B
          _yoloxBuf[chSize + i]     = imgData[i * 4 + 1]; // G
          _yoloxBuf[chSize * 2 + i] = imgData[i * 4];     // R
        }
        chwReady = Promise.resolve(_yoloxBuf);
      }

      var pendingInputTensor = null;
      chwReady.then(function (chwBuf) {
        var inputTensor = new ort.Tensor('float32', chwBuf, [1, 3, sz, sz]);
        pendingInputTensor = inputTensor;
        // Debug: log input stats once
        if (DEBUG && !self._dbgInputLogged) {
          self._dbgInputLogged = true;
          var mn = Infinity, mx = -Infinity;
          for (var di = 0; di < Math.min(1000, chwBuf.length); di++) {
            if (chwBuf[di] < mn) mn = chwBuf[di];
            if (chwBuf[di] > mx) mx = chwBuf[di];
          }
          dlog('[YOLOX-DBG] input range: ' + mn.toFixed(1) + ' - ' + mx.toFixed(1) + ' len=' + chwBuf.length);
        }
        return self.model.run({ images: inputTensor });
      }).then(function (results) {
        var outputKey = Object.keys(results)[0];
        var outputData = results[outputKey].data;
        // Debug: log raw output stats — EVERY 30 FRAMES for v4 diagnosis
        if (DEBUG) {
          if (!self._dbgOutputCount) self._dbgOutputCount = 0;
          if (self._dbgOutputCount++ % 30 === 0) {
            dlog('[YOLOX-DBG] output len=' + outputData.length + ' (expect ' + (8400*7) + ')');
            // Check raw obj/cls values before postprocess
            var maxObj = 0, maxC0 = 0, maxC1 = 0;
            for (var di = 0; di < outputData.length; di += 7) {
              if (outputData[di+4] > maxObj) maxObj = outputData[di+4];
              if (outputData[di+5] > maxC0) maxC0 = outputData[di+5];
              if (outputData[di+6] > maxC1) maxC1 = outputData[di+6];
            }
            dlog('[YOLOX-DBG] raw maxObj=' + maxObj.toFixed(4) + ' maxBall=' + maxC0.toFixed(4) + ' maxHoop=' + maxC1.toFixed(4));
            var hasNeg = false;
            for (var di = 0; di < outputData.length; di += 7) {
              if (outputData[di+4] < 0 || outputData[di+5] < 0 || outputData[di+6] < 0) { hasNeg = true; break; }
            }
            dlog('[YOLOX-DBG] hasNegatives=' + hasNeg + ' (false=sigmoid, true=logits) outputKey=' + outputKey);
          }
        }

        var mlBall = self._yoloxDecode(outputData, ratio, pw, ph);

        // Fire hoop detection callback (normalized 0-1 coords relative to full video)
        if (self.onHoopDetected && self._lastHoopDetection) {
          var h = self._lastHoopDetection;
          self.onHoopDetected({
            cx: (h.cx * scaleX + offsetX) / vw, cy: (h.cy * scaleY + offsetY) / vh,
            bw: (h.bw * scaleX) / vw, bh: (h.bh * scaleY) / vh,
            score: h.score,
            // L11.2: propagate "color refinement succeeded" so the auto-lock
            // skips the BBOX_RIM_OFFSET_FRAC adjustment (which would over-
            // shoot when cy is already snapped to the orange ring).
            colorRefined: !!h.colorRefined
          });
        }

        if (mlBall) {
          // Reject ML detections with very low confidence — likely false positives
          if (mlBall.score < 0.02) { mlBall = null; }
          // For medium-confidence, verify orange color in the region
          else if (mlBall.score < 0.15) {
            var verified = self._verifyOrange(mlBall.cx, mlBall.cy, Math.max(mlBall.bw, mlBall.bh), pw, ph);
            if (!verified) { mlBall = null; }
          }
        }

        // Temporal consistency: require 2 consecutive frames with detection
        // Prevents single-frame false positives from triggering tracking
        if (mlBall) {
          if (!self._prevMLBall) {
            // First detection — hold, don't use yet
            self._prevMLBall = mlBall;
            mlBall = null;
          } else {
            // Second consecutive — accept and clear
            self._prevMLBall = mlBall;
          }
        } else {
          self._prevMLBall = null;
        }

        // Detection logging
        if (DEBUG && self._frameCount % 30 === 0) {
          var hoopStr = 'none';
          if (self._lastHoopDetection) {
            var hd = self._lastHoopDetection;
            hoopStr = 'score=' + hd.score.toFixed(3) + ' cx=' + hd.cx.toFixed(1) + ' cy=' + hd.cy.toFixed(1);
          }
          dlog('[ShotDetection] f=' + self._frameCount +
            ' vw=' + vw + ' vh=' + vh + ' pw=' + pw + ' ph=' + ph +
            ' ball=' + (mlBall ? 'ML(' + mlBall.score.toFixed(3) + ' cx=' + mlBall.cx.toFixed(1) + ')' : (colorBall ? 'color' : 'none')) +
            ' hoop=' + hoopStr);
        }

        if (mlBall) {
          self._mlMissCount = 0;
          self._mlEverDetected = true;
          self._lastDetSource = 'ml';
          self._lastDetConf = mlBall.score;
          self._processBallDetection(mlBall.cx * scaleX + offsetX, mlBall.cy * scaleY + offsetY, vw, vh);
        } else if (colorBall && (self._mlMissCount < 30 || !self._mlEverDetected)) {
          // Color fallback: use if ML recently saw ball OR ML never detected anything
          // (ML may not work on all videos — e.g. outdoor, dark, screen recordings)
          self._mlMissCount++;
          self._lastDetSource = 'color';
          self._lastDetConf = 0;
          self._processBallDetection(colorBall.x * scaleX + offsetX, colorBall.y * scaleY + offsetY, vw, vh);
        } else {
          self._mlMissCount++;
          self._processNoBall();
        }

        // Release ORT tensors. With WebGPU/WebGL backends the underlying
        // GPU buffers are not GC-tracked, so leaking them across many
        // frames will eventually hit a memory ceiling. dispose() is a
        // no-op for plain CPU tensors so this is always safe.
        try {
          if (pendingInputTensor && typeof pendingInputTensor.dispose === 'function') {
            pendingInputTensor.dispose();
          }
          if (results) {
            Object.keys(results).forEach(function (k) {
              var t = results[k];
              if (t && typeof t.dispose === 'function') t.dispose();
            });
          }
        } catch (_) { /* tensor lifecycle is best-effort */ }
        pendingInputTensor = null;

        self._isDetecting = false;
        self._scheduleDetection();
      }).catch(function (e) {
        console.warn('[ShotDetection] YOLOX inference error:', e);
        // Whatever happens below, the detection flag MUST clear or the
        // engine will deadlock on the next gate check. Wrap fallback work
        // and dispose in their own try blocks so a re-throw can't strand us.
        try {
          if (colorBall) {
            self._processBallDetection(colorBall.x * scaleX + offsetX, colorBall.y * scaleY + offsetY, vw, vh);
          } else {
            self._processNoBall();
          }
        } catch (innerErr) {
          console.warn('[ShotDetection] fallback error:', innerErr);
        }
        try {
          if (pendingInputTensor && typeof pendingInputTensor.dispose === 'function') {
            pendingInputTensor.dispose();
          }
        } catch (_) { /* ignore */ }
        pendingInputTensor = null;
        self._isDetecting = false;
        self._scheduleDetection();
      });
    },

    /* ── YOLOX grid+stride postprocess (required for raw ONNX output) ── */
    /* The ONNX model outputs raw grid offsets, not decoded pixel coords.
       This applies: cx = (raw_cx + grid_x) * stride, w = exp(raw_w) * stride */
    _yoloxPostprocess: function (output) {
      var sz = YOLOX_INPUT_SIZE; // 640
      var strides = [8, 16, 32];
      var idx = 0;
      for (var s = 0; s < strides.length; s++) {
        var stride = strides[s];
        var hsize = Math.floor(sz / stride);
        var wsize = Math.floor(sz / stride);
        for (var y = 0; y < hsize; y++) {
          for (var x = 0; x < wsize; x++) {
            var off = idx * YOLOX_STRIDE;
            output[off]     = (output[off]     + x) * stride; // cx
            output[off + 1] = (output[off + 1] + y) * stride; // cy
            output[off + 2] = Math.exp(output[off + 2]) * stride; // w
            output[off + 3] = Math.exp(output[off + 3]) * stride; // h
            idx++;
          }
        }
      }
      return output;
    },

    /* ── IoU helper for NMS ──────────────────────────────────── */
    _computeIoU: function (a, b) {
      var ax1 = a.cx - a.bw / 2, ay1 = a.cy - a.bh / 2;
      var ax2 = a.cx + a.bw / 2, ay2 = a.cy + a.bh / 2;
      var bx1 = b.cx - b.bw / 2, by1 = b.cy - b.bh / 2;
      var bx2 = b.cx + b.bw / 2, by2 = b.cy + b.bh / 2;
      var ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
      var ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
      var inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
      var union = a.bw * a.bh + b.bw * b.bh - inter;
      return union > 0 ? inter / union : 0;
    },

    /* ── Greedy NMS ──────────────────────────────────────────── */
    _greedyNMS: function (dets, iouThresh) {
      dets.sort(function (a, b) { return b.score - a.score; });
      var keep = [];
      for (var i = 0; i < dets.length; i++) {
        var suppressed = false;
        for (var j = 0; j < keep.length; j++) {
          if (this._computeIoU(dets[i], keep[j]) > iouThresh) {
            suppressed = true;
            break;
          }
        }
        if (!suppressed) keep.push(dets[i]);
      }
      return keep;
    },

    /* ── YOLOX output decode (custom 2-class model) ─────────── */
    /* Output shape: [1, N, 7] where each row = [cx, cy, w, h, objectness, ball_score, hoop_score] */
    /* After _yoloxPostprocess, cx/cy/w/h are in 640x640 input space */
    _yoloxDecode: function (output, ratio, pw, ph) {
      // Apply grid+stride decoding (converts raw offsets → pixel coords in 640x640 space)
      this._yoloxPostprocess(output);

      var numDets = output.length / YOLOX_STRIDE;
      var ballCandidates = [];
      var hoopCandidates = [];
      var playerCandidates = [];
      var frameArea = pw * ph;

      // Auto-detect: if any obj/cls value is negative, output is raw logits (needs sigmoid)
      // ORT-Web may skip fused sigmoid depending on version/backend.
      // Probe all 4 score slots (obj + 3 classes) on the first ~100 rows.
      var needsSigmoid = false;
      for (var si = 0; si < Math.min(output.length, 800); si += YOLOX_STRIDE) {
        if (output[si + 4] < 0 || output[si + 5] < 0 || output[si + 6] < 0 || output[si + 7] < 0) {
          needsSigmoid = true;
          break;
        }
      }
      if (DEBUG && !this._dbgSigmoidLogged) {
        this._dbgSigmoidLogged = true;
        dlog('[YOLOX] needsSigmoid=' + needsSigmoid);
      }

      function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

      for (var i = 0; i < numDets; i++) {
        var off = i * YOLOX_STRIDE;
        var obj = needsSigmoid ? sigmoid(output[off + 4]) : output[off + 4];
        if (obj < 0.01) continue;

        var cx = output[off]     / ratio;
        var cy = output[off + 1] / ratio;
        var bw = output[off + 2] / ratio;
        var bh = output[off + 3] / ratio;

        var rawBall   = needsSigmoid ? sigmoid(output[off + 5]) : output[off + 5];
        var rawHoop   = needsSigmoid ? sigmoid(output[off + 6]) : output[off + 6];
        var rawPlayer = needsSigmoid ? sigmoid(output[off + 7]) : output[off + 7];
        var ballScore   = obj * rawBall;    // class 0 = Basketball
        var hoopScore   = obj * rawHoop;    // class 1 = Hoop
        var playerScore = obj * rawPlayer;  // class 2 = Player

        var area = bw * bh;

        // Hoop candidates — threshold 0.10 balances precision vs recall
        // Area filter: hoop should be 0.1%-8% of frame (not 40%)
        // Aspect ratio: v6_polished boxes the rim+NET together, which lands
        // square-ish (w/h ≈ 0.9-1.3). The old ≥1.5 lower bound was tuned for
        // rim-only boxes and rejected ~100% of this model's real hoop
        // detections on eval footage (median conf 0.43 thrown away), leaving
        // rim-lock to feed on wide false positives. ≥0.55 keeps net-heavy
        // boxes while still dropping poles/players (≈0.3-0.5); ≤5.0 still
        // drops banners/scoreboards. Orange verification downstream
        // (_verifyHoopDet, _refineHoopByOrange) guards the rest.
        if (hoopScore > 0.10 && area > frameArea * 0.001 && area < frameArea * 0.08) {
          var hoopAspect = bw / (bh || 1);
          if (hoopAspect >= 0.55 && hoopAspect <= 5.0) {
            hoopCandidates.push({ cx: cx, cy: cy, bw: bw, bh: bh, score: hoopScore });
          }
        }

        // Player candidates — taller-than-wide bias, larger min area than ball.
        // Players don't have the strict aspect filter that hoops do, but we
        // reject ridiculously squat blobs (likely partial occlusions) and
        // anything bigger than half the frame (likely a misclassified close-up).
        if (playerScore > 0.20 && area > frameArea * 0.005 && area < frameArea * 0.50) {
          var playerAspectVert = bh / (bw || 1);  // height/width
          if (playerAspectVert >= 0.7) {           // approximately upright
            playerCandidates.push({ cx: cx, cy: cy, bw: bw, bh: bh, score: playerScore });
          }
        }

        // Ball candidates — size + aspect ratio filter
        if (area < frameArea * BALL_MIN_AREA_FRAC || area > frameArea * BALL_MAX_AREA_FRAC) continue;
        var aspect = Math.max(bw, bh) / (Math.min(bw, bh) || 1);
        if (aspect > 3.0) continue;

        if (ballScore >= BALL_CONFIDENCE) {
          ballCandidates.push({ cx: cx, cy: cy, bw: bw, bh: bh, score: ballScore });
        }
      }

      // Debug: log detection counts every 30 frames
      if (DEBUG) {
        if (!this._dbgFrame) this._dbgFrame = 0;
        if (++this._dbgFrame % 30 === 0) {
          var bestHoop = hoopCandidates.reduce(function(b,c){ return c.score > b ? c.score : b; }, 0);
          var bestBall = ballCandidates.reduce(function(b,c){ return c.score > b ? c.score : b; }, 0);
          var bestPlayer = playerCandidates.reduce(function(b,c){ return c.score > b ? c.score : b; }, 0);
          dlog('[YOLOX] balls=' + ballCandidates.length + ' hoops=' + hoopCandidates.length + ' players=' + playerCandidates.length +
            ' bestBall=' + bestBall.toFixed(3) + ' bestHoop=' + bestHoop.toFixed(3) + ' bestPlayer=' + bestPlayer.toFixed(3));
        }
      }

      // Apply NMS (IoU threshold 0.45)
      var NMS_THRESH = 0.45;
      var ballKeep   = this._greedyNMS(ballCandidates,   NMS_THRESH);
      var hoopKeep   = this._greedyNMS(hoopCandidates,   NMS_THRESH);
      var playerKeep = this._greedyNMS(playerCandidates, NMS_THRESH);

      // Store latest hoop detection for auto rim-lock (use UNFILTERED hoopKeep
      // here — the auto-lock needs the strongest raw signal). We rebuild a
      // filtered list separately below for the overlay.
      //
      // L11.2: refine the hoop Y by searching for the canonical ORANGE rim
      // ring color downward from the YOLOX bbox. YOLOX sometimes detects
      // the backboard top / clamp area instead of the rim itself (especially
      // on indoor gym setups). Percentage-of-bbox offsets can't fix this
      // when the gap between bbox and real rim is larger than the bbox
      // itself. Snapping to the orange band gives us the actual rim Y.
      if (hoopKeep.length > 0) {
        var refined = this._refineHoopByOrange(hoopKeep[0], pw, ph);
        // Replace the first detection in-place so onDebugFrame also shows
        // the corrected position, not just the auto-lock pipeline.
        hoopKeep[0] = refined;
      }
      this._lastHoopDetection = hoopKeep.length > 0 ? hoopKeep[0] : null;

      // L12: preflight tally — only counts while still calibrating so the
      // counters stop growing once we're live.
      // L12.2: each detection runs through a verifier first. Only VALID
      // detections count. Failed reasons are stashed so the UI can show
      // why a particular entity is stuck.
      if (!this._preflightReady && this._preflightChecks) {
        var pf = this._preflightChecks;
        if (!pf.lastReason) pf.lastReason = { ball: null, hoop: null, player: null };
        if (hoopKeep.length > 0) {
          var hv = this._verifyHoopDet(hoopKeep[0], pw, ph);
          if (hv.valid) { pf.hoop++; pf.lastReason.hoop = null; }
          else pf.lastReason.hoop = hv.reason;
        }
        if (playerKeep.length > 0) {
          var pv = this._verifyPlayerDet(playerKeep[0], pw, ph);
          if (pv.valid) { pf.player++; pf.lastReason.player = null; }
          else pf.lastReason.player = pv.reason;
        }
        if (ballKeep.length > 0) {
          var bv = this._verifyBallDet(ballKeep[0], pw, ph);
          if (bv.valid) { pf.ball++; pf.lastReason.ball = null; }
          else pf.lastReason.ball = bv.reason;
        }
        var t = this._preflightThresholds;
        if (pf.ball   >= t.ball &&
            pf.hoop   >= t.hoop &&
            pf.player >= t.player) {
          this._preflightReady = true;
          if (typeof this.onPreflightReady === 'function') {
            try { this.onPreflightReady({ elapsedMs: Date.now() - (this._preflightStartedAt || 0) }); }
            catch (e) { console.warn('[ShotDetection] onPreflightReady cb error:', e); }
          }
        }
      }

      // ── L10.4: Rim-zone-aware false-ball filter ──
      // The v6_polished model produces 30-50% ball scores on the basketball
      // rim itself, on logos painted on the wall, and on other round-orange
      // objects. These pass BALL_CONFIDENCE=0.05 easily and pollute the
      // tracker. The classic fix is to retrain — but until then we can
      // suppress most false positives at runtime: any ball detection inside
      // the locked rim zone (and adjacent areas) is rejected unless a shot
      // is actively in progress (shot_started / near_hoop), since that's
      // the only legitimate moment for the ball to be at rim level.
      var rim = this.rimZone;
      if (rim && this._rimStabilized) {
        var inShotState = (this._shotState === 'shot_started' || this._shotState === 'near_hoop');
        if (!inShotState) {
          // Expanded rim zone — catches balls "on the rim" plus a small
          // halo around it. Tuned to also catch logos painted just below
          // the rim (e.g. the Oregon "O" in the user's test video).
          //
          // L30: only reject STATIC REPEATS inside the zone. The FPs this
          // filter targets (wall logos, the rim itself scored as "ball")
          // re-detect at the same spot frame after frame; a real ball
          // FLYING through the rim zone lands somewhere new each sample.
          // The old reject-everything version deleted exactly the above-
          // rim / at-rim evidence the L26 idle trigger and the through-rim
          // evidence collector need — untriggered shots became invisible.
          var rimNX = rim.centerX, rimNY = rim.centerY;
          var rimNW = rim.width  || 0.10;
          var rimNH = rim.height || 0.04;
          var expL = rimNX - rimNW * 1.5;
          var expR = rimNX + rimNW * 1.5;
          var expT = rimNY - rimNH * 4.0;
          var expB = rimNY + rimNH * 6.0;  // extends DOWN to cover wall logos
          var selfFilt = this;
          var nowFilt = Date.now();
          ballKeep = ballKeep.filter(function (b) {
            var bxN = b.cx / pw;
            var byN = b.cy / ph;
            var insideExpRim = (bxN >= expL && bxN <= expR && byN >= expT && byN <= expB);
            if (!insideExpRim) return true;
            var lr = selfFilt._lastRimZoneBallReject;
            var staticRepeat = !!(lr && (nowFilt - lr.ts) < 1200 &&
                                  Math.abs(bxN - lr.x) < 0.035 &&
                                  Math.abs(byN - lr.y) < 0.035);
            selfFilt._lastRimZoneBallReject = { x: bxN, y: byN, ts: nowFilt };
            return !staticRepeat;
          });
        }
      }

      // ── L10.5: Hide stale HOOP detections far from the locked rim ──
      // After auto-rim-lock, per-frame YOLOX hoop detections that appear far
      // from the locked position (e.g. scoreboard area, ceiling beams) are
      // hallucinations. They don't affect logic (state machine uses the
      // locked rimZone), but they confuse the user visually. Filter for the
      // overlay only — the auto-lock above already grabbed _lastHoopDetection
      // from the unfiltered list before this point.
      var hoopKeepDisplay = hoopKeep;
      if (rim && this._rimStabilized) {
        var rimNXh = rim.centerX, rimNYh = rim.centerY;
        var MAX_HOOP_DRIFT = 0.20; // 20% of normalized frame distance
        hoopKeepDisplay = hoopKeep.filter(function (h) {
          var hxN = h.cx / pw, hyN = h.cy / ph;
          var dx = hxN - rimNXh, dy = hyN - rimNYh;
          return Math.sqrt(dx * dx + dy * dy) <= MAX_HOOP_DRIFT;
        });
      }

      // Store latest player detections — top 3 by score, used to localize the
      // shooter for pose-driven shot zone classification (and to dedupe pose
      // hallucinations on empty frames against a real "is there a person?" signal).
      this._lastPlayerDetections = playerKeep.slice(0, 3);

      // Debug overlay: fire all raw detections in PROCESSING-CANVAS space.
      // The display canvas matches the visible (full) video, so the overlay
      // needs the crop offset and crop scale to map proc-canvas coords back
      // through the cropped region into full-video space. videoW / videoH
      // let the consumer compute the final display-canvas scale.
      if (this.onDebugFrame) {
        var fullVw = (this.videoEl && this.videoEl.videoWidth) || pw;
        var fullVh = (this.videoEl && this.videoEl.videoHeight) || ph;
        this.onDebugFrame({
          balls:        ballKeep,
          hoops:        hoopKeepDisplay,      // L10.5: filtered for visual clarity
          players:      playerKeep,           // 3-class model adds player detections
          shotState:    this._shotState,
          frameCount:   this._frameCount,
          // Phase L3: trajectory + crossing for visual debug
          // trajectory is in NORMALIZED video coords (0..1), same space as rim
          trajectory:   this._shotTrajectory || [],
          lastCrossing: this._lastCrossing || null,
          // L7 diagnostic: latest pose-trigger/crossing decision + counters.
          // Lets the debug overlay show "is PoseDetector even seeing shooting
          // motion?" — distinguishes a missed trigger from a downstream drop.
          lastShotReason: this._lastShotReason || null,
          poseStats:    this._poseStats     || null,
          // L12: preflight calibration status for the screen overlay.
          preflight:    {
            ready:       !!this._preflightReady,
            checks:      this._preflightChecks     || { ball: 0, hoop: 0, player: 0 },
            thresholds:  this._preflightThresholds || { ball: 3, hoop: 5, player: 3 }
          },
          procW:        pw,
          procH:        ph,
          videoW:       fullVw,
          videoH:       fullVh,
          cropOffsetX:  this._cropOffsetX || 0,
          cropOffsetY:  this._cropOffsetY || 0,
          cropScaleX:   this._cropScaleX  || 1,
          cropScaleY:   this._cropScaleY  || 1
        });
      }

      return ballKeep.length > 0 ? ballKeep[0] : null;
    },

    /* ── L11.2: Refine hoop Y by orange-rim color search ─────────
       YOLOX sometimes anchors the hoop bbox on the backboard top or the
       clamp/truss above the actual orange ring. Percentage-of-bbox offsets
       can't compensate when the gap is larger than the bbox itself.
       Strategy: scan a vertical strip below the bbox (and a bit above for
       safety) within the bbox's X range. For each row, count pixels
       matching the canonical basketball-orange test. The row with peak
       orange density is the rim's actual Y. If no strong orange band is
       found (e.g. partially occluded, weird lighting, B&W footage) we
       return the original hoop — the L11.1 aspect-aware offset still
       applies downstream.
       ────────────────────────────────────────────────────────────── */
    _refineHoopByOrange: function (hoop, pw, ph) {
      if (!hoop || !this._ctx) return hoop;

      var ctx = this._ctx;
      var cx = hoop.cx, cy = hoop.cy, bw = hoop.bw, bh = hoop.bh;

      // Scan region: from a bit above the bbox top down ~15% of frame.
      // Width matches the bbox plus a small horizontal margin so we catch
      // ring edges when the bbox is slightly off-center.
      // Scan window anchored to the BOX TOP: v6_polished boxes CONTAIN the
      // rim line (square rim+net boxes carry the ring ~6% of box height
      // below the top edge; wide rim-only boxes carry it near the center).
      // The old window extended 15% of the FRAME below the box — a v71-era
      // relic for backboard-anchored boxes whose ring sat far below. On v6
      // footage that tail reached the BALL during layups/rim-rolls, and the
      // ball's much stronger orange hijacked the snap: eval v3 locked the
      // "rim" 0.14 below the ring, on a row the ball had just occupied,
      // and the L19 freeze then cemented the error for the whole session.
      var boxTop     = cy - bh * 0.5;
      var scanTop    = Math.max(0,  Math.floor(boxTop - bh * 0.3));
      var scanBottom = Math.min(ph - 1, Math.floor(boxTop + bh * 0.9));
      // Margin widened 0.10 → 0.25: when YOLOX anchors the box slightly to
      // one side of the ring (seen on outdoor eval footage — lock ended up
      // 0.06 left of the true ring), the ring edge falls outside a narrow
      // strip and the refinement never fires.
      var margin     = Math.max(2, Math.floor(bw * 0.25));
      var scanLeft   = Math.max(0,  Math.floor(cx - bw / 2 - margin));
      var scanRight  = Math.min(pw, Math.floor(cx + bw / 2 + margin));
      var scanW      = scanRight - scanLeft;
      var scanH      = scanBottom - scanTop;
      if (scanW < 5 || scanH < 5) return hoop;

      var data;
      try {
        data = ctx.getImageData(scanLeft, scanTop, scanW, scanH).data;
      } catch (e) {
        return hoop;  // permission error or canvas tainted
      }

      // For each row, count orange pixels AND accumulate their x-sum so the
      // winning band also yields a horizontal centroid. Same color test as
      // _verifyOrange.
      var bestRow = -1;
      var maxOrange = 0;
      // Require the rim band to be at least 8% of the row width — anything
      // less is likely noise rather than a real ring.
      var minOrangeCount = Math.max(3, Math.floor(scanW * 0.08));
      var rowCounts = new Int32Array(scanH);
      var rowSumX   = new Float64Array(scanH);

      for (var ry = 0; ry < scanH; ry++) {
        var rowStart = ry * scanW * 4;
        var count = 0;
        var sumX = 0;
        for (var rx = 0; rx < scanW; rx++) {
          var idx = rowStart + rx * 4;
          var r = data[idx], g = data[idx + 1], b = data[idx + 2];
          if (r > 120 && g > 40 && g < 180 && b < 100 && r > g * 1.15 && r > b * 1.6) {
            count++;
            sumX += rx;
          }
        }
        rowCounts[ry] = count;
        rowSumX[ry]   = sumX;
        if (count > maxOrange) {
          maxOrange = count;
          bestRow = ry;
        }
      }

      if (bestRow >= 0 && maxOrange >= minOrangeCount) {
        var refinedCy = scanTop + bestRow;
        // Horizontal centroid of the rim band (best row ±1 for stability).
        // YOLOX box centers drift off the ring when the box includes pole /
        // backboard / caption pixels; cy alone was snapped to the orange but
        // cx kept the bad box center — outdoor eval locked 0.06 left of the
        // real ring. Centroid of the orange band IS the ring center.
        var bandCount = 0, bandSumX = 0;
        for (var by = Math.max(0, bestRow - 1); by <= Math.min(scanH - 1, bestRow + 1); by++) {
          bandCount += rowCounts[by];
          bandSumX  += rowSumX[by];
        }
        var refinedCx = cx;
        if (bandCount >= minOrangeCount) {
          var centroidX = scanLeft + bandSumX / bandCount;
          // Sanity: don't chase orange far outside the box (banner edge,
          // second hoop) — cap the shift at 60% of box width.
          if (Math.abs(centroidX - cx) <= bw * 0.6) refinedCx = centroidX;
        }
        // Stash flag so downstream knows the position came from a color
        // search, not just the YOLOX bbox center. ShotTrackingScreen uses
        // this to skip the BBOX_RIM_OFFSET_FRAC adjustment (which would
        // over-shoot when the position is already on the orange).
        return {
          cx: refinedCx, cy: refinedCy, bw: bw, bh: bh, score: hoop.score,
          colorRefined: true,
          colorMass:    maxOrange
        };
      }

      return hoop;
    },

    /* ── L32: Global camera-motion estimate ────────────────────────
       Coarse whole-frame SAD search on a 96×54 gray thumbnail of the
       processing canvas (±5 thumb-px ≈ ±5% of frame width per tick).
       When the camera pans, the locked rim must RIDE the scene — YOLOX
       hoop detections are far too sparse on small/far rims to re-anchor
       in time (eval v1: ~37% of the video sat in hoop-lost windows
       during pans and every shot there went uncounted). Emits
       onGlobalMotion with the SCENE displacement in full-video
       normalized coords; the screen shifts its locked rim by exactly
       that. Static cameras emit nothing.
       ────────────────────────────────────────────────────────────── */
    _estimateGlobalMotion: function (pw, ph, vw, vh) {
      if (!this._canvas || !this.onGlobalMotion) return;
      var GW = 96, GH = 54;
      if (!this._gmCanvas) {
        this._gmCanvas = document.createElement('canvas');
        this._gmCanvas.width = GW; this._gmCanvas.height = GH;
        this._gmCtx = this._gmCanvas.getContext('2d', { willReadFrequently: true });
      }
      var data;
      try {
        this._gmCtx.drawImage(this._canvas, 0, 0, GW, GH);
        data = this._gmCtx.getImageData(0, 0, GW, GH).data;
      } catch (e) { return; }
      var n = GW * GH;
      var cur = new Uint8ClampedArray(n);
      for (var i = 0, j = 0; i < n; i++, j += 4) {
        cur[i] = (data[j] * 3 + data[j + 1] * 4 + data[j + 2]) >> 3;
      }
      var prev = this._gmPrev;
      this._gmPrev = cur;
      if (!prev || prev.length !== n) return;

      var R = 5;  // search radius in thumbnail px
      var bestDx = 0, bestDy = 0, bestSad = Infinity, zeroSad = 0;
      for (var dy = -R; dy <= R; dy++) {
        for (var dx = -R; dx <= R; dx++) {
          var sad = 0;
          for (var y = R + 1; y < GH - R - 1; y += 2) {
            var rowC = y * GW, rowP = (y + dy) * GW + dx;
            for (var x = R + 1; x < GW - R - 1; x += 2) {
              sad += Math.abs(cur[rowC + x] - prev[rowP + x]);
            }
          }
          if (dx === 0 && dy === 0) zeroSad = sad;
          if (sad < bestSad) { bestSad = sad; bestDx = dx; bestDy = dy; }
        }
      }
      // Static camera / ambiguous match → no shift. The 0.8 factor keeps
      // noise and local object motion (players) from masquerading as pans.
      if ((bestDx === 0 && bestDy === 0) || bestSad > zeroSad * 0.8) return;
      // cur[x] matches prev[x+bestDx] → the scene moved by -bestDx (proc px).
      var sceneDxProc = -bestDx * (pw / GW);
      var sceneDyProc = -bestDy * (ph / GH);
      var dxNorm = sceneDxProc * (this._cropScaleX || 1) / Math.max(1, vw);
      var dyNorm = sceneDyProc * (this._cropScaleY || 1) / Math.max(1, vh);
      this.onGlobalMotion(dxNorm, dyNorm);
    },

    /* ── L31: Rim-transit detector ─────────────────────────────────
       The v6 model frequently CANNOT see the ball in flight (compressed
       footage, motion blur, washed-out color) — eval showed entire makes
       with zero in-corridor ball detections even at 10fps offline. But a
       basketball passing through the rim is a huge orange mass moving
       through two small, KNOWN windows. So: count orange pixels in a
       window just ABOVE the rim line and one in the net cone BELOW it,
       every processing tick (~3-5× the YOLOX cadence), against a slowly
       learned per-window baseline (absorbs the rim's own orange, wall
       logos, fence flowers…). An A-spike followed by a B-spike within
       1.2s = the ball went THROUGH — this feeds the same
       _ballAboveRimAt/_ballThroughRimAt evidence fields the counting
       logic already consumes. A ball that rolls off the rim keeps A+B
       spiking SIMULTANEOUSLY (gap < one tick) and never satisfies the
       ordered test; a ball deflected outside the net never spikes B.
       ────────────────────────────────────────────────────────────── */
    _updateRimTransit: function (pw, ph, vw, vh) {
      if (!this.rimZone || !this._rimStabilized || !this._ctx) return;
      var rim = this.rimZone;
      var sx = this._cropScaleX || 1, sy = this._cropScaleY || 1;
      var ox = this._cropOffsetX || 0, oy = this._cropOffsetY || 0;
      // rim normalized (full-video space) → processing-canvas px
      var rimPx = ((rim.centerX * vw) - ox) / sx;
      var rimPy = ((rim.centerY * vh) - oy) / sy;
      var rimPw = Math.max(10, (rim.width  || 0.10) * vw / sx);
      var rimPh = Math.max(5,  (rim.height || 0.04) * vh / sy);
      if (rimPx < 0 || rimPx > pw || rimPy < 0 || rimPy > ph) return;

      var aX = Math.floor(rimPx - rimPw * 0.8), aW = Math.floor(rimPw * 1.6);
      var aY = Math.floor(rimPy - rimPh * 3.5), aH = Math.floor(rimPh * 3.0);
      // B is NARROW (±0.45×rim width): the net cone. Eval v3 n8 (rim hit
      // deflecting down-left just outside the net) clipped the edge of a
      // ±0.6 window and produced a false "through" — a real make passes
      // well inside the cone.
      var bX = Math.floor(rimPx - rimPw * 0.45), bW = Math.floor(rimPw * 0.9);
      var bY = Math.floor(rimPy + rimPh * 0.7), bH = Math.floor(rimPh * 3.5);
      if (aW < 6 || aH < 3 || bW < 6 || bH < 3) return;
      // Control region: same size as B, shifted sideways — calibrates out
      // GLOBAL motion (camera pan/zoom lights every window equally).
      var cShift = Math.floor(rimPw * 2.2);
      var cX = (bX + bW + cShift + bW <= pw) ? bX + cShift + bW : bX - cShift - bW;

      var a = this._scanTransitRegion('A', aX, aY, aW, aH, pw, ph);
      var b = this._scanTransitRegion('B', bX, bY, bW, bH, pw, ph);
      var c = this._scanTransitRegion('C', cX, bY, bW, bH, pw, ph);
      if (!a || !b) return;
      if (this._transitBaseA == null) {
        this._transitBaseA  = a.orange; this._transitBaseB  = b.orange;
        this._transitSadBaseA = 0; this._transitSadBaseB = 0;
        return;
      }

      var nowT = Date.now();
      var ctrlHot = c ? c.hot : 0;
      // Two channels per window:
      //  • orange-mass spike — saturated footage (outdoor, gyms)
      //  • motion HOT-FRACTION spike (share of pixels whose gray changed
      //    by >25 since the previous tick) — compressed/washed footage
      //    where the ball fails the orange test entirely (eval v3: the
      //    model's own ball candidates died on "not orange"). Hot-fraction
      //    beats mean-abs-diff: a transiting ball is a compact blob of
      //    LARGE deltas (~10-25% of the window), while net sway and codec
      //    shimmer are wide fields of small deltas.
      // Camera-pan veto: a pan lights EVERY window — when the control
      // region (same size as B, off to the side) is mostly hot, nothing
      // counts. A ratio guard was tried first and suppressed putback/tip
      // plays (the player's own body motion lit the control region while
      // the actual ball action was at the rim) — eval v3 lost every
      // at-rim play of the second half to it. Hard veto only.
      var aOrangeSpike = a.orange > Math.max(this._transitBaseA * 1.8, this._transitBaseA + 10);
      var bOrangeSpike = b.orange > Math.max(this._transitBaseB * 1.8, this._transitBaseB + 10);
      var panVeto = ctrlHot > 0.45;
      var aHotSpike = !panVeto && a.hot > Math.max(0.05, this._transitSadBaseA * 2.5);
      var bHotSpike = !panVeto && b.hot > Math.max(0.05, this._transitSadBaseB * 2.5);
      var aSpike = aOrangeSpike || aHotSpike;
      var bSpike = bOrangeSpike || bHotSpike;
      // Baselines learn ONLY from non-spike ticks so the ball itself is
      // never absorbed into "normal". Hot-fraction baseline is SLOW
      // (≈3%/tick) — sustained at-rim action must not become "normal"
      // within a couple of seconds.
      if (!aOrangeSpike) this._transitBaseA = this._transitBaseA * 0.95 + a.orange * 0.05;
      if (!bOrangeSpike) this._transitBaseB = this._transitBaseB * 0.95 + b.orange * 0.05;
      if (!aHotSpike) this._transitSadBaseA = this._transitSadBaseA * 0.97 + a.hot * 0.03;
      if (!bHotSpike) this._transitSadBaseB = this._transitSadBaseB * 0.97 + b.hot * 0.03;

      if (DEBUG) {
        this._transitDbgN = (this._transitDbgN || 0) + 1;
        if (this._transitDbgN % 20 === 0) {
          dlog('[Transit] oA=' + a.orange + '/' + this._transitBaseA.toFixed(0) +
               ' oB=' + b.orange + '/' + this._transitBaseB.toFixed(0) +
               ' hotA=' + a.hot.toFixed(2) + '/' + this._transitSadBaseA.toFixed(2) +
               ' hotB=' + b.hot.toFixed(2) + '/' + this._transitSadBaseB.toFixed(2) +
               ' hotC=' + ctrlHot.toFixed(2) +
               ' spikes=' + (aSpike ? 'A' : '-') + (bSpike ? 'B' : '-'));
        }
      }

      // Ordered transit test uses the PREVIOUS tick's above-time, so a
      // ball sitting on the rim (A+B lit together, gap≈0) never passes.
      // Centrality guard: whichever channel fires B, its blob centroid
      // must be in the MIDDLE of the net cone — a deflection clipping the
      // window's edge (eval n8: rim hit exiting down-left just outside
      // the net) kept producing a false through. L33: tightened to
      // 0.28-0.72 and applied to the ORANGE channel too (it had no
      // centrality check at all).
      var bFireCx = bHotSpike ? b.hotCx : (bOrangeSpike ? b.orangeCx : null);
      var bCentered = bFireCx == null || (bFireCx >= 0.28 && bFireCx <= 0.72);
      var prevAboveAt = this._transitAboveAt || 0;
      if (bSpike && bCentered && prevAboveAt &&
          nowT - prevAboveAt >= 60 && nowT - prevAboveAt <= 1200 &&
          !this._ballThroughRimAt) {
        this._ballThroughRimAt = nowT;
        this._logShotEvent('rim-transit-through', {
          aOrange: a.orange, bOrange: b.orange,
          aHot: +a.hot.toFixed(2), bHot: +b.hot.toFixed(2), ctrlHot: +ctrlHot.toFixed(2),
          aBase: +this._transitBaseA.toFixed(1), bBase: +this._transitBaseB.toFixed(1),
          msSinceAbove: nowT - prevAboveAt
        });
      }
      if (aSpike) {
        this._transitAboveAt = nowT;
        this._ballAboveRimAt = nowT;
      }

      // ── L31.2: RIM-EVENT COUNTING ─────────────────────────────────
      // The A-window arrival is the most reliable "an attempt reached the
      // rim" signal on footage where YOLOX can't track the ball and pose
      // triggers are erratic (eval: pose fired 0.8-2.3s before the rim
      // arrival, so the 1.1s fallback kept counting shots BEFORE the ball
      // got there). Arm a rim event on the A-spike; resolve MADE the
      // moment through-evidence lands, or MISSED after 1.4s without it.
      // If a pose/ball-triggered shot is in flight, this resolves THAT
      // shot (single count, correct timing); from idle it counts an
      // attempt of its own.
      // L32: arming gap 800 → 650ms — rapid put-back sequences arrive
      // ~0.75s apart (eval v3 n3/n4 merged into one count at 800), while
      // a tip that bounces and re-enters (~450ms) must NOT split into two
      // events (500 produced a phantom double on eval n9).
      // L33: QUIET-BEFORE-ARRIVAL gate — a real shot arrives out of empty
      // sky, so the A-window must have been quiet for ≥450ms before this
      // spike. Sustained rim-area activity (a player standing under the
      // basket) keeps prevAboveAt fresh every tick and used to re-arm +
      // re-fire "made" roughly once per second (eval v1: three phantom
      // counts in 2s, trigger=None).
      if (aSpike && !this._transitEventAt &&
          (prevAboveAt === 0 || nowT - prevAboveAt >= 450) &&
          nowT - this.lastShotTime > 650) {
        this._transitEventAt = nowT;
        this._logShotEvent('rim-event-armed', {
          aOrange: a.orange, aHot: +a.hot.toFixed(2), ctrlHot: +ctrlHot.toFixed(2),
          shotState: this._shotState
        });
      }
      if (this._transitEventAt) {
        // Another path (L9.2 watch / near_hoop rule) just counted this rim
        // event — drop the pending duplicate. (L32: 900 → 650ms, matches
        // the arming gap so back-to-back put-backs survive.)
        if (nowT - this.lastShotTime < 650) {
          this._transitEventAt = 0;
        } else if (this._ballThroughRimAt > 0) {
          this._transitEventAt = 0;
          if (!this._shotTriggerSrc) {
            this._shotTriggerSrc    = 'rim-event';
            this._releaseConfidence = 0.6;
          }
          this._logShotEvent('rim-event-resolved', { result: 'made' });
          this._countShot('made', vw, vh, rim.centerX, rim.centerY, nowT);
        } else if (nowT - this._transitEventAt > 1400) {
          this._transitEventAt = 0;
          if (!this._shotTriggerSrc) {
            this._shotTriggerSrc    = 'rim-event';
            this._releaseConfidence = 0.6;
          }
          this._logShotEvent('rim-event-resolved', { result: 'missed' });
          this._countShot('missed', vw, vh, rim.centerX, rim.centerY, nowT);
        }
      }
    },

    /* L31: one-pass region scan → orange-pixel count + motion energy
       (mean abs gray diff vs the previous tick's pixels, stride 2).
       Returns null when the region is degenerate or the canvas is
       unreadable. Previous-frame buffers are kept per region key. */
    _scanTransitRegion: function (key, x0, y0, w, h, pw, ph) {
      if (x0 < 0) { w += x0; x0 = 0; }
      if (y0 < 0) { h += y0; y0 = 0; }
      if (x0 + w > pw) w = pw - x0;
      if (y0 + h > ph) h = ph - y0;
      if (w < 4 || h < 4) return null;
      var data;
      try { data = this._ctx.getImageData(x0, y0, w, h).data; }
      catch (e) { return null; }

      var stride = 2;
      var gw = Math.floor(w / stride), gh = Math.floor(h / stride);
      var n = gw * gh;
      if (!this._transitPrev) this._transitPrev = {};
      var prev = this._transitPrev[key];
      var cur = new Uint8ClampedArray(n);
      var orange = 0, orangeSumX = 0, hotCount = 0, hotSumX = 0, gi = 0;
      var samePrev = prev && prev.length === n;
      for (var yy = 0; yy < gh; yy++) {
        var rowOff = (yy * stride * w) * 4;
        for (var xx = 0; xx < gw; xx++) {
          var idx = rowOff + (xx * stride) * 4;
          var r = data[idx], g = data[idx + 1], bch = data[idx + 2];
          if (r > 120 && g > 40 && g < 180 && bch < 100 && r > g * 1.15 && r > bch * 1.6) {
            orange++;
            orangeSumX += xx;
          }
          var gray = (r * 3 + g * 4 + bch) >> 3;
          if (samePrev && Math.abs(gray - prev[gi]) > 25) {
            hotCount++;
            hotSumX += xx;
          }
          cur[gi++] = gray;
        }
      }
      this._transitPrev[key] = cur;
      // hot = fraction of sampled pixels whose gray changed by >25 since
      // the previous tick — compact moving blobs (the ball) score high,
      // codec shimmer / slight net sway score near zero. hotCx/orangeCx =
      // each blob's horizontal centroid as a 0..1 fraction of the window.
      return {
        orange:   orange,
        orangeCx: orange > 0 ? (orangeSumX / orange) / Math.max(1, gw - 1) : null,
        hot:      samePrev ? hotCount / n : 0,
        hotCx:    (samePrev && hotCount > 0) ? (hotSumX / hotCount) / Math.max(1, gw - 1) : null
      };
    },

    /* ── L12.2: Count orange pixels in an axis-aligned region ──
       Used by the preflight verifiers below. Stride is set to skip rows
       and columns so a 200×100 region only inspects ~1000 pixels — fast
       enough to call every YOLOX frame during preflight without affecting
       cadence. */
    _countOrangeInRegion: function (x0, y0, w, h, pw, ph) {
      if (!this._ctx) return 0;
      if (x0 < 0) { w += x0; x0 = 0; }
      if (y0 < 0) { h += y0; y0 = 0; }
      if (x0 + w > pw) w = pw - x0;
      if (y0 + h > ph) h = ph - y0;
      if (w < 2 || h < 2) return 0;

      var data;
      try { data = this._ctx.getImageData(x0, y0, w, h).data; }
      catch (e) { return 0; }

      var count = 0;
      var stride = 2;  // skip every other pixel in both axes
      for (var yy = 0; yy < h; yy += stride) {
        for (var xx = 0; xx < w; xx += stride) {
          var idx = (yy * w + xx) * 4;
          var r = data[idx], g = data[idx + 1], b = data[idx + 2];
          if (r > 120 && g > 40 && g < 180 && b < 100 && r > g * 1.15 && r > b * 1.6) {
            count++;
          }
        }
      }
      return count;
    },

    /* ── L12.2: Per-entity preflight verification ──
       Each returns { valid: bool, reason: string }. The preflight tally
       only increments when valid=true so YOLOX false positives can't
       accidentally satisfy the calibration check. */
    _verifyHoopDet: function (hoop, pw, ph) {
      if (!hoop) return { valid: false, reason: 'no-detection' };
      var cyN = hoop.cy / ph;
      var bwN = hoop.bw / pw;
      var bhN = hoop.bh / ph;
      // Hoops live in the upper 70% of basketball footage — anything
      // detected in the bottom third is almost certainly something else.
      if (cyN > 0.70) return { valid: false, reason: 'too-low' };
      // Size sanity — the rim+backboard takes a sane fraction of frame.
      if (bwN < 0.04) return { valid: false, reason: 'bbox-too-small' };
      if (bwN > 0.45) return { valid: false, reason: 'bbox-too-large' };
      // Color sanity — the rim is orange, so a band of orange should be
      // visible in or just below the bbox. Skipping this on color-refined
      // detections (they already proved orange is there).
      if (!hoop.colorRefined) {
        var sx = Math.floor(hoop.cx - hoop.bw * 0.5);
        var sy = Math.floor(hoop.cy - hoop.bh * 0.5);
        var sw = Math.floor(hoop.bw);
        var sh = Math.floor(hoop.bh * 1.5 + ph * 0.08);
        var orange = this._countOrangeInRegion(sx, sy, sw, sh, pw, ph);
        var areaSampled = (sw / 2) * (sh / 2); // stride=2 in both axes
        if (orange < areaSampled * 0.015) {
          return { valid: false, reason: 'no-orange-near-hoop' };
        }
      }
      return { valid: true, reason: null };
    },

    _verifyPlayerDet: function (player, pw, ph) {
      if (!player) return { valid: false, reason: 'no-detection' };
      var cyN = player.cy / ph;
      var bwN = player.bw / pw;
      var bhN = player.bh / ph;
      // Players are anchored to the floor — center in the bottom 2/3.
      if (cyN < 0.30) return { valid: false, reason: 'too-high' };
      // Aspect — humans are taller than wide. Allow some slack for crouched
      // stances during shooting motion.
      var aspect = bhN / Math.max(0.001, bwN);
      if (aspect < 0.9) return { valid: false, reason: 'wrong-aspect' };
      // Size — a player at distance can still be detected, but tiny blobs
      // are likely something else (a pole, a ball cart, etc.).
      if (bhN < 0.10) return { valid: false, reason: 'bbox-too-small' };
      return { valid: true, reason: null };
    },

    _verifyBallDet: function (ball, pw, ph) {
      if (!ball) return { valid: false, reason: 'no-detection' };
      var bwN = ball.bw / pw;
      var bhN = ball.bh / ph;
      // Size — basketball is small in frame at all but the closest shots.
      if (bwN > 0.12) return { valid: false, reason: 'bbox-too-large' };
      if (bwN < 0.006) return { valid: false, reason: 'bbox-too-small' };
      // Roundness — balls are roughly square in bbox terms (aspect ≈ 1).
      var aspect = bwN / Math.max(0.001, bhN);
      if (aspect < 0.45 || aspect > 2.2) return { valid: false, reason: 'not-round' };
      // Color — strict orange check via _verifyOrange (reuses the same
      // pixel test that gates low-confidence ball acceptance later in the
      // pipeline).
      var radius = Math.max(ball.bw, ball.bh) * 0.5;
      if (!this._verifyOrange(ball.cx, ball.cy, radius, pw, ph)) {
        return { valid: false, reason: 'not-orange' };
      }
      return { valid: true, reason: null };
    },

    /* ── Orange color verification for low-confidence ML hits ─── */
    _verifyOrange: function (cx, cy, radius, pw, ph) {
      var r2 = Math.max(radius, 10);
      var x0 = Math.max(0, Math.round(cx - r2));
      var y0 = Math.max(0, Math.round(cy - r2));
      var x1 = Math.min(pw, Math.round(cx + r2));
      var y1 = Math.min(ph, Math.round(cy + r2));
      var w = x1 - x0;
      var h = y1 - y0;
      if (w < 4 || h < 4) return false;

      try {
        var imgData = this._ctx.getImageData(x0, y0, w, h).data;
      } catch (e) { return false; }

      var orangeCount = 0;
      var totalPx = (w * h) / 4; // step 2
      for (var py = 0; py < h; py += 2) {
        for (var px = 0; px < w; px += 2) {
          var idx = (py * w + px) * 4;
          var r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2];
          if (r > 120 && g > 40 && g < 180 && b < 100 && r > g * 1.15 && r > b * 1.6) {
            orangeCount++;
          }
        }
      }

      return orangeCount > totalPx * 0.08; // at least 8% orange pixels
    },

    _consecutiveDets: 0,       // consecutive detection count for velocity jump rejection
    _prevBallNorm: null,       // previous ball normalized position {x, y}

    _processBallDetection: function (cx, cy, vw, vh) {
      // Stamp the time of the most recent legitimate ball detection.
      // The pose-shot fallback uses this to defer counting a missed
      // attempt while a real ball trajectory is still in flight —
      // gives YOLOX a chance to drive shot_started→near_hoop→made.
      this._lastBallDetMs = Date.now();
      var normX = cx / vw;
      var normY = cy / vh;

      // Velocity jump rejection: reject teleports (likely a switch to a
      // different orange object) — but TIME-AWARE. L30: the old fixed 0.15
      // threshold assumed ~30Hz sampling; at the real YOLOX cadence
      // (200-400ms between detections) a genuine shot arc legitimately
      // moves 0.2-0.4 normalized between samples, so the fixed threshold
      // rejected nearly every in-flight detection and starved the tracker.
      // Allow up to 1.2 norm/s of real motion (capped), floor at 0.15.
      if (this._prevBallNorm) {
        var dx = normX - this._prevBallNorm.x;
        var dy = normY - this._prevBallNorm.y;
        var jumpDist = Math.sqrt(dx * dx + dy * dy);
        var dtSec = this._prevBallNorm.ts ? Math.min(1.0, (Date.now() - this._prevBallNorm.ts) / 1000) : 0.033;
        var maxJump = Math.min(0.45, Math.max(0.15, 1.2 * dtSec));
        if (jumpDist > maxJump && this._consecutiveDets < 3) {
          // Reject this detection — likely jumped to a player
          this._consecutiveDets = 0;
          this._prevBallNorm = { x: normX, y: normY, ts: Date.now() };
          return;
        }
      }
      this._consecutiveDets++;
      this._prevBallNorm = { x: normX, y: normY, ts: Date.now() };

      updateTracker(this.tracker, cx, cy);
      this.ballPosition = {
        normX: normX, normY: normY,
        source: this._lastDetSource || 'core',
        confidence: this._lastDetConf || 0
      };
      if (this.onBallUpdate) this.onBallUpdate(this.ballPosition);

      // L14.B: track "ball was seen near rim" during an active shot.
      // Used by the pose-fallback timeout to upgrade MISS → MADE when the
      // ball never produced a full crossing trajectory but was clearly in
      // the rim's vicinity at some point. The bar is intentionally low —
      // we just need ANY frame of "ball near rim" during the shot window.
      if ((this._shotState === 'shot_started' || this._shotState === 'near_hoop') &&
          this.rimZone && this._rimStabilized) {
        var rimCX = this.rimZone.centerX;
        var rimCY = this.rimZone.centerY;
        var rimHW = (this.rimZone.width  || 0.10) * 0.5;
        var rimHH = (this.rimZone.height || 0.04) * 0.5;
        var nearMaxX = rimHW * 2.0;   // 2× half-width of rim — same scale as madeThresh
        var nearMaxY = rimHH * 5.0;   // generous vertical band centered on rim
        var dxN = Math.abs(normX - rimCX);
        var dyN = Math.abs(normY - rimCY);
        if (dxN <= nearMaxX && dyN <= nearMaxY) {
          this._ballSeenAtRim = true;
          this._ballNearRimHits = (this._ballNearRimHits || 0) + 1;
        }

        // L30: ordered THROUGH-RIM evidence from measured detections.
        // "Above the rim earlier, below it within the made span shortly
        // after" survives the detector blinks that break the consecutive-
        // frame crossing watch, while staying far stricter than
        // _ballSeenAtRim (any near-rim frame — true for misses too).
        var madeSpan = rimHW * 2.0;     // same span the L9.2 watch uses
        var nowEvid = Date.now();
        if (normY < rimCY - rimHH && dxN <= madeSpan * 1.25) {
          this._ballAboveRimAt = nowEvid;
        } else if (!this._ballThroughRimAt &&
                   this._ballAboveRimAt &&
                   nowEvid - this._ballAboveRimAt <= 1500 &&
                   normY > rimCY + rimHH &&
                   normY < rimCY + rimHH * 10 &&
                   dxN <= madeSpan) {
          this._ballThroughRimAt = nowEvid;
          this._logShotEvent('ball-through-rim-evidence', {
            dxFromRim:    +dxN.toFixed(3),
            normY:        +normY.toFixed(3),
            msSinceAbove: nowEvid - this._ballAboveRimAt
          });
        }
      }

      // ── L26: SAFE ball-trajectory shot trigger from IDLE state ──
      // For shots that no pose / ball-rise / set-point trigger caught, we
      // can detect the shot retroactively by recognizing the ball passing
      // DOWN through the rim with a real arc behind it. Four hard gates
      // prevent false positives the user flagged:
      //
      //   (1) Ball must have been ABOVE the rim ≥2 frames in last 0.5s
      //       → rejects a held-ball-at-player-height (no arc above rim)
      //   (2) Ball must be CURRENTLY moving DOWNWARD ≥3px over the last
      //       4 frames → rejects a stationary ball detection at rim level
      //   (3) Ball X must be within ±1.5× rim half-width of rim center
      //       → rejects strays detected on wall logos / scoreboard
      //   (4) Single-frame YOLOX strays can't satisfy gates (1)+(2) which
      //       both require multi-frame trajectory history
      //
      // Honors cooldown so it can never double-count a shot another
      // trigger already caught.
      // L30: the trigger gates below must see MEASURED points only —
      // Kalman-predicted ghosts satisfy the arc/descent gates with pure
      // physics, no pixels involved.
      var ridgeRealPts = (this._shotState === 'idle' && this.rimZone && this._rimStabilized &&
                          Date.now() - this.lastShotTime > DEBOUNCE_MS)
        ? this.tracker.positions.slice(-15).filter(function (p) { return !p.predicted; })
        : null;
      if (ridgeRealPts && ridgeRealPts.length >= 5) {
        var ridge_rim = this.rimZone;
        var ridge_pts = ridgeRealPts;
        var ridge_last = ridge_pts[ridge_pts.length - 1];
        var ridge_lastX = ridge_last.x / vw;
        var ridge_lastY = ridge_last.y / vh;
        // (1) at least 2 frames above rim within the slice
        var aboveRimFrames = 0;
        for (var ri = 0; ri < ridge_pts.length; ri++) {
          if ((ridge_pts[ri].y / vh) < ridge_rim.centerY - 0.03) aboveRimFrames++;
        }
        var hadHighArc = aboveRimFrames >= 2;
        // (2) descent over the last 4 frames
        var ridge_movingDown = false;
        if (ridge_pts.length >= 4) {
          var ridge_p0 = ridge_pts[ridge_pts.length - 4];
          var ridge_p1 = ridge_pts[ridge_pts.length - 1];
          ridge_movingDown = (ridge_p1.y - ridge_p0.y) > 3;
        }
        // (3) X within rim bounds
        var ridge_rimHalfW = (ridge_rim.width || 0.10) * 0.5;
        var ridge_withinRimX = Math.abs(ridge_lastX - ridge_rim.centerX) < ridge_rimHalfW * 1.5;
        // (4) L27: ball must have CROSSED the rim Y line (be AT or just
        // BELOW it), not just approached from above. The previous ±5 %
        // tolerance accepted balls 5 % above the rim, which fired the
        // MADE banner BEFORE the ball actually entered the rim.
        var ridge_nearRimY = ridge_lastY >= ridge_rim.centerY - 0.005 &&
                             ridge_lastY <= ridge_rim.centerY + 0.08;

        if (hadHighArc && ridge_movingDown && ridge_withinRimX && ridge_nearRimY) {
          var nowMs = Date.now();
          this._logShotEvent('ball-cross-rim-trigger', {
            ballX:           ridge_lastX.toFixed(3),
            ballY:           ridge_lastY.toFixed(3),
            rimX:            ridge_rim.centerX.toFixed(3),
            rimY:            ridge_rim.centerY.toFixed(3),
            aboveRimFrames:  aboveRimFrames,
            descentPx:       (ridge_p1.y - ridge_p0.y).toFixed(1)
          });
          // L30: open a retroactive shot and hand the verdict to the L9.2
          // post-crossing watch instead of counting an instant "missed"
          // that the L16 chain then upgraded to MADE unconditionally. The
          // watch's improvement + bounce guards are what actually separate
          // swishes from front-rim bounce-outs; if the ball vanishes into
          // the net, the through-rim evidence (L14.B) or the near_hoop
          // timeout resolves the shot instead.
          var ridge_rimHalfW2 = (ridge_rim.width || 0.08) / 2;
          // Interpolate the rim-line crossing from the last point above the
          // rim to the current one — same math as the watch's phase 1.
          var ridge_crossX = ridge_lastX;
          for (var rci = ridge_pts.length - 2; rci >= 0; rci--) {
            var rpY = ridge_pts[rci].y / vh;
            if (rpY < ridge_rim.centerY) {
              var rpX = ridge_pts[rci].x / vw;
              var rDy = ridge_lastY - rpY;
              var rRatio = rDy > 1e-6 ? (ridge_rim.centerY - rpY) / rDy : 0;
              ridge_crossX = rpX + rRatio * (ridge_lastX - rpX);
              break;
            }
          }
          this._shotState         = 'near_hoop';
          this._shotStateTime     = nowMs;
          this._shotTriggerSrc    = 'ball-trajectory';
          this._ballSeenAtRim     = true;
          this._ballNearRimHits   = (this._ballNearRimHits || 0) + 1;
          this._ballAboveRimAt    = nowMs;  // factual: the arc was above the rim
          this._ballThroughRimAt  = 0;
          this._sawBallAboveRim   = true;
          this._shotStartY        = ridge_lastY;
          this._ballMinY          = ridge_pts.reduce(function (m, p) { return Math.min(m, p.y); }, Infinity) / vh;
          this._releaseConfidence = 0.7;
          this._shooterFeetX      = null;
          this._shooterFeetY      = null;
          this._shotTrajectory    = [{ x: ridge_lastX, y: ridge_lastY, t: nowMs }];
          this._postCrossingWatch = {
            t0:        nowMs,
            bestDist:  Math.abs(ridge_crossX - ridge_rim.centerX),
            bestX:     ridge_crossX,
            bestY:     ridge_rim.centerY,
            lastY:     ridge_lastY,
            samples:   1,
            rimY: ridge_rim.centerY, rimX: ridge_rim.centerX,
            madeThresh: ridge_rimHalfW2 * 2.0
          };
          // NO return and NO instant count — flow falls through to the
          // L9.2 watch block below, which resolves made/missed in ~100ms.
        }
      }

      /* Feed to adaptive learning (Level 1 + 3) */
      /* cx/cy are in video coords — convert to processing canvas space for pixel sampling */
      if (window.AdaptiveLearning && this._canvas && this._ctx) {
        var cvW = (this._procW > 0) ? this._procW : vw;
        var cvH = (this._procH > 0) ? this._procH : vh;
        var canvasX = (vw > 0 && cvW > 0) ? cx * cvW / vw : cx;
        var canvasY = (vh > 0 && cvH > 0) ? cy * cvH / vh : cy;
        window.AdaptiveLearning.onBallDetected(this._canvas, this._ctx, canvasX, canvasY);
      }

      // ── Phase L2 + L9.1 + L9.2: Ball-through-rim made/miss ──
      // L9.1: madeThresh widened 1.6 → 2.0 × rimHalfW (user feedback: makes
      // were being classified as miss with the tighter sliver).
      // L9.2: "improvement-only" post-crossing watch (100ms). After the first
      // downward Y-crossing of the rim line, we keep looking for a subsequent
      // ball position with SMALLER distFromRim. This handles outdoor no-net
      // shots that glance the front rim (first crossing X is at the rim edge,
      // ball then falls cleanly toward center). Two guards prevent false
      // MADE from rim-bounce-and-out misses:
      //   1. Ball Y must keep increasing (no upward bounces during window)
      //   2. Once distFromRim starts INCREASING again, end watch (ball
      //      moving away from rim center → use the best so far)
      if ((this._shotState === 'shot_started' || this._shotState === 'near_hoop') &&
          this.rimZone && this._rimStabilized) {
        if (!this._shotTrajectory) this._shotTrajectory = [];
        this._shotTrajectory.push({ x: normX, y: normY, t: Date.now() });
        if (this._shotTrajectory.length > 60) this._shotTrajectory.shift();  // cap ~2s @ 30fps

        var rimY = this.rimZone.centerY;
        var rimX = this.rimZone.centerX;
        var rimHalfW = (this.rimZone.width || 0.08) / 2;
        var madeThresh = rimHalfW * 2.0;  // L9.1: was 1.6, widened for no-net outdoor rims

        // L9.2: post-crossing watch state
        var POST_CROSSING_WATCH_MS = 100;

        // Phase 1: detect first downward crossing → open watch
        if (!this._postCrossingWatch && this._shotTrajectory.length >= 2) {
          var prev = this._shotTrajectory[this._shotTrajectory.length - 2];
          var curr = this._shotTrajectory[this._shotTrajectory.length - 1];
          if (prev.y < rimY && curr.y >= rimY) {
            var dyTotal = curr.y - prev.y;
            var ratio = dyTotal > 1e-6 ? (rimY - prev.y) / dyTotal : 0;
            var crossingX = prev.x + ratio * (curr.x - prev.x);
            var distFromRim = Math.abs(crossingX - rimX);
            // Open the 100ms watch with this crossing as the starting "best".
            this._postCrossingWatch = {
              t0:        Date.now(),
              bestDist:  distFromRim,
              bestX:     crossingX,
              bestY:     rimY,
              lastY:     curr.y,
              samples:   1,
              rimY: rimY, rimX: rimX, madeThresh: madeThresh
            };
            dlog('[ShotState] first crossing at x=' + crossingX.toFixed(3) +
                 ' dist=' + distFromRim.toFixed(3) + ' — opening 100ms watch');
          }
        }

        // Phase 2: during watch, try to improve the decision
        if (this._postCrossingWatch) {
          var pc = this._postCrossingWatch;
          var nowMs = Date.now();
          var elapsed = nowMs - pc.t0;

          // Guard A: ball Y must keep increasing (no upward bounce). If it
          // bounces up, end the watch immediately — current best is final.
          var ballBouncedUp = normY < pc.lastY - 0.005; // 0.5% slack for jitter
          if (!ballBouncedUp) {
            var newDist = Math.abs(normX - pc.rimX);
            if (newDist < pc.bestDist) {
              // Improvement found — update best.
              pc.bestDist = newDist;
              pc.bestX    = normX;
              pc.bestY    = normY;
              dlog('[ShotState] L6-lite improved: dist ' +
                   pc.bestDist.toFixed(3) + ' (closer to rim center)');
            }
            // Guard B: if ball is now MOVING AWAY (newDist > bestDist by
            // meaningful margin), end watch — ball isn't going to settle
            // better than we already have.
            else if (newDist > pc.bestDist + 0.01) {
              elapsed = POST_CROSSING_WATCH_MS; // force end
            }
            pc.lastY = normY;
            pc.samples++;
          } else {
            elapsed = POST_CROSSING_WATCH_MS; // force end on bounce-up
          }

          if (elapsed >= POST_CROSSING_WATCH_MS) {
            var finalDist = pc.bestDist;
            var finalX    = pc.bestX;
            var finalThresh = pc.madeThresh;
            var result = finalDist <= finalThresh ? 'made' : 'missed';
            var conf = Math.max(0, 1 - finalDist / finalThresh);

            this._lastCrossing = {
              x: finalX, y: pc.bestY, t: nowMs,
              distFromRim: finalDist, madeThresh: finalThresh,
              result: result, confidence: conf,
              samples: pc.samples
            };
            this._lastShotReason = (result === 'made' ? 'MADE' : 'MISSED') +
                                   ' dist=' + finalDist.toFixed(3) +
                                   ' / thresh=' + finalThresh.toFixed(3) +
                                   ' (samples=' + pc.samples + ')';

            dlog('[ShotState] watch resolved: bestDist=' + finalDist.toFixed(3) +
                 ' thresh=' + finalThresh.toFixed(3) +
                 ' samples=' + pc.samples + ' → ' + result);

            var feetX = this._shooterFeetX != null ? this._shooterFeetX : 0.5;
            var feetY = this._shooterFeetY != null ? this._shooterFeetY : 0.8;
            this._countShot(result, vw, vh, feetX, feetY, nowMs);
            this._shotTrajectory   = [];
            this._postCrossingWatch = null;
            return;
          }
        }
      }

      this._analyzeShotState(vw, vh, normX, normY, 'ball');
    },

    _processNoBall: function () {
      this._consecutiveDets = 0;  // Reset consecutive detection count
      updateTracker(this.tracker, null, null);

      // ── Watchdog: prevent the state machine from getting stuck ──
      // _analyzeShotState only runs while a ball (real or Kalman-predicted)
      // is available. If the ball vanishes mid-flight and never reappears,
      // shot_started / near_hoop would otherwise wait forever. Force a
      // reset to idle 4s after the state was entered.
      var nowWd = Date.now();
      if ((this._shotState === 'shot_started' || this._shotState === 'near_hoop') &&
          this._shotStateTime > 0 && (nowWd - this._shotStateTime) > 4000) {
        this._shotState = 'idle';
        this._ballMinY = 1.0;
        this._shotStartY = 1.0;
        this._sawBallAboveRim = false;
        this._shotTriggerSrc    = null;
        this._releaseConfidence = null;
        this._shooterFeetX      = null;
        this._shooterFeetY      = null;
      }

      // If Kalman is predicting, show predicted position to UI
      var kf = this.tracker.kalman;
      var maxPredictNoBall = this.tracker._activeShotExtend ? Math.floor(KALMAN_MAX_PREDICT * 1.5) : KALMAN_MAX_PREDICT;
      if (kf.initialized && kf.predictCount > 0 && kf.predictCount <= maxPredictNoBall) {
        var vw = this.videoEl ? this.videoEl.videoWidth : 1;
        var vh = this.videoEl ? this.videoEl.videoHeight : 1;
        // L31: only surface/analyze the ghost while it is still inside the
        // frame — out-of-frame extrapolations are fiction, not a ball.
        var ghostVisible = kf.x >= -vw * 0.1 && kf.x <= vw * 1.1 &&
                           kf.y >= -vh * 0.3 && kf.y <= vh * 1.1;
        if (ghostVisible) {
          this.ballPosition = {
            normX: kf.x / vw, normY: kf.y / vh,
            source: 'predicted', confidence: 0
          };
          if (this.onBallUpdate) this.onBallUpdate(this.ballPosition);
          // Continue analyzing shot state with predicted position
          this._analyzeShotState(vw, vh, kf.x / vw, kf.y / vh, 'predicted');
          return;
        }
      }
      this.ballPosition = null;
      if (this.onBallUpdate) this.onBallUpdate(null);

      // ── Pose-only frame: run the state machine even with NO ball ──
      // YOLOX often misses non-orange balls (e.g. red Wilson, brown leather,
      // mini-balls, etc.) where Pose Lite still tracks the shooter perfectly.
      // We pass the SHOOTER's hip centroid (if we have one) as the "ball
      // position", which lets the geometric checks downstream still make
      // sense. If pose isn't ready either, this is a true no-signal frame
      // and the state machine is gated as before by the rim+tracker checks.
      if (this.rimZone && window.PoseDetector && window.PoseDetector.isReady() && this.videoEl) {
        var vwP = this.videoEl.videoWidth || 1;
        var vhP = this.videoEl.videoHeight || 1;
        var posePoll = window.PoseDetector.detect(this.videoEl, this.videoEl.currentTime || nowWd);
        if (posePoll && posePoll.landmarks && posePoll.landmarks.length >= 25) {
          // Use the SHOOTING-HAND wrist as the proxy "ball position" — that
          // is the closest meaningful point to where the ball actually is
          // during the rising phase. _analyzeShotState only uses normX/normY
          // for rim-proximity checks; the pose-trigger inside it doesn't
          // care about these coords at all.
          var lw = posePoll.landmarks[15] || { x:0.5, y:0.5 };
          var rw = posePoll.landmarks[16] || { x:0.5, y:0.5 };
          var wrist = (lw.y < rw.y) ? lw : rw;
          this._analyzeShotState(vwP, vhP, wrist.x, wrist.y, 'wrist');
        }
      }

      // Timeout-based miss: the ball was being tracked during an ACTIVE
      // shot and vanished near the rim without producing a verdict.
      // L30: gated to active shot states — the old version also fired from
      // IDLE, manufacturing phantom attempts whose "last point" was usually
      // a Kalman ghost (the position buffer ends with up to 60-90 predicted
      // entries before isTracking finally flips false). The verdict now
      // comes from _countShot, which upgrades missed → made only on
      // through-rim evidence (the L16/L17/L22 trigger-source upgrades that
      // lived here are gone — they made 'missed' unreachable).
      if ((this._shotState === 'shot_started' || this._shotState === 'near_hoop') &&
          this.rimZone && this.tracker.positions.length >= MIN_TRAJECTORY_PTS && !this.tracker.isTracking) {
        var now = Date.now();
        if (now - this.lastShotTime < DEBOUNCE_MS) return;
        var vw = this.videoEl ? this.videoEl.videoWidth : 1;
        var vh = this.videoEl ? this.videoEl.videoHeight : 1;
        var pts = this.tracker.positions;
        // Last MEASURED point — predicted tails are not sightings.
        var lastPt = null;
        for (var lpi = pts.length - 1; lpi >= 0; lpi--) {
          if (!pts[lpi].predicted) { lastPt = pts[lpi]; break; }
        }
        if (lastPt) {
          var normX = lastPt.x / vw;
          var normY = lastPt.y / vh;
          if (isInApproachZone(normX, normY, this.rimZone)) {
            dlog('[ShotDetection] timeout miss: ball disappeared near rim during active shot');
            this._logShotEvent('timeout-miss', {
              lastX: +normX.toFixed(3),
              lastY: +normY.toFixed(3),
              throughRim: !!this._ballThroughRimAt
            });
            this._countShot('missed', vw, vh, normX, normY, now);
          }
        }
      }
    },

    /* ── Shot state machine (time-based, rim-relative) ──────────
       States: idle → shot_started → near_hoop → cooldown → idle

       Design notes (post-eval rewrite):
       • All thresholds are TIME-based or RIM-RELATIVE so the machine
         behaves identically at 30 Hz live capture and 5 Hz YOLOX cadence.
       • idle → shot_started fires on sustained upward motion in any
         600 ms window; we no longer require the ball to be below the
         rim, so cameras that look UP at the rim still trigger.
       • near_hoop entry is 2.5 × rim-heights from the rim center, so
         the zone scales with how the model sized the hoop bbox
         instead of using a fixed 0.20 frame fraction.
       • make / miss is a crossing rule: the ball was seen above the
         rim, then below the rim, with horizontal alignment. A
         minimum-motion gate prevents a stationary ball or a short
         dribble bounce from being counted as a shot.
    ────────────────────────────────────────────────────────────── */
    _analyzeShotState: function (vw, vh, normX, normY, sampleSource) {
      // _rimStabilized is the screen's "rim has finished converging" signal.
      // Until that flips on, we ignore everything — the EMA on the auto-lock
      // is still settling and we don't want phantom shots from a rim zone
      // that's drifting across the frame.
      if (!this.rimZone || !this._rimStabilized) return;
      var now = Date.now();
      var rim = this.rimZone;
      // L30: only MEASURED ball detections may create made/miss EVIDENCE
      // (above-rim flags, min-Y, the crossing rule). Kalman-predicted
      // ghosts follow gravity straight "through" the rim, and the pose
      // wrist proxy puts a "ball" at rim height whenever a player reaches
      // up under the basket — both faked crossings before this gate.
      // Non-ball samples still drive zone ENTRY and timeouts.
      var isBallSample = (sampleSource === 'ball' || sampleSource === undefined);

      // Cooldown
      if (this._shotState === 'cooldown') {
        if (now - this._shotStateTime > DEBOUNCE_MS) {
          this._shotState = 'idle';
          this._ballMinY = 1.0;
          this._shotStartY = 1.0;
          this._sawBallAboveRim = false;
        }
        return;
      }

      // Track the highest point the ball reaches (lowest Y value)
      if (isBallSample && normY < this._ballMinY) this._ballMinY = normY;

      var pts = this.tracker.positions;

      // Extended Kalman prediction during active shot phases
      var isActiveShotState = (this._shotState === 'shot_started' || this._shotState === 'near_hoop');
      this.tracker._activeShotExtend = isActiveShotState;

      // Tracker-based gate: ball-rose-in-window needs at least
      // MIN_TRAJECTORY_PTS samples to compute a slope. But the pose-only
      // trigger doesn't need any tracker data — so we don't early-return
      // here. The idle branch below handles "tracker empty" gracefully
      // by skipping ballRose and relying on poseShot exclusively.

      // ── IDLE: dual-trigger (pose primary, ball-rose-in-window fallback) ──
      // Pose is far more reliable for shot detection (84% recall on the
      // 25-shot indoor video vs 12% with ball-only). When PoseDetector is
      // loaded and reports a release-peak, fire shot_started immediately
      // and stash the shooter's hip centroid for later zone classification.
      // The ball-rose-in-window fallback stays in place so the engine still
      // works on browsers where MediaPipe failed to load OR when the
      // shooter is out of frame for some reason.
      if (this._shotState === 'idle') {
        var poseShot = null;
        if (window.PoseDetector && window.PoseDetector.isReady() && this.videoEl) {
          var pose = window.PoseDetector.detect(this.videoEl, this.videoEl.currentTime || now);
          if (pose && pose.landmarks) {
            poseShot = window.PoseDetector.detectShootingMotion(pose.landmarks, now);
          }
        }
        // ballRose needs trajectory history; skip when tracker is empty
        var ballRose = pts.length >= MIN_TRAJECTORY_PTS &&
                       ballRoseInWindow(this.tracker, vh, 600, 0.03);
        if ((poseShot && poseShot.isShot) || ballRose) {
          this._shotState         = 'shot_started';
          this._shotStateTime     = now;
          this._ballMinY          = normY;
          this._shotStartY        = normY;
          this._sawBallAboveRim   = (normY < rim.centerY); // already above rim at release?
          this._ballSeenAtRim     = false;  // L14.B: reset rim-proximity flag
          this._ballNearRimHits   = 0;
          this._ballAboveRimAt    = 0;      // L30: reset through-rim evidence
          this._ballThroughRimAt  = 0;
          this._logShotEvent(poseShot && poseShot.isShot ? 'pose-trigger' : 'ball-rise-trigger', {
            normY: normY,
            rimCenterY: rim.centerY
          });
          if (poseShot && poseShot.isShot) {
            this._shotTriggerSrc    = 'pose';
            this._releaseConfidence = poseShot.releaseConfidence;
            this._shooterFeetX      = poseShot.shooterCenterX;
            this._shooterFeetY      = poseShot.shooterCenterY;
            dlog('[ShotState] shot_started (POSE)  conf=' + poseShot.releaseConfidence.toFixed(2) +
                 ' hand=' + poseShot.shootingHand);
          } else {
            this._shotTriggerSrc    = 'ball';
            this._releaseConfidence = null;
            this._shooterFeetX      = null;
            this._shooterFeetY      = null;
            dlog('[ShotState] shot_started (BALL)');
          }
        }
        return;
      }

      // ── SHOT_STARTED: wait for ball to reach the rim zone ──
      if (this._shotState === 'shot_started') {
        if (isBallSample && normY < rim.centerY) this._sawBallAboveRim = true;

        // Rim-relative entry zone: within 2.5 rim-heights of the rim center.
        // Scales with however the model sized the hoop bbox, instead of
        // assuming the rim is far enough below the top of frame for a
        // fixed 0.20 fraction to make sense.
        var distFromRim = Math.abs(normY - rim.centerY);
        if (distFromRim < (rim.height || 0.04) * 2.5) {
          this._shotState = 'near_hoop';
          this._shotStateTime = now;
          return;
        }
        if (now - this._shotStateTime > 3000) {
          // Pose-triggered shot timed out without the ball reaching near_hoop.
          // L33: aligned with the pose-fallback policy — pose/setpoint
          // timeouts count ONLY with through-rim evidence (→ made). Misses
          // that actually reached the rim are counted by the rim-event
          // path with correct timing; a timeout with no through is either
          // a phantom trigger or an airball — dropped, not counted.
          if (this._shotTriggerSrc === 'pose' || this._shotTriggerSrc === 'pose-setpoint') {
            if (this._ballThroughRimAt > 0) {
              this._countShot('made', vw, vh, normX, normY, now);
              return;
            }
            this._logShotEvent('pose-timeout-dropped', { triggerSrc: this._shotTriggerSrc });
            // fall through to the silent reset below
          }
          this._shotState = 'idle';
          this._ballMinY = 1.0;
          this._shotStartY = 1.0;
          this._sawBallAboveRim = false;
          this._shotTriggerSrc    = null;
          this._releaseConfidence = null;
          this._shooterFeetX      = null;
          this._shooterFeetY      = null;
        }
        return;
      }

      // ── NEAR_HOOP: simplified crossing rule with motion gate ──
      if (this._shotState === 'near_hoop') {
        var hoopXDist     = Math.abs(normX - rim.centerX);
        var nearHoopX     = hoopXDist < rim.width * 1.5;        // tight: for MADE
        var stillNearX    = hoopXDist < rim.width * 3.0;        // loose: still in zone

        var ballAboveRim  = normY < rim.centerY;
        var ballBelowRim  = normY > rim.centerY + (rim.height || 0.04);
        if (isBallSample && ballAboveRim) this._sawBallAboveRim = true;

        // Minimum-motion gate: ball must have actually risen, scaled to
        // how far below the rim the shot started. Below the rim by 0.30
        // gates at 0.09; above the rim or close to it gates at the 0.05
        // floor so layups under the basket can still register.
        var arcHeight = this._shotStartY - this._ballMinY;
        var minMotion = Math.max(0.05, Math.abs(this._shotStartY - rim.centerY) * 0.3);

        // Pose-triggered shots already passed a high-confidence "this is a
        // shot" check via MediaPipe — we don't re-impose the ball-trajectory
        // arcHeight gate (which expects ball-rises-from-court, irrelevant
        // when we're tracking a wrist that's already at the peak when
        // shot_started fires).
        var isPoseShot = (this._shotTriggerSrc === 'pose');
        var motionOk   = isPoseShot || (this._sawBallAboveRim && arcHeight >= minMotion);

        // MADE: was above rim, now below rim, horizontally aligned, motion gate cleared
        // L30: isBallSample — a MADE verdict needs a measured ball below the
        // rim, not a Kalman ghost or a wrist landmark sitting there.
        if (isBallSample && this._sawBallAboveRim && ballBelowRim && nearHoopX && motionOk) {
          this._countShot('made', vw, vh, normX, normY, now);
          return;
        }

        // MISS: ball moved away from rim OR timed out, with sufficient motion + above-rim seen
        var ballFarFromHoop = !stillNearX || normY > rim.centerY + (rim.height || 0.04) * 4;
        var timeout         = now - this._shotStateTime > 2000;

        if (ballFarFromHoop || timeout) {
          // L33: pose/setpoint shots never self-count a miss here either —
          // near_hoop is entered and exited by WRIST and Kalman samples on
          // these shots, so "ball moved away" is not ball evidence. The
          // rim-event path owns their miss verdicts (eval: this branch was
          // double-counting tip plays ~1s before the rim event resolved
          // the same attempt). Through-evidence still converts to a make.
          var isPoseSrc = (this._shotTriggerSrc === 'pose' || this._shotTriggerSrc === 'pose-setpoint');
          if (isPoseSrc && this._ballThroughRimAt > 0) {
            this._countShot('made', vw, vh, normX, normY, now);
          } else if (isPoseSrc) {
            this._logShotEvent('pose-nearhoop-dropped', {
              far: !!ballFarFromHoop, timedOut: !!timeout
            });
            this._shotState     = 'idle';
            this._ballMinY      = 1.0;
            this._shotStartY    = 1.0;
            this._sawBallAboveRim = false;
            this._shotTriggerSrc    = null;
            this._releaseConfidence = null;
            this._shooterFeetX      = null;
            this._shooterFeetY      = null;
          } else if (motionOk) {
            this._countShot('missed', vw, vh, normX, normY, now);
          } else {
            // Not a real shot — drop back to idle without counting
            this._shotState     = 'idle';
            this._ballMinY      = 1.0;
            this._shotStartY    = 1.0;
            this._sawBallAboveRim = false;
            this._shotTriggerSrc    = null;
            this._releaseConfidence = null;
            this._shooterFeetX      = null;
            this._shooterFeetY      = null;
          }
          return;
        }
      }
    },

    _countShot: function (result, vw, vh, normX, normY, now) {
      // L16: preflight is now ADVISORY ONLY. Earlier versions dropped shots
      // before preflight passed which caused the first 15-20s of any session
      // to be silently lost. The visual "CALIBRATING…" panel still shows but
      // doesn't block counting.
      //
      // L30: EVIDENCE-GATED counting — replaces the L16/L17/L22 upgrade
      // chain. Those rules gave every trigger source its own miss→made
      // path ("ball was anywhere near the rim" / "pose said shot" /
      // "ball rose"), which made 'missed' structurally unreachable: every
      // eval run returned N/N MADE vs ground truth 13 made / 8 miss.
      //
      // The ONE remaining upgrade: ordered through-rim evidence collected
      // by L14.B' — a measured ball above the rim, then below it within
      // the made span, in that order, within 1.5s. That is what a make
      // LOOKS like when detector blinks hide the actual crossing frame.
      // A trigger source alone never converts a miss into a make; shots
      // with no ball evidence stay missed attempts (the honest reading:
      // we saw a shot happen and never saw the ball go in).
      var resultUpgraded = false;
      if (result === 'missed' && this._ballThroughRimAt > 0) {
        this._logShotEvent('miss-upgraded-to-made', {
          via: 'through-rim-evidence',
          ballNearRimHits: this._ballNearRimHits || 0,
          triggerSrc:      this._shotTriggerSrc
        });
        result = 'made';
        resultUpgraded = true;
      }
      this._logShotEvent('shot-counted', {
        result:          result,
        triggerSrc:      this._shotTriggerSrc,
        ballSeenAtRim:   !!this._ballSeenAtRim,
        ballThroughRim:  !!this._ballThroughRimAt,
        ballNearRimHits: this._ballNearRimHits || 0,
        normX:           normX,
        normY:           normY
      });

      this.lastShotTime = now;
      this._shotState = 'cooldown';
      this._shotStateTime = now;
      this._ballMinY = 1.0;
      this._shotStartY = 1.0;
      this._sawBallAboveRim = false;

      // Prefer pose-supplied shooter hip centroid when available — far more
      // reliable than ball-trajectory launch point on noisy detections,
      // and matches the actual shooter's feet location (not the ball's
      // first detected position which might be at peak of arc).
      var launchPt;
      if (this._shotTriggerSrc === 'pose' && this._shooterFeetX != null) {
        launchPt = { x: this._shooterFeetX * vw, y: this._shooterFeetY * vh };
      } else {
        launchPt = getLaunchPoint(this.tracker, vw, vh);
      }
      var shotZone = classifyShotZone(launchPt, this.rimZone, this.threePtDistance);
      // Capture trigger source before we clear the state for the cooldown
      var triggerSrc = this._shotTriggerSrc;
      var releaseConf = this._releaseConfidence;
      var traj = getTrajectoryNormalized(this.tracker, vw, vh, 20);

      // ── Trajectory-based verification (analyzeMade/analyzeMiss) ──
      // Normalize pixel trajectory to 0-1 space to match rimZone coordinates.
      // L30: measured points only — Kalman tails fall plausibly through the
      // rim by construction and fooled analyzeMade.
      var rawPts = this.tracker.positions.slice(-30).filter(function (pt) { return !pt.predicted; });
      var normTraj = rawPts.map(function (pt) {
        return { x: pt.x / vw, y: pt.y / vh, frame: pt.frame };
      });
      var madeAnalysis = analyzeMade(normTraj, this.rimZone);
      var missAnalysis = analyzeMiss(normTraj, this.rimZone);

      // Cross-check state machine result with trajectory analysis.
      // L24: SKIP the override entirely when the result was already upgraded
      // by L16/L17/L22. Partial trajectories (compressed footage, YOLOX
      // blinks) make analyzeMade=false + analyzeMiss=true even on real
      // makes, which then undoes every upgrade and produces 0 MADE / N
      // ATTEMPTS sessions. The upgrade signals (ballSeenAtRim, pose
      // trigger, ball-rise trigger) are more reliable than trajectory
      // analysis on noisy footage.
      var finalResult = result;
      if (!resultUpgraded) {
        if (result === 'made' && !madeAnalysis.isMade && missAnalysis.isMiss) {
          // State machine said made, but trajectory says miss — trust trajectory
          finalResult = 'missed';
          dlog('[ShotTracker] Override: made → missed (trajectory analysis)');
        } else if (result === 'missed' && madeAnalysis.isMade) {
          // State machine said miss, but trajectory clearly shows made — trust trajectory
          finalResult = 'made';
          dlog('[ShotTracker] Override: missed → made (trajectory analysis)');
        }
      }

      if (finalResult === 'made') this.stats.made++;
      this.stats.attempts++;

      var shotData = {
        result: finalResult,
        shotX: normX,
        shotY: normY,
        trajectory: traj,
        launchPoint: launchPt,
        shotZone: shotZone,
        timestamp: now,
        triggerSrc: triggerSrc,           // 'pose' | 'ball' — for analytics + UI badge
        releaseConfidence: releaseConf    // 0-1 when pose-triggered, null otherwise
      };

      dlog('[ShotTracker] ' + finalResult.toUpperCase() +
        ' (sm=' + result + ' traj_made=' + madeAnalysis.isMade + ' traj_miss=' + missAnalysis.isMiss + ')' +
        ' src=' + triggerSrc +
        ' minY=' + this._ballMinY.toFixed(3) +
        ' hoopY=' + this.rimZone.centerY.toFixed(3) + ' ballX=' + normX.toFixed(3) + ' hoopX=' + this.rimZone.centerX.toFixed(3));

      if (window.AdaptiveLearning) {
        window.AdaptiveLearning.onShotCompleted(traj, result, this.rimZone);
      }
      if (this.onShotDetected) this.onShotDetected(shotData);
      resetTracker(this.tracker);

      // Clear pose-related fields now that we've stamped them onto shotData
      this._shotTriggerSrc    = null;
      this._releaseConfidence = null;
      this._shooterFeetX      = null;
      this._shooterFeetY      = null;
      // L30: consume the rim evidence — the next shot must earn its own.
      this._ballSeenAtRim     = false;
      this._ballNearRimHits   = 0;
      this._ballAboveRimAt    = 0;
      this._ballThroughRimAt  = 0;
    },

    _setStatus: function (status) {
      if (this.onStatusChange) this.onStatusChange(status);
    }
  };

  /* ── Expose globally ────────────────────────────────────────── */
  window.ShotDetectionEngine = ShotDetectionEngine;

})();
