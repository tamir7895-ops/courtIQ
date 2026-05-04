// track-lab-shotchart.jsx — Mode-aware half-court shot chart for the Track Lab.
//
// Renders the approved CIQCourt asset (500×470) with zone-tiled overlays in
// three modes: SHOTS (every dot), HEATMAP (zone fill by FG%), FREQUENCY
// (zone fill by attempts). Zones tile the entire half-court — zero gaps.
//
// COORDINATE SYSTEM — CIQCourt 500×470:
//   • Rim (250, 52.5)         • Paint x∈[170,330] y∈[0,190]
//   • FT line y=190           • 3PT corner break y=142
//   • 3PT arc r=237.5 from rim center
//   • 3PT corner sidelines at x=30 and x=470
//
// Inbound shot coords arrive in the LEGACY 190×130 space (rim at top), and
// are remapped on render. Same factors as drill-library-anim.jsx but for
// 190×130 input rather than 280×176.

const TL_REMAP_X = 500 / 190;     // ≈ 2.632
const TL_REMAP_Y = 470 / 130;     // ≈ 3.615

// ── 9 zones tiling the entire 500×470 half-court ─────────────────────────
// Boundaries: real basketball lines (paint walls, corner-line extensions,
// FT-line extension, 3PT arc).
const TL_REAL_ZONES = [
  // PAINT — full paint rect
  { id: "pnt",    name: "PAINT",      path: "M 170 0 L 330 0 L 330 190 L 170 190 Z" },
  // CORNERS — strips above corner break (y < 142, outside corner-3 sideline)
  { id: "lc",     name: "L CORNER 3", path: "M 0 0 L 30 0 L 30 142 L 0 142 Z" },
  { id: "rc",     name: "R CORNER 3", path: "M 470 0 L 500 0 L 500 142 L 470 142 Z" },
  // MID L — column x∈[30,170], inside arc, baseline → arc
  // arc enters x=170 at y where (y-52.5)² = 237.5² - (170-250)² = 237.5² - 80²
  // → y-52.5 = sqrt(56406 - 6400) = sqrt(50006) ≈ 223.6 → y ≈ 276.1
  // For zone tiling we use y=222 as the FT-line-extended cutoff (matches MID/TOP MID split)
  { id: "ml",     name: "MID L",      path: "M 30 0 L 170 0 L 170 222 A 237.5 237.5 0 0 1 30 142 L 30 0 Z" },
  // MID R — mirror
  { id: "mr",     name: "MID R",      path: "M 330 0 L 470 0 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 0 Z" },
  // TOP MID — paint column above paint, inside arc, between FT line and arc apex
  { id: "topmid", name: "TOP MID",    path: "M 170 190 L 330 190 L 330 222 A 237.5 237.5 0 0 0 170 222 L 170 190 Z" },
  // L WING 3 — outside arc, x∈[0, ~250], from corner break down to half-court
  { id: "lw",     name: "L WING 3",   path: "M 0 142 L 30 142 A 237.5 237.5 0 0 0 170 222 L 170 470 L 0 470 L 0 142 Z" },
  // R WING 3 — mirror
  { id: "rw",     name: "R WING 3",   path: "M 500 142 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 470 L 500 470 L 500 142 Z" },
  // TOP 3 — outside arc, paint column down to half-court
  { id: "top",    name: "TOP 3",      path: "M 170 222 A 237.5 237.5 0 0 0 330 222 L 330 470 L 170 470 L 170 222 Z" },
];

const TL_ZONE_RENDER_ORDER = ["lc", "rc", "lw", "rw", "top", "ml", "mr", "topmid", "pnt"];
const TL_ZONE_ALIAS = { ml: "mid", mr: "mid", topmid: "mid" };

function tlHeatFill(acc, dim) {
  if (acc == null) return `rgba(255,255,255,${0.025 * dim})`;
  if (acc >= 0.55) {
    const t = Math.min(1, (acc - 0.5) * 2);
    return `rgba(86, 211, 100, ${(0.16 + 0.36 * t) * dim})`;
  }
  if (acc <= 0.40) {
    const t = Math.min(1, (0.5 - acc) * 2);
    return `rgba(232, 64, 64, ${(0.10 + 0.32 * t) * dim})`;
  }
  return `rgba(245, 166, 35, ${0.10 * dim})`;
}

function tlFreqFill(att, maxAtt, dim) {
  if (att === 0) return `rgba(255,255,255,${0.02 * dim})`;
  const t = att / maxAtt;
  return `rgba(255, 90, 60, ${(0.06 + 0.42 * t) * dim})`;
}

