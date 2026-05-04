// CamStage.jsx — the faux camera viewport background
// A placeholder gym scene built from CSS/SVG — clearly stylised,
// not pretending to be a real photo. Warm floor wash, dim walls,
// soft key-light bloom, subtle scanline grain for realism.

function CamStage({ bgStyle = 'moody', children }) {
  // "moody" = gym with warm floor + back wall spotlight
  // "gradient" = pure abstract dark gradient
  // "sketch" = wireframe gym sketch
  if (bgStyle === 'gradient') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 30%, #1a2338 0%, #08090c 75%)' }}>
        <CamGrain/>
        {children}
      </div>
    );
  }
  if (bgStyle === 'sketch') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden',
        background: '#0a0c10' }}>
        <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice"
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="skfloor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0a0c10"/>
              <stop offset="1" stopColor="#131820"/>
            </linearGradient>
          </defs>
          <rect width="390" height="844" fill="url(#skfloor)"/>
          {/* floor lines */}
          <g stroke="rgba(240,237,230,0.1)" strokeWidth="1" fill="none">
            <path d="M0 500 L390 500"/>
            <path d="M-100 600 L490 600"/>
            <path d="M-200 700 L590 700"/>
            <path d="M-300 800 L690 800"/>
            {/* perspective converging */}
            <path d="M195 500 L-300 1000"/>
            <path d="M195 500 L690 1000"/>
            <path d="M195 500 L60 1000"/>
            <path d="M195 500 L330 1000"/>
          </g>
          {/* backboard wireframe */}
          <g stroke="rgba(240,237,230,0.18)" strokeWidth="1.2" fill="none">
            <rect x="155" y="230" width="80" height="58" rx="2"/>
            <rect x="178" y="260" width="34" height="22" rx="1"/>
            <ellipse cx="195" cy="300" rx="22" ry="5"/>
          </g>
        </svg>
        <CamGrain/>
        {children}
      </div>
    );
  }
  // default moody
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#050607' }}>
      <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice"
           style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id="keylight" cx="50%" cy="28%" r="55%">
            <stop offset="0%"  stopColor="#3b2a10" stopOpacity="0.9"/>
            <stop offset="55%" stopColor="#120d06" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#050607" stopOpacity="1"/>
          </radialGradient>
          <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2a1a08"/>
            <stop offset="40%"  stopColor="#1a1008"/>
            <stop offset="100%" stopColor="#0a0604"/>
          </linearGradient>
          <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(0,0,0,0.55)"/>
            <stop offset="15%"  stopColor="rgba(0,0,0,0)"/>
            <stop offset="85%"  stopColor="rgba(0,0,0,0)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0.65)"/>
          </linearGradient>
          <linearGradient id="floorPersp" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%"   stopColor="rgba(240,220,180,0.1)"/>
            <stop offset="100%" stopColor="rgba(240,220,180,0.02)"/>
          </linearGradient>
        </defs>
        {/* back wall */}
        <rect width="390" height="844" fill="url(#keylight)"/>
        {/* court floor — starts ~52% down */}
        <polygon points="0,440 390,440 490,844 -100,844" fill="url(#floor)"/>
        {/* faint floor boards */}
        <g stroke="rgba(100,60,20,0.15)" strokeWidth="0.6" fill="none">
          <line x1="-100" y1="540" x2="490" y2="540"/>
          <line x1="-100" y1="630" x2="490" y2="630"/>
          <line x1="-100" y1="720" x2="490" y2="720"/>
        </g>
        {/* 3pt arc */}
        <path d="M 60 844 Q 195 560 330 844" stroke="rgba(240,220,180,0.2)"
              strokeWidth="1.5" fill="none"/>
        {/* FT line */}
        <line x1="130" y1="700" x2="260" y2="700" stroke="rgba(240,220,180,0.25)" strokeWidth="1.5"/>
        {/* key box */}
        <path d="M130 440 L130 700 L260 700 L260 440" stroke="rgba(240,220,180,0.18)"
              strokeWidth="1" fill="rgba(240,220,180,0.02)"/>
        {/* hoop (the thing being tracked) */}
        <g transform="translate(195, 300)">
          {/* backboard */}
          <rect x="-34" y="-32" width="68" height="44" rx="1" fill="rgba(240,237,230,0.06)"
                stroke="rgba(240,237,230,0.25)" strokeWidth="1"/>
          <rect x="-14" y="-12" width="28" height="20" rx="1" fill="none"
                stroke="rgba(240,237,230,0.35)" strokeWidth="0.8"/>
          {/* rim */}
          <ellipse cx="0" cy="16" rx="18" ry="4.5" fill="none"
                   stroke="#d9622b" strokeWidth="1.8"/>
          {/* net hint */}
          <path d="M-15 18 Q-8 32 -2 34 M15 18 Q8 32 2 34 M-8 18 L-5 32 M8 18 L5 32"
                stroke="rgba(240,237,230,0.25)" strokeWidth="0.8" fill="none"/>
          {/* post */}
          <line x1="-32" y1="-32" x2="-32" y2="-80" stroke="rgba(240,237,230,0.12)" strokeWidth="1"/>
        </g>
        {/* ambient hoop glow */}
        <circle cx="195" cy="316" r="60" fill="rgba(245,166,35,0.06)"/>
        {/* top vignette */}
        <rect width="390" height="844" fill="url(#vignette)"/>
      </svg>
      <CamGrain/>
      {children}
    </div>
  );
}

function CamGrain() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'1.1\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.35\'/%3E%3C/svg%3E")',
      backgroundSize: '180px 180px',
      opacity: 0.5,
      mixBlendMode: 'overlay',
      pointerEvents: 'none',
    }}/>
  );
}

// Corner-bracket detection box (not full rect — just the 4 corners)
function CornerBox({ x, y, w, h, color = '#56d364', label, labelSide = 'top', pulse = false, fill = false }) {
  const arm = Math.min(10, w * 0.18, h * 0.18);
  const stroke = 1.8;
  return (
    <div style={{
      position: 'absolute', left: `${x}%`, top: `${y}%`,
      width: `${w}%`, height: `${h}%`,
      pointerEvents: 'none',
    }}>
      {fill && (
        <div style={{ position: 'absolute', inset: 0,
          background: `${color}14`, borderRadius: 2 }}/>
      )}
      <svg width="100%" height="100%" preserveAspectRatio="none"
           viewBox={`0 0 100 100`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <g stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="square" vectorEffect="non-scaling-stroke">
          {/* TL */}
          <path d={`M0 ${arm} L0 0 L${arm} 0`}/>
          {/* TR */}
          <path d={`M${100-arm} 0 L100 0 L100 ${arm}`}/>
          {/* BL */}
          <path d={`M0 ${100-arm} L0 100 L${arm} 100`}/>
          {/* BR */}
          <path d={`M${100-arm} 100 L100 100 L100 ${100-arm}`}/>
        </g>
      </svg>
      {pulse && (
        <div style={{
          position: 'absolute', top: 3, right: 3,
          width: 6, height: 6, borderRadius: 50,
          background: color, boxShadow: `0 0 8px ${color}`,
        }} className="pulse-dot"/>
      )}
      {label && (
        <div style={{
          position: 'absolute',
          [labelSide === 'top' ? 'bottom' : 'top']: 'calc(100% + 4px)',
          left: 0,
          fontFamily: 'Barlow Condensed',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color,
          whiteSpace: 'nowrap',
          lineHeight: 1,
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}>{label}</div>
      )}
    </div>
  );
}

Object.assign(window, { CamStage, CamGrain, CornerBox });
