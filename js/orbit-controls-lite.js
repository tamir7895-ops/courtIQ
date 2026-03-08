/* ============================================================
   ORBIT CONTROLS LITE — minimal drag-to-rotate for Three.js
   Horizontal rotation only, no zoom/pan.
   Registers as THREE.OrbitControls for compatibility.
   ============================================================ */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;

  function OrbitControls(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();

    this.enableZoom = false;
    this.enablePan = false;
    this.enableDamping = true;
    this.dampingFactor = 0.08;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.rotateSpeed = 1.0;

    this._spherical = new THREE.Spherical();
    this._sphericalDelta = new THREE.Spherical();
    this._isDragging = false;
    this._prevMouse = { x: 0, y: 0 };
    this._disposed = false;

    var self = this;

    // Get initial spherical from camera
    var offset = new THREE.Vector3();
    offset.copy(camera.position).sub(this.target);
    this._spherical.setFromVector3(offset);

    function onPointerDown(e) {
      if (self._disposed) return;
      self._isDragging = true;
      self._prevMouse.x = e.clientX;
      self._prevMouse.y = e.clientY;
      domElement.style.cursor = 'grabbing';
    }

    function onPointerMove(e) {
      if (!self._isDragging || self._disposed) return;
      var dx = e.clientX - self._prevMouse.x;
      var dy = e.clientY - self._prevMouse.y;
      self._prevMouse.x = e.clientX;
      self._prevMouse.y = e.clientY;

      var el = domElement;
      self._sphericalDelta.theta -= (2 * Math.PI * dx / el.clientWidth) * self.rotateSpeed;
      self._sphericalDelta.phi -= (2 * Math.PI * dy / el.clientHeight) * self.rotateSpeed * 0.3;
    }

    function onPointerUp() {
      if (self._disposed) return;
      self._isDragging = false;
      domElement.style.cursor = 'grab';
    }

    function onTouchStart(e) {
      if (self._disposed || e.touches.length !== 1) return;
      self._isDragging = true;
      self._prevMouse.x = e.touches[0].clientX;
      self._prevMouse.y = e.touches[0].clientY;
    }

    function onTouchMove(e) {
      if (!self._isDragging || self._disposed || e.touches.length !== 1) return;
      var dx = e.touches[0].clientX - self._prevMouse.x;
      var dy = e.touches[0].clientY - self._prevMouse.y;
      self._prevMouse.x = e.touches[0].clientX;
      self._prevMouse.y = e.touches[0].clientY;

      var el = domElement;
      self._sphericalDelta.theta -= (2 * Math.PI * dx / el.clientWidth) * self.rotateSpeed;
      self._sphericalDelta.phi -= (2 * Math.PI * dy / el.clientHeight) * self.rotateSpeed * 0.3;
      e.preventDefault();
    }

    function onTouchEnd() {
      if (self._disposed) return;
      self._isDragging = false;
    }

    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('pointerleave', onPointerUp);
    domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    domElement.addEventListener('touchend', onTouchEnd);

    this._listeners = {
      onPointerDown: onPointerDown,
      onPointerMove: onPointerMove,
      onPointerUp: onPointerUp,
      onTouchStart: onTouchStart,
      onTouchMove: onTouchMove,
      onTouchEnd: onTouchEnd
    };

    domElement.style.cursor = 'grab';
    domElement.style.touchAction = 'none';
  }

  OrbitControls.prototype.update = function () {
    if (this._disposed) return;

    var offset = new THREE.Vector3();

    // Damping
    if (this.enableDamping) {
      this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor;
      this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor;
      this._sphericalDelta.theta *= (1 - this.dampingFactor);
      this._sphericalDelta.phi *= (1 - this.dampingFactor);
    } else {
      this._spherical.theta += this._sphericalDelta.theta;
      this._spherical.phi += this._sphericalDelta.phi;
      this._sphericalDelta.theta = 0;
      this._sphericalDelta.phi = 0;
    }

    // Clamp phi
    this._spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this._spherical.phi));
    this._spherical.makeSafe();

    offset.setFromSpherical(this._spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  };

  OrbitControls.prototype.dispose = function () {
    this._disposed = true;
    var el = this.domElement;
    var l = this._listeners;
    el.removeEventListener('pointerdown', l.onPointerDown);
    el.removeEventListener('pointermove', l.onPointerMove);
    el.removeEventListener('pointerup', l.onPointerUp);
    el.removeEventListener('pointerleave', l.onPointerUp);
    el.removeEventListener('touchstart', l.onTouchStart);
    el.removeEventListener('touchmove', l.onTouchMove);
    el.removeEventListener('touchend', l.onTouchEnd);
  };

  THREE.OrbitControls = OrbitControls;
})();
