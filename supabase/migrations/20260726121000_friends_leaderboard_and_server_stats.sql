-- ═══════════════════════════════════════════════════════════════════
-- FRIENDS + LEADERBOARD + SERVER-SIDE STATS
--
-- Two gaps this closes:
--  1. Social was honest but empty — the screen said "a league of one"
--     because no friends table existed at all and "Invite friends" led
--     nowhere in the backend.
--  2. The app pulled up to 2000 shot rows to the client just to count
--     makes per zone. Fine at 767 rows; megabytes per app-open once a
--     player has real history.
--
-- Applied 2026-07-26. Verified with impersonated JWTs: a friend sees the
-- aggregate leaderboard and NOTHING else (0 raw shots, 0 raw sessions).
-- ═══════════════════════════════════════════════════════════════════

-- ── friendships ──────────────────────────────────────────────────────
create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users(id) on delete cascade,
  addressee_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending','accepted','blocked')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

create index if not exists friendships_requester_idx
  on public.friendships (requester_id, status);
create index if not exists friendships_addressee_idx
  on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;

drop policy if exists "friendships: see own" on public.friendships;
create policy "friendships: see own" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists "friendships: request as self" on public.friendships;
create policy "friendships: request as self" on public.friendships
  for insert to authenticated
  with check ((select auth.uid()) = requester_id);

-- Only the addressee answers; WITH CHECK stops them rewriting the pair.
drop policy if exists "friendships: respond as addressee" on public.friendships;
create policy "friendships: respond as addressee" on public.friendships
  for update to authenticated
  using ((select auth.uid()) = addressee_id)
  with check ((select auth.uid()) = addressee_id);

drop policy if exists "friendships: remove own" on public.friendships;
create policy "friendships: remove own" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));


-- ── friend codes ─────────────────────────────────────────────────────
-- Adding by e-mail would let anyone probe whether an address has an
-- account. A short shareable code leaks nothing. Alphabet excludes
-- O/0/I/1 so a code read aloud is unambiguous.

alter table public.profiles add column if not exists friend_code text;

create unique index if not exists profiles_friend_code_idx
  on public.profiles (friend_code) where friend_code is not null;

create or replace function public.gen_friend_code()
returns text language sql volatile
set search_path to 'public'
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                           (floor(random()*32)+1)::int, 1), '')
  from generate_series(1,6);
$$;

do $$
declare r record; c text;
begin
  for r in select id from public.profiles where friend_code is null loop
    loop
      c := public.gen_friend_code();
      begin
        update public.profiles set friend_code = c where id = r.id;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  end loop;
end $$;

create or replace function public.set_friend_code()
returns trigger language plpgsql
set search_path to 'public'
as $$
begin
  if new.friend_code is null then
    new.friend_code := public.gen_friend_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_friend_code on public.profiles;
create trigger profiles_set_friend_code
  before insert on public.profiles
  for each row execute function public.set_friend_code();


-- ── add_friend_by_code ───────────────────────────────────────────────
-- SECURITY DEFINER because it must resolve a code against a profile RLS
-- would otherwise hide. It reveals nothing: an unknown code and your own
-- code return the identical generic failure.

create or replace function public.add_friend_by_code(p_code text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  v_target uuid;
  v_existing text;
begin
  if v_me is null then raise exception 'authentication required'; end if;

  select id into v_target from profiles where friend_code = upper(trim(p_code));

  if v_target is null or v_target = v_me then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select status into v_existing from friendships
   where (requester_id = v_me and addressee_id = v_target)
      or (requester_id = v_target and addressee_id = v_me)
   limit 1;

  if v_existing is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_' || v_existing);
  end if;

  -- If they already asked us, accept rather than create a mirror row.
  update friendships set status = 'accepted', responded_at = now()
   where requester_id = v_target and addressee_id = v_me and status = 'pending';
  if found then
    return jsonb_build_object('ok', true, 'status', 'accepted');
  end if;

  insert into friendships (requester_id, addressee_id) values (v_me, v_target);
  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$$;

revoke all on function public.add_friend_by_code(text) from public, anon;
grant execute on function public.add_friend_by_code(text) to authenticated;


-- ── friend_leaderboard ───────────────────────────────────────────────
-- Aggregates over the caller + accepted friends. SECURITY DEFINER so it
-- can read friends' names and session totals — but it returns only the
-- board. Raw shots and sessions stay sealed behind RLS (verified).

create or replace function public.friend_leaderboard(p_days integer default 7)
returns table (
  user_id uuid, display_name text, is_me boolean,
  attempts bigint, made bigint, accuracy numeric, sessions bigint
)
language sql security definer stable
set search_path to 'public'
as $$
  with me as (select auth.uid() as id),
  circle as (
    select (select id from me) as uid
    union
    select case when f.requester_id = (select id from me)
                then f.addressee_id else f.requester_id end
    from friendships f
    where f.status = 'accepted'
      and (select id from me) in (f.requester_id, f.addressee_id)
  )
  select c.uid,
         nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
         c.uid = (select id from me),
         coalesce(sum(s.total_attempts), 0)::bigint,
         coalesce(sum(s.total_made), 0)::bigint,
         case when coalesce(sum(s.total_attempts),0) > 0
              then round(100.0 * sum(s.total_made) / sum(s.total_attempts), 1)
              else 0 end,
         count(s.id)::bigint
  from circle c
  left join profiles p on p.id = c.uid
  left join ai_shot_sessions s
         on s.user_id = c.uid
        and s.session_date >= now() - (p_days || ' days')::interval
  where auth.uid() is not null
  group by c.uid, p.first_name, p.last_name
  order by 5 desc, 4 desc;
$$;

revoke all on function public.friend_leaderboard(integer) from public, anon;
grant execute on function public.friend_leaderboard(integer) to authenticated;


-- ── my_zone_stats ────────────────────────────────────────────────────
-- Does the per-zone arithmetic where the data already lives. SECURITY
-- INVOKER on purpose: RLS still scopes every row to the caller, so this
-- cannot leak another player's shots even by accident.

create or replace function public.my_zone_stats(p_days integer default 3650)
returns table (shot_zone text, attempts bigint, made bigint, accuracy numeric)
language sql security invoker stable
set search_path to 'public'
as $$
  select coalesce(shot_zone, 'unknown'),
         count(*)::bigint,
         count(*) filter (where shot_result = 'made')::bigint,
         case when count(*) > 0
              then round(100.0 * count(*) filter (where shot_result = 'made') / count(*), 1)
              else 0 end
  from ai_shots
  where "timestamp" >= now() - (p_days || ' days')::interval
  group by coalesce(shot_zone, 'unknown')
  order by 2 desc;
$$;

revoke all on function public.my_zone_stats(integer) from public, anon;
grant execute on function public.my_zone_stats(integer) to authenticated;

create index if not exists ai_shots_user_ts_idx
  on public.ai_shots (user_id, "timestamp" desc);
