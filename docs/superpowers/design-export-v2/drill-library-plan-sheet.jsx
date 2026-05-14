// drill-library-plan-sheet.jsx — practice plan builder bottom sheet
// Three blocks: WARMUP (1) · FOCUS (2-3) · COOLDOWN (1)
// Pre-filled by DrillEngine.suggestPlan(coldZones); user can swap/remove rows
// and bump up to a HUD-ready plan.

const DLPlanSheet = ({ coldZones, onClose, onLaunch, onOpenDrill }) => {
  const { suggestPlan, BY_ID } = window.DrillEngine;
  const seed = React.useMemo(() => suggestPlan(coldZones), [coldZones]);

  // Plan model: {warmupId, focusIds[], cooldownId}
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
        <div className={"dl-card__focus-ico dl-card__focus-ico--" + d.focus}>
          <DLFocusIcon focus={d.focus} />
        </div>
        <div onClick={() => onOpenDrill(d.id)} style={{ cursor: "pointer" }}>
          <div className="dl-plan-row__name">{d.name}</div>
          <div className="dl-plan-row__sub">
            {d.sets}×{d.reps} · {d.difficulty.toUpperCase()}
          </div>
        </div>
        <div className="dl-plan-row__time">{d.duration}<span className="dl-list__time-unit"> M</span></div>
        {removable && (
          <button className="dl-plan-row__remove" onClick={() => removeFocus(d.id)} aria-label="Remove">
            <DLIcon.X width="10" height="10" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="dl-plan-scrim" onClick={onClose} />
      <div className="dl-plan-sheet" role="dialog" aria-modal="true">
        <div className="dl-plan-sheet__handle" />
        <div className="dl-plan-sheet__head">
          <div>
            <div className="dl-plan-sheet__title">Today's plan</div>
            <div className="dl-plan-sheet__meta">RECOVERY · 7D · COLD-ZONE TARGETED</div>
          </div>
          <button className="dl-plan-sheet__close" onClick={onClose} aria-label="Close">
            <DLIcon.X width="12" height="12" />
          </button>
        </div>

        <div className="dl-plan-sheet__body">

          <div className="dl-plan-block">
            <div className="dl-plan-block__head">
              <div className="dl-plan-block__lbl dl-plan-block__lbl--amber">▸ WARM-UP · 1</div>
            </div>
            <PlanRow id={plan.warmupId} removable={false} />
          </div>

          <div className="dl-plan-block">
            <div className="dl-plan-block__head">
              <div className="dl-plan-block__lbl">▸ FOCUS · {plan.focusIds.length}</div>
              <button className="dl-plan-block__add">+ ADD</button>
            </div>
            {plan.focusIds.map(id => (
              <PlanRow key={id} id={id} removable={true} />
            ))}
          </div>

          <div className="dl-plan-block">
            <div className="dl-plan-block__head">
              <div className="dl-plan-block__lbl dl-plan-block__lbl--brand">▸ COOLDOWN · 1</div>
            </div>
            <PlanRow id={plan.cooldownId} removable={false} />
          </div>

          <div style={{ height: 12 }} />

        </div>

        <div className="dl-plan-sheet__footer">
          <div className="dl-plan-sheet__total">
            <span className="dl-plan-sheet__total-num">{totalMin}<span className="dl-list__time-unit"> MIN</span></span>
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
