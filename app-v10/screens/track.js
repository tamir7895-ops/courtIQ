/* app-v10/screens/track.js — v12
   TRACKING — track + train merged into one tab, per the user's sketch:

     court hero (the real NBA half court, zone heat)
     HEAT MAP · SESSIONS · INSIGHTS  (segmented views)
     SESSION START
     DRILL LIBRARY · CUSTOMIZE YOUR TRAINING PLAN

   Everything sample-size-gated exactly as v11 had it: a thin zone shows
   a fraction, never a percentage; the headline needs MIN_TOTAL. The
   court geometry and shrinkage live in lib/court.js — one court, one
   truth. M4 rule: every number is real or the element says so.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg;
  var C = window.V11Court;
  var V12 = window.V12;

  var T = {
    en: {
      'track.view.map': 'Heat map',
      'track.view.sessions': 'Sessions',
      'track.view.insights': 'Insights',
      'track.map.aria': 'Your shot map by zone',
      'track.legend.hot': 'Hot',
      'track.legend.cold': 'Cold',
      'track.legend.under': 'Under {n} shots',
      'track.fg30': 'FG · 30D',
      'track.made30': 'MADE · 30D',
      'track.shots': 'SHOTS',
      'track.scored': 'SCORED',
      'track.zone.shots': '{n} shots',
      'track.zone.none': 'none',
      'track.empty.title': 'Nothing on the court yet',
      'track.empty.body': 'Track a session or upload a video. Every shot lands on this map, zone by zone.',
      'track.empty.cta': 'Start a session',
      'track.byzone.rated': 'BY ZONE · {n} of 9 rated',
      'track.byzone.cov': 'BY ZONE · coverage',
      'track.note.thin': 'No zone has {n} scored shots yet, so none has a percentage. Below is what you actually took.',
      'track.today': 'Today',
      'track.yesterday': 'Yesterday',
      'track.sess.empty.title': 'No sessions yet',
      'track.sess.empty.body': 'Your first session shows up here the moment you finish it.',
      'track.sess.empty.cta': 'Track your first session',
      'track.sess.aria': 'Session {d}',
      'track.sess.live': '{a} shots · counted live',
      'track.sess.made': '{a} shots · {m} made',
      'track.ins.empty.title': 'The scout needs evidence',
      'track.ins.empty.body': 'Once a zone reaches {n} scored shots, the analysis starts here — strongest zone, weakest zone, and what to do about it.',
      'track.ins.empty.cta': 'Record a session',
      'track.ins.money': 'Your money zone: {z}',
      'track.ins.money.body': '{m} of {a} scored shots ({p}%). Build possessions that end here.',
      'track.ins.reps': 'Needs reps: {z}',
      'track.ins.reps.body': '{m} of {a} ({p}%). Spend 30 reps a session here until it warms up.',
      'track.ins.coach': 'Coach says',
      'track.court.hs': 'High school',
      'track.court.college': 'College',
      'track.court.nba': 'NBA',
      'track.court.fiba': 'FIBA',
      'track.calib.err': 'Could not open the camera to calibrate: {e}',
      'track.calib.unknown': 'unknown',
      'track.calib.done': 'Court calibrated',
      'track.calib.todo': 'Calibrate your court',
      'track.calib.done.sub': 'Shot distances and zones are mapped to real court meters.',
      'track.calib.todo.sub': 'Tap 4 court lines once, and every shot gets a true distance and zone.',
      'track.calib.type': 'COURT TYPE',
      'track.calib.redo': 'Recalibrate court',
      'track.calib.go': 'Calibrate court',
      'track.header': 'Tracking',
      'track.header.sub': 'Where the ball actually goes.',
      'track.start': 'Session start'
    },
    he: {
      'track.view.map': 'מפת חום',
      'track.view.sessions': 'אימונים',
      'track.view.insights': 'תובנות',
      'track.map.aria': 'מפת הזריקות שלך לפי אזור',
      'track.legend.hot': 'חם',
      'track.legend.cold': 'קר',
      'track.legend.under': 'פחות מ-{n} זריקות',
      'track.fg30': '⁨FG⁩ · 30 יום',
      'track.made30': 'קליעות · 30 יום',
      'track.shots': 'זריקות',
      'track.scored': 'נספרו',
      'track.zone.shots': '{n} זריקות',
      'track.zone.none': 'אין',
      'track.empty.title': 'עוד אין כלום על המגרש',
      'track.empty.body': 'תעד אימון או תעלה סרטון. כל זריקה נוחתת על המפה הזאת, אזור אחרי אזור.',
      'track.empty.cta': 'התחל אימון',
      'track.byzone.rated': 'לפי אזור · {n} מתוך 9 מדורגים',
      'track.byzone.cov': 'לפי אזור · כיסוי',
      'track.note.thin': 'אף אזור עוד לא הגיע ל-{n} זריקות שנספרו, אז אין עדיין אחוזים. למטה — מה שבאמת זרקת.',
      'track.today': 'היום',
      'track.yesterday': 'אתמול',
      'track.sess.empty.title': 'עוד אין אימונים',
      'track.sess.empty.body': 'האימון הראשון שלך יופיע כאן ברגע שתסיים אותו.',
      'track.sess.empty.cta': 'תעד את האימון הראשון',
      'track.sess.aria': 'אימון {d}',
      'track.sess.live': '{a} זריקות · נספרו בלייב',
      'track.sess.made': '{a} זריקות · {m} נכנסו',
      'track.ins.empty.title': 'הסקאוט צריך הוכחות',
      'track.ins.empty.body': 'ברגע שאזור מגיע ל-{n} זריקות שנספרו, הניתוח מתחיל כאן — האזור החזק, האזור החלש, ומה עושים עם זה.',
      'track.ins.empty.cta': 'צלם אימון',
      'track.ins.money': 'אזור הכסף שלך: {z}',
      'track.ins.money.body': '{m} מתוך {a} זריקות שנספרו ({p}%). תבנה מהלכים שנגמרים כאן.',
      'track.ins.reps': 'צריך חזרות: {z}',
      'track.ins.reps.body': '{m} מתוך {a} ({p}%). תשקיע כאן 30 חזרות באימון עד שהאזור מתחמם.',
      'track.ins.coach': 'המאמן אומר',
      'track.court.hs': 'תיכון',
      'track.court.college': 'קולג׳',
      'track.court.nba': 'NBA',
      'track.court.fiba': 'FIBA',
      'track.calib.err': 'לא הצלחנו לפתוח את המצלמה לכיול: {e}',
      'track.calib.unknown': 'לא ידוע',
      'track.calib.done': 'המגרש מכויל',
      'track.calib.todo': 'כייל את המגרש',
      'track.calib.done.sub': 'מרחקי הזריקות והאזורים ממופים למטרים אמיתיים על המגרש.',
      'track.calib.todo.sub': 'הקש פעם אחת על 4 קווי מגרש, וכל זריקה מקבלת מרחק ואזור מדויקים.',
      'track.calib.type': 'סוג מגרש',
      'track.calib.redo': 'כייל מחדש',
      'track.calib.go': 'כייל מגרש',
      'track.header': 'מעקב',
      'track.header.sub': 'לאן הכדור באמת הולך.',
      'track.start': 'התחל אימון'
    }
  };
  if (window.V12I18n) V12I18n.add(T);
  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

  var VIEWS = [
    { id: 'map',      label: 'track.view.map' },
    { id: 'sessions', label: 'track.view.sessions' },
    { id: 'insights', label: 'track.view.insights' }
  ];

  /* ── the court, on white ──────────────────────────────────────
     Hot keeps the brand orange; cold goes BLUE on the white ground
     (mustard read as "warm" — wrong signal for a cold zone). */
  var LINE = '#C9D2DC';
  function courtLines() {
    return [
      svg('rect', { x: 170, y: 0, width: 160, height: 190, fill: 'none', stroke: LINE, 'stroke-width': 2.5 }),
      svg('circle', { cx: 250, cy: 190, r: 60, fill: 'none', stroke: LINE, 'stroke-width': 2.5 }),
      svg('line', { x1: 30, y1: 0, x2: 30, y2: 142, stroke: LINE, 'stroke-width': 2.5 }),
      svg('line', { x1: 470, y1: 0, x2: 470, y2: 142, stroke: LINE, 'stroke-width': 2.5 }),
      svg('path', { d: 'M 30 142 A 237.5 237.5 0 0 0 470 142', fill: 'none', stroke: '#9FB0C0', 'stroke-width': 4 }),
      svg('line', { x1: 220, y1: 40, x2: 280, y2: 40, stroke: '#9FB0C0', 'stroke-width': 4 }),
      svg('circle', { cx: 250, cy: 52.5, r: 7.5, fill: 'none', stroke: '#FF4F1F', 'stroke-width': 4 })
    ];
  }

  function zoneFill(key, z, mean) {
    var st = C.state(z);
    if (st === 'empty') return 'rgba(10,40,80,0.04)';
    if (st === 'thin')  return 'rgba(10,40,80,0.10)';
    var a = C.shrunkAcc(z, mean);
    var isThree = !!C.THREE_PT[key];
    var strength = isThree ? 0.85 : 0.6;
    if (a >= 0.55) return 'rgba(255,79,31,' + strength + ')';
    if (a <= 0.40) return 'rgba(28,176,246,' + strength + ')';
    return 'rgba(10,40,80,' + (isThree ? 0.28 : 0.16) + ')';
  }

  function zoneValue(z) {
    var st = C.state(z);
    if (st === 'empty') return '';
    if (st === 'thin')  return (z.vatt ? z.made + '/' + z.vatt : String(z.att));
    return Math.round(z.made / z.vatt * 100) + '%';
  }

  function buildMap(zones, mean) {
    var kids = [];
    Object.keys(C.ZONE_PATHS).forEach(function (key) {
      kids.push(svg('path', {
        d: C.ZONE_PATHS[key],
        fill: zoneFill(key, zones[key] || { made: 0, att: 0, vatt: 0 }, mean),
        stroke: '#FFFFFF', 'stroke-width': 2
      }));
    });
    kids = kids.concat(courtLines());
    Object.keys(C.ZONE_PATHS).forEach(function (key) {
      var z = zones[key];
      if (!z || !z.att) return;
      var p = C.CENTER[key];
      if (!p || p.y > C.H_CROP - 12) return;
      var rated = C.state(z) === 'rated';
      kids.push(svg('text', {
        x: p.x, y: p.y, 'text-anchor': 'middle',
        'font-family': 'Barlow Condensed, Impact, sans-serif',
        'font-weight': 800, 'font-size': rated ? 24 : 19,
        fill: '#0A2850'
      }, [zoneValue(z)]));
    });
    return svg('svg', {
      viewBox: '0 0 ' + C.W + ' ' + C.H_CROP,
      width: '100%', role: 'img', 'aria-label': t('track.map.aria'),
      style: 'display:block;max-width:100%;height:auto'
    }, kids);
  }

  function legend() {
    var i = function (c, t) {
      return h('div', { class: 't12-legend__i' }, [
        h('span', { class: 't12-legend__dot', style: { background: c } }),
        h('span', { text: t })
      ]);
    };
    return h('div', { class: 't12-legend' }, [
      i('rgba(255,79,31,.85)', t('track.legend.hot')),
      i('rgba(28,176,246,.85)', t('track.legend.cold')),
      i('rgba(10,40,80,.14)', t('track.legend.under', { n: C.MIN_VERDICTS }))
    ]);
  }

  function totals(zones) {
    var att = 0, made = 0, vatt = 0;
    Object.keys(zones).forEach(function (k) {
      var z = zones[k]; if (!z) return;
      att += z.att || 0; made += z.made || 0; vatt += z.vatt || 0;
    });
    return { att: att, made: made, vatt: vatt };
  }

  /* ── stat chips (rate + count + count — different units) ──────*/
  function statChips(t0) {
    function chip(v, l) {
      return h('div', { class: 't12-stat' }, [
        h('div', { class: 'd-num t12-stat__v' + (v == null ? ' t12-stat__v--dim' : ''),
          text: v == null ? '—' : String(v) }),
        h('div', { class: 'd-label', text: l })
      ]);
    }
    return h('div', { class: 't12-stats' }, [
      chip(t0.vatt >= C.MIN_TOTAL ? Math.round(t0.made / t0.vatt * 100) + '%'
                                  : (t0.vatt ? t0.made + '/' + t0.vatt : null),
           t0.vatt >= C.MIN_TOTAL ? t('track.fg30') : t('track.made30')),
      chip(t0.att || null, t('track.shots')),
      chip(t0.vatt || null, t('track.scored'))
    ]);
  }

  /* ── view: heat map ───────────────────────────────────────────*/
  function zoneRow(key, z, mean) {
    var st = C.state(z);
    var rated = st === 'rated';
    var isEmpty = st === 'empty';
    var a = rated ? C.shrunkAcc(z, mean) : 0;
    var pct = rated ? Math.round(z.made / z.vatt * 100) : 0;
    var fillCls = !rated ? ' is-thin' : (a <= 0.40 ? ' is-cold' : '');
    var val;
    if (rated) val = pct + '%';
    else if (z.vatt) val = z.made + '/' + z.vatt;
    else if (z.att) val = t('track.zone.shots', { n: z.att });
    else val = t('track.zone.none');
    return h('div', { class: 't12-zone' + (isEmpty ? ' is-empty' : '') }, [
      h('div', { class: 't12-zone__n', text: C.LABEL[key] || key }),
      h('div', { class: 't12-zone__bar' }, [
        h('div', {
          class: 't12-zone__fill' + fillCls,
          style: { width: (rated ? Math.max(3, pct) : Math.min(90, (z.vatt || z.att) * 10)) + '%' }
        })
      ]),
      h('div', { class: 't12-zone__v' + (rated ? '' : ' t12-zone__v--thin'), text: val })
    ]);
  }

  function renderMapView(box, zones) {
    var tt = totals(zones);
    var mean = C.playerMean(zones);

    if (!tt.att) {
      box.appendChild(V12.empty(t('track.empty.title'),
        t('track.empty.body'),
        { hoop: true, cta: t('track.empty.cta'), ctaIcon: 'ph-video-camera',
          onCta: function () { window.app.go('camera-hud'); } }));
      return;
    }

    var rated = Object.keys(zones).filter(function (k) {
      return C.state(zones[k]) === 'rated';
    }).sort(function (a, b) {
      return C.shrunkAcc(zones[b], mean) - C.shrunkAcc(zones[a], mean);
    });
    var byState = { rated: [], thin: [], empty: [] };
    Object.keys(C.ZONE_PATHS).forEach(function (k) {
      byState[C.state(zones[k] || {})].push(k);
    });
    var order = rated.concat(byState.thin, byState.empty);

    box.appendChild(h('div', { class: 'd-label t12-hd',
      text: rated.length ? t('track.byzone.rated', { n: rated.length }) : t('track.byzone.cov') }));
    if (!rated.length) {
      box.appendChild(h('div', { class: 't12-note',
        text: t('track.note.thin', { n: C.MIN_VERDICTS }) }));
    }
    order.forEach(function (k) {
      box.appendChild(zoneRow(k, zones[k] || { made: 0, att: 0, vatt: 0 }, mean));
    });
  }

  /* ── view: sessions ───────────────────────────────────────────*/
  function dateLabel(iso) {
    try {
      var d = new Date(iso);
      var today = new Date().toDateString();
      var yest = new Date(Date.now() - 86400000).toDateString();
      if (d.toDateString() === today) return t('track.today');
      if (d.toDateString() === yest) return t('track.yesterday');
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function renderSessionsView(box, ctx) {
    return ctx.data.getSessions(15).then(function (rows) {
      if (!rows || !rows.length) {
        box.appendChild(V12.empty(t('track.sess.empty.title'),
          t('track.sess.empty.body'),
          { cta: t('track.sess.empty.cta'), ctaIcon: 'ph-video-camera',
            onCta: function () { ctx.go('camera-hud'); } }));
        return;
      }
      rows.forEach(function (s) {
        var counter = s.session_type === 'live_counter' || s.total_made == null;
        var att = s.total_attempts || 0;
        var made = s.total_made || 0;
        var right = counter ? String(att)
          : (att >= C.MIN_VERDICTS ? Math.round(made * 100 / att) + '%' : made + '/' + att);
        box.appendChild(V12.card({
          class: 't12-sess', press: true,
          onClick: function () { ctx.go('post-session'); },
          label: t('track.sess.aria', { d: dateLabel(s.session_date || s.created_at) })
        }, [
          h('div', { class: 't12-sess__ic' }, [
            h('i', { class: 'ph-fill ' + (counter ? 'ph-timer' : 'ph-video-camera') })
          ]),
          h('div', { class: 't12-sess__main' }, [
            h('div', { class: 't12-sess__t', text: dateLabel(s.session_date || s.created_at) }),
            h('div', { class: 't12-sess__s',
              text: counter ? t('track.sess.live', { a: att })
                            : t('track.sess.made', { a: att, m: made }) })
          ]),
          h('div', { class: 'd-num t12-sess__v', text: right })
        ]));
      });
    });
  }

  /* ── view: insights — the scout's read, in words ──────────────*/
  function renderInsightsView(box, ctx, zones) {
    var mean = C.playerMean(zones);
    var rated = Object.keys(zones).filter(function (k) {
      return C.state(zones[k]) === 'rated';
    }).sort(function (a, b) {
      return C.shrunkAcc(zones[b], mean) - C.shrunkAcc(zones[a], mean);
    });

    if (!rated.length) {
      box.appendChild(V12.empty(t('track.ins.empty.title'),
        t('track.ins.empty.body', { n: C.MIN_VERDICTS }),
        { cta: t('track.ins.empty.cta'), ctaIcon: 'ph-video-camera',
          onCta: function () { ctx.go('camera-hud'); } }));
      return;
    }

    var best = rated[0], worst = rated[rated.length - 1];
    function line(icon, tint, title, body) {
      return V12.card({ tint: tint, class: 't12-ins', bgIcon: icon, bgTone: tint }, [
        h('div', { class: 't12-ins__t', text: title }),
        h('div', { class: 't12-ins__b', text: body })
      ]);
    }
    var bz = zones[best], wz = zones[worst];
    box.appendChild(line('ph-fire', 'orange', t('track.ins.money', { z: C.LABEL[best] }),
      t('track.ins.money.body', {
        m: bz.made, a: bz.vatt, p: Math.round(bz.made / bz.vatt * 100)
      })));
    if (worst !== best) {
      box.appendChild(line('ph-snowflake', 'blue', t('track.ins.reps', { z: C.LABEL[worst] }),
        t('track.ins.reps.body', {
          m: wz.made, a: wz.vatt, p: Math.round(wz.made / wz.vatt * 100)
        })));
    }
    return ctx.data.getCoachVerdict().then(function (coach) {
      if (coach && coach.verdict) {
        box.appendChild(line('ph-chalkboard-teacher', 'green', t('track.ins.coach'), coach.verdict));
      }
    });
  }

  /* ── court calibration (shooter position in real meters) ──────
     Establishes the floor homography once per court/camera setup so the
     shot map + distances are true court coordinates, not image-space
     guesses. See features/shot-tracking/courtPosition.js. */
  var CALIB_KEY = 'courtiq-calib-v1';
  var SPEC_KEY = 'courtiq-court-spec';
  var COURT_TYPES = [
    { id: 'us_hs', label: 'track.court.hs' },
    { id: 'ncaa',  label: 'track.court.college' },
    { id: 'nba',   label: 'track.court.nba' },
    { id: 'fiba',  label: 'track.court.fiba' }
  ];

  function calibSection(repaint) {
    if (!window.CourtCalibration || !window.CourtPosition) return null;
    // restore a saved calibration so status is accurate across reloads
    if (!window.CourtPosition.isCalibrated()) {
      try { window.CourtCalibration.restore(CALIB_KEY); } catch (e) {}
    }
    var spec = localStorage.getItem(SPEC_KEY) || 'us_hs';
    var calibrated = window.CourtPosition.isCalibrated();

    function launch() {
      window.CourtCalibration.startFromCamera({
        spec: spec,
        landmarkSet: 'lane',
        persistKey: CALIB_KEY,
        onDone: function () { repaint(); },
        onError: function (err) {
          alert(t('track.calib.err', { e: (err && err.message || t('track.calib.unknown')) }));
        }
      });
    }

    return V12.card({ class: 't12-calib', tint: calibrated ? 'green' : null,
                      bgIcon: 'ph-ruler', bgTone: calibrated ? 'green' : 'ink' }, [
      h('div', { class: 't12-calib__hd' }, [
        h('i', { class: 'ph-fill ' + (calibrated ? 'ph-check-circle' : 'ph-ruler') }),
        h('div', { text: calibrated ? t('track.calib.done') : t('track.calib.todo') })
      ]),
      h('div', { class: 't12-calib__sub', text: calibrated
        ? t('track.calib.done.sub')
        : t('track.calib.todo.sub') }),
      h('div', { class: 'd-label t12-calib__lbl', text: t('track.calib.type') }),
      V12.seg(COURT_TYPES.map(function (c) { return { id: c.id, label: t(c.label) }; }), spec, function (next) {
        localStorage.setItem(SPEC_KEY, next);
        // a saved calibration was fit to the old spec — clear it so the
        // status is honest until the user recalibrates on the new spec
        if (window.CourtPosition.isCalibrated()) {
          window.CourtPosition.clear();
          try { localStorage.removeItem(CALIB_KEY); } catch (e) {}
        }
        repaint();
      }),
      V12.btn({
        label: calibrated ? t('track.calib.redo') : t('track.calib.go'),
        icon: 'ph-crosshair', onClick: launch
      })
    ]);
  }

  /* ── screen ───────────────────────────────────────────────────*/
  function render(args) {
    var host = args.host, ctx = args.ctx;
    var view = 'map';

    return ctx.data.getZones().then(function (zones) {
      zones = zones || {};
      var tt = totals(zones);
      var mean = C.playerMean(zones);

      function paint() {
        while (host.firstChild) host.removeChild(host.firstChild);

        host.appendChild(V12.header(t('track.header'), t('track.header.sub')));

        /* the court hero — always up, whatever the view */
        host.appendChild(V12.card({ class: 't12-court' }, [buildMap(zones, mean)]));
        if (tt.att) host.appendChild(legend());
        host.appendChild(statChips(tt));
        host.appendChild(V12.seg(VIEWS.map(function (v) { return { id: v.id, label: t(v.label) }; }),
          view, function (next) { view = next; paint(); }));

        var box = h('div', { class: 't12-box' });
        host.appendChild(box);
        if (view === 'map') renderMapView(box, zones);
        else if (view === 'sessions') renderSessionsView(box, ctx);
        else renderInsightsView(box, ctx, zones);

        var calib = calibSection(paint);
        if (calib) host.appendChild(calib);

        host.appendChild(V12.btn({
          label: t('track.start'), icon: 'ph-play-circle',
          // via the setup screen — it forwards straight through once the
          // user has ticked "don't show this again"
          onClick: function () { ctx.go('session-prep'); }
        }));
        /* the library/plan doors moved home + to the coach tab —
           Track stays about tracking */
      }
      paint();
    });
  }

  window.app.register('track', render);
})();
