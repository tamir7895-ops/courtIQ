# Progression sync — design

**Date:** 2026-07-26
**Status:** revised twice after spec review; ready for planning

## Revision history

**Draft 1** claimed no progression reaches Supabase. False: XP, badges and
the profile blob sync through `DataService.saveUserData` into
`profiles.user_data`. The grep behind the claim required the storage key
and the Supabase call on one line; in the source they sit on adjacent
lines.

**Draft 2** replaced MAX-on-scalars with per-device counters and derived
values. Review found the client half self-contradictory: `courtiq-xp.xp`
was simultaneously the per-device counter that gets pushed and the global
total written back on pull, making XP grow without bound on every sync
cycle — and, since `coins = xp − spent`, minting unlimited currency
irreversibly (`greatest` can never walk a row back).

This draft separates the pushed counter from the displayed total, defines
every derivation in SQL, and specifies the legacy reconstruction.

## Live bugs found during design

Both exist in the shipped app, independent of this project. They are
prerequisites because sync would otherwise entrench them.

**1. Every AI session grants double XP.**
`features/shot-tracking/ShotTrackingScreen.js:2823` calls
`ShotService.grantXP(userId, summary.xpEarned, …)`, which does
`data.xp += xpToAdd` on `courtiq-xp`
(`features/shot-tracking/shotService.js:229`). Line 2837 then calls
`XPSystem.grantXP(summary.xpEarned, …)`, which does `data.xp += amount`
on the same key (`js/gamification.js:78`). Neither guards against the
other. Players earn twice what the summary screen reports.

**2. Every signed-in player sees a 0-day streak.**
`profiles.streak` is `integer not null default 0`
(`20260101000000_baseline_core_schema.sql:18`) and nothing writes it.
`app-v10/lib/data.js:203` reads
`p.streak != null ? p.streak : localStreak()` — never null, so always 0.
Home, me, social, notifications and coach-ai all show 0 for signed-in
users while the real streak sits in localStorage.

**3. `saveUserData` loses updates across devices.**
`js/data-service.js:108` merges a patch against a **localStorage cache**,
then writes the whole `user_data` blob back. A device with a stale cache
overwrites newer keys written by another device. The comment at
`js/dashboard.js:179` states the failure mode outright.

## The problem

| Synced today (`profiles.user_data`) | Not synced |
|---|---|
| `xp_data`, `badges` | streak + freezes |
| `onboarding_data`, `player_profile` | shop purchases |
| | personal records |
| | training plan, saved drills |

Half of progression never leaves the phone; the half that does leave loses
data across devices. The streak — the mechanic that brings players back
daily — is the most fragile thing in the app and is in the unsynced half.

## Goals

- Progression survives reinstall and moves between phone and tablet.
- A conflict can never *lose* progression, and can never *manufacture* it.
- Works offline; sync failure is never visible to a player.
- No rewrite of the ~30 localStorage call sites.

## Non-goals

Real-time sync. Syncing device-local state (rim calibration, court spec,
offline queues, UI prefs, celebration-tier history).

## Merge semantics

Sync the **primitive facts**; derive everything else. Nothing that
accumulates is ever stored as a mergeable scalar, so nothing can drift.

| Data | Representation | Merge |
|---|---|---|
| XP | grow-only counter per device | `GREATEST` per device, `SUM` across |
| Training days | set of UTC days trained | UNION |
| Streak current/best | *derived* from days ∪ freeze-bridged days | — |
| Freeze grants | one row per freeze bought | UNION |
| Freeze uses | set of bridged days | UNION |
| Purchases | one row per item, **with cost** | UNION |
| Consumable spends | one row per spend, idempotency-keyed | UNION |
| Coins spent | *derived* = Σ purchase costs + Σ consumable costs | — |
| Badges earned | set of badge ids | UNION, `min(earned_at)` |
| Badge counters | *derived* from `ai_shots` / `ai_shot_sessions` | — |
| Personal best % | scalar | MAX |
| Saved drills | set | UNION + tombstone |
| Prefs | one row per key + timestamp | last write wins per key |

Every rule is commutative, associative and idempotent: sync order is
irrelevant and a replayed push is harmless.

### XP: the counter must never be fed back

`courtiq-xp` becomes `{ xp, earned, history }`:

