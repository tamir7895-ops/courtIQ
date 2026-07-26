# Progression sync — design

**Date:** 2026-07-26
**Status:** revised after spec review; ready for planning

## Correction to the first draft

The first draft claimed no progression reaches Supabase. That was wrong.
XP, badges and the onboarding/profile blob **are** synced today through
`DataService.saveUserData` into `profiles.user_data`, and `dashboard.js`
restores XP from the cloud on every launch.

The original grep required the localStorage key and the Supabase call to
appear on the same line; in the source they sit on adjacent lines, so it
matched nothing. Corrected picture:

| Synced today (`profiles.user_data`) | Not synced |
|---|---|
| `xp_data`, `badges` | streak + streak freezes |
| `onboarding_data`, `player_profile` | shop purchases |
| | personal records |
| | training plan, saved drills |

## The problem

Two problems, and the second is worse.

**1. Half of progression is device-only.** Streak, freezes, shop
purchases, personal records and the training plan never leave the phone. A
reinstall or a new device loses them. The streak is the mechanic that
brings people back daily and it is the most fragile thing in the app.

**2. The half that *is* synced loses data across devices.**
`saveUserData` (`js/data-service.js:108`) merges a patch against a
**localStorage cache**, not against the server, then writes the whole
`user_data` blob back. A device holding a stale cache overwrites newer
keys from another device. The code comment at `js/dashboard.js:179` admits
the failure mode outright: without the cache seed, a restored device
"starts from `{}` and wipes all other user_data keys."

So the data loss this project exists to prevent is already happening,
silently, for XP and badges.

## Goals

- Progression survives reinstall and moves between a phone and a tablet.
- A conflict can never *lose* progression, and can never *manufacture* it.
- Works offline; the app must never block or fail because sync is down.
- No rewrite of the ~30 call sites that write to localStorage.

## Non-goals

- Real-time sync. A short window of disagreement is acceptable.
- Syncing device-local state: rim calibration, court spec, offline queues,
  UI preferences. These are correctly per-device.

## Merge semantics

The first draft used MAX for accumulating scalars. Review found three
places where that is wrong, and all three are load-bearing.

**MAX on XP silently discards concurrent gains.** Two devices start at
1,000 and each earns 125 offline. `MAX(1125, 1125)` = 1125, not 1250 —
while all ten sessions upload as rows, so XP and session history diverge
permanently. The guest-sign-in example in the first draft had the same
shape: a guest's 500 XP was simply thrown away.

**MAX on `coins_spent` mints free currency.** Buy a 300-coin item on the
phone and a different 300-coin item on the tablet: purchases UNION to two
items, `MAX(300, 300)` charges for one. Repeatable at will.

**"Later `last_date` wins" destroys the live streak.** A stale, offline
device holds the *later* date with the *worse* information. Phone trained
Mon–Wed (`current=3`). Stale tablet at `lastDate=Mon` trains Thursday
offline; `checkIn()` sees a broken chain and resets to `current=1,
lastDate=Thu`. On reconnect the tablet's later date wins and a 4-day
streak becomes 1.

The fix in every case is to **sync the primitive facts, not the derived
value**, and let the server derive:

| Data | Representation | Merge |
|---|---|---|
| XP | one grow-only counter per device | `GREATEST` per device, `SUM` across devices |
| Training days | the set of days trained | UNION |
| Streak | *derived* from training days ∪ freeze-bridged days | — |
| Freezes | granted = consumable rows; used = set of bridged days | UNION both; balance = difference |
| Purchases | one row per item, **with its cost** | UNION |
| Consumable spends | one row per spend, idempotency-keyed | UNION |
| Coins spent | *derived* = SUM(purchase costs) + SUM(consumable costs) | — |
| Personal best % | single scalar | MAX |
| Session history (`hist`) | *derived* from `ai_shot_sessions` | — |
| Prefs (plan, avatar, notify) | one row per key, with timestamp | last write wins per key |

Every rule is commutative and idempotent, so sync order does not matter
and a replayed push is harmless. Nothing accumulating is ever stored as a
mergeable scalar, so nothing can drift.

Per-device XP counters make this a grow-only counter (G-Counter): the
device id is generated once per install and kept in `courtiq_device_id`.

## Schema

```sql
-- XP: grow-only counter, one row per device. Total = SUM.
create table player_xp (
  user_id    uuid not null references auth.users(id) on delete cascade,
  device_id  text not null,
  xp         integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- The set of days the player trained. The streak is derived from this.
create table player_training_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

-- Days a freeze bridged. Keyed by day, so replay cannot double-spend.
create table player_freeze_uses (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

-- Catalog items (avatar options). cost is stored so spend is derivable.
create table player_purchases (
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_id      text not null,
  cost         integer not null default 0,
  purchased_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- Non-catalog spends (power-ups, freezes). ref is a client-generated
-- idempotency key so a retried push cannot charge twice.
create table player_consumables (
  user_id  uuid not null references auth.users(id) on delete cascade,
  ref      text not null,
  kind     text not null,
  cost     integer not null default 0,
  spent_at timestamptz not null default now(),
  primary key (user_id, ref)
);

create table player_records (
  user_id     uuid not null references auth.users(id) on delete cascade,
  record_key  text not null,
  value       numeric not null,
  achieved_at timestamptz not null default now(),
  primary key (user_id, record_key)
);

-- One row per preference key, so a stale clock can cost at most that key.
create table player_prefs (
  user_id   uuid not null references auth.users(id) on delete cascade,
  key       text not null,
  value     jsonb not null,
  client_ts timestamptz not null,
  device_id text not null default '',
  primary key (user_id, key)
);
```

