/* ============================================================
   STREAK SYSTEM — /js/streak.js
   Tracks daily check-ins, awards XP, shows 🔥 badge.
   Milestones: 3, 7, 14, 30 days.
   ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'courtiq-streak';

  /* ── i18n — this file also loads on legacy pages WITHOUT lib/i18n.js,
     so registration is LAZY: tried at load, retried on every t() until
     V12I18n shows up. When it never does, t() falls back to the English
     string here (with {x} substitution), so legacy pages keep their
     exact old text instead of showing raw keys. */
  var T = {
    en: {
      'streak.m3.title':  '3-Day Streak!',
      'streak.m3.msg':    'You\'re building a habit. Keep it going!',
      'streak.m7.title':  'WEEK ON FIRE!',
      'streak.m7.msg':    '7 days straight — serious dedication!',
      'streak.m14.title': '2-Week Monster',
      'streak.m14.msg':   'Two weeks of consistency. Legendary.',
      'streak.m30.title': '30-DAY BEAST',
      'streak.m30.msg':   'A full month of training. Elite level.',
      'streak.xp.daily':  'Daily Check-in',
      'streak.badge':     '🔥 {n}d',
      'streak.badge.tip': 'Current streak: {n} days\nBest: {b} days'
    },
    he: {
      'streak.m3.title':  'רצף של 3 ימים!',
      'streak.m3.msg':    'אתה בונה הרגל. תמשיך ככה!',
      'streak.m7.title':  'שבוע בוער!',
      'streak.m7.msg':    '7 ימים ברצף — מחויבות רצינית!',
      'streak.m14.title': 'מפלצת של שבועיים',
      'streak.m14.msg':   'שבועיים של עקביות. אגדי.',
      'streak.m30.title': 'חיה של 30 יום',
      'streak.m30.msg':   'חודש שלם של אימונים. רמת עילית.',
      'streak.xp.daily':  'צ׳ק-אין יומי',
      'streak.badge':     '🔥 {n} ימים',
      'streak.badge.tip': 'רצף נוכחי: {n} ימים\nשיא: {b} ימים'
    }
  };
  var _i18nRegistered = false;
  function regI18n() {
    if (!_i18nRegistered && window.V12I18n && window.V12I18n.add) {
      window.V12I18n.add(T);
      _i18nRegistered = true;
    }
  }
  regI18n();
  function t(k, p) {
    regI18n();
    if (_i18nRegistered && window.V12I18n && window.V12I18n.t) return window.V12I18n.t(k, p);
    var s = T.en[k] || k;
    if (p) {
      for (var q in p) { s = s.split('{' + q + '}').join(String(p[q])); }
    }
    return s;
  }

  var MILESTONE_MESSAGES = {
    3:  { emoji: '🔥', titleKey: 'streak.m3.title',  msgKey: 'streak.m3.msg',  xp: 30 },
    7:  { emoji: '🏆', titleKey: 'streak.m7.title',  msgKey: 'streak.m7.msg',  xp: 100 },
    14: { emoji: '💪', titleKey: 'streak.m14.title', msgKey: 'streak.m14.msg', xp: 200 },
    30: { emoji: '👑', titleKey: 'streak.m30.title', msgKey: 'streak.m30.msg', xp: 500 }
  };

  /* ── Helpers ─────────────────────────────────────────────── */
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { current: 0, best: 0, lastDate: null };
    } catch (e) {
      return { current: 0, best: 0, lastDate: null };
    }
  }

  function save(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) { /* silent */ }
  }

  /* ── Daily check-in ──────────────────────────────────────── */
  /* ── Streak Freeze — a purchasable one-day bridge ─────────────── */
  var LS_FREEZE = 'courtiq_streak_freeze';
  function freezes() {
    try { return parseInt(localStorage.getItem(LS_FREEZE) || '0', 10) || 0; } catch (e) { return 0; }
  }
  /* A count is a decrementing consumable, and no union or max rule can
     represent something that goes down. So the count stays for the UI
     while the mergeable truth is two SETS: one row per freeze bought,
     one row per day a freeze bridged. The balance is the difference, so
     a replayed sync can neither double-charge nor resurrect a spent
     freeze. */
  var LS_FREEZE_LOG = 'courtiq_freeze_log';
  function freezeLog() {
    try {
      var l = JSON.parse(localStorage.getItem(LS_FREEZE_LOG) || '{}');
      return { grants: l.grants || [], uses: l.uses || [] };
    } catch (e) { return { grants: [], uses: [] }; }
  }
  function saveFreezeLog(l) {
    try { localStorage.setItem(LS_FREEZE_LOG, JSON.stringify(l)); } catch (e) {}
  }

  function addFreeze(n) {
    var count = n || 1;
    try { localStorage.setItem(LS_FREEZE, String(freezes() + count)); } catch (e) {}
    var l = freezeLog();
    for (var i = 0; i < count; i++) {
      l.grants.push('g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    }
    saveFreezeLog(l);
  }

  function useFreeze() {
    var n = freezes();
    if (n <= 0) return false;
    try { localStorage.setItem(LS_FREEZE, String(n - 1)); } catch (e) { return false; }
    /* Keyed by the day it bridged: pushing twice records the same day
       once, and the server unions it the same way. */
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var bridged = d.toISOString().slice(0, 10);
    var l = freezeLog();
    if (l.uses.indexOf(bridged) < 0) { l.uses.push(bridged); saveFreezeLog(l); }
    return true;
  }
  /* ── The training-day set ─────────────────────────────────────
     `current`/`lastDate` are a SUMMARY: one date and a count. Two
     devices holding different summaries cannot be merged without one
     of them losing, which is how a stale phone used to be able to cut
     a four-day streak to one. The set of days is mergeable by union —
     order and staleness stop mattering — so it is the thing that syncs
     and the streak is derived from it server-side.

     Capped at ~3 years: enough that no live streak can fall off the
     end, bounded enough that the payload never grows without limit. */
  var LS_DAYS = 'courtiq_training_days';
  var DAY_CAP = 1100;

  function trainingDays() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_DAYS) || '[]');
      return Object.prototype.toString.call(raw) === '[object Array]' ? raw : [];
    } catch (e) { return []; }
  }

  function addTrainingDay(day) {
    try {
      var days = trainingDays();
      if (days.indexOf(day) >= 0) return days;
      days.push(day);
      days.sort();
      if (days.length > DAY_CAP) days = days.slice(-DAY_CAP);
      localStorage.setItem(LS_DAYS, JSON.stringify(days));
      return days;
    } catch (e) { return []; }
  }

  /* Merge the server's set back in after a pull. */
  function mergeTrainingDays(serverDays) {
    if (!serverDays || !serverDays.length) return trainingDays();
    try {
      var seen = {}, out = [];
      trainingDays().concat(serverDays).forEach(function (d) {
        if (d && !seen[d]) { seen[d] = 1; out.push(d); }
      });
      out.sort();
      if (out.length > DAY_CAP) out = out.slice(-DAY_CAP);
      localStorage.setItem(LS_DAYS, JSON.stringify(out));
      return out;
    } catch (e) { return trainingDays(); }
  }

  /* A player who has trained before this shipped has a summary but no
     set. Rebuild the run it implies — lastDate back through current —
     so an existing streak survives the upgrade instead of collapsing
     to a single day on first sync. */
  function backfillTrainingDays() {
    try {
      if (localStorage.getItem(LS_DAYS)) return;
      var d = load();
      if (!d.lastDate || !d.current) { localStorage.setItem(LS_DAYS, '[]'); return; }
      var days = [], base = new Date(d.lastDate + 'T00:00:00Z');
      for (var i = 0; i < d.current; i++) {
        var day = new Date(base.getTime() - i * 86400000);
        days.push(day.toISOString().slice(0, 10));
      }
      days.sort();
      localStorage.setItem(LS_DAYS, JSON.stringify(days));
    } catch (e) {}
  }

  function missedExactlyOneDay(lastDate) {
    var d = new Date();
    d.setDate(d.getDate() - 2);
    return lastDate === d.toISOString().slice(0, 10);
  }

  function checkIn() {
    var data = load();
    /* NOT `t` — that name belongs to the module's i18n helper above, and
       a local shadow here silently turned every t('...') in this function
       into a call on a date string (TypeError), killing the daily XP
       grant and the milestone toast before either could run. */
    var today = todayStr();

    if (data.lastDate === today) return data; // already checked in today

    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yStr = yesterday.toISOString().slice(0, 10);

    if (data.lastDate === yStr) {
      data.current += 1;               // consecutive day
    } else if (data.lastDate && missedExactlyOneDay(data.lastDate) && useFreeze()) {
      // a Streak Freeze bridges ONE missed day — bought with real coins
      data.current += 1;
    } else {
      data.current = 1;                // streak broken, or first check-in
    }

    data.best = Math.max(data.best || 0, data.current);
    data.lastDate = today;
    save(data);
    /* The server derives the streak from the SET of days trained, which
       is immune to a stale device pushing a later date with worse
       information. This record only holds one date, so the set is kept
       alongside it. */
    addTrainingDay(today);

    // Grant daily login XP (only on first check-in per day)
    if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
      setTimeout(function () {
        XPSystem.grantXP(10, t('streak.xp.daily'));
      }, 400);
    }

    // Check milestones
    var milestone = MILESTONE_MESSAGES[data.current];
    if (milestone) {
      setTimeout(function () {
        if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
          XPSystem.grantXP(milestone.xp, milestone.emoji + ' ' + t(milestone.titleKey));
        }
        showMilestoneToast(data.current, milestone);
      }, 1200);
    }

    return data;
  }

  /* ── Render badge ────────────────────────────────────────── */
  function render() {
    var data = load();
    var badge = document.getElementById('db-streak-badge');
    if (!badge) return;

    if (data.current >= 2) {
      badge.textContent = t('streak.badge', { n: data.current });
      badge.title = t('streak.badge.tip', { n: data.current, b: data.best });
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }

    // Also render in the streak widget if present
    var widgetCount = document.getElementById('streak-count');
    var widgetBest  = document.getElementById('streak-best');
    if (widgetCount) widgetCount.textContent = data.current;
    if (widgetBest)  widgetBest.textContent  = data.best || data.current;
  }

  /* ── Milestone toast ─────────────────────────────────────── */
  function showMilestoneToast(days, milestone) {
    var el = document.getElementById('streak-toast');
    if (!el) return;

    el.querySelector('.streak-toast-emoji').textContent = milestone.emoji;
    el.querySelector('.streak-toast-title').textContent = t(milestone.titleKey);
    el.querySelector('.streak-toast-msg').textContent   = t(milestone.msgKey);
    el.querySelector('.streak-toast-xp').textContent    = '+' + milestone.xp + ' XP';

    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.remove('show');
    }, 5000);
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    /* Was `checkIn()` — which fired on DOMContentLoaded, so merely OPENING
       the app extended the streak. That is not a training streak, it's an
       app-open streak, and it's precisely the criticism levelled at
       Duolingo: the metric measures the habit of launching, not the habit
       of practising. A number that goes up when you do nothing can't
       motivate you to do something.

       The real check-in already exists and already fires at the only
       moment that earns it — ShotTrackingScreen.js calls checkIn() when a
       session actually ends. This call was duplicate AND wrong; only the
       duplicate was load-bearing for nothing. Init now just renders. */
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.StreakSystem = {
    load:   load,
    render: render,
    get:    function () { return load().current; },
    /* ShotTrackingScreen calls this on real session end — it was never
       exported, so its `typeof === 'function'` guard silently skipped
       and streaks never advanced from sessions. Found by the freeze
       tests; the guard that was meant to protect hid the bug. */
    checkIn: checkIn,
    freezes: freezes,
    addFreeze: addFreeze,
    /* the mergeable form of the streak — see the training-day set above */
    trainingDays:      trainingDays,
    mergeTrainingDays: mergeTrainingDays,
    backfillTrainingDays: backfillTrainingDays,
    save:   save
  };
  backfillTrainingDays();
})();
