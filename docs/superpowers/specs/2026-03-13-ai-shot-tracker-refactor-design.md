# AI Shot Tracker Refactor — Design Spec
**Date:** 2026-03-13
**Status:** Approved
**Author:** Claude (CourtIQ session)

---

## Problem Statement

The current `js/ai-shot-tracker.js` (1875 lines, single IIFE) has three critical failures on mobile:

1. **COCO-SSD crashes the app** — 30MB+ model load fails or exhausts memory on iPhone/Android mid-range devices
2. **Rim detection is unreliable** — auto-detect fails silently, leaving `rim = null` which breaks all shot logic downstream
3. **Shot counting doesn't work** — with rim=null and ball rarely detected, the made/missed counters stay at 0

Root cause: the entire pipeline depends on a ML model that can't run reliably on mobile. When the model fails, there's no graceful fallback path — everything silently breaks.

---

## Goals

- Shot counting works reliably on mobile (iPhone SE 2020+, mid-range Android)
- Rim calibration completes successfully in under 10 seconds
- Zero app crashes from model loading
- Keep all existing integrations intact (XPSystem, DataService, ShotTracker, ProgressCharts)
- Keep existing `courtiq-shot-sessions` localStorage format

---

## Non-Goals

- 3PT/FT detection (still logs as FG — unchanged)
- Court mapping or shot location
- Multi-player tracking

---

## Architecture

### File Split

Split the 1875-line monolith into 6 focused IIFEs. All files in `js/`, vanilla JS, no bundler.

```
js/ast-rim.js          → window.ASTRim
js/ast-ball.js         → window.ASTBall
js/ast-tracker.js      → window.ASTTracker
js/ast-classifier.js   → window.ASTClassifier
js/ast-session.js      → window.ASTSession
js/ai-shot-tracker.js  → window.AIShotTracker  (orchestrator + UI, keep existing)
```

**Load order in dashboard.html (before existing ai-shot-tracker.js script tag):**
```html
<script src="js/ast-rim.js"></script>
<script src="js/ast-ball.js"></script>
<script src="js/ast-tracker.js"></script>
<script src="js/ast-classifier.js"></script>
<script src="js/ast-session.js"></script>
```

MediaPipe CDN (add to dashboard.html `<head>`, after existing TF.js tags):
```html
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js"></script>
```
**Note:** Do NOT use `defer` — deferred scripts execute in unpredictable order relative to the ast-*.js modules. Load synchronously so MediaPipe globals are available when `ast-ball.js` parses. `ast-ball.js` must NOT reference any MediaPipe globals at top-level scope — only inside function bodies (lazy load on first `open()` call).

---

## Detection Pipeline

### Phase 1 — Rim Detection (`ast-rim.js`)

**Strategy: color blob detection, not ML.**

Rims are consistently orange-metal or white. Scan upper 70% of frame for blobs that match rim color HSV range AND have the right aspect ratio (wider than tall, ~2:1 to 4:1).

```
scanFrame(canvas) →
  1. Sample every 4th pixel in top 70% of frame (performance)
  2. Convert RGB → HSV
  3. Collect orange/white blobs via flood-fill approximation
  4. Filter: blob width 2%–35% of frame width, aspect ratio 1.5–5.0
  5. Score candidates by: horizontal span, color consistency, vertical position
  6. Return top candidate as { cx, cy, rx, ry } or null
```

**Consensus:** require same position (±8% drift) across 3 consecutive scans before accepting.
**Fallback:** if auto fails after 20 attempts → show manual tap UI (already exists).
**Persist:** save to `courtiq-rim-model` in localStorage (same key as current).

**Public API:**
```javascript
window.ASTRim = {
  startAutoDetect(canvas, onFound, onFail),
  setManual(cx, cy, canvas),
  getRim(),          // returns { cx, cy, rx, ry } or null
  reset()
}
```

---

### Phase 2 — Ball Detection (`ast-ball.js`)

