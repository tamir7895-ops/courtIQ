// camera-hud-overlay.jsx
// The HUD itself — broadcast-quality overlay.
// Layout regions:
//   • Top-left:    MADE / ATT scoreboard
//   • Top-center:  LIVE pill + zone
//   • Top-right:   timer
//   • Mid-center:  detection bracket (sniper-bracket, brand pillar = Focus/Target)
//   • Right rail:  zone court mini + last 5 shot string
//   • Bottom:      hero FG% + END SESSION
//   • Center burst: SWISH / HEATING UP / SPLASH celebration overlays

const ScoreboardCorner = ({ made, att, label, accent }) => (
  <div className="hud-score">
    <div className="hud-score__label" style={{color: accent}}>{label}</div>
    <div className="hud-score__num" style={{color: accent}}>{String(made).padStart(2,"0")}</div>
    <div className="hud-score__sep">/</div>
    <div className="hud-score__att">{String(att).padStart(2,"0")}</div>
  </div>
);

const LivePill = ({ phase, ai }) => {
  const onAir = phase === "live";
  return (
    <div className={"hud-live " + (onAir ? "is-on" : "")}>
      <span className="hud-live__dot" />
      <span className="hud-live__txt">{onAir ? "LIVE" : "SYNCING"}</span>
      <span className="hud-live__sep">·</span>
      <span className="hud-live__ai">{ai}</span>
    </div>
  );
};

const Timer = ({ ms }) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return (
    <div className="hud-timer">
      <div className="hud-timer__lbl">SESSION</div>
      <div className="hud-timer__val"><span>{m}</span><span className="hud-timer__col">:</span><span>{s}</span></div>
    </div>
  );
};

// the brand "Focus/Target" pillar — corner brackets that snap inward
// when AI detection locks onto an object. Pulses on each detected event.
const FocusBrackets = ({ size = 220, locked = true, pulseKey = 0 }) => {
  const arm = 22, gap = size / 2 - 4, t = 2.4;
  return (
    <div className="hud-focus" style={{width: size, height: size}}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {/* corner brackets */}
        <g stroke="currentColor" strokeWidth={t} fill="none" strokeLinecap="square">
          {/* TL */}
          <path d={`M ${size/2 - gap} ${size/2 - gap + arm} L ${size/2 - gap} ${size/2 - gap} L ${size/2 - gap + arm} ${size/2 - gap}`} />
          {/* TR */}
          <path d={`M ${size/2 + gap - arm} ${size/2 - gap} L ${size/2 + gap} ${size/2 - gap} L ${size/2 + gap} ${size/2 - gap + arm}`} />
          {/* BR */}
          <path d={`M ${size/2 + gap} ${size/2 + gap - arm} L ${size/2 + gap} ${size/2 + gap} L ${size/2 + gap - arm} ${size/2 + gap}`} />
          {/* BL */}
          <path d={`M ${size/2 - gap + arm} ${size/2 + gap} L ${size/2 - gap} ${size/2 + gap} L ${size/2 - gap} ${size/2 + gap - arm}`} />
        </g>
        {/* center crosshair micro-tick */}
        <g stroke="currentColor" strokeWidth="1.4" opacity="0.55">
          <line x1={size/2 - 6} y1={size/2} x2={size/2 + 6} y2={size/2} />
          <line x1={size/2} y1={size/2 - 6} x2={size/2} y2={size/2 + 6} />
        </g>
        {/* tick marks on each axis */}
        <g stroke="currentColor" strokeWidth="1" opacity="0.45">
          {[-1, 1].map((d) => (
            <g key={d}>
              <line x1={size/2 + d * 30} y1={size/2 - 3} x2={size/2 + d * 30} y2={size/2 + 3} />
              <line x1={size/2 - 3} y1={size/2 + d * 30} x2={size/2 + 3} y2={size/2 + d * 30} />
            </g>
          ))}
        </g>
        {/* animated detection ring on pulse */}
        <circle key={pulseKey} className="hud-focus__pulse" cx={size/2} cy={size/2} r={26} stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
      <div className="hud-focus__rail">
        <span className="hud-focus__chip">RIM · LOCKED</span>
        <span className="hud-focus__chip">3PT · {locked ? "CALIBRATED" : "PARTIAL"}</span>
      </div>
    </div>
  );
};

// 7-zone half-court mini, drawn in CIQCourt's 500×470 coordinate space.
// Mid-range collapses ml/mr/topmid into a single MID-RANGE polygon for the
// HUD's smaller surface — same geometry as TLShotChart, just unified.
const ZONES = [
  { id: "lc",  name: "L CORNER 3", path: "M 0 0 L 30 0 L 30 142 L 0 142 Z" },
  { id: "rc",  name: "R CORNER 3", path: "M 470 0 L 500 0 L 500 142 L 470 142 Z" },
  { id: "lw",  name: "L WING 3",   path: "M 0 142 L 30 142 A 237.5 237.5 0 0 0 170 222 L 170 470 L 0 470 L 0 142 Z" },
  { id: "rw",  name: "R WING 3",   path: "M 500 142 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 470 L 500 470 L 500 142 Z" },
  { id: "top", name: "TOP 3",      path: "M 170 222 A 237.5 237.5 0 0 0 330 222 L 330 470 L 170 470 L 170 222 Z" },
  { id: "mid", name: "MID-RANGE",  path: "M 30 0 L 170 0 L 170 222 A 237.5 237.5 0 0 1 30 142 L 30 0 Z M 330 0 L 470 0 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 0 Z M 170 190 L 330 190 L 330 222 A 237.5 237.5 0 0 0 170 222 L 170 190 Z" },
  { id: "pnt", name: "PAINT",      path: "M 170 0 L 330 0 L 330 190 L 170 190 Z" },
];

