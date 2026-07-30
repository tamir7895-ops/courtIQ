/* app-v10/screens/camera-hud.js — v11
   CAMERA HUD — opens the real ShotTrackingScreen (camera + YOLO + pose).

   Designed for 20 feet, which is the only distance that matters here: the
   phone is on a tripod and the user is shooting. The optics are ruthless —
   at 20ft a legible glyph needs ~214pt of cap height (ISO 9241-303's
   16-arcmin floor; ~22 arcmin once you account for glare), which is most
   of the screen. So the HUD is ONE number and nothing else.

   The v10 chrome this replaces — a LIVE COUNT card with an eyebrow, a
   "SHOTS DETECTED" sub-label and a streak line, plus a parquet mini-court
   — measured ~3 arcmin at 20ft. Five times below the legibility floor.
   It spent the entire live UI budget on things the user physically could
   not see, on a screen they weren't looking at anyway (they're watching
   the rim, so the phone is in peripheral vision).

   Two structural consequences:
     · The number is ATTEMPTS, because live mode is counter-only
       (`__v10SessionMode='counter'`, `made:null`). We cannot compute makes
       live, so we don't show a makes counter we'd have to fake.
     · Status is a FULL-SCREEN colour field, not a badge. A corner dot at
       20ft subtends ~9 arcmin — foveally visible, peripherally absent.

   Audio (lib/audio.js) is not a nicety here. It's the only output that
   reaches the shooter.

   The router's `#camera-hud` host stays empty — the real overlay is a fixed
   fullscreen element on body, not inside #app.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  var pollHandle = null;
  var v10Layer = null;   // floating v10 chrome (sibling of #shot-tracking-screen)

  /* ── i18n — every user-visible string, both languages. The diagnostic
     surfaces (backend badge, canvas RIM:/time chips) stay English on
     purpose: they are developer instruments, not UI. ──────────────── */
  var T = {
    en: {
      'cam.tip.1': 'Keep the whole rim in frame — it’s the one thing the analysis can’t work without.',
      'cam.tip.2': 'Film from the side or the corner, not straight underneath the hoop.',
      'cam.tip.3': 'A steady phone reads far more shots than a handheld one — a tripod pays off.',
      'cam.tip.4': 'Good light helps the ball stand out; a backlit window washes it out.',
      'cam.tip.5': 'The higher the phone sits, the more of each shot’s arc it can see.',
      'cam.tip.6': 'One clean clip beats three shaky ones — every frame gets read.',
      'cam.tip.7': 'Give the rim a second in frame before your first shot so it locks on.',
      'cam.chk.hoop':   'Hoop',
      'cam.chk.ball':   'Ball',
      'cam.chk.player': 'Player',
      'cam.chk.rec':    'Rec',
      'cam.hud.detected':      'shots detected',
      'cam.hud.lost':          'Lost the hoop',
      'cam.hud.camRestarting': 'Camera restarting…',
      'cam.hud.camStalled':    'Camera stalled',
      'cam.gate.eye':       'SET UP',
      'cam.gate.title':     'Get the hoop in frame',
      'cam.gate.sub':       'The rim is the only thing that has to be there. Without it the whole clip is unreadable — and you would only find that out afterwards.',
      'cam.gate.hoop':      'Hoop',
      'cam.gate.searching': 'searching',
      'cam.gate.locked':    'locked',
      'cam.gate.tick':      'Tick',
      'cam.gate.count':     'Count',
      'cam.gate.point':     'Point at the hoop',
      'cam.gate.start':     'Start shooting',
      'cam.gate.anyway':    'Record anyway',
      'cam.gate.calib':      'Calibrate court · 4 taps',
      'cam.gate.calibok':    'Court calibrated',
      'cam.gate.calibmoved': 'Camera moved — recalibrate',
      'cam.anl.loading':  'Loading models…',
      'cam.anl.title':    'Analyzing your video',
      'cam.anl.keepOpen': 'Keep the app open — analysing…',
      'cam.anl.tiplabel': 'TIP',
      'cam.anl.eta':      ' · ~{t} left',
      'cam.anl.count':    '{n} shots · {m} made · {x} missed',
      'cam.anl.stage.prep':     'Preparing clip…',
      'cam.anl.stage.model':    'Loading model…',
      'cam.anl.stage.scan':     'Scanning for shots…',
      'cam.anl.stage.frames':   'Analyzing every frame…',
      'cam.anl.stage.classify': 'Classifying shots…',
      'cam.flash.made': 'MADE!',
      'cam.flash.miss': 'MISS',
      'cam.noshot.title':  'No shots detected',
      'cam.noshot.norim':  'We couldn’t find the hoop in this clip, so there was nothing to measure a shot against. Set the phone so the whole rim stays in frame and give it another go.',
      'cam.noshot.noarcs': 'The rim locked in, but no shot arcs came through. The ball may be too small or too blurred to track from here — or no shots went up this clip.',
      'cam.noshot.home':   'Back to home',
      'cam.noshot.retry':  'Try another clip',
      'cam.unavail.title': 'Camera unavailable',
      'cam.unavail.sub':   'The detection engine did not load. Refresh the page.'
    },
    he: {
      'cam.tip.1': 'שמור את כל הטבעת בפריים — זה הדבר היחיד שהניתוח לא יכול בלעדיו.',
      'cam.tip.2': 'צלם מהצד או מהפינה, לא ישר מתחת לסל.',
      'cam.tip.3': 'טלפון יציב קורא הרבה יותר זריקות מטלפון ביד — חצובה משתלמת.',
      'cam.tip.4': 'אור טוב עוזר לכדור לבלוט; חלון עם אור מאחור מוחק אותו.',
      'cam.tip.5': 'ככל שהטלפון גבוה יותר, כך הוא רואה יותר מהקשת של כל זריקה.',
      'cam.tip.6': 'סרטון נקי אחד שווה יותר משלושה רועדים — כל פריים נקרא.',
      'cam.tip.7': 'תן לטבעת שנייה בפריים לפני הזריקה הראשונה כדי שתינעל.',
      'cam.chk.hoop':   'סל',
      'cam.chk.ball':   'כדור',
      'cam.chk.player': 'שחקן',
      'cam.chk.rec':    'הקלטה',
      'cam.hud.detected':      'זריקות זוהו',
      'cam.hud.lost':          'הסל אבד',
      'cam.hud.camRestarting': 'המצלמה מופעלת מחדש…',
      'cam.hud.camStalled':    'המצלמה נתקעה',
      'cam.gate.eye':       'הכנה',
      'cam.gate.title':     'תכניס את הסל לפריים',
      'cam.gate.sub':       'הטבעת היא הדבר היחיד שחייב להיות בפריים. בלעדיה כל הסרטון לא קריא — וזה מתגלה רק בסוף.',
      'cam.gate.hoop':      'סל',
      'cam.gate.searching': 'מחפש',
      'cam.gate.locked':    'ננעל',
      'cam.gate.tick':      'טיק',
      'cam.gate.count':     'ספירה',
      'cam.gate.point':     'כוון אל הסל',
      'cam.gate.start':     'תתחיל לזרוק',
      'cam.gate.anyway':    'להקליט בכל זאת',
      'cam.anl.loading':  'טוען מודלים…',
      'cam.anl.title':    'מנתח את הסרטון שלך',
      'cam.anl.keepOpen': 'תשאיר את האפליקציה פתוחה — מנתח…',
      'cam.anl.tiplabel': 'טיפ',
      'cam.anl.eta':      ' · עוד ~{t}',
      'cam.anl.count':    '{n} זריקות · {m} נכנסו · {x} החטאות',
      'cam.anl.stage.prep':     'מכין את הסרטון…',
      'cam.anl.stage.model':    'טוען מודל…',
      'cam.anl.stage.scan':     'סורק זריקות…',
      'cam.anl.stage.frames':   'מנתח כל פריים…',
      'cam.anl.stage.classify': 'מסווג זריקות…',
      'cam.flash.made': 'נכנס!',
      'cam.flash.miss': 'החטאה',
      'cam.noshot.title':  'לא זוהו זריקות',
      'cam.noshot.norim':  'לא מצאנו את הסל בסרטון הזה, אז לא היה מול מה למדוד זריקה. מקם את הטלפון כך שכל הטבעת תישאר בפריים ונסה שוב.',
      'cam.noshot.noarcs': 'הטבעת ננעלה, אבל לא עברו קשתות זריקה. אולי הכדור קטן או מטושטש מדי למעקב מכאן — או שלא עלו זריקות בסרטון הזה.',
      'cam.noshot.home':   'חזרה לבית',
      'cam.noshot.retry':  'נסה סרטון אחר',
      'cam.unavail.title': 'המצלמה לא זמינה',
      'cam.unavail.sub':   'מנוע הזיהוי לא נטען. רענן את הדף.'
    }
  };
  if (window.V12I18n && window.V12I18n.add) window.V12I18n.add(T);
  function t(k, p) { return (window.V12I18n && window.V12I18n.t) ? window.V12I18n.t(k, p) : k; }

  /* Stage strings arrive as ENGLISH text from the offline processor's
     onStage passthrough — map the known ones to keys, pass unknowns
     through untouched. */
  var STAGE_KEYS = {
    'Preparing clip…':        'cam.anl.stage.prep',
    'Loading model…':         'cam.anl.stage.model',
    'Scanning for shots…':    'cam.anl.stage.scan',
    'Analyzing every frame…': 'cam.anl.stage.frames',
    'Classifying shots…':     'cam.anl.stage.classify'
  };

  /* Shown one at a time, rotating, during the offline analyse — the wait
     is long (2-3x clip length) and every tip doubles as a "your next clip
     will read better" nudge. (Keys into T — resolved via t() at render.) */
  var ANALYZE_TIPS = [
    'cam.tip.1', 'cam.tip.2', 'cam.tip.3', 'cam.tip.4',
    'cam.tip.5', 'cam.tip.6', 'cam.tip.7'
  ];

  function setNav(visible) {
    var n = document.querySelector('.v10-nav');
    if (n) n.style.display = visible ? '' : 'none';
  }

  /* ── THE SESSION HUD ─────────────────────────────────────────────
     One number. That's the whole screen.

     The optics allow nothing else: at 20ft a legible glyph needs ~214pt
     of cap height (ISO 9241-303's 16-arcmin floor, ~22 for glare), which
     is most of the screen. The old HUD spent its entire budget on an
     eyebrow, a sub-label, a streak line and a mini-court — every one of
     them invisible from the free-throw line, on a screen the shooter
     isn't even looking at.

     ONE number, and it has to be ATTEMPTS: live mode is counter-only
     (`__v10SessionMode = 'counter'`, `made: null` below), so we cannot
     compute makes at all. HomeCourt shows two counters because HomeCourt
     computes makes live. Copying that would mean shipping a number we
     can't stand behind, or a "Makes: 0" that's wrong all session. */
  function checkRow(key, label) {
    return h('div', { class: 'v11-check', id: 'v11-check-' + key }, [
      h('span', { class: 'v11-check__dot' }),
      h('span', { class: 'v11-check__lbl', text: label })
    ]);
  }

  function hudLayer() {
    return h('div', { id: 'v11-hud', class: 'v11-hud v11-hud--live' }, [
      h('div', { class: 'v11-hud__frame' }),

      /* Right column: compact recording timer + a live checklist of what
         the model is seeing. The camera view itself is the hero now — the
         chrome stays out of the middle of the frame. The giant centre
         clock is gone by request; status reads as a tidy stack instead. */
      h('div', { class: 'v11-hud__side' }, [
        h('div', { class: 'v11-side__timer' }, [
          h('span', { class: 'v11-side__rec', id: 'v11-side-rec' }),
          h('span', { class: 'v11-side__time', id: 'v11-hud-timer', text: '0:00' })
        ]),
        /* progress toward the 5-minute cap, thin, right under the clock */
        h('div', { class: 'v11-side__cap' }, [
          h('div', { class: 'v11-side__capfill', id: 'v11-hud-capfill' })
        ]),
        h('div', { class: 'v11-side__checks' }, [
          checkRow('hoop',   t('cam.chk.hoop')),
          checkRow('ball',   t('cam.chk.ball')),
          checkRow('player', t('cam.chk.player')),
          checkRow('rec',    t('cam.chk.rec'))
        ])
      ]),

      /* Secondary, for when you walk back in. Framed as DETECTED, never as
         a score — the verdicts come from the analysis afterwards. */
      h('div', { class: 'v11-hud__meta' }, [
        h('span', { class: 'v11-hud__chip' }, [
          h('span', { class: 'v11-hud__chipnum', id: 'v10-cam-num', text: '0' }),
          h('span', { class: 'v11-hud__chiplbl', text: t('cam.hud.detected') })
        ])
      ]),

      /* Boxed like everything else — a bare shadowed string over live
         video is unreadable the moment the footage behind it is light. */
      h('div', { class: 'v11-hud__lost', id: 'v11-hud-lost', style: { display: 'none' },
        text: t('cam.hud.lost') }),

      /* The mark, quietly, for the whole session — this is the footage
         the player shares. */
      h('div', { class: 'v11-hud__brand' }, [
        brandMark(22),
        h('span', { class: 'v11-hud__brandname' }, [
          document.createTextNode('COURT'), h('em', { text: 'IQ' })
        ])
      ]),

      /* DIAGNOSTIC: which ORT execution provider actually won on THIS
         device. Desktop Chrome gets webgpu; a phone WebView may silently
         fall back to wasm (~1.4s/inference), which starves the real-time
         path — and that is invisible without saying so out loud. Debug
         builds only: on a shipped session it is unexplained noise. */
      window.__courtiqDebug ? h('div', { id: 'v10-backend-badge', class: 'v11-hud__diag',
        text: 'backend …' }) : null
    ].filter(Boolean));
  }

  /* The real CourtIQ mark — the hand-and-ball logo, transparent so it
     sits cleanly in the white session chip. Portrait aspect (~0.75), so
     we size by height and let width follow. */
  function brandMark(size) {
    return h('img', {
      src: 'assets/logomark.svg', alt: '',
      style: { height: size + 'px', width: 'auto', display: 'block' }
    });
  }

  /* ── the loading animation — the logo, brought to life ──────────
     The brand mark is a hand spinning a ball. Here it MOVES: the ball
     drops off the fingertip, bounces on the floor, and rises back to
     spin on the finger — looping. The spin is the boot-splash trick
     (longitude seams MARCHING sideways inside a circular clip), which
     is the one way a ball can spin without its stripes ever smearing —
     exactly the failure every AI-video attempt hit. A motion swirl
     rides with the ball; COURTIQ sits underneath. Pure SVG/CSS: crisp
     at any size, deterministic, offline. */
  function logoLoader() {
    var wrap = h('div', { class: 'v12-load' });
    var stage = h('div', { class: 'v12-load__stage' });
    stage.innerHTML =
      '<div class="v12-load__floor"></div>' +
      '<svg class="v12-load__finger" viewBox="0 0 44 78" aria-hidden="true">' +
        '<path d="M22 3 C15 3 13 12 13 22 L12 52 C12 54 12 56 13 58 C10 60 8 64 8 69 C8 74 12 76 18 76 L28 76 C33 76 36 73 36 68 L36 34 C36 30 33 27 29 27 C29 20 30 12 26 6 C25 4 24 3 22 3 Z" fill="#0A2850"/>' +
      '</svg>' +
      '<div class="v12-load__ballwrap">' +
        '<svg class="v12-load__swirl" viewBox="0 0 130 130" aria-hidden="true">' +
          '<ellipse cx="65" cy="65" rx="58" ry="24" fill="none" stroke="#0A2850" ' +
            'stroke-width="4" stroke-linecap="round" stroke-dasharray="120 210" opacity=".55"/>' +
        '</svg>' +
        '<svg class="v12-load__ball" viewBox="0 0 100 100" aria-hidden="true">' +
          '<defs>' +
            '<radialGradient id="v12ballG" cx="35%" cy="28%" r="90%">' +
              '<stop offset="0" stop-color="#FF8F45"/>' +
              '<stop offset=".6" stop-color="#FF4F1F"/>' +
              '<stop offset="1" stop-color="#C93407"/>' +
            '</radialGradient>' +
            '<clipPath id="v12ballClip"><circle cx="50" cy="50" r="46"/></clipPath>' +
          '</defs>' +
          '<circle cx="50" cy="50" r="46" fill="url(#v12ballG)"/>' +
          '<g clip-path="url(#v12ballClip)">' +
            '<path d="M4 50 q46 12 92 0" fill="none" stroke="#0A2850" stroke-width="3" opacity=".9"/>' +
            '<g class="v12-load__seams" fill="none" stroke="#0A2850" stroke-width="3" opacity=".9">' +
              '<path d="M4 50 q23 -46 46 0 q23 46 46 0" transform="translate(-46 0)"/>' +
              '<path d="M27 4 q0 46 0 92" transform="translate(-46 0)"/>' +
              '<path d="M4 50 q23 -46 46 0 q23 46 46 0"/>' +
              '<path d="M27 4 q0 46 0 92"/>' +
              '<path d="M4 50 q23 -46 46 0 q23 46 46 0" transform="translate(46 0)"/>' +
              '<path d="M27 4 q0 46 0 92" transform="translate(46 0)"/>' +
            '</g>' +
          '</g>' +
          '<circle cx="50" cy="50" r="46" fill="none" stroke="#C93407" stroke-width="2.5"/>' +
        '</svg>' +
      '</div>';
    wrap.appendChild(stage);
    return wrap;
  }

  /* Session clock + cap bar. The cap exists because analysis runs at
     roughly 2-3x the clip length on-device — an uncapped session is an
     unbounded wait afterwards. Shown as extent (a bar) as well as digits,
     because a bar is readable from the free-throw line and digits are not
     once you are past ~15ft. */
  function updateSessionClock() {
    var el = document.getElementById('v11-hud-timer');
    if (!el) return;
    var capMs = window.__COURTIQ_SESSION_MAX_MS || (5 * 60 * 1000);
    var ms = sessionStartAt ? (Date.now() - sessionStartAt) : 0;
    if (ms < 0) ms = 0;
    var total = Math.floor(ms / 1000);
    var txt = Math.floor(total / 60) + ':' + ('0' + (total % 60)).slice(-2);
    if (el.textContent !== txt) el.textContent = txt;
    var frac = Math.max(0, Math.min(1, ms / capMs));
    var fill = document.getElementById('v11-hud-capfill');
    if (fill) {
      fill.style.width = (frac * 100).toFixed(1) + '%';
      fill.classList.toggle('is-near', frac >= 0.8);
    }
  }

  /* The live checklist — what is the model seeing RIGHT NOW.
     Hoop from rimSeen() (live detection freshness), ball/player from the
     engine's freshness stamps, rec from the recorder itself. Ball gets a
     wider window than its detection cadence (~10/s) because a ball is
     legitimately absent between shots — the row should read "recently seen",
     not flicker on every dribble. */
  function updateChecklist() {
    var eng = window.ShotDetectionEngine;
    var now = Date.now();
    function setRow(key, on, warn) {
      var el = document.getElementById('v11-check-' + key);
      if (!el) return;
      el.classList.toggle('is-on', !!on);
      el.classList.toggle('is-warn', !on && !!warn);
    }
    setRow('hoop', rimSeen());
    var detWin = eng && eng._recordingIdle ? 5500 : 2000;   // idle = one pass/2.5s
    setRow('ball', eng && eng._diagLastBallAt && (now - eng._diagLastBallAt < detWin));
    setRow('player', eng && eng._diagLastPlayerAt && (now - eng._diagLastPlayerAt < detWin));
    var rec = null;
    try { rec = window.VideoReview && window.VideoReview.recordingState && window.VideoReview.recordingState(); } catch (e) {}
    // rec is a FAULT when off: an unrecorded session cannot be analysed.
    setRow('rec', rec && rec.active, true);
    var recDot = document.getElementById('v11-side-rec');
    if (recDot) recDot.classList.toggle('is-live', !!(rec && rec.active));
  }

  /* Reads the backend + a live diagnostic line: inference cost, how many
     YOLOX runs per second are actually happening, and — the key number —
     what fraction of those runs FIND a ball. A low ball-hit rate means the
     model cannot see the ball (distance / lighting / filming a screen); a
     low run rate means the loop is starved (compute). They point at
     completely different fixes, and this is how the phone tells us which. */
  var _diagWin = { runs: 0, hits: 0, t: 0 };   // window anchor
  var _diagShown = '';                          // last computed rate/ball text
  function backendLabel() {
    var eng = window.ShotDetectionEngine;
    if (!eng) return 'engine —';
    var be = eng._backend || '…';
    var ms = eng._inferMsEMA ? Math.round(eng._inferMsEMA) + 'ms' : '—';
    var now = Date.now();
    var runs = eng._diagYoloxRuns || 0, hits = eng._diagYoloxBallHits || 0;
    // Recompute the rate/ball% only every ~1.5s. Over the 250ms poll a WebGPU
    // loop only does ~2-3 inferences, so ball% would quantise to 0/33/50/100
    // and flicker; a 1.5s window gives a steady, readable number on device.
    if (!_diagWin.t) { _diagWin = { runs: runs, hits: hits, t: now }; }
    else if (now - _diagWin.t >= 1500) {
      var dt = (now - _diagWin.t) / 1000;
      var dr = runs - _diagWin.runs, dh = hits - _diagWin.hits;
      _diagShown = ' · ' + (dr / dt).toFixed(0) + '/s · ball ' +
                   (dr > 0 ? Math.round((dh / dr) * 100) : 0) + '%';
      _diagWin = { runs: runs, hits: hits, t: now };
    }
    var gpu = (typeof navigator !== 'undefined' && navigator.gpu) ? '' : ' no-webgpu';
    /* A failed recorder is otherwise invisible — put its own error string
       on the badge so a device report can simply read it out. */
    var recTxt = '';
    try {
      var recSt = window.VideoReview && window.VideoReview.recordingState && window.VideoReview.recordingState();
      if (recSt && !recSt.active) {
        var why = recSt.err || window.__recStartNote || '';
        if (why) recTxt = ' · rec✗ ' + why;
      }
    } catch (e) {}
    var bld = window.__COURTIQ_BUILD ? window.__COURTIQ_BUILD.split(' ')[0] + ' · ' : '';
    return bld + be + ' · ' + ms + _diagShown + gpu + recTxt;
  }

  /* ── Find engine state at runtime ─────────────────────────────── */
  function readEngineStats() {
    var madeEl = document.getElementById('st-made');
    var attEl  = document.getElementById('st-attempts');
    var made = madeEl ? parseInt(madeEl.textContent, 10) || 0 : 0;
    var att  = attEl  ? parseInt(attEl.textContent,  10) || 0 : 0;
    return { made: made, att: att };
  }

  /* ── v10 calibration banner — reads preflight progress from the
       engine's debug payload (window.__lastPreflight) which we wire from
       ShotTrackingScreen.js. ────────────────────────────────────────── */
  /* ── THE WALK-UP GATE ────────────────────────────────────────────
     Phase 9b hid this banner and stopped gating the COUNT on preflight.
     That reasoning was right — blocking counting on preflight is noise —
     but it removed the wrong gate and left the code behind as a corpse.

     The gate belongs on START. A clip recorded with the rim out of frame
     is unrecoverable: you shoot for twenty minutes, walk back, upload,
     and get "The hoop was not detected in this video" — a failure caused
     at record time and discovered far too late to fix. That's THE
     catastrophic failure mode of a tripod app.

     Rim only. Player and ball recover frame to frame; the rim is static,
     and if it's outside the crop it's outside for the whole clip.
     This is read with the phone in your hand, so it uses normal type. */
  var gateEl = null, rimStreak = 0, gatePassed = false;
  var sessionStartAt = 0;   // set when the user taps Start (not at mount)
  var sessionWake = null;    // screen wake lock held for the whole session
  var shotBaseline   = 0;   // attempts already counted during walk-up

  function readPreflight() {
    try { return window.__lastPreflight || {}; } catch (e) { return {}; }
  }

  /* Everything that marks "the session really begins NOW" -- used by BOTH
     gate buttons (the skip path used to miss all of it: dead clock, dirty
     count for any session started without a rim lock). */
  /* A tripod session dies silently when iOS auto-locks the screen (30-60s
     default) — the app suspends, recording and engine freeze mid-session.
     Hold a screen wake lock from Start to session end. Re-acquired on
     visibilitychange because iOS releases wake locks when the app is
     backgrounded and does NOT re-grant them automatically. */
  function acquireSessionWake() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (wl) {
          sessionWake = wl;
        }).catch(function () {});
      }
    } catch (e) {}
  }
  function releaseSessionWake() {
    try { if (sessionWake) { sessionWake.release(); sessionWake = null; } } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && sessionStartAt &&
        document.body.classList.contains('v10-cam-active')) {
      acquireSessionWake();
    }
  });

  function beginSessionBookkeeping() {
    acquireSessionWake();
    sessionStartAt = Date.now();
    try {
      var eng0 = window.ShotDetectionEngine;
      if (eng0 && eng0.resetStats) eng0.resetStats();
      shotBaseline = readEngineStats().att;
      /* Mutual exclusion pivot: the walk-up ran the engine at full rate
         (rim lock needs it); from here the RECORDING owns the chip and the
         engine drops to its framing watchdog. */
      try {
        if (window.ShotTrackingScreen && window.ShotTrackingScreen.beginSessionRecording) {
          window.ShotTrackingScreen.beginSessionRecording();
        }
      } catch (e) {}
      window.__v10SessionShots = [];
      var n0 = document.getElementById('v10-cam-num');
      if (n0) n0.textContent = '0';
    } catch (e) {}
  }

  /* Is the hoop being seen RIGHT NOW?
     This used to be `pf.hoop || pf.rimLocked` — and neither field exists.
     The engine emits preflight as { ready, checks:{ball,hoop,player},
     thresholds }, so both reads were permanently undefined, `seen` was
     permanently false, rimStreak never reached 3, the gate never unlocked
     and the session clock (which starts on the gate's Start tap) never
     began. That is the "timer never started" report.

     Prefer the engine's LIVE hoop detection and treat it as fresh only
     while it keeps changing, so "Lost the hoop" still works. Fall back to
     the preflight tally read in its ACTUAL shape. */
  var _hoopSig = '', _hoopSigAt = 0;
  function rimSeen() {
    var eng = window.ShotDetectionEngine;
    var pf  = readPreflight();
    var pfSeen = !!(pf.rimLocked || pf.hoop ||
                    (pf.checks && pf.checks.hoop >= ((pf.thresholds && pf.thresholds.hoop) || 5)));
    if (!eng) return pfSeen;
    var d = eng._lastHoopDetection;
    if (d) {
      var sig = d.cx + ',' + d.cy + ',' + d.score;
      var now = Date.now();
      if (sig !== _hoopSig) { _hoopSig = sig; _hoopSigAt = now; }
      var freshWin = (eng && eng._recordingIdle) ? 6500 : 3000;   // idle = one pass/2.5s
      if (now - _hoopSigAt < freshWin) return true;   // still updating = still seen
      return false;                                // frozen = hoop gone
    }
    return pfSeen;
  }

  function gateRow(key, label, iconName) {
    return h('div', { id: 'v11-gate-' + key, class: 'v11-gate__row' }, [
      h('i', { class: 'ph-bold ' + iconName }),
      h('span', { text: label }),
      h('span', { class: 'v11-gate__st', id: 'v11-gate-st-' + key, text: t('cam.gate.searching') })
    ]);
  }

  function audioToggle(key, label) {
    var on = window.V11Audio && window.V11Audio.prefs[key];
    var el = h('div', {
      class: 'v11-gate__tg' + (on ? ' is-on' : ''),
      role: 'button', tabindex: '0',
      onclick: function () {
        if (!window.V11Audio) return;
        var next = !window.V11Audio.prefs[key];
        window.V11Audio.set(key, next);
        el.classList.toggle('is-on', next);
        if (next) window.V11Audio.ok();
      }
    }, [
      h('i', { class: 'ph-fill ph-speaker-high' }),
      h('span', { text: label })
    ]);
    return el;
  }

  /* ── Gate-side court calibration ─────────────────────────────
     One saved homography per court+camera-spot (localStorage). The gate
     compares the CURRENT detected rim against the rim position stamped
     into the calibration record ('hoopRef'); a drift beyond ~5% of the
     frame means the phone moved and the meters would silently be wrong. */
  var CALIB_KEY = 'courtiq-calib-v1';
  var calibRestoreTried = false;
  function calibState() {
    var CP = window.CourtPosition, CC = window.CourtCalibration;
    if (!CP || !CC) return null;
    if (!CP.isCalibrated() && !calibRestoreTried) {
      calibRestoreTried = true;
      try { CC.restore(CALIB_KEY); } catch (e) {}
    }
    if (!CP.isCalibrated()) return 'none';
    var eng = window.ShotDetectionEngine;
    var rz = eng && eng.rimZone;
    if (!rz) return 'ok';                       // no rim yet — nothing to compare
    var ref = CC.getHoopRef(CALIB_KEY);
    if (!ref) {                                  // first calibrated session: bind
      try { CC.bindHoop(CALIB_KEY, rz.centerX, rz.centerY); } catch (e) {}
      return 'ok';
    }
    var moved = Math.abs(rz.centerX - ref.cx) > 0.05 ||
                Math.abs(rz.centerY - ref.cy) > 0.05;
    return moved ? 'moved' : 'ok';
  }
  function updateGateCalib() {
    var btn = document.getElementById('v11-gate-calib');
    if (!btn) return;
    var st = calibState();
    if (st === null) { btn.style.display = 'none'; return; }
    btn.style.display = '';
    var txt = document.getElementById('v11-gate-calib-t');
    var ico = document.getElementById('v11-gate-calib-i');
    btn.classList.toggle('is-ok', st === 'ok');
    btn.classList.toggle('is-moved', st === 'moved');
    if (txt) txt.textContent = st === 'ok' ? t('cam.gate.calibok')
                             : st === 'moved' ? t('cam.gate.calibmoved')
                             : t('cam.gate.calib');
    if (ico) ico.className = 'ph-bold ' + (st === 'ok' ? 'ph-check-circle' : 'ph-ruler');
  }
  function launchGateCalibration() {
    var eng = window.ShotDetectionEngine;
    var videoEl = eng && eng.videoEl;
    if (!videoEl || !window.CourtCalibration) return;
    var spec = localStorage.getItem('courtiq-court-spec') || 'us_hs';
    window.CourtCalibration.start(videoEl, {
      spec: spec,
      landmarkSet: 'lane',
      persistKey: CALIB_KEY,
      onDone: function (ok) {
        if (ok) {
          // re-bind the anchor to THIS camera position (if the rim isn't
          // locked yet, the next locked gate binds it via calibState)
          var rz = eng && eng.rimZone;
          if (rz) { try { window.CourtCalibration.bindHoop(CALIB_KEY, rz.centerX, rz.centerY); } catch (e) {} }
        }
        updateGateCalib();
      }
    });
  }

  function buildGate(onStart) {
    var startBtn = h('button', {
      class: 'v11-cta', type: 'button', disabled: 'disabled',
      style: { opacity: '.45' },
      onclick: function () {
        if (!gatePassed) return;
        if (window.V11Audio) { window.V11Audio.arm(); window.V11Audio.say('Recording'); }
        gateEl.style.display = 'none';
        beginSessionBookkeeping();
        onStart();
      }
    }, [h('span', { id: 'v11-gate-cta-t', text: t('cam.gate.point') })]);

    gateEl = h('div', { class: 'v11-gate', id: 'v11-gate' }, [
      /* v12: a real centered window — the same white card grammar as the
         rest of the app — sitting over the (dimmed) camera feed, so it
         reads as "set up before you start", not chrome floating on video. */
      h('div', { class: 'v11-gate__sheet' }, [
        h('div', { class: 'v11-gate__brand' }, [
          brandMark(24),
          h('span', { class: 'v11-gate__brandname' }, [
            document.createTextNode('COURT'), h('em', { text: 'IQ' })
          ])
        ]),
        h('div', { class: 'v11-gate__eye', text: t('cam.gate.eye') }),
        h('div', { class: 'v11-gate__t', text: t('cam.gate.title') }),
        h('div', { class: 'v11-gate__s', text: t('cam.gate.sub') }),
        gateRow('hoop', t('cam.gate.hoop'), 'ph-basketball'),
        /* Court calibration, INSIDE the session flow — the Track-screen
           card works, but nobody remembers a separate screen exists. The
           gate knows the rim; it can tell whether the saved homography
           still matches this camera position and offer the 4-tap fix
           right here (user: "why is calibration separate? I don't get
           how it works"). States: none / ok / camera-moved. */
        h('button', {
          class: 'v11-gate__calib', id: 'v11-gate-calib', type: 'button',
          style: { display: 'none' },
          onclick: function () { launchGateCalibration(); }
        }, [
          h('i', { class: 'ph-bold ph-ruler', id: 'v11-gate-calib-i' }),
          h('span', { id: 'v11-gate-calib-t', text: t('cam.gate.calib') })
        ]),
        h('div', { class: 'v11-gate__toggles' }, [
          audioToggle('tick', t('cam.gate.tick')),
          audioToggle('count', t('cam.gate.count'))
        ]),
        startBtn,
        /* The detector has real failure modes (scan-halfW collapses indoors,
           night footage, under-hoop angles). A hard block turns a detector
           miss into a product wall, so there's always a way through — we
           just flag it so post-session can explain a mystery zero. */
        h('button', {
          class: 'v11-cta v11-cta--ghost', type: 'button',
          onclick: function () {
            window.__v11RimLockAtRecord = false;
            if (window.V11Audio) window.V11Audio.arm();
            gateEl.style.display = 'none';
            /* Court bug: this skip path never did the session-start
               bookkeeping -- the clock stayed 0:00 all session. */
            beginSessionBookkeeping();
            onStart();
          }
        }, [h('span', { text: t('cam.gate.anyway') })])
      ])
    ]);
    document.body.appendChild(gateEl);
    return gateEl;
  }

  /* Asymmetric hysteresis: fast to trust (3 frames), slow to doubt
     (1.5s). Prevents strobing on a single dropped frame. */
  function updateGate() {
    if (gatePassed) return;
    updateGateCalib();
    var seen = rimSeen();
    rimStreak = seen ? rimStreak + 1 : 0;

    var row = document.getElementById('v11-gate-hoop');
    var st  = document.getElementById('v11-gate-st-hoop');
    if (row) row.classList.toggle('is-on', seen);
    if (st) st.textContent = seen ? t('cam.gate.locked') : t('cam.gate.searching');

    if (rimStreak >= 3) {
      gatePassed = true;
      window.__v11RimLockAtRecord = true;
      var btn = gateEl && gateEl.querySelector('.v11-cta');
      var ctaT = document.getElementById('v11-gate-cta-t');
      if (btn) { btn.removeAttribute('disabled'); btn.style.opacity = '1'; }
      if (ctaT) ctaT.textContent = t('cam.gate.start');
      if (window.V11Audio) { window.V11Audio.arm(); window.V11Audio.ok(); }
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
    }
  }

  /* Rim lost DURING a session — the one message worth interrupting for,
     and the only visual that survives 20ft is the full-screen wash. */
  var lostSince = 0, wasLost = false;
  function updateLive() {
    var hud = document.getElementById('v11-hud');
    if (!hud) return;
    var seen = rimSeen();
    var now = Date.now();
    if (seen) { lostSince = 0; }
    else if (!lostSince) { lostSince = now; }

    var engL = window.ShotDetectionEngine;
    var lostWin = (engL && engL._recordingIdle) ? 7000 : 3000;
    var lost = !!lostSince && (now - lostSince) > lostWin;
    /* Word-level status now lives in the right-side checklist
       (updateChecklist); this keeps only the full-screen lost wash. */
    if (lost !== wasLost) {
      wasLost = lost;
      hud.classList.toggle('v11-hud--lost', lost);
      hud.classList.toggle('v11-hud--live', !lost);
      var lbl = document.getElementById('v11-hud-lost');
      if (lbl) lbl.style.display = lost ? 'block' : 'none';
      if (window.V11Audio) {
        if (lost) window.V11Audio.fault();      // never toggleable — it's an alarm
        else window.V11Audio.say('Got it');
      }
    }
  }

  function startPolling() {
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = setInterval(function () {
      var s = readEngineStats();
      var numEl = document.getElementById('v10-cam-num');
      var shown = Math.max(0, s.att - shotBaseline);
      if (numEl && numEl.textContent !== String(shown)) numEl.textContent = String(shown);
      updateSessionClock();
      updateChecklist();
      var beEl = document.getElementById('v10-backend-badge');
      if (beEl) {
        var lbl = backendLabel();
        if (beEl.textContent !== lbl) beEl.textContent = lbl;
      }
      if (gatePassed) updateLive(); else updateGate();
      /* Camera watchdog status outranks hoop status on the banner — a dead
         feed is why the screen is black, and "Lost the hoop" over a black
         screen reads as a model failure instead of a camera one. */
      var camSt = window.__camStatus;
      var lostEl2 = document.getElementById('v11-hud-lost');
      var camTxt = lostEl2 ? lostEl2.textContent : '';
      var isCamTxt = camTxt === t('cam.hud.camRestarting') || camTxt === t('cam.hud.camStalled');
      if (lostEl2 && camSt && camSt !== 'ok') {
        lostEl2.textContent = camSt === 'restarting' ? t('cam.hud.camRestarting') : t('cam.hud.camStalled');
        lostEl2.style.display = 'block';
      } else if (lostEl2 && isCamTxt && (!camSt || camSt === 'ok')) {
        lostEl2.textContent = t('cam.hud.lost');
        lostEl2.style.display = 'none';
      }
    }, 250);
  }

  function stopPolling() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
  }

  var v10ShotListener = null;

  function mountChrome() {
    if (v10Layer && v10Layer.parentNode) return;
    rimStreak = 0; gatePassed = false; lostSince = 0; wasLost = false;
    sessionStartAt = 0; shotBaseline = 0;
    v10Layer = document.createElement('div');
    v10Layer.id = 'v10-cam-layer';
    v10Layer.appendChild(hudLayer());
    document.body.appendChild(v10Layer);
    /* The gate sits above the HUD until the rim locks. */
    buildGate(function () { /* the engine is already running; the gate just lifts */ });

    // ── Current-session shot log ────────────────────────────────
    // Post-session reads window.__v10SessionShots to render the recap
    // with ONLY this session's shots (not historical zone aggregates).
    // Reset at session start; append on every shot fire.
    window.__v10SessionShots = [];
    // LIVE sessions are counter-only (M3): made stays null everywhere,
    // and post-session renders the counter recap variant.
    window.__v10SessionMode = 'counter';

    // Live shot-zone push — engine dispatches 'v10:shot' on every shot finalisation
    v10ShotListener = function (ev) {
      if (!ev || !ev.detail) return;
      var detail = Object.assign({}, ev.detail, { made: null });
      // Persist for post-session view
      window.__v10SessionShots.push({
        made:       null,
        v10Zone:    detail.v10Zone || 'top',
        feetXNorm:  detail.feetXNorm,
        feetYNorm:  detail.feetYNorm,
        ts:         detail.ts || Date.now()
      });

      /* Shot registered. The tick is immediate — it's a receipt, not
         feedback, and past ~250ms it stops binding to the shot and starts
         reading as a malfunction. The spoken count lags deliberately. */
      if (window.V11Audio) {
        window.V11Audio.tick();
        window.V11Audio.count(window.__v10SessionShots.length);
      }
      try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}

      /* A ~325pt numeral pulsing 12% is a large-area motion event — the
         only kind that reads at 20ft, in peripheral vision. */
      var numEl = document.getElementById('v10-cam-num');
      if (numEl) {
        numEl.classList.remove('is-pop'); void numEl.offsetWidth;
        numEl.classList.add('is-pop');
      }
    };
    document.body.addEventListener('v10:shot', v10ShotListener);
  }

  function unmountChrome() {
    releaseSessionWake();
    /* Leaving the session: hand the engine back its full cadence, or the
       next non-recorded use (and the offline analyser, which drives the same
       engine) would inherit the throttle. The clip hook is NOT cleared here:
       enterSummaryPhase captures it synchronously, but the recorder resolves
       async — clearing on unmount would race a legitimate hand-off. It is
       one-shot (nulls itself) and re-registered per mount. */
    try {
      if (window.ShotDetectionEngine) {
        window.ShotDetectionEngine._lowPowerMode = false;
        window.ShotDetectionEngine._recordingIdle = false;
      }
    } catch (e) {}
    if (v10Layer && v10Layer.parentNode) v10Layer.parentNode.removeChild(v10Layer);
    v10Layer = null;
    if (gateEl && gateEl.parentNode) gateEl.parentNode.removeChild(gateEl);
    gateEl = null;
    if (v10ShotListener) {
      document.body.removeEventListener('v10:shot', v10ShotListener);
      v10ShotListener = null;
    }
    stopPolling();
  }

  /* ── p11: OFFLINE upload analysis ─────────────────────────────
     An uploaded video is processed FRAME-BY-FRAME (ShotOfflineProcessor)
     instead of the real-time engine. This is the only path that produces
     accurate made/miss on distant footage — the dense per-frame ball
     trajectory lets the polyfit arc predictor decide whether each shot
     actually went through the rim. Shows a progress screen, saves the
     session, then routes to the post-session recap. ANY failure falls
     back to the live real-time path so an upload can never strand the
     user on a blank screen. */
  function saveOfflineSession(res) {
    var now = new Date();
    var sessionId = 'ai_' + now.getTime() + '_' + Math.random().toString(36).slice(2, 8);
    var userId = (window.currentUser && window.currentUser.id) || 'anonymous';
    var total = res.total || 0;
    var made  = res.made || 0;
    var shots = (res.shots || []).map(function (s, i) {
      return {
        session_id:             sessionId,
        user_id:                userId,
        shot_result:            s.result,
        shot_x:                 s.shotX,
        shot_y:                 s.shotY,
        launch_x:               s.launchPoint ? s.launchPoint.x : null,
        launch_y:               s.launchPoint ? s.launchPoint.y : null,
        shot_zone:              s.v10Zone || s.shotZone || 'paint',
        ball_trajectory_points: s.trajectory || [],
        timestamp:              new Date(now.getTime() + Math.round((s.__videoT || 0) * 1000)).toISOString(),
        shot_number:            i + 1
      };
    });
    var sessionPayload = {
      id:             sessionId,
      user_id:        userId,
      session_date:   now.toISOString(),
      session_type:   'ai_tracking',
      duration_ms:    Math.round((res.duration || 0) * 1000),
      total_attempts: total,
      total_made:     made,
      accuracy:       total ? Math.round((made / total) * 100) : 0,
      max_streak:     0,
      xp_earned:      made * 10 + total * 2,
      fg_made: 0, fg_missed: 0, three_made: 0, three_missed: 0,
      ft_made: made, ft_missed: total - made
    };
    if (window.ShotService && window.ShotService.saveSessionAtomic) {
      return window.ShotService.saveSessionAtomic(sessionPayload, shots).catch(function () {});
    }
    return Promise.resolve();
  }

  function runOfflineUpload(file, ctx) {
    var bar = h('div', { style: { height: '100%', width: '0%', background: 'var(--d-orange)', borderRadius: '99px', transition: 'width .25s ease' } });
    var pct = h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--d-ink)', fontWeight: '700' }, text: '0%' });
    var stageEl = h('div', { style: { fontFamily: 'var(--d-font)', fontWeight: '600', fontSize: '13px', color: 'var(--d-body)', marginTop: '2px' }, text: t('cam.anl.loading') });
    // Debug-only: engine/timing readout. Ships hidden — see __courtiqDebug.
    var diagEl = h('div', { style: {
      fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--d-mute)',
      marginTop: '2px', display: window.__courtiqDebug ? 'block' : 'none'
    }, text: '' });

    // Rotating tip to keep the wait engaging (see the timer below).
    var tipEl = h('div', { class: 'v12-anl__tip' }, [
      h('span', { class: 'v12-anl__tiplabel', text: t('cam.anl.tiplabel') }),
      h('span', { class: 'v12-anl__tiptext', text: t(ANALYZE_TIPS[0]) })
    ]);

    // ── LIVE ANALYSIS VIEW ─────────────────────────────────────
    // The processor hands back every analyzed frame + detections via
    // onFrame; we draw the video with ball circles, the measured ring
    // line/span, player boxes, and pop MADE/MISS the moment each attempt
    // window closes (same classifyRange math as the final results).
    // The canvas fills whatever space the column leaves over (flex area
    // below), so the video is as LARGE as possible on every screen —
    // portrait or landscape — while title/progress stay visible.
    var liveCanvas = h('canvas', { style: {
      width: 'auto', height: 'auto', display: 'block',
      maxWidth: 'min(92vw, 560px)', maxHeight: '100%',
      borderRadius: '16px', border: '2px solid var(--d-line-2)',
      boxShadow: '0 4px 0 var(--d-line-2)', background: '#000'
    } });
    liveCanvas.width = 640; liveCanvas.height = 360;
    var flashEl = h('div', {
      style: {
        position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'var(--font-display)', fontWeight: '900', fontSize: 'clamp(22px, 3.4dvh, 30px)',
        letterSpacing: '0.1em', textShadow: '0 2px 10px rgba(0,0,0,0.75)',
        opacity: '0', transition: 'opacity .25s ease', pointerEvents: 'none'
      }
    });
    // Holder hugs the canvas so the MADE/MISS flash rides ON the video
    var canvasHolder = h('div', { style: { position: 'relative', maxHeight: '100%', display: 'flex' } },
      [liveCanvas, flashEl]);
    var liveWrap = h('div', { style: {
      flex: '1 1 auto', minHeight: '0', width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: 'clamp(6px, 1.2dvh, 12px) 0 clamp(2px, 0.5dvh, 4px)'
    } }, [canvasHolder]);
    var dotsEl = h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', margin: '10px 0 2px', minHeight: '13px' } });
    var liveCount = h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--d-body)', minHeight: '15px' }, text: '' });

    // The logo, brought to life — the loading screen. Hides once real
    // analysis frames start flowing and the canvas takes over.
    var loaderEl = logoLoader();

    var overlay = h('div', {
      style: {
        position: 'fixed', inset: '0', background: 'var(--d-bg, #FFFFFF)', color: 'var(--d-ink)', zIndex: '70',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        // Fit-to-viewport: safe-area aware (notch / home indicator),
        // fluid vertical costs — the flex canvas area absorbs the rest.
        padding: 'calc(var(--safe-top, 0px) + clamp(10px, 2dvh, 22px)) 16px calc(var(--safe-bottom, 0px) + clamp(10px, 2dvh, 22px))',
        textAlign: 'center', overflow: 'hidden'
      }
    }, [
      h('div', { class: 'v12-anl__brand' }, [
        brandMark(20),
        h('span', { class: 'v12-anl__brandname' }, [
          document.createTextNode('COURT'), h('em', { text: 'IQ' })
        ])
      ]),
      loaderEl,
      h('div', { style: { fontFamily: 'var(--d-font)', fontSize: 'clamp(16px, 2.6dvh, 20px)', fontWeight: '900', color: 'var(--d-ink)', flexShrink: '0' }, text: t('cam.anl.title') }),
      liveWrap,
      dotsEl,
      liveCount,
      h('div', { style: { width: '72%', maxWidth: '320px', height: 'clamp(7px, 1dvh, 9px)', background: 'rgba(10,40,80,0.12)', borderRadius: '99px', margin: 'clamp(6px, 1.2dvh, 12px) 0 clamp(3px, 0.7dvh, 6px)', overflow: 'hidden', flexShrink: '0' } }, [bar]),
      pct,
      stageEl,
      tipEl,
      diagEl
    ]);
    // Two soft brand-coloured blobs drift behind everything so the screen
    // is alive during a long analyse instead of a static white wait.
    overlay.appendChild(h('div', { class: 'v12-anl__glow v12-anl__glow--a' }));
    overlay.appendChild(h('div', { class: 'v12-anl__glow v12-anl__glow--b' }));
    document.body.appendChild(overlay);
    v10Layer = overlay;

    /* Rotating coaching tips — the analyse can run 2-3x the clip length,
       and a wall of progress bar is where people get bored and leave. The
       tips are also genuinely useful: every one is a "next clip is better"
       nudge. Self-cleaning: stops the moment the overlay is gone. */
    var tipI = 0;
    var tipTimer = setInterval(function () {
      if (!overlay.parentNode) { clearInterval(tipTimer); return; }
      tipI = (tipI + 1) % ANALYZE_TIPS.length;
      var tt = tipEl.querySelector('.v12-anl__tiptext');
      if (!tt) return;
      tt.style.opacity = '0';
      setTimeout(function () { tt.textContent = t(ANALYZE_TIPS[tipI]); tt.style.opacity = '1'; }, 220);
    }, 4200);

    var lctx = liveCanvas.getContext('2d');
    var lastShotCount = 0, lastShotSig = '', flashTimer = null, aspectSet = false;
    function drawLive(fd) {
      if (loaderEl.style.display !== 'none') loaderEl.style.display = 'none';
      var W = liveCanvas.width, H = liveCanvas.height;
      if (!aspectSet && fd.video.videoWidth > 0) {
        liveCanvas.height = Math.round(640 * fd.video.videoHeight / fd.video.videoWidth);
        H = liveCanvas.height; aspectSet = true;
      }
      try { lctx.drawImage(fd.video, 0, 0, W, H); } catch (e) { return; }
      // measured ring: green line + span ticks
      if (fd.ring) {
        var ry = fd.ring.y * H;
        var rl = (fd.ring.cx - fd.ring.halfW) * W;
        var rr = (fd.ring.cx + fd.ring.halfW) * W;
        lctx.strokeStyle = 'rgba(90,255,130,0.95)';
        lctx.lineWidth = 2;
        lctx.beginPath(); lctx.moveTo(rl - 16, ry); lctx.lineTo(rr + 16, ry); lctx.stroke();
        lctx.lineWidth = 3;
        lctx.beginPath(); lctx.moveTo(rl, ry - 10); lctx.lineTo(rl, ry + 10); lctx.stroke();
        lctx.beginPath(); lctx.moveTo(rr, ry - 10); lctx.lineTo(rr, ry + 10); lctx.stroke();
      }
      // ball candidates: yellow circles (brighter = higher confidence)
      var balls = (fd.dets && fd.dets.balls) || [];
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        lctx.strokeStyle = 'rgba(255,214,0,' + Math.min(1, 0.45 + b.s) + ')';
        lctx.lineWidth = 2.5;
        lctx.beginPath(); lctx.arc(b.x * W, b.y * H, 9, 0, Math.PI * 2); lctx.stroke();
      }
      // players: thin white boxes
      var players = (fd.dets && fd.dets.players) || [];
      lctx.strokeStyle = 'rgba(255,255,255,0.45)';
      lctx.lineWidth = 1.5;
      for (var p = 0; p < players.length; p++) {
        var pl = players[p];
        lctx.strokeRect((pl.x - pl.w / 2) * W, (pl.y - pl.h / 2) * H, pl.w * W, pl.h * H);
      }
      // time chip
      lctx.fillStyle = 'rgba(0,0,0,0.55)';
      lctx.fillRect(6, 6, 96, 20);
      lctx.fillStyle = '#fff';
      lctx.font = '11px monospace';
      lctx.fillText(fd.t.toFixed(1) + 's · ' + Math.round(fd.frac * 100) + '%', 12, 20);
      // rim status chip (top-right): searching / locked / approx
      var rimLabel = !fd.ring ? 'RIM: SEARCHING…' : (fd.ring.fb ? 'RIM: APPROX' : 'RIM: LOCKED');
      var rimColor = !fd.ring ? '#FF6B5E' : (fd.ring.fb ? '#FFC24B' : '#5BE37D');
      lctx.font = 'bold 11px monospace';
      var tw = lctx.measureText(rimLabel).width;
      lctx.fillStyle = 'rgba(0,0,0,0.55)';
      lctx.fillRect(W - tw - 18, 6, tw + 12, 20);
      lctx.fillStyle = rimColor;
      lctx.fillText(rimLabel, W - tw - 12, 20);
      // shot dots + verdict flash. Repaint on any SIGNATURE change (early
      // verdicts can self-correct while the ring median converges), flash
      // only when a NEW shot closes.
      // Reveal-gating (device report: MADE/MISS popped out of sync with the
      // replay): a verdict only becomes visible once the replay time passes
      // the attempt's on-screen resolution moment (tEnd from the classifier).
      var shotsAll = fd.shots || [];
      var shots = [];
      for (var sg = 0; sg < shotsAll.length; sg++) {
        if (shotsAll[sg].tEnd == null || fd.t >= shotsAll[sg].tEnd - 0.05) shots.push(shotsAll[sg]);
      }
      var sig = shots.map(function (s) { return s.result === 'made' ? 'M' : 'X'; }).join('');
      if (sig !== lastShotSig) {
        dotsEl.innerHTML = '';
        var made = 0;
        for (var si = 0; si < shots.length; si++) {
          if (shots[si].result === 'made') made++;
          dotsEl.appendChild(h('span', {
            style: {
              width: '11px', height: '11px', borderRadius: '50%', display: 'inline-block',
              background: shots[si].result === 'made' ? 'var(--d-green)' : 'var(--d-red)',
              border: '2px solid rgba(10,40,80,0.2)'
            }
          }));
        }
        liveCount.textContent = t('cam.anl.count', { n: shots.length, m: made, x: shots.length - made });
        if (shots.length > lastShotCount) {
          var last = shots[shots.length - 1];
          flashEl.textContent = last.result === 'made' ? t('cam.flash.made') : t('cam.flash.miss');
          flashEl.style.color = last.result === 'made' ? '#5BE37D' : '#FF6B5E';
          flashEl.style.opacity = '1';
          if (flashTimer) clearTimeout(flashTimer);
          flashTimer = setTimeout(function () { flashEl.style.opacity = '0'; }, 900);
        }
        lastShotCount = shots.length;
        lastShotSig = sig;
      }
    }

    function fallbackToRealtime() {
      window.__v10AnalysisOwnsFlow = false;
      try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
      v10Layer = null;
      try {
        window.__v10PendingVideoFile = null;
        if (ctx.data.openFromFile && ctx.data.openFromFile(file)) { mountChrome(); startPolling(); }
      } catch (e) {}
    }

    /* iOS suspends the WebView the moment the screen locks or the app is
       backgrounded — a court-length analysis (2-3x clip length) then
       freezes mid-run and reads as "analyze is dead". Hold a screen wake
       lock for the duration and SAY the phone has to stay open. */
    var wakeLock = null;
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (wl) { wakeLock = wl; }).catch(function () {});
      }
    } catch (e) {}
    function releaseWake() { try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {} }
    stageEl.textContent = t('cam.anl.keepOpen');

    var analysisT0 = Date.now();
    window.ShotOfflineProcessor.process(file, {
      /* 15, not 30. Measured against the full hand-annotated GT suite
         (night_b/c/d + portrait_v3): verdicts at 15fps are IDENTICAL to
         30fps (16/17, same per-video breakdown), while 10fps loses a make.
         Half the frames = half the wait the user actually feels after
         every session. */
      fps: 15,
      // Show the execution provider alongside progress: on a phone WebView
      // that fell back to wasm this is the whole explanation for a slow
      // analyze, and it is otherwise invisible.
      onProgress: function (f) {
        var p = Math.round(f * 100);
        bar.style.width = p + '%';
        /* Remaining-time estimate from the measured rate so far. Held back
           until 4% so one slow model-load frame cannot produce a wild
           number; simple linear projection is honest enough at this scale. */
        var eta = '';
        if (f > 0.04) {
          var remMs = (Date.now() - analysisT0) * (1 / f - 1);
          var mm = Math.floor(remMs / 60000), ss = Math.round((remMs % 60000) / 1000);
          eta = t('cam.anl.eta', { t: (mm > 0 ? mm + 'm ' + ('0' + ss).slice(-2) + 's' : ss + 's') });
        }
        pct.textContent = p + '%' + eta;
        diagEl.textContent = backendLabel();
      },
      onStage: function (s) { stageEl.textContent = STAGE_KEYS[s] ? t(STAGE_KEYS[s]) : s; },
      onFrame: drawLive
    }).then(function (res) {
      releaseWake();
      // Device benchmark readout (M2): post-session shows engine + timing —
      // readable straight off an iPhone screen, no Web Inspector needed.
      try {
        var eng2 = window.ShotDetectionEngine;
        window.__v10AnalysisInfo = {
          ms: Date.now() - analysisT0,
          videoSec: (res && res.duration) || 0,
          frames: (res && res.frames) || 0,
          ep: (eng2 && eng2._detectorType) || '?'
        };
      } catch (e) {}
      // If nothing was detected, tell the user WHY instead of a silent
      // "0 of 0" recap. The diag says whether the hoop was ever found /
      // the rim locked — the two reasons a whole clip yields no shots.
      if (!res || res.total === 0) {
        var d = (res && res.diag) || {};
        var reason = !d.rimLocked ? t('cam.noshot.norim') : t('cam.noshot.noarcs');
        var diagLine = 'hoop frames: ' + (d.hoopDetections || 0) + ' (max conf ' + (d.hoopMaxConf != null ? d.hoopMaxConf : '?') + ', tier ' + (d.usedTier || '?') + ') · rim: ' + (d.rimLocked ? 'locked' : 'not found') + ' · frames: ' + (d.frames || 0) +
          ' · ball: ' + (d.rawBallFrames != null ? d.rawBallFrames : '?') + 'f raw / ' + (d.nearRimFrames != null ? d.nearRimFrames : '?') + 'f near / ' + (d.aboveRingFrames != null ? d.aboveRingFrames : '?') + 'f above · win: ' + (d.windows != null ? d.windows : '?') +
          (d.offlineErr ? ' · err: ' + d.offlineErr + ' ×' + (d.offlineErrN || 0) : '') +
          (d.taintFixed ? ' · taint-fixed' : '');
        stageEl.textContent = '';
        overlay.innerHTML = '';

        var goHome = function () {
          window.__v10AnalysisOwnsFlow = false;
          try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
          v10Layer = null;
          document.body.classList.remove('v10-cam-active');
          setNav(true);
          window.app.go('home');
        };
        var goTrack = function () {
          window.__v10AnalysisOwnsFlow = false;
          try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
          v10Layer = null;
          document.body.classList.remove('v10-cam-active');
          setNav(true);
          window.app.go('track');
        };

        var homeBtn = h('button', { class: 'd-btn v12-noshot__cta', type: 'button', onclick: goHome },
          [h('i', { class: 'ph-bold ph-house' }), h('span', { text: t('cam.noshot.home') })]);
        var retryBtn = h('button', { class: 'd-btn d-btn--ghost v12-noshot__cta', type: 'button', onclick: goTrack },
          [h('i', { class: 'ph-bold ph-video-camera' }), h('span', { text: t('cam.noshot.retry') })]);

        var card = h('div', { class: 'v12-noshot' }, [
          h('div', { class: 'v12-anl__brand' }, [
            brandMark(20),
            h('span', { class: 'v12-anl__brandname' }, [document.createTextNode('COURT'), h('em', { text: 'IQ' })])
          ]),
          h('div', { class: 'v12-noshot__icon' }, [h('i', { class: 'ph-fill ph-basketball' })]),
          h('div', { class: 'v12-noshot__t', text: t('cam.noshot.title') }),
          h('div', { class: 'v12-noshot__s', text: reason }),
          window.__courtiqDebug ? h('div', { class: 'v12-noshot__diag', text: diagLine }) : null,
          h('div', { class: 'v12-noshot__btns' }, [homeBtn, retryBtn])
        ].filter(Boolean));
        overlay.appendChild(card);
        return;
      }
      /* Results are in — say so out loud. The user was told to walk away
         while the clip is analysed; audio + a buzz is what actually reaches
         them when the phone is face-up on a bench. */
      try { if (window.V11Audio && window.V11Audio.say) window.V11Audio.say('Analysis complete'); } catch (e) {}
      try { if (navigator.vibrate) navigator.vibrate([40, 90, 40]); } catch (e) {}
      // Post-session renders ONLY window.__v10SessionShots — populate it
      // from the offline results exactly like the real-time listener does.
      window.__v10SessionMode = 'verdict';   // upload = full made/miss recap
      window.__v10SessionShots = (res.shots || []).map(function (s, i) {
        return {
          made:      s.result === 'made',
          v10Zone:   s.v10Zone || 'top',
          feetXNorm: s.shotX,
          feetYNorm: s.shotY,
          /* `why` was computed and thrown away. It's the uncertainty flag
             we already pay for: classifyRange only returns 'made' on
             POSITIVE evidence (ring-cross / inside-net / dwell), and
             'missed' is the fallthrough — 'no through evidence'. So a
             miss with that reason isn't "I saw it miss", it's "I never
             saw it at all", which is the shot most likely to be wrong and
             worth showing the user. No new model, no calibration. */
          why:       s.why || null,
          videoT:    s.__videoT,
          i:         i
        };
      });
      return saveOfflineSession(res).then(function () {
        window.__v10AnalysisOwnsFlow = false;
        try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
        v10Layer = null;
        document.body.classList.remove('v10-cam-active');
        setNav(true);
        window.app.go('post-session');
      });
    }).catch(function () { releaseWake(); fallbackToRealtime(); });
  }

  function render(args) {
    var ctx = args.ctx;

    // The v10 host stays empty — the real overlay is fixed on body.
    setNav(false);
    document.body.classList.add('v10-cam-active');

    // Open the real shot-tracker overlay (camera + YOLO + pose). If the
    // user came via "TEST WITH VIDEO FILE" a pending File is stashed on
    // window.__v10PendingVideoFile — consume it and feed the engine
    // frames from that file instead of opening the live camera.
    var available = false;
    var pendingFile = window.__v10PendingVideoFile;

    // p11: uploaded videos go through the OFFLINE analyzer (accurate
    // made/miss). Live camera keeps the real-time path.
    if (pendingFile && window.ShotOfflineProcessor && window.ShotOfflineProcessor.process) {
      window.__v10PendingVideoFile = null;
      runOfflineUpload(pendingFile, ctx);
      return;   // offline path owns the rest of the flow
    }

    try {
      if (pendingFile && ctx.data.openFromFile) {
        window.__v10PendingVideoFile = null;
        available = !!ctx.data.openFromFile(pendingFile);
      } else {
        available = !!ctx.data.startShotTracking();
      }
    } catch (e) { available = false; }

    if (!available) {
      // Fallback message — tracker module not loaded.
      var msg = h('div', {
        style: {
          position: 'fixed', inset: '0', background: 'var(--d-bg, #FFFFFF)', color: 'var(--d-ink)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '30px', textAlign: 'center', zIndex: '60'
        }
      }, [
        h('i', { class: 'ph-bold ph-camera-slash', style: { fontSize: '56px', color: 'var(--d-gold-deep)', marginBottom: '12px' } }),
        h('div', { style: { fontFamily: 'var(--d-font)', fontSize: '22px', fontWeight: '900', color: 'var(--d-ink)' }, text: t('cam.unavail.title') }),
        h('div', { style: { fontFamily: 'var(--d-font)', fontWeight: '500', fontSize: '14px', marginTop: '8px', color: 'var(--d-body)' }, text: t('cam.unavail.sub') })
      ]);
      document.body.appendChild(msg);
      v10Layer = msg;
    } else {
      // Mount v10 chrome over the camera; mini-court starts EMPTY and
      // fills live as the engine dispatches v10:shot events per shot.
      mountChrome();
      startPolling();

      /* Record-then-analyse: when the user ends the session,
         ShotTrackingScreen hands the recorded clip here instead of showing
         its legacy summary, and the SAME offline pipeline that scores
         uploads (9/9 on real footage) scores the session. One-shot: the
         hook nulls itself so a stale consumer can never fire twice. */
      window.__v10OnSessionClip = function (data) {
        window.__v10OnSessionClip = null;
        unmountChrome();
        if (data && data.blob) {
          var mime = data.blob.type || 'video/webm';
          var name = 'session.' + (mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm');
          var file;
          try { file = new File([data.blob], name, { type: mime }); }
          catch (e) { file = data.blob; }   // Blob works too — process() only createObjectURLs it
          document.body.classList.add('v10-cam-active');
          runOfflineUpload(file, ctx);
        } else {
          /* No clip captured (recorder unsupported / failed) — the live
             counter recap is all the truth we have; land there instead of
             stranding the user. */
          window.__v10AnalysisOwnsFlow = false;
          document.body.classList.remove('v10-cam-active');
          setNav(true);
          ctx.go('post-session');
        }
      };
    }

    // Watch the tracker close to clean up our chrome too.
    setTimeout(function () {
      var screen = document.getElementById('shot-tracking-screen');
      if (!screen) return;
      var wasActive = screen.classList.contains('active');
      var obs = new MutationObserver(function () {
        var isActive = screen.classList.contains('active');
        if (wasActive && !isActive) {
          obs.disconnect();
          unmountChrome();
          document.body.classList.remove('v10-cam-active');
          setNav(true);
        }
        wasActive = isActive;
      });
      obs.observe(screen, { attributes: true, attributeFilter: ['class'] });
    }, 500);

    // If user uses the v10 nav (rare; nav is hidden) — clean up before route change.
    var leaveObs = new MutationObserver(function () {
      if (window.__v10AnalysisOwnsFlow) return;   // analysis overlay owns v10Layer now
      if (document.body.getAttribute('data-screen') !== 'camera-hud') {
        unmountChrome();
        document.body.classList.remove('v10-cam-active');
        setNav(true);
        leaveObs.disconnect();
      }
    });
    leaveObs.observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
  }

  window.app.register('camera-hud', render);
})();
