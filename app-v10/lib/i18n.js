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

  var LANGS = [
    { code: 'en', label: 'English', dir: 'ltr', flag: '🇺🇸' },
    { code: 'he', label: 'עברית',   dir: 'rtl', flag: '🇮🇱' }
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

  function t(key) {
    var lang = current();
    return (STR[lang] && STR[lang][key]) || STR.en[key] || key;
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

  function set(code) {
    if (!STR[code]) code = 'en';
    try { localStorage.setItem(LS_KEY, code); } catch (e) {}
    applyDir();
    try {
      window.dispatchEvent(new CustomEvent('courtiq:lang-changed', { detail: { lang: code } }));
    } catch (e) {}
  }

  function chosen() {
    try { return !!localStorage.getItem(LS_KEY); }
    catch (e) { return true; }   // storage blocked → don't trap on landing
  }

  window.V12I18n = {
    t: t, set: set, current: current, chosen: chosen,
    LANGS: LANGS, applyDir: applyDir
  };

  applyDir();
})();
