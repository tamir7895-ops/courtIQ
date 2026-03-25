# CourtIQ — Design Brief

## What is CourtIQ?

CourtIQ is an **AI-powered basketball training platform** — a personal AI coach in your pocket.
Players get personalized weekly training plans, real-time shot tracking using computer vision,
60+ position-specific drills, and AI-generated performance analysis — all in a mobile-first PWA.

**Target audience:** Recreational to competitive basketball players (high school to adult)
**Business model:** Freemium tiers — Starter $9/mo, Pro $24/mo, Elite $59/mo

---

## Current Design Language

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0e1014` | Near-black base, arena vibe |
| Surface 1 | `#161921` | Cards, elevated containers |
| Surface 2 | `#1e2129` | Secondary surfaces |
| Surface 3 | `#252830` | Deeper elements |
| **Amber (Primary)** | `#f5a623` | CTAs, active states, accents — basketball gold |
| Amber Hover | `#ffc04a` | Hover/pressed states |
| Text Primary | `#f0ede6` | Off-white, main text |
| Text Secondary | `rgba(240,237,230,0.65)` | Muted labels |
| Text Tertiary | `rgba(240,237,230,0.40)` | Hints, placeholders |
| Green | `#56d364` | Success, streaks, positive stats |
| Red | `#e84040` | Errors, missed shots, negative deltas |
| Purple | `#bc8cff` | XP/level badge, defense skill |
| Blue | `#4ca3ff` | Info, workout features |
| Teal | `#2dd4bf` | Calendar, summary features |
| Orange | `#ff7b54` | Pro Moves, warnings |

### Typography

| Role | Font | Weight | Size | Style |
|------|------|--------|------|-------|
| Hero Title | Barlow Condensed | 900 (Black) | 32–48px | UPPERCASE, 0.04em spacing |
| Section Title | Barlow Condensed | 700 (Bold) | 17–22px | UPPERCASE |
| Stat Values | Barlow Condensed | 900 | 22–42px | — |
| Body Text | Barlow | 400 | 14–15px | — |
| Labels | Barlow Condensed | 600–800 | 10–13px | UPPERCASE, 0.06em spacing |
| Buttons | Barlow Condensed | 700–800 | 13–15px | UPPERCASE |

### Visual Effects

- **Glassmorphism** — Cards with `backdrop-filter: blur(20px)`, `rgba(22,25,33,0.7)` bg, `rgba(255,255,255,0.08)` border
- **Amber Glow** — CTAs cast `0 8px 32px rgba(245,166,35,0.35)` shadow
- **Hover Lift** — Cards rise `translateY(-3px)` with amber border glow
- **Entrance Animations** — Fade-in-up with 50ms stagger between elements
- **Donut Rings** — CSS `conic-gradient` for skill progress (no SVG bloat)

### Spacing & Radius

- **Grid:** 8px base (4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64, 80)
- **Radius:** 10px (buttons), 16px (cards), 24px (panels), 100px (pills)
- **Touch targets:** minimum 44px

---

## App Structure — All Screens

### 1. Landing Page (index.html) — Public

```
┌─────────────────────────────────────────────────────────┐
│ NAVBAR: Logo │ How It Works │ Features │ Pricing │ Sign In │ Free Trial │
├─────────────────────────────────────────────────────────┤
│ HERO SECTION                                            │
│ "Your AI Basketball Coach"                              │
│ Particle canvas background + 3D tilt feature cards      │
│ CTA: "Start Free Trial" + "Watch Demo"                  │
├─────────────────────────────────────────────────────────┤
│ HOW IT WORKS (4 steps)                                  │
│ 1. Sign Up → 2. Set Goals → 3. Train → 4. Level Up     │
├─────────────────────────────────────────────────────────┤
│ FEATURES SHOWCASE (6 switchable tabs)                   │
│ Drills │ AI Coach │ Shot Tracker │ Analytics │ Social │ Avatar │
├─────────────────────────────────────────────────────────┤
│ POSITION ARCHETYPES (5 cards)                           │
│ PG │ SG │ SF │ PF │ C                                   │
├─────────────────────────────────────────────────────────┤
│ TESTIMONIALS (carousel)                                 │
├─────────────────────────────────────────────────────────┤
│ PRICING TABLE                                           │
│ Starter $9/mo │ Pro $24/mo │ Elite $59/mo               │
├─────────────────────────────────────────────────────────┤
│ FOOTER                                                  │
└─────────────────────────────────────────────────────────┘
```

