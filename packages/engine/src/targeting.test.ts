/**
 * **Who a card goes after, when it has an opinion about it.**
 *
 * Or: *"open me up more options in the cards' preferred target: cards that
 * shoot straight, cards that shoot whoever attacks them, cards that shoot
 * the strongest card at any given moment, cards that shoot snipers, cards
 * that shoot static cards, cards that shoot cards that crossed the line and
 * are attacking."*
 *
 * ═══ MEASURED BY WHO BLED ═══
 *
 * Every one of these is tested the same way and deliberately so: run a real
 * battle and count who the hunter actually HIT. Reading `pickTarget` would
 * only prove that the function returns what the function returns; what
 * matters is whether a card placed on a board goes for the thing Or asked
 * for, through the movement, the reach and the lane rules that sit between
 * a decision and a blow.
 *
 * ═══ THE GEOMETRY, BECAUSE IT IS NOT OBVIOUS ═══
 *
 * A placement's `x` is LOCAL: 0 is the back row of your own board and 3 is
 * the front row facing the enemy. Side A keeps those numbers (x → col) and
 * side B is mirrored into 7..4, so the two front rows touch at columns 3
 * and 4. Which means an enemy at `x: 3` is the NEAREST one and `x: 0` is the
 * furthest — the opposite of how it reads.
 *
 * The hunter is static and `ranged` (reach 3) at the front of its own board,
 * so it covers columns 4, 5 and 6 and nothing has to walk anywhere for the
 * question to be answered. A sniper would have been the obvious choice and
 * is a trap: snipers pick the FARTHEST target in the lane branch, which is a
 * second rule on top of the one being measured.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import type { Card, Targeting } from "@amanda/shared";

const BASE = {
  seriesId: "dragons",
  number: 1,
  rarity: "common",
  elements: ["fire"],
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
    range: "melee" | "ranged" | "sniper";
    targeting: Targeting;
  }> = {},
): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    flying: false,
    targeting: over.targeting ?? "lane",
    stats: {
      hp: over.hp ?? 100000,
      power: over.power ?? 0,
      attackSpeed: 0.4,
      moveSpeed: over.move ?? 0,
      range: over.range ?? "melee",
    },
    abilities: [],
  }) as unknown as Card;

const MODES = ["lane", "avenger", "champion", "sniperHunter", "wallbreaker", "invader"] as const;

/**
 * The hunters, and everything one of them might choose between.
 *
 * All the prey have enormous health: a target that dies changes the answer
 * halfway through, and the question here is only ever "who did it pick".
 */
const CATALOG = new Map<string, Card>([
  ...MODES.map(
    (t) => [`hunter_${t}`, card(`hunter_${t}`, { power: 60, range: "ranged", targeting: t })] as const,
  ),

  // ── the things it might go for ──
  /** Ordinary and harmless, and it MOVES — so it is never the wall. */
  ["walker", card("walker", { move: 1.1 })],
  /** The one that never moves. */
  ["wall", card("wall")],
  /** The one that shoots from out of everybody's reach. */
  ["sniper", card("sniper", { range: "sniper" })],
  /** By a long way the biggest thing on the board. */
  ["brute", card("brute", { power: 900 })],
  /** It shoots back — so it is the one that will have hit you. */
  ["shooter", card("shooter", { power: 40, range: "sniper" })],
  /** It walks over the middle and fights. */
  ["crosser", card("crosser", { power: 40, move: 1.6 })],
  /** Something of the hunter's own for the crosser to walk into. */
  ["bait", card("bait")],
  /** A crown, for the two modes that must not count one. */
  ["crown", card("crown", { power: 100 })],
]);

