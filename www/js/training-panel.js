/* ============================================================
   TRAINING PANEL — /js/training-panel.js
   Orchestrates the 4-section Training page:
     1. Weekly Overview (goals + challenge)
     2. Drill Generator (reuses drill-engine.js)
     3. Exercise Library (reuses drill-engine.js)
     4. Training Plan (schedule + AI coach chat)
   ============================================================ */

/* ── Weekly Challenge Pool (16 compound sequences) ────────── */
var WEEKLY_CHALLENGES = [
  {
    title: 'Shooting Foundations',
    description: 'Lock in your catch-and-shoot mechanics, five-spot consistency, and free-throw reliability under pressure.',
    drills: ['shoot-001', 'shoot-004', 'shoot-006'],
    totalTime: 44,
  },
  {
    title: 'Ball Handling Blitz',
    description: 'Build unbreakable handles with two-ball work, cone slalom speed, and fingertip control.',
    drills: ['bh-001', 'bh-002', 'bh-003'],
    totalTime: 33,
  },
  {
    title: 'Defense Blueprint',
    description: 'Sharpen on-ball pressure, help-side rotations, and deny positioning to become the toughest defender on the floor.',
    drills: ['def-001', 'def-002', 'def-005'],
    totalTime: 40,
  },
  {
    title: 'Finishing Strong',
    description: 'Dominate around the basket with layup packages, contact finishes, and reverse lay-in technique.',
    drills: ['fin-001', 'fin-002', 'fin-003'],
    totalTime: 42,
  },
  {
    title: 'Conditioning Base',
    description: 'Build the aerobic and anaerobic foundation every serious baller needs — suicides, sprints, and lateral quickness.',
    drills: ['cond-001', 'cond-002', 'cond-003'],
    totalTime: 38,
  },
  {
    title: 'Shot Creator Package',
    description: 'Develop your off-the-dribble game with pull-ups, floaters, and advanced ball-handling combos.',
    drills: ['shoot-002', 'bh-004', 'shoot-009'],
    totalTime: 43,
  },
  {
    title: 'Advanced Shooter Series',
    description: 'Elite shooting challenge — step-backs, deep threes, and contested makes that win close games.',
    drills: ['shoot-003', 'shoot-011', 'shoot-012'],
    totalTime: 50,
  },
  {
    title: 'Defense & Conditioning Combo',
    description: 'Defensive intensity meets conditioning volume — slide, sprint, and lock down your opponent.',
    drills: ['def-003', 'cond-001', 'def-007'],
    totalTime: 45,
  },
  {
    title: 'Strength & Power Block',
    description: 'Build the lower-body strength and core stability that separates average players from elite ones.',
    drills: ['str-001', 'str-002', 'str-005'],
    totalTime: 38,
  },
  {
    title: 'Ball Handling + Finishing',
    description: 'Chain your dribble moves into finishing at the rim — the full scoring package in one session.',
    drills: ['bh-007', 'fin-004', 'bh-010'],
    totalTime: 41,
  },
  {
    title: 'Game Simulation Day',
    description: 'Transition threes, fast-break finishes, and reactive defense — prepare for the real game.',
    drills: ['shoot-014', 'fin-006', 'def-009'],
    totalTime: 46,
  },
  {
    title: 'Conditioning Circuit',
    description: 'High-intensity interval conditioning — push your limits and build championship endurance.',
    drills: ['cond-004', 'cond-007', 'cond-010'],
    totalTime: 45,
  },
  {
    title: 'Post Moves Mastery',
    description: 'Dominate the paint with post fade-aways, drop steps, and low-post strength work.',
    drills: ['shoot-005', 'fin-011', 'str-003'],
    totalTime: 44,
  },
  {
    title: 'Ball Handling Mastery',
    description: 'Advanced handle training — behind-the-back combos, speed dribble, and in-and-out crossovers.',
    drills: ['bh-005', 'bh-008', 'bh-012'],
    totalTime: 42,
  },
  {
    title: 'Full Court Attack',
    description: 'Push the pace in every direction — full-court runs, dribble laps, and explosive sprint finishes.',
    drills: ['cond-002', 'bh-002', 'cond-006'],
    totalTime: 43,
  },
  {
    title: 'Elite Combination Challenge',
    description: 'The hardest weekly challenge — step-throughs, close-out defense, and peak conditioning all in one.',
    drills: ['shoot-015', 'def-012', 'cond-012'],
    totalTime: 50,
  },
];

