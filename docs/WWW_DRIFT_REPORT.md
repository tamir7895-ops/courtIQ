# WWW / Root Drift Audit — Commit 1 Safety Report

**Generated:** 2026-04-19
**Branch:** `claude/fix-shot-tracker`
**Purpose:** Before deleting `www/` (per target-state plan), verify every feature and every design improvement survives in root at its latest version.
**No files modified except this report.**

---

## 🚨 Stop-the-presses finding

**This is not a simple stale-mirror situation. `www/` and root each contain features the other is missing.** A naive "delete www/" or "copy www/ over root" would lose work in either direction. Before Commit 2 can proceed, we need a merge strategy conversation — not just approval of a file list.

### What I found
1. **Root has no `dashboard.html`.** It exists only in `www/` (and `origin/gh-pages` at 3,419 lines). Root's `index.html` is an auth entry page; the actual app surface lives only in `www/dashboard.html`.
2. **`www/` has 10 files that live nowhere else in the working tree** — including 3 feature panels (Lab, Training), 3 design systems (kinetic-elite, kinetic-stitch, glassmorphism), and the companion data file for the YOLOX v6 model. Several of these *are* tracked in git but under `www/` paths, never root paths.
3. **For 3 big files (`dashboard.js`, `components.css`, `drill-engine.js`), www has genuinely newer feature code that root lacks, while root has OTHER newer code that www lacks.** Not a one-way overwrite — they've diverged in both directions.
4. **For 25+ files, www is newer by mtime but OLDER by content.** www's "Apr 5" mtime appears to be a bulk copy operation, not real edits. Root has accumulated real work on top of the snapshot www was taken from.
5. **Git branch structure matters:** we're on `claude/fix-shot-tracker`. `master` was last updated by merging this branch. Several files referenced by `www/dashboard.html` (like `js/lab-panel.js`) live in git **only under `www/` paths** and were never committed as root paths.

---

## Summary counts

| Bucket | Count |
|---|---|
| Identical files | **29** |
| Root newer, content-confirmed — safe to discard www copy | **5** |
| ⚠️ www newer by mtime AND by content — **merge required** | **3** |
| ⚠️ www newer by mtime but root has more/different content — **compare required** | **41** |
| ⚠️ Exists only in www/ — **must preserve before deletion** | **10** |
| Files only in root (unique root features) | **50** (web-relevant) |

---

## 🚨 SECTION A — www newer AND content confirms genuine extra work

These files have www versions with real, substantial additions that are **not in root**. These are the files where a careless delete would lose work.

### A1. `www/js/dashboard.js` — [Feature JS] [HIGH STAKES]
- **mtime:** root = 2026-03-19, www = 2026-04-05 18:28 → **www newer**
- **Lines:** root = 1,468, www = 2,018 → **www has 550 more lines**
- **Diff delta:** +847 / −359 (so 488 lines of net addition in www)
- **Signals agreement:** ⚠️ **Conflict.** mtime says www; content says www has +550 net lines; git log says root's last commit was `660c677 feat: redesign nav bar icons with rounded containers` (recent). **Both sides have unique code.**
- **What's actually different** (first diff hunk):
  ```
  - "AUTH GUARD — show welcome screen if not logged in"   (root)
  + "AUTH GUARD — redirect if not logged in"              (www)
  - showWelcomeScreen() / hideWelcomeScreen() functions   (root only)
  - Guest mode block with localStorage.getItem('courtiq-guest-mode')   (root only)
  + const { data: { session } } = await sb.auth.getSession()  (www only)
  ```
  Root has a **welcome-screen + guest-mode** flow. www has a **redirect-based auth** flow. These are two different design decisions, not one overwriting the other.
- **Recommended action:** **FLAG — user must decide which auth flow is the real current one.** Once decided, selectively merge any NON-auth features from the loser's version into the winner. Do not bulk-copy.

### A2. `www/styles/components.css` — [CSS] [Design system]
- **mtime:** root = 2026-03-19, www = 2026-04-05 → **www newer**
- **Lines:** root = 841, www = 1,196 → **www has 355 more lines**
- **Diff delta:** +423 / −79
- **Signals agreement:** ⚠️ **Conflict.** Root has `.btn-sm`, `.btn-md`, `.btn-lg` button-size system (added in `660c677 redesign nav bar icons`) — **not present in www**. www has 355 other lines root doesn't.
- **Recommended action:** **FLAG — cherry-pick additions both ways.** Likely needs a 3-way merge: base = last common ancestor, ours = root (has button-size system), theirs = www (has whatever 355 extra lines provide). Inspect www's extra lines manually before merging.

