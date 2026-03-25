# DO NOT BREAK — Critical Architecture Reference

## Read This Before Touching ANY Code

This document lists every element ID, data attribute, CSS class, localStorage key,
and global variable that JavaScript depends on. **Renaming or removing ANY of these will break the app.**

---

## 1. Panel IDs (Used by dashboard.js for tab routing)

```
#db-panel-home
#db-panel-log
#db-panel-drills
#db-panel-workouts
#db-panel-summary
#db-panel-history
#db-panel-shots
#db-panel-coach
#db-panel-calendar
#db-panel-notifications
#db-panel-archetype
#db-panel-shop
#db-panel-moves
#db-panel-social
```

## 2. Data Attributes (Navigation routing)

```html
data-tab="home|log|drills|workouts|summary|history|shots|coach|calendar|notifications|archetype|shop|moves|social"
data-section="home|drills|coach|shots|profile"
data-skill="shooting|dribbling|defense|gameiq"
```

## 3. Critical Element IDs

**Layout:**
```
#db-layout-root  #db-sidebar  #db-main  #db-topbar
#db-sidebar-overlay  #db-sidebar-mobile-toggle  #bottom-nav  #top-nav
```

**User/Profile:**
```
#db-sidebar-name  #db-sidebar-avatar  #db-pw-name  #db-pw-avatar
#db-pw-badge  #db-profile-widget  #db-hero-avatar  #db-hero-name  #db-hero-rank
```

**XP/Stats:**
```
#db-hero-xp-fill  #db-hero-xp-nums  #xp-widget  #xp-badge  #xp-rank
#xp-bar-fill  #xp-numbers  #db-streak-badge  #db-stat-xp  #db-stat-streak
```

**Skills (pattern: stat-{name} + stat-{name}-circle):**
```
#stat-shooting  #stat-shooting-circle
#stat-dribbling  #stat-dribbling-circle
#stat-defense  #stat-defense-circle
#stat-gameiq  #stat-gameiq-circle
```

**Home:**
```
#welcome-screen  #guest-banner  #db-home-greeting  #db-home-date
#db-topbar-date  #db-quick-actions  #home-badges-row  #db-skill-stats
```

**Session/Log:**
```
#db-week-label  #db-week-num  #db-session-count  #db-session-list
#db-session-label  #db-remaining-label  #db-progress-text  #db-progress-fill
#db-shots-made  #db-shots-att  #db-dribbling  #db-vertical  #db-sprint
#db-notes  #db-gen-btn  #db-error
```

**AI/Summary:**
```
#db-summary-empty  #db-summary-content  #db-headline  #db-summary-text
#db-strengths  #db-focus  #db-drill  #db-coach-note  #db-kpi-title
#db-fb-tag  #db-trend-badge
```

**Charts:**
```
#db-chart-line  #db-chart-bar  #db-chart-vert  #db-chart-sprint
```

**Daily Challenge:**
```
#dc-card  #skel-dc  #db-hero-challenge  #db-hero-challenge-name
```

**Subnavigation:**
```
#subnav-train  #subnav-track  #subnav-coach  #subnav-me
```

**Modals:**
```
#profile-modal-overlay  #ac-overlay  #drill-workout-overlay
```

**Breadcrumb:**
```
#db-breadcrumb-current
```

## 4. CSS Classes Used in JavaScript (querySelector)

```
.db-layout-root  .db-sidebar-item  .db-panel  .db-tab
.bottom-nav-item  .top-nav-item  .active  .db-sidebar.collapsed
.db-topbar  .section-subnav  .subnav-item  .db-main-inner
```

## 5. onclick Handlers in HTML

```javascript
dbSwitchTab('tabName')       // Switch panel
dbSwitchTabById('tabName')   // Switch panel by ID
bottomNavSwitch('section')   // Mobile nav
signOut()                    // Sign out
openAuth('signin'|'signup')  // Auth modal
```

## 6. localStorage Keys (DO NOT RENAME)

```
courtiq-onboarding-data         // Player onboarding profile
courtiq-onboarding-complete     // Onboarding timestamp
courtiq-player-profile          // Player name, position, skills
courtiq-archetype               // Player type
courtiq-xp                     // XP data + level
courtiq-streak                 // Streak data
courtiq_avatar_url             // Avatar URL
courtiq_avatar_cache           // Cached avatar
courtiq-saved-drills           // Saved drills array
courtiq-shot-sessions          // Shot tracking sessions
courtiq-gamification-data      // Gamification state
courtiq-sidebar-collapsed      // Sidebar state
courtiq-guest-mode             // Guest mode flag
db-weeks                       // Week cache
```

## 7. Global Window Objects (DO NOT RENAME)

```javascript
window.currentUser    window.currentSession    window.courtiqGuest
window.sb             window.escapeHTML         window.LS
window.COURTIQ_LEVELS window.CourtIQ
window.XPSystem       window.DailyChallenge     window.PlayerAnalysis
window.ProgressCharts window.CourtHeatmap       window.ShotAnalysis
window.ShotTracker    window.ArchetypeEngine    window.Onboarding
window.AvatarCustomizer  window.BadgeSystem     window.NotificationManager
window.SocialHub      window.NightTraining      window.MoveLibrary
window.DailyWorkout   window.AvatarShop         window.PlayerProfile
window.VideoReview    window.StreakSystem        window.WorkoutTimer
```

## 8. Script Load Order (Core — MUST be in this order)

```
1. js/utils.js
2. js/supabase-client.js
3. js/data-service.js
4. js/nav.js
5. js/auth.js
6. js/dashboard.js
```

All other scripts are `defer` and order doesn't matter.

## 9. Supabase Tables

```
profiles          — User profiles
training_weeks    — Weekly records
training_sessions — Session logs
shot_sessions     — Shot data
challenges        — Social challenges
```

## 10. CSS Files (18 files — can edit styles, don't delete files)

```
styles/main.css               styles/drills.css
styles/dashboard-redesign.css styles/shot-tracker.css
styles/animations.css         styles/components.css
styles/onboarding.css         styles/feature-heroes.css
styles/social.css             styles/workouts.css
styles/move-library.css       styles/profile.css
styles/archetype.css          styles/shop.css
styles/challenge.css          styles/badges.css
styles/gamification.css       styles/charts.css
styles/avatar-customizer.css  styles/daily-workout.css
styles/avatar-3d.css
```

---

## Summary: Safe vs Unsafe Changes

**SAFE:** CSS values, colors, spacing, font sizes, animations, layout, new CSS classes, new HTML elements, new JS files

**UNSAFE:** Renaming IDs, renaming data attributes, changing script order, deleting localStorage keys, renaming window globals, removing existing HTML elements that JS references
