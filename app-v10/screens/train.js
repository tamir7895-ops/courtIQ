/* app-v10/screens/train.js
   TRAIN tab — For You / All Drills / Plans sub-tabs.
   Default "For You": mustard hero, 4-bento (drills/week/streak/intensity),
   WORKOUT PLAN ribbon, 2x2 drill grid, coach-note pin, start-workout CTA.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, icon = window.V10UI.icon;

  var SUBS = [
    { id: 'foryou',  label: 'For You' },
    { id: 'all',     label: 'All Drills' },
    { id: 'plans',   label: 'Plans' }
  ];

  // Tile accent rotation for drills coming from real data.
  var ACCENTS = ['orange', 'sage', 'mustard', 'ink-fill'];

  function chips(active, onPick) {
    var row = h('div', { class: 'v10-chips' });
    SUBS.forEach(function (s) {
      var cls = 'v10-chip' + (s.id === active ? ' is-active' : '');
      row.appendChild(h('button', {
        class: cls,
        onClick: function () { onPick(s.id); }
      }, [s.label]));
    });
    return row;
  }

  function heroForYou(firstDrill, drillsTotal) {
    var name = (firstDrill && firstDrill.name) ? firstDrill.name.toUpperCase() : 'FORM SHOOTING';
    var reps = (firstDrill && firstDrill.reps) ? firstDrill.reps : 50;
    var mins = (firstDrill && firstDrill.mins) ? firstDrill.mins : 8;
    var focus = (firstDrill && firstDrill.focus) ? firstDrill.focus.toUpperCase() : 'SHOOTING';
    return h('div', { class: 'v10-hero v10-hero--mustard' }, [
      h('div', { class: 'v10-hero__main' }, [
        h('div', { class: 'v10-hero__eyebrow' }, [
          icon('ph-barbell'),
          h('span', { text: 'DRILL 1 OF ' + (drillsTotal || 3) + ' · ' + reps + ' REPS' })
        ]),
        h('div', { class: 'v10-hero__headline', text: name + ' /' }),
        h('div', { class: 'v10-hero__headline', text: focus }),
        h('div', { class: 'v10-hero__sub', text: 'Est. ' + mins + ' min' })
      ])
    ]);
  }

  function bentoRow(opts) {
    opts = opts || {};
    var streak = opts.streak || 0;
    var week = opts.week || 0;
    var drillsTotal = opts.drillsTotal != null ? opts.drillsTotal : 3;
    return window.V10UI.bento([
      { variant: 'mustard', icon: 'ph-barbell',   value: '1/' + drillsTotal,  label: 'DRILLS' },
      { variant: 'orange',  icon: 'ph-flag',      value: week,     label: 'THIS WEEK' },
      { variant: undefined, icon: 'ph-fire',      value: streak,   label: 'STREAK',
        iconExtra: streak >= 3 ? 'v10-flicker' : '' },
      { variant: 'ink',     icon: 'ph-lightning', value: 'MED',    label: 'INTENSITY' }
    ]);
  }

  function drillTile(d, idx, onClick) {
    var tone = d.tone || ACCENTS[idx % ACCENTS.length];
    var cls = 'v10-tile v10-tile--' + tone;
    var iconName = d.icon || 'ph-basketball';
    var iconCls = 'ph-bold ' + iconName + ' v10-tile__icon';
    if (tone && tone !== 'ink-fill') iconCls += ' v10-tile__icon--' + tone;
    var num = d.num || ('0' + (idx + 1)).slice(-2);
    var reps = d.reps != null ? d.reps : 30;
    var mins = d.mins != null ? d.mins : 6;
    var meta = d.meta || (reps + ' REPS · ' + mins + ' MIN');
    var title = (d.title || d.name || 'DRILL').toUpperCase();
    return h('div', {
      class: cls,
      onclick: onClick || function () {}
    }, [
      h('div', { class: 'v10-tile__top' }, [
        h('i', { class: iconCls }),
        h('div', { class: 'v10-tile__num', text: num })
      ]),
      h('div', { class: 'v10-tile__title', text: title }),
      h('div', { class: 'v10-tile__meta',  text: meta })
    ]);
  }

  function moreTile(remaining, onClick) {
    return h('div', {
      class: 'v10-tile v10-tile--ink-fill',
      onclick: onClick
    }, [
      h('div', { class: 'v10-tile__top' }, [
        h('i', { class: 'ph-bold ph-list v10-tile__icon' }),
        h('div', { class: 'v10-tile__num', text: '+' + remaining })
      ]),
      h('div', { class: 'v10-tile__title', text: 'VIEW ALL' }),
      h('div', { class: 'v10-tile__meta', style: { color: 'var(--cream)' } }, [
        document.createTextNode('SEE LIBRARY '),
        h('i', { class: 'ph-bold ph-arrow-right' })
      ])
    ]);
  }

  function drillGrid(drills, ctx, switchTo) {
    var grid = h('div', { class: 'v10-grid' });
    var picks = (drills || []).slice(0, 3);
    var iconRotation = ['ph-crosshair-simple', 'ph-lightning', 'ph-target', 'ph-basketball'];
    picks.forEach(function (d, i) {
      grid.appendChild(drillTile({
        title: d.name,
        reps: d.reps,
        mins: d.mins,
        icon: iconRotation[i % iconRotation.length],
        tone: ACCENTS[i % ACCENTS.length]
      }, i, function () { ctx.go('workout-player'); }));
    });
    // Fill missing real drills with placeholders so the grid is always 2x2.
    while (grid.children.length < 3) {
      var idx = grid.children.length;
      grid.appendChild(drillTile({
        title: 'Drill ' + (idx + 1),
        reps: 25,
        mins: 6,
        icon: iconRotation[idx % iconRotation.length],
        tone: ACCENTS[idx % ACCENTS.length]
      }, idx, function () { ctx.go('workout-player'); }));
    }
    // 4th slot = "VIEW ALL" → switch to All Drills sub-tab.
    var remaining = Math.max(0, ((drills && drills.length) || 0) - 3);
    grid.appendChild(moreTile(remaining || 8, function () { switchTo('all'); }));
    return grid;
  }

  function renderForYou(host, ctx, switchTo) {
    Promise.all([
      ctx.data.getProfile(),
      ctx.data.getWeekStats(),
      ctx.data.getDrills(),
      ctx.data.getCoachVerdict()
    ]).then(function (results) {
      var profile = results[0] || {};
      var week    = results[1] || {};
      var drills  = results[2] || [];
      var coach   = results[3] || {};

      var firstDrill = drills[0] || null;
      var drillsTotal = drills.length || 3;
      var planMins = (drills || []).reduce(function (n, d) { return n + (d.mins || 6); }, 0) || 20;

      host.appendChild(heroForYou(firstDrill, drillsTotal));
      host.appendChild(bentoRow({
        streak: profile.streak,
        week: week.sessions || 0,
        drillsTotal: drillsTotal
      }));
      host.appendChild(window.V10UI.ribbon({
        icon: 'ph-barbell',
        title: 'WORKOUT PLAN',
        meta: drillsTotal + ' DRILLS · ' + planMins + ' MIN'
      }));
      host.appendChild(drillGrid(drills, ctx, switchTo));
      if (coach && coach.verdict) {
        host.appendChild(window.V10UI.pinCard({
          tab:  'COACH NOTE',
          body: coach.verdict,
          highlight: coach.highlight,
          sig:  'COACH'
        }));
      }

      // Flex spacer pushes the CTA toward the bottom of the viewport.
      host.appendChild(h('div', { style: { flex: '1 1 auto', minHeight: '4px' } }));

      host.appendChild(window.V10UI.cta({
        variant: 'orange',
        icon: 'ph-play-circle',
        label: 'START WORKOUT',
        onClick: function () { ctx.go('workout-player'); }
      }));
    });
  }

  function renderAll(host, ctx) {
    host.appendChild(window.V10UI.ribbon({
      icon: 'ph-barbell',
      title: 'ALL DRILLS',
      meta: 'LIBRARY'
    }));
    var rows = [
      { num: '01', title: 'Form Shooting',   sub: '50 reps · 8 min',  right: 'EASY' },
      { num: '02', title: 'Catch & Shoot',   sub: '30 reps · 6 min',  right: 'EASY' },
      { num: '03', title: 'Quick Draw',      sub: '20 reps · 4 min',  right: 'MED'  },
      { num: '04', title: 'Free Throws',     sub: '40 reps · 10 min', right: 'EASY' },
      { num: '05', title: 'Pull-Up Jumper',  sub: '25 reps · 7 min',  right: 'HARD' },
      { num: '06', title: 'Step-Back Three', sub: '20 reps · 6 min',  right: 'HARD' }
    ];

    // Try to enrich with real drills if available.
    ctx.data.getDrills().then(function (real) {
      if (real && real.length) {
        real.slice(0, rows.length).forEach(function (d, i) {
          rows[i] = {
            num:   ('0' + (i + 1)).slice(-2),
            title: d.name || rows[i].title,
            sub:   (d.reps || 30) + ' reps · ' + (d.mins || 6) + ' min',
            right: i < 2 ? 'EASY' : (i < 4 ? 'MED' : 'HARD')
          };
        });
      }
      rows.forEach(function (r) {
        host.appendChild(h('div', {
          class: 'v10-row',
          onclick: function () { ctx.go('drill-library'); }
        }, [
          h('div', { class: 'v10-row__num', text: r.num }),
          h('div', { class: 'v10-row__main' }, [
            h('div', { class: 'v10-row__title', text: r.title }),
            h('div', { class: 'v10-row__sub',   text: r.sub })
          ]),
          h('div', { class: 'v10-row__right', text: r.right })
        ]));
      });

      host.appendChild(h('div', { style: { flex: '1 1 auto', minHeight: '4px' } }));
      host.appendChild(window.V10UI.cta({
        variant: 'orange',
        icon: 'ph-books',
        label: 'OPEN FULL LIBRARY',
        onClick: function () { ctx.go('drill-library'); }
      }));
    });
  }

  function renderPlans(host, ctx) {
    host.appendChild(window.V10UI.ribbon({
      icon: 'ph-flag',
      title: 'WORKOUT PLANS',
      meta: 'CHOOSE A TRACK'
    }));
    var rows = [
      { num: 'A', title: 'Sniper Builder',     sub: '5 drills · 28 min', right: 'NEW'  },
      { num: 'B', title: 'Footwork Friday',    sub: '4 drills · 22 min', right: 'PRO'  },
      { num: 'C', title: 'Free Throw Mastery', sub: '3 drills · 15 min', right: 'EASY' }
    ];
    rows.forEach(function (r) {
      host.appendChild(h('div', {
        class: 'v10-row',
        onclick: function () { ctx.go('workout-player'); }
      }, [
        h('div', { class: 'v10-row__num', text: r.num }),
        h('div', { class: 'v10-row__main' }, [
          h('div', { class: 'v10-row__title', text: r.title }),
          h('div', { class: 'v10-row__sub',   text: r.sub })
        ]),
        h('div', { class: 'v10-row__right', text: r.right })
      ]));
    });

    host.appendChild(h('div', { style: { flex: '1 1 auto', minHeight: '4px' } }));
    host.appendChild(window.V10UI.cta({
      variant: 'orange',
      icon: 'ph-play-circle',
      label: 'START FIRST PLAN',
      onClick: function () { ctx.go('workout-player'); }
    }));
  }

  function render(args) {
    var host = args.host;
    var ctx  = args.ctx;
    var sub  = 'foryou';

    function switchTo(id) { sub = id; paint(); }

    function paint() {
      while (host.firstChild) host.removeChild(host.firstChild);
      // Make the host a column flex container so the spacer can push the CTA down.
      host.style.display = 'flex';
      host.style.flexDirection = 'column';
      host.style.minHeight = '100%';

      ctx.data.getProfile().then(function (profile) {
        host.appendChild(ctx.ui.headerPill({ profile: profile }));
        host.appendChild(chips(sub, switchTo));
        if (sub === 'all')        renderAll(host, ctx);
        else if (sub === 'plans') renderPlans(host, ctx);
        else                      renderForYou(host, ctx, switchTo);
      });
    }

    paint();
  }

  window.app.register('train', render);
})();
