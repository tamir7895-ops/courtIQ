# CourtIQ Redesign — Apply Claude Design "CourtIQ Design System" (5-tab mobile app)

## Context

The user created a complete design system for CourtIQ inside claude.ai/design:
**Project:** `CourtIQ Design System` (id `4d34587a-38f6-4bce-9397-e5721f65d010`)
**Primary artifact:** `ui_kits/mobile-app/mobile-app.html` — a 5-tab mobile app shell with full tokens, components, and screens.

The current app lives in `C:\Users\tamir\Documents\GitHub\courtIQ`. It's a vanilla HTML/CSS/JS PWA with:
- **13 panels** (`db-panel-*`) on one page (`www/dashboard.html`), flipped by `.active` class
- **5 competing design systems** coexist in CSS: `main.css` tokens, `kinetic-elite.css` (61 KB), `kinetic-stitch.css` (78 KB), `glassmorphism.css` (57 KB), and the scoped `shot-tracker-v2` port (`stv2-*`). Combined ~196 KB of unreferenced/partial styles.
- **Major root-vs-www drift**: production serves from `www/`; root is authoring-canonical for some files, www-primary for others. `dashboard.html` only exists in `www/`. Must be resolved before large visual work.
- **Shot Tracker** is the feature the user wants to showcase. It uses YOLOX-tiny v6 (`models/basketball_yolox_tiny_v6.onnx` + `.onnx.data`, 20 MB) via a Web Worker (`features/shot-tracking/yoloxWorker.js`). The detection engine contract is sealed — UI changes must not touch `ShotDetectionEngine` callbacks.

**The goal:** fold the 13 panels into the 5-tab architecture from the design system (`Home / Train / Track / Coach / Me`) without losing a single feature, and replace the fragmented CSS with one `ciq-*` design system. Rollout must be reversible per tab.

## Source of truth — files extracted from Claude Design

| File in Claude Design | Purpose | Size |
|---|---|---|
| `colors_and_type.css` | 96 CSS custom properties + `@font-face` | 9.1 KB |
| `ui_kits/mobile-app/ui-kit.css` | 12 `.ciq-*` component classes | 5.0 KB |
| `ui_kits/mobile-app/ios-frame.jsx` | iOS frame chrome (reference only) | 14.3 KB |
| `ui_kits/mobile-app/Icons.jsx` | SVG icon set | 3.2 KB |
| `ui_kits/mobile-app/Chrome.jsx` | topbar + bottom-nav component | 3.3 KB |
| `ui_kits/mobile-app/Screens.jsx` | HomeScreen, TrainScreen, TrackScreen, CoachScreen, MeScreen (+ ShotTrackerCam) | 25.7 KB |

**Important tokens** (from `colors_and_type.css`, all at `:root`):
- 5 nav accents: `--c-home #f5a623`, `--c-train #4ca3ff`, `--c-track #56d364`, `--c-coach #bc8cff`, `--c-me #2dd4bf` (+ `-dim` per)
- Glass: `--glass-bg rgba(22,25,33,0.7)`, `--glass-border rgba(255,255,255,0.08)`, `--glass-blur 20px`
- Radii: `--r-sm 10 / --r-md 16 / --r-lg 24 / --r-xl 32`
- Shadows: 10 named scales incl. `--shadow-card`, `--shadow-amber`, `--shadow-btn`
- Fonts: self-hosted `Barlow Condensed` 400–900 + `Lexend` variable. `brand-fonts/` in the repo already has these six files.

**Component classes in `ui-kit.css`:** `.ciq-screen .ciq-eyebrow .ciq-title .ciq-glass .ciq-topbar .ciq-icon-btn .ciq-bottom-nav .ciq-nav-item .ciq-primary-btn .ciq-secondary-btn .ciq-stat-tile .ciq-row`.

## Panel → Tab mapping (every current feature lands somewhere)

| New tab | Color | Existing panels folded in | JS modules that must keep working |
|---|---|---|---|
| **Home** | amber | `db-panel-home`, `db-panel-log`, `db-panel-history`, `db-panel-notifications`, `db-panel-calendar` | `dashboard.js`, `notifications.js`, `streak.js`, `daily-challenge.js`, `ai-coach.js` (log feedback path) |
| **Train** | blue | `db-panel-training`, `db-panel-moves` | `drill-engine.js`, `drill-animations.js`, `daily-workout.js`, `move-library.js`, `move-animations.js`, `workout-timer.js`, `night-training.js`, `training-panel.js`, `lab-panel.js` |
| **Track** | green | `db-panel-shots`, `db-panel-summary` | `features/shot-tracking/ShotTrackingScreen.js`, `shotDetection.js` (**sealed**), `yoloxWorker.js`, `shotService.js`, `adaptiveLearning.js`, `shot-analysis.js`, `progress-charts.js` |
| **Coach** | purple | `db-panel-coach` | `ai-coach.js` |
| **Me** | teal | `db-panel-archetype`, `db-panel-social`, `db-panel-shop`, player profile, avatar | `player-profile.js`, `player-analysis.js`, `avatar-customizer.js`, `avatar-builder.js`, `avatar-3d.js`, `social-hub.js`, `badges.js`, `gamification.js`, `pricing.js` |

No feature is dropped. Inside each tab, secondary sections (e.g., History under Home) become sub-views selectable from a sub-nav or segmented control. The exact sub-nav pattern is defined by `Screens.jsx` per tab and must be ported literally first, then wired to the existing panels' JS.

## Strategy — phased, flag-gated, reversible

Follow the proven pattern from `features/shot-tracking/v2/`: scoped CSS under a container class, feature flag per unit, zero JS contract changes until the UI shell is stable. Production keeps rendering v1 until each flag flips.

**Flag object** (new file `features/ui-v2/config.js`):
```js
window.COURTIQ_UI_V2 = {
  SHELL_ACTIVE: false,        // global nav + token layer
  HOME_TAB: false,
  TRACK_TAB: false,
  TRAIN_TAB: false,
  COACH_TAB: false,
  ME_TAB: false,
};
```
Scope class on `<body>`: `ciq-active` (gates global tokens and nav). Per-tab scope classes: `ciq-tab-home`, `ciq-tab-train`, `ciq-tab-track`, `ciq-tab-coach`, `ciq-tab-me`.

Rollout order (user-confirmed): **Home → Track → Train → Coach → Me**.
Old CSS (`kinetic-elite.css`, `kinetic-stitch.css`, `glassmorphism.css`, panel-specific legacy CSS) is **deleted tab-by-tab** as each migration completes, not up-front.

## Phases

### Phase 0 — Foundation & drift resolution (blocker)

Until the root/www split is settled, every visual change doubles in cost. This phase lands before any UI work.

