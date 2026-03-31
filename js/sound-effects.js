/* ═══════════════════════════════════════════════════════════════
   COURTIQ — SOUND EFFECTS ENGINE
   Procedural sounds using Web Audio API (no audio files needed)
   ─────────────────────────────────────────────────────────────
   Usage:
     SFX.click()    — UI click / tap
     SFX.success()  — Completed action (drill done, session saved)
     SFX.bounce()   — Basketball bounce (shot logged)
     SFX.miss()     — Missed shot / error
     SFX.xp()       — XP gained
     SFX.whoosh()   — Page/tab transition
     SFX.levelUp()  — Level up celebration
═══════════════════════════════════════════════════════════════ */

const SFX = (function () {
  'use strict';

  let ctx = null;
  let enabled = true;

  // Lazy init AudioContext (must be triggered by user gesture)
  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio not supported');
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ─── CLICK: short 800Hz sine ping ───────────────────────
  function click() {
    const c = getCtx();
    if (!c || !enabled) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.08);
  }

  // ─── SUCCESS: C5-E5-G5 arpeggio ────────────────────────
  function success() {
    const c = getCtx();
    if (!c || !enabled) return;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = c.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  // ─── BOUNCE: descending thud ────────────────────────────
  function bounce() {
    const c = getCtx();
    if (!c || !enabled) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.15);
  }

  // ─── MISS: descending sawtooth ──────────────────────────
  function miss() {
    const c = getCtx();
    if (!c || !enabled) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, c.currentTime + 0.2);
    gain.gain.setValueAtTime(0.04, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.2);
  }

  // ─── XP: ascending sweep ───────────────────────────────
  function xp() {
    const c = getCtx();
    if (!c || !enabled) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.15);
    gain.gain.setValueAtTime(0.06, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.18);
  }

  // ─── WHOOSH: filtered noise sweep ──────────────────────
  function whoosh() {
    const c = getCtx();
    if (!c || !enabled) return;
    const bufSize = c.sampleRate * 0.15;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, c.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2400, c.currentTime + 0.08);
    filter.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.15);
    filter.Q.value = 2;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.06, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(c.currentTime);
    src.stop(c.currentTime + 0.15);
  }

  // ─── LEVEL UP: triumphant arpeggio + shimmer ───────────
  function levelUp() {
    const c = getCtx();
    if (!c || !enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = i < 3 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      const t = c.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  // ─── TOGGLE ────────────────────────────────────────────
  function toggle(state) {
    enabled = typeof state === 'boolean' ? state : !enabled;
    return enabled;
  }

  function isEnabled() { return enabled; }

  // ─── AUTO-WIRE: play click on all buttons/links ────────
  document.addEventListener('click', function (e) {
    if (!enabled) return;
    const target = e.target.closest('a, button, [role="tab"], [role="button"], .db-sidebar-item, .pos-btn');
    if (target) click();
  });

  // ─── AUTO-WIRE: whoosh on tab switches ─────────────────
  document.addEventListener('click', function (e) {
    if (!enabled) return;
    const tab = e.target.closest('[role="tab"], .db-sidebar-item');
    if (tab) whoosh();
  });

  return { click, success, bounce, miss, xp, whoosh, levelUp, toggle, isEnabled };
})();
