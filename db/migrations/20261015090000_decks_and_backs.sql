-- ════════ THE DECKS YOU BUILD, AND WHAT THEY LOOK LIKE ════════
--
-- Or: "we also need to add a deck-building screen — you pick X cards from the
-- ones you have and only those are in the deck… there should be a way to save
-- at least 3 decks, each with a unique name and a unique card-back design —
-- every player starts with 5 designs and can buy more, add it to the shop,
-- exactly like the catchphrases… deck building is a significant part of the
-- appeal. I want YouTubers showing what decks they built."
--
-- ── WHY THE CARDS ARE AN ARRAY AND NOT A TABLE ─────────────────────
--
-- A deck is sixteen card ids WITH DUPLICATES AND IN NO ORDER — three copies
-- of the same card is the common case, not an error. A join table would need
-- a copy index to hold that, and every read of a deck would be a join for
-- data that is only ever read whole, written whole, and is one row's worth.
-- The array IS the deck.
--
-- Nothing here validates the deck. The rules live in one place
-- (packages/shared/src/decks.ts) because the builder, the save and the match
-- all need the same answer, and a CHECK constraint here would be a second
-- version of them that drifts the first time Or re-prices a card. What the
-- database guarantees is what only it can: that the deck belongs to you,
-- that you do not keep more than three, and that two of yours are not called
-- the same thing.

create table public.decks (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 18),
  -- Sixteen card ids; duplicates are the point. See above.
  cards      text[] not null default '{}',
  -- A CardBack id from packages/shared/src/cardBacks.ts. Not a foreign key:
  -- the backs are code, not rows, for the same reason the catchphrases are.
  back       text not null default 'fog',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Or asked for unique names, and this is the only place that can mean it.
create unique index decks_name_per_player on public.decks (player_id, lower(btrim(name)));
create index decks_by_player on public.decks (player_id, created_at);

/*
 * Which one you are playing with.
 *
 * On the player rather than a flag on the deck: "exactly one is active" is an
 * invariant a column enforces for free and a boolean needs a trigger for. Null
 * means the game builds one for you, which is what happens for everybody who
 * never opens the screen.
 */
alter table public.players
  add column active_deck uuid references public.decks (id) on delete set null;

-- ── three, and no more ─────────────────────────────────────────────
--
-- A trigger rather than a check, because the limit is about the TABLE and a
-- check only sees the row. Counted inside the insert's own transaction, so two
-- taps on a slow connection cannot both find two and both write a third.
create or replace function public.decks_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if (select count(*) from public.decks where player_id = new.player_id) >= 3 then
    raise exception 'deck_limit' using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger decks_limit_trigger
  before insert on public.decks
  for each row execute function public.decks_limit();

create or replace function public.decks_touch()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

create trigger decks_touch_trigger
  before update on public.decks
  for each row execute function public.decks_touch();

-- ── and they are yours ─────────────────────────────────────────────
alter table public.decks enable row level security;

create policy "decks read own" on public.decks
  for select to authenticated using ((select auth.uid()) = player_id);
create policy "decks write own" on public.decks
  for insert to authenticated with check ((select auth.uid()) = player_id);
create policy "decks update own" on public.decks
  for update to authenticated using ((select auth.uid()) = player_id)
  with check ((select auth.uid()) = player_id);
create policy "decks delete own" on public.decks
  for delete to authenticated using ((select auth.uid()) = player_id);

-- ════════ THE SIX BACKS THAT ARE NOT FREE ════════
--
-- Five are free and they are the five families — scales, slime, web, leaves,
-- and the fog every card already hides behind — so the first thing a player
-- can do with the builder is make a deck that LOOKS like what is in it.
--
-- These six are the ones worth wanting. Priced like the catchphrases, which
-- they are the same kind of thing as: nobody needs one, everybody sees yours.
--
-- `kind` is a closed list and this widens it, the same way the phrases did.
alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items
  add constraint shop_items_kind_check
  check (kind in ('avatar', 'emoji', 'skin', 'card', 'chest', 'phrase', 'back'));

insert into public.shop_items (id, kind, name, blurb, price_diamonds, sort)
values
  (
    'back.gold',
    'back',
    '{"he":"גב זהב","en":"Gold back"}'::jsonb,
    '{"he":"לקלפים שלך. היריב רואה אותו כל הקרב","en":"On your cards. Your opponent looks at it all match"}'::jsonb,
    150,
    50
  ),
  (
    'back.circuit',
    'back',
    '{"he":"גב מעגל","en":"Circuit back"}'::jsonb,
    '{"he":"ניאון, חוטים, וזמזום","en":"Neon, wires and a hum"}'::jsonb,
    120,
    51
  ),
  (
    'back.nacho',
    'back',
    '{"he":"גב נאצ''וס","en":"Nacho back"}'::jsonb,
    '{"he":"כן. נאצ''וס","en":"Yes. Nachos"}'::jsonb,
    100,
    52
  ),
  (
    'back.stars',
    'back',
    '{"he":"גב כוכבים","en":"Stars back"}'::jsonb,
    '{"he":"שמיים של לילה מעל המגרש","en":"A night sky over the court"}'::jsonb,
    120,
    53
  ),
  (
    'back.lava',
    'back',
    '{"he":"גב לבה","en":"Lava back"}'::jsonb,
    '{"he":"חם מכדי להחזיק","en":"Too hot to hold"}'::jsonb,
    150,
    54
  ),
  (
    'back.bones',
    'back',
    '{"he":"גב עצמות","en":"Bone back"}'::jsonb,
    '{"he":"של מישהו. לא נשאל","en":"Somebody''s. We did not ask"}'::jsonb,
    180,
    55
  )
on conflict (id) do nothing;
