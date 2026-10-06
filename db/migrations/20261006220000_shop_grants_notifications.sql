-- The shop, gifts, and the things the game tells you about.
--
-- Or: "everything is free right now — but the structure has to be right from
-- the start, because adding pricing later to a system that was not designed
-- for it means rewriting it." He named the two things that must already be
-- true: diamonds are a real currency in the database, and every item in the
-- shop is a ROW rather than code. Both are.
--
-- ═══ WHY THERE ARE FIVE TABLES AND NOT TWO ═══
--
-- shop_items     what can be had, and what it costs
-- player_items   what somebody has
-- grants         a gift Or sends out: what, to whom, and when
-- grant_receipts who already got it  ← the one that stops double-giving
-- notifications  what the player is told, and whether they have read it
--
-- grant_receipts is the table that looks redundant and is not. A scheduled
-- gift is run by a timer; timers fire twice when a process restarts at the
-- wrong moment, and "everybody gets a free card" running twice is a bug you
-- cannot take back. A receipt row makes delivery idempotent: the second run
-- finds the receipts and gives nothing.

-- ── the shop ───────────────────────────────────────────────────────
create table public.shop_items (
  id          text primary key,
  kind        text not null check (kind in ('avatar', 'emoji', 'skin', 'card', 'chest')),
  name        jsonb not null,
  blurb       jsonb,
  -- What it actually hands over. {cardId, copies} for a card, {avatar} for an
  -- avatar, {cardId, skin} for a skin, {kind} for a chest. Deliberately open:
  -- a new kind of thing to sell should be a row, not a migration.
  grants      jsonb not null default '{}'::jsonb,
  price_diamonds integer not null default 0 check (price_diamonds >= 0),
  /*
   * Real money is later, and this column is here now ON PURPOSE.
   *
   * Or's own warning is the reason: adding pricing to a system that was not
   * designed for it means rewriting it. Null means "not for sale for money",
   * which is every row today — so switching one on later is an UPDATE, not a
   * schema change, a deploy and a backfill.
   */
  price_cents integer check (price_cents is null or price_cents >= 0),
  art         text,
  active      boolean not null default true,
  sort        integer not null default 0,
  -- A limited-time item sells itself. Null at both ends means always.
  available_from  timestamptz,
  available_until timestamptz,
  created_at  timestamptz not null default now()
);

create table public.player_items (
  player_id   uuid not null references public.players (id) on delete cascade,
  item_id     text not null references public.shop_items (id) on delete cascade,
  -- How it was come by: 'bought', 'gift', 'grant', 'starter'. Worth keeping:
  -- "what did people actually pay for" and "what did we give away" are
  -- different questions and this is the only place that can answer either.
  source      text not null default 'bought',
  obtained_at timestamptz not null default now(),
  primary key (player_id, item_id)
);

-- Which skin is on which card, for this player. One row per player; the card
-- ids are keys inside, because a column per card is not a thing.
alter table public.players
  add column skins jsonb not null default '{}'::jsonb;

-- ── gifts and promotions ───────────────────────────────────────────
create table public.grants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- What everybody matched receives: {cards: [{cardId, copies}], diamonds,
  -- items: [itemId], chest}.
  gives       jsonb not null default '{}'::jsonb,
  /*
   * Who gets it. A closed set of filters, each one optional, all of them
   * ANDed — see packages/shared/src/grants.ts for the list and for why it is
   * closed rather than a query Or writes.
   */
  filters     jsonb not null default '{}'::jsonb,
  -- Null means "when Or presses the button". A date means it leaves on its
  -- own, which is the point of a holiday present.
  scheduled_at timestamptz,
  executed_at  timestamptz,
  recipients   integer,
  active      boolean not null default true,
  note        text,
  created_at  timestamptz not null default now()
);

create table public.grant_receipts (
  grant_id    uuid not null references public.grants (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  received_at timestamptz not null default now(),
  primary key (grant_id, player_id)
);

-- ── what the player is told ────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  kind       text not null check (kind in ('gift', 'offer', 'chest', 'friend', 'news')),
  title      jsonb not null,
  body       jsonb,
  -- Where tapping it should take you: 'shop', 'chests', 'album', 'friends'.
  action     text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_unread_idx
  on public.notifications (player_id, created_at desc)
  where read_at is null;

-- ── row level security ─────────────────────────────────────────────
alter table public.shop_items     enable row level security;
alter table public.player_items   enable row level security;
alter table public.grants         enable row level security;
alter table public.grant_receipts enable row level security;
alter table public.notifications  enable row level security;

-- The shop window is public: it is a price list, and the game has to be able
-- to draw it before anybody signs in.
create policy "shop is a window" on public.shop_items
  for select to anon, authenticated using (active);

create policy "items read own" on public.player_items
  for select to authenticated using ((select auth.uid()) = player_id);

create policy "notifications read own" on public.notifications
  for select to authenticated using ((select auth.uid()) = player_id);

-- grants and grant_receipts have NO read policy at all. Who was given what,
-- and who is being targeted by which promotion, is Or's business and reaches
-- the admin panel through the server.

-- Nothing here is writable from a browser. Buying spends diamonds, and a
-- client that could insert its own player_items row would simply not spend
-- them; marking a notification read is the one exception and it goes through
-- the server too, so that there is one path and not two.
revoke insert, update, delete on public.shop_items     from anon, authenticated;
revoke insert, update, delete on public.player_items   from anon, authenticated;
revoke insert, update, delete on public.grants         from anon, authenticated;
revoke insert, update, delete on public.grant_receipts from anon, authenticated;
revoke insert, update, delete on public.notifications  from anon, authenticated;
