# CourtIQ — Design Brief for claude.ai/design

> Paste the section below ("PROMPT FOR CLAUDE.AI/DESIGN") into your CourtIQ project at https://claude.ai/design as the opening message. Everything above the divider is for your reference; everything below is for the design AI.

---

## PROMPT FOR CLAUDE.AI/DESIGN

You are taking over as the senior product designer for **CourtIQ**, an AI-powered basketball training PWA built for mobile. The app exists, ships, and works — your job is **not** to start from scratch. Your job is to **diagnose what feels wrong, propose a redesign roadmap that covers every surface in the app, and then iterate per-screen with me until each surface is best-in-class**.

Before you generate any code or screens, **read this whole brief, ask any clarifying questions you have, and respond with a 1-page design critique + redesign roadmap that names every screen and sub-page**. Only after I confirm the roadmap should you start designing screens.

---

### 1. The product

CourtIQ is a basketball training app for serious amateurs and semi-pros. Three primary jobs-to-be-done:

1. **Track shots automatically** — phone propped up, AI (YOLOX-tiny v6 via Web Worker) detects every shot attempt + outcome, plots heatmap and zones. This is the showcase feature.
2. **Train with structured drills** — daily workout, drill library filtered by skill × difficulty, in-session player with timer + audio cues.
3. **Get AI feedback** — weekly performance form → AI coach returns a verdict and recommended drills.

It's also social-light (leaderboards, challenges, badges, XP), gamified (streak, daily challenge, level, archetype), and has a shop for cosmetic items + equipment. The user is signed in via Supabase auth.

The app is a vanilla HTML/CSS/JS PWA (Capacitor-wrapped Android). The design system source-of-truth lives in claude.ai/design as React/JSX. After each iteration here I port the result into vanilla JS for the production app.

---

### 2. The 5-tab architecture (locked — do not propose changing)

| Tab | Accent token | Hex | Job-to-be-done |
|---|---|---|---|
| **Home** | `--c-home` | `#f5a623` (amber) | "What should I do right now?" |
| **Track** | `--c-track` | `#56d364` (green) | "How am I shooting?" — Shot Tracker flagship |
| **Train** | `--c-train` | `#4ca3ff` (blue) | "What's my workout?" |
| **Coach** | `--c-coach` | `#bc8cff` (purple) | "What does coach say?" |
| **Me** | `--c-me` | `#2dd4bf` (teal) | "Who am I as a player?" |

Plus dim variants (`--c-home-dim` etc.) for inactive accents. Plus a global top bar (CourtIQ logo + profile + notifications icons) and a bottom nav (5 tabs, active = full-saturation accent).

---

### 3. Design language already in production

**Tokens** (`colors_and_type.css`, 96 properties):
- Background `--c-bg` very dark; `--c-white #f0ede6`; `--c-muted` ~50% white
- Glass: `--glass-bg rgba(22,25,33,0.7)`, `--glass-border rgba(255,255,255,0.08)`, `--glass-blur 20px`
- Radii: `--r-sm 10 / --r-md 16 / --r-lg 24 / --r-xl 32`
- 10 named shadow scales including `--shadow-card`, `--shadow-amber`, `--shadow-btn`
- Fonts: `Barlow Condensed` 400–900 (display, italic uppercase) + `Lexend` variable (body)

**Components** (12 `.ciq-*` classes already in `ui-kit.css`):
`.ciq-screen .ciq-eyebrow .ciq-title .ciq-glass .ciq-topbar .ciq-icon-btn .ciq-bottom-nav .ciq-nav-item .ciq-primary-btn .ciq-secondary-btn .ciq-stat-tile .ciq-row`

**Templates** (Phase 10.0.B — every surface picks one):
1. **HeroPage** — tab landings (Home, Track, Train, Coach, Me)
2. **ListPage** — browse screens (drill library, sessions, leaderboard, history, alerts)
3. **DetailOverlay** — fullscreen modals (Workout Player, Live Camera Tracker)
4. **BottomSheet** — quick-action modals (Settings, confirm dialogs, Share)
5. **EmbeddedSection** — sub-views inside a tab (Calendar inside Home, Heatmap inside Track)

