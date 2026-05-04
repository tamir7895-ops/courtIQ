// drill-library-detail-v2.jsx — card-based drill detail screen
// Five distinct cards: HERO, INSTRUCTIONS, TIPS, STATS, RELATED.

const fmtMin = (sec) => {
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m === 0) return s + "s";
  if (s === 0) return m + "m";
  return m + ":" + String(s).padStart(2, "0");
};
const focusLabel = {
  shooting: "SHOOTING", ballhandling: "BALL-HANDLING",
  defense: "DEFENSE", athleticism: "ATHLETICISM",
};

const TIER_OF = (lvl, sessions) => {
  if (sessions === 0) return "bronze";
  if (lvl >= 4) return "diamond";
  if (lvl === 3) return "gold";
  if (lvl === 2) return "silver";
  return "bronze";
};
const TIER_LABEL = { bronze: "BRONZE", silver: "SILVER", gold: "GOLD", diamond: "DIAMOND" };

const DLDetail = ({ drill, onBack, onStart, onOpenDrill, saved, onToggleSave }) => {
  const phases = drill.phases || [];
  const totalSec = phases.reduce((a, p) => a + p.sec, 0);
  const stats = drill.stats;
  const tier = TIER_OF(stats.mastery.level, stats.sessionsCompleted);
  const pctXP = Math.min(100, (stats.mastery.xp / stats.mastery.nextXp) * 100);

  const meAtt = Math.floor(stats.allTimeAttempts * 0.18);
  const meMade = Math.round(meAtt * stats.p50Fg / 100);
  const myRow = { handle: "you", fg: stats.p50Fg, made: meMade, att: meAtt, isMe: true };
  const lb = [...drill.leaderboard, myRow].sort((a, b) => b.fg - a.fg).slice(0, 6);

  // Related drills: same focus, exclude self, prefer overlapping subTags
  const { DRILLS } = window.DrillEngine;
  const related = React.useMemo(() => {
    const sameFocus = DRILLS.filter(d =>
      d.id !== drill.id && d.focus === drill.focus
    );
    const score = (d) => d.subTags.filter(t => drill.subTags.includes(t)).length;
    return [...sameFocus].sort((a, b) => score(b) - score(a)).slice(0, 6);
  }, [drill.id]);

  return (
    <div className="dl-detail dl">
      <div className="dl-stamp">
        <div className="dl-stamp__l">
          <button className="dl-stamp__back" onClick={onBack} aria-label="Back">
            <window.DLIcon.Back width="14" height="14" />
          </button>
          <div>
            <div className="dl-stamp__eyebrow">DRILL · DETAIL</div>
            <div className="dl-stamp__meta">{focusLabel[drill.focus]}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={"dl-stamp__icon-btn" + (saved ? " is-saved" : "")} onClick={onToggleSave} aria-label="Save">
            {saved ? <window.DLIcon.SaveFilled width="16" height="16" /> : <window.DLIcon.Save width="16" height="16" />}
          </button>
          <button className="dl-stamp__icon-btn" aria-label="Share">
            <window.DLIcon.Share width="16" height="16" />
          </button>
        </div>
      </div>

      <div className="dl-detail__scroll">

        {/* CARD 1 — HERO */}
        <div className="dl-glass dl-card-hero">
          <div className="dl-card-hero__court">
            <window.DLHeroAnim drill={drill} />
          </div>
          <div className="dl-card-hero__bar">
            <span>PATTERN · <b>{(drill.pattern && drill.pattern.kind || "").toUpperCase()}</b></span>
            <span className="dl-card-hero__loop">
              <span className="dl-card-hero__pulse" />
              LOOPING
            </span>
          </div>
          <div className="dl-card-hero__title-row">
            <span className="dl-card-hero__focus">
              <span className="dl-card-hero__focus-dot" />
              {focusLabel[drill.focus]} · {drill.difficulty.toUpperCase()}
            </span>
          </div>
          <div className="dl-card-hero__name">{drill.name}</div>
          <div className="dl-card-hero__benefit">{drill.benefit}</div>
          <div className="dl-card-hero__facts">
            <div className="dl-card-hero__fact">
              <span className="dl-card-hero__fact-lbl">DURATION</span>
              <span className="dl-card-hero__fact-val">{drill.duration}<span>MIN</span></span>
            </div>
            <div className="dl-card-hero__fact">
              <span className="dl-card-hero__fact-lbl">SETS×REPS</span>
              <span className="dl-card-hero__fact-val">{drill.sets}<span>×{drill.reps}</span></span>
            </div>
            <div className="dl-card-hero__fact">
              <span className="dl-card-hero__fact-lbl">REST</span>
              <span className="dl-card-hero__fact-val">{drill.restSec || 0}<span>S</span></span>
            </div>
            <div className="dl-card-hero__fact">
              <span className="dl-card-hero__fact-lbl">SPACE</span>
              <span className="dl-card-hero__fact-val" style={{ fontSize: 13 }}>{(drill.space || "").toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* CARD 2 — INSTRUCTIONS / RUN ORDER */}
        <div className="dl-glass dl-card-section">
          <div className="dl-card-head">
            <span>INSTRUCTIONS · RUN ORDER</span>
            <span className="dl-card-head__sub">TOTAL {fmtMin(totalSec)}</span>
          </div>
          <div className="dl-phase-list">
            {phases.map((p, i) => {
              const isRest = p.id.startsWith("rest");
              return (
                <div key={i} className={"dl-phase-row" + (isRest ? " dl-phase-row--rest" : "")}>
                  <span className="dl-phase-idx">{String(i + 1).padStart(2, "0")}</span>
                  <span className="dl-phase-lbl">{p.label}</span>
                  <span className="dl-phase-time">{p.sec}<span>S</span></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD 3 — TIPS */}
        <div className="dl-glass dl-card-section">
          <div className="dl-card-head">
            <span>COACH · KEY POINTS</span>
            <span className="dl-card-head__sub">{drill.coachPoints.length} CUES</span>
          </div>
          <ul className="dl-cp-list">
            {drill.coachPoints.map((cp, i) => (
              <li className="dl-cp-row" key={i}>
                <span className="dl-cp-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="dl-cp-txt">{cp}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CARD 4 — STATS */}
        <div className="dl-glass dl-card-section">
          <div className="dl-card-head">
            <span>YOUR HISTORY</span>
            <span className="dl-card-head__sub">LAST · {stats.lastDone}</span>
          </div>

          <div className="dl-mastery-block">
            <div className="dl-mastery-row">
              <div className="dl-mastery-name">
                <span className={"dl-mastery-badge dl-mastery-badge--" + tier}>
                  <window.DLTierCrest tier={tier} />
                  {TIER_LABEL[tier]}
                </span>
                <span className="dl-mastery-lvl">LVL {stats.mastery.level}</span>
              </div>
              <div className="dl-mastery-xp">
                <b>{stats.mastery.xp}</b> / {stats.mastery.nextXp} XP
              </div>
            </div>
            <div className="dl-mastery-bar">
              <div className="dl-mastery-bar__fill" style={{ width: pctXP + "%" }} />
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
            <div className="dl-stat-cell dl-stat-cell--wide">
              <div className="dl-stat-cell__lbl">PERSONAL BEST · FG%</div>
              <div className="dl-stat-cell__pp">
                <span className="dl-stat-cell__num">{stats.p90Fg}<span>%</span></span>
                <div style={{ flex: 1, marginLeft: 12 }}>
                  <div className="dl-stat-cell__pp-bar">
                    <div className="dl-stat-cell__pp-fill" style={{ width: stats.p90Fg + "%" }} />
                    <div className="dl-stat-cell__pp-mark" style={{ left: stats.p50Fg + "%" }} />
                  </div>
                  <div className="dl-stat-cell__pp-row">
                    <span style={{ color: "var(--tier-gold)" }}>● AVG {stats.p50Fg}%</span>
                    <span>● BEST {stats.p90Fg}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Friends leaderboard */}
          <div style={{ marginTop: 14 }}>
            <div className="dl-card-head" style={{ marginBottom: 8 }}>
              <span>FRIENDS · LEADERBOARD · 7D</span>
            </div>
            <div className="dl-lb-list">
              {lb.map((row, i) => (
                <div key={i} className={"dl-lb-row" + (row.isMe ? " is-me" : "")}>
                  <span className={"dl-lb-rank" + (i === 0 ? " is-top" : "")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={"dl-lb-handle" + (row.isMe ? " dl-lb-handle--me" : "")}>
                    {row.isMe ? "YOU" : "@" + row.handle}
                    {row.badge && <span className="dl-lb-handle__badge">{row.badge}</span>}
                  </span>
                  <span className="dl-lb-att">{row.made}/{row.att}</span>
                  <span className="dl-lb-fg">{row.fg}<span>%</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 5 — RELATED */}
        <div className="dl-glass dl-card-section">
          <div className="dl-card-head">
            <span>SIMILAR · IN THIS PATH</span>
            <span className="dl-card-head__sub">{related.length} DRILLS</span>
          </div>
          <div className="dl-related-rail">
            {related.map(d => {
              const t = TIER_OF(d.stats.mastery.level, d.stats.sessionsCompleted);
              return (
                <div key={d.id} className="dl-related-tile">
                  <window.DLSkillTile drill={d} tier={t} onOpen={(id) => onOpenDrill && onOpenDrill(id)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
