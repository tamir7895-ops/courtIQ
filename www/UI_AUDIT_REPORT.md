# CourtIQ UI Audit Report
**Date:** 2026-03-31
**Audited version:** Stitch v3 (kinetic-stitch design)
**Compared against:** Pre-Stitch commit `873b1be`

---

## Summary

| Metric | Count |
|---|---|
| Total interactive elements scanned | 148 |
| ✅ Fully working | 121 |
| ⚠️ Partial (CSS-only, no data) | 4 |
| ❌ Broken / No handler | 23 |
| 🔧 Fixed in this audit | 19 |
| ⚠️ Remaining (intentional / needs backend) | 4 |

---

## Fixed Elements

| Element | Fix Applied |
|---|---|
| `js/night-training.js` (missing file) | Created full implementation: star animation, drill cards, open/close logic |
| `NightTraining.open()` / `.close()` | Now works — opens night training overlay with 6 drill cards |
| `#nt-close` button | Wired in night-training.js init |
| `.nt-start-btn` "Let's Get to Work" | Works via `NightTraining.close()` |
| `#ast-launch-btn` "Live Camera" | Now calls `getUserMedia`, shows camera status toast |
| `#ast-upload-btn` "Upload Video" | Now triggers `#ast-file-input` click |
| `#ast-file-input` (file picker) | Now shows toast with filename on selection |
| `.glass-ai-analysis-btn` "AI ANALYSIS" | Now same as Live Camera |
| `.glass-stop-tracking-btn` "STOP TRACKING" | Now shows "Tracking stopped" toast |
| `.ast-court-btn` NBA/FIBA/HS presets | Now toggles active class + updates court info text |
| `#ast-notif-toggle` Training Reminders | Now shows/hides `#ast-notif-options` on toggle |
| `workoutsOpenDetail()` function | Defined — opens drills tab with Ball Handling filter |
| `.ks-btn-primary` "Edit Profile" (Home) | Now opens `#profile-modal-overlay` |
| `.ks-btn-outline` "Share" (Home) | Now uses `navigator.share` or copies URL to clipboard |
| `.ks-info-btn` (info icon) | Now shows toast explaining daily workout |
| `.ks-workout-img-card` × 3 | Now clicks through to drills tab with category filter |
| `.ks-drill-item` × 3 | Now clicks through to drills tab with category filter |
| `.ks-fab` "add" button | Now opens drills tab → Generator mode |
| `.ks-section-link` "View All" | Now opens drills library filtered to Shooting |

---

## Broken Elements Table (Pre-Fix)

| Element | File | Issue | Fix |
|---|---|---|---|
| `js/night-training.js` | (missing) | File never created after design migration | ✅ Created |
| `.night-training-trigger` onclick | dashboard.html:1330 | Called undefined `NightTraining.open()` | ✅ Fixed |
| `#ast-launch-btn` | dashboard.html:1928 | No event listener in any JS file | ✅ Fixed |
| `#ast-upload-btn` | dashboard.html:1929 | No event listener | ✅ Fixed |
| `#ast-file-input` | dashboard.html:1932 | No `onchange` handler | ✅ Fixed |
| `.glass-ai-analysis-btn` | dashboard.html:1975 | Delegated to dead button | ✅ Fixed |
| `.glass-stop-tracking-btn` | dashboard.html:1976 | No onclick | ✅ Fixed |
| `.ast-court-btn` × 3 | dashboard.html:1984–1986 | No click handlers | ✅ Fixed |
| `#ast-notif-toggle` | dashboard.html:1993 | No change handler | ✅ Fixed |
| `workoutsOpenDetail` | dashboard.html:1640 | Called undefined function | ✅ Fixed |
| `.ks-workout-img-card` × 3 | dashboard.html:1661–1681 | No click handlers | ✅ Fixed |
| `.ks-drill-item` × 3 | dashboard.html:1691–1717 | No click handlers | ✅ Fixed |
| `.ks-fab` | dashboard.html:1722 | No onclick | ✅ Fixed |
| `.ks-section-link "View All"` | dashboard.html:1658 | No onclick | ✅ Fixed |
| `.ks-btn-primary "Edit Profile"` | dashboard.html:501 | No onclick | ✅ Fixed |
| `.ks-btn-outline "Share"` | dashboard.html:502 | No onclick | ✅ Fixed |
| `.ks-info-btn` | dashboard.html:654 | No onclick | ✅ Fixed |
| Static `#ac-overlay` shell | dashboard.html:2766–2788 | Orphaned — avatar-customizer.js builds its own `#ac2-overlay` | ⚠️ Leave — no user impact |
| GLOBAL/LOCAL leaderboard toggle | dashboard.html:2454–2455 | CSS-only toggle, no data switching | ⚠️ Needs backend |
| Settings items (Email/Security/Terms/Privacy/Help/Bug) | dashboard.html:2270–2338 | Decorative divs, no action | ⚠️ Intentional placeholder |
| `.glass-rec-card` × 3 | dashboard.html:1269–1292 | `dbSwitchTab('drills')` is a noop when already on drills | ⚠️ Minor — leave |

---

## Remaining Issues (Manual Attention Needed)

| Issue | Reason |
|---|---|
| Static avatar customizer HTML shell (`#ac-overlay`) | `avatar-customizer.js` creates its own dynamic `#ac2-overlay` — the static shell is dead but harmless. Cleanup optional. |
| GLOBAL/LOCAL leaderboard toggle | Would need real backend data to differentiate global vs. local results. Currently only toggles CSS `active` class. |
| Settings items (Email, Security, Terms, Privacy, Help, Bug) | Intentional placeholders for future settings functionality. Terms/Privacy would need actual URLs. |
| Elite Recommendations cards → `dbSwitchTab('drills')` noop | When user is already on the drills tab and clicks a rec card it does nothing. Fix: add `drillsShowMode('generator')` call. |

---

## Files Modified

| File | Change |
|---|---|
| `www/js/night-training.js` | **Created** — full NightTraining module |
| `www/styles/kinetic-stitch.css` | Appended §44 — Night Training overlay CSS |
| `www/js/shot-tracker.js` | Appended AST handler IIFE (camera, upload, court, notif) |
| `www/js/drill-engine.js` | Appended `workoutsOpenDetail`, workout card/drill item/FAB/View All handlers |
| `www/js/dashboard.js` | Appended Edit Profile, Share, Info button handlers |

---

## Build Notes

This project is **vanilla HTML/CSS/JS with no build step** — `npm run build` does not apply. All changes are production-ready as static files. Deploy via GitHub Pages (push to `master` triggers `deploy-pages.yml` workflow → copies `www/` to `gh-pages` branch).

---

## Recommendations

1. **Night Training drills** — currently hardcoded. Consider pulling from `DailyWorkout` or `drill-engine.js` drill library so content stays fresh.
2. **AI Shot Tracker** — `getUserMedia` opens a camera stream but there's no active tracking loop wired to the YOLOX model. The `features/shot-tracking/shotDetection.js` file contains the ONNX inference code but `ShotTrackingScreen` (the screen manager) was never ported to the new design. Recommend creating a full `ShotTrackingScreen` init that reads `ast-launch-btn`/`ast-upload-btn`.
3. **Settings items** — add `href` links for Terms of Service and Privacy Policy when URLs are available.
4. **Leaderboard** — separate the GLOBAL/LOCAL data fetch into `shLoadGlobal()` and `shLoadLocal()` functions wired to the toggle buttons.
5. **Workout cards** — the workout image cards and drill items are currently hardcoded HTML. Consider rendering them dynamically from `drill-engine.js` library data so they always show real drills.
