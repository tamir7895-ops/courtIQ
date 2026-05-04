// drill-library-card.jsx — shared card + list-row components

const DLDifficultyPips = ({ level }) => (
  <div className="dl-card__diff" aria-label={`Difficulty ${level} of 3`}>
    {[1,2,3].map(i => (
      <span key={i} className={"dl-card__diff-pip" + (i <= level ? " is-on" : "")} />
    ))}
  </div>
);

const DLMasteryBadge = ({ mastery, size = "sm" }) => {
  const lvl = mastery.level;
  const cls = lvl === 1 ? "is-bronze" : lvl === 2 ? "is-silver" : lvl === 3 ? "is-gold" : "is-platinum";
  if (size === "sm") {
    return <div className={"dl-card__mastery " + cls}>L{lvl}</div>;
  }
  return (
    <div className={"dl-mastery__badge " + cls}>
      {mastery.label}
    </div>
  );
};

const DLDrillCard = ({ drill, onOpen }) => {
  return (
    <button className="dl-card" onClick={() => onOpen(drill.id)}>
      <div className="dl-card__top">
        <div className={"dl-card__focus-ico dl-card__focus-ico--" + drill.focus}>
          <DLFocusIcon focus={drill.focus} />
        </div>
        <DLDifficultyPips level={drill.level} />
      </div>
      <div className="dl-card__name">{drill.name}</div>
      <div className="dl-card__benefit">{drill.benefit}</div>
      <div className="dl-card__meta">
        <span><b>{drill.duration}</b>MIN</span>
        <DLMasteryBadge mastery={drill.stats.mastery} />
      </div>
    </button>
  );
};

const DLDrillRow = ({ drill, onOpen }) => {
  return (
    <button className="dl-list__row" onClick={() => onOpen(drill.id)}>
      <div className={"dl-card__focus-ico dl-card__focus-ico--" + drill.focus}>
        <DLFocusIcon focus={drill.focus} />
      </div>
      <div>
        <div className="dl-list__name">{drill.name}</div>
        <div className="dl-list__sub">
          <b>{drill.sets}×{drill.reps}</b> · {drill.difficulty.toUpperCase()} · LAST: {drill.stats.lastDone}
        </div>
      </div>
      <div className="dl-list__right">
        <span className="dl-list__time">{drill.duration}<span className="dl-list__time-unit"> MIN</span></span>
        <DLDifficultyPips level={drill.level} />
      </div>
    </button>
  );
};

window.DLDrillCard = DLDrillCard;
window.DLDrillRow = DLDrillRow;
window.DLDifficultyPips = DLDifficultyPips;
window.DLMasteryBadge = DLMasteryBadge;
