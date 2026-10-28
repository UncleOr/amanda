/**
 * What a card costs to put in a deck.
 *
 * Or: *"maybe a cost per card? so you can't just put only strong cards in."*
 * And: *"add the price column to the cards database (computed
 * automatically)."*
 *
 * ═══ WHY IT IS NOT THE RARITY ═══
 *
 * Rarity is the obvious dial and it is the wrong one. Measured across the 51
 * collectable cards:
 *
 *   common   25 cards   health 200..1800   power 0..1300
 *   rare     21 cards   health 250..2200   power 50..1100
 *   epic      5 cards   health 1200..2500  power 350..950
 *
 * The ranges overlap almost completely, and Flame Dragon — one of the
 * hardest-hitting cards in the game at 1300 power — is a COMMON. Pricing by
 * rarity would have sold it for the price of a thorn sprout, which is the
 * one outcome the budget exists to prevent.
 *
 * ═══ WHAT IT IS INSTEAD ═══
 *
 * What the card brings to a board: how long it lasts times how hard it hits.
 *
 *   score = √(health × damage-per-second)
 *
 * The square root is what makes it a price rather than a power level — it
 * keeps a 2500-health wall and a 900-damage glass cannon within one band of
 * each other, which is true of how they play. A card that never attacks (the
 * sticky rug, attackSpeed 0) is priced on its health alone, through the
 * `max(dps, 1)` floor.
 *
 * ═══ AND THE BANDS ARE FIXED, NOT RECOMPUTED ═══
 *
 * They were CHOSEN as quintiles of today's 51 cards, so the five prices hold
 * roughly ten cards each and no price collects everybody. They are written
 * down as numbers rather than worked out at runtime, and that is the whole
 * point: a quintile moves when a card is added, which would silently
 * re-price cards nobody touched. A child whose deck became illegal because
 * somebody else's card was drawn is owed a better explanation than that.
 *
 * When Or adds enough cards that the spread no longer fits these, the fix is
 * to edit these four numbers deliberately — and `cardCost.test.ts` prints
 * the distribution so the day that happens is visible.
 *
 * ═══ AND TWENTY CARDS ARRIVED, AND THE BANDS DID NOT MOVE ═══
 *
 * The Machines and the Sea Dwellers took the catalogue from 51 collectable
 * cards to 71 — the biggest addition it has had. Re-measured afterwards,
 * against these same four numbers:
 *
 *   cost 1  14 cards      cost 4  17 cards
 *   cost 2  14 cards      cost 5  13 cards
 *   cost 3  13 cards      average price 3.01
 *
 * Which is exactly what the paragraph above promised, and the reason it is
 * written down: nobody's card was re-priced by somebody else's card being
 * drawn. The twenty new cards were tuned to FIT these bands rather than the
 * bands moved to fit them — see `pnpm --filter @amanda/engine duels`, which
 * checks the thing a price band actually promises: that the average win rate
 * climbs with the price (19 · 35 · 46 · 61 · 85 per cent).
 */
import type { Card } from "./schemas/card.js";

/** The four boundaries between the five prices. */
const BANDS = [212, 296, 346, 462] as const;

/** The cheapest and dearest a card can be. */
export const COST_MIN = 1;
export const COST_MAX = 5;

/** How much board a card is worth, before it is cut into bands. */
export function cardScore(stats: Card["stats"]): number {
  const dps = stats.attackSpeed > 0 ? stats.power / stats.attackSpeed : 0;
  return Math.sqrt(stats.hp * Math.max(dps, 1));
}

/**
 * The price of one card, 1 to 5.
 *
 * `card.cost` wins when it is set. That field is the override Or asked for —
 * *"Chuppy should cost 4, not 5"* — and it exists because a price is a design
 * decision that a formula can be wrong about. The formula is what fills in
 * the other fifty.
 */
export function cardCost(card: Pick<Card, "stats"> & { cost?: number }): number {
  if (typeof card.cost === "number") {
    return Math.min(COST_MAX, Math.max(COST_MIN, Math.round(card.cost)));
  }
  const score = cardScore(card.stats);
  let cost: number = COST_MIN;
  for (const band of BANDS) if (score > band) cost++;
  return cost;
}
