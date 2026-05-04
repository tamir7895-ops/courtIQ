/* CourtIQ UI v2 — Heatmap (8.6)
 *
 * Renders a half-court SVG inside the Track tab showing 7 shooting
 * zones colored by per-zone make %. Persists shot history into a
 * 'courtiq-shot-history' localStorage key — populated by hooking the
 * existing ShotDetectionEngine.onShotDetected callback. The hook is
 * additive (chain-call): it preserves whatever ShotTrackingScreen.js
 * already did and only adds a write to localStorage.
 *
 * Reads from window.ShotDetectionEngine when available; falls back to
 * stat tile counters if the engine isn't initialized yet.
 *
 * Zone-tile tap (in track-zones.js) highlights the matching SVG zone
 * via shared 'ciq-zone-active' state on body.
 *
 * Built with createElementNS — no innerHTML.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRACK_HEATMAP) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var COURT_W = 500;
  var COURT_H = 470;

  /* ── Zone definitions ─────────────────────────────────────
   * Coordinate system: 500×470 viewBox, baseline at bottom (y=470),
   * basket center at (250, 30). 7 zones approximating shot chart areas. */
  var ZONES = [
    { id: 'paint',     name: 'Paint',        path: 'M 190 10 L 310 10 L 310 100 L 190 100 Z' },
    { id: 'mid-l',     name: 'Mid-Range L',  path: 'M 60 10 L 190 10 L 190 200 L 60 200 Z' },
    { id: 'mid-r',     name: 'Mid-Range R',  path: 'M 310 10 L 440 10 L 440 200 L 310 200 Z' },
    { id: 'top',       name: 'Top of Key',   path: 'M 190 100 L 310 100 L 310 230 L 190 230 Z' },
    { id: 'three-l',   name: 'Three L',      path: 'M 0 200 L 60 200 L 60 460 L 0 460 Z' },
    { id: 'three-c',   name: 'Three Center', path: 'M 60 230 L 440 230 L 440 460 L 60 460 Z' },
    { id: 'three-r',   name: 'Three R',      path: 'M 440 200 L 500 200 L 500 460 L 440 460 Z' }
  ];

  function attr(node, attrs) {
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function buildCourtSvg() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    attr(svg, { viewBox: '0 0 ' + COURT_W + ' ' + COURT_H, role: 'img', 'aria-label': 'Half court heatmap', class: 'ciq-heatmap-svg' });

    // Outer baseline
    var base = document.createElementNS(SVG_NS, 'rect');
    attr(base, { x: '0', y: '0', width: COURT_W, height: COURT_H, class: 'ciq-court-line', rx: '4' });
    svg.appendChild(base);

    // Free throw lane (the key)
    var key = document.createElementNS(SVG_NS, 'rect');
    attr(key, { x: '190', y: '0', width: '120', height: '230', class: 'ciq-court-key' });
    svg.appendChild(key);
    var keyOutline = document.createElementNS(SVG_NS, 'rect');
    attr(keyOutline, { x: '190', y: '0', width: '120', height: '230', class: 'ciq-court-line' });
    svg.appendChild(keyOutline);

    // Free throw arc
    var ftArc = document.createElementNS(SVG_NS, 'path');
    attr(ftArc, { d: 'M 190 230 A 60 60 0 0 0 310 230', class: 'ciq-court-line' });
    svg.appendChild(ftArc);

    // Three-point line (semicircle approximating)
    var threeLine = document.createElementNS(SVG_NS, 'path');
    attr(threeLine, { d: 'M 60 0 L 60 200 A 190 190 0 0 0 440 200 L 440 0', class: 'ciq-court-line' });
    svg.appendChild(threeLine);

    // Restricted-area arc
    var ra = document.createElementNS(SVG_NS, 'path');
    attr(ra, { d: 'M 210 0 A 40 40 0 0 0 290 0', class: 'ciq-court-line' });
    svg.appendChild(ra);

    // Rim
    var rim = document.createElementNS(SVG_NS, 'circle');
    attr(rim, { cx: '250', cy: '20', r: '12', class: 'ciq-court-rim' });
    svg.appendChild(rim);

    // Add zones (interactive)
    var zoneGroup = document.createElementNS(SVG_NS, 'g');
    zoneGroup.setAttribute('class', 'ciq-court-zones');
    ZONES.forEach(function (z) {
      var p = document.createElementNS(SVG_NS, 'path');
      attr(p, { d: z.path, class: 'ciq-court-zone', 'data-zone-id': z.id });
      p.setAttribute('aria-label', z.name);
      p.addEventListener('click', function () { highlightZone(z.id); });
      zoneGroup.appendChild(p);
    });
    svg.appendChild(zoneGroup);

    return svg;
  }

  function highlightZone(zoneId) {
    document.querySelectorAll('.ciq-court-zone').forEach(function (n) { n.classList.toggle('active', n.getAttribute('data-zone-id') === zoneId); });
    document.querySelectorAll('.ciq-zone-tile').forEach(function (n) { n.classList.toggle('active', n.getAttribute('data-zone-id') === zoneId); });
    updateSidebar(zoneId);
    try { document.dispatchEvent(new CustomEvent('ciq:zone-active', { detail: { zoneId: zoneId } })); } catch (_) {}
  }

  /* ── Shot history persistence ────────────────────────────── */
  var LS_KEY = 'courtiq-shot-history';
  function loadHistory() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveHistory(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(-1000))); } catch (e) {}
  }

  /* Hook the engine's callback once it's available — additive chain. */
  function hookEngine() {
    if (!window.ShotDetectionEngine) {
      setTimeout(hookEngine, 800);
      return;
    }
    if (window.ShotDetectionEngine.__ciqHooked) return;
    var prev = window.ShotDetectionEngine.onShotDetected;
    window.ShotDetectionEngine.onShotDetected = function (shotData) {
      try {
        var entry = {
          ts: Date.now(),
          made: shotData && shotData.result === 'made',
          zone: (shotData && shotData.zone) || guessZone(shotData),
          x: shotData && shotData.x,
          y: shotData && shotData.y
        };
        var hist = loadHistory();
        hist.push(entry);
        saveHistory(hist);
        recolorZones();
      } catch (e) { /* silent */ }
      if (typeof prev === 'function') {
        try { prev.apply(this, arguments); } catch (e) {}
      }
    };
    window.ShotDetectionEngine.__ciqHooked = true;
  }

  function guessZone(shotData) {
    // No coordinates yet — best-effort based on type/distance.
    if (!shotData) return 'top';
    if (shotData.type === '3pt') return 'three-c';
    if (shotData.type === 'paint') return 'paint';
    return 'top';
  }

  /* ── Recolor zones based on history ──────────────────────── */
  function aggregateByZone() {
    var hist = loadHistory();
    var totals = {};
    ZONES.forEach(function (z) { totals[z.id] = { made: 0, att: 0 }; });
    hist.forEach(function (e) {
      var t = totals[e.zone];
      if (!t) return;
      t.att += 1;
      if (e.made) t.made += 1;
    });
    return totals;
  }

  function classifyPct(pct, attempts) {
    if (attempts < 3) return ''; // not enough data
    if (pct >= 50) return 'hot';
    if (pct >= 30) return 'warm';
    return 'cold';
  }

  function recolorZones() {
    var totals = aggregateByZone();
    document.querySelectorAll('.ciq-court-zone').forEach(function (n) {
      var id = n.getAttribute('data-zone-id');
      var t = totals[id] || { made: 0, att: 0 };
      var pct = t.att > 0 ? (t.made / t.att) * 100 : 0;
      n.classList.remove('hot', 'warm', 'cold');
      var cls = classifyPct(pct, t.att);
      if (cls) n.classList.add(cls);
    });
    document.querySelectorAll('.ciq-zone-tile').forEach(function (n) {
      var id = n.getAttribute('data-zone-id');
      var t = totals[id] || { made: 0, att: 0 };
      var pct = t.att > 0 ? Math.round((t.made / t.att) * 100) : 0;
      var pctEl = n.querySelector('.pct');
      var ratioEl = n.querySelector('.ratio');
      if (pctEl) pctEl.textContent = t.att > 0 ? (pct + '%') : '—';
      if (ratioEl) ratioEl.textContent = t.made + '/' + t.att;
      n.classList.remove('hot', 'warm', 'cold');
      var cls = classifyPct(pct, t.att);
      if (cls) n.classList.add(cls);
    });
    var emptyEl = document.querySelector('.ciq-heatmap-empty');
    var totalAtt = Object.keys(totals).reduce(function (sum, k) { return sum + totals[k].att; }, 0);
    if (emptyEl) emptyEl.style.display = totalAtt === 0 ? 'block' : 'none';
    updateTotals();
  }

  /* ── Mount ───────────────────────────────────────────────── */
  function mount(screen) {
    if (screen.querySelector('.ciq-heatmap-block')) return;
    var block = document.createElement('section');
    block.className = 'ciq-heatmap-block';
    block.setAttribute('aria-label', 'Shot Heatmap');

    var head = document.createElement('div');
    head.className = 'ciq-heatmap-head';
    var eb = document.createElement('div');
    eb.className = 'eyebrow';
    eb.textContent = 'Shot Heatmap';
    var src = document.createElement('div');
    src.className = 'source';
    src.textContent = 'YOLOX-tiny v6';
    head.appendChild(eb);
    head.appendChild(src);
    block.appendChild(head);

    var card = document.createElement('div');
    card.className = 'ciq-heatmap-card';

    /* Two-column body: court SVG + active-zone KPI sidebar */
    var body = document.createElement('div');
    body.className = 'ciq-heatmap-body';
    body.appendChild(buildCourtSvg());

    var side = document.createElement('aside');
    side.className = 'ciq-heatmap-side';
    var sideTop = document.createElement('div');
    var sideEyebrow = document.createElement('div');
    sideEyebrow.className = 'ciq-heatmap-side-eyebrow';
    sideEyebrow.textContent = 'Active Zone';
    var sideZone = document.createElement('div');
    sideZone.className = 'ciq-heatmap-side-zone';
    sideZone.textContent = 'Tap a zone';
    sideTop.appendChild(sideEyebrow);
    sideTop.appendChild(sideZone);
    side.appendChild(sideTop);

    var sideBottom = document.createElement('div');
    var sidePct = document.createElement('div');
    sidePct.className = 'ciq-heatmap-side-pct empty';
    sidePct.textContent = '—';
    var sideAtt = document.createElement('div');
    sideAtt.className = 'ciq-heatmap-side-att';
    sideAtt.textContent = '0 of 0';
    sideBottom.appendChild(sidePct);
    sideBottom.appendChild(sideAtt);
    side.appendChild(sideBottom);

    body.appendChild(side);
    card.appendChild(body);

    /* Footer: legend + total attempts */
    var foot = document.createElement('div');
    foot.className = 'ciq-heatmap-foot';
    var legend = document.createElement('div');
    legend.className = 'ciq-heatmap-legend';
    [['cold','Cold'], ['warm','Warm'], ['hot','Hot']].forEach(function (pair) {
      var s = document.createElement('span');
      s.className = pair[0];
      s.textContent = pair[1];
      legend.appendChild(s);
    });
    foot.appendChild(legend);

    var totals = document.createElement('div');
    totals.className = 'ciq-heatmap-totals';
    var totB = document.createElement('b');
    totB.textContent = '0';
    var totSuf = document.createTextNode(' shots tracked');
    totals.appendChild(totB);
    totals.appendChild(totSuf);
    foot.appendChild(totals);
    card.appendChild(foot);

    /* Empty banner — slim, secondary */
    var empty = document.createElement('div');
    empty.className = 'ciq-heatmap-empty';
    empty.textContent = 'Take a few shots and your heat bands light up by zone.';
    card.appendChild(empty);

    block.appendChild(card);
    screen.appendChild(block);
  }

  /* ── Active-zone sidebar update ──────────────────────────── */
  function updateSidebar(zoneId) {
    var side = document.querySelector('.ciq-heatmap-side');
    if (!side) return;
    var zone = ZONES.find(function (z) { return z.id === zoneId; });
    var t = aggregateByZone()[zoneId] || { made: 0, att: 0 };
    var nameEl = side.querySelector('.ciq-heatmap-side-zone');
    var pctEl  = side.querySelector('.ciq-heatmap-side-pct');
    var attEl  = side.querySelector('.ciq-heatmap-side-att');
    if (nameEl) nameEl.textContent = zone ? zone.name : 'Tap a zone';
    if (t.att > 0) {
      var p = Math.round((t.made / t.att) * 100);
      var cls = classifyPct(p, t.att) || '';
      if (pctEl) {
        pctEl.classList.remove('cold', 'warm', 'empty');
        if (cls === 'cold' || cls === 'warm') pctEl.classList.add(cls);
        pctEl.textContent = p + '%';
      }
      if (attEl) attEl.textContent = t.made + ' of ' + t.att;
    } else {
      if (pctEl) {
        pctEl.classList.remove('cold', 'warm');
        pctEl.classList.add('empty');
        pctEl.textContent = '—';
      }
      if (attEl) attEl.textContent = zone ? 'No shots yet' : 'Tap a zone';
    }
  }

  /* Update totals in the foot row */
  function updateTotals() {
    var totalsEl = document.querySelector('.ciq-heatmap-totals b');
    if (!totalsEl) return;
    var totals = aggregateByZone();
    var totalAtt = Object.keys(totals).reduce(function (sum, k) { return sum + totals[k].att; }, 0);
    totalsEl.textContent = String(totalAtt);
  }

  function init() {
    var screen = document.getElementById('ciq-track-screen');
    if (!screen) {
      setTimeout(init, 200);
      return;
    }
    mount(screen);
    hookEngine();
    recolorZones();
    // Periodic refresh so cross-module updates are reflected
    setInterval(recolorZones, 3500);

    window.CIQ_HEATMAP = {
      ZONES: ZONES,
      reload: recolorZones,
      highlightZone: highlightZone,
      _testAddShot: function (zoneId, made) {
        var hist = loadHistory();
        hist.push({ ts: Date.now(), zone: zoneId, made: !!made });
        saveHistory(hist);
        recolorZones();
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
