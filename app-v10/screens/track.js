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

  // Accuracy over VERDICT shots only (vatt) — live-counter shots grow the
  // bubbles but never fabricate a percentage.
  function zoneAcc(z) {
    if (!z || !z.vatt) return 0;
    return z.made / z.vatt;
  }
  function hasVerdicts(z) { return z && z.vatt > 0; }

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
      // Zones with only counter shots stay neutral — volume, no verdict.
      bubbles.push(svg('circle', {
        cx: pos.x, cy: pos.y, r: r,
        fill: hasVerdicts(z) ? bubbleFill(acc) : '#FBF5E8',
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
          fill: hasVerdicts(z) ? bubbleTextColor(acc) : '#0A2850'
        }, [String(hasVerdicts(z) ? z.made : z.att)]));
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
    return hasVerdicts(z) ? Math.round((z.made / z.vatt) * 100) + '%' : '—';
  }

  // Aggregate zones into PAINT / MID / 3PT buckets over VERDICT shots.
  function bucketPct(zones, keys) {
    var made = 0, vatt = 0;
    keys.forEach(function (k) {
      var z = zones[k];
      if (!z) return;
      made += z.made || 0;
      vatt += z.vatt || 0;
    });
    return vatt > 0 ? Math.round(made * 100 / vatt) + '%' : '—';
  }

  function totalAttempts(zones) {
    return Object.keys(zones).reduce(function (n, k) {
      return n + ((zones[k] && zones[k].att) || 0);
    }, 0);
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

    // 4-bento — verdict accuracies per range + real 30-day volume
    host.appendChild(window.V10UI.bento([
      { variant: 'orange',  icon: 'ph-target',     value: bucketPct(zones, ['pnt']), label: 'PAINT' },
      { variant: null,      icon: 'ph-target',     value: bucketPct(zones, ['ml', 'mr', 'topmid']), label: 'MID' },
      { variant: 'ink',     icon: 'ph-target',     value: bucketPct(zones, ['lc', 'lw', 'top', 'rw', 'rc']), label: '3PT' },
      { variant: 'sage',    icon: 'ph-basketball', value: String(totalAttempts(zones)), label: 'SHOTS · 30D' }
    ]));

    // First-run: nothing tracked yet — say so instead of an empty court.
    if (!totalAttempts(zones)) {
      host.appendChild(h('div', {
        class: 'v10-row',
        style: { boxShadow: '2px 2px 0 var(--ink)' }
      }, [
        h('div', { class: 'v10-row__num' }, [icon('ph-crosshair-simple')]),
        h('div', { class: 'v10-row__main' }, [
          h('div', { class: 'v10-row__title', text: 'YOUR SHOT MAP IS EMPTY' }),
          h('div', { class: 'v10-row__sub', text: 'Track a session or upload a video — every shot lands on this court.' })
        ])
      ]));
    }

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
          text: hasVerdicts(t.z) ? (t.z.made + '/' + t.z.vatt) : String(t.z.att)
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
          h('div', { class: 'v10-row__sub', text: hasVerdicts(t.z)
            ? t.z.made + ' of ' + t.z.vatt + ' scored shots'
            : t.z.att + ' shots counted' })
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

  // SESSIONS — real history: merged remote + local, counter-aware.
  function sessionDateLabel(iso) {
    try {
      var d = new Date(iso);
      var today = new Date().toDateString();
      var yest = new Date(Date.now() - 86400000).toDateString();
      if (d.toDateString() === today) return 'Today';
      if (d.toDateString() === yest) return 'Yesterday';
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function renderSessions(host, ctx) {
    host.appendChild(window.V10UI.ribbon({
      icon: 'ph-flag',
      title: 'SESSION HISTORY',
      meta: 'RECENT'
    }));

    var listWrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    host.appendChild(listWrap);

    ctx.data.getSessions(12).then(function (rows) {
      if (!rows || !rows.length) {
        listWrap.appendChild(h('div', {
          class: 'v10-row',
          style: { boxShadow: '2px 2px 0 var(--ink)' }
        }, [
          h('div', { class: 'v10-row__num' }, [icon('ph-flag')]),
          h('div', { class: 'v10-row__main' }, [
            h('div', { class: 'v10-row__title', text: 'NO SESSIONS YET' }),
            h('div', { class: 'v10-row__sub', text: 'Your first session shows up here the moment you finish it.' })
          ])
        ]));
        return;
      }
      rows.forEach(function (s, i) {
        var counter = s.session_type === 'live_counter' || s.total_made == null;
        var att = s.total_attempts || 0;
        var title = counter ? 'LIVE COUNTER' : 'VIDEO ANALYSIS';
        var sub = sessionDateLabel(s.session_date || s.created_at) + ' · ' + att + ' shots' +
                  (counter ? '' : ' · ' + (s.total_made || 0) + ' made');
        var right = counter ? String(att)
          : (s.accuracy != null ? Math.round(s.accuracy) + '%'
             : (att ? Math.round((s.total_made || 0) * 100 / att) + '%' : '—'));
        listWrap.appendChild(h('div', {
          class: 'v10-row',
          style: { boxShadow: '2px 2px 0 var(--ink)' }
        }, [
          h('div', { class: 'v10-row__num', text: String(i + 1).padStart(2, '0') }),
          h('div', { class: 'v10-row__main' }, [
            h('div', { class: 'v10-row__title', text: title }),
            h('div', { class: 'v10-row__sub', text: sub })
          ]),
          h('div', { class: 'v10-row__right', text: right })
        ]));
      });
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