**Tasks:**
1. Confirm production source of truth: read `PRODUCTION_STATE_REPORT.md`, `WWW_DRIFT_REPORT.md`, `BUILD_PIPELINE_REPORT.md`. The reports already flag www/ as the canonical prod tree. Decision to record in `docs/REDESIGN_DECISIONS.md`: **www/ is the single source of truth for HTML/CSS/JS that reaches gh-pages**. Root stays only where CI needs it (the three files copied by `build.js`), and we stop editing root for UI work.
2. Copy the six Claude Design files into the repo at `_design-import/mobile-app/` (preserves history), then author the production copies listed in Phase 1.
3. Add `docs/REDESIGN_DECISIONS.md` with: DS source, prefix (`ciq-`), scope classes, feature flags, rollback per tab, no-JS-contract-change rule for Shot Tracker.

**Critical files to read first:**
- `www/dashboard.html` — see every `<script>` order and every `db-panel-*` markup
- `www/js/dashboard.js` — panel switching logic (`showPanel` / tab activation)
- `www/js/nav.js` — current bottom-nav wiring
- `features/shot-tracking/v2/MIGRATION.md`, `TOKEN_DIFF.md` — reuse their patterns
- `styles/main.css` `:root` — to compute the diff against Claude Design tokens (expect 4 overlaps already captured in `features/shot-tracking/v2/TOKEN_DIFF.md`)

### Phase 1 — DS foundation + new shell (no tab content yet)

**Create:**
- `www/styles/courtiq-ui/tokens.css` — the 96 tokens from Claude Design `colors_and_type.css`, verbatim, under `:root`. Self-hosted `@font-face` pointing to `www/brand-fonts/`.
- `www/styles/courtiq-ui/components.css` — the 12 `.ciq-*` classes from `ui-kit.css`, gated with `body.ciq-active` prefix so they don't activate until the flag flips.
- `www/features/ui-v2/config.js` — the flag object above.
- `www/features/ui-v2/shell.js` — a thin module that, when `SHELL_ACTIVE` is true, (a) adds `body.ciq-active`, (b) renders `.ciq-topbar` + `.ciq-bottom-nav` markup into an existing container in `dashboard.html`, (c) intercepts tab clicks and maps them onto the existing `showPanel()` calls. No panel JS changes.

**Modify:**
- `www/dashboard.html` — link the two new CSS files at the very end of the CSS block (so they win the cascade when active) and load `features/ui-v2/config.js` before `features/ui-v2/shell.js`. Add one empty `<div id="ciq-chrome-mount"></div>` for the new nav.

**Verification:**
- With all flags off → site identical to current production (screenshot diff under 1%).
- Flip `SHELL_ACTIVE=true` locally → new bottom-nav appears, clicks route to `home/training/shots/coach/archetype` panels. Old bottom-nav hidden via `body.ciq-active` CSS rule.
- preview_start → preview_screenshot before/after → preview_console_logs shows no errors.

### Phase 2 — **Home** tab (lowest risk first)

Port `HomeScreen` from `Screens.jsx` to vanilla HTML, keep amber accent (`--c-home`). Sub-nav inside Home: *Today / Log / History / Calendar / Notifications* (segmented control or scrollable chips — follow whatever `Screens.jsx` uses).

**Create:** `www/features/ui-v2/tabs/home.js`, `www/styles/courtiq-ui/tabs/home.css`.
**Wire:** existing handlers — session picker (`dashboard.js`), `notifications.js`, `streak.js`, `daily-challenge.js` — get rewired to the new DOM nodes by id/data-attr, no logic changes.
**Delete after flag flip + 3 days green:** panel markup for home/log/history/notifications/calendar in `dashboard.html` (move into the new tab markup or delete if unused), and the legacy-only CSS blocks they depended on in `main.css`.

**Verification:** all five sub-views load, every action button still triggers its original handler, streak counter still increments, session log persists to Supabase.

### Phase 3 — **Track** tab (Shot Tracker + YOLOX flagship)

This is the showcase. Reuse everything done in `features/shot-tracking/v2/` — the CSS is already scoped and matches the same token family. Build the Track tab on top of it.

