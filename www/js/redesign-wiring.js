/* ══════════════════════════════════════════════════════════════
   COURTIQ — Premium UI Redesign Wiring
   Hero data, count-up animations, recent sessions table.
   No new libraries. Reads from existing DOM + localStorage.
   ══════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  /* ── helpers ─────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function mk(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  /* ── COUNT-UP ANIMATION ──────────────────────────────── */
  function animateCountUp(node, target, duration) {
    if (!node) return;
    duration = duration || 800;
    var start = null, from = 0;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(from + (target - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ── HERO DATA WIRING ───────────────────────────────── */
  function wireHero() {
    var profile = {};
    try { profile = JSON.parse(localStorage.getItem('courtiq-player-profile') || '{}'); } catch(e) {}
    var obData = {};
    try { obData = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}'); } catch(e) {}

    var name = profile.name || obData.name || 'Player';
    var position = profile.position || obData.position || 'PG';

    // Hero name
    var heroName = $('db-hero-name');
    if (heroName) heroName.textContent = 'Hey, ' + name + '! \uD83D\uDC4B';

    // Avatar initials
    var initials = name.split(' ').map(function(w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
    var avatarInitials = $('db-hero-avatar-initials');
    if (avatarInitials) avatarInitials.textContent = initials;

    // Copy avatar image if available
    var avatarContainer = $('db-hero-avatar');
    if (avatarContainer) {
      var pwAvatar = $('db-pw-avatar');
      if (pwAvatar) {
        var srcImg = pwAvatar.querySelector('img');
        if (srcImg) {
          var clone = srcImg.cloneNode(true);
          clone.style.width = '100%';
          clone.style.height = '100%';
          clone.style.objectFit = 'cover';
          clone.style.borderRadius = '50%';
          while (avatarContainer.firstChild) avatarContainer.removeChild(avatarContainer.firstChild);
          avatarContainer.appendChild(clone);
        }
      }
    }

    // Rank & position
    var rank = 'Rookie';
    var rankSrc = $('xp-rank');
    if (rankSrc && rankSrc.textContent) rank = rankSrc.textContent;
    var heroRank = $('db-hero-rank');
    if (heroRank) heroRank.textContent = rank + ' \u00B7 ' + position;

    // XP numbers — clone child nodes safely
    var xpNumsSrc = $('xp-numbers');
    var xpNumsDst = $('db-hero-xp-nums');
    if (xpNumsSrc && xpNumsDst) {
      while (xpNumsDst.firstChild) xpNumsDst.removeChild(xpNumsDst.firstChild);
      var children = xpNumsSrc.childNodes;
      for (var i = 0; i < children.length; i++) {
        xpNumsDst.appendChild(children[i].cloneNode(true));
      }
    }

    // XP bar fill
    var xpFillSrc = $('xp-bar-fill');
    var xpFillDst = $('db-hero-xp-fill');
    if (xpFillSrc && xpFillDst) {
      setTimeout(function() {
        xpFillDst.style.width = xpFillSrc.style.width || '0%';
      }, 300);
    }

    // Daily challenge name
    var dcName = document.querySelector('.dc-name');
    var heroChName = $('db-hero-challenge-name');
    if (dcName && heroChName && dcName.textContent.trim()) {
      heroChName.textContent = dcName.textContent.trim();
    }
  }

  /* ── STAT COUNT-UP ON LOAD ──────────────────────────── */
  function wireStatCountUp() {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var stats = entry.target.querySelectorAll('.db-home-stat-value');
          stats.forEach(function(s) {
            var val = parseInt(s.textContent, 10);
            if (!isNaN(val) && val > 0 && !s.dataset.animated) {
              s.dataset.animated = '1';
              animateCountUp(s, val, 800);
            }
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    var statsRow = document.querySelector('.db-home-stats-row');
    if (statsRow) observer.observe(statsRow);
  }

  /* ── SVG SKILL RINGS ANIMATION ─────────────────────── */
  function wireSkillRings() {
    var CIRC = 2 * Math.PI * 42; // r=42, circumference ~263.9
    var rings = document.querySelectorAll('.db-ring');
    if (!rings.length) return;

    // Read skill data from localStorage (same source as dashboard.js)
    var ob = {};
    try { ob = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}'); } catch(e) {}
    var skills = (ob && ob.skills) || {};
    var skillMap = {
      shooting: (skills.shooting || 5) * 10,
      dribbling: (skills.dribbling || skills.ballhandling || 5) * 10,
      defense: (skills.defense || 5) * 10,
      gameiq: (skills.gameIQ || skills.gameiq || skills.bbiq || 5) * 10
    };

    rings.forEach(function(ring) {
      var skill = ring.getAttribute('data-skill');
      var pct = skillMap[skill] || 0;
      ring.setAttribute('data-pct', pct);

      var progress = ring.querySelector('.db-ring-progress');
      var label = ring.querySelector('.db-ring-pct');
      if (!progress) return;

      // Set initial hidden state via SVG attributes
      var circStr = CIRC.toFixed(1);
      progress.setAttribute('stroke-dasharray', circStr);
      progress.setAttribute('stroke-dashoffset', circStr);

      // Animate to target after delay — setAttribute triggers CSS transition
      setTimeout(function() {
        var offset = CIRC - (CIRC * pct / 100);
        progress.setAttribute('stroke-dashoffset', offset.toFixed(1));
      }, 400);

      if (label) label.textContent = pct + '%';
    });
  }

  /* ── RECENT SESSIONS TABLE (safe DOM construction) ──── */
  function renderRecentSessions() {
    var container = $('db-recent-sessions');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    var sessions = [];
    try { sessions = JSON.parse(localStorage.getItem('courtiq-shot-sessions') || '[]'); } catch(e) {}

    if (!sessions || sessions.length === 0) {
      var empty = mk('div', 'db-recent-empty');
      empty.textContent = 'No sessions yet \u2014 start tracking! \uD83C\uDFC0';
      container.appendChild(empty);
      return;
    }

    // Title
    var title = mk('div', 'db-recent-sessions-title');
    title.textContent = 'Recent Sessions';
    container.appendChild(title);

    // Table
    var table = mk('table', 'db-recent-table');
    var thead = mk('thead');
    var headRow = mk('tr');
    ['Date', 'Type', 'Makes', 'Misses', 'Accuracy'].forEach(function(h) {
      var th = mk('th');
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = mk('tbody');
    var recent = sessions.slice(-5).reverse();
    recent.forEach(function(s) {
      var makes = s.makes || s.shotsMade || 0;
      var misses = s.misses || s.shotsMissed || 0;
      var total = makes + misses;
      var acc = total > 0 ? Math.round((makes / total) * 100) : 0;
      var accClass = acc >= 60 ? 'accuracy-green' : (acc >= 40 ? 'accuracy-amber' : 'accuracy-red');
      var dateStr = s.date
        ? new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '\u2014';
      var type = s.type || s.mode || 'Practice';

      var tr = mk('tr');
      [dateStr, type, String(makes), String(misses)].forEach(function(val) {
        var td = mk('td');
        td.textContent = val;
        tr.appendChild(td);
      });
      var accTd = mk('td', accClass);
      accTd.textContent = acc + '%';
      tr.appendChild(accTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    // View All button
    var viewAll = mk('button', 'db-recent-view-all');
    viewAll.textContent = 'View All \u2192';
    viewAll.addEventListener('click', function() {
      if (typeof dbSwitchTab === 'function') dbSwitchTab('shots');
    });
    container.appendChild(viewAll);
  }

  /* ── INIT ────────────────────────────────────────────── */
  function initRedesign() {
    wireHero();
    wireStatCountUp();
    wireSkillRings();
    renderRecentSessions();

    // Retry rings after dashboard data may have loaded
    setTimeout(wireSkillRings, 1500);

    // Re-wire hero when XP system updates
    if (typeof XPSystem !== 'undefined' && XPSystem.render) {
      var _orig = XPSystem.render;
      XPSystem.render = function() {
        _orig.apply(this, arguments);
        setTimeout(wireHero, 100);
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(initRedesign, 400); });
  } else {
    setTimeout(initRedesign, 400);
  }
})();
