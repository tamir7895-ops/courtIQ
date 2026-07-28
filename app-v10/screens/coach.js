/* app-v10/screens/coach.js — v12
   COACH — the sketch's four rooms:

     COACH NAME/AVATAR   TRAINING CALENDAR
     CHAT WITH COACH     (calendar spans both rows)
     ──────── YOUR TEAM ────────

   The chat is a GUIDED conversation: the scout's opening lines are the
   real derived insights, and the user answers with quick-reply chips
   that produce more real answers (heat-map summary, plan, calendar).
   There is no free-text box because there is no model behind it — a
   text input that pretends to listen is a lie in UI form.

   Voice rule unchanged: every string is a sentence a coach would say
   out loud. No exclamation marks. Silence is a valid output.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h;
  var C = window.V11Court, V12 = window.V12;

  /* ── strings — every user-visible sentence, both languages ────
     Coach NAMES (The Scout, Splash, Flow, Tank) stay English in both. */
  var T = {
    en: {
      'coach.scout.nofilm': 'Nothing on film yet. Upload a session video and I start talking — zone by zone.',
      'coach.scout.unscored': 'Your shots were counted but not scored. Upload a session video and the read starts.',
      'coach.scout.onfilm': '{n} scored shots on film in the last 30 days.',
      'coach.scout.bestworst': 'Best zone: {hot} at {hp}%. Weakest: {cold} at {cp}%.',
      'coach.role.gm': 'GM · runs your whole program',
      'coach.role.splash': 'Shooting coach',
      'coach.role.flow': 'Ball-handling coach',
      'coach.role.tank': 'Strength & conditioning',
      'coach.short.gm': 'The GM',
      'coach.short.splash': 'Shooting',
      'coach.short.flow': 'Handles',
      'coach.short.tank': 'Fitness',
      'coach.opener.splash': 'Splash. Shooting coach. Form, release, footwork into the shot — that is my whole world. What is broken?',
      'coach.opener.flow': 'Flow here. Handles are rhythm — both hands, eyes up, ball on a string. What are we tightening?',
      'coach.opener.tank': 'Tank. Strength and conditioning. We build the motor and protect the knees. What do you need?',
      'coach.starter.gm.0': 'What should I work on?',
      'coach.starter.gm.1': 'How does my week look?',
      'coach.starter.gm.2': 'Build my week around shooting',
      'coach.starter.gm.3': 'Why did my Court IQ move?',
      'coach.starter.splash.0': 'Tips for a better release',
      'coach.starter.splash.1': 'Why am I missing short?',
      'coach.starter.splash.2': 'Fix my free throws',
      'coach.starter.splash.3': 'Give me a shooting drill',
      'coach.starter.flow.0': 'Strengthen my weak hand',
      'coach.starter.flow.1': 'A daily handle routine',
      'coach.starter.flow.2': 'Drill for tight spaces',
      'coach.starter.flow.3': 'How do I protect my dribble?',
      'coach.starter.tank.0': 'Get me game-fit',
      'coach.starter.tank.1': 'My legs die in the second half',
      'coach.starter.tank.2': 'A pre-game warm-up',
      'coach.starter.tank.3': 'How do I jump higher?',
      'coach.board.title': '{name}\'S BOARD',
      'coach.board.run': 'Run it',
      'coach.prop.meta': '{n} sessions · {min} min each',
      'coach.dow.0': 'Mon', 'coach.dow.1': 'Tue', 'coach.dow.2': 'Wed',
      'coach.dow.3': 'Thu', 'coach.dow.4': 'Fri', 'coach.dow.5': 'Sat',
      'coach.dow.6': 'Sun',
      'coach.prop.built': 'In your plan',
      'coach.prop.build': 'Build this into my plan',
      'coach.ans.norate': 'Not enough scored shots from any one spot. Give me {n} from a zone and I rate it.',
      'coach.ans.coldzone': 'Spend 30 reps a session at the {zone}. It sits at {made} of {vatt}. The plan screen has a block for it.',
      'coach.ans.noweek': 'No sessions this week yet. One tonight changes that.',
      'coach.ans.week1': '1 session this week, {att} shots up. Goal is {goal} sessions.',
      'coach.ans.weekN': '{n} sessions this week, {att} shots up. Goal is {goal} sessions.',
      'coach.ans.signin': 'Sign in and I can answer that properly — with your film in front of me. Until then: the quick questions below always work.',
      'coach.err.timeout': 'timed out after 30s',
      'coach.err.network': 'network error',
      'coach.err.local': '(Local answer — the live coach is down: {why})',
      'coach.in.ask': 'Ask {name} anything…',
      'coach.in.guest': 'Sign in for the live coach — chips work now',
      'coach.in.aria': 'Message the coach',
      'coach.in.send': 'Send',
      'coach.hd.back': 'Back',
      'coach.hd.new': 'New conversation',
      'coach.hd.sublive': '{role} · reads your real film',
      'coach.hd.subguest': '{role} · sign in for live answers',
      'coach.chal.claimedbonus': '+{xp} XP · staff sweep +{bonus} XP',
      'coach.chal.claimed': '+{xp} XP',
      'coach.chal.claim': 'Claim +{xp} XP',
      'coach.recap.sess1': '1 session',
      'coach.recap.sessN': '{n} sessions',
      'coach.recap.line': 'New week. Last 7 days: {att} shots across {sess}.',
      'coach.recap.linescored': 'New week. Last 7 days: {att} shots across {sess}, {p}% where scored.',
      'coach.recap.iq': ' Court IQ {score}.',
      'coach.recap.iqdelta': ' Court IQ {score} ({delta} on the week).',
      'coach.recap.zones': ' Hot: {hz} {hp}%. Priority: {cz} {cp}%.',
      'coach.cal.wd': 'S,M,T,W,T,F,S',
      'coach.cal.tip1': '{date} — 1 session',
      'coach.cal.tipN': '{date} — {n} sessions',
      'coach.title': 'Coach',
      'coach.sub': 'Your corner of the gym.',
      'coach.id.onfilm': '{n} scored shots on film',
      'coach.id.waiting': 'Waiting on film',
      'coach.cal.title': 'TRAINING CALENDAR',
      'coach.cal.legend': 'Session day',
      'coach.gym.progress': 'THE GYM — {n}/4 CHALLENGES COLLECTED TODAY',
      'coach.gym.walk': 'THE GYM — WALK UP TO A COACH',
      'coach.gym.label': 'The gym',
      'coach.gym.cones': 'Cones',
      'coach.gym.cart': 'Ball cart',
      'coach.gym.clip': 'Clipboard',
      'coach.gym.you': 'You',
      'coach.gym.walkto': 'Walk to {name} — {role}',
      'coach.tools.lib': 'Drill library',
      'coach.tools.plan': 'Training plan'
    },
    he: {
      'coach.scout.nofilm': 'עדיין אין וידאו. תעלה סרטון אימון ואני מתחיל לדבר — אזור אחרי אזור.',
      'coach.scout.unscored': 'הזריקות שלך נספרו אבל בלי תוצאות. תעלה סרטון אימון והקריאה מתחילה.',
      'coach.scout.onfilm': '{n} זריקות עם תוצאה מהווידאו ב-30 הימים האחרונים.',
      'coach.scout.bestworst': 'האזור הכי חזק: ⁨{hot}⁩ עם {hp}%. הכי חלש: ⁨{cold}⁩ עם {cp}%.',
      'coach.role.gm': '⁨GM⁩ · מנהל לך את כל התוכנית',
      'coach.role.splash': 'מאמן קליעה',
      'coach.role.flow': 'מאמן כדרור',
      'coach.role.tank': 'כוח וכושר',
      'coach.short.gm': 'ה-⁨GM⁩',
      'coach.short.splash': 'קליעה',
      'coach.short.flow': 'כדרור',
      'coach.short.tank': 'כושר',
      'coach.opener.splash': '⁨Splash⁩. מאמן קליעה. טכניקה, שחרור, עבודת רגליים לתוך הזריקה — זה כל העולם שלי. מה שבור?',
      'coach.opener.flow': 'כאן ⁨Flow⁩. כדרור זה קצב — שתי ידיים, עיניים למעלה, כדור על חוט. מה מחדדים?',
      'coach.opener.tank': '⁨Tank⁩. כוח וכושר. בונים את המנוע ושומרים על הברכיים. מה אתה צריך?',
      'coach.starter.gm.0': 'על מה כדאי לי לעבוד?',
      'coach.starter.gm.1': 'איך נראה השבוע שלי?',
      'coach.starter.gm.2': 'תבנה לי שבוע סביב קליעה',
      'coach.starter.gm.3': 'למה ה-⁨Court IQ⁩ שלי זז?',
      'coach.starter.splash.0': 'טיפים לשחרור טוב יותר',
      'coach.starter.splash.1': 'למה אני מחטיא קצר?',
      'coach.starter.splash.2': 'תסדר לי את זריקות העונשין',
      'coach.starter.splash.3': 'תן לי תרגיל קליעה',
      'coach.starter.flow.0': 'לחזק את היד החלשה שלי',
      'coach.starter.flow.1': 'שגרת כדרור יומית',
      'coach.starter.flow.2': 'תרגיל למרחבים צפופים',
      'coach.starter.flow.3': 'איך אני שומר על הכדרור?',
      'coach.starter.tank.0': 'תביא אותי לכושר משחק',
      'coach.starter.tank.1': 'הרגליים שלי מתות בחצי השני',
      'coach.starter.tank.2': 'חימום לפני משחק',
      'coach.starter.tank.3': 'איך קופצים גבוה יותר?',
      'coach.board.title': 'הלוח של ⁨{name}⁩',
      'coach.board.run': 'תריץ את זה',
      'coach.prop.meta': '{n} אימונים · {min} דק׳ כל אחד',
      'coach.dow.0': 'ב׳', 'coach.dow.1': 'ג׳', 'coach.dow.2': 'ד׳',
      'coach.dow.3': 'ה׳', 'coach.dow.4': 'ו׳', 'coach.dow.5': 'שבת',
      'coach.dow.6': 'א׳',
      'coach.prop.built': 'בתוכנית שלך',
      'coach.prop.build': 'תכניס את זה לתוכנית שלי',
      'coach.ans.norate': 'אין מספיק זריקות עם תוצאה מאף עמדה. תן לי {n} מאזור אחד ואני מדרג אותו.',
      'coach.ans.coldzone': 'תשקיע 30 חזרות בכל אימון באזור ⁨{zone}⁩. אתה עומד שם על {made} מתוך {vatt}. יש לזה בלוק במסך התוכנית.',
      'coach.ans.noweek': 'עוד אין אימונים השבוע. אחד הערב משנה את זה.',
      'coach.ans.week1': 'אימון אחד השבוע, {att} זריקות. היעד הוא {goal} אימונים.',
      'coach.ans.weekN': '{n} אימונים השבוע, {att} זריקות. היעד הוא {goal} אימונים.',
      'coach.ans.signin': 'תתחבר ואוכל לענות על זה כמו שצריך — עם הווידאו שלך מולי. עד אז: השאלות המהירות למטה תמיד עובדות.',
      'coach.err.timeout': 'נקטע אחרי 30 שניות',
      'coach.err.network': 'שגיאת רשת',
      'coach.err.local': '(תשובה מקומית — המאמן החי לא זמין: ⁨{why}⁩)',
      'coach.in.ask': 'שאל את ⁨{name}⁩ כל דבר…',
      'coach.in.guest': 'תתחבר בשביל המאמן החי — השאלות המהירות עובדות כבר עכשיו',
      'coach.in.aria': 'הודעה למאמן',
      'coach.in.send': 'שליחה',
      'coach.hd.back': 'חזרה',
      'coach.hd.new': 'שיחה חדשה',
      'coach.hd.sublive': '{role} · קורא את הווידאו האמיתי שלך',
      'coach.hd.subguest': '{role} · תתחבר לתשובות חיות',
      'coach.chal.claimedbonus': '⁨+{xp} XP⁩ · כל הצוות ביום אחד ⁨+{bonus} XP⁩',
      'coach.chal.claimed': '⁨+{xp} XP⁩',
      'coach.chal.claim': 'לאסוף ⁨+{xp} XP⁩',
      'coach.recap.sess1': 'אימון אחד',
      'coach.recap.sessN': '{n} אימונים',
      'coach.recap.line': 'שבוע חדש. 7 הימים האחרונים: {att} זריקות על פני {sess}.',
      'coach.recap.linescored': 'שבוע חדש. 7 הימים האחרונים: {att} זריקות על פני {sess}, {p}% מהזריקות שנמדדו.',
      'coach.recap.iq': ' ⁨Court IQ {score}⁩.',
      'coach.recap.iqdelta': ' ⁨Court IQ {score}⁩ (⁨{delta}⁩ השבוע).',
      'coach.recap.zones': ' חם: ⁨{hz}⁩ {hp}%. עדיפות: ⁨{cz}⁩ {cp}%.',
      'coach.cal.wd': 'א,ב,ג,ד,ה,ו,ש',
      'coach.cal.tip1': '⁨{date}⁩ — אימון אחד',
      'coach.cal.tipN': '⁨{date}⁩ — {n} אימונים',
      'coach.title': 'מאמן',
      'coach.sub': 'הפינה שלך באולם.',
      'coach.id.onfilm': '{n} זריקות עם תוצאה מהווידאו',
      'coach.id.waiting': 'מחכה לווידאו',
      'coach.cal.title': 'לוח אימונים',
      'coach.cal.legend': 'יום אימון',
      'coach.gym.progress': 'האולם — {n}/4 אתגרים נאספו היום',
      'coach.gym.walk': 'האולם — גש אל אחד המאמנים',
      'coach.gym.label': 'האולם',
      'coach.gym.cones': 'קונוסים',
      'coach.gym.cart': 'עגלת כדורים',
      'coach.gym.clip': 'לוח טקטיקה',
      'coach.gym.you': 'אתה',
      'coach.gym.walkto': 'ללכת אל ⁨{name}⁩ — {role}',
      'coach.tools.lib': 'ספריית תרגילים',
      'coach.tools.plan': 'תוכנית אימונים'
    }
  };
  if (window.V12I18n) V12I18n.add(T);
  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

  function totals(zones) {
    var att = 0, made = 0, vatt = 0;
    Object.keys(zones || {}).forEach(function (k) {
      var z = zones[k]; if (!z) return;
      att += z.att || 0; made += z.made || 0; vatt += z.vatt || 0;
    });
    return { att: att, made: made, vatt: vatt };
  }

  function ranked(zones, mean) {
    return Object.keys(zones || {}).filter(function (k) {
      return C.state(zones[k]) === 'rated';
    }).sort(function (a, b) {
      return C.shrunkAcc(zones[b], mean) - C.shrunkAcc(zones[a], mean);
    });
  }

  /* ── the scout's real lines, computed once ────────────────────*/
  function scoutLines(data) {
    var tot = data.t, rank = data.rank, zones = data.zones, coach = data.coach;
    var lines = [];
    if (!tot.att) {
      lines.push(t('coach.scout.nofilm'));
    } else if (!tot.vatt) {
      lines.push(t('coach.scout.unscored'));
    } else {
      lines.push(t('coach.scout.onfilm', { n: tot.vatt }));
      if (coach && coach.verdict) lines.push(coach.verdict);
      if (rank.length >= 2) {
        var hot = rank[0], cold = rank[rank.length - 1];
        var hz = zones[hot], cz = zones[cold];
        lines.push(t('coach.scout.bestworst', {
          hot: C.LABEL[hot], hp: Math.round(hz.made / hz.vatt * 100),
          cold: C.LABEL[cold], cp: Math.round(cz.made / cz.vatt * 100)
        }));
      }
    }
    return lines;
  }

  /* ── chat view ────────────────────────────────────────────────
     Signed in: a real conversation — V12CoachAI carries the player's
     actual zones, sessions, plan and Court IQ to Claude through the
     claude-proxy edge function, and the model can adjust the plan via
     the @@ACTION protocol.
     Signed out: the proxy 401s, so guests keep the local guided
     answers — labelled as such, never pretending to be live. */
  /* ── the coaching staff — the Duolingo cast, basketball edition ──
     Four characters, four faces, four brains: the GM runs the program,
     the specialists own their lane. DiceBear faces are deterministic
     (fixed seeds), so every player meets the same four coaches. */
  var COACHES = [
    { id: 'gm', name: 'The Scout', seed: 'courtiq-the-scout', bg: 'b6e3f4' },
    { id: 'splash', name: 'Splash', seed: 'courtiq-splash-7', bg: 'ffd5dc' },
    { id: 'flow', name: 'Flow', seed: 'courtiq-flow-3', bg: 'd1f4d1' },
    { id: 'tank', name: 'Tank', seed: 'courtiq-tank-9', bg: 'ffdfbf' }
  ];
  /* role/short/opener/starters live in T (both languages, keys
     coach.role.* / coach.short.* / coach.opener.* / coach.starter.*.0-3)
     and resolve at READ time — a language switch needs no reload, and
     every consumer of the cast (this screen, onboarding) follows the
     chosen language automatically. */
  COACHES.forEach(function (c) {
    function lazy(field, key) {
      Object.defineProperty(c, field, {
        enumerable: true,
        get: function () { return t(key); }
      });
    }
    lazy('role', 'coach.role.' + c.id);
    lazy('short', 'coach.short.' + c.id);
    if (c.id !== 'gm') lazy('opener', 'coach.opener.' + c.id);
    Object.defineProperty(c, 'starters', {
      enumerable: true,
      get: function () {
        var out = [];
        for (var i = 0; i < 4; i++) out.push(t('coach.starter.' + c.id + '.' + i));
        return out;
      }
    });
  });
  function coachFace(c, size) {
    return 'https://api.dicebear.com/9.x/avataaars/png?size=' + (size || 96) +
      '&seed=' + encodeURIComponent(c.seed) + '&backgroundColor=' + c.bg;
  }
  // Shared with onboarding — the cast greets new players there too.
  window.V12CoachCast = COACHES;
  window.V12CoachFace = coachFace;

  function chatView(host, ctx, data, back, coach) {
    while (host.firstChild) host.removeChild(host.firstChild);
    coach = coach || COACHES[0];
    if (window.V12CoachAI && window.V12CoachAI.setPersona) {
      window.V12CoachAI.setPersona(coach.id);
    }

    var live = !!(window.V12CoachAI && window.V12CoachAI.signedIn());
    var thread = h('div', { class: 'c12-thread c12-thread--' + coach.id });
    var chips = h('div', { class: 'c12-chips' });
    var busy = false;

    /* Starter chips greet an empty room; the moment a real exchange
       exists they are furniture in the way — fade them out. */
    var chipsGone = false;
    function dropChips() {
      if (chipsGone) return;
      chipsGone = true;
      chips.classList.add('is-leaving');
      setTimeout(function () { chips.remove(); }, 260);
    }

    function coachSay(text) {
      var b = h('div', { class: 'c12-msg c12-msg--coach' }, [
        /* the coach's own face on every bubble — characters, not icons */
        V12.faceImg({ class: 'c12-msg__face c12-msg__face--img', src: coachFace(coach, 64), alt: '' }),
        h('div', { class: 'c12-msg__bubble', text: text })
      ]);
      thread.appendChild(b);
      thread.scrollTop = thread.scrollHeight;
      return b;
    }
    function userSay(text) {
      thread.appendChild(h('div', { class: 'c12-msg c12-msg--user' }, [
        h('div', { class: 'c12-msg__bubble c12-msg__bubble--user', text: text })
      ]));
      thread.scrollTop = thread.scrollHeight;
    }
    function typing() {
      var t = coachSay('…');
      t.classList.add('c12-msg--typing');
      return t;
    }

    /* ── the tactics board ──────────────────────────────────────────
       When a coach names a drill, he pulls out the clipboard: the
       drill's real choreography, framed like a coach's board, with a
       button that starts it. Detection is by exact library name in
       the reply — the server prompt tells coaches to name drills
       verbatim, and this is why. */
    function drillBoard(text) {
      try {
        if (!window.V12DrillChoreo || !window.V12DrillCourt || typeof _DRILLS_DB === 'undefined') return;
        var hit = null, low = String(text || '').toLowerCase();
        for (var i = 0; i < _DRILLS_DB.length; i++) {
          if (low.indexOf(_DRILLS_DB[i].name.toLowerCase()) >= 0) { hit = _DRILLS_DB[i]; break; }
        }
        if (!hit) return;
        var c = window.V12DrillChoreo.get(hit);
        if (!c) return;
        var board = h('div', { class: 'c12-board' }, [
          h('div', { class: 'c12-board__hd' }, [
            h('i', { class: 'ph-fill ph-clipboard' }),
            h('span', { text: t('coach.board.title', { name: coach.name.toUpperCase() }) })
          ]),
          window.V12DrillCourt.render(c, {
            label: window.V12Drills ? V12Drills.name(hit) : hit.name }),
          h('div', { class: 'c12-board__ft' }, [
            h('div', { class: 'c12-board__n', text: hit.name }),
            h('button', {
              class: 'c12-board__go', type: 'button',
              onclick: function () {
                try {
                  sessionStorage.setItem('courtiq_v11_drill', JSON.stringify({
                    id: hit.id, name: hit.name,
                    reps: hit.reps_or_sets ? parseInt(String(hit.reps_or_sets), 10) || 30 : 30,
                    mins: hit.duration_minutes || 8,
                    focus: hit.focus_area || 'Skill',
                    description: hit.description || ''
                  }));
                } catch (e) {}
                ctx.go('workout-player');
              }
            }, [h('i', { class: 'ph-fill ph-play-circle' }), h('span', { text: t('coach.board.run') })])
          ])
        ]);
        thread.appendChild(board);
        thread.scrollTop = thread.scrollHeight;
      } catch (e) { /* the board is a bonus — never break the chat for it */ }
    }

    /* The coach proposed a program — render it as a card with the ONE
       button that actually writes it into the plan. Until that tap,
       nothing changed. */
    /* Monday-first — MUST match V12Plan.DOW (schedule index 0 = Monday).
       Day names live in T as coach.dow.0..6. */
    function proposalCard(p) {
      var card = h('div', { class: 'c12-proposal' });
      card.appendChild(h('div', { class: 'c12-proposal__t', text: p.name }));
      card.appendChild(h('div', {
        class: 'c12-proposal__s',
        text: t('coach.prop.meta', { n: p.days.length, min: p.minutes })
      }));
      p.days.forEach(function (d) {
        card.appendChild(h('div', { class: 'c12-proposal__day' }, [
          h('span', { class: 'c12-proposal__dow', text: t('coach.dow.' + d.dow) }),
          h('span', {
            class: 'c12-proposal__what',
            text: d.drills.length
              ? d.drills.map(function (nm) {
                  return window.V12Drills ? V12Drills.name(nm) : nm;
                }).join(' · ')
              : d.focus
          })
        ]));
      });
      var btn = h('button', {
        class: 'c12-proposal__build', type: 'button',
        onclick: function () {
          var msg = window.V12CoachAI.applyProposal(p);
          btn.disabled = true;
          btn.textContent = t('coach.prop.built');
          if (msg) coachSay(msg);
          try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
          try {
            if (window.V10UI && window.V10UI.confetti) window.V10UI.confetti({ count: 18 });
          } catch (e2) {}
        }
      }, [
        h('i', { class: 'ph-fill ph-hammer' }),
        h('span', { text: t('coach.prop.build') })
      ]);
      card.appendChild(btn);
      thread.appendChild(card);
      thread.scrollTop = thread.scrollHeight;
    }

    /* Local answers — the guest path, and the safety net when the
       proxy is down. Same voice, same real numbers. */
    function localAnswer(q) {
      var rank = data.rank, w = data.week || {};
      /* the Hebrew alternates route the translated starter chips to the
         same answers their English twins get */
      if (/work on|improve|weak|לעבוד|לשפר|חלש/i.test(q)) {
        if (!rank.length) return t('coach.ans.norate', { n: C.MIN_VERDICTS });
        var cold = rank[rank.length - 1];
        var cz = data.zones[cold];
        return t('coach.ans.coldzone', {
          zone: C.LABEL[cold].toLowerCase(), made: cz.made, vatt: cz.vatt
        });
      }
      if (/week|today|שבוע|היום/i.test(q)) {
        if (!w.sessions) return t('coach.ans.noweek');
        return t(w.sessions === 1 ? 'coach.ans.week1' : 'coach.ans.weekN',
          { n: w.sessions, att: w.attempts || 0, goal: w.goal || 5 });
      }
      return t('coach.ans.signin');
    }

    function send(q) {
      if (busy || !q) return;
      userSay(q);
      dropChips();
      try { if (navigator.vibrate) navigator.vibrate(10); } catch (e0) {}
      if (!live) {
        setTimeout(function () { coachSay(localAnswer(q)); }, 380);
        return;
      }
      busy = true;
      var tp = typing();
      window.V12CoachAI.ask(q, data, ctx).then(function (r) {
        tp.remove(); busy = false;
        coachSay(r.text);
        drillBoard(r.text);
        if (r.proposal) proposalCard(r.proposal);
        if (r.confirmation) coachSay(r.confirmation);
      }).catch(function (e) {
        tp.remove(); busy = false;
        if (e && e.guest) { live = false; coachSay(localAnswer(q)); return; }
        /* proxy down ≠ coach silent: answer locally, and say the REAL
           reason — a canned "try again" line hid a dead API key for a
           whole day because every failure read identically. */
        coachSay(localAnswer(q));
        var why = (e && e.message) ? e.message :
                  (e && e.name === 'AbortError') ? t('coach.err.timeout') : t('coach.err.network');
        coachSay(t('coach.err.local', { why: why }));
      });
    }

    var STARTERS = coach.starters;
    STARTERS.forEach(function (q) {
      chips.appendChild(h('button', {
        class: 'c12-chip', type: 'button',
        onclick: function () { send(q); }
      }, [h('span', { text: q })]));
    });

    /* free-text row — the reason this screen exists now */
    var input = h('input', {
      class: 'c12-chat-in__field', type: 'text',
      placeholder: live ? t('coach.in.ask', { name: coach.name }) : t('coach.in.guest'),
      'aria-label': t('coach.in.aria'), maxlength: '280', autocomplete: 'off'
    });
    var sendBtn = h('button', {
      class: 'c12-chat-in__send', type: 'button', 'aria-label': t('coach.in.send'),
      onclick: function () { var q = input.value.trim(); input.value = ''; send(q); }
    }, [h('i', { class: 'ph-fill ph-paper-plane-right' })]);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); sendBtn.click(); }
    });

    /* Back does NOT reset — a coach remembers the conversation. Starting
       over is an explicit small control in the header instead. */
    host.appendChild(h('div', { class: 'c12-chat-hd' }, [
      h('button', {
        class: 'c12-back', type: 'button', 'aria-label': t('coach.hd.back'),
        onclick: back
      }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
      V12.faceImg({ class: 'c12-chat-hd__face', src: coachFace(coach, 72), alt: '' }),
      h('div', { style: { flex: '1', minWidth: '0' } }, [
        h('div', { class: 'c12-chat-hd__t', text: coach.name }),
        h('div', { class: 'c12-chat-hd__s',
          text: t(live ? 'coach.hd.sublive' : 'coach.hd.subguest', { role: coach.role }) })
      ]),
      h('button', {
        class: 'c12-back', type: 'button', 'aria-label': t('coach.hd.new'),
        title: t('coach.hd.new'),
        onclick: function () {
          if (window.V12CoachAI) window.V12CoachAI.reset();
          chatView(host, ctx, data, back, coach);
        }
      }, [h('i', { class: 'ph-bold ph-arrows-counter-clockwise' })])
    ]));
    host.appendChild(thread);
    host.appendChild(chips);
    host.appendChild(h('div', { class: 'c12-chat-in' }, [input, sendBtn]));

    /* Replay the running conversation if one exists; otherwise open with
       the scout's real derived lines. sync() first pulls the account's
       memory row (other device, reinstall) — resolves instantly for
       guests or once already synced this launch. */
    /* the coach's daily challenge sits at the top of his room —
       real progress only, XP on claim */
    (function challengeCard() {
      if (!window.V12Challenges) return;
      var s = window.V12Challenges.state(coach.id, data);
      if (!s || s.claimed) return;
      var pct = Math.round(s.done / s.total * 100);
      var bar = h('div', { class: 'c12-chal__bar' }, [
        h('div', { class: 'c12-chal__fill', style: { width: pct + '%' } })
      ]);
      var btn = h('button', {
        class: 'c12-chal__btn', type: 'button', disabled: s.complete ? undefined : 'disabled',
        onclick: function () {
          var r = window.V12Challenges.claim(coach.id, data);
          if (r) {
            btn.disabled = true;
            btn.textContent = r.bonus
              ? t('coach.chal.claimedbonus', { xp: window.V12Challenges.XP, bonus: window.V12Challenges.BONUS })
              : t('coach.chal.claimed', { xp: window.V12Challenges.XP });
            try { if (window.V11Audio && V11Audio.ok) V11Audio.ok(); } catch (e0) {}
            try {
              if (window.V10UI && window.V10UI.confetti) {
                window.V10UI.confetti({ count: r.bonus ? 40 : 16 });
              }
            } catch (e) {}
          }
        }
      }, [h('span', { text: s.complete ? t('coach.chal.claim', { xp: window.V12Challenges.XP }) : s.done + '/' + s.total })]);
      thread.appendChild(h('div', { class: 'c12-chal' }, [
        h('div', { class: 'c12-chal__hd' }, [
          h('i', { class: 'ph-fill ph-basketball' }),
          h('span', { text: s.title.toUpperCase() })
        ]),
        h('div', { class: 'c12-chal__task', text: s.task }),
        bar, btn
      ]));
    })();

    /* ── the Monday walkthrough — once per ISO week, the GM opens with
       a recap built from REAL film (client-side, zero API cost) ──── */
    function weeklyRecap() {
      if (coach.id !== 'gm') return;
      try {
        var now = new Date();
        var monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        var weekKey = monday.toISOString().slice(0, 10);
        if (localStorage.getItem('courtiq_scout_recap') === weekKey) return;
        var weekAgo = Date.now() - 7 * 86400000;
        var n = 0, att = 0, made = 0, scored = 0;
        (data.sessions || []).forEach(function (s) {
          var t = new Date(s.session_date || s.created_at).getTime();
          if (!(t > weekAgo)) return;
          n++; att += (s.total_attempts || 0);
          if (s.total_made != null) { made += s.total_made; scored += (s.total_attempts || 0); }
        });
        if (!n) return;                      /* silent week — nothing to recap */
        var sess = n > 1 ? t('coach.recap.sessN', { n: n }) : t('coach.recap.sess1');
        var line = scored >= 20
          ? t('coach.recap.linescored', { att: att, sess: sess, p: Math.round(made * 100 / scored) })
          : t('coach.recap.line', { att: att, sess: sess });
        if (data.iq) {
          line += (data.iq.delta != null && data.iq.delta !== 0)
            ? t('coach.recap.iqdelta', {
                score: data.iq.score,
                delta: (data.iq.delta > 0 ? '+' : '') + data.iq.delta
              })
            : t('coach.recap.iq', { score: data.iq.score });
        }
        if (data.rank && data.rank.length) {
          var C2 = window.V11Court;
          var hot = data.rank[0], cold = data.rank[data.rank.length - 1];
          var zh = data.zones[hot], zc = data.zones[cold];
          if (zh && zc && hot !== cold) {
            line += t('coach.recap.zones', {
              hz: C2.LABEL[hot] || hot, hp: Math.round(zh.made * 100 / zh.vatt),
              cz: C2.LABEL[cold] || cold, cp: Math.round(zc.made * 100 / zc.vatt)
            });
          }
        }
        coachSay(line);
        localStorage.setItem('courtiq_scout_recap', weekKey);
      } catch (e) { /* a recap is a bonus, never a blocker */ }
    }
    weeklyRecap();

    function replay() {
      var past = (live && window.V12CoachAI.transcript) ? window.V12CoachAI.transcript() : [];
      if (past.length) {
        dropChips();             /* mid-conversation: no starter chips */
        past.forEach(function (m) {
          if (m.role === 'user') userSay(m.content);
          else {
            /* strip any action line from stored assistant turns */
            var clean = m.content.replace(/@@ACTION\s+\{[^\n]*\}\s*$/, '').replace(/\s+$/, '');
            coachSay(clean);
            drillBoard(clean);   /* boards survive reopening the chat */
          }
        });
      } else if (coach.id === 'gm') {
        scoutLines(data).forEach(coachSay);
      } else {
        coachSay(coach.opener);
      }
    }
    if (live && window.V12CoachAI.sync) window.V12CoachAI.sync().then(replay, replay);
    else replay();
  }

  /* ── training calendar — last 4 weeks, real session days ─────*/
  function calendar(sessions) {
    var byDay = {};
    (sessions || []).forEach(function (s) {
      var d = (s.session_date || s.created_at || '').slice(0, 10);
      if (d) byDay[d] = (byDay[d] || 0) + 1;
    });
    var today = new Date(); today.setHours(12, 0, 0, 0);
    /* grid starts on the Sunday 3 weeks back */
    var start = new Date(today.getTime() - ((21 + today.getDay()) * 86400000));
    var wrap = h('div', { class: 'c12-cal' });
    t('coach.cal.wd').split(',').forEach(function (d) {
      wrap.appendChild(h('div', { class: 'c12-cal__wd', text: d }));
    });
    for (var i = 0; i < 28; i++) {
      var d = new Date(start.getTime() + i * 86400000);
      var key = d.toISOString().slice(0, 10);
      var isToday = d.toDateString() === today.toDateString();
      var future = d > today;
      var did = byDay[key];
      wrap.appendChild(h('div', {
        class: 'c12-cal__d' + (did ? ' is-did' : '') + (isToday ? ' is-today' : '') +
               (future ? ' is-future' : ''),
        title: did
          ? t(did > 1 ? 'coach.cal.tipN' : 'coach.cal.tip1', { date: key, n: did })
          : key
      }, [h('span', { text: d.getDate() })]));
    }
    return wrap;
  }

  /* ── main view ────────────────────────────────────────────────*/
  function mainView(host, ctx, data) {
    while (host.firstChild) host.removeChild(host.firstChild);
    host.appendChild(V12.header(t('coach.title'), t('coach.sub')));

    /* film status + calendar — stacked full-width, not a cramped grid */
    var grid = h('div', { class: 'c12-stack2' });

    /* coach identity — a wide strip: face left, film status right */
    grid.appendChild(V12.card({
      tint: 'ink', class: 'c12-id c12-id--wide', bgIcon: 'ph-strategy', bgTone: 'green'
    }, [
      h('div', { class: 'c12-id__face' }, [h('i', { class: 'ph-fill ph-chalkboard-teacher' })]),
      h('div', { class: 'c12-id__txt' }, [
        h('div', { class: 'c12-id__n', text: 'THE SCOUT' }),
        h('div', { class: 'c12-id__s', text: data.t.vatt ? t('coach.id.onfilm', { n: data.t.vatt }) : t('coach.id.waiting') })
      ])
    ]));

    /* training calendar — full width */
    grid.appendChild(V12.card({ class: 'c12-calcard' }, [
      h('div', { class: 'd-label', text: t('coach.cal.title') }),
      calendar(data.sessions),
      h('div', { class: 'c12-cal__lg' }, [
        h('span', { class: 'c12-cal__dot' }), h('span', { text: t('coach.cal.legend') })
      ])
    ]));

    /* ── THE GYM — the Duolingo world, on our court ─────────────────
       One guided scene, not an open map: the real half court, the four
       coaches standing at their spots, and YOUR avatar. Tap a coach and
       your player walks over, then the conversation opens. A pulsing
       ball badge on a coach means his daily challenge is waiting. */
    var claimedN = window.V12Challenges ? window.V12Challenges.claimedToday() : 0;
    host.appendChild(h('div', {
      class: 'd-label c12-staff__label',
      text: claimedN > 0
        ? t('coach.gym.progress', { n: claimedN })
        : t('coach.gym.walk')
    }));
    var SPOTS = {                    /* % of the scene box, x/y */
      gm:     { x: 50, y: 56 },      /* free-throw line — runs the floor */
      splash: { x: 82, y: 26 },      /* right corner three — his office */
      flow:   { x: 18, y: 40 },      /* left wing — space to dance */
      tank:   { x: 72, y: 84 },      /* sideline — cones and pain */
      player: { x: 28, y: 88 }       /* you, walking in from the corner */
    };
    var scene = h('div', { class: 'c12-gym' });
    try {
      scene.appendChild(window.V12DrillCourt.render({}, { still: true, label: t('coach.gym.label') }));
    } catch (e) { scene.appendChild(V12.courtThumb('Shooting', 0, { label: t('coach.gym.label') })); }

    /* props — the difference between a menu and a place */
    var svgNS = 'http://www.w3.org/2000/svg';
    function prop(x, y, w, inner, label) {
      var el = document.createElementNS(svgNS, 'svg');
      el.setAttribute('viewBox', '0 0 40 40');
      el.setAttribute('class', 'c12-gym__prop');
      el.setAttribute('aria-label', label || '');
      el.setAttribute('style', 'left:' + x + '%;top:' + y + '%;width:' + w + 'px');
      el.innerHTML = inner;
      return el;
    }
    /* one cone, drawn like the real thing: lit from the left, a
       reflective band, a base, and a soft ground shadow */
    function coneAt(cx) {
      return '<g transform="translate(' + cx + ' 0)">' +
        '<ellipse cx="11" cy="33.5" rx="9" ry="2.4" fill="#000" opacity=".14"/>' +
        '<path d="M5 31 L9.4 13 Q11 10.5 12.6 13 L17 31 Z" fill="url(#cqConeG)"/>' +
        '<path d="M7.4 24.5 L8.5 20 L13.5 20 L14.6 24.5 Z" fill="#FFFFFF" opacity=".92"/>' +
        '<rect x="3" y="30" width="16" height="3.6" rx="1.8" fill="#D97706"/>' +
        '<rect x="3" y="30" width="16" height="1.6" rx="0.8" fill="#F59E0B"/>' +
      '</g>';
    }
    var CONE_DEFS =
      '<defs><linearGradient id="cqConeG" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#FFB84D"/><stop offset=".45" stop-color="#F59E0B"/>' +
      '<stop offset="1" stop-color="#C2620A"/></linearGradient>' +
      '<radialGradient id="cqBallG" cx=".35" cy=".3" r=".85">' +
      '<stop offset="0" stop-color="#FF8F45"/><stop offset=".6" stop-color="#E8590C"/>' +
      '<stop offset="1" stop-color="#B23F05"/></radialGradient>' +
      '<linearGradient id="cqSteelG" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#CBD2DC"/><stop offset=".5" stop-color="#9AA4B2"/>' +
      '<stop offset="1" stop-color="#6C7684"/></linearGradient></defs>';
    function ball(cx, cy, r) {
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#cqBallG)"/>' +
        '<path d="M' + (cx - r) + ' ' + cy + ' a' + r + ' ' + r + ' 0 0 1 ' + (2 * r) + ' 0" ' +
          'fill="none" stroke="#7A2E08" stroke-width=".9" opacity=".85"/>' +
        '<path d="M' + cx + ' ' + (cy - r) + ' q' + (r * 0.9) + ' ' + r + ' 0 ' + (2 * r) + '" ' +
          'fill="none" stroke="#7A2E08" stroke-width=".9" opacity=".85"/>' +
        '<ellipse cx="' + (cx - r * 0.35) + '" cy="' + (cy - r * 0.45) + '" rx="' + (r * 0.32) + '" ry="' + (r * 0.2) + '" fill="#FFC49A" opacity=".7"/>';
    }

    /* three cones by Tank's sideline */
    var cones = prop(60, 90, 44, CONE_DEFS, t('coach.gym.cones'));
    cones.setAttribute('viewBox', '0 0 66 40');
    cones.innerHTML += coneAt(0) + coneAt(22) + coneAt(44);
    scene.appendChild(cones);

    /* steel ball cart in Splash's corner office */
    var rack = prop(91, 33, 36,
      '<ellipse cx="20" cy="36.5" rx="15" ry="2.6" fill="#000" opacity=".14"/>' +
      '<rect x="5" y="17" width="30" height="16" rx="4" fill="none" stroke="url(#cqSteelG)" stroke-width="3"/>' +
      '<line x1="5" y1="25" x2="35" y2="25" stroke="url(#cqSteelG)" stroke-width="2"/>' +
      '<circle cx="11" cy="35" r="2.6" fill="#3B4350"/><circle cx="29" cy="35" r="2.6" fill="#3B4350"/>' +
      '<circle cx="11" cy="35" r="1" fill="#9AA4B2"/><circle cx="29" cy="35" r="1" fill="#9AA4B2"/>' +
      ball(12, 13, 5.6) + ball(23, 14.5, 5.6) + ball(31, 11.5, 5.2),
      t('coach.gym.cart'));
    scene.appendChild(rack);

    /* the Scout's clipboard — court print and a metal clip */
    scene.appendChild(prop(58, 60, 26,
      '<ellipse cx="20" cy="36" rx="10" ry="2" fill="#000" opacity=".12"/>' +
      '<rect x="9" y="5" width="22" height="30" rx="3.5" fill="#B4854D"/>' +
      '<rect x="11.5" y="8.5" width="17" height="24" rx="2" fill="#FFF9EF"/>' +
      '<path d="M14 30 A6 6 0 0 1 26 30" fill="none" stroke="#1C7ED6" stroke-width="1.4"/>' +
      '<rect x="16.5" y="27" width="7" height="5.5" fill="none" stroke="#1C7ED6" stroke-width="1.2"/>' +
      '<circle cx="20" cy="15" r="2.2" fill="none" stroke="#E8590C" stroke-width="1.3"/>' +
      '<path d="M13 12 L18 20 M27 12 L22 20" stroke="#0A2850" stroke-width="1.2" stroke-dasharray="2 1.6"/>' +
      '<rect x="14.5" y="2.5" width="11" height="6" rx="2.5" fill="url(#cqSteelG)"/>' +
      '<rect x="17.5" y="0.8" width="5" height="4" rx="2" fill="#6C7684"/>',
      t('coach.gym.clip')));

    var walking = false;
    var me = V12.faceImg({
      class: 'c12-gym__me', alt: t('coach.gym.you'),
      src: V12.avatarUrl(data.prof),
      style: { left: SPOTS.player.x + '%', top: SPOTS.player.y + '%' }
    });

    COACHES.forEach(function (c) {
      var chal = window.V12Challenges ? window.V12Challenges.state(c.id, data) : null;
      var badge = (chal && !chal.claimed)
        ? h('span', { class: 'c12-gym__badge' + (chal.complete ? ' is-ready' : '') }, [
            h('i', { class: 'ph-fill ph-basketball' })
          ])
        : null;
      scene.appendChild(h('button', {
        class: 'c12-gym__coach', type: 'button',
        'aria-label': t('coach.gym.walkto', { name: c.name, role: c.role }),
        style: { left: SPOTS[c.id].x + '%', top: SPOTS[c.id].y + '%' },
        onclick: function (ev) {
          if (walking) return;
          walking = true;
          try { if (window.V11Audio && V11Audio.tick) V11Audio.tick(); } catch (e0) {}
          me.classList.add('is-walking');
          me.style.left = (SPOTS[c.id].x - 11) + '%';
          me.style.top = SPOTS[c.id].y + '%';
          /* he sees you coming — a beat of acknowledgement, then talk */
          var coachBtn = ev.currentTarget;
          setTimeout(function () {
            coachBtn.appendChild(h('span', { class: 'c12-gym__hi', text: '…' }));
          }, 650);
          setTimeout(function () {
            chatView(host, ctx, data, function () { mainView(host, ctx, data); }, c);
          }, 1150);
        }
      }, [
        V12.faceImg({ class: 'c12-gym__face', src: coachFace(c, 96), alt: '' }),
        h('span', { class: 'c12-gym__name', text: c.name }),
        badge
      ].filter(Boolean)));
    });
    scene.appendChild(me);
    host.appendChild(scene);

    /* the training tools moved in with the staff — library + plan.
       Bigger cards (the Track button left this page), ghost icon corner
       like the home doors. */
    function toolDoor(mod, icon, label, go) {
      return h('button', {
        class: 'c12-tools__b c12-tools__b--' + mod, type: 'button', 'aria-label': label,
        onclick: function () { ctx.go(go); }
      }, [
        h('div', { class: 'c12-tools__ic' }, [h('i', { class: 'ph-fill ' + icon })]),
        h('span', { class: 'c12-tools__t', text: label }),
        h('i', { class: 'ph-fill ' + icon + ' c12-tools__bg', 'aria-hidden': 'true' })
      ]);
    }
    host.appendChild(h('div', { class: 'c12-tools' }, [
      toolDoor('lib', 'ph-barbell', t('coach.tools.lib'), 'drill-library'),
      toolDoor('plan', 'ph-clipboard-text', t('coach.tools.plan'), 'plan')
    ]));

    /* claims made on another device land here — pull once per launch,
       repaint the badges if anything new arrived */
    if (window.V12Challenges && window.V12Challenges.sync && !mainView._chalSynced) {
      mainView._chalSynced = true;
      window.V12Challenges.sync().then(function (changed) {
        if (changed && host.querySelector('.c12-gym')) mainView(host, ctx, data);
      }, function () {});
    }

    /* the film-status strip + calendar close the page (TRACK A SESSION
       left — the Track tab and home door already own that action) */
    host.appendChild(grid);
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    return Promise.all([
      ctx.data.getCoachVerdict(),
      ctx.data.getZones(),
      ctx.data.getSessions(60),
      ctx.data.getWeekStats(),
      ctx.data.getProfile(),
      window.V10CourtIQ ? window.V10CourtIQ.get() : Promise.resolve(null),
      ctx.data.getShots ? ctx.data.getShots(30) : Promise.resolve([])
    ]).then(function (r) {
      var zones = r[1] || {};
      var mean = C.playerMean(zones);
      var sessions = r[2] || [];
      var shots = r[6] || [];
      var data = {
        coach: r[0], zones: zones, sessions: sessions, week: r[3] || {},
        t: totals(zones), rank: ranked(zones, mean),
        /* the AI coach grounds its answers in these — real or absent */
        prof: r[4] || {}, iq: r[5] || null,
        plan: (window.V12Plan && window.V12Plan.load) ? window.V12Plan.load() : null,
        /* derived reads: trends, fade, consistency, rhythm — computed
           from raw shots so the coach sees direction, not just level */
        insights: window.V12Insights ? window.V12Insights.compute(shots, sessions) : null,
        drills: window.V12Insights ? window.V12Insights.drillCatalog(['Shooting', 'Ball Handling'], 24) : []
      };
      mainView(host, ctx, data);
    });
  }

  window.app.register('coach', render);
})();
