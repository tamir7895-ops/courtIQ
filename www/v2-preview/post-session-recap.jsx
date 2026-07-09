// post-session-recap.jsx
// The recap surface — a single scrollable hero page on the iPhone.
// Sections, top to bottom:
//   1. STAMP HEADER         — date + duration + share/close icons
//   2. HERO FG%             — 96px display number, delta vs last
//   3. VERDICT              — italic 1-line coach-style call
//   4. SHOT CHART           — half-court canvas, full-width, with legend
//   5. ZONE BREAKDOWN       — 7-zone strip, tap to highlight on chart
//   6. SCOREBOARD STRIP     — MADE/ATT, PPS, BEST STREAK
//   7. DRILLS LIST          — flat rows, hot drills get an amber dot
//   8. COMPARE STRIP        — vs last session sparkline + 3 stats
//   9. ACTION ROW           — SHARE primary + DONE secondary

const { useState } = React;

const StampHeader = ({ date, duration, onClose }) => (
  <div className="ps-stamp">
    <div className="ps-stamp__l">
      <button className="ps-stamp__close" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M11 6l-5 6 5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
      <div>
        <div className="ps-stamp__eyebrow">SESSION RECAP</div>
        <div className="ps-stamp__meta">{date} · {duration}</div>
      </div>
    </div>
    <div className="ps-stamp__pill">FINAL</div>
  </div>
);

const HeroFG = ({ fg, fgDelta }) => {
  const positive = fgDelta >= 0;
  return (
    <div className="ps-hero">
      <div className="ps-hero__lbl">FIELD&nbsp;GOAL</div>
      <div className="ps-hero__num">
        <span className="ps-hero__int">{fg}</span>
        <span className="ps-hero__pct">%</span>
      </div>
      <div className={"ps-hero__delta " + (positive ? "is-up" : "is-down")}>
        <span className="ps-hero__arrow">{positive ? "▲" : "▼"}</span>
        {positive ? "+" : ""}{fgDelta} pts vs last session
      </div>
    </div>
  );
};

const Verdict = ({ text, tone }) => (
  <div className={"ps-verdict ps-verdict--" + tone}>
    <span className="ps-verdict__quote">“</span>
    <em>{text}</em>
  </div>
);

const ShotChartCard = ({ shots, zones, highlight, onZoneTap }) => {
  const made = shots.filter(s => s.made).length;
  const att = shots.length;
  return (
    <div className="ps-chart">
      <div className="ps-chart__head">
        <div className="ps-chart__lbl">SHOT MAP</div>
        <div className="ps-chart__legend">
          <span className="ps-chart__lk">
            <span className="ps-chart__dot ps-chart__dot--make" />
            <span>MAKE · {made}</span>
          </span>
          <span className="ps-chart__lk">
            <span className="ps-chart__dot ps-chart__dot--miss" />
            <span>MISS · {att - made}</span>
          </span>
        </div>
      </div>
      <window.ShotChart
        shots={shots}
        zones={zones}
        highlight={highlight}
        onZoneTap={onZoneTap}
      />
    </div>
  );
};

