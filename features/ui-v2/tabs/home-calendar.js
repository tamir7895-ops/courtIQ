/* CourtIQ UI v2 — Home Calendar (8.8)
 *
 * Compact month grid. Shows:
 *   - Days with sessions (read from courtiq-xp history) → green dot
 *   - Days with scheduled events (own LS key 'courtiq-calendar') → amber bg
 *   - Today highlighted
 *   - Tap a day → detail panel with events + "Schedule Session" form
 *
 * Self-contained: doesn't depend on the legacy AI-Coach JSON pipeline,
 * which requires manual JSON pasting. The legacy db-panel-calendar
 * stays accessible in v1 mode for users who want that workflow.
 *
 * Built with createElement — no innerHTML.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.HOME_CALENDAR) return;

  var LS_KEY = 'courtiq-calendar';
  var DOWS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var state = {
    viewYear: 0, viewMonth: 0,
    selected: null  // ISO yyyy-mm-dd string
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function isoOf(y, m, d) {
    return y + '-' + (m < 9 ? '0' : '') + (m + 1) + '-' + (d < 10 ? '0' : '') + d;
  }
  function todayISO() {
    var d = new Date();
    return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function loadEvents() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var p = raw ? JSON.parse(raw) : {};
      return p && typeof p === 'object' ? p : {};
    } catch (e) { return {}; }
  }
  function saveEvents(map) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function loadSessionDates() {
    // Build a Set of ISO strings from courtiq-xp history.
    var set = {};
    try {
      var raw = localStorage.getItem('courtiq-xp');
      if (!raw) return set;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.history)) return set;
      parsed.history.forEach(function (entry) {
        if (entry && entry.ts) {
          var d = new Date(entry.ts);
          set[isoOf(d.getFullYear(), d.getMonth(), d.getDate())] = true;
        }
      });
    } catch (e) {}
    return set;
  }

  /* ── Render ──────────────────────────────────────────────── */
  var hostEl = null, gridEl = null, monthLabelEl = null, detailEl = null;

  function renderGrid() {
    var y = state.viewYear, m = state.viewMonth;
    var firstDay = new Date(y, m, 1).getDay();   // 0..6
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var events = loadEvents();
    var sessions = loadSessionDates();
    var today = todayISO();

    while (gridEl.firstChild) gridEl.removeChild(gridEl.firstChild);
    DOWS.forEach(function (d) { gridEl.appendChild(el('div', 'ciq-cal-dow', d)); });

    // Empty cells before day 1
    for (var i = 0; i < firstDay; i++) {
      gridEl.appendChild(el('div', 'ciq-cal-day empty'));
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var iso = isoOf(y, m, d);
      var cell = el('button', 'ciq-cal-day', String(d));
      cell.type = 'button';
      cell.dataset.iso = iso;
      if (iso === today) cell.classList.add('today');
      if (events[iso] && events[iso].length) cell.classList.add('has-event');
      if (sessions[iso]) cell.classList.add('has-session');
      if (state.selected === iso) cell.classList.add('selected');
      cell.addEventListener('click', (function (isoStr) {
        return function () { selectDay(isoStr); };
      })(iso));
      gridEl.appendChild(cell);
    }

    monthLabelEl.textContent = MONTH_NAMES[m] + ' ' + y;
  }

  function selectDay(iso) {
    state.selected = iso;
    renderGrid();
    renderDetail();
  }

  function renderDetail() {
    while (detailEl.firstChild) detailEl.removeChild(detailEl.firstChild);
    if (!state.selected) {
      var note = el('div', 'ciq-cal-empty', 'Tap a day to plan or review it.');
      detailEl.appendChild(note);
      return;
    }

    var head = el('div', 'ciq-cal-detail-head');
    var d = new Date(state.selected + 'T00:00:00');
    head.appendChild(el('div', 'ciq-cal-detail-date', d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })));
    head.appendChild(el('div', 'ciq-cal-detail-sub', state.selected));
    detailEl.appendChild(head);

    var listWrap = el('div', 'ciq-cal-events');
    var events = loadEvents();
    var dayEvents = events[state.selected] || [];
    var sessions = loadSessionDates();
    var hasSession = !!sessions[state.selected];

    if (hasSession) {
      var sEvent = el('div', 'ciq-cal-event session');
      sEvent.appendChild(el('div', 'dot'));
      sEvent.appendChild(el('div', 'title', 'Session logged'));
      sEvent.appendChild(el('button', 'delete', ''));
      listWrap.appendChild(sEvent);
    }

    if (!dayEvents.length && !hasSession) {
      listWrap.appendChild(el('div', 'ciq-cal-empty', 'Nothing planned. Add a session below.'));
    } else {
      dayEvents.forEach(function (ev, idx) {
        var row = el('div', 'ciq-cal-event');
        row.appendChild(el('div', 'dot'));
        row.appendChild(el('div', 'title', ev.title || 'Session'));
        var delBtn = el('button', 'delete', '×');
        delBtn.type = 'button';
        delBtn.setAttribute('aria-label', 'Remove event');
        delBtn.addEventListener('click', (function (i) {
          return function () { removeEvent(state.selected, i); };
        })(idx));
        row.appendChild(delBtn);
        listWrap.appendChild(row);
      });
    }
    detailEl.appendChild(listWrap);

    // Form
    var form = el('form', 'ciq-cal-form');
    form.setAttribute('autocomplete', 'off');
    var input = el('input');
    input.type = 'text';
    input.placeholder = 'Add a session — e.g. "Shooting drills"';
    input.maxLength = 80;
    var submit = el('button', null, 'Add');
    submit.type = 'submit';
    form.appendChild(input);
    form.appendChild(submit);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = (input.value || '').trim();
      if (!v) return;
      addEvent(state.selected, v);
      input.value = '';
    });
    detailEl.appendChild(form);
  }

  function addEvent(iso, title) {
    var events = loadEvents();
    if (!events[iso]) events[iso] = [];
    events[iso].push({ title: title, createdAt: Date.now() });
    saveEvents(events);
    renderGrid();
    renderDetail();
  }
  function removeEvent(iso, index) {
    var events = loadEvents();
    if (!events[iso]) return;
    events[iso].splice(index, 1);
    if (!events[iso].length) delete events[iso];
    saveEvents(events);
    renderGrid();
    renderDetail();
  }

  /* ── Mount ───────────────────────────────────────────────── */
  function build() {
    hostEl = el('section');
    hostEl.id = 'ciq-home-calendar';
    hostEl.setAttribute('aria-label', 'Calendar');

    hostEl.appendChild(el('div', 'ciq-cal-eyebrow', 'Schedule'));
    hostEl.appendChild(el('div', 'ciq-cal-title', 'Calendar.'));

    var head = el('div', 'ciq-cal-month-head');
    monthLabelEl = el('div', 'ciq-cal-month-name', '');
    head.appendChild(monthLabelEl);
    var nav = el('div', 'ciq-cal-nav');
    var prev = el('button', null, '‹');
    prev.type = 'button';
    prev.addEventListener('click', function () {
      var m = state.viewMonth - 1, y = state.viewYear;
      if (m < 0) { m = 11; y -= 1; }
      state.viewMonth = m; state.viewYear = y;
      renderGrid();
    });
    var next = el('button', null, '›');
    next.type = 'button';
    next.addEventListener('click', function () {
      var m = state.viewMonth + 1, y = state.viewYear;
      if (m > 11) { m = 0; y += 1; }
      state.viewMonth = m; state.viewYear = y;
      renderGrid();
    });
    nav.appendChild(prev);
    nav.appendChild(next);
    head.appendChild(nav);
    hostEl.appendChild(head);

    gridEl = el('div', 'ciq-cal-grid');
    hostEl.appendChild(gridEl);

    detailEl = el('div', 'ciq-cal-day-detail');
    hostEl.appendChild(detailEl);

    return hostEl;
  }

  function mount() {
    var screen = document.getElementById('ciq-home-screen');
    var insertParent = screen ? screen.parentNode : document.querySelector('.db-main-inner') || document.body;
    if (!insertParent || document.getElementById('ciq-home-calendar')) return;
    var node = build();
    if (screen && screen.nextSibling) insertParent.insertBefore(node, screen.nextSibling);
    else insertParent.appendChild(node);

    var d = new Date();
    state.viewYear = d.getFullYear();
    state.viewMonth = d.getMonth();
    state.selected = todayISO();
    renderGrid();
    renderDetail();
  }

  /* ── Sub-nav wiring ──────────────────────────────────────── */
  function wireSubnav() {
    var subnav = document.querySelector('#ciq-home-screen .ciq-home-subnav');
    if (!subnav) {
      setTimeout(wireSubnav, 200);
      return;
    }
    subnav.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ciq-subtab]');
      if (!b) return;
      var sub = b.getAttribute('data-ciq-subtab');
      if (sub === 'calendar') {
        // Stop the legacy route to db-panel-calendar; we render in-place.
        e.stopImmediatePropagation();
        Array.prototype.forEach.call(subnav.children, function (c) {
          c.classList.toggle('active', c === b);
        });
        document.body.classList.remove('ciq-home-sub-today', 'ciq-home-sub-log', 'ciq-home-sub-history', 'ciq-home-sub-calendar', 'ciq-home-sub-notifications');
        document.body.classList.add('ciq-home-sub-calendar');
      } else {
        // For other sub-tabs, clear our calendar class
        document.body.classList.remove('ciq-home-sub-calendar');
        document.body.classList.add('ciq-home-sub-' + sub);
      }
    }, true); // capture so we run before home.js handler
  }

  function init() {
    mount();
    wireSubnav();
    document.body.classList.add('ciq-home-sub-today');
    window.CIQ_CALENDAR = {
      addEvent: addEvent,
      removeEvent: removeEvent,
      selectDay: selectDay,
      reload: function () { renderGrid(); renderDetail(); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 100);
})();
