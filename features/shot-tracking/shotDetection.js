/* ══════════════════════════════════════════════════════════════
   SHOT DETECTION — ML + Color Fallback Ball Detection
   + Centroid Tracker + Shot Result Analysis

   v9 — Custom YOLOX-tiny (Apache 2.0) trained on basketball dataset.
        2 classes: Basketball (0), Basketball Hoop (1).
        Output: [1, 3549, 7] = [cx, cy, w, h, objectness, ball_score, hoop_score]
        YOLOX runs every 3rd frame. Color detection every frame as fallback.

   Runs entirely in-browser using:
     - ONNX Runtime Web (WASM backend) + YOLOX-tiny (custom trained, 20 MB)
     - Canvas color analysis (always available)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Constants ──────────────────────────────────────────────── */
  var DEBOUNCE_MS          = 1500;  // Cooldown between counted shots
  var MIN_TRAJECTORY_PTS   = 3;    // Fewer points needed before analyzing
  var MAX_HISTORY          = 50;   // Larger rolling buffer
  var MAX_GAP_FRAMES       = 12;   // More grace frames for ball vanishing
  var MIN_MOVEMENT_PX      = 2;    // Lower jitter threshold
  var BALL_CONFIDENCE      = 0.005; // Ultra-low threshold for YOLOX basketball (verified with orange color)
  var MADE_MAX_FRAMES      = 22;   // More frames allowed for rim transit
  var DETECTION_INTERVAL   = 33;   // ~30 FPS color detection (YOLOX runs async every 6th frame)

  /* ── YOLOX-tiny constants (custom 2-class model) ─────────── */
  var YOLOX_INPUT_SIZE     = 416;
  var YOLOX_NUM_CLASSES    = 2;
  var YOLOX_BALL_CLASS     = 0;    // Basketball
  var YOLOX_HOOP_CLASS     = 1;    // Basketball Hoop
  var YOLOX_STRIDE         = 7;    // 4 (box) + 1 (objectness) + 2 (classes)

  // Pre-allocated buffers for ONNX inference (avoid GC)
  var _yoloxBuf    = null;
  var _yoloxCanvas = null;
  var _yoloxCtx    = null;

  // Web Worker for CHW preprocessing (offloads ~520K array writes from main thread)
  var _chwWorker   = null;
  try {
    _chwWorker = new Worker('features/shot-tracking/yoloxWorker.js');
  } catch (e) {
    console.warn('[ShotDetection] Web Worker unavailable, using main thread CHW');
  }

  /* Area thresholds as fractions of total frame area */
  var BALL_MIN_AREA_FRAC   = 0.00005;  // Very small — distant shots
  var BALL_MAX_AREA_FRAC   = 0.18;     // Very large — close-up shots

  /* Y-trend diff threshold as fraction of frame height */
  var Y_TREND_FRAC         = 0.003;   // Lower — catch slower arcing shots

  /* Color detection constants */
  var COLOR_SCAN_STEP      = 4;    // Pixel step for color scanning (performance)
  var COLOR_MIN_PIXELS     = 12;   // Minimum orange pixels to count as ball
  var COLOR_MAX_PIXELS     = 8000; // Maximum (too large = not a ball)

  /* ── 2D Kalman Filter (position + velocity) ─────────────────── */
  /* State: [x, y, vx, vy]  —  constant-velocity model with gravity */
  var KALMAN_PROCESS_NOISE = 0.5;   // How much we trust the physics model
  var KALMAN_MEASURE_NOISE = 3.0;   // How noisy the detections are (pixels)
  var KALMAN_GRAVITY       = 0.8;   // Gravity pull per frame (pixels, downward = positive Y)
  var KALMAN_MAX_PREDICT   = 18;    // Max frames to predict without measurement

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
    // Update velocity from position correction
    kf.vx += ix * 0.3;  // Smooth velocity update
    kf.vy += iy * 0.3;
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
      if (kf.initialized && kf.predictCount < KALMAN_MAX_PREDICT) {
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

  function getYTrend(tracker, vh, lookback) {
    lookback = lookback || 8;
    var pts = tracker.positions;
    if (pts.length < lookback) return 'flat';
    var recent = pts.slice(-lookback);
    var mid = Math.floor(recent.length / 2);
    var firstAvg = 0, secondAvg = 0;
    for (var i = 0; i < mid; i++) firstAvg += recent[i].y;
    firstAvg /= mid;
    for (var j = mid; j < recent.length; j++) secondAvg += recent[j].y;
    secondAvg /= (recent.length - mid);
    var diff = (secondAvg - firstAvg) / (vh || 720);
    if (diff < -Y_TREND_FRAC) return 'rising';
    if (diff > Y_TREND_FRAC) return 'falling';
    return 'flat';
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
        if (r > 100 && g > 30 && g < 200 && b < 130 && r > g * 1.05 && r > b * 1.5) {
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
    _isDetecting: false,
    _mlFailed: false,
    _colorOnlyMode: false,
    _mlMissCount: 0,
    _frameCount: 0,
    _detectorType: 'none',   // 'yolox' | 'none'
    _procW: 0,
    _procH: 0,
    _lastMLBallPos: null,    // { x, y, frame } — last YOLOX ball detection for guided color search
    _shotState: 'idle',      // idle | shot_started | near_hoop | cooldown
    _shotStateTime: 0,       // timestamp when current state started
    _ballMinY: 1.0,          // lowest Y (highest point) seen during current shot arc

    init: function () {
      var self = this;
      self.tracker = createTracker();
      self._mlFailed = false;
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

      var modelPath = 'models/basketball_yolox_tiny.onnx?v=4';
      ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgpu', 'webgl', 'wasm'],
        graphOptimizationLevel: 'all'
      }).then(function (session) {
        self.model = session;
        self._detectorType = 'yolox';
        // Pre-allocate reusable buffers
        var sz = YOLOX_INPUT_SIZE;
        _yoloxBuf = new Float32Array(1 * 3 * sz * sz);
        _yoloxCanvas = document.createElement('canvas');
        _yoloxCanvas.width = sz;
        _yoloxCanvas.height = sz;
        _yoloxCtx = _yoloxCanvas.getContext('2d');
        console.log('[ShotDetection] YOLOX-tiny basketball model loaded (Apache 2.0)');
        self._setStatus('ready');
        resolve(true);
      }).catch(function (err) {
        console.warn('[ShotDetection] YOLOX-tiny load failed — color-only mode:', err);
        self._mlFailed = true;
        self._colorOnlyMode = true;
        self._detectorType = 'none';
        self._setStatus('color-only');
        resolve(true);
      });
    },

    setRimZone: function (normCX, normCY, normW, normH) {
      this.rimZone = createRimZone(normCX, normCY, normW, normH);
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
      this._shotState = 'idle';
      this._shotStateTime = 0;
      this._ballMinY = 1.0;
      this._lastMLBallPos = null;
      resetTracker(this.tracker);
      this._setStatus('detecting');
      this._scheduleDetection();
    },

    stop: function () {
      this.isRunning = false;
      if (this.detectionTimer) {
        clearTimeout(this.detectionTimer);
        this.detectionTimer = null;
      }
      this.ballPosition = null;
      this._setStatus('stopped');
    },

    resetStats: function () {
      this.stats = { made: 0, attempts: 0 };
      resetTracker(this.tracker);
      this.lastShotTime = 0;
      this.ballPosition = null;
    },

    /* ── Internal ──────────────────────────────────────────────── */

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

      /* Downscale to max 480px wide for processing performance */
      var maxW = 480;
      var scale = vw > maxW ? maxW / vw : 1;
      var pw = Math.floor(vw * scale);
      var ph = Math.floor(vh * scale);

      if (this._canvas.width !== pw) this._canvas.width = pw;
      if (this._canvas.height !== ph) this._canvas.height = ph;
      this._ctx.drawImage(this.videoEl, 0, 0, pw, ph);

      /* Store processed dimensions for downstream use */
      this._procW = pw;
      this._procH = ph;
      return true;
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
      }

      /* Scale ball positions from processing canvas back to video coords */
      var scaleX = pw > 0 ? vw / pw : 1;
      var scaleY = ph > 0 ? vh / ph : 1;

      /* Process color detection — skip on frames where YOLOX will run */
      var isYoloxFrame = self.model && !self._colorOnlyMode && canvasReady &&
                         (self._frameCount + 1) % 6 === 0;
      if (!self._isDetecting && !isYoloxFrame) {
        if (colorBall) {
          self._processBallDetection(colorBall.x * scaleX, colorBall.y * scaleY, vw, vh);
        } else {
          self._processNoBall();
        }
      }

      /* ── YOLOX detection (every 6th frame, async, non-blocking) ── */
      self._frameCount++;
      if (self.model && !self._colorOnlyMode && !self._isDetecting && canvasReady && self._frameCount % 6 === 0) {
        self._isDetecting = true;
        self._runYoloxInference(vw, vh, pw, ph, scaleX, scaleY, colorBall);
      }

      self._scheduleDetection();
    },

    /* ── YOLOX ONNX inference (async) ─────────────────────────── */
    _runYoloxInference: function (vw, vh, pw, ph, scaleX, scaleY, colorBall) {
      var self = this;
      var sz = YOLOX_INPUT_SIZE;

      // Letterbox preprocess: fit processing canvas into 416×416 with gray padding
      var ratio = Math.min(sz / ph, sz / pw);
      var newW = Math.round(pw * ratio);
      var newH = Math.round(ph * ratio);

      _yoloxCtx.fillStyle = 'rgb(114,114,114)';
      _yoloxCtx.fillRect(0, 0, sz, sz);
      _yoloxCtx.drawImage(self._canvas, 0, 0, pw, ph, 0, 0, newW, newH);

      var imgData = _yoloxCtx.getImageData(0, 0, sz, sz).data;

      // CHW transposition: use Web Worker if available, else inline
      var chwReady;
      if (_chwWorker) {
        chwReady = new Promise(function (resolve) {
          _chwWorker.onmessage = function (ev) { resolve(ev.data.buffer); };
          _chwWorker.postMessage({ imageData: imgData, size: sz }, [imgData.buffer]);
        });
      } else {
        var chSize = sz * sz;
        for (var i = 0; i < chSize; i++) {
          _yoloxBuf[i]              = imgData[i * 4];
          _yoloxBuf[chSize + i]     = imgData[i * 4 + 1];
          _yoloxBuf[chSize * 2 + i] = imgData[i * 4 + 2];
        }
        chwReady = Promise.resolve(_yoloxBuf);
      }

      chwReady.then(function (chwBuf) {
        var inputTensor = new ort.Tensor('float32', chwBuf, [1, 3, sz, sz]);
        // Debug: log input stats once
        if (!self._dbgInputLogged) {
          self._dbgInputLogged = true;
          var mn = Infinity, mx = -Infinity;
          for (var di = 0; di < Math.min(1000, chwBuf.length); di++) {
            if (chwBuf[di] < mn) mn = chwBuf[di];
            if (chwBuf[di] > mx) mx = chwBuf[di];
          }
          console.log('[YOLOX-DBG] input range: ' + mn.toFixed(1) + ' - ' + mx.toFixed(1) + ' len=' + chwBuf.length);
        }
        return self.model.run({ images: inputTensor });
      }).then(function (results) {
        var outputData = results.output.data;
        // Debug: log raw output stats once
        if (!self._dbgOutputLogged) {
          self._dbgOutputLogged = true;
          console.log('[YOLOX-DBG] output len=' + outputData.length + ' (expect ' + (3549*7) + ')');
          // Check raw obj/cls values before postprocess
          var maxObj = 0, maxC0 = 0, maxC1 = 0;
          for (var di = 0; di < outputData.length; di += 7) {
            if (outputData[di+4] > maxObj) maxObj = outputData[di+4];
            if (outputData[di+5] > maxC0) maxC0 = outputData[di+5];
            if (outputData[di+6] > maxC1) maxC1 = outputData[di+6];
          }
          console.log('[YOLOX-DBG] raw maxObj=' + maxObj.toFixed(4) + ' maxBall=' + maxC0.toFixed(4) + ' maxHoop=' + maxC1.toFixed(4));
          var hasNeg = false;
          for (var di = 0; di < outputData.length; di += 7) {
            if (outputData[di+4] < 0 || outputData[di+5] < 0 || outputData[di+6] < 0) { hasNeg = true; break; }
          }
          console.log('[YOLOX-DBG] hasNegatives=' + hasNeg + ' (false=sigmoid, true=logits)');
        }

        var mlBall = self._yoloxDecode(outputData, ratio, pw, ph);

        // Fire hoop detection callback (normalized 0-1 coords)
        if (self.onHoopDetected && self._lastHoopDetection) {
          var h = self._lastHoopDetection;
          self.onHoopDetected({
            cx: h.cx / pw, cy: h.cy / ph,
            bw: h.bw / pw, bh: h.bh / ph,
            score: h.score
          });
        }

        if (mlBall) {
          // For low-confidence detections, verify orange color in the region
          if (mlBall.score < 0.15) {
            var verified = self._verifyOrange(mlBall.cx, mlBall.cy, Math.max(mlBall.bw, mlBall.bh), pw, ph);
            if (!verified) { mlBall = null; }
          }
        }

        // Detection logging
        if (self._frameCount % 30 === 0) {
          var hoopStr = 'none';
          if (self._lastHoopDetection) {
            var hd = self._lastHoopDetection;
            hoopStr = 'score=' + hd.score.toFixed(3) + ' cx=' + hd.cx.toFixed(1) + ' cy=' + hd.cy.toFixed(1);
          }
          console.log('[ShotDetection] f=' + self._frameCount +
            ' vw=' + vw + ' vh=' + vh + ' pw=' + pw + ' ph=' + ph +
            ' ball=' + (mlBall ? 'ML(' + mlBall.score.toFixed(3) + ' cx=' + mlBall.cx.toFixed(1) + ')' : (colorBall ? 'color' : 'none')) +
            ' hoop=' + hoopStr);
        }

        if (mlBall) {
          self._mlMissCount = 0;
          self._lastMLBallPos = { x: mlBall.cx, y: mlBall.cy, frame: self._frameCount };
          self._lastDetSource = 'ml';
          self._lastDetConf = mlBall.score;
          self._processBallDetection(mlBall.cx * scaleX, mlBall.cy * scaleY, vw, vh);
        } else if (colorBall) {
          self._mlMissCount++;
          self._lastDetSource = 'color';
          self._lastDetConf = 0;
          self._processBallDetection(colorBall.x * scaleX, colorBall.y * scaleY, vw, vh);
        } else {
          self._mlMissCount++;
          self._processNoBall();
        }

        self._isDetecting = false;
        self._scheduleDetection();
      }).catch(function (e) {
        console.warn('[ShotDetection] YOLOX inference error:', e);
        // Fallback to color
        if (colorBall) {
          self._processBallDetection(colorBall.x * scaleX, colorBall.y * scaleY, vw, vh);
        } else {
          self._processNoBall();
        }
        self._isDetecting = false;
        self._scheduleDetection();
      });
    },

    /* ── YOLOX grid+stride postprocess (required for raw ONNX output) ── */
    /* The ONNX model outputs raw grid offsets, not decoded pixel coords.
       This applies: cx = (raw_cx + grid_x) * stride, w = exp(raw_w) * stride */
    _yoloxPostprocess: function (output) {
      var sz = YOLOX_INPUT_SIZE; // 416
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
    /* After _yoloxPostprocess, cx/cy/w/h are in 416x416 input space */
    _yoloxDecode: function (output, ratio, pw, ph) {
      // Apply grid+stride decoding (converts raw offsets → pixel coords in 416x416 space)
      this._yoloxPostprocess(output);

      var numDets = output.length / YOLOX_STRIDE;
      var ballCandidates = [];
      var hoopCandidates = [];
      var frameArea = pw * ph;

      // Auto-detect: if any obj/cls value is negative, output is raw logits (needs sigmoid)
      // ORT-Web may skip fused sigmoid depending on version/backend
      var needsSigmoid = false;
      for (var si = 0; si < Math.min(output.length, 700); si += YOLOX_STRIDE) {
        if (output[si + 4] < 0 || output[si + 5] < 0 || output[si + 6] < 0) {
          needsSigmoid = true;
          break;
        }
      }
      if (!this._dbgSigmoidLogged) {
        this._dbgSigmoidLogged = true;
        console.log('[YOLOX] needsSigmoid=' + needsSigmoid);
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

        var rawBall = needsSigmoid ? sigmoid(output[off + 5]) : output[off + 5];
        var rawHoop = needsSigmoid ? sigmoid(output[off + 6]) : output[off + 6];
        var ballScore = obj * rawBall;  // class 0 = Basketball
        var hoopScore = obj * rawHoop;  // class 1 = Hoop

        var area = bw * bh;
        var det = { cx: cx, cy: cy, bw: bw, bh: bh };

        // Hoop candidates (looser size filter)
        if (hoopScore > 0.15 && area < frameArea * 0.4) {
          det.score = hoopScore;
          hoopCandidates.push({ cx: cx, cy: cy, bw: bw, bh: bh, score: hoopScore });
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
      if (!this._dbgFrame) this._dbgFrame = 0;
      if (++this._dbgFrame % 30 === 0) {
        var bestHoop = hoopCandidates.reduce(function(b,c){ return c.score > b ? c.score : b; }, 0);
        var bestBall = ballCandidates.reduce(function(b,c){ return c.score > b ? c.score : b; }, 0);
        console.log('[YOLOX] balls=' + ballCandidates.length + ' hoops=' + hoopCandidates.length +
          ' bestBall=' + bestBall.toFixed(3) + ' bestHoop=' + bestHoop.toFixed(3));
      }

      // Apply NMS (IoU threshold 0.45)
      var NMS_THRESH = 0.45;
      var ballKeep = this._greedyNMS(ballCandidates, NMS_THRESH);
      var hoopKeep = this._greedyNMS(hoopCandidates, NMS_THRESH);

      // Store latest hoop detection for auto rim-lock
      this._lastHoopDetection = hoopKeep.length > 0 ? hoopKeep[0] : null;

      return ballKeep.length > 0 ? ballKeep[0] : null;
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
          if (r > 100 && g > 30 && g < 200 && b < 130 && r > g * 1.05 && r > b * 1.5) {
            orangeCount++;
          }
        }
      }

      return orangeCount > totalPx * 0.08; // at least 8% orange pixels
    },

    _processBallDetection: function (cx, cy, vw, vh) {
      updateTracker(this.tracker, cx, cy);
      var normX = cx / vw;
      var normY = cy / vh;
      this.ballPosition = {
        normX: normX, normY: normY,
        source: this._lastDetSource || 'color',
        confidence: this._lastDetConf || 0
      };
      if (this.onBallUpdate) this.onBallUpdate(this.ballPosition);

      /* Feed to adaptive learning (Level 1 + 3) */
      /* cx/cy are in video coords — convert to processing canvas space for pixel sampling */
      if (window.AdaptiveLearning && this._canvas && this._ctx) {
        var cvW = (this._procW > 0) ? this._procW : vw;
        var cvH = (this._procH > 0) ? this._procH : vh;
        var canvasX = (vw > 0 && cvW > 0) ? cx * cvW / vw : cx;
        var canvasY = (vh > 0 && cvH > 0) ? cy * cvH / vh : cy;
        window.AdaptiveLearning.onBallDetected(this._canvas, this._ctx, canvasX, canvasY);
      }

      this._analyzeShotState(vw, vh, normX, normY);
    },

    _processNoBall: function () {
      updateTracker(this.tracker, null, null);
      // If Kalman is predicting, show predicted position to UI
      var kf = this.tracker.kalman;
      if (kf.initialized && kf.predictCount > 0 && kf.predictCount <= KALMAN_MAX_PREDICT) {
        var vw = this.videoEl ? this.videoEl.videoWidth : 1;
        var vh = this.videoEl ? this.videoEl.videoHeight : 1;
        this.ballPosition = {
          normX: kf.x / vw, normY: kf.y / vh,
          source: 'predicted', confidence: 0
        };
        if (this.onBallUpdate) this.onBallUpdate(this.ballPosition);
        // Continue analyzing shot state with predicted position
        this._analyzeShotState(vw, vh, kf.x / vw, kf.y / vh);
        return;
      }
      this.ballPosition = null;
      if (this.onBallUpdate) this.onBallUpdate(null);

      // Timeout-based miss: if ball was tracked near rim and disappeared
      if (this.rimZone && this.tracker.positions.length >= MIN_TRAJECTORY_PTS && !this.tracker.isTracking) {
        var now = Date.now();
        if (now - this.lastShotTime < DEBOUNCE_MS) return;
        var vw = this.videoEl ? this.videoEl.videoWidth : 1;
        var vh = this.videoEl ? this.videoEl.videoHeight : 1;
        var pts = this.tracker.positions;
        var lastPt = pts[pts.length - 1];
        if (lastPt) {
          var normX = lastPt.x / vw;
          var normY = lastPt.y / vh;
          if (isInApproachZone(normX, normY, this.rimZone)) {
            console.log('[ShotDetection] timeout miss: ball disappeared near rim');
            this.lastShotTime = now;
            this.stats.attempts++;
            var launchPt = getLaunchPoint(this.tracker, vw, vh);
            var shotZone = classifyShotZone(launchPt, this.rimZone, this.threePtDistance);
            var missData = {
              result: 'missed',
              shotX: normX,
              shotY: normY,
              trajectory: getTrajectoryNormalized(this.tracker, vw, vh, 20),
              launchPoint: launchPt,
              shotZone: shotZone,
              timestamp: now
            };
            if (window.AdaptiveLearning) {
              window.AdaptiveLearning.onShotCompleted(missData.trajectory, 'missed', this.rimZone);
            }
            if (this.onShotDetected) this.onShotDetected(missData);
            resetTracker(this.tracker);
          }
        }
      }
    },

    /* ── Simplified shot state machine ─────────────────────────
       States: idle → shot_started → near_hoop → cooldown → idle

       idle:         ball below hoop, watching for rising motion
       shot_started: ball rising (Y decreasing for 3+ frames)
       near_hoop:    ball reached hoop height area, waiting for result
       cooldown:     shot counted, 1.5s lockout before next shot
    ────────────────────────────────────────────────────────────── */
    _analyzeShotState: function (vw, vh, normX, normY) {
      if (!this.rimZone) return;
      var now = Date.now();
      var rim = this.rimZone;

      // Cooldown state
      if (this._shotState === 'cooldown') {
        if (now - this._shotStateTime > DEBOUNCE_MS) {
          this._shotState = 'idle';
          this._ballMinY = 1.0;
        }
        return;
      }

      // Track the highest point the ball reaches (lowest Y value)
      if (normY < this._ballMinY) this._ballMinY = normY;

      var trend = getYTrend(this.tracker, vh);
      var pts = this.tracker.positions;
      if (pts.length < MIN_TRAJECTORY_PTS) return;

      // ── IDLE: watch for ball starting to rise ──
      if (this._shotState === 'idle') {
        // Ball must be below hoop level AND rising
        if (normY > rim.centerY + 0.10 && trend === 'rising') {
          this._shotState = 'shot_started';
          this._shotStateTime = now;
          this._ballMinY = normY;
        }
        return;
      }

      // ── SHOT_STARTED: ball is rising, watch for it reaching hoop height ──
      if (this._shotState === 'shot_started') {
        // Ball reached near hoop height (within 20% of frame from hoop)
        if (this._ballMinY < rim.centerY + 0.20) {
          this._shotState = 'near_hoop';
          this._shotStateTime = now;
          return;
        }
        // Timeout: if ball has been "rising" for >3 seconds without reaching hoop, reset
        if (now - this._shotStateTime > 3000) {
          this._shotState = 'idle';
          this._ballMinY = 1.0;
        }
        return;
      }

      // ── NEAR_HOOP: ball is near hoop, determine make or miss ──
      if (this._shotState === 'near_hoop') {
        var hoopXDist = Math.abs(normX - rim.centerX);
        var nearHoopX = hoopXDist < rim.width * 2.0; // within 2x rim width horizontally

        // MADE: ball went from above hoop to below hoop while near hoop X
        if (this._ballMinY < rim.centerY && normY > rim.centerY + rim.height * 2 && nearHoopX) {
          this._countShot('made', vw, vh, normX, normY, now);
          return;
        }

        // MISS: ball was near hoop but now clearly moved away or fell without going through
        var ballFarFromHoop = normY > rim.centerY + 0.25 || hoopXDist > rim.width * 4;
        var ballWentBack = trend === 'rising' && normY < rim.centerY - 0.10;
        var timeout = now - this._shotStateTime > 2000;

        if (ballFarFromHoop || ballWentBack || timeout) {
          // Only count as shot attempt if ball actually got near the hoop
          if (this._ballMinY < rim.centerY + 0.15) {
            this._countShot('missed', vw, vh, normX, normY, now);
          } else {
            // Ball never really reached hoop — not a shot, just movement
            this._shotState = 'idle';
            this._ballMinY = 1.0;
          }
          return;
        }
      }
    },

    _countShot: function (result, vw, vh, normX, normY, now) {
      this.lastShotTime = now;
      this._shotState = 'cooldown';
      this._shotStateTime = now;
      this._ballMinY = 1.0;

      var launchPt = getLaunchPoint(this.tracker, vw, vh);
      var shotZone = classifyShotZone(launchPt, this.rimZone, this.threePtDistance);
      var traj = getTrajectoryNormalized(this.tracker, vw, vh, 20);

      // ── Trajectory-based verification (analyzeMade/analyzeMiss) ──
      // Normalize pixel trajectory to 0-1 space to match rimZone coordinates
      var rawPts = this.tracker.positions.slice(-30);
      var normTraj = rawPts.map(function (pt) {
        return { x: pt.x / vw, y: pt.y / vh, frame: pt.frame };
      });
      var madeAnalysis = analyzeMade(normTraj, this.rimZone);
      var missAnalysis = analyzeMiss(normTraj, this.rimZone);

      // Cross-check state machine result with trajectory analysis
      var finalResult = result;
      if (result === 'made' && !madeAnalysis.isMade && missAnalysis.isMiss) {
        // State machine said made, but trajectory says miss — trust trajectory
        finalResult = 'missed';
        console.log('[ShotTracker] Override: made → missed (trajectory analysis)');
      } else if (result === 'missed' && madeAnalysis.isMade) {
        // State machine said miss, but trajectory clearly shows made — trust trajectory
        finalResult = 'made';
        console.log('[ShotTracker] Override: missed → made (trajectory analysis)');
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
        timestamp: now
      };

      console.log('[ShotTracker] ' + finalResult.toUpperCase() +
        ' (sm=' + result + ' traj_made=' + madeAnalysis.isMade + ' traj_miss=' + missAnalysis.isMiss + ')' +
        ' minY=' + this._ballMinY.toFixed(3) +
        ' hoopY=' + this.rimZone.centerY.toFixed(3) + ' ballX=' + normX.toFixed(3) + ' hoopX=' + this.rimZone.centerX.toFixed(3));

      if (window.AdaptiveLearning) {
        window.AdaptiveLearning.onShotCompleted(traj, result, this.rimZone);
      }
      if (this.onShotDetected) this.onShotDetected(shotData);
      resetTracker(this.tracker);
    },

    _setStatus: function (status) {
      if (this.onStatusChange) this.onStatusChange(status);
    }
  };

  /* ── Expose globally ────────────────────────────────────────── */
  window.ShotDetectionEngine = ShotDetectionEngine;

})();
