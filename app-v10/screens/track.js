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

  var VIEWS = [
    { id: 'map',      label: 'Heat map' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'insights', label: 'Insights' }
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
      width: '100%', role: 'img', 'aria-label': 'Your shot map by zone',
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
      i('rgba(255,79,31,.85)', 'Hot'),
      i('rgba(28,176,246,.85)', 'Cold'),
      i('rgba(10,40,80,.14)', 'Under ' + C.MIN_VERDICTS + ' shots')
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
  function statChips(t) {
    function chip(v, l) {
      return h('div', { class: 't12-stat' }, [
        h('div', { class: 'd-num t12-stat__v' + (v == null ? ' t12-stat__v--dim' : ''),
          text: v == null ? '—' : String(v) }),
        h('div', { class: 'd-label', text: l })
      ]);
    }
    return h('div', { class: 't12-stats' }, [
      chip(t.vatt >= C.MIN_TOTAL ? Math.round(t.made / t.vatt * 100) + '%'
                                 : (t.vatt ? t.made + '/' + t.vatt : null),
           t.vatt >= C.MIN_TOTAL ? 'FG · 30D' : 'MADE · 30D'),
      chip(t.att || null, 'SHOTS'),
      chip(t.vatt || null, 'SCORED')
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
    else if (z.att) val = z.att + ' shots';
    else val = 'none';
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
    var t = totals(zones);
    var mean = C.playerMean(zones);

    if (!t.att) {
      box.appendChild(V12.empty('Nothing on the court yet',
        'Track a session or upload a video. Every shot lands on this map, zone by zone.',
        { hoop: true }));
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
      text: 'BY ZONE · ' + (rated.length ? rated.length + ' of 9 rated' : 'coverage') }));
    if (!rated.length) {
      box.appendChild(h('div', { class: 't12-note',
        text: 'No zone has ' + C.MIN_VERDICTS + ' scored shots yet, so none has a percentage. Below is what you actually took.' }));
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
      if (d.toDateString() === today) return 'Today';
      if (d.toDateString() === yest) return 'Yesterday';
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function renderSessionsView(box, ctx) {
    return ctx.data.getSessions(15).then(function (rows) {
      if (!rows || !rows.length) {
        box.appendChild(V12.empty('No sessions yet',
          'Your first session shows up here the moment you finish it.'));
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
          label: 'Session ' + dateLabel(s.session_date || s.created_at)
        }, [
          h('div', { class: 't12-sess__ic' }, [
            h('i', { class: 'ph-fill ' + (counter ? 'ph-timer' : 'ph-video-camera') })
          ]),
          h('div', { class: 't12-sess__main' }, [
            h('div', { class: 't12-sess__t', text: dateLabel(s.session_date || s.created_at) }),
            h('div', { class: 't12-sess__s',
              text: att + ' shots' + (counter ? ' · counted live' : ' · ' + made + ' made') })
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
      box.appendChild(V12.empty('The scout needs evidence',
        'Once a zone reaches ' + C.MIN_VERDICTS +
        ' scored shots, the analysis starts here — strongest zone, weakest zone, and what to do about it.'));
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
    box.appendChild(line('ph-fire', 'orange', 'Your money zone: ' + C.LABEL[best],
      bz.made + ' of ' + bz.vatt + ' scored shots (' + Math.round(bz.made / bz.vatt * 100) +
      '%). Build possessions that end here.'));
    if (worst !== best) {
      box.appendChild(line('ph-snowflake', 'blue', 'Needs reps: ' + C.LABEL[worst],
        wz.made + ' of ' + wz.vatt + ' (' + Math.round(wz.made / wz.vatt * 100) +
        '%). Spend 30 reps a session here until it warms up.'));
    }
    return ctx.data.getCoachVerdict().then(function (coach) {
      if (coach && coach.verdict) {
        box.appendChild(line('ph-chalkboard-teacher', 'green', 'Coach says', coach.verdict));
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
    { id: 'us_hs', label: 'High school' },
    { id: 'ncaa',  label: 'College' },
    { id: 'nba',   label: 'NBA' },
    { id: 'fiba',  label: 'FIBA' }
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
          alert('Could not open the camera to calibrate: ' + (err && err.message || 'unknown'));
        }
      });
    }

    return V12.card({ class: 't12-calib', tint: calibrated ? 'green' : null,
                      bgIcon: 'ph-ruler', bgTone: calibrated ? 'green' : 'ink' }, [
      h('div', { class: 't12-calib__hd' }, [
        h('i', { class: 'ph-fill ' + (calibrated ? 'ph-check-circle' : 'ph-ruler') }),
        h('div', { text: calibrated ? 'Court calibrated' : 'Calibrate your court' })
      ]),
      h('div', { class: 't12-calib__sub', text: calibrated
        ? 'Shot distances and zones are mapped to real court meters.'
        : 'Tap 4 court lines once, and every shot gets a true distance and zone.' }),
      h('div', { class: 'd-label t12-calib__lbl', text: 'COURT TYPE' }),
      V12.seg(COURT_TYPES, spec, function (next) {
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
        label: calibrated ? 'Recalibrate court' : 'Calibrate court',
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
      var t = totals(zones);
      var mean = C.playerMean(zones);

      function paint() {
        while (host.firstChild) host.removeChild(host.firstChild);

        host.appendChild(V12.header('Tracking', 'Where the ball actually goes.'));

        /* the court hero — always up, whatever the view */
        host.appendChild(V12.card({ class: 't12-court' }, [buildMap(zones, mean)]));
        if (t.att) host.appendChild(legend());
        host.appendChild(statChips(t));
        host.appendChild(V12.seg(VIEWS, view, function (next) { view = next; paint(); }));

        var box = h('div', { class: 't12-box' });
        host.appendChild(box);
        if (view === 'map') renderMapView(box, zones);
        else if (view === 'sessions') renderSessionsView(box, ctx);
        else renderInsightsView(box, ctx, zones);

        var calib = calibSection(paint);
        if (calib) host.appendChild(calib);

        host.appendChild(V12.btn({
          label: 'Session start', icon: 'ph-play-circle',
          // via the setup screen — it forwards straight through once the
          // user has ticked "don't show this again"
          onClick: function () { ctx.go('session-prep'); }
        }));
        host.appendChild(h('div', { class: 't12-doors' }, [
          V12.card({
            press: true, bgIcon: 'ph-barbell', bgTone: 'ink', class: 't12-door',
            onClick: function () { ctx.go('drill-library'); }, label: 'Drill library'
          }, [
            h('i', { class: 'ph-fill ph-barbell t12-door__ic' }),
            h('div', { class: 't12-door__t', text: 'Drill library' })
          ]),
          V12.card({
            press: true, tint: 'blue', bgIcon: 'ph-clipboard-text', bgTone: 'blue', class: 't12-door',
            onClick: function () { ctx.go('plan'); }, label: 'Customize your training plan'
          }, [
            h('i', { class: 'ph-fill ph-clipboard-text t12-door__ic t12-door__ic--blue' }),
            h('div', { class: 't12-door__t', text: 'Customize your training plan' })
          ])
        ]));
      }
      paint();
    });
  }

  window.app.register('track', render);
})();
