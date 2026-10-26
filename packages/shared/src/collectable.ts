/**
 * Which cards can be WON, as opposed to merely existing.
 *
 * ═══ WHY THIS IS ONE DEFINITION AND NOT THREE ═══
 *
 * It was three, and they disagreed.
 *
 * The chest pool said "anything with a series that is not the Crumb Demon".
 * The album header said "anything in one of the seven series files". The
 * achievements counted the series files. Each was written where it was
 * needed and each was reasonable on its own — and between them Amanda's own
 * card, which `amandaBoard.ts` has always described as *"never in a pack,
 * never in an album"*, was in the chest pool, counted in the album's total,
 * and required for "the whole album".
 *
 * Or, deciding it: *"right now Amanda cannot be won (and certainly cannot be
 * played). Same for the Crumb Demon. In future we will think about how you
 * get Amanda — maybe a special event, maybe a purchase, maybe a special
 * challenge."*
 *
 * So the rule lives here, once, and the pool, the album and the achievements
 * all ask it. The day she becomes winnable, she is taken off this list and
 * every one of those three follows — including the "A Legend" achievement,
 * which is written as "a legendary card in the album" and simply starts
 * being earnable.
 */
import { sealedFamilies } from "./arenas.js";
import type { Card } from "./schemas/card.js";

/**
 * The series id given to cards that are synthesised in code rather than
 * loaded from data/series — the Crumb Demon that pads an unfinished board.
 */
export const SYSTEM_SERIES = "system";

/**
 * Cards that are real, playable game objects and are not prizes.
 *
 * Both are here for the same reason and it is not rarity: neither is
 * something a player is supposed to own. The Crumb Demon is filler the game
 * puts on your board when the clock beats you, and Amanda is the opponent.
 */
export const UNCOLLECTABLE: ReadonlySet<string> = new Set([
  "crumb_demon",
  // AMANDA_CARD, written out rather than imported: amandaBoard.ts imports
  // config.ts, and a cycle between these two would be a strange way to find
  // out that a constant moved.
  "legends_01_amanda",
]);

/**
 * Can this card end up in somebody's album?
 *
 * === AND A FAMILY WHOSE ARENA IS SHUT IS NOT IN THE GAME ===
 *
 * Or: *"lock the alley and the petrol station for now"*, and in the same
 * breath about the family that lives in the alley: *"we will build a new
 * series together and decide who is in it."* So the Strays are not a secret
 * to be found early - they are not finished, and the arena that introduces
 * them is shut.
 *
 * Asking it HERE rather than in the chest pool is the point. This one
 * function is what the album total, the achievements and the draw all ask,
 * so a sealed family is absent from every one of them at once: it is not in
 * "41 of 51", it does not make "the whole album" unwinnable, and it cannot
 * come out of a chest. The day the alley opens, it appears in all three
 * with no other change.
 */
export function isCollectable(card: Pick<Card, "id" | "seriesId">): boolean {
  if (card.seriesId === SYSTEM_SERIES || UNCOLLECTABLE.has(card.id)) return false;
  return !sealedFamilies().has(card.seriesId);
}

/** Every collectable card in a catalog, which is what "the whole album" means. */
export function collectableCards<T extends Pick<Card, "id" | "seriesId">>(
  catalog: Iterable<T>,
): T[] {
  return [...catalog].filter(isCollectable);
}
