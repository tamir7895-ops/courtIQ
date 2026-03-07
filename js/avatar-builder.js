/* ============================================================
   AVATAR BUILDER v2 — /js/avatar-builder.js
   Canvas-based avatar renderer — more realistic + fun style.
   Egg-shaped head, textured hair, expressive face, detailed body.
   ============================================================ */
(function () {
  'use strict';

  var AW = 200, AH = 280;

  /* ── Constants ─────────────────────────────────────────────── */
  var HEAD_CX = 100, HEAD_CY = 106;
  var HEAD_W = 36, HEAD_H = 40;
  var BODY_Y = 158, BODY_H = 90;

  /* ── Config ──────────────────────────────────────────────── */
  var CONFIG = {
    skinTones: [
      { name: 'Light',        color: '#FDDBB4' },
      { name: 'Medium Light', color: '#E8B98D' },
      { name: 'Medium',       color: '#C68642' },
      { name: 'Medium Dark',  color: '#8D5524' },
      { name: 'Dark',         color: '#5C3317' },
      { name: 'Deep',         color: '#3B1E0E' }
    ],
    hairStyles: ['buzz', 'short', 'fade', 'afro', 'dreads', 'mohawk', 'waves', 'cornrows', 'bald'],
    hairColors: [
      { name: 'Black',    color: '#1a1a1a' },
      { name: 'Brown',    color: '#4a2912' },
      { name: 'Blonde',   color: '#c4a35a' },
      { name: 'Red',      color: '#8b3a2f' },
      { name: 'Platinum', color: '#e8e0d0' },
      { name: 'Grey',     color: '#8a8a8a' },
      { name: 'Navy',     color: '#1a2d5a' }
    ],
    beardStyles: ['none', 'stubble', 'short', 'full', 'goatee', 'chinstrap'],
    bodyTypes:   ['lean', 'athletic', 'heavy'],
    accessories: ['none', 'headband', 'sweatband', 'glasses', 'chain', 'durag', 'armband']
  };

  var defaults = {
    skinTone:   '#C68642',
    hairStyle:  'short',
    hairColor:  '#1a1a1a',
    beardStyle: 'none',
    bodyType:   'athletic',
    position:   'SG',
    accessory:  'none'
  };

  /* ── Color Utilities ───────────────────────────────────────── */
  function darker(hex, amt) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, r - amt); g = Math.max(0, g - amt); b = Math.max(0, b - amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function lighter(hex, amt) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + amt); g = Math.min(255, g + amt); b = Math.min(255, b + amt);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function withAlpha(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function hexBrightness(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  /* ── Seeded PRNG (deterministic textures) ──────────────────── */
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function seededRand(seed) {
    var s = seed;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /* ── Shape Helpers ─────────────────────────────────────────── */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function eggShape(ctx, cx, cy, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    // Right side
    ctx.bezierCurveTo(cx + w * 0.9, cy - h, cx + w, cy - h * 0.15, cx + w * 0.6, cy + h);
    // Chin
    ctx.quadraticCurveTo(cx, cy + h * 1.12, cx - w * 0.6, cy + h);
    // Left side
    ctx.bezierCurveTo(cx - w, cy - h * 0.15, cx - w * 0.9, cy - h, cx, cy - h);
    ctx.closePath();
  }

  /* ── Drawing: Body ─────────────────────────────────────────── */
  function drawBody(ctx, cx, cfg) {
    var bw = cfg.bodyType === 'heavy' ? 86 : cfg.bodyType === 'athletic' ? 74 : 60;
    var bh = BODY_H;
    var by = BODY_Y;
    var skin = cfg.skinTone;

    // Ground shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, AH - 18, 45, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();
    ctx.restore();

    // Arms (behind jersey)
    var armW = cfg.bodyType === 'heavy' ? 17 : cfg.bodyType === 'athletic' ? 15 : 13;
    var shoulderY = by + 4;
    var armH = 58;
    // Left arm
    ctx.save();
    var armGradL = ctx.createLinearGradient(0, shoulderY, 0, shoulderY + armH);
    armGradL.addColorStop(0, skin);
    armGradL.addColorStop(1, darker(skin, 15));
    ctx.fillStyle = armGradL;
    roundRect(ctx, cx - bw / 2 - armW + 3, shoulderY, armW, armH, 7);
    ctx.fill();
    // Muscle highlight (athletic/heavy)
    if (cfg.bodyType !== 'lean') {
      ctx.strokeStyle = withAlpha(lighter(skin, 20), 0.15);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2 - armW + 5, shoulderY + 10);
      ctx.quadraticCurveTo(cx - bw / 2 - armW + 4, shoulderY + 30, cx - bw / 2 - armW + 6, shoulderY + 45);
      ctx.stroke();
    }
    ctx.restore();
    // Right arm
    ctx.save();
    var armGradR = ctx.createLinearGradient(0, shoulderY, 0, shoulderY + armH);
    armGradR.addColorStop(0, skin);
    armGradR.addColorStop(1, darker(skin, 15));
    ctx.fillStyle = armGradR;
    roundRect(ctx, cx + bw / 2 - 3, shoulderY, armW, armH, 7);
    ctx.fill();
    if (cfg.bodyType !== 'lean') {
      ctx.strokeStyle = withAlpha(lighter(skin, 20), 0.15);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + bw / 2 + armW - 5, shoulderY + 10);
      ctx.quadraticCurveTo(cx + bw / 2 + armW - 4, shoulderY + 30, cx + bw / 2 + armW - 6, shoulderY + 45);
      ctx.stroke();
    }
    ctx.restore();

    // Jersey body with gradient
    var jerseyGrad = ctx.createLinearGradient(0, by, 0, by + bh);
    jerseyGrad.addColorStop(0, '#22252b');
    jerseyGrad.addColorStop(1, '#16181c');
    roundRect(ctx, cx - bw / 2, by, bw, bh, 10);
    ctx.fillStyle = jerseyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // V-neck collar
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 12, by);
    ctx.lineTo(cx, by + 16);
    ctx.lineTo(cx + 12, by);
    ctx.closePath();
    ctx.fillStyle = skin;
    ctx.fill();
    // Collar edge
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 13, by);
    ctx.lineTo(cx, by + 17);
    ctx.lineTo(cx + 13, by);
    ctx.stroke();
    ctx.restore();

    // Side stripes with gradient
    ctx.save();
    var stripeGrad = ctx.createLinearGradient(0, by + 6, 0, by + bh - 12);
    stripeGrad.addColorStop(0, 'rgba(245,166,35,0.3)');
    stripeGrad.addColorStop(1, 'rgba(245,166,35,0.08)');
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(cx - bw / 2 + 3, by + 6, 5, bh - 16);
    ctx.fillRect(cx + bw / 2 - 8, by + 6, 5, bh - 16);
    ctx.restore();

    // Shoulder seam lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2 + 6, by + 4);
    ctx.lineTo(cx - 6, by + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 6, by + 4);
    ctx.lineTo(cx + bw / 2 - 6, by + 4);
    ctx.stroke();

    // Sleeve caps
    ctx.fillStyle = '#1c1e23';
    roundRect(ctx, cx - bw / 2 - armW + 3, shoulderY, armW, 10, 5);
    ctx.fill();
    roundRect(ctx, cx + bw / 2 - 3, shoulderY, armW, 10, 5);
    ctx.fill();

    // Position number
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = "900 28px 'Barlow Condensed', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.position || 'SG', cx + 1, by + bh / 2);
    ctx.fillStyle = '#f5a623';
    ctx.fillText(cfg.position || 'SG', cx, by + bh / 2 - 1);
    ctx.restore();
  }

  /* ── Drawing: Neck ─────────────────────────────────────────── */
  function drawNeck(ctx, cx, skin) {
    var neckGrad = ctx.createLinearGradient(0, 136, 0, 160);
    neckGrad.addColorStop(0, skin);
    neckGrad.addColorStop(1, darker(skin, 15));
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 14, 140);
    ctx.lineTo(cx - 11, 162);
    ctx.lineTo(cx + 11, 162);
    ctx.lineTo(cx + 14, 140);
    ctx.closePath();
    ctx.fill();
  }

  /* ── Drawing: Head ─────────────────────────────────────────── */
  function drawHead(ctx, cx, cy, skin) {
    // Shadow
    ctx.save();
    eggShape(ctx, cx, cy + 3, HEAD_W + 1, HEAD_H + 1);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    ctx.restore();

    // Base head
    eggShape(ctx, cx, cy, HEAD_W, HEAD_H);
    ctx.fillStyle = skin;
    ctx.fill();

    // 3D highlight gradient
    ctx.save();
    eggShape(ctx, cx, cy, HEAD_W, HEAD_H);
    ctx.clip();
    var hlGrad = ctx.createRadialGradient(cx - 6, cy - 14, 4, cx, cy, HEAD_H + 5);
    hlGrad.addColorStop(0, withAlpha(lighter(skin, 30), 0.45));
    hlGrad.addColorStop(0.5, withAlpha(lighter(skin, 10), 0.1));
    hlGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(cx - HEAD_W - 5, cy - HEAD_H - 5, HEAD_W * 2 + 10, HEAD_H * 2 + 10);
    ctx.restore();

    // Ear hints
    ctx.save();
    ctx.fillStyle = darker(skin, 12);
    // Left ear
    ctx.beginPath();
    ctx.ellipse(cx - HEAD_W + 2, cy + 2, 5, 8, -0.15, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();
    // Right ear
    ctx.beginPath();
    ctx.ellipse(cx + HEAD_W - 2, cy + 2, 5, 8, 0.15, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    ctx.restore();

    // Jaw shadow
    ctx.save();
    eggShape(ctx, cx, cy, HEAD_W, HEAD_H);
    ctx.clip();
    var jawGrad = ctx.createLinearGradient(0, cy + HEAD_H - 16, 0, cy + HEAD_H + 2);
    jawGrad.addColorStop(0, 'rgba(0,0,0,0)');
    jawGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = jawGrad;
    ctx.fillRect(cx - HEAD_W - 2, cy + HEAD_H - 16, HEAD_W * 2 + 4, 20);
    ctx.restore();
  }

  /* ── Drawing: Face ─────────────────────────────────────────── */
  function drawFace(ctx, cx, cy, skin) {
    var browCol = hexBrightness(skin) > 120 ? darker(skin, 70) : withAlpha('#000000', 0.55);

    // Eyebrows (filled tapered shapes)
    ctx.fillStyle = browCol;
    // Left brow
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy - 13);
    ctx.quadraticCurveTo(cx - 14, cy - 17, cx - 6, cy - 14);
    ctx.lineTo(cx - 7, cy - 12);
    ctx.quadraticCurveTo(cx - 14, cy - 13.5, cx - 20, cy - 11);
    ctx.closePath();
    ctx.fill();
    // Right brow
    ctx.beginPath();
    ctx.moveTo(cx + 20, cy - 13);
    ctx.quadraticCurveTo(cx + 14, cy - 17, cx + 6, cy - 14);
    ctx.lineTo(cx + 7, cy - 12);
    ctx.quadraticCurveTo(cx + 14, cy - 13.5, cx + 20, cy - 11);
    ctx.closePath();
    ctx.fill();

    // Eye whites
    ctx.fillStyle = '#f5f2ec';
    ctx.beginPath();
    ctx.ellipse(cx - 13, cy - 3, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 13, cy - 3, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper eyelid lines
    ctx.strokeStyle = withAlpha(darker(skin, 45), 0.5);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(cx - 13, cy - 3, 7.5, 6, 0, Math.PI * 1.05, Math.PI * 1.95, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 13, cy - 3, 7.5, 6, 0, Math.PI * 1.05, Math.PI * 1.95, true);
    ctx.stroke();

    // Iris
    ctx.fillStyle = '#2a1f14';
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 3, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlights (makes them alive!)
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx - 13.5, cy - 4.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 12.5, cy - 4.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Secondary highlights
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(cx - 10.5, cy - 1.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 15.5, cy - 1.5, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Nose hint
    ctx.strokeStyle = withAlpha(darker(skin, 30), 0.2);
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy + 5);
    ctx.quadraticCurveTo(cx, cy + 8, cx + 2, cy + 5);
    ctx.stroke();

    // Mouth (smile with lip fill)
    var lipCol = withAlpha(darker(skin, 15), 0.7);
    var mouthW = 9;
    var mouthY = cy + 14;

    ctx.save();
    // Teeth hint
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 7, cx + mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 2, cx - mouthW, mouthY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();

    // Lips
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 7, cx + mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 2, cx - mouthW, mouthY);
    ctx.closePath();
    ctx.strokeStyle = lipCol;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Lip line
    ctx.beginPath();
    ctx.moveTo(cx - mouthW + 1, mouthY + 1);
    ctx.quadraticCurveTo(cx, mouthY + 3.5, cx + mouthW - 1, mouthY + 1);
    ctx.strokeStyle = withAlpha(darker(skin, 40), 0.4);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  /* ── Drawing: Hair ─────────────────────────────────────────── */
  function drawHairBuzz(ctx, cx, cy, hw, hh, color) {
    // Tight cap shape
    ctx.save();
    eggShape(ctx, cx, cy, hw + 2, hh + 2);
    ctx.clip();
    // Fill top portion
    ctx.beginPath();
    ctx.rect(cx - hw - 5, cy - hh - 5, hw * 2 + 10, hh + 10);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // Stubble dot texture
    var rng = seededRand(hashStr(color + 'buzz'));
    ctx.fillStyle = withAlpha(lighter(color, 25), 0.12);
    for (var i = 0; i < 45; i++) {
      var ang = rng() * Math.PI;
      var dist = rng() * (hw - 4);
      var dx = Math.cos(ang) * dist;
      var dy = -Math.sin(ang) * (hh * 0.6 + rng() * 10);
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy - hh * 0.3, 0.8 + rng() * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hairline edge
    ctx.strokeStyle = withAlpha(darker(color, 20), 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy - hh * 0.1, hw + 1, hh * 0.75, 0, Math.PI * 1.05, Math.PI * 1.95, true);
    ctx.stroke();
  }

  function drawHairShort(ctx, cx, cy, hw, hh, color) {
    // Hair shape — extends above head
    ctx.beginPath();
    ctx.moveTo(cx - hw - 2, cy - 2);
    ctx.bezierCurveTo(cx - hw - 3, cy - hh + 2, cx - hw * 0.6, cy - hh - 10, cx, cy - hh - 13);
    ctx.bezierCurveTo(cx + hw * 0.6, cy - hh - 10, cx + hw + 3, cy - hh + 2, cx + hw + 2, cy - 2);
    ctx.closePath();

    // Gradient fill
    var grad = ctx.createLinearGradient(0, cy - hh - 13, 0, cy);
    grad.addColorStop(0, lighter(color, 10));
    grad.addColorStop(1, darker(color, 15));
    ctx.fillStyle = grad;
    ctx.fill();

    // Comb-line highlights
    ctx.strokeStyle = withAlpha(lighter(color, 30), 0.12);
    ctx.lineWidth = 0.8;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 7, cy - hh - 10);
      ctx.quadraticCurveTo(cx + i * 8, cy - hh * 0.3, cx + i * 6, cy - 5);
      ctx.stroke();
    }

    // Subtle outline
    ctx.strokeStyle = withAlpha(darker(color, 25), 0.2);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - hw - 2, cy - 2);
    ctx.bezierCurveTo(cx - hw - 3, cy - hh + 2, cx - hw * 0.6, cy - hh - 10, cx, cy - hh - 13);
    ctx.bezierCurveTo(cx + hw * 0.6, cy - hh - 10, cx + hw + 3, cy - hh + 2, cx + hw + 2, cy - 2);
    ctx.stroke();
  }

  function drawHairFade(ctx, cx, cy, hw, hh, color) {
    // Top volume (tall)
    ctx.beginPath();
    ctx.moveTo(cx - hw + 4, cy - hh * 0.3);
    ctx.bezierCurveTo(cx - hw, cy - hh + 2, cx - hw * 0.5, cy - hh - 14, cx, cy - hh - 16);
    ctx.bezierCurveTo(cx + hw * 0.5, cy - hh - 14, cx + hw, cy - hh + 2, cx + hw - 4, cy - hh * 0.3);
    ctx.closePath();
    var topGrad = ctx.createLinearGradient(0, cy - hh - 16, 0, cy - hh * 0.3);
    topGrad.addColorStop(0, lighter(color, 8));
    topGrad.addColorStop(1, color);
    ctx.fillStyle = topGrad;
    ctx.fill();

    // Comb lines on top
    ctx.strokeStyle = withAlpha(lighter(color, 25), 0.1);
    ctx.lineWidth = 0.7;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 6, cy - hh - 12);
      ctx.quadraticCurveTo(cx + i * 7, cy - hh * 0.5, cx + i * 5, cy - hh * 0.3);
      ctx.stroke();
    }

    // Fade bands — 3 graduated layers on sides
    var fadeAlphas = [0.6, 0.3, 0.12];
    var fadeOffsets = [4, 2.5, 1.2];
    for (var b = 0; b < 3; b++) {
      ctx.save();
      ctx.globalAlpha = fadeAlphas[b];
      ctx.fillStyle = color;
      // Left side band
      ctx.beginPath();
      ctx.ellipse(cx, cy, hw + fadeOffsets[b], hh * (0.6 - b * 0.12), 0, Math.PI * 0.55 + b * 0.05, Math.PI * 0.95 - b * 0.02);
      ctx.fill();
      // Right side band
      ctx.beginPath();
      ctx.ellipse(cx, cy, hw + fadeOffsets[b], hh * (0.6 - b * 0.12), 0, Math.PI * 0.05 + b * 0.02, Math.PI * 0.45 - b * 0.05);
      ctx.fill();
      ctx.restore();
    }

    // Line-up edge
    ctx.strokeStyle = withAlpha(darker(color, 20), 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - hw + 4, cy - hh * 0.3);
    ctx.bezierCurveTo(cx - hw, cy - hh + 2, cx - hw * 0.5, cy - hh - 14, cx, cy - hh - 16);
    ctx.bezierCurveTo(cx + hw * 0.5, cy - hh - 14, cx + hw, cy - hh + 2, cx + hw - 4, cy - hh * 0.3);
    ctx.stroke();
  }

  function drawHairAfro(ctx, cx, cy, hw, hh, color) {
    var afroW = 54, afroH = 50;

    // Outer irregular edge (fluffy)
    ctx.beginPath();
    ctx.moveTo(cx, cy - afroH);
    ctx.bezierCurveTo(cx + afroW * 0.5, cy - afroH - 2, cx + afroW, cy - afroH * 0.5, cx + afroW + 2, cy);
    ctx.bezierCurveTo(cx + afroW + 1, cy + afroH * 0.4, cx + afroW * 0.6, cy + afroH * 0.7, cx + afroW * 0.3, cy + hh - 2);
    ctx.lineTo(cx - afroW * 0.3, cy + hh - 2);
    ctx.bezierCurveTo(cx - afroW * 0.6, cy + afroH * 0.7, cx - afroW - 1, cy + afroH * 0.4, cx - afroW - 2, cy);
    ctx.bezierCurveTo(cx - afroW, cy - afroH * 0.5, cx - afroW * 0.5, cy - afroH - 2, cx, cy - afroH);
    ctx.closePath();

    // Radial gradient dome highlight
    var afroGrad = ctx.createRadialGradient(cx - 5, cy - afroH * 0.4, 5, cx, cy, afroW + 5);
    afroGrad.addColorStop(0, lighter(color, 18));
    afroGrad.addColorStop(1, color);
    ctx.fillStyle = afroGrad;
    ctx.fill();

    // Curl texture (many tiny arcs)
    var rng = seededRand(hashStr(color + 'afro'));
    ctx.save();
    // Clip to afro shape
    ctx.beginPath();
    ctx.moveTo(cx, cy - afroH);
    ctx.bezierCurveTo(cx + afroW * 0.5, cy - afroH - 2, cx + afroW, cy - afroH * 0.5, cx + afroW + 2, cy);
    ctx.bezierCurveTo(cx + afroW + 1, cy + afroH * 0.4, cx + afroW * 0.6, cy + afroH * 0.7, cx + afroW * 0.3, cy + hh - 2);
    ctx.lineTo(cx - afroW * 0.3, cy + hh - 2);
    ctx.bezierCurveTo(cx - afroW * 0.6, cy + afroH * 0.7, cx - afroW - 1, cy + afroH * 0.4, cx - afroW - 2, cy);
    ctx.bezierCurveTo(cx - afroW, cy - afroH * 0.5, cx - afroW * 0.5, cy - afroH - 2, cx, cy - afroH);
    ctx.clip();

    for (var i = 0; i < 90; i++) {
      var tx = cx + (rng() - 0.5) * afroW * 2;
      var ty = cy + (rng() - 0.5) * afroH * 1.6 - 5;
      var tr = 2 + rng() * 3;
      var ta = rng() * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(tx, ty, tr, ta, ta + Math.PI * 0.8);
      ctx.strokeStyle = withAlpha(rng() > 0.5 ? lighter(color, 22) : darker(color, 18), 0.15 + rng() * 0.1);
      ctx.lineWidth = 1 + rng() * 0.5;
      ctx.stroke();
    }
    ctx.restore();

    // Soft outline
    ctx.strokeStyle = withAlpha(darker(color, 25), 0.25);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - afroH);
    ctx.bezierCurveTo(cx + afroW * 0.5, cy - afroH - 2, cx + afroW, cy - afroH * 0.5, cx + afroW + 2, cy);
    ctx.bezierCurveTo(cx + afroW + 1, cy + afroH * 0.4, cx + afroW * 0.6, cy + afroH * 0.7, cx + afroW * 0.3, cy + hh - 2);
    ctx.lineTo(cx - afroW * 0.3, cy + hh - 2);
    ctx.bezierCurveTo(cx - afroW * 0.6, cy + afroH * 0.7, cx - afroW - 1, cy + afroH * 0.4, cx - afroW - 2, cy);
    ctx.bezierCurveTo(cx - afroW, cy - afroH * 0.5, cx - afroW * 0.5, cy - afroH - 2, cx, cy - afroH);
    ctx.stroke();
  }

  function drawHairDreads(ctx, cx, cy, hw, hh, color) {
    // Cap on top — tight to scalp
    ctx.save();
    eggShape(ctx, cx, cy, hw + 2, hh + 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(cx - hw - 4, cy - hh - 4, hw * 2 + 8, hh + 6);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // Individual dreads — 12 strands, thinner & shorter
    var numDreads = 12;
    var rng = seededRand(hashStr(color + 'dreads'));

    for (var i = 0; i < numDreads; i++) {
      var angle = Math.PI * (0.12 + 0.76 * (i / (numDreads - 1)));
      var ox = Math.cos(angle) * (hw + 1);
      var oy = -Math.sin(angle) * (hh - 8);
      var startX = cx + ox;
      var startY = cy + oy;

      // Vary length — shorter overall, sides slightly longer
      var centerDist = Math.abs(i - numDreads / 2) / (numDreads / 2);
      var len = 18 + (1 - centerDist) * 14 + rng() * 6;
      var sway = (rng() - 0.5) * 10;
      var lw = 3 + rng() * 1.2;

      // Main dread strand
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(
        startX + sway * 0.4, startY + len * 0.35,
        startX + sway, startY + len * 0.65,
        startX + sway * 0.7, startY + len
      );
      ctx.lineWidth = lw;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Highlight edge
      ctx.beginPath();
      ctx.moveTo(startX + 0.8, startY + 2);
      ctx.bezierCurveTo(
        startX + sway * 0.4 + 0.8, startY + len * 0.35,
        startX + sway + 0.8, startY + len * 0.65,
        startX + sway * 0.7 + 0.8, startY + len
      );
      ctx.lineWidth = lw * 0.35;
      ctx.strokeStyle = withAlpha(lighter(color, 25), 0.18);
      ctx.stroke();

      // Band wraps (2 per dread)
      var bands = 2;
      for (var b = 0; b < bands; b++) {
        var t = 0.3 + b * 0.3;
        var bx = startX + sway * t;
        var by2 = startY + len * t;
        ctx.beginPath();
        ctx.moveTo(bx - lw * 0.3, by2);
        ctx.lineTo(bx + lw * 0.3, by2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = withAlpha(darker(color, 20), 0.35);
        ctx.stroke();
      }

      // Tip blob
      ctx.beginPath();
      ctx.arc(startX + sway * 0.7, startY + len, lw * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = darker(color, 8);
      ctx.fill();
    }
  }

  function drawHairMohawk(ctx, cx, cy, hw, hh, color) {
    /* Shaved sides — visible stubble (draw first, behind crest) */
    var rng = seededRand(hashStr(color + 'mohawk'));
    ctx.save();
    eggShape(ctx, cx, cy, hw + 1, hh + 1);
    ctx.clip();
    /* Stubble wash on sides */
    ctx.fillStyle = withAlpha(color, 0.18);
    ctx.beginPath();
    ctx.rect(cx - hw - 2, cy - hh - 2, hw * 2 + 4, hh + 4);
    ctx.fill();
    /* Individual stubble dots */
    ctx.fillStyle = withAlpha(color, 0.25);
    for (var s = 0; s < 70; s++) {
      var sx = cx + (rng() - 0.5) * hw * 2;
      var sy = cy - hh * 0.7 + rng() * hh * 1.0;
      if (Math.abs(sx - cx) < 10) continue; /* leave center for crest */
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5 + rng() * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* Central crest — proportionate height */
    var crestW = 14, crestH = 14;
    ctx.beginPath();
    ctx.moveTo(cx - crestW, cy - hh * 0.15);
    ctx.bezierCurveTo(cx - crestW - 1, cy - hh + 4, cx - crestW * 0.5, cy - hh - crestH + 2, cx, cy - hh - crestH);
    ctx.bezierCurveTo(cx + crestW * 0.5, cy - hh - crestH + 2, cx + crestW + 1, cy - hh + 4, cx + crestW, cy - hh * 0.15);
    ctx.closePath();

    var grad = ctx.createLinearGradient(0, cy - hh - crestH, 0, cy);
    grad.addColorStop(0, lighter(color, 12));
    grad.addColorStop(1, darker(color, 10));
    ctx.fillStyle = grad;
    ctx.fill();

    /* Strand highlights */
    ctx.strokeStyle = withAlpha(lighter(color, 25), 0.18);
    ctx.lineWidth = 0.8;
    for (var i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 2.5, cy - hh - crestH + 3);
      ctx.quadraticCurveTo(cx + i * 3, cy - hh * 0.5, cx + i * 2.5, cy - hh * 0.2);
      ctx.stroke();
    }

    /* Outline */
    ctx.strokeStyle = withAlpha(darker(color, 25), 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - crestW, cy - hh * 0.15);
    ctx.bezierCurveTo(cx - crestW - 1, cy - hh + 4, cx - crestW * 0.5, cy - hh - crestH + 2, cx, cy - hh - crestH);
    ctx.bezierCurveTo(cx + crestW * 0.5, cy - hh - crestH + 2, cx + crestW + 1, cy - hh + 4, cx + crestW, cy - hh * 0.15);
    ctx.stroke();
  }

  function drawHairWaves(ctx, cx, cy, hw, hh, color) {
    /* Cap shape — tight to scalp, only upper half of head */
    ctx.save();
    eggShape(ctx, cx, cy, hw + 2, hh + 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(cx - hw - 4, cy - hh - 4, hw * 2 + 8, hh + 8);
    ctx.fillStyle = color;
    ctx.fill();

    /* Wave lines — concentric curves radiating from crown */
    var crownX = cx, crownY = cy - hh * 0.55;
    for (var ring = 0; ring < 9; ring++) {
      var r = 4 + ring * 4.5;
      ctx.beginPath();
      ctx.arc(crownX, crownY, r, Math.PI * 0.05, Math.PI * 0.95);
      ctx.strokeStyle = withAlpha(ring % 2 === 0 ? lighter(color, 22) : darker(color, 14), 0.28);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    /* Hairline edge — clean line-up */
    ctx.strokeStyle = withAlpha(darker(color, 20), 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy - hh * 0.08, hw + 1, hh * 0.78, 0, Math.PI * 1.05, Math.PI * 1.95, true);
    ctx.stroke();
  }

  function drawHairCornrows(ctx, cx, cy, hw, hh, color) {
    /* Tight braided rows running front-to-back over egg-shaped head */
    var numRows = 7;

    /* Base cap — dark scalp beneath rows */
    ctx.save();
    eggShape(ctx, cx, cy, hw + 2, hh + 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(cx - hw - 4, cy - hh - 4, hw * 2 + 8, hh + 6);
    ctx.fillStyle = darker(color, 12);
    ctx.fill();
    ctx.restore();

    /* Row positions — evenly spaced across the top of the head */
    var totalW = hw * 1.5;
    var rowSpacing = totalW / (numRows - 1);
    var firstX = cx - totalW * 0.5;

    /* Clip rows to head shape */
    ctx.save();
    eggShape(ctx, cx, cy, hw + 2, hh + 2);
    ctx.clip();

    for (var i = 0; i < numRows; i++) {
      var baseX = firstX + i * rowSpacing;
      var distFromCenter = (baseX - cx) / hw;

      /* Row line — arcs from forehead toward back of head */
      var rowStartY = cy - hh + 2;
      var rowEndY = cy + 2;
      var curveBend = distFromCenter * 6;

      ctx.beginPath();
      ctx.moveTo(baseX, rowStartY);
      ctx.bezierCurveTo(
        baseX + curveBend * 0.3, rowStartY + (rowEndY - rowStartY) * 0.33,
        baseX + curveBend * 0.7, rowStartY + (rowEndY - rowStartY) * 0.66,
        baseX + curveBend, rowEndY
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      /* Braid cross-hatch pattern along each row */
      ctx.strokeStyle = withAlpha(lighter(color, 25), 0.18);
      ctx.lineWidth = 0.8;
      var segments = 7;
      for (var s = 0; s < segments; s++) {
        var t = (s + 0.5) / segments;
        var sx = baseX + curveBend * t;
        var sy = rowStartY + t * (rowEndY - rowStartY);
        ctx.beginPath();
        ctx.moveTo(sx - 1.2, sy);
        ctx.lineTo(sx + 1.2, sy + 2.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx + 1.2, sy);
        ctx.lineTo(sx - 1.2, sy + 2.5);
        ctx.stroke();
      }

      /* Part line (scalp visible between rows) */
      if (i < numRows - 1) {
        var partX = baseX + rowSpacing * 0.5;
        var partBend = ((partX - cx) / hw) * 5;
        ctx.beginPath();
        ctx.moveTo(partX, rowStartY + 2);
        ctx.bezierCurveTo(
          partX + partBend * 0.3, rowStartY + (rowEndY - rowStartY) * 0.33,
          partX + partBend * 0.7, rowStartY + (rowEndY - rowStartY) * 0.66,
          partX + partBend, rowEndY - 2
        );
        ctx.strokeStyle = withAlpha(darker(color, 35), 0.35);
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawHairBald(ctx, cx, cy, hw, hh) {
    // Specular highlights for shiny dome
    var hlGrad1 = ctx.createRadialGradient(cx - 8, cy - hh + 8, 2, cx - 8, cy - hh + 8, 14);
    hlGrad1.addColorStop(0, 'rgba(255,255,255,0.12)');
    hlGrad1.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad1;
    ctx.fillRect(cx - 22, cy - hh - 4, 28, 24);

    var hlGrad2 = ctx.createRadialGradient(cx + 6, cy - hh + 6, 1, cx + 6, cy - hh + 6, 8);
    hlGrad2.addColorStop(0, 'rgba(255,255,255,0.07)');
    hlGrad2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad2;
    ctx.fillRect(cx - 2, cy - hh - 2, 16, 16);
  }

  function drawHair(ctx, cx, cy, hw, hh, style, color) {
    switch (style) {
      case 'buzz':     drawHairBuzz(ctx, cx, cy, hw, hh, color); break;
      case 'short':    drawHairShort(ctx, cx, cy, hw, hh, color); break;
      case 'fade':     drawHairFade(ctx, cx, cy, hw, hh, color); break;
      case 'afro':     drawHairAfro(ctx, cx, cy, hw, hh, color); break;
      case 'dreads':   drawHairDreads(ctx, cx, cy, hw, hh, color); break;
      case 'mohawk':   drawHairMohawk(ctx, cx, cy, hw, hh, color); break;
      case 'waves':    drawHairWaves(ctx, cx, cy, hw, hh, color); break;
      case 'cornrows': drawHairCornrows(ctx, cx, cy, hw, hh, color); break;
      case 'bald':     drawHairBald(ctx, cx, cy, hw, hh); break;
    }
  }

  /* ── Drawing: Beard ────────────────────────────────────────── */
  /* Mouth is at cy+14, chin ~cy+hh. Beards anchor below the mouth. */
  function drawBeard(ctx, cx, cy, hw, hh, style, color) {
    if (style === 'none') return;

    /* Anchor points relative to face */
    var mouthY   = cy + 14;   /* mouth center */
    var jawTop   = cy + hh * 0.55;  /* where jaw widens */
    var chinBot  = cy + hh * 1.1;   /* bottom of chin */

    if (style === 'stubble') {
      var rng = seededRand(hashStr(color + 'stubble'));
      ctx.fillStyle = withAlpha(color, 0.35);
      for (var i = 0; i < 80; i++) {
        var sx = cx + (rng() - 0.5) * hw * 1.1;
        var sy = mouthY - 2 + rng() * (chinBot - mouthY + 6);
        /* Only within the lower face area — below mouth, inside jaw width */
        var distFromCenter = Math.abs(sx - cx) / hw;
        if (distFromCenter > 0.75 || sy < mouthY - 3) continue;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.5 + rng() * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (style === 'short') {
      /* Shaped short beard — covers chin area only, below mouth */
      var shortTop = mouthY + 5;  /* start well below the mouth */
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.4, shortTop);
      ctx.quadraticCurveTo(cx - hw * 0.45, jawTop + 6, cx - hw * 0.3, chinBot + 2);
      ctx.quadraticCurveTo(cx, chinBot + 6, cx + hw * 0.3, chinBot + 2);
      ctx.quadraticCurveTo(cx + hw * 0.45, jawTop + 6, cx + hw * 0.4, shortTop);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.65);
      ctx.fill();

      /* Curl texture */
      var rng2 = seededRand(hashStr(color + 'shortbeard'));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.4, shortTop);
      ctx.quadraticCurveTo(cx - hw * 0.45, jawTop + 6, cx - hw * 0.3, chinBot + 2);
      ctx.quadraticCurveTo(cx, chinBot + 6, cx + hw * 0.3, chinBot + 2);
      ctx.quadraticCurveTo(cx + hw * 0.45, jawTop + 6, cx + hw * 0.4, shortTop);
      ctx.clip();
      for (var j = 0; j < 25; j++) {
        var bx = cx + (rng2() - 0.5) * hw * 0.7;
        var by = shortTop + 2 + rng2() * (chinBot - shortTop + 2);
        ctx.beginPath();
        ctx.arc(bx, by, 1.5, rng2() * Math.PI, rng2() * Math.PI + Math.PI * 0.6);
        ctx.strokeStyle = withAlpha(darker(color, 15), 0.2);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();

      /* Mustache */
      ctx.beginPath();
      ctx.moveTo(cx - 7, mouthY - 1);
      ctx.quadraticCurveTo(cx, mouthY - 4, cx + 7, mouthY - 1);
      ctx.quadraticCurveTo(cx, mouthY + 2, cx - 7, mouthY - 1);
      ctx.fillStyle = withAlpha(color, 0.7);
      ctx.fill();
      return;
    }

    if (style === 'full') {
      /* Full beard — three separate layers: sideburns, chin, mustache */

      /* 1) Sideburns — narrow strips starting at mid-cheek, not ear level */
      var sbW = 5;  /* sideburn width */
      var sbTopY = mouthY - 4; /* start near mouth level, not ear level */
      /* Left sideburn */
      ctx.beginPath();
      ctx.moveTo(cx - hw + 5, sbTopY);
      ctx.quadraticCurveTo(cx - hw + 3, jawTop + 2, cx - hw * 0.38, chinBot);
      ctx.lineTo(cx - hw * 0.38 + sbW, chinBot - 2);
      ctx.quadraticCurveTo(cx - hw + sbW + 3, jawTop + 2, cx - hw + sbW + 3, sbTopY);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.75);
      ctx.fill();
      /* Right sideburn */
      ctx.beginPath();
      ctx.moveTo(cx + hw - 5, sbTopY);
      ctx.quadraticCurveTo(cx + hw - 3, jawTop + 2, cx + hw * 0.38, chinBot);
      ctx.lineTo(cx + hw * 0.38 - sbW, chinBot - 2);
      ctx.quadraticCurveTo(cx + hw - sbW - 3, jawTop + 2, cx + hw - sbW - 3, sbTopY);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.75);
      ctx.fill();

      /* 2) Chin/jaw beard — below mouth to past chin */
      var beardTop = mouthY + 4; /* start just below the mouth */
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.45, beardTop);
      ctx.quadraticCurveTo(cx - hw * 0.5, jawTop + 4, cx - hw * 0.32, chinBot + 4);
      ctx.quadraticCurveTo(cx, chinBot + 10, cx + hw * 0.32, chinBot + 4);
      ctx.quadraticCurveTo(cx + hw * 0.5, jawTop + 4, cx + hw * 0.45, beardTop);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      /* Chin highlight */
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.45, beardTop);
      ctx.quadraticCurveTo(cx - hw * 0.5, jawTop + 4, cx - hw * 0.32, chinBot + 4);
      ctx.quadraticCurveTo(cx, chinBot + 10, cx + hw * 0.32, chinBot + 4);
      ctx.quadraticCurveTo(cx + hw * 0.5, jawTop + 4, cx + hw * 0.45, beardTop);
      ctx.clip();
      var beardGrad = ctx.createRadialGradient(cx, chinBot, 3, cx, chinBot, 18);
      beardGrad.addColorStop(0, withAlpha(lighter(color, 15), 0.25));
      beardGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = beardGrad;
      ctx.fillRect(cx - hw, beardTop, hw * 2, chinBot - beardTop + 14);

      /* Curl textures */
      var rng3 = seededRand(hashStr(color + 'fullbeard'));
      for (var k = 0; k < 30; k++) {
        var fbx = cx + (rng3() - 0.5) * hw * 0.8;
        var fby = beardTop + 2 + rng3() * (chinBot - beardTop + 4);
        ctx.beginPath();
        ctx.arc(fbx, fby, 1.2 + rng3() * 0.8, rng3() * Math.PI, rng3() * Math.PI + Math.PI * 0.6);
        ctx.strokeStyle = withAlpha(darker(color, 15), 0.18);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();

      /* 3) Mustache — small shape above the mouth */
      ctx.beginPath();
      ctx.moveTo(cx - 9, mouthY - 1);
      ctx.quadraticCurveTo(cx, mouthY - 5, cx + 9, mouthY - 1);
      ctx.quadraticCurveTo(cx, mouthY + 2, cx - 9, mouthY - 1);
      ctx.fillStyle = color;
      ctx.fill();
    }

    if (style === 'goatee') {
      /* Goatee — chin patch + mustache, no sides */
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.25, mouthY + 3);
      ctx.quadraticCurveTo(cx - hw * 0.3, jawTop + 6, cx - hw * 0.2, chinBot + 6);
      ctx.quadraticCurveTo(cx, chinBot + 10, cx + hw * 0.2, chinBot + 6);
      ctx.quadraticCurveTo(cx + hw * 0.3, jawTop + 6, cx + hw * 0.25, mouthY + 3);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.75);
      ctx.fill();

      /* Curl texture */
      var rng4 = seededRand(hashStr(color + 'goatee'));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.25, mouthY + 3);
      ctx.quadraticCurveTo(cx - hw * 0.3, jawTop + 6, cx - hw * 0.2, chinBot + 6);
      ctx.quadraticCurveTo(cx, chinBot + 10, cx + hw * 0.2, chinBot + 6);
      ctx.quadraticCurveTo(cx + hw * 0.3, jawTop + 6, cx + hw * 0.25, mouthY + 3);
      ctx.clip();
      for (var g = 0; g < 20; g++) {
        var gx = cx + (rng4() - 0.5) * hw * 0.5;
        var gy = mouthY + 4 + rng4() * (chinBot - mouthY + 4);
        ctx.beginPath();
        ctx.arc(gx, gy, 1.2, rng4() * Math.PI, rng4() * Math.PI + Math.PI * 0.6);
        ctx.strokeStyle = withAlpha(darker(color, 15), 0.2);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();

      /* Mustache */
      ctx.beginPath();
      ctx.moveTo(cx - 7, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY - 4, cx + 7, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY + 1, cx - 7, mouthY - 2);
      ctx.fillStyle = withAlpha(color, 0.75);
      ctx.fill();
    }

    if (style === 'chinstrap') {
      /* Chinstrap — thin line tracing the jawline, tight to face */
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.52, mouthY + 2);
      ctx.quadraticCurveTo(cx - hw * 0.58, jawTop + 8, cx - hw * 0.35, chinBot + 1);
      ctx.quadraticCurveTo(cx, chinBot + 4, cx + hw * 0.35, chinBot + 1);
      ctx.quadraticCurveTo(cx + hw * 0.58, jawTop + 8, cx + hw * 0.52, mouthY + 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      /* Texture dots along strap */
      var rng5 = seededRand(hashStr(color + 'chinstrap'));
      ctx.fillStyle = withAlpha(lighter(color, 20), 0.15);
      for (var cs = 0; cs < 20; cs++) {
        var t = rng5();
        var csx = cx + (rng5() - 0.5) * hw * 1.0;
        var csy = mouthY + 2 + t * (chinBot - mouthY + 4);
        var distFromJaw = Math.abs(csx - cx) / hw;
        if (distFromJaw < 0.3 || distFromJaw > 0.65) continue;
        ctx.beginPath();
        ctx.arc(csx, csy, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ── Drawing: Basketball ───────────────────────────────────── */
  function drawBall(ctx, x, y, r, skin) {
    // Ball with gradient
    var ballGrad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, r);
    ballGrad.addColorStop(0, '#f7b840');
    ballGrad.addColorStop(1, '#d48a15');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Seams
    ctx.strokeStyle = darker('#f5a623', 45);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();

    // Pebble texture dots
    var rng = seededRand(42);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (var i = 0; i < 8; i++) {
      var dx = (rng() - 0.5) * r * 1.4;
      var dy = (rng() - 0.5) * r * 1.4;
      if (dx * dx + dy * dy < r * r * 0.7) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Finger hints wrapping ball
    if (skin) {
      ctx.strokeStyle = skin;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      for (var f = 0; f < 3; f++) {
        var fa = Math.PI * 0.6 + f * 0.25;
        ctx.beginPath();
        ctx.arc(x, y, r + 1, fa, fa + 0.3);
        ctx.stroke();
      }
    }
  }

  /* ── Drawing: Accessories ─────────────────────────────────── */
  function drawAccessory(ctx, cx, cy, hw, hh, accessory, cfg) {
    if (!accessory || accessory === 'none') return;

    if (accessory === 'headband') {
      /* Sporty headband across forehead */
      ctx.save();
      var hbY = cy - hh * 0.55;
      var hbH = 7;
      eggShape(ctx, cx, cy, hw + 1, hh + 1);
      ctx.clip();
      ctx.fillStyle = '#f5a623';
      ctx.fillRect(cx - hw - 3, hbY, hw * 2 + 6, hbH);
      /* Brand stripe */
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(cx - hw - 3, hbY + hbH * 0.4, hw * 2 + 6, 1.5);
      /* Logo dot */
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, hbY + hbH / 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (accessory === 'sweatband') {
      /* Wristband-style band — thicker, textured */
      ctx.save();
      var swY = cy - hh * 0.5;
      var swH = 9;
      eggShape(ctx, cx, cy, hw + 1, hh + 1);
      ctx.clip();
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(cx - hw - 3, swY, hw * 2 + 6, swH);
      /* Ribbed texture lines */
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 0.5;
      for (var sl = 0; sl < 14; sl++) {
        var slx = cx - hw + sl * 5.5;
        ctx.beginPath();
        ctx.moveTo(slx, swY);
        ctx.lineTo(slx, swY + swH);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (accessory === 'glasses') {
      /* Sporty wraparound glasses */
      var glY = cy - 4;
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      /* Bridge */
      ctx.beginPath();
      ctx.moveTo(cx - 5, glY);
      ctx.quadraticCurveTo(cx, glY - 2, cx + 5, glY);
      ctx.stroke();
      /* Left lens */
      ctx.beginPath();
      ctx.ellipse(cx - 13, glY, 9, 5, -0.05, 0, Math.PI * 2);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(40,40,50,0.35)';
      ctx.fill();
      /* Right lens */
      ctx.beginPath();
      ctx.ellipse(cx + 13, glY, 9, 5, 0.05, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(40,40,50,0.35)';
      ctx.fill();
      /* Temple arms */
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 22, glY);
      ctx.lineTo(cx - hw + 1, glY + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 22, glY);
      ctx.lineTo(cx + hw - 1, glY + 2);
      ctx.stroke();
    }

    if (accessory === 'chain') {
      /* Gold chain necklace — visible on neck/collar */
      var chainY = 148;
      ctx.strokeStyle = '#f5a623';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 16, chainY);
      ctx.quadraticCurveTo(cx, chainY + 14, cx + 16, chainY);
      ctx.stroke();
      /* Chain links */
      ctx.strokeStyle = '#d4941e';
      ctx.lineWidth = 1;
      var links = 7;
      for (var cl = 0; cl < links; cl++) {
        var t = cl / (links - 1);
        var clx = cx - 14 + t * 28;
        var cly = chainY + Math.sin(t * Math.PI) * 12;
        ctx.beginPath();
        ctx.ellipse(clx, cly, 1.8, 1.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      /* Pendant */
      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.arc(cx, chainY + 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c0d0f';
      ctx.font = "bold 5px 'Barlow Condensed', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IQ', cx, chainY + 14.5);
    }

    if (accessory === 'durag') {
      /* Durag wrapping the head */
      ctx.save();
      /* Main cap part */
      eggShape(ctx, cx, cy, hw + 3, hh + 3);
      ctx.clip();
      ctx.fillStyle = '#1a2d5a';
      ctx.fillRect(cx - hw - 5, cy - hh - 5, hw * 2 + 10, hh + 8);
      /* Seam line */
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh - 2);
      ctx.lineTo(cx, cy - 2);
      ctx.stroke();
      ctx.restore();
      /* Tail flap */
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - hh + 4);
      ctx.quadraticCurveTo(cx + 10, cy - hh - 10, cx + 20, cy - hh + 8);
      ctx.quadraticCurveTo(cx + 25, cy - hh + 18, cx + 15, cy - hh + 28);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1a2d5a';
      ctx.lineCap = 'round';
      ctx.stroke();
      /* Tie knot */
      ctx.fillStyle = '#1a2d5a';
      ctx.beginPath();
      ctx.ellipse(cx, cy - hh + 6, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (accessory === 'armband') {
      /* Arm band on left bicep */
      var bw = cfg.bodyType === 'heavy' ? 86 : cfg.bodyType === 'athletic' ? 74 : 60;
      var armW = cfg.bodyType === 'heavy' ? 17 : cfg.bodyType === 'athletic' ? 15 : 13;
      var armX = cx - bw / 2 - armW + 3;
      var armBandY = BODY_Y + 20;
      ctx.fillStyle = '#f5a623';
      ctx.fillRect(armX - 1, armBandY, armW + 2, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(armX - 1, armBandY + 2, armW + 2, 1);
    }
  }

  /* ── Main Draw ─────────────────────────────────────────────── */
  function draw(canvas, cfg) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    cfg = Object.assign({}, defaults, cfg || {});

    ctx.clearRect(0, 0, AW, AH);

    // Background
    ctx.fillStyle = '#141518';
    roundRect(ctx, 0, 0, AW, AH, 12);
    ctx.fill();

    // Subtle gradient at bottom
    var grad = ctx.createLinearGradient(0, AH - 60, 0, AH);
    grad.addColorStop(0, 'rgba(245,166,35,0)');
    grad.addColorStop(1, 'rgba(245,166,35,0.04)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, AH - 60, AW, 60);

    var cx = HEAD_CX;
    var cy = HEAD_CY;

    // Draw in order
    drawBody(ctx, cx, cfg);
    drawNeck(ctx, cx, cfg.skinTone);

    // Afro drawn behind head
    if (cfg.hairStyle === 'afro') {
      drawHair(ctx, cx, cy, HEAD_W, HEAD_H, 'afro', cfg.hairColor);
    }

    drawHead(ctx, cx, cy, cfg.skinTone);

    if (cfg.hairStyle !== 'afro') {
      drawHair(ctx, cx, cy, HEAD_W, HEAD_H, cfg.hairStyle, cfg.hairColor);
    }

    drawFace(ctx, cx, cy, cfg.skinTone);

    if (cfg.beardStyle !== 'none') {
      drawBeard(ctx, cx, cy, HEAD_W, HEAD_H, cfg.beardStyle, cfg.hairColor);
    }

    // Accessories (drawn on top of everything)
    drawAccessory(ctx, cx, cy, HEAD_W, HEAD_H, cfg.accessory, cfg);

    // Basketball
    drawBall(ctx, cx + 50, 218, 12, cfg.skinTone);
  }

  /* ── Mini Avatar (48×48, head only) ────────────────────────── */
  function drawMini(canvas, cfg) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var s = 48;
    cfg = Object.assign({}, defaults, cfg || {});

    ctx.clearRect(0, 0, s, s);

    // Background circle
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1e23';
    ctx.fill();

    var cx = s / 2;
    var cy = s / 2 + 2;
    var hw = 15, hh = 17;

    // Afro behind head
    if (cfg.hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(cx, cy - 3, 22, 0, Math.PI * 2);
      ctx.fillStyle = cfg.hairColor;
      ctx.fill();
    }

    // Head (simplified egg)
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    ctx.fillStyle = cfg.skinTone;
    ctx.fill();

    // Highlight
    var hlGrad = ctx.createRadialGradient(cx - 2, cy - 6, 2, cx, cy, hh);
    hlGrad.addColorStop(0, withAlpha(lighter(cfg.skinTone, 25), 0.35));
    hlGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair (simplified per style)
    if (cfg.hairStyle !== 'bald' && cfg.hairStyle !== 'afro') {
      ctx.fillStyle = cfg.hairColor;
      if (cfg.hairStyle === 'buzz' || cfg.hairStyle === 'waves') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillRect(cx - hw - 2, cy - hh - 2, hw * 2 + 4, hh);
        ctx.restore();
        /* Waves: add mini wave lines */
        if (cfg.hairStyle === 'waves') {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI * 2);
          ctx.clip();
          for (var wr = 0; wr < 4; wr++) {
            ctx.beginPath();
            ctx.arc(cx - 1, cy - hh * 0.2, 3 + wr * 3, Math.PI * 0.2, Math.PI * 0.8);
            ctx.strokeStyle = withAlpha(lighter(cfg.hairColor, 20), 0.25);
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.restore();
        }
      } else if (cfg.hairStyle === 'short') {
        ctx.beginPath();
        ctx.ellipse(cx, cy - 5, hw + 2, hh * 0.6, 0, Math.PI * 1.05, Math.PI * 1.95, true);
        ctx.fill();
      } else if (cfg.hairStyle === 'fade') {
        ctx.beginPath();
        ctx.ellipse(cx, cy - 6, hw, hh * 0.55, 0, Math.PI * 1.1, Math.PI * 1.9, true);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh * 0.4, 0, Math.PI * 0.85, Math.PI * 1.15);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh * 0.4, 0, Math.PI * 1.85, Math.PI * 0.15);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (cfg.hairStyle === 'dreads') {
        ctx.beginPath();
        ctx.ellipse(cx, cy - 3, hw + 2, hh * 0.55, 0, Math.PI * 1.05, Math.PI * 1.95, true);
        ctx.fill();
        ctx.strokeStyle = cfg.hairColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (var d = 0; d < 5; d++) {
          var da = Math.PI * (0.2 + 0.6 * (d / 4));
          var dsx = cx + Math.cos(da) * (hw + 1);
          var dsy = cy - Math.sin(da) * (hh - 4);
          ctx.beginPath();
          ctx.moveTo(dsx, dsy);
          ctx.lineTo(dsx + (d % 2 ? 2 : -2), dsy + 8 + d * 1.5);
          ctx.stroke();
        }
      } else if (cfg.hairStyle === 'mohawk') {
        /* Mini mohawk — narrow crest on top */
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy - hh * 0.2);
        ctx.bezierCurveTo(cx - 5, cy - hh, cx - 3, cy - hh - 8, cx, cy - hh - 9);
        ctx.bezierCurveTo(cx + 3, cy - hh - 8, cx + 5, cy - hh, cx + 4, cy - hh * 0.2);
        ctx.closePath();
        ctx.fill();
      } else if (cfg.hairStyle === 'cornrows') {
        /* Mini cornrows — parallel lines on top */
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillRect(cx - hw - 2, cy - hh - 2, hw * 2 + 4, hh);
        ctx.strokeStyle = withAlpha(darker(cfg.hairColor, 20), 0.4);
        ctx.lineWidth = 0.6;
        for (var cr = -3; cr <= 3; cr++) {
          ctx.beginPath();
          ctx.moveTo(cx + cr * 3.5, cy - hh + 2);
          ctx.lineTo(cx + cr * 4, cy - 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Bald highlight
    if (cfg.hairStyle === 'bald') {
      var bhGrad = ctx.createRadialGradient(cx - 3, cy - hh + 5, 1, cx - 3, cy - hh + 5, 8);
      bhGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
      bhGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bhGrad;
      ctx.fillRect(cx - 11, cy - hh, 16, 12);
    }

    // Eyes with highlights
    ctx.fillStyle = '#f5f2ec';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 1, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 5, cy - 1, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iris + pupil
    ctx.fillStyle = '#2a1f14';
    ctx.beginPath();
    ctx.arc(cx - 4.5, cy - 1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5.5, cy - 1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(cx - 4.5, cy - 1, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5.5, cy - 1, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // Highlight dots
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx - 5.3, cy - 2, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4.7, cy - 2, 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.moveTo(cx - 3.5, cy + 5);
    ctx.quadraticCurveTo(cx, cy + 7.5, cx + 3.5, cy + 5);
    ctx.strokeStyle = withAlpha(darker(cfg.skinTone, 25), 0.5);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Beard hint (positioned below mouth at cy+5)
    if (cfg.beardStyle === 'full' || cfg.beardStyle === 'short') {
      ctx.fillStyle = withAlpha(cfg.hairColor, 0.5);
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, cfg.beardStyle === 'full' ? 9 : 7, cfg.beardStyle === 'full' ? 7 : 4, 0, 0, Math.PI);
      ctx.fill();
    } else if (cfg.beardStyle === 'goatee') {
      ctx.fillStyle = withAlpha(cfg.hairColor, 0.55);
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, 4, 5, 0, 0, Math.PI);
      ctx.fill();
    } else if (cfg.beardStyle === 'chinstrap') {
      ctx.strokeStyle = withAlpha(cfg.hairColor, 0.45);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy + 4, hh - 4, 0.3, Math.PI - 0.3);
      ctx.stroke();
    } else if (cfg.beardStyle === 'stubble') {
      var rng = seededRand(hashStr(cfg.hairColor + 'ministub'));
      ctx.fillStyle = withAlpha(cfg.hairColor, 0.3);
      for (var si = 0; si < 12; si++) {
        var ssx = cx + (rng() - 0.5) * 10;
        var ssy = cy + 5 + rng() * 7;
        ctx.beginPath();
        ctx.arc(ssx, ssy, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ── Public API ──────────────────────────────────────────────── */
  window.AvatarBuilder = {
    CONFIG: CONFIG,
    defaults: defaults,
    draw: draw,
    drawMini: drawMini,
    darker: darker
  };
})();
