/* CourtIQ UI v2 — Page template helpers (Phase 10.0.B)
 *
 * Lightweight DOM constructors for the 5 page templates. Each helper
 * returns plain DOM elements that the consumer can extend / mount.
 *
 * Usage:
 *   var page = TPL.heroPage({
 *     id: 'ciq-home-screen',
 *     accent: 'home',  // sets --accent + accent class
 *     eyebrow: 'Today',
 *     title: 'Welcome back.',
 *     subnav: [
 *       { id: 'today', label: 'Today', active: true },
 *       { id: 'log',   label: 'Log Session' }
 *     ],
 *     onSubnav: function (id) { ... }
 *   });
 *   container.appendChild(page.root);
 *   page.body.appendChild(myCard);  // body is where you put content cards
 *
 * All builders avoid innerHTML — pure DOM construction.
 */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ═══════════════════════════════════════════════════════════
     HERO PAGE
     ═══════════════════════════════════════════════════════════ */
  function heroPage(opts) {
    opts = opts || {};
    var root = document.createElement('section');
    root.className = 'ciq-template--hero';
    if (opts.id) root.id = opts.id;
    if (opts.accent) {
      root.style.setProperty('--accent', 'var(--c-' + opts.accent + ')');
      root.classList.add('ciq-accent-' + opts.accent);
    }

    var head = el('div', 'ciq-hero-head');

    if (opts.subnav && opts.subnav.length) {
      var nav = el('nav', 'ciq-hero-subnav');
      nav.setAttribute('aria-label', opts.subnavLabel || 'Sub-navigation');
      opts.subnav.forEach(function (item) {
        var btn = el('button', item.active ? 'active' : '');
        btn.type = 'button';
        btn.dataset.subnav = item.id;
        btn.textContent = item.label;
        btn.addEventListener('click', function () {
          Array.prototype.forEach.call(nav.children, function (b) { b.classList.toggle('active', b === btn); });
          if (typeof opts.onSubnav === 'function') opts.onSubnav(item.id, item);
        });
        nav.appendChild(btn);
      });
      head.appendChild(nav);
    }

    if (opts.eyebrow) {
      var eb = el('div', 'ciq-eyebrow-v2');
      if (opts.eyebrowDot !== false) {
        var dot = el('span', 'ciq-ic-dot ciq-ic-dot--pulse');
        eb.appendChild(dot);
      }
      eb.appendChild(document.createTextNode(opts.eyebrow));
      head.appendChild(eb);
    }
    if (opts.title) {
      var h1 = el('h1', 'ciq-h1');
      h1.textContent = opts.title;
      head.appendChild(h1);
    }
    if (opts.subtitle) {
      head.appendChild(el('p', 'ciq-body', opts.subtitle));
    }
    root.appendChild(head);

    var body = el('div', 'ciq-stack-normal');
    root.appendChild(body);

    return { root: root, head: head, body: body };
  }

  /* ═══════════════════════════════════════════════════════════
     LIST PAGE
     ═══════════════════════════════════════════════════════════ */
  function listPage(opts) {
    opts = opts || {};
    var root = document.createElement('section');
    root.className = 'ciq-template--list';
    if (opts.id) root.id = opts.id;
    if (opts.accent) {
      root.style.setProperty('--accent', 'var(--c-' + opts.accent + ')');
      root.classList.add('ciq-accent-' + opts.accent);
    }

    var head = el('div', 'ciq-list-head');
    var heads = el('div');

    if (opts.eyebrow) {
      var eb = el('div', 'ciq-eyebrow-v2');
      if (opts.eyebrowDot !== false) eb.appendChild(el('span', 'ciq-ic-dot ciq-ic-dot--pulse'));
      eb.appendChild(document.createTextNode(opts.eyebrow));
      heads.appendChild(eb);
    }
    if (opts.title) {
      var h1 = el('h1', 'ciq-h1');
      h1.textContent = opts.title;
      heads.appendChild(h1);
    }
    head.appendChild(heads);

    if (opts.meta) {
      var meta = el('div', 'ciq-list-meta');
      if (opts.metaCount != null) {
        var b = document.createElement('b');
        b.textContent = String(opts.metaCount);
        meta.appendChild(b);
      }
      meta.appendChild(document.createTextNode(opts.meta));
      head.appendChild(meta);
    }
    root.appendChild(head);

    if (opts.subtitle) {
      root.appendChild(el('p', 'ciq-body', opts.subtitle));
    }

    var filters = null;
    if (opts.filters) {
      filters = el('div', 'ciq-stack-compact');
      filters.style.marginTop = '16px';
      filters.style.marginBottom = '16px';
      root.appendChild(filters);
    }

    var body = el('div', 'ciq-list-body');
    root.appendChild(body);

    return { root: root, head: head, filters: filters, body: body, metaEl: head.querySelector('.ciq-list-meta b') };
  }

  /* ═══════════════════════════════════════════════════════════
     DETAIL OVERLAY (fullscreen modal)
     ═══════════════════════════════════════════════════════════ */
  function detailOverlay(opts) {
    opts = opts || {};
    var root = document.createElement('div');
    root.className = 'ciq-template--overlay';
    if (opts.id) root.id = opts.id;
    if (opts.accent) {
      root.style.setProperty('--accent', 'var(--c-' + opts.accent + ')');
      root.classList.add('ciq-accent-' + opts.accent);
    }

    var head = el('div', 'ciq-overlay-head');

    var leadSlot = el('div');
    head.appendChild(leadSlot);

    var statusEl = null;
    if (opts.status) {
      statusEl = el('div', 'ciq-overlay-status');
      if (opts.statusDot !== false) statusEl.appendChild(el('span', 'ciq-ic-dot ciq-ic-dot--pulse'));
      statusEl.appendChild(document.createTextNode(opts.status));
      head.appendChild(statusEl);
    }

    var trailSlot = el('div');
    if (opts.onClose) {
      var closeBtn = el('button', 'ciq-icon-button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close');
      if (window.ICONS && window.ICONS.x) closeBtn.appendChild(window.ICONS.x({ size: 18 }));
      else { closeBtn.textContent = '×'; closeBtn.style.fontSize = '20px'; }
      closeBtn.addEventListener('click', opts.onClose);
      trailSlot.appendChild(closeBtn);
    }
    head.appendChild(trailSlot);

    root.appendChild(head);

    var body = el('div', 'ciq-overlay-body');
    root.appendChild(body);

    var controls = el('div', 'ciq-overlay-controls');
    root.appendChild(controls);

    return { root: root, head: head, body: body, controls: controls, statusEl: statusEl };
  }

  /* ═══════════════════════════════════════════════════════════
     BOTTOM SHEET
     ═══════════════════════════════════════════════════════════ */
  function bottomSheet(opts) {
    opts = opts || {};
    var backdrop = el('div', 'ciq-template--sheet-backdrop');
    if (opts.onDismiss) backdrop.addEventListener('click', opts.onDismiss);

    var sheet = document.createElement('div');
    sheet.className = 'ciq-template--sheet';
    if (opts.id) sheet.id = opts.id;
    if (opts.accent) {
      sheet.style.setProperty('--accent', 'var(--c-' + opts.accent + ')');
      sheet.classList.add('ciq-accent-' + opts.accent);
    }
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');

    sheet.appendChild(el('div', 'ciq-sheet-grabber'));

    var head = el('div', 'ciq-sheet-head');
    var headLeft = el('div');
    if (opts.eyebrow) {
      var eb = el('div', 'ciq-eyebrow-v2');
      if (opts.eyebrowDot !== false) eb.appendChild(el('span', 'ciq-ic-dot'));
      eb.appendChild(document.createTextNode(opts.eyebrow));
      headLeft.appendChild(eb);
    }
    if (opts.title) {
      var h2 = el('h2', 'ciq-h2');
      h2.textContent = opts.title;
      h2.style.marginTop = '2px';
      headLeft.appendChild(h2);
    }
    head.appendChild(headLeft);

    if (opts.onClose) {
      var closeBtn = el('button', 'ciq-icon-button ciq-icon-button--sm');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close');
      if (window.ICONS && window.ICONS.x) closeBtn.appendChild(window.ICONS.x({ size: 16 }));
      else { closeBtn.textContent = '×'; closeBtn.style.fontSize = '18px'; }
      closeBtn.addEventListener('click', opts.onClose);
      head.appendChild(closeBtn);
    }
    sheet.appendChild(head);

    var body = el('div', 'ciq-stack-compact');
    sheet.appendChild(body);

    return { backdrop: backdrop, sheet: sheet, body: body };
  }

  /* ═══════════════════════════════════════════════════════════
     EMBEDDED SECTION
     ═══════════════════════════════════════════════════════════ */
  function embeddedSection(opts) {
    opts = opts || {};
    var section = el('section', 'ciq-section');
    if (opts.id) section.id = opts.id;
    if (opts.accent) {
      section.style.setProperty('--accent', 'var(--c-' + opts.accent + ')');
    }

    var head = el('div', 'ciq-section-head');
    var headLeft = el('div', 'ciq-eyebrow-v2');
    if (opts.eyebrowDot !== false) headLeft.appendChild(el('span', 'ciq-ic-dot ciq-ic-dot--pulse'));
    headLeft.appendChild(document.createTextNode(opts.eyebrow || ''));
    head.appendChild(headLeft);

    if (opts.meta) {
      head.appendChild(el('div', 'ciq-section-meta-chip', opts.meta));
    }
    section.appendChild(head);

    var body = el('div');
    section.appendChild(body);

    return { root: section, head: head, body: body };
  }

  /* ═══════════════════════════════════════════════════════════
     EMPTY STATE — single template
     ═══════════════════════════════════════════════════════════ */
  function emptyState(opts) {
    opts = opts || {};
    var card = el('div', 'ciq-empty');
    if (opts.iconName && window.ICONS && window.ICONS[opts.iconName]) {
      var iconWrap = el('div', 'ciq-empty-icon');
      iconWrap.appendChild(window.ICONS[opts.iconName]({ size: 28 }));
      card.appendChild(iconWrap);
    } else if (opts.icon) {
      var iconWrap2 = el('div', 'ciq-empty-icon');
      iconWrap2.appendChild(opts.icon);
      card.appendChild(iconWrap2);
    }
    if (opts.title) card.appendChild(el('div', 'ciq-empty-title', opts.title));
    if (opts.sub)   card.appendChild(el('div', 'ciq-empty-sub', opts.sub));
    if (opts.cta) {
      var ctaWrap = el('div', 'ciq-empty-cta');
      ctaWrap.appendChild(opts.cta);
      card.appendChild(ctaWrap);
    }
    return card;
  }

  /* ═══════════════════════════════════════════════════════════
     LOADING STATE — single template
     ═══════════════════════════════════════════════════════════ */
  function loadingState(label) {
    var box = el('div', 'ciq-loading ciq-loading--block');
    if (window.ICONS && window.ICONS.courtRim) {
      box.appendChild(window.ICONS.courtRim({ size: 18 }));
    }
    box.appendChild(document.createTextNode(label || 'Loading…'));
    return box;
  }

  /* ═══════════════════════════════════════════════════════════
     CTA BUTTON BUILDER
     ═══════════════════════════════════════════════════════════ */
  function cta(opts) {
    opts = opts || {};
    var btn = el('button', 'ciq-cta');
    btn.type = 'button';
    if (opts.kind) btn.classList.add('ciq-cta--' + opts.kind);
    else btn.classList.add('ciq-cta--primary');
    if (opts.iconName && window.ICONS && window.ICONS[opts.iconName]) {
      btn.appendChild(window.ICONS[opts.iconName]({ size: 14 }));
    }
    if (opts.label) btn.appendChild(document.createTextNode(opts.label));
    if (opts.onClick) btn.addEventListener('click', opts.onClick);
    if (opts.disabled) btn.disabled = true;
    return btn;
  }

  /* ═══════════════════════════════════════════════════════════
     LIST ROW BUILDER
     ═══════════════════════════════════════════════════════════ */
  function listRow(opts) {
    opts = opts || {};
    var row = el('button', 'ciq-list-row');
    row.type = 'button';

    if (opts.iconName && window.ICONS && window.ICONS[opts.iconName]) {
      var tile = el('div', 'ciq-ic-tile' + (opts.iconAccent ? ' accent' : ''));
      tile.appendChild(window.ICONS[opts.iconName]({ size: 18 }));
      row.appendChild(tile);
    } else if (opts.leading) {
      row.appendChild(opts.leading);
    }

    var body = el('div', 'ciq-list-row-body');
    if (opts.title) body.appendChild(el('div', 'ciq-list-row-title', opts.title));
    if (opts.meta)  body.appendChild(el('div', 'ciq-list-row-meta', opts.meta));
    row.appendChild(body);

    if (opts.trail) {
      var trail = el('div', 'ciq-list-row-trail');
      if (typeof opts.trail === 'string') trail.appendChild(document.createTextNode(opts.trail));
      else trail.appendChild(opts.trail);
      row.appendChild(trail);
    } else if (opts.chevron !== false) {
      var trail2 = el('div', 'ciq-list-row-trail');
      if (window.ICONS && window.ICONS.chevronRight) trail2.appendChild(window.ICONS.chevronRight({ size: 16 }));
      row.appendChild(trail2);
    }

    if (opts.onClick) row.addEventListener('click', opts.onClick);
    return row;
  }

  /* Export */
  window.TPL = {
    heroPage: heroPage,
    listPage: listPage,
    detailOverlay: detailOverlay,
    bottomSheet: bottomSheet,
    embeddedSection: embeddedSection,
    emptyState: emptyState,
    loadingState: loadingState,
    cta: cta,
    listRow: listRow,
    el: el
  };
})();
