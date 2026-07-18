/* app-v10/screens/me.js — v12
   PROFILE — the sketch, top to bottom:

     avatar (big)
     name · LV · XP BAR
     SHOP · EDIT PROFILE
     □ □ □ □   (trophy preview)
     SETTINGS · TROPHIES

   XP and level are BACK by explicit user decision (the Duolingo
   reference) — v11 removed them, the sketch restored them. They're
   real numbers from XPSystem; the bar draws only when a real next
   threshold exists (COURTIQ_LEVELS), never from an invented curve.

   Views: main / trophies / settings / edit. All in-screen, one back
   button, no hidden nav.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  /* Mirrors BADGES in js/badges.js (kept inside its IIFE there). */
  var TROPHIES = [
    { id: 'streak-3',      tier: 'gold',   icon: 'ph-fire',        name: '3-Day Fire',     req: '3 day streak' },
    { id: 'streak-7',      tier: 'gold',   icon: 'ph-fire-simple', name: 'Week Warrior',   req: '7 day streak' },
    { id: 'streak-14',     tier: 'gold',   icon: 'ph-flame',       name: 'Two-Week Beast', req: '14 day streak' },
    { id: 'streak-30',     tier: 'gold',   icon: 'ph-trophy',      name: 'Iron Will',      req: '30 day streak' },
    { id: 'hot-hand',      tier: 'silver', icon: 'ph-hand-fist',   name: 'Hot Hand',       req: '30 shots in a session' },
    { id: 'sniper',        tier: 'silver', icon: 'ph-crosshair',   name: 'Sniper',         req: '80% on 10+ shots' },
    { id: 'marathon',      tier: 'silver', icon: 'ph-path',        name: 'Marathon',       req: '5 sessions in a week' },
    { id: '3pt-100',       tier: 'silver', icon: 'ph-basketball',  name: 'Downtown',       req: '100 lifetime 3PT' },
    { id: 'shots-500',     tier: 'silver', icon: 'ph-medal',       name: 'Shot Machine',   req: '500 lifetime shots' },
    { id: 'first-ai',      tier: 'bronze', icon: 'ph-robot',       name: 'AI Rookie',      req: 'First tracked session' },
    { id: 'first-drill',   tier: 'bronze', icon: 'ph-barbell',     name: 'Gym Rat',        req: 'First drill' },
    { id: 'first-session', tier: 'bronze', icon: 'ph-flag',        name: 'Day One',        req: 'First session' },
    { id: 'customizer',    tier: 'bronze', icon: 'ph-user-focus',  name: 'Style Icon',     req: 'Avatar customised' }
  ];

  function earnedMap() {
    var map = {};
    try {
      if (typeof BadgeSystem !== 'undefined' && BadgeSystem.getEarned) {
        (BadgeSystem.getEarned() || []).forEach(function (b) { map[(b && b.id) || b] = true; });
      }
    } catch (e) {}
    return map;
  }

  /* Real XP curve or no bar at all. */
  function xpNext(xp) {
    try {
      var L = window.COURTIQ_LEVELS;
      if (L && L.length) {
        for (var i = 0; i < L.length; i++) {
          if (xp < L[i].threshold) return L[i].threshold;
        }
      }
    } catch (e) {}
    return null;
  }

  function backBtn(onBack) {
    return h('button', {
      class: 'c12-back', type: 'button', 'aria-label': 'Back', onclick: onBack
    }, [h('i', { class: 'ph-bold ph-arrow-left' })]);
  }

  /* ── trophies view ────────────────────────────────────────────*/
  function trophiesView(host, ctx, back) {
    while (host.firstChild) host.removeChild(host.firstChild);
    var earned = earnedMap();
    var got = TROPHIES.filter(function (t) { return earned[t.id]; }).length;

    host.appendChild(h('div', { class: 'c12-chat-hd' }, [
      backBtn(back),
      h('div', {}, [
        h('div', { class: 'c12-chat-hd__t', text: 'Trophies' }),
        h('div', { class: 'c12-chat-hd__s', text: got + ' of ' + TROPHIES.length + ' — all earned on the court' })
      ])
    ]));

    var grid = h('div', { class: 'm12-trogrid' });
    TROPHIES.forEach(function (t) {
      var isE = !!earned[t.id];
      grid.appendChild(h('div', {
        class: 'm12-tro' + (isE ? ' is-earned is-' + t.tier : ''),
        title: t.req
      }, [
        h('i', { class: (isE ? 'ph-fill ' : 'ph-bold ') + t.icon }),
        h('div', { class: 'm12-tro__n', text: t.name }),
        h('div', { class: 'm12-tro__d', text: isE ? 'Earned' : t.req })
      ]));
    });
    host.appendChild(grid);
  }

  /* ── settings view ────────────────────────────────────────────*/
  function settingsView(host, ctx, back) {
    while (host.firstChild) host.removeChild(host.firstChild);
    host.appendChild(h('div', { class: 'c12-chat-hd' }, [
      backBtn(back),
      h('div', {}, [h('div', { class: 'c12-chat-hd__t', text: 'Settings' })])
    ]));

    var signedIn = !!(ctx.data.isSignedIn && ctx.data.isSignedIn());

    function row(icon, title, sub, onClick, danger) {
      return V12.card({ press: true, onClick: onClick, label: title, class: 'm12-set' }, [
        h('i', { class: 'ph-bold ' + icon + ' m12-set__ic' + (danger ? ' m12-set__ic--danger' : '') }),
        h('div', { class: 'm12-set__main' }, [
          h('div', { class: 'm12-set__t' + (danger ? ' m12-set__t--danger' : ''), text: title }),
          sub ? h('div', { class: 'm12-set__s', text: sub }) : null
        ].filter(Boolean)),
        h('i', { class: 'ph-bold ph-caret-right m12-set__chev' })
      ]);
    }

    if (!signedIn) {
      host.appendChild(row('ph-user-circle', 'Sign in / create account',
        'Sync sessions, streak and Court IQ across devices.',
        function () { ctx.go('auth'); }));
    }
    host.appendChild(row('ph-user-focus', 'Customise avatar',
      'How you show up on the court.',
      function () { ctx.go('avatar-customizer'); }));
    host.appendChild(row('ph-bell', 'Notifications', null,
      function () { ctx.go('notifications'); }));

    if (signedIn) {
      host.appendChild(row('ph-sign-out', 'Sign out', null, function () {
        if (window.V10Auth && window.V10Auth.signOut) {
          window.V10Auth.signOut().then(function () { ctx.go('home'); });
        }
      }));
      host.appendChild(row('ph-trash', 'Delete account',
        'Removes your account and synced data. Cannot be undone.',
        function () {
          if (window.confirm('Delete your account and all synced data? This cannot be undone.') &&
              window.V10Auth && window.V10Auth.deleteAccount) {
            window.V10Auth.deleteAccount().then(function () { ctx.go('home'); });
          }
        }, true));
    }
  }

  /* ── edit profile view — the full data card, editable ──────────
     Everything the combine collected about the player, in one place:
     name, position, play style, and the measurables. Reads the same
     localStorage keys onboarding writes so the two round-trip, and
     re-renders me on save so the header + id card reflect it. */
  function lsGet(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }

  function editView(host, ctx, prof, back) {
    while (host.firstChild) host.removeChild(host.firstChild);

    /* current values from storage (fall back to profile / sane defaults) */
    var cur = {
      name: (prof.name && prof.name !== 'Rookie') ? prof.name : (lsGet('courtiq_profile_name', '') || ''),
      position: lsGet('courtiq_profile_position', '') || (prof.position || ''),
      playStyle: lsGet('courtiq_profile_playstyle', '') || '',
      height: parseInt(lsGet('courtiq_profile_height', '74'), 10) || 74,
      weight: parseInt(lsGet('courtiq_profile_weight', '175'), 10) || 175,
      age: parseInt(lsGet('courtiq_profile_age', '17'), 10) || 17,
      hand: lsGet('courtiq_profile_hand', 'R') || 'R'
    };

    host.appendChild(h('div', { class: 'c12-chat-hd' }, [
      backBtn(back),
      h('div', {}, [
        h('div', { class: 'c12-chat-hd__t', text: 'Edit my data' }),
        h('div', { class: 'c12-chat-hd__s', text: 'Your combine card — change anything' })
      ])
    ]));

    var scroll = h('div', { class: 'me12-editscroll' });
    host.appendChild(scroll);

    /* helpers reusing the onboarding control styles */
    function slider(label, val, min, max, unit, key) {
      var out = h('span', { class: 'onb12-slider__v', text: val + (unit || '') });
      var input = h('input', { type: 'range', min: String(min), max: String(max), value: String(val), class: 'onb12-range' });
      input.addEventListener('input', function () {
        cur[key] = parseInt(input.value, 10);
        out.textContent = input.value + (unit || '');
      });
      return h('div', { class: 'onb12-slider' }, [
        h('div', { class: 'onb12-slider__top' }, [h('span', { class: 'd-label', text: label }), out]), input
      ]);
    }
    function pickRow(label, opts, key, cols) {
      var wrap = h('div', { class: cols === 2 ? 'onb12-two' : 'onb12-grid3' });
      function paintPills() {
        while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
        opts.forEach(function (o) {
          wrap.appendChild(h('button', {
            class: 'onb12-pill' + (cur[key] === o.id ? ' is-active' : ''), type: 'button',
            onclick: function () { cur[key] = o.id; paintPills(); }
          }, [
            h('div', { class: 'onb12-pill__l', text: o.l }),
            o.s ? h('div', { class: 'onb12-pill__s', text: o.s }) : null
          ].filter(Boolean)));
        });
      }
      paintPills();
      return h('div', {}, [h('div', { class: 'd-label', style: { marginBottom: '7px' }, text: label }), wrap]);
    }

    var nameIn = h('input', {
      class: 'onb12-input', type: 'text', maxlength: '24',
      placeholder: 'Your name', value: cur.name,
      oninput: function (e) { cur.name = e.target.value; }
    });

    scroll.appendChild(h('div', { class: 'onb12-body' }, [
      h('div', { class: 'd-label', text: 'NAME' }), nameIn,
      pickRow('Position', [
        { id: 'PG', l: 'Point' }, { id: 'SG', l: 'Shooting' }, { id: 'SF', l: 'Small F' },
        { id: 'PF', l: 'Power F' }, { id: 'C', l: 'Center' }
      ], 'position', 3),
      pickRow('Play style', [
        { id: 'sniper', l: 'Sniper' }, { id: 'slasher', l: 'Slasher' },
        { id: 'floor-general', l: 'Floor Gen' }, { id: 'lockdown', l: 'Lockdown' }
      ], 'playStyle', 2),
      slider('Height', cur.height, 60, 90, '"', 'height'),
      slider('Weight', cur.weight, 100, 320, ' lb', 'weight'),
      slider('Age', cur.age, 10, 60, ' yr', 'age'),
      pickRow('Shooting hand', [{ id: 'L', l: 'Lefty' }, { id: 'R', l: 'Righty' }], 'hand', 2)
    ]));

    host.appendChild(V12.btn({
      label: 'Save', icon: 'ph-check',
      onClick: function () {
        try {
          localStorage.setItem('courtiq_profile_name', (cur.name || '').trim() || 'Rookie');
          localStorage.setItem('courtiq_profile_position', cur.position || '');
          localStorage.setItem('courtiq_profile_playstyle', cur.playStyle || '');
          localStorage.setItem('courtiq_profile_height', String(cur.height));
          localStorage.setItem('courtiq_profile_weight', String(cur.weight));
          localStorage.setItem('courtiq_profile_age', String(cur.age));
          localStorage.setItem('courtiq_profile_hand', cur.hand || 'R');
        } catch (e) {}
        window.app.go('me');
      }
    }));
    host.appendChild(V12.card({
      press: true, onClick: function () { ctx.go('avatar-customizer'); },
      label: 'Customise avatar', class: 'm12-set'
    }, [
      h('i', { class: 'ph-bold ph-user-focus m12-set__ic' }),
      h('div', { class: 'm12-set__main' }, [
        h('div', { class: 'm12-set__t', text: 'Customise avatar' })
      ]),
      h('i', { class: 'ph-bold ph-caret-right m12-set__chev' })
    ]));
  }

  /* ── main view ────────────────────────────────────────────────*/
  function mainView(host, ctx, prof, iq, totals) {
    while (host.firstChild) host.removeChild(host.firstChild);

    /* the Duolingo band — the character's world owns the top third,
       edge to edge, tinted with the avatar's own background color */
    var url = V12.avatarUrl(prof);
    var bandColor = (url.match(/backgroundColor=([0-9A-Fa-f]{6})/) || [])[1] || 'FFB800';
    var band = h('div', {
      class: 'm12-band',
      role: 'button', tabindex: '0', 'aria-label': 'Customise avatar',
      onclick: function () { ctx.go('avatar-customizer'); },
      onkeydown: V12.activates(function () { ctx.go('avatar-customizer'); })
    }, [
      h('div', { class: 'm12-band__edit' }, [h('i', { class: 'ph-bold ph-pencil-simple' })])
    ]);
    band.style.backgroundColor = '#' + bandColor;
    band.style.backgroundImage = 'url(' + url + ')';
    host.appendChild(band);

    /* name + level + XP bar */
    var xp = prof.xp || 0;
    var next = xpNext(xp);
    host.appendChild(V12.card({ tint: 'ink', class: 'm12-id', bgIcon: 'ph-lightning', bgTone: 'gold' }, [
      h('div', { class: 'm12-id__row' }, [
        h('div', { class: 'm12-id__n', text: prof.name || 'Rookie' }),
        h('div', { class: 'm12-id__lv', text: 'LV ' + (prof.level || 1) })
      ]),
      h('div', { class: 'm12-id__m',
        text: (prof.position || 'PLAYER') + (iq ? ' · Court IQ ' + iq.score + ' · ' + iq.tier : ' · Unrated') }),
      V12.xpBar(xp, next)
    ]));

    /* shop / edit profile */
    host.appendChild(h('div', { class: 'm12-two' }, [
      V12.card({
        tint: 'gold', press: true, bgIcon: 'ph-storefront', bgTone: 'gold', class: 'm12-doortile',
        onClick: function () { ctx.go('shop'); }, label: 'Shop'
      }, [
        h('i', { class: 'ph-fill ph-storefront m12-doortile__ic m12-doortile__ic--gold' }),
        h('div', { class: 'm12-doortile__t', text: 'SHOP' })
      ]),
      V12.card({
        press: true, bgIcon: 'ph-pencil-simple-line', bgTone: 'ink', class: 'm12-doortile',
        onClick: function () { editView(host, ctx, prof, function () { mainView(host, ctx, prof, iq, totals); }); },
        label: 'Edit profile'
      }, [
        h('i', { class: 'ph-fill ph-pencil-simple-line m12-doortile__ic' }),
        h('div', { class: 'm12-doortile__t', text: 'EDIT PROFILE' })
      ])
    ]));

    /* trophy preview — earned first, then nearest to earn */
    var earned = earnedMap();
    var sorted = TROPHIES.slice().sort(function (a, b) {
      return (earned[b.id] ? 1 : 0) - (earned[a.id] ? 1 : 0);
    }).slice(0, 4);
    var openTrophies = function () {
      trophiesView(host, ctx, function () { mainView(host, ctx, prof, iq, totals); });
    };
    host.appendChild(h('div', {
      class: 'm12-preview', role: 'button', tabindex: '0', 'aria-label': 'Trophies',
      onclick: openTrophies, onkeydown: V12.activates(openTrophies)
    }, sorted.map(function (t) {
      var isE = !!earned[t.id];
      return h('div', { class: 'm12-mini' + (isE ? ' is-earned is-' + t.tier : ''), title: t.name }, [
        h('i', { class: (isE ? 'ph-fill ' : 'ph-bold ') + t.icon })
      ]);
    })));

    /* career strip — denominated in basketball */
    host.appendChild(h('div', { class: 'm12-career' }, [
      { v: totals.sessions || 0, l: 'SESSIONS' },
      { v: totals.shots || 0, l: 'SHOTS' },
      { v: prof.streak || 0, l: 'STREAK' }
    ].map(function (s) {
      return h('div', { class: 'm12-career__i' }, [
        h('div', { class: 'd-num m12-career__v', text: String(s.v) }),
        h('div', { class: 'd-label', text: s.l })
      ]);
    })));

    /* settings / trophies */
    host.appendChild(h('div', { class: 'm12-two' }, [
      V12.card({
        press: true, bgIcon: 'ph-gear-six', bgTone: 'ink', class: 'm12-doortile',
        onClick: function () { settingsView(host, ctx, function () { mainView(host, ctx, prof, iq, totals); }); },
        label: 'Settings'
      }, [
        h('i', { class: 'ph-fill ph-gear-six m12-doortile__ic' }),
        h('div', { class: 'm12-doortile__t', text: 'SETTINGS' })
      ]),
      V12.card({
        press: true, bgIcon: 'ph-trophy', bgTone: 'gold', class: 'm12-doortile',
        onClick: openTrophies, label: 'Trophies'
      }, [
        h('i', { class: 'ph-fill ph-trophy m12-doortile__ic m12-doortile__ic--gold' }),
        h('div', { class: 'm12-doortile__t', text: 'TROPHIES' })
      ])
    ]));
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    return Promise.all([
      ctx.data.getProfile(),
      window.V10CourtIQ.get(),
      ctx.data.getTotals()
    ]).then(function (r) {
      mainView(host, ctx, r[0] || {}, r[1], r[2] || { sessions: 0, shots: 0 });
    });
  }

  window.app.register('me', render);
})();
