// camera-hud-app.jsx — orchestrator
// Drives the simulation: timer ticks, periodic shot detections, FG% updates,
// celebration bursts, zone changes, debug-box ball motion.
// Keeps everything inside one App component so state lives in one place.

const { useEffect, useReducer, useRef, useState } = React;

// ── tweakable defaults (persist via host) ───────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "broadcast",
  "focusSize": 220,
  "debug": false,
  "speed": 1.0,
  "scenario": "hot",
  "hudOpacity": 1.0,
  "showCelebrations": true
}/*EDITMODE-END*/;

// scripted shot scenarios — drive the demo loop
const SCENARIOS = {
  hot: {
    label: "Heating Up",
    initial: { made: 12, att: 18, elapsed: 8 * 60 * 1000 + 24000, zone: "rw" },
    sequence: [
      { t: 1800,  zone: "rw",  shot: true,  burst: "swish" },
      { t: 3600,  zone: "rw",  shot: true,  burst: "swish" },
      { t: 5400,  zone: "top", shot: true,  burst: "heating" },
      { t: 7400,  zone: "top", shot: false, burst: "miss" },
      { t: 9200,  zone: "lc",  shot: true,  burst: "swish" },
      { t: 11200, zone: "lw",  shot: true,  burst: "splash" },
      { t: 13200, zone: "lw",  shot: true,  burst: "swish" },
      { t: 15200, zone: "mid", shot: false, burst: "miss" },
      { t: 17000, zone: "mid", shot: true,  burst: "swish" },
    ],
  },
  cold: {
    label: "Cold Start",
    initial: { made: 3, att: 9, elapsed: 2 * 60 * 1000 + 12000, zone: "top" },
    sequence: [
      { t: 2000,  zone: "top", shot: false, burst: "miss" },
      { t: 4500,  zone: "top", shot: false, burst: "miss" },
      { t: 7000,  zone: "rw",  shot: true,  burst: "swish" },
      { t: 9500,  zone: "rw",  shot: false, burst: "miss" },
      { t: 12000, zone: "lc",  shot: true,  burst: "swish" },
      { t: 14500, zone: "lc",  shot: true,  burst: "swish" },
    ],
  },
  start: {
    label: "Session Start",
    initial: { made: 0, att: 0, elapsed: 0, zone: "top" },
    sequence: [
      { t: 3000,  zone: "top", shot: true,  burst: "swish" },
      { t: 6000,  zone: "rw",  shot: true,  burst: "swish" },
      { t: 9000,  zone: "rw",  shot: false, burst: "miss" },
      { t: 12000, zone: "lc",  shot: true,  burst: "swish" },
    ],
  },
};

const ZONE_ACC_BASE = {
  lc: 0.55, lw: 0.42, top: 0.48, rw: 0.62, rc: 0.50, mid: 0.38, pnt: 0.71,
};

const initialState = (scenario) => {
  const s = SCENARIOS[scenario] ?? SCENARIOS.hot;
  return {
    made: s.initial.made,
    att: s.initial.att,
    elapsed: s.initial.elapsed,
    zone: s.initial.zone,
    shots: Array.from({ length: 5 }, () => Math.random() > 0.3),
    pulseKey: 0,
    celebrate: null,
    ballPos: { x: 195, y: 380 },
    zoneAcc: { ...ZONE_ACC_BASE },
    phase: "live",
    cursor: 0,
  };
};

function reducer(state, action) {
  switch (action.type) {
    case "tick":
      return { ...state, elapsed: state.elapsed + action.dt, ballPos: action.ballPos };
    case "shot": {
      const made = action.shot;
      const shots = [...state.shots, made].slice(-12);
      const newAcc = { ...state.zoneAcc };
      // gentle nudge
      newAcc[action.zone] = Math.max(0.15, Math.min(0.95,
        (newAcc[action.zone] ?? 0.5) + (made ? 0.03 : -0.02)));
      return {
        ...state,
        made: state.made + (made ? 1 : 0),
        att: state.att + 1,
        shots,
        pulseKey: state.pulseKey + 1,
        celebrate: action.burst,
        zone: action.zone,
        zoneAcc: newAcc,
        cursor: state.cursor + 1,
      };
    }
    case "clearBurst":
      return { ...state, celebrate: null };
    case "zone":
      return { ...state, zone: action.zone };
    case "reset":
      return initialState(action.scenario);
    default:
      return state;
  }
}

