/* CourtIQ UI v2 — Post-Session screen (Wave 1 redesign · new file)
 *
 * Compact port of _design-import/v2/components/post-session-recap.jsx
 * + post-session-shotchart.jsx. Receives a session summary from the
 * Camera HUD and shows: made/att hero, FG%, mini shot chart, XP gained,
 * Save / Discard CTAs. Save → DataService + Gamification; Discard →
 * Track tab.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.SHELL_ACTIVE) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[post-session-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  var hostRef = null;
  var sessionRef = null;

  function fmtDuration(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60), s = total % 60;
    return m + 'm ' + (s < 10 ? '0' + s : s) + 's';
  }

  function buildShotChart(shots) {
    var s = svg('svg', { viewBox: '0 0 358 320', width: '100%', height: '320', class: 'ps-court' });
    s.appendChild(svg('rect', { x: '4', y: '4', width: '350', height: '312', rx: '12',
      fill: 'none', stroke: 'rgba(245,166,35,0.18)', 'stroke-width': '1' }));
    s.appendChild(svg('path', { d: 'M 4 280 Q 179 90 354 280', fill: 'none',
      stroke: 'rgba(245,166,35,0.18)', 'stroke-width': '1' }));
    s.appendChild(svg('rect', { x: '139', y: '230', width: '80', height: '90',
      fill: 'none', stroke: 'rgba(245,166,35,0.18)', 'stroke-width': '1' }));
    s.appendChild(svg('circle', { cx: '179', cy: '290', r: '10',
      fill: 'none', stroke: 'rgba(245,166,35,0.30)', 'stroke-width': '1' }));
    (shots || []).forEach(function (sh) {
      var cx = (sh.x != null ? sh.x : 0.5) * 358;
      var cy = (sh.y != null ? sh.y : 0.5) * 320;
      s.appendChild(svg('circle', {
        cx: String(cx), cy: String(cy), r: sh.made ? '6' : '5',
        fill: sh.made ? '#56d364' : 'transparent',
        stroke: sh.made ? 'rgba(86,211,100,0.9)' : 'rgba(232,64,64,0.85)',
        'stroke-width': sh.made ? '1' : '2'
      }));
    });
    return s;
  }

  function paint() {
    if (!hostRef || !sessionRef) return;
    var s = sessionRef;
    var fg = s.att > 0 ? Math.round((s.made / s.att) * 100) : 0;
    var xp = (s.made * 5) + (s.att * 1);

    DOM.clearChildren(hostRef);
    var screen = h('div', { class: 'ps' }, [
      h('div', { class: 'ps-stamp' }, [
        h('div', { class: 'ps-stamp__l' }, [
          h('div', { class: 'ps-stamp__eyebrow', text: 'SESSION COMPLETE' }),
          h('div', { class: 'ps-stamp__meta', text: fmtDuration(s.durationMs || 0) })
        ]),
        h('div', { class: 'ps-stamp__pill', text: '+' + xp + ' XP' })
      ]),
      h('section', { class: 'ps-sec ps-sec--first' }, [
        h('div', { class: 'ps-hero ps-glass' }, [
          h('div', { class: 'ps-hero__lbl', text: 'FG%' }),
          h('div', { class: 'ps-hero__num' }, [
            h('span', { class: 'ps-hero__int', text: String(fg) }),
            h('span', { class: 'ps-hero__pct', text: '%' })
          ]),
          h('div', { class: 'ps-hero__sub', text: s.made + '/' + s.att + ' SHOTS' })
        ])
      ]),
      h('section', { class: 'ps-sec' }, [
        h('div', { class: 'ps-sec__head' }, [
          h('div', { class: 'ps-sec__title', text: 'Shot Map' }),
          h('div', { class: 'ps-sec__more', text: 'TAP TO REVIEW' })
        ]),
        h('div', { class: 'ps-glass ps-chart' }, [buildShotChart(s.shots)])
      ]),
      h('section', { class: 'ps-sec' }, [
        h('div', { class: 'ps-cta-row' }, [
          h('button', { class: 'ps-cta ps-cta--secondary',
            onclick: function () {
              if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('track');
            } }, ['DISCARD']),
          h('button', { class: 'ps-cta ps-cta--primary',
            onclick: function () {
              try {
                if (window.dataService && typeof window.dataService.saveSession === 'function') {
                  window.dataService.saveSession(s);
                }
                if (window.gamification && typeof window.gamification.awardXP === 'function') {
                  window.gamification.awardXP(xp, 'shooting-session');
                }
              } catch (e) { console.warn('[post-session-v2] save error', e); }
              alert('Session saved · +' + xp + ' XP');
              if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('track');
            } }, ['SAVE'])
        ])
      ]),
      h('div', { class: 'ps-foot', text: 'CourtIQ · Session · §6.30' })
    ]);
    hostRef.appendChild(screen);
  }

  function render(session) {
    sessionRef = session || { made: 0, att: 0, durationMs: 0, shots: [] };
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-post-session');
    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_PostSession = { render: render, cleanup: cleanup };
})();
