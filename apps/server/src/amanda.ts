/**
 * Amanda mode: the two of you against her.
 *
 * Both players build on the SAME side — each in their own half of an
 * eight-lane board — and she holds the other side as its Queen. Proven
 * headlessly first (`pnpm --filter @amanda/engine amanda`): two boards win
 * roughly a third to a half of the time, and one board alone wins none at all,
 * which is the whole reason the mode needs two people.
 */
import {
  AMANDA_CARD,
  COOP_LANES,
  GUARD_DENSITY,
  buildAmandaBoard,
  type NetBoard,
  type NetPlacement,
  type Side,
} from "@amanda/shared";
export { AMANDA_CARD, COOP_LANES };
import { CATALOG } from "./content.js";
import { BOARD } from "@amanda/shared";

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
export function amandaBoard(density = GUARD_DENSITY): NetBoard {
  // The shape of her side lives in shared so the client can build the same one
  // for the developer preview — see buildAmandaBoard.
  return { owner: "B", placements: buildAmandaBoard(CATALOG.values(), density) as NetPlacement[] };
}