**Icon system** (Phase 10.0.A — single source of truth, **closed set**):
- 16 custom basketball icons: `shooting, ballhandling, defense, athleticism, conditioning, zonePaint, zone3pt, zoneMidrange, statFg, statStreak, statXp, badgeTrophy, badgeMedal, badgeTarget, badgeStar, courtRim`
- 20 generic UI icons (Phosphor-inspired): `home, calendar, mail, logout, settings, share, upload, camera, play, pause, chevronRight, x, search, filter, arrowUpRight, plus, check, info, alert, lock, bell`
- All 24×24 viewBox, currentColor, 1.75px stroke, rounded caps. Single weight.
- **No emoji in interactive UI. No Lucide. No mixing.**

**Hierarchy rules** (Phase 10.0.C):
- 3 CTA levels: `.ciq-cta--primary` (accent fill, shadow, italic uppercase), `.ciq-cta--secondary` (glass border), `.ciq-cta--tertiary` (text only), plus `.ciq-cta--danger` (red-tinted, for destructive)
- 3 heading levels: H1 48px italic, H2 28px italic, H3 18px upper
- 3 density modes: `comfy` (24px gaps), `normal` (16px), `compact` (10px)
- Only the **active tab's accent** renders at full saturation. All other accents in view dim to ~60%.

---

### 4. FULL FEATURE INVENTORY — every screen, sub-page, modal, and interactive element

This is the **complete surface map**. Your roadmap must address every row. Where status = "shipped", design refinement only. Where status = "partial", finish + redesign. Where status = "legacy", port it into the v2 design language.

#### 4.1 Global chrome (every tab)

| Element | Status | Notes |
|---|---|---|
| Top bar — CourtIQ logo + profile shortcut + notifications bell | shipped | 80px tall, glass background, safe-top respected. Profile shortcut → Me tab. Bell → Home → Alerts. |
| Bottom nav — 5 tab chips with accent dot when active | shipped | 5 tabs always visible. Active = full-saturation accent + dot indicator. Tap → routes via `dbSwitchTab` + `CIQ_SHELL.switchTo`. |
| Status overlay — streak fire, XP gain toast | shipped | Streak counter pulses on each session log. XP toast slides in bottom-right after Supabase write. |

#### 4.2 Home tab (amber)

| Surface | Sub-route | Purpose | Template | Status |
|---|---|---|---|---|
| **Today** (default) | — | "What should I do right now?" Daily Challenge + Streak/Level + 3 most recent sessions or upcoming events | HeroPage | shipped, needs polish |
| **Log Session** | log | "Log what I just did in 30 seconds." Form per drill type, auto-detect last session's drills, submit + dismiss | ListPage | **legacy** — currently routes to `db-panel-log` with old `.ks-*` styling |
| **History** | history | "Look at past sessions." Sessions grouped by week, tap to expand to drill breakdown | ListPage | **legacy** — routes to `db-panel-history` |
| **Calendar** | calendar | "Plan future sessions." Month grid → week strip → day detail. "Schedule Session" CTA. | EmbeddedSection | partial |
| **Alerts** (Notifications) | alerts | "What changed since I last opened the app?" Notification rows: icon + title + time + dismiss. Empty state: "All caught up." | ListPage | **legacy** — routes to `db-panel-notifications` |

**Home interactive elements:**
- Daily Challenge card → tap accepts challenge, sets `currentChallenge` state, deep-links to Train Today
- Streak fire counter → tap shows streak history modal (small)
- Level/XP card → tap routes to Me → Profile
- Recent session row → tap routes to Track → Sessions detail
- Notification row → tap dismisses or routes to relevant tab

