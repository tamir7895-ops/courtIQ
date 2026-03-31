/* ============================================================
   NIGHT TRAINING — /js/night-training.js
   Evening recovery & skill-refinement drill overlay.
   Shows a modal with night drill cards and an animated star field.
   ============================================================ */
(function () {
  'use strict';

  /* ── Drill data ──────────────────────────────────────────── */
  var NIGHT_DRILLS = [
    { icon: '🎯', name: 'Form Shooting',    desc: '3 sets \u00d7 10 reps',        duration: '15 min', category: 'Shooting'  },
    { icon: '🏀', name: 'Ball Control',     desc: '4 stations \u00d7 45 sec',     duration: '10 min', category: 'Handles'   },
    { icon: '🧘', name: 'Recovery Stretch', desc: 'Full body cooldown',            duration: '8 min',  category: 'Recovery'  },
    { icon: '👁️', name: 'Mental Reps',      desc: 'Visualization drills',          duration: '5 min',  category: 'IQ'        },
    { icon: '💪', name: 'Core Stability',   desc: '3 circuits',                    duration: '12 min', category: 'Strength'  },
    { icon: '🎬', name: 'Film Study',       desc: 'Watch & annotate clips',        duration: '20 min', category: 'IQ'        }
  ];

  var STAR_COUNT = 20;
  var _starTimers = [];

  /* ── Helpers ──────────────────────────────────────────────── */
  function parseDuration(str) {
    var m = str.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function totalMinutes() {
    var sum = 0;
    for (var i = 0; i < NIGHT_DRILLS.length; i++) {
      sum += parseDuration(NIGHT_DRILLS[i].duration);
    }
    return sum;
  }

  /* ── Star animation ──────────────────────────────────────── */
  function buildStars() {
    var container = document.getElementById('nt-stars');
    if (!container) return;
    container.innerHTML = '';
    _clearStarTimers();

    for (var i = 0; i < STAR_COUNT; i++) {
      (function () {
        var star = document.createElement('div');
        star.className = 'nt-star';
        star.style.left = (Math.random() * 100) + '%';
        star.style.top  = (Math.random() * 100) + '%';
        star.style.opacity = '0.1';

        /* Stagger initial twinkle so stars don't all pulse together */
        var delay = Math.random() * 3000;
        var timer = setTimeout(function () {
          animateStar(star);
        }, delay);
        _starTimers.push(timer);

        container.appendChild(star);
      })();
    }
  }

  function animateStar(star) {
    star.style.opacity = (0.4 + Math.random() * 0.6).toFixed(2);
    var t1 = setTimeout(function () {
      star.style.opacity = (0.05 + Math.random() * 0.2).toFixed(2);
      var t2 = setTimeout(function () {
        animateStar(star);
      }, 800 + Math.random() * 1200);
      _starTimers.push(t2);
    }, 600 + Math.random() * 1400);
    _starTimers.push(t1);
  }

  function _clearStarTimers() {
    for (var i = 0; i < _starTimers.length; i++) {
      clearTimeout(_starTimers[i]);
    }
    _starTimers = [];
  }

  /* ── Render drills ───────────────────────────────────────── */
  function renderDrills() {
    var grid = document.getElementById('nt-grid');
    if (!grid) return;

    /* Build cards via DOM methods — no innerHTML with user data */
    grid.innerHTML = '';
    for (var i = 0; i < NIGHT_DRILLS.length; i++) {
      var d = NIGHT_DRILLS[i];

      var card    = document.createElement('div');
      card.className = 'nt-drill-card';

      var iconEl  = document.createElement('div');
      iconEl.className = 'nt-drill-icon';
      iconEl.textContent = d.icon;

      var info    = document.createElement('div');
      info.className = 'nt-drill-info';

      var nameEl  = document.createElement('div');
      nameEl.className = 'nt-drill-name';
      nameEl.textContent = d.name;

      var descEl  = document.createElement('div');
      descEl.className = 'nt-drill-desc';
      descEl.textContent = d.desc;

      info.appendChild(nameEl);
      info.appendChild(descEl);

      var meta    = document.createElement('div');
      meta.className = 'nt-drill-meta';

      var catEl   = document.createElement('span');
      catEl.className = 'nt-drill-cat';
      catEl.textContent = d.category;

      var durEl   = document.createElement('span');
      durEl.className = 'nt-drill-dur';
      durEl.textContent = d.duration;

      meta.appendChild(catEl);
      meta.appendChild(durEl);

      card.appendChild(iconEl);
      card.appendChild(info);
      card.appendChild(meta);

      grid.appendChild(card);
    }
  }

  /* ── Render totals ───────────────────────────────────────── */
  function renderTotals() {
    var el = document.getElementById('nt-totals');
    if (!el) return;
    el.textContent = NIGHT_DRILLS.length + ' drills \u00b7 ' + totalMinutes() + ' min total';
  }

  /* ── Open ────────────────────────────────────────────────── */
  function open() {
    var overlay = document.getElementById('nt-overlay');
    if (!overlay) return;

    renderDrills();
    renderTotals();
    buildStars();

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /* ── Close ───────────────────────────────────────────────── */
  function close() {
    var overlay = document.getElementById('nt-overlay');
    if (!overlay) return;

    overlay.classList.remove('active');
    document.body.style.overflow = '';
    _clearStarTimers();
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    var closeBtn = document.getElementById('nt-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }

    /* Close when clicking the backdrop (overlay itself, not the modal) */
    var overlay = document.getElementById('nt-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) { close(); }
      });
    }

    /* Close on Escape */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        var o = document.getElementById('nt-overlay');
        if (o && o.classList.contains('active')) { close(); }
      }
    });
  }

  /* Auto-init */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.NightTraining = { open: open, close: close };
})();
