-- ═══ A FAMILY IS DROPPED, AND ONE CARD IN SOMEBODY'S ALBUM MOVES HOUSE ═══
--
-- Or, on the Strays: *"that is something you invented and I did not like it
-- much, sorry. Leave the Thing in the Bin (slimes) and the Alley King
-- (demons). Everything else can be deleted."*
--
-- Eight cards and their pictures are gone from the repository. The two he
-- kept changed family, and changing family changes a card's id — which is
-- the only reason this file exists. `strays_08_thing_in_the_bin` is in a
-- real album: UncleOr's, one copy at level 1, from before the alley was
-- sealed. Deleting the old id and leaving it at that would have taken a card
-- out of his collection without telling him.
--
-- `not exists` on each update because (player_id, card_id) is unique: if
-- somebody already held the destination id, the move would fail the whole
-- statement rather than skip that one row. Nobody did, but a migration that
-- only works because of today's data is a migration that breaks on a rerun.
--
-- The delete afterwards is the eight that are not coming back, in whatever
-- album, override or club request still names them.

update public.player_cards
   set card_id = 'slimes_11_thing_in_the_bin'
 where card_id = 'strays_08_thing_in_the_bin'
   and not exists (
     select 1 from public.player_cards other
      where other.player_id = player_cards.player_id
        and other.card_id = 'slimes_11_thing_in_the_bin'
   );

update public.player_cards
   set card_id = 'demons_01_alley_king'
 where card_id = 'strays_10_alley_king'
   and not exists (
     select 1 from public.player_cards other
      where other.player_id = player_cards.player_id
        and other.card_id = 'demons_01_alley_king'
   );

delete from public.player_cards where card_id like 'strays%';
delete from public.card_overrides where id like 'strays%' or series_id = 'strays';
delete from public.club_requests where card_id like 'strays%';
