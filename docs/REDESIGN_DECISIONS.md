# CourtIQ Redesign — Decisions Log

Living record of every decision made during the redesign. Append only; never rewrite history. Each entry dated, with rationale.

## 2026-04-20 — Phase 0 decisions

### Source of truth (tree)

**`www/` is the single source of truth for every file that reaches gh-pages.**
- `deploy-pages.yml` reads from `www/` and the post-process step overwrites `www/index.html` with `www/dashboard.html` (root URL serves dashboard).
- Confirmed in `PRODUCTION_STATE_REPORT.md` §1–§3: CI has been healthy, 20 successful deploys in the last 14 days, `origin/gh-pages:dashboard.html` is byte-identical to `www/dashboard.html`.
- Root holds copies of some files (`index.html`, `js/`, `styles/`) because `build.js` copies them into `www/`, and root has its own unshipped variants of `auth.js`, `dashboard.js`, `drill-engine.js`, `components.css` (per `WWW_DRIFT_REPORT.md` §A). **Those root-only variants are NOT promoted to production as part of the redesign.** Any UI work during phases 1–7 happens under `www/`. Root is touched only if `build.js` copies a file into `www/`; in that case the fix goes to root and `www/` receives it via `npm run build`.
- Rule: if a redesign commit ends up editing any root file outside the `build.js` list (`index.html`, `shared.css`, `manifest.json`, `sw.js`, `js/`, `styles/`, `assets/`, `icons/`), it needs a justification bullet appended here.

### Design system origin

**Source:** `CourtIQ Design System` project in claude.ai/design (id `4d34587a-38f6-4bce-9397-e5721f65d010`), primary artifact `ui_kits/mobile-app/mobile-app.html`.

**Files copied into `_design-import/mobile-app/`:**
- `colors_and_type.css` — 96 CSS custom properties + `@font-face` for Barlow Condensed + Lexend (9.1 KB)
- `ui-kit.css` — 12 `.ciq-*` component classes (4.7 KB)
- `Chrome.jsx` — TopBar, BottomNav (5-tab), Eyebrow/Title, Primary/Secondary buttons, StatTile, NAV array (2.8 KB)
- `Icons.jsx` — 19 Lucide-style stroke icons (3.2 KB)
- `Screens.jsx` — 5 screens (Home/Train/Track/Coach/Me) + `ShotTrackerCam` subcomponent (22.8 KB)

**ios-frame.jsx was intentionally NOT copied** — it's an iOS device-chrome wrapper used only for the design artifact preview (rounded corners, status-bar clock, speaker notch). We ship to a real device via Capacitor; no need for a faux frame.

### Naming and scope

| Concept | Value |
|---|---|
| Class prefix | `ciq-` |
| Tokens live at | `:root` in `www/styles/courtiq-ui/tokens.css` |
| Components live at | `body.ciq-active .ciq-*` in `www/styles/courtiq-ui/components.css` |
| Global scope gate | `body.ciq-active` (shell enabled) |
| Per-tab scope gate | `body.ciq-active.ciq-tab-{home,train,track,coach,me}` |
| Feature flags object | `window.COURTIQ_UI_V2` in `www/features/ui-v2/config.js` |

### 5-color nav palette (locked)

| Tab | Token | Hex | Dim |
|---|---|---|---|
| Home | `--c-home` | `#f5a623` (amber) | `rgba(245,166,35,0.12)` |
| Train | `--c-train` | `#4ca3ff` (blue) | `rgba(76,163,255,0.12)` |
| Track | `--c-track` | `#56d364` (green) | `rgba(86,211,100,0.12)` |
| Coach | `--c-coach` | `#bc8cff` (purple) | `rgba(188,140,255,0.12)` |
| Me | `--c-me` | `#2dd4bf` (teal) | `rgba(45,212,191,0.12)` |

Each tab sets `--accent: var(--c-<tab>)` on its root container so `ciq-*` components pick it up via `var(--accent, #f5a623)`.

### Rollout order

User-confirmed on 2026-04-20:

