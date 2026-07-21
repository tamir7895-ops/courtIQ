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
  /* ── the coaching staff — the Duolingo cast, basketball edition ──
     Four characters, four faces, four brains: the GM runs the program,
     the specialists own their lane. DiceBear faces are deterministic
     (fixed seeds), so every player meets the same four coaches. */
  var COACHES = [
    { id: 'gm', name: 'The Scout', role: 'GM · runs your whole program',
      short: 'The GM', seed: 'courtiq-the-scout', bg: 'b6e3f4',
      starters: ['What should I work on?', 'How does my week look?',
                 'Build my week around shooting', 'Why did my Court IQ move?'] },
    { id: 'splash', name: 'Splash', role: 'Shooting coach', short: 'Shooting',
      seed: 'courtiq-splash-7', bg: 'ffd5dc',
      opener: 'Splash. Shooting coach. Form, release, footwork into the shot — that is my whole world. What is broken?',
      starters: ['Tips for a better release', 'Why am I missing short?',
                 'Fix my free throws', 'Give me a shooting drill'] },
    { id: 'flow', name: 'Flow', role: 'Ball-handling coach', short: 'Handles',
      seed: 'courtiq-flow-3', bg: 'd1f4d1',
      opener: 'Flow here. Handles are rhythm — both hands, eyes up, ball on a string. What are we tightening?',
      starters: ['Strengthen my weak hand', 'A daily handle routine',
                 'Drill for tight spaces', 'How do I protect my dribble?'] },
    { id: 'tank', name: 'Tank', role: 'Strength & conditioning', short: 'Fitness',
      seed: 'courtiq-tank-9', bg: 'ffdfbf',
      opener: 'Tank. Strength and conditioning. We build the motor and protect the knees. What do you need?',
      starters: ['Get me game-fit', 'My legs die in the second half',
                 'A pre-game warm-up', 'How do I jump higher?'] }
  ];
  function coachFace(c, size) {
    return 'https://api.dicebear.com/9.x/avataaars/png?size=' + (size || 96) +
      '&seed=' + encodeURIComponent(c.seed) + '&backgroundColor=' + c.bg;
  }

  function chatView(host, ctx, data, back, coach) {
    while (host.firstChild) host.removeChild(host.firstChild);
    coach = coach || COACHES[0];
    if (window.V12CoachAI && window.V12CoachAI.setPersona) {
      window.V12CoachAI.setPersona(coach.id);
    }

    var live = !!(window.V12CoachAI && window.V12CoachAI.signedIn());
    var thread = h('div', { class: 'c12-thread c12-thread--' + coach.id });
    var chips = h('div', { class: 'c12-chips' });
    var busy = false;

    /* Starter chips greet an empty room; the moment a real exchange
       exists they are furniture in the way — fade them out. */
    var chipsGone = false;
    function dropChips() {
      if (chipsGone) return;
      chipsGone = true;
      chips.classList.add('is-leaving');
      setTimeout(function () { chips.remove(); }, 260);
    }

    function coachSay(text) {
      var b = h('div', { class: 'c12-msg c12-msg--coach' }, [
        /* the coach's own face on every bubble — characters, not icons */
        h('img', { class: 'c12-msg__face c12-msg__face--img', src: coachFace(coach, 64), alt: '' }),
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

    /* ── the tactics board ──────────────────────────────────────────
       When a coach names a drill, he pulls out the clipboard: the
       drill's real choreography, framed like a coach's board, with a
       button that starts it. Detection is by exact library name in
       the reply — the server prompt tells coaches to name drills
       verbatim, and this is why. */
    function drillBoard(text) {
      try {
        if (!window.V12DrillChoreo || !window.V12DrillCourt || typeof _DRILLS_DB === 'undefined') return;
        var hit = null, low = String(text || '').toLowerCase();
        for (var i = 0; i < _DRILLS_DB.length; i++) {
          if (low.indexOf(_DRILLS_DB[i].name.toLowerCase()) >= 0) { hit = _DRILLS_DB[i]; break; }
        }
        if (!hit) return;
        var c = window.V12DrillChoreo.get(hit);
        if (!c) return;
        var board = h('div', { class: 'c12-board' }, [
          h('div', { class: 'c12-board__hd' }, [
            h('i', { class: 'ph-fill ph-clipboard' }),
            h('span', { text: coach.name.toUpperCase() + "'S BOARD" })
          ]),
          window.V12DrillCourt.render(c, { label: hit.name }),
          h('div', { class: 'c12-board__ft' }, [
            h('div', { class: 'c12-board__n', text: hit.name }),
            h('button', {
              class: 'c12-board__go', type: 'button',
              onclick: function () {
                try {
                  sessionStorage.setItem('courtiq_v11_drill', JSON.stringify({
                    id: hit.id, name: hit.name,
                    reps: hit.reps_or_sets ? parseInt(String(hit.reps_or_sets), 10) || 30 : 30,
                    mins: hit.duration_minutes || 8,
                    focus: hit.focus_area || 'Skill',
                    description: hit.description || ''
                  }));
                } catch (e) {}
                ctx.go('workout-player');
              }
            }, [h('i', { class: 'ph-fill ph-play-circle' }), h('span', { text: 'Run it' })])
          ])
        ]);
        thread.appendChild(board);
        thread.scrollTop = thread.scrollHeight;
      } catch (e) { /* the board is a bonus — never break the chat for it */ }
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
          try {
            if (window.V10UI && window.V10UI.confetti) window.V10UI.confetti({ count: 18 });
          } catch (e2) {}
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
      dropChips();
      try { if (navigator.vibrate) navigator.vibrate(10); } catch (e0) {}
      if (!live) {
        setTimeout(function () { coachSay(localAnswer(q)); }, 380);
        return;
      }
      busy = true;
      var t = typing();
      window.V12CoachAI.ask(q, data, ctx).then(function (r) {
        t.remove(); busy = false;
        coachSay(r.text);
        drillBoard(r.text);
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

    var STARTERS = coach.starters;
    STARTERS.forEach(function (q) {
      chips.appendChild(h('button', {
        class: 'c12-chip', type: 'button',
        onclick: function () { send(q); }
      }, [h('span', { text: q })]));
    });

    /* free-text row — the reason this screen exists now */
    var input = h('input', {
      class: 'c12-chat-in__field', type: 'text',
      placeholder: live ? 'Ask ' + coach.name + ' anything…' : 'Sign in for the live coach — chips work now',
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
      h('img', { class: 'c12-chat-hd__face', src: coachFace(coach, 72), alt: '' }),
      h('div', { style: { flex: '1', minWidth: '0' } }, [
        h('div', { class: 'c12-chat-hd__t', text: coach.name }),
        h('div', { class: 'c12-chat-hd__s',
          text: coach.role + (live ? ' · reads your real film' : ' · sign in for live answers') })
      ]),
      h('button', {
        class: 'c12-back', type: 'button', 'aria-label': 'New conversation',
        title: 'New conversation',
        onclick: function () {
          if (window.V12CoachAI) window.V12CoachAI.reset();
          chatView(host, ctx, data, back, coach);
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
    /* the coach's daily challenge sits at the top of his room —
       real progress only, XP on claim */
    (function challengeCard() {
      if (!window.V12Challenges) return;
      var s = window.V12Challenges.state(coach.id, data);
      if (!s || s.claimed) return;
      var pct = Math.round(s.done / s.total * 100);
      var bar = h('div', { class: 'c12-chal__bar' }, [
        h('div', { class: 'c12-chal__fill', style: { width: pct + '%' } })
      ]);
      var btn = h('button', {
        class: 'c12-chal__btn', type: 'button', disabled: s.complete ? undefined : 'disabled',
        onclick: function () {
          var r = window.V12Challenges.claim(coach.id, data);
          if (r) {
            btn.disabled = true;
            btn.textContent = r.bonus
              ? '+' + window.V12Challenges.XP + ' XP · staff sweep +' + window.V12Challenges.BONUS + ' XP'
              : '+' + window.V12Challenges.XP + ' XP';
            try { if (window.V11Audio && V11Audio.ok) V11Audio.ok(); } catch (e0) {}
            try {
              if (window.V10UI && window.V10UI.confetti) {
                window.V10UI.confetti({ count: r.bonus ? 40 : 16 });
              }
            } catch (e) {}
          }
        }
      }, [h('span', { text: s.complete ? 'Claim +' + window.V12Challenges.XP + ' XP' : s.done + '/' + s.total })]);
      thread.appendChild(h('div', { class: 'c12-chal' }, [
        h('div', { class: 'c12-chal__hd' }, [
          h('i', { class: 'ph-fill ph-basketball' }),
          h('span', { text: s.title.toUpperCase() })
        ]),
        h('div', { class: 'c12-chal__task', text: s.task }),
        bar, btn
      ]));
    })();

    function replay() {
      var past = (live && window.V12CoachAI.transcript) ? window.V12CoachAI.transcript() : [];
      if (past.length) {
        dropChips();             /* mid-conversation: no starter chips */
        past.forEach(function (m) {
          if (m.role === 'user') userSay(m.content);
          else {
            /* strip any action line from stored assistant turns */
            var clean = m.content.replace(/@@ACTION\s+\{[^\n]*\}\s*$/, '').replace(/\s+$/, '');
            coachSay(clean);
            drillBoard(clean);   /* boards survive reopening the chat */
          }
        });
      } else if (coach.id === 'gm') {
        scoutLines(data).forEach(coachSay);
      } else {
        coachSay(coach.opener);
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

    /* ── THE GYM — the Duolingo world, on our court ─────────────────
       One guided scene, not an open map: the real half court, the four
       coaches standing at their spots, and YOUR avatar. Tap a coach and
       your player walks over, then the conversation opens. A pulsing
       ball badge on a coach means his daily challenge is waiting. */
    var claimedN = window.V12Challenges ? window.V12Challenges.claimedToday() : 0;
    host.appendChild(h('div', {
      class: 'd-label c12-staff__label',
      text: claimedN > 0
        ? 'THE GYM — ' + claimedN + '/4 CHALLENGES COLLECTED TODAY'
        : 'THE GYM — WALK UP TO A COACH'
    }));
    var SPOTS = {                    /* % of the scene box, x/y */
      gm:     { x: 50, y: 56 },      /* free-throw line — runs the floor */
      splash: { x: 82, y: 26 },      /* right corner three — his office */
      flow:   { x: 18, y: 40 },      /* left wing — space to dance */
      tank:   { x: 72, y: 84 },      /* sideline — cones and pain */
      player: { x: 28, y: 88 }       /* you, walking in from the corner */
    };
    var scene = h('div', { class: 'c12-gym' });
    try {
      scene.appendChild(window.V12DrillCourt.render({}, { still: true, label: 'The gym' }));
    } catch (e) { scene.appendChild(V12.courtThumb('Shooting', 0, { label: 'The gym' })); }

    /* props — the difference between a menu and a place */
    var svgNS = 'http://www.w3.org/2000/svg';
    function prop(x, y, w, inner, label) {
      var el = document.createElementNS(svgNS, 'svg');
      el.setAttribute('viewBox', '0 0 40 40');
      el.setAttribute('class', 'c12-gym__prop');
      el.setAttribute('aria-label', label || '');
      el.setAttribute('style', 'left:' + x + '%;top:' + y + '%;width:' + w + 'px');
      el.innerHTML = inner;
      return el;
    }
    /* three cones by Tank's sideline */
    scene.appendChild(prop(60, 90, 34,
      '<path d="M6 30 L11 16 L16 30 Z" fill="#F5A623" stroke="#C97F0A"/>' +
      '<path d="M17 32 L22 18 L27 32 Z" fill="#F5A623" stroke="#C97F0A"/>' +
      '<path d="M28 30 L33 16 L38 30 Z" fill="#F5A623" stroke="#C97F0A"/>', 'Cones'));
    /* ball rack in Splash's corner office */
    scene.appendChild(prop(91, 33, 30,
      '<rect x="4" y="18" width="32" height="14" rx="3" fill="none" stroke="#0A2850" stroke-width="2.5"/>' +
      '<circle cx="12" cy="14" r="5" fill="#E8590C"/><circle cx="21" cy="14" r="5" fill="#E8590C"/>' +
      '<circle cx="30" cy="14" r="5" fill="#E8590C"/>', 'Ball rack'));
    /* the Scout's clipboard, leaning by his spot */
    scene.appendChild(prop(58, 60, 22,
      '<rect x="10" y="6" width="20" height="28" rx="3" fill="#FFFFFF" stroke="#0A2850" stroke-width="2.5"/>' +
      '<rect x="16" y="3" width="8" height="6" rx="2" fill="#0A2850"/>' +
      '<path d="M14 15 h12 M14 20 h12 M14 25 h8" stroke="#1C7ED6" stroke-width="2"/>', 'Clipboard'));

    var walking = false;
    var me = h('img', {
      class: 'c12-gym__me', alt: 'You',
      src: V12.avatarUrl(data.prof),
      style: { left: SPOTS.player.x + '%', top: SPOTS.player.y + '%' }
    });

    COACHES.forEach(function (c) {
      var chal = window.V12Challenges ? window.V12Challenges.state(c.id, data) : null;
      var badge = (chal && !chal.claimed)
        ? h('span', { class: 'c12-gym__badge' + (chal.complete ? ' is-ready' : '') }, [
            h('i', { class: 'ph-fill ph-basketball' })
          ])
        : null;
      scene.appendChild(h('button', {
        class: 'c12-gym__coach', type: 'button',
        'aria-label': 'Walk to ' + c.name + ' — ' + c.role,
        style: { left: SPOTS[c.id].x + '%', top: SPOTS[c.id].y + '%' },
        onclick: function (ev) {
          if (walking) return;
          walking = true;
          try { if (window.V11Audio && V11Audio.tick) V11Audio.tick(); } catch (e0) {}
          me.classList.add('is-walking');
          me.style.left = (SPOTS[c.id].x - 11) + '%';
          me.style.top = SPOTS[c.id].y + '%';
          /* he sees you coming — a beat of acknowledgement, then talk */
          var coachBtn = ev.currentTarget;
          setTimeout(function () {
            coachBtn.appendChild(h('span', { class: 'c12-gym__hi', text: '…' }));
          }, 650);
          setTimeout(function () {
            chatView(host, ctx, data, function () { mainView(host, ctx, data); }, c);
          }, 1150);
        }
      }, [
        h('img', { class: 'c12-gym__face', src: coachFace(c, 96), alt: '' }),
        h('span', { class: 'c12-gym__name', text: c.name }),
        badge
      ].filter(Boolean)));
    });
    scene.appendChild(me);
    host.appendChild(scene);

    /* claims made on another device land here — pull once per launch,
       repaint the badges if anything new arrived */
    if (window.V12Challenges && window.V12Challenges.sync && !mainView._chalSynced) {
      mainView._chalSynced = true;
      window.V12Challenges.sync().then(function (changed) {
        if (changed && host.querySelector('.c12-gym')) mainView(host, ctx, data);
      }, function () {});
    }

    /* the film-status card + calendar follow the court */
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
