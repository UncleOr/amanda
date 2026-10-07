-- The client marks its own tutorial finished (account.ts markTutorialDone), so
-- that column has to be writable too. Harmless: it is a flag about this player
-- and nothing is earned by setting it.
grant update (tutorial_done) on public.players to authenticated;