### A3. `www/js/drill-engine.js` — [Feature JS] [Drills feature]
- **mtime:** root = 2026-03-19, www = 2026-04-05 16:39 → **www newer**
- **Lines:** root = 4,028, www = 4,257 → **www has 229 more lines**
- **Diff delta:** +227 / −25
- **Signals agreement:** ⚠️ **Conflict.** Root has **`drill-timer-btn`** with WorkoutTimer integration (root only — removed in www). www has **"Group drills by focus area" with category ordering** (Shooting, Ball Handling, Defense, etc — www only).
- **Recommended action:** **FLAG — both sides have real features.** Merge needed: keep root's Timer button + adopt www's category grouping. This is a ~50-line manual merge, not a copy.

---

## 🚨 SECTION B — www newer by mtime, content unclear — each needs a 30-second eyeball

For these, the content delta is small-to-moderate. Most are probably stale www versions from the Apr 5 bulk-copy event with a couple of real changes mixed in. Each needs a spot-check before deciding.

Listed by descending www-side addition size. For each: category tag, net line delta (www − root), and a verdict hint based on the git log of root's last commit.

| Rel path | Category | Net (www−root) | Root last commit (abbr) | Verdict hint |
|---|---|---:|---|---|
| `js/social-hub.js` | Feature | +62 | `a819b41 Auto-sync js/gamification.js.tmp…` | www likely has content root lost |
| `js/ai-coach.js` | Feature | +59 | `660c677 redesign nav bar` | ⚠️ conflict — root's nav redesign + www's +59 |
| `js/shot-tracker.js` (dashboard widget, NOT features/shot-tracking) | Feature | +54 | `660c677 redesign nav bar` | ⚠️ conflict |
| `js/night-training.js` | Feature | +46 | `fa3d701 feat: add Night Training mode` | ⚠️ root has the Night-Training feature commit; www has +46 on top |
| `js/player-profile.js` | Feature | +32 | `660c677 redesign nav bar` | ⚠️ conflict |
| `js/move-library.js` | Feature | +21 | `06aa65d Add Shot Tracker, Progress Charts, Pro Moves Library` | www probably newer here |
| `js/avatar-shop.js` | Feature | +12 | `cf77a2c Auto-sync js/avatar-shop.js.tmp…` | auto-sync naming → www copy likely canonical |
| `js/feature-modals.js` | Feature | +2 | `966fbab Fix unclosed /* comments` | likely trivial |
| `js/pricing.js` | Feature | +2 | `e425b77 Fix JS errors…` | likely trivial |
| `js/sidebar.js` | Feature | +1 | `966fbab Fix unclosed /* comments` | trivial |
| `js/nav.js` | Feature | 0 | `93c4d22 Fix critical bugs: nav.js crash` | 0-net — possibly whitespace only |
| `styles/challenge.css` | CSS | −1 | `1e7be3e Comprehensive visual upgrade` | trivial |

**Recommended action for B-bucket:** diff each one. For anything ≤ 5 net lines, assume root is canonical and delete www copy. For everything above, eyeball the diff before deciding. ~10 minutes of actual human judgment.

---

## ⚠️ SECTION C — www newer by mtime, but ROOT has more/better content (signals disagree)

For these, mtime says "www newer" but line count and diff content say **root has accumulated more real code**. Almost all are Apr 5 www copies made BEFORE root's subsequent improvements. Flag: **trust content over mtime**.

The most dramatic examples (www has less code despite newer mtime):

| Rel path | root lines | www lines | www minus root | Interpretation |
|---|---:|---:|---:|---|
| `index.html` | 3,087 | 22 | **−3,065** | www/index.html is a 22-line auth-redirect stub; root is the full page. No action — www-copy is not the canonical index |
| `features/shot-tracking/adaptiveLearning.js` | 973 | 1 | −972 | www has 1-line stub; root has the real 973-line adaptive-learning engine |
| `features/shot-tracking/ShotTrackingScreen.js` | 1,448 | 656 | −792 | Root has the full modern screen incl. hoop auto-lock, rim calibration, summary; www has an older 656-line version |
| `models/basketball_yolox_tiny.onnx` | 67,608 | 67,184 | −424 | Both present, root slightly larger — root is the current v5/v6 model |
| `styles/shot-tracker.css` | 673 | 369 | −304 | Root has 304 more lines of styling |
| `styles/daily-workout.css` | 501 | 201 | −300 | ditto |
| `features/shot-tracking/shotService.js` | 237 | 1 | −236 | www is 1-line stub |
| `styles/onboarding.css` | 974 | 837 | −137 | root has onboarding UX improvements |
| `styles/social.css` | 808 | 682 | −126 | root has social visual upgrade |
| `js/auth.js` | 309 | 198 | −111 | root has the auth redirect + welcome-screen logic |
| `styles/animations.css` | 814 | 708 | −106 | root has extra animations |
| `styles/main.css` | 3,961 | 3,857 | −104 | root has Kinetic Elite design system commit |
| `styles/shop.css` | 312 | 253 | −59 | root has shop upgrades |
| `styles/drills.css` | 2,578 | 2,530 | −48 | minor |
| `sw.js` | 186 | 146 | −40 | root has newer service worker |
| `features/shot-tracking/shotDetection.js` | 1,372 | 1,351 | −21 | root has v6 alignment commit (Apr 18) |
| ...plus ~25 more with root-larger content | | | | all likely safe to discard www copies |

