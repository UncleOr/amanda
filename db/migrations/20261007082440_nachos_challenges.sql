-- Nachos and challenges: the two counters that are always nearly full.
--
-- Or: "we have to create a situation where the player is always one or two
-- games away from some goal. Always 3 trophies, or 2 diamonds, or 3 cards away
-- from getting something." Trophies cannot do that on their own, because a
-- loss takes them back; these two only ever go forwards.
--
-- ═══ TWO COLUMNS FOR NACHOS, NOT ONE ═══
--
-- `nachos` is the lifetime count and `nacho_chests` is how many chests have
-- actually been handed over. The bar on screen is the remainder, so one column
-- would do — right up until the bar size changes. If a chest were minted
-- whenever `nachos / 5` passed a whole number and that 5 became a 4, every
-- player in the game would be owed a pile of chests they had already been
-- given. Keeping the count of what was PAID separate makes the bar size a
-- display decision rather than a migration.
--
-- ═══ AND NO TABLE OF CHALLENGES ═══
--
-- There is deliberately no `challenges` table. Which three are live today is a
-- function of today's date, computed identically in the browser and on the
-- server (packages/shared/src/challenges.ts), so there is nothing to schedule,
-- nothing to seed, and no day that can end up with no challenges in it because
-- a job did not run. The only thing worth storing is how far along a
-- particular player is, which is what this table is.

alter table public.players
  -- Lifetime nachos. Never decreases: this is the counter that keeps moving
  -- on an evening where the trophies went backwards.
  add column if not exists nachos       integer not null default 0,
  -- How many nacho chests have been handed over. See above.
  add column if not exists nacho_chests integer not null default 0;

-- ── how far along one player is on one challenge ───────────────────
create table if not exists public.player_challenges (
  player_id    uuid not null references public.players (id) on delete cascade,
  -- "d:2026-10-07:1" — the period, the period's key, and which template.
  -- Computed, not a foreign key: see the note at the top.
  challenge_id text not null,
  progress     integer not null default 0,
  -- Set when the reward was handed over, so it cannot be handed over twice.
  claimed_at   timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (player_id, challenge_id)
);

-- "What am I in the middle of" — every read is for one player, newest first.
create index if not exists player_challenges_recent_idx
  on public.player_challenges (player_id, updated_at desc);

alter table public.player_challenges enable row level security;

drop policy if exists "challenges read own" on public.player_challenges;
create policy "challenges read own" on public.player_challenges
  for select to authenticated using ((select auth.uid()) = player_id);

-- No write policy and no column grants. Progress is decided by the server from
-- a battle it re-ran itself, and claiming pays diamonds — a browser that could
-- write either of these would not need to play the game.
revoke insert, update, delete on public.player_challenges from anon, authenticated;
