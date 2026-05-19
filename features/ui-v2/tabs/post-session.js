/* CourtIQ UI v2 — Post-Session screen (Wave 1 redesign · full implementation)
 *
 * Full port of design-export-v2 post-session-recap.jsx + post-session-shotchart.jsx.
 * Sections: stamp header, hero FG%, verdict, shot chart with zone fills,
 * scoreboard strip, zone strip (tappable), drills list, compare sparkline,
 * XP earned card, action buttons, footer.
 *
 * Fullscreen overlay — hides bottom nav on render, restores on cleanup.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.SHELL_ACTIVE) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[post-session-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  var hostRef = null;
  var sessionRef = null;
  var highlightRef = null; // currently highlighted zone id or null

  /* ── FIXTURE DATA (from design post-session-data.jsx "hot" session) ──── */
  var FIXTURE = {
    label: 'Heating Up',
    fg: 67,
    fgDelta: +9,
    made: 22,
    att: 33,
    durationMin: 24,
    durationSec: 18,
    streakBest: 6,
    pps: 1.42,
    ppsDelta: +0.18,
    verdict: 'Right wing was unconscious.',
    verdictTone: 'make',
    shots: [
      { x: 183, y:  72, made: true,  zone: 'rw' },
      { x: 182, y:  44, made: false, zone: 'rw' },
      { x: 171, y:  64, made: true,  zone: 'rw' },
      { x: 146, y:  69, made: true,  zone: 'rw' },
      { x: 185, y:  66, made: true,  zone: 'rw' },
      { x: 186, y:  62, made: false, zone: 'rw' },
      { x: 180, y:  63, made: true,  zone: 'rw' },
      { x: 173, y:  37, made: true,  zone: 'rw' },
      { x: 168, y:  55, made: true,  zone: 'rw' },
      { x:  73, y: 117, made: true,  zone: 'top' },
      { x:  92, y:  91, made: false, zone: 'top' },
      { x: 113, y:  93, made: true,  zone: 'top' },
      { x: 109, y:  87, made: true,  zone: 'top' },
      { x:  13, y:  31, made: false, zone: 'lw' },
      { x:  22, y:  66, made: true,  zone: 'lw' },
      { x:  29, y:  65, made: false, zone: 'lw' },
      { x:  16, y:  43, made: true,  zone: 'lw' },
      { x:   3, y:  12, made: true,  zone: 'lc' },
      { x:   7, y:   8, made: true,  zone: 'lc' },
      { x: 183, y:  10, made: false, zone: 'rc' },
      { x: 184, y:   5, made: true,  zone: 'rc' },
      { x:  55, y:  18, made: false, zone: 'ml' },
      { x:  45, y:  30, made: true,  zone: 'ml' },
      { x:  44, y:   2, made: false, zone: 'ml' },
      { x: 137, y:  12, made: true,  zone: 'mr' },
      { x: 156, y:  15, made: false, zone: 'mr' },
      { x:  83, y:  11, made: true,  zone: 'pnt' },
      { x:  81, y:  20, made: true,  zone: 'pnt' },
      { x:  89, y:  16, made: true,  zone: 'pnt' },
      { x:  90, y:  36, made: true,  zone: 'pnt' },
      { x:  81, y:  32, made: true,  zone: 'pnt' },
      { x:  87, y:   8, made: false, zone: 'pnt' },
      { x:  78, y:  35, made: false, zone: 'pnt' }
    ],
    drills: [
      { id: 'd1', name: 'Corner 3 lock-in',     reps: 10, made: 7, fg: 70, hot: true  },
      { id: 'd2', name: 'Catch & shoot · wing', reps: 8,  made: 6, fg: 75, hot: true  },
      { id: 'd3', name: 'Pull-up mid-range',    reps: 8,  made: 3, fg: 38, hot: false },
      { id: 'd4', name: 'Free throw rhythm',    reps: 7,  made: 6, fg: 86, hot: true  }
    ],
    zoneBreakdown: [
      { id: 'lc',  name: 'L Corner 3', made: 2, att: 2, delta: +20 },
      { id: 'lw',  name: 'L Wing 3',   made: 2, att: 4, delta: -8  },
      { id: 'top', name: 'Top 3',      made: 3, att: 4, delta: +5  },
      { id: 'rw',  name: 'R Wing 3',   made: 7, att: 9, delta: +28 },
      { id: 'rc',  name: 'R Corner 3', made: 1, att: 2, delta: +0  },
      { id: 'mid', name: 'Mid-range',  made: 2, att: 5, delta: -12 },
      { id: 'pnt', name: 'Paint',      made: 5, att: 7, delta: +3  }
    ]
  };

  /* ── SHOT CHART GEOMETRY (500x470 court, remap from 190x130 input) ───── */
  var REMAP_X = 500 / 190;
  var REMAP_Y = 470 / 130;

  var REAL_ZONES = [
    { id: 'pnt',    path: 'M 170 0 L 330 0 L 330 190 L 170 190 Z' },
    { id: 'lc',     path: 'M 0 0 L 30 0 L 30 142 L 0 142 Z' },
    { id: 'rc',     path: 'M 470 0 L 500 0 L 500 142 L 470 142 Z' },
    { id: 'ml',     path: 'M 30 0 L 170 0 L 170 222 A 237.5 237.5 0 0 1 30 142 L 30 0 Z' },
    { id: 'mr',     path: 'M 330 0 L 470 0 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 0 Z' },
    { id: 'topmid', path: 'M 170 190 L 330 190 L 330 222 A 237.5 237.5 0 0 0 170 222 L 170 190 Z' },
    { id: 'lw',     path: 'M 0 142 L 30 142 A 237.5 237.5 0 0 0 170 222 L 170 470 L 0 470 L 0 142 Z' },
    { id: 'rw',     path: 'M 500 142 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 470 L 500 470 L 500 142 Z' },
    { id: 'top',    path: 'M 170 222 A 237.5 237.5 0 0 0 330 222 L 330 470 L 170 470 L 170 222 Z' }
  ];
  var ZONE_RENDER_ORDER = ['lc', 'rc', 'lw', 'rw', 'top', 'ml', 'mr', 'topmid', 'pnt'];
  var ZONE_ALIAS = { ml: 'mid', mr: 'mid', topmid: 'mid' };

  function isHighlighted(id) {
    if (!highlightRef) return false;
    if (id === highlightRef) return true;
    if (ZONE_ALIAS[id] && ZONE_ALIAS[id] === highlightRef) return true;
    return false;
  }

  /* ── XP CALCULATION ───────────────────────────────── */
  function computeXP(s) {
    var madeXP = s.made * 10;
    var attXP  = s.att * 2;
    var streakXP = s.streakBest >= 5 ? 60 : s.streakBest >= 3 ? 30 : 0;
    var total = madeXP + attXP + streakXP;
    return { madeXP: madeXP, attXP: attXP, streakXP: streakXP, total: total };
  }

  /* ── HELPERS ──────────────────────────────────────── */
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function zoneFillColor(acc, dim) {
    if (acc == null) return 'rgba(255,255,255,' + (0.04 * dim) + ')';
    if (acc >= 0.55) return 'rgba(86,211,100,' + ((0.18 + 0.40 * Math.min(1, (acc - 0.5) * 2)) * dim) + ')';
    if (acc <= 0.40) return 'rgba(232,64,64,' + ((0.14 + 0.36 * Math.min(1, (0.5 - acc) * 2)) * dim) + ')';
    return 'rgba(245,166,35,' + (0.14 * dim) + ')';
  }

  /* ── 1. STAMP HEADER ──────────────────────────────── */
  function buildStamp(s) {
    var dur = s.durationMin + ':' + pad2(s.durationSec);
    var today = new Date();
    var dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return h('div', { class: 'ps-stamp' }, [
      h('div', { class: 'ps-stamp__l' }, [
        h('button', { class: 'ps-stamp__close', 'aria-label': 'Close',
          onclick: function () {
            if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('track');
          }
        }, [
          (function () {
            var ic = svg('svg', { viewBox: '0 0 24 24', width: '18', height: '18' });
            ic.appendChild(svg('path', { d: 'M4 12h15', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', fill: 'none' }));
            ic.appendChild(svg('path', { d: 'M11 5.5L4 12l7 6.5', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }));
            return ic;
          })()
        ]),
        h('div', {}, [
          h('div', { class: 'ps-stamp__eyebrow', text: 'SESSION RECAP' }),
          h('div', { class: 'ps-stamp__meta', text: dateStr + ' · ' + dur + ' min' })
        ])
      ]),
      h('div', { class: 'ps-stamp__pill', text: 'FINAL' })
    ]);
  }

  /* ── 2. HERO FG% ──────────────────────────────────── */
  function buildHero(s) {
    var positive = s.fgDelta >= 0;
    return h('div', { class: 'ps-hero' }, [
      h('div', { class: 'ps-hero__lbl', innerHTML: 'FIELD&nbsp;GOAL' }),
      h('div', { class: 'ps-hero__num' }, [
        h('span', { class: 'ps-hero__int', text: String(s.fg) }),
        h('span', { class: 'ps-hero__pct', text: '%' })
      ]),
      h('div', { class: 'ps-hero__delta ' + (positive ? 'is-up' : 'is-down') }, [
        h('span', { class: 'ps-hero__arrow', text: positive ? '▲' : '▼' }),
        (positive ? '+' : '') + s.fgDelta + ' pts vs last session'
      ])
    ]);
  }

  /* ── 3. VERDICT ───────────────────────────────────── */
  function buildVerdict(s) {
    return h('div', { class: 'ps-verdict ps-verdict--' + s.verdictTone }, [
      h('span', { class: 'ps-verdict__quote', text: '“' }),
      h('em', { text: s.verdict })
    ]);
  }

  /* ── 4. SHOT CHART with zone fills ────────────────── */
  function buildShotChart(s) {
    var zones = s.zoneBreakdown;
    var shots = s.shots;
    var madeCount = 0;
    shots.forEach(function (sh) { if (sh.made) madeCount++; });
    var missCount = shots.length - madeCount;

    // Compute FG per zone for fill colors
    var accByZone = {};
    zones.forEach(function (z) {
      accByZone[z.id] = z.att === 0 ? null : z.made / z.att;
    });
    // Alias mid -> ml, mr, topmid
    if (accByZone.mid != null) {
      accByZone.ml = accByZone.mid;
      accByZone.mr = accByZone.mid;
      accByZone.topmid = accByZone.mid;
    }

    // Build the SVG
    var courtSvg = svg('svg', {
      viewBox: '0 0 500 470',
      preserveAspectRatio: 'xMidYMid meet',
      class: 'ps-court',
      'aria-hidden': 'true'
    });

    // Defs for glow gradients
    var defs = svg('defs', {});
    var makeGlow = svg('radialGradient', { id: 'ps-make-glow', cx: '50%', cy: '50%', r: '50%' });
    makeGlow.appendChild(svg('stop', { offset: '0%', 'stop-color': '#56d364', 'stop-opacity': '0.7' }));
    makeGlow.appendChild(svg('stop', { offset: '100%', 'stop-color': '#56d364', 'stop-opacity': '0' }));
    defs.appendChild(makeGlow);
    var missGlow = svg('radialGradient', { id: 'ps-miss-glow', cx: '50%', cy: '50%', r: '50%' });
    missGlow.appendChild(svg('stop', { offset: '0%', 'stop-color': '#e84040', 'stop-opacity': '0.4' }));
    missGlow.appendChild(svg('stop', { offset: '100%', 'stop-color': '#e84040', 'stop-opacity': '0' }));
    defs.appendChild(missGlow);

    // Clip paths for court elements
    var clip3 = svg('clipPath', { id: 'ps-c3' });
    clip3.appendChild(svg('rect', { x: '0', y: '142', width: '500', height: '328' }));
    defs.appendChild(clip3);
    var clipFtb = svg('clipPath', { id: 'ps-ftb' });
    clipFtb.appendChild(svg('rect', { x: '0', y: '190', width: '500', height: '280' }));
    defs.appendChild(clipFtb);
    var clipFtt = svg('clipPath', { id: 'ps-ftt' });
    clipFtt.appendChild(svg('rect', { x: '0', y: '0', width: '500', height: '190' }));
    defs.appendChild(clipFtt);
    var clipRa = svg('clipPath', { id: 'ps-ra' });
    clipRa.appendChild(svg('rect', { x: '0', y: '40', width: '500', height: '430' }));
    defs.appendChild(clipRa);

    courtSvg.appendChild(defs);

    // Zone fill paths
    ZONE_RENDER_ORDER.forEach(function (id) {
      var zd = null;
      for (var i = 0; i < REAL_ZONES.length; i++) {
        if (REAL_ZONES[i].id === id) { zd = REAL_ZONES[i]; break; }
      }
      if (!zd) return;
      var acc = accByZone[id] != null ? accByZone[id] : null;
      var dim = highlightRef && !isHighlighted(id) ? 0.30 : 1;
      var active = isHighlighted(id);
      var zPath = svg('path', {
        d: zd.path,
        fill: zoneFillColor(acc, dim),
        stroke: active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.10)',
        'stroke-width': active ? '3' : '1.4',
        class: 'ps-court__zone' + (active ? ' is-active' : ''),
        style: 'cursor:pointer',
        'data-zone': id
      });
      zPath.addEventListener('click', function () {
        var canonical = ZONE_ALIAS[id] || id;
        highlightRef = highlightRef === canonical ? null : canonical;
        paint();
      });
      courtSvg.appendChild(zPath);
    });

    // Court line work (on top of zone fills)
    var lineStroke = 'rgba(245,166,35,0.22)';
    var lineW = '1.4';
    // Floor outline
    courtSvg.appendChild(svg('rect', { x: '1', y: '1', width: '498', height: '468', rx: '3', fill: 'none', stroke: lineStroke, 'stroke-width': lineW }));
    // Paint
    courtSvg.appendChild(svg('rect', { x: '170', y: '0', width: '160', height: '190', fill: 'none', stroke: lineStroke, 'stroke-width': lineW }));
    // FT circle
    courtSvg.appendChild(svg('circle', { cx: '250', cy: '190', r: '60', fill: 'none', stroke: lineStroke, 'stroke-width': lineW, 'clip-path': 'url(#ps-ftb)' }));
    courtSvg.appendChild(svg('circle', { cx: '250', cy: '190', r: '60', fill: 'none', stroke: lineStroke, 'stroke-width': lineW, 'stroke-dasharray': '6 4', 'clip-path': 'url(#ps-ftt)' }));
    // Corner-3 sidelines
    courtSvg.appendChild(svg('line', { x1: '30', y1: '0', x2: '30', y2: '142', stroke: lineStroke, 'stroke-width': lineW }));
    courtSvg.appendChild(svg('line', { x1: '470', y1: '0', x2: '470', y2: '142', stroke: lineStroke, 'stroke-width': lineW }));
    // 3PT arc
    courtSvg.appendChild(svg('circle', { cx: '250', cy: '52.5', r: '237.5', fill: 'none', stroke: lineStroke, 'stroke-width': lineW, 'clip-path': 'url(#ps-c3)' }));
    // Restricted area
    courtSvg.appendChild(svg('circle', { cx: '250', cy: '52.5', r: '40', fill: 'none', stroke: lineStroke, 'stroke-width': lineW, 'clip-path': 'url(#ps-ra)' }));
    // Backboard
    courtSvg.appendChild(svg('line', { x1: '220', y1: '40', x2: '280', y2: '40', stroke: 'rgba(245,166,35,0.35)', 'stroke-width': '2' }));
    // Rim
    courtSvg.appendChild(svg('circle', { cx: '250', cy: '52.5', r: '7.5', fill: 'none', stroke: 'rgba(245,166,35,0.45)', 'stroke-width': '1.6' }));

    // Shot dots
    var shotsGroup = svg('g', { class: 'ps-court__shots is-anim' });
    shots.forEach(function (sh, i) {
      var cx = sh.x * REMAP_X;
      var cy = sh.y * REMAP_Y;
      var dimShot = highlightRef && !isHighlighted(sh.zone) && sh.zone !== highlightRef ? 0.20 : 1;
      var g = svg('g', {
        transform: 'translate(' + cx + ',' + cy + ')',
        style: '--i:' + i + ';opacity:' + dimShot,
        class: 'ps-shot ' + (sh.made ? 'is-make' : 'is-miss')
      });
      g.appendChild(svg('circle', { r: '10', fill: sh.made ? 'url(#ps-make-glow)' : 'url(#ps-miss-glow)' }));
      if (sh.made) {
        g.appendChild(svg('circle', { r: '5', fill: '#56d364', stroke: '#0a0907', 'stroke-width': '1.2' }));
      } else {
        var xMark = svg('g', { stroke: '#e84040', 'stroke-width': '2.4', fill: 'none', 'stroke-linecap': 'round' });
        xMark.appendChild(svg('line', { x1: '-4.5', y1: '-4.5', x2: '4.5', y2: '4.5' }));
        xMark.appendChild(svg('line', { x1: '-4.5', y1: '4.5', x2: '4.5', y2: '-4.5' }));
        g.appendChild(xMark);
      }
      shotsGroup.appendChild(g);
    });
    courtSvg.appendChild(shotsGroup);

    // Card wrapper with head + legend
    return h('div', { class: 'ps-chart' }, [
      h('div', { class: 'ps-chart__head' }, [
        h('div', { class: 'ps-chart__lbl', text: 'SHOT MAP' }),
        h('div', { class: 'ps-chart__legend' }, [
          h('span', { class: 'ps-chart__lk' }, [
            h('span', { class: 'ps-chart__dot ps-chart__dot--make' }),
            h('span', { text: 'MAKE · ' + madeCount })
          ]),
          h('span', { class: 'ps-chart__lk' }, [
            h('span', { class: 'ps-chart__dot ps-chart__dot--miss' }),
            h('span', { text: 'MISS · ' + missCount })
          ])
        ])
      ]),
      courtSvg
    ]);
  }

  /* ── 5. SCOREBOARD STRIP ──────────────────────────── */
  function buildScoreboard(s) {
    var ppsDeltaPositive = s.ppsDelta >= 0;
    return h('div', { class: 'ps-board' }, [
      h('div', { class: 'ps-board__cell' }, [
        h('div', { class: 'ps-board__lbl', text: 'MADE' }),
        h('div', { class: 'ps-board__val' }, [
          h('span', { class: 'ps-board__big', text: pad2(s.made) }),
          h('span', { class: 'ps-board__sep', text: '/' }),
          h('span', { class: 'ps-board__sm', text: String(s.att) })
        ])
      ]),
      h('div', { class: 'ps-board__cell' }, [
        h('div', { class: 'ps-board__lbl', text: 'PTS / SHOT' }),
        h('div', { class: 'ps-board__val' }, [
          h('span', { class: 'ps-board__big', text: s.pps.toFixed(2) })
        ]),
        h('div', { class: 'ps-board__delta ' + (ppsDeltaPositive ? 'is-up' : 'is-down'),
          text: (ppsDeltaPositive ? '▲' : '▼') + ' ' + Math.abs(s.ppsDelta).toFixed(2)
        })
      ]),
      h('div', { class: 'ps-board__cell' }, [
        h('div', { class: 'ps-board__lbl', text: 'BEST RUN' }),
        h('div', { class: 'ps-board__val' }, [
          h('span', { class: 'ps-board__big', text: String(s.streakBest) }),
          h('span', { class: 'ps-board__sm', innerHTML: 'in&nbsp;a&nbsp;row' })
        ])
      ])
    ]);
  }

  /* ── 6. ZONE STRIP ────────────────────────────────── */
  function buildZoneStrip(s) {
    var zones = s.zoneBreakdown;
    var buttons = zones.map(function (z) {
      var fg = z.att === 0 ? 0 : Math.round((z.made / z.att) * 100);
      var dimmed = highlightRef && highlightRef !== z.id;
      var active = highlightRef === z.id;
      var positive = z.delta >= 0;
      var btn = h('button', {
        type: 'button',
        class: 'ps-zone' + (active ? ' is-active' : '') + (dimmed ? ' is-dim' : '')
      }, [
        h('div', { class: 'ps-zone__name', text: z.name }),
        h('div', { class: 'ps-zone__fg', innerHTML: fg + '<span>%</span>' }),
        h('div', { class: 'ps-zone__att', text: z.made + '/' + z.att }),
        h('div', { class: 'ps-zone__delta ' + (positive ? 'is-up' : 'is-down'),
          text: (positive ? '▲' : '▼') + ' ' + Math.abs(z.delta)
        })
      ]);
      btn.addEventListener('click', function () {
        highlightRef = highlightRef === z.id ? null : z.id;
        paint();
      });
      return btn;
    });

    return h('div', { class: 'ps-zones' }, [
      h('div', { class: 'ps-zones__lbl', text: 'BY ZONE' }),
      h('div', { class: 'ps-zones__row' }, buttons)
    ]);
  }

  /* ── 7. DRILLS LIST ───────────────────────────────── */
  function buildDrills(s) {
    var items = s.drills.map(function (d, i) {
      var nameChildren = [d.name];
      if (d.hot) nameChildren.push(h('span', { class: 'ps-drill__badge', text: 'HOT' }));
      return h('li', { class: 'ps-drill' + (d.hot ? ' is-hot' : '') }, [
        h('div', { class: 'ps-drill__idx', text: pad2(i + 1) }),
        h('div', { class: 'ps-drill__name' }, nameChildren),
        h('div', { class: 'ps-drill__bar' }, [
          h('div', { class: 'ps-drill__fill', style: 'width:' + d.fg + '%;background:' + (d.fg >= 50 ? '#56d364' : '#e84040') })
        ]),
        h('div', { class: 'ps-drill__pct', innerHTML: d.fg + '<span>%</span>' }),
        h('div', { class: 'ps-drill__att', text: d.made + '/' + d.reps })
      ]);
    });
    return h('div', { class: 'ps-drills' }, [
      h('div', { class: 'ps-drills__lbl', text: 'DRILLS' }),
      h('ul', { class: 'ps-drills__list' }, items)
    ]);
  }

  /* ── 8. COMPARE STRIP ─────────────────────────────── */
  function buildCompare(s) {
    var last = s.fg - s.fgDelta;
    var trend = [Math.max(0, last - 4), last, Math.max(0, last - 2), last + 2, s.fg];
    var points = trend.map(function (v, i) {
      return (10 + i * 38) + ',' + (36 - (v / 100) * 32);
    }).join(' ');

    var sparkSvg = svg('svg', { viewBox: '0 0 170 40', class: 'ps-compare__spark', preserveAspectRatio: 'none' });
    sparkSvg.appendChild(svg('polyline', {
      points: points,
      stroke: 'rgba(240,236,228,0.45)',
      'stroke-width': '1.2',
      fill: 'none'
    }));
    trend.forEach(function (v, i) {
      var cx = 10 + i * 38;
      var cy = 36 - (v / 100) * 32;
      var isLast = i === trend.length - 1;
      if (isLast) {
        sparkSvg.appendChild(svg('circle', { cx: String(cx), cy: String(cy), r: '6', fill: 'rgba(255,90,60,0.18)' }));
      }
      sparkSvg.appendChild(svg('circle', {
        cx: String(cx), cy: String(cy),
        r: isLast ? '3.2' : '2.2',
        fill: isLast ? '#ff5a3c' : 'rgba(240,236,228,0.7)'
      }));
    });

    return h('div', { class: 'ps-compare' }, [
      h('div', { class: 'ps-compare__head' }, [
        h('div', { class: 'ps-compare__lbl', text: 'LAST 5 SESSIONS' }),
        h('div', { class: 'ps-compare__cur' }, [
          h('span', { class: 'ps-compare__big', text: String(s.fg) }),
          h('span', { text: '%' })
        ])
      ]),
      sparkSvg
    ]);
  }

  /* ── 9. XP EARNED CARD ────────────────────────────── */
  function buildXPCard(s, xpData) {
    var xpBaseline = 11200;
    var xpCurrent = xpBaseline + xpData.total;
    var xpNext = 15000;
    var pct = Math.min(100, Math.round((xpCurrent / xpNext) * 100));

    return h('div', { class: 'ps-xp' }, [
      h('div', { class: 'ps-xp__head' }, [
        h('div', { class: 'ps-xp__lbl', text: 'XP EARNED' }),
        h('div', { class: 'ps-xp__sub', text: '+346 target · L14' })
      ]),
      h('div', { class: 'ps-xp__rows' }, [
        h('div', { class: 'ps-xp__row' }, [
          h('span', { class: 'ps-xp__row-lbl', text: 'Made shots' }),
          h('span', { class: 'ps-xp__row-meta', text: s.made + ' × 10 XP' }),
          h('span', { class: 'ps-xp__row-val', text: '+' + xpData.madeXP })
        ]),
        h('div', { class: 'ps-xp__row' }, [
          h('span', { class: 'ps-xp__row-lbl', text: 'Attempts' }),
          h('span', { class: 'ps-xp__row-meta', text: s.att + ' × 2 XP' }),
          h('span', { class: 'ps-xp__row-val', text: '+' + xpData.attXP })
        ]),
        h('div', { class: 'ps-xp__row' }, [
          h('span', { class: 'ps-xp__row-lbl', text: 'Streak bonus' }),
          h('span', { class: 'ps-xp__row-meta', text: s.streakBest + ' in a row' }),
          h('span', { class: 'ps-xp__row-val', text: '+' + xpData.streakXP })
        ])
      ]),
      h('div', { class: 'ps-xp__total' }, [
        h('span', { class: 'ps-xp__total-lbl', text: 'Total' }),
        h('span', { class: 'ps-xp__total-val', innerHTML: '+' + xpData.total + ' <em>XP</em>' })
      ]),
      h('div', { class: 'ps-xp__progress' }, [
        h('div', { class: 'ps-xp__progress-lbl' }, [
          h('span', { text: 'Level 14' }),
          h('span', { innerHTML: '<b>' + xpCurrent.toLocaleString() + '</b> / ' + xpNext.toLocaleString() + ' XP' }),
          h('span', { text: 'Level 15' })
        ]),
        h('div', { class: 'ps-xp__bar' }, [
          h('div', { class: 'ps-xp__bar-fill', style: 'width:' + pct + '%' }),
          h('span', { class: 'ps-xp__bar-marker', style: 'left:' + pct + '%' })
        ])
      ])
    ]);
  }

  /* ── 10. ACTION BUTTONS ───────────────────────────── */
  function buildActions(s, xpData) {
    // Save icon SVG — basketball dropping into hoop/net
    function saveIcon() {
      var ic = svg('svg', { viewBox: '0 0 18 18', fill: 'none', 'aria-hidden': 'true', width: '18', height: '18' });
      // Rim (horizontal line)
      ic.appendChild(svg('line', { x1: '4', y1: '10', x2: '14', y2: '10', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }));
      // Net lines hanging from rim
      ic.appendChild(svg('path', { d: 'M5.5 10l1.5 5M12.5 10l-1.5 5M9 10v5.5', stroke: 'currentColor', 'stroke-width': '1.2', 'stroke-linecap': 'round', fill: 'none' }));
      // Net cross-threads
      ic.appendChild(svg('path', { d: 'M6.2 12h5.6M7 14h4', stroke: 'currentColor', 'stroke-width': '0.8', 'stroke-linecap': 'round', fill: 'none', opacity: '0.6' }));
      // Basketball (small circle dropping in, above rim)
      ic.appendChild(svg('circle', { cx: '9', cy: '5.5', r: '3', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'none' }));
      // Ball seam lines
      ic.appendChild(svg('line', { x1: '6', y1: '5.5', x2: '12', y2: '5.5', stroke: 'currentColor', 'stroke-width': '0.9', 'stroke-linecap': 'round' }));
      ic.appendChild(svg('path', { d: 'M9 2.5c-1 1-1 2-0 3s1 2 0 3', stroke: 'currentColor', 'stroke-width': '0.9', fill: 'none', 'stroke-linecap': 'round' }));
      // Down arrow hint (motion)
      ic.appendChild(svg('path', { d: 'M3 4l1 2M15 4l-1 2', stroke: 'currentColor', 'stroke-width': '1', 'stroke-linecap': 'round', fill: 'none', opacity: '0.45' }));
      return ic;
    }
    // Share icon SVG — basketball pass trajectory (ball + arc + arrowhead)
    function shareIcon() {
      var ic = svg('svg', { viewBox: '0 0 18 18', fill: 'none', 'aria-hidden': 'true', width: '16', height: '16' });
      // Ball at origin (bottom-left)
      ic.appendChild(svg('circle', { cx: '3.5', cy: '13', r: '2.4', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'none' }));
      // Ball seam
      ic.appendChild(svg('line', { x1: '1.5', y1: '13', x2: '5.5', y2: '13', stroke: 'currentColor', 'stroke-width': '0.7', 'stroke-linecap': 'round' }));
      // Pass arc trajectory
      ic.appendChild(svg('path', { d: 'M5.5 11.5Q9 1 14 5', stroke: 'currentColor', 'stroke-width': '1.8', fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': '2.5 2' }));
      // Arrowhead at end of arc
      ic.appendChild(svg('path', { d: 'M12 3l2.2 2.2M12 7l2.2-2.2', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }));
      return ic;
    }
    // New session icon — crosshair-style plus (bolder, basketball feel)
    function newIcon() {
      var ic = svg('svg', { viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': 'true', width: '12', height: '12' });
      // Outer circle (basketball outline)
      ic.appendChild(svg('circle', { cx: '7', cy: '7', r: '5.5', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }));
      // Crosshair lines — bold plus with gaps in the center
      ic.appendChild(svg('line', { x1: '7', y1: '1.5', x2: '7', y2: '4.5', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }));
      ic.appendChild(svg('line', { x1: '7', y1: '9.5', x2: '7', y2: '12.5', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }));
      ic.appendChild(svg('line', { x1: '1.5', y1: '7', x2: '4.5', y2: '7', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }));
      ic.appendChild(svg('line', { x1: '9.5', y1: '7', x2: '12.5', y2: '7', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }));
      // Center dot
      ic.appendChild(svg('circle', { cx: '7', cy: '7', r: '1', fill: 'currentColor' }));
      return ic;
    }
    // Back icon — bolder chevron
    function backIcon() {
      var ic = svg('svg', { viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': 'true', width: '12', height: '12' });
      ic.appendChild(svg('path', { d: 'M9 2L3.5 7 9 12', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }));
      return ic;
    }

    return h('div', { class: 'ps-actions' }, [
      h('button', { class: 'ps-act-primary', onclick: function () {
        try {
          if (window.dataService && typeof window.dataService.saveSession === 'function') {
            window.dataService.saveSession(s);
          }
          if (window.gamification && typeof window.gamification.awardXP === 'function') {
            window.gamification.awardXP(xpData.total, 'shooting-session');
          }
        } catch (e) { console.warn('[post-session-v2] save error', e); }
        alert('Session saved · +' + xpData.total + ' XP');
        if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('track');
      }}, [saveIcon(), 'Save Session']),

      h('button', { class: 'ps-act-ghost', onclick: function () {
        try {
          if (navigator.share) {
            navigator.share({ title: 'CourtIQ Shot Chart', text: 'FG ' + s.fg + '% · ' + s.made + '/' + s.att });
          } else {
            alert('Share not available on this device.');
          }
        } catch (e) { console.warn('[post-session-v2] share error', e); }
      }}, [shareIcon(), 'Share Shot Chart']),

      h('div', { class: 'ps-act-row' }, [
        h('button', { class: 'ps-act-text', onclick: function () {
          if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('camera-hud');
        }}, [newIcon(), 'New Session']),
        h('button', { class: 'ps-act-text', onclick: function () {
          if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('track');
        }}, [backIcon(), 'Back to Track'])
      ])
    ]);
  }

  /* ── 11. FOOTER ───────────────────────────────────── */
  function buildFooter() {
    var today = new Date();
    var dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return h('div', { class: 'ps-foot', text: 'AI TRACKING · CourtIQ · ' + dateStr });
  }

  /* ── MAIN PAINT ───────────────────────────────────── */
  function paint() {
    if (!hostRef || !sessionRef) return;
    var s = sessionRef;
    var xpData = computeXP(s);

    DOM.clearChildren(hostRef);
    var screen = h('div', { class: 'ps' }, [
      /* Stamp Header */
      buildStamp(s),

      /* Scrollable content area */
      h('div', { class: 'ps-scroll' }, [
        /* Hero FG% + Verdict */
        h('section', { class: 'ps-sec ps-sec--hero' }, [
          buildHero(s),
          buildVerdict(s)
        ]),

        /* Shot Chart */
        h('section', { class: 'ps-sec' }, [
          buildShotChart(s)
        ]),

        /* Scoreboard Strip */
        h('section', { class: 'ps-sec' }, [
          buildScoreboard(s)
        ]),

        /* Zone Strip */
        h('section', { class: 'ps-sec' }, [
          buildZoneStrip(s)
        ]),

        /* Drills List */
        h('section', { class: 'ps-sec' }, [
          buildDrills(s)
        ]),

        /* Compare Strip */
        h('section', { class: 'ps-sec' }, [
          buildCompare(s)
        ]),

        /* XP + Actions */
        h('section', { class: 'ps-sec ps-sec--action' }, [
          h('div', { class: 'ps-finish' }, [
            buildXPCard(s, xpData),
            buildActions(s, xpData)
          ])
        ]),

        buildFooter()
      ])
    ]);
    hostRef.appendChild(screen);
  }

  /* ── RENDER / CLEANUP ─────────────────────────────── */
  function render(session) {
    // Merge incoming session data with fixture defaults
    var s = session || {};
    sessionRef = {
      fg:             s.fg != null ? s.fg : FIXTURE.fg,
      fgDelta:        s.fgDelta != null ? s.fgDelta : FIXTURE.fgDelta,
      made:           s.made != null ? s.made : FIXTURE.made,
      att:            s.att != null ? s.att : FIXTURE.att,
      durationMin:    s.durationMin != null ? s.durationMin : FIXTURE.durationMin,
      durationSec:    s.durationSec != null ? s.durationSec : FIXTURE.durationSec,
      streakBest:     s.streakBest != null ? s.streakBest : FIXTURE.streakBest,
      pps:            s.pps != null ? s.pps : FIXTURE.pps,
      ppsDelta:       s.ppsDelta != null ? s.ppsDelta : FIXTURE.ppsDelta,
      verdict:        s.verdict || FIXTURE.verdict,
      verdictTone:    s.verdictTone || FIXTURE.verdictTone,
      shots:          s.shots && s.shots.length > 0 ? s.shots : FIXTURE.shots,
      drills:         s.drills && s.drills.length > 0 ? s.drills : FIXTURE.drills,
      zoneBreakdown:  s.zoneBreakdown && s.zoneBreakdown.length > 0 ? s.zoneBreakdown : FIXTURE.zoneBreakdown
    };
    highlightRef = null;

    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-post-session');

    // Hide bottom nav (fullscreen overlay)
    var nav = document.querySelector('.ciq-nav');
    if (nav) nav.style.display = 'none';

    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);

    // Restore bottom nav
    var nav = document.querySelector('.ciq-nav');
    if (nav) nav.style.display = '';

    DOM.restoreLegacyPanels();
    highlightRef = null;
  }

  window.CourtIQ_V2_PostSession = { render: render, cleanup: cleanup };
})();
