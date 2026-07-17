/* CourtIQ v11 — one court, one geometry, one truth
   ------------------------------------------------------------------
   Extracted from post-session.js, which already had this RIGHT: a real
   NBA half court at 10px/ft on a 500×470 viewBox. track.js meanwhile drew
   its own fake one — a 280×220 canvas whose "arc" was two quadratic
   Béziers with no radius, with the rim 3.9m off the baseline instead of
   1.6m and the free-throw circle drawn around the RIM instead of the
   free-throw line. Two courts that disagreed; now there is one.

   Verified against NBA Rule 1:
     half court   50ft × 47ft   → 500 × 470  (10px per foot)
     3pt arc      23.75ft       → r 237.5 about the rim
     corner 3     22ft          → x=30 / x=470
     paint        16ft × 19ft   → 170→330, 0→190
     rim          5.25ft off the baseline → (250, 52.5)
   The arc meets the corner line at y = 52.5 + √(237.5² − 220²) = 141.98,
   which is why 142 appears instead of a rounder number. Same math at the
   paint edges: x=170/330 → y = 52.5 + √(237.5² − 80²) = 276.1 → 276.
   (An earlier version used 222 there, which parked the zone divider ~54px
   INSIDE the real 3pt line and carved fictional shooting zones.)

   ── THE COORDINATE WARNING ──────────────────────────────────────
   Shots have NO court position. shotDetection.js normalises launch x/y by
   VIDEO WIDTH — they are camera-frame pixels, not court feet, and there is
   no homography anywhere in the app. Move the phone and the same physical
   shot lands somewhere else. So: ZONES ONLY. Never plot a dot on this
   court from shot_x/shot_y and never aggregate such dots across sessions —
   that invents a measurement nobody took. Zone labels are real; positions
   are not.
   ============================================================ */
