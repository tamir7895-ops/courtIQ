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

  /* one challenge per coach per day — measured, never invented */
  var DEFS = {
    gm: {
      title: 'The GM\'s challenge',
      task: 'Log a tracked session today',
      total: 1,
      progress: function (data) { return sessionsToday(data && data.sessions); }
    },
    splash: {
      title: 'Splash\'s challenge',
      task: 'Put up 20 tracked shots today',
      total: 20,
      progress: function (data) { return shotsToday(data && data.sessions); }
    },
    flow: {
      title: 'Flow\'s challenge',
      task: 'Finish a Ball Handling drill today',
      total: 1,
      progress: function () {
        return doneFocusesToday().filter(function (f) { return f === 'Ball Handling'; }).length;
      }
    },
    tank: {
      title: 'Tank\'s challenge',
      task: 'Finish a Conditioning or Strength drill today',
      total: 1,
      progress: function () {
        return doneFocusesToday().filter(function (f) {
          return f === 'Conditioning' || f === 'Strength';
        }).length;
      }
    }
  };

  function state(coachId, data) {
    var def = DEFS[coachId];
    if (!def) return null;
    var done = Math.min(def.total, def.progress(data) || 0);
    var claimed = !!claimedMap()[coachId + '_' + today()];
    return {
      coach: coachId, title: def.title, task: def.task,
      done: done, total: def.total,
      complete: done >= def.total, claimed: claimed
    };
  }

  function claim(coachId, data) {
    var s = state(coachId, data);
    if (!s || !s.complete || s.claimed) return false;
    var m = claimedMap();
    m[coachId + '_' + today()] = 1;
    try { localStorage.setItem(LS, JSON.stringify(m)); } catch (e) {}
    try {
      if (window.XPSystem && window.XPSystem.grantXP) {
        window.XPSystem.grantXP(XP_REWARD, s.title);
      }
    } catch (e2) {}
    return true;
  }

  window.V12Challenges = { state: state, claim: claim, XP: XP_REWARD };
})();
