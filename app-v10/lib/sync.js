/* app-v10/lib/sync.js — progression sync (phase A)
   ============================================================
   Everything a player builds used to live only on their phone: the
   streak, freezes, shop purchases, personal records, saved drills and
   the training plan. A reinstall or a new device wiped all of it.

   This module carries that state to the server and back. XP and badges
   are deliberately NOT here — they already sync through
   profiles.user_data, and moving XP needs a per-device counter and a
   migration of its own.

   The merge happens SERVER-side, in one RPC. Two devices that each read,
   merge locally and write back would race, and the loser's progress
   would vanish; one atomic statement per table removes that entirely.
   Pull and push are the same idempotent call, so there is a single code
   path rather than two that can disagree.

   Nothing here is allowed to fail loudly. A player mid-session must
   never see a sync error, and local state is never destroyed on a
   failed round trip.
   ============================================================ */
(function () {
  'use strict';

  var DEBOUNCE_MS = 5000;
  var TIMER_MS    = 60000;

  var pending = null;    // debounce handle
  var inFlight = false;
  var lastPushAt = 0;

  function lsGet(k, fallback) {
    try {
      var raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  function signedIn() {
    return !!(window.currentUser && typeof sb !== 'undefined' && sb.rpc);
  }

  /* ── the snapshot ────────────────────────────────────────────────
     Read straight from the keys their owners already write, so no
     existing call site has to change. */
  function snapshot() {
    var s = {};

    /* streak → the SET of days, not the summary. A summary cannot be
       merged without a loser; a set unions cleanly. */
    try {
      if (window.StreakSystem && window.StreakSystem.trainingDays) {
        s.training_days = window.StreakSystem.trainingDays();
      }
    } catch (e) {}

    var st = lsGet('courtiq-streak', null);
    s.records = [];
    if (st && st.best) {
      /* the day set only reaches back to the backfill, so a best earned
         before that has to travel on its own */
      s.records.push({ record_key: 'streak_best', value: st.best });
    }
    var bests = lsGet('courtiq_v11_bests', null);
    if (bests && typeof bests.pct === 'number') {
      s.records.push({ record_key: 'session_pct', value: bests.pct });
    }

    /* shop: items carry their cost so spend stays derivable, and the
       consumable ledger covers power-ups, which buy nothing ownable */
    var shop = lsGet('courtiq_shop_v12', null);
    if (shop) {
      s.purchases = (shop.owned || []).map(function (id) {
        var cost = 0;
        try {
          if (window.V12Avatar && window.V12Avatar.costOf) cost = window.V12Avatar.costOf(id) || 0;
        } catch (e) {}
        return { item_id: id, cost: cost };
      });
      s.consumables = (shop.ledger || []).map(function (l) {
        return { ref: l.ref, kind: l.kind || 'powerup', cost: l.cost || 0 };
      });
    }

    /* freezes: grants and uses are both sets, so the balance is a
       difference that a replayed push cannot move */
    var fz = lsGet('courtiq_freeze_log', null);
    if (fz) {
      s.freeze_grants = (fz.grants || []).map(function (r) { return { ref: r }; });
      s.freeze_uses   = fz.uses || [];
    }

    var drills = lsGet('courtiq_saved_drills', null);
    if (drills && drills.length) {
      s.saved_drills = drills.map(function (d) {
        return typeof d === 'string'
          ? { drill_id: d, saved_at: new Date().toISOString() }
          : { drill_id: d.id || d.drill_id, saved_at: d.saved_at || new Date().toISOString(),
              removed_at: d.removed_at || null };
      }).filter(function (d) { return !!d.drill_id; });
    }

    /* prefs are edits, not accumulations, so they are the one thing
       that uses last-write-wins — per key, so a skewed clock costs that
       key alone rather than the whole blob */
    var ts = new Date().toISOString();
    var prefs = [];
    function pref(key, value) {
      if (value === null || value === undefined) return;
      prefs.push({ key: key, value: value, client_ts: ts, device_id: deviceId() });
    }
    pref('plan',       lsGet('courtiq-training-plan-v1', null));
    pref('plan_prefs', lsGet('courtiq_plan_prefs', null));
    pref('avatar',     lsGet('courtiq_avatar_params', null));
    try {
      var url = localStorage.getItem('courtiq_avatar_url');
      if (url) pref('avatar_url', url);            // wrapped: jsonb needs valid JSON
      var notify = localStorage.getItem('courtiq_notify');
      if (notify) pref('notify', notify);
    } catch (e) {}
    if (prefs.length) s.prefs = prefs;

    return s;
  }

  /* A stable id per install, used only to break last-write-wins ties
     deterministically so the merge stays commutative. */
  function deviceId() {
    try {
      var id = localStorage.getItem('courtiq_device_id');
      if (!id) {
        id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('courtiq_device_id', id);
      }
      return id;
    } catch (e) { return ''; }
  }

  /* ── writing the merged result back ──────────────────────────────
     Field by field, never whole-key: courtiq-streak keeps its own
     lastDate, and courtiq_shop_v12 keeps anything the server does not
     model. Overwriting the key wholesale would throw those away. */
  function apply(state) {
    if (!state) return;

    try {
      if (state.training_days && window.StreakSystem && window.StreakSystem.mergeTrainingDays) {
        window.StreakSystem.mergeTrainingDays(state.training_days);
      }
      /* The server derives current/best from the day set; lastDate stays
         whatever this device recorded, because checkIn() owns it. */
      if (state.streak && window.StreakSystem && window.StreakSystem.save) {
        var cur = lsGet('courtiq-streak', { current: 0, best: 0, lastDate: null });
        cur.current  = state.streak.current != null ? state.streak.current : cur.current;
        cur.best     = Math.max(state.streak.best || 0, cur.best || 0);
        cur.lastDate = cur.lastDate || state.streak.last_day || null;
        window.StreakSystem.save(cur);
      }
    } catch (e) {}

    try {
      if (state.records) {
        var b = lsGet('courtiq_v11_bests', {});
        if (state.records.session_pct != null) {
          b.pct = Math.max(Number(state.records.session_pct) || 0, b.pct || 0);
          /* hist stays device-local — it is a rolling window of THIS
             device's sessions and the server cannot reproduce it */
          lsSet('courtiq_v11_bests', b);
        }
      }
    } catch (e) {}

    try {
      if (state.purchases) {
        var shop = lsGet('courtiq_shop_v12', { owned: [], spent: 0, ledger: [] });
        var owned = shop.owned || [];
        state.purchases.forEach(function (p) {
          if (p.item_id && owned.indexOf(p.item_id) < 0) owned.push(p.item_id);
        });
        shop.owned = owned;
        /* spend is derived server-side from what was actually bought, so
           it can never drift from the item list the way a stored scalar
           did */
        if (state.coins_spent != null) shop.spent = Number(state.coins_spent) || 0;
        lsSet('courtiq_shop_v12', shop);
      }
    } catch (e) {}

    try {
      if (state.freeze_balance != null) {
        localStorage.setItem('courtiq_streak_freeze', String(Math.max(0, state.freeze_balance)));
      }
    } catch (e) {}

    try {
      if (state.prefs) {
        if (state.prefs.plan)       lsSet('courtiq-training-plan-v1', state.prefs.plan.value);
        if (state.prefs.plan_prefs) lsSet('courtiq_plan_prefs', state.prefs.plan_prefs.value);
        if (state.prefs.avatar)     lsSet('courtiq_avatar_params', state.prefs.avatar.value);
        if (state.prefs.avatar_url && typeof state.prefs.avatar_url.value === 'string') {
          localStorage.setItem('courtiq_avatar_url', state.prefs.avatar_url.value);
        }
        if (state.prefs.notify && typeof state.prefs.notify.value === 'string') {
          localStorage.setItem('courtiq_notify', state.prefs.notify.value);
        }
      }
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('courtiq:state-synced', { detail: state }));
    } catch (e) {}
  }

  /* ── the round trip ──────────────────────────────────────────────*/
  function run() {
    if (!signedIn() || inFlight) return Promise.resolve(null);
    inFlight = true;
    var payload;
    try { payload = snapshot(); }
    catch (e) { inFlight = false; return Promise.resolve(null); }

    return sb.rpc('sync_player_state', { p_state: payload })
      .then(function (res) {
        inFlight = false;
        if (res && res.error) {
          /* Never surfaced to the player, never destructive: the local
             state is untouched and the next trigger retries. */
          try { localStorage.setItem('courtiq_sync_last_error', String(res.error.message || res.error)); } catch (e) {}
          return null;
        }
        lastPushAt = Date.now();
        apply(res && res.data);
        return res && res.data;
      })
      .catch(function (err) {
        inFlight = false;
        try { localStorage.setItem('courtiq_sync_last_error', String(err && err.message || err)); } catch (e) {}
        return null;
      });
  }

  function schedule() {
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () { pending = null; run(); }, DEBOUNCE_MS);
  }

  /* ── triggers ────────────────────────────────────────────────────
     Backgrounding is the important one: it is what makes picking up
     the other device feel current. */
  function arm() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') run();
      else if (Date.now() - lastPushAt > TIMER_MS) run();
    });
    window.addEventListener('courtiq:session-saved', schedule);
    window.addEventListener('courtiq:plan-saved', schedule);
    setInterval(function () { if (!document.hidden) run(); }, TIMER_MS);
  }

  /* The first pull must wait for the session: V10Auth resolves it
     asynchronously, and firing early would call the RPC with no user. */
  function boot() {
    if (signedIn()) run();
    window.addEventListener('v10:auth', function () {
      if (signedIn()) run();
    });
    arm();
  }

  window.V12Sync = { run: run, snapshot: snapshot, apply: apply, deviceId: deviceId };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
