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

  var T = {
    en: {
      'wp.back':          'Back',
      'wp.close':         'Close',
      'wp.freeform.name': 'Free shooting',
      'wp.freeform.desc': 'Shoot at game pace. Count your makes.',
      'wp.skill':         'Skill',
      'wp.sub':           '{focus} · drill in progress',
      'wp.time':          'TIME REMAINING',
      'wp.paused':        'PAUSED',
      'wp.reps':          'REPS',
      'wp.oftarget':      '/ {n}',
      'wp.rep':           'Count one rep',
      'wp.pause':         'Pause',
      'wp.resume':        'Resume',
      'wp.done':          'Done',
      'wp.track':         'Track this drill live'
    },
    he: {
      'wp.back':          'חזרה',
      'wp.close':         'סגירה',
      'wp.freeform.name': 'קליעה חופשית',
      'wp.freeform.desc': 'זרוק בקצב משחק. ספור את הקליעות שנכנסו.',
      'wp.skill':         'מיומנות',
      'wp.sub':           '{focus} · תרגיל בעיצומו',
      'wp.time':          'זמן שנותר',
      'wp.paused':        'בהשהיה',
      'wp.reps':          'חזרות',
      'wp.oftarget':      '/ {n}',
      'wp.rep':           'ספור חזרה אחת',
      'wp.pause':         'השהיה',
      'wp.resume':        'המשך',
      'wp.done':          'סיימתי',
      'wp.track':         'עקוב אחרי התרגיל בלייב'
    }
  };
  if (window.V12I18n) V12I18n.add(T);
  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

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
        id: 'freeform', name: t('wp.freeform.name'), reps: 30, mins: 6,
        focus: 'Shooting', description: t('wp.freeform.desc')
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
          class: 'c12-back', type: 'button', 'aria-label': t('wp.back'),
          onclick: function () { exit(ctx, 'train'); }
        }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
        h('div', { style: { flex: '1', minWidth: '0' } }, [
          h('div', { class: 'c12-chat-hd__t',
            text: window.V12Drills ? V12Drills.name(d) : d.name }),
          h('div', { class: 'c12-chat-hd__s', text: t('wp.sub', { focus: d.focus || t('wp.skill') }) })
        ]),
        h('button', {
          class: 'c12-back', type: 'button', 'aria-label': t('wp.close'),
          onclick: function () { exit(ctx, 'home'); }
        }, [h('i', { class: 'ph-bold ph-x' })])
      ]));

      /* timer card */
      var timerEl = h('div', { class: 'wp12-time d-num', text: fmt(state.seconds) });
      var eyebrow = h('div', { class: 'd-label', text: t('wp.time') });
      host.appendChild(V12.card({ tint: 'blue', class: 'wp12-timer', bgIcon: 'ph-timer', bgTone: 'blue' }, [
        eyebrow, timerEl
      ]));

      /* the drill on the court — its OWN choreography when we have it,
         the category diagram as fallback. Never a fake video. */
      host.appendChild(V12.card({ class: 'wp12-court' }, [
        (function () {
          try {
            var full = window.V12DrillChoreo && window.V12DrillChoreo.find(d);
            var c = full && window.V12DrillCourt && window.V12DrillChoreo.get(full);
            if (c) return window.V12DrillCourt.render(c, { label: d.name });
          } catch (e) {}
          return V12.courtThumb(d.focus, 0, { label: d.name, bg: '#FFFFFF' });
        })(),
        d.description ? h('div', { class: 'wp12-desc',
          text: window.V12Drills ? V12Drills.desc(d) : d.description }) : null
      ].filter(Boolean)));

      /* rep counter — the user counts, we don't invent */
      var repV = h('div', { class: 'wp12-reps__v d-num', text: '0' });
      var fill = h('div', { class: 'h12-chal__fill', style: { width: '0%' } });
      host.appendChild(V12.card({ tint: 'green', class: 'wp12-reps' }, [
        h('div', { class: 'wp12-reps__main' }, [
          h('div', { class: 'd-label', text: t('wp.reps') }),
          h('div', { class: 'wp12-reps__row' }, [
            repV,
            h('div', { class: 'wp12-reps__t', text: t('wp.oftarget', { n: state.target }) })
          ]),
          h('div', { class: 'h12-chal__bar' }, [fill])
        ]),
        h('button', {
          class: 'wp12-plus', type: 'button', 'aria-label': t('wp.rep'),
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
          label: state.paused ? t('wp.resume') : t('wp.pause'),
          onClick: function () {
            state.paused = !state.paused;
            eyebrow.textContent = state.paused ? t('wp.paused') : t('wp.time');
            paintPause();
          }
        });
        if (pauseBtn && pauseBtn.parentNode) pauseBtn.parentNode.replaceChild(fresh, pauseBtn);
        pauseBtn = fresh;
      }
      var actions = h('div', { class: 'wp12-actions' });
      host.appendChild(actions);
      pauseBtn = V12.btn({ variant: 'ghost', icon: 'ph-pause', label: t('wp.pause'), onClick: function () {} });
      actions.appendChild(pauseBtn);
      paintPause();
      actions.appendChild(V12.btn({
        variant: 'green', icon: 'ph-check-circle', label: t('wp.done'),
        onClick: finish
      }));

      host.appendChild(V12.btn({
        variant: 'blue', icon: 'ph-video-camera', label: t('wp.track'),
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
