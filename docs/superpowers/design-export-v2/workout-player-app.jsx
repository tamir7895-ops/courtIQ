// workout-player-app.jsx — state machine + IOS frame + Tweaks

const { useState: useStateWP, useEffect: useEffectWP, useRef: useRefWP, useMemo: useMemoWP, useCallback: useCallbackWP } = React;

// Workout definition — matches "Midrange Masterclass" from drill-library
const WORKOUT = {
  name: "Midrange Masterclass",
  drills: [
    { id: "warmup", name: "Elbow Pull-Up Ladder",  lane: "Warm-up",      sets: 2, reps: 8,  setSec: 60, restSec: 25, duration: 8  },
    { id: "form",   name: "Free-Throw Series",     lane: "Form",         sets: 3, reps: 10, setSec: 75, restSec: 30, duration: 10 },
    { id: "spot",   name: "Spot-Up Mid Range",     lane: "Catch & Shoot",sets: 4, reps: 10, setSec: 90, restSec: 30, duration: 12 },
    { id: "press",  name: "Pressure Finisher",     lane: "Streak",       sets: 1, reps: 10, setSec: 60, restSec: 0,  duration: 5  },
  ],
};

const WP_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "state": "active",
  "drillIdx": 2,
  "setIdx": 2,
  "playing": false,
  "showShareToast": false
}/*EDITMODE-END*/;

