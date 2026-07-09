// avatar-customizer-data.jsx — catalog + DiceBear URL helper

// ─────────────────────────────────────────────────────────────
// DiceBear v9 Avataaars — flexible config builder
// ─────────────────────────────────────────────────────────────
const AC_SEED = "alex-rivera-1";

const AC_BASE = {
  seed: AC_SEED,
  backgroundColor: "2dd4bf",  // teal — matches the hero card so it blends
  skinColor: "d08b5b",
  hairColor: "2c1b18",
  top: "shortFlat",
  facialHair: "blank",
  facialHairColor: "2c1b18",
  accessories: "blank",
  clothing: "shirtCrewNeck",
  clothesColor: "262e33",
};

const acURL = (cfg, { radius = 0, hasBg = true } = {}) => {
  const p = new URLSearchParams();
  p.set("seed", cfg.seed || AC_SEED);
  if (hasBg) p.set("backgroundColor", cfg.backgroundColor || "2dd4bf");
  else p.set("backgroundType", "solid");
  p.set("skinColor", cfg.skinColor);
  p.set("hairColor", cfg.hairColor);
  p.set("top", cfg.top);
  p.set("topProbability", "100");
  if (cfg.hatColor) p.set("hatColor", cfg.hatColor);
  if (cfg.facialHair && cfg.facialHair !== "blank") {
    p.set("facialHair", cfg.facialHair);
    p.set("facialHairProbability", "100");
    p.set("facialHairColor", cfg.facialHairColor || cfg.hairColor);
  } else {
    p.set("facialHairProbability", "0");
  }
  if (cfg.accessories && cfg.accessories !== "blank") {
    p.set("accessories", cfg.accessories);
    p.set("accessoriesProbability", "100");
    if (cfg.accessoriesColor) p.set("accessoriesColor", cfg.accessoriesColor);
  } else {
    p.set("accessoriesProbability", "0");
  }
  p.set("clothing", cfg.clothing);
  p.set("clothesColor", cfg.clothesColor);
  p.set("radius", String(radius));
  return `https://api.dicebear.com/9.x/avataaars/svg?${p.toString()}`;
};

// ─────────────────────────────────────────────────────────────
// CATEGORIES + ITEMS
//   field: which config key the item writes to
//   value: the DiceBear param value (or full params for multi-key items)
// Each item has: id, name, free? owned? price?, params (object merged into cfg)
// ─────────────────────────────────────────────────────────────
const AC_CATEGORIES = [
  { id: "hair",         label: "Hair" },
  { id: "facialHair",   label: "Facial Hair" },
  { id: "accessories",  label: "Accessories" },
  { id: "clothing",     label: "Clothing" },
  { id: "skin",         label: "Skin" },
];

