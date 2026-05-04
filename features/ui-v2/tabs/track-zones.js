/* CourtIQ UI v2 — Zone Breakdown grid (8.6, paired with heatmap)
 * 7 zone tiles showing make %, made/attempts ratio. Tap a tile to
 * highlight the matching SVG zone.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRACK_ZONES) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var TILE_DEFS = [
    { id: 'paint',   name: 'Paint' },
    { id: 'mid-l',   name: 'Mid-Range L' },
    { id: 'top',     name: 'Top of Key' },
    { id: 'mid-r',   name: 'Mid-Range R' },
    { id: 'three-l', name: 'Three L' },
    { id: 'three-c', name: 'Three Center' },
    { id: 'three-r', name: 'Three R' }
  ];

  function mount(screen) {
    if (screen.querySelector('.ciq-zones-block')) return;
    var block = el('section', 'ciq-zones-block');
    block.setAttribute('aria-label', 'Zone Breakdown');

    var head = el('div', 'ciq-zones-head');
    head.appendChild(el('div', 'ciq-zones-eyebrow', 'Zone Breakdown'));
    head.appendChild(el('div', 'ciq-zones-hint', 'Tap to highlight'));
    block.appendChild(head);

    var grid = el('div', 'ciq-zones-grid');
    TILE_DEFS.forEach(function (t) {
      var tile = el('button', 'ciq-zone-tile');
      tile.type = 'button';
      tile.setAttribute('data-zone-id', t.id);

      var lbl = el('div', 'lbl', t.name);
      tile.appendChild(lbl);

      var val = el('div', 'val');
      var pct = el('div', 'pct', '—');
      var ratio = el('div', 'ratio', '0/0');
      val.appendChild(pct);
      val.appendChild(ratio);
      tile.appendChild(val);

      tile.addEventListener('click', function () {
        if (window.CIQ_HEATMAP && typeof window.CIQ_HEATMAP.highlightZone === 'function') {
          window.CIQ_HEATMAP.highlightZone(t.id);
        }
      });
      grid.appendChild(tile);
    });
    block.appendChild(grid);

    screen.appendChild(block);
    if (window.CIQ_HEATMAP) window.CIQ_HEATMAP.reload();
  }

  function init() {
    var screen = document.getElementById('ciq-track-screen');
    if (!screen) {
      setTimeout(init, 200);
      return;
    }
    mount(screen);
    window.CIQ_ZONES = { tiles: TILE_DEFS };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
