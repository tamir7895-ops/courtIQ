/* CourtIQ v12 — client error telemetry (window.V12Telemetry)
   ------------------------------------------------------------------
   Every uncaught error and unhandled rejection on a signed-in device
   lands in public.client_errors with the screen and build it happened
   on. Exists because the scroll saga was debugged blind for two days:
   the app "worked" in every preview and only the phone knew otherwise.

   Discipline: max 10 reports per launch, consecutive duplicates
   dropped, guests skipped (RLS requires the user's own id anyway),
   and reporting itself can never throw. ES5.
   ============================================================ */
(function () {
  'use strict';

  var sent = 0;
  var lastKey = '';
  var MAX_PER_LAUNCH = 10;

  function buildTag() {
    try {
      if (window.COURTIQ_VERSION) return String(window.COURTIQ_VERSION);
      if (window.__BUILD__) return String(window.__BUILD__);
    } catch (e) {}
    return 'unknown';
  }

  function report(message, stack) {
    try {
      if (sent >= MAX_PER_LAUNCH) return;
      if (!window.currentUser || !window.currentUser.id) return;
      if (!window.sb || !sb.from) return;
      var key = String(message).slice(0, 120);
      if (key === lastKey) return;               /* same error looping */
      lastKey = key;
      sent++;
      sb.from('client_errors').insert({
        user_id: window.currentUser.id,
        screen: document.body.getAttribute('data-screen') || 'boot',
        message: String(message).slice(0, 500),
        stack: stack ? String(stack).slice(0, 2000) : null,
        build: buildTag()
      }).then(function () {}, function () {});
    } catch (e) { /* telemetry must never hurt the app */ }
  }

  window.addEventListener('error', function (ev) {
    report(ev.message || 'script error',
      ev.error && ev.error.stack ? ev.error.stack :
      (ev.filename ? ev.filename + ':' + ev.lineno : null));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    report('unhandled rejection: ' + (r && r.message ? r.message : String(r)),
      r && r.stack ? r.stack : null);
  });

  window.V12Telemetry = { report: report };
})();
