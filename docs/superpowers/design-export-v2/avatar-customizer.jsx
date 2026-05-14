// avatar-customizer.jsx — MyPlayer-style avatar editor app

const { useState: useStateAC, useEffect: useEffectAC, useMemo: useMemoAC, useRef: useRefAC, useCallback: useCallbackAC } = React;

// ─────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────
const AC = {
  Back: (p) => (
    <svg viewBox="0 0 14 14" fill="none" {...p}>
      <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 14 14" fill="none" {...p}>
      <path d="M3 7.2L6 10l5.5-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Lock: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <rect x="3.2" y="7.2" width="9.6" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M5.4 7.2V5a2.6 2.6 0 0 1 5.2 0v2.2" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  Coin: (p) => (
    <svg viewBox="0 0 14 14" fill="none" {...p}>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 5h2.2c.7 0 1.2.55 1.2 1.2v0c0 .65-.55 1.2-1.2 1.2H6v0c0 .65.55 1.2 1.2 1.2h2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M6.6 4v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Save: (p) => (
    <svg viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M3.5 3.5h9.5l2 2v9a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <circle cx="9" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M5 3.5v3.5h6V3.5" stroke="currentColor" strokeWidth="1.7"/>
    </svg>
  ),
  Shop: (p) => (
    <svg viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M2.5 5.5h11l-1 7.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1l-1-7.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M5.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  Warn: (p) => (
    <svg viewBox="0 0 14 14" fill="none" {...p}>
      <path d="M7 2L1.5 12h11L7 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M7 6v3M7 10.5v.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────
// TILE
// ─────────────────────────────────────────────────────────────
const ACTile = ({ item, cfg, equipped, owned, locked, shaking, onTap }) => {
  const isSkin = item.cat === "skin";
  const previewURL = useMemoAC(
    () => window.acURL(window.acApplyItem(cfg, item), { radius: 0, hasBg: true }),
    [cfg, item]
  );

  const klass = [
    "ac-tile",
    isSkin && "ac-tile--swatch",
    equipped && "is-equipped",
    !equipped && owned && "is-owned",
    locked && "is-locked",
    shaking && "is-shaking",
  ].filter(Boolean).join(" ");

  const statusLabel = equipped
    ? "Equipped"
    : owned
      ? "Owned"
      : `${item.price}`;

  return (
    <button
      type="button"
      className={klass}
      onClick={() => onTap(item)}
      style={isSkin ? { "--swatch-color": "#" + (item.params.skinColor) } : undefined}
    >
      {item.tag && !owned && !locked && (
        <span className="ac-tile__tag">{item.tag}</span>
      )}
      <div className="ac-tile__pv">
        {isSkin ? null : <img src={previewURL} alt="" loading="lazy" />}
        {locked && (
          <span className="ac-tile__pv-lock"><AC.Lock /></span>
        )}
      </div>
      {equipped && (
        <span className="ac-tile__check"><AC.Check /></span>
      )}
      <div className="ac-tile__name">{item.name}</div>
      <span className="ac-tile__status">
        {equipped && <AC.Check />}
        {!equipped && owned && null}
        {locked && <AC.Coin />}
        {statusLabel}
      </span>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
const AC_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "wallet": 450,
  "level": 14,
  "category": "hair"
}/*EDITMODE-END*/;

const AvatarCustomizerApp = () => {
  const [tweaks, setTweak] = window.useTweaks(AC_TWEAK_DEFAULTS);
  const wallet = tweaks.wallet;
  const level  = tweaks.level;

  // current equipped (saved) config
  const [savedCfg, setSavedCfg] = useStateAC(window.AC_BASE);
  // working / staged config — what the user is trying out
  const [stagedCfg, setStagedCfg] = useStateAC(window.AC_BASE);
  const [activeCat, setActiveCat] = useStateAC(tweaks.category);
  useEffectAC(() => { setActiveCat(tweaks.category); }, [tweaks.category]);

  const [shakingId, setShakingId] = useStateAC(null);
  const [toast, setToast] = useStateAC(null);

  const showToast = useCallbackAC((msg, kind = "warn") => {
    setToast({ msg, kind, id: Date.now() });
    setTimeout(() => setToast(t => (t && t.msg === msg ? null : t)), 2000);
  }, []);

  // Owned set — every "owned: true" item in the catalog
  const ownedSet = useMemoAC(() => {
    const s = new Set();
    window.AC_ITEMS.forEach(it => { if (it.owned) s.add(it.id); });
    return s;
  }, []);

  const items = useMemoAC(
    () => window.AC_ITEMS.filter(i => i.cat === activeCat),
    [activeCat]
  );

  // Counts for header
  const counts = useMemoAC(() => {
    let owned = 0, locked = 0;
    items.forEach(i => {
      if (ownedSet.has(i.id)) owned++;
      else locked++;
    });
    return { owned, locked, total: items.length };
  }, [items, ownedSet]);

  const dirty = useMemoAC(() => {
    const keys = ["top","hatColor","facialHair","accessories","accessoriesColor","clothing","clothesColor","skinColor"];
    return keys.some(k => savedCfg[k] !== stagedCfg[k]);
  }, [savedCfg, stagedCfg]);

  const handleTap = useCallbackAC((item) => {
    const owned = ownedSet.has(item.id);
    if (!owned) {
      // locked
      setShakingId(item.id);
      setTimeout(() => setShakingId(null), 380);
      showToast(`Visit shop to unlock · ${item.price} coins`, "warn");
      return;
    }
    // owned — apply instantly to staged config
    setStagedCfg(c => window.acApplyItem(c, item));
  }, [ownedSet, showToast]);

  const handleSave = () => {
    setSavedCfg(stagedCfg);
    showToast("Changes saved", "success");
  };
  const handleReset = () => {
    setStagedCfg(savedCfg);
  };
  const handleOpenShop = () => {
    window.location.href = "me-tab.html";
  };
  const handleBack = () => {
    if (dirty) {
      showToast("Save or reset to leave", "warn");
      return;
    }
    window.location.href = "me-tab.html";
  };

  // Hero avatar URL
  const heroURL = useMemoAC(
    () => window.acURL(stagedCfg, { radius: 0, hasBg: true }),
    [stagedCfg]
  );

  const Frame = window.IOSDevice;
  if (!Frame) return <div style={{color:"#fff"}}>Loading…</div>;

  const { TweaksPanel, TweakSection, TweakSelect, TweakNumber } = window;

  return (
    <div className="stage">
      <Frame width={390} height={844} dark>
        <div style={{ position: "absolute", inset: 0 }}>
          <div className="ac">
            {/* STAMP */}
            <div className="ac-stamp">
              <button className="ac-stamp__back" type="button" onClick={handleBack} aria-label="Back">
                <AC.Back />
              </button>
              <div className="ac-stamp__title-block">
                <div className="ac-stamp__eyebrow">MyPlayer</div>
                <div className="ac-stamp__title">Customize</div>
              </div>
              <div className="ac-coins">
                <span className="ac-coins__icon">¢</span>
                {wallet.toLocaleString()}
              </div>
            </div>

            {/* BODY */}
            <div className="ac-body">
              {/* HERO */}
              <div className="ac-hero ac-fade d-0">
                <span className="ac-hero__bug">
                  <span className="ac-hero__bug-dot" />
                  Live Preview
                </span>
                <div className="ac-hero__pedestal" />
                <div className="ac-hero__av">
                  <img
                    key={heroURL}
                    src={heroURL}
                    alt="Player avatar"
                    width="240"
                    height="240"
                  />
                </div>
                <div className="ac-hero__foot">
                  <div>
                    <h2 className="ac-hero__name">Alex Rivera</h2>
                    <div className="ac-hero__sub">The Sniper · Combo Guard</div>
                  </div>
                  <div className="ac-hero__level">
                    <span className="ac-hero__level-lbl">LVL</span>
                    <span className="ac-hero__level-num">{level}</span>
                  </div>
                </div>
              </div>

              {/* TABS */}
              <div className="ac-tabs ac-fade d-1">
                {window.AC_CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={"ac-tab" + (activeCat === c.id ? " is-active" : "")}
                    onClick={() => { setActiveCat(c.id); setTweak("category", c.id); }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* GRID */}
              <div className="ac-grid-wrap ac-glass ac-fade d-2">
                <div className="ac-grid-head">
                  <div className="ac-grid-title">
                    {window.AC_CATEGORIES.find(c => c.id === activeCat)?.label}
                  </div>
                  <div className="ac-grid-meta">
                    <b>{counts.owned}</b> / {counts.total} OWNED
                  </div>
                </div>
                <div className="ac-grid">
                  {items.map(item => {
                    const owned = ownedSet.has(item.id);
                    const equipped = owned && window.acIsEquipped(stagedCfg, item);
                    const locked = !owned;
                    return (
                      <ACTile
                        key={item.id}
                        item={item}
                        cfg={stagedCfg}
                        equipped={equipped}
                        owned={owned}
                        locked={locked}
                        shaking={shakingId === item.id}
                        onTap={handleTap}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* STICKY ACTIONS */}
            <div className="ac-actions">
              <button
                className="ac-btn-primary"
                type="button"
                onClick={handleSave}
                disabled={!dirty}
              >
                <AC.Save />Save Changes
              </button>
              <div className="ac-btn-row">
                <button className="ac-btn-secondary" type="button" onClick={handleOpenShop}>
                  <AC.Shop />Open Shop
                </button>
                <button
                  className="ac-btn-text"
                  type="button"
                  onClick={handleReset}
                  disabled={!dirty}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* TOAST */}
            {toast && (
              <div className={"ac-toast " + (toast.kind === "success" ? "ac-toast--success" : "")}>
                <span className="ac-toast__icon">
                  {toast.kind === "success" ? <AC.Check /> : <AC.Warn />}
                </span>
                {toast.msg}
              </div>
            )}
          </div>
        </div>
      </Frame>

      <div className="stage__caption">Me · Avatar Customizer · §6.14</div>

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection label="Player">
            <TweakNumber
              label="Coins"
              value={wallet}
              min={0}
              max={9999}
              step={25}
              onChange={(v) => setTweak("wallet", v)}
            />
            <TweakNumber
              label="Level"
              value={level}
              min={1}
              max={99}
              onChange={(v) => setTweak("level", v)}
            />
            <TweakSelect
              label="Open category"
              value={activeCat}
              onChange={(v) => { setActiveCat(v); setTweak("category", v); }}
              options={window.AC_CATEGORIES.map(c => ({ value: c.id, label: c.label }))}
            />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<AvatarCustomizerApp />);
