/* CourtIQ v12 — the coach's brain (window.V12CoachAI)
   ------------------------------------------------------------------
   A real conversation with a real model. The guided-chips chat existed
   because "there is no model behind it" — which turned out to be false:
   js/ai-coach.js has been talking to Claude through the `claude-proxy`
   Supabase edge function all along (authenticated user → server-held
   API key → Anthropic). This lib gives the coach screen that same line,
   properly grounded.

   GROUNDING RULE — the voice contract extends to the model:
   every request carries a context block built ONLY from real data
   (zones with the same MIN_VERDICTS gating the UI uses, real sessions,
   real streak, real plan). The system prompt forbids inventing numbers,
   and the sample-size discipline is IN the prompt: the model is told
   which zones are rated and which are thin, so it can't cite a 1-for-1
   corner as a hot zone any more than the UI can.

   ACTIONS — the model can end a reply with one line:
     @@ACTION {"type":"plan_focus","focus":["shooting","handles"]}
     @@ACTION {"type":"go","screen":"track"|"train"|"plan"}
   The client parses it, applies it through V12Plan (never blindly:
   unknown types and unknown focus ids are dropped), and says what it
   did in the thread. The model asks; the app decides.

   GUESTS: the proxy 401s without a Supabase session, so signed-out
   users keep the local guided answers — clearly labelled, never
   pretending to be the live coach.
   ============================================================ */
