// home-screen.jsx — Home tab · 3 sub-pages

const HomeScreen = ({
  tab, setTab,
  hour, weeklyGoal, hasSessions,
  logState, setLogState,
  calSelected, setCalSelected,
  onOpenSettings, onOpenChallenge, onOpenCoach, onOpenAction, onOpenSession, onLogSession,
}) => {
  const D = window.HOME_DATA;
  const I = window.HomeIcon;
  const greet = window.homeGreeting(hour);
  const xpPct = Math.min(100, (D.player.level.current / D.player.level.next) * 100);
  const goalCount = weeklyGoal !== undefined ? weeklyGoal : D.player.sessionsThisWeek;
  const goalPct = Math.min(100, (goalCount / D.player.weeklyGoal) * 100);
  const goalDone = goalCount >= D.player.weeklyGoal;

  return (
    <div className="ho">
      {/* STAMP */}
      <div className="ho-stamp">
        <div className="ho-stamp__l">
          <window.CIQLogo accent="#f5a623" />
          <div>
            <div className="ho-stamp__eyebrow">HOME · TODAY</div>
            <div className="ho-stamp__meta">MON · MAY 4 · 2026</div>
          </div>
        </div>
        <button className="ho-stamp__icon-btn" onClick={onOpenSettings} aria-label="Settings">
          <I.Settings width="18" height="18"/>
        </button>
      </div>

      {/* SUB-NAV */}
      <div className="ho-subnav">
        {[
          { id: "today",    label: "Today"    },
          { id: "log",      label: "Log"      },
          { id: "calendar", label: "Calendar" },
        ].map(c => (
          <button
            key={c.id}
            className={"ho-chip" + (tab === c.id ? " is-active" : "")}
            onClick={() => setTab(c.id)}
          >{c.label}</button>
        ))}
      </div>

      <div className="ho-scroll">
        {tab === "today" && (
          <HomeToday
            D={D} I={I} greet={greet} xpPct={xpPct}
            hasSessions={hasSessions}
            goalCount={goalCount} goalPct={goalPct} goalDone={goalDone}
            onOpenChallenge={onOpenChallenge}
            onOpenCoach={onOpenCoach}
            onOpenAction={onOpenAction}
            onOpenSession={onOpenSession}
          />
        )}
        {tab === "log" && (
          <HomeLog I={I} state={logState} setState={setLogState} onLog={onLogSession}/>
        )}
        {tab === "calendar" && (
          <HomeCalendar D={D} I={I} selected={calSelected} setSelected={setCalSelected}/>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// TODAY
// ─────────────────────────────────────────────────────────
const HomeToday = ({ D, I, greet, xpPct, hasSessions, goalCount, goalPct, goalDone, onOpenChallenge, onOpenCoach, onOpenAction, onOpenSession }) => {
  const p = D.player;
  const dayLabels = ["W","T","F","S","S","M","T"]; // last 7 days, today = last

  return (
  <>
    {/* 1 · PLAYER CARD HERO */}
    <section className="ho-glass ho-hero ho-anim d-0" style={{ "--avatar-tint": p.avatarTint }}>
      <div className="ho-hero__bleed"/>
      <svg className="ho-hero__court-line" viewBox="0 0 358 210" preserveAspectRatio="none">
        <path d="M -10 210 Q 179 70 368 210" stroke="rgba(245,166,35,0.05)" strokeWidth="1" fill="none"/>
        <path d="M 0 210 L 358 210" stroke="rgba(245,166,35,0.04)" strokeWidth="1"/>
        <line x1="179" y1="130" x2="179" y2="210" stroke="rgba(245,166,35,0.03)" strokeWidth="1"/>
        <circle cx="179" cy="210" r="60" stroke="rgba(245,166,35,0.04)" strokeWidth="1" fill="none"/>
      </svg>
      <div className="ho-hero__noise"/>
      <div className="ho-hero__avatar-glow"/>
      <div className="ho-hero__avatar">
        <window.MeAvatar seed={p.avatarSeed} size={168}/>
      </div>

      <div className="ho-hero__l">
        <div className="ho-hero__bug">
          <span className="ho-hero__bug-dot"/>
          PLAYER · MAY 4
        </div>
        <h1 className="ho-hero__greet">
          {greet.word},
          <em>{p.name.toUpperCase()}.</em>
        </h1>
        <div className="ho-hero__pills">
          <span className="ho-hero__pill ho-hero__pill--pos">{p.position}</span>
          <span className="ho-hero__pill ho-hero__pill--lvl">LV {p.level.num} · {p.level.name}</span>
        </div>
        <p className="ho-hero__sub">{greet.tag}</p>
      </div>
    </section>

    {/* 2 · STREAK + LEVEL — 2 cards side by side */}
    <section className="ho-row2 ho-anim d-1">
      <div className={"ho-glass ho-streak" + (p.streak >= 7 ? " is-hot" : "")}>
        <div className="ho-streak__top">
          <span className="ho-streak__flame"><I.Flame/></span>
          <span className="ho-streak__num">{p.streak}</span>
        </div>
        <div className="ho-streak__lbl">Day Streak</div>
        <div className="ho-streak__dots">
          {p.streakDays.map((on, i) => (
            <span
              key={i}
              className={"ho-streak__dot" + (on ? " is-on" : "") + (i === p.streakDays.length - 1 ? " is-today" : "")}
            />
          ))}
        </div>
      </div>

      <div className="ho-glass ho-level ho-tap" onClick={() => onOpenAction("me")}>
        <div>
          <div className="ho-level__top">
            <div className="ho-level__name">{p.level.name}</div>
            <div className="ho-level__num">LV {p.level.num}</div>
          </div>
          <div className="ho-level__bar" style={{ marginTop: 8 }}>
            <div className="ho-level__bar-fill" style={{ "--fill": xpPct + "%" }}/>
          </div>
          <div className="ho-level__xp" style={{ marginTop: 6 }}>
            {p.level.current.toLocaleString()} / {p.level.next.toLocaleString()} XP
          </div>
        </div>
        <div className="ho-level__week">
          <span className="ho-level__week-num">{p.sessionsThisWeek}</span>
          sessions this week
        </div>
      </div>
    </section>

    {/* 3 · DAILY CHALLENGE — countdown + segmented progress */}
    <section className="ho-glass ho-chal ho-anim d-2 ho-tap" onClick={onOpenChallenge}>
      <div className="ho-chal__icon"><I.Bolt/></div>
      <div className="ho-chal__top">
        <div className="ho-chal__eyebrow">{D.challenge.eyebrow}</div>
        <div className="ho-chal__countdown">
          <I.Clock/>
          {window.homeFmtCountdown(D.challenge.secondsLeft)} REMAINING
        </div>
      </div>
      <div className="ho-chal__body">
        <div className="ho-chal__title">{D.challenge.title}</div>
        <div className="ho-chal__reward">{D.challenge.reward}</div>
      </div>
      <div className="ho-chal__bottom">
        <div className="ho-chal__progress">
          <div className="ho-chal__progress-lbl">
            <span>Progress</span>
            <span><em>{D.challenge.progress}</em> / {D.challenge.total} drills</span>
          </div>
          <div className="ho-chal__seg">
            {Array.from({ length: D.challenge.total }).map((_, i) => (
              <div key={i} className={"ho-chal__seg-cell" + (i < D.challenge.progress ? " is-done" : "")}/>
            ))}
          </div>
        </div>
        <button className="ho-chal__cta" onClick={(e) => { e.stopPropagation(); onOpenChallenge(); }}>
          {D.challenge.cta}
          <I.Arrow/>
        </button>
      </div>
    </section>

    {/* 4 · COACH QUOTE CARD */}
    <section className="ho-glass ho-coach ho-anim d-3 ho-tap" onClick={onOpenCoach}>
      <div className="ho-coach__qmark">"</div>
      <div className="ho-coach__lbl">COACH · PINNED</div>
      <div className="ho-coach__msg">{D.coach.verdict}</div>
      <div className="ho-coach__foot">
        <div className="ho-coach__sig">{D.coach.signature}</div>
        <div className="ho-coach__link">Read Briefing <I.Arrow/></div>
      </div>
    </section>

    {/* 5 · QUICK ACTIONS — 2 large + 2 small */}
    <div className="ho-anim d-4">
      <div className="ho-sec-head">
        <div className="ho-sec-title">Quick Actions</div>
      </div>
      <div className="ho-actions">
        <div className="ho-actions__row--lg">
          {D.actionsPrimary.map(a => {
            const Icon = I[a.icon] || I.Play;
            return (
              <div
                key={a.id}
                className={"ho-glass ho-act-lg ho-tap ho-act-lg--" + a.tint}
                onClick={() => onOpenAction(a.id)}
              >
                <div className="ho-act-lg__icon"><Icon/></div>
                <div className="ho-act-lg__label">{a.label}</div>
                <div className="ho-act-lg__sub">{a.sub}</div>
              </div>
            );
          })}
        </div>
        <div className="ho-actions__row--sm">
          {D.actionsSecondary.map(a => {
            const Icon = I[a.icon] || I.Drills;
            return (
              <div
                key={a.id}
                className={"ho-glass ho-act-sm ho-tap ho-act-sm--" + a.tint}
                onClick={() => onOpenAction(a.id)}
              >
                <div className="ho-act-sm__icon"><Icon/></div>
                <div className="ho-act-sm__label">{a.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {/* 6 · THIS WEEK'S SESSIONS w/ mini shot charts */}
    <div className="ho-anim d-5">
      <div className="ho-sec-head">
        <div className="ho-sec-title">This Week</div>
        <div className="ho-sec-more">View All →</div>
      </div>
      {hasSessions ? (
        <div className="ho-glass ho-sessions">
          {D.recentSessions.map(s => (
            <div key={s.id} className="ho-sessions__row ho-tap" onClick={() => onOpenSession(s.id)}>
              <div className="ho-sessions__day">{s.day}</div>
              <div>
                <div className="ho-sessions__type">{s.type}</div>
                <div className="ho-sessions__dur" style={{ marginTop: 2 }}>{s.duration}</div>
              </div>
              <div className={"ho-sessions__fg ho-sessions__fg--" + s.dir}>
                {s.dir === "up" ? <I.Up/> : <I.Down/>}
                {s.fg}%
              </div>
              <ShotChart shots={s.shots}/>
            </div>
          ))}
        </div>
      ) : (
        <div className="ho-glass ho-sessions-empty">
          <div className="ho-sessions-empty__icon"><I.Basketball/></div>
          <div className="ho-sessions-empty__title">No sessions yet this week</div>
          <div className="ho-sessions-empty__cta">Log Your First <I.Arrow/></div>
        </div>
      )}
    </div>

    {/* 7 · SKILL SNAPSHOT */}
    <div className="ho-anim d-6">
      <div className="ho-sec-head">
        <div className="ho-sec-title">Skill Snapshot</div>
        <div className="ho-sec-more">→ ME</div>
      </div>
      <div className="ho-glass ho-skills">
        {D.skills.map((s, i) => {
          const r = 22, c = 2 * Math.PI * r;
          const off = c - (s.val / 100) * c;
          return (
            <div key={s.id} className="ho-skill">
              <div className="ho-skill__ring">
                <svg width="52" height="52">
                  <circle cx="26" cy="26" r={r} className="ho-skill__ring-bg"/>
                  <circle
                    cx="26" cy="26" r={r}
                    className="ho-skill__ring-fg"
                    stroke={s.color}
                    strokeDasharray={c}
                    strokeDashoffset={off}
                    style={{
                      strokeDashoffset: c,
                      animation: `ho-ring-${i} 600ms ${600 + i * 120}ms cubic-bezier(0.4,0,0.2,1) forwards`,
                    }}
                  />
                </svg>
                <style>{`@keyframes ho-ring-${i} { to { stroke-dashoffset: ${off}; } }`}</style>
                <div className="ho-skill__pct">{s.val}</div>
              </div>
              <div className="ho-skill__name">{s.name}</div>
            </div>
          );
        })}
      </div>
    </div>

    {/* 8 · WEEKLY GOAL */}
    <div className="ho-glass ho-goal ho-anim d-7">
      <div className="ho-goal__top">
        <div className="ho-goal__lbl">Weekly Goal</div>
        <div className="ho-goal__frac">
          {goalDone && <I.Check width="12" height="12" style={{ marginRight: 6, color: "var(--accent)" }}/>}
          <em>{goalCount}</em> / {D.player.weeklyGoal} sessions
        </div>
      </div>
      <div className="ho-goal__bar">
        <div className="ho-goal__bar-fill" style={{ "--fill": goalPct + "%" }}/>
      </div>
    </div>

    <div className="ho-foot">CourtIQ · Home · §6.10</div>
  </>
  );
};

// Mini half-court shot chart for session rows
const ShotChart = ({ shots }) => (
  <div className="ho-sess__chart">
    <svg viewBox="0 0 50 36" preserveAspectRatio="none">
      {/* half-court arcs */}
      <path d="M 0 36 L 50 36" stroke="rgba(255,255,255,0.16)" strokeWidth="0.6"/>
      <path d="M 4 36 A 21 21 0 0 1 46 36" stroke="rgba(255,255,255,0.10)" strokeWidth="0.6" fill="none"/>
      <rect x="18" y="28" width="14" height="8" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" fill="none"/>
      <circle cx="25" cy="32" r="2" stroke="rgba(245,166,35,0.40)" strokeWidth="0.5" fill="none"/>
      {shots.map((s, i) => (
        <circle
          key={i}
          cx={s.x * 50}
          cy={s.y * 36}
          r={s.made ? 1.6 : 1.4}
          fill={s.made ? "#56d364" : "transparent"}
          stroke={s.made ? "rgba(86,211,100,0.9)" : "rgba(245,89,112,0.85)"}
          strokeWidth={s.made ? 0.4 : 0.7}
          opacity={0.95}
        />
      ))}
    </svg>
  </div>
);

// ─────────────────────────────────────────────────────────
// LOG
// ─────────────────────────────────────────────────────────
const HomeLog = ({ I, state, setState, onLog }) => {
  const types = ["Practice", "Game", "Pickup", "Shooting"];
  const intensities = ["Light", "Medium", "Hard"];
  return (
    <>
      <div className="ho-glass ho-log ho-anim d-0">
        <div>
          <div className="ho-log__lbl">Session Type</div>
          <div className="ho-log__pills">
            {types.map(t => (
              <button
                key={t}
                className={"ho-log__pill" + (state.type === t ? " is-active" : "")}
                onClick={() => setState({ ...state, type: t })}
              >{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="ho-glass ho-log ho-anim d-1">
        <div>
          <div className="ho-log__lbl">Duration</div>
          <div className="ho-log__stepper">
            <button className="ho-log__step-btn" onClick={() => setState({ ...state, duration: Math.max(5, state.duration - 5) })} aria-label="Less"><I.Minus/></button>
            <div className="ho-log__step-val">
              {state.duration}
              <span>Minutes</span>
            </div>
            <button className="ho-log__step-btn" onClick={() => setState({ ...state, duration: state.duration + 5 })} aria-label="More"><I.Plus/></button>
          </div>
        </div>
      </div>

      <div className="ho-glass ho-log ho-anim d-2">
        <div>
          <div className="ho-log__lbl">Intensity</div>
          <div className="ho-log__intensity">
            {intensities.map(i => (
              <button
                key={i}
                className={"ho-log__pill" + (state.intensity === i ? " is-active" : "")}
                onClick={() => setState({ ...state, intensity: i })}
              >{i}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="ho-glass ho-log ho-anim d-3">
        <div>
          <div className="ho-log__lbl">Notes</div>
          <textarea
            className="ho-log__textarea"
            placeholder="What did you work on today?"
            value={state.notes}
            onChange={(e) => setState({ ...state, notes: e.target.value })}
          />
        </div>
      </div>

      <div className="ho-anim d-4">
        <button className="ho-log__cta" onClick={onLog}>
          Log Session
          <I.Arrow/>
        </button>
        <div className="ho-log__hint">Earns +20 XP</div>
      </div>

      <div className="ho-foot">CourtIQ · Home · Log · §6.10</div>
    </>
  );
};

// ─────────────────────────────────────────────────────────
// CALENDAR
// ─────────────────────────────────────────────────────────
const HomeCalendar = ({ D, I, selected, setSelected }) => {
  const cal = D.calendar;
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  const cells = [];
  for (let i = 0; i < cal.firstDay; i++) cells.push(null);
  for (let d = 1; d <= cal.daysInMonth; d++) cells.push(d);

  const sel = selected ?? cal.today;
  const detail = cal.sessions[sel];

  return (
    <>
      <div className="ho-glass ho-cal-head ho-anim d-0">
        <button className="ho-cal-head__nav" aria-label="Previous month"><I.ChevL/></button>
        <div>
          <div className="ho-cal-head__title">{cal.month}</div>
          <div className="ho-cal-head__year">{cal.year}</div>
        </div>
        <button className="ho-cal-head__nav" aria-label="Next month"><I.ChevR/></button>
      </div>

      <div className="ho-glass ho-cal ho-anim d-1">
        <div className="ho-cal__weekdays">
          {weekdays.map((w, i) => <div key={i} className="ho-cal__wd">{w}</div>)}
        </div>
        <div className="ho-cal__grid">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="ho-cal__cell ho-cal__cell--empty"/>;
            const has = !!cal.sessions[d];
            const isToday = d === cal.today;
            const isSel = d === sel;
            const cls = ["ho-cal__cell"];
            if (isToday) cls.push("ho-cal__cell--today");
            if (has)     cls.push("ho-cal__cell--has-session");
            if (isSel && !isToday) cls.push("ho-cal__cell--selected");
            return (
              <div key={i} className={cls.join(" ")} onClick={() => setSelected(d)}>
                <span>{d}</span>
              </div>
            );
          })}
        </div>
        {detail && (
          <div className="ho-cal__detail">
            <div className="ho-cal__detail-date">{cal.month} {sel}</div>
            <div className="ho-cal__detail-type">{detail.type}</div>
            <div className="ho-cal__detail-meta">{detail.duration} · FG {detail.fg}%</div>
          </div>
        )}
      </div>

      <div className="ho-anim d-2">
        <button className="ho-cal-sched">
          <I.Plus/> Schedule Session
        </button>
      </div>

      <div className="ho-foot">CourtIQ · Home · Calendar · §6.10</div>
    </>
  );
};

window.HomeScreen = HomeScreen;
