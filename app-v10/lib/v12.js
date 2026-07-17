/* CourtIQ v12 — shared furniture for the white system
   ------------------------------------------------------------------
   • header(title, sub)        — screen title row (non-home tabs)
   • card(opts, children)      — the Duolingo card (tint, press, bg icon)
   • btn(opts)                 — lipped button
   • seg(items, activeId, cb)  — light segmented control
   • xpBar(cur, next)          — gold XP progress
   • courtThumb(pattern, tint) — mini half-court diagram for drill tiles.
     The geometry is V11Court's real NBA half court (500×470 @10px/ft),
     cropped to the scoring area — drills draw REAL spots on a REAL
     court, not clip-art. Patterns are keyed by the drill's focus area.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg;

  function activates(fn) {
    return function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); fn();
      }
    };
  }

  /* ── header ─────────────────────────────────────────────────── */
  function header(title, sub) {
    var kids = [h('div', { class: 'd-title', text: title })];
    if (sub) kids.push(h('div', { class: 'd-sub', text: sub }));
    return h('div', {}, kids);
  }

  /* ── card ───────────────────────────────────────────────────── */
  function card(opts, children) {
    opts = opts || {};
    var cls = 'd-card';
    if (opts.tint) cls += ' d-card--' + opts.tint;
    if (opts.press || opts.onClick) cls += ' d-card--press';
    if (opts.class) cls += ' ' + opts.class;
    var props = { class: cls };
    if (opts.onClick) {
      props.onclick = opts.onClick;
      props.role = 'button';
      props.tabindex = '0';
      props.onkeydown = activates(opts.onClick);
      if (opts.label) props['aria-label'] = opts.label;
    }
    var el = h('div', props, children || []);
    /* The "not boring" clause: a big faded icon in the corner. */
    if (opts.bgIcon) {
      el.appendChild(h('i', {
        class: 'ph-fill ' + opts.bgIcon + ' d-card__bg d-bg--' + (opts.bgTone || opts.tint || 'ink'),
        'aria-hidden': 'true'
      }));
    }
    return el;
  }

  function btn(opts) {
    return h('button', {
      class: 'd-btn' + (opts.variant ? ' d-btn--' + opts.variant : ''),
      type: 'button', onclick: opts.onClick
    }, [
      opts.icon ? h('i', { class: 'ph-fill ' + opts.icon }) : null,
      h('span', { text: opts.label })
    ].filter(Boolean));
  }

  /* ── segmented control (light) ──────────────────────────────── */
  function seg(items, activeId, onPick) {
    var pill = h('div', { class: 'd-seg__pill' });
    var el = h('div', { class: 'd-seg', role: 'tablist' }, [pill]);
    var idx = 0;
    items.forEach(function (it, i) {
      var on = it.id === activeId;
      if (on) idx = i;
      el.appendChild(h('button', {
        class: 'd-seg__item' + (on ? ' is-active' : ''),
        type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false',
        text: it.label,
        onclick: function () { if (!on) onPick(it.id); }
      }));
    });
    var w = 100 / items.length;
    pill.style.width = 'calc(' + w + '% - 4px)';
    pill.style.transform = 'translateX(calc(' + (idx * 100) + '% + ' + (idx * 4) + 'px))';
    return el;
  }

  /* ── XP bar ─────────────────────────────────────────────────── */
  function xpBar(cur, next) {
    var pct = 0;
    if (next && next > 0) pct = Math.max(3, Math.min(100, Math.round(cur * 100 / next)));
    return h('div', { class: 'd-xp' }, [
      h('div', { class: 'd-xp__bar' }, [
        h('div', { class: 'd-xp__fill', style: { width: pct + '%' } })
      ]),
      h('div', { class: 'd-xp__meta' }, [
        h('span', { text: (cur || 0) + ' XP' }),
        next ? h('span', { text: next + ' XP' }) : null
      ].filter(Boolean))
    ]);
  }

  /* ── mini court diagrams ────────────────────────────────────────
     Real geometry from V11Court, cropped to 500×330. Lines are quiet
     gray; the DRILL is the loud part (orange spots / dashed moves).
     Patterns by focus area — each returns extra SVG children. */
  var LINE = '#C9D2DC';
  var SPOT = '#FF4F1F';
  var MOVE = '#1CB0F6';

  function courtLines() {
    return [
      svg('rect', { x: 0, y: 0, width: 500, height: 330, fill: 'transparent' }),
      svg('rect', { x: 170, y: 0, width: 160, height: 190, fill: 'none', stroke: LINE, 'stroke-width': 10 }),
      svg('circle', { cx: 250, cy: 190, r: 60, fill: 'none', stroke: LINE, 'stroke-width': 10 }),
      svg('line', { x1: 30, y1: 0, x2: 30, y2: 142, stroke: LINE, 'stroke-width': 10 }),
      svg('line', { x1: 470, y1: 0, x2: 470, y2: 142, stroke: LINE, 'stroke-width': 10 }),
      svg('path', { d: 'M 30 142 A 237.5 237.5 0 0 0 470 142', fill: 'none', stroke: LINE, 'stroke-width': 12 }),
      svg('circle', { cx: 250, cy: 52.5, r: 12, fill: 'none', stroke: SPOT, 'stroke-width': 10 })
    ];
  }

  function dot(x, y, r, color) {
    return svg('circle', { cx: x, cy: y, r: r || 17, fill: color || SPOT });
  }
  function dash(d) {
    return svg('path', {
      d: d, fill: 'none', stroke: MOVE, 'stroke-width': 9,
      'stroke-dasharray': '18 14', 'stroke-linecap': 'round'
    });
  }

  var PATTERNS = {
    /* 5 spots around the arc — the classic shooting star. */
    shooting: function () {
      return [
        dot(60, 100), dot(155, 245), dot(250, 300), dot(345, 245), dot(440, 100)
      ];
    },
    /* free throws: one spot at the line, path from rim. */
    freethrow: function () {
      return [ dash('M 250 75 L 250 165'), dot(250, 190) ];
    },
    /* finishing: two spots at the blocks + rim attack arrows. */
    finishing: function () {
      return [
        dash('M 120 210 Q 190 120 235 70'), dash('M 380 210 Q 310 120 265 70'),
        dot(120, 215), dot(380, 215)
      ];
    },
    /* handles: a zig-zag dribble path up the floor. */
    handling: function () {
      return [
        dash('M 110 310 L 200 240 L 120 170 L 210 100'),
        dot(110, 310, 17, MOVE), dot(210, 100)
      ];
    },
    /* midrange: elbows + baseline spots. */
    midrange: function () {
      return [ dot(170, 195), dot(330, 195), dot(95, 60), dot(405, 60) ];
    },
    /* conditioning / default: baseline-to-arc shuttle. */
    fitness: function () {
      return [
        dash('M 90 20 L 90 300'), dash('M 250 20 L 250 300'), dash('M 410 20 L 410 300')
      ];
    }
  };

  function patternFor(focus, i) {
    var f = String(focus || '').toLowerCase();
    if (f.indexOf('shoot') >= 0) return (i % 2) ? PATTERNS.midrange : PATTERNS.shooting;
    if (f.indexOf('free') >= 0) return PATTERNS.freethrow;
    if (f.indexOf('finish') >= 0 || f.indexOf('layup') >= 0) return PATTERNS.finishing;
    if (f.indexOf('handl') >= 0 || f.indexOf('dribbl') >= 0) return PATTERNS.handling;
    if (f.indexOf('condition') >= 0 || f.indexOf('fitness') >= 0 || f.indexOf('agility') >= 0) return PATTERNS.fitness;
    var keys = ['shooting', 'handling', 'finishing', 'midrange'];
    return PATTERNS[keys[(i || 0) % keys.length]];
  }

  function courtThumb(focus, i, opts) {
    opts = opts || {};
    var kids = courtLines().concat(patternFor(focus, i)());
    return svg('svg', {
      viewBox: '0 0 500 330',
      role: 'img', 'aria-label': opts.label || 'Drill diagram',
      style: 'display:block;width:100%;height:auto;background:' + (opts.bg || '#F6F7F9')
    }, kids);
  }

  window.V12 = {
    header: header, card: card, btn: btn, seg: seg,
    xpBar: xpBar, courtThumb: courtThumb, activates: activates
  };
})();
