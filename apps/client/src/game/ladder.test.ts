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
   * The last climb is an ambition. A win over a person is +30 and a loss −20
   * (trophies.ts), so an evening of even matches is about +50 — the top gap
   * is seventy such evenings.
   *
   * ⚠ "AND MORE THAN TWICE THE ONE BEFORE IT" USED TO BE HERE AND IS GONE.
   * It was true of a five-rung ladder whose top gap was a cliff (2,200 after
   * 750). Or then chose the numbers himself — *"in the next arenas the
   * progress needs to be much slower"* — and what he chose is a smooth
   * curve: every gap is about 1.6 to 1.75 times the one below it, the top
   * one included. That is a better shape than a cliff, so the assertion that
   * demanded a cliff went rather than the ladder.
   *
   * What replaces it says the same thing without assuming where the steepness
   * sits: the last climb on its own is longer than the whole first half of
   * the ladder.
   */
  it("makes the last climb an ambition", () => {
    const last = gaps[gaps.length - 1]!;
    expect(last).toBeGreaterThan(2000);
    const firstHalf = gaps.slice(0, Math.ceil(gaps.length / 2)).reduce((a, b) => a + b, 0);
    expect(last, "longer than the whole first half of the climb").toBeGreaterThan(firstHalf);
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
