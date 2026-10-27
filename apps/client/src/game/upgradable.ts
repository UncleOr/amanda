import { LEVELS, levelCost } from "@amanda/shared";
import { CATALOG, collectable } from "../data/catalog";
import type { OwnedCard } from "./account";

/**
 * **Which cards you have collected enough of to level up.**
 *
 * This was a closure inside Album.tsx, which was the right place for it
 * right up until the home screen needed the same answer.
 *
 * Or: *"and give me a small green mark on the album if I have cards that
 * can be upgraded."* A mark that disagreed with the screen it points at
 * would be worse than no mark, so there is one rule and two readers: the
 * album's "ready to upgrade" filter, and the dot.
 */
export type Album = Map<string, OwnedCard> | null | undefined;

/**
 * Deliberately NOT "and I can afford the diamonds".
 *
 * The question is "what have I collected enough of", and hiding a card
 * because the purse is empty would make the list change when you spend
 * money somewhere else. The button under the card is where affordability is
 * said, in red.
 */
export function readyToLevel(album: Album, cardId: string): boolean {
  const mine = album?.get(cardId);
  if (!mine || mine.level >= LEVELS.max) return false;
  const card = CATALOG.get(cardId);
  return !!card && mine.copies >= levelCost(card.rarity, mine.level);
}

/**
 * Is anything at all ready?
 *
 * Walks the collectable cards rather than the album's own keys, which is
 * the same set the album counts and the chests draw from — a leftover row
 * from a sealed family must not light a dot pointing at a card the album
 * will not show.
 */
export function anyReadyToLevel(album: Album): boolean {
  if (!album || album.size === 0) return false;
  return collectable().some((c) => readyToLevel(album, c.id));
}
