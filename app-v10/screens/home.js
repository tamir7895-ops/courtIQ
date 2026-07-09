/* app-v10/screens/home.js
   HOME tab — bento, shooting hero, last-week strip, weekly challenges,
   reels link, big coach pin, primary CTA.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  function buildHero(stats) {
    var pct = (stats && stats.shootingPct != null) ? stats.shootingPct : 76;
    var made = (stats && stats.made != null) ? stats.made : 23;
    var att  = (stats && stats.attempted != null) ? stats.attempted : 30;
    var three = (stats && stats.threePt != null) ? stats.threePt : 42;

    return h('div', { class: 'v10-hero' }, [
      h('div', { class: 'v10-hero__main' }, [
        h('div', { class: 'v10-hero__eyebrow' }, [
          icon('ph-crosshair-simple'),
          h('span', { text: 'SHOOTING · TODAY' })
        ]),
        h('div', { class: 'v10-hero__num' }, [
          document.createTextNode(String(pct)),
          h('span', { class: 'v10-hero__num-unit', text: '%' })
        ]),
        h('div', { class: 'v10-hero__sub', text: made + ' of ' + att + ' made — season high' })
      ]),
      h('div', { class: 'v10-hero__aside' }, [
        h('div', { class: 'v10-hero__aside-lbl', text: '3PT' }),
        h('div', { class: 'v10-hero__aside-num', text: String(three) + '%' })
      ])
    ]);
  }

  /* ── LAST-WEEK STRIP (calendar, docked under the hero) ────
     7 cells ending TODAY. Cells with a session show its pct and
     a made-dot; today is stamped orange. Tap: session → recap,
     empty → start tracking. */
  function buildWeekStrip(ctx) {
    var LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    // Demo history (oldest → yesterday); real data wiring comes from
    // the sessions store later. Today starts empty until you play.
    var history = [68, 0, 71, 0, 42, 76, 0];
    var now = new Date();
    var cells = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now.getTime() - i * 86400000);
      var pct = history[6 - i];
      var isToday = i === 0;
      (function (pct, isToday) {
        cells.push(h('div', {
          class: 'v10-week__cell' +
            (isToday ? ' is-today' : (pct > 0 ? (pct >= 60 ? ' is-hot' : ' is-cold') : '')),
          onclick: function () { ctx.go(pct > 0 ? 'post-session' : 'camera-hud'); }
        }, [
          h('div', { class: 'v10-week__day', text: LETTERS[d.getDay()] }),
          h('div', { class: 'v10-week__num', text: d.getDate() }),
          h('div', { class: 'v10-week__val', text: isToday ? '•' : (pct > 0 ? pct + '%' : '—') })
        ]));
      })(pct, isToday);
    }
    return h('div', { class: 'v10-week' }, cells);
  }

  /* ── WEEKLY CHALLENGE CARD ────────────────────────────────
     Colored badge block + title + court-baseline progress bar
     with a little basketball riding the fill tip + XP bounty. */
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
      ctx.data.getProfile()
    ]).then(function (results) {
      var stats = results[0] || {};
      var coach = results[1] || {};
      var prof  = results[2] || {};
      var xpVal = prof.xp || 11200;
      var xpDisplay = (xpVal / 1000).toFixed(1) + 'K';
      var trendVal = stats.trend != null ? stats.trend : 6;
      var streakVal = prof.streak || 7;

      host.appendChild(ctx.ui.headerPill({ profile: prof }));

      // 4-bento — STREAK / LEVEL / XP / TREND
      host.appendChild(ctx.ui.bento([
        { variant: 'orange',  icon: 'ph-fire',         value: streakVal,  label: 'STREAK',
          iconExtra: streakVal >= 3 ? 'v10-flicker' : '' },
        { variant: 'ink',     icon: 'ph-shield-star',  value: prof.level || 14,  label: 'LEVEL' },
        {                     icon: 'ph-lightning',    value: xpDisplay,         label: 'XP', mono: true },
        { variant: 'sage',    icon: 'ph-trend-up',     value: '+' + trendVal + '%', label: 'TREND' }
      ]));

      // Hero + the last-week strip docked right under it
      host.appendChild(buildHero(stats));
      host.appendChild(buildWeekStrip(ctx));

      // THIS WEEK CHALLENGE — two designed weekly challenges
      host.appendChild(ctx.ui.ribbon({
        icon: 'ph-trophy',
        title: 'THIS WEEK CHALLENGE',
        meta: 'ENDS SUN'
      }));
      host.appendChild(challengeCard({
        no: '01', accent: 'orange', icon: 'ph-basketball',
        title: 'SPLASH WEEK',
        sub: 'Hit 40 three-pointers this week',
        cur: (stats.weekThrees != null ? stats.weekThrees : 17), goal: 40, unit: 'THREES',
        xp: 250, go: 'camera-hud'
      }, ctx));
      host.appendChild(challengeCard({
        no: '02', accent: 'sage', icon: 'ph-fire',
        title: 'HOT HAND',
        sub: 'Finish 3 sessions above 70% accuracy',
        cur: (stats.weekHot != null ? stats.weekHot : 2), goal: 3, unit: 'SESSIONS',
        xp: 180, go: 'camera-hud'
      }, ctx));

      // Reels link — closes the challenge block
      host.appendChild(h('div', {
        class: 'v10-reels-link',
        onclick: function () { ctx.go('drill-library'); }
      }, [
        icon('ph-film-strip'),
        h('span', { text: 'FOR MORE REELS' }),
        h('i', { class: 'ph-bold ph-arrow-right v10-reels-link__arrow' })
      ]));

      // Coach pin — the big edition
      host.appendChild(ctx.ui.pinCard({
        lg: true,
        tab: 'COACH PINNED',
        body: coach.verdict || 'Your left wing is leaking. Spend 50 reps there today.',
        highlight: coach.highlight || 'Your left wing is leaking.',
        projection: coach.projection || '+3%',
        sig: 'AI SCOUT'
      }));

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
