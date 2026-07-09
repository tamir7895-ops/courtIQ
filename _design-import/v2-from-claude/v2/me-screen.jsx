// me-screen.jsx — Me tab single scrollable screen

const MeSettingsIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MeScreen = ({
  tab, setTab,
  onCustomize, onLeaderboard, onSendChallenge, onCopyLink, onOpenSettings,
  // shop props
  shopCategory, setShopCategory,
  shopWallet, shopOwned, shopEquipped,
  onTapShopItem, onEarn,
}) => {
  const p = window.ME_PROFILE;
  const trophies = window.ME_TROPHIES;
  const lb = window.ME_LEADERBOARD;
  const earned = trophies.filter(t => t.earned).length;

  const fmt = (n) => n.toLocaleString();

  return (
    <div className="me">
      {/* STAMP */}
      <div className="me-stamp">
        <div className="me-stamp__l">
          <window.CIQLogo accent="#2dd4bf" />
          <div>
            <div className="me-stamp__eyebrow">ME · IDENTITY</div>
            <div className="me-stamp__meta">LV {p.level} · {fmt(p.totalXP)} XP</div>
          </div>
        </div>
        <button className="me-stamp__icon-btn me-stamp__gear" onClick={onOpenSettings} aria-label="Settings">
          <MeSettingsIcon width="18" height="18" />
        </button>
      </div>

      {/* SUB-NAV CHIPS */}
      <div className="me-subnav">
        {[
          { id: "profile",  label: "Profile" },
          { id: "trophies", label: "Trophies" },
          { id: "social",   label: "Social" },
          { id: "shop",     label: "Shop" },
        ].map(c => (
          <button
            key={c.id}
            className={"me-chip" + (tab === c.id ? " is-active" : "")}
            onClick={() => setTab(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* SCROLL */}
      <div className="me-scroll">
        {tab === "shop" ? (
          <window.MeShop
            category={shopCategory}
            setCategory={setShopCategory}
            wallet={shopWallet}
            level={p.level}
            ownedSet={shopOwned}
            equippedSet={shopEquipped}
            onTapItem={onTapShopItem}
            onEarn={onEarn}
          />
        ) : (
        <React.Fragment>
        {/* 1 · PROFILE HERO */}
        <section className="me-sec me-sec--first">
          <div className="me-hero">
            <svg className="me-hero__court" viewBox="0 0 500 470" preserveAspectRatio="xMidYMid meet">
              <rect width="500" height="470" rx="4" className="court-bg"/>
              <rect x="170" y="0" width="160" height="190" className="paint-fill"/>
              <rect x="170" y="0" width="160" height="190" className="cl"/>
              <circle cx="250" cy="190" r="60" className="cld"/>
              <circle cx="250" cy="52.5" r="237.5" className="cl" clipPath="inset(142px 0 0 0)" style={{ clipPath: "inset(142px 0 0 0)" }}/>
              <circle cx="250" cy="52.5" r="40" className="cl"/>
              <line x1="220" y1="40" x2="280" y2="40" className="backboard"/>
              <circle cx="250" cy="52.5" r="7.5" className="rim"/>
            </svg>
            <button className="me-avatar" onClick={onCustomize} aria-label="Customize avatar">
              <window.MeAvatar seed="alex-rivera-1" size={84} />
              <span className="me-avatar__edit">
                <window.MeIcon.Customize width="12" height="12" />
              </span>
            </button>
            <div className="me-hero__name">{p.name}</div>
            <div className="me-hero__meta">
              <span className="me-hero__badge">
                <span className="me-hero__badge-dot" />
                {p.position.toUpperCase()}
              </span>
              <span className="me-hero__badge me-hero__badge--accent">
                <span className="me-hero__badge-dot" />
                LEVEL {p.level}
              </span>
            </div>
            <div className="me-hero__hint">TAP AVATAR TO CUSTOMIZE</div>
          </div>
        </section>

        {/* 2 · STAT STRIP */}
        <section className="me-sec">
          <div className="me-stats">
            <div className="me-stat me-glass">
              <div className="me-stat__icon"><window.MeIcon.Sessions /></div>
              <div className="me-stat__num">{p.stats.sessions}</div>
              <div className="me-stat__lbl">Sessions</div>
            </div>
            <div className="me-stat me-glass">
              <div className="me-stat__icon me-stat__icon--fire"><window.MeIcon.Flame /></div>
              <div className="me-stat__num">{p.stats.streak}<span>DAY</span></div>
              <div className="me-stat__lbl">Streak</div>
            </div>
            <div className="me-stat me-glass">
              <div className="me-stat__icon"><window.MeIcon.Bolt /></div>
              <div className="me-stat__num">{(p.stats.xp / 1000).toFixed(1)}<span>K</span></div>
              <div className="me-stat__lbl">Total XP</div>
            </div>
          </div>
        </section>

        {/* 3 · ARCHETYPE CARD */}
        <section className="me-sec">
          <div className="me-sec__head">
            <div className="me-sec__title">Archetype</div>
            <div className="me-sec__more">{p.archetype.match}% MATCH</div>
          </div>
          <div className="me-arch me-glass">
            <div className="me-arch__head">
              <div>
                <div className="me-arch__eyebrow">PLAYER TYPE</div>
                <h2 className="me-arch__name">{p.archetype.name}</h2>
              </div>
              <div className="me-arch__match">A+</div>
            </div>

            <div className="me-arch__body">
              <window.MeRadar skills={p.archetype.skills} size={180} />
              <div className="me-arch__skills">
                {p.archetype.skills.map(s => {
                  const isTop = s.val >= 85;
                  return (
                    <div key={s.id} className="me-arch__skill">
                      <span className="me-arch__skill-name">{s.name}</span>
                      <span className={"me-arch__skill-val" + (isTop ? " me-arch__skill-val--top" : "")}>
                        {s.val}
                      </span>
                      <div className="me-arch__skill-bar">
                        <div className="me-arch__skill-fill" style={{ width: `${s.val}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="me-arch__traits">
              {p.archetype.traits.map(t => (
                <span key={t} className="me-trait">{t}</span>
              ))}
            </div>
          </div>
        </section>

        {/* 4 · TROPHY CAROUSEL */}
        <section className="me-sec">
          <div className="me-sec__head">
            <div className="me-sec__title">Trophies · {earned}/{trophies.length}</div>
            <button className="me-sec__more">View All →</button>
          </div>
          <div className="me-trophies">
            {trophies.map(t => (
              <div key={t.id} className={"me-trophy" + (t.earned ? "" : " is-locked")}>
                <div className="me-trophy__circle">
                  {t.earned
                    ? <window.MeTrophyIcon id={t.icon} />
                    : <window.MeIcon.Lock />}
                </div>
                <div className="me-trophy__lbl">{t.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 5 · SOCIAL CARD */}
        <section className="me-sec">
          <div className="me-sec__head">
            <div className="me-sec__title">Friends</div>
            <button className="me-sec__more" onClick={onLeaderboard}>Leaderboard →</button>
          </div>
          <div className="me-social me-glass">
            <div className="me-social__head">
              <div className="me-social__title">Top this week</div>
              <div className="me-social__sub">XP · 7D</div>
            </div>
            <div className="me-leader">
              {lb.map(row => (
                <div key={row.rank} className={"me-leader__row" + (row.isMe ? " is-me" : "")}>
                  <span className="me-leader__rank">{row.rank}</span>
                  <span className="me-leader__avatar">
                    <window.MeAvatar seed={row.seed} size={28} />
                  </span>
                  <span className="me-leader__name">{row.name}{row.isMe && " (you)"}</span>
                  <span className="me-leader__xp">{(row.xp / 1000).toFixed(1)}<span>K XP</span></span>
                </div>
              ))}
            </div>
            <div className="me-social__cta">
              <button className="me-social__primary" onClick={onSendChallenge}>
                <window.MeIcon.Send width="14" height="14" />
                Send Challenge
              </button>
              <button className="me-social__secondary" onClick={onCopyLink}>
                <window.MeIcon.Link />
                Copy Link
              </button>
            </div>
          </div>
        </section>

        <div className="me-foot">CourtIQ · Me · §6.16</div>
        </React.Fragment>
        )}
      </div>
    </div>
  );
};

window.MeScreen = MeScreen;
