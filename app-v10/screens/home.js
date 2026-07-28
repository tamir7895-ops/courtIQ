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

  var T = {
    en: {
      'home.next.track': 'Track a session',
      'home.next.today': 'Today: {f} · {n} min',
      'home.next.claim': '{t} — ready to claim',
      'home.next.progress': '{t} ({d}/{n})',
      'home.next.swept': 'Staff swept — free play. Track a session',
      'home.next.aria': 'Next up: {l}',
      'home.next.label': 'NEXT UP',
      'home.unrated': 'UNRATED',
      'home.sum.aria': 'Court IQ — open tracking',
      'home.rookie': 'Rookie',
      'home.iq': 'COURT IQ',
      'home.fgchip': '{v} FG',
      'home.profile': 'Profile',
      'home.lv': 'LV {n}',
      'home.spark.aria': 'Court IQ trend',
      'home.streak': 'Streak',
      'home.xp': 'XP',
      'home.fg30': 'FG · 30D',
      'home.week': 'This week',
      'home.coach': 'Coach: ',
      'home.coach.empty': 'Upload a session video and I start talking — zone by zone.',
      'home.coach.open': 'Open coach',
      'home.chal.title': 'WEEKLY CHALLENGE',
      'home.chal.sub': 'Put up 100 shots this week',
      'home.chal.left': '{n} to go',
      'home.chal.done': 'Done! Claim it',
      'home.chal.aria': 'Weekly challenge',
      'home.door.plan': 'Customize your training plan',
      'home.door.start': 'Start a session'
    },
    he: {
      'home.next.track': 'תעד אימון',
      'home.next.today': 'היום: ⁨{f}⁩ · {n} דק׳',
      'home.next.claim': '{t} — מוכן לאיסוף',
      'home.next.progress': '{t} ({d}/{n})',
      'home.next.swept': 'סגרת את כל האתגרים — משחק חופשי. תעד אימון',
      'home.next.aria': 'הבא בתור: {l}',
      'home.next.label': 'הבא בתור',
      'home.unrated': 'ללא דירוג',
      'home.sum.aria': '⁨Court IQ⁩ — פתח מעקב',
      'home.rookie': 'טירון',
      'home.iq': 'Court IQ',
      'home.fgchip': '⁨FG⁩ {v}',
      'home.profile': 'פרופיל',
      'home.lv': 'רמה {n}',
      'home.spark.aria': 'מגמת ⁨Court IQ⁩',
      'home.streak': 'רצף',
      'home.xp': 'XP',
      'home.fg30': '⁨FG⁩ · 30 יום',
      'home.week': 'השבוע',
      'home.coach': 'מאמן: ',
      'home.coach.empty': 'תעלה סרטון אימון ואני מתחיל לדבר — אזור אחרי אזור.',
      'home.coach.open': 'פתח את המאמן',
      'home.chal.title': 'אתגר שבועי',
      'home.chal.sub': 'תזרוק 100 זריקות השבוע',
      'home.chal.left': 'עוד {n}',
      'home.chal.done': 'סיימת! אסוף את הפרס',
      'home.chal.aria': 'אתגר שבועי',
      'home.door.plan': 'התאם את תוכנית האימון',
      'home.door.start': 'התחל אימון'
    }
  };
  if (window.V12I18n) V12I18n.add(T);
  function t(k, p) { return window.V12I18n ? window.V12I18n.t(k, p) : k; }

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
  /* 30-ish day Court IQ trend — a real series (window math evaluated at
     earlier dates), drawn only when there are two real points to join */
  function spark(series) {
    var pts = [];
    (series || []).forEach(function (v, i) { if (v != null) pts.push([i, v]); });
    if (pts.length < 2) return null;
    var min = Infinity, max = -Infinity;
    pts.forEach(function (p) { min = Math.min(min, p[1]); max = Math.max(max, p[1]); });
    var span = Math.max(4, max - min);                 /* flat line still visible */
    var W = 120, H = 26, n = series.length - 1;
    var d = pts.map(function (p, j) {
      var x = (p[0] / n) * (W - 6) + 3;
      var y = H - 4 - ((p[1] - min) / span) * (H - 8);
      return (j ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    var up = pts[pts.length - 1][1] >= pts[0][1];
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'h12-spark' + (up ? ' is-up' : ' is-down'));
    svg.setAttribute('aria-label', t('home.spark.aria'));
    svg.innerHTML = '<path d="' + d + '" fill="none" stroke-width="2.5" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle r="3" cx="' + ((pts[pts.length - 1][0] / n) * (W - 6) + 3).toFixed(1) +
      '" cy="' + (H - 4 - ((pts[pts.length - 1][1] - min) / span) * (H - 8)).toFixed(1) + '"/>';
    return svg;
  }

  /* ── NEXT UP — the one thing to do right now ──────────────────
     Priority: today's plan day (not done) → first uncollected coach
     challenge → everything swept, go play. Real state only. */
  function nextUp(sessions, ctx) {
    var icon = 'ph-basketball', label = t('home.next.track'), go = 'track';
    try {
      var P = window.V12Plan;
      var p = P && P.load();
      var fid = p && P.todaysFocus(p);
      if (fid && fid !== 'rest' && !P.isDone(p, P.todayISO())) {
        icon = 'ph-calendar-check';
        var fLabel = t('notify.focus.' + fid);
        if (fLabel === 'notify.focus.' + fid) fLabel = fid.toUpperCase();
        label = t('home.next.today', { f: fLabel, n: (p.minutes || 30) });
        go = 'plan';
      } else if (window.V12Challenges) {
        var open = null;
        ['gm', 'splash', 'flow', 'tank'].some(function (id) {
          var s = window.V12Challenges.state(id, { sessions: sessions });
          if (s && !s.claimed) { open = s; return true; }
          return false;
        });
        if (open) {
          icon = 'ph-flag-banner';
          label = open.complete
            ? t('home.next.claim', { t: open.title })
            : t('home.next.progress', { t: open.task, d: open.done, n: open.total });
          go = 'coach';
        } else {
          icon = 'ph-confetti';
          label = t('home.next.swept');
          go = 'track';
        }
      }
    } catch (e) {}
    var open2 = function () { ctx.go(go); };
    return h('div', {
      class: 'h12-next', role: 'button', tabindex: '0',
      'aria-label': t('home.next.aria', { l: label }),
      onclick: open2, onkeydown: V12.activates(open2)
    }, [
      h('i', { class: 'ph-fill ' + icon }),
      h('div', {}, [
        h('div', { class: 'h12-next__lbl', text: t('home.next.label') }),
        h('div', { class: 'h12-next__t', text: label })
      ]),
      h('i', { class: 'ph-bold ph-caret-right h12-next__chev' })
    ]);
  }

  function summaryCard(prof, iq, fg, ctx) {
    var goTrack = function () { ctx.go('track'); };
    var goMe = function () { ctx.go('me'); };

    /* left: name + Court IQ + rank */
    var iqRow = h('div', { class: 'h12-sum__iqrow' });
    if (!iq) {
      iqRow.appendChild(h('div', { class: 'd-num h12-sum__score h12-sum__score--empty', text: '—' }));
      iqRow.appendChild(h('div', { class: 'h12-sum__tier', text: t('home.unrated') }));
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
      'aria-label': t('home.sum.aria'), onclick: goTrack, onkeydown: V12.activates(goTrack)
    }, [
      h('div', { class: 'h12-sum__name', text: (prof.name || t('home.rookie')) }),
      h('div', { class: 'd-label h12-sum__lbl', text: t('home.iq') }),
      iqRow,
      h('div', { class: 'h12-sum__meta' }, [
        h('div', { class: 'h12-sum__chip h12-sum__chip--fg' }, [
          h('i', { class: 'ph-fill ph-target' }),
          h('span', { text: t('home.fgchip', { v: fg }) })
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
      'aria-label': t('home.profile'), onclick: goMe, onkeydown: V12.activates(goMe)
    }, [
      img,
      h('div', { class: 'h12-sum__lv', text: t('home.lv', { n: (prof.level || 1) }) })
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
      badge('streak', 'ph-fire', String(prof.streak || 0), t('home.streak'), 'me'),
      badge('xp', 'ph-lightning', String(prof.xp || 0), t('home.xp'), 'me'),
      badge('fg', 'ph-target', fg, t('home.fg30'), 'track'),
      badge('week', 'ph-flag-banner', (week.sessions || 0) + '/' + (week.goal || 5), t('home.week'), 'track')
    ]);
    if (!(prof.streak > 0)) badges.firstChild.classList.add('is-zero');
    return badges;
  }

  /* ── Row 3: the coach line ──────────────────────────────────── */
  function coachRow(coach, ctx) {
    var txt;
    if (coach && coach.verdict) {
      txt = h('div', { class: 'h12-coach__txt' }, [
        h('strong', { text: t('home.coach') }),
        document.createTextNode(coach.verdict)
      ]);
    } else {
      txt = h('div', { class: 'h12-coach__txt' }, [
        h('strong', { text: t('home.coach') }),
        document.createTextNode(t('home.coach.empty'))
      ]);
    }
    return V12.card({
      tint: 'green', class: 'h12-coach', bgIcon: 'ph-megaphone', bgTone: 'green',
      onClick: function () { ctx.go('coach'); },
      label: t('home.coach.open')
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
      label: t('home.chal.aria')
    }, [
      h('div', { class: 'h12-chal__main' }, [
        h('div', { class: 'h12-chal__t', text: t('home.chal.title') }),
        h('div', { class: 'h12-chal__s', text: t('home.chal.sub') }),
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
          h('span', { text: left ? t('home.chal.left', { n: left }) : t('home.chal.done') })
        ])
      ]),
      h('div', { class: 'h12-chal__hoop' }, [V12.hoopScene(74)])
    ]);
  }

  /* ── Row 5: the two doors — square tiles glued under the challenge */
  function doors(ctx) {
    /* the user's reference: bright card, small icon chip up top, the
       label under it, and the same icon oversized + faded in the corner */
    function door(mod, icon, label, go) {
      return h('button', {
        class: 'h12-door2 h12-door2--' + mod, type: 'button',
        'aria-label': label,
        onclick: function () { ctx.go(go); }
      }, [
        h('div', { class: 'h12-door2__ic' }, [h('i', { class: 'ph-fill ' + icon })]),
        h('span', { class: 'h12-door2__t', text: label }),
        h('i', { class: 'ph-fill ' + icon + ' h12-door2__bg', 'aria-hidden': 'true' })
      ]);
    }
    return h('div', { class: 'h12-doors' }, [
      door('plan', 'ph-clipboard-text', t('home.door.plan'), 'plan'),
      door('start', 'ph-basketball', t('home.door.start'), 'camera-hud')
    ]);
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;

    return Promise.all([
      ctx.data.getProfile(),
      ctx.data.getWeekStats(),
      ctx.data.getCoachVerdict(),
      ctx.data.getZones(),
      window.V10CourtIQ.get(),
      window.V10CourtIQ.series ? window.V10CourtIQ.series(8, 5) : [],
      ctx.data.getSessions ? ctx.data.getSessions(10) : []
    ]).then(function (r) {
      var prof   = r[0] || {};
      var week   = r[1] || { attempts: 0, sessions: 0, goal: 5, days: {} };
      var coach  = r[2];
      var zones  = r[3] || {};
      var iq     = r[4];
      var series = r[5] || [];
      var sessions = r[6] || [];

      /* FG% only past the same evidence floor the tracking screen uses */
      var made = 0, vatt = 0;
      Object.keys(zones).forEach(function (k) {
        var z = zones[k]; if (!z) return;
        made += z.made || 0; vatt += z.vatt || 0;
      });
      var C = window.V11Court;
      var fg = vatt >= C.MIN_TOTAL ? Math.round(made * 100 / vatt) + '%'
             : (vatt ? made + '/' + vatt : '—');

      var sum = summaryCard(prof, iq, fg, ctx);
      if (iq) {
        var sp = spark(series);
        if (sp) {
          var mainCol = sum.querySelector('.h12-sum__main');
          if (mainCol) mainCol.insertBefore(sp, mainCol.querySelector('.h12-sum__meta'));
        }
      }
      host.appendChild(sum);
      host.appendChild(nextUp(sessions, ctx));
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
