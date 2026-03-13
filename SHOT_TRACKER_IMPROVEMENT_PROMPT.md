# Shot Tracker Improvement Prompt for Claude Code

Copy everything below this line and paste into Claude Code:

---

## Task: Fix and improve the Shot Tracking feature

I have a basketball shot tracking feature that uses ML (COCO-SSD) + color detection + adaptive learning to detect and count made/missed shots from a phone camera. The feature mostly works but has critical issues I need fixed. Here's a detailed breakdown of what needs to change.

### Files involved:
- `features/shot-tracking/ShotTrackingScreen.js` — Main vanilla JS UI (1500+ lines, too big)
- `features/shot-tracking/shotDetection.js` — ML + color hybrid ball detection
- `features/shot-tracking/adaptiveLearning.js` — 3-level learning system (color, trajectory, transfer learning)
- `features/shot-tracking/tl-training-worker.js` — Web Worker for TL training
- `features/shot-tracking/shot-tracking.css` — Styling
- `features/shot-tracking/utils/rimDetection.js` — Rim zone geometry
- `features/shot-tracking/utils/trajectoryTracker.js` — Ball position tracker
- `features/shot-tracking/utils/heatmapGenerator.js` — Shot chart rendering
- `features/shot-tracking/utils/zoneHistory.js` — Zone history & alerts
- `features/shot-tracking/shotService.js` — Supabase save logic
- `features/shot-tracking/hooks/useShotDetection.js` — React Native hook
- `features/shot-tracking/hooks/useSessionManager.js` — Session lifecycle

Read ALL of these files before making any changes.

---

### CRITICAL FIXES (do these first):

#### 1. ML Fallback Chain is Broken
In `shotDetection.js`, if ML model loads successfully but returns 0 predictions for a frame, color detection never runs as fallback. Fix the `_detectFrame` method so that when ML returns 0 ball predictions, it falls back to color detection (same as the `!mlBall` path). The current code only falls back when `mlBall` is null from `_findMLBall`, but if predictions array is empty, `_findMLBall` returns null correctly — verify this works. The real issue is: when ML returns predictions but NONE match ball classes, the `else` branch (line ~509) calls `_processNoBall()` without trying color. Fix this to also try color detection before giving up.

#### 2. Shot Debounce is Too Aggressive
Current `DEBOUNCE_MS = 1500` blocks detection for 1.5 seconds after ANY shot. Players doing rapid shooting drills lose shots. Change approach:
- Reduce debounce to 800ms
- After a MADE shot, add a 500ms "cooldown" where the trajectory buffer resets but detection stays active
- After a MISS, keep 800ms debounce (misses often have bouncing ball that causes false positives)

