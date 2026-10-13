/**
 * The two match achievements, read off a battle that was really fought.
 *
 * ═══ WHY THIS EXISTS BESIDE THE FIXTURES IN achievements.test.ts ═══
 *
 * Those build a `BattleResult` by hand, which is the right way to test the
 * RULE — every awkward case, including a King healed back to full, in four
 * lines each. What a hand-built result cannot catch is the rule reading a
 * field the engine does not fill: `flags.synergy` renamed, `hit` events
 * losing their `targetUid`, `damage` becoming `amount`. A fixture that
 * invented those names would go on passing forever while the game shipped an
 * achievement nobody could earn — and the player it would be denied to is
 * seven and will not file a bug.
 *
 * So this one fights. One battle, built to be decided quickly and in one
 * direction, and the assertion is that the two hardest achievements on Or's
 * list come out TRUE — that they are reachable at all.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "@amanda/engine";
import type { Card } from "@amanda/shared";
import { outcomeOf } from "./achievements";

const card = (id: string, seriesId: string, stats: Record<string, unknown>): Card =>
  ({
    id,
    seriesId,
    numberInSeries: 1,
    name: { he: id, en: id },
    elements: ["earth"],
    rarity: "common",
    stats: { attackSpeed: 1, moveSpeed: 1, range: "melee", ...stats },
    flying: false,
    targeting: "lane",
    midBoss: false,
    launch: true,
    abilities: [],
    art: { placeholderColor: "#888", sprite: null },
  }) as unknown as Card;

const CATALOG = new Map<string, Card>([
  // Mine: a family of three, and a King behind them.
  ["p1", card("p1", "plants", { hp: 900, power: 400 })],
  ["p2", card("p2", "plants", { hp: 900, power: 400 })],
  ["p3", card("p3", "plants", { hp: 900, power: 400 })],
  ["myKing", card("myKing", "giants", { hp: 900, power: 10 })],
  /*
   * Theirs: a King that cannot fight back and a single guard that cannot
   * walk. Deliberately one-sided — this is not a balance test, and a battle
   * that could go either way would be a test that fails on a Tuesday.
   */
  ["theirKing", card("theirKing", "slimes", { hp: 10, power: 0 })],
  ["pebble", card("pebble", "slimes", { hp: 10, power: 0, moveSpeed: 0 })],
]);

const SYNERGY = [
  { seriesId: "plants", threshold: 3, ability: { type: "statAura", trigger: "aura", params: { pct: 20 } } },
] as never;

describe("a won battle, fought for real", () => {
  const result = runBattle({
    seed: 7,
    catalog: CATALOG,
    synergies: SYNERGY,
    a: {
      owner: "A",
      placements: [
        { cardId: "myKing", x: 1, y: 1, king: true },
        // Touching, in one column, which is what lights the family.
        { cardId: "p1", x: 3, y: 0 },
        { cardId: "p2", x: 3, y: 1 },
        { cardId: "p3", x: 3, y: 2 },
      ],
    },
    b: {
      owner: "B",
      placements: [
        { cardId: "theirKing", x: 1, y: 1, king: true },
        { cardId: "pebble", x: 3, y: 3 },
      ],
    },
  });

  const outcome = outcomeOf(result, "A", false);

  it("is a win", () => {
    expect(result.winner).toBe("A");
    expect(outcome.won).toBe(true);
  });

  it("saw the trio light up — the flag is the engine's own", () => {
    expect(outcome.synergy).toBe(true);
  });

  it("saw the King come through untouched", () => {
    // Nothing on the other side has any power, so this is only true if the
    // damage events are being read the way the engine writes them.
    expect(outcome.kingUntouched).toBe(true);
  });
});

describe("a battle where the King was hit", () => {
  /*
   * The same board with one change: their guard can hurt. If this came back
   * untouched as well, the check above would be passing for the wrong
   * reason — a test that is always true is not a test.
   */
  const catalog = new Map(CATALOG);
  catalog.set("pebble", card("pebble", "slimes", { hp: 4000, power: 300, moveSpeed: 1 }));

  const result = runBattle({
    seed: 7,
    catalog,
    synergies: SYNERGY,
    a: {
      owner: "A",
      placements: [{ cardId: "myKing", x: 1, y: 1, king: true }],
    },
    b: {
      owner: "B",
      placements: [
        { cardId: "theirKing", x: 1, y: 1, king: true },
        { cardId: "pebble", x: 3, y: 1 },
      ],
    },
  });

  it("knows the King was touched", () => {
    expect(outcomeOf(result, "A", false).kingUntouched).toBe(false);
  });
});
