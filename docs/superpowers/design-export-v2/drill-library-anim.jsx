// drill-library-anim.jsx — drill detail hero animation
// Renders the approved CIQCourt half-court SVG with the drill's `pattern`
// animated in a continuous 4-second loop on top.
//
// Legacy pattern coordinates were authored against a 280×176 viewBox with
// the rim at (140, 14). The CIQCourt asset is 500×470 with the rim at
// (250, 52.5), so we remap any legacy x/y on read via remap().

const REMAP_X = 500 / 280;     // ≈ 1.786
const REMAP_Y = 470 / 176;     // ≈ 2.670
const RIM_OLD = { x: 140, y: 14 };
const RIM_NEW = { x: 250, y: 52.5 };

const remap = (p) => ({
  x: p.x * REMAP_X,
  y: p.y * REMAP_Y,
  ...(p.label !== undefined ? { label: p.label } : {}),
  ...(p.kind !== undefined ? { kind: p.kind } : {}),
});

const remapSpots = (spots) => (spots || []).map(remap);
const remapPath = (path) => (path || []).map((seg) => ({
  ...seg,
  from: remap(seg.from),
  to:   remap(seg.to),
}));

const DLHeroAnim = ({ drill }) => {
  const W = 500, H = 470;

  // 4-second loop
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    let raf;
    let start = performance.now();
    const tick = (now) => {
      const elapsed = (now - start) / 1000;
      setT((elapsed % 4) / 4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rawPat = drill.pattern || { kind: "spot", spots: [{ x: 140, y: 60 }] };
  const isFull = rawPat.kind && rawPat.kind.startsWith("fullcourt");

  // Pre-remap pattern coords to court space
  const pat = React.useMemo(() => ({
    ...rawPat,
    spots: remapSpots(rawPat.spots),
    path:  rawPat.path ? remapPath(rawPat.path) : undefined,
  }), [rawPat]);

  const ball = computeBallPosition(pat, t, isFull);

  return (
    <CIQCourt variant="thumb" tone="blue" className="dl-hero-anim__svg">
      <defs>
        <radialGradient id="dl-ball-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8a3c" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ff8a3c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <PatternMarks pat={pat} t={t} />

      {ball && (
        <g>
          <circle cx={ball.x} cy={ball.y} r={20} fill="url(#dl-ball-glow)" />
          <circle cx={ball.x} cy={ball.y} r={7} fill="#ff8a3c" stroke="#0a0907" strokeWidth="1" />
          {ball.justScored && (
            <circle cx={RIM_NEW.x} cy={RIM_NEW.y} r={14 + ball.scoreAge * 14}
              fill="none" stroke="#56d364" strokeWidth="2" opacity={ball.scoreAge} />
          )}
        </g>
      )}
    </CIQCourt>
  );
};

// ── Pattern marks ──────────────────────────────────────────────────────────
const PatternMarks = ({ pat, t }) => {
  const spots = pat.spots || [];
  return (
    <g>
      {/* path lines (shuttle, stepback) */}
      {pat.path && pat.path.map((seg, i) => {
        const cls = seg.kind || "line";
        const stroke = cls === "fade" || cls === "stepback" ? "#56d364" : "#f0ece4";
        const dash = cls === "sprint" || cls === "drive" ? "0" : "5 5";
        const opacity = cls === "fade" ? 0.55 : 0.4;
        return (
          <line key={i} x1={seg.from.x} y1={seg.from.y} x2={seg.to.x} y2={seg.to.y}
            stroke={stroke} strokeWidth="2" strokeDasharray={dash} opacity={opacity} />
        );
      })}

      {/* spots / cones */}
      {spots.map((s, i) => {
        const phase = (t + i * 0.33) % 1;
        const pulse = 0.5 + Math.sin(phase * Math.PI * 2) * 0.5;
        const isCone = pat.kind === "cones";
        if (isCone) {
          return (
            <g key={i} transform={`translate(${s.x}, ${s.y})`}>
              <path d="M -8 8 L 8 8 L 3 -8 L -3 -8 Z" fill="#f5a623" stroke="#0a0907" strokeWidth="1" />
              <path d="M -6 0 L 6 0" stroke="#0a0907" strokeWidth="1" />
            </g>
          );
        }
        return (
          <g key={i}>
            <circle cx={s.x} cy={s.y} r={12 + pulse * 8} fill="none" stroke="#56d364" strokeWidth="2" opacity={0.4 + pulse * 0.4} />
            <circle cx={s.x} cy={s.y} r="6" fill="#56d364" />
            {s.label && (
              <text x={s.x} y={s.y + 28} fontSize="13" fill="#56d364" textAnchor="middle"
                fontFamily="JetBrains Mono, monospace" fontWeight="700" letterSpacing="0.04em">{s.label}</text>
            )}
          </g>
        );
      })}

      {/* defense / agility / full-court patterns — built directly in court coords */}
      {pat.kind === "slide-box" && <SlideBoxAnim t={t} />}
      {pat.kind === "closeout" && <CloseoutAnim t={t} />}
      {pat.kind === "shell" && <ShellAnim t={t} />}
      {pat.kind === "x-out" && <XOutAnim t={t} />}
      {pat.kind === "ladder" && <LadderAnim t={t} />}
      {pat.kind === "fullcourt-zigzag" && <ZigzagAnim t={t} />}
      {pat.kind === "fullcourt-press" && <PressAnim t={t} />}
      {pat.kind === "fullcourt-suicide" && <SuicideAnim t={t} />}
    </g>
  );
};

// ── Ball position helper ──────────────────────────────────────────────────
function computeBallPosition(pat, t, isFull) {
  if (isFull) return null;

  if (pat.kind === "shuttle" || pat.kind === "stepback") {
    const path = pat.path || [];
    if (path.length === 0) return null;
    const seg = Math.floor(t * path.length);
    const localT = (t * path.length) % 1;
    const s = path[seg % path.length];
    const x = s.from.x + (s.to.x - s.from.x) * easeInOut(localT);
    const y = s.from.y + (s.to.y - s.from.y) * easeInOut(localT);
    const isShoot = s.kind === "fade" || s.kind === "stepback" || s.kind === "drive";
    const justScored = isShoot && localT > 0.85;
    const scoreAge = justScored ? (1 - localT) / 0.15 : 0;
    return { x, y, justScored, scoreAge };
  }

  if (pat.kind === "5spot") {
    const spots = pat.spots || [];
    if (spots.length === 0) return null;
    const seg = Math.floor(t * spots.length);
    const localT = (t * spots.length) % 1;
    const from = spots[seg % spots.length];
    if (localT < 0.5) {
      const lt = localT * 2;
      const x = from.x + (RIM_NEW.x - from.x) * lt;
      const yLin = from.y + (RIM_NEW.y - from.y) * lt;
      const arc = -Math.sin(lt * Math.PI) * 60;
      return { x, y: yLin + arc };
    } else {
      const next = spots[(seg + 1) % spots.length];
      return { x: next.x, y: next.y };
    }
  }

  if (pat.kind === "spot") {
    const spots = pat.spots || [];
    if (spots.length === 0) return null;
    const s = spots[Math.floor(t * spots.length) % spots.length];
    return { x: s.x, y: s.y };
  }

  if (pat.kind === "pullup") {
    const spots = pat.spots || [{ x: 250, y: 250 }];
    const seg = Math.floor(t * spots.length);
    const s = spots[seg % spots.length];
    const localT = (t * spots.length) % 1;
    if (localT < 0.5) {
      const lt = localT * 2;
      return { x: s.x, y: s.y + (1 - lt) * 80 };
    } else {
      const lt = (localT - 0.5) * 2;
      const arc = -Math.sin(lt * Math.PI) * 50;
      return { x: s.x + (RIM_NEW.x - s.x) * lt, y: s.y + (RIM_NEW.y - s.y) * lt + arc };
    }
  }

  if (pat.kind === "cones") {
    const spots = pat.spots || [];
    if (spots.length === 0) return { x: 250, y: 290 };
    const seg = Math.floor(t * spots.length);
    const localT = (t * spots.length) % 1;
    const a = spots[seg % spots.length];
    const b = spots[(seg + 1) % spots.length];
    return {
      x: a.x + (b.x - a.x) * easeInOut(localT),
      y: a.y + (b.y - a.y) * easeInOut(localT) + Math.sin(localT * Math.PI) * 12,
    };
  }

  return null;
}

const easeInOut = (t) => t * t * (3 - 2 * t);

// ── Defender glyph ────────────────────────────────────────────────────────
const Defender = ({ x, y }) => (
  <g transform={`translate(${x}, ${y})`}>
    <circle r="6" fill="#fff" />
    <path d="M -10 0 L 10 0" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
  </g>
);

// All animations rebuilt in 500×470 court space.
const SlideBoxAnim = ({ t }) => {
  const corners = [
    { x: 200, y: 50 }, { x: 300, y: 50 },
    { x: 300, y: 160 }, { x: 200, y: 160 },
  ];
  const seg = Math.floor(t * 4);
  const localT = (t * 4) % 1;
  const a = corners[seg % 4];
  const b = corners[(seg + 1) % 4];
  return (
    <g>
      <path d="M 200 50 L 300 50 L 300 160 L 200 160 Z" fill="none" stroke="#56d364" strokeWidth="2" strokeDasharray="5 5" opacity="0.4" />
      {corners.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="6" fill="#56d364" />
      ))}
      <Defender x={a.x + (b.x - a.x) * easeInOut(localT)} y={a.y + (b.y - a.y) * easeInOut(localT)} />
    </g>
  );
};

