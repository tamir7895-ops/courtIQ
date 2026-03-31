# Cloud Persistence & Cross-Device Restore — Design Spec
**Date:** 2026-03-31
**Project:** CourtIQ
**Status:** Approved by user, v2 after spec review

---

## Problem

When a user completes onboarding (player creation + avatar) on one device and then signs in from a different device (e.g. phone), their data does not restore. The dashboard shows as if they are a new user and may re-launch onboarding.

Three root-cause bugs identified:

1. **`saveUserData()` does a SELECT then UPDATE** — the SELECT fails with "no rows" if the `profiles` row does not exist, causing the function to throw before the UPDATE runs. Data is never written to cloud.
2. **`onboarding.finish()` never calls `updateProfile()`** — `first_name` and `position` are never written to the structured columns of the `profiles` table; only to the `user_data` JSONB blob.
3. **XP is never synced back to Supabase** — XP is restored from cloud on login but changes are written only to localStorage and lost on new devices.
4. **Restore logic gates on localStorage flags** — even if cloud data exists, the restore is skipped if `courtiq-onboarding-complete` or `courtiq-xp` already exists locally. On a new device these are absent, but if localStorage is partially populated this fails.

---

## Goal

- User completes onboarding on Device A → all data (profile, avatar, XP) saved to Supabase reliably.
- User signs in on Device B → dashboard loads immediately with all data restored. No onboarding re-shown.
- XP stays consistent across devices.

---

## Scope (in)

- Fix `saveUserData()`: remove pre-fetch + use `upsert`.
- Fix `updateProfile()`: use `upsert` without pre-fetch.
- In `onboarding.finish()`, call `updateProfile({ first_name, position })` for structured columns.
- In `initDashboard()`, always restore `onboarding_data` and `xp_data` from Supabase — remove the `!localStorage.getItem(...)` guards (cloud is source of truth).
- Sync XP to Supabase synchronously after every `XPSystem.addXP()` call in `dbAddSession()`.

## Scope (out)

- No new Supabase tables or migrations.
- No changes to auth flow or UI.
- No real-time sync (Supabase Realtime channels).
- No conflict-resolution UI.

---

## Column map (existing schema)

`profiles` table has two kinds of storage:
- **Structured columns**: `id`, `first_name`, `position`, `updated_at` — written via `updateProfile()`
- **JSONB blob `user_data`**: `onboarding_data`, `archetype`, `avatar`, `xp_data`, `player_profile` — written via `saveUserData()`

`updateProfile()` must ONLY receive structured column keys (`first_name`, `position`). `player_profile` lives inside `user_data` and is saved via `saveUserData()`.

---

## Detailed Changes

### 1. `data-service.js` — `saveUserData(patch)`

Remove the pre-fetch entirely. Upsert the merged object using a client-side merge from localStorage.

**Current (broken):**
```js
async saveUserData(patch) {
  const { data: current, error: fetchErr } = await sb
    .from('profiles').select('user_data').eq('id', window.currentUser.id).single();
  if (fetchErr) throw fetchErr;             // ← throws on new user (no row)
  const merged = Object.assign({}, current?.user_data || {}, patch);
  const { error } = await sb.from('profiles')
    .update({ user_data: merged, updated_at: new Date().toISOString() })
    .eq('id', window.currentUser.id);
  if (error) throw error;
},
```

**Fixed:**
```js
async saveUserData(patch) {
  // Read current user_data from localStorage for merge — no extra round-trip
  var existing = {};
  try {
    var raw = localStorage.getItem('_sb_user_data_cache');
    if (raw) existing = JSON.parse(raw);
  } catch(e) {}
  var merged = Object.assign({}, existing, patch);

  const { error } = await sb.from('profiles')
    .upsert(
      { id: window.currentUser.id, user_data: merged, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  if (error) throw error;

  // Update local cache for next merge
  try { localStorage.setItem('_sb_user_data_cache', JSON.stringify(merged)); } catch(e) {}
},
```

> Note: the `_sb_user_data_cache` key is a private internal cache only used by `saveUserData` for merging — never read by the rest of the app.
> **Important:** this cache must also be seeded during `initDashboard()` restore (see Section 4) so that the first `saveUserData()` call on a restored device merges against the full cloud state rather than `{}`.

### 2. `data-service.js` — `updateProfile(updates)`

**Current (broken):**
```js
async updateProfile(updates) {
  const { error } = await sb
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', window.currentUser.id);
  if (error) throw error;
},
```

**Fixed:**
```js
async updateProfile(updates) {
  const { error } = await sb
    .from('profiles')
    .upsert(
      { id: window.currentUser.id, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  if (error) throw error;
},
```

### 3. `onboarding.js` — `finish()` — extend `saveUserData` + add `updateProfile`

**3a.** Extend the existing `saveUserData(...)` call to also write `player_profile` as a top-level key in `user_data` (so the `userData.player_profile` restore branch in `initDashboard` works):

```js
DataService.saveUserData({
  onboarding_data: data,
  archetype: data.archetype || null,
  avatar: data.avatar || null,
  player_profile: {               // ← add this
    position:    data.position || '',
    height:      String(data.height || ''),
    age:         String(data.age || ''),
    skillLevel:  skillLevel,
    primaryGoal: data.goals ? data.goals[0] : ''
  }
}).catch(function(e) { console.warn('Supabase onboarding sync error:', e); });
```

