// track-lab-app.jsx — Root: screen router + IOSDevice frame + Tweaks

const TL_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "screen": "lab",
  "scenario": "hot",
  "mode": "heatmap",
  "openZone": "none"
}/*EDITMODE-END*/;

const TrackLabApp = () => {
  const [tweaks, setTweak] = window.useTweaks(TL_TWEAK_DEFAULTS);
  const [highlight, setHighlight] = React.useState(null);
  const [activeNav, setActiveNav] = React.useState("track");

  const data = window.TL_DATA[tweaks.scenario] || window.TL_DATA.hot;
  const zoneOpen = tweaks.openZone === "none" ? null : tweaks.openZone;

  const Frame = window.IOSDevice;
  if (!Frame) return <div style={{ color: "#fff" }}>Loading…</div>;

  const { TweaksPanel, TweakSection, TweakSelect, TweakRadio } = window;

  const openZone = (id) => setTweak("openZone", id);
  const closeZone = () => setTweak("openZone", "none");

  return (
    <div className="stage">
      <Frame width={390} height={844} dark>
        <div style={{ position: "absolute", inset: 0, background: "#0a0907", overflow: "hidden" }}>
          {tweaks.screen === "lab" && (
            <window.TLLabScreen
              data={data}
              mode={tweaks.mode}
              setMode={(m) => setTweak("mode", m)}
              highlight={highlight}
              setHighlight={setHighlight}
              openZone={openZone}
              openSessions={() => setTweak("screen", "sessions")}
            />
          )}
          {tweaks.screen === "sessions" && (
            <window.TLSessionsScreen
              sessions={window.TL_SESSIONS}
              goBack={() => setTweak("screen", "lab")}
            />
          )}
          {tweaks.screen === "lab" && zoneOpen && (
            <window.TLZoneSheet data={data} zoneId={zoneOpen} onClose={closeZone} />
          )}
          <window.CIQBottomNav active={activeNav} onChange={setActiveNav} />
        </div>
      </Frame>

      <div className="stage__caption">Track · Lab + Sessions · §6.11</div>

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Screen">
            <TweakRadio
              label="View"
              value={tweaks.screen}
              onChange={(v) => setTweak("screen", v)}
              options={[
                { value: "lab",      label: "Lab" },
                { value: "sessions", label: "Sessions" },
              ]}
            />
          </TweakSection>
          <TweakSection title="Scenario">
            <TweakRadio
              label="7-day window"
              value={tweaks.scenario}
              onChange={(v) => setTweak("scenario", v)}
              options={[
                { value: "hot",  label: "Hot week" },
                { value: "cold", label: "Cold week" },
              ]}
            />
          </TweakSection>
          <TweakSection title="Chart mode">
            <TweakRadio
              label="Render"
              value={tweaks.mode}
              onChange={(v) => setTweak("mode", v)}
              options={[
                { value: "shots",     label: "Shots" },
                { value: "heatmap",   label: "Heat" },
                { value: "frequency", label: "Freq" },
              ]}
            />
          </TweakSection>
          <TweakSection title="Zone sheet">
            <TweakSelect
              label="Open zone"
              value={tweaks.openZone}
              onChange={(v) => setTweak("openZone", v)}
              options={[
                { value: "none", label: "Closed" },
                { value: "rw",   label: "R Wing 3" },
                { value: "lw",   label: "L Wing 3" },
                { value: "top",  label: "Top 3" },
                { value: "lc",   label: "L Corner 3" },
                { value: "rc",   label: "R Corner 3" },
                { value: "mid",  label: "Mid-range" },
                { value: "pnt",  label: "Paint" },
              ]}
            />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<TrackLabApp />);
