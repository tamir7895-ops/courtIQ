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

  /* ── in-place selection groups ────────────────────────────────
     Toggling a choice used to repaint the whole step: the guide face
     and avatar re-downloaded, the screen visibly "refreshed", and on
     device every tap read as a jump. These groups own their buttons
     and update ONLY themselves — state changes, classes flip, nothing
     else on screen so much as blinks. */
  function pillGroup(cls, items, opts) {
    var wrap = h('div', { class: cls });
    items.forEach(function (it) {
      var b = h('button', { class: 'onb12-pill', type: 'button' }, [
        h('div', { class: 'onb12-pill__l', text: it.label }),
        it.sub ? h('div', { class: 'onb12-pill__s', text: it.sub }) : null
      ].filter(Boolean));
      b.__val = it.value;
      b.addEventListener('click', function () {
        opts.set(it.value);
        refresh();
        if (opts.onChange) opts.onChange(it.value);
      });
      wrap.appendChild(b);
    });
    function refresh() {
      [].forEach.call(wrap.children, function (b) {
        b.classList.toggle('is-active', opts.get() === b.__val);
      });
    }
    refresh();
    return wrap;
  }

  /* multi-select; state(value) returns { on, prefix } so the focus
     step's "1. 2. 3." ranks re-label without a rebuild */
  function chipGroup(items, opts) {
    var wrap = h('div', { class: 'onb12-chips' });
    items.forEach(function (it) {
      var b = h('button', { class: 'onb12-chip', type: 'button', text: it.label });
      b.__val = it.value; b.__base = it.label;
      b.addEventListener('click', function () {
        opts.toggle(it.value);
        refresh();
        if (opts.onChange) opts.onChange();
      });
      wrap.appendChild(b);
    });
    function refresh() {
      [].forEach.call(wrap.children, function (b) {
        var st = opts.state(b.__val);
        b.classList.toggle('is-active', !!st.on);
        var want = (st.prefix || '') + b.__base;
        if (b.textContent !== want) b.textContent = want;
      });
    }
    refresh();
    return wrap;
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
  function stepIdentity(s, dirty) {
    var t = function (k) { return window.V12I18n ? window.V12I18n.t(k) : k; };

    var name = h('input', {
      class: 'onb12-input', type: 'text', maxlength: '20',
      placeholder: 'Your name', value: s.name,
      oninput: function (e) { s.name = e.target.value; dirty(); }
    });

    /* sliders keep their IMPERIAL range (the stored unit) and only the
       label converts — so no precision is lost round-tripping. Each
       registers its readout so the unit toggle can relabel them all
       IN PLACE — flipping units no longer rebuilds the screen. */
    var readouts = [];
    function unitSlider(labelKey, getVal, min, max, fmt, onChange) {
      var out = h('span', { class: 'onb12-slider__v', text: fmt(getVal(), detectUnits()) });
      readouts.push(function () { out.textContent = fmt(getVal(), detectUnits()); });
      var input = h('input', {
        type: 'range', min: String(min), max: String(max), value: String(getVal()),
        class: 'onb12-range'
      });
      input.addEventListener('input', function () {
        var v = parseInt(input.value, 10);
        onChange(v);
        out.textContent = fmt(v, detectUnits());
      });
      return h('div', { class: 'onb12-slider' }, [
        h('div', { class: 'onb12-slider__top' }, [
          h('span', { class: 'd-label', text: t(labelKey) }), out
        ]),
        input
      ]);
    }

    var toggle = pillGroup('onb12-two onb12-units', [
      { label: t('onb.units.imperial'), value: 'imperial' },
      { label: t('onb.units.metric'),   value: 'metric' }
    ], {
      get: detectUnits, set: setUnits,
      onChange: function () { readouts.forEach(function (r) { r(); }); }
    });

    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'd-label', text: 'NAME' }), name,
      toggle,
      unitSlider('onb.height', function () { return s.height; }, 58, 90, fmtHeight,
        function (v) { s.height = v; }),
      unitSlider('onb.weight', function () { return s.weight; }, 80, 320, fmtWeight,
        function (v) { s.weight = v; }),
      slider('Age', s.age, 10, 60, ' yr', function (v) { s.age = v; }),
      h('div', { class: 'd-label', text: 'SHOOTING HAND' }),
      pillGroup('onb12-two', [
        { label: 'Lefty', value: 'L' }, { label: 'Righty', value: 'R' }
      ], {
        get: function () { return s.hand; },
        set: function (v) { s.hand = v; },
        onChange: dirty
      })
    ]);
  }

  /* ── avatar: the file gets a face ────────────────────────────
     A compact version of the customizer, free options only — the
     premium catalog is the shop's job, and a paywall inside the very
     first minute is how you lose someone. Preview re-renders live off
     V12Avatar's own params, so what they build here is exactly what
     the header, gym and leaderboard will show. */
  function stepAvatar(s, dirty) {
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

    /* Every row keeps its own refresher. A tap updates the preview and
       that row's selection ring — the step itself never rebuilds, so
       the face doesn't blink white while it re-downloads (the exact
       flash the flow video caught). */
    var refreshers = [];

    function row(cat, labelText) {
      var c = A.CAT[cat];
      var opts = freeOpts(cat);
      var wrap = h('div', { class: 'onb12-av__opts' + (c.swatch ? ' onb12-av__opts--sw' : '') });
      opts.forEach(function (o) {
        var el;
        if (c.swatch) {
          el = h('button', {
            class: 'onb12-av__sw', type: 'button',
            style: { background: '#' + o.v }, 'aria-label': o.id
          });
        } else {
          el = h('button', { class: 'onb12-chip', type: 'button', text: o.label || o.id });
        }
        el.__opt = o.id;
        el.addEventListener('click', function () {
          params[cat] = o.id;
          commit();
          refresh();
        });
        wrap.appendChild(el);
      });
      function refresh() {
        [].forEach.call(wrap.children, function (el) {
          el.classList.toggle(c.swatch ? 'is-on' : 'is-active', params[cat] === el.__opt);
        });
      }
      refreshers.push(refresh);
      refresh();
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
      commit();
      refreshers.forEach(function (r) { r(); });
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

  function stepPosition(s, dirty) {
    var POS = [
      { value: 'PG', label: 'Point', sub: 'Run the show' },
      { value: 'SG', label: 'Shooting', sub: 'Get buckets' },
      { value: 'SF', label: 'Small F', sub: 'Do it all' },
      { value: 'PF', label: 'Power F', sub: 'Bang inside' },
      { value: 'C',  label: 'Center', sub: 'Own the paint' }
    ];
    return h('div', { class: 'onb12-body' }, [
      pillGroup('onb12-grid3', POS, {
        get: function () { return s.position; },
        set: function (v) { s.position = v; },
        onChange: dirty
      })
    ]);
  }

  function stepStyle(s, dirty) {
    var ST = [
      { value: 'sniper', label: 'Sniper', sub: 'Lives behind the arc' },
      { value: 'slasher', label: 'Slasher', sub: 'Attacks the rim' },
      { value: 'floor-general', label: 'Floor General', sub: 'Sees it first' },
      { value: 'lockdown', label: 'Lockdown', sub: 'Defense wins' }
    ];
    return h('div', { class: 'onb12-body' }, [
      pillGroup('onb12-body onb12-stylelist', ST, {
        get: function () { return s.playStyle; },
        set: function (v) { s.playStyle = v; },
        onChange: dirty
      })
    ]);
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
      pillGroup('onb12-grid4', [15, 30, 45, 60].map(function (m) {
        return { label: m + 'm', value: m };
      }), {
        get: function () { return s.minutes; },
        set: function (v) { s.minutes = v; }
      }),
      h('div', { class: 'onb12-hint', text: 'We size each session to fit — shorter days get tighter blocks.' })
    ]);
  }

  function stepGear(s) {
    var GEAR = [
      { value: 'ball', label: 'Ball' }, { value: 'hoop', label: 'A hoop' },
      { value: 'cones', label: 'Cones' }, { value: 'gym', label: 'Gym access' },
      { value: 'weights', label: 'Weights' }, { value: 'partner', label: 'A partner' }
    ];
    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'onb12-hint', text: 'Pick everything you can get to. Drills that need gear you don’t have get skipped.' }),
      chipGroup(GEAR, {
        toggle: function (id) {
          var i = s.equipment.indexOf(id);
          if (i >= 0) s.equipment.splice(i, 1); else s.equipment.push(id);
        },
        state: function (id) { return { on: s.equipment.indexOf(id) >= 0 }; }
      })
    ]);
  }

  function stepFocus(s, dirty) {
    var FOCUS = [
      { value: 'shooting', label: 'Shooting' }, { value: 'handles', label: 'Ball handling' },
      { value: 'finishing', label: 'Finishing' }, { value: 'defense', label: 'Defense' },
      { value: 'conditioning', label: 'Conditioning' }, { value: 'passing', label: 'Passing' }
    ];
    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'onb12-hint', text: 'Pick up to 3 — your plan leans hardest on these, in order.' }),
      chipGroup(FOCUS, {
        toggle: function (id) {
          var i = s.focus.indexOf(id);
          if (i >= 0) s.focus.splice(i, 1);
          else { if (s.focus.length >= 3) s.focus.shift(); s.focus.push(id); }
        },
        state: function (id) {
          var rank = s.focus.indexOf(id);
          return { on: rank >= 0, prefix: rank >= 0 ? (rank + 1) + '. ' : '' };
        },
        onChange: dirty
      })
    ]);
  }

  function stepGoals(s) {
    var G = ['Make varsity', 'Win a starting job', 'College looks', 'Go pro',
             'Stay healthy', 'Beat my rival', 'Tournament MVP', 'Love the game'];
    return h('div', { class: 'onb12-body' }, [
      h('div', { class: 'onb12-hint', text: 'Pick all that apply — we tune the tone around these.' }),
      chipGroup(G.map(function (g) { return { value: g, label: g }; }), {
        toggle: function (g) {
          var i = s.goals.indexOf(g);
          if (i >= 0) s.goals.splice(i, 1); else s.goals.push(g);
        },
        state: function (g) { return { on: s.goals.indexOf(g) >= 0 }; }
      })
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

    /* The full scouting report: every number on it is something the
       player just told us — nothing invented (M4). Bars make the
       strengths/gaps readable at a glance; the strongest reads green,
       the weakest orange, because that gap is what the program attacks
       first. */
    var topK = entries[0].k, lowK = entries[entries.length - 1].k;
    var skillRows = entries.map(function (e) {
      var cls = 'onb12-skill' +
        (e.k === topK ? ' onb12-skill--top' : e.k === lowK ? ' onb12-skill--low' : '');
      return h('div', { class: cls }, [
        h('div', { class: 'onb12-skill__l', text: SKILL_L[e.k] }),
        h('div', { class: 'onb12-skill__bar' }, [
          h('div', { class: 'onb12-skill__fill', style: { width: (e.v * 10) + '%' } })
        ]),
        h('div', { class: 'onb12-skill__v', text: String(e.v) })
      ]);
    });

    var POS_L = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward',
                  PF: 'Power Forward', C: 'Center' };
    var goalsText = s.goals.length ? s.goals.join(' · ') : '—';

    /* ── the 8-week projection ────────────────────────────────────
       The payoff moment: a curve that RISES as the card lands, sized
       by the schedule they just committed to. Framed as a projection
       of their own plan — "keep this schedule and here's the climb" —
       never as a measurement (M4: measured numbers are real or absent;
       a forecast says it's a forecast). */
    var weeklyMin = s.days * s.minutes;
    var gainPct = Math.max(6, Math.min(25, Math.round(weeklyMin / 20)));
    function sv(tag, attrs) {
      var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      return el;
    }
    var W = 300, H = 110, PAD = 8;
    var pts = [];
    for (var wI = 0; wI <= 8; wI++) {
      var f = wI / 8;
      var ease = 1 - Math.pow(1 - f, 2);          // fast early gains, then grind
      var x = PAD + f * (W - PAD * 2);
      var y = H - PAD - ease * (H - PAD * 2 - 14);
      pts.push([x, y]);
    }
    var lineD = pts.map(function (p, idx) {
      return (idx ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join(' ');
    var areaD = lineD + ' L' + pts[8][0].toFixed(1) + ' ' + (H - PAD) +
                ' L' + pts[0][0].toFixed(1) + ' ' + (H - PAD) + ' Z';

    var chart = sv('svg', { class: 'onb12-proj__svg', viewBox: '0 0 ' + W + ' ' + H });
    chart.appendChild(sv('path', { d: areaD, class: 'onb12-proj__area' }));
    var lineEl = sv('path', { d: lineD, class: 'onb12-proj__line', pathLength: '100' });
    chart.appendChild(lineEl);
    chart.appendChild(sv('circle', {
      cx: pts[8][0], cy: pts[8][1], r: '5', class: 'onb12-proj__dot'
    }));

    var gainEl = h('span', { class: 'onb12-proj__gain', text: '+0%' });
    /* count the headline up as the line draws */
    setTimeout(function () {
      var t0 = Date.now(), DUR = 1400;
      var iv = setInterval(function () {
        if (!gainEl.isConnected) { clearInterval(iv); return; }
        var f2 = Math.min(1, (Date.now() - t0) / DUR);
        var e2 = 1 - Math.pow(1 - f2, 3);
        gainEl.textContent = '+' + Math.round(gainPct * e2) + '%';
        if (f2 >= 1) clearInterval(iv);
      }, 40);
    }, 350);

    var projection = V12.card({ class: 'onb12-proj' }, [
      h('div', { class: 'd-label', text: '8-WEEK PROJECTION' }),
      h('div', { class: 'onb12-proj__head' }, [
        gainEl,
        h('span', { class: 'onb12-proj__lbl',
          text: 'shooting volume growth if you keep ' +
                s.days + ' days · ' + s.minutes + ' min' })
      ]),
      chart,
      h('div', { class: 'onb12-proj__weeks' }, [
        h('span', { text: 'Week 1' }), h('span', { text: 'Week 8' })
      ])
    ]);

    return h('div', { class: 'onb12-body' }, [
      V12.card({ tint: 'gold', class: 'onb12-card' }, [
        h('div', { class: 'd-label', text: 'SELF-SCOUT GRADE' }),
        h('div', { class: 'onb12-grade', text: grade }),
        h('div', { class: 'onb12-arche', text: arche })
      ]),

      projection,

      V12.card({ class: 'onb12-skills' }, [
        h('div', { class: 'd-label', text: 'SCOUTING REPORT' })
      ].concat(skillRows).concat([
        h('div', { class: 'onb12-hint', text:
          'Strongest: ' + SKILL_L[topK] + ' · First to fix: ' + SKILL_L[lowK] +
          '. The court gets the final say — every session updates this file.' })
      ])),

      V12.card({ tint: 'ink', class: 'onb12-plan' }, [
        h('div', { class: 'd-label', text: 'YOUR PROGRAM' }),
        h('div', { class: 'onb12-plan__row' }, [
          h('i', { class: 'ph-fill ph-user' }),
          h('span', { text: (POS_L[s.position] || 'Player') + ' · ' +
            (s.hand === 'L' ? 'Lefty' : 'Righty') })
        ]),
        h('div', { class: 'onb12-plan__row' }, [
          h('i', { class: 'ph-fill ph-calendar-check' }),
          h('span', { text: s.days + ' days a week · ' + s.minutes + ' min a session' })
        ]),
        h('div', { class: 'onb12-plan__row' }, [
          h('i', { class: 'ph-fill ph-target' }),
          h('span', { text: 'Focus: ' + focusText })
        ]),
        h('div', { class: 'onb12-plan__row' }, [
          h('i', { class: 'ph-fill ph-barbell' }),
          h('span', { text: 'Gear: ' + (s.equipment.length ? s.equipment.join(', ') : 'bodyweight only') })
        ]),
        h('div', { class: 'onb12-plan__row' }, [
          h('i', { class: 'ph-fill ph-flag-banner' }),
          h('span', { text: 'Goals: ' + goalsText })
        ])
      ]),

      h('div', { class: 'onb12-report-hint',
        text: 'The staff builds your weekly plan from this file the moment you step into the gym. Change anything later in Training Plan.' })
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

    var lastStep = -1;
    function paint() {
      /* Toggling a chip repaints the screen for state, and the rebuilt
         scroller used to start back at the top — on device every tap
         "jumped", the player tapped again, and the second tap UNDID the
         first. Same-step repaints keep their scroll position; only a
         real step change starts at the top. */
      var prevScroll = 0;
      if (lastStep === s.i) {
        var sc0 = host.querySelector('.onb12-scroll');
        if (sc0) prevScroll = sc0.scrollTop;
      }
      lastStep = s.i;

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

      /* Selection taps update THEMSELVES (pillGroup/chipGroup) and call
         dirty() so the Continue button re-arms — the screen itself is
         only ever rebuilt on a real step change. */
      var syncNextRef = null;
      function dirty() { if (syncNextRef) syncNextRef(); }

      var body;
      switch (step) {
        case 'welcome': body = stepWelcome(); break;
        case 'identity': body = stepIdentity(s, dirty); break;
        case 'avatar': body = stepAvatar(s, dirty); break;
        case 'position': body = stepPosition(s, dirty); break;
        case 'style': body = stepStyle(s, dirty); break;
        case 'scout': body = stepScout(s); break;
        case 'schedule': body = stepSchedule(s); break;
        case 'gear': body = stepGear(s); break;
        case 'focus': body = stepFocus(s, dirty); break;
        case 'goals': body = stepGoals(s); break;
        case 'processing': body = stepProcessing(s, host, paint); break;
        case 'report': body = stepReport(s); break;
      }
      var scroll = h('div', { class: 'onb12-scroll' }, [body]);
      host.appendChild(scroll);
      if (prevScroll) scroll.scrollTop = prevScroll;

      if (step === 'processing') return;  // auto-advances

      function canNext() {
        if (step === 'identity') return !!(s.name && s.name.trim());
        if (step === 'position') return !!s.position;
        if (step === 'style') return !!s.playStyle;
        if (step === 'focus') return s.focus.length > 0;
        return true;
      }

      var nextLabel = step === 'report' ? 'Start training'
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
          /* Done → HOME. The home screen is the hub with NEXT UP and
             the week ahead; the gym is one tap away when they want the
             staff. (Device feedback: finishing should land home.) */
          if (step === 'report') { persist(s); window._v12Onb = null; ctx.go('home'); return; }
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
      syncNextRef = syncNext;   /* selection groups arm the button via dirty() */
      // Typing doesn't repaint the screen — keep the button live anyway.
      scroll.addEventListener('input', syncNext);
      host.appendChild(foot);
    }

    paint();
  }

  window.app.register('onboarding', render);
})();
