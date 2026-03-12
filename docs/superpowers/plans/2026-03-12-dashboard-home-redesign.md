# Dashboard Home Screen & UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the CourtIQ dashboard from sidebar-first to a home-screen-first navigation pattern with donut skill charts, profile widget, and nav card grid.

**Architecture:** Add a new `db-panel-home` panel as the default landing view. When active, the sidebar is hidden via `.db-home-active` on `.db-layout-root`. Users navigate to feature panels via nav cards; sidebar appears on feature panels with a "Home" item to return. Donut charts use CSS `conic-gradient` with JS `requestAnimationFrame` animation. Profile widget lives in the topbar and is visible on all panels.

**Tech Stack:** Vanilla HTML, CSS (conic-gradient, glass morphism), vanilla JS (requestAnimationFrame)

**Spec:** `docs/superpowers/specs/2026-03-12-dashboard-home-redesign.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `dashboard.html` | Add home panel HTML, donut chart markup, profile widget in topbar, "Home" sidebar item, update inline skill stats script |
| `styles/dashboard-redesign.css` | All new component styles: home panel layout, nav cards grid, donut charts, profile widget, quick stats row |
| `styles/main.css` | Layout-level changes: `.db-home-active` sidebar toggle, topbar flex adjustment for profile widget |
| `js/dashboard.js` | Default to home tab, toggle sidebar visibility on tab switch, breadcrumb home special case |

No new files needed.

---

## Chunk 1: HTML Structure

### Task 1: Add "Home" sidebar item

**Files:**
- Modify: `dashboard.html:124-126` (inside `.db-sidebar-nav`, before first group)

- [ ] **Step 1: Add Home button above the Training group**

Insert immediately after `<nav class="db-sidebar-nav" ...>` (line 124) and before the first `<div class="db-sidebar-group">` (line 125):

```html
      <!-- Home (standalone, above groups) -->
      <button class="db-sidebar-item db-sidebar-item--home" data-tab="home">
        <span class="db-sidebar-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </span>
        <span class="db-sidebar-text">Home</span>
      </button>
      <div class="db-sidebar-home-sep" aria-hidden="true"></div>
```

- [ ] **Step 2: Remove `active` class from the Log Session button**

Change line 127 from:
```html
        <button class="db-sidebar-item active" data-tab="log">
```
to:
```html
        <button class="db-sidebar-item" data-tab="log">
```

- [ ] **Step 3: Verify in browser — Home item appears at top of sidebar**

Open dashboard.html, check sidebar shows Home item with house icon above Training group. Log Session no longer has `active` class.

- [ ] **Step 4: Commit**

```bash
git add dashboard.html
git commit -m "feat: add Home sidebar item above Training group"
```

---

### Task 2: Add profile widget to topbar

**Files:**
- Modify: `dashboard.html:230-232` (`.db-topbar-right` div)

- [ ] **Step 1: Add profile widget markup inside `.db-topbar-right`**

Replace the existing `.db-topbar-right` div (lines 230-232):

```html
<!-- BEFORE -->
<div class="db-topbar-right">
  <span class="db-topbar-date" id="db-topbar-date"></span>
</div>
```

With:

```html
<div class="db-topbar-right">
  <span class="db-topbar-date" id="db-topbar-date"></span>
  <button class="db-profile-widget" id="db-profile-widget" aria-label="Open profile" onclick="if(document.getElementById('profile-modal-overlay'))document.getElementById('profile-modal-overlay').classList.add('active');">
    <div class="db-profile-widget-avatar" id="db-pw-avatar"></div>
    <span class="db-profile-widget-name" id="db-pw-name"></span>
    <span class="db-profile-widget-badge" id="db-pw-badge">Rookie</span>
  </button>
