// ShotIcons.jsx — custom icon set for Shot Tracker
// Matches CourtIQ custom iconography language (hoop, whistle, jersey, etc.)
// Stroke 1.8, rounded, currentColor-driven, 24×24 viewBox.

const SIc = ({ d, size = 22, stroke = 1.8, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {d}
  </svg>
);

// Close / X
const IcX = (p) => <SIc {...p} d={<><line x1="17" y1="7" x2="7" y2="17"/><line x1="7" y1="7" x2="17" y2="17"/></>} />;

// Gear / settings
const IcGear = (p) => <SIc {...p} d={<>
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>
</>} />;

// Custom HOOP — rim + net, matches existing language
const IcHoop = (p) => <SIc {...p} d={<>
  <rect x="5" y="4" width="14" height="5" rx="1"/>
  <line x1="5" y1="7" x2="19" y2="7"/>
  <path d="M8 9 L9 19"/>
  <path d="M12 9 L12 20"/>
  <path d="M16 9 L15 19"/>
  <path d="M8.5 19 Q12 20 15.5 19"/>
</>} />;

// Pause (two bars)
const IcPause = (p) => <SIc {...p} d={<>
  <rect x="7.5" y="5" width="3" height="14" rx="0.8" fill="currentColor" stroke="none"/>
  <rect x="13.5" y="5" width="3" height="14" rx="0.8" fill="currentColor" stroke="none"/>
</>} />;

// Play triangle
const IcPlay = (p) => <SIc {...p} d={<polygon points="7 4 20 12 7 20 7 4" fill="currentColor" stroke="none"/>} />;

// Stop square
const IcStop = (p) => <SIc {...p} d={<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>} />;

// Plus / minus (stepper)
const IcPlus  = (p) => <SIc {...p} d={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>} />;
const IcMinus = (p) => <SIc {...p} d={<line x1="5" y1="12" x2="19" y2="12"/>} />;

// Check
const IcCheck = (p) => <SIc {...p} d={<polyline points="5 12 10 17 19 7"/>} />;

// Pencil (edit)
const IcEdit = (p) => <SIc {...p} d={<>
  <path d="M17 3l4 4-12 12H5v-4z"/>
  <line x1="14" y1="6" x2="18" y2="10"/>
</>} />;

// Retry / refresh
const IcRetry = (p) => <SIc {...p} d={<>
  <polyline points="21 4 21 10 15 10"/>
  <path d="M21 10a9 9 0 1 0-2.5 6.3L21 14"/>
</>} />;

// Arc / angle indicator (for release angle)
const IcAngle = (p) => <SIc {...p} d={<>
  <path d="M4 20 L20 20"/>
  <path d="M4 20 L18 6"/>
  <path d="M10 20 A6 6 0 0 0 14 14"/>
</>} />;

// Clock
const IcClock = (p) => <SIc {...p} d={<>
  <circle cx="12" cy="12" r="8"/>
  <polyline points="12 7 12 12 15.5 14"/>
</>} />;

// Flame (streak)
const IcFlame = (p) => <SIc {...p} d={<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 1.5 1 2 2 2-1-2-1-4 1-7z"/>} />;

// Chart (arc)
const IcChart = (p) => <SIc {...p} d={<>
  <path d="M3 3v18h18"/>
  <path d="M7 15l4-4 4 4 5-5"/>
</>} />;

// Ball (circle + seams)
const IcBall = (p) => <SIc {...p} d={<>
  <circle cx="12" cy="12" r="8"/>
  <path d="M4 12 Q12 8 20 12"/>
  <path d="M4 12 Q12 16 20 12"/>
  <path d="M12 4 Q8 12 12 20"/>
  <path d="M12 4 Q16 12 12 20"/>
</>} />;

// Camera
const IcCamera = (p) => <SIc {...p} d={<>
  <path d="M3 7a2 2 0 0 1 2-2h2l1.5-2h7L17 5h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  <circle cx="12" cy="13" r="4"/>
</>} />;

// Share
const IcShare = (p) => <SIc {...p} d={<>
  <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
  <polyline points="16 6 12 2 8 6"/>
  <line x1="12" y1="2" x2="12" y2="15"/>
</>} />;

// Download / save
const IcSave = (p) => <SIc {...p} d={<>
  <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
  <polyline points="8 12 12 16 16 12"/>
  <line x1="12" y1="3" x2="12" y2="16"/>
</>} />;

// Target (bullseye)
const IcTarget = (p) => <SIc {...p} d={<>
  <circle cx="12" cy="12" r="9"/>
  <circle cx="12" cy="12" r="5"/>
  <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
</>} />;

Object.assign(window, {
  SIc, IcX, IcGear, IcHoop, IcPause, IcPlay, IcStop,
  IcPlus, IcMinus, IcCheck, IcEdit, IcRetry, IcAngle,
  IcClock, IcFlame, IcChart, IcBall, IcCamera, IcShare,
  IcSave, IcTarget,
});
