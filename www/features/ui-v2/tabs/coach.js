/* CourtIQ UI v2 — Coach tab module (purple accent).
 *
 * Phase 10.1 — Coach landing rebuilt around an INSIGHT CARD pattern.
 * The previous chat-bubble metaphor is retired (too AI-shaped); the
 * coach now delivers a verdict: headline + supporting bullets +
 * actions, followed by recommended drills as proper list rows.
 *
 * Strategy:
 *   - Hero (TPL.heroPage) prepended above the legacy form
 *   - Insight Card = .ciq-card.ciq-card--halo with eyebrow, headline,
 *     bullets, and a primary CTA "Update This Week" + tertiary CTA
 *   - Recommended drills = TPL.listRow x2, click → Train tab
 *   - Legacy #db-panel-coach form stays untouched and runs normally
 *     (skin only, in coach.css)
 *
 * Hard rules carried forward: no edits to js/ai-coach.js.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.COACH_TAB) return;

  /* ── Insight Card ──────────────────────────────────────────── */
  function buildInsightCard() {
    var card = document.createElement('div');
    card.className = 'ciq-card ciq-card--halo ciq-insight-card';

    var head = document.createElement('div');
    head.className = 'ciq-insight-head';

    var eb = document.createElement('div');
    eb.className = 'ciq-eyebrow-v2';
    var dot = document.createElement('span');
    dot.className = 'ciq-ic-dot ciq-ic-dot--pulse';
    eb.appendChild(dot);
    eb.appendChild(document.createTextNode('Latest Insight'));
    head.appendChild(eb);

    var meta = document.createElement('div');
    meta.className = 'ciq-insight-meta-chip';
    meta.textContent = '2d ago';
    head.appendChild(meta);

    card.appendChild(head);

    var headline = document.createElement('h2');
    headline.className = 'ciq-h2 ciq-insight-headline';
    headline.textContent = 'Your release is 0.12s slower on contested shots.';
    card.appendChild(headline);

    var bullets = document.createElement('ul');
    bullets.className = 'ciq-insight-bullets';
    [
      'Catch-and-shoot looks clean — release at 0.31s avg.',
      'Pull-up under a defender — release jumps to 0.43s.',
      'Two focus drills below will tighten contested release.'
    ].forEach(function (txt) {
      var li = document.createElement('li');
      li.textContent = txt;
      bullets.appendChild(li);
    });
    card.appendChild(bullets);

    var actions = document.createElement('div');
    actions.className = 'ciq-insight-actions';
    actions.appendChild(window.TPL.cta({
      kind: 'primary',
      label: 'Update This Week',
      iconName: 'arrowUpRight',
      onClick: scrollToForm
    }));
    actions.appendChild(window.TPL.cta({
      kind: 'tertiary',
      label: 'View History',
      onClick: function () { /* Phase 10 — Insight History sub-page lands later */ }
    }));
    card.appendChild(actions);

    return card;
  }

  /* ── Recommended drills section ────────────────────────────── */
  function buildRecommendedDrills() {
    var section = document.createElement('section');
    section.className = 'ciq-section ciq-coach-recs';

    var head = document.createElement('div');
    head.className = 'ciq-section-head';

    var eb = document.createElement('div');
    eb.className = 'ciq-eyebrow-v2';
    var dot = document.createElement('span');
    dot.className = 'ciq-ic-dot';
    eb.appendChild(dot);
    eb.appendChild(document.createTextNode('Recommended This Week'));
    head.appendChild(eb);

    var metaChip = document.createElement('div');
    metaChip.className = 'ciq-section-meta-chip';
    metaChip.textContent = '2 drills';
    head.appendChild(metaChip);

    section.appendChild(head);

    var list = document.createElement('div');
    list.className = 'ciq-stack-compact';

    [
      { id: 'catch-and-shoot', name: 'Catch-and-Shoot · 4×10', meta: 'Quick release · 14 min' },
      { id: 'elbow-pull-up',   name: 'Elbow Pull-Up · 3×8',   meta: 'Contested pull-up · 12 min' }
    ].forEach(function (rec) {
      var row = window.TPL.listRow({
        iconName: 'shooting',
        iconAccent: true,
        title: rec.name,
        meta: rec.meta,
        onClick: function () { routeDrill(rec.id, rec.name); }
      });
      row.dataset.ciqAction = 'drill-rec';
      row.dataset.drillId = rec.id;
      row.dataset.drillName = rec.name;
      list.appendChild(row);
    });

    section.appendChild(list);
    return section;
  }

  /* ── Behavior ──────────────────────────────────────────────── */
  function routeDrill(id, name) {
    try {
      sessionStorage.setItem('ciq-pending-drill', JSON.stringify({ id: id, name: name, ts: Date.now() }));
    } catch (_) { /* storage may be blocked */ }
    if (typeof window.dbSwitchTab === 'function') window.dbSwitchTab('training');
    if (window.CIQ_SHELL && typeof window.CIQ_SHELL.switchTo === 'function') {
      window.CIQ_SHELL.switchTo('train');
    }
  }

  function scrollToForm() {
    var panel = document.getElementById('db-panel-coach');
    if (!panel) return;
    for (var i = 0; i < panel.children.length; i++) {
      var child = panel.children[i];
      if (child.id !== 'ciq-coach-intro') {
        child.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }

  /* ── Mount ─────────────────────────────────────────────────── */
  function buildIntro() {
    var page = window.TPL.heroPage({
      id: 'ciq-coach-intro',
      accent: 'coach',
      eyebrow: 'AI Coach',
      title: 'Coach.'
    });
    page.body.appendChild(buildInsightCard());
    page.body.appendChild(buildRecommendedDrills());
    return page.root;
  }

  function init() {
    var panel = document.getElementById('db-panel-coach');
    if (!panel) {
      console.warn('[ciq-coach] #db-panel-coach not found; skipping');
      return;
    }
    if (!window.TPL || !window.ICONS) {
      console.warn('[ciq-coach] TPL or ICONS not available; skipping');
      return;
    }

    if (!document.getElementById('ciq-coach-intro')) {
      var intro = buildIntro();
      panel.insertBefore(intro, panel.firstChild);
    }

    document.body.classList.add('ciq-v2-coach');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
