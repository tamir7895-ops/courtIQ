// Screen4_Summary.jsx — post-session summary, full dark with court-grid

function Screen4_Summary() {
  // Arc chart — shot-by-shot accuracy %
  const shots = [
    0,0,1,1,1,0,1,1,1,1, 1,0,1,1,0,1,1,1,
  ]; // 14/18
  const rolling = shots.reduce((acc, s, i) => {
    const made = (acc[i-1]?.made || 0) + s;
    const pct = made / (i+1);
    acc.push({ made, pct });
    return acc;
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0a0a0c' }}>
      {/* court-grid bg */}
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(240,237,230,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(240,237,230,0.04) 1px, transparent 1px)',
        backgroundSize: '28px 28px' }}/>
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 20%, rgba(86,211,100,0.12) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(245,166,35,0.04) 0%, transparent 50%)' }}/>
      {/* grain */}
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.05\'/%3E%3C/svg%3E")',
        backgroundSize: '200px 200px', pointerEvents: 'none', opacity: 0.6 }}/>

      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto',
        paddingTop: 54, paddingBottom: 24, paddingLeft: 16, paddingRight: 16 }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 16px' }}>
          <button className="btn-circ" style={{ width: 40, height: 40, minWidth: 40 }}>
            <IcX size={18}/>
          </button>
          <div className="chip chip-green">
            <IcCheck size={11} stroke={2.5}/> Session Complete
          </div>
          <button className="btn-circ" style={{ width: 40, height: 40, minWidth: 40 }}>
            <IcShare size={16}/>
          </button>
        </div>

        {/* Hero stat */}
        <div style={{ textAlign: 'center', padding: '20px 0 10px', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: '50%', top: 20,
            transform: 'translateX(-50%)',
            width: 280, height: 180,
            background: 'radial-gradient(ellipse at 50% 50%, rgba(86,211,100,0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}/>
          <div className="kicker kicker-green" style={{ marginBottom: 12, position: 'relative' }}>
            Field Goal %
          </div>
          <div style={{
            fontFamily: 'Barlow Condensed',
            fontWeight: 900, fontStyle: 'italic',
            fontSize: 132, lineHeight: 0.85,
            color: '#56d364',
            letterSpacing: '-0.02em',
            textShadow: '0 0 40px rgba(86,211,100,0.4)',
            fontVariantNumeric: 'tabular-nums',
            position: 'relative',
          }}>
            78<span style={{ fontSize: 56 }}>%</span>
          </div>
          <div style={{
            fontFamily: 'Lexend', fontSize: 15,
            color: 'rgba(240,237,230,0.65)',
            marginTop: 10, position: 'relative',
          }}>
            <strong style={{ color: '#fff', fontWeight: 600 }}>14 of 18</strong> made · Free Throws · 04:12
          </div>
        </div>

        {/* Arc chart */}
        <div className="glass-apple" style={{ borderRadius: 20, padding: '14px 14px 18px', marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="kicker">Accuracy Trend</div>
            <div style={{ fontFamily: 'Lexend', fontSize: 10, color: 'rgba(240,237,230,0.4)' }}>Over 18 shots</div>
          </div>
          <div style={{ position: 'relative', height: 96 }}>
            <svg viewBox="0 0 340 96" width="100%" height="96" preserveAspectRatio="none">
              {/* grid lines */}
              <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
                <line x1="0" y1="24"  x2="340" y2="24"/>
                <line x1="0" y1="48"  x2="340" y2="48"/>
                <line x1="0" y1="72"  x2="340" y2="72"/>
              </g>
              {/* 50% ref */}
              <line x1="0" y1="48" x2="340" y2="48" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" strokeWidth="1"/>
              {/* area */}
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#56d364" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="#56d364" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {(() => {
                const pts = rolling.map((r, i) => [i * (340/(rolling.length-1)), 96 - (r.pct * 88) - 4]);
                const line = pts.map((p,i) => `${i===0?'M':'L'} ${p[0]} ${p[1]}`).join(' ');
                const area = line + ` L 340 96 L 0 96 Z`;
                return <>
                  <path d={area} fill="url(#areaGrad)"/>
                  <path d={line} fill="none" stroke="#56d364" strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(86,211,100,0.4))' }}/>
                  {pts.map((p,i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r="2"
                            fill={shots[i] ? '#56d364' : '#e84040'}/>
                  ))}
                </>;
              })()}
            </svg>
          </div>
          {/* shot dots timeline */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10, justifyContent: 'space-between' }}>
            {shots.map((s,i) => (
              <div key={i} style={{
                flex: 1, height: 6, borderRadius: 2,
                background: s ? '#56d364' : 'rgba(232,64,64,0.8)',
                boxShadow: s ? '0 0 4px rgba(86,211,100,0.5)' : 'none',
                opacity: 0.9,
              }}/>
            ))}
          </div>
        </div>

        {/* 2×2 stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          {[
            { icon: <IcFlame size={15}/>, label: 'Best Streak', value: '7', unit: 'MADE', tint: '#ffbe50' },
            { icon: <IcX size={14} stroke={2.4}/>, label: 'Longest Miss', value: '2', unit: 'IN A ROW', tint: '#ff8888' },
            { icon: <IcAngle size={15}/>, label: 'Avg Release', value: '46°', unit: '', tint: '#7ee589' },
            { icon: <IcClock size={15}/>, label: 'Duration', value: '4:12', unit: 'MIN', tint: 'rgba(240,237,230,0.9)' },
          ].map((s, i) => (
            <div key={i} className="glass-apple" style={{ borderRadius: 16, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ color: s.tint }}>{s.icon}</span>
                <span className="kicker" style={{ color: s.tint, opacity: 0.9, fontSize: 9 }}>{s.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <div style={{
                  fontFamily: 'Barlow Condensed', fontWeight: 900, fontStyle: 'italic',
                  fontSize: 36, lineHeight: 0.9, color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                }}>{s.value}</div>
                {s.unit && <div style={{
                  fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 10,
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  color: 'rgba(240,237,230,0.4)',
                }}>{s.unit}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary-green" style={{ width: '100%' }}>
            <IcSave size={16}/> Save Session
          </button>
          <button className="btn btn-ghost-glass" style={{ width: '100%', fontFamily: 'Lexend', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'none' }}>
            <IcRetry size={15}/> Retry
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Screen4_Summary });