No table stores a value that could disagree with another. Totals come from
a `player_totals(user_id)` function: XP as `SUM(player_xp.xp)`, coins spent
as `SUM(purchases.cost) + SUM(consumables.cost)`, streak derived from
`player_training_days ∪ player_freeze_uses`.

Freeze balance = `count(consumables where kind='freeze') −
count(player_freeze_uses)`.

Progression stays out of `profiles`: `profiles` is identity, read on every
screen, while progression changes on every shot.

RLS on all seven tables: owner-only, `(select auth.uid()) = user_id`,
pinned to `authenticated`, `WITH CHECK` on **every** write path. The
2026-07-26 audit found two policies missing `WITH CHECK`; do not repeat it.

## Deriving `hist` instead of syncing it

`courtiq_v11_bests` is `{ pct: Number, hist: [Number × ≤20] }` — not the
keyed record map the first draft assumed. `hist` is load-bearing:
`reveal.js` takes its median to decide the post-session celebration tier,
and falls back to a flat tier when fewer than three entries exist.

Dropping it as noise would silently regress every restored device to flat
tiers for three sessions. Syncing it needs an ordering it does not carry.

Instead the server derives it: `hist` is the accuracy of the last 20
`ai_shot_sessions` with `total_attempts >= 10` and a non-null accuracy —
which is exactly what it already means. It leaves the sync payload
entirely and works correctly on a fresh device.

Only `pct` syncs, as `player_records['session_pct']`, MAX-merged.

## Where the merge runs

**Server-side, in one RPC:** `sync_player_state(p_state jsonb)` takes the
client snapshot, merges it, and returns the authoritative merged state in
the same call.

Requirements, all security-relevant:

- `user_id := auth.uid()` **inside** the function. Any `user_id` present in
  `p_state` is ignored, never trusted.
- `SECURITY INVOKER`, so RLS still applies as defence in depth. It does not
  need DEFINER: it only ever touches the caller's own rows.
- `set search_path = ''`, fully-qualified table names.
- Each table's merge is a **single** `insert … on conflict do update`
  statement. A SELECT-then-UPDATE at READ COMMITTED still interleaves
  between two devices, which is the race this design exists to remove.

Merge forms:

```sql
-- XP: per device, never decreases
insert into public.player_xp (user_id, device_id, xp) values (...)
on conflict (user_id, device_id)
do update set xp = greatest(excluded.xp, public.player_xp.xp),
              updated_at = now();

-- sets: union
insert into public.player_training_days (user_id, day) select ...
on conflict do nothing;

-- records: max
insert into public.player_records (user_id, record_key, value) values (...)
on conflict (user_id, record_key)
do update set value = greatest(excluded.value, public.player_records.value)
where excluded.value > public.player_records.value;

-- prefs: last write wins per key, deterministic tiebreak on device_id
insert into public.player_prefs (user_id, key, value, client_ts, device_id) values (...)
on conflict (user_id, key)
do update set value = excluded.value, client_ts = excluded.client_ts,
              device_id = excluded.device_id
where excluded.client_ts > public.player_prefs.client_ts
   or (excluded.client_ts = public.player_prefs.client_ts
       and excluded.device_id > public.player_prefs.device_id);
```

## Prerequisites

Two fixes must land before or with the sync module, or it will fight
existing code.

**1. Backfill from `user_data`.** Existing users hold XP in
`profiles.user_data->'xp_data'->>'xp'` and badges in
`user_data->'badges'`. Without a backfill their first merge computes
`GREATEST(0, 0) = 0` and wipes everything. Migration seeds
`player_xp(user_id, 'legacy', <xp>)` and `player_badges` from the blob.

**2. Retire the old writers.** `gamification.js:44`, `badges.js:61` and
`dashboard.js:758` keep writing `user_data`; `dashboard.js:184` overwrites
`courtiq-xp` from the blob on every launch, *after* sync has written the
merged value — XP would visibly drop after each sync. These writers are
removed and `data.js getProfile()` repointed at `player_totals`.

Until that repoint lands, **do not drop `profiles.streak`.** Nothing writes
it, but `data.js:203` reads it and feeds home, me, social, notifications
and coach-ai. Dropping it first makes every surface show a 0-day streak.
Drop it in a later migration.

Independently, `saveUserData`'s localStorage-cache merge should become a
server-side jsonb merge (`user_data = profiles.user_data || excluded.
user_data`) so the remaining blob keys stop losing updates.

## localStorage → server mapping

