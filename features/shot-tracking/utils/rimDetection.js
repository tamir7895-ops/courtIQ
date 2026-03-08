/**
 * rimDetection.js — Rim Zone Math
 *
 * Handles all spatial calculations related to the rim zone:
 * - Is the ball inside/near the rim?
 * - Did the ball pass through the rim (made shot)?
 * - Did the ball miss (deflect sideways)?
 *
 * The rim zone is an ellipse defined during RimLock calibration.
 * All coordinates can be either pixel or normalized (0–1) depending on context.
 */

/**
 * @typedef {Object} RimZone
 * @property {number} centerX  - Rim center X (normalized 0–1)
 * @property {number} centerY  - Rim center Y (normalized 0–1)
 * @property {number} width    - Rim width (normalized 0–1)
 * @property {number} height   - Rim height (normalized 0–1)
 */

/**
 * Creates a rim zone object from the RimLockScreen calibration data.
 *
 * @param {number} centerX - Normalized center X (0–1)
 * @param {number} centerY - Normalized center Y (0–1)
 * @param {number} width   - Normalized width (0–1)
 * @param {number} height  - Normalized height (0–1)
 * @returns {RimZone}
 */
export function createRimZone(centerX, centerY, width, height) {
  return {
    centerX,
    centerY,
    width,
    height,
    // Pre-compute bounding box edges for fast checks
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
    // Expanded zone (1.5x) for "approach" detection
    approachLeft: centerX - width * 0.75,
    approachRight: centerX + width * 0.75,
    approachTop: centerY - height * 1.5,
    approachBottom: centerY + height * 1.5,
  };
}

/**
 * Convert pixel rim zone to normalized coords.
 *
 * @param {Object} pixelZone - { centerX, centerY, width, height } in pixels
 * @param {number} frameWidth
 * @param {number} frameHeight
 * @returns {RimZone}
 */
export function normalizeRimZone(pixelZone, frameWidth, frameHeight) {
  return createRimZone(
    pixelZone.centerX / frameWidth,
    pixelZone.centerY / frameHeight,
    pixelZone.width / frameWidth,
    pixelZone.height / frameHeight
  );
}

/**
 * Check if a point is inside the rim bounding box.
 *
 * @param {number} x - Normalized X (0–1)
 * @param {number} y - Normalized Y (0–1)
 * @param {RimZone} rim
 * @returns {boolean}
 */
export function isInsideRim(x, y, rim) {
  return x >= rim.left && x <= rim.right && y >= rim.top && y <= rim.bottom;
}

/**
 * Check if a point is in the expanded approach zone around the rim.
 * Used to detect when ball is heading towards the rim before entering.
 *
 * @param {number} x
 * @param {number} y
 * @param {RimZone} rim
 * @returns {boolean}
 */
export function isInApproachZone(x, y, rim) {
  return (
    x >= rim.approachLeft &&
    x <= rim.approachRight &&
    y >= rim.approachTop &&
    y <= rim.approachBottom
  );
}

/**
 * Check if the ball is above the rim (Y-axis).
 * In screen coordinates, "above" means lower Y value.
 *
 * @param {number} y - Normalized Y (0–1)
 * @param {RimZone} rim
 * @returns {boolean}
 */
export function isAboveRim(y, rim) {
  return y < rim.top;
}

/**
 * Check if the ball is below the rim.
 *
 * @param {number} y
 * @param {RimZone} rim
 * @returns {boolean}
 */
export function isBelowRim(y, rim) {
  return y > rim.bottom;
}

/**
 * Determine if a sequence of trajectory points represents a MADE shot.
 *
 * Made shot criteria:
 *  1. Ball starts above the rim (approach from above)
 *  2. Ball enters the rim bounding box
 *  3. Ball exits below the rim
 *  4. All within maxFrames (default 12)
 *  5. Ball stays within horizontal bounds of rim (didn't bounce off side)
 *
 * @param {Array<{x: number, y: number, frame: number}>} trajectory - Normalized points
 * @param {RimZone} rim
 * @param {number} maxFrames - Max frames for through-rim transit (default 12)
 * @returns {{ isMade: boolean, entryPoint: {x: number, y: number}|null }}
 */
