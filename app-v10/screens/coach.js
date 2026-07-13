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
    if (!coach || !coach.verdict) {
      return h('div', { class: 'v10-hero v10-hero--ink' }, [
        h('div', { class: 'v10-hero__main' }, [
          h('div', { class: 'v10-hero__eyebrow' }, [
            icon('ph-brain'),
            h('span', { text: eyebrowText })
          ]),
          h('div', { class: 'v10-hero__headline', text: 'NO VERDICT YET.' }),
          h('div', { class: 'v10-hero__sub', text: 'Upload a scored session — the coach only talks about shots that really happened.' })
        ])
      ]);
    }
    return h('div', { class: 'v10-hero v10-hero--ink' }, [
      h('div', { class: 'v10-hero__main' }, [
        h('div', { class: 'v10-hero__eyebrow' }, [
          icon('ph-brain'),
          h('span', { text: eyebrowText })
        ]),
        h('div', { class: 'v10-hero__headline', text: coach.highlight.toUpperCase() }),
        h('div', { class: 'v10-hero__sub', text: coach.verdict })
      ])
    ]);
  }

  // Best / worst zones with real verdict evidence (≥4 scored shots).
  function extremeZones(zones) {
    var best = null, worst = null;
    if (zones) {
      Object.keys(zones).forEach(function (k) {
        var z = zones[k];
        if (!z || z.vatt < 4) return;
        var pct = z.made / z.vatt;
        if (!best || pct > best.pct) best = { pct: pct, label: z.label };
        if (!worst || pct < worst.pct) worst = { pct: pct, label: z.label };
      });
    }
    return { best: best, worst: worst };
  }

  function bentoRow(today, week, profile, zones) {
    var ex = extremeZones(zones);
    var streak = (profile && profile.streak) || 0;
    var hotCell = {
      variant: 'orange', icon: 'ph-fire',
      value: ex.best ? ex.best.label.toUpperCase().slice(0, 8) : '—',
      label: 'HOT'
    };
    if (streak >= 3) hotCell.iconExtra = 'v10-flicker';
    return window.V10UI.bento([
      { variant: 'sage',    icon: 'ph-basketball',       value: (week && week.attempts) || 0, label: 'SHOTS · WK' },
      hotCell,
      { variant: 'mustard', icon: 'ph-crosshair-simple', value: ex.worst ? ex.worst.label.toUpperCase().slice(0, 8) : '—', label: 'COLD' },
      { variant: 'ink',     icon: 'ph-flag',             value: (week && week.sessions) || 0, label: 'SESSIONS' }
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
    host.appendChild(bentoRow(bundle.today, bundle.week, bundle.profile, bundle.zones));

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

    if (bundle.coach && bundle.coach.verdict) {
      host.appendChild(window.V10UI.pinCard({
        tab:  'DEEPER LOOK',
        body: bundle.coach.verdict,
        highlight: bundle.coach.highlight,
        sig:  'AI SCOUT'
      }));
    }

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

  // Real per-week rollups from the merged session store.
  function renderBriefings(host, ctx, switchSub) {
    host.appendChild(window.V10UI.ribbon({
      icon: 'ph-flag',
      title: 'BRIEFINGS',
      meta: 'PAST WEEKS'
    }));

    var listWrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    host.appendChild(listWrap);

    ctx.data.getSessions(100).then(function (rows) {
      var weeks = {};   // monday-ISO → { att, made, vatt, n, t }
      (rows || []).forEach(function (s) {
        var d = new Date(s.session_date || s.created_at || 0);
        if (isNaN(d)) return;
        var monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        var key = monday.toISOString().slice(0, 10);
        var w = (weeks[key] = weeks[key] || { att: 0, made: 0, vatt: 0, n: 0, t: monday });
        w.n += 1;
        w.att += s.total_attempts || 0;
        if (s.total_made != null) { w.vatt += s.total_attempts || 0; w.made += s.total_made || 0; }
      });
      var keys = Object.keys(weeks).sort().reverse().slice(0, 4);
      if (!keys.length) {
        listWrap.appendChild(h('div', { class: 'v10-row', style: { boxShadow: '2px 2px 0 var(--ink)' } }, [
          h('div', { class: 'v10-row__num' }, [icon('ph-flag')]),
          h('div', { class: 'v10-row__main' }, [
            h('div', { class: 'v10-row__title', text: 'NO BRIEFINGS YET' }),
            h('div', { class: 'v10-row__sub', text: 'Weekly rollups appear after your first sessions.' })
          ])
        ]));
        return;
      }
      keys.forEach(function (k, i) {
        var w = weeks[k];
        var right = w.vatt ? Math.round(w.made * 100 / w.vatt) + '%' : String(w.att);
        var label = w.t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
        listWrap.appendChild(h('div', { class: 'v10-row' }, [
          h('div', { class: 'v10-row__num', text: 'W' + (keys.length - i) }),
          h('div', { class: 'v10-row__main' }, [
            h('div', { class: 'v10-row__title', text: 'WEEK OF ' + label }),
            h('div', { class: 'v10-row__sub',   text: w.n + ' sessions · ' + w.att + ' shots' })
          ]),
          h('div', { class: 'v10-row__right', text: right })
        ]));
      });
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
        ctx.data.getDrills(),
        ctx.data.getZones()
      ]).then(function (results) {
        var bundle = {
          profile: results[0] || {},
          today:   results[1] || {},
          week:    results[2] || {},
          coach:   results[3],          // null until real zone evidence exists
          drills:  drillsFromData(results[4]),
          zones:   results[5]
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
