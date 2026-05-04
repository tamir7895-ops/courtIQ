// Screen3_Replay.jsx — shot replay modal (55% height)

function Screen3_Replay({ outcome = 'made', bgStyle = 'moody' }) {
  const isMade = outcome === 'made';
  const accent = isMade ? '#56d364' : '#f5a623';
  const accentRgb = isMade ? '86,211,100' : '245,166,35';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      {/* Background — snapshot of active session */}
      <CamStage bgStyle={bgStyle}>
        <CornerBox x={43} y={31} w={16} h={10} color="#f5a623" label="HOOP · LOCKED"/>
        <CornerBox x={50} y={38} w={6} h={6} color="#56d364" label="BALL 94%" fill/>
        {/* the arc — frozen */}
        <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice"
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <linearGradient id="arcG2" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#f5a623" stopOpacity="0.95"/>
              <stop offset="100%" stopColor={accent} stopOpacity="0.95"/>
            </linearGradient>
          </defs>
          <path d={isMade ? 'M 115 565 Q 180 220 210 300' : 'M 115 565 Q 170 240 240 360'}
                fill="none" stroke="url(#arcG2)" strokeWidth="3"
                strokeDasharray="4 6" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px rgba(${accentRgb},0.5))` }}/>
        </svg>
        {/* Darken the camera */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.9) 100%)', pointerEvents: 'none' }}/>
      </CamStage>

      {/* Minimal top glass strip still visible */}
      <div style={{ position: 'absolute', top: 60, left: 12, zIndex: 5 }}>
        <div className="glass-apple" style={{ height: 36, borderRadius: 12, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 50, background: '#e84040' }} className="pulse-dot"/>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 14, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>03:26</span>
        </div>
      </div>

      {/* ═══ MODAL SHEET ═══ */}
      <div className="glass-apple rise-in" style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        height: '60%',
        borderRadius: '32px 32px 0 0',
        padding: '16px 20px 30px',
        zIndex: 20,
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.1) inset',
      }}>
        {/* grab bar */}
        <div style={{ width: 40, height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.18)', margin: '0 auto 18px' }}/>

        {/* outcome bloom */}
        <div style={{
          position: 'absolute', left: '50%', top: 40,
          transform: 'translateX(-50%)',
          width: 280, height: 140,
          background: `radial-gradient(ellipse at 50% 50%, rgba(${accentRgb},0.3) 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0,
        }}/>

        {/* outcome */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 50,
            background: `rgba(${accentRgb},0.16)`,
            border: `2px solid rgba(${accentRgb},0.5)`,
            color: accent,
            marginBottom: 8,
            boxShadow: `0 0 30px rgba(${accentRgb},0.4)`,
          }}>
            {isMade ? <IcCheck size={34} stroke={3}/> : <IcX size={34} stroke={3}/>}
          </div>
          <div style={{
            fontFamily: 'Barlow Condensed',
            fontWeight: 900, fontStyle: 'italic',
            fontSize: 56, lineHeight: 0.9,
            letterSpacing: '-0.01em',
            color: accent,
            textTransform: 'uppercase',
          }}>{isMade ? 'Made' : 'Missed'}</div>
          <div style={{
            fontFamily: 'Barlow Condensed',
            fontWeight: 700, fontSize: 12,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(240,237,230,0.5)',
            marginTop: 6,
          }}>Shot #14 · Free Throw</div>
        </div>

        {/* 3-column data readout */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          marginTop: 22,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '14px 0',
          position: 'relative', zIndex: 2,
        }}>
          {[
            { label: 'Release', value: '42°', sub: 'IDEAL' },
            { label: 'Arc',     value: 'HIGH', sub: 'Good' },
            { label: 'Air Time',value: '1.2s', sub: '' },
          ].map((d, i) => (
            <div key={i} style={{
              textAlign: 'center',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <div className="kicker" style={{ marginBottom: 6 }}>{d.label}</div>
              <div style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 900, fontStyle: 'italic',
                fontSize: 28, lineHeight: 1,
                color: '#fff',
              }}>{d.value}</div>
              {d.sub && <div style={{
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 9,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: isMade ? '#7ee589' : 'rgba(240,237,230,0.5)',
                marginTop: 4,
              }}>{d.sub}</div>}
            </div>
          ))}
        </div>

        {/* buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, position: 'relative', zIndex: 2 }}>
          <button className="btn btn-ghost-glass" style={{ flex: 1, fontFamily: 'Lexend', letterSpacing: '0.02em', textTransform: 'none', fontWeight: 500 }}>
            Mark incorrect
          </button>
          <button className="btn btn-primary-green" style={{ flex: 1.2, height: 48, borderRadius: 14, fontSize: 14, position: 'relative', overflow: 'hidden' }}>
            {/* countdown ring — subtle */}
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ position: 'absolute', left: 12 }}>
              <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(6,40,9,0.4)" strokeWidth="2"/>
              <circle cx="12" cy="12" r="9" fill="none" stroke="#062809" strokeWidth="2"
                      strokeDasharray="56.5" strokeDashoffset="14"
                      strokeLinecap="round" transform="rotate(-90 12 12)"/>
            </svg>
            <span style={{ marginLeft: 14 }}>Keep</span>
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Screen3_Replay });