- **`earned`** — XP earned on *this device under the current sign-in
  epoch*. Monotonic. **This is what gets pushed**, into
  `player_xp(user_id, device_id).xp`.
- **`xp`** — the display total. **Overwritten on pull** with
  `SUM(player_xp.xp)`. Never pushed.
- **`history`** — device-local, never synced, never overwritten.

Both writers that mutate XP (`js/gamification.js:78` and
`features/shot-tracking/shotService.js:234`) increment `earned` alongside
`xp`. Without this split the pull result becomes the next push payload and
XP compounds every cycle.

`device_id` lives in `courtiq_device_id` and is **regenerated on sign-out**.
Otherwise a device that signs out (clearing `earned` to 0) and then earns
500 as a guest would push `greatest(500, 3000) = 3000` and lose the 500.
A fresh id starts a fresh counter row, so guest earnings are *added*.

## Schema

```sql
create table player_xp (
  user_id    uuid not null references auth.users(id) on delete cascade,
  device_id  text not null,
  xp         integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create table player_training_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,               -- UTC day, matches the client
  primary key (user_id, day)
);

create table player_freeze_grants (
  user_id    uuid not null references auth.users(id) on delete cascade,
  ref        text not null,            -- idempotency key
  granted_at timestamptz not null default now(),
  primary key (user_id, ref)
);

create table player_freeze_uses (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,               -- the day this freeze bridged
  primary key (user_id, day)
);

create table player_purchases (
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_id      text not null,
  cost         integer not null default 0,
  purchased_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table player_consumables (
  user_id  uuid not null references auth.users(id) on delete cascade,
  ref      text not null,
  kind     text not null,
  cost     integer not null default 0,
  spent_at timestamptz not null default now(),
  primary key (user_id, ref)
);

create table player_badges (
  user_id   uuid not null references auth.users(id) on delete cascade,
  badge_id  text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table player_records (
  user_id     uuid not null references auth.users(id) on delete cascade,
  record_key  text not null,           -- 'session_pct', 'streak_best', …
  value       numeric not null,
  achieved_at timestamptz not null default now(),
  primary key (user_id, record_key)
);

create table player_saved_drills (
  user_id  uuid not null references auth.users(id) on delete cascade,
  drill_id text not null,
  saved_at timestamptz not null default now(),
  removed  boolean not null default false,   -- tombstone
  primary key (user_id, drill_id)
);

create table player_prefs (
  user_id   uuid not null references auth.users(id) on delete cascade,
  key       text not null,
  value     jsonb not null,
  client_ts timestamptz not null,
  device_id text not null default '',
  primary key (user_id, key)
);
```

**Ten tables.** RLS on every one: owner-only,
`(select auth.uid()) = user_id`, pinned to `authenticated`, `WITH CHECK` on
every write path. (The 2026-07-26 audit found two policies missing
`WITH CHECK` — do not repeat it.) All ten go into the explicit delete list
in `supabase/functions/delete-account/index.ts`, before `profiles`.

Progression stays out of `profiles`: identity is read on every screen,
progression changes on every shot.

## Derivations

### Streak

The canonical unit is the **UTC day**, because `js/streak.js:64` uses
`new Date().toISOString().slice(0,10)`. Every date the client writes and
every `session_date` the server reads must be cast the same way.

`js/streak.js` keeps `current` frozen until the next `checkIn()` — a
Mon–Wed player still sees 3 on Friday. A naive "run ending today"
derivation would return 0 and read as a lost streak. The grace rule:

```sql
create or replace function public.derive_streak(p_user uuid)
returns table (current integer, best integer)
language sql stable set search_path = '' as $$
  with covered as (
    select day from public.player_training_days where user_id = p_user
    union
    select day from public.player_freeze_uses     where user_id = p_user
  ),
  -- islands: consecutive days share (day - row_number)
  runs as (
    select day, day - (row_number() over (order by day))::integer as grp
    from covered
  ),
  spans as (
    select min(day) as from_day, max(day) as to_day, count(*)::integer as len
    from runs group by grp
  ),
  today as (select (now() at time zone 'utc')::date as d)
  select
    coalesce((select len from spans, today
              where spans.to_day in (today.d, today.d - 1)), 0),
    coalesce((select max(len) from spans), 0);
$$;
```

