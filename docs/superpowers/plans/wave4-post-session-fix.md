# Post-Session Fix Prompt

Paste this into Claude Design:

---

Fix post-session.html — two issues:

1. **Remove the bottom nav bar.** This is a fullscreen DetailOverlay (like camera-hud and workout-player). It should NOT have the 5-tab bottom nav. Remove it completely.

2. **Add the missing sections below the stats row.** Right now the page ends at the MADE/PTS-SHOT/BEST-RUN stats row. Add these two cards below it:

**XP Earned Card** (glass card):
- XP breakdown lines:
  - "Made shots: +220 XP" (22 × 10 XP)
  - "Attempts: +66 XP" (33 × 2 XP)
  - "Streak bonus: +60 XP"
  - Divider line
  - **Total: +346 XP** (large, green, bold)
- Progress bar showing XP toward next level (e.g., "11,200 / 15,000 XP to Level 15")

**Action Buttons Card** (glass card, bottom):
- **"Save Session"** — primary CTA (green fill, full width)
- **"Share Shot Chart"** — secondary CTA (glass border, share icon)
- **"New Session"** — tertiary text link
- **"Back to Track"** — tertiary text link

Keep the same glass card styling, Track green accent (#56d364), Barlow Condensed + Lexend fonts as the rest of the page.
