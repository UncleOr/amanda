-- ═══ THE ALBUM YOU START WITH IS THE GAMES ROOM ═══
--
-- Or, laying out the whole ladder: "at the start of the game we are in the
-- games room. We have Chuppy, giants, dragons and plants. Plants get +20%
-- power. At the court we meet the Slimes. Only somebody who has reached the
-- court for the first time can get a slime card at all. At the station we
-- meet the Insects — only somebody who has reached the station can meet an
-- insect."
--
-- Which makes the starter album a statement about where you ARE rather than
-- a sampler of the collection. It used to hand out one card of every family
-- in the game, so by the time an arena said "here you meet the Slimes" you
-- had been playing a slime since your first evening and the sentence meant
-- nothing. Now it is four families, and the other two are things that
-- happen to you.
--
-- Still eight cards, because eight is what the deck budget hangs on — see
-- 20261019170000_two_more_starter_cards.sql for the arithmetic. The three
-- that leave (a slime and two insects) are replaced by three from the four
-- families that stay, and the cheapest legal eighteen is 33 against a
-- budget of 45, where it was 36 before. A beginner has slightly more room
-- than they had, not less.
create or replace function public.grant_starter_album(p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.player_cards (player_id, card_id, copies)
  select p_player, card_id, 2
  from unnest(array[
    -- Chuppy is the friend you are handed, the way Ash has Pikachu.
    'furries_01_chuppy',
    'dragons_01_flame_dragon',
    'dragons_02_obsidian_egg',
    'dragons_05_spike',
    'giants_01_stone_colossus',
    'giants_07_iron_bulwark',
    'plants_01_thorn_sprout',
    'plants_03_healing_bloom'
  ]) as card_id
  on conflict (player_id, card_id) do nothing;
end;
$fn$;

comment on function public.grant_starter_album is
  'The album a new player starts with: eight cards from the four families the
   games room has — Chuppy, dragons, giants and plants. The Slimes and the
   Insects are met at the Court and the Station instead. See
   packages/shared/src/decks.ts (STARTER_ALBUM) and arenas.ts (introduces).';

-- ═══ AND EVERYBODY WHO IS ALREADY HERE ═══
--
-- Same reasoning as last time: the function above only runs on signup, so
-- without this the deck floor would be true for people who have not
-- installed the game yet and false for the testers who have. `on conflict do
-- nothing` makes it safe to run twice and safe on somebody who already owns
-- these — it adds a row or it does not, and never touches a copy count
-- anybody has earned.
--
-- Nothing is taken away. A tester who already has a slime keeps it; the gate
-- is about what a chest may GIVE from here on (apps/server/src/progress.ts).
do $$
declare p record;
begin
  for p in select id from public.players loop
    perform public.grant_starter_album(p.id);
  end loop;
end $$;