const CloseoutAnim = ({ t }) => {
  const seg = Math.floor(t * 2);
  const localT = (t * 2) % 1;
  const isLeft = seg % 2 === 0;
  const fromX = 250, fromY = 130;
  const toX = isLeft ? 90 : 410, toY = 220;
  const choppy = localT > 0.7 ? Math.sin(localT * 60) * 3 : 0;
  const x = fromX + (toX - fromX) * easeInOut(localT);
  const y = fromY + (toY - fromY) * easeInOut(localT) + choppy;
  return (
    <g>
      <line x1={fromX} y1={fromY} x2={toX} y2={toY} stroke="#56d364" strokeDasharray="5 5" strokeWidth="2" opacity="0.4" />
      <circle cx={fromX} cy={fromY} r="6" fill="#56d364" />
      <circle cx={toX} cy={toY} r="7" fill="none" stroke="#56d364" strokeWidth="2.4" />
      <Defender x={x} y={y} />
      {localT > 0.7 && <text x={toX} y={toY - 20} fontSize="13" fill="#56d364" textAnchor="middle"
        fontFamily="JetBrains Mono" fontWeight="700">CHOP</text>}
    </g>
  );
};

const ShellAnim = ({ t }) => {
  const ballAngle = t * Math.PI * 2;
  const ballX = 250 + Math.cos(ballAngle) * 180;
  const ballY = 200 + Math.sin(ballAngle) * 90;
  const positions = [
    { x: 160, y: 120 }, { x: 340, y: 120 },
    { x: 200, y: 200 }, { x: 300, y: 200 },
  ];
  return (
    <g>
      <path d="M 160 120 L 340 120 L 300 200 L 200 200 Z" fill="rgba(86,211,100,0.06)" stroke="#56d364" strokeWidth="2" opacity="0.6" />
      {positions.map((p, i) => <Defender key={i} x={p.x} y={p.y} />)}
      <circle cx={ballX} cy={ballY} r="8" fill="#ff8a3c" />
    </g>
  );
};

