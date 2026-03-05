  /* ══════════════════════════════════════════════════════════════
     FEATURE TABS — switch panels on click / auto-rotate
  ══════════════════════════════════════════════════════════════ */
  const panelLabels = {
    'pane-drills':    'Today\'s Drills — Marcus R. | Point Guard',
    'pane-progress':  'Monthly Progress — Marcus R. | Point Guard',
    'pane-ai':        'AI Coach Activity — Marcus R. | Point Guard',
    'pane-position':  'Position Programs — Select Your Role',
    'pane-library':   'Drill Library — 122 Drills Available',
    'pane-workouts':  'Pre-Built Workouts — Select &amp; Start',
  };

  const featureTabs  = document.querySelectorAll('.feature-item[data-pane]');
  const featurePanes = document.querySelectorAll('.feature-pane');
  const panelLabel   = document.getElementById('panel-label');

  let autoRotateTimer = null;
  let currentTabIdx   = 0;

  function activateTab(idx) {
    currentTabIdx = idx;
    featureTabs.forEach((tab, i) => {
      const isActive = i === idx;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive);
      // restart progress bar animation
      const fill = tab.querySelector('.feature-item-progress-fill');
      if (fill) {
        fill.style.animation = 'none';
        fill.offsetHeight; // reflow
        fill.style.animation = '';
      }
    });
    featurePanes.forEach(pane => pane.classList.remove('active'));
    const targetPane = featureTabs[idx].dataset.pane;
    const paneEl = document.getElementById(targetPane);
    if (paneEl) {
      paneEl.classList.add('active');
      // trigger sub-animations
      if (targetPane === 'pane-progress') initProgressBars('jan');
      if (targetPane === 'pane-position') initPosition('pg');
    }
    if (panelLabel) panelLabel.textContent = panelLabels[targetPane] || '';
  }

  function startAutoRotate() {
    clearInterval(autoRotateTimer);
    autoRotateTimer = setInterval(() => {
      activateTab((currentTabIdx + 1) % featureTabs.length);
    }, 5000);
  }

  featureTabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => { activateTab(idx); startAutoRotate(); });
    tab.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTab(idx); startAutoRotate(); }
    });
  });

  // Init first pane and start rotation when section comes into view
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      activateTab(0);
      startAutoRotate();
    }
  }, { threshold: 0.3 }).observe(document.getElementById('features'));

  /* ══════════════════════════════════════════════════════════════
     PANE 1: Drill expand/collapse
  ══════════════════════════════════════════════════════════════ */
  function toggleDrill(id) {
    const el = document.getElementById(id);
    const card = el.previousElementSibling;
    const isOpen = el.classList.contains('open');
    // close all
    document.querySelectorAll('.drill-detail.open').forEach(d => {
      d.classList.remove('open');
      d.previousElementSibling.classList.remove('drill-active');
    });
    if (!isOpen) {
      el.classList.add('open');
      card.classList.add('drill-active');
    }
  }

  /* ══════════════════════════════════════════════════════════════
     PANE 2: Progress Tracking — month switcher
  ══════════════════════════════════════════════════════════════ */
  const monthData = {
    nov: {
      bars: [
        { label:'3-Point Shooting', pct: 52, cls:'fill-amber' },
        { label:'Ball Handling',    pct: 74, cls:'fill-blue'  },
        { label:'Conditioning',     pct: 48, cls:'fill-green' },
        { label:'Vertical Jump',    pct: 38, cls:'fill-red'   },
        { label:'Agility',          pct: 61, cls:'fill-purple'},
      ],
      insight: '<strong>📈 Nov insight:</strong> Early days — all metrics baseline. Focus identified: conditioning and vertical jump are priority areas. Starter program assigned.'
    },
    dec: {
      bars: [
        { label:'3-Point Shooting', pct: 62, cls:'fill-amber' },
        { label:'Ball Handling',    pct: 81, cls:'fill-blue'  },
        { label:'Conditioning',     pct: 55, cls:'fill-green' },
        { label:'Vertical Jump',    pct: 44, cls:'fill-red'   },
        { label:'Agility',          pct: 70, cls:'fill-purple'},
      ],
      insight: '<strong>🚀 Dec insight:</strong> Ball handling jumped +7%. Shooting starting to click. The AI added 2 extra plyometric sessions to address vertical jump lag.'
    },
    jan: {
      bars: [
        { label:'3-Point Shooting', pct: 78, cls:'fill-amber' },
        { label:'Ball Handling',    pct: 92, cls:'fill-blue'  },
        { label:'Conditioning',     pct: 65, cls:'fill-green' },
        { label:'Vertical Jump',    pct: 54, cls:'fill-red'   },
        { label:'Agility',          pct: 83, cls:'fill-purple'},
      ],
      insight: '<strong>🔥 Jan insight:</strong> Your 3-point shooting saw the biggest jump — up 14% after adding the catch-and-shoot circuit. Conditioning still needs focus; 2 extra cardio sessions scheduled for Feb.'
    },
    feb: {
      bars: [
        { label:'3-Point Shooting', pct: 85, cls:'fill-amber' },
        { label:'Ball Handling',    pct: 95, cls:'fill-blue'  },
        { label:'Conditioning',     pct: 79, cls:'fill-green' },
        { label:'Vertical Jump',    pct: 68, cls:'fill-red'   },
        { label:'Agility',          pct: 90, cls:'fill-purple'},
      ],
      insight: '<strong>⭐ Feb insight:</strong> Across-the-board gains! Conditioning +14% after extra sessions. Vertical jump finally trending up. Next: push 3PT towards 90% with off-the-dribble drills.'
    },
  };

  function initProgressBars(month) {
    const data = monthData[month];
    const chart = document.getElementById('progress-chart');
    const insight = document.getElementById('progress-insight');
    if (!chart || !data) return;

    chart.innerHTML = data.bars.map(b => `
      <div class="chart-row">
        <div class="chart-label">
          <span>${b.label}</span>
          <span>${b.pct}%</span>
        </div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill ${b.cls}" style="width:0%"></div>
        </div>
      </div>`).join('');

    if (insight) insight.innerHTML = data.insight;

    // Animate bars after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chart.querySelectorAll('.chart-bar-fill').forEach((fill, i) => {
          fill.style.transitionDelay = `${i * 0.08}s`;
          fill.style.width = data.bars[i].pct + '%';
        });
      });
    });
  }

  function switchMonth(btn, month) {
    document.querySelectorAll('.month-tab').forEach(t => {
      t.classList.remove('tab-active');
      t.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('tab-active');
    btn.setAttribute('aria-pressed', 'true');
    initProgressBars(month);
  }

  /* ══════════════════════════════════════════════════════════════
     PANE 3: Adaptive AI — live chat
  ══════════════════════════════════════════════════════════════ */
  const aiResponses = [
    "Got it! I'm logging your performance. I'll add 2 extra free-throw sessions this week and reduce mid-range volume since your 3PT is peaking.",
    "Noted — 18 points is solid. Those 5 missed free throws suggest a mechanics issue. I'm adding a daily 50-FT routine starting tomorrow.",
    "Great session! Based on this, I'm unlocking the advanced ball-handling module. Expect tougher dribble combos in Friday's drill set.",
    "Tracking that. Your output suggests mild fatigue — I'm inserting a light recovery day on Thursday and pushing intensity to Saturday.",
    "Nice work! I'm recalibrating your conditioning blocks. You've hit the threshold to move from Level 2 to Level 3 explosive training.",
  ];
  let aiRespIdx = 0;

  function sendAIMessage() {
    const input = document.getElementById('ai-chat-input');
    const feed  = document.getElementById('ai-log-feed');
    const typing = document.getElementById('ai-typing');
    const msg = input.value.trim();
    if (!msg) return;

    // Add user message
    const userItem = document.createElement('div');
    userItem.className = 'ai-log-item';
    userItem.style.background = 'rgba(245,166,35,0.05)';
    userItem.style.borderColor = 'rgba(245,166,35,0.15)';
    userItem.innerHTML = `
      <div class="ai-log-dot" style="background:var(--c-amber);"></div>
      <div>
        <div class="ai-log-text"><strong>You</strong> — ${msg.replace(/</g,'&lt;')}</div>
        <div class="ai-log-time">Just now</div>
      </div>`;
    feed.appendChild(userItem);
    input.value = '';

    // Show typing indicator
    typing.classList.add('show');
    feed.scrollTop = feed.scrollHeight;

    // AI responds after delay
    setTimeout(() => {
      typing.classList.remove('show');
      const resp = aiResponses[aiRespIdx % aiResponses.length];
      aiRespIdx++;
      const aiItem = document.createElement('div');
      aiItem.className = 'ai-log-item';
      aiItem.innerHTML = `
        <div class="ai-log-dot" style="background:#a8e063;"></div>
        <div>
          <div class="ai-log-text"><strong>AI Coach</strong> — ${resp}</div>
          <div class="ai-log-time">Just now</div>
        </div>`;
      feed.appendChild(aiItem);
      feed.scrollTop = feed.scrollHeight;
    }, 1800);
  }

  // Submit on Enter key for AI chat
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (document.activeElement && document.activeElement.id === 'ai-chat-input') {
        sendAIMessage();
      }
    }
  });

  /* ══════════════════════════════════════════════════════════════
     PANE 4: Position-Specific drills
  ══════════════════════════════════════════════════════════════ */
  const posColors = { pg:'#00e5ff', sg:'#ff6b35', sf:'#a8e063', pf:'#c77dff', c:'#f72585' };
  const posData = {
    pg: {
      name:'Point Guard', drills:5, duration:'55 min', focus:'Vision & Handling',
      drills_list:[
        { name:'Two-Ball Dribble Combo', focus:'Ball Control' },
        { name:'Pick-and-Roll Read Drill', focus:'Decision Making' },
        { name:'Full-Court Layup Series', focus:'Finishing' },
        { name:'3-Point Catch & Shoot', focus:'Shooting' },
        { name:'Defensive Slide & Recover', focus:'Defense' },
      ]
    },
    sg: {
      name:'Shooting Guard', drills:6, duration:'60 min', focus:'Shooting & Movement',
      drills_list:[
        { name:'Curl & Shoot Off Screen', focus:'Off-Ball Movement' },
        { name:'Mid-Range Pull-Up', focus:'Shooting' },
        { name:'One-Dribble Pull-Up', focus:'Shot Creation' },
        { name:'Spot-Up 3-Point Circuit', focus:'Shooting' },
        { name:'Wing Closeout Defense', focus:'Defense' },
        { name:'Transition Layup Finishing', focus:'Finishing' },
      ]
    },
    sf: {
      name:'Small Forward', drills:6, duration:'65 min', focus:'Versatility & Slashing',
      drills_list:[
        { name:'Straight-Line Drive Finish', focus:'Slashing' },
        { name:'Face-Up Mid-Range Combo', focus:'Shooting' },
        { name:'Post Catch & Face-Up', focus:'Post Play' },
        { name:'Help-Side Rotation Defense', focus:'Defense' },
        { name:'Transition Wing Finish', focus:'Finishing' },
        { name:'Corner 3 Off Kick-Out', focus:'Shooting' },
      ]
    },
    pf: {
      name:'Power Forward', drills:5, duration:'70 min', focus:'Post & Rebounding',
      drills_list:[
        { name:'Drop-Step Power Move', focus:'Post Moves' },
        { name:'Mikan Drill (Both Hands)', focus:'Finishing' },
        { name:'Box-Out & Rebound Circuit', focus:'Rebounding' },
        { name:'Short-Roll Pick-and-Pop', focus:'Shooting' },
        { name:'Help Defense Shell Drill', focus:'Defense' },
      ]
    },
    c: {
      name:'Center', drills:5, duration:'75 min', focus:'Rim & Footwork',
      drills_list:[
        { name:'Drop-Step Spin Finish', focus:'Post Moves' },
        { name:'Rim-Run & Lob Catch', focus:'Finishing' },
        { name:'Vertical Screen & Roll', focus:'Screening' },
        { name:'Weak-Side Block Circuit', focus:'Rim Protection' },
        { name:'Two-Foot Jump & Touch', focus:'Explosiveness' },
      ]
    },
  };

  function initPosition(pos) {
    const data = posData[pos];
    const color = posColors[pos];
    const infoBar = document.getElementById('pos-info-bar');
    const drillLabel = document.getElementById('pos-drill-label');
    const drillList  = document.getElementById('pos-drills-list');
    if (!data || !infoBar) return;

    infoBar.innerHTML = `
      <div class="pos-info-chip">
        <div class="pos-info-chip-val" style="color:${color}">${data.drills}</div>
        <div class="pos-info-chip-label">Drills/Day</div>
      </div>
      <div class="pos-info-chip">
        <div class="pos-info-chip-val" style="color:${color}">${data.duration}</div>
        <div class="pos-info-chip-label">Avg Session</div>
      </div>
      <div class="pos-info-chip">
        <div class="pos-info-chip-val" style="color:${color};font-size:14px;padding-top:4px;">${data.focus}</div>
        <div class="pos-info-chip-label">Primary Focus</div>
      </div>`;

    drillLabel.textContent = `${data.name} — Core Drills`;

    drillList.innerHTML = data.drills_list.map((d, i) => `
      <div class="pos-drill-row" style="animation: pane-in 0.3s ease ${i*0.06}s both;">
        <div class="pos-drill-num">${String(i+1).padStart(2,'0')}</div>
        <div class="pos-drill-name">${d.name}</div>
        <div class="pos-drill-focus" style="color:${color}">${d.focus}</div>
      </div>`).join('');
  }

  function switchPos(btn, pos) {
    const color = posColors[pos];
    document.querySelectorAll('.pos-btn').forEach(b => {
      b.classList.remove('pos-active');
      b.style.background = 'transparent';
      b.style.color = '';
    });
    btn.classList.add('pos-active');
    btn.style.background = posColors[pos];
    btn.style.color = '#0c0d0f';
    initPosition(pos);
  }


  /* ══════════════════════════════════════════════════════════════
     PANE 6: Pre-Built Workouts — expand/collapse drill selection
  ══════════════════════════════════════════════════════════════ */
  function togglePaneWorkout(id) {
    const panel = document.getElementById(id);
    const arrow = document.getElementById(id + '-arrow');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    // close all others first
    ['pw1','pw2','pw3'].forEach(pid => {
      const p = document.getElementById(pid);
      const a = document.getElementById(pid + '-arrow');
      if (p) p.style.display = 'none';
      if (a) a.textContent = '▾';
    });
    if (!isOpen) {
      panel.style.display = 'block';
      if (arrow) arrow.textContent = '▴';
    }
  }