**Home data sources:** `dashboard.js` (panel state), `notifications.js`, `streak.js`, `daily-challenge.js`, `ai-coach.js` (log feedback path), Supabase `sessions` table.

#### 4.3 Track tab (green) — Shot Tracker flagship

| Surface | Sub-route | Purpose | Template | Status |
|---|---|---|---|---|
| **Lab** (default) | — | "How am I shooting?" Field Goal % hero KPI, stat tiles, primary CTA "Launch Camera", secondary "Upload Video" | HeroPage | shipped, needs polish |
| **Heatmap** | heatmap | "Where do I score from?" Half-court SVG with hot/cold gradient, optional zone overlay legend | EmbeddedSection | shipped, needs Phase 10 polish |
| **Zones** | zones | "Make % per zone." 7-zone grid (paint, mid-range L/R, top of key, 3pt L/C/R) showing make/attempts ratio per zone | EmbeddedSection (inside Heatmap or stand-alone) | shipped, needs polish |
| **Sessions** | sessions | "Replay past sessions." List of past sessions with drill-by-drill breakdown on expand | ListPage | shipped, needs polish |
| **Live Camera** | (overlay) | "Track shots live." Fullscreen camera with HUD: status pill, made/missed counter, latest detection box | DetailOverlay | shipped — **engine is sealed**, only HUD restyle is in scope |

**Track interactive elements:**
- "Launch Camera" → asks permission, opens Live Camera DetailOverlay, mounts `ShotTrackingScreen.js`
- "Upload Video" → file picker, processes via same engine
- Heatmap zone tap → filters Sessions list by zone
- Session row tap → expands to drill breakdown OR navigates to Sessions detail
- Live Camera close → confirms if session in progress

**Track data sources:** `features/shot-tracking/ShotTrackingScreen.js`, `shotDetection.js` **(sealed — do not redesign callbacks)**, `yoloxWorker.js` **(sealed)**, `shotService.js` **(sealed — Supabase persistence)**, `adaptiveLearning.js`, `shot-analysis.js`, `progress-charts.js`, `heatmapGenerator.js`. Model: `models/basketball_yolox_tiny_v6.onnx` (~20MB).

#### 4.4 Train tab (blue)

| Surface | Sub-route | Purpose | Template | Status |
|---|---|---|---|---|
| **Today** (default) | — | "What's my workout today?" Today's challenge with progress, sets done, next drill | HeroPage | shipped, needs polish |
| **Drill Library** | drills | "Pick a drill to work on." | ListPage (with filters) | **shipped, refresh needed** — currently re-skinned legacy |
| **Generator** | generator | Filter drills by Focus (Shooting/Ball Handling/Defense/Athleticism) × Difficulty (Beginner/Intermediate/Advanced). Drill cards with focus icon, name, sets, time, "Add" CTA + tap-to-start | ListPage | shipped (Phase 8.4), needs Phase 10 polish |
| **Moves Library** | moves | "Learn signature moves." Each move row has thumbnail + animation play affordance | ListPage | **legacy** — uses `move-library.js` styling |
| **Lab** | lab | Experimental drills (small surface) | EmbeddedSection or chip in Today | shipped (legacy) |
| **Night Training** | night | Low-light + audio-cued drills (small surface) | EmbeddedSection or chip | shipped (legacy) |
| **Workout Player** | (overlay) | "Run this drill now." Fullscreen overlay with current set/rep, big timer, Next / Skip / Pause + progress bar. Audio cues. | DetailOverlay | **shipped, redesign needed** |

**Train interactive elements:**
- Today's challenge → "Start" CTA → opens Workout Player overlay with today's drill
- Drill card in Generator → "Add to Today" CTA → calls `drillToggleSave(id)` (legacy)
- Drill card body tap → opens Workout Player for that drill via `drillWorkoutOpen(id)` if available
- Filter chip toggle → re-renders list with debounce
- Workout Player Pause/Skip/Next → wired to `workout-timer.js` engine
- Drill rec from Coach → arrives via `sessionStorage['ciq-pending-drill']` → Generator scrolls to + outline-pulses the matching card

