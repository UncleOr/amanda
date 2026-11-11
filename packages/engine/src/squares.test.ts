/**
 * **The eight special squares, measured one at a time.**
 *
 * Or, 11 November 2026: *"and I feel like adding special positions from
 * arena 2 or 3 as well — 1-3 random ones on every board (ours and the
 * opponent's) with a unique colour and icon. Possible for any card except
 * the King."* Then eight of them, each in a sentence, and two follow-ups
 * that settled the only two that could not be built as written:
 *
 *   *"build the bunker"* — so stacking stopped being one card deep.
 *   *"and the pancake house — every card there becomes a crumb monster with
 *   the power and health of the original card, but without abilities."*
 *   Which is better than the fried bread he first asked for, because the
 *   joke lands on something the player already knows.
 *
 * ⚠ EVERY ONE OF THESE IS CHECKED AGAINST THE SAME BOARD WITHOUT THE SQUARE.
 * "The card has 1,200 health" means nothing on its own; "it has twice what
 * the identical card on the identical board has" is the rule.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import { buildBattle } from "./setup.js";
import type { BoardInput } from "./setup.js";
import type { Card, Squares } from "@amanda/shared";

const BASE = {
  seriesId: "giants",
  number: 1,
  rarity: "common",
  elements: ["earth"],
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

const card = (
  id: string,
  over: Partial<{
    hp: number;
    power: number;
    move: number;
    series: string;
    abilities: unknown[];
  }> = {},
): Card =>
  ({
    ...(BASE as object),
    id,
    seriesId: over.series ?? "giants",
    name: { he: id, en: id },
    flying: false,
    targeting: "lane",
    stats: {
      hp: over.hp ?? 1000,
      power: over.power ?? 100,
      attackSpeed: 2,
      moveSpeed: over.move ?? 0,
      range: "melee",
    },
    abilities: over.abilities ?? [],
  }) as unknown as Card;

const CATALOG = new Map<string, Card>([
  ["plain", card("plain")],
  ["crumb_demon", card("crumb_demon", { hp: 1, power: 1, series: "crumbs", move: 1.2 })],
  [
    "healer",
    card("healer", { abilities: [{ type: "regen", trigger: "aura", params: { perSecond: 10 } }] }),
  ],
  ["walker", card("walker", { move: 1.6, power: 300, hp: 2000 })],
  ["wall", card("wall", { hp: 9000, power: 1 })],
  ["crown", card("crown", { hp: 9000, power: 50 })],
  ["giant", card("giant", { hp: 4000, power: 700 })],
]);

/** One board, with or without squares, built but not fought. */
function set(placements: BoardInput["placements"], squares?: Squares) {
  return buildBattle({
    a: { owner: "A", placements, squares },
    b: { owner: "B", placements: [{ cardId: "crown", x: 1, y: 1, king: true }] },
    seed: 4,
    catalog: CATALOG,
    synergies: [],
  });
}
const find = (s: ReturnType<typeof set>, id: string) => s.units.find((u) => u.cardId === id)!;

describe("the charging station", () => {
  it("gives the card twice the power and twice the health", () => {
    const board = [{ cardId: "plain", x: 0, y: 0 }];
    const plain = find(set(board), "plain");
    const charged = find(set(board, { "0-0": "charger" }), "plain");
    expect(charged.power).toBe(plain.power * 2);
    expect(charged.maxHp).toBe(plain.maxHp * 2);
    // And it starts the battle full, not at half of its new maximum.
    expect(charged.hp).toBe(charged.maxHp);
  });
});

describe("the pancake house", () => {
  it("keeps the numbers and takes away the name and the tricks", () => {
    const board = [{ cardId: "healer", x: 0, y: 0 }];
    const before = find(set(board), "healer");
    const after = set(board, { "0-0": "pancake" }).units.find((u) => u.owner === "A")!;
    expect(after.cardId, "it is not a crumb monster").toBe("crumb_demon");
    expect(after.power, "the original power was lost").toBe(before.power);
    expect(after.maxHp, "the original health was lost").toBe(before.maxHp);
    expect(after.abilities, "it kept its abilities").toHaveLength(0);
  });
});

