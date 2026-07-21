/* CourtIQ v10 — UI Helpers
   Tiny DOM builder utilities for screens. No frameworks, no innerHTML.
   ============================================================ */
(function () {
  'use strict';

  // h(tag, props?, children?) — creates an element. props.text sets textContent.
  function h(tag, props, children) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var val = props[key];
        if (val == null) return;
        if (key === 'text') { el.textContent = val; return; }
        if (key === 'class' || key === 'className') { el.className = val; return; }
        if (key === 'style' && typeof val === 'object') {
          Object.keys(val).forEach(function (s) { el.style[s] = val[s]; });
          return;
        }
        if (key.indexOf('on') === 0 && typeof val === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), val);
          return;
        }
        el.setAttribute(key, val);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null || c === false) return;
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return el;
  }

  function svg(tag, props, children) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        if (props[key] == null) return;
        if (key === 'text') { el.textContent = props[key]; return; }
        if (key.indexOf('on') === 0 && typeof props[key] === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), props[key]);
          return;
        }
        el.setAttribute(key, props[key]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null || c === false) return;
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return el;
  }

  function icon(name) {
    var i = document.createElement('i');
    i.className = 'ph-bold ' + name;
    return i;
  }

  /* ─── HEADER PILL (logo + brand + avatar + name) ─────── */
  function headerPill(opts) {
    opts = opts || {};
    var p = opts.profile || {};
    var issue = opts.issue || ('NO. ' + (Math.floor(Date.now()/86400000) % 99 + 1));
    var name = (p.name || 'PLAYER').toUpperCase();
    var meta = ((p.position || 'GUARD') + ' · LV ' + (p.level || 1)).toUpperCase();
    var ini = (p.initial || (p.name || 'A')[0] || 'A').toUpperCase();

    // CourtIQ logo: the reference basketball — straight cross seams +
    // two horizontal arcs bowing toward center (classic ball look).
    // This is the canonical seam style for every ball in the app.
    var logoSvg = svg('svg', { viewBox: '0 0 32 32' }, [
      svg('circle', { cx: '16', cy: '16', r: '14', fill: '#FF4F1F' }),
      svg('path', { d: 'M 16 2 L 16 30 M 2 16 L 30 16 M 6 6 Q 16 14 26 6 M 6 26 Q 16 18 26 26',
        stroke: '#0A2850', 'stroke-width': '1.8', fill: 'none' })
    ]);

    // Avatar: real DiceBear image (saved by avatar-customizer) or fallback initial.
    var avatarUrl = null;
    try { avatarUrl = localStorage.getItem('courtiq_avatar_url'); } catch (e) {}
    if (!avatarUrl) {
      avatarUrl = 'https://api.dicebear.com/9.x/avataaars/png?seed=' +
        encodeURIComponent(p.name || 'CourtIQ') + '&backgroundColor=FF4F1F';
    }
    var avatarEl = h('div', {
      class: 'v10-pill__avatar',
      onclick: function () { if (window.app) window.app.go('me'); }
    }, [
      h('img', {
        src: avatarUrl, alt: ini,
        style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' },
        onerror: function () { this.parentNode.textContent = ini; }
      })
    ]);

    return h('header', { class: 'v10-pill' }, [
      h('div', { class: 'v10-pill__logo' }, [logoSvg]),
      h('div', { class: 'v10-pill__brand' }, [
        h('div', { class: 'v10-pill__brand-name' }, [
          document.createTextNode('COURT'),
          h('em', { text: 'IQ' })
        ]),
        h('div', { class: 'v10-pill__brand-meta', text: issue })
      ]),
      h('div', { class: 'v10-pill__spacer' }),
      avatarEl,
      h('div', { class: 'v10-pill__name' }, [
        h('div', { class: 'v10-pill__name-line', text: name }),
        h('div', { class: 'v10-pill__name-meta', text: meta })
      ])
    ]);
  }

  /* ─── BENTO (variadic cells) ─────────────────────────── */
  function bento(cells) {
    return h('div', { class: 'v10-bento' }, cells.map(function (c) {
      var cls = 'v10-bento__cell' + (c.variant ? ' v10-bento__cell--' + c.variant : '');
      var iconCls = 'ph-bold ' + c.icon + ' v10-bento__icon';
      if (c.iconExtra) iconCls += ' ' + c.iconExtra;
      return h('div', { class: cls }, [
        c.icon ? h('i', { class: iconCls }) : null,
        h('div', { class: 'v10-bento__num' + (c.mono ? ' v10-bento__num--mono' : ''), text: String(c.value) }),
        h('div', { class: 'v10-bento__label', text: c.label })
      ]);
    }));
  }

  /* ─── RIBBON ─────────────────────────────────────────── */
  function ribbon(opts) {
    return h('div', { class: 'v10-ribbon' }, [
      h('div', { class: 'v10-ribbon__title' }, [
        opts.icon ? icon(opts.icon) : null,
        h('span', { class: 'v10-ribbon__hl', text: opts.title || '' })
      ]),
      opts.meta ? h('span', { class: 'v10-ribbon__meta', text: opts.meta }) : null
    ]);
  }

  /* ─── CTA ────────────────────────────────────────────── */
  function cta(opts) {
    var btn = h('button', {
      class: 'v10-cta' + (opts.variant ? ' v10-cta--' + opts.variant : ''),
      onclick: opts.onClick || function () {}
    }, [
      opts.icon ? icon(opts.icon) : null,
      h('span', { text: opts.label || 'GO' })
    ]);
    return btn;
  }

  /* ─── PIN CARD (Coach's note) ────────────────────────── */
  function pinCard(opts) {
    var bodyKids = [];
    if (opts.body) {
      // Wrap highlight phrase in span.v10-pin__hl if provided
      if (opts.highlight && opts.body.indexOf(opts.highlight) >= 0) {
        var parts = opts.body.split(opts.highlight);
        bodyKids.push(document.createTextNode('“' + parts[0]));
        bodyKids.push(h('span', { class: 'v10-pin__hl', text: opts.highlight }));
        bodyKids.push(document.createTextNode((parts[1] || '').replace(/\(\+[^)]+\)|\+\d+%/, function (m) {
          return '';
        })));
      } else {
        bodyKids.push(document.createTextNode('“' + opts.body));
      }
      if (opts.projection) {
        bodyKids.push(document.createTextNode(' — projected '));
        bodyKids.push(h('strong', { class: 'v10-pin__strong', text: opts.projection }));
      }
      bodyKids.push(document.createTextNode('”'));
    }
    return h('div', { class: 'v10-pin' + (opts.lg ? ' v10-pin--lg' : '') }, [
      h('div', { class: 'v10-pin__tab' }, [icon('ph-push-pin-simple'), h('span', { text: opts.tab || 'PINNED' })]),
      h('div', { class: 'v10-pin__body' }, bodyKids),
      h('div', { class: 'v10-pin__footer' }, [
        h('div', { class: 'v10-pin__sig' }, [icon('ph-brain'), h('span', { text: opts.sig || 'AI SCOUT' })]),
        h('i', { class: 'ph-bold ph-arrow-right', style: { color: 'var(--orange)', fontSize: '14px' } })
      ])
    ]);
  }

  /* ─── MOTION HELPERS (v10.5 WOW layer) ───────────────── */

  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* Animate every integer inside a text node from 0 → target.
     Works on mixed strings ("12/14", "73%", "1,240 XP") by
     rewriting only the digit groups each frame; thousands
     separators are re-applied when the original had them. */
  function animateTextNode(node, dur) {
    var original = node.nodeValue;
    if (!original || !/\d/.test(original)) return;
    var parts = original.split(/(\d[\d,]*)/);   // keep delimiters
    var targets = parts.map(function (p) {
      if (!/^\d[\d,]*$/.test(p)) return null;
      return { n: parseInt(p.replace(/,/g, ''), 10), comma: p.indexOf(',') >= 0 };
    });
    if (!targets.some(function (t) { return t && t.n > 0; })) return;
    var t0 = performance.now();
    function fmt(n, comma) {
      var s = String(n);
      if (comma) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return s;
    }
    function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);           // ease-out-cubic
      node.nodeValue = parts.map(function (part, i) {
        var t = targets[i];
        if (!t) return part;
        return fmt(Math.round(t.n * e), t.comma);
      }).join('');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* Scan a rendered screen and roll its headline numbers up.
     Called by app.go after every render — screens opt in for
     free by using the standard bento/hero classes. */
  function animateCounts(root) {
    if (REDUCED || !root || !root.querySelectorAll) return;
    var els = root.querySelectorAll('.v10-bento__num, .v10-hero__num, .v10-hero__aside-num, .d-num, .h12-badge__v');
    for (var i = 0; i < els.length; i++) {
      var walker = els[i].childNodes;
      for (var j = 0; j < walker.length; j++) {
        if (walker[j].nodeType === 3) animateTextNode(walker[j], 650);
      }
    }
  }

  /* Print-style CSS basketball + bouncing loader */
  function ball() { return h('span', { class: 'v10-ball' }); }
  function ballLoader() { return h('div', { class: 'v10-ball-loader' }, [ball()]); }

  /* Palette confetti burst — celebration without leaving the
     print language: small paper rectangles in the 5 inks. */
  function confetti(opts) {
    if (REDUCED) return;
    opts = opts || {};
    var COLORS = ['#FF4F1F', '#3D7A53', '#E0A82E', '#0A2850', '#FFE873'];
    var count = Math.min(36, opts.count || 18);
    var layer = h('div', { class: 'v10-confetti-layer' });
    document.body.appendChild(layer);
    for (var i = 0; i < count; i++) {
      var px = 8 + Math.random() * 84;                    // vw
      var drift = (Math.random() - 0.5) * 24;             // vw
      var rot = (Math.random() - 0.5) * 720;
      var dur = 950 + Math.random() * 750;
      // Keyframe-driven fall (see .v10-confetti-piece in CSS) — piece
      // geometry + drift/spin passed as CSS custom properties.
      var piece = h('span', {
        class: 'v10-confetti-piece',
        style: {
          left: px + 'vw',
          background: COLORS[i % COLORS.length],
          width: (6 + Math.random() * 5) + 'px',
          height: (9 + Math.random() * 6) + 'px'
        }
      });
      piece.style.setProperty('--dur', dur + 'ms');
      piece.style.setProperty('--dx', drift + 'vw');
      piece.style.setProperty('--r0', Math.round(Math.random() * 180) + 'deg');
      piece.style.setProperty('--r1', Math.round(rot) + 'deg');
      layer.appendChild(piece);
    }
    setTimeout(function () {
      try { if (layer.parentNode) layer.parentNode.removeChild(layer); } catch (e) {}
    }, 2100);
  }

  window.V10UI = {
    h: h, svg: svg, icon: icon,
    headerPill: headerPill,
    bento: bento,
    ribbon: ribbon,
    cta: cta,
    pinCard: pinCard,
    ball: ball,
    ballLoader: ballLoader,
    confetti: confetti,
    animateCounts: animateCounts
  };
})();
