# Pose-Based Shot Detection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ball-only shot detection with a hybrid pose-aware system. MediaPipe Pose detects the shooter's body motion to fire the "shot happened" signal; YOLOX continues to detect ball + hoop for trajectory + make/miss confirmation. Recall is expected to jump from ~12% (current indoor video) to ≥85%.

**Architecture:** Add `MediaPipe Tasks Vision` (Pose Landmarker, ~6 MB) loaded from CDN. New module `features/shot-tracking/poseDetector.js` wraps the model and exposes a per-frame `detectShootingMotion(videoEl)` API. The existing state machine in `shotDetection.js` gets a new entry path: instead of (only) "ball rose 0.03 in 600 ms", `shot_motion_detected` fires when pose shows arms transitioning from below shoulders to fully extended above head. Ball detection becomes the **confirmation** layer (made/miss) rather than the **trigger** layer.

**Tech Stack:**
- MediaPipe Tasks Vision (`@mediapipe/tasks-vision@0.10`) — Pose Landmarker (Lite variant)
- Existing: ONNX Runtime Web 1.20.1, YOLOX-tiny v6, vanilla JS IIFE modules
- No new build tooling required — uses CDN ESM imports just like ORT
- Testing: visual verification via `debug-eval-run.html` + dashboard debug overlay

