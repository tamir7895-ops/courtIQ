/* ══════════════════════════════════════════════════════════════
   SHOT DETECTION — ML + Color Fallback Ball Detection
   + Centroid Tracker + Shot Result Analysis

   v4 — Replaced COCO-SSD / TF.js with MediaPipe Tasks Vision
        (efficientdet_lite0, 3 MB). Color detection is primary;
        MediaPipe runs every 5th frame as secondary confirmation.
        Falls back to color-only mode if MediaPipe unavailable.

   Runs entirely in-browser using:
     - @mediapipe/tasks-vision ObjectDetector (CDN, optional)
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
  var BALL_CONFIDENCE      = 0.20; // Minimum MediaPipe score threshold (scoreThreshold in createFromOptions)
  var MADE_MAX_FRAMES      = 22;   // More frames allowed for rim transit
  var DETECTION_INTERVAL   = 60;   // ~16 FPS detection rate

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

    var sumX = 0, sumY = 0, count = 0;
    var minX = vw, minY = vh, maxX = 0, maxY = 0;

    for (var y = 0; y < vh; y += COLOR_SCAN_STEP) {
      for (var x = 0; x < vw; x += COLOR_SCAN_STEP) {
        var idx = (y * vw + x) * 4;
        var r = data[idx], g = data[idx + 1], b = data[idx + 2];

        // Basketball orange detection: high red, medium green, low blue
        // Also detect lighter orange/tan for worn basketballs
        if (r > 140 && g > 50 && g < 180 && b < 100 && r > g * 1.2 && r > b * 2.0) {
          sumX += x;
          sumY += y;
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (count < COLOR_MIN_PIXELS || count > COLOR_MAX_PIXELS) return null;

    var cx = sumX / count;
    var cy = sumY / count;
    var blobW = maxX - minX;
    var blobH = maxY - minY;

    // Aspect ratio check — ball should be roughly circular
    if (blobW < 3 || blobH < 3) return null;
    var aspect = Math.max(blobW, blobH) / Math.min(blobW, blobH);
    if (aspect > 3.0) return null;

    // Size check — not too big, not too small
    var blobArea = blobW * blobH;
    var frameArea = vw * vh;
    if (blobArea < frameArea * 0.0002 || blobArea > frameArea * 0.15) return null;

    // Compactness — pixels should fill a reasonable portion of the bounding box
    var fillRatio = (count * COLOR_SCAN_STEP * COLOR_SCAN_STEP) / blobArea;
    if (fillRatio < 0.15) return null;

    return { x: cx, y: cy, w: blobW, h: blobH, score: 0.5 + fillRatio * 0.3 };
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
    _detectorType: 'none',   // 'mediapipe' | 'none'
    _procW: 0,
    _procH: 0,

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

      if (self.model) return Promise.resolve(true);

      self._setStatus('loading');

      return new Promise(function (resolve) {
        self._tryLoadModel(resolve);
      });
    },

    _tryLoadModel: function (resolve) {
      var self = this;

      /* Guard: MediaPipe globals must be available from vision_bundle.mjs CDN */
      if (typeof FilesetResolver === 'undefined' || typeof ObjectDetector === 'undefined') {
        console.warn('[ShotDetection] MediaPipe not available — color-only mode');
        self._colorOnlyMode = true;
        self._detectorType = 'none';
        self._setStatus('color-only');
        resolve(true);
        return;
      }

      FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      ).then(function (vision) {
        return ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
            delegate: 'GPU'
          },
          scoreThreshold: 0.2,
          runningMode: 'VIDEO',
          categoryAllowlist: ['sports ball', 'orange', 'frisbee']
        });
      }).then(function (detector) {
        self.model = detector;
        self._detectorType = 'mediapipe';
        self._setStatus('ready');
        resolve(true);
      }).catch(function (err) {
        console.warn('[ShotDetection] MediaPipe load failed — color-only mode:', err);
        self._mlFailed = true;        /* keep existing flag for backward compat */
        self._colorOnlyMode = true;
        self._detectorType = 'none';
        self._setStatus('color-only');
        resolve(true); /* resolve true — color detection still works */
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
      if (this._canvas.width !== vw) this._canvas.width = vw;
      if (this._canvas.height !== vh) this._canvas.height = vh;
      this._ctx.drawImage(this.videoEl, 0, 0, vw, vh);
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

      // Always draw to canvas for color detection
      var canvasReady = self._drawToCanvas();

      if (self.model && !self._colorOnlyMode) {
        // ML + color hybrid detection
        self.model.detect(self.videoEl).then(function (predictions) {
          self._isDetecting = false;
          if (!self.isRunning) return;

          var mlBall = self._findMLBall(predictions, vw, vh);

          // If ML missed, try color + TL verification
          if (!mlBall && canvasReady) {
            self._mlMissCount++;
            var colorBall = detectBallByColor(self._canvas, self._ctx, vw, vh);
            if (colorBall) {
              /* Verify with Transfer Learning if available */
              var tlResult = window.AdaptiveLearning
                ? window.AdaptiveLearning.verifyWithTL(self._canvas, colorBall.x, colorBall.y)
                : null;
              if (!tlResult || tlResult.isBall || tlResult.score > 0.3) {
                self._processBallDetection(colorBall.x, colorBall.y, vw, vh);
              } else {
                self._processNoBall();
              }
            } else {
              self._processNoBall();
            }
          } else if (mlBall) {
            self._mlMissCount = 0;
            self._processBallDetection(mlBall.x, mlBall.y, vw, vh);
          } else {
            self._processNoBall();
          }

          self._scheduleDetection();
        }).catch(function (err) {
          self._isDetecting = false;
          console.error('ML detection error:', err);
          // Try color fallback on ML error
          if (canvasReady) {
            var colorBall = detectBallByColor(self._canvas, self._ctx, vw, vh);
            if (colorBall) {
              self._processBallDetection(colorBall.x, colorBall.y, vw, vh);
            }
          }
          self._scheduleDetection();
        });
      } else {
        // Color-only mode
        if (canvasReady) {
          var colorBall = detectBallByColor(self._canvas, self._ctx, vw, vh);
          if (colorBall) {
            self._processBallDetection(colorBall.x, colorBall.y, vw, vh);
          } else {
            self._processNoBall();
          }
        }
        self._isDetecting = false;
        self._scheduleDetection();
      }
    },

    _findMLBall: function (result, vw, vh) {
      /* MediaPipe result format:
         { detections: [{ categories: [{categoryName, score}], boundingBox: {originX, originY, width, height} }] }
      */
      if (!result || !result.detections || !result.detections.length) return null;

      var frameArea = vw * vh;
      var minArea = frameArea * BALL_MIN_AREA_FRAC;
      var maxArea = frameArea * BALL_MAX_AREA_FRAC;
      var bestDet = null;
      var bestScore = 0;
      var ballWeights = { 'sports ball': 1.0, 'frisbee': 0.85, 'orange': 0.7 };

      for (var i = 0; i < result.detections.length; i++) {
        var det = result.detections[i];
        if (!det.categories || !det.categories.length) continue;

        var cat = det.categories[0];
        var weight = ballWeights[cat.categoryName];
        if (!weight) continue;

        var adjScore = cat.score * weight;
        if (adjScore <= BALL_CONFIDENCE || adjScore <= bestScore) continue;

        var bb = det.boundingBox;
        var area = bb.width * bb.height;
        if (area < minArea || area > maxArea) continue;

        /* Shape check — ball should be roughly circular */
        var aspect = Math.max(bb.width, bb.height) / (Math.min(bb.width, bb.height) || 1);
        if (aspect > 3.0) continue;

        bestDet = det;
        bestScore = adjScore;
      }

      if (!bestDet) return null;

      var finalBb = bestDet.boundingBox;
      return {
        x: finalBb.originX + finalBb.width / 2,
        y: finalBb.originY + finalBb.height / 2
      };
    },

    _processBallDetection: function (cx, cy, vw, vh) {
      updateTracker(this.tracker, cx, cy);
      var normX = cx / vw;
      var normY = cy / vh;
      this.ballPosition = { normX: normX, normY: normY };
      if (this.onBallUpdate) this.onBallUpdate(this.ballPosition);

      /* Feed to adaptive learning (Level 1 + 3) */
      if (window.AdaptiveLearning && this._canvas && this._ctx) {
        window.AdaptiveLearning.onBallDetected(this._canvas, this._ctx, cx, cy);
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
