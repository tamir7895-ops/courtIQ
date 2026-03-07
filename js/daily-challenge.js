/* ============================================================
   DAILY CHALLENGE — /js/daily-challenge.js
   Generates one challenge per day, tracks completion + streak.
   Persists to localStorage. Grants XP on completion.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'courtiq-daily-challenge';
  var XP_REWARD  = 30;

  /* ── Challenge Pool ──────────────────────────────────────── */
  var CHALLENGES = [
    { icon: '🏀', name: 'Free Throw Focus',     desc: 'Hit 50 free throws — focus on consistent form and follow-through.', target: '50 free throws' },
    { icon: '⚡', name: 'Crossover Blitz',       desc: 'Perform 30 crossovers at full speed — alternate stationary and on-the-move.', target: '30 crossovers' },
    { icon: '🎯', name: 'Layup Gauntlet',        desc: 'Complete 20 layups alternating left and right hand finishes.', target: '20 layups' },
    { icon: '🔥', name: 'Mid-Range Master',      desc: 'Knock down 15 mid-range jumpers from the elbow and baseline.', target: '15 mid-range shots' },
    { icon: '💪', name: 'Euro Step Drill',       desc: 'Run 12 euro step finishes from each side at full game speed.', target: '12 euro steps per side' },
    { icon: '🎯', name: 'Three-Point Streak',    desc: 'Make 10 three-pointers — rotate through 5 spots behind the arc.', target: '10 three-pointers' },
    { icon: '⚡', name: 'Ball Handling Ladder',   desc: 'Complete 3 rounds of pound-cross-between-behind at increasing speed.', target: '3 rounds' },
    { icon: '🏀', name: 'Post Move Practice',    desc: 'Execute 15 post moves — mix drop steps, hook shots, and up-and-unders.', target: '15 post moves' },
    { icon: '🔥', name: 'Spot-Up Shooting',      desc: 'Shoot from 5 spots (corner, wing, top) — 4 shots each, track makes.', target: '20 spot-up shots' },
    { icon: '💪', name: 'Defensive Slides',      desc: 'Complete 20 defensive slide sequences — baseline to baseline, full intensity.', target: '20 slide sequences' },
    { icon: '🎯', name: 'Pull-Up Jumper Drill',  desc: 'Attack off the dribble and pull up for 12 mid-range jumpers at game speed.', target: '12 pull-up jumpers' },
    { icon: '⚡', name: 'Fast Break Finishes',   desc: 'Sprint coast-to-coast and finish at the rim 10 times — alternate layups and floaters.', target: '10 fast break finishes' }
  ];

  /* ── Helpers ──────────────────────────────────────────────── */
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (_) { return {}; }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /* Pick a challenge deterministically for a given date string */
  function pickChallenge(dateStr) {
    var hash = 0;
    for (var i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
      hash |= 0;
    }
    var idx = Math.abs(hash) % CHALLENGES.length;
    return CHALLENGES[idx];
  }

  /* Calculate current streak */
  function calcStreak(state) {
    var streak = 0;
    var d = new Date();
    // If today is completed, start counting from today, else from yesterday
    var key = todayKey();
    if (state[key] && state[key].completed) {
      streak = 1;
      d.setDate(d.getDate() - 1);
    } else {
      d.setDate(d.getDate() - 1);
    }
    // Count consecutive past days
    for (var i = 0; i < 365; i++) {
      var k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (state[k] && state[k].completed) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  /* ── Get today's challenge (cached in state) ────────────── */
  function getTodayChallenge() {
    var key = todayKey();
    var state = loadState();

    // If today's challenge is already stored, use it
    if (state[key] && typeof state[key].challengeIndex === 'number') {
      var idx = state[key].challengeIndex;
      if (idx >= 0 && idx < CHALLENGES.length) {
        return CHALLENGES[idx];
      }
    }

    // Pick deterministically and save the index
    var challenge = pickChallenge(key);
    var idx = CHALLENGES.indexOf(challenge);
    if (!state[key]) state[key] = {};
    state[key].challengeIndex = idx;
    saveState(state);
    return challenge;
  }

  /* ── Render ──────────────────────────────────────────────── */
  function render() {
    var card = document.getElementById('dc-card');
    if (!card) return;

    var key = todayKey();
    var state = loadState();
    var challenge = getTodayChallenge();
    var done = state[key] && state[key].completed;
    var streak = calcStreak(state);

    // Update streak badge in profile card
    var streakBadge = document.getElementById('db-streak-badge');
    if (streakBadge) {
      if (streak > 0) {
        streakBadge.textContent = '\ud83d\udd25 ' + streak + '-day streak';
        streakBadge.style.display = '';
      } else {
        streakBadge.style.display = 'none';
      }
    }

    // Toggle completed class
    if (done) {
      card.classList.add('dc-completed');
    } else {
      card.classList.remove('dc-completed');
    }

    card.innerHTML =
      '<div class="dc-header">' +
        '<div class="dc-title-area">' +
          '<div class="dc-icon">' + challenge.icon + '</div>' +
          '<div>' +
            '<div class="dc-label">' + (done ? '✓ Challenge Complete' : 'Daily Challenge') + '</div>' +
            '<div class="dc-name">' + challenge.name + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="dc-xp-badge">' + (done ? '✓ +' + XP_REWARD + ' XP Earned' : '🏆 +' + XP_REWARD + ' XP') + '</div>' +
      '</div>' +
      '<div class="dc-body">' +
        '<div class="dc-desc">' + challenge.desc + ' <strong style="color:var(--c-white);">Target: ' + challenge.target + '</strong></div>' +
        (done
          ? '<div class="dc-done-badge">✅ Completed</div>'
          : '<button class="dc-complete-btn" onclick="DailyChallenge.complete()">Mark Complete</button>') +
      '</div>' +
      (streak > 0
        ? '<div class="dc-streak">🔥 <span class="dc-streak-count">' + streak + '-day streak</span> — keep it going!</div>'
        : '<div class="dc-streak">Complete today\'s challenge to start a streak!</div>');
  }

  /* ── Complete ────────────────────────────────────────────── */
  function complete() {
    var key = todayKey();
    var state = loadState();
    if (state[key] && state[key].completed) return; // already done

    state[key] = { completed: true, ts: Date.now() };
    saveState(state);

    // Grant XP
    if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
      XPSystem.grantXP(XP_REWARD, 'Daily Challenge');
    }

    render();
  }

  /* ── Init (call on page load) ────────────────────────────── */
  function init() {
    render();
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Expose ──────────────────────────────────────────────── */
  window.DailyChallenge = {
    init: init,
    render: render,
    complete: complete
  };
})();