const App = () => {
  const [tweaks, setTweak] = window.useTweaks
    ? window.useTweaks(TWEAK_DEFAULTS)
    : [TWEAK_DEFAULTS, () => {}];

  const [state, dispatch] = useReducer(reducer, tweaks.scenario, initialState);
  const startRef = useRef(performance.now());
  const lastTickRef = useRef(performance.now());
  const cursorRef = useRef(0);

  // RESET when scenario changes
  useEffect(() => {
    dispatch({ type: "reset", scenario: tweaks.scenario });
    startRef.current = performance.now();
    lastTickRef.current = performance.now();
    cursorRef.current = 0;
  }, [tweaks.scenario]);

  // RAF loop — clock + ball position + scripted shots
  useEffect(() => {
    let raf;
    const loop = (now) => {
      const dt = (now - lastTickRef.current) * tweaks.speed;
      lastTickRef.current = now;

      // ball drift — figure 8 around rim area, suggests live tracking
      const t = (now - startRef.current) * 0.001 * tweaks.speed;
      const ballPos = {
        x: 195 + Math.sin(t * 1.2) * 90,
        y: 320 + Math.sin(t * 0.7) * 80 - Math.abs(Math.sin(t * 1.6)) * 30,
      };

      dispatch({ type: "tick", dt, ballPos });

      // scripted shots
      const sc = SCENARIOS[tweaks.scenario] ?? SCENARIOS.hot;
      const localT = (now - startRef.current) * tweaks.speed;
      while (
        cursorRef.current < sc.sequence.length &&
        sc.sequence[cursorRef.current].t <= localT
      ) {
        const ev = sc.sequence[cursorRef.current];
        dispatch({
          type: "shot",
          shot: ev.shot,
          zone: ev.zone,
          burst: tweaks.showCelebrations ? ev.burst : null,
        });
        cursorRef.current += 1;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tweaks.scenario, tweaks.speed, tweaks.showCelebrations]);

  // clear celebration burst after animation
  useEffect(() => {
    if (!state.celebrate) return;
    const id = setTimeout(() => dispatch({ type: "clearBurst" }), 1100);
    return () => clearTimeout(id);
  }, [state.celebrate, state.pulseKey]);

  const pct = state.att === 0 ? 0 : (state.made / state.att) * 100;

  // ───────── Tweaks panel ─────────
  const { TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakSlider, TweakToggle } = window;

  const Frame = window.IOSDevice;
  if (!Frame) return <div style={{color:"#fff"}}>Loading device frame…</div>;

  return (
    <div className="stage">
      <Frame width={390} height={844} dark>
        <div style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
          <CourtCameraBG />
          <div style={{ position: "absolute", inset: 0, opacity: tweaks.hudOpacity }}>
            <CameraHUD
              state={{ ...state, pct }}
              tweaks={tweaks}
              onEnd={() => dispatch({ type: "reset", scenario: tweaks.scenario })}
            />
          </div>
        </div>
      </Frame>

      <div className="stage__caption">Live Camera HUD · Phase 3 · Active Tracking</div>

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Mode">
            <TweakRadio
              label="HUD style"
              value={tweaks.mode}
              onChange={(v) => setTweak("mode", v)}
              options={[
                { value: "broadcast", label: "Broadcast" },
                { value: "minimal",   label: "Streamer" },
              ]}
            />
            <TweakSelect
              label="Scenario"
              value={tweaks.scenario}
              onChange={(v) => setTweak("scenario", v)}
              options={[
                { value: "hot",   label: "Heating up (12/18 → splash run)" },
                { value: "cold",  label: "Cold start (3/9 → finding rhythm)" },
                { value: "start", label: "Fresh session (0/0)" },
              ]}
            />
          </TweakSection>

          <TweakSection title="Behavior">
            <TweakSlider
              label="Sim speed"
              min={0.25} max={3} step={0.25}
              value={tweaks.speed}
              onChange={(v) => setTweak("speed", v)}
              unit="×"
            />
            <TweakToggle
              label="Celebrations"
              value={tweaks.showCelebrations}
              onChange={(v) => setTweak("showCelebrations", v)}
            />
          </TweakSection>

          <TweakSection title="Display">
            <TweakSlider
              label="Focus bracket"
              min={140} max={300} step={10}
              value={tweaks.focusSize}
              onChange={(v) => setTweak("focusSize", v)}
              unit="px"
            />
            <TweakSlider
              label="HUD opacity"
              min={50} max={100} step={5}
              value={Math.round(tweaks.hudOpacity * 100)}
              onChange={(v) => setTweak("hudOpacity", v / 100)}
              unit="%"
            />
            <TweakToggle
              label="Show detection boxes"
              value={tweaks.debug}
              onChange={(v) => setTweak("debug", v)}
            />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
