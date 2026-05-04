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

const ActionRow = ({ onShare, onDone }) => (
  <div className="ps-action">
    <button className="ps-btn ps-btn--primary" onClick={onShare}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      <span>SHARE</span>
    </button>
    <button className="ps-btn ps-btn--ghost" onClick={onDone}>
      DONE
    </button>
  </div>
);

const PostSessionRecap = ({ session, date, onClose, onShare }) => {
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
          <ActionRow onShare={onShare} onDone={onClose} />
        </section>

        <div className="ps-foot">
          AI TRACKING · CourtIQ · {date}
        </div>
      </div>
    </div>
  );
};

window.PostSessionRecap = PostSessionRecap;
