# CourtIQ — Landing Page

**Standalone marketing landing page.** Not connected to the CourtIQ
app code in any way — this is a self-contained design exploration of
what a CourtIQ marketing site could look like. Lives at the project
root next to the app, but doesn't depend on it, doesn't import from
it, and isn't included in the app's build (`build.js` does not copy
this folder to `www/`).

It's production-ready as a website on its own: real basketball
texture, real iPhone mockups (SVG), working waitlist form, wired
CTAs.

```
landing/
├── index.html              ← the entire page
├── textures/
│   └── basketball.jpg      ← real 1024×512 basketball texture
├── images/
│   ├── courtiq-logo.svg    ← brand icon
│   ├── favicon.svg         ← favicon + apple touch
│   ├── screen-shot-tracker.svg
│   ├── screen-ai-coach.svg
│   ├── screen-drills.svg
│   └── screen-stats.svg
├── AI_IMAGE_PROMPTS.md     ← (optional) Midjourney prompts for higher-fidelity replacements
├── DEPLOY.md               ← one-command deploy recipes
└── README.md               ← this file
```

The landing page now ships **complete** — no swap-in tasks required to
go live. The `AI_IMAGE_PROMPTS.md` file is kept for the "phase 2" upgrade
where you swap the SVG mockups for photorealistic AI-generated images.

---

## Aesthetic decision

