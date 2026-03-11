/* ============================================================
   NIGHT TRAINING — /js/night-training.js
   Evening skill session: low-intensity, technical focus.
   No conditioning or strength — sleep-safe workload.
   ============================================================ */
(function () {
  'use strict';

  var NIGHT_FOCUS = ['Shooting', 'Ball Handling', 'Finishing'];

  var TAG_LABELS = {
    shooting:  '🎯 Shooting',
    handling:  '⚡ Ball Handling',
    finishing: '🔥 Finishing',
    mental:    '🧠 Mental Reps'
  };

  var STAR_DATA = [
    [8,12],[15,45],[25,8],[35,55],[45,20],[55,38],[65,10],[75,50],[85,22],[92,42],
    [12,72],[28,85],[42,65],[58,78],[72,88],[88,62],[5,92],[20,95],[50,90],[80,75],
    [33,30],[67,25],[78,68],[18,58],[60,90]
  ];

  /* ── Session Generator ───────────────────────────────────── */
  function generate() {
    var db = typeof _DRILLS_DB !== 'undefined' ? _DRILLS_DB : [];
    if (db.length === 0) return null;

    // Night pool: technical focus areas only, prefer shorter drills
    var pool = db.filter(function (d) {
      return NIGHT_FOCUS.indexOf(d.focus_area) !== -1;
    });

    // Personalize by position
    var profile = (typeof PlayerProfile !== 'undefined') ? PlayerProfile.load() : null;
    var posCode  = profile && profile.position;
    var positioned = posCode ? pool.filter(function (d) {
      return d.positions.indexOf(posCode) !== -1;
    }) : pool;
    if (positioned.length < 3) positioned = pool;

    // Shuffle and pick 3 drills
    var shuffled = positioned.slice().sort(function () { return Math.random() - 0.5; });
    var picked = shuffled.slice(0, 3);

    var drills = picked.map(function (d) {
      var type = d.focus_area === 'Shooting'      ? 'shooting'  :
                 d.focus_area === 'Ball Handling' ? 'handling'  : 'finishing';
      return { type: type, drill: d };
    });

    // Always add a mental reps card at the end
    drills.push({
      type: 'mental',
      drill: {
        id: 'nt-mental',
        name: 'Visualization & Mental Reps',
        description: 'Close your eyes. Replay every drill in your mind at full speed with perfect form. See the ball going in. This is where champions are made.',
        duration_minutes: 5,
        reps_or_sets: '5 min',
        difficulty: 'Beginner',
        focus_area: 'Mental',
        equipment_needed: []
      }
    });

    var total = drills.reduce(function (sum, item) {
      return sum + (item.drill.duration_minutes || 0);
    }, 0);

    return { drills: drills, totalMinutes: total };
  }

  /* ── Stars ───────────────────────────────────────────────── */
  function renderStars(container) {
    container.innerHTML = STAR_DATA.map(function (pos, i) {
      var opacity  = (0.1 + Math.random() * 0.45).toFixed(2);
      var delay    = (i * 0.19).toFixed(2);
      var duration = (1.5 + Math.random() * 1.8).toFixed(2);
      return '<div class="nt-star" style="left:' + pos[0] + '%;top:' + pos[1] +
             '%;opacity:' + opacity + ';animation-delay:' + delay +
             's;animation-duration:' + duration + 's;"></div>';
    }).join('');
  }

  /* ── Render ──────────────────────────────────────────────── */
  function render(session) {
    var grid   = document.getElementById('nt-grid');
    var totals = document.getElementById('nt-totals');
    var stars  = document.getElementById('nt-stars');

    if (!grid || !totals) return;
    if (stars) renderStars(stars);

    grid.innerHTML = session.drills.map(function (item) {
      var d = item.drill;
      var label = TAG_LABELS[item.type] || '🏀 Skill';
      var cls   = 'nt-card-tag--' + item.type;
      var desc  = (d.description || '');
      if (desc.length > 110) desc = desc.substring(0, 107) + '\u2026';

      return '<div class="nt-card">' +
        '<div class="nt-card-tag ' + cls + '">' + label + '</div>' +
        '<div class="nt-card-name">' + d.name + '</div>' +
        '<div class="nt-card-desc">' + desc + '</div>' +
        '<div class="nt-card-meta">' +
          '<span>\u23f1 ' + d.duration_minutes + ' min</span>' +
          (d.reps_or_sets ? '<span>' + d.reps_or_sets + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    var drillCount = session.drills.length - 1; // exclude mental card
    totals.innerHTML =
      '<span>\uD83C\uDF19 <strong>' + drillCount + ' drills</strong> + visualization</span>' +
      '<span>\u23f1 <strong>' + session.totalMinutes + ' min</strong> total</span>' +
      '<span>\uD83D\uDCA4 Sleep-safe intensity</span>';
  }

  /* ── Open / Close ────────────────────────────────────────── */
  function open() {
    var session = generate();
    if (!session) return;
    render(session);
    var overlay = document.getElementById('nt-overlay');
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function close() {
    var overlay = document.getElementById('nt-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ── Init ────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var overlay  = document.getElementById('nt-overlay');
    var closeBtn = document.getElementById('nt-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay)  overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  });

  window.NightTraining = { open: open, close: close };
})();
