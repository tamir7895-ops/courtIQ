/* ============================================================
   DAILY WORKOUT — /js/daily-workout.js
   Generates a 4-drill daily workout from the drill database.
   Persists to localStorage for 24 hours.
   ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'courtiq-daily-workout';
  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  var TAG_MAP = {
    warmup:       { label: 'Warmup',       cls: 'dw-card-tag--warmup' },
    skill:        { label: 'Skill',        cls: 'dw-card-tag--skill' },
    conditioning: { label: 'Conditioning', cls: 'dw-card-tag--conditioning' }
  };

  var FOCUS_ICONS = {
    'Shooting':      '🎯',
    'Ball Handling':  '⚡',
    'Defense':        '🛡️',
    'Finishing':      '🔥',
    'Conditioning':   '💪',
    'Strength':       '🏋️'
  };

  /* ── Helpers ──────────────────────────────────────────────── */
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function pickRandom(arr, n) {
    return shuffle(arr).slice(0, n);
  }

  /* ── Load / Save ─────────────────────────────────────────── */
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data.date !== todayKey()) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function save(workout) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(workout));
    } catch (e) { /* silent */ }
  }

  /* ── Generate ────────────────────────────────────────────── */
  function generate(forceNew) {
    if (!forceNew) {
      var cached = load();
      if (cached) return cached;
    }

    var db = typeof _DRILLS_DB !== 'undefined' ? _DRILLS_DB : [];
    if (db.length === 0) return null;

    // Read player profile for personalization
    var profile = null;
    if (typeof PlayerProfile !== 'undefined') {
      profile = PlayerProfile.load();
    }

    var posCode = (profile && profile.position) ? profile.position : null;
    var skillLevel = (profile && profile.skillLevel) ? profile.skillLevel : null;
    var primaryGoal = (profile && profile.primaryGoal) ? profile.primaryGoal : null;

    // Filter by position if available
    function matchPos(drill) {
      if (!posCode) return true;
      return drill.positions.indexOf(posCode) !== -1;
    }

    // Filter by difficulty proximity
    function matchSkill(drill) {
      if (!skillLevel) return true;
      var order = { Beginner: 1, Intermediate: 2, Advanced: 3 };
      var target = order[skillLevel] || 2;
      var drillLvl = order[drill.difficulty] || 2;
      return Math.abs(target - drillLvl) <= 1;
    }

    // 1. Warmup: pick from Conditioning (lighter drills)
    var warmupPool = db.filter(function (d) {
      return d.focus_area === 'Conditioning' && matchPos(d) && matchSkill(d);
    });
    if (warmupPool.length === 0) {
      warmupPool = db.filter(function (d) { return d.focus_area === 'Conditioning'; });
    }
    var warmup = pickRandom(warmupPool, 1);

    // 2. Skill drills: use primary goal if set, else player's strongest areas
    var skillGoal = primaryGoal || 'Shooting';
    var skillPool = db.filter(function (d) {
      return d.focus_area === skillGoal && matchPos(d) && matchSkill(d);
    });
    if (skillPool.length < 2) {
      skillPool = db.filter(function (d) { return d.focus_area === skillGoal; });
    }
    // Exclude warmup drill
    var warmupIds = warmup.map(function (d) { return d.id; });
    skillPool = skillPool.filter(function (d) { return warmupIds.indexOf(d.id) === -1; });
    var skills = pickRandom(skillPool, 2);

    // 3. Conditioning: pick from Conditioning or Strength
    var usedIds = warmupIds.concat(skills.map(function (d) { return d.id; }));
    var condPool = db.filter(function (d) {
      return (d.focus_area === 'Conditioning' || d.focus_area === 'Strength') &&
        matchPos(d) && usedIds.indexOf(d.id) === -1;
    });
    if (condPool.length === 0) {
      condPool = db.filter(function (d) {
        return (d.focus_area === 'Conditioning' || d.focus_area === 'Strength') &&
          usedIds.indexOf(d.id) === -1;
      });
    }
    var cond = pickRandom(condPool, 1);

    // Build workout object
    var drills = [];
    warmup.forEach(function (d) { drills.push({ type: 'warmup', drill: d }); });
    skills.forEach(function (d) { drills.push({ type: 'skill', drill: d }); });
    cond.forEach(function (d) { drills.push({ type: 'conditioning', drill: d }); });

    var totalMin = 0;
    drills.forEach(function (item) { totalMin += item.drill.duration_minutes || 0; });

    var workout = {
      date: todayKey(),
      drills: drills,
      totalMinutes: totalMin
    };

    save(workout);
    return workout;
  }

  /* ── Render ──────────────────────────────────────────────── */
  function render(workout) {
    var grid = document.getElementById('daily-workout-grid');
    var totals = document.getElementById('daily-workout-totals');
    var dateEl = document.getElementById('daily-workout-date');

    if (!grid || !workout || !workout.drills) return;

    // Date display
    if (dateEl) {
      var d = new Date();
      dateEl.textContent = d.toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric'
      });
    }

    // Cards
    grid.innerHTML = workout.drills.map(function (item) {
      var drill = item.drill;
      var tag = TAG_MAP[item.type] || TAG_MAP.skill;
      var icon = FOCUS_ICONS[drill.focus_area] || '🏀';

      // Truncate description
      var desc = drill.description || '';
      if (desc.length > 100) desc = desc.substring(0, 97) + '…';

      return '<div class="dw-card">' +
        '<div class="dw-card-tag ' + tag.cls + '">' + tag.label + '</div>' +
        '<div class="dw-card-name">' + drill.name + '</div>' +
        '<div class="dw-card-desc">' + desc + '</div>' +
        '<div class="dw-card-meta">' +
          '<span>⏱ ' + drill.duration_minutes + ' min</span>' +
          '<span>' + icon + ' ' + drill.focus_area + '</span>' +
          '<span>' + drill.difficulty + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    // Totals
    if (totals) {
      totals.innerHTML =
        '<span>🏀 <strong>' + workout.drills.length + ' drills</strong> today</span>' +
        '<span>⏱ <strong>' + workout.totalMinutes + ' min</strong> total</span>' +
        '<span>📋 1 warmup · 2 skill · 1 conditioning</span>';
    }
  }

  /* ── Refresh ─────────────────────────────────────────────── */
  function refresh() {
    var workout = generate(true);
    render(workout);
    if (typeof showToast === 'function') {
      showToast('New workout generated');
    }
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    var workout = generate(false);
    render(workout);

    var btn = document.getElementById('daily-workout-refresh');
    if (btn) {
      btn.addEventListener('click', refresh);
    }
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DailyWorkout = { generate: generate, render: render, refresh: refresh };
})();
