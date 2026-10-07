-- Everything else Or can change without a deploy.
--
-- Cards already have card_overrides. This is the same idea for the four things
-- the admin panel could not touch: series (names and their synergy bonus),
-- action cards, arenas (names and the trophies they start at), and the balance
-- numbers in config.ts.
--
-- ONE TABLE WITH A `kind`, rather than four tables. They all have exactly the
-- same shape — an id, a blob, and whether it is on — and four tables would
-- mean four migrations, four endpoints and four ways to forget one. Cards keep
-- their own table because that one is already live and working; a churn
-- migration to tidy a name is not worth the risk to something that is saving
-- people's albums right now.
--
-- OVERRIDES, as always. With this table empty the game is exactly what it
-- ships as, and that is what makes it safe for the server to read it at boot
-- and carry on regardless if it cannot.
create table if not exists public.content_overrides (
  kind text not null check (kind in ('series', 'action', 'arena', 'settings')),
  id text not null,
  data jsonb not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (kind, id)
);
alter table public.content_overrides enable row level security;

-- Everyone reads: these are the rules of the game and the words on the cards.
drop policy if exists content_overrides_readable on public.content_overrides;
create policy content_overrides_readable on public.content_overrides
  for select to anon, authenticated using (true);
grant select on public.content_overrides to anon, authenticated;

-- Writing goes through the server and its service key, like everything that
-- decides what a card does.
revoke insert, update, delete, truncate on public.content_overrides from anon, authenticated;
