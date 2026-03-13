# AI Shot Tracker Refactor — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace COCO-SSD (30MB, crashes mobile) with MediaPipe efficientdet_lite0 (3MB) + color-primary detection so shot counting works reliably on iPhone/Android.

**Architecture:** Keep the existing `features/shot-tracking/` module structure intact. The only files that change are `dashboard.html` (swap script tags) and `features/shot-tracking/shotDetection.js` (swap model loading + detection logic). Color detection already exists and works — it becomes the primary path every frame; MediaPipe runs every 5th frame as a secondary confirmation.

**Tech Stack:** Vanilla JS, IIFE pattern, MediaPipe Tasks Vision (`vision_bundle.mjs` CDN via ES module shim), HTML5 Canvas, no bundler.

---

## Chunk 1: Infrastructure — dashboard.html + Model Loading

### Task 1: Swap script tags in dashboard.html

**Files:**
- Modify: `dashboard.html` (lines 2536–2537 — the TF.js + COCO-SSD script tags)

**Background:** Lines 2536–2537 load TF.js (heavy) and COCO-SSD (30MB+ model). These cause crashes on mobile. We replace them with the MediaPipe Tasks Vision CDN, loaded **synchronously** (no `defer`) so the globals (`FilesetResolver`, `ObjectDetector`) are available when the deferred `shotDetection.js` runs.

- [ ] **Step 1: Open dashboard.html and locate the TF.js + COCO-SSD script tags**

  Run:
  ```bash
  grep -n "tensorflow\|coco-ssd\|mediapipe" dashboard.html
  ```
  Expected: Lines 2536–2537 contain TF.js and COCO-SSD CDN URLs. No MediaPipe tag yet.