#### 3. Rim Calibration Has No Validation
In `ShotTrackingScreen.js`, when user taps to place the rim, there's no validation. Add:
- Rim must be in the upper 60% of screen (not bottom — that's the floor)
- Rim size must be reasonable (10%–30% of screen width, reject 8% and 35% extremes)
- Show a warning if rim is placed at very edge of screen
- Add a "Re-calibrate" button visible during tracking phase (small, corner)

#### 4. Color-Only Detections Don't Feed Learning
In `shotDetection.js`, color-only detections pass `mlScore=0` to `_processBallDetection`, which means the confidence guard blocks them from feeding `AdaptiveLearning.onBallDetected`. This is correct for preventing garbage learning, BUT it means the color calibration system (Level 1) never improves when ML is unavailable. Fix: In `_processBallDetection`, allow Level 1 color calibration (but NOT Level 3 TL) even for color-only detections, but only after the color system already has >= 30 samples from ML-confirmed detections (so it has a baseline).

#### 5. No Timeout on ML Detection
`model.detect()` in `_detectFrame` can hang on slow devices. Wrap it in a Promise.race with a 500ms timeout. If ML times out, fall back to color detection for that frame and increment a counter. If ML times out 5 times in a row, switch to color-only mode temporarily (60 seconds) then retry ML.

---

### MODERATE FIXES:

#### 6. Trajectory Features Not Normalized
In `adaptiveLearning.js` TrajectoryLearner, features like `arcHeight` and `totalDist` are in raw pixels. This means the K-NN classifier breaks when switching between devices with different resolutions. Normalize all trajectory features by dividing by the frame diagonal length (sqrt(vw² + vh²)). Update `_extractFeatures`, `addShot`, and the distance calculation in `classify`.

#### 7. IndexedDB Quota Not Checked
In TransferLearner's `_addSample` and `_flushToDB`, add quota checking:
- Before adding samples, check if IndexedDB has space (navigator.storage.estimate if available)
- If quota > 80% used, delete oldest 50 samples before adding new ones
- If IndexedDB is completely unavailable, log a warning once and disable TL (don't keep trying)

#### 8. No Session Recovery on Crash
Add auto-save every 30 seconds during tracking:
- Save current `stats` object + `shots` array to localStorage
- Key: `courtiq_session_autosave`
- On next session start, check for autosave. If found and < 2 hours old, offer to resume
- Clear autosave on successful save to Supabase or on "Done"

#### 9. onBallUpdate Fires Every Frame
The `onBallUpdate` callback fires at camera FPS (30-60). Add throttling:
- Throttle UI updates to 10 FPS max
- Only update ball position overlay at 10 FPS
- Stats text update at 2 FPS max (every 500ms)
- Keep internal detection at full FPS

#### 10. Multiple Ball Handling
In the tracker, if two potential balls are detected in the same frame:
- Prefer the one closest to the last known position
- If both are > 100px from last known position, prefer the higher one (more likely in-flight)
- Never switch tracking target mid-trajectory (while `positions.length > 3`)

---

### ARCHITECTURE IMPROVEMENTS (if time allows):

#### 11. Break Down ShotTrackingScreen.js
Split into separate modules:
- `phases/RimLockPhase.js` — rim calibration UI logic
- `phases/ThreePtPhase.js` — 3PT calibration
- `phases/TrackingPhase.js` — live tracking overlay + controls
- `phases/SummaryPhase.js` — results display
- `ShotTrackingScreen.js` — orchestrator that manages phase transitions

Each phase module should export `{ mount(container, options), unmount() }` and handle its own DOM + events.

#### 12. Unified Storage Adapter
Create `utils/storage.js` that wraps localStorage/AsyncStorage:
```js
var Storage = {
  get: function(key) { /* try AsyncStorage, fallback localStorage */ },
  set: function(key, value) { /* same */ },
  remove: function(key) { /* same */ }
};
```
Replace all direct localStorage/AsyncStorage calls in zoneHistory.js, adaptiveLearning.js, etc.

#### 13. Add Error Boundaries
Wrap each major system in try-catch with degradation:
- If ML fails → color-only mode (already exists, but make it more robust)
- If AdaptiveLearning fails → disable learning, detection still works
- If IndexedDB fails → disable TL, color+trajectory still work
- If Supabase fails → save locally, offer retry later
- Show a small status indicator when running in degraded mode

---

### IMPORTANT CONSTRAINTS:
- Keep all code in vanilla JS (no React for web components, no TypeScript)
- Keep the IIFE/closure module pattern used throughout
- Don't add npm dependencies — this runs in a Capacitor webview
- Don't change the Supabase schema or API calls
- Keep the `window.ShotDetectionEngine` / `window.AdaptiveLearning` globals (they're used by other modules)
- Test by reading the code carefully — there are no unit tests to run
- Make changes incrementally — commit after each major fix

### PRIORITY ORDER:
1. Fix #1 (ML fallback) + #5 (ML timeout) — these cause silent detection failures
2. Fix #2 (debounce) + #4 (color learning) — these hurt accuracy over time
3. Fix #3 (rim validation) — prevents user error cascading
4. Fix #6 (normalize features) + #9 (throttle updates) — performance + accuracy
5. Fix #7 (IndexedDB) + #8 (session recovery) — reliability
6. Fix #10 (multi-ball) — edge case but annoying
7. Architecture #11-#13 — only if time allows
