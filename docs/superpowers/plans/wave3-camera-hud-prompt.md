# Wave 3A — Camera HUD (Flagship Feature Redesign)

> Context line to paste at the START of a new Claude Design chat:
> "Continue CourtIQ redesign. Read all artifact files first. The design system, tokens, components, and Chrome are already defined. This prompt is for ONE specific screen."

---

## PROMPT

Design the **Shot Tracking Camera HUD** — this is CourtIQ's flagship feature and the most impressive screen in the app. It has 3 phases, all fullscreen DetailOverlay on top of a live camera feed. Everything must be in glass cards or translucent panels — NO floating bare text.

### Design system reminder
- Read `colors_and_type.css` for tokens, `ui-kit.css` for components
- Glass: `rgba(22,25,33,0.7)` bg, `rgba(255,255,255,0.08)` border, `20px` blur
- Track tab accent: `--c-track: #56d364` (green) — this screen belongs to Track
- Fonts: Barlow Condensed (display/numbers), Lexend (body)
- All content in `surface-glass` cards — no bare floating text

---

### Phase 1: Rim Lock (Auto + Manual Fallback)

Full-screen camera preview. The AI auto-detects the rim (green pulsing circle when found). Manual tap fallback appears after 5 seconds if no detection.

**Design elements:**
- **Top instruction bar** (glass pill): "Point camera at the basketball rim" with subtle animated arrow pointing down
- **Crosshair overlay**: thin translucent grid lines (2 horizontal + 2 vertical forming a center zone) — NOT thick opaque lines. Think sniper scope meets broadcast calibration. Subtle green tint on lines.
- **Rim detection indicator**: when AI detects the rim, show a rounded rectangle outline (green, pulsing glow) around the detected rim area. Show confidence % in a tiny pill badge next to it.
- **Auto-lock animation**: when rim is locked, the crosshair collapses into the rim position with a satisfying snap animation, lines turn solid green, checkmark appears briefly
- **Manual fallback** (shown after 5s): "Tap the rim center" instruction + "+" crosshair appears at tap point + rim size +/- buttons in a glass card
- **Lock button**: glass card at bottom, "Lock Rim & Start" primary CTA (green fill)
- **Cancel button**: subtle text button below

**Vibe:** Targeting system. Precision. Technical but beautiful. The "Focus/Target" brand pillar.

---

### Phase 2: 3-Point Calibration (optional, quick)

Camera preview with locked rim shown (green outline). User taps 3PT line.

**Design elements:**
- **Top glass pill**: "Tap any point on the 3-point line"
- **Locked rim marker**: green rectangle outline at rim position (from Phase 1)
- **Tap marker**: when user taps, show a green dot at tap point + a dashed line connecting to rim
- **3PT arc visualization**: after tap, draw a faint arc based on the distance — shows the calculated 3PT boundary. This makes the math feel visual.
- **Bottom bar** (glass card): "Confirm" primary CTA + "Skip (use defaults)" secondary text button

**Vibe:** Clean, mathematical, showing geometry. The court forming from the user's input.

---

### Phase 3: Live Tracking HUD (THE MONEY SHOT)

This is where the user is actively shooting. The camera is recording, YOLOX is detecting shots in real-time. The HUD must be:
- **Transparent** — never block more than 15% of camera view
- **Glanceable** — readable in peripheral vision while shooting
- **Celebratory** — made shots feel amazing
- **High contrast** — outdoor court, bright sunlight conditions

**TOP BAR** (glass card, horizontal, top of screen with safe area padding):
- Left section: **Made** counter (large number, green) / divider / **Attempts** counter (large number, white)
- Center: **FG%** — THE hero stat. Biggest number on the HUD (32px+ Barlow Condensed Bold). Green if >50%, amber if 30-50%, red if <30%
- Right: **Timer** (MM:SS, monospace feel, muted color)

**STATUS BADGE** (floating glass pill, below top bar):
- Pulsing green dot + "Tracking" when active
- Amber dot + "Loading..." when model is initializing
- Red dot + "Rim Lost" if detection drops (auto-recovers)

**ZONE INDICATOR** (small glass card, top-right area):
- Mini half-court diagram (tiny, ~50px) showing a highlighted dot where the current shot zone is
- Zone name text: "Left Wing", "Top of Key", "Paint", etc.

**MADE SHOT CELEBRATION** (fullscreen flash overlay):
- Green flash with radial gradient from center, quick fade (300ms)
- "SWISH!" or "MADE!" text (Barlow Condensed, 48px, italic) — appears and scales up then fades
- Streak counter: if 2+ consecutive makes, show "🔥 3 IN A ROW!" with increasing emphasis
  - 2 in a row: small text
  - 3 in a row: medium + fire emoji
  - 5+: large + screen edge glow + "ON FIRE!" text

**MISS INDICATOR** (subtle):
- Brief red pulse on screen edges only (NOT fullscreen flash) — 150ms
- No text, just the visual cue

**BOTTOM BAR** (glass card, bottom of screen with safe area padding):
- **End Session** button: glass pill with red accent, stop icon (square) + "End Session" text
- **Debug toggle**: tiny bug icon in corner (for dev only, 90% transparent)

**End Session Confirmation** (glass modal overlay):
- Glass card centered on screen
- "End session and view results?"
- Two buttons: "End Session" (red primary) + "Keep Going" (green secondary)

**Design direction:** ESPN/TNT broadcast overlay quality. The stats should look like they belong on a live sports broadcast. Think of how NBA games show the score — clean, glanceable, premium. The made shot celebration should be a genuine dopamine hit that makes users want to keep shooting.

---

### Layout rules for all 3 phases:
1. Camera feed is ALWAYS the full background — no borders, no padding
2. All UI elements float ON TOP of the camera in glass cards/pills
3. Use `backdrop-filter: blur(12px)` on glass elements (less blur than normal to keep camera visible)
4. Safe area insets: 48px top (for notch), 34px bottom (for home indicator)
5. No bottom nav bar on this screen — it's a fullscreen DetailOverlay
6. Landscape orientation should also work (rearrange stats horizontally)

### Animations:
- Phase transition: crossfade between phases (200ms)
- Stat counter updates: brief scale pulse on number change (1.1x → 1.0x, 150ms)
- Status badge: pulse animation on the dot (opacity 0.4 → 1.0, 1.5s loop)
- Made flash: ease-out opacity from 0.6 → 0 over 300ms
- Streak text: spring-in animation (scale 0.5 → 1.05 → 1.0)

### DO NOT:
- Block the camera center area with any persistent UI
- Use opaque backgrounds on any element (max 70% opacity)
- Show debug elements by default
- Make the end session button too easy to accidentally tap
