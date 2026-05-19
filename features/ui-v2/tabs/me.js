/* CourtIQ UI v2 — Me tab renderer (Wave 6 redesign)
 *
 * Ports design-export-v2/me-screen.jsx + me-shop.jsx (compact).
 * Single scrollable screen with sub-nav chips: Profile, Trophies, Social, Shop.
 * Profile view: DiceBear avatar, court SVG bg, stats strip, archetype card
 *   with radar chart + skill bars + traits.
 * Shop view: wallet bar, category tabs, featured card, item grid with
 *   DiceBear previews and own/equip/lock states.
 * Wires to DataService / Gamification / AvatarCustomizer / SocialHub
 * when their globals exist; falls back to fixture data.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.ME_TAB) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[me-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  /* ════════════════════════════════════════════════════
     FIXTURE DATA (matches me-data.jsx)
     ════════════════════════════════════════════════════ */
  var FIXTURE = {
    profile: {
      name: 'Alex Rivera', position: 'Combo Guard',
      level: 14, totalXP: 12480, weeklyXP: 1240,
      avatarSeed: 'alex-rivera-1',
      coins: 320,
      stats: { sessions: 142, streak: 23, xp: 12480 },
      archetype: {
        name: 'The Sniper',
        match: 92,
        skills: [
          { id: 'shooting', name: 'Shooting',      val: 92 },
          { id: 'handle',   name: 'Ball Handling', val: 78 },
          { id: 'passing',  name: 'Passing',       val: 64 },
          { id: 'defense',  name: 'Defense',       val: 58 },
          { id: 'athl',     name: 'Athleticism',   val: 71 },
          { id: 'iq',       name: 'Basketball IQ', val: 84 }
        ],
        traits: ['Catch & Shoot', 'Pull-Up', 'Off-Screen', 'Deep Range', 'Quick Trigger']
      }
    },
    trophies: [
      { id: 'first',   label: 'First Bucket',  earned: true,  icon: 'target' },
      { id: 'hot7',    label: 'Hot Week',       earned: true,  icon: 'flame' },
      { id: '100s',    label: 'Century',        earned: true,  icon: 'hundred' },
      { id: 'sniper',  label: 'Sniper L3',      earned: true,  icon: 'crosshair' },
      { id: 'iron',    label: 'Iron Streak',    earned: true,  icon: 'shield' },
      { id: 'legend',  label: 'Legend Tier',    earned: false, icon: 'crown' },
      { id: '1kxp',    label: '10K XP',         earned: false, icon: 'bolt' },
      { id: 'tour',    label: 'Tournament',     earned: false, icon: 'trophy' }
    ],
    leaderboard: [
      { rank: 1, name: 'Marcus Lee',  xp: 18420, seed: 'ml-7' },
      { rank: 2, name: 'Sasha Kim',   xp: 14910, seed: 'sk-3' },
      { rank: 3, name: 'Alex Rivera', xp: 12480, seed: 'ar-1', isMe: true }
    ]
  };

  /* ════════════════════════════════════════════════════
     SHOP CATALOG (matches me-shop.jsx)
     ════════════════════════════════════════════════════ */
  var SHOP_BASE = {
    seed: 'alex-rivera-1', skinColor: 'd08b5b', hairColor: '2c1b18',
    backgroundColor: '1d2632', top: 'shortFlat', facialHair: 'blank',
    accessories: 'blank', clothing: 'shirtCrewNeck', clothesColor: '262e33'
  };

  var SHOP_CATEGORIES = [
    { id: 'accessories', label: 'Accessories' },
    { id: 'hair',        label: 'Hair' },
    { id: 'beard',       label: 'Beard' },
    { id: 'backgrounds', label: 'Backgrounds' }
  ];

  var SHOP_ITEMS = [
    { id:'headband',  cat:'accessories', name:'Headband',      price:100, params:{ top:'hat', hatColor:'ff488e' }, tag:'NEW' },
    { id:'sweatband', cat:'accessories', name:'Sweatband',     price:75,  params:{ top:'hat', hatColor:'ffffff' } },
    { id:'armband',   cat:'accessories', name:'Armband',       price:50,  params:{ clothing:'blazerAndShirt', clothesColor:'e84040' } },
    { id:'sportgls',  cat:'accessories', name:'Sport Glasses', price:150, params:{ accessories:'sunglasses', accessoriesColor:'262e33' }, tag:'HOT' },
    { id:'chain',     cat:'accessories', name:'Gold Chain',    price:200, params:{ clothing:'hoodie', clothesColor:'a7ffc4' }, tag:'FEATURED' },
    { id:'durag',     cat:'accessories', name:'Durag',         price:125, params:{ top:'hat', hatColor:'262e33' } },

    { id:'hair-mohawk',   cat:'hair', name:'Mohawk',   free:true, levelReq:3, params:{ top:'shavedSides' } },
    { id:'hair-waves',    cat:'hair', name:'Waves',    free:true, levelReq:3, params:{ top:'shortWaved' } },
    { id:'hair-cornrows', cat:'hair', name:'Cornrows', free:true, levelReq:4, params:{ top:'dreads01' } },
    { id:'hair-buzz',     cat:'hair', name:'Buzz',     free:true, owned:true, params:{ top:'shortRound' } },
    { id:'hair-short',    cat:'hair', name:'Short',    free:true, owned:true, params:{ top:'shortFlat' } },
    { id:'hair-fade',     cat:'hair', name:'Fade',     free:true, owned:true, params:{ top:'shortCurly' } },
    { id:'hair-afro',     cat:'hair', name:'Afro',     free:true, owned:true, params:{ top:'bigHair' } },
    { id:'hair-dreads',   cat:'hair', name:'Dreads',   free:true, owned:true, params:{ top:'dreads02' } },
    { id:'hair-bald',     cat:'hair', name:'Bald',     free:true, owned:true, params:{ top:'noHair' } },

    { id:'beard-goatee',    cat:'beard', name:'Goatee',    free:true, levelReq:3, params:{ facialHair:'beardLight' } },
    { id:'beard-chinstrap', cat:'beard', name:'Chinstrap', free:true, levelReq:4, params:{ facialHair:'beardMedium' } },
    { id:'beard-none',      cat:'beard', name:'None',      free:true, owned:true, params:{ facialHair:'blank' } },
    { id:'beard-stubble',   cat:'beard', name:'Stubble',   free:true, owned:true, params:{ facialHair:'beardLight', facialHairColor:'4a312c' } },

    { id:'bg-teal',   cat:'backgrounds', name:'Teal',       free:true, owned:true, params:{ backgroundColor:'2dd4bf' } },
    { id:'bg-court',  cat:'backgrounds', name:'Court',      free:true, owned:true, params:{ backgroundColor:'1d2632' } },
    { id:'bg-lakers', cat:'backgrounds', name:'L.A. Gold',  free:true, levelReq:3, params:{ backgroundColor:'f5a623' } },
    { id:'bg-celts',  cat:'backgrounds', name:'Celtic',     free:true, levelReq:4, params:{ backgroundColor:'56d364' } },
    { id:'bg-heat',   cat:'backgrounds', name:'Miami Heat', free:true, levelReq:5, params:{ backgroundColor:'e84040' } },
    { id:'bg-warri',  cat:'backgrounds', name:'Bay Blue',   free:true, levelReq:5, params:{ backgroundColor:'4ca3ff' } },
    { id:'bg-kings',  cat:'backgrounds', name:'Royal',      free:true, levelReq:6, params:{ backgroundColor:'bc8cff' } },
    { id:'bg-onyx',   cat:'backgrounds', name:'Onyx',       free:true, levelReq:7, params:{ backgroundColor:'0a0907' } }
  ];

  function dicebearURL(overrides) {
    var cfg = {};
    var k;
    for (k in SHOP_BASE) cfg[k] = SHOP_BASE[k];
    if (overrides) for (k in overrides) cfg[k] = overrides[k];
    var p = [];
    p.push('seed=' + encodeURIComponent(cfg.seed));
    p.push('backgroundColor=' + cfg.backgroundColor);
    p.push('skinColor=' + cfg.skinColor);
    p.push('hairColor=' + cfg.hairColor);
    p.push('top=' + cfg.top);
    p.push('topProbability=100');
    if (cfg.hatColor) p.push('hatColor=' + cfg.hatColor);
    if (cfg.facialHair && cfg.facialHair !== 'blank') {
      p.push('facialHair=' + cfg.facialHair);
      p.push('facialHairProbability=100');
      p.push('facialHairColor=' + (cfg.facialHairColor || cfg.hairColor));
    } else {
      p.push('facialHairProbability=0');
    }
    if (cfg.accessories && cfg.accessories !== 'blank') {
      p.push('accessories=' + cfg.accessories);
      p.push('accessoriesProbability=100');
      if (cfg.accessoriesColor) p.push('accessoriesColor=' + cfg.accessoriesColor);
    } else {
      p.push('accessoriesProbability=0');
    }
    p.push('clothing=' + cfg.clothing);
    p.push('clothesColor=' + cfg.clothesColor);
    p.push('radius=50');
    return 'https://api.dicebear.com/9.x/avataaars/svg?' + p.join('&');
  }

  /* ════════════════════════════════════════════════════
     LIVE DATA MERGE
     ════════════════════════════════════════════════════ */
  function realProfile() {
    var p = JSON.parse(JSON.stringify(FIXTURE.profile));
    try {
      if (window.dataService && typeof window.dataService.getProfile === 'function') {
        var pr = window.dataService.getProfile();
        if (pr) {
          if (pr.name) p.name = pr.name;
          if (pr.position) p.position = pr.position;
          if (pr.avatarSeed) p.avatarSeed = pr.avatarSeed;
        }
      }
      if (window.gamification && typeof window.gamification.getStats === 'function') {
        var s = window.gamification.getStats();
        if (s) {
          if (typeof s.level === 'number') p.level = s.level;
          if (typeof s.xp === 'number') { p.totalXP = s.xp; p.stats.xp = s.xp; }
          if (typeof s.coins === 'number') p.coins = s.coins;
          if (typeof s.sessions === 'number') p.stats.sessions = s.sessions;
          if (typeof s.streak === 'number') p.stats.streak = s.streak;
        }
      }
    } catch (e) { /* fixture */ }
    return p;
  }

  /* ════════════════════════════════════════════════════
     SVG ICON HELPERS (matches me-icons.jsx)
     ════════════════════════════════════════════════════ */
  var STK = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

  function settingsIcon() {
    /* Sliders icon — 3 horizontal lines with offset circles (not generic gear) */
    if (window.ICONS && window.ICONS.settings) return window.ICONS.settings({ size: 18 });
    return svg('svg', { viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none' }, [
      svg('line', { x1: '4', y1: '6', x2: '20', y2: '6', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round' }),
      svg('line', { x1: '4', y1: '12', x2: '20', y2: '12', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round' }),
      svg('line', { x1: '4', y1: '18', x2: '20', y2: '18', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round' }),
      svg('circle', { cx: '9', cy: '6', r: '2.2', fill: 'var(--ciq-bg,#1a1a2e)', stroke: 'currentColor', 'stroke-width': '1.6' }),
      svg('circle', { cx: '16', cy: '12', r: '2.2', fill: 'var(--ciq-bg,#1a1a2e)', stroke: 'currentColor', 'stroke-width': '1.6' }),
      svg('circle', { cx: '7', cy: '18', r: '2.2', fill: 'var(--ciq-bg,#1a1a2e)', stroke: 'currentColor', 'stroke-width': '1.6' })
    ]);
  }

  function iconSessions() {
    /* Shot clock — rectangular display, not round clock */
    return svg('svg', { viewBox: '0 0 24 24', width: '16', height: '16' }, [
      svg('rect', Object.assign({ x: '4', y: '3', width: '16', height: '18', rx: '2' }, STK)),
      svg('path', Object.assign({ d: 'M4 8h16' }, STK)),
      svg('text', { x: '12', y: '17', 'text-anchor': 'middle', fill: 'currentColor', 'font-size': '8', 'font-weight': 'bold', 'font-family': 'monospace', text: '24' })
    ]);
  }
  function iconFlame() {
    /* Refined fire streak — basketball streak flame with inner flicker */
    if (window.ICONS && window.ICONS.statStreak) return window.ICONS.statStreak({ size: 16 });
    return svg('svg', { viewBox: '0 0 24 24', width: '16', height: '16' }, [
      svg('path', Object.assign({ d: 'M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 1.5-4 .5 2 1.5 2.5 2.5 2 0-2 0-5 1-8z' }, STK)),
      svg('path', { d: 'M11 14a2 2 0 0 0 2 2', stroke: 'currentColor', 'stroke-width': '1.5', fill: 'none', 'stroke-linecap': 'round' })
    ]);
  }
  function iconBolt() {
    /* Chunky bold XP energy bolt */
    if (window.ICONS && window.ICONS.statXp) return window.ICONS.statXp({ size: 16 });
    return svg('svg', { viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none' }, [
      svg('path', { d: 'M13 2L4 14h6l-1 8 9-12h-6z', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    ]);
  }
  function iconCustomize() {
    /* Cleaner pencil edit icon — angled tip with tight body */
    return svg('svg', { viewBox: '0 0 24 24', width: '12', height: '12', fill: 'none' }, [
      svg('path', { d: 'M15.2 4.8a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L8.4 19.6 3 21l1.4-5.4z', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      svg('path', { d: 'M14 6l4 4', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round' })
    ]);
  }
  function iconSend() {
    /* Pass trajectory — curved arc with arrowhead (basketball pass) */
    if (window.ICONS && window.ICONS.share) return window.ICONS.share({ size: 14 });
    return svg('svg', { viewBox: '0 0 24 24', width: '14', height: '14', fill: 'none' }, [
      svg('circle', { cx: '5', cy: '18', r: '2.5', stroke: 'currentColor', 'stroke-width': '1.6' }),
      svg('path', { d: 'M7.5 16.5Q12 8 19 6', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', fill: 'none' }),
      svg('polyline', { points: '16 4 19 6 17 9', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    ]);
  }
  function iconLink() {
    return svg('svg', { viewBox: '0 0 24 24', width: '12', height: '12' }, [
      svg('path', Object.assign({ d: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 1 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 1 0 7 7l1-1' }, STK))
    ]);
  }
  function iconLock(sz) {
    /* Padlock with keyhole dot */
    var s = sz || 24;
    if (window.ICONS && window.ICONS.lock) return window.ICONS.lock({ size: s });
    return svg('svg', { viewBox: '0 0 24 24', width: String(s), height: String(s), fill: 'none' }, [
      svg('rect', Object.assign({ x: '4', y: '11', width: '16', height: '10', rx: '2' }, STK)),
      svg('path', Object.assign({ d: 'M8 11V8a4 4 0 0 1 8 0v3' }, STK)),
      svg('circle', { cx: '12', cy: '16', r: '1.5', fill: 'currentColor' })
    ]);
  }
  function iconCheck(sz) {
    /* Bolder swoosh-style checkmark */
    var s = sz || 12;
    if (window.ICONS && window.ICONS.check) return window.ICONS.check({ size: s });
    return svg('svg', { viewBox: '0 0 24 24', width: String(s), height: String(s), fill: 'none' }, [
      svg('path', { d: 'M4 12.5l5.5 5.5L20 6', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    ]);
  }
  function iconCoin(sz) {
    var s = sz || 14;
    return svg('svg', { viewBox: '0 0 24 24', width: String(s), height: String(s), fill: 'none' }, [
      svg('circle', { cx: '12', cy: '12', r: '9', stroke: 'currentColor', 'stroke-width': '1.6' }),
      svg('circle', { cx: '12', cy: '12', r: '5.5', stroke: 'currentColor', 'stroke-width': '1.2', opacity: '0.5' }),
      svg('path', { d: 'M9.5 9.5h3.2a1.8 1.8 0 0 1 0 3.6H10M10 13.1h3a1.8 1.8 0 0 1 0 3.6H9.5M11 8v9', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round' })
    ]);
  }

  /* trophy icon dispatcher — uses centralized window.ICONS with inline fallbacks */
  var TROPHY_ICONS_MAP = {
    target:    'badgeTarget',
    flame:     'statStreak',
    hundred:   null,
    crosshair: 'badgeTarget',
    shield:    null,
    crown:     null,
    bolt:      'statXp',
    trophy:    'badgeTrophy'
  };
  var TROPHY_FALLBACK_MAP = {
    target:    function () { return svg('svg', { viewBox: '0 0 24 24', width: '26', height: '26' }, [
      svg('circle', Object.assign({ cx:'12', cy:'12', r:'9' }, STK)),
      svg('circle', Object.assign({ cx:'12', cy:'12', r:'5' }, STK)),
      svg('circle', { cx:'12', cy:'12', r:'1.5', fill:'currentColor' })
    ]); },
    flame:     function () { return svg('svg', { viewBox: '0 0 24 24', width: '26', height: '26' }, [
      svg('path', Object.assign({ d:'M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 1.5-4 .5 2 1.5 2.5 2.5 2 0-2 0-5 1-8z' }, STK)),
      svg('path', { d:'M11 14a2 2 0 0 0 2 2', stroke:'currentColor', 'stroke-width':'1.5', fill:'none', 'stroke-linecap':'round' })
    ]); },
    hundred:   function () { return svg('svg', { viewBox: '0 0 24 24', width: '26', height: '26', fill: 'none' }, [
      svg('text', { x:'12', y:'16', 'text-anchor':'middle', fill:'currentColor', 'font-size':'11', 'font-weight':'bold', 'font-family':'monospace', text:'100' })
    ]); },
    crosshair: function () { return svg('svg', { viewBox: '0 0 24 24', width: '26', height: '26' }, [
      svg('circle', Object.assign({ cx:'12', cy:'12', r:'9' }, STK)),
      svg('circle', Object.assign({ cx:'12', cy:'12', r:'5' }, STK)),
      svg('circle', { cx:'12', cy:'12', r:'1.5', fill:'currentColor' }),
      svg('path', Object.assign({ d:'M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3' }, STK))
    ]); },
    shield:    function () { return svg('svg', { viewBox: '0 0 24 24', width: '26', height: '26' }, [
      svg('path', Object.assign({ d:'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z' }, STK)),
      svg('path', Object.assign({ d:'M9 12l2 2 4-4' }, STK))
    ]); },
    crown:     function () { return svg('svg', { viewBox: '0 0 24 24', width: '26', height: '26' }, [
      svg('path', Object.assign({ d:'M3 18h18M3 6l4 5 5-7 5 7 4-5v12H3z' }, STK)),
      svg('circle', { cx:'12', cy:'14', r:'1', fill:'currentColor' })
    ]); },
    bolt:      function () { return svg('svg', { viewBox: '0 0 24 24', width: '26', height: '26', fill: 'none' }, [
      svg('path', { d:'M13 2L4 14h6l-1 8 9-12h-6z', stroke:'currentColor', 'stroke-width':'2', 'stroke-linecap':'round', 'stroke-linejoin':'round' })
    ]); },
    trophy:    function () { return svg('svg', { viewBox: '0 0 24 24', width: '26', height: '26' }, [
      svg('path', Object.assign({ d:'M7 4h10v6a5 5 0 0 1-10 0V4z' }, STK)),
      svg('path', Object.assign({ d:'M7 5H5a2 2 0 0 0 0 4h2M17 5h2a2 2 0 0 1 0 4h-2' }, STK)),
      svg('path', Object.assign({ d:'M10 15v3M14 15v3M8 21h8M12 18v3' }, STK))
    ]); }
  };
  function trophyIcon(id) {
    /* Try centralized ICONS library first */
    var libName = TROPHY_ICONS_MAP[id];
    if (libName && window.ICONS && window.ICONS[libName]) {
      return window.ICONS[libName]({ size: 26 });
    }
    var fn = TROPHY_FALLBACK_MAP[id] || TROPHY_FALLBACK_MAP.target;
    return fn();
  }

  /* ════════════════════════════════════════════════════
     PROCEDURAL AVATAR (matches me-data.jsx MeAvatar)
     ════════════════════════════════════════════════════ */
  var AV_PALETTES = [
    { bg: '#2dd4bf', skin: '#f5d4ad', hair: '#1a1d26' },
    { bg: '#ff7a3c', skin: '#caa074', hair: '#0a0907' },
    { bg: '#bc8cff', skin: '#e9c9a3', hair: '#241a3a' },
    { bg: '#56d364', skin: '#d6a98a', hair: '#0e1014' },
    { bg: '#4ca3ff', skin: '#f0c9a4', hair: '#1a1014' },
    { bg: '#f5a623', skin: '#cf9870', hair: '#0c0a08' }
  ];

  function avHash(s) {
    var hv = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) hv = Math.imul(hv ^ s.charCodeAt(i), 16777619) >>> 0;
    return hv;
  }
  function avRng(seed) {
    var s = avHash(seed) || 1;
    return function () {
      s = (Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0;
      return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
    };
  }
  function avPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  function buildAvatarNode(seed, size) {
    var rng = avRng(seed || 'default');
    var pal = avPick(rng, AV_PALETTES);
    var eyeStyle  = Math.floor(rng() * 3);
    var browTilt  = (rng() - 0.5) * 6;
    var mouthStyle = Math.floor(rng() * 3);
    var hairStyle  = Math.floor(rng() * 3);
    var accent = avPick(rng, ['#ffffff', pal.hair, '#0a0907']);
    var cx = 50, cy = 50, r = 48;
    var clipId = 'avc-' + (seed || 'default');

    var hairNodes = [];
    if (hairStyle === 0) {
      hairNodes.push(svg('path', { d: 'M24 50 Q24 26 50 26 Q76 26 76 50 L76 44 Q60 38 50 38 Q40 38 24 44 Z', fill: pal.hair }));
    } else if (hairStyle === 1) {
      hairNodes.push(svg('path', { d: 'M22 56 Q22 24 50 24 Q78 24 78 56 Q78 50 70 48 Q70 32 50 32 Q30 32 30 48 Q22 50 22 56 Z', fill: pal.hair }));
    } else {
      hairNodes.push(svg('path', { d: 'M26 48 Q28 30 50 30 Q72 30 74 48 Q66 42 50 42 Q34 42 26 48 Z', fill: pal.hair }));
      hairNodes.push(svg('rect', { x: '26', y: '46', width: '48', height: '3', fill: pal.hair, opacity: '0.5' }));
    }

    var eyeNodes = [];
    if (eyeStyle === 0) {
      eyeNodes.push(svg('circle', { cx: '40', cy: '58', r: '2.2', fill: pal.hair }));
      eyeNodes.push(svg('circle', { cx: '60', cy: '58', r: '2.2', fill: pal.hair }));
    } else if (eyeStyle === 1) {
      eyeNodes.push(svg('line', { x1: '36', y1: '58', x2: '44', y2: '58', stroke: pal.hair, 'stroke-width': '2.2', 'stroke-linecap': 'round' }));
      eyeNodes.push(svg('line', { x1: '56', y1: '58', x2: '64', y2: '58', stroke: pal.hair, 'stroke-width': '2.2', 'stroke-linecap': 'round' }));
    } else {
      eyeNodes.push(svg('path', { d: 'M36 58 Q40 54 44 58', stroke: pal.hair, 'stroke-width': '2.2', fill: 'none', 'stroke-linecap': 'round' }));
      eyeNodes.push(svg('path', { d: 'M56 58 Q60 54 64 58', stroke: pal.hair, 'stroke-width': '2.2', fill: 'none', 'stroke-linecap': 'round' }));
    }

    var mouthNodes = [];
    if (mouthStyle === 0) {
      mouthNodes.push(svg('path', { d: 'M44 76 Q50 80 56 76', stroke: pal.hair, 'stroke-width': '2', fill: 'none', 'stroke-linecap': 'round' }));
    } else if (mouthStyle === 1) {
      mouthNodes.push(svg('line', { x1: '45', y1: '76', x2: '55', y2: '76', stroke: pal.hair, 'stroke-width': '2', 'stroke-linecap': 'round' }));
    } else {
      mouthNodes.push(svg('ellipse', { cx: '50', cy: '76', rx: '4', ry: '2.2', fill: pal.hair }));
    }

    var gChildren = [
      svg('ellipse', { cx: '50', cy: '56', rx: '26', ry: '28', fill: pal.skin }),
      svg('rect', { x: '42', y: '78', width: '16', height: '20', fill: pal.skin }),
      svg('ellipse', { cx: '50', cy: '104', rx: '42', ry: '20', fill: pal.hair })
    ].concat(hairNodes).concat([
      svg('g', { transform: 'rotate(' + browTilt + ' 50 52)' }, [
        svg('line', { x1: '36', y1: '52', x2: '44', y2: '52', stroke: pal.hair, 'stroke-width': '2.2', 'stroke-linecap': 'round' }),
        svg('line', { x1: '56', y1: '52', x2: '64', y2: '52', stroke: pal.hair, 'stroke-width': '2.2', 'stroke-linecap': 'round' })
      ])
    ]).concat(eyeNodes).concat([
      svg('path', { d: 'M50 62 L48 70 Q50 72 52 70 Z', fill: 'none', stroke: pal.hair, 'stroke-opacity': '0.4', 'stroke-width': '1.2', 'stroke-linecap': 'round' })
    ]).concat(mouthNodes).concat([
      svg('rect', { x: '28', y: '92', width: '44', height: '3', fill: accent, opacity: '0.6' })
    ]);

    return svg('svg', { viewBox: '0 0 100 100', width: String(size), height: String(size), style: 'display:block' }, [
      svg('defs', null, [
        svg('clipPath', { id: clipId }, [svg('circle', { cx: String(cx), cy: String(cy), r: String(r) })])
      ]),
      svg('circle', { cx: String(cx), cy: String(cy), r: String(r), fill: pal.bg }),
      svg('g', { 'clip-path': 'url(#' + clipId + ')' }, gChildren),
      svg('circle', { cx: String(cx), cy: String(cy), r: String(r - 1), fill: 'none', stroke: 'rgba(0,0,0,0.18)', 'stroke-width': '1' })
    ]);
  }

  /* ════════════════════════════════════════════════════
     RADAR CHART (matches me-radar.jsx)
     ════════════════════════════════════════════════════ */
  function buildRadar(skills, size) {
    size = size || 180;
    var cx = size / 2, cy = size / 2, rMax = size * 0.36;
    var n = skills.length;
    function angle(i) { return -Math.PI / 2 + (i * 2 * Math.PI) / n; }
    function pt(i, t) {
      var a = angle(i);
      return [cx + Math.cos(a) * rMax * t, cy + Math.sin(a) * rMax * t];
    }

    var rings = [0.25, 0.5, 0.75, 1];
    var children = [];

    // grid hexagons
    rings.forEach(function (t) {
      var pts = skills.map(function (_, i) { return pt(i, t).join(','); }).join(' ');
      children.push(svg('polygon', { points: pts, class: 'me-radar__grid' }));
    });
    // axes
    skills.forEach(function (_, i) {
      var p = pt(i, 1);
      children.push(svg('line', { x1: String(cx), y1: String(cy), x2: String(p[0]), y2: String(p[1]), class: 'me-radar__axis' }));
    });
    // shape
    var shape = skills.map(function (s, i) { return pt(i, s.val / 100).join(','); }).join(' ');
    children.push(svg('polygon', { points: shape, class: 'me-radar__shape' }));
    // dots
    skills.forEach(function (s, i) {
      var p = pt(i, s.val / 100);
      children.push(svg('circle', { cx: String(p[0]), cy: String(p[1]), r: '2.6', class: 'me-radar__pt' }));
    });
    // labels
    var labelOffset = 1.22;
    skills.forEach(function (s, i) {
      var a = angle(i);
      var x = cx + Math.cos(a) * rMax * labelOffset;
      var y = cy + Math.sin(a) * rMax * labelOffset;
      var anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
      var baseline = Math.sin(a) > 0.5 ? 'hanging' : Math.sin(a) < -0.5 ? 'auto' : 'middle';
      children.push(svg('text', { x: String(x), y: String(y), class: 'me-radar__lbl', 'text-anchor': anchor, 'dominant-baseline': baseline, text: s.name.split(' ')[0].toUpperCase() }));
    });

    return svg('svg', { viewBox: '0 0 ' + size + ' ' + size, class: 'me-radar' }, children);
  }

  /* ════════════════════════════════════════════════════
     COURT SVG BACKGROUND
     ════════════════════════════════════════════════════ */
  function buildCourtSVG() {
    return svg('svg', { class: 'me-hero__court', viewBox: '0 0 500 470', preserveAspectRatio: 'xMidYMid meet' }, [
      svg('rect', { width: '500', height: '470', rx: '4', class: 'court-bg' }),
      svg('rect', { x: '170', y: '0', width: '160', height: '190', class: 'paint-fill' }),
      svg('rect', { x: '170', y: '0', width: '160', height: '190', class: 'cl' }),
      svg('circle', { cx: '250', cy: '190', r: '60', class: 'cld' }),
      svg('circle', { cx: '250', cy: '52.5', r: '237.5', class: 'cl', style: 'clip-path:inset(142px 0 0 0)' }),
      svg('circle', { cx: '250', cy: '52.5', r: '40', class: 'cl' }),
      svg('line', { x1: '220', y1: '40', x2: '280', y2: '40', class: 'backboard' }),
      svg('circle', { cx: '250', cy: '52.5', r: '7.5', class: 'rim' })
    ]);
  }

  /* ════════════════════════════════════════════════════
     CIQ LOGO HELPER
     ════════════════════════════════════════════════════ */
  function buildLogo() {
    if (window.CIQLogo) {
      try {
        var el = window.CIQLogo({ accent: '#2dd4bf' });
        if (el) return el;
      } catch (e) { /* fallback */ }
    }
    // Fallback: simple text logo
    return h('div', { style: 'font-family:var(--display);font-size:14px;color:#2dd4bf;letter-spacing:0.08em', text: 'CIQ' });
  }

  /* ════════════════════════════════════════════════════
     PROFILE PAGE
     ════════════════════════════════════════════════════ */
  function buildHero(p, ctx) {
    return h('section', { class: 'me-sec me-sec--first' }, [
      h('div', { class: 'me-hero' }, [
        buildCourtSVG(),
        h('button', { class: 'me-avatar', 'aria-label': 'Customize avatar', onclick: ctx.customize }, [
          buildAvatarNode(p.avatarSeed, 84),
          h('span', { class: 'me-avatar__edit' }, [iconCustomize()])
        ]),
        h('div', { class: 'me-hero__name', text: p.name }),
        h('div', { class: 'me-hero__meta' }, [
          h('span', { class: 'me-hero__badge' }, [
            h('span', { class: 'me-hero__badge-dot' }),
            h('span', { text: ' ' + p.position.toUpperCase() })
          ]),
          h('span', { class: 'me-hero__badge me-hero__badge--accent' }, [
            h('span', { class: 'me-hero__badge-dot' }),
            h('span', { text: ' LEVEL ' + p.level })
          ])
        ]),
        h('div', { class: 'me-hero__hint', text: 'TAP AVATAR TO CUSTOMIZE' })
      ])
    ]);
  }

  function buildStatsStrip(p) {
    var xpK = (p.stats.xp / 1000).toFixed(1);
    return h('section', { class: 'me-sec' }, [
      h('div', { class: 'me-stats' }, [
        h('div', { class: 'me-stat me-glass' }, [
          h('div', { class: 'me-stat__icon' }, [iconSessions()]),
          h('div', { class: 'me-stat__num', text: String(p.stats.sessions) }),
          h('div', { class: 'me-stat__lbl', text: 'Sessions' })
        ]),
        h('div', { class: 'me-stat me-glass' }, [
          h('div', { class: 'me-stat__icon me-stat__icon--fire' }, [iconFlame()]),
          h('div', { class: 'me-stat__num' }, [
            document.createTextNode(String(p.stats.streak)),
            h('span', { text: 'DAY' })
          ]),
          h('div', { class: 'me-stat__lbl', text: 'Streak' })
        ]),
        h('div', { class: 'me-stat me-glass' }, [
          h('div', { class: 'me-stat__icon' }, [iconBolt()]),
          h('div', { class: 'me-stat__num' }, [
            document.createTextNode(xpK),
            h('span', { text: 'K' })
          ]),
          h('div', { class: 'me-stat__lbl', text: 'Total XP' })
        ])
      ])
    ]);
  }

  function buildArchetypeCard(p) {
    var arch = p.archetype;
    // skill bars
    var skillsList = h('div', { class: 'me-arch__skills' });
    arch.skills.forEach(function (s) {
      var isTop = s.val >= 85;
      var bar = h('div', { class: 'me-arch__skill-bar' }, [
        h('div', { class: 'me-arch__skill-fill', style: 'width:' + s.val + '%' })
      ]);
      skillsList.appendChild(h('div', { class: 'me-arch__skill' }, [
        h('span', { class: 'me-arch__skill-name', text: s.name }),
        h('span', { class: 'me-arch__skill-val' + (isTop ? ' me-arch__skill-val--top' : ''), text: String(s.val) }),
        bar
      ]));
    });

    // traits
    var traitsWrap = h('div', { class: 'me-arch__traits' });
    arch.traits.forEach(function (t) {
      traitsWrap.appendChild(h('span', { class: 'me-trait', text: t }));
    });

    return h('section', { class: 'me-sec' }, [
      h('div', { class: 'me-sec__head' }, [
        h('div', { class: 'me-sec__title', text: 'Archetype' }),
        h('div', { class: 'me-sec__more', text: arch.match + '% MATCH' })
      ]),
      h('div', { class: 'me-arch me-glass' }, [
        h('div', { class: 'me-arch__head' }, [
          h('div', null, [
            h('div', { class: 'me-arch__eyebrow', text: 'PLAYER TYPE' }),
            h('h2', { class: 'me-arch__name', text: arch.name })
          ]),
          h('div', { class: 'me-arch__match', text: 'A+' })
        ]),
        h('div', { class: 'me-arch__body' }, [
          buildRadar(arch.skills, 180),
          skillsList
        ]),
        traitsWrap
      ])
    ]);
  }

  function buildTrophyCarousel() {
    var trophies = FIXTURE.trophies;
    var earned = trophies.filter(function (t) { return t.earned; }).length;
    var carousel = h('div', { class: 'me-trophies' });
    trophies.forEach(function (t) {
      var circleContent = t.earned ? trophyIcon(t.icon) : iconLock(24);
      carousel.appendChild(h('div', { class: 'me-trophy' + (t.earned ? '' : ' is-locked') }, [
        h('div', { class: 'me-trophy__circle' }, [circleContent]),
        h('div', { class: 'me-trophy__lbl', text: t.label })
      ]));
    });
    return h('section', { class: 'me-sec' }, [
      h('div', { class: 'me-sec__head' }, [
        h('div', { class: 'me-sec__title', text: 'Trophies · ' + earned + '/' + trophies.length }),
        h('button', { class: 'me-sec__more', text: 'View All →' })
      ]),
      carousel
    ]);
  }

  function buildSocialCard(ctx) {
    var lb = FIXTURE.leaderboard;
    var rows = h('div', { class: 'me-leader' });
    lb.forEach(function (row) {
      var xpK = (row.xp / 1000).toFixed(1);
      rows.appendChild(h('div', { class: 'me-leader__row' + (row.isMe ? ' is-me' : '') }, [
        h('span', { class: 'me-leader__rank', text: String(row.rank) }),
        h('span', { class: 'me-leader__avatar' }, [buildAvatarNode(row.seed, 28)]),
        h('span', { class: 'me-leader__name', text: row.name + (row.isMe ? ' (you)' : '') }),
        h('span', { class: 'me-leader__xp' }, [
          document.createTextNode(xpK),
          h('span', { text: 'K XP' })
        ])
      ]));
    });

    return h('section', { class: 'me-sec' }, [
      h('div', { class: 'me-sec__head' }, [
        h('div', { class: 'me-sec__title', text: 'Friends' }),
        h('button', { class: 'me-sec__more', text: 'Leaderboard →', onclick: ctx.leaderboard })
      ]),
      h('div', { class: 'me-social me-glass' }, [
        h('div', { class: 'me-social__head' }, [
          h('div', { class: 'me-social__title', text: 'Top this week' }),
          h('div', { class: 'me-social__sub', text: 'XP · 7D' })
        ]),
        rows,
        h('div', { class: 'me-social__cta' }, [
          h('button', { class: 'me-social__primary', onclick: ctx.sendChallenge }, [
            iconSend(),
            document.createTextNode(' Send Challenge')
          ]),
          h('button', { class: 'me-social__secondary', onclick: ctx.copyLink }, [
            iconLink(),
            document.createTextNode(' Copy Link')
          ])
        ])
      ])
    ]);
  }

  function buildProfilePage(p, ctx) {
    return [
      buildHero(p, ctx),
      buildStatsStrip(p),
      buildArchetypeCard(p),
      buildTrophyCarousel(),
      buildSocialCard(ctx),
      h('div', { class: 'me-foot', text: 'CourtIQ · Me · §6.16' })
    ];
  }

  /* ════════════════════════════════════════════════════
     TROPHIES PAGE (full sub-tab)
     ════════════════════════════════════════════════════ */
  function buildTrophiesPage() {
    var trophies = FIXTURE.trophies;
    var earned = trophies.filter(function (t) { return t.earned; }).length;
    var grid = h('div', { class: 'me-trophies', style: 'flex-wrap:wrap' });
    trophies.forEach(function (t) {
      var circleContent = t.earned ? trophyIcon(t.icon) : iconLock(24);
      grid.appendChild(h('div', { class: 'me-trophy' + (t.earned ? '' : ' is-locked') }, [
        h('div', { class: 'me-trophy__circle' }, [circleContent]),
        h('div', { class: 'me-trophy__lbl', text: t.label })
      ]));
    });
    return [
      h('section', { class: 'me-sec me-sec--first' }, [
        h('div', { class: 'me-sec__head' }, [
          h('div', { class: 'me-sec__title', text: 'Trophy Case' }),
          h('div', { class: 'me-sec__more', text: earned + '/' + trophies.length })
        ]),
        grid
      ])
    ];
  }

  /* ════════════════════════════════════════════════════
     SOCIAL PAGE (full sub-tab)
     ════════════════════════════════════════════════════ */
  function buildSocialPage(ctx) {
    var lb = FIXTURE.leaderboard;
    var rows = h('div', { class: 'me-leader' });
    lb.forEach(function (row) {
      var xpK = (row.xp / 1000).toFixed(1);
      rows.appendChild(h('div', { class: 'me-leader__row' + (row.isMe ? ' is-me' : '') }, [
        h('span', { class: 'me-leader__rank', text: String(row.rank) }),
        h('span', { class: 'me-leader__avatar' }, [buildAvatarNode(row.seed, 28)]),
        h('span', { class: 'me-leader__name', text: row.name + (row.isMe ? ' (you)' : '') }),
        h('span', { class: 'me-leader__xp' }, [
          document.createTextNode(xpK),
          h('span', { text: 'K XP' })
        ])
      ]));
    });
    return [
      h('section', { class: 'me-sec me-sec--first' }, [
        h('div', { class: 'me-sec__head' }, [h('div', { class: 'me-sec__title', text: 'Leaderboard' })]),
        h('div', { class: 'me-glass me-social' }, [
          h('div', { class: 'me-social__head' }, [
            h('div', { class: 'me-social__title', text: 'Top this week' }),
            h('div', { class: 'me-social__sub', text: 'XP · 7D' })
          ]),
          rows
        ])
      ]),
      h('section', { class: 'me-sec' }, [
        h('div', { class: 'me-social__cta' }, [
          h('button', { class: 'me-social__primary', onclick: ctx.sendChallenge }, [
            iconSend(),
            document.createTextNode(' Send Challenge')
          ]),
          h('button', { class: 'me-social__secondary', onclick: ctx.copyLink }, [
            iconLink(),
            document.createTextNode(' Copy Link')
          ])
        ])
      ])
    ];
  }

  /* ════════════════════════════════════════════════════
     SHOP PAGE (matches me-shop.jsx)
     ════════════════════════════════════════════════════ */
  var shopState = {
    category: 'accessories',
    owned: {},    // id -> true
    equipped: {}  // id -> true
  };
  // Pre-populate owned from catalog defaults
  SHOP_ITEMS.forEach(function (i) { if (i.owned) shopState.owned[i.id] = true; });

  function shopAvatarImg(size, overrides, extraClass) {
    var img = document.createElement('img');
    img.className = 'shop-av' + (extraClass ? ' ' + extraClass : '');
    img.src = dicebearURL(overrides || {});
    img.width = size; img.height = size; img.alt = '';
    img.loading = 'lazy';
    img.style.width = size + 'px';
    img.style.height = size + 'px';
    return img;
  }

  function handleShopTap(item, p) {
    var id = item.id;
    var isOwned = shopState.owned[id] || item.owned;
    var isLocked = !isOwned && !!item.levelReq && p.level < item.levelReq;
    if (isLocked) return;
    if (isOwned) {
      // toggle equip
      if (shopState.equipped[id]) {
        delete shopState.equipped[id];
      } else {
        // unequip others in same category
        SHOP_ITEMS.forEach(function (i) { if (i.cat === item.cat) delete shopState.equipped[i.id]; });
        shopState.equipped[id] = true;
      }
    } else if (item.free) {
      shopState.owned[id] = true;
    } else if (p.coins >= item.price) {
      shopState.owned[id] = true;
      p.coins -= item.price;
    }
    paint();
  }

  function buildShopItemCard(item, p) {
    var owned = shopState.owned[item.id] || item.owned;
    var equipped = shopState.equipped[item.id];
    var locked = !owned && !!item.levelReq && p.level < item.levelReq;
    var affordable = item.free ? true : p.coins >= (item.price || 0);

    var klasses = ['shop-card'];
    if (owned) klasses.push('is-owned');
    if (equipped) klasses.push('is-equipped');
    if (locked) klasses.push('is-locked');
    if (!affordable && !owned && !locked) klasses.push('is-broke');

    var children = [];
    // tag
    if (item.tag && !owned && !locked) {
      children.push(h('span', { class: 'shop-card__tag', text: item.tag }));
    }
    // preview
    var pvChildren = [shopAvatarImg(64, item.params)];
    if (locked) {
      pvChildren.push(h('span', { class: 'shop-card__lock-glyph' }, [iconLock(18)]));
    }
    if (equipped) {
      pvChildren.push(h('span', { class: 'shop-card__eq-badge' }, [iconCheck(11)]));
    }
    children.push(h('div', { class: 'shop-card__pv' }, pvChildren));
    // name
    children.push(h('div', { class: 'shop-card__name', text: item.name }));
    // bottom row
    if (locked) {
      children.push(h('div', { class: 'shop-card__lvl' }, [
        iconLock(9),
        h('span', { text: 'LEVEL ' + item.levelReq })
      ]));
    } else if (owned) {
      children.push(h('div', { class: 'shop-card__cta ' + (equipped ? 'is-eq' : 'is-owned'), text: equipped ? 'EQUIPPED' : 'EQUIP' }));
    } else if (item.free) {
      children.push(h('div', { class: 'shop-card__cta is-claim', text: 'CLAIM FREE' }));
    } else {
      children.push(h('div', { class: 'shop-card__price' + (affordable ? '' : ' is-short') }, [
        iconCoin(11),
        h('span', { text: String(item.price) })
      ]));
    }

    return h('button', { class: klasses.join(' '), onclick: function () { handleShopTap(item, p); } }, children);
  }

  function buildShopFeaturedCard(item, p) {
    var owned = shopState.owned[item.id] || item.owned;
    var equipped = shopState.equipped[item.id];
    var affordable = p.coins >= (item.price || 0);

    var ctaRow = h('div', { class: 'shop-featured__cta-row' });
    if (owned) {
      ctaRow.appendChild(h('span', { class: 'shop-featured__cta ' + (equipped ? 'is-eq' : 'is-owned'), text: equipped ? 'EQUIPPED' : 'EQUIP NOW' }));
    } else {
      ctaRow.appendChild(h('span', { class: 'shop-featured__price' }, [
        iconCoin(14),
        h('span', { text: String(item.price) })
      ]));
      ctaRow.appendChild(h('span', { class: 'shop-featured__cta' + (affordable ? '' : ' is-short'), text: affordable ? 'BUY NOW' : 'NEED MORE COINS' }));
    }

    return h('button', { class: 'shop-featured', onclick: function () { handleShopTap(item, p); } }, [
      h('div', { class: 'shop-featured__l' }, [
        h('div', { class: 'shop-featured__eyebrow', text: 'FEATURED · LIMITED DROP' }),
        h('div', { class: 'shop-featured__name', text: item.name }),
        h('div', { class: 'shop-featured__desc', text: 'Equip to flex on the leaderboard.' }),
        ctaRow
      ]),
      h('div', { class: 'shop-featured__r' }, [
        shopAvatarImg(100, item.params),
        h('div', { class: 'shop-featured__r-glow' })
      ])
    ]);
  }

  function buildShopPage(p) {
    var cat = shopState.category;
    var allByCat = SHOP_ITEMS.filter(function (i) { return i.cat === cat; });
    var accItems = SHOP_ITEMS.filter(function (i) { return i.cat === 'accessories'; });
    var featured = null;
    for (var fi = 0; fi < accItems.length; fi++) {
      if (accItems[fi].tag === 'FEATURED') { featured = accItems[fi]; break; }
    }
    if (!featured && accItems.length) featured = accItems[0];

    var shopChildren = [];

    // Wallet bar
    shopChildren.push(h('div', { class: 'shop-wallet' }, [
      h('div', { class: 'shop-wallet__l' }, [
        h('span', { class: 'shop-wallet__coin' }, [iconCoin(20)]),
        h('div', { class: 'shop-wallet__nums' }, [
          h('div', { class: 'shop-wallet__bal', text: p.coins.toLocaleString() }),
          h('div', { class: 'shop-wallet__sub', text: 'COINS' })
        ])
      ]),
      h('div', { class: 'shop-wallet__lvl' }, [
        h('span', { class: 'shop-wallet__lvl-num', text: 'LV ' + p.level })
      ]),
      h('button', { class: 'shop-wallet__earn', text: 'Earn more →', onclick: function () {
        try { if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('train'); } catch (e) {}
      }})
    ]));

    // Category tabs
    var tabs = h('div', { class: 'shop-tabs' });
    SHOP_CATEGORIES.forEach(function (c) {
      tabs.appendChild(h('button', {
        class: 'shop-tab' + (cat === c.id ? ' is-active' : ''),
        text: c.label,
        onclick: function () { shopState.category = c.id; paint(); }
      }));
    });
    shopChildren.push(tabs);

    // Featured card (accessories only)
    if (cat === 'accessories' && featured) {
      shopChildren.push(buildShopFeaturedCard(featured, p));
    }

    // Grid
    var gridItems = allByCat.filter(function (i) {
      return !(cat === 'accessories' && featured && i.id === featured.id);
    });
    var grid = h('div', { class: 'shop-grid' });
    gridItems.forEach(function (i) {
      grid.appendChild(buildShopItemCard(i, p));
    });
    shopChildren.push(grid);

    // Empty wallet state
    var cheapest = Infinity;
    accItems.forEach(function (i) { if (!i.free && i.price < cheapest) cheapest = i.price; });
    if (p.coins === 0 && cheapest !== Infinity && cat === 'accessories') {
      shopChildren.push(h('div', { class: 'shop-empty' }, [
        h('div', { class: 'shop-empty__icon' }, [iconCoin(28)]),
        h('div', { class: 'shop-empty__title', text: 'Need more coins?' }),
        h('div', { class: 'shop-empty__sub', text: 'Earn XP through training to level up your wallet.' }),
        h('button', { class: 'shop-empty__cta', text: 'START WORKOUT →', onclick: function () {
          try { if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('train'); } catch (e) {}
        }})
      ]));
    }

    return [h('div', { class: 'shop' }, shopChildren)];
  }

  /* ════════════════════════════════════════════════════
     MAIN RENDER LOOP
     ════════════════════════════════════════════════════ */
  var state = { tab: 'profile' };
  var hostRef = null;

  function paint() {
    if (!hostRef) return;
    var p = realProfile();
    var ctx = {
      customize: function () {
        if (window.CIQ_SHELL) {
          window.CIQ_SHELL.switchTo('avatar-customizer');
        } else if (window.CourtIQ_V2_AvatarCustomizer && typeof window.CourtIQ_V2_AvatarCustomizer.render === 'function') {
          window.CourtIQ_V2_AvatarCustomizer.render();
        } else if (window.avatarCustomizer && typeof window.avatarCustomizer.open === 'function') {
          window.avatarCustomizer.open();
        }
      },
      openSettings: function () { /* TODO: settings sheet */ },
      leaderboard: function () { state.tab = 'social'; paint(); },
      sendChallenge: function () {
        try { if (window.socialHub && typeof window.socialHub.sendChallenge === 'function') window.socialHub.sendChallenge(); }
        catch (e) {}
      },
      copyLink: function () {
        try { if (navigator.clipboard) navigator.clipboard.writeText(window.location.href); }
        catch (e) {}
      }
    };

    DOM.clearChildren(hostRef);

    // Stamp header
    var stamp = h('div', { class: 'me-stamp' }, [
      h('div', { class: 'me-stamp__l' }, [
        buildLogo(),
        h('div', null, [
          h('div', { class: 'me-stamp__eyebrow', text: 'ME · IDENTITY' }),
          h('div', { class: 'me-stamp__meta', text: 'LV ' + p.level + ' · ' + p.totalXP.toLocaleString() + ' XP' })
        ])
      ]),
      h('button', { class: 'me-stamp__icon-btn me-stamp__gear', 'aria-label': 'Settings',
        onclick: ctx.openSettings }, [settingsIcon()])
    ]);

    // Sub-nav
    var subnav = h('div', { class: 'me-subnav' });
    [{ id: 'profile', label: 'Profile' }, { id: 'trophies', label: 'Trophies' },
     { id: 'social', label: 'Social' }, { id: 'shop', label: 'Shop' }].forEach(function (c) {
      subnav.appendChild(h('button', {
        class: 'me-chip' + (state.tab === c.id ? ' is-active' : ''), text: c.label,
        onclick: function () { state.tab = c.id; paint(); }
      }));
    });

    // Page content
    var pageNodes;
    if (state.tab === 'profile')       pageNodes = buildProfilePage(p, ctx);
    else if (state.tab === 'trophies') pageNodes = buildTrophiesPage();
    else if (state.tab === 'social')   pageNodes = buildSocialPage(ctx);
    else                               pageNodes = buildShopPage(p);

    var scroll = h('div', { class: 'me-scroll' });
    pageNodes.forEach(function (n) { if (n) scroll.appendChild(n); });

    var screen = h('div', { class: 'me' }, [stamp, subnav, scroll]);
    hostRef.appendChild(screen);
  }

  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-me');
    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_Me = { render: render, cleanup: cleanup };
})();
