/* CourtIQ UI v2 — Me tab renderer (Wave 1 redesign)
 *
 * Ports _design-import/v2/components/me-screen.jsx (compact). Single
 * scrollable screen with sub-nav chips: Profile, Trophies, Social, Shop.
 * Wires to DataService / Gamification / AvatarCustomizer / SocialHub
 * when their globals exist; falls back to fixture data.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.ME_TAB) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[me-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  var FIXTURE = {
    profile: {
      name: 'Alex Rivera', position: 'Combo Guard',
      level: 14, levelName: 'ALL-STAR', totalXP: 12488, weeklyXP: 320,
      avatarSeed: 'alex-rivera-1',
      coins: 320, archetype: 'Score-First Combo', signature: 'Catch-and-shoot · midrange'
    },
    stats: [
      { lbl: 'GAMES',     val: '47' },
      { lbl: 'AVG FG%',   val: '52' },
      { lbl: 'TOP STREAK',val: '14' }
    ],
    trophies: [
      { id: 't1', name: 'First Bucket',   earned: true,  tier: 'BRONZE' },
      { id: 't2', name: 'Hot Hand',       earned: true,  tier: 'SILVER' },
      { id: 't3', name: 'Centurion',      earned: true,  tier: 'GOLD'   },
      { id: 't4', name: 'Sniper',         earned: false, tier: 'GOLD'   },
      { id: 't5', name: 'All-Star',       earned: true,  tier: 'GOLD'   },
      { id: 't6', name: 'Diamond Hands',  earned: false, tier: 'DIAMOND'}
    ],
    leaderboard: [
      { rank: 1, name: 'Marcus J.', xp: 18402, you: false },
      { rank: 2, name: 'You',       xp: 12488, you: true  },
      { rank: 3, name: 'Tia P.',    xp: 11140, you: false }
    ]
  };

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
          if (typeof s.xp === 'number') p.totalXP = s.xp;
          if (typeof s.coins === 'number') p.coins = s.coins;
        }
      }
    } catch (e) { /* fixture */ }
    return p;
  }

  function settingsIcon() {
    return svg('svg', { viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none' }, [
      svg('circle', { cx: '12', cy: '12', r: '3', stroke: 'currentColor', 'stroke-width': '1.6' }),
      svg('path', { d: 'M12 3v2M12 19v2M3 12h2M19 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
        stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round' })
    ]);
  }
  function backIcon() {
    return svg('svg', { width: '14', height: '14', viewBox: '0 0 14 14', fill: 'none' },
      [svg('path', { d: 'M9 2L4 7l5 5', stroke: 'currentColor', 'stroke-width': '1.6',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]);
  }

  function buildAvatarNode(seed, size) {
    if (window.MeAvatar && typeof window.MeAvatar === 'function') {
      try { return window.MeAvatar({ seed: seed, size: size }); } catch (e) { /* fallback */ }
    }
    var img = document.createElement('img');
    img.src = 'https://api.dicebear.com/9.x/avataaars/svg?seed=' + encodeURIComponent(seed || 'CourtIQ');
    img.width = size; img.height = size; img.alt = '';
    return img;
  }

  function buildHero(p, ctx) {
    var hero = h('section', { class: 'me-sec me-sec--first' }, [
      h('div', { class: 'me-hero' }, [
        h('button', { class: 'me-avatar', 'aria-label': 'Customize avatar', onclick: ctx.customize }, [
          buildAvatarNode(p.avatarSeed, 84),
          h('span', { class: 'me-avatar__edit', text: '✎' })
        ]),
        h('div', { class: 'me-hero__name', text: p.name }),
        h('div', { class: 'me-hero__meta' }, [
          h('span', { class: 'me-hero__badge' }, [h('span', { class: 'me-hero__badge-dot' }), ' ' + p.position.toUpperCase()]),
          h('span', { class: 'me-hero__badge' }, [' LV ' + p.level + ' · ' + p.levelName])
        ]),
        h('div', { class: 'me-hero__sig' }, [
          h('div', { class: 'me-hero__sig-lbl', text: 'ARCHETYPE' }),
          h('div', { class: 'me-hero__sig-val', text: p.archetype })
        ])
      ])
    ]);
    return hero;
  }

  function buildProfilePage(p, ctx) {
    var statsRow = h('div', { class: 'me-stats' });
    FIXTURE.stats.forEach(function (s) {
      statsRow.appendChild(h('div', { class: 'me-stat me-glass' }, [
        h('div', { class: 'me-stat__lbl', text: s.lbl }),
        h('div', { class: 'me-stat__val', text: s.val })
      ]));
    });

    return [
      buildHero(p, ctx),
      h('section', { class: 'me-sec' }, [
        h('div', { class: 'me-sec__head' }, [h('div', { class: 'me-sec__title', text: 'Stats' })]),
        statsRow
      ]),
      h('section', { class: 'me-sec' }, [
        h('div', { class: 'me-glass me-card' }, [
          h('div', { class: 'me-card__lbl', text: 'XP THIS WEEK' }),
          h('div', { class: 'me-card__val', text: '+' + p.weeklyXP }),
          h('div', { class: 'me-card__sub', text: 'Level ' + p.level + ' · ' + p.totalXP.toLocaleString() + ' total' })
        ])
      ])
    ];
  }

  function buildTrophiesPage() {
    var grid = h('div', { class: 'me-trophies' });
    FIXTURE.trophies.forEach(function (t) {
      grid.appendChild(h('div', {
        class: 'me-trophy me-glass' + (t.earned ? '' : ' is-locked'),
        'data-tier': t.tier
      }, [
        h('div', { class: 'me-trophy__icon' }, [
          h('span', { text: t.earned ? '🏆' : '🔒' })
        ]),
        h('div', { class: 'me-trophy__name', text: t.name }),
        h('div', { class: 'me-trophy__tier', text: t.tier })
      ]));
    });
    return [
      h('section', { class: 'me-sec me-sec--first' }, [
        h('div', { class: 'me-sec__head' }, [
          h('div', { class: 'me-sec__title', text: 'Trophy Case' }),
          h('div', { class: 'me-sec__more', text: FIXTURE.trophies.filter(function (x) { return x.earned; }).length + '/' + FIXTURE.trophies.length })
        ]),
        grid
      ])
    ];
  }

  function buildSocialPage(ctx) {
    var rows = h('div', { class: 'me-leader' });
    FIXTURE.leaderboard.forEach(function (e) {
      rows.appendChild(h('div', { class: 'me-leader__row' + (e.you ? ' is-you' : '') }, [
        h('div', { class: 'me-leader__rank', text: '#' + e.rank }),
        h('div', { class: 'me-leader__name', text: e.name }),
        h('div', { class: 'me-leader__xp', text: e.xp.toLocaleString() + ' XP' })
      ]));
    });
    return [
      h('section', { class: 'me-sec me-sec--first' }, [
        h('div', { class: 'me-sec__head' }, [h('div', { class: 'me-sec__title', text: 'Leaderboard' })]),
        h('div', { class: 'me-glass' }, [rows])
      ]),
      h('section', { class: 'me-sec' }, [
        h('button', { class: 'me-cta',
          onclick: function () {
            try { if (window.socialHub && typeof window.socialHub.sendChallenge === 'function') window.socialHub.sendChallenge(); }
            catch (e) {}
          } }, ['Send Challenge'])
      ])
    ];
  }

  function buildShopPage(p) {
    var items = [
      { id: 'h1', name: 'Headband',     price: 100, owned: true,  cat: 'accessories' },
      { id: 'h2', name: 'Sweatband',    price: 75,  owned: false, cat: 'accessories' },
      { id: 'h3', name: 'Armband',      price: 60,  owned: false, cat: 'accessories' },
      { id: 'h4', name: 'Sport Glasses',price: 250, owned: false, cat: 'accessories' }
    ];
    var grid = h('div', { class: 'me-shop__grid' });
    items.forEach(function (i) {
      grid.appendChild(h('div', { class: 'me-shop__card me-glass' + (i.owned ? ' is-owned' : '') }, [
        h('div', { class: 'me-shop__name', text: i.name }),
        h('div', { class: 'me-shop__price', text: i.owned ? 'OWNED' : i.price + ' COINS' })
      ]));
    });
    return [
      h('section', { class: 'me-sec me-sec--first' }, [
        h('div', { class: 'me-glass me-shop__wallet' }, [
          h('div', { class: 'me-shop__wallet-l' }, [
            h('div', { class: 'me-shop__wallet-num', text: String(p.coins) }),
            h('div', { class: 'me-shop__wallet-lbl', text: 'COINS · LV ' + p.level })
          ])
        ])
      ]),
      h('section', { class: 'me-sec' }, [
        h('div', { class: 'me-shop__cats' }, [
          h('button', { class: 'me-shop__cat is-active', text: 'ACCESSORIES' }),
          h('button', { class: 'me-shop__cat', text: 'HAIR' }),
          h('button', { class: 'me-shop__cat', text: 'BEARD' })
        ]),
        grid
      ])
    ];
  }

  var state = { tab: 'profile' };
  var hostRef = null;

  function paint() {
    if (!hostRef) return;
    var p = realProfile();
    var ctx = {
      customize: function () {
        try {
          if (window.avatarCustomizer && typeof window.avatarCustomizer.open === 'function') {
            window.avatarCustomizer.open();
          }
        } catch (e) { /* legacy */ }
      },
      openSettings: function () { /* TODO: settings sheet */ }
    };

    DOM.clearChildren(hostRef);
    var stamp = h('div', { class: 'me-stamp' }, [
      h('div', { class: 'me-stamp__l' }, [
        h('button', { class: 'me-stamp__icon-btn', 'aria-label': 'Back',
          onclick: function () { if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('home'); } }, [backIcon()]),
        h('div', null, [
          h('div', { class: 'me-stamp__eyebrow', text: 'ME · IDENTITY' }),
          h('div', { class: 'me-stamp__meta', text: 'LV ' + p.level + ' · ' + p.totalXP.toLocaleString() + ' XP' })
        ])
      ]),
      h('button', { class: 'me-stamp__icon-btn me-stamp__gear', 'aria-label': 'Settings',
        onclick: ctx.openSettings }, [settingsIcon()])
    ]);

    var subnav = h('div', { class: 'me-subnav' });
    [{ id: 'profile', label: 'Profile' }, { id: 'trophies', label: 'Trophies' },
     { id: 'social', label: 'Social' }, { id: 'shop', label: 'Shop' }].forEach(function (c) {
      subnav.appendChild(h('button', {
        class: 'me-chip' + (state.tab === c.id ? ' is-active' : ''), text: c.label,
        onclick: function () { state.tab = c.id; paint(); }
      }));
    });

    var pageNodes;
    if (state.tab === 'profile')      pageNodes = buildProfilePage(p, ctx);
    else if (state.tab === 'trophies') pageNodes = buildTrophiesPage();
    else if (state.tab === 'social')   pageNodes = buildSocialPage(ctx);
    else                                pageNodes = buildShopPage(p);

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
