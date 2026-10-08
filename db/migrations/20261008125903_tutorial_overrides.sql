-- ── the words Amanda teaches with ──────────────────────────────────
--
-- Or, after playing the tutorial: *"by the way, in the admin panel give me an
-- option to edit it too."*
--
-- Same shape as phrase_overrides and series_overrides, and for the same
-- reason: the game ships COMPLETE. The shipped lines live in the client, at
-- apps/client/src/data/tutorialLines.ts, and a row here replaces exactly one
-- of them. An empty table is the game as built; deleting a row puts the
-- shipped words back rather than removing anything.
--
-- `he` and not `data jsonb`: a tutorial line is a string. The catchphrases
-- carry a whole object (the plaque's colours, its shape), which is why those
-- are jsonb; copying that here would be a column that only ever holds
-- { "he": "..." } and a second place to get the key wrong.
create table if not exists public.tutorial_overrides (
  -- Matches a TUTORIAL_LINES id, e.g. "king" or "x-poison". An id the code
  -- does not know is ignored rather than refused — a row left behind by a
  -- renamed step must never be the reason a child cannot play.
  id text primary key,
  he text not null,
  -- A draft that is parked rather than lost. False puts the shipped line back
  -- on screen while the row stays here to be switched on again.
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.tutorial_overrides enable row level security;

-- Everyone reads them: the tutorial runs in the browser, so the browser needs
-- the words. Nobody writes them from a browser — every change goes through the
-- server with the admins table checked first.
drop policy if exists tutorial_overrides_readable on public.tutorial_overrides;
create policy tutorial_overrides_readable on public.tutorial_overrides
  for select to anon, authenticated using (true);
grant select on public.tutorial_overrides to anon, authenticated;
revoke insert, update, delete, truncate on public.tutorial_overrides from anon, authenticated;
