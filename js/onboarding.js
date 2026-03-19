/* ============================================================
   ONBOARDING FLOW — /js/onboarding.js
   Multi-step player profile builder orchestrator.
   Manages steps, validation, data, transitions, and finish.
   ============================================================ */
(function () {
  'use strict';

  var TOTAL_STEPS = 5;
  var current = 1;
  var direction = 'forward';
  var data = {};
  var radarChart = null;
  var analysisResult = null;

  /* ═══════════════════════════════════════════════════════════
     LAUNCH — show overlay, init step 1
  ═══════════════════════════════════════════════════════════ */
  function launch() {
    var overlay = document.getElementById('ob-overlay');
    if (!overlay) return;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Pre-fill name from auth
    if (window.currentUser && window.currentUser.user_metadata) {
      var nameInput = document.getElementById('ob-name');
      if (nameInput && window.currentUser.user_metadata.first_name) {
        nameInput.value = window.currentUser.user_metadata.first_name;
      }
    }

    current = 1;
    updateProgress();
    showStep(1);
    updateNav();
  }

  /* ═══════════════════════════════════════════════════════════
     STEP NAVIGATION
  ═══════════════════════════════════════════════════════════ */
  function showStep(n) {
    document.querySelectorAll('.ob-step').forEach(function (s) {
      s.classList.remove('active', 'ob-exit');
    });

    // Map logical step to HTML element ID
    // Steps 1-4 map directly; step 5 shows the analysis loading (ob-step-6)
    var htmlStepId = n <= 4 ? n : 6;
    var step = document.getElementById('ob-step-' + htmlStepId);
    if (step) {
      step.classList.add('active');
      if (direction === 'back') {
        step.style.animation = 'none';
        step.offsetHeight; // reflow
        step.style.animation = 'ob-enter-back 0.4s cubic-bezier(0.4,0,0.2,1) forwards';
      }
    }

    // Init step-specific features
    if (n === 3 && !radarChart) initRadar();
    if (n === 5) runAnalysis();
  }

  function nextStep() {
    if (!validateStep(current)) return;
    collectStepData(current);

    if (current >= TOTAL_STEPS) {
      finish();
      return;
    }

    direction = 'forward';
    var prev = document.getElementById('ob-step-' + current);
    if (prev) {
      prev.classList.add('ob-exit');
    }

    setTimeout(function () {
      current++;
      updateProgress();
      showStep(current);
      updateNav();
    }, 250);
  }

  function prevStep() {
    if (current <= 1) return;
    direction = 'back';
    var prev = document.getElementById('ob-step-' + current);
    if (prev) prev.classList.remove('active');

    current--;
    updateProgress();
    showStep(current);
    updateNav();
  }

  var STEP_NAMES = [
    'Basic Info', 'Play Style', 'Skills', 'Goals',
    'Scouting Report'
  ];

  function updateProgress() {
    var pct = Math.round(((current - 1) / (TOTAL_STEPS - 1)) * 100);
    var fill = document.getElementById('ob-progress-fill');
    if (fill) fill.style.width = pct + '%';

    document.querySelectorAll('.ob-dot').forEach(function (d, i) {
      d.classList.toggle('active', i === current - 1);
      d.classList.toggle('done', i < current - 1);
    });

    // Update label
    var nameEl    = document.getElementById('ob-progress-step-name');
    var counterEl = document.getElementById('ob-progress-counter');
    var pctEl     = document.getElementById('ob-progress-pct');
    if (nameEl)    nameEl.textContent    = STEP_NAMES[current - 1] || '';
    if (counterEl) counterEl.textContent = current + ' / ' + TOTAL_STEPS;
    if (pctEl)     pctEl.textContent     = pct + '%';
  }

  function updateNav() {
    var backBtn = document.getElementById('ob-btn-back');
    var nextBtn = document.getElementById('ob-btn-next');
    if (!backBtn || !nextBtn) return;

    backBtn.style.display = current <= 1 ? 'none' : '';

    if (current === 5) {
      // Analysis/Report step — hide nav during analysis, show finish after
      backBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = '';
      nextBtn.textContent = current === 4 ? 'ANALYZE MY GAME \u2192' : 'NEXT \u2192';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     VALIDATION
  ═══════════════════════════════════════════════════════════ */
  function validateStep(n) {
    clearErrors();
    switch (n) {
      case 1: return validateBasicInfo();
      case 2: return validatePlaystyle();
      case 3: return true; // sliders always valid
      case 4: return validateGoals();
      case 5: return true; // report
    }
    return true;
  }

  function validateBasicInfo() {
    var valid = true;
    var name = document.getElementById('ob-name');
    if (!name || !name.value.trim()) {
      showFieldError('ob-name', 'Name is required');
      valid = false;
    }
    var age = document.getElementById('ob-age');
    if (!age || !age.value || age.value < 8 || age.value > 99) {
      showFieldError('ob-age', 'Enter a valid age (8-99)');
      valid = false;
    }
    if (!document.querySelector('.ob-position-card.selected')) {
      valid = false;
      if (typeof showToast === 'function') showToast('Select your position', true);
    }
    return valid;
  }

  function validatePlaystyle() {
    var questions = document.querySelectorAll('.ob-question');
    var allAnswered = true;
    questions.forEach(function (q) {
      if (!q.querySelector('.ob-choice.selected')) allAnswered = false;
    });
    if (!allAnswered && typeof showToast === 'function') {
      showToast('Answer all questions', true);
    }
    return allAnswered;
  }

  function validateGoals() {
    var selected = document.querySelectorAll('.ob-goal-chip.selected');
    if (selected.length === 0) {
      if (typeof showToast === 'function') showToast('Select at least one goal', true);
      return false;
    }
    return true;
  }

  function showFieldError(id, msg) {
    var field = document.getElementById(id);
    if (field) {
      var parent = field.closest('.ob-field');
      if (parent) {
        parent.classList.add('has-error');
        var err = parent.querySelector('.ob-error');
        if (err) err.textContent = msg;
      }
    }
  }

  function clearErrors() {
    document.querySelectorAll('.ob-field.has-error').forEach(function (f) {
      f.classList.remove('has-error');
    });
  }

  /* ═══════════════════════════════════════════════════════════
     DATA COLLECTION
  ═══════════════════════════════════════════════════════════ */
  function collectStepData(n) {
    switch (n) {
      case 1:
        data.name = (document.getElementById('ob-name').value || '').trim();
        data.age = parseInt(document.getElementById('ob-age').value) || 0;
        var rawH = parseInt(document.getElementById('ob-height').value) || 72;
        var hUnit = document.getElementById('ob-height-unit');
        data.heightUnit = hUnit ? hUnit.dataset.unit : 'in';
        data.height = data.heightUnit === 'cm' ? Math.round(rawH / 2.54) : rawH;
        var rawW = parseInt(document.getElementById('ob-weight').value) || 0;
        var wUnit = document.getElementById('ob-weight-unit');
        data.weightUnit = wUnit ? wUnit.dataset.unit : 'lbs';
        data.weight = data.weightUnit === 'kg' ? Math.round(rawW / 0.4536) : rawW;
        var handBtn = document.querySelector('.ob-hand-btn.selected');
        data.hand = handBtn ? handBtn.dataset.hand : 'right';
        var posCard = document.querySelector('.ob-position-card.selected');
        data.position = posCard ? posCard.dataset.pos : '';
        break;

      case 2:
        data.playstyle = {};
        document.querySelectorAll('.ob-question').forEach(function (q) {
          var key = q.dataset.key;
          var sel = q.querySelector('.ob-choice.selected');
          if (key && sel) data.playstyle[key] = sel.dataset.value;
        });
        break;

      case 3:
        data.skills = {};
        document.querySelectorAll('.ob-slider').forEach(function (s) {
          data.skills[s.dataset.skill] = parseInt(s.value) || 5;
        });
        break;

      case 4:
        data.goals = [];
        document.querySelectorAll('.ob-goal-chip.selected').forEach(function (c) {
          data.goals.push(c.dataset.goal);
        });
        break;

      /* Avatar customization moved to profile — set defaults */
      case 5:
        if (!data.avatar) {
          data.avatar = {
            skinTone: 'edb98a',
            hairStyle: 'shortFlat',
            hairColor: '2c1b18',
            beardStyle: 'none',
            bodyType: 'athletic',
            accessory: 'none'
          };
        }
        break;
    }
  }

  function getPickerValue(group) {
    var sel = document.querySelector('[data-picker="' + group + '"].selected');
    return sel ? sel.dataset.value : null;
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 3 — RADAR CHART
  ═══════════════════════════════════════════════════════════ */
  function initRadar() {
    var ctx = document.getElementById('ob-radar-canvas');
    if (!ctx || typeof Chart === 'undefined') return;

    radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Shooting', 'Ball Handling', 'Passing', 'Defense', 'Athleticism', 'Basketball IQ'],
        datasets: [{
          data: [5, 5, 5, 5, 5, 5],
          backgroundColor: 'rgba(245,166,35,0.1)',
          borderColor: '#f5a623',
          borderWidth: 2,
          pointBackgroundColor: '#f5a623',
          pointBorderColor: '#f5a623',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0, max: 10,
            ticks: {
              stepSize: 2,
              color: 'rgba(240,237,230,0.25)',
              backdropColor: 'transparent',
              font: { size: 9 }
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
            angleLines: { color: 'rgba(255,255,255,0.06)' },
            pointLabels: {
              color: 'rgba(240,237,230,0.55)',
              font: { family: "'Barlow Condensed', sans-serif", size: 11, weight: '600' }
            }
          }
        }
      }
    });
  }

  function updateRadar() {
    if (!radarChart) return;
    var skills = ['shooting', 'ballhandling', 'passing', 'defense', 'athleticism', 'bbiq'];
    var values = skills.map(function (s) {
      var el = document.getElementById('ob-skill-' + s);
      return el ? parseInt(el.value) : 5;
    });
    radarChart.data.datasets[0].data = values;
    radarChart.update('none');
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 5 — AVATAR
  ═══════════════════════════════════════════════════════════ */
  function initAvatar() {
    redrawAvatar();
  }

  function redrawAvatar() {
    var container = document.getElementById('ob-avatar-container');
    if (!container) return;

    var cfg = {
      skinTone: getPickerValue('skinTone') || 'edb98a',
      hairStyle: getPickerValue('hairStyle') || 'shortFlat',
      hairColor: getPickerValue('hairColor') || '2c1b18',
      beardStyle: getPickerValue('beardStyle') || 'none',
      bodyType: getPickerValue('bodyType') || 'athletic',
      accessory: getPickerValue('accessory') || 'none',
      position: data.position || 'SG'
    };

    // Use DiceBear bridge
    if (typeof AvatarBridge !== 'undefined') {
      AvatarBridge.render(container, cfg, { width: 200, height: 280 });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 6 — AI ANALYSIS
  ═══════════════════════════════════════════════════════════ */
  var loadingTexts = [
    'Analyzing your game\u2026',
    'Running the numbers\u2026',
    'Evaluating your strengths\u2026',
    'Building your scouting report\u2026',
    'Comparing against NBA archetypes\u2026'
  ];

  async function runAnalysis() {
    // Animate loading text
    var textEl = document.getElementById('ob-loading-text');
    var textIdx = 0;
    var textInterval = setInterval(function () {
      textIdx = (textIdx + 1) % loadingTexts.length;
      if (textEl) textEl.textContent = loadingTexts[textIdx];
    }, 1800);

    try {
      analysisResult = await PlayerAnalysis.generateReport(data);
    } catch (e) {
      console.warn('Onboarding analysis error:', e);
      analysisResult = {
        archetype: PlayerAnalysis.determineFromOnboarding(data),
        report: PlayerAnalysis.buildLocalReport(data, PlayerAnalysis.determineFromOnboarding(data))
      };
    }

    clearInterval(textInterval);
    data.archetype = analysisResult.archetype;
    data.scoutingReport = analysisResult.report;

    // Grant XP
    if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
      XPSystem.grantXP(50, 'Scouting Report Unlocked');
    }

    // Render report in-place on step 5
    renderScoutingReport();

    // Hide loading, show report content
    var loadingEl = document.getElementById('ob-step-6');
    var reportEl = document.getElementById('ob-step-7');
    if (loadingEl) loadingEl.classList.remove('active');
    if (reportEl) reportEl.classList.add('active');

    // Show finish button
    var nextBtn = document.getElementById('ob-btn-next');
    if (nextBtn) {
      nextBtn.style.display = '';
      nextBtn.textContent = 'ENTER THE COURT \u2192';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     STEP 7 — SCOUTING REPORT
  ═══════════════════════════════════════════════════════════ */
  function renderScoutingReport() {
    var container = document.getElementById('ob-report-content');
    if (!container || !analysisResult) return;

    var r = analysisResult.report;
    var archetypeKey = analysisResult.archetype;
    var archetype = null;
    if (typeof ArchetypeEngine !== 'undefined' && ArchetypeEngine.ARCHETYPES) {
      archetype = ArchetypeEngine.ARCHETYPES[archetypeKey];
    }

    var html = '';

    // Header: avatar + name + archetype
    html += '<div class="ob-report-header">';
    html += '<div class="ob-report-avatar"><div id="ob-report-avatar-container" style="width:120px;height:120px;border-radius:50%;overflow:hidden;background:rgba(245,166,35,0.1);display:flex;align-items:center;justify-content:center;font-size:48px">🏀</div></div>';
    html += '<div class="ob-report-info">';
    html += '<div class="ob-report-name">' + esc(data.name || 'Player') + '</div>';
    html += '<div class="ob-report-archetype">' + (archetype ? archetype.icon + ' ' : '') + (archetype ? archetype.name : archetypeKey) + '</div>';
    html += '<div style="margin-top:12px"><div class="ob-report-grade">' + esc(r.player_grade || 'B+') + '</div>';
    html += '<div class="ob-report-grade-label">Player Grade</div></div>';
    html += '</div></div>';

    // Strengths
    html += '<div class="ob-report-section">';
    html += '<div class="ob-report-section-title">Strengths</div>';
    (r.strengths || []).forEach(function (s) {
      html += '<div class="ob-report-item"><span class="ob-report-item-icon">\u25B2</span>' + esc(s) + '</div>';
    });
    html += '</div>';

    // Development areas
    html += '<div class="ob-report-section">';
    html += '<div class="ob-report-section-title">Development Areas</div>';
    (r.development_areas || []).forEach(function (d) {
      html += '<div class="ob-report-item weakness"><span class="ob-report-item-icon">\u25BC</span>' + esc(d) + '</div>';
    });
    html += '</div>';

    // Training focus
    if (r.training_focus) {
      html += '<div class="ob-report-section">';
      html += '<div class="ob-report-section-title">Training Focus</div>';
      html += '<div class="ob-report-item"><span class="ob-report-item-icon">\u25C6</span><strong>Primary:</strong>&nbsp;' + esc(r.training_focus.primary || '') + '</div>';
      html += '<div class="ob-report-item"><span class="ob-report-item-icon">\u25C7</span><strong>Secondary:</strong>&nbsp;' + esc(r.training_focus.secondary || '') + '</div>';
      html += '</div>';
    }

    // Suggested drills
    if (r.suggested_drills && r.suggested_drills.length) {
      html += '<div class="ob-report-section">';
      html += '<div class="ob-report-section-title">Suggested Drills</div>';
      html += '<div class="ob-report-drills">';
      r.suggested_drills.forEach(function (d) {
        html += '<div class="ob-report-drill">';
        html += '<span style="font-size:18px">\uD83C\uDFC0</span>';
        html += '<div class="ob-report-drill-name">' + esc(d.name || '') + '</div>';
        html += '<div class="ob-report-drill-freq">' + esc(d.frequency || '') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    // NBA comparison
    if (r.comp_player) {
      html += '<div class="ob-report-comp">';
      html += '<strong>Scout\u2019s Note:</strong> ' + esc(r.comp_player);
      if (r.one_liner) html += '<br><em style="color:rgba(240,237,230,0.4);font-size:13px">"' + esc(r.one_liner) + '"</em>';
      html += '</div>';
    }

    container.innerHTML = html;

    // Draw DiceBear avatar on report
    setTimeout(function () {
      var reportEl = document.getElementById('ob-report-avatar-container');
      if (reportEl) {
        var avatarUrl = localStorage.getItem('courtiq_avatar_url');
        if (!avatarUrl) {
          try { var od = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}'); avatarUrl = od.dicebear_avatar_url; } catch(e) {}
        }
        if (avatarUrl && typeof AvatarCustomizer !== 'undefined' && AvatarCustomizer.injectAvatarIntoEl) {
          AvatarCustomizer.injectAvatarIntoEl(reportEl, avatarUrl, '120px', '120px');
        } else if (avatarUrl) {
          var img = document.createElement('img');
          img.src = avatarUrl; img.alt = 'Avatar';
          img.style.cssText = 'width:120px;height:120px;object-fit:cover;border-radius:50%;object-position:center top;';
          reportEl.textContent = '';
          reportEl.appendChild(img);
        }
      }
    }, 50);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ═══════════════════════════════════════════════════════════
     FINISH — save data, close overlay, resume dashboard
  ═══════════════════════════════════════════════════════════ */
  function finish() {
    data.ts = Date.now();

    // Save onboarding data
    try {
      localStorage.setItem('courtiq-onboarding-data', JSON.stringify(data));
    } catch (e) { console.warn('Onboarding save error:', e); }

    // Set completion flag
    localStorage.setItem('courtiq-onboarding-complete', String(Date.now()));

    // Write backward-compatible profile
    var skillAvg = 5;
    if (data.skills) {
      var vals = Object.values(data.skills);
      skillAvg = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
    }
    var skillLevel = skillAvg >= 7 ? 'Advanced' : skillAvg >= 4 ? 'Intermediate' : 'Beginner';

    try {
      localStorage.setItem('courtiq-player-profile', JSON.stringify({
        position: data.position || '',
        height: String(data.height || ''),
        age: String(data.age || ''),
        skillLevel: skillLevel,
        primaryGoal: data.goals ? data.goals[0] : ''
      }));
    } catch (e) { /* ignore */ }

    // Save archetype
    if (data.archetype) {
      try {
        localStorage.setItem('courtiq-archetype', JSON.stringify({
          key: data.archetype,
          ts: Date.now()
        }));
      } catch (e) { /* ignore */ }
    }

    // Async write-through to Supabase (non-blocking)
    if (window.currentUser && typeof DataService !== 'undefined') {
      DataService.saveUserData({
        onboarding_data: data,
        archetype: data.archetype || null,
        avatar: data.avatar || null
      }).catch(function (e) { console.warn('Supabase onboarding sync error:', e); });
    }

    // Close overlay
    var overlay = document.getElementById('ob-overlay');
    if (overlay) {
      overlay.style.transition = 'opacity 0.5s ease';
      overlay.style.opacity = '0';
      setTimeout(function () {
        overlay.classList.remove('active');
        overlay.style.opacity = '';
        overlay.style.transition = '';
        document.body.style.overflow = '';
      }, 500);
    }

    // Show welcome toast
    if (typeof showToast === 'function') {
      setTimeout(function () { showToast('Welcome to CourtIQ, ' + (data.name || 'Player') + '!'); }, 800);
    }

    // Resume dashboard
    if (typeof initDashboard === 'function') {
      setTimeout(function () { initDashboard(); }, 600);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     EVENT WIRING
  ═══════════════════════════════════════════════════════════ */
  function init() {
    // Nav buttons
    var nextBtn = document.getElementById('ob-btn-next');
    var backBtn = document.getElementById('ob-btn-back');
    if (nextBtn) nextBtn.addEventListener('click', nextStep);
    if (backBtn) backBtn.addEventListener('click', prevStep);

    // Position cards
    document.querySelectorAll('.ob-position-card').forEach(function (card) {
      card.addEventListener('click', function () {
        document.querySelectorAll('.ob-position-card').forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
      });
    });

    // Hand toggle
    document.querySelectorAll('.ob-hand-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.ob-hand-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
    });

    // Unit toggles (height: in/cm, weight: lbs/kg)
    var heightUnitBtn = document.getElementById('ob-height-unit');
    var weightUnitBtn = document.getElementById('ob-weight-unit');
    var heightInput = document.getElementById('ob-height');
    var weightInput = document.getElementById('ob-weight');

    if (heightUnitBtn && heightInput) {
      heightUnitBtn.addEventListener('click', function () {
        var cur = heightUnitBtn.dataset.unit;
        var val = parseFloat(heightInput.value) || 0;
        if (cur === 'in') {
          heightUnitBtn.dataset.unit = 'cm';
          heightUnitBtn.textContent = 'cm / in';
          heightInput.placeholder = '188';
          heightInput.min = '120'; heightInput.max = '250';
          if (val) heightInput.value = Math.round(val * 2.54);
        } else {
          heightUnitBtn.dataset.unit = 'in';
          heightUnitBtn.textContent = 'in / cm';
          heightInput.placeholder = '74';
          heightInput.min = '48'; heightInput.max = '96';
          if (val) heightInput.value = Math.round(val / 2.54);
        }
      });
    }

    if (weightUnitBtn && weightInput) {
      weightUnitBtn.addEventListener('click', function () {
        var cur = weightUnitBtn.dataset.unit;
        var val = parseFloat(weightInput.value) || 0;
        if (cur === 'lbs') {
          weightUnitBtn.dataset.unit = 'kg';
          weightUnitBtn.textContent = 'kg / lbs';
          weightInput.placeholder = '84';
          weightInput.min = '30'; weightInput.max = '180';
          if (val) weightInput.value = Math.round(val * 0.4536);
        } else {
          weightUnitBtn.dataset.unit = 'lbs';
          weightUnitBtn.textContent = 'lbs / kg';
          weightInput.placeholder = '185';
          weightInput.min = '60'; weightInput.max = '400';
          if (val) weightInput.value = Math.round(val / 0.4536);
        }
      });
    }

    // Playstyle choices
    document.querySelectorAll('.ob-question').forEach(function (q) {
      q.querySelectorAll('.ob-choice').forEach(function (c) {
        c.addEventListener('click', function () {
          q.querySelectorAll('.ob-choice').forEach(function (x) { x.classList.remove('selected'); });
          c.classList.add('selected');
        });
      });
    });

    // Skill sliders
    document.querySelectorAll('.ob-slider').forEach(function (s) {
      s.addEventListener('input', function () {
        var valEl = document.getElementById('ob-val-' + s.dataset.skill);
        if (valEl) valEl.textContent = s.value;
        updateRadar();
      });
    });

    // Goal chips
    document.querySelectorAll('.ob-goal-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var selected = document.querySelectorAll('.ob-goal-chip.selected').length;
        if (chip.classList.contains('selected')) {
          chip.classList.remove('selected');
        } else if (selected < 3) {
          chip.classList.add('selected');
        } else {
          if (typeof showToast === 'function') showToast('Max 3 goals', true);
        }
      });
    });

    // Avatar pickers — color swatches
    document.querySelectorAll('.ob-swatch').forEach(function (sw) {
      sw.addEventListener('click', function () {
        var group = sw.dataset.picker;
        document.querySelectorAll('[data-picker="' + group + '"].ob-swatch').forEach(function (s) {
          s.classList.remove('selected');
        });
        sw.classList.add('selected');
        redrawAvatar();
      });
    });

    // Avatar pickers — style buttons
    document.querySelectorAll('.ob-style-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.dataset.picker;
        document.querySelectorAll('[data-picker="' + group + '"].ob-style-btn').forEach(function (b) {
          b.classList.remove('selected');
        });
        btn.classList.add('selected');
        redrawAvatar();
      });
    });
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ═══════════════════════════════════════════════════════════
     RESTART — clear all data and re-launch from step 1
  ═══════════════════════════════════════════════════════════ */
  function restart() {
    // Clear all stored onboarding / profile data
    localStorage.removeItem('courtiq-onboarding-complete');
    localStorage.removeItem('courtiq-onboarding-data');
    localStorage.removeItem('courtiq-player-profile');
    localStorage.removeItem('courtiq-archetype');

    // Reset internal state
    current = 1;
    direction = 'forward';
    data = {};
    analysisResult = null;
    if (radarChart) {
      radarChart.data.datasets[0].data = [5, 5, 5, 5, 5, 5];
      radarChart.update('none');
    }

    // Reset all form fields in the onboarding overlay
    // Step 1 — basic info
    var nameEl = document.getElementById('ob-name');
    if (nameEl) nameEl.value = '';
    var ageEl = document.getElementById('ob-age');
    if (ageEl) ageEl.value = '';
    var heightEl = document.getElementById('ob-height');
    if (heightEl) heightEl.value = '72';
    var weightEl = document.getElementById('ob-weight');
    if (weightEl) weightEl.value = '';

    document.querySelectorAll('.ob-position-card.selected').forEach(function (c) { c.classList.remove('selected'); });
    document.querySelectorAll('.ob-hand-btn.selected').forEach(function (b) { b.classList.remove('selected'); });
    // Default to right hand
    var rightBtn = document.querySelector('.ob-hand-btn[data-hand="right"]');
    if (rightBtn) rightBtn.classList.add('selected');

    // Step 2 — playstyle
    document.querySelectorAll('.ob-choice.selected').forEach(function (c) { c.classList.remove('selected'); });

    // Step 3 — skill sliders
    document.querySelectorAll('.ob-slider').forEach(function (s) {
      s.value = 5;
      var valEl = document.getElementById('ob-val-' + s.dataset.skill);
      if (valEl) valEl.textContent = '5';
    });

    // Step 4 — goals
    document.querySelectorAll('.ob-goal-chip.selected').forEach(function (c) { c.classList.remove('selected'); });

    // Step 5 — avatar pickers
    document.querySelectorAll('.ob-swatch.selected, .ob-style-btn.selected').forEach(function (s) { s.classList.remove('selected'); });
    // Re-select defaults
    var defaultSkin = document.querySelector('.ob-swatch[data-picker="skinTone"]');
    if (defaultSkin) defaultSkin.classList.add('selected');
    var defaultHair = document.querySelector('.ob-style-btn[data-picker="hairStyle"]');
    if (defaultHair) defaultHair.classList.add('selected');
    var defaultHairColor = document.querySelector('.ob-swatch[data-picker="hairColor"]');
    if (defaultHairColor) defaultHairColor.classList.add('selected');
    var defaultBeard = document.querySelector('.ob-style-btn[data-picker="beardStyle"]');
    if (defaultBeard) defaultBeard.classList.add('selected');
    var defaultBody = document.querySelector('.ob-style-btn[data-picker="bodyType"]');
    if (defaultBody) defaultBody.classList.add('selected');

    // Step 7 — scouting report
    var reportContent = document.getElementById('ob-report-content');
    if (reportContent) reportContent.innerHTML = '';

    // Close profile modal if open
    var profileOverlay = document.getElementById('profile-modal-overlay');
    if (profileOverlay) {
      profileOverlay.classList.remove('active');
    }
    document.body.style.overflow = '';

    // Launch onboarding from step 1
    launch();

    // Pre-fill name from auth again
    if (window.currentUser && window.currentUser.user_metadata) {
      var nameInput = document.getElementById('ob-name');
      if (nameInput && window.currentUser.user_metadata.first_name) {
        nameInput.value = window.currentUser.user_metadata.first_name;
      }
    }
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.Onboarding = {
    launch: launch,
    finish: finish,
    restart: restart,
    getData: function () { return data; }
  };
})();