**Project Conventions (read first!):**
- Vanilla JS, no bundler. Files use IIFE + `window.X` exports (see `shotDetection.js` for pattern).
- Source of truth is `features/`, `js/`, `dashboard.html` at project root. `node build.js` copies to `www/` which the dev server serves.
- No unit-test framework. Verification = open in browser, watch console, use debug overlay.
- Eval harness: `debug-eval-run.html` runs all 3 test videos and produces `window.__EVAL_REPORT`.
- Dev server: `node serve.js --no-reload` on port 8080 (or via `.claude/launch.json`'s "CourtIQ Static (no live-reload)" profile). Live-reload mode causes browser thrash when files change — use no-reload during heavy iteration.

---

## Chunk 1: Foundation — Load MediaPipe & Verify Pose Works

> **Goal of this chunk:** by the end of Chunk 1, a separate debug page detects 33 pose landmarks on every frame of `_eval/v2.mp4` and overlays them on a canvas. No state-machine integration yet — just proving the model runs in our environment.

### Task 1.1: Add MediaPipe vendor file load to `dashboard.html`

**Files:**
- Modify: `dashboard.html` — add MediaPipe Tasks Vision CDN import near the existing ONNX Runtime script tag

**Why:** MediaPipe Tasks Vision ships as an ES module from jsdelivr/unpkg. We load it as a deferred script. The `.wasm` and model file get fetched separately at runtime.

- [ ] **Step 1: Read the existing ONNX Runtime script tag location**

Run: `grep -n "onnxruntime-web" dashboard.html`
Expected: one line near the bottom showing `<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js" ...>`. We'll add MediaPipe right next to it.

- [ ] **Step 2: Add the MediaPipe CDN tag**

Insert immediately AFTER the ORT script tag (so it's the next `<script>` line):

```html
<!-- MediaPipe Tasks Vision (Pose Landmarker for shooting-motion detection) -->
<script type="module">
  import { PoseLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
  window.__MP = { PoseLandmarker: PoseLandmarker, FilesetResolver: FilesetResolver };
</script>
```

Rationale for the bridging pattern: Tasks Vision is an ES module, but the rest of CourtIQ is plain scripts. We stash the imports on `window.__MP` so non-module code (`poseDetector.js`) can pick them up.

- [ ] **Step 3: Verify the script loads without console errors**

Run: `node build.js` then open `http://localhost:8080/dashboard.html?preview=1` in a browser. Open DevTools → Console.
Expected: no red errors related to MediaPipe. `window.__MP` should be defined with two properties.

- [ ] **Step 4: Commit**

```bash
git add dashboard.html
git commit -m "feat(pose): load MediaPipe Tasks Vision via ESM bridge"
```

---

### Task 1.2: Create a standalone Pose proof-of-concept page

**Files:**
- Create: `debug-pose-poc.html` (gitignored via `debug-*.html` pattern already in `.gitignore`)

**Why:** Before touching the production engine, prove MediaPipe works on our environment + our videos. This is throwaway code — keeps risk low.

- [ ] **Step 1: Write the proof-of-concept page**

Create `debug-pose-poc.html` at the project root with this content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Pose POC</title>
<style>
  body { background:#0a0a0a; color:#e0e0e0; font-family:monospace; margin:0; padding:16px; }
  .wrap { position:relative; display:inline-block; }
  #v { display:block; max-width:640px; }
  #c { position:absolute; left:0; top:0; pointer-events:none; }
  #status { color:#f5a623; margin:8px 0; }
</style>
</head>
<body>
<h2 style="color:#00ff88">Pose Landmarker POC</h2>
<div id="status">init…</div>
<div class="wrap"><video id="v" muted playsinline></video><canvas id="c"></canvas></div>
<pre id="log"></pre>

<script type="module">
  import { PoseLandmarker, FilesetResolver, DrawingUtils }
    from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
  window.__MP = { PoseLandmarker, FilesetResolver, DrawingUtils };
</script>

<script>
'use strict';
var statusEl = document.getElementById('status');
var logEl = document.getElementById('log');
var vid = document.getElementById('v');
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');

function log(s){ logEl.textContent += s + '\n'; }
function setStatus(s){ statusEl.textContent = s; }

async function waitForMP(){
  for (var i = 0; i < 100; i++) {
    if (window.__MP && window.__MP.PoseLandmarker) return window.__MP;
    await new Promise(function(r){ setTimeout(r, 100); });
  }
  throw new Error('MediaPipe never loaded');
}

async function main(){
  setStatus('loading MediaPipe module…');
  var MP = await waitForMP();

  setStatus('loading MediaPipe Pose model…');
  var t0 = performance.now();
  var resolver = await MP.FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  var landmarker = await MP.PoseLandmarker.createFromOptions(resolver, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numPoses: 1
  });
  log('model loaded in ' + ((performance.now() - t0) | 0) + ' ms');

  setStatus('loading video…');
  var resp = await fetch('_eval/v2.mp4');
  var blob = await resp.blob();
  vid.src = URL.createObjectURL(blob);
  await new Promise(function(r){ vid.onloadedmetadata = r; });
  canvas.width = vid.videoWidth;
  canvas.height = vid.videoHeight;
  // CSS sizing: canvas overlaps the video at its rendered size
  canvas.style.width = vid.clientWidth + 'px';
  canvas.style.height = vid.clientHeight + 'px';

  setStatus('detecting…');
  vid.play();
  var draw = new MP.DrawingUtils(ctx);
  var lastTs = -1;
  var poseFrames = 0;
  var totalFrames = 0;

  function loop(){
    if (vid.paused || vid.ended) {
      setStatus('done — pose frames: ' + poseFrames + ' / ' + totalFrames);
      return;
    }
    totalFrames++;
    var ts = vid.currentTime * 1000;
    if (ts === lastTs) { requestAnimationFrame(loop); return; }
    lastTs = ts;
    var result = landmarker.detectForVideo(vid, ts);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (result.landmarks && result.landmarks.length) {
      poseFrames++;
      for (var i = 0; i < result.landmarks.length; i++) {
        draw.drawLandmarks(result.landmarks[i], { radius: 3 });
        draw.drawConnectors(result.landmarks[i], MP.PoseLandmarker.POSE_CONNECTIONS);
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main().catch(function(e){ setStatus('ERROR: ' + e.message); log(e.stack); });
</script>
</body>
</html>
```

Notes for the engineer:
- We use the **Lite** Pose Landmarker (~5 MB) — fastest variant. Full/Heavy variants exist for higher accuracy if needed later.
- `delegate: 'GPU'` uses WebGL/WebGPU when available; falls back to CPU otherwise.
- `runningMode: 'VIDEO'` enables temporal smoothing between frames.

- [ ] **Step 2: Open the POC page in a browser**

In the dashboard's preview Chrome, navigate to `http://localhost:8080/debug-pose-poc.html`.
Expected: video starts playing with green pose landmarks + skeleton drawn on top of the player. After ~60 seconds: status shows `done — pose frames: N / M` where N is close to M (most frames have pose detected).

- [ ] **Step 3: Sanity-check on the indoor video too**

Edit the line `var resp = await fetch('_eval/v2.mp4');` — copy your indoor 25-shot recording into `_eval/v_indoor.mp4` first, then change to `await fetch('_eval/v_indoor.mp4');`. Reload the page.
Expected: pose detected on the Red Bull shooter despite the red ball and other distractors. **This is the proof we needed** — pose is robust where ball tracking failed.

- [ ] **Step 4: Capture results in a notes file**

Create `docs/superpowers/plans/2026-05-26-pose-poc-notes.md` with:
- model load time (ms)
- average FPS during detection
- pose detection rate (N/M)
- screenshot or written description of how well the pose follows the shooter

This becomes the baseline number we'll use to compare against later optimizations.

- [ ] **Step 5: Commit**

```bash
git add debug-pose-poc.html docs/superpowers/plans/2026-05-26-pose-poc-notes.md
git commit -m "poc(pose): standalone Pose Landmarker page on eval videos"
```

---

### Task 1.3: Create the production `poseDetector.js` module skeleton

**Files:**
- Create: `features/shot-tracking/poseDetector.js`
- Modify: `dashboard.html` — add `<script src="features/shot-tracking/poseDetector.js" defer></script>` after the existing shot-tracking scripts

**Why:** Now that we've proven the model works, wrap it in the IIFE pattern the rest of the codebase uses. This is a thin wrapper — no shot detection logic yet, just `init()` and `detect(videoEl, timestampMs)` returning landmark arrays.

- [ ] **Step 1: Write the module**

Create `features/shot-tracking/poseDetector.js`:

```js
/* ══════════════════════════════════════════════════════════════
   POSE DETECTOR — MediaPipe Pose Landmarker wrapper

   Single instance, lazy-loaded. Exposes:
     window.PoseDetector.init()             → Promise<void>
     window.PoseDetector.detect(vid, tsMs)  → { landmarks, ts } | null
     window.PoseDetector.isReady()          → bool

   Pose landmarker is loaded once globally. Re-calling init() is a no-op.
   Landmark indices follow the MediaPipe Pose schema (0=nose, 11/12=shoulders,
   13/14=elbows, 15/16=wrists, 23/24=hips, etc.). See
   https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DEBUG = (typeof window !== 'undefined' && window.PoseDetectorDebug === true);
  function dlog() { if (!DEBUG) return; console.log.apply(console, arguments); }

  var _landmarker = null;
  var _initPromise = null;

  function isReady() { return _landmarker !== null; }

  async function _waitForMP() {
    for (var i = 0; i < 100; i++) {
      if (window.__MP && window.__MP.PoseLandmarker) return window.__MP;
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    throw new Error('MediaPipe Tasks Vision never loaded (window.__MP missing)');
  }

  async function init() {
    if (_landmarker) return;
    if (_initPromise) return _initPromise;
    _initPromise = (async function () {
      var MP = await _waitForMP();
      var t0 = performance.now();
      var resolver = await MP.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      _landmarker = await MP.PoseLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1
      });
      dlog('[PoseDetector] model loaded in ' + ((performance.now() - t0) | 0) + ' ms');
    })();
    return _initPromise;
  }

  /* ── detect ────────────────────────────────────────────────────
     Returns the most-recent pose landmark set, or null if detection
     failed for this frame. Caller is responsible for monotonically
     advancing `timestampMs` — passing the same value twice in a row
     is treated as "use the cached result".
   ──────────────────────────────────────────────────────────────── */
  var _lastTs = -1;
  var _lastResult = null;

  function detect(videoEl, timestampMs) {
    if (!_landmarker || !videoEl || videoEl.readyState < 2) return null;
    if (timestampMs === _lastTs) return _lastResult;
    _lastTs = timestampMs;
    var raw = _landmarker.detectForVideo(videoEl, timestampMs);
    if (raw && raw.landmarks && raw.landmarks.length) {
      _lastResult = { landmarks: raw.landmarks[0], ts: timestampMs };
    } else {
      _lastResult = null;
    }
    return _lastResult;
  }

  window.PoseDetector = { init: init, detect: detect, isReady: isReady };
})();
```

- [ ] **Step 2: Add to `dashboard.html`**

Find the line `<script src="features/shot-tracking/shotDetection.js" defer></script>`. Add immediately AFTER it (so poseDetector loads in the same defer group):

```html
<script src="features/shot-tracking/poseDetector.js" defer></script>
```

- [ ] **Step 3: Smoke-test via DevTools console**

Run `node build.js`, open `http://localhost:8080/dashboard.html?preview=1`, then in the console:

```js
await window.PoseDetector.init();
window.PoseDetector.isReady(); // → true
```

Expected: `true`. Model loaded successfully via the production module path.

- [ ] **Step 4: Commit**

```bash
git add features/shot-tracking/poseDetector.js dashboard.html
git commit -m "feat(pose): add PoseDetector module skeleton"
```

---

### Chunk 1 Review Gate

Before moving to Chunk 2, verify:

- [ ] `window.__MP` exists on dashboard load
- [ ] `window.PoseDetector.init()` resolves without errors
- [ ] POC page draws skeleton on a player in motion (v1, v2, v_indoor)
- [ ] Detection rate ≥ 90% of frames on the indoor video (verified in POC notes)
- [ ] No console errors related to MediaPipe on production dashboard

If any of these fail, **fix Chunk 1 before proceeding**. Common issues:
- `window.__MP missing` → ESM bridge script in dashboard.html isn't loading. Check `type="module"` attribute is present and the URL is reachable.
- Model 404 → MediaPipe storage URL changed. Check https://developers.google.com/mediapipe/solutions/vision/pose_landmarker for current URL.
- Pose detection rate < 80% → may need to use the Full model variant (`pose_landmarker_full.task`) for indoor low-light.

---

## Chunk 2: Shot-Motion Detector — The Heart of the New System

> **Goal of this chunk:** by the end of Chunk 2, `PoseDetector.detectShootingMotion(pose, history)` returns `{ isShot: true, releaseTimestamp, releaseConfidence }` reliably when a player shoots. We verify it on the indoor 25-shot video and tune until recall ≥ 80%.

### Task 2.1: Define the shooting-motion heuristic

**Files:**
- Modify: `features/shot-tracking/poseDetector.js` — add `detectShootingMotion`, `_features`, internal history buffer

**Why:** This is the algorithmic core. A "shooting motion" is a specific kinematic signature in pose space. We compute three features per frame and detect the signature.

The three features:

1. **`wristAboveHead`**: max(wrist.y) is above min(nose.y) — i.e. the highest wrist is higher in frame than the nose. (Y is inverted in pose coords: 0 = top of frame.)
2. **`armsExtended`**: distance(wrist, shoulder) is large — wrist is far from shoulder on the body's primary axis.
3. **`risingVelocity`**: wrist.y is decreasing (moving up) for at least 200 ms with monotonic delta ≥ 0.04 normalized frame height.

A **shot release** is detected when all three hit simultaneously AND the wrist y-velocity has just changed sign (peak detected). The release timestamp = the moment of peak.

- [ ] **Step 1: Add the history buffer and feature extractor**

Add to `poseDetector.js`, immediately above the `window.PoseDetector = ...` line:

```js
  /* ── Pose feature extraction ──────────────────────────────────
     MediaPipe Pose landmark indices used here:
       0  nose
       11 left shoulder    12 right shoulder
       13 left elbow       14 right elbow
       15 left wrist       16 right wrist
       23 left hip         24 right hip
     All coords are normalized [0,1] of the video frame.
   ──────────────────────────────────────────────────────────────── */
  var L = { NOSE:0, LSH:11, RSH:12, LEL:13, REL:14, LWR:15, RWR:16, LHIP:23, RHIP:24 };

  function _avg(a, b) { return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }
  function _dist(a, b) { var dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }

  function _extractFeatures(lm, tsMs) {
    if (!lm || lm.length < 25) return null;
    var nose = lm[L.NOSE];
    var sh   = _avg(lm[L.LSH], lm[L.RSH]);
    var hip  = _avg(lm[L.LHIP], lm[L.RHIP]);
    // Shooting hand: whichever wrist is higher (lower Y) right now
    var lw = lm[L.LWR], rw = lm[L.RWR];
    var wrist = (lw.y < rw.y) ? lw : rw;
    var elbow = (lw.y < rw.y) ? lm[L.LEL] : lm[L.REL];
    var shoulder = (lw.y < rw.y) ? lm[L.LSH] : lm[L.RSH];
    var bodyHeight = Math.max(0.05, _dist(sh, hip));   // shoulder→hip as scale ref
    return {
      ts: tsMs,
      wristY:           wrist.y,
      wristAboveNose:   wrist.y < nose.y,
      wristAboveShoulder: wrist.y < sh.y,
      armExtension:     _dist(wrist, shoulder) / bodyHeight,
      visibility:       (wrist.visibility || 0) * (elbow.visibility || 0) * (shoulder.visibility || 0),
      bodyHeight:       bodyHeight
    };
  }
```

- [ ] **Step 2: Add the history buffer + shot-motion detector**

Add immediately after `_extractFeatures`:

```js
  /* ── Shooting-motion state ────────────────────────────────────
     Keep a rolling buffer of recent feature snapshots. The
     detector looks for a release peak: wristY descending into
     a minimum (peak above head) then beginning to rise again.
   ──────────────────────────────────────────────────────────────── */
  var _history = [];
  var HISTORY_MS = 1500;
  var _lastShotReleaseTs = 0;
  var SHOT_COOLDOWN_MS = 700;  // shorter than ball-only cooldown — pose is reliable

  function _pruneHistory(nowTs) {
    while (_history.length && nowTs - _history[0].ts > HISTORY_MS) _history.shift();
  }

  /* Detect: is the latest sample a shot-release peak?
     A release is when:
       (a) latest sample has wristAboveNose === true,
       (b) wrist Y started below shoulder ≥400ms ago in the buffer,
       (c) latest sample's wristY is locally minimal — i.e. wristY started
           increasing again (or has plateaued at the top).
   */
  function detectShootingMotion(lm, tsMs) {
    var f = _extractFeatures(lm, tsMs);
    if (!f) return { isShot:false };
    _pruneHistory(tsMs);
    _history.push(f);

    if (tsMs - _lastShotReleaseTs < SHOT_COOLDOWN_MS) return { isShot:false };
    if (f.visibility < 0.4) return { isShot:false };
    if (!f.wristAboveNose) return { isShot:false };
    if (f.armExtension < 0.9) return { isShot:false };  // arm not extended

    // Was wrist below shoulder in the recent past (≥400ms ago)?
    var startedBelow = false;
    for (var i = 0; i < _history.length - 1; i++) {
      var h = _history[i];
      if (tsMs - h.ts >= 400 && !h.wristAboveShoulder) { startedBelow = true; break; }
    }
    if (!startedBelow) return { isShot:false };

    // Peak detection: is wristY at a local minimum?
    // Look at last ~150 ms of samples — if current is the lowest, we're at or just past the peak.
    var recentMinY = f.wristY;
    var samplesChecked = 0;
    for (var j = _history.length - 2; j >= 0; j--) {
      if (tsMs - _history[j].ts > 200) break;
      samplesChecked++;
      if (_history[j].wristY < recentMinY) recentMinY = _history[j].wristY;
    }
    var isPeak = samplesChecked >= 2 && Math.abs(f.wristY - recentMinY) < 0.01;
    if (!isPeak) return { isShot:false };

    _lastShotReleaseTs = tsMs;
    return {
      isShot: true,
      releaseTs: tsMs,
      releaseConfidence: f.visibility,
      shooterCenterX: lm[L.LHIP].x * 0.5 + lm[L.RHIP].x * 0.5,
      shooterCenterY: lm[L.LHIP].y * 0.5 + lm[L.RHIP].y * 0.5
    };
  }

  function resetMotion() { _history = []; _lastShotReleaseTs = 0; }
```

- [ ] **Step 3: Update the `window.PoseDetector` export**

Replace the export line at the bottom with:

```js
  window.PoseDetector = {
    init: init,
    detect: detect,
    detectShootingMotion: detectShootingMotion,
    resetMotion: resetMotion,
    isReady: isReady,
    _extractFeatures: _extractFeatures  // exposed for testing
  };
```

- [ ] **Step 4: Run build + smoke test**

```bash
node build.js
```

Then in DevTools console at `dashboard.html?preview=1`:

```js
await PoseDetector.init();
typeof PoseDetector.detectShootingMotion === 'function'; // → true
```

- [ ] **Step 5: Commit**

```bash
git add features/shot-tracking/poseDetector.js
git commit -m "feat(pose): shooting-motion heuristic (peak detection)"
```

---

### Task 2.2: Build a pose-shot benchmark harness

**Files:**
- Create: `debug-pose-shot-bench.html` (gitignored)

**Why:** Before integrating with the state machine, we need to know how well `detectShootingMotion` works in isolation. This harness runs it on a test video and prints every shot it detects with timestamp. We compare against ground truth (user knows how many shots were in each video).

- [ ] **Step 1: Write the bench page**

Create `debug-pose-shot-bench.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Pose Shot Benchmark</title>
<style>
  body { background:#0a0a0a; color:#e0e0e0; font-family:monospace; margin:0; padding:16px; }
  .wrap { position:relative; display:inline-block; }
  #v { display:block; max-width:640px; }
  #c { position:absolute; left:0; top:0; pointer-events:none; }
  #status { color:#f5a623; margin:8px 0; }
  #log { background:#111; padding:10px; max-height:40vh; overflow:auto; font-size:11px; }
  .shot { color:#00ff88; }
</style>
</head>
<body>
<h2 style="color:#00ff88">Pose Shot Benchmark</h2>
<div id="controls">
  <select id="src">
    <option value="_eval/v1.mp4">v1 (outdoor, 35s)</option>
    <option value="_eval/v2.mp4">v2 (outdoor, 56s)</option>
    <option value="_eval/v3.mp4">v3 (outdoor, 32s)</option>
    <option value="_eval/v_indoor.mp4">v_indoor (indoor 25-shot)</option>
  </select>
  <button id="go">Run</button>
</div>
<div id="status">idle</div>
<div class="wrap"><video id="v" muted playsinline></video><canvas id="c"></canvas></div>
<pre id="log"></pre>

<script type="module">
  import { PoseLandmarker, FilesetResolver, DrawingUtils }
    from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
  window.__MP = { PoseLandmarker, FilesetResolver, DrawingUtils };
</script>
<script src="features/shot-tracking/poseDetector.js"></script>
<script>
'use strict';
var statusEl = document.getElementById('status');
var logEl    = document.getElementById('log');
var vid      = document.getElementById('v');
var canvas   = document.getElementById('c');
var ctx      = canvas.getContext('2d');

function setStatus(s) { statusEl.textContent = s; }
function log(s, cls) { var span = document.createElement('div'); if (cls) span.className = cls; span.textContent = s; logEl.appendChild(span); logEl.scrollTop = logEl.scrollHeight; }

document.getElementById('go').addEventListener('click', async function () {
  logEl.innerHTML = '';
  setStatus('initializing…');
  await window.PoseDetector.init();
  window.PoseDetector.resetMotion();

  var src = document.getElementById('src').value;
  var resp = await fetch(src);
  var blob = await resp.blob();
  vid.src = URL.createObjectURL(blob);
  await new Promise(function(r){ vid.onloadedmetadata = r; });
  canvas.width = vid.videoWidth;
  canvas.height = vid.videoHeight;

  setStatus('detecting…');
  var shots = [];
  var lastTs = -1;
  vid.play();

  function loop() {
    if (vid.paused || vid.ended) {
      setStatus('done — shots detected: ' + shots.length);
      window.__BENCH_SHOTS = shots;
      return;
    }
    var ts = vid.currentTime * 1000;
    if (ts === lastTs) { requestAnimationFrame(loop); return; }
    lastTs = ts;
    var pose = window.PoseDetector.detect(vid, ts);
    if (pose) {
      var motion = window.PoseDetector.detectShootingMotion(pose.landmarks, ts);
      if (motion.isShot) {
        shots.push({ t: (ts/1000).toFixed(2), conf: motion.releaseConfidence.toFixed(2) });
        log('🏀 SHOT at t=' + (ts/1000).toFixed(2) + 's  conf=' + motion.releaseConfidence.toFixed(2), 'shot');
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
</script>
</body>
</html>
```

- [ ] **Step 2: Copy the indoor 25-shot video to `_eval/v_indoor.mp4`**

```bash
# from the project root (run only once)
cp "C:/Users/tamir/AppData/Local/Packages/Microsoft.ScreenSketch_8wekyb3d8bbwe/TempState/Recordings/<INDOOR_RECORDING_FILENAME>.mp4" _eval/v_indoor.mp4
cp _eval/v_indoor.mp4 www/_eval/v_indoor.mp4
```

Replace `<INDOOR_RECORDING_FILENAME>` with the user-supplied indoor video. If they don't have one yet, ask before proceeding.

- [ ] **Step 3: Run the bench on each video**

Open `http://localhost:8080/debug-pose-shot-bench.html`, select each video, click Run. Record the shot count per video.

Expected on the **outdoor v1** (≈1-2 shots in 35s): 1-3 shot events.
Expected on the **outdoor v2** (≈2-4 shots in 56s): 2-5 shot events.
Expected on the **indoor v_indoor** (user said 25 shots): 18-25 shot events.

If indoor shot count is < 15, the heuristic is too strict. Tune by:
- Lowering `armExtension` threshold from 0.9 → 0.75
- Lowering visibility threshold from 0.4 → 0.25
- Reducing required startedBelow time from 400ms → 250ms

If shot count is > 30 (false positives), tighten:
- Raise armExtension to 1.0
- Require both wrists above shoulder (not just one)

- [ ] **Step 4: Record findings in a notes file**

Append results to `docs/superpowers/plans/2026-05-26-pose-poc-notes.md`:

```markdown
## Pose-only shot detection benchmark (Task 2.2)
| Video | Ground truth | Detected | Recall | Notes |
|---|---|---|---|---|
| v1 | ? | ? | ? | |
| v2 | ? | ? | ? | |
| v_indoor | 25 | ? | ? | |
```

- [ ] **Step 5: Commit (regardless of tuning state)**

```bash
git add debug-pose-shot-bench.html docs/superpowers/plans/2026-05-26-pose-poc-notes.md
git commit -m "test(pose): shot-detection benchmark harness + initial results"
```

---

### Task 2.3: Iterate on heuristic until indoor recall ≥ 80%

**Files:**
- Modify: `features/shot-tracking/poseDetector.js` — adjust thresholds in `detectShootingMotion`

**Why:** The first heuristic is a starting point. Real shooting motions vary. We tune by eye + bench results until the indoor 25-shot video shows ≥ 20 detected shots without too many false positives.

- [ ] **Step 1: Make thresholds top-of-file constants**

Move the magic numbers in `detectShootingMotion` into named constants at the top of the IIFE (just below the `DEBUG` declaration):

```js
  /* ── Heuristic tunables ──
     Adjust these based on empirical benchmark results. */
  var POSE_VISIBILITY_MIN   = 0.4;   // skip frames where shooter is occluded
  var POSE_ARM_EXTENSION    = 0.9;   // wrist-to-shoulder dist / body height
  var POSE_BELOW_LOOKBACK_MS = 400;  // need wrist below shoulder this long ago
  var POSE_PEAK_WINDOW_MS    = 200;  // window for peak-detection
  var POSE_PEAK_TOLERANCE    = 0.01; // |y_current - y_min| ≤ this means "at peak"
  var POSE_SHOT_COOLDOWN_MS  = 700;
```

Then reference them inside `detectShootingMotion`. This makes the tuning loop fast — change a constant, reload, re-bench.

- [ ] **Step 2: Run bench on v_indoor, note recall**

Record current recall. If ≥ 80%, skip to Step 5.

- [ ] **Step 3: Tune one variable at a time**

If recall is low, drop `POSE_ARM_EXTENSION` by 0.1 and re-test. If still low, drop `POSE_BELOW_LOOKBACK_MS` to 250. If still low, drop `POSE_VISIBILITY_MIN` to 0.25. Stop as soon as recall ≥ 80% OR false positives spike.

- [ ] **Step 4: Run bench on v1 and v2 too**

Make sure tuning didn't break the outdoor case. Both should still show plausible shot counts (a few shots over a 30-60s clip).

- [ ] **Step 5: Update notes + commit**

Update the table in `docs/superpowers/plans/2026-05-26-pose-poc-notes.md` with final results and the final threshold values.

```bash
git add features/shot-tracking/poseDetector.js docs/superpowers/plans/2026-05-26-pose-poc-notes.md
git commit -m "tune(pose): heuristic thresholds — indoor recall ≥ 80%"
```

---

### Chunk 2 Review Gate

Verify before moving on:

- [ ] Indoor `v_indoor.mp4` shows ≥ 80% recall (≥ 20 of 25 shots)
- [ ] Outdoor videos still show plausible shot counts
- [ ] False positives per minute ≤ 1 across all test videos
- [ ] All tunable parameters live in named constants
- [ ] `window.PoseDetector.detectShootingMotion()` is the only public API for shot detection

---

## Chunk 3: State Machine Integration — Pose Becomes the Trigger

> **Goal:** rewrite the `idle → shot_started` transition in `shotDetection.js` so pose-based motion (when available) becomes the primary trigger, with the existing ball-rose-in-window logic as a fallback. The rest of the state machine (near_hoop, make/miss) keeps using ball+hoop data.

### Task 3.1: Add pose-driven entry to the state machine

**Files:**
- Modify: `features/shot-tracking/shotDetection.js` — `_analyzeShotState`, `init`, `start`

**Why:** Currently `idle → shot_started` requires `ballRoseInWindow(...)`. We add a NEW transition: if `window.PoseDetector.isReady()` and `detectShootingMotion()` reports a shot, transition to `shot_started` immediately. Ball-based fallback stays in place for when pose isn't available (e.g. shooter off-screen).

- [ ] **Step 1: Initialize PoseDetector during engine `init()`**

In `shotDetection.js`, find the existing `init: function () {` method on the `ShotDetectionEngine` object. After the existing initialization but before `resolve(true)` in the model-load success path, add:

```js
        // Kick off pose detector init in parallel — non-blocking,
        // engine works without it (ball-only fallback).
        if (window.PoseDetector && typeof window.PoseDetector.init === 'function') {
          window.PoseDetector.init().catch(function (err) {
            console.warn('[ShotDetection] PoseDetector init failed — ball-only mode:', err);
          });
        }
```

- [ ] **Step 2: Add pose-driven trigger in `_analyzeShotState`**

Find the `idle` branch of `_analyzeShotState`. Currently it looks like:

```js
      if (this._shotState === 'idle') {
        if (ballRoseInWindow(this.tracker, vh, 600, 0.03)) {
          this._shotState         = 'shot_started';
          // ... reset state ...
        }
        return;
      }
```

Replace with:

```js
      if (this._shotState === 'idle') {
        // ── Primary trigger: pose-based shooting motion ──
        var poseShot = null;
        if (window.PoseDetector && window.PoseDetector.isReady() && this.videoEl) {
          var pose = window.PoseDetector.detect(this.videoEl, this.videoEl.currentTime * 1000);
          if (pose) {
            poseShot = window.PoseDetector.detectShootingMotion(pose.landmarks, pose.ts);
          }
        }
        // ── Fallback: ball-rising trigger (preserved) ──
        var ballRose = ballRoseInWindow(this.tracker, vh, 600, 0.03);
        if ((poseShot && poseShot.isShot) || ballRose) {
          this._shotState         = 'shot_started';
          this._shotStateTime     = now;
          this._ballMinY          = normY;
          this._shotStartY        = normY;
          this._risingFrameCount  = 0;
          this._sawBallAboveRim   = (normY < rim.centerY);
          this._shotTriggerSrc    = poseShot && poseShot.isShot ? 'pose' : 'ball';
          this._releaseConfidence = poseShot ? poseShot.releaseConfidence : null;
          // Optional: store shooter centroid for shot-zone classification
          if (poseShot && poseShot.isShot) {
            this._shooterFeetX = poseShot.shooterCenterX;
            this._shooterFeetY = poseShot.shooterCenterY;
          }
        }
        return;
      }
```

- [ ] **Step 3: Reset pose history when the engine resets**

In `shotDetection.js`'s `start` method, after the existing state resets, add:

```js
      if (window.PoseDetector && typeof window.PoseDetector.resetMotion === 'function') {
        window.PoseDetector.resetMotion();
      }
      this._shotTriggerSrc = null;
      this._releaseConfidence = null;
```

Do the same in `resetStats` if it exists.

- [ ] **Step 4: Add the new state fields to the engine declaration block**

Find the engine state declaration (look for `_shotState: 'idle',`). After the `_sawBallAboveRim` field, add:

```js
    _shotTriggerSrc: null,        // 'pose' | 'ball' — what fired shot_started
    _releaseConfidence: null,     // 0-1, only meaningful when _shotTriggerSrc === 'pose'
    _shooterFeetX: null,          // normalized x of shooter centroid at release
    _shooterFeetY: null,          // normalized y of shooter centroid at release
```

- [ ] **Step 5: Smoke test**

```bash
node build.js
```

Open `dashboard.html?preview=1`, run shot tracker via the launch button on a real test video (or wait for Task 5.1 to wire up batch testing).

- [ ] **Step 6: Commit**

```bash
git add features/shot-tracking/shotDetection.js
git commit -m "feat(state-machine): pose-driven idle→shot_started trigger"
```

---

### Task 3.2: Use shooter centroid for shot-zone classification

**Files:**
- Modify: `features/shot-tracking/shotDetection.js` — `_countShot`

**Why:** Right now, `_countShot` uses `getLaunchPoint(tracker)` which is the ball's launch point (often unreliable when ball detection is noisy). When pose data is available, the shooter's feet location is a far better signal for "where did the shot come from" → Paint vs Mid-Range vs 3PT vs FT classification.

- [ ] **Step 1: Modify `_countShot` to prefer pose-supplied feet location**

Find `_countShot: function (result, vw, vh, normX, normY, now) {` in `shotDetection.js`. The first lines compute `launchPt` and `shotZone`. Replace:

```js
      var launchPt = getLaunchPoint(this.tracker, vw, vh);
      var shotZone = classifyShotZone(launchPt, this.rimZone, this.threePtDistance);
```

with:

```js
      // Prefer pose-supplied shooter centroid when available (more reliable
      // than ball trajectory launch point on noisy detections).
      var launchPt;
      if (this._shotTriggerSrc === 'pose' && this._shooterFeetX != null) {
        launchPt = { x: this._shooterFeetX * vw, y: this._shooterFeetY * vh };
      } else {
        launchPt = getLaunchPoint(this.tracker, vw, vh);
      }
      var shotZone = classifyShotZone(launchPt, this.rimZone, this.threePtDistance);
```

- [ ] **Step 2: Reset the pose-related fields when cooldown ends**

Find where `_shotState = 'cooldown'` transitions back to `idle` (cooldown timeout). Add resets for the pose fields there:

```js
          this._shotTriggerSrc   = null;
          this._releaseConfidence = null;
          this._shooterFeetX     = null;
          this._shooterFeetY     = null;
```

- [ ] **Step 3: Commit**

```bash
git add features/shot-tracking/shotDetection.js
git commit -m "feat(zone): use pose centroid for shot-zone classification"
```

---

## Chunk 4: Run the Real End-to-End Test on All Videos

> **Goal:** prove the integrated system works on real videos. Adapt the existing eval harness to use the real engine flow (setInterval-driven) not manual scrubbing. Use the dashboard's actual `ShotTrackingScreen.openFromFile()` path.

### Task 4.1: Add the indoor video to the eval harness

**Files:**
- Modify: `debug-eval-run.html` — add `v_indoor` to the VIDEOS list

- [ ] **Step 1: Edit the harness**

In `debug-eval-run.html`, find the `var VIDEOS = [...]` array. Add:

```js
  { id: 'v_indoor', src: '_eval/v_indoor.mp4', label: 'indoor 25-shot' }
```

- [ ] **Step 2: Run the harness**

```bash
node build.js
cp debug-eval-run.html www/debug-eval-run.html
```

Open `http://localhost:8080/debug-eval-run.html`. Wait for it to finish all 4 videos.

- [ ] **Step 3: Capture results**

In DevTools console:

```js
window.__EVAL_REPORT.forEach(r => console.log(r.id, '— shots:', r.shots.length, '— attempts:', r.engineStats.attempts));
```

Record these in `docs/superpowers/plans/2026-05-26-pose-poc-notes.md` under "Integrated harness results".

- [ ] **Step 4: Commit**

```bash
git add debug-eval-run.html docs/superpowers/plans/2026-05-26-pose-poc-notes.md
git commit -m "test(eval): add indoor 25-shot video to harness"
```

---

### Task 4.2: Live-dashboard test on the indoor video

**Files:**
- (No file changes; manual verification)

- [ ] **Step 1: Open the dashboard with preview bypass**

`http://localhost:8080/dashboard.html?preview=1`. Click LAUNCH CAMERA's sibling button "Upload Video" → select your indoor 25-shot recording.

- [ ] **Step 2: Enable debug overlay (🐛 button) right after rim-lock**

Verify:
- Pose skeleton drawn on the shooter (if the UI has pose drawing — added in Chunk 5)
- Hoop bbox in blue, rim line red, near_hoop dashed yellow

- [ ] **Step 3: Let the session run all 25 shots**

Note how many `Attempts` show on the live stats counter. Compare to the eval-harness number.

Expected: ≥ 20 attempts counted (≥ 80% recall). If less, return to Chunk 2 tuning.

- [ ] **Step 4: Open Session Complete summary**

Note Made / Attempts / Paint / Mid / 3PT distribution. Compare against ground truth (the user said all 25 shots went in).

If Made < Attempts × 0.7, made/miss classification is the next problem to tackle (separate plan).

- [ ] **Step 5: Add live-test results to notes**

Append a "Live dashboard test" section to `docs/superpowers/plans/2026-05-26-pose-poc-notes.md` with the numbers + screenshots if possible.

---

## Chunk 5: Polish — Debug Overlay + Production Readiness

> **Goal:** make the pose overlay visible in the dashboard debug mode, add error handling for cases where MediaPipe fails to load, ensure mobile performance is acceptable.

### Task 5.1: Draw the pose skeleton in the dashboard debug overlay

**Files:**
- Modify: `features/shot-tracking/ShotTrackingScreen.js` — the debug-mode rendering block (where hoop bbox + rim line + near_hoop zone are drawn)

**Why:** Visualizing the pose in real time is the fastest way to debug heuristic misses. We piggyback on the existing debug rendering code.

- [ ] **Step 1: Add pose drawing to the debug block**

Find the debug-mode rendering section in `ShotTrackingScreen.js` (search for `// ── DEBUG MODE: Draw bounding boxes + labels ──`). After the existing rim/near_hoop drawing, add:

```js
        // ── Pose skeleton (if available) ──
        if (window.PoseDetector && window.PoseDetector.isReady() && videoEl) {
          var pose = window.PoseDetector.detect(videoEl, videoEl.currentTime * 1000);
          if (pose && pose.landmarks) {
            canvasCtx.save();
            // Map normalized pose coords to display-canvas
            var pxs = pose.landmarks.map(function (p) { return { x: p.x * cw, y: p.y * ch, vis: p.visibility }; });
            // Skeleton connections (MediaPipe Pose subset for upper body)
            var bones = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[24,26],[0,11],[0,12]];
            canvasCtx.strokeStyle = 'rgba(0,229,255,0.7)';
            canvasCtx.lineWidth = 2;
            for (var bi = 0; bi < bones.length; bi++) {
              var a = pxs[bones[bi][0]], b = pxs[bones[bi][1]];
              if (a.vis > 0.3 && b.vis > 0.3) {
                canvasCtx.beginPath();
                canvasCtx.moveTo(a.x, a.y);
                canvasCtx.lineTo(b.x, b.y);
                canvasCtx.stroke();
              }
            }
            // Wrists in pink (the shooting-hand candidates)
            canvasCtx.fillStyle = '#ec4899';
            [15,16].forEach(function(idx){
              if (pxs[idx].vis > 0.3) {
                canvasCtx.beginPath();
                canvasCtx.arc(pxs[idx].x, pxs[idx].y, 5, 0, Math.PI*2);
                canvasCtx.fill();
              }
            });
            canvasCtx.restore();
          }
        }
```

- [ ] **Step 2: Smoke test**

```bash
node build.js
```

Open dashboard, upload a video, enable debug, verify pose skeleton draws.

- [ ] **Step 3: Commit**

```bash
git add features/shot-tracking/ShotTrackingScreen.js
git commit -m "feat(debug): draw pose skeleton in debug overlay"
```

---

### Task 5.2: Graceful degradation when MediaPipe fails to load

**Files:**
- Modify: `features/shot-tracking/poseDetector.js` — make sure init failures don't crash the engine

- [ ] **Step 1: Add a try/catch around the dynamic import in `_waitForMP`**

If `window.__MP` is missing after 10 seconds, log a warning and let `isReady()` return `false` forever (graceful fallback to ball-only mode).

```js
  async function _waitForMP() {
    for (var i = 0; i < 100; i++) {
      if (window.__MP && window.__MP.PoseLandmarker) return window.__MP;
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    console.warn('[PoseDetector] MediaPipe Tasks Vision unavailable — pose features disabled');
    throw new Error('MediaPipe Tasks Vision never loaded');
  }
```

Then in `init`, catch that throw so callers don't break:

```js
    _initPromise = (async function () {
      try {
        var MP = await _waitForMP();
        // ... rest unchanged
      } catch (err) {
        _landmarker = null;
        throw err;
      }
    })();
```

- [ ] **Step 2: Verify the engine survives missing MediaPipe**

Temporarily block the MediaPipe CDN URL via DevTools → Network → Block request. Reload dashboard. Run a shot tracker session. It should fall back to ball-only mode without errors.

- [ ] **Step 3: Commit**

```bash
git add features/shot-tracking/poseDetector.js
git commit -m "fix(pose): graceful fallback when MediaPipe unavailable"
```

---

### Task 5.3: Performance check on mobile (manual)

**Files:**
- (No file changes; observation only)

- [ ] **Step 1: Build & deploy via GitHub Pages**

```bash
node build.js
git add www/
git commit -m "build: deploy pose detection"
git push
```

Wait ~30 seconds for GitHub Pages to publish.

- [ ] **Step 2: Open on a real Android phone**

Browse to your deployed URL on a phone. Launch the camera, take 5 real shots.

Notes to capture in the plan notes file:
- Does the camera frame rate drop noticeably?
- Does Pose+YOLOX both run, or does one starve out the other?
- Battery / heat after 1 minute?

If FPS drops below 15, consider:
- Using the Lite Pose model (already are) but at lower input resolution
- Throttling Pose to every 3rd frame instead of every frame

- [ ] **Step 3: Commit notes**

Update notes file with mobile-performance results and commit.

---

## Today's Stopping Point

If you only have a few hours today, aim to complete **Chunk 1 entirely** (Tasks 1.1, 1.2, 1.3). That gets MediaPipe loaded and the module skeleton in place. Tomorrow you tackle Chunk 2 — the actual shot-motion algorithm.

Realistic time budget for today (4 hours):
- Task 1.1: 15 min
- Task 1.2: 1 hour (writing + POC verification on all videos)
- Task 1.3: 30 min
- Buffer for debugging: 1 hour
- Notes + commits: 30 min
- **Total: ~3 hours**

Tomorrow (Chunk 2): 4-6 hours.
Day 3 (Chunks 3-4): 4-6 hours.
Day 4 (Chunk 5 polish): 2-3 hours.

**Total: 5-7 working days from start to production-ready.**

---

## Open Questions for the User

These need answers before/during execution — surface them when relevant:

1. **Ground-truth shot counts:** for v1, v2, v3, the user said v1 had ≈2 shots (matched our 2 attempts). What were the actual shot counts? Needed for accurate recall measurement.
2. **Indoor video filename:** confirm the path of the 25-shot indoor recording. We're treating it as `_eval/v_indoor.mp4` — confirm or adjust.
3. **Multi-person handling:** if multiple people are in frame (e.g. defender), pose detector might lock onto the wrong one. Acceptable for v1?
4. **Tournament/training mode distinction:** is this for solo training videos only, or do team-game videos need to work too?

---

## Risk Register

| Risk | Mitigation |
|---|---|
| MediaPipe Lite too inaccurate for fast motion | Try Full variant (10 MB). If still bad, train custom shot-pose classifier. |
| CDN model URL changes / 404 | Pin a specific version (`v0.10.14`). Add fallback to bundled model if needed. |
| MediaPipe + YOLOX both running too heavy on mobile | Throttle pose to 15 FPS; YOLOX stays at 5 FPS. |
| Heuristic too brittle for varied shooting forms (jump shots vs set shots) | Build a small training set of pose sequences + train a tiny classifier (last resort). |
| Pose loses shooter when defender obstructs | Multi-pose mode + identify "active shooter" by motion characteristics. (Phase 2 enhancement.) |
