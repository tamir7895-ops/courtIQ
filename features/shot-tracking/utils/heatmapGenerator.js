/**
 * heatmapGenerator.js — Shot Chart / Heatmap Builder
 *
 * Generates data structures for rendering a shot chart on a half-court diagram.
 * Takes normalized shot positions (0–1) and maps them to court coordinates.
 *
 * The heatmap can be rendered using React Native SVG or Canvas.
 * This utility just prepares the data — rendering is in SessionSummary.
 */

// Half-court dimensions (proportional, used for mapping)
const COURT_WIDTH = 500; // SVG viewBox width
const COURT_HEIGHT = 470; // SVG viewBox height

// Rim position on the court diagram (pixels in SVG space)
const RIM_X = COURT_WIDTH / 2; // Center of court
const RIM_Y = 63; // Near the top of the half-court diagram

// Three-point arc radius (approximate in SVG units)
const THREE_PT_RADIUS = 190;

// Shot dot sizes
const DOT_RADIUS_MADE = 6;
const DOT_RADIUS_MISSED = 5;

/**
 * @typedef {Object} ShotDot
 * @property {number} x         - X position on court SVG
 * @property {number} y         - Y position on court SVG
 * @property {string} result    - 'made' | 'missed'
 * @property {string} color     - Hex color for rendering
 * @property {number} radius    - Dot radius
 * @property {number} opacity   - Dot opacity
 */

/**
 * Convert normalized shot positions to court diagram coordinates.
 *
 * Mapping logic:
 *  - shot_x (0–1): lateral position → maps to court width
 *  - shot_y (0–1): distance from basket → maps to court depth
 *    (0 = far from basket/3PT, 1 = under basket)
 *
 * @param {Array<Object>} shots - Array of { shot_x, shot_y, shot_result }
 * @returns {Array<ShotDot>}
 */
export function generateShotChartData(shots) {
  return shots.map((shot) => {
    // Use launch point (where player shot from) if available, otherwise fall back to shot position
    const posX = shot.launch_x !== undefined ? shot.launch_x : shot.shot_x;
    const posY = shot.launch_y !== undefined ? shot.launch_y : shot.shot_y;

    // Map normalized coords to court SVG coords
    const courtX = 50 + posX * (COURT_WIDTH - 100);

    // Y: 0 = 3PT line area, 1 = under basket
    const courtY = RIM_Y + (1 - posY) * (COURT_HEIGHT - RIM_Y - 40);

    const isMade = shot.shot_result === 'made';

    return {
      x: courtX,
      y: courtY,
      result: shot.shot_result,
      shotZone: shot.shot_zone || null,
      color: isMade ? '#00ff88' : '#ff4444',
      radius: isMade ? DOT_RADIUS_MADE : DOT_RADIUS_MISSED,
      opacity: isMade ? 0.9 : 0.6,
    };
  });
}

/**
 * Generate heatmap zones for a density visualization.
 * Divides the court into a grid and counts shots per cell.
 *
 * @param {Array<Object>} shots - Array of { shot_x, shot_y, shot_result }
 * @param {number} gridCols - Grid columns (default 10)
 * @param {number} gridRows - Grid rows (default 10)
 * @returns {Array<{ x, y, width, height, total, made, intensity }>}
 */
export function generateHeatmapGrid(shots, gridCols = 10, gridRows = 10) {
  const cellW = COURT_WIDTH / gridCols;
  const cellH = COURT_HEIGHT / gridRows;
  const grid = [];

  // Initialize grid
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      grid.push({
        x: col * cellW,
        y: row * cellH,
        width: cellW,
        height: cellH,
        total: 0,
        made: 0,
        intensity: 0,
      });
    }
  }

  // Count shots per cell (use launch point if available)
  for (const shot of shots) {
    const posX = shot.launch_x !== undefined ? shot.launch_x : shot.shot_x;
    const posY = shot.launch_y !== undefined ? shot.launch_y : shot.shot_y;
    const courtX = 50 + posX * (COURT_WIDTH - 100);
    const courtY = RIM_Y + (1 - posY) * (COURT_HEIGHT - RIM_Y - 40);

    const col = Math.min(Math.floor(courtX / cellW), gridCols - 1);
    const row = Math.min(Math.floor(courtY / cellH), gridRows - 1);
    const idx = row * gridCols + col;

    grid[idx].total++;
    if (shot.shot_result === 'made') {
      grid[idx].made++;
    }
  }

  // Calculate intensity (0–1) based on max shots in any cell
  const maxTotal = Math.max(...grid.map((c) => c.total), 1);
  for (const cell of grid) {
    cell.intensity = cell.total / maxTotal;
  }

  return grid.filter((c) => c.total > 0); // Only return cells with shots
}

