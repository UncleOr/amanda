-- Suspending a player.
--
-- Two halves, because they stop different things. Supabase's own ban stops
-- them getting a NEW token, which is the right lock on the front door but does
-- nothing to a session already in a browser — tokens live an hour. This column
-- is what the match server checks before it will queue anybody, so a
-- suspension takes effect on the next match rather than within the hour.
--
-- Null means not suspended. A date far in the future is how "indefinitely" is
-- written, so there is one shape to read and one comparison to make.
alter table public.players
  add column if not exists suspended_until timestamptz,
  add column if not exists suspended_reason text;

-- Readable by the player: being told you are suspended, and until when, is
-- the difference between a punishment and a game that is mysteriously broken.
-- Not writable by them, obviously — no grant is given.
