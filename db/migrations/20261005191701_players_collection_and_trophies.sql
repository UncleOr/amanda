-- Amanda: who a player is, what they own, and how they are doing.
--
-- What a CARD is stays in data/ as JSON, validated by Zod and shipped with the
-- build. Only what a PLAYER has is here. Putting card stats in both places
-- would guarantee they drift.

-- ── who ────────────────────────────────────────────────────────────
-- One row per player, keyed by Supabase auth so an anonymous account made on
-- first launch can later be linked to Google Play Games / Game Center without
-- moving any of this.
create table public.players (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Skill. Moves on a win or a loss, written only by the server.
  trophies     integer not null default 0 check (trophies >= 0),
  -- Collection strength, derived from owned cards and their levels. Kept
  -- alongside trophies because matchmaking has to read both: trophies measure
  -- skill, this measures time spent, and pairing on skill alone is what makes
  -- a card-levelling game feel unfair.
  album_power  integer not null default 0 check (album_power >= 0),
  tutorial_done boolean not null default false,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ── what they own ──────────────────────────────────────────────────
-- card_id is the id from data/series/*.json; deliberately not a foreign key,
-- because the catalog lives in the build, not in this database.
create table public.player_cards (
  player_id  uuid not null references public.players (id) on delete cascade,
  card_id    text not null,
  -- Copies are the placement budget: a card may go on the board as many times
  -- as you hold copies of it. This is what makes a duplicate worth something
  -- from the second one onward instead of only at an upgrade threshold.
  copies     integer not null default 1 check (copies >= 0),
  -- Height rather than width: copies can be spent to raise this instead of
  -- being kept. That trade is the choice the player gets to make.
  level      integer not null default 1 check (level >= 1),
  obtained_at timestamptz not null default now(),
  primary key (player_id, card_id)
);

-- ── chests ─────────────────────────────────────────────────────────
create table public.chests (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  kind       text not null,
  earned_at  timestamptz not null default now(),
  opened_at  timestamptz,
  -- What it turned out to hold, written when it is opened.
  contents   jsonb
);
create index chests_unopened_idx on public.chests (player_id) where opened_at is null;

-- ── match history ──────────────────────────────────────────────────
-- The trophy record. Written by the server, which already decides who won.
create table public.matches (
  id             uuid primary key default gen_random_uuid(),
  player_a       uuid references public.players (id) on delete set null,
  player_b       uuid references public.players (id) on delete set null,
  winner         uuid references public.players (id) on delete set null,
  trophies_delta integer not null default 0,
  played_at      timestamptz not null default now()
);
create index matches_player_a_idx on public.matches (player_a, played_at desc);
create index matches_player_b_idx on public.matches (player_b, played_at desc);

-- ── row level security ─────────────────────────────────────────────
-- Everything is off by default; a player may READ their own rows and nothing
-- else. Nothing here is writable from the client: trophies, copies, levels and
-- chest contents are all things a player would otherwise simply edit. Writes
-- arrive from the server with the service role, which bypasses these policies.
alter table public.players      enable row level security;
alter table public.player_cards enable row level security;
alter table public.chests       enable row level security;
alter table public.matches      enable row level security;

create policy "players read self" on public.players
  for select to authenticated using ((select auth.uid()) = id);

-- A display name is the one thing a player may change about themselves.
create policy "players rename self" on public.players
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "cards read own" on public.player_cards
  for select to authenticated using ((select auth.uid()) = player_id);

create policy "chests read own" on public.chests
  for select to authenticated using ((select auth.uid()) = player_id);

create policy "matches read own" on public.matches
  for select to authenticated
  using ((select auth.uid()) = player_a or (select auth.uid()) = player_b);
