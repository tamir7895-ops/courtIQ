/* ══════════════════════════════════════════════════════════════
   SHOT DETECTION — ML + Color Fallback Ball Detection
   + Centroid Tracker + Shot Result Analysis

   v10 — Custom YOLOX-tiny v6 (Apache 2.0) trained on basketball dataset.
        2 classes: Basketball (0), Basketball Hoop (1).
        Input: 640x640. Output: [1, 8400, 7] = [cx, cy, w, h, objectness, ball_score, hoop_score]
        Best AP@0.5 = 0.885, AP@0.5:0.95 = 0.548 (30 epochs, phase3_human exp)
        YOLOX runs every 3rd frame. Color detection every frame as fallback.

   Runs entirely in-browser using:
     - ONNX Runtime Web (WASM backend) + YOLOX-tiny (custom trained, 20 MB)
     - Canvas color analysis (always available)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Debug flag ─────────────────────────────────────────────────
     Gate verbose console.log spam behind a flag. Errors and warnings
     are not gated — those signal real production issues. Override at
     runtime: window.ShotDetectionDebug = true; (then reload).
     ──────────────────────────────────────────────────────────────── */
  var DEBUG = (typeof window !== 'undefined' && window.ShotDetectionDebug === true);
  function dlog() {
    if (!DEBUG) return;
    console.log.apply(console, arguments);
  }

  /* ── Script-relative base URL ───────────────────────────────────
     Assets (model, preprocessing worker) live relative to the REPO
     ROOT, two levels above this script. Resolving against
     document.currentScript.src instead of the page URL keeps fetches
     working on pages served from sub-paths (debug harnesses, deep
     links) — a page-relative path 404s there and silently dumps the
     engine into color-only mode. Empty string = legacy page-relative
     fallback. */
  var SCRIPT_BASE = '';
  try {
    var _scriptSrc = document.currentScript && document.currentScript.src;
    if (_scriptSrc) SCRIPT_BASE = new URL('../../', _scriptSrc).href;
  } catch (e) { /* keep '' */ }

  /* ── Constants ──────────────────────────────────────────────── */
  var DEBOUNCE_MS          = 400;   // L14.A: was 700 — matches looser pose cooldown
  var MIN_TRAJECTORY_PTS   = 3;    // Fewer points needed before analyzing
  var MAX_HISTORY          = 50;   // Larger rolling buffer
  var MAX_GAP_FRAMES       = 24;   // Grace frames for ball vanishing (ball in air ~0.8s = ~24 frames)
  var MIN_MOVEMENT_PX      = 2;    // Lower jitter threshold
  var BALL_CONFIDENCE      = 0.05;  // Raised threshold — 0.005 was too low, tracked players
  var MADE_MAX_FRAMES      = 22;   // More frames allowed for rim transit
  var DETECTION_INTERVAL   = 33;   // ~30 FPS color detection (YOLOX runs async every 6th frame)
  // YOLOX cadence is hardcoded as `_frameCount % 6 === 0` below. 6 was picked as a
  // safe floor for low-end devices on the WASM backend (~5 inferences/sec). On WebGPU
  // we have headroom for every-3rd or every-4th frame; consider auto-tuning the
  // divisor based on observed inference latency once we see real-device numbers.

  /* ── YOLOX-tiny constants (custom 3-class model: v6_polished) ──
     Output shape is [1, 8400, 8] — every detection row carries:
       [0..3]  box (cx, cy, w, h) in 640x640 pixel space
       [4]     objectness score
       [5]     ball score
       [6]     hoop score
       [7]     player score
     The 2-class v71 model had stride=7; v6_polished is 8. */
  var YOLOX_INPUT_SIZE     = 640;
  var YOLOX_NUM_CLASSES    = 3;
  var YOLOX_BALL_CLASS     = 0;    // Basketball
  var YOLOX_HOOP_CLASS     = 1;    // Basketball Hoop
  var YOLOX_PLAYER_CLASS   = 2;    // Player (NEW in v6_polished)
  var YOLOX_STRIDE         = 8;    // 4 (box) + 1 (objectness) + 3 (classes)

  // Pre-allocated buffers for ONNX inference (avoid GC)
  var _yoloxBuf    = null;
  var _yoloxCanvas = null;
  var _yoloxCtx    = null;

  // Web Worker for CHW preprocessing (offloads ~520K array writes from main thread)
  var _chwWorker   = null;
  try {
    _chwWorker = new Worker(SCRIPT_BASE + 'features/shot-tracking/yoloxWorker.js');
  } catch (e) {
    console.warn('[ShotDetection] Web Worker unavailable, using main thread CHW');
  }

  /* Area thresholds as fractions of total frame area */
  var BALL_MIN_AREA_FRAC   = 0.00005;  // Very small — distant shots
  var BALL_MAX_AREA_FRAC   = 0.18;     // Very large — close-up shots

  /* Color detection constants */
  var COLOR_SCAN_STEP      = 4;    // Pixel step for color scanning (performance)
  var COLOR_MIN_PIXELS     = 12;   // Minimum orange pixels to count as ball
  var COLOR_MAX_PIXELS     = 8000; // Maximum (too large = not a ball)

  /* ── 2D Kalman Filter (position + velocity) ─────────────────── */
  /* State: [x, y, vx, vy]  —  constant-velocity model with gravity */
  var KALMAN_PROCESS_NOISE = 0.5;   // How much we trust the physics model
  var KALMAN_MEASURE_NOISE = 3.0;   // How noisy the detections are (pixels)
  var KALMAN_GRAVITY       = 0.6;   // Gravity pull per frame (0.4 was too weak, ball stalled mid-flight)
  var KALMAN_MAX_PREDICT   = 60;    // Max frames to predict (~2s at 30fps — covers long 3-pointers)

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
    // Update velocity from position correction (clamped to prevent jitter explosions)
    kf.vx = Math.max(-100, Math.min(100, kf.vx + ix * 0.3));
    kf.vy = Math.max(-120, Math.min(120, kf.vy + iy * 0.3));
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
      // Extended window during active shot (RISING/FALLING) via _activeShot flag
      var maxPredict = tracker._activeShotExtend ? Math.floor(KALMAN_MAX_PREDICT * 1.5) : KALMAN_MAX_PREDICT;
      // L31: stop predicting once the ghost leaves the frame (10% slack).
      // Eval logs showed the constant-velocity ghost sailing to x = 4.4×
      // frame width over several seconds, feeding the UI and bloating the
      // position buffer with fiction.
      var ghostInFrame = true;
      if (tracker._vw > 0 && tracker._vh > 0) {
        ghostInFrame = kf.x >= -tracker._vw * 0.1 && kf.x <= tracker._vw * 1.1 &&
                       kf.y >= -tracker._vh * 0.3 && kf.y <= tracker._vh * 1.1;
      }
      if (kf.initialized && kf.predictCount < maxPredict && ghostInFrame) {
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

  /* ── Time-based rising detector ───────────────────────────────
     Returns true if the ball rose (Y decreased) by at least
     `minDeltaNorm` of the frame height across any window ending
     "now" with span up to `windowMs`. Cadence-agnostic — works
     whether YOLOX runs at 30 Hz, 5 Hz, or 1 Hz.
   ──────────────────────────────────────────────────────────── */
  function ballRoseInWindow(tracker, vh, windowMs, minDeltaNorm) {
    var pts = tracker.positions;
    if (!pts || pts.length < 2) return false;
    var now = Date.now();
    // L30: only MEASURED detections count as motion evidence. Kalman-
    // PREDICTED ghosts (pure physics, no pixels) used to satisfy this
    // trigger — one fired with the "ball" above the frame (normY=-0.07).
    var newestIdx = -1;
    for (var n = pts.length - 1; n >= 0; n--) {
      if (!pts[n].predicted) { newestIdx = n; break; }
    }
    if (newestIdx < 1) return false;
    var newest = pts[newestIdx];
    if (now - newest.ts > windowMs) return false;  // last real sighting is stale
    var oldest = null;
    for (var i = newestIdx - 1; i >= 0; i--) {
      if (now - pts[i].ts > windowMs) break;
      if (pts[i].predicted) continue;
      oldest = pts[i];
    }
    if (!oldest) return false;
    var deltaPx = oldest.y - newest.y;          // positive when ball moved up
    var deltaNorm = deltaPx / (vh || 720);
    return deltaNorm >= minDeltaNorm;
  }

  /* ── L37.6: Parabolic trajectory predictor (avishah3-style + HomeCourt)
     ───────────────────────────────────────────────────────────────────
     Fits y = ax² + bx + c through the (normalized) ball trajectory and
     predicts the X coordinate where the descending branch crosses rim_y.
     Returns null if too few points, degenerate fit, or no real crossing.

     Why this, why now: the post-L36.6 audit found every counting path
     gated on `_ballThroughRimAt`, set ONLY when YOLO observes the ball
     both above AND below the rim within 1.5s. On compressed iPhone
     footage YOLO drops most mid-air frames, so the through-rim flag
     rarely fires and counting stops working. The competitors we
     surveyed (HomeCourt patent, avishah3 95% repo) do not require this:
     they fit a curve through whatever points they have and EXTRAPOLATE
     to the rim plane. A parabolic fit needs only 3 measured ball points
     anywhere in the arc — not a continuous track, not the crossing
     frame, just enough to define a curve.
  ──────────────────────────────────────────────────────────────────── */
  function fitParabolaThroughTrajectory(trajectory) {
    if (!trajectory || trajectory.length < 3) return null;
    var n = trajectory.length;
    // Phase 9i: CENTER x around the mean before solving. Uncentered
    // Cramer solves with x in [0..1] were producing wildly unstable
    // coefficients (observed a-values of 10^10 and R²'s of −10^11)
    // because 3×3 determinants of powers of small floats amplify
    // roundoff catastrophically. Centering keeps the mean-x term = 0,
    // wiping out entire off-diagonal blocks and giving a well-
    // conditioned normal-equation system.
    var mx = 0;
    for (var mi = 0; mi < n; mi++) mx += trajectory[mi].x;
    mx = mx / n;

    var sx = 0, sx2 = 0, sx3 = 0, sx4 = 0;
    var sy = 0, sxy = 0, sx2y = 0;
    for (var i = 0; i < n; i++) {
      var x  = trajectory[i].x - mx;   // centered
      var y  = trajectory[i].y;
      var x2 = x * x;
      sx  += x;   sx2 += x2;  sx3 += x2 * x;  sx4 += x2 * x2;
      sy  += y;   sxy += x * y;  sx2y += x2 * y;
    }
    // With centered x, sx ≈ 0 exactly, so the system is much simpler:
    //   [ sx4 sx3 sx2 ] [ac]   [ sx2y ]
    //   [ sx3 sx2 0   ] [bc] = [ sxy  ]
    //   [ sx2 0   n   ] [cc]   [ sy   ]
    // (a_c, b_c, c_c) are the CENTERED coefficients:
    //   y = a_c*(x-mx)² + b_c*(x-mx) + c_c
    // Solve by 3×3 Cramer determinants (stable now that entries are small).
    var d  = sx4 * (sx2 * n  - sx  * sx ) -
             sx3 * (sx3 * n  - sx  * sx2) +
             sx2 * (sx3 * sx - sx2 * sx2);
    if (Math.abs(d) < 1e-12) return null;
    var da = sx2y * (sx2 * n  - sx  * sx ) -
             sx3  * (sxy * n  - sx  * sy ) +
             sx2  * (sxy * sx - sx2 * sy );
    var db = sx4  * (sxy * n  - sx  * sy ) -
             sx2y * (sx3 * n  - sx  * sx2) +
             sx2  * (sx3 * sy - sxy * sx2);
    var dc = sx4  * (sx2 * sy - sx  * sxy ) -
             sx3  * (sx3 * sy - sx  * sx2y) +
             sx2y * (sx3 * sx - sx2 * sx2 );
    // Expand back to uncentered: y = a*x² + b*x + c
    //   a = a_c
    //   b = b_c - 2*a_c*mx
    //   c = c_c - b_c*mx + a_c*mx²
    var ac = da / d, bc = db / d, cc = dc / d;
    var a = ac;
    var b = bc - 2 * ac * mx;
    var c = cc - bc * mx + ac * mx * mx;
    return { a: a, b: b, c: c, n: n };
  }

  /* Given parabola coefficients (y = ax² + bx + c) and a target rim Y,
     return the X where the DESCENDING branch crosses target Y, or null
     if no real solution. "Descending" = closer to the last observed
     ball X — basketball can be shot in either horizontal direction, so
     "later x" is not stable; "closer to last sample" is. */
  function predictRimCrossingX(coeffs, targetY, lastObservedX) {
    if (!coeffs) return null;
    var a = coeffs.a, b = coeffs.b, c = coeffs.c - targetY;
    if (Math.abs(a) < 1e-9) {
      if (Math.abs(b) < 1e-9) return null;
      return -c / b;                              // degenerate to line
    }
    var disc = b * b - 4 * a * c;
    if (disc < 0) return null;                    // arc never reaches rim_y
    var sq = Math.sqrt(disc);
    var x1 = (-b - sq) / (2 * a);
    var x2 = (-b + sq) / (2 * a);
    if (lastObservedX == null) return Math.max(x1, x2);
    return Math.abs(x1 - lastObservedX) < Math.abs(x2 - lastObservedX) ? x1 : x2;
  }

  /* High-level helper: run the predictor on a live shot's trajectory and
     return a MADE/MISS verdict — or null if data is insufficient or
     trajectory shape doesn't match a real shot arc. Filters predicted
     (Kalman) points and applies four sanity gates:

       1. ≥ 3 measured points
       2. parabola opens UPWARD in screen coords (a > 0 — basketball arcs
          have a low-point Y at the peak in screen-y, so the fitted
          quadratic ascends on both sides of its vertex)
       3. X span ≥ 0.05 of frame width (not a stationary cluster)
       4. Time span ≥ 300 ms (not a single-burst detection)
       5. R² ≥ 0.4 (the fit actually describes the data, not random
          points happening to draw a curve)

     This is the keystone of Phase 5 — when these gates pass, the
     geometric verdict overrides the motion-based "MADE on any spike"
     path. When they fail, callers fall back to the motion verdict.
     Tolerance = rim.width × 0.45 (avishah3 used 0.4 rim_w; +0.05 for
     our slightly looser bbox). */
  function polyfitVerdict(trajectory, rim, opts) {
    if (!trajectory || !rim) return null;
    var measured = [];
    for (var i = 0; i < trajectory.length; i++) {
      if (!trajectory[i] || trajectory[i].predicted) continue;
      measured.push(trajectory[i]);
    }
    if (measured.length < 3) { try { console.log('[polyfit] REJECT: <3 measured points (' + measured.length + ')'); } catch(e){} return null; }

    var minX = Infinity, maxX = -Infinity, minT = Infinity, maxT = -Infinity;
    for (var m = 0; m < measured.length; m++) {
      if (measured[m].x < minX) minX = measured[m].x;
      if (measured[m].x > maxX) maxX = measured[m].x;
      var t = measured[m].t || 0;
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }
    var xSpan = maxX - minX;
    var tSpan = maxT - minT;
    // Phase 9h: loosened gates. Real shot trajectories with fast YOLO
    // drops can have very small X span (release+arc largely vertical),
    // and short arcs at high frame drop can be under 300 ms.
    if (xSpan < 0.02) { try { console.log('[polyfit] REJECT: xSpan ' + xSpan.toFixed(3) + ' < 0.02'); } catch(e){} return null; }
    if (tSpan < 150)  { try { console.log('[polyfit] REJECT: tSpan ' + tSpan + ' < 150'); } catch(e){} return null; }

    var coeffs = fitParabolaThroughTrajectory(measured);
    if (!coeffs) { try { console.log('[polyfit] REJECT: fitParabola null'); } catch(e){} return null; }
    // Phase 9h: was `> 0.5` — far too strict. A wide, gently-curving
    // arc has a much smaller `a`. Just require a > 0 so we know the
    // parabola opens the right way in screen coords.
    if (!(coeffs.a > 0)) { try { console.log('[polyfit] REJECT: a=' + coeffs.a.toFixed(3) + ' (arc not upward)'); } catch(e){} return null; }

    // R² — how well the parabola explains the data. Low R² = points are
    // not really on an arc; they're scattered. We don't want to declare
    // MADE/MISS from a verdict that's effectively a random number.
    var meanY = 0;
    for (var my = 0; my < measured.length; my++) meanY += measured[my].y;
    meanY /= measured.length;
    var ssTot = 0, ssRes = 0;
    for (var rs = 0; rs < measured.length; rs++) {
      var xi = measured[rs].x, yi = measured[rs].y;
      var yPred = coeffs.a * xi * xi + coeffs.b * xi + coeffs.c;
      ssTot += (yi - meanY) * (yi - meanY);
      ssRes += (yi - yPred) * (yi - yPred);
    }
    // Phase 9k: reject if y-values are essentially constant. When
    // ssTot is tiny, r² becomes wildly unstable (any small residual
    // divides by ~0 → ±∞). A trajectory with no y-variation isn't a
    // basketball arc anyway, so bail here.
    if (ssTot < 1e-4) { try { console.log('[polyfit] REJECT: flat y (ssTot=' + ssTot.toExponential(2) + ')'); } catch(e){} return null; }
    var r2 = 1 - ssRes / ssTot;
    // Phase 9k: only reject FRANKLY bad fits. r² > -1.0 lets through
    // trajectories where the parabola isn't much better than a flat
    // line but is still coherent. We rely on a > 0 (arc opens correctly)
    // + xSpan gate + tSpan gate as the structural sanity checks; r²
    // now just kills catastrophically wrong fits.
    if (r2 < -1.0) { try { console.log('[polyfit] REJECT: r2=' + r2.toFixed(3) + ' < -1.0'); } catch(e){} return null; }

    var lastX = measured[measured.length - 1].x;
    var xAtRim = predictRimCrossingX(coeffs, rim.centerY, lastX);
    if (xAtRim == null || isNaN(xAtRim)) return null;
    var tol = (rim.width != null ? rim.width : 0.10) * 0.45;
    if (opts && opts.tolerance != null) tol = opts.tolerance;
    var dx = Math.abs(xAtRim - rim.centerX);
    return {
      result:    dx <= tol ? 'made' : 'missed',
      xAtRim:    xAtRim,
      dxFromRim: dx,
      tolerance: tol,
      arcA:      coeffs.a,
      r2:        r2,
      xSpan:     xSpan,
      tSpan:     tSpan,
      points:    measured.length
    };
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

  /* ── V10: fine-grained 9-zone classifier ────────────────────────
     For the v10 mini-court — splits the half-court into:
       lc / rc — left/right corner 3
       lw / rw — left/right wing 3
       top     — top of key 3 (straight on)
       ml / mr — left/right mid-range (inside arc)
       topmid  — center mid-range (foul-line extended)
       pnt     — paint
     fx, fy are normalised feet-on-court (0..1) in the FULL video frame
     coord system (same space as rim.centerX/Y). Designed for cameras
     placed behind the rim looking at the player, where the player's
     screen-X corresponds to court-horizontal and screen-Y corresponds
     to depth-from-baseline. */
  function classifyV10Zone(fx, fy, rim, threePtDist) {
    if (!rim || fx == null || fy == null) return 'top';
    var dx = fx - rim.centerX;
    var dy = Math.max(0, fy - rim.centerY);
    var absDx = Math.abs(dx);
    var dist = Math.sqrt(dx * dx + dy * dy);
    var t3 = (threePtDist && threePtDist > 0) ? threePtDist : 0.32;

    // Paint: tight column under the rim, within paint depth
    if (absDx < 0.09 && dy < t3 * 0.55) return 'pnt';

    var inside3pt = dist < t3 * 0.96;
    if (inside3pt) {
      if (absDx > 0.12) return dx < 0 ? 'ml' : 'mr';
      return 'topmid';
    }
    // Beyond the arc — pick corner / wing / top sector by depth + side
    if (dy < t3 * 0.45) return dx < 0 ? 'lc' : 'rc';
    if (absDx > t3 * 0.62) return dx < 0 ? 'lw' : 'rw';
    return 'top';
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
        if (r > 120 && g > 40 && g < 180 && b < 100 && r > g * 1.15 && r > b * 1.6) {
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

    // Cluster compactness: w/h ratio between 0.5-2.0 rejects elongated shapes (arms/legs)
    var whRatio = blobW / (blobH || 1);
    if (whRatio < 0.5 || whRatio > 2.0) return null;

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
    onDebugFrame: null,     // callback({ balls: [], hoops: [], shotState, kalman, frameCount })
    _isDetecting: false,
    _colorOnlyMode: false,
    _mlMissCount: 0,
    _frameCount: 0,
    _detectorType: 'none',   // 'yolox' | 'none'
    _procW: 0,
    _procH: 0,
    _shotState: 'idle',      // idle | shot_started | near_hoop | cooldown
    _shotStateTime: 0,       // timestamp when current state started
    _ballMinY: 1.0,          // lowest Y (highest point) seen during current shot arc
    _shotStartY: 1.0,        // Y position when shot arc started (for min arc height check)
    _sawBallAboveRim: false, // sticky flag: was ball ever above rim during this shot?
    _rimStabilized: false,   // gate: state machine ignores rim until screen flips this on
    _shotTriggerSrc: null,   // 'pose' | 'ball' — what fired the current shot_started
    _releaseConfidence: null,// 0-1, only meaningful when _shotTriggerSrc === 'pose'
    _shooterFeetX: null,     // normalized x of shooter hip centroid at release (pose-only)
    _shooterFeetY: null,     // normalized y of shooter hip centroid at release (pose-only)

    init: function () {
      var self = this;
      self.tracker = createTracker();
      self._colorOnlyMode = false;
      self._mlMissCount = 0;
      self._frameCount = 0;
      self._detectorType = 'none';

      // Create internal canvas for color detection
      if (!self._canvas) {
        self._canvas = document.createElement('canvas');
        self._ctx = self._canvas.getContext('2d', { willReadFrequently: true });
      }

      // Kick off PoseDetector load IN PARALLEL with YOLOX. The legacy code
      // started Pose only inside the YOLOX-success branch of _tryLoadModel,
      // which meant the color-only fallback never got pose at all (and
      // therefore never drew the pose skeleton). Pose is independent of
      // YOLOX — it has its own MediaPipe worker — so we always fire it on
      // init / preload. Dedupe is handled inside PoseDetector.init().
      if (window.PoseDetector && typeof window.PoseDetector.init === 'function' &&
          !self._posePreloadStarted) {
        self._posePreloadStarted = true;
        try {
          window.PoseDetector.init().then(function () {
            dlog('[ShotDetection] PoseDetector ready');
          }).catch(function (poseErr) {
            console.warn('[ShotDetection] PoseDetector init failed:', poseErr && poseErr.message);
          });
        } catch (e) { /* never let pose init crash the engine */ }
      }

      if (self.model) {
        self._detectorType = 'yolox';
        return Promise.resolve(true);
      }

      // L34: dedupe concurrent loads. The screen now calls init() once on
      // OPEN (to preload the model while the user grants camera / picks a
      // video / the rim calibrates) and AGAIN on tracking start. Without
      // this guard the second call would kick off a second
      // InferenceSession.create on the still-loading model. Both callers
      // share one in-flight promise; once resolved, the self.model branch
      // above short-circuits future calls.
      if (self._modelLoadPromise) return self._modelLoadPromise;

      self._setStatus('loading');

      self._modelLoadPromise = new Promise(function (resolve) {
        self._tryLoadModel(resolve);
      });
      return self._modelLoadPromise;
    },

    // L34: kick off model loading WITHOUT the per-session resets in init()
    // (those would wipe a tracker mid-session). Safe to call repeatedly —
    // it just ensures the heavy ONNX + WASM/WebGPU warmup overlaps with
    // the user's setup time instead of blocking the first shots. The
    // returned promise resolves true when the detector (or color fallback)
    // is ready.
    preloadModel: function () {
      var self = this;
      // Start PoseDetector load alongside the YOLOX preload — the
      // openScreen() preload path used to skip pose entirely, so on first
      // session pose only began loading AFTER YOLOX finished (a few seconds
      // late). Now they run in parallel.
      if (window.PoseDetector && typeof window.PoseDetector.init === 'function' &&
          !self._posePreloadStarted) {
        self._posePreloadStarted = true;
        try {
          window.PoseDetector.init().then(function () {
            dlog('[ShotDetection] PoseDetector preloaded');
          }).catch(function (poseErr) {
            console.warn('[ShotDetection] PoseDetector preload failed:', poseErr && poseErr.message);
          });
        } catch (e) { /* never let pose init crash the engine */ }
      }
      if (self.model) return Promise.resolve(true);
      if (self._modelLoadPromise) return self._modelLoadPromise;
      if (!self._canvas) {
        self._canvas = document.createElement('canvas');
        self._ctx = self._canvas.getContext('2d', { willReadFrequently: true });
      }
      if (typeof ort === 'undefined') {
        // ORT script hasn't parsed yet — retry shortly; the deferred
        // <script> usually lands within a few hundred ms of screen open.
        if (!self._preloadRetries) self._preloadRetries = 0;
        if (self._preloadRetries < 20) {
          self._preloadRetries++;
          setTimeout(function () { self.preloadModel(); }, 300);
        }
        return Promise.resolve(false);
      }
      self._setStatus('loading');
      self._modelLoadPromise = new Promise(function (resolve) {
        self._tryLoadModel(resolve);
      });
      return self._modelLoadPromise;
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

      // Model path resolves against THIS SCRIPT's URL (see SCRIPT_BASE).
      // A page-relative path 404s on pages served from a sub-path and the
      // engine silently became color-only.
      var modelPath = SCRIPT_BASE + 'models/basketball_yolox_tiny_v6_polished.onnx?v=v6polished';

      // executionProviders WITHOUT 'webgl' on purpose: the v6 ONNX graph
      // contains int64 initializers, and ORT-Web's WebGL EP rejects int64
      // with "int64 is not supported" during InferenceSession.create.
      // Crucially, ORT does NOT auto-fall-through to the next EP on parse
      // failure — so each backend gets its own create() attempt:
      //   1. webgpu       — GPU inference. Requires the ort.webgpu.min.js
      //      bundle; plain ort.min.js ships WITHOUT the WebGPU EP, which
      //      used to silently fall through to a main-thread WASM session
      //      (~1.4s per inference, ~0.7Hz instead of the ~5Hz the state
      //      machine assumes).
      //   2. wasm + proxy — WASM inside a dedicated worker. Same latency,
      //      but off the main thread so video/pose/color keep flowing.
      //   3. wasm         — last resort (proxy can fail under file:// or
      //      a restrictive CSP).
      var attempts = [
        { eps: ['webgpu'], proxy: false, label: 'webgpu' },
        { eps: ['wasm'],   proxy: true,  label: 'wasm-proxy' },
        { eps: ['wasm'],   proxy: false, label: 'wasm-main-thread' }
      ];

      var tryAttempt = function (i) {
        if (i >= attempts.length) {
          console.error('[ShotDetection] YOLOX-tiny load failed on every backend — color-only mode');
          self._colorOnlyMode = true;
          self._detectorType = 'none';
          self._setStatus('color-only');
          resolve(true);
          return;
        }
        var att = attempts[i];
        // proxy must be set BEFORE the wasm backend first initializes;
        // attempt order guarantees that (webgpu failing does not init wasm).
        try { ort.env.wasm.proxy = att.proxy; } catch (e) { /* read-only in exotic builds */ }

        ort.InferenceSession.create(modelPath, {
          executionProviders: att.eps,
          graphOptimizationLevel: 'all'
        }).then(function (session) {
          self.model = session;
          self._detectorType = 'yolox';
          self._backend = att.label;
          // Pre-allocate reusable buffers
          var sz = YOLOX_INPUT_SIZE;
          _yoloxBuf = new Float32Array(1 * 3 * sz * sz);
          _yoloxCanvas = document.createElement('canvas');
          _yoloxCanvas.width = sz;
          _yoloxCanvas.height = sz;
          _yoloxCtx = _yoloxCanvas.getContext('2d');
          if (att.label === 'webgpu') {
            console.log('[ShotDetection] YOLOX-tiny v6 loaded — backend: webgpu');
          } else {
            // Degraded performance is a real production signal — not gated.
            console.warn('[ShotDetection] YOLOX-tiny v6 loaded — backend: ' + att.label +
              ' (degraded: expect ~1.4s/inference; check that ort.webgpu.min.js is the loaded bundle and WebGPU is available)');
          }
          // PoseDetector load is now kicked off from init() / preloadModel()
          // upstream, so it runs in parallel with YOLOX *and* still fires on
          // the color-only fallback path (which used to silently skip pose).
          // No-op here — kept as a hand-off comment for future readers.
          self._setStatus('ready');
          resolve(true);
        }).catch(function (err) {
          console.warn('[ShotDetection] YOLOX load failed on ' + att.label + ': ' +
            (err && err.message ? err.message : err));
          tryAttempt(i + 1);
        });
      };
      tryAttempt(0);
    },

    setRimZone: function (normCX, normCY, normW, normH) {
      this.rimZone = createRimZone(normCX, normCY, normW, normH);
    },

    // Toggled by the screen once the auto-locked rim has had time to converge.
    // When false, _analyzeShotState short-circuits — keeps the state machine
    // from counting shots while the rim position is still drifting in.
    setRimStabilized: function (b) {
      this._rimStabilized = !!b;
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
      // Crop region is per-video — a previous session's UI-overlay crop
      // must not leak into a new video with different dimensions/chrome.
      this._cropRegion = undefined;
      this._shotState = 'idle';
      this._shotStateTime = 0;
      this._ballMinY = 1.0;
      this._shotStartY = 1.0;
      this._sawBallAboveRim = false;
      this._rimStabilized = false;
      this._shotTriggerSrc = null;
      this._releaseConfidence = null;
      this._shooterFeetX = null;
      this._shooterFeetY = null;
      // L7 diagnostic state — fresh per session so counters reflect this run only
      this._lastShotReason = null;
      this._poseStats = { checks: 0, triggers: 0, lastConfidence: 0 };
      this._shotTrajectory = [];
      this._lastCrossing = null;
      // L9.2: post-crossing watch state
      this._postCrossingWatch = null;
      // L12: preflight safety check — accumulate detection counts for the
      // three entities (ball / hoop / player). Shot counting is gated until
      // all three thresholds are met, so we never spam false misses while
      // the model is still warming up or the scene hasn't fully revealed
      // its contents.
      // L15: drop ball from preflight requirement. The strict ball verifier
      // (orange + round + small) blocks for 15-20s on TikTok-style compressed
      // footage where YOLOX's "ball" detections are mostly on logos and the
      // rim. Hoop + player are sufficient as a calibration gate. Keep ball
      // counter in the struct so the overlay still shows it as "seen N".
      this._preflightChecks = { ball: 0, hoop: 0, player: 0 };
      this._preflightThresholds = { ball: 0, hoop: 5, player: 3 };
      this._preflightReady = false;
      this._preflightStartedAt = Date.now();
      // L14.B / L14.C: ball-near-rim tracker + per-shot event log
      this._ballSeenAtRim = false;
      this._ballNearRimHits = 0;
      // L30: ordered through-rim evidence (above the rim → below it within
      // the made span) — the only signal allowed to convert miss → made.
      this._ballAboveRimAt = 0;
      this._ballThroughRimAt = 0;
      this._lastBallDetMs = 0;
      // L31: rim-transit detector state
      this._transitBaseA = null;
      this._transitBaseB = null;
      this._transitSadBaseA = 0;
      this._transitSadBaseB = 0;
      this._transitAboveAt = 0;
      this._transitPrev = null;
      this._transitEventAt = 0;
      this._shotEventLog = [];
      this._sessionStartedAt = Date.now();
      // Reset pose history so the new session starts fresh — important when
      // re-using a single engine for several uploaded videos in a row.
      if (window.PoseDetector) {
        if (typeof window.PoseDetector.reset === 'function')      window.PoseDetector.reset();
        if (typeof window.PoseDetector.resetMotion === 'function') window.PoseDetector.resetMotion();
      }
      resetTracker(this.tracker);
      this._setStatus('detecting');
      this._scheduleDetection();
      // Pose loop kicks itself off via requestVideoFrameCallback (or
      // a setInterval fallback). It self-schedules from inside, so we
      // just call it once here.
      if (this._poseInterval) { clearInterval(this._poseInterval); this._poseInterval = null; }
      if (this._poseRafId)    { cancelAnimationFrame(this._poseRafId); this._poseRafId = null; }
      this._poseLoop();
    },

    stop: function () {
      // L32: flush a pending rim event before tearing down — a shot in the
      // final second of a video used to vanish with the session (eval v3
      // lost its last put-back to truncation). Through-evidence → made;
      // an armed event older than 500ms with no through → missed.
      if (this._transitEventAt && this.videoEl) {
        var flushVw = this.videoEl.videoWidth  || 1;
        var flushVh = this.videoEl.videoHeight || 1;
        var flushRes = this._ballThroughRimAt > 0 ? 'made'
                     : (Date.now() - this._transitEventAt > 500 ? 'missed' : null);
        this._transitEventAt = 0;
        if (flushRes) {
          if (this._shotState === 'idle') {
            this._shotTriggerSrc    = 'rim-event';
            this._releaseConfidence = 0.6;
          }
          this._logShotEvent('rim-event-flushed', { result: flushRes });
          this._countShot(flushRes, flushVw, flushVh,
            this.rimZone ? this.rimZone.centerX : 0.5,
            this.rimZone ? this.rimZone.centerY : 0.4, Date.now());
        }
      }
      this.isRunning = false;
      if (this.detectionTimer) {
        clearTimeout(this.detectionTimer);
        this.detectionTimer = null;
      }
      if (this._poseInterval) { clearInterval(this._poseInterval); this._poseInterval = null; }
      if (this._poseRafId)    { cancelAnimationFrame(this._poseRafId); this._poseRafId = null; }
      this.ballPosition = null;
      this._setStatus('stopped');
    },

    resetStats: function () {
      this.stats = { made: 0, attempts: 0 };
      resetTracker(this.tracker);
      this.lastShotTime = 0;
      this.ballPosition = null;
    },

    /* ── L14.C: per-shot event log (public API) ──────────────────
       Returns the in-memory event log as JSON so the user can paste it
       back for diagnosis. Each entry has: tElapsed (ms since session
       start), type (pose-trigger, pose-rejected, shot-counted, …), and
       a payload object. Capped at 200 events (oldest dropped). */
    dumpShotLog: function () {
      var log = this._shotEventLog || [];
      var summary = {
        sessionMs: this._sessionStartedAt ? Date.now() - this._sessionStartedAt : 0,
        events:    log.length,
        stats:     this.stats,
        log:       log
      };
      return JSON.stringify(summary, null, 2);
    },

    /* ── Internal ──────────────────────────────────────────────── */

    _logShotEvent: function (type, payload) {
      if (!this._shotEventLog) this._shotEventLog = [];
      this._shotEventLog.push({
        tElapsed: Date.now() - (this._sessionStartedAt || Date.now()),
        type:     type,
        state:    this._shotState,
        payload:  payload || {}
      });
      // Cap log size — 200 events covers a long session without
      // ballooning memory.
      if (this._shotEventLog.length > 200) this._shotEventLog.shift();
    },

    _scheduleDetection: function () {
      var self = this;
      if (!self.isRunning) return;
      // p11: in offline mode the frame cadence is driven externally by
      // ShotOfflineProcessor (seek → processFrameOffline). The real-time
      // self-rescheduling loop MUST NOT run — _runYoloxInference calls this
      // on completion, and if it re-armed the setTimeout loop we'd get a
      // second, racing frame source competing with the offline stepper.
      if (self._offlineMode) return;
      self.detectionTimer = setTimeout(function () {
        self._detectFrame();
      }, DETECTION_INTERVAL);
    },

    /* ── p11: OFFLINE FRAME PROCESSOR ─────────────────────────────
       Process the CURRENT (already-seeked) video frame through the full
       pipeline — draw → colour → rim-transit → pose → YOLOX — and resolve
       only once the YOLOX inference for this frame has completed. The
       caller (ShotOfflineProcessor) seeks the video to each successive
       frame time, awaits this, and moves on. Because it awaits every
       inference, NO frame is ever skipped (the real-time loop runs YOLOX
       on ~1 of 3 frames and drops the rest under load). The dense ball
       trajectory this produces is what finally lets polyfitVerdict fit the
       arc and decide made-vs-miss, and catches shots the sparse real-time
       sampling missed.
       Returns a Promise<void>. Must be called with _offlineMode = true,
       isRunning = true, model loaded, rimZone set + _rimStabilized. */
    processFrameOffline: function () {
      var self = this;
      return new Promise(function (resolve) {
        if (!self.videoEl) { resolve(); return; }
        var vw = self.videoEl.videoWidth  || 1;
        var vh = self.videoEl.videoHeight || 1;

        var canvasReady = self._drawToCanvas();
        var pw = self._procW || vw, ph = self._procH || vh;
        var scaleX  = self._cropScaleX  || (pw > 0 ? vw / pw : 1);
        var scaleY  = self._cropScaleY  || (ph > 0 ? vh / ph : 1);
        var offsetX = self._cropOffsetX || 0;
        var offsetY = self._cropOffsetY || 0;

        // p12: OFFLINE = YOLO ONLY, awaited every frame. Pose, colour-ball
        // and rim-transit are real-time recall/verdict aids; the offline
        // timeline classifier (ShotOfflineProcessor pass 2) replaces all of
        // them with geometry over dense detections — dropping them here
        // roughly halves per-frame cost and removes the MediaPipe load
        // dependency entirely. Detections reach the processor via the
        // onFrameDetections dispatch inside _yoloxDecode.
        if (self.model && !self._colorOnlyMode && canvasReady) {
          self._isDetecting = true;
          var chain = null;
          try {
            chain = self._runYoloxInference(vw, vh, pw, ph, scaleX, scaleY, offsetX, offsetY, null);
          } catch (yErr) {
            self._isDetecting = false;
          }
          if (chain && typeof chain.then === 'function') {
            // Await the inference promise directly — NO timers. Background
            // tabs clamp setTimeout/setInterval to ≥1s (which froze offline
            // processing whenever the tab/app lost focus); promise and
            // event resolution are exempt, so this path keeps full speed.
            chain.then(function () { resolve(); }, function () { resolve(); });
          } else {
            // Legacy fallback: poll the flag (inference didn't hand back
            // its chain — should not happen, kept as a safety net).
            var waited = 0;
            var poll = setInterval(function () {
              waited += 8;
              if (!self._isDetecting || waited > 6000) {
                clearInterval(poll);
                resolve();
              }
            }, 8);
          }
        } else {
          resolve();
        }
      });
    },

    _drawToCanvas: function () {
      var vw = this.videoEl.videoWidth;
      var vh = this.videoEl.videoHeight;
      if (vw < 10 || vh < 10) return false;

      /* ── Auto-detect UI overlay (screen recording) ──────────── */
      /* If video has overlay UI (nav bar at top, buttons at bottom),
         crop it out before processing. Detected once on first frame. */
      if (this._cropRegion === undefined) {
        this._cropRegion = this._detectUIOverlay(vw, vh);
      }
      var crop = this._cropRegion;

      /* Source region from video (after crop) */
      var srcX = crop.x, srcY = crop.y;
      var srcW = crop.w, srcH = crop.h;

      /* Downscale to max 640px wide for processing (was 480 — too small for distant balls) */
      var maxW = 640;
      var scale = srcW > maxW ? maxW / srcW : 1;
      var pw = Math.floor(srcW * scale);
      var ph = Math.floor(srcH * scale);

      if (this._canvas.width !== pw) this._canvas.width = pw;
      if (this._canvas.height !== ph) this._canvas.height = ph;
      /* Draw only the cropped region of the video */
      this._ctx.drawImage(this.videoEl, srcX, srcY, srcW, srcH, 0, 0, pw, ph);

      /* Store crop info for coordinate mapping back to full video */
      this._procW = pw;
      this._procH = ph;
      this._cropOffsetX = srcX;
      this._cropOffsetY = srcY;
      this._cropScaleX = srcW / pw;
      this._cropScaleY = srcH / ph;
      return true;
    },

    /* ── Detect if video has UI overlay (screen recording) ─────── */
    /* Checks for dark bands at top/bottom that indicate app chrome */
    _detectUIOverlay: function (vw, vh) {
      /* Draw first frame to a temp canvas for analysis */
      var tc = document.createElement('canvas');
      tc.width = vw; tc.height = vh;
      var tctx = tc.getContext('2d');
      tctx.drawImage(this.videoEl, 0, 0, vw, vh);

      /* Sample darkness at top and bottom bands */
      var topDark = 0, botDark = 0;
      var sampleRows = Math.min(Math.floor(vh * 0.12), 100);
      var step = 8;

      try {
        /* Top band */
        var topData = tctx.getImageData(0, 0, vw, sampleRows).data;
        var topTotal = 0;
        for (var i = 0; i < topData.length; i += step * 4) {
          var brightness = (topData[i] + topData[i+1] + topData[i+2]) / 3;
          if (brightness < 50) topDark++;
          topTotal++;
        }
        /* Bottom band */
        var botData = tctx.getImageData(0, vh - sampleRows, vw, sampleRows).data;
        var botTotal = 0;
        for (var i = 0; i < botData.length; i += step * 4) {
          var brightness = (botData[i] + botData[i+1] + botData[i+2]) / 3;
          if (brightness < 50) botDark++;
          botTotal++;
        }
      } catch(e) {
        return { x: 0, y: 0, w: vw, h: vh };
      }

      var topDarkRatio = topTotal > 0 ? topDark / topTotal : 0;
      var botDarkRatio = botTotal > 0 ? botDark / botTotal : 0;

      /* If >60% of top/bottom is dark = likely UI overlay from screen recording */
      var cropTop = topDarkRatio > 0.6 ? Math.floor(vh * 0.13) : 0;
      var cropBot = botDarkRatio > 0.6 ? Math.floor(vh * 0.12) : 0;

      if (cropTop > 0 || cropBot > 0) {
        dlog('[ShotDetection] UI overlay detected — cropping top=' + cropTop + 'px bottom=' + cropBot + 'px (darkRatio top=' + topDarkRatio.toFixed(2) + ' bot=' + botDarkRatio.toFixed(2) + ')');
      }

      return { x: 0, y: cropTop, w: vw, h: vh - cropTop - cropBot };
    },

    /* ── Pose detection loop ────────────────────────────────────────
       Previous version ran BOTH rAF (~60 Hz) AND setInterval (30 Hz)
       → ~90 pose detections/sec, crushing iPhone CPUs and producing
       the "delay following player" feel the user reported.

       The shooting-motion heuristic looks at a ~200 ms release window
       which is ~6 frames at 30 Hz — completely sufficient.
       We now run JUST setInterval at 33 ms (30 Hz). When the page is
       backgrounded, the browser throttles setInterval automatically
       and the engine pauses anyway via isRunning.
     ──────────────────────────────────────────────────────────── */
    _poseLoop: function () {
      var self = this;
      if (!self.isRunning || !self.videoEl) return;
      // p11: offline mode drives pose per-frame from processFrameOffline —
      // no self-scheduling rAF loop (which would race the frame stepper and
      // poll pose against whatever frame the seek happens to be on).
      if (self._offlineMode) return;

      // p9u: DRIVE FROM requestAnimationFrame, not setInterval.
      // Measured on the Dr.Dish courtyard clip: the old setInterval(33ms)
      // delivered only ~3.8 Hz of actual poll ticks (187 in 49 s) because
      // the browser COALESCES missed intervals when the main thread is
      // saturated by the YOLO WebGPU dispatch + the overlay rAF loop.
      // At 3.8 Hz a ~500 ms shot-release window is sampled ~2× — far too
      // sparse for the wrist-above-nose / arm-extended / local-peak gates
      // to coincide, so pose caught only 3/14 shots.
      //
      // The overlay's own skeleton-draw loop already runs detect() at the
      // paint cadence (~22 Hz measured). rAF is NOT coalesced the way
      // setInterval is, so driving the shot poll from rAF gives it that
      // same ~22 Hz — a ~6× recall-relevant sampling boost. And because
      // PoseDetector.detect() de-dupes by videoFrameKey (currentTime),
      // when this loop and the overlay loop land in the same painted
      // frame the SECOND caller gets the cached result — so we do NOT pay
      // for a second full inference. Net cost is near-zero; net sampling
      // rate is ~6× higher.
      var rafPoll = function () {
        if (!self.isRunning) { self._poseRafId = null; return; }
        self._poseRafId = requestAnimationFrame(rafPoll);
        // L34: skip while the source video is paused/ended — every pose
        // call would return the SAME cached skeleton against an advancing
        // wall-clock, and the peak/set-point heuristics would read that as
        // a fresh trigger on every tick (false MADEs on pause).
        if (self.videoEl && (self.videoEl.paused || self.videoEl.ended)) return;
        if (self.videoEl && self.videoEl.readyState >= 2 && self.rimZone &&
            window.PoseDetector && window.PoseDetector.isReady()) {
          self._pollPoseShot();
        }
      };
      self._poseRafId = requestAnimationFrame(rafPoll);
    },

    _pollPoseShot: function () {
      var self = this;
      // p11: offline mode SEEKS the video frame-by-frame, so videoEl.paused
      // is always true and each frame is a genuinely new picture. The
      // pause / scene-static gates (designed to stop false triggers on a
      // FROZEN live source) would suppress every offline pose call — skip
      // them here. currentTime is the seeked frame time, which
      // PoseDetector.detect uses as its dedupe key, so each frame still
      // yields a fresh inference.
      if (!self._offlineMode) {
        // Defence-in-depth — same gate as the outer loop, in case
        // someone calls _pollPoseShot directly (eval harness, etc.).
        if (self.videoEl && (self.videoEl.paused || self.videoEl.ended)) return;
        // Phase 6: gate pose triggers on the scene-static detector too.
        // A frozen source video on the iPhone screen still feeds pose data
        // from the same static skeleton, but if a user happens to be in
        // pose-shot configuration when they pause, the heuristic would
        // fire repeatedly. The static-scene flag is set by `_updateRimTransit`
        // (see Phase 6 block at ~line 2320) when frame-to-frame motion is
        // below the sensor-noise floor for ≥350ms.
        if (self._sceneStatic) return;
      }
      var pose = window.PoseDetector.detect(self.videoEl, self.videoEl.currentTime);
      if (!pose || !pose.landmarks) return;

      // Quality gate — RELAXED (p9t).
      // Runtime measurement on Dr.Dish outdoor courtyard footage: the
      // previous 0.5 threshold rejected 92% of pose samples (2.2Hz effective
      // rate vs 30Hz loop cadence), because distant shooters against
      // sunlit foliage return visibility 0.3-0.4 on wrist/elbow. That
      // dropped detection to 3/14 shots — pose only ever caught the shots
      // where a random noise blip pushed visibility above 0.5.
      // The INNER heuristic (detectShootingMotion) still enforces its own
      // visibilityMin: 0.15 gate on the joints it uses; the outer gate's
      // only job is to reject wholesale-hallucinated skeletons, so 0.3 on
      // three-joint chains is sufficient.
      var lms = pose.landmarks;
      var visEnough = function (i) { return lms[i] && (lms[i].visibility || 0) >= 0.30; };
      var noseOk = visEnough(0);
      var leftArmOk  = visEnough(11) && visEnough(13) && visEnough(15); // L-shoulder, L-elbow, L-wrist
      var rightArmOk = visEnough(12) && visEnough(14) && visEnough(16); // R-shoulder, R-elbow, R-wrist
      if (!noseOk || (!leftArmOk && !rightArmOk)) return;

      var vw = self.videoEl.videoWidth  || 1;
      var vh = self.videoEl.videoHeight || 1;

      // ── L7 REVERT: Pose-shot trigger (baseline — no L1/L4c gates) ──
      // L1 (ball-in-hand) and L4c (ball-velocity-up) gates were removed because
      // they hurt recall more than they helped — real shots were being rejected.
      // We now accept any pose-detected shooting motion directly. False positives
      // are visible in the debug overlay so gates can be re-introduced one-by-one
      // with measured impact (Step 3 of L7 plan).
      //
      // _poseStats tracks every pose check so the debug overlay can show how
      // often PoseDetector is even seeing a shooting motion — that helps
      // distinguish "trigger didn't fire" from "trigger fired but state machine
      // dropped it later".
      if (self._shotState === 'idle') {
        if (!self._poseStats) self._poseStats = { checks: 0, triggers: 0, lastConfidence: 0 };
        self._poseStats.checks++;
        var motion = window.PoseDetector.detectShootingMotion(pose.landmarks, Date.now());
        // Phase 9 (radical simplification): set-point ("hand-at-head")
        // fallback DISABLED. This heuristic fired on any hand-near-face
        // gesture — face wipe, hair touch, ear scratch, phone-to-ear —
        // producing endless phantom pose triggers with no shooting
        // motion attached. Radical mode: only the strict
        // detectShootingMotion (wrist-above-nose + arm-extended +
        // release-peak) counts as a shot trigger.
        if (!motion.isShot && motion.reason && motion.reason !== 'cooldown') {
          // Log non-cooldown rejections only; cooldown spams too much.
          // Throttle to one rejection log per unique reason per 500ms.
          var nowR = Date.now();
          if (!self._lastPoseRejectAt) self._lastPoseRejectAt = {};
          if (!self._lastPoseRejectAt[motion.reason] ||
              (nowR - self._lastPoseRejectAt[motion.reason]) > 500) {
            self._lastPoseRejectAt[motion.reason] = nowR;
            self._logShotEvent('pose-rejected', { reason: motion.reason });
          }
        }
        if (motion.isShot) {
          self._poseStats.triggers++;
          self._poseStats.lastConfidence = motion.releaseConfidence;

          // L36.3 (revised): pose triggers shot_started directly. The
          // initial PRIMED gate (wait for ball-rise) starved real shots
          // on footage where YOLO can't track the ball through every
          // mid-air frame — `ballRoseInWindow` needs a sustained
          // trajectory which compressed/screen-record footage rarely
          // produces. The strict MADE policy (L35 — require
          // `_ballThroughRimAt > 0`) + drop-on-timeout (L36.4) + no
          // colors (L36.1) ALREADY guarantee phantom poses don't get
          // counted as MADE: they enter shot_started, sit through
          // near_hoop without ever seeing the ball pass the rim, then
          // get dropped silently at timeout. No phantom MADE; no missed
          // real shots either.
          var sx = (pose.landmarks[15].y < pose.landmarks[16].y ? pose.landmarks[15] : pose.landmarks[16]);
          self._shotState         = 'shot_started';
          self._shotStateTime     = Date.now();
          self._ballMinY          = sx.y;
          self._shotStartY        = sx.y;
          self._sawBallAboveRim   = (sx.y < self.rimZone.centerY);
          self._shotTriggerSrc    = motion.detector === 'setpoint' ? 'pose-setpoint' : 'pose';
          self._releaseConfidence = motion.releaseConfidence;
          self._shooterFeetX      = motion.shooterCenterX;
          self._shooterFeetY      = motion.shooterCenterY;
          // p10a: RESET per-shot through-rim evidence at shot START.
          // THE made/miss BUG: the verdict is `_ballThroughRimAt > 0 ?
          // made : missed`, but nothing cleared `_ballThroughRimAt`
          // between shots. So a MADE shot set the timestamp, and the NEXT
          // shot — even a clean miss — still read `_ballThroughRimAt > 0`
          // (the previous make's leftover) and was counted MADE. That is
          // why misses were being scored as makes. Zeroing the through-
          // evidence here means the verdict reflects ONLY whether the ball
          // passed through the net DURING this specific shot. The through-
          // transit detector re-sets it later in the arc if the ball
          // actually drops through (a make); a miss leaves it 0 → missed.
          // _transitAboveAt is NOT cleared: it self-expires via the
          // ≤1200ms freshness gate, and clearing it could drop the A→B
          // pairing for the current descending arc.
          self._ballThroughRimAt = 0;
          self._ballAboveRimAt   = 0;
          self._ballSeenAtRim    = false;
          self._ballNearRimHits  = 0;
          // Phase 9j: SEED the shot trajectory with the last ~1.5s of
          // tracker history. Pose fires as the ball is being released,
          // but the ARC starts BEFORE pose triggers. Without this seed
          // the trajectory only accumulates AFTER pose fires, which for
          // fast shots + slow YOLO leaves too few measured points for
          // polyfit to succeed. Preferring tracker.positions (measured
          // points) so we get real arc data, not Kalman ghosts.
          self._shotTrajectory = [];
          try {
            var vwSeed = self.videoEl?.videoWidth || 1;
            var vhSeed = self.videoEl?.videoHeight || 1;
            var seedNow = Date.now();
            var pts = self.tracker && self.tracker.positions ? self.tracker.positions : [];
            for (var seedI = pts.length - 1; seedI >= 0; seedI--) {
              var pt = pts[seedI];
              if (!pt || pt.predicted) continue;      // measured only
              if (!pt.ts || seedNow - pt.ts > 1500) break;
              self._shotTrajectory.unshift({
                x: pt.x / vwSeed,
                y: pt.y / vhSeed,
                t: pt.ts
              });
            }
            if (self._shotTrajectory.length > 0) {
              try { console.log('[seed] pre-filled ' + self._shotTrajectory.length + ' points from tracker'); } catch(e){}
            }
          } catch (seedErr) { /* non-fatal */ }
          self._postCrossingWatch = null;
          self._ballSeenAtRim     = false;
          self._ballNearRimHits   = 0;
          self._ballAboveRimAt    = 0;
          self._ballThroughRimAt  = 0;
          self._lastShotReason    = 'TRIGGER conf=' + motion.releaseConfidence.toFixed(2) +
                                    ' hand=' + (motion.shootingHand || '?') +
                                    ' src=' + self._shotTriggerSrc;
          self._logShotEvent(motion.detector === 'setpoint' ? 'pose-setpoint-trigger' : 'pose-trigger', {
            confidence:  motion.releaseConfidence,
            shootingHand: motion.shootingHand,
            detector:    motion.detector || 'shooting-motion'
          });
          dlog('[ShotState] shot_started (' + self._shotTriggerSrc + ') conf=' +
               motion.releaseConfidence.toFixed(2));
        }
      }

      // Pose-triggered shot fallback:
      // When the shot was triggered by pose and YOLOX never picks up
      // the ball (red ball, off-camera arc, etc.), wrist position is
      // not a valid proxy once the ball leaves the shooter's hand.
      // After POSE_SHOT_FALLBACK_MS we conservatively count it as a
      // miss so the attempt isn't silently dropped.
      //
      // IMPORTANT: defer the fallback while ball detection is still
      // hot. _processBallDetection stamps _lastBallDetMs every time
      // YOLOX detects the ball. If the ball was seen within the last
      // BALL_HOT_WINDOW_MS, we give the legacy state machine more time
      // to drive shot_started→near_hoop→made. This is what allows a
      // pose-triggered shot to be UPGRADED from "missed by fallback"
      // to "made via ball-trajectory" when both signals are present.
      // L29: was 700 — still slightly too eager. Real ball travel from the
      // release point to the rim Y line is 800-1200ms depending on shot
      // distance. The L26 ball-cross-rim trigger fires AS the ball crosses
      // the rim and pre-empts this fallback when YOLOX caught the ball.
      // Pose-fallback only kicks in for shots where ball tracking was lost
      // mid-arc — and there the right banner moment is "when the ball
      // would have arrived", i.e. ~1.1s after release.
      // L31.2: the rim-event counter (transit detector) is the PRIMARY
      // resolver for any shot whose ball reaches the rim. This fallback is
      // now hard-timeout-only: the old soft window (1.1-1.6s) kept ruling
      // "missed" while the ball was still mid-air (eval arcs ran 1.2-2.3s
      // from pose trigger to rim) and the rim event then counted the same
      // attempt AGAIN — every long make became a miss+made double.
      //
      // At the hard timeout the policy is evidence-based:
      //   • through-rim evidence  → made (rim event was consumed by a
      //     concurrent verdict path; count it)
      //   • rim activity happened but no through → missed (ball got there
      //     and bounced away; normally the rim event already resolved it
      //     and we never reach here)
      //   • ZERO rim activity since the trigger → DROP without counting.
      //     On eval footage pose triggers in verified-empty spans
      //     outnumber true never-reaches-rim airballs by a wide margin —
      //     counting these as misses poisons the stats with phantoms.
      var BALL_HOT_WINDOW_MS    = 600;
      var POSE_HARD_TIMEOUT_MS  = 3200;
      if (self._shotState === 'shot_started' && self._shotTriggerSrc === 'pose') {
        var elapsed = Date.now() - self._shotStateTime;
        var ballHot = self._lastBallDetMs && (Date.now() - self._lastBallDetMs) < BALL_HOT_WINDOW_MS;
        var transitHot = self._transitAboveAt && (Date.now() - self._transitAboveAt) < BALL_HOT_WINDOW_MS;
        // A pending rim event ALWAYS outranks the fallback — it resolves
        // within 1.4s with a real verdict for this very shot.
        var transitPending = !!self._transitEventAt;
        if (!transitPending && !ballHot && !transitHot && elapsed > POSE_HARD_TIMEOUT_MS) {
          // L33: pose timeouts NEVER self-count a miss. Every real miss
          // that reaches the rim arms a rim event (A-window) and gets
          // counted there with correct timing; the timeout-miss branch
          // only ever produced phantoms (pose fired, ball never came) and
          // miss+made doubles on tip plays (timeout verdict landing
          // mid-play, rim event counting the same attempt again seconds
          // later). Through-evidence → made stays: it is evidence-backed
          // and covers makes whose A-spike the detector missed.
          // Phase 5: polyfit is the verdict authority. Run it first; only
          // fall back to motion-MADE if polyfit can't form a verdict.
          // Phase 9: polyfit is the SOLE authority. If it can form a
          // verdict, count. If not, DROP — no through-rim fallback,
          // no motion default. A shot that YOLO couldn't track enough
          // of to fit a curve is a shot we can't judge.
          var pfPose = self.rimZone ? polyfitVerdict(self._shotTrajectory, self.rimZone) : null;
          var fallbackResult = pfPose ? pfPose.result : null;
          self._logShotEvent('pose-fallback', {
            elapsedMs:      elapsed,
            ballSeenAtRim:  !!self._ballSeenAtRim,
            ballThroughRim: !!self._ballThroughRimAt,
            polyfit:        pfPose ? {
              result: pfPose.result,
              xAtRim: +pfPose.xAtRim.toFixed(3),
              dx:     +pfPose.dxFromRim.toFixed(3),
              tol:    +pfPose.tolerance.toFixed(3),
              points: pfPose.points
            } : null,
            resolvedAs:     fallbackResult || 'dropped-no-evidence'
          });
          if (fallbackResult) {
            var feetX = self._shooterFeetX != null ? self._shooterFeetX : 0.5;
            var feetY = self._shooterFeetY != null ? self._shooterFeetY : 0.8;
            self._countShot(fallbackResult, vw, vh, feetX, feetY, Date.now());
          } else {
            // Phantom trigger (no through-rim, no usable trajectory) — reset.
            self._shotState         = 'idle';
            self._shotStateTime     = Date.now();
            self._ballMinY          = 1.0;
            self._shotStartY        = 1.0;
            self._sawBallAboveRim   = false;
            self._shotTriggerSrc    = null;
            self._releaseConfidence = null;
            self._shooterFeetX      = null;
            self._shooterFeetY      = null;
          }
        }
      }
    },

    _detectFrame: function () {
      var self = this;
      if (!self.isRunning || !self.videoEl) return;
      // L35: skip ball/hoop detection while the source video is paused or
      // ended. Otherwise the same cached frame is re-analysed every tick
      // and stale "ball" / "hoop" detections leak into the rim-transit
      // event clock — feeding false MADEs the moment the user resumes.
      if (self.videoEl.paused || self.videoEl.ended) {
        // L37.3: on pause, mark the rim-transit pixel buffer as stale.
        // Without this, the first post-resume tick computes hot-fraction
        // against a possibly-ancient prev-frame and produces a huge
        // spurious motion delta → A+B spike together → fake MADE.
        self._transitPaused = true;
        self._scheduleDetection();
        return;
      }
      if (self.videoEl.readyState < 2) { self._scheduleDetection(); return; }
      // L37.3: on resume, drop the stale prev-frame buffers so the next
      // tick rebuilds baselines from a current frame instead of diffing
      // against pre-pause pixels (the resume burst was the primary cause
      // of "MADE the moment you unpause" phantoms — see post-L36.6 audit).
      if (self._transitPaused) {
        self._transitPrev = null;
        self._transitBaseA = null;
        self._transitBaseB = null;
        self._transitSadBaseA = 0;
        self._transitSadBaseB = 0;
        self._transitPaused = false;
      }

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
        self.tracker._vw = vw;
        self.tracker._vh = vh;
        // L37.4 (rim revert): L32 _estimateGlobalMotion call REMOVED.
        // Open-loop SAD shift integrated drift on static-camera footage.
        // The orange-refined EMA in ShotTrackingScreen re-snaps to the
        // actual ring on every detection — that's the correction loop.
        // self._estimateGlobalMotion(pw, ph, vw, vh);  // intentionally disabled
        // L36.6: RIM-TRANSIT detector RE-ENABLED but with COLOR DISABLED.
        // The previous L36.1 disable was a mistake — `_updateRimTransit`
        // does two things, only one of which is colour-based:
        //
        //   • orange-pixel spike (COLOR) — disabled inside the function
        //     (see line ~2136). Satisfies user policy.
        //   • hot-pixel-diff spike (MOTION) — kept. This is the share of
        //     pixels in the rim's above/below window whose GRAY value
        //     changed by >25 since the previous tick. A ball passing
        //     through the rim creates a compact moving blob regardless
        //     of its colour — black, white, red, leather, glow-in-dark.
        //     Codec shimmer and net sway score near zero on this metric.
        //
        // The rim-transit detector is the ONLY path that catches a make
        // when YOLO loses the ball mid-air (small fast object on
        // compressed footage). Without it, EVERY downstream MADE path
        // gated on `_ballThroughRimAt > 0` was unreachable → engine
        // stopped counting entirely.
        self._updateRimTransit(pw, ph, vw, vh);
      }

      /* Scale ball positions from processing canvas back to FULL video coords
         (accounts for UI crop: proc canvas → cropped region → full video) */
      var scaleX = self._cropScaleX || (pw > 0 ? vw / pw : 1);
      var scaleY = self._cropScaleY || (ph > 0 ? vh / ph : 1);
      var offsetX = self._cropOffsetX || 0;
      var offsetY = self._cropOffsetY || 0;

      /* Process color detection — skip on frames where YOLOX will run */
      var isYoloxFrame = self.model && !self._colorOnlyMode && canvasReady &&
                         (self._frameCount + 1) % 6 === 0;
      if (!self._isDetecting && !isYoloxFrame) {
        if (colorBall) {
          self._processBallDetection(colorBall.x * scaleX + offsetX, colorBall.y * scaleY + offsetY, vw, vh);
        } else {
          self._processNoBall();
        }
      }

      /* ── YOLOX detection (async, non-blocking) ──
         L30: divisor 6 → 3 on the WebGPU backend. 6 was a safe floor for
         main-thread WASM (~1.4s/inference); on webgpu inference is tens of
         ms and the loop itself runs ~15-20Hz, so %6 starved ball sampling
         to ~2.7Hz (0-2 samples per shot arc). %3 restores ~5Hz. WASM
         backends keep the conservative 6. */
      self._frameCount++;
      var yoloxDivisor = (self._backend === 'webgpu') ? 3 : 6;
      if (self.model && !self._colorOnlyMode && !self._isDetecting && canvasReady && self._frameCount % yoloxDivisor === 0) {
        self._isDetecting = true;
        self._runYoloxInference(vw, vh, pw, ph, scaleX, scaleY, offsetX, offsetY, colorBall);
      }

      self._scheduleDetection();
    },

    /* ── YOLOX ONNX inference (async) ─────────────────────────── */
    _runYoloxInference: function (vw, vh, pw, ph, scaleX, scaleY, offsetX, offsetY, colorBall) {
      var self = this;
      var sz = YOLOX_INPUT_SIZE;

      // Letterbox preprocess: fit processing canvas into 640×640 with gray padding.
      // NOTE: image is drawn at (0,0), not centered. The decode at _yoloxDecode uses
      // `cx / ratio` with no offset, which matches this top-left placement. If you
      // ever centre the letterbox here, you must subtract the same offsets there.
      var ratio = Math.min(sz / ph, sz / pw);
      var newW = Math.round(pw * ratio);
      var newH = Math.round(ph * ratio);

      _yoloxCtx.fillStyle = 'rgb(114,114,114)';
      _yoloxCtx.fillRect(0, 0, sz, sz);
      _yoloxCtx.drawImage(self._canvas, 0, 0, pw, ph, 0, 0, newW, newH);

      var imgData = _yoloxCtx.getImageData(0, 0, sz, sz).data;

      // CHW transposition: use Web Worker if available, else inline.
      // Reassigning onmessage per call is safe ONLY because the _isDetecting
      // guard ensures one inference is in flight at a time. If that ever
      // changes, switch to a request-id keyed map of pending resolvers.
      var chwReady;
      if (_chwWorker) {
        chwReady = new Promise(function (resolve) {
          _chwWorker.onmessage = function (ev) { resolve(ev.data.buffer); };
          _chwWorker.postMessage({ imageData: imgData, size: sz }, [imgData.buffer]);
        });
      } else {
        // YOLOX trained on cv2.imread (BGR); canvas gives RGB. Must swap so
        // channel 0 = B, channel 2 = R. See yoloxWorker.js for full rationale
        // and training/v7/verify_channel_order.py for the empirical check.
        var chSize = sz * sz;
        for (var i = 0; i < chSize; i++) {
          _yoloxBuf[i]              = imgData[i * 4 + 2]; // B
          _yoloxBuf[chSize + i]     = imgData[i * 4 + 1]; // G
          _yoloxBuf[chSize * 2 + i] = imgData[i * 4];     // R
        }
        chwReady = Promise.resolve(_yoloxBuf);
      }

      var pendingInputTensor = null;
      var chain = chwReady.then(function (chwBuf) {
        var inputTensor = new ort.Tensor('float32', chwBuf, [1, 3, sz, sz]);
        pendingInputTensor = inputTensor;
        // Debug: log input stats once
        if (DEBUG && !self._dbgInputLogged) {
          self._dbgInputLogged = true;
          var mn = Infinity, mx = -Infinity;
          for (var di = 0; di < Math.min(1000, chwBuf.length); di++) {
            if (chwBuf[di] < mn) mn = chwBuf[di];
            if (chwBuf[di] > mx) mx = chwBuf[di];
          }
          dlog('[YOLOX-DBG] input range: ' + mn.toFixed(1) + ' - ' + mx.toFixed(1) + ' len=' + chwBuf.length);
        }
        return self.model.run({ images: inputTensor });
      }).then(function (results) {
        var outputKey = Object.keys(results)[0];
        var outputData = results[outputKey].data;
        // Debug: log raw output stats — EVERY 30 FRAMES for v4 diagnosis
        if (DEBUG) {
          if (!self._dbgOutputCount) self._dbgOutputCount = 0;
          if (self._dbgOutputCount++ % 30 === 0) {
            dlog('[YOLOX-DBG] output len=' + outputData.length + ' (expect ' + (8400*7) + ')');
            // Check raw obj/cls values before postprocess
            var maxObj = 0, maxC0 = 0, maxC1 = 0;
            for (var di = 0; di < outputData.length; di += 7) {
              if (outputData[di+4] > maxObj) maxObj = outputData[di+4];
              if (outputData[di+5] > maxC0) maxC0 = outputData[di+5];
              if (outputData[di+6] > maxC1) maxC1 = outputData[di+6];
            }
            dlog('[YOLOX-DBG] raw maxObj=' + maxObj.toFixed(4) + ' maxBall=' + maxC0.toFixed(4) + ' maxHoop=' + maxC1.toFixed(4));
            var hasNeg = false;
            for (var di = 0; di < outputData.length; di += 7) {
              if (outputData[di+4] < 0 || outputData[di+5] < 0 || outputData[di+6] < 0) { hasNeg = true; break; }
            }
            dlog('[YOLOX-DBG] hasNegatives=' + hasNeg + ' (false=sigmoid, true=logits) outputKey=' + outputKey);
          }
        }

        var mlBall = self._yoloxDecode(outputData, ratio, pw, ph);

        // Fire hoop detection callback (normalized 0-1 coords relative to full video)
        if (self.onHoopDetected && self._lastHoopDetection) {
          var h = self._lastHoopDetection;
          self.onHoopDetected({
            cx: (h.cx * scaleX + offsetX) / vw, cy: (h.cy * scaleY + offsetY) / vh,
            bw: (h.bw * scaleX) / vw, bh: (h.bh * scaleY) / vh,
            score: h.score,
            // L11.2: propagate "color refinement succeeded" so the auto-lock
            // skips the BBOX_RIM_OFFSET_FRAC adjustment (which would over-
            // shoot when cy is already snapped to the orange ring).
            colorRefined: !!h.colorRefined
          });
        }

        if (mlBall) {
          // Reject ML detections with very low confidence — likely false positives
          if (mlBall.score < 0.02) { mlBall = null; }
          // For medium-confidence, verify orange color in the region
          else if (mlBall.score < 0.15) {
            var verified = self._verifyOrange(mlBall.cx, mlBall.cy, Math.max(mlBall.bw, mlBall.bh), pw, ph);
            if (!verified) { mlBall = null; }
          }
        }

        // Temporal consistency: require 2 consecutive frames with detection
        // Prevents single-frame false positives from triggering tracking
        if (mlBall) {
          if (!self._prevMLBall) {
            // First detection — hold, don't use yet
            self._prevMLBall = mlBall;
            mlBall = null;
          } else {
            // Second consecutive — accept and clear
            self._prevMLBall = mlBall;
          }
        } else {
          self._prevMLBall = null;
        }

        // Detection logging
        if (DEBUG && self._frameCount % 30 === 0) {
          var hoopStr = 'none';
          if (self._lastHoopDetection) {
            var hd = self._lastHoopDetection;
            hoopStr = 'score=' + hd.score.toFixed(3) + ' cx=' + hd.cx.toFixed(1) + ' cy=' + hd.cy.toFixed(1);
          }
          dlog('[ShotDetection] f=' + self._frameCount +
            ' vw=' + vw + ' vh=' + vh + ' pw=' + pw + ' ph=' + ph +
            ' ball=' + (mlBall ? 'ML(' + mlBall.score.toFixed(3) + ' cx=' + mlBall.cx.toFixed(1) + ')' : (colorBall ? 'color' : 'none')) +
            ' hoop=' + hoopStr);
        }

        if (mlBall) {
          self._mlMissCount = 0;
          self._mlEverDetected = true;
          self._lastDetSource = 'ml';
          self._lastDetConf = mlBall.score;
          self._processBallDetection(mlBall.cx * scaleX + offsetX, mlBall.cy * scaleY + offsetY, vw, vh);
        } else if (colorBall && (self._mlMissCount < 30 || !self._mlEverDetected)) {
          // Color fallback: use if ML recently saw ball OR ML never detected anything
          // (ML may not work on all videos — e.g. outdoor, dark, screen recordings)
          self._mlMissCount++;
          self._lastDetSource = 'color';
          self._lastDetConf = 0;
          self._processBallDetection(colorBall.x * scaleX + offsetX, colorBall.y * scaleY + offsetY, vw, vh);
        } else {
          self._mlMissCount++;
          self._processNoBall();
        }

        // Release ORT tensors. With WebGPU/WebGL backends the underlying
        // GPU buffers are not GC-tracked, so leaking them across many
        // frames will eventually hit a memory ceiling. dispose() is a
        // no-op for plain CPU tensors so this is always safe.
        try {
          if (pendingInputTensor && typeof pendingInputTensor.dispose === 'function') {
            pendingInputTensor.dispose();
          }
          if (results) {
            Object.keys(results).forEach(function (k) {
              var t = results[k];
              if (t && typeof t.dispose === 'function') t.dispose();
            });
          }
        } catch (_) { /* tensor lifecycle is best-effort */ }
        pendingInputTensor = null;

        self._isDetecting = false;
        self._scheduleDetection();
      }).catch(function (e) {
        console.warn('[ShotDetection] YOLOX inference error:', e);
        // Whatever happens below, the detection flag MUST clear or the
        // engine will deadlock on the next gate check. Wrap fallback work
        // and dispose in their own try blocks so a re-throw can't strand us.
        try {
          if (colorBall) {
            self._processBallDetection(colorBall.x * scaleX + offsetX, colorBall.y * scaleY + offsetY, vw, vh);
          } else {
            self._processNoBall();
          }
        } catch (innerErr) {
          console.warn('[ShotDetection] fallback error:', innerErr);
        }
        try {
          if (pendingInputTensor && typeof pendingInputTensor.dispose === 'function') {
            pendingInputTensor.dispose();
          }
        } catch (_) { /* ignore */ }
        pendingInputTensor = null;
        self._isDetecting = false;
        self._scheduleDetection();
      });

      // p12: return the full inference chain. The offline processor awaits
      // this directly instead of polling _isDetecting on a setInterval —
      // promise/event resolution is NOT throttled in background tabs, so
      // offline analysis keeps full speed when the user switches apps.
      // Real-time callers ignore the return value (unchanged behavior).
      return chain;
    },

    /* ── YOLOX grid+stride postprocess (required for raw ONNX output) ── */
    /* The ONNX model outputs raw grid offsets, not decoded pixel coords.
       This applies: cx = (raw_cx + grid_x) * stride, w = exp(raw_w) * stride */
    _yoloxPostprocess: function (output) {
      var sz = YOLOX_INPUT_SIZE; // 640
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
    /* After _yoloxPostprocess, cx/cy/w/h are in 640x640 input space */
    _yoloxDecode: function (output, ratio, pw, ph) {
      // Apply grid+stride decoding (converts raw offsets → pixel coords in 640x640 space)
      this._yoloxPostprocess(output);

      var numDets = output.length / YOLOX_STRIDE;
      var ballCandidates = [];
      var hoopCandidates = [];
      var playerCandidates = [];
      var frameArea = pw * ph;

      // p12: offline mode collects an unfiltered low-floor ball list for the
      // timeline classifier (see the ball section below + dispatch at the end).
      this._offlineBallScratch = (this._offlineMode && typeof this.onFrameDetections === 'function') ? [] : null;

      // Auto-detect: if any obj/cls value is negative, output is raw logits (needs sigmoid)
      // ORT-Web may skip fused sigmoid depending on version/backend.
      // Probe all 4 score slots (obj + 3 classes) on the first ~100 rows.
      var needsSigmoid = false;
      for (var si = 0; si < Math.min(output.length, 800); si += YOLOX_STRIDE) {
        if (output[si + 4] < 0 || output[si + 5] < 0 || output[si + 6] < 0 || output[si + 7] < 0) {
          needsSigmoid = true;
          break;
        }
      }
      if (DEBUG && !this._dbgSigmoidLogged) {
        this._dbgSigmoidLogged = true;
        dlog('[YOLOX] needsSigmoid=' + needsSigmoid);
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

        var rawBall   = needsSigmoid ? sigmoid(output[off + 5]) : output[off + 5];
        var rawHoop   = needsSigmoid ? sigmoid(output[off + 6]) : output[off + 6];
        var rawPlayer = needsSigmoid ? sigmoid(output[off + 7]) : output[off + 7];
        var ballScore   = obj * rawBall;    // class 0 = Basketball
        var hoopScore   = obj * rawHoop;    // class 1 = Hoop
        var playerScore = obj * rawPlayer;  // class 2 = Player

        var area = bw * bh;

        // Hoop candidates — threshold 0.10 balances precision vs recall
        // Area filter: hoop should be 0.1%-8% of frame (not 40%)
        // Aspect ratio: v6_polished boxes the rim+NET together, which lands
        // square-ish (w/h ≈ 0.9-1.3). The old ≥1.5 lower bound was tuned for
        // rim-only boxes and rejected ~100% of this model's real hoop
        // detections on eval footage (median conf 0.43 thrown away), leaving
        // rim-lock to feed on wide false positives. ≥0.55 keeps net-heavy
        // boxes while still dropping poles/players (≈0.3-0.5); ≤5.0 still
        // drops banners/scoreboards. Orange verification downstream
        // (_verifyHoopDet, _refineHoopByOrange) guards the rest.
        if (hoopScore > 0.10 && area > frameArea * 0.001 && area < frameArea * 0.08) {
          var hoopAspect = bw / (bh || 1);
          if (hoopAspect >= 0.55 && hoopAspect <= 5.0) {
            hoopCandidates.push({ cx: cx, cy: cy, bw: bw, bh: bh, score: hoopScore });
          }
        }

        // Player candidates — taller-than-wide bias, larger min area than ball.
        // Players don't have the strict aspect filter that hoops do, but we
        // reject ridiculously squat blobs (likely partial occlusions) and
        // anything bigger than half the frame (likely a misclassified close-up).
        if (playerScore > 0.20 && area > frameArea * 0.005 && area < frameArea * 0.50) {
          var playerAspectVert = bh / (bw || 1);  // height/width
          if (playerAspectVert >= 0.7) {           // approximately upright
            playerCandidates.push({ cx: cx, cy: cy, bw: bw, bh: bh, score: playerScore });
          }
        }

        // Ball candidates — size + aspect ratio filter
        if (area < frameArea * BALL_MIN_AREA_FRAC || area > frameArea * BALL_MAX_AREA_FRAC) continue;
        var aspect = Math.max(bw, bh) / (Math.min(bw, bh) || 1);
        if (aspect > 3.0) continue;

        // p12 (offline): collect ball candidates at a LOWER floor (0.02)
        // for the offline timeline classifier. Mid-flight and inside-net
        // balls legitimately score 0.02-0.05 (motion blur, net occlusion);
        // the offline classifier separates them from noise via trajectory
        // geometry, which per-frame thresholds cannot do. Validated on the
        // Dr.Dish eval: verdict evidence had scores as low as 0.03.
        if (this._offlineBallScratch && ballScore >= 0.02) {
          this._offlineBallScratch.push({ cx: cx, cy: cy, bw: bw, bh: bh, score: ballScore });
        }

        if (ballScore >= BALL_CONFIDENCE) {
          ballCandidates.push({ cx: cx, cy: cy, bw: bw, bh: bh, score: ballScore });
        }
      }

      // Debug: log detection counts every 30 frames
      if (DEBUG) {
        if (!this._dbgFrame) this._dbgFrame = 0;
        if (++this._dbgFrame % 30 === 0) {
          var bestHoop = hoopCandidates.reduce(function(b,c){ return c.score > b ? c.score : b; }, 0);
          var bestBall = ballCandidates.reduce(function(b,c){ return c.score > b ? c.score : b; }, 0);
          var bestPlayer = playerCandidates.reduce(function(b,c){ return c.score > b ? c.score : b; }, 0);
          dlog('[YOLOX] balls=' + ballCandidates.length + ' hoops=' + hoopCandidates.length + ' players=' + playerCandidates.length +
            ' bestBall=' + bestBall.toFixed(3) + ' bestHoop=' + bestHoop.toFixed(3) + ' bestPlayer=' + bestPlayer.toFixed(3));
        }
      }

      // Apply NMS (IoU threshold 0.45)
      var NMS_THRESH = 0.45;
      var ballKeep   = this._greedyNMS(ballCandidates,   NMS_THRESH);
      var hoopKeep   = this._greedyNMS(hoopCandidates,   NMS_THRESH);
      var playerKeep = this._greedyNMS(playerCandidates, NMS_THRESH);

      // Store latest hoop detection for auto rim-lock (use UNFILTERED hoopKeep
      // here — the auto-lock needs the strongest raw signal). We rebuild a
      // filtered list separately below for the overlay.
      //
      // L11.2: refine the hoop Y by searching for the canonical ORANGE rim
      // ring color downward from the YOLOX bbox. YOLOX sometimes detects
      // the backboard top / clamp area instead of the rim itself (especially
      // on indoor gym setups). Percentage-of-bbox offsets can't fix this
      // when the gap between bbox and real rim is larger than the bbox
      // itself. Snapping to the orange band gives us the actual rim Y.
      if (hoopKeep.length > 0) {
        var refined = this._refineHoopByOrange(hoopKeep[0], pw, ph);
        // Replace the first detection in-place so onDebugFrame also shows
        // the corrected position, not just the auto-lock pipeline.
        hoopKeep[0] = refined;
      }
      this._lastHoopDetection = hoopKeep.length > 0 ? hoopKeep[0] : null;

      // p12: OFFLINE FRAME DETECTIONS DISPATCH. Hands the offline processor
      // the full per-frame picture — low-floor ball candidates (pre L10.4
      // rim-zone filtering, which exists to protect the REAL-TIME tracker
      // and would delete exactly the at-rim evidence the offline classifier
      // needs), refined hoops, and players — in processing-canvas pixels.
      // The offline classifier does geometry over the whole timeline instead
      // of the state machine.
      if (this._offlineBallScratch && typeof this.onFrameDetections === 'function') {
        try {
          this.onFrameDetections({
            t: this.videoEl ? (this.videoEl.currentTime || 0) : 0,
            pw: pw, ph: ph,
            balls: this._greedyNMS(this._offlineBallScratch, 0.45).slice(0, 5),
            hoops: hoopKeep.slice(0, 3),
            players: playerKeep.slice(0, 3)
          });
        } catch (e) { /* collector must never break decode */ }
        this._offlineBallScratch = null;
      }

      // L12: preflight tally — only counts while still calibrating so the
      // counters stop growing once we're live.
      // L12.2: each detection runs through a verifier first. Only VALID
      // detections count. Failed reasons are stashed so the UI can show
      // why a particular entity is stuck.
      if (!this._preflightReady && this._preflightChecks) {
        var pf = this._preflightChecks;
        if (!pf.lastReason) pf.lastReason = { ball: null, hoop: null, player: null };
        if (hoopKeep.length > 0) {
          var hv = this._verifyHoopDet(hoopKeep[0], pw, ph);
          if (hv.valid) { pf.hoop++; pf.lastReason.hoop = null; }
          else pf.lastReason.hoop = hv.reason;
        }
        if (playerKeep.length > 0) {
          var pv = this._verifyPlayerDet(playerKeep[0], pw, ph);
          if (pv.valid) { pf.player++; pf.lastReason.player = null; }
          else pf.lastReason.player = pv.reason;
        }
        if (ballKeep.length > 0) {
          var bv = this._verifyBallDet(ballKeep[0], pw, ph);
          if (bv.valid) { pf.ball++; pf.lastReason.ball = null; }
          else pf.lastReason.ball = bv.reason;
        }
        var t = this._preflightThresholds;
        if (pf.ball   >= t.ball &&
            pf.hoop   >= t.hoop &&
            pf.player >= t.player) {
          this._preflightReady = true;
          if (typeof this.onPreflightReady === 'function') {
            try { this.onPreflightReady({ elapsedMs: Date.now() - (this._preflightStartedAt || 0) }); }
            catch (e) { console.warn('[ShotDetection] onPreflightReady cb error:', e); }
          }
        }
      }

      // ── L10.4: Rim-zone-aware false-ball filter ──
      // The v6_polished model produces 30-50% ball scores on the basketball
      // rim itself, on logos painted on the wall, and on other round-orange
      // objects. These pass BALL_CONFIDENCE=0.05 easily and pollute the
      // tracker. The classic fix is to retrain — but until then we can
      // suppress most false positives at runtime: any ball detection inside
      // the locked rim zone (and adjacent areas) is rejected unless a shot
      // is actively in progress (shot_started / near_hoop), since that's
      // the only legitimate moment for the ball to be at rim level.
      var rim = this.rimZone;
      if (rim && this._rimStabilized) {
        var inShotState = (this._shotState === 'shot_started' || this._shotState === 'near_hoop');
        if (!inShotState) {
          // Expanded rim zone — catches balls "on the rim" plus a small
          // halo around it. Tuned to also catch logos painted just below
          // the rim (e.g. the Oregon "O" in the user's test video).
          //
          // L30: only reject STATIC REPEATS inside the zone. The FPs this
          // filter targets (wall logos, the rim itself scored as "ball")
          // re-detect at the same spot frame after frame; a real ball
          // FLYING through the rim zone lands somewhere new each sample.
          // The old reject-everything version deleted exactly the above-
          // rim / at-rim evidence the L26 idle trigger and the through-rim
          // evidence collector need — untriggered shots became invisible.
          var rimNX = rim.centerX, rimNY = rim.centerY;
          var rimNW = rim.width  || 0.10;
          var rimNH = rim.height || 0.04;
          var expL = rimNX - rimNW * 1.5;
          var expR = rimNX + rimNW * 1.5;
          var expT = rimNY - rimNH * 4.0;
          var expB = rimNY + rimNH * 6.0;  // extends DOWN to cover wall logos
          var selfFilt = this;
          var nowFilt = Date.now();
          ballKeep = ballKeep.filter(function (b) {
            var bxN = b.cx / pw;
            var byN = b.cy / ph;
            var insideExpRim = (bxN >= expL && bxN <= expR && byN >= expT && byN <= expB);
            if (!insideExpRim) return true;
            var lr = selfFilt._lastRimZoneBallReject;
            var staticRepeat = !!(lr && (nowFilt - lr.ts) < 1200 &&
                                  Math.abs(bxN - lr.x) < 0.035 &&
                                  Math.abs(byN - lr.y) < 0.035);
            selfFilt._lastRimZoneBallReject = { x: bxN, y: byN, ts: nowFilt };
            return !staticRepeat;
          });
        }
      }

      // ── L10.5: Hide stale HOOP detections far from the locked rim ──
      // After auto-rim-lock, per-frame YOLOX hoop detections that appear far
      // from the locked position (e.g. scoreboard area, ceiling beams) are
      // hallucinations. They don't affect logic (state machine uses the
      // locked rimZone), but they confuse the user visually. Filter for the
      // overlay only — the auto-lock above already grabbed _lastHoopDetection
      // from the unfiltered list before this point.
      var hoopKeepDisplay = hoopKeep;
      if (rim && this._rimStabilized) {
        var rimNXh = rim.centerX, rimNYh = rim.centerY;
        var MAX_HOOP_DRIFT = 0.20; // 20% of normalized frame distance
        hoopKeepDisplay = hoopKeep.filter(function (h) {
          var hxN = h.cx / pw, hyN = h.cy / ph;
          var dx = hxN - rimNXh, dy = hyN - rimNYh;
          return Math.sqrt(dx * dx + dy * dy) <= MAX_HOOP_DRIFT;
        });
      }

      // Store latest player detections — top 3 by score, used to localize the
      // shooter for pose-driven shot zone classification (and to dedupe pose
      // hallucinations on empty frames against a real "is there a person?" signal).
      this._lastPlayerDetections = playerKeep.slice(0, 3);

      // Debug overlay: fire all raw detections in PROCESSING-CANVAS space.
      // The display canvas matches the visible (full) video, so the overlay
      // needs the crop offset and crop scale to map proc-canvas coords back
      // through the cropped region into full-video space. videoW / videoH
      // let the consumer compute the final display-canvas scale.
      if (this.onDebugFrame) {
        var fullVw = (this.videoEl && this.videoEl.videoWidth) || pw;
        var fullVh = (this.videoEl && this.videoEl.videoHeight) || ph;
        this.onDebugFrame({
          balls:        ballKeep,
          hoops:        hoopKeepDisplay,      // L10.5: filtered for visual clarity
          players:      playerKeep,           // 3-class model adds player detections
          shotState:    this._shotState,
          frameCount:   this._frameCount,
          // Phase L3: trajectory + crossing for visual debug
          // trajectory is in NORMALIZED video coords (0..1), same space as rim
          trajectory:   this._shotTrajectory || [],
          lastCrossing: this._lastCrossing || null,
          // L7 diagnostic: latest pose-trigger/crossing decision + counters.
          // Lets the debug overlay show "is PoseDetector even seeing shooting
          // motion?" — distinguishes a missed trigger from a downstream drop.
          lastShotReason: this._lastShotReason || null,
          poseStats:    this._poseStats     || null,
          // L12: preflight calibration status for the screen overlay.
          preflight:    {
            ready:       !!this._preflightReady,
            checks:      this._preflightChecks     || { ball: 0, hoop: 0, player: 0 },
            thresholds:  this._preflightThresholds || { ball: 3, hoop: 5, player: 3 }
          },
          procW:        pw,
          procH:        ph,
          videoW:       fullVw,
          videoH:       fullVh,
          cropOffsetX:  this._cropOffsetX || 0,
          cropOffsetY:  this._cropOffsetY || 0,
          cropScaleX:   this._cropScaleX  || 1,
          cropScaleY:   this._cropScaleY  || 1
        });
      }

      return ballKeep.length > 0 ? ballKeep[0] : null;
    },

    /* ── L11.2: Refine hoop Y by orange-rim color search ─────────
       YOLOX sometimes anchors the hoop bbox on the backboard top or the
       clamp/truss above the actual orange ring. Percentage-of-bbox offsets
       can't compensate when the gap is larger than the bbox itself.
       Strategy: scan a vertical strip below the bbox (and a bit above for
       safety) within the bbox's X range. For each row, count pixels
       matching the canonical basketball-orange test. The row with peak
       orange density is the rim's actual Y. If no strong orange band is
       found (e.g. partially occluded, weird lighting, B&W footage) we
       return the original hoop — the L11.1 aspect-aware offset still
       applies downstream.
       ────────────────────────────────────────────────────────────── */
    _refineHoopByOrange: function (hoop, pw, ph) {
      if (!hoop || !this._ctx) return hoop;

      var ctx = this._ctx;
      var cx = hoop.cx, cy = hoop.cy, bw = hoop.bw, bh = hoop.bh;

      // Scan region: from a bit above the bbox top down ~15% of frame.
      // Width matches the bbox plus a small horizontal margin so we catch
      // ring edges when the bbox is slightly off-center.
      // Scan window anchored to the BOX TOP: v6_polished boxes CONTAIN the
      // rim line (square rim+net boxes carry the ring ~6% of box height
      // below the top edge; wide rim-only boxes carry it near the center).
      // The old window extended 15% of the FRAME below the box — a v71-era
      // relic for backboard-anchored boxes whose ring sat far below. On v6
      // footage that tail reached the BALL during layups/rim-rolls, and the
      // ball's much stronger orange hijacked the snap: eval v3 locked the
      // "rim" 0.14 below the ring, on a row the ball had just occupied,
      // and the L19 freeze then cemented the error for the whole session.
      var boxTop     = cy - bh * 0.5;
      var scanTop    = Math.max(0,  Math.floor(boxTop - bh * 0.3));
      var scanBottom = Math.min(ph - 1, Math.floor(boxTop + bh * 0.9));
      // Margin widened 0.10 → 0.25: when YOLOX anchors the box slightly to
      // one side of the ring (seen on outdoor eval footage — lock ended up
      // 0.06 left of the true ring), the ring edge falls outside a narrow
      // strip and the refinement never fires.
      var margin     = Math.max(2, Math.floor(bw * 0.25));
      var scanLeft   = Math.max(0,  Math.floor(cx - bw / 2 - margin));
      var scanRight  = Math.min(pw, Math.floor(cx + bw / 2 + margin));
      var scanW      = scanRight - scanLeft;
      var scanH      = scanBottom - scanTop;
      if (scanW < 5 || scanH < 5) return hoop;

      var data;
      try {
        data = ctx.getImageData(scanLeft, scanTop, scanW, scanH).data;
      } catch (e) {
        return hoop;  // permission error or canvas tainted
      }

      // For each row, count orange pixels AND accumulate their x-sum so the
      // winning band also yields a horizontal centroid. Same color test as
      // _verifyOrange.
      var bestRow = -1;
      var maxOrange = 0;
      // Require the rim band to be at least 8% of the row width — anything
      // less is likely noise rather than a real ring.
      var minOrangeCount = Math.max(3, Math.floor(scanW * 0.08));
      var rowCounts = new Int32Array(scanH);
      var rowSumX   = new Float64Array(scanH);

      for (var ry = 0; ry < scanH; ry++) {
        var rowStart = ry * scanW * 4;
        var count = 0;
        var sumX = 0;
        for (var rx = 0; rx < scanW; rx++) {
          var idx = rowStart + rx * 4;
          var r = data[idx], g = data[idx + 1], b = data[idx + 2];
          if (r > 120 && g > 40 && g < 180 && b < 100 && r > g * 1.15 && r > b * 1.6) {
            count++;
            sumX += rx;
          }
        }
        rowCounts[ry] = count;
        rowSumX[ry]   = sumX;
        if (count > maxOrange) {
          maxOrange = count;
          bestRow = ry;
        }
      }

      if (bestRow >= 0 && maxOrange >= minOrangeCount) {
        var refinedCy = scanTop + bestRow;
        // Horizontal centroid of the rim band (best row ±1 for stability).
        // YOLOX box centers drift off the ring when the box includes pole /
        // backboard / caption pixels; cy alone was snapped to the orange but
        // cx kept the bad box center — outdoor eval locked 0.06 left of the
        // real ring. Centroid of the orange band IS the ring center.
        var bandCount = 0, bandSumX = 0;
        for (var by = Math.max(0, bestRow - 1); by <= Math.min(scanH - 1, bestRow + 1); by++) {
          bandCount += rowCounts[by];
          bandSumX  += rowSumX[by];
        }
        var refinedCx = cx;
        if (bandCount >= minOrangeCount) {
          var centroidX = scanLeft + bandSumX / bandCount;
          // Sanity: don't chase orange far outside the box (banner edge,
          // second hoop) — cap the shift at 60% of box width.
          if (Math.abs(centroidX - cx) <= bw * 0.6) refinedCx = centroidX;
        }

        // ── Phase 7: ELLIPSE EXTENT from orange pixels ──────────────────
        // YOLO's bbox is a rough envelope around "the hoop region", which
        // includes the backboard cut and net cone. The TRUE rim is an
        // ellipse with width = ring diameter and height = ring depth ×
        // sin(camera angle). We can read this off the orange pixels: scan
        // a vertical band around `bestRow` for ALL rows with ≥ 30% of the
        // peak orange count; that's the orange ring's vertical extent.
        // In each of those rows the leftmost and rightmost orange pixels
        // give the horizontal extent. Both extents in PROC pixels — we
        // return them as bw/bh so downstream consumers (transit windows,
        // polyfit tolerance, debug ellipse) get TIGHT, ACCURATE rim
        // geometry instead of YOLO's loose box.
        var bandThresh = Math.max(2, Math.floor(maxOrange * 0.30));
        var topBand = bestRow, botBand = bestRow;
        for (var tb = bestRow - 1; tb >= 0; tb--) {
          if (rowCounts[tb] < bandThresh) break;
          topBand = tb;
        }
        for (var bb = bestRow + 1; bb < scanH; bb++) {
          if (rowCounts[bb] < bandThresh) break;
          botBand = bb;
        }
        // ── Phase 8: precise CONTOUR extraction ──────────────────────
        // Walk EACH COLUMN in the orange band — for each column find the
        // topmost and bottommost orange pixel. Those points form two
        // polylines: the UPPER edge of the ring and the LOWER edge.
        // Together they trace the rim's actual silhouette under the
        // current camera perspective (rim is an ellipse foreshortened by
        // the viewing angle), without any geometric approximation. The
        // upper and lower polylines are emitted as the rim CONTOUR for
        // visual rendering and for downstream geometric tests.
        //
        // Same loop also collects global X-extent (minOX/maxOX) so the
        // Phase 7 tight bw/bh computation below stays correct.
        var contourTopPts = [];   // upper edge of the ring, in PROC px
        var contourBotPts = [];   // lower edge of the ring, in PROC px
        var minOX = scanW, maxOX = -1;
        for (var col = 0; col < scanW; col++) {
          var topY = -1, botY = -1;
          for (var row = topBand; row <= botBand; row++) {
            var idx = row * scanW * 4 + col * 4;
            var pr = data[idx], pg = data[idx + 1], pb = data[idx + 2];
            if (pr > 120 && pg > 40 && pg < 180 && pb < 100 &&
                pr > pg * 1.15 && pr > pb * 1.6) {
              if (topY < 0) topY = row;
              botY = row;
            }
          }
          if (topY >= 0) {
            contourTopPts.push({ x: scanLeft + col, y: scanTop + topY });
            contourBotPts.push({ x: scanLeft + col, y: scanTop + botY });
            if (col < minOX) minOX = col;
            if (col > maxOX) maxOX = col;
          }
        }

        var refinedBw = bw, refinedBh = bh;
        if (maxOX > minOX) {
          var orangeW = (maxOX - minOX) + 2;
          var orangeH = (botBand - topBand) + 2;
          // Sanity-clamp against the YOLO bbox: orange-derived dims should
          // be within 1.5× the YOLO box — otherwise we're chasing rogue
          // orange pixels (the ball, a logo, an awning).
          if (orangeW <= bw * 1.5 && orangeH <= bh * 1.5 &&
              orangeW >= 5 && orangeH >= 2) {
            refinedBw = orangeW;
            refinedBh = orangeH;
            // Re-center on orange extent's MIDPOINT — small horizontal
            // re-centring, dominant only when the YOLO box was way off.
            var orangeCenterX = scanLeft + (minOX + maxOX) * 0.5;
            if (Math.abs(orangeCenterX - refinedCx) <= bw * 0.4) {
              refinedCx = orangeCenterX;
            }
          }
        }

        // Convert contour to NORMALIZED video coords [0..1] so downstream
        // consumers don't need to know about the processing canvas size.
        // We thin the polylines to ≤ 32 points each (sample every Nth
        // column) so the JSON object stays small per frame.
        var rimContourTop = null, rimContourBot = null;
        var contourValid = contourTopPts.length >= 5 &&
                           contourTopPts.length === contourBotPts.length;
        if (contourValid) {
          var STEP = Math.max(1, Math.floor(contourTopPts.length / 32));
          rimContourTop = [];
          rimContourBot = [];
          for (var ci = 0; ci < contourTopPts.length; ci += STEP) {
            rimContourTop.push({
              x: contourTopPts[ci].x / pw,
              y: contourTopPts[ci].y / ph
            });
            rimContourBot.push({
              x: contourBotPts[ci].x / pw,
              y: contourBotPts[ci].y / ph
            });
          }
          // Always include the final point so the polyline closes neatly
          var last = contourTopPts.length - 1;
          if ((last % STEP) !== 0) {
            rimContourTop.push({ x: contourTopPts[last].x / pw, y: contourTopPts[last].y / ph });
            rimContourBot.push({ x: contourBotPts[last].x / pw, y: contourBotPts[last].y / ph });
          }
        }

        // Stash flag so downstream knows the position came from a color
        // search, not just the YOLOX bbox center. ShotTrackingScreen uses
        // this to skip the BBOX_RIM_OFFSET_FRAC adjustment (which would
        // over-shoot when the position is already on the orange).
        return {
          cx: refinedCx, cy: refinedCy, bw: refinedBw, bh: refinedBh,
          score:        hoop.score,
          colorRefined: true,
          colorMass:    maxOrange,
          // Phase 8: precise contour (normalized coords) for rendering +
          // geometric tests. Null if extraction failed or band too small.
          rimContour:   rimContourTop && rimContourBot
            ? { top: rimContourTop, bot: rimContourBot }
            : null
        };
      }

      return hoop;
    },

    /* ── L32: Global camera-motion estimate ────────────────────────
       Coarse whole-frame SAD search on a 96×54 gray thumbnail of the
       processing canvas (±5 thumb-px ≈ ±5% of frame width per tick).
       When the camera pans, the locked rim must RIDE the scene — YOLOX
       hoop detections are far too sparse on small/far rims to re-anchor
       in time (eval v1: ~37% of the video sat in hoop-lost windows
       during pans and every shot there went uncounted). Emits
       onGlobalMotion with the SCENE displacement in full-video
       normalized coords; the screen shifts its locked rim by exactly
       that. Static cameras emit nothing.
       ────────────────────────────────────────────────────────────── */
    _estimateGlobalMotion: function (pw, ph, vw, vh) {
      if (!this._canvas || !this.onGlobalMotion) return;
      var GW = 96, GH = 54;
      if (!this._gmCanvas) {
        this._gmCanvas = document.createElement('canvas');
        this._gmCanvas.width = GW; this._gmCanvas.height = GH;
        this._gmCtx = this._gmCanvas.getContext('2d', { willReadFrequently: true });
      }
      var data;
      try {
        this._gmCtx.drawImage(this._canvas, 0, 0, GW, GH);
        data = this._gmCtx.getImageData(0, 0, GW, GH).data;
      } catch (e) { return; }
      var n = GW * GH;
      var cur = new Uint8ClampedArray(n);
      for (var i = 0, j = 0; i < n; i++, j += 4) {
        cur[i] = (data[j] * 3 + data[j + 1] * 4 + data[j + 2]) >> 3;
      }
      var prev = this._gmPrev;
      this._gmPrev = cur;
      if (!prev || prev.length !== n) return;

      var R = 5;  // search radius in thumbnail px
      var bestDx = 0, bestDy = 0, bestSad = Infinity, zeroSad = 0;
      for (var dy = -R; dy <= R; dy++) {
        for (var dx = -R; dx <= R; dx++) {
          var sad = 0;
          for (var y = R + 1; y < GH - R - 1; y += 2) {
            var rowC = y * GW, rowP = (y + dy) * GW + dx;
            for (var x = R + 1; x < GW - R - 1; x += 2) {
              sad += Math.abs(cur[rowC + x] - prev[rowP + x]);
            }
          }
          if (dx === 0 && dy === 0) zeroSad = sad;
          if (sad < bestSad) { bestSad = sad; bestDx = dx; bestDy = dy; }
        }
      }
      // Static camera / ambiguous match → no shift. The 0.8 factor keeps
      // noise and local object motion (players) from masquerading as pans.
      if ((bestDx === 0 && bestDy === 0) || bestSad > zeroSad * 0.8) return;
      // cur[x] matches prev[x+bestDx] → the scene moved by -bestDx (proc px).
      var sceneDxProc = -bestDx * (pw / GW);
      var sceneDyProc = -bestDy * (ph / GH);
      var dxNorm = sceneDxProc * (this._cropScaleX || 1) / Math.max(1, vw);
      var dyNorm = sceneDyProc * (this._cropScaleY || 1) / Math.max(1, vh);
      this.onGlobalMotion(dxNorm, dyNorm);
    },

    /* ── L31: Rim-transit detector ─────────────────────────────────
       The v6 model frequently CANNOT see the ball in flight (compressed
       footage, motion blur, washed-out color) — eval showed entire makes
       with zero in-corridor ball detections even at 10fps offline. But a
       basketball passing through the rim is a huge orange mass moving
       through two small, KNOWN windows. So: count orange pixels in a
       window just ABOVE the rim line and one in the net cone BELOW it,
       every processing tick (~3-5× the YOLOX cadence), against a slowly
       learned per-window baseline (absorbs the rim's own orange, wall
       logos, fence flowers…). An A-spike followed by a B-spike within
       1.2s = the ball went THROUGH — this feeds the same
       _ballAboveRimAt/_ballThroughRimAt evidence fields the counting
       logic already consumes. A ball that rolls off the rim keeps A+B
       spiking SIMULTANEOUSLY (gap < one tick) and never satisfies the
       ordered test; a ball deflected outside the net never spikes B.
       ────────────────────────────────────────────────────────────── */
    _updateRimTransit: function (pw, ph, vw, vh) {
      if (!this.rimZone || !this._rimStabilized || !this._ctx) return;
      var rim = this.rimZone;
      var sx = this._cropScaleX || 1, sy = this._cropScaleY || 1;
      var ox = this._cropOffsetX || 0, oy = this._cropOffsetY || 0;
      // rim normalized (full-video space) → processing-canvas px
      var rimPx = ((rim.centerX * vw) - ox) / sx;
      var rimPy = ((rim.centerY * vh) - oy) / sy;
      var rimPw = Math.max(10, (rim.width  || 0.10) * vw / sx);
      var rimPh = Math.max(5,  (rim.height || 0.04) * vh / sy);
      if (rimPx < 0 || rimPx > pw || rimPy < 0 || rimPy > ph) return;

      var aX = Math.floor(rimPx - rimPw * 0.8), aW = Math.floor(rimPw * 1.6);
      var aY = Math.floor(rimPy - rimPh * 3.5), aH = Math.floor(rimPh * 3.0);
      // B is NARROW (±0.45×rim width): the net cone. Eval v3 n8 (rim hit
      // deflecting down-left just outside the net) clipped the edge of a
      // ±0.6 window and produced a false "through" — a real make passes
      // well inside the cone.
      var bX = Math.floor(rimPx - rimPw * 0.45), bW = Math.floor(rimPw * 0.9);
      var bY = Math.floor(rimPy + rimPh * 0.7), bH = Math.floor(rimPh * 3.5);
      if (aW < 6 || aH < 3 || bW < 6 || bH < 3) return;
      // Control region: same size as B, shifted sideways — calibrates out
      // GLOBAL motion (camera pan/zoom lights every window equally).
      var cShift = Math.floor(rimPw * 2.2);
      var cX = (bX + bW + cShift + bW <= pw) ? bX + cShift + bW : bX - cShift - bW;

      var a = this._scanTransitRegion('A', aX, aY, aW, aH, pw, ph);
      var b = this._scanTransitRegion('B', bX, bY, bW, bH, pw, ph);
      var c = this._scanTransitRegion('C', cX, bY, bW, bH, pw, ph);
      if (!a || !b) return;
      if (this._transitBaseA == null) {
        this._transitBaseA  = a.orange; this._transitBaseB  = b.orange;
        this._transitSadBaseA = 0; this._transitSadBaseB = 0;
        return;
      }

      var nowT = Date.now();
      var ctrlHot = c ? c.hot : 0;

      // ── Phase 6: STATIC-SCENE detector ─────────────────────────────
      // The L34/L35 pause gate only catches `videoEl.paused === true`. When
      // the user pauses the SOURCE basketball video on their phone but the
      // CAMERA is rolling (recording the screen showing a static frame),
      // the videoEl never pauses — yet iPhone sensor noise, codec micro-
      // adjustments, and hand jitter still produce A/B/C motion spikes,
      // which fire `_ballThroughRimAt` → false MADE while nothing is
      // actually moving. The user confirmed this is happening.
      //
      // Discriminator: a real shot creates LOCALIZED motion (rim region
      // far higher than control). Sensor/JPEG/jitter noise lights ALL
      // windows roughly equally — a, b, c all hover near a noise floor.
      //
      // We average the three windows' hot fractions over a ~700ms sliding
      // window. If the SUM stays below 0.04 (each window contributes its
      // own noise, total < 4%) for the whole window, we declare the scene
      // STATIC and gate all counting. The flag drops as soon as any
      // window exceeds the threshold — a player walking back into frame
      // or the source video resuming.
      var sumHot = (a.hot + b.hot + ctrlHot);
      if (!this._sceneHotHist) this._sceneHotHist = [];
      this._sceneHotHist.push({ t: nowT, h: sumHot });
      // prune older than 700ms
      while (this._sceneHotHist.length > 0 && nowT - this._sceneHotHist[0].t > 700) {
        this._sceneHotHist.shift();
      }
      var maxRecent = 0;
      for (var sh = 0; sh < this._sceneHotHist.length; sh++) {
        if (this._sceneHotHist[sh].h > maxRecent) maxRecent = this._sceneHotHist[sh].h;
      }
      // Need at least 10 samples (≈350ms at 30fps) before judging static.
      // p11: never declare "static" in offline mode. The static gate exists
      // to suppress a FROZEN live camera source; offline we seek genuinely
      // different frames, and the between-shot lulls on a tripod clip
      // (empty court while the ball returns) could otherwise trip it and
      // silently drop shots.
      var prevSceneStatic = !!this._sceneStatic;
      if (!this._offlineMode && this._sceneHotHist.length >= 10) {
        this._sceneStatic = (maxRecent < 0.04);
      } else if (this._offlineMode) {
        this._sceneStatic = false;
      }
      if (this._sceneStatic && !prevSceneStatic) {
        this._logShotEvent('scene-static-on', { sumHotMax: +maxRecent.toFixed(3) });
      } else if (!this._sceneStatic && prevSceneStatic) {
        this._logShotEvent('scene-static-off', { sumHotMax: +maxRecent.toFixed(3) });
      }
      // Hard short-circuit: while static, every other branch below is a
      // false-positive. Skip the rest of the rim-transit work — no spike
      // computation, no arming, no resolution.
      if (this._sceneStatic) return;

      // Two channels per window:
      //  • orange-mass spike — saturated footage (outdoor, gyms)
      //  • motion HOT-FRACTION spike (share of pixels whose gray changed
      //    by >25 since the previous tick) — compressed/washed footage
      //    where the ball fails the orange test entirely (eval v3: the
      //    model's own ball candidates died on "not orange"). Hot-fraction
      //    beats mean-abs-diff: a transiting ball is a compact blob of
      //    LARGE deltas (~10-25% of the window), while net sway and codec
      //    shimmer are wide fields of small deltas.
      // Camera-pan veto: a pan lights EVERY window — when the control
      // region (same size as B, off to the side) is mostly hot, nothing
      // counts. A ratio guard was tried first and suppressed putback/tip
      // plays (the player's own body motion lit the control region while
      // the actual ball action was at the rim) — eval v3 lost every
      // at-rim play of the second half to it. Hard veto only.
      // L36.6: COLOR channels DISABLED per user policy ("balls come in many
      // colours — don't use colors"). Orange spike compute is left in for
      // logging only; aSpike/bSpike are driven exclusively by the MOTION
      // (hot) channel, which is colour-independent — it measures the
      // fraction of pixels whose GRAY value changed by >25 between ticks.
      // Any moving ball-sized blob lights up motion regardless of colour;
      // codec shimmer and net sway do not.
      var aOrangeSpike = a.orange > Math.max(this._transitBaseA * 1.8, this._transitBaseA + 10);
      var bOrangeSpike = b.orange > Math.max(this._transitBaseB * 1.8, this._transitBaseB + 10);
      var panVeto = ctrlHot > 0.45;
      var aHotSpike = !panVeto && a.hot > Math.max(0.05, this._transitSadBaseA * 2.5);
      var bHotSpike = !panVeto && b.hot > Math.max(0.05, this._transitSadBaseB * 2.5);
      var aSpike = aHotSpike;     // L36.6: was aOrangeSpike || aHotSpike
      var bSpike = bHotSpike;     // L36.6: was bOrangeSpike || bHotSpike
      // Baselines learn ONLY from non-spike ticks so the ball itself is
      // never absorbed into "normal". Hot-fraction baseline is SLOW
      // (≈3%/tick) — sustained at-rim action must not become "normal"
      // within a couple of seconds.
      if (!aOrangeSpike) this._transitBaseA = this._transitBaseA * 0.95 + a.orange * 0.05;
      if (!bOrangeSpike) this._transitBaseB = this._transitBaseB * 0.95 + b.orange * 0.05;
      if (!aHotSpike) this._transitSadBaseA = this._transitSadBaseA * 0.97 + a.hot * 0.03;
      if (!bHotSpike) this._transitSadBaseB = this._transitSadBaseB * 0.97 + b.hot * 0.03;

      if (DEBUG) {
        this._transitDbgN = (this._transitDbgN || 0) + 1;
        if (this._transitDbgN % 20 === 0) {
          dlog('[Transit] oA=' + a.orange + '/' + this._transitBaseA.toFixed(0) +
               ' oB=' + b.orange + '/' + this._transitBaseB.toFixed(0) +
               ' hotA=' + a.hot.toFixed(2) + '/' + this._transitSadBaseA.toFixed(2) +
               ' hotB=' + b.hot.toFixed(2) + '/' + this._transitSadBaseB.toFixed(2) +
               ' hotC=' + ctrlHot.toFixed(2) +
               ' spikes=' + (aSpike ? 'A' : '-') + (bSpike ? 'B' : '-'));
        }
      }

      // Ordered transit test uses the PREVIOUS tick's above-time, so a
      // ball sitting on the rim (A+B lit together, gap≈0) never passes.
      // Centrality guard: whichever channel fires B, its blob centroid
      // must be in the MIDDLE of the net cone — a deflection clipping the
      // window's edge (eval n8: rim hit exiting down-left just outside
      // the net) kept producing a false through. L33: tightened to
      // 0.28-0.72 and applied to the ORANGE channel too (it had no
      // centrality check at all).
      // L37.1: Centrality gate on BOTH A and B. A real ball passes through
      // the CENTRE of both windows (the rim is centred in each); a player
      // crossing laterally lights only the EDGES of the windows. Without
      // an A-centrality check, a player jumping for a rebound in the A
      // zone followed by any motion in the B zone produced a false
      // through-rim. Cuts the "player crossing rim region = false MADE"
      // class of phantoms (from the post-L36.6 audit).
      var aFireCx = aHotSpike ? a.hotCx : (aOrangeSpike ? a.orangeCx : null);
      var aCentered = aFireCx == null || (aFireCx >= 0.25 && aFireCx <= 0.75);
      var bFireCx = bHotSpike ? b.hotCx : (bOrangeSpike ? b.orangeCx : null);
      var bCentered = bFireCx == null || (bFireCx >= 0.28 && bFireCx <= 0.72);
      var prevAboveAt = this._transitAboveAt || 0;
      if (bSpike && bCentered && aCentered && prevAboveAt &&
          nowT - prevAboveAt >= 60 && nowT - prevAboveAt <= 1200 &&
          !this._ballThroughRimAt) {
        this._ballThroughRimAt = nowT;
        this._logShotEvent('rim-transit-through', {
          aOrange: a.orange, bOrange: b.orange,
          aHot: +a.hot.toFixed(2), bHot: +b.hot.toFixed(2), ctrlHot: +ctrlHot.toFixed(2),
          aBase: +this._transitBaseA.toFixed(1), bBase: +this._transitBaseB.toFixed(1),
          msSinceAbove: nowT - prevAboveAt
        });
        // p9w: COUNT a rim-transit-through as an independent attempt when
        // POSE MISSED this shot. On the Dr.Dish clip pose catches only
        // 8/14 shooting motions (fast catch-and-shoot, distant shooter),
        // but the ball transits the net cleanly ~15×. This is the signal
        // that recovers the ~6 pose-missed shots.
        //
        // Why this does NOT reproduce the Phase-9n regression (which
        // raced pose and made recall worse): 9n counted EVERY transit as
        // its own attempt, so a shot caught by BOTH pose and transit
        // double-counted, and mid-flight transits fired while pose was
        // still resolving. The two hard gates below prevent that:
        //   • state === 'idle' — nothing is mid-resolution. A pose shot
        //     in flight sits in shot_started/near_hoop, so its transit is
        //     ignored here and resolved by the pose path instead.
        //   • ≥1500ms since the last counted shot — pose fires ~1s BEFORE
        //     the ball reaches the rim, so the pose count for THIS shot
        //     has already landed <1.5s ago and this transit is deduped.
        //     Shots are ≥3s apart on this footage, so real distinct shots
        //     are never merged.
        // Default verdict 'made': a centered A→B transit through the net
        // cone is the geometry of a make; front-rim bounce-outs deflect
        // sideways and fail the B-centrality gate above, so they don't
        // reach here.
        // p11: SKIP this recall-booster path in offline mode. It exists to
        // catch shots real-time pose sampling misses, defaulting them to
        // 'made' with no verdict. Offline pose fires on every frame and the
        // polyfit verdict decides made/miss accurately, so this path only
        // adds duplicate 'made' counts ~0.6s (video) after the real pose
        // count — inflating the total and skewing the made/miss ratio.
        if (!this._offlineMode &&
            this._shotState === 'idle' &&
            (nowT - (this.lastShotTime || 0) > 1500) &&
            this.rimZone) {
          this._shotTriggerSrc   = 'rim-transit';
          this._ballSeenAtRim    = true;
          this._sawBallAboveRim  = true;
          this._countShot('made', vw, vh, this.rimZone.centerX, this.rimZone.centerY, nowT);
        }
      }
      if (aSpike) {
        this._transitAboveAt = nowT;
        this._ballAboveRimAt = nowT;
      }

      // ── L31.2: RIM-EVENT COUNTING ─────────────────────────────────
      // The A-window arrival is the most reliable "an attempt reached the
      // rim" signal on footage where YOLOX can't track the ball and pose
      // triggers are erratic (eval: pose fired 0.8-2.3s before the rim
      // arrival, so the 1.1s fallback kept counting shots BEFORE the ball
      // got there). Arm a rim event on the A-spike; resolve MADE the
      // moment through-evidence lands, or MISSED after 1.4s without it.
      // If a pose/ball-triggered shot is in flight, this resolves THAT
      // shot (single count, correct timing); from idle it counts an
      // attempt of its own.
      // L32: arming gap 800 → 650ms — rapid put-back sequences arrive
      // ~0.75s apart (eval v3 n3/n4 merged into one count at 800), while
      // a tip that bounces and re-enters (~450ms) must NOT split into two
      // events (500 produced a phantom double on eval n9).
      // L33: QUIET-BEFORE-ARRIVAL gate — a real shot arrives out of empty
      // sky, so the A-window must have been quiet for ≥450ms before this
      // spike. Sustained rim-area activity (a player standing under the
      // basket) keeps prevAboveAt fresh every tick and used to re-arm +
      // re-fire "made" roughly once per second (eval v1: three phantom
      // counts in 2s, trigger=None).
      // L37.2: Ball-evidence gate on rim-event arming. The motion-only A
      // spike fires on any moving blob in the area above the rim — a
      // player jumping for a rebound, a hand signal mid-clip, sideline
      // motion that bleeds into the window. Without a sanity gate, a pose
      // trigger that already fired (state != idle) plus an ambient A
      // spike was enough to arm an event, and a subsequent B spike from
      // unrelated player motion finished it as MADE. Require that if
      // we're already in a shot state, the ball has been detected by
      // YOLO recently — otherwise the rim event must come from a real
      // descending arc, not from pose-induced wishful thinking.
      // Phase 9 (radical simplification): RIM-EVENT ARMING + RESOLVE
      // DISABLED. The motion-based rim-transit detector was the largest
      // source of false MADEs — it fires on any moving object crossing
      // the A window (jumping player, ball-return machine, hand signal)
      // followed by any motion in the B window. The user selected the
      // radical single-path option: only pose→trajectory→polyfit counts.
      // Everything below is dead code kept for reference; nothing calls
      // `_countShot()` from `_updateRimTransit` anymore.
      //
      // if (aSpike && aCentered && armBallEvidenceOk && ...) arm event
      // if (this._transitEventAt) resolve made/missed
      //
      // Effect: `_transitEventAt` is never set, so the resolve block is
      // unreachable. Rim-transit signal is now advisory (still logs
      // scene-static state to power the pause gate).
    },

    /* L31: one-pass region scan → orange-pixel count + motion energy
       (mean abs gray diff vs the previous tick's pixels, stride 2).
       Returns null when the region is degenerate or the canvas is
       unreadable. Previous-frame buffers are kept per region key. */
    _scanTransitRegion: function (key, x0, y0, w, h, pw, ph) {
      if (x0 < 0) { w += x0; x0 = 0; }
      if (y0 < 0) { h += y0; y0 = 0; }
      if (x0 + w > pw) w = pw - x0;
      if (y0 + h > ph) h = ph - y0;
      if (w < 4 || h < 4) return null;
      var data;
      try { data = this._ctx.getImageData(x0, y0, w, h).data; }
      catch (e) { return null; }

      var stride = 2;
      var gw = Math.floor(w / stride), gh = Math.floor(h / stride);
      var n = gw * gh;
      if (!this._transitPrev) this._transitPrev = {};
      var prev = this._transitPrev[key];
      var cur = new Uint8ClampedArray(n);
      var orange = 0, orangeSumX = 0, hotCount = 0, hotSumX = 0, gi = 0;
      var samePrev = prev && prev.length === n;
      for (var yy = 0; yy < gh; yy++) {
        var rowOff = (yy * stride * w) * 4;
        for (var xx = 0; xx < gw; xx++) {
          var idx = rowOff + (xx * stride) * 4;
          var r = data[idx], g = data[idx + 1], bch = data[idx + 2];
          if (r > 120 && g > 40 && g < 180 && bch < 100 && r > g * 1.15 && r > bch * 1.6) {
            orange++;
            orangeSumX += xx;
          }
          var gray = (r * 3 + g * 4 + bch) >> 3;
          if (samePrev && Math.abs(gray - prev[gi]) > 25) {
            hotCount++;
            hotSumX += xx;
          }
          cur[gi++] = gray;
        }
      }
      this._transitPrev[key] = cur;
      // hot = fraction of sampled pixels whose gray changed by >25 since
      // the previous tick — compact moving blobs (the ball) score high,
      // codec shimmer / slight net sway score near zero. hotCx/orangeCx =
      // each blob's horizontal centroid as a 0..1 fraction of the window.
      return {
        orange:   orange,
        orangeCx: orange > 0 ? (orangeSumX / orange) / Math.max(1, gw - 1) : null,
        hot:      samePrev ? hotCount / n : 0,
        hotCx:    (samePrev && hotCount > 0) ? (hotSumX / hotCount) / Math.max(1, gw - 1) : null
      };
    },

    /* ── L12.2: Count orange pixels in an axis-aligned region ──
       Used by the preflight verifiers below. Stride is set to skip rows
       and columns so a 200×100 region only inspects ~1000 pixels — fast
       enough to call every YOLOX frame during preflight without affecting
       cadence. */
    _countOrangeInRegion: function (x0, y0, w, h, pw, ph) {
      if (!this._ctx) return 0;
      if (x0 < 0) { w += x0; x0 = 0; }
      if (y0 < 0) { h += y0; y0 = 0; }
      if (x0 + w > pw) w = pw - x0;
      if (y0 + h > ph) h = ph - y0;
      if (w < 2 || h < 2) return 0;

      var data;
      try { data = this._ctx.getImageData(x0, y0, w, h).data; }
      catch (e) { return 0; }

      var count = 0;
      var stride = 2;  // skip every other pixel in both axes
      for (var yy = 0; yy < h; yy += stride) {
        for (var xx = 0; xx < w; xx += stride) {
          var idx = (yy * w + xx) * 4;
          var r = data[idx], g = data[idx + 1], b = data[idx + 2];
          if (r > 120 && g > 40 && g < 180 && b < 100 && r > g * 1.15 && r > b * 1.6) {
            count++;
          }
        }
      }
      return count;
    },

    /* ── L12.2: Per-entity preflight verification ──
       Each returns { valid: bool, reason: string }. The preflight tally
       only increments when valid=true so YOLOX false positives can't
       accidentally satisfy the calibration check. */
    _verifyHoopDet: function (hoop, pw, ph) {
      if (!hoop) return { valid: false, reason: 'no-detection' };
      var cyN = hoop.cy / ph;
      var bwN = hoop.bw / pw;
      var bhN = hoop.bh / ph;
      // Hoops live in the upper 70% of basketball footage — anything
      // detected in the bottom third is almost certainly something else.
      if (cyN > 0.70) return { valid: false, reason: 'too-low' };
      // Size sanity — the rim+backboard takes a sane fraction of frame.
      if (bwN < 0.04) return { valid: false, reason: 'bbox-too-small' };
      if (bwN > 0.45) return { valid: false, reason: 'bbox-too-large' };
      // Color sanity — the rim is orange, so a band of orange should be
      // visible in or just below the bbox. Skipping this on color-refined
      // detections (they already proved orange is there).
      if (!hoop.colorRefined) {
        var sx = Math.floor(hoop.cx - hoop.bw * 0.5);
        var sy = Math.floor(hoop.cy - hoop.bh * 0.5);
        var sw = Math.floor(hoop.bw);
        var sh = Math.floor(hoop.bh * 1.5 + ph * 0.08);
        var orange = this._countOrangeInRegion(sx, sy, sw, sh, pw, ph);
        var areaSampled = (sw / 2) * (sh / 2); // stride=2 in both axes
        if (orange < areaSampled * 0.015) {
          return { valid: false, reason: 'no-orange-near-hoop' };
        }
      }
      return { valid: true, reason: null };
    },

    _verifyPlayerDet: function (player, pw, ph) {
      if (!player) return { valid: false, reason: 'no-detection' };
      var cyN = player.cy / ph;
      var bwN = player.bw / pw;
      var bhN = player.bh / ph;
      // Players are anchored to the floor — center in the bottom 2/3.
      if (cyN < 0.30) return { valid: false, reason: 'too-high' };
      // Aspect — humans are taller than wide. Allow some slack for crouched
      // stances during shooting motion.
      var aspect = bhN / Math.max(0.001, bwN);
      if (aspect < 0.9) return { valid: false, reason: 'wrong-aspect' };
      // Size — a player at distance can still be detected, but tiny blobs
      // are likely something else (a pole, a ball cart, etc.).
      if (bhN < 0.10) return { valid: false, reason: 'bbox-too-small' };
      return { valid: true, reason: null };
    },

    _verifyBallDet: function (ball, pw, ph) {
      if (!ball) return { valid: false, reason: 'no-detection' };
      var bwN = ball.bw / pw;
      var bhN = ball.bh / ph;
      // Size — basketball is small in frame at all but the closest shots.
      if (bwN > 0.12) return { valid: false, reason: 'bbox-too-large' };
      if (bwN < 0.006) return { valid: false, reason: 'bbox-too-small' };
      // Roundness — balls are roughly square in bbox terms (aspect ≈ 1).
      var aspect = bwN / Math.max(0.001, bhN);
      if (aspect < 0.45 || aspect > 2.2) return { valid: false, reason: 'not-round' };
      // Color — strict orange check via _verifyOrange (reuses the same
      // pixel test that gates low-confidence ball acceptance later in the
      // pipeline).
      var radius = Math.max(ball.bw, ball.bh) * 0.5;
      if (!this._verifyOrange(ball.cx, ball.cy, radius, pw, ph)) {
        return { valid: false, reason: 'not-orange' };
      }
      return { valid: true, reason: null };
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
          if (r > 120 && g > 40 && g < 180 && b < 100 && r > g * 1.15 && r > b * 1.6) {
            orangeCount++;
          }
        }
      }

      return orangeCount > totalPx * 0.08; // at least 8% orange pixels
    },

    _consecutiveDets: 0,       // consecutive detection count for velocity jump rejection
    _prevBallNorm: null,       // previous ball normalized position {x, y}

    _processBallDetection: function (cx, cy, vw, vh) {
      // Stamp the time of the most recent legitimate ball detection.
      // The pose-shot fallback uses this to defer counting a missed
      // attempt while a real ball trajectory is still in flight —
      // gives YOLOX a chance to drive shot_started→near_hoop→made.
      this._lastBallDetMs = Date.now();
      var normX = cx / vw;
      var normY = cy / vh;

      // Velocity jump rejection: reject teleports (likely a switch to a
      // different orange object) — but TIME-AWARE. L30: the old fixed 0.15
      // threshold assumed ~30Hz sampling; at the real YOLOX cadence
      // (200-400ms between detections) a genuine shot arc legitimately
      // moves 0.2-0.4 normalized between samples, so the fixed threshold
      // rejected nearly every in-flight detection and starved the tracker.
      // Allow up to 1.2 norm/s of real motion (capped), floor at 0.15.
      if (this._prevBallNorm) {
        var dx = normX - this._prevBallNorm.x;
        var dy = normY - this._prevBallNorm.y;
        var jumpDist = Math.sqrt(dx * dx + dy * dy);
        var dtSec = this._prevBallNorm.ts ? Math.min(1.0, (Date.now() - this._prevBallNorm.ts) / 1000) : 0.033;
        var maxJump = Math.min(0.45, Math.max(0.15, 1.2 * dtSec));
        if (jumpDist > maxJump && this._consecutiveDets < 3) {
          // Reject this detection — likely jumped to a player
          this._consecutiveDets = 0;
          this._prevBallNorm = { x: normX, y: normY, ts: Date.now() };
          return;
        }
      }
      this._consecutiveDets++;
      this._prevBallNorm = { x: normX, y: normY, ts: Date.now() };

      updateTracker(this.tracker, cx, cy);
      this.ballPosition = {
        normX: normX, normY: normY,
        source: this._lastDetSource || 'core',
        confidence: this._lastDetConf || 0
      };
      if (this.onBallUpdate) this.onBallUpdate(this.ballPosition);

      // L14.B: track "ball was seen near rim" during an active shot.
      // Used by the pose-fallback timeout to upgrade MISS → MADE when the
      // ball never produced a full crossing trajectory but was clearly in
      // the rim's vicinity at some point. The bar is intentionally low —
      // we just need ANY frame of "ball near rim" during the shot window.
      if ((this._shotState === 'shot_started' || this._shotState === 'near_hoop') &&
          this.rimZone && this._rimStabilized) {
        var rimCX = this.rimZone.centerX;
        var rimCY = this.rimZone.centerY;
        var rimHW = (this.rimZone.width  || 0.10) * 0.5;
        var rimHH = (this.rimZone.height || 0.04) * 0.5;
        var nearMaxX = rimHW * 2.0;   // 2× half-width of rim — same scale as madeThresh
        var nearMaxY = rimHH * 5.0;   // generous vertical band centered on rim
        var dxN = Math.abs(normX - rimCX);
        var dyN = Math.abs(normY - rimCY);
        if (dxN <= nearMaxX && dyN <= nearMaxY) {
          this._ballSeenAtRim = true;
          this._ballNearRimHits = (this._ballNearRimHits || 0) + 1;
        }

        // L30: ordered THROUGH-RIM evidence from measured detections.
        // "Above the rim earlier, below it within the made span shortly
        // after" survives the detector blinks that break the consecutive-
        // frame crossing watch, while staying far stricter than
        // _ballSeenAtRim (any near-rim frame — true for misses too).
        var madeSpan = rimHW * 2.0;     // same span the L9.2 watch uses
        var nowEvid = Date.now();
        // Phase 6: skip YOLO-based above/below evidence when the scene
        // is static — the same cached frame would produce phantom
        // _ballAboveRimAt and _ballThroughRimAt setters on every tick.
        if (this._sceneStatic) {
          // no-op while paused
        } else if (normY < rimCY - rimHH && dxN <= madeSpan * 1.25) {
          this._ballAboveRimAt = nowEvid;
        } else if (!this._ballThroughRimAt &&
                   this._ballAboveRimAt &&
                   nowEvid - this._ballAboveRimAt <= 1500 &&
                   normY > rimCY + rimHH &&
                   normY < rimCY + rimHH * 10 &&
                   dxN <= madeSpan) {
          this._ballThroughRimAt = nowEvid;
          this._logShotEvent('ball-through-rim-evidence', {
            dxFromRim:    +dxN.toFixed(3),
            normY:        +normY.toFixed(3),
            msSinceAbove: nowEvid - this._ballAboveRimAt
          });
        }
      }

      // p9s (2026-07-01): RE-ENABLED with STRICT gates.
      // Phase 9 disabled this to prevent side-court / rolling-floor false
      // positives. But it turned pose into the SOLE trigger source, and
      // pose only fires on ~30% of shots on the Dr.Dish video (3/14).
      // The 10 other real shots produce clean ball arcs above → through
      // the rim, and this branch is the only path that can catch them
      // without waiting for a pose signal.
      //
      // Gates (all required):
      //   • state === 'idle' (not mid-shot / not in cooldown)
      //   • rim locked AND stabilized
      //   • >1500ms since last _countShot fired (blocks re-triggers)
      //   • ≥6 real (non-predicted) ball positions in last 15 frames
      //   • ≥3 of those frames above the rim (was 2)
      //   • descent >5px over last 4 frames (was 3)
      //   • last X within rimHalfW*1.2 of rim center (was 1.5)
      //   • last Y is AT or just below the rim line
      var ridgeRealPts = null;
      if (this._shotState === 'idle' && this.rimZone && this._rimStabilized &&
          (Date.now() - (this.lastShotTime || 0) > 1500) &&
          this.tracker && this.tracker.positions) {
        var _ridgePts = this.tracker.positions.filter(function (p) { return !p.predicted; }).slice(-15);
        if (_ridgePts.length >= 6) ridgeRealPts = _ridgePts;
      }
      if (ridgeRealPts) {
        var ridge_rim = this.rimZone;
        var ridge_pts = ridgeRealPts;
        var ridge_last = ridge_pts[ridge_pts.length - 1];
        var ridge_lastX = ridge_last.x / vw;
        var ridge_lastY = ridge_last.y / vh;
        // (1) at least 3 frames above rim within the slice (was 2)
        var aboveRimFrames = 0;
        for (var ri = 0; ri < ridge_pts.length; ri++) {
          if ((ridge_pts[ri].y / vh) < ridge_rim.centerY - 0.03) aboveRimFrames++;
        }
        var hadHighArc = aboveRimFrames >= 3;
        // (2) descent >5 px over the last 4 frames (was 3)
        var ridge_movingDown = false;
        var ridge_p0, ridge_p1;
        if (ridge_pts.length >= 4) {
          ridge_p0 = ridge_pts[ridge_pts.length - 4];
          ridge_p1 = ridge_pts[ridge_pts.length - 1];
          ridge_movingDown = (ridge_p1.y - ridge_p0.y) > 5;
        }
        // (3) X within tighter rim bounds (rimHalfW*1.2, was 1.5)
        var ridge_rimHalfW = (ridge_rim.width || 0.10) * 0.5;
        var ridge_withinRimX = Math.abs(ridge_lastX - ridge_rim.centerX) < ridge_rimHalfW * 1.2;
        // (4) L27: ball must have CROSSED the rim Y line (be AT or just
        // BELOW it), not just approached from above. The previous ±5 %
        // tolerance accepted balls 5 % above the rim, which fired the
        // MADE banner BEFORE the ball actually entered the rim.
        var ridge_nearRimY = ridge_lastY >= ridge_rim.centerY - 0.005 &&
                             ridge_lastY <= ridge_rim.centerY + 0.08;

        if (hadHighArc && ridge_movingDown && ridge_withinRimX && ridge_nearRimY) {
          var nowMs = Date.now();
          this._logShotEvent('ball-cross-rim-trigger', {
            ballX:           ridge_lastX.toFixed(3),
            ballY:           ridge_lastY.toFixed(3),
            rimX:            ridge_rim.centerX.toFixed(3),
            rimY:            ridge_rim.centerY.toFixed(3),
            aboveRimFrames:  aboveRimFrames,
            descentPx:       (ridge_p1.y - ridge_p0.y).toFixed(1)
          });
          // L30: open a retroactive shot and hand the verdict to the L9.2
          // post-crossing watch instead of counting an instant "missed"
          // that the L16 chain then upgraded to MADE unconditionally. The
          // watch's improvement + bounce guards are what actually separate
          // swishes from front-rim bounce-outs; if the ball vanishes into
          // the net, the through-rim evidence (L14.B) or the near_hoop
          // timeout resolves the shot instead.
          var ridge_rimHalfW2 = (ridge_rim.width || 0.08) / 2;
          // Interpolate the rim-line crossing from the last point above the
          // rim to the current one — same math as the watch's phase 1.
          var ridge_crossX = ridge_lastX;
          for (var rci = ridge_pts.length - 2; rci >= 0; rci--) {
            var rpY = ridge_pts[rci].y / vh;
            if (rpY < ridge_rim.centerY) {
              var rpX = ridge_pts[rci].x / vw;
              var rDy = ridge_lastY - rpY;
              var rRatio = rDy > 1e-6 ? (ridge_rim.centerY - rpY) / rDy : 0;
              ridge_crossX = rpX + rRatio * (ridge_lastX - rpX);
              break;
            }
          }
          this._shotState         = 'near_hoop';
          this._shotStateTime     = nowMs;
          this._shotTriggerSrc    = 'ball-trajectory';
          this._ballSeenAtRim     = true;
          this._ballNearRimHits   = (this._ballNearRimHits || 0) + 1;
          this._ballAboveRimAt    = nowMs;  // factual: the arc was above the rim
          this._ballThroughRimAt  = 0;
          this._sawBallAboveRim   = true;
          this._shotStartY        = ridge_lastY;
          this._ballMinY          = ridge_pts.reduce(function (m, p) { return Math.min(m, p.y); }, Infinity) / vh;
          this._releaseConfidence = 0.7;
          this._shooterFeetX      = null;
          this._shooterFeetY      = null;
          this._shotTrajectory    = [{ x: ridge_lastX, y: ridge_lastY, t: nowMs }];
          this._postCrossingWatch = {
            t0:        nowMs,
            bestDist:  Math.abs(ridge_crossX - ridge_rim.centerX),
            bestX:     ridge_crossX,
            bestY:     ridge_rim.centerY,
            lastY:     ridge_lastY,
            samples:   1,
            rimY: ridge_rim.centerY, rimX: ridge_rim.centerX,
            madeThresh: ridge_rimHalfW2 * 2.0
          };
          // NO return and NO instant count — flow falls through to the
          // L9.2 watch block below, which resolves made/missed in ~100ms.
        }
      }

      /* Feed to adaptive learning (Level 1 + 3) */
      /* cx/cy are in video coords — convert to processing canvas space for pixel sampling */
      if (window.AdaptiveLearning && this._canvas && this._ctx) {
        var cvW = (this._procW > 0) ? this._procW : vw;
        var cvH = (this._procH > 0) ? this._procH : vh;
        var canvasX = (vw > 0 && cvW > 0) ? cx * cvW / vw : cx;
        var canvasY = (vh > 0 && cvH > 0) ? cy * cvH / vh : cy;
        window.AdaptiveLearning.onBallDetected(this._canvas, this._ctx, canvasX, canvasY);
      }

      // ── Phase L2 + L9.1 + L9.2: Ball-through-rim made/miss ──
      // L9.1: madeThresh widened 1.6 → 2.0 × rimHalfW (user feedback: makes
      // were being classified as miss with the tighter sliver).
      // L9.2: "improvement-only" post-crossing watch (100ms). After the first
      // downward Y-crossing of the rim line, we keep looking for a subsequent
      // ball position with SMALLER distFromRim. This handles outdoor no-net
      // shots that glance the front rim (first crossing X is at the rim edge,
      // ball then falls cleanly toward center). Two guards prevent false
      // MADE from rim-bounce-and-out misses:
      //   1. Ball Y must keep increasing (no upward bounces during window)
      //   2. Once distFromRim starts INCREASING again, end watch (ball
      //      moving away from rim center → use the best so far)
      if ((this._shotState === 'shot_started' || this._shotState === 'near_hoop') &&
          this.rimZone && this._rimStabilized) {
        if (!this._shotTrajectory) this._shotTrajectory = [];
        this._shotTrajectory.push({ x: normX, y: normY, t: Date.now() });
        if (this._shotTrajectory.length > 60) this._shotTrajectory.shift();  // cap ~2s @ 30fps

        var rimY = this.rimZone.centerY;
        var rimX = this.rimZone.centerX;
        var rimHalfW = (this.rimZone.width || 0.08) / 2;
        var madeThresh = rimHalfW * 2.0;  // L9.1: was 1.6, widened for no-net outdoor rims

        // Phase 9 (radical simplification): L9.2 post-crossing watch DISABLED.
        // The watch fired an instant made/missed on the first downward
        // Y-crossing — which triggered on any Kalman ghost hallucinated
        // through the rim line, on side-court balls that happened to
        // descend past rim Y anywhere in the frame, and on the ball
        // trajectory during dribbling recovery. The `_shotTrajectory`
        // array above is still filled every frame so polyfit has data
        // to work with; the counting from this block is gone.
        var POST_CROSSING_WATCH_MS = 100;
        if (false && !this._postCrossingWatch && this._shotTrajectory.length >= 2) {
          var prev = this._shotTrajectory[this._shotTrajectory.length - 2];
          var curr = this._shotTrajectory[this._shotTrajectory.length - 1];
          if (prev.y < rimY && curr.y >= rimY) {
            var dyTotal = curr.y - prev.y;
            var ratio = dyTotal > 1e-6 ? (rimY - prev.y) / dyTotal : 0;
            var crossingX = prev.x + ratio * (curr.x - prev.x);
            var distFromRim = Math.abs(crossingX - rimX);
            // Open the 100ms watch with this crossing as the starting "best".
            this._postCrossingWatch = {
              t0:        Date.now(),
              bestDist:  distFromRim,
              bestX:     crossingX,
              bestY:     rimY,
              lastY:     curr.y,
              samples:   1,
              rimY: rimY, rimX: rimX, madeThresh: madeThresh
            };
            dlog('[ShotState] first crossing at x=' + crossingX.toFixed(3) +
                 ' dist=' + distFromRim.toFixed(3) + ' — opening 100ms watch');
          }
        }

        // Phase 2: during watch, try to improve the decision
        if (this._postCrossingWatch) {
          var pc = this._postCrossingWatch;
          var nowMs = Date.now();
          var elapsed = nowMs - pc.t0;

          // Guard A: ball Y must keep increasing (no upward bounce). If it
          // bounces up, end the watch immediately — current best is final.
          var ballBouncedUp = normY < pc.lastY - 0.005; // 0.5% slack for jitter
          if (!ballBouncedUp) {
            var newDist = Math.abs(normX - pc.rimX);
            if (newDist < pc.bestDist) {
              // Improvement found — update best.
              pc.bestDist = newDist;
              pc.bestX    = normX;
              pc.bestY    = normY;
              dlog('[ShotState] L6-lite improved: dist ' +
                   pc.bestDist.toFixed(3) + ' (closer to rim center)');
            }
            // Guard B: if ball is now MOVING AWAY (newDist > bestDist by
            // meaningful margin), end watch — ball isn't going to settle
            // better than we already have.
            else if (newDist > pc.bestDist + 0.01) {
              elapsed = POST_CROSSING_WATCH_MS; // force end
            }
            pc.lastY = normY;
            pc.samples++;
          } else {
            elapsed = POST_CROSSING_WATCH_MS; // force end on bounce-up
          }

          if (elapsed >= POST_CROSSING_WATCH_MS) {
            var finalDist = pc.bestDist;
            var finalX    = pc.bestX;
            var finalThresh = pc.madeThresh;
            // L34 (premature-MADE fix): horizontal centrality alone is not
            // enough — the ball can pass laterally across the rim plane
            // without going THROUGH (rim-out, lateral travel, front-rim
            // bounce). Require both:
            //   • finalDist within madeThresh (horizontal centrality)
            //   • _ballThroughRimAt > 0  (ball observed both above + below
            //     the rim with central X — the rim-transit detector signal)
            // If through-rim evidence hasn't landed yet, default to MISSED;
            // the L30 evidence-gate in _countShot still upgrades to MADE
            // when the transit signal arrives within 1.5 s of the shot.
            var horizontallyCentred = finalDist <= finalThresh;
            var throughRimSeen      = this._ballThroughRimAt > 0;
            var result = (horizontallyCentred && throughRimSeen) ? 'made' : 'missed';
            var conf = Math.max(0, 1 - finalDist / finalThresh);

            this._lastCrossing = {
              x: finalX, y: pc.bestY, t: nowMs,
              distFromRim: finalDist, madeThresh: finalThresh,
              result: result, confidence: conf,
              samples: pc.samples
            };
            this._lastShotReason = (result === 'made' ? 'MADE' : 'MISSED') +
                                   ' dist=' + finalDist.toFixed(3) +
                                   ' / thresh=' + finalThresh.toFixed(3) +
                                   ' (samples=' + pc.samples + ')';

            dlog('[ShotState] watch resolved: bestDist=' + finalDist.toFixed(3) +
                 ' thresh=' + finalThresh.toFixed(3) +
                 ' samples=' + pc.samples + ' → ' + result);

            var feetX = this._shooterFeetX != null ? this._shooterFeetX : 0.5;
            var feetY = this._shooterFeetY != null ? this._shooterFeetY : 0.8;
            this._countShot(result, vw, vh, feetX, feetY, nowMs);
            this._shotTrajectory   = [];
            this._postCrossingWatch = null;
            return;
          }
        }
      }

      this._analyzeShotState(vw, vh, normX, normY, 'ball');
    },

    _processNoBall: function () {
      this._consecutiveDets = 0;  // Reset consecutive detection count
      updateTracker(this.tracker, null, null);

      // ── Watchdog: prevent the state machine from getting stuck ──
      // _analyzeShotState only runs while a ball (real or Kalman-predicted)
      // is available. If the ball vanishes mid-flight and never reappears,
      // shot_started / near_hoop would otherwise wait forever. Force a
      // reset to idle 4s after the state was entered.
      var nowWd = Date.now();
      if ((this._shotState === 'shot_started' || this._shotState === 'near_hoop') &&
          this._shotStateTime > 0 && (nowWd - this._shotStateTime) > 4000) {
        this._shotState = 'idle';
        this._ballMinY = 1.0;
        this._shotStartY = 1.0;
        this._sawBallAboveRim = false;
        this._shotTriggerSrc    = null;
        this._releaseConfidence = null;
        // L34: clear through-rim evidence flags so a stale signal from a
        // previous shot can't convert the NEXT pose trigger into a false
        // MADE. The agent audit identified this as the secondary source
        // of false-MADE-on-paused-video bugs.
        this._ballThroughRimAt = 0;
        this._ballAboveRimAt   = 0;
        this._transitEventAt   = 0;
        this._transitAboveAt   = 0;
        this._ballNearRimHits  = 0;
        this._ballSeenAtRim    = false;
        this._shooterFeetX      = null;
        this._shooterFeetY      = null;
      }

      // If Kalman is predicting, show predicted position to UI
      var kf = this.tracker.kalman;
      var maxPredictNoBall = this.tracker._activeShotExtend ? Math.floor(KALMAN_MAX_PREDICT * 1.5) : KALMAN_MAX_PREDICT;
      if (kf.initialized && kf.predictCount > 0 && kf.predictCount <= maxPredictNoBall) {
        var vw = this.videoEl ? this.videoEl.videoWidth : 1;
        var vh = this.videoEl ? this.videoEl.videoHeight : 1;
        // L31: only surface/analyze the ghost while it is still inside the
        // frame — out-of-frame extrapolations are fiction, not a ball.
        var ghostVisible = kf.x >= -vw * 0.1 && kf.x <= vw * 1.1 &&
                           kf.y >= -vh * 0.3 && kf.y <= vh * 1.1;
        if (ghostVisible) {
          this.ballPosition = {
            normX: kf.x / vw, normY: kf.y / vh,
            source: 'predicted', confidence: 0
          };
          if (this.onBallUpdate) this.onBallUpdate(this.ballPosition);
          // Continue analyzing shot state with predicted position
          this._analyzeShotState(vw, vh, kf.x / vw, kf.y / vh, 'predicted');
          return;
        }
      }
      this.ballPosition = null;
      if (this.onBallUpdate) this.onBallUpdate(null);

      // ── Pose-only frame: run the state machine even with NO ball ──
      // YOLOX often misses non-orange balls (e.g. red Wilson, brown leather,
      // mini-balls, etc.) where Pose Lite still tracks the shooter perfectly.
      // We pass the SHOOTER's hip centroid (if we have one) as the "ball
      // position", which lets the geometric checks downstream still make
      // sense. If pose isn't ready either, this is a true no-signal frame
      // and the state machine is gated as before by the rim+tracker checks.
      if (this.rimZone && window.PoseDetector && window.PoseDetector.isReady() && this.videoEl) {
        var vwP = this.videoEl.videoWidth || 1;
        var vhP = this.videoEl.videoHeight || 1;
        var posePoll = window.PoseDetector.detect(this.videoEl, this.videoEl.currentTime || nowWd);
        if (posePoll && posePoll.landmarks && posePoll.landmarks.length >= 25) {
          // Use the SHOOTING-HAND wrist as the proxy "ball position" — that
          // is the closest meaningful point to where the ball actually is
          // during the rising phase. _analyzeShotState only uses normX/normY
          // for rim-proximity checks; the pose-trigger inside it doesn't
          // care about these coords at all.
          var lw = posePoll.landmarks[15] || { x:0.5, y:0.5 };
          var rw = posePoll.landmarks[16] || { x:0.5, y:0.5 };
          var wrist = (lw.y < rw.y) ? lw : rw;
          this._analyzeShotState(vwP, vhP, wrist.x, wrist.y, 'wrist');
        }
      }

      // Phase 9 (radical simplification): timeout-miss branch DISABLED.
      // Fired 'missed' whenever ball tracking ended in the approach
      // zone, and the auto miss→MADE upgrade often flipped it to made.
      // In radical mode near_hoop timeout with polyfit is the only path
      // that can resolve a shot; if the ball vanishes with no fit-able
      // trajectory, the shot drops silently.
    },

    /* ── Shot state machine (time-based, rim-relative) ──────────
       States: idle → shot_started → near_hoop → cooldown → idle

       Design notes (post-eval rewrite):
       • All thresholds are TIME-based or RIM-RELATIVE so the machine
         behaves identically at 30 Hz live capture and 5 Hz YOLOX cadence.
       • idle → shot_started fires on sustained upward motion in any
         600 ms window; we no longer require the ball to be below the
         rim, so cameras that look UP at the rim still trigger.
       • near_hoop entry is 2.5 × rim-heights from the rim center, so
         the zone scales with how the model sized the hoop bbox
         instead of using a fixed 0.20 frame fraction.
       • make / miss is a crossing rule: the ball was seen above the
         rim, then below the rim, with horizontal alignment. A
         minimum-motion gate prevents a stationary ball or a short
         dribble bounce from being counted as a shot.
    ────────────────────────────────────────────────────────────── */
    _analyzeShotState: function (vw, vh, normX, normY, sampleSource) {
      // _rimStabilized is the screen's "rim has finished converging" signal.
      // Until that flips on, we ignore everything — the EMA on the auto-lock
      // is still settling and we don't want phantom shots from a rim zone
      // that's drifting across the frame.
      if (!this.rimZone || !this._rimStabilized) return;
      var now = Date.now();
      var rim = this.rimZone;
      // L30: only MEASURED ball detections may create made/miss EVIDENCE
      // (above-rim flags, min-Y, the crossing rule). Kalman-predicted
      // ghosts follow gravity straight "through" the rim, and the pose
      // wrist proxy puts a "ball" at rim height whenever a player reaches
      // up under the basket — both faked crossings before this gate.
      // Non-ball samples still drive zone ENTRY and timeouts.
      var isBallSample = (sampleSource === 'ball' || sampleSource === undefined);

      // Cooldown
      if (this._shotState === 'cooldown') {
        if (now - this._shotStateTime > DEBOUNCE_MS) {
          this._shotState = 'idle';
          this._ballMinY = 1.0;
          this._shotStartY = 1.0;
          this._sawBallAboveRim = false;
        }
        return;
      }

      // Track the highest point the ball reaches (lowest Y value)
      if (isBallSample && normY < this._ballMinY) this._ballMinY = normY;

      var pts = this.tracker.positions;

      // Extended Kalman prediction during active shot phases
      var isActiveShotState = (this._shotState === 'shot_started' || this._shotState === 'near_hoop');
      this.tracker._activeShotExtend = isActiveShotState;

      // Tracker-based gate: ball-rose-in-window needs at least
      // MIN_TRAJECTORY_PTS samples to compute a slope. But the pose-only
      // trigger doesn't need any tracker data — so we don't early-return
      // here. The idle branch below handles "tracker empty" gracefully
      // by skipping ballRose and relying on poseShot exclusively.

      // Phase 9 (radical simplification): IDLE trigger is now POSE-ONLY.
      // The `_poseLoop` fires pose triggers directly and enters
      // `shot_started` from there. This duplicate pose-in-analyze path
      // was already redundant; the ball-rise branch was firing on any
      // ball detection rising 3% of frame in 600 ms — noise, side-court
      // action, machine-returned balls all triggered phantom shots.
      // Radical mode: pose alone opens shot windows; if pose misses it,
      // it doesn't get counted.
      if (this._shotState === 'idle') return;

      // ── SHOT_STARTED: wait for ball to reach the rim zone ──
      if (this._shotState === 'shot_started') {
        if (isBallSample && normY < rim.centerY) this._sawBallAboveRim = true;

        // Rim-relative entry zone: within 2.5 rim-heights of the rim center.
        // Scales with however the model sized the hoop bbox, instead of
        // assuming the rim is far enough below the top of frame for a
        // fixed 0.20 fraction to make sense.
        var distFromRim = Math.abs(normY - rim.centerY);
        if (distFromRim < (rim.height || 0.04) * 2.5) {
          this._shotState = 'near_hoop';
          this._shotStateTime = now;
          return;
        }
        if (now - this._shotStateTime > 3000) {
          // Pose-triggered shot timed out without the ball reaching near_hoop.
          // L33: aligned with the pose-fallback policy — pose/setpoint
          // timeouts count ONLY with through-rim evidence (→ made). Misses
          // that actually reached the rim are counted by the rim-event
          // path with correct timing; a timeout with no through is either
          // a phantom trigger or an airball — dropped, not counted.
          if (this._shotTriggerSrc === 'pose' || this._shotTriggerSrc === 'pose-setpoint') {
            // Phase 9: through-rim motion no longer authorises MADE.
            // The polyfit predictor is the sole verdict source. If it
            // can't form a verdict, the branch falls through to the
            // silent drop below.
            // Phase 9l: polyfit → through-rim fallback → MISS (not drop).
            var pfStarted = polyfitVerdict(this._shotTrajectory, rim);
            if (pfStarted) {
              this._logShotEvent('polyfit-resolved', {
                src: 'shot_started-timeout', result: pfStarted.result,
                xAtRim: +pfStarted.xAtRim.toFixed(3),
                dx: +pfStarted.dxFromRim.toFixed(3),
                tol: +pfStarted.tolerance.toFixed(3),
                points: pfStarted.points
              });
              this._countShot(pfStarted.result, vw, vh, normX, normY, now);
              return;
            }
            var resultTO = (this._ballThroughRimAt > 0) ? 'made' : 'missed';
            this._logShotEvent('pose-timeout-fallback', {
              triggerSrc: this._shotTriggerSrc,
              trajectoryLen: (this._shotTrajectory || []).length,
              throughRim: this._ballThroughRimAt > 0,
              result: resultTO
            });
            this._countShot(resultTO, vw, vh, normX, normY, now);
            return;
          }
          this._shotState = 'idle';
          this._ballMinY = 1.0;
          this._shotStartY = 1.0;
          this._sawBallAboveRim = false;
          this._shotTriggerSrc    = null;
          this._releaseConfidence = null;
          this._shooterFeetX      = null;
          this._shooterFeetY      = null;
        }
        return;
      }

      // ── NEAR_HOOP: simplified crossing rule with motion gate ──
      if (this._shotState === 'near_hoop') {
        var hoopXDist     = Math.abs(normX - rim.centerX);
        var nearHoopX     = hoopXDist < rim.width * 1.5;        // tight: for MADE
        var stillNearX    = hoopXDist < rim.width * 3.0;        // loose: still in zone

        var ballAboveRim  = normY < rim.centerY;
        var ballBelowRim  = normY > rim.centerY + (rim.height || 0.04);
        if (isBallSample && ballAboveRim) this._sawBallAboveRim = true;

        // Minimum-motion gate: ball must have actually risen, scaled to
        // how far below the rim the shot started. Below the rim by 0.30
        // gates at 0.09; above the rim or close to it gates at the 0.05
        // floor so layups under the basket can still register.
        var arcHeight = this._shotStartY - this._ballMinY;
        var minMotion = Math.max(0.05, Math.abs(this._shotStartY - rim.centerY) * 0.3);

        // Pose-triggered shots already passed a high-confidence "this is a
        // shot" check via MediaPipe — we don't re-impose the ball-trajectory
        // arcHeight gate (which expects ball-rises-from-court, irrelevant
        // when we're tracking a wrist that's already at the peak when
        // shot_started fires).
        var isPoseShot = (this._shotTriggerSrc === 'pose');
        var motionOk   = isPoseShot || (this._sawBallAboveRim && arcHeight >= minMotion);

        // MADE: was above rim, now below rim, horizontally aligned, motion gate cleared
        // L30: isBallSample — a MADE verdict needs a measured ball below the
        // rim, not a Kalman ghost or a wrist landmark sitting there.
        // L35: REQUIRE the color-based rim-transit detector to also have
        // confirmed an above→below ball spike. The YOLO _sawBallAboveRim
        // flag alone fires on any false ball detection above rim Y (logos,
        // basketball icons on screen overlays, the user's TikTok video
        // content). The user's law: "MADE only when the ball passes
        // verified above-then-below the rim." Without the color-transit
        // confirmation, this is a MISS, not a MADE.
        // Phase 9: near_hoop MADE rule now polyfit-only. Motion signals
        // (above+below+through) OPEN the polyfit gate; polyfit itself
        // decides. If polyfit can't form a verdict, the branch does
        // NOTHING — flow continues to the timeout/far branches below,
        // which also route through polyfit or drop.
        var throughVerified = this._ballThroughRimAt > 0;
        if (isBallSample && this._sawBallAboveRim && ballBelowRim && nearHoopX && motionOk && throughVerified) {
          var pfNear = polyfitVerdict(this._shotTrajectory, rim);
          if (pfNear) {
            this._logShotEvent('near_hoop-verdict', {
              polyfit: {
                result: pfNear.result,
                xAtRim: +pfNear.xAtRim.toFixed(3),
                dx:     +pfNear.dxFromRim.toFixed(3),
                tol:    +pfNear.tolerance.toFixed(3),
                r2:     +pfNear.r2.toFixed(2),
                points: pfNear.points
              },
              final: pfNear.result
            });
            this._countShot(pfNear.result, vw, vh, normX, normY, now);
            return;
          }
          // polyfit couldn't form a verdict — fall through to timeout/far
          // branches so we don't count on motion alone.
        }

        // MISS: ball moved away from rim OR timed out, with sufficient motion + above-rim seen
        var ballFarFromHoop = !stillNearX || normY > rim.centerY + (rim.height || 0.04) * 4;
        var timeout         = now - this._shotStateTime > 2000;

        if (ballFarFromHoop || timeout) {
          // L33: pose/setpoint shots never self-count a miss here either —
          // near_hoop is entered and exited by WRIST and Kalman samples on
          // these shots, so "ball moved away" is not ball evidence. The
          // rim-event path owns their miss verdicts (eval: this branch was
          // double-counting tip plays ~1s before the rim event resolved
          // the same attempt). Through-evidence still converts to a make.
          var isPoseSrc = (this._shotTriggerSrc === 'pose' || this._shotTriggerSrc === 'pose-setpoint');
          if (false) {
            // Phase 9: through-rim motion branch removed — see the
            // polyfit-only branch below, which handles pose-triggered
            // shots regardless of through-rim state.
          } else if (isPoseSrc) {
            // Phase 9l: try polyfit first, then fall back to through-rim
            // + rim-proximity heuristic. On the user's Dr.Dish training
            // footage YOLO barely tracks the small ball through the arc,
            // so polyfit's data is often too sparse. Rather than drop
            // silently, use the strong _ballThroughRimAt signal (set by
            // rim-transit motion detector — motion above rim followed
            // by motion below with centrality gate) as the MADE
            // authority, and fall back to MISS otherwise.
            var pfPose = polyfitVerdict(this._shotTrajectory, rim);
            if (pfPose) {
              this._logShotEvent('polyfit-resolved', {
                src: 'near_hoop-pose', result: pfPose.result,
                xAtRim: +pfPose.xAtRim.toFixed(3),
                dx: +pfPose.dxFromRim.toFixed(3),
                tol: +pfPose.tolerance.toFixed(3),
                points: pfPose.points
              });
              this._countShot(pfPose.result, vw, vh, normX, normY, now);
            } else {
              // No polyfit verdict — decide via through-rim signal.
              var result9l = (this._ballThroughRimAt > 0) ? 'made' : 'missed';
              this._logShotEvent('pose-nearhoop-fallback', {
                far: !!ballFarFromHoop, timedOut: !!timeout,
                trajectoryLen: (this._shotTrajectory || []).length,
                throughRim: this._ballThroughRimAt > 0,
                result: result9l
              });
              this._countShot(result9l, vw, vh, normX, normY, now);
            }
          } else if (false && ballFarFromHoop && motionOk) {
            // Phase 9: non-pose "ball CLEARLY left rim = MISS" branch
            // DISABLED. In radical mode only pose can trigger a shot, so
            // this branch (which only fires for non-pose triggers) is
            // dead code. Kept as false-guarded for reference.
            this._countShot('missed', vw, vh, normX, normY, now);
          } else if (timeout) {
            // L37.7: timeout without through-rim — try polyfit before
            // dropping. The trajectory may have enough measured points to
            // tell us whether the ball would have crossed inside the rim.
            var pfTimeout = polyfitVerdict(this._shotTrajectory, rim);
            if (pfTimeout) {
              this._logShotEvent('polyfit-resolved', {
                src: 'near_hoop-timeout', result: pfTimeout.result,
                xAtRim: +pfTimeout.xAtRim.toFixed(3),
                dx: +pfTimeout.dxFromRim.toFixed(3),
                tol: +pfTimeout.tolerance.toFixed(3),
                points: pfTimeout.points
              });
              this._countShot(pfTimeout.result, vw, vh, normX, normY, now);
              return;
            }
            this._logShotEvent('nearhoop-timeout-dropped', {
              motionOk: !!motionOk,
              trajectoryLen: (this._shotTrajectory || []).length
            });
            this._shotState     = 'idle';
            this._ballMinY      = 1.0;
            this._shotStartY    = 1.0;
            this._sawBallAboveRim = false;
            this._shotTriggerSrc    = null;
            this._releaseConfidence = null;
            this._shooterFeetX      = null;
            this._shooterFeetY      = null;
            return;
          } else {
            // Not a real shot — drop back to idle without counting
            this._shotState     = 'idle';
            this._ballMinY      = 1.0;
            this._shotStartY    = 1.0;
            this._sawBallAboveRim = false;
            this._shotTriggerSrc    = null;
            this._releaseConfidence = null;
            this._shooterFeetX      = null;
            this._shooterFeetY      = null;
          }
          return;
        }
      }
    },

    _countShot: function (result, vw, vh, normX, normY, now) {
      // L16: preflight is now ADVISORY ONLY. Earlier versions dropped shots
      // before preflight passed which caused the first 15-20s of any session
      // to be silently lost. The visual "CALIBRATING…" panel still shows but
      // doesn't block counting.
      //
      // L30: EVIDENCE-GATED counting — replaces the L16/L17/L22 upgrade
      // chain. Those rules gave every trigger source its own miss→made
      // path ("ball was anywhere near the rim" / "pose said shot" /
      // "ball rose"), which made 'missed' structurally unreachable: every
      // eval run returned N/N MADE vs ground truth 13 made / 8 miss.
      //
      // The ONE remaining upgrade: ordered through-rim evidence collected
      // by L14.B' — a measured ball above the rim, then below it within
      // the made span, in that order, within 1.5s. That is what a make
      // LOOKS like when detector blinks hide the actual crossing frame.
      // A trigger source alone never converts a miss into a make; shots
      // with no ball evidence stay missed attempts (the honest reading:
      // we saw a shot happen and never saw the ball go in).
      // Phase 9 (radical simplification): AUTO MISS→MADE UPGRADE DISABLED.
      // Any incoming 'missed' — from polyfit verdict, from processNoBall
      // timeout, from near_hoop far-miss — used to get silently promoted
      // to 'made' if `_ballThroughRimAt` was ever set within the last
      // shot window. Since `_ballThroughRimAt` fires on motion in the
      // rim region (rebound, machine, second player), this upgrade
      // turned every MISS into a MADE. Radical mode: the caller's
      // verdict is final.
      var resultUpgraded = false;
      this._logShotEvent('shot-counted', {
        result:          result,
        triggerSrc:      this._shotTriggerSrc,
        ballSeenAtRim:   !!this._ballSeenAtRim,
        ballThroughRim:  !!this._ballThroughRimAt,
        ballNearRimHits: this._ballNearRimHits || 0,
        normX:           normX,
        normY:           normY
      });

      this.lastShotTime = now;
      this._shotState = 'cooldown';
      this._shotStateTime = now;
      this._ballMinY = 1.0;
      this._shotStartY = 1.0;
      this._sawBallAboveRim = false;

      // Prefer pose-supplied shooter hip centroid when available — far more
      // reliable than ball-trajectory launch point on noisy detections,
      // and matches the actual shooter's feet location (not the ball's
      // first detected position which might be at peak of arc).
      var launchPt;
      if (this._shotTriggerSrc === 'pose' && this._shooterFeetX != null) {
        launchPt = { x: this._shooterFeetX * vw, y: this._shooterFeetY * vh };
      } else {
        launchPt = getLaunchPoint(this.tracker, vw, vh);
      }
      var shotZone = classifyShotZone(launchPt, this.rimZone, this.threePtDistance);
      // Capture trigger source before we clear the state for the cooldown
      var triggerSrc = this._shotTriggerSrc;
      var releaseConf = this._releaseConfidence;
      var traj = getTrajectoryNormalized(this.tracker, vw, vh, 20);

      // ── Trajectory-based verification (analyzeMade/analyzeMiss) ──
      // Normalize pixel trajectory to 0-1 space to match rimZone coordinates.
      // L30: measured points only — Kalman tails fall plausibly through the
      // rim by construction and fooled analyzeMade.
      var rawPts = this.tracker.positions.slice(-30).filter(function (pt) { return !pt.predicted; });
      var normTraj = rawPts.map(function (pt) {
        return { x: pt.x / vw, y: pt.y / vh, frame: pt.frame };
      });
      var madeAnalysis = analyzeMade(normTraj, this.rimZone);
      var missAnalysis = analyzeMiss(normTraj, this.rimZone);

      // Phase 9 (radical simplification): analyzeMade/analyzeMiss override
      // DISABLED. Polyfit already IS the trajectory-based verdict; a
      // second trajectory analyser that can flip the result adds noise,
      // not signal. In radical mode the caller's verdict (from polyfit)
      // stands as-is.
      var finalResult = result;

      if (finalResult === 'made') this.stats.made++;
      this.stats.attempts++;

      // V10 fine-grained zone — normalise launch coords defensively.
      // launchPt may be in PIXEL space when shot was pose-triggered
      // (`_shooterFeetX * vw`) vs. NORMALISED when ball-triggered.
      var v10fx = launchPt ? launchPt.x : null;
      var v10fy = launchPt ? launchPt.y : null;
      if (v10fx != null && v10fx > 1.5) v10fx = v10fx / vw;
      if (v10fy != null && v10fy > 1.5) v10fy = v10fy / vh;
      var v10Zone = classifyV10Zone(v10fx, v10fy, this.rimZone, this.threePtDistance);

      var shotData = {
        result: finalResult,
        shotX: normX,
        shotY: normY,
        trajectory: traj,
        launchPoint: launchPt,
        shotZone: shotZone,
        v10Zone: v10Zone,
        feetXNorm: v10fx,
        feetYNorm: v10fy,
        timestamp: now,
        triggerSrc: triggerSrc,           // 'pose' | 'ball' — for analytics + UI badge
        releaseConfidence: releaseConf    // 0-1 when pose-triggered, null otherwise
      };

      // V10 LIVE: dispatch a DOM event so the v10 mini-court can push
      // a dot the moment a shot finalises. The hud listens on body.
      try {
        var v10ShotEvt = new CustomEvent('v10:shot', { detail: {
          made: finalResult === 'made',
          v10Zone: v10Zone,
          shotZone: shotZone,
          feetXNorm: v10fx,
          feetYNorm: v10fy,
          rimX: this.rimZone ? this.rimZone.centerX : 0.5,
          rimY: this.rimZone ? this.rimZone.centerY : 0.5,
          ts: now
        }});
        document.body.dispatchEvent(v10ShotEvt);
      } catch (_e) { /* legacy browsers — non-fatal */ }

      dlog('[ShotTracker] ' + finalResult.toUpperCase() +
        ' (sm=' + result + ' traj_made=' + madeAnalysis.isMade + ' traj_miss=' + missAnalysis.isMiss + ')' +
        ' src=' + triggerSrc +
        ' minY=' + this._ballMinY.toFixed(3) +
        ' hoopY=' + this.rimZone.centerY.toFixed(3) + ' ballX=' + normX.toFixed(3) + ' hoopX=' + this.rimZone.centerX.toFixed(3));

      if (window.AdaptiveLearning) {
        window.AdaptiveLearning.onShotCompleted(traj, result, this.rimZone);
      }
      if (this.onShotDetected) this.onShotDetected(shotData);
      resetTracker(this.tracker);

      // Clear pose-related fields now that we've stamped them onto shotData
      this._shotTriggerSrc    = null;
      this._releaseConfidence = null;
      this._shooterFeetX      = null;
      this._shooterFeetY      = null;
      // L30: consume the rim evidence — the next shot must earn its own.
      this._ballSeenAtRim     = false;
      this._ballNearRimHits   = 0;
      this._ballAboveRimAt    = 0;
      this._ballThroughRimAt  = 0;
    },

    _setStatus: function (status) {
      if (this.onStatusChange) this.onStatusChange(status);
    }
  };

  /* ── Expose globally ────────────────────────────────────────── */
  // p12: expose the zone classifiers for the offline processor (it computes
  // shot positions itself from player detections and needs the same court
  // zoning the real-time path uses).
  ShotDetectionEngine._classifyShotZone = classifyShotZone;
  ShotDetectionEngine._classifyV10Zone  = classifyV10Zone;
  window.ShotDetectionEngine = ShotDetectionEngine;

})();
