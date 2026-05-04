// Chrome.jsx — TopBar, BottomNav, Eyebrow/Title, Primary/Secondary buttons
function TopBar({ title = null }) {
return (
<div className="ciq-topbar">
<div className="brand">
<svg width="26" height="26" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
<circle cx="100" cy="100" r="86" fill="none" stroke="#F5A623" strokeWidth="7"/>
<path d="M100 14 Q78 58, 100 100 Q122 58, 100 14 Z" fill="#F5A623"/>
<path d="M186 100 Q142 78, 100 100 Q142 122, 186 100 Z" fill="#F5A623"/>
<path d="M100 186 Q122 142, 100 100 Q78 142, 100 186 Z" fill="#F5A623"/>
<path d="M14 100 Q58 122, 100 100 Q58 78, 14 100 Z" fill="#F5A623"/>
</svg>
COURT<span>IQ</span>
</div>
<button className="ciq-icon-btn" aria-label="Notifications">
<IcBell size={18}/>
</button>
</div>
);
}

const NAV = [
{ id: 'home', label: 'Home', accent: '#f5a623', Icon: IcHome },
{ id: 'train', label: 'Train', accent: '#4ca3ff', Icon: IcTrain },
{ id: 'track', label: 'Track', accent: '#56d364', Icon: IcTrack },
{ id: 'coach', label: 'Coach', accent: '#bc8cff', Icon: IcCoach },
{ id: 'me', label: 'Me', accent: '#2dd4bf', Icon: IcMe },
];

function BottomNav({ active, onChange }) {
const activeItem = NAV.find(n => n.id === active) || NAV[0];
return (
<div className="ciq-bottom-nav" style={{ '--accent': activeItem.accent }}>
{NAV.map(n => {
const isActive = n.id === active;
const I = n.Icon;
return (
<button
key={n.id}
className={'ciq-nav-item' + (isActive ? ' active' : '')}
style={{ '--accent': n.accent, color: isActive ? n.accent : undefined }}
onClick={() => onChange(n.id)}
>
{isActive ? (
<div className="chip" style={{
background: `${n.accent}2e`,
border: `1px solid ${n.accent}55`,
padding: '6px 14px', borderRadius: 14, marginBottom: 2,
display: 'flex', alignItems: 'center', gap: 6,
}}>
<I size={18}/>
</div>
) : <I size={20}/>}
<div className="lb">{n.label}</div>
</button>
);
})}
</div>
);
}

function Eyebrow({ children, color }) {
return <div className="ciq-eyebrow" style={color ? { color } : null}>{children}</div>;
}
function Title({ children, style }) {
return <h1 className="ciq-title" style={style}>{children}</h1>;
}

function PrimaryBtn({ children, accent = '#f5a623', onClick, style }) {
return (
<button className="ciq-primary-btn" onClick={onClick} style={{ '--accent': accent, ...style }}>
{children}
</button>
);
}
function SecondaryBtn({ children, onClick, style }) {
return <button className="ciq-secondary-btn" onClick={onClick} style={style}>{children}</button>;
}

function StatTile({ label, value, accent = false, accentColor = '#f5a623' }) {
return (
<div className="ciq-stat-tile">
<div className="lbl">{label}</div>
<div className="val" style={accent ? { color: accentColor } : null}>{value}</div>
</div>
);
}

Object.assign(window, { TopBar, BottomNav, Eyebrow, Title, PrimaryBtn, SecondaryBtn, StatTile, NAV });