const XOutAnim = ({ t }) => {
  const path = [
    { x: 250, y: 130 }, { x: 50, y: 100 },
    { x: 250, y: 130 }, { x: 450, y: 100 },
  ];
  const seg = Math.floor(t * 4);
  const localT = (t * 4) % 1;
  const a = path[seg % 4];
  const b = path[(seg + 1) % 4];
  return (
    <g>
      <line x1="250" y1="130" x2="50" y2="100" stroke="#56d364" strokeDasharray="5 5" strokeWidth="2" opacity="0.4" />
      <line x1="250" y1="130" x2="450" y2="100" stroke="#56d364" strokeDasharray="5 5" strokeWidth="2" opacity="0.4" />
      <circle cx="250" cy="130" r="6" fill="#56d364" />
      <circle cx="50"  cy="100" r="6" fill="none" stroke="#56d364" strokeWidth="2.4" />
      <circle cx="450" cy="100" r="6" fill="none" stroke="#56d364" strokeWidth="2.4" />
      <Defender x={a.x + (b.x - a.x) * easeInOut(localT)} y={a.y + (b.y - a.y) * easeInOut(localT)} />
    </g>
  );
};

const LadderAnim = ({ t }) => {
  const rungs = 8;
  return (
    <g>
      <rect x="180" y="120" width="140" height="260" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
      {Array.from({ length: rungs }, (_, i) => (
        <line key={i} x1="180" y1={140 + i * 32} x2="320" y2={140 + i * 32}
          stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
      ))}
      {Array.from({ length: rungs }, (_, i) => {
        const phase = (t + i * 0.12) % 1;
        if (phase > 0.4) return null;
        const y = 154 + i * 32;
        const opacity = 1 - phase / 0.4;
        return (
          <g key={i} opacity={opacity}>
            <circle cx="220" cy={y} r="5" fill="#56d364" />
            <circle cx="280" cy={y} r="5" fill="#56d364" />
          </g>
        );
      })}
    </g>
  );
};

