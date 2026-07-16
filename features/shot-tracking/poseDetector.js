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

  /* ── One-Euro Filter ─────────────────────────────────────────
     Adaptive low-pass smoothing per landmark coord. Eliminates the
     "jittery skeleton" on iPhone video: stationary joints stop
     vibrating, fast motions still pass through (the cutoff frequency
     rises with measured speed). Reference:
       Casiez et al., "1€ Filter" (CHI 2012)
       https://gery.casiez.net/1euro/
     Default params are the paper's recommended baseline for human
     motion at ~30 Hz video; minCutoff caps how slow the smoother
     gets at rest, beta controls how aggressively it adapts to speed.
   ─────────────────────────────────────────────────────────── */
  function OneEuro(minCutoff, beta, dCutoff) {
    this.minCutoff = minCutoff || 1.0;
    this.beta      = beta      || 0.007;
    this.dCutoff   = dCutoff   || 1.0;
    this.lastVal   = null;
    this.lastDv    = 0;
    this.lastTs    = 0;
  }
  OneEuro.prototype._alpha = function (cutoff, dt) {
    var tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  };
  OneEuro.prototype.filter = function (val, tsMs) {
    if (this.lastVal === null) {
      this.lastVal = val; this.lastDv = 0; this.lastTs = tsMs;
      return val;
    }
    var dt = (tsMs - this.lastTs) / 1000;
    if (dt <= 0 || dt > 1) {        // gap > 1 s — treat as reset
      this.lastVal = val; this.lastDv = 0; this.lastTs = tsMs;
      return val;
    }
    var dv = (val - this.lastVal) / dt;
    var aD = this._alpha(this.dCutoff, dt);
    var edv = aD * dv + (1 - aD) * this.lastDv;
    var cutoff = this.minCutoff + this.beta * Math.abs(edv);
    var a = this._alpha(cutoff, dt);
    var out = a * val + (1 - a) * this.lastVal;
    this.lastVal = out; this.lastDv = edv; this.lastTs = tsMs;
    return out;
  };
  OneEuro.prototype.reset = function () {
    this.lastVal = null; this.lastDv = 0; this.lastTs = 0;
  };

  // 33 landmarks × {x,y} = 66 filters. Cheap (~1µs/landmark).
  var _filtersX = [];
  var _filtersY = [];
  for (var _fi = 0; _fi < 33; _fi++) {
    _filtersX.push(new OneEuro(1.0, 0.007, 1.0));
    _filtersY.push(new OneEuro(1.0, 0.007, 1.0));
  }
  var _lastSmoothTs = 0;

  function smoothLandmarks(landmarks, tsMs) {
    if (!landmarks || !landmarks.length) return landmarks;
    // Reset all filters if gap > 500ms — the pose just re-appeared
    // (e.g. shooter walked out of frame) and we shouldn't lerp.
    if (_lastSmoothTs && tsMs - _lastSmoothTs > 500) {
      for (var i = 0; i < _filtersX.length; i++) {
        _filtersX[i].reset(); _filtersY[i].reset();
      }
    }
    _lastSmoothTs = tsMs;
    var out = new Array(landmarks.length);
    for (var k = 0; k < landmarks.length; k++) {
      var lm = landmarks[k];
      if (!lm) { out[k] = lm; continue; }
      out[k] = {
        x: _filtersX[k].filter(lm.x, tsMs),
        y: _filtersY[k].filter(lm.y, tsMs),
        z: lm.z,
        visibility: lm.visibility
      };
    }
    return out;
  }

  /* ── State ─────────────────────────────────────────────────── */
  var _landmarker  = null;
  var _initPromise = null;
  var _lastFrameKey = -1;        // cache key — caller's per-frame identifier
  var _lastWallTs   = 0;         // last wall-clock timestamp sent to MediaPipe
  var _lastResult  = null;
  var _failedInit  = false;

  /* ── Config ────────────────────────────────────────────────── */
  var MP_VERSION   = '0.10.14';

  // Bundled MediaPipe assets live at <repo root>/vendor/mediapipe, two levels
  // above this script. Resolve against document.currentScript.src (same
  // rationale as SCRIPT_BASE in shotDetection.js) so the path works from any
  // page depth. Empty string = resolution failed → CDN-only.
  var SCRIPT_BASE = '';
  try {
    var _psrc = document.currentScript && document.currentScript.src;
    if (_psrc) SCRIPT_BASE = new URL('../../', _psrc).href;
  } catch (e) { /* keep '' */ }

  // Local-first (offline courts, no CDN dependency); CDN kept as fallback.
  // NOTE: only the SIMD wasm is bundled (all ~2020+ devices have wasm SIMD);
  // a rare non-SIMD device throws in FilesetResolver and lands on the CDN.
  var LOCAL_WASM_BASE = SCRIPT_BASE ? SCRIPT_BASE + 'vendor/mediapipe/wasm' : null;
  var LOCAL_MODEL_URL = SCRIPT_BASE ? SCRIPT_BASE + 'vendor/mediapipe/pose_landmarker_full.task' : null;
  var WASM_BASE    = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION + '/wasm';
  // L37.5 (pose recovery): Lite → Full. The L8.7 reason for switching to
  // Lite ("delay following the player") was an inference-cost problem at
  // a time pose ran on every frame; the loop is now throttled to 33ms
  // cadence with a shared per-frame inference cache and no rAF doubling.
  // Per the post-L36.6 audit, pose is now ONLY a trigger — L31/L33
  // decoupled it from MADE/MISS counting entirely, so accuracy AT THE
  // TRIGGER MOMENT is the only thing that matters. Lite's jitter on
  // distance shots, fadeaways, and partial occlusion was producing both
  // false positives (dribble + hand-near-head = "shot") and false
  // negatives (step-back, layup, sideways release). Full keeps the same
  // 33-LM schema, so the entire heuristic survives unchanged; visibility
  // floor in detectShootingMotion is raised below now that the model is
  // confident enough to rely on it. Trade-off: ~2-3× inference cost on
  // iPhone, acceptable since pose no longer drives counting.
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
    // Phase 9p: reverted to the balanced p9m settings. Very-loose gates
    // (armMin=0.30, tol=0.08, visibility=0.08) caused MORE false-early
    // triggers on non-shot arm swings, which then blocked subsequent
    // pose triggers for the real shot. Net recall DROPPED from 4→2.
    visibilityMin:     0.15,
    // p9x: 0.50 → 0.42. "arm-not-extended" was the single biggest reject
    // reason (33/111 frames on the Dr.Dish clip). A fast catch-and-shoot
    // release from distance peaks with the arm ~85% extended, not fully
    // straight, so 0.50 rejected the release frame of real shots. Safe to
    // loosen now that the pose loop samples at ~14-22 Hz (p9u) instead of
    // the old 3.8 Hz — the extra samples mean the genuine peak frame is
    // almost always seen, so a slightly looser gate adds real shots
    // without inviting the mid-dribble false triggers that a loose gate
    // caused at the old sparse sample rate.
    armExtensionMin:   0.42,
    belowLookbackMs:   150,
    peakWindowMs:      350,
    peakToleranceNorm: 0.04,
    cooldownMs:        400,
    historyMs:         1500,   // how much pose history to retain
    setpointLookbackMs: 700,   // L23: how far back to look for "wrist was
                               // below shoulder" when validating a set-point
                               // (hand-at-head) trigger. Generous to catch
                               // slow drawback shots, but the cooldown still
                               // prevents back-to-back triggers.
    // L8 tuning knob (default 0 = original strict behavior):
    //   wristAboveNose normally requires wrist.y < nose.y. At distance, Pose
    //   Lite is jittery and shooters with a "set shot" form may peak with
    //   wrist at forehead/eye level rather than fully above the nose. Adding
    //   slack relaxes the gate to wrist.y < nose.y + noseSlackNorm.
    //   noseSlackNorm: 0.05 ≈ 5% of frame height (~54px on 1080p).
    //   L15: bumped default 0.0 → 0.08 because fast pull-up release shots
    //   often peak with wrist at eye/forehead level, not fully above nose.
    noseSlackNorm:     0.13    // p9x: 0.08 → 0.13. "wrist-not-above-nose"
                               // was the 2nd-biggest reject (28/111). A set
                               // shot / quick pull-up from distance peaks
                               // with the wrist at forehead-to-eye level,
                               // ~0.10-0.13 of frame height below the nose
                               // landmark. 0.13 catches those without
                               // accepting a hand merely raised to the chest
                               // (which sits ≥0.20 below the nose).
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
      // p9v: MIN of the three joint visibilities, not the PRODUCT.
      // The product structurally under-reports: three legitimate 0.5
      // detections multiply to 0.125, below the 0.15 visibilityMin gate,
      // so a clearly-visible distant shooter was rejected as
      // "low-visibility" on ~⅓ of frames (36/111 measured on the
      // Dr.Dish clip). The three joints are on ONE arm — if the wrist is
      // visible the elbow/shoulder almost always are too, so the product
      // punishes redundantly. MIN asks the honest question ("is the
      // least-visible joint of the arm still visible enough?") and the
      // outer quality gate (visEnough ≥0.30 on each joint) already blocks
      // hallucinated skeletons upstream.
      visibility:         Math.min(
                            (wrist.visibility    || 0),
                            (elbow.visibility    || 0),
                            (shoulder.visibility || 0)
                          ),
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
    // L20: was samplesChecked >= 2 — fast/quick-release shots produce only
    // ONE prior sample within peakWindowMs and were being silently rejected
    // as "not-at-peak". Require ≥1 prior sample instead.
    var isPeak = samplesChecked >= 1 && Math.abs(f.wristY - recentMinY) < TUNE.peakToleranceNorm;
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

  /* ── L23: detectSetPointMotion — "hands-at-head" trigger ────────
     Universal basketball set-point heuristic. Every shot has a moment
     where one or both hands are at head/forehead level immediately
     before release — regardless of whether it's a jumper, step-back,
     fadeaway, hook, or fast pull-up. This is far more reliable than
     the strict peak detection in detectShootingMotion which depends on
     a precise wrist-Y minimum within a 350ms window.

     The check:
       (a) cooldown OK
       (b) at least one wrist is within HEAD region (distance to nose
           ≤ 0.5 × shoulder-to-shoulder span, or a sane fallback)
       (c) that wrist was BELOW shoulder within last setpointLookbackMs
           — i.e. we just saw the hand rise up to the head, not just
           a static "hand resting on head" pose
       (d) visibility on the relevant joints OK

     Used as a SECONDARY trigger in _pollPoseShot, only if the strict
     detectShootingMotion didn't fire on this frame. So we never
     downgrade strong-confidence triggers.
   ──────────────────────────────────────────────────────────────── */
  function detectSetPointMotion(lm, tsMs) {
    if (!lm || lm.length < 25) return { isShot: false, reason: 'no-features' };
    if (tsMs - _lastShotReleaseTs < TUNE.cooldownMs) return { isShot: false, reason: 'cooldown' };

    var nose = lm[L.NOSE];
    var lsh = lm[L.LSH], rsh = lm[L.RSH];
    var lw  = lm[L.LWR], rw  = lm[L.RWR];
    if (!nose || !lsh || !rsh || !lw || !rw) return { isShot: false, reason: 'missing-landmarks' };

    // Visibility — head + at least one wrist.
    // L30: floors raised 0.30/0.20 → 0.50/0.50. The set-point heuristic has
    // no other confidence gate and was firing on hallucinated poses with
    // visibility products as low as 0.03 (phantom shot_started triggers in
    // verified-empty footage spans). MediaPipe emits 33 landmarks even on
    // an empty court; real shooters at sane framing score well above 0.5.
    var noseVis = nose.visibility || 0;
    var lwVis = lw.visibility || 0;
    var rwVis = rw.visibility || 0;
    if (noseVis < 0.50) return { isShot: false, reason: 'nose-not-visible' };
    if (Math.max(lwVis, rwVis) < 0.50) return { isShot: false, reason: 'wrists-not-visible' };

    // Head region radius — scaled to shoulder-to-shoulder span so it
    // adapts to distance/zoom. Fallback if shoulders look degenerate.
    var shoulderSpan = Math.hypot(lsh.x - rsh.x, lsh.y - rsh.y);
    var headRadius = Math.max(0.06, Math.min(0.20, shoulderSpan * 0.6));

    // Check each wrist against the head region. Use BOTH X and Y proximity.
    var leftDist  = Math.hypot(lw.x - nose.x, lw.y - nose.y);
    var rightDist = Math.hypot(rw.x - nose.x, rw.y - nose.y);
    var leftInHead  = leftDist  <= headRadius;
    var rightInHead = rightDist <= headRadius;
    if (!leftInHead && !rightInHead) return { isShot: false, reason: 'no-wrist-at-head' };

    // Pick the shooting wrist — the one at the head, with better visibility
    var useLeft;
    if (leftInHead && !rightInHead)      useLeft = true;
    else if (rightInHead && !leftInHead) useLeft = false;
    else                                  useLeft = lwVis >= rwVis;
    var wrist = useLeft ? lw : rw;
    var wristVis = useLeft ? lwVis : rwVis;
    var shoulder = useLeft ? lsh : rsh;
    var shootingHand = useLeft ? 'L' : 'R';

    // Confirm this is a SHOT not a static hand-on-head: the same wrist
    // must have been below shoulder within the last setpointLookbackMs.
    var lookbackMs = TUNE.setpointLookbackMs || 700;
    var startedBelow = false;
    for (var i = 0; i < _history.length - 1; i++) {
      var h = _history[i];
      if (tsMs - h.ts < lookbackMs && tsMs - h.ts >= 50 && !h.wristAboveShoulder) {
        startedBelow = true;
        break;
      }
    }
    if (!startedBelow) return { isShot: false, reason: 'setpoint-no-prior-low' };

    // L30: combined-confidence floor — belt and braces over the per-joint
    // floors above. A set-point trigger this weak is noise, not a shot.
    var spConfidence = Math.min(1, wristVis * (noseVis || 0.5) * 1.3);
    if (spConfidence < 0.30) return { isShot: false, reason: 'setpoint-low-confidence' };

    _lastShotReleaseTs = tsMs;
    var hipCenterX = (lm[L.LHIP].x + lm[L.RHIP].x) * 0.5;
    var hipCenterY = (lm[L.LHIP].y + lm[L.RHIP].y) * 0.5;
    return {
      isShot: true,
      releaseTs:         tsMs,
      releaseConfidence: spConfidence,
      shooterCenterX:    hipCenterX,
      shooterCenterY:    hipCenterY,
      shootingHand:      shootingHand,
      wristY:            wrist.y,
      detector:          'setpoint'
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
        var mkLandmarker = async function (wasmBase, modelUrl) {
          var resolver = await MP.FilesetResolver.forVisionTasks(wasmBase);
          return MP.PoseLandmarker.createFromOptions(resolver, {
            baseOptions: {
              modelAssetPath: modelUrl,
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
        };
        // Bundle first (offline / no-CDN), network CDN as fallback.
        if (LOCAL_WASM_BASE && LOCAL_MODEL_URL) {
          try {
            _landmarker = await mkLandmarker(LOCAL_WASM_BASE, LOCAL_MODEL_URL);
          } catch (localErr) {
            console.warn('[PoseDetector] bundled assets failed (' +
              (localErr && localErr.message) + ') — falling back to CDN');
          }
        }
        if (!_landmarker) {
          _landmarker = await mkLandmarker(WASM_BASE, MODEL_URL);
        }
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
        // One-Euro smoothing pass — kills MediaPipe jitter without
        // sacrificing responsiveness to fast shooting motion. The
        // shooting-motion heuristic (detectShootingMotion) and the
        // canvas pose-skeleton overlay both consume this same output,
        // so the visible skeleton AND the wrist-velocity calculation
        // benefit from one shared smoothing pass.
        var smoothed = smoothLandmarks(picked, nowTs);
        _lastResult = { landmarks: smoothed, ts: videoFrameKey, candidateCount: raw.landmarks.length };
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
    detectSetPointMotion: detectSetPointMotion,
    resetMotion:          resetMotion,
    tune:                 tune,
    isReady:              isReady,
    hasFailed:            hasFailed,
    reset:                reset,
    // Exposed for testing / bench harness — not for production callers
    _extractFeatures:     _extractFeatures
  };
})();
