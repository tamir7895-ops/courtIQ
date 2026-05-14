# CourtIQ Claude Design v2 — Full Screen Audit Summary

> Audited: May 14, 2026 via Claude in Chrome  
> Project: claude.ai/design/p/019dddc0-0907-782e-9340-58fc66de2d25

---

## Overall Status: 10/10 screens built, 8/10 fully polished

The app has a complete screen set covering all 5 main tabs + 5 overlay screens. The polish pass successfully applied CourtIQ branding, consistent bottom nav, and glass card styling across all main tabs. A few minor issues remain.

---

## MAIN TABS (5/5 built)

### 1. Home Tab (home-tab.html) — PASS
- CourtIQ logo top-left, no back arrow
- Sub-nav pills: Today / Log / Calendar (amber active)
- Hero card: avatar + greeting + streak
- XP/Level progress cards
- Daily Challenge with START CTA
- Coach pinned tip card
- Bottom nav: HOME active (amber)
- Settings gear top-right
- **Minor issue:** "CourtIQ" logo wordmark may render as "CourtI0" (font rendering — verify in production)

### 2. Track Lab (track-lab.html) — PASS
- CourtIQ logo top-left, no back arrow
- LIVE badge pulsing top-right
- AI Shot Tracker hero card with Launch Camera + Upload Video CTAs
- Sub-nav pills: Shots / Heatmap / Frequency (green active)
- Half-court shot chart + stats breakdown
- Bottom nav: TRACK active (green)

### 3. Train / Drill Library (drill-library.html) — PASS
- CourtIQ logo top-left
- "8/45 MASTERED · 5 PATHS" + FOR YOU sub-nav
- Train Today "Midrange Masterclass" card with START WORKOUT CTA
- Today's Challenge card
- Drill categories grid
- Bottom nav: TRAIN active (blue)

### 4. Coach Tab (coach-tab.html) — PASS
- CourtIQ logo top-left, **back arrow removed** (fixed by polish pass)
- "COACH · BRIEFING · WEEK 18 · MAY 4" context
- Sub-nav pills: Coach / Update / History (purple active)
- Coach Briefing hero card with italic headline
- VIEW FULL BRIEFING CTA
- This Week's Numbers: FG% 58, 3PT% 31, Sessions 3, Streak 12
- Coach Whitfield chat entry (ONLINE status)
- Bottom nav: COACH active (purple)

### 5. Me Tab (me-tab.html) — PASS
- CourtIQ logo top-left
- Sub-nav pills: Profile / Trophies / Social / Shop (teal active)
- **Profile view:** DiceBear avatar, "TAP AVATAR TO CUSTOMIZE", Alex Rivera, Combo Guard + Level 14, stats (142 Sessions, 23 Day Streak, 12.5K XP), Archetype "THE SNIPER" with 92% match, shooting/ball handling bars
- **Shop view:** Coin balance (320) + Level 14, category tabs (Accessories/Hair/Beard/Backgrounds), Featured "Gold Chain" item, shop items grid with prices
- Bottom nav: ME active (teal)

---

## OVERLAY SCREENS (5/5 built)

### 6. Camera HUD (camera-hud.html) — PASS
- No bottom nav (fullscreen)
- Phase 3 Live Tracking HUD visible:
  - Top bar: MADE 12/18, LIVE · AI TRACKING (green pulse), SESSION 08:25
  - Half-court zone indicator showing current zone ("R WING 3")
  - LAST 5 shot indicators (M/X dots)
  - RIM · LOCKED / 3PT · CALIBRATED status pills
  - FIELD GOAL 66% hero stat (large, green, >50%)
  - "+4 vs last session" comparison delta
  - END SESSION button (red accent)
- Tweaks: HUD style (Broadcast/Streamer), Scenario dropdown, Celebrations toggle, Focus bracket, HUD opacity
- ESPN broadcast overlay aesthetic achieved

### 7. Post-Session Summary (post-session.html) — MINOR ISSUES
- Back arrow (←) top-left (correct for overlay)
- SESSION RECAP header with date + duration + FINAL badge
- Hero FG% 67% (large, green, correct color coding)
- "+9 pts vs last session" delta
- AI quote: "Right wing was unconscious."
- Shot map: half-court with MAKE 22 / MISS 11, green/red zones
- Stats row: MADE 22/33, PTS/SHOT 1.42, BEST RUN 6
- **ISSUE 1:** Bottom nav bar IS showing — should NOT be present (this is a fullscreen overlay)
- **ISSUE 2:** Missing XP Earned card (spec calls for XP breakdown with count-up)
- **ISSUE 3:** Missing Save Session / Share Shot Chart / New Session / Back to Track action buttons
- Tweaks: Scenario selector, Animate shot chart

