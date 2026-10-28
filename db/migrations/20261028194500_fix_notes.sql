-- A box to leave notes in, and the history of what was done about them.
--
-- Or: *"leave me a free box to leave you fixes in, in free language. I will
-- tell you here in this chat to go over all the fixes I left you in the
-- arenas and the cards, and you will go over them, fix them, report what was
-- done, put it into the card's fix history in the admin interface, and clear
-- the box for me."*
--
-- ═══ WHY THIS IS NOT AN OVERRIDE TABLE ═══
--
-- Every other table beside this one holds a VALUE the game reads: a card's
-- stats, an arena's name, a dial. This one holds a sentence addressed to a
-- person, and the game never reads it. It is a channel between the two people
-- who build this game, kept next to the thing it is about — a note about the
-- Flame Dragon lives on the Flame Dragon, so it is read at the moment
-- somebody opens the Flame Dragon rather than in a list of forty notes about
-- nothing in particular.
--
-- ═══ ONE OPEN NOTE PER THING, AND A HISTORY BEHIND IT ═══
--
-- "The box" is a single row with status 'open'. Resolving it does not delete
-- it: it becomes 'done' and gains `done_note`, which is the report. So the
-- box empties and the history fills in the same write, and nothing Or asked
-- for is ever thrown away — including the ones that turned out to be wrong,
-- which are the ones worth being able to read again.
create table if not exists public.fix_notes (
  id uuid primary key default gen_random_uuid(),
  -- What the note is about. Two kinds today; a third is a word here and a
  -- component there, which is the point of not making this two tables.
  scope text not null check (scope in ('card', 'arena')),
  -- A card id ("dragons_01_flame_dragon") or an arena id ("station"). Not a
  -- foreign key: cards live in data/series/*.json and arenas in arenas.ts,
  -- and the database deliberately does not know what either of them is
  -- (db/README.md). A note about a card that is later renamed is a note that
  -- has lost its card, and that is better than a write that fails.
  target text not null,
  -- What Or wrote, in whatever language and shape he wrote it. Never parsed.
  note text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  -- What was actually changed, written when the note is resolved.
  done_note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  done_at timestamptz
);

-- The panel asks for one thing's notes at a time, newest first.
create index if not exists fix_notes_by_target
  on public.fix_notes (scope, target, created_at desc);

-- ⚠ ONE OPEN NOTE PER THING. The box is a box, not a thread: a second open
-- row would mean the panel shows one note and silently holds another, and the
-- one it hides is the one nobody acts on.
create unique index if not exists fix_notes_one_open
  on public.fix_notes (scope, target)
  where status = 'open';

alter table public.fix_notes enable row level security;

-- ⚠ AND NOBODY READS THIS FROM A BROWSER. Every other table here grants
-- select to anon, because the game itself needs the arena names and the card
-- stats before anybody has signed in. This one is private correspondence
-- about unfinished work, it is of no use to the game, and the repository is
-- public. It is reached only through /api/admin, with the admins table
-- checked first and the service key on the server.
revoke all on public.fix_notes from anon, authenticated;
