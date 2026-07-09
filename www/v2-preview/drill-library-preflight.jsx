// drill-library-preflight.jsx — pre-flight gate before HUD handoff
// Checklist (camera, lighting, court fit, audio) → countdown → handoff.
// In this prototype, "handoff" surfaces the camera-hud.html link.

const DLPreflight = ({ drill, onCancel, onGo }) => {
  const [phase, setPhase] = React.useState("checklist"); // checklist → countdown
  const [count, setCount] = React.useState(3);

  // Run countdown when phase flips
  React.useEffect(() => {
    if (phase !== "countdown") return;
    setCount(3);
    const id = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          clearInterval(id);
          setTimeout(() => onGo(drill), 600);
          return 0;
        }
        return c - 1;
      });
    }, 900);
    return () => clearInterval(id);
  }, [phase]);

  return (
    <div className="dl-preflight">
      <div className="dl-preflight__top">
        <button className="dl-preflight__close" onClick={onCancel} aria-label="Cancel">
          <DLIcon.X width="14" height="14" />
        </button>
        <div className="dl-preflight__pill">REC · ARMED</div>
      </div>

      <div className="dl-preflight__body">
        <div className="dl-preflight__eyebrow">PRE-FLIGHT · DRILL READY</div>
        <div className="dl-preflight__name">{drill.name}</div>
        <div className="dl-preflight__benefit">{drill.benefit}</div>

        <div className="dl-preflight-checklist">
          <div className="dl-preflight-check">
            <div className="dl-preflight-check__dot">
              <DLIcon.Check width="14" height="14" />
            </div>
            <div>
              <div className="dl-preflight-check__lbl">CAMERA · MOUNTED</div>
              <div className="dl-preflight-check__sub">REAR · 4K · 60FPS · STABILIZED</div>
            </div>
            <div className="dl-preflight-check__status">READY</div>
          </div>

          <div className="dl-preflight-check">
            <div className="dl-preflight-check__dot">
              <DLIcon.Check width="14" height="14" />
            </div>
            <div>
              <div className="dl-preflight-check__lbl">COURT · FIT</div>
              <div className="dl-preflight-check__sub">RIM + 3PT ARC IN FRAME</div>
            </div>
            <div className="dl-preflight-check__status">READY</div>
          </div>

          <div className="dl-preflight-check">
            <div className="dl-preflight-check__dot is-warn">
              <DLIcon.Warn width="14" height="14" />
            </div>
            <div>
              <div className="dl-preflight-check__lbl">LIGHTING · MIXED</div>
              <div className="dl-preflight-check__sub">SHADOWS ON BACKBOARD · TURN ON GYM LIGHTS IF AVAILABLE</div>
            </div>
            <div className="dl-preflight-check__status is-warn">CHECK</div>
          </div>

          <div className="dl-preflight-check">
            <div className="dl-preflight-check__dot">
              <DLIcon.Check width="14" height="14" />
            </div>
            <div>
              <div className="dl-preflight-check__lbl">AUDIO CUES · ON</div>
              <div className="dl-preflight-check__sub">PHASE BEEPS · COUNT-OUT EVERY 5</div>
            </div>
            <div className="dl-preflight-check__status">READY</div>
          </div>

          <div className="dl-preflight-check">
            <div className="dl-preflight-check__dot">
              <DLIcon.Check width="14" height="14" />
            </div>
            <div>
              <div className="dl-preflight-check__lbl">GOAL · {drill.sets}×{drill.reps} REPS</div>
              <div className="dl-preflight-check__sub">~{drill.duration} MIN · {drill.difficulty.toUpperCase()}</div>
            </div>
            <div className="dl-preflight-check__status">SET</div>
          </div>
        </div>

        {phase === "countdown" && (
          <div className="dl-preflight-countdown">
            <div className="dl-preflight-countdown__lbl">STARTING IN</div>
            <div className="dl-preflight-countdown__num">{count}</div>
            <div className="dl-preflight-countdown__sub">{count > 1 ? "Find your rhythm." : count === 1 ? "Get set." : "GO."}</div>
          </div>
        )}
      </div>

      <div className="dl-preflight__footer">
        <button className="dl-preflight__cancel" onClick={onCancel}>CANCEL</button>
        <button
          className="dl-preflight__go"
          onClick={() => phase === "checklist" ? setPhase("countdown") : null}
          disabled={phase === "countdown"}
        >
          {phase === "checklist" ? "▶ I'M READY" : "STARTING…"}
        </button>
      </div>
    </div>
  );
};

window.DLPreflight = DLPreflight;
