// onboarding-app.jsx — 7-step Combine intake, mounted in iOS frame

const { useState, useMemo, useEffect, useRef, useLayoutEffect } = React;
const I = window.OBIcon;
const D = window.OB_DATA;

const TOTAL_STEPS = 7;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "step": 1,
  "scrollPct": 0
}/*EDITMODE-END*/;

const STEP_NAMES = {
  1: "Identity",
  2: "Position",
  3: "Play Style",
  4: "Self-Scout",
  5: "Goals",
  6: "Loading",
  7: "Report",
};

function ObApp() {
  const [tweaks, setTweak] = window.useTweaks
    ? window.useTweaks(TWEAK_DEFAULTS)
    : [TWEAK_DEFAULTS, () => {}];

  const [step, setStep] = useState(tweaks.step || 1);
  const [basic, setBasic] = useState({ ...D.defaults });
  const [position, setPosition] = useState("SG");
  const [quiz, setQuiz] = useState({});
  const [skillsVal, setSkillsVal] = useState({ shoot: 72, handle: 60, pass: 65, def: 70, ath: 55, iq: 75 });
  const [goals, setGoals] = useState([]);

  // Sync step ← tweaks (when user uses the step picker in the panel)
  useEffect(() => {
    if (typeof tweaks.step === "number" && tweaks.step !== step) {
      setStep(tweaks.step);
    }
  }, [tweaks.step]);

  // Sync tweaks ← step (when user advances via CTA)
  useEffect(() => {
    if (tweaks.step !== step) setTweak("step", step);
  }, [step]);

  // Drive scroll position from tweaks.scrollPct on the current step's scroll container
  const stageRef = useRef(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const scroller = stage.querySelector(".ob-scroll");
    if (!scroller) return;
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const target = (max * (tweaks.scrollPct || 0)) / 100;
    // Only update if user-initiated (don't loop with their manual scroll)
    if (Math.abs(scroller.scrollTop - target) > 2) {
      scroller.scrollTop = target;
    }
  }, [tweaks.scrollPct, step]);

  // Validation per step
  const canAdvance = useMemo(() => {
    if (step === 1) return basic.name.trim().length > 0 && basic.age >= 13 && basic.heightFt >= 4 && basic.weightLb >= 80;
    if (step === 2) return !!position;
    if (step === 3) return D.quiz.every((q) => quiz[q.id]);
    if (step === 4) return true;
    if (step === 5) return goals.length >= 1;
    if (step === 6) return false;
    if (step === 7) return true;
    return false;
  }, [step, basic, position, quiz, goals]);

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const ctaLabel = (() => {
    if (step === 1) return "CONTINUE";
    if (step === 2) return "LOCK IN POSITION";
    if (step === 3) return "SUBMIT ANSWERS";
    if (step === 4) return "CONFIRM SELF-SCOUT";
    if (step === 5) return "GENERATE MY REPORT";
    if (step === 7) return "ENTER THE COMBINE";
    return "";
  })();

  // Auto-fill helper: if user jumps to a step that needs prior answers, fill them
  useEffect(() => {
    if (step >= 3 && Object.keys(quiz).length === 0) {
      setQuiz({
        tempo: "create",
        scoring: "mid",
        favmove: "step",
        defense: "lock",
        role: "shot",
        weak: "cond",
        train: "3-4",
        exp: "adv",
      });
    }
    if (step >= 5 && goals.length === 0) {
      setGoals(["three", "lock"]);
    }
  }, [step]);

  const TweaksPanel = window.TweaksPanel;
  const TweakSection = window.TweakSection;
  const TweakSelect = window.TweakSelect;
  const TweakSlider = window.TweakSlider;
  const TweakButton = window.TweakButton;

  return (
    <div className="ob" data-screen-label={`onboarding-step-${step}-${STEP_NAMES[step]}`}>
      {/* Top bar */}
      <div className="ob-top">
        <button
          className="ob-top__btn"
          onClick={back}
          disabled={step === 1 || step === 6 || step === 7}
          aria-label="Back"
        >
          <I.ChevL />
        </button>
        <div className="ob-prog">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
            const idx = i + 1;
            const cls = idx < step ? "is-done" : idx === step ? "is-active" : "";
            return <div key={i} className={`ob-prog__seg ${cls}`} />;
          })}
        </div>
        <button
          className="ob-top__skip"
          onClick={next}
          disabled={step === 6 || step === 7 || step === 1}
        >
          Skip
        </button>
        <div className="ob-prog__count">{String(step).padStart(2, "0")} / {String(TOTAL_STEPS).padStart(2, "0")}</div>
      </div>

      {/* Stage */}
      <div className="ob-stage" ref={stageRef} key={`step-${step}`}>
        {step === 1 && <window.ObStepBasic value={basic} onChange={setBasic} />}
        {step === 2 && <window.ObStepPosition value={position} onChange={setPosition} />}
        {step === 3 && <window.ObStepQuiz value={quiz} onChange={setQuiz} />}
        {step === 4 && <window.ObStepRadar value={skillsVal} onChange={setSkillsVal} />}
        {step === 5 && <window.ObStepGoals value={goals} onChange={setGoals} />}
        {step === 6 && <window.ObStepLoading onDone={() => setStep(7)} />}
        {step === 7 && <window.ObStepReport name={basic.name} />}
      </div>

      {/* Footer CTA — hide on loading */}
      {step !== 6 && (
        <div className="ob-foot">
          <button
            className="ob-foot__btn"
            onClick={next}
            disabled={!canAdvance || step === TOTAL_STEPS}
            style={step === TOTAL_STEPS ? { opacity: 1, cursor: "pointer" } : undefined}
          >
            {ctaLabel}
            {step !== TOTAL_STEPS && <I.Arrow />}
          </button>
          {step === 5 && (
            <div className="ob-foot__hint">Takes about 4 seconds · 540 player comps queried</div>
          )}
          {step === 7 && (
            <div className="ob-foot__hint">Your report is saved to your profile</div>
          )}
        </div>
      )}

      {TweaksPanel && (
        <TweaksPanel>
          <TweakSection label="Preview" />
          <TweakSelect
            label="Step"
            value={tweaks.step}
            options={Array.from({ length: TOTAL_STEPS }).map((_, i) => ({
              value: i + 1,
              label: `${i + 1}. ${STEP_NAMES[i + 1]}`,
            }))}
            onChange={(v) => setTweak("step", Number(v))}
          />
          <TweakSlider
            label="Scroll position"
            value={tweaks.scrollPct}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => setTweak("scrollPct", v)}
          />
          <TweakButton
            label="Reset scroll"
            onClick={() => setTweak("scrollPct", 0)}
          >
            Top
          </TweakButton>
        </TweaksPanel>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <window.IOSDevice>
    <ObApp />
  </window.IOSDevice>
);
