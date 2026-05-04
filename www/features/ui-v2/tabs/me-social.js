/* CourtIQ UI v2 — Me Social (8.9)
 *
 * Surfaces leaderboard + active challenge under the Me tab "Social"
 * sub-nav chip. Reads top-200 profiles from Supabase via the same
 * query social-hub.js uses (sb.from('profiles')...) and falls back
 * to a tasteful demo list if no auth.
 *
 * "Send Challenge" CTA reuses the legacy global window.shCreateChallenge
 * if available (creates a shareable code + URL); falls back to a
 * direct copy of the dashboard URL.
 *
 * Built with createElement — no innerHTML.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.ME_SOCIAL) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function initials(name) {
    if (!name) return '?';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  /* ── Leaderboard data ────────────────────────────────────── */
  function demoBoard() {
    return [
      { name: 'Jordan M.',  country: 'USA',      xp: 2860 },
      { name: 'LeBron J.',  country: 'USA',      xp: 2710 },
      { name: 'Steph C.',   country: 'USA',      xp: 2580 },
      { name: 'Luka D.',    country: 'Slovenia', xp: 2450 },
      { name: 'Giannis A.', country: 'Greece',   xp: 2310 },
      { name: 'Nikola J.',  country: 'Serbia',   xp: 2170 },
      { name: 'Jayson T.',  country: 'USA',      xp: 2050 },
      { name: 'Joel E.',    country: 'Cameroon', xp: 1940 },
      { name: 'Damian L.',  country: 'USA',      xp: 1830 },
      { name: 'Devin B.',   country: 'USA',      xp: 1720 }
    ];
  }

  function readMyXP() {
    try {
      var raw = localStorage.getItem('courtiq-xp');
      if (!raw) return 0;
      var p = JSON.parse(raw);
      return (p && typeof p.xp === 'number') ? p.xp : 0;
    } catch (e) { return 0; }
  }
  function readMyName() {
    try {
      if (window.currentUser && window.currentUser.user_metadata) {
        var m = window.currentUser.user_metadata;
        if (m.first_name || m.last_name) return ((m.first_name || '') + ' ' + (m.last_name || '')).trim();
      }
      if (window.currentUser && window.currentUser.email) return window.currentUser.email.split('@')[0];
    } catch (e) {}
    return 'You';
  }

  function loadLeaderboard() {
    return new Promise(function (resolve) {
      try {
        if (typeof sb === 'undefined' || !sb || !sb.from) { resolve(demoBoard()); return; }
        sb.from('profiles')
          .select('id, username, full_name, country, user_data')
          .limit(200)
          .then(function (res) {
            if (res.error || !res.data) { resolve(demoBoard()); return; }
            var rows = res.data.map(function (p) {
              var xp = 0;
              try { xp = (p.user_data && p.user_data.xp_data) ? (p.user_data.xp_data.xp || 0) : 0; } catch (_) {}
              return {
                id: p.id,
                name: p.full_name || p.username || 'Player',
                country: p.country || '',
                xp: xp
              };
            }).sort(function (a, b) { return b.xp - a.xp; });
            resolve(rows.length ? rows : demoBoard());
          }, function () { resolve(demoBoard()); });
      } catch (e) { resolve(demoBoard()); }
    });
  }

  /* ── Render ──────────────────────────────────────────────── */
  function buildRow(rank, entry, isMe) {
    var row = el('div', 'ciq-lb-row');
    if (isMe) row.classList.add('me');
    if (rank <= 3) row.classList.add('podium-' + rank);

    var rk = el('div', 'ciq-lb-rank', String(rank));
    row.appendChild(rk);

    var av = el('div', 'ciq-lb-avatar', initials(entry.name));
    row.appendChild(av);

    var nm = el('div', 'ciq-lb-name');
    nm.textContent = entry.name;
    if (entry.country) {
      var c = el('span', 'ciq-lb-country', '· ' + entry.country);
      nm.appendChild(c);
    }
    row.appendChild(nm);

    var xp = el('div', 'ciq-lb-xp');
    xp.textContent = String(entry.xp || 0);
    var l = el('span', 'l', 'XP');
    xp.appendChild(l);
    row.appendChild(xp);

    return row;
  }

  function renderBoard(listEl, myRankEl, rows) {
    clear(listEl);
    var myXP = readMyXP();
    var myName = readMyName();

    var combined = rows.slice();
    var myEntry = { id: '__me__', name: myName, country: '', xp: myXP, __isMe: true };
    if (myXP > 0 || (window.currentUser && window.currentUser.id)) {
      combined.push(myEntry);
    }
    combined.sort(function (a, b) { return b.xp - a.xp; });

    var top = combined.slice(0, 10);
    top.forEach(function (entry, i) {
      listEl.appendChild(buildRow(i + 1, entry, !!entry.__isMe));
    });

    var myIdx = combined.findIndex(function (e) { return e.__isMe; });
    if (myRankEl) {
      clear(myRankEl);
      if (myIdx >= 0) {
        var prefix = document.createTextNode('You are ranked ');
        var b = document.createElement('b');
        b.textContent = '#' + (myIdx + 1);
        var suffix = document.createTextNode(' of ' + combined.length + ' · ' + (myXP || 0) + ' XP');
        myRankEl.appendChild(prefix);
        myRankEl.appendChild(b);
        myRankEl.appendChild(suffix);
      } else {
        myRankEl.textContent = 'Sign in to compete on the leaderboard.';
      }
    }
  }

  /* ── Mount ───────────────────────────────────────────────── */
  function build() {
    var host = el('section');
    host.id = 'ciq-me-social';
    host.setAttribute('aria-label', 'Social');

    host.appendChild(el('div', 'ciq-soc-eyebrow', 'Squad'));
    host.appendChild(el('div', 'ciq-soc-title', 'Social.'));

    /* Leaderboard card */
    var lbCard = el('section', 'ciq-soc-card');
    var lbHead = el('div', 'ciq-soc-section-head');
    lbHead.appendChild(el('div', 'ciq-soc-section-eyebrow', 'Top 10 Leaderboard'));
    lbHead.appendChild(el('div', 'ciq-soc-section-meta', 'Live'));
    lbCard.appendChild(lbHead);
    lbCard.appendChild(el('div', 'ciq-soc-section-sub', 'Compete on total XP earned across sessions and drills.'));
    var list = el('div', 'ciq-lb-list');
    list.appendChild(el('div', 'ciq-soc-loading', 'Loading leaderboard…'));
    lbCard.appendChild(list);
    var myRank = el('div', 'ciq-soc-myrank');
    lbCard.appendChild(myRank);
    host.appendChild(lbCard);

    /* Challenge card */
    var ch = el('section', 'ciq-ch-card');
    ch.appendChild(el('div', 'ciq-ch-card-eyebrow', '⚡ Challenge'));
    ch.appendChild(el('div', 'ciq-ch-card-title', 'Send a 5-Minute Showdown.'));
    ch.appendChild(el('div', 'ciq-ch-card-desc', 'Generate a shareable challenge link. Whoever lands more shots in 5 minutes wins.'));
    var row = el('div', 'ciq-soc-cta-row');
    var send = el('button', 'ciq-soc-cta', 'Send Challenge');
    send.type = 'button';
    send.addEventListener('click', sendChallenge);
    var copy = el('button', 'ciq-soc-cta secondary', 'Copy Link');
    copy.type = 'button';
    copy.addEventListener('click', copyDashboardLink);
    row.appendChild(send);
    row.appendChild(copy);
    ch.appendChild(row);
    host.appendChild(ch);

    return { host: host, list: list, myRank: myRank };
  }

  function sendChallenge() {
    if (typeof window.shCreateChallenge === 'function') {
      try { window.shCreateChallenge(); return; } catch (e) {}
    }
    copyDashboardLink();
  }

  function copyDashboardLink() {
    var url = location.href.split('?')[0];
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { flashToast('Link copied.'); }, function () { flashToast(url); });
    } else {
      flashToast(url);
    }
  }

  var toastEl = null, toastTm = null;
  function flashToast(text) {
    if (!toastEl) {
      toastEl = el('div', 'ciq-drill-toast');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTm);
    toastTm = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* ── Sub-nav wiring ──────────────────────────────────────── */
  function wireSubnav() {
    var subnav = document.querySelector('#ciq-me-screen .ciq-me-subnav');
    if (!subnav) {
      setTimeout(wireSubnav, 200);
      return;
    }
    subnav.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ciq-subtab]');
      if (!b) return;
      var sub = b.getAttribute('data-ciq-subtab');
      document.body.classList.remove('ciq-me-sub-profile', 'ciq-me-sub-social', 'ciq-me-sub-shop');
      document.body.classList.add('ciq-me-sub-' + sub);
      if (sub === 'social') {
        e.stopImmediatePropagation();
        Array.prototype.forEach.call(subnav.children, function (c) {
          c.classList.toggle('active', c === b);
        });
      }
    }, true);
    document.body.classList.add('ciq-me-sub-profile');
  }

  function init() {
    var screen = document.getElementById('ciq-me-screen');
    if (!screen) {
      setTimeout(init, 200);
      return;
    }
    if (document.getElementById('ciq-me-social')) return;
    var built = build();
    screen.parentNode.insertBefore(built.host, screen.nextSibling);

    loadLeaderboard().then(function (rows) {
      renderBoard(built.list, built.myRank, rows);
    });

    wireSubnav();

    window.CIQ_SOCIAL = {
      reload: function () {
        loadLeaderboard().then(function (rows) { renderBoard(built.list, built.myRank, rows); });
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 100);
})();
