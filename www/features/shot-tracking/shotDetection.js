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
  var BALL_CONFIDENCE      = 0.008; // obj*cls — both already probabilities (sigmoid in model)
  var MADE_MAX_FRAMES      = 22;   // More frames allowed for rim transit
  var DETECTION_INTERVAL   = 60;   // ~16 FPS detection rate

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

  /* Area thresholds as fractions of total frame area */
  var BALL_MIN_AREA_FRAC   = 0.00005;  // Very small — distant shots
  var BALL_MAX_AREA_FRAC   = 0.18;     // Very large — close-up shots

  /* Y-trend diff threshold as fraction of frame height */
  var Y_TREND_FRAC         = 0.003;   // Lower — catch slower arcing shots

  /* Color detection constants */
  var COLOR_SCAN_STEP      = 4;    // Pixel step for color scanning (performance)
  var COLOR_MIN_PIXELS     = 12;   // Minimum orange pixels to count as ball
  var COLOR_MAX_PIXELS     = 8000; // Maximum (too large = not a ball)

  /* ── Tracker ────────────────────────────────────────────────── */
  function createTracker() {
    return {
      positions: [],
      lastSeenFrame: -1,
      isTracking: false,
      frameCount: 0
    };
  }

  function updateTracker(tracker, x, y) {
    var frameNum = tracker.frameCount++;
    if (x !== null && y !== null) {
      var last = tracker.positions[tracker.positions.length - 1];
      if (last) {
        var dx = Math.abs(x - last.x);
        var dy = Math.abs(y - last.y);
        if (dx < MIN_MOVEMENT_PX && dy < MIN_MOVEMENT_PX) {
          tracker.lastSeenFrame = frameNum;
          return;
        }
      }
      tracker.positions.push({ x: x, y: y, frame: frameNum, ts: Date.now() });
      if (tracker.positions.length > MAX_HISTORY) {
        tracker.positions = tracker.positions.slice(-MAX_HISTORY);
      }
      tracker.lastSeenFrame = frameNum;
      tracker.isTracking = true;
    } else {
      if (tracker.isTracking && frameNum - tracker.lastSeenFrame > MAX_GAP_FRAMES) {
        tracker.isTracking = false;
      }
    }
  }

  function resetTracker(tracker) {
    tracker.positions = [];
    tracker.lastSeenFrame = -1;
    tracker.isTracking = false;
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
      approachTop: cy - h * 5.0,
      approachBottom: cy + h * 5.0
    };
  }

  function isInsideRim(x, y, rim) {
    return x >= rim.left && x <= rim.right && y >= rim.top && y <= rim.bottom;
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
        if (r > 140 && g > 50 && g < 180 && b < 100 && r > g * 1.2 && r > b * 2.0) {
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
    onStatusChange: null,
    _isDetecting: false,
    _mlFailed: false,
    _colorOnlyMode: false,
    _mlMissCount: 0,
    _frameCount: 0,
    _detectorType: 'none',   // 'yolox' | 'none'
    _procW: 0,
    _procH: 0,

    init: function () {
      var self = this;

      // Model already loaded — reset only runtime state, keep detector type
      if (self.model) {
        self.tracker = createTracker();
        self._mlMissCount = 0;
        self._frameCount = 0;
        return Promise.resolve(true);
      }

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

      // Guard: if a load is already in progress, return the same promise
      if (self._loadingPromise) return self._loadingPromise;

      self._setStatus('loading');

      self._loadingPromise = new Promise(function (resolve) {
        self._tryLoadModel(function (result) {
          self._loadingPromise = null;  // clear guard when done
          resolve(result);
        });
      });
      return self._loadingPromise;
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

      var modelPath = 'models/basketball_yolox_tiny.onnx';
      ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'basic',
        executionMode: 'sequential'
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
      if (self._isDetecting) { self._scheduleDetection(); return; }
      if (self.videoEl.readyState < 2) { self._scheduleDetection(); return; }

      self._isDetecting = true;
      var vw = self.videoEl.videoWidth;
      var vh = self.videoEl.videoHeight;

      /* ── Draw to processing canvas ──────────────────────────── */
      var canvasReady = self._drawToCanvas();
      var pw = self._procW || vw;
      var ph = self._procH || vh;

      /* ── Color detection (primary, every frame) ─────────────── */
      var colorBall = null;
      if (canvasReady) {
        colorBall = detectBallByColor(self._canvas, self._ctx, pw, ph);
      }

      /* Scale ball positions from processing canvas back to video coords */
      var scaleX = pw > 0 ? vw / pw : 1;
      var scaleY = ph > 0 ? vh / ph : 1;

      /* ── YOLOX detection (every 3rd frame) ──────────────────── */
      self._frameCount++;
      if (self.model && !self._colorOnlyMode && canvasReady && self._frameCount % 3 === 0) {
        self._runYoloxInference(vw, vh, pw, ph, scaleX, scaleY, colorBall);
        return; // async — will call _scheduleDetection when done
      }

      /* Non-ML frames: use color only */
      if (colorBall) {
        self._mlMissCount++;
        self._processBallDetection(colorBall.x * scaleX, colorBall.y * scaleY, vw, vh);
      } else {
        self._mlMissCount++;
        self._processNoBall();
      }

      self._isDetecting = false;
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
      var chSize = sz * sz;
      for (var i = 0; i < chSize; i++) {
        _yoloxBuf[i]              = imgData[i * 4];     // R
        _yoloxBuf[chSize + i]     = imgData[i * 4 + 1]; // G
        _yoloxBuf[chSize * 2 + i] = imgData[i * 4 + 2]; // B
      }

      var inputTensor = new ort.Tensor('float32', _yoloxBuf, [1, 3, sz, sz]);

      self.model.run({ images: inputTensor }).then(function (results) {
        var outputData = results.output.data;

        var mlBall = self._yoloxDecode(outputData, ratio, pw, ph);

        if (mlBall) {
          // For low-confidence detections, verify orange color in the region
          if (mlBall.score < 0.15) {
            var verified = self._verifyOrange(mlBall.cx, mlBall.cy, Math.max(mlBall.bw, mlBall.bh), pw, ph);
            if (!verified) { mlBall = null; }
          }
        }

        /* ── Auto-rim-lock from hoop detection ─────────────────── */
        if (self._lastHoopDetection && self._lastHoopDetection.score > 0.25) {
          var hd = self._lastHoopDetection;
          // Convert from processing canvas coords to normalized 0-1
          var normCX = (hd.cx * scaleX) / vw;
          var normCY = (hd.cy * scaleY) / vh;
          var normW  = (hd.bw * scaleX) / vw;
          var normH  = (hd.bh * scaleY) / vh;
          // Clamp to sane range
          normW = Math.min(normW, 0.25);
          normH = Math.min(normH, 0.15);
          // Smooth update: blend 80% old + 20% new to avoid jitter
          if (self.rimZone) {
            normCX = self.rimZone.centerX * 0.8 + normCX * 0.2;
            normCY = self.rimZone.centerY * 0.8 + normCY * 0.2;
            normW  = self.rimZone.width   * 0.8 + normW  * 0.2;
            normH  = self.rimZone.height  * 0.8 + normH  * 0.2;
          }
          self.setRimZone(normCX, normCY, normW, normH);
        }

        if (mlBall) {
          self._mlMissCount = 0;
          self._processBallDetection(mlBall.cx * scaleX, mlBall.cy * scaleY, vw, vh);
        } else if (colorBall) {
          self._mlMissCount++;
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

    /* ── YOLOX grid table (pre-computed once, input 416×416) ── */
    /* Strides [8,16,32] → grids [52×52, 26×26, 13×13] = 3549 anchors total */
    _buildGrid: function () {
      var strides = [8, 16, 32];
      var grids = [52, 26, 13];
      var table = new Float32Array(3549 * 3); // [grid_x, grid_y, stride] per anchor
      var idx = 0;
      for (var s = 0; s < 3; s++) {
        var gs = grids[s], stride = strides[s];
        for (var gy = 0; gy < gs; gy++) {
          for (var gx = 0; gx < gs; gx++) {
            table[idx * 3]     = gx;
            table[idx * 3 + 1] = gy;
            table[idx * 3 + 2] = stride;
            idx++;
          }
        }
      }
      this._gridTable = table;
    },

    /* ── YOLOX output decode (custom 2-class model) ─────────── */
    /* Output: [1, N, 7] = [cx_off, cy_off, w_log, h_log, obj_prob, ball_prob, hoop_prob]
       - Coords are RAW offsets: decode via (offset + grid) * stride, exp(w)*stride
       - obj/cls are already sigmoid probabilities (applied inside model)           */
    _yoloxDecode: function (output, ratio, pw, ph) {
      if (!this._gridTable) this._buildGrid();
      var grid = this._gridTable;

      var numDets = output.length / YOLOX_STRIDE;
      var best = null;
      var bestScore = 0;
      var bestHoop = null;
      var bestHoopScore = 0;
      var frameArea = pw * ph;

      for (var i = 0; i < numDets; i++) {
        var off = i * YOLOX_STRIDE;

        // obj and cls are already sigmoid probabilities
        var obj = output[off + 4];
        if (obj < 0.001) continue;  // fast reject near-zero anchors

        // Decode absolute pixel coordinates from raw offsets + grid
        var gx     = grid[i * 3];
        var gy     = grid[i * 3 + 1];
        var stride = grid[i * 3 + 2];

        var cx = ((output[off]     + gx) * stride) / ratio;
        var cy = ((output[off + 1] + gy) * stride) / ratio;
        var bw = (Math.exp(output[off + 2]) * stride) / ratio;
        var bh = (Math.exp(output[off + 3]) * stride) / ratio;

        // Score = obj_prob × class_prob (both already probabilities)
        var ballScore = obj * output[off + 5];  // class 0 = Basketball
        var hoopScore = obj * output[off + 6];  // class 1 = Hoop

        // Size filter
        var area = bw * bh;
        if (area < frameArea * BALL_MIN_AREA_FRAC || area > frameArea * BALL_MAX_AREA_FRAC) {
          // Still check for hoop (hoops are larger than ball but max 8% of frame)
          var hoopAspect = bw / (bh || 1);
          if (hoopScore > 0.15 && hoopScore > bestHoopScore
              && area > frameArea * 0.001 && area < frameArea * 0.08
              && hoopAspect > 1.0 && hoopAspect < 5.0) {
            bestHoop = { cx: cx, cy: cy, bw: bw, bh: bh, score: hoopScore };
            bestHoopScore = hoopScore;
          }
          continue;
        }

        // Aspect ratio check for ball
        var aspect = Math.max(bw, bh) / (Math.min(bw, bh) || 1);
        if (aspect > 3.0) continue;

        if (ballScore >= BALL_CONFIDENCE && ballScore > bestScore) {
          best = { cx: cx, cy: cy, bw: bw, bh: bh, score: ballScore };
          bestScore = ballScore;
        }

        // Also track hoop detections (must be 0.1%-8% of frame, wider than tall)
        var hoopAR = bw / (bh || 1);
        if (hoopScore > 0.15 && hoopScore > bestHoopScore
            && area > frameArea * 0.001 && area < frameArea * 0.08
            && hoopAR > 1.0 && hoopAR < 5.0) {
          bestHoop = { cx: cx, cy: cy, bw: bw, bh: bh, score: hoopScore };
          bestHoopScore = hoopScore;
        }
      }

      // Store latest hoop detection for auto rim-lock
      this._lastHoopDetection = bestHoop;

      return best;
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
          if (r > 140 && g > 50 && g < 180 && b < 100 && r > g * 1.2 && r > b * 2.0) {
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
      this.ballPosition = { normX: normX, normY: normY };
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
      this.ballPosition = null;
      if (this.onBallUpdate) this.onBallUpdate(null);
    },

    _analyzeShotState: function (vw, vh, normX, normY) {
      if (!this.rimZone) return;

      var now = Date.now();
      if (now - this.lastShotTime < DEBOUNCE_MS) return;
      if (this.tracker.positions.length < MIN_TRAJECTORY_PTS) return;

      var traj = getTrajectoryNormalized(this.tracker, vw, vh, 30);
      var last = traj[traj.length - 1];
      if (!isInApproachZone(last.x, last.y, this.rimZone)) return;

      var trend = getYTrend(this.tracker, vh);
      if (trend === 'rising') return;

      var launchPt = getLaunchPoint(this.tracker, vw, vh);
      var shotZone = classifyShotZone(launchPt, this.rimZone, this.threePtDistance);

      // Check made
      var madeResult = analyzeMade(traj, this.rimZone);
      if (madeResult.isMade) {
        this.lastShotTime = now;
        this.stats.made++;
        this.stats.attempts++;
        var shotData = {
          result: 'made',
          shotX: madeResult.entryPoint ? madeResult.entryPoint.x : normX,
          shotY: madeResult.entryPoint ? madeResult.entryPoint.y : normY,
          trajectory: traj.slice(-20),
          launchPoint: launchPt,
          shotZone: shotZone,
          timestamp: now
        };
        /* Level 2: Trajectory learning */
        if (window.AdaptiveLearning) {
          window.AdaptiveLearning.onShotCompleted(traj, 'made', this.rimZone);
        }
        if (this.onShotDetected) this.onShotDetected(shotData);
        resetTracker(this.tracker);
        return;
      }

      // Check miss
      var missResult = analyzeMiss(traj, this.rimZone);
      if (missResult.isMiss) {
        this.lastShotTime = now;
        this.stats.attempts++;
        var missData = {
          result: 'missed',
          shotX: missResult.entryPoint ? missResult.entryPoint.x : normX,
          shotY: missResult.entryPoint ? missResult.entryPoint.y : normY,
          trajectory: traj.slice(-20),
          launchPoint: launchPt,
          shotZone: shotZone,
          timestamp: now
        };
        /* Level 2: Trajectory learning */
        if (window.AdaptiveLearning) {
          window.AdaptiveLearning.onShotCompleted(traj, 'missed', this.rimZone);
        }
        if (this.onShotDetected) this.onShotDetected(missData);
        resetTracker(this.tracker);
      }
    },

    _setStatus: function (status) {
      if (this.onStatusChange) this.onStatusChange(status);
    }
  };

  /* ── Expose globally ────────────────────────────────────────── */
  window.ShotDetectionEngine = ShotDetectionEngine;

})();
