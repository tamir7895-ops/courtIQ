// drill-engine.js
// CourtIQ drill catalog + helpers (treat as the canonical data source).
// Sealed contract — UI reads, never writes. Numbers are designed to make the
// product feel lived-in: realistic spread of difficulties, mastery levels,
// peer counts, leaderboards.
//
// Each drill carries:
//   id            stable kebab-case
//   name          display name (UPPERCASE in UI)
//   focus         "shooting" | "ballhandling" | "defense" | "athleticism"
//   subTags       fine-grained tags (e.g. "wing-3","catch-shoot","pull-up")
//   targetZones   shot-chart zone ids it improves: lc/rc/lw/rw/top/ml/mr/topmid/pnt
//   difficulty    "beginner" | "intermediate" | "advanced"
//   level         numeric 1..3 (used for icon)
//   sets          # of sets
//   reps          per-set repetition count
//   duration      target session minutes (incl. rest)
//   restSec       between-set rest
//   ball          "required" | "optional" | "none"
//   space         "half-court" | "wing" | "corner" | "key" | "full" | "spot"
//   coachPoints   3-5 short bullet phrases (uppercase-friendly cues)
//   phases        timed phases for hero animation + run order
//   pattern       canvas animation spec — the movement/shot pattern on a
//                 280x176 court (mini half-court, baseline=top)
//   stats         { sessionsCompleted, allTimeAttempts, allTimeMakes, p50Fg,
//                   p90Fg, mastery {level,xp,nextXp}, lastDone, streak }
//   leaderboard   [{ handle, fg, made, att, badge? }]  small list
//   description   1-2 sentence pitch
//   benefit       one-line "what this fixes" copy
//
// COORD SYSTEM for `pattern`:
//   The drill detail UI renders a 280x176 SVG. Use a 0..280 x 0..176 box.
//   Rim center (140, 14). 3PT arc center (140,14) radius 95.
//   Paint x∈[105,175] y∈[14,75]. Half-court y=176.
//   This is INDEPENDENT of the shot-chart geometry — separate visual aid.

