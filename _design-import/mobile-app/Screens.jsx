// Screens.jsx — Home, Train, Track, Coach, Me

// Inline avatar SVG — stylized hoops silhouette on dark disc
const AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
'<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
'<stop offset="0" stop-color="#2a2420"/>' +
'<stop offset="1" stop-color="#0c0d0f"/>' +
'</linearGradient></defs>' +
'<circle cx="50" cy="50" r="50" fill="url(#bg)"/>' +
'<circle cx="50" cy="38" r="13" fill="#f0ede6"/>' +
'<path d="M22 92 C22 72, 34 62, 50 62 C66 62, 78 72, 78 92 Z" fill="#f0ede6"/>' +
'<circle cx="72" cy="30" r="10" fill="#f5a623"/>' +
'<path d="M62 30 Q72 20 82 30 M62 30 Q72 40 82 30 M72 20 Q72 30 72 40" stroke="#8b4a12" stroke-width="1" fill="none"/>' +
'</svg>'
);

// ─── HOME ──────────────────────────────────────────────────
function HomeScreen() {
return (
<div className="ciq-screen" style={{ '--accent': '#f5a623', padding: '100px 16px 120px' }}>
{/* Profile hero card */}
<div style={{
borderRadius: 24,
background: 'linear-gradient(135deg, #f5a623 0%, #c88418 100%)',
padding: '16px 18px 18px',
position: 'relative', overflow: 'hidden',
boxShadow: '0 12px 40px rgba(245,166,35,0.35)',
display: 'flex', gap: 14,
}}>
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
<span style={{
display: 'inline-flex', alignItems: 'center', gap: 6,
background: 'rgba(14,16,20,0.85)', color: '#f5a623',
padding: '4px 10px', borderRadius: 100,
fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 800,
letterSpacing: '0.12em', textTransform: 'uppercase',
alignSelf: 'flex-start',
}}>★ ELITE MEMBER</span>
<div style={{ marginTop: 10 }}>
<div style={{
fontFamily: 'Barlow Condensed', fontSize: 40, fontWeight: 900,
fontStyle: 'italic', color: '#0c0d0f', lineHeight: 1,
}}>Tamir</div>
<div style={{
fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 800,
letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0c0d0f',
marginTop: 4, opacity: 0.85,
}}>POINT GUARD · CHICAGO, IL</div>
</div>
<div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
<button style={{ background: 'rgba(14,16,20,0.75)', color: '#f5a623', border: 'none', fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 14px', borderRadius: 999 }}>Edit Profile</button>
<button style={{ background: '#0c0d0f', color: '#f0ede6', border: 'none', fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 14px', borderRadius: 999 }}>Share</button>
</div>
</div>
<img src={AVATAR} width="90" height="90" alt="avatar" style={{ flexShrink: 0, alignSelf: 'center' }}/>
</div>

{/* Level card */}
<div className="ciq-glass" style={{ padding: 16, marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
<div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,166,35,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5a623' }}>
<IcBolt size={20}/>
</div>
<div style={{ flex: 1 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
<span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f5a623' }}>HOOPER · LVL</span>
<span style={{ fontSize: 11, color: 'rgba(240,237,230,0.45)' }}>450 / 600 XP</span>
</div>
<div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 100, marginTop: 6, overflow: 'hidden' }}>
<div style={{ width: '75%', height: '100%', background: 'linear-gradient(90deg, #f5a623, #ffc04a)' }}/>
</div>
</div>
<div style={{ textAlign: 'center' }}>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 900, color: '#f0ede6' }}>7 <IcFlame size={14} style={{ display: 'inline', color: '#f5a623' }}/></div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.45)', fontWeight: 700 }}>STREAK</div>
</div>
</div>

{/* Daily challenge */}
<div className="ciq-glass" style={{ padding: '16px 18px', marginTop: 14 }}>
<div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #f5a623, transparent)', opacity: 0.5 }}/>
<Eyebrow>● DAILY CHALLENGE</Eyebrow>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 900, fontStyle: 'italic', color: '#f0ede6', lineHeight: 1.1, marginTop: 6 }}>Log a Full Shooting Session</div>
<div style={{ fontSize: 12, color: 'rgba(240,237,230,0.5)', marginTop: 4 }}>+150 XP · New Record Unlock</div>
<div style={{ marginTop: 12 }}><PrimaryBtn>Start</PrimaryBtn></div>
</div>

<div style={{ marginTop: 20 }}>
<Eyebrow>PERFORMANCE INSIGHT</Eyebrow>
<Title style={{ fontSize: 34, marginTop: 4 }}>On the Rise</Title>
<div style={{ color: 'rgba(240,237,230,0.65)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
Your field-goal percentage climbed 8% this week. Keep the shooting routine consistent.
</div>
</div>
</div>
);
}

// ─── TRAIN ─────────────────────────────────────────────────
function TrainScreen() {
const accent = '#4ca3ff';
const drills = [
{ n: 1, name: 'Step-Through Jumper', meta: '4 sets × 8 reps per side · 14min' },
{ n: 2, name: 'Zone Defense Rotations', meta: '4 rounds × 3 minutes · 20min' },
{ n: 3, name: 'Defensive Shuffle Intervals', meta: '8 rounds of 20s on / 10s off · 12min' },
];
return (
<div className="ciq-screen" style={{ '--accent': accent, padding: '100px 16px 120px' }}>
<Eyebrow color={accent}>YOUR PROGRAM</Eyebrow>
<Title style={{ marginTop: 4 }}>Training</Title>

<div className="ciq-glass" style={{ padding: '20px 20px 22px', marginTop: 16 }}>
<div style={{
fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 800,
letterSpacing: '0.18em', textTransform: 'uppercase', color: accent,
display: 'inline-flex', alignItems: 'center', gap: 6,
}}>● WEEK 16</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 32, fontWeight: 900, fontStyle: 'italic', color: '#f0ede6', lineHeight: 1, marginTop: 10 }}>
Elite Combination Challenge
</div>
<div style={{ color: 'rgba(240,237,230,0.6)', fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
The hardest weekly challenge — step-throughs, close-out defense, and peak conditioning all in one.
</div>

<div style={{ marginTop: 14 }}>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)', marginBottom: 8 }}>THIS WEEK'S DRILLS</div>
{drills.map(d => (
<div key={d.n} style={{
display: 'flex', alignItems: 'center', gap: 12,
padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)',
}}>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 900, fontStyle: 'italic', color: accent, width: 22 }}>{d.n}</div>
<div style={{ flex: 1 }}>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 14, fontWeight: 800, color: '#f0ede6', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{d.name}</div>
<div style={{ fontSize: 11, color: 'rgba(240,237,230,0.45)' }}>{d.meta}</div>
</div>
<IcPlay size={16} style={{ color: accent }}/>
</div>
))}
</div>

<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
<PrimaryBtn accent={accent}>Start Challenge</PrimaryBtn>
<div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 900, color: '#f0ede6', lineHeight: 1 }}>50 <span style={{ fontSize: 12, color: 'rgba(240,237,230,0.45)' }}>MIN</span></div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)' }}>TOTAL</div>
</div>
</div>
</div>

