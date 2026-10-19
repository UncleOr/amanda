/**
 * The back of your cards — what the other player stares at for ninety
 * seconds while your board is still fogged.
 *
 * Or: *"at least 3 saved decks, each with a unique name and a unique design
 * for the card backs — let every player start with 5 designs and be able to
 * buy more, add it to the shop, exactly like the catchphrases."*
 *
 * ═══ WHY THEY ARE TREATMENTS AND NOT PICTURES ═══
 *
 * Same reasoning as the catchphrases, which are also a closed list with a
 * `style` the screen knows how to draw. A back is a surface: a pattern, two
 * colours and a mark. Drawn in CSS it is sharp at every size, weighs nothing,
 * recolours for free, and — the part that matters for what Or wants —
 * **adding the twelfth one is four lines.** He has said he wants hundreds of
 * catchphrases eventually; this is the same shape, so the same is true here.
 *
 * ═══ THE FREE FIVE ARE THE FIVE FAMILIES ═══
 *
 * Not five arbitrary patterns. Scales, slime, web, leaves and the fog that
 * every card already hides behind — so the first thing a player can do with
 * this screen is make a deck that LOOKS like what is in it. That is the
 * cheapest possible way to make a deck feel like a thing you built rather
 * than sixteen cards you ticked.
 */

/** A back a player can put on a deck. */
export interface CardBack {
  id: string;
  he: string;
  en: string;
  /** Everybody has it from the first match. */
  free?: boolean;
  /** The shop item that grants it. Absent on the free ones. */
  item?: string;
  /** An icon name, drawn faintly at the centre. See Icon.tsx. */
  mark: string;
}

/** What a deck uses when nobody has chosen. */
export const DEFAULT_BACK = "fog";

export const CARD_BACKS: CardBack[] = [
  // ── the free five ──
  { id: "fog", he: "ערפל", en: "Fog", free: true, mark: "hidden" },
  { id: "scales", he: "קשקשים", en: "Scales", free: true, mark: "fire" },
  { id: "slime", he: "ריר", en: "Slime", free: true, mark: "poison" },
  { id: "web", he: "קורים", en: "Web", free: true, mark: "thorns" },
  { id: "leaf", he: "עלים", en: "Leaves", free: true, mark: "earth" },

  // ── and the ones the shop sells ──
  { id: "gold", he: "זהב", en: "Gold", item: "back.gold", mark: "king" },
  { id: "circuit", he: "מעגל", en: "Circuit", item: "back.circuit", mark: "electric" },
  { id: "nacho", he: "נאצ'וס", en: "Nachos", item: "back.nacho", mark: "nacho" },
  { id: "stars", he: "כוכבים", en: "Stars", item: "back.stars", mark: "light" },
  { id: "lava", he: "לבה", en: "Lava", item: "back.lava", mark: "fire" },
  { id: "bones", he: "עצמות", en: "Bones", item: "back.bones", mark: "skull" },
];

const BY_ID = new Map(CARD_BACKS.map((b) => [b.id, b]));

export function cardBack(id: string | null | undefined): CardBack {
  return BY_ID.get(id ?? "") ?? BY_ID.get(DEFAULT_BACK)!;
}

/** Is this one of the backs this player may put on a deck? */
export function ownsBack(back: CardBack, items: ReadonlySet<string> | readonly string[]): boolean {
  if (back.free) return true;
  if (!back.item) return true;
  return Array.isArray(items) ? items.includes(back.item) : (items as ReadonlySet<string>).has(back.item);
}

/**
 * ═══ THE PICKER SHOWS WHAT YOU HAVE, AND NOTHING ELSE ═══
 *
 * It used to show all eleven, the unowned ones greyed with a padlock, on the
 * grounds that wanting one is the point.
 *
 * Or: *"in the deck builder, in the card-back picker, I don't need to see
 * everything that could be or will be in the shop. Don't forget that one day
 * at Hanukkah we'll suddenly bring out a Hanukkah back or something. Only
 * what I have."*
 *
 * Which is the half of it I had not thought about at all. This list is also
 * the ROADMAP: anything added here for a date — a holiday back, a birthday
 * back, the thing being saved for a launch — appears in every player's
 * picker the moment it is deployed, greyed out and named, weeks before it is
 * meant to exist. The shop is where a thing is sold; this is where a thing
 * you own is chosen, and those are different screens.
 *
 * `wearing` is kept whatever happens: a deck is allowed to be wearing a back
 * the player no longer owns, and the picker must still show what it is
 * wearing rather than silently disagreeing with the deck.
 */
export function myBacks(
  items: ReadonlySet<string> | readonly string[],
  wearing?: string | null,
): CardBack[] {
  return CARD_BACKS.filter((b) => ownsBack(b, items) || (!!wearing && b.id === wearing));
}