const ZoneMini = ({ activeZone, accuracyByZone }) => {
  return (
    <div className="hud-zone">
      <div className="hud-zone__label">ZONE</div>
      <CIQCourt variant="thumb" tone="blue" className="hud-zone__svg">
        {ZONES.map((z) => {
          const active = z.id === activeZone;
          const acc = accuracyByZone[z.id] ?? null;
          const fill = active
            ? "rgba(86,211,100,0.32)"
            : acc != null
              ? `rgba(86,211,100,${0.05 + 0.18 * acc})`
              : "rgba(255,255,255,0.03)";
          return (
            <path key={z.id} d={z.path} fillRule="evenodd"
              fill={fill}
              stroke={active ? "#56d364" : "rgba(255,255,255,0.18)"}
              strokeWidth={active ? 4 : 2} />
          );
        })}
      </CIQCourt>
      <div className="hud-zone__name">{ZONES.find(z => z.id === activeZone)?.name ?? "—"}</div>
    </div>
  );
};

// last 5 attempts as scoreboard pips
const RecentString = ({ shots }) => {
  const lastFive = shots.slice(-5);
  while (lastFive.length < 5) lastFive.unshift(null);
  return (
    <div className="hud-recent">
      <div className="hud-recent__lbl">LAST 5</div>
      <div className="hud-recent__row">
        {lastFive.map((s, i) => (
          <span
            key={i}
            className={
              "hud-recent__pip " +
              (s == null ? "is-empty" : s ? "is-make" : "is-miss")
            }
          >
            {s == null ? "·" : s ? "M" : "X"}
          </span>
        ))}
      </div>
    </div>
  );
};

// big bottom hero — FG% as the dominant element on the HUD
const HeroPercent = ({ pct }) => {
  return (
    <div className="hud-hero">
      <div className="hud-hero__label">FIELD GOAL</div>
      <div className="hud-hero__num">
        <span className="hud-hero__int">{Math.floor(pct)}</span>
        <span className="hud-hero__pct">%</span>
      </div>
      <div className="hud-hero__delta">
        <span className="hud-hero__arrow">▲</span> +4 vs last session
      </div>
    </div>
  );
};

// celebration burst — italic "SWISH" / "HEATING UP" overlay
const Celebrate = ({ kind }) => {
  if (!kind) return null;
  const map = {
    swish: { txt: "SWISH", color: "#56d364", sub: "+2" },
    heating: { txt: "HEATING UP", color: "#f5a623", sub: "3 IN A ROW" },
    splash: { txt: "SPLASH PARTY", color: "#ff3a14", sub: "5 IN A ROW · COOKING" },
    miss: { txt: "OFF", color: "rgba(232,64,64,0.85)", sub: "" },
  };
  const c = map[kind];
  return (
    <div className="hud-burst" key={kind + Math.random()}>
      <div
        className="hud-burst__txt"
        style={{ color: c.color, textShadow: `0 0 40px ${c.color}` }}
      >
        {c.txt}
      </div>
      {c.sub && <div className="hud-burst__sub">{c.sub}</div>}
      <div
        className={"hud-burst__vignette " + kind}
        style={{ "--burst-c": c.color }}
      />
    </div>
  );
};

// detection box — appears around the ball/rim only when DEBUG is on.
// Off by default in production; available via tweaks.
const DetectionBoxes = ({ visible, ballPos }) => {
  if (!visible) return null;
  return (
    <svg className="hud-debug" viewBox="0 0 390 690" preserveAspectRatio="none">
      {/* rim */}
      <g>
        <rect x="170" y="166" width="55" height="22" fill="none" stroke="#56d364" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x="172" y="161" fill="#56d364" fontFamily="SF Mono, monospace" fontSize="9">RIM 0.94</text>
      </g>
      {/* ball */}
      <g transform={`translate(${ballPos.x}, ${ballPos.y})`}>
        <rect x="-14" y="-14" width="28" height="28" fill="none" stroke="#f5a623" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x="-12" y="-18" fill="#f5a623" fontFamily="SF Mono, monospace" fontSize="9">BALL 0.88</text>
      </g>
    </svg>
  );
};

// the HUD shell — composes all the pieces above
const CameraHUD = ({ state, tweaks, onEnd }) => {
  return (
    <div className="hud" data-mode={tweaks.mode}>
      {/* TOP BAR */}
      <div className="hud-top">
        <ScoreboardCorner made={state.made} att={state.att} label="MADE" accent="#56d364" />
        <LivePill phase={state.phase} ai="AI TRACKING" />
        <Timer ms={state.elapsed} />
      </div>

      {/* TOP RIGHT — zone mini + recent (rail) */}
      <div className="hud-rail">
        <ZoneMini activeZone={state.zone} accuracyByZone={state.zoneAcc} />
        <RecentString shots={state.shots} />
      </div>

      {/* CENTER — detection bracket */}
      <div className="hud-center">
        <FocusBrackets locked size={tweaks.focusSize} pulseKey={state.pulseKey} />
      </div>

      {/* DEBUG (off by default) */}
      <DetectionBoxes visible={tweaks.debug} ballPos={state.ballPos} />

      {/* BOTTOM HERO */}
      <div className="hud-bottom">
        <HeroPercent pct={state.pct} />
        <button className="hud-end" onClick={onEnd}>
          <span className="hud-end__icon" />
          <span className="hud-end__txt">END SESSION</span>
        </button>
      </div>

      {/* CELEBRATION BURST */}
      <Celebrate kind={state.celebrate} />
    </div>
  );
};

window.CameraHUD = CameraHUD;
