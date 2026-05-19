/* CourtIQ UI v2 — Onboarding screen (7-step Combine intake)
 *
 * Full port of design-export-v2/onboarding-steps.jsx + onboarding-app.jsx.
 * 7-step wizard: Identity, Position, Play Style, Self-Scout, Goals,
 * Loading, and Scouting Report.
 *
 * On finish, persists via DataService and (when present) Supabase auth
 * profile, then transitions to Home.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.SHELL_ACTIVE) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[onboarding-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var TOTAL_STEPS = 7;

  /* ── Data ────────────────────────────────────────────────── */
  var POSITIONS = [
    { id: 'PG', name: 'Point Guard',    short: 'PG', desc: 'Floor general — runs the offense, sets the tempo.',      traits: ['VISION', 'HANDLE', 'PACE'] },
    { id: 'SG', name: 'Shooting Guard', short: 'SG', desc: 'Three-level scorer — pull-ups, catch-and-shoot, drives.', traits: ['SHOOTING', 'MOVEMENT', 'FINISHING'] },
    { id: 'SF', name: 'Small Forward',  short: 'SF', desc: 'Two-way wing — switchable defender, slasher, glue.',       traits: ['VERSATILE', 'WING-D', 'CUTS'] },
    { id: 'PF', name: 'Power Forward',  short: 'PF', desc: 'Stretch four — face-up game, board crashes, screens.',     traits: ['STRETCH', 'REBOUND', 'POSTS'] },
    { id: 'C',  name: 'Center',         short: 'C',  desc: 'Anchor — rim protection, rebounds, vertical spacing.',      traits: ['RIM', 'GLASS', 'ROLL'] }
  ];

  var QUIZ = [
    { id: 'tempo',   q: 'When the play breaks down, you...',     options: [{ id: 'create', label: 'Create off the dribble' }, { id: 'shoot', label: 'Pull up from where I am' }, { id: 'kick', label: 'Find the open shooter' }, { id: 'attack', label: 'Get to the rim' }] },
    { id: 'scoring', q: 'How do you score most?',                options: [{ id: 'drive', label: 'Drive to the basket' }, { id: 'mid', label: 'Mid-range pull-ups' }, { id: 'three', label: 'Three-point shooting' }, { id: 'post', label: 'Post up' }] },
    { id: 'favmove', q: 'Your money move?',                      options: [{ id: 'step', label: 'Step-back three' }, { id: 'euro', label: 'Euro to the rack' }, { id: 'post', label: 'Turnaround in the post' }, { id: 'catch', label: 'Catch-and-shoot corner 3' }] },
    { id: 'defense', q: "What's your defensive style?",          options: [{ id: 'lock', label: 'On-ball pressure' }, { id: 'help', label: 'Help defense' }, { id: 'block', label: 'Shot blocker' }, { id: 'steal', label: 'Steal hunter' }] }
  ];

  var SKILLS = [
    { id: 'shoot',  name: 'Shooting',      hint: 'Form, range, off-the-dribble' },
    { id: 'handle', name: 'Ball Handling',  hint: 'Control, change of pace' },
    { id: 'pass',   name: 'Passing',        hint: 'Vision, kickouts, lobs' },
    { id: 'def',    name: 'Defense',         hint: 'On-ball, off-ball, IQ' },
    { id: 'ath',    name: 'Athleticism',     hint: 'First-step, vertical' },
    { id: 'iq',     name: 'Basketball IQ',   hint: 'Read the game, decisions' }
  ];

  var GOALS = [
    { id: 'three',  label: 'Improve my 3-pointer' },
    { id: 'handle', label: 'Better handles' },
    { id: 'lock',   label: 'Lock down defense' },
    { id: 'ath',    label: 'Get more athletic' },
    { id: 'iq',     label: 'Read the game better' },
    { id: 'pickup', label: 'Win more pickup games' }
  ];

  var LOADING_STEPS = [
    { t: 0,    label: 'INITIALIZING',     msg: 'Pulling your profile...' },
    { t: 1000, label: 'CROSS-REFERENCING', msg: 'Comparing with 540 elite players...' },
    { t: 2200, label: 'RANKING',           msg: 'Charting strengths and gaps...' },
    { t: 3400, label: 'FINALIZING',        msg: 'Generating your scouting report...' },
    { t: 4600, label: 'READY',             msg: 'Report unlocked.' }
  ];

  var REPORT = {
    grade: 'A-', gradePct: 88,
    archetype: 'TWO-WAY COMBO',
    headline: 'Score-first DNA with underrated defensive feel.',
    strengths: [
      { label: 'Pull-up shooting', note: 'Top 12% — comfortable off the dribble', score: 88 },
      { label: 'Lateral defense',  note: 'Lock-up potential vs. perimeter scorers', score: 82 },
      { label: 'Decision making',  note: 'High AST/TO — you don\'t force it', score: 79 }
    ],
    gaps: [
      { label: 'Off-ball movement',        note: 'Too ball-dominant on broken sets', score: 48 },
      { label: 'Finishing through contact', note: 'And-1 conversion below ceiling',  score: 54 },
      { label: 'Conditioning',              note: '4th-quarter dropoff in pace',      score: 58 }
    ],
    plan: [
      { title: 'Catch-and-Shoot Mastery', sub: '8 weeks · 3 sessions / week', why: 'Builds the off-ball threat your pull-up game lacks.' },
      { title: 'Contact Finishing',        sub: '6 weeks · 2 sessions / week', why: 'Drill euro-steps + pump fakes to convert through bumps.' },
      { title: 'Conditioning Block',       sub: 'Ongoing · 20 min daily',      why: 'Sustain pace and decision-making into the 4th quarter.' }
    ],
    nbaComp: {
      name: 'Devin Booker', role: 'Combo Guard · PHX',
      why: 'Three-level scoring frame, footwork into pull-ups, and underrated wing defense.',
      reasons: ['Three-level scoring frame', 'Footwork into pull-ups', 'Underrated defender on the wing']
    }
  };

  var STEP_NAMES = ['Identity', 'Position', 'Play Style', 'Self-Scout', 'Goals', 'Loading', 'Report'];

  /* ── State ────────────────────────────────────────────────── */
  var state = {
    stepIdx: 0,
    profile: {
      name: '', age: 22, heightFt: 6, heightIn: 2, weightLb: 185, hand: 'R',
      position: '', quiz: {}, skills: { shoot: 65, handle: 55, pass: 60, def: 60, ath: 50, iq: 65 },
      goals: []
    },
    loadingTimers: [],
    loadingStep: 0
  };
  var hostRef = null;

  /* ── SVG icon helpers ────────────────────────────────────── */
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    if (attrs) for (var k in attrs) { if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]); }
    return n;
  }
  function iconChevL() {
    var s = svgEl('svg', { viewBox: '0 0 18 18', fill: 'none', width: '18', height: '18' });
    s.appendChild(svgEl('path', { d: 'M11 4L6 9l5 5', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return s;
  }
  function iconCheck() {
    var s = svgEl('svg', { viewBox: '0 0 14 14', fill: 'none', width: '14', height: '14' });
    s.appendChild(svgEl('path', { d: 'M2.5 7.5l3.5 3.5L11.5 4', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return s;
  }
  function iconArrow() {
    var s = svgEl('svg', { viewBox: '0 0 16 16', fill: 'none', width: '16', height: '16' });
    s.appendChild(svgEl('path', { d: 'M2 8h12M9 3l5 5-5 5', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return s;
  }
  function iconMinus() {
    var s = svgEl('svg', { viewBox: '0 0 20 20', fill: 'none', width: '20', height: '20' });
    s.appendChild(svgEl('path', { d: 'M5 10h10', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round' }));
    return s;
  }
  function iconPlus() {
    var s = svgEl('svg', { viewBox: '0 0 20 20', fill: 'none', width: '20', height: '20' });
    s.appendChild(svgEl('path', { d: 'M10 5v10M5 10h10', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round' }));
    return s;
  }

  /* ── Utility ─────────────────────────────────────────────── */
  function heightCm(ft, inc) { return Math.round((ft * 12 + inc) * 2.54); }
  function weightKg(lb) { return Math.round(lb * 0.4536); }

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  /* ── Stepper control builder ─────────────────────────────── */
  function stepperCtl(label, value, suffix, onMinus, onPlus, small) {
    var cls = small ? 'ob-step-ctl ob-step-ctl--sm' : 'ob-step-ctl';
    var minusBtn = h('button', { class: 'ob-step-ctl__btn', onclick: onMinus });
    minusBtn.appendChild(iconMinus());
    var plusBtn = h('button', { class: 'ob-step-ctl__btn', onclick: onPlus });
    plusBtn.appendChild(iconPlus());
    var valDiv = h('div', { class: 'ob-step-ctl__val' }, [
      h('div', { class: 'ob-step-ctl__val-num' }, [
        document.createTextNode(String(value)),
        suffix ? (function () { var sp = h('span', { class: 'ob-step-ctl__val-unit', text: suffix }); return sp; })() : null
      ].filter(Boolean)),
      label ? h('div', { class: 'ob-step-ctl__val-sub', text: label }) : null
    ].filter(Boolean));
    return h('div', { class: cls }, [minusBtn, valDiv, plusBtn]);
  }

  /* ── Progress bar (top) ──────────────────────────────────── */
  function buildTopBar() {
    var backBtn = h('button', {
      class: 'ob-top__btn',
      onclick: function () { if (state.stepIdx > 0 && state.stepIdx < 5 && state.stepIdx !== 6) { state.stepIdx--; paint(); } },
      disabled: state.stepIdx === 0 || state.stepIdx >= 5
    });
    backBtn.setAttribute('aria-label', 'Back');
    backBtn.appendChild(iconChevL());

    var prog = h('div', { class: 'ob-prog' });
    for (var i = 0; i < TOTAL_STEPS; i++) {
      var cls = (i + 1) < (state.stepIdx + 1) ? 'ob-prog__seg is-done'
              : (i + 1) === (state.stepIdx + 1) ? 'ob-prog__seg is-active'
              : 'ob-prog__seg';
      prog.appendChild(h('div', { class: cls }));
    }

    var skipBtn = h('button', {
      class: 'ob-top__skip',
      onclick: function () { if (canAdvance()) advance(); },
      disabled: state.stepIdx >= 5 || state.stepIdx === 0
    }, ['Skip']);

    var count = h('div', { class: 'ob-prog__count', text: String(state.stepIdx + 1).padStart(2, '0') + ' / ' + String(TOTAL_STEPS).padStart(2, '0') });

    return h('div', { class: 'ob-top' }, [backBtn, prog, skipBtn, count]);
  }

  /* ── Step 1: Identity ─────────────────────────────────────── */
  function buildStepBasic() {
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'ob-field__input';
    nameInput.placeholder = 'Your name';
    nameInput.value = state.profile.name;
    nameInput.addEventListener('input', function () { state.profile.name = nameInput.value; });

    var ageField = h('div', { class: 'ob-glass ob-field ob-anim d-3' }, [
      h('div', { class: 'ob-field__lbl' }, [document.createTextNode('Age '), h('em', { text: '*' })]),
      stepperCtl('Years', state.profile.age, '', function () { state.profile.age = clamp(state.profile.age - 1, 13, 60); paint(); }, function () { state.profile.age = clamp(state.profile.age + 1, 13, 60); paint(); })
    ]);

    var heightField = h('div', { class: 'ob-glass ob-field ob-anim d-4' }, [
      h('div', { class: 'ob-field__lbl' }, [document.createTextNode('Height '), h('em', { text: '*' })]),
      h('div', { class: 'ob-dual' }, [
        h('div', { class: 'ob-dual__col' }, [
          stepperCtl('Feet', state.profile.heightFt, "'",
            function () { state.profile.heightFt = clamp(state.profile.heightFt - 1, 4, 7); paint(); },
            function () { state.profile.heightFt = clamp(state.profile.heightFt + 1, 4, 7); paint(); }, true)
        ]),
        h('div', { class: 'ob-dual__col' }, [
          stepperCtl('Inches', state.profile.heightIn, '"',
            function () {
              var inc = state.profile.heightIn - 1;
              if (inc < 0) { inc = 11; state.profile.heightFt = clamp(state.profile.heightFt - 1, 4, 7); }
              state.profile.heightIn = inc; paint();
            },
            function () {
              var inc = state.profile.heightIn + 1;
              if (inc > 11) { inc = 0; state.profile.heightFt = clamp(state.profile.heightFt + 1, 4, 7); }
              state.profile.heightIn = inc; paint();
            }, true)
        ])
      ]),
      h('div', { class: 'ob-conv', text: heightCm(state.profile.heightFt, state.profile.heightIn) + ' cm' })
    ]);

    var weightField = h('div', { class: 'ob-glass ob-field ob-anim d-5' }, [
      h('div', { class: 'ob-field__lbl' }, [document.createTextNode('Weight '), h('em', { text: '*' })]),
      stepperCtl('Pounds', state.profile.weightLb, ' lb',
        function () { state.profile.weightLb = clamp(state.profile.weightLb - 1, 80, 400); paint(); },
        function () { state.profile.weightLb = clamp(state.profile.weightLb + 1, 80, 400); paint(); }),
      h('div', { class: 'ob-conv', text: weightKg(state.profile.weightLb) + ' kg' })
    ]);

    // Hand toggle
    var handField = h('div', { class: 'ob-glass ob-field ob-anim d-6' }, [
      h('div', { class: 'ob-field__lbl', text: 'Dominant Hand' }),
      h('div', { class: 'ob-hand' }, [
        h('button', {
          class: 'ob-hand__opt' + (state.profile.hand === 'L' ? ' is-active' : ''),
          onclick: function () { state.profile.hand = 'L'; paint(); }
        }, [h('span', { class: 'ob-hand__big', text: 'L' }), h('span', { class: 'ob-hand__lbl', text: 'Left' })]),
        h('button', {
          class: 'ob-hand__opt' + (state.profile.hand === 'R' ? ' is-active' : ''),
          onclick: function () { state.profile.hand = 'R'; paint(); }
        }, [h('span', { class: 'ob-hand__big', text: 'R' }), h('span', { class: 'ob-hand__lbl', text: 'Right' })])
      ])
    ]);

    return h('div', { class: 'ob-step' }, [
      h('div', { class: 'ob-eyebrow ob-anim d-0', text: 'Step 1 of 7 · Identity' }),
      (function () {
        var t = h('h1', { class: 'ob-title ob-anim d-0' });
        t.innerHTML = "Let's start with <em>the basics.</em>";
        return t;
      })(),
      h('p', { class: 'ob-sub ob-anim d-1', text: 'A few details so the Combine can frame your data correctly.' }),
      h('div', { class: 'ob-scroll' }, [
        h('div', { class: 'ob-glass ob-field ob-anim d-2' }, [
          h('div', { class: 'ob-field__lbl' }, [document.createTextNode('Name '), h('em', { text: '*' })]),
          nameInput
        ]),
        ageField,
        heightField,
        weightField,
        handField
      ])
    ]);
  }

  /* ── Step 2: Position ─────────────────────────────────────── */
  function buildStepPosition() {
    var scroll = h('div', { class: 'ob-scroll' });
    POSITIONS.forEach(function (p, i) {
      var active = state.profile.position === p.id;
      var btn = h('button', {
        class: 'ob-glass ob-pos ob-tap ob-anim d-' + (2 + i) + (active ? ' is-active' : ''),
        onclick: function () { state.profile.position = p.id; paint(); }
      }, [
        h('div', { class: 'ob-pos__abbr', text: p.short }),
        h('div', { class: 'ob-pos__body' }, [
          h('div', { class: 'ob-pos__name', text: p.name }),
          h('div', { class: 'ob-pos__desc', text: p.desc }),
          h('div', { class: 'ob-pos__traits' }, p.traits.map(function (t) {
            return h('span', { class: 'ob-pos__trait', text: t });
          }))
        ]),
        (function () { var c = h('div', { class: 'ob-pos__check' }); c.appendChild(iconCheck()); return c; })()
      ]);
      scroll.appendChild(btn);
    });

    return h('div', { class: 'ob-step' }, [
      h('div', { class: 'ob-eyebrow ob-anim d-0', text: 'Step 2 of 7 · Position' }),
      (function () { var t = h('h1', { class: 'ob-title ob-anim d-0' }); t.innerHTML = 'Where do you <em>play?</em>'; return t; })(),
      h('p', { class: 'ob-sub ob-anim d-1', text: "Pick the spot you fill most often. We'll calibrate drills to match." }),
      scroll
    ]);
  }

  /* ── Step 3: Play-Style Quiz ──────────────────────────────── */
  function buildStepQuiz() {
    var scroll = h('div', { class: 'ob-scroll' });
    QUIZ.forEach(function (q, qi) {
      var card = h('div', { class: 'ob-glass ob-quiz ob-anim d-' + (2 + qi) }, [
        h('div', { class: 'ob-quiz__num', text: 'Q' + (qi + 1) }),
        h('div', { class: 'ob-quiz__q', text: q.q }),
        h('div', { class: 'ob-quiz__opts' }, q.options.map(function (o) {
          var active = state.profile.quiz[q.id] === o.id;
          return h('button', {
            class: 'ob-quiz__opt ob-tap' + (active ? ' is-active' : ''),
            onclick: function () { state.profile.quiz[q.id] = o.id; paint(); }
          }, [h('div', { class: 'ob-quiz__radio' }), h('div', { text: o.label })]);
        }))
      ]);
      scroll.appendChild(card);
    });

    return h('div', { class: 'ob-step' }, [
      h('div', { class: 'ob-eyebrow ob-anim d-0', text: 'Step 3 of 7 · Play Style' }),
      (function () { var t = h('h1', { class: 'ob-title ob-anim d-0' }); t.innerHTML = 'How do you <em>play the game?</em>'; return t; })(),
      h('p', { class: 'ob-sub ob-anim d-1', text: 'Four quick gut-checks. There are no wrong answers.' }),
      scroll
    ]);
  }

  /* ── Step 4: Self-Scout (Skills Radar) ────────────────────── */
  function buildStepRadar() {
    var skills = state.profile.skills;
    var skillArr = SKILLS.map(function (s) { return { id: s.id, name: s.name, hint: s.hint, val: skills[s.id] || 0 }; });
    var overall = Math.round(skillArr.reduce(function (a, b) { return a + b.val; }, 0) / skillArr.length);

    // Build radar SVG
    var radarSvg = svgEl('svg', { viewBox: '0 0 280 280', class: 'ob-radar-svg' });
    // Grid rings
    [0.25, 0.5, 0.75, 1].forEach(function (t) {
      var pts = skillArr.map(function (_, i) {
        var a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
        var r = 280 * 0.36 * t;
        return (140 + Math.cos(a) * r) + ',' + (140 + Math.sin(a) * r);
      }).join(' ');
      radarSvg.appendChild(svgEl('polygon', { points: pts, fill: 'none', stroke: 'rgba(255,255,255,0.10)', 'stroke-width': '1' }));
    });
    // Axes
    skillArr.forEach(function (_, i) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
      var r = 280 * 0.36;
      radarSvg.appendChild(svgEl('line', { x1: '140', y1: '140', x2: String(140 + Math.cos(a) * r), y2: String(140 + Math.sin(a) * r), stroke: 'rgba(255,255,255,0.06)' }));
    });
    // Shape
    var shapePts = skillArr.map(function (s, i) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
      var r = 280 * 0.36 * (s.val / 100);
      return (140 + Math.cos(a) * r) + ',' + (140 + Math.sin(a) * r);
    }).join(' ');
    var shape = svgEl('polygon', { points: shapePts, fill: 'rgba(45,212,191,0.20)', stroke: '#2dd4bf', 'stroke-width': '2' });
    shape.style.filter = 'drop-shadow(0 0 6px rgba(45,212,191,0.5))';
    shape.style.transition = 'all 220ms cubic-bezier(0.2,0.85,0.3,1)';
    radarSvg.appendChild(shape);
    // Vertices
    skillArr.forEach(function (s, i) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
      var r = 280 * 0.36 * (s.val / 100);
      radarSvg.appendChild(svgEl('circle', { cx: String(140 + Math.cos(a) * r), cy: String(140 + Math.sin(a) * r), r: '3', fill: '#2dd4bf' }));
    });
    // Labels
    skillArr.forEach(function (s, i) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
      var r = 280 * 0.36 * 1.22;
      var x = 140 + Math.cos(a) * r;
      var y = 140 + Math.sin(a) * r;
      var anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
      var txt = svgEl('text', { x: String(x), y: String(y), 'text-anchor': anchor, 'dominant-baseline': 'middle' });
      txt.style.fontFamily = '"JetBrains Mono", monospace';
      txt.style.fontSize = '9px';
      txt.style.fontWeight = '700';
      txt.style.letterSpacing = '0.18em';
      txt.style.fill = 'rgba(240,236,228,0.62)';
      txt.style.textTransform = 'uppercase';
      txt.textContent = s.name.toUpperCase();
      radarSvg.appendChild(txt);
    });

    // Skill sliders
    var sliders = h('div', { class: 'ob-glass ob-skills ob-anim d-3' });
    SKILLS.forEach(function (s) {
      var v = skills[s.id] || 0;
      var slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.step = '1';
      slider.className = 'ob-sk__slider';
      slider.value = String(v);
      slider.style.setProperty('--pct', v + '%');
      slider.addEventListener('input', function () {
        state.profile.skills[s.id] = parseInt(slider.value, 10);
        paint();
      });
      sliders.appendChild(h('div', { class: 'ob-sk' }, [
        h('div', { class: 'ob-sk__name', text: s.name }),
        h('div', { class: 'ob-sk__val', text: String(v) }),
        h('div', { class: 'ob-sk__hint', text: s.hint }),
        slider
      ]));
    });

    var radarCard = h('div', { class: 'ob-glass ob-radar-card ob-anim d-2' }, [
      h('div', { class: 'ob-radar-card__lbl', text: 'Self-Rated Overall' }),
      (function () { var o = h('div', { class: 'ob-radar-card__overall' }); o.innerHTML = '<em>' + overall + '</em>'; return o; })()
    ]);
    radarCard.appendChild(radarSvg);

    return h('div', { class: 'ob-step' }, [
      h('div', { class: 'ob-eyebrow ob-anim d-0', text: 'Step 4 of 7 · Self-Scout' }),
      (function () { var t = h('h1', { class: 'ob-title ob-anim d-0' }); t.innerHTML = 'Rate <em>your game.</em>'; return t; })(),
      h('p', { class: 'ob-sub ob-anim d-1', text: 'Be honest — overrating yourself just gets you bad drills.' }),
      h('div', { class: 'ob-scroll' }, [radarCard, sliders])
    ]);
  }

  /* ── Step 5: Goals ────────────────────────────────────────── */
  function buildStepGoals() {
    var MAX_GOALS = 3;
    var selected = state.profile.goals;

    var header = h('div', { class: 'ob-anim d-2', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' } }, [
      h('span', { style: { fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', letterSpacing: '0.20em', color: 'rgba(240,236,228,0.62)', fontWeight: '700', textTransform: 'uppercase' }, text: 'Selected' }),
      h('span', { style: { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', letterSpacing: '0.10em', color: selected.length === MAX_GOALS ? '#2dd4bf' : '#f0ece4', fontWeight: '800' }, text: selected.length + ' / ' + MAX_GOALS })
    ]);

    var grid = h('div', { class: 'ob-goals ob-anim d-3' });
    GOALS.forEach(function (g) {
      var active = selected.indexOf(g.id) !== -1;
      var atMax = !active && selected.length >= MAX_GOALS;
      var btn = h('button', {
        class: 'ob-goal ob-tap' + (active ? ' is-active' : ''),
        disabled: atMax,
        onclick: function () {
          var idx = state.profile.goals.indexOf(g.id);
          if (idx !== -1) {
            state.profile.goals.splice(idx, 1);
          } else if (state.profile.goals.length < MAX_GOALS) {
            state.profile.goals.push(g.id);
          }
          paint();
        }
      }, [
        h('div', { class: 'ob-goal__icon' }),
        h('div', { class: 'ob-goal__lbl', text: g.label }),
        (function () { var c = h('div', { class: 'ob-goal__check' }); c.appendChild(iconCheck()); return c; })()
      ]);
      grid.appendChild(btn);
    });

    return h('div', { class: 'ob-step' }, [
      h('div', { class: 'ob-eyebrow ob-anim d-0', text: 'Step 5 of 7 · Goals' }),
      (function () { var t = h('h1', { class: 'ob-title ob-anim d-0' }); t.innerHTML = "What's <em>the mission?</em>"; return t; })(),
      h('p', { class: 'ob-sub ob-anim d-1', text: 'Pick up to 3 priorities. Your training plan rides on these.' }),
      h('div', { class: 'ob-scroll', style: { paddingTop: '18px' } }, [header, grid])
    ]);
  }

  /* ── Step 6: Loading ──────────────────────────────────────── */
  function buildStepLoading() {
    var current = LOADING_STEPS[state.loadingStep] || LOADING_STEPS[0];

    var bars = h('div', { class: 'ob-load__bars' });
    LOADING_STEPS.forEach(function (_, i) {
      var span = h('span');
      if (i <= state.loadingStep) span.classList.add('is-on');
      bars.appendChild(span);
    });

    // Start loading sequence
    clearLoadingTimers();
    LOADING_STEPS.forEach(function (s, i) {
      state.loadingTimers.push(setTimeout(function () {
        state.loadingStep = i;
        paintLoadingProgress();
      }, s.t));
    });
    // Auto-advance after last step
    state.loadingTimers.push(setTimeout(function () {
      state.stepIdx = 6;
      paint();
    }, LOADING_STEPS[LOADING_STEPS.length - 1].t + 700));

    return h('div', { class: 'ob-step ob-load' }, [
      h('div', { class: 'ob-load__visual' }, [
        h('div', { class: 'ob-load__ring ob-load__ring--1' }),
        h('div', { class: 'ob-load__ring ob-load__ring--2' }),
        h('div', { class: 'ob-load__ring ob-load__ring--3' }),
        h('div', { class: 'ob-load__core' })
      ]),
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' } }, [
        h('div', { class: 'ob-load__lbl', text: current.label }),
        h('div', { class: 'ob-load__msg', text: current.msg }),
        bars
      ])
    ]);
  }

  function clearLoadingTimers() {
    state.loadingTimers.forEach(function (t) { clearTimeout(t); });
    state.loadingTimers = [];
  }

  function paintLoadingProgress() {
    // Update just the loading label/msg/bars without full repaint
    var lblEl = hostRef && hostRef.querySelector('.ob-load__lbl');
    var msgEl = hostRef && hostRef.querySelector('.ob-load__msg');
    var barsEl = hostRef && hostRef.querySelector('.ob-load__bars');
    var current = LOADING_STEPS[state.loadingStep] || LOADING_STEPS[0];
    if (lblEl) lblEl.textContent = current.label;
    if (msgEl) msgEl.textContent = current.msg;
    if (barsEl) {
      var spans = barsEl.querySelectorAll('span');
      for (var i = 0; i < spans.length; i++) {
        if (i <= state.loadingStep) spans[i].classList.add('is-on');
        else spans[i].classList.remove('is-on');
      }
    }
  }

  /* ── Step 7: Scouting Report ──────────────────────────────── */
  function buildStepReport() {
    var r = REPORT;
    var firstName = (state.profile.name || 'Player').split(' ')[0];

    // Hero card
    var heroAvatar = h('div', { class: 'ob-rep-hero__avatar' });
    var avatarSvg = svgEl('svg', { width: '92', height: '92', viewBox: '0 0 92 92' });
    avatarSvg.appendChild(svgEl('circle', { cx: '46', cy: '34', r: '14', fill: 'rgba(255,255,255,0.95)' }));
    avatarSvg.appendChild(svgEl('path', { d: 'M16 86 Q16 58 46 58 Q76 58 76 86 Z', fill: 'rgba(255,255,255,0.95)' }));
    heroAvatar.appendChild(avatarSvg);

    var hero = h('div', { class: 'ob-glass ob-rep-hero ob-anim d-1' }, [
      h('div', { class: 'ob-rep-hero__top' }, [
        heroAvatar,
        h('div', { class: 'ob-rep-hero__r' }, [
          h('div', { class: 'ob-rep-hero__lbl', text: 'Combine Grade' }),
          h('div', { class: 'ob-rep-hero__grade-row' }, [
            h('div', { class: 'ob-rep-hero__grade', text: r.grade }),
            h('div', { class: 'ob-rep-hero__pct', text: r.gradePct + '%' })
          ]),
          h('div', { class: 'ob-rep-hero__arche', text: r.archetype })
        ])
      ]),
      h('div', { class: 'ob-rep-hero__summary', text: '"' + r.headline + '"' })
    ]);

    // Strengths card
    function buildRatingRows(items, colorCls) {
      return h('div', { class: 'ob-rep-rows' }, items.map(function (s) {
        return h('div', { class: 'ob-rep-row ob-rep-row--' + colorCls }, [
          h('span', { class: 'ob-rep-row__dot' }),
          h('div', { class: 'ob-rep-row__body' }, [
            h('div', { class: 'ob-rep-row__head' }, [
              h('div', { class: 'ob-rep-row__title', text: s.label }),
              h('div', { class: 'ob-rep-row__score', text: String(s.score) })
            ]),
            h('div', { class: 'ob-rep-row__bar' }, [
              h('div', { class: 'ob-rep-row__bar-fill', style: { width: s.score + '%' } })
            ]),
            h('div', { class: 'ob-rep-row__note', text: s.note })
          ])
        ]);
      }));
    }

    var strengthsCard = h('div', { class: 'ob-glass ob-rep-card ob-anim d-2' }, [
      h('div', { class: 'ob-rep-card__head ob-rep-card__head--str' }, [
        h('span', { class: 'ob-rep-card__head-dot' }),
        h('span', { class: 'ob-rep-card__head-lbl', text: 'Strengths' }),
        h('span', { class: 'ob-rep-card__head-count', text: String(r.strengths.length) })
      ]),
      buildRatingRows(r.strengths, 'str')
    ]);

    var gapsCard = h('div', { class: 'ob-glass ob-rep-card ob-anim d-3' }, [
      h('div', { class: 'ob-rep-card__head ob-rep-card__head--gap' }, [
        h('span', { class: 'ob-rep-card__head-dot' }),
        h('span', { class: 'ob-rep-card__head-lbl', text: 'Weaknesses' }),
        h('span', { class: 'ob-rep-card__head-count', text: String(r.gaps.length) })
      ]),
      buildRatingRows(r.gaps, 'gap')
    ]);

    // Training plan
    var planCard = h('div', { class: 'ob-glass ob-rep-card ob-anim d-4' }, [
      h('div', { class: 'ob-rep-card__head ob-rep-card__head--plan' }, [
        h('span', { class: 'ob-rep-card__head-dot' }),
        h('span', { class: 'ob-rep-card__head-lbl', text: 'Training Plan' }),
        h('span', { class: 'ob-rep-card__head-count', text: 'PRIORITY ORDER' })
      ]),
      h('div', { class: 'ob-rep-plan' }, r.plan.map(function (p, i) {
        return h('div', { class: 'ob-rep-plan__row' }, [
          h('div', { class: 'ob-rep-plan__num', text: String(i + 1) }),
          h('div', { class: 'ob-rep-plan__body' }, [
            h('div', { class: 'ob-rep-plan__title', text: p.title }),
            h('div', { class: 'ob-rep-plan__sub', text: p.sub }),
            h('div', { class: 'ob-rep-plan__why', text: p.why })
          ])
        ]);
      }))
    ]);

    // NBA Comp
    var compSil = h('div', { class: 'ob-rep-comp-v2__sil' });
    var compSvg = svgEl('svg', { viewBox: '0 0 80 80' });
    var defs = svgEl('defs');
    var grad = svgEl('radialGradient', { id: 'silg2-ob', cx: '50%', cy: '40%' });
    var stop1 = svgEl('stop', { offset: '0%', 'stop-color': '#f5a623', 'stop-opacity': '0.95' });
    var stop2 = svgEl('stop', { offset: '100%', 'stop-color': '#f5a623', 'stop-opacity': '0.10' });
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    compSvg.appendChild(defs);
    compSvg.appendChild(svgEl('rect', { x: '0', y: '0', width: '80', height: '80', fill: 'url(#silg2-ob)' }));
    compSvg.appendChild(svgEl('circle', { cx: '40', cy: '28', r: '10', fill: '#06080c' }));
    compSvg.appendChild(svgEl('path', { d: 'M16 76 Q16 46 40 46 Q64 46 64 76 Z', fill: '#06080c' }));
    compSil.appendChild(compSvg);

    var compCard = h('div', { class: 'ob-glass ob-rep-comp-v2 ob-anim d-5' }, [
      h('div', { class: 'ob-rep-comp-v2__lbl', text: 'You play like' }),
      h('div', { class: 'ob-rep-comp-v2__hero' }, [
        compSil,
        h('div', { class: 'ob-rep-comp-v2__r' }, [
          h('div', { class: 'ob-rep-comp-v2__name', text: r.nbaComp.name }),
          h('div', { class: 'ob-rep-comp-v2__role', text: r.nbaComp.role })
        ])
      ]),
      h('div', { class: 'ob-rep-comp-v2__why', text: r.nbaComp.why }),
      h('div', { class: 'ob-rep-comp-v2__reasons' }, r.nbaComp.reasons.map(function (x, i) {
        return h('div', { class: 'ob-rep-comp-v2__reason' }, [
          h('span', { class: 'ob-rep-comp-v2__reason-num', text: '0' + (i + 1) }),
          h('span', { text: x })
        ]);
      }))
    ]);

    return h('div', { class: 'ob-step' }, [
      h('div', { class: 'ob-eyebrow ob-anim d-0', text: 'Step 7 of 7 · Your Report' }),
      (function () {
        var t = h('h1', { class: 'ob-title ob-anim d-0' });
        t.innerHTML = 'Welcome to <em>the Combine,</em><br/>' + firstName + '.';
        return t;
      })(),
      h('p', { class: 'ob-rep-foot ob-anim d-1', text: 'Generated by Combine AI · Confidence 0.86' }),
      h('div', { class: 'ob-scroll', style: { paddingTop: '14px' } }, [hero, strengthsCard, gapsCard, planCard, compCard])
    ]);
  }

  /* ── Validation ──────────────────────────────────────────── */
  function canAdvance() {
    var step = state.stepIdx;
    if (step === 0) return state.profile.name.trim().length > 0 && state.profile.age >= 13;
    if (step === 1) return !!state.profile.position;
    if (step === 2) return QUIZ.every(function (q) { return !!state.profile.quiz[q.id]; });
    if (step === 3) return true;
    if (step === 4) return state.profile.goals.length >= 1;
    if (step === 5) return false; // Loading auto-advances
    if (step === 6) return true;  // Report — final step
    return false;
  }

  function advance() {
    if (!canAdvance()) return;
    if (state.stepIdx < TOTAL_STEPS - 1) {
      state.stepIdx++;
      paint();
    } else {
      finish();
    }
  }

  /* ── CTA labels ──────────────────────────────────────────── */
  function ctaLabel() {
    var labels = ['CONTINUE', 'LOCK IN POSITION', 'SUBMIT ANSWERS', 'CONFIRM SELF-SCOUT', 'GENERATE MY REPORT', '', 'ENTER THE COMBINE'];
    return labels[state.stepIdx] || 'CONTINUE';
  }

  /* ── Main paint ──────────────────────────────────────────── */
  function paint() {
    if (!hostRef) return;
    DOM.clearChildren(hostRef);

    var stepContent;
    switch (state.stepIdx) {
      case 0: stepContent = buildStepBasic(); break;
      case 1: stepContent = buildStepPosition(); break;
      case 2: stepContent = buildStepQuiz(); break;
      case 3: stepContent = buildStepRadar(); break;
      case 4: stepContent = buildStepGoals(); break;
      case 5:
        state.loadingStep = 0;
        stepContent = buildStepLoading();
        break;
      case 6: stepContent = buildStepReport(); break;
      default: stepContent = buildStepBasic();
    }

    // Footer CTA (hide on loading)
    var footer = null;
    if (state.stepIdx !== 5) {
      var ctaBtn = h('button', {
        class: 'ob-foot__btn',
        disabled: !canAdvance() && state.stepIdx < TOTAL_STEPS - 1,
        onclick: function () {
          if (state.stepIdx === TOTAL_STEPS - 1) { finish(); return; }
          advance();
        }
      }, [document.createTextNode(ctaLabel())]);
      if (state.stepIdx < TOTAL_STEPS - 1) ctaBtn.appendChild(iconArrow());
      // Special styling for last step
      if (state.stepIdx === TOTAL_STEPS - 1) {
        ctaBtn.disabled = false;
        ctaBtn.style.opacity = '1';
        ctaBtn.style.cursor = 'pointer';
      }
      footer = h('div', { class: 'ob-foot' }, [ctaBtn]);
      if (state.stepIdx === 4) {
        footer.appendChild(h('div', { class: 'ob-foot__hint', text: 'Takes about 4 seconds · 540 player comps queried' }));
      }
      if (state.stepIdx === 6) {
        footer.appendChild(h('div', { class: 'ob-foot__hint', text: 'Your report is saved to your profile' }));
      }
    }

    var screen = h('div', { class: 'ob' }, [
      buildTopBar(),
      h('div', { class: 'ob-stage' }, [stepContent]),
      footer
    ].filter(Boolean));

    hostRef.appendChild(screen);
  }

  /* ── Finish ──────────────────────────────────────────────── */
  function finish() {
    clearLoadingTimers();
    // Convert to legacy-compatible profile format
    var p = state.profile;
    var profile = {
      name: p.name,
      age: p.age,
      heightCm: heightCm(p.heightFt, p.heightIn),
      heightFt: p.heightFt,
      heightIn: p.heightIn,
      weightLb: p.weightLb,
      weightKg: weightKg(p.weightLb),
      hand: p.hand,
      position: p.position,
      quiz: p.quiz,
      skills: p.skills,
      goals: p.goals,
      experience: p.quiz.exp || ''
    };
    try {
      if (window.dataService && typeof window.dataService.saveProfile === 'function') {
        window.dataService.saveProfile(profile);
      } else if (window.dataService && typeof window.dataService.setProfile === 'function') {
        window.dataService.setProfile(profile);
      }
    } catch (e) { console.warn('[onboarding-v2] save profile', e); }
    if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('home');
  }

  /* ── Public API ──────────────────────────────────────────── */
  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-onboarding');
    state.stepIdx = 0;
    state.loadingStep = 0;
    clearLoadingTimers();
    paint();
  }

  function cleanup() {
    clearLoadingTimers();
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_OnboardingV2 = { render: render, cleanup: cleanup };
})();
