-- ═══ TWO MORE CARDS IN A NEW PLAYER'S ALBUM, AND WHY ═══
--
-- Or, looking at a deck he had just built: "you're really overdoing it. The
-- decks are now really strong and it ruins it. Look at this deck — lots of
-- strong cards. It cost me 46 and I have change left for another 3-card and
-- another 1-card, which fills 18 for 50. And I could have done it for less."
--
-- He is right, and the budget could not fix it on its own. An eighteen-card
-- deck costs between 18 and 90 — three of the cheapest card, or three of the
-- dearest. A new player had SIX cards and the rules allow three of each,
-- which is exactly eighteen entries, so their only possible deck cost 57.
-- The budget therefore could not go below 57, and 57 out of 90 buys most of
-- the collection's best cards. There was no number that was both legal for a
-- beginner and a real constraint on anybody else.
--
-- Measured, the cheapest legal eighteen by album size:
--
--   six cards (as it was)   57
--   seven                   45
--   EIGHT                   36
--   nine                    27
--
-- Two is enough. The floor drops to 36, the budget moves to 45 — the middle
-- of what a deck can cost — and a beginner gets a thing they never had: with
-- six cards there was exactly one legal deck, so "fill it for me" was the
-- only move on the screen.
--
-- Both additions cost 1, which is the point of them, and both are the second
-- card of a series the player already has — so the album still reads as six
-- families rather than a bag.
--
-- Existing players are untouched: this function runs on signup.
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
    'furries_01_chuppy',
    'dragons_01_flame_dragon',
    'giants_01_stone_colossus',
    'insects_01_ant_soldier',
    'plants_01_thorn_sprout',
    'slimes_01_basic_slime',
    'dragons_02_obsidian_egg',
    'insects_04_toxic_moth'
  ]) as card_id
  on conflict (player_id, card_id) do nothing;
end;
$fn$;

comment on function public.grant_starter_album is
  'The album a new player starts with: eight cards. Chuppy is guaranteed; the
   last two are priced at 1 so that a first deck is a choice rather than the
   only legal arrangement. See packages/shared/src/decks.ts (STARTER_ALBUM).';

-- ═══ AND EVERYBODY WHO IS ALREADY HERE ═══
--
-- The function above only runs on signup, so without this the budget would
-- be legal for people who have not installed the game yet and illegal for
-- the twelve testers — measured in the builder: with the old six, "fill it
-- for me" comes back 15/18 at 44/45 and the save button is dead.
--
-- `on conflict do nothing` is what makes this safe to run twice and safe to
-- run on somebody who already owns these two: it adds the row or it does
-- not, and it never touches a copy count anybody has earned.
do $$
declare p record;
begin
  for p in select id from public.players loop
    perform public.grant_starter_album(p.id);
  end loop;
end $$;
