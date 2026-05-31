/* ══════════════════════════════════════════════════════════════
   POSE DETECTOR — MediaPipe Pose Landmarker wrapper

   Single instance, lazy-loaded. Exposes:
     window.PoseDetector.init()              → Promise<void>
     window.PoseDetector.detect(vid, tsMs)   → { landmarks, ts } | null
     window.PoseDetector.isReady()           → bool

   The pose landmarker is loaded once globally. Re-calling init() is a
   no-op. Calls to detect() before init resolves return null.

   Landmark indices follow the MediaPipe Pose schema (0=nose, 11/12=
   shoulders, 13/14=elbows, 15/16=wrists, 23/24=hips, etc.). See
   https://developers.google.com/mediapipe/solutions/vision/pose_landmarker

   Integration note: MediaPipe in VIDEO running mode requires monotonically
   increasing timestamps. The state machine always passes
   `videoEl.currentTime * 1000`, which only goes backwards if the user
   seeks; in that rare case we silently swallow the resulting empty
   result and the engine falls back to ball-only detection for that frame.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DEBUG = (typeof window !== 'undefined' && window.PoseDetectorDebug === true);
  function dlog() { if (!DEBUG) return; console.log.apply(console, arguments); }

  /* ── State ─────────────────────────────────────────────────── */
  var _landmarker  = null;
  var _initPromise = null;
  var _lastFrameKey = -1;        // cache key — caller's per-frame identifier
  var _lastWallTs   = 0;         // last wall-clock timestamp sent to MediaPipe
  var _lastResult  = null;
  var _failedInit  = false;

  /* ── Config ────────────────────────────────────────────────── */
  var MP_VERSION   = '0.10.14';
  var WASM_BASE    = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION + '/wasm';
  // L8.7: Lite returns candidateCount=1 even with numPoses=3 — strong single-
  // person bias. FULL (~6MB vs Lite ~3MB) is more willing to find multiple
  // people, important for outdoor courts with 2-3 visible players. Cost: ~2×
  // inference latency on WebGPU but still well under the 33ms budget.
  // Switch back to *_lite.task if perf becomes an issue.
  var MODEL_URL    = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
  var MP_BRIDGE_WAIT_MS = 10000;  // how long to wait for the ESM bridge in dashboard.html

  /* ── Heuristic tunables ───────────────────────────────────────
     Defaults tuned empirically on _eval/v2.mp4 (25-shot indoor video).
     Achieves 21/25 = 84% recall with no false-positive clusters.
     See bench harness debug-pose-shot-bench.html for re-tuning.

     Coords are MediaPipe-normalized: x,y in [0,1] of the video
     frame, with y=0 at the TOP. So "wrist above nose" means
     wrist.y < nose.y.

     Tunables are exposed via window.PoseDetector.tune({ ... }).
   ──────────────────────────────────────────────────────────── */
  var TUNE = {
    visibilityMin:     0.15,   // shooter often partly occluded by defender / equipment
    armExtensionMin:   0.50,   // wrist-to-shoulder dist / shoulder-to-hip dist
    belowLookbackMs:   200,    // wrist must have been below shoulder this long ago
    peakWindowMs:      200,    // window for local-minimum detection
    peakToleranceNorm: 0.025,  // |y_current - y_min| ≤ this means "at peak"
    cooldownMs:        400,    // L14.A: was 700 — drops back-to-back triggers
                               // when shots come every 2-3s (pull-up workouts,
                               // form shooting drills). 400ms still rejects
                               // wrist-bounce false peaks within a single shot.
    historyMs:         1500,   // how much pose history to retain
    // L8 tuning knob (default 0 = original strict behavior):
    //   wristAboveNose normally requires wrist.y < nose.y. At distance, Pose
    //   Lite is jittery and shooters with a "set shot" form may peak with
    //   wrist at forehead/eye level rather than fully above the nose. Adding
    //   slack relaxes the gate to wrist.y < nose.y + noseSlackNorm.
    //   noseSlackNorm: 0.05 ≈ 5% of frame height (~54px on 1080p).
    noseSlackNorm:     0.0
  };

  function tune(patch) {
    if (!patch) return Object.assign({}, TUNE);
    Object.keys(patch).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(TUNE, k)) TUNE[k] = patch[k];
    });
    return Object.assign({}, TUNE);
  }

  /* ── MediaPipe Pose landmark indices ─────────────────────────── */
  var L = {
    NOSE: 0,
    LSH: 11, RSH: 12,
    LEL: 13, REL: 14,
    LWR: 15, RWR: 16,
    LHIP: 23, RHIP: 24
  };

  function _avg(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function _dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx*dx + dy*dy); }

  /* ── Feature extractor ───────────────────────────────────────
     Returns a compact feature dict for one frame's landmarks, or
     null if the data is unusable (too few points, low visibility).

     The "shooting hand" is whichever wrist is higher in frame
     RIGHT NOW. This works for both left- and right-handed shots
     and matches the moment-of-release pose universally.
   ──────────────────────────────────────────────────────────── */
  function _extractFeatures(lm, tsMs) {
    if (!lm || lm.length < 25) return null;
    var nose = lm[L.NOSE];
    var sh   = _avg(lm[L.LSH], lm[L.RSH]);
    var hip  = _avg(lm[L.LHIP], lm[L.RHIP]);
    var lw   = lm[L.LWR], rw = lm[L.RWR];
    var shootingLeft = (lw.y < rw.y);          // pick the higher wrist
    var wrist    = shootingLeft ? lw : rw;
    var elbow    = shootingLeft ? lm[L.LEL] : lm[L.REL];
    var shoulder = shootingLeft ? lm[L.LSH] : lm[L.RSH];
    // Scale reference = shoulder→hip distance (~half torso height).
    // Floored to avoid division-by-zero when the model returns degenerate
    // collinear hip+shoulder for a heavily occluded frame.
    var bodyHeight = Math.max(0.05, _dist(sh, hip));
    return {
      ts: tsMs,
      wristY:             wrist.y,
      wristX:             wrist.x,
      noseY:              nose.y,
      shoulderY:          sh.y,
      hipX:               hip.x,
      hipY:               hip.y,
      wristAboveNose:     wrist.y < nose.y + TUNE.noseSlackNorm,
      wristAboveShoulder: wrist.y < sh.y,
      armExtension:       _dist(wrist, shoulder) / bodyHeight,
      visibility:         (wrist.visibility    || 0)
                        * (elbow.visibility    || 0)
                        * (shoulder.visibility || 0),
      bodyHeight:         bodyHeight,
      shootingHand:       shootingLeft ? 'L' : 'R'
    };
  }

  /* ── Rolling history of feature snapshots ──────────────────── */
  var _history = [];
  var _lastShotReleaseTs = 0;

  function _pruneHistory(nowTs) {
    while (_history.length && nowTs - _history[0].ts > TUNE.historyMs) {
      _history.shift();
    }
  }

  /* ── detectShootingMotion ─────────────────────────────────────
     Returns { isShot: true, releaseTs, releaseConfidence,
               shooterCenterX, shooterCenterY, shootingHand }
     when the latest sample looks like a shot-release peak.
     Otherwise returns { isShot: false }.

     A release-peak is defined as:
       (a) wrist visibility ≥ visibilityMin
       (b) wrist currently above the nose (peak-of-arc position)
       (c) arm is extended (wrist→shoulder distance ≥ armExtensionMin × body)
       (d) some sample ≥ belowLookbackMs ago had the wrist below shoulder
           (i.e. we just saw the arm rise — not a stationary "hands up" pose)
       (e) the current wristY is at a local minimum within peakWindowMs
           (i.e. we're at or just past the apex of the wrist arc)
       (f) cooldownMs has elapsed since the previous shot release

     All thresholds tunable via PoseDetector.tune({...}).
   ──────────────────────────────────────────────────────────── */
  function detectShootingMotion(lm, tsMs) {
    var f = _extractFeatures(lm, tsMs);
    if (!f) return { isShot: false, reason: 'no-features' };
    _pruneHistory(tsMs);
    _history.push(f);

    if (tsMs - _lastShotReleaseTs < TUNE.cooldownMs) return { isShot: false, reason: 'cooldown' };
    if (f.visibility    < TUNE.visibilityMin)       return { isShot: false, reason: 'low-visibility' };
    if (!f.wristAboveNose)                          return { isShot: false, reason: 'wrist-not-above-nose' };
    if (f.armExtension  < TUNE.armExtensionMin)     return { isShot: false, reason: 'arm-not-extended' };

    // (d) wrist must have been below the shoulder at some sample
    //     ≥ belowLookbackMs ago. Filters out static "hands up" poses.
    var startedBelow = false;
    for (var i = 0; i < _history.length - 1; i++) {
      var h = _history[i];
      if (tsMs - h.ts >= TUNE.belowLookbackMs && !h.wristAboveShoulder) {
        startedBelow = true;
        break;
      }
    }
    if (!startedBelow) return { isShot: false, reason: 'no-prior-low' };

    // (e) local-minimum check inside peakWindowMs
    var recentMinY = f.wristY;
    var samplesChecked = 0;
    for (var j = _history.length - 2; j >= 0; j--) {
      if (tsMs - _history[j].ts > TUNE.peakWindowMs) break;
      samplesChecked++;
      if (_history[j].wristY < recentMinY) recentMinY = _history[j].wristY;
    }
    var isPeak = samplesChecked >= 2 && Math.abs(f.wristY - recentMinY) < TUNE.peakToleranceNorm;
    if (!isPeak) return { isShot: false, reason: 'not-at-peak' };

    _lastShotReleaseTs = tsMs;
    var hipCenterX = (lm[L.LHIP].x + lm[L.RHIP].x) * 0.5;
    var hipCenterY = (lm[L.LHIP].y + lm[L.RHIP].y) * 0.5;
    return {
      isShot: true,
      releaseTs:         tsMs,
      releaseConfidence: f.visibility,
      shooterCenterX:    hipCenterX,
      shooterCenterY:    hipCenterY,
      shootingHand:      f.shootingHand,
      wristY:            f.wristY
    };
  }

  function resetMotion() {
    _history = [];
    _lastShotReleaseTs = 0;
  }

  function isReady() { return _landmarker !== null; }
  function hasFailed() { return _failedInit; }

  async function _waitForMP() {
    var steps = Math.ceil(MP_BRIDGE_WAIT_MS / 100);
    for (var i = 0; i < steps; i++) {
      if (window.__MP && window.__MP.PoseLandmarker) return window.__MP;
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    throw new Error('MediaPipe Tasks Vision never loaded (window.__MP missing). ' +
      'Check the <script type="module"> bridge in dashboard.html.');
  }

  async function init() {
    if (_landmarker) return;
    if (_failedInit) throw new Error('PoseDetector previously failed to init — refresh page to retry');
    if (_initPromise) return _initPromise;

    _initPromise = (async function () {
      try {
        var MP = await _waitForMP();
        var t0 = performance.now();
        var resolver = await MP.FilesetResolver.forVisionTasks(WASM_BASE);
        _landmarker = await MP.PoseLandmarker.createFromOptions(resolver, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          // L8.6: track up to 3 people. Pose Lite single-person mode picks
          // whoever has highest detection score, which in multi-player frames
          // is often NOT the shooter (e.g. defender standing in the open vs
          // shooter partially occluded mid-release). detect() picks the most
          // shooter-like candidate from the returned set.
          numPoses: 3
        });
        dlog('[PoseDetector] model loaded in ' + ((performance.now() - t0) | 0) + ' ms');
      } catch (err) {
        _failedInit = true;
        console.warn('[PoseDetector] init failed — pose features disabled:', err && err.message);
        throw err;
      }
    })();
    return _initPromise;
  }

  /* ── detect ────────────────────────────────────────────────────
     Returns the most-recent pose landmark set, or null if detection
     failed for this frame. The `videoFrameKey` argument is used only
     to skip re-inference on the same frame; if you don't have a
     stable per-frame key, pass `videoEl.currentTime`.

     IMPORTANT: MediaPipe's VIDEO running mode keeps an internal
     monotonic timestamp tracker. If you create a new landmarker and
     immediately feed it a timestamp smaller than the previous run's
     last value, detectForVideo returns empty (silently). We dodge
     that by passing `performance.now()` to MediaPipe — wall clock
     is guaranteed to march forward across video file swaps and
     camera restarts.
   ──────────────────────────────────────────────────────────────── */
  function detect(videoEl, videoFrameKey) {
    if (!_landmarker || !videoEl || videoEl.readyState < 2) return null;
    if (typeof videoFrameKey !== 'number' || !isFinite(videoFrameKey)) videoFrameKey = videoEl.currentTime || 0;
    if (videoFrameKey === _lastFrameKey) return _lastResult;
    _lastFrameKey = videoFrameKey;
    var nowTs = performance.now();
    // Guard against the rare case where two detect() calls land in the
    // same millisecond (rounding) — MediaPipe rejects equal timestamps.
    if (nowTs <= _lastWallTs) nowTs = _lastWallTs + 1;
    _lastWallTs = nowTs;
    try {
      var raw = _landmarker.detectForVideo(videoEl, nowTs);
      if (raw && raw.landmarks && raw.landmarks.length) {
        // L8.6: pick the most shooter-like person from the multi-pose result.
        // Heuristic: the shooter is the person whose HIGHEST wrist is
        // smallest-Y (closest to the top of the frame) — i.e. arm raised
        // highest. Falls back to first pose if all candidates have wrists
        // below shoulders (no one's shooting).
        var picked = raw.landmarks[0];
        if (raw.landmarks.length > 1) {
          var bestScore = -Infinity;
          for (var pi = 0; pi < raw.landmarks.length; pi++) {
            var lm = raw.landmarks[pi];
            if (!lm || lm.length < 25) continue;
            // Highest wrist Y (smallest value, closest to top)
            var lwy = (lm[15] && lm[15].y) || 1;
            var rwy = (lm[16] && lm[16].y) || 1;
            var topWrist = Math.min(lwy, rwy);
            // Weighted by visibility so phantom poses don't win on noise alone
            var lwv = (lm[15] && lm[15].visibility) || 0;
            var rwv = (lm[16] && lm[16].visibility) || 0;
            var topWristVis = lwy < rwy ? lwv : rwv;
            // Score: smaller wristY = better. add small visibility bonus.
            // Negate wristY so larger score wins.
            var score = -topWrist + 0.1 * topWristVis;
            if (score > bestScore) {
              bestScore = score;
              picked = lm;
            }
          }
        }
        _lastResult = { landmarks: picked, ts: videoFrameKey, candidateCount: raw.landmarks.length };
      } else {
        _lastResult = null;
      }
    } catch (e) {
      dlog('[PoseDetector] detectForVideo error:', e && e.message);
      _lastResult = null;
    }
    return _lastResult;
  }

  /* ── reset ────────────────────────────────────────────────────
     Wipes the cached frame key. Call when the underlying video
     element changes (new file uploaded, camera restarted) so the
     next detect() doesn't skip the first frame as a "cache hit".
     We do NOT reset _lastWallTs — that has to keep growing to keep
     MediaPipe's internal timestamp tracker happy.
   ──────────────────────────────────────────────────────────────── */
  function reset() {
    _lastFrameKey = -1;
    _lastResult   = null;
  }

  /* ── Public API ───────────────────────────────────────────── */
  window.PoseDetector = {
    init:                 init,
    detect:               detect,
    detectShootingMotion: detectShootingMotion,
    resetMotion:          resetMotion,
    tune:                 tune,
    isReady:              isReady,
    hasFailed:            hasFailed,
    reset:                reset,
    // Exposed for testing / bench harness — not for production callers
    _extractFeatures:     _extractFeatures
  };
})();
