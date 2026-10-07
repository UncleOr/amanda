-- Whether you have seen the tutorial is a preference, not a prize: the worst a
-- player can do by setting it is watch it again, or skip it. So it joins
-- display_name as something they may write about themselves, while trophies,
-- diamonds and everything else stays server-only.
grant update (tutorial_done) on public.players to authenticated;