### 2. Auth Modal (overlay on landing)

```
┌──────────────────────────────┐
│ CourtIQ Logo                 │
│ "Welcome Back"               │
│                              │
│ [Sign In] [Sign Up]          │
│                              │
│ Email _______________        │
│ Password ____________        │
│                              │
│ [Sign In →]                  │
│ ── or continue with ──       │
│ [Google] [Apple]             │
│                              │
│ Terms & Privacy links        │
└──────────────────────────────┘
```

### 3. Onboarding Flow (7 steps, full-screen overlay)

```
Step 1: Basic Info (name, age, height, weight, hand, position)
Step 2: Playstyle Analysis (scoring style, handles, passing, defense)
Step 3: Rate Your Skills (6 sliders 1-10 + radar chart)
Step 4: Goal Selection (up to 3 chips from 12 options)
Step 5: Create Avatar (DiceBear preview + customize)
Step 6: AI Analysis Loading (bouncing ball animation)
Step 7: Scouting Report (AI-generated player profile)
```

### 4. Dashboard — Authenticated App

#### Layout Structure
```
┌──────────────────────────────────────────────────────────┐
│ Profile Widget (top-right): Avatar(28px) + Name + Level  │
├──────────┬───────────────────────────────────────────────┤
│ SIDEBAR  │  MAIN CONTENT AREA                            │
│ (260px)  │                                               │
│          │  [Active Panel Content]                        │
│ Home     │                                               │
│ ──────── │                                               │
│ Training │                                               │
│  Log     │                                               │
│  Drills  │                                               │
│  Workouts│                                               │
│ ──────── │                                               │
│ Analytics│                                               │
│  Summary │                                               │
│  History │                                               │
│  Shots   │                                               │
│ ──────── │                                               │
│ AI Coach │                                               │
│  Coach   │                                               │
│  Calendar│                                               │
│  Alerts  │                                               │
│ ──────── │                                               │
│ Profile  │                                               │
│  Type    │                                               │
│  Shop    │                                               │
│  Moves   │                                               │
│ ──────── │                                               │
│ Social   │                                               │
│  Hub     │                                               │
├──────────┘                                               │
│ [Avatar + Name + Sign Out]                               │
└──────────────────────────────────────────────────────────┘
```

#### Mobile Layout
```
┌────────────────────────┐
│ Profile Widget (mini)  │
├────────────────────────┤
│                        │
│  [Panel Content]       │
│                        │
│                        │
├────────────────────────┤
│ Home│Drills│Coach│Shots│Profile │  ← Bottom Nav (5 tabs)
└────────────────────────┘
```

### 5. Home Panel (Default Landing)

```
┌─────────────────────────────────────────┐
│ 👋 Hey, [Name]!                         │
│ Ready to level up your game today?      │
│ ● Rookie · PG    [████████░░] 120/200 XP│
│ 🏀 Daily Challenge +30 XP               │
├─────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Sessions │ │ Streak   │ │ Total XP │ │
│ │    3     │ │   🔥 5   │ │  ⭐ 450  │ │
│ │ this week│ │   days   │ │  points  │ │
│ └──────────┘ └──────────┘ └──────────┘ │
├─────────────────────────────────────────┤
│ 🎯 72%    ⚡ 65%    🛡️ 48%    🧠 55%   │
│ Shooting  Dribbling Defense   Game IQ   │
│ (donut)   (donut)   (donut)   (donut)   │
├─────────────────────────────────────────┤
│ ┌────────────────┐ ┌────────────────┐   │
│ │ 🎯 Drills      │ │ 🏋️ Workouts    │   │
│ │ Practice       │ │ Full sessions  │   │
│ │ fundamentals → │ │              → │   │
│ ├────────────────┤ ├────────────────┤   │
│ │ 📊 Shot Tracker│ │ 📈 Summary     │   │
│ │ Log your       │ │ AI performance │   │
│ │ shooting     → │ │ report       → │   │
│ ├────────────────┤ ├────────────────┤   │
│ │ 🤖 AI Coach    │ │ ⚡ Pro Moves   │   │
│ │ Personalized   │ │ Learn new      │   │
│ │ tips         → │ │ techniques   → │   │
│ └────────────────┘ └────────────────┘   │
└─────────────────────────────────────────┘
```

### 6. Drills Panel

