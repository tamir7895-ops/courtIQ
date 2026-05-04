// me-app.jsx — Root: Me tab + IOSDevice frame + BottomNav + Settings sheet + Tweaks

const ME_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tab": "shop",
  "notifications": true,
  "darkMode": true,
  "archetype": "sniper",
  "settingsOpen": false,
  "shopCategory": "accessories",
  "shopWallet": 320,
  "shopBuyingId": null,
  "emptyWalletPreview": false
}/*EDITMODE-END*/;

const ARCHETYPE_PRESETS = {
  sniper: {
    name: "The Sniper", match: 92,
    skills: [
      { id:"shooting", name:"Shooting",      val:92 },
      { id:"handle",   name:"Ball Handling", val:78 },
      { id:"passing",  name:"Passing",       val:64 },
      { id:"defense",  name:"Defense",       val:58 },
      { id:"athl",     name:"Athleticism",   val:71 },
      { id:"iq",       name:"Basketball IQ", val:84 },
    ],
    traits: ["Catch & Shoot","Pull-Up","Off-Screen","Deep Range","Quick Trigger"],
  },
  general: {
    name: "The Floor General", match: 88,
    skills: [
      { id:"shooting", name:"Shooting",      val:72 },
      { id:"handle",   name:"Ball Handling", val:90 },
      { id:"passing",  name:"Passing",       val:94 },
      { id:"defense",  name:"Defense",       val:66 },
      { id:"athl",     name:"Athleticism",   val:70 },
      { id:"iq",       name:"Basketball IQ", val:91 },
    ],
    traits: ["Pick & Roll","Court Vision","Pace Control","Lob Threader","High IQ"],
  },
  lockdown: {
    name: "The Lockdown", match: 85,
    skills: [
      { id:"shooting", name:"Shooting",      val:62 },
      { id:"handle",   name:"Ball Handling", val:74 },
      { id:"passing",  name:"Passing",       val:60 },
      { id:"defense",  name:"Defense",       val:95 },
      { id:"athl",     name:"Athleticism",   val:90 },
      { id:"iq",       name:"Basketball IQ", val:82 },
    ],
    traits: ["On-Ball","Help Side","Steals","Closeouts","Switchable"],
  },
};

