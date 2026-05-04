// track-lab-zone-sheet.jsx — slide-up zone detail sheet

const TLZoneSheet = ({ data, zoneId, onClose }) => {
  if (!zoneId) return null;
  const zone = data.zoneBreakdown.find(z => z.id === zoneId);
  if (!zone) return null;
  const fg = Math.round((zone.made / zone.att) * 100) || 0;
  const recs = (data.drillRecs && data.drillRecs[zoneId]) || [];

  // sparkline path from pct7d
  const pts = zone.pct7d;
  const W = 260, H = 40, P = 2;
  const max = Math.max(...pts, 60);
  const min = Math.min(...pts, 20);
  const span = Math.max(1, max - min);
  const xs = (i) => P + (i * (W - P * 2)) / (pts.length - 1);
  const ys = (v) => H - P - ((v - min) / span) * (H - P * 2);
  const d = pts.map((v, i) => (i === 0 ? "M" : "L") + xs(i) + "," + ys(v)).join(" ");
  const fillD = d + ` L ${xs(pts.length - 1)} ${H} L ${xs(0)} ${H} Z`;
  const cur = pts[pts.length - 1];

  return (
    <>
      <div className="tl-sheet-scrim" onClick={onClose} />
      <div className="tl-sheet" role="dialog" aria-modal="true">
        <div className="tl-sheet__handle" />
        <div className="tl-sheet__head">
          <div>
            <div className="tl-sheet__zone-lbl">ZONE · DETAIL</div>
            <div className="tl-sheet__title">{zone.name}</div>
          </div>
          <button className="tl-sheet__close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="tl-sheet__hero">
          <span className="tl-sheet__big">{fg}</span>
          <span className="tl-sheet__pct">%</span>
          <span className={"tl-sheet__delta " + (zone.delta >= 0 ? "is-up" : "is-down")}>
            {zone.delta >= 0 ? "▲" : "▼"} {Math.abs(zone.delta)} PTS
          </span>
        </div>
        <div className="tl-sheet__att">{zone.made} MADE · {zone.att} ATT · 7D</div>

        <div className="tl-sheet__sub-lbl">TREND · LAST 5 SESSIONS</div>
        <div className="tl-sheet__spark-card">
          <div className="tl-sheet__spark-row">
            <span style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(240,236,228,0.62)", fontWeight: 700 }}>FG%</span>
            <span className="tl-sheet__spark-cur">
              <span className="tl-sheet__spark-big">{cur}</span>
              <span className="tl-sheet__spark-sm">%</span>
            </span>
          </div>
          <svg className="tl-sheet__spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="tl-spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#56d364" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#56d364" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fillD} fill="url(#tl-spark-fill)" />
            <path d={d} fill="none" stroke="#56d364" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((v, i) => (
              <circle key={i} cx={xs(i)} cy={ys(v)} r={i === pts.length - 1 ? 2.6 : 1.4}
                fill="#56d364" stroke={i === pts.length - 1 ? "#0a0907" : "none"} strokeWidth="0.8" />
            ))}
          </svg>
        </div>

        {recs.length > 0 && (<>
          <div className="tl-sheet__sub-lbl">RECOMMENDED DRILLS</div>
          <ul className="tl-sheet__drills">
            {recs.map(r => (
              <li className="tl-drill-rec" key={r.id}>
                <div className="tl-drill-rec__icon">{r.level[0]}</div>
                <div>
                  <div className="tl-drill-rec__name">{r.name}</div>
                  <div className="tl-drill-rec__meta">{r.reps} REPS · {r.level}</div>
                </div>
                <button className="tl-drill-rec__cta">START</button>
              </li>
            ))}
          </ul>
        </>)}
      </div>
    </>
  );
};

window.TLZoneSheet = TLZoneSheet;