const ZoneStrip = ({ zones, highlight, onTap }) => {
  return (
    <div className="ps-zones">
      <div className="ps-zones__lbl">BY ZONE</div>
      <div className="ps-zones__row">
        {zones.map(z => {
          const fg = z.att === 0 ? 0 : Math.round((z.made / z.att) * 100);
          const dimmed = highlight && highlight !== z.id;
          const positive = z.delta >= 0;
          return (
            <button
              key={z.id}
              type="button"
              className={
                "ps-zone " +
                (highlight === z.id ? "is-active " : "") +
                (dimmed ? "is-dim " : "")
              }
              onClick={() => onTap(highlight === z.id ? null : z.id)}
            >
              <div className="ps-zone__name">{z.name}</div>
              <div className="ps-zone__fg">{fg}<span>%</span></div>
              <div className="ps-zone__att">{z.made}/{z.att}</div>
              <div className={"ps-zone__delta " + (positive ? "is-up" : "is-down")}>
                {positive ? "▲" : "▼"} {Math.abs(z.delta)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ScoreboardStrip = ({ made, att, pps, ppsDelta, streakBest }) => (
  <div className="ps-board">
    <div className="ps-board__cell">
      <div className="ps-board__lbl">MADE</div>
      <div className="ps-board__val">
        <span className="ps-board__big">{String(made).padStart(2, "0")}</span>
        <span className="ps-board__sep">/</span>
        <span className="ps-board__sm">{att}</span>
      </div>
    </div>
    <div className="ps-board__cell">
      <div className="ps-board__lbl">PTS / SHOT</div>
      <div className="ps-board__val">
        <span className="ps-board__big">{pps.toFixed(2)}</span>
      </div>
      <div className={"ps-board__delta " + (ppsDelta >= 0 ? "is-up" : "is-down")}>
        {ppsDelta >= 0 ? "▲" : "▼"} {Math.abs(ppsDelta).toFixed(2)}
      </div>
    </div>
    <div className="ps-board__cell">
      <div className="ps-board__lbl">BEST RUN</div>
      <div className="ps-board__val">
        <span className="ps-board__big">{streakBest}</span>
        <span className="ps-board__sm">in&nbsp;a&nbsp;row</span>
      </div>
    </div>
  </div>
);

const DrillsList = ({ drills }) => (
  <div className="ps-drills">
    <div className="ps-drills__lbl">DRILLS</div>
    <ul className="ps-drills__list">
      {drills.map((d, i) => {
        const made = d.made;
        const reps = d.reps;
        const pct = d.fg;
        return (
          <li className={"ps-drill " + (d.hot ? "is-hot " : "")} key={d.id}>
            <div className="ps-drill__idx">{String(i + 1).padStart(2, "0")}</div>
            <div className="ps-drill__name">
              {d.name}
              {d.hot && <span className="ps-drill__badge">HOT</span>}
            </div>
            <div className="ps-drill__bar">
              <div
                className="ps-drill__fill"
                style={{
                  width: pct + "%",
                  background: pct >= 50 ? "#56d364" : "#e84040",
                }}
              />
            </div>
            <div className="ps-drill__pct">{pct}<span>%</span></div>
            <div className="ps-drill__att">{made}/{reps}</div>
          </li>
        );
      })}
    </ul>
  </div>
);

const CompareStrip = ({ fg, fgDelta }) => {
  const last = fg - fgDelta;
  // little 5-dot trend (oldest → newest)
  const trend = [Math.max(0, last - 4), last, Math.max(0, last - 2), last + 2, fg];
  const max = Math.max(...trend);
  return (
    <div className="ps-compare">
      <div className="ps-compare__head">
        <div className="ps-compare__lbl">LAST 5 SESSIONS</div>
        <div className="ps-compare__cur">
          <span className="ps-compare__big">{fg}</span>
          <span>%</span>
        </div>
      </div>
      <svg viewBox="0 0 170 40" className="ps-compare__spark" preserveAspectRatio="none">
        {/* line */}
        <polyline
          points={trend.map((v, i) => `${10 + i * 38},${36 - (v / 100) * 32}`).join(" ")}
          stroke="rgba(240,236,228,0.45)"
          strokeWidth="1.2"
          fill="none"
        />
        {/* dots */}
        {trend.map((v, i) => {
          const cx = 10 + i * 38;
          const cy = 36 - (v / 100) * 32;
          const isLast = i === trend.length - 1;
          return (
            <g key={i}>
              {isLast && (
                <circle cx={cx} cy={cy} r="6" fill="rgba(255,90,60,0.18)" />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={isLast ? 3.2 : 2.2}
                fill={isLast ? "#ff5a3c" : "rgba(240,236,228,0.7)"}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const ActionRow = ({ onShare, onDone, onNewSession, made, att, streakBest }) => {
  const xpMakes = made * 10;
  const xpAtt   = att  * 2;
  const xpStreak = streakBest >= 5 ? 60 : streakBest >= 3 ? 30 : 0;
  const xpTotal = xpMakes + xpAtt + xpStreak;

  // level progress — Lv 14 → 15, baseline 11,200 / 15,000
  const xpBaseline = 11200;
  const xpCurrent  = xpBaseline + xpTotal;
  const xpNext     = 15000;
  const pct = Math.min(100, Math.round((xpCurrent / xpNext) * 100));

  return (
    <div className="ps-finish">
      {/* XP EARNED CARD */}
      <div className="ps-xp">
        <div className="ps-xp__head">
          <div className="ps-xp__lbl">XP EARNED</div>
          <div className="ps-xp__sub">+346 target · L14</div>
        </div>

        <div className="ps-xp__rows">
          <div className="ps-xp__row">
            <span className="ps-xp__row-lbl">Made shots</span>
            <span className="ps-xp__row-meta">{made} × 10 XP</span>
            <span className="ps-xp__row-val">+{xpMakes}</span>
          </div>
          <div className="ps-xp__row">
            <span className="ps-xp__row-lbl">Attempts</span>
            <span className="ps-xp__row-meta">{att} × 2 XP</span>
            <span className="ps-xp__row-val">+{xpAtt}</span>
          </div>
          <div className="ps-xp__row">
            <span className="ps-xp__row-lbl">Streak bonus</span>
            <span className="ps-xp__row-meta">{streakBest} in a row</span>
            <span className="ps-xp__row-val">+{xpStreak}</span>
          </div>
        </div>

        <div className="ps-xp__total">
          <span className="ps-xp__total-lbl">Total</span>
          <span className="ps-xp__total-val">+{xpTotal} <em>XP</em></span>
        </div>

        <div className="ps-xp__progress">
          <div className="ps-xp__progress-lbl">
            <span>Level 14</span>
            <span><b>{xpCurrent.toLocaleString()}</b> / {xpNext.toLocaleString()} XP</span>
            <span>Level 15</span>
          </div>
          <div className="ps-xp__bar">
            <div className="ps-xp__bar-fill" style={{ width: pct + "%" }} />
            <span className="ps-xp__bar-marker" style={{ left: pct + "%" }} />
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS CARD */}
      <div className="ps-actions">
        <button className="ps-act-primary" onClick={onDone}>
          <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3.5 3.5h9.5l2 2v9a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
            <path d="M5 3.5v3.5h6V3.5" stroke="currentColor" strokeWidth="1.7"/>
            <circle cx="9" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.7"/>
          </svg>
          Save Session
        </button>
        <button className="ps-act-ghost" onClick={onShare}>
          <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="13.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.6"/>
            <circle cx="4.5"  cy="9"   r="2" stroke="currentColor" strokeWidth="1.6"/>
            <circle cx="13.5" cy="14.5" r="2" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M6.4 8L11.6 4.5M6.4 10L11.6 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Share Shot Chart
        </button>
        <div className="ps-act-row">
          <button className="ps-act-text" onClick={onNewSession}>
            <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M7 4.5v5M4.5 7h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            New Session
          </button>
          <button className="ps-act-text" onClick={onDone}>
            <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 2.5L4 7l5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Track
          </button>
        </div>
      </div>
    </div>
  );
};

const PostSessionRecap = ({ session, date, onClose, onShare, onNewSession }) => {
  const [highlight, setHighlight] = useState(null);
  const dur = `${session.durationMin}:${String(session.durationSec).padStart(2, "0")}`;

  return (
    <div className="ps">
      {/* sticky stamp at top */}
      <StampHeader date={date} duration={dur + " min"} onClose={onClose} />

      <div className="ps-scroll">
        {/* HERO */}
        <section className="ps-sec ps-sec--hero">
          <HeroFG fg={session.fg} fgDelta={session.fgDelta} />
          <Verdict text={session.verdict} tone={session.verdictTone} />
        </section>

        {/* SHOT CHART */}
        <section className="ps-sec">
          <ShotChartCard
            shots={session.shots}
            zones={session.zoneBreakdown}
            highlight={highlight}
            onZoneTap={(id) => setHighlight(highlight === id ? null : id)}
          />
        </section>

        {/* SCOREBOARD STRIP */}
        <section className="ps-sec">
          <ScoreboardStrip
            made={session.made}
            att={session.att}
            pps={session.pps}
            ppsDelta={session.ppsDelta}
            streakBest={session.streakBest}
          />
        </section>

        {/* ZONES */}
        <section className="ps-sec">
          <ZoneStrip
            zones={session.zoneBreakdown}
            highlight={highlight}
            onTap={setHighlight}
          />
        </section>

        {/* DRILLS */}
        <section className="ps-sec">
          <DrillsList drills={session.drills} />
        </section>

        {/* COMPARE */}
        <section className="ps-sec">
          <CompareStrip fg={session.fg} fgDelta={session.fgDelta} />
        </section>

        {/* ACTIONS */}
        <section className="ps-sec ps-sec--action">
          <ActionRow
            onShare={onShare}
            onDone={onClose}
            onNewSession={onNewSession}
            made={session.made}
            att={session.att}
            streakBest={session.streakBest}
          />
        </section>

        <div className="ps-foot">
          AI TRACKING · CourtIQ · {date}
        </div>
      </div>
    </div>
  );
};

window.PostSessionRecap = PostSessionRecap;
