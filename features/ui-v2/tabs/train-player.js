/* CourtIQ UI v2 — Workout Player (8.5 → design-matched)
 *
 * Fullscreen overlay: 3 states (active, rest, complete).
 * SVG circular timer ring, drill info cards, rep counter,
 * glass control buttons. Matches workout-player-states.jsx design.
 *
 * Public API: window.CIQ_PLAYER.start(drill)
 *   drill = { id, name, sets ('4 sets × 10 reps per side'), mins, focus,
 *             lane?, cue?, reps?, restSec? }
 *
 * Audio: uses global SFX (sound-effects.js) when present.
 * XP: hooks GamificationSystem.grantXp on completion when present.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRAIN_PLAYER) return;

  /* ── Constants ───────────────────────────────────────────── */
  var RING_R = 130;
  var RING_C = 2 * Math.PI * RING_R;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var DEFAULT_REST_SEC = 30;
  var BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

  /* ── State ────────────────────────────────────────────────── */
  var state = {
    phase: 'active',     // 'active' | 'rest' | 'complete'
    drill: null,
    workoutName: '',
    setCount: 1,
    currentSet: 1,
    repCount: 10,
    currentRep: 1,
    timeLeft: 0,
    setLen: 0,
    restLen: DEFAULT_REST_SEC,
    intervalId: null,
    paused: true,
    startedAt: 0,
    totalElapsed: 0,
    nextDrill: null
  };

  /* ── DOM helpers ─────────────────────────────────────────── */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
      }
    }
    return n;
  }

  /* ── Parse "4 sets × 10 reps" → { sets, repsNum, repsText } ── */
  function parseSets(s) {
    if (!s) return { sets: 1, repsNum: 10, repsText: '' };
    var m = String(s).match(/(\d+)\s*sets?/i);
    var sets = m ? parseInt(m[1], 10) : 1;
    if (!sets || isNaN(sets)) sets = 1;
    var afterX = String(s).split(/[×x]/);
    var repsText = (afterX[1] || '').trim();
    var rm = repsText.match(/(\d+)/);
    var repsNum = rm ? parseInt(rm[1], 10) : 10;
    return { sets: sets, repsNum: repsNum, repsText: repsText };
  }

  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ── SVG Icon builders ──────────────────────────────────── */
  function iconExit() {
    var s = svgEl('svg', { viewBox: '0 0 14 14', fill: 'none', width: '14', height: '14' });
    var p = svgEl('path', { d: 'M11 3L3 11M3 3l8 8', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round' });
    s.appendChild(p);
    return s;
  }
  function iconPause() {
    var s = svgEl('svg', { viewBox: '0 0 22 22', fill: 'none', width: '22', height: '22' });
    s.appendChild(svgEl('rect', { x: '5', y: '4', width: '4', height: '14', rx: '1.2', fill: 'currentColor' }));
    s.appendChild(svgEl('rect', { x: '13', y: '4', width: '4', height: '14', rx: '1.2', fill: 'currentColor' }));
    return s;
  }
  function iconPlay() {
    var s = svgEl('svg', { viewBox: '0 0 22 22', fill: 'none', width: '22', height: '22' });
    s.appendChild(svgEl('path', { d: 'M6 4l13 7-13 7V4Z', fill: 'currentColor' }));
    return s;
  }
  function iconSkipRep() {
    var s = svgEl('svg', { viewBox: '0 0 16 16', fill: 'none', width: '16', height: '16' });
    s.appendChild(svgEl('path', { d: 'M3 4l6 4-6 4V4Z', fill: 'currentColor' }));
    s.appendChild(svgEl('rect', { x: '11', y: '3.5', width: '2.2', height: '9', rx: '0.8', fill: 'currentColor' }));
    return s;
  }
  function iconSkipDrill() {
    var s = svgEl('svg', { viewBox: '0 0 16 16', fill: 'none', width: '16', height: '16' });
    s.appendChild(svgEl('path', { d: 'M2 4l5 4-5 4V4Z', fill: 'currentColor' }));
    s.appendChild(svgEl('path', { d: 'M8 4l5 4-5 4V4Z', fill: 'currentColor' }));
    return s;
  }
  function iconArrowFwd() {
    var s = svgEl('svg', { viewBox: '0 0 22 22', fill: 'none', width: '22', height: '22' });
    s.appendChild(svgEl('path', { d: 'M4 11h14M12 5l6 6-6 6', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return s;
  }
  function iconSave() {
    var s = svgEl('svg', { viewBox: '0 0 18 18', fill: 'none', width: '18', height: '18' });
    s.appendChild(svgEl('path', { d: 'M3.5 3.5h9.5l2 2v9a1 1 0 0 1-1 1h-11.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linejoin': 'round' }));
    s.appendChild(svgEl('path', { d: 'M5 3.5v3.5h6V3.5', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linejoin': 'round' }));
    s.appendChild(svgEl('circle', { cx: '9', cy: '11.5', r: '2', stroke: 'currentColor', 'stroke-width': '1.7' }));
    return s;
  }
  function iconCoffee() {
    var s = svgEl('svg', { viewBox: '0 0 22 22', fill: 'none', width: '22', height: '22' });
    s.appendChild(svgEl('path', { d: 'M4 8h11v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linejoin': 'round' }));
    s.appendChild(svgEl('path', { d: 'M15 10h1.5a2.5 2.5 0 0 1 0 5H15', stroke: 'currentColor', 'stroke-width': '1.7' }));
    s.appendChild(svgEl('path', { d: 'M7 3v2M10 3v2M13 3v2', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round' }));
    return s;
  }
  function iconNext() {
    var s = svgEl('svg', { viewBox: '0 0 22 22', fill: 'none', width: '22', height: '22' });
    s.appendChild(svgEl('path', { d: 'M5 6l6 5-6 5V6Z', fill: 'currentColor' }));
    s.appendChild(svgEl('path', { d: 'M13 6l6 5-6 5V6Z', fill: 'currentColor' }));
    return s;
  }

  /* ── Build overlay (one-time) ─────────────────────────────── */
  var overlay = null;
  var ui = {};

  function ensureOverlay() {
    if (overlay) return;

    overlay = el('div');
    overlay.id = 'ciq-player-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    document.body.appendChild(overlay);
  }

  /* ── Build progress ring SVG ──────────────────────────────── */
  function buildRing(progress) {
    var offset = RING_C * (1 - Math.max(0, Math.min(1, progress)));
    var s = svgEl('svg', { viewBox: '0 0 286 286', class: 'wp-timer__ring' });
    s.appendChild(svgEl('circle', { cx: '143', cy: '143', r: String(RING_R), class: 'wp-timer__ring-bg' }));
    var fg = svgEl('circle', {
      cx: '143', cy: '143', r: String(RING_R), class: 'wp-timer__ring-fg',
      'stroke-dasharray': String(RING_C),
      'stroke-dashoffset': String(offset)
    });
    s.appendChild(fg);
    return s;
  }

  /* ── Build checkmark animation SVG ────────────────────────── */
  function buildCheckmark() {
    var wrap = el('div', 'wp-check wp-fade d-1');

    var ringSvg = svgEl('svg', { viewBox: '0 0 168 168', class: 'wp-check__ring' });
    ringSvg.appendChild(svgEl('circle', { cx: '84', cy: '84', r: '74', class: 'wp-check__ring-bg' }));
    ringSvg.appendChild(svgEl('circle', { cx: '84', cy: '84', r: '74', class: 'wp-check__ring-fg' }));
    wrap.appendChild(ringSvg);

    var checkSvg = svgEl('svg', { viewBox: '0 0 90 90', class: 'wp-check__svg' });
    checkSvg.appendChild(svgEl('path', { d: 'M22 47 L40 64 L70 30' }));
    wrap.appendChild(checkSvg);

    var burst = el('div', 'wp-check__burst');
    BURST_ANGLES.forEach(function (a, i) {
      var rad = (a * Math.PI) / 180;
      var span = el('span');
      span.style.setProperty('--bx', Math.cos(rad) * 78 + 'px');
      span.style.setProperty('--by', Math.sin(rad) * 78 + 'px');
      span.style.animationDelay = (700 + i * 30) + 'ms';
      burst.appendChild(span);
    });
    wrap.appendChild(burst);
    return wrap;
  }

  /* ── Render ACTIVE state ──────────────────────────────────── */
  function renderActive() {
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    overlay.className = 'wp is-active';

    var ringPct = state.setLen > 0 ? state.timeLeft / state.setLen : 0;
    var repPct = state.repCount > 0 ? state.currentRep / state.repCount : 0;

    // Stamp header
    var stamp = el('div', 'wp-stamp');
    var stampL = el('div', 'wp-stamp__l');
    var exitBtn = el('button', 'wp-stamp__exit');
    exitBtn.setAttribute('aria-label', 'Exit');
    exitBtn.appendChild(iconExit());
    exitBtn.addEventListener('click', closePlayer);
    stampL.appendChild(exitBtn);
    var stampText = el('div');
    stampText.appendChild(el('div', 'wp-stamp__eyebrow', 'TRAIN · WORKOUT'));
    stampText.appendChild(el('div', 'wp-stamp__meta', state.workoutName || state.drill.name || 'Workout'));
    stampL.appendChild(stampText);
    stamp.appendChild(stampL);
    var pill = el('div', 'wp-stamp__pill');
    pill.appendChild(el('span', 'wp-stamp__pill-dot'));
    pill.appendChild(document.createTextNode(state.paused ? 'Paused' : 'Live'));
    stamp.appendChild(pill);
    ui.pill = pill;
    overlay.appendChild(stamp);

    // Body
    var body = el('div', 'wp-body');

    // Top card — drill info
    var top = el('div', 'wp-top wp-glass wp-fade d-1');
    var topRow = el('div', 'wp-top__row');
    var eyebrow = el('div', 'wp-top__eyebrow');
    eyebrow.innerHTML = 'Drill <em>1</em> · ' + (state.drill.lane || state.drill.focus || 'DRILL').toUpperCase();
    topRow.appendChild(eyebrow);
    var counter = el('div', 'wp-top__counter');
    counter.innerHTML = 'Set <em>' + state.currentSet + '</em> of ' + state.setCount;
    topRow.appendChild(counter);
    top.appendChild(topRow);
    var title = el('h2', 'wp-top__title', (state.drill.name || 'DRILL').toUpperCase());
    top.appendChild(title);

    // Set progress dots
    var dots = el('div', 'wp-top__dots');
    for (var i = 0; i < state.setCount; i++) {
      var dot = el('span', 'wp-top__dot');
      if (i + 1 < state.currentSet) dot.classList.add('is-done');
      else if (i + 1 === state.currentSet) {
        dot.classList.add('is-current');
        dot.style.setProperty('--dot-pct', Math.round((1 - ringPct) * 100) + '%');
      }
      dots.appendChild(dot);
    }
    top.appendChild(dots);

    var cue = el('p', 'wp-top__sub', state.drill.cue || 'Square shoulders to rim · follow through · hold.');
    top.appendChild(cue);
    body.appendChild(top);

    // Center — Timer
    var timerStage = el('div', 'wp-timer-stage wp-fade d-2');
    var timerBox = el('div', 'wp-timer');
    timerBox.appendChild(buildRing(ringPct));
    var inner = el('div', 'wp-timer__inner');
    inner.appendChild(el('div', 'wp-timer__phase-lbl', 'Working'));
    ui.timerNum = el('div', 'wp-timer__num', fmt(state.timeLeft));
    inner.appendChild(ui.timerNum);
    inner.appendChild(el('div', 'wp-timer__unit', 'remaining'));
    timerBox.appendChild(inner);
    timerStage.appendChild(timerBox);
    ui.ringFg = timerBox.querySelector('.wp-timer__ring-fg');

    // Rep counter
    var rep = el('div', 'wp-rep');
    rep.appendChild(el('span', 'wp-rep__lbl', 'Rep'));
    var repVal = el('span', 'wp-rep__val');
    repVal.innerHTML = '<em>' + state.currentRep + '</em> / ' + state.repCount;
    rep.appendChild(repVal);
    var repBar = el('span', 'wp-rep__bar');
    var repFill = el('span', 'wp-rep__fill');
    repFill.style.width = Math.round(repPct * 100) + '%';
    repBar.appendChild(repFill);
    rep.appendChild(repBar);
    timerStage.appendChild(rep);
    ui.repVal = repVal;
    ui.repFill = repFill;
    body.appendChild(timerStage);

    // Bottom controls
    var controls = el('div', 'wp-controls wp-glass wp-fade d-3');
    var primary = el('div', 'wp-controls__primary');
    var mainBtn = el('button', 'wp-btn-primary' + (state.paused ? ' is-resume' : ''));
    mainBtn.type = 'button';
    mainBtn.appendChild(state.paused ? iconPlay() : iconPause());
    mainBtn.appendChild(document.createTextNode(state.paused ? 'Resume' : 'Pause'));
    mainBtn.addEventListener('click', togglePause);
    primary.appendChild(mainBtn);
    ui.mainBtn = mainBtn;
    controls.appendChild(primary);

    var secondary = el('div', 'wp-controls__secondary');
    var skipRepBtn = el('button', 'wp-btn-ghost');
    skipRepBtn.type = 'button';
    skipRepBtn.appendChild(iconSkipRep());
    skipRepBtn.appendChild(document.createTextNode('Skip Rep'));
    skipRepBtn.addEventListener('click', skipRep);
    secondary.appendChild(skipRepBtn);
    var skipDrillBtn = el('button', 'wp-btn-ghost is-warn');
    skipDrillBtn.type = 'button';
    skipDrillBtn.appendChild(iconSkipDrill());
    skipDrillBtn.appendChild(document.createTextNode('Skip Drill'));
    skipDrillBtn.addEventListener('click', completeWorkout);
    secondary.appendChild(skipDrillBtn);
    controls.appendChild(secondary);
    body.appendChild(controls);

    overlay.appendChild(body);
  }

  /* ── Render REST state ───────────────────────────────────── */
  function renderRest() {
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    overlay.className = 'wp is-rest';

    var ringPct = state.restLen > 0 ? state.timeLeft / state.restLen : 0;

    // Stamp
    var stamp = el('div', 'wp-stamp');
    var stampL = el('div', 'wp-stamp__l');
    var exitBtn = el('button', 'wp-stamp__exit');
    exitBtn.setAttribute('aria-label', 'Exit');
    exitBtn.appendChild(iconExit());
    exitBtn.addEventListener('click', closePlayer);
    stampL.appendChild(exitBtn);
    var stampText = el('div');
    stampText.appendChild(el('div', 'wp-stamp__eyebrow', 'TRAIN · REST'));
    stampText.appendChild(el('div', 'wp-stamp__meta', 'Breathe · ' + fmt(state.timeLeft)));
    stampL.appendChild(stampText);
    stamp.appendChild(stampL);
    var pill = el('div', 'wp-stamp__pill');
    pill.appendChild(el('span', 'wp-stamp__pill-dot'));
    pill.appendChild(document.createTextNode('Resting'));
    stamp.appendChild(pill);
    overlay.appendChild(stamp);

    // Body
    var body = el('div', 'wp-body');

    // Dimmed top recap
    var top = el('div', 'wp-top wp-glass wp-fade d-1');
    var topRow = el('div', 'wp-top__row');
    var eyebrow = el('div', 'wp-top__eyebrow');
    eyebrow.textContent = 'Just finished · ' + (state.drill.lane || state.drill.focus || 'DRILL').toUpperCase();
    topRow.appendChild(eyebrow);
    var counter = el('div', 'wp-top__counter');
    counter.innerHTML = 'Set <em>' + state.currentSet + '</em> of ' + state.setCount + ' ✓';
    topRow.appendChild(counter);
    top.appendChild(topRow);
    top.appendChild(el('h2', 'wp-top__title', (state.drill.name || 'DRILL').toUpperCase()));
    body.appendChild(top);

    // Center — Rest timer
    var timerStage = el('div', 'wp-timer-stage wp-fade d-2');
    var timerBox = el('div', 'wp-timer');
    timerBox.appendChild(buildRing(ringPct));
    var inner = el('div', 'wp-timer__inner');
    inner.appendChild(el('div', 'wp-timer__phase-lbl', 'Rest'));
    ui.timerNum = el('div', 'wp-timer__num', fmt(state.timeLeft));
    inner.appendChild(ui.timerNum);
    inner.appendChild(el('div', 'wp-timer__unit', 'recovery'));
    timerBox.appendChild(inner);
    timerStage.appendChild(timerBox);
    ui.ringFg = timerBox.querySelector('.wp-timer__ring-fg');

    // Up Next card
    if (state.nextDrill) {
      var upnext = el('div', 'wp-upnext wp-glass');
      var badge = el('div', 'wp-upnext__badge');
      badge.appendChild(iconCoffee());
      upnext.appendChild(badge);
      var upBody = el('div', 'wp-upnext__body');
      upBody.appendChild(el('div', 'wp-upnext__lbl', 'Up Next'));
      upBody.appendChild(el('div', 'wp-upnext__name', (state.nextDrill.name || 'Next Drill').toUpperCase()));
      upBody.appendChild(el('div', 'wp-upnext__meta', (state.nextDrill.sets || '') + ' · ' + (state.nextDrill.reps || '')));
      upnext.appendChild(upBody);
      var upIcon = el('div', 'wp-upnext__icon');
      upIcon.appendChild(iconNext());
      upnext.appendChild(upIcon);
      timerStage.appendChild(upnext);
    }
    body.appendChild(timerStage);

    // Bottom controls — skip rest
    var controls = el('div', 'wp-controls wp-glass wp-fade d-3');
    var primary = el('div', 'wp-controls__primary');
    var skipBtn = el('button', 'wp-btn-primary');
    skipBtn.type = 'button';
    skipBtn.appendChild(iconArrowFwd());
    skipBtn.appendChild(document.createTextNode('Skip Rest'));
    skipBtn.addEventListener('click', skipRestPhase);
    primary.appendChild(skipBtn);
    controls.appendChild(primary);
    body.appendChild(controls);

    overlay.appendChild(body);
  }

  /* ── Render COMPLETE state ───────────────────────────────── */
  function renderComplete() {
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    overlay.className = 'wp is-complete';

    var xpAmount = grantXP();
    var totalMin = Math.max(1, Math.round(state.totalElapsed / 60));

    // Stamp
    var stamp = el('div', 'wp-stamp');
    var stampL = el('div', 'wp-stamp__l');
    var exitBtn = el('button', 'wp-stamp__exit');
    exitBtn.setAttribute('aria-label', 'Exit');
    exitBtn.appendChild(iconExit());
    exitBtn.addEventListener('click', closePlayer);
    stampL.appendChild(exitBtn);
    var stampText = el('div');
    stampText.appendChild(el('div', 'wp-stamp__eyebrow', 'TRAIN · DONE'));
    stampText.appendChild(el('div', 'wp-stamp__meta', state.workoutName || state.drill.name || 'Workout'));
    stampL.appendChild(stampText);
    stamp.appendChild(stampL);
    var pill = el('div', 'wp-stamp__pill');
    pill.appendChild(el('span', 'wp-stamp__pill-dot'));
    pill.appendChild(document.createTextNode('Complete'));
    stamp.appendChild(pill);
    overlay.appendChild(stamp);

    // Complete body
    var complete = el('div', 'wp-complete');

    // Animated checkmark
    complete.appendChild(buildCheckmark());

    // Title
    var titleEl = el('h1', 'wp-complete__title wp-fade d-2');
    titleEl.innerHTML = 'Workout <em>Complete!</em>';
    complete.appendChild(titleEl);

    // Sub
    var sub = el('p', 'wp-complete__sub wp-fade d-2');
    sub.innerHTML = 'You logged <b>' + (state.repCount * state.setCount) + ' reps</b> across <b>' + state.setCount + ' sets</b>.';
    complete.appendChild(sub);

    // Stats card
    var stats = el('div', 'wp-stats wp-glass wp-fade d-3');
    var cells = [
      { lbl: 'Total Time', val: totalMin, unit: 'min' },
      { lbl: 'Sets', val: state.setCount, unit: 'done' },
      { lbl: 'Total Reps', val: state.repCount * state.setCount, unit: '' },
      { lbl: 'XP Earned', val: '+' + xpAmount, unit: '', cls: 'wp-stats__val--xp' }
    ];
    cells.forEach(function (c) {
      var cell = el('div', 'wp-stats__cell');
      cell.appendChild(el('span', 'wp-stats__lbl', c.lbl));
      var valEl = el('span', 'wp-stats__val' + (c.cls ? ' ' + c.cls : ''));
      valEl.textContent = String(c.val);
      if (c.unit) {
        var unitSpan = el('span');
        unitSpan.textContent = c.unit;
        valEl.appendChild(unitSpan);
      }
      cell.appendChild(valEl);
      stats.appendChild(cell);
    });
    complete.appendChild(stats);

    // CTAs
    var ctas = el('div', 'wp-complete__ctas wp-fade d-4');
    var saveBtn = el('button', 'wp-cta-green');
    saveBtn.type = 'button';
    saveBtn.appendChild(iconSave());
    saveBtn.appendChild(document.createTextNode('Save & Exit'));
    saveBtn.addEventListener('click', closePlayer);
    ctas.appendChild(saveBtn);
    complete.appendChild(ctas);

    overlay.appendChild(complete);
  }

  /* ── Timer tick ──────────────────────────────────────────── */
  function tick() {
    state.totalElapsed++;
    if (state.timeLeft > 0) {
      state.timeLeft--;
    }

    // Update display
    if (ui.timerNum) ui.timerNum.textContent = fmt(state.timeLeft);

    // Update ring
    if (ui.ringFg) {
      var total = state.phase === 'rest' ? state.restLen : state.setLen;
      var pct = total > 0 ? state.timeLeft / total : 0;
      var offset = RING_C * (1 - Math.max(0, Math.min(1, pct)));
      ui.ringFg.setAttribute('stroke-dashoffset', String(offset));
    }

    // Timer hit zero
    if (state.timeLeft <= 0) {
      if (state.phase === 'active') {
        sfx('success');
        // Move to rest
        if (state.currentSet < state.setCount) {
          enterRest();
        } else {
          completeWorkout();
        }
      } else if (state.phase === 'rest') {
        // Rest over — next set
        sfx('click');
        state.currentSet++;
        state.currentRep = 1;
        state.timeLeft = state.setLen;
        state.phase = 'active';
        state.paused = false;
        renderActive();
        startTimer();
      }
    }
  }

  function startTimer() {
    stopTimer();
    state.intervalId = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
  }

  /* ── Phase transitions ──────────────────────────────────── */
  function enterRest() {
    stopTimer();
    state.phase = 'rest';
    state.timeLeft = state.restLen;
    state.paused = false;
    renderRest();
    startTimer();
  }

  function skipRestPhase() {
    stopTimer();
    sfx('click');
    state.currentSet++;
    state.currentRep = 1;
    if (state.currentSet > state.setCount) {
      completeWorkout();
      return;
    }
    state.timeLeft = state.setLen;
    state.phase = 'active';
    state.paused = false;
    renderActive();
    startTimer();
  }

  function completeWorkout() {
    stopTimer();
    state.phase = 'complete';
    sfx('success');
    sfx('xp');
    renderComplete();
  }

  /* ── Controls ────────────────────────────────────────────── */
  function startDrill(drill) {
    if (!drill) return;
    ensureOverlay();
    var sp = parseSets(drill.sets);
    state.drill = drill;
    state.workoutName = drill.workoutName || '';
    state.setCount = sp.sets || 1;
    state.currentSet = 1;
    state.repCount = drill.reps || sp.repsNum || 10;
    state.currentRep = 1;
    state.setLen = (drill.mins || 0) * 60 || drill.setSec || 90;
    state.restLen = drill.restSec || DEFAULT_REST_SEC;
    state.timeLeft = state.setLen;
    state.intervalId = null;
    state.paused = true;
    state.startedAt = 0;
    state.totalElapsed = 0;
    state.phase = 'active';
    state.nextDrill = drill.nextDrill || null;

    document.body.classList.add('ciq-player-open');
    renderActive();
    sfx('click');
  }

  function togglePause() {
    if (state.phase === 'complete') { closePlayer(); return; }
    if (state.paused) {
      state.paused = false;
      if (!state.startedAt) state.startedAt = Date.now();
      startTimer();
      sfx('click');
    } else {
      stopTimer();
      state.paused = true;
    }
    // Update button appearance
    if (ui.mainBtn) {
      while (ui.mainBtn.firstChild) ui.mainBtn.removeChild(ui.mainBtn.firstChild);
      ui.mainBtn.appendChild(state.paused ? iconPlay() : iconPause());
      ui.mainBtn.appendChild(document.createTextNode(state.paused ? 'Resume' : 'Pause'));
      if (state.paused) {
        ui.mainBtn.classList.add('is-resume');
      } else {
        ui.mainBtn.classList.remove('is-resume');
      }
    }
    // Update pill
    if (ui.pill) {
      while (ui.pill.firstChild) ui.pill.removeChild(ui.pill.firstChild);
      ui.pill.appendChild(el('span', 'wp-stamp__pill-dot'));
      ui.pill.appendChild(document.createTextNode(state.paused ? 'Paused' : 'Live'));
    }
  }

  function skipRep() {
    if (state.currentRep < state.repCount) {
      state.currentRep++;
      sfx('click');
      if (ui.repVal) ui.repVal.innerHTML = '<em>' + state.currentRep + '</em> / ' + state.repCount;
      if (ui.repFill) {
        var pct = state.repCount > 0 ? state.currentRep / state.repCount : 0;
        ui.repFill.style.width = Math.round(pct * 100) + '%';
      }
    } else {
      // All reps done — advance set
      if (state.currentSet < state.setCount) {
        enterRest();
      } else {
        completeWorkout();
      }
    }
  }

  function closePlayer() {
    stopTimer();
    document.body.classList.remove('ciq-player-open');
    // Emit event
    try {
      document.dispatchEvent(new CustomEvent('ciq:drill-finished', {
        detail: {
          drillId: state.drill && state.drill.id,
          elapsed: state.totalElapsed,
          setsDone: state.currentSet,
          finished: state.phase === 'complete'
        }
      }));
    } catch (e) { /* silent */ }
  }

  /* ── Side effects ────────────────────────────────────────── */
  function sfx(name) {
    try {
      if (typeof SFX !== 'undefined' && SFX && typeof SFX[name] === 'function') SFX[name]();
    } catch (e) { /* silent */ }
  }

  function grantXP() {
    var amount = 15;
    try {
      if (window.GamificationSystem && typeof window.GamificationSystem.grantXp === 'function') {
        window.GamificationSystem.grantXp('completeDrill');
      } else if (typeof window.grantXp === 'function') {
        window.grantXp('completeDrill');
      } else {
        var raw = localStorage.getItem('courtiq-xp');
        var data = raw ? JSON.parse(raw) : { xp: 0, history: [] };
        data.xp = (data.xp || 0) + amount;
        if (!Array.isArray(data.history)) data.history = [];
        data.history.push({ ts: Date.now(), source: 'completeDrill', amount: amount });
        localStorage.setItem('courtiq-xp', JSON.stringify(data));
      }
    } catch (e) { /* silent */ }
    return amount;
  }

  /* ── Wire entry points ───────────────────────────────────── */
  function wireGenCardClicks() {
    document.addEventListener('click', function (e) {
      var card = e.target.closest('#ciq-train-screen .ciq-drill-card');
      if (!card) return;
      if (e.target.closest('[data-ciq-action="add-drill"]')) return;
      var id = card.dataset.drillId;
      if (!id) return;
      var catalog = (window.CIQ_DRILL_GEN && window.CIQ_DRILL_GEN.catalog) || [];
      var drill = catalog.find ? catalog.find(function (d) { return d.id === id; }) : null;
      if (drill) {
        e.stopImmediatePropagation();
        startDrill(drill);
      }
    }, true);
  }

  function init() {
    ensureOverlay();
    wireGenCardClicks();
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('ciq-player-open')) closePlayer();
      if (e.key === ' ' && document.body.classList.contains('ciq-player-open')) { e.preventDefault(); togglePause(); }
    });
    window.CIQ_PLAYER = { start: startDrill, close: closePlayer, complete: completeWorkout };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
