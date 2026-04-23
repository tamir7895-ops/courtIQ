# Production State Report

**Generated:** 2026-04-19
**Scope:** Verify the "CI frozen" and "391-line gap" claims from BUILD_PIPELINE_REPORT.md.
**No files modified except this report.**

---

## ⚠️ Retraction: the "CI frozen" finding in the previous report was wrong

BUILD_PIPELINE_REPORT.md concluded that deploy-pages CI had been broken since Apr 5 and that production was frozen 13 days behind master. **That was wrong.** The conclusion was based on stale local git refs — my `origin/gh-pages` pointer hadn't been refreshed in ~13 days, so `git log origin/gh-pages` showed Apr 5 as the last commit. After `git fetch`, the correct picture appears below.

I should have run `git fetch` at the start of the pipeline audit. Flagging for my own process: before making any claim about remote state, fetch first.

---

## 1. CI failure analysis — why deploy-pages hasn't run

**It has run. 20 successful runs in the last 14 days.** CI is healthy.

`gh run list --workflow=deploy-pages.yml --limit 20`:

| Commit | Date (UTC) | Duration | Status |
|---|---|---|---|
| `Merge branch 'claude/fix-shot-tracker'` | **2026-04-18 12:18** | 22s | ✅ success |
| `Merge branch 'claude/fix-shot-tracker'` | 2026-04-10 10:06 | 27s | ✅ success |
| `Merge branch 'claude/fix-shot-tracker'` | 2026-04-09 09:30 | 22s | ✅ success |
| ...17 more successful runs, oldest 2026-04-05 13:14 | | | |

Every row = `completed success`. Zero failures, zero cancellations.

Fresh `origin/gh-pages` after fetch:
- Last commit: `019a961 Deploy from master (a8f5cefdb8b14e7c0d6aaf0217ac76001a06a19c)` **2026-04-18 12:18:54 UTC**
- `gh-pages/dashboard.html`: 3,028 lines (not 3,419 as previously reported)
- `gh-pages/index.html` is byte-identical to `gh-pages/dashboard.html` (workflow works as designed)

**No path filters** in deploy-pages.yml, no skip conditions, no silent failures. The hypothesis in the audit request was testable and is **falsified**.

## 2. Live auth design — which branch matches production

**Production = www/ version. Redirect-based auth, no welcome-screen, no guest-mode.**

| Location | Lines | Matches production? |
|---|---:|---|
| `origin/gh-pages:js/auth.js` | 198 | (baseline — production) |
| `www/js/auth.js` | 198 | **✅ content-identical** (modulo CRLF) |
| `js/auth.js` (root) | 309 | ❌ 111 extra lines of welcome-screen + guest-mode logic |

Same pattern for `js/dashboard.js`:
| Location | Lines | Matches production? |
|---|---:|---|
| `origin/gh-pages:js/dashboard.js` | 2,018 | (baseline) |
| `www/js/dashboard.js` | 2,018 | **✅ content-identical** |
| `js/dashboard.js` (root) | 1,468 | ❌ 550-line delta (root has a different, shorter version) |

First 40 lines of PRODUCTION `js/auth.js`:

```js
  /* ══════════════════════════════════════════════════════════════
     AUTH MODAL — Real Supabase Auth
  ══════════════════════════════════════════════════════════════ */
  function openAuth(mode, plan) {
    const overlay = document.getElementById('authOverlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAuthTab(mode || 'signup');

    // Pre-select plan context in submit button
    if (plan && mode === 'signup') {
      const planLabels = { starter: 'Start Free Trial', pro: 'Start Pro Free Trial →', elite: 'Go Elite' };
      const btn = document.getElementById('su-submit');
      if (btn) btn.textContent = planLabels[plan] || 'Create Account →';
    }

    // Set focus
    setTimeout(() => {
      const firstInput = overlay.querySelector('.auth-form-pane.active .auth-input');
      if (firstInput) firstInput.focus();
    }, 350);
  }

  function closeAuth() {
    document.getElementById('authOverlay').classList.remove('active');
    document.body.style.overflow = '';
    ...
  }
```

No mention of `showWelcomeScreen`, `hideWelcomeScreen`, or `courtiq-guest-mode`. Those root-only functions are **not in production**.

**Resolution for WWW_DRIFT_REPORT Q1 (auth flow):** production is the redirect flow. Root's welcome-screen + guest-mode version appears to be either an abandoned branch experiment or pending unshipped work. User judgment: do you want to promote it to production, or accept root as drift and let www/ win the merge?

## 3. The 391-line gap — what production has that we don't

**The gap was a phantom.** After fetch:

| Location | `dashboard.html` lines |
|---|---:|
| `origin/gh-pages:dashboard.html` | **3,028** |
| `www/dashboard.html` (local, post-Phase-1 edits) | **3,031** |

**Local is 3 lines AHEAD of production, not 391 behind.**

### Full diff (after CRLF normalization)

`diff --strip-trailing-cr -U0 /tmp/live-dash.html www/dashboard.html`:

```diff
@@ -31,0 +32,2 @@
+  <link rel="stylesheet" href="features/shot-tracking/v2/shot-tracker-v2-type.css?v=1" />
+  <link rel="stylesheet" href="features/shot-tracking/v2/shot-tracker-v2.css?v=1" />

@@ -47 +49 @@
-  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js" crossorigin="anonymous"></script>
+  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js" integrity="sha384-nBSomYN4UWX4we7Pw5GsQDkjtwLh2Wde+3szWl5Lzf0zuN9XncHIZLNoucos4C7f" crossorigin="anonymous"></script>

@@ -2795,0 +2798 @@
+<script src="features/shot-tracking/v2/config.js" defer></script>
```

Three hunks, accounted for end to end:

| Hunk | Description | Source |
|---|---|---|
| 1 | 2 new `<link>` tags for Shot Tracker v2 CSS | My Phase 1 edit |
| 2 | Supabase-js `<script>` gains an SRI `integrity="sha384-…"` attribute | **Pre-existing local change — NOT from me.** Someone added the integrity hash to `www/dashboard.html` before this session. It's strictly safer than production (browser rejects modified script). |
| 3 | 1 new `<script>` tag for `v2/config.js` | My Phase 1 edit |

**Categorization:** All three hunks are ADDITIONS. No removals. No "391 lines production has that we lost" — that was an artifact of diff not normalizing CRLF on a stale ref.

## 4. Recommended next step (one sentence)

**Revisit WWW_DRIFT_REPORT's 5 blocker questions now that production is known healthy, production = www/ for auth and dashboard, and the only pending divergence is Phase 1 + one SRI-hash addition — none of which are destructive and all of which can be ratified with a normal merge-to-master once you decide on the architectural cleanup.**

No files changed. CI is not frozen. No urgent repair work needed — the architectural cleanup conversation is back to being the actual blocker, not an emergency CI rescue.
