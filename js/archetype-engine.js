/* ============================================================
   BASKETBALL ARCHETYPE ENGINE — /js/archetype-engine.js
   Analyzes playstyle inputs and assigns a basketball archetype.
   Stores result in localStorage. Lazy-initializes on tab visit.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'courtiq-archetype';
  var _initialized = false;

  /* ── Archetype Definitions ───────────────────────────────── */
  var ARCHETYPES = {
    sharpshooter: {
      name: 'Sharpshooter',
      icon: '🎯',
      description: 'Elite outside shooting and off-ball movement. You thrive on spacing the floor, relocating to open spots, and punishing defenses that leave you open. Your gravity pulls defenders out, creating lanes for teammates.',
      training_focus: ['Spot-up shooting', 'Footwork & balance', 'Quick release', 'Off-ball movement', 'Catch-and-shoot'],
      drills: [
        { icon: '🎯', name: 'Spot-up shooting — 5 spots, 4 shots each' },
        { icon: '🏃', name: 'Off-screen curl shooting — 10 reps each side' },
        { icon: '⚡', name: 'Quick release drill — catch and shoot in under 1 second' },
        { icon: '🔥', name: 'Movement shooting — 3 dribble pull-ups from each wing' }
      ],
      inspirations: ['Stephen Curry', 'Klay Thompson', 'Ray Allen']
    },
    floor_general: {
      name: 'Floor General',
      icon: '🧠',
      description: 'Primary ball handler and elite playmaker. You see the floor better than anyone, control tempo, and make everyone around you better. Your court vision and decision-making are your greatest weapons.',
      training_focus: ['Ball handling', 'Court vision', 'Pick-and-roll reads', 'Passing accuracy', 'Tempo control'],
      drills: [
        { icon: '⚡', name: 'Two-ball dribbling — 3 min stationary, 3 min moving' },
        { icon: '🎯', name: 'Pick-and-roll reads — 10 reps with live defense' },
        { icon: '🏀', name: 'Full-court passing accuracy — hit targets at 3 distances' },
        { icon: '🧠', name: 'Decision-making drill — 2-on-1 and 3-on-2 scenarios' }
      ],
      inspirations: ['Chris Paul', 'Magic Johnson', 'Steve Nash']
    },
    shot_creator: {
      name: 'Shot Creator',
      icon: '🔥',
      description: 'Creates scoring opportunities off the dribble with an arsenal of moves. You can break down any defender one-on-one and score from all three levels. Iso situations are where you dominate.',
      training_focus: ['Iso moves', 'Mid-range game', 'Dribble combos', 'Step-back shooting', 'Finishing through contact'],
      drills: [
        { icon: '🔥', name: 'Iso series — jab step, crossover, step-back combos' },
        { icon: '🎯', name: 'Mid-range pull-ups — 15 shots from elbow and baseline' },
        { icon: '⚡', name: 'Dribble combo chains — 3-move sequences at game speed' },
        { icon: '💪', name: 'Contact finishing — layups through pad contact' }
      ],
      inspirations: ['Kobe Bryant', 'Kevin Durant', 'Devin Booker']
    },
    two_way_wing: {
      name: 'Two-Way Wing',
      icon: '🛡️',
      description: 'Balanced offense and lockdown defense. You guard the best player on the opposing team while contributing on offense with versatile scoring. Your motor and IQ make you indispensable.',
      training_focus: ['Defensive footwork', 'Transition offense', 'Wing scoring', 'Rebounding', 'Switching versatility'],
      drills: [
        { icon: '🛡️', name: 'Closeout and contest — 20 reps from help position' },
        { icon: '🏃', name: 'Transition 1-on-1 — full court attack and defend' },
        { icon: '🎯', name: 'Catch-and-shoot 3s — 5 spots around the arc' },
        { icon: '💪', name: 'Rebounding box-out drill — 10 reps each side' }
      ],
      inspirations: ['Kawhi Leonard', 'Jimmy Butler', 'Scottie Pippen']
    },
    rim_attacker: {
      name: 'Rim Attacker',
      icon: '💥',
      description: 'Explosive drives and elite finishing at the rim. You attack the basket with speed and power, drawing fouls and converting tough finishes. The paint is your territory.',
      training_focus: ['Driving & finishing', 'Euro steps', 'Floaters', 'Free throw shooting', 'First-step explosiveness'],
      drills: [
        { icon: '💥', name: 'Euro step finishes — 10 from each side at full speed' },
        { icon: '🏀', name: 'Floater practice — 15 reps from the lane' },
        { icon: '🏃', name: 'First-step explosion — cone drills to attack closeouts' },
        { icon: '🎯', name: 'Free throw routine — 50 shots with game-simulation rest' }
      ],
      inspirations: ['Giannis Antetokounmpo', 'Ja Morant', 'Dwyane Wade']
    },
    defensive_anchor: {
      name: 'Defensive Anchor',
      icon: '🏰',
      description: 'Interior defense, rim protection, and dominant rebounding. You control the paint, alter shots, and anchor the defense. Your presence alone changes how opponents attack.',
      training_focus: ['Shot blocking', 'Post defense', 'Rebounding', 'Help defense', 'Pick-and-roll coverage'],
      drills: [
        { icon: '🛡️', name: 'Shot contest drill — close out and vertical on 15 attempts' },
        { icon: '💪', name: 'Rebounding circuit — offensive and defensive boards, 10 each' },
        { icon: '🏃', name: 'Help and recover — rotate from weak side, contest, recover' },
        { icon: '🏰', name: 'Post defense 1-on-1 — deny position for 10 possessions' }
      ],
      inspirations: ['Rudy Gobert', 'Tim Duncan', 'Dikembe Mutombo']
    }
  };

  /* ── Matching Logic ──────────────────────────────────────── */
  function determineArchetype(height, position, playstyle) {
    var h = parseInt(height, 10) || 72;

    /* Primary: playstyle drives the archetype */
    var playstyleMap = {
      'shooter':    'sharpshooter',
      'playmaker':  'floor_general',
      'slasher':    'rim_attacker',
      'defender':   'two_way_wing',
      'all-around': 'shot_creator'
    };

    var base = playstyleMap[playstyle] || 'shot_creator';

    /* Secondary: position + height can override */
    if (playstyle === 'defender') {
      if ((position === 'C' || position === 'PF') && h >= 78) {
        base = 'defensive_anchor';
      }
    }

    if (playstyle === 'all-around') {
      if (position === 'PG') base = 'floor_general';
      if (position === 'SF' || position === 'SG') base = 'two_way_wing';
      if (position === 'C' && h >= 80) base = 'defensive_anchor';
    }

    if (playstyle === 'shooter' && (position === 'PG') && h < 74) {
      /* Small PG shooter → still sharpshooter but could lean floor general */
      base = 'sharpshooter';
    }

    if (playstyle === 'slasher' && (position === 'PG' || position === 'SG') && h < 76) {
      base = 'shot_creator'; /* smaller slashers need shot creation */
    }

    return base;
  }

  /* ── Render ──────────────────────────────────────────────── */
  function renderResult(archetypeKey) {
    var a = ARCHETYPES[archetypeKey];
    if (!a) return;

    var result = document.getElementById('at-result');
    var empty = document.getElementById('at-empty');
    if (!result) return;

    // Build focus tags
    var focusHTML = a.training_focus.map(function (f) {
      return '<span class="at-focus-tag">▹ ' + f + '</span>';
    }).join('');

    // Build drills
    var drillsHTML = a.drills.map(function (d) {
      return '<div class="at-drill-item">' +
        '<span class="at-drill-icon">' + d.icon + '</span>' +
        '<span class="at-drill-name">' + d.name + '</span>' +
      '</div>';
    }).join('');

    // Build inspirations
    var inspHTML = a.inspirations.map(function (p) {
      return '<span class="at-insp-tag">⭐ ' + p + '</span>';
    }).join('');

    result.innerHTML =
      '<div class="at-result-header">' +
        '<div class="at-result-icon">' + a.icon + '</div>' +
        '<div>' +
          '<div class="at-result-label">Your Archetype</div>' +
          '<div class="at-result-name">' + a.name + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="at-result-desc">' + a.description + '</div>' +
      '<div class="at-section-title">Training Focus</div>' +
      '<div class="at-focus-tags">' + focusHTML + '</div>' +
      '<div class="at-section-title">Recommended Drills</div>' +
      '<div class="at-drills-list">' + drillsHTML + '</div>' +
      '<div class="at-inspirations">' +
        '<div class="at-section-title">Player Inspirations</div>' +
        '<div class="at-insp-label">Inspired by playing styles similar to:</div>' +
        '<div class="at-insp-list">' + inspHTML + '</div>' +
      '</div>' +
      '<div class="at-disclaimer">Player comparisons are for inspiration only. CourtIQ is not affiliated with any professional players or leagues.</div>';

    result.classList.add('active');
    if (empty) empty.style.display = 'none';
  }

  /* ── Submit ──────────────────────────────────────────────── */
  function submit() {
    var heightEl   = document.getElementById('at-height');
    var positionEl = document.getElementById('at-position');
    var styleEl    = document.getElementById('at-playstyle');
    var errorEl    = document.getElementById('at-error');

    if (!heightEl || !positionEl || !styleEl) return;

    var height    = heightEl.value.trim();
    var position  = positionEl.value;
    var playstyle = styleEl.value;

    // Validate
    if (errorEl) errorEl.textContent = '';

    if (!height || isNaN(height) || parseInt(height, 10) < 48 || parseInt(height, 10) > 96) {
      if (errorEl) errorEl.textContent = 'Enter a valid height (48–96 inches).';
      return;
    }
    if (!position) {
      if (errorEl) errorEl.textContent = 'Select your position.';
      return;
    }
    if (!playstyle) {
      if (errorEl) errorEl.textContent = 'Select your playstyle.';
      return;
    }

    var archetypeKey = determineArchetype(height, position, playstyle);

    // Save to localStorage
    var data = {
      height: parseInt(height, 10),
      position: position,
      playstyle: playstyle,
      archetype: archetypeKey,
      ts: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    renderResult(archetypeKey);

    // Grant XP
    if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
      XPSystem.grantXP(25, 'Archetype Discovered');
    }
  }

  /* ── Load saved result ───────────────────────────────────── */
  function loadSaved() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && data.archetype && ARCHETYPES[data.archetype]) {
        // Restore form values
        var h = document.getElementById('at-height');
        var p = document.getElementById('at-position');
        var s = document.getElementById('at-playstyle');
        if (h) h.value = data.height;
        if (p) p.value = data.position;
        if (s) s.value = data.playstyle;

        renderResult(data.archetype);
      }
    } catch (_) { /* no saved data */ }
  }

  /* ── Init (lazy) ─────────────────────────────────────────── */
  function archetypeInit() {
    if (_initialized) return;
    _initialized = true;

    // Bind submit
    var btn = document.getElementById('at-submit-btn');
    if (btn) btn.addEventListener('click', submit);

    // Load any saved result
    loadSaved();
  }

  /* ── Expose ──────────────────────────────────────────────── */
  window.archetypeInit = archetypeInit;
  window.ArchetypeEngine = {
    init: archetypeInit,
    submit: submit,
    ARCHETYPES: ARCHETYPES,
    determine: determineArchetype
  };
})();
