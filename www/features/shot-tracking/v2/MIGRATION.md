# Shot Tracker v2 — Migration Log

Source design bundle: `_design-import/shot-tracker-v2/` (unzipped from
"Shot Tracker v2 — Camera Detection Flow.zip").

## Status

- [x] Phase 0 — recon report + rename mapping (conversational, no files)
- [x] **Phase 1 — CSS drop-in + flag gate + <link>, zero JS changes** ← this commit
- [ ] Phase 2 — Screen 2 Active vanilla-JS port + state adapter + engine hooks
- [ ] Phase 3 — flip `SHOT_TRACKER_V2.ACTIVE_SCREEN = true`, browser verify
- [ ] Phase 4 — Screen 1 Setup port + flag flip
- [ ] Phase 5 — Screen 4 Summary port, XP/alerts/zone parity, flag flip
- [ ] Phase 6 — Screen 3 Replay port + flag flip
- [ ] Phase 7 — delete old `features/shot-tracking/shot-tracking.css`, remove flags

## Phase 1 deliverables (this commit)

| File | Purpose |
|---|---|
| `v2/shot-tracker-v2.css` | Component CSS, every class prefixed `.stv2-*`, keyframes prefixed `stv2-*` |
| `v2/shot-tracker-v2-type.css` | `@font-face` (self-hosted) + scoped token overrides |
| `v2/config.js` | `window.SHOT_TRACKER_V2 = { … }` flag object — all flags OFF |
| `v2/TOKEN_DIFF.md` | 4 value conflicts + 1 alias + 10 new tokens, documented |
| `v2/MIGRATION.md` | This file |
| `index.html` | Two `<link>` tags + one `<script>` tag for config |

Zero changes to `ShotTrackingScreen.js`, `shotDetection.js`, any other JS, or
`styles/main.css`. If `SHOT_TRACKER_V2.ACTIVE_SCREEN === false` (default),
the existing feature is bit-for-bit unchanged.

Verification plan: load the app in the browser; dashboard + every current
screen render identically to the pre-commit state; no console errors; the
two new CSS files are fetched successfully; fonts download from local
`brand-fonts/` directory, not Google Fonts CDN.

## Font strategy

Self-hosted from `brand-fonts/` (option B in the Phase 0 discussion).
Verified byte-identical (sha256) against the `fonts/` folder in the design
zip — same files, so zero risk of visual drift. Reason for self-hosting:
Capacitor app must run offline at gyms; no CDN round-trip; no FOUT.

Weights available in `brand-fonts/`:
- Lexend — variable font, `wght` axis covers 100–900 (we only need 400–900)
- Barlow Condensed — static weights 400/500/600/700/800

Design requires Barlow Condensed up to 900 in some places (`stat-huge`,
cell numerals). `brand-fonts/` tops out at 800 (ExtraBold). In practice
CSS `font-weight: 900` falls back to the heaviest available (800), which
looks identical on small sizes but slightly lighter on the huge italic
session numbers. Deferred decision — add a `Black` weight only if
Phase 3 review shows a visual regression at 44+ px.

## Engine contract (preserved verbatim from recon)

Callbacks assigned on `window.ShotDetectionEngine` before `engine.start(video)`:

- `onShotDetected(data)`
  `data = { result: 'made'|'missed', shotX, shotY, trajectory[], launchPoint: {x, y}, shotZone: 'paint'|'midrange'|'threePoint'|'freeThrow', timestamp }`
- `onBallUpdate(pos | null)`
  `pos = { normX, normY, source: 'ml'|'color'|'predicted', confidence }`
- `onHoopDetected(hoop)`
  `hoop = { cx, cy, bw, bh, score }` — all normalized 0–1
- `onStatusChange(status)`
  `'loading'|'retrying'|'ready'|'color-only'|'detecting'|'detecting-learned'|'error'|'stopped'`

Live reads: `engine.stats.made`, `engine.stats.attempts`, `engine.ballPosition`,
`engine.rimZone`, `engine.threePtDistance`.

Mutators: `engine.setRimZone(nx, ny, nw, nh)`, `engine.setThreePtDistance(d)`,
`engine.start(videoEl)`, `engine.stop()`, `engine.init()`, `engine.resetStats()`.

**None of the above are touched in Phase 1, and none will change in any
subsequent phase.** The engine is a sealed black box.

## State adapter spec (Phase 2)

Mapping from engine state machine to UI state pill:

| Engine state | UI state | Duration in UI |
|---|---|---|
| `idle` | `ready` | persistent |
| `shot_started` | `detected` | persistent (engine caps at ≤3 s before reverting to idle) |
| `near_hoop` | `tracking` | persistent (engine caps at ≤2 s before counting) |
| `_countShot('made')` fires | `scored` | **800 ms fixed, UI-only timer** |
| `_countShot('missed')` fires | `miss` | **800 ms fixed, UI-only timer** |
| `cooldown` (engine 1500 ms) | `ready` | (UI already back at 800 ms, engine continues cooling for another 700 ms) |

The UI timer is intentionally shorter than the engine cooldown so the
overlay feels responsive. The engine is free to take its time.

### Edge case: rapid-fire shots

If `onShotDetected` fires while the 800 ms `scored`/`miss` timer from a
previous shot is still running:

1. Call `clearTimeout(pendingStateTimer)` immediately.
2. Set UI state to the new outcome (`scored` or `miss`).
3. Start a fresh 800 ms timer from zero.
4. Do **not** let the UI collapse to `ready` between the two shots.

This matters for drill modes where a player reloads and releases in under
a second — the overlay must reflect each shot's outcome without a jarring
flicker to `ready`.

### Lifecycle cleanup

On `ShotTrackingScreen.close()` / unmount:

1. `clearTimeout(pendingStateTimer)` — no zombie timers.
2. Null the callbacks on the engine (or rely on `engine.stop()` which the
   screen already calls).
3. Remove `.stv2-active` from `#shot-tracking-screen`.
4. Leave config flags untouched — they persist across screen open/close
   within a session so the user's experience is consistent.

## Known gaps carried forward

### v2.1 — Landscape adaptation
Portrait-locked for v2.0. Court-side shooting is common; when landscape
lands, the layout must adapt:
- Stat card moves to a side rail (top-left → left-center, narrower)
- State pill stays bottom-center but narrows; `+1` badge stacks below
- Bottom action bar wraps or relocates to a right-edge column
No implementation in v2.0.

### v2.1 — Token promotion
The 10 new section-accent tokens (`--c-home`, `--c-train`, `--c-track`,
`--c-coach`, `--c-me`, and their `-dim` variants) live in the scoped
`#shot-tracking-screen.stv2-active` block. Once another feature adopts
the bottom-nav section system, promote them to the global `:root` in
`styles/main.css` and delete from the scoped block.

### v2.1 — Barlow Condensed Black (900)
If Phase 3 browser review at real device sizes reveals that the huge
italic session numbers (`14/18`, `78%`) look too light when CSS
`font-weight: 900` falls back to the available 800, add a
`BarlowCondensed-Black.ttf` to `brand-fonts/` and register a 900
`@font-face`. Deferred until observed.

### v2.1 — Screens 1, 3, 4
Design exists in `_design-import/shot-tracker-v2/` but flags default
off until each is ported. Screen 4 must reach feature parity with
`renderSummary` — specifically the XP grant, smart alerts, and
zone-breakdown sections — before its flag flips.

## Rollback

If Phase 1 ships and causes any regression:

1. In `index.html`, remove the three new `<link>` / `<script>` tags.
2. Delete `features/shot-tracking/v2/` folder.
3. No other files were modified; no revert needed elsewhere.