**Train data sources:** `drill-engine.js` (legacy, 4257 lines, **off-limits for refactor — restyle only**), `drill-animations.js`, `daily-workout.js`, `move-library.js`, `move-animations.js`, `workout-timer.js`, `night-training.js`, `training-panel.js`, `lab-panel.js`, `sound-effects.js`.

#### 4.5 Coach tab (purple)

| Surface | Sub-route | Purpose | Template | Status |
|---|---|---|---|---|
| **Coach** (default) | — | "What does coach say to do next?" Latest insight verdict + supporting bullets + 2 recommended drills + CTA "Update This Week" | HeroPage with **Insight Card** pattern | **just rebuilt — user didn't love it, needs redesign** |
| **Update Performance** | update | "Tell coach what I did last week." Form: 4 categories (likely shooting / handling / defense / athleticism) — sliders or steppers, NOT number inputs | ListPage (form pattern) | partial — form is legacy from `db-panel-coach`, only chrome restyled |
| **Insight History** | history | "What did coach say in the past?" Chronological list of past insights | ListPage | **NOT YET BUILT** — Phase 10.1 surface |

**Coach interactive elements:**
- "Update This Week" CTA → scrolls to Update Performance form
- Drill rec row tap → routes to Train via `sessionStorage['ciq-pending-drill']` + `dbSwitchTab('training')` + `CIQ_SHELL.switchTo('train')`
- Form submit (`coach-gen-btn`) → posts to `ai-coach.js` → returns new insight + new drill recs
- "View History" CTA on Insight Card → opens Insight History sub-page

**Coach data sources:** `js/ai-coach.js` **(sealed — submission flow + Anthropic bridge are off-limits)**, Supabase `coach_insights` table.

#### 4.6 Me tab (teal)

| Surface | Sub-route | Purpose | Template | Status |
|---|---|---|---|---|
| **Profile** (default) | — | "Who am I as a player?" Hero = name + position + 3-stat strip. Secondary = trophy carousel (NOT 4 emoji boxes) + Archetype card | HeroPage | shipped, needs polish |
| **Trophies** | trophies | "All my badges." Custom badge SVG per achievement. Earned/locked clearly distinguished. Replaces the carousel-only view on Profile. | ListPage | **NOT YET BUILT as full sub-page** — only the carousel exists on Profile |
| **Social** | social | "How do I rank?" Top 10 leaderboard (avatar + rank + XP), Active Challenges card, Send Challenge / Copy Link CTAs | ListPage | shipped, needs polish + CTA icon work |
| **Shop** | shop | "Spend XP on cosmetics." Item rows with thumbnail + price + buy CTA. Coin wallet at top. | ListPage | **legacy** — needs port |
| **Archetype** | archetype | "What kind of player am I?" Archetype chart + traits (Phase 8 deferred but still in legacy) | EmbeddedSection on Profile or sub-page | shipped (legacy) |
| **Settings** | (sheet) | "Manage my account." 5 rows: Email (read-only), Sign Out, Notifications, About, Help | BottomSheet | shipped (Phase 8.3), needs polish |
| **Avatar 3D** (Three.js) | (overlay) | "Customize my avatar." 3D canvas with cosmetics | DetailOverlay | shipped (legacy) — **Three.js canvas is sealed**, only chrome restyle |

**Me interactive elements:**
- Account row on Profile → opens Settings BottomSheet
- Sign Out button → calls `sb.auth.signOut()` from `supabase-client.js`
- Trophy in carousel → opens Trophies sub-page or trophy detail
- Leaderboard row → opens user mini-profile (small modal)
- Send Challenge CTA → opens challenge composer (small sheet)
- Copy Link CTA → copies to clipboard, flash toast confirmation
- Shop item → opens buy confirmation sheet, deducts XP/coins
- Avatar in profile hero → opens Avatar 3D overlay

