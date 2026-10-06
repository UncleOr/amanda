/**
 * How much album somebody has.
 *
 * ═══ WHY THIS NUMBER EXISTS AT ALL ═══
 *
 * Or's complaint, in his words: "there must not be a situation where all his
 * cards are fourteen levels stronger than mine." Trophies cannot prevent that.
 * Trophies measure SKILL: a careful player with a thin album climbs, and a
 * careless one with a deep album does not — so matching on trophies alone
 * pairs exactly the two people whose boards are least alike.
 *
 * So there are two numbers. `trophies` is how well you play. This is how much
 * you have, and the matchmaker will not put a wide gap in it on the board
 * however long somebody has been waiting (see apps/server/src/matchmaking.ts).
 *
 * ═══ WHAT IT COUNTS, AND WHY THOSE THINGS ═══
 *
 * A card contributes what it would actually bring to a board:
 *
 *   ITS RARITY, because a legendary is worth more than a common and pretending
 *   otherwise makes the number useless for the one job it has.
 *
 *   ITS LEVEL, through the same multiplier the engine uses for its stats. A
 *   level 10 card is a card and a half in a battle, so it is a card and a half
 *   here. Using the engine's own function means a balance change to levelling
 *   moves this with it rather than leaving it quietly wrong.
 *
 *   ITS SPARE COPIES, a little. Copies are the placement budget — a second
 *   copy means the card may go on the board twice — but the tenth spare copy
 *   of a common is not ten times the first, so they are counted with a
 *   sharply diminishing hand.
 *
 * The scale is arbitrary and that is fine: nothing compares this number to
 * anything except another player's.
 */
import { levelMultiplier } from "./config.js";

/**
 * What a card of each rarity is worth before levels and copies.
 *
 * Deliberately gentle. A legendary being worth six commons is enough to stop
 * "I have one legendary" reading as "I have six cards"; worth sixty would
 * make a single lucky chest look like a year of playing.
 */
export const RARITY_WEIGHT: Record<string, number> = {
  common: 1,
  rare: 2,
  epic: 3.5,
  legendary: 6,
};

/** How much a spare copy adds, as a fraction of the card's own worth. */
const SPARE_COPY = 0.15;
/** Spare copies counted past this are not counted at all. */
const SPARE_CAP = 8;

export interface OwnedCardRow {
  rarity: string;
  level: number;
  copies: number;
}

/** One card's contribution. */
export function cardPower({ rarity, level, copies }: OwnedCardRow): number {
  const weight = RARITY_WEIGHT[rarity] ?? RARITY_WEIGHT.common!;
  const spares = Math.min(Math.max(0, (copies || 1) - 1), SPARE_CAP);
  return weight * levelMultiplier(level || 1) * (1 + spares * SPARE_COPY);
}

/**
 * The whole album, as one integer.
 *
 * Rounded because it is stored in an integer column and because a number with
 * a decimal point in it invites somebody to read more precision into it than
 * is there.
 */
export function albumPower(cards: readonly OwnedCardRow[]): number {
  let total = 0;
  for (const c of cards) total += cardPower(c);
  return Math.round(total);
}

/**
 * The widest album gap that may be put on one board, as a FRACTION of the
 * stronger album.
 *
 * A fraction rather than a flat number because the gap that matters is
 * relative: 40 points between two beginners is the whole game, and 40 points
 * between two collectors is nothing.
 *
 * This one does not widen with waiting. Everything else about matchmaking
 * relaxes as somebody waits — this is the line that does not, because a match
 * that was decided before it started is worse than waiting another ten
 * seconds, and Or said so.
 */
export const MAX_ALBUM_GAP = 0.45;

/** Are these two albums close enough to make a fair board? */
export function albumsComparable(a: number, b: number): boolean {
  const high = Math.max(a, b);
  // Two nearly-empty albums are always comparable; the fraction would be
  // meaningless and new players must never be left queuing.
  if (high <= 12) return true;
  return Math.abs(a - b) / high <= MAX_ALBUM_GAP;
}
