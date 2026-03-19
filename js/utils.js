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

  /* ── Shared constants ────────────────────────────────────────
     Single source of truth for XP level thresholds.
     Consumed by gamification.js and social-hub.js.
  ─────────────────────────────────────────────────────────── */
  var COURTIQ_LEVELS = [
    { name: 'Rookie',   icon: '🏀', threshold: 0,    cls: 'rookie'   },
    { name: 'Hooper',   icon: '⚡', threshold: 200,  cls: 'hooper'   },
    { name: 'All-Star', icon: '⭐', threshold: 600,  cls: 'all-star' },
    { name: 'MVP',      icon: '👑', threshold: 1500, cls: 'mvp'      }
  ];

  /* ── AI Prompt sanitiser ─────────────────────────────────────
     Strips control characters (including newlines) and trims to
     maxLen.  Use before embedding any user value in an AI prompt
     to prevent prompt-injection via newline smuggling.
  ─────────────────────────────────────────────────────────── */
  function sanitizePromptStr(val, maxLen) {
    if (val == null) return '';
    var s = String(val)
      .replace(/[\x00-\x1F\x7F]/g, ' ')  // strip newlines & control chars
      .replace(/\s+/g, ' ')              // collapse runs of whitespace
      .trim();
    return maxLen ? s.slice(0, maxLen) : s;
  }

  /* ── Exports ─────────────────────────────────────────────── */
  window.escapeHTML          = escapeHTML;
  window.safeNumber          = safeNumber;
  window.safeJSONParse       = safeJSONParse;
  window.LS                  = LS;
  window.COURTIQ_LEVELS      = COURTIQ_LEVELS;
  window.sanitizePromptStr   = sanitizePromptStr;

  /* ── CourtIQ Namespace Registry ────────────────────────────
     Central registry for all CourtIQ modules. Detects naming
     collisions early and provides a single lookup point.
     Usage: CourtIQ.register('ModuleName', moduleObject)
  ─────────────────────────────────────────────────────────── */
  var _registry = {};
  window.CourtIQ = {
    register: function (name, obj) {
      if (_registry[name]) {
        console.warn('[CourtIQ] Module "' + name + '" already registered — possible collision');
      }
      _registry[name] = obj;
      return obj;
    },
    get: function (name) { return _registry[name] || null; },
    list: function () { return Object.keys(_registry); },
    version: '2.0.0'
  };
})();
