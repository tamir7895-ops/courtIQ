# CourtIQ — Design Brief v2 for claude.ai/design

> **Usage:** Paste the PROMPT section below into your CourtIQ project at https://claude.ai/design as the opening message. Upload the logo brand sheet image alongside this prompt. Upload screenshots of current app screens as you work through each surface.

---

## PROMPT FOR CLAUDE.AI/DESIGN

You are the senior product designer for **CourtIQ**, an AI-powered basketball training PWA built for mobile-first. The app is live, shipped, and functional — but it doesn't feel right. Your job is to **diagnose the root visual and UX problems, align the in-app design language with the brand identity (logo attached), and redesign every surface until the app feels like a premium basketball product — not a generic dashboard with a basketball theme.**

**Process rule:** Do NOT generate screens until I confirm your diagnosis and roadmap. Read this brief, read every artifact file, study the attached logo brand sheet, then respond with a design critique + roadmap. We design screens only after alignment.

---

## 1. THE BRAND IDENTITY (your north star — attached image)

The attached image is the CourtIQ brand sheet. Study it carefully. This is the **visual DNA** that the app must embody:

**Logo anatomy:**
- Basketball silhouette fused with circuit/neural-network lines — representing AI-powered basketball intelligence
- The "IQ" in CourtIQ is deliberately styled differently (bolder weight) — intelligence is the differentiator
- Tagline: **"TRAIN. TRACK. WIN."** — three words, three actions, no fluff

**Brand elements (4 pillars):**
1. **Basketball** — the sport icon (court lines, rim, ball texture)
2. **Focus / Target** — crosshair precision (shot tracking, zone accuracy)
3. **Data / AI** — horizontal data bars (analysis, pattern recognition)
4. **Intelligence** — the "iq" mark (smart coaching, adaptive training)

These 4 pillars should subtly inform the visual treatment of the 4 core features (Track → Focus/Target, Train → Basketball, Coach → Intelligence, Me → Data/AI).

