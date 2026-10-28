-- ═══ A CLUB'S DOOR IS NOT ALWAYS OPEN ═══
--
-- Or, the day after clubs shipped: *"the code should be one-time —
-- generated only on the members screen when you press + (meaning, to add a
-- new member), and that is the only way to add a member. Valid for 30
-- seconds. Otherwise a load of bots will get in. And the manager will also
-- have to approve their entry."*
--
-- The club's own permanent six digits were a standing invitation: a million
-- codes, no expiry, no human in the way, and a script can try all of them.
-- Three things replace it, and none of them makes the child's job harder —
-- it is still "read six numbers out loud to the person beside you".
--
--   1. The code is MADE on purpose, by somebody already in the club.
--   2. It is alive for thirty seconds, then it is nothing.
--   3. Using it puts you in a QUEUE, and the owner says yes or no.
--
-- The thirty seconds is what makes the million codes safe. A guesser is not
-- searching a space of a million clubs any more; they are searching for one
-- live code during the half minute it exists, and the prize for finding it
-- is a seat in a queue that a person then refuses.

-- ── the invitation ──────────────────────────────────────────────────
--
-- No `used` column: using one DELETES it. One-time is a stronger promise
-- when the row is gone than when a flag says it should not work.
create table if not exists public.club_invites (
  code       text primary key check (code ~ '^[0-9]{6}$'),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  made_by    uuid not null references public.players (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists club_invites_club_idx on public.club_invites (club_id);
-- Server-only, like every other club table: RLS on, no policy at all.
alter table public.club_invites enable row level security;

-- ── waiting at the door ─────────────────────────────────────────────
--
-- A pending row is still one row per player, so the primary key keeps doing
-- its job: you can be waiting at one club, not at nine. Everything that asks
-- "is this person in a club" asks for state = 'member', so a person in the
-- queue has no chat, no donations and no one-click battle.
alter table public.club_members
  add column if not exists state text not null default 'member'
    check (state in ('member', 'pending'));
