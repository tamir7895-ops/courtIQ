// drill-library-skill-tree.jsx — RPG-style skill-tree home for the Drill tab
//
// Five swim lanes:
//   SHOOTING       — pure jumpers / catch-and-shoot / 3pt shooters
//   BALL HANDLING  — stationary + cone handle work
//   FINISHING      — interior, post, floaters, bank
//   DEFENSE        — slides, closeouts, shell
//   CONDITIONING   — full-court, suicides, agility
//
// Each lane: ordered Beginner → Advanced; locked unless prior tier complete.
// Each tile: 9-zone court thumbnail, difficulty badge, tier crest, mastery bar.

// ── 1 · Lane categorization ─────────────────────────────────────────────
function classifyLane(d) {
  // Finishing: interior shots, posts, floaters, bank shots, hooks
  const finishingTags = ["floater", "post", "bank", "hook", "interior", "short-mid"];
  if (d.focus === "shooting" && d.subTags.some(t => finishingTags.includes(t))) {
    return "finishing";
  }
  // Conditioning: full-court / suicide / agility / ladder
  const condTags = ["full-court", "conditioning", "suicide", "agility", "ladder"];
  if (d.subTags.some(t => condTags.includes(t)) || d.focus === "athleticism") {
    return "conditioning";
  }
  if (d.focus === "shooting") return "shooting";
  if (d.focus === "ballhandling") return "ballhandling";
  if (d.focus === "defense") return "defense";
  return "conditioning";
}

// ── 2 · Tier resolver ───────────────────────────────────────────────────
// Maps the engine's mastery level (1..4) → ui tier name.
// Tiers: locked / bronze / silver / gold / diamond
function resolveTier(d, prevUnlocked) {
  if (!prevUnlocked) return "locked";
  const lvl = d.stats.mastery.level;
  if (d.stats.sessionsCompleted === 0) return "bronze"; // unlocked but never done
  if (lvl >= 4) return "diamond";
  if (lvl === 3) return "gold";
  if (lvl === 2) return "silver";
  return "bronze";
}

// ── 3 · Mini half-court thumbnail (uses shared CIQCourt) ────────────────
// Shows the approved CIQCourt asset with the drill's targetZones highlighted
// as overlay polygons in the same 500×470 coordinate space.
//
// Zone polygons match the CIQ_ZONE anchors from ciq-court.jsx (rim center
// at (250, 52.5), 3PT corners at (30, 0..142) and (470, 0..142), arc
// radius 237.5, FT line y=190).
const DL_THUMB_ZONES = {
  // Corner 3s — outside the corner-3 sideline (x<30 left, x>470 right), y∈[0,142]
  lc:     "M 0 0 L 30 0 L 30 142 L 0 142 Z",
  rc:     "M 470 0 L 500 0 L 500 142 L 470 142 Z",
  // Wing 3s — between corner-3 line and 3PT arc, y above arc
  // approx polygons traced along arc (radius 237.5 from (250, 52.5))
  lw:     "M 30 142 L 30 230 Q 80 200 130 175 Q 110 155 90 142 Z",
  rw:     "M 470 142 L 470 230 Q 420 200 370 175 Q 390 155 410 142 Z",
  // Top 3 — above the arc's apex (peak at (250, 290))
  top:    "M 130 175 Q 190 245 250 290 Q 310 245 370 175 Q 310 130 250 120 Q 190 130 130 175 Z",
  // Mid-range L / R (inside arc, outside paint, between baseline and FT-extended)
  ml:     "M 30 0 L 170 0 L 170 190 L 130 175 Z",
  mr:     "M 330 0 L 470 0 L 470 142 L 370 175 L 330 190 Z",
  // Top-mid (inside arc, above paint)
  topmid: "M 170 190 L 330 190 L 250 290 L 170 240 Z",
  // Paint
  pnt:    "M 170 0 L 330 0 L 330 190 L 170 190 Z",
};

