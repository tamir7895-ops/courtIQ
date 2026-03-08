/* ══════════════════════════════════════════════════════════════
   SOCIAL HUB — js/social-hub.js
   Three social/viral features:
   1. Friend Challenges (shareable URL links)
   2. Global / Country Leaderboard (by XP)
   3. Share Progress Card (Canvas, Spotify Wrapped-style)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LS_CHALLENGES      = 'courtiq-challenges';
  var LS_ACTIVE_CHALLENGE = 'courtiq-active-challenge';
  var currentTheme = 'dark';

  /* Mirrors gamification.js LEVELS */
  var LEVELS = [
    { name: 'Rookie',   icon: '🏀', threshold: 0    },
    { name: 'Hooper',   icon: '⚡', threshold: 200  },
    { name: 'All-Star', icon: '⭐', threshold: 600  },
    { name: 'MVP',      icon: '👑', threshold: 1500 }
  ];

  function getLevel(xp) {
    var lvl = LEVELS[0];
    for (var i = LEVELS.length - 1; i >= 0; i--) {
      if (xp >= LEVELS[i].threshold) { lvl = LEVELS[i]; break; }
    }
    return lvl;
  }

  /* ── Sub-tab switching ──────────────────────────────────────── */
  window.shSwitchTab = function (tab) {
    document.querySelectorAll('.sh-tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.sh-section').forEach(function (s) {
      s.classList.remove('sh-active');
    });
    var el = document.getElementById('sh-' + tab);
    if (el) {
      el.classList.add('sh-active');
      if (tab === 'leaderboard') loadLeaderboard();
      if (tab === 'share')       { setTimeout(renderShareCard, 60); }
    }
  };

  /* ══════════════════════════════════════════════════════════════
     FEATURE 1 — FRIEND CHALLENGES
     ══════════════════════════════════════════════════════════════ */

  var CHALLENGE_TYPES = {
    '3pt': { label: '3-Point Shots', icon: '🎯', short: '3PT' },
    'fg':  { label: 'Field Goals',   icon: '🏀', short: 'FG'  },
    'ft':  { label: 'Free Throws',   icon: '🎳', short: 'FT'  }
  };

  function getChallenges() {
    try { return JSON.parse(localStorage.getItem(LS_CHALLENGES) || '[]'); } catch (e) { return []; }
  }

  function saveChallenges(list) {
    try { localStorage.setItem(LS_CHALLENGES, JSON.stringify(list)); } catch (e) {}
  }

  function getActiveChallenge() {
    try { return JSON.parse(localStorage.getItem(LS_ACTIVE_CHALLENGE) || 'null'); } catch (e) { return null; }
  }

  function setActiveChallenge(c) {
    try {
      if (c) localStorage.setItem(LS_ACTIVE_CHALLENGE, JSON.stringify(c));
      else   localStorage.removeItem(LS_ACTIVE_CHALLENGE);
    } catch (e) {}
  }

  window.shCreateChallenge = function () {
    var type   = document.getElementById('sh-ch-type').value;
    var target = parseInt(document.getElementById('sh-ch-target').value) || 50;
    var time   = parseInt(document.getElementById('sh-ch-time').value) || 10;

    var creatorName = 'Player';
    var nameEl = document.getElementById('db-sidebar-name');
    if (nameEl && nameEl.textContent && nameEl.textContent !== 'Player') {
      creatorName = nameEl.textContent;
    } else if (window.currentUser && window.currentUser.email) {
      creatorName = window.currentUser.email.split('@')[0];
    }

    var code = btoa(JSON.stringify({ type: type, target: target, time: time, creator: creatorName }));
    var url  = window.location.origin + window.location.pathname + '?challenge=' + code + '#social';

    var linkText = document.getElementById('sh-link-text');
    var linkBox  = document.getElementById('sh-generated-link');
    if (linkText) linkText.textContent = url;
    if (linkBox)  linkBox.style.display = 'flex';
  };

  window.shCopyLink = function () {
    var text = (document.getElementById('sh-link-text') || {}).textContent || '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      var btn = document.querySelector('.sh-copy-btn');
      if (!btn) return;
      btn.textContent = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(function () {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 2200);
    });
  };

  window.shAcceptCode = function () {
    var input = document.getElementById('sh-accept-input');
    var code = (input ? input.value.trim() : '');
    if (!code) return;
    if (code.includes('?challenge=')) {
      code = code.split('?challenge=')[1].split('#')[0].split('&')[0];
    }
    loadChallengeFromCode(code);
    if (input) input.value = '';
  };

  function loadChallengeFromCode(code) {
    try {
      var c = JSON.parse(atob(code));
      if (!c.type || !c.target || !c.time) throw new Error('invalid');
      setActiveChallenge({ code: code, type: c.type, target: c.target, time: c.time, creator: c.creator || 'Friend' });
      renderChallenges();
      if (typeof showToast === 'function') {
        var ct = CHALLENGE_TYPES[c.type] || CHALLENGE_TYPES.fg;
        showToast('⚔️ Challenge from ' + (c.creator || 'Friend') + ': ' + c.target + ' ' + ct.short + ' in ' + c.time + 'min!');
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast('Invalid challenge code');
    }
  }

  window.shOpenLogModal = function () {
    var c = getActiveChallenge();
    if (!c) return;
    var ct = CHALLENGE_TYPES[c.type] || CHALLENGE_TYPES.fg;
    var sub = document.getElementById('sh-modal-sub');
    if (sub) sub.textContent = 'Goal: ' + c.target + ' ' + ct.label + ' in ' + c.time + ' min — enter your score:';
    var input = document.getElementById('sh-attempt-input');
    if (input) { input.value = ''; input.focus(); }
    var overlay = document.getElementById('sh-log-overlay');
    if (overlay) overlay.style.display = 'flex';
  };

  window.shCloseLogModal = function () {
    var overlay = document.getElementById('sh-log-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  window.shSubmitAttempt = function () {
    var c = getActiveChallenge();
    if (!c) { shCloseLogModal(); return; }
    var made = parseInt((document.getElementById('sh-attempt-input') || {}).value) || 0;
    var beat = made >= c.target;

    var list = getChallenges();
    list.unshift({
      id:      Date.now(),
      type:    c.type,
      target:  c.target,
      time:    c.time,
      creator: c.creator,
      made:    made,
      beat:    beat,
      date:    new Date().toISOString()
    });
    if (list.length > 20) list = list.slice(0, 20);
    saveChallenges(list);

    // XP bonus
    if (typeof XPSystem !== 'undefined') {
      XPSystem.grantXP(beat ? 35 : 15, beat ? 'Challenge Beaten! 🏆' : 'Challenge Attempt');
    }

    setActiveChallenge(null);
    shCloseLogModal();
    renderChallenges();

    if (typeof showToast === 'function') {
      showToast(beat
        ? '🏆 You beat the challenge! ' + made + '/' + c.target + ' shots!'
        : '💪 Attempt logged: ' + made + '/' + c.target);
    }
  };

  window.shDismissChallenge = function () {
    if (!confirm('Dismiss this challenge?')) return;
    setActiveChallenge(null);
    renderChallenges();
  };

  function renderChallenges() {
    var dyn = document.getElementById('sh-challenges-dynamic');
    if (!dyn) return;

    var active  = getActiveChallenge();
    var history = getChallenges();
    var html = '';

    /* Active challenge banner */
    if (active) {
      var ct = CHALLENGE_TYPES[active.type] || CHALLENGE_TYPES.fg;
      html +=
        '<div class="sh-active-challenge">' +
          '<div class="sh-active-label">⚔️ Active Challenge from ' + esc(active.creator || 'Friend') + '</div>' +
          '<div class="sh-active-desc">' + ct.icon + ' Make ' + active.target + ' ' + ct.label + ' in ' + active.time + ' min</div>' +
          '<div class="sh-active-actions">' +
            '<button class="sh-log-attempt-btn" onclick="shOpenLogModal()">🏀 Log My Attempt</button>' +
            '<button class="sh-dismiss-btn" onclick="shDismissChallenge()">Dismiss</button>' +
          '</div>' +
        '</div>';
    }

    /* History */
    if (history.length === 0) {
      html +=
        '<div class="sh-empty-state">' +
          '<div class="sh-empty-icon">⚔️</div>' +
          '<div>No challenges yet.<br>Create one and share the link with a friend!</div>' +
        '</div>';
    } else {
      html += '<div class="sh-section-title">Challenge History</div>';
      html += history.map(function (ch) {
        var ctype = CHALLENGE_TYPES[ch.type] || CHALLENGE_TYPES.fg;
        var date  = new Date(ch.date).toLocaleDateString();
        return '<div class="sh-challenge-card">' +
          '<div class="sh-challenge-icon">' + ctype.icon + '</div>' +
          '<div class="sh-challenge-info">' +
            '<div class="sh-challenge-name">' + ch.target + ' ' + ctype.short + ' in ' + ch.time + 'min</div>' +
            '<div class="sh-challenge-meta">From ' + esc(ch.creator || 'Friend') + ' · ' + date + '</div>' +
          '</div>' +
          '<div class="sh-challenge-score">' +
            '<div class="sh-challenge-result">' + ch.made + '/' + ch.target + '</div>' +
            '<div class="sh-challenge-status ' + (ch.beat ? 'won' : '') + '">' + (ch.beat ? '🏆 Won' : 'Not beaten') + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    dyn.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════════
     FEATURE 2 — GLOBAL / COUNTRY LEADERBOARD
     ══════════════════════════════════════════════════════════════ */

  var lbData   = [];
  var lbLoaded = false;

  async function loadLeaderboard() {
    var list = document.getElementById('sh-lb-list');
    if (!list) return;
    list.innerHTML = '<div class="sh-lb-loading">🔄 Loading leaderboard…</div>';

    try {
      if (typeof sb === 'undefined') throw new Error('no-sb');
      var res = await sb.from('profiles')
        .select('id, username, full_name, country, user_data')
        .limit(200);
      if (res.error) throw res.error;

      lbData = (res.data || []).map(function (p) {
        var xp = 0;
        try { xp = (p.user_data && p.user_data.xp_data) ? (p.user_data.xp_data.xp || 0) : 0; } catch (_) {}
        return {
          id:      p.id,
          name:    p.full_name || p.username || 'Player',
          country: p.country  || '',
          xp:      xp
        };
      }).sort(function (a, b) { return b.xp - a.xp; });

      lbLoaded = true;
    } catch (_) {
      lbData   = demoBoardData();
      lbLoaded = true;
    }

    renderLeaderboard();
  }

  function demoBoardData() {
    var entries = [
      { name: 'Jordan M.',  country: 'USA',      xp: 2860 },
      { name: 'LeBron J.',  country: 'USA',      xp: 2710 },
      { name: 'Steph C.',   country: 'USA',      xp: 2580 },
      { name: 'Luka D.',    country: 'Slovenia', xp: 2450 },
      { name: 'Giannis A.', country: 'Greece',   xp: 2310 },
      { name: 'Nikola J.',  country: 'Serbia',   xp: 2170 },
      { name: 'Jayson T.',  country: 'USA',      xp: 2050 },
      { name: 'Joel E.',    country: 'Cameroon', xp: 1940 },
      { name: 'Damian L.',  country: 'USA',      xp: 1830 },
      { name: 'Devin B.',   country: 'USA',      xp: 1720 },
      { name: 'Trae Y.',    country: 'USA',      xp: 1600 },
      { name: 'Ja M.',      country: 'USA',      xp: 1490 },
      { name: 'Zion W.',    country: 'USA',      xp: 1380 },
      { name: 'Kawhi L.',   country: 'Canada',   xp: 1270 },
      { name: 'Paul G.',    country: 'USA',      xp: 1160 },
      { name: 'Jimmy B.',   country: 'USA',      xp: 1050 },
      { name: 'Donovan M.', country: 'USA',      xp: 940  },
      { name: 'Kyrie I.',   country: 'Australia',xp: 840  },
      { name: 'Bam A.',     country: 'USA',      xp: 730  },
      { name: 'Anthony D.', country: 'USA',      xp: 625  }
    ];
    return entries.map(function (e, i) { return Object.assign({ id: 'demo-' + i }, e); });
  }

  window.shFilterLeaderboard = function () { renderLeaderboard(); };
  window.shRefreshLeaderboard = function () { lbLoaded = false; loadLeaderboard(); };

  function renderLeaderboard() {
    var list = document.getElementById('sh-lb-list');
    if (!list || !lbLoaded) return;

    var sel     = document.getElementById('sh-lb-country');
    var country = sel ? sel.value : 'All';
    var rows    = country && country !== 'All'
      ? lbData.filter(function (r) { return r.country === country; })
      : lbData;
    rows = rows.slice(0, 20);

    if (rows.length === 0) {
      list.innerHTML = '<div class="sh-lb-empty">No players found for this country.</div>';
      return;
    }

    var myId = window.currentUser ? window.currentUser.id : null;
    list.innerHTML = rows.map(function (row, i) {
      var rank  = i + 1;
      var level = getLevel(row.xp);
      var inits = initials(row.name);
      var isMe  = myId && row.id === myId;
      var rankStr = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
      var rankCls = rank <= 3 ? 'sh-lb-rank-' + rank : '';
      return '<div class="sh-lb-row' + (isMe ? ' sh-me' : '') + '">' +
        '<div class="sh-lb-rank ' + rankCls + '">' + rankStr + '</div>' +
        '<div class="sh-lb-avatar">' + inits + '</div>' +
        '<div class="sh-lb-info">' +
          '<div class="sh-lb-name">' + esc(row.name) + (isMe ? '<span class="sh-me-tag">YOU</span>' : '') + '</div>' +
          '<div class="sh-lb-sub">' + level.icon + ' ' + level.name + (row.country ? ' · ' + esc(row.country) : '') + '</div>' +
        '</div>' +
        '<div class="sh-lb-xp">' +
          '<div class="sh-lb-xp-val">' + row.xp.toLocaleString() + '</div>' +
          '<div class="sh-lb-xp-label">XP</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════════
     FEATURE 3 — SHARE PROGRESS CARD (Canvas)
     ══════════════════════════════════════════════════════════════ */

  var THEMES = {
    dark:   { bg1: '#0d0d1a', bg2: '#1a1a2e', accent: '#f5a623', text: '#ffffff', sub: '#9999bb' },
    amber:  { bg1: '#1a0f00', bg2: '#2d1a00', accent: '#ffbe4d', text: '#ffffff', sub: '#ccaa77' },
    green:  { bg1: '#001a0d', bg2: '#00280f', accent: '#56d364', text: '#ffffff', sub: '#77aa88' },
    ocean:  { bg1: '#00111a', bg2: '#001e2e', accent: '#4db8ff', text: '#ffffff', sub: '#77aacc' },
    purple: { bg1: '#1a001a', bg2: '#2a0033', accent: '#cc77ff', text: '#ffffff', sub: '#aa77bb' }
  };

  window.shSetTheme = function (theme) {
    currentTheme = theme;
    document.querySelectorAll('.sh-theme-swatch').forEach(function (sw) {
      sw.classList.toggle('selected', sw.dataset.theme === theme);
    });
    renderShareCard();
  };

  function getPlayerStats() {
    var xp = 0, sessions = 0, drills = 0, shotSessions = 0;
    try { var xd = localStorage.getItem('courtiq-xp'); if (xd) xp = JSON.parse(xd).xp || 0; } catch (_) {}
    try {
      var wd = localStorage.getItem('db-weeks');
      if (wd) JSON.parse(wd).forEach(function (w) { sessions += (w.sessions || []).length; });
    } catch (_) {}
    try { var dd = localStorage.getItem('courtiq-saved-drills'); if (dd) drills = JSON.parse(dd).length || 0; } catch (_) {}
    try { var ss = localStorage.getItem('courtiq-shot-sessions'); if (ss) shotSessions = JSON.parse(ss).length || 0; } catch (_) {}

    var name = 'Player';
    var nameEl = document.getElementById('db-sidebar-name');
    if (nameEl && nameEl.textContent && nameEl.textContent !== 'Player') {
      name = nameEl.textContent;
    } else if (window.currentUser && window.currentUser.email) {
      name = window.currentUser.email.split('@')[0];
    }
    return { xp: xp, sessions: sessions, drills: drills, shotSessions: shotSessions, name: name };
  }

  function renderShareCard() {
    var canvas = document.getElementById('sh-share-canvas');
    if (!canvas) return;
    var W = 1080, H = 1080;
    canvas.width  = W;
    canvas.height = H;
    var ctx   = canvas.getContext('2d');
    var theme = THEMES[currentTheme] || THEMES.dark;
    var stats = getPlayerStats();
    var level = getLevel(stats.xp);

    /* Background */
    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, theme.bg1);
    grad.addColorStop(1, theme.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    /* Grid */
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 60) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
    for (var gy = 0; gy < H; gy += 60) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }

    /* Glow */
    var glow = ctx.createRadialGradient(W*0.8, H*0.2, 0, W*0.8, H*0.2, 550);
    glow.addColorStop(0, theme.accent + '28');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    /* CourtIQ brand */
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 40px Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('CourtIQ', 70, 68);

    /* Season badge */
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    rr(ctx, W-190, 58, 120, 44, 22); ctx.fill();
    ctx.fillStyle = theme.sub;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('2025–26', W-72, 80);

    /* Avatar circle */
    var ax = 200, ay = 360, ar = 115;
    ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI*2);
    ctx.fillStyle = theme.accent + '1a'; ctx.fill();
    ctx.strokeStyle = theme.accent + '55'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 84px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials(stats.name), ax, ay);

    /* Level badge */
    ctx.fillStyle = theme.accent + '2a';
    rr(ctx, ax-85, ay+ar+16, 170, 46, 23); ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(level.icon + ' ' + level.name.toUpperCase(), ax, ay+ar+39);

    /* Player name */
    ctx.fillStyle = theme.text;
    ctx.font = 'bold 68px Arial';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(stats.name, 370, 310);

    ctx.fillStyle = theme.sub;
    ctx.font = '32px Arial';
    ctx.fillText('My CourtIQ Season Recap', 370, 356);

    /* Divider */
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(370, 390); ctx.lineTo(W-70, 390); ctx.stroke();

    /* Stat cards — 2×2 grid */
    var statsArr = [
      { label: 'XP Earned',    value: stats.xp.toLocaleString(), icon: '⭐' },
      { label: 'Sessions',     value: String(stats.sessions),     icon: '📅' },
      { label: 'Drills Saved', value: String(stats.drills),       icon: '🏀' },
      { label: 'Shot Sessions',value: String(stats.shotSessions), icon: '🎯' }
    ];
    var sx = 370, sy = 430, cw = 172, ch = 120, gap = 18;
    statsArr.forEach(function (s, i) {
      var col = i % 2, row = Math.floor(i / 2);
      var cx2 = sx + col*(cw+gap), cy2 = sy + row*(ch+gap);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      rr(ctx, cx2, cy2, cw, ch, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.055)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = '30px Arial'; ctx.fillStyle = theme.text;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(s.icon, cx2+14, cy2+14);
      ctx.font = 'bold 42px Arial'; ctx.fillStyle = theme.accent;
      ctx.fillText(s.value, cx2+14, cy2+46);
      ctx.font = '20px Arial'; ctx.fillStyle = theme.sub;
      ctx.fillText(s.label, cx2+14, cy2+94);
    });

    /* Big XP highlight box (right) */
    var bx = W-310, by = 430, bw = 240, bh = 280;
    var bg2 = ctx.createLinearGradient(bx, by, bx, by+bh);
    bg2.addColorStop(0, theme.accent + '20');
    bg2.addColorStop(1, theme.accent + '08');
    ctx.fillStyle = bg2; rr(ctx, bx, by, bw, bh, 24); ctx.fill();
    ctx.strokeStyle = theme.accent + '40'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = theme.accent;
    ctx.font = '26px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('TOTAL XP', bx+bw/2, by+26);
    ctx.font = 'bold 82px Arial'; ctx.textBaseline = 'middle';
    ctx.fillText(stats.xp.toLocaleString(), bx+bw/2, by+162);
    ctx.font = '22px Arial'; ctx.fillStyle = theme.sub;
    ctx.textBaseline = 'bottom';
    ctx.fillText(level.icon + ' ' + level.name, bx+bw/2, by+bh-18);

    /* Court arc decoration */
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W/2, H+120, 290, Math.PI, 0, false); ctx.stroke();

    /* Footer */
    ctx.fillStyle = theme.sub;
    ctx.font = '22px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('courtiq.app · ' + new Date().getFullYear(), W/2, H-38);
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y,   x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h,   x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y,     x+r, y);
    ctx.closePath();
  }

  window.shDownloadCard = function () {
    renderShareCard();
    var canvas = document.getElementById('sh-share-canvas');
    if (!canvas) return;
    var a = document.createElement('a');
    a.download = 'courtiq-season-recap.png';
    a.href     = canvas.toDataURL('image/png');
    a.click();
  };

  window.shShareNative = function () {
    var canvas = document.getElementById('sh-share-canvas');
    if (!canvas) return;
    canvas.toBlob(function (blob) {
      var file = new File([blob], 'courtiq-recap.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          title: 'My CourtIQ Season Recap',
          text:  'Check out my basketball training stats on CourtIQ!',
          files: [file]
        }).catch(function () {});
      } else {
        window.shDownloadCard();
      }
    });
  };

  /* ── Helpers ─────────────────────────────────────────────── */
  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function initials(name) {
    var parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
    return String(name).substring(0, 2).toUpperCase();
  }

  /* ── Check URL params for incoming challenge links ─────────── */
  function checkUrlChallenge() {
    var params = new URLSearchParams(window.location.search);
    var code   = params.get('challenge');
    if (!code) return;
    /* Clean URL */
    var clean = window.location.pathname + (window.location.hash || '');
    window.history.replaceState({}, '', clean);
    setTimeout(function () {
      loadChallengeFromCode(code);
      if (typeof dbSwitchTabById === 'function') dbSwitchTabById('social');
    }, 900);
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    checkUrlChallenge();
    setTimeout(function () {
      renderChallenges();
      /* Hide native share button if Web Share API not available */
      if (!navigator.share) {
        var btn = document.getElementById('sh-share-native-btn');
        if (btn) btn.classList.add('hidden');
      }
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SocialHub = { renderChallenges: renderChallenges, loadLeaderboard: loadLeaderboard, renderShareCard: renderShareCard };
})();
