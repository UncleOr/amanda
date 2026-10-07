-- Everything Or should be able to change without a deploy.
--
-- His ask: *"in the admin interface I need to be able to manage everything:
-- items in the shop including prices, and to add new ones and delete and
-- temporarily take down from the shop, cards, series, sales, phrases,
-- including assigning and giving things to users. Think what else needs
-- managing in the admin interface and add it."*
--
-- Most of that already existed. This migration adds the four that did not,
-- and every one of them follows the rule card_overrides set: the game ships
-- with all of its own content and plays perfectly with these tables EMPTY. A
-- row means Or changed his mind. A child opening the game is never waiting on
-- a fetch to find out what a dragon does, what the shop sells, or what their
-- catchphrase says.

-- ── 1. sales ───────────────────────────────────────────────────────
--
-- `price_diamonds` is what a thing costs. A sale is not a different price —
-- it is a price WITH A DEADLINE, and the deadline is the whole mechanism: a
-- price that quietly reverts needs nobody to remember to revert it, and a
-- shop that shows the old price crossed out is the only reason a sale works
-- at all.
--
-- Two columns rather than a sales table, because a sale is a property of the
-- item and an item has at most one. A table would buy history nobody asked
-- for and cost a join on the hottest read in the game.
alter table public.shop_items
  add column if not exists sale_price_diamonds integer
    check (sale_price_diamonds is null or sale_price_diamonds >= 0);
alter table public.shop_items
  add column if not exists sale_until timestamptz;

comment on column public.shop_items.sale_price_diamonds is
  'On sale at this price until sale_until. Null means no sale. The full price stays in price_diamonds so the shop can show what it was.';

-- ── 2. phrases ─────────────────────────────────────────────────────
--
-- Catchphrases live in packages/shared/src/catchphrases.ts, which means every
-- new line Or writes is a deploy — and he is the copywriter. He wrote four and
-- I drafted four more as placeholders, which is exactly the situation this
-- table ends: the words become a row he can fix at 11pm without me.
--
-- `data` is a whole Catchphrase object in the shape the client already knows:
-- { id, tone, he, heF?, en?, free?, style, item? }. jsonb rather than columns
-- for the same reason as the cards — `style` is an open set that grows, and a
-- gendered variant is a key that is usually absent.
create table if not exists public.phrase_overrides (
  id text primary key,
  -- False takes a line out of the game without losing what it said. A line
  -- that ships in the file cannot be deleted; this is what "delete" means for
  -- one of those, and it can be undone.
  active boolean not null default true,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.phrase_overrides enable row level security;
drop policy if exists phrase_overrides_readable on public.phrase_overrides;
create policy phrase_overrides_readable on public.phrase_overrides
  for select to anon, authenticated using (true);
grant select on public.phrase_overrides to anon, authenticated;
revoke insert, update, delete, truncate on public.phrase_overrides from anon, authenticated;

-- ── 3. series ──────────────────────────────────────────────────────
--
-- A series is the shelf a card sits on in the album: its name, the order the
-- shelves come in, and whether it is on show at all. The cards themselves are
-- already editable (card_overrides) — this is the thing holding them, which
-- was the one layer with no way in.
--
-- Deliberately NOT the cards. `card_overrides.series_id` already says which
-- shelf a card belongs to, and putting the membership in both places would
-- mean two answers to one question.
create table if not exists public.series_overrides (
  id text primary key,
  active boolean not null default true,
  -- { name: {he, en}, synergy?: {...} } — the parts of a series that are not
  -- its cards. Absent keys keep whatever the file says.
  data jsonb not null default '{}'::jsonb,
  -- Where the shelf sits in the album. Null keeps the file's own order.
  sort integer,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.series_overrides enable row level security;
drop policy if exists series_overrides_readable on public.series_overrides;
create policy series_overrides_readable on public.series_overrides
  for select to anon, authenticated using (true);
grant select on public.series_overrides to anon, authenticated;
revoke insert, update, delete, truncate on public.series_overrides from anon, authenticated;

-- ── 4. what else needs managing ────────────────────────────────────
--
-- Or asked me to think of the rest. The first answer is the one that is not
-- content: the NUMBERS the game runs on — what a win is worth, how long the
-- build phase lasts, how much beating the computer pays.
--
-- There is already a list of exactly which of those are safe to turn:
-- packages/shared/src/tunables.ts, which explains at length why the board
-- being 4x4 and the King having triple health are NOT on it (one is baked
-- into the engine, the other would desync a replay). It has a reader, a
-- clamping writer, Or's own Hebrew label and a note on every dial — and it is
-- imported by nothing at all. It was written for an admin panel that never
-- got a table to read from. This is that table.
--
-- JUST THE VALUE. The bounds, the label and the warning stay in the code
-- beside the dial they belong to; duplicating them here would make two
-- answers to "what is the most this may be", and the one the server enforces
-- would not be the one the panel shows.
create table if not exists public.tunables (
  -- Matches a TUNABLES entry's id, e.g. "trophies.win". An id the code does
  -- not know is ignored rather than refused: a row left behind by an older
  -- panel must never be the reason a child cannot play.
  id text primary key,
  value numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.tunables enable row level security;
-- Everyone reads them: the browser needs the same phase lengths the server
-- is counting down with.
drop policy if exists tunables_readable on public.tunables;
create policy tunables_readable on public.tunables
  for select to anon, authenticated using (true);
grant select on public.tunables to anon, authenticated;
revoke insert, update, delete, truncate on public.tunables from anon, authenticated;
