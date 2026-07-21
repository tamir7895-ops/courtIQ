/* app-v10/screens/session-prep.js — v12
   BEFORE YOU START — the setup screen that decides whether the analysis
   is any good.

   Every line here is earned from measured evidence, not guesswork:
     • FIXED camera is #1. On the two clips the analyzer scored perfectly
       (9/9 and 10/14) the measured pan spread was 0.005-0.016 — a phone
       that does not move. The one clip it got wrong (night_c) pans early,
       which breaks the single-ring assumption and flips early verdicts.
     • Whole hoop in frame, upper half: the rim has to lock before any
       crossing can be judged; the walk-up gate blocks START without it.
     • Light: the night clips are where the ball drops out at the rim —
       the exact frames the made/miss call depends on.
     • Distance: a ball too small for the detector is the dropout that
       gap-filling can only partly rescue.

   Skippable, and skippable FOREVER (localStorage) — an instruction screen
   you cannot dismiss is a tax on every session after the first.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  var SKIP_KEY = 'courtiq-skip-session-prep';
  /* Session cap. Analysis runs frame-by-frame at roughly 2-3x the clip
     length on-device, so an uncapped session turns into an unbounded
     wait. Capped here, enforced by the recorder. */
  var MAX_MIN = 5;
  window.__COURTIQ_SESSION_MAX_MS = MAX_MIN * 60 * 1000;

  var CONDITIONS = [
    {
      tone: 'orange', icon: 'ph-device-mobile',
      title: 'Prop the phone up — don\'t hold it',
      body: 'This is the one that matters most. A phone that moves breaks the read. Lean it on a bag, a bottle, a fence — anything steady.'
    },
    {
      tone: 'blue', icon: 'ph-crosshair',
      title: 'Whole hoop in frame, upper half',
      body: 'The rim has to lock on before any shot can be scored. Keep the whole hoop visible and fairly still in the top part of the picture.'
    },
    {
      tone: 'green', icon: 'ph-sun',
      title: 'The more light, the better',
      body: 'In dim light the ball disappears exactly when it matters — going through the net. Daylight or a well-lit gym is where it is sharpest.'
    },
    {
      tone: 'ink', icon: 'ph-basketball',
      title: 'Don\'t set up too far back',
      body: 'If the ball is only a few pixels wide, it gets lost mid-flight. Close enough that the ball reads clearly on screen.'
    },
    {
      tone: 'blue', icon: 'ph-video-camera',
      title: 'Shoot from the side, not under the rim',
      body: 'From directly under the hoop, a make and a miss look almost identical to the camera. An angle from the side or wing reads best.'
    }
  ];

  function render(args) {
    var host = args.host, ctx = args.ctx;

    /* Opted out previously → straight to the camera. Centralised here so
       every entry point ("Session start", inbox, home) gets the same rule. */
    var skipped = false;
    try { skipped = localStorage.getItem(SKIP_KEY) === '1'; } catch (e) {}
    if (skipped) { ctx.go('camera-hud'); return; }

    host.appendChild(h('div', { class: 'c12-chat-hd' }, [
      h('button', {
        class: 'c12-back', type: 'button', 'aria-label': 'Back',
        onclick: function () { ctx.go('track'); }
      }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
      h('div', {}, [
        h('div', { class: 'c12-chat-hd__t', text: 'Before you start' }),
        h('div', { class: 'c12-chat-hd__s', text: 'Thirty seconds of setup — it decides the accuracy' })
      ])
    ]));

    /* How the session actually works — sets the expectation that results
       are NOT instant, which is the whole shape of this flow. */
    /* Neutral card, NOT a saturated one. The tinted variant flips the text
       tokens to white, and white 13px type on orange measures 3.29:1 —
       below AA for anything that is not large text, and it read as
       unreadable on device. The system's own rule is that most surfaces
       stay neutral and only the few things that shout get colour; a list
       of setup instructions is meant to be read, not to shout. */
    host.appendChild(V12.card({ bgIcon: 'ph-film-strip', bgTone: 'orange', class: 'sp12-how' }, [
      h('div', { class: 'sp12-how__t', text: 'How it works' }),
      h('div', { class: 'sp12-how__steps' }, [
        h('div', { class: 'sp12-step' }, [
          h('span', { class: 'sp12-step__n', text: '1' }),
          h('span', { text: 'Your session records — up to ' + MAX_MIN + ' minutes' })
        ]),
        h('div', { class: 'sp12-step' }, [
          h('span', { class: 'sp12-step__n', text: '2' }),
          h('span', { text: 'Tap Finish when you\'re done shooting' })
        ]),
        h('div', { class: 'sp12-step' }, [
          h('span', { class: 'sp12-step__n', text: '3' }),
          h('span', { text: 'Every frame gets analysed — a chime sounds and your results open' })
        ])
      ])
    ]));

    host.appendChild(h('div', { class: 'sp12-sec', text: 'For the best read' }));

    CONDITIONS.forEach(function (c) {
      host.appendChild(V12.card({
        class: 'n12-row', bgIcon: c.icon, bgTone: c.tone
      }, [
        h('div', { class: 'n12-row__ic n12-row__ic--' + c.tone }, [
          h('i', { class: 'ph-fill ' + c.icon })
        ]),
        h('div', { class: 'n12-row__main' }, [
          h('div', { class: 'n12-row__t', text: c.title }),
          h('div', { class: 'n12-row__b', text: c.body })
        ])
      ]));
    });

    /* Don't-show-again — a real checkbox, not a hidden gesture. */
    var box = h('input', { type: 'checkbox', class: 'sp12-dsa__box', id: 'sp12-dsa' });
    host.appendChild(h('label', { class: 'sp12-dsa', for: 'sp12-dsa' }, [
      box, h('span', { text: 'Don\'t show this again' })
    ]));

    function start() {
      try { if (box.checked) localStorage.setItem(SKIP_KEY, '1'); } catch (e) {}
      ctx.go('camera-hud');
    }

    host.appendChild(V12.btn({ label: 'I\'m set — start', icon: 'ph-play-circle', onClick: start }));
    host.appendChild(h('button', {
      class: 'sp12-skip', type: 'button', text: 'Skip', onclick: start
    }));
  }

  window.app.register('session-prep', render);
})();