/* ── Utility: ISO week number ─────────────────────────────── */
function trGetISOWeek() {
  var now = new Date();
  var jan4 = new Date(now.getFullYear(), 0, 4);
  var day1 = new Date(jan4);
  day1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
  var diff = now - day1;
  return Math.floor(diff / 604800000) + 1;
}

function trGetWeekChallenge(weekNum) {
  var idx = ((weekNum - 1) % WEEKLY_CHALLENGES.length + WEEKLY_CHALLENGES.length) % WEEKLY_CHALLENGES.length;
  return WEEKLY_CHALLENGES[idx];
}

/* ── Section 1: Weekly Overview ───────────────────────────── */
function trWeeklyOverviewInit() {
  // XP
  var xpData = (window.XPSystem && window.XPSystem.load) ? window.XPSystem.load() : { xp: 0 };
  var totalXP = xpData.xp || 0;
  // Weekly XP from history (entries from this ISO week)
  var weekXP = 0;
  var weekKey = String(trGetISOWeek()) + '-' + new Date().getFullYear();
  if (Array.isArray(xpData.history)) {
    var weekStart = _trWeekStart();
    xpData.history.forEach(function (entry) {
      if (entry && entry.ts && new Date(entry.ts) >= weekStart) {
        weekXP += (entry.amount || 0);
      }
    });
  }

  // Sessions completed this week
  var sessions = 0;
  try {
    var sessData = JSON.parse(localStorage.getItem('courtiq-sessions') || '[]');
    var wStart = _trWeekStart();
    sessData.forEach(function (s) {
      if (s && s.date && new Date(s.date) >= wStart) sessions++;
    });
  } catch (e) {}

  // Focus area
  var focusArea = 'General';
  try {
    var ob = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}');
    focusArea = ob.primaryGoal || ob.focus_area || 'General';
  } catch (e) {}

  // Streak
  var streak = 0;
  try { streak = parseInt(localStorage.getItem('courtiq-streak') || '0', 10) || 0; } catch (e) {}

  // Render goals card
  var xpEl = document.getElementById('tr-xp-val');
  var sessEl = document.getElementById('tr-sessions-val');
  var focusEl = document.getElementById('tr-focus-val');
  var streakEl = document.getElementById('tr-streak-val');
  var xpBar = document.getElementById('tr-xp-bar');
  var sessBar = document.getElementById('tr-sessions-bar');

  if (xpEl) xpEl.textContent = weekXP;
  if (sessEl) sessEl.textContent = sessions;
  if (focusEl) focusEl.textContent = focusArea;
  if (streakEl) streakEl.textContent = streak + ' day' + (streak !== 1 ? 's' : '');
  // XP bar: target 300 XP/week
  if (xpBar) xpBar.style.width = Math.min(100, Math.round(weekXP / 3)) + '%';
  // Sessions bar: target 5 sessions/week
  if (sessBar) sessBar.style.width = Math.min(100, Math.round(sessions / 5 * 100)) + '%';

  // Render challenge card
  trChallengeRender();
}

