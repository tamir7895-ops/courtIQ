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

  function buildLab(d) {
    var totalMade = d.zoneBreakdown.reduce(function (a, z) { return a + z.made; }, 0);
    var totalAtt  = d.zoneBreakdown.reduce(function (a, z) { return a + z.att; }, 0);

    var stamp = h('div', { class: 'tl-stamp' }, [
      h('div', { class: 'tl-stamp__l' }, [
        h('button', { class: 'tl-stamp__back', 'aria-label': 'Back',
          onclick: function () { if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('home'); } }, [backIcon()]),
        h('div', null, [
          h('div', { class: 'tl-stamp__eyebrow', text: 'TRACK · LAB' }),
          h('div', { class: 'tl-stamp__meta', text: d.label })
        ])
      ]),
      h('div', { class: 'tl-stamp__pill', text: 'LIVE' })
    ]);

    var heroBlock = h('section', { class: 'tl-sec tl-sec--hero' }, [
      h('div', { class: 'tl-hero' }, [
        h('div', { class: 'tl-hero__lbl', text: 'FG% · ' + d.label.toUpperCase() }),
        h('div', { class: 'tl-hero__num' }, [
          h('span', { class: 'tl-hero__int', text: String(d.fg) }),
          h('span', { class: 'tl-hero__pct', text: '%' })
        ]),
        h('div', { class: 'tl-hero__delta ' + (d.fgDelta >= 0 ? 'is-up' : 'is-down') }, [
          h('span', { class: 'tl-hero__arrow', text: d.fgDelta >= 0 ? '▲' : '▼' }),
          ' ' + (d.fgDelta >= 0 ? '+' : '') + d.fgDelta + ' PTS VS PRIOR 7D',
          h('span', { class: 'tl-hero__sub', text: ' · ' + totalMade + '/' + totalAtt + ' · ' + d.sessions + ' SESSIONS' })
        ])
      ])
    ]);

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

    var courtHead = h('div', { class: 'tl-court-card__head' }, [
      h('div', { class: 'tl-court-card__lbl',
        text: state.mode === 'shots' ? 'ALL SHOTS · 7D' :
              state.mode === 'heatmap' ? 'ZONE HEAT · FG%' : 'VOLUME · ATTEMPTS' }),
      h('div', { class: 'tl-court-card__hint', text: 'TAP A ZONE' })
    ]);

    var courtVisual = h('div', { class: 'tl-court-card__court' }, [buildHalfCourt(), buildShotsLayer(d.shots)]);
    var courtCard = h('div', { class: 'tl-court-card' + (state.mode === 'heatmap' ? ' is-heat' : '') },
      [courtHead, courtVisual]);
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

    var foot = h('div', { class: 'tl-foot', text: 'CourtIQ · Track · Lab' });

    var scroll = h('div', { class: 'tl-scroll' }, [heroBlock, modeBlock, courtBlock, zonesBlock, boardBlock, xrefBlock, foot]);
    return [stamp, scroll];
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
