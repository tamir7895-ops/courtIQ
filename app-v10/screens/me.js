/* app-v10/screens/me.js
   ME tab — Profile / Trophies / Social / Shop sub-tabs. Cream-accented
   hero with avatar + xp bar, 4-bento, achievements grid, milestone pin.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  var SUB_TABS = ['Profile', 'Trophies', 'Social', 'Shop'];

  function buildChips(active, onPick) {
    return h('div', { class: 'v10-chips' }, SUB_TABS.map(function (label) {
      return h('div', {
        class: 'v10-chip' + (label === active ? ' is-active' : ''),
        onclick: function () { onPick(label); }
      }, [label.toUpperCase()]);
    }));
  }

  // Resolve the real DiceBear avatar URL (saved by avatar-customizer in
  // localStorage as 'courtiq_avatar_url'). Falls back to a deterministic
  // avataaars seed if nothing's saved yet.
  function avatarUrl(profile) {
    try {
      var saved = localStorage.getItem('courtiq_avatar_url');
      if (saved) return saved;
    } catch (e) {}
    var seed = encodeURIComponent((profile && (profile.name || profile.id)) || 'CourtIQ');
    return 'https://api.dicebear.com/9.x/avataaars/png?seed=' + seed + '&backgroundColor=FF4F1F';
  }

  function bigAvatar(profile, ctx) {
    var url = avatarUrl(profile);
    var img = h('img', {
      src: url,
      alt: 'Avatar',
      style: {
        width: '100%', height: '100%', objectFit: 'cover',
        display: 'block', borderRadius: '50%'
      },
      onerror: function () {
        // If DiceBear fetch fails, fall back to initial letter.
        var ini = (profile.initial || (profile.name || 'A')[0] || 'A').toUpperCase();
        this.parentNode.textContent = ini;
        this.parentNode.style.display = 'flex';
        this.parentNode.style.alignItems = 'center';
        this.parentNode.style.justifyContent = 'center';
        this.parentNode.style.fontFamily = 'var(--font-display)';
        this.parentNode.style.fontSize = '64px';
        this.parentNode.style.fontWeight = '900';
        this.parentNode.style.color = 'var(--cream)';
      }
    });
    return h('div', {
      style: {
        width: 'clamp(80px, 14dvh, 120px)',
        height: 'clamp(80px, 14dvh, 120px)',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--orange) 0%, var(--mustard) 100%)',
        border: '3px solid var(--cream)',
        boxShadow: '0 0 0 2px var(--ink)',
        overflow: 'hidden',
        margin: '0 auto',
        cursor: 'pointer'
      },
      onclick: function () {
        if (ctx && ctx.go) ctx.go('avatar-customizer');
        else if (window.app && window.app.go) window.app.go('avatar-customizer');
      }
    }, [img]);
  }

  function xpBar(profile) {
    var xp = profile.xp || 11200;
    var xpNext = profile.xpNext || 15000;
    var pct = Math.min(100, Math.round((xp / xpNext) * 100));
    var bar = h('div', {
      style: {
        width: '100%',
        height: '10px',
        background: 'var(--cream)',
        border: '1.5px solid var(--cream)',
        marginTop: '10px',
        position: 'relative',
        overflow: 'hidden'
      }
    }, [
      h('div', {
        style: {
          width: pct + '%',
          height: '100%',
          background: 'var(--orange)'
        }
      })
    ]);
    var label = h('div', {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'var(--cream)',
        marginTop: '6px',
        letterSpacing: '0.08em',
        opacity: '0.9'
      },
      text: xp.toLocaleString() + ' / ' + xpNext.toLocaleString() + ' XP'
    });
    return h('div', { style: { width: '100%', marginTop: '14px' } }, [bar, label]);
  }

  function buildHero(profile, ctx) {
    var name = (profile.name || 'PLAYER').toUpperCase();
    var caption = 'LV ' + (profile.level || 14) + ' · ' + (profile.position || 'SNIPER').toUpperCase();

    return h('div', {
      class: 'v10-hero v10-hero--ink',
      style: {
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: 'clamp(12px, 2.4dvh, 22px) 14px'
      }
    }, [
      bigAvatar(profile, ctx),
      h('div', {
        style: {
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 4.2dvh, 32px)',
          fontWeight: '900',
          color: 'var(--cream)',
          marginTop: 'clamp(8px, 1.6dvh, 14px)',
          letterSpacing: '-0.6px',
          textTransform: 'uppercase',
          lineHeight: '1'
        },
        text: name
      }),
      h('div', {
        style: {
          fontFamily: 'var(--font-display)',
          fontSize: '11px',
          fontWeight: '700',
          color: 'var(--orange)',
          marginTop: 'clamp(3px, 0.8dvh, 6px)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase'
        },
        text: caption
      }),
      xpBar(profile)
    ]);
  }

  function renderProfile(host, ctx, profile) {
    // Hero with big avatar (clickable → avatar-customizer)
    host.appendChild(buildHero(profile, ctx));

    // 4-bento — every number real (merged sessions + earned badges)
    var streakVal = profile.streak || 0;
    var earned = loadEarnedMap();
    var badgeCount = TROPHY_CATALOG.filter(function (b) { return !!earned[b.id]; }).length;
    var bentoHost = h('div');
    host.appendChild(bentoHost);
    ctx.data.getTotals().then(function (t) {
      bentoHost.appendChild(ctx.ui.bento([
        {                    icon: 'ph-flag',       value: t.sessions, label: 'SESSIONS' },
        { variant: 'orange', icon: 'ph-trophy',     value: badgeCount, label: 'BADGES' },
        { variant: 'mustard',icon: 'ph-basketball', value: t.shots,    label: 'SHOTS' },
        { variant: 'sage',   icon: 'ph-fire',       value: streakVal,  label: 'STREAK',
          iconExtra: streakVal >= 3 ? 'v10-flicker' : '' }
      ]));
    });

    // Spacer
    host.appendChild(h('div', { style: { flex: '1 1 auto', minHeight: '4px' } }));

    // CTA → Trophies sub-tab
    host.appendChild(ctx.ui.cta({
      variant: 'mustard',
      icon: 'ph-trophy',
      label: 'VIEW ALL ACHIEVEMENTS',
      onClick: function () {
        var chip = Array.from(document.querySelectorAll('.v10-chip')).find(function (c) {
          return c.textContent === 'TROPHIES';
        });
        if (chip) chip.click();
      }
    }));

    host.appendChild(buildAccountSection(ctx));
  }

  /* ── ACCOUNT (M3): sign in/out + App-Store-required deletion ── */
  function accountRow(opts) {
    return h('div', {
      class: 'v10-row',
      style: Object.assign({ boxShadow: '2px 2px 0 var(--ink)', cursor: opts.onclick ? 'pointer' : 'default' }, opts.style || {}),
      onclick: opts.onclick
    }, [
      h('div', { class: 'v10-row__num' }, [icon(opts.icon)]),
      h('div', { class: 'v10-row__main' }, [
        h('div', { class: 'v10-row__title', text: opts.title }),
        opts.sub ? h('div', { class: 'v10-row__sub', text: opts.sub }) : null
      ].filter(Boolean)),
      opts.onclick ? h('div', { class: 'v10-row__right' }, [icon('ph-caret-right')]) : null
    ].filter(Boolean));
  }

  function buildAccountSection(ctx) {
    var wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' } });
    wrap.appendChild(ctx.ui.ribbon({ icon: 'ph-user-circle', title: 'ACCOUNT', meta: '' }));

    var user = window.V10Auth && window.V10Auth.user();
    if (!user) {
      wrap.appendChild(accountRow({
        icon: 'ph-sign-in',
        title: 'SIGN IN / CREATE ACCOUNT',
        sub: 'Sync sessions, XP and streaks across devices',
        onclick: function () { ctx.go('auth'); }
      }));
      return wrap;
    }

    wrap.appendChild(accountRow({
      icon: 'ph-envelope-simple',
      title: (user.email || 'SIGNED IN').toUpperCase(),
      sub: 'Signed in'
    }));
    wrap.appendChild(accountRow({
      icon: 'ph-sign-out',
      title: 'SIGN OUT',
      onclick: function () {
        window.V10Auth.signOut().then(function () { ctx.go('me'); });
      }
    }));
    wrap.appendChild(accountRow({
      icon: 'ph-trash',
      title: 'DELETE ACCOUNT',
      sub: 'Permanently erases your account and all data',
      style: { background: 'rgba(255,79,31,0.08)' },
      onclick: function () {
        // Two explicit confirmations — deletion is irreversible.
        if (!window.confirm('Delete your CourtIQ account?\n\nThis permanently erases your profile, sessions, shots and XP. There is no undo.')) return;
        if (!window.confirm('Last check — really delete everything?')) return;
        window.V10Auth.deleteAccount().then(function () {
          alert('Your account was deleted.');
          ctx.go('home');
        }).catch(function (e) {
          alert('Deletion failed: ' + ((e && e.message) || 'network error') + '\nPlease try again.');
        });
      }
    }));
    return wrap;
  }

  /* ── Trophy catalog (mirrors BADGES in js/badges.js) ─────
     The engine keeps its BADGES table inside an IIFE, so we
     keep a fallback catalog here. Earned state is pulled from
     window.BadgeSystem.getEarned() when available. */
  var TROPHY_CATALOG = [
    /* Tier: GOLD — milestone streaks */
    { id: 'streak-3',     tier: 'GOLD',   name: '3-Day Fire',      desc: 'Train 3 days in a row',                req: '3 day streak' },
    { id: 'streak-7',     tier: 'GOLD',   name: 'Week Warrior',    desc: 'Train 7 days in a row',                req: '7 day streak' },
    { id: 'streak-14',    tier: 'GOLD',   name: 'Two-Week Beast',  desc: 'Train 14 days in a row',               req: '14 day streak' },
    { id: 'streak-30',    tier: 'GOLD',   name: 'Iron Will',       desc: 'Train 30 days in a row',               req: '30 day streak' },
    /* Tier: SILVER — session + cumulative */
    { id: 'hot-hand',     tier: 'SILVER', name: 'Hot Hand',        desc: '30+ shots in one session',             req: '30 shot session' },
    { id: 'sniper',       tier: 'SILVER', name: 'Sniper',          desc: '80%+ accuracy, 10+ shots',             req: '80% / 10 shots' },
    { id: 'marathon',     tier: 'SILVER', name: 'Marathon',        desc: '5+ sessions in one week',              req: '5 sessions / week' },
    { id: '3pt-100',      tier: 'SILVER', name: 'Downtown Legend', desc: '100 lifetime three-pointers',          req: '100 lifetime 3PT' },
    { id: 'shots-500',    tier: 'SILVER', name: 'Shot Machine',    desc: '500 lifetime shots',                   req: '500 lifetime shots' },
    { id: 'xp-1000',      tier: 'SILVER', name: 'XP Grinder',      desc: '1,000 total XP earned',                req: '1K XP earned' },
    /* Tier: BRONZE — activity first-times */
    { id: 'first-ai',     tier: 'BRONZE', name: 'AI Rookie',       desc: 'Complete first AI shot tracking',      req: 'First AI session' },
    { id: 'first-drill',  tier: 'BRONZE', name: 'Gym Rat',         desc: 'Complete your first drill',            req: 'First drill' },
    { id: 'first-timer',  tier: 'BRONZE', name: 'Timer Pro',       desc: 'Complete first workout timer',         req: 'First timer' },
    { id: 'first-session',tier: 'BRONZE', name: 'Day One',         desc: 'Log your first training session',      req: 'First session' },
    { id: 'customizer',   tier: 'BRONZE', name: 'Style Icon',      desc: 'Customize your avatar',                req: 'Avatar customized' }
  ];

  var TIER_META = {
    GOLD:   { accent: 'mustard', icon: 'ph-trophy',       sub: 'TIER · STREAK' },
    SILVER: { accent: 'ink',     icon: 'ph-medal',        sub: 'TIER · SESSION & TOTAL' },
    BRONZE: { accent: 'sage',    icon: 'ph-shield-check', sub: 'TIER · ACTIVITY' }
  };

  function formatBadgeDate(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      return months[d.getMonth()] + ' ' + d.getDate();
    } catch (_) { return ''; }
  }

  function loadEarnedMap() {
    /* Build {id: timestamp} from BadgeSystem if available */
    var map = {};
    try {
      if (typeof BadgeSystem !== 'undefined' && BadgeSystem.getEarned) {
        var arr = BadgeSystem.getEarned() || [];
        arr.forEach(function (b) { if (b && b.id) map[b.id] = b.ts || Date.now(); });
      }
    } catch (_) { /* fall through to mock */ }

    /* Demo fallback: if nothing earned, mark a handful so the screen
       has visual weight. Real data wins as soon as it exists. */
    if (Object.keys(map).length === 0) {
      var now = Date.now();
      var day = 86400000;
      map = {
        'streak-3':     now - 18 * day,
        'streak-7':     now - 1  * day,
        'hot-hand':     now - 4  * day,
        'sniper':       now - 9  * day,
        '3pt-100':      now - 12 * day,
        'first-ai':     now - 30 * day,
        'first-drill':  now - 28 * day,
        'first-session':now - 30 * day,
        'first-timer':  now - 25 * day,
        'customizer':   now - 22 * day,
        'xp-1000':      now - 6  * day,
        'shots-500':    now - 14 * day
      };
    }
    return map;
  }

  function tierSectionHeader(tier) {
    var meta = TIER_META[tier];
    return h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '14px',
        marginBottom: '6px',
        paddingBottom: '4px',
        borderBottom: '1.5px dashed var(--ink)'
      }
    }, [
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'var(--font-display)',
          fontWeight: '900',
          fontSize: '13px',
          letterSpacing: '0.18em',
          color: 'var(--ink)',
          textTransform: 'uppercase'
        }
      }, [
        h('i', { class: 'ph-bold ' + meta.icon, style: { color: 'var(--' + meta.accent + ')', fontSize: '14px' } }),
        h('span', { text: tier })
      ]),
      h('span', {
        style: {
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          color: 'var(--muted)',
          letterSpacing: '0.06em'
        },
        text: meta.sub
      })
    ]);
  }

  function trophyRow(badge, idx, earnedMap) {
    var num = (idx < 9 ? '0' : '') + (idx + 1);
    var earned = !!earnedMap[badge.id];
    var dateStr = earned ? formatBadgeDate(earnedMap[badge.id]) : 'LOCKED';
    var rightColor = earned ? 'var(--orange)' : 'var(--muted)';
    var rightIcon  = earned ? 'ph-check-circle' : 'ph-lock-simple';

    var row = h('div', {
      class: 'v10-row',
      style: earned ? null : { opacity: '0.42' }
    }, [
      h('div', { class: 'v10-row__num', text: num }),
      h('div', { class: 'v10-row__main' }, [
        h('div', { class: 'v10-row__title', text: badge.name.toUpperCase() }),
        h('div', {
          class: 'v10-row__sub',
          style: { fontStyle: 'italic', fontFamily: 'var(--font-body)' },
          text: badge.desc + (earned ? '' : ' · ' + badge.req)
        })
      ]),
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: rightColor,
          fontFamily: 'var(--font-display)',
          fontWeight: '900',
          fontSize: '10px',
          letterSpacing: '0.14em'
        }
      }, [
        h('i', { class: 'ph-bold ' + rightIcon, style: { fontSize: '12px' } }),
        h('span', { text: dateStr })
      ])
    ]);
    return row;
  }

  function renderTrophies(host, ctx) {
    var earnedMap = loadEarnedMap();
    var totalBadges = TROPHY_CATALOG.length;
    var earnedCount = TROPHY_CATALOG.filter(function (b) { return !!earnedMap[b.id]; }).length;

    host.appendChild(ctx.ui.ribbon({
      icon: 'ph-trophy',
      title: 'ALL BADGES',
      meta: earnedCount + ' OF ' + totalBadges
    }));

    /* Group by tier, preserving catalog order */
    var byTier = { GOLD: [], SILVER: [], BRONZE: [] };
    TROPHY_CATALOG.forEach(function (b) {
      if (byTier[b.tier]) byTier[b.tier].push(b);
    });

    /* Index counter is global for stable 01..15 numbering */
    var idx = 0;
    ['GOLD', 'SILVER', 'BRONZE'].forEach(function (tier) {
      var items = byTier[tier];
      if (!items || !items.length) return;
      host.appendChild(tierSectionHeader(tier));
      items.forEach(function (b) {
        host.appendChild(trophyRow(b, idx, earnedMap));
        idx++;
      });
    });

    /* Footer CTA — go earn more by starting a tracked session */
    host.appendChild(h('div', { style: { marginTop: '12px' } }, [
      ctx.ui.cta({
        variant: 'mustard',
        icon: 'ph-target',
        label: 'EARN MORE — START TRACKING',
        onClick: function () { ctx.go('camera-hud'); }
      })
    ]));
  }

  function renderSocial(host, ctx) {
    host.appendChild(ctx.ui.ribbon({
      icon: 'ph-chat-circle',
      title: 'TEAMMATES',
      meta: 'SOON'
    }));
    // Honest gate (M4): team features ship with the squad beta — no fake
    // friends list until real teammates exist.
    host.appendChild(h('div', { class: 'v10-row', style: { boxShadow: '2px 2px 0 var(--ink)' } }, [
      h('div', { class: 'v10-row__num' }, [icon('ph-users-three')]),
      h('div', { class: 'v10-row__main' }, [
        h('div', { class: 'v10-row__title', text: 'SQUAD MODE IS COMING' }),
        h('div', { class: 'v10-row__sub', text: 'Team leaderboards and live sessions land with the squad beta. Your stats already count.' })
      ])
    ]));
    var friends = [];
    friends.forEach(function (f) {
      host.appendChild(h('div', { class: 'v10-row' }, [
        h('div', { class: 'v10-row__num', text: f.n }),
        h('div', { class: 'v10-row__main' }, [
          h('div', { class: 'v10-row__title', text: f.t }),
          h('div', { class: 'v10-row__sub', text: f.s })
        ]),
        f.r ? h('div', {
          class: 'v10-row__right',
          style: { color: f.r === 'LIVE' ? 'var(--sage)' : 'var(--muted)', fontSize: '11px' },
          text: f.r
        }) : null
      ]));
    });
  }

  /* ── Shop catalog ─────────────────────────────────────────
     Avatar cosmetics come from window.AvatarShop.SHOP_ITEMS
     (with ownership checks). Plans + drill packs are hard-
     coded since they don't live in avatar-shop.js. */
  var COSMETIC_ICON_MAP = {
    /* accessories */
    headband:  'ph-sun-horizon',
    sweatband: 'ph-drop',
    armband:   'ph-barbell',
    glasses:   'ph-sunglasses',
    chain:     'ph-link',
    durag:     'ph-crown-simple',
    /* hair */
    mohawk:    'ph-lightning',
    waves:     'ph-wave-sine',
    cornrows:  'ph-flame',
    /* beard */
    goatee:    'ph-user-focus',
    chinstrap: 'ph-user-circle'
  };

  var COSMETIC_FALLBACK = [
    { id: 'headband',  name: 'Headband',     desc: 'Classic terry headband',   cost: 50,  type: 'accessory' },
    { id: 'glasses',   name: 'Sport Shades', desc: 'Wraparound sport shades',  cost: 100, type: 'accessory' },
    { id: 'chain',     name: 'Gold Chain',   desc: 'Gold chain · IQ pendant',  cost: 150, type: 'accessory' },
    { id: 'durag',     name: 'Navy Durag',   desc: 'Pro tier swag',            cost: 200, type: 'accessory' },
    { id: 'mohawk',    name: 'Mohawk',       desc: 'Tall central crest',       cost: 80,  type: 'hair' },
    { id: 'cornrows',  name: 'Cornrows',     desc: 'Tight braided rows',       cost: 120, type: 'hair' }
  ];

  function loadShopCatalog() {
    var raw;
    try {
      if (typeof AvatarShop !== 'undefined' && Array.isArray(AvatarShop.SHOP_ITEMS)) {
        raw = AvatarShop.SHOP_ITEMS;
      }
    } catch (_) { /* fall through */ }
    if (!raw || !raw.length) raw = COSMETIC_FALLBACK;

    /* Sort: accessories first (most visual), then hair, then beard */
    var order = { accessory: 0, hair: 1, beard: 2 };
    return raw.slice().sort(function (a, b) {
      var oa = order[a.type] != null ? order[a.type] : 9;
      var ob = order[b.type] != null ? order[b.type] : 9;
      if (oa !== ob) return oa - ob;
      return (a.cost || 0) - (b.cost || 0);
    });
  }

  function shopCoins() {
    try {
      if (typeof AvatarShop !== 'undefined' && AvatarShop.getCoins) {
        return AvatarShop.getCoins() || 0;
      }
    } catch (_) {}
    return 0;
  }

  function isShopItemOwned(id) {
    try {
      if (typeof AvatarShop !== 'undefined' && AvatarShop.isOwned) {
        return !!AvatarShop.isOwned(id);
      }
    } catch (_) {}
    return false;
  }

  function cosmeticTile(item, accent, idx, ctx) {
    var icon = COSMETIC_ICON_MAP[item.id] || 'ph-sparkle';
    var owned = isShopItemOwned(item.id);
    var num = '#' + (idx < 9 ? '0' : '') + (idx + 1);
    var priceLabel = owned ? 'OWNED' : (item.cost + ' XP');

    return h('div', {
      class: 'v10-tile v10-tile--' + accent,
      style: { cursor: 'pointer' },
      onclick: function () { if (ctx && ctx.go) ctx.go('avatar-customizer'); }
    }, [
      h('div', { class: 'v10-tile__top' }, [
        h('i', { class: 'ph-bold ' + icon + ' v10-tile__icon v10-tile__icon--' + accent }),
        h('span', { class: 'v10-tile__num', text: num })
      ]),
      h('div', { class: 'v10-tile__title', text: (item.name || 'ITEM').toUpperCase() }),
      h('div', { class: 'v10-tile__meta', text: priceLabel + ' · ' + (item.type || 'COSMETIC').toUpperCase() })
    ]);
  }

  function subHeader(label, meta) {
    return h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '14px',
        marginBottom: '6px',
        paddingBottom: '4px',
        borderBottom: '1.5px dashed var(--ink)'
      }
    }, [
      h('div', {
        style: {
          fontFamily: 'var(--font-display)',
          fontWeight: '900',
          fontSize: '12px',
          letterSpacing: '0.18em',
          color: 'var(--ink)',
          textTransform: 'uppercase'
        },
        text: label
      }),
      meta ? h('span', {
        style: {
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          color: 'var(--muted)',
          letterSpacing: '0.06em'
        },
        text: meta
      }) : null
    ]);
  }

  function planTile(opts) {
    /* Full-width subscription tile — ink-fill style */
    return h('div', {
      class: 'v10-row',
      style: {
        background: opts.bg || 'var(--ink)',
        color: 'var(--cream)',
        borderColor: 'var(--ink)',
        padding: '12px 14px',
        boxShadow: opts.shadow || '3px 3px 0 var(--orange)'
      }
    }, [
      h('i', {
        class: 'ph-bold ' + (opts.icon || 'ph-shield-star'),
        style: {
          fontSize: '26px',
          color: opts.iconColor || 'var(--mustard)',
          minWidth: '28px'
        }
      }),
      h('div', { class: 'v10-row__main' }, [
        h('div', {
          class: 'v10-row__title',
          style: { color: 'var(--cream)' },
          text: opts.name
        }),
        h('div', {
          class: 'v10-row__sub',
          style: { color: 'var(--cream)', opacity: '0.82', fontStyle: 'italic' },
          text: opts.desc
        })
      ]),
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '2px'
        }
      }, [
        h('div', {
          style: {
            fontFamily: 'var(--font-display)',
            fontSize: '16px',
            fontWeight: '900',
            color: opts.priceColor || 'var(--mustard)',
            letterSpacing: '-0.4px'
          },
          text: opts.price
        }),
        h('div', {
          style: {
            fontFamily: 'var(--font-mono)',
            fontSize: '8px',
            color: 'var(--cream)',
            opacity: '0.7',
            letterSpacing: '0.08em'
          },
          text: opts.priceMeta || 'PER MONTH'
        })
      ])
    ]);
  }

  function drillPackRow(item, idx, ctx) {
    var num = (idx < 9 ? '0' : '') + (idx + 1);
    return h('div', {
      class: 'v10-row',
      style: { cursor: 'pointer' },
      onclick: function () { if (ctx && ctx.go) ctx.go('drill-library'); }
    }, [
      h('div', { class: 'v10-row__num', text: num }),
      h('i', {
        class: 'ph-bold ' + item.icon,
        style: { fontSize: '20px', color: 'var(--' + item.accent + ')', minWidth: '24px' }
      }),
      h('div', { class: 'v10-row__main' }, [
        h('div', { class: 'v10-row__title', text: item.name.toUpperCase() }),
        h('div', {
          class: 'v10-row__sub',
          style: { fontStyle: 'italic', fontFamily: 'var(--font-body)' },
          text: item.desc
        })
      ]),
      h('div', { class: 'v10-row__right', text: item.price })
    ]);
  }

  function renderShop(host, ctx) {
    var coins = shopCoins();
    var coinLabel = coins > 0 ? coins.toLocaleString() + ' COINS' : 'XP · CASH';

    host.appendChild(ctx.ui.ribbon({
      icon: 'ph-shopping-bag',
      title: 'SHOP',
      meta: coinLabel
    }));

    /* ── Cosmetics 2x2 grid (4 items, cycle accents) ── */
    host.appendChild(subHeader('AVATAR COSMETICS', 'XP UNLOCKS'));

    var catalog = loadShopCatalog();
    var accents = ['orange', 'sage', 'mustard', 'ink-fill'];
    var grid = h('div', { class: 'v10-grid' }, catalog.slice(0, 4).map(function (item, i) {
      /* ink-fill tile reads the title differently; map to 'ink' accent token */
      var accent = accents[i % accents.length];
      /* badgeTile-style ink fill if last cell */
      if (accent === 'ink-fill') {
        var icon = COSMETIC_ICON_MAP[item.id] || 'ph-sparkle';
        var owned = isShopItemOwned(item.id);
        return h('div', {
          class: 'v10-tile v10-tile--ink-fill',
          style: { cursor: 'pointer' },
          onclick: function () { if (ctx && ctx.go) ctx.go('avatar-customizer'); }
        }, [
          h('div', { class: 'v10-tile__top' }, [
            h('i', {
              class: 'ph-bold ' + icon,
              style: { color: 'var(--mustard)', fontSize: '18px' }
            }),
            h('span', {
              class: 'v10-tile__num',
              style: { color: 'var(--cream)', opacity: '0.7' },
              text: owned ? 'OWNED' : item.cost + ' XP'
            })
          ]),
          h('div', { class: 'v10-tile__title', text: (item.name || 'ITEM').toUpperCase() }),
          h('div', {
            class: 'v10-tile__meta',
            style: { color: 'var(--cream)', opacity: '0.7' },
            text: (item.type || 'COSMETIC').toUpperCase()
          })
        ]);
      }
      return cosmeticTile(item, accent, i, ctx);
    }));
    host.appendChild(grid);

    /* ── Plans (full-width row tiles) ── */
    host.appendChild(subHeader('PLANS', 'PRO · ELITE'));
    host.appendChild(planTile({
      name: 'CourtIQ Pro',
      desc: 'Unlimited AI sessions · cloud sync · all drills',
      icon: 'ph-shield-star',
      iconColor: 'var(--mustard)',
      price: '$4.99',
      priceColor: 'var(--mustard)',
      priceMeta: 'PER MONTH',
      shadow: '3px 3px 0 var(--orange)'
    }));
    host.appendChild(planTile({
      name: 'CourtIQ Elite',
      desc: 'Coach reviews · pro analytics · early features',
      icon: 'ph-crown',
      iconColor: 'var(--orange)',
      bg: 'var(--orange)',
      price: '$9.99',
      priceColor: 'var(--cream)',
      priceMeta: 'PER MONTH',
      shadow: '3px 3px 0 var(--ink)'
    }));

    /* ── Drill packs (2 rows) ── */
    host.appendChild(subHeader('DRILL PACKS', 'XP UNLOCKS'));
    [
      { icon: 'ph-target',        name: 'Aim Trainer',    desc: '20 precision drills · catch & shoot', price: '2K XP',  accent: 'sage'   },
      { icon: 'ph-arrows-clockwise', name: 'Footwork Pro', desc: '15 movement drills · pivot · stride', price: '1.5K XP', accent: 'mustard' }
    ].forEach(function (item, i) {
      host.appendChild(drillPackRow(item, i, ctx));
    });
  }

  function render(args) {
    var host = args.host;
    var ctx  = args.ctx;
    var active = 'Profile';

    ctx.data.getProfile().then(function (profile) {
      host.appendChild(ctx.ui.headerPill({ profile: profile }));

      var body = h('div', {});
      host.appendChild(buildChips(active, function (next) {
        active = next;
        while (body.firstChild) body.removeChild(body.firstChild);
        paint();
      }));
      host.appendChild(body);

      function paint() {
        if (active === 'Profile')  return renderProfile(body, ctx, profile);
        if (active === 'Trophies') return renderTrophies(body, ctx);
        if (active === 'Social')   return renderSocial(body, ctx);
        if (active === 'Shop')     return renderShop(body, ctx);
      }
      paint();
    });
  }

  window.app.register('me', render);
})();
