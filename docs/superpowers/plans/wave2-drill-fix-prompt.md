# Wave 2.5 — Drill Library Fix (send first when usage resets)

> This is the FIRST thing to send when your Claude Design usage resets. It's a quick fix, not a full wave.

---

## PROMPT

The Drill Library from Wave 2 needs these specific fixes:

### 1. Text in cards, not floating
All text content (drill names, descriptions, stats, instructions) must live inside `surface-glass` cards with backdrop blur, border, and padding. No bare/floating text anywhere on the page. Every piece of content needs a card container.

### 2. Drill list → skill tree progression
Replace the flat scrollable list with a **skill tree / progression map**:
- Group drills into **5 skill categories** displayed as horizontal swim lanes: Shooting, Ball Handling, Finishing, Defense, Conditioning
- Each category header shows: icon + name + "3/10 Mastered" progress + "See All →"
- Below each header: **horizontal card carousel** of drills in that category
- Each drill card shows:
  - Small court diagram thumbnail (use the approved `half-court.svg`, show a dot where the drill happens)
  - Difficulty badge (color-coded: green/amber/red)
  - Duration estimate
  - XP reward value
  - Mastery indicator: locked (flat surface + lock) / bronze / silver / gold / diamond
  - Completion count
- Locked drills: `surface-flat`, muted, lock icon. Unlocked: `surface-glass` with subtle blue glow.
- This should feel like NBA 2K skill challenges — a progression system, not a list.

### 3. Detail screen — card-based sections
The drill detail overlay: 5 distinct glass card sections stacked:
- **Hero card**: drill name + court animation preview + difficulty + duration
- **Instructions card**: numbered steps
- **Tips card**: coaching points
- **Your History card**: best score, times completed, trend sparkline
- **Similar Drills card**: horizontal scroll of related drill tiles

### 4. Pre-flight screen — cards too
Equipment needed, space required, ready indicator — all in glass cards, not floating text.

### 5. "For You" suggested plan
At the top of the library, before the skill paths: a **suggested workout plan** card (glass, prominent):
- "Recovery Plan · 7B" or similar label
- Description: "A 41-min session — warm-up, two focus drills, cooldown"
- Duration + drill count
- "+ Build My Plan" CTA

**Vibe: This is a player's training facility in a basketball RPG. Every drill is a challenge you can master.**
