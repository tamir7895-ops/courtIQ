// drill-library-preflight-v2.jsx — card-based pre-flight gate

const DLPreflight = ({ drill, onCancel, onGo }) => {
  const [phase, setPhase] = React.useState("checklist");
  const [count, setCount] = React.useState(3);

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
    <div className="dl-preflight dl">
      <div className="dl-preflight__top">
        <button className="dl-preflight__close" onClick={onCancel} aria-label="Cancel">
          <window.DLIcon.X width="14" height="14" />
        </button>
        <div className="dl-preflight__pill">REC · ARMED</div>
      </div>

      <div className="dl-preflight__body">
        {/* CARD 1 — HERO */}
        <div className="dl-glass dl-pre-hero">
          <div className="dl-pre-hero__eyebrow">PRE-FLIGHT · DRILL READY</div>
          <div className="dl-pre-hero__name">{drill.name}</div>
          <div className="dl-pre-hero__benefit">{drill.benefit}</div>
        </div>

        {/* CARD 2 — EQUIPMENT / SPACE */}
        <div className="dl-glass dl-card-section">
          <div className="dl-card-head">
            <span>EQUIPMENT · SPACE</span>
            <span className="dl-card-head__sub">SET BEFORE START</span>
          </div>
          <div className="dl-phase-list">
            <div className="dl-phase-row">
              <span className="dl-phase-idx">01</span>
              <span className="dl-phase-lbl">BALL · {drill.ball.toUpperCase()}</span>
              <span className="dl-phase-time" style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)", letterSpacing: "0.16em", fontWeight: 700 }}>READY</span>
            </div>
            <div className="dl-phase-row">
              <span className="dl-phase-idx">02</span>
              <span className="dl-phase-lbl">SPACE · {(drill.space || "").toUpperCase()}</span>
              <span className="dl-phase-time" style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)", letterSpacing: "0.16em", fontWeight: 700 }}>OK</span>
            </div>
            <div className="dl-phase-row">
              <span className="dl-phase-idx">03</span>
              <span className="dl-phase-lbl">GOAL · {drill.sets}×{drill.reps} REPS</span>
              <span className="dl-phase-time" style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)", letterSpacing: "0.16em", fontWeight: 700 }}>SET</span>
            </div>
          </div>
        </div>

        {/* CARD 3 — CHECKLIST */}
        <div className="dl-glass dl-card-section">
          <div className="dl-card-head">
            <span>CAMERA · CAPTURE CHECK</span>
            <span className="dl-card-head__sub">4 CHECKS</span>
          </div>

          <div className="dl-pre-check">
            <div className="dl-pre-check__dot"><window.DLIcon.Check width="14" height="14" /></div>
            <div>
              <div className="dl-pre-check__lbl">CAMERA · MOUNTED</div>
              <div className="dl-pre-check__sub">REAR · 4K · 60FPS · STABILIZED</div>
            </div>
            <div className="dl-pre-check__status">READY</div>
          </div>

          <div className="dl-pre-check">
            <div className="dl-pre-check__dot"><window.DLIcon.Check width="14" height="14" /></div>
            <div>
              <div className="dl-pre-check__lbl">COURT · FIT</div>
              <div className="dl-pre-check__sub">RIM + 3PT ARC IN FRAME</div>
            </div>
            <div className="dl-pre-check__status">READY</div>
          </div>

          <div className="dl-pre-check">
            <div className="dl-pre-check__dot is-warn"><window.DLIcon.Warn width="14" height="14" /></div>
            <div>
              <div className="dl-pre-check__lbl">LIGHTING · MIXED</div>
              <div className="dl-pre-check__sub">SHADOWS ON BACKBOARD · TURN ON GYM LIGHTS</div>
            </div>
            <div className="dl-pre-check__status is-warn">CHECK</div>
          </div>

          <div className="dl-pre-check">
            <div className="dl-pre-check__dot"><window.DLIcon.Check width="14" height="14" /></div>
            <div>
              <div className="dl-pre-check__lbl">AUDIO CUES · ON</div>
              <div className="dl-pre-check__sub">PHASE BEEPS · COUNT-OUT EVERY 5</div>
            </div>
            <div className="dl-pre-check__status">READY</div>
          </div>
        </div>

        {/* CARD 4 — COUNTDOWN (when active) */}
        {phase === "countdown" && (
          <div className="dl-glass dl-pre-countdown">
            <div className="dl-pre-countdown__lbl">STARTING IN</div>
            <div className="dl-pre-countdown__num">{count}</div>
            <div className="dl-pre-countdown__sub">{count > 1 ? "Find your rhythm." : count === 1 ? "Get set." : "GO."}</div>
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
