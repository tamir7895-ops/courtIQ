# Deploying the CourtIQ landing

The landing page is a single self-contained HTML file plus a few
images and a basketball texture. There's no build step, no
dependency on the CourtIQ app — any static host works. Pick
whichever option below fits your workflow.

The shippable folder is **`landing/`**. Upload its contents to any
static host. Done.

---

## Option A — Netlify (drag-and-drop, 30 seconds)

1. Visit [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the `landing/` folder onto the dropzone.
3. Done. You'll get a `https://*.netlify.app` URL immediately.

To map a custom domain (e.g. `courtiq.app`):
- Site settings → Domain management → Add custom domain
- Update your DNS A record / CNAME at your registrar

To enable continuous deploy from git:

```bash
cd landing
npm i -g netlify-cli
netlify init
# pick: "Create & configure a new site"
# build command: (leave empty — no build step)
# publish directory: . (current dir)
```

A ready-made `netlify.toml` is included in this folder.

---

## Option B — Vercel

```bash
npm i -g vercel
cd landing
vercel
# follow prompts; pick "deploy" with default settings
```

For continuous deploy from git, run from project root:

```bash
vercel link
vercel --prod
```

A ready-made `vercel.json` is included in this folder.

---

## Option C — Cloudflare Pages

```bash
# install once
npm i -g wrangler

# deploy
cd landing
wrangler pages deploy . --project-name=courtiq-landing
```

Or via UI: dash.cloudflare.com → Pages → Create a project → Direct
upload → upload `landing/` folder.

---

## Option D — GitHub Pages (standalone repo)

Easiest path: create a new repo just for the landing.

```bash
cd landing
git init -b main
git add .
git commit -m "Initial CourtIQ landing"
gh repo create courtiq-landing --public --source=. --push
# In repo settings → Pages → deploy from branch: main, folder: /
```

URL: `https://<your-username>.github.io/courtiq-landing/`

If you'd rather host it under the existing CourtIQ repo without
touching the app's existing GitHub Pages setup, push the
`landing/` folder on a separate `gh-pages` branch:

```bash
git subtree push --prefix landing origin gh-pages
```

Then GitHub Pages settings → "Source: gh-pages branch, root".

---

## Option E — Anywhere (FTP, S3, your own server)

The folder is fully static. Upload `landing/` (or its contents) to
any HTTP server. The only constraint:

- The server must be able to send `image/svg+xml` for `.svg` files
  (default for Apache, Nginx, and every modern static host).
- The basketball texture is loaded via relative path
  `textures/basketball.jpg`, so keep the folder structure intact.

---

## Pre-flight checklist before going live

- [ ] **Verify CDN scripts load** over HTTPS. The page references
      `cdnjs.cloudflare.com` and `unpkg.com`. Both are HTTPS by
      default.
- [ ] **Replace the waitlist mailto** with a real form endpoint
      (Tally / Resend / Supabase / your CourtIQ API). Search for
      `// Persist to localStorage` in `index.html`.
- [ ] **Update OG image / share preview** if you want a custom card
      when the URL is shared on Twitter / iMessage / Slack.
      Currently the page has `og:title` and `og:description` but
      no `og:image`. Add one with:
      ```html
      <meta property="og:image" content="https://courtiq.app/og.jpg" />
      ```
- [ ] **Replace the iOS CTA** with a real TestFlight / App Store URL
      when ready. Currently both iOS CTAs (`data-action="waitlist"`)
      open the waitlist modal.
- [ ] **Set up Plausible / Fathom / GA4** if you want analytics.
      The page has no tracking by default — by design.
- [ ] **Test on real devices.** The page is mobile-responsive but
      Three.js can occasionally surprise you on low-end Android.
      Quick test: load the page on the cheapest Android you can
      find and confirm the basketball still rolls smoothly.

---

## Cost estimate

| Host                  | Free tier limit                     | Cost beyond free        |
|-----------------------|-------------------------------------|-------------------------|
| Netlify               | 100 GB bandwidth/mo                 | $19/mo (Pro)            |
| Vercel                | 100 GB bandwidth/mo                 | $20/mo (Pro)            |
| Cloudflare Pages      | Unlimited bandwidth, 500 builds/mo  | Free                    |
| GitHub Pages          | 100 GB bandwidth/mo, 1 GB site size | Free                    |

For a marketing landing, **Cloudflare Pages** is the clear winner
on cost. For "best DX with custom domain + edge functions",
**Vercel** is the easiest. For "zero-friction drag-and-drop",
**Netlify**.

---

## Troubleshooting

**"The basketball isn't visible"**
The Three.js scene loads asynchronously. If you see a blank hero,
open DevTools → Network and check that:
1. `cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` returns 200
2. `textures/basketball.jpg` returns 200 (or is missing — the
   procedural fallback will kick in either way)

**"The marquee text is jumpy on mobile"**
That's `prefers-reduced-motion` kicking in. The animation pauses
intentionally if the OS-level setting is on. To override (not
recommended), remove the media query in the `@media
(prefers-reduced-motion: reduce)` block.

**"The phone mockups look pixelated when I zoom in"**
SVGs scale infinitely without loss. If they look pixelated, your
browser is rasterizing them at low resolution. Try Cmd+0 to reset
zoom, then zoom in again.
