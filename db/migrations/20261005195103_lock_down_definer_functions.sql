-- Both of these run with the definer's rights, and Supabase exposes every
-- function in `public` over REST. As created, any signed-in player could POST
-- to /rest/v1/rpc/grant_starter_album with somebody else's id — or their own,
-- repeatedly — and hand out cards.
--
-- Neither is meant to be called by a client. The trigger that uses
-- handle_new_user runs as its owner and is unaffected by these grants.
revoke all on function public.grant_starter_album(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