const ZigzagAnim = ({ t }) => {
  const path = [
    { x: 250, y: 60 },  { x: 160, y: 130 },
    { x: 340, y: 200 }, { x: 160, y: 270 },
    { x: 340, y: 340 }, { x: 250, y: 420 },
  ];
  const seg = Math.floor(t * (path.length - 1));
  const localT = (t * (path.length - 1)) % 1;
  const a = path[Math.min(seg, path.length - 2)];
  const b = path[Math.min(seg + 1, path.length - 1)];
  return (
    <g>
      <path d={path.map((p, i) => (i === 0 ? "M" : "L") + p.x + " " + p.y).join(" ")}
        fill="none" stroke="#f0ece4" strokeWidth="2" strokeDasharray="5 5" opacity="0.35" />
      <circle cx={a.x + (b.x - a.x) * easeInOut(localT)}
              cy={a.y + (b.y - a.y) * easeInOut(localT)}
              r="8" fill="#ff8a3c" />
    </g>
  );
};

const PressAnim = ({ t }) => (
  <g>
    <path d="M 110 90 L 250 220 L 390 90" fill="none" stroke="#56d364" strokeWidth="2" strokeDasharray="5 5" opacity="0.4" />
    <Defender x={110 + Math.sin(t * Math.PI * 2) * 14} y={90} />
    <Defender x={390 + Math.sin(t * Math.PI * 2 + 1) * 14} y={90} />
    <Defender x={250} y={220} />
    <circle cx={250 + Math.cos(t * Math.PI * 2) * 18}
            cy={140 + Math.sin(t * Math.PI * 2) * 18}
            r="8" fill="#ff8a3c" />
  </g>
);

const SuicideAnim = ({ t }) => {
  // baselines + FT line + half — vertical hierarchy on 500×470 court
  const lines = [
    { y: 440, label: "BASE" },     // start
    { y: 330 },                     // far FT
    { y: 250 },                     // half
    { y: 190 },                     // near FT
    { y: 60,  label: "RIM" },      // baseline (rim end)
  ];
  const cycles = 4;
  const seg = Math.floor(t * cycles * 2);
  const localT = (t * cycles * 2) % 1;
  const cycleI = Math.floor(seg / 2);
  const target = lines[cycleI + 1] || lines[1];
  const start = lines[0];
  const a = seg % 2 === 0 ? start : target;
  const b = seg % 2 === 0 ? target : start;
  return (
    <g>
      {lines.map((l, i) => (
        <line key={i} x1="60" y1={l.y} x2="440" y2={l.y}
          stroke={i === cycleI + 1 ? "#56d364" : "rgba(255,255,255,0.18)"}
          strokeWidth={i === cycleI + 1 ? 2.4 : 1.4} strokeDasharray="5 5" />
      ))}
      <circle cx="250" cy={a.y + (b.y - a.y) * easeInOut(localT)} r="8" fill="#ff8a3c" />
    </g>
  );
};

window.DLHeroAnim = DLHeroAnim;
