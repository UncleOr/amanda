-- The nickname is free text that other children read, and nothing bounded it.
--
-- The two inputs carry maxLength={16}, which is where it should be said to a
-- player — but the client writes this column DIRECTLY:
--
--   grant update (nickname, avatar, birth_date) on public.players to authenticated;
--
-- so the only thing standing between a crafted request and a ten-thousand
-- character nickname was a browser attribute. Everyone else's versus screen
-- and friends list then renders it.
--
-- Same reasoning as players_min_age next door: a rule that matters belongs on
-- the row, where it holds however the row is written, rather than in the one
-- client that happens to be polite about it.
--
-- 16 to match the inputs. Trimmed length, so sixteen spaces is not a name.
alter table public.players
  add constraint players_nickname_length
  check (nickname is null or char_length(btrim(nickname)) between 1 and 16);

comment on constraint players_nickname_length on public.players is
  'Matches the maxLength on the profile and onboarding inputs. The client '
  'writes this column directly, so the browser attribute alone guarded '
  'nothing.';

-- The avatar is a choice from a fixed set drawn by us (AVATAR_IDS in
-- Profile.tsx), never an upload and never a URL. Bounding the length does not
-- make it one of ours, but it does stop the column being used as storage.
alter table public.players
  add constraint players_avatar_length
  check (avatar is null or char_length(avatar) <= 40);
