/* app-v10/screens/shop.js — v12 (new)
   COIN SHOP — spend the coins you earn (1 XP = 1 coin) on premium
   cosmetics: gear, hair, beards, fits, and gradient courts. Every
   item maps to a real DiceBear option via lib/avatar.js, so buying
   then equipping changes the actual avatar. Owned items equip on tap.

   Honest economy: the balance is your real XP minus what you've
   spent. A brand-new player sees a real (often small) number and
   items they can't afford yet — no fake currency, no pay-wall.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12, A = window.V12Avatar;

  var T = {
    en: {
      'shop.back':           'Back',
      'shop.title':          'Coin shop',
      'shop.sub':            'Earn coins by training — spend them on drip',
      'shop.hero.sub':       'coins to spend · 1 XP earned = 1 coin',
      'shop.pw':             'Power-ups',
      'shop.freeze.t':       'Streak Freeze',
      'shop.freeze.armed':   'Streak Freeze · {n} armed',
      'shop.freeze.s':       'Miss one day — the fire survives. Used automatically.',
      'shop.freeze.toast':   'Streak Freeze armed — one missed day forgiven',
      'shop.cat.gear':       'Gear',
      'shop.cat.hair':       'Hair',
      'shop.cat.beard':      'Beard',
      'shop.cat.fit':        'Fit',
      'shop.cat.court':      'Court',
      'shop.item.title':     '{item} · {cat}',
      'shop.on':             'On',
      'shop.equip':          'Equip',
      'shop.item':           'Item',
      'shop.toast.equipped': '{item} equipped',
      'shop.creator':        'Open creator',
      'shop.more.label':     'Earn more coins',
      'shop.more.t':         'Need more coins?',
      'shop.more.s':         'Every session and drill pays out XP'
    },
    he: {
      'shop.back':           'חזרה',
      'shop.title':          'חנות המטבעות',
      'shop.sub':            'מרוויחים מטבעות באימון — מבזבזים על סטייל',
      'shop.hero.sub':       'מטבעות לבזבוז · כל XP שווה מטבע',
      'shop.pw':             'פאוור-אפים',
      'shop.freeze.t':       'הקפאת רצף',
      'shop.freeze.armed':   'הקפאת רצף · {n} מוכנות',
      'shop.freeze.s':       'פספסת יום? האש שורדת. מופעל אוטומטית.',
      'shop.freeze.toast':   'הקפאת רצף נטענה — יום חסר אחד נסלח',
      'shop.cat.gear':       'אקססוריז',
      'shop.cat.hair':       'שיער',
      'shop.cat.beard':      'זקן',
      'shop.cat.fit':        'לבוש',
      'shop.cat.court':      'מגרש',
      'shop.item.title':     '{item} · {cat}',
      'shop.on':             'פעיל',
      'shop.equip':          'ללבוש',
      'shop.item':           'פריט',
      'shop.toast.equipped': '{item} עליך עכשיו',
      'shop.creator':        'לעורך הדמות',
      'shop.more.label':     'להרוויח עוד מטבעות',
      'shop.more.t':         'צריך עוד מטבעות?',
      'shop.more.s':         'כל סשן ותרגיל משלמים XP'
    }
  };
  if (window.V12I18n) V12I18n.add(T);
  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

  function toast(msg, bad) {
    var old = document.querySelector('.av12-toast');
    if (old) old.remove();
    var el = h('div', { class: 'av12-toast' + (bad ? ' is-bad' : ''), text: msg });
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('is-in'); }, 10);
    setTimeout(function () { el.classList.remove('is-in'); setTimeout(function () { el.remove(); }, 220); }, 1900);
  }

  var SECTION_ICON = {
    Gear: 'ph-sunglasses', Hair: 'ph-scissors', Beard: 'ph-user',
    Fit: 'ph-t-shirt', Court: 'ph-basketball'
  };

  /* catalog catLabels are data keys ('Gear', 'Hair', …) — displayed
     through i18n, unknown labels fall through untouched */
  var CAT_KEY = {
    Gear: 'shop.cat.gear', Hair: 'shop.cat.hair', Beard: 'shop.cat.beard',
    Fit: 'shop.cat.fit', Court: 'shop.cat.court'
  };
  function catName(label) { return CAT_KEY[label] ? t(CAT_KEY[label]) : label; }

  function render(args) {
    var host = args.host, ctx = args.ctx;

    function paint() {
      while (host.firstChild) host.removeChild(host.firstChild);

      host.appendChild(h('div', { class: 'c12-chat-hd' }, [
        h('button', {
          class: 'c12-back', type: 'button', 'aria-label': t('shop.back'),
          onclick: function () { ctx.back(); }
        }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
        h('div', {}, [
          h('div', { class: 'c12-chat-hd__t', text: t('shop.title') }),
          h('div', { class: 'c12-chat-hd__s', text: t('shop.sub') })
        ])
      ]));

      var bal = A.coins();
      host.appendChild(V12.card({ tint: 'gold', class: 'shop12-hero', bgIcon: 'ph-coins', bgTone: 'gold' }, [
        h('div', {}, [
          h('div', { class: 'shop12-hero__coins' }, [
            h('i', { class: 'ph-fill ph-coin' }),
            h('span', { text: String(bal) })
          ]),
          h('div', { class: 'shop12-hero__sub', text: t('shop.hero.sub') })
        ])
      ]));

      /* ── POWER-UPS — consumables, not cosmetics ─────────────────── */
      var FREEZE_COST = 150;
      var frz = (window.StreakSystem && StreakSystem.freezes) ? StreakSystem.freezes() : 0;
      host.appendChild(h('div', { class: 'd-label shop12-sec__l' }, [h('span', { text: t('shop.pw') })]));
      host.appendChild(h('button', {
        class: 'shop12-item shop12-item--wide' + (bal < FREEZE_COST ? ' is-cant' : ''),
        type: 'button',
        onclick: function () {
          if (!window.V12Avatar || !V12Avatar.spend || !window.StreakSystem) return;
          var r = V12Avatar.spend(FREEZE_COST, 'Streak Freeze');
          if (r.ok) {
            StreakSystem.addFreeze(1);
            toast(t('shop.freeze.toast'));
            paint();
          } else toast(r.msg);
        }
      }, [
        h('i', { class: 'ph-fill ph-snowflake shop12-item__ic', style: { color: '#1C7ED6' } }),
        h('div', { style: { flex: '1', minWidth: '0', textAlign: 'left' } }, [
          h('div', { class: 'shop12-item__t',
            text: frz ? t('shop.freeze.armed', { n: frz }) : t('shop.freeze.t') }),
          h('div', { class: 'shop12-item__s', text: t('shop.freeze.s') })
        ]),
        h('span', { class: 'shop12-item__buy' }, [
          h('i', { class: 'ph-fill ph-coin' }),
          h('span', { text: String(FREEZE_COST) })
        ])
      ]));

      /* group premium catalog by category label */
      var groups = {};
      A.catalog().forEach(function (row) {
        (groups[row.catLabel] = groups[row.catLabel] || []).push(row);
      });
      // stable, readable order
      var order = ['Gear', 'Hair', 'Beard', 'Fit', 'Court'];
      order.forEach(function (label) {
        var rows = groups[label];
        if (!rows || !rows.length) return;

        host.appendChild(h('div', { class: 'd-label shop12-sec__l' }, [
          h('span', { text: catName(label) })
        ]));
        var grid = h('div', { class: 'shop12-grid' });
        rows.forEach(function (row) {
          var o = row.opt, cat = row.cat;
          var owned = A.isOwned(o.id);
          var equipped = A.load()[cat] === o.id;
          var cant = !owned && bal < o.cost;

          var visual;
          if (o.grad) {
            visual = h('span', { class: 'shop12-item__sw',
              style: { background: 'linear-gradient(135deg,#' + o.bgv[0] + ',#' + o.bgv[1] + ')' } });
          } else if (o.bgv) {
            visual = h('span', { class: 'shop12-item__sw', style: { background: '#' + o.bgv[0] } });
          } else {
            visual = h('i', { class: 'ph-fill ' + (A.CAT[cat].icon || 'ph-circle') + ' shop12-item__ic' });
          }

          var action;
          if (owned) {
            action = h('span', { class: 'shop12-item__buy' }, [
              h('i', { class: 'ph-fill ' + (equipped ? 'ph-check-circle' : 'ph-t-shirt') }),
              h('span', { text: equipped ? t('shop.on') : t('shop.equip') })
            ]);
          } else {
            action = h('span', { class: 'shop12-item__buy' }, [
              h('i', { class: 'ph-fill ph-coin' }),
              h('span', { text: String(o.cost) })
            ]);
          }

          grid.appendChild(h('button', {
            class: 'shop12-item' + (owned ? ' is-owned' : '') + (cant ? ' is-cant' : ''),
            type: 'button',
            title: t('shop.item.title', { item: (A.optLabel ? A.optLabel(o, row.cat) : o.label) || '', cat: catName(row.catLabel) }),
            onclick: function () {
              if (owned) {
                A.equip(o.id);
                toast(t('shop.toast.equipped', { item: (A.optLabel ? A.optLabel(o, row.cat) : o.label) || t('shop.item') }));
                paint();
                return;
              }
              var r = A.buy(o.id);
              toast(r.msg, !r.ok);
              if (r.ok) { A.equip(o.id); paint(); }
            }
          }, [
            visual,
            h('div', { class: 'shop12-item__n', text: (A.optLabel ? A.optLabel(o, row.cat) : o.label) || o.id }),
            h('div', { class: 'shop12-item__cat', text: catName(row.catLabel) }),
            action
          ]));
        });
        host.appendChild(grid);
      });

      host.appendChild(V12.btn({
        label: t('shop.creator'), icon: 'ph-user-circle-gear',
        onClick: function () { ctx.go('avatar-customizer'); }
      }));
      host.appendChild(V12.card({
        press: true, class: 'av12-shoplink', bgIcon: 'ph-play-circle', bgTone: 'orange',
        onClick: function () { ctx.go('track'); }, label: t('shop.more.label')
      }, [
        h('i', { class: 'ph-fill ph-play-circle av12-shoplink__ic', style: { color: 'var(--d-orange)' } }),
        h('div', {}, [
          h('div', { class: 'av12-shoplink__t', text: t('shop.more.t') }),
          h('div', { class: 'av12-shoplink__s', text: t('shop.more.s') })
        ]),
        h('i', { class: 'ph-bold ph-caret-right av12-shoplink__chev' })
      ]));
    }

    paint();
  }

  window.app.register('shop', render);
})();
