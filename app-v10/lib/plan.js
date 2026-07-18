/* CourtIQ v12 — training-plan model (window.V12Plan)
   ------------------------------------------------------------------
   The brain behind the plan console. Holds one program the player can
   edit, generates a weekly microcycle from chosen focus areas, and
   reports honest progress from what actually happened.

   Design borrows the patterns that won the category:
   • Runna — the calendar is the hero; a week you can see and rearrange.
   • Fitbod — don't hammer the same thing two days running; adapt.
   • TrainHeroic — a structured month (mesocycle) with weekly emphasis.
   • Ball AI — a weekly shot goal + streak, because tracking is the point.

   Store: courtiq_plan_v2. Migrates from the old courtiq_plan_prefs.
   M4 rule holds: planned volume is a plan; DONE volume is only ever
   real (completion log + tracked sessions).
   ============================================================ */
(function () {
  'use strict';

  var LS = 'courtiq_plan_v2';

  /* Focus areas — id, label, feature color, the drill-DB focus_area
     it maps to, and an icon. One source of truth for the whole UI. */
  var FOCI = [
    { id: 'shooting',     label: 'Shooting',      area: 'Shooting',      tone: 'orange', icon: 'ph-target' },
    { id: 'handles',      label: 'Ball handling', area: 'Ball Handling', tone: 'blue',   icon: 'ph-hand-pointing' },
    { id: 'finishing',    label: 'Finishing',     area: 'Finishing',     tone: 'green',  icon: 'ph-basketball' },
    { id: 'conditioning', label: 'Conditioning',  area: 'Conditioning',  tone: 'purple', icon: 'ph-heartbeat' },
    { id: 'defense',      label: 'Defense',        area: 'Defense',       tone: 'gold',   icon: 'ph-shield' },
    { id: 'passing',      label: 'Passing',        area: 'Passing',       tone: 'blue',   icon: 'ph-arrows-out' }
  ];
  var FOCUS_BY_ID = {};
  FOCI.forEach(function (f) { FOCUS_BY_ID[f.id] = f; });
  function focus(id) { return FOCUS_BY_ID[id] || null; }

  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // schedule index 0..6

  function todayIdx() {
    var d = new Date().getDay();       // 0=Sun..6=Sat
    return (d + 6) % 7;                // → 0=Mon..6=Sun
  }
  function isoOf(date) {
    return date.getFullYear() + '-' +
      ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
      ('0' + date.getDate()).slice(-2);
  }
  function todayISO() { return isoOf(new Date()); }

  /* ── load / migrate / save ────────────────────────────────────*/
  var DEFAULT = {
    version: 2,
    focus: [ { id: 'shooting', perWeek: 3 }, { id: 'handles', perWeek: 2 } ],
    minutes: 30,
    goalShots: 100,
    schedule: null,      // built on first load
    log: {}              // 'YYYY-MM-DD' → { done:true }
  };

  function migrate() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem('courtiq_plan_prefs')); } catch (e) {}
    var out = clone(DEFAULT);
    if (p) {
      out.minutes = p.minutes || 30;
      if (p.focus && p.focus.length) {
        // old prefs.focus was an ordered id array; give the leader more
        out.focus = p.focus.slice(0, 4).map(function (id, i) {
          return { id: id, perWeek: i === 0 ? 3 : 2 };
        });
      }
    }
    return out;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    var p;
    try {
      var raw = localStorage.getItem(LS);
      p = raw ? JSON.parse(raw) : null;
    } catch (e) { p = null; }
    if (!p || p.version !== 2) p = migrate();
    if (!p.focus || !p.focus.length) p.focus = clone(DEFAULT.focus);
    if (!p.minutes) p.minutes = 30;
    if (!p.goalShots) p.goalShots = 100;
    if (!p.log) p.log = {};
    if (!p.schedule) p.schedule = generateSchedule(p);
    return p;
  }

  function save(p) {
    try { localStorage.setItem(LS, JSON.stringify(p)); } catch (e) {}
    /* keep the legacy key in sync so V10Data.getPlanDrills + the training
       tab keep prescribing from the same focuses. */
    try {
      localStorage.setItem('courtiq_plan_prefs', JSON.stringify({
        minutes: p.minutes,
        focus: (p.focus || []).map(function (f) { return f.id; })
      }));
    } catch (e) {}
  }

  /* ── schedule generation ──────────────────────────────────────
     Spread the chosen focuses across the week by frequency, never the
     same focus two days running (Fitbod's anti-overtraining), resting
     the leftover days. Deterministic — same inputs, same week. */
  function generateSchedule(p) {
    var sched = ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest'];
    var foci = (p.focus || []).filter(function (f) { return f.perWeek > 0 && focus(f.id); });
    if (!foci.length) return sched;

    // build a queue: round-robin so a focus doesn't clump
    var counts = {}; foci.forEach(function (f) { counts[f.id] = f.perWeek; });
    var queue = [], guard = 0;
    while (guard++ < 60) {
      var placed = false;
      for (var i = 0; i < foci.length; i++) {
        var id = foci[i].id;
        if (counts[id] > 0) { queue.push(id); counts[id]--; placed = true; }
      }
      if (!placed) break;
    }
    var total = Math.min(7, queue.length);
    if (!total) return sched;

    // even-spread day indices across Mon..Sun
    var dayIdx = [];
    for (var k = 0; k < total; k++) dayIdx.push(Math.round(k * 7 / total) % 7);
    // de-dup collisions by nudging forward
    var used = {};
    dayIdx = dayIdx.map(function (d) {
      while (used[d]) d = (d + 1) % 7;
      used[d] = 1; return d;
    }).sort(function (a, b) { return a - b; });

    // assign, avoiding same focus adjacent
    var q = queue.slice(0, total);
    for (var j = 0; j < dayIdx.length; j++) {
      var day = dayIdx[j];
      var prevDay = dayIdx[j - 1];
      var pick = q.shift();
      if (prevDay != null && sched[prevDay] === pick && q.length) {
        // swap with the next different one
        var alt = -1;
        for (var m = 0; m < q.length; m++) { if (q[m] !== pick) { alt = m; break; } }
        if (alt >= 0) { var tmp = q[alt]; q[alt] = pick; pick = tmp; }
      }
      sched[day] = pick;
    }
    return sched;
  }

  function rebuild(p) { p.schedule = generateSchedule(p); return p; }

  /* ── drills for a focus, sized to minutes ─────────────────────*/
  function drillsForFocus(focusId, minutes) {
    var f = focus(focusId);
    var N = Math.max(2, Math.min(6, Math.round((minutes || 30) / 8)));
    var DB = (typeof _DRILLS_DB !== 'undefined') ? _DRILLS_DB : null;
    if (!f || !DB || !DB.length) return [];
    var pool = DB.filter(function (d) { return d && d.focus_area === f.area; });
    if (pool.length < N) pool = DB.slice();
    var picks = [], step = Math.max(1, Math.floor(pool.length / N));
    for (var i = 0; i < N && picks.length < N; i++) {
      var d = pool[(i * step) % pool.length];
      if (!d) continue;
      picks.push({
        id: d.id || (focusId + '-' + i),
        name: d.name || ('Drill ' + (i + 1)),
        reps: d.reps_or_sets ? parseInt(String(d.reps_or_sets), 10) || 30 : 30,
        mins: d.duration_minutes || Math.round((minutes || 30) / N),
        focus: d.focus_area || f.label,
        description: d.description || ''
      });
    }
    return picks;
  }

  function focusForDay(p, idx) { return (p.schedule || [])[idx] || 'rest'; }
  function todaysFocus(p) { return focusForDay(p, todayIdx()); }
  function todaysDrills(p) {
    var fid = todaysFocus(p);
    if (fid === 'rest') return [];
    return drillsForFocus(fid, p.minutes);
  }

  /* ── completion log ───────────────────────────────────────────*/
  function isDone(p, iso) { return !!(p.log && p.log[iso] && p.log[iso].done); }
  function setDone(p, iso, done) {
    if (!p.log) p.log = {};
    if (done) p.log[iso] = { done: true };
    else delete p.log[iso];
    return p;
  }

  /* ── date helpers ─────────────────────────────────────────────*/
  function mondayOf(date) {
    var d = new Date(date);
    var off = (d.getDay() + 6) % 7;
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - off);
    return d;
  }
  function weekDates(offsetWeeks) {
    var base = mondayOf(new Date());
    base.setDate(base.getDate() + (offsetWeeks || 0) * 7);
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(base); d.setDate(base.getDate() + i);
      out.push(d);
    }
    return out;
  }
  // month grid: array of weeks, each 7 {date, inMonth}
  function monthGrid(year, month) {
    var first = new Date(year, month, 1, 12);
    var start = mondayOf(first);
    var weeks = [], cur = new Date(start);
    for (var w = 0; w < 6; w++) {
      var row = [];
      for (var i = 0; i < 7; i++) {
        row.push({ date: new Date(cur), inMonth: cur.getMonth() === month });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(row);
      if (cur.getMonth() !== month && w >= 3) break; // stop once past the month
    }
    return weeks;
  }

  /* week adherence: done days ÷ planned training days this week */
  function weekAdherence(p, offsetWeeks) {
    var dates = weekDates(offsetWeeks || 0);
    var planned = 0, done = 0;
    dates.forEach(function (d, i) {
      if (focusForDay(p, i) !== 'rest') {
        planned++;
        if (isDone(p, isoOf(d))) done++;
      }
    });
    return { planned: planned, done: done, pct: planned ? Math.round(done * 100 / planned) : 0 };
  }

  /* Per-focus session tally this month (from the completion log +
     scheduled focus of each done day). */
  function focusTallyMonth(p, year, month) {
    var tally = {};
    FOCI.forEach(function (f) { tally[f.id] = 0; });
    Object.keys(p.log || {}).forEach(function (iso) {
      if (!p.log[iso].done) return;
      var parts = iso.split('-');
      if (+parts[0] !== year || (+parts[1] - 1) !== month) return;
      var d = new Date(+parts[0], +parts[1] - 1, +parts[2], 12);
      var idx = (d.getDay() + 6) % 7;
      var fid = focusForDay(p, idx);
      if (tally[fid] != null) tally[fid]++;
    });
    return tally;
  }

  window.V12Plan = {
    FOCI: FOCI, DOW: DOW, focus: focus,
    load: load, save: save, rebuild: rebuild, generateSchedule: generateSchedule,
    drillsForFocus: drillsForFocus, focusForDay: focusForDay,
    todaysFocus: todaysFocus, todaysDrills: todaysDrills, todayIdx: todayIdx,
    isDone: isDone, setDone: setDone,
    isoOf: isoOf, todayISO: todayISO, weekDates: weekDates, monthGrid: monthGrid,
    weekAdherence: weekAdherence, focusTallyMonth: focusTallyMonth
  };
})();
