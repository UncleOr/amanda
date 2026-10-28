-- The rungs of the ladder, editable without a deploy.
--
-- Or: *"give me an arena editor in the admin panel too — which pack opens in
-- them (packs that are already in another arena are blocked), and a name and
-- text in Hebrew and English."*
--
-- The last layer of content with no way in. The cards have had one since
-- card_overrides, the shelves since series_overrides, the words Amanda
-- teaches with since tutorial_overrides — and the arenas, which are the thing
-- all three are arranged around, were still a deploy. He is the copywriter
-- and every arena carries three pieces of his writing (a name, a tease, a
-- story), so this is the table that was most obviously missing.
--
-- Same rule as every table beside it: the game ships COMPLETE. The ladder is
-- in packages/shared/src/arenas.ts, this table is empty, and a row means Or
-- changed his mind about one rung. Deleting the row puts the shipped arena
-- back rather than removing anything.
--
-- ⚠ WHAT IS DELIBERATELY NOT HERE: `from`, the trophy count where a rung
-- begins. Or chose those seven numbers himself (0 · 150 · 450 · 1,200 ·
-- 2,400 · 4,500 · 8,000) and they are the shape of about a year and a half of
-- play; they are also the one field in an arena that other arenas depend on,
-- because the ladder has to keep widening. Changing one from a panel at
-- midnight could silently put two rungs in the wrong order, and the player
-- it would happen to is the one who had already climbed past them.
create table if not exists public.arena_overrides (
  -- Matches an ARENAS entry's id, e.g. "station" or "fuel". An id the code
  -- does not know is ignored rather than refused: an arena is a place with a
  -- backdrop and a trophy range, and a row cannot invent either.
  id text primary key,
  -- { name?: {he,en}, tease?: {he,en}, story?: {he,en}, introduces?: string }
  -- Absent keys keep whatever the file says. `introduces: ""` is the one way
  -- to say "you meet nobody new here", which is a decision and not a silence.
  --
  -- ONE FAMILY, ONE ARENA. The uniqueness is enforced in code rather than by
  -- a constraint here, because applyArenaOverrides resolves the whole set at
  -- once — which is what lets two arenas SWAP families in one save, where a
  -- unique index would refuse the half that moved first.
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.arena_overrides enable row level security;

-- Everyone reads them: the arena name is on the home screen before anybody
-- has signed in. Nobody writes from a browser — every change goes through the
-- server with the admins table checked first.
drop policy if exists arena_overrides_readable on public.arena_overrides;
create policy arena_overrides_readable on public.arena_overrides
  for select to anon, authenticated using (true);
grant select on public.arena_overrides to anon, authenticated;
revoke insert, update, delete, truncate on public.arena_overrides from anon, authenticated;
