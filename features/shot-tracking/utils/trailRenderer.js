/**
 * TrailRenderer — Real-time basketball motion trail visualization
 * Draws a smooth Catmull-Rom spline trail behind the ball with
 * opacity-banded rendering for performance (5 draw calls, not 60).
 */
window.TrailRenderer = (function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────── */
  var MAX_POINTS       = 20;   // rolling buffer size
  var SUBDIVISIONS     = 3;    // Catmull-Rom interpolation density
  var HEAD_WIDTH       = 4;    // trail width at ball (px)
  var TAIL_WIDTH_RATIO = 0.3;  // tail = HEAD_WIDTH * this
  var GAP_BREAK_MS     = 300;  // break trail after this gap
  var OPACITY_BANDS    = 5;    // number of batched draw groups
  var SNAPSHOT_MS       = 800; // arc snapshot glow duration
  var MIN_MOVE_PX      = 0.002; // ignore sub-pixel jitter (normalized)

  /* ── Colors ─────────────────────────────────────────────────── */
  var COLORS = {
    idle:         '255,170,0',   // #ffaa00  orange
    shot_started: '0,212,255',   // #00d4ff  cyan
    near_hoop:    '255,221,0',   // #ffdd00  yellow
    cooldown:     '255,170,0'    // #ffaa00  orange
  };
  var SNAP_COLORS = {
    made:   '0,255,136',  // #00ff88  green
    missed: '255,68,68'   // #ff4444  red
  };

  /* ── State ──────────────────────────────────────────────────── */
  var _points = [];          // { x, y, t } normalized 0-1
  var _lastUpdateTime = 0;
  var _arcSnapshot = null;   // { points[], rgb, startTime }

  /* ── Catmull-Rom Interpolation ──────────────────────────────── */

  function crInterp(p0, p1, p2, p3, t) {
    var t2 = t * t;
    var t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) +
                 (-p0.x + p2.x) * t +
                 (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                 (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) +
                 (-p0.y + p2.y) * t +
                 (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                 (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  function buildSmoothPath(pts) {
    var n = pts.length;
    if (n === 0) return [];
    if (n === 1) return [{ x: pts[0].x, y: pts[0].y }];
    if (n <= 3) {
      // Too few for CR — return raw points (linear segments)
      var out = [];
      for (var i = 0; i < n; i++) out.push({ x: pts[i].x, y: pts[i].y });
      return out;
    }

    var smooth = [];
    for (var i = 0; i < n - 1; i++) {
      var p0 = pts[i === 0 ? 0 : i - 1];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2 < n ? i + 2 : n - 1];

      for (var s = 0; s < SUBDIVISIONS; s++) {
        smooth.push(crInterp(p0, p1, p2, p3, s / SUBDIVISIONS));
      }
    }
    // Add final point
    smooth.push({ x: pts[n - 1].x, y: pts[n - 1].y });
    return smooth;
  }

  /* ── Opacity-Banded Trail Drawing ──────────────────────────── */

  function drawTrail(ctx, cw, ch, points, rgb) {
    var smooth = buildSmoothPath(points);
    var total = smooth.length;
    if (total < 2) return;

    var bandSize = Math.ceil(total / OPACITY_BANDS);
    var tailW = HEAD_WIDTH * TAIL_WIDTH_RATIO;

    for (var band = 0; band < OPACITY_BANDS; band++) {
      // Overlap by 1 point to eliminate gaps between bands
      var startIdx = Math.max(0, band * bandSize - 1);
      var endIdx = Math.min((band + 1) * bandSize, total - 1);
      if (startIdx >= total - 1) break;

      // Opacity: tail (index 0) = 0, head (last index) = 1
      var midIdx = Math.floor((startIdx + endIdx) / 2);
      var opacity = (midIdx / (total - 1));
      if (opacity < 0.05) continue; // skip nearly invisible segments

      // Width at this band position
      var progress = midIdx / (total - 1);
      var width = tailW + (HEAD_WIDTH - tailW) * progress;

      ctx.save();
      ctx.strokeStyle = 'rgba(' + rgb + ',' + opacity.toFixed(2) + ')';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(smooth[startIdx].x * cw, smooth[startIdx].y * ch);
      for (var j = startIdx + 1; j <= endIdx; j++) {
        ctx.lineTo(smooth[j].x * cw, smooth[j].y * ch);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ── Arc Snapshot Drawing ───────────────────────────────────── */

  function drawSnapshot(ctx, cw, ch) {
    if (!_arcSnapshot) return;

    var elapsed = Date.now() - _arcSnapshot.startTime;
    if (elapsed > SNAPSHOT_MS) {
      _arcSnapshot = null;
      return;
    }

    // Ease-out fade: 1.0 → 0.0
    var t = elapsed / SNAPSHOT_MS;
    var alpha = 1.0 - t * t; // quadratic ease-out

    var smooth = buildSmoothPath(_arcSnapshot.points);
    if (smooth.length < 2) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(' + _arcSnapshot.rgb + ',' + alpha.toFixed(2) + ')';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(' + _arcSnapshot.rgb + ',' + (alpha * 0.8).toFixed(2) + ')';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(smooth[0].x * cw, smooth[0].y * ch);
    for (var i = 1; i < smooth.length; i++) {
      ctx.lineTo(smooth[i].x * cw, smooth[i].y * ch);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ── Get current shot state color ──────────────────────────── */

  function getShotColorRGB() {
    var state = 'idle';
    if (window.ShotDetectionEngine && window.ShotDetectionEngine._shotState) {
      state = window.ShotDetectionEngine._shotState;
    }
    return COLORS[state] || COLORS.idle;
  }

  /* ── Public API ─────────────────────────────────────────────── */

  return {
    /**
     * Feed a ball position each frame.
     * @param {number} normX - 0-1 normalized X
     * @param {number} normY - 0-1 normalized Y
     * @param {number} timestamp - Date.now()
     */
    update: function (normX, normY, timestamp) {
      // Gap detection — break trail if too long since last update
      if (_points.length > 0 && timestamp - _lastUpdateTime > GAP_BREAK_MS) {
        _points = [];
      }

      // Jitter filter — skip sub-pixel movements
      if (_points.length > 0) {
        var last = _points[_points.length - 1];
        var dx = normX - last.x;
        var dy = normY - last.y;
        if (dx * dx + dy * dy < MIN_MOVE_PX * MIN_MOVE_PX) return;
      }

      _points.push({ x: normX, y: normY, t: timestamp });
      if (_points.length > MAX_POINTS) _points.shift();

      _lastUpdateTime = timestamp;
    },

    /** Signal that the ball is lost this frame. */
    clearCurrent: function () {
      // Don't clear points — let them fade naturally.
      // Gap detection in update() handles trail breaks.
    },

    /**
     * Capture current trail as a shot arc snapshot.
     * @param {'made'|'missed'} result
     */
    snapshotArc: function (result) {
      if (_points.length < 3) return;
      _arcSnapshot = {
        points: _points.slice(), // clone
        rgb: SNAP_COLORS[result] || SNAP_COLORS.missed,
        startTime: Date.now()
      };
    },

    /**
     * Main draw call — invoke from the RAF overlay loop.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cw - canvas width
     * @param {number} ch - canvas height
     */
    draw: function (ctx, cw, ch) {
      // Draw continuous trail
      if (_points.length >= 2) {
        drawTrail(ctx, cw, ch, _points, getShotColorRGB());
      }
      // Draw shot arc snapshot (glow)
      drawSnapshot(ctx, cw, ch);
    },

    /** Reset all state (session end). */
    reset: function () {
      _points = [];
      _lastUpdateTime = 0;
      _arcSnapshot = null;
    }
  };
})();
