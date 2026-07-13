/* app-v10/screens/avatar-customizer.js
   AVATAR CUSTOMIZER — sub-page from Me. Accent: cream / ME.
   Lets the player pick a DiceBear avataaars seed + accent color, with a live
   preview. SAVE CHANGES writes `courtiq_avatar_url` to localStorage so the
   header pill + Me hero immediately reflect the new avatar.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  var TABS = ['STYLE', 'COLOR', 'SEED'];

  // DiceBear avataaars background palette (avataaars accepts hex w/o '#').
  var COLORS = [
    { id: 'FF4F1F', label: 'ORANGE', token: 'orange'  },
    { id: 'EAB939', label: 'MUSTARD', token: 'mustard' },
    { id: '7A9E7E', label: 'SAGE',   token: 'sage'    },
    { id: 'F4E9D1', label: 'CREAM',  token: 'cream'   }
  ];

  // Curated seed presets — each maps to a stable DiceBear avataaars result.
  var STYLES = [
    { id: 'sniper',  label: 'SNIPER',  icon: 'ph-crosshair-simple' },
    { id: 'guard',   label: 'GUARD',   icon: 'ph-lightning'        },
    { id: 'wing',    label: 'WING',    icon: 'ph-wind'             },
    { id: 'big',     label: 'BIG',     icon: 'ph-shield'           }
  ];

  var SEEDS = [
    { id: 'alpha',   label: 'ALPHA',  icon: 'ph-star'         },
    { id: 'bravo',   label: 'BRAVO',  icon: 'ph-fire'         },
    { id: 'echo',    label: 'ECHO',   icon: 'ph-soccer-ball'  },
    { id: 'flash',   label: 'FLASH',  icon: 'ph-flame'        }
  ];

  function buildAvatarUrl(seed, bgHex) {
    return 'https://api.dicebear.com/9.x/avataaars/png?seed=' +
      encodeURIComponent(seed) + '&backgroundColor=' + bgHex;
  }

  // Resolve current saved pick from localStorage (if any) so the screen
  // opens on the user's last-saved state, not a hardcoded default.
  function loadPicks(profile) {
    var defaults = {
      STYLE: 'sniper',
      COLOR: 'FF4F1F',
      SEED:  (profile && profile.name) ? profile.name.toLowerCase().replace(/\s+/g, '-') : 'alpha'
    };
    try {
      var raw = localStorage.getItem('courtiq_avatar_picks');
      if (raw) {
        var p = JSON.parse(raw);
        return {
          STYLE: p.STYLE || defaults.STYLE,
          COLOR: p.COLOR || defaults.COLOR,
          SEED:  p.SEED  || defaults.SEED
        };
      }
    } catch (e) {}
    return defaults;
  }

  function savePicks(picks, url) {
    try {
      localStorage.setItem('courtiq_avatar_picks', JSON.stringify(picks));
      localStorage.setItem('courtiq_avatar_url', url);
    } catch (e) {}
  }

  // Compose a stable seed from STYLE + SEED so each combination is unique.
  function composedSeed(picks) {
    return (picks.STYLE || 'sniper') + '-' + (picks.SEED || 'alpha');
  }

  function avatarPreview(profile, picks) {
    var name = (profile.name || 'PLAYER').toUpperCase();
    var url  = buildAvatarUrl(composedSeed(picks), picks.COLOR);
    var ini  = (profile.initial || (profile.name || 'A')[0] || 'A').toUpperCase();

    var img = h('img', {
      src: url, alt: ini,
      style: {
        width: '100%', height: '100%', objectFit: 'cover',
        display: 'block', borderRadius: '50%'
      },
      onerror: function () {
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

    var circle = h('div', {
      style: {
        width: '120px', height: '120px',
        background: 'linear-gradient(135deg, var(--orange) 0%, var(--mustard) 100%)',
        border: '3px solid var(--cream)',
        boxShadow: '0 0 0 2px var(--ink), 4px 4px 0 var(--orange)',
        borderRadius: '50%',
        overflow: 'hidden',
        margin: '0 auto'
      }
    }, [img]);

    var styleLabel = (function () {
      var s = STYLES.filter(function (x) { return x.id === picks.STYLE; })[0];
      return s ? s.label : 'SNIPER';
    })();

    return h('div', {
      class: 'v10-hero v10-hero--ink',
      style: { flexDirection: 'column', textAlign: 'center', alignItems: 'center', padding: '18px 14px' }
    }, [
      h('div', { class: 'v10-hero__main', style: { textAlign: 'center' } }, [
        h('div', { class: 'v10-hero__eyebrow', style: { justifyContent: 'center', marginBottom: '8px' } }, [
          icon('ph-user'), h('span', { text: 'YOUR AVATAR' })
        ]),
        circle,
        h('div', { class: 'v10-hero__headline', style: { marginTop: '10px', fontSize: '26px' }, text: name }),
        h('div', { class: 'v10-hero__sub', text: styleLabel + ' BUILD' })
      ])
    ]);
  }

  function tabChips(active, onPick) {
    return h('div', { class: 'v10-chips' }, TABS.map(function (t) {
      return h('button', {
        class: 'v10-chip' + (t === active ? ' is-active' : ''),
        onclick: function () { onPick(t); },
        text: t
      });
    }));
  }

  function optionTile(o, active, onPick) {
    var accent = active ? 'mustard' : 'orange';
    return h('div', {
      class: 'v10-tile v10-tile--' + accent,
      style: active ? { background: 'var(--mustard)', color: 'var(--ink)' } : null,
      onclick: function () { onPick(o.id); }
    }, [
      h('div', { class: 'v10-tile__top' }, [
        h('i', { class: 'ph-bold ' + o.icon + ' v10-tile__icon v10-tile__icon--' + (active ? 'mustard' : 'orange') }),
        h('span', { class: 'v10-tile__num', text: active ? 'ON' : '' })
      ]),
      h('div', { class: 'v10-tile__title', text: o.label }),
      h('div', { class: 'v10-tile__meta', text: o.id.toUpperCase() })
    ]);
  }

  function colorTile(c, active, onPick) {
    var accent = active ? 'mustard' : 'orange';
    return h('div', {
      class: 'v10-tile v10-tile--' + accent,
      style: active ? { background: 'var(--mustard)', color: 'var(--ink)' } : null,
      onclick: function () { onPick(c.id); }
    }, [
      h('div', { class: 'v10-tile__top' }, [
        h('div', {
          style: {
            width: '22px', height: '22px', borderRadius: '50%',
            background: '#' + c.id,
            border: '2px solid var(--ink)',
            boxShadow: '2px 2px 0 var(--ink)'
          }
        }),
        h('span', { class: 'v10-tile__num', text: active ? 'ON' : '' })
      ]),
      h('div', { class: 'v10-tile__title', text: c.label }),
      h('div', { class: 'v10-tile__meta', text: '#' + c.id })
    ]);
  }

  function optionsFor(tab) {
    if (tab === 'STYLE') return STYLES;
    if (tab === 'SEED')  return SEEDS;
    return []; // COLOR handled separately
  }

  function render(args) {
    var host = args.host;
    var ctx = args.ctx;
    var state = {
      tab: 'STYLE',
      profile: {},
      picks: loadPicks({})
    };

    function paint(profile) {
      state.profile = profile || {};
      // Re-resolve defaults now that we know the profile name (only if
      // localStorage didn't already supply one).
      state.picks = loadPicks(state.profile);

      while (host.firstChild) host.removeChild(host.firstChild);
      host.appendChild(ctx.ui.headerPill({ profile: state.profile }));

      var previewHost = h('div');
      var bentoHost   = h('div');
      var chipsHost   = h('div');
      var gridHost    = h('div');

      function refreshPreview() {
        while (previewHost.firstChild) previewHost.removeChild(previewHost.firstChild);
        previewHost.appendChild(avatarPreview(state.profile, state.picks));
      }
      function refreshBento() {
        while (bentoHost.firstChild) bentoHost.removeChild(bentoHost.firstChild);
        var styleObj = STYLES.filter(function (x) { return x.id === state.picks.STYLE; })[0] || STYLES[0];
        var colorObj = COLORS.filter(function (x) { return x.id === state.picks.COLOR; })[0] || COLORS[0];
        var seedObj  = SEEDS.filter(function (x) { return x.id === state.picks.SEED;  })[0] || { label: 'CUSTOM' };
        bentoHost.appendChild(ctx.ui.bento([
          { variant: 'orange',  icon: styleObj.icon, value: styleObj.label, label: 'STYLE' },
          { variant: 'mustard', icon: 'ph-palette',  value: colorObj.label, label: 'COLOR' },
          { variant: 'sage',    icon: seedObj.icon || 'ph-star', value: seedObj.label || state.picks.SEED.toUpperCase(), label: 'SEED' }
        ]));
      }
      function refreshChips() {
        while (chipsHost.firstChild) chipsHost.removeChild(chipsHost.firstChild);
        chipsHost.appendChild(tabChips(state.tab, function (t) {
          state.tab = t;
          refreshChips();
          refreshGrid();
        }));
      }
      function refreshGrid() {
        while (gridHost.firstChild) gridHost.removeChild(gridHost.firstChild);
        if (state.tab === 'COLOR') {
          gridHost.appendChild(h('div', { class: 'v10-grid' }, COLORS.map(function (c) {
            return colorTile(c, state.picks.COLOR === c.id, function (id) {
              state.picks.COLOR = id;
              refreshPreview();
              refreshBento();
              refreshGrid();
            });
          })));
        } else {
          var opts = optionsFor(state.tab);
          gridHost.appendChild(h('div', { class: 'v10-grid' }, opts.map(function (o) {
            return optionTile(o, state.picks[state.tab] === o.id, function (id) {
              state.picks[state.tab] = id;
              refreshPreview();
              refreshBento();
              refreshGrid();
            });
          })));
        }
      }

      refreshPreview();
      refreshBento();
      refreshChips();
      refreshGrid();

      host.appendChild(previewHost);
      host.appendChild(bentoHost);
      host.appendChild(ctx.ui.ribbon({ icon: 'ph-paint-brush-broad', title: 'CUSTOMIZE', meta: 'TAP TO PICK' }));
      host.appendChild(chipsHost);
      host.appendChild(gridHost);

      // Flex spacer pushes CTA to the bottom of the viewport while keeping
      // the content packed at the top.
      host.appendChild(h('div', { style: { flex: '1 1 auto', minHeight: '8px' } }));

      host.appendChild(ctx.ui.cta({
        variant: 'orange',
        icon: 'ph-check',
        label: 'SAVE CHANGES',
        onClick: function () {
          var url = buildAvatarUrl(composedSeed(state.picks), state.picks.COLOR);
          savePicks(state.picks, url);
          ctx.go('me');
        }
      }));
    }

    ctx.data.getProfile().then(paint, function () { paint({}); });
  }

  window.app.register('avatar-customizer', render);
})();
