/* app-v10/screens/coach.js
   COACH tab — Verdict / Insights / Briefings sub-tabs.
   Default "Verdict": ink hero, 4-bento (trend/hot/cold/sessions),
   THIS WEEK ribbon (taps -> briefings), 2x2 drill grid (taps -> drill-library),
   deeper-look pin, full-briefing CTA (taps -> briefings sub-tab).
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, icon = window.V10UI.icon;

  var SUBS = [
    { id: 'verdict',    label: 'Verdict' },
    { id: 'insights',   label: 'Insights' },
    { id: 'briefings',  label: 'Briefings' }
  ];

  // Fallback drill set if ctx.data.getDrills() yields nothing.
  var FALLBACK_DRILLS = [
    { num: 'P1', title: 'Left-Wing Form',  meta: '50 REPS · 12 MIN', icon: 'ph-crosshair-simple', tone: 'orange'   },
    { num: 'P2', title: 'Catch & Release', meta: '5×5 · 15 MIN',     icon: 'ph-lightning',        tone: 'sage'     },
    { num: 'P3', title: 'Free Throw Set',  meta: '50 REPS · 10 MIN', icon: 'ph-target',           tone: 'mustard'  },
    { num: 'P4', title: 'Conditioning',    meta: '10 MIN FINISHER',  icon: 'ph-barbell',          tone: 'ink-fill' }
  ];

  // Map an accent string from data layer to v10 tile tone.
  var TONE_BY_ACCENT = { orange: 'orange', sage: 'sage', mustard: 'mustard' };
  var ICON_BY_TONE   = {
    orange:    'ph-crosshair-simple',
    sage:      'ph-lightning',
    mustard:   'ph-target',
    'ink-fill':'ph-barbell'
  };

  function drillsFromData(list) {
    if (!list || !list.length) return FALLBACK_DRILLS;
    var tones = ['orange', 'sage', 'mustard', 'ink-fill'];
    return list.slice(0, 4).map(function (d, i) {
      var tone = TONE_BY_ACCENT[d.accent] || tones[i % tones.length];
      return {
        id:    d.id,
        num:   'P' + (i + 1),
        title: (d.name || 'Drill').toUpperCase(),
        meta:  ((d.reps || 30) + ' REPS · ' + (d.mins || 6) + ' MIN').toUpperCase(),
        icon:  ICON_BY_TONE[tone] || 'ph-crosshair-simple',
        tone:  tone
      };
    });
  }

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

  function heroVerdict(coach, week) {
    var eyebrowText = 'TODAY VERDICT · ' + ((week && week.sessions) || 0) + ' SESSIONS';
    var headline = (coach && coach.highlight)
      ? coach.highlight.toUpperCase()
      : 'YOUR LEFT WING IS LEAKING.';
    var sub = (coach && coach.verdict && coach.verdict !== coach.highlight)
      ? coach.verdict
      : 'Time to plug it. — Coach';
    return h('div', { class: 'v10-hero v10-hero--ink' }, [
      h('div', { class: 'v10-hero__main' }, [
        h('div', { class: 'v10-hero__eyebrow' }, [
          icon('ph-brain'),
          h('span', { text: eyebrowText })
        ]),
        h('div', { class: 'v10-hero__headline', text: headline }),
        h('div', { class: 'v10-hero__sub', text: sub })
      ])
    ]);
  }

  function bentoRow(today, week, profile) {
    var trend  = (today && today.trend != null) ? today.trend : 6;
    var trendStr = (trend >= 0 ? '+' : '') + trend + '%';
    var sessions = (week && week.sessions != null) ? week.sessions : 3;
    var streak = (profile && profile.streak) || 0;
    // streak fire icon: flicker when streak >= 3 (the HOT cell doubles as a streak indicator)
    var hotCell = { variant: 'orange',  icon: 'ph-fire',             value: 'R-WING', label: 'HOT' };
    if (streak >= 3) hotCell.iconExtra = 'v10-flicker';
    return window.V10UI.bento([
      { variant: 'sage',    icon: 'ph-trend-up',         value: trendStr,    label: 'TREND' },
      hotCell,
      { variant: 'mustard', icon: 'ph-crosshair-simple', value: 'L-WING',    label: 'COLD' },
      { variant: 'ink',     icon: 'ph-flag',             value: sessions,    label: 'SESSIONS' }
    ]);
  }

  function drillTile(d, ctx) {
    var cls = 'v10-tile' + (d.tone ? ' v10-tile--' + d.tone : '');
    var iconCls = 'ph-bold ' + d.icon + ' v10-tile__icon';
    if (d.tone && d.tone !== 'ink-fill') iconCls += ' v10-tile__icon--' + d.tone;
    return h('div', {
      class: cls,
      role: 'button',
      tabindex: '0',
      onclick: function () { ctx.go('drill-library'); }
    }, [
      h('div', { class: 'v10-tile__top' }, [
        h('i', { class: iconCls }),
        h('div', { class: 'v10-tile__num', text: d.num })
      ]),
      h('div', { class: 'v10-tile__title', text: d.title }),
      h('div', { class: 'v10-tile__meta',  text: d.meta })
    ]);
  }

  function drillGrid(drills, ctx) {
    var grid = h('div', { class: 'v10-grid' });
    drills.forEach(function (d) { grid.appendChild(drillTile(d, ctx)); });
    return grid;
  }

  function spacer() {
    return h('div', { style: { flex: '1 1 auto', minHeight: '0' } });
  }

  function renderVerdict(host, ctx, bundle, switchSub) {
    host.appendChild(heroVerdict(bundle.coach, bundle.week));
    host.appendChild(bentoRow(bundle.today, bundle.week, bundle.profile));

    // Ribbon is tappable: jumps to the Briefings sub-tab.
    var thisWeek = window.V10UI.ribbon({
      icon: 'ph-flag',
      title: 'THIS WEEK',
      meta: 'BRIEFING'
    });
    thisWeek.style.cursor = 'pointer';
    thisWeek.setAttribute('role', 'button');
    thisWeek.addEventListener('click', function () { switchSub('briefings'); });
    host.appendChild(thisWeek);

    host.appendChild(drillGrid(bundle.drills, ctx));

    host.appendChild(window.V10UI.pinCard({
      tab:  'DEEPER LOOK',
      body: 'Compared to your last 5 sessions, paint efficiency held but your three-point split widened. Triage left wing first.',
      highlight: 'three-point split widened',
      sig:  'AI SCOUT'
    }));

    host.appendChild(spacer());

    host.appendChild(window.V10UI.cta({
      icon: 'ph-arrow-right',
      label: 'READ FULL BRIEFING',
      onClick: function () { switchSub('briefings'); }
    }));
  }

  function renderInsights(host, ctx, switchSub) {
    host.appendChild(window.V10UI.ribbon({
      icon: 'ph-brain',
      title: 'INSIGHTS',
      meta: 'COACH FEED'
    }));
    var msg = h('div', { class: 'v10-pin' }, [
      h('div', { class: 'v10-pin__tab' }, [icon('ph-push-pin-simple'), h('span', { text: 'NO NEW INSIGHTS' })]),
      h('div', { class: 'v10-pin__body', text: 'Your weekly briefing covers everything new. Head back to Verdict for today’s call.' })
    ]);
    host.appendChild(msg);

    host.appendChild(spacer());

    host.appendChild(window.V10UI.cta({
      icon: 'ph-arrow-left',
      label: 'BACK TO VERDICT',
      onClick: function () { switchSub('verdict'); }
    }));
  }

  function renderBriefings(host, ctx, switchSub) {
    host.appendChild(window.V10UI.ribbon({
      icon: 'ph-flag',
      title: 'BRIEFINGS',
      meta: 'PAST WEEKS'
    }));
    var rows = [
      { num: 'W18', title: 'Mid-range on fire',  sub: 'MAY 4 · 3 sessions',  right: '78' },
      { num: 'W17', title: 'Defense sharpened',  sub: 'APR 27 · 4 sessions', right: '72' },
      { num: 'W16', title: 'Cuts without ball',  sub: 'APR 20 · 3 sessions', right: '69' }
    ];
    rows.forEach(function (r) {
      var row = h('div', {
        class: 'v10-row',
        role: 'button',
        tabindex: '0',
        onclick: function () { ctx.go('post-session'); }
      }, [
        h('div', { class: 'v10-row__num', text: r.num }),
        h('div', { class: 'v10-row__main' }, [
          h('div', { class: 'v10-row__title', text: r.title }),
          h('div', { class: 'v10-row__sub',   text: r.sub })
        ]),
        h('div', { class: 'v10-row__right', text: r.right })
      ]);
      row.style.cursor = 'pointer';
      host.appendChild(row);
    });

    host.appendChild(spacer());

    host.appendChild(window.V10UI.cta({
      icon: 'ph-arrow-left',
      label: 'BACK TO VERDICT',
      onClick: function () { switchSub('verdict'); }
    }));
  }

  function render(args) {
    var host = args.host;
    var ctx  = args.ctx;
    var sub  = 'verdict';

    // Make the host a flex column so spacer() pushes the CTA to the bottom.
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.minHeight = '0';

    function switchSub(id) { sub = id; paint(); }

    function paint() {
      while (host.firstChild) host.removeChild(host.firstChild);
      Promise.all([
        ctx.data.getProfile(),
        ctx.data.getTodayStats(),
        ctx.data.getWeekStats(),
        ctx.data.getCoachVerdict(),
        ctx.data.getDrills()
      ]).then(function (results) {
        var bundle = {
          profile: results[0] || {},
          today:   results[1] || {},
          week:    results[2] || {},
          coach:   results[3] || {},
          drills:  drillsFromData(results[4])
        };
        host.appendChild(ctx.ui.headerPill({ profile: bundle.profile }));
        host.appendChild(chips(sub, switchSub));
        if (sub === 'insights')       renderInsights(host, ctx, switchSub);
        else if (sub === 'briefings') renderBriefings(host, ctx, switchSub);
        else                          renderVerdict(host, ctx, bundle, switchSub);
      });
    }

    paint();
  }

  window.app.register('coach', render);
})();
