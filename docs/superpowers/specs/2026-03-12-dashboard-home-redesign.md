# Dashboard Home Screen & UI Redesign

**Date:** 2026-03-12
**Status:** Approved
**Scope:** Home panel, donut charts, profile widget, navigation restructure

---

## Overview

Restructure the CourtIQ dashboard from a sidebar-first layout to a **home-screen-first** navigation pattern. Users land on a central home screen with quick stats and navigation cards, then drill into feature pages that retain the sidebar.

## 1. Home Panel (`db-panel-home`)

### Behavior
- Default active panel on page load (replaces `db-panel-log`)
- Sidebar is **hidden** when home panel is active
- Sidebar appears when user navigates to any feature panel

### Layout (top to bottom)

#### 1.1 Hero Greeting
- "Hey, **[Name]**!" heading (reuses existing `db-main-header`)
- Subtitle: "Ready to level up your game today?"
- Current date pill

#### 1.2 Quick Stats Row
- 3 compact cards in a horizontal row (flex, equal width)
- **Sessions This Week** — calendar icon + count
- **Day Streak** — fire/lightning icon + count
- **Total XP** — star icon + number
- **Data sources** (existing in `dashboard.js` lines 2590-2650):
  - Sessions: `sessionCount` variable, computed from Supabase `training_sessions` table
  - Streak: `currentStreak` variable, computed from consecutive daily sessions
  - XP: `totalXP` from `gamification.js` → `GamificationEngine.state.xp`
- **Empty state** (new user, no data): show "0" for all values, not hidden

#### 1.3 Skill Donut Charts
- 4 donut charts in a horizontal row (flex, wraps on mobile)
- Shooting, Dribbling, Defense, Game IQ
- See Section 2 for implementation details

#### 1.4 Navigation Cards Grid
- 2x3 grid on desktop, 1-column on mobile
- 6 cards:
  1. **Drills** — "Practice fundamentals" → `data-tab="drills"`
  2. **Workouts** — "Full training sessions" → `data-tab="workouts"`
  3. **Shot Tracker** — "Log your shooting" → `data-tab="shots"`
  4. **Weekly Summary** — "AI performance report" → `data-tab="summary"`
  5. **AI Coach** — "Get personalized tips" → `data-tab="coach"`
  6. **Pro Moves** — "Learn new techniques" → `data-tab="moves"`
- Each card: icon (SVG/emoji) + title + subtitle + arrow indicator
- Glass morphism: `background: rgba(255,255,255,0.035)`, `backdrop-filter: blur(12px)`, `border: 1px solid rgba(255,255,255,0.07)`
- Hover: `border-color: rgba(245,166,35,0.28)`, `background: rgba(245,166,35,0.08)`, `translateY(-2px)`
- Click handler: switch to target tab + show sidebar

---

## 2. Donut Charts (Skill Stats)

### Replaces
- Current linear progress bars in `.db-skill-stats` (2x2 grid with 4px bars)

### Implementation: CSS `conic-gradient`

```
Structure per donut:
<div class="db-donut" data-skill="shooting" data-pct="57">
  <div class="db-donut-ring"></div>
  <div class="db-donut-center">
    <svg>...</svg>         <!-- skill icon -->
  </div>
  <div class="db-donut-label">57%</div>
  <div class="db-donut-name">SHOOTING</div>
</div>
```

### Ring Rendering
- `.db-donut-ring`: `conic-gradient(var(--skill-color) 0% var(--pct), rgba(255,255,255,0.07) var(--pct) 100%)`
- `border-radius: 50%` + inner mask creates donut shape
- Ring thickness: ~8px (outer 80px, inner 64px)
- CSS custom property `--pct` set via JS: `el.style.setProperty('--pct', pct + '%')`

### Center Icon
- Absolutely positioned in center of ring
- SVG icons per skill:
  - Shooting: crosshair/target
  - Dribbling: basketball bounce
  - Defense: shield
  - Game IQ: brain/lightbulb
- Size: 24px, color: skill gradient primary color

### Colors (same as existing)
- Shooting: `#f5a623 → #ff6b35` (amber-orange)
- Dribbling: `#3ecf8e → #0ea5e9` (teal-cyan)
- Defense: `#a78bfa → #818cf8` (purple)
- Game IQ: `#f472b6 → #ec4899` (pink)

### Animation
- **Mechanism:** JS `requestAnimationFrame` loop increments `--pct` from 0 to target value
  - `conic-gradient` does not support CSS transitions, so JS animation is required
  - Use `requestAnimationFrame` with eased interpolation (cubic-bezier approximation)
- Duration: 0.8s total per donut
- Staggered: 100ms delay between each donut start
- **Empty state:** Show 0% ring (fully gray) with icon still visible

