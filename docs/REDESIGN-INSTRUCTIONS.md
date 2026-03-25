# CourtIQ Dashboard Redesign — Instructions for Claude Code

## IMPORTANT: Read This First
You are redesigning the CourtIQ dashboard UI. The app is a **basketball AI training platform**.
**Attached images show the target design** created by a designer — your job is to implement that exact style.

Before changing ANY HTML or CSS:
1. Read `docs/DO-NOT-BREAK.md` — it lists every ID, class, and data attribute used by JavaScript
2. NEVER rename element IDs, data-tab values, or data-section values
3. NEVER change script load order
4. NEVER delete localStorage keys
5. You CAN freely change: CSS styles, colors, spacing, layout, animations, add new classes

---

## Design Vision (Based on Attached Images)

### Overall Style
- **Dark mode** — background `#0e1014`, surfaces `#161921`
- **Amber/gold accent** — `#f5a623` (basketball gold)
- **Glassmorphism** — cards with `backdrop-filter: blur(20px)`, semi-transparent backgrounds
- **Font:** Barlow Condensed (headings, UPPERCASE) + Barlow (body)
- **Generous spacing** — cards are full-width, vertical scroll, no cramped grids
- **Hover lift** — cards rise on hover with amber border glow

### Bottom Navigation (5 tabs)
Replace current sidebar+bottom nav with a clean 5-tab bottom bar:
```
HOME | TRAINING | TRACKER | COACH | PROFILE
```
- Active tab: amber icon + text, others muted
- TRACKER tab has a slightly raised/highlighted icon
- Keep `data-section` attributes for JS routing

---

## Screen-by-Screen Specs

### 1. HOME SCREEN (`#db-panel-home`)

**Header:** Avatar (top-left) + "LVL {X}" + "COURTIQ" centered + bell icon (top-right)

**Hero Card:**
- "LET'S WORK, {NAME}." — big bold text (Barlow Condensed, 32px, white)
- "SESSION {N} // HIGH INTENSITY FOCUS" — subtitle in amber
- Dark gradient background with subtle basketball court image

**Stat Cards (vertical stack, full-width):**
1. **Training Streak** — "{N} DAYS" large text + blue progress bar + shoe icon
2. **Season Progress** — "{N} XP" large text + "+{N} XP FROM LAST SESSION" in green + trend icon
3. **Current Tier** — "{TIER}" (Rookie/Hooper/All-Star/MVP) + "RANK #{N} GLOBAL" + chart icon

**Skill Matrix Card:**
- Title: "SKILL MATRIX" + "AI ANALYZED" badge (amber)
- 4 donut rings in 2x2 grid: Shooting, Dribbling, Defense, IQ
- Each ring: amber `conic-gradient`, percentage in center
- Data from existing `#stat-shooting`, `#stat-dribbling`, `#stat-defense`, `#stat-gameiq`

**AI Coach Insight Card:**
- Yellow dot + "AI COACH INSIGHT" label
- Large italic quote from AI: "YOUR SHOT SPEED IN CORNER 3S IS IMPROVING..."
- Two buttons: "START DRILL" (amber) + "VIEW DETAILS" (outline)
- Generate insights from Claude API + fallback template pool

**Recent Sessions:**
- Title: "RECENT SESSIONS" + "HISTORY" link (amber)
- Session cards with:
  - Icon + session name ("SHOOTING - PERIMETER FOCUS")
  - Metadata: "YESTERDAY // 45 MIN // 240 CAL"
  - **Performance grade: A+, A, A-, B+, B, B-, C+, C, D, F** (right side)
  - Grade calculated from: accuracy %, completion %, consistency

### 2. TRAINING SCREEN (`#db-panel-drills`)

**Search bar** at top: "Search drills, difficulty, gear..."

**Filter pills:**
- POSITION: G, F, C
- DIFFICULTY: Beginner, Pro, Elite
- GEAR: Cones, Weight

**Featured Banner:**
- Large image card: "7 DAY SHOOTING INTENSIVE"
- Subtitle about AI-personalized drills
- Background: AI-generated basketball image

**Recommended Drills:**
- "RECOMMENDED DRILLS" + "VIEW ALL →" (amber)
- Large vertical cards with:
  - **AI-generated background image** for each drill
  - Duration badge (e.g., "12 MIN") in top-right
  - Level tag (ELITE/PRO/BEGINNER) + category (HANDLES/SHOOTING)
  - Drill name bold
  - Equipment icon + text
  - Play button (amber circle, right side)

