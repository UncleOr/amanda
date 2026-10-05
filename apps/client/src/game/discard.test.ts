import { describe, expect, it } from "vitest";

/**
 * The bin has to cost something. These pin the rule rather than the code: a
 * card you throw can be taken back exactly once, and what you trade for it is
 * buried rather than left on top where it would be free to take straight back.
 */
function take(hand: string | null, discard: string[]): { hand: string; discard: string[] } {
  const top = discard[discard.length - 1]!;
  const rest = discard.slice(0, -1);
  return { hand: top, discard: hand !== null ? [hand, ...rest] : rest };
}

describe("taking from the bin", () => {
  it("gives you the card on top", () => {
    expect(take("c", ["a", "b"]).hand).toBe("b");
  });

  it("buries what you gave up instead of leaving it on top", () => {
    const after = take("c", ["a", "b"]);
    expect(after.discard).toEqual(["c", "a"]);
    // the whole point: taking again must NOT hand "c" straight back
    expect(take(after.hand, after.discard).hand).not.toBe("c");
  });

  it("does not grow or shrink the bin when you swap", () => {
    const after = take("c", ["a", "b"]);
    expect(after.discard.length).toBe(2);
  });

  it("empties the bin when you had nothing in hand", () => {
    expect(take(null, ["a"]).discard).toEqual([]);
  });
});