/**
 * Get the color for a heatmap cell based on made/total ratio.
 *
 * @param {number} made
 * @param {number} total
 * @returns {string} RGBA color string
 */
export function getHeatmapColor(made, total) {
  if (total === 0) return 'rgba(0,0,0,0)';

  const ratio = made / total;
  const intensity = Math.min(total / 5, 1); // Opacity scales with volume

  // Red (cold) → Yellow (warm) → Green (hot)
  if (ratio >= 0.6) {
    return `rgba(0, 255, 136, ${0.2 + intensity * 0.5})`; // Green
  } else if (ratio >= 0.4) {
    return `rgba(255, 170, 0, ${0.2 + intensity * 0.5})`; // Yellow/Amber
  } else {
    return `rgba(255, 68, 68, ${0.2 + intensity * 0.5})`; // Red
  }
}

/**
 * Generate the SVG path data for a half-court outline.
 * Returns an array of path descriptions for rendering.
 */
export function getCourtPaths() {
  return {
    // Outer boundary
    boundary: `M 0 0 L ${COURT_WIDTH} 0 L ${COURT_WIDTH} ${COURT_HEIGHT} L 0 ${COURT_HEIGHT} Z`,

    // Three-point arc
    threePointArc: `M 30 0 L 30 ${RIM_Y + 80} A ${THREE_PT_RADIUS} ${THREE_PT_RADIUS} 0 0 0 ${COURT_WIDTH - 30} ${RIM_Y + 80} L ${COURT_WIDTH - 30} 0`,

    // Paint/key rectangle
    paint: `M ${RIM_X - 60} 0 L ${RIM_X - 60} ${RIM_Y + 150} L ${RIM_X + 60} ${RIM_Y + 150} L ${RIM_X + 60} 0`,

    // Free throw circle
    ftCircle: {
      cx: RIM_X,
      cy: RIM_Y + 150,
      r: 60,
    },

    // Rim
    rim: {
      cx: RIM_X,
      cy: RIM_Y,
      r: 12,
    },

    // Backboard
    backboard: `M ${RIM_X - 30} ${RIM_Y - 10} L ${RIM_X + 30} ${RIM_Y - 10}`,

    // Court dimensions for external use
    viewBox: `0 0 ${COURT_WIDTH} ${COURT_HEIGHT}`,
    width: COURT_WIDTH,
    height: COURT_HEIGHT,
  };
}

/**
 * Calculate shot distribution stats for the summary.
 *
 * @param {Array<ShotDot>} chartDots
 * @returns {{ zones: Object, hotZone: string, coldZone: string }}
 */
export function getShotDistribution(shots) {
  const zones = {
    paint: { made: 0, total: 0, label: 'Paint' },
    midrange: { made: 0, total: 0, label: 'Mid-Range' },
    threePoint: { made: 0, total: 0, label: '3-Point' },
  };

  for (const shot of shots) {
    let zone;
    if (shot.shot_zone && ['paint', 'midrange', 'threePoint'].includes(shot.shot_zone)) {
      zone = shot.shot_zone;
    } else {
      // Legacy fallback
      const distance = 1 - shot.shot_y;
      if (distance < 0.3) zone = 'paint';
      else if (distance < 0.6) zone = 'midrange';
      else zone = 'threePoint';
    }

    zones[zone].total++;
    if (shot.shot_result === 'made') zones[zone].made++;
  }

  // Find hot/cold zones
  let hotZone = '';
  let coldZone = '';
  let bestPct = -1;
  let worstPct = 101;

  for (const [key, z] of Object.entries(zones)) {
    if (z.total === 0) continue;
    const pct = (z.made / z.total) * 100;
    if (pct > bestPct) {
      bestPct = pct;
      hotZone = z.label;
    }
    if (pct < worstPct) {
      worstPct = pct;
      coldZone = z.label;
    }
  }

  return { zones, hotZone, coldZone };
}
