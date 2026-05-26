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
  var _lastTs      = -1;
  var _lastResult  = null;
  var _failedInit  = false;

  /* ── Config ────────────────────────────────────────────────── */
  var MP_VERSION   = '0.10.14';
  var WASM_BASE    = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION + '/wasm';
  var MODEL_URL    = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  var MP_BRIDGE_WAIT_MS = 10000;  // how long to wait for the ESM bridge in dashboard.html

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
          numPoses: 1
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
     failed for this frame. Caller is responsible for monotonically
     advancing `timestampMs`. Passing the same value twice returns
     the cached result (no re-inference).
   ──────────────────────────────────────────────────────────────── */
  function detect(videoEl, timestampMs) {
    if (!_landmarker || !videoEl || videoEl.readyState < 2) return null;
    if (typeof timestampMs !== 'number' || !isFinite(timestampMs)) return null;
    if (timestampMs === _lastTs) return _lastResult;
    // MediaPipe requires monotonically-increasing timestamps. Going backwards
    // would throw — instead, treat it as "no fresh detection" and let the
    // caller handle gracefully.
    if (timestampMs < _lastTs) return null;
    _lastTs = timestampMs;
    try {
      var raw = _landmarker.detectForVideo(videoEl, timestampMs);
      if (raw && raw.landmarks && raw.landmarks.length) {
        _lastResult = { landmarks: raw.landmarks[0], ts: timestampMs };
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
     Wipes the cached timestamp/result. Call when the underlying
     video element changes (new file uploaded, camera restarted) so
     the next detect() doesn't see a stale "going backwards" guard.
   ──────────────────────────────────────────────────────────────── */
  function reset() {
    _lastTs = -1;
    _lastResult = null;
  }

  /* ── Public API ───────────────────────────────────────────── */
  window.PoseDetector = {
    init:      init,
    detect:    detect,
    isReady:   isReady,
    hasFailed: hasFailed,
    reset:     reset
  };
})();
