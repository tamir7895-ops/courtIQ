/* CourtIQ v12 — in-app smoke runner (dev only, ?smoke in the URL)
   ------------------------------------------------------------------
   Walks every registered screen, waits for it to compose, and asserts
   it actually rendered (enough elements, no render-error div, no new
   console errors). Exists because a one-line CSS wrapper once broke
   every screen at once and nothing said so until a human looked.

   Run: http://localhost:8080/app-v10/index.html?smoke
   Result: a fixed banner + document.title = "SMOKE PASS" / "SMOKE FAIL"
   (the title makes it machine-readable from any driver).
   Never loads under Capacitor. ES5.
   ============================================================ */
(function () {
  'use strict';
  if (window.Capacitor) return;
  if (location.search.indexOf('smoke') < 0) return;

  var SCREENS = [
    { id: 'home',          min: 4 },
    { id: 'track',         min: 3 },
    { id: 'train',         min: 3 },
    { id: 'coach',         min: 3 },
    { id: 'social',        min: 2 },
    { id: 'me',            min: 3 },
    { id: 'plan',          min: 3 },
    { id: 'drill-library', min: 10 }
  ];
  var WAIT_MS = 1400;

  var errors = [];
  var origError = console.error;
  console.error = function () {
    errors.push(Array.prototype.join.call(arguments, ' ').slice(0, 160));
    return origError.apply(console, arguments);
  };

  function check(spec) {
    return new Promise(function (res) {
      var errBefore = errors.length;
      window.app.go(spec.id);
      setTimeout(function () {
        var app = document.getElementById('app');
        var count = app.querySelectorAll('*').length;
        var failText = (app.textContent || '').indexOf('Screen failed:') >= 0;
        var newErrs = errors.slice(errBefore);
        var visible = 0;
        Array.prototype.forEach.call(app.children, function (el) {
          var r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) visible++;
        });
        res({
          id: spec.id,
          ok: count >= spec.min * 3 && !failText && visible >= 1 && newErrs.length === 0,
          count: count, visible: visible, failText: failText, errors: newErrs
        });
      }, WAIT_MS);
    });
  }

  function run() {
    var results = [];
    return SCREENS.reduce(function (p, spec) {
      return p.then(function () {
        return check(spec).then(function (r) { results.push(r); });
      });
    }, Promise.resolve()).then(function () {
      var failed = results.filter(function (r) { return !r.ok; });
      var pass = failed.length === 0;
      document.title = pass ? 'SMOKE PASS' : 'SMOKE FAIL';
      window.__SMOKE__ = { pass: pass, results: results };
      var banner = document.createElement('div');
      banner.id = 'smoke-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
        'padding:10px 14px;font:800 14px monospace;color:#fff;text-align:center;' +
        'background:' + (pass ? '#2F9204' : '#C92A2A');
      banner.textContent = pass
        ? 'SMOKE PASS — ' + results.length + ' screens rendered clean'
        : 'SMOKE FAIL — ' + failed.map(function (f) { return f.id; }).join(', ');
      document.body.appendChild(banner);
      try { origError.call(console, '[smoke]', JSON.stringify(window.__SMOKE__)); } catch (e) {}
      window.app.go('home');
    });
  }

  /* wait for bootstrap to settle, then run */
  var tries = 0;
  (function arm() {
    if (window.app && window.app.go && document.getElementById('app')) {
      setTimeout(run, 1200);
    } else if (tries++ < 60) {
      setTimeout(arm, 250);
    }
  })();
})();
