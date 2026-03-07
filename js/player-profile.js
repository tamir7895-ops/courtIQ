/* ─── Player Profile System ───────────────────────────────── */
(function () {
  'use strict';

  var STORAGE_KEY = 'courtiq-player-profile';

  var POSITION_MAP = {
    PG: 'Point Guard',
    SG: 'Shooting Guard',
    SF: 'Small Forward',
    PF: 'Power Forward',
    C: 'Center'
  };

  var PlayerProfile = {

    load: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    save: function (data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        return false;
      }
    },

    renderSummary: function () {
      var container = document.getElementById('profile-summary-content');
      var data = this.load();

      if (!container) return;

      if (!data || !data.position) {
        container.innerHTML =
          '<div class="profile-summary-empty">' +
            '<span>👤</span>' +
            'Set up your player profile to get personalized training' +
          '</div>';
        return;
      }

      var pills = '';
      if (data.position) {
        pills += '<span class="profile-pill profile-pill--accent">' + data.position + '</span>';
      }
      if (data.height) {
        pills += '<span class="profile-pill"><span class="profile-pill-label">Height</span> ' + data.height + '"</span>';
      }
      if (data.age) {
        pills += '<span class="profile-pill"><span class="profile-pill-label">Age</span> ' + data.age + '</span>';
      }
      if (data.skillLevel) {
        pills += '<span class="profile-pill"><span class="profile-pill-label">Skill</span> ' + data.skillLevel + '</span>';
      }
      if (data.primaryGoal) {
        pills += '<span class="profile-pill"><span class="profile-pill-label">Goal</span> ' + data.primaryGoal + '</span>';
      }

      // Check for onboarding avatar
      var onboarding = null;
      try { onboarding = JSON.parse(localStorage.getItem('courtiq-onboarding-data')); } catch (e) {}
      var avatarHtml = '';
      if (onboarding && onboarding.avatar && typeof AvatarBuilder !== 'undefined') {
        avatarHtml = '<canvas id="profile-mini-avatar" width="48" height="48" style="border-radius:50%;flex-shrink:0;cursor:pointer" onclick="if(typeof AvatarCustomizer!==\'undefined\')AvatarCustomizer.open()" title="Customize Avatar"></canvas>';
      } else {
        avatarHtml = '<div class="profile-summary-avatar">' + data.position + '</div>';
      }

      // Add archetype badge if available
      var archetypePill = '';
      if (onboarding && onboarding.archetype && typeof ArchetypeEngine !== 'undefined' && ArchetypeEngine.ARCHETYPES) {
        var arch = ArchetypeEngine.ARCHETYPES[onboarding.archetype];
        if (arch) {
          archetypePill = '<span class="profile-pill profile-pill--accent">' + arch.icon + ' ' + arch.name + '</span>';
        }
      }

      container.innerHTML =
        '<div class="profile-summary-info">' +
          avatarHtml +
          '<div class="profile-summary-pills">' + archetypePill + pills + '</div>' +
        '</div>';

      // Draw mini avatar after DOM insert
      if (onboarding && onboarding.avatar && typeof AvatarBuilder !== 'undefined') {
        setTimeout(function () {
          var c = document.getElementById('profile-mini-avatar');
          if (c) AvatarBuilder.drawMini(c, onboarding.avatar);
        }, 0);
      }
    },

    openEditor: function () {
      var overlay = document.getElementById('profile-modal-overlay');
      if (!overlay) return;

      this.initForm();
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    },

    closeEditor: function () {
      var overlay = document.getElementById('profile-modal-overlay');
      if (!overlay) return;

      overlay.classList.remove('active');
      document.body.style.overflow = '';
    },

    initForm: function () {
      var data = this.load();
      if (!data) data = {};

      var nameEl = document.getElementById('pp-name');
      var pos = document.getElementById('pp-position');
      var height = document.getElementById('pp-height');
      var age = document.getElementById('pp-age');
      var skill = document.getElementById('pp-skill');
      var goal = document.getElementById('pp-goal');

      if (nameEl) nameEl.value = data.name || '';
      if (pos) pos.value = data.position || '';
      if (height) height.value = data.height || '';
      if (age) age.value = data.age || '';
      if (skill) skill.value = data.skillLevel || '';
      if (goal) goal.value = data.primaryGoal || '';
    },

    handleSubmit: function () {
      var nameEl = document.getElementById('pp-name');
      var pos = document.getElementById('pp-position');
      var height = document.getElementById('pp-height');
      var age = document.getElementById('pp-age');
      var skill = document.getElementById('pp-skill');
      var goal = document.getElementById('pp-goal');

      var data = {
        name: nameEl ? nameEl.value.trim() : '',
        position: pos ? pos.value : '',
        height: height ? height.value : '',
        age: age ? age.value : '',
        skillLevel: skill ? skill.value : '',
        primaryGoal: goal ? goal.value : ''
      };

      if (!data.position) {
        if (pos) { pos.focus(); }
        return;
      }

      this.save(data);
      this.renderSummary();
      this.closeEditor();

      // Sync name to dashboard fields if present
      if (data.name) {
        var dbPlayer = document.getElementById('db-player');
        if (dbPlayer) dbPlayer.value = data.name;
        var notifName = document.getElementById('notif-name');
        if (notifName) notifName.value = data.name;
        var sidebarName = document.getElementById('db-sidebar-name');
        if (sidebarName) sidebarName.textContent = data.name;
      }

      // Sync position to dashboard select if present
      var dbPos = document.getElementById('db-position');
      if (dbPos && data.position && POSITION_MAP[data.position]) {
        var fullName = POSITION_MAP[data.position];
        for (var i = 0; i < dbPos.options.length; i++) {
          if (dbPos.options[i].text === fullName) {
            dbPos.selectedIndex = i;
            break;
          }
        }
      }

      // Sync updated profile to drill generator
      this.syncToDrillGenerator();

      if (typeof showToast === 'function') {
        showToast('Profile saved');
      }
    },

    syncToDrillGenerator: function () {
      var data = this.load();
      if (!data) return;

      var posEl  = document.getElementById('drill-position');
      var skillEl = document.getElementById('drill-skill');
      var goalEl  = document.getElementById('drill-goal');

      if (posEl && data.position)     posEl.value = data.position;
      if (skillEl && data.skillLevel) skillEl.value = data.skillLevel;
      if (goalEl && data.primaryGoal) goalEl.value = data.primaryGoal;
    },

    init: function () {
      var self = this;

      // Render summary on load
      this.renderSummary();

      // Sync profile to drill generator fields
      this.syncToDrillGenerator();

      // Edit button
      var editBtn = document.getElementById('profile-edit-btn');
      if (editBtn) {
        editBtn.addEventListener('click', function () { self.openEditor(); });
      }

      // Modal close button
      var closeBtn = document.getElementById('profile-modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () { self.closeEditor(); });
      }

      // Overlay click to close
      var overlay = document.getElementById('profile-modal-overlay');
      if (overlay) {
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay) self.closeEditor();
        });
      }

      // Save button
      var saveBtn = document.getElementById('profile-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () { self.handleSubmit(); });
      }

      // Cancel button
      var cancelBtn = document.getElementById('profile-cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () { self.closeEditor(); });
      }

      // Restart full setup button
      var restartBtn = document.getElementById('profile-restart-btn');
      if (restartBtn) {
        restartBtn.addEventListener('click', function () {
          if (typeof Onboarding !== 'undefined' && Onboarding.restart) {
            Onboarding.restart();
          }
        });
      }

      // Escape key
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
          self.closeEditor();
        }
      });
    }
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { PlayerProfile.init(); });
  } else {
    PlayerProfile.init();
  }

  window.PlayerProfile = PlayerProfile;
})();
