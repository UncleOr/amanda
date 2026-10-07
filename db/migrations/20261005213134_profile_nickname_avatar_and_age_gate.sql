-- A player's own corner: what they are called and what they look like.
alter table public.players add column nickname   text;
alter table public.players add column avatar     text;
-- Only the date, never a time: this exists to work out an age, and storing
-- more of someone's birthday than that would be collecting what we do not need.
alter table public.players add column birth_date date;

-- The age floor, currently 7. Kept as a CHECK on the row rather than in the
-- client so it holds however the row is written — including from the server.
alter table public.players
  add constraint players_min_age
  check (birth_date is null or birth_date <= (current_date - interval '7 years'));

comment on constraint players_min_age on public.players is
  'Minimum age 7. A null birth_date means not yet asked, which the app treats as not yet allowed to go online.';

-- These three are things a player says about themselves, like display_name.
-- Everything that is worth something still comes only from the server.
grant update (nickname, avatar, birth_date) on public.players to authenticated;
