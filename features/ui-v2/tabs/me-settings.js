/* CourtIQ UI v2 — Me Settings sheet (8.3)
 *
 * Surfaces a bottom-sheet with: email (read-only), Sign Out button,
 * "More coming soon" placeholder. Triggered by tapping the Account row
 * inside #ciq-me-screen.
 *
 * Reuses the global Supabase client (`window.sb`) for sign-out.
 * No new auth logic; signOut() then redirects to /index.html.
 *
 * All DOM construction uses createElement + textContent. SVG icons are
 * built declaratively from path strings using createElementNS — no
 * innerHTML anywhere — so there is no XSS surface.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.ME_SETTINGS) return;

  /* Icons — sourced from the global ICONS module (Phase 10 foundation). */
  function appendIcon(host, name) {
    var wrap = document.createElement('div');
    wrap.className = 'ciq-settings-icon';
    if (window.ICONS && window.ICONS[name]) {
      wrap.appendChild(window.ICONS[name]({ size: 16 }));
    }
    host.appendChild(wrap);
  }

  function buildSheet() {
    var backdrop = document.createElement('div');
    backdrop.id = 'ciq-settings-backdrop';
    backdrop.addEventListener('click', closeSheet);

    var sheet = document.createElement('div');
    sheet.id = 'ciq-settings-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'ciq-settings-heading');

    var grab = document.createElement('div');
    grab.className = 'ciq-settings-grabber';
    sheet.appendChild(grab);

    var header = document.createElement('div');
    header.className = 'ciq-settings-header';

    var headLeft = document.createElement('div');
    var eyebrow = document.createElement('div');
    eyebrow.className = 'ciq-settings-eyebrow';
    eyebrow.textContent = 'Account';
    var title = document.createElement('h2');
    title.id = 'ciq-settings-heading';
    title.className = 'ciq-settings-title';
    title.textContent = 'Settings.';
    headLeft.appendChild(eyebrow);
    headLeft.appendChild(title);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ciq-settings-close';
    closeBtn.setAttribute('aria-label', 'Close settings');
    closeBtn.textContent = '×'; // ×
    closeBtn.addEventListener('click', closeSheet);

    header.appendChild(headLeft);
    header.appendChild(closeBtn);
    sheet.appendChild(header);

    sheet.appendChild(buildEmailRow());
    sheet.appendChild(buildLogoutRow());
    sheet.appendChild(buildInfoNote());

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
  }

  function buildEmailRow() {
    var row = document.createElement('div');
    row.className = 'ciq-settings-row readonly';
    appendIcon(row, 'mail');

    var body = document.createElement('div');
    body.className = 'ciq-settings-body';
    var lbl = document.createElement('div');
    lbl.className = 'ciq-settings-lbl';
    lbl.textContent = 'Email Address';
    var val = document.createElement('div');
    val.className = 'ciq-settings-val';
    val.id = 'ciq-settings-email';
    val.textContent = '—'; // —
    body.appendChild(lbl);
    body.appendChild(val);
    row.appendChild(body);
    return row;
  }

  function buildLogoutRow() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ciq-settings-row danger';
    btn.setAttribute('data-ciq-action', 'sign-out');
    appendIcon(btn, 'logout');

    var body = document.createElement('div');
    body.className = 'ciq-settings-body';
    var lbl = document.createElement('div');
    lbl.className = 'ciq-settings-lbl';
    lbl.textContent = 'Session';
    var val = document.createElement('div');
    val.className = 'ciq-settings-val';
    val.textContent = 'Sign Out';
    body.appendChild(lbl);
    body.appendChild(val);
    btn.appendChild(body);

    var chev = document.createElement('div');
    chev.className = 'chev';
    chev.textContent = '›'; // ›
    btn.appendChild(chev);

    btn.addEventListener('click', signOut);
    return btn;
  }

  function buildInfoNote() {
    var note = document.createElement('div');
    note.className = 'ciq-settings-note';
    note.textContent = 'More options coming soon — security, notifications, and help center.';
    return note;
  }

  function syncEmail() {
    var emailEl = document.getElementById('ciq-settings-email');
    if (!emailEl) return;
    var email = '';
    try {
      if (window.currentUser && window.currentUser.email) email = window.currentUser.email;
      else if (window.currentSession && window.currentSession.user) email = window.currentSession.user.email || '';
      else {
        var ref = 'txnsuzlgfafjdipfqkqe';
        var raw = localStorage.getItem('sb-' + ref + '-auth-token');
        if (raw) {
          var parsed = JSON.parse(raw);
          email = (parsed && parsed.user && parsed.user.email) || '';
        }
      }
    } catch (e) { /* silent */ }
    emailEl.textContent = email || 'Unknown';
  }

  function openSheet() {
    syncEmail();
    document.body.classList.add('ciq-settings-open');
  }

  function closeSheet() {
    document.body.classList.remove('ciq-settings-open');
  }

  function signOut() {
    var goHome = function () { try { location.href = 'index.html'; } catch (e) {} };
    try {
      if (window.sb && window.sb.auth && typeof window.sb.auth.signOut === 'function') {
        var p = window.sb.auth.signOut();
        if (p && typeof p.then === 'function') {
          p.then(goHome, goHome);
          return;
        }
      }
    } catch (e) { /* fall through */ }
    goHome();
  }

  function wireAccountRow() {
    var screen = document.getElementById('ciq-me-screen');
    if (!screen) {
      setTimeout(wireAccountRow, 200);
      return;
    }
    var row = screen.querySelector('.ciq-me-account');
    if (!row) return;
    if (row.dataset.ciqWired === '1') return;
    row.dataset.ciqAction = 'open-settings';
    row.dataset.ciqWired = '1';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.addEventListener('click', openSheet);
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(); }
    });
  }

  function init() {
    buildSheet();
    wireAccountRow();

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('ciq-settings-open')) {
        closeSheet();
      }
    });

    // If me.js mounts after us, retry the wiring
    var host = document.querySelector('.db-main-inner') || document.body;
    if (host && 'MutationObserver' in window) {
      var mo = new MutationObserver(function () { wireAccountRow(); });
      mo.observe(host, { childList: true, subtree: true });
    }

    window.CIQ_SETTINGS = { open: openSheet, close: closeSheet };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
