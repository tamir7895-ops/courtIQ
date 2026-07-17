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
    var t = data.t, rank = data.rank, zones = data.zones, coach = data.coach;
    var lines = [];
    if (!t.att) {
      lines.push('Nothing on film yet. Upload a session video and I start talking — zone by zone.');
    } else if (!t.vatt) {
      lines.push('Your shots were counted but not scored. Upload a session video and the read starts.');
    } else {
      lines.push(t.vatt + ' scored shots on film in the last 30 days.');
      if (coach && coach.verdict) lines.push(coach.verdict);
      if (rank.length >= 2) {
        var hot = rank[0], cold = rank[rank.length - 1];
        var hz = zones[hot], cz = zones[cold];
        lines.push('Best zone: ' + C.LABEL[hot] + ' at ' +
          Math.round(hz.made / hz.vatt * 100) + '%. Weakest: ' + C.LABEL[cold] +
          ' at ' + Math.round(cz.made / cz.vatt * 100) + '%.');
      }
    }
    return lines;
  }

  /* ── chat view (guided) ───────────────────────────────────────*/
  function chatView(host, ctx, data, back) {
    while (host.firstChild) host.removeChild(host.firstChild);

    var thread = h('div', { class: 'c12-thread' });
    var chips = h('div', { class: 'c12-chips' });

    function coachSay(text) {
      var b = h('div', { class: 'c12-msg c12-msg--coach' }, [
        h('div', { class: 'c12-msg__face' }, [h('i', { class: 'ph-fill ph-chalkboard-teacher' })]),
        h('div', { class: 'c12-msg__bubble', text: text })
      ]);
      thread.appendChild(b);
      thread.scrollTop = thread.scrollHeight;
    }
    function userSay(text) {
      thread.appendChild(h('div', { class: 'c12-msg c12-msg--user' }, [
        h('div', { class: 'c12-msg__bubble c12-msg__bubble--user', text: text })
      ]));
      thread.scrollTop = thread.scrollHeight;
    }

    var ASKS = [
      { q: 'What should I work on?', a: function () {
          var rank = data.rank;
          if (!rank.length) return ['Not enough scored shots from any one spot. Give me ' +
            C.MIN_VERDICTS + ' from a zone and I rate it.'];
          var cold = rank[rank.length - 1];
          var cz = data.zones[cold];
          return ['Spend 30 reps a session at the ' + C.LABEL[cold].toLowerCase() +
            '. It sits at ' + cz.made + ' of ' + cz.vatt + '. The plan screen has a block for it.'];
        } },
      { q: 'How does my week look?', a: function () {
          var w = data.week || {};
          if (!w.sessions) return ['No sessions this week yet. One tonight changes that.'];
          return [w.sessions + ' session' + (w.sessions === 1 ? '' : 's') + ' this week, ' +
            (w.attempts || 0) + ' shots up. Goal is ' + (w.goal || 5) + ' sessions.'];
        } },
      { q: 'Open my heat map', go: 'track' },
      { q: 'Build my plan', go: 'train' }
    ];

    function fillChips() {
      while (chips.firstChild) chips.removeChild(chips.firstChild);
      ASKS.forEach(function (a) {
        chips.appendChild(h('button', {
          class: 'c12-chip', type: 'button',
          onclick: function () {
            userSay(a.q);
            if (a.go) { setTimeout(function () { ctx.go(a.go); }, 350); return; }
            setTimeout(function () { a.a().forEach(coachSay); }, 420);
          }
        }, [h('span', { text: a.q })]));
      });
    }

    host.appendChild(h('div', { class: 'c12-chat-hd' }, [
      h('button', {
        class: 'c12-back', type: 'button', 'aria-label': 'Back',
        onclick: back
      }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
      h('div', {}, [
        h('div', { class: 'c12-chat-hd__t', text: 'The Scout' }),
        h('div', { class: 'c12-chat-hd__s', text: 'Only talks about shots that really happened' })
      ])
    ]));
    host.appendChild(thread);
    host.appendChild(chips);

    scoutLines(data).forEach(coachSay);
    fillChips();
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
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (d) {
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
        title: key + (did ? ' — ' + did + ' session' + (did > 1 ? 's' : '') : '')
      }, [h('span', { text: d.getDate() })]));
    }
    return wrap;
  }

  /* ── main view ────────────────────────────────────────────────*/
  function mainView(host, ctx, data) {
    while (host.firstChild) host.removeChild(host.firstChild);
    host.appendChild(V12.header('Coach', 'Your corner of the gym.'));

    var grid = h('div', { class: 'c12-grid' });

    /* coach identity */
    grid.appendChild(V12.card({
      tint: 'green', class: 'c12-id', bgIcon: 'ph-strategy', bgTone: 'green'
    }, [
      h('div', { class: 'c12-id__face' }, [h('i', { class: 'ph-fill ph-chalkboard-teacher' })]),
      h('div', { class: 'c12-id__n', text: 'THE SCOUT' }),
      h('div', { class: 'c12-id__s', text: data.t.vatt ? data.t.vatt + ' scored shots on film' : 'Waiting on film' })
    ]));

    /* training calendar (tall, right) */
    grid.appendChild(V12.card({ class: 'c12-calcard' }, [
      h('div', { class: 'd-label', text: 'TRAINING CALENDAR' }),
      calendar(data.sessions),
      h('div', { class: 'c12-cal__lg' }, [
        h('span', { class: 'c12-cal__dot' }), h('span', { text: 'Session day' })
      ])
    ]));

    /* chat door */
    grid.appendChild(V12.card({
      tint: 'blue', class: 'c12-door', bgIcon: 'ph-chat-circle-dots', bgTone: 'blue',
      onClick: function () { chatView(host, ctx, data, function () { mainView(host, ctx, data); }); },
      label: 'Chat with coach'
    }, [
      h('i', { class: 'ph-fill ph-chat-circle-dots c12-door__ic' }),
      h('div', { class: 'c12-door__t', text: 'CHAT WITH COACH' }),
      h('div', { class: 'c12-door__s', text: (scoutLines(data)[0] || '').slice(0, 64) + '…' })
    ]));

    host.appendChild(grid);

    /* your team — honest empty state until a social backend exists */
    host.appendChild(V12.card({
      tint: 'purple', class: 'c12-team', bgIcon: 'ph-users-three', bgTone: 'purple',
      onClick: function () { ctx.go('social'); }, label: 'Your team'
    }, [
      h('div', { class: 'c12-team__t', text: 'YOUR TEAM' }),
      h('div', { class: 'c12-team__s',
        text: 'Nobody on the roster yet. Invite friends and their sessions show up here.' }),
      h('div', { class: 'c12-team__cta' }, [
        h('i', { class: 'ph-bold ph-user-plus' }),
        h('span', { text: 'Invite friends' })
      ])
    ]));

    host.appendChild(V12.btn({
      label: 'Track a session', icon: 'ph-play-circle', variant: 'green',
      onClick: function () { ctx.go('camera-hud'); }
    }));
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    return Promise.all([
      ctx.data.getCoachVerdict(),
      ctx.data.getZones(),
      ctx.data.getSessions(60),
      ctx.data.getWeekStats()
    ]).then(function (r) {
      var zones = r[1] || {};
      var mean = C.playerMean(zones);
      var data = {
        coach: r[0], zones: zones, sessions: r[2] || [], week: r[3] || {},
        t: totals(zones), rank: ranked(zones, mean)
      };
      mainView(host, ctx, data);
    });
  }

  window.app.register('coach', render);
})();
