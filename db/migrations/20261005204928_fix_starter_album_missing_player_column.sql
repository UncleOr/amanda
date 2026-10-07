-- The insert named three columns and selected two: p_player was lost when this
-- was rewritten. Every anonymous sign-up failed with "Database error creating
-- anonymous user", because the trigger raised 42601 and took the whole INSERT
-- into auth.users down with it.
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
    'slimes_01_basic_slime'
  ]) as card_id
  on conflict (player_id, card_id) do nothing;
end;
$fn$;

revoke all on function public.grant_starter_album(uuid) from public, anon, authenticated;
