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

import { ALL_MAINS } from "@amanda/shared";
import { CATALOG } from "../data/catalog";

/** One card's three moments. Every one of them is optional. */
export interface CardVoice {
  /** Its own name, said in its own voice, when the card is tapped. */
  name?: string;
  /** While it is being carried. Loops for as long as the drag lasts. */
  drag?: string;
  /**
   * The card's own cry — the creature, rather than the card.
   *
   * ⚠ NOT a placement sound. It was one for an afternoon, under the gentle
   * `place`, and Or took it off: *"take them off the placing, let the
   * placing be only the gentle sound."* He is right, and the reason is the
   * one he gave for making `place` gentle in the first place — twelve
   * placements a build phase is not a moment, it is a rhythm, and a
   * creature announcing itself twelve times is noise.
   *
   * It is kept for the moments that ARE moments. Today that is one: a
   * dragon bursting out of the Obsidian Egg, which happens once in a match
   * if it happens at all.
   */
  cry?: string;
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
  fire: { cry: "card-flame-dragon" },
  earth: { cry: "card-stone-golem" },
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
  slimes: { cry: "card-slime" },
  insects: { cry: "card-ant-soldier" },
  plants: { cry: "card-healing-bloom" },
};

/**
 * And the cards that are themselves.
 *
 * The eight Or picked out by name. Seven were generated from a description
 * of a physical event; `card-healing-bloom` is built note by note, because
 * "spiritual and high" is a feeling and feelings are music. See
 * packages/art/src/sounds.ts and fanfare.ts.
 *
 * What is left here is the CRIES. A main's spoken name lives in MAIN_NAME
 * below, in one table with the nine that are not recorded yet — two places
 * holding the same card's name is how one of them goes stale.
 */
const CARDS: Record<string, CardVoice> = {
  dragons_01_flame_dragon: { cry: "card-flame-dragon" },
  dragons_02_obsidian_egg: { cry: "card-obsidian-egg" },
  dragons_04_lava: { name: "card-name-lava", cry: "card-lava" },
  giants_01_stone_colossus: { cry: "card-stone-golem" },
  giants_10_titan_king: { name: "card-name-titan-king", cry: "card-titan-king" },
  insects_01_ant_soldier: { cry: "card-ant-soldier" },
  plants_03_healing_bloom: { cry: "card-healing-bloom" },
  slimes_01_basic_slime: { cry: "card-slime" },
  /*
   * Two that say their name and have no sound of their own yet. They are
   * not mains — they are the biggest card in their family, which is a
   * different reason to have a voice and a perfectly good one. Nothing
   * about "the two you meet a family with" says nobody else may speak.
   */
  slimes_10_zelig_giant_ooze: { name: "card-name-zelig" },
  plants_10_great_mother_tree: { name: "card-name-mother-tree" },
  // Chuppy moved to MAIN_NAME, with the rest of the mains.
};

/**
 * ═══ THE TWO FROM EACH FAMILY THAT SAY THEIR OWN NAME ═══
 *
 * Or: *"pick which 2 from each series are the main ones, that are the first
 * ones you get, and that also say their own name when you tap them, in a
 * fitting voice."*
 *
 * WHICH two is not decided here — it is decided once, in shared/mains.ts,
 * because the same pair has to be the pair a chest hands you first. A card
 * that introduces a family and a card that announces itself being two
 * different cards is the bug this table exists to make impossible.
 *
 * ⚠ WHAT `null` MEANS, AND WHY IT IS WRITTEN DOWN RATHER THAN LEFT OUT.
 * A clip is a recording; the nine below do not exist yet, and generating
 * them costs money that is not mine to spend. `sfx.voice` is deliberately
 * silent when a clip is missing, so a main left out of this table would be
 * indistinguishable from a main whose recording never happened — and would
 * stay that way until somebody tapped all twenty cards and listened. Named
 * with `null`, the gap is a list anyone can read, mains.test.ts checks the
 * list is complete, and recording one is one word of a change.
 */
const MAIN_NAME: Record<string, string | null> = {
  dragons_01_flame_dragon: "card-name-flame-dragon",
  dragons_02_obsidian_egg: "card-name-obsidian-egg",
  machines_01_boltling: null,
  machines_06_mandroid: null,
  /*
   * ⚠ Chuppy's voice had a constraint on it rather than just a
   * description. Or: *"Chuppy is too similar to Pikachu — he electrifies,
   * he is yellow, and even the name is close. So at least let his VOICE be
   * far from Pikachu (but still cute)."*
   *
   * Which rules out the obvious reading of "cute electric creature says its
   * own name" almost entirely: high, squeaky and two syllables IS the thing
   * being avoided. Worth re-reading before the nine below are recorded,
   * because it is the only brief in this table written as a list of what
   * the voice must NOT be.
   */
  furries_01_chuppy: "card-name-chuppy",
  sea_02_jellyfish: null,
  sea_07_siren: null,
  giants_01_stone_colossus: "card-name-stone-golem",
  giants_07_iron_bulwark: null,
  demons_01_alley_king: null,
  insects_01_ant_soldier: "card-name-ant-soldier",
  insects_02_ant_queen: null,
  plants_01_thorn_sprout: null,
  plants_03_healing_bloom: "card-name-healing-bloom",
  slimes_01_basic_slime: "card-name-slime",
  slimes_11_thing_in_the_bin: null,
};

/** The mains still waiting for a recording, in one line, for whoever runs it. */
export const MAINS_WITHOUT_A_VOICE: readonly string[] = ALL_MAINS.filter(
  (id) => !MAIN_NAME[id],
);

