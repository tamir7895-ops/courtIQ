/* app-v10/screens/avatar-customizer.js — v12
   AVATAR CREATOR — a deep character builder on the shared engine
   (lib/avatar.js). Six panels — Face / Hair / Beard / Fit / Gear /
   Court — each a set of option tiles. Free options apply instantly;
   premium ones show a coin price and unlock on tap when you can
   afford them. Live preview updates on every pick; SAVE writes the
   params every other screen reads.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12, A = window.V12Avatar;

  var T = {
    en: {
      'av.back':      'Back',
      'av.title':     'Create your baller',
      'av.sub':       'Every look is yours — cool gear costs coins',
      'av.alt':       'Your avatar',
      'av.tilecost':  '{label} — {cost} coins',
      'av.save':      'Save look',
      'av.saved':     'Saved',
      'av.random':    'Surprise me',
      'av.shop':      'Shop',
      'av.shoptitle': 'Coin shop',
      'av.shopsub':   'Spend coins on gear, hair & courts'
    },
    he: {
      'av.back':      'חזרה',
      'av.title':     'תבנה את הבאלר שלך',
      'av.sub':       'כל לוק הוא שלך — ציוד שווה עולה מטבעות',
      'av.alt':       'האווטאר שלך',
      'av.tilecost':  '{label} — {cost} מטבעות',
      'av.save':      'שמור לוק',
      'av.saved':     'נשמר',
      'av.random':    'הפתע אותי',
      'av.shop':      'חנות',
      'av.shoptitle': 'חנות המטבעות',
      'av.shopsub':   'מטבעות תמורת ציוד, שיער ומגרשים'
    }
  };
  if (window.V12I18n) V12I18n.add(T);
  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

  function toast(msg, bad) {
    var old = document.querySelector('.av12-toast');
    if (old) old.remove();
    /* not `t` — that name belongs to the i18n helper above, and a shadow
       here is how the streak module lost a whole XP grant (see js/streak.js) */
    var el = h('div', { class: 'av12-toast' + (bad ? ' is-bad' : ''), text: msg });
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('is-in'); }, 10);
    setTimeout(function () { el.classList.remove('is-in'); setTimeout(function () { el.remove(); }, 220); }, 1900);
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    var params = A.load();
    var owns = A.isOwned;      // replaced per paint by paintPanel()
    var tab = 'face';

    return ctx.data.getProfile().then(function (prof) {
      var seed = (prof && prof.name) || 'courtiq';

      var preview, coinChip, panel;

      /* the character renders on TRANSPARENCY and the panel paints the
         court itself (solid or CSS gradient) — DiceBear's baked-in
         square background never matched a styled container, which is
         exactly the "ugly square behind the face" bug */
      function previewUrl() { return A.buildUrl(params, { seed: seed, size: 240, noBg: true }); }

      function refreshPreview() {
        preview.style.background = A.bgCss(params);
        var img = preview.querySelector('img');
        img.src = previewUrl();
      }
      function refreshCoins() {
        coinChip.querySelector('.av12-coins__n').textContent = String(A.coins());
      }

      /* one option tile */
      function tile(cat, o) {
        var c = A.CAT[cat];
        var active = params[cat] === o.id;
        var owned = owns(o.id);
        var locked = !owned && o.cost > 0;

        var kids = [];
        if (c.swatch) {
          kids.push(h('span', { class: 'av12-tile__sw', style: { background: '#' + o.v } }));
        } else if (o.grad) {
          kids.push(h('span', { class: 'av12-tile__sw',
            style: { background: 'linear-gradient(135deg,#' + o.bgv[0] + ',#' + o.bgv[1] + ')' } }));
        } else if (o.bgv) {
          kids.push(h('span', { class: 'av12-tile__sw', style: { background: '#' + o.bgv[0] } }));
        } else if (o.off) {
          kids.push(h('i', { class: 'ph-bold ph-prohibit av12-tile__ic' }));
        } else {
          kids.push(h('i', { class: 'ph-fill ' + (c.icon || 'ph-circle') + ' av12-tile__ic' }));
        }
        if (o.label && !c.swatch) kids.push(h('span', { class: 'av12-tile__l', text: A.optLabel ? A.optLabel(o, cat) : o.label }));
        if (locked) {
          kids.push(h('span', { class: 'av12-tile__cost' }, [
            h('i', { class: 'ph-fill ph-coin' }),
            h('span', { text: String(o.cost) })
          ]));
        }

        var el = h('button', {
          class: 'av12-tile' + (active ? ' is-active' : '') + (locked ? ' is-locked' : '') +
                 (c.swatch ? ' av12-tile--sw' : ''),
          type: 'button', 'aria-pressed': active ? 'true' : 'false',
          title: locked ? t('av.tilecost', { label: (A.optLabel ? A.optLabel(o, cat) : o.label) || '', cost: o.cost })
                        : ((A.optLabel ? A.optLabel(o, cat) : o.label) || ''),
          onclick: function () {
            if (locked) {
              var r = A.buy(o.id);
              toast(r.msg, !r.ok);
              if (!r.ok) return;
              refreshCoins();
            }
            params[cat] = o.id;
            /* a print only exists on the graphic tee — picking one puts
               the tee on, so the tap is always visible on the preview */
            if (cat === 'clothingGraphic') params.clothing = 'graphicShirt';
            A.save(params);           // persist live so preview & header agree
            refreshPreview();
            paintPanel();
          }
        }, kids);
        return el;
      }

      function catRow(cat) {
        var c = A.CAT[cat];
        var row = h('div', { class: 'av12-cat' }, [
          h('div', { class: 'd-label av12-cat__l',
            text: A.labelOf ? A.labelOf('cat', cat, c.label) : c.label }),
          h('div', { class: c.swatch ? 'av12-swatches' : 'av12-tiles' },
            c.options.map(function (o) { return tile(cat, o); }))
        ]);
        return row;
      }

      function paintPanel() {
        while (panel.firstChild) panel.removeChild(panel.firstChild);
        /* One shop read for the whole panel. tile() called A.isOwned per
           option — getItem + full JSON.parse each — across every category
           in the tab, on every repaint. Taken per paint, not memoised:
           lib/sync.js rewrites courtiq_shop_v12 on each pull. */
        owns = A.ownedChecker ? A.ownedChecker() : A.isOwned;
        var tabDef = A.TABS.filter(function (x) { return x.id === tab; })[0] || A.TABS[0];
        tabDef.cats.forEach(function (cat) { panel.appendChild(catRow(cat)); });
      }

      /* ── compose ── */
      host.appendChild(h('div', { class: 'c12-chat-hd' }, [
        h('button', {
          class: 'c12-back', type: 'button', 'aria-label': t('av.back'),
          onclick: function () { ctx.back(); }
        }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
        h('div', { style: { flex: '1' } }, [
          h('div', { class: 'c12-chat-hd__t', text: t('av.title') }),
          h('div', { class: 'c12-chat-hd__s', text: t('av.sub') })
        ]),
        (function () {
          coinChip = h('div', { class: 'av12-coins' }, [
            h('i', { class: 'ph-fill ph-coin' }),
            h('span', { class: 'av12-coins__n', text: String(A.coins()) })
          ]);
          return coinChip;
        })()
      ]));

      preview = h('div', { class: 'av12-preview' }, [
        h('img', { src: previewUrl(), alt: t('av.alt'), class: 'av12-preview__img' }),
        /* dice: a random look drawn ONLY from what's free or already
           owned — the shuffle never spends a coin or shows a lock */
        h('button', {
          class: 'av12-dice', type: 'button', 'aria-label': t('av.random'),
          onclick: function () {
            Object.keys(A.CAT).forEach(function (cat) {
              var pool = A.CAT[cat].options.filter(function (o) {
                return A.isOwned(o.id);
              });
              if (pool.length) params[cat] = pool[Math.floor(Math.random() * pool.length)].id;
            });
            A.save(params);
            refreshPreview();
            paintPanel();
          }
        }, [h('i', { class: 'ph-bold ph-dice-five' })])
      ]);
      preview.style.background = A.bgCss(params);
      host.appendChild(preview);

      host.appendChild(V12.seg(A.TABS.map(function (tb) {
        return { id: tb.id, label: A.labelOf ? A.labelOf('tab', tb.id, tb.label) : tb.label };
      }), tab, function (n) { tab = n; paintPanel(); }));

      panel = h('div', { class: 'av12-panel' });
      host.appendChild(panel);
      paintPanel();

      host.appendChild(V12.btn({
        label: t('av.save'), icon: 'ph-check',
        onClick: function () { A.save(params); toast(t('av.saved')); ctx.go('me'); }
      }));
      host.appendChild(V12.card({
        press: true, class: 'av12-shoplink', bgIcon: 'ph-storefront', bgTone: 'gold',
        onClick: function () { ctx.go('shop'); }, label: t('av.shop')
      }, [
        h('i', { class: 'ph-fill ph-storefront av12-shoplink__ic' }),
        h('div', {}, [
          h('div', { class: 'av12-shoplink__t', text: t('av.shoptitle') }),
          h('div', { class: 'av12-shoplink__s', text: t('av.shopsub') })
        ]),
        h('i', { class: 'ph-bold ph-caret-right av12-shoplink__chev' })
      ]));
    });
  }

  window.app.register('avatar-customizer', render);
})();
