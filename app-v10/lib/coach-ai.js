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

  /* coach-chat is the server-side brain: it holds the system prompt and
     playbook, pins the model (Haiku — the playbook carries the craft),
     prompt-caches the static part, and rate-limits per user. The client
     sends only the question (as history's tail) + the real-data context
     block. The old claude-proxy pass-through is no longer used here. */
  var PROXY = 'https://txnsuzlgfafjdipfqkqe.supabase.co/functions/v1/coach-chat';
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
      } else if (a.type === 'propose_plan') {
        a = validateProposal(a);
      } else a = null;
      return { text: clean, action: a };
    } catch (e) { return { text: clean, action: null }; }
  }

  /* ── plan proposals ──────────────────────────────────────────────
     propose_plan is DIFFERENT from every other action: it is not applied
     when the model emits it. The model proposes; the player gets a card
     with a "Build this into my plan" button; only that tap writes to the
     plan. The one who trains decides — the coach just hands over the
     clipboard.

     Validation is strict because this writes durable state: days 0-6,
     de-duplicated; focus ids from the whitelist; every drill name resolved
     against the REAL drill DB via V12Plan.resolveDrill — unresolvable
     names are dropped, and a day left with no real drills falls back to
     its focus derivation rather than inventing content. */
  function validateProposal(a) {
    if (!Array.isArray(a.days) || !a.days.length) return null;
    var seen = {}, days = [];
    a.days.forEach(function (d) {
      if (!d || typeof d.dow !== 'number') return;
      var dow = Math.round(d.dow);
      if (dow < 0 || dow > 6 || seen[dow]) return;
      var focusId = VALID_FOCUS[d.focus] ? d.focus : 'shooting';
      var drills = [];
      if (Array.isArray(d.drills) && window.V12Plan && window.V12Plan.resolveDrill) {
        d.drills.slice(0, 5).forEach(function (n) {
          var hit = window.V12Plan.resolveDrill(n);
          if (hit) drills.push(hit.name);          /* canonical DB name */
        });
      }
      seen[dow] = 1;
      days.push({ dow: dow, focus: focusId, drills: drills });
    });
    if (!days.length || days.length > 6) return null;
    days.sort(function (x, y) { return x.dow - y.dow; });
    return {
      type: 'propose_plan',
      name: (typeof a.name === 'string' ? a.name : 'Coach\'s week').slice(0, 60),
      minutes: Math.max(15, Math.min(90, +a.minutes || 30)),
      days: days
    };
  }

  /* The button's handler — coach.js calls this when the player taps. */
  function applyProposal(p) {
    if (!p || !window.V12Plan) return null;
    var plan = window.V12Plan.load();
    /* focus frequencies fall out of the proposed week */
    var counts = {};
    p.days.forEach(function (d) { counts[d.focus] = (counts[d.focus] || 0) + 1; });
    plan.focus = Object.keys(counts).map(function (id) {
      return { id: id, perWeek: counts[id] };
    }).slice(0, 3);
    plan.minutes = p.minutes;
    var sched = ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest'];
    var dayDrills = {};
    p.days.forEach(function (d) {
      sched[d.dow] = d.focus;
      if (d.drills.length) dayDrills[String(d.dow)] = d.drills;
    });
    plan.schedule = sched;
    plan.dayDrills = dayDrills;
    window.V12Plan.save(plan);
    return p.days.length + '-day week is in your plan — "' + p.name + '". The Plan screen has it.';
  }

  function applyAction(a, ctx) {
    if (!a) return null;
    if (a.type === 'propose_plan') return null;   /* card + button, never auto */
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
        /* model, max_tokens and the system prompt are SERVER-side now —
           the client cannot ask for a different model or a bigger budget. */
        body: JSON.stringify({
          context: contextBlock(data),
          history: history
        }),
        signal: controller.signal
      }).then(function (res) {
        clearTimeout(timeout);
        if (!res.ok) {
          /* READ THE BODY before classifying. A 401 here has TWO distinct
             sources and they mean opposite things:
               - the proxy's own auth check: {"error":"Unauthorized"} — the
                 player's session is invalid → genuinely the guest path.
               - Anthropic, passed through verbatim: {"type":"error","error":
                 {"type":"authentication_error",...}} — the SERVER'S API key
                 is broken. Treating that as "guest" silently downgraded
                 every signed-in user to canned local answers with no error
                 anywhere. The real reason must surface. */
          return res.text().then(function (t) {
            try { localStorage.setItem('courtiq_coach_last_error', res.status + ' ' + t.slice(0, 500)); } catch (e2) {}
            var msg = t.slice(0, 160);
            try {
              var j = JSON.parse(t);
              if (j.error && j.error.message) {
                /* structured error (Anthropic pass-through, rate limit…) —
                   real failure, surface it even on 401 */
                msg = j.error.type ? j.error.type + ': ' + j.error.message : j.error.message;
              } else if (res.status === 401) {
                /* our function's {"error":"Unauthorized"} or the gateway's
                   own JWT rejection — the SESSION is bad, not the service */
                throw { guest: true };
              } else if (typeof j.error === 'string') {
                msg = j.error;
              }
            } catch (e3) { if (e3 && e3.guest) throw e3; }
            throw new Error('AI service ' + res.status + ' — ' + msg);
          });
        }
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
      return {
        text: parsed.text, confirmation: confirmation, action: parsed.action,
        proposal: (parsed.action && parsed.action.type === 'propose_plan') ? parsed.action : null
      };
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

  window.V12CoachAI = {
    ask: ask, reset: reset, signedIn: signedIn, transcript: transcript,
    applyProposal: applyProposal,
    _parse: extractAction        /* exposed for tests — parses a raw reply */
  };
})();
