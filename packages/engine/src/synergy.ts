import { BOARD } from "@amanda/shared";
import type { Placement } from "./setup.js";

/**
 * Series synergy: three of the same family, TOUCHING.
 *
 * Or's ruling (2026-10-06): "רק צמודים". Until now three cards of a series
 * anywhere on your board lit the bonus, which made it a counting exercise —
 * you either happened to hold three dragons or you did not, and where they
 * went never mattered. Touching turns it into the thing you are actually
 * doing on that screen: deciding what goes next to what.
 *
 * Three rules, and each of them is a decision rather than an implementation
 * detail:
 *
 *   TOUCHING MEANS SHARING AN EDGE. Not a corner. "Diagonal counts" is the
 *   kind of rule a seven-year-old has to be told; "they have to touch" is the
 *   kind they can see.
 *
 *   THE KING COUNTS. It is a card on your board, and it is the card the board
 *   is built around — excluding it would make the middle of the board a dead
 *   zone for the one mechanic that rewards arranging things. It occupies the
 *   central 2×2, so it touches eight of the twelve outer cells: building a
 *   family around your King is the natural play, which is as it should be.
 *
 *   IT IS DECIDED WHEN YOU BUILD, AND IT LASTS. Worked out once from the
 *   board you locked, never recomputed mid-battle. Units advance at different
 *   speeds, so a live check would switch the bonus on and off as the group
 *   drifted apart — a reward you earned by arranging your board must not
 *   flicker, and it must not be taken away by the enemy killing one member.
 */

/** Every board cell a placement sits on. The King spreads over its 2×2. */
function cellsOf(p: Placement): Array<[number, number]> {
  if (!p.king) return [[p.x, p.y]];
  const { x, y, width, height } = BOARD.kingSlot;
  const out: Array<[number, number]> = [];
  for (let dx = 0; dx < width; dx++) for (let dy = 0; dy < height; dy++) out.push([x + dx, y + dy]);
  return out;
}

/** Do these two placements share an edge anywhere? */
export function touching(a: Placement, b: Placement): boolean {
  for (const [ax, ay] of cellsOf(a))
    for (const [bx, by] of cellsOf(b))
      if (Math.abs(ax - bx) + Math.abs(ay - by) === 1) return true;
  return false;
}

/**
 * The indices of placements that belong to a touching group of `threshold`+
 * cards of the same series.
 *
 * A plain flood fill over same-series neighbours. Groups bigger than the
 * threshold all count — four touching dragons are not punished for being four.
 */
export function synergyMembers(
  placements: Placement[],
  seriesOf: (cardId: string) => string | undefined,
  seriesId: string,
  threshold: number,
): Set<number> {
  const mine = placements
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => seriesOf(p.cardId) === seriesId);

  const seen = new Set<number>();
  const qualifying = new Set<number>();

  for (const start of mine) {
    if (seen.has(start.i)) continue;
    const group: number[] = [];
    const queue = [start];
    seen.add(start.i);
    while (queue.length) {
      const cur = queue.pop()!;
      group.push(cur.i);
      for (const other of mine) {
        if (seen.has(other.i)) continue;
        if (!touching(cur.p, other.p)) continue;
        seen.add(other.i);
        queue.push(other);
      }
    }
    if (group.length >= threshold) for (const i of group) qualifying.add(i);
  }
  return qualifying;
}