**Recommended action for C-bucket:** After confirming with `diff -q`, these www copies are safe to delete. **But** since every one was bulk-copied from a common ancestor, we should snapshot `git stash` / create a backup branch before any deletion.

---

## 🚨 SECTION D — Files ONLY in www (10 files) — would be LOST by deletion

| Rel path | Size | Category | Is it in git? | What it is |
|---|---:|---|---|---|
| `www/dashboard.html` | 163 KB | HTML wiring | ✅ yes (tracked as `www/dashboard.html`) | **The main app page.** Root has no equivalent. gh-pages has a similar file (3,419 lines). |
| `www/js/lab-panel.js` | 7 KB | Feature JS | ✅ tracked under `www/` path | The Lab panel (`feat(lab): replace Stats panel with The Lab`) |
| `www/js/training-panel.js` | 24 KB | Feature JS | ✅ tracked under `www/` path | Training 4-section layout (`feat: Training page redesign`) |
| `www/styles/lab.css` | 5 KB | CSS | ✅ tracked under `www/` path | Lab panel styling |
| `www/styles/training.css` | 15 KB | CSS | ✅ tracked under `www/` path | Training panel styling |
| `www/styles/glassmorphism.css` | 57 KB | Design system | ✅ tracked under `www/` path | Shared glass design tokens |
| `www/styles/kinetic-elite.css` | 61 KB | Design system | ✅ tracked under `www/` path | Kinetic Elite redesign (`feat: Kinetic Elite design system — full 4-screen`) |
| `www/styles/kinetic-stitch.css` | 78 KB | Design system | ✅ tracked under `www/` path | Kinetic Stitch ks-* redesign (`redesign: training page uses kinetic-stitch ks-* design language`) |
| `www/models/basketball_yolox_tiny_v6.onnx.data` | **20 MB** | ML model | unknown — likely git-LFS or ignored | Companion data file for YOLOX v6 ONNX model. **Critical asset** |
| `www/UI_AUDIT_REPORT.md` | 7 KB | Doc | probably not tracked | Design audit report, user-authored |

**Recommended action for D-bucket:** These must ALL be preserved. They cannot be deleted. They need to be promoted to real root paths (without the `www/` prefix) AND `www/dashboard.html` must be reconciled — root is missing the entire dashboard page and that's a much bigger structural problem than I thought at the start of the audit.

---

## ✅ SECTION E — 29 identical files (safe to discard www copy once decision is made)

Full list (no action needed, just for record):

```
features/shot-tracking/ShotTrackingScreen.js   — wait, this differs. Moving to Section C.
```

Actually none of the listed 29 identical files contain anything interesting — they're a mix of `assets/`, `icons/`, small utility JS files, and mobile-safe stubs where both copies happen to match. Listed as bullet points below:

- all `assets/*` (favicon, logos, compressed images)
- all `icons/icon-*.png`
- `manifest.json`
- `shared.css`
- `js/animations.js`, `js/archetype-engine.js`, `js/avatar-builder.js`, `js/daily-challenge.js`, `js/daily-workout.js`, `js/drill-animations.js`, `js/gsap-animations.js`, `js/move-animations.js`, `js/orbit-controls-lite.js`, `js/shot-details-modal.js`, `js/sound-effects.js`, `js/user-profile.js`, `js/welcome.js`, (and a few more)
- Verified byte-identical via `cmp -s`.

---

## 📋 SECTION F — 50 files only in root (not in www) — NO action needed

Grouped by type:

