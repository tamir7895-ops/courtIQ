// coach-screen.jsx — Coach tab (3 sub-pages)

const CoachSettingsIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─────────────────────────────────────────────────────────
// 1 · COACH PAGE
// ─────────────────────────────────────────────────────────
const CoachPageMain = ({ onOpenBriefing, onStartChat }) => {
  const data = window.COACH_INSIGHT;
  const I = window.CoachIcon;

  // sparkline geometry
  const trendW = 130, trendH = 60, pad = 6;
  const max = Math.max(...data.trend.weeks.map(w => w.val));
  const min = 50;
  const barW = (trendW - pad * 2) / data.trend.weeks.length - 4;

  const dirArrow = data.trend.dir === "up" ? <I.Up/> : data.trend.dir === "down" ? <I.Down/> : <I.Flat/>;

  return (
    <>
      {/* 1 · HERO VERDICT (now in a glass card) */}
      <section className="co-sec co-sec--first">
        <div className="co-hero co-glass">
          <div className="co-hero__bug">
            <span className="co-hero__bug-dot" />
            COACH BRIEFING
            <span className="co-hero__bug-line" />
          </div>
          <h1
            className="co-hero__verdict"
            dangerouslySetInnerHTML={{ __html: data.verdict }}
          />
          <div className="co-hero__meta">
            <span>{data.date}</span>
            <span className="co-hero__meta-sep" />
            <span>{data.meta}</span>
          </div>
          <button className="co-hero__view" onClick={onOpenBriefing}>
            <span>View Full Briefing</span>
            <I.Arrow/>
          </button>
        </div>
      </section>

      {/* 2 · NUMBERS */}
      <section className="co-sec">
        <div className="co-sec__head">
          <div className="co-sec__title">This Week's Numbers</div>
          <div className="co-sec__more">7D</div>
        </div>
        <div className="co-stats">
          {data.numbers.map(n => (
            <div key={n.id} className="co-stat co-glass">
              <div className="co-stat__lbl">{n.lbl}</div>
              <div className="co-stat__num">
                {n.num}{n.suf && <span>{n.suf}</span>}
              </div>
              <div className={"co-stat__delta co-stat__delta--" + n.dir}>
                {n.dir === "up" ? <I.Up/> : n.dir === "down" ? <I.Down/> : <I.Flat/>}
                {n.delta}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 · CHAT WITH COACH — hero CTA */}
      <section className="co-sec">
        <div className="co-chat co-glass">
          <div className="co-chat__avatar">
            <span className="co-chat__avatar-mark">C</span>
            <span className="co-chat__avatar-pulse" />
          </div>
          <div className="co-chat__head">
            <span className="co-chat__name">Coach Whitfield</span>
            <span className="co-chat__status">Online</span>
          </div>
          <p className="co-chat__msg">
            <em>"Ready to talk about your week?"</em> Ask me anything — shot selection, footwork, that 4th-quarter dip.
          </p>
          <button className="co-chat__cta" onClick={onStartChat}>
            Start Chat
            <I.Arrow/>
          </button>
        </div>
      </section>

      {/* 4 · DRILLS */}
      <section className="co-sec">
        <div className="co-sec__head">
          <div className="co-sec__title">Recommended Drills</div>
          <div className="co-sec__more">→ TRAIN</div>
        </div>
        <div className="co-drills">
          {data.drills.map(d => (
            <div key={d.id} className="co-drill co-glass">
              <div className="co-drill__head">
                <div className="co-drill__name">{d.name}</div>
              </div>
              <div className="co-drill__meta">
                <span className="co-drill__pill">
                  <I.Clock/> {d.duration}
                </span>
                <span className={"co-drill__pill co-drill__pill--diff-" + d.diff}>
                  {d.diffLbl.toUpperCase()}
                </span>
              </div>
              <div className="co-drill__why">
                <span className="co-drill__why-tag">Why:</span>
                <span className="co-drill__why-text">{d.why}</span>
              </div>
              <button className="co-drill__cta" aria-label="Open in Train">
                <I.Arrow/>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 5 · TREND */}
      <section className="co-sec">
        <div className="co-sec__head">
          <div className="co-sec__title">Weekly Trend</div>
          <div className="co-sec__more">4 WK</div>
        </div>
        <div className="co-trend co-glass">
          <div className="co-trend__l">
            <div className="co-trend__lbl">Overall Score</div>
            <div className="co-trend__num">
              {data.trend.score}
              <span className="co-trend__num-suf">/ 100</span>
            </div>
            <span className={"co-trend__pill co-trend__pill--" + (data.trend.dir === "up" ? "up" : "down")}>
              {dirArrow}
              {data.trend.label} {data.trend.delta}
            </span>
          </div>
          <svg className="co-spark" viewBox={`0 0 ${trendW} ${trendH}`}>
            {data.trend.weeks.map((w, i) => {
              const h = ((w.val - min) / (100 - min)) * (trendH - 18);
              const x = pad + i * ((trendW - pad * 2) / data.trend.weeks.length) + 2;
              const y = trendH - 12 - h;
              const isLast = i === data.trend.weeks.length - 1;
              return (
                <g key={w.lbl}>
                  <rect
                    x={x} y={y} width={barW} height={h}
                    rx={2}
                    className={"co-spark__bar" + (isLast ? " co-spark__bar--last" : "")}
                    opacity={isLast ? 1 : 0.5 + i * 0.12}
                  />
                  <text
                    x={x + barW / 2}
                    y={trendH - 2}
                    className={"co-spark__lbl" + (isLast ? " co-spark__lbl--last" : "")}
                  >{w.lbl}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      <div className="co-foot">CourtIQ · Coach · §6.14</div>
    </>
  );
};

// ─────────────────────────────────────────────────────────
// BRIEFING SHEET BODY — for the BottomSheet
// ─────────────────────────────────────────────────────────
const CoachBriefingSheetBody = () => {
  const data = window.COACH_INSIGHT;
  return (
    <div className="co-brief-body">
      <h2
        className="co-brief-body__quote"
        dangerouslySetInnerHTML={{ __html: data.verdict }}
      />
      <div className="co-brief-body__sig">
        <span className="co-brief-body__sig-mark">C</span>
        <span>{data.signature}</span>
        <span style={{ marginLeft: "auto", color: "rgba(240,236,228,0.45)" }}>{data.date}</span>
      </div>

      <div className="co-brief-body__section-lbl">The Breakdown · 3 Notes</div>
      <div className="co-break">
        {data.paragraphs.map((p, i) => (
          <div key={i} className={"co-break__p co-break__p--" + p.kind}>
            <span className="co-break__indicator" />
            <p
              className="co-break__text"
              dangerouslySetInnerHTML={{ __html: p.html }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

window.CoachBriefingSheetBody = CoachBriefingSheetBody;

// ─────────────────────────────────────────────────────────
// 2 · UPDATE PAGE — sliders
// ─────────────────────────────────────────────────────────
const CoachSlider = ({ skill, value, onChange }) => {
  const I = window.CoachIcon;
  const Icon = I[skill.icon] || I.Bolt;
  const trackRef = React.useRef(null);
  const pct = ((value - 1) / 9) * 100;

  // tier hint
  const hint =
    value >= 8 ? skill.hintAt[8] :
    value >= 5 ? skill.hintAt[5] :
                 skill.hintAt[1];

  const handle = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const v = Math.round(1 + p * 9);
    onChange(v);
  };

  const onPointer = (e) => {
    e.preventDefault();
    handle(e.clientX);
    const move = (ev) => handle(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="co-slider">
      <div className="co-slider__top">
        <div className="co-slider__lbl">
          <span className="co-slider__icon"><Icon/></span>
          {skill.lbl}
        </div>
        <div className="co-slider__val">{value}<span>/10</span></div>
      </div>
      <div
        ref={trackRef}
        className="co-slider__track"
        onPointerDown={onPointer}
      >
        <div className="co-slider__rail">
          <div className="co-slider__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="co-slider__thumb" style={{ left: `${pct}%` }} />
      </div>
      <div className="co-slider__ticks">
        <span>1</span><span>3</span><span>5</span><span>7</span><span>10</span>
      </div>
      <div className="co-slider__hint">{hint}</div>
    </div>
  );
};

const CoachPageUpdate = ({ values, setValues, onSubmit }) => {
  const I = window.CoachIcon;
  return (
    <section className="co-sec co-sec--first">
      <div className="co-update co-glass">
        <div className="co-update__head">
          <h2 className="co-update__title">How are you playing?</h2>
          <p className="co-update__sub">
            Rate yourself across four areas. Your honest read drives next week's coaching plan.
          </p>
        </div>

        {window.COACH_SKILLS.map(skill => (
          <CoachSlider
            key={skill.id}
            skill={skill}
            value={values[skill.id]}
            onChange={(v) => setValues({ ...values, [skill.id]: v })}
          />
        ))}

        <div>
          <button className="co-update__cta" onClick={onSubmit}>
            <I.Spark/> Get Coach Feedback
          </button>
          <div className="co-update__last">Last updated: 3 days ago</div>
        </div>
      </div>
      <div className="co-foot">CourtIQ · Coach · Update · §6.14</div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────
// 3 · HISTORY PAGE
// ─────────────────────────────────────────────────────────
const CoachPageHistory = ({ openId, setOpenId }) => {
  const I = window.CoachIcon;
  const items = window.COACH_HISTORY;

  if (!items || items.length === 0) {
    return (
      <section className="co-sec co-sec--first">
        <div className="co-empty co-glass">
          <div className="co-empty__icon"><I.Whistle/></div>
          <div className="co-empty__title"><em>Complete your first update to get coached.</em></div>
          <p className="co-empty__body">Rate yourself in the Update tab and the coach will write your first briefing.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="co-sec co-sec--first">
        <div className="co-sec__head">
          <div className="co-sec__title">Past Insights · {items.length}</div>
          <div className="co-sec__more">RECENT</div>
        </div>
        <div className="co-hist">
          {items.map(it => {
            const open = openId === it.id;
            return (
              <div
                key={it.id}
                className={"co-hist__row co-glass" + (open ? " is-open" : "")}
                onClick={() => setOpenId(open ? null : it.id)}
              >
                <div className="co-hist__top">
                  <div>
                    <div className="co-hist__date">{it.date}</div>
                    <div className="co-hist__verdict">{it.verdict}</div>
                  </div>
                  <div className="co-hist__score">
                    {it.score}<span className="co-hist__score-suf">/100</span>
                  </div>
                </div>
                {open && (
                  <div className="co-hist__body">
                    {it.body.map((html, i) => (
                      <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
                    ))}
                  </div>
                )}
                <div className="co-hist__chev">
                  {open ? "COLLAPSE" : "EXPAND"}
                  <I.Arrow/>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="co-foot">CourtIQ · Coach · History · §6.14</div>
    </>
  );
};

// ─────────────────────────────────────────────────────────
// SCREEN ROOT
// ─────────────────────────────────────────────────────────
const CoachScreen = ({ tab, setTab, sliders, setSliders, openHistId, setOpenHistId, onOpenSettings, onSubmitUpdate, onOpenBriefing, onStartChat }) => {
  return (
    <div className="co">
      {/* STAMP */}
      <div className="co-stamp">
        <div className="co-stamp__l">
          <button className="co-stamp__icon-btn" aria-label="Back">
            <window.CoachIcon.Back width="14" height="14" />
          </button>
          <div>
            <div className="co-stamp__eyebrow">COACH · BRIEFING</div>
            <div className="co-stamp__meta">WEEK 18 · MAY 4</div>
          </div>
        </div>
        <button className="co-stamp__icon-btn" onClick={onOpenSettings} aria-label="Settings">
          <CoachSettingsIcon width="18" height="18" />
        </button>
      </div>

      {/* SUB-NAV */}
      <div className="co-subnav">
        {[
          { id: "coach",   label: "Coach"   },
          { id: "update",  label: "Update"  },
          { id: "history", label: "History" },
        ].map(c => (
          <button
            key={c.id}
            className={"co-chip" + (tab === c.id ? " is-active" : "")}
            onClick={() => setTab(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* SCROLL */}
      <div className="co-scroll">
        {tab === "coach"   && <CoachPageMain onOpenBriefing={onOpenBriefing} onStartChat={onStartChat}/>}
        {tab === "update"  && <CoachPageUpdate values={sliders} setValues={setSliders} onSubmit={onSubmitUpdate}/>}
        {tab === "history" && <CoachPageHistory openId={openHistId} setOpenId={setOpenHistId}/>}
      </div>
    </div>
  );
};

window.CoachScreen = CoachScreen;
