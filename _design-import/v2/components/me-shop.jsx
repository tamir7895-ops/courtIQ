// me-shop.jsx — Shop sub-page of Me tab
// Cosmetics store: spend coins on DiceBear Avataaars customizations.
// Uses DiceBear v9 Avataaars API for avatar previews.

// ─────────────────────────────────────────────────────────────
// AVATAR HELPER — DiceBear Avataaars v9 SVG endpoint
// ─────────────────────────────────────────────────────────────
const SHOP_BASE_SEED = "alex-rivera-1";
const SHOP_BASE = {
  seed: SHOP_BASE_SEED,
  skinColor: "d08b5b",
  hairColor: "2c1b18",
  backgroundColor: "1d2632",
  // baseline cosmetics (player's currently equipped look)
  top: "shortFlat",
  facialHair: "blank",
  accessories: "blank",
  clothing: "shirtCrewNeck",
  clothesColor: "262e33",
};

const dicebearURL = (overrides = {}) => {
  const cfg = { ...SHOP_BASE, ...overrides };
  const params = new URLSearchParams();
  params.set("seed", cfg.seed);
  params.set("backgroundColor", cfg.backgroundColor);
  params.set("skinColor", cfg.skinColor);
  params.set("hairColor", cfg.hairColor);
  params.set("top", cfg.top);
  params.set("topProbability", "100");
  if (cfg.hatColor) params.set("hatColor", cfg.hatColor);
  if (cfg.facialHair && cfg.facialHair !== "blank") {
    params.set("facialHair", cfg.facialHair);
    params.set("facialHairProbability", "100");
    params.set("facialHairColor", cfg.facialHairColor || cfg.hairColor);
  } else {
    params.set("facialHairProbability", "0");
  }
  if (cfg.accessories && cfg.accessories !== "blank") {
    params.set("accessories", cfg.accessories);
    params.set("accessoriesProbability", "100");
    if (cfg.accessoriesColor) params.set("accessoriesColor", cfg.accessoriesColor);
  } else {
    params.set("accessoriesProbability", "0");
  }
  params.set("clothing", cfg.clothing);
  params.set("clothesColor", cfg.clothesColor);
  params.set("radius", "50");
  return `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
};

const ShopAvatar = ({ size = 64, overrides = {}, className = "" }) => (
  <img
    className={"shop-av " + className}
    src={dicebearURL(overrides)}
    width={size}
    height={size}
    alt=""
    loading="lazy"
    style={{ width: size, height: size }}
  />
);

// ─────────────────────────────────────────────────────────────
// SHOP CATALOG
// Each item maps to one or more DiceBear params applied to the
// base avatar so the preview shows the item WORN.
// ─────────────────────────────────────────────────────────────
const SHOP_CATEGORIES = [
  { id: "accessories", label: "Accessories" },
  { id: "hair",        label: "Hair" },
  { id: "beard",       label: "Beard" },
  { id: "backgrounds", label: "Backgrounds" },
];

const SHOP_ITEMS = [
  // ─── Accessories ───
  { id:"headband",  cat:"accessories", name:"Headband",      price:100,
    params:{ top:"hat", hatColor:"ff488e" }, tag:"NEW" },
  { id:"sweatband", cat:"accessories", name:"Sweatband",     price:75,
    params:{ top:"hat", hatColor:"ffffff" } },
  { id:"armband",   cat:"accessories", name:"Armband",       price:50,
    params:{ clothing:"blazerAndShirt", clothesColor:"e84040" } },
  { id:"sportgls",  cat:"accessories", name:"Sport Glasses", price:150,
    params:{ accessories:"sunglasses", accessoriesColor:"262e33" }, tag:"HOT" },
  { id:"chain",     cat:"accessories", name:"Gold Chain",    price:200,
    params:{ clothing:"hoodie", clothesColor:"a7ffc4" }, tag:"FEATURED" },
  { id:"durag",     cat:"accessories", name:"Durag",         price:125,
    params:{ top:"hat", hatColor:"262e33" } },

  // ─── Hair ───
  { id:"hair-mohawk",   cat:"hair", name:"Mohawk",   free:true, levelReq:3,
    params:{ top:"shavedSides" } },
  { id:"hair-waves",    cat:"hair", name:"Waves",    free:true, levelReq:3,
    params:{ top:"shortWaved" } },
  { id:"hair-cornrows", cat:"hair", name:"Cornrows", free:true, levelReq:4,
    params:{ top:"dreads01" } },
  // already-owned defaults
  { id:"hair-buzz",   cat:"hair", name:"Buzz",   free:true, owned:true, params:{ top:"shortRound" } },
  { id:"hair-short",  cat:"hair", name:"Short",  free:true, owned:true, params:{ top:"shortFlat" } },
  { id:"hair-fade",   cat:"hair", name:"Fade",   free:true, owned:true, params:{ top:"shortCurly" } },
  { id:"hair-afro",   cat:"hair", name:"Afro",   free:true, owned:true, params:{ top:"bigHair" } },
  { id:"hair-dreads", cat:"hair", name:"Dreads", free:true, owned:true, params:{ top:"dreads02" } },
  { id:"hair-bald",   cat:"hair", name:"Bald",   free:true, owned:true, params:{ top:"noHair" } },

  // ─── Beard ───
  { id:"beard-goatee",    cat:"beard", name:"Goatee",    free:true, levelReq:3,
    params:{ facialHair:"beardLight" } },
  { id:"beard-chinstrap", cat:"beard", name:"Chinstrap", free:true, levelReq:4,
    params:{ facialHair:"beardMedium" } },
  // already-owned defaults
  { id:"beard-none",    cat:"beard", name:"None",    free:true, owned:true, params:{ facialHair:"blank" } },
  { id:"beard-stubble", cat:"beard", name:"Stubble", free:true, owned:true,
    params:{ facialHair:"beardLight", facialHairColor:"4a312c" } },

  // ─── Backgrounds (team + solid colors) ───
  { id:"bg-teal",   cat:"backgrounds", name:"Teal",      free:true, owned:true,
    params:{ backgroundColor:"2dd4bf" } },
  { id:"bg-court",  cat:"backgrounds", name:"Court",     free:true, owned:true,
    params:{ backgroundColor:"1d2632" } },
  { id:"bg-lakers", cat:"backgrounds", name:"L.A. Gold", free:true, levelReq:3,
    params:{ backgroundColor:"f5a623" } },
  { id:"bg-celts",  cat:"backgrounds", name:"Celtic",    free:true, levelReq:4,
    params:{ backgroundColor:"56d364" } },
  { id:"bg-heat",   cat:"backgrounds", name:"Miami Heat",free:true, levelReq:5,
    params:{ backgroundColor:"e84040" } },
  { id:"bg-warri",  cat:"backgrounds", name:"Bay Blue",  free:true, levelReq:5,
    params:{ backgroundColor:"4ca3ff" } },
  { id:"bg-kings",  cat:"backgrounds", name:"Royal",     free:true, levelReq:6,
    params:{ backgroundColor:"bc8cff" } },
  { id:"bg-onyx",   cat:"backgrounds", name:"Onyx",      free:true, levelReq:7,
    params:{ backgroundColor:"0a0907" } },
];

// ─────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────
const ShopCoinIcon = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
    <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5"/>
    <path d="M9.5 9.5h3.2a1.8 1.8 0 0 1 0 3.6H10M10 13.1h3a1.8 1.8 0 0 1 0 3.6H9.5M11 8v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const ShopLockIcon = ({ size = 12 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
    <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
);

const ShopCheckIcon = ({ size = 12 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
    <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// CARDS
// ─────────────────────────────────────────────────────────────
const ShopItemCard = ({ item, owned, equipped, locked, affordable, level, onTap }) => {
  const klass = [
    "shop-card",
    owned     && "is-owned",
    equipped  && "is-equipped",
    locked    && "is-locked",
    !affordable && !owned && !locked && "is-broke",
  ].filter(Boolean).join(" ");

  return (
    <button className={klass} onClick={() => onTap(item)}>
      {item.tag && !owned && !locked && (
        <span className="shop-card__tag">{item.tag}</span>
      )}
      <div className="shop-card__pv">
        <ShopAvatar size={64} overrides={item.params} />
        {locked && (
          <span className="shop-card__lock-glyph">
            <ShopLockIcon size={18}/>
          </span>
        )}
        {equipped && (
          <span className="shop-card__eq-badge">
            <ShopCheckIcon size={11}/>
          </span>
        )}
      </div>
      <div className="shop-card__name">{item.name}</div>
      {locked ? (
        <div className="shop-card__lvl">
          <ShopLockIcon size={9}/>
          <span>LEVEL {item.levelReq}</span>
        </div>
      ) : owned ? (
        <div className={"shop-card__cta " + (equipped ? "is-eq" : "is-owned")}>
          {equipped ? "EQUIPPED" : "EQUIP"}
        </div>
      ) : item.free ? (
        <div className="shop-card__cta is-claim">CLAIM FREE</div>
      ) : (
        <div className={"shop-card__price" + (affordable ? "" : " is-short")}>
          <ShopCoinIcon size={11}/>
          <span>{item.price}</span>
        </div>
      )}
    </button>
  );
};

const ShopFeaturedCard = ({ item, owned, equipped, affordable, onTap }) => (
  <button className="shop-featured" onClick={() => onTap(item)}>
    <div className="shop-featured__l">
      <div className="shop-featured__eyebrow">FEATURED · LIMITED DROP</div>
      <div className="shop-featured__name">{item.name}</div>
      <div className="shop-featured__desc">Equip to flex on the leaderboard.</div>
      <div className="shop-featured__cta-row">
        {owned ? (
          <span className={"shop-featured__cta " + (equipped ? "is-eq" : "is-owned")}>
            {equipped ? "EQUIPPED" : "EQUIP NOW"}
          </span>
        ) : (
          <>
            <span className="shop-featured__price">
              <ShopCoinIcon size={14}/>
              <span>{item.price}</span>
            </span>
            <span className={"shop-featured__cta" + (affordable ? "" : " is-short")}>
              {affordable ? "BUY NOW" : "NEED MORE COINS"}
            </span>
          </>
        )}
      </div>
    </div>
    <div className="shop-featured__r">
      <ShopAvatar size={100} overrides={item.params} />
      <div className="shop-featured__r-glow"/>
    </div>
  </button>
);

// ─────────────────────────────────────────────────────────────
// MAIN SHOP SCREEN
// ─────────────────────────────────────────────────────────────
const MeShop = ({
  category,
  setCategory,
  wallet,
  level,
  ownedSet,
  equippedSet,
  onTapItem,
  onEarn,
}) => {
  // featured = "Gold Chain" if not owned, else first non-owned non-locked priced item
  const allByCat = SHOP_ITEMS.filter(i => i.cat === category);

  const featuredCandidates = SHOP_ITEMS.filter(i => i.cat === "accessories");
  const featured = featuredCandidates.find(i => i.tag === "FEATURED") || featuredCandidates[0];

  const cheapest = SHOP_ITEMS
    .filter(i => i.cat === "accessories" && !i.free)
    .reduce((min, i) => (i.price < min ? i.price : min), Infinity);
  const isEmpty = wallet === 0 && cheapest !== Infinity;

  return (
    <div className="shop">
      {/* WALLET BAR (sticky) */}
      <div className="shop-wallet">
        <div className="shop-wallet__l">
          <span className="shop-wallet__coin">
            <ShopCoinIcon size={20}/>
          </span>
          <div className="shop-wallet__nums">
            <div className="shop-wallet__bal">{wallet.toLocaleString()}</div>
            <div className="shop-wallet__sub">COINS</div>
          </div>
        </div>
        <div className="shop-wallet__lvl">
          <span className="shop-wallet__lvl-num">LV {level}</span>
        </div>
        <button className="shop-wallet__earn" onClick={onEarn}>
          Earn more →
        </button>
      </div>

      {/* CATEGORY TABS */}
      <div className="shop-tabs">
        {SHOP_CATEGORIES.map(c => (
          <button
            key={c.id}
            className={"shop-tab" + (category === c.id ? " is-active" : "")}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* FEATURED — only on Accessories */}
      {category === "accessories" && featured && (
        <ShopFeaturedCard
          item={featured}
          owned={ownedSet.has(featured.id)}
          equipped={equippedSet.has(featured.id)}
          affordable={wallet >= featured.price}
          onTap={onTapItem}
        />
      )}

      {/* GRID */}
      <div className="shop-grid">
        {allByCat
          .filter(i => !(category === "accessories" && i.id === featured?.id))
          .map(i => {
            const owned    = ownedSet.has(i.id) || i.owned;
            const equipped = equippedSet.has(i.id);
            const locked   = !owned && !!i.levelReq && level < i.levelReq;
            const afford   = i.free ? true : wallet >= i.price;
            return (
              <ShopItemCard
                key={i.id}
                item={i}
                owned={owned}
                equipped={equipped}
                locked={locked}
                affordable={afford}
                level={level}
                onTap={onTapItem}
              />
            );
          })}
      </div>

      {/* EMPTY WALLET */}
      {isEmpty && category === "accessories" && (
        <div className="shop-empty">
          <div className="shop-empty__icon"><ShopCoinIcon size={28}/></div>
          <div className="shop-empty__title">Need more coins?</div>
          <div className="shop-empty__sub">Earn XP through training to level up your wallet.</div>
          <button className="shop-empty__cta" onClick={onEarn}>
            START WORKOUT →
          </button>
        </div>
      )}
    </div>
  );
};

window.MeShop = MeShop;
window.ShopAvatar = ShopAvatar;
window.SHOP_ITEMS = SHOP_ITEMS;
window.SHOP_CATEGORIES = SHOP_CATEGORIES;
window.dicebearURL = dicebearURL;
