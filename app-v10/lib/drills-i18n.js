/* app-v10/lib/drills-i18n.js — translated drill names, safely
   ============================================================
   Drill NAMES are identifiers all over the app: the plan stores them,
   the coach proposes them verbatim, the tactics board finds diagrams
   by them. Translating the stored name would break every one of those
   contracts, so the ENGLISH name stays the canonical id and languages
   only change what the player SEES.

   V12Drills.name()/desc() accept either a drill object or a bare name
   string (plans and coach proposals carry names, not objects), resolve
   the drill id through _DRILLS_DB, and look up drill.<id>.n / .d in the
   active language. No translation registered → the English original,
   exactly as before.
   ============================================================ */
(function () {
  'use strict';

  var byName = {};   // canonical english name -> id
  var byId = {};     // id -> drill

  function index() {
    /* drill-engine declares `const _DRILLS_DB` — a top-level lexical
       binding, visible as a bare identifier but NOT on window */
    var db = (typeof _DRILLS_DB !== 'undefined') ? _DRILLS_DB : window._DRILLS_DB;
    if (!db || !db.length || byId[db[0].id]) return;
    for (var i = 0; i < db.length; i++) {
      byId[db[i].id] = db[i];
      byName[db[i].name] = db[i].id;
    }
  }

  function idOf(x) {
    index();
    if (!x) return null;
    if (typeof x === 'string') return byName[x] || null;
    if (x.id && byId[x.id]) return x.id;
    if (x.name && byName[x.name]) return byName[x.name];
    return null;
  }

  function tKey(key, fallback) {
    if (!window.V12I18n) return fallback;
    var s = window.V12I18n.t(key);
    return s === key ? fallback : s;   // untranslated → english original
  }

  function name(x) {
    var id = idOf(x);
    var fallback = typeof x === 'string' ? x : (x && x.name) || '';
    if (!id) return fallback;
    return tKey('drill.' + id + '.n', fallback);
  }

  function desc(x) {
    var id = idOf(x);
    var fallback = (x && x.description) || '';
    if (!id) return fallback;
    return tKey('drill.' + id + '.d', fallback);
  }

  /* reps_or_sets ("4 sets × 10 reps per side") — the numbers and ×
     stay, the unit PHRASES translate through rx.<slug> keys. The DB's
     123 distinct strings decompose into ~80 phrases; an unknown phrase
     passes through in English rather than breaking. */
  function reps(x) {
    var s = (x && x.reps_or_sets) || (typeof x === 'string' ? x : '');
    if (!s) return '';
    return String(s).split(/([0-9×()]+)/).map(function (seg) {
      if (!seg || /^[0-9×()]+$/.test(seg)) return seg;
      var core = seg.replace(/^\s+|\s+$/g, '');
      if (!core) return seg;
      var lead = seg.slice(0, seg.indexOf(core.charAt(0)));
      var trail = seg.slice(lead.length + core.length);
      var k = 'rx.' + core.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (k === 'rx.') return seg;               // pure punctuation
      return lead + tKey(k, core) + trail;
    }).join('');
  }

  window.V12Drills = { name: name, desc: desc, idOf: idOf, reps: reps };
})();