**Me data sources:** `player-profile.js`, `player-analysis.js`, `avatar-customizer.js`, `avatar-builder.js`, `avatar-3d.js` (Three.js — sealed), `social-hub.js` **(sealed — Supabase realtime)**, `badges.js`, `gamification.js`, `pricing.js`.

#### 4.7 Cross-tab interactions

- **Drill rec routing**: Coach → Train via `sessionStorage['ciq-pending-drill']` (id, name, ts), expires 30s. `train-drill-generator.js` watches for body class change to `ciq-tab-train` and scrolls + pulses the matching card.
- **Daily Challenge → Train Today**: Home `Daily Challenge` accept → Train Today gets the challenge as today's primary action.
- **Session row tap on Home recent → Track Sessions detail**: deep-link via shared session ID.
- **Tab switch animation**: Currently none. Open question for the redesign.

#### 4.8 Modals + system surfaces

| Modal | Trigger | Template |
|---|---|---|
| Workout Player | Train Today "Start" or Drill Generator card body | DetailOverlay |
| Live Camera Tracker | Track Lab "Launch Camera" | DetailOverlay |
| Avatar 3D Customizer | Me Profile avatar tap | DetailOverlay |
| Settings sheet | Me Profile Account row | BottomSheet |
| Send Challenge composer | Me Social "Send Challenge" | BottomSheet |
| Buy confirmation | Me Shop item tap | BottomSheet |
| Drill detail | Generator card tap (long-press alt) | BottomSheet |
| Streak history | Home streak counter tap | BottomSheet |

#### 4.9 Empty states + loading states (every surface should have both)

- Empty: icon (basketball-native, 32px) + h2 italic title + body sub + optional CTA. Single CSS class `.ciq-empty`.
- Loading: spinning custom basketball icon (16px) + small italic uppercase label. Single CSS class `.ciq-loading`.
- Error: not yet defined — propose if needed.

---

### 5. Why this brief exists — the diagnosis you should validate

After three phases of redesign work, the app still reads as **generic and AI-shaped**. Specific symptoms I want you to confirm or disprove:

1. **Tab landings don't have a clear "what now" answer.** Each one shows ~5 cards of equal weight. There's no hero — no one big thing the user is here to do.
2. **Density is uneven.** Some screens cram; others have empty padding. The 3-mode system exists in CSS but isn't applied with intent.
3. **Sub-pages are still legacy.** Home → Log/History/Alerts and Train → Moves and Me → Shop break out of the design language. Jarring.
4. **Coach felt like a chatbot, not a coach.** I rebuilt it as an Insight Card pattern (verdict headline + bullets + drill recs) but it felt template-y, not premium.
5. **Five saturated accents compete.** Even with the saturation rule in CSS, in practice every screen has multiple full-saturation accent moments.
6. **Empty + loading states vary.** Each screen rolls its own. The unified template exists but isn't applied.
7. **Action button hierarchy isn't enforced visually** — primary/secondary/tertiary blur together because they're all glass-ish.
8. **No basketball-native moments.** The app feels like a wellness/productivity app reskinned for hoops. Where's the **swagger**? Where's the moment that makes a player open it twice a day?

---

### 6. Hard constraints (do not break)

- **Vanilla JS port.** Whatever you design will be ported to vanilla DOM construction (no React in production). Avoid Tailwind utility soup or shadcn primitives that don't translate. Plain CSS classes + semantic markup.
- **Tokens, fonts, accent palette are locked.** You can introduce new sub-tokens (e.g. `--accent-ghost`) if justified, but the 5 nav accents and base palette stay.
- **Templates are the unit of design.** Every page picks one of HeroPage / ListPage / DetailOverlay / BottomSheet / EmbeddedSection. If you think a 6th template is needed, propose it explicitly and justify.
- **Icon set is closed.** Use only the 36 icons listed above. If you absolutely need a new one, add it to the basketball-native or generic group with the same stroke weight + viewBox + cap rules.
- **Sealed code paths** — UI restyle ok, internals off-limits:
  - YOLOX shot detection contract (Track Live Camera HUD restyle ok, detection callbacks off-limits)
  - `js/ai-coach.js` form submission flow (Coach form chrome restyle ok, fields/handlers off-limits)
  - `js/drill-engine.js` (drill catalog / engine off-limits)
  - `js/social-hub.js` (Supabase realtime off-limits)
  - `js/data-service.js`, `js/supabase-client.js`, `sw.js`
  - Three.js avatar canvas in `avatar-3d.js`
