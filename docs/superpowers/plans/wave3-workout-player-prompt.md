# Wave 3C — Train Today + Workout Player

> Context line: "Continue CourtIQ redesign. Read all artifact files. Design system is defined. This prompt covers TWO connected screens."

---

## PROMPT

Design TWO connected screens for the Train tab: the **"Train Today" daily workout card** (shown at the top of the Train tab) and the **Workout Player** (fullscreen overlay during drill execution). Everything in glass cards.

### Design system reminder
- Train tab accent: `--c-train: #4ca3ff` (blue)
- Glass cards for ALL content
- Fonts: Barlow Condensed (display), Lexend (body)

---

### SCREEN 1: "Train Today" Card (top of Train tab)

This is a prominent card at the top of the Train/Drill Library screen. It shows the AI-recommended daily workout.

**Card design:**
- **Glass card** with blue (`--c-train`) accent glow on left border or top edge
- **Header**: "TODAY'S WORKOUT" eyebrow (uppercase, 11px, Lexend, muted) + workout name in H2 italic (e.g., "Midrange Masterclass")
- **Workout meta row**: 
  - Duration pill: "35 min" with clock icon
  - Drill count pill: "4 drills" with layers icon
  - Difficulty badge: "Intermediate" color-coded (green/amber/red)
  - XP reward: "+200 XP" in blue accent
- **Drill preview list** (inside card, compact):
  - 3-4 drill names with small icons: "1. Elbow Jumpers · 2. Free Throw Rhythm · 3. Stepback 3s · 4. Cooldown Shooting"
  - Each with tiny duration label
- **CTA button**: "Start Workout" — primary blue fill button, full width at card bottom
- **Secondary**: "Customize" text link to swap drills

**If no workout generated yet**: empty state card with "Generate your daily workout" + CTA button

---

### SCREEN 2: Workout Player (fullscreen DetailOverlay)

This is the IN-SESSION screen while the user is actively doing drills. The user is on a basketball court, sweating, tapping with one thumb. **EVERYTHING must be huge, high-contrast, and minimal.**

#### Active Drill State (blue-accented):

**TOP SECTION** (glass card):
- **Drill name**: H2, italic, Barlow Condensed (e.g., "Elbow Jumpers")
- **Set/Rep indicator**: "Set 2 of 4" in muted text
- **Progress dots**: small horizontal dots showing drills completed (filled) vs remaining (outline). Current = blue glow.

**CENTER — THE TIMER** (hero element, NOT in a card — just floating large):
- Countdown number: **72px+ Barlow Condensed Bold**, white
- Circular progress ring around the number (blue accent, SVG arc that depletes)
- Below timer: current rep text "Rep 3 of 10" (smaller, muted)

**BOTTOM SECTION** (glass card):
- **Control buttons** — large touch targets (min 56px height):
  - **Pause/Resume**: large center button, blue fill when active, glass outline when paused
  - **Skip Rep**: left side, glass outline, "Next →" 
  - **Skip Drill**: right side, glass outline, "Skip Drill ⟫"
- All buttons have generous padding for sweaty thumb taps

#### Rest State (dimmed, calm):
- Background dims to ~40% opacity overlay
- Timer shows REST countdown in amber accent
- "Up Next:" preview of next drill name + duration
- "Skip Rest" button appears (glass, amber border)
- Calm pulsing animation (slow breathe effect on the timer ring)

#### Workout Complete State:
- Celebration screen (same fullscreen overlay):
  - Big checkmark animation (green, scales in with spring)
  - "WORKOUT COMPLETE!" H1, italic
  - Stats glass card:
    - Total time
    - Drills completed
    - Total reps
    - XP earned (count-up animation)
  - CTA: "Save & Exit" (green primary) + "Start Shot Tracking" (blue secondary, links to camera)

#### Drill Transition (between drills):
- Brief transition card (500ms):
  - "Next Drill" eyebrow
  - Drill name (H2)
  - Court animation preview (the existing canvas drill animation, 280×176px, inside a glass card)
  - Brief description
  - Auto-continues after 3 seconds (or tap to skip)

### Audio cues (note for implementation, not visual):
- Start beep on each rep
- Rest timer tick on last 3 seconds
- Drill switch sound
- Workout complete celebration sound

### Animations:
- Timer ring: smooth SVG arc depletion (CSS transition on stroke-dashoffset)
- State transitions (active ↔ rest): 200ms crossfade with color shift
- Progress dots: bounce animation when one completes
- Workout complete: confetti particles + checkmark spring-in

### DO NOT:
- Make buttons smaller than 48px touch target
- Show too much info during active state — timer is KING
- Use low contrast colors (user is outdoors in sunlight)
- Forget landscape mode (rearrange vertically → horizontally)
- Add a bottom nav bar — this is fullscreen
