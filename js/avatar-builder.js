/* ============================================================
   AVATAR BUILDER v5 — /js/avatar-builder.js
   Memoji-quality canvas avatar with soft 3D lighting,
   ambient occlusion, detailed eyes, volumetric hair,
   proper skin gradients with hue-shifted shadows.
   ============================================================ */
(function () {
  'use strict';

  var AW = 200, AH = 280;

  /* ── Layout Constants ──────────────────────────────────────── */
  var CX = 100;
  var HEAD_CY = 55;
  var HEAD_RX = 26, HEAD_RY = 30;

  /* ── Config ────────────────────────────────────────────────── */
  var CONFIG = {
    skinTones: [
      { name: 'Light',        color: '#FDDBB4' },
      { name: 'Medium Light', color: '#E8B98D' },
      { name: 'Medium',       color: '#C68642' },
      { name: 'Medium Dark',  color: '#8D5524' },
      { name: 'Dark',         color: '#5C3317' },
      { name: 'Deep',         color: '#3B1E0E' }
    ],
    hairStyles: ['buzz','short','fade','afro','dreads','mohawk','waves','cornrows','bald'],
    hairColors: [
      { name: 'Black',    color: '#1a1a1a' },
      { name: 'Brown',    color: '#4a2912' },
      { name: 'Blonde',   color: '#c4a35a' },
      { name: 'Red',      color: '#8b3a2f' },
      { name: 'Platinum', color: '#e8e0d0' },
      { name: 'Grey',     color: '#8a8a8a' },
      { name: 'Navy',     color: '#1a2d5a' }
    ],
    beardStyles: ['none','stubble','short','full','goatee','chinstrap'],
    bodyTypes:   ['lean','athletic','heavy'],
    accessories: ['none','headband','sweatband','glasses','chain','durag','armband']
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
  function parseHex(hex) {
    return {
      r: parseInt(hex.slice(1,3),16),
      g: parseInt(hex.slice(3,5),16),
      b: parseInt(hex.slice(5,7),16)
    };
  }
  function toHex(r, g, b) {
    return '#'+((1<<24)+(Math.round(r)<<16)+(Math.round(g)<<8)+Math.round(b)).toString(16).slice(1);
  }
  function darker(hex, amt) {
    var c = parseHex(hex);
    return toHex(Math.max(0,c.r-amt), Math.max(0,c.g-amt), Math.max(0,c.b-amt));
  }
  function lighter(hex, amt) {
    var c = parseHex(hex);
    return toHex(Math.min(255,c.r+amt), Math.min(255,c.g+amt), Math.min(255,c.b+amt));
  }
  function withAlpha(hex, a) {
    var c = parseHex(hex);
    return 'rgba('+c.r+','+c.g+','+c.b+','+a+')';
  }
  function rgba(r,g,b,a) { return 'rgba('+r+','+g+','+b+','+a+')'; }

  /* Warm shadow: shift toward rose/red-brown */
  function warmShadow(hex, amt) {
    var c = parseHex(hex);
    var r = Math.max(0, c.r - amt * 0.5);
    var g = Math.max(0, c.g - amt * 1.1);
    var b = Math.max(0, c.b - amt * 1.2);
    return toHex(r, g, b);
  }
  /* Warm highlight: shift toward peach/yellow */
  function warmHighlight(hex, amt) {
    var c = parseHex(hex);
    var r = Math.min(255, c.r + amt);
    var g = Math.min(255, c.g + amt * 0.85);
    var b = Math.min(255, c.b + amt * 0.5);
    return toHex(r, g, b);
  }
  /* Deep ambient occlusion shadow: shift toward cool red-brown */
  function deepShadow(hex, amt) {
    var c = parseHex(hex);
    var r = Math.max(0, c.r - amt * 0.6);
    var g = Math.max(0, c.g - amt * 1.2);
    var b = Math.max(0, c.b - amt * 1.3);
    return toHex(r, g, b);
  }

  function hexBrightness(hex) {
    var c = parseHex(hex);
    return (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
  }
  function lerpColor(h1, h2, t) {
    var a = parseHex(h1), b = parseHex(h2);
    return toHex(a.r+(b.r-a.r)*t, a.g+(b.g-a.g)*t, a.b+(b.b-a.b)*t);
  }

  /* ── Seeded PRNG ───────────────────────────────────────────── */
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
  function seededRand(seed) {
    var s = seed;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  /* ── Shape Helpers ─────────────────────────────────────────── */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }

  /* Memoji-style head: rounded forehead, soft jaw, gentle chin */
  function headShape(ctx, cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    // Right forehead → cheek (smooth, round)
    ctx.bezierCurveTo(cx + rx * 0.8, cy - ry, cx + rx, cy - ry * 0.35, cx + rx, cy + ry * 0.05);
    // Right cheek → jaw (soft curve)
    ctx.bezierCurveTo(cx + rx * 0.97, cy + ry * 0.5, cx + rx * 0.65, cy + ry * 0.85, cx + rx * 0.32, cy + ry);
    // Chin (rounded, not pointy)
    ctx.quadraticCurveTo(cx, cy + ry * 1.06, cx - rx * 0.32, cy + ry);
    // Left jaw → cheek
    ctx.bezierCurveTo(cx - rx * 0.65, cy + ry * 0.85, cx - rx * 0.97, cy + ry * 0.5, cx - rx, cy + ry * 0.05);
    // Left cheek → forehead
    ctx.bezierCurveTo(cx - rx, cy - ry * 0.35, cx - rx * 0.8, cy - ry, cx, cy - ry);
    ctx.closePath();
  }

  /* ── Body dimensions ───────────────────────────────────────── */
  function bodyDims(bt) {
    var s = bt === 'lean' ? 0.88 : bt === 'heavy' ? 1.14 : 1.0;
    return {
      shoulderHW: Math.round(34 * s),
      chestHW:    Math.round(30 * s),
      waistHW:    Math.round(26 * s),
      armW:       Math.round(11 * s),
      legW:       Math.round(12 * s),
      legOff:     14
    };
  }

  /* ══════════════════════════════════════════════════════════════
     DRAWING FUNCTIONS — Memoji-quality rendering
     Light source: top-left, warm key / cool fill
     ══════════════════════════════════════════════════════════════ */

  /* ── Background ────────────────────────────────────────────── */
  function drawBackground(ctx) {
    roundRect(ctx, 0, 0, AW, AH, 12);
    ctx.fillStyle = '#0a0b0e';
    ctx.fill();

    // Warm spotlight
    var spot = ctx.createRadialGradient(AW*0.6, AH*0.75, 15, AW*0.5, AH*0.55, AH*0.65);
    spot.addColorStop(0, rgba(245,166,35,0.09));
    spot.addColorStop(0.4, rgba(245,166,35,0.03));
    spot.addColorStop(1, rgba(0,0,0,0));
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, AW, AH);

    // Cool fill upper-left
    var cool = ctx.createRadialGradient(AW*0.15, AH*0.12, 8, AW*0.3, AH*0.3, AH*0.55);
    cool.addColorStop(0, rgba(120,160,255,0.06));
    cool.addColorStop(0.5, rgba(120,160,255,0.015));
    cool.addColorStop(1, rgba(0,0,0,0));
    ctx.fillStyle = cool;
    ctx.fillRect(0, 0, AW, AH);

    // Floor glow
    var fl = ctx.createLinearGradient(0, AH-40, 0, AH);
    fl.addColorStop(0, rgba(245,166,35,0));
    fl.addColorStop(0.6, rgba(245,166,35,0.025));
    fl.addColorStop(1, rgba(245,166,35,0.06));
    ctx.fillStyle = fl;
    ctx.fillRect(0, AH-40, AW, 40);

    // Vignette
    var vig = ctx.createRadialGradient(AW/2, AH/2, AW*0.3, AW/2, AH/2, AW*0.8);
    vig.addColorStop(0, rgba(0,0,0,0));
    vig.addColorStop(1, rgba(0,0,0,0.22));
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, AW, AH);
  }

  /* ── Ground shadow ─────────────────────────────────────────── */
  function drawGroundShadow(ctx) {
    var gs = ctx.createRadialGradient(CX, AH-14, 4, CX, AH-14, 38);
    gs.addColorStop(0, rgba(0,0,0,0.35));
    gs.addColorStop(0.5, rgba(0,0,0,0.12));
    gs.addColorStop(1, rgba(0,0,0,0));
    ctx.fillStyle = gs;
    ctx.beginPath();
    ctx.ellipse(CX, AH-14, 38, 8, 0, 0, Math.PI*2);
    ctx.fill();
  }

  /* ── Legs ──────────────────────────────────────────────────── */
  function drawLegs(ctx, cfg) {
    var bd = bodyDims(cfg.bodyType);
    var legTop = 194, legBot = 248;
    var lw = bd.legW, off = bd.legOff;

    [-1, 1].forEach(function(side) {
      var lx = CX + side * off;
      var lg = ctx.createLinearGradient(lx - lw/2, legTop, lx + lw/2, legTop);
      lg.addColorStop(0, side < 0 ? warmHighlight(cfg.skinTone, 8) : warmShadow(cfg.skinTone, 12));
      lg.addColorStop(0.5, cfg.skinTone);
      lg.addColorStop(1, side < 0 ? warmShadow(cfg.skinTone, 10) : warmHighlight(cfg.skinTone, 6));
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(lx - lw/2, legTop);
      ctx.lineTo(lx + lw/2, legTop);
      ctx.lineTo(lx + lw/2 - 0.5, legBot);
      ctx.lineTo(lx - lw/2 + 0.5, legBot);
      ctx.closePath();
      ctx.fill();

      // Knee hint
      ctx.strokeStyle = withAlpha(warmShadow(cfg.skinTone, 18), 0.15);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(lx - lw*0.3, legTop + 26);
      ctx.quadraticCurveTo(lx, legTop + 28, lx + lw*0.3, legTop + 26);
      ctx.stroke();

      // Soft highlight (left side rim)
      if (side < 0) {
        ctx.strokeStyle = rgba(180,200,255,0.08);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx - lw/2, legTop + 2);
        ctx.lineTo(lx - lw/2 + 0.5, legBot - 2);
        ctx.stroke();
      }
    });
  }

  /* ── Shoes (high-top sneakers) ─────────────────────────────── */
  function drawShoes(ctx, cfg) {
    var off = bodyDims(cfg.bodyType).legOff;
    [-1, 1].forEach(function(side) {
      var sx = CX + side * off;
      var sy = 248;

      // Sole
      ctx.fillStyle = '#1a1a1a';
      roundRect(ctx, sx - 10, sy + 14, 20, 5, 2);
      ctx.fill();

      // Upper
      var shG = ctx.createLinearGradient(sx - 9, sy, sx + 9, sy);
      shG.addColorStop(0, '#f0f0f0');
      shG.addColorStop(0.5, '#e8e8e8');
      shG.addColorStop(1, '#d8d8d8');
      ctx.fillStyle = shG;
      roundRect(ctx, sx - 9, sy, 18, 15, 3);
      ctx.fill();

      // High-top collar
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(sx - 8, sy, 16, 4);

      // Swoosh accent
      ctx.strokeStyle = '#c89b3c';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx - 5, sy + 10);
      ctx.quadraticCurveTo(sx, sy + 6, sx + 6, sy + 8);
      ctx.stroke();

      // Lace dots
      ctx.fillStyle = '#bbb';
      for (var l = 0; l < 3; l++) {
        ctx.beginPath();
        ctx.arc(sx - 1, sy + 3 + l * 3, 0.6, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + 1, sy + 3 + l * 3, 0.6, 0, Math.PI*2);
        ctx.fill();
      }

      // Toe cap highlight
      ctx.fillStyle = rgba(255,255,255,0.15);
      ctx.beginPath();
      ctx.ellipse(sx, sy + 13, 6, 2, 0, 0, Math.PI*2);
      ctx.fill();
    });
  }

  /* ── Shorts ────────────────────────────────────────────────── */
  function drawShorts(ctx, cfg) {
    var bd = bodyDims(cfg.bodyType);
    var top = 156, bot = 198;
    var tw = bd.waistHW, bw = bd.waistHW + 4;

    // Main shape
    var sG = ctx.createLinearGradient(CX - tw, top, CX + tw, top);
    sG.addColorStop(0, '#141c2e');
    sG.addColorStop(0.3, '#1a2744');
    sG.addColorStop(0.7, '#1a2744');
    sG.addColorStop(1, '#111828');
    ctx.fillStyle = sG;
    ctx.beginPath();
    ctx.moveTo(CX - tw, top);
    ctx.lineTo(CX + tw, top);
    ctx.lineTo(CX + bw, bot);
    ctx.lineTo(CX - bw, bot);
    ctx.closePath();
    ctx.fill();

    // Crotch V
    ctx.strokeStyle = rgba(0,0,0,0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX - 4, top + 28);
    ctx.lineTo(CX, bot - 2);
    ctx.lineTo(CX + 4, top + 28);
    ctx.stroke();

    // Waistband
    ctx.fillStyle = '#0f1520';
    ctx.fillRect(CX - tw, top, tw*2, 4);

    // Side stripes
    ctx.fillStyle = rgba(200,155,60,0.3);
    ctx.fillRect(CX - tw + 1, top + 4, 3, bot - top - 4);
    ctx.fillRect(CX + tw - 4, top + 4, 3, bot - top - 4);

    // Hem highlight
    ctx.strokeStyle = rgba(255,255,255,0.06);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(CX - bw + 2, bot);
    ctx.lineTo(CX + bw - 2, bot);
    ctx.stroke();

    // Fold shadow hints
    ctx.strokeStyle = rgba(0,0,0,0.15);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(CX - 10, top + 8);
    ctx.quadraticCurveTo(CX - 8, top + 20, CX - 12, bot - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CX + 10, top + 8);
    ctx.quadraticCurveTo(CX + 8, top + 20, CX + 12, bot - 4);
    ctx.stroke();
  }

  /* ── Jersey ────────────────────────────────────────────────── */
  function drawJersey(ctx, cfg) {
    var bd = bodyDims(cfg.bodyType);
    var top = 86, bot = 160;
    var shW = bd.shoulderHW, wW = bd.waistHW;

    // Main body gradient (top-left lighting)
    var jG = ctx.createLinearGradient(CX - shW, top, CX + shW, top);
    jG.addColorStop(0, '#243868');
    jG.addColorStop(0.35, '#1e3058');
    jG.addColorStop(0.65, '#1a2744');
    jG.addColorStop(1, '#141e36');
    ctx.fillStyle = jG;
    ctx.beginPath();
    ctx.moveTo(CX - shW, top + 6);
    ctx.quadraticCurveTo(CX - shW, top, CX - shW + 8, top);
    ctx.lineTo(CX + shW - 8, top);
    ctx.quadraticCurveTo(CX + shW, top, CX + shW, top + 6);
    ctx.lineTo(CX + wW, bot);
    ctx.lineTo(CX - wW, bot);
    ctx.closePath();
    ctx.fill();

    // V-neck
    ctx.beginPath();
    ctx.moveTo(CX - 10, top);
    ctx.lineTo(CX, top + 16);
    ctx.lineTo(CX + 10, top);
    ctx.fillStyle = warmShadow(cfg.skinTone, 15);
    ctx.fill();
    // Neck border
    ctx.strokeStyle = '#c89b3c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(CX - 11, top);
    ctx.lineTo(CX, top + 17);
    ctx.lineTo(CX + 11, top);
    ctx.stroke();

    // Sleeves (cap sleeves)
    [-1, 1].forEach(function(side) {
      var slG = ctx.createLinearGradient(CX + side*(shW-4), top, CX + side*(shW+8), top + 24);
      slG.addColorStop(0, side < 0 ? '#243868' : '#1a2744');
      slG.addColorStop(1, side < 0 ? '#1e3058' : '#141e36');
      ctx.fillStyle = slG;
      ctx.beginPath();
      ctx.moveTo(CX + side*(shW - 4), top);
      ctx.quadraticCurveTo(CX + side*(shW + 6), top + 4, CX + side*(shW + 8), top + 24);
      ctx.lineTo(CX + side*(shW - 2), top + 24);
      ctx.lineTo(CX + side*(shW - 4), top);
      ctx.closePath();
      ctx.fill();

      // Sleeve hem
      ctx.strokeStyle = '#c89b3c';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(CX + side*(shW - 2), top + 24);
      ctx.lineTo(CX + side*(shW + 8), top + 24);
      ctx.stroke();
    });

    // Side panels (gold stripe)
    ctx.fillStyle = rgba(200,155,60,0.2);
    ctx.fillRect(CX - shW + 1, top + 6, 3, bot - top - 6);
    ctx.fillRect(CX + shW - 4, top + 6, 3, bot - top - 6);

    // Jersey number
    var pos = cfg.position || 'SG';
    var nY = top + 44;
    // Shadow
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = rgba(0,0,0,0.4);
    ctx.fillText(pos, CX + 1, nY + 1);
    // Gold outline
    ctx.strokeStyle = '#c89b3c';
    ctx.lineWidth = 2.5;
    ctx.strokeText(pos, CX, nY);
    // Fill
    ctx.fillStyle = '#f5c842';
    ctx.fillText(pos, CX, nY);
    // Highlight
    ctx.fillStyle = rgba(255,255,255,0.15);
    ctx.fillText(pos, CX, nY - 0.5);

    // Fabric texture (subtle grain)
    var rng = seededRand(42);
    ctx.fillStyle = rgba(255,255,255,0.012);
    for (var fi = 0; fi < 40; fi++) {
      var fx = CX + (rng()-0.5) * shW * 1.6;
      var fy = top + 10 + rng() * (bot - top - 14);
      ctx.fillRect(fx, fy, rng() * 3, 0.4);
    }

    // Fold shadows
    ctx.strokeStyle = rgba(0,0,0,0.1);
    ctx.lineWidth = 0.8;
    // Chest fold left
    ctx.beginPath();
    ctx.moveTo(CX - 14, top + 20);
    ctx.quadraticCurveTo(CX - 16, top + 40, CX - 12, bot - 8);
    ctx.stroke();
    // Chest fold right
    ctx.beginPath();
    ctx.moveTo(CX + 14, top + 20);
    ctx.quadraticCurveTo(CX + 16, top + 40, CX + 12, bot - 8);
    ctx.stroke();

    // Rim light on left edge
    ctx.strokeStyle = rgba(150,190,255,0.08);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(CX - shW, top + 8);
    ctx.lineTo(CX - wW, bot);
    ctx.stroke();
  }

  /* ── Arms ──────────────────────────────────────────────────── */
  function drawArms(ctx, cfg) {
    var bd = bodyDims(cfg.bodyType);
    var armTop = 110, armBot = 170;
    var w = bd.armW;

    [-1, 1].forEach(function(side) {
      var ax = CX + side * (bd.shoulderHW + 4);

      // Arm shape with taper
      var aG = ctx.createLinearGradient(ax - w/2, armTop, ax + w/2, armTop);
      aG.addColorStop(0, side < 0 ? warmHighlight(cfg.skinTone, 10) : warmShadow(cfg.skinTone, 15));
      aG.addColorStop(0.5, cfg.skinTone);
      aG.addColorStop(1, side < 0 ? warmShadow(cfg.skinTone, 12) : warmHighlight(cfg.skinTone, 8));
      ctx.fillStyle = aG;

      ctx.beginPath();
      ctx.moveTo(ax - w/2, armTop);
      ctx.lineTo(ax + w/2, armTop);
      ctx.lineTo(ax + w/2 - 1, armBot);
      ctx.lineTo(ax - w/2 + 1, armBot);
      ctx.closePath();
      ctx.fill();

      // Wrist line
      ctx.strokeStyle = withAlpha(warmShadow(cfg.skinTone, 20), 0.2);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(ax - w*0.35, armBot - 3);
      ctx.lineTo(ax + w*0.35, armBot - 3);
      ctx.stroke();

      // Rim light on left arm
      if (side < 0) {
        ctx.strokeStyle = rgba(150,190,255,0.1);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ax - w/2, armTop + 2);
        ctx.lineTo(ax - w/2 + 1, armBot - 2);
        ctx.stroke();
      }

      // Hand (circle with gradient)
      var hx = ax, hy = armBot + 5;
      var hG = ctx.createRadialGradient(hx - 2, hy - 2, 1, hx, hy, 6);
      hG.addColorStop(0, warmHighlight(cfg.skinTone, 12));
      hG.addColorStop(0.6, cfg.skinTone);
      hG.addColorStop(1, warmShadow(cfg.skinTone, 10));
      ctx.fillStyle = hG;
      ctx.beginPath();
      ctx.arc(hx, hy, 5.5, 0, Math.PI*2);
      ctx.fill();

      // Thumb hint on right hand
      if (side > 0) {
        ctx.fillStyle = warmShadow(cfg.skinTone, 6);
        ctx.beginPath();
        ctx.ellipse(hx - 4, hy + 1, 2, 3, -0.3, 0, Math.PI*2);
        ctx.fill();
      }
    });
  }

  /* ── Basketball ────────────────────────────────────────────── */
  function drawBall(ctx) {
    var bx = CX + bodyDims('athletic').shoulderHW + 9;
    var by = 178;
    var br = 9;

    // Ball with radial gradient
    var bG = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, br);
    bG.addColorStop(0, '#f5a623');
    bG.addColorStop(0.7, '#e8912a');
    bG.addColorStop(1, '#b5701f');
    ctx.fillStyle = bG;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI*2);
    ctx.fill();

    // Seam lines
    ctx.strokeStyle = rgba(60,30,10,0.35);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(bx - br, by);
    ctx.lineTo(bx + br, by);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by - br);
    ctx.lineTo(bx, by + br);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx - 2, by, br * 0.65, -0.8, 0.8);
    ctx.stroke();

    // Specular highlight
    ctx.fillStyle = rgba(255,255,255,0.25);
    ctx.beginPath();
    ctx.ellipse(bx - 3, by - 4, 3, 2, -0.3, 0, Math.PI*2);
    ctx.fill();
  }

  /* ── Neck ──────────────────────────────────────────────────── */
  function drawNeck(ctx, cfg) {
    var nTop = 78, nBot = 90, nW = 10;
    var nG = ctx.createLinearGradient(CX - nW, nTop, CX + nW, nTop);
    nG.addColorStop(0, warmHighlight(cfg.skinTone, 5));
    nG.addColorStop(0.5, warmShadow(cfg.skinTone, 8));
    nG.addColorStop(1, warmShadow(cfg.skinTone, 14));
    ctx.fillStyle = nG;
    ctx.fillRect(CX - nW, nTop, nW*2, nBot - nTop);

    // AO under chin
    var aoG = ctx.createLinearGradient(0, nTop, 0, nTop + 6);
    aoG.addColorStop(0, withAlpha(deepShadow(cfg.skinTone, 30), 0.5));
    aoG.addColorStop(1, rgba(0,0,0,0));
    ctx.fillStyle = aoG;
    ctx.fillRect(CX - nW, nTop, nW*2, 6);
  }

  /* ── Head (Memoji-quality with 5-stop skin gradient) ──────── */
  function drawHead(ctx, cfg) {
    var skin = cfg.skinTone;
    var bright = hexBrightness(skin);

    // Ambient occlusion halo (very subtle dark edge around head)
    ctx.save();
    headShape(ctx, CX, HEAD_CY, HEAD_RX + 1, HEAD_RY + 1);
    ctx.fillStyle = withAlpha(warmShadow(skin, 14), 0.06);
    ctx.fill();
    ctx.restore();

    // FLAT base fill — eliminates raccoon mask caused by gradient brightness variation
    headShape(ctx, CX, HEAD_CY, HEAD_RX, HEAD_RY);
    ctx.fillStyle = skin;
    ctx.fill();

    // 3D shading as subtle OVERLAY on top of flat base (clipped to head)
    ctx.save();
    headShape(ctx, CX, HEAD_CY, HEAD_RX, HEAD_RY);
    ctx.clip();

    // Bottom/jaw shadow (concentric, fades from bottom edge)
    var jawG = ctx.createRadialGradient(CX, HEAD_CY - 4, HEAD_RX * 0.5, CX, HEAD_CY - 4, HEAD_RY * 1.3);
    jawG.addColorStop(0, rgba(0,0,0,0));
    jawG.addColorStop(0.7, rgba(0,0,0,0));
    jawG.addColorStop(1, withAlpha(warmShadow(skin, 12), bright < 120 ? 0.12 : 0.18));
    ctx.fillStyle = jawG;
    ctx.fillRect(CX - HEAD_RX, HEAD_CY - HEAD_RY, HEAD_RX*2, HEAD_RY*2);

    // Top highlight (forehead glow, very gentle)
    var hiG = ctx.createRadialGradient(CX, HEAD_CY - HEAD_RY * 0.45, 4, CX, HEAD_CY - HEAD_RY * 0.3, HEAD_RX * 0.8);
    hiG.addColorStop(0, withAlpha(warmHighlight(skin, 10), bright < 120 ? 0.08 : 0.14));
    hiG.addColorStop(1, rgba(0,0,0,0));
    ctx.fillStyle = hiG;
    ctx.fillRect(CX - HEAD_RX, HEAD_CY - HEAD_RY, HEAD_RX*2, HEAD_RY);

    // Cheek blush (subtle warm tint)
    var blushC = bright > 140 ? rgba(220,140,120,0.1) : rgba(180,100,80,0.06);
    [-1, 1].forEach(function(side) {
      ctx.fillStyle = blushC;
      ctx.beginPath();
      ctx.ellipse(CX + side*14, HEAD_CY + 8, 8, 5, 0, 0, Math.PI*2);
      ctx.fill();
    });

    // Rim light (cool blue on left edge, very subtle)
    var rimG = ctx.createLinearGradient(CX - HEAD_RX - 2, HEAD_CY, CX - HEAD_RX + 5, HEAD_CY);
    rimG.addColorStop(0, rgba(150,190,255,0.06));
    rimG.addColorStop(1, rgba(0,0,0,0));
    ctx.fillStyle = rimG;
    ctx.fillRect(CX - HEAD_RX - 2, HEAD_CY - HEAD_RY + 4, 7, HEAD_RY*2 - 8);

    ctx.restore();

    // Ears
    [-1, 1].forEach(function(side) {
      var ex = CX + side * (HEAD_RX - 1);
      var ey = HEAD_CY + 2;
      // Ear AO (dark behind ear)
      ctx.fillStyle = withAlpha(warmShadow(skin, 20), 0.2);
      ctx.beginPath();
      ctx.ellipse(ex + side*1.5, ey, 5, 7.5, 0, 0, Math.PI*2);
      ctx.fill();
      // Ear base
      var eG = ctx.createRadialGradient(ex - side*1, ey - 2, 1, ex, ey, 6);
      eG.addColorStop(0, warmHighlight(skin, 8));
      eG.addColorStop(0.6, skin);
      eG.addColorStop(1, warmShadow(skin, 10));
      ctx.fillStyle = eG;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 4, 6.5, 0, 0, Math.PI*2);
      ctx.fill();
      // Inner ear
      ctx.fillStyle = withAlpha(warmShadow(skin, 20), 0.4);
      ctx.beginPath();
      ctx.ellipse(ex + side*0.5, ey, 2, 4, 0, 0, Math.PI*2);
      ctx.fill();
    });
  }

  /* ── Face (Memoji-quality eyes, nose, mouth) ───────────────── */
  function drawFace(ctx, cfg) {
    var skin = cfg.skinTone;
    var eyeY = HEAD_CY + 1;
    var eyeSpacing = 10;
    var bright = hexBrightness(skin);
    var isDark = bright < 120;

    /* ─── Eyebrows ─── */
    var browAlpha = isDark ? 0.3 : 0.45;
    var browColor = isDark ? rgba(30,20,12,browAlpha) : rgba(60,40,25,browAlpha);
    ctx.lineWidth = isDark ? 1.2 : 1.4;
    ctx.lineCap = 'round';
    [-1, 1].forEach(function(side) {
      var bx = CX + side * eyeSpacing;
      var by = eyeY - 9;
      ctx.strokeStyle = browColor;
      ctx.beginPath();
      ctx.moveTo(bx - side*5.5, by + 1.5);
      ctx.quadraticCurveTo(bx, by - 1.5, bx + side*5.5, by + 0.5);
      ctx.stroke();
    });

    /* ─── Eyes (detailed Memoji-style) ─── */
    [-1, 1].forEach(function(side) {
      var ex = CX + side * eyeSpacing;
      var ew = 7, eh = 5;

      // Sclera (off-white with subtle shading)
      ctx.save();
      ctx.beginPath();
      // Almond shape using bezier curves
      ctx.moveTo(ex - ew, eyeY + 0.5);
      ctx.bezierCurveTo(ex - ew*0.6, eyeY - eh, ex + ew*0.6, eyeY - eh, ex + ew, eyeY + 0.5);
      ctx.bezierCurveTo(ex + ew*0.6, eyeY + eh*0.7, ex - ew*0.6, eyeY + eh*0.7, ex - ew, eyeY + 0.5);
      ctx.closePath();
      var scG = ctx.createRadialGradient(ex - 1, eyeY - 1, 1, ex, eyeY, ew);
      scG.addColorStop(0, '#f5f2ed');
      scG.addColorStop(0.7, '#ece8e0');
      scG.addColorStop(1, '#d8d2c8');
      ctx.fillStyle = scG;
      ctx.fill();
      ctx.clip();

      // Iris
      var irisR = 3.8;
      var irisX = ex + side * 0.5;
      var irisY = eyeY + 0.3;

      // Limbal ring (dark outer ring)
      ctx.fillStyle = '#1a1208';
      ctx.beginPath();
      ctx.arc(irisX, irisY, irisR + 0.5, 0, Math.PI*2);
      ctx.fill();

      // Iris body with radial gradient
      var irG = ctx.createRadialGradient(irisX, irisY - 0.5, 0.5, irisX, irisY, irisR);
      irG.addColorStop(0, '#6B4423');
      irG.addColorStop(0.3, '#4A2F18');
      irG.addColorStop(0.7, '#3A2210');
      irG.addColorStop(1, '#2A180C');
      ctx.fillStyle = irG;
      ctx.beginPath();
      ctx.arc(irisX, irisY, irisR, 0, Math.PI*2);
      ctx.fill();

      // Iris fiber lines (radiating from pupil)
      var rng = seededRand(hashStr(skin + 'iris' + side));
      ctx.strokeStyle = rgba(90,60,30,0.15);
      ctx.lineWidth = 0.3;
      for (var fi = 0; fi < 16; fi++) {
        var angle = (fi / 16) * Math.PI * 2;
        var len = irisR * (0.5 + rng() * 0.4);
        ctx.beginPath();
        ctx.moveTo(irisX + Math.cos(angle) * 1.5, irisY + Math.sin(angle) * 1.5);
        ctx.lineTo(irisX + Math.cos(angle) * len, irisY + Math.sin(angle) * len);
        ctx.stroke();
      }

      // Pupil
      ctx.fillStyle = '#050505';
      ctx.beginPath();
      ctx.arc(irisX, irisY, 1.8, 0, Math.PI*2);
      ctx.fill();

      // Catchlight (main - upper left)
      ctx.fillStyle = rgba(255,255,255,0.92);
      ctx.beginPath();
      ctx.arc(irisX - irisR*0.35, irisY - irisR*0.4, 1.3, 0, Math.PI*2);
      ctx.fill();

      // Catchlight (secondary - lower right)
      ctx.fillStyle = rgba(255,255,255,0.45);
      ctx.beginPath();
      ctx.arc(irisX + irisR*0.25, irisY + irisR*0.3, 0.6, 0, Math.PI*2);
      ctx.fill();

      ctx.restore();

      // Upper eyelid line (defines eye shape)
      ctx.strokeStyle = isDark ? rgba(15,8,2,0.22) : rgba(40,25,15,0.35);
      ctx.lineWidth = isDark ? 0.6 : 0.8;
      ctx.beginPath();
      ctx.moveTo(ex - ew, eyeY + 0.5);
      ctx.bezierCurveTo(ex - ew*0.6, eyeY - eh, ex + ew*0.6, eyeY - eh, ex + ew, eyeY + 0.5);
      ctx.stroke();

      // Lower eyelid (subtle)
      ctx.strokeStyle = withAlpha(warmShadow(skin, 15), 0.2);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(ex - ew + 1, eyeY + 0.5);
      ctx.bezierCurveTo(ex - ew*0.5, eyeY + eh*0.7, ex + ew*0.5, eyeY + eh*0.7, ex + ew - 1, eyeY + 0.5);
      ctx.stroke();

      // Eyelash clusters (upper, subtle)
      ctx.strokeStyle = isDark ? rgba(8,4,0,0.15) : rgba(30,18,8,0.25);
      ctx.lineWidth = 0.4;
      ctx.lineCap = 'round';
      for (var li = 0; li < 3; li++) {
        var t = (li + 0.5) / 3;
        var lx = ex - ew*0.7 + t * ew * 1.4;
        var ly = eyeY - eh * Math.sin(t * Math.PI) * 0.85 + 0.5;
        var angle = -Math.PI/2 - (t - 0.5) * 0.5;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(angle)*1.8, ly + Math.sin(angle)*1.8);
        ctx.stroke();
      }
    });

    /* ─── Nose (subtle Memoji-style) ─── */
    var noseY = HEAD_CY + 9;
    // Nose shadow (starts BELOW eyes)
    ctx.fillStyle = withAlpha(warmShadow(skin, 14), 0.12);
    ctx.beginPath();
    ctx.moveTo(CX - 1, HEAD_CY + 4);
    ctx.quadraticCurveTo(CX - 3, noseY, CX - 4, noseY + 3);
    ctx.quadraticCurveTo(CX, noseY + 4.5, CX + 4, noseY + 3);
    ctx.quadraticCurveTo(CX + 3, noseY, CX + 1, HEAD_CY + 4);
    ctx.closePath();
    ctx.fill();

    // Nose tip
    ctx.fillStyle = withAlpha(warmShadow(skin, 12), 0.15);
    ctx.beginPath();
    ctx.ellipse(CX, noseY + 2, 3.5, 2, 0, 0, Math.PI*2);
    ctx.fill();

    // Nostrils
    ctx.fillStyle = withAlpha(deepShadow(skin, 30), 0.25);
    ctx.beginPath();
    ctx.ellipse(CX - 2.5, noseY + 3, 1.2, 0.8, 0.2, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CX + 2.5, noseY + 3, 1.2, 0.8, -0.2, 0, Math.PI*2);
    ctx.fill();

    // Nose highlight
    ctx.fillStyle = withAlpha(warmHighlight(skin, 20), 0.12);
    ctx.beginPath();
    ctx.ellipse(CX - 0.5, noseY - 1, 1.2, 2.5, 0, 0, Math.PI*2);
    ctx.fill();

    /* ─── Mouth (Memoji-style with lips) ─── */
    var mouthY = HEAD_CY + 17;
    var mouthW = 7;
    var lipColor = hexBrightness(skin) > 140
      ? warmShadow(skin, 25)
      : lerpColor(skin, '#8B4040', 0.3);

    // Lip shadow under bottom lip
    ctx.fillStyle = withAlpha(deepShadow(skin, 20), 0.12);
    ctx.beginPath();
    ctx.ellipse(CX, mouthY + 5, mouthW + 1, 2.5, 0, 0, Math.PI*2);
    ctx.fill();

    // Upper lip (cupid's bow)
    ctx.beginPath();
    ctx.moveTo(CX - mouthW, mouthY);
    ctx.quadraticCurveTo(CX - mouthW*0.5, mouthY - 2, CX - 1, mouthY - 1);
    ctx.lineTo(CX, mouthY - 1.5);
    ctx.lineTo(CX + 1, mouthY - 1);
    ctx.quadraticCurveTo(CX + mouthW*0.5, mouthY - 2, CX + mouthW, mouthY);
    ctx.quadraticCurveTo(CX, mouthY + 1, CX - mouthW, mouthY);
    ctx.closePath();
    ctx.fillStyle = withAlpha(lipColor, 0.55);
    ctx.fill();

    // Lower lip
    ctx.beginPath();
    ctx.moveTo(CX - mouthW + 0.5, mouthY);
    ctx.quadraticCurveTo(CX, mouthY + 5, CX + mouthW - 0.5, mouthY);
    ctx.quadraticCurveTo(CX, mouthY + 1, CX - mouthW + 0.5, mouthY);
    ctx.closePath();
    ctx.fillStyle = withAlpha(lipColor, 0.45);
    ctx.fill();

    // Lip line (mouth seam)
    ctx.strokeStyle = withAlpha(deepShadow(skin, 30), 0.3);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(CX - mouthW + 1, mouthY);
    ctx.quadraticCurveTo(CX, mouthY + 0.5, CX + mouthW - 1, mouthY);
    ctx.stroke();

    // Lower lip highlight
    ctx.fillStyle = withAlpha(warmHighlight(skin, 20), 0.12);
    ctx.beginPath();
    ctx.ellipse(CX, mouthY + 2.5, 4, 1.5, 0, 0, Math.PI*2);
    ctx.fill();
  }

  /* ── Hair styles ───────────────────────────────────────────── */
  function drawHair(ctx, style, color) {
    if (style === 'bald' || style === 'afro') {
      if (style === 'bald') {
        // Bald shine
        var bsG = ctx.createRadialGradient(CX - 4, HEAD_CY - HEAD_RY*0.6, 2, CX - 4, HEAD_CY - HEAD_RY*0.6, 14);
        bsG.addColorStop(0, rgba(255,255,255,0.12));
        bsG.addColorStop(1, rgba(255,255,255,0));
        ctx.fillStyle = bsG;
        ctx.beginPath();
        ctx.ellipse(CX - 4, HEAD_CY - HEAD_RY*0.55, 10, 6, -0.2, 0, Math.PI*2);
        ctx.fill();
      }
      return;
    }

    var hi = lighter(color, 25);
    var sh = darker(color, 15);
    var bright = hexBrightness(color);

    ctx.save();
    headShape(ctx, CX, HEAD_CY, HEAD_RX + 1, HEAD_RY + 1);
    ctx.clip();

    if (style === 'buzz') {
      // Flat cropped hair — hairline well above brow
      ctx.fillStyle = color;
      ctx.fillRect(CX - HEAD_RX - 2, HEAD_CY - HEAD_RY - 2, HEAD_RX*2 + 4, HEAD_RY - 5);
      // Gradient for volume
      var bzG = ctx.createLinearGradient(CX, HEAD_CY - HEAD_RY, CX, HEAD_CY - HEAD_RY*0.5);
      bzG.addColorStop(0, withAlpha(hi, 0.2));
      bzG.addColorStop(1, rgba(0,0,0,0));
      ctx.fillStyle = bzG;
      ctx.fillRect(CX - HEAD_RX, HEAD_CY - HEAD_RY, HEAD_RX*2, HEAD_RY*0.5);
    }

    else if (style === 'short') {
      // Short hair with volume — raised hairline
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(CX, HEAD_CY - 8, HEAD_RX + 3, HEAD_RY*0.48, 0, Math.PI*1.02, Math.PI*1.98, true);
      ctx.fill();
      // Volume highlight arc
      ctx.strokeStyle = withAlpha(hi, 0.2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CX, HEAD_CY - 8, HEAD_RX - 2, Math.PI*1.2, Math.PI*1.8, true);
      ctx.stroke();
    }

    else if (style === 'fade') {
      // Top hair — raised hairline
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(CX, HEAD_CY - 8, HEAD_RX + 1, HEAD_RY*0.42, 0, Math.PI*1.05, Math.PI*1.95, true);
      ctx.fill();
      // Fade sides (gradient opacity)
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      // Left fade
      ctx.beginPath();
      ctx.ellipse(CX, HEAD_CY - 4, HEAD_RX + 1, HEAD_RY*0.28, 0, Math.PI*0.85, Math.PI*1.15);
      ctx.fill();
      // Right fade
      ctx.beginPath();
      ctx.ellipse(CX, HEAD_CY - 4, HEAD_RX + 1, HEAD_RY*0.28, 0, Math.PI*1.85, Math.PI*0.15);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Volume highlight
      ctx.strokeStyle = withAlpha(hi, 0.18);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(CX, HEAD_CY - 8, HEAD_RX - 4, Math.PI*1.2, Math.PI*1.8, true);
      ctx.stroke();
    }

    else if (style === 'waves') {
      ctx.fillStyle = color;
      ctx.fillRect(CX - HEAD_RX - 2, HEAD_CY - HEAD_RY - 2, HEAD_RX*2 + 4, HEAD_RY - 4);
      // Wave arcs
      ctx.strokeStyle = withAlpha(bright > 100 ? sh : hi, 0.2);
      ctx.lineWidth = 1.2;
      for (var w = 0; w < 5; w++) {
        ctx.beginPath();
        ctx.arc(CX, HEAD_CY - HEAD_RY*0.4, 4 + w * 4, Math.PI*0.15, Math.PI*0.85);
        ctx.stroke();
      }
      // Top highlight
      ctx.strokeStyle = withAlpha(hi, 0.15);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CX, HEAD_CY - HEAD_RY*0.4, 6, Math.PI*0.3, Math.PI*0.7);
      ctx.stroke();
    }

    else if (style === 'dreads') {
      // Base volume
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(CX, HEAD_CY - 6, HEAD_RX + 3, HEAD_RY*0.45, 0, Math.PI*1.02, Math.PI*1.98, true);
      ctx.fill();
      ctx.restore();

      // Hanging dreads
      ctx.lineCap = 'round';
      var rng = seededRand(hashStr(color + 'dreads'));
      for (var d = 0; d < 9; d++) {
        var angle = Math.PI * (0.1 + 0.8 * (d / 8));
        var dx = CX + Math.cos(angle) * (HEAD_RX + 2);
        var dy = HEAD_CY - Math.sin(angle) * (HEAD_RY - 6);
        var dLen = 10 + rng() * 14;
        var dCurve = (rng() - 0.5) * 8;

        // Dread shadow
        ctx.strokeStyle = withAlpha(sh, 0.4);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.quadraticCurveTo(dx + dCurve, dy + dLen*0.6, dx + dCurve*0.5, dy + dLen);
        ctx.stroke();

        // Dread body
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.quadraticCurveTo(dx + dCurve, dy + dLen*0.6, dx + dCurve*0.5, dy + dLen);
        ctx.stroke();

        // Highlight
        ctx.strokeStyle = withAlpha(hi, 0.12);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dx - 0.5, dy + 1);
        ctx.lineTo(dx + dCurve*0.3 - 0.5, dy + dLen*0.5);
        ctx.stroke();
      }
      return;
    }

    else if (style === 'mohawk') {
      // Mohawk spikes
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(CX - 5, HEAD_CY - HEAD_RY*0.3);
      ctx.bezierCurveTo(CX - 6, HEAD_CY - HEAD_RY - 6, CX - 3, HEAD_CY - HEAD_RY - 18, CX, HEAD_CY - HEAD_RY - 20);
      ctx.bezierCurveTo(CX + 3, HEAD_CY - HEAD_RY - 18, CX + 6, HEAD_CY - HEAD_RY - 6, CX + 5, HEAD_CY - HEAD_RY*0.3);
      ctx.closePath();
      ctx.fill();
      // Highlight
      ctx.fillStyle = withAlpha(hi, 0.15);
      ctx.beginPath();
      ctx.moveTo(CX - 2, HEAD_CY - HEAD_RY*0.3);
      ctx.bezierCurveTo(CX - 2, HEAD_CY - HEAD_RY - 4, CX - 1, HEAD_CY - HEAD_RY - 14, CX, HEAD_CY - HEAD_RY - 16);
      ctx.bezierCurveTo(CX + 1, HEAD_CY - HEAD_RY - 14, CX + 1, HEAD_CY - HEAD_RY - 8, CX + 1, HEAD_CY - HEAD_RY*0.3);
      ctx.closePath();
      ctx.fill();
      // Side shave
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = color;
      ctx.fillRect(CX - HEAD_RX, HEAD_CY - HEAD_RY + 4, HEAD_RX*2, HEAD_RY*0.6);
      ctx.globalAlpha = 1;
    }

    else if (style === 'cornrows') {
      ctx.fillStyle = color;
      ctx.fillRect(CX - HEAD_RX - 2, HEAD_CY - HEAD_RY - 2, HEAD_RX*2 + 4, HEAD_RY + 4);
      // Cornrow lines
      ctx.strokeStyle = withAlpha(bright > 80 ? darker(color, 25) : lighter(color, 15), 0.5);
      ctx.lineWidth = 0.8;
      for (var c = -4; c <= 4; c++) {
        ctx.beginPath();
        ctx.moveTo(CX + c * 5, HEAD_CY - HEAD_RY + 2);
        ctx.quadraticCurveTo(CX + c * 5.5, HEAD_CY - HEAD_RY*0.2, CX + c * 6, HEAD_CY + 4);
        ctx.stroke();
      }
      // Row highlights
      ctx.strokeStyle = withAlpha(hi, 0.08);
      ctx.lineWidth = 2;
      for (var cr = -3; cr <= 3; cr++) {
        ctx.beginPath();
        ctx.moveTo(CX + cr * 5 + 1, HEAD_CY - HEAD_RY + 6);
        ctx.lineTo(CX + cr * 5.5 + 1, HEAD_CY - HEAD_RY*0.3);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /* ── Afro (drawn behind head) ──────────────────────────────── */
  function drawAfro(ctx, color) {
    var afroR = HEAD_RX + 20;
    var hi = lighter(color, 20);
    var sh = darker(color, 12);

    // Base
    ctx.beginPath();
    ctx.ellipse(CX, HEAD_CY - 4, afroR, afroR - 2, 0, 0, Math.PI*2);
    var aG = ctx.createRadialGradient(CX - 8, HEAD_CY - 14, 3, CX, HEAD_CY - 4, afroR);
    aG.addColorStop(0, hi);
    aG.addColorStop(0.5, color);
    aG.addColorStop(1, sh);
    ctx.fillStyle = aG;
    ctx.fill();

    // Texture dots
    var rng = seededRand(hashStr(color + 'afro'));
    ctx.fillStyle = withAlpha(hi, 0.06);
    for (var i = 0; i < 40; i++) {
      var ax = CX + (rng()-0.5) * afroR*1.6;
      var ay = HEAD_CY - 4 + (rng()-0.5) * afroR*1.6;
      var dist = Math.sqrt((ax-CX)*(ax-CX) + (ay-HEAD_CY+4)*(ay-HEAD_CY+4));
      if (dist < afroR - 4) {
        ctx.beginPath();
        ctx.arc(ax, ay, 0.8 + rng(), 0, Math.PI*2);
        ctx.fill();
      }
    }

    // Highlight arc (top)
    ctx.strokeStyle = withAlpha(hi, 0.12);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CX, HEAD_CY - 4, afroR - 6, Math.PI*1.15, Math.PI*1.85, true);
    ctx.stroke();

    // Rim light
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(CX, HEAD_CY - 4, afroR, afroR - 2, 0, 0, Math.PI*2);
    ctx.clip();
    var rimG = ctx.createLinearGradient(CX - afroR - 2, HEAD_CY, CX - afroR + 10, HEAD_CY);
    rimG.addColorStop(0, rgba(150,190,255,0.12));
    rimG.addColorStop(1, rgba(0,0,0,0));
    ctx.fillStyle = rimG;
    ctx.fillRect(CX - afroR - 2, HEAD_CY - afroR, 12, afroR*2);
    ctx.restore();
  }

  /* ── Beard styles ──────────────────────────────────────────── */
  function drawBeard(ctx, style, hairColor, skinTone) {
    if (style === 'none') return;
    var chinY = HEAD_CY + HEAD_RY;
    var jawW = HEAD_RX * 0.7;

    if (style === 'stubble') {
      var rng = seededRand(hashStr(hairColor + 'stubble'));
      ctx.fillStyle = withAlpha(hairColor, 0.18);
      for (var i = 0; i < 50; i++) {
        var sx = CX + (rng()-0.5) * HEAD_RX * 1.4;
        var sy = HEAD_CY + HEAD_RY*0.35 + rng() * HEAD_RY * 0.7;
        // Check if inside face roughly
        var fDist = Math.abs(sx - CX) / HEAD_RX;
        var yFrac = (sy - HEAD_CY) / HEAD_RY;
        if (fDist < 0.85 - yFrac*0.2 && yFrac > 0.2) {
          ctx.beginPath();
          ctx.arc(sx, sy, 0.3 + rng()*0.4, 0, Math.PI*2);
          ctx.fill();
        }
      }
      // Subtle jaw shadow
      ctx.fillStyle = withAlpha(hairColor, 0.06);
      ctx.beginPath();
      ctx.ellipse(CX, chinY - 4, jawW, 8, 0, 0, Math.PI);
      ctx.fill();
    }

    else if (style === 'short') {
      // Short beard
      ctx.save();
      headShape(ctx, CX, HEAD_CY, HEAD_RX, HEAD_RY);
      ctx.clip();
      var sbG = ctx.createRadialGradient(CX, HEAD_CY + HEAD_RY*0.5, 2, CX, HEAD_CY + HEAD_RY*0.5, HEAD_RY*0.6);
      sbG.addColorStop(0, withAlpha(hairColor, 0.5));
      sbG.addColorStop(1, withAlpha(hairColor, 0.15));
      ctx.fillStyle = sbG;
      ctx.fillRect(CX - HEAD_RX, HEAD_CY + HEAD_RY*0.25, HEAD_RX*2, HEAD_RY*0.8);
      ctx.restore();
    }

    else if (style === 'full') {
      // Full beard extending below chin
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(CX - HEAD_RX*0.85, HEAD_CY + HEAD_RY*0.2);
      ctx.quadraticCurveTo(CX - HEAD_RX*0.9, HEAD_CY + HEAD_RY*0.8, CX - HEAD_RX*0.4, chinY + 8);
      ctx.quadraticCurveTo(CX, chinY + 12, CX + HEAD_RX*0.4, chinY + 8);
      ctx.quadraticCurveTo(CX + HEAD_RX*0.9, HEAD_CY + HEAD_RY*0.8, CX + HEAD_RX*0.85, HEAD_CY + HEAD_RY*0.2);
      ctx.closePath();
      var fbG = ctx.createRadialGradient(CX, HEAD_CY + HEAD_RY*0.5, 2, CX, HEAD_CY + HEAD_RY*0.5, HEAD_RY*0.8);
      fbG.addColorStop(0, withAlpha(hairColor, 0.6));
      fbG.addColorStop(0.7, withAlpha(hairColor, 0.5));
      fbG.addColorStop(1, withAlpha(hairColor, 0.25));
      ctx.fillStyle = fbG;
      ctx.fill();
      // Texture
      var rng2 = seededRand(hashStr(hairColor + 'full'));
      ctx.fillStyle = withAlpha(lighter(hairColor, 15), 0.06);
      for (var fi = 0; fi < 20; fi++) {
        var fx = CX + (rng2()-0.5) * HEAD_RX * 1.2;
        var fy = HEAD_CY + HEAD_RY*0.35 + rng2() * HEAD_RY * 0.7;
        ctx.beginPath();
        ctx.arc(fx, fy, 0.5 + rng2(), 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }

    else if (style === 'goatee') {
      ctx.beginPath();
      ctx.moveTo(CX - 6, HEAD_CY + HEAD_RY*0.45);
      ctx.quadraticCurveTo(CX - 8, chinY, CX - 4, chinY + 6);
      ctx.quadraticCurveTo(CX, chinY + 9, CX + 4, chinY + 6);
      ctx.quadraticCurveTo(CX + 8, chinY, CX + 6, HEAD_CY + HEAD_RY*0.45);
      ctx.closePath();
      var gG = ctx.createRadialGradient(CX, chinY - 2, 1, CX, chinY, 10);
      gG.addColorStop(0, withAlpha(hairColor, 0.55));
      gG.addColorStop(1, withAlpha(hairColor, 0.2));
      ctx.fillStyle = gG;
      ctx.fill();
    }

    else if (style === 'chinstrap') {
      ctx.strokeStyle = withAlpha(hairColor, 0.5);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(CX - HEAD_RX*0.7, HEAD_CY + HEAD_RY*0.1);
      ctx.quadraticCurveTo(CX - HEAD_RX*0.9, HEAD_CY + HEAD_RY*0.7, CX - HEAD_RX*0.3, chinY + 2);
      ctx.quadraticCurveTo(CX, chinY + 5, CX + HEAD_RX*0.3, chinY + 2);
      ctx.quadraticCurveTo(CX + HEAD_RX*0.9, HEAD_CY + HEAD_RY*0.7, CX + HEAD_RX*0.7, HEAD_CY + HEAD_RY*0.1);
      ctx.stroke();
    }
  }

  /* ── Accessories ───────────────────────────────────────────── */
  function drawAccessory(ctx, acc, cfg) {
    if (acc === 'none') return;

    if (acc === 'headband') {
      ctx.save();
      headShape(ctx, CX, HEAD_CY, HEAD_RX + 0.5, HEAD_RY + 0.5);
      ctx.clip();
      var hbY = HEAD_CY - HEAD_RY*0.42;
      var hbG = ctx.createLinearGradient(CX - HEAD_RX, hbY, CX + HEAD_RX, hbY);
      hbG.addColorStop(0, '#d4a032');
      hbG.addColorStop(0.5, '#e8b848');
      hbG.addColorStop(1, '#c49028');
      ctx.fillStyle = hbG;
      ctx.fillRect(CX - HEAD_RX - 2, hbY - 3, HEAD_RX*2 + 4, 6);
      // Highlight
      ctx.fillStyle = rgba(255,255,255,0.15);
      ctx.fillRect(CX - HEAD_RX, hbY - 2, HEAD_RX*2, 2);
      ctx.restore();
    }

    else if (acc === 'sweatband') {
      ctx.save();
      headShape(ctx, CX, HEAD_CY, HEAD_RX + 0.5, HEAD_RY + 0.5);
      ctx.clip();
      var sbY = HEAD_CY - HEAD_RY*0.38;
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(CX - HEAD_RX - 2, sbY - 3.5, HEAD_RX*2 + 4, 7);
      ctx.fillStyle = rgba(200,200,200,0.3);
      ctx.fillRect(CX - HEAD_RX, sbY + 1, HEAD_RX*2, 2);
      ctx.restore();
    }

    else if (acc === 'glasses') {
      var gY = HEAD_CY + 1;
      var gW = 8, gH = 6;
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      // Frames
      [-1, 1].forEach(function(side) {
        var gx = CX + side * 10;
        roundRect(ctx, gx - gW/2, gY - gH/2, gW, gH, 2);
        ctx.stroke();
      });
      // Bridge
      ctx.beginPath();
      ctx.moveTo(CX - 6, gY);
      ctx.quadraticCurveTo(CX, gY - 2, CX + 6, gY);
      ctx.stroke();
      // Temples
      ctx.beginPath();
      ctx.moveTo(CX - 14, gY - 1);
      ctx.lineTo(CX - HEAD_RX + 1, gY - 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(CX + 14, gY - 1);
      ctx.lineTo(CX + HEAD_RX - 1, gY - 1);
      ctx.stroke();
      // Lens reflection
      ctx.fillStyle = rgba(255,255,255,0.08);
      [-1, 1].forEach(function(side) {
        ctx.beginPath();
        ctx.ellipse(CX + side*10 - 1, gY - 1, 2.5, 1.5, -0.3, 0, Math.PI*2);
        ctx.fill();
      });
    }

    else if (acc === 'chain') {
      var chY = HEAD_CY + HEAD_RY + 8;
      ctx.strokeStyle = '#d4a832';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(CX - 14, chY);
      ctx.quadraticCurveTo(CX, chY + 10, CX + 14, chY);
      ctx.stroke();
      // Chain links
      ctx.fillStyle = '#e8c848';
      for (var cl = 0; cl < 7; cl++) {
        var t = cl / 6;
        var clx = CX - 14 + t * 28;
        var cly = chY + Math.sin(t * Math.PI) * 10;
        ctx.beginPath();
        ctx.arc(clx, cly, 1.2, 0, Math.PI*2);
        ctx.fill();
      }
      // Pendant
      ctx.fillStyle = '#f0d050';
      ctx.beginPath();
      ctx.arc(CX, chY + 10, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = rgba(255,255,255,0.2);
      ctx.beginPath();
      ctx.arc(CX - 0.8, chY + 9, 1, 0, Math.PI*2);
      ctx.fill();
    }

    else if (acc === 'durag') {
      ctx.save();
      // Durag covers top of head
      headShape(ctx, CX, HEAD_CY, HEAD_RX + 1, HEAD_RY + 1);
      ctx.clip();
      var dG = ctx.createLinearGradient(CX - HEAD_RX, HEAD_CY - HEAD_RY, CX + HEAD_RX, HEAD_CY - HEAD_RY);
      dG.addColorStop(0, '#243868');
      dG.addColorStop(0.5, '#1e3058');
      dG.addColorStop(1, '#182848');
      ctx.fillStyle = dG;
      ctx.fillRect(CX - HEAD_RX - 2, HEAD_CY - HEAD_RY - 2, HEAD_RX*2 + 4, HEAD_RY*0.9);
      // Seam line
      ctx.strokeStyle = rgba(255,255,255,0.08);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(CX, HEAD_CY - HEAD_RY + 2);
      ctx.lineTo(CX, HEAD_CY - HEAD_RY*0.15);
      ctx.stroke();
      // Shine
      ctx.fillStyle = rgba(100,140,220,0.08);
      ctx.beginPath();
      ctx.ellipse(CX - 5, HEAD_CY - HEAD_RY*0.55, 8, 4, -0.2, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
      // Tail
      ctx.strokeStyle = '#1e3058';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(CX, HEAD_CY - HEAD_RY*0.1);
      ctx.quadraticCurveTo(CX + 12, HEAD_CY - HEAD_RY*0.05, CX + 20, HEAD_CY + 4);
      ctx.stroke();
      ctx.strokeStyle = rgba(100,140,220,0.06);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(CX + 1, HEAD_CY - HEAD_RY*0.1);
      ctx.quadraticCurveTo(CX + 13, HEAD_CY - HEAD_RY*0.05, CX + 20, HEAD_CY + 3);
      ctx.stroke();
    }

    else if (acc === 'armband') {
      var bd = bodyDims(cfg.bodyType);
      [-1, 1].forEach(function(side) {
        var abx = CX + side * (bd.shoulderHW + 4);
        var aby = 130;
        ctx.fillStyle = '#c89b3c';
        ctx.fillRect(abx - bd.armW/2 - 0.5, aby, bd.armW + 1, 4);
        ctx.fillStyle = rgba(255,255,255,0.12);
        ctx.fillRect(abx - bd.armW/2, aby, bd.armW, 1.5);
      });
    }
  }

  /* ── Particles (floating sparkles) ─────────────────────────── */
  function drawParticles(ctx) {
    var rng = seededRand(777);
    for (var i = 0; i < 8; i++) {
      var px = 15 + rng() * (AW - 30);
      var py = 15 + rng() * (AH - 30);
      var ps = 0.5 + rng() * 1.2;
      ctx.fillStyle = rgba(245,200,100, 0.06 + rng()*0.06);
      ctx.beginPath();
      ctx.arc(px, py, ps, 0, Math.PI*2);
      ctx.fill();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN DRAW (full avatar)
     ══════════════════════════════════════════════════════════════ */
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
    drawBall(ctx);
    drawNeck(ctx, cfg);
    drawHead(ctx, cfg);
    drawHair(ctx, cfg.hairStyle, cfg.hairColor);
    drawFace(ctx, cfg);
    drawBeard(ctx, cfg.beardStyle, cfg.hairColor, cfg.skinTone);
    drawAccessory(ctx, cfg.accessory, cfg);
    drawParticles(ctx);
  }

  /* ══════════════════════════════════════════════════════════════
     MINI AVATAR (48x48) — Memoji-quality at small scale
     ══════════════════════════════════════════════════════════════ */
  function drawMini(canvas, data) {
    if (!canvas) return;
    var s = 48;
    var ctx = canvas.getContext('2d');
    var cfg = Object.assign({}, defaults, data || {});
    canvas.width = s;
    canvas.height = s;
    ctx.clearRect(0, 0, s, s);

    var cx = s/2, cy = s/2 + 1;
    var hw = 15, hh = 17;

    // Background circle
    var bgG = ctx.createRadialGradient(cx, cy, 2, cx, cy, s/2);
    bgG.addColorStop(0, '#1e2028');
    bgG.addColorStop(1, '#14161a');
    ctx.beginPath();
    ctx.arc(cx, cy, s/2, 0, Math.PI*2);
    ctx.fillStyle = bgG;
    ctx.fill();

    // Rim glow border
    ctx.beginPath();
    ctx.arc(cx, cy, s/2 - 0.5, 0, Math.PI*2);
    ctx.strokeStyle = rgba(245,166,35,0.15);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Neck hint
    ctx.fillStyle = warmShadow(cfg.skinTone, 10);
    ctx.fillRect(cx - 5, cy + hh - 4, 10, 8);

    // Shoulder/jersey hint
    var jG = ctx.createLinearGradient(cx - 16, cy + hh, cx + 16, cy + hh);
    jG.addColorStop(0, '#243868');
    jG.addColorStop(0.5, '#1a2744');
    jG.addColorStop(1, '#141e36');
    ctx.fillStyle = jG;
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
      ctx.arc(cx, cy - 2, 22, 0, Math.PI*2);
      var amG = ctx.createRadialGradient(cx - 4, cy - 8, 2, cx, cy - 2, 22);
      amG.addColorStop(0, lighter(cfg.hairColor, 15));
      amG.addColorStop(0.7, cfg.hairColor);
      amG.addColorStop(1, darker(cfg.hairColor, 10));
      ctx.fillStyle = amG;
      ctx.fill();
    }

    // Head — flat base fill (prevents raccoon mask)
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI*2);
    ctx.fillStyle = cfg.skinTone;
    ctx.fill();

    // Subtle 3D overlay (clipped to head)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI*2);
    ctx.clip();
    var bright = hexBrightness(cfg.skinTone);
    // Bottom jaw shadow
    var jwM = ctx.createRadialGradient(cx, cy - 3, hw*0.4, cx, cy - 3, hh*1.2);
    jwM.addColorStop(0, rgba(0,0,0,0));
    jwM.addColorStop(0.7, rgba(0,0,0,0));
    jwM.addColorStop(1, withAlpha(warmShadow(cfg.skinTone, 10), bright < 120 ? 0.1 : 0.15));
    ctx.fillStyle = jwM;
    ctx.fillRect(cx - hw, cy - hh, hw*2, hh*2);
    // Top highlight
    var hiM = ctx.createRadialGradient(cx, cy - hh*0.5, 2, cx, cy - hh*0.3, hw*0.7);
    hiM.addColorStop(0, withAlpha(warmHighlight(cfg.skinTone, 8), bright < 120 ? 0.06 : 0.1));
    hiM.addColorStop(1, rgba(0,0,0,0));
    ctx.fillStyle = hiM;
    ctx.fillRect(cx - hw, cy - hh, hw*2, hh);
    ctx.restore();

    // Mini hair (positioned higher to keep forehead visible and avoid mask effect)
    var hairBottom = cy - 5; // hair must stop well above eye line (meY = cy+0.5)
    if (cfg.hairStyle !== 'bald' && cfg.hairStyle !== 'afro') {
      ctx.fillStyle = cfg.hairColor;
      if (cfg.hairStyle === 'buzz' || cfg.hairStyle === 'waves') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI*2);
        ctx.clip();
        ctx.fillRect(cx - hw - 2, cy - hh - 2, hw*2 + 4, hh - 3);
        if (cfg.hairStyle === 'waves') {
          ctx.strokeStyle = withAlpha(lighter(cfg.hairColor, 20), 0.2);
          ctx.lineWidth = 1;
          for (var wr = 0; wr < 3; wr++) {
            ctx.beginPath();
            ctx.arc(cx, cy - hh*0.4, 3 + wr*3, Math.PI*0.2, Math.PI*0.8);
            ctx.stroke();
          }
        }
        ctx.restore();
      } else if (cfg.hairStyle === 'short') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI*2);
        ctx.clip();
        ctx.fillRect(cx - hw - 2, cy - hh - 2, hw*2 + 4, hh - 4);
        ctx.restore();
      } else if (cfg.hairStyle === 'fade') {
        ctx.beginPath();
        ctx.ellipse(cx, cy - 8, hw, hh*0.4, 0, Math.PI*1.1, Math.PI*1.9, true);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 2, hw + 1, hh*0.25, 0, Math.PI*0.85, Math.PI*1.15);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, cy - 2, hw + 1, hh*0.25, 0, Math.PI*1.85, Math.PI*0.15);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (cfg.hairStyle === 'dreads') {
        ctx.beginPath();
        ctx.ellipse(cx, cy - 5, hw + 2, hh*0.4, 0, Math.PI*1.05, Math.PI*1.95, true);
        ctx.fill();
        ctx.strokeStyle = cfg.hairColor;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (var d = 0; d < 5; d++) {
          var da = Math.PI * (0.2 + 0.6*(d/4));
          var dsx = cx + Math.cos(da) * (hw + 1);
          var dsy = cy - Math.sin(da) * (hh - 4);
          ctx.beginPath();
          ctx.moveTo(dsx, dsy);
          ctx.lineTo(dsx + (d%2 ? 2 : -2), dsy + 6 + d);
          ctx.stroke();
        }
      } else if (cfg.hairStyle === 'mohawk') {
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - hh*0.3);
        ctx.bezierCurveTo(cx - 4, cy - hh - 2, cx - 2, cy - hh - 8, cx, cy - hh - 9);
        ctx.bezierCurveTo(cx + 2, cy - hh - 8, cx + 4, cy - hh - 2, cx + 3, cy - hh*0.3);
        ctx.closePath();
        ctx.fill();
      } else if (cfg.hairStyle === 'cornrows') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI*2);
        ctx.clip();
        ctx.fillRect(cx - hw - 2, cy - hh - 2, hw*2 + 4, hh - 3);
        ctx.strokeStyle = withAlpha(darker(cfg.hairColor, 20), 0.4);
        ctx.lineWidth = 0.5;
        for (var cr = -3; cr <= 3; cr++) {
          ctx.beginPath();
          ctx.moveTo(cx + cr*3, cy - hh + 2);
          ctx.lineTo(cx + cr*3.5, cy - 5);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Bald highlight
    if (cfg.hairStyle === 'bald') {
      var bhG = ctx.createRadialGradient(cx - 2, cy - hh + 4, 1, cx - 2, cy - hh + 4, 8);
      bhG.addColorStop(0, rgba(255,255,255,0.1));
      bhG.addColorStop(1, rgba(255,255,255,0));
      ctx.fillStyle = bhG;
      ctx.fillRect(cx - 10, cy - hh, 16, 12);
    }

    // Accessory hints
    if (cfg.accessory === 'headband') {
      ctx.fillStyle = '#d4a032';
      ctx.beginPath();
      ctx.ellipse(cx, cy - hh*0.5, hw + 0.5, 2.5, 0, 0, Math.PI*2);
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
      ctx.ellipse(cx, cy, hw + 1, hh + 1, 0, 0, Math.PI*2);
      ctx.clip();
      ctx.fillStyle = '#1a2d5a';
      ctx.fillRect(cx - hw - 2, cy - hh - 2, hw*2 + 4, hh*0.7);
      ctx.restore();
    } else if (cfg.accessory === 'chain') {
      ctx.strokeStyle = '#d4a832';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + hh - 2);
      ctx.quadraticCurveTo(cx, cy + hh + 4, cx + 6, cy + hh - 2);
      ctx.stroke();
    }

    // Eyes (clean simple style for mini — avoids mask effect at small scale)
    var meY = cy + 0.5;
    var mBright = hexBrightness(cfg.skinTone);
    var mDark = mBright < 120;
    [-1, 1].forEach(function(side) {
      var ex = cx + side * 5;
      // Small sclera
      ctx.fillStyle = mDark ? '#e8e4dc' : '#f0ece4';
      ctx.beginPath();
      ctx.ellipse(ex, meY, 2.5, 1.8, 0, 0, Math.PI*2);
      ctx.fill();
      // Dark iris (fills most of the eye)
      ctx.fillStyle = '#1a1408';
      ctx.beginPath();
      ctx.arc(ex + side*0.2, meY + 0.1, 1.4, 0, Math.PI*2);
      ctx.fill();
      // Catchlight dot
      ctx.fillStyle = rgba(255,255,255,0.8);
      ctx.beginPath();
      ctx.arc(ex - 0.4, meY - 0.4, 0.45, 0, Math.PI*2);
      ctx.fill();
    });

    // Eyebrows (thin, subtle — no heavy band)
    ctx.strokeStyle = mDark ? rgba(20,12,6,0.18) : rgba(40,25,15,0.25);
    ctx.lineWidth = 0.6;
    ctx.lineCap = 'round';
    [-1, 1].forEach(function(side) {
      ctx.beginPath();
      ctx.moveTo(cx + side*3, meY - 3.5);
      ctx.quadraticCurveTo(cx + side*5, meY - 4.5, cx + side*7, meY - 3.2);
      ctx.stroke();
    });

    // Nose
    ctx.fillStyle = withAlpha(warmShadow(cfg.skinTone, 12), mDark ? 0.08 : 0.12);
    ctx.beginPath();
    ctx.ellipse(cx, meY + 4.5, 2, 1.2, 0, 0, Math.PI*2);
    ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.moveTo(cx - 3.5, meY + 7);
    ctx.quadraticCurveTo(cx, meY + 8.5, cx + 3.5, meY + 7);
    ctx.strokeStyle = withAlpha(warmShadow(cfg.skinTone, 25), 0.3);
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Beard hint
    if (cfg.beardStyle === 'full' || cfg.beardStyle === 'short') {
      ctx.fillStyle = withAlpha(cfg.hairColor, 0.4);
      ctx.beginPath();
      ctx.ellipse(cx, meY + 10, cfg.beardStyle === 'full' ? 8 : 6, cfg.beardStyle === 'full' ? 6 : 4, 0, 0, Math.PI);
      ctx.fill();
    } else if (cfg.beardStyle === 'goatee') {
      ctx.fillStyle = withAlpha(cfg.hairColor, 0.4);
      ctx.beginPath();
      ctx.ellipse(cx, meY + 10, 4, 5, 0, 0, Math.PI);
      ctx.fill();
    } else if (cfg.beardStyle === 'chinstrap') {
      ctx.beginPath();
      ctx.ellipse(cx, meY + 6, hw*0.7, hh*0.5, 0, 0.3, Math.PI - 0.3);
      ctx.strokeStyle = withAlpha(cfg.hairColor, 0.3);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (cfg.beardStyle === 'stubble') {
      var rng = seededRand(hashStr(cfg.hairColor + 'mstub'));
      ctx.fillStyle = withAlpha(cfg.hairColor, 0.12);
      for (var si = 0; si < 15; si++) {
        var ssx = cx + (rng()-0.5) * 12;
        var ssy = meY + 5 + rng() * 8;
        ctx.fillRect(ssx, ssy, 0.5, 0.5);
      }
    }
  }

  /* ── Public API ────────────────────────────────────────────── */
  window.AvatarBuilder = {
    CONFIG: CONFIG,
    defaults: defaults,
    draw: draw,
    drawMini: drawMini,
    darker: darker
  };
})();
