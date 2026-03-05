/* ============================================================
   GAMIFICATION — /js/gamification.js
   XP + Level system for CourtIQ.
   Grants XP for logging sessions, completing drills, and
   daily workouts. Persists to localStorage.
   ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'courtiq-xp';

  var LEVELS = [
    { name: 'Rookie',   icon: '🏀', threshold: 0,    cls: 'rookie' },
    { name: 'Hooper',   icon: '⚡', threshold: 200,  cls: 'hooper' },
    { name: 'All-Star', icon: '⭐', threshold: 600,  cls: 'all-star' },
    { name: 'MVP',      icon: '👑', threshold: 1500, cls: 'mvp' }
  ];

  var XP_REWARDS = {
    logSession:     25,
    completeDrill:  15,
    generateDrills: 10,
    dailyWorkout:   30
  };

  /* ── Data ─────────────────────────────────────────────────── */
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { xp: 0, history: [] };
    } catch (e) {
      return { xp: 0, history: [] };
    }
  }

  function save(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) { /* silent */ }
  }

  /* ── Level calc ──────────────────────────────────────────── */
  function getLevel(xp) {
    var lvl = LEVELS[0];
    for (var i = LEVELS.length - 1; i >= 0; i--) {
      if (xp >= LEVELS[i].threshold) { lvl = LEVELS[i]; break; }
    }
    return lvl;
  }

  function getNextLevel(xp) {
    for (var i = 0; i < LEVELS.length; i++) {
      if (xp < LEVELS[i].threshold) return LEVELS[i];
    }
    return null;
  }

  function getProgress(xp) {
    var current = getLevel(xp);
    var next = getNextLevel(xp);
    if (!next) return 100; // max level
    var base = current.threshold;
    var range = next.threshold - base;
    return Math.min(100, Math.round(((xp - base) / range) * 100));
  }

  /* ── Grant XP ────────────────────────────────────────────── */
  function grantXP(amount, reason) {
    var data = load();
    var oldLevel = getLevel(data.xp);

    data.xp += amount;
    data.history.push({
      amount: amount,
      reason: reason,
      date: new Date().toISOString()
    });

    // Keep last 50 entries
    if (data.history.length > 50) {
      data.history = data.history.slice(-50);
    }

    save(data);

    var newLevel = getLevel(data.xp);
    var leveled = oldLevel.name !== newLevel.name;

    render();
    showXPToast(amount, reason);

    if (leveled) {
      showLevelUp(newLevel);
    }

    return data.xp;
  }

  /* ── Render ──────────────────────────────────────────────── */
  function render() {
    var widget = document.getElementById('xp-widget');
    if (!widget) return;

    var data = load();
    var xp = data.xp;
    var level = getLevel(xp);
    var next = getNextLevel(xp);
    var pct = getProgress(xp);

    // Badge
    var badge = document.getElementById('xp-badge');
    if (badge) {
      badge.textContent = level.icon;
      badge.className = 'xp-badge xp-badge--' + level.cls;
    }

    // Rank name
    var rank = document.getElementById('xp-rank');
    if (rank) rank.textContent = level.name;

    // Numbers
    var nums = document.getElementById('xp-numbers');
    if (nums) {
      if (next) {
        nums.innerHTML = '<strong>' + xp + ' XP</strong> / ' + next.threshold + ' XP to ' + next.name;
      } else {
        nums.innerHTML = '<strong>' + xp + ' XP</strong> — Max Level';
      }
    }

    // Bar fill
    var fill = document.getElementById('xp-bar-fill');
    if (fill) {
      fill.style.width = pct + '%';
      fill.className = 'xp-bar-fill xp-bar-fill--' + level.cls;
    }
  }

  /* ── XP Toast ────────────────────────────────────────────── */
  function showXPToast(amount, reason) {
    var el = document.getElementById('xp-gain-toast');
    if (!el) return;

    el.textContent = '+' + amount + ' XP — ' + reason;
    el.classList.add('show');

    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.remove('show');
    }, 2200);
  }

  /* ── Level Up ────────────────────────────────────────────── */
  function showLevelUp(level) {
    var widget = document.getElementById('xp-widget');
    if (widget) {
      widget.classList.add('level-up');
      setTimeout(function () { widget.classList.remove('level-up'); }, 800);
    }

    if (typeof showToast === 'function') {
      showToast('Level Up! You are now ' + level.icon + ' ' + level.name);
    }
  }

  /* ── Hook into existing actions ──────────────────────────── */
  function hookActions() {
    // Hook: dbAddSession (training log)
    if (typeof dbAddSession === 'function' && !dbAddSession._xpHooked) {
      var origAdd = dbAddSession;
      window.dbAddSession = function () {
        var result = origAdd.apply(this, arguments);
        // Grant XP after a short delay to let the async save complete
        setTimeout(function () {
          grantXP(XP_REWARDS.logSession, 'Session Logged');
        }, 800);
        return result;
      };
      window.dbAddSession._xpHooked = true;
    }

    // Hook: drillsGenerate
    if (typeof drillsGenerate === 'function' && !drillsGenerate._xpHooked) {
      var origGen = drillsGenerate;
      window.drillsGenerate = function () {
        var result = origGen.apply(this, arguments);
        setTimeout(function () {
          grantXP(XP_REWARDS.generateDrills, 'Drills Generated');
        }, 800);
        return result;
      };
      window.drillsGenerate._xpHooked = true;
    }

    // Hook: drillToggleSave (completing/saving a drill)
    if (typeof drillToggleSave === 'function' && !drillToggleSave._xpHooked) {
      var origSave = drillToggleSave;
      window.drillToggleSave = function (id) {
        var wasSaved = localStorage.getItem('courtiq-saved-drills');
        var result = origSave.apply(this, arguments);
        var nowSaved = localStorage.getItem('courtiq-saved-drills');
        // Only grant XP when adding, not removing
        if (nowSaved && (!wasSaved || nowSaved.length > wasSaved.length)) {
          grantXP(XP_REWARDS.completeDrill, 'Drill Saved');
        }
        return result;
      };
      window.drillToggleSave._xpHooked = true;
    }

    // Hook: DailyWorkout refresh (generating daily workout)
    if (typeof DailyWorkout !== 'undefined' && DailyWorkout.refresh && !DailyWorkout.refresh._xpHooked) {
      var origRefresh = DailyWorkout.refresh;
      DailyWorkout.refresh = function () {
        var result = origRefresh.apply(this, arguments);
        grantXP(XP_REWARDS.dailyWorkout, 'Daily Workout');
        return result;
      };
      DailyWorkout.refresh._xpHooked = true;
    }
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    render();
    // Delay hook setup to ensure other scripts are loaded
    setTimeout(hookActions, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.XPSystem = {
    grantXP: grantXP,
    load: load,
    getLevel: getLevel,
    getProgress: getProgress,
    render: render
  };
})();
