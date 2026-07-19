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
  var MAX_TURNS = 12;          /* context window discipline: last N turns travel */

  var history = [];            /* [{role, content}] — user/assistant alternating */

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

    var recent = (d.sessions || []).slice(0, 5).map(function (s) {
      var counter = s.session_type === 'live_counter' || s.total_made == null;
      var date = (s.session_date || s.created_at || '').slice(0, 10);
      return date + ': ' + (s.total_attempts || 0) + ' shots' +
             (counter ? ' (counted only)' : ', ' + (s.total_made || 0) + ' made');
    });
    L.push('LAST SESSIONS: ' + (recent.length ? recent.join(' | ') : 'none'));

    if (d.plan) {
      L.push('CURRENT PLAN FOCUS: ' + (d.plan.focus || []).map(function (f) {
        return f.id + ' x' + f.perWeek + '/wk';
      }).join(', '));
    }
    L.push('VALID FOCUS IDS for plan_focus action: shooting, handles, finishing, conditioning, defense, passing.');
    return L.join('\n');
  }

  function systemPrompt(ctx) {
    return 'You are The Scout — a basketball shooting coach inside the CourtIQ app. ' +
      'The app tracks the player\'s real shots with computer vision.\n\n' +
      'VOICE: you talk like a coach, out loud. Short sentences. Plain words. ' +
      'No exclamation marks, no emoji, no hype. You are allowed to deliver bad news — ' +
      'a number the player will not like is still the number. 2-4 sentences per reply ' +
      'unless building a plan. Never use markdown headers or bullets; talk.\n\n' +
      'TRUTH: the DATA block below is the only source of numbers. Never invent a stat, ' +
      'a percentage, or a session. Zones listed as THIN have too little data — say ' +
      '"not enough shots from there yet" rather than quoting them. If the data cannot ' +
      'answer the question, say so and say what to go do on the court to change that.\n\n' +
      'COACHING: when asked what to work on, anchor to the weakest RATED zone or the ' +
      'thinnest coverage, prescribe concrete reps (spots, counts), and keep one idea ' +
      'per reply. When asked for a weekly plan, set 2-3 focus areas.\n\n' +
      'ACTIONS: to change the player\'s plan or open a screen, end the reply with ONE ' +
      'line exactly like:\n' +
      '@@ACTION {"type":"plan_focus","focus":["shooting","handles"]}\n' +
      '@@ACTION {"type":"go","screen":"plan"}\n' +
      'Only when the player asked for it. The text before the action must say what ' +
      'you are doing. Valid screens: track, train, plan.\n\n' +
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
      } else a = null;
      return { text: clean, action: a };
    } catch (e) { return { text: clean, action: null }; }
  }

  function applyAction(a, ctx) {
    if (!a) return null;
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
          max_tokens: 700,
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
      var parsed = extractAction(raw);
      var confirmation = applyAction(parsed.action, ctx);
      return { text: parsed.text, confirmation: confirmation, action: parsed.action };
    }).catch(function (e) {
      /* the failed turn must not poison the next one */
      if (history.length && history[history.length - 1].role === 'user') history.pop();
      throw e;
    });
  }

  function reset() { history = []; }

  window.V12CoachAI = { ask: ask, reset: reset, signedIn: signedIn };
})();
