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
  var DEBOUNCE_MS          = 3000;  // Cooldown between counted shots (was 1500)
  var MIN_TRAJECTORY_PTS   = 4;    // Minimum trajectory points before analyzing (was 3)
  var MAX_HISTORY          = 50;   // Larger rolling buffer
  var MAX_GAP_FRAMES       = 12;   // More grace frames for ball vanishing
  var MIN_MOVEMENT_PX      = 2;    // Lower jitter threshold
  var BALL_CONFIDENCE      = 0.003; // obj*cls — lowered to catch weaker detections
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

  /* ── Smart Rim Lock constants ──────────────────────────────── */
  var RIM_LOCK_FRAMES      = 8;    // Consecutive consistent detections to lock
  var RIM_LOCK_DRIFT       = 0.03; // Max normalized drift to count as "same position"
  var RIM_UNLOCK_MOTION    = 12;   // Global pixel motion threshold to unlock
  var RIM_SMOOTH_BUFFER    = 6;    // Number of hoop detections to average
  var CAMERA_MOTION_SAMPLE = 2000; // Pixel pairs to sample for motion detection

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
      approachLeft: cx - w * 1.8,
      approachRight: cx + w * 1.8,
      approachTop: cy - h * 3.5,
      approachBottom: cy + h * 3.5
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
    var margin = rim.width * 0.8; // wider margin (was 0.5)
    return x >= rim.left - margin && x <= rim.right + margin;
  }

  /* ── Shot Analysis ──────────────────────────────────────────── */
  function analyzeMade(trajectory, rim) {
    if (trajectory.length < 3) return { isMade: false, entryPoint: null };
    var enteredAbove = false, enteredRim = false, exitedBelow = false;
    var entryFrame = -1, entryPoint = null;
    var nearRim = false;
    var passedThroughRimY = false;

    for (var i = 0; i < trajectory.length; i++) {
      var pt = trajectory[i];

      // Ball was above rim at some point
      if (!enteredAbove && isAboveRim(pt.y, rim)) {
        enteredAbove = true;
      }

      // Ball entered the rim box
      if (enteredAbove && !enteredRim && isInsideRim(pt.x, pt.y, rim)) {
        enteredRim = true;
        entryFrame = pt.frame;
        entryPoint = { x: pt.x, y: pt.y };
      }

      // Ball is near the rim (approach zone + close to rim Y)
      if (enteredAbove && !nearRim && isInApproachZone(pt.x, pt.y, rim) && Math.abs(pt.y - rim.centerY) < rim.height * 2.5) {
        nearRim = true;
        if (!entryPoint) entryPoint = { x: pt.x, y: pt.y };
        if (entryFrame < 0) entryFrame = pt.frame;
      }

      // Ball crossed the rim Y level while within horizontal bounds
      if (enteredAbove && !passedThroughRimY && pt.y >= rim.top && pt.y <= rim.bottom + rim.height && isWithinHorizontalBounds(pt.x, rim)) {
        passedThroughRimY = true;
        if (!entryPoint) entryPoint = { x: pt.x, y: pt.y };
        if (entryFrame < 0) entryFrame = pt.frame;
      }

      // Ball exited below rim
      if ((enteredRim || nearRim || passedThroughRimY) && isBelowRim(pt.y, rim)) {
        var frameLimit = enteredRim ? MADE_MAX_FRAMES : MADE_MAX_FRAMES * 2;
        if (entryFrame >= 0 && pt.frame - entryFrame <= frameLimit && isWithinHorizontalBounds(pt.x, rim)) {
          exitedBelow = true;
          break;
        }
      }

      if (enteredRim && pt.frame - entryFrame > MADE_MAX_FRAMES * 2) break;
    }

    // Made = came from above, passed through/near rim, went below
    var isMade = enteredAbove && (enteredRim || nearRim || passedThroughRimY) && exitedBelow;
    return { isMade: isMade, entryPoint: entryPoint };
  }

  function analyzeMiss(trajectory, rim) {
    if (trajectory.length < 4) return { isMiss: false, entryPoint: null };
    var approached = false, approachPoint = null;
    var wasAbove = false;

    for (var i = 0; i < trajectory.length; i++) {
      var pt = trajectory[i];
      // Must have been above rim first (actual shot, not just walking near hoop)
      if (pt.y < rim.top) wasAbove = true;

      if (wasAbove && !approached && isInApproachZone(pt.x, pt.y, rim)) {
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
    // Don't count as miss if ball never went above rim (wasn't a shot)
    if (approached && wasAbove) {
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

  /* ── Region-restricted color detection (avoids gym floor) ────── */
  function _detectBallInRegion(ctx, vw, yStart, yEnd) {
    if (!ctx || vw < 10 || yEnd <= yStart) return null;
    var regionH = yEnd - yStart;
    try {
      var imgData = ctx.getImageData(0, yStart, vw, regionH);
      var data = imgData.data;
    } catch (e) { return null; }

    var CELL = 12;
    var gridW = Math.ceil(vw / CELL);
    var gridH = Math.ceil(regionH / CELL);
    var grid = new Uint16Array(gridW * gridH);

    for (var y = 0; y < regionH; y += COLOR_SCAN_STEP) {
      for (var x = 0; x < vw; x += COLOR_SCAN_STEP) {
        var idx = (y * vw + x) * 4;
        var r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (r > 110 && g > 35 && g < 200 && b < 130 && r > g * 1.05 && r > b * 1.4) {
          grid[Math.floor(y / CELL) * gridW + Math.floor(x / CELL)]++;
        }
      }
    }

    var visited = new Uint8Array(gridW * gridH);
    var bestCluster = null, bestCount = 0;

    for (var cy = 0; cy < gridH; cy++) {
      for (var cx = 0; cx < gridW; cx++) {
        var gi = cy * gridW + cx;
        if (grid[gi] < 2 || visited[gi]) continue;
        var queue = [gi]; visited[gi] = 1;
        var clMinX = cx, clMaxX = cx, clMinY = cy, clMaxY = cy;
        var clCount = 0, clSumX = 0, clSumY = 0;
        while (queue.length > 0) {
          var cur = queue.shift();
          var curY = Math.floor(cur / gridW), curX = cur % gridW;
          var cellPx = grid[cur];
          clCount += cellPx;
          clSumX += (curX * CELL + CELL / 2) * cellPx;
          clSumY += (curY * CELL + CELL / 2) * cellPx;
          if (curX < clMinX) clMinX = curX; if (curX > clMaxX) clMaxX = curX;
          if (curY < clMinY) clMinY = curY; if (curY > clMaxY) clMaxY = curY;
          var nb = [curY > 0 ? (curY-1)*gridW+curX : -1, curY < gridH-1 ? (curY+1)*gridW+curX : -1,
                    curX > 0 ? curY*gridW+(curX-1) : -1, curX < gridW-1 ? curY*gridW+(curX+1) : -1];
          for (var ni = 0; ni < 4; ni++) {
            if (nb[ni] >= 0 && !visited[nb[ni]] && grid[nb[ni]] >= 2) { visited[nb[ni]] = 1; queue.push(nb[ni]); }
          }
        }
        if (clCount > bestCount && clCount < 3000) {
          bestCount = clCount;
          bestCluster = { count: clCount, cx: clSumX / clCount, cy: clSumY / clCount + yStart,
            minX: clMinX * CELL, minY: clMinY * CELL + yStart, maxX: (clMaxX+1)*CELL, maxY: (clMaxY+1)*CELL + yStart };
        }
      }
    }

    if (!bestCluster || bestCluster.count < 6) return null;
    var blobW = bestCluster.maxX - bestCluster.minX;
    var blobH = bestCluster.maxY - (bestCluster.minY);
    if (blobW < 3 || blobH < 3) return null;
    var aspect = Math.max(blobW, blobH) / Math.min(blobW, blobH);
    if (aspect > 3.5) return null;
    return { x: bestCluster.cx, y: bestCluster.cy, w: blobW, h: blobH, score: 0.4 };
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

    // Count orange/brown-orange pixels per cell (widened for gym lighting)
    for (var y = 0; y < vh; y += COLOR_SCAN_STEP) {
      for (var x = 0; x < vw; x += COLOR_SCAN_STEP) {
        var idx = (y * vw + x) * 4;
        var r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (r > 110 && g > 35 && g < 200 && b < 130 && r > g * 1.05 && r > b * 1.4) {
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

  /* ── Background Subtraction — find moving objects (ball) ──────────── */
  var BgSubtractor = {
    _bgFrame: null,
    _alpha: 0.03,  // slow background learning rate
    _framesSinceReset: 0,

    reset: function () {
      this._bgFrame = null;
      this._framesSinceReset = 0;
    },

    /* Update background model and return motion mask ball candidate */
    detectMovingBall: function (ctx, pw, ph, rimZone) {
      this._framesSinceReset++;
      if (this._framesSinceReset < 5) return null; // need a few frames to build bg

      try {
        var imgData = ctx.getImageData(0, 0, pw, ph);
        var data = imgData.data;
      } catch (e) { return null; }

      // Downsample to quarter res for speed
      var step = 4;
      var dw = Math.floor(pw / step);
      var dh = Math.floor(ph / step);
      var gray = new Float32Array(dw * dh);
      for (var y = 0; y < dh; y++) {
        for (var x = 0; x < dw; x++) {
          var si = ((y * step) * pw + (x * step)) * 4;
          gray[y * dw + x] = data[si] * 0.3 + data[si + 1] * 0.59 + data[si + 2] * 0.11;
        }
      }

      if (!this._bgFrame || this._bgFrame.length !== gray.length) {
        this._bgFrame = new Float32Array(gray);
        return null;
      }

      // Compute difference and update background
      var motionPx = [];
      for (var i = 0; i < gray.length; i++) {
        var diff = Math.abs(gray[i] - this._bgFrame[i]);
        this._bgFrame[i] += (gray[i] - this._bgFrame[i]) * this._alpha;
        if (diff > 25) { // significant motion
          var mx = (i % dw) * step;
          var my = Math.floor(i / dw) * step;
          // Only look in upper portion (where ball flies)
          if (rimZone) {
            var normY = my / ph;
            if (normY > rimZone.centerY + 0.15) continue; // skip below rim
          }
          motionPx.push({ x: mx, y: my, diff: diff });
        }
      }

      if (motionPx.length < 3 || motionPx.length > 500) return null;

      // Cluster motion pixels — find centroid of densest cluster
      var sumX = 0, sumY = 0;
      for (var j = 0; j < motionPx.length; j++) {
        sumX += motionPx[j].x;
        sumY += motionPx[j].y;
      }
      var centX = sumX / motionPx.length;
      var centY = sumY / motionPx.length;

      // Check cluster is ball-sized (compact, not huge)
      var spread = 0;
      for (var k = 0; k < motionPx.length; k++) {
        var dx = motionPx[k].x - centX;
        var dy = motionPx[k].y - centY;
        spread += Math.sqrt(dx * dx + dy * dy);
      }
      spread /= motionPx.length;

      var maxSpread = Math.min(pw, ph) * 0.15; // ball shouldn't be bigger than 15% of frame
      if (spread > maxSpread || spread < 2) return null;

      return { x: centX, y: centY, score: 0.3, source: 'motion' };
    }
  };

  /* ── Smart Rim Lock — locks hoop position, unlocks on camera motion ── */
  var SmartRimLock = {
    isLocked: false,
    lockedRim: null,       // { cx, cy, w, h } normalized
    _hoopBuffer: [],       // last N detections for smoothing
    _stableCount: 0,       // consecutive frames with same-ish position
    _prevFrameData: null,  // downsampled grayscale for motion detection
    _motionLevel: 0,       // current global motion estimate

    reset: function () {
      this.isLocked = false;
      this.lockedRim = null;
      this._hoopBuffer = [];
      this._stableCount = 0;
      this._prevFrameData = null;
      this._motionLevel = 0;
    },

    /* Detect global camera motion by sampling pixel differences */
    detectCameraMotion: function (ctx, pw, ph) {
      // Downsample to 80px wide grayscale
      var sw = 80;
      var sh = Math.round(ph * (sw / pw));
      var tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = sw; tmpCanvas.height = sh;
      var tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.drawImage(ctx.canvas, 0, 0, sw, sh);
      var data = tmpCtx.getImageData(0, 0, sw, sh).data;

      // Convert to grayscale array
      var gray = new Uint8Array(sw * sh);
      for (var i = 0; i < gray.length; i++) {
        gray[i] = Math.round(data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11);
      }

      if (!this._prevFrameData || this._prevFrameData.length !== gray.length) {
        this._prevFrameData = gray;
        this._motionLevel = 0;
        return 0;
      }

      // Sample random pixels and compute average absolute diff
      var totalDiff = 0;
      var samples = Math.min(CAMERA_MOTION_SAMPLE, gray.length);
      var step = Math.max(1, Math.floor(gray.length / samples));
      var count = 0;
      for (var j = 0; j < gray.length; j += step) {
        totalDiff += Math.abs(gray[j] - this._prevFrameData[j]);
        count++;
      }
      this._prevFrameData = gray;
      this._motionLevel = count > 0 ? totalDiff / count : 0;
      return this._motionLevel;
    },

    /* Feed a new hoop detection (normalized coords) */
    feedHoopDetection: function (normCX, normCY, normW, normH, score) {
      // Add to smoothing buffer
      this._hoopBuffer.push({ cx: normCX, cy: normCY, w: normW, h: normH, score: score });
      if (this._hoopBuffer.length > RIM_SMOOTH_BUFFER) {
        this._hoopBuffer.shift();
      }

      // Check camera motion — if moving, unlock
      if (this._motionLevel > RIM_UNLOCK_MOTION) {
        if (this.isLocked) {
          this.isLocked = false;
          this._stableCount = 0;
        }
        return this.getSmoothedRim();
      }

      // If already locked, check if detection drifted too far
      if (this.isLocked && this.lockedRim) {
        var drift = Math.abs(normCX - this.lockedRim.cx) + Math.abs(normCY - this.lockedRim.cy);
        if (drift > RIM_LOCK_DRIFT * 3) {
          // Big jump — camera probably moved, unlock
          this.isLocked = false;
          this._stableCount = 0;
        } else {
          // Still locked — return locked position
          return this.lockedRim;
        }
      }

      // Not locked — check stability
      var smoothed = this.getSmoothedRim();
      if (smoothed && this._hoopBuffer.length >= 3) {
        var last = this._hoopBuffer[this._hoopBuffer.length - 1];
        var drift2 = Math.abs(last.cx - smoothed.cx) + Math.abs(last.cy - smoothed.cy);
        if (drift2 < RIM_LOCK_DRIFT) {
          this._stableCount++;
        } else {
          this._stableCount = Math.max(0, this._stableCount - 1);
        }

        if (this._stableCount >= RIM_LOCK_FRAMES) {
          this.isLocked = true;
          this.lockedRim = { cx: smoothed.cx, cy: smoothed.cy, w: smoothed.w, h: smoothed.h };
        }
      }

      return smoothed;
    },

    /* Get temporally smoothed rim position from buffer */
    getSmoothedRim: function () {
      if (this._hoopBuffer.length === 0) return null;
      var sumCX = 0, sumCY = 0, sumW = 0, sumH = 0, totalWeight = 0;
      for (var i = 0; i < this._hoopBuffer.length; i++) {
        var d = this._hoopBuffer[i];
        var weight = d.score; // weight by confidence
        sumCX += d.cx * weight;
        sumCY += d.cy * weight;
        sumW  += d.w * weight;
        sumH  += d.h * weight;
        totalWeight += weight;
      }
      if (totalWeight === 0) return null;
      return {
        cx: sumCX / totalWeight,
        cy: sumCY / totalWeight,
        w: sumW / totalWeight,
        h: sumH / totalWeight
      };
    },

    /* No detection this frame — maintain state */
    feedNoDetection: function () {
      // If locked, keep the locked position (hoop hasn't moved)
      if (this.isLocked) return this.lockedRim;
      // Not locked and no detection — slowly decay stable count
      this._stableCount = Math.max(0, this._stableCount - 1);
      // Return last smoothed if we have buffer
      return this._hoopBuffer.length > 0 ? this.getSmoothedRim() : null;
    }
  };

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
      this.tracker = createTracker(); // always create fresh (fixes null crash)
      this.lastShotTime = 0;
      this.ballPosition = null;
      this._rimLockCount = 0;
      this._rawHoopBox = null;
      this._lastHoopDetection = null;
      this._decodeCount = 0;
      this._noBallFrames = 0;
      SmartRimLock.reset();
      BgSubtractor.reset();
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

      /* ── Multi-source ball detection (every frame) ────────────── */
      var colorBall = null;
      var motionBall = null;
      if (canvasReady) {
        // 1. Color detection — restricted to above-rim region
        if (self.rimZone && self.rimZone.centerY > 0) {
          var searchBottom = Math.min(ph, Math.round((self.rimZone.centerY + 0.20) * ph));
          colorBall = _detectBallInRegion(self._ctx, pw, 0, searchBottom);
        } else {
          colorBall = detectBallByColor(self._canvas, self._ctx, pw, ph);
        }
        // 2. Background subtraction — find moving ball-sized objects
        motionBall = BgSubtractor.detectMovingBall(self._ctx, pw, ph, self.rimZone);
      }
      // Merge: prefer color, fallback to motion
      var fusedBall = colorBall || motionBall;
      self._lastColorBall = fusedBall;

      /* Scale ball positions from processing canvas back to video coords */
      var scaleX = pw > 0 ? vw / pw : 1;
      var scaleY = ph > 0 ? vh / ph : 1;

      /* ── YOLOX detection (every 3rd frame) ──────────────────── */
      self._frameCount++;
      if (self.model && !self._colorOnlyMode && canvasReady && self._frameCount % 3 === 0) {
        self._runYoloxInference(vw, vh, pw, ph, scaleX, scaleY, fusedBall);
        return; // async — will call _scheduleDetection when done
      }

      /* Non-ML frames: use fused color + motion detection */
      if (fusedBall) {
        self._mlMissCount++;
        self._processBallDetection(fusedBall.x * scaleX, fusedBall.y * scaleY, vw, vh);
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

        /* ── ROI boost: if no ball found but rim is locked, run on cropped region ── */
        if (!mlBall && SmartRimLock.isLocked && SmartRimLock.lockedRim && self._frameCount % 6 === 0) {
          var lr = SmartRimLock.lockedRim;
          // Crop region: 3x rim width, from 40% above rim to 30% below
          var roiLeft = Math.max(0, Math.round((lr.cx - lr.w * 1.5) * pw));
          var roiTop  = Math.max(0, Math.round((lr.cy - lr.h * 6) * ph));
          var roiW    = Math.min(pw - roiLeft, Math.round(lr.w * 3 * pw));
          var roiH    = Math.min(ph - roiTop, Math.round(lr.h * 10 * ph));
          if (roiW > 30 && roiH > 30) {
            // Draw ROI crop to YOLOX canvas at full 416x416 → higher resolution for small ball
            var roiRatio = Math.min(sz / roiH, sz / roiW);
            var roiNewW = Math.round(roiW * roiRatio);
            var roiNewH = Math.round(roiH * roiRatio);
            _yoloxCtx.fillStyle = 'rgb(114,114,114)';
            _yoloxCtx.fillRect(0, 0, sz, sz);
            _yoloxCtx.drawImage(self._canvas, roiLeft, roiTop, roiW, roiH, 0, 0, roiNewW, roiNewH);
            var roiImgData = _yoloxCtx.getImageData(0, 0, sz, sz).data;
            for (var ri = 0; ri < chSize; ri++) {
              _yoloxBuf[ri]              = roiImgData[ri * 4];
              _yoloxBuf[chSize + ri]     = roiImgData[ri * 4 + 1];
              _yoloxBuf[chSize * 2 + ri] = roiImgData[ri * 4 + 2];
            }
            var roiTensor = new ort.Tensor('float32', _yoloxBuf, [1, 3, sz, sz]);
            // Synchronous-ish: we'll do a nested inference
            self.model.run({ images: roiTensor }).then(function (roiResults) {
              var roiBall = self._yoloxDecode(roiResults.output.data, roiRatio, roiW, roiH);
              if (roiBall && roiBall.score > 0.002) {
                // Map back to full processing canvas coords
                roiBall.cx += roiLeft;
                roiBall.cy += roiTop;
                self._processBallDetection(roiBall.cx * scaleX, roiBall.cy * scaleY, vw, vh);
              }
            }).catch(function () {});
          }
        }

        /* ── Smart Rim Lock — camera motion aware ───────────────── */
        // Detect camera motion
        if (self._ctx) {
          SmartRimLock.detectCameraMotion(self._ctx, pw, ph);
        }

        var rimResult = null;
        if (self._lastHoopDetection && self._lastHoopDetection.score > 0.08) {
          var hd = self._lastHoopDetection;
          var normCX = (hd.cx * scaleX) / vw;
          var hoopBottom = ((hd.cy + hd.bh * 0.35) * scaleY) / vh;
          var rimW = Math.max(0.03, Math.min((hd.bw * scaleX * 0.8) / vw, 0.20));
          var rimH = Math.max(0.02, Math.min((hd.bh * scaleY * 0.25) / vh, 0.10));

          rimResult = SmartRimLock.feedHoopDetection(normCX, hoopBottom, rimW, rimH, hd.score);

          // Store raw hoop box for debug
          self._rawHoopBox = {
            normCX: (hd.cx * scaleX) / vw,
            normCY: (hd.cy * scaleY) / vh,
            normW: (hd.bw * scaleX) / vw,
            normH: (hd.bh * scaleY) / vh,
            score: hd.score
          };
        } else {
          rimResult = SmartRimLock.feedNoDetection();
        }

        // Apply rim position (locked or smoothed)
        if (rimResult) {
          self.setRimZone(rimResult.cx, rimResult.cy, rimResult.w, rimResult.h);
        }
        // Expose lock state for debug UI
        self._rimLocked = SmartRimLock.isLocked;
        self._cameraMotion = SmartRimLock._motionLevel;

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

        // Check for hoop — prefer detections in the mid-frame (y=15-55%)
        var hoopAspect = bw / (bh || 1);
        var hoopYn = cy / ph;
        // Score bonus: detections at y=20-50% get 2x boost, y=10-60% get 1.5x
        var hoopPosBonus = (hoopYn > 0.15 && hoopYn < 0.55) ? 2.0 : (hoopYn > 0.08 && hoopYn < 0.65) ? 1.2 : 1.0;
        var adjustedHoopScore = hoopScore * hoopPosBonus;
        // High-confidence detections (>40%) bypass area/aspect filters
        var passesFilter = (hoopScore > 0.40) ||
          (area > frameArea * 0.0003 && area < frameArea * 0.30 && hoopAspect > 0.15 && hoopAspect < 8.0);
        if (hoopScore > 0.08 && adjustedHoopScore > bestHoopScore && passesFilter) {
          bestHoop = { cx: cx, cy: cy, bw: bw, bh: bh, score: hoopScore };
          bestHoopScore = adjustedHoopScore;
        }

        // Ball size filter
        if (area < frameArea * BALL_MIN_AREA_FRAC || area > frameArea * BALL_MAX_AREA_FRAC) {
          continue;
        }

        // Aspect ratio check for ball (balls are roughly round)
        var aspect = Math.max(bw, bh) / (Math.min(bw, bh) || 1);
        if (aspect > 3.0) continue;

        if (ballScore >= BALL_CONFIDENCE && ballScore > bestScore) {
          best = { cx: cx, cy: cy, bw: bw, bh: bh, score: ballScore };
          bestScore = ballScore;
        }
      }

      // Store latest hoop detection for auto rim-lock
      this._lastHoopDetection = bestHoop;

      // Debug logging (throttled to every 20th call)
      this._decodeCount = (this._decodeCount || 0) + 1;
      if (this._decodeCount % 20 === 1) {
        // Log top-3 ball and hoop candidates to see what model outputs
        var topBalls = [];
        var topHoops = [];
        for (var di = 0; di < numDets; di++) {
          var doff = di * YOLOX_STRIDE;
          var dobj = output[doff + 4];
          if (dobj < 0.001) continue;
          var dball = dobj * output[doff + 5];
          var dhoop = dobj * output[doff + 6];
          if (dball > 0.001) topBalls.push(dball);
          if (dhoop > 0.01) topHoops.push(dhoop);
        }
        topBalls.sort(function(a,b){return b-a;});
        topHoops.sort(function(a,b){return b-a;});
        console.log('[YOLOX]',
          'ball:', best ? (best.score * 100).toFixed(1) + '%' : 'none',
          'top3ball:', topBalls.slice(0,3).map(function(s){return (s*100).toFixed(2)+'%'}).join(' '),
          'hoop:', bestHoop ? (bestHoop.score * 100).toFixed(1) + '% y=' + (bestHoop.cy/ph*100).toFixed(0) + '%' : 'none',
          'top3hoop:', topHoops.slice(0,3).map(function(s){return (s*100).toFixed(2)+'%'}).join(' '),
          'color:', this._lastColorBall ? 'yes' : 'no'
        );
      }

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
          // Widened to match gym lighting (same as color detection)
          if (r > 110 && g > 35 && g < 200 && b < 130 && r > g * 1.05 && r > b * 1.4) {
            orangeCount++;
          }
        }
      }

      return orangeCount > totalPx * 0.08; // at least 8% orange pixels
    },

    _processBallDetection: function (cx, cy, vw, vh) {
      updateTracker(this.tracker, cx, cy);
      this._noBallFrames = 0; // reset prediction counter
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
      // Keep ball visible for a few frames using last known velocity
      if (this.ballPosition && this.tracker.positions.length >= 2) {
        this._noBallFrames = (this._noBallFrames || 0) + 1;
        if (this._noBallFrames < 8) {
          // Predict position using last velocity
          var pts = this.tracker.positions;
          var last = pts[pts.length - 1];
          var prev = pts[pts.length - 2];
          if (last && prev) {
            var vw = this.videoEl ? this.videoEl.videoWidth : 1;
            var vh = this.videoEl ? this.videoEl.videoHeight : 1;
            var vx = (last.x - prev.x) / vw;
            var vy = (last.y - prev.y) / vh + 0.002; // gravity
            this.ballPosition = {
              normX: this.ballPosition.normX + vx,
              normY: this.ballPosition.normY + vy
            };
          }
          return; // keep showing predicted position
        }
      }
      this._noBallFrames = 0;
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
