/**
 * trajectoryTracker.js — Lightweight Centroid Tracker
 *
 * Tracks the basketball's position across frames using a simple centroid-based
 * approach. Maintains a rolling buffer of the last N positions and provides
 * velocity/direction analysis for shot detection.
 *
 * No heavy ML — just position tracking of an already-detected ball.
 */

const MAX_HISTORY = 30; // frames of history to keep
const MAX_GAP_FRAMES = 5; // max frames ball can disappear before losing track
const MIN_MOVEMENT_PX = 3; // ignore sub-pixel jitter

/**
 * Creates a new trajectory tracker instance.
 * Each tracker follows one ball across frames.
 */
export function createTracker() {
  return {
    positions: [], // Array of { x, y, frame, timestamp }
    lastSeenFrame: -1,
    isTracking: false,
    trackId: Date.now(),
  };
}

/**
 * Update tracker with a new ball detection.
 *
 * @param {Object} tracker - Tracker state object
 * @param {number|null} x - Ball center X (pixels), or null if not detected
 * @param {number|null} y - Ball center Y (pixels), or null if not detected
 * @param {number} frameNum - Current frame number
 * @returns {Object} Updated tracker (mutated in place for perf)
 */
export function updateTracker(tracker, x, y, frameNum) {
  if (x !== null && y !== null) {
    // Ball detected this frame
    const lastPos = tracker.positions[tracker.positions.length - 1];

    // Filter sub-pixel noise
    if (lastPos) {
      const dx = Math.abs(x - lastPos.x);
      const dy = Math.abs(y - lastPos.y);
      if (dx < MIN_MOVEMENT_PX && dy < MIN_MOVEMENT_PX) {
        // Too little movement — update timestamp but keep old position
        tracker.lastSeenFrame = frameNum;
        return tracker;
      }
    }

    tracker.positions.push({
      x,
      y,
      frame: frameNum,
      timestamp: Date.now(),
    });

    // Trim old positions
    if (tracker.positions.length > MAX_HISTORY) {
      tracker.positions = tracker.positions.slice(-MAX_HISTORY);
    }

    tracker.lastSeenFrame = frameNum;
    tracker.isTracking = true;
  } else {
    // Ball not detected — check if we should keep tracking
    if (
      tracker.isTracking &&
      frameNum - tracker.lastSeenFrame > MAX_GAP_FRAMES
    ) {
      tracker.isTracking = false;
    }
  }

  return tracker;
}

/**
 * Get the current velocity of the tracked ball.
 * Uses the last 3 positions for smoothing.
 *
 * @param {Object} tracker
 * @returns {{ vx: number, vy: number, speed: number, direction: 'up'|'down'|'left'|'right'|'none' }}
 */
export function getVelocity(tracker) {
  const pts = tracker.positions;
  if (pts.length < 2) {
    return { vx: 0, vy: 0, speed: 0, direction: 'none' };
  }

  // Average velocity over last 3 frames for stability
  const lookback = Math.min(3, pts.length - 1);
  const recent = pts.slice(-lookback - 1);

  let totalVx = 0;
  let totalVy = 0;

  for (let i = 1; i < recent.length; i++) {
    const dt = recent[i].frame - recent[i - 1].frame || 1;
    totalVx += (recent[i].x - recent[i - 1].x) / dt;
    totalVy += (recent[i].y - recent[i - 1].y) / dt;
  }

  const vx = totalVx / lookback;
  const vy = totalVy / lookback;
  const speed = Math.sqrt(vx * vx + vy * vy);

  // Primary direction (screen coords: +Y is down)
  let direction = 'none';
  if (speed > MIN_MOVEMENT_PX) {
    if (Math.abs(vy) > Math.abs(vx)) {
      direction = vy > 0 ? 'down' : 'up';
    } else {
      direction = vx > 0 ? 'right' : 'left';
    }
  }

  return { vx, vy, speed, direction };
}

/**
 * Get the last N trajectory points in normalized coordinates (0–1).
 *
 * @param {Object} tracker
 * @param {number} frameWidth - Camera frame width in pixels
 * @param {number} frameHeight - Camera frame height in pixels
 * @param {number} count - Number of points to return (default: 20)
 * @returns {Array<{ x: number, y: number, frame: number }>}
 */
