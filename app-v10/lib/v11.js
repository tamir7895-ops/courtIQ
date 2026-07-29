/* CourtIQ v11 — shared screen furniture
   ------------------------------------------------------------------
   Every v11 tab is built from the same skeleton:

     .v11-top    dark  — who you are / where you are / the one number
     .v11-sheet  cream — the record (v10 components live here unmodified)

   DARK = the app. CREAM = the record. Cream is never decoration.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  /* role="button" + tabindex makes a div focusable but not operable —
     a real button fires on Enter/Space and a div doesn't. */
  function activates(fn) {
    return function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); fn();
      }
    };
  }

  /* scrollIntoView({behavior:'smooth'}) silently no-ops in some webviews —
     it doesn't throw, it just does nothing, which turns a scroll affordance
     into a dead control with no way to notice. Tween it ourselves. */
  function scrollToEl(el) {
    if (!el) return;
    var target = el.getBoundingClientRect().top + window.pageYOffset;
    var reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    if (reduce) { window.scrollTo(0, target); return; }
    var start = window.pageYOffset, dist = target - start, t0 = null, dur = 420;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      window.scrollTo(0, start + dist * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Screen header. Home passes the wordmark; every other tab says what it
     is, because you navigated there on purpose. */
  function header(opts) {
    opts = opts || {};
    var p = opts.profile || {};
    var goMe = function () { window.app.go('me'); };
    var av = h('div', {
      class: 'v11-hd__av', role: 'button', tabindex: '0',
      'aria-label': 'Profile', title: 'Profile',
      text: p.avatarUrl ? '' : (p.initial || 'R'),
      onclick: goMe, onkeydown: activates(goMe)
    });
    if (p.avatarUrl) av.style.backgroundImage = 'url(' + p.avatarUrl + ')';
    return h('div', { class: 'v11-hd' }, [
      h('div', { class: 'v11-hd__mark', text: opts.mark || 'CourtIQ' }),
      av
    ]);
  }

  function title(t, sub) {
    var kids = [h('div', { class: 'v11-title', text: t })];
    if (sub) kids.push(h('div', { class: 'v11-sub', text: sub }));
    return h('div', {}, kids);
  }

  /* Segmented control. Mirrors the bottom nav's sliding pill so the app has
     one idea of "where you are" instead of two competing ones. */
  function seg(items, activeId, onPick) {
    var pill = h('div', { class: 'v11-seg__pill' });
    var el = h('div', { class: 'v11-seg', role: 'tablist' }, [pill]);
    var btns = [];
    var cur = activeId;
    /* direction-aware + self-marking — same contract as V12.seg */
    var sgn = (document.documentElement.getAttribute('dir') === 'rtl') ? -1 : 1;
    function mark(i) {
      for (var j = 0; j < btns.length; j++) {
        btns[j].classList.toggle('is-active', j === i);
        btns[j].setAttribute('aria-selected', j === i ? 'true' : 'false');
      }
      pill.style.transform = 'translateX(calc(' + (sgn * i * 100) + '% + ' + (sgn * i * 4) + 'px))';
    }
    items.forEach(function (it, i) {
      var b = h('button', {
        class: 'v11-seg__item', type: 'button', role: 'tab', text: it.label,
        onclick: function () {
          if (it.id === cur) return;
          cur = it.id;
          mark(i);
          onPick(it.id);
        }
      });
      btns.push(b);
      el.appendChild(b);
    });
    var w = 100 / items.length;
    pill.style.width = 'calc(' + w + '% - 4px)';
    var idx = 0;
    for (var i = 0; i < items.length; i++) if (items[i].id === activeId) idx = i;
    mark(idx);
    return el;
  }

  /* Up to three stats, and they must be in DIFFERENT units. Heterogeneous
     units are what let numbers sit together without labels carrying the
     load; four same-unit numbers is the bento we deleted. Pass value:null
     for an honest dash rather than a fake zero. */
  function stats(list) {
    return h('div', { class: 'v11-stats' }, list.slice(0, 3).map(function (s) {
      return h('div', { class: 'v11-stat' }, [
        h('div', {
          class: 'v11-stat__v' + (s.value == null ? ' v11-stat__v--dim' : ''),
          text: s.value == null ? '—' : String(s.value)
        }),
        h('div', { class: 'v11-stat__l', text: s.label })
      ]);
    }));
  }

  function sheet() { return h('div', { class: 'v11-sheet' }); }

  /* Section rule. The meta sits AFTER the rule (order:3 in CSS) so the eye
     lands on the label first. */
  function sheetHd(label, meta) {
    var kids = [h('span', { text: label })];
    if (meta) kids.push(h('span', { class: 'v11-sheet__hd-meta', text: meta }));
    return h('div', { class: 'v11-sheet__hd' }, kids);
  }

  function empty(iconName, t, body) {
    return h('div', { class: 'v11-empty' }, [
      h('i', { class: 'ph-bold ' + iconName + ' v11-empty__icon' }),
      h('div', { class: 'v11-empty__t', text: t }),
      h('div', { class: 'v11-empty__b', text: body })
    ]);
  }

  /* The one action. Duolingo's button physics: a box-shadow with ZERO blur
     and a press that travels exactly the shadow's depth. */
  function cta(opts) {
    return h('button', {
      class: 'v11-cta' + (opts.ghost ? ' v11-cta--ghost' : ''),
      type: 'button', onclick: opts.onClick
    }, [
      opts.icon ? h('i', { class: 'ph-fill ' + opts.icon }) : null,
      h('span', { text: opts.label })
    ].filter(Boolean));
  }

  /* The court lives in lib/court.js — post-session already had a correct
     NBA half court and track.js had a fake one. One court, one truth. */

  window.V11 = {
    header: header, title: title, seg: seg, stats: stats,
    sheet: sheet, sheetHd: sheetHd, empty: empty, cta: cta,
    scrollToEl: scrollToEl, activates: activates
  };
})();
