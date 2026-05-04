/* CourtIQ UI v2 — Daily Workout Player (8.5)
 *
 * Fullscreen overlay that runs a single drill with timer, sets tracker,
 * and audio cues. Built v2-native — does NOT depend on the legacy
 * #drillWorkout view in drill-engine.js (workout-timer.js doesn't
 * exist in this codebase, contrary to the original plan).
 *
 * Public API: window.CIQ_PLAYER.start(drill)
 *   drill = { id, name, sets ('4 sets × 10 reps per side'), mins, focus }
 *
 * Audio: uses global SFX (sound-effects.js) when present.
 * XP: hooks GamificationSystem.grantXp on completion when present.
 *
 * Replaces the legacy `drillWorkoutOpen(drillId)` call path for v2 —
 * the Drill Generator (8.4) is updated to call start(drill) instead.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRAIN_PLAYER) return;

  /* ── State ────────────────────────────────────────────────── */
  var state = {
    drill: null,
    setCount: 1,
    setsDone: 0,
    elapsed: 0,
    targetSec: 0,
    intervalId: null,
    paused: true,
    finished: false,
    startedAt: 0
  };

  /* ── DOM helpers ─────────────────────────────────────────── */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ── Parse "4 sets × 10 reps" → { sets: 4, reps: '10 reps' } ── */
  function parseSets(s) {
    if (!s) return { sets: 1, reps: '' };
    var m = String(s).match(/(\d+)\s*sets?/i);
    var sets = m ? parseInt(m[1], 10) : 1;
    if (!sets || isNaN(sets)) sets = 1;
    var afterX = String(s).split(/[×x]/);
    var reps = (afterX[1] || '').trim();
    return { sets: sets, reps: reps };
  }

  /* ── Build overlay (one-time) ─────────────────────────────── */
  var overlay = null, backdrop = null;
  var ui = {};
  function ensureOverlay() {
    if (overlay) return;

    backdrop = el('div');
    backdrop.id = 'ciq-player-backdrop';
    backdrop.addEventListener('click', close);

    overlay = el('div');
    overlay.id = 'ciq-player-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var header = el('div', 'ciq-player-header');
    ui.eyebrow = el('div', 'ciq-player-eyebrow', 'Now playing');
    var closeBtn = el('button', 'ciq-player-close');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close player');
    closeBtn.addEventListener('click', close);
    header.appendChild(ui.eyebrow);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    ui.name = el('div', 'ciq-player-name', 'Drill');
    overlay.appendChild(ui.name);
    ui.meta = el('div', 'ciq-player-meta', '');
    overlay.appendChild(ui.meta);

    var timerWrap = el('div', 'ciq-player-timer-wrap');
    ui.timer = el('div', 'ciq-player-timer', '00:00');
    ui.target = el('div', 'ciq-player-target');
    var progress = el('div', 'ciq-player-progress');
    ui.progressFill = el('span');
    progress.appendChild(ui.progressFill);
    ui.sets = el('div', 'ciq-player-sets');
    timerWrap.appendChild(ui.timer);
    timerWrap.appendChild(ui.target);
    timerWrap.appendChild(progress);
    timerWrap.appendChild(ui.sets);
    overlay.appendChild(timerWrap);

    var controls = el('div', 'ciq-player-controls');
    ui.skipBtn = el('button', 'ciq-player-btn', 'Skip Set');
    ui.skipBtn.type = 'button';
    ui.skipBtn.addEventListener('click', skipSet);
    ui.toggleBtn = el('button', 'ciq-player-btn primary', 'Start');
    ui.toggleBtn.type = 'button';
    ui.toggleBtn.addEventListener('click', toggle);
    ui.completeBtn = el('button', 'ciq-player-btn', 'Complete');
    ui.completeBtn.type = 'button';
    ui.completeBtn.addEventListener('click', complete);
    controls.appendChild(ui.skipBtn);
    controls.appendChild(ui.toggleBtn);
    controls.appendChild(ui.completeBtn);
    overlay.appendChild(controls);

    var done = el('div', 'ciq-player-done');
    var donePill = el('div', 'ciq-player-done-pill', '✓ Drill Complete');
    var doneTitle = el('div', 'ciq-player-done-title', 'Nice work.');
    var doneStats = el('div', 'ciq-player-done-stats');
    var s1 = el('div', 'ciq-player-done-stat');
    ui.doneTime = el('div', 'v', '0:00');
    s1.appendChild(ui.doneTime);
    s1.appendChild(el('div', 'l', 'Time'));
    var s2 = el('div', 'ciq-player-done-stat');
    ui.doneSets = el('div', 'v', '0');
    s2.appendChild(ui.doneSets);
    s2.appendChild(el('div', 'l', 'Sets'));
    var s3 = el('div', 'ciq-player-done-stat');
    ui.doneXp = el('div', 'v', '+15');
    s3.appendChild(ui.doneXp);
    s3.appendChild(el('div', 'l', 'XP'));
    doneStats.appendChild(s1);
    doneStats.appendChild(s2);
    doneStats.appendChild(s3);
    var doneCloseBtn = el('button', 'ciq-player-btn primary', 'Done');
    doneCloseBtn.type = 'button';
    doneCloseBtn.style.marginTop = '24px';
    doneCloseBtn.addEventListener('click', close);
    done.appendChild(donePill);
    done.appendChild(doneTitle);
    done.appendChild(doneStats);
    done.appendChild(doneCloseBtn);
    overlay.appendChild(done);

    document.body.appendChild(backdrop);
    document.body.appendChild(overlay);
  }

  /* ── Render helpers ──────────────────────────────────────── */
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function renderSets() {
    while (ui.sets.firstChild) ui.sets.removeChild(ui.sets.firstChild);
    for (var i = 0; i < state.setCount; i++) {
      var dot = el('button', 'ciq-player-set');
      dot.type = 'button';
      dot.dataset.setIndex = String(i);
      dot.textContent = String(i + 1);
      if (i < state.setsDone) dot.classList.add('done');
      else if (i === state.setsDone) dot.classList.add('active');
      dot.addEventListener('click', (function (idx) {
        return function () { toggleSet(idx); };
      })(i));
      ui.sets.appendChild(dot);
    }
  }

  function renderTimer() {
    ui.timer.textContent = fmt(state.elapsed);
    if (state.targetSec > 0) {
      var pct = Math.min(100, (state.elapsed / state.targetSec) * 100);
      ui.progressFill.style.width = pct + '%';
      while (ui.target.firstChild) ui.target.removeChild(ui.target.firstChild);
      var tspan = document.createElement('span');
      tspan.textContent = fmt(state.targetSec);
      ui.target.appendChild(document.createTextNode('Target '));
      ui.target.appendChild(tspan);
    } else {
      ui.target.textContent = '';
    }
  }

  /* ── Controls ────────────────────────────────────────────── */
  function start(drill) {
    if (!drill) return;
    ensureOverlay();
    var sp = parseSets(drill.sets);
    state.drill = drill;
    state.setCount = sp.sets || 1;
    state.setsDone = 0;
    state.elapsed = 0;
    state.targetSec = (drill.mins || 0) * 60;
    state.intervalId = null;
    state.paused = true;
    state.finished = false;
    state.startedAt = 0;

    document.body.classList.remove('ciq-player-finished');
    document.body.classList.add('ciq-player-open');

    ui.eyebrow.textContent = drill.focus ? drill.focus + ' · Now Playing' : 'Now Playing';
    ui.name.textContent = drill.name || 'Drill';
    ui.meta.textContent = (drill.sets || '') + (drill.mins ? '  ·  ' + drill.mins + ' min' : '');
    ui.toggleBtn.textContent = 'Start';
    renderTimer();
    renderSets();
    sfx('click');
  }

  function tick() {
    state.elapsed = state.elapsed + 1;
    renderTimer();
    if (state.targetSec && state.elapsed === state.targetSec) {
      sfx('success');
      pause();
      ui.toggleBtn.textContent = 'Done';
    }
  }

  function play() {
    if (state.intervalId) return;
    if (!state.startedAt) state.startedAt = Date.now();
    state.paused = false;
    state.intervalId = setInterval(tick, 1000);
    ui.toggleBtn.textContent = 'Pause';
    ui.toggleBtn.classList.remove('primary');
    sfx('click');
  }

  function pause() {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    state.paused = true;
    ui.toggleBtn.textContent = 'Resume';
    ui.toggleBtn.classList.add('primary');
  }

  function toggle() {
    if (state.finished) { close(); return; }
    if (state.paused) play(); else pause();
  }

  function skipSet() {
    if (state.setsDone < state.setCount) {
      state.setsDone += 1;
      sfx('click');
      if (state.setsDone >= state.setCount) {
        complete();
        return;
      }
      renderSets();
    }
  }

  function toggleSet(idx) {
    // Tap a set dot to mark/unmark — simple stepping
    if (idx === state.setsDone) {
      state.setsDone += 1;
      sfx('click');
    } else if (idx < state.setsDone) {
      state.setsDone = idx;
    } else {
      state.setsDone = idx;
    }
    if (state.setsDone >= state.setCount) {
      complete();
      return;
    }
    renderSets();
  }

  function complete() {
    pause();
    state.finished = true;
    sfx('success');
    sfx('xp');
    ui.doneTime.textContent = fmt(state.elapsed || state.targetSec || 0);
    ui.doneSets.textContent = String(state.setsDone || state.setCount);
    var xpAmount = grantXP();
    if (xpAmount) ui.doneXp.textContent = '+' + xpAmount;
    document.body.classList.add('ciq-player-finished');
  }

  function close() {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    document.body.classList.remove('ciq-player-open');
    document.body.classList.remove('ciq-player-finished');
    // Emit event for parity sync
    try {
      var detail = {
        drillId: state.drill && state.drill.id,
        elapsed: state.elapsed,
        setsDone: state.setsDone,
        finished: state.finished
      };
      document.dispatchEvent(new CustomEvent('ciq:drill-finished', { detail: detail }));
    } catch (e) { /* silent */ }
  }

  /* ── Side effects ────────────────────────────────────────── */
  function sfx(name) {
    try {
      if (typeof SFX !== 'undefined' && SFX && typeof SFX[name] === 'function') SFX[name]();
    } catch (e) { /* silent */ }
  }
  function grantXP() {
    var amount = 15; // matches XP_REWARDS.completeDrill in gamification.js
    try {
      if (window.GamificationSystem && typeof window.GamificationSystem.grantXp === 'function') {
        window.GamificationSystem.grantXp('completeDrill');
      } else if (typeof window.grantXp === 'function') {
        window.grantXp('completeDrill');
      } else {
        // Fallback: write directly to localStorage
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
    // Override Drill Generator card body click → use v2 player instead of legacy
    document.addEventListener('click', function (e) {
      var card = e.target.closest('#ciq-train-screen .ciq-drill-card');
      if (!card) return;
      // Skip if clicking the explicit CTA button (Add)
      if (e.target.closest('[data-ciq-action="add-drill"]')) return;
      var id = card.dataset.drillId;
      if (!id) return;
      var catalog = (window.CIQ_DRILL_GEN && window.CIQ_DRILL_GEN.catalog) || [];
      var drill = catalog.find ? catalog.find(function (d) { return d.id === id; }) : null;
      if (drill) {
        e.stopImmediatePropagation();
        start(drill);
      }
    }, true);
  }

  function wireChallengeStart() {
    // The Start Challenge button currently calls trChallengeStart().
    // We don't displace that — but we ALSO offer a v2 player on
    // hold/long-press? Keep simple: leave Start Challenge alone.
    // Player is reachable via Drill Generator card taps.
  }

  function init() {
    ensureOverlay();
    wireGenCardClicks();
    wireChallengeStart();
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('ciq-player-open')) close();
      if (e.key === ' '   && document.body.classList.contains('ciq-player-open')) { e.preventDefault(); toggle(); }
    });
    window.CIQ_PLAYER = { start: start, close: close, complete: complete };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