<div style={{ marginTop: 22 }}>
<Eyebrow color={accent}>WEEKLY GOALS</Eyebrow>
<div className="ciq-row" style={{ marginTop: 10 }}>
<div className="ciq-glass" style={{ padding: 14, minHeight: 72 }}>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)' }}>3-PT SHOTS</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 900, color: '#f0ede6', marginTop: 4 }}>48/100</div>
</div>
<div className="ciq-glass" style={{ padding: 14, minHeight: 72 }}>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)' }}>CARDIO</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 900, color: '#f0ede6', marginTop: 4 }}>120 <span style={{ fontSize: 11, color: 'rgba(240,237,230,0.45)' }}>MIN</span></div>
</div>
</div>
</div>
</div>
);
}

// ─── TRACK / THE LAB ───────────────────────────────────────
function TrackScreen({ onLaunchCamera }) {
const accent = '#56d364';
return (
<div className="ciq-screen" style={{ '--accent': accent, padding: '100px 16px 120px' }}>
<Eyebrow color={accent}>YOUR ANALYTICS</Eyebrow>
<Title style={{ marginTop: 4 }}>The Lab.</Title>

<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
<StatTile label="SESSIONS" value="12"/>
<StatTile label="SHOOTING %" value="47%" accent accentColor={accent}/>
<StatTile label="TOTAL XP" value="2,340" accent accentColor="#f5a623"/>
<StatTile label="DAY STREAK" value="7"/>
</div>

<div className="ciq-glass" style={{ padding: '18px 20px 20px', marginTop: 14 }}>
<div style={{
display: 'inline-flex', alignItems: 'center', gap: 8,
background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)',
padding: '4px 12px', borderRadius: 100,
fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 700,
letterSpacing: '0.14em', textTransform: 'uppercase', color: '#f5a623',
}}>
<span style={{ width: 6, height: 6, borderRadius: 50, background: '#f5a623' }}/>AI POWERED
</div>
<div style={{ display: 'flex', gap: 14, marginTop: 12, alignItems: 'flex-start' }}>
<div style={{ flex: 1 }}>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: '#f0ede6', lineHeight: 0.95, textTransform: 'uppercase' }}>Shot Tracker</div>
<div style={{ color: 'rgba(240,237,230,0.6)', fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
Analyze every shot in real-time with YOLOX AI — works live or from uploaded video.
</div>
</div>
<div style={{ textAlign: 'right' }}>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)' }}>LAST · MAR 15</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 44, fontWeight: 900, fontStyle: 'italic', color: '#f5a623', lineHeight: 1 }}>33%</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)' }}>FIELD GOAL %</div>
</div>
</div>
<div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
<PrimaryBtn accent={accent} onClick={onLaunchCamera}>
<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IcCamera size={14}/>Launch Camera</span>
</PrimaryBtn>
<SecondaryBtn>
<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IcUpload size={14}/>Upload Video</span>
</SecondaryBtn>
</div>
</div>
</div>
);
}

