-- Friends: people you have actually played, who have said yes.
--
-- Or asked for "the option to add players to a friends list, to see whether
-- they are online, and to invite them to a game".
--
-- ═══ TWO RULES, AND THEY ARE THE SAFETY MODEL ═══
--
-- YOU MAY ONLY ASK SOMEBODY YOU HAVE PLAYED. There is no search by name, and
-- there never will be: a seven-year-old typing names into a box to find
-- strangers is the thing this design exists to prevent. The candidates come
-- from public.matches, exactly as they do for reporting a player.
--
-- AND THEY HAVE TO SAY YES. A one-way "favourite" would let somebody watch
-- whether a child is online without that child ever agreeing to it. So a row
-- starts as 'pending' and only becomes 'accepted' when the other person
-- accepts — at which point the reverse row is written too, and the friendship
-- is a pair of rows rather than one row read in two directions. Two rows cost
-- nothing and make "who are my friends" a single indexed lookup.
--
-- Nothing here is writable from the client. A player who could insert their
-- own 'accepted' row would have skipped both rules above.

create table public.friends (
  player_id  uuid not null references public.players (id) on delete cascade,
  friend_id  uuid not null references public.players (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (player_id, friend_id),
  -- Nobody is their own friend; it would show up in their own list.
  constraint friends_not_self check (player_id <> friend_id)
);

-- "Who has asked ME" — the incoming requests, which is the other direction
-- from the primary key and therefore needs its own index.
create index friends_incoming_idx on public.friends (friend_id, status);

alter table public.friends enable row level security;

-- A player sees the rows they are in, either way round: their own list, and
-- the requests waiting for them.
create policy "friends read own" on public.friends
  for select to authenticated
  using ((select auth.uid()) = player_id or (select auth.uid()) = friend_id);

-- No insert, update or delete policy, and no column grants: every write goes
-- through the server, which is the only place the two rules above are checked.
revoke insert, update, delete on public.friends from authenticated, anon;
