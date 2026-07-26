/* app-v10/auth-state.js
   AUTH STATE — the single owner of window.currentUser in v10.
   Loads after supabase-client.js, before app.js.

   Everything downstream (shotService anonymous fallback, camera-hud
   saves, me-screen account section) reads window.currentUser; this
   module keeps it in sync with the Supabase session and broadcasts
   'v10:auth' on every change so mounted screens can re-render.

   Email/password only — no social providers, which also means the
   App Store "Sign in with Apple" rule does not apply.
   ============================================================ */
(function () {
  'use strict';

  function setUser(user) {
    var prev = window.currentUser ? window.currentUser.id : null;
    window.currentUser = user || null;
    var next = user ? user.id : null;
    if (prev !== next) {
      try {
        document.dispatchEvent(new CustomEvent('v10:auth', { detail: { user: window.currentUser } }));
      } catch (e) { /* non-fatal */ }
    }
  }

  function init() {
    if (!window.sb || !window.sb.auth) return;
    window.sb.auth.getSession().then(function (res) {
      setUser(res && res.data && res.data.session ? res.data.session.user : null);
    }).catch(function () { setUser(null); });
    window.sb.auth.onAuthStateChange(function (_event, session) {
      setUser(session ? session.user : null);
    });
  }

  window.V10Auth = {
    user: function () { return window.currentUser || null; },

    signIn: function (email, password) {
      return window.sb.auth.signInWithPassword({ email: email, password: password });
    },

    signUp: function (email, password, firstName) {
      return window.sb.auth.signUp({
        email: email,
        password: password,
        data: undefined,
        options: { data: { first_name: firstName || '' } }
      });
    },

    resetPassword: function (email) {
      return window.sb.auth.resetPasswordForEmail(email);
    },

    /* Signing out used to clear nothing at all, so everything the player
       had built — XP, streak, badges, shop, plan, coach memory — stayed
       on the device and the next person to sign in on that phone
       inherited it. Only deleteAccount ever swept.

       The sweep is a KEEP-list, not a clear-list, and deliberately so: a
       progression key added later is wiped by default, which is the safe
       failure. Only state that genuinely belongs to the handset survives
       — the rim calibration for this court, the offline upload queue
       (still-unsent sessions), and UI preferences. */
    signOut: function () {
      return window.sb.auth.signOut().then(function () {
        setUser(null);
        try {
          var KEEP = [
            'courtiq-rim-calibration',   // physical setup, this phone
            'courtiq-calib-v1',
            'courtiq-court-spec',
            'courtiq-ai-sessions-offline',  // unsent — losing these loses sessions
            'courtiq-ai-shots-offline',
            'courtiq-sidebar-collapsed',
            'courtiq-skip-session-prep',
            'courtiq_debug'
          ];
          Object.keys(localStorage).forEach(function (k) {
            if (k.indexOf('courtiq') !== 0 && k !== '_sb_user_data_cache') return;
            if (KEEP.indexOf(k) >= 0) return;
            localStorage.removeItem(k);
          });
        } catch (e) { /* storage blocked — nothing to clear */ }
      });
    },

    /* Account deletion (App Store requirement). The delete-account edge
       function verifies the caller's JWT, wipes their rows in every
       table with the service role, then deletes the auth user. */
    deleteAccount: function () {
      return window.sb.functions.invoke('delete-account', { body: {} })
        .then(function (res) {
          if (res && res.error) throw res.error;
          return window.sb.auth.signOut().catch(function () {});
        })
        .then(function () {
          setUser(null);
          // Local traces go too — this device should look factory-fresh.
          try {
            Object.keys(localStorage).forEach(function (k) {
              if (k.indexOf('courtiq') === 0) localStorage.removeItem(k);
            });
          } catch (e) {}
        });
    }
  };

  init();
})();
