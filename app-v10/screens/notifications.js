/* app-v10/screens/notifications.js — v12
   INBOX — rebuilt honest. The old screen shipped four hardcoded
   fixtures ("JORDAN BEAT YOUR SCORE" — there is no Jordan). Every row
   here is now DERIVED from real state, and when nothing real has
   happened the inbox says so, which is what an inbox is for.

   Sources: streak-at-risk (real streak + no session today), the
   scout's verdict (real zone evidence), latest earned badge
   (BadgeSystem), weekly challenge progress (real week).
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  function build(ctx) {
    return Promise.all([
      ctx.data.getProfile(),
      ctx.data.getWeekStats(),
      ctx.data.getCoachVerdict(),
      ctx.data.getTodayStats()
    ]).then(function (r) {
      var prof = r[0] || {}, week = r[1] || {}, coach = r[2], today = r[3] || {};
      var notes = [];

      if ((prof.streak || 0) > 0 && !(today.attempted > 0)) {
        notes.push({
          tone: 'orange', icon: 'ph-fire', title: 'Streak at risk',
          body: prof.streak + '-day streak on the line. One session today keeps it alive.',
          dest: 'camera-hud'
        });
      }
      if (coach && coach.verdict) {
        notes.push({
          tone: 'green', icon: 'ph-chalkboard-teacher', title: 'Scouting report ready',
          body: coach.verdict, dest: 'coach'
        });
      }
      try {
        if (typeof BadgeSystem !== 'undefined' && BadgeSystem.getEarned) {
          var earned = BadgeSystem.getEarned() || [];
          var last = earned[earned.length - 1];
          if (last) {
            notes.push({
              tone: 'gold', icon: 'ph-trophy', title: 'Trophy earned',
              body: (last.name || last.id || 'New trophy') + ' is in your case.',
              dest: 'me'
            });
          }
        }
      } catch (e) {}
      if ((week.attempts || 0) > 0) {
        var left = Math.max(0, 100 - week.attempts);
        notes.push({
          tone: 'blue', icon: 'ph-flag-banner', title: 'Weekly challenge',
          body: left ? week.attempts + ' shots up — ' + left + ' to go for the star.'
                     : '100 shots this week. The star is yours.',
          dest: 'home'
        });
      }
      return { prof: prof, notes: notes };
    });
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;

    return build(ctx).then(function (data) {
      host.appendChild(h('div', { class: 'c12-chat-hd' }, [
        h('button', {
          class: 'c12-back', type: 'button', 'aria-label': 'Back',
          onclick: function () { ctx.go('home'); }
        }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
        h('div', {}, [
          h('div', { class: 'c12-chat-hd__t', text: 'Inbox' }),
          h('div', { class: 'c12-chat-hd__s',
            text: data.notes.length ? data.notes.length + ' thing' +
              (data.notes.length === 1 ? '' : 's') + ' worth knowing' : 'All caught up' })
        ])
      ]));

      if (!data.notes.length) {
        host.appendChild(V12.empty('Inbox zero',
          'Nothing needs you right now. Go put up shots — the inbox fills itself.'));
      }

      /* neutral rows, vivid icon squares — color marks the TYPE, the row stays paper */
      data.notes.forEach(function (n) {
        host.appendChild(V12.card({
          press: true, class: 'n12-row', bgIcon: n.icon, bgTone: n.tone,
          onClick: function () { ctx.go(n.dest); }, label: n.title
        }, [
          h('div', { class: 'n12-row__ic n12-row__ic--' + n.tone }, [
            h('i', { class: 'ph-fill ' + n.icon })
          ]),
          h('div', { class: 'n12-row__main' }, [
            h('div', { class: 'n12-row__t', text: n.title }),
            h('div', { class: 'n12-row__b', text: n.body })
          ]),
          h('i', { class: 'ph-bold ph-caret-right n12-row__chev' })
        ]));
      });

      host.appendChild(V12.btn({
        label: 'Start session', icon: 'ph-play-circle',
        onClick: function () { ctx.go('camera-hud'); }
      }));
    });
  }

  window.app.register('notifications', render);
})();