describe("the mirror maze", () => {
  it("takes a neighbour's identity and a neighbour's numbers", () => {
    /*
     * One neighbour, so the dice cannot make this flaky: the card at 0-0 has
     * exactly one card sharing an edge with it, and that is the giant.
     */
    const board = [
      { cardId: "plain", x: 0, y: 0 },
      { cardId: "giant", x: 0, y: 1 },
    ];
    const mirrored = set(board, { "0-0": "mirror" }).units.filter((u) => u.owner === "A");
    const copy = mirrored.find((u) => u.flags.mirrored)!;
    expect(copy, "nothing was mirrored").toBeDefined();
    expect(copy.cardId).toBe("giant");
    expect(copy.power).toBe(700);
    expect(copy.maxHp).toBe(4000);
  });

  it("does nothing at all when it has no neighbour to copy", () => {
    const alone = set([{ cardId: "plain", x: 0, y: 0 }], { "0-0": "mirror" });
    const u = find(alone, "plain");
    expect(u.cardId).toBe("plain");
    expect(u.flags.mirrored).toBeUndefined();
  });
});

describe("the black hole", () => {
  const board = [
    { cardId: "plain", x: 0, y: 0 },
    { cardId: "giant", x: 3, y: 3 },
  ];

  it("pays the rest of the board for being left empty", () => {
    const plain = find(set(board), "plain");
    const paid = find(set(board, { "0-3": "blackhole" }), "plain");
    expect(paid.power).toBe(Math.round(plain.power * 1.3));
    expect(paid.maxHp).toBe(Math.round(plain.maxHp * 1.3));
  });

  it("pays nothing once somebody stands in it", () => {
    const filled = set([...board, { cardId: "wall", x: 0, y: 3 }], { "0-3": "blackhole" });
    expect(find(filled, "plain").power).toBe(find(set(board), "plain").power);
  });
});

describe("the hospital", () => {
  it("heals whoever stands there, and goes on healing as they advance", () => {
    /*
     * The patient walks at the enemy and gets hit; the control is the same
     * card on the same square with no hospital under it. Measured on what is
     * left of them when the dust settles.
     */
    const mine: BoardInput["placements"] = [
      { cardId: "walker", x: 3, y: 0 },
      { cardId: "crown", x: 1, y: 1, king: true },
    ];
    const foe: BoardInput["placements"] = [
      { cardId: "walker", x: 3, y: 0 },
      { cardId: "crown", x: 1, y: 1, king: true },
    ];
    const run = (squares?: Squares) =>
      runBattle({
        a: { owner: "A", placements: mine, squares },
        b: { owner: "B", placements: foe },
        seed: 9,
        catalog: CATALOG,
        synergies: [],
      });
    const plain = run().finalUnits.find((u) => u.owner === "A" && u.cardId === "walker")!;
    const healed = run({ "3-0": "hospital" }).finalUnits.find(
      (u) => u.owner === "A" && u.cardId === "walker",
    )!;
    expect(healed.hp, "the hospital did nothing").toBeGreaterThan(plain.hp);
  });
});

describe("the minefield", () => {
  const mine: Squares = { "3-0": "minefield" };
  const run = (squares: Squares | undefined, onTop: BoardInput["placements"]) =>
    runBattle({
      a: {
        owner: "A",
        placements: [{ cardId: "crown", x: 1, y: 1, king: true }, ...onTop],
        squares,
      },
      b: {
        owner: "B",
        placements: [
          { cardId: "crown", x: 1, y: 1, king: true },
          { cardId: "walker", x: 3, y: 0 },
        ],
      },
      seed: 11,
      catalog: CATALOG,
      synergies: [],
    });

  const bangs = (r: ReturnType<typeof run>) => r.events.filter((e) => e.type === "explode").length;

  it("goes off under the first enemy to reach an empty one", () => {
    /*
     * ⚠ MEASURED ON THE EVENT, NOT ON WHO DIED. Whether the walker survives
     * a battle depends on the whole battle; whether a mine fired depends on
     * the mine. The first draft of this asserted "it dies with the mine and
     * lives without it" and failed in BOTH directions — the control walker
     * was dying anyway, and the mine was not going off at all.
     *
     * The second half of that was a real bug and this is how it was found:
     * "standing on it" was being asked of the unit's CENTRE, and an
     * attacker does not stand on your front row, it stands at arm's length
     * in front of it. See the overlap test in simulate.ts.
     */
    expect(bangs(run(undefined, [])), "something exploded with no mine on the board").toBe(0);
    expect(bangs(run(mine, [])), "the mine did not go off").toBe(1);
  });

  it("does nothing while one of its own is standing on it", () => {
    /*
     * Or's own wording: *"if the enemy steps there WHILE IT IS FREE (say
     * when our card died or walked/flew away)"*. A card of yours parked on
     * your own minefield keeps it covered.
     */
    expect(bangs(run(mine, [{ cardId: "wall", x: 3, y: 0 }]))).toBe(0);
  });

  it("goes off once, for the first one only", () => {
    const r = runBattle({
      a: { owner: "A", placements: [{ cardId: "crown", x: 1, y: 1, king: true }], squares: mine },
      b: {
        owner: "B",
        placements: [
          { cardId: "crown", x: 1, y: 1, king: true },
          { cardId: "walker", x: 3, y: 0 },
          { cardId: "walker", x: 2, y: 0 },
        ],
      },
      seed: 11,
      catalog: CATALOG,
      synergies: [],
    });
    expect(r.events.filter((e) => e.type === "explode")).toHaveLength(1);
  });
});

