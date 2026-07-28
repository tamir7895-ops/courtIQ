/* app-v10/screens/train.js — v11
   TRAIN tab. Dark shell, the scout's plan on paper.

   Two ideas, both stolen deliberately:

   1. RUNNA — the headline is not a metric, it's a NAMED OBJECT to go do.
      Runna won the crowded 2024-26 running market by being *less* designed,
      and its hero is "5 × 800m @ 4:15" — a prescription, not a measurement.
      A training screen answers "what do I do today", not "how am I doing".

   2. DUOLINGO — the path. Their 2022 redesign replaced a branching tree
      with one serpentine chain because learners couldn't tell if they were
      using it "the right way". One node is live; the rest are quiet. That's
      structure, not skin — we take the chain and leave the owl.

   The old screen had FOR YOU / ALL DRILLS / PLANS plus a stat quad plus a
   hero plus a plan list: four ways to ask the same question. Now: one
   prescription, one path.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, icon = window.V10UI.icon;
  var V = window.V11;

  var T = {
    en: {
      'train.rx.done':          'SESSION DONE',
      'train.rx.block':         '{focus} BLOCK',
      'train.rx.mixed':         'MIXED BLOCK',
      'train.rx.eyeDone':       'TODAY · COMPLETE',
      'train.rx.eye':           'TODAY',
      'train.rx.allLogged':     'All {n} drills logged. Anything past here is profit.',
      'train.rx.left':          '{left} of {total} drills left — {list}',
      'train.rx.min':           '{n} MIN',
      'train.rx.drills':        '{n} DRILLS',
      'train.path.start':       'START HERE',
      'train.path.meta':        '{reps} REPS · {mins} MIN',
      'train.path.doneTip':     'Done — tap to run it again',
      'train.path.nextTip':     'Suggested next',
      'train.path.openTip':     'Open — tap to jump here',
      'train.lib.hd':           'YOUR DRILLS',
      'train.lib.today':        '{n} TODAY',
      'train.lib.rowSub':       '{focus} · {reps} reps · {mins} min',
      'train.lib.full':         'FULL DRILL LIBRARY',
      'train.dotd.hd':          'DRILL OF THE DAY',
      'train.dotd.target':      'Targets your {zone} — {pct}% over 30 days',
      'train.dotd.noZones':     'No rated zones yet — groove the base first',
      'train.dotd.start':       'Start',
      'train.back':             'Back',
      'train.hd.t':             'Your training plan',
      'train.hd.s':             'What to do today — not how you did.',
      'train.tab.today':        'Today',
      'train.tab.library':      'Library',
      'train.focus.shooting':   'Shooting',
      'train.focus.handles':    'Ball handling',
      'train.focus.finishing':  'Finishing',
      'train.focus.defense':    'Defense',
      'train.focus.conditioning': 'Conditioning',
      'train.focus.passing':    'Passing',
      'train.plan.balanced':    'Balanced — set your focus',
      'train.plan.label':       'YOUR PLAN',
      'train.plan.summary':     '{days} days · {mins}m · {focus}',
      'train.plan.settings':    'Plan settings',
      'train.empty.t':          'NO PLAN YET',
      'train.empty.s':          'Open the drill library and pick a focus — your plan builds from there.',
      'train.order.hd':         'THE ORDER',
      'train.basis':            'A suggested order, not a rule. Nothing here is locked — start wherever you want.',
      'train.cta.start':        'Start workout',
      'train.cta.shoot':        'Go shoot',
      'train.cta.browse':       'Browse all drills',
      'train.farea.shooting':   'Shooting',
      'train.farea.ballhandling': 'Ball Handling',
      'train.farea.finishing':  'Finishing',
      'train.farea.conditioning': 'Conditioning',
      'train.farea.defense':    'Defense',
      'train.farea.passing':    'Passing',
      'train.farea.skill':      'Skill',
      'train.zone.lc':          'left corner 3',
      'train.zone.rc':          'right corner 3',
      'train.zone.lw':          'left wing 3',
      'train.zone.rw':          'right wing 3',
      'train.zone.top':         'top 3',
      'train.zone.topmid':      'top mid',
      'train.zone.ml':          'mid l',
      'train.zone.mr':          'mid r',
      'train.zone.pnt':         'paint'
    },
    he: {
      'train.rx.done':          'האימון הושלם',
      'train.rx.block':         'בלוק {focus}',
      'train.rx.mixed':         'בלוק משולב',
      'train.rx.eyeDone':       'היום · הושלם',
      'train.rx.eye':           'היום',
      'train.rx.allLogged':     'כל {n} התרגילים הושלמו. מכאן והלאה הכל בונוס.',
      'train.rx.left':          'נשארו {left} מתוך {total} תרגילים — {list}',
      'train.rx.min':           '{n} דק׳',
      'train.rx.drills':        '{n} תרגילים',
      'train.path.start':       'מתחילים כאן',
      'train.path.meta':        '{reps} חזרות · {mins} דק׳',
      'train.path.doneTip':     'הושלם — הקש כדי לחזור עליו',
      'train.path.nextTip':     'הבא המומלץ',
      'train.path.openTip':     'פתוח — הקש כדי לקפוץ לכאן',
      'train.lib.hd':           'התרגילים שלך',
      'train.lib.today':        '{n} היום',
      'train.lib.rowSub':       '{focus} · {reps} חזרות · {mins} דק׳',
      'train.lib.full':         'ספריית התרגילים המלאה',
      'train.dotd.hd':          'תרגיל היום',
      'train.dotd.target':      'עובד על {zone} — {pct}% ב־30 הימים האחרונים',
      'train.dotd.noZones':     'אין עדיין אזורים מדורגים — קודם מבססים את היסודות',
      'train.dotd.start':       'התחל',
      'train.back':             'חזרה',
      'train.hd.t':             'תוכנית האימון שלך',
      'train.hd.s':             'מה עושים היום — לא איך היה.',
      'train.tab.today':        'היום',
      'train.tab.library':      'ספרייה',
      'train.focus.shooting':   'קליעה',
      'train.focus.handles':    'כדרור',
      'train.focus.finishing':  'סיומות',
      'train.focus.defense':    'הגנה',
      'train.focus.conditioning': 'כושר',
      'train.focus.passing':    'מסירות',
      'train.plan.balanced':    'מאוזן — בחר מיקוד',
      'train.plan.label':       'התוכנית שלך',
      'train.plan.summary':     '{days} ימים · {mins} דק׳ · {focus}',
      'train.plan.settings':    'הגדרות תוכנית',
      'train.empty.t':          'אין עדיין תוכנית',
      'train.empty.s':          'פתח את ספריית התרגילים ובחר מיקוד — התוכנית נבנית משם.',
      'train.order.hd':         'הסדר',
      'train.basis':            'סדר מומלץ, לא חוק. שום דבר לא נעול — מתחילים איפה שבא לך.',
      'train.cta.start':        'התחל אימון',
      'train.cta.shoot':        'צא לזרוק',
      'train.cta.browse':       'לכל התרגילים',
      'train.farea.shooting':   'קליעה',
      'train.farea.ballhandling': 'כדרור',
      'train.farea.finishing':  'סיומות',
      'train.farea.conditioning': 'כושר',
      'train.farea.defense':    'הגנה',
      'train.farea.passing':    'מסירות',
      'train.farea.skill':      'מיומנות',
      'train.zone.lc':          'השלשה מהפינה השמאלית',
      'train.zone.rc':          'השלשה מהפינה הימנית',
      'train.zone.lw':          'השלשה מהאגף השמאלי',
      'train.zone.rw':          'השלשה מהאגף הימני',
      'train.zone.top':         'השלשה מהמרכז',
      'train.zone.topmid':      'אזור העונשין',
      'train.zone.ml':          'אמצע הטווח משמאל',
      'train.zone.mr':          'אמצע הטווח מימין',
      'train.zone.pnt':         'הצבע'
    }
  };
  if (window.V12I18n) V12I18n.add(T);
  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

  /* Focus-area display name. Drill focus values come from data
     ('Shooting', 'Ball Handling'…) — translate the known ones, pass
     anything unknown through untouched. */
  function farea(a) {
    var k = 'train.farea.' + String(a || '').toLowerCase().replace(/[^a-z]/g, '');
    var s = t(k);
    return s === k ? a : s;
  }

  var TABS = [{ id: 'today', label: 'TODAY' }, { id: 'library', label: 'LIBRARY' }];
  var LS_DONE = 'courtiq_v11_drills_done';

  /* Which drills are finished today. Real state — a path whose nodes don't
     remember is just a picture of a path. */
  function doneToday() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_DONE) || '{}');
      return raw.date === new Date().toISOString().slice(0, 10) ? (raw.ids || []) : [];
    } catch (e) { return []; }
  }
  function markDone(id) {
    try {
      var ids = doneToday();
      if (ids.indexOf(id) < 0) ids.push(id);
      localStorage.setItem(LS_DONE, JSON.stringify({
        date: new Date().toISOString().slice(0, 10), ids: ids
      }));
    } catch (e) {}
  }

  function totalMins(drills) {
    return drills.reduce(function (n, d) { return n + (d.mins || 0); }, 0);
  }

  /* The prescription. One thing to do, named. */
  function rx(drills, done) {
    var left = drills.filter(function (d) { return done.indexOf(d.id) < 0; });
    var complete = !left.length;
    var focus = {};
    drills.forEach(function (d) { focus[d.focus || 'Skill'] = 1; });
    var keys = Object.keys(focus);
    var name = complete ? t('train.rx.done')
      : (keys.length === 1
          ? t('train.rx.block', { focus: farea(keys[0]).toUpperCase() })
          : t('train.rx.mixed'));
    return h('div', { class: 'v11-rx' }, [
      h('div', { class: 'v11-rx__eye', text: complete ? t('train.rx.eyeDone') : t('train.rx.eye') }),
      h('div', { class: 'v11-rx__t', text: name }),
      h('div', {
        class: 'v11-rx__s',
        text: complete
          ? t('train.rx.allLogged', { n: drills.length })
          : t('train.rx.left', {
              left: left.length, total: drills.length,
              list: drills.map(function (d) { return d.reps + '×' + d.name.split(' ')[0]; }).join(' · ')
            })
      }),
      h('div', { class: 'v11-rx__meta' }, [
        h('div', { class: 'v11-rx__m' }, [
          h('i', { class: 'ph-fill ph-clock' }),
          h('span', { text: t('train.rx.min', { n: totalMins(drills) }) })
        ]),
        h('div', { class: 'v11-rx__m' }, [
          h('i', { class: 'ph-fill ph-barbell' }),
          h('span', { text: t('train.rx.drills', { n: drills.length }) })
        ])
      ])
    ]);
  }

  /* The path — SUGGESTS an order, never enforces one.

     I built this with locks first, because that's what Duolingo does, and
     that was wrong. A path encodes PREREQUISITES, and basketball has none:
     the Mikan drill does not unlock the jumpshot, and a layup is not a
     gateway to a corner three. Any lock here would be fabricated — and
     fabricated gating is exactly what produced Duolingo's backlash.

     Every non-language adopter reached the same conclusion independently:
     Chess.com keeps the first lesson of every course open, Simply Piano
     warns instead of locking, and Peloton spent years hard-locking its
     Programs before retreating in 2025 to "suggested, not required".
     Runna never locked at all. The convergent rule: PRESCRIBE BY DEFAULT,
     NEVER LOCK.

     There's a second reason, and it's the one that matters on a bad week:
     a grid resets, a path accuses. Skip drill 2 under a lock model and you
     are visibly stranded on it — the UI now blames you for a rest day the
     sport actually requires.

     So we keep what the path is genuinely good for — legibility, "what do
     I do next" — and drop the lie about ordering. One node says START
     HERE; the rest are open. */
  function path(drills, done, ctx) {
    var nextIdx = -1;
    for (var i = 0; i < drills.length; i++) {
      if (done.indexOf(drills[i].id) < 0) { nextIdx = i; break; }
    }
    var wrap = h('div', { class: 'v11-path' });
    drills.forEach(function (d, i) {
      var isDone = done.indexOf(d.id) >= 0;
      var isNext = i === nextIdx;
      var open = function () {
        markDone(d.id);
        try { sessionStorage.setItem('courtiq_v11_drill', JSON.stringify(d)); } catch (e) {}
        ctx.go('workout-player');
      };
      var main = [
        h('div', { class: 'v11-node__t',
          text: window.V12Drills ? V12Drills.name(d) : d.name }),
        h('div', { class: 'v11-node__s', text: t('train.path.meta', { reps: d.reps, mins: d.mins }) })
      ];
      if (isNext) main.push(h('div', { class: 'v11-node__now', text: t('train.path.start') }));
      wrap.appendChild(h('button', {
        class: 'v11-node ' + (isDone ? 'is-done' : isNext ? 'is-next' : 'is-open'),
        type: 'button',
        'aria-current': isNext ? 'step' : null,
        title: isDone ? t('train.path.doneTip')
                      : (isNext ? t('train.path.nextTip') : t('train.path.openTip')),
        onclick: open
      }, [
        h('div', { class: 'v11-node__dot' }, [
          h('i', { class: 'ph-fill ' + (isDone ? 'ph-check' : 'ph-play') })
        ]),
        h('div', { class: 'v11-node__main' }, main)
      ]));
    });
    return wrap;
  }

  function renderLibrary(sheet, ctx, drills) {
    sheet.appendChild(V.sheetHd(t('train.lib.hd'), t('train.lib.today', { n: drills.length })));
    drills.forEach(function (d) {
      sheet.appendChild(h('div', {
        class: 'v10-row', style: { boxShadow: '2px 2px 0 var(--ink)', cursor: 'pointer' },
        onclick: function () { ctx.go('drill-library'); }
      }, [
        h('div', { class: 'v10-row__main' }, [
          h('div', { class: 'v10-row__title',
            text: window.V12Drills ? V12Drills.name(d) : d.name }),
          h('div', { class: 'v10-row__sub',
            text: t('train.lib.rowSub', { focus: farea(d.focus || 'Skill'), reps: d.reps, mins: d.mins }) })
        ]),
        h('i', { class: 'ph-bold ph-arrow-right', style: { color: 'var(--muted)' } })
      ]));
    });
    sheet.appendChild(h('div', {
      class: 'v10-reels-link', onclick: function () { ctx.go('drill-library'); }
    }, [
      icon('ph-barbell'),
      h('span', { text: t('train.lib.full') }),
      h('i', { class: 'ph-bold ph-arrow-right v10-reels-link__arrow' })
    ]));
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    var tab = 'today';

    return Promise.all([
      ctx.data.getProfile(),
      ctx.data.getPlanDrills ? ctx.data.getPlanDrills() : ctx.data.getDrills(),
      ctx.data.getZones ? ctx.data.getZones() : {}
    ]).then(function (r) {
      var profile = r[0] || {};
      var drills = r[1] || [];
      var zones = r[2] || {};
      var prefs = ctx.data.getPlanPrefs ? ctx.data.getPlanPrefs() : null;

      /* ── DRILL OF THE DAY — aimed at the real weakness ──────────
         Worst RATED zone from the last 30 days picks the drill; with
         no rated zones there is no fake diagnosis — just the form
         fundamentals. The reason line says WHY, with the real number. */
      function drillOfTheDay() {
        var C = window.V11Court;
        var worst = null, worstPct = 101;
        Object.keys(zones).forEach(function (k) {
          var z = zones[k];
          if (!z || C.state(z) !== 'rated') return;
          var p = Math.round(z.made * 100 / z.vatt);
          if (p < worstPct) { worstPct = p; worst = k; }
        });
        var MAP = {
          lc: 'Corner Specialist Routine', rc: 'Corner Specialist Routine',
          lw: 'Relocation Threes', rw: 'Relocation Threes',
          top: 'Step-Back Three',
          ml: 'Mid-Range Pull-Up', mr: 'Mid-Range Pull-Up',
          topmid: 'Elbow Jumper Series', pnt: 'Mikan Drill'
        };
        var name = worst ? MAP[worst] : 'Form Shooting Close Range';
        var hit = null, DB = (typeof _DRILLS_DB !== 'undefined') ? _DRILLS_DB : [];
        for (var i = 0; i < DB.length; i++) if (DB[i].name === name) { hit = DB[i]; break; }
        if (!hit) return null;
        var zoneName = worst
          ? (C.LABEL[worst] || worst).replace(/^L /, 'left ').replace(/^R /, 'right ').toLowerCase()
          : '';
        if (worst) {
          var zk = 'train.zone.' + worst;
          var zn = t(zk);
          if (zn !== zk) zoneName = zn;
        }
        var reason = worst
          ? t('train.dotd.target', { zone: zoneName, pct: worstPct })
          : t('train.dotd.noZones');
        var thumb = null;
        try {
          var ch = window.V12DrillChoreo && window.V12DrillChoreo.get(hit);
          if (ch) thumb = window.V12DrillCourt.render(ch, { still: true, label: hit.name });
        } catch (e) {}
        return h('div', { class: 'tr12-dotd' }, [
          h('div', { class: 'tr12-dotd__hd' }, [
            h('i', { class: 'ph-fill ph-star' }),
            h('span', { text: t('train.dotd.hd') })
          ]),
          h('div', { class: 'tr12-dotd__row' }, [
            thumb ? h('div', { class: 'tr12-dotd__thumb' }, [thumb]) : null,
            h('div', { class: 'tr12-dotd__main' }, [
              h('div', { class: 'tr12-dotd__n',
                text: window.V12Drills ? V12Drills.name(hit) : hit.name }),
              h('div', { class: 'tr12-dotd__r', text: reason }),
              h('button', {
                class: 'tr12-dotd__go', type: 'button',
                onclick: function () {
                  try {
                    sessionStorage.setItem('courtiq_v11_drill', JSON.stringify({
                      id: hit.id, name: hit.name,
                      reps: hit.reps_or_sets ? parseInt(String(hit.reps_or_sets), 10) || 30 : 30,
                      mins: hit.duration_minutes || 10,
                      focus: hit.focus_area || 'Shooting',
                      description: hit.description || ''
                    }));
                  } catch (e2) {}
                  ctx.go('workout-player');
                }
              }, [h('i', { class: 'ph-fill ph-play-circle' }), h('span', { text: t('train.dotd.start') })])
            ]),
          ].filter(Boolean))
        ]);
      }

      function paint() {
        while (host.firstChild) host.removeChild(host.firstChild);
        var done = doneToday();
        var left = drills.filter(function (d) { return done.indexOf(d.id) < 0; });

        host.appendChild(h('div', { class: 'c12-chat-hd' }, [
          h('button', {
            class: 'c12-back', type: 'button', 'aria-label': t('train.back'),
            onclick: function () { ctx.go('track'); }
          }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
          h('div', {}, [
            h('div', { class: 'c12-chat-hd__t', text: t('train.hd.t') }),
            h('div', { class: 'c12-chat-hd__s', text: t('train.hd.s') })
          ])
        ]));
        host.appendChild(window.V12.seg([
          { id: 'today', label: t('train.tab.today') }, { id: 'library', label: t('train.tab.library') }
        ], tab, function (n) { tab = n; paint(); }));

        /* the plan the drills came from — one tap to reshape it */
        var FL = { shooting: t('train.focus.shooting'), handles: t('train.focus.handles'),
                   finishing: t('train.focus.finishing'), defense: t('train.focus.defense'),
                   conditioning: t('train.focus.conditioning'), passing: t('train.focus.passing') };
        var focusTxt = prefs && prefs.focus && prefs.focus.length
          ? prefs.focus.map(function (f) { return FL[f] || f; }).join(' · ')
          : t('train.plan.balanced');
        host.appendChild(window.V12.card({
          press: true, class: 'tr12-plan', bgIcon: 'ph-sliders', bgTone: 'blue',
          onClick: function () { ctx.go('plan'); }, label: t('train.plan.settings')
        }, [
          h('div', { style: { flex: '1', minWidth: '0' } }, [
            h('div', { class: 'tr12-plan__l', text: t('train.plan.label') }),
            h('div', { class: 'tr12-plan__v', text: prefs
              ? t('train.plan.summary', { days: prefs.days || 4, mins: prefs.minutes || 30, focus: focusTxt })
              : focusTxt })
          ]),
          h('i', { class: 'ph-bold ph-caret-right', style: { color: 'var(--d-mute)' } })
        ]));

        if (tab === 'today') {
          var dotd = drillOfTheDay();
          if (dotd) host.appendChild(dotd);
        }

        var sheet = V.sheet();
        host.appendChild(sheet);

        if (!drills.length) {
          sheet.appendChild(V.sheetHd(t('train.rx.eye')));
          sheet.appendChild(V.empty('ph-barbell', t('train.empty.t'), t('train.empty.s')));
        } else if (tab === 'today') {
          sheet.appendChild(rx(drills, done));
          sheet.appendChild(V.sheetHd(t('train.order.hd'),
            (drills.length - left.length) + '/' + drills.length));
          sheet.appendChild(path(drills, done, ctx));
          sheet.appendChild(h('div', {
            class: 'v11-basis',
            text: t('train.basis')
          }));
        } else {
          renderLibrary(sheet, ctx, drills);
        }

        var foot = h('div', { class: 'v11-foot' });
        if (drills.length && tab === 'today') {
          foot.appendChild(V.cta({
            icon: left.length ? 'ph-play-circle' : 'ph-crosshair-simple',
            label: left.length ? t('train.cta.start') : t('train.cta.shoot'),
            onClick: function () { ctx.go(left.length ? 'workout-player' : 'camera-hud'); }
          }));
        }
        foot.appendChild(V.cta({
          ghost: true, label: t('train.cta.browse'),
          onClick: function () { ctx.go('drill-library'); }
        }));
        host.appendChild(foot);
      }
      paint();
    });
  }

  window.app.register('train', render);
})();
