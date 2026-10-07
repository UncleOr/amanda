-- Reports: a bug, or a player who was unpleasant.
--
-- Or: "only works between registered users." That is enforced in the server,
-- not here, because "registered" is a fact about auth.users and not about this
-- table — and a check constraint that has to join auth is a check constraint
-- that will be wrong one day.
--
-- The reported player is nullable: a bug report is about the game, not about a
-- person. `about_match` is kept so an admin can see which match it came out of
-- rather than taking one child's word about another's.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('bug', 'player')),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_id uuid references auth.users (id) on delete set null,
  about_match uuid references public.matches (id) on delete set null,
  message text not null default '',
  created_at timestamptz not null default now(),
  /* open → somebody has to look. done → an admin has dealt with it. */
  status text not null default 'open' check (status in ('open', 'done')),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  handled_note text
);
alter table public.reports enable row level security;

-- A player may see the reports THEY made, so "did that go anywhere?" has an
-- answer. Nobody can see a report made about them: a child should not be able
-- to find out who told on them, which is the whole reason reporting works.
drop policy if exists reports_read_own on public.reports;
create policy reports_read_own on public.reports
  for select to authenticated using ((select auth.uid()) = reporter_id);
grant select on public.reports to authenticated;

-- Writing goes through the server, which is where "are you registered", "did
-- you actually play them" and the rate limit live.
revoke insert, update, delete, truncate on public.reports from anon, authenticated;

create index if not exists reports_open on public.reports (status, created_at desc);
create index if not exists reports_reported on public.reports (reported_id);
