/* ============================================================
   NOTIFICATION MANAGER — js/notifications.js
   Local browser notifications for training reminders,
   streak warnings, and weekly summaries.
   ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'courtiq-notif-prefs';
  var _scheduledTimers = [];

  /* ── Default preferences ───────────────────────────────── */
  function defaults() {
    return {
      permissionGranted: false,
      dailyReminder: { enabled: true, hour: 17, minute: 0 },
      streakWarning: { enabled: true },
      weeklySummary: { enabled: true, dayOfWeek: 0 },
      lastScheduled: null
    };
  }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? Object.assign(defaults(), JSON.parse(raw)) : defaults();
    } catch (e) { return defaults(); }
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  /* ── Permission request ────────────────────────────────── */
  function isSupported() {
    return 'Notification' in window;
  }

  function hasPermission() {
    return isSupported() && Notification.permission === 'granted';
  }

  async function requestPermission() {
    if (!isSupported()) return false;
    if (Notification.permission === 'granted') {
      var prefs = loadPrefs();
      prefs.permissionGranted = true;
      savePrefs(prefs);
      return true;
    }
    if (Notification.permission === 'denied') return false;

    var result = await Notification.requestPermission();
    var prefs = loadPrefs();
    prefs.permissionGranted = result === 'granted';
    savePrefs(prefs);
    return result === 'granted';
  }

  /* ── Show notification ─────────────────────────────────── */
  function show(title, body, tag) {
    if (!hasPermission()) return;

    // Try service worker notification first (works in background)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification(title, {
          body: body,
          icon: 'assets/logo-icon.svg',
          badge: 'icons/icon-192.png',
          tag: tag || 'courtiq-' + Date.now(),
          vibrate: [200, 100, 200]
        });
      });
    } else {
      // Fallback: in-page notification
      new Notification(title, { body: body, icon: 'assets/logo-icon.svg', tag: tag || undefined });
    }
  }

  /* ── Schedule daily reminder ───────────────────────────── */
  function scheduleDailyReminder() {
    var prefs = loadPrefs();
    if (!prefs.dailyReminder.enabled || !prefs.permissionGranted) return;

    // Clear existing timers
    _scheduledTimers.forEach(function (t) { clearTimeout(t); });
    _scheduledTimers = [];

    var now = new Date();
    var target = new Date();
    target.setHours(prefs.dailyReminder.hour, prefs.dailyReminder.minute, 0, 0);

    // If time already passed today, schedule for tomorrow
    if (target <= now) target.setDate(target.getDate() + 1);

    var delay = target.getTime() - now.getTime();
    var timer = setTimeout(function () {
      show(
        'Time to Train! \uD83C\uDFC0',
        'Keep your streak going \u2014 your daily workout is waiting.',
        'courtiq-daily-reminder'
      );
      prefs.lastScheduled = new Date().toISOString();
      savePrefs(prefs);
      // Reschedule for next day
      scheduleDailyReminder();
    }, delay);

    _scheduledTimers.push(timer);
  }

  /* ── Streak warning ────────────────────────────────────── */
  function scheduleStreakWarning() {
    var prefs = loadPrefs();
    if (!prefs.streakWarning.enabled || !prefs.permissionGranted) return;

    // Check if user has trained today
    var streakData = null;
    try { streakData = JSON.parse(localStorage.getItem('courtiq-streak')); } catch (e) {}
    var today = new Date().toISOString().slice(0, 10);
    if (streakData && streakData.lastDate === today) return; // Already trained

    var currentStreak = (streakData && streakData.current) || 0;
    if (currentStreak < 2) return; // Not worth warning about

    // Schedule for 6PM if not yet past
    var now = new Date();
    if (now.getHours() >= 18) {
      // It's past 6PM and no training — show now
      show(
        'Streak at Risk! \uD83D\uDD25',
        'Your ' + currentStreak + '-day streak is about to break. Train today to keep it alive!',
        'courtiq-streak-warning'
      );
    } else {
      var target = new Date();
      target.setHours(18, 0, 0, 0);
      var delay = target.getTime() - now.getTime();
      var timer = setTimeout(function () {
        // Re-check if trained
        var fresh = null;
        try { fresh = JSON.parse(localStorage.getItem('courtiq-streak')); } catch (e) {}
        if (fresh && fresh.lastDate === new Date().toISOString().slice(0, 10)) return;
        show(
          'Streak at Risk! \uD83D\uDD25',
          'Your ' + currentStreak + '-day streak is about to break. Train today!',
          'courtiq-streak-warning'
        );
      }, delay);
      _scheduledTimers.push(timer);
    }
  }

  /* ── Level up notification ─────────────────────────────── */
  function showLevelUpNotification(level) {
    if (!hasPermission()) return;
    show(
      'Level Up! ' + (level.icon || '\u2B50'),
      'You reached ' + (level.name || 'a new level') + '! Keep grinding.',
      'courtiq-levelup'
    );
  }

  /* ── Weekly summary notification ───────────────────────── */
  function checkWeeklySummary() {
    var prefs = loadPrefs();
    if (!prefs.weeklySummary.enabled || !prefs.permissionGranted) return;

    var now = new Date();
    if (now.getDay() !== prefs.weeklySummary.dayOfWeek) return;

    // Only show once per day
    var lastKey = 'courtiq-weekly-notif-' + now.toISOString().slice(0, 10);
    if (localStorage.getItem(lastKey)) return;
    localStorage.setItem(lastKey, '1');

    var xpData = null;
    try { xpData = JSON.parse(localStorage.getItem('courtiq-xp')); } catch (e) {}
    var totalXP = (xpData && xpData.xp) || 0;

    show(
      'Weekly Summary Ready \uD83D\uDCCA',
      'You have ' + totalXP + ' XP total. Check your Weekly Summary for insights.',
      'courtiq-weekly-summary'
    );
  }

  /* ── Render preferences UI ─────────────────────────────── */
  function renderPreferences(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    var prefs = loadPrefs();

    // Permission status
    var statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'margin-bottom:20px;padding:16px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);';

    if (!isSupported()) {
      statusDiv.textContent = 'Your browser does not support notifications.';
      statusDiv.style.color = '#f85149';
      container.appendChild(statusDiv);
      return;
    }

    if (hasPermission()) {
      var check = document.createElement('span');
      check.textContent = '\u2705 Notifications enabled';
      check.style.color = '#56d364';
      statusDiv.appendChild(check);
    } else {
      var enableBtn = document.createElement('button');
      enableBtn.textContent = '\uD83D\uDD14 Enable Notifications';
      enableBtn.style.cssText = 'background:rgba(245,166,35,0.15);color:#f5a623;border:1px solid rgba(245,166,35,0.3);border-radius:10px;padding:12px 24px;font-size:14px;font-weight:700;cursor:pointer;width:100%;text-transform:uppercase;letter-spacing:0.03em;';
      enableBtn.addEventListener('click', function () {
        requestPermission().then(function (granted) {
          if (granted) {
            renderPreferences(containerId);
            scheduleDailyReminder();
          }
        });
      });
      statusDiv.appendChild(enableBtn);

      if (Notification.permission === 'denied') {
        var denied = document.createElement('div');
        denied.style.cssText = 'margin-top:10px;font-size:12px;color:#f85149;';
        denied.textContent = 'Notifications are blocked. Please enable them in your browser settings.';
        statusDiv.appendChild(denied);
      }
    }
    container.appendChild(statusDiv);

    if (!hasPermission()) return;

    // Toggle switches
    var toggles = [
      { key: 'dailyReminder', label: 'Daily Training Reminder', desc: 'Get reminded to train at your preferred time' },
      { key: 'streakWarning', label: 'Streak Warning', desc: 'Alert when your streak is about to break (6PM)' },
      { key: 'weeklySummary', label: 'Weekly Summary', desc: 'Sunday notification with your weekly stats' }
    ];

    toggles.forEach(function (t) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);';

      var info = document.createElement('div');
      var label = document.createElement('div');
      label.textContent = t.label;
      label.style.cssText = 'font-size:14px;font-weight:600;color:var(--c-white);';
      var desc = document.createElement('div');
      desc.textContent = t.desc;
      desc.style.cssText = 'font-size:12px;color:var(--c-muted);margin-top:2px;';
      info.appendChild(label);
      info.appendChild(desc);

      var toggle = document.createElement('button');
      var isOn = prefs[t.key] && prefs[t.key].enabled;
      toggle.textContent = isOn ? 'ON' : 'OFF';
      toggle.style.cssText = 'min-width:52px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-size:12px;font-weight:700;cursor:pointer;transition:all 0.2s;' +
        (isOn ? 'background:rgba(86,211,100,0.15);color:#56d364;border-color:rgba(86,211,100,0.3);' : 'background:rgba(255,255,255,0.04);color:var(--c-muted);');

      toggle.addEventListener('click', function () {
        prefs[t.key].enabled = !prefs[t.key].enabled;
        savePrefs(prefs);
        renderPreferences(containerId);
        if (t.key === 'dailyReminder') scheduleDailyReminder();
      });

      row.appendChild(info);
      row.appendChild(toggle);
      container.appendChild(row);
    });

    // Time picker for daily reminder
    if (prefs.dailyReminder.enabled) {
      var timeRow = document.createElement('div');
      timeRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px;background:rgba(255,255,255,0.03);border-radius:10px;';

      var timeLabel = document.createElement('span');
      timeLabel.textContent = 'Reminder time:';
      timeLabel.style.cssText = 'font-size:13px;color:var(--c-muted);';

      var timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.value = String(prefs.dailyReminder.hour).padStart(2, '0') + ':' + String(prefs.dailyReminder.minute).padStart(2, '0');
      timeInput.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 12px;color:var(--c-white);font-size:14px;';
      timeInput.addEventListener('change', function () {
        var parts = timeInput.value.split(':');
        prefs.dailyReminder.hour = parseInt(parts[0], 10);
        prefs.dailyReminder.minute = parseInt(parts[1], 10);
        savePrefs(prefs);
        scheduleDailyReminder();
      });

      timeRow.appendChild(timeLabel);
      timeRow.appendChild(timeInput);
      container.appendChild(timeRow);
    }

    // Test button
    var testBtn = document.createElement('button');
    testBtn.textContent = '\uD83D\uDD14 Send Test Notification';
    testBtn.style.cssText = 'margin-top:20px;background:rgba(255,255,255,0.06);color:var(--c-muted);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 20px;font-size:13px;cursor:pointer;width:100%;';
    testBtn.addEventListener('click', function () {
      show('Test Notification \uD83C\uDFC0', 'CourtIQ notifications are working!', 'courtiq-test');
      if (typeof showToast === 'function') showToast('Test notification sent!');
    });
    container.appendChild(testBtn);
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    var prefs = loadPrefs();
    if (prefs.permissionGranted && hasPermission()) {
      scheduleDailyReminder();
      scheduleStreakWarning();
      checkWeeklySummary();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000);
  }

  window.NotificationManager = {
    requestPermission: requestPermission,
    show: show,
    scheduleDailyReminder: scheduleDailyReminder,
    scheduleStreakWarning: scheduleStreakWarning,
    showLevelUpNotification: showLevelUpNotification,
    renderPreferences: renderPreferences,
    hasPermission: hasPermission,
    isSupported: isSupported
  };
  if (typeof CourtIQ !== 'undefined') CourtIQ.register('NotificationManager', window.NotificationManager);
})();