(function () {
  'use strict';
  var svg = window.V10UI.svg;

  var W = 500, H_FULL = 470;
  /* Cropped for tab heroes: the arc apex is at y=290, so 330 shows the
     entire scoring area. Nobody shoots from 40ft — the back third of a
     half court is dead pixels on a phone. */
  var H_CROP = 330;

  var ZONE_PATHS = {
    lc:     'M 0 0 L 30 0 L 30 142 L 0 142 Z',
    rc:     'M 470 0 L 500 0 L 500 142 L 470 142 Z',
    ml:     'M 30 0 L 170 0 L 170 276 A 237.5 237.5 0 0 1 30 142 L 30 0 Z',
    mr:     'M 330 0 L 470 0 L 470 142 A 237.5 237.5 0 0 1 330 276 L 330 0 Z',
    /* topmid runs the arc right-to-left, so its sweep flag is the MIRROR
       of top's (which runs left-to-right). Same flag on both directions
       bulges the arc toward the rim and pinches a little lens against
       the real 3pt line. */
    topmid: 'M 170 190 L 330 190 L 330 276 A 237.5 237.5 0 0 1 170 276 L 170 190 Z',
    lw:     'M 0 142 L 30 142 A 237.5 237.5 0 0 0 170 276 L 170 470 L 0 470 L 0 142 Z',
    rw:     'M 500 142 L 470 142 A 237.5 237.5 0 0 1 330 276 L 330 470 L 500 470 L 500 142 Z',
    top:    'M 170 276 A 237.5 237.5 0 0 0 330 276 L 330 470 L 170 470 L 170 276 Z',
    pnt:    'M 170 0 L 330 0 L 330 190 L 170 190 Z'
  };

  /* Label anchors. The full-court centres for lw/rw/top sit at y≈355-360,
     which is outside the cropped viewBox — hence a second set. */
  /* Labels sit at the visual center of the CORRECTED zones — and always
     on the right side of the arc: top's crop label needs y≥~300 at
     x=250 or it lands inside topmid (the arc apex is at y=290). */
  var CENTER_FULL = {
    lc: { x: 15, y: 70 },  rc: { x: 485, y: 70 },
    ml: { x: 92, y: 130 }, mr: { x: 408, y: 130 },
    topmid: { x: 250, y: 236 },
    lw: { x: 85, y: 355 }, rw: { x: 415, y: 355 },
    top: { x: 250, y: 370 }, pnt: { x: 250, y: 95 }
  };
  var CENTER_CROP = {
    lc: { x: 15, y: 70 },  rc: { x: 485, y: 70 },
    ml: { x: 92, y: 130 }, mr: { x: 408, y: 130 },
    topmid: { x: 250, y: 236 },
    lw: { x: 66, y: 288 }, rw: { x: 434, y: 288 },
    top: { x: 250, y: 312 }, pnt: { x: 250, y: 95 }
  };

  var THREE_PT = { lc: 1, rc: 1, lw: 1, rw: 1, top: 1 };
  var LABEL = {
    lc: 'L CORNER 3', rc: 'R CORNER 3', lw: 'L WING 3', rw: 'R WING 3',
    top: 'TOP 3', topmid: 'TOP MID', ml: 'MID L', mr: 'MID R', pnt: 'PAINT'
  };

  var LINE = 'rgba(240,230,210,0.55)';

  /* The court is a substrate, not the data. The most common failure in shot
     charts is a beautiful court that outshouts the zones on it — so the
     lines are low-contrast and only the 3pt arc is heavy, because it's the
     only line that changes what a shot MEANS. */
  function lines() {
    return [
      svg('rect', { x: 170, y: 0, width: 160, height: 190,
        fill: 'none', stroke: LINE, 'stroke-width': 1.5 }),
      svg('circle', { cx: 250, cy: 190, r: 60, fill: 'none',
        stroke: LINE, 'stroke-width': 1.5 }),
      svg('line', { x1: 30, y1: 0, x2: 30, y2: 142, stroke: LINE, 'stroke-width': 1.5 }),
      svg('line', { x1: 470, y1: 0, x2: 470, y2: 142, stroke: LINE, 'stroke-width': 1.5 }),
      svg('path', { d: 'M 30 142 A 237.5 237.5 0 0 0 470 142',
        fill: 'none', stroke: '#F0E6D2', 'stroke-width': 3.2 }),
      svg('line', { x1: 220, y1: 40, x2: 280, y2: 40, stroke: '#F0E6D2', 'stroke-width': 3 }),
      svg('circle', { cx: 250, cy: 52.5, r: 7.5, fill: 'none',
        stroke: '#FF4F1F', 'stroke-width': 3 })
    ];
  }

  /* ── Sample-size discipline ──────────────────────────────────────
     1-for-1 is not 100%. Rendering it as a blazing hot zone is the same
     bug as one good session reading ELITE, and it corrupts every ranking
     built on top of it.

     Practitioner guidance: ~20-30 attempts per zone for a confident read,
     under 10-15 deserves real scepticism. We gate at 8 — below that a zone
     shows a FRACTION and never a percentage. A fraction is self-limiting:
     "3 of 5" reads as early, "60%" lies with a straight face. */
  var MIN_VERDICTS = 8;

  /* A HEADLINE rate needs more evidence than a zone does. 8-for-8 is a
     legitimate zone sample and a ridiculous "100% FG · 30D" — it's the
     number the user quotes and screenshots, so it carries the highest
     cost when it's noise. Practitioner guidance puts a stable overall FG%
     at 50-100 attempts; 20 is the point where the number stops being
     comedy, and below it we show the fraction instead. */
  var MIN_TOTAL = 20;

  function state(z) {
    if (!z || !z.vatt) return (z && z.att > 0) ? 'thin' : 'empty';
    if (z.vatt < MIN_VERDICTS) return 'thin';
    return 'rated';
  }

  /* Beta-Binomial posterior mean — shrink a zone toward the player's OWN
     average, not an NBA baseline (our users are rec players; an NBA prior
     would shrink everyone toward a mean they don't share and call decent
     amateur shooting cold). k is prior strength in pseudo-attempts, so the
     estimator stops shrinking on its own as evidence arrives — no cliff.

     COLOUR by this. LABEL with the raw made/vatt. The colour is our
     judgement; the label is the fact, and it stays auditable. */
  function shrunkAcc(z, playerMean, k) {
    k = k || 10;
    if (playerMean == null) playerMean = 0.40;
    if (!z || !z.vatt) return playerMean;
    return (z.made + k * playerMean) / (z.vatt + k);
  }

  /* The player's own mean over verdict shots — the prior for shrinkage.
     Falls back to a flat 0.40 below 30 verdicts, where the mean itself
     isn't yet worth trusting. */
  function playerMean(zones) {
    var made = 0, vatt = 0;
    Object.keys(zones || {}).forEach(function (k) {
      var z = zones[k];
      if (!z) return;
      made += z.made || 0; vatt += z.vatt || 0;
    });
    return vatt >= 30 ? made / vatt : 0.40;
  }

  function svgEl(children, opts) {
    opts = opts || {};
    var hh = opts.full ? H_FULL : H_CROP;
    return svg('svg', {
      viewBox: '0 0 ' + W + ' ' + hh,
      width: '100%', role: 'img',
      'aria-label': opts.label || 'Shot map by zone',
      style: 'display:block;max-width:100%;height:auto'
    }, (children || []).concat(lines()));
  }

  window.V11Court = {
    ZONE_PATHS: ZONE_PATHS,
    CENTER: CENTER_CROP, CENTER_FULL: CENTER_FULL,
    THREE_PT: THREE_PT, LABEL: LABEL,
    lines: lines, svg: svgEl,
    state: state, shrunkAcc: shrunkAcc, playerMean: playerMean,
    MIN_VERDICTS: MIN_VERDICTS, MIN_TOTAL: MIN_TOTAL,
    W: W, H_FULL: H_FULL, H_CROP: H_CROP
  };
})();
