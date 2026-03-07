/* ============================================================
   AVATAR BUILDER v4 — /js/avatar-builder.js
   High-quality canvas avatar with realistic gaming proportions.
   ~5.5 head-tall figure, detailed clothing, sneakers, shading.
   ============================================================ */
(function () {
  'use strict';

  var AW = 200, AH = 280;

  /* ── Layout Constants (realistic proportions) ────────────── */
  var CX = 100;                     // horizontal center
  var HEAD_CY = 52;                 // head center Y
  var HEAD_RX = 24, HEAD_RY = 28;   // head semi-axes (smaller head)

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

  /* ── Body dimension helper ──────────────────────────────── */
  function bodyDims(bt) {
    var s = bt === 'lean' ? 0.88 : bt === 'heavy' ? 1.14 : 1.0;
    return {
      shoulderHW: Math.round(34 * s),  // half-width at shoulders
      chestHW:    Math.round(30 * s),
      waistHW:    Math.round(26 * s),
      armW:       Math.round(11 * s),
      legW:       Math.round(12 * s),
      legOff:     14                    // leg center offset from CX
    };
  }

  /* ── Color Utilities ─────────────────────────────────────── */
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

  function lerpColor(h1, h2, t) {
    var r1 = parseInt(h1.slice(1,3),16), g1 = parseInt(h1.slice(3,5),16), b1 = parseInt(h1.slice(5,7),16);
    var r2 = parseInt(h2.slice(1,3),16), g2 = parseInt(h2.slice(3,5),16), b2 = parseInt(h2.slice(5,7),16);
    var r = Math.round(r1+(r2-r1)*t), g = Math.round(g1+(g2-g1)*t), b = Math.round(b1+(b2-b1)*t);
    return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }

  /* ── Seeded PRNG ─────────────────────────────────────────── */
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
  function seededRand(seed) {
    var s = seed;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  /* ── Shape Helpers ───────────────────────────────────────── */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* Head shape with jawline (narrower chin than forehead) */
  function headShape(ctx, cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    // Right forehead → cheek
    ctx.bezierCurveTo(cx + rx * 0.75, cy - ry, cx + rx, cy - ry * 0.4, cx + rx, cy + ry * 0.05);
    // Right cheek → jaw
    ctx.bezierCurveTo(cx + rx * 0.98, cy + ry * 0.45, cx + rx * 0.7, cy + ry * 0.82, cx + rx * 0.38, cy + ry);
    // Chin
    ctx.quadraticCurveTo(cx, cy + ry * 1.08, cx - rx * 0.38, cy + ry);
    // Left jaw → cheek
    ctx.bezierCurveTo(cx - rx * 0.7, cy + ry * 0.82, cx - rx * 0.98, cy + ry * 0.45, cx - rx, cy + ry * 0.05);
    // Left cheek → forehead
    ctx.bezierCurveTo(cx - rx, cy - ry * 0.4, cx - rx * 0.75, cy - ry, cx, cy - ry);
    ctx.closePath();
  }

  /* ── Drawing: Background ─────────────────────────────────── */
  function drawBackground(ctx) {
    roundRect(ctx, 0, 0, AW, AH, 12);
    ctx.fillStyle = '#0a0b0e';
    ctx.fill();

    // Warm spotlight bottom-right
    var spot = ctx.createRadialGradient(AW * 0.62, AH * 0.78, 15, AW * 0.5, AH * 0.55, AH * 0.65);
    spot.addColorStop(0, 'rgba(245,166,35,0.10)');
    spot.addColorStop(0.4, 'rgba(245,166,35,0.04)');
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, AW, AH);

    // Cool rim light upper-left
    var cool = ctx.createRadialGradient(AW * 0.15, AH * 0.12, 8, AW * 0.3, AH * 0.3, AH * 0.55);
    cool.addColorStop(0, 'rgba(120,160,255,0.07)');
    cool.addColorStop(0.5, 'rgba(120,160,255,0.02)');
    cool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cool;
    ctx.fillRect(0, 0, AW, AH);

    // Floor glow
    var fl = ctx.createLinearGradient(0, AH - 40, 0, AH);
    fl.addColorStop(0, 'rgba(245,166,35,0)');
    fl.addColorStop(0.6, 'rgba(245,166,35,0.03)');
    fl.addColorStop(1, 'rgba(245,166,35,0.07)');
    ctx.fillStyle = fl;
    ctx.fillRect(0, AH - 40, AW, 40);

    // Vignette
    var vig = ctx.createRadialGradient(AW / 2, AH / 2, AW * 0.3, AW / 2, AH / 2, AW * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, AW, AH);
  }

  /* ── Drawing: Ground shadow ─────────────────────────────── */
  function drawGroundShadow(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(CX, AH - 12, 48, 7, 0, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(CX, AH - 12, 2, CX, AH - 12, 48);
    g.addColorStop(0, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  /* ── Drawing: Legs ──────────────────────────────────────── */
  function drawLegs(ctx, cfg) {
    var d = bodyDims(cfg.bodyType);
    var skin = cfg.skinTone;
    var legTop = 194;
    var legBot = 248;
    var legH = legBot - legTop;

    // Left leg
    ctx.save();
    var lgL = ctx.createLinearGradient(0, legTop, 0, legBot);
    lgL.addColorStop(0, skin);
    lgL.addColorStop(0.5, darker(skin, 8));
    lgL.addColorStop(1, darker(skin, 18));
    ctx.fillStyle = lgL;
    roundRect(ctx, CX - d.legOff - d.legW / 2, legTop, d.legW, legH, 5);
    ctx.fill();
    // Left leg highlight
    ctx.fillStyle = withAlpha(lighter(skin, 20), 0.15);
    ctx.fillRect(CX - d.legOff - d.legW / 2 + 2, legTop + 4, 3, legH - 12);
    ctx.restore();

    // Right leg
    ctx.save();
    var lgR = ctx.createLinearGradient(0, legTop, 0, legBot);
    lgR.addColorStop(0, skin);
    lgR.addColorStop(0.5, darker(skin, 10));
    lgR.addColorStop(1, darker(skin, 20));
    ctx.fillStyle = lgR;
    roundRect(ctx, CX + d.legOff - d.legW / 2, legTop, d.legW, legH, 5);
    ctx.fill();
    ctx.restore();

    // Knee hints
    ctx.strokeStyle = withAlpha(darker(skin, 20), 0.15);
    ctx.lineWidth = 1;
    var kneeY = legTop + legH * 0.45;
    ctx.beginPath();
    ctx.moveTo(CX - d.legOff - 3, kneeY);
    ctx.quadraticCurveTo(CX - d.legOff, kneeY + 2, CX - d.legOff + 3, kneeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CX + d.legOff - 3, kneeY);
    ctx.quadraticCurveTo(CX + d.legOff, kneeY + 2, CX + d.legOff + 3, kneeY);
    ctx.stroke();
  }

  /* ── Drawing: Shoes ─────────────────────────────────────── */
  function drawShoes(ctx, cfg) {
    var d = bodyDims(cfg.bodyType);
    var shoeY = 246;
    var shoeH = 16;
    var shoeW = d.legW + 8;

    [-1, 1].forEach(function (side) {
      var sx = CX + side * d.legOff;
      var lx = sx - shoeW / 2;

      // Sole
      ctx.save();
      roundRect(ctx, lx - 1, shoeY + shoeH - 4, shoeW + 2, 4, 2);
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.restore();

      // Upper shoe
      ctx.save();
      var sg = ctx.createLinearGradient(0, shoeY, 0, shoeY + shoeH);
      sg.addColorStop(0, '#333');
      sg.addColorStop(0.5, '#252525');
      sg.addColorStop(1, '#1a1a1a');
      roundRect(ctx, lx, shoeY, shoeW, shoeH - 2, 4);
      ctx.fillStyle = sg;
      ctx.fill();

      // High-top collar
      ctx.beginPath();
      ctx.moveTo(lx + 2, shoeY + 2);
      ctx.lineTo(lx + shoeW - 2, shoeY + 2);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Swoosh accent
      ctx.beginPath();
      ctx.moveTo(lx + 3, shoeY + shoeH - 6);
      ctx.quadraticCurveTo(sx, shoeY + 3, lx + shoeW - 3, shoeY + shoeH - 7);
      ctx.strokeStyle = '#f5a623';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // Lace area dots
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (var li = 0; li < 3; li++) {
        ctx.beginPath();
        ctx.arc(sx, shoeY + 4 + li * 3, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Toe cap highlight
      var toe = ctx.createLinearGradient(lx, shoeY + 6, lx + shoeW, shoeY + 6);
      toe.addColorStop(0, 'rgba(255,255,255,0.04)');
      toe.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      toe.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = toe;
      ctx.fillRect(lx + 1, shoeY + shoeH - 8, shoeW - 2, 4);
      ctx.restore();
    });
  }

  /* ── Drawing: Shorts ────────────────────────────────────── */
  function drawShorts(ctx, cfg) {
    var d = bodyDims(cfg.bodyType);
    var top = 156;
    var bot = 198;
    var hw_top = d.waistHW + 2;
    var hw_bot = d.waistHW + 6;

    // Main shorts shape
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(CX - hw_top, top);
    ctx.lineTo(CX + hw_top, top);
    ctx.lineTo(CX + hw_bot, bot);
    // Crotch V-shape
    ctx.quadraticCurveTo(CX + 4, bot - 6, CX, bot - 4);
    ctx.quadraticCurveTo(CX - 4, bot - 6, CX - hw_bot, bot);
    ctx.closePath();

    var sg = ctx.createLinearGradient(0, top, 0, bot);
    sg.addColorStop(0, '#1c1e26');
    sg.addColorStop(1, '#101216');
    ctx.fillStyle = sg;
    ctx.fill();

    // Side stripes
    ctx.fillStyle = 'rgba(245,166,35,0.2)';
    ctx.fillRect(CX - hw_top + 2, top + 2, 3, bot - top - 6);
    ctx.fillRect(CX + hw_top - 5, top + 2, 3, bot - top - 6);

    // Waistband
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(CX - hw_top + 1, top, hw_top * 2 - 2, 3);

    // Hem highlights
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX - hw_bot, bot);
    ctx.quadraticCurveTo(CX, bot - 4, CX + hw_bot, bot);
    ctx.stroke();

    // Rim light left edge
    ctx.fillStyle = 'rgba(140,180,255,0.06)';
    ctx.fillRect(CX - hw_bot, top, 3, bot - top);
    ctx.restore();
  }

  /* ── Drawing: Jersey / Torso ─────────────────────────────── */
  function drawJersey(ctx, cfg) {
    var d = bodyDims(cfg.bodyType);
    var top = 86;   // shoulder line
    var bot = 160;  // jersey hem
    var shw = d.shoulderHW;
    var whw = d.waistHW;
    var sleeveBot = 108; // where sleeves end

    // Jersey body shape
    ctx.save();
    ctx.beginPath();
    // Neckline (V-neck)
    ctx.moveTo(CX - 10, top);
    ctx.lineTo(CX - shw, top + 4);          // left shoulder
    ctx.lineTo(CX - shw - 2, sleeveBot);    // left sleeve outer
    ctx.lineTo(CX - shw + 8, sleeveBot + 2); // left sleeve inner (armhole)
    ctx.lineTo(CX - whw, bot);               // left waist
    ctx.lineTo(CX + whw, bot);               // right waist
    ctx.lineTo(CX + shw - 8, sleeveBot + 2); // right armhole
    ctx.lineTo(CX + shw + 2, sleeveBot);    // right sleeve outer
    ctx.lineTo(CX + shw, top + 4);          // right shoulder
    ctx.lineTo(CX + 10, top);               // right neck
    // V-neck
    ctx.quadraticCurveTo(CX, top + 16, CX - 10, top);
    ctx.closePath();

    var jg = ctx.createLinearGradient(CX - shw, top, CX + shw, bot);
    jg.addColorStop(0, '#1e2848');
    jg.addColorStop(0.5, '#1a2744');
    jg.addColorStop(1, '#151f38');
    ctx.fillStyle = jg;
    ctx.fill();

    // Fabric grain texture
    var rng = seededRand(hashStr(cfg.position + 'jersey'));
    ctx.fillStyle = 'rgba(255,255,255,0.012)';
    for (var fi = 0; fi < 40; fi++) {
      ctx.fillRect(
        CX - whw + rng() * whw * 2,
        top + 10 + rng() * (bot - top - 20),
        1, 2
      );
    }

    // Side panels (slightly lighter)
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(CX - whw, top + 20, 6, bot - top - 30);
    ctx.fillRect(CX + whw - 6, top + 20, 6, bot - top - 30);

    // Jersey side stripes
    var stripeG = ctx.createLinearGradient(0, top + 10, 0, bot - 8);
    stripeG.addColorStop(0, 'rgba(245,166,35,0.15)');
    stripeG.addColorStop(0.5, 'rgba(245,166,35,0.25)');
    stripeG.addColorStop(1, 'rgba(245,166,35,0.1)');
    ctx.fillStyle = stripeG;
    ctx.fillRect(CX - whw + 1, top + 18, 2.5, bot - top - 28);
    ctx.fillRect(CX + whw - 3.5, top + 18, 2.5, bot - top - 28);

    // V-neck collar detail
    ctx.beginPath();
    ctx.moveTo(CX - 11, top + 1);
    ctx.quadraticCurveTo(CX, top + 17, CX + 11, top + 1);
    ctx.strokeStyle = '#c89b3c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Collar outline
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Sleeve hems
    ctx.strokeStyle = '#c89b3c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX - shw - 2, sleeveBot);
    ctx.lineTo(CX - shw + 8, sleeveBot + 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CX + shw + 2, sleeveBot);
    ctx.lineTo(CX + shw - 8, sleeveBot + 2);
    ctx.stroke();

    // Jersey number
    ctx.save();
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var numY = top + 50;
    var pos = cfg.position || 'SG';
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(pos, CX + 1, numY + 1);
    // Outline
    ctx.strokeStyle = '#0d1520';
    ctx.lineWidth = 3;
    ctx.strokeText(pos, CX, numY);
    // Fill
    ctx.fillStyle = '#c89b3c';
    ctx.fillText(pos, CX, numY);
    // Highlight
    ctx.fillStyle = 'rgba(255,220,120,0.25)';
    ctx.fillText(pos, CX, numY - 0.5);
    ctx.restore();

    // Jersey hem line
    ctx.beginPath();
    ctx.moveTo(CX - whw + 2, bot);
    ctx.lineTo(CX + whw - 2, bot);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rim light left edge
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(CX - 10, top);
    ctx.lineTo(CX - shw, top + 4);
    ctx.lineTo(CX - shw - 2, sleeveBot);
    ctx.lineTo(CX - shw + 8, sleeveBot + 2);
    ctx.lineTo(CX - whw, bot);
    ctx.lineTo(CX - whw + 10, bot);
    ctx.lineTo(CX - shw + 16, sleeveBot + 2);
    ctx.lineTo(CX - shw + 6, sleeveBot);
    ctx.lineTo(CX - shw + 10, top + 4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(140,180,255,0.06)';
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  /* ── Drawing: Arms & Hands ──────────────────────────────── */
  function drawArms(ctx, cfg) {
    var d = bodyDims(cfg.bodyType);
    var skin = cfg.skinTone;
    var armTop = 108; // below sleeve
    var armBot = 176;
    var armH = armBot - armTop;

    [-1, 1].forEach(function (side) {
      var topX = CX + side * (d.shoulderHW - 4);
      var botX = CX + side * (d.shoulderHW + 8);
      var w = d.armW;

      ctx.save();
      // Arm shape (trapezoid angled outward)
      ctx.beginPath();
      ctx.moveTo(topX - w / 2 * side, armTop);
      ctx.lineTo(topX + w / 2 * side, armTop);
      ctx.lineTo(botX + (w - 2) / 2 * side, armBot);
      ctx.lineTo(botX - (w - 2) / 2 * side, armBot);
      ctx.closePath();

      var ag = ctx.createLinearGradient(topX - w, armTop, topX + w, armBot);
      if (side === -1) {
        // Left arm (facing light)
        ag.addColorStop(0, lighter(skin, 8));
        ag.addColorStop(0.6, skin);
        ag.addColorStop(1, darker(skin, 12));
      } else {
        ag.addColorStop(0, darker(skin, 8));
        ag.addColorStop(0.5, skin);
        ag.addColorStop(1, darker(skin, 15));
      }
      ctx.fillStyle = ag;
      ctx.fill();

      // Rim light on left arm
      if (side === -1) {
        ctx.fillStyle = 'rgba(150,190,255,0.08)';
        ctx.fillRect(topX - w / 2 - 1, armTop, 3, armH);
      }

      // Wrist line
      ctx.strokeStyle = withAlpha(darker(skin, 20), 0.2);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(botX - 4, armBot - 6);
      ctx.lineTo(botX + 4, armBot - 6);
      ctx.stroke();

      // Hand (circle)
      var handX = botX;
      var handY = armBot + 4;
      var handR = w * 0.52;
      ctx.beginPath();
      ctx.arc(handX, handY, handR, 0, Math.PI * 2);
      var hg = ctx.createRadialGradient(handX - 1, handY - 1, 0, handX, handY, handR);
      hg.addColorStop(0, lighter(skin, 10));
      hg.addColorStop(1, darker(skin, 10));
      ctx.fillStyle = hg;
      ctx.fill();

      // Thumb hint
      if (side === 1) {
        ctx.beginPath();
        ctx.ellipse(handX - handR * 0.6, handY + 1, handR * 0.35, handR * 0.55, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = darker(skin, 5);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  /* ── Drawing: Neck ──────────────────────────────────────── */
  function drawNeck(ctx, cfg) {
    var skin = cfg.skinTone;
    var neckW = 14;
    var neckTop = 74;
    var neckBot = 90;

    var ng = ctx.createLinearGradient(0, neckTop, 0, neckBot);
    ng.addColorStop(0, skin);
    ng.addColorStop(1, darker(skin, 12));
    ctx.fillStyle = ng;
    roundRect(ctx, CX - neckW, neckTop, neckW * 2, neckBot - neckTop, 4);
    ctx.fill();

    // Chin shadow on neck
    var cs = ctx.createLinearGradient(0, neckTop - 2, 0, neckTop + 10);
    cs.addColorStop(0, 'rgba(0,0,0,0.12)');
    cs.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cs;
    ctx.fillRect(CX - neckW, neckTop - 2, neckW * 2, 12);

    // Rim light (left edge)
    ctx.fillStyle = 'rgba(150,190,255,0.06)';
    ctx.fillRect(CX - neckW - 1, neckTop, 3, neckBot - neckTop);
  }

  /* ── Drawing: Head ──────────────────────────────────────── */
  function drawHead(ctx, cfg) {
    var cx = CX, cy = HEAD_CY;
    var rx = HEAD_RX, ry = HEAD_RY;
    var skin = cfg.skinTone;

    // Main head fill
    headShape(ctx, cx, cy, rx, ry);
    var hg = ctx.createRadialGradient(cx - 4, cy - 8, 2, cx, cy, ry);
    hg.addColorStop(0, lighter(skin, 15));
    hg.addColorStop(0.5, skin);
    hg.addColorStop(1, darker(skin, 10));
    ctx.fillStyle = hg;
    ctx.fill();

    // Cheek blush (subtle warmth)
    ctx.save();
    headShape(ctx, cx, cy, rx, ry);
    ctx.clip();
    var blushL = ctx.createRadialGradient(cx - rx * 0.55, cy + ry * 0.2, 1, cx - rx * 0.55, cy + ry * 0.2, 10);
    blushL.addColorStop(0, withAlpha(lighter(skin, 20), 0.15));
    blushL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blushL;
    ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    var blushR = ctx.createRadialGradient(cx + rx * 0.55, cy + ry * 0.2, 1, cx + rx * 0.55, cy + ry * 0.2, 10);
    blushR.addColorStop(0, withAlpha(lighter(skin, 18), 0.12));
    blushR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blushR;
    ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.restore();

    // Shadow on right side
    ctx.save();
    headShape(ctx, cx, cy, rx, ry);
    ctx.clip();
    var shadowG = ctx.createLinearGradient(cx + rx * 0.3, cy, cx + rx + 2, cy);
    shadowG.addColorStop(0, 'rgba(0,0,0,0)');
    shadowG.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = shadowG;
    ctx.fillRect(cx, cy - ry, rx + 4, ry * 2 + 4);
    ctx.restore();

    // Ears
    ctx.save();
    ctx.fillStyle = darker(skin, 8);
    // Left ear
    ctx.beginPath();
    ctx.ellipse(cx - rx + 2, cy + 2, 4, 6.5, -0.1, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - rx + 3.5, cy + 2, 2, 3.5, -0.1, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.fillStyle = darker(skin, 18);
    ctx.fill();
    // Right ear
    ctx.fillStyle = darker(skin, 12);
    ctx.beginPath();
    ctx.ellipse(cx + rx - 2, cy + 2, 4, 6.5, 0.1, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + rx - 3.5, cy + 2, 2, 3.5, 0.1, Math.PI * 0.6, Math.PI * 1.4);
    ctx.fillStyle = darker(skin, 22);
    ctx.fill();
    ctx.restore();

    // Jaw shadow
    ctx.save();
    headShape(ctx, cx, cy, rx, ry);
    ctx.clip();
    var jawG = ctx.createLinearGradient(0, cy + ry - 14, 0, cy + ry + 2);
    jawG.addColorStop(0, 'rgba(0,0,0,0)');
    jawG.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = jawG;
    ctx.fillRect(cx - rx, cy + ry - 14, rx * 2, 18);
    ctx.restore();

    // Rim light (cool blue on left edge)
    ctx.save();
    headShape(ctx, cx, cy, rx, ry);
    ctx.clip();
    var rimG = ctx.createLinearGradient(cx - rx - 3, cy, cx - rx + 12, cy);
    rimG.addColorStop(0, 'rgba(150,190,255,0.18)');
    rimG.addColorStop(0.5, 'rgba(150,190,255,0.05)');
    rimG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rimG;
    ctx.fillRect(cx - rx - 4, cy - ry, 16, ry * 2 + 4);
    ctx.restore();
  }

  /* ── Drawing: Face ──────────────────────────────────────── */
  function drawFace(ctx, cfg) {
    var cx = CX, cy = HEAD_CY;
    var rx = HEAD_RX, ry = HEAD_RY;
    var skin = cfg.skinTone;
    var isDark = hexBrightness(skin) < 100;

    /* ── Eyebrows ── */
    var browY = cy - 6;
    var browColor = isDark ? 'rgba(0,0,0,0.45)' : withAlpha(darker(cfg.hairColor, 20), 0.55);
    ctx.save();
    ctx.strokeStyle = browColor;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    // Left eyebrow
    ctx.beginPath();
    ctx.moveTo(cx - 16, browY + 1);
    ctx.quadraticCurveTo(cx - 11, browY - 2.5, cx - 5, browY + 0.5);
    ctx.stroke();
    // Right eyebrow
    ctx.beginPath();
    ctx.moveTo(cx + 5, browY + 0.5);
    ctx.quadraticCurveTo(cx + 11, browY - 2.5, cx + 16, browY + 1);
    ctx.stroke();
    ctx.restore();

    /* ── Eyes ── */
    var eyeY = cy + 1;
    var eyeOff = 9;  // eye center offset from face center
    var eyeW = 7, eyeH = 5;

    [-1, 1].forEach(function (side) {
      var ex = cx + side * eyeOff;

      // Eye socket shadow
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      var sockG = ctx.createRadialGradient(ex, eyeY - 1, 1, ex, eyeY, 8);
      sockG.addColorStop(0, 'rgba(0,0,0,0.06)');
      sockG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sockG;
      ctx.fillRect(ex - 10, eyeY - 8, 20, 14);
      ctx.restore();

      // Sclera (white)
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f0ece4';
      ctx.fill();

      // Upper eyelid line
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW / 2 + 0.5, eyeH / 2 + 0.5, 0, Math.PI * 1.05, Math.PI * 1.95, true);
      ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.35)' : withAlpha(darker(skin, 40), 0.4);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Iris
      var irisR = 2.4;
      var irisX = ex + side * 0.3;
      var ig = ctx.createRadialGradient(irisX, eyeY - 0.3, 0.3, irisX, eyeY, irisR);
      ig.addColorStop(0, '#1a1208');
      ig.addColorStop(0.4, '#2a1f14');
      ig.addColorStop(0.7, '#3d2b1a');
      ig.addColorStop(1, '#1a1208');
      ctx.beginPath();
      ctx.arc(irisX, eyeY, irisR, 0, Math.PI * 2);
      ctx.fillStyle = ig;
      ctx.fill();

      // Pupil
      ctx.beginPath();
      ctx.arc(irisX, eyeY, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = '#050505';
      ctx.fill();

      // Main catchlight
      ctx.beginPath();
      ctx.arc(irisX - 0.8, eyeY - 1, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();

      // Secondary catchlight
      ctx.beginPath();
      ctx.arc(irisX + 0.6, eyeY + 0.6, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    });

    /* ── Nose ── */
    var noseY = cy + 10;
    // Nose bridge (subtle line)
    ctx.beginPath();
    ctx.moveTo(cx - 0.5, cy + 2);
    ctx.lineTo(cx - 1, noseY - 1);
    ctx.strokeStyle = withAlpha(darker(skin, 20), 0.15);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Nose tip
    ctx.beginPath();
    ctx.arc(cx, noseY, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(darker(skin, 12), 0.12);
    ctx.fill();
    // Nostrils
    ctx.fillStyle = withAlpha(darker(skin, 30), 0.18);
    ctx.beginPath();
    ctx.arc(cx - 2.5, noseY + 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 2.5, noseY + 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Nose highlight
    ctx.beginPath();
    ctx.arc(cx - 0.5, noseY - 2, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(lighter(skin, 25), 0.15);
    ctx.fill();

    /* ── Mouth ── */
    var mouthY = cy + 17;
    // Upper lip line
    ctx.beginPath();
    ctx.moveTo(cx - 6, mouthY);
    ctx.quadraticCurveTo(cx - 2, mouthY - 1.5, cx, mouthY - 0.5);
    ctx.quadraticCurveTo(cx + 2, mouthY - 1.5, cx + 6, mouthY);
    ctx.strokeStyle = withAlpha(darker(skin, 30), 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Lower lip (subtle curve)
    ctx.beginPath();
    ctx.moveTo(cx - 5, mouthY + 0.5);
    ctx.quadraticCurveTo(cx, mouthY + 3.5, cx + 5, mouthY + 0.5);
    ctx.strokeStyle = withAlpha(darker(skin, 20), 0.2);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Lip fill (subtle)
    ctx.beginPath();
    ctx.moveTo(cx - 5.5, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 3, cx + 5.5, mouthY);
    ctx.quadraticCurveTo(cx, mouthY - 1, cx - 5.5, mouthY);
    ctx.closePath();
    ctx.fillStyle = withAlpha(darker(skin, 15), 0.1);
    ctx.fill();

    // Lower lip highlight
    ctx.beginPath();
    ctx.arc(cx, mouthY + 2, 2, 0, Math.PI);
    ctx.fillStyle = withAlpha(lighter(skin, 20), 0.08);
    ctx.fill();
  }

  /* ── Drawing: Hair ──────────────────────────────────────── */
  function drawHair(ctx, style, color) {
    var cx = CX, cy = HEAD_CY;
    var rx = HEAD_RX, ry = HEAD_RY;

    if (style === 'bald') {
      // Bald highlight
      var bg = ctx.createRadialGradient(cx - 4, cy - ry + 4, 1, cx - 4, cy - ry + 4, 12);
      bg.addColorStop(0, 'rgba(255,255,255,0.12)');
      bg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(cx - 15, cy - ry - 2, 22, 16);
      return;
    }

    if (style === 'buzz') {
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      var buzzG = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy);
      buzzG.addColorStop(0, lighter(color, 8));
      buzzG.addColorStop(1, color);
      ctx.fillStyle = buzzG;
      ctx.fillRect(cx - rx - 2, cy - ry - 2, rx * 2 + 4, ry + 4);
      // Stubble texture
      var rng = seededRand(hashStr(color + 'buzz'));
      ctx.fillStyle = withAlpha(darker(color, 15), 0.15);
      for (var i = 0; i < 30; i++) {
        ctx.fillRect(cx - rx + rng() * rx * 2, cy - ry + rng() * ry * 0.7, 1, 1);
      }
      ctx.restore();
      return;
    }

    if (style === 'short') {
      // Hair cap on top of head
      ctx.beginPath();
      ctx.moveTo(cx - rx - 1, cy - ry * 0.15);
      ctx.bezierCurveTo(cx - rx - 2, cy - ry - 4, cx - rx * 0.3, cy - ry - 10, cx, cy - ry - 11);
      ctx.bezierCurveTo(cx + rx * 0.3, cy - ry - 10, cx + rx + 2, cy - ry - 4, cx + rx + 1, cy - ry * 0.15);
      ctx.closePath();
      var sg = ctx.createRadialGradient(cx - 4, cy - ry - 6, 2, cx, cy - ry, 20);
      sg.addColorStop(0, lighter(color, 12));
      sg.addColorStop(1, color);
      ctx.fillStyle = sg;
      ctx.fill();
      // Side hair
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      ctx.fillStyle = withAlpha(color, 0.5);
      ctx.fillRect(cx - rx - 1, cy - ry, 6, ry * 0.8);
      ctx.fillRect(cx + rx - 5, cy - ry, 6, ry * 0.8);
      ctx.restore();
      return;
    }

    if (style === 'fade') {
      // Top hair (taller, full)
      ctx.beginPath();
      ctx.moveTo(cx - rx + 2, cy - ry * 0.1);
      ctx.bezierCurveTo(cx - rx, cy - ry - 6, cx - rx * 0.3, cy - ry - 14, cx, cy - ry - 15);
      ctx.bezierCurveTo(cx + rx * 0.3, cy - ry - 14, cx + rx, cy - ry - 6, cx + rx - 2, cy - ry * 0.1);
      ctx.closePath();
      var fg = ctx.createRadialGradient(cx - 3, cy - ry - 8, 2, cx, cy - ry, 22);
      fg.addColorStop(0, lighter(color, 15));
      fg.addColorStop(1, color);
      ctx.fillStyle = fg;
      ctx.fill();
      // Faded sides
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = color;
      ctx.fillRect(cx - rx - 1, cy - ry, 8, ry * 0.8);
      ctx.fillRect(cx + rx - 7, cy - ry, 8, ry * 0.8);
      ctx.globalAlpha = 0.15;
      ctx.fillRect(cx - rx - 1, cy - ry + ry * 0.5, 6, ry * 0.5);
      ctx.fillRect(cx + rx - 5, cy - ry + ry * 0.5, 6, ry * 0.5);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    if (style === 'afro') {
      // Large afro behind head (drawn before head in main draw)
      return;
    }

    if (style === 'dreads') {
      // Cap on top
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy - ry * 0.2);
      ctx.bezierCurveTo(cx - rx - 1, cy - ry - 3, cx - rx * 0.3, cy - ry - 8, cx, cy - ry - 9);
      ctx.bezierCurveTo(cx + rx * 0.3, cy - ry - 8, cx + rx + 1, cy - ry - 3, cx + rx, cy - ry * 0.2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Hanging dreads
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      var rng = seededRand(hashStr(color + 'dreads'));
      for (var di = 0; di < 12; di++) {
        var da = Math.PI * (0.12 + 0.76 * (di / 11));
        var dsx = cx + Math.cos(da) * (rx + 1);
        var dsy = cy - Math.sin(da) * (ry - 2);
        var dLen = 18 + rng() * 14;
        var dWave = (rng() - 0.5) * 8;
        ctx.lineWidth = 2.8 + rng() * 1.5;
        ctx.beginPath();
        ctx.moveTo(dsx, dsy);
        ctx.bezierCurveTo(dsx + dWave * 0.3, dsy + dLen * 0.3,
                          dsx + dWave, dsy + dLen * 0.6,
                          dsx + dWave * 0.6, dsy + dLen);
        ctx.strokeStyle = di % 3 === 0 ? lighter(color, 8) : color;
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (style === 'mohawk') {
      // Tall central crest
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - ry + 2);
      ctx.bezierCurveTo(cx - 9, cy - ry - 10, cx - 5, cy - ry - 28, cx, cy - ry - 32);
      ctx.bezierCurveTo(cx + 5, cy - ry - 28, cx + 9, cy - ry - 10, cx + 7, cy - ry + 2);
      ctx.closePath();
      var mg = ctx.createLinearGradient(cx, cy - ry - 32, cx, cy - ry + 2);
      mg.addColorStop(0, lighter(color, 20));
      mg.addColorStop(0.5, color);
      mg.addColorStop(1, darker(color, 10));
      ctx.fillStyle = mg;
      ctx.fill();
      // Shaved sides
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      ctx.fillStyle = withAlpha(color, 0.15);
      ctx.fillRect(cx - rx - 1, cy - ry, rx * 2 + 2, ry * 0.6);
      ctx.restore();
      return;
    }

    if (style === 'waves') {
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      var wg = ctx.createRadialGradient(cx - 3, cy - ry, 2, cx, cy - ry + 8, rx);
      wg.addColorStop(0, lighter(color, 10));
      wg.addColorStop(1, color);
      ctx.fillStyle = wg;
      ctx.fillRect(cx - rx - 2, cy - ry - 2, rx * 2 + 4, ry + 4);
      // Wave pattern
      ctx.strokeStyle = withAlpha(lighter(color, 20), 0.25);
      ctx.lineWidth = 1.5;
      for (var wr = 0; wr < 5; wr++) {
        ctx.beginPath();
        ctx.arc(cx, cy - ry * 0.3, 4 + wr * 4, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (style === 'cornrows') {
      // Hair cap
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(cx - rx - 2, cy - ry - 2, rx * 2 + 4, ry + 2);
      // Cornrow lines
      ctx.strokeStyle = withAlpha(darker(color, 25), 0.5);
      ctx.lineWidth = 0.8;
      for (var cr = -4; cr <= 4; cr++) {
        ctx.beginPath();
        ctx.moveTo(cx + cr * 4.5, cy - ry + 2);
        ctx.quadraticCurveTo(cx + cr * 4.8, cy - ry * 0.3, cx + cr * 5, cy + 2);
        ctx.stroke();
      }
      // Braid bumps
      ctx.fillStyle = withAlpha(lighter(color, 15), 0.12);
      for (var cr2 = -4; cr2 <= 4; cr2++) {
        for (var bi = 0; bi < 4; bi++) {
          var bx = cx + cr2 * 4.5 + (cr2 * 0.05 * bi);
          var by = cy - ry + 3 + bi * 6;
          ctx.beginPath();
          ctx.ellipse(bx, by, 2, 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      // Cornrow tails (hanging behind)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (var ct = -2; ct <= 2; ct++) {
        ctx.beginPath();
        ctx.moveTo(cx + ct * 5, cy + 4);
        ctx.lineTo(cx + ct * 6, cy + 18);
        ctx.stroke();
      }
      return;
    }
  }

  /* Afro (drawn behind head) */
  function drawAfro(ctx, color) {
    var cx = CX, cy = HEAD_CY;
    var rx = HEAD_RX, ry = HEAD_RY;
    var afroR = rx + 18;

    ctx.beginPath();
    ctx.ellipse(cx, cy - 4, afroR, afroR - 2, 0, 0, Math.PI * 2);
    var ag = ctx.createRadialGradient(cx - 6, cy - 12, 3, cx, cy - 4, afroR);
    ag.addColorStop(0, lighter(color, 15));
    ag.addColorStop(0.6, color);
    ag.addColorStop(1, darker(color, 10));
    ctx.fillStyle = ag;
    ctx.fill();

    // Texture dots
    var rng = seededRand(hashStr(color + 'afro'));
    ctx.fillStyle = withAlpha(lighter(color, 20), 0.08);
    for (var ai = 0; ai < 30; ai++) {
      var ax = cx + (rng() - 0.5) * afroR * 1.6;
      var ay = cy - 4 + (rng() - 0.5) * afroR * 1.6;
      var dist = Math.sqrt((ax - cx) * (ax - cx) + (ay - cy + 4) * (ay - cy + 4));
      if (dist < afroR - 3) {
        ctx.beginPath();
        ctx.arc(ax, ay, 1 + rng(), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Rim light
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy - 4, afroR, afroR - 2, 0, 0, Math.PI * 2);
    ctx.clip();
    var rimG = ctx.createLinearGradient(cx - afroR - 3, cy, cx - afroR + 10, cy);
    rimG.addColorStop(0, 'rgba(150,190,255,0.12)');
    rimG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rimG;
    ctx.fillRect(cx - afroR - 3, cy - afroR, 14, afroR * 2);
    ctx.restore();
  }

  /* ── Drawing: Beard ─────────────────────────────────────── */
  function drawBeard(ctx, style, color, skin) {
    if (style === 'none') return;
    var cx = CX, cy = HEAD_CY;
    var rx = HEAD_RX, ry = HEAD_RY;
    var mouthY = cy + 17;
    var chinY = cy + ry;

    if (style === 'stubble') {
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      // Subtle shadow
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.5, mouthY);
      ctx.quadraticCurveTo(cx, chinY + 4, cx + rx * 0.5, mouthY);
      ctx.closePath();
      ctx.fillStyle = withAlpha(darker(color, 30), 0.1);
      ctx.fill();
      // Fine dots
      var rng = seededRand(hashStr(color + 'stubble'));
      ctx.fillStyle = withAlpha(color, 0.18);
      for (var i = 0; i < 40; i++) {
        var sx = cx + (rng() - 0.5) * rx * 1.1;
        var sy = mouthY + rng() * (chinY - mouthY + 2);
        if (Math.abs(sx - cx) / rx > 0.65) continue;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.3 + rng() * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    if (style === 'short') {
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.45, mouthY + 2);
      ctx.quadraticCurveTo(cx - rx * 0.5, chinY - 2, cx - rx * 0.3, chinY + 3);
      ctx.quadraticCurveTo(cx, chinY + 6, cx + rx * 0.3, chinY + 3);
      ctx.quadraticCurveTo(cx + rx * 0.5, chinY - 2, cx + rx * 0.45, mouthY + 2);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.55);
      ctx.fill();
      // Mustache
      ctx.beginPath();
      ctx.moveTo(cx - 7, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY - 4, cx + 7, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY, cx - 7, mouthY - 2);
      ctx.fillStyle = withAlpha(color, 0.6);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (style === 'full') {
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      // Sideburns
      ctx.fillStyle = withAlpha(color, 0.6);
      ctx.fillRect(cx - rx + 1, cy + ry * 0.2, 6, ry * 0.6);
      ctx.fillRect(cx + rx - 7, cy + ry * 0.2, 6, ry * 0.6);
      // Main beard
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.55, mouthY - 4);
      ctx.quadraticCurveTo(cx - rx * 0.6, chinY, cx - rx * 0.35, chinY + 8);
      ctx.quadraticCurveTo(cx, chinY + 12, cx + rx * 0.35, chinY + 8);
      ctx.quadraticCurveTo(cx + rx * 0.6, chinY, cx + rx * 0.55, mouthY - 4);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.7);
      ctx.fill();
      // Mustache
      ctx.beginPath();
      ctx.moveTo(cx - 8, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY - 5, cx + 8, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY + 1, cx - 8, mouthY - 2);
      ctx.fillStyle = withAlpha(color, 0.7);
      ctx.fill();
      // Texture
      var rng = seededRand(hashStr(color + 'full'));
      ctx.fillStyle = withAlpha(darker(color, 10), 0.15);
      for (var fi = 0; fi < 20; fi++) {
        var fx = cx + (rng() - 0.5) * rx * 0.8;
        var fy = mouthY + rng() * (chinY - mouthY + 6);
        ctx.beginPath();
        ctx.arc(fx, fy, 0.5, rng() * Math.PI, rng() * Math.PI + Math.PI * 0.5);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (style === 'goatee') {
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      // Chin patch
      ctx.beginPath();
      ctx.moveTo(cx - 7, mouthY + 2);
      ctx.quadraticCurveTo(cx - 8, chinY, cx - 5, chinY + 5);
      ctx.quadraticCurveTo(cx, chinY + 8, cx + 5, chinY + 5);
      ctx.quadraticCurveTo(cx + 8, chinY, cx + 7, mouthY + 2);
      ctx.closePath();
      ctx.fillStyle = withAlpha(color, 0.6);
      ctx.fill();
      // Mustache connecting
      ctx.beginPath();
      ctx.moveTo(cx - 6, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY - 4, cx + 6, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY, cx - 6, mouthY - 2);
      ctx.fillStyle = withAlpha(color, 0.55);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (style === 'chinstrap') {
      ctx.save();
      headShape(ctx, cx, cy, rx, ry);
      ctx.clip();
      // Thin line along jaw
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.7, cy + ry * 0.3);
      ctx.quadraticCurveTo(cx - rx * 0.65, chinY + 2, cx - rx * 0.3, chinY + 4);
      ctx.quadraticCurveTo(cx, chinY + 6, cx + rx * 0.3, chinY + 4);
      ctx.quadraticCurveTo(cx + rx * 0.65, chinY + 2, cx + rx * 0.7, cy + ry * 0.3);
      ctx.strokeStyle = withAlpha(color, 0.6);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      return;
    }
  }

  /* ── Drawing: Accessories ───────────────────────────────── */
  function drawAccessory(ctx, accessory, cfg) {
    if (accessory === 'none') return;
    var cx = CX, cy = HEAD_CY;
    var rx = HEAD_RX, ry = HEAD_RY;

    if (accessory === 'headband') {
      var hbY = cy - ry * 0.52;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, hbY, rx + 1, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#c89b3c';
      ctx.fill();
      // Headband shine
      ctx.beginPath();
      ctx.ellipse(cx - 6, hbY - 1, 8, 1.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,220,120,0.25)';
      ctx.fill();
      ctx.restore();
      return;
    }

    if (accessory === 'sweatband') {
      var sbY = cy - ry * 0.55;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, sbY, rx + 1.5, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e8e0d0';
      ctx.fill();
      // Terry texture
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 0.5;
      for (var si = -rx; si <= rx; si += 3) {
        ctx.beginPath();
        ctx.moveTo(cx + si, sbY - 4);
        ctx.lineTo(cx + si, sbY + 4);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (accessory === 'glasses') {
      var glY = cy + 1;
      ctx.save();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.8;
      // Left lens
      roundRect(ctx, cx - 17, glY - 5, 13, 10, 3);
      ctx.stroke();
      // Right lens
      roundRect(ctx, cx + 4, glY - 5, 13, 10, 3);
      ctx.stroke();
      // Bridge
      ctx.beginPath();
      ctx.moveTo(cx - 4, glY);
      ctx.lineTo(cx + 4, glY);
      ctx.stroke();
      // Temples
      ctx.beginPath();
      ctx.moveTo(cx - 17, glY - 2);
      ctx.lineTo(cx - rx, glY - 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 17, glY - 2);
      ctx.lineTo(cx + rx, glY - 1);
      ctx.stroke();
      // Lens tint
      ctx.fillStyle = 'rgba(40,40,60,0.2)';
      roundRect(ctx, cx - 17, glY - 5, 13, 10, 3);
      ctx.fill();
      roundRect(ctx, cx + 4, glY - 5, 13, 10, 3);
      ctx.fill();
      // Lens reflection
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(cx - 15, glY - 3, 4, 3);
      ctx.fillRect(cx + 6, glY - 3, 4, 3);
      ctx.restore();
      return;
    }

    if (accessory === 'chain') {
      var chainY = 78;
      ctx.save();
      ctx.strokeStyle = '#c89b3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 12, chainY);
      ctx.quadraticCurveTo(cx, chainY + 14, cx + 12, chainY);
      ctx.stroke();
      // Pendant
      ctx.beginPath();
      ctx.arc(cx, chainY + 13, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#c89b3c';
      ctx.fill();
      // Pendant glow
      ctx.save();
      ctx.shadowColor = 'rgba(200,155,60,0.5)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(cx, chainY + 13, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#e8c060';
      ctx.fill();
      ctx.restore();
      // IQ text
      ctx.font = 'bold 4px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1a1208';
      ctx.fillText('IQ', cx, chainY + 13);
      ctx.restore();
      return;
    }

    if (accessory === 'durag') {
      ctx.save();
      // Durag covers top of head
      headShape(ctx, cx, cy, rx + 1, ry + 1);
      ctx.clip();
      ctx.fillStyle = '#1a2d5a';
      ctx.fillRect(cx - rx - 2, cy - ry - 2, rx * 2 + 4, ry * 0.8);
      // Silky sheen
      var sheen = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy - ry * 0.3);
      sheen.addColorStop(0, 'rgba(100,140,200,0.15)');
      sheen.addColorStop(0.4, 'rgba(180,210,255,0.12)');
      sheen.addColorStop(1, 'rgba(100,140,200,0.05)');
      ctx.fillStyle = sheen;
      ctx.fillRect(cx - rx - 2, cy - ry - 2, rx * 2 + 4, ry * 0.8);
      ctx.restore();
      // Front fold line
      ctx.beginPath();
      ctx.moveTo(cx - rx + 3, cy - ry * 0.25);
      ctx.lineTo(cx + rx - 3, cy - ry * 0.25);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // Tail
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy - ry + 4);
      ctx.bezierCurveTo(cx - 8, cy - ry + 16, cx - 14, cy + 2, cx - 10, cy + 18);
      ctx.strokeStyle = '#1a2d5a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#243b6a';
      ctx.stroke();
      return;
    }

    if (accessory === 'armband') {
      // On left upper arm area
      var abY = 110;
      var d = bodyDims(cfg.bodyType);
      var abX = CX - d.shoulderHW + 2;
      ctx.save();
      ctx.fillStyle = '#c89b3c';
      ctx.fillRect(abX - 6, abY, 12, 4);
      ctx.fillStyle = 'rgba(255,220,120,0.2)';
      ctx.fillRect(abX - 5, abY + 1, 10, 1);
      ctx.restore();
      return;
    }
  }

  /* ── Drawing: Basketball ────────────────────────────────── */
  function drawBall(ctx, cfg) {
    var d = bodyDims(cfg.bodyType);
    var bx = CX + d.shoulderHW + 10;
    var by = 172;
    var r = 12;

    // Ball shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bx + 2, by + r + 4, r * 0.7, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();
    ctx.restore();

    // Ball body
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    var bg = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, r);
    bg.addColorStop(0, '#f5a623');
    bg.addColorStop(0.6, '#e08a10');
    bg.addColorStop(1, '#b06a08');
    ctx.fillStyle = bg;
    ctx.fill();

    // Seam lines
    ctx.strokeStyle = 'rgba(80,40,10,0.3)';
    ctx.lineWidth = 0.8;
    // Horizontal
    ctx.beginPath();
    ctx.moveTo(bx - r + 2, by);
    ctx.lineTo(bx + r - 2, by);
    ctx.stroke();
    // Vertical
    ctx.beginPath();
    ctx.moveTo(bx, by - r + 2);
    ctx.lineTo(bx, by + r - 2);
    ctx.stroke();
    // Curved seams
    ctx.beginPath();
    ctx.arc(bx - 2, by, r * 0.7, -0.5, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx + 2, by, r * 0.7, Math.PI - 0.5, Math.PI + 0.5);
    ctx.stroke();

    // Specular highlight
    var spec = ctx.createRadialGradient(bx - 3, by - 4, 0, bx - 3, by - 4, 5);
    spec.addColorStop(0, 'rgba(255,255,255,0.35)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── Drawing: Particles ─────────────────────────────────── */
  function drawParticles(ctx) {
    var rng = seededRand(42);
    ctx.fillStyle = 'rgba(245,180,80,0.08)';
    for (var pi = 0; pi < 10; pi++) {
      var px = rng() * AW;
      var py = rng() * AH;
      var pr = 0.5 + rng() * 1.5;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ══════════════════════════════════════════════════════════
     MAIN DRAW (full avatar)
     ══════════════════════════════════════════════════════════ */
  function draw(canvas, data) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var cfg = Object.assign({}, defaults, data || {});

    canvas.width = AW;
    canvas.height = AH;
    ctx.clearRect(0, 0, AW, AH);

    drawBackground(ctx);
    drawGroundShadow(ctx);

    // Afro behind head
    if (cfg.hairStyle === 'afro') {
      drawAfro(ctx, cfg.hairColor);
    }

    drawLegs(ctx, cfg);
    drawShoes(ctx, cfg);
    drawShorts(ctx, cfg);
    drawJersey(ctx, cfg);
    drawArms(ctx, cfg);
    drawBall(ctx, cfg);
    drawNeck(ctx, cfg);
    drawHead(ctx, cfg);
    drawHair(ctx, cfg.hairStyle, cfg.hairColor);
    drawFace(ctx, cfg);
    drawBeard(ctx, cfg.beardStyle, cfg.hairColor, cfg.skinTone);
    drawAccessory(ctx, cfg.accessory, cfg);
    drawParticles(ctx);
  }

  /* ══════════════════════════════════════════════════════════
     MINI AVATAR (48x48)
     ══════════════════════════════════════════════════════════ */
  function drawMini(canvas, data) {
    if (!canvas) return;
    var s = 48;
    var ctx = canvas.getContext('2d');
    var cfg = Object.assign({}, defaults, data || {});
    canvas.width = s;
    canvas.height = s;
    ctx.clearRect(0, 0, s, s);

    var cx = s / 2, cy = s / 2 + 1;
    var hw = 14, hh = 16;

    // Background circle
    var bgG = ctx.createRadialGradient(cx, cy, 2, cx, cy, s / 2);
    bgG.addColorStop(0, '#1e2028');
    bgG.addColorStop(1, '#14161a');
    ctx.beginPath();
    ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
    ctx.fillStyle = bgG;
    ctx.fill();

    // Rim glow border
    ctx.beginPath();
    ctx.arc(cx, cy, s / 2 - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,166,35,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Neck hint
    ctx.fillStyle = darker(cfg.skinTone, 8);
    ctx.fillRect(cx - 5, cy + hh - 4, 10, 8);

    // Shoulder/jersey hint
    ctx.fillStyle = '#1a2744';
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + hh + 2);
    ctx.quadraticCurveTo(cx, cy + hh - 2, cx + 16, cy + hh + 2);
    ctx.lineTo(cx + 18, s);
    ctx.lineTo(cx - 18, s);
    ctx.closePath();
    ctx.fill();

    // Afro behind
    if (cfg.hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 21, 0, Math.PI * 2);
      var amG = ctx.createRadialGradient(cx - 3, cy - 7, 2, cx, cy - 2, 21);
      amG.addColorStop(0, lighter(cfg.hairColor, 12));
      amG.addColorStop(1, cfg.hairColor);
      ctx.fillStyle = amG;
      ctx.fill();
    }

    // Head
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    var hgM = ctx.createRadialGradient(cx - 2, cy - 5, 1, cx, cy, hh);
    hgM.addColorStop(0, lighter(cfg.skinTone, 15));
    hgM.addColorStop(1, cfg.skinTone);
    ctx.fillStyle = hgM;
    ctx.fill();

    // Rim light
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    ctx.clip();
    var rimM = ctx.createLinearGradient(cx - hw - 2, cy, cx - hw + 6, cy);
    rimM.addColorStop(0, 'rgba(150,190,255,0.18)');
    rimM.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rimM;
    ctx.fillRect(cx - hw - 2, cy - hh, 8, hh * 2);
    ctx.restore();

    // Mini hair
    if (cfg.hairStyle !== 'bald' && cfg.hairStyle !== 'afro') {
      ctx.fillStyle = cfg.hairColor;
      if (cfg.hairStyle === 'buzz' || cfg.hairStyle === 'waves') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillRect(cx - hw - 2, cy - hh - 2, hw * 2 + 4, hh);
        if (cfg.hairStyle === 'waves') {
          ctx.strokeStyle = withAlpha(lighter(cfg.hairColor, 20), 0.2);
          ctx.lineWidth = 1;
          for (var wr = 0; wr < 3; wr++) {
            ctx.beginPath();
            ctx.arc(cx, cy - hh * 0.3, 3 + wr * 3, Math.PI * 0.2, Math.PI * 0.8);
            ctx.stroke();
          }
        }
        ctx.restore();
      } else if (cfg.hairStyle === 'short') {
        ctx.beginPath();
        ctx.ellipse(cx, cy - 4, hw + 2, hh * 0.55, 0, Math.PI * 1.05, Math.PI * 1.95, true);
        ctx.fill();
      } else if (cfg.hairStyle === 'fade') {
        ctx.beginPath();
        ctx.ellipse(cx, cy - 5, hw, hh * 0.5, 0, Math.PI * 1.1, Math.PI * 1.9, true);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh * 0.35, 0, Math.PI * 0.85, Math.PI * 1.15);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh * 0.35, 0, Math.PI * 1.85, Math.PI * 0.15);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (cfg.hairStyle === 'dreads') {
        ctx.beginPath();
        ctx.ellipse(cx, cy - 2, hw + 2, hh * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95, true);
        ctx.fill();
        ctx.strokeStyle = cfg.hairColor;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (var d = 0; d < 5; d++) {
          var da = Math.PI * (0.2 + 0.6 * (d / 4));
          var dsx = cx + Math.cos(da) * (hw + 1);
          var dsy = cy - Math.sin(da) * (hh - 4);
          ctx.beginPath();
          ctx.moveTo(dsx, dsy);
          ctx.lineTo(dsx + (d % 2 ? 2 : -2), dsy + 6 + d);
          ctx.stroke();
        }
      } else if (cfg.hairStyle === 'mohawk') {
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - hh * 0.3);
        ctx.bezierCurveTo(cx - 4, cy - hh - 2, cx - 2, cy - hh - 8, cx, cy - hh - 9);
        ctx.bezierCurveTo(cx + 2, cy - hh - 8, cx + 4, cy - hh - 2, cx + 3, cy - hh * 0.3);
        ctx.closePath();
        ctx.fill();
      } else if (cfg.hairStyle === 'cornrows') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillRect(cx - hw - 2, cy - hh - 2, hw * 2 + 4, hh);
        ctx.strokeStyle = withAlpha(darker(cfg.hairColor, 20), 0.4);
        ctx.lineWidth = 0.5;
        for (var cr = -3; cr <= 3; cr++) {
          ctx.beginPath();
          ctx.moveTo(cx + cr * 3, cy - hh + 2);
          ctx.lineTo(cx + cr * 3.5, cy - 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Bald highlight
    if (cfg.hairStyle === 'bald') {
      var bhG = ctx.createRadialGradient(cx - 2, cy - hh + 4, 1, cx - 2, cy - hh + 4, 8);
      bhG.addColorStop(0, 'rgba(255,255,255,0.12)');
      bhG.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bhG;
      ctx.fillRect(cx - 10, cy - hh, 16, 12);
    }

    // Accessory hints (simplified)
    if (cfg.accessory === 'headband') {
      ctx.fillStyle = '#c89b3c';
      ctx.beginPath();
      ctx.ellipse(cx, cy - hh * 0.5, hw + 0.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (cfg.accessory === 'glasses') {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.rect(cx - 11, cy - 3, 9, 6);
      ctx.rect(cx + 2, cy - 3, 9, 6);
      ctx.moveTo(cx - 2, cy);
      ctx.lineTo(cx + 2, cy);
      ctx.stroke();
    } else if (cfg.accessory === 'durag') {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#1a2d5a';
      ctx.fillRect(cx - hw - 2, cy - hh - 2, hw * 2 + 4, hh * 0.7);
      ctx.restore();
    } else if (cfg.accessory === 'chain') {
      ctx.strokeStyle = '#c89b3c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + hh - 2);
      ctx.quadraticCurveTo(cx, cy + hh + 4, cx + 6, cy + hh - 2);
      ctx.stroke();
    }

    // Eyes
    ctx.fillStyle = '#f0ece4';
    ctx.beginPath();
    ctx.ellipse(cx - 4.5, cy, 2.8, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 4.5, cy, 2.8, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iris
    ctx.fillStyle = '#2a1f14';
    ctx.beginPath();
    ctx.arc(cx - 4, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.arc(cx - 4, cy, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5, cy, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Catchlight
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx - 4.8, cy - 0.8, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4.2, cy - 0.8, 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy + 5);
    ctx.quadraticCurveTo(cx, cy + 7, cx + 3, cy + 5);
    ctx.strokeStyle = withAlpha(darker(cfg.skinTone, 25), 0.4);
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Beard hint
    if (cfg.beardStyle === 'full' || cfg.beardStyle === 'short') {
      ctx.fillStyle = withAlpha(cfg.hairColor, 0.45);
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, cfg.beardStyle === 'full' ? 8 : 6, cfg.beardStyle === 'full' ? 6 : 4, 0, 0, Math.PI);
      ctx.fill();
    } else if (cfg.beardStyle === 'goatee') {
      ctx.fillStyle = withAlpha(cfg.hairColor, 0.45);
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, 4, 5, 0, 0, Math.PI);
      ctx.fill();
    } else if (cfg.beardStyle === 'chinstrap') {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6, hw * 0.7, hh * 0.5, 0, 0.3, Math.PI - 0.3);
      ctx.strokeStyle = withAlpha(cfg.hairColor, 0.35);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (cfg.beardStyle === 'stubble') {
      var rng = seededRand(hashStr(cfg.hairColor + 'mstub'));
      ctx.fillStyle = withAlpha(cfg.hairColor, 0.15);
      for (var si = 0; si < 15; si++) {
        var ssx = cx + (rng() - 0.5) * 12;
        var ssy = cy + 5 + rng() * 8;
        ctx.fillRect(ssx, ssy, 0.5, 0.5);
      }
    }
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.AvatarBuilder = {
    CONFIG: CONFIG,
    defaults: defaults,
    draw: draw,
    drawMini: drawMini,
    darker: darker
  };
})();
