/* app-v10/screens/post-session.js
   POST-SESSION RECAP — fullscreen summary after a session ends.
   Hero shot map (parquet wood) with 9 polygon zones, color-coded by accuracy.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  // Full half-court polygons, viewBox 500x470.
  var ZONE_PATHS = {
    lc:     'M 0 0 L 30 0 L 30 142 L 0 142 Z',
    rc:     'M 470 0 L 500 0 L 500 142 L 470 142 Z',
    ml:     'M 30 0 L 170 0 L 170 222 A 237.5 237.5 0 0 1 30 142 L 30 0 Z',
    mr:     'M 330 0 L 470 0 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 0 Z',
    topmid: 'M 170 190 L 330 190 L 330 222 A 237.5 237.5 0 0 0 170 222 L 170 190 Z',
    lw:     'M 0 142 L 30 142 A 237.5 237.5 0 0 0 170 222 L 170 470 L 0 470 L 0 142 Z',
    rw:     'M 500 142 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 470 L 500 470 L 500 142 Z',
    top:    'M 170 222 A 237.5 237.5 0 0 0 330 222 L 330 470 L 170 470 L 170 222 Z',
    pnt:    'M 170 0 L 330 0 L 330 190 L 170 190 Z'
  };

  // Centroid hints for in-zone labels.
  var ZONE_CENTER = {
    lc:     { x: 15,  y: 70  },
    rc:     { x: 485, y: 70  },
    ml:     { x: 90,  y: 100 },
    mr:     { x: 410, y: 100 },
    topmid: { x: 250, y: 210 },
    lw:     { x: 85,  y: 355 },
    rw:     { x: 415, y: 355 },
    top:    { x: 250, y: 360 },
    pnt:    { x: 250, y: 95  }
  };

  var THREE_PT = { lc: true, rc: true, lw: true, rw: true, top: true };

  function acc(z) { return (z && z.att) ? z.made / z.att : 0; }

  /* Counter sessions (live camera, M3) have no verdicts — zones are
     shaded by VOLUME instead of accuracy. */
  function zoneFill(key, z, counter) {
    var isThree = !!THREE_PT[key];
    if (counter) {
      if (z && z.att > 0) {
        var heat = Math.min(1, z.att / 6);
        return 'rgba(224, 168, 46, ' + (0.28 + heat * 0.5).toFixed(2) + ')';
      }
      return 'rgba(251, 245, 232, 0.10)';
    }
    var a = acc(z);
    if (z && z.att > 0) {
      if (a >= 0.55) {
        return isThree ? 'rgba(255, 79, 31, 0.92)' : 'rgba(255, 79, 31, 0.62)';
      }
      if (a <= 0.40) {
        return isThree ? 'rgba(224, 168, 46, 0.92)' : 'rgba(224, 168, 46, 0.62)';
      }
      return isThree ? 'rgba(251, 245, 232, 0.55)' : 'rgba(251, 245, 232, 0.30)';
    }
    return 'rgba(251, 245, 232, 0.10)';
  }

  function zoneTextColor(z) {
    var a = acc(z);
    if (z && z.att > 0 && a >= 0.55) return '#FBF5E8';
    return '#0A2850';
  }

  /* Aggregate current-session shots into zone counts. Reads
     window.__v10SessionShots which camera-hud populates while the
     tracker is running. Each shot is { made, v10Zone, feetXNorm, ts }. */
  function aggregateSessionZones(shots) {
    var z = {};
    Object.keys(ZONE_CENTER).forEach(function (k) { z[k] = { made: 0, att: 0 }; });
    (shots || []).forEach(function (s) {
      var key = s && s.v10Zone;
      if (!z[key]) return;
      z[key].att += 1;
      if (s.made) z[key].made += 1;
    });
    return z;
  }

  function buildShotMap(zones, counter) {
    var children = [];

    Object.keys(ZONE_PATHS).forEach(function (key) {
      var z = zones[key];
      children.push(svg('path', {
        d: ZONE_PATHS[key],
        fill: zoneFill(key, z, counter),
        stroke: '#F0E6D2',
        'stroke-width': 1.4
      }));
    });

    // 3PT arc
    children.push(svg('path', {
      d: 'M 30 0 L 30 142 A 237.5 237.5 0 0 0 470 142 L 470 0',
      fill: 'none',
      stroke: '#F0E6D2',
      'stroke-width': 3.2
    }));

    // Paint rect
    children.push(svg('rect', {
      x: 170, y: 0, width: 160, height: 190,
      fill: 'none', stroke: '#F0E6D2', 'stroke-width': 2
    }));

    // Free-throw circle
    children.push(svg('circle', {
      cx: 250, cy: 190, r: 60,
      fill: 'none', stroke: '#F0E6D2', 'stroke-width': 2
    }));

    // Sidelines
    children.push(svg('line', { x1: 0, y1: 0, x2: 0, y2: 470, stroke: '#F0E6D2', 'stroke-width': 2 }));
    children.push(svg('line', { x1: 500, y1: 0, x2: 500, y2: 470, stroke: '#F0E6D2', 'stroke-width': 2 }));

    // Backboard
    children.push(svg('line', {
      x1: 215, y1: 8, x2: 285, y2: 8,
      stroke: '#F0E6D2', 'stroke-width': 3
    }));

    // Rim
    children.push(svg('circle', {
      cx: 250, cy: 20, r: 9,
      fill: '#FF4F1F', stroke: '#0A2850', 'stroke-width': 2
    }));

    // Per-zone label: verdict mode = X/Y · NN%, counter mode = attempt count
    Object.keys(ZONE_CENTER).forEach(function (key) {
      var z = zones[key];
      if (!z || !z.att) return;
      var c = ZONE_CENTER[key];
      if (counter) {
        children.push(svg('text', {
          x: c.x, y: c.y + 4,
          'text-anchor': 'middle',
          'font-family': 'Barlow Condensed, Impact, sans-serif',
          'font-weight': 900, 'font-size': 24, fill: '#0A2850'
        }, [String(z.att)]));
        return;
      }
      var color = zoneTextColor(z);
      var pct = Math.round((z.made / z.att) * 100);
      children.push(svg('text', {
        x: c.x, y: c.y - 4,
        'text-anchor': 'middle',
        'font-family': 'Barlow Condensed, Impact, sans-serif',
        'font-weight': 900, 'font-size': 22, fill: color
      }, [z.made + '/' + z.att]));
      children.push(svg('text', {
        x: c.x, y: c.y + 16,
        'text-anchor': 'middle',
        'font-family': 'JetBrains Mono, ui-monospace, monospace',
        'font-weight': 700, 'font-size': 11, fill: color, opacity: '0.85'
      }, [pct + '%']));
    });

    // Group for animated shot-dot reveal (populated after mount)
    children.push(svg('g', { id: 'ps-shot-dots' }));

    return svg('svg', {
      id: 'ps-shot-map-svg',
      viewBox: '0 0 500 470',
      width: '100%',
      style: 'display:block;max-width:100%;height:auto;max-height:240px'
    }, children);
  }

  /* After the SVG mounts, sprinkle the current-session shot dots in
     order with a stagger so the user sees the session "replay" onto
     the court. Green = made, orange = missed. Per-shot dot is offset
     laterally by feetXNorm so two shots from the same zone don't stack
     into one bigger dot. */
  function animateShotDots(shots) {
    var g = document.getElementById('ps-shot-dots');
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    if (!shots || !shots.length) return;

    var REDUCED = false;
    try {
      REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}

    /* A flat 120ms stagger meant a 60-shot session took 7.2s to replay and
       the user had scrolled away long before it finished. Cap the whole
       replay at 2.4s regardless of volume. */
    var STAGGER_MS = REDUCED ? 0 : Math.min(120, Math.round(2400 / shots.length));
    shots.forEach(function (s, i) {
      setTimeout(function () {
        var center = ZONE_CENTER[s.v10Zone] || ZONE_CENTER.top;
        var cx = center.x, cy = center.y + 22;   // below the zone label
        if (typeof s.feetXNorm === 'number') {
          var lateral = (s.feetXNorm - 0.5) * 80;
          cx = Math.max(20, Math.min(480, center.x + lateral));
        }
        var fill = (s.made === null || s.made === undefined)
          ? '#E0A82E'
          : (s.made ? '#3D7A53' : '#FF4F1F');
        // Ripple ring
        var ring = svg('circle', {
          cx: cx, cy: cy, r: 8, fill: 'none',
          stroke: fill, 'stroke-width': 2, opacity: '0.9'
        });
        ring.style.transformOrigin = cx + 'px ' + cy + 'px';
        if (!REDUCED) ring.style.animation = 'v10MiniRipple 700ms ease-out 1';

        /* Double-encode: SHAPE as well as colour. Every serious shot chart
           does this — Basketball-Reference, NBA.com and ballr all pair a
           mark with a hue — and it isn't decoration: red-green deficiency
           affects ~8% of men, which is most of this app's users. A make and
           a miss must differ with the colour switched off.
             made → filled dot     miss → ×     counted-only → hollow ring */
        var dot;
        if (s.made === null || s.made === undefined) {
          dot = svg('circle', {
            cx: cx, cy: cy, r: 7, fill: 'none', stroke: fill, 'stroke-width': 2.5
          });
        } else if (s.made) {
          dot = svg('circle', {
            cx: cx, cy: cy, r: 9, fill: fill, stroke: '#FBF5E8', 'stroke-width': 1.5
          });
        } else {
          dot = svg('path', {
            d: 'M ' + (cx - 6) + ' ' + (cy - 6) + ' L ' + (cx + 6) + ' ' + (cy + 6) +
               ' M ' + (cx + 6) + ' ' + (cy - 6) + ' L ' + (cx - 6) + ' ' + (cy + 6),
            stroke: fill, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none'
          });
        }
        dot.style.opacity = '0';
        dot.style.transition = REDUCED ? 'none' : 'opacity 200ms ease-out';
        g.appendChild(ring);
        g.appendChild(dot);
        requestAnimationFrame(function () { dot.style.opacity = '1'; });
        setTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 800);
      }, i * STAGGER_MS);
    });
  }

  /* ── Corrections ─────────────────────────────────────────────────
     Dietvorst et al. (Management Science 2018): people abandon an
     algorithm after one visible error — unless they can modify it, and
     the effect survives even when the modification allowed is severely
     restricted. It's a desire for SOME control, not more. One tap is
     enough, and it's the cheapest trust the app can buy.

     ONE-WAY on purpose. classifyRange needs positive evidence to say
     'made' and falls through to 'missed' ("no through evidence"), so a
     miss is a catch-all: real misses PLUS every make where the ball was
     lost to blur, sun or occlusion. Corrections are miss→make nearly
     every time. A symmetric toggle would imply otherwise and tax every
     shot with a decision that has an obvious answer.

     Framing is the whole game here, and the same mechanic swings on it:
     "report a problem" makes every correction an argument that the
     product is broken; "WENT IN" is the user stating a basketball fact.
     We deliberately do NOT say "teach the AI" — adaptiveLearning labels
     BALL DETECTIONS, not verdicts, so no correction trains anything.
     Claiming otherwise is the kind of lie users detect after correcting
     the same failure twenty times and watching nothing change. */
  var FIX_REVIEW_CAP = 5;

  /* Plain-language reason, from the classifier's own `why`. Never a
     confidence score: there ISN'T one (classifyRange returns {v, why}),
     and a percentage on a binary event the user personally watched is
     noise — they know whether it went in. A reason tells them what the
     app was blind to, which is also how they set up better next time. */
  function whyText(why) {
    if (!why) return '';
    if (why.indexOf('no through') === 0) return 'Never saw it reach the rim.';
    if (why.indexOf('ring-cross') === 0) return 'Saw it cross the ring.';
    if (why.indexOf('inside-net') === 0) return 'Saw it in the net.';
    if (why.indexOf('dwell') === 0) return 'Saw it sit in the rim.';
    return '';
  }

  function isUncertain(s) {
    return !s.made && typeof s.why === 'string' && s.why.indexOf('no through') === 0;
  }

  function snack(text, onUndo) {
    var old = document.querySelector('.v11-snack');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = h('div', { class: 'v11-snack' }, [
      h('span', { text: text }),
      h('button', {
        class: 'v11-snack__u', type: 'button', text: 'Undo',
        onclick: function () { onUndo(); if (el.parentNode) el.parentNode.removeChild(el); }
      })
    ]);
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 5000);
  }

  function buildCorrections(shots, ctx, host) {
    var wrap = h('div', {});
    var flagged = shots.filter(isUncertain);

    /* Cap at 5. Below ~3 the row is noise; above 5 it stops reading as
       "get your points back" and starts reading as a worklist that
       advertises the model needs babysitting. If more than 5 qualify the
       clip itself was bad, and the honest message is about the clip. */
    var show = flagged.slice(0, FIX_REVIEW_CAP);

    wrap.appendChild(ctx.ui.ribbon({
      icon: 'ph-eye',
      title: show.length ? 'A SECOND LOOK' : 'EVERY SHOT',
      meta: show.length ? show.length + ' TO CHECK' : String(shots.length)
    }));

    if (flagged.length > FIX_REVIEW_CAP) {
      wrap.appendChild(h('div', {
        class: 'v11-basis',
        text: 'Tracking was rough in this one — ' + flagged.length + ' shots never ' +
              'reached the rim on camera. Showing the first ' + FIX_REVIEW_CAP + '.'
      }));
    }

    var list = h('div', { class: 'v11-fix' });
    /* Uncertain shots first — they're the ones worth the user's time —
       then the rest, so nothing is hidden. */
    var order = show.concat(shots.filter(function (s) { return show.indexOf(s) < 0; }));

    order.slice(0, 12).forEach(function (s) {
      var idx = shots.indexOf(s);
      var row = h('div', {
        class: 'v11-fix__row' + (isUncertain(s) ? ' is-flagged' : '')
      });
      var verdict = h('div', {
        class: 'v11-fix__v ' + (s.made ? 'v11-fix__v--made' : 'v11-fix__v--miss'),
        text: s.made ? 'Made' : 'Miss'
      });
      var btn = h('button', {
        class: 'v11-fix__b', type: 'button',
        'aria-label': 'Shot ' + (idx + 1) + ' went in'
      }, [
        h('i', { class: 'ph-bold ph-arrow-u-up-left' }),
        h('span', { text: 'Went in' })
      ]);

      var apply = function (made) {
        s.made = made;
        verdict.textContent = made ? 'Made' : 'Miss';
        verdict.className = 'v11-fix__v ' + (made ? 'v11-fix__v--made' : 'v11-fix__v--miss');
        row.classList.toggle('is-fixed', made);
        btn.style.display = made ? 'none' : '';
        try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
        /* Re-render so no view can disagree with another. Two surfaces
           derived from one shot log that print different numbers is how a
           stats product proves its own numbers are guesses. */
        if (ctx && ctx.go) ctx.go('post-session');
      };

      btn.addEventListener('click', function () {
        apply(true);
        snack('Shot ' + (idx + 1) + ' counted', function () { apply(false); });
      });

      row.appendChild(h('div', { class: 'v11-fix__n', text: String(idx + 1) }));
      row.appendChild(verdict);
      row.appendChild(h('div', { class: 'v11-fix__why', text: whyText(s.why) }));
      if (!s.made) row.appendChild(btn);
      list.appendChild(row);
    });

    wrap.appendChild(list);
    wrap.appendChild(h('div', {
      class: 'v11-basis',
      text: 'A miss just means the ball was never seen going through — ' +
            'sun, blur or a body in the way all look the same to the camera. ' +
            'If you know better, say so.'
    }));
    return wrap;
  }

  // Compact top row: BACK chip + title + FINAL chip. Sits below headerPill.
  function recapBar(ctx) {
    var dt = new Date();
    var dateStr = dt.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric'
    }).toUpperCase();

    var back = h('button', {
      class: 'v10-chip',
      style: { flex: '0 0 auto', minWidth: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' },
      onclick: function () { ctx.go('track'); }
    }, [icon('ph-arrow-left'), h('span', { text: 'BACK' })]);

    var title = h('div', { class: 'v10-chip', style: { flex: 1, background: 'var(--ink)', color: 'var(--cream)' }, text: 'SESSION RECAP · ' + dateStr });

    var final = h('div', { class: 'v10-chip', style: { flex: '0 0 auto', minWidth: '64px', background: 'var(--orange)', color: 'var(--cream)' }, text: 'FINAL' });

    return h('div', { class: 'v10-chips' }, [back, title, final]);
  }

  // One mono line under the recap bar after an upload analysis: engine +
  // wall-clock — the on-device benchmark readout (no Web Inspector needed).
  function analysisLine() {
    var a = window.__v10AnalysisInfo;
    if (!a || !a.ms) return null;
    var secs = Math.round(a.ms / 1000);
    var fps = a.frames && a.ms ? (a.frames / (a.ms / 1000)).toFixed(1) : '?';
    return h('div', {
      style: { fontFamily: 'var(--font-mono)', fontSize: '10px', opacity: '0.55',
               textAlign: 'center', letterSpacing: '0.06em', margin: '2px 0 0' },
      text: 'ANALYZED ' + Math.round(a.videoSec || 0) + 'S CLIP IN ' + secs +
            'S · ' + fps + ' FPS · ' + String(a.ep || '?').toUpperCase()
    });
  }

  /* Was `(acc - 0.5) * 100` — every zone measured against a hardcoded 50%
     that belongs to nobody. A 35% shooter got told "-15% vs base" on a
     perfectly good zone, and a 70% shooter got congratulated for a bad one.
     A baseline the player doesn't share is worse than no baseline.

     Compare to THIS session's own accuracy instead: real, computable, and
     it answers the question actually being asked — "where was I hot
     tonight?" And below 4 shots there's no signal, so there's no delta. */
  var MIN_ZONE_SHOTS = 4;
  function zoneDelta(z, sessionAcc) {
    if (!z || z.att < MIN_ZONE_SHOTS || sessionAcc == null) return null;
    return Math.round((acc(z) - sessionAcc) * 100);
  }

  function zoneTile(key, z, counter, sessionAcc) {
    if (counter) {
      return h('div', {
        class: 'v10-tile v10-tile--' + (z.att > 0 ? 'mustard' : 'sage'),
        style: { flex: '0 0 auto', minWidth: '108px' }
      }, [
        h('div', { class: 'v10-tile__top' }, [
          h('div', { class: 'v10-tile__title', text: (z.label || key).toUpperCase() }),
          h('i', { class: 'ph-bold ph-basketball v10-tile__icon v10-tile__icon--mustard' })
        ]),
        h('div', { class: 'v10-tile__num', text: String(z.att || 0) }),
        h('div', { class: 'v10-tile__meta', text: 'SHOTS' })
      ]);
    }
    var d = zoneDelta(z, sessionAcc);
    var up = d != null && d >= 0;
    /* No delta = not enough shots from here to say anything. Show the raw
       fraction and stay quiet rather than inventing a comparison. */
    var variant = !z || !z.att ? 'sage'
      : (d == null ? 'sage'
        : (acc(z) >= 0.55 ? 'orange' : (acc(z) <= 0.40 ? 'mustard' : 'sage')));
    return h('div', {
      class: 'v10-tile v10-tile--' + variant,
      style: { flex: '0 0 auto', minWidth: '108px' }
    }, [
      h('div', { class: 'v10-tile__top' }, [
        h('div', { class: 'v10-tile__title', text: (z.label || key).toUpperCase() }),
        d == null
          ? h('i', { class: 'ph-bold ph-minus v10-tile__icon v10-tile__icon--' + variant })
          : h('i', { class: 'ph-bold ' + (up ? 'ph-trend-up' : 'ph-trend-down') +
              ' v10-tile__icon v10-tile__icon--' + variant })
      ]),
      h('div', { class: 'v10-tile__num', text: z.att > 0 ? (z.made + '/' + z.att) : '0/0' }),
      h('div', {
        class: 'v10-tile__meta',
        text: d == null
          ? (z.att ? z.att + ' shots' : 'none')
          : (up ? '+' : '') + d + '% vs session'
      })
    ]);
  }

  function zoneStrip(zones, counter, sessionAcc) {
    var order = ['pnt', 'ml', 'mr', 'lw', 'top', 'rw', 'lc'];
    var tiles = order.map(function (k) {
      var z = zones[k] || { made: 0, att: 0, label: k };
      return zoneTile(k, z, counter, sessionAcc);
    });
    return h('div', {
      style: {
        display: 'flex', gap: '8px',
        overflowX: 'auto', overflowY: 'hidden',
        paddingBottom: '6px',
        marginBottom: 'var(--s-3)',
        WebkitOverflowScrolling: 'touch'
      }
    }, tiles);
  }

  function drillRow(ctx, d, idx) {
    return h('div', {
      class: 'v10-row',
      style: { boxShadow: '2px 2px 0 var(--ink)', cursor: 'pointer' },
      onclick: function () { ctx.go('workout-player'); }
    }, [
      h('div', { class: 'v10-row__num', text: String(idx + 1).padStart(2, '0') }),
      h('div', { class: 'v10-row__main' }, [
        h('div', { class: 'v10-row__title', text: (d.name || 'DRILL').toUpperCase() }),
        h('div', { class: 'v10-row__sub', text: (d.reps || 30) + ' reps · ' + (d.mins || 6) + ' min' })
      ]),
      h('div', { class: 'v10-row__right' }, [icon('ph-caret-right')])
    ]);
  }

  function render(args) {
    var host = args.host;
    var ctx  = args.ctx;
    var sessionData = args.sessionData || null;

    // Make the screen a flex column so we can push CTAs to the bottom of the viewport.
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.minHeight = '100%';

    // Current-session shot log lives on window — captured by camera-hud's
    // v10:shot listener. We compute EVERYTHING from this list (zones, bento,
    // 3PT count, streak) so the recap shows only what happened in this
    // session — not the historical 7-day zone aggregate.
    var sessionShots = (window.__v10SessionShots || []).slice();
    var zones = aggregateSessionZones(sessionShots);
    // Live counter sessions (M3) have no verdicts — different recap.
    var counter = window.__v10SessionMode === 'counter';

    Promise.all([
      ctx.data.getProfile(),
      ctx.data.getDrills()
    ]).then(function (results) {
      var profile = results[0];
      var drills  = results[1];

      host.appendChild(ctx.ui.headerPill({ profile: profile }));
      host.appendChild(recapBar(ctx));
      var aLine = analysisLine();
      if (aLine) host.appendChild(aLine);

      // Hero shot map (capped at ~240px tall via inline style on the svg)
      var eyebrow = h('div', { class: 'v10-court__eyebrow' }, [
        icon('ph-crosshair-simple'),
        h('span', { text: 'SHOT MAP' })
      ]);
      host.appendChild(h('section', { class: 'v10-court' }, [
        eyebrow,
        buildShotMap(zones, counter)
      ]));

      // 3-cell bento — derived from THIS session only
      var made = sessionShots.filter(function (s) { return s.made; }).length;
      var att  = sessionShots.length;
      var pct  = att ? Math.round(made * 100 / att) : 0;

      /* ── The reveal ───────────────────────────────────────────
         Numbers land BEFORE decoration. The athlete's question is "how'd I
         do" — answer it first, celebrate second. Celebrating at 420ms
         celebrated a number that hadn't rendered yet.

         The map moved to 1000ms too: it used to fire on the next frame, so
         the dots and the bento competed for the eye at the same instant.
         The map is "how did I get here" — it belongs after the verdict. */
      var t = window.V11Reveal.run({
        host: host, ctx: ctx, counter: counter,
        made: made, att: att, pct: pct,
        onMap: function () { animateShotDots(sessionShots); }
      });
      // 3PT = any zone marked in THREE_PT (lc/rc/lw/rw/top)
      var threeShots = sessionShots.filter(function (s) { return THREE_PT[s.v10Zone]; });
      var threeMade  = threeShots.filter(function (s) { return s.made; }).length;
      var threeAtt   = threeShots.length;
      // Best streak in this session
      var streak = 0, cur = 0;
      sessionShots.forEach(function (s) {
        if (s.made) { cur += 1; if (cur > streak) streak = cur; }
        else { cur = 0; }
      });
      // Provide for downstream code paths that still reference these
      var sessionData = { made: made, attempted: att };
      var today = { made: made, attempted: att };
      var latest = null;

      if (counter) {
        // Counter recap: volume stats only — no made/miss claims.
        var zonesUsed = Object.keys(zones).filter(function (k) { return zones[k].att > 0; }).length;
        host.appendChild(ctx.ui.bento([
          { variant: 'orange',  icon: 'ph-basketball', value: String(att), label: 'SHOTS' },
          { variant: 'sage',    icon: 'ph-target',     value: String(threeAtt), label: 'FROM 3PT RANGE' },
          { variant: 'mustard', icon: 'ph-map-pin',    value: String(zonesUsed), label: 'ZONES USED' }
        ]));
        // Explain where verdicts live — one tap to the upload flow.
        host.appendChild(h('div', {
          class: 'v10-row',
          style: { boxShadow: '2px 2px 0 var(--ink)', cursor: 'pointer', marginBottom: 'var(--s-3)' },
          onclick: function () { ctx.go('track'); }
        }, [
          h('div', { class: 'v10-row__num' }, [icon('ph-film-slate')]),
          h('div', { class: 'v10-row__main' }, [
            h('div', { class: 'v10-row__title', text: 'WANT MADE/MISS?' }),
            h('div', { class: 'v10-row__sub', text: 'Record your session and upload the video — the analyzer scores every shot.' })
          ]),
          h('div', { class: 'v10-row__right' }, [icon('ph-caret-right')])
        ]));
      } else {
        host.appendChild(ctx.ui.bento([
          { variant: 'orange',  icon: 'ph-check',  value: made + ' / ' + att, label: pct + '% MADE' },
          { variant: 'sage',    icon: 'ph-target', value: threeAtt ? (threeMade + '/' + threeAtt) : '—', label: '3PT' },
          {
            variant: 'mustard',
            icon: 'ph-fire',
            iconExtra: streak >= 3 ? 'v10-flicker' : undefined,
            value: String(streak),
            label: 'BEST RUN'
          }
        ]));
      }

      /* Corrections — verdict sessions only. A counter session has no
         verdicts, so there is nothing to correct. */
      if (!counter && sessionShots.length) {
        host.appendChild(buildCorrections(sessionShots, ctx, host));
      }

      // BY ZONE ribbon + tile strip
      host.appendChild(ctx.ui.ribbon({
        icon: 'ph-map-trifold',
        title: 'BY ZONE',
        meta: 'SCROLL →'
      }));
      host.appendChild(zoneStrip(zones || {}, counter, att ? made / att : null));

      // DRILLS ribbon — clickable rows go to workout-player; "View all" chip goes to drill-library
      host.appendChild(ctx.ui.ribbon({
        icon: 'ph-barbell',
        title: 'SUGGESTED DRILLS',
        meta: 'VIEW ALL →'
      }));
      var drillsList = h('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '6px' }
      });
      (drills || []).slice(0, 2).forEach(function (d, i) {
        drillsList.appendChild(drillRow(ctx, d, i));
      });
      // "View all" tile → drill-library
      drillsList.appendChild(h('div', {
        class: 'v10-row',
        style: { boxShadow: '2px 2px 0 var(--ink)', cursor: 'pointer', justifyContent: 'center', background: 'var(--ink)', color: 'var(--cream)' },
        onclick: function () { ctx.go('drill-library'); }
      }, [
        h('div', {
          class: 'v10-row__title',
          style: { color: 'var(--cream)', textAlign: 'center', flex: 1 },
          text: 'VIEW ALL DRILLS →'
        })
      ]));
      host.appendChild(drillsList);

      // Flex spacer — pushes CTAs to the bottom of the viewport when content is short.
      host.appendChild(h('div', { style: { flex: '1 1 auto', minHeight: '12px' } }));

      // CTAs
      host.appendChild(h('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }
      }, [
        ctx.ui.cta({
          variant: 'orange',
          icon: 'ph-play-circle',
          label: 'LOG ANOTHER SESSION',
          onClick: function () { ctx.go('camera-hud'); }
        }),
        ctx.ui.cta({
          variant: 'secondary',
          icon: 'ph-house',
          label: 'BACK TO HOME',
          onClick: function () { ctx.go('home'); }
        })
      ]));
    });
  }

  window.app.register('post-session', render);
})();