**Plan:**
1. Promote `features/shot-tracking/v2/shot-tracker-v2.css` + `shot-tracker-v2-type.css` tokens into the global `courtiq-ui/tokens.css` (they're a subset). Retire the scoped `.stv2-active` block.
2. Port `TrackScreen` + `ShotTrackerCam` markup from `Screens.jsx` to `www/features/shot-tracking/v2/screens/` as Phase 2 of `MIGRATION.md` envisioned. Screen 2 (active detection) first — it's the one already scaffolded.
3. Wire the new UI into `ShotTrackingScreen.js` **without touching `shotDetection.js` or `yoloxWorker.js`**. The `ShotDetectionEngine` contract — `onShotDetected`, `onBallUpdate`, `onHoopDetected`, `onStatusChange` — stays identical.
4. Summary sub-view folds in `db-panel-summary` (stats, heatmap, zone breakdown) under the Track tab.

**Constraints:**
- YOLOX model load path unchanged (`features/shot-tracking/shotDetection.js:556`, `models/basketball_yolox_tiny_v6.onnx?v=6` + `.onnx.data`)
- Web Worker path unchanged (`features/shot-tracking/yoloxWorker.js`)
- Color-fallback detection path unchanged
- `shotService.js` persistence + XP grants unchanged

**Verification:**
- Open Track tab → camera permission prompt → hoop auto-lock fires → take a shot → overlay shows `detected → tracking → scored/miss` → summary row increments → Supabase row written.
- preview_network shows `models/basketball_yolox_tiny_v6.onnx` requested once, 200, correct size.
- preview_console_logs clean (no YOLOX warnings beyond existing baseline).

### Phase 4 — **Train** tab

Port `TrainScreen`. Sub-nav: *Drills / Daily Workout / Moves Library / Lab / Night Training*. Each routes to its existing module (`drill-engine.js`, `daily-workout.js`, `move-library.js`, `lab-panel.js`, `night-training.js`).

**Risk:** `drill-engine.js` is large (4,257 lines in www). Do not refactor it — only replace its DOM container and restyle its child elements.

### Phase 5 — **Coach** tab

Port `CoachScreen`. Thin wrapper over `ai-coach.js`. Keep the chat flow and Supabase/Anthropic bridge intact.

### Phase 6 — **Me** tab

Port `MeScreen`. Sub-nav: *Profile / Archetype / Social / Shop / Badges*. Wire `player-profile.js`, `player-analysis.js`, `avatar-customizer.js`, `avatar-3d.js`, `social-hub.js`, `badges.js`, `pricing.js`. The 3D avatar canvas keeps its existing Three.js setup.

### Phase 7 — Cleanup

Once all five tabs are green for ≥3 days each:
- Remove `<link>` references to `styles/kinetic-elite.css`, `styles/kinetic-stitch.css`, `styles/glassmorphism.css` from `www/dashboard.html`.
- Delete the files themselves.
- Remove the old bottom-nav markup and `.db-panel-*` containers that no longer back anything.
- Remove the `body.ciq-active` gating — `ciq-*` becomes the default and only design system.
- Collapse feature-flag `config.js` to a single `window.COURTIQ_UI_V2.ENABLED = true` constant or delete it entirely.

## Files to create

```
www/styles/courtiq-ui/tokens.css           (Phase 1)
www/styles/courtiq-ui/components.css       (Phase 1)
www/styles/courtiq-ui/tabs/home.css        (Phase 2)
www/styles/courtiq-ui/tabs/track.css       (Phase 3)  (absorbs features/shot-tracking/v2/*.css)
www/styles/courtiq-ui/tabs/train.css       (Phase 4)
www/styles/courtiq-ui/tabs/coach.css       (Phase 5)
www/styles/courtiq-ui/tabs/me.css          (Phase 6)
www/features/ui-v2/config.js               (Phase 1)
www/features/ui-v2/shell.js                (Phase 1)
www/features/ui-v2/tabs/home.js            (Phase 2)
www/features/ui-v2/tabs/track.js           (Phase 3)
www/features/ui-v2/tabs/train.js           (Phase 4)
www/features/ui-v2/tabs/coach.js           (Phase 5)
www/features/ui-v2/tabs/me.js              (Phase 6)
_design-import/mobile-app/                 (Phase 0 — copy of 6 files from Claude Design)
docs/REDESIGN_DECISIONS.md                 (Phase 0)
```

## Files to modify

- `www/dashboard.html` — add CSS links + `<script>` tags for the new shell + one mount node. No markup removed until each tab's Phase N ships.
- `www/styles/main.css` — only to resolve the 4 known token conflicts (already documented in `features/shot-tracking/v2/TOKEN_DIFF.md`).
- `www/js/dashboard.js` — expose `showPanel()` to the new shell if it isn't already global. No logic changes.

## Files to leave untouched (hard rule)

- `features/shot-tracking/shotDetection.js`
- `features/shot-tracking/yoloxWorker.js`
- `features/shot-tracking/shotService.js`
- `features/shot-tracking/adaptiveLearning.js`
- `models/basketball_yolox_tiny_v6.onnx` + `.onnx.data`
- `js/supabase-client.js`, `js/data-service.js` (data layer)
- `sw.js` (service worker cache strategy is production-tested)

## Verification checklist (end-to-end, per phase)

Use the `preview_*` tools after each phase:

1. `preview_start` on `C:\Users\tamir\Documents\GitHub\courtIQ` (port 8080).
2. `preview_screenshot` with flag OFF → baseline.
3. Flip phase flag to ON in `features/ui-v2/config.js`.
4. `preview_eval: location.reload()` → wait for `load`.
5. `preview_snapshot` → confirm new shell/tab renders with correct `ciq-*` classes.
6. For every sub-view in that tab: `preview_click` on the sub-nav item → `preview_snapshot` → confirm the corresponding old handler fired (check a known side effect, e.g. streak counter, shot counter, Supabase write via `preview_network`).
7. `preview_console_logs` and `preview_logs` for errors or YOLOX warnings.
8. `preview_screenshot` after → compare with design file in `_design-import/mobile-app/` (visual parity with `Screens.jsx`).
9. Cross-regression: visit every OTHER tab (flag still on only for this phase's tab) and confirm old UI still works.
10. Mobile viewport test: `preview_resize` to 390×844 (iPhone 14) → re-screenshot.
11. Flip flag back OFF → reload → confirm instant rollback.

**Shot Tracker (Phase 3) additional gate:** open Track tab → confirm `preview_network` shows `basketball_yolox_tiny_v6.onnx` (200 OK, ~19 MB) + `.onnx.data` (200 OK, ~20 MB) + `yoloxWorker.js` (200 OK). Simulate a shot by pointing camera at a hoop (or load a recorded test video) and confirm `onShotDetected` fires and `shotService.js` writes to Supabase.

## Risk register

| Risk | Mitigation |
|---|---|
| YOLOX contract accidentally broken during Track port | Phase 3 explicitly forbids editing `shotDetection.js` or `yoloxWorker.js`. Diff review before merge. |
| Root/www drift re-introduced by editing both trees | Phase 0 decision: www is source of truth. Any root edit during phases 1–7 requires a justification line in `docs/REDESIGN_DECISIONS.md`. |
| Token collision (4 known, per `TOKEN_DIFF.md`) | Resolve up-front in Phase 1 by writing the resolved value once in `tokens.css`. Keep `main.css :root` but alias to new names. |
| Sub-view feature loss (e.g. a button in `db-panel-log` gets missed) | Before each tab ships, produce a "feature parity matrix" — list every interactive element in the old panels it replaces, tick each one as rewired. Lives in `docs/REDESIGN_DECISIONS.md` per tab. |
| `dashboard.js` panel switcher assumes old DOM | Phase 1 shell keeps calling `showPanel()`; we only swap the nav chrome. Panel contents stay in place until their tab's phase. |
| 3D avatar (Three.js) stops rendering in new Me container | Phase 6 reuses the exact canvas element id; Three.js rebind tested with `preview_eval` before flag flip. |
| Performance regression from stacking three CSS systems during transition | Accept temporarily — cleanup in Phase 7 removes 196 KB of CSS. |

## Open questions to decide during Phase 0

- **Sub-nav pattern inside each tab** — confirmed by reading `Screens.jsx` (segmented control vs. dropdown vs. chip row). The design drives this.
- **Feature-parity matrix granularity** — one row per user-facing action, or one row per module? Propose: per user-facing action.
- **Capacitor/Android build** — `capacitor.config.json` already points `webDir` at `www/`. Matches the Phase 0 decision. Confirm no native navigation depends on specific panel ids.

## Out of scope (explicit)

- Rewriting `drill-engine.js`, `ai-coach.js`, or other feature logic.
- Changing the YOLOX model, training data, or inference path.
- Rewriting the service worker or Supabase schema.
- Rewriting authentication (root vs www auth divergence noted but left alone — production `www/auth.js` is untouched).
- Logo changes (the brand fonts are reused; visual logo work is handled separately in `logo-concepts.html`).

---

# Phase 8+ — Feature parity restoration (Tier A + B)

## Context

Phases 1–7 successfully shipped the v2 shell + 5 tab ports as the default UI. A post-graduation audit revealed two classes of regressions:

1. **Broken/dead interactive elements in v2 (3 of 23 audited)**
   - Coach tab: two drill recommendation cards (`Catch-and-Shoot · 4×10`, `Elbow Pull-Up · 3×8`) render with chevrons but have no click handlers.
   - Me tab: Account row has a chevron suggesting it's tappable, but no handler is wired.
   - Me tab: Trophy Case shows hardcoded demo state (first 2 unlocked) — `js/badges.js` writes to legacy `localStorage` and DOM IDs that the v2 module never reads.

2. **Major legacy features hidden but never re-rendered (~22% of legacy surfaces)**
   - The v2 tab modules render a SUBSET of each legacy panel. CSS hides the legacy panels under `body.ciq-active.ciq-v2-X.ciq-tab-X #db-panel-Y { display: none }` so the user can no longer reach them. The data still updates inside the hidden panel, but the UI is invisible.
   - User decision (2026-04-28): scope = **Tier A + B** (skip Avatar 3D, Shop, Settings detail views — see "Out of scope (Phase 8)" below). Approach = **rebuild from scratch in v2 design language** using `ciq-*` tokens + glass cards + accent colors. No mixed legacy/v2 visuals.

**The goal of Phase 8+:** restore every Tier A + B feature in `ciq-*` design language so the v2 UI is feature-equivalent to the pre-redesign experience for anything the user actually used. Each restoration unit ships behind its own flag in `COURTIQ_UI_V2`, defaults `false`, flips to `true` after preview_screenshot + handler verification.

## Restoration scope (locked)

**Tier A — Critical fixes + 3 most-used missing features**
1. Coach drill recommendation clicks → open the drill in Train tab (or surface drill detail sheet)
2. Me tab Account row → open a Settings sheet (logout + future links)
3. Trophy Case dynamic sync from `js/badges.js`
4. Drill Generator (Train tab) — filter by skill × difficulty, pick → start
5. Heatmap + Zone Breakdown (Track tab) — court SVG + per-zone make %
6. Daily Workout Player (Train tab) — timer + set/rep tracker + audio cues

**Tier B — Complete the design**
7. Recent Sessions detail (Track tab) — list of past sessions with drill-by-drill breakdown
8. Social leaderboards + challenges (Me tab → Social sub-view)
9. Calendar event builder (Home tab → Calendar sub-view)

**Out of scope (Phase 8)**
- Avatar 3D customizer (Three.js) — keep legacy panel hidden; deferred indefinitely
- Shop equipment grid + coin wallet — deferred
- Account Security Settings + Help Center — deferred (Settings sheet stub gets a "More coming soon" line)

## Strategy — same flag pattern, finer-grained units

Extend `COURTIQ_UI_V2` with one flag per restoration unit. Each unit is its own JS module + CSS file under existing tab directory. Modules attach to the existing tab screen via `data-ciq-slot="<unit>-mount"` placeholders that the parent tab module emits but leaves empty.

**New flags** (added to `www/features/ui-v2/config.js` `DEFAULT_FLAGS`):

```js
TRACK_HEATMAP:   true,
TRACK_ZONES:     true,
TRACK_SESSIONS:  true,
TRAIN_DRILL_GEN: true,
TRAIN_PLAYER:    true,
HOME_CALENDAR:   true,
ME_SOCIAL:       true,
ME_SETTINGS:     true,
ME_TROPHIES:     true,   // wires badges.js → v2 DOM
COACH_RECS:      true    // wires drill-rec clicks
```

`?ui=v1` continues to disable everything. New optional override: `?ui=core` flips just the original 6 v2 flags on but holds Phase 8 flags off — useful for bisecting regressions.

## Files to create

```
www/styles/courtiq-ui/tabs/track-heatmap.css
www/styles/courtiq-ui/tabs/track-zones.css
www/styles/courtiq-ui/tabs/track-sessions.css
www/styles/courtiq-ui/tabs/train-drill-generator.css
www/styles/courtiq-ui/tabs/train-player.css
www/styles/courtiq-ui/tabs/home-calendar.css
www/styles/courtiq-ui/tabs/me-social.css
www/styles/courtiq-ui/tabs/me-settings.css

www/features/ui-v2/tabs/track-heatmap.js
www/features/ui-v2/tabs/track-zones.js
www/features/ui-v2/tabs/track-sessions.js
www/features/ui-v2/tabs/train-drill-generator.js
www/features/ui-v2/tabs/train-player.js
www/features/ui-v2/tabs/home-calendar.js
www/features/ui-v2/tabs/me-social.js
www/features/ui-v2/tabs/me-settings.js
```

## Files to modify

- `www/features/ui-v2/config.js` — extend `DEFAULT_FLAGS` with the 10 new flags + add `?ui=core` mode.
- `www/features/ui-v2/tabs/track.js` — emit 3 mount nodes (`heatmap`, `zones`, `recent-sessions`) inside `#ciq-track-screen`.
- `www/features/ui-v2/tabs/train.js` — emit 2 mount nodes (`drill-generator`, `player`) inside `#ciq-train-screen` + extend sub-nav with `Generator` chip.
- `www/features/ui-v2/tabs/home.js` — promote `Calendar` sub-nav from "route to legacy panel" to mount-node renderer when `HOME_CALENDAR` is on.
- `www/features/ui-v2/tabs/me.js` — promote `Social` sub-nav similarly; replace static trophies with `data-ciq-slot="trophies"` for me-trophies.js to populate; wire Account row click to open me-settings sheet.
- `www/features/ui-v2/tabs/coach.js` — wire `[data-ciq-action="drill-rec"]` clicks on the two recommendation cards.
- `www/dashboard.html` — link 8 new CSS files + 8 new JS files.

## Per-unit specs

### 8.1 — Coach drill rec clicks (smallest, ship first)
- File: edit `coach.js` only (no new files). Add `data-ciq-action="drill-rec" data-drill-id="catch-and-shoot"` to each rec card. Click handler routes to Train tab via `dbSwitchTab('training')` AND scrolls/highlights the drill in the train screen if `TRAIN_DRILL_GEN` is on; otherwise just routes.
- Reuse: `dbSwitchTab` (`www/js/dashboard.js`).

### 8.2 — Trophy Case dynamic (Me tab)
- File: edit `me.js` to render `<div data-ciq-slot="trophies"></div>` placeholder. New file `me-trophies.js` reads `localStorage.getItem('courtiq-badges')` (legacy badges.js writes there per audit) and populates the slot.
- Reuse: existing badge metadata + earn-state logic in `www/js/badges.js`. Subscribe to a `MutationObserver` on the legacy badge container OR a `storage` event so the v2 trophies stay live.

### 8.3 — Me Settings sheet (Account row click)
- New: `me-settings.js` + `me-settings.css`. Renders a bottom-sheet (CSS `transform: translateY` slide-up) with: Email row (read-only), `Sign Out` button, "More coming soon" placeholder.
- Reuse: `sb.auth.signOut()` from `www/js/supabase-client.js` for sign-out.

### 8.4 — Drill Generator (Train tab)
- New: `train-drill-generator.js` + `train-drill-generator.css`. UI: chip filters (Skill: All/Shooting/Ball Handling/Defense/Athleticism; Difficulty: All/Easy/Med/Hard) → list of drill cards (name, meta, focus, time, intensity). Tapping a card → "Add to Today" CTA → calls existing legacy adder.
- Reuse: legacy drill catalog and selection logic in `www/js/drill-engine.js`. Specifically the global functions referenced by legacy onclick handlers (`generateDrills` etc.) — invoke programmatically once and read from the resulting state, then render with `ciq-*` classes.

### 8.5 — Daily Workout Player (Train tab)
- New: `train-player.js` + `train-player.css`. UI: full-screen overlay with current set/rep, big timer, "Next" / "Skip" / "Pause" buttons + progress bar. Audio cues via `www/js/sound-effects.js`.
- Reuse: `www/js/workout-timer.js` (timer engine), `www/js/sound-effects.js`, `www/js/daily-workout.js` (session state). Kept as black boxes; v2 only swaps the visual chrome.
- Trigger: `Start` button in the existing v2 Train challenge card OR per-drill Play icon in Drill Generator.

### 8.6 — Heatmap + Zone Breakdown (Track tab)
- New: `track-heatmap.js` + `track-heatmap.css` + `track-zones.js` + `track-zones.css`.
- Heatmap: half-court SVG (custom, drawn in `ciq-*` palette — green hot, red cold). Renders shot positions read from `features/shot-tracking/utils/heatmapGenerator.js`.
- Zones: 7-zone grid (paint, mid-range L/R, top of key, 3pt L/C/R) — each showing make/attempts ratio. Reads from session data via `features/shot-tracking/shotService.js`.
- Reuse: `heatmapGenerator.js`, `shotService.js`, the already-trained YOLOX detection results. **Do not touch** any of these files — read-only consumers.

### 8.7 — Recent Sessions detail (Track tab)
- New: `track-sessions.js` + `track-sessions.css`. Replaces the placeholder "Log your first session..." card. Fetches sessions list from Supabase via existing `data-service.js` queries; each row expands on tap to show the drill-by-drill breakdown.
- Reuse: `www/js/data-service.js` query helpers.

### 8.8 — Calendar event builder (Home → Calendar sub-view)
- New: `home-calendar.js` + `home-calendar.css`. Replaces the current "route to legacy panel" behavior of the Calendar chip. Renders: month grid (compact), day detail panel, "Schedule Session" CTA.
- Reuse: legacy calendar state in `www/js/dashboard.js` Calendar section helpers.

### 8.9 — Social leaderboards + challenges (Me → Social sub-view)
- New: `me-social.js` + `me-social.css`. Replaces "route to legacy" for Social chip. Renders: Top 10 leaderboard (avatar + rank + XP), Active Challenges card, "Send Challenge" CTA.
- Reuse: `www/js/social-hub.js` query helpers + Supabase realtime subscription already wired there.

## Hard rules (carried forward)

1. Do not touch `features/shot-tracking/shotDetection.js`, `yoloxWorker.js`, `shotService.js`, `adaptiveLearning.js`, or the YOLOX model files.
2. Do not touch `js/supabase-client.js`, `js/data-service.js`, `sw.js`.
3. Each unit's CSS is scoped under `body.ciq-active` AND its specific flag class, so flag-OFF = invisible no-op.
4. Every new module attaches via `data-ciq-slot="<unit>-mount"` so the parent tab can render with or without it.
5. www/ is still the only edit target. Root stays untouched.
6. Visual parity to the design system: every new card uses `var(--glass-bg)`, `var(--glass-border)`, `var(--shadow-card)`, fonts via `var(--font-display)` / `var(--font-body)`, accent via the parent tab's `--c-{home/track/train/coach/me}`.

## Verification (per unit)

For each restoration unit:

1. Land the new files with the unit's flag default `false`. Reload dashboard → confirm zero visual change vs. baseline screenshot.
2. Flip the unit flag to `true` in `config.js`. Reload → screenshot.
3. Trigger every interactive element in the new unit; confirm:
   - `preview_console_logs` clean (no "handler not found" warnings)
   - The legacy data path was executed (e.g. for Drill Generator: confirm `dbSessions` array updated; for Workout Player: confirm `workout-timer.js` started; for Heatmap: confirm shots from Supabase rendered)
4. `preview_screenshot` matches the corresponding mock from `_design-import/mobile-app/Screens.jsx` where applicable, or the verbal description above where not.
5. Cross-regression: switch to every other tab and confirm nothing broke. Especially watch for layout shifts caused by the new mount nodes in Train/Track/Me/Home.
6. Mobile viewport: `preview_resize` to 390×844 → re-screenshot. The new units must hold layout at iPhone width.

## Order of work (recommended)

1. **8.1 Coach drill rec clicks** — 30 min, smallest scope, immediate UX win.
2. **8.2 Trophy Case dynamic** — 1 hour, removes "fake demo" perception.
3. **8.3 Me Settings sheet** — 1 hour, makes Account row tappable + adds Sign Out (real need).
4. **8.4 Drill Generator** — half-day, biggest Train tab impact.
5. **8.5 Daily Workout Player** — half-day, depends on 8.4 for the launch entry point.
6. **8.6 Heatmap + Zones** — full day, biggest Track tab impact.
7. **8.7 Recent Sessions** — half-day, complements 8.6.
8. **8.8 Calendar** — half-day.
9. **8.9 Social** — half-day, last because it has the most external (Supabase realtime) moving parts.

## Risk register (Phase 8)

| Risk | Mitigation |
|---|---|
| Legacy globals (`generateDrills`, `dbCalendarSetMode`, etc.) don't actually exist or are dead in v1 too | Audit each one BEFORE creating its v2 module. If dead, the v2 unit MUST own its own state (no thin-wrapper option). |
| Workout Player overlay competes with Shot Tracker camera overlay z-index | Reuse the same `z-index: 1100` ceiling and add `body.ciq-workout-active` exclusive class so Track tab can't be opened mid-workout. |
| Heatmap SVG re-renders on every shot detected → frame drops on mobile | Throttle redraws to 4 fps via `requestAnimationFrame` + dirty flag. Heatmap math stays in `heatmapGenerator.js`; v2 only consumes the final point list. |
| Calendar v2 view de-syncs from legacy state | Single source of truth = legacy calendar state object on `window.dbCalendarState` (or wherever dashboard.js holds it). v2 reads + dispatches actions through legacy mutators only. No parallel state. |
| User uses `?ui=v1` for one screen but Phase 8 features are v2-only | `?ui=v1` users stay on the legacy panels (which still have these features in their original visual). v2 cleanup phase keeps legacy panel markup in DOM until Phase 8 is fully shipped. |

## Done definition for Phase 8

- All 10 new flags default `true` in `config.js`.
- Every audit row from "Top 10 Gap List" rows 1–9 (excluding Avatar 3D row 7→deferred, Shop row 9→deferred, Account Security row 10→deferred) marks **CARRIED OVER** in a follow-up parity matrix.
- Visual parity vs. the original `Screens.jsx` references AND vs. the corresponding pre-redesign panels.
- `preview_screenshot` of all 5 tabs at 390×844 + a fresh A/B vs. an earlier baseline shows only intentional additions, no regressions.
- `docs/REDESIGN_DECISIONS.md` updated with: which flags, what was deferred, and a final parity matrix.

---

# Phase 9 — Redesign via Claude Design (visual polish pass)

## Context

After Phase 8 shipped 9 restoration units, a visual review surfaced that the new modules feel "generic and AI-shaped" compared to the polish of the 5 original screens (which were designed in claude.ai/design and ported faithfully). User decision (2026-04-28): every Phase 8 unit AND every original screen gets a visual refresh, driven through claude.ai/design using the existing CourtIQ Design System (project id `4d34587a-38f6-4bce-9397-e5721f65d010`).

The design system stays. Tokens (`colors_and_type.css`), the `.ciq-*` component classes, and the 5 nav accents are all locked. The refresh is purely visual: layout density, hierarchy, micro-interactions, accent treatments, and component-level details brought up to the polish level of the original `Screens.jsx`.

## Workflow (per unit)

1. Open the existing CourtIQ Design System artifact in Chrome via the existing serve URL (`https://4d34587a-38f6-4bce-9397-e5721f65d010.claudeusercontent.com/v1/design/projects/.../serve/...`).
2. Drive the design AI from Claude Code: navigate to the project chat, send a brief that pins the unit's purpose, the existing accent token (`--c-track`, etc.), the data fields, and the interactive affordances.
3. The AI generates a refined component in the existing artifact's React tree; it MUST consume tokens from `colors_and_type.css` (already loaded in the artifact).
4. Pull the resulting JSX/CSS via `fetch` in the iframe context (same trick used in Phase 0 to pull `Screens.jsx`).
5. Translate to vanilla JS in the app: rewrite the v2 module's `buildXxx()` DOM constructors + replace the matching CSS file.
6. Re-verify in `preview_screenshot`. Same flag, same data wiring, only visuals change.

## Surfaces to redesign (14)

| # | Unit | Tab | Source file pair | Priority |
|---|---|---|---|---|
| 1 | Heatmap + Zones | Track | `track-heatmap.js/css`, `track-zones.js/css` | High |
| 2 | Recent Sessions | Track | `track-sessions.js/css` | High |
| 3 | Drill Generator | Train | `train-drill-generator.js/css` | High |
| 4 | Workout Player | Train | `train-player.js/css` | Medium |
| 5 | Trophy Case | Me | `me-trophies.js` (renders into `me.css` slot) | Medium |
| 6 | Social leaderboard | Me | `me-social.js/css` | Medium |
| 7 | Settings sheet | Me | `me-settings.js/css` | Low |
| 8 | Calendar | Home | `home-calendar.js/css` | Medium |
| 9 | Coach drill recs | Coach | `coach.js`, `coach.css` (recs only) | Low |
| 10 | Home original | Home | `home.js/css` | Polish |
| 11 | Train original | Train | `train.js/css` | Polish |
| 12 | Track original | Track | `track.js/css` | Polish |
| 13 | Coach original | Coach | `coach.js/css` | Polish |
| 14 | Me original | Me | `me.js/css` | Polish |

## Batches

- **A — Track** (1, 2, 12): the most visually weighted tab. Heatmap/Zones/Sessions ship first because they're the biggest "AI-shaped" offenders. Then polish the Track hero + stats.
- **B — Train** (3, 4, 11): Drill Generator card density, then Workout Player overlay, then polish the week challenge.
- **C — Me** (5, 6, 7, 14): Trophy Case card design, Social leaderboard rows, Settings sheet, then polish the stadium hero + account row.
- **D — Home + Coach** (8, 9, 10, 13): Calendar grid + day detail, Coach drill recs as polished tappable cards, then polish Home hero/insight, then fix Coach topbar overlap.

## Hard rules (carried)

1. No changes to `shotDetection.js`, `yoloxWorker.js`, `drill-engine.js`, `ai-coach.js`, `social-hub.js`, `data-service.js`, `sw.js`, model files.
2. Existing data wiring stays: `MutationObserver` on legacy panels, `DataService` calls, `dbSwitchTab` routing, `sessionStorage` pending-drill bridge.
3. Each unit keeps its existing flag in `COURTIQ_UI_V2`. `?ui=v1`, `?ui=core`, `?ui=v2` continue to behave as documented.
4. www/ remains the only edit target.
5. Token diff: any new tokens introduced by Claude Design get appended to `tokens.css`, never replace existing ones.

## Verification per batch

- `preview_screenshot` of every changed tab + sub-view at desktop width.
- Visual A/B: take a "before" screenshot of the unit pre-redesign (already captured in earlier session for some), compare to "after".
- Functional: every interactive element still fires its handler (run `eval` checks similar to Phase 8 verification).
- `?ui=v1` cross-check: legacy panels unchanged.

## Done definition for Phase 9

- All 14 surfaces visually parity-matched against the design system polish level.
- No regressions to flags, data wiring, or handlers.
- `docs/REDESIGN_DECISIONS.md` updated with a "Phase 9" entry listing what changed per unit and any new tokens introduced.

---

# Phase 10 — Design maturity pass (every surface, expert-level)

## Context

Phase 9 brought the v2 Phase 8 modules up to Screens.jsx polish. A deeper review surfaced that the polish is uneven and that several systemic problems still make the app feel generic:

1. **Iconography is a mess** — Lucide stroke icons + emoji + hand-coded SVG paths all coexist. No basketball-specific visual language anywhere. Drill focus is shown as letters (S / BH / D / A). Trophy case is 4 emoji. Coach uses ⚡. Reads as wellness app, not basketball app.
2. **Page templates are inconsistent** — eyebrow+title pattern present on most v2 screens but missing on Settings sheet, Player overlay, and several sub-pages. Density jumps unpredictably between surfaces.
3. **Sub-pages are still legacy** — Home → Log/History/Notifications, Train → Moves, Me → Shop all show through to legacy `db-panel-*` markup that uses `.ks-*` classes from the old kinetic-stitch design language. Jarring.
4. **5 saturated accents compete** — every tab uses its accent at full saturation. No hierarchy. The app shouts in five colors.
5. **Empty states and loading states** vary by surface. Some have icon + headline + sub, some are plain text.
6. **Action button hierarchy** unclear — primary / secondary / tertiary styling not consistent.
7. **User journeys aren't surfaced** — the design treats each screen as a flat surface; doesn't ask "what is the user here to do in 1 second?"

User decision (2026-04-28): redesign every page, every sub-page, every feature, with real designer thinking. No surface left un-considered.

## Strategy — design from the user out

### Phase 10.0 — Foundation work (must ship before any tab redesign)

These three foundations get every subsequent tab redesign for free.

**10.0.A — Icon system overhaul**

Replace every icon in the v2 modules with a unified set. Hybrid approach (best of both):
- **Custom basketball icons (16 icons, hand-drawn SVG)**: drill-shooting, drill-ballhandling, drill-defense, drill-athleticism, drill-conditioning, zone-paint, zone-3pt, zone-midrange, stat-fg, stat-streak, stat-xp, badge-trophy, badge-medal, badge-target, badge-star, court-rim. Single stroke weight (2px), 24×24 viewBox, currentColor stroke, rounded caps, optional fill region.
- **Phosphor Icons (curated subset, ~20 icons) for generic UI**: home, calendar, mail, logout, settings, share, upload, camera, play, pause, chevron-right, x, search, filter, arrow-up-right, plus, check, info, alert, lock. Phosphor's "regular" weight matches the existing aesthetic better than Lucide.
- All icons live in a single sprite-style file: `www/styles/courtiq-ui/icons.svg` (or inline JS map). Consumed via `<svg><use href="#ic-shooting"/></svg>` pattern OR a `ICONS.shooting()` JS function returning a `<svg>` element.
- Retire ALL emoji from interactive UI (keep emoji only in user-generated content like daily-challenge titles).
- Retire ALL Lucide icons.

**10.0.B — Page template library**

Define 5 template scaffolds. Every page in the app picks one and follows it strictly:

1. **HeroPage** — for tab landing screens (Home, Track, Train, Coach, Me main view). Pattern: topbar → eyebrow chip with dot + italic title → primary card (the "what now" answer) → secondary cards (supporting context) → optional list. Uses radial halo on primary card.
2. **ListPage** — for browse screens (Drill library, Recent sessions, Leaderboard, History, Notifications). Pattern: topbar → eyebrow + title + count chip → filter chips (optional) → list of rows with consistent row anatomy → optional load-more.
3. **DetailOverlay** — for fullscreen-modal experiences (Workout Player, Live Camera Tracker). Pattern: header bar with close + status pill → big italic display KPI → progress affordances → action row with primary CTA centered.
4. **BottomSheet** — for quick-action modals (Settings, Confirm dialogs, Share). Pattern: grabber → eyebrow + title → 1-3 rows OR form → action row.
5. **EmbeddedSection** — for sub-views inside a tab (Calendar inside Home, Heatmap inside Track). Pattern: section eyebrow with dot → optional meta chip on right → content card with radial halo.

Each template gets a CSS class + a JS helper function in a new `www/features/ui-v2/templates/` directory. Every Phase 8/9 module is migrated to use these templates.

**10.0.C — Hierarchy rules**

Codified design rules captured in `www/styles/courtiq-ui/hierarchy.css`:

- **Accent saturation**: only the active tab's accent renders at 100% saturation. All other accents in view dim to 60%. Implemented via `body.ciq-tab-X` scope: `.ciq-accent { color: var(--c-X); }` while inactive accents fall to a `--c-X-dim` derived value.
- **Action buttons**: 3 levels — `.ciq-cta-primary` (accent fill, shadow, italic-spaced uppercase), `.ciq-cta-secondary` (glass bg, border, normal weight), `.ciq-cta-tertiary` (text only, accent color, no chrome). Used consistently everywhere.
- **Headings**: 3 levels — `.ciq-h1` (48px italic Barlow), `.ciq-h2` (28px italic), `.ciq-h3` (18px upper, normal). Pages have at most one H1.
- **Density**: 3 levels — `comfy` (24px gaps, hero pages), `normal` (16px, list pages), `compact` (10px, modals + secondary lists).
- **Empty states**: single template — icon (custom 32px) + h2 italic title + body sub + optional CTA. One CSS class `.ciq-empty`.
- **Loading states**: single template — spinning custom basketball icon (16px) + small italic uppercase label. One CSS class `.ciq-loading`.

### Phase 10.1 — Tab redesigns (after 10.0)

Each tab redesigned end-to-end including its sub-pages. For each tab:

**For each surface** (tab landing OR sub-page):
1. Write a **purpose statement**: "When the user lands here, the answer to 'what now' is X."
2. Choose template (HeroPage / ListPage / DetailOverlay / BottomSheet / EmbeddedSection).
3. Define **3 information layers**:
   - Hero (the one thing — 1-2 lines)
   - Active info (what they need now — 3-5 cards/rows)
   - Reference info (history, settings, etc. — folded behind tap)
4. Choose icons from the new icon set.
5. Implement.

#### Home tab (amber)

| Surface | Purpose | Template |
|---|---|---|
| **Today (default)** | "Here's what to do right now." | HeroPage. Hero = Daily Challenge (the most actionable card). Secondary = Level + Streak combined card. List = 3 most recent sessions or upcoming events. |
| **Log Session** sub | "Log what you just did in 30 seconds." | ListPage. One form per drill type. Auto-detect last session's drills. Submit + dismiss. |
| **History** sub | "Look at past sessions." | ListPage. Sessions grouped by week. Tap to expand. Connects to Track. |
| **Calendar** sub | "Plan future sessions." | EmbeddedSection (already scaffolded). Refine: month grid → week strip → day detail. |
| **Alerts** sub | "What changed since I last opened the app?" | ListPage. Notification rows with icon + title + time + dismiss. Empty state: "All caught up." |

#### Track tab (green)

| Surface | Purpose | Template |
|---|---|---|
| **Lab (default)** | "How am I shooting?" | HeroPage. Hero = Field Goal % (italic huge). Secondary = stat tiles. Primary CTA = "Launch Camera". |
| **Heatmap** sub | "Where do I score from?" | EmbeddedSection. Court SVG with custom basketball icon legend. Active zone sidebar (already there). |
| **Sessions** sub | "Replay past sessions." | ListPage. Already in good shape. Polish: row anatomy with custom session-type icon. |
| **Live Camera** | "Tracking live shots." | DetailOverlay. Already exists in `ShotTrackingScreen.js` — leave engine alone, restyle HUD only. |

#### Train tab (blue)

| Surface | Purpose | Template |
|---|---|---|
| **Today (default)** | "What's my workout today?" | HeroPage. Hero = today's challenge with completion progress. Secondary = sets done, next drill. CTA = Start. |
| **Drill Library** sub | "Pick a drill to work on." | ListPage. Filter chips (Focus × Difficulty). Drill rows with custom focus icon (NOT letter S/BH/D/A). |
| **Moves Library** sub | "Learn signature moves." | ListPage. Each move row has thumbnail + animation play affordance. Connects to legacy `move-library.js`. |
| **Workout Player** | "Run this drill now." | DetailOverlay. Already exists. Custom basketball icons for sets, drill type. |

#### Coach tab (purple)

| Surface | Purpose | Template |
|---|---|---|
| **Coach (default)** | "What does my coach say to do next?" | HeroPage. Hero = latest insight (1 sentence). Secondary = recommended drills (NOT chat bubbles — too AI-shaped). CTA = "Update This Week". |
| **Update Performance** sub | "Tell coach what I did last week." | ListPage. Form rows (the existing 4 categories) restyled with custom focus icons + sliders or steppers (not number inputs). |
| **Insight History** sub (NEW) | "What did coach say in the past?" | ListPage. Chronological list of past insights. |

The current chat-bubble metaphor on Coach is replaced by an **Insight Card** pattern that feels like the AI gave the user a verdict (not a chat reply). One headline + supporting bullets + actions.

#### Me tab (teal)

| Surface | Purpose | Template |
|---|---|---|
| **Profile (default)** | "Who am I as a player?" | HeroPage. Hero = name + position + 3-stat strip. Secondary = trophy carousel (NOT 4 emoji boxes). |
| **Trophies** sub (NEW) | "All my badges." | ListPage. Custom badge SVG per achievement. Earned/locked clearly distinguished. |
| **Social** sub | "How do I rank?" | ListPage. Already exists. Polish row anatomy with custom rank-medal icons. |
| **Shop** sub | "Spend XP on cosmetics." | ListPage. NEW v2 port (currently legacy). Item rows with thumbnail + price + buy CTA. |
| **Settings** | "Manage my account." | BottomSheet. Already exists. Polish with custom icons + adjust info architecture (Email + Sign Out + Notifications + About + Help — 5 rows). |

### Phase 10.2 — Polish pass

After all tabs ship:
- Walk every cross-tab journey (Home → Track → Train → Coach → Me) and confirm visual continuity.
- Verify sub-nav transitions don't cause layout shifts.
- Run accessibility check: every icon has `aria-label` or sr-only text. All interactive elements ≥44px tap target.
- Light-mode handling deferred — explicitly out of scope.
- Update `docs/REDESIGN_DECISIONS.md` with full Phase 10 record.

## Files to create

```
www/styles/courtiq-ui/icons.css                  (custom icon CSS, sizing rules)
www/styles/courtiq-ui/hierarchy.css              (3 button levels, headings, density classes)
www/styles/courtiq-ui/templates.css              (5 template scaffolds)
www/features/ui-v2/icons.js                      (single export: ICONS map of named SVG factories)
www/features/ui-v2/templates/hero-page.js        (HeroPage helper)
www/features/ui-v2/templates/list-page.js        (ListPage helper)
www/features/ui-v2/templates/detail-overlay.js   (DetailOverlay helper — replaces train-player overlay scaffold)
www/features/ui-v2/templates/bottom-sheet.js     (BottomSheet helper — replaces me-settings sheet scaffold)
www/features/ui-v2/templates/embedded-section.js (EmbeddedSection helper)

www/styles/courtiq-ui/tabs/home-log.css          (NEW v2 sub-page)
www/styles/courtiq-ui/tabs/home-history.css      (NEW v2 sub-page)
www/styles/courtiq-ui/tabs/home-alerts.css       (NEW v2 sub-page — replaces legacy db-panel-notifications via routing)
www/styles/courtiq-ui/tabs/train-library.css     (NEW v2 sub-page — replaces legacy db-panel-moves routing)
www/styles/courtiq-ui/tabs/me-trophies.css       (NEW dedicated sub-page)
www/styles/courtiq-ui/tabs/me-shop.css           (NEW v2 sub-page — replaces legacy db-panel-shop routing)
www/styles/courtiq-ui/tabs/coach-history.css     (NEW v2 sub-page — Insight History)

www/features/ui-v2/tabs/home-log.js              (NEW)
www/features/ui-v2/tabs/home-history.js          (NEW)
www/features/ui-v2/tabs/home-alerts.js           (NEW)
www/features/ui-v2/tabs/train-library.js         (NEW — re-skin of move-library)
www/features/ui-v2/tabs/me-trophies-page.js      (NEW — separate from me-trophies.js carousel)
www/features/ui-v2/tabs/me-shop.js               (NEW — re-skin of legacy shop)
www/features/ui-v2/tabs/coach-history.js         (NEW)
```

## Files to modify

- Every existing `www/features/ui-v2/tabs/*.js` and `*.css` migrates to new templates + icon system.
- `www/features/ui-v2/config.js` extended with flags for new sub-pages.
- `www/dashboard.html` adds links + scripts for new files.

## Files to leave untouched (hard rules carried)

- `features/shot-tracking/*.js`, model files, `yoloxWorker.js`
- `js/drill-engine.js`, `js/ai-coach.js`, `js/social-hub.js`, `js/data-service.js`, `js/supabase-client.js`, `sw.js`
- Root tree

## Implementation order

**Week 1 — Foundation (10.0)**
1. Build the icon set (16 custom + 20 Phosphor curated). One commit.
2. Build template scaffolds. One commit per template.
3. Build hierarchy CSS. One commit.
4. Migrate ONE existing module (e.g., `train-drill-generator.js`) onto templates as proof-of-pattern. Verify visually.

**Week 2 — Track + Train (highest visual impact)**
1. Track: Lab landing → Heatmap → Sessions → Live Camera HUD restyle.
2. Train: Today landing → Drill Library → Workout Player → Moves Library port.

**Week 3 — Home + Coach + Me**
1. Home: Today → Log → History → Calendar refine → Alerts.
2. Coach: Insight Card landing → Update Performance → Insight History.
3. Me: Profile → Trophies page → Social refine → Settings refine → Shop port.

**Week 4 — Polish**
1. Cross-tab journey audit.
2. Accessibility pass.
3. Documentation.

## Verification

For each surface, after ship:
1. Open in preview at 390×844 (iPhone 14 viewport).
2. Confirm template choice matches the screen's purpose.
3. Confirm every icon comes from the new system (no Lucide / no emoji in interactive UI).
4. Confirm only the active tab's accent is at full saturation.
5. Confirm 3 information layers are visible (hero / active / reference).
6. Confirm empty + loading states render correctly.
7. Confirm sub-nav transitions land on a v2-styled surface (no legacy showthrough).

## Risk register (Phase 10)

| Risk | Mitigation |
|---|---|
| Custom icon set takes longer than budgeted | Ship Phosphor-only first, layer custom icons in Phase 10.1 incremental. Custom icons are nice-to-have until 10.2 polish. |
| Templates over-abstract and fight specific page needs | Templates are descriptive (CSS classes + JS helpers), not prescriptive (no required arguments). Each page can override. |
| Port of legacy `move-library.js` and shop into v2 needs new data hooks | Do read-only adapters first; if data shape isn't usable, defer to 10.2 and keep legacy showthrough flagged. |
| Removing `?ui=v1` regression risk | Keep `?ui=v1` and `?ui=core` working. Add `?ui=v2-templated` flag to bisect template migrations. |
| Five Phase 8 / 9 modules need rewriting on top of templates | Order migration after templates are proven on `train-drill-generator`. Don't rewrite all five before the pattern is stable. |

## Done definition for Phase 10

- Every surface in the app uses one of the 5 templates.
- Zero Lucide icons remain in v2 modules. Zero emoji in interactive UI (CTAs, button labels, status indicators).
- Trophy Case has 4 custom-designed badge SVGs.
- All sub-nav routes land on v2-styled surfaces (no `db-panel-*` showthrough).
- Only one tab accent is at 100% saturation at any time.
- One H1 per page maximum.
- Empty / loading states use unified template.
- A user journey walkthrough (Home → Track → Train → Coach → Me) feels visually continuous.
- `docs/REDESIGN_DECISIONS.md` updated with Phase 10 final state.
