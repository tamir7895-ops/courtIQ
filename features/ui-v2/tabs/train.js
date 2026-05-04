/* CourtIQ UI v2 — Train tab renderer (Wave 1 redesign)
 *
 * Ports _design-import/v2/components/drill-library-home-v2.jsx structure.
 * Surfaces today's challenge + suggested plan + drill lanes from the
 * sealed DrillEngine when present (window.drillEngine.DRILLS).
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRAIN_TAB) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[train-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  var FIXTURE_HERO = {
    id: 'catch-and-shoot-corner',
    name: 'Corner Catch & Shoot',
    benefit: 'Build trust in your corner three with high-volume reps from a stationary catch.',
    duration: 12, sets: 4, reps: 8, difficulty: 'Intermediate',
    totalDoneByPeers: 240
  };

  var FIXTURE_LANES = [
    { id: 'shooting',     label: 'Shooting',      color: '#f5a623', count: 12 },
    { id: 'ballhandling', label: 'Ball Handling', color: '#4ca3ff', count: 9  },
    { id: 'finishing',    label: 'Finishing',     color: '#bc8cff', count: 7  },
    { id: 'defense',      label: 'Defense',       color: '#56d364', count: 6  },
    { id: 'conditioning', label: 'Conditioning',  color: '#2dd4bf', count: 5  }
  ];

  function getDrillEngineData() {
    var hero = JSON.parse(JSON.stringify(FIXTURE_HERO));
    var lanes = JSON.parse(JSON.stringify(FIXTURE_LANES));
    var totalMastered = 4, totalDrills = lanes.reduce(function (a, l) { return a + l.count; }, 0);
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
    } catch (e) { /* fixture */ }
    return { hero: hero, lanes: lanes, totalMastered: totalMastered, totalDrills: totalDrills, planMin: planMin };
  }

  function backIcon() {
    return svg('svg', { width: '14', height: '14', viewBox: '0 0 14 14', fill: 'none' },
      [svg('path', { d: 'M9 2L4 7l5 5', stroke: 'currentColor', 'stroke-width': '1.6',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]);
  }

  function buildHero(d) {
    return h('section', { class: 'dl-sec dl-sec--first' }, [
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
            onclick: function () { /* TODO: drill player */ } }, ['▶ START']),
          h('button', { class: 'dl-hero__cta-secondary',
            onclick: function () { /* TODO: drill detail */ } }, ['DETAILS'])
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

  function buildLanes(d) {
    var lanesContainer = h('section', { class: 'dl-sec' }, [
      h('div', { class: 'dl-sec__head' }, [
        h('div', { class: 'dl-sec__title', text: 'Skill paths' }),
        h('div', { class: 'dl-sec__sub', text: '5 LANES · BEGINNER → DIAMOND' })
      ])
    ]);
    d.lanes.forEach(function (lane) {
      var laneEl = h('div', { class: 'dl-lane', style: { '--lane-color': lane.color } }, [
        h('div', { class: 'dl-lane__head' }, [
          h('div', { class: 'dl-lane__name', text: lane.label.toUpperCase() }),
          h('div', { class: 'dl-lane__meta', text: lane.count + ' DRILLS' })
        ]),
        h('div', { class: 'dl-lane__track' })
      ]);
      lanesContainer.appendChild(laneEl);
    });
    return lanesContainer;
  }

  var hostRef = null;

  function paint() {
    if (!hostRef) return;
    var d = getDrillEngineData();
    DOM.clearChildren(hostRef);

    var stamp = h('div', { class: 'dl-stamp' }, [
      h('div', { class: 'dl-stamp__l' }, [
        h('button', { class: 'dl-stamp__back', 'aria-label': 'Back',
          onclick: function () { if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('home'); } }, [backIcon()]),
        h('div', null, [
          h('div', { class: 'dl-stamp__eyebrow', text: 'DRILLS · SKILL TREE' }),
          h('div', { class: 'dl-stamp__meta' }, [
            h('b', { text: String(d.totalMastered) }),
            '/' + d.totalDrills + ' MASTERED · 5 PATHS'
          ])
        ])
      ]),
      h('div', { class: 'dl-stamp__pill', text: 'FOR YOU' })
    ]);

    var scroll = h('div', { class: 'dl-scroll' }, [buildHero(d), buildPlan(d), buildLanes(d)]);
    var screen = h('div', { class: 'dl' }, [stamp, scroll]);
    hostRef.appendChild(screen);
  }

  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-train');
    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_Train = { render: render, cleanup: cleanup };
})();
