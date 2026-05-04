# CourtIQ — Port Claude Design v2 to Production App

> **Goal**: Replace the current UI with the new Claude Design v2 screens while keeping ALL existing functionality intact (YOLOX shot detection, Supabase auth/DB, gamification, drill engine, social hub, avatar system, etc.)

---

## STEP 0 — Pull Design Files from Claude Design (via Claude in Chrome)

Before starting any code changes, you need to extract the source files from the Claude Design project.

**Project URL**: https://claude.ai/design/p/019dddc0-0907-782e-9340-58fc66de2d25

**Instructions — use Claude in Chrome browser tools to do this automatically:**

1. Navigate to the Claude Design project URL above
2. Open the project's file/code panel (look for a "Code" or "Files" tab/button in the editor UI)
3. For EACH file listed below, read its full content and save it to `_design-import/v2/` in the project directory
4. Create the directory structure as shown below

**Target location**: `_design-import/v2/` (create this directory in the project root)

```
_design-import/v2/
├── html/
│   ├── home-tab.html
│   ├── coach-tab.html
│   ├── me-tab.html
│   ├── track-lab.html
│   ├── drill-library.html
│   ├── camera-hud.html
│   ├── post-session.html
│   ├── onboarding.html
│   └── foundations.html
├── css/
│   ├── home-tab.css
│   ├── coach-tab.css
│   ├── ciq-court.css
│   ├── track-lab.css
│   ├── drill-library.css
│   ├── drill-library-v2.css
│   ├── camera-hud.css
│   ├── post-session.css
│   └── foundations.css
└── components/
    └── (all *.jsx files from the design project)
```

**How to extract via Chrome:**
- Navigate to the project URL
- The Claude Design editor shows a file tree on the left side — click each file to open it
- Use `get_page_text` or the code panel to read the full source of each file
- Save each file's content to the corresponding path in `_design-import/v2/`
- Make sure you get ALL files — HTML pages, CSS stylesheets, AND JSX components
- If the editor has a "download" or "export" option, use that instead

**Important**: Do NOT proceed to Step 1 until ALL design files are saved locally. The rest of the porting work depends entirely on having these files available to read.

---

## STEP 1 — Understand the Architecture (DO NOT SKIP)

### Source of truth
- Root files (`js/`, `styles/`, `features/`, `dashboard.html`) are the source
- `build.js` copies root → `www/` for Capacitor & GitHub Pages
- After ALL changes, run `node build.js` to sync

### Entry point
- `dashboard.html` is the single-page app (SPA)
- It has a sidebar nav, main content area with tab panels
- The v2 UI shell is in `features/ui-v2/shell.js`

### Feature flag system (`features/ui-v2/config.js`)
- `window.COURTIQ_UI_V2` — frozen object with boolean flags
- Emergency rollback: `?ui=v1` (all off), `?ui=v2` (all on), `?ui=core` (Phase 8 off)
- **KEEP THIS SYSTEM INTACT** — the new design replaces the v2 renderers, not the flag mechanism

### Current v2 tab renderers (these get REPLACED):
```
features/ui-v2/shell.js          → v2 shell (nav, layout)
features/ui-v2/tabs/home.js      → Home tab renderer
features/ui-v2/tabs/track.js     → Track tab renderer
features/ui-v2/tabs/train.js     → Train tab renderer
features/ui-v2/tabs/coach.js     → Coach tab renderer
features/ui-v2/tabs/me.js        → Me tab renderer
features/ui-v2/tabs/home-calendar.js
features/ui-v2/tabs/me-settings.js
features/ui-v2/tabs/me-social.js
features/ui-v2/tabs/me-trophies.js
features/ui-v2/tabs/track-heatmap.js
features/ui-v2/tabs/track-sessions.js
features/ui-v2/tabs/track-zones.js
features/ui-v2/tabs/train-drill-generator.js
features/ui-v2/tabs/train-player.js
```

### Current v2 stylesheets (these get REPLACED):
```
styles/courtiq-ui/tokens.css           → Design tokens (UPDATE with new values)
styles/courtiq-ui/components.css       → Shared components
styles/courtiq-ui/hierarchy.css        → Typography hierarchy
styles/courtiq-ui/icons.css            → Icon system
styles/courtiq-ui/templates.css        → Templates
styles/courtiq-ui/tabs/home.css
styles/courtiq-ui/tabs/track.css
styles/courtiq-ui/tabs/train.css
styles/courtiq-ui/tabs/coach.css
styles/courtiq-ui/tabs/me.css
styles/courtiq-ui/tabs/me-settings.css
styles/courtiq-ui/tabs/me-social.css
styles/courtiq-ui/tabs/track-heatmap.css
styles/courtiq-ui/tabs/track-zones.css
styles/courtiq-ui/tabs/track-sessions.css
styles/courtiq-ui/tabs/train-drill-generator.css
styles/courtiq-ui/tabs/train-player.css
styles/courtiq-ui/tabs/home-calendar.css
```

