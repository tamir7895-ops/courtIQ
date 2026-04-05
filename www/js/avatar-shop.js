/* ============================================================
   AVATAR SHOP — /js/avatar-shop.js
   Accessory store connected to XP/level system.
   Players spend XP-earned coins to unlock avatar accessories.
   ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'courtiq-avatar-shop';

  /* ── Shop Items ────────────────────────────────────────────── */
  /* Each item has a type, id, display name, cost, and required level */
  var SHOP_ITEMS = [
    /* Accessories — equippable on avatar */
    { type: 'accessory', id: 'headband',  name: 'Headband',      icon: '🏋️', cost: 50,  level: 'Rookie',   desc: 'Classic workout headband' },
    { type: 'accessory', id: 'sweatband', name: 'Sweatband',     icon: '💦', cost: 50,  level: 'Rookie',   desc: 'Thick terry cloth sweatband' },
    { type: 'accessory', id: 'armband',   name: 'Arm Band',      icon: '💪', cost: 75,  level: 'Rookie',   desc: 'Gold armband on your bicep' },
    { type: 'accessory', id: 'glasses',   name: 'Sport Glasses', icon: '🕶️', cost: 100, level: 'Hooper',   desc: 'Wraparound sport shades' },
    { type: 'accessory', id: 'chain',     name: 'Gold Chain',    icon: '⛓️', cost: 150, level: 'Hooper',   desc: 'Gold chain with IQ pendant' },
    { type: 'accessory', id: 'durag',     name: 'Durag',         icon: '👑', cost: 200, level: 'All-Star',  desc: 'Navy blue durag' },

    /* Hair styles — unlock premium styles */
    { type: 'hair', id: 'mohawk',   name: 'Mohawk',   icon: '✂️', cost: 80,  level: 'Rookie',  desc: 'Tall central crest with shaved sides' },
    { type: 'hair', id: 'waves',    name: 'Waves',    icon: '🌊', cost: 80,  level: 'Rookie',  desc: 'Clean 360 wave pattern' },
    { type: 'hair', id: 'cornrows', name: 'Cornrows', icon: '🔥', cost: 120, level: 'Hooper',  desc: 'Tight braided rows front to back' },

    /* Beard styles — unlock new beard options */
    { type: 'beard', id: 'goatee',    name: 'Goatee',    icon: '🧔', cost: 60,  level: 'Rookie',  desc: 'Classic chin goatee + mustache' },
    { type: 'beard', id: 'chinstrap', name: 'Chinstrap', icon: '✨', cost: 80,  level: 'Hooper',  desc: 'Clean jawline chinstrap' }
  ];

  /* Items that are FREE from the start (not in the shop) */
  var FREE_ITEMS = {
    accessory: ['none'],
    hair: ['buzz', 'short', 'fade', 'afro', 'dreads', 'bald'],
    beard: ['none', 'stubble', 'short', 'full']
  };

  /* ── State ─────────────────────────────────────────────────── */
  function loadShop() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { coins: 0, owned: [], equipped: null };
    } catch (e) {
      return { coins: 0, owned: [], equipped: null };
    }
  }

  function saveShop(state) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) { /* silent */ }
  }

  /* Coins: 1 XP = 1 coin (coins are earned alongside XP) */
  function getCoins() {
    var xpData = null;
    try { xpData = JSON.parse(localStorage.getItem('courtiq-xp')); } catch (e) {}
    var totalXP = (xpData && xpData.xp) ? xpData.xp : 0;

    var shop = loadShop();
    /* Total coins = total XP ever earned - coins spent */
    var spent = 0;
    if (shop.purchases) {
      for (var i = 0; i < shop.purchases.length; i++) {
        spent += shop.purchases[i].cost || 0;
      }
    }
    return Math.max(0, totalXP - spent);
  }

  function isOwned(itemId) {
    var shop = loadShop();
    return shop.owned && shop.owned.indexOf(itemId) !== -1;
  }

  function isFreeItem(type, itemId) {
    /* v3: all items are free — no shop locks */
    return true;
  }

  function meetsLevelReq(levelName) {
    var LEVEL_ORDER = ['Rookie', 'Hooper', 'All-Star', 'MVP'];
    var requiredIdx = LEVEL_ORDER.indexOf(levelName);
    if (requiredIdx < 0) return true;

    var xpData = null;
    try { xpData = JSON.parse(localStorage.getItem('courtiq-xp')); } catch (e) {}
    var xp = (xpData && xpData.xp) ? xpData.xp : 0;

    var THRESHOLDS = [0, 200, 600, 1500];
    var playerIdx = 0;
    for (var i = THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= THRESHOLDS[i]) { playerIdx = i; break; }
    }
    return playerIdx >= requiredIdx;
  }

  /* ── Purchase ──────────────────────────────────────────────── */
  function purchaseItem(itemId) {
    var item = SHOP_ITEMS.find(function (i) { return i.id === itemId; });
    if (!item) return { ok: false, msg: 'Item not found' };

    if (isOwned(itemId)) return { ok: false, msg: 'Already owned' };

    var shop = loadShop();
    if (!shop.owned) shop.owned = [];
    if (!shop.purchases) shop.purchases = [];

    /* v3: all items are free — skip coin & level checks */
    if (isFreeItem(item.type, itemId)) {
      shop.owned.push(itemId);
      shop.purchases.push({ id: itemId, cost: 0, ts: Date.now() });
      saveShop(shop);
      return { ok: true, msg: item.name + ' unlocked!' };
    }

    /* Legacy path: paid items require level + coins */
    if (!meetsLevelReq(item.level)) return { ok: false, msg: 'Level too low — reach ' + item.level + ' rank first' };
    var coins = getCoins();
    if (coins < item.cost) return { ok: false, msg: 'Not enough coins (' + coins + '/' + item.cost + ')' };

    shop.owned.push(itemId);
    shop.purchases.push({ id: itemId, cost: item.cost, ts: Date.now() });
    saveShop(shop);

    return { ok: true, msg: item.name + ' unlocked!' };
  }

  /* ── Equip accessory on avatar ─────────────────────────────── */
  function equipAccessory(accessoryId) {
    if (accessoryId !== 'none' && !isOwned(accessoryId) && !isFreeItem('accessory', accessoryId)) {
      return false;
    }

    /* Update avatar data in onboarding store */
    try {
      var ob = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}');
      if (!ob.avatar) ob.avatar = {};
      ob.avatar.accessory = accessoryId;
      localStorage.setItem('courtiq-onboarding-data', JSON.stringify(ob));
    } catch (e) { /* silent */ }

    /* Re-render profile mini avatar */
    if (typeof PlayerProfile !== 'undefined' && PlayerProfile.renderSummary) {
      PlayerProfile.renderSummary();
    }

    return true;
  }

  /* ── Render Shop Panel ─────────────────────────────────────── */
  function render() {
    var container = document.getElementById('shop-grid');
    if (!container) return;

    var coins = getCoins();

    /* Update coin display */
    var coinEl = document.getElementById('shop-coin-count');
    if (coinEl) coinEl.textContent = coins;

    /* Group items by type */
    var groups = { accessory: [], hair: [], beard: [] };
    SHOP_ITEMS.forEach(function (item) {
      if (groups[item.type]) groups[item.type].push(item);
    });

    var html = '';

    var groupLabels = {
      accessory: '🎽 Accessories',
      hair: '✂️ Hair Styles',
      beard: '🧔 Beard Styles'
    };

    Object.keys(groups).forEach(function (type) {
      var items = groups[type];
      if (!items.length) return;

      html += '<div class="shop-section">';
      html += '<div class="shop-section-title">' + groupLabels[type] + '</div>';
      html += '<div class="shop-items">';

      items.forEach(function (item) {
        var owned = isOwned(item.id);
        var affordable = coins >= item.cost;
        var levelOk = meetsLevelReq(item.level);
        var statusCls = owned ? 'shop-item--owned' : (isFreeItem(item.type, item.id) ? '' : (!levelOk ? 'shop-item--locked' : (!affordable ? 'shop-item--expensive' : '')));

        html += '<div class="shop-item ' + statusCls + '" data-item-id="' + item.id + '" data-item-type="' + item.type + '">';
        html += '<div class="shop-item-icon">' + item.icon + '</div>';
        html += '<div class="shop-item-info">';
        html += '<div class="shop-item-name">' + item.name + '</div>';
        html += '<div class="shop-item-desc">' + item.desc + '</div>';
        html += '</div>';
        html += '<div class="shop-item-action">';

        var isFree = isFreeItem(item.type, item.id);
        if (owned) {
          if (item.type === 'accessory') {
            html += '<button class="shop-equip-btn" data-equip="' + item.id + '">Equip</button>';
          } else {
            html += '<span class="shop-owned-badge">✓ Owned</span>';
          }
        } else if (isFree) {
          html += '<button class="shop-buy-btn shop-buy-btn--free" data-buy="' + item.id + '">Claim Free</button>';
        } else if (!levelOk) {
          html += '<span class="shop-lock-badge">🔒 ' + item.level + '</span>';
        } else {
          html += '<button class="shop-buy-btn" data-buy="' + item.id + '"><span class="shop-coin-icon">🪙</span> ' + item.cost + '</button>';
        }

        html += '</div>';
        html += '</div>';
      });

      html += '</div></div>';
    });

    container.innerHTML = html;

    /* Wire buy buttons */
    container.querySelectorAll('.shop-buy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.buy;
        var result = purchaseItem(id);
        if (result.ok) {
          if (typeof showToast === 'function') showToast(result.msg);
          render();
        } else {
          if (typeof showToast === 'function') showToast(result.msg, true);
        }
      });
    });

    /* Wire equip buttons */
    container.querySelectorAll('.shop-equip-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.equip;
        equipAccessory(id);
        if (typeof showToast === 'function') showToast('Equipped!');
        render();
      });
    });
  }

  /* ── Init ──────────────────────────────────────────────────── */
  function init() {
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AvatarShop = {
    render: render,
    purchaseItem: purchaseItem,
    equipAccessory: equipAccessory,
    getCoins: getCoins,
    isOwned: isOwned,
    isFreeItem: isFreeItem,
    FREE_ITEMS: FREE_ITEMS,
    SHOP_ITEMS: SHOP_ITEMS
  };
})();
