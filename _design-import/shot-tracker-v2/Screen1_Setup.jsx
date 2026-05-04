// Screen1_Setup.jsx — Pre-session framing / hoop lock

function Screen1_Setup({ hoopLocked = false, selectedDrill = 'freethrows', shotTarget = 25, bgStyle = 'moody', onStart }) {
  const drills = [
    { id: 'freethrows', label: 'Free Throws' },
    { id: '3point',     label: '3-Point' },
    { id: 'midrange',   label: 'Mid-Range' },
    { id: 'layups',     label: 'Layups' },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      <CamStage bgStyle={bgStyle}>
        {/* ─── Framing guide — dashed rect around hoop ─────── */}
        <div style={{
          position: 'absolute',
          left: '22%', top: '26%',
          width: '56%', height: '18%',
          pointerEvents: 'none',
        }}>
          <svg width="100%" height="100%" preserveAspectRatio="none"
               viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
            <rect x="0" y="0" width="100" height="100" rx="2"
                  fill="none"
                  stroke={hoopLocked ? '#f5a623' : '#f5a623'}
                  strokeWidth="2"
                  strokeDasharray={hoopLocked ? '0' : '10 6'}
                  vectorEffect="non-scaling-stroke"
                  className={hoopLocked ? '' : 'dash-march'}
                  style={{
                    filter: hoopLocked ? 'drop-shadow(0 0 10px rgba(245,166,35,0.55))' : 'none',
                    transition: 'all 0.3s',
                  }}/>
            {/* corner ticks always */}
            <g stroke="#f5a623" strokeWidth="2.5" fill="none" vectorEffect="non-scaling-stroke">
              <path d="M0 12 L0 0 L12 0"/>
              <path d="M88 0 L100 0 L100 12"/>
              <path d="M0 88 L0 100 L12 100"/>
              <path d="M88 100 L100 100 L100 88"/>
            </g>
          </svg>
          {/* center crosshair */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 24, height: 24,
            opacity: hoopLocked ? 0 : 0.8,
            transition: 'opacity 0.3s',
          }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#f5a623', transform: 'translateX(-50%)' }}/>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: '#f5a623', transform: 'translateY(-50%)' }}/>
          </div>
          {/* caption */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 14px)',
            left: '50%', transform: 'translateX(-50%)',
            fontFamily: 'Lexend, system-ui, sans-serif',
            fontSize: 13,
            fontWeight: 400,
            color: 'rgba(240,237,230,0.9)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.005em',
          }}>
            {hoopLocked
              ? 'Hoop detected — you\u2019re good to go'
              : 'Position the hoop inside the frame'}
          </div>
        </div>

        {/* Scan line animation while locking */}
        {!hoopLocked && (
          <div style={{ position: 'absolute', left: '22%', top: '26%', width: '56%', height: '18%', overflow: 'hidden', borderRadius: 2, pointerEvents: 'none' }}>
            <div className="scan-line"/>
          </div>
        )}

        {/* ─── TOP BAR — glass ─────────────────────────────── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          paddingTop: 54, /* status bar */
          paddingLeft: 12, paddingRight: 12,
          zIndex: 10,
        }}>
          <div className="glass-apple" style={{
            height: 48, borderRadius: 16,
            display: 'flex', alignItems: 'center',
            padding: '0 8px',
          }}>
            <button style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--c-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <IcX size={18}/>
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--c-white)',
              }}>Free Throws</span>
              <IcEdit size={13} style={{ color: 'rgba(240,237,230,0.5)' }}/>
            </div>
            <button style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--c-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <IcGear size={16}/>
            </button>
          </div>
        </div>

        {/* ─── LOCK STATUS PILL (top-center, below bar) ────── */}
        <div style={{
          position: 'absolute',
          top: 122, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10,
        }}>
          <div className="glass-apple" style={{
            height: 32, borderRadius: 999,
            padding: '0 14px',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: 50,
              background: '#f5a623',
              boxShadow: hoopLocked ? '0 0 8px rgba(245,166,35,0.9)' : '0 0 6px rgba(245,166,35,0.5)',
            }} className={hoopLocked ? '' : 'pulse-dot'}/>
            <span style={{
              fontFamily: 'Barlow Condensed',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: hoopLocked ? '#ffbe50' : 'rgba(240,237,230,0.85)',
            }}>
              {hoopLocked ? 'Hoop Locked' : 'Locking onto hoop\u2026'}
            </span>
          </div>
        </div>

        {/* ─── BOTTOM SHEET — drills + target + CTA ────────── */}
        <div style={{
          position: 'absolute',
          left: 10, right: 10, bottom: 10,
          zIndex: 10,
        }}>
          <div className="glass-apple" style={{
            borderRadius: 28,
            padding: '16px 16px 24px',
          }}>
            {/* kicker */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12,
            }}>
              <div className="kicker">Drill Type</div>
              <div style={{
                fontFamily: 'Lexend',
                fontSize: 10, color: 'rgba(240,237,230,0.4)',
                letterSpacing: '0.04em',
              }}>Swipe for more</div>
            </div>

            {/* drill chips */}
            <div style={{
              display: 'flex', gap: 8, overflowX: 'auto',
              paddingBottom: 2,
              marginBottom: 16,
            }}>
              {drills.map(d => (
                <div key={d.id}
                     className={'drill-chip' + (d.id === selectedDrill ? ' active' : '')}>
                  {d.label}
                </div>
              ))}
            </div>

            {/* target stepper */}
            <div style={{
              display: 'flex', alignItems: 'center',
              marginBottom: 16,
              padding: '0 4px',
            }}>
              <div style={{ flex: 1 }}>
                <div className="kicker" style={{ marginBottom: 4 }}>Target Shots</div>
                <div style={{
                  fontFamily: 'Lexend', fontSize: 11,
                  color: 'rgba(240,237,230,0.5)',
                }}>You\u2019ll stop at this many</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="btn-circ" style={{ width: 40, height: 40, minWidth: 40 }}>
                  <IcMinus size={16}/>
                </button>
                <div style={{
                  fontFamily: 'Barlow Condensed',
                  fontWeight: 900,
                  fontStyle: 'italic',
                  fontSize: 48,
                  lineHeight: 0.9,
                  color: 'var(--c-white)',
                  minWidth: 60, textAlign: 'center',
                  fontVariantNumeric: 'tabular-nums',
                }}>{shotTarget}</div>
                <button className="btn-circ" style={{ width: 40, height: 40, minWidth: 40, borderColor: 'rgba(86,211,100,0.35)', color: '#8fea98' }}>
                  <IcPlus size={16}/>
                </button>
              </div>
            </div>

            {/* CTA */}
            <button className="btn btn-primary-green" style={{ width: '100%' }} onClick={onStart}>
              <IcPlay size={16} style={{ marginRight: 4 }}/> Start Tracking
            </button>
          </div>
        </div>
      </CamStage>
    </div>
  );
}

Object.assign(window, { Screen1_Setup });
