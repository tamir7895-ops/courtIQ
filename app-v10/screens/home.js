/* app-v10/screens/home.js
   HOME tab — bento, shooting hero, last-week strip, weekly challenges,
   drill-library link, coach pin, primary CTA.

   M4 rule: every number is REAL (merged remote+local sessions) or the
   element renders an honest empty state. No fixtures, no demo history.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  function buildHero(stats, ctx) {
    var att = stats.attempted || 0;

    // Nothing today yet — invite, don't fake.
    if (!att) {
      return h('div', { class: 'v10-hero', onclick: function () { ctx.go('camera-hud'); }, style: { cursor: 'pointer' } }, [
        h('div', { class: 'v10-hero__main' }, [
          h('div', { class: 'v10-hero__eyebrow' }, [
            icon('ph-crosshair-simple'),
            h('span', { text: 'SHOOTING · TODAY' })
          ]),
          h('div', { class: 'v10-hero__num' }, [
            document.createTextNode('—')
          ]),
          h('div', { class: 'v10-hero__sub', text: 'No shots yet today — the court is waiting.' })
        ]),
        h('div', { class: 'v10-hero__aside' }, [
          h('div', { class: 'v10-hero__aside-lbl', text: 'START' }),
          h('div', { class: 'v10-hero__aside-num' }, [h('i', { class: 'ph-bold ph-play-circle' })])
        ])
      ]);
    }

    // Counter-only day: attempts are real, accuracy honestly unknown.
    if (stats.shootingPct == null) {
      return h('div', { class: 'v10-hero' }, [
        h('div', { class: 'v10-hero__main' }, [
          h('div', { class: 'v10-hero__eyebrow' }, [
            icon('ph-crosshair-simple'),
            h('span', { text: 'SHOOTING · TODAY' })
          ]),
          h('div', { class: 'v10-hero__num' }, [
            document.createTextNode(String(att)),
            h('span', { class: 'v10-hero__num-unit', text: ' shots' })
          ]),
          h('div', { class: 'v10-hero__sub', text: 'Counted live — upload a video for made/miss.' })
        ]),
        h('div', { class: 'v10-hero__aside' }, [
          h('div', { class: 'v10-hero__aside-lbl', text: '3PT' }),
          h('div', { class: 'v10-hero__aside-num', text: '—' })
        ])
      ]);
    }

    return h('div', { class: 'v10-hero' }, [
      h('div', { class: 'v10-hero__main' }, [
        h('div', { class: 'v10-hero__eyebrow' }, [
          icon('ph-crosshair-simple'),
          h('span', { text: 'SHOOTING · TODAY' })
        ]),
        h('div', { class: 'v10-hero__num' }, [
          document.createTextNode(String(stats.shootingPct)),
          h('span', { class: 'v10-hero__num-unit', text: '%' })
        ]),
        h('div', { class: 'v10-hero__sub', text: stats.made + ' of ' + stats.verdictAtt + ' made today' })
      ]),
      h('div', { class: 'v10-hero__aside' }, [
        h('div', { class: 'v10-hero__aside-lbl', text: '3PT' }),
        h('div', { class: 'v10-hero__aside-num', text: stats.threePt != null ? stats.threePt + '%' : '—' })
      ])
    ]);
  }

  /* ── LAST-WEEK STRIP — real per-day aggregates ─────────── */
  function buildWeekStrip(ctx, week) {
    var LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    var days = (week && week.days) || {};
    var now = new Date();
    var cells = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now.getTime() - i * 86400000);
      var key = d.toISOString().slice(0, 10);
      var agg = days[key];
      var isToday = i === 0;
      (function (agg, isToday) {
        var hasData = agg && agg.attempted > 0;
        var val = '—';
        var cls = '';
        if (hasData) {
          if (agg.shootingPct != null) {
            val = agg.shootingPct + '%';
            cls = agg.shootingPct >= 60 ? ' is-hot' : ' is-cold';
          } else {
            val = agg.attempted + '•';   // counter-only day: volume, no verdicts
            cls = ' is-cold';
          }
        }
        if (isToday) cls = ' is-today';
        cells.push(h('div', {
          class: 'v10-week__cell' + cls,
          onclick: function () { ctx.go(hasData ? 'track' : 'camera-hud'); }
        }, [
          h('div', { class: 'v10-week__day', text: LETTERS[d.getDay()] }),
          h('div', { class: 'v10-week__num', text: d.getDate() }),
          h('div', { class: 'v10-week__val', text: isToday && !hasData ? '•' : val })
        ]));
      })(agg, isToday);
    }
    return h('div', { class: 'v10-week' }, cells);
  }

  /* ── WEEKLY CHALLENGE CARD — progress from real week data ── */
  function challengeCard(c, ctx) {
    var fillPct = Math.max(4, Math.min(100, Math.round(c.cur * 100 / c.goal)));
    return h('div', {
      class: 'v10-challenge v10-challenge--' + c.accent,
      onclick: function () { ctx.go(c.go || 'train'); }
    }, [
      h('div', { class: 'v10-challenge__badge' }, [
        h('i', { class: 'ph-bold ' + c.icon }),
        h('div', { class: 'v10-challenge__badge-no', text: c.no })
      ]),
      h('div', { class: 'v10-challenge__main' }, [
        h('div', { class: 'v10-challenge__title', text: c.title }),
        h('div', { class: 'v10-challenge__sub', text: c.sub }),
        h('div', { class: 'v10-challenge__bar' }, [
          h('div', { class: 'v10-challenge__fill', style: { width: fillPct + '%' } })
        ]),
        h('div', { class: 'v10-challenge__meta' }, [
          h('span', { class: 'v10-challenge__count', text: c.cur + ' / ' + c.goal + ' ' + c.unit }),
          h('span', { class: 'v10-challenge__xp' }, [
            icon('ph-lightning'),
            h('span', { text: '+' + c.xp + ' XP' })
          ])
        ])
      ])
    ]);
  }

  function render(args) {
    var host = args.host;
    var ctx  = args.ctx;

    Promise.all([
      ctx.data.getTodayStats(),
      ctx.data.getCoachVerdict(),
      ctx.data.getProfile(),
      ctx.data.getWeekStats()
    ]).then(function (results) {
      var stats = results[0] || { attempted: 0 };
      var coach = results[1];   // null when there's no real evidence yet
      var prof  = results[2] || {};
      var week  = results[3] || { sessions: 0, goal: 5, days: {}, threes: 0, attempts: 0 };

      var xpVal = prof.xp || 0;
      var xpDisplay = xpVal >= 1000 ? (xpVal / 1000).toFixed(1) + 'K' : String(xpVal);
      var streakVal = prof.streak || 0;

      host.appendChild(ctx.ui.headerPill({ profile: prof }));

      // 4-bento — STREAK / LEVEL / XP / WEEK (all real)
      host.appendChild(ctx.ui.bento([
        { variant: 'orange',  icon: 'ph-fire',         value: streakVal,  label: 'STREAK',
          iconExtra: streakVal >= 3 ? 'v10-flicker' : '' },
        { variant: 'ink',     icon: 'ph-shield-star',  value: prof.level || 1,  label: 'LEVEL' },
        {                     icon: 'ph-lightning',    value: xpDisplay,        label: 'XP', mono: true },
        { variant: 'sage',    icon: 'ph-flag',         value: week.sessions + '/' + week.goal, label: 'WEEK' }
      ]));

      // Hero + the last-week strip docked right under it
      host.appendChild(buildHero(stats, ctx));
      host.appendChild(buildWeekStrip(ctx, week));

      // THIS WEEK CHALLENGE — progress from the real week aggregates
      host.appendChild(ctx.ui.ribbon({
        icon: 'ph-trophy',
        title: 'THIS WEEK CHALLENGE',
        meta: 'ENDS SUN'
      }));
      host.appendChild(challengeCard({
        no: '01', accent: 'orange', icon: 'ph-basketball',
        title: 'VOLUME WEEK',
        sub: 'Put up 100 shots this week',
        cur: Math.min(week.attempts || 0, 100), goal: 100, unit: 'SHOTS',
        xp: 250, go: 'camera-hud'
      }, ctx));
      host.appendChild(challengeCard({
        no: '02', accent: 'sage', icon: 'ph-fire',
        title: 'SHOW UP',
        sub: 'Log ' + week.goal + ' sessions this week',
        cur: Math.min(week.sessions || 0, week.goal), goal: week.goal, unit: 'SESSIONS',
        xp: 180, go: 'camera-hud'
      }, ctx));

      // Drill library link — closes the challenge block
      host.appendChild(h('div', {
        class: 'v10-reels-link',
        onclick: function () { ctx.go('drill-library'); }
      }, [
        icon('ph-barbell'),
        h('span', { text: 'DRILL LIBRARY' }),
        h('i', { class: 'ph-bold ph-arrow-right v10-reels-link__arrow' })
      ]));

      // Coach pin — only when there's REAL zone evidence to talk about
      if (coach && coach.verdict) {
        host.appendChild(ctx.ui.pinCard({
          lg: true,
          tab: 'COACH PINNED',
          body: coach.verdict,
          highlight: coach.highlight,
          projection: coach.projection || '',
          sig: 'AI SCOUT'
        }));
      } else {
        host.appendChild(ctx.ui.pinCard({
          tab: 'COACH PINNED',
          body: 'Upload a session video and the scout starts talking — zone-by-zone.',
          highlight: 'the scout starts talking',
          projection: '',
          sig: 'AI SCOUT'
        }));
      }

      // Flex spacer pushes CTA to bottom when content is short
      host.appendChild(h('div', { style: { flex: '1 1 auto', minHeight: '4px' } }));

      // Primary CTA → camera-hud
      host.appendChild(ctx.ui.cta({
        icon: 'ph-play-circle',
        label: 'START SHOOTING SESSION',
        onClick: function () { ctx.go('camera-hud'); }
      }));
    });
  }

  window.app.register('home', render);
})();