// ─── SHOT TRACKER LIVE CAM ─────────────────────────────────
function ShotTrackerCam({ onClose }) {
return (
<div className="ciq-screen" style={{ padding: 0, background: '#000' }}>
{/* fake video */}
<div style={{
position: 'absolute', inset: 0,
background: 'radial-gradient(ellipse at 50% 40%, #3a2b10 0%, #0a0a0a 70%)',
}}/>
{/* court floor */}
<div style={{
position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%',
background: 'linear-gradient(180deg, rgba(140,80,20,0.35) 0%, rgba(40,20,5,0.8) 100%)',
}}/>
{/* hoop box */}
<div style={{
position: 'absolute', left: '40%', top: '18%', width: 80, height: 60,
border: '2px solid #56d364', borderRadius: 4,
}}>
<div style={{ position: 'absolute', top: -20, left: 0, fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#56d364', textTransform: 'uppercase' }}>HOOP · 0.94</div>
</div>
{/* ball box */}
<div style={{
position: 'absolute', left: '52%', top: '58%', width: 28, height: 28,
border: '2px solid #f5a623', borderRadius: 50,
}}>
<div style={{ position: 'absolute', top: -18, left: 0, fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#f5a623', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>BALL · 0.87</div>
</div>
{/* player box */}
<div style={{
position: 'absolute', left: '20%', top: '52%', width: 90, height: 180,
border: '2px solid #4ca3ff', borderRadius: 4,
}}>
<div style={{ position: 'absolute', top: -18, left: 0, fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#4ca3ff', textTransform: 'uppercase' }}>PLAYER · 0.98</div>
</div>

{/* Top HUD */}
<div style={{ position: 'absolute', top: 54, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
<button onClick={onClose} className="ciq-icon-btn" style={{ background: 'rgba(0,0,0,0.5)' }}><IcX size={18}/></button>
<div style={{
display: 'inline-flex', alignItems: 'center', gap: 8,
background: 'rgba(232,64,64,0.15)', border: '1px solid rgba(232,64,64,0.5)',
padding: '6px 14px', borderRadius: 100,
fontFamily: 'Barlow Condensed', fontSize: 12, fontWeight: 800,
letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ff5555',
}}>
<span style={{ width: 8, height: 8, borderRadius: 50, background: '#e84040' }}/>LIVE · REC
</div>
</div>

{/* Bottom HUD — live session stats glass */}
<div className="ciq-glass" style={{
position: 'absolute', bottom: 24, left: 10, right: 10, padding: '14px 16px', zIndex: 10,
}}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)' }}>LIVE SESSION</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 44, fontWeight: 900, fontStyle: 'italic', color: '#56d364', lineHeight: 1 }}>60%</div>
</div>
<div style={{ display: 'flex', gap: 22 }}>
<div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 24, fontWeight: 900, color: '#f0ede6', lineHeight: 1 }}>3</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)' }}>MADE</div>
</div>
<div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 24, fontWeight: 900, color: '#f0ede6', lineHeight: 1 }}>5</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)' }}>ATTEMPTS</div>
</div>
<div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 24, fontWeight: 900, color: '#f0ede6', lineHeight: 1 }}>2:14</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)' }}>ELAPSED</div>
</div>
</div>
</div>
</div>
</div>
);
}

