// Screen2_Active.jsx — the hero screen, NBA broadcast overlay vibe

function Screen2_Active({ state = 'ready', detectionDensity = 'broadcast', bgStyle = 'moody', safeAreaViz = false }) {
  // state: ready | detected | tracking | scored | miss

  const stateColor = {
    ready:    { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.18)', text: 'rgba(240,237,230,0.95)', dot: 'rgba(240,237,230,0.85)' },
    detected: { bg: 'rgba(245,166,35,0.18)',  border: 'rgba(245,166,35,0.6)',   text: '#ffbe50',               dot: '#f5a623' },
    tracking: { bg: 'rgba(245,166,35,0.18)',  border: 'rgba(86,211,100,0.5)',   text: '#ffd680',               dot: '#f5a623' },
    scored:   { bg: 'rgba(86,211,100,0.22)',  border: 'rgba(86,211,100,0.7)',   text: '#a0f0ac',               dot: '#56d364' },
    miss:     { bg: 'rgba(232,64,64,0.2)',    border: 'rgba(232,64,64,0.6)',    text: '#ff8888',               dot: '#e84040' },
  }[state] || {};

  const stateText = {
    ready: 'Ready', detected: 'Shot Detected', tracking: 'Tracking Arc',
    scored: 'Scored!', miss: 'Miss',
  }[state];

  const lastShots = ['made','made','miss','made','made','miss','made','made','made','made'];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      <CamStage bgStyle={bgStyle}>

        {/* ═══ DETECTION OVERLAYS ═══ */}
        {/* player — subtle white box, always */}
        {detectionDensity !== 'minimal' && (
          <div style={{
            position: 'absolute', left: '14%', top: '52%',
            width: '22%', height: '36%',
            border: '1.5px solid rgba(240,237,230,0.3)',
            borderRadius: 2,
            pointerEvents: 'none',
          }}/>
        )}

        {/* hoop — amber, locked corner brackets + LED */}
        <CornerBox x={43} y={31} w={16} h={10}
                   color="#f5a623" label="HOOP · LOCKED" pulse/>

        {/* ball — green, corner brackets. Position shifts with state. */}
        {(() => {
          const pos = {
            ready:    { x: 26, y: 62, w: 7, h: 7 },
            detected: { x: 34, y: 56, w: 7, h: 7 },
            tracking: { x: 42, y: 44, w: 7, h: 7 },
            scored:   { x: 50, y: 38, w: 6, h: 6 },
            miss:     { x: 54, y: 40, w: 6, h: 6 },
          }[state] || { x: 26, y: 62, w: 7, h: 7 };
          return <CornerBox {...pos} color="#56d364" label="BALL 94%" fill/>;
        })()}

        {/* trajectory arc — shown during tracking/scored/miss */}
        {(state === 'tracking' || state === 'scored' || state === 'miss') && detectionDensity !== 'minimal' && (
          <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice"
               style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <linearGradient id="arcGrad" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor={state === 'miss' ? '#e84040' : '#f5a623'} stopOpacity="0.9"/>
                <stop offset="100%" stopColor={state === 'miss' ? '#e84040' : '#56d364'} stopOpacity="0.95"/>
              </linearGradient>
            </defs>
            <path d={state === 'miss'
              ? 'M 115 565 Q 170 240 240 360'
              : 'M 115 565 Q 180 220 210 300'}
              fill="none" stroke="url(#arcGrad)" strokeWidth="3"
              strokeDasharray="4 6" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(245,166,35,0.4))' }}/>
            {/* dots along path */}
            {[0.15,0.35,0.55,0.75].map((t,i) => (
              <circle key={i} cx={115 + (state==='miss' ? 125*t : 95*t + 40*Math.sin(t*Math.PI))}
                      cy={565 - 280*Math.sin(t*Math.PI)}
                      r="2.5" fill={state==='miss'?'#e84040':'#f5a623'}/>
            ))}
          </svg>
        )}

        {/* release-angle overlay — max density only */}
        {detectionDensity === 'max' && (state === 'detected' || state === 'tracking') && (
          <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice"
               style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <g stroke="#56d364" strokeWidth="1.2" fill="none" opacity="0.8">
              <path d="M 115 565 L 195 565" strokeDasharray="3 3"/>
              <path d="M 115 565 L 190 475"/>
              <path d="M 140 565 A 25 25 0 0 0 133 545" stroke="#56d364"/>
            </g>
            <text x="145" y="557" fill="#7ee589"
                  fontFamily="Barlow Condensed" fontWeight="700" fontSize="11"
                  letterSpacing="0.12em">42°</text>
          </svg>
        )}

        {/* ═══ SCORED CONFETTI HINT ═══ */}
        {state === 'scored' && (
          <div style={{ position: 'absolute', left: '48%', top: '32%', pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, width: 40, height: 40,
              borderRadius: 50, border: '2px solid #56d364',
            }} className="pulse-ring"/>
            <div style={{
              position: 'absolute', left: 8, top: 8, width: 24, height: 24,
              borderRadius: 50, border: '2px solid #56d364',
            }} className="pulse-ring" style={{ animationDelay: '0.3s', position:'absolute', left:8, top:8, width:24, height:24, borderRadius:50, border:'2px solid #56d364' }}/>
          </div>
        )}

        {/* ═══ TOP-LEFT STAT CARD ═══ */}
        <div style={{
          position: 'absolute',
          top: 60, left: 12,
          zIndex: 10,
        }}>
          <div className="glass-apple" style={{
            borderRadius: 18,
            padding: '10px 14px 12px',
            minWidth: 150,
          }}>
            <div className="kicker" style={{ marginBottom: 6 }}>Session</div>
            <div style={{
              fontFamily: 'Barlow Condensed',
              fontWeight: 900, fontStyle: 'italic',
              fontSize: 44, lineHeight: 0.9,
              color: 'var(--c-white)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.01em',
            }}>14<span style={{ color: 'rgba(240,237,230,0.4)', fontSize: 30 }}>/18</span></div>
            <div style={{
              fontFamily: 'Barlow Condensed',
              fontWeight: 800, fontStyle: 'italic',
              fontSize: 24, lineHeight: 1, marginTop: 2,
              color: '#7ee589',
            }}>78%</div>
            {/* sparkline dots */}
            <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
              {lastShots.map((s, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: 50,
                  background: s === 'made' ? '#56d364' : 'rgba(232,64,64,0.7)',
                  boxShadow: s === 'made' ? '0 0 4px rgba(86,211,100,0.6)' : 'none',
                }}/>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ TOP-RIGHT TIMER CHIP ═══ */}
        <div style={{
          position: 'absolute',
          top: 60, right: 12,
          zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end',
        }}>
          <div className="glass-apple" style={{
            height: 36, borderRadius: 12,
            padding: '0 12px',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 50, background: '#e84040',
                          boxShadow: '0 0 6px rgba(232,64,64,0.7)' }} className="pulse-dot"/>
            <span style={{
              fontFamily: 'Barlow Condensed',
              fontWeight: 600, fontSize: 15,
              letterSpacing: '0.06em',
              color: 'var(--c-white)',
              fontVariantNumeric: 'tabular-nums',
            }}>03:24</span>
          </div>
          {detectionDensity !== 'minimal' && (
            <div className="glass-apple" style={{
              height: 26, borderRadius: 10,
              padding: '0 10px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 700, fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(240,237,230,0.5)',
              }}>Streak</span>
              <span style={{
                fontFamily: 'Barlow Condensed',
                fontWeight: 900, fontStyle: 'italic',
                fontSize: 15, color: '#7ee589', lineHeight: 1,
              }}>6</span>
              <IcFlame size={11} style={{ color: '#ffbe50' }}/>
            </div>
          )}
        </div>

        {/* ═══ BOTTOM-CENTER STATE PILL ═══ */}
        <div style={{
          position: 'absolute',
          bottom: 140,
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 10,
        }}>
          <div className={'glass-apple ' + (state === 'scored' ? 'scored-burst' : '')}
               key={state}
               style={{
            borderRadius: 999,
            padding: '10px 18px',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: `linear-gradient(180deg, ${stateColor.bg} 0%, ${stateColor.bg} 100%)`,
            borderColor: stateColor.border,
            boxShadow: `0 0 24px ${stateColor.border}, 0 1px 0 rgba(255,255,255,0.08) inset`,
          }}>
            <span style={{ position: 'relative', width: 10, height: 10 }}>
              <span style={{
                position: 'absolute', inset: 0, borderRadius: 50,
                background: stateColor.dot,
                boxShadow: `0 0 8px ${stateColor.dot}`,
              }} className={state === 'ready' ? 'pulse-dot' : ''}/>
              {state === 'tracking' && (
                <span style={{
                  position: 'absolute', inset: -4, borderRadius: 50,
                  border: `2px solid ${stateColor.dot}`,
                }} className="pulse-ring"/>
              )}
            </span>
            <span style={{
              fontFamily: 'Barlow Condensed',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: stateColor.text,
            }}>{stateText}</span>
            {state === 'tracking' && (
              <span style={{ display: 'inline-flex', gap: 3 }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    width: 3, height: 3, borderRadius: 50,
                    background: stateColor.dot,
                    animation: `arc-progress-dots 0.9s ${i*0.15}s ease-in-out infinite`,
                  }}/>
                ))}
              </span>
            )}
            {state === 'scored' && <span style={{ color: stateColor.text, fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 14 }}>+1</span>}
          </div>
        </div>

        {/* ═══ BOTTOM ACTION ROW ═══ */}
        <div style={{
          position: 'absolute',
          left: 10, right: 10, bottom: 10,
          zIndex: 10,
        }}>
          <div className="glass-apple" style={{
            borderRadius: 22,
            padding: '10px 12px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <button className="btn-circ" aria-label="Pause">
              <IcPause size={20}/>
            </button>
            {/* recent-shot thumb strip */}
            <div style={{ flex: 1, display: 'flex', gap: 6, justifyContent: 'center' }}>
              {[
                { made: true,  n: 13 },
                { made: false, n: 12 },
                { made: true,  n: 11 },
              ].map((s, i) => (
                <div key={i} style={{
                  width: 44, height: 44,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  position: 'relative',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
                  padding: 3,
                  overflow: 'hidden',
                }}>
                  {/* mini faux shot frame */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, rgba(60,40,15,0.6) 0%, rgba(10,10,10,0.8) 100%)',
                  }}/>
                  <div style={{
                    position: 'absolute', left: '32%', top: '18%',
                    width: 14, height: 8, border: '1px solid rgba(245,166,35,0.7)', borderRadius: 1,
                  }}/>
                  <div style={{
                    position: 'absolute', left: '55%', top: '60%',
                    width: 6, height: 6, borderRadius: 50,
                    background: 'rgba(245,166,35,0.8)',
                  }}/>
                  <span style={{
                    position: 'relative', zIndex: 2,
                    width: 10, height: 10, borderRadius: 50,
                    background: s.made ? '#56d364' : '#e84040',
                    boxShadow: `0 0 4px ${s.made ? 'rgba(86,211,100,0.8)' : 'rgba(232,64,64,0.8)'}`,
                    border: '1.5px solid rgba(0,0,0,0.4)',
                  }}/>
                  <span style={{
                    position: 'absolute', top: 3, left: 4,
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 800, fontSize: 9,
                    color: 'rgba(240,237,230,0.9)',
                    letterSpacing: '0.04em',
                    zIndex: 2,
                  }}>#{s.n}</span>
                </div>
              ))}
            </div>
            <button className="btn-circ btn-circ-red" aria-label="End session">
              <IcStop size={18}/>
            </button>
          </div>
        </div>

        {/* Safe-area viz */}
        {safeAreaViz && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 47,
                          background: 'rgba(86,211,100,0.12)', borderBottom: '1px dashed rgba(86,211,100,0.5)' }}/>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 34,
                          background: 'rgba(86,211,100,0.12)', borderTop: '1px dashed rgba(86,211,100,0.5)' }}/>
          </div>
        )}
      </CamStage>
    </div>
  );
}

Object.assign(window, { Screen2_Active });