**Browse by Focus:**
- "BROWSE BY FOCUS" title
- 2-column image grid: DEFENSE, COURT AWARENESS, IQ, etc.
- Each with a basketball action photo and category label overlay

### 3. SHOT TRACKER SCREEN (`#db-panel-shots`)

**Live tracking overlay (when camera active):**
- Stats bar at top: MADE (white) | MISSED (amber) | ACCURACY % (white)
- Large numbers (48px bold)
- Camera feed as full-screen background
- "OBJECT: RIM (98%)" detection indicator with circle
- **Live Heatmap** mini-card: half-court with shot dots (amber=made, red=missed)
- Bottom: "AI ANALYSIS" button (white outline) + "STOP SESSION" button (red/coral)
- AI Suggestion bar: "AI SUGGESTION: Your release angle is 4° too low on perimeter shots."

**Manual input (when no camera):**
- Keep existing form but restyle to match dark card design
- FG / 3PT / FT inputs with amber accents

### 4. AI COACH SCREEN (`#db-panel-coach`)

- Restyle existing AI Coach panel with the new card design
- Performance input cards with glassmorphism
- Equipment selection as pill buttons
- AI output in a quote card similar to home screen insight

### 5. PROFILE SCREEN (`#db-panel-shop` + `#db-panel-archetype`)

**Header:** Avatar + "@USERNAME" + "LVL {N}" + "COURTIQ" + bell

**Hero:**
- "ROAD TO MVP." — title with "MVP." in amber/gold
- Motivational subtitle text

**Avatar Display:**
- Large avatar card (full-width, ~300px tall)
- "ELITE EDITION" badge if high level
- 4 icon buttons below: customize, stats, settings, share

**Progress Card:**
- "CURRENT TIER" label
- Tier name large (HOOPER)
- "75% COMPLETE" with progress bar
- Tier markers: ROOKIE — HOOPER — ALL-STAR — MVP
- "Earn {N} XP to reach {NEXT_TIER}"

**Daily Drills:**
- Countdown timer (23:59:01 LEFT)
- Challenge items with progress (34/50, 1/2)

**Cosmetics Shop:**
- "COSMETICS SHOP" + "VIEW ALL GEAR" link
- 2-column grid of items with:
  - Product image
  - Rarity badge (LEGENDARY gold, RARE purple)
  - Name + color variant
  - Price in coins (e.g., "2.4K")

---

## New Features to Implement

### Session Performance Grades
Add grading logic to `dashboard.js` or new `js/session-grading.js`:
```
A+ = 95%+ accuracy + full completion
A  = 90-94% accuracy
A- = 85-89%
B+ = 80-84%
B  = 75-79%
B- = 70-74%
C+ = 65-69%
C  = 60-64%
D  = 50-59%
F  = below 50%
```
Factor in: shooting %, drills completed %, session duration vs target.

### AI Coach Insight (Home Screen)
- On page load: check `localStorage` for cached insight (max 4 hours old)
- If stale: call Claude API with last session data → generate 1-2 sentence coaching tip
- Fallback: rotate through 20+ hardcoded templates based on last session type
- Store in `courtiq-ai-insight` localStorage key

### Drill Images
- Generate 60+ basketball drill images using AI (Midjourney/DALL-E style)
- Store in `assets/drills/` folder
- Map to drill IDs in drill-engine.js
- Fallback: use category-based default images

---

## Color Reference

| Token | Hex | Usage |
|-------|-----|-------|
| bg | `#0e1014` | Page background |
| surface | `#161921` | Card backgrounds |
| surface-2 | `#1e2129` | Elevated cards |
| amber | `#f5a623` | Primary accent, CTAs |
| amber-hover | `#ffc04a` | Hover states |
| text | `#f0ede6` | Primary text |
| text-muted | `rgba(240,237,230,0.65)` | Secondary text |
| green | `#56d364` | Success, positive |
| red | `#e84040` | Error, missed shots |
| coral | `#ff6b6b` | Stop/danger buttons |
| purple | `#bc8cff` | Rare items, XP |
| blue | `#4ca3ff` | Info, streaks |
| teal | `#2dd4bf` | Calendar, summary |
