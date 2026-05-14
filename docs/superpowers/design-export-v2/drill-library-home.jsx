// drill-library-home.jsx — Drill tab landing screen
// Sections:
//   1. STAMP header
//   2. For You · primary recommendation hero
//   3. Plan-for-you suggestion strip
//   4. Recommended row · cold-zone-targeted drills
//   5. Filter chips by focus area
//   6. Catalog list (filtered)

const DLHome = ({ coldZones, onOpenDrill, onOpenPlan }) => {
  const { DRILLS, recommendForUser, suggestPlan, FOCUSES } = window.DrillEngine;

  const [filter, setFilter] = React.useState("all");

  const recs = React.useMemo(() => recommendForUser(coldZones, 5), [coldZones]);
  const heroDrill = recs[0];
  const plan = React.useMemo(() => suggestPlan(coldZones), [coldZones]);

  const filtered = React.useMemo(() => {
    if (filter === "all") return DRILLS;
    return DRILLS.filter(d => d.focus === filter);
  }, [filter]);

  const focusCounts = React.useMemo(() => {
    const out = { all: DRILLS.length };
    FOCUSES.forEach(f => { out[f] = DRILLS.filter(d => d.focus === f).length; });
    return out;
  }, []);

  // Hero "why" copy — explain the recommendation reasoning
  const coldText = (() => {
    if (!coldZones || coldZones.length === 0) return null;
    const z = coldZones[0];
    return { name: z.name, fg: z.fg, delta: z.delta };
  })();

  return (
    <div className="dl">
      {/* STAMP */}
      <div className="dl-stamp">
        <div className="dl-stamp__l">
          <button className="dl-stamp__back" aria-label="Back">
            <DLIcon.Back width="14" height="14" />
          </button>
          <div>
            <div className="dl-stamp__eyebrow">DRILLS · LIBRARY</div>
            <div className="dl-stamp__meta">{DRILLS.length} drills · 4 focus areas</div>
          </div>
        </div>
        <div className="dl-stamp__pill">FOR YOU</div>
      </div>

      <div className="dl-scroll">

        {/* HERO RECOMMENDATION */}
        {heroDrill && (
          <section className="dl-sec dl-sec--first">
            <div className="dl-sec__head">
              <div className="dl-sec__title dl-sec__title--italic">Today's pick</div>
              <div className="dl-sec__sub">RANK · 01</div>
            </div>
            <div className="dl-rec-hero">
              <div className="dl-rec-hero__head">
                <span className="dl-rec-hero__eyebrow">★ TARGETED · WEAK ZONE</span>
                <span className="dl-rec-hero__rank">#01 · {heroDrill.totalDoneByPeers}+ DONE</span>
              </div>
              <div className="dl-rec-hero__name">{heroDrill.name}</div>
              <div className="dl-rec-hero__benefit">{heroDrill.benefit}</div>
              {coldText && (
                <div className="dl-rec-hero__why">
                  Your <b>{coldText.name}</b> is at <b>{coldText.fg}%</b>
                  {coldText.delta < 0 && <> ({coldText.delta} pts vs prior)</>}.
                  This drill puts <b>{heroDrill.sets * heroDrill.reps} reps</b> on
                  exactly that spot.
                </div>
              )}
              <div className="dl-rec-hero__bar">
                <span><b>{heroDrill.duration}</b>MIN</span>
                <span><b>{heroDrill.sets}×{heroDrill.reps}</b>REPS</span>
                <span><b>{heroDrill.difficulty.toUpperCase()}</b></span>
              </div>
              <div className="dl-rec-hero__cta">
                <button className="dl-rec-hero__cta-primary" onClick={() => onOpenDrill(heroDrill.id, /*goPreflight*/ true)}>
                  ▶ START
                </button>
                <button className="dl-rec-hero__cta-secondary" onClick={() => onOpenDrill(heroDrill.id)}>
                  DETAILS
                </button>
              </div>
            </div>
          </section>
        )}

        {/* PLAN STRIP */}
        <section className="dl-sec">
          <div className="dl-plan">
            <div>
              <div className="dl-plan__head">SUGGESTED · {plan.label}</div>
              <div className="dl-plan__copy">
                A <i>{plan.totalMin}-minute</i> session — warm-up, two focus drills, cooldown.
              </div>
            </div>
            <div className="dl-plan__num">
              <span className="dl-plan__num-big">{plan.totalMin}</span>
              <span className="dl-plan__num-lbl">MIN · {plan.drills.length} DRILLS</span>
            </div>
            <button className="dl-plan__cta" onClick={onOpenPlan}>
              ▸ BUILD MY PLAN
            </button>
          </div>
        </section>

        {/* RECOMMENDED ROW */}
        <section className="dl-sec">
          <div className="dl-sec__head">
            <div className="dl-sec__title">Targeted to your weak zones</div>
            <button className="dl-sec__more">SEE ALL ›</button>
          </div>
          <div className="dl-row">
            {recs.slice(1).map(d => (
              <DLDrillCard key={d.id} drill={d} onOpen={onOpenDrill} />
            ))}
          </div>
        </section>

        {/* FILTER + CATALOG */}
        <section className="dl-sec">
          <div className="dl-sec__head">
            <div className="dl-sec__title">All drills</div>
            <div className="dl-sec__sub">{filtered.length} TOTAL</div>
          </div>

          <div className="dl-filters" role="tablist">
            {[
              { id: "all", label: "ALL" },
              { id: "shooting", label: "SHOOTING" },
              { id: "ballhandling", label: "HANDLE" },
              { id: "defense", label: "DEFENSE" },
              { id: "athleticism", label: "ATHLETIC" },
            ].map(f => (
              <button
                key={f.id}
                className={"dl-chip" + (filter === f.id ? " is-active" : "")}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span className="dl-chip__count">{focusCounts[f.id]}</span>
              </button>
            ))}
          </div>

          <div className="dl-list">
            {filtered.map(d => (
              <DLDrillRow key={d.id} drill={d} onOpen={onOpenDrill} />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

window.DLHome = DLHome;
