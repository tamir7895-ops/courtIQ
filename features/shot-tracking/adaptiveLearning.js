/* ══════════════════════════════════════════════════════════════
   ADAPTIVE LEARNING — Self-Improving Shot Detection

   Three-level learning system that improves with every session:

   Level 1: Adaptive Color — Learns the exact ball color in
            current lighting, auto-calibrates HSV ranges.

   Level 2: Trajectory Patterns — Learns typical shot arcs,
            speeds, and zones. Improves made/miss classification.

   Level 3: Transfer Learning — Fine-tunes a small neural net
            to recognize THIS specific basketball on THIS court.

   All data stored in localStorage/IndexedDB for persistence.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Storage keys ──────────────────────────────────────────── */
  var STORAGE_KEY_COLOR   = 'courtiq-adaptive-color';
  var STORAGE_KEY_TRAJ    = 'courtiq-adaptive-traj';
  var STORAGE_KEY_MODEL   = 'courtiq-adaptive-model';
  var IDB_NAME            = 'courtiq-learning';
  var IDB_STORE           = 'ball-samples';
  var IDB_VERSION         = 1;

  /* ══════════════════════════════════════════════════════════════
     LEVEL 1: ADAPTIVE COLOR CALIBRATION
     ══════════════════════════════════════════════════════════════
     When ML detects the ball, we sample the pixel colors at that
     location and build a running profile of what "basketball"
     looks like in current conditions.
     ══════════════════════════════════════════════════════════════ */
  var AdaptiveColor = {
    /* Running color statistics */
    samples: [],
    maxSamples: 200,

    /* Learned HSV ranges (start with wide defaults) */
    hueMin: 5,    hueMax: 30,
    satMin: 80,   satMax: 255,
    valMin: 100,  valMax: 255,

    /* RGB learned ranges */
    rMin: 140, rMax: 255,
    gMin: 50,  gMax: 180,
    bMin: 0,   bMax: 100,

    /* Confidence — how many samples we have */
    confidence: 0,

    init: function () {
      this._load();
    },

    /**
     * Feed a confirmed ball detection location.
     * Samples a patch of pixels around (cx, cy) from the canvas.
     */
    addSample: function (canvas, ctx, cx, cy, radius) {
      if (!canvas || !ctx) return;
      radius = radius || 15;
      var x0 = Math.max(0, Math.floor(cx - radius));
      var y0 = Math.max(0, Math.floor(cy - radius));
      var x1 = Math.min(canvas.width, Math.floor(cx + radius));
      var y1 = Math.min(canvas.height, Math.floor(cy + radius));
      var w = x1 - x0, h = y1 - y0;
      if (w < 4 || h < 4) return;

      try {
        var imgData = ctx.getImageData(x0, y0, w, h);
        var data = imgData.data;
      } catch (e) { return; }

      /* Sample center pixels — skip edges which might be background */
      var rSum = 0, gSum = 0, bSum = 0, count = 0;
      var innerR = radius * 0.6;
      for (var py = 0; py < h; py++) {
        for (var px = 0; px < w; px++) {
          var dx = px - w / 2, dy = py - h / 2;
          if (dx * dx + dy * dy > innerR * innerR) continue;
          var idx = (py * w + px) * 4;
          var r = data[idx], g = data[idx + 1], b = data[idx + 2];
          /* Only sample orange-ish pixels, skip obvious outliers */
          if (r > 80 && r > g && r > b * 1.3) {
            rSum += r; gSum += g; bSum += b;
            count++;
          }
        }
      }

      if (count < 5) return;

      var sample = {
        r: rSum / count,
        g: gSum / count,
        b: bSum / count,
        ts: Date.now()
      };

      this.samples.push(sample);
      if (this.samples.length > this.maxSamples) {
        this.samples = this.samples.slice(-this.maxSamples);
      }

      /* Recalculate learned ranges every 10 samples */
      if (this.samples.length % 10 === 0) {
        this._recalculate();
      }
    },

    /**
     * Check if a pixel matches the learned ball color.
     * Returns a score 0-1 (0 = not ball, 1 = perfect match).
     */
    matchPixel: function (r, g, b) {
      if (this.confidence < 0.3) {
        /* Not enough data — use wide default orange detection */
        if (r > 140 && g > 50 && g < 180 && b < 100 && r > g * 1.2 && r > b * 2.0) {
          return 0.5;
        }
        return 0;
      }

      /* Score based on distance from learned mean */
      var rMid = (this.rMin + this.rMax) / 2;
      var gMid = (this.gMin + this.gMax) / 2;
      var bMid = (this.bMin + this.bMax) / 2;
      var rRange = (this.rMax - this.rMin) / 2 || 30;
      var gRange = (this.gMax - this.gMin) / 2 || 30;
      var bRange = (this.bMax - this.bMin) / 2 || 20;

      var rScore = Math.max(0, 1 - Math.abs(r - rMid) / (rRange * 1.5));
      var gScore = Math.max(0, 1 - Math.abs(g - gMid) / (gRange * 1.5));
      var bScore = Math.max(0, 1 - Math.abs(b - bMid) / (bRange * 1.5));

      return (rScore * 0.4 + gScore * 0.35 + bScore * 0.25) * this.confidence;
    },

    /** Recalculate color ranges from collected samples */
    _recalculate: function () {
      if (this.samples.length < 10) return;

      var rs = [], gs = [], bs = [];
      /* Weight recent samples more — lighting can change */
      var recent = this.samples.slice(-100);
      for (var i = 0; i < recent.length; i++) {
        rs.push(recent[i].r);
        gs.push(recent[i].g);
        bs.push(recent[i].b);
      }

      rs.sort(numSort); gs.sort(numSort); bs.sort(numSort);

      /* Use 10th-90th percentile for ranges */
      var p10 = Math.floor(rs.length * 0.1);
      var p90 = Math.floor(rs.length * 0.9);

      this.rMin = Math.max(0, rs[p10] - 15);
      this.rMax = Math.min(255, rs[p90] + 15);
      this.gMin = Math.max(0, gs[p10] - 15);
      this.gMax = Math.min(255, gs[p90] + 15);
      this.bMin = Math.max(0, bs[p10] - 10);
      this.bMax = Math.min(255, bs[p90] + 10);

      this.confidence = Math.min(1.0, this.samples.length / 50);

      this._save();
    },

    _save: function () {
      try {
        localStorage.setItem(STORAGE_KEY_COLOR, JSON.stringify({
          rMin: this.rMin, rMax: this.rMax,
          gMin: this.gMin, gMax: this.gMax,
          bMin: this.bMin, bMax: this.bMax,
          confidence: this.confidence,
          sampleCount: this.samples.length,
          samples: this.samples.slice(-50) /* Keep last 50 for quick warmup */
        }));
      } catch (e) { /* quota */ }
    },

    _load: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY_COLOR);
        if (!raw) return;
        var d = JSON.parse(raw);
        this.rMin = d.rMin; this.rMax = d.rMax;
        this.gMin = d.gMin; this.gMax = d.gMax;
        this.bMin = d.bMin; this.bMax = d.bMax;
        this.confidence = d.confidence || 0;
        this.samples = d.samples || [];
      } catch (e) { /* corrupt */ }
    },

    getStats: function () {
      return {
        confidence: this.confidence,
        sampleCount: this.samples.length,
        rRange: [this.rMin, this.rMax],
        gRange: [this.gMin, this.gMax],
        bRange: [this.bMin, this.bMax]
      };
    }
  };

  function numSort(a, b) { return a - b; }


  /* ══════════════════════════════════════════════════════════════
     LEVEL 2: TRAJECTORY PATTERN LEARNING
     ══════════════════════════════════════════════════════════════
     Stores shot trajectories and learns typical patterns:
     - What does a "made" trajectory look like for this user?
     - What speed/arc angle typically results in makes vs misses?
     - Builds a simple nearest-neighbor classifier.
     ══════════════════════════════════════════════════════════════ */
  var TrajectoryLearner = {
    madePatterns: [],
    missPatterns: [],
    maxPatterns: 100,

    /* Learned thresholds */
    avgMadeArc: 0,
    avgMadeSpeed: 0,
    avgMissArc: 0,
    avgMissSpeed: 0,
    confidence: 0,

    init: function () {
      this._load();
    },

    /**
     * Record a completed shot trajectory with its result.
     * trajectory: array of { x, y, frame }
     * result: 'made' or 'missed'
     */
    addShot: function (trajectory, result, rimZone) {
      if (!trajectory || trajectory.length < 3 || !rimZone) return;

      var features = this._extractFeatures(trajectory, rimZone);
      if (!features) return;

      if (result === 'made') {
        this.madePatterns.push(features);
        if (this.madePatterns.length > this.maxPatterns) {
          this.madePatterns = this.madePatterns.slice(-this.maxPatterns);
        }
      } else {
        this.missPatterns.push(features);
        if (this.missPatterns.length > this.maxPatterns) {
          this.missPatterns = this.missPatterns.slice(-this.maxPatterns);
        }
      }

      this._recalculate();
      this._save();
    },

    /**
     * Predict if a trajectory-in-progress looks like a made or missed shot.
     * Returns { prediction: 'made'|'missed'|'unknown', confidence: 0-1 }
     */
    predict: function (trajectory, rimZone) {
      if (this.confidence < 0.3) return { prediction: 'unknown', confidence: 0 };
      if (!trajectory || trajectory.length < 3) return { prediction: 'unknown', confidence: 0 };

      var features = this._extractFeatures(trajectory, rimZone);
      if (!features) return { prediction: 'unknown', confidence: 0 };

      /* K-nearest neighbor: compare to stored patterns */
      var k = 5;
      var distances = [];

      for (var i = 0; i < this.madePatterns.length; i++) {
        distances.push({ dist: this._featureDistance(features, this.madePatterns[i]), result: 'made' });
      }
      for (var j = 0; j < this.missPatterns.length; j++) {
        distances.push({ dist: this._featureDistance(features, this.missPatterns[j]), result: 'missed' });
      }

      distances.sort(function (a, b) { return a.dist - b.dist; });

      var topK = distances.slice(0, k);
      var madeVotes = 0, missVotes = 0;
      for (var m = 0; m < topK.length; m++) {
        if (topK[m].result === 'made') madeVotes++;
        else missVotes++;
      }

      var total = madeVotes + missVotes;
      if (total === 0) return { prediction: 'unknown', confidence: 0 };

      var majorityResult = madeVotes >= missVotes ? 'made' : 'missed';
      var majorityConf = Math.max(madeVotes, missVotes) / total;

      return {
        prediction: majorityResult,
        confidence: majorityConf * this.confidence
      };
    },

    _extractFeatures: function (trajectory, rimZone) {
      if (trajectory.length < 3) return null;
      var first = trajectory[0];
      var last = trajectory[trajectory.length - 1];
      var mid = trajectory[Math.floor(trajectory.length / 2)];

      /* Arc height — highest point relative to start and end */
      var minY = Infinity;
      for (var i = 0; i < trajectory.length; i++) {
        if (trajectory[i].y < minY) minY = trajectory[i].y;
      }

      var arcHeight = first.y - minY; /* Higher arc = larger value */
      var totalDx = last.x - first.x;
      var totalDy = last.y - first.y;
      var totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
      var entryAngle = Math.atan2(last.y - mid.y, last.x - mid.x);

      /* Speed — average displacement between frames */
      var totalDisp = 0;
      for (var j = 1; j < trajectory.length; j++) {
        var dx = trajectory[j].x - trajectory[j - 1].x;
        var dy = trajectory[j].y - trajectory[j - 1].y;
        totalDisp += Math.sqrt(dx * dx + dy * dy);
      }
      var avgSpeed = totalDisp / (trajectory.length - 1);

      /* Distance from rim at closest point */
      var minRimDist = Infinity;
      if (rimZone) {
        for (var k = 0; k < trajectory.length; k++) {
          var rdx = trajectory[k].x - rimZone.centerX;
          var rdy = trajectory[k].y - rimZone.centerY;
          var rd = Math.sqrt(rdx * rdx + rdy * rdy);
          if (rd < minRimDist) minRimDist = rd;
        }
      }

      /* Horizontal alignment with rim */
      var xAlignAtRimY = null;
      if (rimZone) {
        for (var n = 0; n < trajectory.length; n++) {
          if (Math.abs(trajectory[n].y - rimZone.centerY) < 0.02) {
            xAlignAtRimY = Math.abs(trajectory[n].x - rimZone.centerX);
            break;
          }
        }
      }

      return {
        arcHeight: arcHeight,
        totalDist: totalDist,
        entryAngle: entryAngle,
        avgSpeed: avgSpeed,
        minRimDist: minRimDist,
        xAlign: xAlignAtRimY || 0.5,
        numPoints: trajectory.length,
        ts: Date.now()
      };
    },

    _featureDistance: function (a, b) {
      var weights = { arcHeight: 2, totalDist: 1, entryAngle: 3, avgSpeed: 1.5, minRimDist: 2.5, xAlign: 2 };
      var d = 0;
      d += weights.arcHeight * Math.pow((a.arcHeight - b.arcHeight) * 10, 2);
      d += weights.totalDist * Math.pow((a.totalDist - b.totalDist) * 5, 2);
      d += weights.entryAngle * Math.pow(a.entryAngle - b.entryAngle, 2);
      d += weights.avgSpeed * Math.pow((a.avgSpeed - b.avgSpeed) * 8, 2);
      d += weights.minRimDist * Math.pow((a.minRimDist - b.minRimDist) * 10, 2);
      d += weights.xAlign * Math.pow((a.xAlign - b.xAlign) * 10, 2);
      return Math.sqrt(d);
    },

    _recalculate: function () {
      var total = this.madePatterns.length + this.missPatterns.length;
      this.confidence = Math.min(1.0, total / 30);

      if (this.madePatterns.length > 0) {
        var arcSum = 0, speedSum = 0;
        for (var i = 0; i < this.madePatterns.length; i++) {
          arcSum += this.madePatterns[i].arcHeight;
          speedSum += this.madePatterns[i].avgSpeed;
        }
        this.avgMadeArc = arcSum / this.madePatterns.length;
        this.avgMadeSpeed = speedSum / this.madePatterns.length;
      }

      if (this.missPatterns.length > 0) {
        var arcSum2 = 0, speedSum2 = 0;
        for (var j = 0; j < this.missPatterns.length; j++) {
          arcSum2 += this.missPatterns[j].arcHeight;
          speedSum2 += this.missPatterns[j].avgSpeed;
        }
        this.avgMissArc = arcSum2 / this.missPatterns.length;
        this.avgMissSpeed = speedSum2 / this.missPatterns.length;
      }
    },

    _save: function () {
      try {
        localStorage.setItem(STORAGE_KEY_TRAJ, JSON.stringify({
          madePatterns: this.madePatterns.slice(-50),
          missPatterns: this.missPatterns.slice(-50),
          confidence: this.confidence
        }));
      } catch (e) { /* quota */ }
    },

    _load: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY_TRAJ);
        if (!raw) return;
        var d = JSON.parse(raw);
        this.madePatterns = d.madePatterns || [];
        this.missPatterns = d.missPatterns || [];
        this.confidence = d.confidence || 0;
        this._recalculate();
      } catch (e) { /* corrupt */ }
    },

    getStats: function () {
      return {
        confidence: this.confidence,
        madeCount: this.madePatterns.length,
        missCount: this.missPatterns.length,
        avgMadeArc: this.avgMadeArc,
        avgMadeSpeed: this.avgMadeSpeed
      };
    }
  };


  /* ══════════════════════════════════════════════════════════════
     LEVEL 3: TRANSFER LEARNING — IN-BROWSER FINE-TUNING
     ══════════════════════════════════════════════════════════════
     Collects small image crops of confirmed ball detections and
     background patches, then trains a small binary classifier
     (ball vs not-ball) on top of MobileNet features.

     Uses IndexedDB to store image samples persistently.
     Retrains periodically as new samples accumulate.
     ══════════════════════════════════════════════════════════════ */
  var TransferLearner = {
    featureModel: null,       /* MobileNet feature extractor */
    classifierModel: null,    /* Small dense classifier head */
    isTraining: false,
    isReady: false,
    positiveSamples: 0,       /* ball crops collected */
    negativeSamples: 0,       /* background crops collected */
    lastTrainTime: 0,
    trainInterval: 60000,     /* Retrain every 60s if new data */
    minSamplesToTrain: 15,    /* Need at least 15 samples to train */
    db: null,
    confidence: 0,
    _pendingSamples: [],      /* Buffer before flush to IDB */

    init: function () {
      var self = this;
      return new Promise(function (resolve) {
        self._openDB().then(function () {
          return self._countSamples();
        }).then(function () {
          return self._loadFeatureModel();
        }).then(function (ok) {
          if (ok && self.positiveSamples >= self.minSamplesToTrain &&
              self.negativeSamples >= self.minSamplesToTrain) {
            return self._buildAndTrainClassifier();
          }
          return false;
        }).then(function () {
          resolve(true);
        }).catch(function (err) {
          console.warn('TransferLearner init:', err);
          resolve(false);
        });
      });
    },

    /**
     * Collect a ball sample from a confirmed ML detection.
     * Crops a 64x64 patch around the ball center.
     */
    addBallSample: function (canvas, cx, cy) {
      this._addSample(canvas, cx, cy, 'ball');
    },

    /**
     * Collect a negative sample (random background patch).
     */
    addBackgroundSample: function (canvas, cx, cy) {
      this._addSample(canvas, cx, cy, 'background');
    },

    /**
     * Run the trained classifier on a canvas region.
     * Returns { isBall: boolean, score: 0-1 } or null if not ready.
     */
    predict: function (canvas, cx, cy) {
      if (!this.isReady || !this.classifierModel || !this.featureModel) return null;

      try {
        var crop = this._cropAndResize(canvas, cx, cy, 96, 96);
        if (!crop) return null;

        var tf_ = window.tf;
        var tensor = tf_.browser.fromPixels(crop).toFloat().div(127.5).sub(1).expandDims(0);
        var features = this.featureModel.predict(tensor);
        var prediction = this.classifierModel.predict(features);
        var score = prediction.dataSync()[0];

        tensor.dispose();
        features.dispose();
        prediction.dispose();
        crop.close ? crop.close() : null;

        return { isBall: score > 0.5, score: score };
      } catch (e) {
        return null;
      }
    },

    _worker: null,

    /** Check if it's time to retrain and do so (uses Web Worker) */
    maybeRetrain: function () {
      if (this.isTraining) return;
      var now = Date.now();
      if (now - this.lastTrainTime < this.trainInterval) return;
      var totalNew = this.positiveSamples + this.negativeSamples;
      if (totalNew < this.minSamplesToTrain * 2) return;

      this._trainInWorker();
    },

    /** Train in a background Web Worker to avoid freezing UI */
    _trainInWorker: function () {
      var self = this;

      /* Fallback to main thread if Workers not supported */
      if (typeof Worker === 'undefined') {
        self._buildAndTrainClassifier();
        return;
      }

      self.isTraining = true;

      self._getAllSamples().then(function (samples) {
        if (samples.length < self.minSamplesToTrain * 2) {
          self.isTraining = false;
          return;
        }

        try {
          if (!self._worker) {
            self._worker = new Worker('features/shot-tracking/tl-training-worker.js');
            self._worker.onmessage = function (e) {
              var msg = e.data;
              if (msg.type === 'trained' && msg.result && msg.result.success) {
                self.confidence = Math.min(1.0, msg.result.accuracy);
                self.isReady = true;
                self.isTraining = false;
                self.lastTrainTime = Date.now();

                /* Rebuild classifier on main thread from worker weights */
                self._rebuildClassifierFromWeights(msg.result.weightSpecs, msg.result.weightData);

                console.log('TL trained in Worker — accuracy: ' + (msg.result.accuracy * 100).toFixed(1) + '%');
              } else {
                self.isTraining = false;
                if (msg.type === 'error') {
                  console.warn('TL Worker error:', msg.error);
                }
              }
            };
            self._worker.onerror = function (err) {
              console.warn('TL Worker failed, falling back to main thread:', err);
              self._worker = null;
              self.isTraining = false;
              /* Fallback to main thread training */
              self._buildAndTrainClassifier();
            };
          }

          self._worker.postMessage({ type: 'train', samples: samples });
        } catch (e) {
          console.warn('Worker creation failed:', e);
          self.isTraining = false;
          self._buildAndTrainClassifier();
        }
      });
    },

    /** Rebuild classifier model on main thread from Worker-trained weights */
    _rebuildClassifierFromWeights: function (weightSpecs, weightData) {
      if (!weightSpecs || !weightData || typeof tf === 'undefined') return;
      try {
        var tf_ = window.tf;
        /* We need the feature model's output shape to build matching classifier */
        if (!this.featureModel) return;

        /* Get a dummy prediction to know the shape */
        var dummyInput = tf_.zeros([1, 96, 96, 3]);
        var dummyFeatures = this.featureModel.predict(dummyInput);
        var featureShape = dummyFeatures.shape.slice(1);
        dummyInput.dispose();
        dummyFeatures.dispose();

        var classifier = tf_.sequential();
        classifier.add(tf_.layers.flatten({ inputShape: featureShape }));
        classifier.add(tf_.layers.dense({ units: 32, activation: 'relu' }));
        classifier.add(tf_.layers.dropout({ rate: 0.3 }));
        classifier.add(tf_.layers.dense({ units: 1, activation: 'sigmoid' }));

        classifier.compile({
          optimizer: tf_.train.adam(0.001),
          loss: 'binaryCrossentropy'
        });

        /* Set weights from worker data */
        var tensors = [];
        for (var i = 0; i < weightSpecs.length; i++) {
          tensors.push(tf_.tensor(weightData[i], weightSpecs[i].shape));
        }
        classifier.setWeights(tensors);

        this.classifierModel = classifier;
      } catch (e) {
        console.warn('Failed to rebuild classifier from worker weights:', e);
      }
    },

    /* ── Internal ──────────────────────────────────────────────── */

    _addSample: function (canvas, cx, cy, label) {
      if (!canvas) return;
      var crop = this._cropAndResize(canvas, cx, cy, 64, 64);
      if (!crop) return;

      /* Get pixel data from crop */
      var tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = 64; tmpCanvas.height = 64;
      var tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.drawImage(crop, 0, 0, 64, 64);
      var imgData = tmpCtx.getImageData(0, 0, 64, 64);

      /* Store as compact Uint8Array */
      var sample = {
        label: label,
        pixels: Array.from(imgData.data), /* RGBA flat array */
        ts: Date.now()
      };

      if (label === 'ball') this.positiveSamples++;
      else this.negativeSamples++;

      this._pendingSamples.push(sample);

      /* Flush every 5 samples */
      if (this._pendingSamples.length >= 5) {
        this._flushToDB();
      }
    },

    _cropAndResize: function (canvas, cx, cy, outW, outH) {
      var cropSize = 80; /* pixels around center */
      var x0 = Math.max(0, Math.floor(cx - cropSize / 2));
      var y0 = Math.max(0, Math.floor(cy - cropSize / 2));
      var w = Math.min(cropSize, canvas.width - x0);
      var h = Math.min(cropSize, canvas.height - y0);
      if (w < 20 || h < 20) return null;

      var tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = outW; tmpCanvas.height = outH;
      var tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.drawImage(canvas, x0, y0, w, h, 0, 0, outW, outH);
      return tmpCanvas;
    },

    _openDB: function () {
      var self = this;
      return new Promise(function (resolve, reject) {
        if (!window.indexedDB) { resolve(); return; }
        var req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            var store = db.createObjectStore(IDB_STORE, { autoIncrement: true });
            store.createIndex('label', 'label', { unique: false });
          }
        };
        req.onsuccess = function (e) {
          self.db = e.target.result;
          resolve();
        };
        req.onerror = function () { resolve(); };
      });
    },

    _flushToDB: function () {
      if (!this.db || this._pendingSamples.length === 0) return;
      try {
        var tx = this.db.transaction(IDB_STORE, 'readwrite');
        var store = tx.objectStore(IDB_STORE);
        for (var i = 0; i < this._pendingSamples.length; i++) {
          store.add(this._pendingSamples[i]);
        }
        this._pendingSamples = [];
      } catch (e) { /* IDB error */ }
    },

    _countSamples: function () {
      var self = this;
      return new Promise(function (resolve) {
        if (!self.db) { resolve(); return; }
        try {
          var tx = self.db.transaction(IDB_STORE, 'readonly');
          var store = tx.objectStore(IDB_STORE);
          var idx = store.index('label');

          var ballReq = idx.count('ball');
          ballReq.onsuccess = function () {
            self.positiveSamples = ballReq.result;
            var bgReq = idx.count('background');
            bgReq.onsuccess = function () {
              self.negativeSamples = bgReq.result;
              resolve();
            };
            bgReq.onerror = function () { resolve(); };
          };
          ballReq.onerror = function () { resolve(); };
        } catch (e) { resolve(); }
      });
    },

    _loadFeatureModel: function () {
      var self = this;
      return new Promise(function (resolve) {
        if (typeof tf === 'undefined') { resolve(false); return; }

        try {
          /* Use MobileNet as feature extractor — get intermediate layer output */
          tf.ready().then(function () {
            return tf.loadLayersModel(
              'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json'
            );
          }).then(function (mobilenet) {
            /* Take output from an intermediate layer for features */
            var layer = mobilenet.getLayer('conv_pw_13_relu') || mobilenet.layers[mobilenet.layers.length - 3];
            self.featureModel = tf.model({
              inputs: mobilenet.inputs,
              outputs: layer.output
            });
            resolve(true);
          }).catch(function (err) {
            console.warn('Feature model load failed:', err);
            resolve(false);
          });
        } catch (e) {
          resolve(false);
        }
      });
    },

    _getAllSamples: function () {
      var self = this;
      return new Promise(function (resolve) {
        if (!self.db) { resolve([]); return; }
        try {
          var tx = self.db.transaction(IDB_STORE, 'readonly');
          var store = tx.objectStore(IDB_STORE);
          var req = store.getAll();
          req.onsuccess = function () {
            /* Limit to most recent 200 samples for training speed */
            var all = req.result || [];
            if (all.length > 200) all = all.slice(-200);
            resolve(all);
          };
          req.onerror = function () { resolve([]); };
        } catch (e) { resolve([]); }
      });
    },

    _buildAndTrainClassifier: function () {
      var self = this;
      if (!self.featureModel || self.isTraining) return Promise.resolve(false);

      self.isTraining = true;

      return self._getAllSamples().then(function (samples) {
        if (samples.length < self.minSamplesToTrain * 2) {
          self.isTraining = false;
          return false;
        }

        var tf_ = window.tf;

        /* Convert samples to tensors */
        var xs = [];
        var ys = [];
        for (var i = 0; i < samples.length; i++) {
          var s = samples[i];
          if (!s.pixels || s.pixels.length !== 64 * 64 * 4) continue;

          /* Reconstruct 64x64 image, resize to 96x96 for MobileNet compat */
          var imgTensor = tf_.tensor3d(
            new Uint8Array(s.pixels), [64, 64, 4]
          ).slice([0, 0, 0], [64, 64, 3]) /* Drop alpha */
           .resizeBilinear([96, 96])
           .toFloat().div(127.5).sub(1);

          xs.push(imgTensor);
          ys.push(s.label === 'ball' ? 1 : 0);
        }

        if (xs.length < 10) {
          xs.forEach(function (t) { t.dispose(); });
          self.isTraining = false;
          return false;
        }

        var xBatch = tf_.stack(xs);
        var features = self.featureModel.predict(xBatch);
        var yBatch = tf_.tensor1d(ys);

        /* Clean up input tensors */
        xs.forEach(function (t) { t.dispose(); });
        xBatch.dispose();

        /* Build small classifier head */
        var flatShape = features.shape.slice(1).reduce(function (a, b) { return a * b; }, 1);
        var classifier = tf_.sequential();
        classifier.add(tf_.layers.flatten({ inputShape: features.shape.slice(1) }));
        classifier.add(tf_.layers.dense({ units: 32, activation: 'relu' }));
        classifier.add(tf_.layers.dropout({ rate: 0.3 }));
        classifier.add(tf_.layers.dense({ units: 1, activation: 'sigmoid' }));

        classifier.compile({
          optimizer: tf_.train.adam(0.001),
          loss: 'binaryCrossentropy',
          metrics: ['accuracy']
        });

        return classifier.fit(features, yBatch, {
          epochs: 10,
          batchSize: 16,
          shuffle: true,
          verbose: 0
        }).then(function (history) {
          self.classifierModel = classifier;
          self.isReady = true;
          self.isTraining = false;
          self.lastTrainTime = Date.now();

          var finalAcc = history.history.acc
            ? history.history.acc[history.history.acc.length - 1]
            : 0;
          self.confidence = Math.min(1.0, finalAcc);

          features.dispose();
          yBatch.dispose();

          console.log('TransferLearner trained — accuracy: ' + (finalAcc * 100).toFixed(1) + '%');
          return true;
        });
      }).catch(function (err) {
        console.warn('TransferLearner training error:', err);
        self.isTraining = false;
        return false;
      });
    },

    getStats: function () {
      return {
        isReady: this.isReady,
        confidence: this.confidence,
        positiveSamples: this.positiveSamples,
        negativeSamples: this.negativeSamples,
        isTraining: this.isTraining
      };
    }
  };


  /* ══════════════════════════════════════════════════════════════
     UNIFIED ADAPTIVE LEARNING API
     ══════════════════════════════════════════════════════════════ */
  var AdaptiveLearning = {
    color: AdaptiveColor,
    trajectory: TrajectoryLearner,
    transfer: TransferLearner,
    _initialized: false,

    /**
     * Initialize all learning subsystems.
     * Call once when shot tracking starts.
     */
    init: function () {
      if (this._initialized) return Promise.resolve();
      this._initialized = true;

      AdaptiveColor.init();
      TrajectoryLearner.init();

      /* Transfer learning init is async but non-blocking */
      return TransferLearner.init().then(function () {
        console.log('AdaptiveLearning initialized —',
          'Color confidence:', AdaptiveColor.confidence.toFixed(2),
          '| Trajectory patterns:', TrajectoryLearner.madePatterns.length + TrajectoryLearner.missPatterns.length,
          '| TL samples:', TransferLearner.positiveSamples + TransferLearner.negativeSamples
        );
      });
    },

    /**
     * Feed a confirmed ball detection from ML.
     * This trains ALL subsystems.
     */
    onBallDetected: function (canvas, ctx, cx, cy) {
      /* Level 1: Color calibration */
      AdaptiveColor.addSample(canvas, ctx, cx, cy);

      /* Level 3: Collect training sample for TL */
      if (canvas) {
        TransferLearner.addBallSample(canvas, cx, cy);

        /* Also add random background sample for negative data */
        if (Math.random() < 0.3) {
          var bgX = Math.random() * canvas.width;
          var bgY = Math.random() * canvas.height;
          /* Make sure it's far from the ball */
          var dist = Math.sqrt(Math.pow(bgX - cx, 2) + Math.pow(bgY - cy, 2));
          if (dist > 100) {
            TransferLearner.addBackgroundSample(canvas, bgX, bgY);
          }
        }
      }

      /* Periodically retrain TL model */
      TransferLearner.maybeRetrain();
    },

    /**
     * Record a completed shot for trajectory learning.
     */
    onShotCompleted: function (trajectory, result, rimZone) {
      TrajectoryLearner.addShot(trajectory, result, rimZone);
    },

    /**
     * Enhanced color detection using learned color model.
     * Drop-in replacement for the default detectBallByColor.
     */
    detectBallByLearnedColor: function (canvas, ctx, vw, vh) {
      if (!canvas || !ctx || vw < 10 || vh < 10) return null;

      try {
        var imgData = ctx.getImageData(0, 0, vw, vh);
        var data = imgData.data;
      } catch (e) { return null; }

      var scanStep = 4;
      var sumX = 0, sumY = 0, count = 0, totalScore = 0;
      var minX = vw, minY = vh, maxX = 0, maxY = 0;

      for (var y = 0; y < vh; y += scanStep) {
        for (var x = 0; x < vw; x += scanStep) {
          var idx = (y * vw + x) * 4;
          var r = data[idx], g = data[idx + 1], b = data[idx + 2];

          var score = AdaptiveColor.matchPixel(r, g, b);
          if (score > 0.3) {
            sumX += x; sumY += y;
            count++;
            totalScore += score;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (count < 8 || count > 6000) return null;

      var cx = sumX / count;
      var cy = sumY / count;
      var blobW = maxX - minX;
      var blobH = maxY - minY;

      if (blobW < 3 || blobH < 3) return null;
      var aspect = Math.max(blobW, blobH) / Math.min(blobW, blobH);
      if (aspect > 3.0) return null;

      var blobArea = blobW * blobH;
      var frameArea = vw * vh;
      if (blobArea < frameArea * 0.0002 || blobArea > frameArea * 0.15) return null;

      var avgScore = totalScore / count;

      return { x: cx, y: cy, w: blobW, h: blobH, score: avgScore };
    },

    /**
     * Use Transfer Learning model to verify a candidate ball detection.
     * Returns boosted or reduced score.
     */
    verifyWithTL: function (canvas, cx, cy) {
      var result = TransferLearner.predict(canvas, cx, cy);
      if (!result) return null;
      return result;
    },

    /**
     * Predict shot outcome from trajectory in progress.
     */
    predictShot: function (trajectory, rimZone) {
      return TrajectoryLearner.predict(trajectory, rimZone);
    },

    /**
     * Get learning stats for all subsystems.
     */
    getStats: function () {
      return {
        color: AdaptiveColor.getStats(),
        trajectory: TrajectoryLearner.getStats(),
        transfer: TransferLearner.getStats(),
        overallConfidence: (
          AdaptiveColor.confidence * 0.3 +
          TrajectoryLearner.confidence * 0.3 +
          TransferLearner.confidence * 0.4
        )
      };
    },

    /**
     * Reset all learned data (start fresh).
     */
    reset: function () {
      AdaptiveColor.samples = [];
      AdaptiveColor.confidence = 0;
      TrajectoryLearner.madePatterns = [];
      TrajectoryLearner.missPatterns = [];
      TrajectoryLearner.confidence = 0;

      try { localStorage.removeItem(STORAGE_KEY_COLOR); } catch (e) {}
      try { localStorage.removeItem(STORAGE_KEY_TRAJ); } catch (e) {}

      if (TransferLearner.db) {
        try {
          var tx = TransferLearner.db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).clear();
        } catch (e) {}
      }

      TransferLearner.positiveSamples = 0;
      TransferLearner.negativeSamples = 0;
      TransferLearner.classifierModel = null;
      TransferLearner.isReady = false;
      TransferLearner.confidence = 0;
    }
  };

  /* ── Expose globally ────────────────────────────────────────── */
  window.AdaptiveLearning = AdaptiveLearning;

})();
