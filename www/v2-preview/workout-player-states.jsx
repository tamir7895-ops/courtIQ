// workout-player-states.jsx — three state components: Active, Rest, Complete
// Theming via parent class (.wp.is-active / .wp.is-rest / .wp.is-complete)

// ─────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────
const WPIcon = {
  Pause: (p) => (
    <svg viewBox="0 0 22 22" fill="none" {...p}>
      <rect x="5"  y="4" width="4" height="14" rx="1.2" fill="currentColor"/>
      <rect x="13" y="4" width="4" height="14" rx="1.2" fill="currentColor"/>
    </svg>
  ),
  Play: (p) => (
    <svg viewBox="0 0 22 22" fill="none" {...p}>
      <path d="M6 4l13 7-13 7V4Z" fill="currentColor"/>
    </svg>
  ),
  SkipRep: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M3 4l6 4-6 4V4Z" fill="currentColor"/>
      <rect x="11" y="3.5" width="2.2" height="9" rx="0.8" fill="currentColor"/>
    </svg>
  ),
  SkipDrill: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M2 4l5 4-5 4V4Z" fill="currentColor"/>
      <path d="M8 4l5 4-5 4V4Z" fill="currentColor"/>
    </svg>
  ),
  Exit: (p) => (
    <svg viewBox="0 0 14 14" fill="none" {...p}>
      <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  ArrowForward: (p) => (
    <svg viewBox="0 0 22 22" fill="none" {...p}>
      <path d="M4 11h14M12 5l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Save: (p) => (
    <svg viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M3.5 3.5h9.5l2 2v9a1 1 0 0 1-1 1h-11.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M5 3.5v3.5h6V3.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <circle cx="9" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.7"/>
    </svg>
  ),
  Camera: (p) => (
    <svg viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M3 6a1.4 1.4 0 0 1 1.4-1.4h1.9l1-1.4h3.4l1 1.4h1.9A1.4 1.4 0 0 1 15 6v7a1.4 1.4 0 0 1-1.4 1.4h-9.2A1.4 1.4 0 0 1 3 13V6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <circle cx="9" cy="9.5" r="2.8" stroke="currentColor" strokeWidth="1.7"/>
    </svg>
  ),
  Coffee: (p) => (
    <svg viewBox="0 0 22 22" fill="none" {...p}>
      <path d="M4 8h11v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M15 10h1.5a2.5 2.5 0 0 1 0 5H15" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M7 3v2M10 3v2M13 3v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Next: (p) => (
    <svg viewBox="0 0 22 22" fill="none" {...p}>
      <path d="M5 6l6 5-6 5V6Z" fill="currentColor"/>
      <path d="M13 6l6 5-6 5V6Z" fill="currentColor"/>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────
// PROGRESS RING — used in active & rest timer
// ─────────────────────────────────────────────────────────────
const RING_R = 130;
const RING_C = 2 * Math.PI * RING_R;
function ProgressRing({ progress = 0 }) {
  const offset = RING_C * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <svg viewBox="0 0 286 286" className="wp-timer__ring">
      <circle cx="143" cy="143" r={RING_R} className="wp-timer__ring-bg" />
      <circle
        cx="143" cy="143" r={RING_R}
        className="wp-timer__ring-fg"
        strokeDasharray={RING_C}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function fmt(secs) {
  const s = Math.max(0, Math.ceil(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// ACTIVE STATE
// ─────────────────────────────────────────────────────────────
const WPActive = ({ drill, setIdx, setTotal, rep, repTotal, timeLeft, setLen, paused, onTogglePause, onSkipRep, onSkipDrill, onExit }) => {
  const ringPct = setLen > 0 ? timeLeft / setLen : 0;
  const repPct  = repTotal > 0 ? rep / repTotal : 0;

  return (
    <>
      <div className="wp-stamp">
        <div className="wp-stamp__l">
          <button className="wp-stamp__exit" aria-label="Exit" onClick={onExit}>
            <WPIcon.Exit />
          </button>
          <div>
            <div className="wp-stamp__eyebrow">TRAIN · WORKOUT</div>
            <div className="wp-stamp__meta">Midrange Masterclass</div>
          </div>
        </div>
        <div className="wp-stamp__pill">
          <span className="wp-stamp__pill-dot" />
          {paused ? "Paused" : "Live"}
        </div>
      </div>

      <div className="wp-body">
        {/* TOP CARD */}
        <div className="wp-top wp-glass wp-fade d-1">
          <div className="wp-top__row">
            <div className="wp-top__eyebrow">Drill <em>{drill.idx}</em> · {drill.lane}</div>
            <div className="wp-top__counter">Set <em>{setIdx}</em> of {setTotal}</div>
          </div>
          <h2 className="wp-top__title">{drill.name}</h2>
          <div className="wp-top__dots">
            {Array.from({ length: setTotal }).map((_, i) => {
              const done = i + 1 < setIdx;
              const current = i + 1 === setIdx;
              return (
                <span
                  key={i}
                  className={"wp-top__dot" + (done ? " is-done" : "") + (current ? " is-current" : "")}
                  style={current ? { "--dot-pct": `${Math.round((1 - ringPct) * 100)}%` } : undefined}
                />
              );
            })}
          </div>
          <p className="wp-top__sub">{drill.cue}</p>
        </div>

        {/* CENTER — TIMER */}
        <div className="wp-timer-stage wp-fade d-2">
          <div className="wp-timer">
            <ProgressRing progress={ringPct} />
            <div className="wp-timer__inner">
              <div className="wp-timer__phase-lbl">Working</div>
              <div className="wp-timer__num">{fmt(timeLeft)}</div>
              <div className="wp-timer__unit">remaining</div>
            </div>
          </div>
          <div className="wp-rep">
            <span className="wp-rep__lbl">Rep</span>
            <span className="wp-rep__val"><em>{rep}</em> / {repTotal}</span>
            <span className="wp-rep__bar"><span className="wp-rep__fill" style={{ width: `${Math.round(repPct * 100)}%` }} /></span>
          </div>
        </div>

        {/* BOTTOM CONTROLS */}
        <div className="wp-controls wp-glass wp-fade d-3">
          <div className="wp-controls__primary">
            <button
              className={"wp-btn-primary" + (paused ? " is-resume" : "")}
              type="button"
              onClick={onTogglePause}
            >
              {paused ? <><WPIcon.Play />Resume</> : <><WPIcon.Pause />Pause</>}
            </button>
          </div>
          <div className="wp-controls__secondary">
            <button className="wp-btn-ghost" type="button" onClick={onSkipRep}>
              <WPIcon.SkipRep />Skip Rep
            </button>
            <button className="wp-btn-ghost is-warn" type="button" onClick={onSkipDrill}>
              <WPIcon.SkipDrill />Skip Drill
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// REST STATE
// ─────────────────────────────────────────────────────────────
const WPRest = ({ drill, setIdx, setTotal, timeLeft, restLen, nextDrill, onSkipRest, onExit }) => {
  const ringPct = restLen > 0 ? timeLeft / restLen : 0;

  return (
    <>
      <div className="wp-stamp">
        <div className="wp-stamp__l">
          <button className="wp-stamp__exit" aria-label="Exit" onClick={onExit}>
            <WPIcon.Exit />
          </button>
          <div>
            <div className="wp-stamp__eyebrow">TRAIN · REST</div>
            <div className="wp-stamp__meta">Breathe · {fmt(timeLeft)}</div>
          </div>
        </div>
        <div className="wp-stamp__pill">
          <span className="wp-stamp__pill-dot" />
          Resting
        </div>
      </div>

      <div className="wp-body">
        {/* dimmed top card recap */}
        <div className="wp-top wp-glass wp-fade d-1">
          <div className="wp-top__row">
            <div className="wp-top__eyebrow">Just finished · {drill.lane}</div>
            <div className="wp-top__counter">Set <em>{setIdx}</em> of {setTotal} ✓</div>
          </div>
          <h2 className="wp-top__title">{drill.name}</h2>
        </div>

        {/* CENTER — REST TIMER */}
        <div className="wp-timer-stage wp-fade d-2">
          <div className="wp-timer">
            <ProgressRing progress={ringPct} />
            <div className="wp-timer__inner">
              <div className="wp-timer__phase-lbl">Rest</div>
              <div className="wp-timer__num">{fmt(timeLeft)}</div>
              <div className="wp-timer__unit">recovery</div>
            </div>
          </div>

          {nextDrill && (
            <div className="wp-upnext wp-glass">
              <div className="wp-upnext__badge"><WPIcon.Coffee /></div>
              <div className="wp-upnext__body">
                <div className="wp-upnext__lbl">Up Next</div>
                <div className="wp-upnext__name">{nextDrill.name}</div>
                <div className="wp-upnext__meta">{nextDrill.sets} sets · {nextDrill.reps} reps · {nextDrill.duration} min</div>
              </div>
              <div className="wp-upnext__icon"><WPIcon.Next /></div>
            </div>
          )}
        </div>

        {/* BOTTOM CONTROLS */}
        <div className="wp-controls wp-glass wp-fade d-3">
          <div className="wp-controls__primary">
            <button className="wp-btn-primary" type="button" onClick={onSkipRest}>
              <WPIcon.ArrowForward />Skip Rest
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPLETE STATE
// ─────────────────────────────────────────────────────────────
const WPComplete = ({ stats, onSaveExit, onLaunchTracker, onExit }) => {
  // animated count-up for XP
  const [xp, setXp] = React.useState(0);
  React.useEffect(() => {
    const target = stats.xp;
    const dur = 1100;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const e = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - e, 3);
      setXp(Math.round(target * eased));
      if (e < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stats.xp]);

  // burst particle positions
  const burstAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <>
      <div className="wp-stamp">
        <div className="wp-stamp__l">
          <button className="wp-stamp__exit" aria-label="Exit" onClick={onExit}>
            <WPIcon.Exit />
          </button>
          <div>
            <div className="wp-stamp__eyebrow">TRAIN · DONE</div>
            <div className="wp-stamp__meta">Midrange Masterclass</div>
          </div>
        </div>
        <div className="wp-stamp__pill">
          <span className="wp-stamp__pill-dot" />
          Complete
        </div>
      </div>

      <div className="wp-complete">
        <div className="wp-check wp-fade d-1">
          <svg viewBox="0 0 168 168" className="wp-check__ring">
            <circle cx="84" cy="84" r="74" className="wp-check__ring-bg" />
            <circle cx="84" cy="84" r="74" className="wp-check__ring-fg" />
          </svg>
          <svg viewBox="0 0 90 90" className="wp-check__svg">
            <path d="M22 47 L40 64 L70 30" />
          </svg>
          <div className="wp-check__burst">
            {burstAngles.map((a, i) => {
              const rad = (a * Math.PI) / 180;
              return (
                <span
                  key={i}
                  style={{
                    "--bx": `${Math.cos(rad) * 78}px`,
                    "--by": `${Math.sin(rad) * 78}px`,
                    animationDelay: `${700 + i * 30}ms`,
                  }}
                />
              );
            })}
          </div>
        </div>

        <h1 className="wp-complete__title wp-fade d-2">Workout <em>Complete!</em></h1>
        <p className="wp-complete__sub wp-fade d-2">
          You logged <b>{stats.reps} reps</b> across <b>{stats.drills} drills</b>.
          Streak now at <b>{stats.streak} days</b>.
        </p>

        <div className="wp-stats wp-glass wp-fade d-3">
          <div className="wp-stats__cell">
            <span className="wp-stats__lbl">Total Time</span>
            <span className="wp-stats__val">{stats.minutes}<span>min</span></span>
          </div>
          <div className="wp-stats__cell">
            <span className="wp-stats__lbl">Drills</span>
            <span className="wp-stats__val">{stats.drills}<span>done</span></span>
          </div>
          <div className="wp-stats__cell">
            <span className="wp-stats__lbl">Total Reps</span>
            <span className="wp-stats__val">{stats.reps}</span>
          </div>
          <div className="wp-stats__cell">
            <span className="wp-stats__lbl">XP Earned</span>
            <span className="wp-stats__val wp-stats__val--xp">+{xp}</span>
          </div>
        </div>

        <div className="wp-complete__ctas wp-fade d-4">
          <button className="wp-cta-green" type="button" onClick={onSaveExit}>
            <WPIcon.Save />Save &amp; Exit
          </button>
          <button className="wp-cta-blue" type="button" onClick={onLaunchTracker}>
            <WPIcon.Camera />Start Shot Tracking
          </button>
        </div>
      </div>
    </>
  );
};

window.WPActive = WPActive;
window.WPRest = WPRest;
window.WPComplete = WPComplete;
window.WPIcon = WPIcon;
