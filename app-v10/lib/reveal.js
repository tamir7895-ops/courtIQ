/* CourtIQ v11 — the post-session reveal + reward economy
   ------------------------------------------------------------------
   The bug this replaces: confetti fired for `made > 0`, at 420ms.

   Two things wrong with that. First the TIMING — 420ms is before the
   number has finished counting, so it celebrated a value the user hadn't
   read yet. Second, and worse, the THRESHOLD: one make in twenty triggered
   the identical celebration as a career day. A celebration that fires every
   time is not a reward, it's chrome, and users learn to look past it. That
   is what makes an app feel childish — not the confetti.

   ── THE ECONOMY ─────────────────────────────────────────────────
   Celebration magnitude is inversely proportional to event frequency, and
   exactly ONE tier fires per session. Never stack — stacking is how you get
   a five-screen post-lesson gauntlet.

     T0 SILENT      counter mode, or att < 10, or below your own median.
                    Stats render, nothing moves. A bad session gets respect,
                    not a consolation prize. Silence is a valid output.
     T1 ACKNOWLEDGE at/above your median. The number pops. That's all.
     T2 NOTABLE     a personal best, min 10 attempts. Pop + confetti.
     T3 RARE        a milestone. Handled by the caller.

   The 10-attempt floor is mandatory: without it a 1-for-1 session is a
   100% "personal best" and the whole economy collapses on day one. Same
   bug as one session reading ELITE, third time we've hit it.

   ── THE RULES ───────────────────────────────────────────────────
   · Every element ≤400ms. >400ms reads sluggish on mobile (Material).
     The ticker is the sole exception — it's the only thing carrying
     information rather than decoration.
   · Interactive from t=0. A tap completes everything instantly. The
     animation must never be a toll booth — the animation you love on
     session 1 is the one you rage-tap on session 20.
   · Reduced motion: no rises, no ticker, no confetti. Not optional.
   ============================================================ */
(function () {
  'use strict';

  var LS_BEST = 'courtiq_v11_bests';
  var MIN_ATT = 10;          // floor for any personal best
  var T_NUMBERS_LANDED = 880; // tickers settle — earliest honest celebration

  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function bests() {
    try { return JSON.parse(localStorage.getItem(LS_BEST) || '{}'); }
    catch (e) { return {}; }
  }

  /* Returns the tier for this session AND commits the new best. Compared
     against the player's OWN history — never an absolute — because a 45%
     shooter and a 70% shooter don't share a baseline. */
  function classify(pct, att, counter) {
    if (counter || att < MIN_ATT) return { tier: 0 };
    var b = bests();
    var prevBest = b.pct == null ? null : b.pct;
    var hist = b.hist || [];

    var isPB = prevBest == null || pct > prevBest;

    /* Cold start: the first sessions have no median to compare against.
       Ship T1 flat rather than inventing a baseline. */
    var median = null;
    if (hist.length >= 3) {
      var s = hist.slice().sort(function (x, y) { return x - y; });
      median = s[Math.floor(s.length / 2)];
    }

    hist.push(pct);
    if (hist.length > 20) hist = hist.slice(-20);
    try {
      localStorage.setItem(LS_BEST, JSON.stringify({
        pct: isPB ? pct : prevBest, hist: hist
      }));
    } catch (e) {}

    if (isPB && prevBest != null) return { tier: 2, prevBest: prevBest };
    if (median == null) return { tier: 1 };
    if (pct < median) return { tier: 0 };
    return { tier: 1 };
  }

  function run(o) {
    var R = reduced();
    var verdict = classify(o.pct, o.att, o.counter);
    var timers = [];
    var at = function (ms, fn) {
      if (R) { fn(); return; }
      timers.push(setTimeout(fn, ms));
    };

    /* The map is "how did I get here" — it lands after the verdict, not
       alongside it, so the dots and the numbers don't fight for the eye. */
    at(R ? 0 : 1000, function () { if (o.onMap) o.onMap(); });

    if (verdict.tier >= 1) {
      at(T_NUMBERS_LANDED, function () {
        var n = o.host.querySelector('.v10-bento__num');
        if (n) { n.classList.remove('v10-score-pop'); void n.offsetWidth;
                 n.classList.add('v10-score-pop'); }
      });
    }

    if (verdict.tier >= 2 && o.ctx.ui.confetti && !R) {
      /* Fires at 1000ms, not 420 — after the ticker settles, so it
         punctuates a number the user has actually read. */
      at(1000, function () { o.ctx.ui.confetti({ count: 24 }); });
    }

    /* Any tap completes the sequence. Non-negotiable. */
    var skip = function () {
      timers.forEach(clearTimeout); timers = [];
      if (o.onMap) o.onMap();
      document.removeEventListener('pointerdown', skip);
    };
    if (!R) document.addEventListener('pointerdown', skip, { once: true });

    return verdict;
  }

  window.V11Reveal = { run: run, classify: classify, MIN_ATT: MIN_ATT };
})();
