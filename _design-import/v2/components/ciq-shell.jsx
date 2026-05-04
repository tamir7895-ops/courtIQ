// ciq-shell.jsx — Shared shell components: BottomNav + BottomSheet
// Used by: Home, Train (Drill Library), Track (Track Lab), Coach, Me, Post Session, Camera HUD

const CIQNavStroke = {
  fill: "none", stroke: "currentColor", strokeWidth: 1.6,
  strokeLinecap: "round", strokeLinejoin: "round",
};

// Outline icons (inactive). Filled variants done via CSS background-color on a wrap.
const CIQNavIcons = {
  home:  (p) => <svg viewBox="0 0 24 24" {...p}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" {...CIQNavStroke}/></svg>,
  train: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M6 6L4 4M18 6l2-2M6 18l-2 2M18 18l2 2" {...CIQNavStroke}/><path d="M9 9l-3 0 0 6 3 0M15 9l3 0 0 6-3 0M9 12h6" {...CIQNavStroke}/></svg>,
  track: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M3 17l5-5 4 4 8-8" {...CIQNavStroke}/><path d="M16 8h4v4" {...CIQNavStroke}/></svg>,
  coach: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" {...CIQNavStroke}/></svg>,
  me:    (p) => <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="8" r="4" {...CIQNavStroke}/><path d="M4 21a8 8 0 0 1 16 0" {...CIQNavStroke}/></svg>,
};

const CIQ_TABS = [
  { id: "home",  label: "Home",  color: "#f5a623", glow: "rgba(245,166,35,0.40)" },
  { id: "train", label: "Train", color: "#4ca3ff", glow: "rgba(76,163,255,0.40)" },
  { id: "track", label: "Track", color: "#56d364", glow: "rgba(86,211,100,0.40)" },
  { id: "coach", label: "Coach", color: "#bc8cff", glow: "rgba(188,140,255,0.40)" },
  { id: "me",    label: "Me",    color: "#2dd4bf", glow: "rgba(45,212,191,0.40)" },
];

const CIQBottomNav = ({ active = "me", onChange }) => {
  return (
    <div className="ciq-nav">
      <div className="ciq-nav__bg" />
      <div className="ciq-nav__row">
        {CIQ_TABS.map(t => {
          const isActive = t.id === active;
          const Icon = CIQNavIcons[t.id];
          return (
            <button
              key={t.id}
              className={"ciq-nav__btn" + (isActive ? " is-active" : "")}
              style={isActive ? { color: t.color, "--ciq-nav-glow": t.glow } : undefined}
              onClick={() => onChange && onChange(t.id)}
            >
              <span className="ciq-nav__icon-wrap">
                {isActive && <span className="ciq-nav__fill" />}
                <Icon className="ciq-nav__icon" />
              </span>
              <span className="ciq-nav__lbl">{t.label}</span>
              {isActive && <span className="ciq-nav__dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// BottomSheet — slide-up overlay with scrim
// ─────────────────────────────────────────────────────────────
const CIQBottomSheet = ({ open, onClose, title, children, accent = "#2dd4bf" }) => {
  if (!open) return null;
  return (
    <div className="ciq-sheet-root" onClick={onClose}>
      <div className="ciq-sheet-scrim" />
      <div
        className="ciq-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ "--ciq-sheet-accent": accent }}
      >
        <div className="ciq-sheet__handle" />
        {title && (
          <div className="ciq-sheet__head">
            <h3 className="ciq-sheet__title">{title}</h3>
            <button className="ciq-sheet__close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}
        <div className="ciq-sheet__body">{children}</div>
      </div>
    </div>
  );
};

window.CIQBottomNav = CIQBottomNav;
window.CIQBottomSheet = CIQBottomSheet;
window.CIQ_TABS = CIQ_TABS;
