# Wave 5 — Onboarding + Me Tab Identity (Teal)

> Paste this as a single message in Claude Design. Two parts: the onboarding flow (first-run) and the Me tab redesign. Me tab personality: **personal, earned, identity — your trophy room.** Accent: `#2dd4bf` (teal).

---

## PROMPT

We're now designing **Wave 5** — the identity layer. This covers first-run onboarding AND the Me tab where your player identity lives.

**IMPORTANT: For any court illustrations, use the approved `half-court.svg` asset already in this project. Do not draw courts from scratch.**

---

## PART A: Onboarding Flow (7 steps)

New user first-run experience. Each step is a fullscreen page with progress bar at top (step X of 7). Dark background, centered content, "Next" CTA at bottom. "Skip" option on optional steps.

### Step 1: Welcome
- CourtIQ logo (centered, large)
- "TRAIN. TRACK. WIN." tagline
- "Get Started" primary CTA (brand color `#ff3a14`)

### Step 2: What's your name?
- Single text input, large (H2 sized), centered
- Placeholder: "Your name"
- Auto-focus, keyboard opens immediately
- "Next" CTA

### Step 3: How old are you?
- Scroll wheel or stepper (NOT a text input)
- Range: 10–60, default: 18
- "Next" CTA

### Step 4: How tall are you?
- Dual toggle: cm / ft+in
- Scroll wheel or stepper for height value
- "Next" CTA

### Step 5: What's your position?
- 5 position cards in a vertical list, each is a glass card:
  - **Point Guard** — "The floor general"
  - **Shooting Guard** — "The scorer"
  - **Small Forward** — "The versatile wing"
  - **Power Forward** — "The interior force"
  - **Center** — "The anchor"
- Single select (teal border on selected). "Next" CTA.

### Step 6: Rate your skills
- Radar/spider chart with 5 axes: Shooting, Ball Handling, Defense, Athleticism, Basketball IQ
- Each axis: draggable point or slider (1–10)
- The radar fills with teal accent as you adjust
- "This helps Coach AI personalize your training"
- "Next" CTA

### Step 7: Create your avatar
- Full Avatar Customizer (DiceBear Avataaars) embedded
- 6 quick presets at top: Street Baller, Game Face, MVP, Drip King, Hoop Star, Court Legend
- Below: category tabs for detailed customization (Skin, Hair, Eyes, Mouth, Clothes, Accessories)
- Large avatar preview (300×300) at top
- "Done" CTA → routes to Home tab

### Onboarding design direction:
- Each step should feel like a player registration screen from a basketball game
- Progress bar = 7 segments, filled segments use brand orange gradient
- Transitions between steps: slide left animation
- Step 6 radar chart should feel premium — animated fill, clean grid lines
- Step 7 avatar should be the most fun — this is where the user starts to feel ownership

---

## PART B: Me Tab (Teal) — REDESIGN

### Surface 1: Profile (HeroPage, default) — REDESIGN

**Hero area:**
- **Avatar** (84px) centered or left-aligned. Tap → Avatar Customizer overlay.
- **Player name** at H1 (48px italic)
- **Position + Level badge** (e.g., "SG · All-Star")
- **3-stat strip** below: Games Played | Total Shots | Overall FG% — each in a glass tile

**Below hero:**
- **Archetype card** — glass card showing player archetype (e.g., "Sharp Shooter") with a mini radar chart of strengths. Tap → Archetype detail.
- **Trophy carousel** — horizontal scroll of earned badges (earned = full color, locked = dimmed outline). "See All →" → Trophies page.
- **Account row** — simple row with email + settings gear icon. Tap → Settings BottomSheet.

### Surface 2: Trophies (ListPage) — NEW BUILD

Full badge gallery.
- Grid layout (3 columns): each badge is an icon + name + earned date or lock icon
- **Earned badges**: full color, teal accent border, tap → celebration detail with earn date + description
- **Locked badges**: dimmed, lock icon overlay, tap → requirements + progress bar toward unlocking
- Categories: Training (workout streaks), Shooting (accuracy milestones), Social (challenges won), Collection (avatar items)

### Surface 3: Social (ListPage) — POLISH

- **Top 10 Leaderboard**: ranked list, glass cards, each showing: rank + avatar (32px) + name + key stat. Current user highlighted.
- **Active Challenges**: glass cards showing challenge name + opponent + status + "Accept"/"View" CTA.
- **"Send Challenge"** CTA → composer BottomSheet.
- **"Copy Link"** CTA → clipboard + toast.

### Surface 4: Avatar Customizer (DetailOverlay) — REDESIGN

See onboarding Step 7 for the full spec. Same component, but:
- When accessed from Profile (not onboarding), show "Save" instead of "Done"
- Show current avatar state, changes are preview-only until saved
- Include "Reset to Default" option

### Surface 5: Shop (ListPage) — REDESIGN

Full cosmetics store:
- **Wallet bar** (sticky top): coin icon + balance + XP + level badge
- **Category tabs**: Accessories / Hair / Beard
- **Item grid** (2 columns): each card shows mini avatar wearing the item + item name + price
  - Owned: teal "Equipped" or "Owned" badge
  - Affordable: "Buy [X coins]" CTA active
  - Too expensive: dimmed CTA, "Need X more"
  - Level-locked: lock icon + "Level X" badge
- **Buy flow**: tap → BottomSheet with large avatar preview (300px) wearing item + price + "Buy" / "Cancel"
- **Empty wallet**: "Earn XP through training → Start a workout" CTA linking to Train

### Surface 6: Settings (BottomSheet) — POLISH

- Email (read-only display)
- Sign Out button (danger style)
- Notification toggle
- About / Version
- Help / Feedback link

### Navigation connections:
- Profile → Avatar tap → Avatar Customizer overlay
- Profile → Trophy carousel "See All" → Trophies page
- Profile → Archetype card → Archetype detail (inline expand or sub-page)
- Profile → Account row → Settings BottomSheet
- Trophies → badge tap → detail or requirements
- Social → leaderboard row → mini-profile BottomSheet
- Social → "Send Challenge" → composer BottomSheet
- Shop → item tap → buy confirmation BottomSheet
- Shop → "Earn XP" CTA → Train tab (tab switch)

### Design tokens:
- Accent: `var(--c-me)` / `#2dd4bf`
- Avatar borders: 2px teal accent
- Trophy earned: teal glow, locked: `surface-flat` with dimmed opacity
- Shop wallet: teal accent for balance

### Deliverable:
Two HTML files:
1. `v2/onboarding.html` — 7-step flow, navigable with Next/Back
2. `v2/me.html` — Profile as default, sub-nav chips for Trophies/Social/Shop, Avatar Customizer as overlay