const TLShotChart = ({ shots, zones, mode = "heatmap", animate = true, highlight, hotZone, onZoneTap }) => {
  const accByZone = React.useMemo(() => {
    const m = {};
    zones.forEach(z => { m[z.id] = z.att === 0 ? null : z.made / z.att; });
    if (m.mid != null) { m.ml = m.mid; m.mr = m.mid; m.topmid = m.mid; }
    return m;
  }, [zones]);

  const attByZone = React.useMemo(() => {
    const m = {};
    zones.forEach(z => { m[z.id] = z.att; });
    if (m.mid != null) { m.ml = m.mid; m.mr = m.mid; m.topmid = m.mid; }
    return m;
  }, [zones]);

  const maxAtt = React.useMemo(() => Math.max(...zones.map(z => z.att)), [zones]);

  const isHL = (id) => {
    if (!highlight) return false;
    if (id === highlight) return true;
    if (TL_ZONE_ALIAS[id] && TL_ZONE_ALIAS[id] === highlight) return true;
    return false;
  };
  const isHotZone = (id) => {
    if (!hotZone) return false;
    if (id === hotZone) return true;
    if (TL_ZONE_ALIAS[id] && TL_ZONE_ALIAS[id] === hotZone) return true;
    return false;
  };

  const showShots = mode === "shots";

  return (
    <CIQCourt variant="full" tone="amber" className="tl-court">
      <defs>
        <radialGradient id="tl-make-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#56d364" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#56d364" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tl-miss-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e84040" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e84040" stopOpacity="0" />
        </radialGradient>
      </defs>

      {TL_ZONE_RENDER_ORDER.map(id => {
        const z = TL_REAL_ZONES.find(z => z.id === id);
        const acc = accByZone[id];
        const dim = highlight && !isHL(id) ? 0.30 : 1;
        let fill;
        if (mode === "heatmap")        fill = tlHeatFill(acc, dim);
        else if (mode === "frequency") fill = tlFreqFill(attByZone[id] || 0, maxAtt, dim);
        else                           fill = `rgba(255,255,255,${0.03 * dim})`;
        const active = isHL(id);
        const hotCls = (mode === "heatmap" && isHotZone(id)) ? " is-hot" : "";
        return (
          <path
            key={id}
            d={z.path}
            fill={fill}
            stroke={active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)"}
            strokeWidth={active ? 3 : 1.4}
            className={"tl-court__zone" + (active ? " is-active" : "") + hotCls}
            onClick={onZoneTap ? () => onZoneTap(TL_ZONE_ALIAS[id] || id) : undefined}
            style={{ cursor: onZoneTap ? "pointer" : "default" }}
          />
        );
      })}

      {/* SHOTS — only in SHOTS mode. Coords arrive in legacy 190×130 space → remap. */}
      {showShots && (
        <g className={animate ? "tl-court__shots is-anim" : "tl-court__shots"}>
          {shots.map((s, i) => {
            const dim = highlight && !isHL(s.zone) && s.zone !== highlight ? 0.20 : 1;
            const x = s.x * TL_REMAP_X;
            const y = s.y * TL_REMAP_Y;
            return (
              <g key={i} transform={`translate(${x}, ${y})`}
                 style={{ "--i": i, opacity: dim }}
                 className={"tl-shot " + (s.made ? "is-make" : "is-miss")}>
                <circle r="9" fill={s.made ? "url(#tl-make-glow)" : "url(#tl-miss-glow)"} />
                {s.made
                  ? <circle r="4" fill="#56d364" stroke="#0a0907" strokeWidth="1.2" />
                  : <g stroke="#e84040" strokeWidth="2.4" fill="none" strokeLinecap="round">
                      <line x1="-4" y1="-4" x2="4" y2="4" />
                      <line x1="-4" y1="4"  x2="4" y2="-4" />
                    </g>}
              </g>
            );
          })}
        </g>
      )}
    </CIQCourt>
  );
};

// Tiny thumbnail variant — heatmap only, no labels.
const TLMiniCourt = ({ thumb }) => {
  const presets = {
    "rw-hot":   { lc:0.5,  lw:0.3,  top:0.45, rw:0.75, rc:0.3,  mid:0.35, pnt:0.55 },
    "balanced": { lc:0.45, lw:0.42, top:0.5,  rw:0.5,  rc:0.4,  mid:0.42, pnt:0.5  },
    "cold":     { lc:0.3,  lw:0.28, top:0.32, rw:0.35, rc:0.25, mid:0.18, pnt:0.4  },
  };
  const heat = presets[thumb] || presets.balanced;
  const fill = (id) => {
    const a = heat[id];
    if (a == null) return "rgba(255,255,255,0.04)";
    if (a >= 0.55) return `rgba(86, 211, 100, ${0.16 + (a - 0.5) * 0.7})`;
    if (a <= 0.40) return `rgba(232, 64, 64, ${0.10 + (0.5 - a) * 0.5})`;
    return "rgba(245, 166, 35, 0.10)";
  };
  return (
    <CIQCourt variant="thumb" tone="amber">
      {TL_ZONE_RENDER_ORDER.map(id => {
        const z = TL_REAL_ZONES.find(z => z.id === id);
        const baseId = TL_ZONE_ALIAS[id] || id;
        return <path key={id} d={z.path} fill={fill(baseId)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />;
      })}
    </CIQCourt>
  );
};

window.TLShotChart = TLShotChart;
window.TLMiniCourt = TLMiniCourt;
window.TL_REAL_ZONES = TL_REAL_ZONES;
