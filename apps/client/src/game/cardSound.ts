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

import { ALL_MAINS, type Card, type DragSound } from "@amanda/shared";
import { cardFor } from "./preview";

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
  /*
   * Or: *"make sounds for Ocean and Frozen too."* The two ends of the Sea —
   * the biggest card in the family and the one that freezes. Both specced in
   * packages/art/src/sounds.ts and neither recorded yet, so both are on
   * CRIES_TO_RECORD below.
   */
  sea_06_frozen: { cry: "card-frozen" },
  sea_08_ocean: { cry: "card-ocean" },
  slimes_01_basic_slime: { cry: "card-slime" },
  /*
   * Two that say their name and have no sound of their own yet. They are
   * not mains — they are the biggest card in their family, which is a
   * different reason to have a voice and a perfectly good one. Nothing
   * about "the two you meet a family with" says nobody else may speak.
   */
  slimes_10_zelig_giant_ooze: { name: "card-name-zelig" },
  plants_10_great_mother_tree: { name: "card-name-mother-tree" },
  /*
   * And three more Or named on 9 November 2026: *"add a sound that says its
   * name for Torch, for Kioory, Avenging Wasp, Sky King."*
   *
   * Which settles the rule the two above only implied: a card earns a voice
   * by being SOMEBODY, not by being one of the two you meet a family with.
   * Torch is the dragon that goes for the King, the Sky King is a King, and
   * the wasp is the card Or renamed last week so it would mean something.
   *
   * ⚠ THE RECORDINGS DO NOT EXIST YET, so all three are on
   * NAMES_TO_RECORD below and kept out of the loader. A name with no file is
   * a 404 on the first press of the game, and — worse — a card that says
   * nothing, which is indistinguishable from a card that was never given a
   * voice at all. See packages/art/src/voices.ts for the three specs and
   * `pnpm art:voices` for the one command that makes them.
   */
  dragons_03_thunderwing: { name: "card-name-torch" },
  furries_02_kioory: { name: "card-name-kioory" },
  dragons_10_sky_king: { name: "card-name-sky-king" },
  insects_07_aggressive_wasp: { name: "card-name-avenging-wasp" },
  // Chuppy moved to MAIN_NAME, with the rest of the mains.
};

/**
 * Names that are written down and not yet recorded.
 *
 * The same mechanism as DRAG_SOUNDS_TO_RECORD and the nulls in MAIN_NAME,
 * and it exists for the same reason: `sfx.voice` is deliberately silent when
 * a clip is missing, so a card named here without a file is a card that says
 * nothing — which looks exactly like a card nobody ever meant to give a
 * voice. Written down, the gap is a list, a test holds it against the files
 * on disk in both directions, and recording one is the deletion of one
 * string.
 */
export const NAMES_TO_RECORD: readonly string[] = [
  /*
   * Empty since 9 November 2026, when Or said *"why do you not just use FAL
   * to generate?"* and all four were made. The list stays because the
   * mechanism is the point: the next name somebody writes down goes here
   * until it exists, and the test refuses to let this disagree with the
   * files on disk in either direction.
   */
];

/**
 * ═══ WHAT AMANDA SAYS, AND SHE PICKS ═══
 *
 * Or: *"and for Amanda make several random options for the voices, a woman of
 * about 40-50 with a slight Spanish accent"* — and then seven lines.
 *
 * Split in two because she has two kinds of moment and the lines are not
 * interchangeable: she ARRIVES, and then she is hungry at you. "I'm Amanda"
 * over a board that has been fighting for a minute is a introduction nobody
 * needed; "Oh, kids menu" before the player has even seen her is a punchline
 * with no setup.
 *
 * ⚠ NONE OF THESE ARE RECORDED YET. The specs are in
 * packages/art/src/voices.ts and `pnpm art:voices amanda` makes all seven —
 * it costs money, so it is Or's to run. Until then `sfx.voice` is silent on
 * every one of them and nothing else changes, which is the whole reason the
 * code can be finished before the audio exists.
 */
export const AMANDA_LINES = {
  /** When she turns up. */
  hello: ["amanda-kiddo", "amanda-iam", "amanda-name"],
  /** Once the fighting starts. */
  hungry: ["amanda-dinner", "amanda-tasty", "amanda-menu", "amanda-comehere"],
} as const;

/** Every line of hers, for the loader and for the tests. */
export const ALL_AMANDA: readonly string[] = [
  ...AMANDA_LINES.hello,
  ...AMANDA_LINES.hungry,
];

/**
 * Cries that are written down and not yet recorded.
 *
 * The third list of this shape in this file, and the reason is the same all
 * three times: `sfx.voice` is silent when a clip is missing, so a card named
 * here without a file sounds exactly like a card nobody gave a sound to. Only
 * a list can tell the two apart, and a test holds it against the files on
 * disk in both directions.
 */
export const CRIES_TO_RECORD: readonly string[] = [
  // Empty since 9 November 2026 — `card-ocean` and `card-frozen` were made
  // in the same batch as the names. The list stays for the next one.
];