function _trWeekStart() {
  var now = new Date();
  var day = now.getDay(); // 0=Sun
  var diff = (day === 0) ? -6 : 1 - day;
  var start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

/* ── Section 1: Weekly Challenge ──────────────────────────── */
function trChallengeRender() {
  var weekNum = trGetISOWeek();
  var challenge = trGetWeekChallenge(weekNum);

  var badgeEl = document.getElementById('tr-challenge-week-badge');
  var titleEl = document.getElementById('tr-challenge-title');
  var descEl = document.getElementById('tr-challenge-desc');
  var stepsEl = document.getElementById('tr-challenge-steps');

  if (badgeEl) badgeEl.textContent = 'Week ' + weekNum;
  if (titleEl) titleEl.textContent = challenge.title;
  if (descEl) descEl.textContent = challenge.description;

  if (stepsEl && Array.isArray(challenge.drills) && typeof _DRILLS_DB !== 'undefined') {
    stepsEl.innerHTML = '';
    challenge.drills.forEach(function (drillId, idx) {
      var drill = _DRILLS_DB.find(function (d) { return d.id === drillId; });
      if (!drill) return;
      var li = document.createElement('li');
      li.className = 'tr-challenge-step';
      li.innerHTML =
        '<span class="tr-step-num">' + (idx + 1) + '</span>' +
        '<span class="tr-step-name">' + _escHtml(drill.name) + '</span>' +
        '<span class="tr-step-meta">' + _escHtml(drill.reps_or_sets) + ' · ' + drill.duration_minutes + 'min</span>';
      stepsEl.appendChild(li);
    });
  }

  var timeEl = document.getElementById('tr-challenge-time');
  if (timeEl) timeEl.textContent = challenge.totalTime + ' min total';
}

function trChallengeStart() {
  var weekNum = trGetISOWeek();
  var challenge = trGetWeekChallenge(weekNum);
  if (!challenge || !challenge.drills || !challenge.drills.length) return;
  if (typeof drillWorkoutOpen === 'function') {
    drillWorkoutOpen(challenge.drills[0]);
  }
}

/* ── Section 3: Exercise Library — Build Workout Mode ──────── */
var _trBuildSelection = new Set();
var _trBuildMode = false;

function trLibToggleBuildMode() {
  _trBuildMode = !_trBuildMode;
  if (!_trBuildMode) {
    _trBuildSelection.clear();
  }
  var grid = document.getElementById('drills-library-grid');
  var tray = document.getElementById('tr-build-tray');
  var btn = document.querySelector('.tr-build-workout-btn');
  if (grid) grid.classList.toggle('tr-build-active', _trBuildMode);
  if (tray) tray.style.display = _trBuildMode ? 'flex' : 'none';
  if (btn) btn.textContent = _trBuildMode ? 'Cancel' : 'Build Workout';
  _trUpdateBuildCount();

  if (_trBuildMode) {
    // Add click listeners to library cards
    var cards = document.querySelectorAll('#drills-library-grid .drill-lib-card');
    cards.forEach(function (card) {
      card.addEventListener('click', _trHandleLibCardClick);
    });
  } else {
    var cards2 = document.querySelectorAll('#drills-library-grid .drill-lib-card');
    cards2.forEach(function (card) {
      card.removeEventListener('click', _trHandleLibCardClick);
      card.classList.remove('tr-lib-card-selected');
    });
  }
}

function _trHandleLibCardClick(e) {
  if (!_trBuildMode) return;
  var card = e.currentTarget;
  var drillId = card.dataset.drillId || card.id;
  if (!drillId) return;
  trLibSelectDrill(drillId, card);
}

function trLibSelectDrill(drillId, cardEl) {
  if (_trBuildSelection.has(drillId)) {
    _trBuildSelection.delete(drillId);
    if (cardEl) cardEl.classList.remove('tr-lib-card-selected');
  } else {
    _trBuildSelection.add(drillId);
    if (cardEl) cardEl.classList.add('tr-lib-card-selected');
  }
  _trUpdateBuildCount();
}

function _trUpdateBuildCount() {
  var countEl = document.getElementById('tr-build-count');
  if (countEl) {
    var n = _trBuildSelection.size;
    countEl.textContent = n + ' drill' + (n !== 1 ? 's' : '') + ' selected';
  }
}

function trLibSaveWorkout() {
  if (_trBuildSelection.size === 0) return;
  var drillIds = Array.from(_trBuildSelection);
  var name = 'My Workout — ' + new Date().toLocaleDateString();
  var workout = { name: name, drillIds: drillIds, created: Date.now() };
  try {
    var existing = JSON.parse(localStorage.getItem('courtiq-custom-workouts') || '[]');
    existing.push(workout);
    localStorage.setItem('courtiq-custom-workouts', JSON.stringify(existing));
  } catch (e) {}
  _trBuildMode = false;
  _trBuildSelection.clear();
  var tray = document.getElementById('tr-build-tray');
  var grid = document.getElementById('drills-library-grid');
  var btn = document.querySelector('.tr-build-workout-btn');
  if (tray) tray.style.display = 'none';
  if (grid) grid.classList.remove('tr-build-active');
  if (btn) btn.textContent = 'Build Workout';
  if (typeof showToast === 'function') showToast('Workout saved to Training Plan!');
  trPlanInit();
}

/* ── Section 4: Training Plan ─────────────────────────────── */
var _TR_PLAN_KEY = 'courtiq-training-plan-v1';
var TR_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function trPlanInit() {
  trPlanRenderSchedule();
  _trRenderPlanDrills();
}

function _trLoadPlan() {
  try {
    return JSON.parse(localStorage.getItem(_TR_PLAN_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function _trSavePlan(plan) {
  try {
    localStorage.setItem(_TR_PLAN_KEY, JSON.stringify(plan));
  } catch (e) {}
}

function trPlanRenderSchedule() {
  var grid = document.getElementById('tr-schedule-grid');
  if (!grid) return;
  var plan = _trLoadPlan();
  var weekKey = _trCurrentWeekKey();
  var weekData = plan[weekKey] || {};

  grid.innerHTML = '';
  TR_DAYS.forEach(function (day) {
    var dayData = weekData[day] || { state: 'rest', drills: [] };
    var card = document.createElement('div');
    card.className = 'tr-day-card ' + (dayData.state || 'rest');
    card.dataset.day = day;
    var drillNames = (dayData.drills || []).map(function (id) {
      if (typeof _DRILLS_DB === 'undefined') return id;
      var d = _DRILLS_DB.find(function (x) { return x.id === id; });
      return d ? d.name : id;
    });
    var drillHTML = drillNames.length
      ? '<ul class="tr-day-drills">' + drillNames.map(function (n) {
          return '<li>' + _escHtml(n) + '</li>';
        }).join('') + '</ul>'
      : '<p class="tr-day-rest-label">Rest Day</p>';
    card.innerHTML =
      '<div class="tr-day-header">' +
        '<span class="tr-day-name">' + day + '</span>' +
        (dayData.state === 'completed'
          ? '<span class="tr-day-check">✓</span>'
          : (dayData.state === 'planned'
              ? '<button class="tr-day-done-btn" onclick="trPlanToggleDay(\'' + day + '\')" title="Mark done">✓</button>'
              : '')) +
      '</div>' +
      drillHTML;
    grid.appendChild(card);
  });
}

function trPlanToggleDay(day) {
  var plan = _trLoadPlan();
  var weekKey = _trCurrentWeekKey();
  if (!plan[weekKey]) plan[weekKey] = {};
  var dayData = plan[weekKey][day] || { state: 'rest', drills: [] };
  if (dayData.state === 'planned') {
    dayData.state = 'completed';
    if (window.XPSystem) window.XPSystem.grantXP(25, 'Training Day Complete');
  } else if (dayData.state === 'completed') {
    dayData.state = 'planned';
  } else {
    dayData.state = 'planned';
  }
  plan[weekKey][day] = dayData;
  _trSavePlan(plan);
  trPlanRenderSchedule();
}

function trPlanClearWeek() {
  var plan = _trLoadPlan();
  var weekKey = _trCurrentWeekKey();
  delete plan[weekKey];
  _trSavePlan(plan);
  trPlanRenderSchedule();
}

function _trCurrentWeekKey() {
  var now = new Date();
  return trGetISOWeek() + '-' + now.getFullYear();
}

function _trRenderPlanDrills() {
  var container = document.getElementById('tr-saved-drills-list');
  if (!container) return;
  // Custom workouts from build mode
  var workouts = [];
  try { workouts = JSON.parse(localStorage.getItem('courtiq-custom-workouts') || '[]'); } catch (e) {}
  if (!workouts.length) {
    container.innerHTML = '<p class="tr-empty-plan-msg">No saved workouts yet. Use the Exercise Library to build one!</p>';
    return;
  }
  container.innerHTML = workouts.slice().reverse().map(function (wkt, idx) {
    var drillNames = (wkt.drillIds || []).map(function (id) {
      if (typeof _DRILLS_DB === 'undefined') return id;
      var d = _DRILLS_DB.find(function (x) { return x.id === id; });
      return d ? d.name : id;
    });
    return '<div class="tr-saved-workout-card">' +
      '<div class="tr-saved-wkt-header">' +
        '<span class="tr-saved-wkt-name">' + _escHtml(wkt.name) + '</span>' +
        '<button class="tr-saved-wkt-del" onclick="trDeleteWorkout(' + (workouts.length - 1 - idx) + ')" title="Delete">✕</button>' +
      '</div>' +
      '<ul class="tr-saved-wkt-drills">' + drillNames.map(function (n) { return '<li>' + _escHtml(n) + '</li>'; }).join('') + '</ul>' +
      '<button class="tr-saved-wkt-start" onclick="trStartSavedWorkout(' + (workouts.length - 1 - idx) + ')">▶ Start Workout</button>' +
      '</div>';
  }).join('');
}

function trDeleteWorkout(idx) {
  try {
    var workouts = JSON.parse(localStorage.getItem('courtiq-custom-workouts') || '[]');
    workouts.splice(idx, 1);
    localStorage.setItem('courtiq-custom-workouts', JSON.stringify(workouts));
    _trRenderPlanDrills();
  } catch (e) {}
}

function trStartSavedWorkout(idx) {
  try {
    var workouts = JSON.parse(localStorage.getItem('courtiq-custom-workouts') || '[]');
    var wkt = workouts[idx];
    if (wkt && wkt.drillIds && wkt.drillIds.length && typeof drillWorkoutOpen === 'function') {
      drillWorkoutOpen(wkt.drillIds[0]);
    }
  } catch (e) {}
}

/* ── Section 4: AI Coach Chat ─────────────────────────────── */
var _trChatMessages = [];
var _trChatLoading = false;

var TR_CHAT_SYSTEM = 'You are an elite basketball training coach. The user wants a personalized training plan. ' +
  'When the user asks for a plan (e.g., "5-day shooting plan", "handles focus", "30 min/day"), ' +
  'respond with encouragement and then output a JSON plan block inside <plan> tags with this format:\n' +
  '<plan>{"Mon":{"drills":["drill_id_1","drill_id_2"],"state":"planned"},"Tue":{"drills":[],"state":"rest"},...}</plan>\n' +
  'Use only these drill IDs: shoot-001 through shoot-025, bh-001 through bh-022, def-001 through def-013, ' +
  'fin-001 through fin-014, cond-001 through cond-022, str-001 through str-014. ' +
  'Keep the plan realistic (2-5 drills per active day, 1-2 rest days per week). ' +
  'Outside the <plan> tag, write a brief motivating description of the plan in plain English.';

var TR_QUICK_CHIPS = [
  '5-day shooting plan',
  'Ball handling focus',
  '30 min/day plan',
  'Defense intensive',
  'Full body conditioning',
];

function trChatInit() {
  _trChatMessages = [];
  _trChatLoading = false;
  var feed = document.getElementById('tr-chat-feed');
  if (feed) feed.innerHTML = '';
  trChatAppendBubble('coach',
    "Hey! I'm your AI Coach. Tell me your goal and I'll build you a personalized weekly training plan. Try one of the quick options below or type your own request."
  );
}

function trChatSend(customMsg) {
  if (_trChatLoading) return;
  var input = document.getElementById('tr-chat-input');
  var msg = customMsg || (input ? input.value.trim() : '');
  if (!msg) return;
  if (input) input.value = '';
  trChatAppendBubble('user', msg);
  _trChatMessages.push({ role: 'user', content: msg });
  _trChatLoading = true;
  var typingId = 'tr-typing-' + Date.now();
  _trShowTyping(typingId);
  trChatCallAI(_trChatMessages).then(function (reply) {
    _trHideTyping(typingId);
    _trChatLoading = false;
    trChatAppendBubble('coach', reply);
    _trChatMessages.push({ role: 'assistant', content: reply });
    var planJSON = trChatParseScheduleFromReply(reply);
    if (planJSON) {
      trPlanInjectAISchedule(planJSON);
    }
  }).catch(function (err) {
    _trHideTyping(typingId);
    _trChatLoading = false;
    trChatAppendBubble('coach', "Sorry, I couldn't connect right now. Check your connection and try again.");
  });
}

async function trChatCallAI(messages) {
  var headers = { 'Content-Type': 'application/json' };
  if (typeof getAuthHeaders === 'function') {
    try { headers = await getAuthHeaders(); } catch (e) {}
  }
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, 30000);
  var res = await fetch('https://txnsuzlgfafjdipfqkqe.supabase.co/functions/v1/claude-proxy', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: TR_CHAT_SYSTEM,
      messages: messages,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  if (!res.ok) { var errBody = await res.text(); throw new Error(errBody); }
  var data = await res.json();
  if (data.error) throw new Error(data.error.message || 'AI error');
  return (data.content || []).map(function (b) { return b.text || ''; }).join('');
}

function trChatAppendBubble(role, text) {
  var feed = document.getElementById('tr-chat-feed');
  if (!feed) return;
  var bubble = document.createElement('div');
  bubble.className = 'tr-chat-bubble tr-chat-' + (role === 'coach' ? 'coach' : 'user');
  // Strip <plan>...</plan> from display text
  var displayText = text.replace(/<plan>[\s\S]*?<\/plan>/g, '').trim();
  bubble.textContent = displayText;
  feed.appendChild(bubble);
  feed.scrollTop = feed.scrollHeight;

  // If AI injected a plan, add a visual indicator
  if (role === 'coach' && /<plan>/.test(text)) {
    var pill = document.createElement('div');
    pill.className = 'tr-chat-plan-pill';
    pill.textContent = '✓ Weekly schedule updated below';
    feed.appendChild(pill);
    feed.scrollTop = feed.scrollHeight;
  }
}

function _trShowTyping(id) {
  var feed = document.getElementById('tr-chat-feed');
  if (!feed) return;
  var el = document.createElement('div');
  el.className = 'tr-chat-bubble tr-chat-coach tr-chat-typing';
  el.id = id;
  el.innerHTML = '<span></span><span></span><span></span>';
  feed.appendChild(el);
  feed.scrollTop = feed.scrollHeight;
}

function _trHideTyping(id) {
  var el = document.getElementById(id);
  if (el) el.remove();
}

function trChatParseScheduleFromReply(text) {
  var match = text.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch (e) {
    return null;
  }
}

function trPlanInjectAISchedule(json) {
  if (!json || typeof json !== 'object') return;
  var plan = _trLoadPlan();
  var weekKey = _trCurrentWeekKey();
  if (!plan[weekKey]) plan[weekKey] = {};
  TR_DAYS.forEach(function (day) {
    if (json[day]) {
      plan[weekKey][day] = {
        drills: json[day].drills || [],
        state: json[day].state || 'planned',
      };
    }
  });
  _trSavePlan(plan);
  trPlanRenderSchedule();
}

/* ── Master Init ──────────────────────────────────────────── */
function trPanelInit() {
  // Section 1
  trWeeklyOverviewInit();
  // Section 3 — reuse drill-engine library mode
  if (typeof drillsShowMode === 'function') drillsShowMode('library');
  if (typeof drillsFilterLibrary === 'function') drillsFilterLibrary();
  // Section 4
  trPlanInit();
  trChatInit();
  // Wire up quick chips
  var chipsEl = document.getElementById('tr-chat-chips');
  if (chipsEl) {
    chipsEl.innerHTML = '';
    TR_QUICK_CHIPS.forEach(function (chip) {
      var btn = document.createElement('button');
      btn.className = 'tr-chat-chip';
      btn.textContent = chip;
      btn.onclick = function () { trChatSend(chip); };
      chipsEl.appendChild(btn);
    });
  }
  // Wire up send button + enter key
  var sendBtn = document.getElementById('tr-chat-send-btn');
  var chatInput = document.getElementById('tr-chat-input');
  if (sendBtn) sendBtn.onclick = function () { trChatSend(); };
  if (chatInput) {
    chatInput.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); trChatSend(); }
    };
  }
}

/* ── Helper ───────────────────────────────────────────────── */
function _escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
