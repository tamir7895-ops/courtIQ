/* ============================================================
   UTILS — /js/utils.js
   Shared utility functions available globally.
   Load this FIRST (before any other CourtIQ scripts).
   ============================================================ */
(function () {
  'use strict';

  /* ── HTML Escaping ───────────────────────────────────────────
     Converts a value to a string and escapes HTML special chars.
     Use whenever inserting user-controlled or external data into
     innerHTML / template literals that go into innerHTML.

     Safe characters table:
       &  →  &amp;
       <  →  &lt;
       >  →  &gt;
       "  →  &quot;
       '  →  &#x27;
  ─────────────────────────────────────────────────────────── */
  function escapeHTML(val) {
    if (val == null) return '';
    return String(val)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#x27;');
  }

  /* ── Number guard ────────────────────────────────────────────
     Returns val coerced to a finite number, or fallback.
  ─────────────────────────────────────────────────────────── */
  function safeNumber(val, fallback) {
    var n = Number(val);
    return isFinite(n) ? n : (fallback !== undefined ? fallback : 0);
  }

  /* ── Safe JSON parse ─────────────────────────────────────────
     Returns parsed JSON or a default value on error.
  ─────────────────────────────────────────────────────────── */
  function safeJSONParse(str, defaultVal) {
    try { return JSON.parse(str); }
    catch (e) { return defaultVal !== undefined ? defaultVal : null; }
  }

  /* ── localStorage helpers ────────────────────────────────────
     Wraps localStorage with error handling and JSON support.
  ─────────────────────────────────────────────────────────── */
  var LS = {
    get: function (key, defaultVal) {
      try {
        var raw = localStorage.getItem(key);
        if (raw === null) return (defaultVal !== undefined ? defaultVal : null);
        return JSON.parse(raw);
      } catch (e) {
        return (defaultVal !== undefined ? defaultVal : null);
      }
    },
    set: function (key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; }
      catch (e) { console.warn('[LS] set failed for key:', key, e); return false; }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
    }
  };

  /* ── Exports ─────────────────────────────────────────────── */
  window.escapeHTML    = escapeHTML;
  window.safeNumber    = safeNumber;
  window.safeJSONParse = safeJSONParse;
  window.LS            = LS;
})();
