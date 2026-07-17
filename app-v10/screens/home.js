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

    return V12.card({
      class: 'h12-iq', bgIcon: 'ph-basketball', bgTone: 'orange',
      onClick: function () { ctx.go('track'); },
      label: 'Court IQ — open tracking'
    }, kids);
  }

  function avatarCard(prof, ctx) {
    var img = h('div', {
      class: 'h12-av__img',
      text: prof.avatarUrl ? '' : (prof.initial || 'R')
    });
    if (prof.avatarUrl) img.style.backgroundImage = 'url(' + prof.avatarUrl + ')';
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

  /* ── Row 2: drill tiles with court diagrams ─────────────────── */
  function drillTiles(drills, ctx) {
    var wrap = h('div', { class: 'h12-drills' });
    var tints = ['blue', 'orange', 'green', 'purple'];
    for (var i = 0; i < 4; i++) {
      (function (i) {
        var d = drills[i];
        var open = function () { ctx.go('drill-library'); };
        wrap.appendChild(V12.card({
          class: 'h12-drill', press: true, onClick: open,
          label: d ? d.name : 'Drill library'
        }, [
          V12.courtThumb(d ? d.focus : null, i, { label: d ? d.name : 'Drill' }),
          h('div', { class: 'h12-drill__n', text: d ? d.name : 'More drills' })
        ]));
      })(i);
    }
    return wrap;
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
      class: 'h12-coach',
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
      h('div', { class: 'h12-chal__star' }, [h('i', { class: 'ph-fill ph-star' })])
    ]);
  }

  /* ── Row 5: the two doors ───────────────────────────────────── */
  function doors(ctx) {
    return h('div', { class: 'h12-doors' }, [
      V12.btn({
        label: 'Drill library', icon: 'ph-barbell', variant: 'ghost',
        onClick: function () { ctx.go('drill-library'); }
      }),
      V12.btn({
        label: 'Start session', icon: 'ph-play-circle',
        onClick: function () { ctx.go('camera-hud'); }
      })
    ]);
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;

    return Promise.all([
      ctx.data.getProfile(),
      ctx.data.getWeekStats(),
      ctx.data.getCoachVerdict(),
      ctx.data.getDrills(4),
      window.V10CourtIQ.get()
    ]).then(function (r) {
      var prof   = r[0] || {};
      var week   = r[1] || { attempts: 0, sessions: 0, goal: 5, days: {} };
      var coach  = r[2];
      var drills = r[3] || [];
      var iq     = r[4];

      var top = h('div', { class: 'h12-top' }, [iqCard(iq, ctx), avatarCard(prof, ctx)]);
      host.appendChild(top);
      host.appendChild(drillTiles(drills, ctx));
      host.appendChild(coachRow(coach, ctx));
      host.appendChild(challengeRow(week, ctx));
      /* flex spacer keeps the doors near the nav on tall screens
         instead of stranding them mid-air */
      host.appendChild(h('div', { class: 'h12-flex' }));
      host.appendChild(doors(ctx));
    });
  }

  window.app.register('home', render);
})();
