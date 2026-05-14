/* CourtIQ UI v2 — Recent Sessions detail (8.7)
 *
 * Reads from window.DataService.getShotSessions(limit) — Supabase
 * 'shot_sessions' table — and renders a tap-to-expand list. Each row
 * shows date, FG%, total attempts. Expanded view shows a 3-tile
 * breakdown (FG / 3PT / FT) with made/attempts ratios.
 *
 * Replaces the empty "Log your first session..." placeholder in the
 * Track tab. If no auth/no data, shows a friendly empty state.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRACK_SESSIONS) return;

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + ' ' + d.getDate();
    } catch (e) { return '—'; }
  }
  function fmtRel(iso) {
    try {
      var d = new Date(iso).getTime();
      var diff = Date.now() - d;
      var min = Math.floor(diff / 60000);
      if (min < 1)  return 'just now';
      if (min < 60) return min + 'm ago';
      var hr = Math.floor(min / 60);
      if (hr < 24)  return hr + 'h ago';
      var dy = Math.floor(hr / 24);
      if (dy < 7)   return dy + 'd ago';
      var wk = Math.floor(dy / 7);
      if (wk < 5)   return wk + 'w ago';
      return Math.floor(dy / 30) + 'mo ago';
    } catch (e) { return ''; }
  }

  function pct(made, miss) {
    var att = (made || 0) + (miss || 0);
    if (att === 0) return null;
    return Math.round((made / att) * 100);
  }

  function buildTile(label, made, miss) {
    var t = el('div', 'ciq-session-tile');
    var l = el('div', 'lbl', label);
    var p = pct(made, miss);
    var v = el('div', 'val', p == null ? '—' : (p + '%'));
    var r = el('div', 'ratio', (made || 0) + '/' + ((made || 0) + (miss || 0)));
    t.appendChild(l);
    t.appendChild(v);
    t.appendChild(r);
    return t;
  }

  function buildRow(s) {
    var row = el('div', 'ciq-session-row');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    var head = el('div', 'ciq-session-row-head');

    var dateBlock = el('div');
    var d = el('div', 'ciq-session-date', fmtDate(s.session_date));
    var rel = el('div', 'ciq-session-rel', fmtRel(s.session_date));
    dateBlock.appendChild(d);
    dateBlock.appendChild(rel);
    head.appendChild(dateBlock);

    head.appendChild(el('div', 'ciq-session-spacer'));

    var totalMade = (s.fg_made || 0) + (s.three_made || 0) + (s.ft_made || 0);
    var totalAtt  = totalMade + (s.fg_missed || 0) + (s.three_missed || 0) + (s.ft_missed || 0);
    var totalPct  = totalAtt > 0 ? Math.round((totalMade / totalAtt) * 100) : null;

    /* Classify the row's accent bar by performance band */
    if (totalPct != null) {
      if (totalPct >= 50) row.classList.add('hot');
      else if (totalPct >= 30) row.classList.add('warm');
      else row.classList.add('cold');
    }

    var pctBlock = el('div', 'ciq-session-pct-wrap');
    var pctEl = el('div', 'ciq-session-pct', totalPct == null ? '—' : (totalPct + '%'));
    var attEl = el('div', 'ciq-session-attempts', totalMade + '/' + totalAtt + ' shots');
    pctBlock.appendChild(pctEl);
    pctBlock.appendChild(attEl);
    head.appendChild(pctBlock);

    row.appendChild(head);

    var detail = el('div', 'ciq-session-detail');
    detail.appendChild(buildTile('FG',  s.fg_made,    s.fg_missed));
    detail.appendChild(buildTile('3PT', s.three_made, s.three_missed));
    detail.appendChild(buildTile('FT',  s.ft_made,    s.ft_missed));
    row.appendChild(detail);

    var toggle = function () { row.classList.toggle('expanded'); };
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    return row;
  }

  function renderList(list, sessions) {
    clear(list);
    if (!sessions || !sessions.length) {
      if (window.TPL && window.TPL.emptyState) {
        list.appendChild(window.TPL.emptyState({
          iconName: 'statFg',
          title: 'Your first session.',
          sub: 'Tap Launch Camera or Upload Video. Every made and missed shot lands here as a row you can replay.'
        }));
      } else {
        var empty = el('div', 'ciq-empty');
        empty.appendChild(el('div', 'ciq-empty-title', 'Your first session.'));
        list.appendChild(empty);
      }
      return;
    }
    sessions.forEach(function (s) { list.appendChild(buildRow(s)); });
  }

  function fetchAndRender(list) {
    clear(list);
    list.appendChild(el('div', 'ciq-sessions-loading', 'Loading sessions…'));
    if (!window.DataService || typeof window.DataService.getShotSessions !== 'function' || !window.currentUser) {
      renderList(list, []);
      return;
    }
    window.DataService.getShotSessions(8)
      .then(function (rows) { renderList(list, rows); })
      .catch(function () { renderList(list, []); });
  }

  function mount(screen) {
    if (screen.querySelector('.ciq-sessions-block')) return;

    var block = el('section', 'ciq-sessions-block');
    block.setAttribute('aria-label', 'Recent Sessions');

    var head = el('div', 'ciq-sessions-head');
    var eb = el('div', 'eyebrow', 'Recent Sessions');
    var more = el('button', 'more', 'Refresh');
    more.type = 'button';
    head.appendChild(eb);
    head.appendChild(more);
    block.appendChild(head);

    var list = el('div', 'ciq-session-list');
    block.appendChild(list);

    // Suppress legacy placeholder
    var legacySection = screen.querySelector('.ciq-track-section');
    if (legacySection) legacySection.style.display = 'none';

    screen.appendChild(block);

    more.addEventListener('click', function () { fetchAndRender(list); });
    fetchAndRender(list);

    window.CIQ_SESSIONS = { reload: function () { fetchAndRender(list); } };
  }

  function init() {
    var screen = document.getElementById('ciq-track-screen');
    if (!screen) {
      setTimeout(init, 200);
      return;
    }
    mount(screen);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
