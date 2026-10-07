-- Nothing in the browser writes these tables; the server does, with the
-- service key. Row-level security already refuses the writes (there are no
-- INSERT/UPDATE/DELETE policies), so this changes nothing today -- but a grant
-- that is not needed is a grant that a future permissive policy would quietly
-- turn into a hole. We have already been caught once by assuming RLS covers
-- something it does not (db/README.md), so the surface comes down.
revoke insert, update, delete, truncate on public.chests from anon, authenticated;
revoke insert, update, delete, truncate on public.player_cards from anon, authenticated;
revoke insert, update, delete, truncate on public.matches from anon, authenticated;
revoke insert, delete, truncate on public.players from anon, authenticated;

-- A player may still edit the few things about themselves that are theirs.
-- Column-level, because RLS controls ROWS and not columns: with a blanket
-- update grant a player set their own trophies to 99999, which is exactly how
-- we learned this.
grant update (nickname, avatar, birth_date) on public.players to authenticated;