(function () {
  'use strict';

  var PROXY = 'https://txnsuzlgfafjdipfqkqe.supabase.co/functions/v1/claude-proxy';
  var MODEL = 'claude-sonnet-5';
  var MAX_TURNS = 16;          /* context window discipline: last N turns travel */
  var LS_MEM = 'courtiq_coach_memory';

  var history = [];            /* [{role, content}] — user/assistant alternating */

  /* ── memory — a coach remembers ──────────────────────────────────
     Two things persist across visits: the running conversation (so
     closing the app doesn't lobotomise the coach) and a small notes
     object the model itself maintains via the remember action (the
     player's goal, what was agreed last time). A coach who greets you
     like a stranger every session is a chatbot. */
  function loadMem() {
    try { return JSON.parse(localStorage.getItem(LS_MEM) || '{}'); }
    catch (e) { return {}; }
  }
  function saveMem(m) {
    try { localStorage.setItem(LS_MEM, JSON.stringify(m)); } catch (e) {}
  }
  (function restore() {
    var m = loadMem();
    if (Array.isArray(m.history)) history = m.history.slice(-MAX_TURNS);
  })();
  function persist() {
    var m = loadMem();
    m.history = history.slice(-MAX_TURNS);
    saveMem(m);
  }

  function signedIn() {
    try { return !!window.currentUser; } catch (e) { return false; }
  }

  function authHeaders() {
    return sb.auth.getSession().then(function (res) {
      var token = res && res.data && res.data.session && res.data.session.access_token;
      if (!token) throw new Error('no-session');
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'apikey': (window.COURTIQ_ENV || {}).SUPABASE_KEY || ''
      };
    });
  }

  /* ── the context block — real numbers or nothing ─────────────── */
  function pct(z) { return Math.round(z.made / z.vatt * 100); }

  function contextBlock(d) {
    var C = window.V11Court;
    var L = [];
    L.push('PLAYER: ' + (d.prof.name || 'Rookie') + ', ' + (d.prof.position || 'player') +
           ', streak ' + (d.prof.streak || 0) + ' days.');
    if (d.iq) {
      L.push('COURT IQ: ' + d.iq.score + ' (' + d.iq.tier + '), from best ' +
             d.iq.slots + ' of ' + d.iq.scored + ' sessions in 30 days' +
             (d.iq.delta != null ? ', ' + (d.iq.delta >= 0 ? '+' : '') + d.iq.delta + ' vs last week' : '') + '.');
    } else {
      L.push('COURT IQ: unrated — no scored sessions yet.');
    }
    var w = d.week || {};
    L.push('THIS WEEK: ' + (w.sessions || 0) + ' of ' + (w.goal || 5) + ' sessions, ' +
           (w.attempts || 0) + ' shots.');

    var rated = [], thin = [];
    Object.keys(d.zones || {}).forEach(function (k) {
      var z = d.zones[k];
      if (!z || !z.att) return;
      if (C.state(z) === 'rated') rated.push(C.LABEL[k] + ' ' + pct(z) + '% (' + z.made + '/' + z.vatt + ')');
      else thin.push(C.LABEL[k] + ' ' + (z.vatt ? z.made + '/' + z.vatt : z.att + ' unscored'));
    });
    L.push('RATED ZONES (>=' + C.MIN_VERDICTS + ' scored shots): ' +
           (rated.length ? rated.join(', ') : 'none yet'));
    if (thin.length) L.push('THIN ZONES (too few to rate — never cite a % for these): ' + thin.join(', '));

    var recent = (d.sessions || []).slice(0, 8).map(function (s) {
      var counter = s.session_type === 'live_counter' || s.total_made == null;
      var date = (s.session_date || s.created_at || '').slice(0, 10);
      return date + ': ' + (s.total_attempts || 0) + ' shots' +
             (counter ? ' (counted only)' : ', ' + (s.total_made || 0) + ' made' +
              (s.max_streak ? ', best run ' + s.max_streak : ''));
    });
    L.push('LAST SESSIONS: ' + (recent.length ? recent.join(' | ') : 'none'));

    /* ── derived reads — what a coach actually looks at ──────────── */
    if (d.insights) {
      var ins = d.insights;
      var tr = (ins.trends || []).filter(function (t) { return t.direction; });
      if (tr.length) {
        L.push('4-WEEK ZONE TRENDS (oldest week -> this week, null = too few shots that week):');
        tr.slice(0, 6).forEach(function (t) {
          L.push('  ' + (C.LABEL[t.zone] || t.zone) + ': [' +
            t.series.map(function (v) { return v == null ? '-' : v + '%'; }).join(', ') +
            '] -> ' + t.direction + ' (' + t.attempts + ' shots)');
        });
      }
      if (ins.fatigue) {
        L.push('IN-SESSION FADE (first half vs second half of each session, ' +
          ins.fatigue.days + ' sessions measured): ' +
          ins.fatigue.early + '% -> ' + ins.fatigue.late + '%.');
      }
      if (ins.consistency) {
        L.push('CONSISTENCY: session accuracy mean ' + ins.consistency.mean +
          '%, standard deviation ' + ins.consistency.sd +
          ' points over ' + ins.consistency.n + ' sessions.' +
          (ins.consistency.sd >= 10 ? ' High spread — night-to-night swings.' : ' Tight spread.'));
      }
      if (ins.rhythm) {
        L.push('RHYTHM: last session ' + ins.rhythm.daysSinceLast + ' days ago; ' +
          ins.rhythm.thisWeek + ' sessions this week vs ' + ins.rhythm.lastWeek + ' last week.');
      }
    }

    /* the real drill library, so prescriptions name real drills */
    if (d.drills && d.drills.length) {
      L.push('DRILL LIBRARY (real drills in the app — prescribe from THESE names):');
      L.push('  ' + d.drills.join(' | '));
    }

    /* coach's notes from previous conversations */
    var mem = loadMem();
    if (mem.notes) L.push('YOUR NOTES FROM EARLIER CONVERSATIONS: ' + mem.notes);

    if (d.plan) {
      L.push('CURRENT PLAN FOCUS: ' + (d.plan.focus || []).map(function (f) {
        return f.id + ' x' + f.perWeek + '/wk';
      }).join(', '));
    }
    L.push('VALID FOCUS IDS for plan_focus action: shooting, handles, finishing, conditioning, defense, passing.');
    return L.join('\n');
  }

  function systemPrompt(ctx) {
    return 'You are The Scout — a veteran basketball shooting coach inside the CourtIQ ' +
      'app. The app tracks the player\'s real shots with computer vision, and the DATA ' +
      'block below is their actual film. You have watched it. Coach from it.\n\n' +

      'VOICE: you talk like a coach, out loud. Plain words, no exclamation marks, no ' +
      'emoji, no hype. You are allowed to deliver bad news — a number the player will ' +
      'not like is still the number. Quick questions get 2-4 sentences. But when the ' +
      'player asks for a plan, a session structure, or a deep read, GO LONG: lay out ' +
      'days, drills, rep counts, and the reasoning. Numbered days are fine; never use ' +
      'markdown headers.\n\n' +

      'TRUTH: the DATA block is the only source of numbers. Never invent a stat, a ' +
      'percentage, or a session. Zones listed as THIN have too little data — say "not ' +
      'enough shots from there yet" rather than quoting them. Trends marked with null ' +
      'weeks had too few shots that week to count. If the data cannot answer, say so ' +
      'and say what to go do on the court to change that.\n\n' +

      'HOW YOU COACH — your playbook:\n' +
      '- Diagnose direction before level. A 30% zone that is improving needs patience, ' +
      'not surgery; a 40% zone that is sliding needs attention now. Use the 4-week ' +
      'trends for this, and SAY the trajectory to the player — progress they cannot ' +
      'see is the most motivating thing you can show them.\n' +
      '- One priority at a time. Pick the highest-leverage weakness, give it 2-3 weeks ' +
      'of dedicated reps before touching the next thing. Volume at one spot beats ' +
      'variety across nine.\n' +
      '- Prescribe like a coach: spot, rep count, success target, and a rule for moving ' +
      'on. "30 catch-and-shoot reps from the left wing, move back only after 3 sessions ' +
      'above 40%" — not "practice more threes".\n' +
      '- Block practice to build, random practice to test: repeat one spot to groove ' +
      'the motion early in a session, then mix spots late to make it game-real. If the ' +
      'FADE read shows a second-half drop, front-load the priority zone right after ' +
      'warm-up and cap sessions before the collapse point; conditioning is part of ' +
      'shooting.\n' +
      '- High session-to-session spread (SD >= 10) usually means routine, not mechanics: ' +
      'anchor a fixed warm-up ladder (paint -> free throw -> one wing) before the real ' +
      'work, every session, and say why.\n' +
      '- Cold zone on one side only (e.g. left wing weak, right corner fine) is usually ' +
      'footwork arriving into the shot, not the release: prescribe reps that ARRIVE ' +
      'into that spot off movement, inside-foot plant first.\n' +
      '- Missing rhythm (gaps of 3+ days) beats any drill talk: the first prescription ' +
      'is showing up. Short frequent sessions beat rare marathons.\n' +
      '- When you prescribe drills, use names from the DRILL LIBRARY list verbatim so ' +
      'the player can find them in the app. Fit total time to what their sessions ' +
      'actually run (see durations in LAST SESSIONS).\n\n' +

      'MEMORY: you may keep short notes across conversations. When the player tells ' +
      'you a goal, a constraint (injury, schedule, equipment), or you agree on a plan, ' +
      'save it with the remember action. Your earlier notes appear in the DATA block — ' +
      'use them: refer back to what you agreed last time, hold the player to it.\n\n' +

      'ACTIONS: to change the player\'s plan, open a screen, or save a note, end the ' +
      'reply with ONE line exactly like:\n' +
      '@@ACTION {"type":"plan_focus","focus":["shooting","handles"]}\n' +
      '@@ACTION {"type":"go","screen":"plan"}\n' +
      '@@ACTION {"type":"remember","notes":"goal: 50% from left wing by September; agreed 3 sessions/week"}\n' +
      'plan_focus and go only when the player asked; remember whenever something worth ' +
      'keeping was said. The text before the action must say what you are doing. Valid ' +
      'screens: track, train, plan. Valid focus ids: shooting, handles, finishing, ' +
      'conditioning, defense, passing.\n\n' +

      'DATA (real, current):\n' + ctx;
  }

  /* ── action protocol — parse, validate, apply ────────────────── */
  var VALID_FOCUS = { shooting: 1, handles: 1, finishing: 1, conditioning: 1, defense: 1, passing: 1 };

  function extractAction(text) {
    var m = text.match(/@@ACTION\s+(\{[^\n]*\})\s*$/);
    if (!m) return { text: text, action: null };
    var clean = text.slice(0, m.index).replace(/\s+$/, '');
    try {
      var a = JSON.parse(m[1]);
      if (a.type === 'plan_focus' && Array.isArray(a.focus)) {
        a.focus = a.focus.filter(function (f) { return VALID_FOCUS[f]; }).slice(0, 3);
        if (!a.focus.length) a = null;
      } else if (a.type === 'go') {
        if (['track', 'train', 'plan'].indexOf(a.screen) < 0) a = null;
      } else if (a.type === 'remember') {
        if (typeof a.notes !== 'string' || !a.notes.trim()) a = null;
        else a.notes = a.notes.slice(0, 400);
      } else a = null;
      return { text: clean, action: a };
    } catch (e) { return { text: clean, action: null }; }
  }

  function applyAction(a, ctx) {
    if (!a) return null;
    if (a.type === 'remember') {
      var m = loadMem();
      m.notes = a.notes;
      saveMem(m);
      return null;               /* silent — a coach doesn't announce note-taking */
    }
    if (a.type === 'plan_focus' && window.V12Plan) {
      try {
        var p = window.V12Plan.load();
        p.focus = a.focus.map(function (id) { return { id: id, perWeek: id === 'shooting' ? 3 : 2 }; });
        window.V12Plan.rebuild(p);
        window.V12Plan.save(p);
        return 'Plan updated — focus is now ' + a.focus.join(', ') + '. The Plan screen has the week.';
      } catch (e) { return null; }
    }
    if (a.type === 'go' && ctx && ctx.go) {
      setTimeout(function () { ctx.go(a.screen); }, 600);
      return null;
    }
    return null;
  }

  /* ── the call ────────────────────────────────────────────────── */
  function ask(question, data, ctx) {
    if (!signedIn()) {
      return Promise.reject({ guest: true });
    }
    history.push({ role: 'user', content: question });
    if (history.length > MAX_TURNS) history = history.slice(-MAX_TURNS);
    /* Anthropic requires user-first after any trim. */
    while (history.length && history[0].role !== 'user') history.shift();

    return authHeaders().then(function (headers) {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 30000);
      return fetch(PROXY, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: MODEL,
          /* 700 was the "shallow" ceiling — a week plan with drills and
             reasoning doesn't fit in it. Short answers stay short because
             the VOICE rules say so, not because the budget cuts them off. */
          max_tokens: 1600,
          system: systemPrompt(contextBlock(data)),
          messages: history
        }),
        signal: controller.signal
      }).then(function (res) {
        clearTimeout(timeout);
        if (res.status === 401) throw { guest: true };
        if (!res.ok) return res.text().then(function (t) { throw new Error('proxy ' + res.status + ': ' + t.slice(0, 120)); });
        return res.json();
      });
    }).then(function (data2) {
      if (data2.error) throw new Error(data2.error.message || 'AI error');
      var raw = (data2.content || []).map(function (b) { return b.text || ''; }).join('');
      if (!raw) throw new Error('empty reply');
      history.push({ role: 'assistant', content: raw });
      persist();
      var parsed = extractAction(raw);
      var confirmation = applyAction(parsed.action, ctx);
      return { text: parsed.text, confirmation: confirmation, action: parsed.action };
    }).catch(function (e) {
      /* the failed turn must not poison the next one */
      if (history.length && history[history.length - 1].role === 'user') history.pop();
      persist();
      throw e;
    });
  }

  /* Back button keeps the conversation (a coach remembers); this is the
     explicit "start fresh" for a new topic. Notes survive a reset —
     forgetting the player's goal is not a feature. */
  function reset() {
    history = [];
    var m = loadMem();
    delete m.history;
    saveMem(m);
  }

  /* the UI replays this on open so the thread survives navigation */
  function transcript() { return history.slice(); }

  window.V12CoachAI = { ask: ask, reset: reset, signedIn: signedIn, transcript: transcript };
})();