---

## STEP 2 — SEALED CODE (DO NOT MODIFY INTERNALS)

These files contain critical business logic. You may CALL their public APIs but NEVER edit their internal implementation:

| File | Purpose | Public API to use |
|------|---------|-------------------|
| `features/shot-tracking/shotDetection.js` | YOLOX inference (640x640, 2 classes) | `ShotDetector` class |
| `features/shot-tracking/yoloxWorker.js` | Web Worker for ONNX Runtime | spawned by shotDetection |
| `features/shot-tracking/shotService.js` | Shot persistence to Supabase | `ShotService` |
| `js/ai-coach.js` | Claude proxy via Supabase Edge Function | `AICoach` |
| `js/drill-engine.js` | Drill generation & execution (4257 lines) | `DrillEngine` |
| `js/social-hub.js` | Supabase Realtime for social features | `SocialHub` |
| `js/data-service.js` | IndexedDB + Supabase sync | `DataService` |
| `js/supabase-client.js` | Supabase client initialization | `window.supabase` |
| `js/avatar-customizer.js` | DiceBear Avataaars v9 API | `AvatarCustomizer` |
| `js/gamification.js` | XP, levels, streaks, badges | `Gamification` |
| `sw.js` | Service worker | automatic |
| `models/basketball_yolox_tiny_v6.onnx` | YOLOX model file (20MB) | loaded by yoloxWorker |

**Integration requirement**: The new UI must wire up to these services exactly as the current v2 renderers do. Look at how each current tab renderer calls these APIs and replicate those hooks in the new code.

---

## STEP 3 — Convert & Port Each Screen

For EACH Claude Design screen, do the following:

### 3.1 Convert JSX → Vanilla JS

The Claude Design components are in JSX/React. Convert them to vanilla JS render functions that return HTML strings or use DOM manipulation, matching the existing pattern in `features/ui-v2/tabs/*.js`.

**Pattern to follow** (look at any existing tab renderer):
```javascript
// features/ui-v2/tabs/[tab].js
(function() {
  'use strict';
  
  function render(container) {
    container.innerHTML = `
      <!-- converted HTML from Claude Design -->
    `;
    
    // Wire up event listeners
    // Connect to sealed services (DataService, ShotService, etc.)
    // Initialize animations
  }
  
  function cleanup() {
    // Remove listeners, cancel intervals
  }
  
  window.CourtIQ_V2_[TabName] = { render, cleanup };
})();
```

### 3.2 Port CSS

Take the CSS from Claude Design and merge it into the corresponding `styles/courtiq-ui/tabs/*.css` file. Key rules:
- Use existing CSS custom properties from `tokens.css` wherever possible
- If the design introduces NEW tokens, add them to `tokens.css`
- Prefix all new classes with `ciq-` to avoid collisions with legacy styles
- The design uses glassmorphism (`backdrop-filter: blur(20px)`, `rgba(22,25,33,0.7)` backgrounds, `rgba(255,255,255,0.08)` borders)

### 3.3 Wire Services

For each screen, connect to the appropriate sealed services:

| Screen | Services to wire |
|--------|-----------------|
| **Home** | `DataService` (recent sessions, stats), `Gamification` (XP, streak), `AICoach` (daily tip) |
| **Track** | `ShotService` (shot history), `DataService` (sessions), heatmap/zone utils |
| **Train** | `DrillEngine` (drill library, generation), workout player |
| **Coach** | `AICoach` (chat), `DrillEngine` (recommendations) |
| **Me** | `DataService` (profile), `Gamification` (trophies, level), `AvatarCustomizer`, `SocialHub` |
| **Camera HUD** | `ShotDetector` (YOLOX model init + inference), `ShotService` (save results) |
| **Post-Session** | `ShotService` (session data), `DataService` (save), `Gamification` (award XP) |
| **Onboarding** | `DataService` (save profile), `window.supabase` (auth) |

---

## STEP 4 — Navigation & Shell

