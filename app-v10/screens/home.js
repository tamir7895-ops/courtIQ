/* app-v10/screens/home.js
   HOME — v12, built row-for-row from the user's Paint sketch.

   One viewport, no scrolling. Six rows:
     1  Court IQ (compact number + tier) · avatar
     2  four drill tiles, each a real half-court diagram
     3  the coach line (scout speech bubble)
     4  weekly challenge + prize star
     5  DRILL LIBRARY · START SESSION side by side
     6  bottom nav (lib/nav.js)

   M4 rule unchanged: every number is REAL or the element renders an
   honest empty state. No fixtures.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  /* ── Row 1: Court IQ + avatar ───────────────────────────────── */
  function iqCard(iq, ctx) {
    var kids = [];
    var main = h('div', { style: { minWidth: '0' } });
    main.appendChild(h('div', { class: 'd-label h12-iq__lbl', text: 'COURT IQ' }));

    if (!iq) {
      main.appendChild(h('div', { class: 'd-num h12-iq__num h12-iq__num--empty', text: '—' }));
      main.appendChild(h('div', { class: 'h12-iq__tier', text: 'UNRATED' }));
    } else {
      var num = [document.createTextNode(String(iq.score))];
      if (iq.delta != null && iq.delta !== 0) {
        var tone = iq.delta > 0 ? 'up' : (iq.decayed ? 'flat' : 'down');
        num.push(h('span', {
          class: 'h12-iq__delta h12-iq__delta--' + tone,
          text: (iq.delta > 0 ? '+' : '') + iq.delta,
          title: iq.decayed ? 'Sessions ageing out of the 30-day window'
                            : 'Change vs 7 days ago'
        }));
      }
      main.appendChild(h('div', { class: 'd-num h12-iq__num' }, num));
      main.appendChild(h('div', { class: 'h12-iq__tier', text: iq.tier }));
    }
    kids.push(main);

    /* the print-DNA card: paper, navy border, hard offset shadow */
    return V12.card({
      tint: 'ink', class: 'h12-iq', bgIcon: 'ph-basketball', bgTone: 'orange',
      onClick: function () { ctx.go('track'); },
      label: 'Court IQ — open tracking'
    }, kids);
  }

  function avatarCard(prof, ctx) {
    /* always a face — saved customizer avatar or the DiceBear default */
    var img = h('div', { class: 'h12-av__img' });
    img.style.backgroundImage = 'url(' + V12.avatarUrl(prof) + ')';
    return V12.card({
      class: 'h12-av',
      onClick: function () { ctx.go('me'); },
      label: 'Profile'
    }, [
      h('div', { style: { textAlign: 'center' } }, [
        img,
        h('div', { class: 'h12-av__lv', text: 'LV ' + (prof.level || 1) })
      ])
    ]);
  }

  /* ── Row 2: stat badges — streak / XP / FG% / sessions ────────
     The user's call: badges here, drills live in the library. Every
     number is real; a stat with no evidence shows a dash, never a 0%
     it didn't earn. */
  function statBadges(prof, week, fg, ctx) {
    function badge(mod, icon, value, label, go) {
      return h('div', {
        class: 'h12-badge h12-badge--' + mod,
        role: 'button', tabindex: '0', 'aria-label': label + ': ' + value,
        onclick: function () { ctx.go(go); },
        onkeydown: V12.activates(function () { ctx.go(go); })
      }, [
        h('i', { class: 'ph-fill ' + icon }),
        h('div', { class: 'h12-badge__v', text: value }),
        h('div', { class: 'h12-badge__l', text: label })
      ]);
    }
    return h('div', { class: 'h12-badges' }, [
      badge('streak', 'ph-fire', String(prof.streak || 0), 'Streak', 'me'),
      badge('xp', 'ph-lightning', String(prof.xp || 0), 'XP', 'me'),
      badge('fg', 'ph-target', fg, 'FG · 30D', 'track'),
      badge('week', 'ph-flag-banner', (week.sessions || 0) + '/' + (week.goal || 5), 'This week', 'track')
    ]);
  }

  /* ── Row 3: the coach line ──────────────────────────────────── */
  function coachRow(coach, ctx) {
    var txt;
    if (coach && coach.verdict) {
      txt = h('div', { class: 'h12-coach__txt' }, [
        h('strong', { text: 'Coach: ' }),
        document.createTextNode(coach.verdict)
      ]);
    } else {
      txt = h('div', { class: 'h12-coach__txt' }, [
        h('strong', { text: 'Coach: ' }),
        document.createTextNode('Upload a session video and I start talking — zone by zone.')
      ]);
    }
    return V12.card({
      class: 'h12-coach', bgIcon: 'ph-megaphone', bgTone: 'green',
      onClick: function () { ctx.go('coach'); },
      label: 'Open coach'
    }, [
      h('div', { class: 'h12-coach__face' }, [h('i', { class: 'ph-fill ph-chalkboard-teacher' })]),
      txt,
      h('i', { class: 'ph-bold ph-caret-right h12-coach__chev' })
    ]);
  }

  /* ── Row 4: weekly challenge + prize ────────────────────────── */
  function challengeRow(week, ctx) {
    var cur = Math.min(week.attempts || 0, 100), goal = 100;
    var pct = Math.max(4, Math.min(100, Math.round(cur * 100 / goal)));
    var left = Math.max(0, goal - cur);
    return V12.card({
      tint: 'green', class: 'h12-chal',
      onClick: function () { ctx.go('social'); },
      label: 'Weekly challenge'
    }, [
      h('div', { class: 'h12-chal__main' }, [
        h('div', { class: 'h12-chal__t', text: 'WEEKLY CHALLENGE' }),
        h('div', { class: 'h12-chal__s', text: 'Put up 100 shots this week' }),
        h('div', { class: 'h12-chal__bar' }, [
          h('div', { class: 'h12-chal__fill', style: { width: pct + '%' } })
        ]),
        h('div', { class: 'h12-chal__meta' }, [
          h('span', { text: cur + ' / ' + goal }),
          h('span', { text: left ? left + ' to go' : 'Done! Claim it' })
        ])
      ]),
      h('div', { class: 'h12-chal__hoop' }, [V12.hoopScene(74)])
    ]);
  }

  /* ── Row 5: the two doors — square tiles glued under the challenge */
  function doors(ctx) {
    function door(mod, icon, label, go) {
      return h('button', {
        class: 'h12-door h12-door--' + mod, type: 'button',
        onclick: function () { ctx.go(go); }
      }, [
        h('i', { class: 'ph-fill ' + icon }),
        h('span', { text: label })
      ]);
    }
    return h('div', { class: 'h12-doors' }, [
      door('lib', 'ph-barbell', 'Drill library', 'drill-library'),
      door('start', 'ph-play-circle', 'Start session', 'camera-hud')
    ]);
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;

    return Promise.all([
      ctx.data.getProfile(),
      ctx.data.getWeekStats(),
      ctx.data.getCoachVerdict(),
      ctx.data.getZones(),
      window.V10CourtIQ.get()
    ]).then(function (r) {
      var prof   = r[0] || {};
      var week   = r[1] || { attempts: 0, sessions: 0, goal: 5, days: {} };
      var coach  = r[2];
      var zones  = r[3] || {};
      var iq     = r[4];

      /* FG% only past the same evidence floor the tracking screen uses */
      var made = 0, vatt = 0;
      Object.keys(zones).forEach(function (k) {
        var z = zones[k]; if (!z) return;
        made += z.made || 0; vatt += z.vatt || 0;
      });
      var C = window.V11Court;
      var fg = vatt >= C.MIN_TOTAL ? Math.round(made * 100 / vatt) + '%'
             : (vatt ? made + '/' + vatt : '—');

      var top = h('div', { class: 'h12-top' }, [iqCard(iq, ctx), avatarCard(prof, ctx)]);
      host.appendChild(top);
      host.appendChild(statBadges(prof, week, fg, ctx));
      host.appendChild(coachRow(coach, ctx));
      /* flex spacer above the stack so challenge+doors sit as one glued
         unit at the bottom, against the nav */
      host.appendChild(h('div', { class: 'h12-flex' }));
      host.appendChild(h('div', { class: 'h12-stack' }, [
        challengeRow(week, ctx),
        doors(ctx)
      ]));
    });
  }

  window.app.register('home', render);
})();
