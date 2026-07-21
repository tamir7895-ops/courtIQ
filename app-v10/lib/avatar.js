/* CourtIQ v12 — avatar + shop engine
   ------------------------------------------------------------------
   One model behind the avatar creator AND the shop. Every option maps
   to a REAL DiceBear avataaars parameter, so the preview is exactly
   what ships. Free options are always available; premium options
   ("cool" gear, big hair, gradient courts) cost coins you earn.

   Coins are honest: 1 XP earned = 1 coin, minus what you've spent.
   Nothing here fabricates a balance — a new player has what their XP
   says and no more.

   Stores:
     courtiq_avatar_params  — the chosen options (JSON)
     courtiq_shop_v12       — { owned:[ids], spent:Number }
     courtiq_avatar_url     — the rendered URL (so header/profile/home
                              keep reading one place)
   ============================================================ */
(function () {
  'use strict';

  var LS_PARAMS = 'courtiq_avatar_params';
  var LS_SHOP   = 'courtiq_shop_v12';
  var LS_URL    = 'courtiq_avatar_url';
  var BASE      = 'https://api.dicebear.com/9.x/avataaars/png';

  /* ── Catalog ──────────────────────────────────────────────────
     Each option: { id, label, v (DiceBear value), cost }. cost 0 =
     free. Some categories carry an OFF option (no beard / no gear)
     that drives the matching *Probability to 0. Backgrounds carry a
     bg array (1 = solid, 2 = gradient) instead of a v. */
  var HAIR_COLORS = ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'c93305', 'e8e1e1', 'ecdcbf', 'f59797'];
  var CLOTHES_COLORS = ['FF4F1F', '14A5F2', '47C012', 'FFB800', 'A855F7', '262e33', '3c4f5c', 'ff488e', 'e6e6e6', '25557c'];
  var ACC_COLORS = ['262e33', '3c4f5c', '25557c', '65c9ff', 'ff488e', 'ff5c5c', 'ffffff'];

  var CAT = {
    skin: {
      label: 'Skin', param: 'skinColor', swatch: true,
      options: [
        { id: 'sk1', v: 'edb98a', cost: 0 }, { id: 'sk2', v: 'ffdbb4', cost: 0 },
        { id: 'sk3', v: 'd08b5b', cost: 0 }, { id: 'sk4', v: 'ae5d29', cost: 0 },
        { id: 'sk5', v: '614335', cost: 0 }, { id: 'sk6', v: 'fd9841', cost: 0 },
        { id: 'sk7', v: 'f8d25c', cost: 0 }
      ]
    },
    top: {
      label: 'Hair', param: 'top', icon: 'ph-scissors',
      options: [
        { id: 'shortFlat',  label: 'Flat',      v: 'shortFlat',  cost: 0 },
        { id: 'shortCurly', label: 'Curly',     v: 'shortCurly', cost: 0 },
        { id: 'shortWaved', label: 'Waves',     v: 'shortWaved', cost: 0 },
        { id: 'theCaesar',  label: 'Caesar',    v: 'theCaesar',  cost: 0 },
        { id: 'sides',      label: 'Sides',     v: 'sides',      cost: 0 },
        { id: 'fro',        label: 'Fro',       v: 'fro',        cost: 0 },
        { id: 'bun',        label: 'Bun',       v: 'bun',        cost: 0 },
        { id: 'bald',       label: 'Bald',      v: 'bald',       cost: 0 },
        { id: 'froBand',    label: 'Headband',  v: 'froBand',    cost: 80 },
        { id: 'bigHair',    label: 'Big Hair',  v: 'bigHair',    cost: 140 },
        { id: 'dreads01',   label: 'Dreads',    v: 'dreads01',   cost: 160 },
        { id: 'shaggyMullet', label: 'Mullet',  v: 'shaggyMullet', cost: 120 },
        { id: 'miaWallace', label: 'Straight',  v: 'miaWallace', cost: 140 },
        { id: 'hat',        label: 'Cap',       v: 'hat',        cost: 100 },
        { id: 'turban',     label: 'Turban',    v: 'turban',     cost: 120 },
        { id: 'hijab',      label: 'Hijab',     v: 'hijab',      cost: 100 },
        { id: 'winterHat02', label: 'Beanie',   v: 'winterHat02', cost: 110 }
      ]
    },
    hairColor: {
      label: 'Hair color', param: 'hairColor', swatch: true,
      options: HAIR_COLORS.map(function (c, i) { return { id: 'hc' + i, v: c, cost: 0 }; })
    },
    eyes: {
      label: 'Eyes', param: 'eyes', icon: 'ph-eye',
      options: [
        { id: 'default', label: 'Default', v: 'default', cost: 0 },
        { id: 'happy',   label: 'Happy',   v: 'happy',   cost: 0 },
        { id: 'squint',  label: 'Squint',  v: 'squint',  cost: 0 },
        { id: 'wink',    label: 'Wink',    v: 'wink',    cost: 0 },
        { id: 'side',    label: 'Side',    v: 'side',    cost: 0 },
        { id: 'surprised', label: 'Wide',  v: 'surprised', cost: 0 },
        { id: 'hearts',  label: 'Hearts',  v: 'hearts',  cost: 60 },
        { id: 'eyeRoll', label: 'Roll',    v: 'eyeRoll', cost: 40 }
      ]
    },
    eyebrows: {
      label: 'Brows', param: 'eyebrows', icon: 'ph-minus',
      options: [
        { id: 'default', label: 'Default', v: 'defaultNatural', cost: 0 },
        { id: 'raised',  label: 'Raised',  v: 'raisedExcitedNatural', cost: 0 },
        { id: 'flat',    label: 'Flat',    v: 'flatNatural', cost: 0 },
        { id: 'angry',   label: 'Angry',   v: 'angryNatural', cost: 0 },
        { id: 'unibrow', label: 'Unibrow', v: 'unibrowNatural', cost: 40 }
      ]
    },
    mouth: {
      label: 'Mouth', param: 'mouth', icon: 'ph-smiley',
      options: [
        { id: 'smile',   label: 'Smile',   v: 'smile',   cost: 0 },
        { id: 'default', label: 'Chill',   v: 'default', cost: 0 },
        { id: 'serious', label: 'Serious', v: 'serious', cost: 0 },
        { id: 'twinkle', label: 'Twinkle', v: 'twinkle', cost: 0 },
        { id: 'tongue',  label: 'Tongue',  v: 'tongue',  cost: 40 },
        { id: 'grimace', label: 'Grit',    v: 'grimace', cost: 40 }
      ]
    },
    facialHair: {
      label: 'Beard', param: 'facialHair', prob: 'facialHairProbability', icon: 'ph-user',
      options: [
        { id: 'none',        label: 'None',    off: true, cost: 0 },
        { id: 'beardLight',  label: 'Light',   v: 'beardLight',  cost: 0 },
        { id: 'beardMedium', label: 'Medium',  v: 'beardMedium', cost: 0 },
        { id: 'moustacheFancy', label: "'Stache", v: 'moustacheFancy', cost: 0 },
        { id: 'beardMajestic', label: 'Majestic', v: 'beardMajestic', cost: 150 },
        { id: 'moustacheMagnum', label: 'Magnum', v: 'moustacheMagnum', cost: 130 }
      ]
    },
    clothing: {
      label: 'Fit', param: 'clothing', icon: 'ph-t-shirt',
      options: [
        { id: 'shirtCrewNeck',  label: 'Crew',    v: 'shirtCrewNeck',  cost: 0 },
        { id: 'shirtVNeck',     label: 'V-Neck',  v: 'shirtVNeck',     cost: 0 },
        { id: 'shirtScoopNeck', label: 'Scoop',   v: 'shirtScoopNeck', cost: 0 },
        { id: 'hoodie',         label: 'Hoodie',  v: 'hoodie',         cost: 0 },
        { id: 'collarAndSweater', label: 'Collar', v: 'collarAndSweater', cost: 0 },
        { id: 'graphicShirt',   label: 'Graphic', v: 'graphicShirt',   cost: 100 },
        { id: 'blazerAndShirt', label: 'Blazer',  v: 'blazerAndShirt', cost: 140 },
        { id: 'overall',        label: 'Overall', v: 'overall',        cost: 120 }
      ]
    },
    clothesColor: {
      label: 'Fit color', param: 'clothesColor', swatch: true,
      options: CLOTHES_COLORS.map(function (c, i) { return { id: 'cc' + i, v: c, cost: 0 }; })
    },
    accessories: {
      label: 'Gear', param: 'accessories', prob: 'accessoriesProbability', icon: 'ph-sunglasses',
      options: [
        { id: 'none',          label: 'None',    off: true, cost: 0 },
        { id: 'round',         label: 'Round',   v: 'round',         cost: 0 },
        { id: 'prescription01', label: 'Specs',  v: 'prescription01', cost: 0 },
        { id: 'sunglasses',    label: 'Shades',  v: 'sunglasses',    cost: 120 },
        { id: 'wayfarers',     label: 'Wayfarers', v: 'wayfarers',   cost: 150 },
        { id: 'prescription02', label: 'Reader', v: 'prescription02', cost: 90 },
        { id: 'kurt',          label: 'Kurt',    v: 'kurt',          cost: 90 },
        { id: 'eyepatch',      label: 'Eyepatch', v: 'eyepatch',     cost: 200 }
      ]
    },
    background: {
      label: 'Court', param: 'backgroundColor', bg: true, icon: 'ph-basketball',
      options: [
        { id: 'bgGold',   label: 'Gold',   bgv: ['FFB800'], cost: 0 },
        { id: 'bgOrange', label: 'Orange', bgv: ['FF4F1F'], cost: 0 },
        { id: 'bgBlue',   label: 'Blue',   bgv: ['14A5F2'], cost: 0 },
        { id: 'bgGreen',  label: 'Green',  bgv: ['47C012'], cost: 0 },
        { id: 'bgSunset', label: 'Sunset', bgv: ['FF4F1F', 'FFB800'], grad: true, cost: 80 },
        { id: 'bgPurple', label: 'Nebula', bgv: ['A855F7', '14A5F2'], grad: true, cost: 80 },
        { id: 'bgIce',    label: 'Ice',    bgv: ['14A5F2', 'b1e2ff'], grad: true, cost: 70 },
        { id: 'bgNight',  label: 'Night',  bgv: ['25557c', '262e33'], grad: true, cost: 90 },
        { id: 'bgFire',   label: 'Fire',   bgv: ['FF4F1F', 'FF3B30'], grad: true, cost: 90 },
        { id: 'bgChamp',  label: 'Champ',  bgv: ['FFB800', 'FF4F1F'], grad: true, cost: 120 }
      ]
    }
  };

  /* Order the creator tabs group categories into panels. */
  var TABS = [
    { id: 'face', label: 'Face', cats: ['skin', 'eyes', 'eyebrows', 'mouth'] },
    { id: 'hair', label: 'Hair', cats: ['top', 'hairColor'] },
    { id: 'beard', label: 'Beard', cats: ['facialHair'] },
    { id: 'fit',  label: 'Fit',  cats: ['clothing', 'clothesColor'] },
    { id: 'gear', label: 'Gear', cats: ['accessories'] },
    { id: 'court', label: 'Court', cats: ['background'] }
  ];

  var DEFAULTS = {
    skin: 'sk2', top: 'shortFlat', hairColor: 'hc0', eyes: 'default',
    eyebrows: 'default', mouth: 'smile', facialHair: 'none',
    clothing: 'hoodie', clothesColor: 'cc0', accessories: 'none',
    background: 'bgGold', hatColor: '262e33'
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      var raw = localStorage.getItem(LS_PARAMS);
      if (raw) {
        var p = JSON.parse(raw);
        // fill any missing keys from defaults (forward-compatible)
        Object.keys(DEFAULTS).forEach(function (k) { if (p[k] == null) p[k] = DEFAULTS[k]; });
        return p;
      }
    } catch (e) {}
    return clone(DEFAULTS);
  }

  function save(params) {
    try { localStorage.setItem(LS_PARAMS, JSON.stringify(params)); } catch (e) {}
    try { localStorage.setItem(LS_URL, buildUrl(params)); } catch (e) {}
  }

  function opt(cat, id) {
    var c = CAT[cat]; if (!c) return null;
    for (var i = 0; i < c.options.length; i++) if (c.options[i].id === id) return c.options[i];
    return null;
  }

  /* Assemble the DiceBear URL from chosen option ids. */
  function buildUrl(params, opts) {
    opts = opts || {};
    params = params || load();
    var q = ['seed=' + encodeURIComponent(opts.seed || 'courtiq'),
             'radius=0', 'size=' + (opts.size || 160)];

    function push(cat) {
      var c = CAT[cat], o = opt(cat, params[cat]);
      if (!c || !o) return;
      if (c.bg) {
        q.push('backgroundColor=' + o.bgv.join(','));
        q.push('backgroundType=' + (o.grad ? 'gradientLinear' : 'solid'));
        return;
      }
      if (c.prob) {
        if (o.off) { q.push(c.prob + '=0'); return; }
        q.push(c.prob + '=100');
      }
      if (o.v != null) q.push(c.param + '=' + encodeURIComponent(o.v));
    }

    ['skin', 'top', 'hairColor', 'eyes', 'eyebrows', 'mouth',
     'facialHair', 'clothing', 'clothesColor', 'accessories', 'background'].forEach(push);

    // extra fixed colors for richness
    q.push('facialHairColor=' + (params.hairColor ? (opt('hairColor', params.hairColor) || {}).v || '2c1b18' : '2c1b18'));
    q.push('accessoriesColor=262e33');
    q.push('topProbability=100');

    return BASE + '?' + q.join('&');
  }

  /* ── Shop economy ─────────────────────────────────────────────*/
  function totalXP() {
    try {
      var d = JSON.parse(localStorage.getItem('courtiq-xp'));
      if (d && typeof d.xp === 'number') return d.xp;
    } catch (e) {}
    try {
      if (window.XPSystem && window.XPSystem.load) {
        var l = window.XPSystem.load();
        if (l && typeof l.xp === 'number') return l.xp;
      }
    } catch (e) {}
    return 0;
  }

  function loadShop() {
    try {
      var raw = localStorage.getItem(LS_SHOP);
      if (raw) { var s = JSON.parse(raw); return { owned: s.owned || [], spent: s.spent || 0 }; }
    } catch (e) {}
    return { owned: [], spent: 0 };
  }
  function saveShop(s) { try { localStorage.setItem(LS_SHOP, JSON.stringify(s)); } catch (e) {} }

  function coins() { return Math.max(0, totalXP() - loadShop().spent); }

  function isOwned(id) {
    var o = findOpt(id);
    if (!o) return false;
    if (!o.cost) return true;              // free items always owned
    return loadShop().owned.indexOf(id) >= 0;
  }

  function findOpt(id) {
    var keys = Object.keys(CAT);
    for (var i = 0; i < keys.length; i++) {
      var found = opt(keys[i], id);
      if (found) return found;
    }
    return null;
  }
  function catOf(id) {
    var keys = Object.keys(CAT);
    for (var i = 0; i < keys.length; i++) if (opt(keys[i], id)) return keys[i];
    return null;
  }

  /* Buy: deduct coins, record ownership. Returns {ok, msg}. */
  function buy(id) {
    var o = findOpt(id);
    if (!o) return { ok: false, msg: 'Unknown item' };
    if (isOwned(id)) return { ok: true, msg: 'Already yours' };
    var bal = coins();
    if (bal < o.cost) return { ok: false, msg: 'Need ' + (o.cost - bal) + ' more coins' };
    var s = loadShop();
    s.owned.push(id);
    s.spent += o.cost;
    saveShop(s);
    return { ok: true, msg: (o.label || 'Item') + ' unlocked' };
  }

  /* Equip an owned option straight onto the avatar (used by the shop). */
  function equip(id) {
    var cat = catOf(id);
    if (!cat || !isOwned(id)) return false;
    var p = load();
    p[cat] = id;
    save(p);
    return true;
  }

  /* Every premium (cost>0) option, flattened, for the shop grid. */
  function catalog() {
    var out = [];
    Object.keys(CAT).forEach(function (cat) {
      CAT[cat].options.forEach(function (o) {
        if (o.cost > 0) out.push({ cat: cat, catLabel: CAT[cat].label, opt: o });
      });
    });
    return out;
  }

  window.V12Avatar = {
    CAT: CAT, TABS: TABS, DEFAULTS: DEFAULTS,
    load: load, save: save, buildUrl: buildUrl, opt: opt,
    coins: coins, isOwned: isOwned, buy: buy, equip: equip,
    catalog: catalog, catOf: catOf, findOpt: findOpt
  };
})();
