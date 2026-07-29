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

  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

  var T = {
    en: {
      'prep.back':        'Back',
      'prep.title':       'Before you start',
      'prep.sub':         'Thirty seconds of setup — it decides the accuracy',
      'prep.how':         'How it works',
      'prep.how.1':       'Your session records — up to {n} minutes',
      'prep.how.2':       'Tap Finish when you\'re done shooting',
      'prep.how.3':       'Every frame gets analysed — a chime sounds and your results open',
      'prep.sec':         'For the best read',
      'prep.c1.title':    'Prop the phone up — don\'t hold it',
      'prep.c1.body':     'This is the one that matters most. A phone that moves breaks the read. Lean it on a bag, a bottle, a fence — anything steady.',
      'prep.c2.title':    'Whole hoop in frame, upper half',
      'prep.c2.body':     'The rim has to lock on before any shot can be scored. Keep the whole hoop visible and fairly still in the top part of the picture.',
      'prep.c3.title':    'The more light, the better',
      'prep.c3.body':     'In dim light the ball disappears exactly when it matters — going through the net. Daylight or a well-lit gym is where it is sharpest.',
      'prep.c4.title':    'Don\'t set up too far back',
      'prep.c4.body':     'If the ball is only a few pixels wide, it gets lost mid-flight. Close enough that the ball reads clearly on screen.',
      'prep.c5.title':    'Shoot from the side, not under the rim',
      'prep.c5.body':     'From directly under the hoop, a make and a miss look almost identical to the camera. An angle from the side or wing reads best.',
      'prep.dsa':         'Don\'t show this again',
      'prep.start':       'I\'m set — start',
      'prep.skip':        'Skip'
    },
    he: {
      'prep.back':        'חזרה',
      'prep.title':       'לפני שמתחילים',
      'prep.sub':         'שלושים שניות של הכנה — הן שקובעות את הדיוק',
      'prep.how':         'איך זה עובד',
      'prep.how.1':       'האימון שלך מוקלט — עד {n} דקות',
      'prep.how.2':       'לחץ סיום כשגמרת לזרוק',
      'prep.how.3':       'כל פריים עובר ניתוח — נשמע צליל והתוצאות נפתחות',
      'prep.sec':         'לקריאה הכי מדויקת',
      'prep.c1.title':    'תשעין את הטלפון — אל תחזיק אותו',
      'prep.c1.body':     'זה הדבר הכי חשוב. טלפון שזז שובר את הקריאה. תשעין אותו על תיק, בקבוק, גדר — כל דבר יציב.',
      'prep.c2.title':    'כל הסל בפריים, בחצי העליון',
      'prep.c2.body':     'הטבעת חייבת להינעל לפני שאפשר לשפוט זריקה. שמור על כל הסל גלוי ויציב יחסית בחלק העליון של התמונה.',
      'prep.c3.title':    'כמה שיותר אור, יותר טוב',
      'prep.c3.body':     'באור חלש הכדור נעלם בדיוק ברגע שהכי חשוב — במעבר דרך הרשת. אור יום או אולם מואר זה איפה שהקריאה הכי חדה.',
      'prep.c4.title':    'אל תתמקם רחוק מדי',
      'prep.c4.body':     'אם הכדור ברוחב כמה פיקסלים, הוא הולך לאיבוד באוויר. תתקרב מספיק כדי שהכדור ייקרא ברור על המסך.',
      'prep.c5.title':    'צלם מהצד, לא מתחת לסל',
      'prep.c5.body':     'ישר מתחת לסל, קליעה והחטאה נראות למצלמה כמעט אותו דבר. זווית מהצד או מהכנף נקראת הכי טוב.',
      'prep.dsa':         'אל תציג את זה שוב',
      'prep.start':       'אני מוכן — מתחילים',
      'prep.skip':        'דלג'
    }
  };
  if (window.V12I18n) V12I18n.add(T);

  var SKIP_KEY = 'courtiq-skip-session-prep';
  /* Session cap. Analysis runs frame-by-frame at roughly 2-3x the clip
     length on-device, so an uncapped session turns into an unbounded
     wait. Capped here, enforced by the recorder. */
  var MAX_MIN = 5;
  window.__COURTIQ_SESSION_MAX_MS = MAX_MIN * 60 * 1000;

  var CONDITIONS = [
    { tone: 'orange', icon: 'ph-device-mobile', title: 'prep.c1.title', body: 'prep.c1.body' },
    { tone: 'blue',   icon: 'ph-crosshair',     title: 'prep.c2.title', body: 'prep.c2.body' },
    { tone: 'green',  icon: 'ph-sun',           title: 'prep.c3.title', body: 'prep.c3.body' },
    { tone: 'ink',    icon: 'ph-basketball',    title: 'prep.c4.title', body: 'prep.c4.body' },
    { tone: 'blue',   icon: 'ph-video-camera',  title: 'prep.c5.title', body: 'prep.c5.body' }
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
        class: 'c12-back', type: 'button', 'aria-label': t('prep.back'),
        onclick: function () { ctx.back(); }
      }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
      h('div', {}, [
        h('div', { class: 'c12-chat-hd__t', text: t('prep.title') }),
        h('div', { class: 'c12-chat-hd__s', text: t('prep.sub') })
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
      h('div', { class: 'sp12-how__t', text: t('prep.how') }),
      h('div', { class: 'sp12-how__steps' }, [
        h('div', { class: 'sp12-step' }, [
          h('span', { class: 'sp12-step__n', text: '1' }),
          h('span', { text: t('prep.how.1', { n: MAX_MIN }) })
        ]),
        h('div', { class: 'sp12-step' }, [
          h('span', { class: 'sp12-step__n', text: '2' }),
          h('span', { text: t('prep.how.2') })
        ]),
        h('div', { class: 'sp12-step' }, [
          h('span', { class: 'sp12-step__n', text: '3' }),
          h('span', { text: t('prep.how.3') })
        ])
      ])
    ]));

    host.appendChild(h('div', { class: 'sp12-sec', text: t('prep.sec') }));

    CONDITIONS.forEach(function (c) {
      host.appendChild(V12.card({
        class: 'n12-row', bgIcon: c.icon, bgTone: c.tone
      }, [
        h('div', { class: 'n12-row__ic n12-row__ic--' + c.tone }, [
          h('i', { class: 'ph-fill ' + c.icon })
        ]),
        h('div', { class: 'n12-row__main' }, [
          h('div', { class: 'n12-row__t', text: t(c.title) }),
          h('div', { class: 'n12-row__b', text: t(c.body) })
        ])
      ]));
    });

    /* Don't-show-again — a real checkbox, not a hidden gesture. */
    var box = h('input', { type: 'checkbox', class: 'sp12-dsa__box', id: 'sp12-dsa' });
    host.appendChild(h('label', { class: 'sp12-dsa', for: 'sp12-dsa' }, [
      box, h('span', { text: t('prep.dsa') })
    ]));

    function start() {
      try { if (box.checked) localStorage.setItem(SKIP_KEY, '1'); } catch (e) {}
      ctx.go('camera-hud');
    }

    host.appendChild(V12.btn({ label: t('prep.start'), icon: 'ph-play-circle', onClick: start }));
    host.appendChild(h('button', {
      class: 'sp12-skip', type: 'button', text: t('prep.skip'), onclick: start
    }));
  }

  window.app.register('session-prep', render);
})();
