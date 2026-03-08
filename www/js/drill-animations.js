/* ============================================================
   DRILL ANIMATIONS — /js/drill-animations.js
   Lightweight canvas-based animation system for CourtIQ drills.
   No external dependencies. All animations loop and pause on hover.
   ============================================================ */

const DrillAnimations = (() => {
  'use strict';

  const CW = 280;
  const CH = 176;

  /* ── Court Drawing ────────────────────────────────────────── */
  function drawCourt(ctx) {
    // Background
    ctx.fillStyle = '#12151c';
    ctx.fillRect(0, 0, CW, CH);

    // Court floor
    ctx.fillStyle = '#181d28';
    ctx.fillRect(7, 7, CW - 14, CH - 14);

    ctx.save();
    ctx.strokeStyle = 'rgba(245,166,35,0.28)';
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';

    // Outer boundary
    ctx.strokeRect(7, 7, CW - 14, CH - 14);

    // ─── Baseline is at the TOP (y = 7) ───
    // Basket is at the top, court extends downward
    const baseY  = 7;
    const courtH = CH - 14;

    // Lane (paint) – extends downward from baseline
    const laneW = (CW - 14) * 0.36;
    const laneL = (CW - laneW) / 2;
    const laneH = courtH * 0.42;

    ctx.strokeRect(laneL, baseY, laneW, laneH);

    // Free-throw line (solid, at bottom of lane)
    ctx.beginPath();
    ctx.moveTo(laneL, baseY + laneH);
    ctx.lineTo(laneL + laneW, baseY + laneH);
    ctx.stroke();

    // Free-throw arc (curving downward, away from basket)
    ctx.beginPath();
    ctx.arc(CW / 2, baseY + laneH, laneW / 2, 0, Math.PI, false);
    ctx.stroke();

    // Backboard (at baseline, near top)
    ctx.strokeStyle = 'rgba(245,166,35,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(CW / 2 - 16, 11);
    ctx.lineTo(CW / 2 + 16, 11);
    ctx.stroke();

    // Net connector
    ctx.strokeStyle = 'rgba(245,166,35,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CW / 2, 11);
    ctx.lineTo(CW / 2, 20);
    ctx.stroke();

    // Rim (inside the arc now)
    ctx.beginPath();
    ctx.arc(CW / 2, 22, 9, 0, Math.PI * 2);
    ctx.strokeStyle = '#f5a623';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Three-point corners + arc
    ctx.strokeStyle = 'rgba(245,166,35,0.28)';
    ctx.lineWidth = 1.4;

    const threeR   = courtH * 0.70;
    const cornerH  = courtH * 0.26;
    const cornerX  = 7 + (CW - 14) * 0.09;

    // Left corner (from baseline downward)
    ctx.beginPath();
    ctx.moveTo(cornerX, baseY);
    ctx.lineTo(cornerX, baseY + cornerH);
    ctx.stroke();

    // Right corner (from baseline downward)
    ctx.beginPath();
    ctx.moveTo(CW - cornerX, baseY);
    ctx.lineTo(CW - cornerX, baseY + cornerH);
    ctx.stroke();

    // Three-point arc (curving downward from baseline)
    ctx.save();
    ctx.beginPath();
    ctx.rect(7, 7, CW - 14, CH - 14);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(CW / 2, baseY, threeR, 0, Math.PI, false);
    ctx.stroke();
    ctx.restore();

    // Re-apply stroke styles after restore
    ctx.strokeStyle = 'rgba(245,166,35,0.15)';
    ctx.lineWidth = 1.4;

    // Restricted area (small arc under rim, curving downward)
    ctx.beginPath();
    ctx.arc(CW / 2, baseY + 4, (CW - 14) * 0.115, 0, Math.PI, false);
    ctx.stroke();

    ctx.restore();
  }

  /* ── Drawing helpers ─────────────────────────────────────── */
  function drawPlayer(ctx, x, y, color) {
    color = color || '#4ca3ff';
    ctx.save();
    // Ground shadow
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    // Body circle
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawDefender(ctx, x, y) {
    drawPlayer(ctx, x, y, '#e84040');
  }

  function drawBall(ctx, x, y, size) {
    size = size || 5;
    ctx.save();
    // Shadow
    ctx.beginPath();
    ctx.ellipse(x, y + size + 2, size * 0.7, size * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();
    // Ball
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = '#f5a623';
    ctx.fill();
    ctx.strokeStyle = '#b06010';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Ball seam
    ctx.beginPath();
    ctx.arc(x, y, size, -0.6, 0.6, false);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  function drawLabel(ctx, text) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,18,0.72)';
    ctx.fillRect(7, CH - 26, CW - 14, 19);
    ctx.fillStyle = 'rgba(245,166,35,0.85)';
    ctx.font = '600 9.5px "Barlow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, CW / 2, CH - 16.5);
    ctx.restore();
  }

  function drawCone(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x - 4, y + 3);
    ctx.lineTo(x + 4, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawLadder(ctx, x, y, w, h, rungs) {
    ctx.save();
    ctx.strokeStyle = 'rgba(245,166,35,0.35)';
    ctx.lineWidth = 1.2;
    // Side rails
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    // Rungs
    const spacing = h / (rungs + 1);
    for (let i = 1; i <= rungs; i++) {
      const ry = y - h / 2 + spacing * i;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, ry);
      ctx.lineTo(x + w / 2, ry);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawArrow(ctx, x1, y1, x2, y2, color) {
    ctx.save();
    ctx.strokeStyle = color || 'rgba(86,211,100,0.4)';
    ctx.fillStyle = color || 'rgba(86,211,100,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // Arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 6 * Math.cos(angle - 0.4), y2 - 6 * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - 6 * Math.cos(angle + 0.4), y2 - 6 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPathTrail(ctx, path) {
    if (path.length < 2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(76,163,255,0.14)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(path[0].px * CW, path[0].py * CH);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].px * CW, path[i].py * CH);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* ── Math helpers ─────────────────────────────────────────── */
  function lerp(a, b, t) { return a + (b - a) * t; }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function interpPath(path, t) {
    for (let i = 0; i < path.length - 1; i++) {
      const kA = path[i], kB = path[i + 1];
      if (t >= kA.t && t <= kB.t) {
        const seg = (t - kA.t) / (kB.t - kA.t);
        const e   = easeInOut(seg);
        return {
          px: lerp(kA.px, kB.px, e) * CW,
          py: lerp(kA.py, kB.py, e) * CH,
          bx: lerp(kA.bx, kB.bx, e) * CW,
          by: lerp(kA.by, kB.by, e) * CH,
        };
      }
    }
    const last = path[path.length - 1];
    return { px: last.px * CW, py: last.py * CH, bx: last.bx * CW, by: last.by * CH };
  }

  /* ── Animation Definitions ───────────────────────────────── */
  const ANIMS = {

    /* ══════ SHOOTING ══════ */

    catch_shoot: {
      label: 'Catch & Shoot',
      duration: 2800,
      path: [
        { px: 0.50, py: 0.88, bx: 0.50, by: 0.82, t: 0.00 },
        { px: 0.82, py: 0.60, bx: 0.93, by: 0.32, t: 0.28 },
        { px: 0.82, py: 0.60, bx: 0.82, by: 0.54, t: 0.45 },
        { px: 0.82, py: 0.56, bx: 0.80, by: 0.18, t: 0.68 },
        { px: 0.82, py: 0.60, bx: 0.50, by: 0.12, t: 0.85 },
        { px: 0.82, py: 0.60, bx: 0.50, by: 0.14, t: 1.00 },
      ],
      extras(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(86,211,100,0.18)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(CW * 0.50, CH * 0.88);
        ctx.lineTo(CW * 0.82, CH * 0.60);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    },

    pullup: {
      label: 'Pull-Up Mid-Range',
      duration: 2600,
      path: [
        { px: 0.50, py: 0.90, bx: 0.50, by: 0.84, t: 0.00 },
        { px: 0.63, py: 0.50, bx: 0.63, by: 0.44, t: 0.38 },
        { px: 0.63, py: 0.45, bx: 0.63, by: 0.22, t: 0.62 },
        { px: 0.63, py: 0.50, bx: 0.50, by: 0.12, t: 0.82 },
        { px: 0.63, py: 0.50, bx: 0.50, by: 0.14, t: 1.00 },
      ]
    },

    stepback: {
      label: 'Step-Back Three',
      duration: 2700,
      path: [
        { px: 0.50, py: 0.90, bx: 0.50, by: 0.84, t: 0.00 },
        { px: 0.53, py: 0.55, bx: 0.53, by: 0.49, t: 0.26 },
        { px: 0.36, py: 0.68, bx: 0.36, by: 0.62, t: 0.50 },
        { px: 0.36, py: 0.62, bx: 0.36, by: 0.30, t: 0.70 },
        { px: 0.36, py: 0.68, bx: 0.50, by: 0.12, t: 0.87 },
        { px: 0.36, py: 0.68, bx: 0.50, by: 0.14, t: 1.00 },
      ]
    },

    spot_shoot: {
      label: '5-Spot Circuit',
      duration: 3200,
      path: [
        { px: 0.50, py: 0.50, bx: 0.50, by: 0.44, t: 0.00 },
        { px: 0.50, py: 0.50, bx: 0.50, by: 0.11, t: 0.12 },
        { px: 0.20, py: 0.56, bx: 0.20, by: 0.50, t: 0.28 },
        { px: 0.20, py: 0.56, bx: 0.20, by: 0.11, t: 0.40 },
        { px: 0.82, py: 0.56, bx: 0.82, by: 0.50, t: 0.56 },
        { px: 0.82, py: 0.56, bx: 0.50, by: 0.11, t: 0.68 },
        { px: 0.14, py: 0.72, bx: 0.14, by: 0.66, t: 0.80 },
        { px: 0.14, py: 0.72, bx: 0.50, by: 0.11, t: 0.90 },
        { px: 0.50, py: 0.50, bx: 0.50, by: 0.44, t: 1.00 },
      ]
    },

    post_fade: {
      label: 'Post Fade-Away',
      duration: 2700,
      path: [
        { px: 0.34, py: 0.46, bx: 0.34, by: 0.40, t: 0.00 },
        { px: 0.34, py: 0.42, bx: 0.34, by: 0.36, t: 0.28 },
        { px: 0.22, py: 0.55, bx: 0.20, by: 0.30, t: 0.58 },
        { px: 0.22, py: 0.55, bx: 0.50, by: 0.12, t: 0.80 },
        { px: 0.22, py: 0.55, bx: 0.50, by: 0.14, t: 1.00 },
      ]
    },

    free_throw: {
      label: 'Free Throw Routine',
      duration: 2400,
      path: [
        { px: 0.50, py: 0.48, bx: 0.50, by: 0.42, t: 0.00 },
        { px: 0.50, py: 0.50, bx: 0.50, by: 0.46, t: 0.25 },
        { px: 0.50, py: 0.44, bx: 0.50, by: 0.22, t: 0.58 },
        { px: 0.50, py: 0.48, bx: 0.50, by: 0.12, t: 0.80 },
        { px: 0.50, py: 0.48, bx: 0.50, by: 0.14, t: 1.00 },
      ]
    },

    /* ══════ BALL HANDLING ══════ */

    two_ball: {
      label: 'Two-Ball Dribble',
      duration: 1400,
      path: [
        { px: 0.50, py: 0.62, bx: 0.42, by: 0.68, t: 0.00 },
        { px: 0.50, py: 0.62, bx: 0.42, by: 0.80, t: 0.25 },
        { px: 0.50, py: 0.62, bx: 0.58, by: 0.68, t: 0.50 },
        { px: 0.50, py: 0.62, bx: 0.58, by: 0.80, t: 0.75 },
        { px: 0.50, py: 0.62, bx: 0.42, by: 0.68, t: 1.00 },
      ],
      drawFrame(ctx, pos, t) {
        drawCourt(ctx);
        const phase = (t + 0.5) % 1;
        const b2Interp = interpPath(this.path, phase);
        const b2x = CW - b2Interp.bx;
        const b2y = b2Interp.by;
        drawBall(ctx, b2x, b2y, 4.5);
        drawBall(ctx, pos.bx, pos.by, 4.5);
        drawPlayer(ctx, pos.px, pos.py);
        drawLabel(ctx, this.label);
      }
    },

    slalom: {
      label: 'Cone Slalom',
      duration: 2600,
      path: [
        { px: 0.12, py: 0.90, bx: 0.12, by: 0.84, t: 0.00 },
        { px: 0.27, py: 0.72, bx: 0.27, by: 0.66, t: 0.18 },
        { px: 0.44, py: 0.56, bx: 0.44, by: 0.50, t: 0.38 },
        { px: 0.60, py: 0.70, bx: 0.60, by: 0.64, t: 0.58 },
        { px: 0.76, py: 0.54, bx: 0.76, by: 0.48, t: 0.76 },
        { px: 0.88, py: 0.68, bx: 0.88, by: 0.62, t: 1.00 },
      ],
      extras(ctx) {
        const conePositions = [
          [0.27, 0.56], [0.44, 0.72], [0.60, 0.56], [0.76, 0.72]
        ];
        conePositions.forEach(([cx, cy]) => drawCone(ctx, cx * CW, cy * CH));
      }
    },

    spider: {
      label: 'Spider Drill',
      duration: 1200,
      path: [
        { px: 0.50, py: 0.62, bx: 0.43, by: 0.60, t: 0.00 },
        { px: 0.50, py: 0.62, bx: 0.57, by: 0.55, t: 0.14 },
        { px: 0.50, py: 0.62, bx: 0.43, by: 0.55, t: 0.28 },
        { px: 0.50, py: 0.62, bx: 0.57, by: 0.69, t: 0.42 },
        { px: 0.50, py: 0.62, bx: 0.43, by: 0.69, t: 0.57 },
        { px: 0.50, py: 0.62, bx: 0.57, by: 0.60, t: 0.71 },
        { px: 0.50, py: 0.62, bx: 0.43, by: 0.60, t: 0.85 },
        { px: 0.50, py: 0.62, bx: 0.57, by: 0.55, t: 1.00 },
      ]
    },

    crossover: {
      label: 'Crossover Attack',
      duration: 2400,
      path: [
        { px: 0.50, py: 0.90, bx: 0.50, by: 0.84, t: 0.00 },
        { px: 0.42, py: 0.62, bx: 0.38, by: 0.56, t: 0.26 },
        { px: 0.58, py: 0.58, bx: 0.62, by: 0.52, t: 0.50 },
        { px: 0.70, py: 0.42, bx: 0.70, by: 0.36, t: 0.74 },
        { px: 0.50, py: 0.62, bx: 0.50, by: 0.56, t: 1.00 },
      ]
    },

    dribble_series: {
      label: 'Dribble Combo',
      duration: 2800,
      path: [
        { px: 0.50, py: 0.88, bx: 0.44, by: 0.84, t: 0.00 },
        { px: 0.50, py: 0.74, bx: 0.56, by: 0.70, t: 0.16 },
        { px: 0.38, py: 0.62, bx: 0.32, by: 0.58, t: 0.32 },
        { px: 0.62, py: 0.54, bx: 0.68, by: 0.50, t: 0.48 },
        { px: 0.44, py: 0.46, bx: 0.38, by: 0.42, t: 0.64 },
        { px: 0.56, py: 0.38, bx: 0.62, by: 0.34, t: 0.80 },
        { px: 0.50, py: 0.88, bx: 0.44, by: 0.84, t: 1.00 },
      ],
      extras(ctx) {
        // Zig-zag trail markers
        ctx.save();
        ctx.strokeStyle = 'rgba(76,163,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(CW * 0.50, CH * 0.88);
        ctx.lineTo(CW * 0.38, CH * 0.62);
        ctx.lineTo(CW * 0.62, CH * 0.54);
        ctx.lineTo(CW * 0.44, CH * 0.46);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    },

    /* ══════ DEFENSE ══════ */

    defensive_slide: {
      label: 'Defensive Slides',
      duration: 2600,
      path: [
        { px: 0.18, py: 0.65, bx: 0.50, by: 0.55, t: 0.00 },
        { px: 0.50, py: 0.65, bx: 0.50, by: 0.55, t: 0.32 },
        { px: 0.82, py: 0.65, bx: 0.50, by: 0.55, t: 0.64 },
        { px: 0.50, py: 0.65, bx: 0.50, by: 0.55, t: 0.82 },
        { px: 0.18, py: 0.65, bx: 0.50, by: 0.55, t: 1.00 },
      ],
      extras(ctx) {
        drawBall(ctx, CW * 0.50, CH * 0.55, 4.5);
        ctx.save();
        ctx.strokeStyle = 'rgba(232,64,64,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(CW * 0.18, CH * 0.65);
        ctx.lineTo(CW * 0.82, CH * 0.65);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      },
      drawFrame(ctx, pos) {
        drawCourt(ctx);
        this.extras(ctx);
        drawDefender(ctx, pos.px, pos.py);
        drawLabel(ctx, this.label);
      }
    },

    closeout: {
      label: 'Closeout & Contest',
      duration: 2800,
      path: [
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.16, t: 0.00 },
        { px: 0.78, py: 0.56, bx: 0.84, by: 0.50, t: 0.42 },
        { px: 0.74, py: 0.59, bx: 0.84, by: 0.50, t: 0.60 },
        { px: 0.68, py: 0.62, bx: 0.84, by: 0.50, t: 0.78 },
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.16, t: 1.00 },
      ],
      extras(ctx) {
        drawPlayer(ctx, CW * 0.84, CH * 0.50, '#56d364');
        drawBall(ctx, CW * 0.84, CH * 0.44, 4.5);
      },
      drawFrame(ctx, pos) {
        drawCourt(ctx);
        this.extras(ctx);
        drawDefender(ctx, pos.px, pos.py);
        drawLabel(ctx, this.label);
      }
    },

    /* ══════ FINISHING ══════ */

    mikan: {
      label: 'Mikan Drill',
      duration: 2200,
      path: [
        { px: 0.38, py: 0.34, bx: 0.38, by: 0.28, t: 0.00 },
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.12, t: 0.18 },
        { px: 0.62, py: 0.34, bx: 0.50, by: 0.14, t: 0.36 },
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.12, t: 0.54 },
        { px: 0.38, py: 0.34, bx: 0.50, by: 0.14, t: 0.72 },
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.12, t: 0.88 },
        { px: 0.38, py: 0.34, bx: 0.38, by: 0.28, t: 1.00 },
      ]
    },

    eurostep: {
      label: 'Euro Step Finish',
      duration: 2700,
      path: [
        { px: 0.50, py: 0.88, bx: 0.50, by: 0.82, t: 0.00 },
        { px: 0.50, py: 0.55, bx: 0.50, by: 0.49, t: 0.28 },
        { px: 0.36, py: 0.40, bx: 0.36, by: 0.34, t: 0.48 },
        { px: 0.58, py: 0.28, bx: 0.58, by: 0.22, t: 0.66 },
        { px: 0.58, py: 0.22, bx: 0.50, by: 0.12, t: 0.84 },
        { px: 0.58, py: 0.22, bx: 0.50, by: 0.14, t: 1.00 },
      ]
    },

    drive_finish: {
      label: 'Drive & Finish',
      duration: 2600,
      path: [
        { px: 0.50, py: 0.88, bx: 0.50, by: 0.82, t: 0.00 },
        { px: 0.50, py: 0.52, bx: 0.50, by: 0.46, t: 0.36 },
        { px: 0.50, py: 0.32, bx: 0.50, by: 0.26, t: 0.60 },
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.12, t: 0.80 },
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.14, t: 1.00 },
      ]
    },

    layup_finish: {
      label: 'Layup Finish',
      duration: 2500,
      path: [
        { px: 0.20, py: 0.88, bx: 0.20, by: 0.82, t: 0.00 },
        { px: 0.30, py: 0.65, bx: 0.30, by: 0.59, t: 0.22 },
        { px: 0.40, py: 0.45, bx: 0.40, by: 0.39, t: 0.44 },
        { px: 0.48, py: 0.28, bx: 0.48, by: 0.20, t: 0.64 },
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.12, t: 0.82 },
        { px: 0.50, py: 0.30, bx: 0.50, by: 0.14, t: 1.00 },
      ],
      extras(ctx) {
        // Show drive lane
        ctx.save();
        ctx.strokeStyle = 'rgba(76,163,255,0.10)';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(CW * 0.20, CH * 0.88);
        ctx.quadraticCurveTo(CW * 0.35, CH * 0.50, CW * 0.50, CH * 0.22);
        ctx.stroke();
        ctx.restore();
      }
    },

    /* ══════ CONDITIONING ══════ */

    sprints: {
      label: 'Sprint Conditioning',
      duration: 2200,
      path: [
        { px: 0.50, py: 0.92, bx: 0.50, by: 0.86, t: 0.00 },
        { px: 0.50, py: 0.57, bx: 0.50, by: 0.51, t: 0.24 },
        { px: 0.50, py: 0.92, bx: 0.50, by: 0.86, t: 0.46 },
        { px: 0.50, py: 0.14, bx: 0.50, by: 0.08, t: 0.70 },
        { px: 0.50, py: 0.92, bx: 0.50, by: 0.86, t: 1.00 },
      ],
      extras(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(86,211,100,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 6]);
        ctx.beginPath(); ctx.moveTo(7, CH * 0.57); ctx.lineTo(CW - 7, CH * 0.57); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    },

    sprint_drill: {
      label: 'Sprint Drill',
      duration: 2000,
      path: [
        { px: 0.15, py: 0.92, bx: 0.15, by: 0.86, t: 0.00 },
        { px: 0.35, py: 0.60, bx: 0.35, by: 0.54, t: 0.20 },
        { px: 0.55, py: 0.30, bx: 0.55, by: 0.24, t: 0.40 },
        { px: 0.75, py: 0.60, bx: 0.75, by: 0.54, t: 0.60 },
        { px: 0.85, py: 0.92, bx: 0.85, by: 0.86, t: 0.80 },
        { px: 0.15, py: 0.92, bx: 0.15, by: 0.86, t: 1.00 },
      ],
      extras(ctx) {
        // Sprint direction arrows
        drawArrow(ctx, CW * 0.15, CH * 0.85, CW * 0.55, CH * 0.25, 'rgba(86,211,100,0.15)');
        drawArrow(ctx, CW * 0.55, CH * 0.25, CW * 0.85, CH * 0.85, 'rgba(232,64,64,0.15)');
      }
    },

    full_court_run: {
      label: 'Full-Court Dribble',
      duration: 2600,
      path: [
        { px: 0.12, py: 0.90, bx: 0.12, by: 0.84, t: 0.00 },
        { px: 0.50, py: 0.52, bx: 0.50, by: 0.46, t: 0.38 },
        { px: 0.88, py: 0.14, bx: 0.88, by: 0.08, t: 0.68 },
        { px: 0.50, py: 0.52, bx: 0.50, by: 0.46, t: 0.84 },
        { px: 0.12, py: 0.90, bx: 0.12, by: 0.84, t: 1.00 },
      ]
    },

    /* ══════ PASSING ══════ */

    bounce_pass: {
      label: 'Bounce Pass',
      duration: 2600,
      path: [
        { px: 0.25, py: 0.72, bx: 0.25, by: 0.66, t: 0.00 },
        { px: 0.25, py: 0.72, bx: 0.50, by: 0.82, t: 0.22 },
        { px: 0.25, py: 0.72, bx: 0.75, by: 0.66, t: 0.40 },
        { px: 0.75, py: 0.72, bx: 0.75, by: 0.66, t: 0.50 },
        { px: 0.75, py: 0.72, bx: 0.50, by: 0.82, t: 0.72 },
        { px: 0.75, py: 0.72, bx: 0.25, by: 0.66, t: 0.90 },
        { px: 0.25, py: 0.72, bx: 0.25, by: 0.66, t: 1.00 },
      ],
      extras(ctx) {
        // Second player
        drawPlayer(ctx, CW * 0.75, CH * 0.72, '#56d364');
        // Bounce point indicator
        ctx.save();
        ctx.fillStyle = 'rgba(245,166,35,0.15)';
        ctx.beginPath();
        ctx.arc(CW * 0.50, CH * 0.82, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
      drawFrame(ctx, pos, t) {
        drawCourt(ctx);
        this.extras(ctx);
        drawBall(ctx, pos.bx, pos.by);
        // Show passer based on phase
        if (t < 0.50) {
          drawPlayer(ctx, CW * 0.25, CH * 0.72);
        } else {
          drawPlayer(ctx, CW * 0.25, CH * 0.72, '#56d364');
        }
        if (t >= 0.50) {
          drawPlayer(ctx, CW * 0.75, CH * 0.72);
        } else {
          drawPlayer(ctx, CW * 0.75, CH * 0.72, '#56d364');
        }
        drawLabel(ctx, this.label);
      }
    },

    chest_pass: {
      label: 'Chest Pass',
      duration: 2400,
      path: [
        { px: 0.30, py: 0.55, bx: 0.30, by: 0.49, t: 0.00 },
        { px: 0.30, py: 0.55, bx: 0.50, by: 0.49, t: 0.18 },
        { px: 0.30, py: 0.55, bx: 0.70, by: 0.49, t: 0.35 },
        { px: 0.70, py: 0.55, bx: 0.70, by: 0.49, t: 0.50 },
        { px: 0.70, py: 0.55, bx: 0.50, by: 0.49, t: 0.68 },
        { px: 0.70, py: 0.55, bx: 0.30, by: 0.49, t: 0.85 },
        { px: 0.30, py: 0.55, bx: 0.30, by: 0.49, t: 1.00 },
      ],
      extras(ctx) {
        // Pass lane
        ctx.save();
        ctx.strokeStyle = 'rgba(86,211,100,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(CW * 0.30, CH * 0.55);
        ctx.lineTo(CW * 0.70, CH * 0.55);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      },
      drawFrame(ctx, pos, t) {
        drawCourt(ctx);
        this.extras(ctx);
        drawBall(ctx, pos.bx, pos.by);
        if (t < 0.50) {
          drawPlayer(ctx, CW * 0.30, CH * 0.55);
          drawPlayer(ctx, CW * 0.70, CH * 0.55, '#56d364');
        } else {
          drawPlayer(ctx, CW * 0.30, CH * 0.55, '#56d364');
          drawPlayer(ctx, CW * 0.70, CH * 0.55);
        }
        drawLabel(ctx, this.label);
      }
    },

    outlet_pass: {
      label: 'Outlet Pass',
      duration: 2800,
      path: [
        { px: 0.50, py: 0.25, bx: 0.50, by: 0.19, t: 0.00 },
        { px: 0.50, py: 0.30, bx: 0.50, by: 0.24, t: 0.15 },
        { px: 0.50, py: 0.30, bx: 0.50, by: 0.50, t: 0.30 },
        { px: 0.50, py: 0.30, bx: 0.82, by: 0.75, t: 0.50 },
        { px: 0.82, py: 0.75, bx: 0.82, by: 0.69, t: 0.60 },
        { px: 0.82, py: 0.65, bx: 0.82, by: 0.59, t: 0.75 },
        { px: 0.82, py: 0.50, bx: 0.82, by: 0.44, t: 0.90 },
        { px: 0.50, py: 0.25, bx: 0.50, by: 0.19, t: 1.00 },
      ],
      extras(ctx) {
        // Rebound area
        ctx.save();
        ctx.fillStyle = 'rgba(76,163,255,0.06)';
        ctx.beginPath();
        ctx.arc(CW * 0.50, CH * 0.25, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Wing runner
        drawPlayer(ctx, CW * 0.82, CH * 0.75, '#56d364');
      },
      drawFrame(ctx, pos, t) {
        drawCourt(ctx);
        // Wing runner moves up court
        const runnerY = t < 0.50 ? CH * 0.75 : lerp(CH * 0.75, CH * 0.44, easeInOut((t - 0.50) / 0.40));
        drawPlayer(ctx, CW * 0.82, Math.min(runnerY, CH * 0.75), '#56d364');
        ctx.save();
        ctx.fillStyle = 'rgba(76,163,255,0.06)';
        ctx.beginPath();
        ctx.arc(CW * 0.50, CH * 0.25, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawBall(ctx, pos.bx, pos.by);
        drawPlayer(ctx, pos.px, pos.py);
        drawLabel(ctx, this.label);
      }
    },

    skip_pass: {
      label: 'Skip Pass',
      duration: 2600,
      path: [
        { px: 0.18, py: 0.55, bx: 0.18, by: 0.49, t: 0.00 },
        { px: 0.18, py: 0.55, bx: 0.40, by: 0.35, t: 0.15 },
        { px: 0.18, py: 0.55, bx: 0.65, by: 0.30, t: 0.30 },
        { px: 0.18, py: 0.55, bx: 0.82, by: 0.55, t: 0.45 },
        { px: 0.82, py: 0.55, bx: 0.82, by: 0.49, t: 0.55 },
        { px: 0.82, py: 0.55, bx: 0.65, by: 0.30, t: 0.70 },
        { px: 0.82, py: 0.55, bx: 0.18, by: 0.49, t: 0.90 },
        { px: 0.18, py: 0.55, bx: 0.18, by: 0.49, t: 1.00 },
      ],
      extras(ctx) {
        // Skip pass arc trail
        ctx.save();
        ctx.strokeStyle = 'rgba(86,211,100,0.10)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(CW * 0.18, CH * 0.55);
        ctx.quadraticCurveTo(CW * 0.50, CH * 0.25, CW * 0.82, CH * 0.55);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      },
      drawFrame(ctx, pos, t) {
        drawCourt(ctx);
        this.extras(ctx);
        drawBall(ctx, pos.bx, pos.by);
        if (t < 0.50) {
          drawPlayer(ctx, CW * 0.18, CH * 0.55);
          drawPlayer(ctx, CW * 0.82, CH * 0.55, '#56d364');
        } else {
          drawPlayer(ctx, CW * 0.18, CH * 0.55, '#56d364');
          drawPlayer(ctx, CW * 0.82, CH * 0.55);
        }
        // Defender in middle
        drawDefender(ctx, CW * 0.50, CH * 0.48);
        drawLabel(ctx, this.label);
      }
    },

    /* ══════ FOOTWORK ══════ */

    footwork_ladder: {
      label: 'Ladder Footwork',
      duration: 2400,
      path: [
        { px: 0.50, py: 0.88, bx: 0.50, by: 0.82, t: 0.00 },
        { px: 0.48, py: 0.76, bx: 0.50, by: 0.70, t: 0.14 },
        { px: 0.52, py: 0.64, bx: 0.50, by: 0.58, t: 0.28 },
        { px: 0.48, py: 0.52, bx: 0.50, by: 0.46, t: 0.42 },
        { px: 0.52, py: 0.40, bx: 0.50, by: 0.34, t: 0.56 },
        { px: 0.48, py: 0.28, bx: 0.50, by: 0.22, t: 0.70 },
        { px: 0.52, py: 0.20, bx: 0.50, by: 0.14, t: 0.85 },
        { px: 0.50, py: 0.88, bx: 0.50, by: 0.82, t: 1.00 },
      ],
      extras(ctx) {
        drawLadder(ctx, CW * 0.50, CH * 0.54, 22, CH * 0.56, 7);
      }
    },

    pivot_moves: {
      label: 'Pivot & Jab',
      duration: 2800,
      path: [
        { px: 0.50, py: 0.58, bx: 0.50, by: 0.52, t: 0.00 },
        { px: 0.56, py: 0.54, bx: 0.56, by: 0.48, t: 0.14 },
        { px: 0.50, py: 0.58, bx: 0.50, by: 0.52, t: 0.28 },
        { px: 0.44, py: 0.54, bx: 0.44, by: 0.48, t: 0.42 },
        { px: 0.50, py: 0.58, bx: 0.50, by: 0.52, t: 0.56 },
        { px: 0.52, py: 0.50, bx: 0.52, by: 0.30, t: 0.72 },
        { px: 0.50, py: 0.58, bx: 0.50, by: 0.12, t: 0.88 },
        { px: 0.50, py: 0.58, bx: 0.50, by: 0.52, t: 1.00 },
      ],
      extras(ctx) {
        // Pivot circle
        ctx.save();
        ctx.strokeStyle = 'rgba(76,163,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(CW * 0.50, CH * 0.58, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // Defender
        drawDefender(ctx, CW * 0.50, CH * 0.44);
      }
    },

    lateral_shuffle: {
      label: 'Lateral Shuffle',
      duration: 2200,
      path: [
        { px: 0.15, py: 0.50, bx: 0.15, by: 0.44, t: 0.00 },
        { px: 0.40, py: 0.50, bx: 0.40, by: 0.44, t: 0.18 },
        { px: 0.65, py: 0.50, bx: 0.65, by: 0.44, t: 0.36 },
        { px: 0.85, py: 0.50, bx: 0.85, by: 0.44, t: 0.50 },
        { px: 0.65, py: 0.50, bx: 0.65, by: 0.44, t: 0.64 },
        { px: 0.40, py: 0.50, bx: 0.40, by: 0.44, t: 0.82 },
        { px: 0.15, py: 0.50, bx: 0.15, by: 0.44, t: 1.00 },
      ],
      extras(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245,166,35,0.10)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(CW * 0.15, CH * 0.50);
        ctx.lineTo(CW * 0.85, CH * 0.50);
        ctx.stroke();
        // Direction arrows
        ctx.fillStyle = 'rgba(245,166,35,0.20)';
        // Right arrow
        ctx.beginPath();
        ctx.moveTo(CW * 0.82, CH * 0.46);
        ctx.lineTo(CW * 0.88, CH * 0.50);
        ctx.lineTo(CW * 0.82, CH * 0.54);
        ctx.closePath();
        ctx.fill();
        // Left arrow
        ctx.beginPath();
        ctx.moveTo(CW * 0.18, CH * 0.46);
        ctx.lineTo(CW * 0.12, CH * 0.50);
        ctx.lineTo(CW * 0.18, CH * 0.54);
        ctx.closePath();
        ctx.fill();
        ctx.setLineDash([]);
        ctx.restore();
      }
    },

    drop_step: {
      label: 'Drop Step Move',
      duration: 2600,
      path: [
        { px: 0.60, py: 0.40, bx: 0.60, by: 0.34, t: 0.00 },
        { px: 0.60, py: 0.38, bx: 0.60, by: 0.32, t: 0.20 },
        { px: 0.55, py: 0.30, bx: 0.55, by: 0.24, t: 0.42 },
        { px: 0.52, py: 0.24, bx: 0.52, by: 0.18, t: 0.60 },
        { px: 0.50, py: 0.20, bx: 0.50, by: 0.12, t: 0.78 },
        { px: 0.50, py: 0.20, bx: 0.50, by: 0.14, t: 0.90 },
        { px: 0.60, py: 0.40, bx: 0.60, by: 0.34, t: 1.00 },
      ],
      extras(ctx) {
        // Defender on the block
        drawDefender(ctx, CW * 0.56, CH * 0.36);
      }
    },

    triple_threat: {
      label: 'Triple Threat',
      duration: 3000,
      path: [
        { px: 0.50, py: 0.62, bx: 0.50, by: 0.56, t: 0.00 },
        // Jab right
        { px: 0.58, py: 0.58, bx: 0.58, by: 0.52, t: 0.12 },
        { px: 0.50, py: 0.62, bx: 0.50, by: 0.56, t: 0.22 },
        // Jab left
        { px: 0.42, py: 0.58, bx: 0.42, by: 0.52, t: 0.34 },
        { px: 0.50, py: 0.62, bx: 0.50, by: 0.56, t: 0.44 },
        // Shot fake
        { px: 0.50, py: 0.58, bx: 0.50, by: 0.42, t: 0.56 },
        { px: 0.50, py: 0.62, bx: 0.50, by: 0.56, t: 0.66 },
        // Drive to basket
        { px: 0.50, py: 0.40, bx: 0.50, by: 0.34, t: 0.80 },
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.12, t: 0.92 },
        { px: 0.50, py: 0.62, bx: 0.50, by: 0.56, t: 1.00 },
      ],
      extras(ctx) {
        // Triple threat zone
        ctx.save();
        ctx.fillStyle = 'rgba(76,163,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(CW * 0.50, CH * 0.56);
        ctx.lineTo(CW * 0.62, CH * 0.66);
        ctx.lineTo(CW * 0.38, CH * 0.66);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // Defender
        drawDefender(ctx, CW * 0.50, CH * 0.48);
      }
    },

    /* ══════ STRENGTH (reuses conditioning pattern) ══════ */

    jump_training: {
      label: 'Jump Training',
      duration: 2000,
      path: [
        { px: 0.50, py: 0.70, bx: 0.50, by: 0.64, t: 0.00 },
        { px: 0.50, py: 0.50, bx: 0.50, by: 0.44, t: 0.18 },
        { px: 0.50, py: 0.70, bx: 0.50, by: 0.64, t: 0.36 },
        { px: 0.50, py: 0.42, bx: 0.50, by: 0.36, t: 0.54 },
        { px: 0.50, py: 0.70, bx: 0.50, by: 0.64, t: 0.72 },
        { px: 0.50, py: 0.48, bx: 0.50, by: 0.42, t: 0.86 },
        { px: 0.50, py: 0.70, bx: 0.50, by: 0.64, t: 1.00 },
      ],
      extras(ctx) {
        // Jump height markers
        ctx.save();
        ctx.strokeStyle = 'rgba(86,211,100,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        [0.50, 0.42, 0.48].forEach(y => {
          ctx.beginPath();
          ctx.moveTo(CW * 0.42, CH * y);
          ctx.lineTo(CW * 0.58, CH * y);
          ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.restore();
      }
    },

    /* ══════ PICK AND ROLL ══════ */

    pick_and_roll: {
      label: 'Pick & Roll',
      duration: 3200,
      path: [
        { px: 0.50, py: 0.88, bx: 0.50, by: 0.82, t: 0.00 },
        { px: 0.50, py: 0.65, bx: 0.50, by: 0.59, t: 0.22 },
        { px: 0.58, py: 0.55, bx: 0.58, by: 0.49, t: 0.40 },
        { px: 0.68, py: 0.42, bx: 0.68, by: 0.36, t: 0.58 },
        { px: 0.68, py: 0.42, bx: 0.50, by: 0.12, t: 0.78 },
        { px: 0.68, py: 0.42, bx: 0.50, by: 0.14, t: 0.90 },
        { px: 0.50, py: 0.88, bx: 0.50, by: 0.82, t: 1.00 },
      ],
      extras(ctx) {
        // Screener
        drawPlayer(ctx, CW * 0.54, CH * 0.55, '#56d364');
        // Screen indicator
        ctx.save();
        ctx.strokeStyle = 'rgba(86,211,100,0.18)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(CW * 0.50, CH * 0.55);
        ctx.lineTo(CW * 0.58, CH * 0.55);
        ctx.stroke();
        ctx.restore();
      },
      drawFrame(ctx, pos, t) {
        drawCourt(ctx);
        // Screener rolls to basket after screen is used
        const screenerY = t > 0.40 ? lerp(CH * 0.55, CH * 0.30, easeInOut(Math.min(1, (t - 0.40) / 0.35))) : CH * 0.55;
        const screenerX = t > 0.40 ? lerp(CW * 0.54, CW * 0.44, easeInOut(Math.min(1, (t - 0.40) / 0.35))) : CW * 0.54;
        drawPlayer(ctx, screenerX, screenerY, '#56d364');
        // Screen indicator before use
        if (t < 0.40) {
          ctx.save();
          ctx.strokeStyle = 'rgba(86,211,100,0.18)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(CW * 0.50, CH * 0.55);
          ctx.lineTo(CW * 0.58, CH * 0.55);
          ctx.stroke();
          ctx.restore();
        }
        // Defender
        drawDefender(ctx, CW * 0.52, CH * 0.62);
        drawBall(ctx, pos.bx, pos.by);
        drawPlayer(ctx, pos.px, pos.py);
        drawLabel(ctx, this.label);
      }
    },

    /* ══════ FAST BREAK ══════ */

    fast_break: {
      label: 'Fast Break',
      duration: 2800,
      path: [
        { px: 0.20, py: 0.90, bx: 0.20, by: 0.84, t: 0.00 },
        { px: 0.35, py: 0.65, bx: 0.35, by: 0.59, t: 0.20 },
        { px: 0.50, py: 0.45, bx: 0.50, by: 0.39, t: 0.40 },
        { px: 0.50, py: 0.30, bx: 0.50, by: 0.24, t: 0.58 },
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.12, t: 0.76 },
        { px: 0.50, py: 0.22, bx: 0.50, by: 0.14, t: 0.88 },
        { px: 0.20, py: 0.90, bx: 0.20, by: 0.84, t: 1.00 },
      ],
      extras(ctx) {
        // Wing runners
        drawPlayer(ctx, CW * 0.15, CH * 0.80, '#56d364');
        drawPlayer(ctx, CW * 0.85, CH * 0.80, '#56d364');
      },
      drawFrame(ctx, pos, t) {
        drawCourt(ctx);
        // Wing runners advance
        const wy = lerp(CH * 0.80, CH * 0.35, easeInOut(Math.min(1, t / 0.60)));
        drawPlayer(ctx, CW * 0.15, wy, '#56d364');
        drawPlayer(ctx, CW * 0.85, wy, '#56d364');
        drawBall(ctx, pos.bx, pos.by);
        drawPlayer(ctx, pos.px, pos.py);
        drawLabel(ctx, this.label);
      }
    },
  };

  /* ── Animation Runner ─────────────────────────────────────── */
  const _active = new Map();

  function createAnimation(canvas, animType) {
    stopAnimation(canvas);

    const ctx    = canvas.getContext('2d');
    const config = ANIMS[animType] || ANIMS['spot_shoot'];
    const dur    = config.duration || 2600;

    let startTs  = null;
    let paused   = false;
    let rafId    = null;

    function renderFrame(ts) {
      if (paused) return;
      if (!startTs) startTs = ts;
      const t = ((ts - startTs) % dur) / dur;

      const pos = interpPath(config.path, t);

      if (typeof config.drawFrame === 'function') {
        config.drawFrame(ctx, pos, t);
      } else {
        ctx.clearRect(0, 0, CW, CH);
        drawCourt(ctx);
        drawPathTrail(ctx, config.path);
        if (typeof config.extras === 'function') config.extras(ctx);
        drawBall(ctx, pos.bx, pos.by);
        drawPlayer(ctx, pos.px, pos.py);
        drawLabel(ctx, config.label);
      }

      rafId = requestAnimationFrame(renderFrame);
    }

    rafId = requestAnimationFrame(renderFrame);

    canvas.addEventListener('mouseenter', () => { paused = true; });
    canvas.addEventListener('mouseleave', () => {
      if (paused) {
        paused   = false;
        startTs  = null;
        rafId    = requestAnimationFrame(renderFrame);
      }
    });

    canvas.addEventListener('touchstart', () => {
      paused = !paused;
      if (!paused) {
        startTs = null;
        rafId   = requestAnimationFrame(renderFrame);
      }
    }, { passive: true });

    const handle = {
      stop() { cancelAnimationFrame(rafId); },
    };
    _active.set(canvas, handle);
    return handle;
  }

  function stopAnimation(canvas) {
    if (_active.has(canvas)) {
      _active.get(canvas).stop();
      _active.delete(canvas);
    }
  }

  function stopAll() {
    _active.forEach(h => h.stop());
    _active.clear();
  }

  return { createAnimation, stopAnimation, stopAll, CW, CH };
})();
