// drill-library-icons.jsx — small inline SVG library for the Drill tab

const DLIcon = {
  Shooting: (props) => (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      {/* basketball arc + rim */}
      <path d="M8 2.5L4.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4.5 8 Q 8 11 11.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="2.5" r="1.4" fill="currentColor" />
      <path d="M3 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  Ballhandling: (props) => (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 8h10M8 3v10M5 4.4 Q 8 8 5 11.6M11 4.4 Q 8 8 11 11.6"
        stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  ),
  Defense: (props) => (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M8 2L3 4v4.5C3 11.5 5.2 13.5 8 14.2c2.8-0.7 5-2.7 5-5.7V4L8 2z"
        stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
      <path d="M5.8 8.2L7.4 9.8L10.4 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Athleticism: (props) => (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      {/* lightning bolt */}
      <path d="M9 1.5L3.5 9.5h3L7 14.5L12.5 6.5h-3L10 1.5z"
        stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.2" strokeLinejoin="round" />
    </svg>
  ),
  Save: (props) => (
    <svg viewBox="0 0 18 18" fill="none" {...props}>
      <path d="M5 3h8v12l-4-2.5L5 15z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </svg>
  ),
  SaveFilled: (props) => (
    <svg viewBox="0 0 18 18" fill="none" {...props}>
      <path d="M5 3h8v12l-4-2.5L5 15z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  Share: (props) => (
    <svg viewBox="0 0 18 18" fill="none" {...props}>
      <circle cx="5" cy="9" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="13" cy="4" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="13" cy="14" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.7 8L11.3 5M6.7 10L11.3 13" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  Filter: (props) => (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M2 4h12M4.5 8h7M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  X: (props) => (
    <svg viewBox="0 0 14 14" fill="none" {...props}>
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  Back: (props) => (
    <svg viewBox="0 0 14 14" fill="none" {...props}>
      <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Plus: (props) => (
    <svg viewBox="0 0 14 14" fill="none" {...props}>
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  Camera: (props) => (
    <svg viewBox="0 0 18 18" fill="none" {...props}>
      <path d="M3 5h2l1.5-2h5L13 5h2v9H3z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  Check: (props) => (
    <svg viewBox="0 0 14 14" fill="none" {...props}>
      <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Warn: (props) => (
    <svg viewBox="0 0 14 14" fill="none" {...props}>
      <path d="M7 1.5L13 12H1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 5.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="10.2" r="0.8" fill="currentColor" />
    </svg>
  ),
};

const DLFocusIcon = ({ focus, ...props }) => {
  if (focus === "shooting") return <DLIcon.Shooting {...props} />;
  if (focus === "ballhandling") return <DLIcon.Ballhandling {...props} />;
  if (focus === "defense") return <DLIcon.Defense {...props} />;
  if (focus === "athleticism") return <DLIcon.Athleticism {...props} />;
  return null;
};

window.DLIcon = DLIcon;
window.DLFocusIcon = DLFocusIcon;
