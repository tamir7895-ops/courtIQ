// drill-library-plan-sheet-v2.jsx — card-based plan-builder bottom sheet

const DLPlanSheet = ({ coldZones, onClose, onLaunch, onOpenDrill }) => {
  const { suggestPlan, BY_ID } = window.DrillEngine;
  const seed = React.useMemo(() => suggestPlan(coldZones), [coldZones]);
  const [plan, setPlan] = React.useState(() => ({
    warmupId: seed.drills[0].id,
    focusIds: seed.drills.slice(1, -1).map(d => d.id),
    cooldownId: seed.drills[seed.drills.length - 1].id,
  }));
  const get = (id) => BY_ID[id];
  const totalMin =
    (plan.warmupId ? get(plan.warmupId).duration : 0) +
    plan.focusIds.reduce((a, id) => a + get(id).duration, 0) +
    (plan.cooldownId ? get(plan.cooldownId).duration : 0);
  const totalDrills = (plan.warmupId ? 1 : 0) + plan.focusIds.length + (plan.cooldownId ? 1 : 0);

  const removeFocus = (id) =>
    setPlan(p => ({ ...p, focusIds: p.focusIds.filter(x => x !== id) }));

  const PlanRow = ({ id, removable }) => {
    if (!id) return null;
    const d = get(id);
    if (!d) return null;
    return (
      <div className="dl-plan-row">
        <div className={"dl-plan-row__icon dl-focus-ico--" + d.focus}>
          <window.DLFocusIcon focus={d.focus} />
        </div>
        <div onClick={() => onOpenDrill(d.id)} style={{ cursor: "pointer" }}>
          <div className="dl-plan-row__name">{d.name}</div>
          <div className="dl-plan-row__sub">
            {d.sets}×{d.reps} · {d.difficulty.toUpperCase()}
          </div>
        </div>
        <div className="dl-plan-row__time">{d.duration}<span>M</span></div>
        {removable ? (
          <button className="dl-plan-row__remove" onClick={() => removeFocus(d.id)} aria-label="Remove">
            <window.DLIcon.X width="10" height="10" />
          </button>
        ) : <span style={{ width: 24 }} />}
      </div>
    );
  };

  return (
    <>
      <div className="dl-plan-scrim" onClick={onClose} />
      <div className="dl-plan-sheet dl" role="dialog" aria-modal="true">
        <div className="dl-plan-sheet__handle" />
        <div className="dl-plan-sheet__head">
          <div>
            <div className="dl-plan-sheet__title">Today's plan</div>
            <div className="dl-plan-sheet__meta">RECOVERY · 7D · COLD-ZONE TARGETED</div>
          </div>
          <button className="dl-plan-sheet__close" onClick={onClose} aria-label="Close">
            <window.DLIcon.X width="12" height="12" />
          </button>
        </div>

        <div className="dl-plan-sheet__body">
          <div className="dl-plan-block dl-glass">
            <div className="dl-plan-block__head">
              <span className="dl-plan-block__lbl dl-plan-block__lbl--warmup">
                <span className="dl-plan-block__lbl-dot" /> WARM-UP · 1
              </span>
            </div>
            <div className="dl-plan-block__rows">
              <PlanRow id={plan.warmupId} removable={false} />
            </div>
          </div>

          <div className="dl-plan-block dl-glass">
            <div className="dl-plan-block__head">
              <span className="dl-plan-block__lbl">
                <span className="dl-plan-block__lbl-dot" /> FOCUS · {plan.focusIds.length}
              </span>
              <button className="dl-plan-block__add">+ ADD</button>
            </div>
            <div className="dl-plan-block__rows">
              {plan.focusIds.map(id => (
                <PlanRow key={id} id={id} removable={true} />
              ))}
            </div>
          </div>

          <div className="dl-plan-block dl-glass">
            <div className="dl-plan-block__head">
              <span className="dl-plan-block__lbl dl-plan-block__lbl--cooldown">
                <span className="dl-plan-block__lbl-dot" /> COOLDOWN · 1
              </span>
            </div>
            <div className="dl-plan-block__rows">
              <PlanRow id={plan.cooldownId} removable={false} />
            </div>
          </div>

          <div style={{ height: 12 }} />
        </div>

        <div className="dl-plan-sheet__footer">
          <div className="dl-plan-sheet__total">
            <span className="dl-plan-sheet__total-num">{totalMin}<span>MIN</span></span>
            <span className="dl-plan-sheet__total-lbl">{totalDrills} DRILLS · TOTAL</span>
          </div>
          <button className="dl-plan-sheet__cta" onClick={() => onLaunch(plan)}>
            ▶ START PLAN
          </button>
        </div>
      </div>
    </>
  );
};

window.DLPlanSheet = DLPlanSheet;