**Strategy: color detection primary, MediaPipe secondary (every 5th frame).**

**Color detection (runs every frame):**
```
detectColor(canvas, roi) →
  1. Scan pixels inside ROI only
  2. HSV filter: orange range (H: 10–30, S: 100–255, V: 80–255)
  3. Find connected blobs
  4. Filter by size (1%–20% frame width) and circularity (aspect ≤ 2.5)
  5. Exclude blobs inside personBoxes (people exclusion — carried from v1)
  6. Return best candidate { x, y, size } or null
```

**MediaPipe (runs every 5th frame, non-blocking):**
```
detectML(canvas) →
  1. Run ObjectDetector with efficientdet_lite0 (3MB, Apache-2.0)
  2. Collect 'sports ball', 'orange', 'frisbee' predictions
  3. Filter by score > 0.2, inside ROI, correct size
  4. Return { x, y, size, score } or null
```

**Fusion logic:**
- If ML returns a result → use ML position
- If ML returns null → use color detection result
- If both null → return null (ball lost)

**Model loading:** lazy load MediaPipe on first `open()` call, not on page load. Show `🧠 Loading AI...` status. If model fails to load → silently continue with color-only mode.

**AdaptiveLearning integration** (must be preserved — called from `ast-ball.js` and `ast-classifier.js`):
```javascript
// ast-classifier.js — after shot scored:
if (window.AdaptiveLearning && AdaptiveLearning.onShotCompleted) {
  AdaptiveLearning.onShotCompleted({ result: 'made'|'missed', trajectory: history });
}
```

**AdaptiveLearning integration** (ast-ball.js):
```javascript
// After every ball detection result:
if (window.AdaptiveLearning && AdaptiveLearning.onBallDetected) {
  AdaptiveLearning.onBallDetected(result);
}
```

**Public API:**
```javascript
window.ASTBall = {
  init(canvas),
  detect() → Promise<{x,y,size}|null>,   // frame counter maintained internally
  setPersonBoxes(boxes),
  setROI(roi)
}
```

---

### Phase 3 — Kalman Tracker (`ast-tracker.js`)

Keep the existing Kalman filter implementation (it works well). Extract into standalone module.

**Additions:**
- Trajectory buffer of last 30 positions `[{x, y, t}]`
- `getVelocity()` — returns `{vx, vy}` over last 8 frames
- `isMovingUp()` — returns true if vy < -threshold for last 4 frames
- `isNearRim(rim)` — returns true if ball within rim ellipse × 1.5

**Public API:**
```javascript
window.ASTTracker = {
  reset(),
  update(ball) → {x, y},   // returns smoothed position
  getHistory(),             // [{x,y,t}, ...]
  getVelocity(),
  isMovingUp(),
  isNearRim(rim),
  isLost()                  // true if last update was >600ms ago (wall-clock, not frame count)
}
```

---

### Phase 4 — Shot Classifier (`ast-classifier.js`)

**Shot attempt detection:**
```
Ball moving upward (isMovingUp = true)
AND velocity magnitude > threshold (VEL_RISE_FRAC)
AND trajectory points toward rim (angle within ±60°)
→ mark shotPhase = 'rising'
```

**Made/missed detection:**
```
shotPhase = 'rising'
AND ball enters rim zone (isNearRim = true)     → shotPhase = 'at_rim'

shotPhase = 'at_rim'
AND ball exits below rim (y > rim.cy)
AND ball was inside rim horizontally (|x - rim.cx| < rim.rx)
→ MADE

shotPhase = 'at_rim'
AND ball exits to the side OR bounces back up
→ MISSED
```

**Backboard fix (current bug):** when ball hits backboard it bounces back *up* briefly before falling. Current code registers this as a new shot attempt. Fix: ignore upward motion if ball.x is more than `rim.rx * 3` from rim center AND previous shotPhase was 'at_rim' within last 8 frames. Add `cooldownUntil` after every scored attempt (2 seconds).

