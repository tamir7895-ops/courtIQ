// onboarding-data.jsx — Combine intake fixtures

window.OB_DATA = {
  // pre-filled from auth
  defaults: {
    name: "Alex Rivera",
    age: 22,
    heightFt: 6,         // 6'2"
    heightIn: 2,
    weightLb: 185,
    hand: "R",
  },

  positions: [
    { id: "PG", name: "Point Guard",     short: "PG", desc: "Floor general — runs the offense, sets the tempo.",     traits: ["VISION", "HANDLE", "PACE"] },
    { id: "SG", name: "Shooting Guard",  short: "SG", desc: "Three-level scorer — pull-ups, catch-and-shoot, drives.", traits: ["SHOOTING", "MOVEMENT", "FINISHING"] },
    { id: "SF", name: "Small Forward",   short: "SF", desc: "Two-way wing — switchable defender, slasher, glue.",      traits: ["VERSATILE", "WING-D", "CUTS"] },
    { id: "PF", name: "Power Forward",   short: "PF", desc: "Stretch four — face-up game, board crashes, screens.",    traits: ["STRETCH", "REBOUND", "POSTS"] },
    { id: "C",  name: "Center",          short: "C",  desc: "Anchor — rim protection, rebounds, vertical spacing.",     traits: ["RIM", "GLASS", "ROLL"] },
  ],

  quiz: [
    {
      id: "tempo",
      q: "When the play breaks down, you...",
      options: [
        { id: "create",    label: "Create off the dribble"      },
        { id: "shoot",     label: "Pull up from where I am"     },
        { id: "kick",      label: "Find the open shooter"       },
        { id: "attack",    label: "Get to the rim — bully ball" },
      ],
    },
    {
      id: "scoring",
      q: "How do you score most?",
      options: [
        { id: "drive",  label: "Drive to the basket"     },
        { id: "mid",    label: "Mid-range pull-ups"      },
        { id: "three",  label: "Three-point shooting"    },
        { id: "post",   label: "Post up — back-to-basket" },
      ],
    },
    {
      id: "favmove",
      q: "Your money move?",
      options: [
        { id: "step",   label: "Step-back three"          },
        { id: "euro",   label: "Euro to the rack"         },
        { id: "post",   label: "Turnaround in the post"   },
        { id: "catch",  label: "Catch-and-shoot corner 3" },
      ],
    },
    {
      id: "defense",
      q: "What's your defensive style?",
      options: [
        { id: "lock",    label: "On-ball pressure" },
        { id: "help",    label: "Help defense"     },
        { id: "block",   label: "Shot blocker"     },
        { id: "steal",   label: "Steal hunter"     },
      ],
    },
    {
      id: "role",
      q: "In a pickup game, you're the one who...",
      options: [
        { id: "run",   label: "Runs the offense"           },
        { id: "shot",  label: "Takes the big shot"         },
        { id: "guard", label: "Guards the best player"     },
        { id: "board", label: "Crashes the boards"         },
      ],
    },
    {
      id: "weak",
      q: "Your biggest weakness?",
      options: [
        { id: "cond",   label: "Conditioning"      },
        { id: "handle", label: "Ball handling"      },
        { id: "range",  label: "Shooting range"     },
        { id: "def",    label: "Defense"            },
      ],
    },
    {
      id: "train",
      q: "How often do you train per week?",
      options: [
        { id: "1-2",  label: "1–2 sessions"  },
        { id: "3-4",  label: "3–4 sessions"  },
        { id: "5+",   label: "5+ sessions"   },
        { id: "daily", label: "Every day"    },
      ],
    },
    {
      id: "exp",
      q: "What's your experience level?",
      options: [
        { id: "beg",  label: "Beginner"     },
        { id: "int",  label: "Intermediate" },
        { id: "adv",  label: "Advanced"     },
        { id: "comp", label: "Competitive"  },
      ],
    },
  ],

  skills: [
    { id: "shoot",  name: "Shooting",      hint: "Form, range, off-the-dribble" },
    { id: "handle", name: "Ball Handling", hint: "Control, change of pace"      },
    { id: "pass",   name: "Passing",       hint: "Vision, kickouts, lobs"       },
    { id: "def",    name: "Defense",       hint: "On-ball, off-ball, IQ"         },
    { id: "ath",    name: "Athleticism",   hint: "First-step, vertical"         },
    { id: "iq",     name: "Basketball IQ", hint: "Read the game, decisions"     },
  ],

  goals: [
    { id: "three",  label: "Improve my 3-pointer", icon: "Three" },
    { id: "handle", label: "Better handles",       icon: "Handle" },
    { id: "lock",   label: "Lock down defense",    icon: "Lock" },
    { id: "ath",    label: "Get more athletic",    icon: "Ath" },
    { id: "iq",     label: "Read the game better", icon: "Brain" },
    { id: "pickup", label: "Win more pickup games", icon: "Trophy" },
  ],

  // Loading sequence (timing in ms)
  loadingSteps: [
    { t: 0,    label: "INITIALIZING",     msg: "Pulling your profile..."             },
    { t: 1000, label: "CROSS-REFERENCING", msg: "Comparing with 540 elite players..." },
    { t: 2200, label: "RANKING",           msg: "Charting strengths and gaps..."       },
    { t: 3400, label: "FINALIZING",        msg: "Generating your scouting report..."   },
    { t: 4600, label: "READY",             msg: "Report unlocked."                     },
  ],

  // Generated scouting report (would be from AI in real app)
  report: {
    grade: "A−",
    gradePct: 88,
    archetype: "TWO-WAY COMBO",
    archetypeSub: "Three-level scorer with disruptor instincts on D",
    headline: "Score-first DNA with underrated defensive feel.",
    // strengths now have ratings (0-100) for visual bars
    strengths: [
      { label: "Pull-up shooting", note: "Top 12% — comfortable off the dribble", score: 88 },
      { label: "Lateral defense",  note: "Lock-up potential vs. perimeter scorers", score: 82 },
      { label: "Decision making",  note: "High AST/TO — you don't force it", score: 79 },
    ],
    // gaps now have ratings (0-100, lower = more work needed)
    gaps: [
      { label: "Off-ball movement",        note: "Too ball-dominant on broken sets", score: 48 },
      { label: "Finishing through contact", note: "And-1 conversion below ceiling",   score: 54 },
      { label: "Conditioning",              note: "4th-quarter dropoff in pace",       score: 58 },
    ],
    // Training plan — priority-ordered focus areas
    plan: [
      {
        title: "Catch-and-Shoot Mastery",
        sub: "8 weeks · 3 sessions / week",
        why: "Builds the off-ball threat your pull-up game lacks.",
      },
      {
        title: "Contact Finishing",
        sub: "6 weeks · 2 sessions / week",
        why: "Drill euro-steps + pump fakes to convert through bumps.",
      },
      {
        title: "Conditioning Block",
        sub: "Ongoing · 20 min daily",
        why: "Sustain pace and decision-making into the 4th quarter.",
      },
    ],
    nbaComp: {
      name: "Devin Booker",
      role: "Combo Guard · PHX",
      why: "Three-level scoring frame, footwork into pull-ups, and underrated wing defense — your shot diet maps almost 1:1.",
      reasons: [
        "Three-level scoring frame",
        "Footwork into pull-ups",
        "Underrated defender on the wing",
      ],
      tint: "#f5a623",
    },
  },
};

window.obFmtHeight = (ft, inches) => `${ft}'${inches}"`;
// Convert ft+in to cm (1 in = 2.54 cm)
window.obHeightCm = (ft, inches) => Math.round((ft * 12 + inches) * 2.54);
// Convert lb to kg (1 lb ≈ 0.4536 kg)
window.obWeightKg = (lb) => Math.round(lb * 0.4536);
