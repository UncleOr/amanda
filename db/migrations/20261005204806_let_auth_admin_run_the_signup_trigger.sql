-- Revoking EXECUTE from `public` to keep players out of these functions also
-- took it from supabase_auth_admin, which is the role that inserts into
-- auth.users — and Postgres checks EXECUTE on a trigger function against the
-- role performing the triggering INSERT. So sign-up started failing with
-- "Database error creating anonymous user": the lockdown was correct about
-- who should not call it and wrong about who must.
--
-- Granted narrowly, to that one role. anon and authenticated stay revoked, so
-- nobody can still POST to /rest/v1/rpc/grant_starter_album.
grant execute on function public.handle_new_user() to supabase_auth_admin;
