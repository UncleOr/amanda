-- The one line that is yours, thrown across the screen when a match begins.
--
-- Or: "let everyone choose a catchphrase, at first from 5 phrases — but
-- catchphrases (designed!) are another thing you can buy in the shop or win in
-- a chest. Then people will have a reason to buy from the shop, because it is
-- something you SEE."
--
-- ═══ AN ID, NOT A SENTENCE ═══
--
-- This column holds `phrase.winner`, never the words. Two reasons, and both
-- have already been decided once in this codebase for the taunts:
--
--   A COLUMN OF FREE TEXT IS A CHAT. This is a game for seven-year-olds, and
--   a sentence one player writes and another player reads is the exact thing
--   the closed taunt list exists to avoid (packages/shared/src/taunts.ts).
--   With an id, nothing can appear on somebody's screen that was not written
--   into the build on purpose.
--
--   AND OR REWRITES COPY. The words live in catchphrases.ts, so changing one
--   is an edit rather than a migration over everybody's rows.
--
-- Nullable, and null is the normal state: it means "has not chosen", which
-- reads on screen as a versus card with a name and a face and no line under
-- it. Not every child wants to shout something at a stranger.
alter table public.players
  add column if not exists catchphrase text;

-- Theirs to set, like their nickname and their face — choosing among lines
-- they already own is not worth anything, and the ones worth owning are
-- checked where ownership lives (player_items). Column-level, because RLS
-- controls rows and not columns: that distinction is how a player once set
-- their own trophies to 99999.
grant update (catchphrase) on public.players to authenticated;