**Public API:**
```javascript
window.ASTClassifier = {
  reset(),
  update(smoothedBall, rim) → { event: 'made'|'missed'|null },
  getPhase()
}
```

---

### Phase 5 — Session (`ast-session.js`)

Manages session state and all integrations. Extracted from current `saveSession()`.

**State:**
```javascript
{ attempts, made, streak, maxStreak, startTime, shots: [{t, result}] }
```

**On session end — integrations (use existing guard pattern from ai-shot-tracker.js):**
```javascript
// 1. localStorage (same format, same key)
try {
  var existing = JSON.parse(localStorage.getItem('courtiq-shot-sessions') || '[]');
  existing.unshift(s);
  if (existing.length > 50) existing = existing.slice(0, 50);
  localStorage.setItem('courtiq-shot-sessions', JSON.stringify(existing));
  if (window.ShotTracker && window.ShotTracker.renderHistory) {
    window.ShotTracker.renderHistory(existing);  // 2. update manual tracker UI
  }
} catch (e) { /* silent */ }

// 3. Supabase (non-blocking — guard required, unauthenticated users must be skipped)
if (window.currentUser && typeof DataService !== 'undefined') {
  DataService.addShotSession(s).catch(function(){});
}

// 4. XP
if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
  XPSystem.grantXP(xp, 'AI Shot Tracking Session');
}

// 5. Toast — showToast is IIFE-scoped in nav.js, must use typeof guard
if (typeof showToast === 'function') {
  showToast('🏀 AI session saved! +' + xp + ' XP');
}

// 6. Charts
if (typeof ProgressCharts !== 'undefined' && ProgressCharts.refresh) {
  ProgressCharts.refresh();
}
```

**XP formula:** use the full formula from existing `calcXP()` in `ai-shot-tracker.js`:
`25 base + (made × 2) + streak bonuses + accuracy bonus + volume bonus`.
Do NOT simplify — the existing formula must be copied verbatim into `ast-session.js`.

**Public API:**
```javascript
window.ASTSession = {
  start(),
  recordMade(),
  recordMissed(),
  end() → sessionObject,
  getStats()   // { attempts, made, streak }
}
```

---

## Performance

| Concern | Fix |
|---|---|
| Frame rate | Hard cap at 15 FPS using `Date.now()` throttle, not rAF at 60 FPS |
| Canvas resolution | Downscale to max 480×854 for processing canvas (separate from display) |
| MediaPipe | Every 5th frame only, async (non-blocking) |
| Color scan | Sample every 4th pixel (16× fewer operations) |
| ROI | Only scan region around rim, not full frame |
| Model loading | Lazy (on first open), not on page load |

---

## Error Handling

| Failure | Behavior |
|---|---|
| Camera permission denied | Show error message, don't crash |
| MediaPipe load fails | Silent fallback to color-only mode |
| Rim not found after 20 tries | Show manual tap UI |
| Ball lost >10 frames | Reset tracker, restart detection |
| localStorage full | Silent catch, session still counted in UI |

---

## Data Format (unchanged)

```javascript
{
  id: Date.now(),
  date: new Date().toISOString(),
  fg_made: N,
  fg_missed: N,
  three_made: 0,
  three_missed: 0,
  ft_made: 0,
  ft_missed: 0,
  session_type: 'ai_tracking',
  accuracy: pct,
  max_streak: N
}
```

---

## Implementation Order

1. `ast-rim.js` — fix the root problem first (rim detection)
2. `ast-tracker.js` — extract Kalman (low risk, already works)
3. `ast-ball.js` — replace COCO-SSD with color+MediaPipe
4. `ast-classifier.js` — extract + fix backboard bug
5. `ast-session.js` — extract integrations
6. `ai-shot-tracker.js` — thin down to orchestrator
7. Test on mobile, verify session saves correctly
