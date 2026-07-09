// me-radar.jsx — 6-axis skill radar chart

const MeRadar = ({ skills, size = 200 }) => {
  const cx = size / 2, cy = size / 2;
  const rMax = size * 0.36;
  const n = skills.length;

  // Compute polar points for each skill (val 0-100)
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, t) => {
    const a = angle(i);
    return [cx + Math.cos(a) * rMax * t, cy + Math.sin(a) * rMax * t];
  };

  // grid rings
  const rings = [0.25, 0.5, 0.75, 1];

  // shape polygon
  const shape = skills.map((s, i) => pt(i, s.val / 100).join(",")).join(" ");
  // axis points (full extent) for labels
  const labelOffset = 1.22;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="me-radar">
      {/* grid hexagons */}
      {rings.map((t, idx) => {
        const pts = skills.map((_, i) => pt(i, t).join(",")).join(" ");
        return <polygon key={idx} points={pts} className="me-radar__grid" />;
      })}
      {/* axes */}
      {skills.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="me-radar__axis" />;
      })}
      {/* shape */}
      <polygon points={shape} className="me-radar__shape" />
      {/* points */}
      {skills.map((s, i) => {
        const [x, y] = pt(i, s.val / 100);
        return <circle key={s.id} cx={x} cy={y} r={2.6} className="me-radar__pt" />;
      })}
      {/* labels */}
      {skills.map((s, i) => {
        const a = angle(i);
        const x = cx + Math.cos(a) * rMax * labelOffset;
        const y = cy + Math.sin(a) * rMax * labelOffset;
        const anchor = Math.abs(Math.cos(a)) < 0.1 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        const baseline = Math.sin(a) > 0.5 ? "hanging" : Math.sin(a) < -0.5 ? "auto" : "middle";
        return (
          <text key={s.id} x={x} y={y} className="me-radar__lbl" textAnchor={anchor} dominantBaseline={baseline}>
            {s.name.split(" ")[0].toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
};

window.MeRadar = MeRadar;