const WorkoutPlayerApp = () => {
  const [tweaks, setTweak] = window.useTweaks(WP_TWEAK_DEFAULTS);

  // live runtime state — derived from tweaks on mount, then runs on its own
  const drillIdx = Math.min(tweaks.drillIdx, WORKOUT.drills.length - 1);
  const drill = WORKOUT.drills[drillIdx];
  const setTotal = drill.sets;
  const setIdx = Math.min(tweaks.setIdx, setTotal);

  const [rep, setRep] = useStateWP(3);
  const [timeLeft, setTimeLeft] = useStateWP(tweaks.state === "rest" ? drill.restSec : drill.setSec);
  const [paused, setPaused] = useStateWP(!tweaks.playing);

  const state = tweaks.state; // "active" | "rest" | "complete"

  // sync runtime when scenario tweaks change
  useEffectWP(() => {
    if (state === "rest")    setTimeLeft(drill.restSec);
    else if (state === "active") setTimeLeft(Math.floor(drill.setSec * 0.55));
  }, [state, tweaks.drillIdx, tweaks.setIdx]);

  // tick — only when playing & not paused, and in active/rest
  useEffectWP(() => {
    if (state === "complete") return;
    if (paused) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t > 1) return t - 1;
        // hit zero — auto-advance
        if (state === "active") {
          // end of set → rest
          setTweak("state", "rest");
          return drill.restSec || 1;
        } else if (state === "rest") {
          // end of rest → next set / next drill
          const nextSet = setIdx + 1;
          if (nextSet <= setTotal) {
            setTweak({ state: "active", setIdx: nextSet });
            return drill.setSec;
          }
          // next drill
          const nextDrill = drillIdx + 1;
          if (nextDrill < WORKOUT.drills.length) {
            const nd = WORKOUT.drills[nextDrill];
            setTweak({ state: "active", drillIdx: nextDrill, setIdx: 1 });
            return nd.setSec;
          }
          // done
          setTweak("state", "complete");
          return 0;
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, state, drill.setSec, drill.restSec, setIdx, setTotal, drillIdx]);

  // handlers
  const onTogglePause = useCallbackWP(() => {
    setPaused(p => {
      setTweak("playing", p); // playing flips opposite of paused
      return !p;
    });
  }, [setTweak]);

  const onSkipRep = useCallbackWP(() => {
    setRep(r => Math.min(r + 1, drill.reps));
  }, [drill.reps]);

  const onSkipDrill = useCallbackWP(() => {
    const nextDrill = drillIdx + 1;
    if (nextDrill < WORKOUT.drills.length) {
      const nd = WORKOUT.drills[nextDrill];
      setTweak({ drillIdx: nextDrill, setIdx: 1, state: "active" });
      setTimeLeft(nd.setSec);
      setRep(1);
    } else {
      setTweak("state", "complete");
    }
  }, [drillIdx, setTweak]);

  const onSkipRest = useCallbackWP(() => {
    const nextSet = setIdx + 1;
    if (nextSet <= setTotal) {
      setTweak({ state: "active", setIdx: nextSet });
      setTimeLeft(drill.setSec);
      setRep(1);
    } else {
      const nextDrill = drillIdx + 1;
      if (nextDrill < WORKOUT.drills.length) {
        const nd = WORKOUT.drills[nextDrill];
        setTweak({ state: "active", drillIdx: nextDrill, setIdx: 1 });
        setTimeLeft(nd.setSec);
        setRep(1);
      } else {
        setTweak("state", "complete");
      }
    }
  }, [setIdx, setTotal, drillIdx, drill.setSec, setTweak]);

  const onExit = () => { window.location.href = "drill-library.html"; };

  // Next drill for rest state
  const nextDrillObj = drillIdx + 1 < WORKOUT.drills.length
    ? WORKOUT.drills[drillIdx + 1]
    : null;
  // Next set in same drill — preferred for rest "up next"
  const nextSetIsSameDrill = setIdx + 1 <= setTotal;
  const restUpNext = nextSetIsSameDrill
    ? { name: drill.name, sets: 1, reps: drill.reps, duration: Math.round(drill.duration / setTotal), label: "Next set" }
    : (nextDrillObj && { name: nextDrillObj.name, sets: nextDrillObj.sets, reps: nextDrillObj.reps, duration: nextDrillObj.duration, label: "Next drill" });

  // computed stats for complete state
  const completeStats = useMemoWP(() => {
    const totalReps = WORKOUT.drills.reduce((a, d) => a + d.sets * d.reps, 0);
    const totalMin = WORKOUT.drills.reduce((a, d) => a + d.duration, 0);
    return {
      minutes: totalMin,
      drills: WORKOUT.drills.length,
      reps: totalReps,
      xp: 200,
      streak: 6,
    };
  }, []);

  const Frame = window.IOSDevice;
  if (!Frame) return <div style={{color:"#fff"}}>Loading…</div>;

  const { TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakNumber } = window;

  const className = "wp is-" + state;

  // Drill descriptor for child components
  const drillForView = {
    idx: drillIdx + 1,
    name: drill.name,
    lane: drill.lane.toUpperCase(),
    cue: state === "active"
      ? "Square shoulders to rim · follow through · hold."
      : "Walk it off · sip water · stay loose.",
  };

  return (
    <div className="stage">
      <Frame width={390} height={844} dark>
        <div style={{ position: "absolute", inset: 0 }}>
          <div className={className} key={state /* re-fade between states */}>
            {state === "active" && (
              <window.WPActive
                drill={drillForView}
                setIdx={setIdx}
                setTotal={setTotal}
                rep={rep}
                repTotal={drill.reps}
                timeLeft={timeLeft}
                setLen={drill.setSec}
                paused={paused}
                onTogglePause={onTogglePause}
                onSkipRep={onSkipRep}
                onSkipDrill={onSkipDrill}
                onExit={onExit}
              />
            )}
            {state === "rest" && (
              <window.WPRest
                drill={drillForView}
                setIdx={setIdx}
                setTotal={setTotal}
                timeLeft={timeLeft}
                restLen={drill.restSec || 30}
                nextDrill={restUpNext}
                onSkipRest={onSkipRest}
                onExit={onExit}
              />
            )}
            {state === "complete" && (
              <window.WPComplete
                stats={completeStats}
                onSaveExit={() => { window.location.href = "drill-library.html"; }}
                onLaunchTracker={() => { window.location.href = "track-lab.html"; }}
                onExit={onExit}
              />
            )}
          </div>
        </div>
      </Frame>

      <div className="stage__caption">Train · Workout Player · §6.13</div>

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection label="State">
            <TweakRadio
              label="Phase"
              value={state}
              onChange={(v) => setTweak("state", v)}
              options={[
                { value: "active",   label: "Active" },
                { value: "rest",     label: "Rest" },
                { value: "complete", label: "Done" },
              ]}
            />
            <TweakToggle
              label="Run timer"
              value={!paused}
              onChange={(v) => { setPaused(!v); setTweak("playing", v); }}
            />
          </TweakSection>
          <TweakSection label="Position">
            <TweakSelect
              label="Drill"
              value={String(drillIdx)}
              onChange={(v) => setTweak("drillIdx", Number(v))}
              options={WORKOUT.drills.map((d, i) => ({ value: String(i), label: `${i+1}. ${d.name}` }))}
            />
            <TweakNumber
              label="Set"
              value={setIdx}
              min={1}
              max={setTotal}
              onChange={(v) => setTweak("setIdx", v)}
            />
            <TweakNumber
              label="Rep"
              value={rep}
              min={1}
              max={drill.reps}
              onChange={(v) => setRep(v)}
            />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<WorkoutPlayerApp />);
