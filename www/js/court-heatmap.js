/* ============================================================
   COURT HEATMAP — js/court-heatmap.js
   Interactive SVG basketball court shot chart.
   Renders shot dots + heatmap grid with filter controls.
   Uses HeatmapUtils from heatmapGenerator.js.
   ============================================================ */
(function () {
  'use strict';

  var LS_POSITIONS = 'courtiq-shot-positions';

  /* ── Load shot positions from localStorage ─────────────── */
  function loadPositions() {
    try {
      var raw = localStorage.getItem(LS_POSITIONS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  /* ── Save shot positions ───────────────────────────────── */
  function savePosition(shot) {
    var positions = loadPositions();
    positions.push({
      shot_x: shot.shotX || shot.shot_x || 0.5,
      shot_y: shot.shotY || shot.shot_y || 0.5,
      launch_x: shot.launchPoint ? shot.launchPoint.x : undefined,
      launch_y: shot.launchPoint ? shot.launchPoint.y : undefined,
      shot_result: shot.result || shot.shot_result || 'missed',
      shot_zone: shot.shotZone || shot.shot_zone || 'midrange',
      date: shot.timestamp ? new Date(shot.timestamp).toISOString() : new Date().toISOString()
    });
    if (positions.length > 500) positions = positions.slice(-500);
    try { localStorage.setItem(LS_POSITIONS, JSON.stringify(positions)); } catch (e) {}
  }

  /* ── Helper: create SVG element ────────────────────────── */
  function svgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) { Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); }); }
    return el;
  }

  /* ── Build SVG court (DOM API, no innerHTML) ───────────── */
  function buildCourtSVG(container) {
    if (typeof HeatmapUtils === 'undefined') {
      var msg = document.createElement('div');
      msg.style.cssText = 'color:var(--c-muted);text-align:center;padding:40px;';
      msg.textContent = 'Shot chart unavailable';
      container.appendChild(msg);
      return null;
    }

    var paths = HeatmapUtils.getCourtPaths();
    var lineColor = 'rgba(255,255,255,0.15)';

    var svg = svgEl('svg', { viewBox: paths.viewBox, class: 'ch-court-svg', xmlns: 'http://www.w3.org/2000/svg' });
    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: paths.width, height: paths.height, fill: 'rgba(255,255,255,0.06)', rx: '4' }));
    svg.appendChild(svgEl('path', { d: paths.boundary, fill: 'none', stroke: lineColor, 'stroke-width': '2' }));
    svg.appendChild(svgEl('path', { d: paths.threePointArc, fill: 'none', stroke: lineColor, 'stroke-width': '1.5' }));
    svg.appendChild(svgEl('path', { d: paths.paint, fill: 'rgba(255,255,255,0.03)', stroke: lineColor, 'stroke-width': '1' }));
    svg.appendChild(svgEl('circle', { cx: paths.ftCircle.cx, cy: paths.ftCircle.cy, r: paths.ftCircle.r, fill: 'none', stroke: lineColor, 'stroke-width': '1', 'stroke-dasharray': '4 4' }));
    svg.appendChild(svgEl('path', { d: paths.backboard, stroke: lineColor, 'stroke-width': '2', fill: 'none' }));
    svg.appendChild(svgEl('circle', { cx: paths.rim.cx, cy: paths.rim.cy, r: paths.rim.r, fill: 'none', stroke: '#f5a623', 'stroke-width': '2' }));

    var dotsLayer = svgEl('g', { id: 'ch-dots-layer' });
    var heatLayer = svgEl('g', { id: 'ch-heat-layer' });
    svg.appendChild(heatLayer);
    svg.appendChild(dotsLayer);

    return svg;
  }

  /* ── Render dots/heat on the court ─────────────────────── */
  function renderDots(container, shots, filter) {
    var dotsLayer = container.querySelector('#ch-dots-layer');
    var heatLayer = container.querySelector('#ch-heat-layer');
    if (!dotsLayer || !heatLayer) return;

    while (dotsLayer.firstChild) dotsLayer.removeChild(dotsLayer.firstChild);
    while (heatLayer.firstChild) heatLayer.removeChild(heatLayer.firstChild);

    var filtered = shots.slice();
    if (filter.result && filter.result !== 'all') {
      filtered = filtered.filter(function (s) { return s.shot_result === filter.result; });
    }
    if (filter.zone && filter.zone !== 'all') {
      filtered = filtered.filter(function (s) { return (s.shot_zone || 'midrange') === filter.zone; });
    }
    if (filter.timeRange && filter.timeRange !== 'all') {
      var now = Date.now();
      var ms = filter.timeRange === 'week' ? 7 * 86400000 : 30 * 86400000;
      filtered = filtered.filter(function (s) { return s.date && (now - new Date(s.date).getTime()) < ms; });
    }

    if (filter.mode === 'heat') {
      var grid = HeatmapUtils.generateHeatmapGrid(filtered);
      for (var i = 0; i < grid.length; i++) {
        var cell = grid[i];
        var color = HeatmapUtils.getHeatmapColor(cell.made, cell.total);
        heatLayer.appendChild(svgEl('rect', { x: cell.x, y: cell.y, width: cell.width, height: cell.height, fill: color, rx: '3' }));
      }
    } else {
      var chartData = HeatmapUtils.generateShotChartData(filtered);
      for (var j = 0; j < chartData.length; j++) {
        var dot = chartData[j];
        var attrs = { cx: dot.x, cy: dot.y, r: dot.radius, class: 'ch-shot-dot' };
        if (dot.result === 'missed') {
          attrs.fill = 'none';
          attrs.stroke = dot.color;
          attrs['stroke-width'] = '1.5';
          attrs.opacity = dot.opacity;
        } else {
          attrs.fill = dot.color;
          attrs.opacity = dot.opacity;
        }
        dotsLayer.appendChild(svgEl('circle', attrs));
      }
    }

    renderStats(container, filtered);
  }

  /* ── Stats bar (safe DOM) ──────────────────────────────── */
  function renderStats(container, shots) {
    var statsEl = container.querySelector('.ch-stats');
    if (!statsEl) return;
    while (statsEl.firstChild) statsEl.removeChild(statsEl.firstChild);

    var dist = HeatmapUtils.getShotDistribution(shots);
    var total = shots.length;
    var made = shots.filter(function (s) { return s.shot_result === 'made'; }).length;
    var pct = total > 0 ? Math.round((made / total) * 100) : 0;

    var stats = [
      { val: String(total), lbl: 'Total Shots', color: '' },
      { val: pct + '%', lbl: 'Accuracy', color: '#56d364' },
      { val: dist.hotZone || '\u2014', lbl: 'Hot Zone', color: '#56d364' },
      { val: dist.coldZone || '\u2014', lbl: 'Cold Zone', color: '#f85149' }
    ];

    stats.forEach(function (s) {
      var div = document.createElement('div');
      div.className = 'ch-stat';
      var valSpan = document.createElement('span');
      valSpan.className = 'ch-stat-val';
      if (s.color) valSpan.style.color = s.color;
      valSpan.textContent = s.val;
      var lblSpan = document.createElement('span');
      lblSpan.className = 'ch-stat-lbl';
      lblSpan.textContent = s.lbl;
      div.appendChild(valSpan);
      div.appendChild(lblSpan);
      statsEl.appendChild(div);
    });
  }

  /* ── Build filter buttons (safe DOM) ───────────────────── */
  function buildFilters(container, filter, shots) {
    var filtersDiv = document.createElement('div');
    filtersDiv.className = 'ch-filters';

    var groups = [
      { key: 'mode', items: [{ val: 'dots', lbl: 'Dots' }, { val: 'heat', lbl: 'Heatmap' }] },
      { key: 'result', items: [{ val: 'all', lbl: 'All' }, { val: 'made', lbl: 'Made', color: '#56d364' }, { val: 'missed', lbl: 'Missed', color: '#f85149' }] },
      { key: 'time', items: [{ val: 'all', lbl: 'All Time' }, { val: 'month', lbl: 'Month' }, { val: 'week', lbl: 'Week' }] }
    ];

    groups.forEach(function (group) {
      var groupDiv = document.createElement('div');
      groupDiv.className = 'ch-filter-group';
      group.items.forEach(function (item) {
        var btn = document.createElement('button');
        btn.className = 'ch-filter-btn';
        btn.textContent = item.lbl;
        if (item.color) btn.style.color = item.color;

        var isActive = (group.key === 'mode' && filter.mode === item.val) ||
                       (group.key === 'result' && filter.result === item.val) ||
                       (group.key === 'time' && filter.timeRange === item.val);
        if (isActive) btn.classList.add('active');

        btn.addEventListener('click', function () {
          if (group.key === 'mode') filter.mode = item.val;
          if (group.key === 'result') filter.result = item.val;
          if (group.key === 'time') filter.timeRange = item.val;
          groupDiv.querySelectorAll('.ch-filter-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          renderDots(container, shots, filter);
        });
        groupDiv.appendChild(btn);
      });
      filtersDiv.appendChild(groupDiv);
    });

    return filtersDiv;
  }

  /* ── Main render ───────────────────────────────────────── */
  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    var shots = loadPositions();
    var filter = { mode: 'dots', result: 'all', zone: 'all', timeRange: 'all' };

    container.appendChild(buildFilters(container, filter, shots));

    var courtWrap = document.createElement('div');
    courtWrap.className = 'ch-court-wrap';
    var svg = buildCourtSVG(courtWrap);
    if (svg) courtWrap.appendChild(svg);
    container.appendChild(courtWrap);

    if (shots.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'ch-empty';
      empty.textContent = 'No shot data yet. Use the AI Shot Tracker to record shots.';
      courtWrap.appendChild(empty);
    }

    var statsDiv = document.createElement('div');
    statsDiv.className = 'ch-stats';
    container.appendChild(statsDiv);

    renderDots(container, shots, filter);
  }

  window.CourtHeatmap = {
    render: render,
    savePosition: savePosition,
    loadPositions: loadPositions
  };
  if (typeof CourtIQ !== 'undefined') CourtIQ.register('CourtHeatmap', window.CourtHeatmap);
})();
