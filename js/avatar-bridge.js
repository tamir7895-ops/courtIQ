/* ============================================================
   AVATAR BRIDGE — /js/avatar-bridge.js
   DiceBear-only avatar rendering. Replaces the old THREE.js system.
   All consumers use AvatarBridge.render / renderMini.
   ============================================================ */
(function () {
  'use strict';

  var DICEBEAR_BASE = 'https://api.dicebear.com/9.x/avataaars/png';

  /* ── Get avatar URL from localStorage or build default ────── */
  function getAvatarUrl(avatarData, size) {
    size = size || 128;

    // 1. Saved DiceBear URL from customizer
    var savedUrl = localStorage.getItem('courtiq_avatar_url');
    if (savedUrl) return savedUrl.replace(/size=\d+/, 'size=' + size);

    // 2. Saved in onboarding data
    try {
      var ob = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}');
      if (ob.dicebear_avatar_url) return ob.dicebear_avatar_url.replace(/size=\d+/, 'size=' + size);
    } catch (e) { /* silent */ }

    // 3. Build from avatarData object (legacy format from onboarding)
    if (avatarData && typeof avatarData === 'object') {
      var params = ['size=' + size];
      if (avatarData.skinTone) params.push('skinColor=' + avatarData.skinTone);
      if (avatarData.hairStyle) params.push('top=' + avatarData.hairStyle);
      if (avatarData.hairColor) params.push('hairColor=' + avatarData.hairColor);
      return DICEBEAR_BASE + '?' + params.join('&');
    }

    // 4. Default avatar with seed from user
    var seed = 'courtiq-default';
    if (window.currentUser && window.currentUser.email) {
      seed = window.currentUser.email;
    }
    return DICEBEAR_BASE + '?size=' + size + '&seed=' + encodeURIComponent(seed);
  }

  /* ── Get cached data URL if available ────────────────────── */
  function getCachedDataUrl() {
    try {
      var c = JSON.parse(localStorage.getItem('courtiq_avatar_cache') || 'null');
      if (c && c.dataUrl) return c.dataUrl;
    } catch (e) { /* silent */ }
    return null;
  }

  /* ── Create an <img> element for the avatar ─────────────── */
  function createAvatarImg(avatarData, size, borderRadius) {
    var img = document.createElement('img');
    var cached = getCachedDataUrl();
    img.src = cached || getAvatarUrl(avatarData, size);
    img.alt = 'Player Avatar';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = borderRadius || '50%';
    img.loading = 'lazy';
    img.onerror = function () {
      // Fallback to initials if DiceBear fails
      img.style.display = 'none';
    };
    return img;
  }

  /* ── Render full avatar into container ──────────────────── */
  function render(container, avatarData, opts) {
    if (!container) return;
    opts = opts || {};
    while (container.firstChild) container.removeChild(container.firstChild);

    var size = Math.max(opts.width || 200, opts.height || 200);
    var img = createAvatarImg(avatarData, size, opts.borderRadius || '16px');
    img.style.cursor = 'pointer';
    img.title = 'Click to customize avatar';
    img.addEventListener('click', function () {
      if (typeof AvatarCustomizer !== 'undefined') AvatarCustomizer.open();
    });
    container.appendChild(img);
  }

  /* ── Render mini avatar (sidebar, topbar) ──────────────── */
  function renderMini(container, avatarData) {
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    var img = createAvatarImg(avatarData, 64, '50%');
    container.appendChild(img);
  }

  /* ── Update (re-render with new data) ──────────────────── */
  function update(container, avatarData) {
    if (!container) return;
    var img = container.querySelector('img');
    if (img) {
      img.src = getAvatarUrl(avatarData, 200);
    } else {
      render(container, avatarData);
    }
  }

  /* ── Dispose (no-op for DiceBear, kept for API compat) ─── */
  function dispose(container) {
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);
  }

  window.AvatarBridge = {
    render: render,
    renderMini: renderMini,
    update: update,
    dispose: dispose,
    getAvatarUrl: getAvatarUrl
  };
  if (typeof CourtIQ !== 'undefined') CourtIQ.register('AvatarBridge', window.AvatarBridge);
})();