export function getTrajectoryNormalized(tracker, frameWidth, frameHeight, count = 20) {
  return tracker.positions.slice(-count).map((pt) => ({
    x: pt.x / frameWidth,
    y: pt.y / frameHeight,
    frame: pt.frame,
  }));
}

/**
 * Check if the ball is moving towards a target zone.
 * Useful for predicting rim approach.
 *
 * @param {Object} tracker
 * @param {{ x: number, y: number }} target - Target point (pixels)
 * @returns {boolean}
 */
export function isApproaching(tracker, target) {
  const pts = tracker.positions;
  if (pts.length < 3) return false;

  const current = pts[pts.length - 1];
  const prev = pts[pts.length - 3];

  const prevDist = Math.sqrt(
    (prev.x - target.x) ** 2 + (prev.y - target.y) ** 2
  );
  const currDist = Math.sqrt(
    (current.x - target.x) ** 2 + (current.y - target.y) ** 2
  );

  return currDist < prevDist;
}

/**
 * Get the Y-position trend (rising, falling, flat).
 * Key for shot arc detection: ball rises, peaks, then falls.
 *
 * @param {Object} tracker
 * @param {number} lookback - Frames to analyze (default: 8)
 * @returns {'rising'|'falling'|'peaked'|'flat'}
 */
export function getYTrend(tracker, lookback = 8) {
  const pts = tracker.positions;
  if (pts.length < lookback) return 'flat';

  const recent = pts.slice(-lookback);
  const mid = Math.floor(recent.length / 2);

  const firstHalfAvgY =
    recent.slice(0, mid).reduce((s, p) => s + p.y, 0) / mid;
  const secondHalfAvgY =
    recent.slice(mid).reduce((s, p) => s + p.y, 0) / (recent.length - mid);

  const diff = secondHalfAvgY - firstHalfAvgY;

  // In screen coords: +Y is DOWN, so "rising ball" means Y is DECREASING
  if (diff < -5) return 'rising'; // ball going up on screen
  if (diff > 5) return 'falling'; // ball coming down
  return 'flat';
}

/**
 * Find the launch point — the position where the ball first starts rising.
 * This approximates the shooter's position on the court.
 *
 * Scans the trajectory for the first sustained upward movement (Y decreasing
 * in screen coords). Returns normalized coordinates if frameWidth/frameHeight
 * are provided, otherwise pixel coordinates.
 *
 * @param {Object} tracker
 * @param {number} [frameWidth] - Frame width for normalization
 * @param {number} [frameHeight] - Frame height for normalization
 * @returns {{ x: number, y: number } | null}
 */
export function getLaunchPoint(tracker, frameWidth, frameHeight) {
  const pts = tracker.positions;
  if (pts.length < 3) return null;

  // Find the first point where the ball starts a sustained upward movement.
  // We look for 2+ consecutive frames with decreasing Y (ball moving up on screen).
  for (let i = 0; i < pts.length - 2; i++) {
    const dy1 = pts[i + 1].y - pts[i].y;
    const dy2 = pts[i + 2].y - pts[i + 1].y;
    // Both segments moving up (negative dy = rising on screen)
    if (dy1 < -MIN_MOVEMENT_PX && dy2 < -MIN_MOVEMENT_PX) {
      const launch = pts[i];
      if (frameWidth && frameHeight) {
        return { x: launch.x / frameWidth, y: launch.y / frameHeight };
      }
      return { x: launch.x, y: launch.y };
    }
  }

  // Fallback: use the earliest position in the trajectory
  const first = pts[0];
  if (frameWidth && frameHeight) {
    return { x: first.x / frameWidth, y: first.y / frameHeight };
  }
  return { x: first.x, y: first.y };
}

/**
 * Reset tracker to initial state (reuse instance).
 */
export function resetTracker(tracker) {
  tracker.positions = [];
  tracker.lastSeenFrame = -1;
  tracker.isTracking = false;
  tracker.trackId = Date.now();
  return tracker;
}
