/* app-v10/screens/me.js — v12
   PROFILE — the sketch, top to bottom:

     avatar (big)
     name · LV · XP BAR
     SHOP · EDIT PROFILE
     □ □ □ □   (trophy preview)
     SETTINGS · TROPHIES

   XP and level are BACK by explicit user decision (the Duolingo
   reference) — v11 removed them, the sketch restored them. They're
   real numbers from XPSystem; the bar draws only when a real next
   threshold exists (COURTIQ_LEVELS), never from an invented curve.

   Views: main / trophies / settings / edit. All in-screen, one back
   button, no hidden nav.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  var T = {
    en: {
      'me.back':             'Back',
      'me.rookie':           'Rookie',
      'me.player':           'PLAYER',
      'me.lv':               'LV {n}',
      'me.meta.iq':          '{pos} · Court IQ {score} · {tier}',
      'me.meta.unrated':     '{pos} · Unrated',
      'me.shop':             'Shop',
      'me.tile.shop':        'SHOP',
      'me.editprof':         'Edit profile',
      'me.tile.editprof':    'EDIT PROFILE',
      'me.tile.settings':    'SETTINGS',
      'me.tile.trophies':    'TROPHIES',
      'me.rec.title':        'PERSONAL RECORDS',
      'me.rec.line':         '{pct}% ({made}/{att})',
      'me.rec.best':         'Best session',
      'me.rec.day':          'Most shots in a day',
      'me.rec.streak':       'Longest streak',
      'me.rec.all':          'Shots all-time',
      'me.rec.days':         '{n}d',
      'me.career.sessions':  'SESSIONS',
      'me.career.shots':     'SHOTS',
      'me.career.streak':    'STREAK',
      'me.tro.title':        'Trophies',
      'me.tro.sub':          '{got} of {total} — all earned on the court',
      'me.tro.earned':       'Earned',
      'me.tro.streak3.n':    '3-Day Fire',
      'me.tro.streak3.r':    '3 day streak',
      'me.tro.streak7.n':    'Week Warrior',
      'me.tro.streak7.r':    '7 day streak',
      'me.tro.streak14.n':   'Two-Week Beast',
      'me.tro.streak14.r':   '14 day streak',
      'me.tro.streak30.n':   'Iron Will',
      'me.tro.streak30.r':   '30 day streak',
      'me.tro.hothand.n':    'Hot Hand',
      'me.tro.hothand.r':    '30 shots in a session',
      'me.tro.sniper.n':     'Sniper',
      'me.tro.sniper.r':     '80% on 10+ shots',
      'me.tro.marathon.n':   'Marathon',
      'me.tro.marathon.r':   '5 sessions in a week',
      'me.tro.3pt100.n':     'Downtown',
      'me.tro.3pt100.r':     '100 lifetime 3PT',
      'me.tro.shots500.n':   'Shot Machine',
      'me.tro.shots500.r':   '500 lifetime shots',
      'me.tro.firstai.n':    'AI Rookie',
      'me.tro.firstai.r':    'First tracked session',
      'me.tro.firstdrill.n': 'Gym Rat',
      'me.tro.firstdrill.r': 'First drill',
      'me.tro.firstsession.n': 'Day One',
      'me.tro.firstsession.r': 'First session',
      'me.tro.customizer.n': 'Style Icon',
      'me.tro.customizer.r': 'Avatar customised',
      'me.set.title':        'Settings',
      'me.set.signin.t':     'Sign in / create account',
      'me.set.signin.s':     'Sync sessions, streak and Court IQ across devices.',
      'me.set.avatar.t':     'Customise avatar',
      'me.set.avatar.s':     'How you show up on the court.',
      'me.set.notif':        'Notifications',
      'me.set.rem.t':        'Training reminders',
      'me.set.rem.on':       'On — plan days 17:30, streak saver 20:30',
      'me.set.rem.off':      'Off — no reminders from the staff',
      'me.set.lang':         'Language',
      'me.set.redo.t':       'Redo intro & setup',
      'me.set.redo.s':       'Replay the welcome flow — your progress and sessions stay.',
      'me.set.signout':      'Sign out',
      'me.set.del.t':        'Delete account',
      'me.set.del.s':        'Removes your account and synced data. Cannot be undone.',
      'me.set.del.confirm':  'Delete your account and all synced data? This cannot be undone.',
      'me.edit.title':       'Edit my data',
      'me.edit.sub':         'Your combine card — change anything',
      'me.edit.name':        'NAME',
      'me.edit.nameph':      'Your name',
      'me.edit.pos':         'Position',
      'me.pos.pg':           'Point',
      'me.pos.sg':           'Shooting',
      'me.pos.sf':           'Small F',
      'me.pos.pf':           'Power F',
      'me.pos.c':            'Center',
      'me.edit.style':       'Play style',
      'me.style.sniper':     'Sniper',
      'me.style.slasher':    'Slasher',
      'me.style.floorgen':   'Floor Gen',
      'me.style.lockdown':   'Lockdown',
      'me.edit.height':      'Height',
      'me.edit.weight':      'Weight',
      'me.edit.age':         'Age',
      'me.edit.hand':        'Shooting hand',
      'me.hand.l':           'Lefty',
      'me.hand.r':           'Righty',
      'me.edit.save':        'Save',
      'me.unit.in':          '"',
      'me.unit.lb':          ' lb',
      'me.unit.yr':          ' yr'
    },
    he: {
      'me.back':             'חזרה',
      'me.rookie':           'רוקי',
      'me.player':           'שחקן',
      'me.lv':               'רמה {n}',
      'me.meta.iq':          '{pos} · Court IQ {score} · {tier}',
      'me.meta.unrated':     '{pos} · ללא דירוג',
      'me.shop':             'חנות',
      'me.tile.shop':        'חנות',
      'me.editprof':         'עריכת פרופיל',
      'me.tile.editprof':    'עריכת פרופיל',
      'me.tile.settings':    'הגדרות',
      'me.tile.trophies':    'גביעים',
      'me.rec.title':        'שיאים אישיים',
      'me.rec.line':         '{pct}% ({made}/{att})',
      'me.rec.best':         'הסשן הטוב ביותר',
      'me.rec.day':          'הכי הרבה זריקות ביום',
      'me.rec.streak':       'הרצף הארוך ביותר',
      'me.rec.all':          'זריקות בקריירה',
      'me.rec.days':         '{n} ימים',
      'me.career.sessions':  'סשנים',
      'me.career.shots':     'זריקות',
      'me.career.streak':    'רצף',
      'me.tro.title':        'גביעים',
      'me.tro.sub':          '{got} מתוך {total} — הכל הושג על המגרש',
      'me.tro.earned':       'הושג',
      'me.tro.streak3.n':    'אש של 3 ימים',
      'me.tro.streak3.r':    'רצף של 3 ימים',
      'me.tro.streak7.n':    'לוחם השבוע',
      'me.tro.streak7.r':    'רצף של 7 ימים',
      'me.tro.streak14.n':   'חיה של שבועיים',
      'me.tro.streak14.r':   'רצף של 14 ימים',
      'me.tro.streak30.n':   'רצון ברזל',
      'me.tro.streak30.r':   'רצף של 30 ימים',
      'me.tro.hothand.n':    'יד חמה',
      'me.tro.hothand.r':    '30 זריקות בסשן אחד',
      'me.tro.sniper.n':     'צלף',
      'me.tro.sniper.r':     '80% על 10+ זריקות',
      'me.tro.marathon.n':   'מרתון',
      'me.tro.marathon.r':   '5 סשנים בשבוע',
      'me.tro.3pt100.n':     'מחוץ לקשת',
      'me.tro.3pt100.r':     '100 שלשות בקריירה',
      'me.tro.shots500.n':   'מכונת זריקות',
      'me.tro.shots500.r':   '500 זריקות בקריירה',
      'me.tro.firstai.n':    'רוקי ה-AI',
      'me.tro.firstai.r':    'סשן מנוטר ראשון',
      'me.tro.firstdrill.n': 'חולה אולם',
      'me.tro.firstdrill.r': 'תרגיל ראשון',
      'me.tro.firstsession.n': 'היום הראשון',
      'me.tro.firstsession.r': 'סשן ראשון',
      'me.tro.customizer.n': 'אייקון של סטייל',
      'me.tro.customizer.r': 'אווטאר בהתאמה אישית',
      'me.set.title':        'הגדרות',
      'me.set.signin.t':     'כניסה / יצירת חשבון',
      'me.set.signin.s':     'סנכרון סשנים, רצף ו-Court IQ בין מכשירים.',
      'me.set.avatar.t':     'התאמת אווטאר',
      'me.set.avatar.s':     'ככה אתה נראה על המגרש.',
      'me.set.notif':        'התראות',
      'me.set.rem.t':        'תזכורות אימון',
      'me.set.rem.on':       'פועל — ימי תוכנית 17:30, שומר רצף 20:30',
      'me.set.rem.off':      'כבוי — בלי תזכורות מהצוות',
      'me.set.lang':         'שפה',
      'me.set.redo.t':       'התחלת ההיכרות מחדש',
      'me.set.redo.s':       'מריצים שוב את מסך הפתיחה — ההתקדמות והסשנים נשארים.',
      'me.set.signout':      'התנתקות',
      'me.set.del.t':        'מחיקת חשבון',
      'me.set.del.s':        'מוחק את החשבון והנתונים המסונכרנים. אי אפשר לבטל.',
      'me.set.del.confirm':  'למחוק את החשבון וכל הנתונים המסונכרנים? אי אפשר לבטל.',
      'me.edit.title':       'עריכת הנתונים שלי',
      'me.edit.sub':         'כרטיס הקומביין שלך — אפשר לשנות הכל',
      'me.edit.name':        'שם',
      'me.edit.nameph':      'השם שלך',
      'me.edit.pos':         'עמדה',
      'me.pos.pg':           'רכז',
      'me.pos.sg':           'קלע',
      'me.pos.sf':           'כנף',
      'me.pos.pf':           'פאוור',
      'me.pos.c':            'סנטר',
      'me.edit.style':       'סגנון משחק',
      'me.style.sniper':     'צלף',
      'me.style.slasher':    'חודר',
      'me.style.floorgen':   'מנהל משחק',
      'me.style.lockdown':   'מגן צמוד',
      'me.edit.height':      'גובה',
      'me.edit.weight':      'משקל',
      'me.edit.age':         'גיל',
      'me.edit.hand':        'יד קולעת',
      'me.hand.l':           'שמאלי',
      'me.hand.r':           'ימני',
      'me.edit.save':        'שמירה',
      'me.unit.in':          '"',
      'me.unit.lb':          ' ליב׳',
      'me.unit.yr':          ' שנים'
    }
  };
  if (window.V12I18n) V12I18n.add(T);
  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

  /* Mirrors BADGES in js/badges.js (kept inside its IIFE there).
     Names/reqs are i18n keys — resolved with t() at paint time so a
     language switch repaints correctly without a reload. */
  var TROPHIES = [
    { id: 'streak-3',      tier: 'gold',   icon: 'ph-fire',        nk: 'me.tro.streak3.n',      rk: 'me.tro.streak3.r' },
    { id: 'streak-7',      tier: 'gold',   icon: 'ph-fire-simple', nk: 'me.tro.streak7.n',      rk: 'me.tro.streak7.r' },
    { id: 'streak-14',     tier: 'gold',   icon: 'ph-flame',       nk: 'me.tro.streak14.n',     rk: 'me.tro.streak14.r' },
    { id: 'streak-30',     tier: 'gold',   icon: 'ph-trophy',      nk: 'me.tro.streak30.n',     rk: 'me.tro.streak30.r' },
    { id: 'hot-hand',      tier: 'silver', icon: 'ph-hand-fist',   nk: 'me.tro.hothand.n',      rk: 'me.tro.hothand.r' },
    { id: 'sniper',        tier: 'silver', icon: 'ph-crosshair',   nk: 'me.tro.sniper.n',       rk: 'me.tro.sniper.r' },
    { id: 'marathon',      tier: 'silver', icon: 'ph-path',        nk: 'me.tro.marathon.n',     rk: 'me.tro.marathon.r' },
    { id: '3pt-100',       tier: 'silver', icon: 'ph-basketball',  nk: 'me.tro.3pt100.n',       rk: 'me.tro.3pt100.r' },
    { id: 'shots-500',     tier: 'silver', icon: 'ph-medal',       nk: 'me.tro.shots500.n',     rk: 'me.tro.shots500.r' },
    { id: 'first-ai',      tier: 'bronze', icon: 'ph-robot',       nk: 'me.tro.firstai.n',      rk: 'me.tro.firstai.r' },
    { id: 'first-drill',   tier: 'bronze', icon: 'ph-barbell',     nk: 'me.tro.firstdrill.n',   rk: 'me.tro.firstdrill.r' },
    { id: 'first-session', tier: 'bronze', icon: 'ph-flag',        nk: 'me.tro.firstsession.n', rk: 'me.tro.firstsession.r' },
    { id: 'customizer',    tier: 'bronze', icon: 'ph-user-focus',  nk: 'me.tro.customizer.n',   rk: 'me.tro.customizer.r' }
  ];

  function earnedMap() {
    var map = {};
    try {
      if (typeof BadgeSystem !== 'undefined' && BadgeSystem.getEarned) {
        (BadgeSystem.getEarned() || []).forEach(function (b) { map[(b && b.id) || b] = true; });
      }
    } catch (e) {}
    return map;
  }

  /* Real XP curve or no bar at all. */
  function xpNext(xp) {
    try {
      var L = window.COURTIQ_LEVELS;
      if (L && L.length) {
        for (var i = 0; i < L.length; i++) {
          if (xp < L[i].threshold) return L[i].threshold;
        }
      }
    } catch (e) {}
    return null;
  }

  function backBtn(onBack) {
    return h('button', {
      class: 'c12-back', type: 'button', 'aria-label': t('me.back'), onclick: onBack
    }, [h('i', { class: 'ph-bold ph-arrow-left' })]);
  }

  /* ── trophies view ────────────────────────────────────────────*/
  function trophiesView(host, ctx, back) {
    while (host.firstChild) host.removeChild(host.firstChild);
    var earned = earnedMap();
    var got = TROPHIES.filter(function (tr) { return earned[tr.id]; }).length;

    host.appendChild(h('div', { class: 'c12-chat-hd' }, [
      backBtn(back),
      h('div', {}, [
        h('div', { class: 'c12-chat-hd__t', text: t('me.tro.title') }),
        h('div', { class: 'c12-chat-hd__s', text: t('me.tro.sub', { got: got, total: TROPHIES.length }) })
      ])
    ]));

    var grid = h('div', { class: 'm12-trogrid' });
    TROPHIES.forEach(function (tr) {
      var isE = !!earned[tr.id];
      grid.appendChild(h('div', {
        class: 'm12-tro' + (isE ? ' is-earned is-' + tr.tier : ''),
        title: t(tr.rk)
      }, [
        h('i', { class: (isE ? 'ph-fill ' : 'ph-bold ') + tr.icon }),
        h('div', { class: 'm12-tro__n', text: t(tr.nk) }),
        h('div', { class: 'm12-tro__d', text: isE ? t('me.tro.earned') : t(tr.rk) })
      ]));
    });
    host.appendChild(grid);
  }

  /* ── language picker sheet ────────────────────────────────────
     Bottom sheet on the plan-sheet chassis: one row per language,
     each labeled in its own tongue so you can always find your way
     home from a language you don't read. Picking a pack language
     that isn't loaded yet reloads the page (i18n.set handles it). */
  function openLangSheet(host, ctx, back) {
    var bg = h('div', { class: 'plan12-sheetbg' });
    var sheet = h('div', { class: 'plan12-sheet' });
    function close() { bg.remove(); }
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });

    sheet.appendChild(h('div', { class: 'plan12-sheet__hd' }, [
      h('div', { class: 'plan12-sheet__t', text: t('me.set.lang') }),
      h('button', { class: 'plan12-sheet__x', type: 'button', onclick: close },
        [h('i', { class: 'ph-bold ph-x' })])
    ]));

    var cur = V12I18n.current();
    V12I18n.LANGS.forEach(function (lg) {
      var isCur = lg.code === cur;
      var r = h('button', {
        class: 'm12-lang' + (isCur ? ' is-current' : ''), type: 'button',
        onclick: function () {
          if (isCur) { close(); return; }
          close();
          V12I18n.set(lg.code);                 /* may reload for packs */
          settingsView(host, ctx, back);        /* repaint if it didn't */
        }
      }, [
        h('span', { class: 'm12-lang__flag', text: lg.flag }),
        h('span', { class: 'm12-lang__label', text: lg.label }),
        isCur ? h('i', { class: 'ph-bold ph-check-circle m12-lang__check' }) : null
      ].filter(Boolean));
      sheet.appendChild(r);
    });

    bg.appendChild(sheet);
    document.body.appendChild(bg);
  }

  /* ── settings view ────────────────────────────────────────────*/
  function settingsView(host, ctx, back) {
    while (host.firstChild) host.removeChild(host.firstChild);
    host.appendChild(h('div', { class: 'c12-chat-hd' }, [
      backBtn(back),
      h('div', {}, [h('div', { class: 'c12-chat-hd__t', text: t('me.set.title') })])
    ]));

    var signedIn = !!(ctx.data.isSignedIn && ctx.data.isSignedIn());

    function row(icon, title, sub, onClick, danger) {
      return V12.card({ press: true, onClick: onClick, label: title, class: 'm12-set' }, [
        h('i', { class: 'ph-bold ' + icon + ' m12-set__ic' + (danger ? ' m12-set__ic--danger' : '') }),
        h('div', { class: 'm12-set__main' }, [
          h('div', { class: 'm12-set__t' + (danger ? ' m12-set__t--danger' : ''), text: title }),
          sub ? h('div', { class: 'm12-set__s', text: sub }) : null
        ].filter(Boolean)),
        h('i', { class: 'ph-bold ph-caret-right m12-set__chev' })
      ]);
    }

    /* Leaving settings for another screen: flag the departure so that
       coming BACK to 'me' reopens settings instead of the front page. */
    function goFromSettings(id) {
      /* Record WHERE settings sent you, not just that it did. app.js
         drops the flag the moment you navigate anywhere other than that
         screen or back to 'me' — otherwise it survives the whole session
         and reopens settings minutes later, on a visit that has nothing
         to do with this trip. */
      try { sessionStorage.setItem('courtiq_me_return', 'settings:' + id); } catch (e) {}
      ctx.go(id);
    }

    if (!signedIn) {
      host.appendChild(row('ph-user-circle', t('me.set.signin.t'),
        t('me.set.signin.s'),
        function () { goFromSettings('auth'); }));
    }
    host.appendChild(row('ph-user-focus', t('me.set.avatar.t'),
      t('me.set.avatar.s'),
      function () { goFromSettings('avatar-customizer'); }));
    host.appendChild(row('ph-bell', t('me.set.notif'), null,
      function () { goFromSettings('notifications'); }));

    /* training reminders — the toggle IS the row; tap flips it */
    if (window.V12Notify) {
      var on = window.V12Notify.enabled();
      host.appendChild(row('ph-bell-ringing', t('me.set.rem.t'),
        on ? t('me.set.rem.on') : t('me.set.rem.off'),
        function () {
          window.V12Notify.setEnabled(!on);
          settingsView(host, ctx, back);        /* repaint with new state */
        }));
    }

    /* language — the row shows the CURRENT language and opens a picker
       sheet listing every language in the registry, each self-labeled
       in its own tongue. V12I18n.set() flips document dir (and reloads
       once when the target is a pack language that isn't loaded yet). */
    if (window.V12I18n && V12I18n.LANGS && V12I18n.LANGS.length > 1) {
      var LNG = V12I18n.LANGS;
      var curCode = V12I18n.current();
      var curLang = LNG[0];
      for (var li = 0; li < LNG.length; li++) {
        if (LNG[li].code === curCode) { curLang = LNG[li]; break; }
      }
      host.appendChild(row('ph-translate', t('me.set.lang'),
        curLang.flag + '  ' + curLang.label,
        function () { openLangSheet(host, ctx, back); }));
    }

    /* Replay the whole first-run journey — landing, language, the
       combine, the avatar. A do-over, not a reset: progression, XP,
       streak and sessions stay exactly where they are; finishing the
       combine again simply overwrites the profile answers. */
    host.appendChild(row('ph-arrow-counter-clockwise', t('me.set.redo.t'),
      t('me.set.redo.s'),
      function () {
        try {
          localStorage.removeItem('courtiq_onboarded');
          window._v12Onb = null;          /* fresh combine, not a resume */
          /* landing bounces signed-in players home — this one visit is
             deliberate, so it carries a pass */
          sessionStorage.setItem('courtiq_redo_intro', '1');
        } catch (e) {}
        ctx.go('landing');
      }));

    if (signedIn) {
      host.appendChild(row('ph-sign-out', t('me.set.signout'), null, function () {
        if (window.V10Auth && window.V10Auth.signOut) {
          window.V10Auth.signOut().then(function () { ctx.go('home'); });
        }
      }));
      host.appendChild(row('ph-trash', t('me.set.del.t'),
        t('me.set.del.s'),
        function () {
          if (window.confirm(t('me.set.del.confirm')) &&
              window.V10Auth && window.V10Auth.deleteAccount) {
            window.V10Auth.deleteAccount().then(function () { ctx.go('home'); });
          }
        }, true));
    }
  }

  /* ── edit profile view — the full data card, editable ──────────
     Everything the combine collected about the player, in one place:
     name, position, play style, and the measurables. Reads the same
     localStorage keys onboarding writes so the two round-trip, and
     re-renders me on save so the header + id card reflect it. */
  function lsGet(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }

  function editView(host, ctx, prof, back) {
    while (host.firstChild) host.removeChild(host.firstChild);

    /* current values from storage (fall back to profile / sane defaults) */
    var cur = {
      name: (prof.name && prof.name !== 'Rookie') ? prof.name : (lsGet('courtiq_profile_name', '') || ''),
      position: lsGet('courtiq_profile_position', '') || (prof.position || ''),
      playStyle: lsGet('courtiq_profile_playstyle', '') || '',
      height: parseInt(lsGet('courtiq_profile_height', '74'), 10) || 74,
      weight: parseInt(lsGet('courtiq_profile_weight', '175'), 10) || 175,
      age: parseInt(lsGet('courtiq_profile_age', '17'), 10) || 17,
      hand: lsGet('courtiq_profile_hand', 'R') || 'R'
    };

    host.appendChild(h('div', { class: 'c12-chat-hd' }, [
      backBtn(back),
      h('div', {}, [
        h('div', { class: 'c12-chat-hd__t', text: t('me.edit.title') }),
        h('div', { class: 'c12-chat-hd__s', text: t('me.edit.sub') })
      ])
    ]));

    var scroll = h('div', { class: 'me12-editscroll' });
    host.appendChild(scroll);

    /* helpers reusing the onboarding control styles */
    function slider(label, val, min, max, unit, key) {
      var out = h('span', { class: 'onb12-slider__v', text: val + (unit || '') });
      var input = h('input', { type: 'range', min: String(min), max: String(max), value: String(val), class: 'onb12-range' });
      input.addEventListener('input', function () {
        cur[key] = parseInt(input.value, 10);
        out.textContent = input.value + (unit || '');
      });
      return h('div', { class: 'onb12-slider' }, [
        h('div', { class: 'onb12-slider__top' }, [h('span', { class: 'd-label', text: label }), out]), input
      ]);
    }
    function pickRow(label, opts, key, cols) {
      var wrap = h('div', { class: cols === 2 ? 'onb12-two' : 'onb12-grid3' });
      function paintPills() {
        while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
        opts.forEach(function (o) {
          wrap.appendChild(h('button', {
            class: 'onb12-pill' + (cur[key] === o.id ? ' is-active' : ''), type: 'button',
            onclick: function () { cur[key] = o.id; paintPills(); }
          }, [
            h('div', { class: 'onb12-pill__l', text: o.l }),
            o.s ? h('div', { class: 'onb12-pill__s', text: o.s }) : null
          ].filter(Boolean)));
        });
      }
      paintPills();
      return h('div', {}, [h('div', { class: 'd-label', style: { marginBottom: '7px' }, text: label }), wrap]);
    }

    var nameIn = h('input', {
      class: 'onb12-input', type: 'text', maxlength: '24',
      placeholder: t('me.edit.nameph'), value: cur.name,
      oninput: function (e) { cur.name = e.target.value; }
    });

    scroll.appendChild(h('div', { class: 'onb12-body' }, [
      h('div', { class: 'd-label', text: t('me.edit.name') }), nameIn,
      pickRow(t('me.edit.pos'), [
        { id: 'PG', l: t('me.pos.pg') }, { id: 'SG', l: t('me.pos.sg') }, { id: 'SF', l: t('me.pos.sf') },
        { id: 'PF', l: t('me.pos.pf') }, { id: 'C', l: t('me.pos.c') }
      ], 'position', 3),
      pickRow(t('me.edit.style'), [
        { id: 'sniper', l: t('me.style.sniper') }, { id: 'slasher', l: t('me.style.slasher') },
        { id: 'floor-general', l: t('me.style.floorgen') }, { id: 'lockdown', l: t('me.style.lockdown') }
      ], 'playStyle', 2),
      slider(t('me.edit.height'), cur.height, 60, 90, t('me.unit.in'), 'height'),
      slider(t('me.edit.weight'), cur.weight, 100, 320, t('me.unit.lb'), 'weight'),
      slider(t('me.edit.age'), cur.age, 10, 60, t('me.unit.yr'), 'age'),
      pickRow(t('me.edit.hand'), [{ id: 'L', l: t('me.hand.l') }, { id: 'R', l: t('me.hand.r') }], 'hand', 2)
    ]));

    host.appendChild(V12.btn({
      label: t('me.edit.save'), icon: 'ph-check',
      onClick: function () {
        try {
          localStorage.setItem('courtiq_profile_name', (cur.name || '').trim() || 'Rookie');
          localStorage.setItem('courtiq_profile_position', cur.position || '');
          localStorage.setItem('courtiq_profile_playstyle', cur.playStyle || '');
          localStorage.setItem('courtiq_profile_height', String(cur.height));
          localStorage.setItem('courtiq_profile_weight', String(cur.weight));
          localStorage.setItem('courtiq_profile_age', String(cur.age));
          localStorage.setItem('courtiq_profile_hand', cur.hand || 'R');
        } catch (e) {}
        window.app.go('me');
      }
    }));
    host.appendChild(V12.card({
      press: true, onClick: function () { ctx.go('avatar-customizer'); },
      label: t('me.set.avatar.t'), class: 'm12-set'
    }, [
      h('i', { class: 'ph-bold ph-user-focus m12-set__ic' }),
      h('div', { class: 'm12-set__main' }, [
        h('div', { class: 'm12-set__t', text: t('me.set.avatar.t') })
      ]),
      h('i', { class: 'ph-bold ph-caret-right m12-set__chev' })
    ]));
  }

  /* ── main view ────────────────────────────────────────────────*/
  function mainView(host, ctx, prof, iq, totals) {
    while (host.firstChild) host.removeChild(host.firstChild);

    /* the Duolingo band — the character's world owns the top third,
       edge to edge, tinted with the avatar's own background color */
    /* transparent character over a band that paints the chosen court
       itself — a baked-in PNG background was a visible square whenever
       the court was a gradient (regex here read only its first color) */
    var url = V12.avatarUrl(prof, { noBg: true });
    var band = h('div', {
      class: 'm12-band',
      role: 'button', tabindex: '0', 'aria-label': t('me.set.avatar.t'),
      onclick: function () { ctx.go('avatar-customizer'); },
      onkeydown: V12.activates(function () { ctx.go('avatar-customizer'); })
    }, [
      h('div', { class: 'm12-band__edit' }, [h('i', { class: 'ph-bold ph-pencil-simple' })])
    ]);
    var bandBg = '#FFB800';
    try { if (window.V12Avatar) bandBg = V12Avatar.bgCss(V12Avatar.load()); } catch (e) {}
    if (bandBg.indexOf('gradient') >= 0) {
      /* two layers: the character, then the court gradient under it */
      band.style.backgroundImage = 'url(' + url + '), ' + bandBg;
      band.style.backgroundSize = 'auto calc(100% - var(--safe-top) - 10px), 100% 100%';
      band.style.backgroundPosition = 'bottom center, center';
      band.style.backgroundRepeat = 'no-repeat, no-repeat';
    } else {
      band.style.backgroundColor = bandBg;
      band.style.backgroundImage = 'url(' + url + ')';
    }
    host.appendChild(band);

    /* name + level + XP bar */
    var xp = prof.xp || 0;
    var next = xpNext(xp);
    /* 'PLAYER' is the stored data default, not a position — show it
       through the me.player key so it translates like everything else */
    var pos = (prof.position && prof.position !== 'PLAYER') ? prof.position : t('me.player');
    host.appendChild(V12.card({ tint: 'ink', class: 'm12-id', bgIcon: 'ph-lightning', bgTone: 'gold' }, [
      h('div', { class: 'm12-id__row' }, [
        h('div', { class: 'm12-id__n', text: prof.name || t('me.rookie') }),
        h('div', { class: 'm12-id__lv', text: t('me.lv', { n: prof.level || 1 }) })
      ]),
      h('div', { class: 'm12-id__m',
        text: iq ? t('me.meta.iq', { pos: pos, score: iq.score, tier: iq.tier })
                 : t('me.meta.unrated', { pos: pos }) }),
      V12.xpBar(xp, next)
    ]));

    /* shop / edit profile */
    host.appendChild(h('div', { class: 'm12-two' }, [
      V12.card({
        tint: 'gold', press: true, bgIcon: 'ph-storefront', bgTone: 'gold', class: 'm12-doortile',
        onClick: function () { ctx.go('shop'); }, label: t('me.shop')
      }, [
        h('i', { class: 'ph-fill ph-storefront m12-doortile__ic m12-doortile__ic--gold' }),
        h('div', { class: 'm12-doortile__t', text: t('me.tile.shop') })
      ]),
      V12.card({
        press: true, bgIcon: 'ph-pencil-simple-line', bgTone: 'ink', class: 'm12-doortile',
        onClick: function () { editView(host, ctx, prof, function () { mainView(host, ctx, prof, iq, totals); }); },
        label: t('me.editprof')
      }, [
        h('i', { class: 'ph-fill ph-pencil-simple-line m12-doortile__ic' }),
        h('div', { class: 'm12-doortile__t', text: t('me.tile.editprof') })
      ])
    ]));

    /* ── PERSONAL RECORDS — walls to break, all from real film ────
       Progressive: the card lands when the fetch does; a stat with no
       evidence shows a dash, never an invented zero. */
    var recHost = h('div', {});
    host.appendChild(recHost);
    if (ctx.data.getSessions) {
      ctx.data.getSessions(200).then(function (rows) {
        if (!recHost.isConnected) return;
        var bestPct = null, bestLine = '—', dayMax = 0, total = 0, byDay = {};
        (rows || []).forEach(function (s) {
          var att = s.total_attempts || 0;
          total += att;
          var d = (s.session_date || s.created_at || '').slice(0, 10);
          if (d) { byDay[d] = (byDay[d] || 0) + att; if (byDay[d] > dayMax) dayMax = byDay[d]; }
          if (s.total_made != null && att >= 10) {
            var p = Math.round(s.total_made * 100 / att);
            if (bestPct === null || p > bestPct) {
              bestPct = p;
              bestLine = t('me.rec.line', { pct: p, made: s.total_made, att: att });
            }
          }
        });
        var bestStreak = 0;
        try { bestStreak = (window.StreakSystem.load().best) || 0; } catch (e) {}
        if (!total && !bestStreak) return;       /* nothing real to show yet */
        function rec(icon, v, l) {
          return h('div', { class: 'm12-rec' }, [
            h('i', { class: 'ph-fill ' + icon }),
            h('div', { class: 'm12-rec__v', text: v }),
            h('div', { class: 'm12-rec__l', text: l })
          ]);
        }
        recHost.appendChild(V12.card({ class: 'm12-records' }, [
          h('div', { class: 'd-label', text: t('me.rec.title') }),
          h('div', { class: 'm12-recs' }, [
            rec('ph-target', bestLine, t('me.rec.best')),
            rec('ph-basketball', dayMax ? String(dayMax) : '—', t('me.rec.day')),
            rec('ph-fire', bestStreak ? t('me.rec.days', { n: bestStreak }) : '—', t('me.rec.streak')),
            rec('ph-stack', String(total), t('me.rec.all'))
          ])
        ]));
      }).catch(function () {});
    }

    /* trophy preview — earned first, then nearest to earn */
    var earned = earnedMap();
    var sorted = TROPHIES.slice().sort(function (a, b) {
      return (earned[b.id] ? 1 : 0) - (earned[a.id] ? 1 : 0);
    }).slice(0, 4);
    var openTrophies = function () {
      trophiesView(host, ctx, function () { mainView(host, ctx, prof, iq, totals); });
    };
    host.appendChild(h('div', {
      class: 'm12-preview', role: 'button', tabindex: '0', 'aria-label': t('me.tro.title'),
      onclick: openTrophies, onkeydown: V12.activates(openTrophies)
    }, sorted.map(function (tr) {
      var isE = !!earned[tr.id];
      return h('div', { class: 'm12-mini' + (isE ? ' is-earned is-' + tr.tier : ''), title: t(tr.nk) }, [
        h('i', { class: (isE ? 'ph-fill ' : 'ph-bold ') + tr.icon })
      ]);
    })));

    /* career strip — denominated in basketball */
    host.appendChild(h('div', { class: 'm12-career' }, [
      { v: totals.sessions || 0, l: t('me.career.sessions') },
      { v: totals.shots || 0, l: t('me.career.shots') },
      { v: prof.streak || 0, l: t('me.career.streak') }
    ].map(function (s) {
      return h('div', { class: 'm12-career__i' }, [
        h('div', { class: 'd-num m12-career__v', text: String(s.v) }),
        h('div', { class: 'd-label', text: s.l })
      ]);
    })));

    /* settings / trophies */
    host.appendChild(h('div', { class: 'm12-two' }, [
      V12.card({
        press: true, bgIcon: 'ph-gear-six', bgTone: 'ink', class: 'm12-doortile',
        onClick: function () { settingsView(host, ctx, function () { mainView(host, ctx, prof, iq, totals); }); },
        label: t('me.set.title')
      }, [
        h('i', { class: 'ph-fill ph-gear-six m12-doortile__ic' }),
        h('div', { class: 'm12-doortile__t', text: t('me.tile.settings') })
      ]),
      V12.card({
        press: true, bgIcon: 'ph-trophy', bgTone: 'gold', class: 'm12-doortile',
        onClick: openTrophies, label: t('me.tro.title')
      }, [
        h('i', { class: 'ph-fill ph-trophy m12-doortile__ic m12-doortile__ic--gold' }),
        h('div', { class: 'm12-doortile__t', text: t('me.tile.trophies') })
      ])
    ]));
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    return Promise.all([
      ctx.data.getProfile(),
      window.V10CourtIQ.get(),
      ctx.data.getTotals()
    ]).then(function (r) {
      var main = function () { mainView(host, ctx, r[0] || {}, r[1], r[2] || { sessions: 0, shots: 0 }); };
      /* Coming BACK from a screen that settings opened (notifications,
         avatar, sign-in) should land back IN settings, not on the
         profile front page — the flag is set right before leaving. */
      var returnTo = null;
      try {
        returnTo = sessionStorage.getItem('courtiq_me_return');
        if (returnTo) sessionStorage.removeItem('courtiq_me_return');
      } catch (e) {}
      /* 'settings' (older sessions) or 'settings:<screen>' (current) */
      if (returnTo && returnTo.indexOf('settings') === 0) settingsView(host, ctx, main);
      else main();
    });
  }

  window.app.register('me', render);
})();
