-- The "players rename self" policy says WHICH ROW a player may update. It says
-- nothing about WHICH COLUMNS — that is not what row level security does. So
-- a signed-in player could PATCH their own row and set trophies and diamonds
-- to anything they liked, which a test did: 99999 of each, accepted.
--
-- Column privileges are the tool for this. Revoke update on the table and hand
-- back exactly one column. The policy still restricts it to their own row.
revoke update on public.players from authenticated, anon;
grant update (display_name) on public.players to authenticated;

-- Undo the damage from the test above.
update public.players set trophies = 0, diamonds = 0 where trophies = 99999;
