-- Who is allowed to run the admin panel.
-- Deliberately a table rather than a flag on the user or a hard-coded email:
-- an email can change hands, and a column on a row the user can reach is a
-- column the user can try to set.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policies at all: nothing reaches this table except the service key.
revoke all on public.admins from anon, authenticated;

-- Every player-visible string, by the id docs/copy.map.json gives it.
-- `variant` lets one id hold several lines so a moment can say something
-- different each time (Or: "~10 sentences with a few options, one for the
-- rest") -- variant 0 is the one that is always there.
create table if not exists public.copy_strings (
  id text not null,
  variant smallint not null default 0,
  text text not null,
  updated_at timestamptz not null default now(),
  primary key (id, variant)
);
alter table public.copy_strings enable row level security;

-- The game reads these on every boot, including before anyone signs in.
drop policy if exists copy_readable on public.copy_strings;
create policy copy_readable on public.copy_strings for select to anon, authenticated using (true);
grant select on public.copy_strings to anon, authenticated;
-- Writing goes through the server and its service key. RLS controls rows, not
-- columns, and we have been bitten by that already (db/README.md).
revoke insert, update, delete on public.copy_strings from anon, authenticated;
