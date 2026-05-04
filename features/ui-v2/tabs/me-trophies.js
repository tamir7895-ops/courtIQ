/* CourtIQ UI v2 — Trophy Case dynamic sync (me-trophies.js)
 *
 * The Me tab renders a Trophy Case slot. me.js seeds it with a static
 * "first 2 unlocked" demo that's kept as fallback. When the
 * COURTIQ_UI_V2.ME_TROPHIES flag is on, this module replaces the slot
 * with trophies whose earned state is computed from observable user
 * data (XP from gamification.js + sessions count + FG% from the
 * Profile/Track stats).
 *
 * No backing badges.js exists in the legacy code; trophy criteria are
 * defined locally here. They mirror the static legacy demo so existing
 * users see a sensible state on first run.
 *
 * All DOM construction uses createElement + textContent — no innerHTML
 * — because all rendered values come from the user's own XP/stat
 * counters or trusted constants in TROPHIES.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.ME_TROPHIES) return;

  var TROPHIES = [
    {
      id: 'first',
      name: 'First',
      iconName: 'badgeTrophy',
      label: 'First Session',
      criterion: function (s) { return (s.sessions || 0) >= 1 || (s.xp || 0) >= 25; }
    },
    {
      id: 'dedicated',
      name: 'Dedicated',
      iconName: 'badgeMedal',
      label: 'Dedicated (10+)',
      criterion: function (s) { return (s.sessions || 0) >= 10; }
    },
    {
      id: 'sniper',
      name: 'Sniper',
      iconName: 'badgeTarget',
      label: 'Field Goal % ≥ 50',
      criterion: function (s) { return (s.fgPct || 0) >= 50; }
    },
    {
      id: 'allstar',
      name: 'All-Star',
      iconName: 'badgeStar',
      label: 'XP ≥ 600',
      criterion: function (s) { return (s.xp || 0) >= 600; }
    }
  ];

  function readXP() {
    try {
      var raw = localStorage.getItem('courtiq-xp');
      if (!raw) return 0;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed.xp === 'number' ? parsed.xp : 0;
    } catch (e) { return 0; }
  }

  function readSessions() {
    var sources = ['#prof-stat1-val', '#lab-stat-pts', '#tr-sessions-val'];
    for (var i = 0; i < sources.length; i++) {
      var el = document.querySelector(sources[i]);
      if (!el) continue;
      var n = parseInt((el.textContent || '').replace(/[^\d]/g, ''), 10);
      if (!isNaN(n) && n > 0) return n;
    }
    try {
      var raw = localStorage.getItem('courtiq-xp');
      if (raw) {
        var p = JSON.parse(raw);
        if (p && Array.isArray(p.history)) return p.history.length;
      }
    } catch (e) { /* silent */ }
    return 0;
  }

  function readFGPct() {
    var sources = ['#prof-stat3-val', '#lab-stat-fg'];
    for (var i = 0; i < sources.length; i++) {
      var el = document.querySelector(sources[i]);
      if (!el) continue;
      var n = parseFloat((el.textContent || '').replace(/[^\d.]/g, ''));
      if (!isNaN(n) && n > 0) return n;
    }
    return 0;
  }

  function snapshotStats() {
    return { xp: readXP(), sessions: readSessions(), fgPct: readFGPct() };
  }

  function buildTrophyEl(trophy, earned) {
    var card = document.createElement('div');
    card.className = 'ciq-me-trophy' + (earned ? ' earned' : '');
    card.setAttribute('data-trophy-id', trophy.id);
    card.title = trophy.label + (earned ? ' — earned' : ' — locked');

    var iconWrap = document.createElement('div');
    iconWrap.className = 'emoji'; // class kept for CSS continuity; container is now SVG-friendly
    if (window.ICONS) {
      if (earned && window.ICONS[trophy.iconName]) {
        iconWrap.appendChild(window.ICONS[trophy.iconName]({ size: 28 }));
      } else if (window.ICONS.lock) {
        iconWrap.appendChild(window.ICONS.lock({ size: 22 }));
      }
    }
    card.appendChild(iconWrap);

    var nameEl = document.createElement('div');
    nameEl.className = 'n';
    nameEl.textContent = trophy.name;
    card.appendChild(nameEl);

    return card;
  }

  function render(slot) {
    if (!slot) return;
    var stats = snapshotStats();
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    for (var i = 0; i < TROPHIES.length; i++) {
      var t = TROPHIES[i];
      slot.appendChild(buildTrophyEl(t, !!t.criterion(stats)));
    }
  }

  function findSlot() {
    return document.querySelector('#ciq-me-screen [data-ciq-slot="trophies"]');
  }

  function throttle(fn, ms) {
    var pending = false;
    return function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; fn(); }, ms);
    };
  }

  function init() {
    var slot = findSlot();
    if (!slot) {
      setTimeout(init, 200);
      return;
    }
    render(slot);

    var legacy = document.getElementById('db-panel-archetype') || document.getElementById('db-panel-shots');
    if (legacy && 'MutationObserver' in window) {
      var mo = new MutationObserver(throttle(function () { render(findSlot()); }, 500));
      mo.observe(legacy, { subtree: true, childList: true, characterData: true });
    }

    window.addEventListener('storage', function (e) {
      if (e.key === 'courtiq-xp') render(findSlot());
    });

    setInterval(function () { render(findSlot()); }, 4000);

    window.CIQ_TROPHIES = { render: function () { render(findSlot()); }, snapshotStats: snapshotStats };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
