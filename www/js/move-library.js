/* ============================================================
   PRO MOVES LIBRARY — /js/move-library.js
   Renders move cards, handles modal open/close, starts
   canvas animations via MoveAnimations wrapper.
   Lazy-initializes on first tab visit.
   ============================================================ */
(function () {
  'use strict';

  var _initialized = false;
  var _cardAnims = [];   // track card canvas animation handles

  /* ── Move Data ─────────────────────────────────────────── */
  var MOVES = [
    {
      id: 'move_stepback_01',
      move_name: 'Elite Stepback',
      description: 'Create space from the defender with a quick backward step before the shot.',
      inspired_by_player: 'Stephen Curry',
      skill_level: 'Intermediate',
      training_drill: 'Perform 10 stepback jumpers from the wing after a dribble move. Focus on balance and quick release. Alternate sides — 5 from the left wing, 5 from the right.',
      icon: '🎯',
      focus: 'shooting'
    },
    {
      id: 'move_crossover_01',
      move_name: 'Pro Crossover',
      description: 'Shift the ball quickly between hands to break down the defender.',
      inspired_by_player: 'Kyrie Irving',
      skill_level: 'Advanced',
      training_drill: 'Practice 20 crossovers at full speed, alternating between stationary and in-motion. Keep the ball low and snap it across your body. Add a finishing move (layup or pull-up) after every 5th crossover.',
      icon: '⚡',
      focus: 'ball-handling'
    },
    {
      id: 'move_fadeaway_01',
      move_name: 'Fadeaway Jumper',
      description: 'Elevate and lean away from the defender while maintaining shooting form.',
      inspired_by_player: 'Kobe Bryant',
      skill_level: 'Advanced',
      training_drill: 'Shoot 15 fadeaway jumpers from the mid-post, alternating baseline and middle. Focus on creating separation with your footwork before elevating. Maintain a high release point.',
      icon: '🔥',
      focus: 'shooting'
    },
    {
      id: 'move_eurostep_01',
      move_name: 'Power Euro Step',
      description: 'Drive to the basket with a lateral two-step gather to evade shot-blockers.',
      inspired_by_player: 'Giannis Antetokounmpo',
      skill_level: 'Intermediate',
      training_drill: 'Run 10 euro step finishes from each side, focusing on wide lateral steps. Start from the three-point line, attack at full speed, and finish with either hand at the rim.',
      icon: '💪',
      focus: 'finishing'
    },
    {
      id: 'move_pullup_01',
      move_name: 'Quick Pull-Up',
      description: 'Stop on a dime from a full-speed dribble and rise into a mid-range jumper.',
      inspired_by_player: 'Damian Lillard',
      skill_level: 'Advanced',
      training_drill: 'Perform 12 pull-up jumpers off the dribble from the elbow and free-throw line. Attack at game speed, plant hard, and rise quickly. Alternate between going right and going left.',
      icon: '🎯',
      focus: 'shooting'
    }
  ];

  /* ── Helpers ────────────────────────────────────────────── */
  function skillClass(level) {
    return level.toLowerCase();
  }

  function focusLabel(focus) {
    if (focus === 'ball-handling') return 'Ball Handling';
    return focus.charAt(0).toUpperCase() + focus.slice(1);
  }

  function getMoveById(id) {
    for (var i = 0; i < MOVES.length; i++) {
      if (MOVES[i].id === id) return MOVES[i];
    }
    return null;
  }

  /* ── Render Cards ──────────────────────────────────────── */
  function renderCards() {
    var grid = document.getElementById('moves-grid');
    if (!grid) return;

    grid.innerHTML = MOVES.map(function (m) {
      return '<div class="mv-card" data-move-id="' + m.id + '">' +
        '<div class="mv-card-anim">' +
          '<canvas class="mv-card-canvas" width="280" height="176"></canvas>' +
        '</div>' +
        '<div class="mv-card-body">' +
          '<div class="mv-card-top">' +
            '<div class="mv-card-icon">' + m.icon + '</div>' +
            '<div class="mv-card-info">' +
              '<div class="mv-card-name">' + m.move_name + '</div>' +
              '<div class="mv-card-desc">' + m.description + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mv-card-tags">' +
            '<span class="mv-inspired-tag">Inspired by ' + m.inspired_by_player + '</span>' +
            '<span class="mv-skill-badge ' + skillClass(m.skill_level) + '">' + m.skill_level + '</span>' +
            '<span class="mv-focus-tag ' + m.focus + '">' + focusLabel(m.focus) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="mv-card-actions">' +
          '<button class="mv-practice-btn" onclick="movesOpenModal(\'' + m.id + '\')">Practice This Move</button>' +
        '</div>' +
      '</div>';
    }).join('');

    // Start card animations
    startCardAnimations();
  }

  /* ── Card Animations ───────────────────────────────────── */
  function startCardAnimations() {
    stopCardAnimations();

    var canvases = document.querySelectorAll('#moves-grid .mv-card-canvas');
    for (var i = 0; i < canvases.length; i++) {
      var card = canvases[i].closest('.mv-card');
      var moveId = card ? card.getAttribute('data-move-id') : null;
      if (moveId && typeof MoveAnimations !== 'undefined') {
        var handle = MoveAnimations.playOnCanvas(canvases[i], moveId);
        if (handle) _cardAnims.push({ canvas: canvases[i], handle: handle });
      }
    }
  }

  function stopCardAnimations() {
    for (var i = 0; i < _cardAnims.length; i++) {
      if (_cardAnims[i].handle && _cardAnims[i].handle.stop) {
        _cardAnims[i].handle.stop();
      } else if (typeof MoveAnimations !== 'undefined') {
        MoveAnimations.stop(_cardAnims[i].canvas);
      }
    }
    _cardAnims = [];
  }

  /* ── Modal ─────────────────────────────────────────────── */
  function openModal(moveId) {
    var move = getMoveById(moveId);
    if (!move) return;

    var overlay = document.getElementById('mv-modal-overlay');
    if (!overlay) return;

    // Populate
    var title = document.getElementById('mv-modal-title');
    if (title) title.textContent = move.move_name;

    var inspired = document.getElementById('mv-modal-inspired');
    if (inspired) inspired.textContent = 'Inspired by ' + move.inspired_by_player;

    var drillText = document.getElementById('mv-modal-drill-text');
    if (drillText) drillText.textContent = move.training_drill;

    // Start animation on modal canvas
    var canvas = document.getElementById('mv-modal-canvas');
    if (canvas && typeof MoveAnimations !== 'undefined') {
      MoveAnimations.playOnCanvas(canvas, moveId);
    }

    // Show
    overlay.classList.add('active');
  }

  function closeModal() {
    var overlay = document.getElementById('mv-modal-overlay');
    if (overlay) overlay.classList.remove('active');

    // Stop modal animation
    var canvas = document.getElementById('mv-modal-canvas');
    if (canvas && typeof MoveAnimations !== 'undefined') {
      MoveAnimations.stop(canvas);
    }
  }

  /* ── Init (lazy) ───────────────────────────────────────── */
  function movesInit() {
    if (_initialized) return;
    _initialized = true;
    renderCards();
  }

  /* ── Bind modal close ──────────────────────────────────── */
  function bindModal() {
    var overlay = document.getElementById('mv-modal-overlay');
    if (!overlay) return;

    // Close on overlay click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    // Close button
    var closeBtn = overlay.querySelector('.mv-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    var closeBtnFooter = overlay.querySelector('.mv-modal-close-btn');
    if (closeBtnFooter) closeBtnFooter.addEventListener('click', closeModal);

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closeModal();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindModal);
  } else {
    bindModal();
  }

  // Expose globally
  window.movesInit = movesInit;
  window.movesOpenModal = openModal;
  window.MoveLibrary = {
    init: movesInit,
    openModal: openModal,
    closeModal: closeModal
  };
})();
