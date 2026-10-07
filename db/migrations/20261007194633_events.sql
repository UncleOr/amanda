-- What happened, so the admin panel can be asked about it.
--
-- Or: *"in the admin panel give me statistics too — how many games each user
-- played, how many wins, losses, app usage, purchases, user behaviour
-- (abandoning mid-game for instance), how many playground games, what users
-- like most. Think of lots of information and statistics I can get."*
--
-- Almost none of that was answerable, and not because the queries were hard:
-- the game was not writing it down. `matches` holds PvP games only and had
-- five rows against fifty players, because every game against the computer,
-- every playground session, every quit and every time somebody opened the app
-- left no trace at all.
--
-- ONE APPEND-ONLY TABLE, not a column added to six others. A statistic nobody
-- has asked for yet is the normal case, and a shape that has to be migrated
-- for each new question is a shape that stops being asked questions. `kind`
-- says what happened and `data` says the rest, so "how many people quit during
-- the build phase" is a query rather than a schema change.
--
-- ═══ WHAT IS DELIBERATELY NOT IN HERE ═══
--
-- This is a game for children and it is going to a store that checks. There is
-- no advertising id, no device fingerprint, no third-party analytics SDK, no
-- location, and no free text a player typed. Every row is an action inside the
-- game, attached to an account the player made, in Or's own database — and it
-- dies with the account, which is what the cascade below is for.
create table if not exists public.events (
  id bigserial primary key,
  -- Null is allowed and means a guest: somebody who opened the game without an
  -- account still counts in "how many people played today".
  player_id uuid references public.players (id) on delete cascade,
  -- 'open', 'match', 'quit', 'playground', 'buy', 'chest', 'claim'.
  -- Deliberately not a check constraint: a new kind of thing worth counting
  -- should be a line of TypeScript, not a migration and a deploy.
  kind text not null,
  at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

-- The two shapes every question has: "what happened lately" and "what did this
-- person do". Both descending, because every screen that asks starts with the
-- most recent.
create index if not exists events_kind_at on public.events (kind, at desc);
create index if not exists events_player_at on public.events (player_id, at desc);

alter table public.events enable row level security;
-- Nobody reads this but the server with its service key. A player has no
-- business reading anybody's history including their own — there is nothing in
-- it they cannot already see in the game, and a readable log is a log that has
-- to be designed around being read.
revoke all on public.events from anon, authenticated;
