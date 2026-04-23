/* ══════════════════════════════════════════════════════════════
   SORT TRACKER — Simple Online Realtime Tracking

   Multi-object tracker with:
     - Per-track Kalman filter (2D position + velocity, gravity model)
     - Hungarian algorithm for optimal detection↔track assignment
     - IoU + distance hybrid cost matrix
     - Track lifecycle: tentative → confirmed → coasting → deleted

   Designed for basketball court: 1 ball + 1 hoop, but generalizes
   to N objects. Runs in-browser, no dependencies.

   Usage:
     var tracker = new SORTTracker({ maxAge: 30, minHits: 3 });
     // Each frame:
     var tracks = tracker.update(detections);
     // detections = [{ cx, cy, w, h, score, classId }]
     // tracks = [{ id, cx, cy, w, h, classId, age, hits, state, history }]
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config defaults ──────────────────────────────────────── */
  var DEFAULTS = {
    maxAge:       30,    // Frames before a coasting track is deleted
    minHits:      2,     // Detections before tentative→confirmed
    iouThreshold: 0.20,  // Min IoU for matching (low because ball is small/fast)
    maxDistance:   150,   // Max pixel distance for fallback matching
    gravity:      0.5,   // Gravity bias for ball (class 0) prediction
    processNoise: 1.0,   // Kalman process noise
    measureNoise: 4.0,   // Kalman measurement noise
    useIoU:       true,  // Use IoU matching (disable for point-only objects)
  };

  /* ── Track ID generator ───────────────────────────────────── */
  var _nextTrackId = 1;

  /* ── 2D Kalman Filter (position + velocity + size) ─────────
       State: [cx, cy, vx, vy, w, h]
       Handles gravity for ball class.
     ──────────────────────────────────────────────────────────── */
  function KalmanBox(cx, cy, w, h, classId, config) {
    this.cx = cx;
    this.cy = cy;
    this.vx = 0;
    this.vy = 0;
    this.w = w;
    this.h = h;
    this.classId = classId;
    this.config = config;

    // Covariance (diagonal simplified)
    this.pcx = config.measureNoise;
    this.pcy = config.measureNoise;
    this.pvx = 50;
    this.pvy = 50;
    this.pw = 10;
    this.ph = 10;
  }

  KalmanBox.prototype.predict = function () {
    var g = (this.classId === 0) ? this.config.gravity : 0; // gravity only for ball
    this.cx += this.vx;
    this.cy += this.vy + g * 0.5;
    this.vy += g;
    // Covariance grows
    var q = this.config.processNoise;
    this.pcx += this.pvx + q;
    this.pcy += this.pvy + q;
    this.pvx += q;
    this.pvy += q;
    this.pw += q * 0.1;
    this.ph += q * 0.1;
  };

  KalmanBox.prototype.update = function (cx, cy, w, h) {
    var mn = this.config.measureNoise;
    // Kalman gains
    var kcx = this.pcx / (this.pcx + mn);
    var kcy = this.pcy / (this.pcy + mn);
    var kw = this.pw / (this.pw + mn * 2);
    var kh = this.ph / (this.ph + mn * 2);

    // Innovation
    var icx = cx - this.cx;
    var icy = cy - this.cy;

    // Update velocity from position residual
    this.vx = clamp(this.vx + icx * 0.25, -150, 150);
    this.vy = clamp(this.vy + icy * 0.25, -150, 150);

    // Update position
    this.cx += kcx * icx;
    this.cy += kcy * icy;
    this.w += kw * (w - this.w);
    this.h += kh * (h - this.h);

    // Update covariance
    this.pcx *= (1 - kcx);
    this.pcy *= (1 - kcy);
    this.pvx *= 0.92;
    this.pvy *= 0.92;
    this.pw *= (1 - kw);
    this.ph *= (1 - kh);
  };

  KalmanBox.prototype.getState = function () {
    return { cx: this.cx, cy: this.cy, w: this.w, h: this.h, vx: this.vx, vy: this.vy };
  };

  /* ── Track object ─────────────────────────────────────────── */
  function Track(det, config) {
    this.id = _nextTrackId++;
    this.classId = det.classId || 0;
    this.kf = new KalmanBox(det.cx, det.cy, det.w || 20, det.h || 20, this.classId, config);
    this.hits = 1;           // Total measurement updates
    this.age = 0;            // Frames since creation
    this.timeSinceUpdate = 0; // Frames since last measurement
    this.state = 'tentative'; // tentative | confirmed | coasting | deleted
    this.score = det.score || 0;
    this.history = [{ cx: det.cx, cy: det.cy, frame: 0, predicted: false }];
    this.maxHistory = 80;
    this.config = config;
  }

  Track.prototype.predict = function () {
    this.kf.predict();
    this.age++;
    this.timeSinceUpdate++;
    // State transitions on predict
    if (this.state === 'confirmed' && this.timeSinceUpdate > 0) {
      this.state = 'coasting';
    }
    if (this.timeSinceUpdate > this.config.maxAge) {
      this.state = 'deleted';
    }
  };

  Track.prototype.update = function (det) {
    this.kf.update(det.cx, det.cy, det.w || this.kf.w, det.h || this.kf.h);
    this.timeSinceUpdate = 0;
    this.hits++;
    this.score = det.score || this.score;
    // State transitions on update
    if (this.state === 'tentative' && this.hits >= this.config.minHits) {
      this.state = 'confirmed';
    } else if (this.state === 'coasting') {
      this.state = 'confirmed';
    }
    // Push to history
    var s = this.kf.getState();
    this.history.push({
      cx: s.cx, cy: s.cy,
      frame: this.age,
      predicted: false,
      vx: s.vx, vy: s.vy
    });
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  };

  Track.prototype.pushPredicted = function () {
    var s = this.kf.getState();
    this.history.push({
      cx: s.cx, cy: s.cy,
      frame: this.age,
      predicted: true,
      vx: s.vx, vy: s.vy
    });
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  };

  Track.prototype.toOutput = function () {
    var s = this.kf.getState();
    return {
      id: this.id,
      cx: s.cx, cy: s.cy, w: s.w, h: s.h,
      vx: s.vx, vy: s.vy,
      classId: this.classId,
      score: this.score,
      age: this.age,
      hits: this.hits,
      timeSinceUpdate: this.timeSinceUpdate,
      state: this.state,
      history: this.history
    };
  };

  /* ── IoU computation ──────────────────────────────────────── */
  function computeIoU(a, b) {
    var ax1 = a.cx - (a.w || 20) / 2, ay1 = a.cy - (a.h || 20) / 2;
    var ax2 = a.cx + (a.w || 20) / 2, ay2 = a.cy + (a.h || 20) / 2;
    var bx1 = b.cx - (b.w || 20) / 2, by1 = b.cy - (b.h || 20) / 2;
    var bx2 = b.cx + (b.w || 20) / 2, by2 = b.cy + (b.h || 20) / 2;

    var ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
    var ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
    var inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
    var areaA = (a.w || 20) * (a.h || 20);
    var areaB = (b.w || 20) * (b.h || 20);
    var union = areaA + areaB - inter;
    return union > 0 ? inter / union : 0;
  }

  /* ── Euclidean distance ───────────────────────────────────── */
  function centerDist(a, b) {
    var dx = a.cx - b.cx;
    var dy = a.cy - b.cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ── Hungarian Algorithm (Munkres) ────────────────────────
     Simplified for small matrices (typically ≤5x5).
     Cost matrix: costMatrix[i][j] = cost of assigning row i to col j.
     Returns array of [row, col] pairs.
     ──────────────────────────────────────────────────────────── */
  function hungarian(costMatrix) {
    var n = costMatrix.length;
    if (n === 0) return [];
    var m = costMatrix[0].length;
    if (m === 0) return [];

    // Pad to square
    var sz = Math.max(n, m);
    var C = [];
    for (var i = 0; i < sz; i++) {
      C[i] = [];
      for (var j = 0; j < sz; j++) {
        C[i][j] = (i < n && j < m) ? costMatrix[i][j] : 0;
      }
    }

    // Step 1: Subtract row mins
    for (var i = 0; i < sz; i++) {
      var rowMin = Infinity;
      for (var j = 0; j < sz; j++) if (C[i][j] < rowMin) rowMin = C[i][j];
      for (var j = 0; j < sz; j++) C[i][j] -= rowMin;
    }

    // Step 2: Subtract col mins
    for (var j = 0; j < sz; j++) {
      var colMin = Infinity;
      for (var i = 0; i < sz; i++) if (C[i][j] < colMin) colMin = C[i][j];
      for (var i = 0; i < sz; i++) C[i][j] -= colMin;
    }

    // Iterative assignment with cover lines
    var MAX_ITER = sz * sz * 2;
    for (var iter = 0; iter < MAX_ITER; iter++) {
      // Try to find optimal assignment using zeros
      var rowAssign = new Array(sz).fill(-1);
      var colAssign = new Array(sz).fill(-1);

      // Greedy matching on zeros (good enough for small matrices)
      for (var i = 0; i < sz; i++) {
        for (var j = 0; j < sz; j++) {
          if (C[i][j] < 1e-9 && rowAssign[i] === -1 && colAssign[j] === -1) {
            rowAssign[i] = j;
            colAssign[j] = i;
          }
        }
      }

      // Count assignments
      var assigned = 0;
      for (var i = 0; i < sz; i++) if (rowAssign[i] >= 0) assigned++;

      if (assigned >= sz) {
        // Extract valid pairs
        var result = [];
        for (var i = 0; i < n; i++) {
          if (rowAssign[i] < m) {
            result.push([i, rowAssign[i]]);
          }
        }
        return result;
      }

      // Cover rows/cols and adjust
      var covRow = new Uint8Array(sz);
      var covCol = new Uint8Array(sz);

      // Cover cols with assignments
      for (var j = 0; j < sz; j++) if (colAssign[j] >= 0) covCol[j] = 1;

      // Find min uncovered value
      var minVal = Infinity;
      for (var i = 0; i < sz; i++) {
        for (var j = 0; j < sz; j++) {
          if (!covRow[i] && !covCol[j] && C[i][j] < minVal) {
            minVal = C[i][j];
          }
        }
      }

      if (minVal === Infinity || minVal === 0) {
        // Fallback: use current greedy assignment
        var result = [];
        for (var i = 0; i < n; i++) {
          if (rowAssign[i] >= 0 && rowAssign[i] < m) {
            result.push([i, rowAssign[i]]);
          }
        }
        return result;
      }

      // Subtract from uncovered, add to double-covered
      for (var i = 0; i < sz; i++) {
        for (var j = 0; j < sz; j++) {
          if (!covRow[i] && !covCol[j]) C[i][j] -= minVal;
          if (covRow[i] && covCol[j]) C[i][j] += minVal;
        }
      }
    }

    // Timeout: return greedy
    var result = [];
    var usedCols = {};
    for (var i = 0; i < n; i++) {
      var bestJ = -1, bestCost = Infinity;
      for (var j = 0; j < m; j++) {
        if (!usedCols[j] && costMatrix[i][j] < bestCost) {
          bestCost = costMatrix[i][j];
          bestJ = j;
        }
      }
      if (bestJ >= 0) {
        result.push([i, bestJ]);
        usedCols[bestJ] = true;
      }
    }
    return result;
  }

  /* ── Utility ──────────────────────────────────────────────── */
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ══════════════════════════════════════════════════════════════
     SORT Tracker
     ══════════════════════════════════════════════════════════════ */
  function SORTTracker(opts) {
    opts = opts || {};
    this.config = {};
    for (var k in DEFAULTS) this.config[k] = opts[k] !== undefined ? opts[k] : DEFAULTS[k];
    this.tracks = [];
    this.frameCount = 0;
  }

  /**
   * Main update step. Call once per frame with new detections.
   * @param {Array} detections - [{ cx, cy, w, h, score, classId }]
   * @returns {Array} Active tracks (confirmed + coasting with timeSinceUpdate ≤ maxAge/2)
   */
  SORTTracker.prototype.update = function (detections) {
    var self = this;
    detections = detections || [];
    this.frameCount++;

    // Step 1: Predict all existing tracks
    for (var i = 0; i < this.tracks.length; i++) {
      this.tracks[i].predict();
    }

    // Step 2: Separate detections by class for class-aware matching
    var detsByClass = {};
    for (var d = 0; d < detections.length; d++) {
      var cls = detections[d].classId || 0;
      if (!detsByClass[cls]) detsByClass[cls] = [];
      detsByClass[cls].push({ det: detections[d], idx: d });
    }

    var tracksByClass = {};
    for (var t = 0; t < this.tracks.length; t++) {
      var cls = this.tracks[t].classId;
      if (!tracksByClass[cls]) tracksByClass[cls] = [];
      tracksByClass[cls].push({ track: this.tracks[t], idx: t });
    }

    // Step 3: Match within each class
    var matchedTrackIndices = {};
    var matchedDetIndices = {};

    var allClasses = {};
    for (var c in detsByClass) allClasses[c] = true;
    for (var c in tracksByClass) allClasses[c] = true;

    for (var cls in allClasses) {
      var classDets = detsByClass[cls] || [];
      var classTracks = tracksByClass[cls] || [];

      if (classDets.length === 0 || classTracks.length === 0) continue;

      // Build cost matrix
      var costMatrix = [];
      for (var ti = 0; ti < classTracks.length; ti++) {
        costMatrix[ti] = [];
        var trk = classTracks[ti].track;
        var trkState = trk.kf.getState();
        for (var di = 0; di < classDets.length; di++) {
          var det = classDets[di].det;
          // Hybrid cost: IoU + distance
          var iou = self.config.useIoU ? computeIoU(trkState, det) : 0;
          var dist = centerDist(trkState, det);
          // Cost = 1 - IoU + normalized distance
          var distCost = Math.min(dist / self.config.maxDistance, 1.0);
          costMatrix[ti][di] = (1 - iou) * 0.5 + distCost * 0.5;
        }
      }

      // Hungarian matching
      var assignments = hungarian(costMatrix);

      for (var a = 0; a < assignments.length; a++) {
        var ti = assignments[a][0];
        var di = assignments[a][1];
        var cost = costMatrix[ti][di];

        // Gate: reject if both IoU too low AND distance too far
        var trk = classTracks[ti].track;
        var det = classDets[di].det;
        var trkState = trk.kf.getState();
        var iou = self.config.useIoU ? computeIoU(trkState, det) : 0;
        var dist = centerDist(trkState, det);

        if (iou < self.config.iouThreshold && dist > self.config.maxDistance) {
          continue; // Not a valid match
        }

        matchedTrackIndices[classTracks[ti].idx] = true;
        matchedDetIndices[classDets[di].idx] = true;
        trk.update(det);
      }
    }

    // Step 4: Push predicted history for unmatched tracks
    for (var t = 0; t < this.tracks.length; t++) {
      if (!matchedTrackIndices[t]) {
        this.tracks[t].pushPredicted();
      }
    }

    // Step 5: Create new tracks for unmatched detections
    for (var d = 0; d < detections.length; d++) {
      if (!matchedDetIndices[d]) {
        this.tracks.push(new Track(detections[d], this.config));
      }
    }

    // Step 6: Remove deleted tracks
    this.tracks = this.tracks.filter(function (t) {
      return t.state !== 'deleted';
    });

    // Step 7: Return active tracks (confirmed or recently coasting)
    var output = [];
    for (var t = 0; t < this.tracks.length; t++) {
      var trk = this.tracks[t];
      if (trk.state === 'confirmed' || trk.state === 'coasting') {
        output.push(trk.toOutput());
      }
    }
    return output;
  };

  /**
   * Get the best track for a specific class.
   * @param {number} classId
   * @returns {Object|null} Track output or null
   */
  SORTTracker.prototype.getBestTrack = function (classId) {
    var best = null;
    var bestScore = -1;
    for (var t = 0; t < this.tracks.length; t++) {
      var trk = this.tracks[t];
      if (trk.classId === classId && (trk.state === 'confirmed' || trk.state === 'coasting')) {
        // Prefer tracks with recent measurements and higher scores
        var recency = 1.0 / (1 + trk.timeSinceUpdate);
        var composite = trk.score * 0.5 + recency * 0.3 + (trk.hits / (trk.age + 1)) * 0.2;
        if (composite > bestScore) {
          bestScore = composite;
          best = trk;
        }
      }
    }
    return best ? best.toOutput() : null;
  };

  /**
   * Get all tracks for a specific class.
   */
  SORTTracker.prototype.getClassTracks = function (classId) {
    var result = [];
    for (var t = 0; t < this.tracks.length; t++) {
      var trk = this.tracks[t];
      if (trk.classId === classId && trk.state !== 'deleted') {
        result.push(trk.toOutput());
      }
    }
    return result;
  };

  /**
   * Reset all tracks.
   */
  SORTTracker.prototype.reset = function () {
    this.tracks = [];
    this.frameCount = 0;
  };

  /**
   * Get track by ID.
   */
  SORTTracker.prototype.getTrackById = function (id) {
    for (var t = 0; t < this.tracks.length; t++) {
      if (this.tracks[t].id === id) return this.tracks[t].toOutput();
    }
    return null;
  };

  /* ── Expose globally ────────────────────────────────────────── */
  window.SORTTracker = SORTTracker;

})();
