  /* ══════════════════════════════════════════════════════════════
     FEATURE MODALS — each plan feature opens a live demo
  ══════════════════════════════════════════════════════════════ */

  const FEATURE_CONTENT = {

    /* ── Starter features ── */
    'ai-program': {
      icon: '🤖', iconBg: 'rgba(245,166,35,0.12)',
      title: 'AI Weekly Program', sub: 'Your personalized training schedule — auto-generated every week',
      render() {
        return `
          <div class="fw-section">
            <div class="fw-label">This Week's Program — Point Guard</div>
            ${[
              {day:'Monday',   focus:'Ball Handling + Shooting', drills:['Crossover Dribble Circuit','3-Point Catch & Shoot','Pull-Up Jumper'], intensity:'High'},
              {day:'Tuesday',  focus:'Conditioning + Defense',   drills:['Defensive Slide Drill','Sprint Intervals','Box Jump Series'],       intensity:'Medium'},
              {day:'Wednesday',focus:'Rest Day',                 drills:['Light Stretch','Film Review'],                                     intensity:'Low'},
              {day:'Thursday', focus:'Shooting + IQ',            drills:['Mid-Range Pull-Up','Pick & Roll Read','Spot-Up 3s'],               intensity:'High'},
              {day:'Friday',   focus:'Full Workout',             drills:['5-Spot Shooting','Full-Court Layups','1-on-1 Closeout'],           intensity:'Max'},
            ].map(d => `
              <div class="fw-card" style="margin-bottom:8px;display:flex;align-items:center;gap:14px;">
                <div style="font-family:var(--font-display);font-size:14px;font-weight:800;color:var(--c-amber);width:80px;flex-shrink:0;">${d.day}</div>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:600;color:var(--c-white);margin-bottom:2px;">${d.focus}</div>
                  <div style="font-size:11px;color:var(--c-muted);">${d.drills.join(' · ')}</div>
                </div>
                <span style="font-size:10px;font-weight:700;letter-spacing:0.08em;padding:3px 8px;border-radius:100px;background:${d.intensity==='High'?'rgba(245,166,35,0.12)':d.intensity==='Max'?'rgba(248,81,73,0.12)':d.intensity==='Low'?'rgba(86,211,100,0.1)':'rgba(255,255,255,0.06)'};color:${d.intensity==='High'?'#f5a623':d.intensity==='Max'?'#f85149':d.intensity==='Low'?'#56d364':'var(--c-muted)'};">${d.intensity}</span>
              </div>`).join('')}
          </div>
          <button class="fw-btn" onclick="openAuth('signup')">Start My Program →</button>`;
      }
    },

    'drill-library-50': {
      icon: '🎯', iconBg: 'rgba(86,211,100,0.1)',
      title: '50+ Position Drills', sub: 'Starter library — drills tailored to your position',
      render() { return FEATURE_CONTENT['drill-library-500'].render(3); }
    },

    'drill-library-500': {
      icon: '🎯', iconBg: 'rgba(245,166,35,0.1)',
      title: '500+ Drill Library', sub: 'Browse by position, skill, and intensity',
      render(limit = 6) {
        const drills = [
          {name:'3-Point Catch & Shoot', pos:'PG/SG', focus:'Shooting',   icon:'🏀', bg:'rgba(245,166,35,0.1)',  pct:72},
          {name:'Crossover Into Pull-Up', pos:'PG',   focus:'Ball Handle', icon:'⚡', bg:'rgba(76,163,255,0.1)',  pct:58},
          {name:'Box Jump Series',        pos:'ALL',  focus:'Athleticism', icon:'💪', bg:'rgba(86,211,100,0.1)', pct:85},
          {name:'Defensive Closeout',     pos:'SF/SG',focus:'Defense',     icon:'🛡️', bg:'rgba(188,140,255,0.1)',pct:64},
          {name:'Post Hook Shot',         pos:'C/PF', focus:'Post Game',   icon:'🎯', bg:'rgba(61,219,217,0.1)', pct:45},
          {name:'Pick & Roll Read',       pos:'PG',   focus:'IQ',          icon:'🧠', bg:'rgba(248,81,73,0.1)',  pct:91},
        ].slice(0, limit);
        return `
          <div class="fw-section">
            <div class="fw-label">${limit >= 6 ? 'Featured Drills' : 'Starter Drills'}</div>
            ${drills.map(d => `
              <div class="fw-drill">
                <div class="fw-drill-icon" style="background:${d.bg};">${d.icon}</div>
                <div style="flex:1;">
                  <div class="fw-drill-name">${d.name}</div>
                  <div class="fw-drill-meta">${d.pos} · ${d.focus}</div>
                </div>
                <div class="fw-drill-bar"><div class="fw-drill-fill" style="width:${d.pct}%;background:var(--c-amber);"></div></div>
              </div>`).join('')}
          </div>
          ${limit >= 6 ? '<div style="font-size:12px;color:var(--c-muted);text-align:center;margin-bottom:16px;">Showing 6 of 500+ drills available in Pro</div>' : ''}
          <button class="fw-btn" onclick="openAuth('signup','pro')">Unlock All Drills →</button>`;
      }
    },

    'basic-tracking': {
      icon: '📊', iconBg: 'rgba(76,163,255,0.1)',
      title: 'Basic Progress Tracking', sub: 'Track shooting %, sessions logged, and weekly streaks',
      render() {
        return `
          <div class="fw-section">
            <div class="fw-label">Your Weekly Stats</div>
            <div class="fw-card" style="margin-bottom:12px;">
              ${[
                {label:'Shooting Accuracy', val:'61%', fill:61, color:'#f5a623'},
                {label:'Sessions This Week', val:'4/5',  fill:80, color:'#56d364'},
                {label:'Drills Completed',   val:'18',  fill:72, color:'#4ca3ff'},
                {label:'Training Streak',    val:'14d', fill:56, color:'#bc8cff'},
              ].map(s => `
                <div class="fw-stat-row">
                  <div class="fw-stat-name">${s.label}</div>
                  <div class="fw-stat-bar"><div class="fw-stat-fill" style="width:${s.fill}%;background:${s.color};"></div></div>
                  <div class="fw-stat-val">${s.val}</div>
                </div>`).join('')}
            </div>
          </div>
          <div style="font-size:12px;color:var(--c-muted);margin-bottom:14px;">🔒 Upgrade to Pro for advanced analytics — per-drill breakdowns, trend graphs, and AI insights.</div>
          <button class="fw-btn" onclick="openAuth('signup')">Start Tracking →</button>`;
      }
    },

    '3-positions': {
      icon: '🏀', iconBg: 'rgba(245,166,35,0.1)',
      title: '3 Positions — Starter', sub: 'Drills optimized for PG, SG, and SF',
      render() {
        return `<div class="fw-pos-grid" style="grid-template-columns:repeat(3,1fr);">
          ${['PG','SG','SF'].map((p,i)=>`<div class="fw-pos-btn active" style="border-color:rgba(245,166,35,0.35);color:var(--c-amber);">${p}</div>`).join('')}
        </div>
        <div class="fw-card">
          <div style="font-size:13px;font-weight:600;color:var(--c-white);margin-bottom:10px;">Point Guard — Focus Areas</div>
          ${['Ball handling at speed','Pick & roll decision making','Drive & kick passing','Catch & shoot 3s','Transition offense'].map(f=>`<div style="font-size:13px;color:var(--c-muted);padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);">· ${f}</div>`).join('')}
        </div>
        <div style="font-size:12px;color:var(--c-muted);text-align:center;margin:14px 0 4px;">Pro & Elite unlock all 5 positions (PF and C included)</div>
        <button class="fw-btn" style="width:100%;margin-top:10px;" onclick="openAuth('signup')">Get Started →</button>`;
      }
    },

    'mobile-app': {
      icon: '📱', iconBg: 'rgba(61,219,217,0.1)',
      title: 'Mobile App', sub: 'Train anywhere — iOS & Android',
      render() {
        return `
          <div class="fw-card" style="margin-bottom:16px;text-align:center;padding:24px;">
            <div style="font-size:52px;margin-bottom:12px;">📱</div>
            <div style="font-family:var(--font-display);font-size:20px;font-weight:900;color:var(--c-white);margin-bottom:6px;">CourtIQ Mobile</div>
            <div style="font-size:13px;color:var(--c-muted);margin-bottom:18px;">Full workout access, offline mode, video playback, and real-time drill timer.</div>
            <div style="display:flex;gap:10px;justify-content:center;">
              <button class="fw-btn">🍎 App Store</button>
              <button class="fw-btn" style="background:rgba(255,255,255,0.1);color:var(--c-white);box-shadow:none;">▶ Google Play</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            ${[{i:'🔔',t:'Push Reminders'},{i:'📴',t:'Offline Mode'},{i:'⏱️',t:'Drill Timer'}].map(f=>`<div class="fw-card" style="text-align:center;padding:14px 8px;"><div style="font-size:24px;margin-bottom:6px;">${f.i}</div><div style="font-size:12px;color:var(--c-muted);">${f.t}</div></div>`).join('')}
          </div>`;
      }
    },

    /* ── Pro features ── */
    'everything-starter': {
      icon: '✦', iconBg: 'rgba(245,166,35,0.1)',
      title: 'Everything in Starter', sub: 'All Starter features — plus everything below',
      render() {
        return `<div class="fw-section">
          <div class="fw-label">Included from Starter plan</div>
          ${['AI-generated weekly program','50+ position-specific drills','Basic progress tracking','3 positions supported','Mobile app access'].map(f=>`
            <div class="fw-card" style="margin-bottom:8px;display:flex;align-items:center;gap:10px;">
              <span style="color:#56d364;font-weight:700;">✓</span>
              <span style="font-size:13px;color:var(--c-muted);">${f}</span>
            </div>`).join('')}
        </div>
        <button class="fw-btn" onclick="openAuth('signup','pro')">Get Pro (includes all of Starter) →</button>`;
      }
    },

    'adaptive-reprogramming': {
      icon: '🔄', iconBg: 'rgba(61,219,217,0.1)',
      title: 'Adaptive Reprogramming', sub: 'AI rebuilds your plan monthly based on your real results',
      render() {
        return `
          <div class="fw-section">
            <div class="fw-label">How It Works</div>
            <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px;">
              ${[
                {step:'01', title:'You Train & Log', desc:'Log daily sessions — shots, dribbling, jumps, sprints'},
                {step:'02', title:'AI Analyzes Patterns', desc:'Detects plateaus, breakthroughs, and weak areas automatically'},
                {step:'03', title:'Program Rebuilds', desc:'New month, new optimized program — always ahead of your curve'},
              ].map(s=>`
                <div style="display:flex;gap:14px;align-items:flex-start;">
                  <div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:rgba(245,166,35,0.3);width:30px;flex-shrink:0;">${s.step}</div>
                  <div>
                    <div style="font-size:14px;font-weight:600;color:var(--c-white);margin-bottom:2px;">${s.title}</div>
                    <div style="font-size:13px;color:var(--c-muted);">${s.desc}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
          <div class="fw-card" style="margin-bottom:16px;">
            <div style="font-size:12px;color:var(--c-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Example — Shooting plateau detected</div>
            <div style="font-size:13px;color:rgba(240,237,230,0.8);line-height:1.65;">"Marcus has plateaued at 62% shooting for 3 weeks. Recommending: increased mid-range volume, catch-and-shoot reps off screens, and defender pressure drills."</div>
          </div>
          <button class="fw-btn" onclick="openAuth('signup','pro')">Unlock Adaptive AI →</button>`;
      }
    },

    'video-drill-library': {
      icon: '🎬', iconBg: 'rgba(248,81,73,0.1)',
      title: 'Video Drill Library', sub: 'Watch, learn, and execute — HD video for every drill',
      render() {
        const vids = [
          {t:'Crossover Into Step-Back', d:'4:22'},
          {t:'3-Point Spot-Up Circuit', d:'6:15'},
          {t:'Defensive Slide Drill', d:'3:48'},
          {t:'Box Jump Conditioning', d:'5:30'},
        ];
        return `
          <div style="font-size:11px;color:var(--c-amber);background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.2);border-radius:8px;padding:8px 12px;margin-bottom:14px;text-align:center;font-weight:600;letter-spacing:0.05em;">INTERACTIVE PREVIEW — Full feature coming soon</div>
          <div class="fw-section">
            <div class="fw-label">Featured Videos</div>
            <div class="fw-video-grid">
              ${vids.map((v,i) => `
                <div class="fw-video-thumb" onclick="fwPlayVideo(this,'${v.t}')">
                  <div style="font-size:${['🏀','⚡','🛡️','💪'][i]?.length?32:28}px;margin-bottom:8px;">${['🏀','⚡','🛡️','💪'][i]}</div>
                  <div class="fw-video-play">▶</div>
                  <div class="fw-video-title">${v.t}</div>
                  <div class="fw-video-dur">${v.d}</div>
                  <div class="fw-video-playing" id="fwvp${i}">
                    <div style="font-size:24px;animation:fw-bounce 0.8s infinite;">⏸</div>
                    <div style="font-size:11px;color:var(--c-amber);font-weight:700;margin-top:6px;">Playing…</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
          <button class="fw-btn" style="margin-top:14px;" onclick="openAuth('signup','pro')">Access Full Library →</button>`;
      }
    },

    'ai-coaching-chat': {
      icon: '💬', iconBg: 'rgba(76,163,255,0.1)',
      title: 'AI Coaching Chat', sub: 'Ask anything about your training — instant expert answers',
      render() {
        return `
          <div class="fw-section">
            <div class="fw-label">Live Demo — try it</div>
            <div class="fw-chat" id="fw-chat-log">
              <div class="fw-msg ai">
                <div class="fw-msg-avatar">🤖</div>
                <div class="fw-msg-bubble">Hey Marcus! I've reviewed this week's sessions. Your shooting % is up 4% — great work on the catch-and-shoot reps. What would you like to focus on today?</div>
              </div>
            </div>
            <div class="fw-chat-input-row">
              <input class="fw-chat-input" id="fw-chat-input" placeholder="Ask your AI coach…" onkeydown="if(event.key==='Enter')fwSendChat()" />
              <button class="fw-chat-send" onclick="fwSendChat()">→</button>
            </div>
          </div>`;
      }
    },

    'unlimited-chat': {
      icon: '💬', iconBg: 'rgba(188,140,255,0.1)',
      title: 'Unlimited AI Chat', sub: 'No message limits — your coach is always available',
      render() { return FEATURE_CONTENT['ai-coaching-chat'].render(); }
    },

    'analytics-dashboard': {
      icon: '📈', iconBg: 'rgba(245,166,35,0.1)',
      title: 'Advanced Analytics', sub: 'Deep performance insights — see what the numbers reveal',
      render() {
        return `
          <div class="fw-section">
            <div class="fw-label">Weekly Performance Breakdown</div>
            <div class="fw-card" style="margin-bottom:14px;">
              ${[
                {label:'Shooting Accuracy',  val:'67%', fill:67, color:'#f5a623', delta:'+4%'},
                {label:'Dribbling Volume',   val:'22m',  fill:73, color:'#4ca3ff', delta:'+2m'},
                {label:'Vertical Jump',      val:'27"',  fill:68, color:'#bc8cff', delta:'+1"'},
                {label:'Sprint Time',        val:'4.3s', fill:82, color:'#56d364', delta:'-0.2s'},
                {label:'Consistency Score',  val:'84',   fill:84, color:'#3ddbd9', delta:'+6'},
              ].map(s => `
                <div class="fw-stat-row">
                  <div class="fw-stat-name">${s.label}</div>
                  <div class="fw-stat-bar"><div class="fw-stat-fill" style="width:${s.fill}%;background:${s.color};"></div></div>
                  <div class="fw-stat-val">${s.val}</div>
                  <div style="font-size:11px;font-weight:700;color:#56d364;width:36px;text-align:right;flex-shrink:0;">${s.delta}</div>
                </div>`).join('')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
              ${[
                {icon:'🔥',label:'Streak',val:'14 days'},
                {icon:'🎯',label:'Best Day',val:'Wed (73%)'},
                {icon:'📅',label:'Sessions',val:'5 / 5'},
              ].map(k=>`<div class="fw-card" style="text-align:center;"><div style="font-size:20px;margin-bottom:4px;">${k.icon}</div><div style="font-size:10px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.1em;">${k.label}</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--c-white);">${k.val}</div></div>`).join('')}
            </div>
          </div>
          <button class="fw-btn" style="width:100%;margin-top:4px;" onclick="openAuth('signup','pro')">Unlock Analytics →</button>`;
      }
    },

    'all-positions': {
      icon: '🏀', iconBg: 'rgba(245,166,35,0.1)',
      title: 'All 5 Positions', sub: 'Full program support for every role on the court',
      render() {
        const pos = {PG:'Point Guard',SG:'Shooting Guard',SF:'Small Forward',PF:'Power Forward',C:'Center'};
        const focus = {
          PG:['Ball-handling at speed','Pick & roll reads','Transition offense','Pull-up jumper','Court vision'],
          SG:['Catch & shoot 3s','Off-ball movement','Pull-up mid-range','Defensive one-on-one','Curl cuts'],
          SF:['Face-up game','Post entry passing','Wing 3s','Defensive rebounding','Drive & kick'],
          PF:['Low-post footwork','Midrange power','Screen setting','Defensive rotations','Putback finishes'],
          C:['Drop-step hook','Interior defense','Lob catches','Box-out technique','Outlet passing'],
        };
        let active = 'PG';
        return `
          <div class="fw-pos-grid" id="fw-pos-grid">
            ${Object.keys(pos).map(p=>`<div class="fw-pos-btn${p==='PG'?' active':''}" onclick="fwSelectPos('${p}')" id="fw-pos-${p}">${p}</div>`).join('')}
          </div>
          <div id="fw-pos-content">
            <div class="fw-card">
              <div style="font-family:var(--font-display);font-size:17px;font-weight:800;color:var(--c-amber);margin-bottom:10px;" id="fw-pos-title">Point Guard — Focus Areas</div>
              <div id="fw-pos-list">${focus['PG'].map(f=>`<div style="font-size:13px;color:var(--c-muted);padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">· ${f}</div>`).join('')}</div>
            </div>
          </div>
          <button class="fw-btn" style="width:100%;margin-top:14px;" onclick="openAuth('signup','pro')">Start My Position Program →</button>
          <script>
            window._fwPosData=${JSON.stringify({pos,focus})};
            function fwSelectPos(p){
              document.querySelectorAll('.fw-pos-btn').forEach(b=>b.classList.remove('active'));
              document.getElementById('fw-pos-'+p).classList.add('active');
              document.getElementById('fw-pos-title').textContent=window._fwPosData.pos[p]+' — Focus Areas';
              document.getElementById('fw-pos-list').innerHTML=window._fwPosData.focus[p].map(f=>'<div style="font-size:13px;color:var(--c-muted);padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">· '+f+'</div>').join('');
            }
          <\/script>`;
      }
    },

    'everything-pro': {
      icon: '✦', iconBg: 'rgba(188,140,255,0.1)',
      title: 'Everything in Pro', sub: 'Elite includes all Pro features — plus exclusive Elite perks',
      render() {
        return `<div class="fw-section">
          <div class="fw-label">Included from Pro plan</div>
          ${['500+ drills across all positions','Adaptive monthly reprogramming','Full video drill library','AI coaching chat (50 msgs → unlimited)','Advanced analytics dashboard','All 5 positions supported'].map(f=>`
            <div class="fw-card" style="margin-bottom:8px;display:flex;align-items:center;gap:10px;">
              <span style="color:#f5a623;font-weight:700;">✓</span>
              <span style="font-size:13px;color:var(--c-muted);">${f}</span>
            </div>`).join('')}
        </div>
        <button class="fw-btn" style="background:linear-gradient(135deg,#c77dff,#9d4edd);box-shadow:0 4px 20px rgba(199,125,255,0.3);" onclick="openAuth('signup','elite')">Go Elite →</button>`;
      }
    },

    'coach-review': {
      icon: '📹', iconBg: 'rgba(76,163,255,0.1)',
      title: 'Coach Review Sessions', sub: '2 live video sessions per month with a real coach',
      render() {
        const slots = ['Mon Mar 3 · 10:00 AM','Tue Mar 4 · 2:00 PM','Wed Mar 5 · 11:30 AM','Thu Mar 6 · 4:00 PM','Fri Mar 7 · 9:00 AM','Mon Mar 10 · 3:00 PM'];
        return `
          <div class="fw-section">
            <div class="fw-label">Your Coaches</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
              ${[
                {name:'Coach D. Williams', spec:'Shooting & Ball Handling', rating:'4.9', sessions:'340+'},
                {name:'Coach T. Rivera',   spec:'Defense & Conditioning',    rating:'4.8', sessions:'280+'},
              ].map(c=>`
                <div class="fw-card">
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                    <div style="width:38px;height:38px;border-radius:50%;background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.25);display:flex;align-items:center;justify-content:center;font-size:16px;">👤</div>
                    <div>
                      <div style="font-size:13px;font-weight:700;color:var(--c-white);">${c.name}</div>
                      <div style="font-size:11px;color:var(--c-muted);">${c.spec}</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:10px;">
                    <span style="font-size:11px;color:var(--c-amber);">⭐ ${c.rating}</span>
                    <span style="font-size:11px;color:var(--c-muted);">${c.sessions} sessions</span>
                  </div>
                </div>`).join('')}
            </div>
          </div>
          <div class="fw-section">
            <div class="fw-label">Book a Session</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
              ${slots.map(s=>`<div class="fw-card" onclick="fwSelectSlot(this)" style="font-size:12px;color:var(--c-muted);cursor:pointer;transition:var(--transition);text-align:center;">${s}</div>`).join('')}
            </div>
          </div>
          <button class="fw-btn" onclick="openAuth('signup','elite')" style="background:linear-gradient(135deg,#c77dff,#9d4edd);box-shadow:0 4px 20px rgba(199,125,255,0.3);">Book My Session →</button>`;
      }
    },

    'game-film': {
      icon: '🎥', iconBg: 'rgba(248,81,73,0.1)',
      title: 'Game Film Analysis', sub: 'Upload your game footage — AI breaks down your every move',
      render() {
        return `
          <div style="font-size:11px;color:var(--c-amber);background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.2);border-radius:8px;padding:8px 12px;margin-bottom:14px;text-align:center;font-weight:600;letter-spacing:0.05em;">INTERACTIVE PREVIEW — Full feature coming soon</div>
          <div class="fw-section">
            <div class="fw-label">Upload Game Film</div>
            <div class="fw-upload-zone" onclick="fwSimulateUpload(this)">
              <div class="fw-upload-icon" id="fw-upload-icon">📤</div>
              <div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--c-white);margin-bottom:6px;" id="fw-upload-title">Drop your game film here</div>
              <div style="font-size:13px;color:var(--c-muted);" id="fw-upload-sub">MP4, MOV · up to 2GB · 4 uploads/month</div>
            </div>
          </div>
          <div class="fw-section" id="fw-analysis-preview" style="display:none;">
            <div class="fw-label">AI Analysis Preview</div>
            <div class="fw-card">
              <div style="font-size:12px;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:10px;">Detected Patterns — vs. Eastside High</div>
              ${[
                {icon:'🎯',insight:'Shot selection: 68% of attempts came from high-efficiency zones'},
                {icon:'⚡',insight:'Ball speed on drives was 12% faster than your season average'},
                {icon:'🛡️',insight:'Off-ball movement needs work — you stood still 34% of the time'},
                {icon:'💡',insight:'Recommend: more weak-side cuts and relocating after screens'},
              ].map(i=>`<div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;"><span style="font-size:16px;">${i.icon}</span><span style="font-size:13px;color:rgba(240,237,230,0.75);line-height:1.5;">${i.insight}</span></div>`).join('')}
            </div>
          </div>
          <button class="fw-btn" style="background:linear-gradient(135deg,#c77dff,#9d4edd);box-shadow:0 4px 20px rgba(199,125,255,0.3);margin-top:6px;" onclick="openAuth('signup','elite')">Unlock Film Analysis →</button>`;
      }
    },

    'season-plans': {
      icon: '📅', iconBg: 'rgba(245,166,35,0.1)',
      title: 'Season-Specific Plans', sub: 'Separate in-season and off-season training programs',
      render() {
        return `
          <div class="fw-season-toggle" id="fw-season-toggle">
            <button class="fw-season-btn active" onclick="fwSwitchSeason('in',this)">In-Season</button>
            <button class="fw-season-btn" onclick="fwSwitchSeason('off',this)">Off-Season</button>
          </div>
          <div id="fw-season-content">
            <div class="fw-card" style="margin-bottom:12px;">
              <div style="font-size:13px;font-weight:700;color:var(--c-white);margin-bottom:8px;">🏀 In-Season Focus</div>
              <div style="font-size:13px;color:var(--c-muted);line-height:1.7;">Maintain peak performance without overtraining. Lower volume, higher intensity — keeping you sharp for game nights.</div>
            </div>
            ${[
              {label:'Training Days / Week', val:'3–4', note:'Preserves energy for games'},
              {label:'Session Length',       val:'45 min', note:'Efficient, targeted work'},
              {label:'Recovery Priority',    val:'High',   note:'Sleep & mobility focus'},
              {label:'Skill Focus',          val:'Game-specific', note:'Simulate real scenarios'},
            ].map(r=>`<div class="fw-card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
              <div><div style="font-size:13px;color:var(--c-white);font-weight:500;">${r.label}</div><div style="font-size:11px;color:var(--c-muted);">${r.note}</div></div>
              <div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--c-amber);">${r.val}</div>
            </div>`).join('')}
          </div>
          <button class="fw-btn" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#c77dff,#9d4edd);box-shadow:0 4px 20px rgba(199,125,255,0.3);" onclick="openAuth('signup','elite')">Get My Season Plan →</button>`;
      }
    },

    'nutrition': {
      icon: '🥗', iconBg: 'rgba(86,211,100,0.1)',
      title: 'Nutrition & Recovery', sub: 'Fuel your game — personalized meal plans and recovery protocols',
      render() {
        return `
          <div style="font-size:11px;color:var(--c-amber);background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.2);border-radius:8px;padding:8px 12px;margin-bottom:14px;text-align:center;font-weight:600;letter-spacing:0.05em;">INTERACTIVE PREVIEW — Full feature coming soon</div>
          <div class="fw-section">
            <div class="fw-label">Today's Macros — Training Day</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
              ${[
                {label:'Calories', val:'3,200', color:'#f5a623', fill:80},
                {label:'Protein',  val:'185g',  color:'#56d364', fill:75},
                {label:'Carbs',    val:'380g',  color:'#4ca3ff', fill:85},
                {label:'Fats',     val:'82g',   color:'#bc8cff', fill:60},
              ].map(m=>`
                <div class="fw-macro">
                  <div class="fw-macro-ring" style="background:rgba(${m.color==='#f5a623'?'245,166,35':m.color==='#56d364'?'86,211,100':m.color==='#4ca3ff'?'76,163,255':'188,140,255'},0.1);border:2px solid ${m.color};color:${m.color};">${m.fill}%</div>
                  <div style="font-family:var(--font-display);font-size:16px;font-weight:900;color:var(--c-white);">${m.val}</div>
                  <div class="fw-macro-label">${m.label}</div>
                </div>`).join('')}
            </div>
          </div>
          <div class="fw-section">
            <div class="fw-label">Recovery Protocol — Post Game</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${[
                {icon:'💧',item:'Hydration',       detail:'1L water + electrolytes within 30 min'},
                {icon:'🍗',item:'Protein Window',   detail:'35-40g protein within 45 min'},
                {icon:'😴',item:'Sleep Target',     detail:'8.5h minimum — growth hormone peak'},
                {icon:'🧊',item:'Ice Bath',         detail:'10 min at 52°F — reduces inflammation'},
              ].map(r=>`<div class="fw-card" style="display:flex;gap:12px;align-items:center;"><div style="font-size:20px;">${r.icon}</div><div><div style="font-size:13px;font-weight:600;color:var(--c-white);">${r.item}</div><div style="font-size:12px;color:var(--c-muted);">${r.detail}</div></div></div>`).join('')}
            </div>
          </div>
          <button class="fw-btn" style="width:100%;background:linear-gradient(135deg,#c77dff,#9d4edd);box-shadow:0 4px 20px rgba(199,125,255,0.3);" onclick="openAuth('signup','elite')">Get My Nutrition Plan →</button>`;
      }
    },

    'priority-support': {
      icon: '⚡', iconBg: 'rgba(245,166,35,0.1)',
      title: 'Priority Support', sub: 'Real humans, real fast — under 2 hours guaranteed',
      render() {
        return `
          <div class="fw-section">
            <div class="fw-label">Recent Support Tickets</div>
            ${[
              {status:'#56d364', title:'Can I swap Wednesday\'s drills?',    meta:'Opened 18 min ago · Response in 14 min',   res:'Resolved'},
              {status:'#56d364', title:'Program not updating after logging', meta:'Opened 2h ago · Response in 47 min',       res:'Resolved'},
              {status:'#f5a623', title:'Vertical measurement questions',     meta:'Opened 5 min ago',                         res:'In Progress'},
            ].map(t=>`
              <div class="fw-ticket">
                <div class="fw-ticket-dot" style="background:${t.status};"></div>
                <div style="flex:1;">
                  <div class="fw-ticket-title">${t.title}</div>
                  <div class="fw-ticket-meta">${t.meta}</div>
                </div>
                <span style="font-size:11px;font-weight:700;color:${t.status};flex-shrink:0;">${t.res}</span>
              </div>`).join('')}
          </div>
          <div class="fw-card" style="text-align:center;margin-bottom:16px;">
            <div style="font-size:28px;margin-bottom:8px;">⚡</div>
            <div style="font-family:var(--font-display);font-size:28px;font-weight:900;color:var(--c-amber);">&lt; 2 hours</div>
            <div style="font-size:13px;color:var(--c-muted);">Average response time for Elite members</div>
          </div>
          <button class="fw-btn" style="width:100%;background:linear-gradient(135deg,#c77dff,#9d4edd);box-shadow:0 4px 20px rgba(199,125,255,0.3);" onclick="openAuth('signup','elite')">Get Elite Support →</button>`;
      }
    },

    'early-access': {
      icon: '🚀', iconBg: 'rgba(188,140,255,0.1)',
      title: 'Early Access', sub: 'Be first — test new AI features months before public release',
      render() {
        return `
          <div class="fw-section">
            <div class="fw-label">Coming Soon — Elite Preview</div>
            <div class="fw-badge-row">
              <span class="fw-new-badge">Beta</span>
              <span class="fw-new-badge">Preview</span>
              <span class="fw-new-badge">Q2 2026</span>
            </div>
            ${[
              {icon:'📸', name:'Pose Analysis AI', desc:'Upload a photo mid-drill — AI scores your form instantly', eta:'Beta · March 2026'},
              {icon:'🤝', name:'Multiplayer Challenges', desc:'Challenge friends to weekly shooting contests', eta:'Preview · April 2026'},
              {icon:'🧬', name:'DNA-Based Training', desc:'Personalize recovery based on genetic athletic markers', eta:'Research · Q3 2026'},
              {icon:'🎮', name:'VR Drill Simulator', desc:'Practice in virtual game scenarios with AI defenders', eta:'Concept · Q4 2026'},
            ].map(f=>`
              <div class="fw-card" style="margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;">
                <div style="font-size:22px;">${f.icon}</div>
                <div style="flex:1;">
                  <div style="font-size:14px;font-weight:700;color:var(--c-white);margin-bottom:2px;">${f.name}</div>
                  <div style="font-size:12px;color:var(--c-muted);margin-bottom:6px;">${f.desc}</div>
                  <span class="fw-new-badge">${f.eta}</span>
                </div>
              </div>`).join('')}
          </div>
          <button class="fw-btn" style="width:100%;background:linear-gradient(135deg,#c77dff,#9d4edd);box-shadow:0 4px 20px rgba(199,125,255,0.3);" onclick="openAuth('signup','elite')">Join Elite Waitlist →</button>`;
      }
    },
  };

  /* ── Feature modal open/close ── */
  function openFeature(id) {
    const f = FEATURE_CONTENT[id]; if (!f) return;
    document.getElementById('fm-icon').textContent  = f.icon;
    document.getElementById('fm-icon').style.background = f.iconBg;
    document.getElementById('fm-title').textContent = f.title;
    document.getElementById('fm-sub').textContent   = f.sub;
    document.getElementById('fm-body').innerHTML    = f.render();
    document.getElementById('featOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    // animate stat fills after render
    setTimeout(() => {
      document.querySelectorAll('.fw-stat-fill').forEach(el => {
        const w = el.style.width; el.style.width = '0';
        setTimeout(() => el.style.width = w, 30);
      });
    }, 60);
  }

  function closeFeature() {
    document.getElementById('featOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function handleFeatOverlay(e) {
    if (e.target === document.getElementById('featOverlay')) closeFeature();
  }

  /* ── Feature widget interaction helpers ── */

  /* Video play toggle */
  function fwPlayVideo(thumb, title) {
    const playEl = thumb.querySelector('.fw-video-playing');
    if (!playEl) return;
    const isPlaying = playEl.style.display === 'flex';
    // stop all
    document.querySelectorAll('.fw-video-playing').forEach(el => el.style.display = 'none');
    if (!isPlaying) playEl.style.display = 'flex';
  }

  /* Calendar slot select */
  function fwSelectSlot(el) {
    document.querySelectorAll('#fm-body .fw-card').forEach(c => {
      c.style.borderColor = ''; c.style.color = '';
    });
    el.style.borderColor = 'rgba(245,166,35,0.4)';
    el.style.color = 'var(--c-amber)';
    el.style.background = 'rgba(245,166,35,0.08)';
  }

  /* Film upload simulation */
  function fwSimulateUpload(zone) {
    const icon  = document.getElementById('fw-upload-icon');
    const title = document.getElementById('fw-upload-title');
    const sub   = document.getElementById('fw-upload-sub');
    icon.textContent  = '⏳';
    title.textContent = 'Uploading game_vs_eastside.mp4…';
    sub.textContent   = '47% · 2.3 MB/s';
    setTimeout(() => {
      icon.textContent  = '⚙️';
      title.textContent = 'AI analyzing your film…';
      sub.textContent   = 'Detecting shot selection, movement, and tendencies';
      setTimeout(() => {
        icon.textContent  = '✅';
        title.textContent = 'Analysis complete!';
        sub.textContent   = 'See insights below ↓';
        const preview = document.getElementById('fw-analysis-preview');
        if (preview) preview.style.display = 'block';
      }, 2000);
    }, 1800);
  }

  /* Season toggle */
  function fwSwitchSeason(mode, btn) {
    document.querySelectorAll('.fw-season-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('fw-season-content');
    if (!content) return;
    const inSeason = [
      {label:'Training Days / Week', val:'3–4',      note:'Preserves energy for games'},
      {label:'Session Length',       val:'45 min',   note:'Efficient, targeted work'},
      {label:'Recovery Priority',    val:'High',     note:'Sleep & mobility focus'},
      {label:'Skill Focus',          val:'Game-specific', note:'Simulate real scenarios'},
    ];
    const offSeason = [
      {label:'Training Days / Week', val:'5–6',      note:'Maximum development window'},
      {label:'Session Length',       val:'90 min',   note:'Deep skill building'},
      {label:'Recovery Priority',    val:'Moderate', note:'Push harder, recover smart'},
      {label:'Skill Focus',          val:'Weaknesses', note:'Build your full arsenal'},
    ];
    const data = mode === 'in' ? inSeason : offSeason;
    const emoji = mode === 'in' ? '🏀' : '💪';
    const label = mode === 'in' ? 'In-Season' : 'Off-Season';
    content.innerHTML = `<div class="fw-card" style="margin-bottom:12px;">
      <div style="font-size:13px;font-weight:700;color:var(--c-white);margin-bottom:8px;">${emoji} ${label} Focus</div>
      <div style="font-size:13px;color:var(--c-muted);line-height:1.7;">${mode === 'in' ? 'Maintain peak performance without overtraining. Lower volume, higher intensity — keeping you sharp for game nights.' : 'Build the athlete you\'ve always wanted to be. This is your window to fix weaknesses, add new skills, and level up every metric.'}</div>
    </div>
    ${data.map(r=>`<div class="fw-card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;"><div><div style="font-size:13px;color:var(--c-white);font-weight:500;">${r.label}</div><div style="font-size:11px;color:var(--c-muted);">${r.note}</div></div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--c-amber);">${r.val}</div></div>`).join('')}`;
  }

  /* AI Chat in feature modal */
  const FW_CHAT_RESPONSES = {
    default: "Great question! Based on your recent sessions, I'd recommend focusing on catch-and-shoot reps from the corners. Your shooting % from there is 8% below your average.",
    shoot: "Your shooting is trending up — 61% this week vs 57% last week. Keep running the 3-point spot-up circuit and you'll break 65% within two weeks.",
    dribble: "For ball handling, try the tennis ball crossover drill: dribble your basketball while tossing a tennis ball with your off hand. 3 sets of 30 seconds each.",
    jump: "Vertical gains come from consistent plyometrics. Box jumps, depth jumps, and single-leg Bulgarian squats 3× per week. You're at 27\" — 30\" is absolutely achievable.",
    defense: "Elite defenders always guard the ball first. Work on your lateral quickness with the defensive slide cone drill — 4 sets × 20 seconds at maximum effort.",
  };

  function fwSendChat() {
    const input = document.getElementById('fw-chat-input');
    if (!input || !input.value.trim()) return;
    const msg = input.value.trim();
    input.value = '';
    const log = document.getElementById('fw-chat-log');
    if (!log) return;

    // user message
    log.innerHTML += `<div class="fw-msg user"><div class="fw-msg-avatar">👤</div><div class="fw-msg-bubble">${msg}</div></div>`;

    // typing indicator
    const typingId = 'fw-typing-' + Date.now();
    log.innerHTML += `<div class="fw-msg ai" id="${typingId}"><div class="fw-msg-avatar">🤖</div><div class="fw-typing"><div class="fw-dot"></div><div class="fw-dot"></div><div class="fw-dot"></div></div></div>`;
    log.scrollTop = log.scrollHeight;

    // find best response
    const lower = msg.toLowerCase();
    let response = FW_CHAT_RESPONSES.default;
    if (lower.includes('shoot') || lower.includes('shot') || lower.includes('3-point')) response = FW_CHAT_RESPONSES.shoot;
    else if (lower.includes('dribble') || lower.includes('ball handle') || lower.includes('crossover')) response = FW_CHAT_RESPONSES.dribble;
    else if (lower.includes('jump') || lower.includes('vertical') || lower.includes('vert')) response = FW_CHAT_RESPONSES.jump;
    else if (lower.includes('defense') || lower.includes('defend') || lower.includes('lateral')) response = FW_CHAT_RESPONSES.defense;

    setTimeout(() => {
      const typing = document.getElementById(typingId);
      if (typing) typing.outerHTML = `<div class="fw-msg ai"><div class="fw-msg-avatar">🤖</div><div class="fw-msg-bubble">${response}</div></div>`;
      log.scrollTop = log.scrollHeight;
    }, 1400);
  }

  /* Escape closes feature modal (in addition to auth) */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('featOverlay')?.classList.contains('open')) closeFeature();
      else if (document.getElementById('authOverlay')?.classList.contains('active')) closeAuth();
      else if (document.getElementById('sidebar')?.classList.contains('open')) closeSidebar();
    }
  });

  /* ══════════════════════════════════════════════════════════════
