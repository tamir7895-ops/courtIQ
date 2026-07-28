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

  /* ── strings — challenge titles, tasks and XP toasts, both languages.
     Coach names (Splash, Flow, Tank) stay English in both. ─────────── */
  var T = {
    en: {
      'chal.gm.title': 'The GM\'s challenge',
      'chal.gm.t1': 'Log a tracked session today',
      'chal.splash.title': 'Splash\'s challenge',
      'chal.splash.t1': 'Put up 20 tracked shots today',
      'chal.splash.t2': 'Sink 12 tracked makes today',
      'chal.splash.t3': 'Put up 30 tracked shots today',
      'chal.flow.title': 'Flow\'s challenge',
      'chal.flow.t1': 'Finish a Ball Handling drill today',
      'chal.flow.t2': 'Finish two Ball Handling drills today',
      'chal.tank.title': 'Tank\'s challenge',
      'chal.tank.t1': 'Finish a Conditioning or Strength drill today',
      'chal.tank.t2': 'Finish two Conditioning or Strength drills today',
      'chal.sweep': 'Full staff sweep'
    },
    he: {
      'chal.gm.title': 'האתגר של ה-⁨GM⁩',
      'chal.gm.t1': 'תעד אימון עם מעקב היום',
      'chal.splash.title': 'האתגר של ⁨Splash⁩',
      'chal.splash.t1': 'תעלה 20 זריקות במעקב היום',
      'chal.splash.t2': 'תקלע 12 קליעות במעקב היום',
      'chal.splash.t3': 'תעלה 30 זריקות במעקב היום',
      'chal.flow.title': 'האתגר של ⁨Flow⁩',
      'chal.flow.t1': 'תסיים תרגיל כדרור אחד היום',
      'chal.flow.t2': 'תסיים שני תרגילי כדרור היום',
      'chal.tank.title': 'האתגר של ⁨Tank⁩',
      'chal.tank.t1': 'תסיים תרגיל כושר או כוח אחד היום',
      'chal.tank.t2': 'תסיים שני תרגילי כושר או כוח היום',
      'chal.sweep': 'כל הצוות ביום אחד'
    }
  };
  if (window.V12I18n) V12I18n.add(T);
  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

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
     Variants rotate by calendar day so the gym doesn't repeat itself.
     title/task hold T keys; state() resolves them in the active language. */
  var DEFS = {
    gm: {
      title: 'chal.gm.title',
      variants: [
        { task: 'chal.gm.t1', total: 1, progress: function (d) { return sessionsToday(d && d.sessions); } }
      ]
    },
    splash: {
      title: 'chal.splash.title',
      variants: [
        { task: 'chal.splash.t1', total: 20, progress: function (d) { return shotsToday(d && d.sessions); } },
        { task: 'chal.splash.t2', total: 12, progress: function (d) { return madeToday(d && d.sessions); } },
        { task: 'chal.splash.t3', total: 30, progress: function (d) { return shotsToday(d && d.sessions); } }
      ]
    },
    flow: {
      title: 'chal.flow.title',
      variants: [
        { task: 'chal.flow.t1', total: 1, progress: bhDone },
        { task: 'chal.flow.t2', total: 2, progress: bhDone }
      ]
    },
    tank: {
      title: 'chal.tank.title',
      variants: [
        { task: 'chal.tank.t1', total: 1, progress: fitDone },
        { task: 'chal.tank.t2', total: 2, progress: fitDone }
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
      coach: coachId, title: t(def.title), task: t(v.task),
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
          window.XPSystem.grantXP(BONUS_XP, t('chal.sweep'));
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
