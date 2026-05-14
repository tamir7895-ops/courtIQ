/* CourtIQ UI v2 — Home tab renderer (Wave 1 redesign)
 *
 * Ports _design-import/v2/components/home-screen.jsx to vanilla JS.
 * Three sub-pages: Today (default), Log, Calendar.
 * Wires to DataService / Gamification / AICoach when those globals exist;
 * falls back to fixture data so the UI always paints.
 *
 * Activated by features/ui-v2/shell.js via window.CourtIQ_V2_Home.render(host).
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.HOME_TAB) return;
  var DOM = window.CourtIQ_V2_DOM;
  if (!DOM) { console.warn('[home-v2] dom-helpers missing'); return; }
  var h = DOM.h, svg = DOM.svg;

  var FIXTURE = {
    player: {
      name: 'Alex', position: 'Combo Guard',
      streak: 12, sessionsThisWeek: 3, weeklyGoal: 5,
      level: { name: 'ALL-STAR', current: 1240, next: 2000, num: 14 },
      streakDays: [true, true, false, true, true, true, true]
    },
    challenge: {
      eyebrow: 'DAILY CHALLENGE', title: 'Complete 3 Shooting Drills',
      reward: '+30 XP · Unlocks streak bonus', cta: 'START',
      progress: 1, total: 3, secondsLeft: 14 * 3600 + 23 * 60
    },
    coach: { verdict: "You're hiding from the three — fix it today.", signature: 'Coach Whitfield' },
    actionsPrimary: [
      { id: 'workout', label: 'Start Workout', sub: 'Today: Catch & Shoot · 12 min', tint: 'amber' },
      { id: 'track',   label: 'Track Shots',   sub: 'Launch AI camera',              tint: 'track' }
    ],
    actionsSecondary: [
      { id: 'coach',  label: 'AI Coach',      tint: 'coach' },
      { id: 'drills', label: 'Drill Library', tint: 'train' }
    ],
    recentSessions: [
      { id: 's1', day: 'MON', type: 'Shooting Practice', duration: '45m', fg: 58, dir: 'up' },
      { id: 's2', day: 'WED', type: 'Pickup Game',       duration: '1h 20m', fg: 47, dir: 'down' },
      { id: 's3', day: 'FRI', type: 'Drill Session',     duration: '30m', fg: 64, dir: 'up' }
    ],
    skills: [
      { id: 'shoot', name: 'Shooting',  val: 84, color: '#f5a623' },
      { id: 'drib',  name: 'Dribbling', val: 71, color: '#4ca3ff' },
      { id: 'def',   name: 'Defense',   val: 58, color: '#56d364' },
      { id: 'iq',    name: 'Game IQ',   val: 79, color: '#bc8cff' }
    ]
  };

  function realPlayerData() {
    var p = JSON.parse(JSON.stringify(FIXTURE.player));
    try {
      if (window.gamification && typeof window.gamification.getStats === 'function') {
        var s = window.gamification.getStats();
        if (s) {
          if (typeof s.streak === 'number') p.streak = s.streak;
          if (typeof s.level === 'number') p.level.num = s.level;
          if (typeof s.xp === 'number') p.level.current = s.xp;
        }
      }
    } catch (e) { /* fixture */ }
    try {
      if (window.dataService && typeof window.dataService.getProfile === 'function') {
        var prof = window.dataService.getProfile();
        if (prof && prof.name) p.name = prof.name;
        if (prof && prof.position) p.position = prof.position;
      }
    } catch (e) { /* fixture */ }
    return p;
  }

  function greetingForHour(hr) {
    if (hr < 5)  return { word: 'GOOD NIGHT',     tag: 'Late session?' };
    if (hr < 12) return { word: 'GOOD MORNING',   tag: 'Perfect conditions to work on that catch-and-shoot.' };
    if (hr < 17) return { word: 'GOOD AFTERNOON', tag: 'Heat of the day — get your shots up before sundown.' };
    if (hr < 21) return { word: 'GOOD EVENING',   tag: 'Prime time. Light a candle, ring the rim.' };
    return { word: 'GOOD NIGHT', tag: 'Form shooting. Quiet hands. Quiet gym.' };
  }

  function fmtCountdown(s) {
    var hr = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return hr + 'h ' + (m < 10 ? '0' + m : m) + 'm';
  }

  function iconStroke(d, sz) {
    return svg('svg', { viewBox: '0 0 24 24', width: sz || 18, height: sz || 18,
      fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      [svg('path', { d: d })]);
  }
  var I = {
    Settings: function () { return iconStroke('M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 12h2M19 12h2M12 3v2M12 19v2'); },
    Flame: function () { return iconStroke('M12 3c2 4 5 6 5 10a5 5 0 0 1-10 0c0-3 2-4 3-7 0 2 1 4 2 4z'); },
    Bolt: function () { return iconStroke('M13 2L3 14h7l-1 8 10-12h-7l1-8z'); },
    Clock: function () { return iconStroke('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2'); },
    Arrow: function () { return iconStroke('M5 12h14M13 5l7 7-7 7'); },
    Up: function () { return iconStroke('M12 19V5M5 12l7-7 7 7'); },
    Down: function () { return iconStroke('M12 5v14M5 12l7 7 7-7'); },
    Plus: function () { return iconStroke('M12 5v14M5 12h14'); },
    Minus: function () { return iconStroke('M5 12h14'); },
    Check: function () { return iconStroke('M5 12l5 5L20 7'); },
    Basketball: function () { return iconStroke('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M5 5l14 14M19 5L5 19'); },
    Play: function () { return iconStroke('M6 4l14 8-14 8z'); },
    Crosshair: function () { return iconStroke('M12 2v4M12 18v4M2 12h4M18 12h4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z'); },
    Message: function () { return iconStroke('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'); },
    Drills: function () { return iconStroke('M12 2v6M12 16v6M2 12h6M16 12h6'); },
    ChevL: function () { return iconStroke('M15 18l-6-6 6-6'); },
    ChevR: function () { return iconStroke('M9 18l6-6-6-6'); }
  };

  function buildStamp(onSettings) {
    var d = new Date();
    var days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    var meta = days[d.getDay()] + ' · ' + months[d.getMonth()] + ' ' + d.getDate() + ' · ' + d.getFullYear();
    return h('div', { class: 'ho-stamp' }, [
      h('div', { class: 'ho-stamp__l' }, [
        h('div', null, [
          h('div', { class: 'ho-stamp__eyebrow', text: 'HOME · TODAY' }),
          h('div', { class: 'ho-stamp__meta', text: meta })
        ])
      ]),
      h('button', { class: 'ho-stamp__icon-btn', 'aria-label': 'Settings', onclick: onSettings }, [I.Settings()])
    ]);
  }

  function buildSubNav(active, onChange) {
    var chips = [{ id: 'today', label: 'Today' }, { id: 'log', label: 'Log' }, { id: 'calendar', label: 'Calendar' }];
    var row = h('div', { class: 'ho-subnav' });
    chips.forEach(function (c) {
      row.appendChild(h('button', {
        class: 'ho-chip' + (active === c.id ? ' is-active' : ''), text: c.label,
        onclick: function () { onChange(c.id); }
      }));
    });
    return row;
  }

  function buildToday(p, ctx) {
    var greet = greetingForHour((new Date()).getHours());
    var xpPct = Math.min(100, (p.level.current / p.level.next) * 100);
    var goalCount = p.sessionsThisWeek;
    var goalPct = Math.min(100, (goalCount / p.weeklyGoal) * 100);
    var goalDone = goalCount >= p.weeklyGoal;

    var avatarNode;
    if (window.MeAvatar && typeof window.MeAvatar === 'function') {
      try { avatarNode = window.MeAvatar({ seed: 'alex-rivera-1', size: 168 }); } catch (e) { avatarNode = null; }
    }
    if (!avatarNode) {
      var img = document.createElement('img');
      img.src = 'https://api.dicebear.com/9.x/avataaars/svg?seed=' + encodeURIComponent(p.name || 'CourtIQ');
      img.width = 168; img.height = 168; img.alt = '';
      avatarNode = img;
    }
    var hero = h('section', { class: 'ho-glass ho-hero ho-anim d-0', style: { '--avatar-tint': '#2dd4bf' } }, [
      h('div', { class: 'ho-hero__bleed' }),
      h('div', { class: 'ho-hero__noise' }),
      h('div', { class: 'ho-hero__avatar-glow' }),
      h('div', { class: 'ho-hero__avatar' }, [avatarNode]),
      h('div', { class: 'ho-hero__l' }, [
        h('div', { class: 'ho-hero__bug' }, [
          h('span', { class: 'ho-hero__bug-dot' }),
          'PLAYER · ' + ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][(new Date()).getMonth()] + ' ' + (new Date()).getDate()
        ]),
        h('h1', { class: 'ho-hero__greet' }, [
          greet.word + ', ',
          h('em', { text: (p.name || 'Player').toUpperCase() + '.' })
        ]),
        h('div', { class: 'ho-hero__pills' }, [
          h('span', { class: 'ho-hero__pill ho-hero__pill--pos', text: p.position || 'Player' }),
          h('span', { class: 'ho-hero__pill ho-hero__pill--lvl', text: 'LV ' + p.level.num + ' · ' + p.level.name })
        ]),
        h('p', { class: 'ho-hero__sub', text: greet.tag })
      ])
    ]);

    var streakDots = h('div', { class: 'ho-streak__dots' });
    p.streakDays.forEach(function (on, i) {
      streakDots.appendChild(h('span', { class: 'ho-streak__dot' + (on ? ' is-on' : '') + (i === p.streakDays.length - 1 ? ' is-today' : '') }));
    });
    var streakCard = h('div', { class: 'ho-glass ho-streak' + (p.streak >= 7 ? ' is-hot' : '') }, [
      h('div', { class: 'ho-streak__top' }, [
        h('span', { class: 'ho-streak__flame' }, [I.Flame()]),
        h('span', { class: 'ho-streak__num', text: String(p.streak) })
      ]),
      h('div', { class: 'ho-streak__lbl', text: 'Day Streak' }),
      streakDots
    ]);
    var levelCard = h('div', { class: 'ho-glass ho-level ho-tap', onclick: function () { ctx.openTab('me'); } }, [
      h('div', null, [
        h('div', { class: 'ho-level__top' }, [
          h('div', { class: 'ho-level__name', text: p.level.name }),
          h('div', { class: 'ho-level__num', text: 'LV ' + p.level.num })
        ]),
        h('div', { class: 'ho-level__bar', style: { marginTop: '8px' } }, [
          h('div', { class: 'ho-level__bar-fill', style: { '--fill': xpPct + '%' } })
        ]),
        h('div', { class: 'ho-level__xp', style: { marginTop: '6px' },
          text: p.level.current.toLocaleString() + ' / ' + p.level.next.toLocaleString() + ' XP' })
      ]),
      h('div', { class: 'ho-level__week' }, [
        h('span', { class: 'ho-level__week-num', text: String(p.sessionsThisWeek) }),
        ' sessions this week'
      ])
    ]);

    var ch = FIXTURE.challenge;
    var segs = h('div', { class: 'ho-chal__seg' });
    for (var i = 0; i < ch.total; i++) {
      segs.appendChild(h('div', { class: 'ho-chal__seg-cell' + (i < ch.progress ? ' is-done' : '') }));
    }
    var challengeCard = h('section', { class: 'ho-glass ho-chal ho-anim d-2 ho-tap',
      onclick: function () { ctx.openChallenge(); } }, [
      h('div', { class: 'ho-chal__icon' }, [I.Bolt()]),
      h('div', { class: 'ho-chal__top' }, [
        h('div', { class: 'ho-chal__eyebrow', text: ch.eyebrow }),
        h('div', { class: 'ho-chal__countdown' }, [I.Clock(), ' ' + fmtCountdown(ch.secondsLeft) + ' REMAINING'])
      ]),
      h('div', { class: 'ho-chal__body' }, [
        h('div', { class: 'ho-chal__title', text: ch.title }),
        h('div', { class: 'ho-chal__reward', text: ch.reward })
      ]),
      h('div', { class: 'ho-chal__bottom' }, [
        h('div', { class: 'ho-chal__progress' }, [
          h('div', { class: 'ho-chal__progress-lbl' }, [
            h('span', { text: 'Progress' }),
            h('span', null, [h('em', { text: String(ch.progress) }), ' / ' + ch.total + ' drills'])
          ]),
          segs
        ]),
        h('button', { class: 'ho-chal__cta',
          onclick: function (e) { e.stopPropagation(); ctx.openChallenge(); } }, [ch.cta, I.Arrow()])
      ])
    ]);

    var coachCard = h('section', { class: 'ho-glass ho-coach ho-anim d-3 ho-tap',
      onclick: function () { ctx.openTab('coach'); } }, [
      h('div', { class: 'ho-coach__qmark', text: '"' }),
      h('div', { class: 'ho-coach__lbl', text: 'COACH · PINNED' }),
      h('div', { class: 'ho-coach__msg', text: FIXTURE.coach.verdict }),
      h('div', { class: 'ho-coach__foot' }, [
        h('div', { class: 'ho-coach__sig', text: FIXTURE.coach.signature }),
        h('div', { class: 'ho-coach__link' }, ['Read Briefing ', I.Arrow()])
      ])
    ]);

    var primaryRow = h('div', { class: 'ho-actions__row--lg' });
    FIXTURE.actionsPrimary.forEach(function (a) {
      var iconKey = { workout: 'Play', track: 'Crosshair' }[a.id] || 'Play';
      primaryRow.appendChild(h('div', {
        class: 'ho-glass ho-act-lg ho-tap ho-act-lg--' + a.tint,
        onclick: function () { ctx.openAction(a.id); }
      }, [
        h('div', { class: 'ho-act-lg__icon' }, [I[iconKey]()]),
        h('div', { class: 'ho-act-lg__label', text: a.label }),
        h('div', { class: 'ho-act-lg__sub', text: a.sub })
      ]));
    });
    var secondaryRow = h('div', { class: 'ho-actions__row--sm' });
    FIXTURE.actionsSecondary.forEach(function (a) {
      var iconKey = { coach: 'Message', drills: 'Basketball' }[a.id] || 'Drills';
      secondaryRow.appendChild(h('div', {
        class: 'ho-glass ho-act-sm ho-tap ho-act-sm--' + a.tint,
        onclick: function () { ctx.openAction(a.id); }
      }, [
        h('div', { class: 'ho-act-sm__icon' }, [I[iconKey]()]),
        h('div', { class: 'ho-act-sm__label', text: a.label })
      ]));
    });
    var actionsBlock = h('div', { class: 'ho-anim d-4' }, [
      h('div', { class: 'ho-sec-head' }, [h('div', { class: 'ho-sec-title', text: 'Quick Actions' })]),
      h('div', { class: 'ho-actions' }, [primaryRow, secondaryRow])
    ]);

    var sessionsCard = h('div', { class: 'ho-glass ho-sessions' });
    FIXTURE.recentSessions.forEach(function (s) {
      var fgIcon = s.dir === 'up' ? I.Up() : I.Down();
      sessionsCard.appendChild(h('div', {
        class: 'ho-sessions__row ho-tap',
        onclick: function () { ctx.openSession(s.id); }
      }, [
        h('div', { class: 'ho-sessions__day', text: s.day }),
        h('div', null, [
          h('div', { class: 'ho-sessions__type', text: s.type }),
          h('div', { class: 'ho-sessions__dur', style: { marginTop: '2px' }, text: s.duration })
        ]),
        h('div', { class: 'ho-sessions__fg ho-sessions__fg--' + s.dir }, [fgIcon, ' ' + s.fg + '%'])
      ]));
    });
    var sessionsBlock = h('div', { class: 'ho-anim d-5' }, [
      h('div', { class: 'ho-sec-head' }, [
        h('div', { class: 'ho-sec-title', text: 'This Week' }),
        h('div', { class: 'ho-sec-more', text: 'View All →' })
      ]),
      sessionsCard
    ]);

    var skillsRow = h('div', { class: 'ho-glass ho-skills' });
    FIXTURE.skills.forEach(function (s) {
      var r = 22, c = 2 * Math.PI * r;
      var off = c - (s.val / 100) * c;
      var ring = svg('svg', { width: '52', height: '52' }, [
        svg('circle', { cx: '26', cy: '26', r: String(r), class: 'ho-skill__ring-bg' }),
        svg('circle', { cx: '26', cy: '26', r: String(r), class: 'ho-skill__ring-fg',
          stroke: s.color, 'stroke-dasharray': String(c), 'stroke-dashoffset': String(off) })
      ]);
      skillsRow.appendChild(h('div', { class: 'ho-skill' }, [
        h('div', { class: 'ho-skill__ring' }, [ring, h('div', { class: 'ho-skill__pct', text: String(s.val) })]),
        h('div', { class: 'ho-skill__name', text: s.name })
      ]));
    });
    var skillsBlock = h('div', { class: 'ho-anim d-6' }, [
      h('div', { class: 'ho-sec-head' }, [
        h('div', { class: 'ho-sec-title', text: 'Skill Snapshot' }),
        h('div', { class: 'ho-sec-more', text: '→ ME' })
      ]),
      skillsRow
    ]);

    var goalFrac = h('div', { class: 'ho-goal__frac' }, [
      goalDone ? I.Check() : null,
      h('em', { text: String(goalCount) }),
      ' / ' + p.weeklyGoal + ' sessions'
    ]);
    var goalBlock = h('div', { class: 'ho-glass ho-goal ho-anim d-7' }, [
      h('div', { class: 'ho-goal__top' }, [
        h('div', { class: 'ho-goal__lbl', text: 'Weekly Goal' }),
        goalFrac
      ]),
      h('div', { class: 'ho-goal__bar' }, [
        h('div', { class: 'ho-goal__bar-fill', style: { '--fill': goalPct + '%' } })
      ])
    ]);

    var foot = h('div', { class: 'ho-foot', text: 'CourtIQ · Home · §6.10' });
    return [hero, h('section', { class: 'ho-row2 ho-anim d-1' }, [streakCard, levelCard]),
      challengeCard, coachCard, actionsBlock, sessionsBlock, skillsBlock, goalBlock, foot];
  }

  function buildLog(state, setState, onLog) {
    var types = ['Practice', 'Game', 'Pickup', 'Shooting'];
    var intensities = ['Light', 'Medium', 'Hard'];

    function pillRow(values, key) {
      var row = h('div', { class: 'ho-log__pills' });
      values.forEach(function (v) {
        row.appendChild(h('button', {
          class: 'ho-log__pill' + (state[key] === v ? ' is-active' : ''),
          text: v,
          onclick: function () { var next = {}; next[key] = v; setState(Object.assign({}, state, next)); }
        }));
      });
      return row;
    }

    var typeBlock = h('div', { class: 'ho-glass ho-log ho-anim d-0' }, [
      h('div', null, [h('div', { class: 'ho-log__lbl', text: 'Session Type' }), pillRow(types, 'type')])
    ]);
    var stepper = h('div', { class: 'ho-log__stepper' }, [
      h('button', { class: 'ho-log__step-btn', 'aria-label': 'Less',
        onclick: function () { setState(Object.assign({}, state, { duration: Math.max(5, state.duration - 5) })); } },
        [I.Minus()]),
      h('div', { class: 'ho-log__step-val' }, [String(state.duration), h('span', { text: 'Minutes' })]),
      h('button', { class: 'ho-log__step-btn', 'aria-label': 'More',
        onclick: function () { setState(Object.assign({}, state, { duration: state.duration + 5 })); } },
        [I.Plus()])
    ]);
    var durBlock = h('div', { class: 'ho-glass ho-log ho-anim d-1' }, [
      h('div', null, [h('div', { class: 'ho-log__lbl', text: 'Duration' }), stepper])
    ]);
    var intensityBlock = h('div', { class: 'ho-glass ho-log ho-anim d-2' }, [
      h('div', null, [h('div', { class: 'ho-log__lbl', text: 'Intensity' }), pillRow(intensities, 'intensity')])
    ]);

    var notes = document.createElement('textarea');
    notes.className = 'ho-log__textarea';
    notes.placeholder = 'What did you work on today?';
    notes.value = state.notes || '';
    notes.addEventListener('input', function () {
      setState(Object.assign({}, state, { notes: notes.value }));
    });
    var notesBlock = h('div', { class: 'ho-glass ho-log ho-anim d-3' }, [
      h('div', null, [h('div', { class: 'ho-log__lbl', text: 'Notes' }), notes])
    ]);

    var ctaBlock = h('div', { class: 'ho-anim d-4' }, [
      h('button', { class: 'ho-log__cta', onclick: onLog }, ['Log Session', I.Arrow()]),
      h('div', { class: 'ho-log__hint', text: 'Earns +20 XP' })
    ]);
    var foot = h('div', { class: 'ho-foot', text: 'CourtIQ · Home · Log · §6.10' });
    return [typeBlock, durBlock, intensityBlock, notesBlock, ctaBlock, foot];
  }

  function buildCalendar(selected, setSelected) {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var monthName = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][month];
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = now.getDate();
    var weekdays = ['S','M','T','W','T','F','S'];

    var grid = h('div', { class: 'ho-cal__grid' });
    for (var i = 0; i < firstDay; i++) grid.appendChild(h('div', { class: 'ho-cal__cell ho-cal__cell--empty' }));
    var sel = selected != null ? selected : today;
    for (var d = 1; d <= daysInMonth; d++) {
      (function (day) {
        var cls = 'ho-cal__cell';
        if (day === today) cls += ' ho-cal__cell--today';
        if (day === sel && day !== today) cls += ' ho-cal__cell--selected';
        grid.appendChild(h('div', { class: cls,
          onclick: function () { setSelected(day); } },
          [h('span', { text: String(day) })]));
      })(d);
    }

    var weekdayRow = h('div', { class: 'ho-cal__weekdays' });
    weekdays.forEach(function (w) { weekdayRow.appendChild(h('div', { class: 'ho-cal__wd', text: w })); });

    var head = h('div', { class: 'ho-glass ho-cal-head ho-anim d-0' }, [
      h('button', { class: 'ho-cal-head__nav', 'aria-label': 'Previous month' }, [I.ChevL()]),
      h('div', null, [
        h('div', { class: 'ho-cal-head__title', text: monthName }),
        h('div', { class: 'ho-cal-head__year', text: String(year) })
      ]),
      h('button', { class: 'ho-cal-head__nav', 'aria-label': 'Next month' }, [I.ChevR()])
    ]);
    var calCard = h('div', { class: 'ho-glass ho-cal ho-anim d-1' }, [weekdayRow, grid]);
    var schedBtn = h('div', { class: 'ho-anim d-2' }, [
      h('button', { class: 'ho-cal-sched' }, [I.Plus(), ' Schedule Session'])
    ]);
    var foot = h('div', { class: 'ho-foot', text: 'CourtIQ · Home · Calendar · §6.10' });
    return [head, calCard, schedBtn, foot];
  }

  var state = {
    tab: 'today',
    log: { type: 'Practice', duration: 60, intensity: 'Medium', notes: '' },
    calSelected: null
  };
  var hostRef = null;

  function paint() {
    if (!hostRef) return;
    var p = realPlayerData();
    var ctx = {
      openTab: function (id) { if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo(id); },
      openChallenge: function () { /* TODO: bottom sheet */ },
      openAction: function (id) {
        if (id === 'workout' || id === 'drills') { if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('train'); return; }
        if (id === 'track') { if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('track'); return; }
        if (id === 'coach') { if (window.CIQ_SHELL) window.CIQ_SHELL.switchTo('coach'); return; }
      },
      openSession: function () { /* TODO: track session detail */ }
    };

    DOM.clearChildren(hostRef);
    var screen = h('div', { class: 'ho' }, [
      buildStamp(function () { /* settings */ }),
      buildSubNav(state.tab, function (t) { state.tab = t; paint(); })
    ]);
    var scroll = h('div', { class: 'ho-scroll' });
    var pageNodes = state.tab === 'today'
      ? buildToday(p, ctx)
      : state.tab === 'log'
        ? buildLog(state.log,
            function (next) { state.log = next; paint(); },
            function () {
              try {
                if (window.dataService && typeof window.dataService.logSession === 'function') {
                  window.dataService.logSession(state.log);
                }
                if (window.gamification && typeof window.gamification.awardXP === 'function') {
                  window.gamification.awardXP(20, 'session-logged');
                }
              } catch (e) { console.warn('[home-v2] log error', e); }
              alert('Session logged · +20 XP');
              state.tab = 'today'; paint();
            })
        : buildCalendar(state.calSelected, function (d) { state.calSelected = d; paint(); });
    pageNodes.forEach(function (n) { if (n) scroll.appendChild(n); });
    screen.appendChild(scroll);
    hostRef.appendChild(screen);
  }

  function render(host) {
    DOM.hideLegacyPanels();
    hostRef = DOM.ensureHost('ciq-v2-home');
    paint();
  }

  function cleanup() {
    if (hostRef) DOM.clearChildren(hostRef);
    DOM.restoreLegacyPanels();
  }

  window.CourtIQ_V2_Home = { render: render, cleanup: cleanup };
})();
