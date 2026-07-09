// home-app.jsx — Root: Home tab + IOSDevice frame + BottomNav + Tweaks

const HOME_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tab": "today",
  "hour": 9,
  "weeklyGoal": 3,
  "hasSessions": true,
  "loading": false,
  "settingsOpen": false
}/*EDITMODE-END*/;

const HomeApp = () => {
  const [tweaks, setTweak] = window.useTweaks(HOME_TWEAK_DEFAULTS);
  const [activeNav, setActiveNav] = React.useState("home");
  const [logState, setLogState] = React.useState({
    type: "Practice",
    duration: 60,
    intensity: "Medium",
    notes: "",
  });
  const [calSelected, setCalSelected] = React.useState(4);

  const Frame = window.IOSDevice;
  if (!Frame) return <div style={{ color: "#fff" }}>Loading…</div>;

  const { TweaksPanel, TweakSection, TweakRadio, TweakSlider, TweakToggle } = window;

  const handleAction = (id) => {
    const map = {
      drills:   "drill-library.html",
      track:    "camera-hud.html",
      coach:    "coach-tab.html",
      workout:  "workout-player.html",
      me:       "me-tab.html",
    };
    const dest = map[id];
    if (dest) { window.location.href = dest; return; }
    alert(`Routes to ${id}`);
  };

  return (
    <div className="stage">
      <Frame width={390} height={844} dark>
        <div style={{ position: "absolute", inset: 0, background: "#06080c", overflow: "hidden" }}>
          {tweaks.loading ? (
            <div className="ho" style={{ position: "absolute", inset: 0 }}>
              <div className="ho-stamp">
                <div className="ho-stamp__l">
                  <window.CIQLogo accent="#f5a623" />
                  <div>
                    <div className="ho-stamp__eyebrow">HOME · TODAY</div>
                    <div className="ho-stamp__meta">LOADING…</div>
                  </div>
                </div>
                <span className="ciq-skeleton" style={{ width: 38, height: 38, borderRadius: "50%" }} />
              </div>
              <div className="ho-scroll" style={{ paddingTop: 6 }}>
                <window.CIQSkeleton rows={5} />
              </div>
            </div>
          ) : (
          <window.HomeScreen
            tab={tweaks.tab}
            setTab={(t) => setTweak("tab", t)}
            hour={tweaks.hour}
            weeklyGoal={tweaks.weeklyGoal}
            hasSessions={!!tweaks.hasSessions}
            logState={logState}
            setLogState={setLogState}
            calSelected={calSelected}
            setCalSelected={setCalSelected}
            onOpenSettings={() => setTweak("settingsOpen", true)}
            onOpenChallenge={() => { window.location.href = "workout-player.html"; }}
            onOpenCoach={() => { window.location.href = "coach-tab.html"; }}
            onOpenAction={handleAction}
            onOpenSession={(id) => { window.location.href = "post-session.html"; }}
            onLogSession={() => {
              alert("Session logged. +20 XP earned.");
              setTweak("tab", "today");
            }}
          />
          )}
          <window.CIQBottomNav active={activeNav} onChange={(id) => { setActiveNav(id); window.ciqNavTo(id, "home"); }}/>

          <window.CIQBottomSheet
            open={!!tweaks.settingsOpen}
            onClose={() => setTweak("settingsOpen", false)}
            title="Home Settings"
            accent="#f5a623"
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", color: "rgba(240,236,228,0.62)", fontWeight: 700, textTransform: "uppercase", margin: "12px 4px 6px" }}>Daily Greeting</div>
            <div className="me-set-row is-button">
              <span className="me-set-row__lbl">Time-of-day greeting</span>
              <span className="me-set-row__val">On</span>
              <span className="me-set-row__chev"><window.HomeIcon.Arrow width="10" height="10"/></span>
            </div>
            <div className="me-set-row is-button">
              <span className="me-set-row__lbl">Daily challenge reminder</span>
              <span className="me-set-row__val">9:00 AM</span>
              <span className="me-set-row__chev"><window.HomeIcon.Arrow width="10" height="10"/></span>
            </div>
            <div className="me-set-row is-button">
              <span className="me-set-row__lbl">Weekly goal</span>
              <span className="me-set-row__val">5 sessions</span>
              <span className="me-set-row__chev"><window.HomeIcon.Arrow width="10" height="10"/></span>
            </div>
          </window.CIQBottomSheet>
        </div>
      </Frame>

      <div className="stage__caption">Home · Today + Log + Calendar · §6.10</div>

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Sub-page">
            <TweakRadio
              label="Active page"
              value={tweaks.tab}
              onChange={(v) => setTweak("tab", v)}
              options={[
                { value: "today",    label: "Today"    },
                { value: "log",      label: "Log"      },
                { value: "calendar", label: "Calendar" },
              ]}
            />
          </TweakSection>
          <TweakSection title="Time of day">
            <TweakSlider
              label="Hour"
              value={tweaks.hour}
              onChange={(v) => setTweak("hour", v)}
              min={0} max={23} step={1}
            />
          </TweakSection>
          <TweakSection title="Weekly progress">
            <TweakSlider
              label="Sessions this week"
              value={tweaks.weeklyGoal}
              onChange={(v) => setTweak("weeklyGoal", v)}
              min={0} max={5} step={1}
            />
          </TweakSection>
          <TweakSection title="Sessions">
            <TweakToggle
              label="Has sessions this week"
              value={!!tweaks.hasSessions}
              onChange={(v) => setTweak("hasSessions", v)}
            />
            <TweakToggle
              label="Loading state"
              value={!!tweaks.loading}
              onChange={(v) => setTweak("loading", v)}
            />
          </TweakSection>
          <TweakSection title="Settings sheet">
            <TweakToggle
              label="Open settings"
              value={!!tweaks.settingsOpen}
              onChange={(v) => setTweak("settingsOpen", v)}
            />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<HomeApp />);