(function () {
  // ── Helpers ──────────────────────────────────────────────────────────────
  const PEER_HANDLES = [
    "lights_out_k", "marco.b", "j.crossover", "split_step", "trip_t",
    "dropstep_d", "fadeaway_fi", "wing_killer", "g_step", "pullup_pat",
    "rim.r", "stretch_4", "two_dribble", "buckets.bri", "iso_ivy",
    "deep_d", "high_low_h", "h.handle", "perimeter.p", "bench_to_starter",
    "set.shot.s", "v_assassin", "elbow.e", "swish_q", "off_ball_o",
    "tape.t", "north_3", "ankle.snap", "trailer.t", "midrange_m",
  ];

  // Deterministic pseudo-random for stable mock data
  const seed = (s) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return () => {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function makeStats(id, ranges) {
    const r = seed(id);
    const sessionsCompleted = Math.floor(r() * (ranges.maxSessions - 4)) + 4;
    const allTimeAttempts   = sessionsCompleted * (ranges.repsAvg + Math.floor(r() * 12) - 6);
    const p50Fg = Math.round(ranges.p50Base + (r() * 18 - 9));
    const p90Fg = Math.min(95, p50Fg + 12 + Math.floor(r() * 8));
    const allTimeMakes = Math.round(allTimeAttempts * (p50Fg / 100));
    const xpMax = [120, 360, 800][ranges.levelMax - 1] || 360;
    const masteryLevel = Math.min(ranges.levelMax, 1 + Math.floor((sessionsCompleted / ranges.maxSessions) * ranges.levelMax));
    const xp = Math.floor(r() * xpMax);
    const days = Math.floor(r() * 14);
    const dayLabel = days === 0 ? "TODAY"
      : days === 1 ? "YESTERDAY"
      : days < 7 ? `${days}D AGO`
      : `${Math.floor(days/7)}W AGO`;
    const streak = Math.max(0, Math.floor(r() * 9) - 2);
    return {
      sessionsCompleted,
      allTimeAttempts,
      allTimeMakes,
      p50Fg,
      p90Fg,
      mastery: { level: masteryLevel, xp, nextXp: xpMax, label: ["BRONZE","SILVER","GOLD","PLATINUM"][masteryLevel-1] || "BRONZE" },
      lastDone: dayLabel,
      streak,
    };
  }

  function makeLeaderboard(id, p50, count = 5) {
    const r = seed("lb-" + id);
    const out = [];
    const used = new Set();
    for (let i = 0; i < count; i++) {
      let idx;
      do { idx = Math.floor(r() * PEER_HANDLES.length); } while (used.has(idx));
      used.add(idx);
      const fg = Math.min(95, Math.round(p50 + 10 + (count - i) * 3 + (r() * 6 - 3)));
      const att = 30 + Math.floor(r() * 70);
      const made = Math.round(att * fg / 100);
      out.push({
        handle: PEER_HANDLES[idx],
        fg, made, att,
        badge: i === 0 ? "👑" : i === 1 ? "🔥" : null,
      });
    }
    return out;
  }

  // ── Drill catalog ─────────────────────────────────────────────────────────
  // Carefully designed to span the four focuses, three difficulty tiers,
  // and to map onto every shot-chart zone (so weak-zone recommendations
  // always have hits).

  const DRILLS = [
    // ──────────────────────────────────────────────── SHOOTING · 22 drills
    {
      id: "form-shooting-1ft",
      name: "FORM SHOOTING · 1-FOOT",
      focus: "shooting",
      subTags: ["form","fundamentals","close-range"],
      targetZones: ["pnt"],
      difficulty: "beginner", level: 1,
      sets: 3, reps: 10, duration: 8, restSec: 30,
      ball: "required", space: "spot",
      description: "One-foot from the rim. Pure form — elbow under, wrist over, ten in a row before stepping back.",
      benefit: "RESETS YOUR SHOT MECHANICS",
      coachPoints: ["FEET SQUARE TO RIM","ELBOW UNDER THE BALL","WRIST RELAXED, FOLLOW-THROUGH HELD","TEN IN A ROW BEFORE STEP-BACK"],
      phases: [
        { id: "warmup", label: "BREATH + STANCE", sec: 30 },
        { id: "set1",   label: "SET 1 · 10 REPS", sec: 110 },
        { id: "rest1",  label: "REST",            sec: 30 },
        { id: "set2",   label: "SET 2 · 10 REPS", sec: 110 },
        { id: "rest2",  label: "REST",            sec: 30 },
        { id: "set3",   label: "SET 3 · 10 REPS", sec: 110 },
        { id: "cool",   label: "COOLDOWN",        sec: 30 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 28, label: "1FT" }] },
    },
    {
      id: "free-throw-block",
      name: "FREE THROWS · 50 ROUTINE",
      focus: "shooting",
      subTags: ["free-throw","routine","mental"],
      targetZones: ["topmid"],
      difficulty: "beginner", level: 1,
      sets: 5, reps: 10, duration: 12, restSec: 25,
      ball: "required", space: "key",
      description: "Five sets of ten from the line. Run your routine identical every time — same dribbles, same breath.",
      benefit: "BUILDS A REPEATABLE ROUTINE",
      coachPoints: ["3 DRIBBLES, EVERY TIME","FEET ON THE NAIL","DEEP BREATH AT TOP","HOLD FOLLOW-THROUGH"],
      phases: [
        { id: "warm",  label: "WARM-UP · 5 FROM CLOSE", sec: 60 },
        { id: "set1",  label: "SET 1 · 10 FT",          sec: 100 },
        { id: "set2",  label: "SET 2 · 10 FT",          sec: 100 },
        { id: "set3",  label: "SET 3 · 10 FT",          sec: 100 },
        { id: "set4",  label: "SET 4 · 10 FT",          sec: 100 },
        { id: "set5",  label: "SET 5 · 10 FT",          sec: 100 },
        { id: "log",   label: "LOG MAKES",              sec: 30 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 75, label: "FT" }] },
    },
    {
      id: "wing-3-recovery",
      name: "WING 3 · CATCH & RIP",
      focus: "shooting",
      subTags: ["wing-3","catch-shoot","3-point"],
      targetZones: ["lw","rw"],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 8, duration: 14, restSec: 35,
      ball: "required", space: "wing",
      description: "Self-pass, sprint to wing, catch on rhythm, rise. Both wings, four sets, eight makes target per set.",
      benefit: "RESHAPES YOUR WEAKEST 3-POINT ZONE",
      coachPoints: ["CHEST-LEVEL CATCH","FEET PRE-SET ON THE PASS","RISE — DON'T DRIFT","HOLD UNTIL THE BALL HITS NET"],
      phases: [
        { id: "warm",  label: "FORM SHOOTING · 60s",  sec: 60 },
        { id: "L1",    label: "L WING · SET 1",       sec: 110 },
        { id: "R1",    label: "R WING · SET 1",       sec: 110 },
        { id: "rest",  label: "REST · WATER",         sec: 60 },
        { id: "L2",    label: "L WING · SET 2",       sec: 110 },
        { id: "R2",    label: "R WING · SET 2",       sec: 110 },
        { id: "rest2", label: "REST",                 sec: 60 },
        { id: "L3",    label: "L WING · SET 3",       sec: 110 },
        { id: "R3",    label: "R WING · SET 3",       sec: 110 },
        { id: "log",   label: "LOG · DEBRIEF",        sec: 60 },
      ],
      pattern: {
        kind: "shuttle",
        spots: [
          { x:  72, y: 52, label: "L WING" },
          { x: 208, y: 52, label: "R WING" },
        ],
        path: [
          { from: { x: 140, y: 110 }, to: { x:  72, y: 52 }, kind: "sprint" },
          { from: { x:  72, y: 52  }, to: { x: 140, y: 110 }, kind: "fade" },
          { from: { x: 140, y: 110 }, to: { x: 208, y: 52 }, kind: "sprint" },
          { from: { x: 208, y: 52  }, to: { x: 140, y: 110 }, kind: "fade" },
        ],
        shootAt: [{ x: 72, y: 52 }, { x: 208, y: 52 }],
      },
    },
    {
      id: "corner-3-pickup",
      name: "CORNER 3 · 1-2 PICKUP",
      focus: "shooting",
      subTags: ["corner-3","catch-shoot","quick-release"],
      targetZones: ["lc","rc"],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 5, duration: 12, restSec: 30,
      ball: "required", space: "corner",
      description: "Skip-pass simulation: ball on the floor, sprint corner, 1-2 pickup, release before the imaginary closeout arrives.",
      benefit: "FAST RELEASE FROM THE CORNER",
      coachPoints: ["1-2 STEP, NEVER HOP","PICKUP TO POCKET INSTANTLY","SHOULDERS SQUARE TO RIM","LAND IN BALANCE"],
      phases: [
        { id: "warm",  label: "WARM-UP CORNERS",  sec: 60 },
        { id: "L1",    label: "L CORNER · SET 1", sec: 80 },
        { id: "R1",    label: "R CORNER · SET 1", sec: 80 },
        { id: "rest1", label: "REST",             sec: 45 },
        { id: "L2",    label: "L CORNER · SET 2", sec: 80 },
        { id: "R2",    label: "R CORNER · SET 2", sec: 80 },
        { id: "rest2", label: "REST",             sec: 45 },
        { id: "L3",    label: "L CORNER · SET 3", sec: 80 },
        { id: "R3",    label: "R CORNER · SET 3", sec: 80 },
        { id: "log",   label: "LOG",              sec: 30 },
      ],
      pattern: {
        kind: "shuttle",
        spots: [
          { x:  16, y: 14, label: "L CORNER" },
          { x: 264, y: 14, label: "R CORNER" },
        ],
        path: [
          { from: { x: 140, y: 110 }, to: { x:  16, y: 14 }, kind: "sprint" },
          { from: { x:  16, y: 14  }, to: { x: 140, y: 110 }, kind: "fade" },
          { from: { x: 140, y: 110 }, to: { x: 264, y: 14 }, kind: "sprint" },
          { from: { x: 264, y: 14  }, to: { x: 140, y: 110 }, kind: "fade" },
        ],
        shootAt: [{ x: 16, y: 14 }, { x: 264, y: 14 }],
      },
    },
    {
      id: "top-of-key-3",
      name: "TOP OF KEY 3 · STEP-BACK",
      focus: "shooting",
      subTags: ["top-3","step-back","off-the-dribble"],
      targetZones: ["top"],
      difficulty: "advanced", level: 3,
      sets: 3, reps: 10, duration: 14, restSec: 45,
      ball: "required", space: "key",
      description: "Two dribbles attack, hard step-back to the top of the arc, rise. Sells the closeout, creates the space.",
      benefit: "WEAPONIZES YOUR PULL-UP 3",
      coachPoints: ["LOW ATTACK DRIBBLE","LONG STEP-BACK, LAND BALANCED","NO FADE BACKWARDS","HOLD THE FOLLOW-THROUGH"],
      phases: [
        { id: "warm", label: "FORM · 5 FROM 10FT", sec: 60 },
        { id: "set1", label: "SET 1 · 10 STEP-BACKS", sec: 130 },
        { id: "rest1",label: "REST",                  sec: 60 },
        { id: "set2", label: "SET 2 · 10 STEP-BACKS", sec: 130 },
        { id: "rest2",label: "REST",                  sec: 60 },
        { id: "set3", label: "SET 3 · 10 STEP-BACKS", sec: 130 },
        { id: "log",  label: "LOG",                    sec: 30 },
      ],
      pattern: {
        kind: "stepback",
        spots: [{ x: 140, y: 110, label: "TOP 3" }],
        path: [
          { from: { x: 140, y: 110 }, to: { x: 140, y: 80  }, kind: "drive" },
          { from: { x: 140, y: 80  }, to: { x: 140, y: 110 }, kind: "stepback" },
        ],
        shootAt: [{ x: 140, y: 110 }],
      },
    },
    {
      id: "elbow-jumpers",
      name: "ELBOW JUMPERS · 5-SPOT",
      focus: "shooting",
      subTags: ["mid-range","elbow","catch-shoot"],
      targetZones: ["topmid","ml","mr"],
      difficulty: "intermediate", level: 2,
      sets: 5, reps: 5, duration: 14, restSec: 30,
      ball: "required", space: "key",
      description: "Five spots around the elbow line. Five attempts each, log makes. Reset to free throw between spots.",
      benefit: "BRINGS BACK THE LOST MID-RANGE",
      coachPoints: ["FOOTWORK FIRST","SAME RELEASE EVERY SPOT","RESET TO LINE BETWEEN SPOTS","COUNT MAKES OUT LOUD"],
      phases: [
        { id: "warm",  label: "WARM-UP",      sec: 60 },
        { id: "S1",    label: "SPOT 1 · L ELBOW",  sec: 90 },
        { id: "S2",    label: "SPOT 2 · L MID",    sec: 90 },
        { id: "S3",    label: "SPOT 3 · TOP",      sec: 90 },
        { id: "S4",    label: "SPOT 4 · R MID",    sec: 90 },
        { id: "S5",    label: "SPOT 5 · R ELBOW",  sec: 90 },
        { id: "log",   label: "LOG MAKES",         sec: 60 },
      ],
      pattern: {
        kind: "5spot",
        spots: [
          { x:  88, y: 60, label: "L MID" },
          { x: 105, y: 75, label: "L ELBOW" },
          { x: 140, y: 90, label: "TOP" },
          { x: 175, y: 75, label: "R ELBOW" },
          { x: 192, y: 60, label: "R MID" },
        ],
      },
    },
    {
      id: "pull-up-jumper",
      name: "PULL-UP JUMPERS · 2-DRIBBLE",
      focus: "shooting",
      subTags: ["pull-up","off-dribble","mid-range"],
      targetZones: ["topmid","ml","mr"],
      difficulty: "advanced", level: 3,
      sets: 4, reps: 6, duration: 13, restSec: 40,
      ball: "required", space: "key",
      description: "Two-dribble drive into a hard plant pull-up. Alternate sides every set.",
      benefit: "CREATES YOUR OWN MID-RANGE",
      coachPoints: ["LOW STANCE OUT OF TRIPLE-THREAT","HARD PLANT, NO DRIFT","KEEP THE BALL HIGH ON THE GATHER","BALANCED LANDING"],
      phases: [
        { id: "warm",  label: "WARM-UP", sec: 60 },
        { id: "L1",    label: "LEFT · SET 1",  sec: 80 },
        { id: "R1",    label: "RIGHT · SET 1", sec: 80 },
        { id: "rest1", label: "REST", sec: 50 },
        { id: "L2",    label: "LEFT · SET 2",  sec: 80 },
        { id: "R2",    label: "RIGHT · SET 2", sec: 80 },
        { id: "rest2", label: "REST", sec: 50 },
        { id: "L3",    label: "LEFT · SET 3",  sec: 80 },
        { id: "R3",    label: "RIGHT · SET 3", sec: 80 },
        { id: "log",   label: "LOG", sec: 30 },
      ],
      pattern: {
        kind: "pullup",
        spots: [
          { x: 105, y: 95, label: "L PULL" },
          { x: 175, y: 95, label: "R PULL" },
        ],
        shootAt: [{ x: 105, y: 95 }, { x: 175, y: 95 }],
      },
    },
    {
      id: "spot-up-7",
      name: "7-SPOT SHOOTING",
      focus: "shooting",
      subTags: ["3-point","spot-up","range"],
      targetZones: ["lc","lw","top","rw","rc","ml","mr"],
      difficulty: "intermediate", level: 2,
      sets: 3, reps: 7, duration: 18, restSec: 45,
      ball: "required", space: "half-court",
      description: "Standard NBA 7-spot. Three sets, seven makes per spot, in order: corner → wing → top → wing → corner.",
      benefit: "BUILDS RANGE-WIDE CONSISTENCY",
      coachPoints: ["MOVE WITH PURPOSE BETWEEN SPOTS","SAME ROUTINE EVERY SPOT","BREATHE BEFORE THE CATCH","TRACK STREAKS"],
      phases: [
        { id: "warm",  label: "WARM-UP",         sec: 90 },
        { id: "S1",    label: "L CORNER",        sec: 90 },
        { id: "S2",    label: "L WING",          sec: 90 },
        { id: "S3",    label: "TOP",             sec: 90 },
        { id: "S4",    label: "R WING",          sec: 90 },
        { id: "S5",    label: "R CORNER",        sec: 90 },
        { id: "rest",  label: "REST",            sec: 60 },
        { id: "rev",   label: "REVERSE 5-SPOT",  sec: 360 },
        { id: "log",   label: "LOG",             sec: 30 },
      ],
      pattern: {
        kind: "5spot",
        spots: [
          { x:  16, y: 14, label: "LC" },
          { x:  72, y: 52, label: "LW" },
          { x: 140, y: 110, label: "TOP" },
          { x: 208, y: 52, label: "RW" },
          { x: 264, y: 14, label: "RC" },
        ],
      },
    },
    {
      id: "rip-3-relocate",
      name: "RIP & RELOCATE · 3PT",
      focus: "shooting",
      subTags: ["3-point","off-ball","relocate"],
      targetZones: ["lw","top","rw"],
      difficulty: "advanced", level: 3,
      sets: 4, reps: 8, duration: 16, restSec: 40,
      ball: "required", space: "half-court",
      description: "Catch & shoot, then sprint-relocate to the next perimeter spot before the rebound bounces twice.",
      benefit: "TRAINS GAME-SPEED PERIMETER MOVEMENT",
      coachPoints: ["CATCH ON THE MOVE, FEET FIRST","NEVER STAND STILL ON A MISS","RELOCATE FIVE STEPS MIN","FINISH WITH FEET, NOT WAIST"],
      phases: [
        { id: "warm",  label: "WARM-UP",      sec: 90 },
        { id: "set1",  label: "SET 1 · LR",   sec: 130 },
        { id: "set2",  label: "SET 2 · TOP", sec: 130 },
        { id: "rest",  label: "REST",         sec: 60 },
        { id: "set3",  label: "SET 3 · LR",   sec: 130 },
        { id: "set4",  label: "SET 4 · TOP", sec: 130 },
        { id: "log",   label: "LOG",          sec: 30 },
      ],
      pattern: {
        kind: "shuttle",
        spots: [
          { x:  72, y: 52, label: "LW" },
          { x: 140, y: 110, label: "TOP" },
          { x: 208, y: 52, label: "RW" },
        ],
        path: [
          { from: { x:  72, y: 52  }, to: { x: 140, y: 110 }, kind: "relocate" },
          { from: { x: 140, y: 110 }, to: { x: 208, y: 52  }, kind: "relocate" },
          { from: { x: 208, y: 52  }, to: { x:  72, y: 52  }, kind: "relocate" },
        ],
        shootAt: [{ x: 72, y: 52 }, { x: 140, y: 110 }, { x: 208, y: 52 }],
      },
    },
    {
      id: "deep-3-extender",
      name: "DEEP 3 · LOGO RANGE",
      focus: "shooting",
      subTags: ["deep-3","range","strength"],
      targetZones: ["top","lw","rw"],
      difficulty: "advanced", level: 3,
      sets: 3, reps: 5, duration: 12, restSec: 60,
      ball: "required", space: "half-court",
      description: "Three feet behind the line. Loads the legs, extends the range, makes the regular 3 feel close.",
      benefit: "EXTENDS YOUR EFFECTIVE RANGE",
      coachPoints: ["LOAD THE BACK LEG","DRIVE THROUGH THE GROUND","STRAIGHT UP, NEVER LEANING BACK","STOP AT 5/SET — QUALITY"],
      phases: [
        { id: "warm",  label: "FORM · CLOSE",    sec: 90 },
        { id: "set1",  label: "SET 1 · 5 DEEP", sec: 100 },
        { id: "rest1", label: "REST",            sec: 75 },
        { id: "set2",  label: "SET 2 · 5 DEEP", sec: 100 },
        { id: "rest2", label: "REST",            sec: 75 },
        { id: "set3",  label: "SET 3 · 5 DEEP", sec: 100 },
        { id: "cool",  label: "STRETCH",         sec: 90 },
      ],
      pattern: {
        kind: "spot",
        spots: [
          { x:  56, y: 80, label: "DEEP L" },
          { x: 140, y: 130, label: "DEEP T" },
          { x: 224, y: 80, label: "DEEP R" },
        ],
      },
    },
    {
      id: "bank-shot-block",
      name: "BANK SHOT · 45° BLOCK",
      focus: "shooting",
      subTags: ["short-mid","bank","floater"],
      targetZones: ["pnt","ml","mr"],
      difficulty: "beginner", level: 1,
      sets: 4, reps: 8, duration: 10, restSec: 25,
      ball: "required", space: "key",
      description: "Old-school bank shot from 45°. Box on the glass, soft touch, both sides.",
      benefit: "ADDS A CLEAN ANGLE TO YOUR ARSENAL",
      coachPoints: ["AIM FOR THE TOP CORNER OF THE BOX","SOFT WRIST","SAME RELEASE BOTH HANDS","NEVER USE THE GLASS STRAIGHT-ON"],
      phases: [
        { id: "L1", label: "L 45° · SET 1", sec: 90 },
        { id: "R1", label: "R 45° · SET 1", sec: 90 },
        { id: "L2", label: "L 45° · SET 2", sec: 90 },
        { id: "R2", label: "R 45° · SET 2", sec: 90 },
        { id: "log",label: "LOG",            sec: 60 },
      ],
      pattern: { kind: "spot", spots: [
        { x:  88, y: 38, label: "L 45°" },
        { x: 192, y: 38, label: "R 45°" },
      ]},
    },
    {
      id: "floater-gauntlet",
      name: "FLOATER GAUNTLET",
      focus: "shooting",
      subTags: ["floater","short-mid","touch"],
      targetZones: ["pnt","topmid"],
      difficulty: "advanced", level: 3,
      sets: 4, reps: 6, duration: 12, restSec: 30,
      ball: "required", space: "key",
      description: "One-foot, two-foot, off-glass, hesitation — four floater variations from the elbow.",
      benefit: "TOUCH AROUND THE PAINT",
      coachPoints: ["HIGH ARC, SOFT TOUCH","BALANCE OVER POWER","ONE-FOOT FROM HERE, TWO-FOOT NEXT","FINISH WITH ONE HAND"],
      phases: [
        { id: "v1",  label: "V1 · 1-FOOT",    sec: 100 },
        { id: "v2",  label: "V2 · 2-FOOT",    sec: 100 },
        { id: "v3",  label: "V3 · OFF GLASS", sec: 100 },
        { id: "v4",  label: "V4 · HESITATION",sec: 100 },
        { id: "log", label: "LOG",            sec: 60 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 60, label: "FLOATER" }] },
    },
    {
      id: "fadeaway-mid",
      name: "FADEAWAY MID-RANGE",
      focus: "shooting",
      subTags: ["fadeaway","mid-range","contested"],
      targetZones: ["ml","mr","topmid"],
      difficulty: "advanced", level: 3,
      sets: 3, reps: 8, duration: 12, restSec: 50,
      ball: "required", space: "key",
      description: "Back-to-rim, jab, fade. Both sides. Reps the contested mid-range that wins clutch.",
      benefit: "THE OLD-SCHOOL CLOSER",
      coachPoints: ["BALANCED LANDING — NEVER FALL","HOLD THE HIGH RELEASE","ALTERNATE PIVOT FOOT","NO RUNNING JUMP"],
      phases: [
        { id: "L1",  label: "L · SET 1", sec: 130 },
        { id: "R1",  label: "R · SET 1", sec: 130 },
        { id: "rest",label: "REST",       sec: 60 },
        { id: "L2",  label: "L · SET 2", sec: 130 },
        { id: "R2",  label: "R · SET 2", sec: 130 },
        { id: "log", label: "LOG",        sec: 30 },
      ],
      pattern: { kind: "spot", spots: [
        { x:  88, y: 60, label: "L FADE" },
        { x: 192, y: 60, label: "R FADE" },
      ]},
    },
    {
      id: "transition-3",
      name: "TRANSITION 3 · TRAILER",
      focus: "shooting",
      subTags: ["3-point","transition","trailer"],
      targetZones: ["top","lw","rw"],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 6, duration: 12, restSec: 30,
      ball: "required", space: "full",
      description: "Sprint baseline-to-3PT line. Catch from a coach (or self-pass), shoot in rhythm.",
      benefit: "TRAILER 3 IS A FREE BUCKET",
      coachPoints: ["SPRINT WIDE, STAY ABOVE THE BREAK","CATCH HIGH","SHOULDERS ALREADY SQUARE","RIM-RUN MENTALITY"],
      phases: [
        { id: "warm", label: "WARM-UP",      sec: 90 },
        { id: "set1", label: "SET 1 · L→TOP",sec: 110 },
        { id: "set2", label: "SET 2 · R→TOP",sec: 110 },
        { id: "set3", label: "SET 3 · L→TOP",sec: 110 },
        { id: "set4", label: "SET 4 · R→TOP",sec: 110 },
        { id: "log",  label: "LOG",          sec: 30 },
      ],
      pattern: {
        kind: "shuttle",
        spots: [{ x: 140, y: 110, label: "TRAILER" }],
        path: [
          { from: { x: 140, y: 168 }, to: { x: 140, y: 110 }, kind: "sprint" },
        ],
        shootAt: [{ x: 140, y: 110 }],
      },
    },
    {
      id: "post-up-hooks",
      name: "POST-UP · HOOK BLOCK",
      focus: "shooting",
      subTags: ["post","hook","interior"],
      targetZones: ["pnt"],
      difficulty: "intermediate", level: 2,
      sets: 3, reps: 10, duration: 12, restSec: 30,
      ball: "required", space: "key",
      description: "Right-shoulder hook, left-shoulder hook, drop step. Three sets of ten alternating.",
      benefit: "INTERIOR PUNISHMENT",
      coachPoints: ["SEAL THE DEFENDER WITH YOUR HIP","HIGH RELEASE","CHIN OVER THE BALL","LAND ON BALANCE"],
      phases: [
        { id: "RH",  label: "R HOOK · 10", sec: 100 },
        { id: "LH",  label: "L HOOK · 10", sec: 100 },
        { id: "DS",  label: "DROP STEP",   sec: 120 },
        { id: "log", label: "LOG",         sec: 60 },
      ],
      pattern: { kind: "spot", spots: [
        { x: 105, y: 30, label: "L BLOCK" },
        { x: 175, y: 30, label: "R BLOCK" },
      ]},
    },
    {
      id: "iso-jab-series",
      name: "ISO · JAB SERIES",
      focus: "shooting",
      subTags: ["iso","jab","mid-range"],
      targetZones: ["topmid","ml","mr","top"],
      difficulty: "advanced", level: 3,
      sets: 3, reps: 8, duration: 14, restSec: 50,
      ball: "required", space: "key",
      description: "Triple-threat → jab → read defender → pull, drive, or step-back. Reps the read.",
      benefit: "WINS 1V1",
      coachPoints: ["LIVE DRIBBLE OFF THE JAB","HOLD THE BALL TIGHT, EYES UP","DON'T TELEGRAPH","LAND BALANCED EVERY OUTCOME"],
      phases: [
        { id: "p1",  label: "JAB-PULL · 8",  sec: 130 },
        { id: "p2",  label: "JAB-DRIVE · 8", sec: 130 },
        { id: "p3",  label: "JAB-STEPBACK·8",sec: 130 },
        { id: "log", label: "LOG",            sec: 60 },
      ],
      pattern: { kind: "spot", spots: [
        { x: 140, y: 110, label: "ISO TOP" },
      ]},
    },
    {
      id: "ko-shooting",
      name: "K.O. SHOOTING · COMPETITION",
      focus: "shooting",
      subTags: ["competition","game-mode","pressure"],
      targetZones: ["lw","top","rw","topmid"],
      difficulty: "intermediate", level: 2,
      sets: 1, reps: 21, duration: 12, restSec: 0,
      ball: "required", space: "half-court",
      description: "Solo K.O. — 21 shots from 5 spots. If you miss two in a row at any spot, restart that spot.",
      benefit: "TRAINS PRESSURE-SHOOTING",
      coachPoints: ["SET A TIME GOAL","RESET BREATHING ON MISSES","DON'T RUSH AFTER A MAKE","TRACK BEST TIME"],
      phases: [
        { id: "go",  label: "K.O. RUN", sec: 660 },
        { id: "log", label: "LOG TIME", sec: 60 },
      ],
      pattern: {
        kind: "5spot",
        spots: [
          { x:  16, y: 14, label: "LC" },
          { x:  72, y: 52, label: "LW" },
          { x: 140, y: 110, label: "TOP" },
          { x: 208, y: 52, label: "RW" },
          { x: 264, y: 14, label: "RC" },
        ],
      },
    },
    {
      id: "behind-back-stepback",
      name: "BEHIND-BACK STEP-BACK",
      focus: "shooting",
      subTags: ["combo","step-back","creation"],
      targetZones: ["top","lw","rw"],
      difficulty: "advanced", level: 3,
      sets: 3, reps: 6, duration: 12, restSec: 50,
      ball: "required", space: "half-court",
      description: "Behind-the-back into hard step-back. Sells both directions. Big-time creation move.",
      benefit: "ELITE CREATION",
      coachPoints: ["PROTECT THE BALL HIGH","BIG STEP-BACK, NO DRIFT","SHOULDERS SQUARE ON LANDING","DON'T STARE AT THE RIM"],
      phases: [
        { id: "p1", label: "L SIDE · 6", sec: 110 },
        { id: "p2", label: "R SIDE · 6", sec: 110 },
        { id: "p3", label: "TOP · 6",    sec: 110 },
        { id: "log",label: "LOG",         sec: 30 },
      ],
      pattern: { kind: "stepback", spots: [{ x: 140, y: 110, label: "TOP" }] },
    },
    {
      id: "warmup-form-2-min",
      name: "FORM SHOOTING · 2-MIN OPENER",
      focus: "shooting",
      subTags: ["warmup","form","close-range"],
      targetZones: ["pnt"],
      difficulty: "beginner", level: 1,
      sets: 1, reps: 30, duration: 4, restSec: 0,
      ball: "required", space: "spot",
      description: "Two minutes, one foot from rim. Pure form. Warm-up only — never count this as your main session.",
      benefit: "OPENS EVERY GOOD WORKOUT",
      coachPoints: ["BREATHE","ELBOW UNDER","WRIST OVER","HOLD THROUGH"],
      phases: [{ id: "go", label: "FORM · 2 MIN", sec: 120 }],
      pattern: { kind: "spot", spots: [{ x: 140, y: 28, label: "1FT" }] },
    },
    {
      id: "100-makes",
      name: "100 MAKES · BURNOUT",
      focus: "shooting",
      subTags: ["volume","conditioning","mental"],
      targetZones: ["topmid","ml","mr"],
      difficulty: "advanced", level: 3,
      sets: 1, reps: 100, duration: 25, restSec: 0,
      ball: "required", space: "half-court",
      description: "100 makes — anywhere inside the arc. Track your time. Track your fatigue. Don't quit.",
      benefit: "BUILDS THE MENTAL DURABILITY",
      coachPoints: ["NO QUITTING","STAY IN ROUTINE","REST ONLY ON MAKES","BREATHE EVERY 10"],
      phases: [{ id: "go", label: "100 MAKES", sec: 1500 }],
      pattern: { kind: "5spot", spots: [
        { x:  88, y: 60, label: "L MID" },
        { x: 140, y: 90, label: "TOP" },
        { x: 192, y: 60, label: "R MID" },
      ]},
    },
    {
      id: "cooldown-form-3",
      name: "3-POINT COOLDOWN · 21",
      focus: "shooting",
      subTags: ["cooldown","3-point","range"],
      targetZones: ["top","lw","rw"],
      difficulty: "intermediate", level: 2,
      sets: 1, reps: 21, duration: 7, restSec: 0,
      ball: "required", space: "half-court",
      description: "Seven from each: left wing, top, right wing. Cooldown range work — keeps the legs honest.",
      benefit: "ENDS YOUR WORKOUT WITH CONFIDENCE",
      coachPoints: ["DON'T RUSH","HOLD FOLLOW-THROUGH","WALK BETWEEN SPOTS","FINISH WITH A MAKE"],
      phases: [{ id: "go", label: "21 · 3 SPOTS", sec: 420 }],
      pattern: { kind: "5spot", spots: [
        { x:  72, y: 52, label: "LW" },
        { x: 140, y: 110, label: "TOP" },
        { x: 208, y: 52, label: "RW" },
      ]},
    },
    {
      id: "off-pin-curl",
      name: "OFF-BALL · PIN-DOWN CURL",
      focus: "shooting",
      subTags: ["off-ball","screen","catch-shoot"],
      targetZones: ["lw","rw","ml","mr"],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 6, duration: 12, restSec: 35,
      ball: "required", space: "half-court",
      description: "Curl off an imaginary pin-down. Catch on the move, plant, rise.",
      benefit: "OFF-BALL MOVEMENT SHOOTING",
      coachPoints: ["SET YOUR DEFENDER WITH A V-CUT","CURL TIGHT, NEVER WIDE","FOOTWORK INSIDE-OUT","CATCH THIGH-HIGH"],
      phases: [
        { id: "L1",  label: "L · 6",  sec: 110 },
        { id: "R1",  label: "R · 6",  sec: 110 },
        { id: "rest",label: "REST",    sec: 60 },
        { id: "L2",  label: "L · 6",  sec: 110 },
        { id: "R2",  label: "R · 6",  sec: 110 },
        { id: "log", label: "LOG",     sec: 30 },
      ],
      pattern: {
        kind: "shuttle",
        spots: [{ x: 88, y: 60, label: "L CURL" }, { x: 192, y: 60, label: "R CURL" }],
        path: [
          { from: { x: 105, y: 30 }, to: { x: 88, y: 60 }, kind: "curl" },
          { from: { x: 175, y: 30 }, to: { x: 192, y: 60 }, kind: "curl" },
        ],
        shootAt: [{ x: 88, y: 60 }, { x: 192, y: 60 }],
      },
    },

    // ──────────────────────────────────────────────── BALL-HANDLING · 10
    {
      id: "two-ball-pound",
      name: "2-BALL POUND DRIBBLE",
      focus: "ballhandling",
      subTags: ["fundamental","stationary","two-ball"],
      targetZones: [],
      difficulty: "beginner", level: 1,
      sets: 4, reps: 30, duration: 6, restSec: 20,
      ball: "required", space: "spot",
      description: "Two balls, hard pound dribble. 30 reps each set. Build the hands.",
      benefit: "STRENGTHENS THE HANDLE",
      coachPoints: ["EYES UP","POUND HARD — SHOULDER TO HAND","BALLS IN SYNC","KNEES BENT"],
      phases: [
        { id: "s1",  label: "SET 1 · 30", sec: 60 },
        { id: "s2",  label: "SET 2 · 30", sec: 60 },
        { id: "s3",  label: "SET 3 · 30", sec: 60 },
        { id: "s4",  label: "SET 4 · 30", sec: 60 },
        { id: "log", label: "LOG",        sec: 30 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 110, label: "STATIONARY" }] },
    },
    {
      id: "two-ball-alt",
      name: "2-BALL ALTERNATING",
      focus: "ballhandling",
      subTags: ["fundamental","stationary","two-ball"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 30, duration: 6, restSec: 20,
      ball: "required", space: "spot",
      description: "Left up, right down — alternating. Tempo control.",
      benefit: "INDEPENDENT-HAND CONTROL",
      coachPoints: ["EYES UP","STAY LOW","DON'T RUSH THE TEMPO","SAME HEIGHT EACH HAND"],
      phases: [
        { id: "s1",  label: "SET 1 · 30", sec: 60 },
        { id: "s2",  label: "SET 2 · 30", sec: 60 },
        { id: "s3",  label: "SET 3 · 30", sec: 60 },
        { id: "s4",  label: "SET 4 · 30", sec: 60 },
        { id: "log", label: "LOG",        sec: 30 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 110, label: "STATIONARY" }] },
    },
    {
      id: "killer-crossover",
      name: "KILLER CROSSOVER · CHAIR",
      focus: "ballhandling",
      subTags: ["combo","cone","attack"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 8, duration: 10, restSec: 30,
      ball: "required", space: "wing",
      description: "Attack the chair, hard crossover, blow by. 8 reps each side.",
      benefit: "FIRST-STEP BLOW-BY",
      coachPoints: ["LOW STANCE","SELL THE FIRST DIRECTION","HARD CROSS, KNEE-LEVEL","ACCELERATE OUT"],
      phases: [
        { id: "L1", label: "L · 8", sec: 80 },
        { id: "R1", label: "R · 8", sec: 80 },
        { id: "L2", label: "L · 8", sec: 80 },
        { id: "R2", label: "R · 8", sec: 80 },
        { id: "log",label: "LOG",   sec: 30 },
      ],
      pattern: { kind: "cones", spots: [{ x: 140, y: 110, label: "CHAIR" }] },
    },
    {
      id: "in-out-go",
      name: "IN-OUT-GO COMBO",
      focus: "ballhandling",
      subTags: ["combo","attack","first-step"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 6, duration: 10, restSec: 30,
      ball: "required", space: "wing",
      description: "In-out, attack the line, finish or kick. 6 reps each side.",
      benefit: "MORE OPTIONS OFF THE BOUNCE",
      coachPoints: ["KEEP IT TIGHT","SELL THE IN, EXPLODE THE GO","SHOULDERS LEVEL","NO HEAD-FAKE NEEDED"],
      phases: [
        { id: "L1", label: "L · 6", sec: 90 },
        { id: "R1", label: "R · 6", sec: 90 },
        { id: "L2", label: "L · 6", sec: 90 },
        { id: "R2", label: "R · 6", sec: 90 },
        { id: "log",label: "LOG",   sec: 30 },
      ],
      pattern: { kind: "cones", spots: [{ x: 140, y: 110, label: "WING" }] },
    },
    {
      id: "between-legs-cross",
      name: "BTW LEGS · CROSS · BTW",
      focus: "ballhandling",
      subTags: ["combo","stationary","tight"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 5, reps: 20, duration: 7, restSec: 20,
      ball: "required", space: "spot",
      description: "Sequence: between legs → cross → between legs. Tight, fast, low.",
      benefit: "TIGHT-SPACE HANDLE",
      coachPoints: ["BALLS BELOW THE KNEE","STAY LOW","COUNT IN YOUR HEAD","30 SEC BREAKS"],
      phases: [
        { id: "s1", label: "SET 1", sec: 60 },
        { id: "s2", label: "SET 2", sec: 60 },
        { id: "s3", label: "SET 3", sec: 60 },
        { id: "s4", label: "SET 4", sec: 60 },
        { id: "s5", label: "SET 5", sec: 60 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 110, label: "STATIONARY" }] },
    },
    {
      id: "full-court-zigzag",
      name: "FULL-COURT ZIG-ZAG",
      focus: "ballhandling",
      subTags: ["full-court","conditioning","change-direction"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 1, duration: 8, restSec: 45,
      ball: "required", space: "full",
      description: "Full court, zig-zag every 3 dribbles. Maintain pace.",
      benefit: "GAME-SPEED HANDLE WITH FATIGUE",
      coachPoints: ["EYES UP","ATTACK ANGLES","CHANGE PACE EVERY ZIG","FINISH AT RIM"],
      phases: [
        { id: "r1",  label: "RUN 1",      sec: 90 },
        { id: "rest1",label: "REST",       sec: 45 },
        { id: "r2",  label: "RUN 2",      sec: 90 },
        { id: "rest2",label: "REST",       sec: 45 },
        { id: "r3",  label: "RUN 3",      sec: 90 },
        { id: "rest3",label: "REST",       sec: 45 },
        { id: "r4",  label: "RUN 4",      sec: 90 },
        { id: "log", label: "LOG",         sec: 30 },
      ],
      pattern: { kind: "fullcourt-zigzag" },
    },
    {
      id: "tennis-ball-react",
      name: "TENNIS BALL REACTION",
      focus: "ballhandling",
      subTags: ["reaction","stationary","focus"],
      targetZones: [],
      difficulty: "advanced", level: 3,
      sets: 4, reps: 30, duration: 8, restSec: 25,
      ball: "required", space: "spot",
      description: "Dribble + tennis ball flips. Train the eyes-up handle.",
      benefit: "EYES-UP DRIBBLING",
      coachPoints: ["STAY LOW","NEVER LOOK AT THE BALL","REACT BEFORE IT BOUNCES","ADD A SECOND BALL LATER"],
      phases: [
        { id: "s1", label: "SET 1", sec: 60 },
        { id: "s2", label: "SET 2", sec: 60 },
        { id: "s3", label: "SET 3", sec: 60 },
        { id: "s4", label: "SET 4", sec: 60 },
        { id: "log",label: "LOG",   sec: 30 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 110, label: "PARTNER" }] },
    },
    {
      id: "snake-cone",
      name: "SNAKE · 5 CONES",
      focus: "ballhandling",
      subTags: ["cones","control","change-direction"],
      targetZones: [],
      difficulty: "beginner", level: 1,
      sets: 4, reps: 1, duration: 6, restSec: 25,
      ball: "required", space: "wing",
      description: "Five cones, snake through with crossovers. Both hands, both directions.",
      benefit: "FUNDAMENTAL CHANGE-OF-DIRECTION",
      coachPoints: ["CROSS AT EACH CONE","STAY IN STANCE","DON'T STAND UP","FINISH BOTH WAYS"],
      phases: [
        { id: "r1", label: "RIGHT-LED", sec: 70 },
        { id: "l1", label: "LEFT-LED",  sec: 70 },
        { id: "r2", label: "BTW LEGS",  sec: 70 },
        { id: "l2", label: "BEHIND BACK",sec: 70 },
      ],
      pattern: { kind: "cones", spots: [
        { x:  56, y: 100, label: "C1" },
        { x:  98, y:  90, label: "C2" },
        { x: 140, y: 110, label: "C3" },
        { x: 182, y:  90, label: "C4" },
        { x: 224, y: 100, label: "C5" },
      ]},
    },
    {
      id: "pick-pocket-resist",
      name: "PICK-POCKET RESIST",
      focus: "ballhandling",
      subTags: ["partner","pressure","protection"],
      targetZones: [],
      difficulty: "advanced", level: 3,
      sets: 5, reps: 1, duration: 10, restSec: 30,
      ball: "required", space: "wing",
      description: "Partner reaches; you protect. 30s rounds. Stay alive.",
      benefit: "PROTECTS THE BALL UNDER PRESSURE",
      coachPoints: ["WIDE STANCE","OFF-ARM AS A SHIELD","NEVER GO HIGH","PIVOT — DON'T DRIBBLE OUT"],
      phases: [
        { id: "r1", label: "ROUND 1 · 30s", sec: 30 },
        { id: "rest1",label:"REST",          sec: 30 },
        { id: "r2", label: "ROUND 2 · 30s", sec: 30 },
        { id: "rest2",label:"REST",          sec: 30 },
        { id: "r3", label: "ROUND 3 · 30s", sec: 30 },
        { id: "rest3",label:"REST",          sec: 30 },
        { id: "r4", label: "ROUND 4 · 30s", sec: 30 },
        { id: "rest4",label:"REST",          sec: 30 },
        { id: "r5", label: "ROUND 5 · 30s", sec: 30 },
        { id: "log",label: "LOG",            sec: 60 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 110, label: "PARTNER" }] },
    },
    {
      id: "spider-dribble",
      name: "SPIDER DRIBBLE",
      focus: "ballhandling",
      subTags: ["fundamental","stationary","ambidextrous"],
      targetZones: [],
      difficulty: "beginner", level: 1,
      sets: 4, reps: 30, duration: 5, restSec: 15,
      ball: "required", space: "spot",
      description: "L,R in front; L,R behind. Develop both hands at low height.",
      benefit: "AMBIDEXTROUS CONTROL",
      coachPoints: ["BALLS BELOW KNEE","TEMPO STEADY","NEVER LET ONE STOP","COUNT TO 30"],
      phases: [
        { id: "s1", label: "SET 1", sec: 50 },
        { id: "s2", label: "SET 2", sec: 50 },
        { id: "s3", label: "SET 3", sec: 50 },
        { id: "s4", label: "SET 4", sec: 50 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 110, label: "STATIONARY" }] },
    },

    // ──────────────────────────────────────────────── DEFENSE · 8 drills
    {
      id: "def-slides",
      name: "DEFENSIVE SLIDES · 4-CORNER",
      focus: "defense",
      subTags: ["footwork","conditioning","stance"],
      targetZones: [],
      difficulty: "beginner", level: 1,
      sets: 4, reps: 4, duration: 9, restSec: 30,
      ball: "none", space: "key",
      description: "Four corners of the paint. Slide between them, one trip = 4 slides.",
      benefit: "BUILDS THE STANCE & LATERAL ENGINE",
      coachPoints: ["WIDE STANCE","NEVER CROSS YOUR FEET","LOW HIPS","ARM-BAR ENGAGED"],
      phases: [
        { id: "s1", label: "SET 1 · 4",  sec: 90 },
        { id: "rest1", label: "REST",    sec: 30 },
        { id: "s2", label: "SET 2 · 4",  sec: 90 },
        { id: "rest2", label: "REST",    sec: 30 },
        { id: "s3", label: "SET 3 · 4",  sec: 90 },
        { id: "rest3", label: "REST",    sec: 30 },
        { id: "s4", label: "SET 4 · 4",  sec: 90 },
        { id: "log", label: "LOG",        sec: 30 },
      ],
      pattern: { kind: "slide-box" },
    },
    {
      id: "closeout-recover",
      name: "CLOSEOUT · RECOVER",
      focus: "defense",
      subTags: ["closeout","perimeter","recovery"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 6, duration: 11, restSec: 30,
      ball: "optional", space: "wing",
      description: "Sprint from paint to wing, choppy steps in last 3 — high hands. Recover to next.",
      benefit: "PERIMETER DEFENSE FUNDAMENTAL",
      coachPoints: ["SPRINT 80% — CHOP THE LAST 3","HIGH HANDS, MIRROR THE BALL","BREAK DOWN — DON'T FLY BY","RECOVER ON BALANCE"],
      phases: [
        { id: "s1", label: "SET 1 · 6", sec: 100 },
        { id: "s2", label: "SET 2 · 6", sec: 100 },
        { id: "rest", label: "REST",    sec: 60 },
        { id: "s3", label: "SET 3 · 6", sec: 100 },
        { id: "s4", label: "SET 4 · 6", sec: 100 },
        { id: "log",label: "LOG",        sec: 30 },
      ],
      pattern: { kind: "closeout" },
    },
    {
      id: "shell-rotation",
      name: "SHELL · 4-MAN ROTATION",
      focus: "defense",
      subTags: ["team","help","rotation"],
      targetZones: [],
      difficulty: "advanced", level: 3,
      sets: 4, reps: 8, duration: 14, restSec: 35,
      ball: "required", space: "half-court",
      description: "Four-man shell. Walk through rotations, then run. Help-the-helper reps.",
      benefit: "TEAM-DEFENSE DECISION-MAKING",
      coachPoints: ["TALK ON EVERY PASS","ONE PASS AWAY = DENY","TWO PASSES AWAY = HELP","STUNT, RECOVER"],
      phases: [
        { id: "walk", label: "WALK-THRU", sec: 180 },
        { id: "s1",   label: "SET 1 · 8 ROT", sec: 130 },
        { id: "s2",   label: "SET 2 · 8 ROT", sec: 130 },
        { id: "rest", label: "REST",          sec: 60 },
        { id: "s3",   label: "SET 3 · 8 ROT", sec: 130 },
        { id: "s4",   label: "SET 4 · 8 ROT", sec: 130 },
      ],
      pattern: { kind: "shell" },
    },
    {
      id: "deny-1-2",
      name: "1-2 PASS DENIAL",
      focus: "defense",
      subTags: ["deny","off-ball","positioning"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 6, duration: 10, restSec: 30,
      ball: "required", space: "wing",
      description: "Deny the wing pass. Close-the-gap, hand in the lane, eyes ball-and-man.",
      benefit: "OFF-BALL DEFENSE",
      coachPoints: ["BALL-YOU-MAN TRIANGLE","HAND IN PASSING LANE","SEE BOTH","FORCE THE BACK-CUT"],
      phases: [
        { id: "s1",  label: "SET 1 · 6", sec: 100 },
        { id: "s2",  label: "SET 2 · 6", sec: 100 },
        { id: "rest",label: "REST",       sec: 60 },
        { id: "s3",  label: "SET 3 · 6", sec: 100 },
        { id: "s4",  label: "SET 4 · 6", sec: 100 },
        { id: "log", label: "LOG",        sec: 30 },
      ],
      pattern: { kind: "shuttle", spots: [{ x: 72, y: 60, label: "DENY" }] },
    },
    {
      id: "box-out-rebound",
      name: "BOX OUT · REBOUND",
      focus: "defense",
      subTags: ["rebound","positioning","contact"],
      targetZones: [],
      difficulty: "beginner", level: 1,
      sets: 4, reps: 6, duration: 8, restSec: 30,
      ball: "required", space: "key",
      description: "Coach shoots, you box out, secure rebound, outlet.",
      benefit: "OWNS THE GLASS",
      coachPoints: ["MAKE CONTACT FIRST","HIP TO HIP, LOW BASE","BALL TO CHIN ON RIP","OUTLET TO SIDELINE"],
      phases: [
        { id: "s1", label: "SET 1 · 6", sec: 80 },
        { id: "s2", label: "SET 2 · 6", sec: 80 },
        { id: "rest",label:"REST",      sec: 60 },
        { id: "s3", label: "SET 3 · 6", sec: 80 },
        { id: "s4", label: "SET 4 · 6", sec: 80 },
      ],
      pattern: { kind: "spot", spots: [
        { x: 105, y: 30, label: "L BLOCK" },
        { x: 175, y: 30, label: "R BLOCK" },
      ]},
    },
    {
      id: "1v1-mirror",
      name: "1V1 · MIRROR DRIBBLE",
      focus: "defense",
      subTags: ["1v1","footwork","reaction"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 30, duration: 8, restSec: 30,
      ball: "required", space: "wing",
      description: "Partner dribbles — you mirror without crossing your feet. 30 seconds per round.",
      benefit: "TRAINS REACTIVE FEET",
      coachPoints: ["MIRROR THE BALL, NOT THE EYES","STAY LOW","NEVER OVER-COMMIT","RECOVERY > LUNGE"],
      phases: [
        { id: "r1", label: "ROUND 1", sec: 30 },
        { id: "rest1", label: "REST", sec: 30 },
        { id: "r2", label: "ROUND 2", sec: 30 },
        { id: "rest2", label: "REST", sec: 30 },
        { id: "r3", label: "ROUND 3", sec: 30 },
        { id: "rest3", label: "REST", sec: 30 },
        { id: "r4", label: "ROUND 4", sec: 30 },
      ],
      pattern: { kind: "spot", spots: [{ x: 72, y: 80, label: "WING 1V1" }] },
    },
    {
      id: "help-recover-x",
      name: "HELP & RECOVER · X-OUT",
      focus: "defense",
      subTags: ["help","recover","conditioning"],
      targetZones: [],
      difficulty: "advanced", level: 3,
      sets: 4, reps: 6, duration: 12, restSec: 35,
      ball: "optional", space: "half-court",
      description: "Help on a baseline drive, X-out to the corner shooter, recover. 6 reps each set.",
      benefit: "ELITE TEAM-DEFENSE INSTINCT",
      coachPoints: ["TIMING > SPEED","HANDS UP THROUGH THE X","CHEST INTO THE OFFENSIVE PLAYER","TALK BEFORE YOU SLIDE"],
      phases: [
        { id: "s1", label: "SET 1 · 6", sec: 110 },
        { id: "s2", label: "SET 2 · 6", sec: 110 },
        { id: "rest", label: "REST",   sec: 60 },
        { id: "s3", label: "SET 3 · 6", sec: 110 },
        { id: "s4", label: "SET 4 · 6", sec: 110 },
        { id: "log",label:"LOG",        sec: 30 },
      ],
      pattern: { kind: "x-out" },
    },
    {
      id: "fullcourt-press",
      name: "FULL-COURT PRESS · D",
      focus: "defense",
      subTags: ["press","conditioning","reaction"],
      targetZones: [],
      difficulty: "advanced", level: 3,
      sets: 3, reps: 4, duration: 12, restSec: 60,
      ball: "required", space: "full",
      description: "Trap, deny, recover — full court. Three sets, four trips.",
      benefit: "BREAKS THE OPPONENT'S TEMPO",
      coachPoints: ["TURN THE BALL TWICE","NEVER GIVE UP THE MIDDLE","RECOVER ON THE PASS, NOT THE CATCH","TALK NON-STOP"],
      phases: [
        { id: "s1", label: "SET 1 · 4 TRIPS", sec: 180 },
        { id: "rest1", label: "REST",         sec: 90 },
        { id: "s2", label: "SET 2 · 4 TRIPS", sec: 180 },
        { id: "rest2", label: "REST",         sec: 90 },
        { id: "s3", label: "SET 3 · 4 TRIPS", sec: 180 },
        { id: "log",label: "LOG",              sec: 30 },
      ],
      pattern: { kind: "fullcourt-press" },
    },

    // ──────────────────────────────────────────────── ATHLETICISM · 5
    {
      id: "approach-jump",
      name: "APPROACH JUMP · 3-STEP",
      focus: "athleticism",
      subTags: ["vertical","plyometric","explosive"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 4, reps: 6, duration: 10, restSec: 60,
      ball: "optional", space: "key",
      description: "Three-step approach into a max-vertical. Touch high target. Quality over quantity.",
      benefit: "BUILDS GAME-SPEED VERTICAL",
      coachPoints: ["LOAD THE PENULTIMATE STEP","ARM SWING BIG","TUCK ON LANDING","FULL REST BETWEEN REPS"],
      phases: [
        { id: "s1", label: "SET 1 · 6", sec: 100 },
        { id: "rest1", label: "REST", sec: 80 },
        { id: "s2", label: "SET 2 · 6", sec: 100 },
        { id: "rest2", label: "REST", sec: 80 },
        { id: "s3", label: "SET 3 · 6", sec: 100 },
        { id: "rest3", label: "REST", sec: 80 },
        { id: "s4", label: "SET 4 · 6", sec: 100 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 60, label: "JUMP" }] },
    },
    {
      id: "lateral-bound",
      name: "LATERAL BOUNDS",
      focus: "athleticism",
      subTags: ["lateral","plyometric","stability"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 3, reps: 10, duration: 8, restSec: 60,
      ball: "none", space: "spot",
      description: "Single-leg lateral bound. Stick the landing — count three before next.",
      benefit: "TRAINS LATERAL POWER",
      coachPoints: ["STICK THE LANDING","KNEE OVER TOE","ARM SWING LEADS","FULL HIP EXTENSION"],
      phases: [
        { id: "s1", label: "SET 1 · 10", sec: 90 },
        { id: "rest1", label: "REST", sec: 80 },
        { id: "s2", label: "SET 2 · 10", sec: 90 },
        { id: "rest2", label: "REST", sec: 80 },
        { id: "s3", label: "SET 3 · 10", sec: 90 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 110, label: "BOUND" }] },
    },
    {
      id: "ladder-icky",
      name: "AGILITY LADDER · ICKY",
      focus: "athleticism",
      subTags: ["agility","footwork","ladder"],
      targetZones: [],
      difficulty: "beginner", level: 1,
      sets: 4, reps: 4, duration: 7, restSec: 25,
      ball: "none", space: "spot",
      description: "Icky shuffle through agility ladder. Quick feet, head up.",
      benefit: "WIRES IN QUICK FEET",
      coachPoints: ["BALLS OF THE FEET","HEAD UP","SAME RHYTHM EACH RUN","FAST > FANCY"],
      phases: [
        { id: "s1", label: "SET 1 · 4 PASSES", sec: 70 },
        { id: "s2", label: "SET 2 · 4 PASSES", sec: 70 },
        { id: "s3", label: "SET 3 · 4 PASSES", sec: 70 },
        { id: "s4", label: "SET 4 · 4 PASSES", sec: 70 },
      ],
      pattern: { kind: "ladder" },
    },
    {
      id: "suicides",
      name: "SUICIDES · LINE-LINE",
      focus: "athleticism",
      subTags: ["conditioning","sprint","mental"],
      targetZones: [],
      difficulty: "advanced", level: 3,
      sets: 5, reps: 1, duration: 14, restSec: 75,
      ball: "none", space: "full",
      description: "FT, half-court, far FT, baseline. Five sets. Stop the watch only when your hand touches.",
      benefit: "GAME-CONDITION CONDITIONING",
      coachPoints: ["TOUCH WITH YOUR HAND","TURN ON THE OUTSIDE FOOT","STAY LOW THROUGH THE TURN","DON'T QUIT — EVER"],
      phases: [
        { id: "s1",   label: "SUICIDE 1", sec: 35 },
        { id: "rest1",label: "REST",      sec: 75 },
        { id: "s2",   label: "SUICIDE 2", sec: 35 },
        { id: "rest2",label: "REST",      sec: 75 },
        { id: "s3",   label: "SUICIDE 3", sec: 35 },
        { id: "rest3",label: "REST",      sec: 75 },
        { id: "s4",   label: "SUICIDE 4", sec: 35 },
        { id: "rest4",label: "REST",      sec: 75 },
        { id: "s5",   label: "SUICIDE 5", sec: 35 },
        { id: "log",  label: "LOG TIMES", sec: 60 },
      ],
      pattern: { kind: "fullcourt-suicide" },
    },
    {
      id: "depth-drop",
      name: "DEPTH DROP · STICK",
      focus: "athleticism",
      subTags: ["plyometric","landing","control"],
      targetZones: [],
      difficulty: "intermediate", level: 2,
      sets: 3, reps: 8, duration: 8, restSec: 60,
      ball: "none", space: "spot",
      description: "Drop from a 12-inch box, stick the landing for 3 seconds. No bounce.",
      benefit: "TEACHES THE LAND",
      coachPoints: ["KNEES STACKED","HIPS BACK","STICK 3 SEC","RESET BETWEEN REPS"],
      phases: [
        { id: "s1", label: "SET 1 · 8", sec: 110 },
        { id: "rest1", label: "REST", sec: 80 },
        { id: "s2", label: "SET 2 · 8", sec: 110 },
        { id: "rest2", label: "REST", sec: 80 },
        { id: "s3", label: "SET 3 · 8", sec: 110 },
      ],
      pattern: { kind: "spot", spots: [{ x: 140, y: 110, label: "STICK" }] },
    },
  ];

  // ── Decorate every drill with stats + leaderboard ────────────────────────
  DRILLS.forEach(d => {
    const ranges = {
      maxSessions: d.difficulty === "beginner" ? 30 : d.difficulty === "intermediate" ? 20 : 14,
      repsAvg: d.sets * d.reps,
      p50Base: d.difficulty === "beginner" ? 60 : d.difficulty === "intermediate" ? 48 : 36,
      levelMax: d.difficulty === "beginner" ? 1 : d.difficulty === "intermediate" ? 2 : 3,
    };
    d.stats = makeStats(d.id, ranges);
    d.leaderboard = makeLeaderboard(d.id, d.stats.p50Fg, 5);
    d.totalDoneByPeers = 200 + Math.floor(seed("peers-" + d.id)() * 4800);
  });

  // ── Indices ──────────────────────────────────────────────────────────────
  const BY_ID = Object.fromEntries(DRILLS.map(d => [d.id, d]));

  function byFocus(focus) { return DRILLS.filter(d => d.focus === focus); }
  function byDifficulty(diff) { return DRILLS.filter(d => d.difficulty === diff); }
  function byZone(zoneId) { return DRILLS.filter(d => d.targetZones.includes(zoneId)); }

  function search(q) {
    if (!q) return DRILLS;
    const lc = q.toLowerCase();
    return DRILLS.filter(d =>
      d.name.toLowerCase().includes(lc) ||
      d.subTags.some(t => t.includes(lc)) ||
      d.focus.includes(lc) ||
      d.description.toLowerCase().includes(lc)
    );
  }

  // For You: rank drills by how strongly they hit the user's cold zones,
  // weighted by zone deficit (50 - zoneFg), tie-broken by mastery level
  // (lower mastery = better recommendation, more headroom).
  function recommendForUser(coldZones /* [{id, fg, delta}] */, limit = 3) {
    if (!coldZones || coldZones.length === 0) return DRILLS.slice(0, limit);
    const deficits = {};
    coldZones.forEach(z => {
      const def = Math.max(1, 50 - z.fg);
      deficits[z.id] = def;
      // also propagate to aliases — mid covers ml/mr/topmid
      if (z.id === "mid") {
        deficits.ml = def; deficits.mr = def; deficits.topmid = def;
      }
    });
    const scored = DRILLS.map(d => {
      const hit = d.targetZones.reduce((acc, zid) => acc + (deficits[zid] || 0), 0);
      const masteryHeadroom = (3 - d.stats.mastery.level) * 5;
      return { drill: d, score: hit + masteryHeadroom };
    }).filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.drill);
  }

  // Suggested practice plan based on cold zones — warmup + 2 focus drills + cooldown.
  function suggestPlan(coldZones) {
    const warmup = BY_ID["warmup-form-2-min"] || DRILLS[0];
    const focus = recommendForUser(coldZones, 2);
    const cooldown = BY_ID["cooldown-form-3"] || DRILLS[0];
    const plan = [warmup, ...focus, cooldown];
    return {
      drills: plan,
      totalMin: plan.reduce((a, d) => a + d.duration, 0),
      label: "RECOVERY PLAN · 7D",
    };
  }

  window.DrillEngine = {
    DRILLS,
    BY_ID,
    byFocus,
    byDifficulty,
    byZone,
    search,
    recommendForUser,
    suggestPlan,
    FOCUSES: ["shooting","ballhandling","defense","athleticism"],
    DIFFICULTIES: ["beginner","intermediate","advanced"],
  };
})();
