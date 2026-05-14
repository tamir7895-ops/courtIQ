# AI Image Prompts — CourtIQ Landing

Four prompts to feed into Midjourney (v6+) or your image model of choice.
Numbers correspond to the placeholder labels in `index.html`
(`[ AI IMG 02 → swap ]`, etc.).

The basketball texture (#01) replaces the procedural canvas-drawn
texture in `index.html`. The three iPhone mockups (#02–#04) replace
the styled phone placeholders inside the sticky features section.

---

## #01 — Hero basketball texture

> A flat 2:1 unwrapped basketball texture map. Classic NBA leather
> basketball, deep burnt orange (#c14a05) base, black ink seam lines
> running vertically and horizontally, slight dust and scuff marks
> showing real wear, photorealistic pebble grain detail, studio-lit
> from above with subtle warm highlight, no background, no text,
> no logo, edges tile seamlessly, sphere-map ready.
> --ar 2:1 --style raw --v 6 --q 2

**Save to:** `landing/textures/basketball.jpg`
**Aspect:** 2:1 (e.g. 2048 × 1024)

---

## #02 — iPhone mockup: Shot Tracker

> iPhone 15 Pro mockup, dark titanium edge, screen showing a
> first-person basketball court POV through the phone camera.
> Overlaid YOLOX detection boxes — bright orange (#e85d04)
> rectangle around the basketball mid-air, lime-green box around
> the rim and backboard, cream outline box around the player.
> Shot counter top-left in heavy condensed type ("MADE 7 / 10"),
> small monospace caption below ("LIVE · 04:21"). Dark UI #0e1014
> with cream (#f4ede4) and orange accents. Broadcast-graphic
> aesthetic, NBA League Pass overlay vibe. No glare, slight
> drop shadow on the phone, perfect 3/4 perspective.
> --ar 9:19 --style raw --v 6 --q 2

**Replaces:** the `[ AI IMG 02 → swap ]` placeholder under the
"AI Shot Tracking" feature panel.

---

## #03 — iPhone mockup: AI Coach

> iPhone 15 Pro mockup, screen showing a chat interface with an
> AI basketball coach. Dark theme #0e1014 background, cream
> (#f4ede4) text. Coach messages in solid orange (#e85d04)
> bubbles aligned left, user messages in subtle outlined cards
> aligned right. Typography: condensed display sans for headers,
> mono caption labels ("— COACH" / "— YOU"). One coach reply
> visible mid-screen reads "Your elbow flared on 3 of 6 pull-ups.
> Run elbow tuck — 5 spots. 8 min. Now." Small data card showing
> a sparkline of last week's shooting percentage. Glassmorphism
> on cards, athletic editorial layout.
> --ar 9:19 --style raw --v 6 --q 2

**Replaces:** the `[ AI IMG 03 → swap ]` placeholder under the
"Personal AI Coach" feature panel.

---

## #04 — iPhone mockup: Stats dashboard

> iPhone 15 Pro mockup, screen showing a basketball training
> analytics dashboard. Three large concentric ring charts at the
> top showing shooting percentages by zone (74%, 61%, 88%) with
> orange (#e85d04) progress arcs on dark cream-tinted (#f4ede4 at
> low opacity) tracks. Below: a horizontal bar chart of weekly
> shot volume in alternating orange and cream bars. Heat-map
> court diagram of made vs. missed shots. Header reads "WEEK 18"
> in heavy condensed type. Mono caption labels throughout. Dark
> #0e1014 UI, cream + orange palette only. NBA broadcast graphic
> aesthetic — feels like a Synergy stat sheet redesigned by
> Hypebeast.
> --ar 9:19 --style raw --v 6 --q 2

**Replaces:** the `[ AI IMG 05 → swap ]` placeholder under the
"Stats That Matter" feature panel.

---

## Bonus — `[ AI IMG 04 → swap ]` (Drills library)

The Drills panel currently uses a styled list (no AI image
needed). If you want a fourth mockup to match the others, use
this prompt:

> iPhone 15 Pro mockup, screen showing a basketball drill library
> list — 7 drill rows visible with name on the left ("Form
> Shooting · 5 spots", "Curl Catch & Shoot", "Pull-Up Off Screen")
> and duration on the right ("12 min", "10 min"). Header reads
> "DRILLS · 81" in heavy condensed type. Bottom of screen shows
> a tabbed nav. Dark #0e1014 UI, cream + orange accents, mono
> labels. Editorial brutalist aesthetic — Hypebeast meets Whoop
> meets NBA broadcast.
> --ar 9:19 --style raw --v 6 --q 2

---

## Workflow notes

1. Generate all four prompts in one batch.
2. Upscale the best result for each to 2× minimum.
3. For the iPhone mockups, mask out any background and export as
   transparent PNG so the orange glow shadow on `.phone` shows
   through naturally.
4. Save into `landing/images/` (create the folder) as:
   - `phone-shot-tracker.png`
   - `phone-ai-coach.png`
   - `phone-stats.png`
5. In `index.html`, replace each `<div class="phone">…</div>`
   inside `.feature-panel` with `<img class="phone" src="…">`
   and add `object-fit: contain` to the rule for `.phone`.
