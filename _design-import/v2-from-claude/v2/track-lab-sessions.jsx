// track-lab-sessions.jsx — Sessions list screen

const TLSessionRow = ({ s, expanded, onToggle }) => (
  <>
    <div className={"tl-row" + (expanded ? " is-expanded" : "")} onClick={onToggle}>
      <div className="tl-row__thumb">
        <window.TLMiniCourt thumb={s.thumb} />
      </div>
      <div className="tl-row__body">
        <div className="tl-row__top">
          <span>{s.fg}<span className="tl-row__pct">%</span></span>
          <span className={"tl-row__delta " + (s.delta >= 0 ? "is-up" : "is-down")}>
            {s.delta >= 0 ? "▲" : "▼"} {Math.abs(s.delta)} PTS
          </span>
        </div>
        <div className="tl-row__sub">
          <span>{s.date}</span>
          <span>{s.made}/{s.att}</span>
          <span>{s.durationMin}:{String(s.durationSec).padStart(2,"0")}</span>
          <span>BEST · {s.bestZone} {s.bestZoneFg}%</span>
        </div>
      </div>
      <div className="tl-row__chevron">›</div>
    </div>
    {expanded && (
      <div className="tl-row-detail">
        <div className="tl-row-detail__lbl">DRILLS · {s.drills.length}</div>
        <ul className="tl-row-detail__list">
          {s.drills.map((d, i) => (
            <li className="tl-mini-drill" key={i}>
              <span className="tl-mini-drill__idx">{String(i+1).padStart(2,"0")}</span>
              <span className="tl-mini-drill__name">{d.name}</span>
              <span className="tl-mini-drill__bar"><span className="tl-mini-drill__fill" style={{ width: d.fg + "%" }} /></span>
              <span className="tl-mini-drill__pct">{d.fg}<span>%</span></span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </>
);

const TLSessionsScreen = ({ sessions, goBack }) => {
  const [expanded, setExpanded] = React.useState(null);
  const groups = [
    { id: "this-week", name: "THIS WEEK" },
    { id: "last-week", name: "LAST WEEK" },
  ];
  return (
    <div className="tl">
      <div className="tl-stamp">
        <div className="tl-stamp__l">
          <button className="tl-stamp__back" aria-label="Back" onClick={goBack}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <div className="tl-stamp__eyebrow">TRACK · SESSIONS</div>
            <div className="tl-stamp__meta">All recent sessions</div>
          </div>
        </div>
        <div className="tl-stamp__pill">{sessions.length}</div>
      </div>
      <div className="tl-scroll">
        {groups.map(g => {
          const list = sessions.filter(s => s.group === g.id);
          if (!list.length) return null;
          const totMade = list.reduce((a,s) => a + s.made, 0);
          const totAtt  = list.reduce((a,s) => a + s.att, 0);
          const wfg = Math.round((totMade / totAtt) * 100) || 0;
          return (
            <div className="tl-sessions__group" key={g.id}>
              <div className="tl-sessions__group-head">
                <span className="tl-sessions__group-name">{g.name}</span>
                <span className="tl-sessions__group-meta">{list.length} sessions · {wfg}% FG</span>
              </div>
              {list.map(s => (
                <TLSessionRow
                  key={s.id} s={s}
                  expanded={expanded === s.id}
                  onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                />
              ))}
            </div>
          );
        })}
        <div className="tl-foot">CourtIQ · Track · Sessions</div>
      </div>
    </div>
  );
};

window.TLSessionsScreen = TLSessionsScreen;
