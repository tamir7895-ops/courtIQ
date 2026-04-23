/* CourtIQ UI v2 — Home tab module
 *
 * When COURTIQ_UI_V2.HOME_TAB is true AND the shell has activated:
 *   1. Injects #ciq-home-screen into the main dashboard area.
 *   2. Syncs real-time values from the legacy #db-panel-home hooks
 *      (player name, XP rank, XP progress, streak, sessions) into
 *      the new screen — so whatever dashboard.js / streak.js /
 *      supabase updates, the v2 view reflects it too.
 *   3. Wires Start / Edit Profile / Share / sub-nav clicks onto
 *      existing global handlers (dbSwitchTab, openProfileEditor,
 *      etc.) so no feature is lost.
 *
 * Rollback: set HOME_TAB = false in config.js and reload.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.HOME_TAB) return;

  var SUB_TABS = [
    { id: 'today',         legacy: 'home',          label: 'Today' },
    { id: 'log',           legacy: 'log',           label: 'Log' },
    { id: 'history',       legacy: 'history',       label: 'History' },
    { id: 'calendar',      legacy: 'calendar',      label: 'Calendar' },
    { id: 'notifications', legacy: 'notifications', label: 'Alerts' }
  ];

  var AVATAR_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0" stop-color="#2a2420"/>'
    + '<stop offset="1" stop-color="#0c0d0f"/>'
    + '</linearGradient></defs>'
    + '<circle cx="50" cy="50" r="50" fill="url(#g)"/>'
    + '<circle cx="50" cy="38" r="13" fill="#f0ede6"/>'
    + '<path d="M22 92 C22 72, 34 62, 50 62 C66 62, 78 72, 78 92 Z" fill="#f0ede6"/>'
    + '</svg>'
  );

  function ICON_BOLT() {
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
  }
  function ICON_FLAME() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
  }

  function buildScreen() {
    var host = document.createElement('section');
    host.id = 'ciq-home-screen';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Home');

    host.innerHTML = ''
      + subNavHTML()
      + heroHTML()
      + levelHTML()
      + challengeHTML()
      + insightHTML();

    return host;
  }

  function subNavHTML() {
    var buttons = SUB_TABS.map(function (t, i) {
      var cls = (i === 0) ? 'active' : '';
      return '<button type="button" class="' + cls + '" data-ciq-subtab="' + t.id + '" data-ciq-legacy="' + t.legacy + '">' + t.label + '</button>';
    }).join('');
    return '<nav class="ciq-home-subnav" aria-label="Home sections">' + buttons + '</nav>';
  }

  function heroHTML() {
    return ''
      + '<section class="ciq-home-hero">'
      +   '<div class="ciq-home-hero-body">'
      +     '<span class="ciq-home-hero-badge">★ ELITE MEMBER</span>'
      +     '<div>'
      +       '<div class="ciq-home-hero-name" data-ciq-slot="name">—</div>'
      +       '<div class="ciq-home-hero-meta" data-ciq-slot="meta">POINT GUARD</div>'
      +     '</div>'
      +     '<div class="ciq-home-hero-actions">'
      +       '<button class="btn-edit" data-ciq-action="edit-profile">Edit Profile</button>'
      +       '<button class="btn-share" data-ciq-action="share">Share</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="ciq-home-hero-avatar"><img data-ciq-slot="avatar" alt="avatar" src="' + AVATAR_FALLBACK + '"/></div>'
      + '</section>';
  }

  function levelHTML() {
    return ''
      + '<section class="ciq-home-level">'
      +   '<div class="ciq-home-level-icon">' + ICON_BOLT() + '</div>'
      +   '<div class="ciq-home-level-body">'
      +     '<div class="ciq-home-level-head">'
      +       '<span class="ciq-home-level-rank" data-ciq-slot="rank">—</span>'
      +       '<span class="ciq-home-level-xp" data-ciq-slot="xp">0 / 0 XP</span>'
      +     '</div>'
      +     '<div class="ciq-home-level-bar"><span data-ciq-slot="xp-bar" style="width:0%"></span></div>'
      +   '</div>'
      +   '<div class="ciq-home-streak">'
      +     '<div class="ciq-home-streak-val"><span data-ciq-slot="streak">0</span>' + ICON_FLAME() + '</div>'
      +     '<div class="ciq-home-streak-lbl">Streak</div>'
      +   '</div>'
      + '</section>';
  }

  function challengeHTML() {
    return ''
      + '<section class="ciq-home-challenge">'
      +   '<div class="ciq-home-challenge-eyebrow">● Daily Challenge</div>'
      +   '<div class="ciq-home-challenge-title" data-ciq-slot="challenge-title">Log a Full Shooting Session</div>'
      +   '<div class="ciq-home-challenge-sub" data-ciq-slot="challenge-sub">+150 XP &middot; New Record Unlock</div>'
      +   '<div class="ciq-home-challenge-cta"><button class="ciq-home-btn-primary" data-ciq-action="start-challenge">Start</button></div>'
      + '</section>';
  }

  function insightHTML() {
    return ''
      + '<section class="ciq-home-insight">'
      +   '<div class="eyebrow">Performance Insight</div>'
      +   '<h2 class="ciq-home-insight-title">On the Rise</h2>'
      +   '<p class="ciq-home-insight-text">Your shooting accuracy is trending up. Keep the routine consistent — every session makes the curve steeper.</p>'
      +   '<div class="ciq-home-stats">'
      +     '<div class="tile"><div class="lbl">Sessions</div><div class="val" data-ciq-slot="sessions">0</div></div>'
      +     '<div class="tile"><div class="lbl">Shooting %</div><div class="val accent" data-ciq-slot="shooting-pct">—</div></div>'
      +   '</div>'
      + '</section>';
  }

  /* ─── Data sync from legacy #db-panel-home ─────────────── */
  function textOf(sel) {
    var el = document.querySelector(sel);
    return el ? (el.textContent || '').trim() : '';
  }
  function widthOf(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    return el.style && el.style.width ? el.style.width : null;
  }
  function setSlot(host, slot, value) {
    var el = host.querySelector('[data-ciq-slot="' + slot + '"]');
    if (!el) return;
    if (el.tagName === 'IMG') { el.src = value || AVATAR_FALLBACK; return; }
    if (slot === 'xp-bar') { el.style.width = value || '0%'; return; }
    el.textContent = value || '';
  }

  function syncFromLegacy(host) {
    var name = textOf('#ke-player-name');
    if (name) setSlot(host, 'name', name);

    var rank = textOf('#xp-rank');
    if (rank) setSlot(host, 'rank', rank + ' · LVL');

    var xp = textOf('#xp-numbers');
    if (xp) setSlot(host, 'xp', xp.replace(/\s+/g, ' '));

    var w = widthOf('#xp-bar-fill');
    if (w) setSlot(host, 'xp-bar', w);

    var streak = textOf('#ks-home-streak');
    if (streak) setSlot(host, 'streak', streak);

    var sessions = textOf('#ks-home-sessions');
    if (sessions) setSlot(host, 'sessions', sessions);

    var avatar = document.getElementById('ks-header-avatar-img');
    if (avatar && avatar.getAttribute('src')) setSlot(host, 'avatar', avatar.getAttribute('src'));
  }

  function wireActions(host) {
    host.addEventListener('click', function (e) {
      var t = e.target.closest('[data-ciq-action], [data-ciq-subtab]');
      if (!t) return;

      var sub = t.getAttribute('data-ciq-subtab');
      if (sub) {
        host.querySelectorAll('.ciq-home-subnav button').forEach(function (b) { b.classList.toggle('active', b === t); });
        var legacy = t.getAttribute('data-ciq-legacy');
        // "today" stays on the home screen — no panel change needed
        if (legacy && legacy !== 'home' && typeof window.dbSwitchTab === 'function') {
          window.dbSwitchTab(legacy);
        }
        return;
      }

      var act = t.getAttribute('data-ciq-action');
      if (act === 'start-challenge') {
        if (typeof window.dbSwitchTab === 'function') window.dbSwitchTab('training');
      } else if (act === 'edit-profile') {
        if (typeof window.dbSwitchTab === 'function') window.dbSwitchTab('archetype');
      } else if (act === 'share') {
        if (navigator.share) {
          navigator.share({ title: 'CourtIQ', url: location.href }).catch(function () {});
        }
      }
    });
  }

  function init() {
    var main = document.querySelector('.db-main-inner, #db-main-inner, .db-main, main');
    if (!main) {
      console.warn('[ciq-home] main container not found; skipping');
      return;
    }

    var host = buildScreen();
    main.appendChild(host);
    wireActions(host);

    // Initial sync — legacy values may not be populated yet
    syncFromLegacy(host);
    setTimeout(function () { syncFromLegacy(host); }, 400);
    setTimeout(function () { syncFromLegacy(host); }, 1500);

    // Keep synced whenever the legacy data nodes mutate
    var legacyPanel = document.getElementById('db-panel-home');
    if (legacyPanel && 'MutationObserver' in window) {
      var mo = new MutationObserver(function () { syncFromLegacy(host); });
      mo.observe(legacyPanel, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'src'] });
    }

    // Mark body so CSS knows v2 home is enabled (shown only when shell routes to .ciq-tab-home)
    document.body.classList.add('ciq-v2-home');

    // Expose for manual testing in console
    window.CIQ_HOME = { host: host, syncNow: function () { syncFromLegacy(host); } };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
