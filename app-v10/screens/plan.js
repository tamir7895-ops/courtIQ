/* app-v10/screens/plan.js — v12 TRAINING PLAN CONSOLE
   ------------------------------------------------------------------
   The section the user called the most important one. A real program
   manager, four views on a segmented control:

     WEEK     the hero calendar (Runna) — 7 editable days, per-day
              session, progress ring + weekly shot goal, rebuild.
     MONTH    the mesocycle — a month grid colored by focus + done,
              a 4-week periodization strip, adherence.
     FOCUS    the builder — choose areas + weekly frequency, session
              length, shot goal, gear; rebuild the week from it.
     PROGRESS adherence, streak, volume trend, per-focus balance.

   All state lives in lib/plan.js (V12Plan → courtiq_plan_v2). Planned
   volume is a plan; DONE is only ever the real completion log +
   tracked sessions (M4).
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, V12 = window.V12, P = window.V12Plan;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var PERIOD = ['Build', 'Skill', 'Peak', 'Deload'];  // weekly emphasis in a month

  /* progress ring */
  function ring(pct, size, color) {
    var r = (size - 8) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, pct / 100)));
    return svg('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, class: 'plan12-ring' }, [
      svg('circle', { cx: size / 2, cy: size / 2, r: r, fill: 'none', stroke: 'rgba(255,255,255,.25)', 'stroke-width': 6 }),
      svg('circle', {
        cx: size / 2, cy: size / 2, r: r, fill: 'none', stroke: color || '#fff', 'stroke-width': 6,
        'stroke-linecap': 'round', 'stroke-dasharray': c.toFixed(1),
        'stroke-dashoffset': off.toFixed(1),
        transform: 'rotate(-90 ' + (size / 2) + ' ' + (size / 2) + ')'
      }),
      svg('text', {
        x: size / 2, y: size / 2 + 6, 'text-anchor': 'middle',
        'font-family': 'Barlow Condensed, sans-serif', 'font-weight': 900,
        'font-size': size * 0.34, fill: '#fff'
      }, [pct + '%'])
    ]);
  }

  function fpill(fid, extra) {
    if (fid === 'rest') {
      return h('span', { class: 'plan12-fpill plan12-fpill--rest' + (extra || '') }, [
        h('i', { class: 'ph-fill ph-moon' }), h('span', { text: 'Rest' })
      ]);
    }
    var f = P.focus(fid); if (!f) return h('span', {});
    return h('span', { class: 'plan12-fpill plan12-fpill--' + f.tone + (extra || '') }, [
      h('i', { class: 'ph-fill ' + f.icon }), h('span', { text: f.label })
    ]);
  }

  /* ══ shared: day editor sheet ══════════════════════════════════ */
  function openDaySheet(p, dowIdx, dateISO, onChange) {
    var back = h('div', { class: 'plan12-sheetbg' });
    var sheet = h('div', { class: 'plan12-sheet' });
    function close() { back.remove(); }
    back.addEventListener('click', function (e) { if (e.target === back) close(); });

    function paint() {
      while (sheet.firstChild) sheet.removeChild(sheet.firstChild);
      var fid = P.focusForDay(p, dowIdx);
      var done = dateISO ? P.isDone(p, dateISO) : false;

      sheet.appendChild(h('div', { class: 'plan12-sheet__hd' }, [
        h('div', { class: 'plan12-sheet__t', text: P.DOW[dowIdx] + (dateISO ? ' · ' + dateISO.slice(5) : '') }),
        h('button', { class: 'plan12-sheet__x', type: 'button', onclick: close }, [h('i', { class: 'ph-bold ph-x' })])
      ]));

      /* focus swap */
      sheet.appendChild(h('div', { class: 'd-label', text: 'FOCUS' }));
      var chips = h('div', { class: 'plan12-chips' });
      ['rest'].concat(P.FOCI.map(function (f) { return f.id; })).forEach(function (id) {
        var on = fid === id;
        chips.appendChild(h('button', {
          class: 'plan12-chip' + (on ? ' is-active' : ''), type: 'button',
          onclick: function () { p.schedule[dowIdx] = id; P.save(p); paint(); onChange && onChange(); }
        }, [fpill(id)]));
      });
      sheet.appendChild(chips);

      /* the session */
      if (fid !== 'rest') {
        var drills = P.drillsForDay(p, dowIdx);
        sheet.appendChild(h('div', { class: 'd-label', style: { marginTop: '12px' },
          text: p.minutes + ' MIN · ' + drills.length + ' DRILLS' }));
        drills.forEach(function (d, i) {
          sheet.appendChild(h('div', { class: 'plan12-drow' }, [
            h('div', { class: 'plan12-drow__n', text: String(i + 1) }),
            h('div', { class: 'plan12-drow__main' }, [
              h('div', { class: 'plan12-drow__t', text: d.name }),
              h('div', { class: 'plan12-drow__s', text: d.reps + ' reps · ' + d.mins + ' min' })
            ])
          ]));
        });
      } else {
        sheet.appendChild(h('div', { class: 'plan12-rest' }, [
          h('i', { class: 'ph-fill ph-moon' }),
          h('span', { text: 'Rest day — recovery is training too.' })
        ]));
      }

      /* actions */
      var actions = h('div', { class: 'plan12-sheet__foot' });
      if (dateISO && fid !== 'rest') {
        actions.appendChild(V12.btn({
          variant: done ? 'ghost' : 'green',
          icon: done ? 'ph-arrow-counter-clockwise' : 'ph-check-circle',
          label: done ? 'Mark undone' : 'Mark done',
          onClick: function () { P.setDone(p, dateISO, !done); P.save(p); paint(); onChange && onChange(); }
        }));
      }
      if (fid !== 'rest') {
        actions.appendChild(V12.btn({
          icon: 'ph-play-circle', label: 'Start',
          onClick: function () {
            var drills = P.drillsForDay(p, dowIdx);
            if (drills[0]) { try { sessionStorage.setItem('courtiq_v11_drill', JSON.stringify(drills[0])); } catch (e) {} }
            window.app.go('workout-player');
          }
        }));
      }
      sheet.appendChild(actions);
    }

    paint();
    back.appendChild(sheet);
    document.body.appendChild(back);
  }

  /* ══ WEEK view ═════════════════════════════════════════════════ */
  function weekView(host, ctx, p, state) {
    var dates = P.weekDates(state.weekOff);
    var adh = P.weekAdherence(p, state.weekOff);
    var todayI = P.todayIdx();
    var label = state.weekOff === 0 ? 'This week' : (state.weekOff < 0 ? Math.abs(state.weekOff) + 'w ago' : 'In ' + state.weekOff + 'w');

    /* week nav + summary */
    host.appendChild(h('div', { class: 'plan12-nav' }, [
      h('button', { class: 'plan12-nav__b', type: 'button', onclick: function () { state.weekOff--; state.paint(); } }, [h('i', { class: 'ph-bold ph-caret-left' })]),
      h('div', { class: 'plan12-nav__l', text: label }),
      h('button', { class: 'plan12-nav__b', type: 'button', onclick: function () { state.weekOff++; state.paint(); } }, [h('i', { class: 'ph-bold ph-caret-right' })])
    ]));

    var streak = 0; try { streak = (window.StreakSystem && window.StreakSystem.get) ? window.StreakSystem.get() : 0; } catch (e) {}
    host.appendChild(V12.card({ tint: 'ink', class: 'plan12-sum' }, [
      ring(adh.pct, 66, '#FF4F1F'),
      h('div', { class: 'plan12-sum__main' }, [
        h('div', { class: 'plan12-sum__t', text: adh.done + ' of ' + adh.planned + ' sessions' }),
        h('div', { class: 'plan12-sum__s', text: adh.planned ? 'Planned this week' : 'No training days set' }),
        h('div', { class: 'plan12-sum__chips' }, [
          h('span', { class: 'plan12-mini plan12-mini--gold' }, [h('i', { class: 'ph-fill ph-target' }), h('span', { text: p.goalShots + ' shot goal' })]),
          h('span', { class: 'plan12-mini plan12-mini--orange' }, [h('i', { class: 'ph-fill ph-fire' }), h('span', { text: streak + ' streak' })])
        ])
      ])
    ]));

    /* 7 days */
    var list = h('div', { class: 'plan12-week' });
    dates.forEach(function (d, i) {
      var fid = P.focusForDay(p, i);
      var iso = P.isoOf(d);
      var done = P.isDone(p, iso);
      var isToday = state.weekOff === 0 && i === todayI;
      var drills = P.drillsForDay(p, i);
      list.appendChild(h('button', {
        class: 'plan12-day' + (isToday ? ' is-today' : '') + (done ? ' is-done' : '') + (fid === 'rest' ? ' is-rest' : ''),
        type: 'button',
        onclick: function () { openDaySheet(p, i, iso, state.paint); }
      }, [
        h('div', { class: 'plan12-day__date' }, [
          h('div', { class: 'plan12-day__dow', text: P.DOW[i] }),
          h('div', { class: 'plan12-day__num', text: String(d.getDate()) })
        ]),
        h('div', { class: 'plan12-day__main' }, [
          fpill(fid),
          fid !== 'rest' ? h('div', { class: 'plan12-day__meta', text: p.minutes + ' min · ' + drills.length + ' drills' }) : null
        ].filter(Boolean)),
        done ? h('i', { class: 'ph-fill ph-check-circle plan12-day__mk plan12-day__mk--done' })
             : (isToday ? h('i', { class: 'ph-fill ph-circle plan12-day__mk plan12-day__mk--today' })
                        : h('i', { class: 'ph-bold ph-caret-right plan12-day__mk' }))
      ]));
    });
    host.appendChild(list);

    host.appendChild(h('div', { class: 'plan12-two' }, [
      h('button', { class: 'd-btn d-btn--ghost', type: 'button', onclick: function () { P.rebuild(p); P.save(p); state.paint(); } }, [
        h('i', { class: 'ph-fill ph-arrows-clockwise' }), h('span', { text: 'Rebuild' })
      ]),
      V12.btn({ label: 'Edit focus', icon: 'ph-sliders', onClick: function () { state.view = 'focus'; state.paint(); } })
    ]));
  }

  /* ══ MONTH view ════════════════════════════════════════════════ */
  function monthView(host, ctx, p, state) {
    var base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + state.monthOff);
    var year = base.getFullYear(), month = base.getMonth();
    var grid = P.monthGrid(year, month);
    var todayISO = P.todayISO();

    host.appendChild(h('div', { class: 'plan12-nav' }, [
      h('button', { class: 'plan12-nav__b', type: 'button', onclick: function () { state.monthOff--; state.paint(); } }, [h('i', { class: 'ph-bold ph-caret-left' })]),
      h('div', { class: 'plan12-nav__l', text: MONTHS[month] + ' ' + year }),
      h('button', { class: 'plan12-nav__b', type: 'button', onclick: function () { state.monthOff++; state.paint(); } }, [h('i', { class: 'ph-bold ph-caret-right' })])
    ]));

    /* periodization strip — 4 weeks emphasis */
    var strip = h('div', { class: 'plan12-period' });
    for (var w = 0; w < 4; w++) {
      strip.appendChild(h('div', { class: 'plan12-period__w' }, [
        h('div', { class: 'plan12-period__n', text: 'W' + (w + 1) }),
        h('div', { class: 'plan12-period__l', text: PERIOD[w] })
      ]));
    }
    host.appendChild(V12.card({ class: 'plan12-periodcard' }, [
      h('div', { class: 'd-label', text: 'THIS MONTH · MESOCYCLE' }), strip
    ]));

    /* calendar grid */
    var cal = h('div', { class: 'plan12-cal' });
    P.DOW.forEach(function (d) { cal.appendChild(h('div', { class: 'plan12-cal__wd', text: d[0] })); });
    var doneCount = 0, plannedCount = 0;
    grid.forEach(function (week) {
      week.forEach(function (cell) {
        var iso = P.isoOf(cell.date);
        var idx = (cell.date.getDay() + 6) % 7;
        var fid = P.focusForDay(p, idx);
        var done = P.isDone(p, iso);
        var f = P.focus(fid);
        if (cell.inMonth && fid !== 'rest') { plannedCount++; if (done) doneCount++; }
        var cls = 'plan12-cal__d' + (cell.inMonth ? '' : ' is-out') +
          (iso === todayISO ? ' is-today' : '') + (done ? ' is-done' : '') +
          (fid === 'rest' ? ' is-rest' : '');
        var cellEl = h('button', {
          class: cls, type: 'button',
          style: f ? { '--fc': 'var(--d-' + f.tone + ')' } : null,
          onclick: function () { openDaySheet(p, idx, iso, state.paint); }
        }, [h('span', { text: String(cell.date.getDate()) })]);
        cal.appendChild(cellEl);
      });
    });
    host.appendChild(V12.card({ class: 'plan12-calcard' }, [cal]));

    host.appendChild(h('div', { class: 'plan12-monthstats' }, [
      h('div', { class: 'plan12-mstat' }, [h('div', { class: 'd-num plan12-mstat__v', text: String(doneCount) }), h('div', { class: 'd-label', text: 'DONE' })]),
      h('div', { class: 'plan12-mstat' }, [h('div', { class: 'd-num plan12-mstat__v', text: String(plannedCount) }), h('div', { class: 'd-label', text: 'PLANNED' })]),
      h('div', { class: 'plan12-mstat' }, [h('div', { class: 'd-num plan12-mstat__v', text: (plannedCount ? Math.round(doneCount * 100 / plannedCount) : 0) + '%' }), h('div', { class: 'd-label', text: 'ADHERENCE' })])
    ]));
  }

  /* ══ FOCUS builder ═════════════════════════════════════════════ */
  function focusView(host, ctx, p, state) {
    host.appendChild(h('div', { class: 'd-label', text: 'WHAT TO WORK ON · REPS PER WEEK' }));
    var box = h('div', { class: 'plan12-focus' });
    P.FOCI.forEach(function (f) {
      var entry = (p.focus || []).filter(function (x) { return x.id === f.id; })[0];
      var per = entry ? entry.perWeek : 0;
      function setPer(v) {
        v = Math.max(0, Math.min(5, v));
        var arr = (p.focus || []).filter(function (x) { return x.id !== f.id; });
        if (v > 0) arr.push({ id: f.id, perWeek: v });
        p.focus = arr;
        P.save(p); state.paint();
      }
      box.appendChild(h('div', { class: 'plan12-frow' + (per > 0 ? ' is-on plan12-frow--' + f.tone : '') }, [
        h('div', { class: 'plan12-frow__ic plan12-frow__ic--' + f.tone }, [h('i', { class: 'ph-fill ' + f.icon })]),
        h('div', { class: 'plan12-frow__l', text: f.label }),
        h('div', { class: 'plan12-stepper' }, [
          h('button', { class: 'plan12-stepper__b', type: 'button', 'aria-label': 'less', onclick: function () { setPer(per - 1); } }, [h('i', { class: 'ph-bold ph-minus' })]),
          h('div', { class: 'plan12-stepper__v', text: String(per) }),
          h('button', { class: 'plan12-stepper__b', type: 'button', 'aria-label': 'more', onclick: function () { setPer(per + 1); } }, [h('i', { class: 'ph-bold ph-plus' })])
        ])
      ]));
    });
    host.appendChild(box);

    host.appendChild(h('div', { class: 'd-label', text: 'SESSION LENGTH' }));
    host.appendChild(h('div', { class: 'onb12-grid4' }, [15, 30, 45, 60].map(function (m) {
      return h('button', {
        class: 'onb12-pill' + (p.minutes === m ? ' is-active' : ''), type: 'button',
        onclick: function () { p.minutes = m; P.save(p); state.paint(); }
      }, [h('div', { class: 'onb12-pill__l', text: m + 'm' })]);
    })));

    var goalV = h('span', { class: 'onb12-slider__v', text: String(p.goalShots) });
    var goalR = h('input', { type: 'range', min: '20', max: '500', step: '10', value: String(p.goalShots), class: 'onb12-range' });
    goalR.addEventListener('input', function () { p.goalShots = parseInt(goalR.value, 10); goalV.textContent = p.goalShots; });
    goalR.addEventListener('change', function () { P.save(p); });
    host.appendChild(h('div', { class: 'onb12-slider' }, [
      h('div', { class: 'onb12-slider__top' }, [h('span', { class: 'd-label', text: 'Weekly shot goal' }), goalV]), goalR
    ]));

    host.appendChild(V12.btn({
      label: 'Save & rebuild week', icon: 'ph-check',
      onClick: function () { P.rebuild(p); P.save(p); state.view = 'week'; state.paint(); }
    }));
  }

  /* ══ PROGRESS view ═════════════════════════════════════════════ */
  function progressView(host, ctx, p, state) {
    var adh = P.weekAdherence(p, 0);
    var streak = 0; try { streak = (window.StreakSystem && window.StreakSystem.get) ? window.StreakSystem.get() : 0; } catch (e) {}

    host.appendChild(V12.card({ tint: 'ink', class: 'plan12-sum' }, [
      ring(adh.pct, 66, '#47C012'),
      h('div', { class: 'plan12-sum__main' }, [
        h('div', { class: 'plan12-sum__t', text: 'This week' }),
        h('div', { class: 'plan12-sum__s', text: adh.done + ' of ' + adh.planned + ' done' }),
        h('div', { class: 'plan12-sum__chips' }, [
          h('span', { class: 'plan12-mini plan12-mini--orange' }, [h('i', { class: 'ph-fill ph-fire' }), h('span', { text: streak + ' day streak' })])
        ])
      ])
    ]));

    /* per-focus balance (this month, done vs target) */
    var now = new Date();
    var tally = P.focusTallyMonth(p, now.getFullYear(), now.getMonth());
    host.appendChild(h('div', { class: 'd-label', text: 'FOCUS BALANCE · THIS MONTH' }));
    var fb = h('div', { class: 'plan12-balance' });
    P.FOCI.forEach(function (f) {
      var entry = (p.focus || []).filter(function (x) { return x.id === f.id; })[0];
      var target = entry ? entry.perWeek * 4 : 0;
      var done = tally[f.id] || 0;
      var pct = target ? Math.min(100, Math.round(done * 100 / target)) : (done ? 100 : 0);
      fb.appendChild(h('div', { class: 'plan12-bal' }, [
        h('div', { class: 'plan12-bal__l' }, [h('i', { class: 'ph-fill ' + f.icon + ' plan12-bal__ic plan12-bal__ic--' + f.tone }), h('span', { text: f.label })]),
        h('div', { class: 'plan12-bal__bar' }, [h('div', { class: 'plan12-bal__fill plan12-bal__fill--' + f.tone, style: { width: Math.max(3, pct) + '%' } })]),
        h('div', { class: 'plan12-bal__v', text: done + (target ? '/' + target : '') })
      ]));
    });
    host.appendChild(fb);

    /* volume trend — real tracked shots over the last 6 weeks */
    host.appendChild(h('div', { class: 'd-label', text: 'VOLUME · LAST 6 WEEKS' }));
    var trend = h('div', { class: 'plan12-trend' }, [h('div', { class: 'plan12-trend__load', text: 'Loading…' })]);
    host.appendChild(trend);
    ctx.data.getSessions(200).then(function (rows) {
      var buckets = [0, 0, 0, 0, 0, 0];
      var mon0 = P.weekDates(-5)[0].getTime();
      (rows || []).forEach(function (s) {
        var t = new Date(s.session_date || s.created_at || 0).getTime();
        if (!t || t < mon0) return;
        var wk = Math.floor((t - mon0) / (7 * 86400000));
        if (wk >= 0 && wk < 6) buckets[wk] += (s.total_attempts || 0);
      });
      var max = Math.max(1, Math.max.apply(null, buckets));
      while (trend.firstChild) trend.removeChild(trend.firstChild);
      buckets.forEach(function (v, i) {
        var col = h('div', { class: 'plan12-trend__col' }, [
          h('div', { class: 'plan12-trend__bar', style: { height: Math.max(4, Math.round(v * 100 / max)) + '%' }, title: v + ' shots' }),
          h('div', { class: 'plan12-trend__x', text: i === 5 ? 'now' : (5 - i) + 'w' })
        ]);
        trend.appendChild(col);
      });
      if (buckets.every(function (v) { return v === 0; })) {
        while (trend.firstChild) trend.removeChild(trend.firstChild);
        trend.appendChild(h('div', { class: 'plan12-trend__load', text: 'Track sessions and your volume trend fills in here.' }));
      }
    });
  }

  /* ══ shell ═════════════════════════════════════════════════════ */
  var VIEWS = [
    { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' },
    { id: 'focus', label: 'Focus' }, { id: 'progress', label: 'Progress' }
  ];

  function render(args) {
    var host = args.host, ctx = args.ctx;
    var p = P.load();
    var state = { view: 'week', weekOff: 0, monthOff: 0, paint: paint };

    function paint() {
      while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(h('div', { class: 'c12-chat-hd' }, [
        h('button', { class: 'c12-back', type: 'button', 'aria-label': 'Back', onclick: function () { ctx.go('track'); } }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
        h('div', {}, [
          h('div', { class: 'c12-chat-hd__t', text: 'Training plan' }),
          h('div', { class: 'c12-chat-hd__s', text: 'Your program — see it, run it, tune it' })
        ])
      ]));
      host.appendChild(V12.seg(VIEWS, state.view, function (n) { state.view = n; paint(); }));
      var body = h('div', { class: 'plan12-body' });
      host.appendChild(body);
      if (state.view === 'week') weekView(body, ctx, p, state);
      else if (state.view === 'month') monthView(body, ctx, p, state);
      else if (state.view === 'focus') focusView(body, ctx, p, state);
      else progressView(body, ctx, p, state);
    }
    paint();
  }

  window.app.register('plan', render);
})();