### 4.1 Bottom Nav Bar (MOBILE)
The new design uses a **5-tab bottom navigation bar** (not the sidebar):
- Home (amber #f5a623)
- Train (blue #4ca3ff)  
- Track (green #56d364)
- Coach (purple #bc8cff)
- Me (teal #2dd4bf)

Replace the sidebar-based navigation with:
- **Mobile**: fixed bottom tab bar with icons + labels, active tab has colored icon + indicator dot/line
- **Desktop**: keep sidebar OR convert to same bottom bar (match the Claude Design output)

### 4.2 Update `dashboard.html`
- Remove or hide the old sidebar markup (keep it commented for rollback)
- Add the new bottom nav bar markup
- Update the main content area structure to match Claude Design layout
- Keep all `<script>` tags at the bottom intact
- Keep the `<head>` CSS links but update them to point to new/renamed files if needed

### 4.3 Update `features/ui-v2/shell.js`
This orchestrates which tab renderer to call. Update it to:
- Use the new nav bar for tab switching
- Call the updated tab renderers
- Handle transitions/animations between tabs

---

## STEP 5 — Design Token Updates

Update `styles/courtiq-ui/tokens.css` with any new tokens from the Claude Design `foundations.css`. The existing token structure:

```css
:root {
  /* Core palette */
  --c-bg: #0e1014;
  --c-surface: #161921;
  --c-surface-2: #1e2230;
  
  /* Tab accents */
  --c-home: #f5a623;
  --c-train: #4ca3ff;
  --c-track: #56d364;
  --c-coach: #bc8cff;
  --c-me: #2dd4bf;
  
  /* Glass */
  --glass-bg: rgba(22,25,33,0.7);
  --glass-border: rgba(255,255,255,0.08);
  --glass-blur: 20px;
  
  /* Typography */
  --font-display: 'Barlow Condensed', sans-serif;
  --font-body: 'Lexend', sans-serif;
}
```

Merge in any new values from the design. DO NOT remove existing tokens that other parts of the app might reference.

---

## STEP 6 — Camera HUD & YOLOX Integration

The Camera HUD screen is critical. It must:

1. **Initialize YOLOX model** on screen open:
   ```javascript
   // Use existing ShotDetector from features/shot-tracking/shotDetection.js
   const detector = new ShotDetector();
   await detector.initialize(); // loads models/basketball_yolox_tiny_v6.onnx
   ```

2. **Stream camera** → canvas → inference loop:
   ```javascript
   // getUserMedia → video element → canvas draw → detector.detect(canvas)
   ```

3. **Display real-time overlays** from the Claude Design camera-hud.html:
   - Shot counter (makes/attempts)
   - Live accuracy percentage
   - Session timer
   - Detection confidence indicator
   
4. **Use the new design's visual language** for the HUD elements (glass cards, accent colors, animations)

5. **Post-session flow**: When user stops recording → transition to post-session summary screen with:
   - Shot chart / heatmap
   - Make/miss breakdown
   - XP earned
   - Save to history

---

## STEP 7 — Onboarding Flow

Port the onboarding from Claude Design. It collects:
- Name, age, height, weight (with American units + metric conversion)
- Position (letter abbreviations: PG/SG/SF/PF/C)
- Experience level
- Goals
- Quiz questions for player archetype
- Scouting report generation

Wire to: `js/onboarding.js` (existing logic) + `DataService` + `window.supabase`

---

## STEP 8 — Animations & Polish

The Claude Design uses these animation patterns — implement them:
- **Page transitions**: fade + slide between tabs (150-200ms)
- **Card entry**: staggered fade-up on scroll (intersection observer)
- **Stat counters**: number count-up animation on first view
- **Glass hover**: subtle border brightness increase on hover
- **Active states**: scale(0.97) on tap for interactive elements
- **Loading skeletons**: pulse animation while data loads

Use CSS animations and `IntersectionObserver` — no animation libraries needed.

---

## STEP 9 — Build & Verify

After all changes:

1. **Run build**: `node build.js`
2. **Verify www/ output** has all updated files
3. **Test feature flags**:
   - `?ui=v2` → new design (default)
   - `?ui=v1` → legacy UI still works (sidebar, old renderers)
   - `?ui=core` → Phase 1-6 only
4. **Verify YOLOX loads**: Check that `models/basketball_yolox_tiny_v6.onnx` is accessible and the camera HUD initializes the detector
5. **Verify Supabase**: Auth flow, data persistence, AI coach proxy all work
6. **Verify no console errors** on each tab

---

## STEP 10 — File Checklist

Files that MUST be created/updated:

### Updated (replace content):
- [ ] `features/ui-v2/shell.js` — new shell with bottom nav
- [ ] `features/ui-v2/tabs/home.js` — from home-tab.html/jsx
- [ ] `features/ui-v2/tabs/track.js` — from track-lab.html/jsx
- [ ] `features/ui-v2/tabs/train.js` — from drill-library.html/jsx
- [ ] `features/ui-v2/tabs/coach.js` — from coach-tab.html/jsx
- [ ] `features/ui-v2/tabs/me.js` — from me-tab.html/jsx
- [ ] `features/ui-v2/tabs/home-calendar.js`
- [ ] `features/ui-v2/tabs/me-settings.js`
- [ ] `features/ui-v2/tabs/me-social.js`
- [ ] `features/ui-v2/tabs/me-trophies.js`
- [ ] `features/ui-v2/tabs/track-heatmap.js`
- [ ] `features/ui-v2/tabs/track-sessions.js`
- [ ] `features/ui-v2/tabs/track-zones.js`
- [ ] `features/ui-v2/tabs/train-drill-generator.js`
- [ ] `features/ui-v2/tabs/train-player.js`
- [ ] `styles/courtiq-ui/tokens.css`
- [ ] `styles/courtiq-ui/components.css`
- [ ] `styles/courtiq-ui/tabs/*.css` (all tab stylesheets)
- [ ] `dashboard.html` (nav structure, remove sidebar, add bottom nav)

### New files (create):
- [ ] `features/ui-v2/tabs/camera-hud.js` — from camera-hud.html/jsx
- [ ] `features/ui-v2/tabs/post-session.js` — from post-session.html/jsx
- [ ] `features/ui-v2/tabs/onboarding-v2.js` — from onboarding.html/jsx
- [ ] `styles/courtiq-ui/tabs/camera-hud.css`
- [ ] `styles/courtiq-ui/tabs/post-session.css`
- [ ] `styles/courtiq-ui/tabs/onboarding-v2.css`

### DO NOT touch:
- `features/shot-tracking/shotDetection.js`
- `features/shot-tracking/yoloxWorker.js`
- `features/shot-tracking/shotService.js`
- `js/ai-coach.js`
- `js/drill-engine.js`
- `js/social-hub.js`
- `js/data-service.js`
- `js/supabase-client.js`
- `js/avatar-customizer.js`
- `js/gamification.js`
- `sw.js`
- `models/*`
- `supabase/*`
- `features/ui-v2/config.js` (feature flags — keep as-is)

---

## IMPORTANT CONSTRAINTS

1. **Vanilla JS only** — no React, no build tools, no npm bundler. The app loads scripts via `<script>` tags.
2. **Self-hosted fonts** — Barlow Condensed + Lexend are loaded via Google Fonts in `<head>` AND have `@font-face` fallbacks in tokens.css for offline/Capacitor use.
3. **DiceBear avatars** — use `https://api.dicebear.com/9.x/avataaars/svg?seed=...` for avatar images. The `AvatarCustomizer` class handles this.
4. **No localStorage for state** — use `DataService` (IndexedDB + Supabase sync) for persistent data.
5. **CSP compliance** — respect the Content-Security-Policy in dashboard.html `<head>`. No inline event handlers in HTML (use `addEventListener`). Scripts must be from `'self'`, `cdnjs.cloudflare.com`, or `cdn.jsdelivr.net`.
6. **Mobile-first** — the app is primarily used on phones via Capacitor. Design for 375px width, scale up.
7. **Offline support** — the service worker caches assets. Ensure new files are in the `sw.js` cache list if you update it (or leave sw.js alone and let it cache dynamically).

---

## EXECUTION ORDER

1. Read all files in `_design-import/v2/` to understand the new designs
2. Update `styles/courtiq-ui/tokens.css` with new/updated tokens
3. Port each screen's CSS into `styles/courtiq-ui/tabs/*.css`
4. Update `styles/courtiq-ui/components.css` with shared new components
5. Rewrite `features/ui-v2/shell.js` with new nav structure
6. Port each tab renderer (home → track → train → coach → me)
7. Create new screens (camera-hud, post-session, onboarding-v2)
8. Update `dashboard.html` (nav markup, script tags for new files, CSS links)
9. Wire all service integrations (test each tab's data flow)
10. Run `node build.js`
11. Verify no errors, all tabs render, camera HUD initializes YOLOX

---

## CONTEXT FOR REFERENCE

- Claude Design project: `claude.ai/design/p/019dddc0-0907-782e-9340-58fc66de2d25`
- Design brief: `docs/superpowers/plans/2026-04-30-claude-design-brief-v2.md`
- Existing v1 import (older design): `_design-import/mobile-app/` and `_design-import/shot-tracker-v2/`
- The drill library has a pending "Wave 2.5" fix in `docs/superpowers/plans/wave2-drill-fix-prompt.md` — apply those changes to the drill library screen if possible, otherwise mark as TODO

**End result**: A fully working CourtIQ app with the new Claude Design v2 visual identity, all features operational, ready to deploy via `node build.js` + git push.
