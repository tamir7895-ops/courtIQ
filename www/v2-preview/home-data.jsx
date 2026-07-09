// home-data.jsx — Home tab fixture data

window.HOME_DATA = {
  player: {
    name: "Alex",
    fullName: "Alex Rivera",
    position: "Combo Guard",
    avatarSeed: "alex-rivera-1",
    avatarTint: "#2dd4bf", // teal — used for hero gradient bleed
    streak: 12,
    sessionsThisWeek: 3,
    weeklyGoal: 5,
    level: { name: "ALL-STAR", current: 1240, next: 2000, num: 14 },
    // last 7 days, oldest → newest. true = trained, false = rest. Last entry = today.
    streakDays: [true, true, false, true, true, true, true],
  },

  challenge: {
    eyebrow: "DAILY CHALLENGE",
    title: "Complete 3 Shooting Drills",
    reward: "+30 XP · Unlocks streak bonus",
    cta: "START",
    progress: 1,
    total: 3,
    secondsLeft: 14 * 3600 + 23 * 60, // 14h 23m
  },

  coach: {
    verdict: "You're hiding from the three — fix it today.",
    signature: "Coach Whitfield",
    online: true,
  },

  // 2 large primary actions + 2 small secondary
  actionsPrimary: [
    {
      id: "workout",
      label: "Start Workout",
      sub: "Today: Catch & Shoot · 12 min",
      icon: "Play",
      tint: "amber",
    },
    {
      id: "track",
      label: "Track Shots",
      sub: "Launch AI camera",
      icon: "Crosshair",
      tint: "track",
    },
  ],
  actionsSecondary: [
    { id: "coach",   label: "AI Coach",      icon: "Message",    tint: "coach" },
    { id: "drills",  label: "Drill Library", icon: "Basketball", tint: "train" },
  ],

  recentSessions: [
    {
      id: "s1", day: "MON", type: "Shooting Practice",  duration: "45m", fg: 58, dir: "up",
      // shot dots — coords on a 40x30 half-court (scaled later)
      shots: [
        { x: 0.50, y: 0.30, made: true  },
        { x: 0.30, y: 0.55, made: true  },
        { x: 0.72, y: 0.55, made: false },
        { x: 0.20, y: 0.70, made: true  },
        { x: 0.50, y: 0.45, made: true  },
        { x: 0.80, y: 0.72, made: false },
        { x: 0.40, y: 0.62, made: true  },
        { x: 0.62, y: 0.40, made: true  },
        { x: 0.55, y: 0.78, made: true  },
      ],
    },
    {
      id: "s2", day: "WED", type: "Pickup Game", duration: "1h 20m", fg: 47, dir: "down",
      shots: [
        { x: 0.30, y: 0.30, made: false },
        { x: 0.50, y: 0.45, made: true  },
        { x: 0.70, y: 0.30, made: false },
        { x: 0.45, y: 0.62, made: true  },
        { x: 0.18, y: 0.55, made: false },
        { x: 0.78, y: 0.65, made: false },
        { x: 0.55, y: 0.78, made: true  },
        { x: 0.65, y: 0.50, made: true  },
      ],
    },
    {
      id: "s3", day: "FRI", type: "Drill Session", duration: "30m", fg: 64, dir: "up",
      shots: [
        { x: 0.40, y: 0.40, made: true  },
        { x: 0.55, y: 0.55, made: true  },
        { x: 0.30, y: 0.60, made: true  },
        { x: 0.70, y: 0.60, made: false },
        { x: 0.50, y: 0.30, made: true  },
        { x: 0.60, y: 0.72, made: true  },
        { x: 0.25, y: 0.45, made: false },
        { x: 0.75, y: 0.45, made: true  },
      ],
    },
  ],

  skills: [
    { id: "shoot", name: "Shooting",  val: 84, color: "#f5a623" },
    { id: "drib",  name: "Dribbling", val: 71, color: "#4ca3ff" },
    { id: "def",   name: "Defense",   val: 58, color: "#56d364" },
    { id: "iq",    name: "Game IQ",   val: 79, color: "#bc8cff" },
  ],

  // CALENDAR — month of MAY 2026
  calendar: {
    month: "MAY",
    year: 2026,
    today: 4,
    sessions: {
      2: { type: "Shooting", duration: "45m", fg: 58 },
      4: { type: "Pickup",   duration: "1h 20m", fg: 47 },
      6: { type: "Drills",   duration: "30m", fg: 64 },
      9: { type: "Game",     duration: "1h", fg: 52 },
      11:{ type: "Shooting", duration: "40m", fg: 67 },
      14:{ type: "Drills",   duration: "35m", fg: 71 },
      17:{ type: "Pickup",   duration: "1h 30m", fg: 49 },
    },
    firstDay: 5,
    daysInMonth: 31,
  },
};

window.homeGreeting = (hour) => {
  if (hour < 5)  return { word: "GOOD NIGHT",     tag: "Late session?" };
  if (hour < 12) return { word: "GOOD MORNING",   tag: "Perfect conditions to work on that catch-and-shoot." };
  if (hour < 17) return { word: "GOOD AFTERNOON", tag: "Heat of the day — get your shots up before sundown." };
  if (hour < 21) return { word: "GOOD EVENING",   tag: "Prime time. Light a candle, ring the rim." };
  return { word: "GOOD NIGHT", tag: "Form shooting. Quiet hands. Quiet gym." };
};

window.homeFmtCountdown = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};
