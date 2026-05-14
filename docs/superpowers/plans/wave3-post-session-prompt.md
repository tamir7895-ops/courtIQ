# Wave 3B — Post-Session Summary Screen

> Context line: "Continue CourtIQ redesign. Read all artifact files. Design system is defined. This prompt is for the Post-Session Summary screen."

---

## PROMPT

Design the **Post-Session Summary** screen — shown immediately after the user ends a shot tracking session. This is the "game recap" moment. It should feel like the post-game stats screen in NBA 2K or the end-of-match screen in any competitive game. Everything in glass cards.

### Design system reminder
- Track tab accent: `--c-track: #56d364` (green)
- Glass cards for ALL content — no bare floating text
- Fonts: Barlow Condensed (display), Lexend (body)
- Template: DetailOverlay (fullscreen, slides up over the camera)

---

### Screen structure — 5 stacked glass card sections:

#### 1. Hero Card (top, most prominent)
- **FG%** as the HERO stat — massive number (64px+ Barlow Condensed Bold, italic)
- Color-coded: green if >50%, amber 30-50%, red <30%
- Below: Made / Attempts in smaller text (e.g., "12 / 20")
- Session duration in a subtle pill badge
- Subtle confetti or particle animation if FG% > 60% (celebration moment)
- Background: subtle gradient using track green at low opacity

#### 2. Shot Chart Card
- **Half-court SVG** (500×470 viewport, fits card width)
- Court rendered in brand style: dark surface with muted court lines (rgba white ~15%), paint area slightly lighter
- 3PT arc drawn with circuit-line aesthetic (subtle dashed or dotted line)
- Rim at top center (small circle)
- **Shot dots**: Made = green filled circle (8px), Missed = red outlined circle (6px, no fill)
- Hot zones glow subtly (if 3+ makes from same area, show a soft green radial behind those dots)
- Below the chart: zone breakdown mini-bar — horizontal bar showing % of shots from each zone

#### 3. Stats Breakdown Card
- Grid layout, 2 columns:
  - **Best Streak**: number + "in a row" + fire icon if 3+
  - **Shots/Min**: pace stat
  - **Hot Zone**: zone name + mini court icon
  - **Cold Zone**: zone name + mini court icon
  - **3PT**: made/attempts + %
  - **Mid-Range**: made/attempts + %
  - **Paint**: made/attempts + %
- Each stat in its own mini glass tile within the card
- Numbers in Barlow Condensed, labels in Lexend

#### 4. XP Earned Card
- XP breakdown with count-up animation:
  - "Made shots: +120 XP" (12 × 10 XP each)
  - "Attempts: +40 XP" (20 × 2 XP each)  
  - "Streak bonus: +30 XP" (if applicable)
  - Divider line
  - **Total: +190 XP** (large, green, bold)
- Progress bar showing XP toward next level
- If level up happened: celebration banner "LEVEL UP! → All-Star" with badge

#### 5. Action Buttons Card (bottom)
- **"Save Session"** — primary CTA (green fill), saves to history
- **"Share Shot Chart"** — secondary CTA (glass border), generates shareable image
- **"New Session"** — tertiary text link, restarts camera
- **"Back to Track"** — tertiary text link, returns to Track tab

### Animations:
- Screen slides up from bottom over camera feed (300ms spring)
- Hero FG% counts up from 0 to final value (800ms ease-out)
- Shot dots appear one by one on the chart (staggered, 30ms apart)
- XP numbers count up (500ms each line, staggered)
- Stats cards fade-in staggered (100ms apart)

### Comparison to previous session (if available):
- Small delta indicators next to FG%: "↑ 5% vs last session" (green) or "↓ 3%" (red)
- Trend sparkline (tiny, 5-session history) next to the hero stat

### DO NOT:
- Make the shot chart too small — it should be the visual centerpiece
- Use a white/light court background — keep it dark, brand-consistent
- Forget the scroll — this is a lot of content, it should scroll smoothly
- Skip the celebration moment — if the user shot well, CELEBRATE it
