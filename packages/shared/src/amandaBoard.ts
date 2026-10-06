/**
 * Amanda's side of the arena.
 *
 * Lives in shared, and takes the catalog as an argument, because this exact
 * function has already drifted once: it was proven headlessly with her guard
 * built from the toughest cards and then shipped on the server built from the
 * strongest, which turned the first real match into a two-second massacre.
 * One definition, called by both.
 */
import { BOARD, KING } from "./config.js";
import type { Card } from "./schemas/card.js";

/** Her card. Never in a pack, never in an album — data/series/18-legends.json. */
export const AMANDA_CARD = "legends_01_amanda";

/** Two 4×4 boards stacked: four lanes each, eight in all. */
export const COOP_LANES = BOARD.height * 2;

/**
 * How much of her side is actually defended.
 *
 * Measured at 50 battles a step, once her health meant what her card says:
 *
 *   0.90 → players win 34%, killed 8/50 · 0.80 → 54%, 10/50 · 0.65 → 76%, 11/50
 *
 * 0.90 is hard, she really can be killed, and one player alone wins 0% at
 * EVERY setting — which is the whole reason the mode takes two.
 */
export const GUARD_DENSITY = 0.9;

/** Minimal placement shape, structurally compatible with the engine's. */
export interface AmandaPlacement {
  cardId: string;
  x: number;
  y: number;
  king?: boolean;
  buff?: { hpMult?: number };
}

export function buildAmandaBoard(
  cards: Iterable<Card>,
  density = GUARD_DENSITY,
): AmandaPlacement[] {
  const all = [...cards].filter((c) => c.launch);
  const tough = all
    .filter((c) => c.stats.moveSpeed === 0)
    .sort((a, b) => b.stats.hp - a.stats.hp)
    .map((c) => c.id);
  const fallback = [...all].sort((a, b) => b.stats.hp - a.stats.hp).map((c) => c.id);
  const pool = tough.length >= 4 ? tough : fallback;
  if (!pool.length) return [];

  const placements: AmandaPlacement[] = [
    {
      cardId: AMANDA_CARD,
      x: BOARD.kingSlot.x,
      y: 3, // her 2×2 sits across the middle two lanes of the eight
      king: true,
      /*
       * Her card says 5,555 and she should fight at 5,555. Every King gets the
       * ×3 health bonus, which quietly made her a 16,665-health wall: she died
       * once in fifty battles even after the number came down. Dividing the
       * bonus back out is the only way the figure on the card means anything.
       */
      buff: { hpMult: 1 / KING.hpMultiplier },
    },
  ];

  let n = 0;
  for (let x = 0; x < BOARD.width; x++) {
    for (let y = 0; y < COOP_LANES; y++) {
      const hers =
        x >= BOARD.kingSlot.x && x < BOARD.kingSlot.x + BOARD.kingSlot.width && (y === 3 || y === 4);
      if (hers) continue;
      // A deterministic scatter, not a random one: the same board every time,
      // so a result can be reproduced from its seed alone.
      const gap = ((x * 7 + y * 3) % 10) / 10 >= density;
      if (!gap) placements.push({ cardId: pool[n % Math.min(6, pool.length)]!, x, y });
      n++;
    }
  }
  return placements;
}