1. Phase 1 — DS foundation + new shell (flags off, no content port yet)
2. Phase 2 — **Home** tab (lowest risk)
3. Phase 3 — **Track** tab (Shot Tracker + YOLOX flagship)
4. Phase 4 — **Train** tab
5. Phase 5 — **Coach** tab
6. Phase 6 — **Me** tab
7. Phase 7 — Cleanup (delete `kinetic-elite.css`, `kinetic-stitch.css`, `glassmorphism.css`, remove `body.ciq-active` gate)

### Hard rules

1. **Do not touch** `features/shot-tracking/shotDetection.js`, `yoloxWorker.js`, `shotService.js`, `adaptiveLearning.js`. The detection engine contract (`onShotDetected`, `onBallUpdate`, `onHoopDetected`, `onStatusChange`) is sealed. Only the wrapping UI changes.
2. **Do not touch** `models/basketball_yolox_tiny_v6.onnx` or `.onnx.data`. Load path (`features/shot-tracking/shotDetection.js:556`, `?v=6` cache-bust) stays.
3. **Do not touch** `js/supabase-client.js`, `js/data-service.js`, `sw.js`. Data layer + service worker are production-tested.
4. **Every tab ships behind its own flag.** Rollback = flip flag to `false` and reload. Nothing deleted until +3 days green.
5. **No feature loss.** Before each tab ships, a feature-parity matrix lives here listing every interactive element and data point the old panel(s) surfaced, ticked as rewired.
6. **Production edits go to `www/`**, not root (see "Source of truth" above).

### Panel → Tab mapping (feature parity anchor)

| New tab | Accent | Folds in existing panels |
|---|---|---|
| Home | amber | `db-panel-home`, `db-panel-log`, `db-panel-history`, `db-panel-notifications`, `db-panel-calendar` |
| Train | blue | `db-panel-training`, `db-panel-moves` |
| Track | green | `db-panel-shots`, `db-panel-summary` |
| Coach | purple | `db-panel-coach` |
| Me | teal | `db-panel-archetype`, `db-panel-social`, `db-panel-shop` + profile + avatar |

### Token conflicts with existing `styles/main.css` `:root`

Per `features/shot-tracking/v2/TOKEN_DIFF.md` there are 4 known value conflicts. Resolution for `courtiq-ui/tokens.css`: **use the Claude Design values as the new source of truth**, because every component we're building consumes them. Existing CSS that depended on the old values keeps working because the tokens in `main.css` stay (we don't touch them in Phase 1); if a legacy screen shows off-brand color, that's a Phase-N tab port bug, not a token bug.

### What changes will the user see in Phase 1?

Nothing, unless they flip the flag. Phase 1 lands the tokens, the components, the shell module, the flag object, and two new `<link>`/`<script>` tags in `www/dashboard.html`. With `COURTIQ_UI_V2.SHELL_ACTIVE === false` (default), everything renders exactly as today.

## 2026-04-20 — Phase 7 decisions (graduation)

All five tabs have shipped and been verified (Home, Track, Train, Coach, Me). Phase 7 graduates the v2 UI to default-on.

### What changed

- **`www/features/ui-v2/config.js`** is no longer a static `Object.freeze({...})`. It now reads the URL, resolves a mode, and freezes the right flag set. Defaults to `v2` — all 6 flags true — on every fresh session.
- **Emergency override**:
  - `?ui=v1` on any dashboard URL → all v2 flags force to `false`, legacy UI renders. Persists in `sessionStorage` for the tab's lifetime.
  - `?ui=v2` → force new UI (same as default).
  - Opening a fresh tab (no param) → v2.
- **`window.COURTIQ_UI_V2_MODE`** exposes the active mode for debugging: `"v1"` or `"v2"`.

### What was NOT done (intentionally deferred)

The original plan called for deleting `www/styles/kinetic-elite.css` (61 KB), `www/styles/kinetic-stitch.css` (78 KB), and `www/styles/glassmorphism.css` (57 KB) — totalling ≈ 196 KB of legacy CSS.

**Why deferred:** an audit found 157 unique `.ks-*` class names still referenced by `dashboard.html`. These come from the eight panels that are NOT yet fully ported to v2 and still render as legacy sub-views routed to from the v2 sub-navs:

