/* CourtIQ UI v2 — Avatar Customizer overlay (Wave 1 redesign)
 *
 * Fullscreen overlay opened from Me tab when user taps their avatar.
 * Renders DiceBear Avataaars with category-based option grid.
 * Wires back to Me tab on close; hides bottom nav while active.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.ME_TAB) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[avatar-customizer-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  /* ═══════════════════════════════════════════════════════
     FIXTURE DATA
     ═══════════════════════════════════════════════════════ */
  var FIXTURE = {
    name: 'Alex Rivera',
    archetype: 'The Sniper',
    position: 'Combo Guard',
    level: 14,
    coins: 450,
    seed: 'alex-rivera',
    equipped: { top: 'shortHair', facialHair: 'blank', accessories: 'blank', clothing: 'blazerAndShirt', skin: 'light' },
    categories: [
      { id: 'top', label: 'Hair', options: [
        { id: 'shortHair', name: 'Short', status: 'equipped' },
        { id: 'dreads01', name: 'Dreads', status: 'owned' },
        { id: 'frizzle', name: 'Buzz', status: 'owned' },
        { id: 'bigHair', name: 'Afro', status: 'owned' },
        { id: 'shaggy', name: 'Fade', status: 'owned' },
        { id: 'hat', name: 'Mohawk', status: 'locked', price: 150 }
      ]},
      { id: 'facialHair', label: 'Facial Hair', options: [
        { id: 'blank', name: 'None', status: 'equipped' },
        { id: 'beardLight', name: 'Stubble', status: 'owned' },
        { id: 'beardMagestic', name: 'Goatee', status: 'locked', price: 100 }
      ]},
      { id: 'accessories', label: 'Accessories', options: [
        { id: 'blank', name: 'None', status: 'equipped' },
        { id: 'kurt', name: 'Sport Glasses', status: 'locked', price: 150 },
        { id: 'prescription02', name: 'Headband', status: 'locked', price: 100 }
      ]},
      { id: 'clothing', label: 'Clothing', options: [
        { id: 'blazerAndShirt', name: 'Jersey', status: 'equipped' },
        { id: 'hoodie', name: 'Hoodie', status: 'owned' },
        { id: 'overall', name: 'Tank', status: 'owned' }
      ]}
    ]
  };

  /* ═══════════════════════════════════════════════════════
     STATE
     ═══════════════════════════════════════════════════════ */
  var hostRef = null;
  var state = {
    activeCategory: 'top',
    selected: null  // cloned from equipped on mount
  };

  function initState() {
    state.activeCategory = 'top';
    state.selected = JSON.parse(JSON.stringify(FIXTURE.equipped));
  }

  /* ═══════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════ */
  function avatarURL(overrides) {
    var s = state.selected || FIXTURE.equipped;
    var top        = (overrides && overrides.top)        || s.top;
    var facialHair = (overrides && overrides.facialHair)  || s.facialHair;
    var accessories= (overrides && overrides.accessories) || s.accessories;
    var clothing   = (overrides && overrides.clothing)    || s.clothing;
    var skin       = (overrides && overrides.skin)        || s.skin;
    return 'https://api.dicebear.com/9.x/avataaars/svg?seed=' + FIXTURE.seed +
      '&top=' + top + '&facialHair=' + facialHair +
      '&accessories=' + accessories + '&clothing=' + clothing + '&skin=' + skin;
  }

  function backIcon() {
    return svg('svg', { width: '14', height: '14', viewBox: '0 0 14 14', fill: 'none' },
      [svg('path', { d: 'M9 2L4 7l5 5', stroke: 'currentColor', 'stroke-width': '2',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]);
  }

  function coinIcon(size) {
    var s = size || 16;
    return svg('svg', { width: String(s), height: String(s), viewBox: '0 0 24 24', fill: 'none' }, [
      svg('circle', { cx: '12', cy: '12', r: '10', fill: '#facc15' }),
      svg('text', { x: '12', y: '16', 'text-anchor': 'middle', 'font-size': '12', 'font-weight': 'bold', fill: '#78350f', text: '$' })
    ]);
  }

  function lockIcon() {
    return svg('svg', { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'none' }, [
      svg('rect', { x: '5', y: '11', width: '14', height: '11', rx: '2', fill: 'currentColor', opacity: '0.6' }),
      svg('path', { d: 'M8 11V7a4 4 0 118 0v4', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }),
      svg('circle', { cx: '12', cy: '16.5', r: '1', fill: 'currentColor' })
    ]);
  }

  function checkIcon() {
    return svg('svg', { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'none' }, [
      svg('path', { d: 'M4 12.5l5.5 5.5L20 6', stroke: 'currentColor', 'stroke-width': '2.2',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    ]);
  }

  /* ═══════════════════════════════════════════════════════
     BUILD SECTIONS
     ═══════════════════════════════════════════════════════ */

  function buildTopBar() {
    var backBtn = h('button', { class: 'ac-topbar__back', 'aria-label': 'Back', onclick: goBack }, [backIcon()]);

    var title = h('span', { class: 'ac-topbar__title', text: 'MYPLAYER · CUSTOMIZE' });

    var coinPill = h('div', { class: 'ac-topbar__coins' }, [
      coinIcon(16),
      h('span', { class: 'ac-topbar__coins-val', text: String(FIXTURE.coins) })
    ]);

    return h('div', { class: 'ac-topbar' }, [backBtn, title, coinPill]);
  }

  function buildPreviewCard() {
    var avatarImg = h('img', { class: 'ac-preview__avatar', src: avatarURL(), alt: 'Avatar preview' });

    var levelBadge = h('span', { class: 'ac-preview__level', text: 'LV ' + FIXTURE.level });

    var info = h('div', { class: 'ac-preview__info' }, [
      h('h2', { class: 'ac-preview__name', text: FIXTURE.name }),
      h('div', { class: 'ac-preview__meta', text: FIXTURE.archetype + ' · ' + FIXTURE.position }),
      levelBadge
    ]);

    return h('div', { class: 'ac-preview me-glass' }, [avatarImg, info]);
  }

  function buildCategoryTabs() {
    var wrap = h('div', { class: 'ac-cats' });
    FIXTURE.categories.forEach(function (cat) {
      var isActive = state.activeCategory === cat.id;
      wrap.appendChild(h('button', {
        class: 'ac-cat-pill' + (isActive ? ' is-active' : ''),
        text: cat.label,
        onclick: function () { state.activeCategory = cat.id; paint(); }
      }));
    });
    return wrap;
  }

  function buildOptionsGrid() {
    var cat = null;
    for (var i = 0; i < FIXTURE.categories.length; i++) {
      if (FIXTURE.categories[i].id === state.activeCategory) { cat = FIXTURE.categories[i]; break; }
    }
    if (!cat) return h('div');

    var grid = h('div', { class: 'ac-grid' });
    cat.options.forEach(function (opt) {
      var isEquipped = state.selected[cat.id] === opt.id;
      var overrides = {};
      overrides[cat.id] = opt.id;
      var miniURL = avatarURL(overrides);

      var miniImg = h('img', { class: 'ac-tile__img', src: miniURL, alt: opt.name, loading: 'lazy' });

      var badge;
      if (isEquipped) {
        badge = h('span', { class: 'ac-tile__badge ac-tile__badge--equipped' }, [checkIcon(), h('span', { text: 'EQUIPPED' })]);
      } else if (opt.status === 'locked') {
        badge = h('span', { class: 'ac-tile__badge ac-tile__badge--locked' }, [lockIcon(), h('span', { text: String(opt.price) })]);
      } else {
        badge = h('span', { class: 'ac-tile__badge ac-tile__badge--owned', text: 'OWNED' });
      }

      var tile = h('button', {
        class: 'ac-tile me-glass' + (isEquipped ? ' is-equipped' : ''),
        onclick: function () {
          if (opt.status !== 'locked') {
            state.selected[cat.id] = opt.id;
            paint();
          }
        }
      }, [miniImg, h('span', { class: 'ac-tile__name', text: opt.name }), badge]);

      grid.appendChild(tile);
    });

    return h('div', { class: 'ac-grid-wrap me-glass' }, [grid]);
  }

  function buildBottomBar() {
    var saveBtn = h('button', { class: 'ac-action ac-action--save', text: 'SAVE CHANGES', onclick: function () {
      /* TODO: persist selection */
      goBack();
    }});
    var shopBtn = h('button', { class: 'ac-action ac-action--shop', onclick: function () {
      /* TODO: navigate to shop */
    }}, [coinIcon(14), h('span', { text: 'OPEN SHOP' })]);
    var resetBtn = h('button', { class: 'ac-action ac-action--reset', text: 'RESET', onclick: function () {
      state.selected = JSON.parse(JSON.stringify(FIXTURE.equipped));
      paint();
    }});

    return h('div', { class: 'ac-bottom' }, [saveBtn, shopBtn, resetBtn]);
  }

  /* ═══════════════════════════════════════════════════════
     NAVIGATION
     ═══════════════════════════════════════════════════════ */
  function goBack() {
    cleanup();
    if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('me');
  }

  /* ═══════════════════════════════════════════════════════
     PAINT / RENDER / CLEANUP
     ═══════════════════════════════════════════════════════ */
  function paint() {
    if (!hostRef) return;
    DOM.clearChildren(hostRef);

    var topBar       = buildTopBar();
    var preview      = buildPreviewCard();
    var catTabs      = buildCategoryTabs();
    var optionsGrid  = buildOptionsGrid();
    var bottomBar    = buildBottomBar();

    var scroll = h('div', { class: 'ac-scroll' }, [preview, catTabs, optionsGrid]);
    var screen = h('div', { class: 'ac' }, [topBar, scroll, bottomBar]);
    hostRef.appendChild(screen);
  }

  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-avatar-customizer');
    initState();

    // hide bottom nav
    var nav = document.querySelector('.ciq-nav');
    if (nav) nav.style.display = 'none';

    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);

    // restore bottom nav
    var nav = document.querySelector('.ciq-nav');
    if (nav) nav.style.display = '';

    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_AvatarCustomizer = { render: render, cleanup: cleanup };
})();
