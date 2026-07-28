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
    'welcome',
    'identity', 'avatar', 'position', 'style', 'scout',
    'schedule', 'gear', 'focus', 'goals',
    'processing', 'report'
  ];
  var TITLES = {
    welcome: 'Meet your staff',
    identity: 'Who are you', avatar: 'Your look',
    position: 'Your spot', style: 'Your game',
    scout: 'Rate yourself', schedule: 'Your schedule', gear: 'Your gear',
    focus: 'What matters', goals: 'Your goals',
    processing: 'Building your plan', report: 'Your combine card'
  };

  /* Each step is hosted by the coach who owns that lane — the same
     cast the player meets in The Gym (exposed by screens/coach.js). */
  var GUIDE = {
    welcome:    { c: 'gm',     t: 'I’m The Scout — the GM here. Before you touch a ball I build a file on you. A few questions, then the staff takes over.' },
    identity:   { c: 'gm',     t: 'The file starts with the basics. Who am I scouting?' },
    avatar:     { c: 'gm',     t: 'Every file gets a face. Make yours — you can change everything later in the shop.' },
    position:   { c: 'gm',     t: 'Where do you live on the floor?' },
    style:      { c: 'gm',     t: 'And how do you hoop when nobody is coaching you?' },
    scout:      { c: 'gm',     t: 'Rate yourself straight. The court gets the final say anyway.' },
    schedule:   { c: 'flow',   t: 'Flow — handles coach. Rhythm beats volume: give me the honest number of days.' },
    gear:       { c: 'tank',   t: 'Tank. Strength staff. Tell me what we have to work with — no gym is no excuse.' },
    focus:      { c: 'splash', t: 'Splash, shooting coach. Pick what we sharpen first. I vote shooting, but it’s your game.' },
    goals:      { c: 'gm',     t: 'Scout again. Where is this going? We tune the whole program to the target.' },
    processing: { c: 'gm',     t: 'Give me a second with your file…' },
    report:     { c: 'gm',     t: 'Your combine card. The staff has seen it — welcome to the program.' }
  };

  function castById(id) {
    var cs = window.V12CoachCast || [];
    for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
    return null;
  }

  function guideRow(step) {
    var g = GUIDE[step];
    if (!g || !window.V12CoachFace || !V12.faceImg) return null;
    var c = castById(g.c);
    if (!c) return null;
    return h('div', { class: 'onb12-guide onb12-guide--' + g.c }, [
      V12.faceImg({ class: 'onb12-guide__face', src: window.V12CoachFace(c, 64), alt: c.name }),
      h('div', { class: 'onb12-guide__bubble' }, [
        h('div', { class: 'onb12-guide__name', text: c.name }),
        h('div', { class: 'onb12-guide__text', text: g.t })
      ])
    ]);
  }

  function stepWelcome() {
    var cs = window.V12CoachCast || [];
    var body = h('div', { class: 'onb12-body' });
    if (cs.length && window.V12CoachFace && V12.faceImg) {
      var strip = h('div', { class: 'onb12-staff' });
      cs.forEach(function (c, i) {
        strip.appendChild(h('div', {
          class: 'onb12-staff__card', style: 'animation-delay:' + (i * 90) + 'ms'
        }, [
          V12.faceImg({ class: 'onb12-staff__face', src: window.V12CoachFace(c, 96), alt: c.name }),
          h('div', { class: 'onb12-staff__name', text: c.name }),
          h('div', { class: 'onb12-staff__role', text: c.short || c.role })
        ]));
      });
      body.appendChild(strip);
    }
    body.appendChild(h('div', {
      class: 'onb12-hint',
      text: 'Four coaches, one program. Answer a few questions so they know exactly who just walked into their gym.'
    }));
    return body;
  }

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

  /* ── units ───────────────────────────────────────────────────
     Storage stays imperial (inches / lb) because that is what every
     existing profile already holds — the unit system is a VIEW over
     the same number, so flipping it never loses what was entered.
     First-run default comes from the device region: the US, Liberia
     and Myanmar get imperial, the rest of the world metric. */
  var LS_UNITS = 'courtiq_units';
  function detectUnits() {
    try {
      var saved = localStorage.getItem(LS_UNITS);
      if (saved === 'metric' || saved === 'imperial') return saved;
    } catch (e) {}
    var region = '';
    try {
      var loc = (navigator.language || '') +
                ((navigator.languages || []).join(',') || '');
      var m = loc.match(/-(US|LR|MM)\b/i);
      region = m ? 'imperial' : 'metric';
    } catch (e) { region = 'metric'; }
    return region;
  }
  function setUnits(u) {
    try { localStorage.setItem(LS_UNITS, u); } catch (e) {}
  }
  function fmtHeight(inches, units) {
    if (units === 'metric') return Math.round(inches * 2.54) + ' cm';
    return Math.floor(inches / 12) + "'" + (inches % 12) + '"';
  }
  function fmtWeight(lb, units) {
    if (units === 'metric') return Math.round(lb * 0.4536) + ' kg';
    return lb + ' lb';
  }

  /* ── step bodies ─────────────────────────────────────────────*/
  function stepIdentity(s, rerender) {
    var units = detectUnits();
    var t = function (k) { return window.V12I18n ? window.V12I18n.t(k) : k; };

    var name = h('input', {
      class: 'onb12-input', type: 'text', maxlength: '20',
      placeholder: 'Your name', value: s.name,
      oninput: function (e) { s.name = e.target.value; }
    });

    /* the unit toggle — one tap, the sliders re-label live */
    var toggle = h('div', { class: 'onb12-two onb12-units' }, [
      pill(t('onb.units.imperial'), units === 'imperial', function () {
        setUnits('imperial'); rerender();
      }),
      pill(t('onb.units.metric'), units === 'metric', function () {
        setUnits('metric'); rerender();
      })
    ]);

    /* sliders keep their IMPERIAL range (the stored unit) and only the
       label converts — so no precision is lost round-tripping */
    function unitSlider(labelKey, val, min, max, fmt, onChange) {
      var out = h('span', { class: 'onb12-slider__v', text: fmt(val, detectUnits()) });
      var input = h('input', {
        type: 'range', min: String(min), max: String(max), value: String(val),
        class: 'onb12-range'
      });
      input.addEventListener('input', function () {
        var v = parseInt(input.value, 10);
        out.textContent = fmt(v, detectUnits());
        onChange(v);
      });
      return h('div', { class: 'onb12-slider' }, [
        h('div', { class: 'onb12-slider__top' }, [
          h('span', { class: 'd-label', text: t(labelKey) }), out
        ]),
        input
      ]);
    }

    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'd-label', text: 'NAME' }), name,
      toggle,
      unitSlider('onb.height', s.height, 58, 90, fmtHeight, function (v) { s.height = v; }),
      unitSlider('onb.weight', s.weight, 80, 320, fmtWeight, function (v) { s.weight = v; }),
      slider('Age', s.age, 10, 60, ' yr', function (v) { s.age = v; }),
      h('div', { class: 'd-label', text: 'SHOOTING HAND' }),
      grid('onb12-two', ['L', 'R'].map(function (hd) {
        return pill(hd === 'L' ? 'Lefty' : 'Righty', s.hand === hd,
          function () { s.hand = hd; rerender(); });
      }))
    ]);
  }

  /* ── avatar: the file gets a face ────────────────────────────
     A compact version of the customizer, free options only — the
     premium catalog is the shop's job, and a paywall inside the very
     first minute is how you lose someone. Preview re-renders live off
     V12Avatar's own params, so what they build here is exactly what
     the header, gym and leaderboard will show. */
  function stepAvatar(s, rerender) {
    var A = window.V12Avatar;
    if (!A) return h('div', { class: 'onb12-body' });   // lib missing — skip gracefully

    var params = A.load();
    var preview = h('img', { class: 'onb12-av__img', alt: 'Your avatar',
      src: A.buildUrl(params, { seed: s.name || 'courtiq' }) });

    function commit() {
      A.save(params);
      preview.src = A.buildUrl(params, { seed: s.name || 'courtiq' });
    }

    function freeOpts(cat) {
      return A.CAT[cat].options.filter(function (o) { return !o.cost; });
    }

    /* one row of choices per category; swatch categories render color
       dots, the rest render labeled chips */
    function row(cat, labelText) {
      var c = A.CAT[cat];
      var opts = freeOpts(cat);
      var wrap = h('div', { class: 'onb12-av__opts' + (c.swatch ? ' onb12-av__opts--sw' : '') });
      opts.forEach(function (o) {
        var el;
        if (c.swatch) {
          el = h('button', {
            class: 'onb12-av__sw' + (params[cat] === o.id ? ' is-on' : ''),
            type: 'button', style: { background: '#' + o.v }, 'aria-label': o.id
          });
        } else {
          el = h('button', {
            class: 'onb12-chip' + (params[cat] === o.id ? ' is-active' : ''),
            type: 'button', text: o.label || o.id
          });
        }
        el.addEventListener('click', function () {
          params[cat] = o.id;
          commit(); rerender();
        });
        wrap.appendChild(el);
      });
      return h('div', { class: 'onb12-av__row' }, [
        h('div', { class: 'd-label', text: labelText }), wrap
      ]);
    }

    var shuffle = h('button', { class: 'onb12-av__shuffle', type: 'button' }, [
      h('i', { class: 'ph-bold ph-shuffle' }),
      h('span', { text: 'Surprise me' })
    ]);
    shuffle.addEventListener('click', function () {
      ['skin', 'top', 'hairColor', 'eyes', 'mouth', 'clothesColor'].forEach(function (cat) {
        if (!A.CAT[cat]) return;
        var opts = freeOpts(cat);
        if (opts.length) params[cat] = opts[Math.floor(Math.random() * opts.length)].id;
      });
      commit(); rerender();
    });

    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'onb12-av__stage' }, [preview, shuffle]),
      row('skin', 'SKIN'),
      row('top', 'HAIR'),
      row('hairColor', 'HAIR COLOR'),
      row('clothesColor', 'JERSEY'),
      h('div', { class: 'onb12-hint',
        text: 'The full wardrobe — headbands, dreads, jerseys, gold chains — unlocks in the shop with the coins you earn.' })
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

      var guide = guideRow(step);
      if (guide) host.appendChild(guide);

      var body;
      switch (step) {
        case 'welcome': body = stepWelcome(); break;
        case 'identity': body = stepIdentity(s, paint); break;
        case 'avatar': body = stepAvatar(s, paint); break;
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

      function canNext() {
        if (step === 'identity') return !!(s.name && s.name.trim());
        if (step === 'position') return !!s.position;
        if (step === 'style') return !!s.playStyle;
        if (step === 'focus') return s.focus.length > 0;
        return true;
      }

      var nextLabel = step === 'report' ? 'Step into the gym'
        : step === 'goals' ? 'Build my plan'
        : step === 'welcome' ? 'Let’s go' : 'Continue';

      var foot = h('div', { class: 'onb12-foot' });
      foot.appendChild(h('button', {
        class: 'd-btn d-btn--ghost onb12-back', type: 'button',
        onclick: function () {
          if (s.i === 0) { ctx.go('home'); return; }
          s.i = Math.max(0, s.i - (STEPS[s.i - 1] === 'processing' ? 2 : 1));
          paint();
        }
      }, [h('span', { text: s.i === 0 ? 'Cancel' : 'Back' })]));
      var nextBtn = V12.btn({
        label: nextLabel, icon: step === 'report' ? 'ph-arrow-right' : 'ph-caret-right',
        onClick: function () {
          if (!canNext()) return;
          if (step === 'report') { persist(s); window._v12Onb = null; ctx.go('coach'); return; }
          s.i++;
          paint();
        }
      });
      foot.appendChild(nextBtn);
      function syncNext() {
        if (canNext()) nextBtn.removeAttribute('disabled');
        else nextBtn.setAttribute('disabled', 'true');
      }
      syncNext();
      // Typing doesn't repaint the screen — keep the button live anyway.
      scroll.addEventListener('input', syncNext);
      host.appendChild(foot);
    }

    paint();
  }

  window.app.register('onboarding', render);
})();
