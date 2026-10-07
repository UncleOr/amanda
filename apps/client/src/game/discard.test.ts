import { describe, expect, it } from "vitest";
import { canTakeFromBin, takeFromBin, woundedKingMult } from "./useMatch";

/**
 * The bin costs something, and it costs it exactly once.
 *
 * These import the real functions rather than restating the rule, which the
 * first version of this file did — it agreed with the code by being a copy of
 * it, so it would have gone on passing through the change below.
 *
 * Or, after playing a match: *"I need to be able to pull only ONE card back
 * and no more. If I already pulled a card I should not be pulling the ones
 * after it out of the recycling."*
 */
describe("the one take-back", () => {
  it("is there while the bin has something in it", () => {
    expect(canTakeFromBin(false, 2)).toBe(true);
  });

  it("is gone once it has been spent, however full the bin is", () => {
    expect(canTakeFromBin(true, 9)).toBe(false);
  });

  it("is not offered when there is nothing to take", () => {
    expect(canTakeFromBin(false, 0)).toBe(false);
  });
});

describe("taking from the bin", () => {
  it("gives you the card on top", () => {
    expect(takeFromBin({ hand: "c", discard: ["a", "b"] }).hand).toBe("b");
  });

  it("buries what you gave up instead of leaving it on top", () => {
    expect(takeFromBin({ hand: "c", discard: ["a", "b"] }).discard).toEqual(["c", "a"]);
  });

  it("does not grow or shrink the bin when you swap", () => {
    expect(takeFromBin({ hand: "c", discard: ["a", "b"] }).discard.length).toBe(2);
  });

  it("empties the bin when you had nothing in hand", () => {
    expect(takeFromBin({ hand: null, discard: ["a"] }).discard).toEqual([]);
  });
});

/**
 * The radioactive eraser, aimed at a King.
 *
 * The card promises a flat 2000 off; the engine takes a multiplier; only the
 * client knows the King's full health. The one rule that is not arithmetic is
 * the floor: a King is never erased, however big the number.
 */
describe("a King an eraser was aimed at", () => {
  it("is not touched when nothing hit it", () => {
    expect(woundedKingMult("furries_01_chuppy", 0)).toBeNull();
  });

  it("is left standing even by a wound bigger than it is", () => {
    const mult = woundedKingMult("furries_01_chuppy", 999999);
    expect(mult).not.toBeNull();
    expect(mult!).toBeGreaterThan(0);
  });

  it("loses health rather than all of it", () => {
    const mult = woundedKingMult("furries_01_chuppy", 2000);
    expect(mult).not.toBeNull();
    expect(mult!).toBeLessThan(1);
  });
});
