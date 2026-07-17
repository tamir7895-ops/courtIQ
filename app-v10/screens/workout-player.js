/* app-v10/screens/workout-player.js — v12
   WORKOUT PLAYER — one drill, in progress.

   Rebuilt honest: the old screen shipped fixtures (12 reps done, 85%
   ENERGY) — numbers nobody measured. Now the only counters are real:
   a timer we run, and a rep count the USER taps in. The fake video
   placeholder became the drill's actual court diagram.

   Reads the drill handed over by drill-library / the plan
   (sessionStorage courtiq_v11_drill), falls back to today's first.
   Completing (reps target or timer) marks it done in the same store
   the plan reads, fires the tiered celebration, returns to the plan.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;
  var tickHandle = null;

  var LS_DONE = 'courtiq_v11_drills_done';
  function markDone(id) {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_DONE) || '{}');
      var today = new Date().toISOString().slice(0, 10);
      var ids = raw.date === today ? (raw.ids || []) : [];
      if (ids.indexOf(id) < 0) ids.push(id);
      localStorage.setItem(LS_DONE, JSON.stringify({ date: today, ids: ids }));
    } catch (e) {}
  }

  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
  }
  function setNav(visible) {
    var n = document.querySelector('.d-nav');
    if (n) n.style.display = visible ? '' : 'none';
  }
  function stopTick() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }
  function exit(ctx, target) {
    stopTick(); setNav(true); ctx.go(target || 'train');
  }

  function pendingDrill() {
    try {
      var raw = sessionStorage.getItem('courtiq_v11_drill');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    setNav(false);

    return ctx.data.getDrills(5).then(function (drills) {
      var d = pendingDrill() || (drills && drills[0]) || {
        id: 'freeform', name: 'Free shooting', reps: 30, mins: 6,
        focus: 'Shooting', description: 'Shoot at game pace. Count your makes.'
      };
      var state = { seconds: (d.mins || 6) * 60, reps: 0, target: d.reps || 30, paused: false, done: false };

      function finish() {
        if (state.done) return;
        state.done = true;
        stopTick();
        markDone(d.id);
        try { sessionStorage.removeItem('courtiq_v11_drill'); } catch (e) {}
        if (window.V10UI.confetti) window.V10UI.confetti({ count: 22 });
        setTimeout(function () { exit(ctx, 'train'); }, 900);
      }

      /* header */
      host.appendChild(h('div', { class: 'c12-chat-hd' }, [
        h('button', {
          class: 'c12-back', type: 'button', 'aria-label': 'Back',
          onclick: function () { exit(ctx, 'train'); }
        }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
        h('div', { style: { flex: '1', minWidth: '0' } }, [
          h('div', { class: 'c12-chat-hd__t', text: d.name }),
          h('div', { class: 'c12-chat-hd__s', text: (d.focus || 'Skill') + ' · drill in progress' })
        ]),
        h('button', {
          class: 'c12-back', type: 'button', 'aria-label': 'Close',
          onclick: function () { exit(ctx, 'home'); }
        }, [h('i', { class: 'ph-bold ph-x' })])
      ]));

      /* timer card */
      var timerEl = h('div', { class: 'wp12-time d-num', text: fmt(state.seconds) });
      var eyebrow = h('div', { class: 'd-label', text: 'TIME REMAINING' });
      host.appendChild(V12.card({ tint: 'blue', class: 'wp12-timer', bgIcon: 'ph-timer', bgTone: 'blue' }, [
        eyebrow, timerEl
      ]));

      /* the drill on the court — the real diagram, not a fake video */
      host.appendChild(V12.card({ class: 'wp12-court' }, [
        V12.courtThumb(d.focus, 0, { label: d.name, bg: '#FFFFFF' }),
        d.description ? h('div', { class: 'wp12-desc', text: d.description }) : null
      ].filter(Boolean)));

      /* rep counter — the user counts, we don't invent */
      var repV = h('div', { class: 'wp12-reps__v d-num', text: '0' });
      var fill = h('div', { class: 'h12-chal__fill', style: { width: '0%' } });
      host.appendChild(V12.card({ tint: 'green', class: 'wp12-reps' }, [
        h('div', { class: 'wp12-reps__main' }, [
          h('div', { class: 'd-label', text: 'REPS' }),
          h('div', { class: 'wp12-reps__row' }, [
            repV,
            h('div', { class: 'wp12-reps__t', text: '/ ' + state.target })
          ]),
          h('div', { class: 'h12-chal__bar' }, [fill])
        ]),
        h('button', {
          class: 'wp12-plus', type: 'button', 'aria-label': 'Count one rep',
          onclick: function () {
            state.reps += 1;
            repV.textContent = String(state.reps);
            fill.style.width = Math.min(100, Math.round(state.reps * 100 / state.target)) + '%';
            if (state.reps >= state.target) finish();
          }
        }, [h('i', { class: 'ph-bold ph-plus' })])
      ]));

      /* actions */
      var pauseBtn;
      function paintPause() {
        var fresh = V12.btn({
          variant: 'ghost',
          icon: state.paused ? 'ph-play-circle' : 'ph-pause',
          label: state.paused ? 'Resume' : 'Pause',
          onClick: function () {
            state.paused = !state.paused;
            eyebrow.textContent = state.paused ? 'PAUSED' : 'TIME REMAINING';
            paintPause();
          }
        });
        if (pauseBtn && pauseBtn.parentNode) pauseBtn.parentNode.replaceChild(fresh, pauseBtn);
        pauseBtn = fresh;
      }
      var actions = h('div', { class: 'wp12-actions' });
      host.appendChild(actions);
      pauseBtn = V12.btn({ variant: 'ghost', icon: 'ph-pause', label: 'Pause', onClick: function () {} });
      actions.appendChild(pauseBtn);
      paintPause();
      actions.appendChild(V12.btn({
        variant: 'green', icon: 'ph-check-circle', label: 'Done',
        onClick: finish
      }));

      host.appendChild(V12.btn({
        variant: 'blue', icon: 'ph-video-camera', label: 'Track this drill live',
        onClick: function () { stopTick(); setNav(true); ctx.go('camera-hud'); }
      }));

      stopTick();
      tickHandle = setInterval(function () {
        if (state.paused || state.done) return;
        state.seconds -= 1;
        timerEl.textContent = fmt(Math.max(0, state.seconds));
        if (state.seconds <= 0) finish();
      }, 1000);

      /* if the router swaps the screen out from under us, clean up */
      var obs = new MutationObserver(function () {
        if (!host.contains(timerEl)) {
          stopTick(); setNav(true); obs.disconnect();
        }
      });
      obs.observe(host, { childList: true });
    });
  }

  window.app.register('workout-player', render);
})();
