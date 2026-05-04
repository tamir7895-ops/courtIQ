// coach-app.jsx — Root: Coach tab + IOSDevice frame + BottomNav + Settings sheet + Tweaks

const COACH_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tab": "coach",
  "trend": "up",
  "openHistId": "w-may-4",
  "settingsOpen": false,
  "briefingOpen": false,
  "chatOpen": false
}/*EDITMODE-END*/;

const CoachApp = () => {
  const [tweaks, setTweak] = window.useTweaks(COACH_TWEAK_DEFAULTS);
  const [activeNav, setActiveNav] = React.useState("coach");
  const [sliders, setSliders] = React.useState({ shoot: 7, handle: 6, def: 5, athl: 8 });

  const Frame = window.IOSDevice;
  if (!Frame) return <div style={{ color: "#fff" }}>Loading…</div>;

  const { TweaksPanel, TweakSection, TweakRadio, TweakToggle } = window;

  // Apply trend variant by mutating insight before render
  const baseTrend = window.COACH_INSIGHT && window.COACH_INSIGHT.trend;
  if (baseTrend) {
    if (tweaks.trend === "down") {
      window.COACH_INSIGHT.trend = {
        ...baseTrend,
        score: 64,
        delta: "-5",
        dir: "down",
        label: "TRENDING DOWN",
        weeks: [
          { lbl: "W1", val: 78 },
          { lbl: "W2", val: 74 },
          { lbl: "W3", val: 69 },
          { lbl: "W4", val: 64 },
        ],
      };
    } else {
      window.COACH_INSIGHT.trend = {
        ...baseTrend,
        score: 78,
        delta: "+6",
        dir: "up",
        label: "TRENDING UP",
        weeks: [
          { lbl: "W1", val: 64 },
          { lbl: "W2", val: 69 },
          { lbl: "W3", val: 72 },
          { lbl: "W4", val: 78 },
        ],
      };
    }
  }

  const setSettingsOpen = (v) => setTweak("settingsOpen", v);
  const briefingOpen = !!tweaks.briefingOpen;
  const chatOpen = !!tweaks.chatOpen;

  return (
    <div className="stage">
      <Frame width={390} height={844} dark>
        <div style={{ position: "absolute", inset: 0, background: "#06080c", overflow: "hidden" }}>
          <window.CoachScreen
            tab={tweaks.tab}
            setTab={(t) => setTweak("tab", t)}
            sliders={sliders}
            setSliders={setSliders}
            openHistId={tweaks.openHistId}
            setOpenHistId={(v) => setTweak("openHistId", v)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenBriefing={() => setTweak("briefingOpen", true)}
            onStartChat={() => setTweak("chatOpen", true)}
            onSubmitUpdate={() => {
              setTweak("tab", "coach");
              alert("Coach is reviewing your update… new briefing in a moment.");
            }}
          />
          <window.CIQBottomNav active={activeNav} onChange={setActiveNav} />

          <window.CIQBottomSheet
            open={tweaks.settingsOpen}
            onClose={() => setSettingsOpen(false)}
            title="Coach Settings"
            accent="#bc8cff"
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", color: "rgba(240,236,228,0.62)", fontWeight: 700, textTransform: "uppercase", margin: "12px 4px 6px" }}>Coaching Style</div>
            <div className="me-set-row is-button">
              <span className="me-set-row__lbl">Tone</span>
              <span className="me-set-row__val">Direct</span>
              <span className="me-set-row__chev"><window.CoachIcon.Arrow width="10" height="10"/></span>
            </div>
            <div className="me-set-row is-button">
              <span className="me-set-row__lbl">Briefing Cadence</span>
              <span className="me-set-row__val">Weekly</span>
              <span className="me-set-row__chev"><window.CoachIcon.Arrow width="10" height="10"/></span>
            </div>
            <div className="me-set-row is-button">
              <span className="me-set-row__lbl">Notification Day</span>
              <span className="me-set-row__val">Sunday</span>
              <span className="me-set-row__chev"><window.CoachIcon.Arrow width="10" height="10"/></span>
            </div>
          </window.CIQBottomSheet>

          {/* BRIEFING SHEET — full breakdown */}
          <window.CIQBottomSheet
            open={briefingOpen}
            onClose={() => setTweak("briefingOpen", false)}
            title="Full Briefing"
            accent="#bc8cff"
          >
            <window.CoachBriefingSheetBody />
          </window.CIQBottomSheet>

          {/* CHAT OVERLAY — placeholder full-screen panel */}
          {chatOpen && (
            <div
              style={{
                position: "absolute", inset: 0, zIndex: 250,
                background: "rgba(6,8,12,0.92)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                display: "flex", flexDirection: "column",
                animation: "ciq-sheet-fade 220ms ease-out",
                fontFamily: "'JetBrains Mono', monospace",
                color: "#f0ece4",
              }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "60px 18px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: "radial-gradient(circle at 30% 25%, #2a1d3d 0%, #16091f 100%)",
                    border: "2px solid #bc8cff",
                    display: "grid", placeItems: "center",
                    boxShadow: "0 0 18px rgba(188,140,255,0.40)",
                  }}>
                    <span style={{ fontFamily: "'Anton', sans-serif", fontStyle: "italic", fontSize: 18, color: "#bc8cff", lineHeight: 1 }}>C</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: "0.22em", color: "#bc8cff", fontWeight: 700 }}>COACH · CHAT</div>
                    <div style={{ fontSize: 13, color: "#f0ece4", marginTop: 2, letterSpacing: "0.04em" }}>Coach Whitfield</div>
                  </div>
                </div>
                <button
                  onClick={() => setTweak("chatOpen", false)}
                  style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: "rgba(20,24,32,0.78)",
                    border: "1px solid rgba(240,236,228,0.14)",
                    color: "#f0ece4",
                    display: "grid", placeItems: "center",
                    cursor: "pointer",
                  }}
                  aria-label="Close chat"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: "24px 32px", textAlign: "center", gap: 16,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "rgba(188,140,255,0.14)",
                  border: "1.5px solid #bc8cff",
                  color: "#bc8cff",
                  display: "grid", placeItems: "center",
                }}>
                  <window.CoachIcon.Spark width={28} height={28} />
                </div>
                <h2 style={{
                  fontFamily: "'Anton', sans-serif", fontStyle: "italic",
                  fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.005em",
                  color: "#f0ece4", textTransform: "uppercase",
                  textWrap: "balance", maxWidth: "20ch",
                }}>Chat coming next wave.</h2>
                <p style={{
                  fontFamily: "'Lexend', sans-serif", fontSize: 13.5,
                  lineHeight: 1.5, color: "rgba(240,236,228,0.62)",
                  maxWidth: "30ch",
                }}>This is the entry point. The conversational chat experience ships in Wave 9.</p>
                <div style={{
                  marginTop: 10, fontSize: 9, letterSpacing: "0.22em",
                  color: "rgba(240,236,228,0.32)", fontWeight: 700,
                }}>§6.14.CHAT · STUB</div>
              </div>
            </div>
          )}
        </div>
      </Frame>

      <div className="stage__caption">Coach · Briefing + Update + History · §6.14</div>

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Sub-page">
            <TweakRadio
              label="Active page"
              value={tweaks.tab}
              onChange={(v) => setTweak("tab", v)}
              options={[
                { value: "coach",   label: "Coach"   },
                { value: "update",  label: "Update"  },
                { value: "history", label: "History" },
              ]}
            />
          </TweakSection>
          <TweakSection title="Trend variant">
            <TweakRadio
              label="Direction"
              value={tweaks.trend}
              onChange={(v) => setTweak("trend", v)}
              options={[
                { value: "up",   label: "Up"   },
                { value: "down", label: "Down" },
              ]}
            />
          </TweakSection>
          <TweakSection title="Settings sheet">
            <TweakToggle
              label="Open settings"
              value={tweaks.settingsOpen}
              onChange={(v) => setTweak("settingsOpen", v)}
            />
          </TweakSection>
          <TweakSection title="Overlays">
            <TweakToggle
              label="Open full briefing"
              value={tweaks.briefingOpen}
              onChange={(v) => setTweak("briefingOpen", v)}
            />
            <TweakToggle
              label="Open chat"
              value={tweaks.chatOpen}
              onChange={(v) => setTweak("chatOpen", v)}
            />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<CoachApp />);
