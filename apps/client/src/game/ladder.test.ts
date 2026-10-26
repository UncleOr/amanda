/**
 * **The climb is longer at the top than it was.**
 *
 * Or, a fortnight in: *"we've been playing all of two weeks and we're
 * already at the train station. The distance to Fright Alley needs to be
 * bigger, and to the Fuel Stop really big."*
 *
 * The shape of a ladder is the thing to pin, not the numbers on it: the
 * first promotion should arrive in an evening and the last should be an
 * ambition, which means every gap is wider than the one below it. The
 * numbers themselves are Or's to move.
 */
import { describe, expect, it } from "vitest";
import { ARENAS, arenaFor, arenaProgress, openArenas } from "@amanda/shared";

const gaps = ARENAS.slice(1).map((a, i) => a.from - ARENAS[i]!.from);

describe("the shape of the ladder", () => {
  it("starts at nothing", () => {
    expect(ARENAS[0]!.from).toBe(0);
  });

  it("widens at every rung", () => {
    for (let i = 1; i < gaps.length; i++)
      expect(gaps[i], `rung ${i + 1} must be a longer climb than rung ${i}`).toBeGreaterThan(
        gaps[i - 1]!,
      );
  });

  /*
   * The two Or asked about. A win over a person is +30 and a loss −20
   * (trophies.ts), so an evening of even matches is about +50 — these gaps
   * are nineteen and forty-four such evenings, where they used to be nine
   * and fourteen.
   */
  it("makes the last climb the longest by a distance", () => {
    const last = gaps[gaps.length - 1]!;
    expect(last).toBeGreaterThan(2000);
    expect(last, "and more than twice the one before it").toBeGreaterThan(gaps[gaps.length - 2]! * 2);
  });

  it("still puts a player on the rung they have reached", () => {
    // The open rungs. A locked arena is not a rung anybody stands on — see
    // arenas.test.ts, which is where that is pinned.
    for (const a of openArenas()) {
      expect(arenaFor(a.from).id).toBe(a.id);
      // The first rung has nothing below it: a player on zero is in the
      // playroom and so is a player the ladder has never heard of.
      if (a.from > 0)
        expect(arenaFor(a.from - 1).id, "and one short of it is the rung below").not.toBe(a.id);
    }
  });

  it("fills the bar across a rung and stops at the top", () => {
    const [first, second] = ARENAS;
    expect(arenaProgress(first!.from)).toBe(0);
    expect(arenaProgress(Math.floor(second!.from / 2))).toBeCloseTo(0.5, 1);
    expect(arenaProgress(ARENAS[ARENAS.length - 1]!.from + 9999)).toBe(1);
  });
});