/* ═══ WHAT A CARD SOUNDS LIKE WHILE IT IS BEING CARRIED ═══
 *
 * Or: *"Flame Dragon with a wingbeat would suit all the dragons. The Father
 * of Giants with a bit of rubbing stones would suit the giants. You can
 * make combinations — flame + wings = Flame Dragon, wings + cracking ice =
 * Ice Dragon, different levels of flame + wings give different dragons. Do
 * them all like that."*
 *
 * So a drag sound is MIXED, not chosen. There are eight ingredients and
 * fifty-two cards, and nothing below is written per card: the layers come
 * from what the card already says about itself — it flies, it is made of
 * fire, it is a slime — and the levels come from how big it is.
 *
 * That is the whole of "different levels give different dragons". The Flame
 * Dragon and the Ice Dragon are the same two-layer recipe with a different
 * second ingredient; the Sky King and a firefly are the same wing layer at
 * different speeds, because one of them weighs twenty times what the other
 * does and `heft` knows it.
 */

/** One ingredient in a drag mix. */
export interface DragLayer {
  /** A clip in public/sfx, looped for as long as the finger is down. */
  clip: string;
  gain: number;
  /** Playback rate. Below 1 is bigger and slower; above is smaller. */
  rate: number;
}

/**
 * 0 for the smallest card in the game, 1 for the largest.
 *
 * Health rather than power, because this is about BODY: what it would be
 * like to pick the thing up. A thorn sprout is 200 and the Titan is 2,500.
 */
function heft(hp: number): number {
  return Math.max(0, Math.min(1, (hp - 200) / 2300));
}

/**
 * The cards whose drag is their own, and not a recipe.
 *
 * Or: *"the egg specifically."* An egg is not made of anything the mixer
 * knows about and it is not a texture — it is one event, a shell under
 * strain. Everything else in the game is a material and a size.
 */
const OWN_DRAG: Record<string, string> = {
  dragons_02_obsidian_egg: "card-obsidian-egg",
};

/** What the card is made of, as a layer. One per card, the first that hits. */
const BY_MATERIAL: Array<[string, string, number]> = [
  // element, clip, how loud it is relative to the wings
  ["fire", "ing-flame", 0.5],
  ["water", "ing-ice", 0.45],
  ["electric", "ing-spark", 0.42],
  ["earth", "ing-stone", 0.52],
  ["metal", "ing-stone", 0.4],
  ["poison", "ing-slime", 0.34],
];

export function dragMix(cardId: string): DragLayer[] {
  const own = OWN_DRAG[cardId];
  if (own) return [{ clip: own, gain: 0.6, rate: 1 }];

  const card = CATALOG.get(cardId);
  if (!card) return [];
  const series = cardId.slice(0, cardId.indexOf("_"));
  const big = heft(card.stats.hp);
  const layers: DragLayer[] = [];

  /*
   * Wings first, and which wings is a different animal rather than a
   * different size — Or: *"the wings you made suit insects, but dragons
   * will of course need different wings (which also sound different from
   * insect wings)."* A dragon's beat slows down the heavier it is; an
   * insect's does not, because an insect's wing is already a blur.
   */
  if (card.flying) {
    layers.push(
      series === "dragons"
        ? { clip: "ing-wings-dragon", gain: 0.46 + big * 0.14, rate: 1.1 - big * 0.3 }
        : { clip: "ing-wings-insect", gain: 0.3, rate: 1.05 + (1 - big) * 0.25 },
    );
  }

  // What it is made of.
  const mat = BY_MATERIAL.find(([el]) => card.elements.includes(el as never));
  if (mat) layers.push({ clip: mat[1], gain: mat[2] * (0.72 + big * 0.5), rate: 1.08 - big * 0.26 });

  // And a couple of families whose character is the family.
  if (series === "slimes") layers.push({ clip: "ing-slime", gain: 0.5, rate: 1.05 - big * 0.25 });
  if (series === "insects" && !card.flying)
    layers.push({ clip: "ing-skitter", gain: 0.42, rate: 1.15 - big * 0.3 });

  /*
   * Something always plays. A card with no element the mixer knows and no
   * family of its own would otherwise be silent in the hand, which reads as
   * the game having stopped working rather than as a quiet card.
   */
  if (!layers.length) layers.push({ clip: "ing-stone", gain: 0.22, rate: 1.2 });
  return layers;
}

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
  /*
   * A main's spoken name sits between the series and the card: wider than
   * one entry, narrower than a family. CARDS still wins, so the day a main
   * wants a different clip from the one the table gives it, one line there
   * does it without this function learning a new rule.
   */
  const spoken = MAIN_NAME[cardId];
  return {
    ...byElement,
    ...BY_SERIES[series],
    ...(spoken ? { name: spoken } : {}),
    ...CARDS[cardId],
  };
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
      // The drag ingredients, which are asked for mid-gesture and so cannot
      // be fetched when they are wanted.
      ...["ing-wings-dragon", "ing-wings-insect", "ing-flame", "ing-ice", "ing-stone", "ing-slime", "ing-spark", "ing-skitter"].map(
        (clip) => ({ drag: clip }) as CardVoice,
      ),
      ...Object.values(OWN_DRAG).map((clip) => ({ drag: clip }) as CardVoice),
      ...Object.values(BY_ELEMENT),
      ...Object.values(BY_SERIES),
      ...Object.values(CARDS),
      // The mains that have been recorded. The nulls are the ones that
      // have not, and they must not reach the loader as a 404.
      ...Object.values(MAIN_NAME).map((name) => ({ ...(name ? { name } : {}) }) as CardVoice),
    ].flatMap((v) =>
      [v.name, v.drag, v.cry].filter((c): c is string => !!c),
    ),
  ),
];