</div>
```

- [ ] **Step 2: Verify in browser — widget appears in topbar right side**

- [ ] **Step 3: Commit**

```bash
git add dashboard.html
git commit -m "feat: add profile widget to topbar"
```

---

### Task 3: Add home panel HTML

**Files:**
- Modify: `dashboard.html` — insert new panel before `db-panel-log` (before line 407)

- [ ] **Step 1: Add the complete home panel markup**

Insert before `<!-- ── TAB: LOG ── -->` (line 406):

```html
    <!-- ── TAB: HOME ── -->
    <div class="db-panel active" id="db-panel-home">

      <!-- 1.1 Hero Greeting -->
      <div class="db-home-hero">
        <h1 class="db-home-greeting" id="db-home-greeting">Hey, <strong>Player</strong>!</h1>
        <p class="db-home-subtitle">Ready to level up your game today?</p>
        <div class="db-home-date-pill" id="db-home-date"></div>
      </div>

      <!-- 1.2 Quick Stats Row -->
      <div class="db-home-stats-row">
        <div class="db-home-stat">
          <svg class="db-home-stat-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <div class="db-home-stat-info">
            <span class="db-home-stat-value" id="db-home-sessions">0</span>
            <span class="db-home-stat-label">Sessions This Week</span>
          </div>
        </div>
        <div class="db-home-stat">
          <svg class="db-home-stat-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <div class="db-home-stat-info">
            <span class="db-home-stat-value" id="db-home-streak">0</span>
            <span class="db-home-stat-label">Day Streak</span>
          </div>
        </div>
        <div class="db-home-stat">
          <svg class="db-home-stat-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <div class="db-home-stat-info">
            <span class="db-home-stat-value" id="db-home-xp">0</span>
            <span class="db-home-stat-label">Total XP</span>
          </div>
        </div>
      </div>

      <!-- 1.3 Skill Donut Charts -->
      <div class="db-donuts-row" id="db-donuts-row">
        <div class="db-donut" data-skill="shooting" data-pct="0" role="img" aria-label="Shooting: 0%">
          <div class="db-donut-ring"></div>
          <div class="db-donut-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
          </div>
          <div class="db-donut-label">0%</div>
          <div class="db-donut-name">SHOOTING</div>
        </div>
        <div class="db-donut" data-skill="dribbling" data-pct="0" role="img" aria-label="Dribbling: 0%">
          <div class="db-donut-ring"></div>
          <div class="db-donut-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/><path d="M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10"/></svg>
          </div>
          <div class="db-donut-label">0%</div>
          <div class="db-donut-name">DRIBBLING</div>
        </div>
        <div class="db-donut" data-skill="defense" data-pct="0" role="img" aria-label="Defense: 0%">
          <div class="db-donut-ring"></div>
          <div class="db-donut-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="db-donut-label">0%</div>
          <div class="db-donut-name">DEFENSE</div>
        </div>
        <div class="db-donut" data-skill="gameiq" data-pct="0" role="img" aria-label="Game IQ: 0%">
          <div class="db-donut-ring"></div>
          <div class="db-donut-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          </div>
          <div class="db-donut-label">0%</div>
          <div class="db-donut-name">GAME IQ</div>
        </div>
      </div>

      <!-- 1.4 Navigation Cards Grid -->
      <div class="db-home-nav-grid">
        <button class="db-home-nav-card" onclick="dbSwitchTab('drills')">
          <span class="db-home-nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
          </span>
          <div class="db-home-nav-text">
            <span class="db-home-nav-title">Drills</span>
            <span class="db-home-nav-sub">Practice fundamentals</span>
          </div>
          <span class="db-home-nav-arrow">&rsaquo;</span>
        </button>
        <button class="db-home-nav-card" onclick="dbSwitchTab('workouts')">
          <span class="db-home-nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/><path d="M2 12h20"/></svg>
          </span>
          <div class="db-home-nav-text">
            <span class="db-home-nav-title">Workouts</span>
            <span class="db-home-nav-sub">Full training sessions</span>
          </div>
          <span class="db-home-nav-arrow">&rsaquo;</span>
        </button>
        <button class="db-home-nav-card" onclick="dbSwitchTab('shots')">
          <span class="db-home-nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </span>
          <div class="db-home-nav-text">
            <span class="db-home-nav-title">Shot Tracker</span>
            <span class="db-home-nav-sub">Log your shooting</span>
          </div>
          <span class="db-home-nav-arrow">&rsaquo;</span>
        </button>
        <button class="db-home-nav-card" onclick="dbSwitchTab('summary')">
          <span class="db-home-nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </span>
          <div class="db-home-nav-text">
            <span class="db-home-nav-title">Weekly Summary</span>
            <span class="db-home-nav-sub">AI performance report</span>
          </div>
          <span class="db-home-nav-arrow">&rsaquo;</span>
        </button>
        <button class="db-home-nav-card" onclick="dbSwitchTab('coach')">
          <span class="db-home-nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </span>
          <div class="db-home-nav-text">
            <span class="db-home-nav-title">AI Coach</span>
            <span class="db-home-nav-sub">Get personalized tips</span>
          </div>
          <span class="db-home-nav-arrow">&rsaquo;</span>
        </button>
        <button class="db-home-nav-card" onclick="dbSwitchTab('moves')">
          <span class="db-home-nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </span>
          <div class="db-home-nav-text">
            <span class="db-home-nav-title">Pro Moves</span>
            <span class="db-home-nav-sub">Learn new techniques</span>
          </div>
          <span class="db-home-nav-arrow">&rsaquo;</span>
        </button>
      </div>

    </div><!-- /db-panel-home -->