**3b.** After the `saveUserData` call, also fire `updateProfile` for structured columns. Safe to run concurrently — writes to different columns of the same row:

```js
DataService.updateProfile({
  first_name: data.name || '',
  position:   data.position || ''
}).catch(function(e) { console.warn('Profile column upsert error:', e); });
```

### 4. `dashboard.js` — `initDashboard()` — always-restore logic

**Current (partial, broken on Device B):**
```js
// XP — only restores if absent
if (userData.xp_data && !localStorage.getItem('courtiq-xp')) {
  localStorage.setItem('courtiq-xp', JSON.stringify(userData.xp_data));
}
// Onboarding — only restores if not complete
if (userData.onboarding_data && !localStorage.getItem('courtiq-onboarding-complete')) {
  // ... restore ...
}
```

**Fixed — remove both guards; cloud is always source of truth on login:**
```js
// Seed the saveUserData merge cache from the full cloud blob.
// Without this, the first saveUserData() call on a restored device
// starts from {} and wipes all other user_data keys.
try { localStorage.setItem('_sb_user_data_cache', JSON.stringify(userData)); } catch(e) {}

// XP — always sync from cloud (cloud accumulates across all devices)
if (userData.xp_data) {
  localStorage.setItem('courtiq-xp', JSON.stringify(userData.xp_data));
  if (typeof XPSystem !== 'undefined' && XPSystem.render) XPSystem.render();
}
// Onboarding — always sync from cloud
if (userData.onboarding_data) {
  const ob = userData.onboarding_data;
  localStorage.setItem('courtiq-onboarding-data', JSON.stringify(ob));
  localStorage.setItem('courtiq-onboarding-complete', String(ob.ts || Date.now()));
  if (ob.archetype) {
    localStorage.setItem('courtiq-archetype', JSON.stringify({ key: ob.archetype, ts: Date.now() }));
  }
  if (ob.position) {
    const vals = Object.values(ob.skills || {});
    const skillAvg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 5;
    const skillLevel = skillAvg >= 7 ? 'Advanced' : skillAvg >= 4 ? 'Intermediate' : 'Beginner';
    localStorage.setItem('courtiq-player-profile', JSON.stringify({
      position: ob.position || '',
      height: String(ob.height || ''),
      age: String(ob.age || ''),
      skillLevel,
      primaryGoal: ob.goals ? ob.goals[0] : ''
    }));
  }
}
```

The existing always-sync blocks for `avatar` and `player_profile` (lines 173-189 in current dashboard.js) are kept as-is.

### 5. `dashboard.js` — `dbAddSession()` — XP sync

`XPSystem.addXP()` is **synchronous** — it updates localStorage before returning. Read XP immediately after (no setTimeout needed). Guard with `window.currentUser` in case session has expired.

After `XPSystem.addXP(xpEarned, 'Session logged')` in `dbAddSession()`:

```js
// Sync updated XP to cloud (non-blocking, fire-and-forget)
if (window.currentUser && typeof DataService !== 'undefined') {
  try {
    var xpData = JSON.parse(localStorage.getItem('courtiq-xp') || '{}');
    DataService.saveUserData({ xp_data: xpData }).catch(function() {});
  } catch(e) {}
}
```

---

## Data Flow

### Save (Device A — onboarding complete):
```
onboarding.finish()
  → localStorage.setItem('courtiq-onboarding-data', ...)
  → DataService.saveUserData({ onboarding_data, archetype, avatar, player_profile })
      → profiles.upsert({ id, user_data: merged })       ← creates row if absent
  → DataService.updateProfile({ first_name, position })
      → profiles.upsert({ id, first_name, position })    ← safe concurrent, different columns
```

### Restore (Device B — new login):
```
initDashboard()
  → await DataService.getUserData()                      ← reads profiles.user_data
  → userData.xp_data        → localStorage.setItem('courtiq-xp', ...)
  → userData.onboarding_data → localStorage.setItem('courtiq-onboarding-data', ...)
                             → localStorage.setItem('courtiq-onboarding-complete', ts)
  → onboardingDone check → flag IS set → skip Onboarding.launch()
  → dashboard renders with all data ✅
```

### XP sync:
```
dbAddSession() → XPSystem.addXP(25) → localStorage updated synchronously
  → read localStorage.getItem('courtiq-xp')
  → DataService.saveUserData({ xp_data }) [non-blocking]

Next login on any device:
  → getUserData() → userData.xp_data → localStorage.setItem('courtiq-xp', ...)
```

---

## Error Handling

- All Supabase calls in `finish()` are `.catch(warn)` — onboarding completes regardless.
- `saveUserData()` and `updateProfile()` in `finish()` write to different columns — concurrent fire-and-forget is safe (no write conflict).
- If `getUserData()` fails on restore (network down) → caught silently → user stays in local-only mode, onboarding check uses localStorage state.
- `window.currentUser` is checked before every `DataService` call in async callbacks.

---

## Testing Checklist

- [ ] New user (no `profiles` row) completes onboarding → `profiles` row created with `user_data`, `first_name`, `position`
- [ ] Sign in on Device B → dashboard loads with correct name, position, avatar, XP — no onboarding shown
- [ ] Log session on Device A → +25 XP → cloud `user_data.xp_data` updated immediately
- [ ] Sign in on Device B after XP change → correct XP shown
- [ ] Network offline during `finish()` → onboarding still completes, toast shown, local data intact
