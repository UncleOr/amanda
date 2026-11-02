-- ═══ מנהרת הפרסים ═══
--
-- Or: *"we want to add a prize track like in Brawl Stars. We'll call it 'the
-- prize tunnel'... it works by trophies, and adds little prize stations
-- between the arenas."*
--
-- One row per prize TAKEN. Nothing here says where a player is on the track:
-- that is `best_trophies`, which the players table already holds and which
-- only ever goes up. What is owed is arithmetic; what is gone is this table.
--
-- The primary key is the whole rule. A claim is an insert, and claiming the
-- same stop twice is a duplicate key rather than a race the server has to win
-- by reading first — which is how the same prize gets handed over twice to
-- somebody tapping a button on a slow connection.
--
-- `lane` is 'free' or 'pass'. The Legendary Pass is not for sale yet and the
-- server refuses that lane outright (packages/shared/src/tunnel.ts,
-- PASS_FOR_SALE) — the column exists now so that the day it goes on sale is
-- not also the day of a migration.
--
-- `stop` is the INDEX into that same file's list, not a trophy count. The
-- trophy count of a stop may be re-balanced; a prize somebody already took
-- must not come back because it moved.

create table if not exists public.tunnel_claims (
  player_id  uuid not null references public.players (id) on delete cascade,
  stop       integer not null,
  lane       text not null default 'free' check (lane in ('free', 'pass')),
  claimed_at timestamptz not null default now(),
  primary key (player_id, stop, lane)
);

-- Every read is "what has this player taken", and the key already answers it.
-- No second index: the table is at most a few dozen rows per player.

alter table public.tunnel_claims enable row level security;

drop policy if exists "tunnel read own" on public.tunnel_claims;
create policy "tunnel read own" on public.tunnel_claims
  for select to authenticated using ((select auth.uid()) = player_id);

-- No write policy and no column grants. A row here is diamonds, cards and
-- chests handed over; a browser that could write one would not need to play
-- the game. The server writes them, after checking the trophies itself.
revoke insert, update, delete on public.tunnel_claims from anon, authenticated;
