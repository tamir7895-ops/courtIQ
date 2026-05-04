// drill-library-home-v2.jsx — Skill-tree home

const DLHome = ({ coldZones, onOpenDrill, onOpenPlan }) => {
  const { DRILLS, recommendForUser, suggestPlan } = window.DrillEngine;
  const recs = React.useMemo(() => recommendForUser(coldZones, 5), [coldZones]);
  const heroDrill = recs[0];
  const plan = React.useMemo(() => suggestPlan(coldZones), [coldZones]);

  // Group drills into lanes
  const byLane = React.useMemo(() => {
    const map = { shooting: [], ballhandling: [], finishing: [], defense: [], conditioning: [] };
    DRILLS.forEach(d => {
      const lane = window.DLClassifyLane(d);
      if (map[lane]) map[lane].push(d);
    });
    return map;
  }, []);

  // Hero "why" copy
  const cold = coldZones && coldZones[0];
  const totalMastered = React.useMemo(() => DRILLS.filter(d =>
    d.stats.mastery.level >= 3 && d.stats.sessionsCompleted > 0
  ).length, []);

  return (
    <div className="dl">
      <div className="dl-stamp">
        <div className="dl-stamp__l">
          <button className="dl-stamp__back" aria-label="Back">
            <DLIcon.Back width="14" height="14" />
          </button>
          <div>
            <div className="dl-stamp__eyebrow">DRILLS · SKILL TREE</div>
            <div className="dl-stamp__meta">
              <b>{totalMastered}</b>/{DRILLS.length} MASTERED · 5 PATHS
            </div>
          </div>
        </div>
        <div className="dl-stamp__pill">FOR YOU</div>
      </div>

      <div className="dl-scroll">
        {/* TODAY'S CHALLENGE */}
        {heroDrill && (
          <section className="dl-sec dl-sec--first">
            <div className="dl-sec__head">
              <div className="dl-sec__title dl-sec__title--italic">Today's challenge</div>
              <div className="dl-sec__sub">RANK · 01</div>
            </div>
            <div className="dl-hero">
              <div className="dl-hero__head">
                <span className="dl-hero__eyebrow">
                  <span className="dl-hero__eyebrow-dot" />
                  TARGETED · WEAK ZONE
                </span>
                <span className="dl-hero__rank">#01 · {heroDrill.totalDoneByPeers || 240}+ DONE</span>
              </div>
              <div className="dl-hero__name">{heroDrill.name}</div>
              <div className="dl-hero__benefit">{heroDrill.benefit}</div>
              {cold && (
                <div className="dl-hero__why">
                  Your <b>{cold.name}</b> sits at <b>{cold.fg}%</b>
                  {cold.delta < 0 && <> ({cold.delta} pts vs prior)</>}.
                  This drill puts <b>{heroDrill.sets * heroDrill.reps} reps</b> on
                  exactly that spot.
                </div>
              )}
              <div className="dl-hero__bar">
                <div className="dl-hero__chip">
                  <span className="dl-hero__chip-lbl">DURATION</span>
                  <span className="dl-hero__chip-val">{heroDrill.duration}<span>MIN</span></span>
                </div>
                <div className="dl-hero__chip">
                  <span className="dl-hero__chip-lbl">SETS · REPS</span>
                  <span className="dl-hero__chip-val">{heroDrill.sets}×{heroDrill.reps}</span>
                </div>
                <div className="dl-hero__chip">
                  <span className="dl-hero__chip-lbl">TIER</span>
                  <span className="dl-hero__chip-val">{heroDrill.difficulty.slice(0,3).toUpperCase()}</span>
                </div>
              </div>
              <div className="dl-hero__cta">
                <button className="dl-hero__cta-primary" onClick={() => onOpenDrill(heroDrill.id, true)}>
                  ▶ START
                </button>
                <button className="dl-hero__cta-secondary" onClick={() => onOpenDrill(heroDrill.id)}>
                  DETAILS
                </button>
              </div>
            </div>
          </section>
        )}

        {/* PLAN STRIP */}
        <section className="dl-sec">
          <div className="dl-plan-card dl-glass">
            <div>
              <div className="dl-plan-card__head">SUGGESTED · {plan.label}</div>
              <div className="dl-plan-card__copy">
                A <i>{plan.totalMin}-min</i> session — warm-up, two focus drills, cooldown.
              </div>
            </div>
            <div className="dl-plan-card__num">
              <span className="dl-plan-card__num-big">{plan.totalMin}</span>
              <span className="dl-plan-card__num-lbl">MIN · {plan.drills.length} DRILLS</span>
            </div>
            <button className="dl-plan-card__cta" onClick={onOpenPlan}>
              ▸ BUILD MY PLAN
            </button>
          </div>
        </section>

        {/* SKILL TREE — five swim lanes */}
        <section className="dl-sec">
          <div className="dl-sec__head">
            <div className="dl-sec__title">Skill paths</div>
            <div className="dl-sec__sub">5 LANES · BEGINNER → DIAMOND</div>
          </div>
          {window.DL_LANES.map(lane => (
            <window.DLSkillLane
              key={lane.id}
              lane={lane}
              drills={byLane[lane.id] || []}
              onOpen={onOpenDrill}
            />
          ))}
        </section>
      </div>
    </div>
  );
};

window.DLHome = DLHome;
