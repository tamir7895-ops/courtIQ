/* CourtIQ v12 — local notifications (window.V12Notify)
   ------------------------------------------------------------------
   The retention loop, finally armed. Two honest reminders, both built
   ONLY from real state and rescheduled on every launch, plan change
   and session save:

     PLAN DAYS   17:30 on each of the next 7 non-rest plan days —
                 "SHOOTING day — Splash is waiting in the gym."
     STREAK SAVE 20:30 today+tomorrow, only while a streak is alive
                 and only if no session yet that day (today's saver is
                 cancelled the moment a session lands).

   iOS asks permission on first arm. The whole file no-ops cleanly on
   the web and when the player turns reminders off (Settings → Me).
   IDs: 1000+dayOffset = plan, 2000+dayOffset = streak. ES5.
   ============================================================ */
(function () {
  'use strict';

  var LS_PREF = 'courtiq_notify';        /* 'off' = player said no */

  function plugin() {
    try {
      if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
        return Capacitor.Plugins.LocalNotifications;
      }
    } catch (e) {}
    return null;
  }
  function enabled() {
    try { return localStorage.getItem(LS_PREF) !== 'off'; } catch (e) { return true; }
  }
  function setEnabled(on) {
    try { localStorage.setItem(LS_PREF, on ? 'on' : 'off'); } catch (e) {}
    if (on) reschedule(); else cancelAll();
  }

  var COACH_OF = {
    shooting: 'Splash', handles: 'Flow', finishing: 'Splash',
    conditioning: 'Tank', defense: 'Tank', passing: 'Flow'
  };

  function at(dayOffset, h, m) {
    var d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function buildList() {
    var list = [];
    var now = Date.now();

    /* plan days, next 7 */
    try {
      var P = window.V12Plan;
      if (P) {
        var p = P.load();
        for (var i = 0; i < 7; i++) {
          var d = new Date(); d.setDate(d.getDate() + i);
          var idx = (d.getDay() + 6) % 7;              /* Monday-first */
          var fid = P.focusForDay(p, idx);
          if (!fid || fid === 'rest') continue;
          var t = at(i, 17, 30);
          if (t.getTime() <= now) continue;
          if (i === 0 && P.isDone(p, P.todayISO())) continue;   /* already trained */
          list.push({
            id: 1000 + i,
            title: fid.toUpperCase() + ' day',
            body: (COACH_OF[fid] || 'The Scout') + ' is waiting in the gym — ' +
                  (p.minutes || 30) + ' minutes on the plan.',
            schedule: { at: t }
          });
        }
      }
    } catch (e) {}

    /* streak saver — only while the fire is real */
    try {
      var streak = window.StreakSystem ? StreakSystem.load() : null;
      if (streak && streak.current > 0) {
        for (var j = 0; j < 2; j++) {
          var ts = at(j, 20, 30);
          if (ts.getTime() <= now) continue;
          if (j === 0 && streak.lastDate === new Date().toISOString().slice(0, 10)) continue;
          list.push({
            id: 2000 + j,
            title: streak.current + '-day streak on the line',
            body: 'Ten minutes keeps the fire. The court is open.',
            schedule: { at: ts }
          });
        }
      }
    } catch (e) {}

    return list;
  }

  var KNOWN_IDS = [1000, 1001, 1002, 1003, 1004, 1005, 1006, 2000, 2001];
  function cancelAll() {
    var LN = plugin();
    if (!LN) return Promise.resolve();
    return LN.cancel({
      notifications: KNOWN_IDS.map(function (id) { return { id: id }; })
    }).catch(function () {});
  }

  var arming = false;
  function reschedule() {
    var LN = plugin();
    if (!LN || !enabled() || arming) return Promise.resolve(false);
    arming = true;
    return LN.requestPermissions().then(function (res) {
      if (!res || res.display !== 'granted') return false;
      return cancelAll().then(function () {
        var list = buildList();
        if (!list.length) return true;
        return LN.schedule({ notifications: list }).then(function () { return true; });
      });
    }).catch(function () { return false; })
      .then(function (ok) { arming = false; return ok; });
  }

  /* fresh session → today's saver is obsolete, plan day satisfied */
  window.addEventListener('courtiq:session-saved', function () {
    setTimeout(reschedule, 800);
  });
  /* new plan → new week shape */
  window.addEventListener('courtiq:plan-saved', function () {
    setTimeout(reschedule, 200);
  });

  /* arm shortly after launch — after bootstrap settles */
  setTimeout(reschedule, 4000);

  window.V12Notify = {
    reschedule: reschedule, setEnabled: setEnabled,
    enabled: enabled, _buildList: buildList
  };
})();
