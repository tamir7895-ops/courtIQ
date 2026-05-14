// drill-library-detail.jsx — drill detail screen

const fmtMin = (sec) => {
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m === 0) return s + "s";
  if (s === 0) return m + "m";
  return m + ":" + String(s).padStart(2, "0");
};

const focusLabel = {
  shooting: "SHOOTING",
  ballhandling: "BALL-HANDLING",
  defense: "DEFENSE",
  athleticism: "ATHLETICISM",
};

const DLDetail = ({ drill, onBack, onStart, saved, onToggleSave }) => {
  const phases = drill.phases || [];
  const totalSec = phases.reduce((a, p) => a + p.sec, 0);
  const stats = drill.stats;
  const pctXP = Math.min(100, (stats.mastery.xp / stats.mastery.nextXp) * 100);

  const meAtt = Math.floor(stats.allTimeAttempts * 0.18);
  const meMade = Math.round(meAtt * stats.p50Fg / 100);
  const myRow = {
    handle: "you",
    fg: stats.p50Fg,
    made: meMade,
    att: meAtt,
    badge: null,
    isMe: true,
  };
  const lb = [...drill.leaderboard, myRow]
    .sort((a, b) => b.fg - a.fg)
    .slice(0, 6);

  return (
    <div className="dl-detail">
      <div className="dl-detail-stamp">
        <div className="dl-detail-stamp__l">
          <button className="dl-detail-stamp__icon-btn" onClick={onBack} aria-label="Back">
            <DLIcon.Back width="14" height="14" />
          </button>
          <div>
            <div className="dl-stamp__eyebrow">DRILL · DETAIL</div>
            <div className="dl-stamp__meta">{focusLabel[drill.focus]}</div>
          </div>
        </div>
        <div className="dl-detail-stamp__share">
          <button className={"dl-detail-stamp__icon-btn" + (saved ? " is-saved" : "")} onClick={onToggleSave} aria-label="Save">
            {saved ? <DLIcon.SaveFilled width="16" height="16" /> : <DLIcon.Save width="16" height="16" />}
          </button>
          <button className="dl-detail-stamp__icon-btn" aria-label="Share">
            <DLIcon.Share width="16" height="16" />
          </button>
        </div>
      </div>

      <div className="dl-detail__scroll">

        {/* HERO ANIMATION */}
        <div className="dl-hero-anim">
          <DLHeroAnim drill={drill} />
          <div className="dl-hero-anim__bar">
            <span>PATTERN · <b>{(drill.pattern && drill.pattern.kind || "").toUpperCase()}</b></span>
            <span className="dl-hero-anim__loop">
              <span className="dl-hero-anim__pulse" />
              LOOPING
            </span>
          </div>
        </div>

        {/* TITLE */}
        <div className="dl-title">
          <div className="dl-title__focus">
            <span className="dl-title__focus-dot" />
            {focusLabel[drill.focus]} · {drill.difficulty.toUpperCase()}
          </div>
          <div className="dl-title__name">{drill.name}</div>
          <div className="dl-title__benefit">{drill.benefit}</div>
        </div>

        {/* QUICK FACTS */}
        <div className="dl-fact-row">
          <div className="dl-fact">
            <div className="dl-fact__lbl">DURATION</div>
            <div className="dl-fact__val">{drill.duration}<span className="dl-fact__val-unit">MIN</span></div>
          </div>
          <div className="dl-fact">
            <div className="dl-fact__lbl">SETS×REPS</div>
            <div className="dl-fact__val">{drill.sets}<span className="dl-fact__val-unit">×{drill.reps}</span></div>
          </div>
          <div className="dl-fact">
            <div className="dl-fact__lbl">REST</div>
            <div className="dl-fact__val">{drill.restSec || 0}<span className="dl-fact__val-unit">S</span></div>
          </div>
          <div className="dl-fact">
            <div className="dl-fact__lbl">SPACE</div>
            <div className="dl-fact__val" style={{ fontSize: 14 }}>{(drill.space || "").toUpperCase()}</div>
          </div>
        </div>

        {/* DESCRIPTION */}
        <div style={{ marginTop: 18, fontFamily: "JetBrains Mono", fontSize: 12,
          lineHeight: 1.55, color: "rgba(240,236,228,0.78)" }}>
          {drill.description}
        </div>

        {/* COACH POINTS */}
        <div className="dl-cp">
          <div className="dl-cp__head">COACH · KEY POINTS</div>
          <ul className="dl-cp__list">
            {drill.coachPoints.map((cp, i) => (
              <li className="dl-cp__row" key={i}>
                <span className="dl-cp__num">{String(i + 1).padStart(2, "0")}</span>
                <span className="dl-cp__txt">{cp}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* PHASES */}
        <div className="dl-phases">
          <div className="dl-cp__head">RUN ORDER · TOTAL {fmtMin(totalSec)}</div>
          <div className="dl-phases__list">
            {phases.map((p, i) => {
              const isRest = p.id.startsWith("rest");
              return (
                <div key={i} className={"dl-phase" + (isRest ? " dl-phase--rest" : "")}>
                  <span className="dl-phase__idx">{String(i + 1).padStart(2, "0")}</span>
                  <span className="dl-phase__lbl">{p.label}</span>
                  <span className="dl-phase__time">{p.sec}<span className="dl-phase__time-unit">S</span></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* MY STATS */}
        <div className="dl-stats">
          <div className="dl-stats__head">
            <span className="dl-stats__head-title">MY STATS</span>
            <span className="dl-stats__last">LAST · {stats.lastDone}</span>
          </div>

          <div className="dl-mastery">
            <div className="dl-mastery__row">
              <div className="dl-mastery__name">
                <DLMasteryBadge mastery={stats.mastery} size="lg" />
                <span className="dl-mastery__lvl">LVL {stats.mastery.level}</span>
              </div>
              <div className="dl-mastery__xp">
                <b>{stats.mastery.xp}</b> / {stats.mastery.nextXp} XP
              </div>
            </div>
            <div className="dl-mastery__bar">
              <div className="dl-mastery__bar-fill" style={{ width: pctXP + "%" }} />
            </div>
          </div>

          <div className="dl-stat-grid">
            <div className="dl-stat-cell">
              <div className="dl-stat-cell__lbl">SESSIONS</div>
              <div className="dl-stat-cell__num">{stats.sessionsCompleted}</div>
              <div className="dl-stat-cell__sub">STREAK · <b>{stats.streak}</b> DAYS</div>
            </div>
            <div className="dl-stat-cell">
              <div className="dl-stat-cell__lbl">CAREER REPS</div>
              <div className="dl-stat-cell__num">{stats.allTimeAttempts.toLocaleString()}</div>
              <div className="dl-stat-cell__sub"><b>{stats.allTimeMakes.toLocaleString()}</b> MADE</div>
            </div>
            <div className="dl-stat-cell" style={{ gridColumn: "1 / -1" }}>
              <div className="dl-stat-cell__lbl">PERSONAL BEST · FG%</div>
              <div className="dl-stat-cell__pp">
                <span className="dl-stat-cell__num">{stats.p90Fg}<span className="dl-stat-cell__num-unit">%</span></span>
                <div style={{ flex: 1, marginLeft: 12 }}>
                  <div className="dl-stat-cell__pp-bar">
                    <div className="dl-stat-cell__pp-fill" style={{ width: stats.p90Fg + "%" }} />
                    <div className="dl-stat-cell__pp-mark" style={{ left: stats.p50Fg + "%" }} title="Average" />
                  </div>
                  <div className="dl-stat-cell__pp-row" style={{ marginTop: 6 }}>
                    <span style={{ color: "var(--c-amber)" }}>● AVG {stats.p50Fg}%</span>
                    <span>● BEST {stats.p90Fg}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LEADERBOARD */}
        <div className="dl-lb">
          <div className="dl-cp__head">FRIENDS · LEADERBOARD · 7D</div>
          <div className="dl-lb__list">
            {lb.map((row, i) => (
              <div key={i} className={"dl-lb__row" + (row.isMe ? " is-me" : "")}>
                <span className={"dl-lb__rank" + (i === 0 ? " is-top" : "")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="dl-lb__handle">
                  {row.isMe ? "YOU" : "@" + row.handle}
                  {row.badge && <span className="dl-lb__handle-badge">{row.badge}</span>}
                </span>
                <span className="dl-lb__att">{row.made}/{row.att}</span>
                <span className="dl-lb__fg">{row.fg}<span className="dl-lb__fg-unit">%</span></span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* STICKY START */}
      <div className="dl-detail-sticky">
        <button className="dl-detail-sticky__primary" onClick={onStart}>
          ▶ START DRILL · {drill.duration}MIN
        </button>
        <button className="dl-detail-sticky__icon-btn" aria-label="More">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="8" r="1.4" fill="currentColor" />
            <circle cx="8" cy="8" r="1.4" fill="currentColor" />
            <circle cx="12" cy="8" r="1.4" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
};

window.DLDetail = DLDetail;
