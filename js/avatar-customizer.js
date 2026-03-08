/* ============================================================
   AVATAR CUSTOMIZER — /js/avatar-customizer.js
   Modal overlay for full avatar editing from the dashboard.
   Reads AvatarBuilder.CONFIG for options, checks AvatarShop
   for ownership of premium items.
   ============================================================ */
(function () {
  'use strict';

  var overlay, container, controlsEl;
  var tempCfg = {};   // working copy while editing
  var savedCfg = {};  // snapshot to revert on cancel

  /* ── Helpers ─────────────────────────────────────────────── */
  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function getOnboarding() {
    try { return JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}'); }
    catch (e) { return {}; }
  }

  /* ── Open Modal ─────────────────────────────────────────── */
  function open() {
    overlay = document.getElementById('ac-overlay');
    canvas = document.getElementById('ac-avatar-canvas');
    controlsEl = document.getElementById('ac-controls');
    if (!overlay) return;

    // Load current avatar config
    var ob = getOnboarding();
    var avatar = ob.avatar || {};
    var d = AvatarBuilder.defaults;

    savedCfg = {
      skinTone:   avatar.skinTone   || d.skinTone,
      hairStyle:  avatar.hairStyle  || d.hairStyle,
      hairColor:  avatar.hairColor  || d.hairColor,
      beardStyle: avatar.beardStyle || d.beardStyle,
      bodyType:   avatar.bodyType   || d.bodyType,
      accessory:  avatar.accessory  || 'none'
    };
    tempCfg = JSON.parse(JSON.stringify(savedCfg));

    renderControls();
    redraw();

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /* ── Render Pickers Dynamically ─────────────────────────── */
  function renderControls() {
    var C = AvatarBuilder.CONFIG;
    var html = '';

    // 1. Skin Tone — always free
    html += pickerGroup('🎨 Skin Tone', renderSwatches(C.skinTones, 'skinTone', tempCfg.skinTone));

    // 2. Hair Style — some shop-locked
    html += pickerGroup('✂️ Hair Style', renderStyleBtns(C.hairStyles, 'hairStyle', tempCfg.hairStyle, 'hair'));

    // 3. Hair Color — always free
    html += pickerGroup('🎨 Hair Color', renderSwatches(C.hairColors, 'hairColor', tempCfg.hairColor));

    // 4. Beard — some shop-locked
    html += pickerGroup('🧔 Beard', renderStyleBtns(C.beardStyles, 'beardStyle', tempCfg.beardStyle, 'beard'));

    // 5. Body Type — always free
    html += pickerGroup('💪 Body Type', renderStyleBtns(C.bodyTypes, 'bodyType', tempCfg.bodyType, null));

    // 6. Accessories — most shop-locked
    html += pickerGroup('🎽 Accessories', renderStyleBtns(C.accessories, 'accessory', tempCfg.accessory, 'accessory'));

    controlsEl.innerHTML = html;
    wireEvents();
  }

  function pickerGroup(label, innerHtml) {
    return '<div class="ac-picker-group">' +
      '<div class="ac-picker-label">' + label + '</div>' +
      '<div class="ac-picker-row">' + innerHtml + '</div>' +
    '</div>';
  }

  /* Color swatches (skin tone, hair color) — always unlocked */
  function renderSwatches(items, group, currentVal) {
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var sel = (item.color === currentVal) ? ' selected' : '';
      html += '<div class="ac-swatch' + sel + '" data-picker="' + group +
        '" data-value="' + item.color + '" style="background:' + item.color +
        '" title="' + item.name + '"></div>';
    }
    return html;
  }

  /* Style buttons — check ownership for shop-gated items */
  function renderStyleBtns(items, group, currentVal, shopType) {
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var itemId = (typeof items[i] === 'string') ? items[i] : items[i].id;
      var label = capitalize(itemId);
      var sel = (itemId === currentVal) ? ' selected' : '';
      var locked = false;

      // Check shop ownership
      if (shopType && typeof AvatarShop !== 'undefined' && AvatarShop.isFreeItem && AvatarShop.isOwned) {
        var isFree = AvatarShop.isFreeItem(shopType, itemId);
        var isOwned = AvatarShop.isOwned(itemId);
        if (!isFree && !isOwned) locked = true;
      }

      var cls = 'ac-style-btn' + sel + (locked ? ' ac-style-btn--locked' : '');
      html += '<button class="' + cls + '" data-picker="' + group +
        '" data-value="' + itemId + '"' +
        (locked ? ' data-locked="true" title="Buy in Shop to unlock"' : '') +
        ' type="button">' + label + '</button>';
    }
    return html;
  }

  /* ── Wire Click Events ──────────────────────────────────── */
  function wireEvents() {
    // Swatches
    var swatches = controlsEl.querySelectorAll('.ac-swatch');
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].addEventListener('click', handleSwatchClick);
    }
    // Style buttons
    var btns = controlsEl.querySelectorAll('.ac-style-btn');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', handleBtnClick);
    }
  }

  function handleSwatchClick() {
    var group = this.dataset.picker;
    var siblings = controlsEl.querySelectorAll('.ac-swatch[data-picker="' + group + '"]');
    for (var i = 0; i < siblings.length; i++) siblings[i].classList.remove('selected');
    this.classList.add('selected');
    tempCfg[group] = this.dataset.value;
    redraw();
  }

  function handleBtnClick() {
    if (this.dataset.locked === 'true') {
      if (typeof showToast === 'function') showToast('Unlock in the Avatar Shop first', true);
      return;
    }
    var group = this.dataset.picker;
    var siblings = controlsEl.querySelectorAll('.ac-style-btn[data-picker="' + group + '"]');
    for (var i = 0; i < siblings.length; i++) siblings[i].classList.remove('selected');
    this.classList.add('selected');
    tempCfg[group] = this.dataset.value;
    redraw();
  }

  /* ── Live Preview ───────────────────────────────────────── */
  function redraw() {
    if (!canvas || typeof AvatarBuilder === 'undefined') return;
    var ob = getOnboarding();
    var drawCfg = JSON.parse(JSON.stringify(tempCfg));
    drawCfg.position = ob.position || 'SG';
    AvatarBuilder.draw(canvas, drawCfg);
  }

  /* ── Save ───────────────────────────────────────────────── */
  function save() {
    try {
      var ob = getOnboarding();
      ob.avatar = JSON.parse(JSON.stringify(tempCfg));
      localStorage.setItem('courtiq-onboarding-data', JSON.stringify(ob));
    } catch (e) { /* silent */ }

    // Re-render mini avatar everywhere
    if (typeof PlayerProfile !== 'undefined' && PlayerProfile.renderSummary) {
      PlayerProfile.renderSummary();
    }
    // Re-render shop preview if visible
    var shopCanvas = document.getElementById('shop-avatar-preview');
    if (shopCanvas && typeof AvatarBuilder !== 'undefined') {
      var ob2 = getOnboarding();
      if (ob2.avatar) AvatarBuilder.draw(shopCanvas, Object.assign({}, ob2.avatar, { position: ob2.position || 'SG' }));
    }

    close();
    if (typeof showToast === 'function') showToast('Avatar updated!');
  }

  /* ── Cancel ─────────────────────────────────────────────── */
  function cancel() {
    tempCfg = JSON.parse(JSON.stringify(savedCfg));
    close();
  }

  /* ── Close ──────────────────────────────────────────────── */
  function close() {
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    // Button wiring via delegation
    document.addEventListener('click', function (e) {
      if (e.target.id === 'ac-close' || e.target.id === 'ac-cancel') { cancel(); return; }
      if (e.target.id === 'ac-save') { save(); return; }
      // Backdrop click
      if (e.target.id === 'ac-overlay') { cancel(); return; }
    });

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var ov = document.getElementById('ac-overlay');
        if (ov && ov.classList.contains('active')) cancel();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AvatarCustomizer = {
    open: open,
    close: close
  };
})();
