-- ════════ A CODE YOU CAN READ OUT TO SOMEBODY ════════
--
-- Or: "add a way to add a friend with a matching code, like a game."
--
-- Until now the only way onto somebody's friends list was to have played
-- them, which is a good rule for strangers and a useless one for the case Or
-- actually has: two children in the same room who want to be friends before
-- they have ever played each other.
--
-- A COLUMN, not a hash of the id. Deriving the code would need no storage,
-- but resolving one would mean hashing every player in the table to find the
-- match. One indexed column answers it in a single lookup, and it leaves room
-- to reissue a code if a child ever shares theirs too widely.
--
-- The alphabet is the room code's and for the same reason: these are read
-- aloud and typed in by hand, so no O/0 and no I/1/L.
alter table public.players add column friend_code text;

create unique index players_friend_code on public.players (friend_code)
  where friend_code is not null;

-- Filled on demand by the server, never by the client: a player may READ
-- their own code, but the value has to come from somewhere nobody can choose.
revoke update (friend_code) on public.players from authenticated;
