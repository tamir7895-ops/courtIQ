/* app-v10/screens/post-session.js
   POST-SESSION RECAP — fullscreen summary after a session ends.
   Hero shot map (parquet wood) with 9 polygon zones, color-coded by accuracy.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  // Full half-court polygons, viewBox 500x470.
  var ZONE_PATHS = {
    lc:     'M 0 0 L 30 0 L 30 142 L 0 142 Z',
    rc:     'M 470 0 L 500 0 L 500 142 L 470 142 Z',
    ml:     'M 30 0 L 170 0 L 170 222 A 237.5 237.5 0 0 1 30 142 L 30 0 Z',
    mr:     'M 330 0 L 470 0 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 0 Z',
    topmid: 'M 170 190 L 330 190 L 330 222 A 237.5 237.5 0 0 0 170 222 L 170 190 Z',
    lw:     'M 0 142 L 30 142 A 237.5 237.5 0 0 0 170 222 L 170 470 L 0 470 L 0 142 Z',
    rw:     'M 500 142 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 470 L 500 470 L 500 142 Z',
    top:    'M 170 222 A 237.5 237.5 0 0 0 330 222 L 330 470 L 170 470 L 170 222 Z',
    pnt:    'M 170 0 L 330 0 L 330 190 L 170 190 Z'
  };

  // Centroid hints for in-zone labels.
  var ZONE_CENTER = {
    lc:     { x: 15,  y: 70  },
    rc:     { x: 485, y: 70  },
    ml:     { x: 90,  y: 100 },
    mr:     { x: 410, y: 100 },
    topmid: { x: 250, y: 210 },
    lw:     { x: 85,  y: 355 },
    rw:     { x: 415, y: 355 },
    top:    { x: 250, y: 360 },
    pnt:    { x: 250, y: 95  }
  };

  var THREE_PT = { lc: true, rc: true, lw: true, rw: true, top: true };

  function acc(z) { return (z && z.att) ? z.made / z.att : 0; }

  /* Counter sessions (live camera, M3) have no verdicts — zones are
     shaded by VOLUME instead of accuracy. */
  function zoneFill(key, z, counter) {
    var isThree = !!THREE_PT[key];
    if (counter) {
      if (z && z.att > 0) {
        var heat = Math.min(1, z.att / 6);
        return 'rgba(224, 168, 46, ' + (0.28 + heat * 0.5).toFixed(2) + ')';
      }
      return 'rgba(251, 245, 232, 0.10)';
    }
    var a = acc(z);
    if (z && z.att > 0) {
      if (a >= 0.55) {
        return isThree ? 'rgba(255, 79, 31, 0.92)' : 'rgba(255, 79, 31, 0.62)';
      }
      if (a <= 0.40) {
        return isThree ? 'rgba(224, 168, 46, 0.92)' : 'rgba(224, 168, 46, 0.62)';
      }
      return isThree ? 'rgba(251, 245, 232, 0.55)' : 'rgba(251, 245, 232, 0.30)';
    }
    return 'rgba(251, 245, 232, 0.10)';
  }

  function zoneTextColor(z) {
    var a = acc(z);
    if (z && z.att > 0 && a >= 0.55) return '#FBF5E8';
    return '#0A2850';
  }

  /* Aggregate current-session shots into zone counts. Reads
     window.__v10SessionShots which camera-hud populates while the
     tracker is running. Each shot is { made, v10Zone, feetXNorm, ts }. */
  function aggregateSessionZones(shots) {
    var z = {};
    Object.keys(ZONE_CENTER).forEach(function (k) { z[k] = { made: 0, att: 0 }; });
    (shots || []).forEach(function (s) {
      var key = s && s.v10Zone;
      if (!z[key]) return;
      z[key].att += 1;
      if (s.made) z[key].made += 1;
    });
    return z;
  }

  function buildShotMap(zones, counter) {
    var children = [];

    Object.keys(ZONE_PATHS).forEach(function (key) {
      var z = zones[key];
      children.push(svg('path', {
        d: ZONE_PATHS[key],
        fill: zoneFill(key, z, counter),
        stroke: '#F0E6D2',
        'stroke-width': 1.4
      }));
    });

    // 3PT arc
    children.push(svg('path', {
      d: 'M 30 0 L 30 142 A 237.5 237.5 0 0 0 470 142 L 470 0',
      fill: 'none',
      stroke: '#F0E6D2',
      'stroke-width': 3.2
    }));

    // Paint rect
    children.push(svg('rect', {
      x: 170, y: 0, width: 160, height: 190,
      fill: 'none', stroke: '#F0E6D2', 'stroke-width': 2
    }));

    // Free-throw circle
    children.push(svg('circle', {
      cx: 250, cy: 190, r: 60,
      fill: 'none', stroke: '#F0E6D2', 'stroke-width': 2
    }));

    // Sidelines
    children.push(svg('line', { x1: 0, y1: 0, x2: 0, y2: 470, stroke: '#F0E6D2', 'stroke-width': 2 }));
    children.push(svg('line', { x1: 500, y1: 0, x2: 500, y2: 470, stroke: '#F0E6D2', 'stroke-width': 2 }));

    // Backboard
    children.push(svg('line', {
      x1: 215, y1: 8, x2: 285, y2: 8,
      stroke: '#F0E6D2', 'stroke-width': 3
    }));

    // Rim
    children.push(svg('circle', {
      cx: 250, cy: 20, r: 9,
      fill: '#FF4F1F', stroke: '#0A2850', 'stroke-width': 2
    }));

    // Per-zone label: verdict mode = X/Y · NN%, counter mode = attempt count
    Object.keys(ZONE_CENTER).forEach(function (key) {
      var z = zones[key];
      if (!z || !z.att) return;
      var c = ZONE_CENTER[key];
      if (counter) {
        children.push(svg('text', {
          x: c.x, y: c.y + 4,
          'text-anchor': 'middle',
          'font-family': 'Barlow Condensed, Impact, sans-serif',
          'font-weight': 900, 'font-size': 24, fill: '#0A2850'
        }, [String(z.att)]));
        return;
      }
      var color = zoneTextColor(z);
      var pct = Math.round((z.made / z.att) * 100);
      children.push(svg('text', {
        x: c.x, y: c.y - 4,
        'text-anchor': 'middle',
        'font-family': 'Barlow Condensed, Impact, sans-serif',
        'font-weight': 900, 'font-size': 22, fill: color
      }, [z.made + '/' + z.att]));
      children.push(svg('text', {
        x: c.x, y: c.y + 16,
        'text-anchor': 'middle',
        'font-family': 'JetBrains Mono, ui-monospace, monospace',
        'font-weight': 700, 'font-size': 11, fill: color, opacity: '0.85'
      }, [pct + '%']));
    });

    // Group for animated shot-dot reveal (populated after mount)
    children.push(svg('g', { id: 'ps-shot-dots' }));

    return svg('svg', {
      id: 'ps-shot-map-svg',
      viewBox: '0 0 500 470',
      width: '100%',
      style: 'display:block;max-width:100%;height:auto;max-height:240px'
    }, children);
  }

  /* After the SVG mounts, sprinkle the current-session shot dots in
     order with a stagger so the user sees the session "replay" onto
     the court. Green = made, orange = missed. Per-shot dot is offset
     laterally by feetXNorm so two shots from the same zone don't stack
     into one bigger dot. */
  function animateShotDots(shots) {
    var g = document.getElementById('ps-shot-dots');
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    if (!shots || !shots.length) return;

    var STAGGER_MS = 120;
    shots.forEach(function (s, i) {
      setTimeout(function () {
        var center = ZONE_CENTER[s.v10Zone] || ZONE_CENTER.top;
        var cx = center.x, cy = center.y + 22;   // below the zone label
        if (typeof s.feetXNorm === 'number') {
          var lateral = (s.feetXNorm - 0.5) * 80;
          cx = Math.max(20, Math.min(480, center.x + lateral));
        }
        var fill = (s.made === null || s.made === undefined)
          ? '#E0A82E'
          : (s.made ? '#3D7A53' : '#FF4F1F');
        // Ripple ring
        var ring = svg('circle', {
          cx: cx, cy: cy, r: 8, fill: 'none',
          stroke: fill, 'stroke-width': 2, opacity: '0.9'
        });
        ring.style.transformOrigin = cx + 'px ' + cy + 'px';
        ring.style.animation = 'v10MiniRipple 700ms ease-out 1';
        // Solid dot
        var dot = svg('circle', {
          cx: cx, cy: cy, r: 9,
          fill: fill, stroke: '#FBF5E8', 'stroke-width': 1.5
        });
        dot.style.opacity = '0';
        dot.style.transition = 'opacity 200ms ease-out';
        g.appendChild(ring);
        g.appendChild(dot);
        requestAnimationFrame(function () { dot.style.opacity = '1'; });
        setTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 800);
      }, i * STAGGER_MS);
    });
  }

  // Compact top row: BACK chip + title + FINAL chip. Sits below headerPill.
  function recapBar(ctx) {
    var dt = new Date();
    var dateStr = dt.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric'
    }).toUpperCase();

    var back = h('button', {
      class: 'v10-chip',
      style: { flex: '0 0 auto', minWidth: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' },
      onclick: function () { ctx.go('track'); }
    }, [icon('ph-arrow-left'), h('span', { text: 'BACK' })]);

    var title = h('div', { class: 'v10-chip', style: { flex: 1, background: 'var(--ink)', color: 'var(--cream)' }, text: 'SESSION RECAP · ' + dateStr });

    var final = h('div', { class: 'v10-chip', style: { flex: '0 0 auto', minWidth: '64px', background: 'var(--orange)', color: 'var(--cream)' }, text: 'FINAL' });

    return h('div', { class: 'v10-chips' }, [back, title, final]);
  }

  // One mono line under the recap bar after an upload analysis: engine +
  // wall-clock — the on-device benchmark readout (no Web Inspector needed).
  function analysisLine() {
    var a = window.__v10AnalysisInfo;
    if (!a || !a.ms) return null;
    var secs = Math.round(a.ms / 1000);
    var fps = a.frames && a.ms ? (a.frames / (a.ms / 1000)).toFixed(1) : '?';
    return h('div', {
      style: { fontFamily: 'var(--font-mono)', fontSize: '10px', opacity: '0.55',
               textAlign: 'center', letterSpacing: '0.06em', margin: '2px 0 0' },
      text: 'ANALYZED ' + Math.round(a.videoSec || 0) + 'S CLIP IN ' + secs +
            'S · ' + fps + ' FPS · ' + String(a.ep || '?').toUpperCase()
    });
  }

  function zoneDelta(z) {
    var a = acc(z);
    return Math.round((a - 0.5) * 100);
  }

  function zoneTile(key, z, counter) {
    if (counter) {
      return h('div', {
        class: 'v10-tile v10-tile--' + (z.att > 0 ? 'mustard' : 'sage'),
        style: { flex: '0 0 auto', minWidth: '108px' }
      }, [
        h('div', { class: 'v10-tile__top' }, [
          h('div', { class: 'v10-tile__title', text: (z.label || key).toUpperCase() }),
          h('i', { class: 'ph-bold ph-basketball v10-tile__icon v10-tile__icon--mustard' })
        ]),
        h('div', { class: 'v10-tile__num', text: String(z.att || 0) }),
        h('div', { class: 'v10-tile__meta', text: 'SHOTS' })
      ]);
    }
    var d = zoneDelta(z);
    var up = d >= 0;
    var variant = z && z.att > 0
      ? (acc(z) >= 0.55 ? 'orange' : (acc(z) <= 0.40 ? 'mustard' : 'sage'))
      : 'sage';
    return h('div', {
      class: 'v10-tile v10-tile--' + variant,
      style: { flex: '0 0 auto', minWidth: '108px' }
    }, [
      h('div', { class: 'v10-tile__top' }, [
        h('div', { class: 'v10-tile__title', text: (z.label || key).toUpperCase() }),
        h('i', { class: 'ph-bold ' + (up ? 'ph-trend-up' : 'ph-trend-down') + ' v10-tile__icon v10-tile__icon--' + variant })
      ]),
      h('div', { class: 'v10-tile__num', text: z.att > 0 ? (z.made + '/' + z.att) : '0/0' }),
      h('div', { class: 'v10-tile__meta', text: (up ? '+' : '') + d + '% vs base' })
    ]);
  }

  function zoneStrip(zones, counter) {
    var order = ['pnt', 'ml', 'mr', 'lw', 'top', 'rw', 'lc'];
    var tiles = order.map(function (k) {
      var z = zones[k] || { made: 0, att: 0, label: k };
      return zoneTile(k, z, counter);
    });
    return h('div', {
      style: {
        display: 'flex', gap: '8px',
        overflowX: 'auto', overflowY: 'hidden',
        paddingBottom: '6px',
        marginBottom: 'var(--s-3)',
        WebkitOverflowScrolling: 'touch'
      }
    }, tiles);
  }

  function drillRow(ctx, d, idx) {
    return h('div', {
      class: 'v10-row',
      style: { boxShadow: '2px 2px 0 var(--ink)', cursor: 'pointer' },
      onclick: function () { ctx.go('workout-player'); }
    }, [
      h('div', { class: 'v10-row__num', text: String(idx + 1).padStart(2, '0') }),
      h('div', { class: 'v10-row__main' }, [
        h('div', { class: 'v10-row__title', text: (d.name || 'DRILL').toUpperCase() }),
        h('div', { class: 'v10-row__sub', text: (d.reps || 30) + ' reps · ' + (d.mins || 6) + ' min' })
      ]),
      h('div', { class: 'v10-row__right' }, [icon('ph-caret-right')])
    ]);
  }

  function render(args) {
    var host = args.host;
    var ctx  = args.ctx;
    var sessionData = args.sessionData || null;

    // Make the screen a flex column so we can push CTAs to the bottom of the viewport.
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.minHeight = '100%';

    // Current-session shot log lives on window — captured by camera-hud's
    // v10:shot listener. We compute EVERYTHING from this list (zones, bento,
    // 3PT count, streak) so the recap shows only what happened in this
    // session — not the historical 7-day zone aggregate.
    var sessionShots = (window.__v10SessionShots || []).slice();
    var zones = aggregateSessionZones(sessionShots);
    // Live counter sessions (M3) have no verdicts — different recap.
    var counter = window.__v10SessionMode === 'counter';

    Promise.all([
      ctx.data.getProfile(),
      ctx.data.getDrills()
    ]).then(function (results) {
      var profile = results[0];
      var drills  = results[1];

      host.appendChild(ctx.ui.headerPill({ profile: profile }));
      host.appendChild(recapBar(ctx));
      var aLine = analysisLine();
      if (aLine) host.appendChild(aLine);

      // Hero shot map (capped at ~240px tall via inline style on the svg)
      var eyebrow = h('div', { class: 'v10-court__eyebrow' }, [
        icon('ph-crosshair-simple'),
        h('span', { text: 'SHOT MAP' })
      ]);
      host.appendChild(h('section', { class: 'v10-court' }, [
        eyebrow,
        buildShotMap(zones, counter)
      ]));

      // Reveal shot dots one-by-one after the SVG mounts.
      requestAnimationFrame(function () { animateShotDots(sessionShots); });

      // 3-cell bento — derived from THIS session only
      var made = sessionShots.filter(function (s) { return s.made; }).length;
      var att  = sessionShots.length;
      var pct  = att ? Math.round(made * 100 / att) : 0;
      // Celebration: palette-paper confetti, scaled to the performance
      if (!counter && made > 0 && ctx.ui.confetti) {
        setTimeout(function () {
          ctx.ui.confetti({ count: Math.min(32, 10 + made * 2) });
        }, 420);
      }
      // 3PT = any zone marked in THREE_PT (lc/rc/lw/rw/top)
      var threeShots = sessionShots.filter(function (s) { return THREE_PT[s.v10Zone]; });
      var threeMade  = threeShots.filter(function (s) { return s.made; }).length;
      var threeAtt   = threeShots.length;
      // Best streak in this session
      var streak = 0, cur = 0;
      sessionShots.forEach(function (s) {
        if (s.made) { cur += 1; if (cur > streak) streak = cur; }
        else { cur = 0; }
      });
      // Provide for downstream code paths that still reference these
      var sessionData = { made: made, attempted: att };
      var today = { made: made, attempted: att };
      var latest = null;

      if (counter) {
        // Counter recap: volume stats only — no made/miss claims.
        var zonesUsed = Object.keys(zones).filter(function (k) { return zones[k].att > 0; }).length;
        host.appendChild(ctx.ui.bento([
          { variant: 'orange',  icon: 'ph-basketball', value: String(att), label: 'SHOTS' },
          { variant: 'sage',    icon: 'ph-target',     value: String(threeAtt), label: 'FROM 3PT RANGE' },
          { variant: 'mustard', icon: 'ph-map-pin',    value: String(zonesUsed), label: 'ZONES USED' }
        ]));
        // Explain where verdicts live — one tap to the upload flow.
        host.appendChild(h('div', {
          class: 'v10-row',
          style: { boxShadow: '2px 2px 0 var(--ink)', cursor: 'pointer', marginBottom: 'var(--s-3)' },
          onclick: function () { ctx.go('track'); }
        }, [
          h('div', { class: 'v10-row__num' }, [icon('ph-film-slate')]),
          h('div', { class: 'v10-row__main' }, [
            h('div', { class: 'v10-row__title', text: 'WANT MADE/MISS?' }),
            h('div', { class: 'v10-row__sub', text: 'Record your session and upload the video — the analyzer scores every shot.' })
          ]),
          h('div', { class: 'v10-row__right' }, [icon('ph-caret-right')])
        ]));
      } else {
        host.appendChild(ctx.ui.bento([
          { variant: 'orange',  icon: 'ph-check',  value: made + ' / ' + att, label: pct + '% MADE' },
          { variant: 'sage',    icon: 'ph-target', value: threeAtt ? (threeMade + '/' + threeAtt) : '—', label: '3PT' },
          {
            variant: 'mustard',
            icon: 'ph-fire',
            iconExtra: streak >= 3 ? 'v10-flicker' : undefined,
            value: String(streak),
            label: 'BEST RUN'
          }
        ]));
      }

      // BY ZONE ribbon + tile strip
      host.appendChild(ctx.ui.ribbon({
        icon: 'ph-map-trifold',
        title: 'BY ZONE',
        meta: 'SCROLL →'
      }));
      host.appendChild(zoneStrip(zones || {}, counter));

      // DRILLS ribbon — clickable rows go to workout-player; "View all" chip goes to drill-library
      host.appendChild(ctx.ui.ribbon({
        icon: 'ph-barbell',
        title: 'SUGGESTED DRILLS',
        meta: 'VIEW ALL →'
      }));
      var drillsList = h('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '6px' }
      });
      (drills || []).slice(0, 2).forEach(function (d, i) {
        drillsList.appendChild(drillRow(ctx, d, i));
      });
      // "View all" tile → drill-library
      drillsList.appendChild(h('div', {
        class: 'v10-row',
        style: { boxShadow: '2px 2px 0 var(--ink)', cursor: 'pointer', justifyContent: 'center', background: 'var(--ink)', color: 'var(--cream)' },
        onclick: function () { ctx.go('drill-library'); }
      }, [
        h('div', {
          class: 'v10-row__title',
          style: { color: 'var(--cream)', textAlign: 'center', flex: 1 },
          text: 'VIEW ALL DRILLS →'
        })
      ]));
      host.appendChild(drillsList);

      // Flex spacer — pushes CTAs to the bottom of the viewport when content is short.
      host.appendChild(h('div', { style: { flex: '1 1 auto', minHeight: '12px' } }));

      // CTAs
      host.appendChild(h('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }
      }, [
        ctx.ui.cta({
          variant: 'orange',
          icon: 'ph-play-circle',
          label: 'LOG ANOTHER SESSION',
          onClick: function () { ctx.go('camera-hud'); }
        }),
        ctx.ui.cta({
          variant: 'secondary',
          icon: 'ph-house',
          label: 'BACK TO HOME',
          onClick: function () { ctx.go('home'); }
        })
      ]));
    });
  }

  window.app.register('post-session', render);
})();