A run counts as live if it ends **today or yesterday**, matching the
client. `best` is the longest span ever, and is additionally mirrored into
`player_records['streak_best']` so a value earned before migration is not
lost when the day set only goes back as far as the backfill.

**Freeze bridging stays client-authored.** Only the client writes
`player_freeze_uses`, and only under the existing rule
(`js/streak.js:71`: `lastDate === today − 2` and a freeze available). The
server never spends a freeze, so it can never bridge a gap the player
never came back from.

### Coins

```
coins_spent = Σ player_purchases.cost + Σ player_consumables.cost
coins       = SUM(player_xp.xp) − coins_spent
freeze_balance = count(player_freeze_grants) − count(player_freeze_uses)
```

Nothing is stored, so nothing can disagree.

### Badge counters

`courtiq-badges` is `{ earned: {id: {ts}}, counters: {…} }`
(`js/badges.js:42`). Only `earned` syncs. The counters
(`totalShotsMade`, `totalAISessions`, `sessionsThisWeek`, `totalXP`) are
accumulating scalars — exactly the class that cannot merge safely — and
every one is derivable: makes and sessions from `ai_shots` /
`ai_shot_sessions`, XP from `player_xp`. They are recomputed on pull, not
merged.

### `hist` stays device-local

`courtiq_v11_bests` is `{ pct, hist: [≤20] }`, not a keyed record map.
Only `pct` syncs, as `player_records['session_pct']`.

Deriving `hist` from `ai_shot_sessions` was considered and rejected: the
denominators differ (`reveal.js` uses `sessionShots.length`, the table
stores `engine.stats` accuracy at one decimal), guest sessions never reach
the table at all (`shotService.js:243` returns early for anonymous), and
offline-queued sessions are missing until upload. A derivation that
disagrees with the client is worse than none.

Accepted cost: a restored device shows flat celebration tiers for three
sessions until `hist` refills. Cosmetic and self-healing.

## The sync RPC

`sync_player_state(p_state jsonb)` merges the client snapshot and returns
the authoritative merged state in one call.

- `v_user := auth.uid()` **inside** the function; any `user_id` in
  `p_state` is ignored. `raise exception` when null.
- `SECURITY INVOKER` — it only touches the caller's own rows, so RLS stays
  in force as defence in depth.
- `set search_path = ''`; fully-qualify everything, including `auth.uid()`.
- `revoke all … from public, anon; grant execute … to authenticated` — a
  new function is EXECUTE-able by PUBLIC by default.
- Reject oversized payloads (>2000 training days, >500 prefs) rather than
  letting a client push unbounded data.
- Each table merges in a **single** `insert … on conflict do update`.
  SELECT-then-UPDATE at READ COMMITTED still interleaves between two
  devices — the race this design exists to remove.
- Every input select uses `distinct on (<conflict key>)`, or a payload
  containing the same key twice raises *"ON CONFLICT DO UPDATE command
  cannot affect row a second time"*. This is reachable: `courtiq_notify`
  and `courtiq-notif-prefs` both map to `prefs['notify']`.

```sql
-- XP: per device, never decreases
insert into public.player_xp (user_id, device_id, xp)
select v_user, d.device_id, d.xp
from jsonb_to_recordset(p_state->'xp') as d(device_id text, xp integer)
on conflict (user_id, device_id) do update
  set xp = greatest(excluded.xp, public.player_xp.xp), updated_at = now();

-- sets
insert into public.player_training_days (user_id, day) select … 
on conflict do nothing;

-- records: max
insert into public.player_records (user_id, record_key, value) select …
on conflict (user_id, record_key) do update
  set value = greatest(excluded.value, public.player_records.value)
  where excluded.value > public.player_records.value;

-- prefs: LWW per key, clock clamped, deterministic tiebreak
insert into public.player_prefs (user_id, key, value, client_ts, device_id)
select distinct on (key) v_user, key, value,
       least(client_ts, now() + interval '5 minutes'), device_id
from jsonb_to_recordset(p_state->'prefs')
     as p(key text, value jsonb, client_ts timestamptz, device_id text)
order by key, client_ts desc
on conflict (user_id, key) do update
  set value = excluded.value, client_ts = excluded.client_ts,
      device_id = excluded.device_id
  where excluded.client_ts > public.player_prefs.client_ts
     or (excluded.client_ts = public.player_prefs.client_ts
         and excluded.device_id > public.player_prefs.device_id);
```

