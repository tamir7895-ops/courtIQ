// camera-hud-court-bg.jsx
// The "camera feed" we render BEHIND the HUD.
// Real production: live <video> from getUserMedia. Here: a stylized
// half-court SVG that reads as a real camera capture under broadcast
// overlay — gym floor wood grain, painted lines, rim/backboard,
// vignette + scanline + grain to feel like a sensor.
const CourtCameraBG = ({ rimLocked = true, calibrated = true }) => {
  return (
    <div className="cam-bg">
      <svg className="cam-bg__svg" viewBox="0 0 390 690" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="floorGrad" cx="50%" cy="55%" r="80%">
            <stop offset="0%" stopColor="#5b3a1a" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#3a2410" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#0e0905" stopOpacity="1" />
          </radialGradient>
          <linearGradient id="floorTint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a1808" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#0a0604" stopOpacity="0.6" />
          </linearGradient>
          <pattern id="wood" width="6" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(2)">
            <rect width="6" height="180" fill="transparent" />
            <line x1="0" y1="0" x2="0" y2="180" stroke="rgba(0,0,0,0.18)" strokeWidth="0.5" />
            <line x1="3" y1="0" x2="3" y2="180" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
          </pattern>
          <filter id="camGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0" />
          </filter>
        </defs>

        {/* gym floor */}
        <rect width="390" height="690" fill="url(#floorGrad)" />
        <rect width="390" height="690" fill="url(#wood)" opacity="0.55" />
        <rect width="390" height="690" fill="url(#floorTint)" />

        {/* painted court lines (cool white, scuffed) */}
        <g stroke="rgba(245,240,230,0.55)" strokeWidth="2" fill="none" strokeLinecap="square">
          {/* baseline */}
          <line x1="20" y1="180" x2="370" y2="180" />
          {/* lane / paint */}
          <rect x="135" y="180" width="120" height="160" fill="rgba(40,30,20,0.55)" />
          <line x1="135" y1="180" x2="135" y2="340" />
          <line x1="255" y1="180" x2="255" y2="340" />
          <line x1="135" y1="340" x2="255" y2="340" />
          {/* free-throw circle (top half visible) */}
          <path d="M 165 340 A 30 30 0 0 0 225 340" />
          <path d="M 165 340 A 30 30 0 0 1 225 340" strokeDasharray="4 4" opacity="0.5" />
          {/* restricted area arc */}
          <path d="M 178 180 Q 195 215 212 180" />
          {/* 3PT arc */}
          <path d="M 50 180 L 50 220 Q 195 380 340 220 L 340 180" />
          {/* rim free throw line marker dots */}
          <circle cx="135" cy="220" r="2" fill="rgba(245,240,230,0.55)" stroke="none" />
          <circle cx="255" cy="220" r="2" fill="rgba(245,240,230,0.55)" stroke="none" />
          <circle cx="135" cy="260" r="2" fill="rgba(245,240,230,0.55)" stroke="none" />
          <circle cx="255" cy="260" r="2" fill="rgba(245,240,230,0.55)" stroke="none" />
        </g>

        {/* backboard + rim */}
        <g>
          <rect x="170" y="172" width="50" height="6" fill="rgba(255,255,255,0.85)" />
          <rect x="170" y="172" width="50" height="6" fill="none" stroke="rgba(0,0,0,0.4)" />
          <ellipse cx="195" cy="180" rx="13" ry="3.5" fill="none" stroke="#ff5a3c" strokeWidth="2.5" />
          {/* net */}
          <g stroke="rgba(255,255,255,0.6)" strokeWidth="1" fill="none">
            <path d="M183 182 L188 200 L195 206 L202 200 L207 182" />
            <path d="M186 182 L194 204" />
            <path d="M204 182 L196 204" />
            <line x1="190" y1="195" x2="200" y2="195" opacity="0.5" />
          </g>
        </g>

        {/* depth haze toward back of court */}
        <rect width="390" height="200" fill="url(#floorGrad)" opacity="0.5" />

        {/* camera grain */}
        <rect width="390" height="690" filter="url(#camGrain)" opacity="0.7" />

        {/* lens vignette */}
        <radialGradient id="vig" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
        </radialGradient>
        <rect width="390" height="690" fill="url(#vig)" />
      </svg>

      {/* rolling scanline (subtle, "live capture" feel) */}
      <div className="cam-bg__scan" aria-hidden="true" />
      {/* warm highlight to suggest gym sodium light */}
      <div className="cam-bg__warm" aria-hidden="true" />
    </div>
  );
};

window.CourtCameraBG = CourtCameraBG;
