# CourtIQ 🏀

**AI-Powered Basketball Training Platform**

CourtIQ delivers personalized basketball training programs powered by artificial intelligence. Improve your game with adaptive drills, real-time feedback, and position-specific coaching.

## Features

- 🤖 **AI-Generated Training Programs** — Personalized weekly schedules based on your position, skill level, and goals
- 📊 **Progress Tracking** — Monitor shooting accuracy, vertical jump, agility, and conditioning
- 🔄 **Adaptive AI Coaching** — Program evolves monthly based on your real performance data
- 🏀 **Position-Specific Coaching** — Distinct programs for all 5 positions (PG, SG, SF, PF, C)
- 📱 **Interactive Dashboard** — Log sessions, view analytics, and track your weekly calendar
- 🎬 **Video Drill Library** — HD video for every drill (Pro feature)
- 💬 **AI Coaching Chat** — Ask anything about your training

## Plans

| Feature | Starter | Pro | Elite |
|---------|---------|-----|-------|
| AI Weekly Program | ✓ | ✓ | ✓ |
| Drill Library | 50+ | 500+ | 500+ |
| Progress Tracking | Basic | Advanced | Advanced |
| Positions | 3 | 5 | 5 |
| AI Chat | — | 50 msgs | Unlimited |
| Coach Review | — | — | 2/month |
| Game Film Analysis | — | — | ✓ |
| Price | $9/mo | $24/mo | $59/mo |

## Tech Stack

- Pure HTML5 / CSS3 / Vanilla JavaScript
- Chart.js for analytics visualizations
- Barlow Condensed + Barlow (Google Fonts)
- Anthropic Claude API (AI Coach & Calendar features)

## Getting Started

There **is** a build step. The app lives in `app-v10/`, and everything is served
from the generated `www/` — so a file you just created 404s until you build.

```bash
npm install
node build.js        # root/ -> www/
node serve.js        # http://localhost:8080/app-v10/index.html
```

Never edit `www/` by hand: it is generated, not in git, and every build overwrites
it. Native builds go `node build.js` → `npx cap sync ios|android`; for iPhone use
`npm run ios:sync`, which also prunes the bundle.

No API key is needed to run it. The AI coach talks to a Supabase edge function
that holds the Anthropic key server-side — the client never sees one.

**Before changing anything, read [`docs/STATE-2026-08.md`](docs/STATE-2026-08.md)** —
it is the current picture of what loads, what ships, and what is deliberately
left open. [`docs/README.md`](docs/README.md) says which of the older documents
still tell the truth.

---

© 2026 CourtIQ, Inc.
