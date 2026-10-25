/**
 * The sounds a card makes because of WHICH CARD IT IS.
 *
 * Or, setting out the whole shape of it in one message:
 *
 *   *"And every card should work like this: if it is one of the ones that
 *   say their own name — the name is said on the tap. Then there is the
 *   sound and the animation (electricity + lightning, wings + wingbeats)
 *   on the drag. Then on placing, the short card-placing sound (which
 *   happens even if you do not drag but only tap)."*
 *
 * Three moments, in the order a card passes through them, and they are
 * three different jobs:
 *
 *   TAP     the card announces itself. Only some cards do this.
 *   DRAG    it is in your hand and alive — a sound that runs while it moves,
 *           with the matching animation.
 *   PLACE   it lands. The generic `place` always plays, because that is the
 *           card hitting the table; a card's own `place` sound goes OVER it,
 *           ninety milliseconds later, and is the creature waking up.
 *
 * Only PLACE is filled in today — those are the eight Or named. `name` and
 * `drag` are declared because the shape of the table is the point of it, and
 * because the alternative is finding out in a fortnight that the structure
 * cannot hold what it was always going to be asked to hold.
 *
 * ═══ PER CARD, NOT PER SERIES ═══
 *
 * Or: *"and let me also be able to define a specific animation for a
 * specific card later, not only by series or by power."*
 *
 * So the lookup is a merge, and the card wins. A series default covers the
 * nine giants that should all grind; one line in `CARDS` makes the tenth
 * one different without touching the other nine or inventing a category for
 * it. `BY_SERIES` is empty right now and the mechanism is not — the day a
 * series gets a shared voice, it goes there and every per-card entry
 * already written keeps overriding it.
 */

import { CATALOG } from "../data/catalog";

/** One card's three moments. Every one of them is optional. */
export interface CardVoice {
  /** Its own name, said in its own voice, when the card is tapped. */
  name?: string;
  /** While it is being carried. Loops for as long as the drag lasts. */
  drag?: string;
  /** Over the top of the generic placement sound, when it lands. */
  place?: string;
}

/**
 * ═══ AND THE OTHER CARDS LIKE THEM ═══
 *
 * Or, hearing the eight: *"all the ones that have a sound — great, nice
 * work. That sound can also belong to ones in their style — flames, wings,
 * stones and so on."*
 *
 * So the eight stop being eight exceptions and become the voice of a KIND.
 * Fire is five cards, not one dragon; earth is fifteen. Three sounds now
 * cover twenty of the fifty-two without a single extra clip, and a card
 * that is fire AND has its own entry still keeps its own — Lava is fire and
 * does not become the Flame Dragon.
 *
 * Wings are the one he named that is not here. There is no wingbeat clip
 * yet — it is one of the six still marked "to record" on the sound desk —
 * and `flying` is a flag on eleven cards waiting for it. One line when it
 * exists.
 */
const BY_ELEMENT: Record<string, CardVoice> = {
  fire: { place: "card-flame-dragon" },
  earth: { place: "card-stone-golem" },
};

/**
 * Defaults for a whole series, which beat the element.
 *
 * A slime is a slime whatever it is made of, and the three here are the
 * families whose character is the family rather than the element: slimes
 * squelch, insects skitter, plants are the quiet one. The Ant Soldier's
 * skitter is now every insect's, and the Healing Bloom's open fifth is
 * every plant's.
 */
const BY_SERIES: Record<string, CardVoice> = {
  slimes: { place: "card-slime" },
  insects: { place: "card-ant-soldier" },
  plants: { place: "card-healing-bloom" },
};

/**
 * And the cards that are themselves.
 *
 * The eight Or picked out by name. Seven were generated from a description
 * of a physical event; `card-healing-bloom` is built note by note, because
 * "spiritual and high" is a feeling and feelings are music. See
 * packages/art/src/sounds.ts and fanfare.ts.
 */
const CARDS: Record<string, CardVoice> = {
  dragons_01_flame_dragon: { name: "card-name-flame-dragon", place: "card-flame-dragon" },
  dragons_02_obsidian_egg: { name: "card-name-obsidian-egg", place: "card-obsidian-egg" },
  dragons_04_lava: { name: "card-name-lava", place: "card-lava" },
  giants_01_stone_colossus: { name: "card-name-stone-golem", place: "card-stone-golem" },
  giants_10_titan_king: { name: "card-name-titan-king", place: "card-titan-king" },
  insects_01_ant_soldier: { name: "card-name-ant-soldier", place: "card-ant-soldier" },
  plants_03_healing_bloom: { name: "card-name-healing-bloom", place: "card-healing-bloom" },
  slimes_01_basic_slime: { name: "card-name-slime", place: "card-slime" },
  /*
   * Three more that say their name and have no sound of their own yet —
   * the two Or named when the drag voices were first described, and Chuppy.
   */
  furries_01_chuppy: { name: "card-name-chuppy" },
  slimes_10_zelig_giant_ooze: { name: "card-name-zelig" },
  plants_10_great_mother_tree: { name: "card-name-mother-tree" },
  /*
   * ⚠ Chuppy's voice had a constraint on it rather than just a
   * description. Or: *"Chuppy is too similar to Pikachu — he electrifies,
   * he is yellow, and even the name is close. So at least let his VOICE be
   * far from Pikachu (but still cute)."*
   *
   * Which rules out the obvious reading of "cute electric creature says its
   * own name" almost entirely: high, squeaky and two syllables IS the thing
   * being avoided. Left empty rather than filled in with the first idea,
   * because the brief here is mostly a list of what it must not be and that
   * is worth getting right rather than quickly.
   */
};

/**
 * A card's voice, from the widest rule to the narrowest.
 *
 * element, then series, then the card itself — each one overriding the last,
 * field by field. A card can therefore take its drag sound from being made
 * of stone and its name from being itself, which is the whole reason this
 * is a merge of three objects rather than a lookup in one.
 */
export function voiceFor(cardId: string): CardVoice {
  const series = cardId.slice(0, cardId.indexOf("_"));
  const card = CATALOG.get(cardId);
  /*
   * The FIRST element that has a voice, not the last and not a blend.
   *
   * Only two cards in the game carry two elements today (Acid Ooze is fire
   * and poison, Zelig is water and poison) and in both of them the first is
   * the one the card actually looks like. Merging them in order would have
   * let the second quietly win, which is a coin toss written as a loop —
   * fine while nothing collides, and a bug the day something does.
   */
  const byElement = (card?.elements ?? []).map((el) => BY_ELEMENT[el]).find(Boolean) ?? {};
  return { ...byElement, ...BY_SERIES[series], ...CARDS[cardId] };
}

/**
 * Every clip any card can ask for, so they can all be decoded at unlock.
 *
 * Eight small files today. The day this is fifty-three it becomes a reason
 * to load the ones in your hand instead — but a sound that arrives after
 * the tap that caused it is not a sound, it is lag, so "load it when it is
 * needed" is the thing to avoid for as long as it can be afforded.
 */
export const VOICE_CLIPS: string[] = [
  ...new Set(
    [
      ...Object.values(BY_ELEMENT),
      ...Object.values(BY_SERIES),
      ...Object.values(CARDS),
    ].flatMap((v) =>
      [v.name, v.drag, v.place].filter((c): c is string => !!c),
    ),
  ),
];