```

- [ ] **Step 2: Remove `active` class from `db-panel-log`**

Change line ~407:
```html
<div class="db-panel active" id="db-panel-log">
```
to:
```html
<div class="db-panel" id="db-panel-log">
```

- [ ] **Step 3: Verify in browser — home panel renders with all sections**

- [ ] **Step 4: Commit**

```bash
git add dashboard.html
git commit -m "feat: add home panel with hero, stats, donuts, nav cards"
```

---

## Chunk 2: CSS Styles

### Task 4: Add home panel and nav cards CSS

**Files:**
- Modify: `styles/dashboard-redesign.css` — append new sections

- [ ] **Step 1: Add home panel hero, stats row, and nav cards CSS**

Append to `styles/dashboard-redesign.css`:

```css
/* ══════════════════════════════════════════════════════════
   HOME PANEL
   ══════════════════════════════════════════════════════════ */

/* ── Hero Greeting ── */
.db-home-hero {
  text-align: center;
  padding: 32px 0 24px;
}
.db-home-greeting {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: var(--c-white, #f0ede6);
  margin: 0 0 6px;
}
.db-home-greeting strong {
  color: var(--c-amber, #f5a623);
}
.db-home-subtitle {
  font-size: 14px;
  color: var(--c-muted, rgba(240,237,230,0.5));
  margin: 0 0 12px;
}
.db-home-date-pill {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: var(--c-amber, #f5a623);
  background: rgba(245,166,35,0.1);
  border: 1px solid rgba(245,166,35,0.2);
  border-radius: 100px;
  padding: 4px 14px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

/* ── Quick Stats Row ── */
.db-home-stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
}
.db-home-stat {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.035);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  padding: 14px 16px;
}
.db-home-stat-icon {
  color: var(--c-amber, #f5a623);
  flex-shrink: 0;
}
.db-home-stat-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.db-home-stat-value {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: var(--c-white, #f0ede6);
  line-height: 1;
}
.db-home-stat-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--c-muted, rgba(240,237,230,0.5));
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── Navigation Cards Grid ── */
.db-home-nav-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 28px;
}
.db-home-nav-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(255,255,255,0.035);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 18px 16px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.15s;
  text-align: left;
  color: inherit;
  font: inherit;
}
.db-home-nav-card:hover {
  border-color: rgba(245,166,35,0.28);
  background: rgba(245,166,35,0.08);
  transform: translateY(-2px);
}
.db-home-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(245,166,35,0.1);
  color: var(--c-amber, #f5a623);
  flex-shrink: 0;
}
.db-home-nav-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.db-home-nav-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--c-white, #f0ede6);
}
.db-home-nav-sub {
  font-size: 11px;
  color: var(--c-muted, rgba(240,237,230,0.5));
}
.db-home-nav-arrow {
  font-size: 22px;
  color: var(--c-muted, rgba(240,237,230,0.3));
  flex-shrink: 0;
}
```

- [ ] **Step 2: Verify — nav cards render in 2x3 grid with glass morphism**

- [ ] **Step 3: Commit**

```bash
git add styles/dashboard-redesign.css
git commit -m "feat: add home panel hero, stats, nav cards CSS"
```

---

### Task 5: Add donut chart CSS

**Files:**
- Modify: `styles/dashboard-redesign.css` — append donut styles

- [ ] **Step 1: Add donut chart CSS**

Append to `styles/dashboard-redesign.css`:

```css
/* ══════════════════════════════════════════════════════════
   DONUT CHARTS
   ══════════════════════════════════════════════════════════ */
