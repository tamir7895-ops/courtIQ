# Wave 4 — Home Tab + Legacy Ports (Amber)

> Paste this as a single message in Claude Design. The Home tab is the daily ritual — "what should I do right now?" Personality: **warm, motivating, daily ritual.** Accent: `#f5a623` (amber).

---

## PROMPT

We're now designing **Wave 4: Home Tab** — the user's daily starting point. This is where motivation lives. 4 surfaces + legacy ports.

**IMPORTANT: For any court illustrations, use the approved `half-court.svg` asset already in this project. Do not draw courts from scratch.**

### Surface 1: Today (HeroPage, default landing) — REDESIGN

**Hero area:**
- **Greeting line**: "Good morning, [name]" at H2 (28px italic). Time-aware: morning/afternoon/evening.
- **Streak counter**: flame icon + number, prominent but not hero-sized. Tapping → Streak History BottomSheet.
- **Level/XP bar**: compact progress bar showing XP toward next level. Shows current tier (Rookie/Hooper/All-Star/MVP). Tap → Me Profile tab.

**Daily content cards (stacked glass cards):**
1. **Daily Challenge card** — amber accent border, challenge description, "Accept" CTA → routes to Train Today. If completed: teal check + XP earned.
2. **Today's Workout summary** — if workout scheduled: drill count + estimated time + "Start" CTA → Train Today. If none: "Build a workout →" CTA → Train Generator.
3. **Recent Session card** — last shot tracking session: FG% big number + mini shot chart (use `half-court-zones.svg` with zone fills) + "View Details" → Track Sessions.
4. **Coach Nudge** — if coach has unread insight: purple-accented card with verdict preview + "Read →" → Coach tab.

**Empty/first-run state:** "Welcome to CourtIQ. Let's start with a workout →" with CTA to Train.

### Surface 2: Log Session (sub-nav chip) — POLISH

Manual session logging for when AI tracking isn't used.
- Simple form: date picker, shot count, make count, optional notes.
- Submit → back to Today + XP toast.
- Glass card container for the form.

### Surface 3: History (sub-nav chip) — POLISH

Session history list (both AI-tracked and manual).
- Each row: date + FG% + shot count + source badge (AI/Manual).
- Row tap → routes to Track Sessions detail.
- Glass card rows.

### Surface 4: Calendar (sub-nav chip) — POLISH

Monthly calendar view showing training days.
- Days with sessions: amber dot indicator.
- Tap day → shows that day's sessions.
- "Schedule Session" CTA → Log Session.
- Minimal, clean calendar grid.

### Surface 5: Alerts (sub-nav chip) — POLISH

Notification center.
- List of notifications: badges earned, coach insights ready, streak milestones, social challenges.
- Each notification: icon + text + timestamp + unread dot.
- Tap → routes to relevant tab.

### Navigation connections:
- Today → Daily Challenge "Accept" → Train Today (tab switch + highlight)
- Today → Streak counter → Streak History BottomSheet
- Today → Level/XP → Me Profile (tab switch)
- Today → Recent Session → Track Sessions detail (tab switch)
- Today → Coach Nudge → Coach Landing (tab switch)
- Log Session submit → Today + XP toast
- History → row → Track Sessions detail (tab switch)
- Alerts → notification → relevant deep-link

### Design tokens:
- Accent: `var(--c-home)` / `#f5a623`
- Cross-tab references use `.ciq-xref` pattern (source amber, destination shows target tab color + arrow)
- H1 hero greeting, H3 card titles, body text in Lexend

### Deliverable:
One HTML file `v2/home.html` with Today as default view and sub-nav chips for Log/History/Calendar/Alerts.