const AC_ITEMS = [
  // ─── HAIR (top) ───
  { id:"hair-buzz",     cat:"hair", name:"Buzz",      owned:true,  free:true, params:{ top:"shortRound" } },
  { id:"hair-short",    cat:"hair", name:"Short",     owned:true,  free:true, params:{ top:"shortFlat" } },
  { id:"hair-fade",     cat:"hair", name:"Fade",      owned:true,  free:true, params:{ top:"shortCurly" } },
  { id:"hair-afro",     cat:"hair", name:"Afro",      owned:true,  free:true, params:{ top:"bigHair" } },
  { id:"hair-dreads",   cat:"hair", name:"Dreads",    owned:true,  free:true, params:{ top:"dreads02" } },
  { id:"hair-bald",     cat:"hair", name:"Bald",      owned:true,  free:true, params:{ top:"noHair" } },
  { id:"hair-mohawk",   cat:"hair", name:"Mohawk",    price:150,   params:{ top:"shavedSides" } },
  { id:"hair-waves",    cat:"hair", name:"Waves",     price:200, tag:"NEW", params:{ top:"shortWaved" } },
  { id:"hair-cornrows", cat:"hair", name:"Cornrows",  price:175,   params:{ top:"dreads01" } },

  // ─── FACIAL HAIR ───
  { id:"fh-clean",   cat:"facialHair", name:"Clean",       owned:true, free:true, params:{ facialHair:"blank" } },
  { id:"fh-stubble", cat:"facialHair", name:"Stubble",     owned:true, free:true, params:{ facialHair:"beardLight", facialHairColor:"4a312c" } },
  { id:"fh-goatee",  cat:"facialHair", name:"Goatee",      price:80,   params:{ facialHair:"beardMedium" } },
  { id:"fh-full",    cat:"facialHair", name:"Full Beard",  price:120, tag:"HOT", params:{ facialHair:"beardMajestic" } },
  { id:"fh-must",    cat:"facialHair", name:"Mustache",    price:60,   params:{ facialHair:"moustacheFancy" } },
  { id:"fh-magnum",  cat:"facialHair", name:"Magnum",      price:90,   params:{ facialHair:"moustacheMagnum" } },

  // ─── ACCESSORIES ───
  { id:"acc-none",     cat:"accessories", name:"None",          owned:true, free:true, params:{ accessories:"blank", top:"shortFlat", hatColor:undefined } },
  { id:"acc-headband", cat:"accessories", name:"Headband",      price:100, params:{ top:"hat", hatColor:"ff488e" } },
  { id:"acc-sweat",    cat:"accessories", name:"Sweatband",     price:75,  params:{ top:"hat", hatColor:"f0ece4" } },
  { id:"acc-armband",  cat:"accessories", name:"Armband",       price:50,  params:{ clothing:"blazerAndShirt", clothesColor:"e84040" } },
  { id:"acc-glasses",  cat:"accessories", name:"Sport Glasses", price:150, tag:"HOT", params:{ accessories:"sunglasses", accessoriesColor:"262e33" } },
  { id:"acc-chain",    cat:"accessories", name:"Gold Chain",    price:200, tag:"FEATURED", params:{ accessories:"prescription02", accessoriesColor:"ffc94a" } },
  { id:"acc-durag",    cat:"accessories", name:"Durag",         price:125, params:{ top:"hat", hatColor:"262e33" } },

  // ─── CLOTHING ───
  { id:"cl-crew",    cat:"clothing", name:"T-Shirt",     owned:true, free:true, params:{ clothing:"shirtCrewNeck",  clothesColor:"262e33" } },
  { id:"cl-vneck",   cat:"clothing", name:"V-Neck",      owned:true, free:true, params:{ clothing:"shirtVNeck",     clothesColor:"3c4f5c" } },
  { id:"cl-scoop",   cat:"clothing", name:"Scoop Tee",   owned:true, free:true, params:{ clothing:"shirtScoopNeck", clothesColor:"929598" } },
  { id:"cl-hoodie",  cat:"clothing", name:"Hoodie",      price:180, params:{ clothing:"hoodie",           clothesColor:"262e33" } },
  { id:"cl-blazer",  cat:"clothing", name:"Blazer",      price:240, tag:"NEW", params:{ clothing:"blazerAndShirt", clothesColor:"2c1b18" } },
  { id:"cl-jersey",  cat:"clothing", name:"Team Jersey", price:300, tag:"FEATURED", params:{ clothing:"shirtCrewNeck", clothesColor:"2dd4bf" } },

  // ─── SKIN (all free, just pick) ───
  { id:"sk-pale",    cat:"skin", name:"Pale",   owned:true, free:true, params:{ skinColor:"edb98a" } },
  { id:"sk-light",   cat:"skin", name:"Light",  owned:true, free:true, params:{ skinColor:"fd9841" } },
  { id:"sk-tan",     cat:"skin", name:"Tan",    owned:true, free:true, params:{ skinColor:"d08b5b" } },
  { id:"sk-brown",   cat:"skin", name:"Brown",  owned:true, free:true, params:{ skinColor:"ae5d29" } },
  { id:"sk-deep",    cat:"skin", name:"Deep",   owned:true, free:true, params:{ skinColor:"614335" } },
  { id:"sk-onyx",    cat:"skin", name:"Onyx",   owned:true, free:true, params:{ skinColor:"4a312c" } },
];

// ─────────────────────────────────────────────────────────────
// HELPERS — given a staged cfg + an item, what would it look like?
// ─────────────────────────────────────────────────────────────
const acApplyItem = (cfg, item) => ({ ...cfg, ...(item.params || {}) });

// What's "equipped right now" for a category? We compare the item's params
// against the current cfg — if the primary key matches, that item is equipped.
// We pick the primary key by category id.
const AC_PRIMARY_KEY = {
  hair: "top",
  facialHair: "facialHair",
  accessories: "accessories",
  clothing: "clothing",
  skin: "skinColor",
};

const acIsEquipped = (cfg, item) => {
  const key = AC_PRIMARY_KEY[item.cat];
  if (!key) return false;
  // hat-style accessories live in cfg.top — handle specially
  if (item.cat === "accessories" && item.params?.top) {
    return cfg.top === item.params.top && cfg.hatColor === item.params.hatColor;
  }
  if (item.cat === "accessories" && item.id === "acc-none") {
    return (!cfg.accessories || cfg.accessories === "blank") && !cfg.hatColor;
  }
  return cfg[key] === item.params?.[key];
};

window.AC_BASE = AC_BASE;
window.AC_CATEGORIES = AC_CATEGORIES;
window.AC_ITEMS = AC_ITEMS;
window.acURL = acURL;
window.acApplyItem = acApplyItem;
window.acIsEquipped = acIsEquipped;
window.AC_PRIMARY_KEY = AC_PRIMARY_KEY;
