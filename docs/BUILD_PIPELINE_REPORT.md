# Build Pipeline Report

**Generated:** 2026-04-19
**Scope:** Understand `build.js`, CI workflows, and gh-pages deploy to narrow the 5 blocker questions in `WWW_DRIFT_REPORT.md`.
**No files modified except this report.**
**Backup branch:** `backup/pre-www-cleanup` created at current `claude/fix-shot-tracker` HEAD. Uncommitted Phase 1 edits (root `index.html`, `www/dashboard.html`) are **not** captured by that branch — they live in the working tree. If you want those protected too, run `git stash` or commit them before any destructive ops.

---

## a. What `build.js` does (plain English)

46 lines. It's a **file copier**, not a real bundler.

1. `SRC = project root`, `DEST = ./www/`.
2. Walks a hard-coded list of paths and copies each from root → `www/`, recursively.
3. Creates `www/` if missing but **never wipes it**. There's an explicit comment: `"do NOT wipe it — dashboard.html and other www-only files must survive"`.
4. Prints `✓ Copied <target>` per item, then `✅ Build complete → www/`.

### What gets copied (the hardcoded `COPY_TARGETS` list)

```
index.html        ← root's auth entry page
shared.css
manifest.json
sw.js
js/               ← entire folder (includes dashboard.js, auth.js, everything)
styles/           ← entire folder
assets/           ← favicon, logos, images
icons/            ← app icons
```

### What is NOT copied (critical)