/** Run one battle and count the hunter's blows, by who took them. */
function hits(
  mode: Targeting,
  enemies: BoardInput["placements"],
  mine: BoardInput["placements"] = [],
) {
  const hunter = `hunter_${mode}`;
  const r = runBattle({
    // x: 3 is the front row — reach 3 from there covers columns 4, 5 and 6.
    a: { owner: "A", placements: [{ cardId: hunter, x: 3, y: 0 }, ...mine] },
    b: { owner: "B", placements: enemies },
    seed: 1,
    catalog: CATALOG,
    synergies: [],
  });
  const me = r.finalUnits.find((u) => u.cardId === hunter)!;
  const byId = new Map<string, string>(r.finalUnits.map((u) => [u.uid, u.cardId] as const));
  const tally = new Map<string, number>();
  for (const e of r.events)
    if (e.type === "hit" && e.uid === me.uid) {
      const id = (e.targetUid && byId.get(e.targetUid)) || "?";
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
  return tally;
}

/** Who took the most blows. The answer to "who did it go after". */
const chosen = (tally: Map<string, number>): string =>
  [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "nobody";

/** NEAR is the enemy front row, FAR is two columns behind it. */
const NEAR = 3;
const FAR = 1;

describe("ישר קדימה — the card that goes straight ahead", () => {
  it("hits what is in front of it and not the interesting thing behind", () => {
    // The control. Everything below is a departure from this one answer.
    const tally = hits("lane", [
      { cardId: "walker", x: NEAR, y: 0 },
      { cardId: "brute", x: FAR, y: 0 },
    ]);
    expect(chosen(tally)).toBe("walker");
  });
});

describe("שובר חומות — the one that goes for whatever does not move", () => {
  const board: BoardInput["placements"] = [
    { cardId: "walker", x: NEAR, y: 0 },
    { cardId: "wall", x: FAR, y: 1 },
  ];

  it("passes a nearer target, in its own lane, to hit the wall", () => {
    expect(chosen(hits("wallbreaker", board))).toBe("wall");
  });

  it("and that really was the harder choice", () => {
    expect(chosen(hits("lane", board))).toBe("walker");
  });

  it("does not count the King, which never moves by rule", () => {
    /*
     * ⚠ The King is static by the King's Trap, so a wall-breaker that
     * counted it would hunt the crown in every game ever played and be a
     * King-hunter with a different name.
     */
    const tally = hits("wallbreaker", [
      { cardId: "crown", x: NEAR, y: 1, king: true },
      { cardId: "wall", x: FAR, y: 1 },
    ]);
    expect(chosen(tally)).toBe("wall");
  });
});

describe("צייד צלפים — the one that goes for the snipers", () => {
  it("picks the sniper out of a crowd", () => {
    const tally = hits("sniperHunter", [
      { cardId: "walker", x: NEAR, y: 0 },
      { cardId: "sniper", x: FAR, y: 1 },
    ]);
    expect(chosen(tally)).toBe("sniper");
  });

  it("is an ordinary card on a board with no snipers", () => {
    /*
     * ⚠ THE FAILURE THAT HAS ALREADY HAPPENED ONCE HERE. Or, about the
     * version of this bug that shipped: *"all the attackers in a straight
     * line reaching the end and attacking nothing."* A hunter that finds
     * none of its prey must fight, not stand there.
     */
    const board: BoardInput["placements"] = [
      { cardId: "walker", x: NEAR, y: 0 },
      { cardId: "wall", x: FAR, y: 1 },
    ];
    const hunting = hits("sniperHunter", board);
    expect(chosen(hunting), "it is still fighting").toBe(chosen(hits("lane", board)));
    expect([...hunting.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(5);
  });
});

describe("צייד אלופים — the one that goes for the strongest", () => {
  it("leaves the nearest alone and goes for the big one", () => {
    const tally = hits("champion", [
      { cardId: "walker", x: NEAR, y: 0 },
      { cardId: "brute", x: FAR, y: 1 },
    ]);
    expect(chosen(tally)).toBe("brute");
  });

  it("will not simply hunt the crown instead", () => {
    // The King is three times the power of whatever is in its slot, so
    // counting it would make this a King-hunter with no guard rules.
    const tally = hits("champion", [
      { cardId: "crown", x: NEAR, y: 1, king: true },
      { cardId: "brute", x: FAR, y: 0 },
    ]);
    expect(chosen(tally)).toBe("brute");
  });
});

describe("נוקם — the one that shoots back", () => {
  /*
   * The walker is nearer and in the hunter's own lane — the lane card's
   * answer. The shooter is in another lane and is the only thing on the
   * board that will hit the hunter, so it is the avenger's answer, and only
   * AFTER the first blow lands. That is the mode: it is a reply.
   */
  const board: BoardInput["placements"] = [
    { cardId: "walker", x: NEAR, y: 0 },
    { cardId: "shooter", x: FAR, y: 2 },
  ];

  it("turns on whatever hit it", () => {
    expect(chosen(hits("avenger", board))).toBe("shooter");
  });

  it("and that is not what an ordinary card would have done", () => {
    expect(chosen(hits("lane", board))).toBe("walker");
  });
});

describe("שומר הגבול — the one that goes for whoever crossed", () => {
  it("goes for the one that came over and started fighting", () => {
    /*
     * The crosser walks out of its own half and attacks the bait; the
     * walker stays in front of the hunter being ordinary. A lane card hits
     * the walker all battle. The guard switches the moment the other one
     * steps over the middle and swings.
     */
    const board: BoardInput["placements"] = [
      { cardId: "walker", x: NEAR, y: 0 },
      { cardId: "crosser", x: NEAR, y: 1 },
    ];
    const mine: BoardInput["placements"] = [{ cardId: "bait", x: NEAR, y: 1 }];
    expect(chosen(hits("invader", board, mine))).toBe("crosser");
    expect(chosen(hits("lane", board, mine)), "and not the ordinary answer").toBe("walker");
  });

  it("ignores one that has crossed nothing", () => {
    // `hasAttacked` AND the middle line, both halves of what Or asked for.
    // Without them this is "whoever is closest", which the game already had.
    const tally = hits("invader", [{ cardId: "walker", x: NEAR, y: 0 }]);
    expect(chosen(tally)).toBe("walker");
  });
});
