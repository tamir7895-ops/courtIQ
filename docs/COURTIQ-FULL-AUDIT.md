# CourtIQ — Complete App Audit for UI Redesign

## Project Overview

**Type:** AI-Powered Basketball Training Platform (PWA)
**Tech Stack:** Vanilla HTML5/CSS3/JS — no build step, no bundler
**Backend:** Supabase (auth + database)
**AI:** Anthropic Claude API (coach), YOLOX-tiny ONNX (shot detection)
**Charts:** Chart.js 4.4.1
**Live URL:** https://tamir7895-ops.github.io/courtIQ/
**Total Code:** ~46,000+ lines (38 JS files, 20 CSS files, 2 HTML pages)

---

## File Structure

```
courtIQ/
├── index.html (94 KB)           — Landing page + marketing site
├── dashboard.html (146 KB)      — Main authenticated app (all features)
├── shared.css (35 KB)           — Shared design tokens
├── serve.js (19 KB)             — Live reload dev server
├── manifest.json                — PWA manifest
├── sw.js (4 KB)                 — Service Worker (cache-first)
│
├── styles/                      — 20 CSS files (~516 KB total)
│   ├── main.css (136 KB)        — Core design system + variables
│   ├── animations.css (28 KB)   — Keyframes, transitions, reveals
│   ├── dashboard-redesign.css (59 KB) — Dashboard layout (grid, sidebar, tabs)
│   ├── drills.css (63 KB)       — Drill cards, expand/collapse, badges
│   ├── components.css (20 KB)   — Reusable components (cards, modals, inputs)
│   ├── avatar-customizer.css (19 KB)
│   ├── ai-shot-tracker.css (36 KB)
│   ├── onboarding.css (23 KB)
│   ├── social.css (22 KB)
│   ├── daily-workout.css (12 KB)
│   ├── profile.css (8.7 KB)
│   ├── workouts.css (11 KB)
│   ├── charts.css (2.6 KB)
│   ├── gamification.css (4.4 KB)
│   ├── move-library.css (9.9 KB)
│   ├── shot-tracker.css (9.1 KB)
│   ├── challenge.css (5.5 KB)
│   ├── archetype.css (8.1 KB)
│   ├── shop.css (7.8 KB)
│   └── avatar-3d.css (3 KB)
│
├── js/                          — 38 JavaScript files
│   ├── supabase-client.js (27 lines)  — Supabase init
│   ├── auth.js (12 KB)          — Sign in/up/out, session management
│   ├── utils.js (101 lines)     — escapeHTML, safeNumber, LS helpers
│   ├── nav.js (6.6 KB)          — Navigation + routing
│   ├── dashboard.js (60 KB)     — Main controller (auth guard, tabs, state)
│   ├── data-service.js (5 KB)   — Data abstraction layer
│   ├── sidebar.js (1.3 KB)      — Sidebar toggle
│   ├── feature-modals.js (42 KB) — Modal management
│   ├── feature-tabs.js (17 KB)  — Tab switching
│   ├── drill-engine.js (182 KB) — 60+ drill database + generator
│   ├── drill-animations.js (38 KB) — Drill visual animations
│   ├── daily-workout.js (8.3 KB)
│   ├── shot-tracker.js (12 KB)  — Manual FG/3PT/FT logging
│   ├── shot-analysis.js (11 KB)
│   ├── ai-shot-tracker.js (88 KB) — Legacy AI tracker (unused)
│   ├── ai-coach.js (30 KB)     — Anthropic Claude integration
│   ├── gamification.js (8.4 KB) — XP + 4-tier level system
│   ├── streak.js (4.9 KB)
│   ├── daily-challenge.js (8.1 KB)
│   ├── player-profile.js (9.3 KB)
│   ├── progress-charts.js (7.3 KB)
│   ├── player-analysis.js (9.6 KB)
│   ├── avatar-3d.js (45 KB)    — Three.js 3D avatar
│   ├── avatar-builder.js (65 KB)
│   ├── avatar-customizer.js (40 KB)
│   ├── avatar-bridge.js (3.3 KB)
│   ├── avatar-shop.js (11 KB)
│   ├── archetype-engine.js (13 KB)
│   ├── social-hub.js (26 KB)   — Social features, leaderboards
│   ├── onboarding.js (31 KB)   — 7-step onboarding flow
│   ├── animations.js (15 KB)   — Premium animation engine
│   ├── move-library.js (9.1 KB)
│   ├── move-animations.js (1.2 KB)
│   ├── gsap-animations.js (5.1 KB)
│   ├── orbit-controls-lite.js (5.3 KB)
│   ├── sound-effects.js (7.7 KB)
│   ├── night-training.js (6.2 KB)
│   └── pricing.js (2.4 KB)
│
├── features/
│   └── shot-tracking/           — AI Shot Detection module
│       ├── ShotTrackingScreen.js (1,306 lines) — UI orchestrator (4 phases)
│       ├── shotDetection.js (834 lines) — YOLOX + color detection engine
│       ├── shotService.js (234 lines)  — Supabase persistence
│       ├── adaptiveLearning.js (973 lines) — 3-level learning system
│       ├── index.js (89 lines)  — Entry point / wiring
│       └── shot-tracking.css (18 KB)
│
├── models/
│   └── basketball_yolox_tiny.onnx (20 MB) — Custom 2-class YOLOX model
│
├── assets/
│   ├── favicon.svg
│   └── logo-icon.svg
│
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
│
└── tools/
    ├── batch-trainer.html
    ├── batch-trainer.js
    ├── rim-trainer.html
    └── rim-trainer.js
```

