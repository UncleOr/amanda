-- Give album_power a true value, for the first time.
--
-- The column has been in the schema since the very first migration and
-- nothing had ever written to it: forty-two players, every one at zero. So
-- the number matchmaking was designed around (docs/META.md) did not exist,
-- and pairing was "whoever waited longest" — which is exactly what Or was
-- complaining about when he said "there must not be a situation where all
-- his cards are fourteen levels stronger than mine".
--
-- ⚠️ THE AUTHORITY FOR THIS NUMBER IS packages/shared/src/albumPower.ts.
-- The server recomputes it from scratch whenever an album changes
-- (apps/server/src/albumPower.ts). The arithmetic is repeated here ONLY
-- because this is a one-off backfill of rows that predate the code — rarity
-- lives in data/series/*.json, which the database cannot read, so the ids had
-- to be listed. Do not reach for this file to change the formula; change the
-- TypeScript and let it rewrite the rows.
--
-- Result when it ran: 42 of 42 rated, lowest 8, average 8, highest 15 —
-- which is the starter album for almost everybody, and one player who has
-- opened a few chests.
with weighted as (
  select
    pc.player_id,
    (case
       when pc.card_id in ('dragons_01_flame_dragon','dragons_03_thunderwing','dragons_04_lava','dragons_05_spike','dragons_06_frost_breath','giants_01_stone_colossus','giants_03_hill_giant','giants_05_wall_breaker','insects_01_ant_soldier','insects_03_venom_scorpion','insects_04_toxic_moth','insects_05_armored_beetle','insects_07_aggressive_wasp','insects_08_firefly','plants_01_thorn_sprout','plants_04_venus_trap','plants_05_creeping_vine','plants_06_toxic_mushroom','plants_07_dandelion','plants_09_sunflower','slimes_01_basic_slime','slimes_02_gelatinous_cube','slimes_03_acid_ooze','slimes_04_splitting_blob','slimes_05_sticky_rug') then 1
       when pc.card_id in ('dragons_02_obsidian_egg','dragons_07_gold_horn','dragons_08_ghost_dragon','dragons_09_typhoon_dragon','giants_02_steel_warden','giants_04_rock_troll','giants_06_frost_giant','giants_07_iron_bulwark','giants_08_vengeful_rok','giants_09_thunder_giant','furries_01_chuppy','insects_02_ant_queen','insects_06_ambush_spider','insects_09_bombardier','plants_02_ancient_tree','plants_03_healing_bloom','plants_08_cactus','slimes_06_toxic_sludge','slimes_07_floating_brain','slimes_08_assimilator','slimes_09_pudding_shield') then 2
       when pc.card_id in ('dragons_10_sky_king','giants_10_titan_king','insects_10_insect_empress','plants_10_great_mother_tree','slimes_10_zelig_giant_ooze') then 3.5
       when pc.card_id in ('legends_01_amanda') then 6
       else 0
     end)
    * (1 + 0.1 * (greatest(1, pc.level) - 1))
    * (1 + 0.15 * least(greatest(0, pc.copies - 1), 8)) as power
  from public.player_cards pc
  where pc.card_id <> 'crumb_demon'
)
update public.players p
set album_power = coalesce(t.total, 0)
from (select player_id, round(sum(power))::int as total from weighted group by player_id) t
where p.id = t.player_id;
