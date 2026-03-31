/* ============================================================
   AVATAR BRIDGE — /js/avatar-bridge.js
   Routing layer: 3D (primary) → 2D fallback if no WebGL.
   All consumers use AvatarBridge instead of AvatarBuilder directly.
   ============================================================ */
(function () {
  'use strict';

  var scenes = new Map();

  function supportsWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) {
      return false;
    }
  }

  function render(container, avatarData, opts) {
    if (!container) return;
    opts = opts || {};

    // Dispose previous scene in this container
    disposeContainer(container);

    if (supportsWebGL() && typeof Avatar3D !== 'undefined') {
      var handle = Avatar3D.create(container, avatarData, opts);
      if (handle) {
        scenes.set(container, handle);
        return;
      }
    }

    // Fallback to 2D canvas
    fallback2D(container, avatarData, opts);
  }

  function renderMini(container, avatarData) {
    if (!container) return;

    // Dispose previous
    disposeContainer(container);

    if (supportsWebGL() && typeof Avatar3D !== 'undefined') {
      var handle = Avatar3D.create(container, avatarData, {
        width: 64, height: 64,
        interactive: false,
        animate: false
      });
      if (handle) {
        scenes.set(container, handle);
        return;
      }
    }

    // Fallback: 2D mini
    if (typeof AvatarBuilder !== 'undefined' && AvatarBuilder.drawMini) {
      container.innerHTML = '';
      var canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.borderRadius = '50%';
      container.appendChild(canvas);
      AvatarBuilder.drawMini(canvas, avatarData);
    }
  }

  function update(container, avatarData) {
    if (!container) return;

    var handle = scenes.get(container);
    if (handle && typeof Avatar3D !== 'undefined') {
      Avatar3D.update(handle, avatarData);
      return;
    }

    // Fallback: find canvas and redraw 2D
    var canvas = container.querySelector('canvas');
    if (canvas && typeof AvatarBuilder !== 'undefined') {
      AvatarBuilder.draw(canvas, avatarData);
    }
  }

  function disposeContainer(container) {
    if (!container) return;
    var handle = scenes.get(container);
    if (handle && typeof Avatar3D !== 'undefined') {
      Avatar3D.dispose(handle);
      scenes.delete(container);
    }
  }

  function fallback2D(container, avatarData, opts) {
    if (typeof AvatarBuilder === 'undefined') return;
    container.innerHTML = '';
    var canvas = document.createElement('canvas');
    canvas.width = opts.width || 200;
    canvas.height = opts.height || 280;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    AvatarBuilder.draw(canvas, avatarData);
  }

  window.AvatarBridge = {
    render: render,
    renderMini: renderMini,
    update: update,
    dispose: disposeContainer,
    supportsWebGL: supportsWebGL
  };
})();