- [ ] **Step 2: Replace TF.js + COCO-SSD tags with MediaPipe CDN shim**

  **Why a shim is needed:** `@mediapipe/tasks-vision` ships `vision_bundle.mjs` (an ES module). A plain `<script src="...">` tag cannot load `.mjs` files, and even `type="module"` would scope the exports — they wouldn't land on `window`. We need to import from the module and explicitly assign to `window` so the rest of the (non-module) code can access `FilesetResolver` and `ObjectDetector`.

  In `dashboard.html`, replace:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js" integrity="sha384-xc4sZTUOM2obsQR75Be0zGbt7Gb6mOVFJN4yBm30Xn0YQLDWIY+yrtFmLmIank6w" crossorigin="anonymous" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js" integrity="sha384-7qLdgfEQyO9ZQi9ArRHigK+IBto4XPk468jAqc+fnsXaZIcMAhQeLwzggRK7aESl" crossorigin="anonymous" defer></script>
  ```
  With:
  ```html
  <!-- MediaPipe Tasks Vision — ES module shim: assigns FilesetResolver + ObjectDetector to window
       so non-module IIFE scripts (shotDetection.js) can access them via typeof guards.
       IMPORTANT: module scripts share the same deferred-script execution queue as classic
       defer scripts and execute in document order. Placing this tag BEFORE the shot-tracking
       defer script tags guarantees it runs first. If vision_bundle.mjs is not yet loaded
       when shotDetection.js runs, _tryLoadModel falls back to color-only mode safely. -->
  <script type="module">
    import { FilesetResolver, ObjectDetector }
      from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs';
    window.FilesetResolver = FilesetResolver;
    window.ObjectDetector  = ObjectDetector;
  </script>
  ```

- [ ] **Step 3: Verify no other references to TF.js or COCO-SSD remain**

  Run:
  ```bash
  grep -n "tensorflow\|coco-ssd\|cocoSsd\|tf\.ready\|tf\.setBackend" dashboard.html features/shot-tracking/shotDetection.js
  ```
  Expected after Task 2 is complete: no hits in `dashboard.html`. Hits in `shotDetection.js` are expected — they'll be removed in Task 2.

  **Note on execution order:** Module scripts (`type="module"`) and classic `defer` scripts share the same execution queue and run in document order after HTML parsing completes. Placing the shim tag before the shot-tracking `<script defer>` tags guarantees it executes first. Static `import {}` statements in a module are fully resolved before the module script element "completes," so `window.FilesetResolver` and `window.ObjectDetector` are assigned before the next deferred script (`shotDetection.js`) begins. The `_tryLoadModel` typeof guard safely handles the edge case where the CDN is unavailable.

- [ ] **Step 4: Verify MediaPipe CDN tag is in the right place**

  Run:
  ```bash
  grep -n "mediapipe\|tasks-vision" dashboard.html
  ```
  Expected: One `<script type="module">` block containing `vision_bundle.mjs`, no `defer` attribute, positioned before the `features/shot-tracking/*.js` script tags.

- [ ] **Step 5: Commit**

  ```bash
  cd /c/Users/tamir/Documents/GitHub/courtIQ
  git add dashboard.html
  git commit -m "feat: swap COCO-SSD/TF.js for MediaPipe Tasks Vision CDN"
  ```

---

### Task 2: Replace model loading in shotDetection.js

**Files:**
- Modify: `features/shot-tracking/shotDetection.js`

**Background:** `ShotDetectionEngine.init()` calls `_tryLoadModel()` which loads COCO-SSD with retry + exponential backoff. Replace the entire model loading path with MediaPipe `ObjectDetector`. Keep `_colorOnlyMode` fallback intact — if MediaPipe fails to load, color detection still works. Add `_detectorType` flag and `_frameCount` to the engine state object.

- [ ] **Step 1: Read the current init + model loading section**

  Read `features/shot-tracking/shotDetection.js` lines 327–403. Confirm you see `_tryLoadModel` calling `cocoSsd.load()` with retries and `_tryLiteModel` as final fallback.

- [ ] **Step 2: Add _frameCount and _detectorType to the engine state object**

  In `features/shot-tracking/shotDetection.js`, find the `var ShotDetectionEngine = {` block (around line 304). Add two new properties after `_colorOnlyMode: false,` and `_mlMissCount: 0,`:

  ```javascript
  _frameCount: 0,
  _detectorType: 'none',   // 'mediapipe' | 'none'
  _procW: 0,
  _procH: 0,
  ```

- [ ] **Step 3: Replace _tryLoadModel and _tryLiteModel with MediaPipe loader**

  Remove the entire `_tryLoadModel` function (lines ~349–383) and the entire `_tryLiteModel` function (lines ~385–403).

  Replace both with this single function:

  ```javascript
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

    self._setStatus('loading');

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
  ```

- [ ] **Step 4: Verify init() still calls _tryLoadModel correctly**

  Read `init()` function (lines ~327–347). Confirm:
  - It calls `self._tryLoadModel(resolve)` inside a `new Promise`
  - It resets `_mlFailed`, `_colorOnlyMode`, `_mlMissCount`
  - Add reset of `_frameCount` and `_detectorType` here too:

  In `init()`, after `self._mlMissCount = 0;`, add:
  ```javascript
  self._frameCount = 0;
  self._detectorType = 'none';
  ```

- [ ] **Step 5: Verify page loads without JS errors**

  In the terminal, check preview logs:
  ```bash
  # server should already be running on port 8080
  # Open http://127.0.0.1:8080/dashboard.html in browser
  # Check browser console — expect NO errors about tf, cocoSsd, or undefined
  ```
  Expected: page loads, no `cocoSsd is not defined` error.

- [ ] **Step 6: Commit**

  ```bash
  git add features/shot-tracking/shotDetection.js
  git commit -m "feat: replace COCO-SSD model loader with MediaPipe ObjectDetector"
  ```

---

## Chunk 2: Detection Logic — _findMLBall + _detectFrame

### Task 3: Update _findMLBall for MediaPipe result format

**Files:**
- Modify: `features/shot-tracking/shotDetection.js` (the `_findMLBall` function, lines ~541–572)

**Background:** COCO-SSD returns `[{class, score, bbox: [x,y,w,h]}]`. MediaPipe Tasks Vision returns `{detections: [{categories: [{categoryName, score}], boundingBox: {originX, originY, width, height}}]}`. The `_findMLBall` function needs to be rewritten for the new format. Logic stays the same — find the best sports-ball-like detection within size/aspect constraints.

- [ ] **Step 1: Read the current _findMLBall function**

  Read `features/shot-tracking/shotDetection.js` lines 541–572. Note the COCO-SSD format it expects: `predictions[i].class`, `predictions[i].score`, `predictions[i].bbox[0–3]`.

- [ ] **Step 2: Replace _findMLBall with MediaPipe-format version**

  Replace the entire `_findMLBall` function with:

  ```javascript
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
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add features/shot-tracking/shotDetection.js
  git commit -m "feat: update _findMLBall for MediaPipe Tasks Vision result format"
  ```

---

### Task 4: Rewrite _detectFrame — color-primary + MediaPipe every 5th frame

**Files:**
- Modify: `features/shot-tracking/shotDetection.js` (the `_detectFrame` function, lines ~468–539)

**Background:** Current `_detectFrame` calls `model.detect(videoEl)` asynchronously via Promise on every frame — this is the COCO-SSD Promise API. MediaPipe `detectForVideo` is **synchronous** (returns immediately). New logic: run color detection every frame (already works, keep as-is); run MediaPipe `detectForVideo` every 5th frame (synchronous, non-blocking); fuse results with ML taking priority over color. Because `detectForVideo` is sync, we can eliminate the async Promise chain and set `_isDetecting = false` before `_scheduleDetection()`.

- [ ] **Step 1: Read the current _detectFrame function**

  Read lines 468–539. Note the async `model.detect(self.videoEl).then(...)` structure and the color fallback inside it.

- [ ] **Step 2: Replace _detectFrame with color-primary + sync MediaPipe**

  **⚠️ DO NOT COMMIT OR TEST after Steps 2 or 3 alone. Steps 2, 3, and 4 form a single atomic block — apply ALL THREE before running the browser test (Step 6) or committing (Step 7).** Three interdependencies: (1) Step 2's `_detectFrame` uses `self._frameCount++`, but the `start()` reset (`self._frameCount = 0`) is added by Step 4 — without it, a second session never resets the counter and, if Chunk 1's state-object initializations are somehow missing, `_frameCount` is `undefined`, making `undefined % 5 === 0` always `false` so ML detection silently never runs. (2) Step 2's `_detectFrame` calls `detectBallByColor(..., vw, vh)` with video dimensions instead of canvas dimensions — Step 3 fixes this by introducing `pw/ph` and the `scaleX/scaleY` scaling. (3) Step 3's `_drawToCanvas` sets `_procW/_procH` which Step 2's `_detectFrame` reads via `self._procW || vw` — both must be applied together.

  Replace the entire `_detectFrame` function with:

  ```javascript
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

    /* ── Color detection (primary, every frame) ─────────────── */
    var colorBall = null;
    if (canvasReady) {
      colorBall = detectBallByColor(self._canvas, self._ctx, vw, vh);
    }

    /* ── MediaPipe detection (secondary, every 5th frame) ───── */
    var mlBall = null;
    self._frameCount++;
    if (self.model && !self._colorOnlyMode && canvasReady && self._frameCount % 5 === 0) {
      try {
        var result = self.model.detectForVideo(self._canvas, performance.now());
        mlBall = self._findMLBall(result, vw, vh);
      } catch (e) {
        /* MediaPipe error — silent, color takes over */
      }
    }

    /* ── Fusion: ML position wins when available ────────────── */
    if (mlBall) {
      self._mlMissCount = 0;
      self._processBallDetection(mlBall.x, mlBall.y, vw, vh);
    } else if (colorBall) {
      self._mlMissCount++;
      self._processBallDetection(colorBall.x, colorBall.y, vw, vh);
    } else {
      self._mlMissCount++;
      self._processNoBall();
    }

    self._isDetecting = false;
    self._scheduleDetection();
  },
  ```

- [ ] **Step 3: Verify _drawToCanvas properly downscales for performance**

  Read `_drawToCanvas` function (around line 458). It currently sets canvas dimensions to `videoEl.videoWidth × videoEl.videoHeight`. For mobile (1280×720 or higher), add downscaling so the processing canvas is max 480px wide:

  **⚠️ Both sub-edits in this step (`_drawToCanvas` replacement AND the `_detectFrame` pw/ph patches below) must be applied before any commit or browser test.** The intermediate state where `_drawToCanvas` sets `_procW/_procH` but `_detectFrame` still passes `vw, vh` to canvas-space functions is broken.

  Replace the existing `_drawToCanvas` function with:

  ```javascript
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

    /* Store processed dimensions on canvas for downstream use */
    this._procW = pw;
    this._procH = ph;
    return true;
  },
  ```

  Then update `_detectFrame` to use `self._procW` and `self._procH` instead of `vw` / `vh` when calling `detectBallByColor` and `_findMLBall`:

  In the `_detectFrame` function you wrote in Step 2, replace the two lines:
  ```javascript
    var vw = self.videoEl.videoWidth;
    var vh = self.videoEl.videoHeight;
  ```
  With:
  ```javascript
    /* Use original video dims for shot analysis normalization */
    var vw = self.videoEl.videoWidth;
    var vh = self.videoEl.videoHeight;
    /* Processing canvas dims (may be downscaled) */
    var pw = self._procW || vw;
    var ph = self._procH || vh;
  ```

  And update the three calls that use canvas dimensions:
  - `detectBallByColor(self._canvas, self._ctx, vw, vh)` → `detectBallByColor(self._canvas, self._ctx, pw, ph)`
  - `self._findMLBall(result, vw, vh)` → `self._findMLBall(result, pw, ph)`
  - `self._processBallDetection(mlBall.x, mlBall.y, vw, vh)` → keep `vw, vh` (shot positions must be in video coordinates)

  But ball positions from color/ML come from the processing canvas, so they need to be scaled back up:
  After `_findMLBall` and `detectBallByColor` calls, scale back before `_processBallDetection`:

  Replace the fusion section in `_detectFrame` with:
  ```javascript
    /* Scale ball positions from processing canvas back to video coords */
    var scaleX = pw > 0 ? vw / pw : 1;
    var scaleY = ph > 0 ? vh / ph : 1;

    /* ── Fusion: ML position wins when available ────────────── */
    if (mlBall) {
      self._mlMissCount = 0;
      self._processBallDetection(mlBall.x * scaleX, mlBall.y * scaleY, vw, vh);
    } else if (colorBall) {
      self._mlMissCount++;
      self._processBallDetection(colorBall.x * scaleX, colorBall.y * scaleY, vw, vh);
    } else {
      self._mlMissCount++;
      self._processNoBall();
    }
  ```

- [ ] **Step 4: Add _frameCount reset to start()**

  `_frameCount: 0` is initialized in the state object (Chunk 1 Task 2 Step 2) and reset in `init()` (Chunk 1 Task 2 Step 4). This step adds a matching reset to `start()` so the counter resets between sessions without requiring a full re-`init()`.

  `start()` in `shotDetection.js` (around line 413) resets `_mlMissCount` but not `_frameCount`. Without this, the frame counter carries over between sessions, meaning the first MediaPipe call of a new session may be delayed or skipped on the 5-frame cadence.

  In `start()`, after `self._mlMissCount = 0;`, add:
  ```javascript
  self._frameCount = 0;
  ```

- [ ] **Step 5: Fix AdaptiveLearning coordinate space mismatch in _processBallDetection**

  `_processBallDetection` (line ~582) calls:
  ```javascript
  window.AdaptiveLearning.onBallDetected(this._canvas, this._ctx, cx, cy);
  ```
  `this._canvas` is the **processing canvas** sized to `pw × ph`. After the downscale change, `cx, cy` are **video-space coordinates** (scaled up by `scaleX/scaleY` before `_processBallDetection` is called). Passing video coords to `onBallDetected` with a 480px-wide canvas means `AdaptiveColor.addSample` and `TransferLearner.addBallSample` will sample pixels at positions up to `vw` (e.g., 1280) on a 480px canvas — out of bounds, producing corrupted adaptive learning data.

  Fix: convert `cx, cy` back to canvas space before calling `onBallDetected`. In `_processBallDetection`, replace the AdaptiveLearning block:

  ```javascript
  /* Feed to adaptive learning (Level 1 + 3) */
  if (window.AdaptiveLearning && this._canvas && this._ctx) {
    window.AdaptiveLearning.onBallDetected(this._canvas, this._ctx, cx, cy);
  }
  ```

  With:

  ```javascript
  /* Feed to adaptive learning (Level 1 + 3) */
  /* cx/cy are in video coords — convert to processing canvas space for pixel sampling */
  if (window.AdaptiveLearning && this._canvas && this._ctx) {
    var cvW = (this._procW > 0) ? this._procW : vw;
    var cvH = (this._procH > 0) ? this._procH : vh;
    var canvasX = (vw > 0 && cvW > 0) ? cx * cvW / vw : cx;
    var canvasY = (vh > 0 && cvH > 0) ? cy * cvH / vh : cy;
    window.AdaptiveLearning.onBallDetected(this._canvas, this._ctx, canvasX, canvasY);
  }
  ```

  When `_procW === vw` (no downscale), `canvasX === cx` — no regression.

- [ ] **Step 6: Open the app in the preview browser and test**

  ```
  http://127.0.0.1:8080/dashboard.html
  ```

  Open browser DevTools → Console. Steps:
  1. Open AI Shot Tracker (click "📷 Live Camera")
  2. Watch console — expect to see `[ShotDetection] color-only mode` OR `ready` (if MediaPipe loads)
  3. DO NOT expect to see any `cocoSsd`, `tf.ready`, or `mobilenet` errors
  4. Tap/click the rim on screen — rim lock should work
  5. Move hand in front of camera — ball dot should track movement
  6. Expected console: no red errors related to ML or TF

- [ ] **Step 7: Commit**

  ```bash
  git add features/shot-tracking/shotDetection.js
  git commit -m "feat: color-primary detection + MediaPipe every 5th frame, downscale processing canvas"
  ```

---

### Task 5: Final verification + merge

**Files:**
- No code changes — verification only

**Background:** The refactor is complete. This task verifies the session save pipeline (localStorage + ShotTracker UI update) still works, then merges to master.

- [ ] **Step 1: Run a full mock session**

  1. Open `http://127.0.0.1:8080/dashboard.html`
  2. Click "📷 Live Camera"
  3. Tap the rim to lock it
  4. Confirm & Start tracking
  5. Wave an orange object in front of camera — expect ball dot to track it
  6. Click the "End Session" button
  7. Check that the Summary screen appears with Made/Missed counts
  8. Click "Save Session"

