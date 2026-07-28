/* app-v10/lib/i18n.js — the language layer
   ============================================================
   Adding a language must be adding DATA, not rewriting screens.
   V12I18n.t('key') returns the active language's string, falling
   back to English so a missing translation shows something rather
   than nothing. Hebrew flips the document to RTL.

   The choice is made once on the landing screen, stored in
   courtiq_lang, and synced through player_prefs like every other
   preference. Screens that want live updates listen for
   'courtiq:lang-changed'.
   ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'courtiq_lang';

  /* en + he ship inline with the screens; the rest live in lang/ packs
     (data-only files) that the boot loader includes for the ACTIVE
     language. pack:true marks languages whose strings arrive that way. */
  var LANGS = [
    { code: 'en', label: 'English',  dir: 'ltr', flag: '🇺🇸' },
    { code: 'he', label: 'עברית',    dir: 'rtl', flag: '🇮🇱' },
    { code: 'es', label: 'Español',  dir: 'ltr', flag: '🇪🇸', pack: true },
    { code: 'ar', label: 'العربية',  dir: 'rtl', flag: '🇸🇦', pack: true },
    { code: 'ru', label: 'Русский',  dir: 'ltr', flag: '🇷🇺', pack: true }
  ];

  /* ── strings ─────────────────────────────────────────────────
     Landing + auth + the onboarding identity step. The rest of the
     app stays English until its screens opt in — a partial translation
     of a screen is worse than an English one. */
  var STR = {
    en: {
      'landing.tagline':      'Your AI shooting coach',
      'landing.value.1':      'Every shot tracked by AI',
      'landing.value.2':      'A coaching staff in your pocket',
      'landing.value.3':      'Your streak, your records, your court',
      'landing.create':       'Create profile',
      'landing.signin':       'I have an account',
      'landing.guest':        'Try it first',
      'landing.lang':         'Language',
      'auth.title.signup':    'Create your profile',
      'auth.title.signin':    'Welcome back',
      'auth.sub.signup':      'Your sessions, streaks and records — saved on every device.',
      'auth.sub.signin':      'Pick up right where you left off.',
      'auth.name':            'FIRST NAME',
      'auth.email':           'EMAIL',
      'auth.password':        'PASSWORD',
      'auth.cta.signup':      'Start training',
      'auth.cta.signin':      'Sign in',
      'auth.forgot':          'Forgot password?',
      'auth.reset.sent':      'Reset link sent — check your email.',
      'auth.switch.tosignin': 'Have an account? Sign in',
      'auth.switch.tosignup': 'New here? Create a profile',
      'auth.back':            'Back',
      'auth.err.email':       'Enter a valid email.',
      'auth.err.password':    'Password needs at least 6 characters.',
      'auth.err.name':        'What should we call you?',
      'onb.units.metric':     'CM · KG',
      'onb.units.imperial':   'FT · LB',
      'onb.height':           'Height',
      'onb.weight':           'Weight'
    },
    he: {
      'landing.tagline':      'מאמן הקליעה שלך, מבוסס AI',
      'landing.value.1':      'כל זריקה נספרת על ידי AI',
      'landing.value.2':      'צוות אימון שלם בכיס',
      'landing.value.3':      'הרצף, השיאים והמגרש — שלך',
      'landing.create':       'יצירת פרופיל',
      'landing.signin':       'יש לי חשבון',
      'landing.guest':        'קודם לנסות',
      'landing.lang':         'שפה',
      'auth.title.signup':    'יצירת פרופיל',
      'auth.title.signin':    'טוב שחזרת',
      'auth.sub.signup':      'הסשנים, הרצפים והשיאים שלך — נשמרים בכל מכשיר.',
      'auth.sub.signin':      'ממשיכים בדיוק מאיפה שעצרת.',
      'auth.name':            'שם פרטי',
      'auth.email':           'אימייל',
      'auth.password':        'סיסמה',
      'auth.cta.signup':      'מתחילים להתאמן',
      'auth.cta.signin':      'כניסה',
      'auth.forgot':          'שכחת סיסמה?',
      'auth.reset.sent':      'קישור איפוס נשלח — בדוק את המייל.',
      'auth.switch.tosignin': 'יש חשבון? כניסה',
      'auth.switch.tosignup': 'חדש כאן? יצירת פרופיל',
      'auth.back':            'חזרה',
      'auth.err.email':       'צריך אימייל תקין.',
      'auth.err.password':    'סיסמה של 6 תווים לפחות.',
      'auth.err.name':        'איך לקרוא לך?',
      'onb.units.metric':     'ס״מ · ק״ג',
      'onb.units.imperial':   'FT · LB',
      'onb.height':           'גובה',
      'onb.weight':           'משקל'
    }
  };

  function current() {
    try { return localStorage.getItem(LS_KEY) || 'en'; }
    catch (e) { return 'en'; }
  }

  function langOf(code) {
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i].code === code) return LANGS[i];
    }
    return LANGS[0];
  }

  function t(key, params) {
    var lang = current();
    var s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
    if (params) {
      for (var p in params) {
        s = s.split('{' + p + '}').join(String(params[p]));
      }
    }
    return s;
  }

  /* Screens register their own strings on load — translations live next
     to the screen that uses them, and adding a language never means a
     merge in this file. Later registrations win, so a screen can also
     override a shared string if it must. */
  function add(dict) {
    for (var lang in dict) {
      if (!STR[lang]) STR[lang] = {};
      var m = dict[lang];
      for (var k in m) STR[lang][k] = m[k];
    }
  }

  /* Direction is applied to the whole document — every flex row,
     margin and text alignment follows automatically. */
  function applyDir() {
    var l = langOf(current());
    try {
      document.documentElement.setAttribute('dir', l.dir);
      document.documentElement.setAttribute('lang', l.code);
    } catch (e) {}
  }

  function known(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return true;
    return false;
  }

  function set(code) {
    if (!known(code)) code = 'en';
    try { localStorage.setItem(LS_KEY, code); } catch (e) {}
    /* Pack languages load at boot (only the active one ships into the
       page). Switching TO one whose strings aren't registered yet means
       the pack isn't loaded — a reload brings it in. en/he are always
       inline, so first-run language picks never reload. */
    /* A language is "loaded" when both its UI strings AND its drill
       pack are registered (he ships UI inline but drills as a pack). */
    var loaded = STR[code] && STR[code]['auth.back'] &&
                 (code === 'en' || STR[code]['drill.shoot-001.n']);
    if (!loaded) {
      /* Reloading off the landing would bounce a signed-in player home
         (the redo pass was already consumed) — re-arm it so they come
         back to the same screen, now in the new language. */
      try {
        if (document.body && document.body.getAttribute('data-screen') === 'landing') {
          sessionStorage.setItem('courtiq_redo_intro', '1');
        }
      } catch (e2) {}
      try { location.reload(); return; } catch (e) {}
    }
    applyDir();
    try {
      window.dispatchEvent(new CustomEvent('courtiq:lang-changed', { detail: { lang: code } }));
    } catch (e) {}
  }

  function chosen() {
    try { return !!localStorage.getItem(LS_KEY); }
    catch (e) { return true; }   // storage blocked → don't trap on landing
  }

  /* Dev helper: the full registered inventory, used to build new
     language packs (a pack must cover every key the screens register). */
  function dump() { return STR; }

  window.V12I18n = {
    t: t, add: add, set: set, current: current, chosen: chosen,
    LANGS: LANGS, applyDir: applyDir, dump: dump
  };

  applyDir();
})();
