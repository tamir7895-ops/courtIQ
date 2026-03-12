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
- Reuses existing stat data from `dashboard.js`

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
- Glass morphism background, hover: amber border glow + translateY(-2px)
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
- On load: `--pct` transitions from `0%` to actual value
- Duration: 0.8s with cubic-bezier easing (matches existing bar animation)
- Staggered: 100ms delay between each donut

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
- Player name: 12px, truncated if long
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
- Add "Home" item at top of sidebar (house icon)
- Home item click: switch to home panel + hide sidebar
- CSS class `.db-home-active` on `<body>` or `.db-layout`:
  - Hides sidebar
  - Main content expands to full width

### Breadcrumb
- Home panel: hide breadcrumb (not needed)
- Feature panels: show breadcrumb as today ("Dashboard / Drills")

---

## 5. Files to Modify

| File | Changes |
|------|---------|
| `dashboard.html` | Add home panel HTML, donut chart markup, profile widget in topbar, "Home" sidebar item |
| `styles/dashboard-redesign.css` | Home panel styles, nav cards grid, donut chart CSS |
| `js/dashboard.js` | Default to home tab, toggle sidebar visibility, donut animation JS |
| `styles/main.css` | `.db-home-active` sidebar hide rules, topbar profile widget |

No new files needed.

---

## 6. Responsive Behavior

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
- Quick stats: stack or scroll horizontal

### Ultra-small (<=400px)
- Nav cards: single column
- Donuts: 2x2, 56px diameter
- Profile widget: avatar + level badge only
