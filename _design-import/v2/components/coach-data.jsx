// coach-data.jsx — fixture data for Coach tab

window.COACH_INSIGHT = {
  date: "WEEK OF MAY 4",
  meta: "Based on 3 sessions this week",
  // Verdict — italic Anton headline, the coach's voice. <em> = accent emphasis.
  verdict: "Your mid-range is on <em>fire</em> — but you're hiding from the three.",
  signature: "C. WHITFIELD · HEAD COACH AI",

  paragraphs: [
    {
      kind: "strength",
      // <strong> = purple accent, <em> = secondary italic
      html: "You've been attacking the rim more this week, and it's working — your <strong>FG% jumped to 58%</strong> from 51%, the best stretch you've had this month. The footwork on those drives looks cleaner. Keep going.",
    },
    {
      kind: "work",
      html: "But here's the thing — you're <strong>shooting fewer threes</strong>. Catch-and-shoot percentage dropped <strong>8%</strong> because you're hesitating on open looks. I see you pumping when you should be pulling. <em>The shot you don't take is always 0%.</em>",
    },
    {
      kind: "work",
      html: "Free throws are still inconsistent. <strong>72%</strong> isn't where a guard with your touch should live. Five minutes of routine work before every session — that's the floor, not the ceiling.",
    },
  ],

  numbers: [
    { id: "fg",  lbl: "FG%",       num: "58", suf: "%", delta: "+7",   dir: "up"   },
    { id: "3pt", lbl: "3PT%",      num: "31", suf: "%", delta: "-8",   dir: "down" },
    { id: "ses", lbl: "Sessions",  num: "3",  suf: "",  delta: "+1",   dir: "up"   },
    { id: "str", lbl: "Streak",    num: "12", suf: "D", delta: "PR",   dir: "up"   },
  ],

  drills: [
    {
      id: "spotup",
      name: "Catch & Release 5x5",
      duration: "12 MIN",
      diff: 2,
      diffLbl: "Mid",
      why: "Kill the spot-up hesitation.",
    },
    {
      id: "ft",
      name: "Free Throw Routine",
      duration: "8 MIN",
      diff: 1,
      diffLbl: "Easy",
      why: "Get that 72% to 80% by month-end.",
    },
    {
      id: "cnc",
      name: "Closeout 3 Series",
      duration: "15 MIN",
      diff: 3,
      diffLbl: "Hard",
      why: "Train pulling the trigger under pressure.",
    },
  ],

  trend: {
    score: 78,
    delta: "+6",
    dir: "up",
    label: "TRENDING UP",
    weeks: [
      { lbl: "W1", val: 64 },
      { lbl: "W2", val: 69 },
      { lbl: "W3", val: 72 },
      { lbl: "W4", val: 78 },
    ],
  },
};

// History fixture
window.COACH_HISTORY = [
  {
    id: "w-may-4",
    date: "MAY 4 · WEEK 18",
    verdict: "Your mid-range is on fire — but you're hiding from the three.",
    score: 78,
    body: [
      "You've been attacking the rim more this week — <strong>FG% jumped to 58%</strong>. But catch-and-shoot dropped 8%. Hesitation is killing you.",
      "Recommended: Catch &amp; Release 5x5, Free Throw Routine.",
    ],
  },
  {
    id: "w-apr-27",
    date: "APR 27 · WEEK 17",
    verdict: "Defense looked sharper. Now make them pay on offense.",
    score: 72,
    body: [
      "Your closeouts were the cleanest they've been all month. Two steals in transition stood out.",
      "But your assist-to-turnover dipped to 1.4. Slow down on the pick &amp; roll reads.",
    ],
  },
  {
    id: "w-apr-20",
    date: "APR 20 · WEEK 16",
    verdict: "You're moving better without the ball. Keep cutting.",
    score: 69,
    body: [
      "Three back-cuts for layups in Tuesday's session — that's the version of you I want.",
      "Conditioning on the back end of sessions is fading. Add a 10-minute cardio finisher.",
    ],
  },
  {
    id: "w-apr-13",
    date: "APR 13 · WEEK 15",
    verdict: "Slow start, strong finish. Don't wait until the 4th to wake up.",
    score: 64,
    body: [
      "First half FG% was 38%. Second half: 64%. The version of you in the second half is the floor.",
      "Pre-session warm-up needs work — get your 100 shots in before scrimmage.",
    ],
  },
];

window.COACH_SKILLS = [
  { id: "shoot",  lbl: "Shooting",     val: 7, hintAt: { 1: "Need work", 5: "Solid", 8: "Real strength", 10: "Elite" }, icon: "Shoot"   },
  { id: "handle", lbl: "Ball Handling", val: 6, hintAt: { 1: "Need work", 5: "Solid", 8: "Real strength", 10: "Elite" }, icon: "Handle"  },
  { id: "def",    lbl: "Defense",       val: 5, hintAt: { 1: "Need work", 5: "Solid", 8: "Real strength", 10: "Elite" }, icon: "Defense" },
  { id: "athl",   lbl: "Athleticism",   val: 8, hintAt: { 1: "Need work", 5: "Solid", 8: "Real strength", 10: "Elite" }, icon: "Athl"    },
];
