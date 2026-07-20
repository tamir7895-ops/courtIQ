/* ============================================================
   DRILL CHOREOGRAPHY — /js/drill-choreo.js  (window.V12DrillChoreo)
   ------------------------------------------------------------
   Every drill in _DRILLS_DB gets a REAL diagram on the REAL court
   (V11Court units, rendered by app-v10/lib/drill-court.js).

   The scaling trick: drills are not 228 snowflakes — they are ~30
   movement archetypes (the DB's anim_type) × parameters. Each
   archetype below is a builder; the parameters (which side, which
   spot, threes vs mid-range) are read from the drill's own name and
   description. A drill with no recognisable spot still gets its
   archetype's canonical placement — never a blank court.

   All coordinates: V11Court units (500 wide, baseline y=0,
   rim at 250,52.5 — verified NBA geometry). ES5 only.
   ============================================================ */
(function () {
  'use strict';

  /* ── the named spots of a half court ─────────────────────── */
  var SP = {
    rim:      [250, 60],
    ftline:   [250, 200],
    elbowL:   [178, 190], elbowR:  [322, 190],
    blockL:   [200, 78],  blockR:  [300, 78],
    shortL:   [115, 70],  shortR:  [385, 70],
    corner3L: [48, 105],  corner3R:[452, 105],
    wing3L:   [88, 222],  wing3R:  [412, 222],
    top3:     [250, 298],
    midWingL: [125, 165], midWingR:[375, 165],
    topKey:   [250, 255],
    paint:    [250, 120]
  };
  function pt(name) { return { x: SP[name][0], y: SP[name][1] }; }
  function xy(name) { return [SP[name][0], SP[name][1]]; }
  function num(spots) {
    return spots.map(function (s, i) { return { x: s.x, y: s.y, n: i + 1 }; });
  }

  /* ── what the drill's own text says ───────────────────────── */
  function scan(d) {
    var t = ((d.name || '') + ' ' + (d.description || '')).toLowerCase();
    return {
      left:  /left/.test(t) && !/right/.test(t),
      right: /right/.test(t) && !/left/.test(t),
      both:  /per side|each side|both side|alternat/.test(t),
      three: /three|3s|3-point|3pt|beyond the arc|deep/.test(t),
      corner:/corner/.test(t),
      wing:  /wing/.test(t),
      elbow: /elbow/.test(t),
      top:   /top of the key|top of key|\btop\b/.test(t),
      post:  /post|block/.test(t),
      ft:    /free throw|free-throw/.test(t),
      base:  /baseline/.test(t)
    };
  }
  /* the drill's shooting spot(s), from its words */
  function shootSpots(d) {
    var k = scan(d);
    if (k.ft) return [pt('ftline')];
    if (k.corner) {
      if (k.left) return [pt('corner3L')];
      if (k.right) return [pt('corner3R')];
      return [pt('corner3L'), pt('corner3R')];
    }
    if (k.wing) {
      var L = k.three ? 'wing3L' : 'midWingL', R = k.three ? 'wing3R' : 'midWingR';
      if (k.left) return [pt(L)];
      if (k.right) return [pt(R)];
      return k.both ? [pt(L), pt(R)] : [pt(R)];
    }
    if (k.elbow) return k.both ? [pt('elbowL'), pt('elbowR')] : [pt('elbowR')];
    if (k.post) return k.left ? [pt('blockL')] : [pt('blockR')];
    if (k.top || k.three) return [pt('top3')];
    return [pt('midWingR')];
  }

  /* ── the archetypes ───────────────────────────────────────── */
  var T = {};

  T.catch_shoot = function (d) {
    var spots = shootSpots(d);
    return {
      coaches: [pt('topKey')],
      paths: spots.map(function (s) {
        return { pts: [xy('topKey'), [s.x, s.y]], kind: 'pass' };
      }),
      spots: num(spots),
      shots: spots
    };
  };

  T.pullup = function (d) {
    var k = scan(d), from = k.left ? 'wing3L' : 'wing3R', at = k.left ? 'elbowL' : 'elbowR';
    return {
      paths: [{ pts: [xy(from), xy(at)], kind: 'dribble' }],
      spots: num([pt(from), pt(at)]),
      shots: [pt(at)]
    };
  };

  T.stepback = function () {
    return {
      paths: [{ pts: [xy('top3'), [265, 250], [250, 292]], kind: 'dribble' }],
      spots: num([pt('topKey'), { x: 250, y: 292 }]),
      shots: [{ x: 250, y: 292 }]
    };
  };

  T.spot_shoot = function (d) {
    var k = scan(d);
    var five = k.three
      ? ['corner3L', 'wing3L', 'top3', 'wing3R', 'corner3R']
      : ['corner3L', 'midWingL', 'ftline', 'midWingR', 'corner3R'];
    var spots = five.map(pt);
    var run = [];
    for (var i = 0; i < five.length; i++) run.push(xy(five[i]));
    return { paths: [{ pts: run, kind: 'run' }], spots: num(spots), shots: spots };
  };

  T.post_fade = function (d) {
    var k = scan(d), b = k.left ? 'blockL' : 'blockR', s = k.left ? 'shortL' : 'shortR';
    return {
      paths: [{ pts: [xy(b), xy(s)], kind: 'dribble' }],
      spots: num([pt(b), pt(s)]),
      shots: [pt(s)]
    };
  };

  T.free_throw = function () {
    return { spots: num([pt('ftline')]), shots: [pt('ftline')], zone: 'pnt' };
  };

  T.two_ball = function () {
    return {
      spots: num([pt('topKey')]),
      cones: [{ x: 220, y: 255 }, { x: 280, y: 255 }],
      paths: [{ pts: [[220, 255], [250, 240], [280, 255], [250, 270], [220, 255]], kind: 'dribble' }],
      zone: 'topmid'
    };
  };

  T.slalom = function () {
    var cones = [], run = [[250, 315]], i, x;
    for (i = 0; i < 5; i++) {
      x = 250 + (i % 2 === 0 ? -45 : 45);
      cones.push({ x: 250, y: 285 - i * 55 });
      run.push([x, 285 - i * 55 - 25]);
    }
    run.push([250, 45]);
    return { cones: cones, paths: [{ pts: run, kind: 'dribble' }] };
  };

  T.spider = function () {
    return {
      spots: num([pt('ftline')]),
      paths: [{
        pts: [xy('ftline'), [215, 160], [250, 200], [285, 160], [250, 200],
              [215, 235], [250, 200], [285, 235], [250, 200]],
        kind: 'dribble'
      }],
      zone: 'pnt'
    };
  };

  T.crossover = function () {
    return {
      cones: [{ x: 250, y: 200 }],
      paths: [{ pts: [[250, 300], [230, 215], [270, 185], [250, 90]], kind: 'dribble' }],
      spots: num([{ x: 250, y: 300 }, pt('paint')])
    };
  };

  T.defensive_slide = function () {
    return {
      paths: [{
        pts: [xy('elbowL'), xy('elbowR'), [322, 78], [178, 78], xy('elbowL')],
        kind: 'slide'
      }],
      spots: num([pt('elbowL')]),
      zone: 'pnt'
    };
  };

  T.closeout = function (d) {
    var k = scan(d), w = k.left ? 'wing3L' : 'wing3R';
    return {
      coaches: [pt(w)],
      paths: [{ pts: [xy('paint'), xy(w)], kind: 'run' }],
      spots: num([pt('paint')])
    };
  };

  T.mikan = function () {
    return {
      paths: [{ pts: [[225, 68], [275, 68], [225, 68]], kind: 'run' }],
      spots: num([{ x: 225, y: 68 }, { x: 275, y: 68 }]),
      shots: [{ x: 225, y: 68 }, { x: 275, y: 68 }],
      zone: 'pnt'
    };
  };

  T.eurostep = function () {
    return {
      paths: [{ pts: [xy('wing3R'), [340, 140], [290, 105], [255, 70]], kind: 'dribble' }],
      spots: num([pt('wing3R')]),
      shots: [{ x: 255, y: 70 }]
    };
  };

  T.drive_finish = function (d) {
    var k = scan(d), w = k.left ? 'wing3L' : 'wing3R';
    return {
      paths: [{ pts: [xy(w), xy('paint'), [250, 68]], kind: 'dribble' }],
      spots: num([pt(w)]),
      shots: [{ x: 250, y: 68 }]
    };
  };

  T.sprints = function () {
    return {
      paths: [{
        pts: [[95, 315], [95, 190], [95, 300], [95, 78], [95, 315]],
        kind: 'run'
      }],
      cones: [{ x: 95, y: 315 }, { x: 95, y: 190 }, { x: 95, y: 78 }]
    };
  };

  T.full_court_run = function () {
    return {
      paths: [{ pts: [[470, 320], [470, 20], [440, 20], [440, 320]], kind: 'run' }],
      cones: [{ x: 455, y: 320 }, { x: 455, y: 20 }]
    };
  };

  T.chest_pass = function () {
    return {
      spots: num([pt('elbowL'), pt('elbowR')]),
      paths: [{ pts: [xy('elbowL'), xy('elbowR')], kind: 'pass' }]
    };
  };
  T.bounce_pass = function () {
    return {
      spots: num([pt('elbowL'), pt('elbowR')]),
      paths: [{ pts: [xy('elbowL'), [250, 230], xy('elbowR')], kind: 'pass' }]
    };
  };
  T.skip_pass = function () {
    return {
      spots: num([pt('corner3L'), pt('wing3R')]),
      paths: [{ pts: [xy('corner3L'), xy('wing3R')], kind: 'pass' }]
    };
  };
  T.outlet_pass = function () {
    return {
      spots: num([pt('paint'), pt('wing3R')]),
      paths: [{ pts: [xy('paint'), xy('wing3R')], kind: 'pass' }]
    };
  };
  T.fast_break = function () {
    return {
      spots: num([pt('paint'), pt('wing3R')]),
      paths: [
        { pts: [xy('paint'), xy('wing3R')], kind: 'pass' },
        { pts: [xy('wing3R'), [412, 320]], kind: 'run' }
      ]
    };
  };

  T.triple_threat = function (d) {
    var k = scan(d), w = k.left ? 'wing3L' : 'wing3R';
    return {
      spots: num([pt(w)]),
      paths: [{ pts: [xy(w), [SP[w][0] + (k.left ? 30 : -30), SP[w][1] - 25], xy(w)], kind: 'dribble' }]
    };
  };
  T.pivot_moves = T.triple_threat;

  T.drop_step = function () {
    return {
      spots: num([pt('blockR')]),
      paths: [{ pts: [xy('blockR'), [285, 62]], kind: 'dribble' }],
      shots: [{ x: 285, y: 62 }],
      zone: 'pnt'
    };
  };

  T.footwork_ladder = function () {
    return {
      ladder: { x: 150, y: 210, dir: 'h' },
      paths: [{ pts: [[135, 210], [265, 210]], kind: 'run' }]
    };
  };
  T.lateral_shuffle = function () {
    return {
      paths: [{ pts: [xy('elbowL'), xy('elbowR'), xy('elbowL')], kind: 'slide' }],
      cones: [{ x: 178, y: 190 }, { x: 322, y: 190 }]
    };
  };

  T.layup_finish = function (d) {
    var k = scan(d), w = k.left ? 'wing3L' : 'wing3R';
    return {
      paths: [{ pts: [xy(w), [k.left ? 210 : 290, 100], [k.left ? 235 : 265, 65]], kind: 'dribble' }],
      spots: num([pt(w)]),
      shots: [{ x: k.left ? 235 : 265, y: 65 }]
    };
  };

  T.dribble_series = function () {
    return {
      spots: num([pt('topKey')]),
      paths: [{ pts: [xy('topKey'), [220, 230], [280, 205], [220, 180], [250, 255]], kind: 'dribble' }]
    };
  };
  T.sprint_drill = T.sprints;

  /* ── per-drill hand overrides (the famous ones, tuned) ────── */
  var OVERRIDES = {
    'shoot-001': function () {          /* Catch & Shoot Corner 3s — both corners */
      return {
        coaches: [pt('topKey')],
        paths: [
          { pts: [xy('topKey'), xy('corner3L')], kind: 'pass' },
          { pts: [xy('topKey'), xy('corner3R')], kind: 'pass' }
        ],
        spots: num([pt('corner3L'), pt('corner3R')]),
        shots: [pt('corner3L'), pt('corner3R')]
      };
    }
  };

  function get(d) {
    if (!d) return null;
    try {
      if (OVERRIDES[d.id]) return OVERRIDES[d.id]();
      var t = T[d.anim_type];
      if (t) return t(d);
      /* archetype missing: still a real court — spot where the text says */
      var spots = shootSpots(d);
      return { spots: num(spots) };
    } catch (e) { return null; }
  }

  /* resolve a full DB drill from a slim ref (workout-player stores only
     {id, name, ...} in sessionStorage — anim_type lives in the DB) */
  function find(ref) {
    if (!ref) return null;
    try {
      var DB = (typeof _DRILLS_DB !== 'undefined') ? _DRILLS_DB : [];
      for (var i = 0; i < DB.length; i++) {
        if ((ref.id && DB[i].id === ref.id) || (ref.name && DB[i].name === ref.name)) return DB[i];
      }
    } catch (e) {}
    return null;
  }

  window.V12DrillChoreo = { get: get, find: find, SPOTS: SP };
})();
