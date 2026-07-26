# Progression sync — design

**Date:** 2026-07-26
**Status:** approved, ready for planning

## The problem

Every piece of a player's progression lives only on their phone. Verified
by grep: `courtiq-xp`, `courtiq-streak`, `courtiq-badges`,
`courtiq_shop_v12`, `courtiq_v11_bests`, `courtiq-training-plan-v1` and the
avatar keys are never written to Supabase by any code path.

So a player who reinstalls, upgrades their phone, or clears storage loses
their XP, streak, badges, shop purchases, personal records, training plan
and avatar. Only shot sessions survive, because those go through
`save_ai_session_atomic`.

The streak is the mechanic that brings people back daily, and it is the
most fragile thing in the app.

`profiles.streak` exists in the database but nothing writes to it — a dead
column from the v10 era.

## Goals

- Progression survives reinstall and moves between a phone and a tablet.
- A conflict can never *lose* progression.
- Works offline; the app must never block or fail because sync is down.
- No rewrite of the ~30 call sites that write to localStorage today.

## Non-goals

- Real-time sync. A short window where two devices disagree is acceptable.
- Historical progression charts (would need an event log — see Future).
- Syncing device-local state: rim calibration, court spec, offline queues,
  UI preferences. These are correctly per-device.

## Merge semantics

The core of the design. Naive last-write-wins destroys data: train on the
tablet to 900 XP, open the phone still holding 780, and a blind push
erases 120 XP. Each field gets the rule its meaning demands.

| Data | Rule | Why |
|---|---|---|
| `xp`, `coins_spent` | MAX | Both only ever increase |
| `streak_best` | MAX | A record never falls |
| `streak_current` + `streak_last_date` | Take the row with the later `last_date`; on a tie, MAX of current | The true streak belongs to the most recent training day |
| badges, purchases | UNION | An earned badge cannot be un-earned |
| personal records | MAX per record key | Each record is independent |
| prefs blob (plan, avatar, notifications) | Last write wins, by client timestamp | Edits, not accumulations — newest intent is correct |

Under these rules merging is commutative and idempotent, so sync order
does not matter and a replayed push is harmless.

`coins = xp - coins_spent` is derived, never stored, so it cannot drift.

## Where the merge runs

**Server-side, inside a single RPC.** The client sends its whole snapshot;
`sync_player_state(p_state jsonb)` merges it against the stored row and
returns the authoritative merged state in the same call.

Client-side merging was the obvious first instinct, but it has a race: two
devices both read, both merge locally, both write, and the second silently
overwrites the first. Doing it in one server statement makes that
impossible, and it halves the round trips.

## Schema

Queryable values become real columns — that is what makes an XP or streak
leaderboard possible, which the current board (ranked by makes only)
cannot do. Values that are only ever read as a lump stay JSON.

```sql
create table player_progress (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  xp                integer not null default 0,
  coins_spent       integer not null default 0,
  streak_current    integer not null default 0,
  streak_best       integer not null default 0,
  streak_last_date  date,
  updated_at        timestamptz not null default now()
);

create table player_badges (
  user_id   uuid not null references auth.users(id) on delete cascade,
  badge_id  text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table player_purchases (
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_id      text not null,
  purchased_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table player_records (
  user_id     uuid not null references auth.users(id) on delete cascade,
  record_key  text not null,
  value       numeric not null,
  achieved_at timestamptz not null default now(),
  primary key (user_id, record_key)
);

create table player_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  client_ts  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

The composite primary keys give UNION merge for free: `on conflict do
nothing` for badges and purchases, `on conflict do update where excluded.
value > player_records.value` for records.

Progression is deliberately **not** added to `profiles`. `profiles` is
identity and is read on every screen; progression changes on every shot.
Keeping them apart stops XP writes from churning the row that RLS checks
constantly.

`profiles.streak` gets dropped — `player_progress` replaces it.

RLS on all five tables: owner-only, `(select auth.uid()) = user_id`, with
`WITH CHECK` on every write path. (The audit on 2026-07-26 found two
policies missing `WITH CHECK`; do not repeat that.)

## localStorage → server mapping

| localStorage key | Shape | Destination |
|---|---|---|
| `courtiq-xp` | `{ xp, history }` | `player_progress.xp` (history dropped — device-local noise) |
| `courtiq-streak` | `{ current, best, lastDate }` | `player_progress.streak_*` |
| `courtiq_shop_v12` | `{ owned:[], spent }` | `player_purchases` + `player_progress.coins_spent` |
| `courtiq-badges` | keyed object | `player_badges` |
| `courtiq_v11_bests` | keyed object | `player_records` |
| `courtiq-training-plan-v1` | object | `player_prefs.plan` |
| `courtiq_plan_prefs` | object | `player_prefs.plan_prefs` |
| `courtiq_avatar_params`, `courtiq_avatar_url` | object / string | `player_prefs.avatar` |
| `courtiq_notify`, `courtiq-notif-prefs` | object | `player_prefs.notify` |

Not synced (correctly device-local): `courtiq-rim-calibration`,
`courtiq-calib-v1`, `courtiq-court-spec`, `courtiq-ai-*-offline`,
`courtiq-sidebar-collapsed`, `courtiq-skip-session-prep`, avatar/face
caches.

Already synced elsewhere, leave alone: `courtiq_v12_chal`
(`challenge_claims`), `courtiq_coach_memory` (`coach_memory`).

## The sync module

New file `app-v10/lib/sync.js`, exposing `V12Sync`.

**Pull + merge (on launch, and on sign-in):** read every mapped key into a
snapshot, call `sync_player_state`, write the returned merged state back to
localStorage, then dispatch `courtiq:state-synced` so open screens
re-render.

**Push:** the same call, fired on `visibilitychange` (going to background),
on `courtiq:session-saved`, and on a 60-second timer while the app is
active. Since leaving the app pushes, switching devices is virtually always
current in practice.

Because pull and push are the same idempotent RPC, there is one code path
to get right, not two.

**Debounce:** coalesce calls within 5 seconds so a burst of XP grants
during a session produces one request.

## Edge cases

**Guest plays, then signs in.** The guest's local progression is real and
must not be discarded. Sign-in runs the same merge, so a guest with 500 XP
signing into an account with 900 lands on 900 with their badges unioned in;
a brand-new account inherits the full 500.

**Sign-out.** Clear every *synced* key so the next person on that phone
does not inherit a stranger's progression. Device-local keys stay.

**Clock skew.** Client timestamps drive only the prefs blob, where being
wrong costs one overwritten preference. Every accumulating value uses MAX
or UNION, which no clock can corrupt.

**Offline / RPC failure.** Log, keep the local state untouched, retry on
the next trigger. Sync failure must never surface as an error to a player
mid-session.

## Testing

- **Merge rules, in the database.** Impersonate two users with
  `set local request.jwt.claims`, push conflicting snapshots in both
  orders, assert the result is identical and nothing decreased. This is
  the test that matters most and it needs no browser.
- **Isolation.** Confirm one user's push can never touch another's rows —
  the same impersonation check used for the leaderboard.
- **Guest→sign-in.** Local snapshot with XP 500 merged into a server row
  with 900 yields 900 and the union of badges.
- **Sign-out.** Synced keys cleared, device-local keys retained.
- **Browser smoke.** SMOKE PASS across all 8 screens with the module live.

## Future (explicitly out of scope)

Once progression is server-side these become cheap, and each is its own
spec: an XP/streak leaderboard, a daily snapshot table for progression
charts, and friend challenges.
