import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import type { Card } from "@amanda/shared";

/*
 * A side falls when its LAST King falls.
 *
 * Or's ruling, after he and Hod played Amanda mode together: "הצד נופל רק
 * כששני המלכים נפלו." The two of them share one side and bring a King each,
 * and until now the first crown to drop ended the battle for both — so one
 * player could be knocked out and take their partner down with them before
 * the partner had lost anything at all.
 *
 * Measured over 300 battles: losses that ended with a player's King falling
 * went from 142 to 1.
 *
 * The cards here are built by hand rather than taken from the catalogue, so a
 * balance change to a real card can never quietly turn these green.
 */
const BASE: Omit<Card, "id" | "name" | "stats" | "abilities"> = {
  seriesId: "test",
  number: 1,
  rarity: "common",
  elements: ["earth"],
  flying: false,
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

function card(id: string, hp: number, power: number): Card {
  return {
    ...BASE,
    id,
    name: { he: id, en: id },
    stats: { hp, power, attackSpeed: 1, moveSpeed: 1, range: "melee" },
    abilities: [],
  } as Card;
}

const CATALOG = new Map(
  [
    card("paperKing", 1, 0), //  falls on contact and does nothing back
    card("ironKing", 5_000_000, 10), // outlasts the whole clock, by a mile
    card("killer", 9000, 900), //  does the killing
  ].map((c) => [c.id, c]),
);

const LANES = 8;
const run = (a: BoardInput, b: BoardInput) =>
  runBattle({ seed: 7, catalog: CATALOG, synergies: [], a, b, lanes: LANES });

/** Amanda's side: enough muscle to put a paper King down quickly. */
const attackers: BoardInput = {
  owner: "B",
  placements: [
    { cardId: "ironKing", x: 1, y: 3, king: true },
    ...Array.from({ length: LANES }, (_, y) => ({ cardId: "killer", x: 3, y })),
  ],
} as BoardInput;

describe("two Kings on one side", () => {
  it("the first King falling does NOT end the battle", () => {
    const players: BoardInput = {
      owner: "A",
      placements: [
        { cardId: "paperKing", x: 1, y: 1, king: true }, // this player is finished early
        { cardId: "ironKing", x: 1, y: 5, king: true }, // this one is not
      ],
    } as BoardInput;
    const res = run(players, attackers);
    /*
     * The paper King is gone.
     *
     * This read `res.units?.find(...)?.hpLeft ?? 0` — and `BattleResult` has
     * no `units`. The optional chain swallowed it, the `?? 0` turned it into
     * `expect(0).toBe(0)`, and the line proved nothing at all while looking
     * like the point of the test. The field is `finalUnits`, and it is read
     * without an optional chain on purpose: if it ever stops existing, this
     * should fail rather than quietly pass again.
     */
    const paper = res.finalUnits.find((u) => u.cardId === "paperKing");
    expect(paper, "the paper King was never on the board").toBeDefined();
    expect(paper!.hp).toBe(0);
    // ...and the battle still ran to the clock rather than stopping on it.
    expect(res.winReason).not.toBe("kingDown");
    expect(res.ticks).toBeGreaterThan(60);
  });

  it("the battle ends when the second one falls too", () => {
    const players: BoardInput = {
      owner: "A",
      placements: [
        { cardId: "paperKing", x: 1, y: 1, king: true },
        { cardId: "paperKing", x: 1, y: 5, king: true },
      ],
    } as BoardInput;
    const res = run(players, attackers);
    expect(res.winReason).toBe("kingDown");
    expect(res.winner).toBe("B");
  });

  it("one King on a side still ends it the moment that one falls", () => {
    const players: BoardInput = {
      owner: "A",
      placements: [{ cardId: "paperKing", x: 1, y: 1, king: true }],
    } as BoardInput;
    const res = run(players, attackers);
    expect(res.winReason).toBe("kingDown");
    expect(res.winner).toBe("B");
  });
});
