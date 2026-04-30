/* ============================================================
   heatmapGenerator.js — Shot Chart / Heatmap Builder
   Generates data structures for rendering a shot chart on a
   half-court diagram. Takes normalized shot positions (0-1)
   and maps them to court coordinates.
   ============================================================ */
(function () {
  'use strict';

  var COURT_WIDTH = 500;
  var COURT_HEIGHT = 470;
  var RIM_X = COURT_WIDTH / 2;
  var RIM_Y = 63;
  var THREE_PT_RADIUS = 190;
  var DOT_RADIUS_MADE = 6;
  var DOT_RADIUS_MISSED = 5;

  var ZONE_COLORS = {
    paint: '#ff4444',
    midrange: '#ffaa00',
    threePoint: '#4da6ff',
    freeThrow: '#ba68c8'
  };

  function generateShotChartData(shots) {
    return shots.map(function (shot) {
      var posX = shot.launch_x !== undefined ? shot.launch_x : shot.shot_x;
      var posY = shot.launch_y !== undefined ? shot.launch_y : shot.shot_y;
      var courtX = 50 + posX * (COURT_WIDTH - 100);
      var courtY = RIM_Y + (1 - posY) * (COURT_HEIGHT - RIM_Y - 40);
      var isMade = shot.shot_result === 'made';
      var zone = shot.shot_zone || 'midrange';
      var zoneColor = ZONE_COLORS[zone] || ZONE_COLORS.midrange;

      return {
        x: courtX,
        y: courtY,
        result: shot.shot_result,
        shotZone: zone,
        color: zoneColor,
        radius: isMade ? DOT_RADIUS_MADE : DOT_RADIUS_MISSED,
        opacity: isMade ? 0.9 : 0.4
      };
    });
  }

  function generateHeatmapGrid(shots, gridCols, gridRows) {
    gridCols = gridCols || 10;
    gridRows = gridRows || 10;
    var cellW = COURT_WIDTH / gridCols;
    var cellH = COURT_HEIGHT / gridRows;
    var grid = [];

    for (var row = 0; row < gridRows; row++) {
      for (var col = 0; col < gridCols; col++) {
        grid.push({ x: col * cellW, y: row * cellH, width: cellW, height: cellH, total: 0, made: 0, intensity: 0 });
      }
    }

    for (var i = 0; i < shots.length; i++) {
      var shot = shots[i];
      var posX = shot.launch_x !== undefined ? shot.launch_x : shot.shot_x;
      var posY = shot.launch_y !== undefined ? shot.launch_y : shot.shot_y;
      var courtX = 50 + posX * (COURT_WIDTH - 100);
      var courtY = RIM_Y + (1 - posY) * (COURT_HEIGHT - RIM_Y - 40);
      var c = Math.min(Math.floor(courtX / cellW), gridCols - 1);
      var r = Math.min(Math.floor(courtY / cellH), gridRows - 1);
      var idx = r * gridCols + c;
      grid[idx].total++;
      if (shot.shot_result === 'made') grid[idx].made++;
    }

    var maxTotal = 1;
    for (var j = 0; j < grid.length; j++) { if (grid[j].total > maxTotal) maxTotal = grid[j].total; }
    for (var k = 0; k < grid.length; k++) { grid[k].intensity = grid[k].total / maxTotal; }

    return grid.filter(function (c) { return c.total > 0; });
  }

  function getHeatmapColor(made, total) {
    if (total === 0) return 'rgba(0,0,0,0)';
    var ratio = made / total;
    var intensity = Math.min(total / 5, 1);
    if (ratio >= 0.6) return 'rgba(0, 255, 136, ' + (0.2 + intensity * 0.5) + ')';
    if (ratio >= 0.4) return 'rgba(255, 170, 0, ' + (0.2 + intensity * 0.5) + ')';
    return 'rgba(255, 68, 68, ' + (0.2 + intensity * 0.5) + ')';
  }

  function getCourtPaths() {
    return {
      boundary: 'M 0 0 L ' + COURT_WIDTH + ' 0 L ' + COURT_WIDTH + ' ' + COURT_HEIGHT + ' L 0 ' + COURT_HEIGHT + ' Z',
      threePointArc: 'M 30 0 L 30 ' + (RIM_Y + 80) + ' A ' + THREE_PT_RADIUS + ' ' + THREE_PT_RADIUS + ' 0 0 0 ' + (COURT_WIDTH - 30) + ' ' + (RIM_Y + 80) + ' L ' + (COURT_WIDTH - 30) + ' 0',
      paint: 'M ' + (RIM_X - 60) + ' 0 L ' + (RIM_X - 60) + ' ' + (RIM_Y + 150) + ' L ' + (RIM_X + 60) + ' ' + (RIM_Y + 150) + ' L ' + (RIM_X + 60) + ' 0',
      ftCircle: { cx: RIM_X, cy: RIM_Y + 150, r: 60 },
      rim: { cx: RIM_X, cy: RIM_Y, r: 12 },
      backboard: 'M ' + (RIM_X - 30) + ' ' + (RIM_Y - 10) + ' L ' + (RIM_X + 30) + ' ' + (RIM_Y - 10),
      viewBox: '0 0 ' + COURT_WIDTH + ' ' + COURT_HEIGHT,
      width: COURT_WIDTH,
      height: COURT_HEIGHT
    };
  }

  function getShotDistribution(shots) {
    var zones = {
      paint: { made: 0, total: 0, label: 'Paint', color: '#ff4444' },
      midrange: { made: 0, total: 0, label: 'Mid-Range', color: '#ffaa00' },
      threePoint: { made: 0, total: 0, label: '3-Point', color: '#4da6ff' },
      freeThrow: { made: 0, total: 0, label: 'Free Throw', color: '#ba68c8' }
    };

    for (var i = 0; i < shots.length; i++) {
      var shot = shots[i];
      var zone = shot.shot_zone;
      if (!zone || !zones[zone]) {
        var distance = 1 - (shot.shot_y || 0);
        if (distance < 0.3) zone = 'paint';
        else if (distance < 0.6) zone = 'midrange';
        else zone = 'threePoint';
      }
      zones[zone].total++;
      if (shot.shot_result === 'made') zones[zone].made++;
    }

    var hotZone = '', coldZone = '', bestPct = -1, worstPct = 101;
    var zoneKeys = Object.keys(zones);
    for (var j = 0; j < zoneKeys.length; j++) {
      var z = zones[zoneKeys[j]];
      if (z.total === 0) continue;
      var pct = (z.made / z.total) * 100;
      if (pct > bestPct) { bestPct = pct; hotZone = z.label; }
      if (pct < worstPct) { worstPct = pct; coldZone = z.label; }
    }

    return { zones: zones, hotZone: hotZone, coldZone: coldZone };
  }

  window.HeatmapUtils = {
    generateShotChartData: generateShotChartData,
    generateHeatmapGrid: generateHeatmapGrid,
    getHeatmapColor: getHeatmapColor,
    getCourtPaths: getCourtPaths,
    getShotDistribution: getShotDistribution,
    ZONE_COLORS: ZONE_COLORS
  };
})();
