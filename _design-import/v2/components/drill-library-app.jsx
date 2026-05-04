// drill-library-app.jsx — root: routes between Home / Detail / PlanSheet / Preflight

const COLD_ZONES_FROM_TRACK = [
  { id: "lw", name: "L Wing 3", fg: 32, delta: -8 },
  { id: "rc", name: "R Corner 3", fg: 28, delta: -12 },
  { id: "mid", name: "Mid-range", fg: 38, delta: -4 },
];

const App = () => {
  const [route, setRoute] = React.useState({ name: "home" });
  const [planOpen, setPlanOpen] = React.useState(false);
  const [preflight, setPreflight] = React.useState(null);
  const [savedIds, setSavedIds] = React.useState(new Set(["wing-3-recovery", "spot-up-7"]));
  const [activeNav, setActiveNav] = React.useState("train");

  const { BY_ID } = window.DrillEngine;

  const openDrill = (id, goPreflight) => {
    if (goPreflight) setPreflight(BY_ID[id]);
    else setRoute({ name: "detail", id });
  };

  const toggleSave = (id) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const launchPlan = (plan) => {
    setPlanOpen(false);
    const first = BY_ID[plan.warmupId] || BY_ID[plan.focusIds[0]];
    if (first) setPreflight(first);
  };

  return (
    <IOSDevice>
      <div style={{ position: "absolute", inset: 0, background: "#0a0907" }}>
        {route.name === "home" && (
          <DLHome
            coldZones={COLD_ZONES_FROM_TRACK}
            onOpenDrill={openDrill}
            onOpenPlan={() => setPlanOpen(true)}
          />
        )}
        {route.name === "detail" && (
          <DLDetail
            drill={BY_ID[route.id]}
            saved={savedIds.has(route.id)}
            onToggleSave={() => toggleSave(route.id)}
            onBack={() => setRoute({ name: "home" })}
            onStart={() => setPreflight(BY_ID[route.id])}
            onOpenDrill={(id) => setRoute({ name: "detail", id })}
          />
        )}

        {planOpen && (
          <DLPlanSheet
            coldZones={COLD_ZONES_FROM_TRACK}
            onClose={() => setPlanOpen(false)}
            onLaunch={launchPlan}
            onOpenDrill={(id) => { setPlanOpen(false); setRoute({ name: "detail", id }); }}
          />
        )}

        {preflight && (
          <DLPreflight
            drill={preflight}
            onCancel={() => setPreflight(null)}
            onGo={() => {
              setPreflight(null);
              window.location.href = "camera-hud.html";
            }}
          />
        )}
        {!preflight && !planOpen && (
          <window.CIQBottomNav active={activeNav} onChange={setActiveNav} />
        )}
      </div>
    </IOSDevice>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
