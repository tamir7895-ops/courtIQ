// me-data.jsx — Profile + Trophies + Leaderboard data + DiceBear-inspired avatar

const ME_PROFILE = {
  name: "Alex Rivera",
  position: "Combo Guard",
  level: 14,
  totalXP: 12480,
  weeklyXP: 1240,
  email: "alex.rivera@courtiq.app",
  archetype: {
    name: "The Sniper",
    match: 92,
    skills: [
      { id: "shooting", name: "Shooting",      val: 92 },
      { id: "handle",   name: "Ball Handling", val: 78 },
      { id: "passing",  name: "Passing",       val: 64 },
      { id: "defense",  name: "Defense",       val: 58 },
      { id: "athl",     name: "Athleticism",   val: 71 },
      { id: "iq",       name: "Basketball IQ", val: 84 },
    ],
    traits: ["Catch & Shoot", "Pull-Up", "Off-Screen", "Deep Range", "Quick Trigger"],
  },
  stats: {
    sessions: 142,
    streak: 23,
    xp: 12480,
  },
};

// 8 trophies — 5 earned, 3 locked. Lucide-style stroke icons.
const ME_TROPHIES = [
  { id: "first",   label: "First Bucket",  earned: true,  icon: "target" },
  { id: "hot7",    label: "Hot Week",      earned: true,  icon: "flame" },
  { id: "100s",    label: "Century",       earned: true,  icon: "hundred" },
  { id: "sniper",  label: "Sniper L3",     earned: true,  icon: "crosshair" },
  { id: "iron",    label: "Iron Streak",   earned: true,  icon: "shield" },
  { id: "legend",  label: "Legend Tier",   earned: false, icon: "crown" },
  { id: "1kxp",    label: "10K XP",        earned: false, icon: "bolt" },
  { id: "tour",    label: "Tournament",    earned: false, icon: "trophy" },
];

// Leaderboard — friends mini-preview (top 3 + Me)
const ME_LEADERBOARD = [
  { rank: 1, name: "Marcus Lee",    xp: 18420, seed: "ml-7" },
  { rank: 2, name: "Sasha Kim",     xp: 14910, seed: "sk-3" },
  { rank: 3, name: "Alex Rivera",   xp: 12480, seed: "ar-1", isMe: true },
];

// ─────────────────────────────────────────────────────────────
// DiceBear-style procedural avatar — stroke-based geometric face
// Deterministic from a seed string. Returns SVG markup.
// ─────────────────────────────────────────────────────────────
const meHash = (s) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
};
const meRng = (seed) => {
  let s = meHash(seed) || 1;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0;
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
};
const mePick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

const ME_AVATAR_PALETTES = [
  { bg: "#2dd4bf", skin: "#f5d4ad", hair: "#1a1d26" }, // teal
  { bg: "#ff7a3c", skin: "#caa074", hair: "#0a0907" }, // orange
  { bg: "#bc8cff", skin: "#e9c9a3", hair: "#241a3a" }, // purple
  { bg: "#56d364", skin: "#d6a98a", hair: "#0e1014" }, // green
  { bg: "#4ca3ff", skin: "#f0c9a4", hair: "#1a1014" }, // blue
  { bg: "#f5a623", skin: "#cf9870", hair: "#0c0a08" }, // amber
];

