// post-session-app.jsx
const { useState: useStateApp, useEffect: useEffectApp } = React;

const PS_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "scenario": "hot",
  "animateShots": true,
  "showShareToast": false
}/*EDITMODE-END*/;

const PostSessionApp = () => {
  const [tweaks, setTweak] = window.useTweaks(PS_TWEAK_DEFAULTS);
  const [toast, setToast] = useStateApp(null);
  const [activeNav, setActiveNav] = useStateApp("home");

  const session = window.POST_SESSIONS[tweaks.scenario] || window.POST_SESSIONS.hot;

  // re-mount when scenario or animation toggle changes, so chart restages
  const key = `${tweaks.scenario}-${tweaks.animateShots ? "anim" : "static"}`;

  const handleShare = () => {
    setToast("Saved to camera roll");
    setTimeout(() => setToast(null), 2200);
  };

  const Frame = window.IOSDevice;
  if (!Frame) return <div style={{color:"#fff"}}>Loading…</div>;

  const { TweaksPanel, TweakSection, TweakSelect, TweakToggle } = window;

  return (
    <div className="stage">
      <Frame width={390} height={844} dark>
        <div style={{ position: "absolute", inset: 0, background: "#0a0907", overflow: "hidden" }}>
          <window.PostSessionRecap
            key={key}
            session={{ ...session, _animate: tweaks.animateShots }}
            date="TUE · NOV 12"
            onClose={() => setToast("Closed (demo)")}
            onShare={handleShare}
          />
          {toast && (
            <div className="ps-toast">{toast}</div>
          )}
          <window.CIQBottomNav active={activeNav} onChange={setActiveNav} />
        </div>
      </Frame>

      <div className="stage__caption">Camera · Post-Session Recap · §6.10</div>

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Session">
            <TweakSelect
              label="Scenario"
              value={tweaks.scenario}
              onChange={(v) => setTweak("scenario", v)}
              options={[
                { value: "hot",  label: "Heating Up · 67% (+9)" },
                { value: "cold", label: "Cold Night · 31% (-12)" },
              ]}
            />
            <TweakToggle
              label="Animate shot chart"
              value={tweaks.animateShots}
              onChange={(v) => setTweak("animateShots", v)}
            />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<PostSessionApp />);
