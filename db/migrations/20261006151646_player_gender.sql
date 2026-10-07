-- Who Amanda is talking to.
--
-- Hebrew makes you choose: "בוא ילד" and "בואי ילדה" are the same sentence and
-- there is no third way to say it. Most of the game's copy was rewritten to
-- not need this at all, which is better — but the lines where she addresses
-- the player directly cannot sit on the fence.
--
-- Nullable on purpose. "Did not say" is a real answer, and it falls back to
-- the masculine, which is the Hebrew default and what every line said before
-- anybody was asked.
alter table public.players
  add column if not exists gender text
  check (gender in ('boy', 'girl'));

-- Theirs to set, like their nickname and their face. Column-level, because
-- RLS controls rows and not columns.
grant update (gender) on public.players to authenticated;
