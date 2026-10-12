import { describe, expect, it } from "vitest";
import { buildBattle } from "./setup.js";
import { runOnSpawn } from "./abilities.js";
import type { BoardInput } from "./setup.js";
import type { BattleOps } from "./abilities.js";
import type { Card } from "@amanda/shared";
import type { Unit } from "./types.js";

/*
 * What Goldenhorn is allowed to eat.
 *
 * Or, rewriting the card: *"takes with it the weakest card next to it that is
 * not a guard or the King, and turns it into armour."* The King was already
 * safe. The guards were not — so placing your tough card correctly, in the
 * square that keeps your King alive, made it the first thing your own card
 * swallowed. A card that loses you the match by being placed WELL is not a
 * trade-off, it is a trap.
 *
 * ═══ THE FIRST VERSION OF THIS FILE WAS USELESS ═══
 *
 * It ran a whole battle and looked for a death event. Two of its four cases
 * failed, and the two that passed were passing for nothing: "the guard did
 * not die" is satisfied just as well by a sacrifice that never fired at all.
 * A test whose green means "nothing happened" is worse than no test.
 *
 * So the sacrifice is run on its own, against a board that is built and
 * never fought. The only thing that can kill anything here is the ability
 * under test.
 */

const BASE = {
  seriesId: "giants",
  number: 1,
  rarity: "common",
  elements: ["earth"],
  flying: false,
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

const card = (id: string, hp: number, abilities: unknown[] = []): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    stats: { hp, power: 200, attackSpeed: 1, moveSpeed: 0, range: "melee" },
    abilities,
  }) as unknown as Card;

const CATALOG = new Map<string, Card>([
  [
    "eater",
    card("eater", 2000, [
      { type: "sacrificeAdjacent", trigger: "onSpawn", params: { armorGain: 300 } },
    ]),
  ],
  ["weak", card("weak", 100)],
  ["king", card("king", 3000)],
  ["enemy", card("enemy", 3000)],
]);

/** Build the board, fire the onSpawn effects, and report what was eaten. */
function sacrifice(mine: BoardInput["placements"]): string[] {
  const state = buildBattle({
    a: { owner: "A", placements: mine },
    b: { owner: "B", placements: [{ cardId: "enemy", x: 3, y: 0 }] },
    seed: 1,
    catalog: CATALOG,
  } as never);

  const eaten: string[] = [];
  const ops: BattleOps = {
    killUnit(u: Unit) {
      eaten.push(u.cardId);
      (u as { alive: boolean }).alive = false;
    },
    spawnChild: (() => {
      throw new Error("nothing here spawns");
    }) as BattleOps["spawnChild"],
  };
  runOnSpawn(state, ops);
  return eaten;
}

const KING = { cardId: "king", x: 1, y: 1, king: true };

describe("sacrificeAdjacent", () => {
  it("eats the weak card beside it", () => {
    // The back row: nothing here is guarding anything.
    expect(sacrifice([KING, { cardId: "eater", x: 0, y: 0 }, { cardId: "weak", x: 0, y: 1 }])).toEqual(
      ["weak"],
    );
  });

  it("does not eat a card standing in a guard post", () => {
    /*
     * (3,1) and (3,2) are the two squares level with the King's 2×2 in the
     * front column — the ones the board marks and the ones an attacker has
     * to get through. Goldenhorn next door must leave them alone.
     */
    expect(sacrifice([KING, { cardId: "eater", x: 3, y: 0 }, { cardId: "weak", x: 3, y: 1 }])).toEqual(
      [],
    );
  });

  it("still eats a front-row card that is NOT level with the King", () => {
    // The front row is not all guard posts — only the two squares the King
    // is actually standing behind.
    expect(sacrifice([KING, { cardId: "eater", x: 3, y: 3 }, { cardId: "weak", x: 2, y: 3 }])).toEqual(
      ["weak"],
    );
  });

  it("leaves the King alone, as it always did", () => {
    expect(sacrifice([KING, { cardId: "eater", x: 0, y: 1 }])).toEqual([]);
  });

  it("takes the weakest of the ones it may have", () => {
    // A guard standing next to it does not merely get skipped — the card
    // behind it is still eaten, so the ability is not silently disabled by
    // being placed near the crown.
    expect(
      sacrifice([
        KING,
        { cardId: "eater", x: 3, y: 2 },
        { cardId: "weak", x: 3, y: 1 }, // a guard: safe
        { cardId: "weak", x: 3, y: 3 }, // not a guard: eaten
      ]),
    ).toEqual(["weak"]);
  });
});