---

## HTML Pages

### index.html — Landing Page (94 KB)
Not authenticated. Marketing site with:
- **Navbar:** Fixed, logo + nav links + auth buttons + mobile hamburger
- **Hero:** Animated particles canvas, 3D tilt cards, CTAs
- **Stats Bar:** "12K+ active athletes, 225+ drills, 94% improvement"
- **How It Works:** 4-step process cards with scroll-reveal
- **Features:** 6-tab switchable demos (Drills, AI Coaching, Progress Tracking, Shot Tracker, Move Library, Social Hub)
- **Positions:** 5 position archetypes (PG, SG, SF, PF, C)
- **Testimonials:** Social proof cards
- **Pricing:** 3-tier (Starter $9, Pro $24, Elite $59)
- **Auth Modal:** Sign in / sign up overlay with Supabase

### dashboard.html — Main App (146 KB)
Authenticated. Single-page app with sidebar navigation:
- **Auth Guard:** Supabase session check → redirect to index if missing. Localhost bypass for dev.
- **Sidebar Navigation** (5 groups):
  - Home
  - Training: Log Session, Drills, Workouts
  - Analytics: Weekly Summary, History, Shot Tracker
  - AI Coach: AI Coach, Calendar, Notifications
  - Profile: Archetype, Shop, Pro Moves
  - Social: Social Hub
- **Home Panel:** Greeting, date pill, stats row (sessions/streak/XP), donut skill rings (Shooting/Dribbling/Defense/Game IQ), feature card grid
- **Tab-based Content:** Each sidebar item loads its own panel dynamically
- **Overlays:** Profile modal, settings, onboarding, shot tracker fullscreen

---

## CSS Design System

### Variables (`:root` in main.css)

**Colors:**
```css
--c-bg:        #0e1014          /* near-black background */
--c-surface:   #161921          /* card surface */
--c-surface2:  #1e2129          /* lighter surface */
--c-surface3:  #252830          /* hover surface */
--c-border:    rgba(255,255,255,0.06)
--c-amber:     #f5a623          /* PRIMARY ACCENT — basketball gold */
--c-amber-hover: #ffc04a
--c-amber-dim: rgba(245,166,35,0.12)
--c-amber-glow: rgba(245,166,35,0.25)
--c-white:     #f0ede6          /* off-white text */
--c-muted:     rgba(240,237,230,0.45)
--c-dimmer:    rgba(240,237,230,0.22)
--c-text-primary: #f0ede6
--c-text-secondary: rgba(240,237,230,0.65)
--c-text-tertiary: rgba(240,237,230,0.40)
--c-text-disabled: rgba(240,237,230,0.22)
--c-red:       #e84040
--c-green:     #56d364
--c-teal:      #2dd4bf
--c-blue:      #4ca3ff
--c-purple:    #bc8cff
```

**Spacing (8px grid):**
```css
--sp-1: 4px    --sp-5: 20px    --sp-10: 40px
--sp-2: 8px    --sp-6: 24px    --sp-12: 48px
--sp-3: 12px   --sp-7: 28px    --sp-16: 64px
--sp-4: 16px   --sp-8: 32px    --sp-20: 80px
```

**Typography:**
```css
--font-display: 'Barlow Condensed'   /* headings */
--font-body: 'Barlow'                /* body text */
--fs-xs: 11px   --fs-lg: 20px   --fs-3xl: 38px
--fs-sm: 13px   --fs-xl: 24px   --fs-4xl: 48px
--fs-base: 15px --fs-2xl: 30px
--fs-md: 17px
--fw-normal: 400  --fw-semi: 600  --fw-heavy: 800
--fw-medium: 500  --fw-bold: 700  --fw-black: 900
```

**Shadows:**
```css
--shadow-xs:    0 1px 2px rgba(0,0,0,0.2)
--shadow-sm:    0 2px 4px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.15)
--shadow-md:    0 4px 8px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)
--shadow-lg:    0 8px 24px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2)
--shadow-xl:    0 16px 48px rgba(0,0,0,0.35), 0 8px 16px rgba(0,0,0,0.2)
--shadow-card:  0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.25)
--shadow-glow:  0 0 40px rgba(245,166,35,0.08)
--shadow-amber: 0 0 20px rgba(245,166,35,0.15), 0 0 60px rgba(245,166,35,0.05)
```

**Glass Morphism:**
```css
--glass-bg:     rgba(22,25,33,0.7)
--glass-border: rgba(255,255,255,0.08)
--glass-blur:   20px
```