- **Mobile-first.** Target 390×844 (iPhone 14). Tablet/desktop are not in scope. Every interactive element ≥44px tap target.
- **Per-tab feature flag.** Every redesign ships behind its own flag in `window.COURTIQ_UI_V2`. Reversible per-tab.

---

### 7. Reference material in the artifact

You have access to the existing artifact in this same project. **Read these files first before designing anything:**

- `colors_and_type.css` — all 96 tokens + @font-face declarations
- `ui_kits/mobile-app/ui-kit.css` — the 12 `.ciq-*` component classes
- `ui_kits/mobile-app/Icons.jsx` — icon set
- `ui_kits/mobile-app/Chrome.jsx` — top bar + bottom nav components
- `ui_kits/mobile-app/Screens.jsx` — HomeScreen, TrainScreen, TrackScreen, CoachScreen, MeScreen, ShotTrackerCam (the existing baseline)
- `ui_kits/mobile-app/ios-frame.jsx` — iPhone frame (reference only)

These screens are the visual baseline I want you to **match or exceed**.

---

### 8. What I want from you, in order

**Step 1 — Diagnosis (this turn).** Read every artifact file. Write a 1-page critique:
- Confirm or push back on the 8 symptoms in §5
- Identify any I missed
- Pick the 2–3 highest-leverage problems — the ones that, if solved, lift everything else

**Step 2 — Roadmap (this turn or next).** Propose:
- A redesign plan that **names every surface in §4** (4.2 through 4.6) — for each, mark: REDESIGN (rebuild) / REFINE (polish) / KEEP (already good) / PORT (move legacy into v2)
- Order: in what sequence should we rebuild them?
- The "design move" for each surface — one-line description of the visual idea (e.g. "Coach landing becomes a verdict card with one big readable line, the way a personal trainer would actually talk")
- Any new sub-tokens, templates, or icons you need to add (with justification)
- The micro-interaction budget — what gets motion, what stays static, what the **one signature flourish** is for the whole app

**Step 3 — Per-surface iteration (after I confirm the roadmap).** For each surface, in the order from Step 2:
1. Sketch the screen as JSX in the artifact (use the existing token + component language)
2. Show me the screen
3. Iterate on my feedback until I approve
4. Move on to the next surface

Do not skip Step 1 and Step 2. I'd rather spend the first hour on the right diagnosis than the first hour on a beautiful screen that's solving the wrong problem.

---

### 9. Inspiration / vibes

The app should feel like:
- **Nike Training Club's intensity**, but without its fitness-influencer cheesiness
- **Strava's data clarity**, but with attitude (italic display type already gives us that)
- **Apple Sports' typography hierarchy**, but darker and grittier
- A basketball player's gym bag — purposeful, no clutter, every item earned

Avoid:
- Wellness-app softness (no pastel gradients, no rounded everything)
- AI-product tropes (no chat bubbles unless absolutely warranted, no gradient halos as a default)
- Default shadcn / MUI / generic component library aesthetics

---

### 10. Open question to settle in the diagnosis

The user has expressed that the redesign-so-far feels generic. **What do you think makes a basketball app feel basketball, beyond just adding court icons?** Argue your position in the critique. I want a designer with a point of view, not an order-taker.

---

**OK — start with §8 Step 1 (diagnosis). Read the artifact, write the critique. Don't generate any new screens yet.**
