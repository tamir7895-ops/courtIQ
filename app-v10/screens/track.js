/* app-v10/screens/track.js
   TRACK tab — sage-green accent. Sub-tabs: Overview / Heatmap / Sessions.
   Default view is Overview. Uses parquet-wood .v10-court hero with shot bubbles.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  // Compact "test with a video file" button — renders under the primary
  // TRACK NEW SESSION CTA. Runs the same engine end-to-end but reads
  // frames from an uploaded video instead of the live camera, so the
  // model can be tested without being at a court.
  function uploadCta(ctx) {
    return h('button', {
      type: 'button',
      onclick: function () {
        if (ctx.data && ctx.data.pickAndOpenFile) ctx.data.pickAndOpenFile();
      },
      style: {
        marginTop: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        width: '100%', padding: '12px 18px',
        background: 'transparent',
        border: '2px dashed rgba(10,40,80,0.35)',
        borderRadius: '10px',
        color: 'var(--ink)',
        fontFamily: 'var(--font-display)', fontWeight: '800',
        fontSize: '13px', letterSpacing: '0.08em',
        cursor: 'pointer'
      }
    }, [
      h('i', { class: 'ph-bold ph-upload-simple', style: { fontSize: '16px' } }),
      h('span', { text: 'TEST WITH VIDEO FILE' })
    ]);
  }

  // Bubble positions on a 280x220 half-court SVG.
  var ZONE_POS = {
    lc:  { x: 25,  y: 40  },
    lw:  { x: 50,  y: 150 },
    top: { x: 140, y: 200 },
    rw:  { x: 230, y: 150 },
    rc:  { x: 255, y: 40  },
    ml:  { x: 80,  y: 90  },
    mr:  { x: 200, y: 90  },
    pnt: { x: 140, y: 40  }
  };

  function zoneAcc(z) {
    if (!z || !z.att) return 0;
    return z.made / z.att;
  }

  function bubbleFill(acc) {
    if (acc >= 0.55) return '#FF4F1F'; // hot — orange
    if (acc <= 0.40) return '#E0A82E'; // cool — mustard
    return '#FBF5E8';                  // neutral — cream
  }

  function bubbleStroke(acc) {
    return acc >= 0.55 ? '#0A2850' : '#0A2850';
  }

  function bubbleTextColor(acc) {
    return (acc >= 0.55) ? '#FBF5E8' : '#0A2850';
  }

  function buildCourtSvg(zones) {
    var lines = [
      // Paint rect (90, 0, 100, 80)
      svg('rect', {
        x: 90, y: 0, width: 100, height: 80,
        fill: 'rgba(240,230,210,0.10)',
        stroke: '#F0E6D2', 'stroke-width': 1.6
      }),
      // Free-throw circle
      svg('circle', {
        cx: 140, cy: 80, r: 28,
        fill: 'none', stroke: '#F0E6D2', 'stroke-width': 1.6
      }),
      // 3pt arc (THICK divider)
      svg('path', {
        d: 'M 10,80 Q 10,220 140,220 Q 270,220 270,80',
        fill: 'none', stroke: '#F0E6D2', 'stroke-width': 3.2
      }),
      // Backboard line
      svg('line', {
        x1: 120, y1: 4, x2: 160, y2: 4,
        stroke: '#F0E6D2', 'stroke-width': 2.5
      }),
      // Corner-3 lines
      svg('line', { x1: 10, y1: 0, x2: 10, y2: 80, stroke: '#F0E6D2', 'stroke-width': 1.6 }),
      svg('line', { x1: 270, y1: 0, x2: 270, y2: 80, stroke: '#F0E6D2', 'stroke-width': 1.6 }),
      // Rim
      svg('circle', {
        cx: 140, cy: 80, r: 5,
        fill: '#FF4F1F', stroke: '#0A2850', 'stroke-width': 1.5
      })
    ];

    // Add bubbles for each zone
    var bubbles = [];
    Object.keys(ZONE_POS).forEach(function (key) {
      var z = zones[key];
      if (!z) return;
      var pos = ZONE_POS[key];
      var acc = zoneAcc(z);
      var r = z.att > 0 ? Math.max(10, Math.min(18, 8 + z.att * 1.4)) : 9;
      bubbles.push(svg('circle', {
        cx: pos.x, cy: pos.y, r: r,
        fill: bubbleFill(acc),
        'fill-opacity': z.att > 0 ? 0.92 : 0.45,
        stroke: bubbleStroke(acc),
        'stroke-width': 1.6
      }));
      if (z.att > 0) {
        bubbles.push(svg('text', {
          x: pos.x, y: pos.y + 4,
          'text-anchor': 'middle',
          'font-family': 'Barlow Condensed, Impact, sans-serif',
          'font-weight': 800,
          'font-size': 12,
          fill: bubbleTextColor(acc)
        }, [String(z.made)]));
      }
    });

    return svg('svg', {
      viewBox: '0 0 280 220',
      width: '100%',
      style: 'display:block;max-width:100%;height:auto'
    }, lines.concat(bubbles));
  }

  function chips(active, onChange) {
    var labels = [
      { id: 'overview', label: 'OVERVIEW' },
      { id: 'heatmap',  label: 'HEATMAP' },
      { id: 'sessions', label: 'SESSIONS' }
    ];
    return h('div', { class: 'v10-chips' }, labels.map(function (c) {
      return h('div', {
        class: 'v10-chip' + (c.id === active ? ' is-active' : ''),
        onclick: function () { onChange(c.id); }
      }, [c.label]);
    }));
  }

  // Sort zones by accuracy and pull top 3 hot ones.
  function topZones(zones) {
    var list = Object.keys(zones).map(function (key) {
      return { key: key, z: zones[key], acc: zoneAcc(zones[key]) };
    }).filter(function (x) { return x.z.att > 0; });
    list.sort(function (a, b) { return b.acc - a.acc; });
    return list.slice(0, 3);
  }

  function pctText(z) {
    return z.att > 0 ? Math.round((z.made / z.att) * 100) + '%' : '—';
  }

  // Aggregate zones into PAINT / MID / 3PT buckets and return integer pct.
  function bucketPct(zones, keys) {
    var made = 0, att = 0;
    keys.forEach(function (k) {
      var z = zones[k];
      if (!z) return;
      made += z.made || 0;
      att  += z.att  || 0;
    });
    return att > 0 ? Math.round(made * 100 / att) : 0;
  }

  function renderOverview(host, ctx, zones, today) {
    // Hero — parquet wood court with shot bubbles
    var eyebrow = h('div', { class: 'v10-court__eyebrow' }, [
      icon('ph-crosshair-simple'),
      h('span', { text: 'LAST 7 DAYS' })
    ]);
    host.appendChild(h('section', { class: 'v10-court' }, [
      eyebrow,
      buildCourtSvg(zones)
    ]));

    // 4-bento — real numbers from zones / today stats
    var paintPct = bucketPct(zones, ['pnt']);
    var midPct   = bucketPct(zones, ['ml', 'mr', 'topmid']);
    var threePct = bucketPct(zones, ['lc', 'lw', 'top', 'rw', 'rc']);
    var trendVal = (today && today.trend != null) ? today.trend : 6;
    var trendStr = (trendVal >= 0 ? '+' : '') + trendVal + 'pp';
    host.appendChild(window.V10UI.bento([
      { variant: 'orange',  icon: 'ph-target',   value: paintPct + '%', label: 'PAINT' },
      { variant: null,      icon: 'ph-target',   value: midPct   + '%', label: 'MID' },
      { variant: 'ink',     icon: 'ph-target',   value: threePct + '%', label: '3PT' },
      { variant: 'sage',    icon: 'ph-trend-up', value: trendStr,       label: 'TREND' }
    ]));

    // HOT ZONES ribbon + 3 zone chips (single row, compact)
    var top = topZones(zones);
    while (top.length < 3) top.push({ key: '_', z: { made: 0, att: 0, label: '—' }, acc: 0 });
    host.appendChild(window.V10UI.ribbon({
      icon: 'ph-fire',
      title: 'HOT ZONES',
      meta: 'TOP 3'
    }));
    var zoneChips = top.slice(0, 3).map(function (t, idx) {
      var variants = ['orange', 'sage', 'mustard'];
      return h('div', {
        style: {
          flex: '1', background: 'var(--cream)', border: '1.5px solid var(--ink)',
          padding: '8px 6px', textAlign: 'center', boxShadow: '2px 2px 0 var(--ink)'
        }
      }, [
        h('div', {
          style: {
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '9px',
            letterSpacing: '0.18em', color: 'var(--' + variants[idx] + ')', marginBottom: '2px'
          },
          text: (t.z.label || '—').toUpperCase().slice(0, 10)
        }),
        h('div', {
          style: {
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '20px',
            color: 'var(--ink)', lineHeight: '0.9'
          },
          text: t.z.made + '/' + t.z.att
        }),
        h('div', {
          style: {
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: 'var(--muted)', marginTop: '2px'
          },
          text: pctText(t.z)
        })
      ]);
    });
    host.appendChild(h('div', { style: { display: 'flex', gap: '6px' } }, zoneChips));

    // CTA
    host.appendChild(window.V10UI.cta({
      variant: 'orange',
      icon: 'ph-play-circle',
      label: 'TRACK NEW SESSION',
      onClick: function () { ctx.go('camera-hud'); }
    }));
    host.appendChild(uploadCta(ctx));
  }

  // HEATMAP — bigger court hero, ranked zone breakdown, CTA to start session.
  function renderHeatmap(host, ctx, zones) {
    var eyebrow = h('div', { class: 'v10-court__eyebrow' }, [
      icon('ph-fire'),
      h('span', { text: 'ZONE HEATMAP · 30 DAYS' })
    ]);
    host.appendChild(h('section', { class: 'v10-court' }, [
      eyebrow,
      buildCourtSvg(zones)
    ]));

    // Ranked rows for every zone with attempts
    var ranked = Object.keys(zones).map(function (k) {
      return { key: k, z: zones[k], acc: zoneAcc(zones[k]) };
    }).filter(function (x) { return x.z && x.z.att > 0; });
    ranked.sort(function (a, b) { return b.acc - a.acc; });

    host.appendChild(window.V10UI.ribbon({
      icon: 'ph-list-numbers',
      title: 'ZONE BREAKDOWN',
      meta: ranked.length + ' ZONES'
    }));

    ranked.slice(0, 4).forEach(function (t, i) {
      host.appendChild(h('div', {
        class: 'v10-row',
        onclick: function () { ctx.go('camera-hud'); }
      }, [
        h('div', { class: 'v10-row__num', text: '0' + (i + 1) }),
        h('div', { class: 'v10-row__main' }, [
          h('div', { class: 'v10-row__title', text: (t.z.label || t.key).toUpperCase() }),
          h('div', { class: 'v10-row__sub', text: t.z.made + ' of ' + t.z.att + ' shots' })
        ]),
        h('div', { class: 'v10-row__right', text: pctText(t.z) })
      ]));
    });

    // Spacer pushes CTA to bottom of viewport
    host.appendChild(h('div', { style: { flex: '1', minHeight: '4px' } }));

    host.appendChild(window.V10UI.cta({
      variant: 'orange',
      icon: 'ph-play-circle',
      label: 'TRACK NEW SESSION',
      onClick: function () { ctx.go('camera-hud'); }
    }));
    host.appendChild(uploadCta(ctx));
  }

  // SESSIONS — list view; clicking a row goes to post-session recap.
  function renderSessions(host, ctx) {
    host.appendChild(window.V10UI.ribbon({
      icon: 'ph-flag',
      title: 'SESSION HISTORY',
      meta: 'LAST 7 DAYS'
    }));

    var sessions = [
      { n: '01', t: 'Form Shooting',  s: 'Today · 76% · 30 shots',     r: '76%' },
      { n: '02', t: 'Catch & Shoot',  s: 'Yesterday · 68% · 25 shots', r: '68%' },
      { n: '03', t: 'Quick Draw',     s: 'Mon · 71% · 20 shots',       r: '71%' },
      { n: '04', t: '3PT Drill',      s: 'Sun · 42% · 18 shots',       r: '42%' }
    ];

    // Try to use the latest real session at the top if signed in
    ctx.data.getLatestSession().then(function (latest) {
      if (latest && latest.attempted) {
        var row = h('div', {
          class: 'v10-row',
          onclick: function () { ctx.go('post-session'); }
        }, [
          h('div', { class: 'v10-row__num', text: '01' }),
          h('div', { class: 'v10-row__main' }, [
            h('div', { class: 'v10-row__title', text: 'LATEST SESSION' }),
            h('div', { class: 'v10-row__sub',   text: latest.made + ' of ' + latest.attempted + ' · streak ' + (latest.maxStreak || 0) })
          ]),
          h('div', { class: 'v10-row__right', text: latest.accuracy + '%' })
        ]);
        // Insert real row right after the ribbon
        var ribbonEl = host.firstChild;
        host.insertBefore(row, ribbonEl ? ribbonEl.nextSibling : null);
      }
    });

    sessions.forEach(function (s) {
      host.appendChild(h('div', {
        class: 'v10-row',
        onclick: function () { ctx.go('post-session'); }
      }, [
        h('div', { class: 'v10-row__num', text: s.n }),
        h('div', { class: 'v10-row__main' }, [
          h('div', { class: 'v10-row__title', text: s.t }),
          h('div', { class: 'v10-row__sub', text: s.s })
        ]),
        h('div', { class: 'v10-row__right', text: s.r })
      ]));
    });

    // Spacer pushes CTA to bottom
    host.appendChild(h('div', { style: { flex: '1', minHeight: '4px' } }));

    host.appendChild(window.V10UI.cta({
      variant: 'orange',
      icon: 'ph-play-circle',
      label: 'TRACK NEW SESSION',
      onClick: function () { ctx.go('camera-hud'); }
    }));
    host.appendChild(uploadCta(ctx));
  }

  function render(args) {
    var host = args.host;
    var ctx  = args.ctx;
    var activeChip = 'overview';

    Promise.all([
      ctx.data.getProfile(),
      ctx.data.getZones(),
      ctx.data.getTodayStats()
    ]).then(function (results) {
      var profile = results[0] || {};
      var zones   = results[1] || {};
      var today   = results[2] || {};

      function paint() {
        while (host.firstChild) host.removeChild(host.firstChild);
        // Make host a vertical flex column so spacer-based push-to-bottom works
        host.style.display = 'flex';
        host.style.flexDirection = 'column';
        host.style.minHeight = '100%';

        host.appendChild(ctx.ui.headerPill({ profile: profile }));
        host.appendChild(chips(activeChip, function (next) {
          activeChip = next; paint();
        }));
        if (activeChip === 'overview') {
          renderOverview(host, ctx, zones, today);
        } else if (activeChip === 'heatmap') {
          renderHeatmap(host, ctx, zones);
        } else {
          renderSessions(host, ctx);
        }
      }
      paint();
    });
  }

  window.app.register('track', render);
})();
