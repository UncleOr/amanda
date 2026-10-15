import { describe, expect, it } from "vitest";
import { cardCost, cardScore, COST_MAX, COST_MIN } from "@amanda/shared";
import { collectable } from "../data/catalog";
import { CATALOG } from "../data/catalog";

/*
 * The price of a card, against the real cards.
 *
 * These are deliberately about the SHAPE of the spread rather than about
 * which card costs what: the whole point of the bands is that no price
 * collects everybody, and that is a property of all 51 together. A test that
 * pinned individual cards would fail every time Or rebalanced one, which is
 * the thing the formula exists to allow.
 */

const stats = (hp: number, power: number, attackSpeed: number) =>
  ({ hp, power, attackSpeed, moveSpeed: 1, range: "melee" }) as const;

describe("what a card is worth", () => {
  it("prices a card that cannot attack on its health alone", () => {
    // The sticky rug: 350 health, no attack at all. Without the floor under
    // the damage this would be √0 and every wall in the game would cost 1
    // for the same wrong reason.
    expect(cardScore(stats(350, 0, 0))).toBeCloseTo(Math.sqrt(350), 5);
  });

  it("puts a wall and a glass cannon within one band of each other", () => {
    // The square root is what does this, and it is why the score is a PRICE
    // rather than a power level.
    const wall = cardCost({ stats: stats(2500, 700, 4) });
    const cannon = cardCost({ stats: stats(433, 1300, 1.5) });
    expect(Math.abs(wall - cannon)).toBeLessThanOrEqual(1);
  });

  it("never leaves the scale", () => {
    for (const card of collectable()) {
      const c = cardCost(card);
      expect(c).toBeGreaterThanOrEqual(COST_MIN);
      expect(c).toBeLessThanOrEqual(COST_MAX);
      expect(Number.isInteger(c)).toBe(true);
    }
  });
});

describe("the spread across the real cards", () => {
  const counts = new Map<number, number>();
  for (const card of collectable()) counts.set(cardCost(card), (counts.get(cardCost(card)) ?? 0) + 1);

  it("uses all five prices", () => {
    for (let c = COST_MIN; c <= COST_MAX; c++) expect(counts.get(c) ?? 0).toBeGreaterThan(0);
  });

  /*
   * The day this fails is the day the bands need editing, and that is what it
   * is for. Half the collection at one price means the budget has stopped
   * being a choice.
   */
  it("gives no single price more than a third of the collection", () => {
    const total = collectable().length;
    for (const [, n] of counts) expect(n / total).toBeLessThan(0.34);
  });
});

describe("the override", () => {
  /*
   * Or: *"Chuppy should cost 4, not 5."* The formula scores him at 748 —
   * 610 health behind 1100 power is a very hard hit — which lands in the top
   * band. He is also the card every player is given on their first day, and
   * a starter card at the top price is a starter album that cannot afford
   * itself.
   */
  it("prices Chuppy at 4, which the formula does not", () => {
    const chuppy = CATALOG.get("furries_01_chuppy")!;
    expect(cardCost(chuppy)).toBe(4);
    expect(cardCost({ stats: chuppy.stats })).toBe(5);
  });

  it("clamps a silly override rather than trusting it", () => {
    expect(cardCost({ stats: stats(100, 100, 1), cost: 99 })).toBe(COST_MAX);
    expect(cardCost({ stats: stats(100, 100, 1), cost: -4 })).toBe(COST_MIN);
  });
});
