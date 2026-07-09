// ciq-court.jsx — Single source of truth for the half-court illustration.
//
// Wraps the approved /half-court.svg asset, applies the CourtIQ stroke / fill
// styling locally (the asset itself uses CSS classes like .cl, .paint-fill, .rim),
// and exposes a stable coordinate system so drill animations, shot charts, and
// zone overlays all live in the same space.
//
// COORDINATE SYSTEM (matches the asset 1:1):
//   viewBox 0 0 500 470
//   • Baseline    y = 0    (top)
//   • Rim center  (250, 52.5)
//   • Paint       x ∈ [170, 330], y ∈ [0, 190]
//   • FT line     y = 190
//   • 3PT corners (30, 0..142) and (470, 0..142)
//   • 3PT arc     center (250, 52.5), radius 237.5
//   • Half-court  y = 470
//
// All consumer code passes coordinates in this 500×470 space, then this
// component fits them into whatever container width via preserveAspectRatio.
//
// USAGE
//   <CIQCourt>
//     <circle cx={250} cy={120} r={6} fill="var(--accent)" />
//     <text x={250} y={250} textAnchor="middle">Top of key</text>
//   </CIQCourt>
//
// PROPS
//   variant       "full" | "thumb"   — thumb hides backboard label, dims fills
//   tone          "blue" | "neutral" | "amber" — tints the court background
//   className     extra className on the wrapping <svg>
//   style         extra inline style
//   children      anything you want overlaid in court coordinates

const CIQ_COURT_VIEWBOX = "0 0 500 470";
const CIQ_COURT_RIM = { cx: 250, cy: 52.5 };
const CIQ_COURT_PAINT = { x: 170, y: 0, w: 160, h: 190 };
const CIQ_COURT_W = 500;
const CIQ_COURT_H = 470;

// ── Embedded copy of the approved /half-court.svg path data ──────────────
// We keep the geometry inline (rather than <use href>) so styling is local
// and there are no cross-origin / fragment-reference issues. If the asset
// file changes shape, sync this block.
const CIQCourtBackground = ({ variant = "full" }) => {
  const dim = variant === "thumb";
  return (
    <g className="ciq-court__bg">
      <defs>
        {/* Clip the 3PT arc so it stops at the corner-3 line (y=142) */}
        <clipPath id="ciq-c3"><rect x="0" y="142" width="500" height="328" /></clipPath>
        {/* FT-circle bottom half (solid) and top half (dashed) */}
        <clipPath id="ciq-ftb"><rect x="0" y="190" width="500" height="280" /></clipPath>
        <clipPath id="ciq-ftt"><rect x="0" y="0"   width="500" height="190" /></clipPath>
        {/* Restricted area sits below baseline */}
        <clipPath id="ciq-ra"><rect x="0" y="40" width="500" height="430" /></clipPath>
        {/* Half-court arc (only its top half is visible above the line) */}
        <clipPath id="ciq-cc"><rect x="0" y="410" width="500" height="60" /></clipPath>
      </defs>

      {/* Floor */}
      <rect width="500" height="470" rx="4" className="ciq-court__floor" />
      <rect x="1" y="1" width="498" height="468" rx="3" className="ciq-court__line" />

      {/* Paint */}
      <rect {...{ x: 170, y: 0, width: 160, height: 190 }} className="ciq-court__paint" />
      <rect {...{ x: 170, y: 0, width: 160, height: 190 }} className="ciq-court__line" />

      {/* FT circle (solid lower half + dashed upper half) */}
      <circle cx="250" cy="190" r="60" className="ciq-court__line"   clipPath="url(#ciq-ftb)" />
      <circle cx="250" cy="190" r="60" className="ciq-court__line-d" clipPath="url(#ciq-ftt)" />

      {/* Lane hash marks */}
      {[70, 80, 110, 140].map(y => (
        <React.Fragment key={"l" + y}>
          <line x1="162" y1={y} x2="170" y2={y} className="ciq-court__line" />
          <line x1="330" y1={y} x2="338" y2={y} className="ciq-court__line" />
        </React.Fragment>
      ))}

      {/* Corner-3 sidelines */}
      <line x1="30"  y1="0" x2="30"  y2="142" className="ciq-court__line" />
      <line x1="470" y1="0" x2="470" y2="142" className="ciq-court__line" />

      {/* 3PT arc */}
      <circle cx="250" cy="52.5" r="237.5" className="ciq-court__line" clipPath="url(#ciq-c3)" />

      {/* Restricted area */}
      <circle cx="250" cy="52.5" r="40" className="ciq-court__line" clipPath="url(#ciq-ra)" />

      {/* Backboard */}
      <line x1="220" y1="40" x2="280" y2="40" className="ciq-court__backboard" />

      {/* Rim */}
      <circle cx="250" cy="52.5" r="7.5" className="ciq-court__rim" />

      {/* Half-court arc — dashed visual cue at bottom */}
      {!dim && (
        <circle cx="250" cy="470" r="60" className="ciq-court__line-d" clipPath="url(#ciq-cc)" />
      )}
    </g>
  );
};

const CIQCourt = ({
  variant = "full",
  tone = "neutral",
  className = "",
  style,
  children,
  preserveAspectRatio = "xMidYMid meet",
}) => {
  return (
    <svg
      viewBox={CIQ_COURT_VIEWBOX}
      preserveAspectRatio={preserveAspectRatio}
      className={"ciq-court ciq-court--" + variant + " ciq-court--tone-" + tone + " " + className}
      style={style}
      aria-hidden="true"
    >
      <CIQCourtBackground variant={variant} />
      {children}
    </svg>
  );
};

// ── Coordinate helpers consumers can use to place overlays ───────────────
// `zone` returns a representative center point for each canonical zone. Use
// for drill-card thumbs, drill animation defaults, etc.
const CIQ_ZONE = {
  rim:        { x: 250, y: 80,  label: "RIM" },
  paint:      { x: 250, y: 130, label: "PAINT" },
  ml:         { x: 200, y: 130, label: "L PAINT" },
  mr:         { x: 300, y: 130, label: "R PAINT" },
  freeThrow:  { x: 250, y: 190, label: "FT" },
  midL:       { x: 130, y: 160, label: "L MID" },
  midR:       { x: 370, y: 160, label: "R MID" },
  topMid:     { x: 250, y: 230, label: "TOP MID" },
  topKey:     { x: 250, y: 295, label: "TOP 3" },
  leftWing:   { x: 90,  y: 230, label: "L WING 3" },
  rightWing:  { x: 410, y: 230, label: "R WING 3" },
  leftCorner: { x: 50,  y: 100, label: "L CORNER 3" },
  rightCorner:{ x: 450, y: 100, label: "R CORNER 3" },
  halfCourt:  { x: 250, y: 440, label: "HALF" },
  // Convenience anchors for drill patterns
  topOfKey:   { x: 250, y: 295 },
  elbowL:     { x: 170, y: 190 },
  elbowR:     { x: 330, y: 190 },
  blockL:     { x: 170, y: 90  },
  blockR:     { x: 330, y: 90  },
};

window.CIQCourt = CIQCourt;
window.CIQ_ZONE = CIQ_ZONE;
window.CIQ_COURT_RIM = CIQ_COURT_RIM;
window.CIQ_COURT_PAINT = CIQ_COURT_PAINT;
window.CIQ_COURT_W = CIQ_COURT_W;
window.CIQ_COURT_H = CIQ_COURT_H;