**Infrastructure / build / dev (keep at root):**
- `.claude/launch.json`, `.claude/settings.json`, `.gitattributes`, `.gitignore`, `.github/workflows/auto-merge.yml`, `.github/workflows/deploy-pages.yml`, `.mcp.json`
- `README.md`, `capacitor.config.json`, `package.json`, `package-lock.json`, `build.js`, `generate-icons.js`, `serve.js`, `replace-lab.js`

**Root-only features (genuine unique code):**
- `features/shot-tracking/shot-tracking.css`
- `features/shot-tracking/sortTracker.js` ⭐ (new — SORT tracker)
- `features/shot-tracking/utils/heatmapGenerator.js` ⭐
- `features/shot-tracking/utils/trailRenderer.js` ⭐
- `features/shot-tracking/yoloxWorker.js` ⭐ (YOLOX preprocessing worker)
- `features/shot-tracking/v2/…` ⭐ (Phase 1 drop from today)
- `js/badges.js`, `js/court-heatmap.js`, `js/notifications.js`, `js/redesign-wiring.js`, `js/video-review.js`, `js/workout-timer.js`
- `styles/badges.css`, `styles/dashboard-redesign.css`, `styles/feature-heroes.css`

**Test / scratch (not load-bearing):**
- `test_basketball.mp4`, `test_video*.mp4`, `Download.mp4`
- `debug-shot-tracker.html`, `logo-concepts.html`, `logo-preview.html`
- `render-*.js` (3 logo-rendering scripts from earlier this session)
- `.superpowers/**` (brainstorm server artifacts)

⭐ = modern shot-tracker engine additions that **do not have a www equivalent**. If someone were to delete the root shot-tracking folder thinking www has it all, they'd lose these too. They're already safe (in root), just flagging.

---

## Recommendation

**I cannot give a clean "delete www/, nothing will be lost" recommendation.** The situation is worse than a one-direction drift — it's a bidirectional divergence with structural issues (no root/dashboard.html at all, lab/kinetic files living only under www/-path in git, conflicting auth flows in dashboard.js). Commit 2 as originally scoped **should not run** until these are resolved:

### Immediate questions for you (blockers for Commit 2)

1. **Auth flow — which is real?** Root's `welcome-screen + guest-mode` OR www's `redirect + sb.auth.getSession`? Pick one, the other's extras get cherry-picked.

2. **Dashboard location — where does it live?** Currently www-only. Should root get `dashboard.html` (promoted from www), and www become build-output-only? Or should the deploy pipeline continue generating www/dashboard.html from some other source?

3. **Lab / Training / Kinetic / Glassmorphism** — these live only under `www/` paths in git. Are they currently used in production (via `gh-pages`)? If yes, they need to be promoted to root paths (`js/lab-panel.js`, `styles/kinetic-stitch.css`, etc.). This is the **single biggest merge** — 6 design/feature files, all ~tens of KB.

4. **`models/basketball_yolox_tiny_v6.onnx.data`** — 20 MB companion file. Is it currently being loaded? If yes, it must move to `models/` at root. If the root `.onnx` file doesn't need it (v5 model), it can be retired.

5. **gh-pages branch** — has its own `dashboard.html` at 3,419 lines (bigger than www's). Is `gh-pages` auto-generated from a build step, or is it a hand-maintained deployed copy? `capacitor.config.json` says `webDir: "www"`, but `build.js` exists at root (I haven't read it yet — it might be the deploy script that populates www from elsewhere).

### Revised plan

**Before Commit 2:**
- Open `build.js`. Understand what generates `www/` and/or `gh-pages`. If there's a build step, the "source of truth" question may already have a machine answer.
- Go through questions 1–5 with me (the user). Each answer unblocks one part of the merge plan.
- Create a backup branch: `git checkout -b backup/pre-www-cleanup` so ANYTHING wiped is recoverable without reflog spelunking.

**Then** we can spec Commit 2 as a real merge/promote plan with a concrete file list, and Commit 3 as the www/ deletion.

### Confidence statement

I **cannot** currently make the statement "after the planned cleanup, every feature and design present in either root/ or www/ today will be present in root/ tomorrow at its latest version." The following would be lost or regressed without explicit merge action:

- www-only: Lab panel, Training panel, Kinetic Elite, Kinetic Stitch, Glassmorphism design system, lab.css, training.css, dashboard.html itself, the 20MB YOLOX v6 .onnx.data file
- www-plus-extra: dashboard.js (~550 unique lines of auth/other logic), components.css (~355 unique lines), drill-engine.js (~229 lines including drill category grouping)
- Direction-unclear: ~10 feature JS files with small to medium deltas

**Proceeding to Commit 2 without resolving the 5 blocker questions would cause data loss.** Pausing here for your decisions.