| Key | Destination |
|---|---|
| `courtiq-xp` | `player_xp` (this device's row); `history` stays local |
| `courtiq-streak` | `player_training_days` (derived back on pull) |
| `courtiq_streak_freeze` | `player_consumables` (kind='freeze') + `player_freeze_uses` |
| `courtiq_shop_v12` | `player_purchases` (with cost) + `player_consumables` |
| `courtiq-badges` | `player_badges` |
| `courtiq_v11_bests` | `player_records['session_pct']`; `hist` derived server-side |
| `courtiq-training-plan-v1` | `player_prefs['plan']` |
| `courtiq_plan_prefs` | `player_prefs['plan_prefs']` |
| `courtiq_avatar_params`, `courtiq_avatar_url` | `player_prefs['avatar']` |
| `courtiq_notify`, `courtiq-notif-prefs` | `player_prefs['notify']` |
| `courtiq_saved_drills` | `player_prefs['saved_drills']` |

Device-local, never synced: `courtiq-rim-calibration`, `courtiq-calib-v1`,
`courtiq-court-spec`, `courtiq-ai-*-offline`, `courtiq-sidebar-collapsed`,
`courtiq-skip-session-prep`, avatar/face caches, `courtiq_device_id`.

Already synced elsewhere, untouched: `courtiq_v12_chal`
(`challenge_claims`), `courtiq_coach_memory` (`coach_memory`).

## Client changes required

`avatar.js spend(amount, label)` increments `spent` without recording
anything in `owned`, so consumable spend is not reconstructible. It must
append `{ ref, kind, cost }` to a local ledger inside `courtiq_shop_v12`,
with `ref` a generated uuid. `useFreeze()` must record the **date** it
bridged so the use is idempotent.

## The sync module

New file `app-v10/lib/sync.js` exposing `V12Sync`. **ES5 only**: `var`,
`function () {}`, no template literals, arrow functions, `const`/`let`.
Registered in `app-v10/index.html` after `auth-state.js` and `lib/data.js`
(it depends on both), and `node build.js` must run before browser checks.

**Pull + merge** on launch and on sign-in: gather every mapped key into a
snapshot, call `sync_player_state`, write the merged result back to
localStorage **field by field** (a whole-key overwrite would wipe
`courtiq-xp.history`), then dispatch `courtiq:state-synced` so open screens
re-render.

**Push** uses the same RPC, fired on `visibilitychange` to background, on
`courtiq:session-saved`, and on a 60-second timer while active. Leaving the
app pushes, so switching devices is virtually always current.

Pull and push being the same idempotent call means one code path to get
right, not two. Calls are debounced 5 seconds so a burst of XP grants
during a session produces one request.

## Edge cases

**Guest plays, then signs in.** The guest's progression is real. Sign-in
runs the same merge: guest XP arrives as this device's counter row and is
*added*, not compared — no gains are discarded.

**Sign-out.** Clear every synced key so the next person on that phone does
not inherit a stranger's progression. Device-local keys stay. `auth-state.
js:73` already sweeps keys on deletion; the new keys must be in that sweep.

**Account deletion.** All seven tables must be added to the explicit list
in `supabase/functions/delete-account/index.ts`, before `profiles`. The
file deletes explicitly rather than trusting cascade by design; follow it.

**Clock skew.** Timestamps drive only `player_prefs`, one row per key, so a
skewed clock costs at most that key — not the whole blob. Equal timestamps
tiebreak on `device_id` so the rule stays commutative.

**Shared phone.** The merge cannot tell "my guest play" from "a stranger's
guest play on a borrowed phone." Sign-out clearing synced keys covers the
common case. Accepted, and named here rather than left silent.

**Offline / RPC failure.** Log, leave local state untouched, retry on the
next trigger. Sync failure must never surface to a player mid-session.

## Testing

Merge correctness is proven in the database with impersonated JWTs
(`set local request.jwt.claims`), not in the browser. The browser harness
is non-deterministic headless, so it validates wiring, not semantics.

The first draft's tests ("push in both orders, assert nothing decreased")
would have passed every one of the bugs review found — MAX never
decreases, it just fails to increase, and free coins are an *increase*.
Required tests:

- **Concurrent gain.** Both devices advance from a common ancestor; assert
  total XP equals ancestor + both deltas, not the max.
- **Purchase divergence.** Different items bought on each device; assert
  coins spent equals the true total.
- **Consumable replay.** Buy 3 freezes, consume 1, push twice; assert
  balance 2 and that replay neither restores nor double-charges.
- **Stale offline streak.** The Mon–Wed / stale-Monday / Thursday
  scenario; assert the streak is 4.
- **Three-way merge and replay**, proving associativity and idempotence —
  not just two orderings of two snapshots.
- **Backfill.** An existing user with `user_data.xp_data` lands on the
  correct XP.
- **Isolation.** One user's push cannot touch another's rows.
- **Deletion.** Zero rows across all seven tables after account deletion.
- **Browser smoke.** SMOKE PASS on all 8 screens with the module live.

## Future (out of scope, each its own spec)

`player_training_days` gives progression charts for free. Server-side XP
totals make an XP/streak leaderboard trivial. Friend challenges become
cheap once both exist.