**Border Radius:**
```css
--r-sm: 10px   --r-lg: 24px
--r-md: 16px   --r-xl: 32px
```

**Transitions:**
```css
--transition:     0.25s cubic-bezier(0.4,0,0.2,1)
--ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1)
--ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1)
--duration-fast:  0.15s
--duration-base:  0.25s
--duration-slow:  0.4s
```

---

## Features Breakdown

### 1. Home Dashboard
- Greeting with user name + date pill
- Stats row: Sessions This Week, Day Streak, Total XP
- 4 donut skill rings: Shooting (orange), Dribbling (green), Defense (purple), Game IQ (pink)
- Feature card grid (2-col): Drills, Workouts, Shot Tracker, Weekly Summary, AI Coach, Pro Moves

### 2. Drill Engine (182 KB)
- 60+ drills across: Shooting, Ball Handling, Athleticism, Defense
- Each drill: name, description, duration, reps, difficulty, focus area, equipment, position filter
- AI-filtered drill generation based on user profile
- Drill animations with canvas rendering
- Save to weekly schedule

### 3. Shot Tracker (Manual)
- FG / 3PT / FT manual logging
- Session form with makes/attempts
- Saves to Supabase + grants XP

### 4. AI Shot Tracker (Video)
- Upload video or use live camera
- 4-phase flow: Rim Lock → 3PT Calibration → Tracking → Summary
- YOLOX-tiny model (20MB, 2-class: basketball + hoop)
- Color detection fallback (orange pixel scanning)
- Trajectory analysis for made/missed classification
- Real-time overlay with stats (made/attempts/accuracy/timer)
- Shot chart (half-court SVG with markers)
- Adaptive learning (color calibration, trajectory patterns, transfer learning)

### 5. AI Coach
- Anthropic Claude API integration
- Analyzes performance data (completed sets, success %, time)
- Generates adaptive weekly training plans
- Shows strength/weakness badges

### 6. Gamification
- XP system: +25 (log session), +15 (drill), +10 (generate), +30 (daily workout)
- 4-tier levels: Rookie (0), Hooper (200), All-Star (600), MVP (1500)
- Streak tracking
- Daily challenges

### 7. Avatar System
- Three.js 3D character
- Customizable: skin tone, hair, outfit, equipment
- Avatar shop with unlockable items
- Mini avatar in sidebar

### 8. Onboarding (7 steps)
1. Basic Info (name, age, height)
2. Play Style (position + archetype)
3. Skills Assessment (radar chart)
4. Goals (training goals)
5. Avatar Builder (3D customization)
6. AI Analysis (scouting report generation)
7. Scouting Report (final summary)

### 9. Social Hub
- Leaderboards
- Friend system
- Activity feed

### 10. Move Library
- Technique demonstrations
- Move animations
- Categorized by skill type

### 11. Progress Charts
- Chart.js visualizations
- Weekly session stats
- Shot accuracy trends
- Skill progression over time

### 12. Workouts
- Full training session programs
- Structured workout plans
- Timer integration

### 13. Weekly Summary
- AI-generated performance report
- Strengths + focus areas
- Week-over-week comparison

---

## Data Persistence

**LocalStorage Keys:**
- `courtiq-onboarding-data` — User profile, avatar, play style
- `courtiq-xp` — { xp, history }
- `courtiq-shot-sessions` — Shot session records
- `courtiq-drills` — Saved drills/weekly plan
- `courtiq-rim-calibration` — Rim lock position
- `courtiq-zone-history` — Shot zone stats
- `sb-txnsuzlgfafjdipfqkqe-auth-token` — Supabase auth (auto-managed)

**Supabase Tables:**
- `profiles` — User account + metadata
- `weekly_schedules` — AI training programs
- `ai_shot_sessions` — Shot tracking session summaries
- `ai_shots` — Individual shot records

---

## Integrations

| Service | Purpose | Used In |
|---------|---------|---------|
| Supabase | Auth + Database | auth.js, dashboard.js, shotService.js |
| Anthropic Claude | AI Coach | ai-coach.js |
| Chart.js 4.4.1 | Analytics charts | progress-charts.js |
| ONNX Runtime (WASM) | ML inference | shotDetection.js |
| Three.js | 3D avatar | avatar-3d.js |

---

## Animation System

**Page Loader:** Basketball animation + progress bar (3.5s max)
**Custom Cursor:** Spring-physics trailing ring (desktop only)
**Hero Particles:** Floating dots with connecting lines (canvas)
**Stats Counter:** Animated number counters (Intersection Observer)
**3D Card Tilt:** Parallax tilt on step cards
**Magnetic Buttons:** Hover attraction to cursor
**Mouse Parallax:** Hero section depth effect
**Scroll Reveal:** Fade-in on scroll
**Donut Rings:** requestAnimationFrame skill progress animation

---

## PWA Config

```json
{
  "name": "CourtIQ",
  "short_name": "CourtIQ",
  "start_url": "./dashboard.html",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0e1014",
  "theme_color": "#f5a623"
}
```

Service Worker: Cache-first for static assets, network-first for API calls. Cache version: `courtiq-v8`.
