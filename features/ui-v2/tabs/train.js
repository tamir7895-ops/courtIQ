/* CourtIQ UI v2 — Train tab renderer (Wave 2 redesign)
 *
 * Full drill-library home matching the Claude Design mockup:
 *   1. Stamp header with logo + eyebrow + meta + gear
 *   2. Sub-nav pills (For You / All Drills / Paths)
 *   3. Train Today hero card with drill breakdown
 *   4. Today's Challenge card
 *   5. Drill Categories 2-col grid
 *   6. Quick Stats row
 *   7. Browse All link
 *
 * Reads from DrillEngine when available; falls back to fixture data.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRAIN_TAB) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[train-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  /* ─── Day helpers ─── */
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var todayDay = DAYS[new Date().getDay()];

  /* ─── Fixture data ─── */

  var FIXTURE_HERO = {
    id: 'catch-and-shoot-corner',
    name: 'Corner Catch & Shoot',
    benefit: 'Build trust in your corner three with high-volume reps from a stationary catch.',
    duration: 12, sets: 4, reps: 8, difficulty: 'Intermediate',
    totalDoneByPeers: 240
  };

  var FIXTURE_WORKOUT = {
    title: 'Midrange Masterclass',
    titleAccent: 'Masterclass',
    duration: 35, drillCount: 4, difficulty: 'Intermediate', xp: 200,
    drills: [
      { num: '01', name: 'Elbow Pull-Up Ladder', sub: 'Warm-up · 4×8', min: 8 },
      { num: '02', name: 'Free-Throw Line Series', sub: 'Form · 3×10', min: 10 },
      { num: '03', name: 'Spot-Up Mid Range', sub: 'Catch & shoot · 5 spots', min: 12 },
      { num: '04', name: 'Pressure Finisher', sub: 'Streak · best of 10', min: 5 }
    ]
  };

  var FIXTURE_CATEGORIES = [
    { id: 'shooting',     label: 'Shooting',      icon: 'shooting',     color: '#4ca3ff', count: 12, mastered: 4 },
    { id: 'ballhandling', label: 'Ball Handling',  icon: 'ballhandling', color: '#ffc94a', count: 9,  mastered: 2 },
    { id: 'finishing',    label: 'Finishing',      icon: 'finishing',    color: '#ff7a55', count: 7,  mastered: 1 },
    { id: 'defense',      label: 'Defense',        icon: 'defense',      color: '#7be0ff', count: 6,  mastered: 0 },
    { id: 'conditioning', label: 'Conditioning',   icon: 'athleticism',  color: '#2dd4bf', count: 5,  mastered: 1 },
    { id: 'iq',           label: 'Basketball IQ',  icon: 'defense',      color: '#bc8cff', count: 6,  mastered: 0 }
  ];

  var FIXTURE_STATS = {
    sessionsThisWeek: 3,
    totalDrills: 45,
    streak: 5
  };

  /* ─── Engine integration ─── */

  function getDrillEngineData() {
    var hero = JSON.parse(JSON.stringify(FIXTURE_HERO));
    var cats = JSON.parse(JSON.stringify(FIXTURE_CATEGORIES));
    var totalMastered = 8;
    var totalDrills = cats.reduce(function (a, c) { return a + c.count; }, 0);
    var planMin = 25;
    try {
      var eng = window.drillEngine || window.DrillEngine;
      if (eng && eng.DRILLS && Array.isArray(eng.DRILLS)) {
        totalDrills = eng.DRILLS.length;
        if (typeof eng.recommendForUser === 'function') {
          var recs = eng.recommendForUser([], 1);
          if (recs && recs[0]) hero = recs[0];
        }
        if (typeof eng.suggestPlan === 'function') {
          var p = eng.suggestPlan([]);
          if (p && p.totalMin) planMin = p.totalMin;
        }
      }
    } catch (e) { /* fixture fallback */ }
    return {
      hero: hero, categories: cats,
      totalMastered: totalMastered, totalDrills: totalDrills,
      planMin: planMin, workout: FIXTURE_WORKOUT, stats: FIXTURE_STATS
    };
  }

  /* ─── SVG icon helpers ─── */

  function gearIcon() {
    return svg('svg', { width: '16', height: '16', viewBox: '0 0 16 16', fill: 'none' }, [
      svg('circle', { cx: '8', cy: '8', r: '2.5', stroke: 'currentColor', 'stroke-width': '1.4' }),
      svg('path', { d: 'M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4',
        stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round' })
    ]);
  }

  function clockIcon() {
    return svg('svg', { width: '11', height: '11', viewBox: '0 0 16 16', fill: 'none' }, [
      svg('circle', { cx: '8', cy: '8.5', r: '5.5', stroke: 'currentColor', 'stroke-width': '1.5' }),
      svg('path', { d: 'M8 5.5V8.5L10 10', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' }),
      svg('path', { d: 'M5.5 2.5h5', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' })
    ]);
  }

  function listIcon() {
    return svg('svg', { width: '11', height: '11', viewBox: '0 0 16 16', fill: 'none' }, [
      svg('rect', { x: '2.5', y: '3', width: '11', height: '10', rx: '1.5', stroke: 'currentColor', 'stroke-width': '1.5' }),
      svg('path', { d: 'M5 6.5h6M5 9h6M5 11.5h4', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' })
    ]);
  }

  function diffIcon() {
    return svg('svg', { width: '11', height: '11', viewBox: '0 0 16 16', fill: 'none' }, [
      svg('rect', { x: '2.5', y: '9', width: '2.5', height: '4.5', rx: '0.5', fill: 'currentColor' }),
      svg('rect', { x: '6.75', y: '6', width: '2.5', height: '7.5', rx: '0.5', fill: 'currentColor' }),
      svg('rect', { x: '11', y: '3', width: '2.5', height: '10.5', rx: '0.5', fill: 'currentColor', opacity: '0.3' })
    ]);
  }

  function starIcon() {
    return svg('svg', { width: '11', height: '11', viewBox: '0 0 16 16', fill: 'none' }, [
      svg('path', { d: 'M8 2.5l1.6 3.5 3.9.5-2.85 2.55.75 3.95L8 11l-3.4 2 .75-3.95L2.5 6.5l3.9-.5L8 2.5Z',
        stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round', fill: 'currentColor', 'fill-opacity': '0.18' })
    ]);
  }

  function playIcon() {
    return svg('svg', { width: '16', height: '16', viewBox: '0 0 16 16', fill: 'none' }, [
      svg('path', { d: 'M4.5 3v10l8-5-8-5Z', fill: 'currentColor' })
    ]);
  }

  function categoryIcon(type) {
    if (type === 'shooting') {
      return svg('svg', { width: '20', height: '20', viewBox: '0 0 16 16', fill: 'none' }, [
        svg('path', { d: 'M8 2.5L4.5 8', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round' }),
        svg('path', { d: 'M4.5 8 Q 8 11 11.5 8', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', fill: 'none' }),
        svg('circle', { cx: '8', cy: '2.5', r: '1.4', fill: 'currentColor' }),
        svg('path', { d: 'M3 12.5h10', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round' })
      ]);
    }
    if (type === 'ballhandling') {
      return svg('svg', { width: '20', height: '20', viewBox: '0 0 16 16', fill: 'none' }, [
        svg('circle', { cx: '8', cy: '8', r: '5', stroke: 'currentColor', 'stroke-width': '1.4' }),
        svg('path', { d: 'M3 8h10M8 3v10M5 4.4 Q 8 8 5 11.6M11 4.4 Q 8 8 11 11.6',
          stroke: 'currentColor', 'stroke-width': '1.1', fill: 'none', 'stroke-linecap': 'round' })
      ]);
    }
    if (type === 'defense') {
      return svg('svg', { width: '20', height: '20', viewBox: '0 0 16 16', fill: 'none' }, [
        svg('path', { d: 'M8 2L3 4v4.5C3 11.5 5.2 13.5 8 14.2c2.8-0.7 5-2.7 5-5.7V4L8 2z',
          stroke: 'currentColor', 'stroke-width': '1.4', fill: 'none', 'stroke-linejoin': 'round' }),
        svg('path', { d: 'M5.8 8.2L7.4 9.8L10.4 6.5',
          stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      ]);
    }
    if (type === 'athleticism' || type === 'conditioning') {
      return svg('svg', { width: '20', height: '20', viewBox: '0 0 16 16', fill: 'none' }, [
        svg('path', { d: 'M9 1.5L3.5 9.5h3L7 14.5L12.5 6.5h-3L10 1.5z',
          stroke: 'currentColor', 'stroke-width': '1.3', fill: 'currentColor', 'fill-opacity': '0.2', 'stroke-linejoin': 'round' })
      ]);
    }
    if (type === 'finishing') {
      return svg('svg', { width: '20', height: '20', viewBox: '0 0 16 16', fill: 'none' }, [
        svg('path', { d: 'M8 2.5L4.5 8', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round' }),
        svg('path', { d: 'M4.5 8 Q 8 11 11.5 8', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', fill: 'none' }),
        svg('circle', { cx: '8', cy: '2.5', r: '1.4', fill: 'currentColor' }),
        svg('path', { d: 'M3 12.5h10', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round' })
      ]);
    }
    // fallback
    return svg('svg', { width: '20', height: '20', viewBox: '0 0 16 16', fill: 'none' }, [
      svg('circle', { cx: '8', cy: '8', r: '5', stroke: 'currentColor', 'stroke-width': '1.4' })
    ]);
  }

  /* ─── Sub-nav state ─── */
  var activeTab = 'foryou'; // 'foryou' | 'all' | 'paths'

  /* ─── Logo helper ─── */
  function logoSvg() {
    // Small inline CourtIQ logo mark
    return svg('svg', { width: '28', height: '28', viewBox: '0 0 28 28', fill: 'none' }, [
      svg('rect', { width: '28', height: '28', rx: '8', fill: '#4ca3ff', 'fill-opacity': '0.15' }),
      svg('circle', { cx: '14', cy: '14', r: '7', stroke: '#4ca3ff', 'stroke-width': '1.6', fill: 'none' }),
      svg('path', { d: 'M10 14h8M14 10v8', stroke: '#4ca3ff', 'stroke-width': '1.4', 'stroke-linecap': 'round' })
    ]);
  }

  /* ════════════════════════════════════════════════════
     BUILD FUNCTIONS — each section of the home screen
     ════════════════════════════════════════════════════ */

  function buildStamp(d) {
    return h('div', { class: 'dl-stamp' }, [
      h('div', { class: 'dl-stamp__l' }, [
        logoSvg(),
        h('div', null, [
          h('div', { class: 'dl-stamp__eyebrow', text: 'TRAIN · DRILLS' }),
          h('div', { class: 'dl-stamp__meta' }, [
            h('b', { text: String(d.totalMastered) }),
            '/' + d.totalDrills + ' MASTERED · 5 PATHS'
          ])
        ])
      ]),
      h('button', { class: 'dl-stamp__icon-btn', 'aria-label': 'Settings',
        onclick: function () { /* TODO: settings */ } }, [gearIcon()])
    ]);
  }

  function buildSubNav() {
    var tabs = [
      { id: 'foryou', label: 'For You' },
      { id: 'all',    label: 'All Drills' },
      { id: 'paths',  label: 'Paths' }
    ];
    var nav = h('div', { class: 'dl-subnav' });
    tabs.forEach(function (t) {
      var pill = h('button', {
        class: 'dl-subnav__pill' + (activeTab === t.id ? ' is-active' : ''),
        text: t.label,
        onclick: function () {
          activeTab = t.id;
          paint();
        }
      });
      nav.appendChild(pill);
    });
    return nav;
  }

  function buildTrainToday(d) {
    var w = d.workout;
    var titleParts = w.title.split(w.titleAccent);
    var titleEl = h('h2', { class: 'dl-today__title' });
    if (titleParts[0]) titleEl.appendChild(document.createTextNode(titleParts[0]));
    titleEl.appendChild(h('em', { text: w.titleAccent }));
    if (titleParts[1]) titleEl.appendChild(document.createTextNode(titleParts[1]));

    var drillRows = w.drills.map(function (dr) {
      return h('div', { class: 'dl-today__drill' }, [
        h('span', { class: 'dl-today__drill-num', text: dr.num }),
        h('span', { class: 'dl-today__drill-name' }, [
          document.createTextNode(dr.name),
          h('span', { text: dr.sub })
        ]),
        h('span', { class: 'dl-today__drill-time' }, [
          h('b', { text: String(dr.min) }),
          'min'
        ])
      ]);
    });

    return h('section', { class: 'dl-sec dl-sec--first' }, [
      h('div', { class: 'dl-today' }, [
        h('span', { class: 'dl-today__bug' }, [
          h('span', { class: 'dl-today__bug-dot' }),
          ' Today · ' + todayDay
        ]),
        titleEl,
        h('div', { class: 'dl-today__meta' }, [
          h('span', { class: 'dl-today__pill dl-today__pill--time' }, [clockIcon(), ' ' + w.duration + ' min']),
          h('span', { class: 'dl-today__pill' }, [listIcon(), ' ' + w.drillCount + ' drills']),
          h('span', { class: 'dl-today__pill dl-today__pill--diff--intermediate' }, [diffIcon(), ' ' + w.difficulty]),
          h('span', { class: 'dl-today__pill dl-today__pill--xp' }, [starIcon(), ' +' + w.xp + ' XP'])
        ]),
        h('div', { class: 'dl-today__drills' }, drillRows),
        h('a', { class: 'dl-today__cta', href: '#',
          onclick: function (e) {
            e.preventDefault();
            if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('workout-player');
            else if (window.CIQ_PLAYER) window.CIQ_PLAYER.start();
          }
        }, [playIcon(), ' Start Workout']),
        h('div', { class: 'dl-today__customize-row' }, [
          h('button', { class: 'dl-today__customize', type: 'button',
            onclick: function () { /* TODO: customize plan */ } }, ['Customize ›'])
        ])
      ])
    ]);
  }

  function buildChallenge(d) {
    return h('section', { class: 'dl-sec' }, [
      h('div', { class: 'dl-sec__head' }, [
        h('div', { class: 'dl-sec__title dl-sec__title--italic', text: "Today's challenge" }),
        h('div', { class: 'dl-sec__sub', text: 'RANK · 01' })
      ]),
      h('div', { class: 'dl-hero' }, [
        h('div', { class: 'dl-hero__head' }, [
          h('span', { class: 'dl-hero__eyebrow' }, [
            h('span', { class: 'dl-hero__eyebrow-dot' }),
            ' TARGETED · WEAK ZONE'
          ]),
          h('span', { class: 'dl-hero__rank', text: '#01 · ' + (d.hero.totalDoneByPeers || 0) + '+ DONE' })
        ]),
        h('div', { class: 'dl-hero__name', text: d.hero.name }),
        h('div', { class: 'dl-hero__benefit', text: d.hero.benefit }),
        h('div', { class: 'dl-hero__bar' }, [
          h('div', { class: 'dl-hero__chip' }, [
            h('span', { class: 'dl-hero__chip-lbl', text: 'DURATION' }),
            h('span', { class: 'dl-hero__chip-val' }, [String(d.hero.duration), h('span', { text: 'MIN' })])
          ]),
          h('div', { class: 'dl-hero__chip' }, [
            h('span', { class: 'dl-hero__chip-lbl', text: 'SETS · REPS' }),
            h('span', { class: 'dl-hero__chip-val', text: d.hero.sets + '×' + d.hero.reps })
          ]),
          h('div', { class: 'dl-hero__chip' }, [
            h('span', { class: 'dl-hero__chip-lbl', text: 'TIER' }),
            h('span', { class: 'dl-hero__chip-val', text: (d.hero.difficulty || '').slice(0, 3).toUpperCase() })
          ])
        ]),
        h('div', { class: 'dl-hero__cta' }, [
          h('button', { class: 'dl-hero__cta-primary',
            onclick: function () {
              if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('workout-player');
              else if (window.CIQ_PLAYER) window.CIQ_PLAYER.start();
            } }, ['▶ START']),
          h('button', { class: 'dl-hero__cta-secondary',
            onclick: function () { /* TODO: drill detail */ } }, ['DETAILS'])
        ])
      ])
    ]);
  }

  function buildCategoryGrid(d) {
    var grid = h('div', { class: 'dl-cat-grid' });
    d.categories.forEach(function (cat) {
      var pct = cat.count > 0 ? Math.round((cat.mastered / cat.count) * 100) : 0;
      var card = h('button', { class: 'dl-cat-card', onclick: function () { /* TODO: open category */ } }, [
        h('div', { class: 'dl-cat-card__icon dl-focus-ico--' + cat.icon }, [categoryIcon(cat.icon)]),
        h('div', { class: 'dl-cat-card__name', text: cat.label }),
        h('div', { class: 'dl-cat-card__meta', text: cat.count + ' drills · ' + cat.mastered + ' mastered' }),
        h('div', { class: 'dl-cat-card__bar' }, [
          h('div', { class: 'dl-cat-card__bar-fill', style: { width: pct + '%' } })
        ])
      ]);
      grid.appendChild(card);
    });
    return h('section', { class: 'dl-sec' }, [
      h('div', { class: 'dl-sec__head' }, [
        h('div', { class: 'dl-sec__title', text: 'Categories' }),
        h('div', { class: 'dl-sec__sub', text: '6 SKILL GROUPS' })
      ]),
      grid
    ]);
  }

  function buildQuickStats(d) {
    var s = d.stats;
    return h('section', { class: 'dl-sec' }, [
      h('div', { class: 'dl-sec__head' }, [
        h('div', { class: 'dl-sec__title', text: 'Quick stats' }),
        h('div', { class: 'dl-sec__sub', text: 'THIS WEEK' })
      ]),
      h('div', { class: 'dl-qstats' }, [
        h('div', { class: 'dl-qstats__cell' }, [
          h('div', { class: 'dl-qstats__num', text: String(s.sessionsThisWeek) }),
          h('div', { class: 'dl-qstats__lbl', text: 'SESSIONS' })
        ]),
        h('div', { class: 'dl-qstats__cell' }, [
          h('div', { class: 'dl-qstats__num', text: String(s.totalDrills) }),
          h('div', { class: 'dl-qstats__lbl', text: 'TOTAL DRILLS' })
        ]),
        h('div', { class: 'dl-qstats__cell' }, [
          h('div', { class: 'dl-qstats__num' }, [
            String(s.streak),
            h('span', { class: 'dl-qstats__unit', text: ' days' })
          ]),
          h('div', { class: 'dl-qstats__lbl', text: 'STREAK' })
        ])
      ])
    ]);
  }

  function buildPlan(d) {
    return h('section', { class: 'dl-sec' }, [
      h('div', { class: 'dl-plan-card dl-glass' }, [
        h('div', null, [
          h('div', { class: 'dl-plan-card__head', text: 'SUGGESTED · COLD-ZONE FIX' }),
          h('div', { class: 'dl-plan-card__copy' }, [
            'A ',
            h('i', { text: d.planMin + '-min' }),
            ' session — warm-up, two focus drills, cooldown.'
          ])
        ]),
        h('div', { class: 'dl-plan-card__num' }, [
          h('span', { class: 'dl-plan-card__num-big', text: String(d.planMin) }),
          h('span', { class: 'dl-plan-card__num-lbl', text: 'MIN · 4 DRILLS' })
        ]),
        h('button', { class: 'dl-plan-card__cta',
          onclick: function () { /* TODO: drill plan sheet */ } }, ['▸ BUILD MY PLAN'])
      ])
    ]);
  }

  function buildBrowseAll() {
    return h('section', { class: 'dl-sec' }, [
      h('button', { class: 'dl-browse-all', onclick: function () {
        activeTab = 'all';
        paint();
      } }, ['BROWSE ALL DRILLS ›'])
    ]);
  }

  /* ─── "All Drills" placeholder view ─── */
  function buildAllDrillsView(d) {
    return h('section', { class: 'dl-sec dl-sec--first' }, [
      h('div', { class: 'dl-sec__head' }, [
        h('div', { class: 'dl-sec__title', text: 'All drills' }),
        h('div', { class: 'dl-sec__sub', text: d.totalDrills + ' AVAILABLE' })
      ]),
      buildCategoryGrid(d)
    ]);
  }

  /* ─── "Paths" view — swim lanes ─── */
  function buildPathsView(d) {
    var container = h('section', { class: 'dl-sec dl-sec--first' }, [
      h('div', { class: 'dl-sec__head' }, [
        h('div', { class: 'dl-sec__title', text: 'Skill paths' }),
        h('div', { class: 'dl-sec__sub', text: '5 LANES · BEGINNER → DIAMOND' })
      ])
    ]);
    d.categories.forEach(function (cat) {
      var pct = cat.count > 0 ? Math.round((cat.mastered / cat.count) * 100) : 0;
      var lane = h('div', { class: 'dl-lane' }, [
        h('div', { class: 'dl-lane__head' }, [
          h('div', { class: 'dl-lane__head-l' }, [
            h('div', { class: 'dl-lane__icon dl-focus-ico--' + cat.icon }, [categoryIcon(cat.icon)]),
            h('div', { class: 'dl-lane__title-block' }, [
              h('div', { class: 'dl-lane__title', text: cat.label.toUpperCase() }),
              h('div', { class: 'dl-lane__progress' }, [
                h('b', { text: String(cat.mastered) }),
                '/' + cat.count + ' MASTERED',
                h('div', { class: 'dl-lane__progress-bar' }, [
                  h('div', { class: 'dl-lane__progress-fill', style: { width: pct + '%' } })
                ])
              ])
            ])
          ]),
          h('button', { class: 'dl-lane__more', text: 'VIEW ›' })
        ]),
        h('div', { class: 'dl-lane__rail' })
      ]);
      container.appendChild(lane);
    });
    return container;
  }

  /* ════════════════════════════════════════════════════
     PAINT — assembles the full screen
     ════════════════════════════════════════════════════ */

  var hostRef = null;

  function paint() {
    if (!hostRef) return;
    var d = getDrillEngineData();
    DOM.clearChildren(hostRef);

    var stamp = buildStamp(d);
    var subNav = buildSubNav();

    var scrollChildren = [];
    if (activeTab === 'foryou') {
      scrollChildren = [
        buildTrainToday(d),
        buildChallenge(d),
        buildCategoryGrid(d),
        buildQuickStats(d),
        buildPlan(d),
        buildBrowseAll()
      ];
    } else if (activeTab === 'all') {
      scrollChildren = [buildAllDrillsView(d)];
    } else if (activeTab === 'paths') {
      scrollChildren = [buildPathsView(d)];
    }

    var scroll = h('div', { class: 'dl-scroll' }, scrollChildren);
    var screen = h('div', { class: 'dl' }, [stamp, subNav, scroll]);
    hostRef.appendChild(screen);
  }

  /* ════════════════════════════════════════════════════
     PUBLIC API
     ════════════════════════════════════════════════════ */

  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-train');
    activeTab = 'foryou';
    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_Train = { render: render, cleanup: cleanup };
})();
