-- Trophies for beating the computer, and the ceiling on a day of it.
--
-- Or: "in the early days there will not be enough players to make progress
-- from 1v1 alone — let's give trophies for beating the bot, by difficulty
-- level (the easy one can give nothing)."
--
-- ═══ WHY THE CEILING NEEDS TWO COLUMNS AND NOT A COUNT OF ROWS ═══
--
-- "How many solo trophies has this player had today" could be answered by
-- summing public.matches, and it is not, for two reasons. A solo match does
-- not create a matches row at all — nobody played against anybody — and
-- adding one would put a million rows a month in a table that exists to
-- answer "who have I played", which is also where the report-a-player and
-- add-a-friend candidate lists come from. A counter that resets is two
-- integers and one write.
--
-- The day is stored as a DATE in Israel rather than a timestamp, because the
-- rest of the progression loop already turns over on the Israeli calendar day
-- (packages/shared/src/challenges.ts) and two different midnights in one game
-- is a bug waiting for the clocks to change.

alter table public.players
  -- The Israeli calendar day the counter below belongs to. Null until the
  -- first solo win, and simply overwritten when a new day's first one lands.
  add column if not exists solo_day      date,
  -- Trophies taken from the computer on that day.
  add column if not exists solo_trophies integer not null default 0;