// ─── COACH ─────────────────────────────────────────────────
function CoachScreen() {
const accent = '#bc8cff';
return (
<div className="ciq-screen" style={{ '--accent': accent, padding: '100px 16px 120px' }}>
<Eyebrow color={accent}>AI COACH</Eyebrow>
<Title style={{ marginTop: 4 }}>Coach.</Title>

<div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
{/* coach msg */}
<div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
<div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(188,140,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
<IcCoach size={18}/>
</div>
<div className="ciq-glass" style={{ padding: '12px 14px', borderRadius: '4px 20px 20px 20px', maxWidth: '80%' }}>
<div style={{ fontSize: 14, color: '#f0ede6', lineHeight: 1.5 }}>
Your release is <strong style={{ color: accent }}>0.12s slower</strong> on contested shots. Let's add a quick-release drill to this week.
</div>
</div>
</div>
{/* user msg */}
<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
<div style={{
background: accent, color: '#0c0d0f',
padding: '10px 14px', borderRadius: '20px 4px 20px 20px',
fontSize: 14, fontWeight: 500, maxWidth: '75%',
}}>
How do I fix that?
</div>
</div>
{/* coach reply + recs */}
<div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
<div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(188,140,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
<IcCoach size={18}/>
</div>
<div className="ciq-glass" style={{ padding: '12px 14px', borderRadius: '4px 20px 20px 20px', maxWidth: '85%' }}>
<div style={{ fontSize: 14, color: '#f0ede6', lineHeight: 1.5 }}>
Two drills, 12 min combined:
</div>
<div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
{['Catch-and-Shoot · 4×10', 'Elbow Pull-Up · 3×8'].map(d => (
<div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px 12px', borderRadius: 10 }}>
<IcPlay size={14} style={{ color: accent }}/>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f0ede6', flex: 1 }}>{d}</div>
<IcChevR size={14} style={{ color: 'rgba(240,237,230,0.3)' }}/>
</div>
))}
</div>
</div>
</div>
</div>

<div className="ciq-glass" style={{ marginTop: 14, padding: 8, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 999 }}>
<input placeholder="Ask your coach…" style={{
flex: 1, background: 'transparent', border: 'none', outline: 'none',
color: '#f0ede6', fontFamily: 'Barlow, sans-serif', fontSize: 14, padding: '8px 12px',
}}/>
<button style={{
background: accent, color: '#0c0d0f', border: 'none',
width: 38, height: 38, borderRadius: 999,
display: 'flex', alignItems: 'center', justifyContent: 'center',
}}>
<IcChevR size={18}/>
</button>
</div>
</div>
);
}

// ─── ME / PROFILE ──────────────────────────────────────────
function MeScreen() {
const accent = '#2dd4bf';
return (
<div className="ciq-screen" style={{ '--accent': accent, padding: '80px 16px 120px' }}>
{/* hero w/ moody stadium wash */}
<div style={{
height: 160, borderRadius: 20, position: 'relative', overflow: 'hidden',
background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.25) 0%, transparent 40%), linear-gradient(180deg, #1a2332 0%, #0a1018 100%)',
display: 'flex', alignItems: 'flex-end', padding: 14,
}}>
{/* "stadium lights" */}
<div style={{ position: 'absolute', top: 10, left: '30%', width: 20, height: 20, borderRadius: 50, background: '#fff', filter: 'blur(6px)', opacity: 0.6 }}/>
<div style={{ position: 'absolute', top: 20, left: '60%', width: 16, height: 16, borderRadius: 50, background: '#fff', filter: 'blur(6px)', opacity: 0.4 }}/>
<img src={AVATAR} width="80" height="80" alt="" style={{ borderRadius: 16, background: 'rgba(0,0,0,0.5)' }}/>
<div style={{ marginLeft: 12, flex: 1 }}>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent }}>POINT GUARD</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 34, fontWeight: 900, fontStyle: 'italic', color: '#f0ede6', lineHeight: 1 }}>TAMIR</div>
<div style={{ fontSize: 12, color: 'rgba(240,237,230,0.6)', marginTop: 4 }}>Complete onboarding to personalise your profile.</div>
</div>
</div>

