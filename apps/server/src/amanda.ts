/**
 * Amanda mode: the two of you against her.
 *
 * Both players build on the SAME side — each in their own half of an
 * eight-lane board — and she holds the other side as its Queen. Proven
 * headlessly first (`pnpm --filter @amanda/engine amanda`): two boards win
 * roughly a third to a half of the time, and one board alone wins none at all,
 * which is the whole reason the mode needs two people.
 */
import { BOARD, type NetBoard, type NetPlacement, type Side } from "@amanda/shared";
import { CATALOG } from "./content.js";

/** Her card. Never in a pack, never in an album — see data/series/18-legends.json. */
export const AMANDA_CARD = "legends_01_amanda";

/** Two 4x4 boards stacked: four lanes each. */
export const COOP_LANES = BOARD.height * 2;

/**
 * Shift one player's board into its half of the shared side.
 *
 * Their client builds an ordinary 4x4 and knows nothing about this; the server
 * decides who sits in which half, so the two can never land on top of each
 * other. That mattered: the first headless run had every King stacked into the
 * same two lanes because a King ignored the lane it was placed in.
 */
export function intoHalf(board: NetBoard, laneOffset: number): NetPlacement[] {
  return board.placements.map((p) => ({ ...p, y: p.y + laneOffset }));
}

/** Both players' boards, joined into the single side they share. */
export function joinBoards(a: NetBoard | null, b: NetBoard | null): NetBoard {
  return {
    owner: "A" as Side,
    placements: [
      ...(a ? intoHalf(a, 0) : []),
      ...(b ? intoHalf(b, BOARD.height) : []),
    ],
  };
}

/**
 * Her side of the arena: Amanda in the middle, and a wall in front of her.
 *
 * Built from the toughest things in the catalog rather than at random, because
 * a boss whose guard is a handful of weak cards is a boss you walk past.
 */
/**
 * How much of her side is actually defended.
 *
 * Measured, not guessed. Filling all 31 cells with the toughest static cards
 * made her unreachable: every battle ran the full clock and her own health
 * turned out not to matter at all — 42,000 and 16,000 both gave the players
 * about a one-in-eight chance, because nobody ever got through the wall to
 * find out. Gaps are what make her beatable.
 */
export const GUARD_DENSITY = 0.75;

export function amandaBoard(density = GUARD_DENSITY): NetBoard {
  /*
   * Her guard is TOUGH, not hard-hitting.
   *
   * The headless probe that proved this mode (`pnpm --filter @amanda/engine
   * amanda`) filled her side with the highest-health static cards and measured
   * full-length battles that two boards win a third to a half of the time. The
   * first version of this function shipped something else — the highest-POWER
   * cards — and the result was a two-second massacre. A boss should be a wall
   * you wear down, not a firing squad.
   */
  const toughest = [...CATALOG.values()]
    .filter((c) => c.launch && c.stats.moveSpeed === 0)
    .sort((x, y) => y.stats.hp - x.stats.hp)
    .map((c) => c.id);
  const fallback = [...CATALOG.values()]
    .filter((c) => c.launch)
    .sort((x, y) => y.stats.hp - x.stats.hp)
    .map((c) => c.id);
  const pool = toughest.length >= 4 ? toughest : fallback;

  const placements: NetPlacement[] = [
    // Her 2x2 sits across the middle two lanes of the eight.
    { cardId: AMANDA_CARD, x: BOARD.kingSlot.x, y: 3, king: true },
  ];
  let n = 0;
  for (let x = 0; x < BOARD.width; x++) {
    for (let y = 0; y < COOP_LANES; y++) {
      if (x >= BOARD.kingSlot.x && x < BOARD.kingSlot.x + BOARD.kingSlot.width && (y === 3 || y === 4))
        continue;
      // A deterministic scatter rather than a random one: the same board every
      // time means a result can be reproduced from the seed alone.
      const gap = ((x * 7 + y * 3) % 10) / 10 >= density;
      if (!gap) placements.push({ cardId: pool[n % Math.min(6, pool.length)]!, x, y });
      n++;
    }
  }
  return { owner: "B", placements };
}
