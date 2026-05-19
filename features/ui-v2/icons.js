/* CourtIQ UI v2 — Icon system (Phase 10.0.A)
 *
 * Single source of truth for every icon in the v2 UI.
 *
 * Hybrid set:
 *   - 16 custom BASKETBALL icons (drill types, zones, stats, badges, court)
 *   - ~20 Phosphor-inspired GENERIC icons (UI controls, system actions)
 *
 * All icons:
 *   - 24×24 viewBox
 *   - currentColor stroke + fill
 *   - 1.75px stroke (slightly thinner than Lucide's 2px — feels lighter)
 *   - Rounded line caps + joins
 *   - Built via createElementNS (no innerHTML, no XSS surface)
 *
 * Usage:
 *   var icon = ICONS.shooting({ size: 22 });
 *   container.appendChild(icon);
 *
 * The optional opts object:
 *   - size:    number (default 22)
 *   - stroke:  string (default 'currentColor')
 *   - fill:    string (default 'none' for stroke icons; 'currentColor' for filled)
 *   - className: string (extra class on the <svg>)
 */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ─── Icon definitions ──────────────────────────────────────
   * Each def is an array of node descriptors:
   *   { tag: 'path' | 'circle' | 'line' | 'polyline' | 'polygon', attrs: {...} }
   * Plus a top-level `style` flag: 'stroke' (default) or 'fill'.
   */
  var DEFS = {

    /* ═══ BASKETBALL ICONS (16) ═══════════════════════════════ */

    /* drill-shooting — basketball with motion arc trail */
    shooting: { style: 'stroke', nodes: [
      { tag: 'circle',   attrs: { cx: 9.5, cy: 14.5, r: 4 } },
      { tag: 'path',     attrs: { d: 'M5.5 14.5h8M9.5 10.5v8M6.5 11.7l6 5.5M12.5 11.7l-6 5.5' } },
      { tag: 'path',     attrs: { d: 'M14 12c2-3 4-5 7-5', 'stroke-dasharray': '2 2' } },
      { tag: 'circle',   attrs: { cx: 21, cy: 7, r: 0.9, fill: 'currentColor', stroke: 'none' } }
    ] },

    /* drill-ballhandling — ball with motion lines on each side */
    ballhandling: { style: 'stroke', nodes: [
      { tag: 'circle',   attrs: { cx: 12, cy: 12, r: 4 } },
      { tag: 'path',     attrs: { d: 'M8 12h8M12 8v8M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6' } },
      { tag: 'path',     attrs: { d: 'M3 9l1.5 1.5M3 15l1.5-1.5M21 9l-1.5 1.5M21 15l-1.5-1.5' } }
    ] },

    /* drill-defense — defensive stance, wide-legged silhouette */
    defense: { style: 'stroke', nodes: [
      { tag: 'circle',   attrs: { cx: 12, cy: 5, r: 2 } },
      { tag: 'path',     attrs: { d: 'M12 7v5M7 11l5 1 5-1' } },
      { tag: 'path',     attrs: { d: 'M12 12L7 19M12 12l5 7' } },
      { tag: 'path',     attrs: { d: 'M5 21h4M15 21h4', 'stroke-width': 2 } }
    ] },

    /* drill-athleticism — jumping silhouette, arms up */
    athleticism: { style: 'stroke', nodes: [
      { tag: 'circle',   attrs: { cx: 12, cy: 4.5, r: 2 } },
      { tag: 'path',     attrs: { d: 'M12 6.5v6.5M9 8L6 4M15 8l3-4' } },
      { tag: 'path',     attrs: { d: 'M9 13l-1 5M15 13l1 5' } },
      { tag: 'path',     attrs: { d: 'M5 22h14', 'stroke-dasharray': '2 3' } }
    ] },

    /* drill-conditioning — heartbeat / pulse line */
    conditioning: { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M3 12h3l2-5 3 10 3-7 2 4 2-2h3' } }
    ] },

    /* zone-paint — rectangle (the key) */
    zonePaint: { style: 'stroke', nodes: [
      { tag: 'rect',     attrs: { x: 6, y: 4, width: 12, height: 14, rx: 1 } },
      { tag: 'path',     attrs: { d: 'M9 18a3 3 0 0 0 6 0' } },
      { tag: 'circle',   attrs: { cx: 12, cy: 14, r: 1.5 } }
    ] },

    /* zone-3pt — semicircle arc with marker */
    zone3pt: { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M3 18A9 9 0 0 1 21 18' } },
      { tag: 'circle',   attrs: { cx: 12, cy: 9, r: 1.6, fill: 'currentColor', stroke: 'none' } },
      { tag: 'path',     attrs: { d: 'M3 18h18' } }
    ] },

    /* zone-midrange — diamond / rotated square */
    zoneMidrange: { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M12 4l8 8-8 8-8-8z' } },
      { tag: 'circle',   attrs: { cx: 12, cy: 12, r: 2 } }
    ] },

    /* stat-fg — circle with checkmark (made shot) */
    statFg: { style: 'stroke', nodes: [
      { tag: 'circle',   attrs: { cx: 12, cy: 12, r: 9 } },
      { tag: 'path',     attrs: { d: 'M8 12.5l2.8 2.8L16.5 9.5' } }
    ] },

    /* stat-streak — flame, stylized */
    statStreak: { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 1.5-4 .5 2 1.5 2.5 2.5 2 0-2 0-5 1-8z' } },
      { tag: 'path',     attrs: { d: 'M11 14a2 2 0 0 0 2 2', 'stroke-width': 1.5 } }
    ] },

    /* stat-xp — lightning bolt with progress notch */
    statXp: { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M13 2L4 14h6l-1 8 9-12h-6z', 'stroke-linejoin': 'round' } }
    ] },

    /* badge-trophy — cup with handles */
    badgeTrophy: { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M7 4h10v6a5 5 0 0 1-10 0V4z' } },
      { tag: 'path',     attrs: { d: 'M7 5H5a2 2 0 0 0 0 4h2M17 5h2a2 2 0 0 1 0 4h-2' } },
      { tag: 'path',     attrs: { d: 'M10 15v3M14 15v3M8 21h8M12 18v3' } }
    ] },

    /* badge-medal — circle hanging on ribbon */
    badgeMedal: { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M8 2l4 6 4-6M9 4l3 4 3-4' } },
      { tag: 'circle',   attrs: { cx: 12, cy: 16, r: 5.5 } },
      { tag: 'path',     attrs: { d: 'M10 16l1.5 1.5L14 14', 'stroke-width': 1.4 } }
    ] },

    /* badge-target — concentric circles + crosshair */
    badgeTarget: { style: 'stroke', nodes: [
      { tag: 'circle',   attrs: { cx: 12, cy: 12, r: 9 } },
      { tag: 'circle',   attrs: { cx: 12, cy: 12, r: 5 } },
      { tag: 'circle',   attrs: { cx: 12, cy: 12, r: 1.5, fill: 'currentColor', stroke: 'none' } },
      { tag: 'path',     attrs: { d: 'M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3' } }
    ] },

    /* badge-star — 5-point star outlined with smaller filled inner */
    badgeStar: { style: 'stroke', nodes: [
      { tag: 'polygon',  attrs: { points: '12,3 14.5,9 21,9.5 16,14 17.5,21 12,17.5 6.5,21 8,14 3,9.5 9.5,9' } }
    ] },

    /* court-rim — basketball hoop with net */
    courtRim: { style: 'stroke', nodes: [
      { tag: 'ellipse',  attrs: { cx: 12, cy: 8, rx: 8, ry: 2 } },
      { tag: 'path',     attrs: { d: 'M5 8l1 9c0 2 12 2 12 0l1-9' } },
      { tag: 'path',     attrs: { d: 'M8 9l1 8M12 9.5v8M16 9l-1 8', 'stroke-width': 1.2 } }
    ] },

    /* ═══ UI ICONS — basketball-crafted variants ═══════════════ */

    /* Home — basketball with seams (matches bottom-nav) */
    home:     { style: 'stroke', nodes: [
      { tag: 'circle',   attrs: { cx: 12, cy: 12, r: 9 } },
      { tag: 'path',     attrs: { d: 'M3 12h18' } },
      { tag: 'path',     attrs: { d: 'M8.5 3.3Q5.5 12 8.5 20.7' } },
      { tag: 'path',     attrs: { d: 'M15.5 3.3Q18.5 12 15.5 20.7' } }
    ] },
    /* Calendar — scoreboard-style with game-day marks */
    calendar: { style: 'stroke', nodes: [
      { tag: 'rect',     attrs: { x: 3, y: 5, width: 18, height: 16, rx: 2 } },
      { tag: 'path',     attrs: { d: 'M3 10h18M8 3v4M16 3v4' } },
      { tag: 'circle',   attrs: { cx: 8, cy: 15, r: 1.2, fill: 'currentColor', stroke: 'none' } },
      { tag: 'circle',   attrs: { cx: 16, cy: 15, r: 1.2, fill: 'currentColor', stroke: 'none' } }
    ] },
    /* Mail — unchanged, universal */
    mail:     { style: 'stroke', nodes: [
      { tag: 'rect',     attrs: { x: 2.5, y: 5, width: 19, height: 14, rx: 2 } },
      { tag: 'path',     attrs: { d: 'M3 7l9 6 9-6' } }
    ] },
    /* Logout — exit door with arrow */
    logout:   { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9' } }
    ] },
    /* Settings — sliders (cleaner than generic gear) */
    settings: { style: 'stroke', nodes: [
      { tag: 'line',     attrs: { x1: 4, y1: 6, x2: 20, y2: 6 } },
      { tag: 'line',     attrs: { x1: 4, y1: 12, x2: 20, y2: 12 } },
      { tag: 'line',     attrs: { x1: 4, y1: 18, x2: 20, y2: 18 } },
      { tag: 'circle',   attrs: { cx: 9, cy: 6, r: 2.2, fill: 'var(--ciq-bg,#1a1a2e)', stroke: 'currentColor' } },
      { tag: 'circle',   attrs: { cx: 16, cy: 12, r: 2.2, fill: 'var(--ciq-bg,#1a1a2e)', stroke: 'currentColor' } },
      { tag: 'circle',   attrs: { cx: 7, cy: 18, r: 2.2, fill: 'var(--ciq-bg,#1a1a2e)', stroke: 'currentColor' } }
    ] },
    /* Share — pass icon (basketball pass trajectory) */
    share:    { style: 'stroke', nodes: [
      { tag: 'circle',   attrs: { cx: 5, cy: 18, r: 2.5 } },
      { tag: 'path',     attrs: { d: 'M7.5 16.5Q12 8 19 6' } },
      { tag: 'polyline', attrs: { points: '16 4 19 6 17 9' } }
    ] },
    /* Upload — ball arc going up into hoop */
    upload:   { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' } },
      { tag: 'path',     attrs: { d: 'M12 16V5' } },
      { tag: 'polyline', attrs: { points: '8 9 12 5 16 9' } }
    ] },
    /* Camera — with crosshair (shot-tracking camera) */
    camera:   { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' } },
      { tag: 'circle',   attrs: { cx: 12, cy: 13, r: 4 } },
      { tag: 'path',     attrs: { d: 'M12 10.5v1M12 14.5v1M9.5 13h1M13.5 13h1', 'stroke-width': 1.2 } }
    ] },
    /* Play — angular, dynamic feel */
    play:     { style: 'fill',   nodes: [
      { tag: 'path',     attrs: { d: 'M6 4.5a1 1 0 0 1 1.5-.86l12 7.5a1 1 0 0 1 0 1.72l-12 7.5A1 1 0 0 1 6 19.5z' } }
    ] },
    /* Pause */
    pause:    { style: 'fill',   nodes: [
      { tag: 'rect',     attrs: { x: 6, y: 4, width: 4, height: 16, rx: 1 } },
      { tag: 'rect',     attrs: { x: 14, y: 4, width: 4, height: 16, rx: 1 } }
    ] },
    chevronRight: { style: 'stroke', nodes: [
      { tag: 'polyline', attrs: { points: '9 18 15 12 9 6' } }
    ] },
    x:        { style: 'stroke', nodes: [
      { tag: 'line',     attrs: { x1: 18, y1: 6, x2: 6, y2: 18 } },
      { tag: 'line',     attrs: { x1: 6, y1: 6, x2: 18, y2: 18 } }
    ] },
    /* Search — magnifying glass with basketball seam in lens */
    search:   { style: 'stroke', nodes: [
      { tag: 'circle',   attrs: { cx: 11, cy: 11, r: 7 } },
      { tag: 'path',     attrs: { d: 'M4 11h14' } },
      { tag: 'path',     attrs: { d: 'M11 4c-1 3-1 4 0 7s1 4 0 7', 'stroke-width': 1.2 } },
      { tag: 'line',     attrs: { x1: 16, y1: 16, x2: 21, y2: 21, 'stroke-width': 2 } }
    ] },
    /* Filter — funnel */
    filter:   { style: 'stroke', nodes: [
      { tag: 'polygon',  attrs: { points: '3 4 21 4 14 12 14 19 10 21 10 12' } }
    ] },
    /* Arrow up-right — fast break direction */
    arrowUpRight: { style: 'stroke', nodes: [
      { tag: 'line',     attrs: { x1: 7, y1: 17, x2: 17, y2: 7 } },
      { tag: 'polyline', attrs: { points: '10 7 17 7 17 14' } }
    ] },
    /* Plus — crosshair-style plus */
    plus:     { style: 'stroke', nodes: [
      { tag: 'line',     attrs: { x1: 12, y1: 5, x2: 12, y2: 19 } },
      { tag: 'line',     attrs: { x1: 5, y1: 12, x2: 19, y2: 12 } }
    ] },
    /* Check — swoosh-style checkmark */
    check:    { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M4 12.5l5.5 5.5L20 6', 'stroke-width': 2.2 } }
    ] },
    /* Info — basketball with i */
    info:     { style: 'stroke', nodes: [
      { tag: 'circle',   attrs: { cx: 12, cy: 12, r: 9 } },
      { tag: 'path',     attrs: { d: 'M12 11v5' } },
      { tag: 'circle',   attrs: { cx: 12, cy: 8, r: 0.8, fill: 'currentColor', stroke: 'none' } }
    ] },
    /* Alert — whistle alert triangle */
    alert:    { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M10.3 3.9a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3z' } },
      { tag: 'line',     attrs: { x1: 12, y1: 9, x2: 12, y2: 14 } },
      { tag: 'circle',   attrs: { cx: 12, cy: 17, r: 0.8, fill: 'currentColor', stroke: 'none' } }
    ] },
    /* Lock — padlock with keyhole */
    lock:     { style: 'stroke', nodes: [
      { tag: 'rect',     attrs: { x: 4, y: 11, width: 16, height: 10, rx: 2 } },
      { tag: 'path',     attrs: { d: 'M8 11V8a4 4 0 0 1 8 0v3' } },
      { tag: 'circle',   attrs: { cx: 12, cy: 16, r: 1.5, fill: 'currentColor', stroke: 'none' } }
    ] },
    /* Bell — game buzzer style */
    bell:     { style: 'stroke', nodes: [
      { tag: 'path',     attrs: { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' } },
      { tag: 'path',     attrs: { d: 'M13.7 21a2 2 0 0 1-3.4 0' } },
      { tag: 'circle',   attrs: { cx: 12, cy: 3, r: 1, fill: 'currentColor', stroke: 'none' } }
    ] }
  };

  /* ─── Factory ─────────────────────────────────────────────── */
  function makeIcon(name, opts) {
    var def = DEFS[name];
    if (!def) {
      // Fallback to a tiny placeholder square so callers don't blow up
      def = { style: 'stroke', nodes: [{ tag: 'rect', attrs: { x: 4, y: 4, width: 16, height: 16, rx: 2 } }] };
    }
    opts = opts || {};
    var size = opts.size || 22;
    var stroke = opts.stroke || 'currentColor';
    var fillOverride = opts.fill;

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (def.style === 'fill') {
      svg.setAttribute('fill', fillOverride || stroke);
      svg.setAttribute('stroke', 'none');
    } else {
      svg.setAttribute('fill', fillOverride || 'none');
      svg.setAttribute('stroke', stroke);
      svg.setAttribute('stroke-width', '1.75');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
    }
    if (opts.className) svg.setAttribute('class', 'ciq-ic ' + opts.className);
    else svg.setAttribute('class', 'ciq-ic');

    def.nodes.forEach(function (node) {
      var el = document.createElementNS(SVG_NS, node.tag);
      var a = node.attrs || {};
      for (var k in a) {
        if (Object.prototype.hasOwnProperty.call(a, k)) el.setAttribute(k, String(a[k]));
      }
      svg.appendChild(el);
    });

    return svg;
  }

  /* ─── Public API ──────────────────────────────────────────── */
  var ICONS = { create: makeIcon, has: function (n) { return Object.prototype.hasOwnProperty.call(DEFS, n); }, names: function () { return Object.keys(DEFS); } };
  Object.keys(DEFS).forEach(function (name) {
    ICONS[name] = function (opts) { return makeIcon(name, opts); };
  });

  window.ICONS = ICONS;
  window.CIQ_ICONS = ICONS; // alias for namespacing
})();
