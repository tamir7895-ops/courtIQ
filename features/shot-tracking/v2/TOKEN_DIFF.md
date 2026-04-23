# Shot Tracker v2 — Token Diff Reference

Every design-system token whose value differs from the current `styles/main.css`
`:root`, plus the naming-alias case. Zero-conflict tokens omitted.

Resolution legend:
- **scoped** — v2 design value wins, applied only while `#shot-tracking-screen.stv2-active` is mounted
- **merged** — identical value or safe merge into global `:root`
- **kept-main** — main.css value wins, design value discarded
- **alias** — same meaning, different name, both exposed

---

## Value conflicts (same token name, different value)

| Token | Current main.css | Design zip | Resolution |
|---|---|---|---|
| `--c-muted` | `rgba(240,237,230,0.60)` | `rgba(240,237,230,0.45)` | **scoped** — design value (a bit brighter muted on the glass overlay reads better) |
| `--c-dimmer` | `rgba(240,237,230,0.38)` | `rgba(240,237,230,0.22)` | **scoped** — design value (matches the made/attempts `78%` subdued contrast) |
| `--font-display` | `'Lexend', 'Barlow Condensed', sans-serif` | `'Barlow Condensed', 'Impact', sans-serif` | **scoped** — Screen 2's huge italic session stats (`14/18`, `78%`) depend on Barlow Condensed as primary, not fallback |
| `--font-body` | `'Lexend', 'Barlow', sans-serif` | `'Lexend', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | **scoped** — same primary (Lexend); design widens the system fallback chain which is safer on Android Capacitor where `'Barlow'` may not exist |

## Naming alias (same value, different name)

| Token (design) | Token (main.css) | Value | Resolution |
|---|---|---|---|
| `--c-surface-elev` | `--c-surface-elevated` | `#1c1f28` | **alias** — v2 scope defines `--c-surface-elev: var(--c-surface-elevated)` so any ported JSX that still references the short name works |

## New tokens the design adds (not in main.css)

These don't conflict with anything but are referenced by v2 component CSS and
Screen 2's JSX. Defined in the scoped block to avoid polluting the global
`:root`; promotion to global is a v2.1 task (see MIGRATION.md).

| Token | Value | Used for |
|---|---|---|
| `--c-home`       | `#f5a623` | Bottom-nav Home accent (future Screen 1/4) |
| `--c-train`      | `#4ca3ff` | Train section accent |
| `--c-track`      | `#56d364` | Track section accent (Screen 2 primary green) |
| `--c-coach`      | `#bc8cff` | Coach section accent |
| `--c-me`         | `#2dd4bf` | Me section accent |
| `--c-home-dim`   | `rgba(245,166,35,0.12)` | Home accent backing |
| `--c-train-dim`  | `rgba(76,163,255,0.12)` | Train accent backing |
| `--c-track-dim`  | `rgba(86,211,100,0.12)` | Track accent backing (Screen 2 stat card tint) |
| `--c-coach-dim`  | `rgba(188,140,255,0.12)` | Coach accent backing |
| `--c-me-dim`     | `rgba(45,212,191,0.12)` | Me accent backing |

## Tokens in main.css but NOT in design zip

No action required. The v2 layer inherits the global `:root` so these stay
available to any styles outside the v2 prefix. Listed for completeness:
`--c-orange`, `--c-orange-dim`, all `--c-feature-*` tokens (12 of them).

---

**When Screens 1/3/4 land:** re-run this diff against their respective CSS
(`Screen1_Setup.jsx`, `Screen3_Replay.jsx`, `Screen4_Summary.jsx` — the last
may introduce new tokens for the shot-chart SVG or zone heatmap). Any new
row added here must be accompanied by a resolution column update.
