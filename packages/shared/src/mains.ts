/**
 * The two cards a family is MET through.
 *
 * Or: *"pick which 2 from each series are the main ones, that are the first
 * ones you get, and that also say their own name when you tap them, in a
 * fitting voice."*
 *
 * Three things in one sentence, and they only work together. A family's two
 * mains are the pair a child would name if you asked them what the Machines
 * are; they are the pair the game hands you first when that family opens;
 * and they are the pair whose name is spoken aloud. Picking them for the
 * voice alone and letting the chest hand you the Bolt Mine first would mean
 * the card that introduces a family is not the card that announces itself.
 *
 * ═══ WHY TWO AND NOT ONE ═══
 *
 * One is a mascot. Two is a FAMILY: the small one you can field on the
 * evening you meet it, and the one with the character. A family you meet
 * through a single card is a card, not a family — which is the whole of what
 * an arena is for.
 *
 * ═══ THE RULE THE STARTER ALBUM ALREADY DECIDES ═══
 *
 * Four of these families are in your album before you have played a match
 * (decks.ts, STARTER_ALBUM), so for those four "the first ones you get" is
 * not a choice this file can make — it was made there. The mains of the
 * Dragons, the Giants, the Plants and the Furries are therefore starter
 * cards, and mains.test.ts measures that rather than trusting this comment.
 *
 * Two families have one card each and so have one main. That is the family
 * being unfinished, not an exception to the rule.
 */

/** Series id → the cards that family is met through, smallest first. */
export const FAMILY_MAINS: Readonly<Record<string, readonly string[]>> = {
  // Both already in the starter album, and both already have a voice.
  dragons: ["dragons_01_flame_dragon", "dragons_02_obsidian_egg"],
  // The little screw that walks, and the one that looks back at you.
  machines: ["machines_01_boltling", "machines_06_mandroid"],
  // The whole family, and the card every player is handed on day one.
  furries: ["furries_01_chuppy"],
  // The first thing you see in the water, and the one that sings — which is
  // the one card in the game whose voice is part of what it DOES.
  sea: ["sea_02_jellyfish", "sea_07_siren"],
  giants: ["giants_01_stone_colossus", "giants_07_iron_bulwark"],
  // One card. The Alley King is the Demons until the alley is built out.
  demons: ["demons_01_alley_king"],
  insects: ["insects_01_ant_soldier", "insects_02_ant_queen"],
  plants: ["plants_01_thorn_sprout", "plants_03_healing_bloom"],
  // The slime, and the one with a name a seven-year-old repeats.
  slimes: ["slimes_01_basic_slime", "slimes_11_thing_in_the_bin"],
  /*
   * The Legends have none, and this is the one place it is worth writing
   * down why: Amanda is the opponent. She cannot be won (collectable.ts), so
   * there is no "first one you get" to name.
   */
};

/** The cards this family is met through. Empty for a family with none. */
export function mainsOf(seriesId: string): readonly string[] {
  return FAMILY_MAINS[seriesId] ?? [];
}

/** Every main in the game, which is what "says its own name" is drawn from. */
export const ALL_MAINS: readonly string[] = Object.values(FAMILY_MAINS).flat();

/** Is this one of the two cards its family is met through? */
export function isMain(cardId: string): boolean {
  return ALL_MAINS.includes(cardId);
}