**Brand color from logo:** Primary brand accent is a warm red-orange (#FF1A00 range). This should be the **brand color** used for the logo, marketing, and global brand moments — but NOT as a tab accent. The 5 tab accents remain as defined in §3.

**Typography from brand:** The logo uses Exo 2 (geometric, technical) + Montserrat. The app uses Barlow Condensed + Lexend. **The app typography is locked** — do not change it. But borrow the logo's geometric precision as a design principle: clean angles, structured grids, technical feeling.

**The design question this creates:** How do you make an app feel like this brand — circuit-meets-basketball, intelligence-meets-grit — using the existing token system? The answer is NOT "put the logo everywhere." It's about translating the brand's **attitude** into layout, motion, density, and information hierarchy.

---

## 2. THE PRODUCT

CourtIQ is a basketball training app for serious amateurs and semi-pros. Three jobs-to-be-done:

1. **Track shots automatically** — phone propped courtside, YOLOX-tiny v6 AI detects every attempt + outcome in real-time, generates heatmaps and zone stats. This is the flagship differentiator.
2. **Train with structured drills** — daily workouts, drill library filtered by skill × difficulty, in-session player with timer + audio cues + canvas court animation.
3. **Get AI coaching feedback** — weekly performance self-report → AI coach returns a verdict with reasoning and recommended drills.

Secondary systems: gamification (XP, streaks, levels, daily challenges, archetypes), social-light (leaderboards, challenges, badges), cosmetic shop (spend XP/coins on avatar items), avatar system (DiceBear-based customization).

Auth: Supabase. Platform: vanilla HTML/CSS/JS PWA wrapped in Capacitor for Android.

**Design workflow:** You design in React/JSX here in claude.ai/design. I port approved designs to vanilla JS for production. Design for portability — semantic classes, not utility soup.

---

## 3. THE 5-TAB ARCHITECTURE (locked — do not change)

| Tab | Token | Hex | Job | Personality |
|---|---|---|---|---|
| **Home** | `--c-home` | `#f5a623` (amber) | "What should I do right now?" | Warm, motivating, daily ritual |
| **Track** | `--c-track` | `#56d364` (green) | "How am I shooting?" | Precise, data-driven, the lab |
| **Train** | `--c-train` | `#4ca3ff` (blue) | "What's my workout?" | Intense, structured, the grind |
| **Coach** | `--c-coach` | `#bc8cff` (purple) | "What does coach say?" | Authoritative, insightful, the brain |
| **Me** | `--c-me` | `#2dd4bf` (teal) | "Who am I as a player?" | Personal, earned, identity |

**Key rule:** Only the active tab's accent renders at full saturation. All other accents in view dim to ~60%. This prevents the 5-color rainbow problem.

**Personality column is new** — use it. Each tab should have a distinct *feel*, not just a different color. Home is where you start your day. Track is where scientists go. Train is where athletes grind. Coach is where you get honest. Me is your trophy room.

---

## 4. DESIGN SYSTEM IN PRODUCTION (read these artifact files first)

Before designing anything, **read every one of these files in the artifact:**

- `colors_and_type.css` — 96 token definitions (palette, glass, typography, spacing, shadows, motion, radii)
- `ui_kits/mobile-app/ui-kit.css` — 12 `.ciq-*` component classes
- `ui_kits/mobile-app/Icons.jsx` — icon set (36 icons total: 16 basketball-native + 20 generic UI)
- `ui_kits/mobile-app/Chrome.jsx` — top bar + bottom nav
- `ui_kits/mobile-app/Screens.jsx` — all current screens (HomeScreen, TrackScreen, TrainScreen, CoachScreen, MeScreen, ShotTrackerCam)
- `ui_kits/mobile-app/ios-frame.jsx` — iPhone frame wrapper

**What you'll find:**

*Tokens:*
- Background: `--c-bg: #0e1014` (near-black, cool-toned)
- Text: `--c-white: #f0ede6` (warm off-white), `--c-muted` (~50%)
- Glass: `rgba(22,25,33,0.7)` bg, `rgba(255,255,255,0.08)` border, `20px` blur
- Radii: 10/16/24/32px scale
- Motion: `0.25s cubic-bezier(0.4,0,0.2,1)` default, spring + expo easings available
- Fonts: Barlow Condensed 400-900 (display, italic for headers), Lexend variable (body)

*Components (12 classes):*
`.ciq-screen`, `.ciq-eyebrow`, `.ciq-title`, `.ciq-glass`, `.ciq-topbar`, `.ciq-icon-btn`, `.ciq-bottom-nav`, `.ciq-nav-item`, `.ciq-primary-btn`, `.ciq-secondary-btn`, `.ciq-stat-tile`, `.ciq-row`

*Hierarchy system (in production but inconsistently applied):*
- 3 CTA levels: primary (accent fill + shadow), secondary (glass border), tertiary (text only), plus danger (red)
- 3 heading levels: H1 48px italic / H2 28px italic / H3 18px uppercase
- 3 density modes: comfy (24px gaps) / normal (16px) / compact (10px)
- Empty state: `.ciq-empty` (icon + title + subtitle + optional CTA)
- Loading state: `.ciq-loading` (spinner + label)

*Templates (every surface picks one):*
1. **HeroPage** — tab landings with hero card + supporting content
2. **ListPage** — browse/filter screens
3. **DetailOverlay** — fullscreen modals (camera, workout player, avatar 3D)
4. **BottomSheet** — quick-action modals
5. **EmbeddedSection** — sub-views within a tab
6. **FormPage** — multi-step wizard with progress indicator (for onboarding, profile setup)

*Icon rules:*
- 24×24 viewBox, `currentColor`, 1.75px stroke, rounded caps, single weight
- **Closed set** — 36 total. No emoji in interactive UI. No Lucide. No mixing.
- If you need a new icon, propose it with justification + matching spec

---

## 5. WHAT'S WRONG — the diagnosis I want you to validate

After three redesign phases, the app still feels **generic**. Here are my hypotheses — confirm, dispute, or add to them:

### 5.1 No clear "what now" on any tab landing
Every tab shows ~5 glass cards of equal visual weight. There's no hero moment — no single dominant action that says "tap this." A basketball player opening the app between games should know what to do in under 2 seconds.

### 5.2 Everything is glass — nothing stands out
When every card is a glass card, none of them feel important. The glassmorphism is well-executed but overused. There's no contrast between "important" and "ambient." The hierarchy system (primary/secondary/tertiary CTA) exists in CSS but isn't applied with conviction.

### 5.3 Legacy sub-pages break the experience
Home → Log/History/Alerts, Train → Moves, Me → Shop still use old `.ks-*` / `.db-*` styling. When a user navigates into these, it feels like a different app. This is the single most jarring UX issue.

### 5.4 Coach feels template-y, not premium
I rebuilt Coach as an "Insight Card" pattern (verdict headline + bullets + drill recs) but it reads like a formatted AI response. A real basketball coach doesn't hand you a bulleted list. The design should make the insight feel personal, authoritative, earned — not auto-generated.

### 5.5 Five accents fight for attention
The saturation dimming rule exists in CSS (`.ciq-accent-faded`) but in practice, screens still have multiple full-saturation accent moments. Cross-tab references (e.g., coach recommending a drill card that's blue-accented) create a color war.

### 5.6 Empty and loading states are inconsistent
The `.ciq-empty` and `.ciq-loading` templates exist but aren't applied uniformly. Some screens roll their own. The result is that "nothing here yet" feels different on every tab.

### 5.7 No basketball-native character
This is the big one. The app could be a running app, a yoga app, a study tracker — swap the icons and it works for anything. **What makes a basketball app feel like basketball?**

My hypothesis: it's not just icons or court graphics. It's about **rhythm, density, and information cadence.** Basketball is fast, vertical, high-contrast. The app should feel like a highlight reel, not a spreadsheet. Specifically:
- Stats should hit you like a scoreboard — big numbers, tight spacing, high contrast
- Transitions between states should feel like a fast break — quick, directional, purposeful
- Achievement moments should feel like a buzzer-beater — brief, emphatic, then gone
- The court is the canvas — half-court shapes, paint zones, arc lines can be structural elements, not decorations

**I want you to argue back on this. What's YOUR theory of what makes a basketball app feel basketball? Show me in the first screen you redesign.**

### 5.8 Missing states and micro-interactions
- No error state defined (what happens when coach AI fails? when camera permission denied?)
- No transition between sub-pages within a tab
- No haptic/visual feedback on stat changes
- No celebration moment for milestones (level up, badge earned, streak milestone)

### 5.9 Shot Tracker camera UI feels utilitarian, not flagship
The shot tracking camera is the most impressive feature — real-time AI detection — but the HUD looks like a debug overlay. The rim lock crosshair, the made/missed counters, the status badge — they should feel like a premium sports broadcast overlay, not a developer tool. This is the feature that sells the app; it should LOOK like it.

### 5.10 Avatar and Shop feel disconnected
The DiceBear avatar system has 22+ hair styles, NBA team jersey colors, accessories — it's a rich customization system. But it feels bolted on. The avatar should be a first-class citizen: visible everywhere (topbar, profile hero, leaderboards, challenges), animated on achievements, and the shop should feel like a real store — not a settings page with buy buttons.

### 5.11 Onboarding doesn't set the tone
The 7-step profile creation flow (name → playstyle → skills radar → goals → avatar → AI analysis → scouting report) is feature-complete but visually legacy. This is the user's FIRST impression of the app. If onboarding feels generic, the user assumes everything else is generic too. It should feel like you're being scouted.

---

## 6. COMPLETE SURFACE MAP

Your roadmap must address **every row** below. Mark each: **REDESIGN** (rebuild from scratch) / **REFINE** (polish within current structure) / **PORT** (move legacy into v2 design language) / **BUILD** (doesn't exist yet) / **KEEP** (already good).

### 6.1 Global Chrome

| Element | Status | Notes |
|---|---|---|
| Top bar (logo + profile avatar + bell) | shipped | 80px, glass bg, safe-top respected. Profile = DiceBear avatar 32px circle. Bell → alerts count badge |
| Bottom nav (5 tabs + active dot) | shipped | Active = full accent + dot. Routing via `dbSwitchTab` + `CIQ_SHELL.switchTo` |
| XP toast / streak overlay | shipped | XP slides in bottom-right after Supabase write. Streak fire pulses on session log |
| Tab switch transition | **NONE** | Open question — propose a transition pattern |

### 6.2 Onboarding / Profile Creation (first-time user)

This is the user's FIRST experience. It must set the tone for the entire app.

| Surface | Step | Template | Status | Notes |
|---|---|---|---|---|
| Welcome / Sign Up | 0 | HeroPage | shipped (basic) | Supabase auth. Currently plain form |
| **Basic Info** | 1 | FormPage | **LEGACY** | Name (auto from auth), Age (8-99), Height (inches), Weight (optional), Shooting Hand (L/R toggle), **Position picker** |
| **Position Picker** | 1b | FormPage | **LEGACY** | 5 cards: PG, SG, SF, PF, C — each with icon + name + description. Tap to select. This should feel like choosing your role on the court |
| **Play Style Quiz** | 2 | FormPage | **LEGACY** | Multiple-choice questions about how they play. Dynamic `data-key` → `data-value` structure |
| **Skills Radar** | 3 | FormPage | **LEGACY** | 6 sliders: Shooting, Ball Handling, Passing, Defense, Athleticism, Basketball IQ (0-10, default 5). Live Chart.js radar updates on drag. This should feel like building your player card |
| **Goals Selection** | 4 | FormPage | **LEGACY** | Goal chips (max 3). Tap to select/deselect. E.g., "Improve my 3-pointer", "Get faster", "Better defense" |
| **Avatar Creation** | 5 | FormPage | **LEGACY** | Gender → full DiceBear customizer (see §6.9 for detail). Canvas-rendered 300×300 preview |
| **AI Analysis** | 6 | FormPage (loading) | **LEGACY** | Async call to `PlayerAnalysis.generateReport()`. Loading state = the AI is scouting you. Grants 50 XP on completion |
| **Scouting Report** | 7 | HeroPage | **LEGACY** | Results: Avatar hero, Player Grade, Strengths list, Development Areas, Training Focus, Suggested Drills, NBA Comparison player. This is the "reveal" moment — make it feel like draft night |

**Key UX moments to nail:**
- Position picker should feel physical — like stepping onto the court at that position
- Skills radar should feel like building a 2K player card — satisfying, visual, responsive
- Scouting report reveal should have gravitas — you've been evaluated, here's your grade
- The whole flow should feel like a scouting combine, not a form wizard

**Data flow:** All data → `localStorage.courtiq-onboarding-data` → async Supabase sync via `DataService.saveUserData()` + `DataService.updateProfile()`.

### 6.3 Home Tab (amber)

| Surface | Sub-route | Template | Status | Notes |
|---|---|---|---|---|
| Today (default) | — | HeroPage | shipped, needs polish | Daily challenge + streak/level + recent sessions |
| Log Session | log | ListPage | **LEGACY** | Old `.ks-*` form styling. Routes to `db-panel-log` |
| History | history | ListPage | **LEGACY** | Old `db-panel-history`. Sessions grouped by week |
| Calendar | calendar | EmbeddedSection | partial | Month grid → week strip → day detail. "Schedule Session" CTA |
| Alerts | alerts | ListPage | **LEGACY** | Old `db-panel-notifications`. Icon + title + time + dismiss |

**Interactions:** Daily Challenge card → accept + deep-link to Train Today. Streak tap → streak history modal. Level/XP tap → Me Profile. Session row → Track Sessions detail. Notification row → dismiss or route.

### 6.4 Track Tab (green) — Shot Tracker flagship

| Surface | Sub-route | Template | Status | Notes |
|---|---|---|---|---|
| Lab (default) | — | HeroPage | shipped, needs polish | FG% hero KPI, stat tiles, "Launch Camera" + "Upload Video" CTAs |
| Heatmap | heatmap | EmbeddedSection | shipped, needs polish | Half-court SVG with hot/cold gradient + zone overlay |
| Zones | zones | EmbeddedSection | shipped, needs polish | 7-zone grid: make/attempts per zone |
| Sessions | sessions | ListPage | shipped, needs polish | Past sessions with drill-by-drill on expand |
| **Rim Lock** | (phase 1 of camera) | DetailOverlay | shipped, needs redesign | Crosshair + tap to calibrate. See §6.10 |
| **3-Point Calibration** | (phase 2 of camera) | DetailOverlay | shipped, needs redesign | Tap 3PT line point. See §6.10 |
| **Live Tracking HUD** | (phase 3 of camera) | DetailOverlay | shipped, needs redesign | Real-time AI detection overlay. See §6.10 |
| **Post-Session Summary** | (after camera close) | HeroPage or DetailOverlay | shipped, needs redesign | Shot chart + stats recap |

**Interactions:** "Launch Camera" → permission → Rim Lock → 3PT Cal → Live Tracking. "Upload Video" → file picker → same engine. Zone tap → filters Sessions. Session expand → drill breakdown. Camera close → confirm → Post-Session Summary.

**Sealed code:** `ShotTrackingScreen.js`, `shotDetection.js`, `yoloxWorker.js`, `shotService.js` — UI chrome only, no callback changes.

### 6.5 Train Tab (blue)

| Surface | Sub-route | Template | Status | Notes |
|---|---|---|---|---|
| Today (default) | — | HeroPage | shipped, needs polish | Today's challenge, progress, sets done, next drill |
| Drill Library | drills | ListPage | shipped, refresh needed | Re-skinned legacy drill cards |
| Generator | generator | ListPage | shipped, needs polish | Filter by Focus × Difficulty. Drill cards with add/start CTAs |
| Moves Library | moves | ListPage | **LEGACY** | `move-library.js` styling. Thumbnail + animation play |
| Lab | lab | EmbeddedSection | **LEGACY** | Experimental drills (small surface) |
| Night Training | night | EmbeddedSection | **LEGACY** | Low-light + audio-cued drills |
| **Drill Card (expanded)** | (inline or sheet) | BottomSheet or EmbeddedSection | needs design | See §6.11 — drill detail with court animation |
| **Workout Player** | (overlay) | DetailOverlay | shipped, redesign needed | Fullscreen: set/rep, timer, Next/Skip/Pause, progress, audio. See §6.12 |

**Interactions:** Today "Start" → Workout Player overlay. Drill card "Add to Today" → `drillToggleSave(id)`. Drill body tap → Workout Player for that drill. Filter chip toggle → re-render with debounce. Coach drill rec arrives via `sessionStorage['ciq-pending-drill']` → Generator scrolls + pulses matching card.

**Sealed code:** `drill-engine.js` (4257 lines — restyle only, no refactor).

### 6.6 Coach Tab (purple)

| Surface | Sub-route | Template | Status | Notes |
|---|---|---|---|---|
| Coach (default) | — | HeroPage | **needs redesign** | Latest insight: verdict + bullets + 2 drill recs + "Update" CTA. User didn't love it |
| Update Performance | update | FormPage | partial | 4 categories (shooting/handling/defense/athleticism) — sliders/steppers, NOT number inputs. Legacy form re-skinned |
| Insight History | history | ListPage | **NOT BUILT** | Chronological past insights. Phase 10.1 |

**Interactions:** "Update This Week" → scroll to form. Drill rec row tap → route to Train via sessionStorage + tab switch. Form submit → `ai-coach.js` → new insight + drill recs. "View History" → Insight History sub-page.

**Sealed code:** `ai-coach.js` submission flow + Anthropic bridge.

### 6.7 Me Tab (teal)

| Surface | Sub-route | Template | Status | Notes |
|---|---|---|---|---|
| Profile (default) | — | HeroPage | shipped, needs polish | Name + position + 3-stat strip + trophy carousel + archetype card |
| Trophies | trophies | ListPage | **NOT BUILT** | Full badge gallery. Earned vs locked. Only carousel exists now |
| Social | social | ListPage | shipped, needs polish | Top 10 leaderboard + active challenges + Send Challenge/Copy Link CTAs |
| **Avatar Customizer** | avatar | DetailOverlay | shipped, **REDESIGN** | DiceBear wizard. See §6.9 for full spec |
| **Shop** | shop | ListPage | **LEGACY, REDESIGN** | Full cosmetics store. See §6.13 for full spec |
| Archetype | archetype | EmbeddedSection | **LEGACY** | Archetype chart + traits |
| Settings | (sheet) | BottomSheet | shipped, needs polish | Email (read-only), Sign Out, Notifications, About, Help |

**Interactions:** Account row → Settings sheet. Sign Out → `sb.auth.signOut()`. Trophy → Trophies page or detail. Leaderboard row → mini-profile modal. Send Challenge → composer sheet. Copy Link → clipboard + toast. Shop item → buy confirmation sheet. Avatar on profile hero → Avatar Customizer overlay.

**Sealed code:** `avatar-3d.js` (Three.js), `social-hub.js` (Supabase realtime).

### 6.8 Cross-Tab Interactions & Navigation Flow

**Every page must be reachable.** The navigation map below shows the full connectivity. Design each transition — not just the destination.

```
HOME (amber)
├── Today (default landing)
│   ├── Daily Challenge card → [TRAIN] Today (accept + switch tab)
│   ├── Streak counter → Streak History (BottomSheet)
│   ├── Level/XP card → [ME] Profile
│   └── Recent session row → [TRACK] Sessions detail
├── Log Session (sub-nav chip)
│   └── Submit → back to Today + XP toast
├── History (sub-nav chip)
│   └── Session row → [TRACK] Sessions detail
├── Calendar (sub-nav chip)
│   └── "Schedule Session" → Log Session
└── Alerts (sub-nav chip)
    └── Notification row → relevant tab deep-link OR dismiss

TRACK (green)
├── Lab (default landing)
│   ├── "Launch Camera" → Rim Lock → 3PT Cal → Live Tracking → Post-Session Summary
│   ├── "Upload Video" → file picker → processing → Post-Session Summary
│   └── Stat tile tap → Heatmap/Zones section
├── Heatmap (sub-nav or scroll section)
│   └── Zone tap → Zones detail OR Sessions filtered by zone
├── Zones (sub-nav or scroll section)
│   └── Zone card tap → Sessions filtered by that zone
├── Sessions (sub-nav chip)
│   └── Session row expand → drill-by-drill breakdown
└── [Camera Overlay] (DetailOverlay, not in nav)
    ├── Phase 1: Rim Lock (tap rim center → adjust size → lock)
    ├── Phase 2: 3PT Calibration (tap 3PT line point → confirm)
    ├── Phase 3: Live Tracking (real-time HUD: made/missed/%, timer, zone, flash)
    └── End Session → Post-Session Summary (shot chart + stats)

TRAIN (blue)
├── Today (default landing)
│   ├── "Start" CTA → Workout Player (DetailOverlay)
│   └── Drill row tap → Drill Detail (BottomSheet) OR Workout Player
├── Drill Library (sub-nav chip)
│   └── Drill card tap → Drill Detail (BottomSheet with court animation)
├── Generator (sub-nav chip)
│   ├── Filter chips (Focus × Difficulty) → re-render list
│   ├── Drill card "Add to Today" → adds + visual confirm
│   ├── Drill card body tap → Drill Detail (BottomSheet with court animation)
│   └── [Incoming from Coach] sessionStorage drill → scroll + pulse
├── Moves Library (sub-nav chip)
│   └── Move row → play animation + description
├── Lab (sub-nav chip)
├── Night Training (sub-nav chip)
└── [Workout Player] (DetailOverlay, not in nav)
    ├── Current set/rep display + big timer
    ├── Next / Skip / Pause controls
    ├── Progress bar (drills completed / total)
    ├── Audio cues (start, rest, switch, complete)
    └── Complete → summary + XP award

COACH (purple)
├── Coach (default landing)
│   ├── Insight Card → read verdict + bullets
│   ├── Drill rec row → [TRAIN] Generator (via sessionStorage, tab switch)
│   ├── "Update This Week" CTA → Update Performance form
│   └── "View History" → Insight History
├── Update Performance (sub-nav or scroll-to)
│   ├── 4 category sliders (Shooting/Handling/Defense/Athleticism)
│   └── Submit → loading state → new Insight Card appears
└── Insight History (sub-nav chip)
    └── Past insight row → expand to full insight detail

ME (teal)
├── Profile (default landing)
│   ├── Avatar tap → Avatar Customizer (DetailOverlay)
│   ├── Stat strip → detailed stats view
│   ├── Trophy carousel → Trophies sub-page
│   ├── Archetype card → Archetype detail
│   └── Account row → Settings (BottomSheet)
├── Trophies (sub-nav chip)
│   ├── Earned badge → celebration detail
│   └── Locked badge → requirements + progress
├── Social (sub-nav chip)
│   ├── Leaderboard row → user mini-profile (BottomSheet)
│   ├── "Send Challenge" → challenge composer (BottomSheet)
│   └── "Copy Link" → clipboard + toast
├── Shop (sub-nav chip) — See §6.13
│   ├── Category tabs (Accessories / Hair / Beard)
│   ├── Item card → preview on avatar + buy confirmation (BottomSheet)
│   └── Coin wallet display at top
├── Avatar Customizer (DetailOverlay)
│   └── See §6.9
├── Settings (BottomSheet)
│   └── Email (read-only), Sign Out, Notifications, About, Help
└── Archetype (sub-nav or embedded)
    └── Archetype chart + trait descriptions
```

**Cross-tab routing mechanisms:**

| Route | Mechanism | Visual Treatment |
|---|---|---|
| Coach drill rec → Train Generator | `sessionStorage['ciq-pending-drill']` (id, name, ts), 30s expiry | Tab switch + scroll + outline-pulse on matching card |
| Home Daily Challenge → Train Today | `sessionStorage` challenge data + `dbSwitchTab('training')` | Tab switch + challenge card highlights as active |
| Home recent session → Track Sessions | Session ID in route state + `dbSwitchTab('shots')` | Tab switch + auto-expand matching session |
| Home notification → any tab | Notification `targetTab` + `targetRoute` fields | Tab switch + route to specific sub-page |
| Me Level/XP card ← Home | `dbSwitchTab('archetype')` | Tab switch to Me Profile |
| Train Workout complete → Home | Return to Home with XP toast + streak update | Tab switch + celebration moment |

**Tab switch animation:** Currently NONE. Propose a directional transition — tabs have a spatial order (Home → Track → Train → Coach → Me), so moving right/left should feel directional.

### 6.9 Avatar Customizer (DiceBear) — full spec

The avatar system uses **DiceBear Avataaars API v9** and must be designed as a premium feature, not a settings page.

**Flow:** Gender selection → Full customizer with category tabs

**Customization categories (design each as a swipeable section or tab):**

| Category | Options | XP-Locked Items |
|---|---|---|
| **Skin Tone** | 5 tones: Pale, Light, Mellow, Brown, Dark Brown | None (all free) |
| **Hair Style** | Male: 22 styles (Buzz Cut, Afro, Dreads, Mohawk, Waves, Cornrows, etc.) / Female: 21 styles | Mohawk, Waves, Cornrows (shop items) |
| **Hair Color** | 10 colors including NBA team colors (Black, Brown, Auburn, Blonde, Red, Platinum, Silver, Pink, Blue, Green) | Pink, Blue, Green (level 3+) |
| **Eyes** | 11 expressions (Default, Happy, Wink, Dizzy, Hearts, etc.) | Hearts (level 3) |
| **Eyebrows** | 13 styles (Natural, Angry, Raised, Sad, Unibrow, etc.) | None |
| **Mouth** | 12 styles (Smile, Serious, Grimace, Tongue, Scream, etc.) | None |
| **Facial Hair** (male) | 6 styles (Light Beard, Medium, Majestic, Moustache variants) | Goatee, Chinstrap (shop items) |
| **Clothes** | 9 types (Jersey, V-Neck, Hoodie, Blazer, Sweater, etc.) | None |
| **Jersey Color** | 20 colors including NBA team colors (Warriors Blue, Lakers Purple, Celtics Green, Bulls Red, Heat Red, Knicks Blue/Orange, Bucks Green, Suns Orange) | Premium team colors (level 3-7) |
| **Accessories** | 7 styles (Glasses, Sunglasses, Wayfarers, etc.) + shop items (Headband, Sweatband, Armband, Sport Glasses, Gold Chain, Durag) | Shop items (coin purchase) |
| **Background** | 13 options including team-themed and solid colors | Most are XP-locked |

**UI requirements:**
- Large avatar preview (300×300 canvas) centered at top, updates live on every change
- Category selector: horizontal scrollable tabs or segmented control
- Options within category: grid of tappable swatches/thumbnails
- Locked items: show with lock icon + level requirement badge. Tapping shows "Reach Level X to unlock" or "Buy in Shop" prompt
- 6 preset personas (Street Baller, Game Face, MVP, Drip King, Hoop Star, Court Legend) as quick-start option
- "Save" CTA at bottom — updates avatar everywhere (topbar 32px, profile 84px, leaderboards, etc.)
- Mini avatar renders: 48×48 (profile card), 32×32 (topbar), used throughout app

**Design direction:** This should feel like NBA 2K's MyPlayer face scan / customization — not like a settings page. Big preview, satisfying swipe between options, locked items that create aspiration.

### 6.10 Shot Tracking Camera UI — full spec (FLAGSHIP FEATURE)

This is the app's killer feature. The camera UI has 3 phases + a summary screen. **Only the UI chrome is in scope for redesign — the detection engine callbacks are sealed.**

#### Phase 1: Rim Lock
User calibrates the camera by identifying the rim position.

**Current elements:**
- Full-screen camera preview (background)
- Crosshair overlay (horizontal + vertical lines intersecting at center)
- Center dot at crosshair intersection
- Rim size indicator (rectangle showing detected rim area)
- Instruction text: "Tap the center of the rim"
- Rim size adjusters: − and + buttons
- "Lock Rim" confirmation button

**Design direction:** This should feel like a targeting system — precise, technical, premium. Think sniper scope meets broadcast camera calibration. The crosshair should feel like the brand's "Focus/Target" pillar. Subtle grid lines, clean typography for instructions, satisfying "locked" confirmation animation.

#### Phase 2: 3-Point Calibration
User taps a point on the 3-point line to help the AI understand court distance.

**Current elements:**
- Camera preview with locked rim position shown
- Instruction: "Tap any point on the 3-point line"
- Visual marker where user taps
- Line drawn from tap point to rim
- "Confirm" button
- "Skip" option (calibration is optional)

**Design direction:** Minimal, clean. Show the court geometry forming — the 3PT arc appearing based on the user's tap. Make the math feel visual, not technical.

#### Phase 3: Live Tracking HUD (this is the money shot)
Real-time AI detection with visual overlay on camera feed.

**Current HUD elements (restyle ALL of these):**

| Element | Current Style | Design Goal |
|---|---|---|
| **Made counter** | Plain text "Made: 0" | Big number, green accent, scoreboard style |
| **Attempts counter** | Plain text "Attempts: 0" | Paired with Made in stat bar |
| **Accuracy %** | Amber colored text | Hero stat — largest element on HUD, center-top or prominent position |
| **Timer** | MM:SS plain text | Clean monospace feel, subtle |
| **Status badge** | Loading dot + text ("Tracking...") | Pill badge: pulsing green dot when active, amber when loading |
| **Zone badge** | Court zone name text | Show current shot zone with mini court diagram |
| **Made flash** | Green screen flash | Celebratory flash — green + "MADE!" text, quick fade |
| **Miss flash** | Red screen flash (subtle) | Subtle red pulse, no text or "MISS" briefly |
| **Streak notification** | Text overlay | "3 IN A ROW!" type overlay, emphatic, auto-dismiss |
| **Detection box** | Debug rectangle on ball/rim | In debug mode only — clean colored box around detected objects |
| **End Session button** | Red stop icon + text | Bottom bar, clear but not intrusive |
| **Debug toggle** | Bug emoji button | Hidden in corner, dev-only |

**Design direction:** Think ESPN/TNT broadcast overlay quality. The HUD should be:
- **Transparent** — never block the camera view more than necessary
- **Glanceable** — stats readable in peripheral vision while shooting
- **Celebratory on makes** — the flash/animation on a made shot is a dopamine hit
- **Streak-aware** — consecutive makes get increasingly emphatic feedback
- **Zone-aware** — show where shots are coming from with a mini court indicator
- Brand's "Focus/Target" pillar is strongest here — crosshair motifs, precision typography

#### Post-Session Summary
After ending a session, show results.

**Current elements:**
- SVG half-court (500×470px) with rim at (250, 63) and 3PT arc (190px radius)
- Shot dots plotted: made (green) vs missed (red)
- Session stats summary

**Design direction:** This is the "game recap" moment. Big hero stat (FG%), visual shot chart that's beautiful enough to screenshot and share, drill-by-drill breakdown, comparison to last session. The half-court should be rendered in the brand's style — circuit-line aesthetics meeting court lines.

### 6.11 Drill Card with Court Animation — spec

Each drill in the Generator and Library has a **canvas-based court animation** showing the drill in action.

**Animation system (existing, canvas-based):**
- Court: 280×176px canvas, top-down half-court view
- Visual: Boundary lines, lane/paint, free-throw arc, backboard + rim, 3PT arc, restricted area
- Players: Circle (7px radius), blue (#4ca3ff) for offense, red (#e84040) for defense, with ground shadow
- Ball: Small circle with shadow
- Animations loop and pause on hover

**Supported drill animation types:**
- Spot shooting
- Stepback
- Crossover
- Post fade
- Eurostep
- Pullup

**Design requirements for drill card:**
- Collapsed state: drill name + focus icon + difficulty + duration + "Add" button
- Expanded state (tap or BottomSheet): court animation playing at top, drill description below, sets/reps info, "Start Workout" CTA
- The animation canvas should have brand-consistent styling — court lines in muted color, players in accent colors, smooth motion
- Animation should auto-play when card expands, pause when collapsed
- Each drill type should have a visually distinct animation that helps the user understand the movement pattern BEFORE starting

### 6.12 Workout Player — full spec

Fullscreen overlay during active drill execution.

**Current elements:**
- Current set and rep display (e.g., "Set 2 of 4 — Rep 3 of 10")
- Big countdown timer (center, large font)
- Control buttons: Next (skip to next set), Skip (skip drill), Pause/Resume
- Progress bar (drills completed / total drills in workout)
- Audio cues: start beep, rest timer, switch drill, workout complete
- Drill name + description

**Design direction:** This is where the athlete is IN the zone. The UI must be:
- **Minimal** — only show what matters RIGHT NOW (current rep, time left, next action)
- **High contrast** — readable in bright outdoor light on a basketball court
- **Big touch targets** — user is sweating, holding a basketball, tapping with a thumb
- **Timer is king** — the countdown timer should be the hero element, 60px+ font
- **Rest vs Active states** — clearly different visual modes. Active = intense (blue pulsing). Rest = calm (dimmed, countdown to next set)
- **Progress feel** — the player should always know "how much is left" at a glance
- **Completion celebration** — workout done moment should feel earned, show XP gained, session stats

### 6.13 Shop / Cosmetics Store — full spec

A real store experience for spending XP/coins on avatar customizations.

**Current system:**
- XP → Coins conversion (1 XP = 1 coin)
- **Level tiers:** Rookie (0 XP), Hooper (200 XP), All-Star (600 XP), MVP (1500 XP)
- **Items currently in shop:**
  - Accessories: Headband (100 coins), Sweatband (75 coins), Armband (50 coins), Sport Glasses (150 coins), Gold Chain (200 coins), Durag (125 coins)
  - Hair: Mohawk, Waves, Cornrows (bonus unlocks)
  - Beard: Goatee, Chinstrap (bonus unlocks)
- Free items unlocked by default: buzz, short, fade, afro, dreads, bald, none, stubble

**Design requirements:**
- **Wallet bar** at top: coin balance + XP total + current level badge
- **Category tabs:** Accessories / Hair / Beard (expandable for future: Jerseys, Backgrounds, Celebrations)
- **Item card grid:** 2-column grid, each card shows:
  - Item preview (rendered on mini avatar, not just an icon)
  - Item name
  - Price in coins OR "Owned" badge OR "Level X Required" lock
  - Status styling: `.shop-item--owned` (teal check), `.shop-item--locked` (dimmed + lock icon), `.shop-item--affordable` (buy CTA active), `.shop-item--expensive` (buy CTA disabled, shows "Need X more coins")
- **Buy flow:** Tap item → BottomSheet with large avatar preview wearing the item + price + "Buy" CTA + "Cancel"
- **Equip flow:** Owned items have "Equip" toggle — tapping updates avatar globally
- **Empty wallet state:** "Earn XP through training to get coins. Start a workout →" with CTA to Train tab

**Design direction:** Think of a sneaker store or 2K MyTeam store — visual, aspirational, items displayed attractively. NOT a settings list. The avatar preview with the item "on" should make you want to buy it. Locked items should create FOMO (show what level unlocks them, show progress toward that level).

### 6.14 Modals & System Surfaces

| Modal | Trigger | Template | Design Priority |
|---|---|---|---|
| Workout Player | Train "Start" / drill card body tap | DetailOverlay | **HIGH** — redesign (§6.12) |
| Live Camera Tracker | Track "Launch Camera" | DetailOverlay | **HIGH** — redesign (§6.10) |
| Avatar Customizer | Me Profile avatar tap / onboarding step 5 | DetailOverlay | **HIGH** — redesign (§6.9) |
| Post-Session Summary | Camera session end | DetailOverlay or HeroPage | **HIGH** — redesign (§6.10) |
| Buy Confirmation | Shop item tap | BottomSheet | **MEDIUM** — new |
| Drill Detail | Generator card tap | BottomSheet | **MEDIUM** — with court animation (§6.11) |
| Settings | Me Profile account row | BottomSheet | LOW — polish |
| Send Challenge | Me Social CTA | BottomSheet | LOW — polish |
| Streak History | Home streak counter tap | BottomSheet | LOW — polish |
| Level Up Celebration | XP threshold crossed | Overlay (auto-dismiss) | **MEDIUM** — new |
| Badge Earned | Achievement unlocked | Overlay (auto-dismiss) | **MEDIUM** — new |

### 6.15 States Every Surface Must Have

| State | Pattern | Class |
|---|---|---|
| **Empty** | Basketball-native icon (32px) + H2 italic title + body subtitle + optional CTA | `.ciq-empty` |
| **Loading** | Spinning basketball icon (16px) + italic uppercase label | `.ciq-loading` |
| **Error** | **NOT DEFINED — propose.** E.g., camera permission denied, AI coach API failure, network error | `.ciq-error` |
| **Success** | **NOT DEFINED — propose.** E.g., workout completed, session saved, avatar updated | `.ciq-success` |
| **Skeleton** | **NOT DEFINED — propose.** For perceived performance on data-heavy screens | `.ciq-skeleton` |
| **Locked** | **NOT DEFINED — propose.** For gated features, premium items, level-restricted content | `.ciq-locked` |

---

## 7. HARD CONSTRAINTS (do not break)

1. **Vanilla JS port.** Everything you design gets ported to vanilla DOM construction. No React in production. Avoid Tailwind utility soup or shadcn patterns. Use semantic `.ciq-*` classes.
2. **Tokens are locked.** The 96 CSS custom properties, 5 tab accents, fonts, and base palette stay. You CAN propose new sub-tokens (e.g., `--accent-ghost`, `--c-error`) with justification.
3. **Templates are the unit.** Every page = one of the 6 templates (HeroPage, ListPage, DetailOverlay, BottomSheet, EmbeddedSection, FormPage). Propose a 7th only if strongly justified.
4. **Icon set is closed (36 total).** Add new ones only with matching spec (24×24, currentColor, 1.75px stroke, rounded caps).
5. **Sealed code paths** (restyle chrome ONLY, no internal changes):
   - `shotDetection.js`, `yoloxWorker.js`, `shotService.js` (YOLOX detection)
   - `ai-coach.js` (Anthropic bridge + form handlers)
   - `drill-engine.js` (drill catalog, 4257 lines)
   - `social-hub.js` (Supabase realtime)
   - `data-service.js`, `supabase-client.js`, `sw.js`
   - `avatar-3d.js` (Three.js canvas)
   - `avatar-customizer.js` (DiceBear API calls — restyle UI, don't change API contract)
6. **Mobile-first: 390×844** (iPhone 14). No tablet/desktop. Every interactive element ≥ 44px tap target.
7. **Feature flags.** Every redesigned surface ships behind `window.COURTIQ_UI_V2[tabName]`. Reversible per-tab.
8. **No emoji in interactive UI.** Decorative only (e.g., streak fire counter is acceptable, emoji as button labels is not).
9. **DiceBear avatar renders** are via API URL (https://api.dicebear.com/9.x/avataaars/png?params). The customizer UI is in scope for redesign; the API contract is not.

---

## 8. WHAT I WANT FROM YOU — in exact order

### Step 1 — DIAGNOSIS (this turn)

Read every artifact file. Study the attached brand sheet. Then write a 1-page critique:

**A. Validate or dispute** each of the 11 symptoms in §5. Don't just agree — if I'm wrong about something, tell me.

**B. Identify problems I missed.** You have fresh eyes on the artifact code. What else is broken that I'm too close to see?

**C. Name the 2-3 highest-leverage problems.** Which issues, if solved, would lift the quality of everything else? These are your design priorities.

**D. Answer the basketball question** from §5.7 with a specific, arguable design position. "More basketball icons" is not an answer. Show me you understand what makes a sport app feel like THAT sport.

### Step 2 — ROADMAP (same turn or next)

For every surface in §6 (all of 6.1 through 6.15), provide:

| Surface | Verdict | Design Move (1 line) | Priority |
|---|---|---|---|
| e.g. Coach Landing | REDESIGN | "One bold verdict line at 48px, like a personal trainer talking to you, not a bulleted report" | P1 |

Plus:
- **Sequencing:** What order do we rebuild? Group by impact wave, not by tab
- **The navigation flow** must be fully connected — every screen reachable, every back-path defined
- **New tokens needed** (if any) — name, value, justification
- **New icons needed** (if any) — name, spec, justification  
- **New templates needed** (if any) — name, when to use, justification
- **Motion budget:** What gets animation? What stays static? What is the **one signature micro-interaction** for the whole app?
- **The "basketball move":** One specific, concrete design decision that makes this app feel unmistakably like a basketball product. Not a vibe — a specific element or pattern you'll implement.
- **Celebration moments:** How do we handle: made shot flash, streak milestone, badge earned, level up, workout complete?

### Step 3 — PER-SURFACE ITERATION (after I confirm)

For each surface, in the order from Step 2:
1. Design the screen as JSX in the artifact (using existing tokens + components)
2. Show me the screen in the iPhone frame
3. **Show connected screens** — if the screen has navigation to sub-pages, show the transition and destination too
4. I give feedback
5. Iterate until I approve
6. Move to next surface

**Do NOT skip Steps 1 and 2.** I will reject any screens generated before the roadmap is confirmed.

---

## 9. INSPIRATION / VIBES

**Feel like:**
- **Nike Training Club** — the intensity and purpose, without fitness-influencer cheesiness
- **Strava** — data clarity and social proof, but with attitude (our italic display type already gives us edge)
- **Apple Sports** — typography hierarchy and information density, but darker and grittier
- **NBA 2K MyPlayer** — avatar customization, player cards, the feeling that your character is YOUR creation
- **A player's gym bag** — purposeful, no clutter, every item earned, nothing decorative

**Avoid:**
- Wellness-app softness (no pastel gradients, no over-rounded corners, no "breathe" energy)
- AI-product clichés (no chat bubbles unless warranted, no gradient halos as default visual, no "powered by AI" badges everywhere)
- Generic component library aesthetics (no shadcn/MUI defaults, no card soup)
- Dashboard syndrome (no 6 equal-weight cards in a grid — that's a CRM, not a training app)
- Settings-page aesthetics for rich features (avatar, shop, drill animations deserve premium treatment)

**The brand's attitude in one sentence:** "Your game has data now. Use it."

---

## 10. DESIGN PRINCIPLES (apply to every decision)

1. **One hero per screen.** Every surface has exactly ONE dominant element. Everything else supports it. If you can't point to the hero, redesign.

2. **Earned, not given.** Empty states should feel like potential energy. Locked trophies should make you want to earn them. Shop items you can't afford should motivate training. The app rewards work, not just opening it.

3. **Numbers hit hard.** Stats are displayed like a scoreboard — big, tight, high-contrast. FG% at 48px is a design statement. FG% at 14px in a card is a missed opportunity.

4. **Glass is for containers, not for everything.** Use glass for cards and overlays. Use solid fills or transparency for buttons, badges, and indicators. The hierarchy needs contrast, not more blur.

5. **Motion is intentional.** No animation for decoration. Every motion communicates state change. The ONE signature flourish should be unmistakable and basketball-native.

6. **The brand identity lives in the structure.** The circuit-meets-basketball logo DNA shows up in grid precision, data-dense layouts, and technical feeling — not in pasting the logo on every screen.

7. **Every screen is connected.** No dead ends. Every surface should make it obvious how to get to the next action. The navigation flow in §6.8 is the source of truth — if a path exists, the UI must make it discoverable.

8. **Features deserve their own design.** The avatar customizer, drill animations, shot tracker camera, and shop are not utilities — they're experiences. Design them with the same care as tab landings.

---

**OK — start with Step 1 (diagnosis). Read every artifact file, study the brand sheet, write the critique. Don't generate any screens yet.**