const MeAvatar = ({ seed = "default", size = 84 }) => {
  const rng = meRng(seed);
  const pal = mePick(rng, ME_AVATAR_PALETTES);
  // facial features
  const eyeStyle = Math.floor(rng() * 3); // 0=dot 1=line 2=arc
  const browTilt = (rng() - 0.5) * 6;
  const mouthStyle = Math.floor(rng() * 3); // 0=smile 1=line 2=open
  const hairStyle = Math.floor(rng() * 3); // 0=cap 1=long 2=fade
  const accent = mePick(rng, ["#ffffff", pal.hair, "#0a0907"]);

  const cx = 50, cy = 50, r = 48;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }}>
      <defs>
        <clipPath id={`avc-${seed}`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      {/* bg */}
      <circle cx={cx} cy={cy} r={r} fill={pal.bg} />
      <g clipPath={`url(#avc-${seed})`}>
        {/* face/skin */}
        <ellipse cx={50} cy={56} rx={26} ry={28} fill={pal.skin} />
        {/* neck */}
        <rect x={42} y={78} width={16} height={20} fill={pal.skin} />
        {/* shoulders/jersey */}
        <ellipse cx={50} cy={104} rx={42} ry={20} fill={pal.hair} />
        {/* hair */}
        {hairStyle === 0 && (
          <path d={`M24 50 Q24 26 50 26 Q76 26 76 50 L76 44 Q60 38 50 38 Q40 38 24 44 Z`} fill={pal.hair} />
        )}
        {hairStyle === 1 && (
          <path d={`M22 56 Q22 24 50 24 Q78 24 78 56 Q78 50 70 48 Q70 32 50 32 Q30 32 30 48 Q22 50 22 56 Z`} fill={pal.hair} />
        )}
        {hairStyle === 2 && (
          <>
            <path d={`M26 48 Q28 30 50 30 Q72 30 74 48 Q66 42 50 42 Q34 42 26 48 Z`} fill={pal.hair} />
            <rect x={26} y={46} width={48} height={3} fill={pal.hair} opacity={0.5} />
          </>
        )}
        {/* brows */}
        <g transform={`rotate(${browTilt} 50 52)`}>
          <line x1={36} y1={52} x2={44} y2={52} stroke={pal.hair} strokeWidth={2.2} strokeLinecap="round"/>
          <line x1={56} y1={52} x2={64} y2={52} stroke={pal.hair} strokeWidth={2.2} strokeLinecap="round"/>
        </g>
        {/* eyes */}
        {eyeStyle === 0 && (
          <>
            <circle cx={40} cy={58} r={2.2} fill={pal.hair} />
            <circle cx={60} cy={58} r={2.2} fill={pal.hair} />
          </>
        )}
        {eyeStyle === 1 && (
          <>
            <line x1={36} y1={58} x2={44} y2={58} stroke={pal.hair} strokeWidth={2.2} strokeLinecap="round"/>
            <line x1={56} y1={58} x2={64} y2={58} stroke={pal.hair} strokeWidth={2.2} strokeLinecap="round"/>
          </>
        )}
        {eyeStyle === 2 && (
          <>
            <path d="M36 58 Q40 54 44 58" stroke={pal.hair} strokeWidth={2.2} fill="none" strokeLinecap="round"/>
            <path d="M56 58 Q60 54 64 58" stroke={pal.hair} strokeWidth={2.2} fill="none" strokeLinecap="round"/>
          </>
        )}
        {/* nose */}
        <path d="M50 62 L48 70 Q50 72 52 70 Z" fill="none" stroke={pal.hair} strokeOpacity="0.4" strokeWidth={1.2} strokeLinecap="round"/>
        {/* mouth */}
        {mouthStyle === 0 && (
          <path d="M44 76 Q50 80 56 76" stroke={pal.hair} strokeWidth={2} fill="none" strokeLinecap="round"/>
        )}
        {mouthStyle === 1 && (
          <line x1={45} y1={76} x2={55} y2={76} stroke={pal.hair} strokeWidth={2} strokeLinecap="round"/>
        )}
        {mouthStyle === 2 && (
          <ellipse cx={50} cy={76} rx={4} ry={2.2} fill={pal.hair} />
        )}
        {/* jersey accent stripe */}
        <rect x={28} y={92} width={44} height={3} fill={accent} opacity={0.6} />
      </g>
      {/* ring */}
      <circle cx={cx} cy={cy} r={r-1} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={1}/>
    </svg>
  );
};

window.ME_PROFILE = ME_PROFILE;
window.ME_TROPHIES = ME_TROPHIES;
window.ME_LEADERBOARD = ME_LEADERBOARD;
window.MeAvatar = MeAvatar;
