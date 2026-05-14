/* CourtIQ UI v2 — Drill Generator (8.4)
 *
 * Adds a "Generator" sub-view to the Train tab. Filters drills by
 * focus area × difficulty and lets the user add a drill to today's
 * plan. Catalog is embedded locally (subset of legacy _DRILLS_DB),
 * so v2 stays decoupled from drill-engine internals.
 *
 * "Add to Today" hooks legacy `window.drillToggleSave(drillId)` if it
 * exists (drill-engine.js line ~2707); falls back to a localStorage
 * write under 'courtiq-saved-drills' (same key drill-engine.js uses).
 *
 * Honors a sessionStorage-stashed pending drill from coach.js (8.1):
 * if 'ciq-pending-drill' is present on switch-into-train, scrolls to
 * the matching card and pulses it.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRAIN_DRILL_GEN) return;

  /* Drill catalog — kept compact + balanced across focus×difficulty.
   * Mirrors a subset of _DRILLS_DB in drill-engine.js but is owned
   * here so the v2 module is self-contained. */
  var CATALOG = [
    { id: 'shoot-001', name: 'Catch & Shoot Corner 3s',     focus: 'Shooting',     diff: 'Beginner',     mins: 12, sets: '4 sets × 10 reps per side',  desc: 'Square up before the catch. Quick release.' },
    { id: 'shoot-002', name: 'Mid-Range Pull-Up',           focus: 'Shooting',     diff: 'Intermediate', mins: 15, sets: '5 sets × 8 reps',             desc: 'Hard dribble, balance, finish square.' },
    { id: 'shoot-003', name: 'Step-Back Three',             focus: 'Shooting',     diff: 'Advanced',     mins: 16, sets: '4 sets × 6 reps each side',  desc: 'Two-step step-back, full follow-through.' },
    { id: 'shoot-004', name: 'Five-Spot Shooting Circuit',  focus: 'Shooting',     diff: 'Beginner',     mins: 20, sets: '3 full circuits',             desc: 'Build rhythm at corners, wings, and key.' },
    { id: 'shoot-006', name: 'Free Throw Pressure Routine', focus: 'Shooting',     diff: 'Intermediate', mins: 12, sets: '10 rounds',                   desc: 'Sprint-and-shoot to mimic game fatigue.' },
    { id: 'catch-and-shoot', name: 'Catch-and-Shoot · 4×10', focus: 'Shooting',    diff: 'Beginner',     mins: 14, sets: '4 sets × 10 reps',            desc: 'Coach-recommended quick-release work.' },
    { id: 'elbow-pull-up', name: 'Elbow Pull-Up · 3×8',     focus: 'Shooting',     diff: 'Intermediate', mins: 12, sets: '3 sets × 8 reps',             desc: 'Coach-recommended contested pull-up.' },

    { id: 'hand-001', name: 'Two-Ball Stationary Dribble',  focus: 'Ball Handling', diff: 'Beginner',     mins: 10, sets: '6 sets × 45 seconds',         desc: 'Both hands at once, eyes up.' },
    { id: 'hand-002', name: 'Cone Slalom Circuit',          focus: 'Ball Handling', diff: 'Intermediate', mins: 15, sets: '5 sets × 2 full lengths',     desc: 'Tight, low dribble through 8 cones.' },
    { id: 'hand-003', name: 'Spider Drill',                 focus: 'Ball Handling', diff: 'Advanced',     mins: 8,  sets: '4 sets × 30 seconds each direction', desc: 'Ball control under fatigue.' },

    { id: 'def-001', name: 'Defensive Shuffle Intervals',   focus: 'Defense',       diff: 'Beginner',     mins: 12, sets: '8 rounds of 20s on / 10s off', desc: 'Stay low, push off the lead foot.' },
    { id: 'def-002', name: 'Closeout Sprints',              focus: 'Defense',       diff: 'Intermediate', mins: 10, sets: '5 sets × 6 closeouts',         desc: 'Sprint-then-stutter, hands high.' },
    { id: 'def-003', name: 'Zone Defense Rotations',        focus: 'Defense',       diff: 'Advanced',     mins: 20, sets: '4 rounds × 3 minutes',         desc: 'Full-court rotations under live pressure.' },

    { id: 'ath-001', name: 'Box Jumps',                     focus: 'Athleticism',   diff: 'Beginner',     mins: 10, sets: '4 sets × 8 jumps',             desc: 'Soft landings, explosive takeoff.' },
    { id: 'ath-002', name: 'Lateral Bounds',                focus: 'Athleticism',   diff: 'Intermediate', mins: 8,  sets: '5 sets × 12 each side',        desc: 'Stick the landing, hold for 1s.' },
    { id: 'ath-003', name: 'Plyometric Burpee Push',        focus: 'Athleticism',   diff: 'Advanced',     mins: 12, sets: '6 sets × 10 reps',             desc: 'Combine power and conditioning.' }
  ];

  var FOCUS_OPTIONS = ['All', 'Shooting', 'Ball Handling', 'Defense', 'Athleticism'];
  var DIFF_OPTIONS  = ['All', 'Beginner', 'Intermediate', 'Advanced'];

  var state = { focus: 'All', diff: 'All', added: {} };

  /* ── DOM helpers ─────────────────────────────────────────── */
  function el(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      for (var k in props) {
        if (k === 'cls') node.className = props[k];
        else if (k === 'text') node.textContent = props[k];
        else if (k === 'data') for (var d in props[k]) node.dataset[d] = props[k][d];
        else node.setAttribute(k, props[k]);
      }
    }
    return node;
  }

  /* ── Filter chips ────────────────────────────────────────── */
  function buildFilters() {
    var wrap = el('div', { cls: 'ciq-drill-filters' });

    var focusRow = el('div', { cls: 'ciq-drill-filter-row', 'aria-label': 'Filter by focus area' });
    FOCUS_OPTIONS.forEach(function (f) {
      var c = el('button', { cls: 'ciq-drill-chip' + (state.focus === f ? ' active' : ''), type: 'button' });
      c.textContent = f;
      c.dataset.kind = 'focus';
      c.dataset.value = f;
      c.addEventListener('click', function () {
        state.focus = f;
        Array.prototype.forEach.call(focusRow.children, function (b) { b.classList.toggle('active', b.dataset.value === f); });
        rerenderList();
      });
      focusRow.appendChild(c);
    });

    var diffRow = el('div', { cls: 'ciq-drill-filter-row', 'aria-label': 'Filter by difficulty' });
    DIFF_OPTIONS.forEach(function (d) {
      var c = el('button', { cls: 'ciq-drill-chip' + (state.diff === d ? ' active' : ''), type: 'button' });
      c.textContent = d;
      c.dataset.kind = 'diff';
      c.dataset.value = d;
      c.addEventListener('click', function () {
        state.diff = d;
        Array.prototype.forEach.call(diffRow.children, function (b) { b.classList.toggle('active', b.dataset.value === d); });
        rerenderList();
      });
      diffRow.appendChild(c);
    });

    wrap.appendChild(focusRow);
    wrap.appendChild(diffRow);
    return wrap;
  }

  /* ── Card ────────────────────────────────────────────────── */
  /* Map a drill's focus area to its basketball-native icon. */
  function focusIconName(focus) {
    if (focus === 'Shooting')      return 'shooting';
    if (focus === 'Ball Handling') return 'ballhandling';
    if (focus === 'Defense')       return 'defense';
    if (focus === 'Athleticism')   return 'athleticism';
    return 'courtRim';
  }

  function buildCard(drill) {
    var card = el('div', { cls: 'ciq-drill-card' });
    card.dataset.drillId = drill.id;

    var icon = el('div', { cls: 'ciq-drill-card-icon' });
    if (window.ICONS && window.ICONS[focusIconName(drill.focus)]) {
      icon.appendChild(window.ICONS[focusIconName(drill.focus)]({ size: 22 }));
    }
    card.appendChild(icon);

    var body = el('div', { cls: 'ciq-drill-card-body' });
    var name = el('div', { cls: 'ciq-drill-card-name' });
    name.textContent = drill.name;
    body.appendChild(name);

    var meta = el('div', { cls: 'ciq-drill-card-meta' });
    meta.textContent = drill.sets + ' · ' + drill.mins + 'min';
    body.appendChild(meta);

    var tags = el('div', { cls: 'ciq-drill-card-tags' });
    var focusTag = el('span', { cls: 'ciq-drill-card-tag' });
    focusTag.textContent = drill.focus;
    tags.appendChild(focusTag);
    var diffTag = el('span', { cls: 'ciq-drill-card-tag diff-' + drill.diff });
    diffTag.textContent = drill.diff;
    tags.appendChild(diffTag);
    body.appendChild(tags);

    card.appendChild(body);

    var cta = el('button', { cls: 'ciq-drill-card-cta' + (state.added[drill.id] ? ' added' : ''), type: 'button' });
    cta.textContent = state.added[drill.id] ? 'Added' : 'Add';
    cta.dataset.ciqAction = 'add-drill';
    cta.dataset.drillId = drill.id;
    cta.addEventListener('click', function (e) {
      e.stopPropagation();
      addDrill(drill, cta);
    });
    card.appendChild(cta);

    // Tap card body → preview/start (fires legacy player if present)
    card.addEventListener('click', function () {
      tryStartDrill(drill);
    });

    return card;
  }

  /* ── Add / start ─────────────────────────────────────────── */
  function addDrill(drill, cta) {
    state.added[drill.id] = true;
    if (cta) {
      cta.classList.add('added');
      cta.textContent = 'Added';
    }
    var saved = false;
    try {
      if (typeof window.drillToggleSave === 'function') {
        window.drillToggleSave(drill.id);
        saved = true;
      }
    } catch (e) { /* silent */ }
    if (!saved) {
      try {
        var key = 'courtiq-saved-drills';
        var raw = localStorage.getItem(key);
        var arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) arr = [];
        if (arr.indexOf(drill.id) === -1) {
          arr.push(drill.id);
          localStorage.setItem(key, JSON.stringify(arr));
        }
      } catch (e) { /* silent */ }
    }
    flashToast('Added: ' + drill.name);
  }

  function tryStartDrill(drill) {
    if (typeof window.drillWorkoutOpen === 'function') {
      try { window.drillWorkoutOpen(drill.id); return; } catch (e) {}
    }
    flashToast('Drill: ' + drill.name);
  }

  /* ── Toast ───────────────────────────────────────────────── */
  var toastEl = null;
  var toastTimer = null;
  function flashToast(text) {
    if (!toastEl) {
      toastEl = el('div', { cls: 'ciq-drill-toast' });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1700);
  }

  /* ── List ────────────────────────────────────────────────── */
  function getFiltered() {
    return CATALOG.filter(function (d) {
      if (state.focus !== 'All' && d.focus !== state.focus) return false;
      if (state.diff !== 'All' && d.diff !== state.diff) return false;
      return true;
    });
  }

  var listEl = null;
  function buildList() {
    listEl = el('div', { cls: 'ciq-drill-list' });
    rerenderList();
    return listEl;
  }
  function rerenderList() {
    if (!listEl) return;
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    var filtered = getFiltered();
    updateCount(filtered.length);
    if (!filtered.length) {
      if (window.TPL && window.TPL.emptyState) {
        listEl.appendChild(window.TPL.emptyState({
          iconName: 'search',
          title: 'Nothing here yet.',
          sub: 'Loosen the filters and try again — there are ' + CATALOG.length + ' drills in the library.'
        }));
      } else {
        // Fallback if templates module didn't load
        var empty = el('div', { cls: 'ciq-empty' });
        empty.appendChild(el('div', { cls: 'ciq-empty-title', text: 'Nothing here yet.' }));
        listEl.appendChild(empty);
      }
      return;
    }
    filtered.forEach(function (d) { listEl.appendChild(buildCard(d)); });
  }

  /* Update the count chip in the header when filters change. */
  function updateCount(n) {
    var b = document.querySelector('.ciq-drill-gen-head .count b');
    if (b) b.textContent = String(n);
  }

  /* ── Mount + sub-nav extension ───────────────────────────── */
  function findTrainScreen() { return document.getElementById('ciq-train-screen'); }

  function mountInto(screen) {
    if (screen.querySelector('.ciq-drill-gen')) return; // already mounted
    var host = el('section', { cls: 'ciq-drill-gen' });
    host.setAttribute('aria-label', 'Drill Generator');

    var head = el('div', { cls: 'ciq-drill-gen-head' });
    var eb = el('div', { cls: 'eb' });
    eb.textContent = 'Drill Generator';
    var count = el('div', { cls: 'count' });
    var b = document.createElement('b');
    b.textContent = String(CATALOG.length);
    count.appendChild(b);
    count.appendChild(document.createTextNode(' drills'));
    head.appendChild(eb);
    head.appendChild(count);
    host.appendChild(head);

    host.appendChild(buildFilters());
    host.appendChild(buildList());
    screen.appendChild(host);
  }

  function ensureSubnavGenerator(screen) {
    var subnav = screen.querySelector('.ciq-train-subnav');
    if (!subnav) return;
    if (subnav.querySelector('[data-ciq-subtab="generator"]')) return;
    var btn = el('button', { type: 'button' });
    btn.dataset.ciqSubtab = 'generator';
    btn.dataset.ciqLegacy = 'training';
    btn.textContent = 'Generator';
    subnav.appendChild(btn);

    // Expose tab-switch logic that toggles body classes for our CSS
    function setSub(name) {
      Array.prototype.forEach.call(subnav.children, function (b) {
        b.classList.toggle('active', b.dataset.ciqSubtab === name);
      });
      document.body.classList.remove('ciq-train-sub-program', 'ciq-train-sub-moves', 'ciq-train-sub-generator');
      document.body.classList.add('ciq-train-sub-' + name);
    }

    // Wrap existing click handler so "Generator" stays on screen instead of routing
    subnav.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ciq-subtab]');
      if (!b) return;
      if (b.dataset.ciqSubtab === 'generator') {
        e.stopImmediatePropagation();
        setSub('generator');
      } else if (b.dataset.ciqSubtab === 'program') {
        setSub('program');
      } else if (b.dataset.ciqSubtab === 'moves') {
        // Let train.js route to legacy panel; we just clear the body sub-class
        document.body.classList.remove('ciq-train-sub-program', 'ciq-train-sub-moves', 'ciq-train-sub-generator');
        document.body.classList.add('ciq-train-sub-moves');
      }
    }, true); // capture so we run before train.js's own listener

    // Default: program selected, sub-class set
    document.body.classList.add('ciq-train-sub-program');
  }

  /* ── Pending-drill highlight (from coach.js 8.1) ─────────── */
  function honorPendingDrill() {
    try {
      var raw = sessionStorage.getItem('ciq-pending-drill');
      if (!raw) return;
      var pending = JSON.parse(raw);
      if (!pending || !pending.id) return;
      // Only honor if recent (≤ 30s old)
      if (pending.ts && Date.now() - pending.ts > 30000) return;
      sessionStorage.removeItem('ciq-pending-drill');
      var match = CATALOG.find(function (d) { return d.id === pending.id; });
      if (!match) return;
      // Switch to Generator sub-view + scroll to match
      var screen = findTrainScreen();
      if (!screen) return;
      var subnav = screen.querySelector('.ciq-train-subnav');
      var genBtn = subnav && subnav.querySelector('[data-ciq-subtab="generator"]');
      if (genBtn) genBtn.click();
      setTimeout(function () {
        var card = screen.querySelector('.ciq-drill-card[data-drill-id="' + pending.id + '"]');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.outline = '2px solid var(--c-train)';
          card.style.outlineOffset = '4px';
          setTimeout(function () { card.style.outline = ''; }, 2400);
        }
      }, 150);
    } catch (e) { /* silent */ }
  }

  function init() {
    var screen = findTrainScreen();
    if (!screen) {
      setTimeout(init, 200);
      return;
    }
    mountInto(screen);
    ensureSubnavGenerator(screen);

    // Watch for tab switches into Train so we honor pending drills
    if ('MutationObserver' in window) {
      var bmo = new MutationObserver(function () {
        if (document.body.classList.contains('ciq-tab-train')) honorPendingDrill();
      });
      bmo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    // Initial check in case we land on Train directly
    if (document.body.classList.contains('ciq-tab-train')) honorPendingDrill();

    window.CIQ_DRILL_GEN = {
      catalog: CATALOG,
      setFocus: function (f) { state.focus = f; rerenderList(); },
      setDiff:  function (d) { state.diff  = d; rerenderList(); },
      filtered: getFiltered
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
