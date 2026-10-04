/**
 * A distinct visual brief for every launch card.
 *
 * Without this, cards in a series came out as near-twins: the series template
 * gave them one shared palette and the prompt never described the creature's
 * actual body. Each entry below fixes a different SILHOUETTE first (what you
 * read at card size), then a signature feature, then colour.
 */
export const CARD_LOOK: Record<string, string> = {
  // ── Dragons — vary the body plan hard, not just the flame colour ──
  dragons_01_flame_dragon:
    "a classic armoured western dragon standing on two muscular legs, broad spread membranous wings, " +
    "a long whip-like tail trailing fire, molten cracks glowing between obsidian scales",
  dragons_02_obsidian_egg:
    "NOT a dragon — a huge cracked volcanic black egg resting in a nest of broken stone, no limbs and no face, " +
    "wide glowing lava seams splitting the shell, heat haze and sparks rising, ominously still",
  dragons_03_thunderwing:
    "a lean skeletal sky-dragon with an extremely long slender neck and a narrow pointed beak-like head, " +
    "huge angular lightning-rod wings like antennae, perched tall and alert, arcs of electricity between its horns",
  dragons_04_lava:
    "NOT humanoid — a squat wide molten lava mound with a broad puddle base and no legs, " +
    "a gaping cracked crater mouth erupting a spout of fire upward, rivulets of glowing magma running down its sides",
  dragons_09_typhoon_dragon:
    "a long serpentine eastern dragon with NO wings, a ribbon-like coiling body spiralling through a vortex of wind, " +
    "flowing whiskers and a feathered mane, pale sky-blue and white, sleek and weightless",
  dragons_10_sky_king:
    "a colossal regal crowned dragon with FOUR enormous feathered wings, a jewelled crown fused to its brow, " +
    "a broad armoured chest, enthroned on a bank of storm clouds, overwhelming majesty",

  // ── Giants — each one a different build and a different weapon/feature ──
  giants_01_stone_colossus:
    "a towering humanoid built of stacked mossy boulders with gaps of glowing orange light between them, " +
    "enormous craggy fists, a small featureless head sunk between massive shoulders, no armour and no weapon",
  giants_02_steel_warden:
    "a fortress knight in full riveted plate armour with a CLOSED visored helm, " +
    "planting an enormous rectangular tower shield in front of itself, defensive and immovable, polished steel",
  giants_05_wall_breaker:
    "a lean hunched demolition giant mid-swing, whirling an enormous spiked wrecking ball on a heavy chain, " +
    "asymmetric body with one gigantic arm, cracked and dented plating, explosive forward motion",
  giants_06_frost_giant:
    "a tall gaunt ice giant with jagged translucent ice shards erupting from its shoulders and spine, " +
    "a long beard of icicles, pale blue skin, frost fog pouring off its body",
  giants_09_thunder_giant:
    "a broad barrel-chested storm giant with a dark thundercloud wreathing its shoulders instead of a head, " +
    "both arms raised wide with a lightning bolt arcing between its fists, rain streaking around it",
  giants_10_titan_king:
    "a mountain-sized ancient titan carved with glowing runes, a heavy stone crown, " +
    "seated on a throne of cliffs with moss and waterfalls running down its legs, primordial and still",

  // ── Insects — make the actual species unmistakable ──
  insects_01_ant_soldier:
    "unmistakably an ANT: three clearly segmented body parts, six thin legs, two bent antennae, " +
    "marching forward holding a tiny leaf as a shield, small and plucky, warm amber chitin",
  insects_02_ant_queen:
    "a regal ant queen with a huge bulbous egg-swollen abdomen dragging behind her, " +
    "tiny translucent wings on her back and a small delicate crown, surrounded by a few tiny eggs",
  insects_03_venom_scorpion:
    "unmistakably a SCORPION: two oversized pincers held forward, a flat low body, " +
    "a high arched segmented tail tipped with a dripping green stinger, glossy dark violet shell",
  insects_07_aggressive_wasp:
    "unmistakably a WASP: a narrow sharply striped yellow-and-black abdomen, long thin legs trailing behind, " +
    "blurred fast-beating wings, a long barbed stinger, furious compound eyes, streaking forward",
  insects_08_firefly:
    "a small round fuzzy beetle with a big softly glowing lantern abdomen like a paper lamp, " +
    "short round wings, a trail of floating light motes, warm golden glow lighting its face",
  insects_10_insect_empress:
    "a towering elegant MANTIS empress reared up tall, two enormous scythe forearms crossed, " +
    "a long slender body, an ornate crown-like carapace crest, regal and lethal, deep emerald and violet",

  // ── Plants — different plant bodies, not generic leafy blobs ──
  plants_02_ancient_tree:
    "an enormous gnarled walking oak with a weathered face in its bark, thick exposed roots as legs, " +
    "a wide heavy canopy, hollows and mushrooms on its trunk, slow and venerable",
  plants_03_healing_bloom:
    "a small round creature whose whole head is one large open luminous blossom, " +
    "petals glowing softly, two tiny leaf arms, dewdrops and gentle sparkles floating around it",
  plants_06_toxic_mushroom:
    "a stout mushroom creature dominated by one enormous spotted domed cap that overhangs its tiny body, " +
    "puffing thick clouds of green spores from under the cap, short stubby stalk legs",
  plants_05_creeping_vine:
    "no solid body — a loose tangle of creeping vines and tendrils woven into a rough creature shape, " +
    "gaps you can see through, small flowers scattered along the stems, tendrils reaching outward",
  plants_08_cactus:
    "a chunky barrel cactus with thick vertical ribs and long sharp spines bristling all over, " +
    "two short stubby arms, a single bright flower blooming on top, desert pink and green",
  plants_10_great_mother_tree:
    "a colossal sacred mother tree, a vast glowing canopy of golden leaves, " +
    "a heartwood core shining through a split in the trunk, massive roots curling into a natural throne",

  // ── Slimes — silhouette is everything here ──
  slimes_01_basic_slime:
    "a simple droopy rounded blob of thick mud-green goo with small pebbles and twigs suspended inside, " +
    "a wide flat sagging base, sleepy half-closed eyes, dripping slowly",
  slimes_02_gelatinous_cube:
    "a perfect TRANSLUCENT CUBE with crisp geometric edges and flat faces, " +
    "clearly box-shaped rather than blobby, glassy aqua interior, a cheerful face on the front face",
  slimes_05_sticky_rug:
    "an almost FLAT wide splat of sticky goo spread across the ground like a doormat, " +
    "extremely low profile, glistening stringy threads at its edges, two small eyes peeking up from the puddle",
  slimes_08_assimilator:
    "an amorphous shapeshifter caught mid-transformation, half its body still formless while the other half " +
    "mimics borrowed shapes (a claw, a wing, a horn), iridescent oil-slick surface shifting colour",
  slimes_09_pudding_shield:
    "a wide low wobbling dome of pale glossy pudding, its top hardened into a smooth shield-like shell, " +
    "arms spread protectively to either side, soft and reassuring, warm cream and gold",
  slimes_10_zelig_giant_ooze:
    "a colossal towering ooze with a swirling WHIRLPOOL VORTEX opening in the centre of its chest " +
    "pulling debris inward, long heavy dripping arms, deep teal and toxic green",
};