NBA League Pass broadcast graphics meet brutalist editorial. Cream
(#f4ede4) on near-black (#0e1014), with orange (#e85d04) used as the
league-overlay accent. Heavy condensed display type (Barlow Condensed
800/900) does the shouting, Lexend handles reading, JetBrains Mono
handles captions and stat labels.

## Patterns used (all six)

1. **Oversized Type Hero** — "COURTIQ" at 30vw, edge-to-edge.
2. **Floating Hero Object (Three.js)** — basketball with real
   1024×512 baked texture (orange leather + black seam lines + pebble
   grain), rolls across hero on scroll with rolling-physics rotation
   and a subtle vertical bounce. Falls back to procedural canvas
   texture if the JPG 404s.
3. **Scroll-Driven Camera** — perspective camera dollies z=5.5 → z=4.2
   across the hero scrub, so the ball grows as it rolls off-screen.
4. **Marquee Strip** — two strips, one orange (left-scroll), one dark
   (right-scroll), with stat callouts.
5. **Sticky Section Reveal** — `.features-section` is 420vh, pinned
   100vh viewport switches between four chapters
   (AI Shot Tracking → AI Coach → Drills → Stats) driven by
   ScrollTrigger.
6. **Magnetic Buttons** — every `.magnetic` CTA pulls toward the
   cursor with smooth lerp; resets on mouseleave. Disabled on touch
   devices and `prefers-reduced-motion`.

Plus the requested **court-line grid texture** (free-throw circle, key
rectangle, three-point arc) at low opacity in the hero, and a subtle
film-grain overlay on the body.

---

## What works out of the box

- ✅ Real CourtIQ logo (compass-basketball, brand-amber → orange) in nav
- ✅ Real 1024×512 basketball JPG loaded into the Three.js sphere
- ✅ Four SVG iPhone mockups (lightweight, brand-accurate, scale crisp at any zoom)
- ✅ Working **waitlist modal** triggered by the two primary CTAs
  - Captures email, validates, stores to `localStorage`
  - Fires a `mailto:tamir7895@gmail.com` as a hard backup so the
    request actually reaches the inbox
  - Shows success state inline
- ✅ Press / Partners CTA → `mailto:tamir7895@gmail.com`
- ✅ Favicon + Apple touch icon
- ✅ All copy is hand-written (no Lorem ipsum, no AI slop voice)
- ✅ Responsive (tested at 380, 768, 1440px)
- ✅ `prefers-reduced-motion` respected
- ✅ Touch devices skip magnetic effect

## Optional upgrades (nice-to-haves)

### Phase 2 — Replace SVG mockups with photorealistic images

The four `screen-*.svg` files are deliberately illustrative (vector
art that depicts real CourtIQ features). They look great as-is and
load in milliseconds. If you want photorealistic phone mockups
later, generate the four prompts in `AI_IMAGE_PROMPTS.md`, save the
PNGs into `images/`, and change the four `<img src="…">` references
in `index.html`. No other changes needed.

### Phase 3 — Replace the waitlist mailto with a real endpoint

The current waitlist form:
1. Stores email in `localStorage` (so you can read it via DevTools
   on your own machine if testing)
2. Triggers a `mailto:` to `tamir7895@gmail.com` as the actual
   delivery mechanism

To upgrade, replace the form `submit` handler in `index.html`
(search for `// Persist to localStorage`) with a `fetch()` to your
real endpoint:

```js
await fetch('https://api.courtiq.app/waitlist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, source: 'landing-hero' }),
});
```

Recommended free endpoints:
- **Tally** — `https://tally.so/embed` form action URL
- **Airtable** — Airtable form embed
- **Resend** — POST to a Cloudflare Worker that sends via Resend
- **Supabase** — your existing Supabase project (CourtIQ uses one)
- **Notion** — Notion API "create page" against a database

### Phase 4 — Wire iOS CTA to TestFlight URL when ready

Currently the iOS CTA opens the waitlist modal. When TestFlight
goes live, change the `data-action="waitlist"` attribute to a real
`href`:

```html
<a class="btn btn-primary magnetic"
   href="https://testflight.apple.com/join/XXXXXXXX">
   Download for iOS <span class="arrow">→</span>
</a>
```

---

## Copy lines you might want to tweak

| Line                                                                         | Where               |
|------------------------------------------------------------------------------|---------------------|
| "Train like the pros track."                                                 | Hero H1             |
| "You don't get better by playing. You get better by tracking what works."    | Hook quote          |
| "Point your phone at the rim. We do the rest."                               | Feature 1 H3        |
| "A coach who watched every shot you've ever taken."                          | Feature 2 H3        |
| "Eighty-one drills. One model. Zero excuses."                                | Feature 3 H3        |
| "Not screen time. Shots taken."                                              | Feature 4 H3        |
| "Camera. Court. Code. That's the stack."                                     | CTA sub             |
| "START / TRACKING"                                                           | CTA headline        |
| "Built for the guy who treats his shooting log like an investor reads a P&L" | Feature 4 body      |
| "Skip the line. Train first."                                                | Waitlist modal H3   |

The voice is intentionally a little cocky / data-confident. If you
want it dialed back, soften the "Now." and "Zero excuses." lines
first — they're the most aggressive.

---

## Accent color variations

If you ever want to A/B a different accent, swap **only** the
`--accent` variable in `:root`. The page uses `var(--accent)`
exclusively — no hard-coded oranges except in the inline SVG nav
logo (which is also straightforward to update).

Suggested alternatives:
- `--accent: #ff5a1f;` (slightly brighter / Hermès vibe)
- `--accent: #f5a623;` (CourtIQ amber — softer, matches app)
- `--accent: #00f5d4;` (electric mint — only if going retro-future)

---

## Tech stack notes

- **Three.js r128** — vanilla, not React Three Fiber. Loaded from
  cdnjs. UMD build, exposes `THREE` as a global.
- **GSAP 3.12.5 + ScrollTrigger** — drives the basketball roll and
  the sticky chapter switching.
- **Lenis 1.1.13** — smooth scroll. Wired into GSAP's ticker and
  ScrollTrigger.update so they share a clock.
- **Google Fonts** — Barlow Condensed, Lexend, JetBrains Mono
  (preconnect headers included).

All four are CDN-loaded. No `npm install`, no bundler, no build step
at all. Open `index.html` directly or serve the folder with any
static server.

## Accessibility / motion

- `prefers-reduced-motion: reduce` disables: Lenis, the basketball
  scroll-roll (ball stays centered), the marquee animation, the
  magnetic buttons, the entrance reveals, and the scroll-cue line
  pulse.
- Touch devices skip the magnetic buttons (`hover: none` query).
- Hero text uses semantic `<h1>`. Section captions use semantic
  headings.
- Color contrast: cream on dark = WCAG AA at all body sizes.
- Selection color: orange-on-dark (custom `::selection`).
- Modal: `role="dialog"`, `aria-modal="true"`, focus trap, ESC closes.

## Mobile

Tested layout breakpoints:
- **Desktop** (> 900px): 30/70 hero grid, sticky 2-col features.
- **Tablet** (≤ 900px): 1-col hero, 1-col stacked features (phones
  hidden to avoid awkward column collapses), stat columns become
  rows.
- **Phone** (≤ 480px): scroll cue hidden, COURTIQ bg-text scales to
  56vw, nav caption hidden.

The Three.js basketball renders on all screens — performance will
dip on very low-end phones; the scroll-roll is lightweight (one
sphere, four lights, scrub: 0.6) so it should hold 60fps on
anything iPhone 11+ / equivalent Android.

---

## Local development

```bash
# Easiest — just double-click landing/index.html (no server needed).

# Or, if you want a local server for testing relative paths:
cd landing
npx serve .                 # any static server works
# or:
python3 -m http.server 8000
```

The page is fully self-contained — no API calls, no app imports,
no shared state with the CourtIQ app codebase.

## Production

See [DEPLOY.md](DEPLOY.md) for one-command deploys to Netlify,
Vercel, Cloudflare Pages, or GitHub Pages. The whole `landing/`
folder is the deploy artifact.
