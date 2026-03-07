/* ============================================================
   AVATAR BUILDER v3 — /js/avatar-builder.js
   Gaming-quality canvas avatar renderer.
   Rim lighting, spotlight background, detailed skin/eyes/jersey.
   ============================================================ */
(function () {
  'use strict';

  var AW = 200, AH = 280;

  /* ── Constants ─────────────────────────────────────────────── */
  var HEAD_CX = 100, HEAD_CY = 100;
  var HEAD_W = 38, HEAD_H = 42;
  var BODY_Y = 152, BODY_H = 94;

  /* ── Light direction (top-left) ──────────────────────────── */
  var LIGHT_X = -0.6, LIGHT_Y = -0.8;

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

  function lerpColor(hex1, hex2, t) {
    var r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
    var r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
    var r = Math.round(r1 + (r2 - r1) * t);
    var g = Math.round(g1 + (g2 - g1) * t);
    var b = Math.round(b1 + (b2 - b1) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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
    ctx.bezierCurveTo(cx + w * 0.9, cy - h, cx + w, cy - h * 0.15, cx + w * 0.6, cy + h);
    ctx.quadraticCurveTo(cx, cy + h * 1.12, cx - w * 0.6, cy + h);
    ctx.bezierCurveTo(cx - w, cy - h * 0.15, cx - w * 0.9, cy - h, cx, cy - h);
    ctx.closePath();
  }

  /* ── Rim Light Helper ───────────────────────────────────────── */
  function rimHighlight(ctx, x, y, w, h, intensity) {
    var grad = ctx.createLinearGradient(x - w, y, x - w * 0.5, y);
    grad.addColorStop(0, 'rgba(180,210,255,' + (intensity * 0.35) + ')');
    grad.addColorStop(1, 'rgba(180,210,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - w - 2, y - h, 12, h * 2);
  }

  /* ── Drawing: Background ────────────────────────────────────── */
  function drawBackground(ctx) {
    // Deep dark base
    roundRect(ctx, 0, 0, AW, AH, 12);
    ctx.fillStyle = '#0a0b0e';
    ctx.fill();

    // Warm spotlight from bottom-right
    var spot = ctx.createRadialGradient(AW * 0.62, AH * 0.78, 15, AW * 0.5, AH * 0.55, AH * 0.65);
    spot.addColorStop(0, 'rgba(245, 166, 35, 0.10)');
    spot.addColorStop(0.4, 'rgba(245, 166, 35, 0.04)');
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, AW, AH);

    // Cool rim light from top-left
    var cool = ctx.createRadialGradient(AW * 0.15, AH * 0.12, 8, AW * 0.3, AH * 0.3, AH * 0.55);
    cool.addColorStop(0, 'rgba(120, 160, 255, 0.07)');
    cool.addColorStop(0.5, 'rgba(120, 160, 255, 0.02)');
    cool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cool;
    ctx.fillRect(0, 0, AW, AH);

    // Floor glow / reflection
    var floor = ctx.createLinearGradient(0, AH - 50, 0, AH);
    floor.addColorStop(0, 'rgba(245, 166, 35, 0)');
    floor.addColorStop(0.6, 'rgba(245, 166, 35, 0.03)');
    floor.addColorStop(1, 'rgba(245, 166, 35, 0.07)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, AH - 50, AW, 50);

    // Subtle vignette
    var vig = ctx.createRadialGradient(AW / 2, AH / 2, AW * 0.3, AW / 2, AH / 2, AW * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, AW, AH);
  }

  /* ── Drawing: Body ─────────────────────────────────────────── */
  function drawBody(ctx, cx, cfg) {
    var bw = cfg.bodyType === 'heavy' ? 88 : cfg.bodyType === 'athletic' ? 76 : 62;
    var bh = BODY_H;
    var by = BODY_Y;
    var skin = cfg.skinTone;

    // Ground shadow (larger, softer)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, AH - 14, 52, 8, 0, 0, Math.PI * 2);
    var gshGrad = ctx.createRadialGradient(cx, AH - 14, 2, cx, AH - 14, 52);
    gshGrad.addColorStop(0, 'rgba(0,0,0,0.25)');
    gshGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gshGrad;
    ctx.fill();
    ctx.restore();

    // --- Shorts ---
    var shortsY = by + bh - 6;
    var shortsH = 32;
    var shortsW = bw + 4;
    ctx.save();
    var shortsGrad = ctx.createLinearGradient(0, shortsY, 0, shortsY + shortsH);
    shortsGrad.addColorStop(0, '#1a1c22');
    shortsGrad.addColorStop(1, '#101214');
    roundRect(ctx, cx - shortsW / 2, shortsY, shortsW, shortsH, 6);
    ctx.fillStyle = shortsGrad;
    ctx.fill();
    // Shorts side stripes
    var ssGrad = ctx.createLinearGradient(0, shortsY, 0, shortsY + shortsH);
    ssGrad.addColorStop(0, 'rgba(245,166,35,0.25)');
    ssGrad.addColorStop(1, 'rgba(245,166,35,0.05)');
    ctx.fillStyle = ssGrad;
    ctx.fillRect(cx - shortsW / 2 + 3, shortsY + 2, 4, shortsH - 6);
    ctx.fillRect(cx + shortsW / 2 - 7, shortsY + 2, 4, shortsH - 6);
    // Shorts rim light (left edge)
    ctx.fillStyle = 'rgba(140,180,255,0.06)';
    ctx.fillRect(cx - shortsW / 2, shortsY, 3, shortsH);
    ctx.restore();

    // --- Legs hint (skin below shorts) ---
    var legW = cfg.bodyType === 'heavy' ? 14 : cfg.bodyType === 'athletic' ? 12 : 10;
    var legH = 20;
    var legY = shortsY + shortsH - 4;
    // Left leg
    var legGradL = ctx.createLinearGradient(0, legY, 0, legY + legH);
    legGradL.addColorStop(0, skin);
    legGradL.addColorStop(1, darker(skin, 20));
    ctx.fillStyle = legGradL;
    roundRect(ctx, cx - 18 - legW / 2, legY, legW, legH, 4);
    ctx.fill();
    // Right leg
    ctx.fillStyle = legGradL;
    roundRect(ctx, cx + 18 - legW / 2, legY, legW, legH, 4);
    ctx.fill();

    // --- Shoes ---
    var shoeY = legY + legH - 4;
    var shoeW = legW + 6;
    var shoeH = 10;
    // Left shoe
    ctx.save();
    var shoeGrad = ctx.createLinearGradient(0, shoeY, 0, shoeY + shoeH);
    shoeGrad.addColorStop(0, '#2a2a2a');
    shoeGrad.addColorStop(1, '#1a1a1a');
    roundRect(ctx, cx - 18 - shoeW / 2, shoeY, shoeW, shoeH, 3);
    ctx.fillStyle = shoeGrad;
    ctx.fill();
    // Shoe swoosh
    ctx.strokeStyle = '#f5a623';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 18 - shoeW / 2 + 3, shoeY + shoeH - 3);
    ctx.quadraticCurveTo(cx - 18, shoeY + 2, cx - 18 + shoeW / 2 - 2, shoeY + shoeH - 4);
    ctx.stroke();
    // Right shoe
    roundRect(ctx, cx + 18 - shoeW / 2, shoeY, shoeW, shoeH, 3);
    ctx.fillStyle = shoeGrad;
    ctx.fill();
    ctx.strokeStyle = '#f5a623';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + 18 + shoeW / 2 - 3, shoeY + shoeH - 3);
    ctx.quadraticCurveTo(cx + 18, shoeY + 2, cx + 18 - shoeW / 2 + 2, shoeY + shoeH - 4);
    ctx.stroke();
    ctx.restore();

    // --- Arms ---
    var armW = cfg.bodyType === 'heavy' ? 18 : cfg.bodyType === 'athletic' ? 16 : 14;
    var shoulderY = by + 4;
    var armH = 60;

    // Left arm
    ctx.save();
    var armGradL = ctx.createLinearGradient(cx - bw / 2 - armW, shoulderY, cx - bw / 2, shoulderY);
    armGradL.addColorStop(0, darker(skin, 12));
    armGradL.addColorStop(0.4, skin);
    armGradL.addColorStop(1, darker(skin, 8));
    ctx.fillStyle = armGradL;
    roundRect(ctx, cx - bw / 2 - armW + 3, shoulderY, armW, armH, 8);
    ctx.fill();
    // Arm rim light (left edge — facing the light)
    ctx.fillStyle = 'rgba(180,210,255,0.08)';
    ctx.fillRect(cx - bw / 2 - armW + 2, shoulderY + 4, 3, armH - 8);
    // Muscle definition (athletic/heavy)
    if (cfg.bodyType !== 'lean') {
      ctx.strokeStyle = withAlpha(lighter(skin, 25), 0.12);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2 - armW + 5, shoulderY + 12);
      ctx.quadraticCurveTo(cx - bw / 2 - armW + 4, shoulderY + 32, cx - bw / 2 - armW + 6, shoulderY + 48);
      ctx.stroke();
    }
    ctx.restore();

    // Right arm
    ctx.save();
    var armGradR = ctx.createLinearGradient(cx + bw / 2, shoulderY, cx + bw / 2 + armW, shoulderY);
    armGradR.addColorStop(0, darker(skin, 8));
    armGradR.addColorStop(0.6, skin);
    armGradR.addColorStop(1, darker(skin, 15));
    ctx.fillStyle = armGradR;
    roundRect(ctx, cx + bw / 2 - 3, shoulderY, armW, armH, 8);
    ctx.fill();
    if (cfg.bodyType !== 'lean') {
      ctx.strokeStyle = withAlpha(lighter(skin, 25), 0.12);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + bw / 2 + armW - 5, shoulderY + 12);
      ctx.quadraticCurveTo(cx + bw / 2 + armW - 4, shoulderY + 32, cx + bw / 2 + armW - 6, shoulderY + 48);
      ctx.stroke();
    }
    ctx.restore();

    // --- Hands ---
    var handR = armW * 0.42;
    // Left hand
    ctx.beginPath();
    ctx.arc(cx - bw / 2 - armW / 2 + 3, shoulderY + armH + 2, handR, 0, Math.PI * 2);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - bw / 2 - armW / 2 + 3, shoulderY + armH + 2, handR, 0, Math.PI * 2);
    var handHl = ctx.createRadialGradient(cx - bw / 2 - armW / 2 + 1, shoulderY + armH, 1, cx - bw / 2 - armW / 2 + 3, shoulderY + armH + 2, handR);
    handHl.addColorStop(0, withAlpha(lighter(skin, 20), 0.3));
    handHl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = handHl;
    ctx.fill();
    // Right hand (holding ball area — drawn later with ball)

    // --- Jersey body ---
    ctx.save();
    var jerseyGrad = ctx.createLinearGradient(cx - bw / 2, by, cx + bw / 2, by + bh);
    jerseyGrad.addColorStop(0, '#252830');
    jerseyGrad.addColorStop(0.3, '#1e2028');
    jerseyGrad.addColorStop(0.7, '#181a20');
    jerseyGrad.addColorStop(1, '#14161a');
    roundRect(ctx, cx - bw / 2, by, bw, bh, 10);
    ctx.fillStyle = jerseyGrad;
    ctx.fill();

    // Jersey rim light (left edge)
    var jrimGrad = ctx.createLinearGradient(cx - bw / 2 - 2, by, cx - bw / 2 + 10, by);
    jrimGrad.addColorStop(0, 'rgba(140,180,255,0.10)');
    jrimGrad.addColorStop(1, 'rgba(140,180,255,0)');
    ctx.fillStyle = jrimGrad;
    ctx.fillRect(cx - bw / 2, by + 4, 12, bh - 8);

    // Jersey fabric grain (subtle)
    var rng = seededRand(hashStr('jersey'));
    ctx.fillStyle = 'rgba(255,255,255,0.012)';
    for (var fi = 0; fi < 60; fi++) {
      var fx = cx - bw / 2 + rng() * bw;
      var fy = by + rng() * bh;
      ctx.fillRect(fx, fy, 1, 2);
    }

    // Jersey outline
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    roundRect(ctx, cx - bw / 2, by, bw, bh, 10);
    ctx.stroke();
    ctx.restore();

    // V-neck collar
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 14, by);
    ctx.lineTo(cx, by + 18);
    ctx.lineTo(cx + 14, by);
    ctx.closePath();
    // Collar skin fill with gradient
    var collarGrad = ctx.createLinearGradient(0, by, 0, by + 18);
    collarGrad.addColorStop(0, skin);
    collarGrad.addColorStop(1, darker(skin, 15));
    ctx.fillStyle = collarGrad;
    ctx.fill();
    // Collar edge trim
    ctx.strokeStyle = 'rgba(245,166,35,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 15, by);
    ctx.lineTo(cx, by + 19);
    ctx.lineTo(cx + 15, by);
    ctx.stroke();
    ctx.restore();

    // Side stripes (amber gradient)
    ctx.save();
    var stripeGrad = ctx.createLinearGradient(0, by + 6, 0, by + bh - 12);
    stripeGrad.addColorStop(0, 'rgba(245,166,35,0.35)');
    stripeGrad.addColorStop(0.5, 'rgba(245,166,35,0.2)');
    stripeGrad.addColorStop(1, 'rgba(245,166,35,0.06)');
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
    var sleeveGrad = ctx.createLinearGradient(0, shoulderY, 0, shoulderY + 12);
    sleeveGrad.addColorStop(0, '#22252c');
    sleeveGrad.addColorStop(1, '#1a1c22');
    ctx.fillStyle = sleeveGrad;
    roundRect(ctx, cx - bw / 2 - armW + 3, shoulderY, armW, 12, 5);
    ctx.fill();
    roundRect(ctx, cx + bw / 2 - 3, shoulderY, armW, 12, 5);
    ctx.fill();

    // Position number (with shadow + outline for depth)
    ctx.save();
    ctx.font = "900 30px 'Barlow Condensed', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var numY = by + bh / 2 - 2;
    // Number shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(cfg.position || 'SG', cx + 1, numY + 2);
    // Number outline
    ctx.strokeStyle = 'rgba(245,166,35,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeText(cfg.position || 'SG', cx, numY);
    // Number fill
    ctx.fillStyle = '#f5a623';
    ctx.fillText(cfg.position || 'SG', cx, numY);
    ctx.restore();
  }

  /* ── Drawing: Neck ─────────────────────────────────────────── */
  function drawNeck(ctx, cx, skin) {
    var neckGrad = ctx.createLinearGradient(0, 132, 0, 158);
    neckGrad.addColorStop(0, skin);
    neckGrad.addColorStop(0.5, darker(skin, 8));
    neckGrad.addColorStop(1, darker(skin, 20));
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 15, 136);
    ctx.lineTo(cx - 12, 158);
    ctx.lineTo(cx + 12, 158);
    ctx.lineTo(cx + 15, 136);
    ctx.closePath();
    ctx.fill();

    // Neck shadow (ambient occlusion under chin)
    var neckAO = ctx.createLinearGradient(0, 130, 0, 144);
    neckAO.addColorStop(0, 'rgba(0,0,0,0.15)');
    neckAO.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neckAO;
    ctx.fillRect(cx - 16, 130, 32, 14);

    // Neck rim light (left edge)
    ctx.fillStyle = 'rgba(140,180,255,0.06)';
    ctx.fillRect(cx - 16, 136, 3, 22);
  }

  /* ── Drawing: Head ─────────────────────────────────────────── */
  function drawHead(ctx, cx, cy, skin) {
    // Drop shadow
    ctx.save();
    eggShape(ctx, cx + 2, cy + 4, HEAD_W + 2, HEAD_H + 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();
    ctx.restore();

    // Base head
    eggShape(ctx, cx, cy, HEAD_W, HEAD_H);
    ctx.fillStyle = skin;
    ctx.fill();

    // Primary light gradient (top-left highlight)
    ctx.save();
    eggShape(ctx, cx, cy, HEAD_W, HEAD_H);
    ctx.clip();
    var hlGrad = ctx.createRadialGradient(cx - 10, cy - 18, 4, cx, cy, HEAD_H + 8);
    hlGrad.addColorStop(0, withAlpha(lighter(skin, 40), 0.5));
    hlGrad.addColorStop(0.3, withAlpha(lighter(skin, 15), 0.15));
    hlGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
    hlGrad.addColorStop(1, 'rgba(0,0,0,0.05)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(cx - HEAD_W - 5, cy - HEAD_H - 5, HEAD_W * 2 + 10, HEAD_H * 2 + 10);

    // Cheek blush (subtle warmth)
    var blushGrad = ctx.createRadialGradient(cx - 18, cy + 8, 2, cx - 18, cy + 8, 14);
    blushGrad.addColorStop(0, withAlpha(lighter(skin, 20), 0.15));
    blushGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blushGrad;
    ctx.fillRect(cx - 35, cy - 5, 30, 25);
    var blushGrad2 = ctx.createRadialGradient(cx + 18, cy + 8, 2, cx + 18, cy + 8, 14);
    blushGrad2.addColorStop(0, withAlpha(lighter(skin, 20), 0.12));
    blushGrad2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blushGrad2;
    ctx.fillRect(cx + 5, cy - 5, 30, 25);

    // Nose bridge highlight
    var noseHL = ctx.createLinearGradient(cx - 3, cy - 10, cx + 3, cy + 5);
    noseHL.addColorStop(0, withAlpha(lighter(skin, 25), 0.15));
    noseHL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = noseHL;
    ctx.fillRect(cx - 3, cy - 10, 6, 15);

    // Right side shadow (opposite light)
    var shadowGrad = ctx.createLinearGradient(cx + HEAD_W * 0.3, cy, cx + HEAD_W + 2, cy);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(cx, cy - HEAD_H, HEAD_W + 5, HEAD_H * 2 + 5);
    ctx.restore();

    // Ears (enhanced with inner detail)
    ctx.save();
    ctx.fillStyle = darker(skin, 10);
    // Left ear
    ctx.beginPath();
    ctx.ellipse(cx - HEAD_W + 2, cy + 2, 6, 9, -0.15, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();
    // Left ear inner
    ctx.beginPath();
    ctx.ellipse(cx - HEAD_W + 4, cy + 2, 3, 5, -0.15, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.fillStyle = darker(skin, 22);
    ctx.fill();
    // Right ear
    ctx.fillStyle = darker(skin, 14);
    ctx.beginPath();
    ctx.ellipse(cx + HEAD_W - 2, cy + 2, 6, 9, 0.15, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + HEAD_W - 4, cy + 2, 3, 5, 0.15, Math.PI * 0.6, Math.PI * 1.4);
    ctx.fillStyle = darker(skin, 26);
    ctx.fill();
    ctx.restore();

    // Jaw shadow (enhanced)
    ctx.save();
    eggShape(ctx, cx, cy, HEAD_W, HEAD_H);
    ctx.clip();
    var jawGrad = ctx.createLinearGradient(0, cy + HEAD_H - 18, 0, cy + HEAD_H + 2);
    jawGrad.addColorStop(0, 'rgba(0,0,0,0)');
    jawGrad.addColorStop(1, 'rgba(0,0,0,0.10)');
    ctx.fillStyle = jawGrad;
    ctx.fillRect(cx - HEAD_W - 2, cy + HEAD_H - 18, HEAD_W * 2 + 4, 22);
    ctx.restore();

    // HEAD RIM LIGHT (key gaming effect — cool blue edge on left)
    ctx.save();
    eggShape(ctx, cx, cy, HEAD_W, HEAD_H);
    ctx.clip();
    var rimGrad = ctx.createLinearGradient(cx - HEAD_W - 4, cy, cx - HEAD_W + 14, cy);
    rimGrad.addColorStop(0, 'rgba(150,190,255,0.22)');
    rimGrad.addColorStop(0.5, 'rgba(150,190,255,0.06)');
    rimGrad.addColorStop(1, 'rgba(150,190,255,0)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(cx - HEAD_W - 4, cy - HEAD_H - 2, 20, HEAD_H * 2 + 4);
    ctx.restore();
  }

  /* ── Drawing: Face ─────────────────────────────────────────── */
  function drawFace(ctx, cx, cy, skin) {
    var browCol = hexBrightness(skin) > 120 ? darker(skin, 75) : withAlpha('#000000', 0.6);

    // Eyebrows (thicker, more expressive)
    ctx.fillStyle = browCol;
    // Left brow
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy - 14);
    ctx.quadraticCurveTo(cx - 15, cy - 19, cx - 6, cy - 15);
    ctx.lineTo(cx - 7, cy - 12);
    ctx.quadraticCurveTo(cx - 15, cy - 14.5, cx - 22, cy - 11);
    ctx.closePath();
    ctx.fill();
    // Right brow
    ctx.beginPath();
    ctx.moveTo(cx + 22, cy - 14);
    ctx.quadraticCurveTo(cx + 15, cy - 19, cx + 6, cy - 15);
    ctx.lineTo(cx + 7, cy - 12);
    ctx.quadraticCurveTo(cx + 15, cy - 14.5, cx + 22, cy - 11);
    ctx.closePath();
    ctx.fill();

    // Eye socket shadows
    ctx.save();
    var socketGrad = ctx.createRadialGradient(cx - 13, cy - 3, 3, cx - 13, cy - 3, 12);
    socketGrad.addColorStop(0, 'rgba(0,0,0,0)');
    socketGrad.addColorStop(1, withAlpha(darker(skin, 25), 0.12));
    ctx.fillStyle = socketGrad;
    ctx.fillRect(cx - 25, cy - 12, 24, 18);
    var socketGrad2 = ctx.createRadialGradient(cx + 13, cy - 3, 3, cx + 13, cy - 3, 12);
    socketGrad2.addColorStop(0, 'rgba(0,0,0,0)');
    socketGrad2.addColorStop(1, withAlpha(darker(skin, 25), 0.10));
    ctx.fillStyle = socketGrad2;
    ctx.fillRect(cx + 1, cy - 12, 24, 18);
    ctx.restore();

    // Eye whites (larger, more expressive)
    ctx.fillStyle = '#f8f5ef';
    ctx.beginPath();
    ctx.ellipse(cx - 13, cy - 3, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 13, cy - 3, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper eyelid lines (thicker, more defined)
    ctx.strokeStyle = withAlpha(darker(skin, 50), 0.6);
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(cx - 13, cy - 3, 8.5, 6.5, 0, Math.PI * 1.03, Math.PI * 1.97, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 13, cy - 3, 8.5, 6.5, 0, Math.PI * 1.03, Math.PI * 1.97, true);
    ctx.stroke();

    // Lower eyelid hint
    ctx.strokeStyle = withAlpha(darker(skin, 30), 0.2);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(cx - 13, cy - 3, 7.5, 5.5, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 13, cy - 3, 7.5, 5.5, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // Iris (with gradient — dark brown with ring pattern)
    var irisR = 4.5;
    // Left iris
    var irisGrad = ctx.createRadialGradient(cx - 12, cy - 3, 0.5, cx - 12, cy - 3, irisR);
    irisGrad.addColorStop(0, '#1a1208');
    irisGrad.addColorStop(0.3, '#2e1f10');
    irisGrad.addColorStop(0.7, '#3a2515');
    irisGrad.addColorStop(0.9, '#1a1208');
    irisGrad.addColorStop(1, '#0a0a0a');
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 3, irisR, 0, Math.PI * 2);
    ctx.fillStyle = irisGrad;
    ctx.fill();
    // Right iris
    var irisGrad2 = ctx.createRadialGradient(cx + 14, cy - 3, 0.5, cx + 14, cy - 3, irisR);
    irisGrad2.addColorStop(0, '#1a1208');
    irisGrad2.addColorStop(0.3, '#2e1f10');
    irisGrad2.addColorStop(0.7, '#3a2515');
    irisGrad2.addColorStop(0.9, '#1a1208');
    irisGrad2.addColorStop(1, '#0a0a0a');
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 3, irisR, 0, Math.PI * 2);
    ctx.fillStyle = irisGrad2;
    ctx.fill();

    // Pupils (deep black)
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 3, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 3, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlights — PRIMARY (large, bright — the "life" of the avatar)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(cx - 14, cy - 5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 12, cy - 5, 2, 0, Math.PI * 2);
    ctx.fill();
    // Secondary highlights (smaller, lower)
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 1, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 16, cy - 1, 1, 0, Math.PI * 2);
    ctx.fill();
    // Iris ring highlights (gaming sparkle)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 3, 3.2, -0.5, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 3, 3.2, -0.5, 0.8);
    ctx.stroke();

    // Nose (enhanced with bridge and tip)
    ctx.save();
    // Nose bridge shadow
    ctx.strokeStyle = withAlpha(darker(skin, 20), 0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - 2);
    ctx.lineTo(cx - 2, cy + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy - 2);
    ctx.lineTo(cx + 2, cy + 6);
    ctx.stroke();
    // Nose tip highlight
    var noseTip = ctx.createRadialGradient(cx, cy + 6, 0.5, cx, cy + 6, 4);
    noseTip.addColorStop(0, withAlpha(lighter(skin, 20), 0.2));
    noseTip.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = noseTip;
    ctx.fillRect(cx - 4, cy + 3, 8, 6);
    // Nostril hints
    ctx.strokeStyle = withAlpha(darker(skin, 35), 0.25);
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy + 7);
    ctx.quadraticCurveTo(cx, cy + 9.5, cx + 3, cy + 7);
    ctx.stroke();
    ctx.restore();

    // Mouth (enhanced with better lips)
    var lipCol = withAlpha(darker(skin, 12), 0.75);
    var mouthW = 10;
    var mouthY = cy + 16;

    ctx.save();
    // Teeth hint (subtle)
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 7, cx + mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 2, cx - mouthW, mouthY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();

    // Lip outline (top)
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx - mouthW * 0.3, mouthY - 3, cx, mouthY - 1);
    ctx.quadraticCurveTo(cx + mouthW * 0.3, mouthY - 3, cx + mouthW, mouthY);
    ctx.strokeStyle = lipCol;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Lip outline (bottom)
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 7, cx + mouthW, mouthY);
    ctx.strokeStyle = lipCol;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Lip line
    ctx.beginPath();
    ctx.moveTo(cx - mouthW + 2, mouthY + 1);
    ctx.quadraticCurveTo(cx, mouthY + 3.5, cx + mouthW - 2, mouthY + 1);
    ctx.strokeStyle = withAlpha(darker(skin, 40), 0.35);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Lower lip highlight
    var lipHL = ctx.createRadialGradient(cx, mouthY + 4, 1, cx, mouthY + 4, 6);
    lipHL.addColorStop(0, withAlpha(lighter(skin, 15), 0.15));
    lipHL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lipHL;
    ctx.fillRect(cx - 8, mouthY + 1, 16, 8);
    ctx.restore();
  }

  /* ── Drawing: Hair ─────────────────────────────────────────── */
  function drawHairBuzz(ctx, cx, cy, hw, hh, color) {
    ctx.save();
    eggShape(ctx, cx, cy, hw + 2, hh + 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(cx - hw - 5, cy - hh - 5, hw * 2 + 10, hh + 10);
    var buzzGrad = ctx.createLinearGradient(cx - hw, cy - hh, cx + hw, cy);
    buzzGrad.addColorStop(0, lighter(color, 8));
    buzzGrad.addColorStop(1, color);
    ctx.fillStyle = buzzGrad;
    ctx.fill();
    ctx.restore();

    var rng = seededRand(hashStr(color + 'buzz'));
    ctx.fillStyle = withAlpha(lighter(color, 25), 0.12);
    for (var i = 0; i < 55; i++) {
      var ang = rng() * Math.PI;
      var dist = rng() * (hw - 4);
      var dx = Math.cos(ang) * dist;
      var dy = -Math.sin(ang) * (hh * 0.6 + rng() * 10);
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy - hh * 0.3, 0.8 + rng() * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = withAlpha(darker(color, 20), 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy - hh * 0.1, hw + 1, hh * 0.75, 0, Math.PI * 1.05, Math.PI * 1.95, true);
    ctx.stroke();
  }

  function drawHairShort(ctx, cx, cy, hw, hh, color) {
    ctx.beginPath();
    ctx.moveTo(cx - hw - 2, cy - 2);
    ctx.bezierCurveTo(cx - hw - 3, cy - hh + 2, cx - hw * 0.6, cy - hh - 12, cx, cy - hh - 15);
    ctx.bezierCurveTo(cx + hw * 0.6, cy - hh - 12, cx + hw + 3, cy - hh + 2, cx + hw + 2, cy - 2);
    ctx.closePath();

    var grad = ctx.createRadialGradient(cx - 8, cy - hh - 10, 3, cx, cy - hh * 0.3, hw + 10);
    grad.addColorStop(0, lighter(color, 18));
    grad.addColorStop(0.4, lighter(color, 6));
    grad.addColorStop(1, darker(color, 12));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = withAlpha(lighter(color, 30), 0.14);
    ctx.lineWidth = 0.8;
    for (var i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 6, cy - hh - 12);
      ctx.quadraticCurveTo(cx + i * 7, cy - hh * 0.3, cx + i * 5, cy - 5);
      ctx.stroke();
    }

    ctx.strokeStyle = withAlpha(darker(color, 25), 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - hw - 2, cy - 2);
    ctx.bezierCurveTo(cx - hw - 3, cy - hh + 2, cx - hw * 0.6, cy - hh - 12, cx, cy - hh - 15);
    ctx.bezierCurveTo(cx + hw * 0.6, cy - hh - 12, cx + hw + 3, cy - hh + 2, cx + hw + 2, cy - 2);
    ctx.stroke();
  }

  function drawHairFade(ctx, cx, cy, hw, hh, color) {
    ctx.beginPath();
    ctx.moveTo(cx - hw + 4, cy - hh * 0.3);
    ctx.bezierCurveTo(cx - hw, cy - hh + 2, cx - hw * 0.5, cy - hh - 16, cx, cy - hh - 18);
    ctx.bezierCurveTo(cx + hw * 0.5, cy - hh - 16, cx + hw, cy - hh + 2, cx + hw - 4, cy - hh * 0.3);
    ctx.closePath();
    var topGrad = ctx.createRadialGradient(cx - 6, cy - hh - 14, 3, cx, cy - hh * 0.3, hw + 5);
    topGrad.addColorStop(0, lighter(color, 15));
    topGrad.addColorStop(0.5, color);
    topGrad.addColorStop(1, darker(color, 8));
    ctx.fillStyle = topGrad;
    ctx.fill();

    ctx.strokeStyle = withAlpha(lighter(color, 25), 0.1);
    ctx.lineWidth = 0.7;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 6, cy - hh - 14);
      ctx.quadraticCurveTo(cx + i * 7, cy - hh * 0.5, cx + i * 5, cy - hh * 0.3);
      ctx.stroke();
    }

    var fadeAlphas = [0.6, 0.3, 0.12];
    var fadeOffsets = [4, 2.5, 1.2];
    for (var b = 0; b < 3; b++) {
      ctx.save();
      ctx.globalAlpha = fadeAlphas[b];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, hw + fadeOffsets[b], hh * (0.6 - b * 0.12), 0, Math.PI * 0.55 + b * 0.05, Math.PI * 0.95 - b * 0.02);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy, hw + fadeOffsets[b], hh * (0.6 - b * 0.12), 0, Math.PI * 0.05 + b * 0.02, Math.PI * 0.45 - b * 0.05);
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = withAlpha(darker(color, 20), 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - hw + 4, cy - hh * 0.3);
    ctx.bezierCurveTo(cx - hw, cy - hh + 2, cx - hw * 0.5, cy - hh - 16, cx, cy - hh - 18);
    ctx.bezierCurveTo(cx + hw * 0.5, cy - hh - 16, cx + hw, cy - hh + 2, cx + hw - 4, cy - hh * 0.3);
    ctx.stroke();
  }

  function drawHairAfro(ctx, cx, cy, hw, hh, color) {
    var afroW = 56, afroH = 52;

    ctx.beginPath();
    ctx.moveTo(cx, cy - afroH);
    ctx.bezierCurveTo(cx + afroW * 0.5, cy - afroH - 2, cx + afroW, cy - afroH * 0.5, cx + afroW + 2, cy);
    ctx.bezierCurveTo(cx + afroW + 1, cy + afroH * 0.4, cx + afroW * 0.6, cy + afroH * 0.7, cx + afroW * 0.3, cy + hh - 2);
    ctx.lineTo(cx - afroW * 0.3, cy + hh - 2);
    ctx.bezierCurveTo(cx - afroW * 0.6, cy + afroH * 0.7, cx - afroW - 1, cy + afroH * 0.4, cx - afroW - 2, cy);
    ctx.bezierCurveTo(cx - afroW, cy - afroH * 0.5, cx - afroW * 0.5, cy - afroH - 2, cx, cy - afroH);
    ctx.closePath();

    var afroGrad = ctx.createRadialGradient(cx - 8, cy - afroH * 0.45, 5, cx, cy, afroW + 5);
    afroGrad.addColorStop(0, lighter(color, 22));
    afroGrad.addColorStop(0.5, color);
    afroGrad.addColorStop(1, darker(color, 8));
    ctx.fillStyle = afroGrad;
    ctx.fill();

    var rng = seededRand(hashStr(color + 'afro'));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - afroH);
    ctx.bezierCurveTo(cx + afroW * 0.5, cy - afroH - 2, cx + afroW, cy - afroH * 0.5, cx + afroW + 2, cy);
    ctx.bezierCurveTo(cx + afroW + 1, cy + afroH * 0.4, cx + afroW * 0.6, cy + afroH * 0.7, cx + afroW * 0.3, cy + hh - 2);
    ctx.lineTo(cx - afroW * 0.3, cy + hh - 2);
    ctx.bezierCurveTo(cx - afroW * 0.6, cy + afroH * 0.7, cx - afroW - 1, cy + afroH * 0.4, cx - afroW - 2, cy);
    ctx.bezierCurveTo(cx - afroW, cy - afroH * 0.5, cx - afroW * 0.5, cy - afroH - 2, cx, cy - afroH);
    ctx.clip();

    for (var i = 0; i < 100; i++) {
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
    // Rim light on left edge of afro
    var afroRim = ctx.createLinearGradient(cx - afroW - 4, cy, cx - afroW + 12, cy);
    afroRim.addColorStop(0, 'rgba(150,190,255,0.12)');
    afroRim.addColorStop(1, 'rgba(150,190,255,0)');
    ctx.fillStyle = afroRim;
    ctx.fillRect(cx - afroW - 4, cy - afroH, 18, afroH * 2);
    ctx.restore();

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
    ctx.save();
    eggShape(ctx, cx, cy, hw + 2, hh + 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(cx - hw - 4, cy - hh - 4, hw * 2 + 8, hh + 6);
    var capGrad = ctx.createLinearGradient(cx - hw, cy - hh, cx + hw, cy);
    capGrad.addColorStop(0, lighter(color, 6));
    capGrad.addColorStop(1, color);
    ctx.fillStyle = capGrad;
    ctx.fill();
    ctx.restore();

    var numDreads = 12;
    var rng = seededRand(hashStr(color + 'dreads'));

    for (var i = 0; i < numDreads; i++) {
      var angle = Math.PI * (0.12 + 0.76 * (i / (numDreads - 1)));
      var ox = Math.cos(angle) * (hw + 1);
      var oy = -Math.sin(angle) * (hh - 8);
      var startX = cx + ox;
      var startY = cy + oy;

      var centerDist = Math.abs(i - numDreads / 2) / (numDreads / 2);
      var len = 20 + (1 - centerDist) * 16 + rng() * 6;
      var sway = (rng() - 0.5) * 10;
      var lw = 3.2 + rng() * 1.2;

      // Dread shadow
      ctx.beginPath();
      ctx.moveTo(startX + 1, startY + 1);
      ctx.bezierCurveTo(startX + sway * 0.4 + 1, startY + len * 0.35 + 1, startX + sway + 1, startY + len * 0.65 + 1, startX + sway * 0.7 + 1, startY + len + 1);
      ctx.lineWidth = lw + 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(startX + sway * 0.4, startY + len * 0.35, startX + sway, startY + len * 0.65, startX + sway * 0.7, startY + len);
      ctx.lineWidth = lw;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(startX + 0.8, startY + 2);
      ctx.bezierCurveTo(startX + sway * 0.4 + 0.8, startY + len * 0.35, startX + sway + 0.8, startY + len * 0.65, startX + sway * 0.7 + 0.8, startY + len);
      ctx.lineWidth = lw * 0.35;
      ctx.strokeStyle = withAlpha(lighter(color, 25), 0.2);
      ctx.stroke();

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

      ctx.beginPath();
      ctx.arc(startX + sway * 0.7, startY + len, lw * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = darker(color, 10);
      ctx.fill();
    }
  }

  function drawHairMohawk(ctx, cx, cy, hw, hh, color) {
    var rng = seededRand(hashStr(color + 'mohawk'));
    ctx.save();
    eggShape(ctx, cx, cy, hw + 1, hh + 1);
    ctx.clip();
    ctx.fillStyle = withAlpha(color, 0.18);
    ctx.beginPath();
    ctx.rect(cx - hw - 2, cy - hh - 2, hw * 2 + 4, hh + 4);
    ctx.fill();
    ctx.fillStyle = withAlpha(color, 0.25);
    for (var s = 0; s < 70; s++) {
      var sx = cx + (rng() - 0.5) * hw * 2;
      var sy = cy - hh * 0.7 + rng() * hh * 1.0;
      if (Math.abs(sx - cx) < 10) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5 + rng() * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    var crestW = 14, crestH = 16;
    ctx.beginPath();
    ctx.moveTo(cx - crestW, cy - hh * 0.15);
    ctx.bezierCurveTo(cx - crestW - 1, cy - hh + 4, cx - crestW * 0.5, cy - hh - crestH + 2, cx, cy - hh - crestH);
    ctx.bezierCurveTo(cx + crestW * 0.5, cy - hh - crestH + 2, cx + crestW + 1, cy - hh + 4, cx + crestW, cy - hh * 0.15);
    ctx.closePath();

    var grad = ctx.createRadialGradient(cx - 4, cy - hh - crestH + 4, 2, cx, cy - hh * 0.15, crestH + 10);
    grad.addColorStop(0, lighter(color, 16));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, darker(color, 10));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = withAlpha(lighter(color, 25), 0.2);
    ctx.lineWidth = 0.8;
    for (var i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 2.5, cy - hh - crestH + 3);
      ctx.quadraticCurveTo(cx + i * 3, cy - hh * 0.5, cx + i * 2.5, cy - hh * 0.2);
      ctx.stroke();
    }

    ctx.strokeStyle = withAlpha(darker(color, 25), 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - crestW, cy - hh * 0.15);
    ctx.bezierCurveTo(cx - crestW - 1, cy - hh + 4, cx - crestW * 0.5, cy - hh - crestH + 2, cx, cy - hh - crestH);
    ctx.bezierCurveTo(cx + crestW * 0.5, cy - hh - crestH + 2, cx + crestW + 1, cy - hh + 4, cx + crestW, cy - hh * 0.15);
    ctx.stroke();
  }

  function drawHairWaves(ctx, cx, cy, hw, hh, color) {
    ctx.save();
    eggShape(ctx, cx, cy, hw + 2, hh + 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(cx - hw - 4, cy - hh - 4, hw * 2 + 8, hh + 8);
    var wavesGrad = ctx.createRadialGradient(cx - 6, cy - hh * 0.5, 3, cx, cy, hw + 5);
    wavesGrad.addColorStop(0, lighter(color, 10));
    wavesGrad.addColorStop(1, color);
    ctx.fillStyle = wavesGrad;
    ctx.fill();

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

    ctx.strokeStyle = withAlpha(darker(color, 20), 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy - hh * 0.08, hw + 1, hh * 0.78, 0, Math.PI * 1.05, Math.PI * 1.95, true);
    ctx.stroke();
  }

  function drawHairCornrows(ctx, cx, cy, hw, hh, color) {
    var numRows = 7;

    ctx.save();
    eggShape(ctx, cx, cy, hw + 2, hh + 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(cx - hw - 4, cy - hh - 4, hw * 2 + 8, hh + 6);
    ctx.fillStyle = darker(color, 12);
    ctx.fill();
    ctx.restore();

    var totalW = hw * 1.5;
    var rowSpacing = totalW / (numRows - 1);
    var firstX = cx - totalW * 0.5;

    ctx.save();
    eggShape(ctx, cx, cy, hw + 2, hh + 2);
    ctx.clip();

    for (var i = 0; i < numRows; i++) {
      var baseX = firstX + i * rowSpacing;
      var distFromCenter = (baseX - cx) / hw;
      var rowStartY = cy - hh + 2;
      var rowEndY = cy + 2;
      var curveBend = distFromCenter * 6;

      ctx.beginPath();
      ctx.moveTo(baseX, rowStartY);
      ctx.bezierCurveTo(baseX + curveBend * 0.3, rowStartY + (rowEndY - rowStartY) * 0.33, baseX + curveBend * 0.7, rowStartY + (rowEndY - rowStartY) * 0.66, baseX + curveBend, rowEndY);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

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

      if (i < numRows - 1) {
        var partX = baseX + rowSpacing * 0.5;
        var partBend = ((partX - cx) / hw) * 5;
        ctx.beginPath();
        ctx.moveTo(partX, rowStartY + 2);
        ctx.bezierCurveTo(partX + partBend * 0.3, rowStartY + (rowEndY - rowStartY) * 0.33, partX + partBend * 0.7, rowStartY + (rowEndY - rowStartY) * 0.66, partX + partBend, rowEndY - 2);
        ctx.strokeStyle = withAlpha(darker(color, 35), 0.35);
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawHairBald(ctx, cx, cy, hw, hh) {
    var hlGrad1 = ctx.createRadialGradient(cx - 10, cy - hh + 6, 2, cx - 10, cy - hh + 6, 16);
    hlGrad1.addColorStop(0, 'rgba(255,255,255,0.15)');
    hlGrad1.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad1;
    ctx.fillRect(cx - 26, cy - hh - 4, 32, 24);

    var hlGrad2 = ctx.createRadialGradient(cx + 6, cy - hh + 4, 1, cx + 6, cy - hh + 4, 10);
    hlGrad2.addColorStop(0, 'rgba(255,255,255,0.08)');
    hlGrad2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad2;
    ctx.fillRect(cx - 4, cy - hh - 2, 20, 16);
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
  function drawBeard(ctx, cx, cy, hw, hh, style, color) {
    if (style === 'none') return;

    var mouthY = cy + 16;
    var jawTop = cy + hh * 0.55;
    var chinBot = cy + hh * 1.1;

    if (style === 'stubble') {
      var rng = seededRand(hashStr(color + 'stubble'));
      ctx.fillStyle = withAlpha(color, 0.38);
      for (var i = 0; i < 90; i++) {
        var sx = cx + (rng() - 0.5) * hw * 1.1;
        var sy = mouthY - 2 + rng() * (chinBot - mouthY + 6);
        var distFromCenter = Math.abs(sx - cx) / hw;
        if (distFromCenter > 0.75 || sy < mouthY - 3) continue;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.5 + rng() * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (style === 'short') {
      var shortTop = mouthY + 5;
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.4, shortTop);
      ctx.quadraticCurveTo(cx - hw * 0.45, jawTop + 6, cx - hw * 0.3, chinBot + 2);
      ctx.quadraticCurveTo(cx, chinBot + 6, cx + hw * 0.3, chinBot + 2);
      ctx.quadraticCurveTo(cx + hw * 0.45, jawTop + 6, cx + hw * 0.4, shortTop);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.65);
      ctx.fill();

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

      ctx.beginPath();
      ctx.moveTo(cx - 7, mouthY - 1);
      ctx.quadraticCurveTo(cx, mouthY - 4, cx + 7, mouthY - 1);
      ctx.quadraticCurveTo(cx, mouthY + 2, cx - 7, mouthY - 1);
      ctx.fillStyle = withAlpha(color, 0.7);
      ctx.fill();
      return;
    }

    if (style === 'full') {
      var sbW = 5;
      var sbTopY = mouthY - 4;
      ctx.beginPath();
      ctx.moveTo(cx - hw + 5, sbTopY);
      ctx.quadraticCurveTo(cx - hw + 3, jawTop + 2, cx - hw * 0.38, chinBot);
      ctx.lineTo(cx - hw * 0.38 + sbW, chinBot - 2);
      ctx.quadraticCurveTo(cx - hw + sbW + 3, jawTop + 2, cx - hw + sbW + 3, sbTopY);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.75);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + hw - 5, sbTopY);
      ctx.quadraticCurveTo(cx + hw - 3, jawTop + 2, cx + hw * 0.38, chinBot);
      ctx.lineTo(cx + hw * 0.38 - sbW, chinBot - 2);
      ctx.quadraticCurveTo(cx + hw - sbW - 3, jawTop + 2, cx + hw - sbW - 3, sbTopY);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.75);
      ctx.fill();

      var beardTop = mouthY + 4;
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.45, beardTop);
      ctx.quadraticCurveTo(cx - hw * 0.5, jawTop + 4, cx - hw * 0.32, chinBot + 4);
      ctx.quadraticCurveTo(cx, chinBot + 10, cx + hw * 0.32, chinBot + 4);
      ctx.quadraticCurveTo(cx + hw * 0.5, jawTop + 4, cx + hw * 0.45, beardTop);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

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

      ctx.beginPath();
      ctx.moveTo(cx - 9, mouthY - 1);
      ctx.quadraticCurveTo(cx, mouthY - 5, cx + 9, mouthY - 1);
      ctx.quadraticCurveTo(cx, mouthY + 2, cx - 9, mouthY - 1);
      ctx.fillStyle = color;
      ctx.fill();
    }

    if (style === 'goatee') {
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.25, mouthY + 3);
      ctx.quadraticCurveTo(cx - hw * 0.3, jawTop + 6, cx - hw * 0.2, chinBot + 6);
      ctx.quadraticCurveTo(cx, chinBot + 10, cx + hw * 0.2, chinBot + 6);
      ctx.quadraticCurveTo(cx + hw * 0.3, jawTop + 6, cx + hw * 0.25, mouthY + 3);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.75);
      ctx.fill();

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

      ctx.beginPath();
      ctx.moveTo(cx - 7, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY - 4, cx + 7, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY + 1, cx - 7, mouthY - 2);
      ctx.fillStyle = withAlpha(color, 0.75);
      ctx.fill();
    }

    if (style === 'chinstrap') {
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.52, mouthY + 2);
      ctx.quadraticCurveTo(cx - hw * 0.58, jawTop + 8, cx - hw * 0.35, chinBot + 1);
      ctx.quadraticCurveTo(cx, chinBot + 4, cx + hw * 0.35, chinBot + 1);
      ctx.quadraticCurveTo(cx + hw * 0.58, jawTop + 8, cx + hw * 0.52, mouthY + 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();

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
    // Ball shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + 2, y + r + 4, r * 0.8, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();
    ctx.restore();

    var ballGrad = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, r);
    ballGrad.addColorStop(0, '#fcc549');
    ballGrad.addColorStop(0.5, '#f5a623');
    ballGrad.addColorStop(1, '#c47a10');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Ball seams
    ctx.strokeStyle = darker('#f5a623', 40);
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

    // Pebble texture
    var rng = seededRand(42);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (var i = 0; i < 10; i++) {
      var dx = (rng() - 0.5) * r * 1.4;
      var dy = (rng() - 0.5) * r * 1.4;
      if (dx * dx + dy * dy < r * r * 0.7) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ball specular highlight
    var specGrad = ctx.createRadialGradient(x - 4, y - 5, 0.5, x - 4, y - 5, 6);
    specGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGrad;
    ctx.fillRect(x - 10, y - 11, 12, 12);

    // Finger hints
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
      ctx.save();
      var hbY = cy - hh * 0.55;
      var hbH = 8;
      eggShape(ctx, cx, cy, hw + 1, hh + 1);
      ctx.clip();
      // Headband gradient
      var hbGrad = ctx.createLinearGradient(cx - hw, hbY, cx + hw, hbY);
      hbGrad.addColorStop(0, '#e8941a');
      hbGrad.addColorStop(0.5, '#f5a623');
      hbGrad.addColorStop(1, '#d4891a');
      ctx.fillStyle = hbGrad;
      ctx.fillRect(cx - hw - 3, hbY, hw * 2 + 6, hbH);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(cx - hw - 3, hbY + hbH * 0.4, hw * 2 + 6, 1.5);
      // Logo
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, hbY + hbH / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (accessory === 'sweatband') {
      ctx.save();
      var swY = cy - hh * 0.5;
      var swH = 9;
      eggShape(ctx, cx, cy, hw + 1, hh + 1);
      ctx.clip();
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(cx - hw - 3, swY, hw * 2 + 6, swH);
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
      var glY = cy - 4;
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx - 5, glY);
      ctx.quadraticCurveTo(cx, glY - 2, cx + 5, glY);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx - 13, glY, 10, 5.5, -0.05, 0, Math.PI * 2);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(30,30,45,0.3)';
      ctx.fill();
      // Lens reflection
      var lensRef = ctx.createLinearGradient(cx - 22, glY - 4, cx - 8, glY + 2);
      lensRef.addColorStop(0, 'rgba(255,255,255,0.12)');
      lensRef.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lensRef;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 13, glY, 10, 5.5, 0.05, 0, Math.PI * 2);
      ctx.strokeStyle = '#222';
      ctx.stroke();
      ctx.fillStyle = 'rgba(30,30,45,0.3)';
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 23, glY);
      ctx.lineTo(cx - hw + 1, glY + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 23, glY);
      ctx.lineTo(cx + hw - 1, glY + 2);
      ctx.stroke();
    }

    if (accessory === 'chain') {
      var chainY = 144;
      // Chain glow
      ctx.save();
      ctx.shadowColor = 'rgba(245,166,35,0.3)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#f5a623';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 16, chainY);
      ctx.quadraticCurveTo(cx, chainY + 14, cx + 16, chainY);
      ctx.stroke();
      ctx.restore();

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
      // Pendant with glow
      ctx.save();
      ctx.shadowColor = 'rgba(245,166,35,0.4)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.arc(cx, chainY + 14, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#0c0d0f';
      ctx.font = "bold 5px 'Barlow Condensed', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IQ', cx, chainY + 14.5);
    }

    if (accessory === 'durag') {
      ctx.save();
      eggShape(ctx, cx, cy, hw + 3, hh + 3);
      ctx.clip();
      var duragGrad = ctx.createLinearGradient(cx - hw, cy - hh, cx + hw, cy);
      duragGrad.addColorStop(0, '#243d6e');
      duragGrad.addColorStop(1, '#1a2d5a');
      ctx.fillStyle = duragGrad;
      ctx.fillRect(cx - hw - 5, cy - hh - 5, hw * 2 + 10, hh + 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh - 2);
      ctx.lineTo(cx, cy - 2);
      ctx.stroke();
      // Silky sheen
      var sheenGrad = ctx.createLinearGradient(cx - hw, cy - hh, cx - hw + 15, cy);
      sheenGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
      sheenGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheenGrad;
      ctx.fillRect(cx - hw - 5, cy - hh - 5, 20, hh + 8);
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - hh + 4);
      ctx.quadraticCurveTo(cx + 10, cy - hh - 10, cx + 20, cy - hh + 8);
      ctx.quadraticCurveTo(cx + 25, cy - hh + 18, cx + 15, cy - hh + 28);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1a2d5a';
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.fillStyle = '#1a2d5a';
      ctx.beginPath();
      ctx.ellipse(cx, cy - hh + 6, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (accessory === 'armband') {
      var bw = cfg.bodyType === 'heavy' ? 88 : cfg.bodyType === 'athletic' ? 76 : 62;
      var armW = cfg.bodyType === 'heavy' ? 18 : cfg.bodyType === 'athletic' ? 16 : 14;
      var armX = cx - bw / 2 - armW + 3;
      var armBandY = BODY_Y + 20;
      ctx.save();
      ctx.shadowColor = 'rgba(245,166,35,0.2)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#f5a623';
      ctx.fillRect(armX - 1, armBandY, armW + 2, 5);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(armX - 1, armBandY + 2, armW + 2, 1);
    }
  }

  /* ── Ambient Particles (floating light dots) ────────────────── */
  function drawParticles(ctx) {
    var rng = seededRand(777);
    for (var i = 0; i < 12; i++) {
      var px = 10 + rng() * (AW - 20);
      var py = 10 + rng() * (AH - 20);
      var pr = 0.5 + rng() * 1.2;
      var pa = 0.04 + rng() * 0.08;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245,200,120,' + pa + ')';
      ctx.fill();
    }
  }

  /* ── Main Draw ─────────────────────────────────────────────── */
  function draw(canvas, cfg) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    cfg = Object.assign({}, defaults, cfg || {});

    ctx.clearRect(0, 0, AW, AH);

    // 1. Background with spotlight + vignette
    drawBackground(ctx);

    var cx = HEAD_CX;
    var cy = HEAD_CY;

    // 2. Body (includes shorts, hands, jersey)
    drawBody(ctx, cx, cfg);

    // 3. Neck
    drawNeck(ctx, cx, cfg.skinTone);

    // 4. Hair behind head (afro)
    if (cfg.hairStyle === 'afro') {
      drawHair(ctx, cx, cy, HEAD_W, HEAD_H, 'afro', cfg.hairColor);
    }

    // 5. Head (with enhanced shading + rim light)
    drawHead(ctx, cx, cy, cfg.skinTone);

    // 6. Hair (other styles)
    if (cfg.hairStyle !== 'afro') {
      drawHair(ctx, cx, cy, HEAD_W, HEAD_H, cfg.hairStyle, cfg.hairColor);
    }

    // 7. Face (enhanced eyes)
    drawFace(ctx, cx, cy, cfg.skinTone);

    // 8. Beard
    if (cfg.beardStyle !== 'none') {
      drawBeard(ctx, cx, cy, HEAD_W, HEAD_H, cfg.beardStyle, cfg.hairColor);
    }

    // 9. Accessories
    drawAccessory(ctx, cx, cy, HEAD_W, HEAD_H, cfg.accessory, cfg);

    // 10. Basketball
    drawBall(ctx, cx + 52, 216, 13, cfg.skinTone);

    // 11. Ambient particles
    drawParticles(ctx);
  }

  /* ── Mini Avatar (48x48, head only — enhanced) ──────────────── */
  function drawMini(canvas, cfg) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var s = 48;
    cfg = Object.assign({}, defaults, cfg || {});

    ctx.clearRect(0, 0, s, s);

    // Background circle with gradient
    var bgGrad = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    bgGrad.addColorStop(0, '#1e2028');
    bgGrad.addColorStop(1, '#14161a');
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Subtle rim glow
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,166,35,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    var cx = s / 2;
    var cy = s / 2 + 2;
    var hw = 15, hh = 17;

    // Afro behind head
    if (cfg.hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(cx, cy - 3, 22, 0, Math.PI * 2);
      var afroMiniGrad = ctx.createRadialGradient(cx - 4, cy - 8, 2, cx, cy - 3, 22);
      afroMiniGrad.addColorStop(0, lighter(cfg.hairColor, 12));
      afroMiniGrad.addColorStop(1, cfg.hairColor);
      ctx.fillStyle = afroMiniGrad;
      ctx.fill();
    }

    // Head with gradient
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    ctx.fillStyle = cfg.skinTone;
    ctx.fill();

    // Head highlight
    var hlGrad = ctx.createRadialGradient(cx - 3, cy - 7, 2, cx, cy, hh);
    hlGrad.addColorStop(0, withAlpha(lighter(cfg.skinTone, 30), 0.4));
    hlGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mini rim light (left edge)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    ctx.clip();
    var miniRim = ctx.createLinearGradient(cx - hw - 2, cy, cx - hw + 8, cy);
    miniRim.addColorStop(0, 'rgba(150,190,255,0.2)');
    miniRim.addColorStop(1, 'rgba(150,190,255,0)');
    ctx.fillStyle = miniRim;
    ctx.fillRect(cx - hw - 2, cy - hh, 10, hh * 2);
    ctx.restore();

    // Hair (simplified per style)
    if (cfg.hairStyle !== 'bald' && cfg.hairStyle !== 'afro') {
      ctx.fillStyle = cfg.hairColor;
      if (cfg.hairStyle === 'buzz' || cfg.hairStyle === 'waves') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillRect(cx - hw - 2, cy - hh - 2, hw * 2 + 4, hh);
        if (cfg.hairStyle === 'waves') {
          for (var wr = 0; wr < 4; wr++) {
            ctx.beginPath();
            ctx.arc(cx - 1, cy - hh * 0.2, 3 + wr * 3, Math.PI * 0.2, Math.PI * 0.8);
            ctx.strokeStyle = withAlpha(lighter(cfg.hairColor, 20), 0.25);
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
        ctx.restore();
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
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy - hh * 0.2);
        ctx.bezierCurveTo(cx - 5, cy - hh, cx - 3, cy - hh - 8, cx, cy - hh - 9);
        ctx.bezierCurveTo(cx + 3, cy - hh - 8, cx + 5, cy - hh, cx + 4, cy - hh * 0.2);
        ctx.closePath();
        ctx.fill();
      } else if (cfg.hairStyle === 'cornrows') {
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
      var bhGrad = ctx.createRadialGradient(cx - 3, cy - hh + 5, 1, cx - 3, cy - hh + 5, 10);
      bhGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
      bhGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bhGrad;
      ctx.fillRect(cx - 13, cy - hh, 20, 14);
    }

    // Eyes (enhanced with larger highlights)
    ctx.fillStyle = '#f8f5ef';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 1, 3.2, 2.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 5, cy - 1, 3.2, 2.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iris
    ctx.fillStyle = '#2a1f14';
    ctx.beginPath();
    ctx.arc(cx - 4.5, cy - 1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5.5, cy - 1, 2, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(cx - 4.5, cy - 1, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5.5, cy - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlights (bigger for more life)
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx - 5.5, cy - 2.2, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4.5, cy - 2.2, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.moveTo(cx - 3.5, cy + 5);
    ctx.quadraticCurveTo(cx, cy + 7.5, cx + 3.5, cy + 5);
    ctx.strokeStyle = withAlpha(darker(cfg.skinTone, 25), 0.5);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Beard hint
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
