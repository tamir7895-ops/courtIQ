/* CourtIQ UI v2 — Track tab renderer (Wave 1 redesign)
 *
 * Ports _design-import/v2/components/track-lab-screen.jsx to vanilla JS.
 * Lab landing only; sub-screens (sessions, zones, heatmap) reachable
 * via mode toggle + zone xref.
 *
 * Wires to ShotService when present; falls back to fixture data.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRACK_TAB) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[track-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  var FIXTURE_DATA = {
    label: 'LAST 7 DAYS', fg: 51, fgDelta: 4, sessions: 6, pps: 1.02, bestStreak: 6,
    hotZone: 'corner-l',
    zoneBreakdown: [
      { id: 'corner-l',  name: 'L CORNER', made: 12, att: 20, delta: 6 },
      { id: 'wing-l',    name: 'L WING',   made: 14, att: 31, delta: -2 },
      { id: 'top',       name: 'TOP',      made: 18, att: 40, delta: 1 },
      { id: 'wing-r',    name: 'R WING',   made: 16, att: 28, delta: 3 },
      { id: 'corner-r',  name: 'R CORNER', made: 10, att: 17, delta: -1 },
      { id: 'paint',     name: 'PAINT',    made: 22, att: 35, delta: 5 },
      { id: 'fts',       name: 'FT',       made: 18, att: 22, delta: 0 }
    ],
    shots: [
      { x: 0.5, y: 0.30, made: true }, { x: 0.30, y: 0.55, made: true },
      { x: 0.72, y: 0.55, made: false }, { x: 0.20, y: 0.70, made: true },
      { x: 0.50, y: 0.45, made: true }, { x: 0.80, y: 0.72, made: false },
      { x: 0.40, y: 0.62, made: true }, { x: 0.62, y: 0.40, made: true }
    ]
  };

  function loadShotData() {
    var d = JSON.parse(JSON.stringify(FIXTURE_DATA));
    try {
      if (window.shotService && typeof window.shotService.getRecentSummary === 'function') {
        var summary = window.shotService.getRecentSummary({ days: 7 });
        if (summary) {
          if (typeof summary.fg === 'number') d.fg = summary.fg;
          if (typeof summary.sessions === 'number') d.sessions = summary.sessions;
          if (Array.isArray(summary.shots) && summary.shots.length) d.shots = summary.shots;
        }
      }
    } catch (e) { /* fixture */ }
    return d;
  }

  function backIcon() {
    return svg('svg', { width: '14', height: '14', viewBox: '0 0 14 14', fill: 'none' },
      [svg('path', { d: 'M9 2L4 7l5 5', stroke: 'currentColor', 'stroke-width': '1.6',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]);
  }

  function buildHalfCourt(width, height) {
    var w = width || 358, ht = height || 320;
    var ns = 'http://www.w3.org/2000/svg';
    var s = svg('svg', { width: String(w), height: String(ht), viewBox: '0 0 358 320', class: 'tl-court-svg' });
    s.appendChild(svg('rect', { x: '4', y: '4', width: '350', height: '312', rx: '12',
      fill: 'none', stroke: 'rgba(245,166,35,0.18)', 'stroke-width': '1' }));
    s.appendChild(svg('path', { d: 'M 4 280 Q 179 90 354 280', fill: 'none',
      stroke: 'rgba(245,166,35,0.18)', 'stroke-width': '1' }));
    s.appendChild(svg('rect', { x: '139', y: '230', width: '80', height: '90',
      fill: 'none', stroke: 'rgba(245,166,35,0.18)', 'stroke-width': '1' }));
    s.appendChild(svg('circle', { cx: '179', cy: '290', r: '10',
      fill: 'none', stroke: 'rgba(245,166,35,0.30)', 'stroke-width': '1' }));
    return s;
  }

  function buildShotsLayer(shots) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = svg('svg', { class: 'tl-court-shots', viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
    shots.forEach(function (sh) {
      s.appendChild(svg('circle', {
        cx: String(sh.x * 100), cy: String(sh.y * 100), r: sh.made ? '1.4' : '1.2',
        fill: sh.made ? '#56d364' : 'transparent',
        stroke: sh.made ? 'rgba(86,211,100,0.9)' : 'rgba(232,64,64,0.85)',
        'stroke-width': sh.made ? '0.4' : '0.7'
      }));
    });
    return s;
  }

  var state = { mode: 'shots', highlight: null };
  var hostRef = null;
  var fileInputRef = null;

  /* ── camera icon (viewfinder) ─────────────────────── */
  function cameraIcon() {
    return svg('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none' },
      [svg('path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
        stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
       svg('circle', { cx: '12', cy: '13', r: '4',
        stroke: 'currentColor', 'stroke-width': '2' })]);
  }

  /* ── upload icon (arrow-up into tray) ─────────────── */
  function uploadIcon() {
    return svg('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none' },
      [svg('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', stroke: 'currentColor',
        'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
       svg('polyline', { points: '17 8 12 3 7 8', stroke: 'currentColor',
        'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
       svg('line', { x1: '12', y1: '3', x2: '12', y2: '15', stroke: 'currentColor',
        'stroke-width': '2', 'stroke-linecap': 'round' })]);
  }

  /* ── hidden file input for Upload Video ───────────── */
  function ensureFileInput() {
    if (fileInputRef) return fileInputRef;
    fileInputRef = document.createElement('input');
    fileInputRef.type = 'file';
    fileInputRef.accept = 'video/*';
    fileInputRef.style.display = 'none';
    fileInputRef.addEventListener('change', function () {
      var file = fileInputRef.files && fileInputRef.files[0];
      if (!file) return;
      if (window.ShotTrackingScreen && typeof window.ShotTrackingScreen.openFromFile === 'function') {
        window.ShotTrackingScreen.openFromFile(file);
      } else {
        console.warn('[track-v2] ShotTrackingScreen.openFromFile not available');
      }
      fileInputRef.value = '';
    });
    document.body.appendChild(fileInputRef);
    return fileInputRef;
  }

  function buildLab(d) {
    var totalMade = d.zoneBreakdown.reduce(function (a, z) { return a + z.made; }, 0);
    var totalAtt  = d.zoneBreakdown.reduce(function (a, z) { return a + z.att; }, 0);

    /* ── YOLOX Launch Tracker hero card ────────────── */
    function launchCameraAction() {
      if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('camera-hud');
      else if (window.CourtIQ_V2_CameraHUD) window.CourtIQ_V2_CameraHUD.render();
      else if (window.ShotTrackingScreen) window.ShotTrackingScreen.open();
    }

    var viewfinder = h('div', { class: 'tl-launch__viewfinder', 'aria-hidden': 'true' }, [
      h('span', { class: 'tl-launch__vf-corner tl' }),
      h('span', { class: 'tl-launch__vf-corner tr' }),
      h('span', { class: 'tl-launch__vf-corner bl' }),
      h('span', { class: 'tl-launch__vf-corner br' }),
      h('span', { class: 'tl-launch__vf-scan' }),
      h('span', { class: 'tl-launch__vf-ring' }),
      svg('svg', { class: 'tl-launch__vf-ball', viewBox: '0 0 30 30' }, [
        svg('circle', { cx: '15', cy: '15', r: '12' }),
        svg('path', { d: 'M3 15 H27' }),
        svg('path', { d: 'M15 3 V27' }),
        svg('path', { d: 'M6 6 Q15 15 6 24' }),
        svg('path', { d: 'M24 6 Q15 15 24 24' })
      ])
    ]);

    var launchCard = h('div', { class: 'tl-launch' }, [
      h('span', { class: 'tl-launch__bug' }, [
        h('span', { class: 'tl-launch__bug-dot' }),
        h('span', { text: 'YOLOX · v0.4 · READY' })
      ]),
      h('div', { class: 'tl-launch__head' }, [
        h('div', { class: 'tl-launch__title-block' }, [
          h('h2', { class: 'tl-launch__title' }, [
            'AI Shot ', h('em', { text: 'Tracker' })
          ]),
          h('p', { class: 'tl-launch__sub', text: 'Real-time shot detection powered by YOLOX AI' })
        ]),
        viewfinder
      ]),
      h('div', { class: 'tl-launch__ctas' }, [
        h('button', { class: 'tl-launch__cta tl-launch__cta--primary', type: 'button',
          onclick: launchCameraAction
        }, [
          svg('svg', { viewBox: '0 0 20 20', fill: 'none' }, [
            svg('path', { d: 'M3 6.5a1.5 1.5 0 0 1 1.5-1.5h2l1-1.5h5l1 1.5h2A1.5 1.5 0 0 1 17 6.5v8A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-8Z',
              stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linejoin': 'round' }),
            svg('circle', { cx: '10', cy: '10.5', r: '3.2', stroke: 'currentColor', 'stroke-width': '1.6' })
          ]),
          h('span', { text: 'Launch Camera' })
        ]),
        h('button', { class: 'tl-launch__cta tl-launch__cta--ghost', type: 'button',
          onclick: function () { ensureFileInput().click(); }
        }, [
          svg('svg', { viewBox: '0 0 20 20', fill: 'none' }, [
            svg('path', { d: 'M10 13V3M10 3l-3.5 3.5M10 3l3.5 3.5',
              stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
            svg('path', { d: 'M3.5 12.5v2A2.5 2.5 0 0 0 6 17h8a2.5 2.5 0 0 0 2.5-2.5v-2',
              stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round' })
          ]),
          h('span', { text: 'Upload Video' })
        ])
      ]),
      h('button', { class: 'tl-launch__last', type: 'button',
        onclick: function () { /* TODO: open sessions */ }
      }, [
        h('span', { class: 'tl-launch__last-l' }, [
          h('span', { class: 'tl-launch__last-dot' }),
          h('span', { class: 'tl-launch__last-lbl', text: 'Last Session' }),
          h('span', { class: 'tl-launch__last-val' }, [
            h('em', { text: '66%' }), ' FG',
            h('span', { class: 'tl-launch__last-ago', text: '· 3 days ago' })
          ])
        ]),
        h('span', { class: 'tl-launch__last-arrow', text: '›' })
      ])
    ]);

    /* ── Quick Stats — horizontal scroll pills ─────── */
    var quickStats = h('div', { class: 'tl-quickstats' }, [
      h('div', { class: 'tl-quickstat tl-quickstat--accent' }, [
        h('span', { class: 'tl-quickstat__lbl', text: 'Sessions / wk' }),
        h('span', { class: 'tl-quickstat__val', text: String(d.sessions) })
      ]),
      h('div', { class: 'tl-quickstat' }, [
        h('span', { class: 'tl-quickstat__lbl', text: 'Best Streak' }),
        h('span', { class: 'tl-quickstat__val', text: String(d.bestStreak) })
      ]),
      h('div', { class: 'tl-quickstat' }, [
        h('span', { class: 'tl-quickstat__lbl', text: 'Total Shots' }),
        h('span', { class: 'tl-quickstat__val', text: String(totalAtt) })
      ]),
      h('div', { class: 'tl-quickstat' }, [
        h('span', { class: 'tl-quickstat__lbl', text: 'Avg / Sesh' }),
        h('span', { class: 'tl-quickstat__val', text: d.sessions > 0 ? String(Math.round(totalAtt / d.sessions)) : '0' })
      ])
    ]);

    var heroCard = h('section', { class: 'tl-sec tl-sec--hero', style: { marginTop: '0' } }, [
      launchCard,
      quickStats
    ]);

    /* ── FG% Hero section ──────────────────────────── */
    var fgDeltaClass = 'tl-hero__delta ' + (d.fgDelta >= 0 ? 'is-up' : 'is-down');
    var fgArrow = d.fgDelta >= 0 ? '▲' : '▼';
    var fgSign = d.fgDelta >= 0 ? '+' : '';
    var fgHero = h('section', { class: 'tl-sec' }, [
      h('div', { class: 'tl-hero' }, [
        h('div', { class: 'tl-hero__lbl', text: 'FG% · ' + d.label.toUpperCase() }),
        h('div', { class: 'tl-hero__num' }, [
          h('span', { class: 'tl-hero__int', text: String(d.fg) }),
          h('span', { class: 'tl-hero__pct', text: '%' })
        ]),
        h('div', { class: fgDeltaClass }, [
          h('span', { class: 'tl-hero__arrow', text: fgArrow }),
          fgSign + d.fgDelta + ' PTS VS PRIOR 7D',
          h('span', { class: 'tl-hero__sub', text: '· ' + totalMade + '/' + totalAtt + ' · ' + d.sessions + ' SESSIONS' })
        ])
      ])
    ]);

    /* ── Mode toggle (chip pills) ─────────────────── */
    var modeRow = h('div', { class: 'tl-mode', role: 'tablist' });
    [{ id: 'shots', label: 'SHOTS' }, { id: 'heatmap', label: 'HEATMAP' }, { id: 'frequency', label: 'FREQUENCY' }]
      .forEach(function (m) {
        modeRow.appendChild(h('button', {
          class: 'tl-mode__btn' + (state.mode === m.id ? ' is-active' : ''),
          role: 'tab', text: m.label,
          onclick: function () { state.mode = m.id; paint(); }
        }));
      });
    var modeBlock = h('section', { class: 'tl-sec' }, [modeRow]);

    /* ── Shots mode content (court + zones + stats) ─── */
    function buildShotsContent() {
      var courtHead = h('div', { class: 'tl-court-card__head' }, [
        h('div', { class: 'tl-court-card__lbl', text: 'ALL SHOTS · 7D' }),
        h('div', { class: 'tl-court-card__hint', text: 'TAP A ZONE' })
      ]);

      var courtVisual = h('div', { class: 'tl-court-card__court' }, [buildHalfCourt(), buildShotsLayer(d.shots)]);
      var courtCard = h('div', { class: 'tl-court-card' }, [courtHead, courtVisual]);
      var courtBlock = h('section', { class: 'tl-sec', style: { marginTop: '0' } }, [courtCard]);

      var zonesRow = h('div', { class: 'tl-zones__row' });
      d.zoneBreakdown.forEach(function (z) {
        var fg = Math.round((z.made / Math.max(1, z.att)) * 100);
        zonesRow.appendChild(h('button', {
          class: 'tl-zone' + (state.highlight === z.id ? ' is-active' : ''),
          onclick: function () { state.highlight = z.id; paint(); }
        }, [
          h('span', { class: 'tl-zone__name', text: z.name }),
          h('span', { class: 'tl-zone__fg' }, [String(fg), h('span', { text: '%' })]),
          h('span', { class: 'tl-zone__att', text: z.made + '/' + z.att }),
          h('span', { class: 'tl-zone__delta ' + (z.delta >= 0 ? 'is-up' : 'is-down'),
            text: (z.delta >= 0 ? '▲ ' : '▼ ') + Math.abs(z.delta) })
        ]));
      });
      var zonesBlock = h('section', { class: 'tl-sec' }, [
        h('div', { class: 'tl-zones__lbl', text: 'BY ZONE · TAP FOR DETAIL' }),
        zonesRow
      ]);

      var board = h('div', { class: 'tl-board' }, [
        h('div', { class: 'tl-board__cell' }, [
          h('span', { class: 'tl-board__lbl', text: 'PPS' }),
          h('span', { class: 'tl-board__big', text: d.pps.toFixed(2) })
        ]),
        h('div', { class: 'tl-board__cell' }, [
          h('span', { class: 'tl-board__lbl', text: 'BEST RUN' }),
          h('span', { class: 'tl-board__big' }, [String(d.bestStreak), h('span', { text: ' ·in row' })])
        ]),
        h('div', { class: 'tl-board__cell' }, [
          h('span', { class: 'tl-board__lbl', text: 'SESSIONS' }),
          h('span', { class: 'tl-board__big' }, [String(d.sessions), h('span', { text: ' ·7d' })])
        ])
      ]);
      var boardBlock = h('section', { class: 'tl-sec' }, [board]);

      var sessXref = h('button', { class: 'tl-xref',
        onclick: function () { /* TODO: sessions sub-screen */ } }, [
        h('span', { class: 'tl-xref__icon' }, [
          svg('svg', { width: '14', height: '14', viewBox: '0 0 14 14', fill: 'none' },
            [svg('path', { d: 'M2 3h10M2 7h10M2 11h6', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round' })])
        ]),
        h('span', { class: 'tl-xref__body' }, [
          h('span', { class: 'tl-xref__lbl', text: 'SESSIONS · LAST 7D' }),
          h('span', { class: 'tl-xref__sub', text: d.sessions + ' sessions · ' + totalMade + '/' + totalAtt + ' attempts' })
        ]),
        h('span', { class: 'tl-xref__arrow', text: '›' })
      ]);
      var xrefBlock = h('section', { class: 'tl-sec' }, [sessXref]);

      return [courtBlock, zonesBlock, boardBlock, xrefBlock];
    }

    /* ── Heatmap mode: delegate to external renderer or placeholder ── */
    function buildHeatmapContent() {
      if (window.CourtIQ_V2_TrackHeatmap && typeof window.CourtIQ_V2_TrackHeatmap.render === 'function') {
        var wrap = h('div', { class: 'tl-sub-mount', id: 'tl-heatmap-mount' });
        setTimeout(function () { window.CourtIQ_V2_TrackHeatmap.render(wrap); }, 0);
        return [h('section', { class: 'tl-sec', style: { marginTop: '0' } }, [wrap])];
      }
      var courtHead = h('div', { class: 'tl-court-card__head' }, [
        h('div', { class: 'tl-court-card__lbl', text: 'ZONE HEAT · FG%' }),
        h('div', { class: 'tl-court-card__hint', text: 'TAP A ZONE' })
      ]);
      var courtVisual = h('div', { class: 'tl-court-card__court' }, [buildHalfCourt(), buildShotsLayer(d.shots)]);
      var courtCard = h('div', { class: 'tl-court-card is-heat' }, [courtHead, courtVisual]);
      return [h('section', { class: 'tl-sec', style: { marginTop: '0' } }, [courtCard])];
    }

    /* ── Frequency mode: delegate to external renderer or placeholder ── */
    function buildFrequencyContent() {
      if (window.CourtIQ_V2_TrackSessions && typeof window.CourtIQ_V2_TrackSessions.render === 'function') {
        var wrap = h('div', { class: 'tl-sub-mount', id: 'tl-frequency-mount' });
        setTimeout(function () { window.CourtIQ_V2_TrackSessions.render(wrap); }, 0);
        return [h('section', { class: 'tl-sec', style: { marginTop: '0' } }, [wrap])];
      }
      return [h('section', { class: 'tl-sec' }, [
        h('div', { class: 'tl-placeholder', text: 'Session frequency coming soon.' })
      ])];
    }

    /* ── Build mode-specific content ────────────────── */
    var modeContent;
    if (state.mode === 'heatmap') {
      modeContent = buildHeatmapContent();
    } else if (state.mode === 'frequency') {
      modeContent = buildFrequencyContent();
    } else {
      modeContent = buildShotsContent();
    }

    var foot = h('div', { class: 'tl-foot', text: 'CourtIQ · Track · Lab' });

    var scrollChildren = [heroCard, fgHero, modeBlock].concat(modeContent).concat([foot]);
    var scroll = h('div', { class: 'tl-scroll' }, scrollChildren);
    return [scroll];
  }

  function paint() {
    if (!hostRef) return;
    DOM.clearChildren(hostRef);
    var screen = h('div', { class: 'tl' }, buildLab(loadShotData()));
    hostRef.appendChild(screen);
  }

  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-track');
    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_Track = { render: render, cleanup: cleanup };
})();
