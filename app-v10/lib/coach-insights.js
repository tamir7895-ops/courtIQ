/* CourtIQ v12 — coach insights (window.V12Insights)
   ------------------------------------------------------------------
   The difference between a stats page and a coach is WHAT they look at.
   A stats page reads final percentages; a coach reads:

     · direction   — is a zone improving or sliding, week over week
     · fatigue     — do you shoot worse in the back half of a session
     · consistency — 45% every night and 45% on average are different
                     players; only one of them is about to improve
     · rhythm      — days since last session, volume trend

   This lib computes those from the RAW shots (zone+result+timestamp) so
   the AI coach gets derived FACTS, not a data dump. Everything degrades
   honestly: a signal without enough data to support it is simply absent
   from the output, so the model can't cite it. Same M4 rule as the UI —
   one layer deeper.
   ============================================================ */
(function () {
  'use strict';

  var WEEK = 7 * 86400000;

  function pct(m, a) { return a ? Math.round(m * 100 / a) : null; }

  /* Per-zone weekly series over the last 4 weeks. Only zones with enough
     volume to mean anything (>=6 verdicts overall, >=3 in a week bucket
     for that bucket to appear). */
  function zoneTrends(shots, now) {
    var byZone = {};
    shots.forEach(function (s) {
      if (!s.shot_zone || (s.shot_result !== 'made' && s.shot_result !== 'missed')) return;
      var t = new Date(s.timestamp || 0).getTime();
      if (!t) return;
      var wk = Math.floor((now - t) / WEEK);          /* 0 = this week */
      if (wk < 0 || wk > 3) return;
      var z = byZone[s.shot_zone] = byZone[s.shot_zone] || [null, null, null, null];
      var b = z[wk] = z[wk] || { m: 0, a: 0 };
      b.a++; if (s.shot_result === 'made') b.m++;
    });

    var out = [];
    Object.keys(byZone).forEach(function (zone) {
      var wks = byZone[zone];
      var tot = wks.reduce(function (n, b) { return n + (b ? b.a : 0); }, 0);
      if (tot < 6) return;
      /* oldest → newest, only buckets with >=3 attempts speak */
      var series = [];
      for (var wk = 3; wk >= 0; wk--) {
        var b = wks[wk];
        series.push(b && b.a >= 3 ? pct(b.m, b.a) : null);
      }
      var spoken = series.filter(function (v) { return v != null; });
      var dir = null;
      if (spoken.length >= 2) {
        var d = spoken[spoken.length - 1] - spoken[0];
        dir = d >= 10 ? 'improving' : d <= -10 ? 'sliding' : 'flat';
      }
      out.push({ zone: zone, series: series, direction: dir, attempts: tot });
    });
    out.sort(function (a, b) { return b.attempts - a.attempts; });
    return out;
  }

  /* Fatigue: split each day's scored shots at its median timestamp.
     A consistent drop in the back half is one of the most actionable
     things a coach can catch — and invisible in any per-zone summary. */
  function fatigue(shots) {
    var byDay = {};
    shots.forEach(function (s) {
      if (s.shot_result !== 'made' && s.shot_result !== 'missed') return;
      var t = new Date(s.timestamp || 0).getTime();
      if (!t) return;
      var day = (s.timestamp || '').slice(0, 10);
      (byDay[day] = byDay[day] || []).push({ t: t, made: s.shot_result === 'made' });
    });
    var eh = { m: 0, a: 0 }, lh = { m: 0, a: 0 }, days = 0;
    Object.keys(byDay).forEach(function (day) {
      var arr = byDay[day];
      if (arr.length < 16) return;              /* too small to split */
      days++;
      arr.sort(function (x, y) { return x.t - y.t; });
      var half = Math.floor(arr.length / 2);
      arr.forEach(function (s, i) {
        var b = i < half ? eh : lh;
        b.a++; if (s.made) b.m++;
      });
    });
    if (days < 3) return null;                  /* not enough evidence */
    return { early: pct(eh.m, eh.a), late: pct(lh.m, lh.a), days: days };
  }

  /* Session-level accuracy spread — the consistency read. */
  function consistency(sessions) {
    var accs = (sessions || []).filter(function (s) {
      return s.total_made != null && (s.total_attempts || 0) >= 15;
    }).map(function (s) { return s.total_made * 100 / s.total_attempts; });
    if (accs.length < 4) return null;
    var mean = accs.reduce(function (a, b) { return a + b; }, 0) / accs.length;
    var sd = Math.sqrt(accs.reduce(function (a, b) {
      return a + (b - mean) * (b - mean);
    }, 0) / accs.length);
    return { mean: Math.round(mean), sd: Math.round(sd), n: accs.length };
  }

  function rhythm(sessions, now) {
    var dates = (sessions || []).map(function (s) {
      return new Date(s.session_date || s.created_at || 0).getTime();
    }).filter(Boolean).sort(function (a, b) { return b - a; });
    if (!dates.length) return null;
    var thisWeek = dates.filter(function (t) { return now - t < WEEK; }).length;
    var lastWeek = dates.filter(function (t) { return now - t >= WEEK && now - t < 2 * WEEK; }).length;
    return {
      daysSinceLast: Math.floor((now - dates[0]) / 86400000),
      thisWeek: thisWeek, lastWeek: lastWeek
    };
  }

  /* The real drill catalog, compacted for the prompt — so prescriptions
     name drills that actually exist in the library instead of inventing
     them. Focus-filtered, capped. */
  function drillCatalog(focusAreas, cap) {
    var DB = (typeof _DRILLS_DB !== 'undefined') ? _DRILLS_DB : [];
    var want = {};
    (focusAreas || ['Shooting']).forEach(function (f) { want[f] = 1; });
    return DB.filter(function (d) { return d && want[d.focus_area]; })
      .slice(0, cap || 24)
      .map(function (d) {
        return d.name + ' (' + (d.reps_or_sets || '—') + ', ' +
          (d.duration_minutes || '?') + 'min, ' + (d.difficulty || 'Any') + ')';
      });
  }

  function compute(shots, sessions) {
    var now = Date.now();
    return {
      trends: zoneTrends(shots || [], now),
      fatigue: fatigue(shots || []),
      consistency: consistency(sessions),
      rhythm: rhythm(sessions, now)
    };
  }

  window.V12Insights = { compute: compute, drillCatalog: drillCatalog };
})();
