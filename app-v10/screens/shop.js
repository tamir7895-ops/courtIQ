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

  function toast(msg, bad) {
    var old = document.querySelector('.av12-toast');
    if (old) old.remove();
    var t = h('div', { class: 'av12-toast' + (bad ? ' is-bad' : ''), text: msg });
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-in'); }, 10);
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 220); }, 1900);
  }

  var SECTION_ICON = {
    Gear: 'ph-sunglasses', Hair: 'ph-scissors', Beard: 'ph-user',
    Fit: 'ph-t-shirt', Court: 'ph-basketball'
  };

  function render(args) {
    var host = args.host, ctx = args.ctx;

    function paint() {
      while (host.firstChild) host.removeChild(host.firstChild);

      host.appendChild(h('div', { class: 'c12-chat-hd' }, [
        h('button', {
          class: 'c12-back', type: 'button', 'aria-label': 'Back',
          onclick: function () { ctx.go('me'); }
        }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
        h('div', {}, [
          h('div', { class: 'c12-chat-hd__t', text: 'Coin shop' }),
          h('div', { class: 'c12-chat-hd__s', text: 'Earn coins by training — spend them on drip' })
        ])
      ]));

      var bal = A.coins();
      host.appendChild(V12.card({ tint: 'gold', class: 'shop12-hero', bgIcon: 'ph-coins', bgTone: 'gold' }, [
        h('div', {}, [
          h('div', { class: 'shop12-hero__coins' }, [
            h('i', { class: 'ph-fill ph-coin' }),
            h('span', { text: String(bal) })
          ]),
          h('div', { class: 'shop12-hero__sub', text: 'coins to spend · 1 XP earned = 1 coin' })
        ])
      ]));

      /* ── POWER-UPS — consumables, not cosmetics ─────────────────── */
      var FREEZE_COST = 150;
      var frz = (window.StreakSystem && StreakSystem.freezes) ? StreakSystem.freezes() : 0;
      host.appendChild(h('div', { class: 'd-label shop12-sec__l' }, [h('span', { text: 'Power-ups' })]));
      host.appendChild(h('button', {
        class: 'shop12-item shop12-item--wide' + (bal < FREEZE_COST ? ' is-cant' : ''),
        type: 'button',
        onclick: function () {
          if (!window.V12Avatar || !V12Avatar.spend || !window.StreakSystem) return;
          var r = V12Avatar.spend(FREEZE_COST, 'Streak Freeze');
          if (r.ok) {
            StreakSystem.addFreeze(1);
            toast('Streak Freeze armed — one missed day forgiven');
            paint();
          } else toast(r.msg);
        }
      }, [
        h('i', { class: 'ph-fill ph-snowflake shop12-item__ic', style: { color: '#1C7ED6' } }),
        h('div', { style: { flex: '1', minWidth: '0', textAlign: 'left' } }, [
          h('div', { class: 'shop12-item__t', text: 'Streak Freeze' + (frz ? ' · ' + frz + ' armed' : '') }),
          h('div', { class: 'shop12-item__s', text: 'Miss one day — the fire survives. Used automatically.' })
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
          h('span', { text: label })
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
              h('span', { text: equipped ? 'On' : 'Equip' })
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
            title: (o.label || '') + ' · ' + row.catLabel,
            onclick: function () {
              if (owned) {
                A.equip(o.id);
                toast((o.label || 'Item') + ' equipped');
                paint();
                return;
              }
              var r = A.buy(o.id);
              toast(r.msg, !r.ok);
              if (r.ok) { A.equip(o.id); paint(); }
            }
          }, [
            visual,
            h('div', { class: 'shop12-item__n', text: o.label || o.id }),
            h('div', { class: 'shop12-item__cat', text: row.catLabel }),
            action
          ]));
        });
        host.appendChild(grid);
      });

      host.appendChild(V12.btn({
        label: 'Open creator', icon: 'ph-user-circle-gear',
        onClick: function () { ctx.go('avatar-customizer'); }
      }));
      host.appendChild(V12.card({
        press: true, class: 'av12-shoplink', bgIcon: 'ph-play-circle', bgTone: 'orange',
        onClick: function () { ctx.go('camera-hud'); }, label: 'Earn more coins'
      }, [
        h('i', { class: 'ph-fill ph-play-circle av12-shoplink__ic', style: { color: 'var(--d-orange)' } }),
        h('div', {}, [
          h('div', { class: 'av12-shoplink__t', text: 'Need more coins?' }),
          h('div', { class: 'av12-shoplink__s', text: 'Every session and drill pays out XP' })
        ]),
        h('i', { class: 'ph-bold ph-caret-right av12-shoplink__chev' })
      ]));
    }

    paint();
  }

  window.app.register('shop', render);
})();
