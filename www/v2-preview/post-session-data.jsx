// post-session-data.jsx
// All scripted data for the recap surface — keeps the App component thin.
// One "session" object is the unit of truth: shots, drills, deltas, zone
// breakdowns. Multiple sessions are exposed via Tweaks so the user can
// flip between a hot night and a cold one without us hand-rebuilding.
//
// SHOT COORDINATES match post-session-shotchart.jsx (natural SVG, y down):
//   • viewBox 0 0 190 130, baseline at y=0 (rim at top), half-court line at y=130
//   • Rim center (95, 0), 3PT arc center (95,0) radius 85, corners at y=14
//   • Paint x∈[70,120] y∈[0,42]
//   • Generated to fall strictly within zones (no shot lives outside its declared zone).

const POST_SESSIONS = {
  hot: {
    label: "Heating Up",
    fg: 67,
    fgDelta: +9,
    made: 22,
    att: 33,
    durationMin: 24,
    durationSec: 18,
    streakBest: 6,
    pps: 1.42,
    ppsDelta: +0.18,
    verdict: "Right wing was unconscious.",
    verdictTone: "make",
    shots: [
      // RIGHT WING 3 — 7/9
      { x: 183, y:  72, made: true,  zone: "rw" },
      { x: 182, y:  44, made: false, zone: "rw" },
      { x: 171, y:  64, made: true,  zone: "rw" },
      { x: 146, y:  69, made: true,  zone: "rw" },
      { x: 185, y:  66, made: true,  zone: "rw" },
      { x: 186, y:  62, made: false, zone: "rw" },
      { x: 180, y:  63, made: true,  zone: "rw" },
      { x: 173, y:  37, made: true,  zone: "rw" },
      { x: 168, y:  55, made: true,  zone: "rw" },
      // TOP OF KEY 3 — 3/4
      { x:  73, y: 117, made: true,  zone: "top" },
      { x:  92, y:  91, made: false, zone: "top" },
      { x: 113, y:  93, made: true,  zone: "top" },
      { x: 109, y:  87, made: true,  zone: "top" },
      // LEFT WING 3 — 2/4
      { x:  13, y:  31, made: false, zone: "lw" },
      { x:  22, y:  66, made: true,  zone: "lw" },
      { x:  29, y:  65, made: false, zone: "lw" },
      { x:  16, y:  43, made: true,  zone: "lw" },
      // LEFT CORNER 3 — 2/2
      { x:   3, y:  12, made: true,  zone: "lc" },
      { x:   7, y:   8, made: true,  zone: "lc" },
      // RIGHT CORNER 3 — 1/2
      { x: 183, y:  10, made: false, zone: "rc" },
      { x: 184, y:   5, made: true,  zone: "rc" },
      // MID-RANGE — 2/5 (1/3 left + 1/2 right)
      { x:  55, y:  18, made: false, zone: "ml" },
      { x:  45, y:  30, made: true, zone: "ml" },
      { x:  44, y:   2, made: false, zone: "ml" },
      { x: 137, y:  12, made: true,  zone: "mr" },
      { x: 156, y:  15, made: false, zone: "mr" },
      // PAINT — 5/7
      { x:  83, y:  11, made: true,  zone: "pnt" },
      { x:  81, y:  20, made: true,  zone: "pnt" },
      { x:  89, y:  16, made: true,  zone: "pnt" },
      { x:  90, y:  36, made: true,  zone: "pnt" },
      { x:  81, y:  32, made: true,  zone: "pnt" },
      { x:  87, y:   8, made: false, zone: "pnt" },
      { x:  78, y:  35, made: false, zone: "pnt" },
    ],
    drills: [
      { id: "d1", name: "Corner 3 lock-in",     reps: 10, made: 7, fg: 70, hot: true  },
      { id: "d2", name: "Catch & shoot · wing", reps: 8,  made: 6, fg: 75, hot: true  },
      { id: "d3", name: "Pull-up mid-range",    reps: 8,  made: 3, fg: 38, hot: false },
      { id: "d4", name: "Free throw rhythm",    reps: 7,  made: 6, fg: 86, hot: true  },
    ],
    zoneBreakdown: [
      { id: "lc",  name: "L Corner 3", made: 2,  att: 2,  delta: +20 },
      { id: "lw",  name: "L Wing 3",   made: 2,  att: 4,  delta: -8  },
      { id: "top", name: "Top 3",      made: 3,  att: 4,  delta: +5  },
      { id: "rw",  name: "R Wing 3",   made: 7,  att: 9,  delta: +28 },
      { id: "rc",  name: "R Corner 3", made: 1,  att: 2,  delta: +0  },
      { id: "mid", name: "Mid-range",  made: 2,  att: 5,  delta: -12 },
      { id: "pnt", name: "Paint",      made: 5,  att: 7,  delta: +3  },
    ],
  },

  cold: {
    label: "Cold Night",
    fg: 31,
    fgDelta: -12,
    made: 9,
    att: 29,
    durationMin: 21,
    durationSec: 4,
    streakBest: 2,
    pps: 0.71,
    ppsDelta: -0.34,
    verdict: "Mid-range never found a rhythm.",
    verdictTone: "miss",
    shots: [
      // TOP OF KEY 3 — 1/4
      { x:  73, y: 122, made: false, zone: "top" },
      { x: 100, y:  75, made: false, zone: "top" },
      { x:  85, y:  90, made: true, zone: "top" },
      { x: 109, y: 107, made: false, zone: "top" },
      // LEFT WING 3 — 1/4
      { x:  13, y:  36, made: false, zone: "lw" },
      { x:   6, y:  68, made: false, zone: "lw" },
      { x:   3, y:  18, made: true,  zone: "lw" },
      { x:  28, y:  61, made: false, zone: "lw" },
      // RIGHT WING 3 — 1/4
      { x: 183, y:  18, made: false, zone: "rw" },
      { x: 170, y:  62, made: false, zone: "rw" },
      { x: 180, y:  47, made: true,  zone: "rw" },
      { x: 154, y:  70, made: false, zone: "rw" },
      // LEFT CORNER 3 — 1/1
      { x:   3, y:  13, made: true,  zone: "lc" },
      // RIGHT CORNER 3 — 0/2
      { x: 183, y:  11, made: false, zone: "rc" },
      { x: 182, y:   6, made: false, zone: "rc" },
      // MID-RANGE — 1/7 (1/4 left + 0/3 right)
      { x:  60, y:  25, made: false, zone: "ml" },
      { x:  58, y:   5, made: true,  zone: "ml" },
      { x:  51, y:  18, made: false, zone: "ml" },
      { x:  68, y:  37, made: false, zone: "ml" },
      { x: 137, y:  15, made: false, zone: "mr" },
      { x: 138, y:  16, made: false, zone: "mr" },
      { x: 124, y:  17, made: false, zone: "mr" },
      // PAINT — 3/6
      { x:  83, y:  14, made: true,  zone: "pnt" },
      { x: 113, y:  21, made: true,  zone: "pnt" },
      { x:  74, y:   7, made: true,  zone: "pnt" },
      { x: 110, y:  33, made: false, zone: "pnt" },
      { x: 104, y:  34, made: false, zone: "pnt" },
      { x: 108, y:  33, made: false, zone: "pnt" },
    ],
    drills: [
      { id: "d1", name: "Corner 3 lock-in",     reps: 8, made: 1, fg: 13, hot: false },
      { id: "d2", name: "Catch & shoot · wing", reps: 8, made: 2, fg: 25, hot: false },
      { id: "d3", name: "Pull-up mid-range",    reps: 7, made: 1, fg: 14, hot: false },
      { id: "d4", name: "Free throw rhythm",    reps: 6, made: 5, fg: 83, hot: true  },
    ],
    zoneBreakdown: [
      { id: "lc",  name: "L Corner 3", made: 1, att: 1, delta: +0  },
      { id: "lw",  name: "L Wing 3",   made: 1, att: 4, delta: -22 },
      { id: "top", name: "Top 3",      made: 1, att: 4, delta: -18 },
      { id: "rw",  name: "R Wing 3",   made: 1, att: 4, delta: -32 },
      { id: "rc",  name: "R Corner 3", made: 0, att: 2, delta: -40 },
      { id: "mid", name: "Mid-range",  made: 1, att: 7, delta: -28 },
      { id: "pnt", name: "Paint",      made: 3, att: 6, delta: -10 },
    ],
  },
};

window.POST_SESSIONS = POST_SESSIONS;
