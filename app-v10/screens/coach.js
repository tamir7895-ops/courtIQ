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

  /* ── chat view ────────────────────────────────────────────────
     Signed in: a real conversation — V12CoachAI carries the player's
     actual zones, sessions, plan and Court IQ to Claude through the
     claude-proxy edge function, and the model can adjust the plan via
     the @@ACTION protocol.
     Signed out: the proxy 401s, so guests keep the local guided
     answers — labelled as such, never pretending to be live. */
  function chatView(host, ctx, data, back) {
    while (host.firstChild) host.removeChild(host.firstChild);

    var live = !!(window.V12CoachAI && window.V12CoachAI.signedIn());
    var thread = h('div', { class: 'c12-thread' });
    var chips = h('div', { class: 'c12-chips' });
    var busy = false;

    function coachSay(text) {
      var b = h('div', { class: 'c12-msg c12-msg--coach' }, [
        h('div', { class: 'c12-msg__face' }, [h('i', { class: 'ph-fill ph-chalkboard-teacher' })]),
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

    /* The coach proposed a program — render it as a card with the ONE
       button that actually writes it into the plan. Until that tap,
       nothing changed. */
    /* Monday-first — MUST match V12Plan.DOW (schedule index 0 = Monday) */
    var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    function proposalCard(p) {
      var card = h('div', { class: 'c12-proposal' });
      card.appendChild(h('div', { class: 'c12-proposal__t', text: p.name }));
      card.appendChild(h('div', {
        class: 'c12-proposal__s',
        text: p.days.length + ' sessions · ' + p.minutes + ' min each'
      }));
      p.days.forEach(function (d) {
        card.appendChild(h('div', { class: 'c12-proposal__day' }, [
          h('span', { class: 'c12-proposal__dow', text: DOW[d.dow] }),
          h('span', {
            class: 'c12-proposal__what',
            text: d.drills.length ? d.drills.join(' · ') : d.focus
          })
        ]));
      });
      var btn = h('button', {
        class: 'c12-proposal__build', type: 'button',
        onclick: function () {
          var msg = window.V12CoachAI.applyProposal(p);
          btn.disabled = true;
          btn.textContent = 'In your plan';
          if (msg) coachSay(msg);
          try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
        }
      }, [
        h('i', { class: 'ph-fill ph-hammer' }),
        h('span', { text: 'Build this into my plan' })
      ]);
      card.appendChild(btn);
      thread.appendChild(card);
      thread.scrollTop = thread.scrollHeight;
    }

    /* Local answers — the guest path, and the safety net when the
       proxy is down. Same voice, same real numbers. */
    function localAnswer(q) {
      var rank = data.rank, w = data.week || {};
      if (/work on|improve|weak/i.test(q)) {
        if (!rank.length) return 'Not enough scored shots from any one spot. Give me ' +
          C.MIN_VERDICTS + ' from a zone and I rate it.';
        var cold = rank[rank.length - 1];
        var cz = data.zones[cold];
        return 'Spend 30 reps a session at the ' + C.LABEL[cold].toLowerCase() +
          '. It sits at ' + cz.made + ' of ' + cz.vatt + '. The plan screen has a block for it.';
      }
      if (/week|today/i.test(q)) {
        if (!w.sessions) return 'No sessions this week yet. One tonight changes that.';
        return w.sessions + ' session' + (w.sessions === 1 ? '' : 's') + ' this week, ' +
          (w.attempts || 0) + ' shots up. Goal is ' + (w.goal || 5) + ' sessions.';
      }
      return 'Sign in and I can answer that properly — with your film in front of me. ' +
        'Until then: the quick questions below always work.';
    }

    function send(q) {
      if (busy || !q) return;
      userSay(q);
      if (!live) {
        setTimeout(function () { coachSay(localAnswer(q)); }, 380);
        return;
      }
      busy = true;
      var t = typing();
      window.V12CoachAI.ask(q, data, ctx).then(function (r) {
        t.remove(); busy = false;
        coachSay(r.text);
        if (r.proposal) proposalCard(r.proposal);
        if (r.confirmation) coachSay(r.confirmation);
      }).catch(function (e) {
        t.remove(); busy = false;
        if (e && e.guest) { live = false; coachSay(localAnswer(q)); return; }
        /* proxy down ≠ coach silent: answer locally, and say the REAL
           reason — a canned "try again" line hid a dead API key for a
           whole day because every failure read identically. */
        coachSay(localAnswer(q));
        var why = (e && e.message) ? e.message :
                  (e && e.name === 'AbortError') ? 'timed out after 30s' : 'network error';
        coachSay('(Local answer — the live coach is down: ' + why + ')');
      });
    }

    var STARTERS = [
      'What should I work on?',
      'How does my week look?',
      'Build my week around shooting',
      'Why did my Court IQ move?'
    ];
    STARTERS.forEach(function (q) {
      chips.appendChild(h('button', {
        class: 'c12-chip', type: 'button',
        onclick: function () { send(q); }
      }, [h('span', { text: q })]));
    });

    /* free-text row — the reason this screen exists now */
    var input = h('input', {
      class: 'c12-chat-in__field', type: 'text',
      placeholder: live ? 'Ask the coach anything…' : 'Sign in for the live coach — chips work now',
      'aria-label': 'Message the coach', maxlength: '280', autocomplete: 'off'
    });
    var sendBtn = h('button', {
      class: 'c12-chat-in__send', type: 'button', 'aria-label': 'Send',
      onclick: function () { var q = input.value.trim(); input.value = ''; send(q); }
    }, [h('i', { class: 'ph-fill ph-paper-plane-right' })]);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); sendBtn.click(); }
    });

    /* Back does NOT reset — a coach remembers the conversation. Starting
       over is an explicit small control in the header instead. */
    host.appendChild(h('div', { class: 'c12-chat-hd' }, [
      h('button', {
        class: 'c12-back', type: 'button', 'aria-label': 'Back',
        onclick: back
      }, [h('i', { class: 'ph-bold ph-arrow-left' })]),
      h('div', { style: { flex: '1', minWidth: '0' } }, [
        h('div', { class: 'c12-chat-hd__t', text: 'The Scout' }),
        h('div', { class: 'c12-chat-hd__s',
          text: live ? 'Live — reads your real film before every answer'
                     : 'Only talks about shots that really happened' })
      ]),
      h('button', {
        class: 'c12-back', type: 'button', 'aria-label': 'New conversation',
        title: 'New conversation',
        onclick: function () {
          if (window.V12CoachAI) window.V12CoachAI.reset();
          chatView(host, ctx, data, back);
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
    function replay() {
      var past = (live && window.V12CoachAI.transcript) ? window.V12CoachAI.transcript() : [];
      if (past.length) {
        past.forEach(function (m) {
          if (m.role === 'user') userSay(m.content);
          else {
            /* strip any action line from stored assistant turns */
            coachSay(m.content.replace(/@@ACTION\s+\{[^\n]*\}\s*$/, '').replace(/\s+$/, ''));
          }
        });
      } else {
        scoutLines(data).forEach(coachSay);
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

    /* coach identity — print DNA: paper + navy border + offset shadow */
    grid.appendChild(V12.card({
      tint: 'ink', class: 'c12-id', bgIcon: 'ph-strategy', bgTone: 'green'
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
      class: 'c12-team', bgIcon: 'ph-users-three', bgTone: 'purple',
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
