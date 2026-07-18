/* app-v10/screens/plan.js — v12
   PLAN SETTINGS — edit the training plan after onboarding. Same prefs
   the combine wrote (courtiq_plan_prefs); changing them re-shapes what
   train.js prescribes (focus areas + how many drills fit the minutes).
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  var LS = 'courtiq_plan_prefs';
  function load() {
    try {
      var raw = localStorage.getItem(LS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { days: 4, minutes: 30, equipment: ['ball', 'hoop'], focus: [], goals: [] };
  }
  function save(p) { try { localStorage.setItem(LS, JSON.stringify(p)); } catch (e) {} }

  var FOCUS = [
    { id: 'shooting', l: 'Shooting' }, { id: 'handles', l: 'Ball handling' },
    { id: 'finishing', l: 'Finishing' }, { id: 'defense', l: 'Defense' },
    { id: 'conditioning', l: 'Conditioning' }, { id: 'passing', l: 'Passing' }
  ];
  var GEAR = [
    { id: 'ball', l: 'Ball' }, { id: 'hoop', l: 'A hoop' }, { id: 'cones', l: 'Cones' },
    { id: 'gym', l: 'Gym access' }, { id: 'weights', l: 'Weights' }, { id: 'partner', l: 'A partner' }
  ];

  function render(args) {
    var host = args.host, ctx = args.ctx;
    var p = load();
    if (!p.equipment) p.equipment = [];
    if (!p.focus) p.focus = [];

    function paint() {
      while (host.firstChild) host.removeChild(host.firstChild);

      host.appendChild(h('div', { class: 'c12-chat-hd' }, [
        h('button', {
          class: 'c12-back', type: 'button', 'aria-label': 'Back',
          onclick: function () { ctx.go('train'); }
        }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
        h('div', {}, [
          h('div', { class: 'c12-chat-hd__t', text: 'Plan settings' }),
          h('div', { class: 'c12-chat-hd__s', text: 'Shape what your sessions look like' })
        ])
      ]));

      var body = h('div', { class: 'onb12-body', style: { paddingTop: '4px' } });

      // days
      var daysV = h('span', { class: 'onb12-slider__v', text: String(p.days) });
      var daysR = h('input', { type: 'range', min: '1', max: '7', value: String(p.days), class: 'onb12-range' });
      daysR.addEventListener('input', function () { p.days = parseInt(daysR.value, 10); daysV.textContent = p.days; });
      body.appendChild(h('div', { class: 'onb12-slider' }, [
        h('div', { class: 'onb12-slider__top' }, [h('span', { class: 'd-label', text: 'Days per week' }), daysV]), daysR
      ]));

      // minutes
      body.appendChild(h('div', { class: 'd-label', text: 'SESSION LENGTH' }));
      body.appendChild(h('div', { class: 'onb12-grid4' }, [15, 30, 45, 60].map(function (m) {
        return h('button', {
          class: 'onb12-pill' + (p.minutes === m ? ' is-active' : ''), type: 'button',
          onclick: function () { p.minutes = m; paint(); }
        }, [h('div', { class: 'onb12-pill__l', text: m + 'm' })]);
      })));

      // focus
      body.appendChild(h('div', { class: 'd-label', text: 'FOCUS (UP TO 3, IN ORDER)' }));
      body.appendChild(h('div', { class: 'onb12-chips' }, FOCUS.map(function (f) {
        var rank = p.focus.indexOf(f.id);
        return h('button', {
          class: 'onb12-chip' + (rank >= 0 ? ' is-active' : ''), type: 'button',
          text: (rank >= 0 ? (rank + 1) + '. ' : '') + f.l,
          onclick: function () {
            var i = p.focus.indexOf(f.id);
            if (i >= 0) p.focus.splice(i, 1);
            else { if (p.focus.length >= 3) p.focus.shift(); p.focus.push(f.id); }
            paint();
          }
        });
      })));

      // gear
      body.appendChild(h('div', { class: 'd-label', text: 'GEAR YOU HAVE' }));
      body.appendChild(h('div', { class: 'onb12-chips' }, GEAR.map(function (g) {
        var on = p.equipment.indexOf(g.id) >= 0;
        return h('button', {
          class: 'onb12-chip' + (on ? ' is-active' : ''), type: 'button', text: g.l,
          onclick: function () {
            var i = p.equipment.indexOf(g.id);
            if (i >= 0) p.equipment.splice(i, 1); else p.equipment.push(g.id);
            paint();
          }
        });
      })));

      host.appendChild(h('div', { class: 'onb12-scroll', style: { flex: '1 1 auto' } }, [body]));

      host.appendChild(V12.btn({
        label: 'Save plan', icon: 'ph-check',
        onClick: function () { save(p); ctx.go('train'); }
      }));
    }

    paint();
  }

  window.app.register('plan', render);
})();
