/* ============================================================
   BadgeSystem — CourtIQ Achievement / Badge Engine
   IIFE → exposes window.BadgeSystem
   ============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'courtiq-badges';

  // ── Badge Definitions ──────────────────────────────────────
  const BADGES = {
    // Milestone — streak
    'streak-3':   { name: '3-Day Fire',       icon: '🔥', desc: 'Train 3 days in a row',              category: 'milestone' },
    'streak-7':   { name: 'Week Warrior',      icon: '🏆', desc: 'Train 7 days in a row',              category: 'milestone' },
    'streak-14':  { name: 'Two-Week Beast',    icon: '💪', desc: 'Train 14 days in a row',             category: 'milestone' },
    'streak-30':  { name: 'Iron Will',         icon: '👑', desc: 'Train 30 days in a row',             category: 'milestone' },

    // Session
    'hot-hand':   { name: 'Hot Hand',          icon: '🔥', desc: '30+ shots in one session',           category: 'session' },
    'sniper':     { name: 'Sniper',            icon: '🎯', desc: '80%+ accuracy with 10+ shots',       category: 'session' },
    'marathon':   { name: 'Marathon',          icon: '⏱',  desc: '5+ sessions in one week',            category: 'session' },

    // Cumulative
    '3pt-100':    { name: 'Downtown Legend',   icon: '🏀', desc: '100 lifetime three-pointers',        category: 'cumulative' },
    'shots-500':  { name: 'Shot Machine',      icon: '💫', desc: '500 lifetime shots',                 category: 'cumulative' },
    'xp-1000':    { name: 'XP Grinder',        icon: '⚡', desc: '1 000 total XP earned',              category: 'cumulative' },

    // Activity — first-time
    'first-ai':      { name: 'AI Rookie',      icon: '🤖', desc: 'Complete first AI shot-tracking session', category: 'activity' },
    'first-drill':   { name: 'Gym Rat',        icon: '💪', desc: 'Complete your first drill',               category: 'activity' },
    'first-timer':   { name: 'Timer Pro',      icon: '⏱',  desc: 'Complete first workout timer',            category: 'activity' },
    'first-session': { name: 'Day One',        icon: '📋', desc: 'Log your first training session',         category: 'activity' },
    'customizer':    { name: 'Style Icon',     icon: '✨', desc: 'Customize your avatar',                   category: 'activity' },
  };

  // ── Persistence helpers ────────────────────────────────────
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* corrupted — reset */ }
    return { earned: {}, counters: {} };
  }

  function save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) { /* quota */ }
  }

  // ── Award a badge (internal) ───────────────────────────────
  function award(id, data) {
    if (!BADGES[id] || data.earned[id]) return false;
    data.earned[id] = { ts: Date.now() };
    save(data);
    BadgeSystem.renderUnlockAnimation(BADGES[id]);
    // SFX
    if (typeof SFX !== 'undefined' && SFX.levelUp) {
      try { SFX.levelUp(); } catch (_) { /* no audio ctx */ }
    }
    // Supabase sync
    if (typeof DataService !== 'undefined' && DataService.saveUserData) {
      try { DataService.saveUserData({ badges: data }); } catch (_) { /* offline */ }
    }
    return true;
  }

  // ── Public API ─────────────────────────────────────────────
  var BadgeSystem = {};

  /* --- incrementCounter ----------------------------------- */
  BadgeSystem.incrementCounter = function (key, amount) {
    var d = load();
    if (!d.counters) d.counters = {};
    d.counters[key] = (d.counters[key] || 0) + (amount || 1);
    save(d);
    return d.counters[key];
  };

  /* --- getEarned ------------------------------------------ */
  BadgeSystem.getEarned = function () {
    var d = load();
    return Object.keys(d.earned).map(function (id) {
      return Object.assign({ id: id, ts: d.earned[id].ts }, BADGES[id]);
    });
  };

  /* --- checkStreakBadges ---------------------------------- */
  BadgeSystem.checkStreakBadges = function (currentStreak) {
    var d = load();
    if (currentStreak >= 3)  award('streak-3', d);
    if (currentStreak >= 7)  award('streak-7', d);
    if (currentStreak >= 14) award('streak-14', d);
    if (currentStreak >= 30) award('streak-30', d);
  };

  /* --- checkShotBadges ----------------------------------- */
  BadgeSystem.checkShotBadges = function (summary) {
    // summary = { made, attempts, threesMade }
    if (!summary) return;
    var d = load();
    if (!d.counters) d.counters = {};

    // Accumulate lifetime counters
    if (summary.made)       d.counters.totalShotsMade   = (d.counters.totalShotsMade || 0) + summary.made;
    if (summary.threesMade) d.counters.totalThreesMade  = (d.counters.totalThreesMade || 0) + summary.threesMade;
    save(d);

    // Session badges
    if (summary.attempts >= 30)                                    award('hot-hand', d);
    if (summary.attempts >= 10 && (summary.made / summary.attempts) >= 0.8) award('sniper', d);

    // Cumulative
    if ((d.counters.totalThreesMade || 0) >= 100) award('3pt-100', d);
    if ((d.counters.totalShotsMade  || 0) >= 500) award('shots-500', d);
  };

  /* --- checkAll ------------------------------------------ */
  BadgeSystem.checkAll = function () {
    var d = load();
    if (!d.counters) d.counters = {};

    // XP
    if ((d.counters.totalXP || 0) >= 1000) award('xp-1000', d);

    // Cumulative
    if ((d.counters.totalThreesMade || 0) >= 100) award('3pt-100', d);
    if ((d.counters.totalShotsMade  || 0) >= 500) award('shots-500', d);

    // Activity first-time badges
    if ((d.counters.totalAISessions     || 0) >= 1) award('first-ai', d);
    if ((d.counters.totalDrillsCompleted || 0) >= 1) award('first-drill', d);
    if ((d.counters.totalSessionsLogged || 0) >= 1) award('first-session', d);

    // Marathon: 5+ sessions this week (counter managed externally)
    if ((d.counters.sessionsThisWeek || 0) >= 5) award('marathon', d);
  };

  /* --- renderGrid ---------------------------------------- */
  BadgeSystem.renderGrid = function (containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = '';

    var d = load();
    var grid = document.createElement('div');
    grid.className = 'badge-grid';

    var ids = Object.keys(BADGES);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var b = BADGES[id];
      var earned = !!d.earned[id];

      var item = document.createElement('div');
      item.className = 'badge-item' + (earned ? ' earned' : ' locked');
      item.title = b.name + ' — ' + b.desc;

      var iconEl = document.createElement('span');
      iconEl.className = 'badge-icon';
      iconEl.textContent = earned ? b.icon : '?';
      item.appendChild(iconEl);

      var label = document.createElement('span');
      label.className = 'badge-label';
      label.textContent = b.name;
      item.appendChild(label);

      grid.appendChild(item);
    }
    container.appendChild(grid);
  };

  /* --- renderUnlockAnimation ----------------------------- */
  BadgeSystem.renderUnlockAnimation = function (badge) {
    if (!badge) return;

    // Overlay
    var overlay = document.createElement('div');
    overlay.className = 'badge-unlock-overlay';

    var card = document.createElement('div');
    card.className = 'badge-unlock-card';

    var iconEl = document.createElement('div');
    iconEl.className = 'badge-unlock-icon';
    iconEl.textContent = badge.icon;
    card.appendChild(iconEl);

    var title = document.createElement('div');
    title.className = 'badge-unlock-title';
    title.textContent = 'Badge Unlocked!';
    card.appendChild(title);

    var nameEl = document.createElement('div');
    nameEl.className = 'badge-unlock-name';
    nameEl.textContent = badge.name;
    card.appendChild(nameEl);

    var descEl = document.createElement('div');
    descEl.className = 'badge-unlock-desc';
    descEl.textContent = badge.desc;
    card.appendChild(descEl);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Force reflow then add visible class
    void overlay.offsetWidth;
    overlay.classList.add('visible');

    // Auto-dismiss after 3s
    setTimeout(function () {
      overlay.classList.remove('visible');
      overlay.classList.add('hiding');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 500);
    }, 3000);
  };

  /* --- expose -------------------------------------------- */
  window.BadgeSystem = BadgeSystem;
})();