```
┌─────────────────────────────────────────┐
│ PERSONALIZED                            │
│ Personalized Drills                     │
│ AI-tailored drills for your position    │
│ [Generate Drills] [Browse Library]      │
├─────────────────────────────────────────┤
│ 🏀 Today's Workout                     │
│ [🌙 Night Training] [↻ New Workout]    │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│ │ Drill 1 │ │ Drill 2 │ │ Drill 3 │   │
│ └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│ Mode: [Generator] [Library] [My Plan]   │
├─────────────────────────────────────────┤
│ Position: [PG][SG][SF][PF][C]          │
│ Level: [Beginner][Intermediate][Advanced]│
│ Goal: [Shooting][Handles][Defense]...   │
│ [🎯 Generate My Drills →]              │
├─────────────────────────────────────────┤
│ Results Grid (expandable cards)         │
│ Each card: name, duration, difficulty,  │
│ focus area, equipment, + Save button    │
└─────────────────────────────────────────┘
```

### 7. Shot Tracker Panel

```
┌─────────────────────────────────────────┐
│ AI-POWERED                              │
│ Shot Tracker                            │
│ AI detects every shot in real-time      │
│ [📷 Live Camera] [📤 Upload Video]     │
├─────────────────────────────────────────┤
│ MANUAL INPUT                            │
│ Field Goals:  Made [__] Missed [__]     │
│ 3-Pointers:   Made [__] Missed [__]    │
│ Free Throws:  Made [__] Missed [__]    │
│ [Save Session]                          │
├─────────────────────────────────────────┤
│ RESULTS                                 │
│      ┌──────────┐                       │
│      │   72%    │  ← Conic gradient ring│
│      │ Overall  │                       │
│      └──────────┘                       │
│ FG: 68% (17/25) │ 3PT: 42% (5/12)     │
│ FT: 85% (17/20) │ Total: 39/57         │
├─────────────────────────────────────────┤
│ 📈 Shooting Progress (Chart.js line)    │
├─────────────────────────────────────────┤
│ 🗺️ Shot Chart (half-court heatmap)      │
├─────────────────────────────────────────┤
│ Session History (list of past sessions) │
└─────────────────────────────────────────┘
```

### 8. AI Coach Panel

```
┌─────────────────────────────────────────┐
│ AI-POWERED                              │
│ AI Coach                                │
│ Personalized weekly training plan       │
│ [Generate Plan] [View Calendar]         │
├─────────────────────────────────────────┤
│ Last Week's Performance                 │
│ ┌─────────────────┐ ┌─────────────────┐│
│ │ 🎯 Shooting     │ │ ⚡ Ball Handling ││
│ │ Sets: [__]      │ │ Sets: [__]      ││
│ │ Success %: [__] │ │ Success %: [__] ││
│ │ Time: [__] min  │ │ Time: [__] min  ││
│ │ Notes: [____]   │ │ Notes: [____]   ││
│ ├─────────────────┤ ├─────────────────┤│
│ │ 💪 Athleticism  │ │ 🛡️ Defense      ││
│ │ Sets: [__]      │ │ Sets: [__]      ││
│ │ Success %: [__] │ │ Success %: [__] ││
│ │ Time: [__] min  │ │ Time: [__] min  ││
│ │ Notes: [____]   │ │ Notes: [____]   ││
│ └─────────────────┘ └─────────────────┘│
├─────────────────────────────────────────┤
│ Equipment: [🏀][🏟️][📦][🎽][📏][💨][🏋️][📹]│
├─────────────────────────────────────────┤
│ [🏋️ Adjust My Program]                 │
├─────────────────────────────────────────┤
│ AI Output:                              │
│ Strengths: ● Shooting ● Ball Handling   │
│ Focus:     ● Defense ● Conditioning     │
│ Next Week Schedule (day-by-day cards)   │
└─────────────────────────────────────────┘
```

### 9. Weekly Summary Panel

```
┌─────────────────────────────────────────┐
│ SMART ANALYTICS                         │
│ Weekly Summary                          │
│ AI-generated performance analysis       │
│ [Generate Summary] [Log Sessions]       │
├─────────────────────────────────────────┤
│ 🤖 AI Coach • ↑ Trending Up            │
│ "Great consistency this week!"          │
│                                         │
│ ✦ Strengths   ⚑ Focus      🎯 Drill    │
│ • Shooting    • Defense    • Shuffle    │
│ • Handles     • Cardio    • Close-outs  │
├─────────────────────────────────────────┤
│ KPIs:                                   │
│ Shooting 72% ↑3% │ Dribbling 45m ↑5m   │
│ Vertical 28" ↑1" │ Sprint 4.2s ↓0.1s   │
├─────────────────────────────────────────┤
│ [Shooting % Chart] [Vertical Trend]     │
│ [Sprint Trend]     [Week-over-Week]     │
└─────────────────────────────────────────┘
```

