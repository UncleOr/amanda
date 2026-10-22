/**
 * **Copies come in packs, and a pack is cheaper than pressing buy ten times.**
 *
 * Or: *"say I am 6 Flame Dragons short of an upgrade — I will buy a pack of
 * 10 Flame Dragons, then upgrade, and I will also have +2 towards the next
 * upgrade."*
 */
import { describe, expect, it } from "vitest";
/*
 * The rule lives in packages/shared (both sides price a pack with it); the
 * test lives here, where there is a vitest to run it. The same arrangement
 * as every other shared rule in this repo.
 */
import { CARD_PACKS, isCardPack, packPrice } from "@amanda/shared";

describe("what a pack costs", () => {
  it("one copy is the price of one copy", () => {
    expect(packPrice(130, 1)).toBe(130);
  });

  it("five are a tenth cheaper, ten a fifth", () => {
    // 130 x 5 = 650, less 10% = 585, down to a round number.
    expect(packPrice(130, 5)).toBe(580);
    // 130 x 10 = 1300, less 20% = 1040.
    expect(packPrice(130, 10)).toBe(1040);
  });

  it("is always cheaper per copy as the pack grows", () => {
    for (const unit of [60, 90, 130, 200, 300]) {
      const per = CARD_PACKS.map((n) => packPrice(unit, n) / n);
      for (let i = 1; i < per.length; i++) expect(per[i]!, `${unit} x${CARD_PACKS[i]}`).toBeLessThan(per[i - 1]!);
    }
  });

  it("rounds the shop's way, never the customer's", () => {
    // Every discount in this shop rounds down; the rounding belongs to the
    // shop. One copy is exempt: it must cost exactly what the tile said,
    // whatever number that is.
    for (const unit of [55, 60, 90, 130, 200, 300]) {
      expect(packPrice(unit, 1)).toBe(unit);
      for (const n of [5, 10]) expect(packPrice(unit, n) % 10, `${unit} x${n}`).toBe(0);
    }
  });

  it("never costs less than a single copy", () => {
    // Only reachable if somebody sets the unit price to a handful.
    expect(packPrice(5, 1)).toBe(5);
    expect(packPrice(5, 10)).toBeGreaterThanOrEqual(5);
  });

  it("treats anything that is not a pack as one copy", () => {
    for (const n of [0, 2, 7, 11, -5, 1.5, NaN, Infinity]) expect(packPrice(130, n)).toBe(130);
  });
});

describe("which counts are packs", () => {
  it("is one, five and ten", () => {
    expect([...CARD_PACKS]).toEqual([1, 5, 10]);
  });

  it("says no to everything else, including the shapes a request can be", () => {
    for (const n of [2, 100, "10", null, undefined, {}, []]) expect(isCardPack(n)).toBe(false);
  });
});
