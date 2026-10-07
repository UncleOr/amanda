-- Cards Or can change without a deploy.
--
-- OVERRIDES, not a copy of the catalogue. The game ships with every card it
-- has in data/series/*.json and plays perfectly with this table empty; a row
-- here means Or changed his mind about a card, or invented a new one. Same
-- principle as copy_strings, and the same reason: a child opening the game
-- must never be waiting on a fetch to find out what a dragon does.
--
-- `data` is the whole card, in exactly the shape the Zod schema already
-- validates (packages/shared/src/schemas/card.ts), so an ability built in the
-- editor is the same object the engine reads. Deliberately jsonb rather than
-- thirty columns: abilities are a list of {type, trigger, params} and params
-- is an open bag, which is not a table.
create table if not exists public.card_overrides (
  id text primary key,
  /* Which family it belongs to. Needed on its own because a NEW card has to
     be put somewhere, and the series files cannot know about it. */
  series_id text not null,
  /* False hides a card from the game without losing what it was. Deleting a
     card that ships in the data is impossible — this is what "delete" means
     for one of those, and it is reversible. */
  active boolean not null default true,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.card_overrides enable row level security;

-- Everyone reads them: these are the cards in the game.
drop policy if exists card_overrides_readable on public.card_overrides;
create policy card_overrides_readable on public.card_overrides
  for select to anon, authenticated using (true);
grant select on public.card_overrides to anon, authenticated;
-- Writing goes through the server and its service key, like everything else
-- worth anything.
revoke insert, update, delete, truncate on public.card_overrides from anon, authenticated;

create index if not exists card_overrides_series on public.card_overrides (series_id);