const DLCourtThumb = ({ targetZones = [], focus }) => {
  const set = new Set(targetZones);
  const accent = focus === "ballhandling" ? "#ffc94a"
    : focus === "defense" ? "#7be0ff"
    : focus === "athleticism" || focus === "conditioning" ? "#ff7a55"
    : "#4ca3ff";

  return (
    <CIQCourt variant="thumb" tone="blue">
      {Object.entries(DL_THUMB_ZONES).map(([id, d]) => set.has(id) ? (
        <path key={id} d={d}
          fill={accent} fillOpacity="0.18"
          stroke={accent} strokeWidth="2" strokeOpacity="0.9" strokeLinejoin="round" />
      ) : null)}
    </CIQCourt>
  );
};

// ── 4 · Tier crest icon ─────────────────────────────────────────────────
const DLTierCrest = ({ tier }) => {
  if (tier === "locked") {
    return (
      <svg viewBox="0 0 14 14" className="dl-tile__tier-svg" aria-hidden="true">
        <rect x="3" y="6" width="8" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M 5 6 V 4.5 a 2 2 0 0 1 4 0 V 6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (tier === "diamond") {
    return (
      <svg viewBox="0 0 14 14" className="dl-tile__tier-svg" aria-hidden="true">
        <path d="M 7 1.5 L 12.5 6 L 7 12.5 L 1.5 6 Z" fill="currentColor" stroke="currentColor" strokeWidth="0.6" strokeLinejoin="round" opacity="0.9" />
        <path d="M 4.4 6 L 9.6 6 M 7 1.5 L 7 12.5" stroke="rgba(0,0,0,0.4)" strokeWidth="0.6" />
      </svg>
    );
  }
  // generic shield-trophy
  return (
    <svg viewBox="0 0 14 14" className="dl-tile__tier-svg" aria-hidden="true">
      <path d="M 4 3 H 10 V 7 a 3 3 0 0 1 -6 0 Z" fill="currentColor" opacity="0.9" />
      <rect x="6" y="9.5" width="2" height="2" fill="currentColor" />
      <rect x="4.5" y="11" width="5" height="1.4" rx="0.4" fill="currentColor" />
    </svg>
  );
};

// ── 5 · Skill tile ──────────────────────────────────────────────────────
const DLSkillTile = ({ drill, tier, onOpen }) => {
  const locked = tier === "locked";
  const xpReward = drill.level === 1 ? 25 : drill.level === 2 ? 60 : 120;
  const pctXP = Math.min(100,
    (drill.stats.mastery.xp / drill.stats.mastery.nextXp) * 100);
  const fillCls =
    tier === "diamond" ? " dl-tile__mastery-fill--diamond"
    : tier === "gold" ? " dl-tile__mastery-fill--gold"
    : "";

  let stateCls = "";
  if (locked) stateCls = " is-locked";
  else if (tier === "diamond") stateCls = " is-unlocked is-mastered-diamond";
  else if (tier === "gold") stateCls = " is-unlocked is-mastered-gold";
  else stateCls = " is-unlocked";

  return (
    <button
      className={"dl-tile" + stateCls}
      onClick={() => !locked && onOpen(drill.id)}
      disabled={locked}
    >
      <div className="dl-tile__court">
        <DLCourtThumb targetZones={drill.targetZones} focus={drill.focus} />

        <span className={"dl-tile__diff dl-tile__diff--" + drill.difficulty}>
          {drill.difficulty.slice(0,3)}
        </span>

        <span className={"dl-tile__tier dl-tile__tier--" + tier}>
          <DLTierCrest tier={tier} />
        </span>

        {locked && (
          <div className="dl-tile__locked-overlay">
            <span className="dl-tile__locked-pill">
              <DLTierCrest tier="locked" />
              LOCKED
            </span>
          </div>
        )}
      </div>

      <div className="dl-tile__name">{drill.name}</div>
      <div className="dl-tile__benefit">{drill.benefit}</div>

      <div className="dl-tile__meta">
        <span className="dl-tile__meta-item">
          <b>{drill.duration}</b>MIN
        </span>
        <span className="dl-tile__meta-item" style={{ justifySelf: "end" }}>
          <span className="dl-tile__xp">+{xpReward}</span>XP
        </span>
        <span className="dl-tile__meta-item">
          <b>{drill.stats.sessionsCompleted}</b>RUNS
        </span>
        <span className="dl-tile__meta-item" style={{ justifySelf: "end" }}>
          <b>{drill.stats.p90Fg}</b>%PB
        </span>
      </div>

      {!locked && (
        <div className="dl-tile__mastery-bar">
          <div className={"dl-tile__mastery-fill" + fillCls}
            style={{ width: pctXP + "%" }} />
        </div>
      )}
    </button>
  );
};

// ── 6 · Lane (skill category swim lane) ─────────────────────────────────
const DLSkillLane = ({ lane, drills, onOpen }) => {
  // Sort by difficulty so progression reads left→right
  const ordered = [...drills].sort((a,b) => a.level - b.level);

  // Compute unlock chain: each tile unlocked iff previous tile in lane has
  // sessionsCompleted > 0 OR it is itself difficulty=beginner.
  let prevUnlocked = true;
  const tiles = ordered.map((d) => {
    const tier = resolveTier(d, prevUnlocked || d.difficulty === "beginner");
    // unlocks future tiles when sessions > 0
    if (d.stats.sessionsCompleted > 0 || d.difficulty === "beginner") prevUnlocked = true;
    else prevUnlocked = false;
    return { drill: d, tier };
  });

  // Mastered count
  const mastered = tiles.filter(t =>
    t.tier === "gold" || t.tier === "diamond"
  ).length;
  const pct = Math.round((mastered / tiles.length) * 100);

  return (
    <section className="dl-lane dl-glass">
      <div className="dl-lane__head">
        <div className="dl-lane__head-l">
          <div className={"dl-lane__icon dl-focus-ico--" + lane.focusColorKey}>
            {lane.icon}
          </div>
          <div className="dl-lane__title-block">
            <span className="dl-lane__title">{lane.title}</span>
            <span className="dl-lane__progress">
              <b>{mastered}</b>/{tiles.length} MASTERED
              <span className="dl-lane__progress-bar">
                <span className="dl-lane__progress-fill" style={{ width: pct + "%" }} />
              </span>
            </span>
          </div>
        </div>
        <button className="dl-lane__more">SEE ALL ›</button>
      </div>

      <div className="dl-lane__rail">
        {tiles.map(({ drill, tier }) => (
          <DLSkillTile key={drill.id} drill={drill} tier={tier} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
};

// ── 7 · Lane definitions ────────────────────────────────────────────────
const LANES = [
  {
    id: "shooting", title: "SHOOTING",
    focusColorKey: "shooting",
    icon: <DLIcon.Shooting width="16" height="16" />,
  },
  {
    id: "ballhandling", title: "BALL HANDLING",
    focusColorKey: "ballhandling",
    icon: <DLIcon.Ballhandling width="16" height="16" />,
  },
  {
    id: "finishing", title: "FINISHING",
    focusColorKey: "finishing",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
        <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M 4 4 L 12 12 M 12 4 L 4 12" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: "defense", title: "DEFENSE",
    focusColorKey: "defense",
    icon: <DLIcon.Defense width="16" height="16" />,
  },
  {
    id: "conditioning", title: "CONDITIONING",
    focusColorKey: "conditioning",
    icon: <DLIcon.Athleticism width="16" height="16" />,
  },
];

window.DLClassifyLane = classifyLane;
window.DLResolveTier = resolveTier;
window.DLSkillTile = DLSkillTile;
window.DLSkillLane = DLSkillLane;
window.DLCourtThumb = DLCourtThumb;
window.DLTierCrest = DLTierCrest;
window.DL_LANES = LANES;
