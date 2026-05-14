// post-session-shotchart.jsx — Half-court shot chart for the post-session recap.
//
// Renders the approved CIQCourt asset (500×470) with zone-tiled overlays
// colored by FG% (heatmap), plus animated shot dots arriving in the legacy
// 190×130 input coord space.
//
// Same geometry as track-lab-shotchart.jsx — kept as a separate component
// so post-session can evolve its own visual style if needed (e.g. shot
// labels, time-based reveal).

const PS_REMAP_X = 500 / 190;
const PS_REMAP_Y = 470 / 130;

// Zones tile the whole 500×470 half-court — identical geometry to TL chart.
const REAL_ZONES = [
  { id: "pnt",    name: "PAINT",      path: "M 170 0 L 330 0 L 330 190 L 170 190 Z" },
  { id: "lc",     name: "L CORNER 3", path: "M 0 0 L 30 0 L 30 142 L 0 142 Z" },
  { id: "rc",     name: "R CORNER 3", path: "M 470 0 L 500 0 L 500 142 L 470 142 Z" },
  { id: "ml",     name: "MID L",      path: "M 30 0 L 170 0 L 170 222 A 237.5 237.5 0 0 1 30 142 L 30 0 Z" },
  { id: "mr",     name: "MID R",      path: "M 330 0 L 470 0 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 0 Z" },
  { id: "topmid", name: "TOP MID",    path: "M 170 190 L 330 190 L 330 222 A 237.5 237.5 0 0 0 170 222 L 170 190 Z" },
  { id: "lw",     name: "L WING 3",   path: "M 0 142 L 30 142 A 237.5 237.5 0 0 0 170 222 L 170 470 L 0 470 L 0 142 Z" },
  { id: "rw",     name: "R WING 3",   path: "M 500 142 L 470 142 A 237.5 237.5 0 0 1 330 222 L 330 470 L 500 470 L 500 142 Z" },
  { id: "top",    name: "TOP 3",      path: "M 170 222 A 237.5 237.5 0 0 0 330 222 L 330 470 L 170 470 L 170 222 Z" },
];

const ZONE_RENDER_ORDER = ["lc", "rc", "lw", "rw", "top", "ml", "mr", "topmid", "pnt"];

const ShotChart = ({ shots, zones, animate = true, highlight = null, onZoneTap }) => {
  const accByZone = React.useMemo(() => {
    const map = {};
    zones.forEach(z => { map[z.id] = z.att === 0 ? null : z.made / z.att; });
    if (map.mid != null) { map.ml = map.mid; map.mr = map.mid; map.topmid = map.mid; }
    return map;
  }, [zones]);

  const zoneAlias = { ml: "mid", mr: "mid", topmid: "mid" };
  const isHighlighted = (id) => {
    if (!highlight) return false;
    if (id === highlight) return true;
    if (zoneAlias[id] && zoneAlias[id] === highlight) return true;
    return false;
  };

  return (
    <CIQCourt variant="full" tone="amber" className="ps-court">
      <defs>
        <radialGradient id="ps-make-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#56d364" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#56d364" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ps-miss-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e84040" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e84040" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── ZONE FILLS (tile the whole court) ── */}
      {ZONE_RENDER_ORDER.map(id => {
        const z = REAL_ZONES.find(z => z.id === id);
        const acc = accByZone[id];
        const dim = highlight && !isHighlighted(id) ? 0.30 : 1;
        let fill;
        if (acc == null) {
          fill = `rgba(255,255,255,${0.04 * dim})`;
        } else if (acc >= 0.55) {
          fill = `rgba(86, 211, 100, ${(0.18 + 0.40 * Math.min(1, (acc - 0.5) * 2)) * dim})`;
        } else if (acc <= 0.40) {
          fill = `rgba(232, 64, 64, ${(0.14 + 0.36 * Math.min(1, (0.5 - acc) * 2)) * dim})`;
        } else {
          fill = `rgba(245, 166, 35, ${0.14 * dim})`;
        }
        const active = isHighlighted(id);
        return (
          <path
            key={id}
            d={z.path}
            fill={fill}
            stroke={active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)"}
            strokeWidth={active ? 3 : 1.4}
            className={"ps-court__zone" + (active ? " is-active" : "")}
            onClick={onZoneTap ? () => onZoneTap(zoneAlias[id] || id) : undefined}
            style={{ cursor: onZoneTap ? "pointer" : "default" }}
            data-zone={id}
          />
        );
      })}

      {/* ── SHOTS ── coords in legacy 190×130 input space, remap on render */}
      <g className={animate ? "ps-court__shots is-anim" : "ps-court__shots"}>
        {shots.map((s, i) => {
          const x = s.x * PS_REMAP_X;
          const y = s.y * PS_REMAP_Y;
          return (
            <g
              key={i}
              transform={`translate(${x}, ${y})`}
              style={{ "--i": i, opacity: highlight && !isHighlighted(s.zone) && s.zone !== highlight ? 0.20 : 1 }}
              className={"ps-shot " + (s.made ? "is-make" : "is-miss")}
            >
              <circle r="10" fill={s.made ? "url(#ps-make-glow)" : "url(#ps-miss-glow)"} />
              {s.made ? (
                <circle r="5" fill="#56d364" stroke="#0a0907" strokeWidth="1.2" />
              ) : (
                <g stroke="#e84040" strokeWidth="2.4" fill="none" strokeLinecap="round">
                  <line x1="-4.5" y1="-4.5" x2="4.5" y2="4.5" />
                  <line x1="-4.5" y1="4.5"  x2="4.5" y2="-4.5" />
                </g>
              )}
            </g>
          );
        })}
      </g>
    </CIQCourt>
  );
};

window.ShotChart = ShotChart;
window.REAL_ZONES = REAL_ZONES;
window.ZONE_RENDER_ORDER = ZONE_RENDER_ORDER;
