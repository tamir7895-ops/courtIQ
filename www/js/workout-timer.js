/* ============================================================
   WORKOUT TIMER — /js/workout-timer.js
   Self-contained drill timer modal for CourtIQ.
   Glass-morphism dark theme, amber accent.
   All DOM built with createElement (no innerHTML) for XSS safety.
   ============================================================ */
(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────────── */
  var BG       = 'rgba(14,16,20,0.95)';
  var GLASS    = 'rgba(255,255,255,0.06)';
  var GLASS_B  = 'rgba(255,255,255,0.10)';
  var AMBER    = '#f5a623';
  var AMBER_DIM = 'rgba(245,166,35,0.15)';
  var WHITE    = '#ffffff';
  var GREY     = '#8a8f98';
  var RED      = '#ff4d4d';
  var GREEN    = '#34d058';
  var REST_DEFAULT = 60;
  var REST_STEP    = 15;

  /* ── State ─────────────────────────────────────────────────── */
  var state = {
    phase: 'IDLE',        // IDLE | WORK | REST | COMPLETE
    currentSet: 0,
    totalSets: 1,
    restTime: REST_DEFAULT,
    restRemaining: 0,
    workElapsed: 0,        // seconds into current set
    paused: false,
    intervalId: null,
    drill: null
  };

  /* ── Refs (filled on first open) ───────────────────────────── */
  var overlay, modal;
  var elTitle, elFocus, elPhase, elDigits, elSetInfo;
  var btnPause, btnSkip, btnClose;
  var elRestControls, elRestVal;
  var built = false;

  /* ── Helpers ───────────────────────────────────────────────── */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return pad(m) + ':' + pad(s);
  }

  function parseSets(str) {
    if (!str) return 1;
    var m = str.match(/(\d+)\s*(sets?|circuits?|rounds?)/i);
    return m ? parseInt(m[1], 10) || 1 : 1;
  }

  function vibrate() {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }

  function sfxSuccess() {
    if (typeof SFX !== 'undefined' && SFX.success) SFX.success();
  }

  function sfxLevelUp() {
    if (typeof SFX !== 'undefined' && SFX.levelUp) SFX.levelUp();
  }

  function grantXP() {
    if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
      XPSystem.grantXP(15, 'Drill Timer Complete');
    }
  }

  /* ── DOM builder helpers ───────────────────────────────────── */
  function el(tag, styles, text) {
    var node = document.createElement(tag);
    if (styles) applyStyles(node, styles);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function applyStyles(node, obj) {
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) node.style[k] = obj[k];
    }
  }

  function btn(label, styles, onClick) {
    var b = el('button', Object.assign({
      border: 'none',
      borderRadius: '10px',
      padding: '12px 22px',
      fontSize: '13px',
      fontWeight: '700',
      cursor: 'pointer',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      transition: 'all 0.2s',
      fontFamily: 'inherit'
    }, styles), label);
    b.addEventListener('click', onClick);
    return b;
  }

  /* ── Build modal DOM ───────────────────────────────────────── */
  function buildUI() {
    if (built) return;
    built = true;

    // Overlay
    overlay = el('div', {
      position: 'fixed',
      top: '0', left: '0', right: '0', bottom: '0',
      background: BG,
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      zIndex: '99999',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    });

    // Modal container
    modal = el('div', {
      background: 'rgba(22,24,30,0.98)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '20px',
      padding: '36px 32px 28px',
      maxWidth: '400px',
      width: '90vw',
      textAlign: 'center',
      position: 'relative',
      boxShadow: '0 24px 80px rgba(0,0,0,0.6)'
    });

    // Close button (top-right)
    btnClose = el('button', {
      position: 'absolute',
      top: '14px', right: '14px',
      background: 'transparent',
      border: 'none',
      color: GREY,
      fontSize: '22px',
      cursor: 'pointer',
      lineHeight: '1',
      padding: '4px 8px',
      borderRadius: '6px',
      transition: 'color 0.2s'
    }, '\u2715');
    btnClose.addEventListener('click', closeTimer);
    btnClose.addEventListener('mouseenter', function () { btnClose.style.color = WHITE; });
    btnClose.addEventListener('mouseleave', function () { btnClose.style.color = GREY; });
    modal.appendChild(btnClose);

    // Title
    elTitle = el('div', {
      color: WHITE,
      fontSize: '18px',
      fontWeight: '700',
      marginBottom: '4px',
      lineHeight: '1.3'
    });
    modal.appendChild(elTitle);

    // Focus tag
    elFocus = el('div', {
      color: AMBER,
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: '24px'
    });
    modal.appendChild(elFocus);

    // Phase label
    elPhase = el('div', {
      color: GREY,
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      marginBottom: '8px'
    });
    modal.appendChild(elPhase);

    // Large digits
    elDigits = el('div', {
      color: WHITE,
      fontSize: '72px',
      fontWeight: '800',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: '1',
      marginBottom: '8px',
      letterSpacing: '-2px'
    }, '00:00');
    modal.appendChild(elDigits);

    // Set info
    elSetInfo = el('div', {
      color: GREY,
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '28px'
    });
    modal.appendChild(elSetInfo);

    // Rest time controls
    elRestControls = el('div', {
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      marginBottom: '20px'
    });

    var restLabel = el('span', {
      color: GREY,
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }, 'Rest');
    elRestControls.appendChild(restLabel);

    var btnMinus = btn('\u2212 15s', {
      background: GLASS,
      color: WHITE,
      padding: '6px 12px',
      fontSize: '11px'
    }, function () { adjustRest(-REST_STEP); });
    btnMinus.addEventListener('mouseenter', function () { btnMinus.style.background = GLASS_B; });
    btnMinus.addEventListener('mouseleave', function () { btnMinus.style.background = GLASS; });
    elRestControls.appendChild(btnMinus);

    elRestVal = el('span', {
      color: WHITE,
      fontSize: '15px',
      fontWeight: '700',
      minWidth: '40px',
      display: 'inline-block'
    }, REST_DEFAULT + 's');
    elRestControls.appendChild(elRestVal);

    var btnPlus = btn('+ 15s', {
      background: GLASS,
      color: WHITE,
      padding: '6px 12px',
      fontSize: '11px'
    }, function () { adjustRest(REST_STEP); });
    btnPlus.addEventListener('mouseenter', function () { btnPlus.style.background = GLASS_B; });
    btnPlus.addEventListener('mouseleave', function () { btnPlus.style.background = GLASS; });
    elRestControls.appendChild(btnPlus);

    modal.appendChild(elRestControls);

    // Action buttons row
    var actionRow = el('div', {
      display: 'flex',
      gap: '10px',
      justifyContent: 'center',
      flexWrap: 'wrap'
    });

    btnPause = btn('Pause', {
      background: GLASS,
      color: WHITE,
      flex: '1',
      maxWidth: '160px'
    }, togglePause);
    btnPause.addEventListener('mouseenter', function () { btnPause.style.background = GLASS_B; });
    btnPause.addEventListener('mouseleave', function () { btnPause.style.background = GLASS; });
    actionRow.appendChild(btnPause);

    btnSkip = btn('Skip Rest', {
      background: AMBER_DIM,
      color: AMBER,
      flex: '1',
      maxWidth: '160px',
      display: 'none'
    }, skipRest);
    btnSkip.addEventListener('mouseenter', function () { btnSkip.style.background = 'rgba(245,166,35,0.25)'; });
    btnSkip.addEventListener('mouseleave', function () { btnSkip.style.background = AMBER_DIM; });
    actionRow.appendChild(btnSkip);

    modal.appendChild(actionRow);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  /* ── Open timer with a drill ───────────────────────────────── */
  function open(drill) {
    if (!drill) return;
    buildUI();

    state.drill = drill;
    state.totalSets = parseSets(drill.reps_or_sets);
    state.currentSet = 0;
    state.restTime = REST_DEFAULT;
    state.restRemaining = 0;
    state.workElapsed = 0;
    state.paused = false;
    state.phase = 'IDLE';
    clearTick();

    elTitle.textContent = drill.name || 'Drill';
    elFocus.textContent = drill.focus_area || '';
    elRestVal.textContent = state.restTime + 's';

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    startNextSet();
  }

  /* ── Close timer ───────────────────────────────────────────── */
  function closeTimer() {
    clearTick();
    state.phase = 'IDLE';
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  /* ── Timer tick ─────────────────────────────────────────────── */
  function clearTick() {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
  }

  function startTick() {
    clearTick();
    state.intervalId = setInterval(tick, 1000);
  }

  function tick() {
    if (state.paused) return;

    if (state.phase === 'WORK') {
      state.workElapsed++;
      render();
    } else if (state.phase === 'REST') {
      state.restRemaining--;
      if (state.restRemaining <= 0) {
        vibrate();
        startNextSet();
      } else {
        render();
      }
    }
  }

  /* ── Phase transitions ─────────────────────────────────────── */
  function startNextSet() {
    state.currentSet++;
    if (state.currentSet > state.totalSets) {
      completeAll();
      return;
    }
    state.phase = 'WORK';
    state.workElapsed = 0;
    state.paused = false;
    btnPause.textContent = 'Pause';
    showWorkUI();
    startTick();
    render();
  }

  function startRest() {
    sfxSuccess();
    if (state.currentSet >= state.totalSets) {
      completeAll();
      return;
    }
    state.phase = 'REST';
    state.restRemaining = state.restTime;
    state.paused = false;
    btnPause.textContent = 'Pause';
    showRestUI();
    startTick();
    render();
  }

  function completeAll() {
    clearTick();
    state.phase = 'COMPLETE';
    sfxLevelUp();
    grantXP();
    showCompleteUI();
  }

  /* ── UI updates ─────────────────────────────────────────────── */
  function render() {
    if (state.phase === 'WORK') {
      elDigits.textContent = fmt(state.workElapsed);
      elSetInfo.textContent = 'Set ' + state.currentSet + ' of ' + state.totalSets;
    } else if (state.phase === 'REST') {
      elDigits.textContent = fmt(state.restRemaining);
      elSetInfo.textContent = 'Rest \u2014 next set ' + (state.currentSet + 1) + ' of ' + state.totalSets;
    }
  }

  function showWorkUI() {
    elPhase.textContent = 'Work';
    elPhase.style.color = GREEN;
    elDigits.style.color = WHITE;
    btnSkip.style.display = 'none';
    elRestControls.style.display = 'none';
    btnPause.style.display = '';

    // "Done with set" button logic — repurpose pause to end set
    // Actually keep pause as pause; user manually ends set or it's time-based
    // For simplicity: add a "Done Set" action during work
    updateDoneSetButton(true);
  }

  function showRestUI() {
    elPhase.textContent = 'Rest';
    elPhase.style.color = AMBER;
    elDigits.style.color = AMBER;
    btnSkip.style.display = '';
    elRestControls.style.display = 'flex';
    btnPause.style.display = '';
    updateDoneSetButton(false);
  }

  function showCompleteUI() {
    elPhase.textContent = 'Complete!';
    elPhase.style.color = GREEN;
    elDigits.textContent = '\u2714';
    elDigits.style.color = GREEN;
    elSetInfo.textContent = state.totalSets + ' set' + (state.totalSets > 1 ? 's' : '') + ' finished';
    btnSkip.style.display = 'none';
    btnPause.style.display = 'none';
    elRestControls.style.display = 'none';
    updateDoneSetButton(false);
  }

  /* ── "Done Set" button (appears during WORK phase) ─────────── */
  var btnDoneSet = null;
  function updateDoneSetButton(show) {
    if (show) {
      if (!btnDoneSet) {
        btnDoneSet = btn('Done Set \u2714', {
          background: 'rgba(52,208,88,0.12)',
          color: GREEN,
          padding: '12px 22px',
          flex: '1',
          maxWidth: '160px'
        }, function () {
          startRest();
        });
        btnDoneSet.addEventListener('mouseenter', function () { btnDoneSet.style.background = 'rgba(52,208,88,0.22)'; });
        btnDoneSet.addEventListener('mouseleave', function () { btnDoneSet.style.background = 'rgba(52,208,88,0.12)'; });
      }
      // Insert after pause button
      if (btnPause.parentNode && !btnDoneSet.parentNode) {
        btnPause.parentNode.appendChild(btnDoneSet);
      }
      btnDoneSet.style.display = '';
    } else {
      if (btnDoneSet) btnDoneSet.style.display = 'none';
    }
  }

  /* ── Actions ────────────────────────────────────────────────── */
  function togglePause() {
    state.paused = !state.paused;
    btnPause.textContent = state.paused ? 'Resume' : 'Pause';
  }

  function skipRest() {
    if (state.phase !== 'REST') return;
    startNextSet();
  }

  function adjustRest(delta) {
    state.restTime = Math.max(REST_STEP, state.restTime + delta);
    elRestVal.textContent = state.restTime + 's';
    // Also adjust remaining if currently resting
    if (state.phase === 'REST') {
      state.restRemaining = Math.max(1, state.restRemaining + delta);
      render();
    }
  }

  /* ── Public API ─────────────────────────────────────────────── */
  window.WorkoutTimer = {
    open: open
  };

})();
