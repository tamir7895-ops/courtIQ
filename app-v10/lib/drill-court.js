/* CourtIQ v12 — drill choreography renderer (window.V12DrillCourt)
   ------------------------------------------------------------------
   ONE engine draws EVERY drill's animation on the ONE true court
   (V11Court: real NBA half court, 500×470 @10px/ft, the same geometry
   shot detection's zone map uses). Drills are DATA, not code — a
   choreography object says where the spots, cones, paths and shots
   are, and this file turns it into an animated SVG:

     choreo = {
       zone:  'lw',                          // optional zone highlight
       spots: [{x,y,n}], cones:[{x,y}], coaches:[{x,y}],
       paths: [{pts:[[x,y],...], kind:'run'|'dribble'|'slide'|'pass'}],
       shots: [{x,y}],                       // shot origin → arcs to the rim
       ladder:{x,y,dir:'h'|'v'}              // agility ladder prop
     }

   Movement paths chain into ONE player marker that runs the circuit
   on loop (SMIL animateMotion — no JS timers, pauses off-screen for
   free). Shots get a ball that flies to the rim. Pass/dribble lines
   march their dashes via CSS. Numbered spots pulse in order.
   All coordinates are V11Court units. ES5 only.
   ============================================================ */
(function () {
  'use strict';
  var svg = window.V10UI.svg;

  var RIM = { x: 250, y: 52.5 };
  var VIEW_H = 330;                 /* same scoring-area crop as courtThumb */

  function d_of(pts) {
    var d = 'M ' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length; i++) d += ' L ' + pts[i][0] + ' ' + pts[i][1];
    return d;
  }
  function len_of(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      L += Math.sqrt(dx * dx + dy * dy);
    }
    return L;
  }

  /* the same court the zone map draws, minus fills */
  function courtLines() {
    var LINE = '#D8DBE2';
    return [
      svg('rect', { x: 0, y: 0, width: 500, height: VIEW_H, fill: 'transparent' }),
      svg('rect', { x: 170, y: 0, width: 160, height: 190, fill: 'none', stroke: LINE, 'stroke-width': 8 }),
      svg('circle', { cx: 250, cy: 190, r: 60, fill: 'none', stroke: LINE, 'stroke-width': 8 }),
      svg('line', { x1: 30, y1: 0, x2: 30, y2: 142, stroke: LINE, 'stroke-width': 8 }),
      svg('line', { x1: 470, y1: 0, x2: 470, y2: 142, stroke: LINE, 'stroke-width': 8 }),
      svg('path', { d: 'M 30 142 A 237.5 237.5 0 0 0 470 142', fill: 'none', stroke: LINE, 'stroke-width': 10 }),
      svg('line', { x1: 220, y1: 30, x2: 280, y2: 30, stroke: '#9AA1AC', 'stroke-width': 6 }),
      svg('circle', { cx: RIM.x, cy: RIM.y, r: 12, fill: 'none', stroke: '#E8590C', 'stroke-width': 8 })
    ];
  }

  /* STATION MODE — gym work (planks, jumps, med ball...) does not happen
     on court spots, so drawing it on the court reads as noise. A station
     drill gets a clean scene instead: floor line, a mat, and a player dot
     animated with the drill's real motion (jump / hold / power / steady). */
  function renderStation(choreo, opts) {
    var kids = [
      svg('rect', { x: 0, y: 0, width: 500, height: VIEW_H, fill: 'transparent' }),
      svg('line', { x1: 60, y1: 218, x2: 440, y2: 218, class: 'dc-floor' }),
      svg('rect', { x: 190, y: 202, width: 120, height: 18, rx: 9, class: 'dc-mat' })
    ];
    var motion = choreo.station.motion || 'power';
    var g = svg('g', { class: 'dc-st dc-st--' + motion });
    g.appendChild(svg('circle', { cx: 250, cy: 178, r: 16, class: 'dc-player' }));
    kids.push(g);
    /* rep ticks — three quiet pulses so the loop reads as reps, not decor */
    for (var i = 0; i < 3; i++) {
      kids.push(svg('circle', {
        cx: 320 + i * 26, cy: 130, r: 6, class: 'dc-tick',
        style: 'animation-delay:' + (i * 0.5) + 's'
      }));
    }
    if (choreo.note && !opts.still) {
      kids.push(svg('text', { x: 250, y: 300, 'text-anchor': 'middle', class: 'dc-note' },
        [document.createTextNode(choreo.note)]));
    }
    return svg('svg', {
      viewBox: '0 0 500 ' + VIEW_H,
      role: 'img', 'aria-label': opts.label || 'Station work',
      class: 'dc-court dc-court--station' + (opts.still ? ' dc-court--still' : ''),
      style: 'display:block;width:100%;height:auto;background:' + (opts.bg || '#FFFFFF')
    }, kids);
  }

  function render(choreo, opts) {
    opts = opts || {};
    choreo = choreo || {};
    if (choreo.station) return renderStation(choreo, opts);
    var kids = courtLines();

    /* zone under everything else */
    if (choreo.zone && window.V11Court && V11Court.ZONE_PATHS[choreo.zone]) {
      kids.unshift(svg('path', {
        d: V11Court.ZONE_PATHS[choreo.zone], class: 'dc-zone'
      }));
    }

    /* ladder prop: 6 rungs */
    if (choreo.ladder) {
      var L = choreo.ladder, r;
      for (r = 0; r < 6; r++) {
        kids.push(L.dir === 'v'
          ? svg('line', { x1: L.x - 14, y1: L.y + r * 20, x2: L.x + 14, y2: L.y + r * 20, class: 'dc-ladder' })
          : svg('line', { x1: L.x + r * 20, y1: L.y - 14, x2: L.x + r * 20, y2: L.y + 14, class: 'dc-ladder' }));
      }
    }

    /* movement + pass lines */
    var moveD = '';                  /* player runs the concatenated circuit */
    (choreo.paths || []).forEach(function (p) {
      if (!p || !p.pts || p.pts.length < 2) return;
      kids.push(svg('path', {
        d: d_of(p.pts), class: 'dc-p dc-p--' + (p.kind || 'run'), fill: 'none'
      }));
      if (p.kind !== 'pass') {
        moveD += (moveD ? ' ' : '') + d_of(p.pts).replace('M', moveD ? 'L' : 'M');
      }
    });

    /* shots: dotted arc to the rim + a ball that flies it, staggered.
       still mode (list thumbnails): same picture, ball parked at the
       shot origin — 178 live SMIL loops in one list would cook a phone. */
    (choreo.shots || []).forEach(function (s, i) {
      var mx = (s.x + RIM.x) / 2, my = Math.min(s.y, RIM.y) - 40;   /* arc peak */
      var d = 'M ' + s.x + ' ' + s.y + ' Q ' + mx + ' ' + my + ' ' + RIM.x + ' ' + RIM.y;
      kids.push(svg('path', { d: d, class: 'dc-p dc-p--shot', fill: 'none' }));
      if (opts.still) {
        kids.push(svg('circle', { cx: s.x, cy: s.y, r: 7, class: 'dc-ball' }));
      } else {
        var ball = svg('circle', { r: 7, class: 'dc-ball' });
        ball.appendChild(svg('animateMotion', {
          path: d, dur: '1.6s', begin: (i * 0.5) + 's',
          repeatCount: 'indefinite', fill: 'freeze'
        }));
        kids.push(ball);
      }
    });

    /* props + numbered spots */
    (choreo.cones || []).forEach(function (c) {
      kids.push(svg('path', {
        d: 'M ' + c.x + ' ' + (c.y - 10) + ' L ' + (c.x + 9) + ' ' + (c.y + 8) +
           ' L ' + (c.x - 9) + ' ' + (c.y + 8) + ' Z',
        class: 'dc-cone'
      }));
    });
    (choreo.coaches || []).forEach(function (c) {
      kids.push(svg('rect', { x: c.x - 9, y: c.y - 9, width: 18, height: 18, rx: 4, class: 'dc-coach' }));
    });
    (choreo.spots || []).forEach(function (s, i) {
      var g = svg('g', { class: 'dc-spot', style: 'animation-delay:' + (i * 0.35) + 's' });
      g.appendChild(svg('circle', { cx: s.x, cy: s.y, r: 14, class: 'dc-spot__c' }));
      if (s.n != null) {
        g.appendChild(svg('text', {
          x: s.x, y: s.y + 4.5, 'text-anchor': 'middle', class: 'dc-spot__n'
        }, [document.createTextNode(String(s.n))]));
      }
      kids.push(g);
    });

    /* the player runs the circuit (still mode: parked at the start) */
    if (moveD) {
      if (opts.still) {
        var first = null;
        (choreo.paths || []).some(function (p) {
          if (p && p.pts && p.kind !== 'pass') { first = p.pts[0]; return true; }
          return false;
        });
        if (first) kids.push(svg('circle', { cx: first[0], cy: first[1], r: 10, class: 'dc-player' }));
      } else {
        var totalLen = 0;
        (choreo.paths || []).forEach(function (p) {
          if (p && p.pts && p.kind !== 'pass') totalLen += len_of(p.pts);
        });
        var dur = Math.max(3, Math.min(9, totalLen / 80));
        var player = svg('circle', { r: 10, class: 'dc-player' });
        player.appendChild(svg('animateMotion', {
          path: moveD, dur: dur + 's', repeatCount: 'indefinite'
        }));
        kids.push(player);
      }
    } else if ((choreo.spots || []).length && !(choreo.shots || []).length) {
      /* stationary drill with no ball flight — player stands on spot 1 */
      var s0 = choreo.spots[0];
      kids.push(svg('circle', { cx: s0.x, cy: s0.y, r: 10, class: 'dc-player' }));
    }

    /* the one-line "how to read this" — clarity beat any legend we tried.
       Skipped in still thumbs: 15px text on a 90px-wide tile is lint. */
    if (choreo.note && !opts.still) {
      kids.push(svg('rect', { x: 0, y: VIEW_H - 26, width: 500, height: 26, class: 'dc-note__bg' }));
      kids.push(svg('text', { x: 250, y: VIEW_H - 8, 'text-anchor': 'middle', class: 'dc-note' },
        [document.createTextNode(choreo.note)]));
    }

    return svg('svg', {
      viewBox: '0 0 500 ' + VIEW_H,
      role: 'img', 'aria-label': opts.label || 'Drill choreography',
      class: 'dc-court' + (opts.still ? ' dc-court--still' : ''),
      style: 'display:block;width:100%;height:auto;background:' + (opts.bg || '#FFFFFF')
    }, kids);
  }

  window.V12DrillCourt = { render: render, RIM: RIM };
})();