### 8. Workout Player (workout-player.html) — PASS
- No bottom nav (fullscreen)
- Close (X) top-left
- "TRAIN · WORKOUT · Midrange Masterclass" + PAUSED badge
- Drill info: "DRILL 3 · CATCH & SHOOT · Set 2 of 4"
- Drill name: "SPOT-UP MID RANGE" (H2, italic)
- Drill tip text
- Giant timer 0:49 REMAINING with circular progress ring (blue)
- REP 3/10 counter
- RESUME button (large, blue) + SKIP REP / SKIP DRILL
- Tweaks: Phase (Active/Rest/Done), Drill selector, Set/Rep controls
- **Note:** Phase toggle in Tweaks didn't switch visually (may need JSX component state) — Active state is solid

### 9. Avatar Customizer (avatar-customizer.html) — PASS
- No bottom nav (fullscreen)
- Back arrow (←) top-left
- "MYPLAYER · CUSTOMIZE" header + coin balance (450)
- Large DiceBear avatar on teal gradient with "LIVE PREVIEW" badge
- Player name + archetype + level
- Category tabs: Hair / Facial Hair / Accessories / Clothing (teal active)
- 3-column options grid with mini avatar previews
- Status badges: OWNED / EQUIPPED (teal highlight with checkmark)
- Bottom action bar: SAVE CHANGES + OPEN SHOP + RESET
- Tweaks: Coins, Level, Category selector

### 10. Onboarding (onboarding.html) — PASS
- No bottom nav (fullscreen first-time flow)
- Progress indicator "01 / 07" top-right
- Step label: "STEP 1 OF 7 · IDENTITY"
- Hero heading: "LET'S START WITH THE BASICS." (Barlow Condensed, italic)
- Form fields: Name, Age (+/- stepper), Height (ft/in), Weight
- CONTINUE → CTA button (teal)
- Glass card styling on inputs
- Tweaks: Step selector, Scroll position

---

## ISSUES TO FIX (Priority Order)

### Must Fix Before Porting

1. **post-session.html — Remove bottom nav bar**  
   This is a fullscreen overlay. The bottom nav should not be present.

2. **post-session.html — Add missing sections**  
   The spec calls for: XP Earned card (with count-up breakdown), and action buttons (Save Session, Share Shot Chart, New Session, Back to Track). These are either cut off or missing entirely.

### Nice to Have

3. **Workout Player — Rest/Done states via Tweaks**  
   The Phase toggle buttons (Rest, Done) didn't switch the view. May need JSX component wiring. The Active state design is solid, but we should verify Rest (amber timer, dimmed bg) and Done (celebration, checkmark, stats) states exist in the code.

4. **Home Tab — "CourtIQ" font rendering**  
   The logo wordmark may show "CourtI0" instead of "CourtIQ" due to font fallback. Verify Barlow Condensed is loading correctly.

5. **coach-tab.html — Not recently modified**  
   Modified "over a week ago" vs other files at 19m–1h ago. May have missed some polish pass changes (though visually it looks correct with logo and no back arrow).

---

## DESIGN CONSISTENCY CHECKLIST

| Element | Status |
|---------|--------|
| CourtIQ logo on all 5 main tabs | ✅ All tabs have logo |
| No back arrows on main tabs | ✅ Fixed (Coach + Track had them, now removed) |
| Bottom nav on all 5 main tabs | ✅ Consistent across Home/Track/Train/Coach/Me |
| No bottom nav on overlays | ⚠️ 4/5 correct, post-session still shows it |
| Glass card styling | ✅ Consistent dark glass across all screens |
| Tab accent colors | ✅ Home=amber, Train=blue, Track=green, Coach=purple, Me=teal |
| Typography (Barlow+Lexend) | ✅ Consistent, font fixes applied to me-tab + camera-hud |
| Sub-nav pills style | ✅ Consistent glass pills with active accent fill |
| Settings gear on main tabs | ✅ Present on Home, Coach, Me |

---

## NEXT STEPS

1. Fix the 2 must-fix issues on post-session.html in Claude Design
2. Verify workout-player Rest/Done states exist in code
3. Run the Claude Code porting prompt (docs/superpowers/plans/claude-code-v2-port.md) to bring all screens into the production app
