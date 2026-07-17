/* app-v10/screens/onboarding.js
   ONBOARDING — 7-step combine intake.
   No bottom nav, no header pill — its own focused layout.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;
  var ribbon = window.V10UI.ribbon, cta = window.V10UI.cta;

  var STEP_TITLES = [
    'IDENTITY',
    'POSITION',
    'PLAY STYLE',
    'SELF-SCOUT',
    'GOALS',
    'PROCESSING',
    'SCOUTING REPORT'
  ];

  function ensureState() {
    if (!window._v10Onboarding) {
      window._v10Onboarding = {
        step: 1,
        name: 'ALEX',
        height: 75,        // inches
        weight: 180,
        age: 18,
        hand: 'R',
        position: null,
        playStyle: null,
        skills: { shoot: 6, handle: 5, pass: 5, defend: 5, finish: 6, iq: 6 },
        goals: [],
        host: null,
        ctx: null
      };
    }
    return window._v10Onboarding;
  }

  function stepHeader(state) {
    return h('div', { style: { marginBottom: '14px' } }, [
      h('div', {
        style: {
          fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: '800',
          letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--orange)'
        },
        text: 'STEP ' + state.step + ' OF 7'
      }),
      h('div', {
        style: {
          fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '900',
          color: 'var(--ink)', letterSpacing: '-0.6px', lineHeight: '1',
          textTransform: 'uppercase', marginTop: '4px'
        },
        text: STEP_TITLES[state.step - 1]
      })
    ]);
  }

  function labeledSlider(label, val, min, max, unit, onChange) {
    var valEl = h('span', { class: 'mono', text: val + (unit || '') });
    var input = h('input', {
      type: 'range', min: String(min), max: String(max), value: String(val),
      style: { width: '100%', accentColor: 'var(--orange)' }
    });
    input.addEventListener('input', function () {
      valEl.textContent = input.value + (unit || '');
      if (onChange) onChange(parseInt(input.value, 10));
    });
    return h('div', { style: { marginBottom: '12px' } }, [
      h('div', {
        style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px',
          fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: '800',
          letterSpacing: '0.14em', textTransform: 'uppercase' }
      }, [
        h('span', { text: label }),
        valEl
      ]),
      input
    ]);
  }

  function gridButton(label, active, onClick) {
    return h('button', {
      onclick: onClick,
      style: {
        background: active ? 'var(--d-blue, #1CB0F6)' : 'var(--cream)',
        color: active ? '#FFFFFF' : 'var(--ink)',
        border: '2px solid ' + (active ? 'var(--d-blue, #1CB0F6)' : 'var(--d-line, #E5E8EC)'),
        borderRadius: '14px', padding: '14px 8px',
        boxShadow: active ? '0 3px 0 var(--d-blue-deep, #1899D6)' : '0 3px 0 var(--d-line, #E5E8EC)',
        fontFamily: "'Lexend', sans-serif", fontSize: '14px', fontWeight: '800',
        letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer'
      },
      text: label
    });
  }

  function renderStep1(state) {
    return h('div', null, [
      h('label', {
        style: { display: 'block', fontFamily: 'var(--font-display)', fontSize: '11px',
          fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' },
        text: 'NAME'
      }),
      h('input', {
        type: 'text', value: state.name,
        style: { width: '100%', padding: '10px', border: '1.5px solid var(--ink)',
          background: 'var(--cream)', fontFamily: 'var(--font-display)', fontSize: '18px',
          fontWeight: '700', textTransform: 'uppercase', marginBottom: '16px' },
        oninput: function (e) { state.name = e.target.value.toUpperCase(); }
      }),
      labeledSlider('HEIGHT', state.height, 60, 90, '"', function (v) { state.height = v; }),
      labeledSlider('WEIGHT', state.weight, 100, 320, ' LB', function (v) { state.weight = v; }),
      labeledSlider('AGE', state.age, 10, 50, ' YR', function (v) { state.age = v; }),
      h('div', { style: { display: 'flex', gap: '6px', marginTop: '8px' } }, ['L', 'R'].map(function (hand) {
        return gridButton(hand + '-HAND', state.hand === hand, function () {
          state.hand = hand; renderCurrent();
        });
      }))
    ]);
  }

  function renderStep2(state) {
    var positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    return h('div', null, [
      h('p', { class: 'body-italic', style: { marginBottom: '14px', color: 'var(--muted)' },
        text: 'Pick the position you play most often.' }),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' } },
        positions.map(function (p) {
          return gridButton(p, state.position === p, function () {
            state.position = p; renderCurrent();
          });
        }))
    ]);
  }

  function renderStep3(state) {
    var styles = [
      { id: 'sniper', name: 'SNIPER', sub: 'Lives behind the arc.' },
      { id: 'slasher', name: 'SLASHER', sub: 'Attacks the rim relentlessly.' },
      { id: 'floor-general', name: 'FLOOR GENERAL', sub: 'Sees the play before it happens.' },
      { id: 'lockdown', name: 'LOCKDOWN', sub: 'Defense wins games.' }
    ];
    return h('div', null, styles.map(function (s) {
      var active = state.playStyle === s.id;
      return h('div', {
        onclick: function () { state.playStyle = s.id; renderCurrent(); },
        style: {
          background: active ? 'var(--ink)' : 'var(--cream)',
          color: active ? 'var(--cream)' : 'var(--ink)',
          border: '1.5px solid var(--ink)', padding: '12px',
          marginBottom: '6px', cursor: 'pointer',
          boxShadow: active ? '3px 3px 0 var(--orange)' : 'none'
        }
      }, [
        h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '18px',
          fontWeight: '900', letterSpacing: '-0.3px', textTransform: 'uppercase' },
          text: s.name }),
        h('div', { style: { fontFamily: 'var(--font-body)', fontStyle: 'italic',
          fontSize: '12px', marginTop: '2px', opacity: '0.85' }, text: s.sub })
      ]);
    }));
  }

  function renderStep4(state) {
    var skills = [
      { key: 'shoot', label: 'SHOOTING' },
      { key: 'handle', label: 'BALL HANDLE' },
      { key: 'pass', label: 'PASSING' },
      { key: 'defend', label: 'DEFENSE' },
      { key: 'finish', label: 'FINISHING' },
      { key: 'iq', label: 'COURT IQ' }
    ];
    return h('div', null, [
      h('p', { class: 'body-italic', style: { marginBottom: '14px', color: 'var(--muted)' },
        text: 'Rate yourself honestly — 0 (rough) to 10 (elite).' })
    ].concat(skills.map(function (s) {
      return labeledSlider(s.label, state.skills[s.key], 0, 10, '/10', function (v) { state.skills[s.key] = v; });
    })));
  }

  function renderStep5(state) {
    var goals = ['MAKE VARSITY', 'WIN STARTING JOB', 'COLLEGE LOOKS', 'NBA DRAFT', 'STAY HEALTHY', 'BEAT MY BROTHER', 'TOURNAMENT MVP', 'JUST LOVE THE GAME'];
    return h('div', null, [
      h('p', { class: 'body-italic', style: { marginBottom: '14px', color: 'var(--muted)' },
        text: 'Pick all that apply. We tune your plan around these.' }),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }, goals.map(function (g) {
        var active = state.goals.indexOf(g) >= 0;
        return h('button', {
          onclick: function () {
            var i = state.goals.indexOf(g);
            if (i >= 0) state.goals.splice(i, 1); else state.goals.push(g);
            renderCurrent();
          },
          style: {
            background: active ? 'var(--orange)' : 'var(--cream)',
            color: active ? 'var(--cream)' : 'var(--ink)',
            border: '1.5px solid var(--ink)', padding: '8px 12px',
            fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: '800',
            letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer'
          },
          text: g
        });
      }))
    ]);
  }

  function renderStep6(state) {
    var loadingSteps = [
      'ANALYZING MEASURABLES',
      'CROSS-REFERENCING STYLE',
      'BUILDING ARCHETYPE',
      'COMPILING REPORT'
    ];
    var idx = 0;
    var list = h('div', null, loadingSteps.map(function (s, i) {
      return h('div', {
        'data-step': String(i),
        style: {
          fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '800',
          letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 0',
          borderBottom: '1px dashed var(--ink)', color: 'var(--muted)',
          display: 'flex', alignItems: 'center', gap: '10px'
        }
      }, [
        h('i', { 'data-mark': String(i), class: 'ph-bold ph-circle', style: { fontSize: '14px' } }),
        h('span', { text: s })
      ]);
    }));
    var dots = h('div', {
      style: { fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '900',
        color: 'var(--orange)', textAlign: 'center', margin: '20px 0', letterSpacing: '0.5em' },
      text: '...'
    });
    var wrap = h('div', null, [
      ribbon({ title: 'BUILDING REPORT', icon: 'ph-cpu', meta: 'LIVE' }),
      dots,
      list
    ]);
    var dotCount = 0;
    var dotTimer = setInterval(function () {
      dotCount = (dotCount + 1) % 4;
      dots.textContent = '.'.repeat(dotCount || 1) + ' '.repeat(3 - (dotCount || 1));
    }, 300);
    var stepTimer = setInterval(function () {
      if (idx >= loadingSteps.length) {
        clearInterval(stepTimer); clearInterval(dotTimer);
        setTimeout(function () { ensureState().step = 7; renderCurrent(); }, 400);
        return;
      }
      var row = list.querySelector('[data-step="' + idx + '"]');
      var mark = list.querySelector('[data-mark="' + idx + '"]');
      if (row) row.style.color = 'var(--ink)';
      if (mark) { mark.className = 'ph-bold ph-check'; mark.style.color = 'var(--sage)'; }
      idx++;
    }, 700);
    return wrap;
  }

  function renderStep7(state) {
    /* The grade and the strengths/gaps come from the SELF-SCOUT the user
       just filled in — their own words, reflected back. The old screen
       hardcoded "B+ / Quick release / Left-hand finishing" for everyone,
       which made the whole intake theater. */
    var SKILL_LABELS = {
      shoot: 'Shooting', handle: 'Ball handling', pass: 'Passing',
      defend: 'Defense', finish: 'Finishing', iq: 'Court IQ'
    };
    var entries = Object.keys(state.skills).map(function (k) {
      return { k: k, v: state.skills[k] };
    }).sort(function (a, b) { return b.v - a.v; });
    var avg = entries.reduce(function (n, e) { return n + e.v; }, 0) / entries.length;
    var grade = avg >= 8.5 ? 'A' : avg >= 7.5 ? 'A-' : avg >= 6.5 ? 'B+'
              : avg >= 5.5 ? 'B' : avg >= 4.5 ? 'B-' : avg >= 3.5 ? 'C+' : 'C';
    var strengths = entries.slice(0, 2).map(function (e) {
      return SKILL_LABELS[e.k] + ' (' + e.v + '/10, your call)';
    });
    var gaps = entries.slice(-2).reverse().map(function (e) {
      return SKILL_LABELS[e.k] + ' (' + e.v + '/10 — first thing to train)';
    });
    var archetype = state.playStyle === 'sniper' ? 'PERIMETER SNIPER'
      : state.playStyle === 'slasher' ? 'DOWNHILL SLASHER'
      : state.playStyle === 'floor-general' ? 'FLOOR GENERAL'
      : state.playStyle === 'lockdown' ? 'PERIMETER LOCKDOWN'
      : 'TWO-WAY WING';
    var court = h('div', {
      style: { background: 'var(--d-gold-tint, #FFF6D8)', border: '2px solid #F4E1A0',
        borderRadius: '18px', boxShadow: '0 3px 0 #F4E1A0', padding: '18px', textAlign: 'center' }
    }, [
      h('div', {
        style: { fontFamily: "'Lexend', sans-serif", fontSize: '11px', fontWeight: '700',
          letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--d-gold-deep, #E0A800)' },
        text: 'SELF-SCOUT GRADE'
      }),
      h('div', {
        style: { fontFamily: 'var(--font-display)', fontSize: '72px', fontWeight: '900',
          color: 'var(--ink)', letterSpacing: '-3px', lineHeight: '1' },
        text: grade
      }),
      h('div', {
        style: { fontFamily: "'Lexend', sans-serif", fontSize: '15px', fontWeight: '800',
          color: 'var(--ink)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '6px' },
        text: archetype
      }),
      h('div', {
        style: { fontFamily: "'Lexend', sans-serif", fontSize: '11px', fontWeight: '500',
          color: 'var(--muted)', marginTop: '4px' },
        text: 'From your own ratings — the court gets the final say.'
      })
    ]);

    function card(title, items, accent, ribbonIcon) {
      return h('div', {
        style: {
          background: 'var(--cream)', border: '1.5px solid var(--ink)',
          padding: '10px 12px 12px', marginBottom: '8px',
          boxShadow: accent === 'sage' ? 'var(--sh-sage)' : 'var(--sh-orange-sm)'
        }
      }, [
        ribbon({ title: title, icon: ribbonIcon, meta: items.length + ' / ' + items.length })
      ].concat(items.map(function (t) {
        return h('div', { style: { fontFamily: 'var(--font-body)', fontStyle: 'italic',
          fontSize: '13px', color: 'var(--ink)', padding: '2px 0' }, text: '— ' + t });
      })));
    }

    // Avatar preview from real DiceBear seed (state.name) — persisted on completion.
    var avatarSeed = encodeURIComponent(state.name || 'PROFILE');
    var avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + avatarSeed;
    try {
      var stored = localStorage.getItem('courtiq_avatar_url');
      if (stored) avatarUrl = stored;
    } catch (e) {}
    var avatarStrip = h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '12px',
        background: 'var(--cream)', border: '1.5px solid var(--ink)',
        padding: '10px 12px', marginBottom: '8px', boxShadow: 'var(--sh-ink-sm)' }
    }, [
      h('img', {
        src: avatarUrl, alt: 'avatar',
        style: { width: '52px', height: '52px', border: '1.5px solid var(--ink)',
          background: 'var(--cream)' }
      }),
      h('div', null, [
        h('div', {
          style: { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '900',
            letterSpacing: '-0.3px', textTransform: 'uppercase', color: 'var(--ink)' },
          text: state.name || 'PROFILE'
        }),
        h('div', {
          style: { fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: '800',
            letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '2px' },
          text: (state.position || '—') + ' · ' + state.height + '" · ' + state.hand + '-HAND'
        })
      ])
    ]);

    return h('div', null, [
      court,
      avatarStrip,
      card('STRENGTHS', strengths, 'sage', 'ph-flame'),
      card('GAPS TO CLOSE', gaps, 'orange', 'ph-target')
    ]);
  }

  function renderCurrent() {
    var state = ensureState();
    var host = state.host;
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    host.appendChild(stepHeader(state));

    var content;
    switch (state.step) {
      case 1: content = renderStep1(state); break;
      case 2: content = renderStep2(state); break;
      case 3: content = renderStep3(state); break;
      case 4: content = renderStep4(state); break;
      case 5: content = renderStep5(state); break;
      case 6: content = renderStep6(state); break;
      case 7: content = renderStep7(state); break;
      default: content = h('div', { text: 'Unknown step' });
    }
    host.appendChild(h('div', { style: { marginBottom: '20px' } }, [content]));

    // Bottom buttons (hide on loading step)
    if (state.step === 6) return;

    var backLabel = state.step === 1 ? 'CANCEL' : 'BACK';
    var nextLabel = state.step === 7 ? 'ENTER COURTIQ' : (state.step === 5 ? 'BUILD REPORT' : 'CONTINUE');

    host.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginTop: '8px' } }, [
      cta({
        variant: 'secondary', label: backLabel,
        onClick: function () {
          if (state.step === 1) {
            if (state.ctx) state.ctx.go('home');
          } else {
            state.step--; renderCurrent();
          }
        }
      }),
      cta({
        variant: 'orange', icon: state.step === 7 ? 'ph-arrow-right' : 'ph-caret-right',
        label: nextLabel,
        onClick: function () {
          if (state.step === 7) {
            // Persist a minimal profile so home/me/coach pick it up via localStorage.
            try {
              localStorage.setItem('courtiq_profile_name', state.name || 'PROFILE');
              localStorage.setItem('courtiq_profile_position', state.position || '');
              localStorage.setItem('courtiq_profile_hand', state.hand || 'R');
              localStorage.setItem('courtiq_profile_height', String(state.height));
              localStorage.setItem('courtiq_profile_playstyle', state.playStyle || '');
              localStorage.setItem('courtiq_onboarded', '1');
              if (!localStorage.getItem('courtiq_avatar_url')) {
                localStorage.setItem('courtiq_avatar_url',
                  'https://api.dicebear.com/7.x/avataaars/svg?seed=' +
                  encodeURIComponent(state.name || 'PROFILE'));
              }
            } catch (e) {}
            window._v10Onboarding = null;
            if (state.ctx) state.ctx.go('home');
            return;
          }
          state.step++;
          renderCurrent();
        }
      })
    ]));
  }

  function render(args) {
    var host = args.host;
    var ctx = args.ctx;
    var state = ensureState();
    state.host = host;
    state.ctx = ctx;
    renderCurrent();
  }

  window.app.register('onboarding', render);
})();
