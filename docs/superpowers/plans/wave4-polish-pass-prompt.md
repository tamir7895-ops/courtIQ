# Wave 4 — Full App Polish Pass

> Context line: "Continue CourtIQ redesign. Read all artifact files. This is a POLISH PASS across ALL screens to fix consistency, navigation, and branding issues. Edit every page that needs changes."

---

## PROMPT

This is a consistency and polish pass across the ENTIRE app. Go through every page file and fix these issues. This is critical — the app needs to feel like ONE product, not separate screens stitched together.

### 1. TOP BAR BRANDING — Add CourtIQ logo + name to all 5 main tabs

Every main tab (home-tab, track-lab, drill-library, coach-tab, me-tab) needs a **consistent top bar** with:
- **Left**: CourtIQ logo mark (small basketball-circuit icon, 24px) + "Court**IQ**" text (Barlow Condensed, "IQ" in bold/accent)
- **Right**: Settings gear icon (for Home) OR contextual action (for other tabs)
- This replaces the current back arrow (←) on main tabs. **Main tabs should NEVER have a back button** — they are top-level destinations reached via the bottom nav. Only sub-screens and overlays (camera-hud, post-session, workout-player, avatar-customizer, onboarding) get a back/close button.

**Current problems to fix:**
- `home-tab.html`: Has "HOME · TODAY" eyebrow but no logo. Add logo top bar.
- `coach-tab.html`: Has a back arrow ← which shouldn't be there — it's a main tab. Replace with logo top bar.
- `track-lab.html`: Has a back arrow ← which shouldn't be there. Replace with logo top bar.
- `drill-library.html`: Check if it has back arrow — remove if so. Add logo top bar.
- `me-tab.html`: Check and fix same way. Add logo top bar.

**The top bar pattern for all 5 main tabs:**
```
┌─────────────────────────────────┐
│ 🏀 CourtIQ    [date/context] ⚙ │
│ ─────────────────────────────── │
│ TAB NAME · SUBTEXT              │
│ [Today] [Log] [Calendar]        │  ← sub-nav pills (if applicable)
└─────────────────────────────────┘
```

### 2. BOTTOM NAV BAR — Consistent across all 5 main tabs

Verify that ALL 5 main tab pages have the exact same bottom nav bar with:
- 5 icons: Home (house), Train (dumbbell/crossed-bars), Track (chart-up), Coach (chat-bubble), Me (person)
- Labels below each icon: HOME, TRAIN, TRACK, COACH, ME
- Active tab: icon in tab accent color + filled style + subtle indicator dot/line above
- Inactive tabs: muted white icons, no fill
- The nav bar should look IDENTICAL on every main tab — same height, same style, same spacing

**Overlay screens that should NOT have bottom nav:**
- camera-hud.html (fullscreen)
- post-session.html (fullscreen)
- workout-player.html (fullscreen)
- avatar-customizer.html (fullscreen)
- onboarding.html (fullscreen)

### 3. SUB-NAV PILLS — Consistent style

Several tabs have sub-navigation pills (Home: Today/Log/Calendar, Coach: Coach/Update/History, Track: Shots/Heatmap/Frequency). Ensure they ALL use the same style:
- Glass pill buttons
- Active: filled with tab accent color
- Inactive: glass outline, muted text
- Same height, padding, border-radius across all tabs

### 4. NAVIGATION FLOW — Buttons that link between screens

Make sure these navigation paths work (buttons should exist and be clearly labeled):

| From | Action | Goes To |
|------|--------|---------|
| Home → Daily Challenge "START" | tap | drill-library or workout-player |
| Home → Coach card | tap | coach-tab |
| Track → "Launch Camera" | tap | camera-hud |
| Track → "Upload Video" | tap | camera-hud (file mode) |
| Camera HUD → "End Session" | tap | post-session |
| Post-Session → "Save & Back" | tap | track-lab |
| Post-Session → "New Session" | tap | camera-hud |
| Train/Drill Library → "Start Workout" | tap | workout-player |
| Workout Player → "Save & Exit" | tap | drill-library |
| Workout Player → "Start Shot Tracking" | tap | camera-hud |
| Me → Avatar tap | tap | avatar-customizer |
| Me → "Open Shop" | tap | shop section |
| Avatar Customizer → "Open Shop" | tap | shop |
| Avatar Customizer → back/close | tap | me-tab |

Every CTA button on every screen should have a clear destination label. No dead-end buttons. No "coming soon" placeholders.

