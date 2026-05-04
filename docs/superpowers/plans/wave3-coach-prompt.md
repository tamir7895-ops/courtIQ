# Wave 3 — Coach Tab (Purple)

> Paste this as a single message in Claude Design after usage resets. Upload `half-court.svg` and `half-court-zones.svg` as reference assets if not already in the project.

---

## PROMPT

We're now designing **Wave 3: Coach Tab** — the "brain" of CourtIQ. This tab has 3 surfaces. The personality is: **authoritative, insightful, honest — the brain.** Accent: `#bc8cff` (purple).

**IMPORTANT: For any court illustrations, use the approved `half-court.svg` asset already in this project. Do not draw courts from scratch.**

### Surface 1: Coach Landing (HeroPage) — REDESIGN

The coach gives a weekly AI-generated performance insight. Current design is a bulleted report — boring.

**Redesign as:**
- **One bold verdict line** at 48px italic — like a personal trainer talking to you: "Your mid-range is carrying you, but your handles are holding you back."
- Below the verdict: **2-3 insight cards** in `surface-glass`, each with an icon + short paragraph. Think coach's notes, not a medical report.
- **2 drill recommendations** as tappable `.ciq-xref` cards that link to the Train tab (source keeps purple accent, destination is Train blue).
- **"Update This Week" CTA** — primary button, purple accent. This triggers the performance form.
- **"View History" link** — secondary/text CTA at bottom.
- Empty state: "No insights yet. Tell me how your week went →" with CTA to the form.

### Surface 2: Update Performance (FormPage) — RESKIN

4-category self-assessment: Shooting, Ball Handling, Defense, Athleticism.

**Design as:**
- Each category gets a **glass card** with the category name, a basketball-themed icon, and a **slider** (NOT number input).
- Slider track: muted bg, fill = purple accent. Thumb = 44px tap target minimum.
- Scale: 1–10 with labeled endpoints ("Struggling" / "On Fire").
- Below all 4 sliders: **"Get Coach Feedback" primary CTA** (purple fill).
- Loading state after submit: basketball spinning icon + "Coach is reviewing..." italic text. This takes ~5 seconds (Anthropic API call).

### Surface 3: Insight History (ListPage) — NEW BUILD

Chronological list of past coach insights.

**Design as:**
- Each entry is a **glass card** with: date, verdict line (truncated to 1 line), overall rating badge.
- Tap → expands inline to show full insight + drill recs.
- Empty state if only 1 insight: "Keep updating weekly to see trends →"
- Sub-nav chip "History" in the Coach tab chip bar.

### Navigation connections:
- Coach Landing → "Update This Week" → Update Performance form
- Coach Landing → drill rec card tap → switches to Train tab Generator (via `sessionStorage['ciq-pending-drill']`)
- Coach Landing → "View History" → Insight History list
- Insight History → row tap → expand inline
- All screens → back arrow → Coach Landing

### Design tokens to use:
- Accent: `var(--c-coach)` / `#bc8cff`
- Glass: `rgba(22,25,33,0.7)` bg, `rgba(255,255,255,0.08)` border, `20px` blur
- Typography: verdict = H1 (48px Barlow Condensed italic), card titles = H3 (18px uppercase)
- Buttons: `.ciq-primary-btn` with purple accent, `.ciq-secondary-btn` for "View History"

### Deliverable:
One HTML file `v2/coach.html` with all 3 surfaces navigable (tabs/scroll or click to switch between landing, form, and history). Show the Coach Landing as the default view.
