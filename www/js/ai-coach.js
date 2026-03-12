     AI COACH — adaptive weekly program adjustment
     Prompt: Analyze performance data (sets, success %, time),
     increase/decrease intensity, focus on weak areas, suggest
     alternative drills if equipment is limited.
     Output: updated weekly schedule as JSON.
  ══════════════════════════════════════════════════════════════ */

  const COACH_SYSTEM_PROMPT = `You are an AI Basketball Coach. Given the user's performance data (completed sets, success %, time spent), adjust the next week's training:
- Increase or decrease intensity
- Focus more on weak areas
- Suggest alternative drills if equipment is limited
Output updated weekly schedule in the same JSON format as the original program.`;

  let coachResult = null;
  let coachLoading = false;

  function coachToggleEq(btn) { btn.classList.toggle('active'); }

  function coachUpdateBadge(area) {
    const pct   = parseFloat(document.getElementById('c-'+area+'-pct')?.value);
    const sets  = parseFloat(document.getElementById('c-'+area+'-sets')?.value);
    const badge = document.getElementById('badge-'+area);
    if (!badge) return;
    if (isNaN(pct)||isNaN(sets)){ badge.textContent='—'; badge.className='coach-area-badge'; return; }
    if (pct>=75&&sets>=6){ badge.textContent='Strong ▲'; badge.className='coach-area-badge strong'; }
    else if (pct>=55&&sets>=4){ badge.textContent='Average →'; badge.className='coach-area-badge medium'; }
    else { badge.textContent='Weak ↓'; badge.className='coach-area-badge weak'; }
  }

  function coachGetEquipment() {
    return Array.from(document.querySelectorAll('.coach-eq-btn.active')).map(b=>b.textContent.trim());
  }

  function coachGetPerformance() {
    const areas  = ['shooting','ballhandling','athleticism','defense'];
    const labels = {shooting:'Shooting',ballhandling:'Ball Handling',athleticism:'Athleticism',defense:'Defense'};
    return areas.map(a=>({
      area: labels[a],
      sets_completed: parseFloat(document.getElementById('c-'+a+'-sets')?.value)||0,
      success_pct:    parseFloat(document.getElementById('c-'+a+'-pct')?.value)||0,
      time_spent_min: parseFloat(document.getElementById('c-'+a+'-time')?.value)||0,
      notes: document.getElementById('c-'+a+'-notes')?.value||'',
    }));
  }

  async function coachGenerate() {
    if (coachLoading) return;
    const perf = coachGetPerformance();
    const hasData = perf.some(p=>p.sets_completed>0||p.success_pct>0);
    if (!hasData) {
      const err=document.getElementById('coach-error');
      err.textContent='⚠ Enter at least one area performance data before generating.';
      err.style.display='block';
      setTimeout(()=>err.style.display='none',3000);
      return;
    }
    coachLoading = true;
    // Sanitize inputs before embedding in AI prompt (SEC-10: prevent prompt injection)
    const _sp = typeof sanitizePromptStr === 'function' ? sanitizePromptStr
      : function(s,n){return String(s||'').replace(/[\x00-\x1F\x7F]/g,' ').replace(/\s+/g,' ').trim().slice(0,n||200);};
    const _VALID_POS = ['Point Guard','Shooting Guard','Small Forward','Power Forward','Center'];
    const player    = _sp(document.getElementById('db-player')?.value||'Athlete', 60);
    const _posRaw   = _sp(document.getElementById('db-position')?.value||'Point Guard', 30);
    const position  = _VALID_POS.includes(_posRaw) ? _posRaw : 'Point Guard';
    const equipment = coachGetEquipment();
    const weekNum   = dbWeeks.length+1;
    const btn = document.getElementById('coach-gen-btn');
    btn.textContent='⚙️ Adjusting…'; btn.disabled=true;
    document.getElementById('coach-empty').style.display='none';
    document.getElementById('coach-results').style.display='none';
    document.getElementById('coach-loading').style.display='block';
    document.getElementById('coach-error').style.display='none';

    const userPrompt=`Athlete: ${player} | Position: ${position} | Building schedule for: Week ${weekNum}

LAST WEEK PERFORMANCE DATA:
${JSON.stringify(perf,null,2)}

AVAILABLE EQUIPMENT:
${equipment.join(', ')}

ORIGINAL PROGRAM FORMAT — output adjusted schedule in this exact JSON structure:
{
  "week": "Week ${weekNum}",
  "player": "${player}",
  "position": "${position}",
  "overall_intensity": "Low|Medium|High|Max",
  "coach_analysis": {
    "headline": "Short punchy title (8-10 words)",
    "summary": "2-3 sentences referencing actual performance numbers",
    "weak_areas": ["area with specific reason"],
    "strong_areas": ["area"],
    "key_adjustments": ["adjustment 1","adjustment 2","adjustment 3"]
  },
  "days": [
    {
      "day": "Monday",
      "focus": "Primary focus",
      "intensity": "Low|Medium|High|Max",
      "total_minutes": 60,
      "drills": [
        {
          "name": "Drill name",
          "sets": 3,
          "reps_or_duration": "10 reps",
          "focus_area": "Shooting|Ball Handling|Athleticism|Defense",
          "intensity_change": "increased|decreased|unchanged",
          "reason": "Why adjusted (max 12 words)",
          "alternative_if_no_equipment": "Alt drill or null"
        }
      ],
      "coach_note": "Motivational note max 15 words"
    }
  ]
}

Rules:
- success_pct<60% or sets_completed<4 = WEAK: increase volume and add drills
- success_pct>=75% and sets_completed>=6 = STRONG: maintain or push harder
- Always fill alternative_if_no_equipment when equipment is limited
- 6 days Mon-Sat, skip Sunday (rest)
- Output ONLY valid JSON, no markdown`;

    try {
      const headers=await getAuthHeaders();
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),30000);
      const res=await fetch('https://txnsuzlgfafjdipfqkqe.supabase.co/functions/v1/claude-proxy',{
        method:'POST',
        headers,
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:2400,
          system:COACH_SYSTEM_PROMPT,
          messages:[{role:'user',content:userPrompt}],
        }),
        signal:controller.signal,
      });
      clearTimeout(timeout);
      if(!res.ok){const errBody=await res.text();throw{status:res.status,message:errBody};}
      const data=await res.json();
      if(data.error)throw{message:data.error.message||'AI service error'};
      const text=(data.content||[]).map(b=>b.text||'').join('');
      const result=JSON.parse(text.replace(/```json|```/g,'').trim());
      coachResult=result;

      document.getElementById('coach-loading').style.display='none';
      document.getElementById('coach-results').style.display='block';

      const a=result.coach_analysis||{};
      document.getElementById('coach-week-tag').textContent='AI Coach · Week '+weekNum;
      document.getElementById('coach-headline').textContent=a.headline||'—';
      document.getElementById('coach-analysis').textContent=a.summary||'—';
      document.getElementById('coach-schedule-title').textContent='Week '+weekNum+' — Adjusted Schedule';
      document.getElementById('coach-json-filename').textContent='adjusted_schedule_week'+weekNum+'.json';
      document.getElementById('coach-json-body').textContent=JSON.stringify(result,null,2);

      const ib=document.getElementById('coach-intensity-badge');
      const imap={Low:'86,211,100',Medium:'245,166,35',High:'248,81,73',Max:'188,140,255'};
      const icolor={Low:'#56d364',Medium:'#f5a623',High:'#f85149',Max:'#bc8cff'};
      const lvl=result.overall_intensity||'Medium';
      const rgb=imap[lvl]||'245,166,35';
      const hex=icolor[lvl]||'#f5a623';
      ib.textContent=lvl+' Intensity';
      ib.style.cssText=`font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:100px;background:rgba(${rgb},0.12);color:${hex};border:1px solid rgba(${rgb},0.3);`;

      const _esc=typeof escapeHTML==='function'?escapeHTML:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const row=s=>`<div style="font-size:12px;color:var(--c-muted);padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">· ${_esc(s)}</div>`;
      document.getElementById('coach-weak').innerHTML=(a.weak_areas||[]).map(row).join('');
      document.getElementById('coach-strong').innerHTML=(a.strong_areas||[]).map(row).join('');
      document.getElementById('coach-adjustments').innerHTML=(a.key_adjustments||[]).map(row).join('');

      coachRenderSchedule(result.days||[]);
    } catch(e) {
      document.getElementById('coach-loading').style.display='none';
      document.getElementById('coach-empty').style.display='block';
      const err=document.getElementById('coach-error');
      if(e.name==='AbortError'){err.textContent='\u26a0 Request timed out. Please try again.';}
      else if(!navigator.onLine){err.textContent='\u26a0 You appear to be offline. Check your connection.';}
      else if(e.status===401){err.textContent='\u26a0 Session expired. Please sign in again.';setTimeout(()=>{window.location.href='index.html';},2000);}
      else{err.textContent='\u26a0 Failed to generate adjusted schedule. Check connection and try again.';}
      err.style.display='block';
      console.error(e);
    } finally {
      coachLoading=false;
      btn.textContent='🏋️ Regenerate'; btn.disabled=false;
    }
  }

  function coachRenderSchedule(days) {
    const c=document.getElementById('coach-schedule-cards');
    const imap={Low:'86,211,100',Medium:'245,166,35',High:'248,81,73',Max:'188,140,255'};
    const icolor={Low:'#56d364',Medium:'#f5a623',High:'#f85149',Max:'#bc8cff'};
    const cicon={increased:'▲',decreased:'▼',unchanged:'→'};
    const ccolor={increased:'#f85149',decreased:'#56d364',unchanged:'var(--c-muted)'};
    // Use global escapeHTML if available, else inline fallback
    const _esc=typeof escapeHTML==='function'?escapeHTML:s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    // Allowlist for intensity keys (prevents CSS injection via day.intensity)
    const safeIntensity=v=>(['Low','Medium','High','Max'].includes(v)?v:'Medium');
    // Allowlist for intensity_change keys
    const safeChange=v=>(['increased','decreased','unchanged'].includes(v)?v:'unchanged');

    c.innerHTML=days.map(day=>{
      const intKey=safeIntensity(day.intensity);
      const rgb=imap[intKey];
      const hex=icolor[intKey];
      const drills=(day.drills||[]).map((d,i)=>{
        const chKey=safeChange(d.intensity_change);
        return `
        <div class="coach-drill-row">
          <div class="coach-drill-num">${String(i+1).padStart(2,'0')}</div>
          <div class="coach-drill-info">
            <div class="coach-drill-name">${_esc(d.name)}</div>
            <div class="coach-drill-meta">${_esc(d.sets)} sets · ${_esc(d.reps_or_duration)} · <span style="color:${ccolor[chKey]};">${cicon[chKey]} ${_esc(d.intensity_change)}</span></div>
            ${d.reason?`<div style="font-size:11px;color:var(--c-dimmer);margin-top:2px;font-style:italic;">${_esc(d.reason)}</div>`:''}
            ${d.alternative_if_no_equipment?`<div class="coach-drill-alt">🔄 Alt: ${_esc(d.alternative_if_no_equipment)}</div>`:''}
          </div>
          <span class="coach-focus-tag">${_esc(d.focus_area)}</span>
        </div>`;
      }).join('<div style="height:1px;background:rgba(255,255,255,0.04);margin:6px 0;"></div>');
      return `
        <div class="coach-day-card">
          <div class="coach-day-header">
            <div class="coach-day-name">${_esc(day.day)}</div>
            <div style="font-size:12px;color:var(--c-muted);flex:1;padding-left:10px;">${_esc(day.focus)} · ${_esc(day.total_minutes||'—')} min</div>
            <span class="coach-intensity-chip" style="background:rgba(${rgb},0.1);color:${hex};border:1px solid rgba(${rgb},0.25);">${_esc(intKey)}</span>
          </div>
          <div class="coach-day-body">
            ${drills}
            ${day.coach_note?`<div class="coach-day-note">"${_esc(day.coach_note)}"</div>`:''}
          </div>
        </div>`;
    }).join('');
  }

  function coachCopyJSON() {
    if (!coachResult) return;
    if (navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(coachResult,null,2));
    const btn=document.querySelector('#db-panel-coach .db-copy-btn');
    if (!btn) return;
    btn.textContent='✓ Copied!'; btn.style.color='#56d364';
    setTimeout(()=>{btn.textContent='Copy JSON';btn.style.color='';},2000);
  }


  /* ══════════════════════════════════════════════════════════════
     WEEKLY CALENDAR — AI converts training JSON into interactive
     collapsible calendar with completion tracking + React/JS JSON.
     Prompt: Convert weekly training JSON into interactive calendar
     with collapsible days, sets/reps/duration, completed vs pending
     indicators, and React/JS-compatible JSON structure.
  ══════════════════════════════════════════════════════════════ */

  const CAL_SYSTEM_PROMPT = `You are an AI UI assistant. Convert the weekly training JSON into an interactive weekly calendar:
- Each day has a collapsible list of exercises
- Show sets, reps, duration
- Include visual indicators for completed vs pending exercises
- Output JSON structure compatible with React/JS frontend`;

  /* State */
  let calData      = null;   // parsed calendar JSON from AI
  let calLoading   = false;
  let calSource    = 'coach'; // 'coach' | 'log' | 'paste'
  let calCompleted = {};      // { "Monday_0": true, ... }

  function calSetSource(src, btn) {
    calSource = src;
    document.querySelectorAll('.cal-src-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const pasteArea = document.getElementById('cal-paste-area');
    const statusEl  = document.getElementById('cal-src-status');
    pasteArea.style.display = src === 'paste' ? 'block' : 'none';
    if (src === 'coach') {
      statusEl.textContent = coachResult
        ? '✓ AI Coach output ready — Week ' + (dbWeeks.length + 1)
        : '⚠ No AI Coach output yet — run the AI Coach tab first, or switch to Paste.';
      statusEl.style.color = coachResult ? '#56d364' : 'var(--c-amber)';
    } else if (src === 'log') {
      const n = typeof dbSessions !== 'undefined' ? dbSessions.length : 0;
      statusEl.textContent = n > 0
        ? '✓ ' + n + ' logged sessions found'
        : '⚠ No sessions logged yet — log sessions first or switch to Paste.';
      statusEl.style.color = n > 0 ? '#56d364' : 'var(--c-amber)';
    } else {
      statusEl.textContent = 'Paste any weekly_schedule JSON in the box below.';
      statusEl.style.color = 'var(--c-muted)';
    }
  }

  function calGetInputData() {
    if (calSource === 'coach') {
      if (!coachResult) return null;
      return coachResult;
    }
    if (calSource === 'log') {
      // Build a lightweight schedule from logged sessions
      if (!dbSessions || dbSessions.length === 0) return null;
      const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return {
        week: 'Week ' + (dbWeeks.length + 1),
        player: document.getElementById('db-player')?.value || 'Athlete',
        days: days.slice(0, Math.max(dbSessions.length, 3)).map((d, i) => {
          const s = dbSessions[i];
          if (!s) return { day: d, focus: 'Rest', intensity: 'Low', total_minutes: 0, drills: [] };
          return {
            day: d,
            focus: 'Training Session ' + (i + 1),
            intensity: s.pct >= 65 ? 'High' : s.pct >= 50 ? 'Medium' : 'Low',
            total_minutes: Math.round((s.dribbling_min || 20) + 20),
            drills: [
              { name: 'Shooting Drill', sets: 3, reps_or_duration: s.shots_attempted + ' attempts', focus_area: 'Shooting' },
              { name: 'Ball Handling Circuit', sets: 3, reps_or_duration: s.dribbling_min + ' min', focus_area: 'Ball Handling' },
              { name: 'Vertical Jump Work', sets: 3, reps_or_duration: s.vertical_in + '" target', focus_area: 'Athleticism' },
              { name: 'Sprint Intervals', sets: 4, reps_or_duration: s.sprint_sec + 's sprints', focus_area: 'Conditioning' },
            ],
          };
        }),
      };
    }
    // paste
    const raw = document.getElementById('cal-json-input')?.value?.trim();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e) { return 'error'; }
  }

  async function calGenerate() {
    if (calLoading) return;

    const inputData = calGetInputData();
    if (inputData === 'error') {
      const err = document.getElementById('cal-error');
      err.textContent = '⚠ Invalid JSON — check your pasted data and try again.';
      err.style.display = 'block';
      setTimeout(() => err.style.display = 'none', 3500);
      return;
    }
    if (!inputData) {
      const err = document.getElementById('cal-error');
      err.textContent = calSource === 'coach'
        ? '⚠ No AI Coach output found. Run the AI Coach tab first.'
        : calSource === 'log'
        ? '⚠ No sessions logged. Log at least one session first.'
        : '⚠ Paste valid JSON in the box above.';
      err.style.display = 'block';
      setTimeout(() => err.style.display = 'none', 3500);
      return;
    }

    calLoading = true;
    calCompleted = {};
    const btn = document.getElementById('cal-gen-btn');
    btn.textContent = '⚙️ Building…'; btn.disabled = true;

    document.getElementById('cal-empty').style.display   = 'none';
    document.getElementById('cal-results').style.display = 'none';
    document.getElementById('cal-loading').style.display = 'block';
    document.getElementById('cal-error').style.display   = 'none';

    const userPrompt = `Convert this weekly training schedule into a React/JS-compatible interactive calendar JSON.

INPUT SCHEDULE:
${JSON.stringify(inputData, null, 2)}

OUTPUT — return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "week": "Week N",
  "player": "Name",
  "generated_at": "ISO timestamp",
  "total_exercises": 24,
  "days": [
    {
      "id": "monday",
      "day": "Monday",
      "date_label": "Day 1",
      "focus": "Shooting & Ball Handling",
      "intensity": "High",
      "total_minutes": 60,
      "is_rest": false,
      "exercises": [
        {
          "id": "monday_0",
          "name": "3-Point Catch & Shoot",
          "sets": 3,
          "reps": 10,
          "duration_seconds": 0,
          "rest_seconds": 30,
          "focus_area": "Shooting",
          "intensity_level": "High",
          "completed": false,
          "notes": "Focus on footwork and follow-through",
          "alternative": "Wall shooting if no hoop available"
        }
      ],
      "coach_note": "Short motivational note",
      "completion_pct": 0
    }
  ],
  "react_component_hints": {
    "suggested_component": "WeeklyCalendar",
    "props": ["days", "onExerciseToggle", "onDayExpand"],
    "state": ["expandedDays", "completedExercises"],
    "styling_notes": "Use conditional className for completed state, animate max-height for collapse"
  }
}

Rules:
- Each exercise must have a unique id in format dayname_index (e.g. monday_0)
- duration_seconds should be 0 if reps are used, otherwise fill it
- is_rest: true for rest days, exercises array empty
- completion_pct starts at 0 for all days
- Include react_component_hints at the end
- Output ONLY valid JSON`;

    try {
      const headers = await getAuthHeaders();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch('https://txnsuzlgfafjdipfqkqe.supabase.co/functions/v1/claude-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2800,
          system: CAL_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) { const errBody = await res.text(); throw { status: res.status, message: errBody }; }
      const data   = await res.json();
      if (data.error) throw { message: data.error.message || 'AI service error' };
      const text   = (data.content || []).map(b => b.text || '').join('');
      const result = JSON.parse(text.replace(/```json|```/g, '').trim());

      calData = result;

      document.getElementById('cal-loading').style.display  = 'none';
      document.getElementById('cal-results').style.display  = 'block';

      const weekNum = (result.week || 'Week').replace('Week','').trim() || (dbWeeks.length + 1);
      document.getElementById('cal-week-label').textContent     = result.week || 'Week Overview';
      document.getElementById('cal-json-filename').textContent  = 'weekly_calendar_week' + weekNum + '.json';
      document.getElementById('cal-json-body').textContent      = JSON.stringify(result, null, 2);

      calRenderCalendar(result);
      calUpdateProgress();

    } catch(e) {
      document.getElementById('cal-loading').style.display = 'none';
      document.getElementById('cal-empty').style.display   = 'block';
      const err = document.getElementById('cal-error');
      if (e.name === 'AbortError') { err.textContent = '\u26a0 Request timed out. Please try again.'; }
      else if (!navigator.onLine) { err.textContent = '\u26a0 You appear to be offline. Check your connection.'; }
      else if (e.status === 401) { err.textContent = '\u26a0 Session expired. Please sign in again.'; setTimeout(() => { window.location.href = 'index.html'; }, 2000); }
      else { err.textContent = '\u26a0 Failed to build calendar. Check connection and try again.'; }
      err.style.display = 'block';
      console.error(e);
    } finally {
      calLoading = false;
      btn.textContent = '📆 Rebuild'; btn.disabled = false;
    }
  }

  function calRenderCalendar(result) {
    const days = result.days || [];
    const intensityRgb = { High: '248,81,73', Max: '188,140,255', Medium: '245,166,35', Low: '86,211,100' };
    const intensityHex = { High: '#f85149', Max: '#bc8cff', Medium: '#f5a623', Low: '#56d364' };

    /* Day dot nav */
    const dotsEl = document.getElementById('cal-day-dots');
    dotsEl.innerHTML = days.map(d => {
      const cls = d.is_rest ? 'cal-dot rest' : 'cal-dot';
      const abbr = (d.day || '').slice(0, 2).toUpperCase();
      return `<div class="${cls}" id="dot-${d.id}" onclick="calScrollToDay('${d.id}')" title="${d.day}">${abbr}</div>`;
    }).join('');

    /* Day cards */
    const container = document.getElementById('cal-day-cards');
    container.innerHTML = days.map(d => {
      const rgb = intensityRgb[d.intensity] || '245,166,35';
      const hex = intensityHex[d.intensity] || '#f5a623';
      const exCount = (d.exercises || []).length;
      const isFirst = days.indexOf(d) === 0;

      if (d.is_rest) {
        return `
          <div class="cal-day-card" id="daycard-${d.id}">
            <div class="cal-day-card-header" onclick="calToggleDay('${d.id}')">
              <div>
                <div class="cal-day-label">${d.day} <span style="font-size:13px;opacity:0.4;font-weight:400;text-transform:none;">— Rest</span></div>
                <div class="cal-day-sub">${d.date_label || ''}</div>
              </div>
              <span class="cal-day-stat">😴 Recovery</span>
              <span class="cal-day-chevron">▾</span>
            </div>
            <div class="cal-exercise-list" id="exlist-${d.id}">
              <div class="cal-rest-body">
                <span style="font-size:22px;">🛌</span>
                <span>Rest day — focus on sleep, hydration, and light mobility work. ${d.coach_note || ''}</span>
              </div>
            </div>
          </div>`;
      }

      const exercisesHTML = (d.exercises || []).map((ex, idx) => {
        const exKey = ex.id || (d.id + '_' + idx);
        const isDone = !!calCompleted[exKey];
        const doneClass = isDone ? ' completed' : '';
        const pills = [
          ex.sets       ? `<span class="cal-ex-pill sets">⚡ ${ex.sets} sets</span>` : '',
          ex.reps       ? `<span class="cal-ex-pill reps">🔁 ${ex.reps} reps</span>` : '',
          ex.duration_seconds && ex.duration_seconds > 0
            ? `<span class="cal-ex-pill duration">⏱ ${ex.duration_seconds}s</span>` : '',
          ex.rest_seconds && ex.rest_seconds > 0
            ? `<span class="cal-ex-pill duration">💤 ${ex.rest_seconds}s rest</span>` : '',
          ex.focus_area ? `<span class="cal-ex-pill focus">🎯 ${ex.focus_area}</span>` : '',
        ].filter(Boolean).join('');

        return `
          <div class="cal-exercise-row${doneClass}" id="exrow-${exKey}" onclick="calToggleExercise('${exKey}','${d.id}')">
            <div class="cal-check"><span class="cal-check-tick">✓</span></div>
            <div style="flex:1;">
              <div class="cal-ex-name">${ex.name || ''}</div>
              <div class="cal-ex-meta">${pills}</div>
              ${ex.notes     ? `<div style="font-size:11px;color:var(--c-dimmer);margin-top:4px;font-style:italic;">${ex.notes}</div>` : ''}
              ${ex.alternative ? `<div class="cal-ex-alt">🔄 Alt: ${ex.alternative}</div>` : ''}
            </div>
          </div>`;
      }).join('');

      return `
        <div class="cal-day-card${isFirst ? ' expanded' : ''}" id="daycard-${d.id}">
          <div class="cal-day-card-header" onclick="calToggleDay('${d.id}')">
            <div>
              <div class="cal-day-label">${d.day}</div>
              <div class="cal-day-sub">${d.date_label || ''} · ${d.focus || ''}</div>
            </div>
            <span style="font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:3px 10px;border-radius:100px;background:rgba(${rgb},0.1);color:${hex};border:1px solid rgba(${rgb},0.25);">${d.intensity || ''}</span>
            <span class="cal-day-stat">${d.total_minutes || 0} min · ${exCount} exercises</span>
            <span class="cal-day-chevron">▾</span>
          </div>
          <div class="cal-day-done-bar"><div class="cal-day-done-fill" id="daybar-${d.id}" style="width:0%;"></div></div>
          <div class="cal-exercise-list" id="exlist-${d.id}">
            ${exercisesHTML}
            ${d.coach_note ? `<div style="padding:12px 20px;font-size:12px;color:var(--c-muted);font-style:italic;border-top:1px solid rgba(255,255,255,0.04);">💬 "${d.coach_note}"</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function calToggleDay(id) {
    const card = document.getElementById('daycard-' + id);
    if (!card) return;
    card.classList.toggle('expanded');
  }

  function calScrollToDay(id) {
    const card = document.getElementById('daycard-' + id);
    if (!card) return;
    if (!card.classList.contains('expanded')) card.classList.add('expanded');
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Update dot active state
    document.querySelectorAll('.cal-dot').forEach(d => d.classList.remove('active'));
    const dot = document.getElementById('dot-' + id);
    if (dot && !dot.classList.contains('rest')) dot.classList.add('active');
  }

  function calToggleExercise(exKey, dayId) {
    calCompleted[exKey] = !calCompleted[exKey];
    const row = document.getElementById('exrow-' + exKey);
    if (row) row.classList.toggle('completed', calCompleted[exKey]);
    calUpdateDayBar(dayId);
    calUpdateProgress();
    // Update JSON to reflect state
    if (calData) {
      const day = (calData.days || []).find(d => d.id === dayId);
      if (day) {
        const ex = (day.exercises || []).find(e => e.id === exKey);
        if (ex) ex.completed = calCompleted[exKey];
        day.completion_pct = calDayCompletionPct(day);
        document.getElementById('cal-json-body').textContent = JSON.stringify(calData, null, 2);
      }
    }
  }

  function calDayCompletionPct(day) {
    const exes = day.exercises || [];
    if (!exes.length) return 0;
    const done = exes.filter(e => calCompleted[e.id]).length;
    return Math.round((done / exes.length) * 100);
  }

  function calUpdateDayBar(dayId) {
    if (!calData) return;
    const day = (calData.days || []).find(d => d.id === dayId);
    if (!day) return;
    const pct = calDayCompletionPct(day);
    const bar = document.getElementById('daybar-' + dayId);
    if (bar) bar.style.width = pct + '%';
    // Update dot
    const dot = document.getElementById('dot-' + dayId);
    if (dot) {
      dot.classList.remove('done','active');
      if (pct === 100) dot.classList.add('done');
    }
  }

  function calUpdateProgress() {
    if (!calData) return;
    const allEx  = (calData.days || []).flatMap(d => d.exercises || []);
    const total  = allEx.length;
    const done   = Object.values(calCompleted).filter(Boolean).length;
    const pct    = total ? (done / total) * 100 : 0;
    document.getElementById('cal-done-count').textContent  = done;
    document.getElementById('cal-total-count').textContent = total;
    document.getElementById('cal-progress-bar').style.width = pct + '%';
  }

  function calCopyJSON() {
    if (!calData) return;
    const text = JSON.stringify(calData, null, 2);
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    const btn = document.querySelector('#db-panel-calendar .db-copy-btn');
    if (!btn) return;
    btn.textContent = '✓ Copied!'; btn.style.color = '#56d364';
    setTimeout(() => { btn.textContent = 'Copy JSON'; btn.style.color = ''; }, 2000);
  }

  /* Calendar tab init is handled by dbSwitchTab in dashboard.js */

