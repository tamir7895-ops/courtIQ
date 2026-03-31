# Cloud Persistence & Cross-Device Restore — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs so user data (profile, avatar, XP) reliably saves to Supabase and restores on any new device.

**Architecture:** Three targeted edits across `data-service.js`, `onboarding.js`, and `dashboard.js` — no new tables, no migrations, no new UI.

**Tech Stack:** Vanilla JS, Supabase JS client (`sb`), localStorage

---

## Chunk 1: data-service.js — upsert fixes

### Task 1: Fix `saveUserData()` — remove pre-fetch, use upsert + local cache

**Files:**
- Modify: `www/js/data-service.js:101-114`

- [x] **Step 1: Replace `saveUserData()` body**

  Replace lines 101-114 (`async saveUserData(patch)` method) with the upsert + cache version.

- [x] **Step 2: Replace `updateProfile()` body**

  Replace lines 18-24 (`async updateProfile(updates)` method) to use `upsert`.

- [x] **Step 3: Commit**
  ```bash
  git add www/js/data-service.js
  git commit -m "fix(data-service): use upsert for saveUserData + updateProfile"
  ```

---

## Chunk 2: onboarding.js — write player_profile + call updateProfile

### Task 2: Fix `finish()` — extend saveUserData + add updateProfile

**Files:**
- Modify: `www/js/onboarding.js:570-576`

- [x] **Step 1: Extend `saveUserData` call to include `player_profile` key**

  Add `player_profile` to the existing `saveUserData({...})` call in `finish()`.

- [x] **Step 2: Add `updateProfile` call after `saveUserData`**

  Fire `DataService.updateProfile({ first_name, position })` concurrently (fire-and-forget).

- [x] **Step 3: Commit**
  ```bash
  git add www/js/onboarding.js
  git commit -m "fix(onboarding): write player_profile to user_data + call updateProfile for structured columns"
  ```

---

## Chunk 3: dashboard.js — always-restore + XP sync

### Task 3a: Remove localStorage guards in `initDashboard()`

**Files:**
- Modify: `www/js/dashboard.js:144-171`

- [x] **Step 1: Seed `_sb_user_data_cache` from cloud blob**

  Add `localStorage.setItem('_sb_user_data_cache', JSON.stringify(userData))` at start of the userData block.

- [x] **Step 2: Remove `!localStorage.getItem('courtiq-xp')` guard**

  XP always restores from cloud (cloud is source of truth).

- [x] **Step 3: Remove `!localStorage.getItem('courtiq-onboarding-complete')` guard**

  Onboarding data always restores from cloud on login.

### Task 3b: Sync XP to Supabase after `dbAddSession()`

**Files:**
- Modify: `www/js/dashboard.js:709-711`

- [x] **Step 4: Add XP cloud sync after `XPSystem.addXP()` call**

  Fire-and-forget `DataService.saveUserData({ xp_data })` after XP is updated.

- [x] **Step 5: Commit**
  ```bash
  git add www/js/dashboard.js
  git commit -m "fix(dashboard): always restore from cloud + sync XP on session log"
  ```

---

## Testing Checklist

- [ ] New user completes onboarding → `profiles` row created with `user_data`, `first_name`, `position`
- [ ] Sign in on Device B → dashboard shows name, position, avatar, XP — no onboarding re-shown
- [ ] Log session → XP cloud `user_data.xp_data` updated
- [ ] Sign in on Device B after XP change → correct XP shown
- [ ] Network offline during finish() → onboarding completes, local data intact