describe("the asylum", () => {
  it("turns the card on its own side", () => {
    const r = runBattle({
      a: {
        owner: "A",
        placements: [
          { cardId: "crown", x: 1, y: 1, king: true },
          { cardId: "walker", x: 0, y: 0 },
          { cardId: "wall", x: 1, y: 0 },
        ],
        squares: { "0-0": "asylum" },
      },
      b: { owner: "B", placements: [{ cardId: "crown", x: 1, y: 1, king: true }] },
      seed: 3,
      catalog: CATALOG,
      synergies: [],
    });
    const byUid = new Map(r.finalUnits.map((u) => [u.uid, u]));
    const mad = r.finalUnits.find((u) => u.owner === "A" && u.cardId === "walker")!;
    const hit = new Set(
      r.events
        .filter((e) => e.type === "attack" && e.uid === mad.uid)
        .map((e) => byUid.get(e.targetUid!)?.owner),
    );
    expect(hit.has("A"), "the madman never turned on his own side").toBe(true);
    expect(hit.has("B"), "he was still fighting the enemy").toBe(false);
  });
});

describe("the bunker", () => {
  it("stacks three, and reveals them one at a time", () => {
    /*
     * Or: *"the bunker — you can put up to 3 cards there one on top of the
     * other."* Stacking has existed since the Ground Floor ability and it
     * was exactly one card deep: `reveal` spawned what was underneath with
     * nothing under IT, so a third could not be expressed at all.
     */
    const r = runBattle({
      a: {
        owner: "A",
        placements: [
          { cardId: "crown", x: 1, y: 1, king: true },
          { cardId: "plain", x: 3, y: 0, below: ["plain", "plain"] },
        ],
        squares: { "3-0": "bunker" },
      },
      b: {
        owner: "B",
        placements: [
          { cardId: "crown", x: 1, y: 1, king: true },
          { cardId: "giant", x: 3, y: 0 },
        ],
      },
      seed: 6,
      catalog: CATALOG,
      synergies: [],
    });
    expect(r.events.filter((e) => e.type === "reveal")).toHaveLength(2);
  });

  it("still does one card for the ability that always did one", () => {
    const r = runBattle({
      a: {
        owner: "A",
        placements: [
          { cardId: "crown", x: 1, y: 1, king: true },
          { cardId: "plain", x: 3, y: 0, below: "plain" },
        ],
      },
      b: {
        owner: "B",
        placements: [
          { cardId: "crown", x: 1, y: 1, king: true },
          { cardId: "giant", x: 3, y: 0 },
        ],
      },
      seed: 6,
      catalog: CATALOG,
      synergies: [],
    });
    expect(r.events.filter((e) => e.type === "reveal")).toHaveLength(1);
  });
});

describe("and none of them touches the crown", () => {
  it("leaves a King alone even if a square is rolled under it", () => {
    /*
     * ⚠ Or: *"possible for any card except the King."* The roll never puts
     * one there (placeableCells skips the 2×2), but a hand-written board, an
     * old save or a bug could — and a charged or mirrored King would decide
     * a match before a card had been placed.
     */
    const board: BoardInput["placements"] = [{ cardId: "crown", x: 1, y: 1, king: true }];
    const plain = set(board).units.find((u) => u.isKing)!;
    const tried = set(board, { "1-1": "charger" }).units.find((u) => u.isKing)!;
    expect(tried.power).toBe(plain.power);
    expect(tried.maxHp).toBe(plain.maxHp);
  });
});
