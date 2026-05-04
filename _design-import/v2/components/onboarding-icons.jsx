// onboarding-icons.jsx — step glyphs + position silhouettes + goal icons

const _stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };

window.OBIcon = {
  // chevrons
  ChevL: (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><polyline points="15,5 8,12 15,19"/></svg>),
  ChevR: (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><polyline points="9,5 16,12 9,19"/></svg>),
  Arrow: (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13,6 19,12 13,18"/></svg>),
  Check: (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><polyline points="5,13 10,18 19,7"/></svg>),
  Plus: (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  Minus: (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  Spark: (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><path d="M12 3 l1.6 5.4 5.4 1.6 -5.4 1.6 -1.6 5.4 -1.6 -5.4 -5.4 -1.6 5.4 -1.6 z"/></svg>),
  Basketball: (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12c5 0 9 4 9 9M21 12c-5 0-9 4-9 9M3 12c5 0 9-4 9-9M21 12c-5 0-9-4-9-9"/></svg>),

  // position silhouettes — abstract role glyphs (not figurative)
  PG: (p) => (
    <svg viewBox="0 0 48 48" {..._stroke} {...p}>
      <circle cx="24" cy="24" r="14" strokeDasharray="2 3" opacity=".5"/>
      <circle cx="24" cy="24" r="3.2" fill="currentColor" stroke="none"/>
      <path d="M24 8 v6 M24 34 v6 M8 24 h6 M34 24 h6"/>
      <path d="M11 11 l4 4 M37 11 l-4 4 M11 37 l4 -4 M37 37 l-4 -4"/>
    </svg>
  ),
  SG: (p) => (
    <svg viewBox="0 0 48 48" {..._stroke} {...p}>
      <circle cx="24" cy="24" r="3.2" fill="currentColor" stroke="none"/>
      <path d="M24 24 L40 8"/>
      <path d="M40 8 l-5 0 M40 8 l0 5"/>
      <path d="M8 24 a16 16 0 0 1 16 -16" opacity=".4"/>
      <path d="M24 40 a16 16 0 0 0 16 -16" opacity=".4"/>
    </svg>
  ),
  SF: (p) => (
    <svg viewBox="0 0 48 48" {..._stroke} {...p}>
      <path d="M24 6 l16 12 -6 22 H14 L8 18 z"/>
      <circle cx="24" cy="24" r="3.2" fill="currentColor" stroke="none"/>
    </svg>
  ),
  PF: (p) => (
    <svg viewBox="0 0 48 48" {..._stroke} {...p}>
      <rect x="9" y="9" width="30" height="30" rx="3"/>
      <path d="M9 24 h30 M24 9 v30" opacity=".5"/>
      <circle cx="24" cy="24" r="3.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  C: (p) => (
    <svg viewBox="0 0 48 48" {..._stroke} {...p}>
      <path d="M24 8 a16 16 0 0 1 0 32" />
      <path d="M24 8 a16 16 0 0 0 0 32" opacity=".4"/>
      <line x1="24" y1="14" x2="24" y2="34"/>
      <circle cx="24" cy="24" r="3.5" fill="currentColor" stroke="none"/>
    </svg>
  ),

  // goal icons
  Three:  (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><path d="M3 18 a9 9 0 0 1 18 0"/><text x="12" y="14" fontSize="8" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="JetBrains Mono" fontWeight="800">3PT</text></svg>),
  Handle: (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><circle cx="8" cy="8" r="3.2"/><circle cx="16" cy="16" r="3.2"/><path d="M11 8 q5 0 5 8"/></svg>),
  Lock:   (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11 V7 a4 4 0 0 1 8 0 V11"/></svg>),
  Ath:    (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><polyline points="4,18 9,11 13,15 20,5"/><polyline points="15,5 20,5 20,10"/></svg>),
  Brain:  (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><path d="M9 5 a3 3 0 0 0 -3 3 a2 2 0 0 0 -2 2 a3 3 0 0 0 2 3 a3 3 0 0 0 3 3 v2"/><path d="M15 5 a3 3 0 0 1 3 3 a2 2 0 0 1 2 2 a3 3 0 0 1 -2 3 a3 3 0 0 1 -3 3 v2"/><line x1="12" y1="5" x2="12" y2="21"/></svg>),
  Trophy: (p) => (<svg viewBox="0 0 24 24" {..._stroke} {...p}><path d="M7 4 h10 v5 a5 5 0 0 1 -10 0 z"/><path d="M7 6 H4 a3 3 0 0 0 3 3"/><path d="M17 6 h3 a3 3 0 0 1 -3 3"/><line x1="12" y1="14" x2="12" y2="19"/><path d="M9 19 h6"/></svg>),
};