const MeApp = () => {
  const [tweaks, setTweak] = window.useTweaks(ME_TWEAK_DEFAULTS);
  const [activeNav, setActiveNav] = React.useState("me");

  // Shop state — owned/equipped sets persist for the session
  const initialOwned = React.useMemo(
    () => new Set((window.SHOP_ITEMS || []).filter(i => i.owned).map(i => i.id)),
    []
  );
  const [ownedSet, setOwnedSet] = React.useState(initialOwned);
  const [equippedSet, setEquippedSet] = React.useState(
    () => new Set(["hair-short", "beard-none", "bg-court"])
  );

  const Frame = window.IOSDevice;
  if (!Frame) return <div style={{ color: "#fff" }}>Loading…</div>;

  const { TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakSlider } = window;

  const arch = ARCHETYPE_PRESETS[tweaks.archetype] || ARCHETYPE_PRESETS.sniper;
  window.ME_PROFILE = { ...window.ME_PROFILE, archetype: arch };
  const p = window.ME_PROFILE;

  const setSettingsOpen = (v) => setTweak("settingsOpen", v);

  const wallet = tweaks.emptyWalletPreview ? 0 : tweaks.shopWallet;
  const buyingItem = (window.SHOP_ITEMS || []).find(i => i.id === tweaks.shopBuyingId);

  const onTapShopItem = (item) => {
    const owned = ownedSet.has(item.id) || item.owned;
    const equipped = equippedSet.has(item.id);
    const locked = !owned && !!item.levelReq && p.level < item.levelReq;
    if (locked) return;
    // owned + equipped → toggle off (within mutually-exclusive cat for hair/beard/bg)
    if (owned && equipped) {
      setEquippedSet(prev => {
        const n = new Set(prev); n.delete(item.id); return n;
      });
      return;
    }
    if (owned) {
      // equip — replace any other in same cat
      setEquippedSet(prev => {
        const n = new Set();
        prev.forEach(id => {
          const other = (window.SHOP_ITEMS || []).find(i => i.id === id);
          if (other && other.cat !== item.cat) n.add(id);
        });
        n.add(item.id);
        return n;
      });
      return;
    }
    // not owned — open buy sheet
    setTweak("shopBuyingId", item.id);
  };

  const closeBuy = () => setTweak("shopBuyingId", null);

  const confirmBuy = () => {
    if (!buyingItem) return;
    if (!buyingItem.free && wallet < buyingItem.price) return;
    if (!buyingItem.free) setTweak("shopWallet", tweaks.shopWallet - buyingItem.price);
    setOwnedSet(prev => new Set(prev).add(buyingItem.id));
    // auto-equip on purchase
    setEquippedSet(prev => {
      const n = new Set();
      prev.forEach(id => {
        const other = (window.SHOP_ITEMS || []).find(i => i.id === id);
        if (other && other.cat !== buyingItem.cat) n.add(id);
      });
      n.add(buyingItem.id);
      return n;
    });
    closeBuy();
  };

  const onEarn = () => {
    setActiveNav("train");
    alert("→ Routing to Train tab to earn more XP");
  };

  return (
    <div className="stage">
      <Frame width={390} height={844} dark>
        <div style={{ position: "absolute", inset: 0, background: "#06080c", overflow: "hidden" }}>
          <window.MeScreen
            tab={tweaks.tab}
            setTab={(t) => setTweak("tab", t)}
            onOpenSettings={() => setSettingsOpen(true)}
            onCustomize={() => alert("Customize avatar — open avatar editor sheet")}
            onLeaderboard={() => alert("Open full leaderboard")}
            onSendChallenge={() => alert("Send challenge sheet")}
            onCopyLink={() => alert("Profile link copied · courtiq.app/u/alex")}
            shopCategory={tweaks.shopCategory}
            setShopCategory={(c) => setTweak("shopCategory", c)}
            shopWallet={wallet}
            shopOwned={ownedSet}
            shopEquipped={equippedSet}
            onTapShopItem={onTapShopItem}
            onEarn={onEarn}
          />
          <window.CIQBottomNav active={activeNav} onChange={setActiveNav} />

          <window.CIQBottomSheet
            open={tweaks.settingsOpen}
            onClose={() => setSettingsOpen(false)}
            title="Settings"
            accent="#2dd4bf"
          >
            <div className="me-set-section-lbl">Account</div>
            <div className="me-set-row">
              <span className="me-set-row__lbl">Email</span>
              <span className="me-set-row__val">{p.email}</span>
            </div>
            <div className="me-set-row is-button">
              <span className="me-set-row__lbl">Edit Profile</span>
              <span className="me-set-row__chev"><window.MeIcon.Chev/></span>
            </div>

            <div className="me-set-section-lbl">Preferences</div>
            <div className="me-set-row">
              <span className="me-set-row__lbl">Notifications</span>
              <button
                className={"me-toggle" + (tweaks.notifications ? " is-on" : "")}
                onClick={() => setTweak("notifications", !tweaks.notifications)}
                aria-label="Toggle notifications"
              ><span className="me-toggle__knob" /></button>
            </div>
            <div className="me-set-row">
              <span className="me-set-row__lbl">Dark Mode</span>
              <button
                className={"me-toggle" + (tweaks.darkMode ? " is-on" : "")}
                onClick={() => setTweak("darkMode", !tweaks.darkMode)}
                aria-label="Toggle dark mode"
              ><span className="me-toggle__knob" /></button>
            </div>
            <div className="me-set-row is-button">
              <span className="me-set-row__lbl">Units</span>
              <span className="me-set-row__val">Imperial</span>
              <span className="me-set-row__chev"><window.MeIcon.Chev/></span>
            </div>

            <div className="me-set-section-lbl">Support</div>
            <div className="me-set-row is-button">
              <span className="me-set-row__lbl">Privacy &amp; Data</span>
              <span className="me-set-row__chev"><window.MeIcon.Chev/></span>
            </div>
            <div className="me-set-row is-button">
              <span className="me-set-row__lbl">Help &amp; Support</span>
              <span className="me-set-row__chev"><window.MeIcon.Chev/></span>
            </div>
            <div className="me-set-row is-button is-danger">
              <span className="me-set-row__lbl">Sign Out</span>
            </div>
          </window.CIQBottomSheet>

          {/* SHOP BUY SHEET */}
          <window.CIQBottomSheet
            open={!!buyingItem}
            onClose={closeBuy}
            title={buyingItem ? (buyingItem.free ? "Claim Item" : "Buy Item") : ""}
            accent="#2dd4bf"
          >
            {buyingItem && (
              <div className="shop-buy">
                <div className="shop-buy__pv">
                  <window.ShopAvatar size={200} overrides={buyingItem.params} />
                  <span className="shop-buy__pv-glow" />
                </div>
                <div className="shop-buy__cat">
                  {(window.SHOP_CATEGORIES.find(c => c.id === buyingItem.cat) || {}).label}
                </div>
                <div className="shop-buy__name">{buyingItem.name}</div>
                {buyingItem.free ? (
                  <div className="shop-buy__lock">FREE · UNLOCKED</div>
                ) : (
                  <div className="shop-buy__price">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
                      <path d="M9.5 9.5h3.2a1.8 1.8 0 0 1 0 3.6H10M10 13.1h3a1.8 1.8 0 0 1 0 3.6H9.5M11 8v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <span>{buyingItem.price.toLocaleString()} COINS</span>
                  </div>
                )}
                {!buyingItem.free && wallet < buyingItem.price && (
                  <div className="shop-buy__short">
                    Need {(buyingItem.price - wallet).toLocaleString()} more coins
                  </div>
                )}
                <div className="shop-buy__actions">
                  <button
                    className={"shop-buy__primary" + (!buyingItem.free && wallet < buyingItem.price ? " is-disabled" : "")}
                    disabled={!buyingItem.free && wallet < buyingItem.price}
                    onClick={confirmBuy}
                  >
                    {buyingItem.free
                      ? "CLAIM FREE"
                      : `BUY FOR ${buyingItem.price.toLocaleString()} COINS`}
                  </button>
                  <button className="shop-buy__secondary" onClick={closeBuy}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </window.CIQBottomSheet>
        </div>
      </Frame>

      <div className="stage__caption">Me · Profile + Trophies + Social · §6.16</div>

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Sub-nav">
            <TweakRadio
              label="Active chip"
              value={tweaks.tab}
              onChange={(v) => setTweak("tab", v)}
              options={[
                { value: "profile",  label: "Profile" },
                { value: "trophies", label: "Trophies" },
                { value: "social",   label: "Social" },
                { value: "shop",     label: "Shop" },
              ]}
            />
          </TweakSection>
          <TweakSection title="Archetype">
            <TweakRadio
              label="Player type"
              value={tweaks.archetype}
              onChange={(v) => setTweak("archetype", v)}
              options={[
                { value: "sniper",   label: "Sniper" },
                { value: "general",  label: "General" },
                { value: "lockdown", label: "Lockdown" },
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
          <TweakSection title="Shop">
            <TweakRadio
              label="Category"
              value={tweaks.shopCategory}
              onChange={(v) => setTweak("shopCategory", v)}
              options={[
                { value: "accessories", label: "Acc" },
                { value: "hair",        label: "Hair" },
                { value: "beard",       label: "Beard" },
                { value: "backgrounds", label: "BG" },
              ]}
            />
            {TweakSlider && (
              <TweakSlider
                label="Wallet"
                value={tweaks.shopWallet}
                min={0} max={1000} step={25}
                unit=" coins"
                onChange={(v) => setTweak("shopWallet", v)}
              />
            )}
            <TweakToggle
              label="Empty wallet"
              value={tweaks.emptyWalletPreview}
              onChange={(v) => setTweak("emptyWalletPreview", v)}
            />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<MeApp />);