Clamping `client_ts` matters: a device whose clock reads 2030 would
otherwise win that key permanently.

## Prerequisites

Ordered. Each is independently shippable.

**P1 — fix the double XP grant.** Remove the `XPSystem.grantXP` call at
`ShotTrackingScreen.js:2837`; `ShotService.grantXP` already credits the
same amount. Without this the inflated value is what gets migrated.

**P2 — fix `saveUserData`.** Replace the localStorage-cache merge with a
server-side jsonb merge (`user_data = profiles.user_data || excluded.
user_data`) so the remaining blob keys stop losing updates.

**P3 — backfill.** Seed from existing data in one migration:

| Target | Source |
|---|---|
| `player_xp(user,'legacy')` | `user_data->'xp_data'->>'xp'` |
| `player_badges` | `user_data->'badges'->'earned'` |
| `player_training_days` | `ai_shot_sessions.session_date::date` (UTC), **plus** the client's synthesized run `lastDate−(current−1) … lastDate` |
| `player_records['streak_best']` | client `courtiq-streak.best` |
| `player_purchases` | `courtiq_shop_v12.owned`, cost from the catalog |
| `player_consumables` | one row, `ref='legacy:'‖user_id`, `cost = spent − Σcost(owned)` when positive |
| `player_freeze_grants` | N rows, `ref='legacy-freeze:'‖user_id‖':'‖i`, N = armed freeze count |

The residual consumable row is what stops the migration refunding every
coin ever spent on power-ups; the legacy freeze grants carry **no cost**,
because their price is already inside that residual. Deterministic `ref`s
keep the backfill idempotent across two devices.

**P4 — retire the old writers**, or XP will visibly change after each
sync: `js/gamification.js:44`, `js/badges.js:61`, `js/dashboard.js:758`,
`features/shot-tracking/shotService.js` (the `user_data.xp_data`
read-modify-write), and `js/dashboard.js:184`, which overwrites
`courtiq-xp` from the blob on launch — *after* sync wrote the merged
value. Repoint `data.js getProfile()` at the derived totals, which also
fixes the always-zero streak.

Only after P4 lands may `profiles.streak` be dropped. Not before: while
`data.js:203` still reads it, dropping it changes which wrong value is
shown rather than fixing anything.

**P5 — one avatar representation.** `dashboard.js:212` and
`js/avatar-shop.js:141` write avatar into `courtiq-onboarding-data` while
this design routes it through `player_prefs['avatar']`. Retire the former.

**P6 — client ledger support.** `avatar.js spend(amount, label)`
(`app-v10/lib/avatar.js:287`) increments `spent` without recording
anything in `owned`, so consumable spend is not reconstructible. It must
append `{ref, kind, cost}` to a ledger inside `courtiq_shop_v12`, with
`ref` a generated uuid. `StreakSystem.addFreeze` (`js/streak.js:44`) must
append a grant row, and `useFreeze()` must record the **date** it bridged.
`checkIn()` must append to a local `courtiq_training_days` set.

## localStorage → server mapping

| Key | Destination |
|---|---|
| `courtiq-xp.earned` | `player_xp` (this device) — `xp` and `history` never pushed |
| `courtiq_training_days` | `player_training_days` |
| `courtiq-streak.best` | `player_records['streak_best']` |
| `courtiq_streak_freeze` | `player_freeze_grants` + `player_freeze_uses` |
| `courtiq_shop_v12.owned` | `player_purchases` (with cost) |
| `courtiq_shop_v12.ledger` | `player_consumables` |
| `courtiq-badges.earned` | `player_badges` (counters derived) |
| `courtiq_v11_bests.pct` | `player_records['session_pct']` (`hist` stays local) |
| `courtiq_saved_drills` | `player_saved_drills` |
| `courtiq-training-plan-v1` | `player_prefs['plan']` |
| `courtiq_plan_prefs` | `player_prefs['plan_prefs']` |
| `courtiq_avatar_params`, `courtiq_avatar_url` | `player_prefs['avatar']` |
| `courtiq_notify` **or** `courtiq-notif-prefs` (pick one) | `player_prefs['notify']` |

