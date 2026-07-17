/* CourtIQ v11 — the audio channel
   ------------------------------------------------------------------
   The app had ZERO audio. On a tripod that is not a gap, it's the whole
   product missing: at 20 feet the screen is not a display, it's a status
   light, and the speaker is the only output that reaches the shooter.

   Two rules govern what gets said:

   1. ANNOUNCE ONLY WHAT THE ATHLETE CANNOT PERCEIVE UNAIDED.
      Noah — used by 26 of 30 NBA teams — announces arc, depth, left-right.
      It does NOT announce make/miss, because the shooter watched the ball.
      Telling them what they just saw spends the entire per-shot audio
      budget on zero information. (Moot for us live anyway: counter mode
      has no verdicts. But the rule is why the count is worth saying and
      the outcome wouldn't be.)

   2. DON'T FIRE INSTANTLY. Swinnen, Schmidt, Nicholson & Shapiro (1990,
      J. Exp. Psychol. LMC 16) found instantaneous knowledge-of-results
      DEGRADES both immediate performance and delayed retention — it
      blocks the learner's own post-movement evaluation, which is the
      thing you're training. Competitors market "zero latency" as a
      feature; the motor-learning literature calls it a defect. So the
      tick is immediate (it's a receipt, not feedback) and the spoken
      count lands ~800ms later, past that window.

   The tick is a WebAudio oscillator, not TTS: speechSynthesis has
   100-400ms of unpredictable startup and would blow the budget. Speech
   never blocks the tick.
   ============================================================ */
(function () {
  'use strict';

  var LS = 'courtiq_v11_audio';
  var ctx = null;
  var prefs = { tick: true, count: true };

  try {
    var raw = JSON.parse(localStorage.getItem(LS) || 'null');
    if (raw) prefs = { tick: raw.tick !== false, count: raw.count !== false };
  } catch (e) {}

  function save() {
    try { localStorage.setItem(LS, JSON.stringify(prefs)); } catch (e) {}
  }

  /* Must be created inside a user gesture or iOS leaves it suspended. */
  function arm() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, ms, gain, type) {
    if (!ctx) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      var t0 = ctx.currentTime;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + ms / 1000 + 0.02);
    } catch (e) {}
  }

  /* The receipt. Immediate — under ~250ms a tick binds to the shot
     perceptually; past it, it reads as a malfunction and users stop
     trusting the counter. */
  function tick() { if (prefs.tick) tone(1000, 90, 0.22, 'triangle'); }

  /* An alarm, not feedback — the learning research doesn't apply, so this
     fires fast and is NOT toggleable. Silencing it re-opens the ruined
     session it exists to prevent. Descending = universally "wrong". */
  function fault() {
    tone(660, 160, 0.3, 'square');
    setTimeout(function () { tone(440, 260, 0.3, 'square'); }, 150);
  }
  function ok() { tone(660, 90, 0.2); setTimeout(function () { tone(990, 140, 0.2); }, 90); }

  /* Bare numerals, no carrier phrase. Noah says "forty-five", not "your
     release angle was forty-five degrees" — a sentence collides with the
     next shot's preparation, which is actively harmful. Budget ≤900ms. */
  function say(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();       // depth-1 queue, drop-oldest:
      var u = new SpeechSynthesisUtterance(String(text));  // a stale callout
      u.rate = 1.1; u.volume = 1;            // attributed to the wrong shot
      window.speechSynthesis.speak(u);       // teaches the wrong association
    } catch (e) {}
  }

  /* Reduced-frequency schedule. The guidance hypothesis: too-frequent
     augmented feedback creates dependency and degrades retention. Every
     5th, not every shot. */
  function count(n) {
    if (!prefs.count) return;
    if (n % 5 !== 0) return;
    setTimeout(function () { say(n); }, 800);
  }

  window.V11Audio = {
    arm: arm, tick: tick, fault: fault, ok: ok, say: say, count: count,
    prefs: prefs, save: save,
    set: function (k, v) { prefs[k] = v; save(); }
  };
})();
