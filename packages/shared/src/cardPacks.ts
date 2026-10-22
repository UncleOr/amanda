/**
 * ═══ COPIES COME IN PACKS ═══
 *
 * Or: *"maybe I did not make myself clear: I want to be able to buy monster
 * cards too. Say I am 6 Flame Dragons short of an upgrade — I will buy a pack
 * of 10 Flame Dragons, then upgrade, and I will also have +2 towards the next
 * upgrade."*
 *
 * Which is the whole thing in one sentence, and it is about arithmetic rather
 * than shopping. An upgrade costs copies — four to go from level 1 to 2,
 * seventeen from 4 to 5 — and being SIX short is a specific, countable
 * problem. Selling one copy at a time answers it by making him press a button
 * six times; selling a pack answers it.
 *
 * The leftovers matter as much as the upgrade, and he said so: +2 towards the
 * next one. Copies never evaporate, so a pack that overshoots is not waste.
 *
 * ═══ WHY A PACK IS CHEAPER PER COPY ═══
 *
 * Because otherwise it is not a pack, it is a button pressed ten times. The
 * discount is what makes "buy the pack" a decision instead of a convenience —
 * and it is small enough that someone who needs two copies is not pushed into
 * buying ten.
 */

/** The packs on offer: one, a few, enough. */
export const CARD_PACKS = [1, 5, 10] as const;
export type CardPack = (typeof CARD_PACKS)[number];

/** Off the per-copy price, by pack. A pack you did not ask for is full price. */
const DISCOUNT: Record<number, number> = { 1: 0, 5: 0.1, 10: 0.2 };

/** Is this a pack the shop sells? Anything else is one copy. */
export function isCardPack(count: unknown): count is CardPack {
  return CARD_PACKS.includes(count as CardPack);
}

/**
 * What `count` copies cost, from the price of one.
 *
 * Rounded DOWN to a round number, like every other price in this shop: the
 * rounding is the shop's, so it goes the customer's way. Never below the
 * price of a single copy, which only matters if somebody sets the unit price
 * to a handful of diamonds.
 */
export function packPrice(unit: number, count: number): number {
  const n = isCardPack(count) ? count : 1;
  const full = unit * n;
  const pay = Math.floor((full * (1 - (DISCOUNT[n] ?? 0))) / 10) * 10;
  return Math.max(Math.min(unit, full), pay);
}
