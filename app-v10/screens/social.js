/* app-v10/screens/social.js — v12
   SOCIAL — the sketch's five rooms:

     LEADERBOARD (big)     FRIENDS (small)
                           CHALLENGES (small)
     ──────────── STATS ────────────
     ──────── FRIENDS ACTIVITY ─────

   This screen used to be a designed invitation with no backend behind
   it. It now runs on real data: friend_leaderboard() aggregates the
   caller plus their accepted friends, and friend codes connect people
   without anyone being able to probe whether an e-mail has an account.

   The M4 rule still holds — every number here is REAL or absent. A
   league of one still SAYS it is a league of one rather than inventing
   rivals, and a signed-out player is told plainly that the board needs
   an account instead of being shown a hollow one.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  function toast(msg, tone) {
    var el = h('div', { class: 's12-toast' + (tone ? ' s12-toast--' + tone : ''), text: msg });
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('is-out'); }, 2200);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
  }

  /* Sharing the code is the whole growth loop, so it gets the native
     sheet when there is one and a clipboard copy when there isn't. */
  function invite(code) {
    var text = code
      ? 'Training with CourtIQ — AI shot tracking. Add me with my code: ' + code
      : 'Training with CourtIQ — AI shot tracking. Come compete with me.';
    try {
      if (navigator.share) { navigator.share({ title: 'CourtIQ', text: text }); return; }
    } catch (e) {}
    try {
      navigator.clipboard.writeText(text);
      toast('Invite copied');
      if (window.V10UI && window.V10UI.confetti) window.V10UI.confetti({ count: 12 });
    } catch (e) {}
  }

  /* ── the board ──────────────────────────────────────────────────
     One row per player, already sorted by makes server-side. Ranks are
     positional, so they stay honest even when two players tie. */
  function boardRows(rows, prof) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var mine = !!r.is_me;
      var name = r.display_name || (mine ? (prof.name || 'You') : 'Player');
      out.push(h('div', { class: 's12-lb__row' + (mine ? ' s12-lb__row--you' : '') }, [
        h('div', { class: 's12-lb__rank', text: String(i + 1) }),
        mine
          ? h('div', { class: 's12-lb__av', style: { backgroundImage: 'url(' + V12.avatarUrl(prof) + ')' } })
          : h('div', { class: 's12-lb__av s12-lb__av--other' }, [
              h('span', { text: name.charAt(0).toUpperCase() })
            ]),
        h('div', { class: 's12-lb__main' }, [
          h('div', { class: 's12-lb__n', text: name }),
          h('div', { class: 's12-lb__s',
            text: r.made + '/' + r.attempts + ' · ' + r.accuracy + '%' })
        ])
      ]));
    }
    return out;
  }

  /* ── add-a-friend ───────────────────────────────────────────────
     A code, not an e-mail. The server answers 'not_found' identically
     for an unknown code and for your own, so nothing here can be used
     to discover who has an account. */
  function addFriendCard(ctx, refresh) {
    var input = h('input', {
      class: 'onb12-input s12-add__in', type: 'text', maxlength: '6',
      placeholder: 'ABC123', autocapitalize: 'characters',
      autocomplete: 'off', spellcheck: 'false'
    });
    input.addEventListener('input', function () {
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    var btn = h('button', { class: 'd-btn d-btn--blue s12-add__go', type: 'button' },
      [h('span', { text: 'Add' })]);

    btn.addEventListener('click', function () {
      var code = input.value.trim();
      if (code.length < 6) { toast('Enter all 6 characters'); return; }
      btn.setAttribute('disabled', 'true');
      ctx.data.addFriendByCode(code).then(function (res) {
        btn.removeAttribute('disabled');
        if (res && res.ok) {
          input.value = '';
          toast(res.status === 'accepted' ? 'You are now friends' : 'Request sent', 'good');
          if (window.V10UI && window.V10UI.confetti) window.V10UI.confetti({ count: 16 });
          refresh();
          return;
        }
        var why = (res && res.reason) || 'error';
        if (why === 'not_found')            toast('No player with that code');
        else if (why === 'already_pending') toast('Request already sent');
        else if (why === 'already_accepted')toast('You are already friends');
        else if (why === 'already_blocked') toast('Cannot add that player');
        else                                toast('Could not add — try again');
      });
    });

    return V12.card({ class: 's12-add' }, [
      h('div', { class: 'd-label', text: 'ADD A FRIEND' }),
      h('div', { class: 's12-add__row' }, [input, btn])
    ]);
  }

  /* ── your own code ──────────────────────────────────────────────*/
  function codeCard(code) {
    return V12.card({ class: 's12-code', tint: 'blue' }, [
      h('div', { class: 'd-label', text: 'YOUR FRIEND CODE' }),
      h('div', { class: 's12-code__row' }, [
        h('div', { class: 's12-code__v', text: code }),
        h('button', {
          class: 's12-code__share', type: 'button',
          onclick: function () { invite(code); }
        }, [
          h('i', { class: 'ph-bold ph-share-network' }),
          h('span', { text: 'SHARE' })
        ])
      ])
    ]);
  }

  /* ── requests waiting on you ────────────────────────────────────*/
  function requestsCard(ctx, reqs, refresh) {
    var rows = reqs.map(function (r) {
      var accept = h('button', { class: 's12-req__btn s12-req__btn--yes', type: 'button' },
        [h('i', { class: 'ph-bold ph-check' })]);
      var reject = h('button', { class: 's12-req__btn s12-req__btn--no', type: 'button' },
        [h('i', { class: 'ph-bold ph-x' })]);
      accept.addEventListener('click', function () {
        ctx.data.respondToRequest(r.id, true).then(function (ok) {
          toast(ok ? 'Friend added' : 'Could not accept', ok ? 'good' : '');
          if (ok && window.V10UI && window.V10UI.confetti) window.V10UI.confetti({ count: 16 });
          refresh();
        });
      });
      reject.addEventListener('click', function () {
        ctx.data.respondToRequest(r.id, false).then(function () { refresh(); });
      });
      return h('div', { class: 's12-req__row' }, [
        h('i', { class: 'ph-fill ph-user-circle s12-req__ic' }),
        h('div', { class: 's12-req__t', text: 'A player wants to compete' }),
        accept, reject
      ]);
    });

    return V12.card({ class: 's12-req', tint: 'gold' }, [
      h('div', { class: 'd-label', text: 'FRIEND REQUESTS' })
    ].concat(rows));
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    var signedIn = ctx.data.isSignedIn && ctx.data.isSignedIn();

    function paint() {
      while (host.firstChild) host.removeChild(host.firstChild);

      return Promise.all([
        ctx.data.getProfile(),
        ctx.data.getWeekStats(),
        ctx.data.getLeaderboard(7),
        ctx.data.getFriendCode(),
        ctx.data.getPendingRequests()
      ]).then(function (r) {
        var prof  = r[0] || {};
        var week  = r[1] || { sessions: 0, attempts: 0, goal: 5 };
        var board = r[2] || [];
        var code  = r[3];
        var reqs  = r[4] || [];

        /* Everyone on the board except you is, by definition, a friend. */
        var friendCount = Math.max(0, board.length - 1);

        host.appendChild(V12.header('Social', 'The gym is better with company.'));

        var grid = h('div', { class: 's12-grid' });

        /* leaderboard */
        var lbKids = [h('div', { class: 'd-label', text: 'LEADERBOARD' })];

        if (!signedIn) {
          lbKids.push(h('div', { class: 's12-lb__hint',
            text: 'Sign in to put yourself on a board and race your friends.' }));
          lbKids.push(h('button', {
            class: 's12-lb__cta', type: 'button',
            onclick: function () { ctx.go('me'); }
          }, [h('i', { class: 'ph-bold ph-sign-in' }), h('span', { text: 'SIGN IN' })]));
        } else {
          lbKids = lbKids.concat(boardRows(board, prof));
          if (friendCount === 0) {
            lbKids.push(h('div', { class: 's12-lb__empty' }, [
              h('div', { class: 's12-lb__ghost' }, [h('span', { text: '2' })]),
              h('div', { class: 's12-lb__hint',
                text: 'A league of one. Share your code and this becomes a race.' })
            ]));
          }
          lbKids.push(h('button', {
            class: 's12-lb__cta', type: 'button',
            onclick: function () { invite(code); }
          }, [h('i', { class: 'ph-bold ph-user-plus' }), h('span', { text: 'INVITE' })]));
        }

        grid.appendChild(V12.card({
          tint: 'purple', class: 's12-lb', bgIcon: 'ph-ranking', bgTone: 'purple'
        }, lbKids));

        /* friends (small) — a real count now */
        grid.appendChild(V12.card({
          class: 's12-tile', bgIcon: 'ph-users-three', bgTone: 'blue',
          onClick: function () { invite(code); }, label: 'Friends'
        }, [
          h('i', { class: 'ph-fill ph-users-three s12-tile__ic s12-tile__ic--blue' }),
          h('div', { class: 's12-tile__t', text: 'FRIENDS' }),
          h('div', { class: 's12-tile__v', text: String(friendCount) })
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

        if (signedIn && reqs.length) host.appendChild(requestsCard(ctx, reqs, paint));
        if (signedIn && code)        host.appendChild(codeCard(code));
        if (signedIn)                host.appendChild(addFriendCard(ctx, paint));

        /* stats — your week */
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

        /* friends activity — still an empty room until there is a feed
           to fill it. Nothing here invents an event. */
        var feedEmpty = V12.empty('Quiet in here',
          friendCount
            ? 'Session activity from your friends will land here.'
            : 'When friends join, their sessions land here — "Dana put up 120 shots" — and yours lands on theirs.');
        feedEmpty.classList.add('s12-feed__empty');
        host.appendChild(V12.card({ class: 's12-feed' }, [
          h('div', { class: 'd-label', text: 'FRIENDS ACTIVITY' }),
          feedEmpty
        ]));

        host.appendChild(V12.btn({
          label: signedIn ? 'Share my code' : 'Invite friends',
          icon: 'ph-user-plus',
          onClick: function () { invite(code); }
        }));
      });
    }

    return paint();
  }

  window.app.register('social', render);
})();