Device-local, never synced: `courtiq-rim-calibration`, `courtiq-calib-v1`,
`courtiq-court-spec`, `courtiq-ai-*-offline`, `courtiq-sidebar-collapsed`,
`courtiq-skip-session-prep`, `courtiq_v11_bests.hist`, `courtiq-xp.history`,
avatar/face caches.

Already synced elsewhere, untouched: `courtiq_v12_chal`
(`challenge_claims`), `courtiq_coach_memory` (`coach_memory`).

## The sync module

`app-v10/lib/sync.js` exposing `V12Sync`. **ES5 only**: `var`,
`function () {}`, no template literals, arrow functions, `const`/`let`.
Registered in `app-v10/index.html` after `auth-state.js` and `lib/data.js`
(it depends on both); `node build.js` must run before any browser check.

**Pull + merge** on the `v10:auth` event — not DOM ready, because
`V10Auth.init()` resolves the session asynchronously
(`app-v10/auth-state.js:29`) and a pull that fires first calls the RPC
with a null `auth.uid()`.

Write the merged result back **field by field**: `courtiq-xp` keeps its
local `history` and `earned` while only `xp` is replaced. A whole-key
overwrite would destroy both.

**Push** uses the same RPC, on `visibilitychange` to background, on
`courtiq:session-saved`, and on a 60-second timer while active. Leaving
the app pushes, so switching devices is virtually always current. Calls
are debounced 5 seconds so a burst of XP grants yields one request.

Pull and push being the same idempotent call means one code path.

After a pull, dispatch `courtiq:state-synced` so open screens re-render.
Do not pull between a session save and the reveal animation — `classify()`
reads `hist` at that moment.

## Edge cases

**Guest plays, then signs in.** The guest's `earned` sits on the current
`device_id`, which has no server row for that account, so it is *added*.
Nothing is compared away.

**Sign-out.** Clear every synced key **and regenerate `courtiq_device_id`**
(required — see the XP section). Device-local keys stay. Add
`_sb_user_data_cache` to the sweep explicitly: `auth-state.js:74` matches
only `courtiq*`, so today a stale blob from the previous account survives
sign-out and the next `saveUserData` merges one person's XP and badges into
another's profile.

**Reinstall.** `device_id` is gone, so a fresh counter row starts at 0 and
the old rows keep their values — the SUM is preserved.

**Shared phone.** The merge cannot distinguish "my guest play" from "a
stranger's guest play on a borrowed phone." Sign-out clearing synced keys
covers the common case. Accepted, and named rather than left silent.

**Offline / RPC failure.** Log, leave local state untouched, retry on the
next trigger. Never surfaced to a player mid-session.

## Testing

Merge correctness is proven **in the database** with impersonated JWTs
(`set local request.jwt.claims`). The browser harness is non-deterministic
headless, so it validates wiring, not semantics.

Draft 2's tests ("push in both orders, assert nothing decreased") would
have passed every bug review found — MAX never decreases, it just fails to
increase, and inflated XP is an *increase*. Required:

- **Idempotence under round-trip.** Push→pull→push three times on one
  device; assert total XP is unchanged. This is the test that catches the
  inflation loop.
- **Concurrent gain.** Two devices advance from a common ancestor; assert
  total equals ancestor + both deltas.
- **Sign-out epoch.** Sign in, earn, sign out, earn as guest, sign in;
  assert both amounts survive.
- **Purchase divergence.** Different items on each device; assert coins
  spent equals the true total.
- **Consumable replay.** Buy 3 freezes, consume 1, push twice; assert
  balance 2, no double charge, no restored use.
- **Stale offline streak.** Mon–Wed on the phone, stale tablet at Monday
  trains Thursday; assert 4.
- **Grace day.** Trained Mon–Wed, query Friday; assert 3, not 0.
- **Three-way merge and replay**, proving associativity and idempotence.
- **Backfill.** An existing user lands on the correct XP, and derived
  coins equal their pre-migration `coins()`.
- **Isolation.** One user's push cannot touch another's rows.
- **Deletion.** Zero rows across all ten tables.
- **Browser smoke.** SMOKE PASS on all 8 screens with the module live.

## Future (out of scope, each its own spec)

`player_training_days` gives progression charts for free. Server-side XP
totals make an XP/streak leaderboard trivial. Friend challenges become
cheap once both exist.
