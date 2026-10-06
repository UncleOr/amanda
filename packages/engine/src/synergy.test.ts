import { describe, expect, it } from "vitest";
import { synergyMembers, touching } from "./synergy.js";
import type { Placement } from "./setup.js";

/*
 * "רק צמודים" — Or, 2026-10-06.
 *
 * The old rule counted three of a family anywhere on the board, so where you
 * put them never mattered. These pin the new one, including the two edges
 * worth arguing about: a corner is not touching, and the King is a member.
 */

const SERIES: Record<string, string> = {
  d1: "dragons",
  d2: "dragons",
  d3: "dragons",
  d4: "dragons",
  g1: "giants",
};
const seriesOf = (id: string) => SERIES[id];

const at = (cardId: string, x: number, y: number): Placement => ({ cardId, x, y });
const king = (cardId: string): Placement => ({ cardId, x: 1, y: 1, king: true });

const members = (ps: Placement[], threshold = 3) =>
  synergyMembers(ps, seriesOf, "dragons", threshold);

describe("touching", () => {
  it("counts a shared edge", () => {
    expect(touching(at("d1", 0, 0), at("d2", 1, 0))).toBe(true);
    expect(touching(at("d1", 0, 0), at("d2", 0, 1))).toBe(true);
  });

  it("does not count a corner — they have to touch, not nearly touch", () => {
    expect(touching(at("d1", 0, 0), at("d2", 1, 1))).toBe(false);
  });

  it("does not count a gap", () => {
    expect(touching(at("d1", 0, 0), at("d2", 2, 0))).toBe(false);
  });

  it("the King touches along the whole edge of its 2×2", () => {
    expect(touching(king("d1"), at("d2", 0, 1))).toBe(true);
    expect(touching(king("d1"), at("d2", 3, 2))).toBe(true);
    expect(touching(king("d1"), at("d2", 1, 0))).toBe(true);
    // …but not its own corners, which are diagonal from the King's corners.
    expect(touching(king("d1"), at("d2", 0, 0))).toBe(false);
  });
});

describe("who gets the bonus", () => {
  it("three of the family in a row, all touching: all three", () => {
    const ps = [at("d1", 0, 0), at("d2", 1, 0), at("d3", 2, 0)];
    expect(members(ps).size).toBe(3);
  });

  it("three of the family scattered: nobody", () => {
    // The old rule would have lit this up. That is the whole change.
    const ps = [at("d1", 0, 0), at("d2", 3, 0), at("d3", 0, 3)];
    expect(members(ps).size).toBe(0);
  });

  it("two touching and a third on its own: nobody", () => {
    const ps = [at("d1", 0, 0), at("d2", 1, 0), at("d3", 3, 3)];
    expect(members(ps).size).toBe(0);
  });

  it("a different family standing between them does not bridge the gap", () => {
    const ps = [at("d1", 0, 0), at("g1", 1, 0), at("d2", 2, 0), at("d3", 3, 0)];
    expect(members(ps).size).toBe(0);
  });

  it("a group bigger than the threshold is not punished for being bigger", () => {
    const ps = [at("d1", 0, 0), at("d2", 1, 0), at("d3", 2, 0), at("d4", 3, 0)];
    expect(members(ps).size).toBe(4);
  });

  it("the King can be the third member", () => {
    const ps = [king("d1"), at("d2", 0, 1), at("d3", 0, 2)];
    expect(members(ps).size).toBe(3);
  });

  it("and a corner card is not reachable through the King", () => {
    const ps = [king("d1"), at("d2", 0, 0), at("d3", 3, 3)];
    expect(members(ps).size).toBe(0);
  });

  it("an L bend counts — touching is touching", () => {
    const ps = [at("d1", 0, 0), at("d2", 0, 1), at("d3", 0, 2)];
    expect(members(ps).size).toBe(3);
  });

  it("only the touching group qualifies, not the loose ones beside it", () => {
    const ps = [
      at("d1", 0, 0),
      at("d2", 1, 0),
      at("d3", 2, 0), // the trio
      at("d4", 3, 3), // alone in a corner
    ];
    const got = members(ps);
    expect(got.has(3)).toBe(false);
    expect(got.size).toBe(3);
  });
});