/** Is there a recording behind this spoken name yet? */
export function nameExists(clip: string): boolean {
  return !NAMES_TO_RECORD.includes(clip);
}

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
  machines_01_boltling: "card-name-boltling",
  machines_06_mandroid: "card-name-mandroid",
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
  sea_02_jellyfish: "card-name-jellyfish",
  sea_07_siren: "card-name-siren",
  giants_01_stone_colossus: "card-name-stone-golem",
  giants_07_iron_bulwark: "card-name-iron-bulwark",
  demons_01_alley_king: "card-name-alley-king",
  insects_01_ant_soldier: "card-name-ant-soldier",
  insects_02_ant_queen: "card-name-ant-queen",
  plants_01_thorn_sprout: "card-name-thorn-sprout",
  plants_03_healing_bloom: "card-name-healing-bloom",
  slimes_01_basic_slime: "card-name-slime",
  slimes_11_thing_in_the_bin: "card-name-thing-in-the-bin",
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

/**
 * The list Or picks from, and the clip each name means.
 *
 * Or: *"let me choose, for every monster… a drag sound out of a list of
 * sounds."* These are the mixer's own ingredients — nothing new was
 * recorded for the list, because a list of sounds that are not already in
 * the game is a list of promises.
 *
 * ⚠ VOICE_CLIPS IS BUILT FROM THIS, so a sound added here is a sound that
 * gets decoded at unlock. A clip asked for mid-gesture that was never
 * fetched arrives after the gesture that wanted it, which is not a sound,
 * it is lag.
 */
export const DRAG_SOUND_CLIP: Record<DragSound, string | null> = {
  none: null,
  flame: "ing-flame",
  ice: "ing-ice",
  stone: "ing-stone",
  slime: "ing-slime",
  spark: "ing-spark",
  skitter: "ing-skitter",
  dragonWings: "ing-wings-dragon",
  insectWings: "ing-wings-insect",
  egg: "card-obsidian-egg",
  // ── the ten, specced in packages/art/src/sounds.ts ──
  wind: "ing-wind",
  bubbles: "ing-bubbles",
  gears: "ing-gears",
  steam: "ing-steam",
  leaves: "ing-leaves",
  sand: "ing-sand",
  growl: "ing-growl",
  chains: "ing-chains",
  heartbeat: "ing-heartbeat",
  magic: "ing-magic",
  // Kioory, and the one thing a plastic keyring would actually make.
  steps: "ing-steps",
};

/**
 * ═══ THE ONES THAT ARE NAMED AND NOT YET RECORDED ═══
 *
 * Exactly the same arrangement as the nine main cards still waiting for a
 * voice, and for the same reason, written out there at length: a sound with
 * no file is SILENT, and silent is also what "this card has no drag sound"
 * looks like. Left out of the list, the gap would only be found by choosing
 * all twenty and listening; named here, it is a list anyone can read, the
 * editor prints it beside the option, and dragChoice.test.ts checks this
 * list against what is actually on disk — so recording one is a one-word
 * change and forgetting to remove it fails a test.
 *
 * ⚠ AND THEY MUST NOT REACH THE LOADER. `loadClips` fetches everything in
 * VOICE_CLIPS at unlock; a name with no file is ten 404s on the first press
 * of the game.
 */
export const DRAG_SOUNDS_TO_RECORD: readonly DragSound[] = [
  /*
   * Empty again since 9 November 2026: `steps` was written down for Kioory in
   * the morning and recorded the same evening. The list stays because the
   * mechanism is the point, and the test below refuses to let it disagree
   * with the files on disk in either direction.
   */
];

/** Is there a recording behind this name yet? */
export function dragSoundExists(id: DragSound): boolean {
  return !DRAG_SOUNDS_TO_RECORD.includes(id);
}

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

/**
 * The mix for a card that is in the catalogue (or on the editor's bench).
 *
 * ⚠ Prefer `dragMixOf` anywhere the card is already in hand — the admin
 * panel edits a DRAFT, and a draft is only reachable by id for as long as
 * the preview seam points at it (preview.ts), which is one render later
 * than the form that wants to describe it.
 */
export function dragMix(cardId: string): DragLayer[] {
  const card = cardFor(cardId);
  return card ? dragMixOf(card) : [];
}

