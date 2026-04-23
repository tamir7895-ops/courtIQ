/* CourtIQ UI v2 — Me tab module (teal accent).
 *
 * When COURTIQ_UI_V2.ME_TAB is true:
 *   1. Injects #ciq-me-screen above the dashboard main.
 *   2. Syncs name/position/bio/avatar from #db-panel-archetype hooks.
 *   3. Syncs 3 stats (Sessions, Avg Shots Made, Field Goal %).
 *   4. Sub-nav chips — Profile (stay) / Social / Shop → dbSwitchTab.
 *
 * Notes:
 *   - The legacy 3D avatar canvas stays in #db-panel-archetype (hidden
 *     while v2-me is active). Three.js still runs but renders off-screen.
 *   - Trophy case values are static placeholders here; badges.js writes
 *     to DOM IDs that could be wired in a later pass.
 *
 * No changes to player-profile.js, avatar-*.js, social-hub.js, badges.js.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.ME_TAB) return;

  var SUB_TABS = [
    { id: 'profile', legacy: 'archetype', label: 'Profile' },
    { id: 'social',  legacy: 'social',    label: 'Social' },
    { id: 'shop',    legacy: 'shop',      label: 'Shop' }
  ];

  var TROPHIES = [
    { n: 'First',     e: '🏆' },
    { n: 'Dedicated', e: '💪' },
    { n: 'Sniper',    e: '🎯' },
    { n: 'All-Star',  e: '⭐' }
  ];

  function ICON_TROPHY() {
    return '<svg viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';
  }
  function ICON_MAIL() {
    return '<svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
  }

  function buildScreen() {
    var host = document.createElement('section');
    host.id = 'ciq-me-screen';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Me');

    var subButtons = SUB_TABS.map(function (t, i) {
      return '<button type="button" class="' + (i === 0 ? 'active' : '') + '" data-ciq-subtab="' + t.id + '" data-ciq-legacy="' + t.legacy + '">' + t.label + '</button>';
    }).join('');

    var trophyHTML = TROPHIES.map(function (t, i) {
      var earned = i < 2; // first two unlocked as a demo; badges.js can update this later
      return '<div class="ciq-me-trophy ' + (earned ? 'earned' : '') + '">'
        + '<div class="emoji">' + (earned ? t.e : '🔒') + '</div>'
        + '<div class="n">' + t.n + '</div>'
        + '</div>';
    }).join('');

    host.innerHTML = ''
      + '<nav class="ciq-me-subnav" aria-label="Me sections">' + subButtons + '</nav>'
      + '<div class="ciq-me-hero">'
      +   '<div class="ciq-me-avatar"><img data-ciq-slot="avatar" alt="avatar"/></div>'
      +   '<div class="ciq-me-id">'
      +     '<div class="ciq-me-position" data-ciq-slot="position">POINT GUARD</div>'
      +     '<div class="ciq-me-name" data-ciq-slot="name">Player</div>'
      +     '<div class="ciq-me-bio" data-ciq-slot="bio">Complete onboarding to personalise your profile.</div>'
      +   '</div>'
      + '</div>'

      + '<div class="ciq-me-stats">'
      +   '<div class="ciq-me-stat"><div class="lbl">Sessions Logged</div><div class="val" data-ciq-slot="s1">—</div></div>'
      +   '<div class="ciq-me-stat"><div class="lbl">Avg Shots Made</div><div class="val" data-ciq-slot="s2">—</div></div>'
      +   '<div class="ciq-me-stat"><div class="lbl">Field Goal %</div><div class="val accent" data-ciq-slot="s3">—</div></div>'
      + '</div>'

      + '<div class="ciq-me-section-head">' + ICON_TROPHY() + '<div class="eyebrow">Trophy Case</div></div>'
      + '<div class="ciq-me-trophies">' + trophyHTML + '</div>'

      + '<div class="ciq-me-section-head"><div class="eyebrow">Account</div></div>'
      + '<div class="ciq-me-account">'
      +   '<div class="ciq-me-account-icon">' + ICON_MAIL() + '</div>'
      +   '<div class="ciq-me-account-body">'
      +     '<div class="ciq-me-account-lbl">Email Address</div>'
      +     '<div class="ciq-me-account-val" data-ciq-slot="email">—</div>'
      +   '</div>'
      +   '<div class="ciq-me-chev">›</div>'
      + '</div>';

    return host;
  }

  function textOf(sel) { var el = document.querySelector(sel); return el ? (el.textContent || '').trim() : ''; }
  function setSlot(host, slot, value) {
    var el = host.querySelector('[data-ciq-slot="' + slot + '"]');
    if (!el) return;
    if (el.tagName === 'IMG') { if (value) el.src = value; return; }
    if (value) el.textContent = value;
  }

  function syncFromLegacy(host) {
    var name = textOf('#ks-profile-full-name');
    if (name) setSlot(host, 'name', name);

    var pos = textOf('#ks-profile-position-tag');
    if (pos) setSlot(host, 'position', pos);

    var bio = textOf('#ks-profile-bio');
    if (bio) setSlot(host, 'bio', bio);

    var avatar = document.getElementById('ks-profile-avatar-img');
    if (avatar && avatar.getAttribute('src')) setSlot(host, 'avatar', avatar.getAttribute('src'));

    var s1 = textOf('#prof-stat1-val'); if (s1) setSlot(host, 's1', s1);
    var s2 = textOf('#prof-stat2-val'); if (s2) setSlot(host, 's2', s2);
    var s3 = textOf('#prof-stat3-val'); if (s3) setSlot(host, 's3', s3);

    // Email from global auth state (Supabase exposes via sb / supabase on window)
    try {
      var email = (window.sb && window.sb.auth && window.sb.auth.session && window.sb.auth.session().user && window.sb.auth.session().user.email)
        || (window.currentUser && window.currentUser.email)
        || '';
      if (email) setSlot(host, 'email', email);
    } catch (e) { /* silent */ }
  }

  function wireActions(host) {
    host.addEventListener('click', function (e) {
      var t = e.target.closest('[data-ciq-subtab]');
      if (!t) return;
      host.querySelectorAll('.ciq-me-subnav button').forEach(function (b) { b.classList.toggle('active', b === t); });
      var legacy = t.getAttribute('data-ciq-legacy');
      if (legacy && legacy !== 'archetype' && typeof window.dbSwitchTab === 'function') {
        window.dbSwitchTab(legacy);
      }
    });
  }

  function init() {
    var main = document.querySelector('.db-main-inner, #db-main-inner, .db-main, main');
    if (!main) {
      console.warn('[ciq-me] main container not found; skipping');
      return;
    }

    var host = buildScreen();
    main.appendChild(host);
    wireActions(host);

    syncFromLegacy(host);
    setTimeout(function () { syncFromLegacy(host); }, 400);
    setTimeout(function () { syncFromLegacy(host); }, 1500);

    var legacyPanel = document.getElementById('db-panel-archetype');
    if (legacyPanel && 'MutationObserver' in window) {
      var mo = new MutationObserver(function () { syncFromLegacy(host); });
      mo.observe(legacyPanel, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['src'] });
    }

    document.body.classList.add('ciq-v2-me');

    window.CIQ_ME = { host: host, syncNow: function () { syncFromLegacy(host); } };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