- **`features/`** — the entire shot-tracking engine (`ShotTrackingScreen.js`, `shotDetection.js`, `shotService.js`, `sortTracker.js`, `utils/*`, `yoloxWorker.js`, `v2/*`) **never flows root → www/ via build.js**.
- **`models/`** — ONNX models never copied.
- **`brand-fonts/`** — font files never copied.
- **`capacitor.config.json`** (expected — shouldn't be in www/).
- **`dashboard.html`** — not in the list because it lives only at `www/dashboard.html` and has no root counterpart.

## b. Input source of truth

Root is the declared source **for the 8 paths in `COPY_TARGETS` only**. Everything else (`features/`, `models/`, `dashboard.html`, `lab-panel.js`, `training-panel.js`, kinetic/glassmorphism CSS, etc.) is **www-primary** — it lives only under `www/`, and edits to www/ there are the canonical source.

This is the structural split that caused the drift in `WWW_DRIFT_REPORT.md`:
- Root → www/ sync works for `js/`, `styles/`, etc. (when build runs)
- www/-primary files are never synced anywhere. Edits happen directly in www/.

## c. Output destinations

Build.js output: **`www/`** folder locally.

Then the CI deploy workflow (`deploy-pages.yml`) takes **`www/`** on master → **`gh-pages`** branch on every push to master. Specifically:

```yaml
on: push: branches: [master]
- Prepare www/ for deploy:
    cp sw.js www/sw.js                                    # fresh SW from root
    sed -i "s/const CACHE_VERSION = .../$COMMIT_HASH/"    # auto cache-bust
    cp www/dashboard.html www/index.html                  # root URL serves the dashboard
- Deploy www/ → gh-pages, clean: true
```

**The CI does NOT run `node build.js`.** So root → www/ sync is *not* CI-driven. If you want a root change to reach production, you must either:
- Run `npm run build` locally (populates www/), commit, push master → CI deploys www/.
- OR edit `www/` directly — which currently works and is apparently common practice here.

### gh-pages content source

`gh-pages/dashboard.html` = whatever `www/dashboard.html` looked like at the time of the last deploy. No hand-editing. `clean: true` means the whole www/ folder overwrites gh-pages.

gh-pages/index.html is **identical** to gh-pages/dashboard.html (confirmed via diff). The CI step `cp www/dashboard.html www/index.html` is what makes the root URL of the Pages site show the dashboard.

## d. Triggers

| Trigger | What runs | What it does |
|---|---|---|
| `npm run build` (manual) | `node build.js` | root → www/ for the 8 copy targets |
| `npm run sync` (manual) | `node build.js && npx cap sync android` | Same as build, then Capacitor Android sync |
| Push to `claude/**`, `tracking-**`, `feature/**`, `fix/**` | `auto-merge.yml` | Auto-merge to master with `[skip ci]` in the merge message. **Note:** the `[skip ci]` flag on the merge means the SUBSEQUENT master push should NOT re-trigger auto-merge recursively, but I am not 100% sure whether `deploy-pages.yml` also skips. Flagging for verification. |
| Push to `master` | `deploy-pages.yml` | Prep www/ (sw.js refresh, cache-bust, index.html = dashboard.html), deploy www/ → gh-pages |

Nothing runs `build.js` automatically. That's the single biggest pipeline surprise.

## e. Is gh-pages/dashboard.html generated or hand-edited?

**Generated.** Auto-deployed from www/dashboard.html on push to master. `clean: true` wipes and replaces. No hand-editing (nothing in the workflow modifies dashboard.html content other than the `cp dashboard.html index.html` step).

However — there's a staleness surprise:

| Location | `dashboard.html` lines |
|---|---:|
| `claude/fix-shot-tracker` (current branch) | 3,028 |
| `master` | 3,028 |
| `origin/master` | 3,028 |
| **`gh-pages`** | **3,419** ← ~391 lines larger than every source branch |

**Last master commit:** 2026-04-18
**Last gh-pages deploy:** 2026-04-05 (from commit `43b3688`)

Two weeks have passed between the last deploy and the last master commit. There should have been a deploy during that gap (deploy-pages.yml fires on every master push). Either:
- The workflow has been failing silently since Apr 5 (check the Actions tab)
- OR pushes to master have been landing without triggering deploys (e.g. `[skip ci]` tokens)
- OR the 391-line delta is in files the workflow post-processes (unlikely — diff of the top of each shows identical CSP + opening markup, so the delta is elsewhere in the file)

**Production (gh-pages) has 391 lines of `dashboard.html` that are NOT in any local branch.** Someone trimmed the file in April and the trim has never reached production. Whether that trim was intentional (dead code removal) or accidental (feature loss) is something you need to investigate before pushing master — any push will overwrite the live 3,419-line file with the 3,028-line version.

## f. Best-guess production picture

| Question | Best guess |
|---|---|
| Which directory serves the live Pages site? | **gh-pages branch, auto-generated from www/**. Root is irrelevant to production — it's either a source for build.js copies, or uninvolved. |
| Root or www/ — canonical? | **Split.** For `js/`, `styles/`, `assets/`, `icons/`, `index.html`, `shared.css`, `manifest.json`, `sw.js`: **root should be canonical**, but in practice people have been editing both. For `dashboard.html`, `features/*`, `models/*`, `lab-panel.js`, `training-panel.js`, kinetic/glass/lab/training CSS: **www/ is the only source** — root has never held them. |
| User editing deployed app, or a stale copy? | **Both, inconsistently.** When you edit `www/dashboard.html`, you ARE editing the deployed app (one push away from production). When you edit root `js/auth.js`, you are editing a stale copy — that edit only reaches production if you remember to run `npm run build` before pushing. **This is very likely the source of confusion and drift.** |

## g. Five blocker questions — what the pipeline tells us

### Q1. Auth flow — welcome-screen+guest-mode (root) vs redirect (www/)

- **What the pipeline tells us:** `js/auth.js` and `js/dashboard.js` ARE in `COPY_TARGETS` — so a `npm run build` would overwrite www/ versions with root versions. If the user last ran `npm run build` recently, www/js/auth.js should match root/js/auth.js. They don't (www is older mtime, ~111 lines shorter). **Conclusion: `npm run build` has not run since the root auth.js was last improved.**
- **But the CI never runs build.js**, so any git history showing pushes-to-master doesn't tell us which auth flow reached gh-pages. Only a manual `npm run build` before push would have.
- Checking gh-pages: `git show origin/gh-pages:js/auth.js | wc -l` would reveal which flow is actually LIVE. I didn't run that — doing so is a simple next step.
- **Answered by build.js:** nothing definitive — build.js treats auth.js as "root canonical" but has not been run in long enough that www/ and root have diverged.
- **Still needs user judgment:** Do you remember which auth flow was intentional? If gh-pages has the "redirect" version and you haven't knowingly changed that recently, then the www/ version represents production. If gh-pages has "welcome-screen + guest-mode", root is ahead of production and a build + push would promote it.

### Q2. `dashboard.html` — promote to root?

- **What the pipeline tells us:** `dashboard.html` is www-primary by design. `build.js` never copies it from root (it's not in COPY_TARGETS, and root has no dashboard.html to copy). The deploy workflow reads from `www/dashboard.html`.
- **Answered by build.js:** dashboard.html IS built to be a www/ file. For "root = single source of truth" to hold, you must:
  1. Create `root/dashboard.html` (move or copy from www/).
  2. Add `'dashboard.html'` to the `COPY_TARGETS` array in build.js.
  3. Optionally: add a guard that requires `npm run build` before deploy (or call it from the workflow).
- **Still needs user judgment:** only whether to promote dashboard.html now (this cleanup) or later (after Phase 2 of shot-tracker). The mechanics are clear.

### Q3. Lab / Training / Kinetic / Glassmorphism — production?

- **What the pipeline tells us:** `www/dashboard.html` references `lab-panel.js`, `training-panel.js`, `lab.css`, `training.css`, `kinetic-*.css`, `glassmorphism.css` 12 times. Those files exist in www/. gh-pages is generated from www/. Therefore **yes, they are in production on gh-pages** (they were deployed on the last successful deploy and nothing has removed them).
- **Answered by build.js / workflow:** these files ARE live. Must be preserved.
- **Still needs user judgment:** do you want them promoted to root paths (so build.js copies them to www/ on every build, making root canonical), or kept as www-primary (leaving the structural split in place)? The former enables the "root = source of truth" goal. The latter is less work but keeps the messy duality.

### Q4. `basketball_yolox_tiny_v6.onnx.data` (20 MB) — used?

- **What the pipeline tells us:** `models/` is NOT in COPY_TARGETS. The file lives only in `www/models/`. It was deployed to gh-pages on Apr 5 (the last deploy). Any code path that loads `basketball_yolox_tiny_v6.onnx` as an ONNX variable will need this companion file.
- **Answered by pipeline:** it IS in production. Whether it's actually loaded by the running app depends on whether the app loads the v6 `.onnx` (and thus implicitly loads `.onnx.data`). `shotDetection.js:557` loads `models/basketball_yolox_tiny_v6.onnx?v=6`, so YES the sibling `.onnx.data` is required.
- **Still needs user judgment:** promote `models/*` to the build pipeline (add to `COPY_TARGETS`) so it becomes root-sourced? Or keep as www-only? Same architectural question as Q3.

### Q5. gh-pages — auto-built or hand-maintained?

- **Answered by workflow:** **auto-built**, `clean: true`, sourced from `www/` at each master push. No hand-editing.
- **What the pipeline does NOT tell us:** why gh-pages/dashboard.html is 391 lines larger than every local branch. Hypothesis: a push to master after the Apr 5 deploy failed silently (CI break), so gh-pages is frozen at Apr 5's www/dashboard.html while local has continued to shrink. Verification steps:
  - Check the Actions tab on GitHub for failed workflow runs.
  - `git log origin/gh-pages --oneline -20` — if there are no deploys for 2 weeks despite master commits, CI is broken.
  - `git show origin/gh-pages:dashboard.html > /tmp/live.html; diff local-www.html /tmp/live.html` — shows the 391 lines that would be overwritten on next deploy.

## Summary decision matrix

| Blocker | Pipeline answers | Still needs user input |
|---|---|---|
| Q1 Auth flow | No — build.js has not run recently, both sides drifted | Which is the real current design? Check gh-pages if unsure. |
| Q2 dashboard.html | Yes — it must remain deployed from www/; promotion to root is optional arch cleanup | Promote now or later? |
| Q3 Lab/Kinetic/etc | Yes — all live in production | Promote to root paths (aligns with "root = SSOT") or keep www-only? |
| Q4 v6.onnx.data | Yes — required in production | Promote `models/` to build pipeline or keep www-only? |
| Q5 gh-pages source | Yes — auto-built from www/ | Investigate 391-line staleness vs CI health before next deploy. |

## Recommended next step

Before touching anything else: **check why gh-pages is frozen at Apr 5.** Either the deploy CI is broken (must fix before any push to master or we lose whatever improvements have happened since Apr 5) or someone disabled auto-deploy. This is a more urgent issue than the www/root cleanup.

Second: `git show origin/gh-pages:js/auth.js | wc -l` and eyeball its first 20 lines — that answers Q1 definitively (which auth flow is live).

Only then do the architectural promotion questions (Q2–Q4) become productive to answer.

No files changed beyond this report. Backup branch ready.
