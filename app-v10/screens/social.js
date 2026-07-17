/* app-v10/screens/social.js — v12 (new screen)
   SOCIAL — the sketch's five rooms:

     LEADERBOARD (big)     FRIENDS (small)
                           CHALLENGES (small)
     ──────────── STATS ────────────
     ──────── FRIENDS ACTIVITY ─────

   There is no social backend yet, and the M4 rule doesn't bend for a
   new tab: nothing here fakes a friend, a rank, or a feed item. What
   IS real: your own XP, level, streak and week — so the leaderboard
   seeds with the one player we can vouch for (you), and everything
   else is a designed invitation, not a mockup pretending to be data.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  function invite() {
    var text = 'Training with CourtIQ — AI shot tracking. Come compete with me.';
    try {
      if (navigator.share) { navigator.share({ title: 'CourtIQ', text: text }); return; }
    } catch (e) {}
    try {
      navigator.clipboard.writeText(text);
      if (window.V10UI && window.V10UI.confetti) window.V10UI.confetti({ count: 12 });
    } catch (e) {}
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;

    return Promise.all([
      ctx.data.getProfile(),
      ctx.data.getWeekStats(),
      ctx.data.getTotals()
    ]).then(function (r) {
      var prof = r[0] || {};
      var week = r[1] || { sessions: 0, attempts: 0, goal: 5 };
      var tot  = r[2] || { sessions: 0, shots: 0 };

      host.appendChild(V12.header('Social', 'The gym is better with company.'));

      var grid = h('div', { class: 's12-grid' });

      /* leaderboard — seeded with the one real player */
      var lb = V12.card({ tint: 'purple', class: 's12-lb', bgIcon: 'ph-ranking', bgTone: 'purple' }, [
        h('div', { class: 'd-label', text: 'LEADERBOARD' }),
        h('div', { class: 's12-lb__row s12-lb__row--you' }, [
          h('div', { class: 's12-lb__rank', text: '1' }),
          h('div', {
            class: 's12-lb__av',
            style: { backgroundImage: 'url(' + V12.avatarUrl(prof) + ')' }
          }),
          h('div', { class: 's12-lb__main' }, [
            h('div', { class: 's12-lb__n', text: prof.name || 'You' }),
            h('div', { class: 's12-lb__s', text: (prof.xp || 0) + ' XP' })
          ])
        ]),
        h('div', { class: 's12-lb__empty' }, [
          h('div', { class: 's12-lb__ghost' }, [h('span', { text: '2' })]),
          h('div', { class: 's12-lb__ghost' }, [h('span', { text: '3' })]),
          h('div', { class: 's12-lb__hint', text: 'A league of one. Invite a friend and this becomes a race.' })
        ]),
        h('button', { class: 's12-lb__cta', type: 'button', onclick: invite }, [
          h('i', { class: 'ph-bold ph-user-plus' }),
          h('span', { text: 'INVITE' })
        ])
      ]);
      grid.appendChild(lb);

      /* friends (small) */
      grid.appendChild(V12.card({
        class: 's12-tile', bgIcon: 'ph-users-three', bgTone: 'blue',
        onClick: invite, label: 'Friends'
      }, [
        h('i', { class: 'ph-fill ph-users-three s12-tile__ic s12-tile__ic--blue' }),
        h('div', { class: 's12-tile__t', text: 'FRIENDS' }),
        h('div', { class: 's12-tile__v', text: '0' })
      ]));

      /* challenges (small) */
      grid.appendChild(V12.card({
        class: 's12-tile', bgIcon: 'ph-flag-banner', bgTone: 'green',
        onClick: function () { ctx.go('home'); }, label: 'Challenges'
      }, [
        h('i', { class: 'ph-fill ph-flag-banner s12-tile__ic s12-tile__ic--green' }),
        h('div', { class: 's12-tile__t', text: 'CHALLENGES' }),
        h('div', { class: 's12-tile__v', text: (week.attempts || 0) + '/100' })
      ]));

      host.appendChild(grid);

      /* stats — your week, real numbers or dashes */
      host.appendChild(V12.card({ class: 's12-stats', bgIcon: 'ph-chart-bar', bgTone: 'gold' }, [
        h('div', { class: 'd-label', text: 'YOUR WEEK' }),
        h('div', { class: 's12-stats__row' }, [
          h('div', { class: 's12-stats__i' }, [
            h('div', { class: 'd-num s12-stats__v', text: String(week.sessions || 0) }),
            h('div', { class: 'd-label', text: 'SESSIONS' })
          ]),
          h('div', { class: 's12-stats__i' }, [
            h('div', { class: 'd-num s12-stats__v', text: String(week.attempts || 0) }),
            h('div', { class: 'd-label', text: 'SHOTS' })
          ]),
          h('div', { class: 's12-stats__i' }, [
            h('div', { class: 'd-num s12-stats__v', text: String(prof.streak || 0) }),
            h('div', { class: 'd-label', text: 'STREAK' })
          ]),
          h('div', { class: 's12-stats__i' }, [
            h('div', { class: 'd-num s12-stats__v', text: String(prof.xp || 0) }),
            h('div', { class: 'd-label', text: 'XP' })
          ])
        ])
      ]));

      /* friends activity — the mascot holds the empty room */
      var feedEmpty = V12.empty('Quiet in here',
        'When friends join, their sessions land here — "Dana put up 120 shots" — and yours lands on theirs.');
      feedEmpty.classList.add('s12-feed__empty');
      host.appendChild(V12.card({ class: 's12-feed' }, [
        h('div', { class: 'd-label', text: 'FRIENDS ACTIVITY' }),
        feedEmpty
      ]));

      host.appendChild(V12.btn({
        label: 'Invite friends', icon: 'ph-user-plus',
        onClick: invite
      }));
    });
  }

  window.app.register('social', render);
})();
