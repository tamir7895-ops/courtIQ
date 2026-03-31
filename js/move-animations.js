/* ============================================================
   MOVE ANIMATIONS — /js/move-animations.js
   Thin wrapper mapping Pro Move IDs to existing DrillAnimations
   animation types. No new animation logic — reuses the canvas
   court + player/ball system from drill-animations.js.
   ============================================================ */
(function () {
  'use strict';

  var MOVE_ANIM_MAP = {
    'move_stepback_01':  'stepback',
    'move_crossover_01': 'crossover',
    'move_fadeaway_01':  'post_fade',
    'move_eurostep_01':  'eurostep',
    'move_pullup_01':    'pullup'
  };

  function playOnCanvas(canvas, moveId) {
    if (!canvas || typeof DrillAnimations === 'undefined') return null;
    var animType = MOVE_ANIM_MAP[moveId] || 'spot_shoot';
    return DrillAnimations.createAnimation(canvas, animType);
  }

  function stop(canvas) {
    if (typeof DrillAnimations !== 'undefined') {
      DrillAnimations.stopAnimation(canvas);
    }
  }

  window.MoveAnimations = {
    playOnCanvas: playOnCanvas,
    stop: stop,
    MOVE_ANIM_MAP: MOVE_ANIM_MAP
  };
})();
