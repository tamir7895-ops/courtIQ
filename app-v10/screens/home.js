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

  /* The XP rank name (ROOKIE / HOOPER / ALL-STAR / MVP) from the real
     XP system — the "level like BEGINNER" the summary card shows. */
  function xpRank(prof) {
    try {
      if (window.XPSystem && window.XPSystem.getLevel) {
        var l = window.XPSystem.getLevel(prof.xp || 0);
        if (l && l.name) return l.name;
      }
    } catch (e) {}
    return 'Rookie';
  }

  /* ── Row 1: the player summary card ───────────────────────────
     A small dossier: name, Court IQ (+ its percentage rate), the XP
     rank, and the player's avatar on the right — where the basketball
     used to sit. Two tap targets: the body opens tracking, the avatar
     opens the profile. */
  function summaryCard(prof, iq, fg, ctx) {
    var goTrack = function () { ctx.go('track'); };
    var goMe = function () { ctx.go('me'); };

    /* left: name + Court IQ + rank */
    var iqRow = h('div', { class: 'h12-sum__iqrow' });
    if (!iq) {
      iqRow.appendChild(h('div', { class: 'd-num h12-sum__score h12-sum__score--empty', text: '—' }));
      iqRow.appendChild(h('div', { class: 'h12-sum__tier', text: 'UNRATED' }));
    } else {
      iqRow.appendChild(h('div', { class: 'd-num h12-sum__score', text: String(iq.score) }));
      var tone = (iq.delta != null && iq.delta !== 0)
        ? (iq.delta > 0 ? 'up' : (iq.decayed ? 'flat' : 'down')) : null;
      var tierKids = [h('span', { class: 'h12-sum__tier', text: iq.tier })];
      if (tone) tierKids.push(h('span', {
        class: 'h12-sum__delta h12-sum__delta--' + tone,
        text: (iq.delta > 0 ? '+' : '') + iq.delta
      }));
      iqRow.appendChild(h('div', {}, tierKids));
    }

    var main = h('div', {
      class: 'h12-sum__main', role: 'button', tabindex: '0',
      'aria-label': 'Court IQ — open tracking', onclick: goTrack, onkeydown: V12.activates(goTrack)
    }, [
      h('div', { class: 'h12-sum__name', text: (prof.name || 'Rookie') }),
      h('div', { class: 'd-label h12-sum__lbl', text: 'COURT IQ' }),
      iqRow,
      h('div', { class: 'h12-sum__meta' }, [
        h('div', { class: 'h12-sum__chip h12-sum__chip--fg' }, [
          h('i', { class: 'ph-fill ph-target' }),
          h('span', { text: fg + ' FG' })
        ]),
        h('div', { class: 'h12-sum__chip h12-sum__chip--xp' }, [
          h('i', { class: 'ph-fill ph-lightning' }),
          h('span', { text: xpRank(prof).toUpperCase() })
        ])
      ])
    ]);

    /* right: avatar where the basketball was */
    var img = h('div', { class: 'h12-sum__avimg' });
    img.style.backgroundImage = 'url(' + V12.avatarUrl(prof) + ')';
    var url = V12.avatarUrl(prof);
    var avColor = (url.match(/backgroundColor=([0-9A-Fa-f]{6})/) || [])[1] || 'FFB800';
    var av = h('div', {
      class: 'h12-sum__av', role: 'button', tabindex: '0',
      'aria-label': 'Profile', onclick: goMe, onkeydown: V12.activates(goMe)
    }, [
      img,
      h('div', { class: 'h12-sum__lv', text: 'LV ' + (prof.level || 1) })
    ]);
    av.style.setProperty('--av-bg', '#' + avColor);

    return V12.card({ tint: 'ink', class: 'h12-summary' }, [main, av]);
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
    var badges = h('div', { class: 'h12-badges' }, [
      badge('streak', 'ph-fire', String(prof.streak || 0), 'Streak', 'me'),
      badge('xp', 'ph-lightning', String(prof.xp || 0), 'XP', 'me'),
      badge('fg', 'ph-target', fg, 'FG · 30D', 'track'),
      badge('week', 'ph-flag-banner', (week.sessions || 0) + '/' + (week.goal || 5), 'This week', 'track')
    ]);
    if (!(prof.streak > 0)) badges.firstChild.classList.add('is-zero');
    return badges;
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
      tint: 'green', class: 'h12-coach', bgIcon: 'ph-megaphone', bgTone: 'green',
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
      tint: 'cream', class: 'h12-chal',
      onClick: function () { ctx.go('social'); },
      label: 'Weekly challenge'
    }, [
      h('div', { class: 'h12-chal__main' }, [
        h('div', { class: 'h12-chal__t', text: 'WEEKLY CHALLENGE' }),
        h('div', { class: 'h12-chal__s', text: 'Put up 100 shots this week' }),
        h('div', { class: 'h12-chal__bar' }, [
          h('div', { class: 'h12-chal__fill', style: { width: pct + '%' } }),
          /* the flame rides the tip — only once there's real progress */
          cur > 0 ? h('i', {
            class: 'ph-fill ph-fire h12-chal__flame', 'aria-hidden': 'true',
            style: { left: pct + '%' }
          }) : null
        ].filter(Boolean)),
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
      door('start', 'ph-basketball', 'Start session', 'camera-hud')
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

      host.appendChild(summaryCard(prof, iq, fg, ctx));
      host.appendChild(statBadges(prof, week, fg, ctx));
      host.appendChild(coachRow(coach, ctx));
      /* normal rhythm top to bottom — no stretched void in the middle */
      host.appendChild(h('div', { class: 'h12-stack' }, [
        challengeRow(week, ctx),
        doors(ctx)
      ]));
    });
  }

  window.app.register('home', render);
})();