{/* 3 stats */}
<div className="ciq-row" style={{ marginTop: 14 }}>
<StatTile label="SESSIONS LOGGED" value="12"/>
<StatTile label="AVG SHOTS MADE" value="8.4"/>
<StatTile label="FIELD GOAL %" value="47%" accent accentColor={accent}/>
</div>

{/* Trophy case */}
<div style={{ marginTop: 20 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 8, color: accent, marginBottom: 10 }}>
<IcTrophy size={16}/>
<Eyebrow color={accent}>TROPHY CASE</Eyebrow>
</div>
<div style={{ display: 'flex', gap: 10 }}>
{[
{ n: 'FIRST', e: '🏆', ok: true },
{ n: 'DEDICATED', e: '💪', ok: true },
{ n: 'SNIPER', e: '🎯', ok: false },
{ n: 'ALL-STAR', e: '⭐', ok: false },
].map(b => (
<div key={b.n} style={{
flex: 1, height: 72, borderRadius: 16,
background: b.ok ? 'rgba(45,212,191,0.1)' : 'rgba(255,255,255,0.04)',
border: `1px solid ${b.ok ? 'rgba(45,212,191,0.25)' : 'rgba(255,255,255,0.08)'}`,
boxShadow: b.ok ? '0 0 16px rgba(45,212,191,0.2)' : 'none',
opacity: b.ok ? 1 : 0.4, filter: b.ok ? 'none' : 'grayscale(1)',
display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
}}>
<div style={{ fontSize: 24 }}>{b.ok ? b.e : '🔒'}</div>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: b.ok ? '#f0ede6' : 'rgba(240,237,230,0.3)' }}>{b.n}</div>
</div>
))}
</div>
</div>

{/* Account */}
<div style={{ marginTop: 20 }}>
<Eyebrow color={accent}>ACCOUNT</Eyebrow>
<div className="ciq-glass" style={{ padding: '12px 14px', marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
<div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(45,212,191,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
<IcMail size={16}/>
</div>
<div style={{ flex: 1 }}>
<div style={{ fontFamily: 'Barlow Condensed', fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.4)' }}>EMAIL ADDRESS</div>
<div style={{ fontSize: 14, color: '#f0ede6' }}>tamir7895@gmail.com</div>
</div>
<IcChevR size={16} style={{ color: 'rgba(240,237,230,0.3)' }}/>
</div>
</div>
</div>
);
}

Object.assign(window, { HomeScreen, TrainScreen, TrackScreen, CoachScreen, MeScreen, ShotTrackerCam });
