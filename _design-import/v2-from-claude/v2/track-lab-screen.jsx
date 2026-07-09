// track-lab-screen.jsx — Lab landing screen (Track tab default)

const TLLabScreen = ({ data, mode, setMode, highlight, setHighlight, openZone, openSessions }) => {
  const totalMade = data.zoneBreakdown.reduce((a, z) => a + z.made, 0);
  const totalAtt  = data.zoneBreakdown.reduce((a, z) => a + z.att, 0);

  return (
    <div className="tl">
      {/* STAMP */}
      <div className="tl-stamp">
        <div className="tl-stamp__l">
          <window.CIQLogo accent="#56d364" />
          <div>
            <div className="tl-stamp__eyebrow">TRACK · LAB</div>
            <div className="tl-stamp__meta">{data.label}</div>
          </div>
        </div>
        <div className="tl-stamp__pill">LIVE</div>
      </div>

      {/* SCROLL */}
      <div className="tl-scroll">

        {/* LAUNCH TRACKER — primary gateway to camera HUD */}
        <section className="tl-sec tl-sec--hero" style={{ marginTop: 0 }}>
          <div className="tl-launch">
            <span className="tl-launch__bug">
              <span className="tl-launch__bug-dot" />
              YOLOX · v0.4 · READY
            </span>

            <div className="tl-launch__head">
              <div className="tl-launch__title-block">
                <h2 className="tl-launch__title">AI Shot <em>Tracker</em></h2>
                <p className="tl-launch__sub">Real-time shot detection powered by YOLOX AI</p>
              </div>

              <div className="tl-launch__viewfinder" aria-hidden="true">
                <span className="tl-launch__vf-corner tl" />
                <span className="tl-launch__vf-corner tr" />
                <span className="tl-launch__vf-corner bl" />
                <span className="tl-launch__vf-corner br" />
                <span className="tl-launch__vf-scan" />
                <span className="tl-launch__vf-ring" />
                <svg className="tl-launch__vf-ball" viewBox="0 0 30 30">
                  <circle cx="15" cy="15" r="12" />
                  <path d="M3 15 H27" />
                  <path d="M15 3 V27" />
                  <path d="M6 6 Q15 15 6 24" />
                  <path d="M24 6 Q15 15 24 24" />
                </svg>
              </div>
            </div>

            <div className="tl-launch__ctas">
              <button className="tl-launch__cta tl-launch__cta--primary" type="button" onClick={() => { window.location.href = "camera-hud.html"; }}>
                <svg viewBox="0 0 20 20" fill="none">
                  <path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h2l1-1.5h5l1 1.5h2A1.5 1.5 0 0 1 17 6.5v8A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                  <circle cx="10" cy="10.5" r="3.2" stroke="currentColor" strokeWidth="1.6"/>
                </svg>
                Launch Camera
              </button>
              <button className="tl-launch__cta tl-launch__cta--ghost" type="button" onClick={() => { window.location.href = "camera-hud.html?mode=upload"; }}>
                <svg viewBox="0 0 20 20" fill="none">
                  <path d="M10 13V3M10 3l-3.5 3.5M10 3l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.5 12.5v2A2.5 2.5 0 0 0 6 17h8a2.5 2.5 0 0 0 2.5-2.5v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                Upload Video
              </button>
            </div>

            <button className="tl-launch__last" type="button" onClick={openSessions}>
              <span className="tl-launch__last-l">
                <span className="tl-launch__last-dot" />
                <span className="tl-launch__last-lbl">Last Session</span>
                <span className="tl-launch__last-val"><em>66%</em> FG<span className="tl-launch__last-ago">· 3 days ago</span></span>
              </span>
              <span className="tl-launch__last-arrow">›</span>
            </button>
          </div>

          {/* QUICK STATS — horizontal scroll pills */}
          <div className="tl-quickstats">
            <div className="tl-quickstat tl-quickstat--accent">
              <span className="tl-quickstat__lbl">Sessions / wk</span>
              <span className="tl-quickstat__val">6</span>
            </div>
            <div className="tl-quickstat">
              <span className="tl-quickstat__lbl">Best Streak</span>
              <span className="tl-quickstat__val">8</span>
            </div>
            <div className="tl-quickstat">
              <span className="tl-quickstat__lbl">Total Shots</span>
              <span className="tl-quickstat__val">1,247</span>
            </div>
            <div className="tl-quickstat">
              <span className="tl-quickstat__lbl">Avg / Sesh</span>
              <span className="tl-quickstat__val">208</span>
            </div>
          </div>
        </section>

        {/* HERO FG% */}
        <section className="tl-sec">
          <div className="tl-hero">
            <div className="tl-hero__lbl">FG% · {data.label.toUpperCase()}</div>
            <div className="tl-hero__num">
              <span className="tl-hero__int">{data.fg}</span>
              <span className="tl-hero__pct">%</span>
            </div>
            <div className={"tl-hero__delta " + (data.fgDelta >= 0 ? "is-up" : "is-down")}>
              <span className="tl-hero__arrow">{data.fgDelta >= 0 ? "▲" : "▼"}</span>
              {data.fgDelta >= 0 ? "+" : ""}{data.fgDelta} PTS VS PRIOR 7D
              <span className="tl-hero__sub">· {totalMade}/{totalAtt} · {data.sessions} SESSIONS</span>
            </div>
          </div>
        </section>

        {/* MODE TOGGLE */}
        <section className="tl-sec">
          <div className="tl-mode" role="tablist">
            {[
              { id: "shots",     label: "SHOTS" },
              { id: "heatmap",   label: "HEATMAP" },
              { id: "frequency", label: "FREQUENCY" },
            ].map(m => (
              <button
                key={m.id}
                role="tab"
                className={"tl-mode__btn" + (mode === m.id ? " is-active" : "")}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </section>

        {/* COURT */}
        <section className="tl-sec" style={{ marginTop: 0 }}>
          <div className={"tl-court-card" + (mode === "heatmap" ? " is-heat" : "")}>
            <div className="tl-court-card__head">
              <div className="tl-court-card__lbl">
                {mode === "shots" && "ALL SHOTS · 7D"}
                {mode === "heatmap" && "ZONE HEAT · FG%"}
                {mode === "frequency" && "VOLUME · ATTEMPTS"}
              </div>
              <div className="tl-court-card__hint">TAP A ZONE</div>
            </div>
            <window.TLShotChart
              shots={data.shots}
              zones={data.zoneBreakdown}
              mode={mode}
              highlight={highlight}
              hotZone={data.hotZone}
              onZoneTap={(id) => { setHighlight(id); openZone(id); }}
              animate={mode === "shots"}
            />
            <div className="tl-court-card__legend">
              {mode === "heatmap" && (<>
                <span className="tl-court-card__lk"><span className="tl-court-card__sw" style={{background:"rgba(86,211,100,0.45)"}}/>HOT</span>
                <span className="tl-court-card__lk"><span className="tl-court-card__sw" style={{background:"rgba(245,166,35,0.30)"}}/>NEUTRAL</span>
                <span className="tl-court-card__lk"><span className="tl-court-card__sw" style={{background:"rgba(232,64,64,0.40)"}}/>COLD</span>
              </>)}
              {mode === "frequency" && (<>
                <span className="tl-court-card__lk"><span className="tl-court-card__sw" style={{background:"rgba(255,90,60,0.10)"}}/>FEW</span>
                <span className="tl-court-card__lk"><span className="tl-court-card__sw" style={{background:"rgba(255,90,60,0.30)"}}/>MED</span>
                <span className="tl-court-card__lk"><span className="tl-court-card__sw" style={{background:"rgba(255,90,60,0.50)"}}/>MANY</span>
              </>)}
              {mode === "shots" && (<>
                <span className="tl-court-card__lk"><span style={{width:8,height:8,borderRadius:999,background:"#56d364",display:"inline-block",boxShadow:"0 0 6px rgba(86,211,100,0.6)"}}/>MADE</span>
                <span className="tl-court-card__lk"><span style={{width:8,height:8,borderRadius:999,border:"1.4px solid #e84040",display:"inline-block"}}/>MISS</span>
              </>)}
            </div>
          </div>
        </section>

        {/* 7-ZONE STRIP */}
        <section className="tl-sec">
          <div className="tl-zones__lbl">BY ZONE · TAP FOR DETAIL</div>
          <div className="tl-zones__row">
            {data.zoneBreakdown.map(z => {
              const fg = Math.round((z.made / z.att) * 100) || 0;
              return (
                <button
                  key={z.id}
                  className={"tl-zone" + (highlight === z.id ? " is-active" : "")}
                  onClick={() => { setHighlight(z.id); openZone(z.id); }}
                >
                  <span className="tl-zone__name">{z.name}</span>
                  <span className="tl-zone__fg">{fg}<span>%</span></span>
                  <span className="tl-zone__att">{z.made}/{z.att}</span>
                  <span className={"tl-zone__delta " + (z.delta >= 0 ? "is-up" : "is-down")}>
                    {z.delta >= 0 ? "▲" : "▼"} {Math.abs(z.delta)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* SUMMARY STRIP */}
        <section className="tl-sec">
          <div className="tl-board">
            <div className="tl-board__cell">
              <span className="tl-board__lbl">PPS</span>
              <span className="tl-board__big">{data.pps.toFixed(2)}</span>
            </div>
            <div className="tl-board__cell">
              <span className="tl-board__lbl">BEST RUN</span>
              <span className="tl-board__big">{data.bestStreak}<span>·in row</span></span>
            </div>
            <div className="tl-board__cell">
              <span className="tl-board__lbl">SESSIONS</span>
              <span className="tl-board__big">{data.sessions}<span>·7d</span></span>
            </div>
          </div>
        </section>

        {/* SESSIONS XREF */}
        <section className="tl-sec">
          <button className="tl-xref" onClick={openSessions}>
            <span className="tl-xref__icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 3h10M2 7h10M2 11h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </span>
            <span className="tl-xref__body">
              <span className="tl-xref__lbl">SESSIONS · LAST 7D</span>
              <span className="tl-xref__sub">{data.sessions} sessions · {totalMade}/{totalAtt} attempts</span>
            </span>
            <span className="tl-xref__arrow">›</span>
          </button>
        </section>

        <div className="tl-foot">CourtIQ · Track · Lab</div>
      </div>
    </div>
  );
};

window.TLLabScreen = TLLabScreen;