### 10. Additional Panels

**Log Session** — Form: shots made/attempted, dribbling mins, vertical jump, sprint time, notes
**History** — Scrollable list of all past training weeks
**Calendar** — AI-generated weekly planner with day cards and off-days
**Notifications** — AI motivational alerts generator
**Archetype** — Player DNA analysis (height, position, playstyle → AI scouting report)
**Avatar Shop** — 3D avatar preview + cosmetic items to buy with earned coins
**Pro Moves** — Move library with animated breakdowns
**Social Hub** — Sub-tabs: Challenges (create/accept), Leaderboards (by country), Share Card (exportable stats PNG)

---

## Gamification System

| Level | Title | XP Required | Badge Color |
|-------|-------|-------------|-------------|
| 1 | Rookie | 0 | Gray |
| 2 | Hooper | 200 | Green |
| 3 | All-Star | 600 | Blue |
| 4 | MVP | 1500 | Gold (Amber) |

**XP Sources:**
- Log training session: +25 base
- Made shots: +2 per make
- Streaks: bonus for consecutive makes
- Accuracy bonus: scales with %
- Daily challenge: +30 XP
- Weekly streak: bonus for 5+ days

---

## Feature Color Coding

Each major feature has its own accent color for visual identity:

| Feature | Color | Hex |
|---------|-------|-----|
| Drills | Amber | `#f5a623` |
| Workouts | Blue | `#4ca3ff` |
| Shot Tracker | Green | `#56d364` |
| AI Coach | Purple | `#bc8cff` |
| Weekly Summary | Teal | `#2dd4bf` |
| Pro Moves | Orange | `#ff7b54` |
| Social | Green | `#56d364` |
| Archetype | Purple | `#bc8cff` |
| Shop | Amber | `#f5a623` |
| Calendar | Teal | `#2dd4bf` |

---

## Tech Stack (For Context)

- **Frontend:** Vanilla HTML5 + CSS3 + JS (no framework, no build step)
- **Backend:** Supabase (PostgreSQL + Auth)
- **AI:** Anthropic Claude API (coaching, analysis, scouting reports)
- **ML:** YOLOX-tiny ONNX model (basketball + rim detection in-browser)
- **3D:** Three.js (avatar rendering)
- **Charts:** Chart.js (progress visualizations)
- **Mobile:** Capacitor 8 (PWA → native Android/iOS wrapper)
- **Hosting:** GitHub Pages (PWA)

---

## Design Principles

1. **Dark + Gold = Basketball Authority** — The dark arena feel with gold highlights communicates premium sports tech
2. **Glass Morphism = Modern Tech** — Frosted cards with blur create depth and a futuristic feel
3. **Mobile First** — Everything designed for one-handed phone use on the court
4. **Data-Rich but Clean** — Lots of stats and charts, but organized with clear visual hierarchy
5. **Gamified Engagement** — XP, levels, streaks, and challenges keep players coming back
6. **AI as Core Value Prop** — Every major feature is "AI-powered" — the design should emphasize intelligence and personalization

---

## What We Need From The Redesign

The current design works but can be elevated. Key areas to focus on:

1. **Landing Page** — Make the hero section more impactful, improve the feature showcase flow, make pricing pop
2. **Dashboard Home** — The hub should feel exciting and motivating, like a game menu screen
3. **Navigation** — Currently has sidebar + top nav + bottom nav — could be simplified
4. **Cards & Components** — Consistent card design language across all panels
5. **Animations** — Smooth, purposeful micro-interactions (not excessive)
6. **Visual Consistency** — Unified spacing, shadows, and border-radius across all screens
7. **Empty States** — Beautiful empty states that encourage action (not just "No data yet")
8. **Shot Tracker UI** — The AI tracking screen needs to feel exciting and real-time

### Constraints
- Must stay dark mode (core brand identity)
- Amber/gold accent is non-negotiable (basketball = gold)
- Must work on mobile (primary use case is on the court)
- Barlow / Barlow Condensed fonts should stay (already loaded, fits the sport aesthetic)
- PWA — no native-only design patterns