export function analyzeShotResult(trajectory, rim, maxFrames = 12) {
  if (trajectory.length < 4) {
    return { isMade: false, entryPoint: null };
  }

  let enteredAbove = false;
  let enteredRim = false;
  let exitedBelow = false;
  let entryFrame = -1;
  let entryPoint = null;

  for (let i = 0; i < trajectory.length; i++) {
    const pt = trajectory[i];

    // Step 1: Ball is above rim
    if (!enteredAbove && isAboveRim(pt.y, rim) && isWithinHorizontalBounds(pt.x, rim)) {
      enteredAbove = true;
    }

    // Step 2: Ball enters rim zone (must have been above first)
    if (enteredAbove && !enteredRim && isInsideRim(pt.x, pt.y, rim)) {
      enteredRim = true;
      entryFrame = pt.frame;
      entryPoint = { x: pt.x, y: pt.y };
    }

    // Step 3: Ball exits below rim (must have entered rim first)
    if (enteredRim && isBelowRim(pt.y, rim)) {
      const frameDelta = pt.frame - entryFrame;
      if (frameDelta <= maxFrames && isWithinHorizontalBounds(pt.x, rim)) {
        exitedBelow = true;
        break;
      }
    }

    // Timeout: if too many frames passed since entry, it's not going through
    if (enteredRim && pt.frame - entryFrame > maxFrames) {
      break;
    }
  }

  return {
    isMade: enteredAbove && enteredRim && exitedBelow,
    entryPoint,
  };
}

/**
 * Determine if a trajectory represents a MISSED shot.
 *
 * Miss criteria:
 *  1. Ball approaches rim zone (enters approach area)
 *  2. Ball either:
 *     a. Exits sideways (leaves horizontal bounds without going through), OR
 *     b. Reverses Y direction (bounces off rim), OR
 *     c. Never enters the rim box after approaching
 *
 * @param {Array<{x: number, y: number, frame: number}>} trajectory
 * @param {RimZone} rim
 * @returns {{ isMiss: boolean, entryPoint: {x: number, y: number}|null }}
 */
export function analyzeMissResult(trajectory, rim) {
  if (trajectory.length < 4) {
    return { isMiss: false, entryPoint: null };
  }

  let approached = false;
  let approachPoint = null;

  for (let i = 0; i < trajectory.length; i++) {
    const pt = trajectory[i];

    // Ball entered approach zone
    if (!approached && isInApproachZone(pt.x, pt.y, rim)) {
      approached = true;
      approachPoint = { x: pt.x, y: pt.y };
    }

    if (approached) {
      // Check if ball left approach zone sideways
      if (!isInApproachZone(pt.x, pt.y, rim)) {
        const exitedSide =
          pt.x < rim.approachLeft || pt.x > rim.approachRight;
        const exitedUp = pt.y < rim.approachTop;

        if (exitedSide || exitedUp) {
          return { isMiss: true, entryPoint: approachPoint };
        }
      }
    }
  }

  // Ball approached but never passed through and trajectory ended
  if (approached) {
    const lastPt = trajectory[trajectory.length - 1];
    if (!isBelowRim(lastPt.y, rim) || !isWithinHorizontalBounds(lastPt.x, rim)) {
      return { isMiss: true, entryPoint: approachPoint };
    }
  }

  return { isMiss: false, entryPoint: null };
}

/**
 * Check if X is within the horizontal extent of the rim (with small margin).
 */
function isWithinHorizontalBounds(x, rim) {
  const margin = rim.width * 0.3; // 30% margin for flexibility
  return x >= rim.left - margin && x <= rim.right + margin;
}

/**
 * Calculate the distance from a point to the rim center.
 * Useful for heatmap positioning.
 *
 * @param {number} x - Normalized X
 * @param {number} y - Normalized Y
 * @param {RimZone} rim
 * @returns {number} Euclidean distance (normalized)
 */
export function distanceToRim(x, y, rim) {
  return Math.sqrt((x - rim.centerX) ** 2 + (y - rim.centerY) ** 2);
}
