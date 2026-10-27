-- ═══ CLUBS ═══
--
-- Or: *"make another button on the home board for 'Club'. Opens a popup.
-- Anyone can found a club and send an invitation to friends, or join an
-- existing club by a 6-digit code. You can of course also leave a club. The
-- club's manager — its founder — can change the name and the emblem… inside
-- the club you also have the club's own challenges… a club member can ask
-- for a card and then another member can donate it to them… anyone can send
-- a message in the club's public chat."*
--
-- Eight tables, and the shape of three of them IS a rule:
--
--   club_members has player_id as its PRIMARY KEY, so one person is in one
--   club. Not a policy checked in code — a thing the database cannot store.
--
--   club_donations has (request_id, donor_id) as its primary key, so nobody
--   can answer the same request twice by pressing twice.
--
--   club_claims has (club_id, player_id, challenge_id, period) as its
--   primary key, so a club challenge pays each member once per period
--   whatever happens. This is the table that stops clubs being a printing
--   press — see packages/shared/src/clubs.ts.
--
-- NONE of these tables has a write policy, exactly like `friends` and
-- `reports`. Every rule is checked by the server with the service key, so
-- there is no second path to any of them.

-- ── the club ────────────────────────────────────────────────────────
create table if not exists public.clubs (
  id         uuid primary key default gen_random_uuid(),
  -- Six digits, said out loud across a room. Unique, and the only way in.
  code       text not null unique check (code ~ '^[0-9]{6}$'),
  name       text not null check (char_length(name) between 1 and 20),
  emblem     text not null default 'flag',
  owner_id   uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── who is in it ────────────────────────────────────────────────────
create table if not exists public.club_members (
  -- One club each. The primary key IS the rule.
  player_id  uuid primary key references public.players (id) on delete cascade,
  club_id    uuid not null references public.clubs (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  -- Or: "a second warning throws the person out of the club."
  warnings   integer not null default 0 check (warnings >= 0),
  -- For the green dot: everything newer than this is new to them.
  seen_at    timestamptz not null default now()
);
create index if not exists club_members_club_idx on public.club_members (club_id);

-- ── the chat ────────────────────────────────────────────────────────
--
-- Nothing here was ever rejected: the filter runs on the server BEFORE the
-- insert (shared/clubs.ts, checkMessage), so a message that breaks the rules
-- does not land and then get removed — it never lands. What is written down
-- instead is a row in `reports`, which a human reads.
create table if not exists public.club_messages (
  id         bigserial primary key,
  club_id    uuid not null references public.clubs (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 120),
  created_at timestamptz not null default now()
);
create index if not exists club_messages_club_idx
  on public.club_messages (club_id, created_at desc);

-- ── asking for a card, and giving one ───────────────────────────────
--
-- Or: *"a club member can ask for a card and then another member can donate
-- it to him. You only donate a card if you already have it — this slows your
-- next upgrade but a card will never be taken from you and never
-- downgraded."*
create table if not exists public.club_requests (
  id         bigserial primary key,
  club_id    uuid not null references public.clubs (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  card_id    text not null,
  filled     integer not null default 0 check (filled >= 0),
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);
create index if not exists club_requests_open_idx
  on public.club_requests (club_id, created_at desc)
  where closed_at is null;

create table if not exists public.club_donations (
  request_id bigint not null references public.club_requests (id) on delete cascade,
  donor_id   uuid   not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Press twice, give once.
  primary key (request_id, donor_id)
);

-- ── the club's challenges ───────────────────────────────────────────
--
-- One row per club per challenge per period, counting up. The challenge
-- definitions themselves are in shared/clubs.ts and are not repeated here:
-- the row says how far the club has got, not what it is trying to do.
create table if not exists public.club_progress (
  club_id      uuid not null references public.clubs (id) on delete cascade,
  challenge_id text not null,
  period       text not null,
  amount       integer not null default 0 check (amount >= 0),
  primary key (club_id, challenge_id, period)
);

-- Who actually pushed, which is who gets paid. A club of forty where six
-- played pays six chests. See the note in shared/clubs.ts.
create table if not exists public.club_contributions (
  club_id      uuid not null references public.clubs (id) on delete cascade,
  challenge_id text not null,
  period       text not null,
  player_id    uuid not null references public.players (id) on delete cascade,
  amount       integer not null default 0 check (amount >= 0),
  primary key (club_id, challenge_id, period, player_id)
);

-- And the ledger that makes "once per period" true however many times a
-- button is pressed.
create table if not exists public.club_claims (
  club_id      uuid not null references public.clubs (id) on delete cascade,
  challenge_id text not null,
  period       text not null,
  player_id    uuid not null references public.players (id) on delete cascade,
  claimed_at   timestamptz not null default now(),
  primary key (club_id, challenge_id, period, player_id)
);

-- ── locked down, like friends and reports ───────────────────────────
--
-- RLS on and no policies at all: PostgREST with the anon key can neither
-- read nor write any of this. The server holds the service key and every
-- rule above is checked there, in apps/server/src/clubs.ts.
alter table public.clubs              enable row level security;
alter table public.club_members       enable row level security;
alter table public.club_messages      enable row level security;
alter table public.club_requests      enable row level security;
alter table public.club_donations     enable row level security;
alter table public.club_progress      enable row level security;
alter table public.club_contributions enable row level security;
alter table public.club_claims        enable row level security;

-- ── emblems in the shop, for owners ─────────────────────────────────
--
-- Or: *"and if you are the owner of a club, the option of club emblems in
-- the shop opens up for you too."*
--
-- `kind` is 'emblem', a kind that did not exist before this migration. The
-- shop does not gate anything by itself — shopWindow returns every active
-- row — so the "only owners see these" half is done where the player is
-- known, in the /api/shop handler, against ownsAClub(). Written here because
-- these rows are the reason that filter exists.
--
-- Priced in the same range as the other cosmetics: a thing you want, not a
-- thing you need.
--
-- ⚠ AND `kind` IS A CHECK CONSTRAINT, not a free text column. The insert
-- below failed against the live database on the first attempt — the list is
-- avatar, emoji, skin, card, chest, phrase, back — which is a good constraint
-- doing its job and a reminder that "a new kind of thing to sell should be a
-- row, not a deploy" has one exception: the kind itself.
alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check
  check (kind = any (array[
    'avatar', 'emoji', 'skin', 'card', 'chest', 'phrase', 'back', 'emblem'
  ]));

insert into public.shop_items (id, kind, name, blurb, grants, price_diamonds, art, sort, active)
values
  ('emblem.robot', 'emblem',
   '{"he": "רובוט", "en": "Robot"}'::jsonb,
   '{"he": "לסמל המועדון.", "en": "For your club."}'::jsonb,
   '{"emblem": "robot"}'::jsonb, 150, 'icons/robot.png', 210, true),
  ('emblem.joker', 'emblem',
   '{"he": "ג''וקר", "en": "Joker"}'::jsonb,
   '{"he": "לסמל המועדון.", "en": "For your club."}'::jsonb,
   '{"emblem": "joker"}'::jsonb, 120, 'icons/joker.png', 220, true),
  ('emblem.infinity', 'emblem',
   '{"he": "אינסוף", "en": "Infinity"}'::jsonb,
   '{"he": "לסמל המועדון.", "en": "For your club."}'::jsonb,
   '{"emblem": "infinity"}'::jsonb, 120, 'icons/infinity.png', 230, true),
  ('emblem.nacho', 'emblem',
   '{"he": "נאצ''וס", "en": "Nachos"}'::jsonb,
   '{"he": "לסמל המועדון.", "en": "For your club."}'::jsonb,
   '{"emblem": "nacho"}'::jsonb, 100, 'icons/nacho.png', 240, true),
  ('emblem.explode', 'emblem',
   '{"he": "פיצוץ", "en": "Blast"}'::jsonb,
   '{"he": "לסמל המועדון.", "en": "For your club."}'::jsonb,
   '{"emblem": "explode"}'::jsonb, 100, 'icons/explode.png', 250, true),
  ('emblem.blood', 'emblem',
   '{"he": "טיפה", "en": "Drop"}'::jsonb,
   '{"he": "לסמל המועדון.", "en": "For your club."}'::jsonb,
   '{"emblem": "blood"}'::jsonb, 100, 'icons/blood.png', 260, true)
-- The three Or owns from the admin panel are left alone on re-run, exactly
-- as the chests migration does.
on conflict (id) do update
  set kind = excluded.kind,
      grants = excluded.grants,
      art = excluded.art,
      active = excluded.active;
