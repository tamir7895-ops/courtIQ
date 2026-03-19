/* ============================================================
   PLAYER ANALYSIS — /js/player-analysis.js
   Enhanced archetype determination + AI scouting report.
   Uses Supabase Claude proxy for AI generation, with
   local fallback from archetype-engine.js data.
   ============================================================ */
(function () {
  'use strict';

  /* ── Skill → Playstyle Mapping ──────────────────────────── */
  var skillToPlaystyle = {
    shooting:     'shooter',
    ballhandling: 'all-around',
    passing:      'playmaker',
    defense:      'defender',
    athleticism:  'slasher',
    bbiq:         'playmaker'
  };

  /* ── Enhanced Archetype Determination ────────────────────── */
  function determineFromOnboarding(data) {
    if (!data || !data.skills) return 'shot_creator';

    var skills = data.skills;

    // Find top 2 skills
    var sorted = Object.entries(skills).sort(function (a, b) { return b[1] - a[1]; });
    var topSkill = sorted[0][0];
    var secondSkill = sorted[1][0];

    // Primary signal: highest skill
    var playstyle = skillToPlaystyle[topSkill] || 'all-around';

    // Override based on playstyle answers (Step 2)
    if (data.playstyle) {
      if (data.playstyle.scoring === 'spotup' && skills.shooting >= 6) playstyle = 'shooter';
      if (data.playstyle.scoring === 'pullup' && skills.shooting >= 6) playstyle = 'shooter';
      if (data.playstyle.scoring === 'attack' && skills.athleticism >= 6) playstyle = 'slasher';
      if (data.playstyle.scoring === 'midrange') playstyle = 'all-around';

      if (data.playstyle.defense === 'rim' && (data.position === 'C' || data.position === 'PF')) {
        playstyle = 'defender';
      }
    }

    // Goals influence
    if (data.goals && data.goals.indexOf('Defense') !== -1 && skills.defense >= 7) {
      playstyle = 'defender';
    }

    // Use existing archetype engine logic
    if (typeof window.ArchetypeEngine !== 'undefined' && window.ArchetypeEngine.determine) {
      return window.ArchetypeEngine.determine(data.height || 72, data.position || 'SG', playstyle);
    }

    // Fallback manual mapping
    var map = {
      shooter: 'sharpshooter',
      playmaker: 'floor_general',
      slasher: 'rim_attacker',
      defender: 'two_way_wing',
      'all-around': 'shot_creator'
    };
    var base = map[playstyle] || 'shot_creator';

    if (playstyle === 'defender' && (data.position === 'C' || data.position === 'PF') && (data.height || 72) >= 78) {
      base = 'defensive_anchor';
    }
    return base;
  }

  /* ── Grade Calculation ──────────────────────────────────── */
  function calcGrade(skills) {
    var vals = Object.values(skills);
    var avg = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
    if (avg >= 8.5) return 'A+';
    if (avg >= 7.5) return 'A';
    if (avg >= 6.5) return 'A-';
    if (avg >= 5.5) return 'B+';
    if (avg >= 4.5) return 'B';
    if (avg >= 3.5) return 'B-';
    return 'C+';
  }

  /* ── Local Fallback Report ──────────────────────────────── */
  function buildLocalReport(data, archetypeKey) {
    var archetype = null;
    if (typeof window.ArchetypeEngine !== 'undefined' && window.ArchetypeEngine.ARCHETYPES) {
      archetype = window.ArchetypeEngine.ARCHETYPES[archetypeKey];
    }

    var skills = data.skills || {};
    var sorted = Object.entries(skills).sort(function (a, b) { return b[1] - a[1]; });

    var skillNames = {
      shooting: 'Shooting',
      ballhandling: 'Ball Handling',
      passing: 'Passing',
      defense: 'Defense',
      athleticism: 'Athleticism',
      bbiq: 'Basketball IQ'
    };

    var strengths = sorted.slice(0, 3).map(function (s) {
      return skillNames[s[0]] + ' (' + s[1] + '/10)';
    });

    var weaknesses = sorted.slice(-2).reverse().map(function (s) {
      return 'Develop ' + skillNames[s[0]] + ' (currently ' + s[1] + '/10)';
    });

    var drills = archetype ? archetype.drills.slice(0, 4).map(function (d) {
      return { name: d.name.split('—')[0].trim(), focus: archetype.training_focus[0], frequency: 'daily' };
    }) : [
      { name: 'Shooting drill', focus: 'Shooting', frequency: 'daily' },
      { name: 'Ball handling drill', focus: 'Handles', frequency: '3x/week' },
      { name: 'Defensive slides', focus: 'Defense', frequency: '3x/week' },
      { name: 'Conditioning circuit', focus: 'Fitness', frequency: '2x/week' }
    ];

    return {
      player_grade: calcGrade(skills),
      strengths: strengths,
      development_areas: weaknesses,
      training_focus: {
        primary: archetype ? archetype.training_focus[0] : 'General Training',
        secondary: archetype ? archetype.training_focus[1] : 'Conditioning',
        weekly_split: { shooting: 25, handles: 20, defense: 20, conditioning: 15, iq: 20 }
      },
      suggested_drills: drills,
      one_liner: 'A ' + (data.position || 'player') + ' with serious potential on both ends.',
      comp_player: archetype ? archetype.inspirations[0] + '-style game' : 'Versatile two-way player'
    };
  }

  /* ── AI Scouting Report ─────────────────────────────────── */
  async function generateReport(data) {
    var archetypeKey = determineFromOnboarding(data);
    var archetype = null;
    if (typeof window.ArchetypeEngine !== 'undefined' && window.ArchetypeEngine.ARCHETYPES) {
      archetype = window.ArchetypeEngine.ARCHETYPES[archetypeKey];
    }

    var localReport = buildLocalReport(data, archetypeKey);

    // Try AI-enhanced report
    try {
      if (typeof sb === 'undefined' || !window.currentSession) {
        return { archetype: archetypeKey, report: localReport };
      }

      // Use fresh token from SDK (auto-refreshed) instead of cached session
      var freshSession = null;
      try {
        var _sesRes = await sb.auth.getSession();
        freshSession = _sesRes.data && _sesRes.data.session;
      } catch (_e) { /* fall through to local report */ }
      var token = freshSession ? freshSession.access_token : (window.currentSession && window.currentSession.access_token);
      var supabaseUrl = sb.supabaseUrl || '';

      if (!supabaseUrl) {
        return { archetype: archetypeKey, report: localReport };
      }

      var prompt = 'You are an elite basketball scout for CourtIQ. Analyze this player and produce a scouting report.\n\n' +
        'Player: ' + (data.name || 'Player') + ' | Age: ' + (data.age || '?') + ' | Height: ' + (data.height || '?') + '" | Weight: ' + (data.weight || '?') + 'lbs\n' +
        'Position: ' + (data.position || '?') + ' | Dominant Hand: ' + (data.hand || 'right') + '\n' +
        'Archetype: ' + (archetype ? archetype.name : archetypeKey) + '\n\n' +
        'Skill Self-Ratings (1-10):\n' +
        'Shooting: ' + (data.skills.shooting || 5) + '\n' +
        'Ball Handling: ' + (data.skills.ballhandling || 5) + '\n' +
        'Passing: ' + (data.skills.passing || 5) + '\n' +
        'Defense: ' + (data.skills.defense || 5) + '\n' +
        'Athleticism: ' + (data.skills.athleticism || 5) + '\n' +
        'Basketball IQ: ' + (data.skills.bbiq || 5) + '\n\n' +
        'Goals: ' + (data.goals ? data.goals.join(', ') : 'General improvement') + '\n\n' +
        'Return ONLY valid JSON:\n' +
        '{\n' +
        '  "player_grade": "A+|A|A-|B+|B|B-|C+|C",\n' +
        '  "strengths": ["<strength with detail>","<strength>","<strength>"],\n' +
        '  "development_areas": ["<area with recommendation>","<area>"],\n' +
        '  "training_focus": {"primary":"<focus>","secondary":"<focus>","weekly_split":{"shooting":25,"handles":20,"defense":20,"conditioning":15,"iq":20}},\n' +
        '  "suggested_drills": [{"name":"<drill>","focus":"<area>","frequency":"daily|3x/week|2x/week"}],\n' +
        '  "one_liner": "<scouting assessment in 12 words max>",\n' +
        '  "comp_player": "<NBA comparison with brief reasoning, max 20 words>"\n' +
        '}';

      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 20000);

      var res = await fetch(supabaseUrl + '/functions/v1/claude-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'apikey': token
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return { archetype: archetypeKey, report: localReport };
      }

      var json = await res.json();
      var text = '';
      if (json.content && json.content[0]) {
        text = json.content[0].text || '';
      } else if (json.text) {
        text = json.text;
      }

      // Extract JSON from response
      var match = text.match(/\{[\s\S]*\}/);
      if (match) {
        var aiReport = JSON.parse(match[0]);
        return { archetype: archetypeKey, report: aiReport };
      }

      return { archetype: archetypeKey, report: localReport };

    } catch (e) {
      console.warn('PlayerAnalysis: AI call failed, using local report', e);
      return { archetype: archetypeKey, report: localReport };
    }
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.PlayerAnalysis = {
    determineFromOnboarding: determineFromOnboarding,
    generateReport: generateReport,
    calcGrade: calcGrade,
    buildLocalReport: buildLocalReport
  };
})();
