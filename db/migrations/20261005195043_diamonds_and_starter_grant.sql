-- Diamonds, and the five cards every player starts with.
-- See docs/META.md for why the economy has exactly one currency.

alter table public.players
  add column diamonds integer not null default 0 check (diamonds >= 0);

-- Arena is derived from trophies, but keeping the high-water mark lets a
-- player hold the backdrop they earned instead of losing it on a bad run.
alter table public.players
  add column best_trophies integer not null default 0 check (best_trophies >= 0);

-- A new player's album.
--
-- Chuppy is not random: he is the friend you are handed, the way Ash has
-- Pikachu, so he is granted by name. The other five are the first card of each
-- remaining series, and everything arrives in TWO copies — ten placements
-- against thirteen cells, so the board deliberately does not fill. The gaps are
-- the reason to collect.
--
-- The ids are the ones in the card JSON that ships with the build; the catalog
-- does not live in this database (see db/README.md), so this list is literal.
-- This function is the only place that knows the starting album.
create or replace function public.grant_starter_album(p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.player_cards (player_id, card_id, copies)
  select card_id, 2
  from unnest(array[
    'furries_01_chuppy',
    'dragons_01_flame_dragon',
    'giants_01_stone_colossus',
    'insects_01_ant_soldier',
    'plants_01_thorn_sprout',
    'slimes_01_basic_slime'
  ]) as card_id
  on conflict (player_id, card_id) do nothing;
end;
$fn$;

comment on function public.grant_starter_album is
  'The album a new player starts with. Chuppy is guaranteed; see docs/META.md.';

-- Every new auth user becomes a player, with their starter album, in one go.
-- Doing this in the database means a client cannot forget to, or choose not to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.players (id) values (new.id) on conflict (id) do nothing;
  perform public.grant_starter_album(new.id);
  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