### 5. GLASS CARD CONSISTENCY

ALL screens should use the same glass card style:
- Background: `rgba(22,25,33,0.7)` (or as defined in foundations.css)
- Border: `1px solid rgba(255,255,255,0.08)`
- Border-radius: `16px` (standard) or `24px` (hero cards)
- Backdrop-filter: `blur(20px)`
- Padding: `20px` (standard) or `24px` (hero)

Check every screen for:
- Any bare/floating text not in a card → wrap in card
- Any card with different glass values → standardize
- Any card with white/light background instead of glass → fix

### 6. TYPOGRAPHY CONSISTENCY

Verify across all screens:
- **H1** (page hero stat/greeting): Barlow Condensed, 48px, italic, 900 weight
- **H2** (section headers, card titles): Barlow Condensed, 28px, italic, 700 weight  
- **H3** (card subtitles): Barlow Condensed, 18px, uppercase, 600 weight
- **Eyebrow** (labels above sections): Lexend, 11px, uppercase, letter-spacing 1.5px, muted color
- **Body**: Lexend, 14px, 400 weight
- **Stat numbers**: Barlow Condensed, bold

No screen should use a different font or size scale than defined above.

### 7. COLOR ACCENT CONSISTENCY

Each tab uses its accent color ONLY for that tab's elements:
- Home: `#f5a623` (amber)
- Train: `#4ca3ff` (blue)
- Track: `#56d364` (green)
- Coach: `#bc8cff` (purple)
- Me: `#2dd4bf` (teal)

Check that:
- Sub-nav pills use the correct tab color
- CTAs use the correct tab color
- Hero card accents match
- No tab bleeds another tab's color (except Home which can reference other tabs in cross-links)

### 8. SPECIFIC SCREEN FIXES

**home-tab.html:**
- Add CourtIQ logo top bar
- Remove any back arrow
- Verify bottom nav shows HOME as active (amber)
- Daily challenge START button should be prominent
- Coach preview card should link to Coach tab

**track-lab.html:**
- Add CourtIQ logo top bar, remove back arrow
- Verify the AI Shot Tracker hero card with Launch Camera + Upload Video is present
- Bottom nav shows TRACK as active (green)
- "LIVE" badge in top-right should pulse

**drill-library.html:**
- Add CourtIQ logo top bar
- Verify "Train Today" card is at top
- Bottom nav shows TRAIN as active (blue)
- Start Workout CTA clearly visible

**coach-tab.html:**
- Add CourtIQ logo top bar, REMOVE the back arrow ←
- Bottom nav shows COACH as active (purple)
- Coach Whitfield chat entry point clearly visible
- "View Full Briefing" CTA works

**me-tab.html:**
- Add CourtIQ logo top bar
- Bottom nav shows ME as active (teal)
- Avatar is tappable (→ avatar-customizer)
- Settings accessible
- Trophy case / social sections present

**camera-hud.html:**
- NO bottom nav, NO logo top bar (fullscreen overlay)
- Close/back button (X) in top-left
- Verify all HUD elements present

**post-session.html:**
- NO bottom nav (fullscreen overlay)
- Back/close button or "Back to Track" CTA
- "Save Session" and "New Session" CTAs present

**workout-player.html:**
- NO bottom nav (fullscreen overlay)
- Close (X) button in top-left
- Verify Active/Rest/Done states all work via Tweaks

**avatar-customizer.html:**
- NO bottom nav (fullscreen overlay)
- Back arrow (←) in top-left
- Save Changes, Open Shop, Reset all present

**onboarding.html:**
- NO bottom nav (fullscreen, first-time flow)
- Progress indicator for steps
- Skip option available

### 9. ANIMATION CONSISTENCY

Every screen should use the same motion values:
- Default transition: `0.25s cubic-bezier(0.4, 0, 0.2, 1)`
- Card hover/tap: `transform: scale(0.97)` on press
- Page entry: fade-in + slide-up (200ms)
- Number changes: brief scale pulse (1.05x → 1.0x, 150ms)

### 10. EMPTY/LOADING STATES

Verify each main tab has:
- A loading skeleton state (pulse animation on placeholder cards)
- An empty state if no data ("No sessions yet — start tracking →")
- These should be visible via Tweaks toggles if possible

---

**Process:** Go through each page file one by one, fix all issues listed above, verify the render after each fix. Start with home-tab.html (most important), then work through the other 4 main tabs, then check the overlay screens.
