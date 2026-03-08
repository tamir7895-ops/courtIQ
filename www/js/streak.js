/* ============================================================
   STREAK SYSTEM — /js/streak.js
   Tracks daily check-ins, awards XP, shows 🔥 badge.
   Milestones: 3, 7, 14, 30 days.
   ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'courtiq-streak';

  var MILESTONE_MESSAGES = {
    3:  { emoji: '🔥', title: '3-Day Streak!',  msg: 'You\'re building a habit. Keep it going!', xp: 30 },
    7:  { emoji: '🏆', title: 'WEEK ON FIRE!',  msg: '7 days straight — serious dedication!',    xp: 100 },
    14: { emoji: '💪', title: '2-Week Monster', msg: 'Two weeks of consistency. Legendary.',      xp: 200 },
    30: { emoji: '👑', title: '30-DAY BEAST',   msg: 'A full month of training. Elite level.',   xp: 500 }
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
  function checkIn() {
    var data = load();
    var t = todayStr();

    if (data.lastDate === t) return data; // already checked in today

    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yStr = yesterday.toISOString().slice(0, 10);

    if (data.lastDate === yStr) {
      data.current += 1;               // consecutive day
    } else {
      data.current = 1;                // streak broken, or first check-in
    }

    data.best = Math.max(data.best || 0, data.current);
    data.lastDate = t;
    save(data);

    // Grant daily login XP (only on first check-in per day)
    if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
      setTimeout(function () {
        XPSystem.grantXP(10, 'Daily Check-in');
      }, 400);
    }

    // Check milestones
    var milestone = MILESTONE_MESSAGES[data.current];
    if (milestone) {
      setTimeout(function () {
        if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
          XPSystem.grantXP(milestone.xp, milestone.emoji + ' ' + milestone.title);
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
      badge.textContent = '🔥 ' + data.current + 'd';
      badge.title = 'Current streak: ' + data.current + ' days\nBest: ' + data.best + ' days';
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
    el.querySelector('.streak-toast-title').textContent = milestone.title;
    el.querySelector('.streak-toast-msg').textContent   = milestone.msg;
    el.querySelector('.streak-toast-xp').textContent    = '+' + milestone.xp + ' XP';

    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.remove('show');
    }, 5000);
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    var data = checkIn();
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
    get:    function () { return load().current; }
  };
})();
