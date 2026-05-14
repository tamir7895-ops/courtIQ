// home-icons.jsx — Lucide-aligned stroke icons for Home tab

const HomeIcon = {
  Back: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Settings: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Flame: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-1 0-2 1-3 0 2 2 2 2 0 0-2-1-3 1-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M16 11c2 1 3 3 3 5a7 7 0 0 1-14 0c0-2 1-4 3-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Bolt: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  ),
  Drills: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M3 12h18M12 3v18M5.5 5.5l13 13M18.5 5.5l-13 13" stroke="currentColor" strokeWidth="1.2" opacity="0.55"/>
    </svg>
  ),
  Camera: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M3 8a2 2 0 0 1 2-2h2l1-2h8l1 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  Whistle: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M3 14a6 6 0 0 0 12 0v-2H3v2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M15 11l5-3v8l-5-3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <circle cx="9" cy="14" r="1.4" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  Dumbbell: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="2" y="9" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="19" y="9" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="5" y="10.5" width="2" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="17" y="10.5" width="2" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.6"/>
      <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Calendar: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <line x1="3.5" y1="10" x2="20.5" y2="10" stroke="currentColor" strokeWidth="1.6"/>
      <line x1="8" y1="3" x2="8" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Plus: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Minus: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  ChevL: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  ChevR: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Up: (p) => (
    <svg viewBox="0 0 12 12" fill="none" {...p}>
      <path d="M3 7l3-3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Down: (p) => (
    <svg viewBox="0 0 12 12" fill="none" {...p}>
      <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Basketball: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M3 12c5 0 9 4 9 9M21 12c-5 0-9 4-9 9M3 12c5 0 9-4 9-9M21 12c-5 0-9-4-9-9" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  Play: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M7 4l13 8-13 8V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="currentColor" fillOpacity="0.18"/>
    </svg>
  ),
  Crosshair: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Message: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M4 5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 3V6a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="8" y1="13.5" x2="13" y2="13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Clock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

window.HomeIcon = HomeIcon;
