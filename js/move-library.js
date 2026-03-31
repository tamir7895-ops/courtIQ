/* ============================================================
   PRO MOVES LIBRARY — /js/move-library.js
   Renders move cards, handles modal open/close, starts
   canvas animations via MoveAnimations wrapper.
   Lazy-initializes on first tab visit.
   ============================================================ */
(function () {
  'use strict';

  var _cardAnims = [];
  var _filter    = 'all';
  var _search    = '';

  /* ── Archetype → recommended focuses ─────────────────────── */
  var ARCH_FOCUS = {
    scorer:      ['shooting'],
    playmaker:   ['ball-handling', 'finishing'],
    defender:    ['defense'],
    'two-way':   ['shooting', 'defense', 'finishing'],
    'rim-runner':['finishing', 'post']
  };
  function getArch() {
    try { return JSON.parse(localStorage.getItem('courtiq-archetype') || '{}').key || ''; } catch(e) { return ''; }
  }

  /* ── Move Data (15 moves) ───────────────────────────────── */
  var MOVES = [
    { id:'move_stepback_01',  move_name:'Elite Stepback',        description:'Create space from the defender with a quick backward step before the shot.',                             inspired_by_player:'Stephen Curry',       skill_level:'Intermediate', training_drill:'Perform 10 stepback jumpers from the wing. Focus on balance and quick release. 5 from the left wing, 5 from the right.',           icon:'\ud83c\udfaf', focus:'shooting'      },
    { id:'move_crossover_01', move_name:'Pro Crossover',         description:'Shift the ball quickly between hands to break down the defender.',                                       inspired_by_player:'Kyrie Irving',        skill_level:'Advanced',     training_drill:'Practice 20 crossovers at full speed, alternating stationary and in-motion. Add a finishing move after every 5th crossover.',        icon:'\u26a1',       focus:'ball-handling' },
    { id:'move_fadeaway_01',  move_name:'Fadeaway Jumper',       description:'Elevate and lean away from the defender while maintaining shooting form.',                               inspired_by_player:'Kobe Bryant',         skill_level:'Advanced',     training_drill:'Shoot 15 fadeaway jumpers from the mid-post. Create separation with footwork before elevating. Maintain a high release point.',      icon:'\ud83d\udd25', focus:'shooting'      },
    { id:'move_eurostep_01',  move_name:'Power Euro Step',       description:'Drive to the basket with a lateral two-step gather to evade shot-blockers.',                            inspired_by_player:'Giannis Antetokounmpo',skill_level:'Intermediate',training_drill:'Run 10 euro step finishes from each side. Start from the three-point line, attack at full speed, and finish with either hand.',    icon:'\ud83d\udcaa', focus:'finishing'     },
    { id:'move_pullup_01',    move_name:'Quick Pull-Up',         description:'Stop on a dime from a full-speed dribble and rise into a mid-range jumper.',                            inspired_by_player:'Damian Lillard',      skill_level:'Advanced',     training_drill:'12 pull-up jumpers off the dribble from the elbow and free-throw line. Attack at game speed, plant hard, and rise quickly.',        icon:'\ud83c\udfaf', focus:'shooting'      },
    { id:'move_hesitation_01',move_name:'Hesitation Dribble',    description:'Freeze the defender with a sudden pause before exploding past them.',                                    inspired_by_player:'Allen Iverson',       skill_level:'Intermediate', training_drill:'Dribble at half speed toward a cone, pause, then explode past it at full speed. Exaggerate the stop. Repeat 15 times each side.',   icon:'\u26a1',       focus:'ball-handling' },
    { id:'move_spinmove_01',  move_name:'Spin Move',             description:'Pivot 360 degrees away from pressure to create a clean lane to the basket.',                            inspired_by_player:'Dwyane Wade',         skill_level:'Advanced',     training_drill:'Attack the lane, initiate the spin at the charge circle. Complete 10 spin layups going right and 10 going left. Protect the ball.',  icon:'\ud83d\udd04', focus:'finishing'     },
    { id:'move_floater_01',   move_name:'High Floater',          description:'A soft-touch runner that arcs over shot-blockers in the lane.',                                         inspired_by_player:'Tony Parker',         skill_level:'Intermediate', training_drill:'Drive from the wing, release a high-arc floater at the charge circle. Practice 10 floaters from each side at game speed.',           icon:'\ud83c\udf1f', focus:'finishing'     },
    { id:'move_dropstep_01',  move_name:'Drop Step',             description:'Catch in the post, read the defender, then drop-step to the baseline for a power finish.',             inspired_by_player:'Shaquille ONeal',     skill_level:'Beginner',     training_drill:'Catch on the block, seal the defender, and drop-step to finish. 5 sets of 4 reps each side. Focus on the pivot foot.',              icon:'\ud83d\udcaa', focus:'post'          },
    { id:'move_dreamshake_01',move_name:'Dream Shake',           description:'A series of jab steps and pivots in the post to completely disorient the defender.',                    inspired_by_player:'Hakeem Olajuwon',     skill_level:'Advanced',     training_drill:'Mid-post jab step baseline, pivot back to the middle, rise for the turnaround jumper. Footwork precision is key. 10 reps each side.', icon:'\ud83d\udd2e', focus:'post'          },
    { id:'move_stepback3_01', move_name:'Step-Back 3',           description:'Create distance from the three-point line with a hard retreat dribble before rising.',                  inspired_by_player:'James Harden',        skill_level:'Advanced',     training_drill:'Drive one dribble from the arc, kick back into step-back position and shoot. Work left wing, top of key, and right wing.',            icon:'\ud83c\udfaf', focus:'shooting'      },
    { id:'move_midrange_01',  move_name:'Mid-Range Off Dribble', description:'Attack the mid-range with a pull-up jumper off the dribble from any angle.',                           inspired_by_player:'Kevin Durant',        skill_level:'Intermediate', training_drill:'Drive to the mid-range area and pull up — 5 shots from each elbow and the free-throw line at game speed.',                         icon:'\ud83d\udd25', focus:'shooting'      },
    { id:'move_defensive_01', move_name:'Defensive Lock',        description:'Maintain stance and deny your man the ball with active hands and quick feet.',                          inspired_by_player:'Kawhi Leonard',       skill_level:'Intermediate', training_drill:'Shadow your partner for 30-second intervals. Stay in front, mirror every cut. 6 rounds with 15-second rest. No crossing feet.',      icon:'\ud83d\udee1\ufe0f', focus:'defense'  },
    { id:'move_closeout_01',  move_name:'Closeout and Contest',  description:'Sprint to contest a shooter — stop under control and get a hand up without fouling.',                  inspired_by_player:'Draymond Green',      skill_level:'Beginner',     training_drill:'Start under the basket. Partner spots up at the three-point line. Sprint closeout, chop steps 8 feet out, contest one hand high. 10 reps each side.', icon:'\ud83c\udfe0', focus:'defense' },
    { id:'move_lobfinish_01', move_name:'Lob Finish',            description:'Catch above the rim on a lob pass and finish with authority.',                                         inspired_by_player:'DeAndre Jordan',      skill_level:'Beginner',     training_drill:'Catch passes at rim height and finish on both sides — regular and reverse layups. Two-foot takeoffs and body control. 5 finishes each side.', icon:'\ud83d\ude4c', focus:'finishing' }
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
    for (var i = 0; i < MOVES.length; i++) { if (MOVES[i].id === id) return MOVES[i]; }
    return null;
  }
  function isForYou(m) { var f = ARCH_FOCUS[getArch()]; return !!(f && f.indexOf(m.focus) !== -1); }
  function filteredMoves() {
    var rec = [], rest = [], term = _search.toLowerCase().trim();
    MOVES.forEach(function(m) {
      if (_filter !== 'all' && m.focus !== _filter) return;
      if (term && m.move_name.toLowerCase().indexOf(term) === -1 && m.inspired_by_player.toLowerCase().indexOf(term) === -1) return;
      if (isForYou(m)) rec.push(m); else rest.push(m);
    });
    return rec.concat(rest);
  }

  /* ── Controls (search + filter bar) ────────────────────── */
  function renderControls() {
    var header = document.querySelector('#db-panel-moves .mv-header');
    if (!header || document.getElementById('mv-search-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'mv-search-bar';
    bar.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;align-items:center;';
    var inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = 'Search moves or players\u2026'; inp.id = 'mv-search-input';
    inp.style.cssText = 'flex:1;min-width:150px;padding:8px 14px;border-radius:12px;border:1px solid rgba(255,182,147,0.2);background:rgba(255,255,255,0.06);color:#fff;font-size:13px;outline:none;';
    inp.addEventListener('input', function() { _search = inp.value; renderCards(); });
    var bg = document.createElement('div');
    bg.id = 'mv-filter-btns'; bg.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
    [['all','All'],['shooting','\ud83c\udfaf Shoot'],['ball-handling','\u26a1 Handles'],['finishing','\ud83d\udcaa Finish'],['defense','\ud83d\udee1\ufe0f Defense'],['post','\ud83c\udfc0 Post']].forEach(function(f) {
      var btn = document.createElement('button');
      btn.textContent = f[1]; btn.dataset.filter = f[0];
      btn.style.cssText = 'padding:5px 11px;border-radius:20px;border:1px solid rgba(255,182,147,0.25);background:'+(f[0]===_filter?'rgba(255,182,147,0.15)':'transparent')+';color:'+(f[0]===_filter?'#ffb693':'rgba(229,226,225,0.6)')+';font-size:11px;cursor:pointer;white-space:nowrap;';
      btn.addEventListener('click', function() {
        _filter = f[0];
        document.querySelectorAll('#mv-filter-btns button').forEach(function(b) {
          var a = b.dataset.filter === _filter;
          b.style.background = a ? 'rgba(255,182,147,0.15)' : 'transparent';
          b.style.color = a ? '#ffb693' : 'rgba(229,226,225,0.6)';
        });
        renderCards();
      });
      bg.appendChild(btn);
    });
    bar.appendChild(inp); bar.appendChild(bg); header.appendChild(bar);
  }

  /* ── Render Cards ──────────────────────────────────────── */
  function renderCards() {
    var grid = document.getElementById('moves-grid');
    if (!grid) return;
    var moves = filteredMoves();
    if (!moves.length) {
      grid.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(229,226,225,0.4);font-size:14px">No moves match your search.</div>';
      return;
    }
    var html = '';
    moves.forEach(function(m) {
      var badge = isForYou(m) ? '<span style="background:rgba(255,182,147,0.15);color:#ffb693;font-size:9px;font-weight:700;letter-spacing:0.1em;padding:2px 8px;border-radius:10px;border:1px solid rgba(255,182,147,0.3);">\u2b50 FOR YOU</span>' : '';
      html += '<div class="mv-card" data-move-id="' + m.id + '">' +
        '<div class="mv-card-anim"><canvas class="mv-card-canvas" width="280" height="176"></canvas></div>' +
        '<div class="mv-card-body">' +
          '<div class="mv-card-top">' +
            '<div class="mv-card-icon">' + m.icon + '</div>' +
            '<div class="mv-card-info">' +
              '<div class="mv-card-name">' + m.move_name + ' ' + badge + '</div>' +
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
    });
    grid.innerHTML = html;
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

    // Award XP for engaging with a move
    if (typeof XPSystem !== 'undefined' && XPSystem.award) XPSystem.award(15, 'Move Practice');

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

  /* ── Init ──────────────────────────────────────────────── */
  function movesInit() {
    renderControls();
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