- [ ] **Step 2: Verify localStorage save**

  Open DevTools → Application → Local Storage → `http://127.0.0.1:8080`:
  - Key `courtiq-shot-sessions` should exist
  - Most recent entry should have `session_type: "ai_tracking"`, `fg_made`, `fg_missed` values

- [ ] **Step 3: Verify ShotTracker history list updated**

  Back on dashboard, scroll to the "AI Session History" section — the new session should appear in the list.

- [ ] **Step 4: Verify the 480px downscale path activated**

  In DevTools Console, run:
  ```javascript
  window.ShotDetectionEngine._procW
  ```
  If the camera resolution is ≥720p wide (most phones and webcams), expected: a value ≤ 480 (e.g., 480 for a 1280px source). If it returns `480`, the downscale triggered. If it returns the full video width (e.g., 1280), the video is narrower than 480px — acceptable, no downscale needed. If it returns `0` or `undefined`, `_drawToCanvas` never ran successfully — investigate.

- [ ] **Step 5: Check browser console for errors**

  ```
  DevTools → Console → filter: "error"
  ```
  Expected: zero red errors. Yellow warnings about MediaPipe wasm loading (normal) are OK.

- [ ] **Step 6: Merge to master + push**

  ```bash
  cd /c/Users/tamir/Documents/GitHub/courtIQ
  git checkout master
  git merge claude/fix-shot-tracker --no-edit
  git push origin master
  git checkout claude/fix-shot-tracker
  ```

  Expected:
  ```
  Merge made by the 'ort' strategy.
  ...
  To github.com:tamir7895-ops/courtIQ.git
     xxxxxxx..xxxxxxx  master -> master
  ```

- [ ] **Step 7: Confirm GitHub Pages deployment**

  Visit `https://tamir7895-ops.github.io/courtIQ/dashboard.html` after ~2 minutes. Check browser console — no COCO-SSD or TF.js errors.

---

## Summary of Changes

| File | What Changes |
|---|---|
| `dashboard.html` | Remove TF.js + COCO-SSD `<script>` tags; add MediaPipe CDN (no defer) |
| `features/shot-tracking/shotDetection.js` | Replace `_tryLoadModel`/`_tryLiteModel` (COCO-SSD) with MediaPipe `ObjectDetector`; update `_findMLBall` for MediaPipe result format; rewrite `_detectFrame` to color-primary + sync MediaPipe every 5th frame; add canvas downscaling in `_drawToCanvas` |

**Files NOT changed:** `ShotTrackingScreen.js`, `shotService.js`, `adaptiveLearning.js`, `index.js`, all CSS, all other JS. Zero integration changes needed.
