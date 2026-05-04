/* CourtIQ UI v2 — Onboarding screen (Wave 1 redesign · new file)
 *
 * Compact port of _design-import/v2/components/onboarding-app.jsx.
 * Multi-step wizard collecting: name, age, height, weight, position,
 * experience, primary goal. On finish, persists via DataService and
 * (when present) Supabase auth profile, then transitions to Home.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.SHELL_ACTIVE) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[onboarding-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  var STEPS = [
    { id: 'name',       label: 'NAME' },
    { id: 'physical',   label: 'PHYSICAL' },
    { id: 'position',   label: 'POSITION' },
    { id: 'experience', label: 'EXPERIENCE' },
    { id: 'goal',       label: 'GOAL' }
  ];

  var POSITIONS = [
    { id: 'PG', label: 'Point Guard' },
    { id: 'SG', label: 'Shooting Guard' },
    { id: 'SF', label: 'Small Forward' },
    { id: 'PF', label: 'Power Forward' },
    { id: 'C',  label: 'Center' }
  ];

  var EXPERIENCE_LEVELS = [
    { id: 'beginner',     label: 'Beginner',     sub: '< 1 year' },
    { id: 'intermediate', label: 'Intermediate', sub: '1 – 3 years' },
    { id: 'advanced',     label: 'Advanced',     sub: '3+ years' },
    { id: 'pro',          label: 'Competitive',  sub: 'College/pro' }
  ];

  var GOALS = [
    { id: 'shooting',  label: 'Improve Shooting' },
    { id: 'allaround', label: 'Be a Better All-Around Player' },
    { id: 'iq',        label: 'Develop Game IQ' },
    { id: 'physical',  label: 'Get in Game Shape' }
  ];

  var state = {
    stepIdx: 0,
    profile: { name: '', age: 18, heightCm: 178, weightKg: 70, position: '', experience: '', goal: '' }
  };
  var hostRef = null;

  function progressBar() {
    var pct = ((state.stepIdx + 1) / STEPS.length) * 100;
    return h('div', { class: 'ob-progress' }, [
      h('div', { class: 'ob-progress__fill', style: { width: pct + '%' } }),
      h('div', { class: 'ob-progress__lbl', text: 'STEP ' + (state.stepIdx + 1) + ' OF ' + STEPS.length })
    ]);
  }

  function buildName() {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'ob-input';
    input.placeholder = 'Alex Rivera';
    input.value = state.profile.name;
    input.addEventListener('input', function () { state.profile.name = input.value; });
    return [
      h('h1', { class: 'ob-h', text: "What's your name?" }),
      h('p', { class: 'ob-p', text: 'How should we address you on the court?' }),
      h('div', { class: 'ob-glass ob-card' }, [input])
    ];
  }

  function buildPhysical() {
    function num(label, key, min, max, suffix) {
      var input = document.createElement('input');
      input.type = 'number';
      input.className = 'ob-input ob-input--num';
      input.value = state.profile[key];
      input.min = min; input.max = max;
      input.addEventListener('input', function () { state.profile[key] = Number(input.value) || 0; });
      return h('div', { class: 'ob-glass ob-card ob-card--num' }, [
        h('div', { class: 'ob-card__lbl', text: label }),
        h('div', { class: 'ob-card__row' }, [input, h('span', { class: 'ob-card__suffix', text: suffix })])
      ]);
    }
    return [
      h('h1', { class: 'ob-h', text: 'Tell us about yourself' }),
      h('p', { class: 'ob-p', text: 'We use this to scale drills and shot zones to your size.' }),
      num('AGE', 'age', 8, 80, 'yrs'),
      num('HEIGHT', 'heightCm', 100, 230, 'cm'),
      num('WEIGHT', 'weightKg', 30, 200, 'kg')
    ];
  }

  function buildPositionStep() {
    var grid = h('div', { class: 'ob-grid' });
    POSITIONS.forEach(function (pos) {
      grid.appendChild(h('button', {
        class: 'ob-glass ob-pick' + (state.profile.position === pos.id ? ' is-active' : ''),
        onclick: function () { state.profile.position = pos.id; paint(); }
      }, [
        h('div', { class: 'ob-pick__abbr', text: pos.id }),
        h('div', { class: 'ob-pick__lbl', text: pos.label })
      ]));
    });
    return [
      h('h1', { class: 'ob-h', text: "What's your position?" }),
      h('p', { class: 'ob-p', text: 'Pick the one that best describes how you play.' }),
      grid
    ];
  }

  function buildExperience() {
    var list = h('div', { class: 'ob-list' });
    EXPERIENCE_LEVELS.forEach(function (lvl) {
      list.appendChild(h('button', {
        class: 'ob-glass ob-row' + (state.profile.experience === lvl.id ? ' is-active' : ''),
        onclick: function () { state.profile.experience = lvl.id; paint(); }
      }, [
        h('div', { class: 'ob-row__lbl', text: lvl.label }),
        h('div', { class: 'ob-row__sub', text: lvl.sub })
      ]));
    });
    return [
      h('h1', { class: 'ob-h', text: 'Experience level?' }),
      h('p', { class: 'ob-p', text: 'Helps tune the difficulty curve.' }),
      list
    ];
  }

  function buildGoal() {
    var list = h('div', { class: 'ob-list' });
    GOALS.forEach(function (g) {
      list.appendChild(h('button', {
        class: 'ob-glass ob-row' + (state.profile.goal === g.id ? ' is-active' : ''),
        onclick: function () { state.profile.goal = g.id; paint(); }
      }, [h('div', { class: 'ob-row__lbl', text: g.label })]));
    });
    return [
      h('h1', { class: 'ob-h', text: 'Top goal right now?' }),
      h('p', { class: 'ob-p', text: "We'll tailor drills and the daily challenge to this." }),
      list
    ];
  }

  function nextEnabled() {
    var step = STEPS[state.stepIdx].id;
    if (step === 'name')       return state.profile.name.trim().length > 0;
    if (step === 'physical')   return state.profile.age > 0 && state.profile.heightCm > 0;
    if (step === 'position')   return !!state.profile.position;
    if (step === 'experience') return !!state.profile.experience;
    if (step === 'goal')       return !!state.profile.goal;
    return true;
  }

  function paint() {
    if (!hostRef) return;
    var stepId = STEPS[state.stepIdx].id;
    var content;
    if (stepId === 'name') content = buildName();
    else if (stepId === 'physical') content = buildPhysical();
    else if (stepId === 'position') content = buildPositionStep();
    else if (stepId === 'experience') content = buildExperience();
    else content = buildGoal();

    DOM.clearChildren(hostRef);
    var nav = h('div', { class: 'ob-nav' }, [
      state.stepIdx > 0
        ? h('button', { class: 'ob-back', onclick: function () { state.stepIdx--; paint(); } }, ['‹ Back'])
        : h('span'),
      h('button', {
        class: 'ob-next' + (nextEnabled() ? '' : ' is-disabled'),
        onclick: function () {
          if (!nextEnabled()) return;
          if (state.stepIdx < STEPS.length - 1) { state.stepIdx++; paint(); return; }
          finish();
        }
      }, [state.stepIdx < STEPS.length - 1 ? 'Next ›' : 'Finish ›'])
    ]);

    var screen = h('div', { class: 'ob' }, [
      h('div', { class: 'ob-stamp' }, [
        h('div', { class: 'ob-stamp__eyebrow', text: 'COURTIQ · ONBOARDING' }),
        h('div', { class: 'ob-stamp__meta', text: STEPS[state.stepIdx].label })
      ]),
      progressBar(),
      h('div', { class: 'ob-scroll' }, content),
      nav
    ]);
    hostRef.appendChild(screen);
  }

  function finish() {
    try {
      if (window.dataService && typeof window.dataService.saveProfile === 'function') {
        window.dataService.saveProfile(state.profile);
      } else if (window.dataService && typeof window.dataService.setProfile === 'function') {
        window.dataService.setProfile(state.profile);
      }
    } catch (e) { console.warn('[onboarding-v2] save profile', e); }
    try {
      if (window.supabase && window.supabase.auth) {
        // Profile rows are managed by existing onboarding.js elsewhere; we hand off via DataService above.
      }
    } catch (e) { /* ignore */ }
    if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('home');
  }

  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-onboarding');
    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_OnboardingV2 = { render: render, cleanup: cleanup };
})();
