/* CourtIQ v12 — per-coach daily challenges (window.V12Challenges)
   ------------------------------------------------------------------
   Every coach on the staff sets ONE challenge a day in his own lane.
   M4 rule applies: progress is measured only from things that really
   happened — tracked shots (sessions) and drills finished in the
   workout player (courtiq_v11_drills_done, today-scoped). Claiming a
   completed challenge grants real XP through XPSystem.

   claimed state: localStorage courtiq_v12_chal = { "<coach>_<date>": 1 }
   ============================================================ */
(function () {
  'use strict';

  var LS = 'courtiq_v12_chal';
  var XP_REWARD = 40;

  function today() { return new Date().toISOString().slice(0, 10); }
  function claimedMap() {
    try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; }
  }

  /* drills finished today, resolved to their focus areas */
  function doneFocusesToday() {
    var out = [];
    try {
      var raw = JSON.parse(localStorage.getItem('courtiq_v11_drills_done') || '{}');
      if (raw.date !== today()) return out;
      var DB = (typeof _DRILLS_DB !== 'undefined') ? _DRILLS_DB : [];
      (raw.ids || []).forEach(function (id) {
        for (var i = 0; i < DB.length; i++) {
          if (DB[i].id === id) { out.push(DB[i].focus_area); return; }
        }
      });
    } catch (e) {}
    return out;
  }

  function shotsToday(sessions) {
    var n = 0, t = today();
    (sessions || []).forEach(function (s) {
      var d = (s.session_date || s.created_at || '').slice(0, 10);
      if (d === t) n += (s.total_attempts || 0);
    });
    return n;
  }
  function sessionsToday(sessions) {
    var n = 0, t = today();
    (sessions || []).forEach(function (s) {
      var d = (s.session_date || s.created_at || '').slice(0, 10);
      if (d === t) n++;
    });
    return n;
  }

  function madeToday(sessions) {
    var n = 0, t = today();
    (sessions || []).forEach(function (s) {
      var d = (s.session_date || s.created_at || '').slice(0, 10);
      if (d === t) n += (s.total_made || 0);
    });
    return n;
  }
  function bhDone() {
    return doneFocusesToday().filter(function (f) { return f === 'Ball Handling'; }).length;
  }
  function fitDone() {
    return doneFocusesToday().filter(function (f) {
      return f === 'Conditioning' || f === 'Strength';
    }).length;
  }

  /* one challenge per coach per day — measured, never invented.
     Variants rotate by calendar day so the gym doesn't repeat itself. */
  var DEFS = {
    gm: {
      title: 'The GM\'s challenge',
      variants: [
        { task: 'Log a tracked session today', total: 1, progress: function (d) { return sessionsToday(d && d.sessions); } }
      ]
    },
    splash: {
      title: 'Splash\'s challenge',
      variants: [
        { task: 'Put up 20 tracked shots today', total: 20, progress: function (d) { return shotsToday(d && d.sessions); } },
        { task: 'Sink 12 tracked makes today', total: 12, progress: function (d) { return madeToday(d && d.sessions); } },
        { task: 'Put up 30 tracked shots today', total: 30, progress: function (d) { return shotsToday(d && d.sessions); } }
      ]
    },
    flow: {
      title: 'Flow\'s challenge',
      variants: [
        { task: 'Finish a Ball Handling drill today', total: 1, progress: bhDone },
        { task: 'Finish two Ball Handling drills today', total: 2, progress: bhDone }
      ]
    },
    tank: {
      title: 'Tank\'s challenge',
      variants: [
        { task: 'Finish a Conditioning or Strength drill today', total: 1, progress: fitDone },
        { task: 'Finish two Conditioning or Strength drills today', total: 2, progress: fitDone }
      ]
    }
  };
  function variantOf(coachId) {
    var def = DEFS[coachId];
    if (!def) return null;
    var dayN = Math.floor(Date.now() / 86400000);
    return def.variants[dayN % def.variants.length];
  }

  function state(coachId, data) {
    var def = DEFS[coachId], v = variantOf(coachId);
    if (!v) return null;
    var done = Math.min(v.total, v.progress(data) || 0);
    var claimed = !!claimedMap()[coachId + '_' + today()];
    return {
      coach: coachId, title: def.title, task: v.task,
      done: done, total: v.total,
      complete: done >= v.total, claimed: claimed
    };
  }

  function claimedToday() {
    var m = claimedMap(), t = today(), n = 0;
    ['gm', 'splash', 'flow', 'tank'].forEach(function (id) { if (m[id + '_' + t]) n++; });
    return n;
  }

  function claim(coachId, data) {
    var s = state(coachId, data);
    if (!s || !s.complete || s.claimed) return null;
    var m = claimedMap();
    m[coachId + '_' + today()] = 1;
    try { localStorage.setItem(LS, JSON.stringify(m)); } catch (e) {}
    try {
      if (window.XPSystem && window.XPSystem.grantXP) {
        window.XPSystem.grantXP(XP_REWARD, s.title);
      }
    } catch (e2) {}
    /* sweep the whole staff in one day → the locker-room bonus, once */
    var bonus = false;
    if (claimedToday() === 4 && !m['all4_' + today()]) {
      m['all4_' + today()] = 1;
      try { localStorage.setItem(LS, JSON.stringify(m)); } catch (e3) {}
      try {
        if (window.XPSystem && window.XPSystem.grantXP) {
          window.XPSystem.grantXP(BONUS_XP, 'Full staff sweep');
        }
      } catch (e4) {}
      bonus = true;
    }
    pushClaims();
    return { ok: true, bonus: bonus };
  }

  /* ── account sync — claims follow the player, not the phone ────
     public.challenge_claims: one row per (user, day, coach). Pull
     merges remote claims into localStorage; push writes today's. */
  function signedIn() { try { return !!(window.currentUser && window.currentUser.id); } catch (e) { return false; } }
  function pushClaims() {
    try {
      if (!signedIn() || !window.sb || !sb.from) return;
      var m = claimedMap(), t = today(), rows = [];
      ['gm', 'splash', 'flow', 'tank'].forEach(function (id) {
        if (m[id + '_' + t]) rows.push({ user_id: window.currentUser.id, day: t, coach: id });
      });
      if (rows.length) {
        sb.from('challenge_claims').upsert(rows, { onConflict: 'user_id,day,coach' })
          .then(function () {}, function () {});
      }
    } catch (e) {}
  }
  function sync() {
    if (!signedIn() || !window.sb || !sb.from) return Promise.resolve(false);
    return sb.from('challenge_claims')
      .select('coach')
      .eq('user_id', window.currentUser.id)
      .eq('day', today())
      .then(function (res) {
        var rows = (res && res.data) || [];
        if (!rows.length) return false;
        var m = claimedMap(), t = today(), changed = false;
        rows.forEach(function (r) {
          if (!m[r.coach + '_' + t]) { m[r.coach + '_' + t] = 1; changed = true; }
        });
        if (changed) { try { localStorage.setItem(LS, JSON.stringify(m)); } catch (e) {} }
        return changed;
      })
      .catch(function () { return false; });
  }

  var BONUS_XP = 100;
  window.V12Challenges = {
    state: state, claim: claim, claimedToday: claimedToday, sync: sync,
    XP: XP_REWARD, BONUS: BONUS_XP
  };
})();
