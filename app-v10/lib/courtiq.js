/* CourtIQ v11 — the Court IQ score
   ------------------------------------------------------------------
   One number, 0–99. Replaces LEVEL + XP as the headline metric.

   WINDOW: best 5 scored sessions of the last 30 days.
   The window is the whole design. Two sources contradicted each other:
   HomeCourt scores from top-N so a bad night never punishes you (users
   churn when a metric punishes them for showing up); the premium read
   says a score that can't fall is a participation trophy. A rolling
   window honours both — one bad night can't move it, but stop training
   and it decays on its own as the good sessions age out. Decay needs no
   punishment logic; it's just arithmetic.

   M4 rule: every number here is derived from real sessions or the
   caller gets null and renders an honest empty state. Notably there is
   NO percentile — we have no population to compute one against, so we
   don't claim one.
   ============================================================ */
(function () {
  'use strict';

  var WINDOW_DAYS = 30;
  var TOP_N       = 5;
  var MIN_ATT     = 5;      // below this there's no evidence to score
  var PRIOR       = 0.45;   // baseline FG% a shooting workout regresses toward
  var SHRINK      = 8;      // pseudo-attempts pulling low-volume sessions to PRIOR
  var ACC_FLOOR   = 0.10;   // accuracy mapping to 0
  var ACC_CEIL    = 0.80;   // accuracy mapping to 99

  /* Bands COMPRESS as they climb — 25 points wide at the bottom, 6 at the
     top. Not a stylistic choice: every mature sports-rating system does
     this (2K MyTeam runs 13→4→3→3→2→3→2→2→1; EA runs 65→10→25) because
     discrimination matters most where players are close together, and
     nobody needs to distinguish a 22 from a 34.

     The wide bottom band is deliberate too — there is no gradient of
     shame. A 30 and a 50 both just mean "here's your next thing to work
     on", and splitting hairs down there only tells someone how bad they
     are with more precision. */
  var TIERS = [
    { min: 94, name: 'ELITE' },
    { min: 87, name: 'ALL-STAR' },
    { min: 80, name: 'SHARPSHOOTER' },
    { min: 70, name: 'SCORER' },
    { min: 55, name: 'STARTER' },
    { min: 0,  name: 'DEVELOPING' }
  ];

  function tierOf(score) {
    for (var i = 0; i < TIERS.length; i++) {
      if (score >= TIERS[i].min) return TIERS[i].name;
    }
    return 'ROOKIE';
  }

  function sessionMs(s) {
    var t = new Date(s.session_date || s.created_at || 0).getTime();
    return isNaN(t) ? 0 : t;
  }

  /* A counter-only session has attempts but no made/miss verdicts — it
     proves you showed up, not how you shot. It cannot be scored. */
  function isCounterSession(s) {
    return !s || s.session_type === 'live_counter' || s.total_made == null;
  }

  function sessionScore(s) {
    if (isCounterSession(s)) return null;
    var att = s.total_attempts != null ? s.total_attempts : 0;
    if (att < MIN_ATT) return null;
    var made = s.total_made || 0;
    // Bayesian shrinkage: 1-for-1 must not read as a perfect night.
    var acc = (made + SHRINK * PRIOR) / (att + SHRINK);
    var t = (acc - ACC_FLOOR) / (ACC_CEIL - ACC_FLOOR);
    return Math.max(0, Math.min(99, Math.round(t * 99)));
  }

  /* The score a completely average session earns — the value an unproven
     slot is worth. PRIOR accuracy pushed through the same mapping. */
  var PRIOR_SCORE = Math.round(((PRIOR - ACC_FLOOR) / (ACC_CEIL - ACC_FLOOR)) * 99);

  /* Score the 30-day window ENDING at endMs. Passing an earlier endMs is
     how the delta is computed — same maths, shifted window, no snapshots
     to store and none to drift. */
  function scoreWindow(sessions, endMs) {
    var startMs = endMs - WINDOW_DAYS * 86400000;
    var scores = [];
    (sessions || []).forEach(function (s) {
      var ms = sessionMs(s);
      if (!ms || ms > endMs || ms < startMs) return;
      var sc = sessionScore(s);
      if (sc != null) scores.push(sc);
    });
    if (!scores.length) return null;
    scores.sort(function (a, b) { return b - a; });

    /* Always divide by TOP_N, never by what you happen to have. Averaging
       one 88 over one slot makes a single good night read ELITE — a
       participation trophy with a decimal point. An unproven slot counts
       as an average one (PRIOR_SCORE) and only improves once you actually
       fill it, so the top of the scale has to be earned five times over.
       Same shrinkage idea as sessionScore, applied to the aggregate. */
    var padded = scores.slice(0, TOP_N);
    while (padded.length < TOP_N) padded.push(PRIOR_SCORE);
    var sum = padded.reduce(function (a, b) { return a + b; }, 0);
    return { score: Math.round(sum / TOP_N), scored: scores.length };
  }

  /* Days since the most recent RATED session, or null if there are none. */
  function staleDays(sessions, now) {
    var newest = null;
    (sessions || []).forEach(function (s) {
      if (sessionScore(s) == null) return;
      var ms = sessionMs(s);
      if (ms && (newest === null || ms > newest)) newest = ms;
    });
    if (newest === null) return null;
    return Math.floor((now - newest) / 86400000);
  }

  /* Resolves to null when nothing real can be said yet — the caller is
     expected to invite rather than render a zero. */
  function getCourtIQ() {
    return window.V10Data.getSessions(200).then(function (sessions) {
      var now  = Date.now();
      var cur  = scoreWindow(sessions, now);
      if (!cur) return null;
      var prev  = scoreWindow(sessions, now - 7 * 86400000);
      var delta = prev ? cur.score - prev.score : null;
      var stale = staleDays(sessions, now);

      /* A drop with no new rated session in the last week isn't a drop in
         how you shoot — it's good sessions ageing out of the 30-day window.
         Same number, completely different meaning, and the UI has to tell
         them apart or a red −7 after a week off reads as a punishment for
         nothing and the score looks broken. */
      var decayed = delta != null && delta < 0 && stale != null && stale >= 7;

      return {
        score:    cur.score,
        tier:     tierOf(cur.score),
        scored:   cur.scored,                                 // rated sessions in window
        delta:    delta,                                      // vs 7 days ago
        decayed:  decayed,
        staleDays: stale,
        slots:    TOP_N,
        unproven: Math.max(0, TOP_N - cur.scored)             // slots still at baseline
      };
    }).catch(function () { return null; });
  }

  /* The score as it stood at N points back in time — same window math,
     evaluated at earlier "now"s. Real history, not interpolation; a point
     is null where there wasn't enough film yet. One fetch serves all. */
  function getSeries(points, stepDays) {
    points = points || 8; stepDays = stepDays || 5;
    return window.V10Data.getSessions(200).then(function (sessions) {
      var now = Date.now(), out = [];
      for (var i = points - 1; i >= 0; i--) {
        var t = now - i * stepDays * 86400000;
        var w = scoreWindow(sessions, t);
        out.push(w ? w.score : null);
      }
      return out;
    }).catch(function () { return []; });
  }

  window.V10CourtIQ = {
    get:          getCourtIQ,
    series:       getSeries,
    sessionScore: sessionScore,
    tierOf:       tierOf,
    WINDOW_DAYS:  WINDOW_DAYS,
    TOP_N:        TOP_N
  };
})();
