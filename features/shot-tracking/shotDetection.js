/* ══════════════════════════════════════════════════════════════
   SHOT DETECTION — TensorFlow.js COCO-SSD Ball Detection
   + Centroid Tracker + Shot Result Analysis

   v2 — Resolution-normalized thresholds, better area filtering,
        improved Y-trend with normalized diff, cooldown as ms
        instead of frame count, wider approach zone.

   Runs entirely in-browser using:
     - @tensorflow/tfjs (CDN)
     - @tensorflow-models/coco-ssd (CDN)
     - Web MediaDevices API for camera feed
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Constants ──────────────────────────────────────────────── */
  var DEBOUNCE_MS          = 2000;  // Cooldown between counted shots (increased for rebounds)
  var MIN_TRAJECTORY_PTS   = 6;    // Min points before analyzing
  var MAX_HISTORY          = 30;   // Rolling buffer size
  var MAX_GAP_FRAMES       = 5;    // Frames ball can vanish before losing track
  var MIN_MOVEMENT_PX      = 3;    // Sub-pixel jitter threshold
  var BALL_CONFIDENCE      = 0.35; // Min COCO-SSD confidence
  var MADE_MAX_FRAMES      = 12;   // Max transit frames through rim
  var DETECTION_INTERVAL   = 100;  // ms between ML detections (~10 FPS)

  /* Area thresholds as fractions of total frame area */
  var BALL_MIN_AREA_FRAC   = 0.0005;  // ~200/(640*480)
  var BALL_MAX_AREA_FRAC   = 0.09;    // ~80000/(640*480) generous

  /* Y-trend diff threshold as fraction of frame height */
  var Y_TREND_FRAC         = 0.007;   // ~5/720

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
    // Normalize diff relative to frame height
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
      // Wider approach zone for better miss detection
      approachLeft: cx - w * 1.0,
      approachRight: cx + w * 1.0,
      approachTop: cy - h * 2.0,
      approachBottom: cy + h * 2.0
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
    var margin = rim.width * 0.3;
    return x >= rim.left - margin && x <= rim.right + margin;
  }

  /* ── Shot Analysis ──────────────────────────────────────────── */
  function analyzeMade(trajectory, rim) {
    if (trajectory.length < 4) return { isMade: false, entryPoint: null };
    var enteredAbove = false, enteredRim = false, exitedBelow = false;
    var entryFrame = -1, entryPoint = null;

    for (var i = 0; i < trajectory.length; i++) {
      var pt = trajectory[i];
      if (!enteredAbove && isAboveRim(pt.y, rim) && isWithinHorizontalBounds(pt.x, rim)) {
        enteredAbove = true;
      }
      if (enteredAbove && !enteredRim && isInsideRim(pt.x, pt.y, rim)) {
        enteredRim = true;
        entryFrame = pt.frame;
        entryPoint = { x: pt.x, y: pt.y };
      }
      if (enteredRim && isBelowRim(pt.y, rim)) {
        if (pt.frame - entryFrame <= MADE_MAX_FRAMES && isWithinHorizontalBounds(pt.x, rim)) {
          exitedBelow = true;
          break;
        }
      }
      if (enteredRim && pt.frame - entryFrame > MADE_MAX_FRAMES) break;
    }
    return { isMade: enteredAbove && enteredRim && exitedBelow, entryPoint: entryPoint };
  }

  function analyzeMiss(trajectory, rim) {
    if (trajectory.length < 4) return { isMiss: false, entryPoint: null };
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
    canvasEl: null,
    canvasCtx: null,
    stats: { made: 0, attempts: 0 },
    ballPosition: null,
    onShotDetected: null,
    onBallUpdate: null,
    onStatusChange: null,
    _isDetecting: false,

    init: function () {
      var self = this;
      self.tracker = createTracker();

      if (self.model) return Promise.resolve(true);

      self._setStatus('loading');

      return new Promise(function (resolve) {
        if (typeof tf === 'undefined') {
          console.error('TF.js not loaded — include @tensorflow/tfjs CDN');
          self._setStatus('error');
          resolve(false);
          return;
        }

        tf.ready().then(function () {
          if (typeof cocoSsd === 'undefined') {
            console.error('COCO-SSD not loaded — include @tensorflow-models/coco-ssd CDN');
            self._setStatus('error');
            resolve(false);
            return;
          }

          cocoSsd.load({ base: 'lite_mobilenet_v2' }).then(function (model) {
            self.model = model;
            self._setStatus('ready');
            resolve(true);
          }).catch(function (err) {
            console.error('COCO-SSD load failed:', err);
            self._setStatus('error');
            resolve(false);
          });
        }).catch(function (err) {
          console.error('TF.js init failed:', err);
          self._setStatus('error');
          resolve(false);
        });
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
      if (!this.model) {
        console.warn('Model not loaded yet');
        return;
      }

      this.videoEl = videoEl;
      this.isRunning = true;
      this.stats = { made: 0, attempts: 0 };
      this.lastShotTime = 0;
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

    _detectFrame: function () {
      var self = this;
      if (!self.isRunning || !self.model || !self.videoEl) return;
      if (self._isDetecting) { self._scheduleDetection(); return; }
      if (self.videoEl.readyState < 2) { self._scheduleDetection(); return; }

      self._isDetecting = true;
      var vw = self.videoEl.videoWidth;
      var vh = self.videoEl.videoHeight;
      var frameArea = vw * vh;
      var minArea = frameArea * BALL_MIN_AREA_FRAC;
      var maxArea = frameArea * BALL_MAX_AREA_FRAC;

      self.model.detect(self.videoEl).then(function (predictions) {
        self._isDetecting = false;
        if (!self.isRunning) return;

        var bestBall = null;
        var bestScore = 0;
        for (var i = 0; i < predictions.length; i++) {
          var p = predictions[i];
          if (p.class === 'sports ball' && p.score > BALL_CONFIDENCE && p.score > bestScore) {
            var area = p.bbox[2] * p.bbox[3];
            if (area >= minArea && area <= maxArea) {
              bestBall = p;
              bestScore = p.score;
            }
          }
        }

        if (bestBall) {
          var cx = bestBall.bbox[0] + bestBall.bbox[2] / 2;
          var cy = bestBall.bbox[1] + bestBall.bbox[3] / 2;
          updateTracker(self.tracker, cx, cy);
          var normX = cx / vw;
          var normY = cy / vh;
          self.ballPosition = { normX: normX, normY: normY };
          if (self.onBallUpdate) self.onBallUpdate(self.ballPosition);
          self._analyzeShotState(vw, vh, normX, normY);
        } else {
          updateTracker(self.tracker, null, null);
          self.ballPosition = null;
          if (self.onBallUpdate) self.onBallUpdate(null);
        }

        self._scheduleDetection();
      }).catch(function (err) {
        self._isDetecting = false;
        console.error('Detection error:', err);
        self._scheduleDetection();
      });
    },

    _analyzeShotState: function (vw, vh, normX, normY) {
      if (!this.rimZone) return;

      var now = Date.now();
      if (now - this.lastShotTime < DEBOUNCE_MS) return;
      if (this.tracker.positions.length < MIN_TRAJECTORY_PTS) return;

      var traj = getTrajectoryNormalized(this.tracker, vw, vh, 20);
      var last = traj[traj.length - 1];
      if (!isInApproachZone(last.x, last.y, this.rimZone)) return;

      var trend = getYTrend(this.tracker, vh);
      if (trend !== 'falling') return;

      var launchPt = getLaunchPoint(this.tracker, vw, vh);
      var shotZone = classifyShotZone(launchPt, this.rimZone, this.threePtDistance);

      // Check made
      var madeResult = analyzeMade(traj, this.rimZone);
      if (madeResult.isMade) {
        this.lastShotTime = now;
        this.stats.made++;
        this.stats.attempts++;
        if (this.onShotDetected) {
          this.onShotDetected({
            result: 'made',
            shotX: madeResult.entryPoint ? madeResult.entryPoint.x : normX,
            shotY: madeResult.entryPoint ? madeResult.entryPoint.y : normY,
            trajectory: traj.slice(-20),
            launchPoint: launchPt,
            shotZone: shotZone,
            timestamp: now
          });
        }
        resetTracker(this.tracker);
        return;
      }

      // Check miss
      var missResult = analyzeMiss(traj, this.rimZone);
      if (missResult.isMiss) {
        this.lastShotTime = now;
        this.stats.attempts++;
        if (this.onShotDetected) {
          this.onShotDetected({
            result: 'missed',
            shotX: missResult.entryPoint ? missResult.entryPoint.x : normX,
            shotY: missResult.entryPoint ? missResult.entryPoint.y : normY,
            trajectory: traj.slice(-20),
            launchPoint: launchPt,
            shotZone: shotZone,
            timestamp: now
          });
        }
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