/** What a card sounds like while it is carried. */
export function dragMixOf(card: Card): DragLayer[] {
  const cardId = card.id;

  /*
   * What Or chose for this card, before anything is worked out. One
   * ingredient instead of the mix — the point of choosing is to stop the
   * mixer, so layering his choice on top of the recipe would be answering a
   * different question. `none` is a card he wants silent, and it has to be
   * a real answer or there is no way to say it.
   */
  const chosen = card.drag?.sound;
  /*
   * ⚠ AND A CHOICE THAT HAS NOT BEEN RECORDED YET FALLS THROUGH.
   *
   * `steps` was named for Kioory before anybody recorded it — Or: *"he needs
   * a sound of footsteps, ordinary walking"* — and honouring that choice
   * immediately meant the card asked for `ing-steps.mp3`, which is a 404 at
   * unlock and then a card that is SILENT in the hand. A test caught it
   * (cardSound.test.ts, "asks only for clips that exist"), and the test was
   * right: a choice is a promise about a sound, and a sound that does not
   * exist is not one.
   *
   * So an unrecorded choice is ignored and the mixer derives as if nobody
   * had chosen — which means the card sounds like SOMETHING today, and
   * starts sounding like footsteps the moment the clip lands, with no second
   * change anywhere. `none` is deliberately not affected: that is a card Or
   * wants silent, and silence needs no recording.
   */
  if (chosen && chosen !== "none" && !dragSoundExists(chosen)) {
    // fall through to the derivation below
  } else if (chosen) {
    const clip = DRAG_SOUND_CLIP[chosen];
    if (!clip) return [];
    const weight = heft(card.stats.hp);
    return [{ clip, gain: 0.46 + weight * 0.14, rate: 1.08 - weight * 0.26 }];
  }

  const own = OWN_DRAG[cardId];
  if (own) return [{ clip: own, gain: 0.6, rate: 1 }];

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
  const card = cardFor(cardId);
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
 * ═══ AND THE ONE CARD WHOSE NAME IS SEVEN DIFFERENT SENTENCES ═══
 *
 * Or, on the evening after her clips went live: *"I still cannot hear Amanda
 * in the playground."*
 *
 * She was silent because `voiceFor` is a lookup of ONE slug per card, and
 * Amanda has never had one. Her seven lines were wired to her MODE — a
 * `sfx.amanda()` when the match begins, another when the fighting starts —
 * and nowhere to the card. So the one place in the game built for picking a
 * card up and hearing what it is was the one place she could not be heard.
 *
 * ⚠ THE FIX IS NOT AN ENTRY IN `CARDS`, DELIBERATELY. A name there is a
 * constant, and the whole point of hers is that it is not one: Or asked for
 * *"several random options"*, and a card that says the same sentence every
 * time you touch it is the opposite of that. So the tap asks for a LINE, and
 * the choice happens at the moment of the tap.
 *
 * `hello` and not `hungry`, because picking a card up is an arrival. "Dinner
 * is ready" belongs over a board that is already fighting, which is where
 * App.tsx plays it.
 */
export const AMANDA_CARD = "legends_01_amanda";

/**
 * What a card says the instant it is pressed — the slug, not the sound.
 *
 * Every caller already had `voiceFor(id).name` written out; this exists so
 * that the one card whose answer is a dice roll does not have to be special
 * -cased at four call sites. Everything else answers exactly as before.
 */
export function tapVoice(cardId: string): string | undefined {
  if (cardId === AMANDA_CARD) {
    const pool = AMANDA_LINES.hello;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return voiceFor(cardId).name;
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
      // be fetched when they are wanted. Read off the list the panel offers,
      // so a sound Or can choose is a sound that has been decoded — minus
      // the ten that have not been recorded, which would be ten 404s.
      ...(Object.entries(DRAG_SOUND_CLIP) as Array<[DragSound, string | null]>)
        .filter(([id, clip]) => clip && dragSoundExists(id))
        .map(([, clip]) => ({ drag: clip! }) as CardVoice),
      ...Object.values(OWN_DRAG).map((clip) => ({ drag: clip }) as CardVoice),
      ...Object.values(BY_ELEMENT),
      ...Object.values(BY_SERIES),
      // Minus any spoken name or cry that has not been recorded — see
      // NAMES_TO_RECORD and CRIES_TO_RECORD. A clip with no file is a 404
      // at unlock, for every player, on the first press of the game.
      ...Object.values(CARDS).map((v) => ({
        ...v,
        ...(v.name && !nameExists(v.name) ? { name: undefined } : {}),
        ...(v.cry && CRIES_TO_RECORD.includes(v.cry) ? { cry: undefined } : {}),
      })),
      // The mains that have been recorded. The nulls are the ones that
      // have not, and they must not reach the loader as a 404.
      ...Object.values(MAIN_NAME).map((name) => ({ ...(name ? { name } : {}) }) as CardVoice),
      /*
       * ⚠ AND AMANDA, WHO WAS SILENT FOR A WHOLE EVENING BECAUSE OF THIS.
       *
       * Or: *"Amanda has no sound. Are you sure everything went up?"* It had
       * — all seven clips were live on the site and listed in art.json. They
       * were simply never DECODED: `ALL_AMANDA` was declared and then used
       * nowhere, so `loadClips` never fetched them and `sfx.voice` found no
       * buffer and did what it is supposed to do when a clip is missing,
       * which is nothing at all.
       *
       * The same silence as a missing file, from the opposite cause — and no
       * TO_RECORD list could ever have caught it, because the files existed.
       * See "every clip the game can ask for is in the loader" in
       * cardSound.test.ts, which now checks the direction nothing checked.
       */
      ...ALL_AMANDA.map((name) => ({ name }) as CardVoice),
    ].flatMap((v) =>
      [v.name, v.drag, v.cry].filter((c): c is string => !!c),
    ),
  ),
];