### Data Sources
- Percentages computed in `dashboard.js` (lines 2613-2622):
  - `shooting = Math.min(97, base + shotEv * 12 + trainEv * 2)`
  - `dribbling = Math.min(97, base + trainEv * 4 + challengeEv * 3)`
  - `defense = Math.min(97, base + challengeEv * 6 + trainEv * 2)`
  - `gameiq = XPSystem.getProgress(totalXP)` (primary), fallback: `Math.min(95, base + trainEv * 3)`
- Existing `setStat(name, pct)` function will be extended to also update donut `--pct`

### Sizing
- Desktop: 80px diameter
- Mobile (<=640px): 64px diameter
- Ultra-small (<=400px): 56px diameter

---

## 3. Profile Widget (Top-Right)

### Placement
- Inside `.db-topbar`, positioned right (flex: `justify-content: space-between`)
- Left side: breadcrumb (existing)
- Right side: profile widget (new)
- Visible on **all** panels (home + feature panels)

### Content
- Avatar: 28px circle (reuses existing mini avatar system)
- Player name: 12px, `max-width: 100px`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`
- Level badge: pill with rank name (Rookie/Hooper/All-Star/MVP), styled with amber accent

### Interaction
- Click → opens existing profile modal (`profile-modal-overlay`)

### Styling
- Glass morphism: `rgba(255,255,255,0.035)` background
- Border: `1px solid rgba(255,255,255,0.07)`
- Border-radius: 20px (pill shape)
- Padding: 4px 10px 4px 4px
- Gap: 8px between avatar and text
- Hover: subtle brightness increase

---

## 4. Navigation Logic Changes

### Tab Switching (modify `dashboard.js`)

```
Current flow:
  Page load → show db-panel-log → sidebar visible

New flow:
  Page load → show db-panel-home → sidebar HIDDEN
  Click nav card → show target panel → sidebar VISIBLE
  Click sidebar "Home" → show db-panel-home → sidebar HIDDEN
```

### Sidebar Modifications
- Add "Home" item at top of sidebar (house icon), above the "Training" group
- Home item click: switch to home panel + hide sidebar
- CSS class `.db-home-active` on `.db-layout-root`:
  - Hides `.db-sidebar` via `display: none`
  - `.db-main` expands to full width (remove `margin-left`)
- **Mobile:** Home item appears in the sidebar overlay drawer (same as other items). No separate bottom nav needed — the home screen IS the primary mobile landing.

### Breadcrumb
- Home panel: hide breadcrumb element (`display: none`) — the `switchTab` function must special-case `"home"` to hide the breadcrumb container
- Feature panels: show breadcrumb as today ("Dashboard / Drills")
- Add `"home": "Home"` to the `breadcrumbNames` map (even though it's hidden, for consistency)

### Tabs Not on Home Screen
- Tabs `log`, `history`, `calendar`, `notifications`, `archetype`, `shop`, `social` are intentionally NOT on the home nav cards — they are accessible only via the sidebar on feature pages. The home screen highlights the 6 most-used features.

---

## 5. Files to Modify

| File | Changes |
|------|---------|
| `dashboard.html` | Add home panel HTML, donut chart markup, profile widget in topbar, "Home" sidebar item |
| `styles/dashboard-redesign.css` | Home panel styles, nav cards grid, donut chart CSS |
| `js/dashboard.js` | Default to home tab, toggle sidebar visibility, donut animation JS |
| `styles/main.css` | `.db-home-active` sidebar hide rules, topbar profile widget |

No new files needed.

### CSS Organization Rule
- `dashboard-redesign.css`: all new component styles (home panel, nav cards, donuts, profile widget)
- `main.css`: only layout-level changes (`.db-home-active` sidebar toggle, topbar flex adjustment)

---

## 6. Accessibility

- Donut charts: each `.db-donut` gets `role="img"` and `aria-label="Shooting: 57%"`
- Nav cards: use `<button>` elements (not `<div>`) with descriptive text
- Profile widget: `<button>` with `aria-label="Open profile"`

---

## 7. Responsive Behavior

### Desktop (>1024px)
- Home: full-width content, no sidebar
- Feature pages: 260px sidebar + content
- Nav cards: 2x3 grid
- Donuts: 4 in a row

### Tablet (641-1024px)
- Home: full-width, nav cards 2x3
- Feature pages: sidebar as overlay
- Donuts: 4 in a row (smaller)

### Mobile (<=640px)
- Home: full-width, nav cards single column
- Donuts: 2x2 grid
- Profile widget: avatar only (hide name on very small screens)
- Quick stats: horizontal scroll (`overflow-x: auto`, `flex-wrap: nowrap`)

### Ultra-small (<=400px)
- Nav cards: single column
- Donuts: 2x2, 56px diameter
- Profile widget: avatar + level badge only
