/* CourtIQ UI v2 — Coach tab renderer (Wave 8 redesign)
 *
 * Full 3-sub-page Coach tab: Coach (default), Update, History.
 * Ports _design-import/v2/components/coach-screen.jsx.
 * Uses AICoach when available; else fixture data.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.COACH_TAB) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[coach-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  /* ══════════════════════════════════════════════════════
     FIXTURE DATA
     ══════════════════════════════════════════════════════ */
  var INSIGHT = {
    date: 'WEEK OF MAY 4',
    meta: 'Based on 3 sessions this week',
    verdict: 'Your mid-range is on <em>fire</em> — but you\'re hiding from the three.',
    signature: 'C. WHITFIELD · HEAD COACH AI',
    paragraphs: [
      { kind: 'strength', html: 'You\'ve been attacking the rim more this week, and it\'s working — your <strong>FG% jumped to 58%</strong> from 51%, the best stretch you\'ve had this month. The footwork on those drives looks cleaner. Keep going.' },
      { kind: 'work', html: 'But here\'s the thing — you\'re <strong>shooting fewer threes</strong>. Catch-and-shoot percentage dropped <strong>8%</strong> because you\'re hesitating on open looks. I see you pumping when you should be pulling. <em>The shot you don\'t take is always 0%.</em>' },
      { kind: 'work', html: 'Free throws are still inconsistent. <strong>72%</strong> isn\'t where a guard with your touch should live. Five minutes of routine work before every session — that\'s the floor, not the ceiling.' }
    ],
    numbers: [
      { id: 'fg',  lbl: 'FG%',      num: '58', suf: '%', delta: '+7',  dir: 'up'   },
      { id: '3pt', lbl: '3PT%',     num: '31', suf: '%', delta: '-8',  dir: 'down' },
      { id: 'ses', lbl: 'Sessions', num: '3',  suf: '',  delta: '+1',  dir: 'up'   },
      { id: 'str', lbl: 'Streak',   num: '12', suf: 'D', delta: 'PR',  dir: 'up'   }
    ],
    drills: [
      { id: 'spotup', name: 'Catch & Release 5x5', duration: '12 MIN', diff: 2, diffLbl: 'Mid',  why: 'Kill the spot-up hesitation.' },
      { id: 'ft',     name: 'Free Throw Routine',   duration: '8 MIN',  diff: 1, diffLbl: 'Easy', why: 'Get that 72% to 80% by month-end.' },
      { id: 'cnc',    name: 'Closeout 3 Series',    duration: '15 MIN', diff: 3, diffLbl: 'Hard', why: 'Train pulling the trigger under pressure.' }
    ],
    trend: {
      score: 78, delta: '+6', dir: 'up', label: 'TRENDING UP',
      weeks: [
        { lbl: 'W1', val: 64 },
        { lbl: 'W2', val: 69 },
        { lbl: 'W3', val: 72 },
        { lbl: 'W4', val: 78 }
      ]
    }
  };

  var HISTORY = [
    { id: 'w-may-4',  date: 'MAY 4 · WEEK 18', verdict: 'Your mid-range is on fire — but you\'re hiding from the three.', score: 78, body: ['You\'ve been attacking the rim more this week — <strong>FG% jumped to 58%</strong>. But catch-and-shoot dropped 8%. Hesitation is killing you.', 'Recommended: Catch &amp; Release 5x5, Free Throw Routine.'] },
    { id: 'w-apr-27', date: 'APR 27 · WEEK 17', verdict: 'Defense looked sharper. Now make them pay on offense.', score: 72, body: ['Your closeouts were the cleanest they\'ve been all month. Two steals in transition stood out.', 'But your assist-to-turnover dipped to 1.4. Slow down on the pick &amp; roll reads.'] },
    { id: 'w-apr-20', date: 'APR 20 · WEEK 16', verdict: 'You\'re moving better without the ball. Keep cutting.', score: 69, body: ['Three back-cuts for layups in Tuesday\'s session — that\'s the version of you I want.', 'Conditioning on the back end of sessions is fading. Add a 10-minute cardio finisher.'] },
    { id: 'w-apr-13', date: 'APR 13 · WEEK 15', verdict: 'Slow start, strong finish. Don\'t wait until the 4th to wake up.', score: 64, body: ['First half FG% was 38%. Second half: 64%. The version of you in the second half is the floor.', 'Pre-session warm-up needs work — get your 100 shots in before scrimmage.'] }
  ];

  var SKILLS = [
    { id: 'shoot',  lbl: 'Shooting',     val: 7, hintAt: { 1: 'Need work', 5: 'Solid', 8: 'Real strength', 10: 'Elite' } },
    { id: 'handle', lbl: 'Ball Handling', val: 6, hintAt: { 1: 'Need work', 5: 'Solid', 8: 'Real strength', 10: 'Elite' } },
    { id: 'def',    lbl: 'Defense',       val: 5, hintAt: { 1: 'Need work', 5: 'Solid', 8: 'Real strength', 10: 'Elite' } },
    { id: 'athl',   lbl: 'Athleticism',   val: 8, hintAt: { 1: 'Need work', 5: 'Solid', 8: 'Real strength', 10: 'Elite' } }
  ];

  /* ══════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════ */
  var state = {
    tab: 'coach',         // coach | update | history
    openHistId: null,
    sliders: {}
  };
  // init slider values from fixture defaults
  SKILLS.forEach(function (s) { state.sliders[s.id] = s.val; });

  /* ══════════════════════════════════════════════════════
     SVG ICONS
     ══════════════════════════════════════════════════════ */
  function arrowIcon(dir) {
    var d = dir === 'up'   ? 'M12 19V5M5 12l7-7 7 7'
          : dir === 'down' ? 'M12 5v14M5 12l7 7 7-7'
          : 'M5 12h14';
    return svg('svg', { viewBox: '0 0 24 24', width: '14', height: '14',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('path', { d: d })]);
  }
  function smallArrow(dir) {
    var d = dir === 'up'   ? 'M12 19V5M5 12l7-7 7 7'
          : dir === 'down' ? 'M12 5v14M5 12l7 7 7-7'
          : 'M5 12h14';
    return svg('svg', { viewBox: '0 0 24 24', width: '9', height: '9',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('path', { d: d })]);
  }
  function rightArrow() {
    return svg('svg', { viewBox: '0 0 24 24', width: '16', height: '16',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('path', { d: 'M5 12h14M13 5l7 7-7 7' })]);
  }
  function chevRight() {
    return svg('svg', { viewBox: '0 0 24 24', width: '9', height: '9',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('path', { d: 'M9 18l6-6-6-6' })]);
  }
  function clockIcon() {
    return svg('svg', { viewBox: '0 0 24 24', width: '10', height: '10',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('circle', { cx: '12', cy: '12', r: '10' }),
       svg('path', { d: 'M12 6v6l4 2' })]);
  }
  function sparkIcon() {
    return svg('svg', { viewBox: '0 0 24 24', width: '16', height: '16',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('path', { d: 'M12 2L9 12l-7 0 5.5 5L5 22l7-4.5L19 22l-2.5-5L22 12h-7L12 2z' })]);
  }
  function settingsIcon() {
    return svg('svg', { viewBox: '0 0 24 24', width: '18', height: '18',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('circle', { cx: '12', cy: '12', r: '3' }),
       svg('path', { d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' })]);
  }
  function whistleIcon() {
    return svg('svg', { viewBox: '0 0 24 24', width: '30', height: '30',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('circle', { cx: '12', cy: '14', r: '7' }),
       svg('path', { d: 'M12 7V2M9 4h6' })]);
  }

  /* ══════════════════════════════════════════════════════
     DATA HELPERS
     ══════════════════════════════════════════════════════ */
  function loadInsight() {
    var data = JSON.parse(JSON.stringify(INSIGHT));
    try {
      if (window.COACH_INSIGHT) {
        data = JSON.parse(JSON.stringify(window.COACH_INSIGHT));
      }
      if (window.aiCoach && typeof window.aiCoach.getDailyVerdict === 'function') {
        var v = window.aiCoach.getDailyVerdict();
        if (v && v.verdict) data.verdict = v.verdict;
      }
    } catch (e) { /* fixture fallback */ }
    return data;
  }

  function loadHistory() {
    if (window.COACH_HISTORY && window.COACH_HISTORY.length) {
      return JSON.parse(JSON.stringify(window.COACH_HISTORY));
    }
    return JSON.parse(JSON.stringify(HISTORY));
  }

  function loadSkills() {
    if (window.COACH_SKILLS && window.COACH_SKILLS.length) {
      return JSON.parse(JSON.stringify(window.COACH_SKILLS));
    }
    return JSON.parse(JSON.stringify(SKILLS));
  }

  function getHint(skill, val) {
    if (val >= 10) return skill.hintAt[10] || skill.hintAt[8] || '';
    if (val >= 8)  return skill.hintAt[8]  || '';
    if (val >= 5)  return skill.hintAt[5]  || '';
    return skill.hintAt[1] || '';
  }

  /* ══════════════════════════════════════════════════════
     STAMP HEADER
     ══════════════════════════════════════════════════════ */
  function buildStamp() {
    return h('div', { class: 'co-stamp' }, [
      h('div', { class: 'co-stamp__l' }, [
        h('div', null, [
          h('div', { class: 'co-stamp__eyebrow', text: 'COACH · BRIEFING' }),
          h('div', { class: 'co-stamp__meta', text: 'WEEK 18 · MAY 4' })
        ])
      ]),
      h('button', { class: 'co-stamp__icon-btn', 'aria-label': 'Settings' }, [settingsIcon()])
    ]);
  }

  /* ══════════════════════════════════════════════════════
     SUB-NAV
     ══════════════════════════════════════════════════════ */
  function buildSubnav() {
    var tabs = [
      { id: 'coach',   label: 'Coach'   },
      { id: 'update',  label: 'Update'  },
      { id: 'history', label: 'History' }
    ];
    var nav = h('div', { class: 'co-subnav' });
    tabs.forEach(function (t) {
      var cls = 'co-chip' + (state.tab === t.id ? ' is-active' : '');
      var btn = h('button', { class: cls, text: t.label });
      btn.addEventListener('click', function () {
        state.tab = t.id;
        paint();
      });
      nav.appendChild(btn);
    });
    return nav;
  }

  /* ══════════════════════════════════════════════════════
     COACH PAGE
     ══════════════════════════════════════════════════════ */
  function buildHero(d) {
    var verdictEl = h('h1', { class: 'co-hero__verdict' });
    verdictEl.innerHTML = d.verdict;

    return h('section', { class: 'co-sec co-sec--first' }, [
      h('div', { class: 'co-hero co-glass' }, [
        h('div', { class: 'co-hero__bug' }, [
          h('span', { class: 'co-hero__bug-dot' }),
          ' COACH BRIEFING ',
          h('span', { class: 'co-hero__bug-line' })
        ]),
        verdictEl,
        h('div', { class: 'co-hero__meta' }, [
          h('span', { text: d.date }),
          h('span', { class: 'co-hero__meta-sep' }),
          h('span', { text: d.meta })
        ]),
        h('button', { class: 'co-hero__view',
          onclick: function () { /* TODO: full briefing sheet */ } }, [
          h('span', { text: 'View Full Briefing' }),
          rightArrow()
        ])
      ])
    ]);
  }

  function buildNumbers(d) {
    var grid = h('div', { class: 'co-stats' });
    d.numbers.forEach(function (n) {
      grid.appendChild(h('div', { class: 'co-stat co-glass' }, [
        h('div', { class: 'co-stat__lbl', text: n.lbl }),
        h('div', { class: 'co-stat__num' }, [
          n.num,
          n.suf ? h('span', { text: n.suf }) : null
        ]),
        h('div', { class: 'co-stat__delta co-stat__delta--' + n.dir }, [
          smallArrow(n.dir), ' ' + n.delta
        ])
      ]));
    });
    return h('section', { class: 'co-sec' }, [
      h('div', { class: 'co-sec__head' }, [
        h('div', { class: 'co-sec__title', text: "This Week's Numbers" }),
        h('div', { class: 'co-sec__more', text: '7D' })
      ]),
      grid
    ]);
  }

  function buildChatCTA() {
    return h('section', { class: 'co-sec' }, [
      h('div', { class: 'co-chat co-glass' }, [
        h('div', { class: 'co-chat__avatar' }, [
          h('span', { class: 'co-chat__avatar-mark', text: 'C' }),
          h('span', { class: 'co-chat__avatar-pulse' })
        ]),
        h('div', { class: 'co-chat__head' }, [
          h('span', { class: 'co-chat__name', text: 'Coach Whitfield' }),
          h('span', { class: 'co-chat__status', text: 'Online' })
        ]),
        (function () {
          var msg = h('p', { class: 'co-chat__msg' });
          msg.innerHTML = '<em>"Ready to talk about your week?"</em> Ask me anything — shot selection, footwork, that 4th-quarter dip.';
          return msg;
        })(),
        h('button', { class: 'co-chat__cta',
          onclick: function () {
            try {
              if (window.aiCoach && typeof window.aiCoach.openChat === 'function') {
                window.aiCoach.openChat();
                return;
              }
            } catch (e) { /* fallback */ }
            if (window.dbSwitchTab) window.dbSwitchTab('coach');
          } }, [
          h('span', { text: 'Start Chat' }),
          rightArrow()
        ])
      ])
    ]);
  }

  function buildDrills(d) {
    var list = h('div', { class: 'co-drills' });
    d.drills.forEach(function (dr) {
      list.appendChild(h('div', { class: 'co-drill co-glass' }, [
        h('div', { class: 'co-drill__head' }, [
          h('div', { class: 'co-drill__name', text: dr.name })
        ]),
        h('div', { class: 'co-drill__meta' }, [
          h('span', { class: 'co-drill__pill' }, [clockIcon(), ' ' + dr.duration]),
          h('span', { class: 'co-drill__pill co-drill__pill--diff-' + dr.diff, text: dr.diffLbl.toUpperCase() })
        ]),
        h('div', { class: 'co-drill__why' }, [
          h('span', { class: 'co-drill__why-tag', text: 'Why:' }),
          h('span', { class: 'co-drill__why-text', text: dr.why })
        ]),
        h('button', { class: 'co-drill__cta', 'aria-label': 'Open in Train' }, [rightArrow()])
      ]));
    });
    return h('section', { class: 'co-sec' }, [
      h('div', { class: 'co-sec__head' }, [
        h('div', { class: 'co-sec__title', text: 'Recommended Drills' }),
        h('div', { class: 'co-sec__more', text: '→ TRAIN' })
      ]),
      list
    ]);
  }

  function buildTrend(d) {
    var t = d.trend;
    var trendW = 130, trendH = 60, pad = 6;
    var max = Math.max.apply(null, t.weeks.map(function (w) { return w.val; }));
    var mn = 50;
    var barW = (trendW - pad * 2) / t.weeks.length - 4;

    var bars = [];
    t.weeks.forEach(function (w, i) {
      var ht = ((w.val - mn) / (100 - mn)) * (trendH - 18);
      var x = pad + i * ((trendW - pad * 2) / t.weeks.length) + 2;
      var y = trendH - 12 - ht;
      var isLast = i === t.weeks.length - 1;
      bars.push(svg('rect', {
        x: String(x), y: String(y), width: String(barW), height: String(ht),
        rx: '2',
        class: 'co-spark__bar' + (isLast ? ' co-spark__bar--last' : ''),
        opacity: isLast ? '1' : String(0.5 + i * 0.12)
      }));
      bars.push(svg('text', {
        x: String(x + barW / 2), y: String(trendH - 2),
        class: 'co-spark__lbl' + (isLast ? ' co-spark__lbl--last' : ''),
        text: w.lbl
      }));
    });

    var sparkSvg = svg('svg', {
      class: 'co-spark',
      viewBox: '0 0 ' + trendW + ' ' + trendH
    }, bars);

    var pillCls = 'co-trend__pill co-trend__pill--' + (t.dir === 'up' ? 'up' : 'down');

    return h('section', { class: 'co-sec' }, [
      h('div', { class: 'co-sec__head' }, [
        h('div', { class: 'co-sec__title', text: 'Weekly Trend' }),
        h('div', { class: 'co-sec__more', text: '4 WK' })
      ]),
      h('div', { class: 'co-trend co-glass' }, [
        h('div', { class: 'co-trend__l' }, [
          h('div', { class: 'co-trend__lbl', text: 'Overall Score' }),
          h('div', { class: 'co-trend__num' }, [
            String(t.score),
            h('span', { class: 'co-trend__num-suf', text: '/ 100' })
          ]),
          h('span', { class: pillCls }, [
            smallArrow(t.dir),
            ' ' + t.label + ' ' + t.delta
          ])
        ]),
        sparkSvg
      ])
    ]);
  }

  function buildCoachPage() {
    var d = loadInsight();
    var frag = document.createDocumentFragment();
    frag.appendChild(buildHero(d));
    frag.appendChild(buildNumbers(d));
    frag.appendChild(buildChatCTA());
    frag.appendChild(buildDrills(d));
    frag.appendChild(buildTrend(d));
    frag.appendChild(h('div', { class: 'co-foot', text: 'CourtIQ · Coach · §6.14' }));
    return frag;
  }

  /* ══════════════════════════════════════════════════════
     UPDATE PAGE — sliders
     ══════════════════════════════════════════════════════ */
  function buildSlider(skill) {
    var val = state.sliders[skill.id] || skill.val;
    var pct = ((val - 1) / 9) * 100;

    var valEl = h('div', { class: 'co-slider__val' }, [String(val), h('span', { text: '/10' })]);
    var fillEl = h('div', { class: 'co-slider__fill' });
    fillEl.style.width = pct + '%';
    var thumbEl = h('div', { class: 'co-slider__thumb' });
    thumbEl.style.left = pct + '%';
    var hintEl = h('div', { class: 'co-slider__hint', text: getHint(skill, val) });

    var trackEl = h('div', { class: 'co-slider__track' }, [
      h('div', { class: 'co-slider__rail' }, [fillEl]),
      thumbEl
    ]);

    function updateVal(clientX) {
      var r = trackEl.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      var v = Math.round(1 + p * 9);
      if (v < 1) v = 1;
      if (v > 10) v = 10;
      state.sliders[skill.id] = v;
      var np = ((v - 1) / 9) * 100;
      fillEl.style.width = np + '%';
      thumbEl.style.left = np + '%';
      valEl.textContent = '';
      valEl.appendChild(document.createTextNode(String(v)));
      valEl.appendChild(h('span', { text: '/10' }));
      hintEl.textContent = getHint(skill, v);
    }

    trackEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      updateVal(e.clientX);
      var move = function (ev) { updateVal(ev.clientX); };
      var up = function () {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    return h('div', { class: 'co-slider' }, [
      h('div', { class: 'co-slider__top' }, [
        h('div', { class: 'co-slider__lbl', text: skill.lbl }),
        valEl
      ]),
      trackEl,
      h('div', { class: 'co-slider__ticks' }, [
        h('span', { text: '1' }),
        h('span', { text: '3' }),
        h('span', { text: '5' }),
        h('span', { text: '7' }),
        h('span', { text: '10' })
      ]),
      hintEl
    ]);
  }

  function buildUpdatePage() {
    var skills = loadSkills();
    var cardChildren = [
      h('div', { class: 'co-update__head' }, [
        h('h2', { class: 'co-update__title', text: 'How are you playing?' }),
        h('p', { class: 'co-update__sub', text: 'Rate yourself across four areas. Your honest read drives next week\'s coaching plan.' })
      ])
    ];
    skills.forEach(function (s) {
      cardChildren.push(buildSlider(s));
    });
    cardChildren.push(h('div', null, [
      h('button', { class: 'co-update__cta', onclick: function () {
        /* TODO: submit self-assessment to AI coach */
        console.log('[coach-v2] update submitted', JSON.stringify(state.sliders));
      } }, [sparkIcon(), ' Get Coach Feedback']),
      h('div', { class: 'co-update__last', text: 'Last updated: 3 days ago' })
    ]));

    var frag = document.createDocumentFragment();
    frag.appendChild(h('section', { class: 'co-sec co-sec--first' }, [
      h('div', { class: 'co-update co-glass' }, cardChildren)
    ]));
    frag.appendChild(h('div', { class: 'co-foot', text: 'CourtIQ · Coach · Update · §6.14' }));
    return frag;
  }

  /* ══════════════════════════════════════════════════════
     HISTORY PAGE
     ══════════════════════════════════════════════════════ */
  function buildHistoryRow(item) {
    var isOpen = state.openHistId === item.id;
    var row = h('div', { class: 'co-hist__row co-glass' + (isOpen ? ' is-open' : '') });

    var scoreEl = h('div', { class: 'co-hist__score' }, [
      String(item.score),
      h('span', { class: 'co-hist__score-suf', text: '/100' })
    ]);

    var topEl = h('div', { class: 'co-hist__top' }, [
      h('div', null, [
        h('div', { class: 'co-hist__date', text: item.date }),
        h('div', { class: 'co-hist__verdict', text: item.verdict })
      ]),
      scoreEl
    ]);
    row.appendChild(topEl);

    if (isOpen) {
      var bodyEl = h('div', { class: 'co-hist__body' });
      item.body.forEach(function (html) {
        var p = h('p');
        p.innerHTML = html;
        bodyEl.appendChild(p);
      });
      row.appendChild(bodyEl);
    }

    row.appendChild(h('div', { class: 'co-hist__chev' }, [
      h('span', { text: isOpen ? 'COLLAPSE' : 'EXPAND' }),
      chevRight()
    ]));

    row.addEventListener('click', function () {
      state.openHistId = isOpen ? null : item.id;
      paint();
    });

    return row;
  }

  function buildHistoryPage() {
    var items = loadHistory();
    var frag = document.createDocumentFragment();

    if (!items || items.length === 0) {
      frag.appendChild(h('section', { class: 'co-sec co-sec--first' }, [
        h('div', { class: 'co-empty co-glass' }, [
          h('div', { class: 'co-empty__icon' }, [whistleIcon()]),
          (function () {
            var t = h('div', { class: 'co-empty__title' });
            t.innerHTML = '<em>Complete your first update to get coached.</em>';
            return t;
          })(),
          h('p', { class: 'co-empty__body', text: 'Rate yourself in the Update tab and the coach will write your first briefing.' })
        ])
      ]));
      return frag;
    }

    var list = h('div', { class: 'co-hist' });
    items.forEach(function (it) {
      list.appendChild(buildHistoryRow(it));
    });

    frag.appendChild(h('section', { class: 'co-sec co-sec--first' }, [
      h('div', { class: 'co-sec__head' }, [
        h('div', { class: 'co-sec__title', text: 'Past Insights · ' + items.length }),
        h('div', { class: 'co-sec__more', text: 'RECENT' })
      ]),
      list
    ]));
    frag.appendChild(h('div', { class: 'co-foot', text: 'CourtIQ · Coach · History · §6.14' }));
    return frag;
  }

  /* ══════════════════════════════════════════════════════
     PAINT — main render
     ══════════════════════════════════════════════════════ */
  var hostRef = null;

  function paint() {
    if (!hostRef) return;
    DOM.clearChildren(hostRef);

    var stamp = buildStamp();
    var subnav = buildSubnav();

    var scrollContent;
    if (state.tab === 'update') {
      scrollContent = buildUpdatePage();
    } else if (state.tab === 'history') {
      scrollContent = buildHistoryPage();
    } else {
      scrollContent = buildCoachPage();
    }

    var scroll = h('div', { class: 'co-scroll' });
    scroll.appendChild(scrollContent);

    var screen = h('div', { class: 'co' }, [stamp, subnav, scroll]);
    hostRef.appendChild(screen);
  }

  /* ══════════════════════════════════════════════════════
     EXPORTS
     ══════════════════════════════════════════════════════ */
  function render() {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-coach');
    state.tab = 'coach';
    state.openHistId = null;
    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_Coach = { render: render, cleanup: cleanup };
})();
