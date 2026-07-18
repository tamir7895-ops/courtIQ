/* app-v10/screens/onboarding.js — v12
   THE COMBINE — a real intake that actually shapes the plan.

   Ten steps in the white v12 grammar. The first four scout the player
   (identity, position, style, self-rated skills); the middle four
   build the training plan (schedule, gear, focus, goals) and are
   PERSISTED to courtiq_plan_prefs so train.js prescribes from them;
   the last two synthesize and report. Nothing is theater — the grade,
   the strengths/gaps and the plan summary are all derived from what
   the user entered.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  var STEPS = [
    'identity', 'position', 'style', 'scout',
    'schedule', 'gear', 'focus', 'goals',
    'processing', 'report'
  ];
  var TITLES = {
    identity: 'Who are you', position: 'Your spot', style: 'Your game',
    scout: 'Rate yourself', schedule: 'Your schedule', gear: 'Your gear',
    focus: 'What matters', goals: 'Your goals',
    processing: 'Building your plan', report: 'Your combine card'
  };

  function ensure() {
    if (!window._v12Onb) {
      window._v12Onb = {
        i: 0,
        name: '', height: 74, weight: 175, age: 17, hand: 'R',
        position: null, playStyle: null,
        skills: { shoot: 6, handle: 5, pass: 5, defend: 5, finish: 6, iq: 6 },
        days: 4, minutes: 30, equipment: ['ball', 'hoop'],
        focus: [], goals: []
      };
    }
    return window._v12Onb;
  }

  /* ── little v12 controls ─────────────────────────────────────*/
  function slider(label, val, min, max, unit, onChange) {
    var out = h('span', { class: 'onb12-slider__v', text: val + (unit || '') });
    var input = h('input', {
      type: 'range', min: String(min), max: String(max), value: String(val),
      class: 'onb12-range'
    });
    input.addEventListener('input', function () {
      out.textContent = input.value + (unit || '');
      onChange(parseInt(input.value, 10));
    });
    return h('div', { class: 'onb12-slider' }, [
      h('div', { class: 'onb12-slider__top' }, [
        h('span', { class: 'd-label', text: label }), out
      ]),
      input
    ]);
  }

  function pill(label, active, onClick, sub) {
    return h('button', {
      class: 'onb12-pill' + (active ? ' is-active' : ''), type: 'button',
      onclick: onClick
    }, [
      h('div', { class: 'onb12-pill__l', text: label }),
      sub ? h('div', { class: 'onb12-pill__s', text: sub }) : null
    ].filter(Boolean));
  }

  function chip(label, active, onClick) {
    return h('button', {
      class: 'onb12-chip' + (active ? ' is-active' : ''), type: 'button',
      text: label, onclick: onClick
    });
  }

  function grid(cls, kids) { return h('div', { class: cls }, kids); }

  /* ── step bodies ─────────────────────────────────────────────*/
  function stepIdentity(s, rerender) {
    var name = h('input', {
      class: 'onb12-input', type: 'text', maxlength: '20',
      placeholder: 'Your name', value: s.name,
      oninput: function (e) { s.name = e.target.value; }
    });
    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'd-label', text: 'NAME' }), name,
      slider('Height', s.height, 60, 90, '"', function (v) { s.height = v; }),
      slider('Weight', s.weight, 100, 320, ' lb', function (v) { s.weight = v; }),
      slider('Age', s.age, 10, 60, ' yr', function (v) { s.age = v; }),
      h('div', { class: 'd-label', text: 'SHOOTING HAND' }),
      grid('onb12-two', ['L', 'R'].map(function (hd) {
        return pill(hd === 'L' ? 'Lefty' : 'Righty', s.hand === hd,
          function () { s.hand = hd; rerender(); });
      }))
    ]);
  }

  function stepPosition(s, rerender) {
    var POS = [
      { id: 'PG', l: 'Point', s: 'Run the show' },
      { id: 'SG', l: 'Shooting', s: 'Get buckets' },
      { id: 'SF', l: 'Small F', s: 'Do it all' },
      { id: 'PF', l: 'Power F', s: 'Bang inside' },
      { id: 'C',  l: 'Center', s: 'Own the paint' }
    ];
    return h('div', { class: 'onb12-body' }, [
      grid('onb12-grid3', POS.map(function (p) {
        return pill(p.l, s.position === p.id, function () { s.position = p.id; rerender(); }, p.s);
      }))
    ]);
  }

  function stepStyle(s, rerender) {
    var ST = [
      { id: 'sniper', l: 'Sniper', s: 'Lives behind the arc' },
      { id: 'slasher', l: 'Slasher', s: 'Attacks the rim' },
      { id: 'floor-general', l: 'Floor General', s: 'Sees it first' },
      { id: 'lockdown', l: 'Lockdown', s: 'Defense wins' }
    ];
    return h('div', { class: 'onb12-body' }, ST.map(function (x) {
      return pill(x.l, s.playStyle === x.id, function () { s.playStyle = x.id; rerender(); }, x.s);
    }));
  }

  function stepScout(s) {
    var SK = [
      { k: 'shoot', l: 'Shooting' }, { k: 'handle', l: 'Ball handling' },
      { k: 'pass', l: 'Passing' }, { k: 'defend', l: 'Defense' },
      { k: 'finish', l: 'Finishing' }, { k: 'iq', l: 'Court IQ' }
    ];
    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'onb12-hint', text: 'Rate yourself 0–10. The court gets the final say later.' })
    ].concat(SK.map(function (x) {
      return slider(x.l, s.skills[x.k], 0, 10, '/10', function (v) { s.skills[x.k] = v; });
    })));
  }

  function stepSchedule(s) {
    return h('div', { class: 'onb12-body' }, [
      slider('Days per week', s.days, 1, 7, '', function (v) { s.days = v; }),
      h('div', { class: 'd-label', text: 'SESSION LENGTH' }),
      grid('onb12-grid4', [15, 30, 45, 60].map(function (m) {
        return pill(m + 'm', s.minutes === m, function () { s.minutes = m; }, null);
      })),
      h('div', { class: 'onb12-hint', text: 'We size each session to fit — shorter days get tighter blocks.' })
    ]);
  }

  function stepGear(s, rerender) {
    var GEAR = [
      { id: 'ball', l: 'Ball' }, { id: 'hoop', l: 'A hoop' },
      { id: 'cones', l: 'Cones' }, { id: 'gym', l: 'Gym access' },
      { id: 'weights', l: 'Weights' }, { id: 'partner', l: 'A partner' }
    ];
    function toggle(id) {
      var i = s.equipment.indexOf(id);
      if (i >= 0) s.equipment.splice(i, 1); else s.equipment.push(id);
      rerender();
    }
    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'onb12-hint', text: 'Pick everything you can get to. Drills that need gear you don’t have get skipped.' }),
      grid('onb12-chips', GEAR.map(function (g) {
        return chip(g.l, s.equipment.indexOf(g.id) >= 0, function () { toggle(g.id); });
      }))
    ]);
  }

  function stepFocus(s, rerender) {
    var FOCUS = [
      { id: 'shooting', l: 'Shooting' }, { id: 'handles', l: 'Ball handling' },
      { id: 'finishing', l: 'Finishing' }, { id: 'defense', l: 'Defense' },
      { id: 'conditioning', l: 'Conditioning' }, { id: 'passing', l: 'Passing' }
    ];
    function toggle(id) {
      var i = s.focus.indexOf(id);
      if (i >= 0) s.focus.splice(i, 1);
      else { if (s.focus.length >= 3) s.focus.shift(); s.focus.push(id); }
      rerender();
    }
    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'onb12-hint', text: 'Pick up to 3 — your plan leans hardest on these, in order.' }),
      grid('onb12-chips', FOCUS.map(function (f) {
        var rank = s.focus.indexOf(f.id);
        var el = chip((rank >= 0 ? (rank + 1) + '. ' : '') + f.l, rank >= 0, function () { toggle(f.id); });
        return el;
      }))
    ]);
  }

  function stepGoals(s, rerender) {
    var G = ['Make varsity', 'Win a starting job', 'College looks', 'Go pro',
             'Stay healthy', 'Beat my rival', 'Tournament MVP', 'Love the game'];
    function toggle(g) {
      var i = s.goals.indexOf(g);
      if (i >= 0) s.goals.splice(i, 1); else s.goals.push(g);
      rerender();
    }
    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'onb12-hint', text: 'Pick all that apply — we tune the tone around these.' }),
      grid('onb12-chips', G.map(function (g) {
        return chip(g, s.goals.indexOf(g) >= 0, function () { toggle(g); });
      }))
    ]);
  }

  function stepProcessing(s, host, rerender) {
    var lines = ['Reading your measurables', 'Cross-referencing your style',
                 'Sizing sessions to your week', 'Compiling your plan'];
    var wrap = h('div', { class: 'onb12-body onb12-proc' });
    var rows = lines.map(function (t, i) {
      var r = h('div', { class: 'onb12-proc__row', 'data-i': String(i) }, [
        h('i', { class: 'ph-bold ph-circle onb12-proc__mk' }),
        h('span', { text: t })
      ]);
      wrap.appendChild(r);
      return r;
    });
    var i = 0;
    var timer = setInterval(function () {
      if (i >= rows.length) {
        clearInterval(timer);
        setTimeout(function () { s.i++; rerender(); }, 450);
        return;
      }
      rows[i].classList.add('is-done');
      rows[i].querySelector('.onb12-proc__mk').className = 'ph-fill ph-check-circle onb12-proc__mk';
      i++;
    }, 650);
    return wrap;
  }

  function stepReport(s) {
    var SKILL_L = { shoot: 'Shooting', handle: 'Ball handling', pass: 'Passing',
                    defend: 'Defense', finish: 'Finishing', iq: 'Court IQ' };
    var entries = Object.keys(s.skills).map(function (k) { return { k: k, v: s.skills[k] }; })
      .sort(function (a, b) { return b.v - a.v; });
    var avg = entries.reduce(function (n, e) { return n + e.v; }, 0) / entries.length;
    var grade = avg >= 8.5 ? 'A' : avg >= 7.5 ? 'A-' : avg >= 6.5 ? 'B+'
              : avg >= 5.5 ? 'B' : avg >= 4.5 ? 'B-' : avg >= 3.5 ? 'C+' : 'C';
    var arche = s.playStyle === 'sniper' ? 'PERIMETER SNIPER'
      : s.playStyle === 'slasher' ? 'DOWNHILL SLASHER'
      : s.playStyle === 'floor-general' ? 'FLOOR GENERAL'
      : s.playStyle === 'lockdown' ? 'PERIMETER LOCKDOWN' : 'TWO-WAY WING';
    var focusL = { shooting: 'Shooting', handles: 'Ball handling', finishing: 'Finishing',
                   defense: 'Defense', conditioning: 'Conditioning', passing: 'Passing' };
    var focusText = s.focus.length ? s.focus.map(function (f) { return focusL[f]; }).join(' · ')
                                   : 'Balanced';

    return h('div', { class: 'onb12-body' }, [
      V12.card({ tint: 'gold', class: 'onb12-card' }, [
        h('div', { class: 'd-label', text: 'SELF-SCOUT GRADE' }),
        h('div', { class: 'onb12-grade', text: grade }),
        h('div', { class: 'onb12-arche', text: arche })
      ]),
      V12.card({ tint: 'ink', class: 'onb12-plan' }, [
        h('div', { class: 'd-label', text: 'YOUR PLAN' }),
        h('div', { class: 'onb12-plan__row' }, [
          h('i', { class: 'ph-fill ph-calendar-check' }),
          h('span', { text: s.days + ' days/week · ' + s.minutes + ' min a session' })
        ]),
        h('div', { class: 'onb12-plan__row' }, [
          h('i', { class: 'ph-fill ph-target' }),
          h('span', { text: 'Focus: ' + focusText })
        ]),
        h('div', { class: 'onb12-plan__row' }, [
          h('i', { class: 'ph-fill ph-barbell' }),
          h('span', { text: 'Gear: ' + (s.equipment.length ? s.equipment.join(', ') : 'bodyweight') })
        ])
      ])
    ]);
  }

  function persist(s) {
    try {
      localStorage.setItem('courtiq_profile_name', s.name || 'Rookie');
      localStorage.setItem('courtiq_profile_position', s.position || '');
      localStorage.setItem('courtiq_profile_hand', s.hand || 'R');
      localStorage.setItem('courtiq_profile_height', String(s.height));
      localStorage.setItem('courtiq_profile_weight', String(s.weight));
      localStorage.setItem('courtiq_profile_age', String(s.age));
      localStorage.setItem('courtiq_profile_playstyle', s.playStyle || '');
      localStorage.setItem('courtiq_plan_prefs', JSON.stringify({
        days: s.days, minutes: s.minutes, equipment: s.equipment,
        focus: s.focus, goals: s.goals, skills: s.skills
      }));
      localStorage.setItem('courtiq_onboarded', '1');
    } catch (e) {}
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    var s = ensure();

    function paint() {
      while (host.firstChild) host.removeChild(host.firstChild);
      var step = STEPS[s.i];
      var last = STEPS.length - 1;

      /* progress + title */
      var bar = h('div', { class: 'onb12-progress' });
      for (var k = 0; k < STEPS.length; k++) {
        bar.appendChild(h('span', { class: 'onb12-progress__seg' + (k <= s.i ? ' is-on' : '') }));
      }
      host.appendChild(h('div', { class: 'onb12-head' }, [
        bar,
        h('div', { class: 'onb12-step', text: 'Step ' + (s.i + 1) + ' of ' + STEPS.length }),
        h('div', { class: 'onb12-title', text: TITLES[step] })
      ]));

      var body;
      switch (step) {
        case 'identity': body = stepIdentity(s, paint); break;
        case 'position': body = stepPosition(s, paint); break;
        case 'style': body = stepStyle(s, paint); break;
        case 'scout': body = stepScout(s); break;
        case 'schedule': body = stepSchedule(s); break;
        case 'gear': body = stepGear(s, paint); break;
        case 'focus': body = stepFocus(s, paint); break;
        case 'goals': body = stepGoals(s, paint); break;
        case 'processing': body = stepProcessing(s, host, paint); break;
        case 'report': body = stepReport(s); break;
      }
      var scroll = h('div', { class: 'onb12-scroll' }, [body]);
      host.appendChild(scroll);

      if (step === 'processing') return;  // auto-advances

      var canNext = true;
      if (step === 'identity') canNext = !!(s.name && s.name.trim());
      if (step === 'position') canNext = !!s.position;
      if (step === 'style') canNext = !!s.playStyle;
      if (step === 'focus') canNext = s.focus.length > 0;

      var nextLabel = step === 'report' ? 'Enter CourtIQ'
        : step === 'goals' ? 'Build my plan' : 'Continue';

      var foot = h('div', { class: 'onb12-foot' });
      foot.appendChild(h('button', {
        class: 'd-btn d-btn--ghost onb12-back', type: 'button',
        onclick: function () {
          if (s.i === 0) { ctx.go('home'); return; }
          s.i = Math.max(0, s.i - (STEPS[s.i - 1] === 'processing' ? 2 : 1));
          paint();
        }
      }, [h('span', { text: s.i === 0 ? 'Cancel' : 'Back' })]));
      foot.appendChild(V12.btn({
        label: nextLabel, icon: step === 'report' ? 'ph-arrow-right' : 'ph-caret-right',
        onClick: function () {
          if (!canNext) return;
          if (step === 'report') { persist(s); window._v12Onb = null; ctx.go('home'); return; }
          s.i++;
          paint();
        }
      }));
      foot.querySelector('.onb12-back');
      if (!canNext) foot.lastChild.setAttribute('disabled', 'true');
      host.appendChild(foot);
    }

    paint();
  }

  window.app.register('onboarding', render);
})();
