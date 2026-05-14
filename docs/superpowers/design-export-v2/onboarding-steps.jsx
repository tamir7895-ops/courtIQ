// onboarding-steps.jsx — the 7 step screens for Combine intake

const { useState, useEffect, useRef } = React;
const I = window.OBIcon;
const D = window.OB_DATA;

/* ════════════════════════════════════════════════════
   STEP 1 — BASIC INFO (name, age, height, weight, hand)
   ════════════════════════════════════════════════════ */
window.ObStepBasic = function ObStepBasic({ value, onChange }) {
  const upd = (k, v) => onChange({ ...value, [k]: v });

  // Combined ft/in adjusters keep "feet" and "inches" in legal range.
  const bumpFt = (delta) => {
    const next = Math.max(4, Math.min(7, value.heightFt + delta));
    upd("heightFt", next);
  };
  const bumpIn = (delta) => {
    let inches = value.heightIn + delta;
    let feet = value.heightFt;
    if (inches > 11) { inches = 0; feet = Math.min(7, feet + 1); }
    if (inches < 0)  { inches = 11; feet = Math.max(4, feet - 1); }
    onChange({ ...value, heightIn: inches, heightFt: feet });
  };

  const cm = window.obHeightCm(value.heightFt, value.heightIn);
  const kg = window.obWeightKg(value.weightLb);

  return (
    <div className="ob-step">
      <div className="ob-eyebrow ob-anim d-0">Step 1 of 7 · Identity</div>
      <h1 className="ob-title ob-anim d-0">Let's start with <em>the basics.</em></h1>
      <p className="ob-sub ob-anim d-1">A few details so the Combine can frame your data correctly. We pulled what we could from your account — adjust if needed.</p>

      <div className="ob-scroll">
        <div className="ob-glass ob-field ob-anim d-2">
          <div className="ob-field__lbl">Name <em>*</em></div>
          <input
            className="ob-field__input"
            type="text"
            value={value.name}
            onChange={(e) => upd("name", e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="ob-glass ob-field ob-anim d-3">
          <div className="ob-field__lbl">Age <em>*</em></div>
          <div className="ob-step-ctl">
            <button className="ob-step-ctl__btn" onClick={() => upd("age", Math.max(13, value.age - 1))}>
              <I.Minus />
            </button>
            <div className="ob-step-ctl__val">
              <div className="ob-step-ctl__val-num">{value.age}</div>
              <div className="ob-step-ctl__val-sub">Years</div>
            </div>
            <button className="ob-step-ctl__btn" onClick={() => upd("age", Math.min(60, value.age + 1))}>
              <I.Plus />
            </button>
          </div>
        </div>

        <div className="ob-glass ob-field ob-anim d-4">
          <div className="ob-field__lbl">Height <em>*</em></div>
          <div className="ob-dual">
            <div className="ob-dual__col">
              <div className="ob-step-ctl ob-step-ctl--sm">
                <button className="ob-step-ctl__btn" onClick={() => bumpFt(-1)}>
                  <I.Minus />
                </button>
                <div className="ob-step-ctl__val">
                  <div className="ob-step-ctl__val-num">{value.heightFt}<span className="ob-step-ctl__val-unit">'</span></div>
                  <div className="ob-step-ctl__val-sub">Feet</div>
                </div>
                <button className="ob-step-ctl__btn" onClick={() => bumpFt(1)}>
                  <I.Plus />
                </button>
              </div>
            </div>
            <div className="ob-dual__col">
              <div className="ob-step-ctl ob-step-ctl--sm">
                <button className="ob-step-ctl__btn" onClick={() => bumpIn(-1)}>
                  <I.Minus />
                </button>
                <div className="ob-step-ctl__val">
                  <div className="ob-step-ctl__val-num">{value.heightIn}<span className="ob-step-ctl__val-unit">"</span></div>
                  <div className="ob-step-ctl__val-sub">Inches</div>
                </div>
                <button className="ob-step-ctl__btn" onClick={() => bumpIn(1)}>
                  <I.Plus />
                </button>
              </div>
            </div>
          </div>
          <div className="ob-conv">{cm} cm</div>
        </div>

        <div className="ob-glass ob-field ob-anim d-5">
          <div className="ob-field__lbl">Weight <em>*</em></div>
          <div className="ob-step-ctl">
            <button className="ob-step-ctl__btn" onClick={() => upd("weightLb", Math.max(80, value.weightLb - 1))}>
              <I.Minus />
            </button>
            <div className="ob-step-ctl__val">
              <div className="ob-step-ctl__val-num">{value.weightLb}<span className="ob-step-ctl__val-unit"> lb</span></div>
              <div className="ob-step-ctl__val-sub">Pounds</div>
            </div>
            <button className="ob-step-ctl__btn" onClick={() => upd("weightLb", Math.min(400, value.weightLb + 1))}>
              <I.Plus />
            </button>
          </div>
          <div className="ob-conv">{kg} kg</div>
        </div>

        <div className="ob-glass ob-field ob-anim d-6">
          <div className="ob-field__lbl">Dominant Hand</div>
          <div className="ob-hand">
            <button className={`ob-hand__opt${value.hand === "L" ? " is-active" : ""}`} onClick={() => upd("hand", "L")}>
              <span className="ob-hand__big">L</span>
              <span className="ob-hand__lbl">Left</span>
            </button>
            <button className={`ob-hand__opt${value.hand === "R" ? " is-active" : ""}`} onClick={() => upd("hand", "R")}>
              <span className="ob-hand__big">R</span>
              <span className="ob-hand__lbl">Right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   STEP 2 — POSITION
   ════════════════════════════════════════════════════ */
window.ObStepPosition = function ObStepPosition({ value, onChange }) {
  return (
    <div className="ob-step">
      <div className="ob-eyebrow ob-anim d-0">Step 2 of 7 · Position</div>
      <h1 className="ob-title ob-anim d-0">Where do you <em>play?</em></h1>
      <p className="ob-sub ob-anim d-1">Pick the spot you fill most often. We'll calibrate drills, comps, and reads to match.</p>

      <div className="ob-scroll">
        {D.positions.map((p, i) => {
          const active = value === p.id;
          return (
            <button
              key={p.id}
              className={`ob-glass ob-pos ob-tap ob-anim d-${2 + i}${active ? " is-active" : ""}`}
              onClick={() => onChange(p.id)}
            >
              <div className="ob-pos__abbr">{p.short}</div>
              <div className="ob-pos__body">
                <div className="ob-pos__name">{p.name}</div>
                <div className="ob-pos__desc">{p.desc}</div>
                <div className="ob-pos__traits">
                  {p.traits.map((t) => <span className="ob-pos__trait" key={t}>{t}</span>)}
                </div>
              </div>
              <div className="ob-pos__check"><I.Check /></div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   STEP 3 — PLAY-STYLE QUIZ (4 questions, single page)
   ════════════════════════════════════════════════════ */
window.ObStepQuiz = function ObStepQuiz({ value, onChange }) {
  const upd = (qId, optId) => onChange({ ...value, [qId]: optId });
  return (
    <div className="ob-step">
      <div className="ob-eyebrow ob-anim d-0">Step 3 of 7 · Play Style</div>
      <h1 className="ob-title ob-anim d-0">How do you <em>play the game?</em></h1>
      <p className="ob-sub ob-anim d-1">Four quick gut-checks. There are no wrong answers — just calibrate.</p>

      <div className="ob-scroll">
        {D.quiz.map((q, i) => (
          <div className={`ob-glass ob-quiz ob-anim d-${2 + i}`} key={q.id}>
            <div className="ob-quiz__num">Q{i + 1}</div>
            <div className="ob-quiz__q">{q.q}</div>
            <div className="ob-quiz__opts">
              {q.options.map((o) => {
                const active = value[q.id] === o.id;
                return (
                  <button
                    key={o.id}
                    className={`ob-quiz__opt ob-tap${active ? " is-active" : ""}`}
                    onClick={() => upd(q.id, o.id)}
                  >
                    <div className="ob-quiz__radio" />
                    <div>{o.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   STEP 4 — SKILLS RADAR (self-rate)
   ════════════════════════════════════════════════════ */
window.ObStepRadar = function ObStepRadar({ value, onChange }) {
  // value is { shoot: 0-100, ... } — one slider per skill
  const skillsForRadar = D.skills.map((s) => ({ id: s.id, name: s.name, val: value[s.id] || 0 }));
  const overall = Math.round(skillsForRadar.reduce((a, b) => a + b.val, 0) / skillsForRadar.length);

  return (
    <div className="ob-step">
      <div className="ob-eyebrow ob-anim d-0">Step 4 of 7 · Self-Scout</div>
      <h1 className="ob-title ob-anim d-0">Rate <em>your game.</em></h1>
      <p className="ob-sub ob-anim d-1">Be honest — overrating yourself just gets you bad drills. Be your own scout.</p>

      <div className="ob-scroll">
        <div className="ob-glass ob-radar-card ob-anim d-2">
          <div className="ob-radar-card__lbl">Self-Rated Overall</div>
          <div className="ob-radar-card__overall"><em>{overall}</em></div>
          <svg className="ob-radar-svg" viewBox="0 0 280 280">
            {/* grid rings */}
            {[0.25, 0.5, 0.75, 1].map((t, idx) => {
              const pts = skillsForRadar.map((_, i) => {
                const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
                const r = 280 * 0.36 * t;
                return [140 + Math.cos(a) * r, 140 + Math.sin(a) * r].join(",");
              }).join(" ");
              return <polygon key={idx} points={pts} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />;
            })}
            {/* axes */}
            {skillsForRadar.map((_, i) => {
              const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
              const r = 280 * 0.36;
              return <line key={i} x1="140" y1="140" x2={140 + Math.cos(a) * r} y2={140 + Math.sin(a) * r} stroke="rgba(255,255,255,0.06)" />;
            })}
            {/* shape */}
            <polygon
              points={skillsForRadar.map((s, i) => {
                const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
                const r = 280 * 0.36 * (s.val / 100);
                return [140 + Math.cos(a) * r, 140 + Math.sin(a) * r].join(",");
              }).join(" ")}
              fill="rgba(45,212,191,0.20)"
              stroke="#2dd4bf"
              strokeWidth="2"
              style={{ filter: "drop-shadow(0 0 6px rgba(45,212,191,0.5))", transition: "all 220ms cubic-bezier(0.2,0.85,0.3,1)" }}
            />
            {/* vertices */}
            {skillsForRadar.map((s, i) => {
              const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
              const r = 280 * 0.36 * (s.val / 100);
              return <circle key={s.id} cx={140 + Math.cos(a) * r} cy={140 + Math.sin(a) * r} r="3" fill="#2dd4bf" />;
            })}
            {/* labels */}
            {skillsForRadar.map((s, i) => {
              const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
              const r = 280 * 0.36 * 1.22;
              const x = 140 + Math.cos(a) * r;
              const y = 140 + Math.sin(a) * r;
              const anchor = Math.abs(Math.cos(a)) < 0.1 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
              const baseline = Math.sin(a) > 0.5 ? "hanging" : Math.sin(a) < -0.5 ? "auto" : "middle";
              return (
                <text
                  key={s.id} x={x} y={y}
                  textAnchor={anchor} dominantBaseline={baseline}
                  style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", fill: "rgba(240,236,228,0.62)", textTransform: "uppercase" }}
                >{s.name.toUpperCase()}</text>
              );
            })}
          </svg>
        </div>

        <div className="ob-glass ob-skills ob-anim d-3">
          {D.skills.map((s) => {
            const v = value[s.id] || 0;
            return (
              <div className="ob-sk" key={s.id}>
                <div className="ob-sk__name">{s.name}</div>
                <div className="ob-sk__val">{v}</div>
                <div className="ob-sk__hint">{s.hint}</div>
                <input
                  type="range" min="0" max="100" step="1"
                  className="ob-sk__slider"
                  value={v}
                  onChange={(e) => onChange({ ...value, [s.id]: parseInt(e.target.value, 10) })}
                  style={{ "--pct": `${v}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   STEP 5 — GOALS (multi-select up to 3)
   ════════════════════════════════════════════════════ */
window.ObStepGoals = function ObStepGoals({ value, onChange }) {
  const MAX = 3;
  const toggle = (id) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else if (value.length < MAX) onChange([...value, id]);
  };

  return (
    <div className="ob-step">
      <div className="ob-eyebrow ob-anim d-0">Step 5 of 7 · Goals</div>
      <h1 className="ob-title ob-anim d-0">What's <em>the mission?</em></h1>
      <p className="ob-sub ob-anim d-1">Pick up to 3 priorities. Your training plan rides on these.</p>

      <div className="ob-scroll" style={{ paddingTop: 18 }}>
        <div className="ob-anim d-2" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.20em", color: "rgba(240,236,228,0.62)", fontWeight: 700, textTransform: "uppercase" }}>Selected</span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.10em", color: value.length === MAX ? "#2dd4bf" : "#f0ece4", fontWeight: 800 }}>{value.length} / {MAX}</span>
        </div>

        <div className="ob-goals ob-anim d-3">
          {D.goals.map((g) => {
            const active = value.includes(g.id);
            const atMax = !active && value.length >= MAX;
            const Glyph = I[g.icon];
            return (
              <button
                key={g.id}
                className={`ob-goal ob-tap${active ? " is-active" : ""}`}
                onClick={() => toggle(g.id)}
                disabled={atMax}
              >
                <div className="ob-goal__icon">{Glyph ? <Glyph /> : null}</div>
                <div className="ob-goal__lbl">{g.label}</div>
                <div className="ob-goal__check"><I.Check /></div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   STEP 6 — LOADING
   ════════════════════════════════════════════════════ */
window.ObStepLoading = function ObStepLoading({ onDone }) {
  const [stepIdx, setStepIdx] = useState(0);
  const steps = D.loadingSteps;
  const current = steps[stepIdx] || steps[0];

  useEffect(() => {
    const timers = steps.map((s, i) => setTimeout(() => setStepIdx(i), s.t));
    const finish = setTimeout(() => onDone && onDone(), steps[steps.length - 1].t + 700);
    return () => { timers.forEach(clearTimeout); clearTimeout(finish); };
  }, []);

  return (
    <div className="ob-step ob-load">
      <div className="ob-load__visual">
        <div className="ob-load__ring ob-load__ring--1" />
        <div className="ob-load__ring ob-load__ring--2" />
        <div className="ob-load__ring ob-load__ring--3" />
        <div className="ob-load__core" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div className="ob-load__lbl">{current.label}</div>
        <div className="ob-load__msg">{current.msg}</div>
        <div className="ob-load__bars">
          {steps.map((_, i) => (
            <span key={i} className={i <= stepIdx ? "is-on" : ""} />
          ))}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   STEP 7 — SCOUTING REPORT
   Five organized cards: Grade hero · Strengths · Weaknesses ·
   Training Plan · NBA Comparison
   ════════════════════════════════════════════════════ */
window.ObStepReport = function ObStepReport({ name }) {
  const r = D.report;
  const first = name.split(" ")[0] || name;
  return (
    <div className="ob-step">
      <div className="ob-eyebrow ob-anim d-0">Step 7 of 7 · Your Report</div>
      <h1 className="ob-title ob-anim d-0">Welcome to <em>the Combine,</em>{" "}<br />{first}.</h1>
      <p className="ob-rep-foot ob-anim d-1">Generated by Combine AI · Confidence 0.86</p>

      <div className="ob-scroll" style={{ paddingTop: 14 }}>

        {/* CARD 1 — Grade hero */}
        <div className="ob-glass ob-rep-hero ob-anim d-1">
          <div className="ob-rep-hero__top">
            <div className="ob-rep-hero__avatar">
              <svg width="92" height="92" viewBox="0 0 92 92">
                <circle cx="46" cy="34" r="14" fill="rgba(255,255,255,0.95)" />
                <path d="M16 86 Q16 58 46 58 Q76 58 76 86 Z" fill="rgba(255,255,255,0.95)" />
              </svg>
            </div>
            <div className="ob-rep-hero__r">
              <div className="ob-rep-hero__lbl">Combine Grade</div>
              <div className="ob-rep-hero__grade-row">
                <div className="ob-rep-hero__grade">{r.grade}</div>
                <div className="ob-rep-hero__pct">{r.gradePct}%</div>
              </div>
              <div className="ob-rep-hero__arche">{r.archetype}</div>
            </div>
          </div>
          <div className="ob-rep-hero__summary">"{r.headline}"</div>
        </div>

        {/* CARD 2 — Strengths */}
        <div className="ob-glass ob-rep-card ob-anim d-2">
          <div className="ob-rep-card__head ob-rep-card__head--str">
            <span className="ob-rep-card__head-dot" />
            <span className="ob-rep-card__head-lbl">Strengths</span>
            <span className="ob-rep-card__head-count">{r.strengths.length}</span>
          </div>
          <div className="ob-rep-rows">
            {r.strengths.map((s, i) => (
              <div className="ob-rep-row ob-rep-row--str" key={i}>
                <span className="ob-rep-row__dot" />
                <div className="ob-rep-row__body">
                  <div className="ob-rep-row__head">
                    <div className="ob-rep-row__title">{s.label}</div>
                    <div className="ob-rep-row__score">{s.score}</div>
                  </div>
                  <div className="ob-rep-row__bar">
                    <div className="ob-rep-row__bar-fill" style={{ width: `${s.score}%` }} />
                  </div>
                  <div className="ob-rep-row__note">{s.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 3 — Weaknesses */}
        <div className="ob-glass ob-rep-card ob-anim d-3">
          <div className="ob-rep-card__head ob-rep-card__head--gap">
            <span className="ob-rep-card__head-dot" />
            <span className="ob-rep-card__head-lbl">Weaknesses</span>
            <span className="ob-rep-card__head-count">{r.gaps.length}</span>
          </div>
          <div className="ob-rep-rows">
            {r.gaps.map((s, i) => (
              <div className="ob-rep-row ob-rep-row--gap" key={i}>
                <span className="ob-rep-row__dot" />
                <div className="ob-rep-row__body">
                  <div className="ob-rep-row__head">
                    <div className="ob-rep-row__title">{s.label}</div>
                    <div className="ob-rep-row__score">{s.score}</div>
                  </div>
                  <div className="ob-rep-row__bar">
                    <div className="ob-rep-row__bar-fill" style={{ width: `${s.score}%` }} />
                  </div>
                  <div className="ob-rep-row__note">{s.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 4 — Training Plan */}
        <div className="ob-glass ob-rep-card ob-anim d-4">
          <div className="ob-rep-card__head ob-rep-card__head--plan">
            <span className="ob-rep-card__head-dot" />
            <span className="ob-rep-card__head-lbl">Training Plan</span>
            <span className="ob-rep-card__head-count">PRIORITY ORDER</span>
          </div>
          <div className="ob-rep-plan">
            {r.plan.map((p, i) => (
              <div className="ob-rep-plan__row" key={i}>
                <div className="ob-rep-plan__num">{i + 1}</div>
                <div className="ob-rep-plan__body">
                  <div className="ob-rep-plan__title">{p.title}</div>
                  <div className="ob-rep-plan__sub">{p.sub}</div>
                  <div className="ob-rep-plan__why">{p.why}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 5 — NBA Comparison (the fun reveal) */}
        <div className="ob-glass ob-rep-comp-v2 ob-anim d-5">
          <div className="ob-rep-comp-v2__lbl">You play like</div>
          <div className="ob-rep-comp-v2__hero">
            <div className="ob-rep-comp-v2__sil">
              <svg viewBox="0 0 80 80">
                <defs>
                  <radialGradient id="silg2" cx="50%" cy="40%">
                    <stop offset="0%" stopColor="#f5a623" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#f5a623" stopOpacity="0.10" />
                  </radialGradient>
                </defs>
                <rect x="0" y="0" width="80" height="80" fill="url(#silg2)" />
                <circle cx="40" cy="28" r="10" fill="#06080c" />
                <path d="M16 76 Q16 46 40 46 Q64 46 64 76 Z" fill="#06080c" />
              </svg>
            </div>
            <div className="ob-rep-comp-v2__r">
              <div className="ob-rep-comp-v2__name">{r.nbaComp.name}</div>
              <div className="ob-rep-comp-v2__role">{r.nbaComp.role}</div>
            </div>
          </div>
          <div className="ob-rep-comp-v2__why">{r.nbaComp.why}</div>
          <div className="ob-rep-comp-v2__reasons">
            {r.nbaComp.reasons.map((x, i) => (
              <div className="ob-rep-comp-v2__reason" key={i}>
                <span className="ob-rep-comp-v2__reason-num">0{i + 1}</span>
                <span>{x}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
