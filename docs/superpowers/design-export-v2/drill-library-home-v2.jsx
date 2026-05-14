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
          <window.CIQLogo accent="#4ca3ff" />
          <div>
            <div className="dl-stamp__eyebrow">TRAIN · SKILL TREE</div>
            <div className="dl-stamp__meta">
              <b>{totalMastered}</b>/{DRILLS.length} MASTERED · 5 PATHS
            </div>
          </div>
        </div>
        <div className="dl-stamp__pill">FOR YOU</div>
      </div>

      <div className="dl-scroll">
        {/* TRAIN TODAY — curated workout entry point */}
        <section className="dl-sec dl-sec--first">
          <div className="dl-today">
            <span className="dl-today__bug">
              <span className="dl-today__bug-dot" />
              Today · Tue
            </span>

            <h2 className="dl-today__title">Midrange <em>Masterclass</em></h2>

            <div className="dl-today__meta">
              <span className="dl-today__pill dl-today__pill--time">
                <svg viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5.5V8.5L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M5.5 2.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                35 min
              </span>
              <span className="dl-today__pill">
                <svg viewBox="0 0 16 16" fill="none">
                  <rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 6.5h6M5 9h6M5 11.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                4 drills
              </span>
              <span className="dl-today__pill dl-today__pill--diff--intermediate">
                <svg viewBox="0 0 16 16" fill="none">
                  <rect x="2.5" y="9" width="2.5" height="4.5" rx="0.5" fill="currentColor"/>
                  <rect x="6.75" y="6" width="2.5" height="7.5" rx="0.5" fill="currentColor"/>
                  <rect x="11" y="3" width="2.5" height="10.5" rx="0.5" fill="currentColor" opacity="0.3"/>
                </svg>
                Intermediate
              </span>
              <span className="dl-today__pill dl-today__pill--xp">
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M8 2.5l1.6 3.5 3.9.5-2.85 2.55.75 3.95L8 11l-3.4 2 .75-3.95L2.5 6.5l3.9-.5L8 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="currentColor" fillOpacity="0.18"/>
                </svg>
                +200 XP
              </span>
            </div>

            <div className="dl-today__drills">
              <div className="dl-today__drill">
                <span className="dl-today__drill-num">01</span>
                <span className="dl-today__drill-name">
                  Elbow Pull-Up Ladder
                  <span>Warm-up · 4×8</span>
                </span>
                <span className="dl-today__drill-time"><b>8</b>min</span>
              </div>
              <div className="dl-today__drill">
                <span className="dl-today__drill-num">02</span>
                <span className="dl-today__drill-name">
                  Free-Throw Line Series
                  <span>Form · 3×10</span>
                </span>
                <span className="dl-today__drill-time"><b>10</b>min</span>
              </div>
              <div className="dl-today__drill">
                <span className="dl-today__drill-num">03</span>
                <span className="dl-today__drill-name">
                  Spot-Up Mid Range
                  <span>Catch &amp; shoot · 5 spots</span>
                </span>
                <span className="dl-today__drill-time"><b>12</b>min</span>
              </div>
              <div className="dl-today__drill">
                <span className="dl-today__drill-num">04</span>
                <span className="dl-today__drill-name">
                  Pressure Finisher
                  <span>Streak · best of 10</span>
                </span>
                <span className="dl-today__drill-time"><b>5</b>min</span>
              </div>
            </div>

            <a className="dl-today__cta" href="workout-player.html">
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M4.5 3v10l8-5-8-5Z" fill="currentColor"/>
              </svg>
              Start Workout
            </a>

            <div className="dl-today__customize-row">
              <button type="button" className="dl-today__customize" onClick={onOpenPlan}>
                Customize ›
              </button>
            </div>
          </div>
        </section>

        {/* TODAY'S CHALLENGE */}
        {heroDrill && (
          <section className="dl-sec">
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
