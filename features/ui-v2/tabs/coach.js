/* CourtIQ UI v2 — Coach tab renderer (Wave 1 redesign)
 *
 * Ports _design-import/v2/components/coach-screen.jsx (CoachPageMain).
 * Hero verdict + numbers grid + chat CTA. Uses AICoach when available
 * for the verdict (window.aiCoach.getDailyVerdict); else fixture.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.COACH_TAB) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[coach-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  var FIXTURE = {
    verdict: 'You\'re hiding from the three. ' +
             'Two corner attempts in the last seven days isn\'t a strategy — it\'s avoidance. ' +
             'Fix it today.',
    date: 'MON · MAY 4 · 2026',
    meta: 'BASED ON 6 SESSIONS',
    numbers: [
      { id: 'fg', lbl: 'FG%',     num: '51', suf: '%', delta: '+4',  dir: 'up'   },
      { id: 'pps',lbl: 'PPS',     num: '1.02', delta: '+0.08', dir: 'up'   },
      { id: '3pa',lbl: '3-PT VOL',num: '12',  delta: '-3',   dir: 'down' },
      { id: 'ses',lbl: 'SESSIONS',num: '6',   suf: '/7', delta: '0',    dir: 'flat' }
    ]
  };

  function loadInsight() {
    var data = JSON.parse(JSON.stringify(FIXTURE));
    try {
      if (window.aiCoach && typeof window.aiCoach.getDailyVerdict === 'function') {
        var v = window.aiCoach.getDailyVerdict();
        if (v && v.verdict) data.verdict = v.verdict;
      }
    } catch (e) { /* fixture */ }
    return data;
  }

  function arrow(dir) {
    var d = dir === 'up' ? 'M12 19V5M5 12l7-7 7 7'
          : dir === 'down' ? 'M12 5v14M5 12l7 7 7-7'
          : 'M5 12h14';
    return svg('svg', { viewBox: '0 0 24 24', width: '14', height: '14',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('path', { d: d })]);
  }

  function rightArrow() {
    return svg('svg', { viewBox: '0 0 24 24', width: '16', height: '16',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('path', { d: 'M5 12h14M13 5l7 7-7 7' })]);
  }

  function buildHero(d) {
    return h('section', { class: 'co-sec co-sec--first' }, [
      h('div', { class: 'co-hero co-glass' }, [
        h('div', { class: 'co-hero__bug' }, [
          h('span', { class: 'co-hero__bug-dot' }),
          ' COACH BRIEFING ',
          h('span', { class: 'co-hero__bug-line' })
        ]),
        h('h1', { class: 'co-hero__verdict', text: d.verdict }),
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
        h('div', { class: 'co-stat__delta co-stat__delta--' + n.dir }, [arrow(n.dir), ' ' + n.delta])
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
          h('div', { class: 'co-chat__name', text: 'Coach Whitfield' }),
          h('div', { class: 'co-chat__status' }, [
            h('span', { class: 'co-chat__online' }),
            ' Online'
          ])
        ]),
        h('div', { class: 'co-chat__copy', text: 'Ask anything about your game — drills, footwork, mental approach.' }),
        h('button', { class: 'co-chat__cta',
          onclick: function () {
            try {
              if (window.aiCoach && typeof window.aiCoach.openChat === 'function') {
                window.aiCoach.openChat();
                return;
              }
            } catch (e) { /* legacy fallback */ }
            if (window.dbSwitchTab) window.dbSwitchTab('coach');
          } }, [
          h('span', { text: 'Start Chat' }),
          rightArrow()
        ])
      ])
    ]);
  }

  var hostRef = null;

  function paint() {
    if (!hostRef) return;
    var d = loadInsight();
    DOM.clearChildren(hostRef);

    var stamp = h('div', { class: 'co-stamp' }, [
      h('div', { class: 'co-stamp__l' }, [
        h('div', null, [
          h('div', { class: 'co-stamp__eyebrow', text: 'COACH · TODAY' }),
          h('div', { class: 'co-stamp__meta', text: d.date })
        ])
      ]),
      h('div', { class: 'co-stamp__pill', text: 'ALL-STAR' })
    ]);

    var scroll = h('div', { class: 'co-scroll' }, [buildHero(d), buildNumbers(d), buildChatCTA()]);
    var screen = h('div', { class: 'co' }, [stamp, scroll]);
    hostRef.appendChild(screen);
  }

  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-coach');
    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_Coach = { render: render, cleanup: cleanup };
})();