| Sub-view | Reached from | Current look |
|---|---|---|
| `db-panel-log`            | Home sub-nav → Log          | Legacy (`.db-card`, `.ks-*`) |
| `db-panel-history`        | Home sub-nav → History      | Legacy |
| `db-panel-calendar`       | Home sub-nav → Calendar     | Legacy |
| `db-panel-notifications`  | Home sub-nav → Alerts · topbar bell | Legacy |
| `db-panel-moves`          | Train sub-nav → Moves       | Legacy |
| `db-panel-summary`        | (hidden in v2 Track but stats sync) | Legacy |
| `db-panel-coach` (form)   | Coach tab (v2 chat intro wraps it)  | Mixed — form re-skinned, inputs still legacy |
| `db-panel-social`, `db-panel-shop` | Me sub-nav → Social/Shop | Legacy |

Deleting the three CSS files today would visually break all of these. Cleanup must come *after* each of the eight sub-views is either ported to a v2 aesthetic or consciously retired.

**Safe next steps** (each independent of the others):

1. Inventory which `.ks-*` classes each sub-view actually uses (grep-able). Classes used by only *one* sub-view are cheap to migrate into a small `courtiq-ui/tabs/<tab>-legacy.css` override file; then the big legacy file shrinks.
2. Port `db-panel-log` and `db-panel-history` into `home.js` sub-views rendered with `ciq-*` components — these are the highest-visibility legacy views because they hang off Home.
3. Port `db-panel-moves` into `train.js` sub-view.
4. Retire `db-panel-shop` and `db-panel-social` or re-skin them — they're low-priority tabs.
5. After all sub-views are off legacy CSS, delete the three files and strip the 157 class refs from `dashboard.html`.
6. Remove `body.ciq-active` gate in `components.css` and tab CSS — `ciq-*` becomes the only design system.

### What the build looks like now

- **Default experience**: v2 shell + 5 full tab ports + purple/amber/green/blue/teal accents.
- **Rollback path**: `?ui=v1` query param (or edit `config.js` DEFAULT_FLAGS for a production rollback).
- **Hard rules from the plan still enforced**:
  - No changes to `features/shot-tracking/*.js`, `yoloxWorker.js`, `models/*.onnx`, `shotService.js`, `adaptiveLearning.js`.
  - No changes to `js/ai-coach.js`, `drill-engine.js`, `player-profile.js`, `social-hub.js`, `badges.js`, or the Supabase data layer.
  - www/ remains the single production source of truth; no root edits during phases 1–7.

### Known cosmetic issues to fix in follow-up

- Coach tab: legacy "AI Coach Adjustment" heading sits awkwardly close to the v2 "COACH." title. One of them should go (probably the legacy; but that requires verifying `coach-gen-btn` isn't tied to any label).
- Me tab: the legacy `#db-panel-archetype` Three.js avatar still initializes in the background even when the panel is hidden, which can hang the renderer on slow devices. In a follow-up, lazy-init Three.js only when `body.ciq-tab-archetype` or the legacy panel becomes visible.

## Appendix — migration artifact trail

| Phase done | Delete after +3 days green |
|---|---|
| Phase 2 (Home) | Home/Log/History/Notifications/Calendar legacy panel CSS blocks in `main.css` |
| Phase 3 (Track) | `features/shot-tracking/v2/shot-tracker-v2.css` + `shot-tracker-v2-type.css` (absorbed into `courtiq-ui/tabs/track.css`); retire `.stv2-active` scope |
| Phase 4 (Train) | Training/Moves panel CSS blocks |
| Phase 5 (Coach) | Coach panel CSS blocks |
| Phase 6 (Me) | Archetype/Social/Shop panel CSS blocks |
| Phase 7 | `www/styles/kinetic-elite.css` (61 KB), `www/styles/kinetic-stitch.css` (78 KB), `www/styles/glassmorphism.css` (57 KB); remove `body.ciq-active` gate; flags collapse to `window.COURTIQ_UI_V2.ENABLED = true` or are removed |

