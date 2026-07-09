/* app-v10/screens/workout-player.js
   WORKOUT PLAYER — fullscreen drill in progress.
   Top: drill name + "1 of 5" + close X. Center: big timer + video placeholder.
   3-bento (REP/DRILL/ENERGY). 2-row list (next/skip). 2 CTAs (pause/skip).
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, icon = window.V10UI.icon;
  var DISPLAY = 'var(--font-display)', BODY = 'var(--font-body)', MONO = 'var(--font-mono)';
  var INK_BTN = { width: '36px', height: '36px', border: '1.5px solid var(--ink)', background: 'var(--cream)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px', flexShrink: '0' };
  var tickHandle = null;

  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
  }
  function setNav(visible) {
    var n = document.querySelector('.v10-nav');
    if (n) n.style.display = visible ? '' : 'none';
  }
  function exit(ctx, target) {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
    setNav(true);
    ctx.go(target || 'train');
  }

  function topBar(state, ctx) {
    return h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '10px', padding: 'calc(var(--safe-top) + 8px) 0 10px', borderBottom: '1.5px solid var(--ink)', marginBottom: '14px' }
    }, [
      h('button', { style: INK_BTN, onclick: function () { exit(ctx, 'train'); } }, [icon('ph-arrow-left')]),
      h('div', { style: { flex: '1', minWidth: '0' } }, [
        h('div', { style: { fontFamily: DISPLAY, fontWeight: '900', fontSize: '18px', color: 'var(--ink)', lineHeight: '1', textTransform: 'uppercase', letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, text: state.drillName }),
        h('div', { style: { fontFamily: DISPLAY, fontWeight: '700', fontSize: '10px', color: 'var(--orange)', letterSpacing: '0.2em', marginTop: '2px' }, text: state.drillIdx + ' OF ' + state.drillTotal + ' · DRILL IN PROGRESS' })
      ]),
      h('button', { style: INK_BTN, onclick: function () { exit(ctx, 'home'); } }, [icon('ph-x')])
    ]);
  }

  function bigTimer(state) {
    return h('div', { style: { textAlign: 'center', padding: '8px 0 14px', borderBottom: '1.5px dashed var(--ink)', marginBottom: '14px' } }, [
      h('div', { id: 'v10-wp-eyebrow', style: { fontFamily: DISPLAY, fontSize: '10px', fontWeight: '800', letterSpacing: '0.24em', color: 'var(--muted)', textTransform: 'uppercase' }, text: state.paused ? 'PAUSED' : 'TIME REMAINING' }),
      h('div', { id: 'v10-wp-timer', style: { fontFamily: DISPLAY, fontSize: '72px', fontWeight: '900', color: 'var(--ink)', lineHeight: '0.9', letterSpacing: '-3px', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }, text: fmt(state.seconds) }),
      h('div', { style: { fontFamily: BODY, fontStyle: 'italic', fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }, text: 'left' })
    ]);
  }

  function videoPlaceholder(state, ctx) {
    return h('div', {
      style: { background: 'var(--cream-deep)', border: '1.5px solid var(--ink)', height: '128px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: 'var(--s-3)', boxShadow: 'var(--sh-ink-sm)', cursor: 'pointer' },
      onclick: function () { ctx.go('camera-hud'); }
    }, [
      h('i', { class: 'ph-bold ph-play-circle', style: { fontSize: '44px', color: 'var(--orange)' } }),
      h('div', { style: { fontFamily: DISPLAY, fontWeight: '800', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--ink)', textTransform: 'uppercase' }, text: 'Drill demo' }),
      h('div', { style: { fontFamily: MONO, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em' }, text: 'TAP TO TRACK LIVE · 0:18' })
    ]);
  }

  function nextRow(state, ctx) {
    return h('div', { class: 'v10-row', onclick: function () { state.onSkip(); } }, [
      h('div', { class: 'v10-row__num', text: ('0' + (state.drillIdx + 1)).slice(-2) }),
      h('div', { class: 'v10-row__main' }, [
        h('div', { class: 'v10-row__title', text: 'NEXT: ' + state.nextName.toUpperCase() }),
        h('div', { class: 'v10-row__sub', text: state.nextReps + ' reps · ' + state.nextMins + ' min' })
      ]),
      h('i', { class: 'ph-bold ph-caret-right', style: { color: 'var(--orange)', fontSize: '16px' } })
    ]);
  }

  function skipRow(state) {
    return h('div', { class: 'v10-row', onclick: function () { state.onSkip(); }, style: { borderStyle: 'dashed', background: 'var(--cream-deep)' } }, [
      h('i', { class: 'ph-bold ph-skip-forward', style: { color: 'var(--muted)', fontSize: '18px', marginLeft: '4px' } }),
      h('div', { class: 'v10-row__main' }, [
        h('div', { class: 'v10-row__title', text: 'SKIP TO NEXT DRILL' }),
        h('div', { class: 'v10-row__sub', text: 'You can come back to this one later.' })
      ])
    ]);
  }

  function paintActions(host, state, ctx) {
    var prev = document.getElementById('v10-wp-actions');
    var row = h('div', {
      id: 'v10-wp-actions',
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: 'var(--s-3)' }
    }, [
      ctx.ui.cta({
        variant: 'orange',
        icon: state.paused ? 'ph-play-circle' : 'ph-pause',
        label: state.paused ? 'RESUME WORKOUT' : 'PAUSE WORKOUT',
        onClick: function () {
          state.paused = !state.paused;
          var eb = document.getElementById('v10-wp-eyebrow');
          if (eb) eb.textContent = state.paused ? 'PAUSED' : 'TIME REMAINING';
          paintActions(host, state, ctx);
        }
      }),
      ctx.ui.cta({ variant: 'secondary', icon: 'ph-skip-forward', label: 'SKIP DRILL', onClick: function () { state.onSkip(); } })
    ]);
    if (prev && prev.parentNode) prev.parentNode.replaceChild(row, prev);
    else host.appendChild(row);
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    setNav(false);

    var state = {
      drillName: 'Form Shooting', drillIdx: 1, drillTotal: 5,
      seconds: 154, reps: 12, repsTarget: 30, energy: 85, paused: false,
      nextName: 'Catch & Shoot', nextReps: 30, nextMins: 6,
      onSkip: function () {
        if (state.drillIdx < state.drillTotal) ctx.go('workout-player');
        else exit(ctx, 'home');
      }
    };

    ctx.data.getDrills().then(function (drills) {
      if (drills && drills.length) {
        var idx = Math.min(state.drillIdx - 1, drills.length - 1);
        var cur = drills[idx] || drills[0];
        state.drillName = cur.name || state.drillName;
        state.drillTotal = Math.max(drills.length, state.drillTotal);
        state.repsTarget = cur.reps || state.repsTarget;
        var nxt = drills[idx + 1] || { name: 'Catch & Shoot', reps: 30, mins: 6 };
        state.nextName = nxt.name || state.nextName;
        state.nextReps = nxt.reps || state.nextReps;
        state.nextMins = nxt.mins || state.nextMins;
      }

      host.appendChild(topBar(state, ctx));
      host.appendChild(bigTimer(state));
      host.appendChild(videoPlaceholder(state, ctx));

      // Bento defaults to 4 cols — override to 3 for this screen
      var bento = ctx.ui.bento([
        { variant: 'orange', icon: 'ph-target',    value: state.reps + '/' + state.repsTarget, label: 'REP' },
        {                    icon: 'ph-barbell',   value: state.drillIdx + ' / ' + state.drillTotal, label: 'DRILL' },
        { variant: 'sage',   icon: 'ph-lightning', value: state.energy + '%', label: 'ENERGY' }
      ]);
      bento.style.gridTemplateColumns = 'repeat(3, 1fr)';
      host.appendChild(bento);

      host.appendChild(nextRow(state, ctx));
      host.appendChild(skipRow(state));
      paintActions(host, state, ctx);
    });

    tickHandle = setInterval(function () {
      if (state.paused || state.seconds <= 0) return;
      state.seconds -= 1;
      var t = document.getElementById('v10-wp-timer');
      if (t) t.textContent = fmt(state.seconds);
      if (state.seconds === 0) state.paused = true;
    }, 1000);

    var obs = new MutationObserver(function () {
      if (!host.contains(document.getElementById('v10-wp-timer'))) {
        if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
        setNav(true);
        obs.disconnect();
      }
    });
    obs.observe(host, { childList: true });
  }

  window.app.register('workout-player', render);
})();
