/* CourtIQ UI v2 — court-svg.js
 *
 * Reusable half-court SVG renderer with 9 shot zones.
 * Used by: Track Lab heatmap, Post-Session shot chart, Drill cards.
 *
 * Usage:
 *   var court = CourtSVG.create({ width: 280, showZones: true });
 *   container.appendChild(court.el);
 *
 *   // Color a zone by shooting %
 *   court.setZoneHeat('z-paint', 0.65);      // 65% → hot
 *   court.setZoneHeat('z-corner3-l', 0.25);  // 25% → cold
 *
 *   // Plot shot dots
 *   court.plotShot(250, 200, true);   // made
 *   court.plotShot(100, 300, false);  // missed
 *
 *   // Clear all shots
 *   court.clearShots();
 *
 * Zone IDs:
 *   z-paint, z-mid-l, z-mid-r, z-mid-top,
 *   z-corner3-l, z-corner3-r, z-wing3-l, z-wing3-r, z-top3
 *
 * Coordinate system: 500×470 viewBox, rim at top (y=0 baseline).
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* ─── Zone polygon data ────────────────────────────────────────
     Each zone is a closed polygon path (M...Z).
     Arc curves approximated with enough points for smooth rendering.
     Zones tile 100% of the 500×470 court with zero gaps.
  ──────────────────────────────────────────────────────────────── */
  var ZONES = {
    'z-paint':     'M170,0 L330,0 L330,190 L170,190 Z',
    'z-mid-l':     'M30,0 L170,0 L170,276 L160,272 L140,263 L120,251 L100,237 L80,218 L60,195 L30,142 Z',
    'z-mid-r':     'M330,0 L470,0 L470,142 L440,195 L420,218 L400,237 L380,251 L360,263 L340,272 L330,276 L330,0 Z',
    'z-mid-top':   'M170,190 L330,190 L330,276 L320,279 L300,285 L280,288 L260,290 L250,290 L240,290 L220,288 L200,285 L180,279 L170,276 Z',
    'z-corner3-l': 'M0,0 L30,0 L30,142 L0,142 Z',
    'z-corner3-r': 'M470,0 L500,0 L500,142 L470,142 Z',
    'z-wing3-l':   'M0,142 L30,142 L38,160 L50,180 L64,200 L82,220 L104,240 L135,260 L155,270 L170,276 L170,470 L0,470 Z',
    'z-wing3-r':   'M470,142 L500,142 L500,470 L330,470 L330,276 L345,270 L366,260 L396,240 L418,220 L436,200 L450,180 L462,160 L470,142 Z',
    'z-top3':      'M170,276 L180,279 L200,285 L220,288 L240,290 L250,290 L260,290 L280,288 L300,285 L320,279 L330,276 L330,470 L170,470 Z'
  };

  /* Human-readable zone names */
  var ZONE_LABELS = {
    'z-paint':     { label: 'Paint',      x: 250, y: 100 },
    'z-mid-l':     { label: 'L Mid',      x: 100, y: 140 },
    'z-mid-r':     { label: 'R Mid',      x: 400, y: 140 },
    'z-mid-top':   { label: 'Top Mid',    x: 250, y: 245 },
    'z-corner3-l': { label: 'L C3',       x: 15,  y: 75  },
    'z-corner3-r': { label: 'R C3',       x: 485, y: 75  },
    'z-wing3-l':   { label: 'L Wing 3',   x: 70,  y: 360 },
    'z-wing3-r':   { label: 'R Wing 3',   x: 430, y: 360 },
    'z-top3':      { label: 'Top 3',      x: 250, y: 380 }
  };

  /* ─── Heat color interpolation ─────────────────────────────── */
  function heatColor(pct, opacity) {
    // 0% = cold blue, 50% = neutral, 100% = hot red
    // Below 40% → blue range, above 60% → red range, middle → gray
    var r, g, b;
    if (pct < 0.4) {
      // Cold: blue (#4ca3ff) to gray
      var t = pct / 0.4;
      r = Math.round(76 * t + 40 * (1 - t));
      g = Math.round(163 * t + 80 * (1 - t));
      b = Math.round(255 * t + 200 * (1 - t));
    } else if (pct > 0.6) {
      // Hot: gray to red (#ff3a14)
      var t2 = (pct - 0.6) / 0.4;
      r = Math.round(255 * t2 + 120 * (1 - t2));
      g = Math.round(58 * t2 + 120 * (1 - t2));
      b = Math.round(20 * t2 + 120 * (1 - t2));
    } else {
      // Neutral
      r = 120; g = 120; b = 120;
    }
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (opacity || 0.25) + ')';
  }

  /* ─── SVG helpers ──────────────────────────────────────────── */
  function svgEl(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
      }
    }
    return el;
  }

  /* ─── Build court SVG ──────────────────────────────────────── */
  function create(opts) {
    opts = opts || {};
    var showZones = opts.showZones !== false;
    var showLabels = opts.showLabels || false;
    var showLines = opts.showLines !== false;
    var interactive = opts.interactive || false;

    var svg = svgEl('svg', {
      viewBox: '0 0 500 470',
      preserveAspectRatio: 'xMidYMid meet',
      fill: 'none',
      'class': 'ciq-court-svg'
    });
    if (opts.width) svg.style.width = opts.width + 'px';
    if (opts.height) svg.style.height = opts.height + 'px';

    /* ── Defs: clip paths ── */
    var defs = svgEl('defs');

    var clips = [
      { id: 'crt-c3',  rect: { x: 0, y: 142, width: 500, height: 328 } },
      { id: 'crt-ftb', rect: { x: 0, y: 190, width: 500, height: 280 } },
      { id: 'crt-ftt', rect: { x: 0, y: 0,   width: 500, height: 190 } },
      { id: 'crt-ra',  rect: { x: 0, y: 40,  width: 500, height: 430 } },
      { id: 'crt-cc',  rect: { x: 0, y: 410, width: 500, height: 60  } }
    ];

    clips.forEach(function (c) {
      var cp = svgEl('clipPath', { id: c.id });
      cp.appendChild(svgEl('rect', c.rect));
      defs.appendChild(cp);
    });

    svg.appendChild(defs);

    /* ── Court background ── */
    svg.appendChild(svgEl('rect', {
      width: 500, height: 470, rx: 4,
      fill: 'var(--c-surface, #151922)'
    }));

    /* ── Zone layer ── */
    var zoneGroup = svgEl('g', { 'class': 'ciq-court-zones' });
    var zoneEls = {};

    if (showZones) {
      for (var zid in ZONES) {
        if (!ZONES.hasOwnProperty(zid)) continue;
        var zoneAttrs = {
          id: zid,
          d: ZONES[zid],
          fill: 'rgba(255,255,255,0.04)',
          stroke: 'rgba(255,255,255,0.06)',
          'stroke-width': '0.5',
          'class': 'ciq-court-zone'
        };
        if (interactive) {
          zoneAttrs.style = 'cursor:pointer';
          zoneAttrs['data-zone'] = zid;
        }
        var zPath = svgEl('path', zoneAttrs);
        zoneGroup.appendChild(zPath);
        zoneEls[zid] = zPath;
      }
    }
    svg.appendChild(zoneGroup);

    /* ── Court lines ── */
    if (showLines) {
      var linesGroup = svgEl('g', { 'class': 'ciq-court-lines' });
      var lineStyle = { stroke: 'rgba(255,255,255,0.22)', 'stroke-width': '1.5', fill: 'none' };
      var dashStyle = { stroke: 'rgba(255,255,255,0.22)', 'stroke-width': '1.5', fill: 'none', 'stroke-dasharray': '8 6' };

      // Court boundary
      linesGroup.appendChild(svgEl('rect', Object.assign({ x: 1, y: 1, width: 498, height: 468, rx: 3 }, lineStyle)));

      // Paint
      linesGroup.appendChild(svgEl('rect', Object.assign({ x: 170, y: 0, width: 160, height: 190 }, lineStyle)));

      // FT circle bottom (solid)
      linesGroup.appendChild(svgEl('circle', Object.assign({ cx: 250, cy: 190, r: 60, 'clip-path': 'url(#crt-ftb)' }, lineStyle)));
      // FT circle top (dashed)
      linesGroup.appendChild(svgEl('circle', Object.assign({ cx: 250, cy: 190, r: 60, 'clip-path': 'url(#crt-ftt)' }, dashStyle)));

      // Hash marks
      [[162,70,170,70],[162,80,170,80],[162,110,170,110],[162,140,170,140],
       [330,70,338,70],[330,80,338,80],[330,110,338,110],[330,140,338,140]
      ].forEach(function (h) {
        linesGroup.appendChild(svgEl('line', Object.assign({ x1: h[0], y1: h[1], x2: h[2], y2: h[3] }, lineStyle)));
      });

      // 3PT corners
      linesGroup.appendChild(svgEl('line', Object.assign({ x1: 30, y1: 0, x2: 30, y2: 142 }, lineStyle)));
      linesGroup.appendChild(svgEl('line', Object.assign({ x1: 470, y1: 0, x2: 470, y2: 142 }, lineStyle)));

      // 3PT arc (clipped circle)
      linesGroup.appendChild(svgEl('circle', Object.assign({ cx: 250, cy: 52.5, r: 237.5, 'clip-path': 'url(#crt-c3)' }, lineStyle)));

      // Restricted area
      linesGroup.appendChild(svgEl('circle', Object.assign({ cx: 250, cy: 52.5, r: 40, 'clip-path': 'url(#crt-ra)' }, lineStyle)));

      // Backboard
      linesGroup.appendChild(svgEl('line', {
        x1: 220, y1: 40, x2: 280, y2: 40,
        stroke: 'rgba(255,255,255,0.4)', 'stroke-width': '3', 'stroke-linecap': 'round'
      }));

      // Rim
      linesGroup.appendChild(svgEl('circle', {
        cx: 250, cy: 52.5, r: 7.5,
        stroke: 'var(--c-brand, #ff3a14)', 'stroke-width': '2.5', fill: 'none'
      }));

      // Center circle
      linesGroup.appendChild(svgEl('circle', Object.assign({ cx: 250, cy: 470, r: 60, 'clip-path': 'url(#crt-cc)' }, dashStyle)));

      svg.appendChild(linesGroup);
    }

    /* ── Labels layer ── */
    if (showLabels) {
      var labelsGroup = svgEl('g', { 'class': 'ciq-court-labels' });
      for (var lid in ZONE_LABELS) {
        if (!ZONE_LABELS.hasOwnProperty(lid)) continue;
        var lbl = ZONE_LABELS[lid];
        var txt = svgEl('text', {
          x: lbl.x, y: lbl.y,
          'text-anchor': 'middle',
          fill: 'rgba(255,255,255,0.6)',
          'font-family': "'Barlow Condensed', sans-serif",
          'font-size': lid.indexOf('corner') > -1 ? '9' : '11',
          'font-weight': '600',
          'text-transform': 'uppercase',
          'letter-spacing': '1'
        });
        txt.textContent = lbl.label;
        labelsGroup.appendChild(txt);
      }
      svg.appendChild(labelsGroup);
    }

    /* ── Shot dots layer ── */
    var shotsGroup = svgEl('g', { 'class': 'ciq-court-shots' });
    svg.appendChild(shotsGroup);

    /* ── Stats overlay layer (for zone stats text) ── */
    var statsGroup = svgEl('g', { 'class': 'ciq-court-stats' });
    svg.appendChild(statsGroup);

    /* ─── Public API ──────────────────────────────────────────── */
    return {
      el: svg,

      /** Set a zone's heat color by shooting percentage (0–1) */
      setZoneHeat: function (zoneId, pct) {
        var zEl = zoneEls[zoneId];
        if (!zEl) return;
        zEl.setAttribute('fill', heatColor(pct, 0.3));
      },

      /** Set zone to a specific RGBA fill */
      setZoneFill: function (zoneId, fill) {
        var zEl = zoneEls[zoneId];
        if (zEl) zEl.setAttribute('fill', fill);
      },

      /** Reset all zones to default fill */
      resetZones: function () {
        for (var z in zoneEls) {
          if (zoneEls.hasOwnProperty(z)) {
            zoneEls[z].setAttribute('fill', 'rgba(255,255,255,0.04)');
          }
        }
      },

      /** Plot a shot dot at (x, y) in 500×470 coords */
      plotShot: function (x, y, made) {
        var dot = svgEl('circle', {
          cx: x, cy: y, r: 5,
          fill: made ? 'var(--c-green, #56d364)' : 'var(--c-red, #e84040)',
          opacity: '0.85',
          'class': 'ciq-court-shot ' + (made ? 'made' : 'missed')
        });
        shotsGroup.appendChild(dot);
        return dot;
      },

      /** Clear all plotted shots */
      clearShots: function () {
        while (shotsGroup.firstChild) shotsGroup.removeChild(shotsGroup.firstChild);
      },

      /** Show stat text on a zone (e.g., "5/8" or "62%") */
      setZoneStat: function (zoneId, text) {
        var lbl = ZONE_LABELS[zoneId];
        if (!lbl) return;
        // Remove existing stat for this zone
        var existing = statsGroup.querySelector('[data-zone-stat="' + zoneId + '"]');
        if (existing) statsGroup.removeChild(existing);

        var txt = svgEl('text', {
          x: lbl.x, y: lbl.y + 14,
          'text-anchor': 'middle',
          fill: 'var(--c-white, #f0ede6)',
          'font-family': "'Barlow Condensed', sans-serif",
          'font-size': '13',
          'font-weight': '700',
          'data-zone-stat': zoneId
        });
        txt.textContent = text;
        statsGroup.appendChild(txt);
      },

      /** Clear all zone stats */
      clearStats: function () {
        while (statsGroup.firstChild) statsGroup.removeChild(statsGroup.firstChild);
      },

      /** Get zone ID for a point (hit test) */
      getZoneAt: function (x, y) {
        for (var z in zoneEls) {
          if (!zoneEls.hasOwnProperty(z)) continue;
          var p = svg.createSVGPoint();
          p.x = x; p.y = y;
          if (zoneEls[z].isPointInFill(p)) return z;
        }
        return null;
      },

      /** Attach click handler to zones */
      onZoneClick: function (callback) {
        for (var z in zoneEls) {
          if (!zoneEls.hasOwnProperty(z)) continue;
          (function (zoneId) {
            zoneEls[zoneId].addEventListener('click', function () {
              callback(zoneId, ZONE_LABELS[zoneId].label);
            });
          })(z);
        }
      },

      /** Reference to zone elements */
      zones: zoneEls,

      /** Static data */
      ZONES: ZONES,
      ZONE_LABELS: ZONE_LABELS
    };
  }

  /* ─── Export ────────────────────────────────────────────────── */
  window.CourtSVG = { create: create, heatColor: heatColor };

})();