.db-donuts-row {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.db-donut {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.db-donut-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: conic-gradient(
    var(--skill-color, #f5a623) 0% var(--pct, 0%),
    rgba(255,255,255,0.07) var(--pct, 0%) 100%
  );
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.db-donut-ring::before {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  background: var(--c-bg, #0e1014);
}
.db-donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.db-donut-center svg {
  width: 24px;
  height: 24px;
}

/* Skill colors */
.db-donut[data-skill="shooting"] { --skill-color: #f5a623; }
.db-donut[data-skill="shooting"] .db-donut-center svg { stroke: #f5a623; }

.db-donut[data-skill="dribbling"] { --skill-color: #3ecf8e; }
.db-donut[data-skill="dribbling"] .db-donut-center svg { stroke: #3ecf8e; }

.db-donut[data-skill="defense"] { --skill-color: #a78bfa; }
.db-donut[data-skill="defense"] .db-donut-center svg { stroke: #a78bfa; }

.db-donut[data-skill="gameiq"] { --skill-color: #f472b6; }
.db-donut[data-skill="gameiq"] .db-donut-center svg { stroke: #f472b6; }

.db-donut-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--c-white, #f0ede6);
  margin-top: 2px;
}
.db-donut-name {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--c-muted, rgba(240,237,230,0.5));
  text-transform: uppercase;
}
```

- [ ] **Step 2: Verify — donuts render as circles with correct colors and icons**

- [ ] **Step 3: Commit**

```bash
git add styles/dashboard-redesign.css
git commit -m "feat: add donut chart CSS with conic-gradient"
```

---

### Task 6: Add profile widget CSS

**Files:**
- Modify: `styles/dashboard-redesign.css` — append profile widget styles

- [ ] **Step 1: Add profile widget CSS**

Append to `styles/dashboard-redesign.css`:

```css
/* ══════════════════════════════════════════════════════════
   PROFILE WIDGET (topbar)
   ══════════════════════════════════════════════════════════ */
.db-profile-widget {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.035);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 4px 10px 4px 4px;
  cursor: pointer;
  transition: filter 0.2s;
  color: inherit;
  font: inherit;
}
.db-profile-widget:hover {
  filter: brightness(1.15);
}
.db-profile-widget-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(245,166,35,0.15);
  color: var(--c-amber, #f5a623);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
  overflow: hidden;
}
.db-profile-widget-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--c-white, #f0ede6);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-profile-widget-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--c-amber, #f5a623);
  background: rgba(245,166,35,0.12);
  border: 1px solid rgba(245,166,35,0.25);
  border-radius: 100px;
  padding: 2px 8px;
  white-space: nowrap;
}

/* ── Sidebar Home separator ── */
.db-sidebar-home-sep {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 8px 16px 12px;
}
.db-sidebar.collapsed .db-sidebar-home-sep {
  margin: 8px 8px 12px;
}
```

- [ ] **Step 2: Verify — profile widget appears as pill shape in topbar**

- [ ] **Step 3: Commit**

```bash
git add styles/dashboard-redesign.css
git commit -m "feat: add profile widget and sidebar home separator CSS"
```

---

### Task 7: Add layout-level CSS for home-active state

**Files:**
- Modify: `styles/main.css` — append `.db-home-active` rules

- [ ] **Step 1: Add `.db-home-active` layout rules to main.css**

Note: `.db-topbar` and `.db-topbar-right` flex rules already exist in `styles/components.css` (lines 296-326). Do NOT duplicate them.

Append to `styles/main.css`:

```css
/* ══════════════════════════════════════════════════════════
   HOME SCREEN ACTIVE STATE
   When home panel is active, hide sidebar and expand main
   ══════════════════════════════════════════════════════════ */
.db-layout-root.db-home-active .db-sidebar { display: none; }
.db-layout-root.db-home-active .db-sidebar-mobile-toggle { display: none; }
.db-layout-root.db-home-active .db-sidebar-overlay { display: none; }
.db-layout-root.db-home-active .db-main { margin-left: 0 !important; }

/* Hide shared widgets on home panel — they have home-specific versions */
.db-layout-root.db-home-active .db-main-header,
.db-layout-root.db-home-active .db-player-bar,
.db-layout-root.db-home-active .db-top-widgets,
.db-layout-root.db-home-active .dc-card,
.db-layout-root.db-home-active .db-quick-actions,
.db-layout-root.db-home-active .db-skill-stats,
.db-layout-root.db-home-active .db-context-row,
.db-layout-root.db-home-active .db-breadcrumb { display: none !important; }
```

- [ ] **Step 2: Verify — when `.db-home-active` is toggled, sidebar hides and main expands**

- [ ] **Step 3: Commit**

```bash
git add styles/main.css
git commit -m "feat: add .db-home-active layout rules"
```

---

### Task 8: Add responsive CSS for home panel

**Files:**
- Modify: `styles/dashboard-redesign.css` — append responsive rules

- [ ] **Step 1: Add responsive breakpoints**

Append to `styles/dashboard-redesign.css`:

```css
/* ══════════════════════════════════════════════════════════
   HOME PANEL RESPONSIVE
   ══════════════════════════════════════════════════════════ */

/* Tablet + small desktop */
@media (max-width: 1024px) {
  .db-home-nav-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Mobile */
@media (max-width: 640px) {
  .db-home-hero { padding: 20px 0 16px; }
  .db-home-greeting { font-size: 26px; }

  .db-home-stats-row {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 4px;
  }
  .db-home-stats-row::-webkit-scrollbar { display: none; }
  .db-home-stat { min-width: 140px; flex: 0 0 auto; }

  .db-donuts-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    justify-items: center;
  }
  .db-donut-ring { width: 64px; height: 64px; }
  .db-donut-ring::before { inset: 6px; }
  .db-donut-center svg { width: 20px; height: 20px; }

  .db-home-nav-grid { grid-template-columns: 1fr; }

  .db-profile-widget-name { display: none; }
}

/* Ultra-small */
@media (max-width: 400px) {
  .db-donut-ring { width: 56px; height: 56px; }
  .db-donut-ring::before { inset: 5px; }
  .db-donut-center svg { width: 18px; height: 18px; }
  .db-donut-label { font-size: 14px; }

  .db-profile-widget-badge { display: inline; }
  .db-topbar-date { display: none; }
}
```

- [ ] **Step 2: Verify at different viewport widths**

- [ ] **Step 3: Commit**

```bash
git add styles/dashboard-redesign.css
git commit -m "feat: add home panel responsive breakpoints"
```

---

## Chunk 3: JavaScript Logic

### Task 9: Update `dbSwitchTab` for home panel

**Files:**
- Modify: `js/dashboard.js:256-319` — add home panel special cases

- [ ] **Step 1: Add home-active toggle and breadcrumb home special case**

In `dbSwitchTab` function (line 256), make these changes:

**After** `if (panel) panel.classList.add('active');` (line 272), add:

```javascript
    // Toggle home-active state: hide sidebar on home, show on others
    var layoutRoot = document.querySelector('.db-layout-root');
    if (layoutRoot) {
      if (id === 'home') {
        layoutRoot.classList.add('db-home-active');
      } else {
        layoutRoot.classList.remove('db-home-active');
      }
    }
```

**In the `breadcrumbNames` object** (line 275), add these entries:

```javascript
    home: 'Home', summary: 'Weekly Summary', shots: 'Shot Tracker', coach: 'AI Coach',
```

**After** `if (bcEl) bcEl.textContent = breadcrumbNames[id] || id;` (line 282), add:

```javascript
    // Hide breadcrumb on home panel
    var topbar = document.getElementById('db-topbar');
    if (topbar) {
      var bc = topbar.querySelector('.db-breadcrumb');
      if (bc) bc.style.display = (id === 'home') ? 'none' : '';
    }
```

- [ ] **Step 2: Verify — clicking nav cards switches to correct panel and shows sidebar. Clicking Home hides sidebar.**

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: add home panel toggle and breadcrumb logic to switchTab"
```

---

### Task 10: Default to home panel on page load

**Files:**
- Modify: `js/dashboard.js` — add after sidebar init block (line ~1115)

- [ ] **Step 1: Add default home panel init**

After the `initSidebar` IIFE closing `})();` (line 1115), add:

```javascript
  // Default to home panel on page load
  (function() {
    dbSwitchTab('home', null);
  })();
```

- [ ] **Step 2: Verify — page loads showing home panel, sidebar hidden**

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: default to home panel on page load"
```

---

### Task 11: Add donut animation JS

**Files:**
- Modify: `dashboard.html` — update the inline skill stats script (lines 2597-2648)

- [ ] **Step 1: Extend `setStat` to also update donut charts with animated ring**

Replace the entire inline script block (lines 2597-2648) with:

```html
<!-- ── Skill Stats Renderer ── -->
<script>
(function () {
  function renderSkillStats() {
    var xpData   = (typeof XPSystem !== 'undefined') ? XPSystem.load() : { xp: 0, history: [] };
    var history  = xpData.history || [];
    var totalXP  = xpData.xp || 0;

    var shotEv     = history.filter(function(e) { return /shot|basket|scoring/i.test(e.reason); }).length;
    var trainEv    = history.filter(function(e) { return /drill|session|workout|check/i.test(e.reason); }).length;
    var challengeEv= history.filter(function(e) { return /daily|challenge|streak/i.test(e.reason); }).length;

    var profile = (typeof PlayerProfile !== 'undefined') ? PlayerProfile.load() : null;
    var sl   = profile ? (profile.skillLevel || '').toLowerCase() : '';
    var base = sl.indexOf('adv') !== -1 ? 65 : sl.indexOf('int') !== -1 ? 45 : 30;

    var gameiq    = (typeof XPSystem !== 'undefined') ? XPSystem.getProgress(totalXP) : Math.min(95, base + trainEv * 3);
    var shooting  = Math.min(97, base + shotEv * 12 + trainEv * 2);
    var dribbling = Math.min(97, base + trainEv * 4 + challengeEv * 3);
    var defense   = Math.min(97, base + challengeEv * 6 + trainEv * 2);

    if (totalXP === 0) { shooting = dribbling = defense = gameiq = 0; }

    setStat('shooting',  shooting);
    setStat('dribbling', dribbling);
    setStat('defense',   defense);
    setStat('gameiq',    gameiq);

    // Update home panel quick stats
    updateHomeStats(totalXP);
  }

  function setStat(name, pct) {
    // Legacy linear bars
    var pctEl = document.getElementById('stat-' + name);
    var barEl = document.getElementById('stat-' + name + '-bar');
    if (pctEl) pctEl.textContent = pct > 0 ? pct + '%' : '\u2013';
    if (barEl) setTimeout(function() { barEl.style.width = pct + '%'; }, 150);

    // Donut chart update
    var donut = document.querySelector('.db-donut[data-skill="' + name + '"]');
    if (donut) {
      donut.setAttribute('data-pct', pct);
      donut.setAttribute('aria-label', name.charAt(0).toUpperCase() + name.slice(1) + ': ' + pct + '%');
      var label = donut.querySelector('.db-donut-label');
      if (label) label.textContent = pct > 0 ? pct + '%' : '0%';
      if (!_skipDonutAnim) animateDonut(donut, pct);
    }
  }

  // requestAnimationFrame donut animation
  function animateDonut(donut, targetPct) {
    var ring = donut.querySelector('.db-donut-ring');
    if (!ring) return;
    var start = null;
    var duration = 800;
    var from = 0;

    function step(timestamp) {
      if (!start) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = from + (targetPct - from) * eased;
      ring.style.setProperty('--pct', current + '%');
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function updateHomeStats(totalXP) {
    // Sessions this week
    var sessEl = document.getElementById('db-home-sessions');
    if (sessEl) {
      var countEl = document.getElementById('db-session-count');
      var count = 0;
      if (countEl) {
        var match = countEl.textContent.match(/(\d+)/);
        if (match) count = parseInt(match[1], 10);
      }
      sessEl.textContent = count;
    }

    // Streak
    var streakEl = document.getElementById('db-home-streak');
    if (streakEl) {
      var badge = document.getElementById('db-streak-badge');
      var streak = 0;
      if (badge && badge.textContent) {
        var m = badge.textContent.match(/(\d+)/);
        if (m) streak = parseInt(m[1], 10);
      }
      streakEl.textContent = streak;
    }

    // XP
    var xpEl = document.getElementById('db-home-xp');
    if (xpEl) xpEl.textContent = totalXP || 0;
  }

  var _skipDonutAnim = true; // Skip animation during first renderSkillStats

  function init() {
    _skipDonutAnim = true;
    renderSkillStats();
    _skipDonutAnim = false;

    // Stagger donut animations on initial load
    var donuts = document.querySelectorAll('.db-donut');
    donuts.forEach(function(d, i) {
      var pct = parseInt(d.getAttribute('data-pct') || '0', 10);
      setTimeout(function() { animateDonut(d, pct); }, i * 100);
    });

    if (typeof XPSystem !== 'undefined' && XPSystem.render) {
      var _origRender = XPSystem.render;
      XPSystem.render = function() {
        _origRender.apply(this, arguments);
        renderSkillStats();
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 200);
  }
})();
</script>
```

- [ ] **Step 2: Verify — donuts animate from 0 to target percentage with stagger**

- [ ] **Step 3: Commit**

```bash
git add dashboard.html
git commit -m "feat: add donut animation JS with requestAnimationFrame"
```

---

### Task 12: Populate profile widget and home greeting

**Files:**
- Modify: `js/dashboard.js` — add profile widget init inside authGuard

- [ ] **Step 1: Add profile widget population after auth guard**

Inside the `authGuard` function (after line ~56 where sidebar avatar is set), add:

```javascript
    // Populate topbar profile widget
    var pwName = document.getElementById('db-pw-name');
    var pwAvatar = document.getElementById('db-pw-avatar');
    var pwBadge = document.getElementById('db-pw-badge');
    var homeGreeting = document.getElementById('db-home-greeting');

    var obData = {};
    try { obData = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}'); } catch(e) {}

    if (pwName) {
      pwName.textContent = name || 'Player';
    }
    if (pwAvatar) {
      if (typeof AvatarBridge !== 'undefined' && obData.avatar) {
        try { AvatarBridge.renderMini(pwAvatar, obData.avatar); } catch(e) {
          var initials = (name || 'P').split(' ').map(function(w){return w[0]}).join('').slice(0,2).toUpperCase();
          pwAvatar.textContent = initials;
        }
      } else {
        var initials = (name || 'P').split(' ').map(function(w){return w[0]}).join('').slice(0,2).toUpperCase();
        pwAvatar.textContent = initials;
      }
    }
    if (pwBadge && typeof GamificationEngine !== 'undefined') {
      var ge = GamificationEngine.state || {};
      pwBadge.textContent = ge.rank || 'Rookie';
    }
    if (homeGreeting) {
      var firstName = (name || 'Player').split(' ')[0];
      // Build greeting safely using textContent + DOM
      homeGreeting.textContent = '';
      homeGreeting.appendChild(document.createTextNode('Hey, '));
      var strong = document.createElement('strong');
      strong.textContent = firstName;
      homeGreeting.appendChild(strong);
      homeGreeting.appendChild(document.createTextNode('!'));
    }

    // Set home date pill
    var datePill = document.getElementById('db-home-date');
    if (datePill) {
      var d = new Date();
      var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      datePill.textContent = days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
    }
```

Note: `name` variable is already defined earlier in the authGuard function (line 30).

- [ ] **Step 2: Verify — profile widget shows user name, initials, and rank. Home greeting shows first name.**

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: populate profile widget and home greeting from auth data"
```

---

## Chunk 4: Integration & Polish

### Task 13: Merge to master and verify live

- [ ] **Step 1: Final verification — test full flow**

1. Page loads with home panel visible, sidebar hidden
2. Click nav card — correct panel shows, sidebar appears
3. Click "Home" in sidebar — returns to home, sidebar hides
4. Donut charts animate with correct percentages
5. Profile widget shows in topbar on all panels
6. Mobile: nav cards stack, donuts 2x2, stats scroll horizontal

- [ ] **Step 2: Merge to master and push**

```bash
cd "C:\Users\tamir\Documents\GitHub\courtIQ"
git checkout master && git merge claude/fix-shot-tracker --no-edit && git push origin master && git checkout claude/fix-shot-tracker
```

- [ ] **Step 3: Verify live at https://tamir7895-ops.github.io/courtIQ/dashboard.html**
