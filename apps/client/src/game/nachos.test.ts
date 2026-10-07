import { describe, expect, it } from "vitest";
import {
  NACHOS_PER_CHEST,
  chestsFilled,
  nachoBar,
  nachoChestKind,
  nachosForScore,
} from "@amanda/shared";

describe("what a match is worth", () => {
  it("pays nothing for a collapse and everything for a rout", () => {
    expect(nachosForScore(1)).toBe(0);
    expect(nachosForScore(2)).toBe(0);
    expect(nachosForScore(5)).toBe(1);
    expect(nachosForScore(8)).toBe(2);
    expect(nachosForScore(10)).toBe(3);
  });

  it("never pays more than three, whatever it is handed", () => {
    for (const s of [-5, 0, 11, 100, NaN, Infinity]) {
      const n = nachosForScore(s);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  /*
   * A loss is capped at 6 by the grader, so the top band can only be reached
   * by winning. This is the line that makes "3 nachos" mean something.
   */
  it("reserves the top band for a win", () => {
    expect(nachosForScore(6)).toBe(2);
    expect(nachosForScore(9)).toBe(3);
  });
});

describe("the bar", () => {
  it("is never full — a full bar has already become a chest", () => {
    for (let total = 0; total < 200; total++) {
      expect(nachoBar(total).have).toBeLessThan(NACHOS_PER_CHEST);
      expect(nachoBar(total).toGo).toBeGreaterThan(0);
    }
  });

  it("counts the chests behind it", () => {
    expect(chestsFilled(0)).toBe(0);
    expect(chestsFilled(NACHOS_PER_CHEST - 1)).toBe(0);
    expect(chestsFilled(NACHOS_PER_CHEST)).toBe(1);
    expect(chestsFilled(NACHOS_PER_CHEST * 2 + 1)).toBe(2);
  });

  it("puts a better chest a countable distance away", () => {
    expect(Array.from({ length: 9 }, (_, i) => nachoChestKind(i))).toEqual([
      "wood", "wood", "silver",
      "wood", "wood", "silver",
      "wood", "wood", "gold",
    ]);
  });
});

/**
 * ═══ THE NUMBER THAT WAS CHOSEN, AND THE ARGUMENT THAT WAS WRONG ═══
 *
 * The bar was first set to seven on the argument that seven is divisible by
 * neither 2 nor 3, so it would rarely be landed on exactly and so the player
 * would rarely come back to an empty bar. The first test below measures that
 * claim and it does not survive: the flush rate is the same for every bar
 * size, because a step of 1 that crosses the line always lands on it.
 *
 * These tests stay so that nobody re-derives the tidy wrong answer, and so
 * that the number the bar IS set to keeps the rhythm it was chosen for.
 */
describe("how often the bar comes back empty", () => {
  /** A plausible evening: about half wins, graded across the real range. */
  function* scores(n: number, seed = 12345) {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < n; i++) {
      // A win grades 5–10, a loss 1–6 (the grader caps a loss at 6).
      yield rnd() < 0.5 ? 5 + Math.floor(rnd() * 6) : 1 + Math.floor(rnd() * 6);
    }
  }

  /** Of the chests a bar of this size pays out, how many leave it at zero. */
  function flushRate(size: number): number {
    let total = 0;
    let chests = 0;
    let flush = 0;
    let prev = 0;
    for (const score of scores(200_000)) {
      total += nachosForScore(score);
      const now = Math.floor(total / size);
      if (now > prev) {
        chests += now - prev;
        if (total % size === 0) flush++;
        prev = now;
      }
    }
    return flush / chests;
  }

  it("does not depend on the size of the bar — the divisibility argument is wrong", () => {
    const rates = [4, 5, 6, 7, 8, 9, 10, 11].map(flushRate);
    const spread = Math.max(...rates) - Math.min(...rates);
    expect(
      spread,
      `flush rates were ${rates.map((r) => (r * 100).toFixed(1) + "%").join(" ")} — if these ` +
        `have come apart, the step distribution has changed and the comment in nachos.ts ` +
        `about divisibility not mattering needs re-measuring.`,
    ).toBeLessThan(0.01);
  });

  it("is set by the payouts, which are 0..3, so it is about half", () => {
    expect(flushRate(NACHOS_PER_CHEST)).toBeGreaterThan(0.45);
    expect(flushRate(NACHOS_PER_CHEST)).toBeLessThan(0.65);
  });
});

describe("the rhythm the size was actually chosen for", () => {
  function* scores(n: number, seed = 999) {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < n; i++)
      yield rnd() < 0.5 ? 5 + Math.floor(rnd() * 6) : 1 + Math.floor(rnd() * 6);
  }

  it("is a chest every three matches or so — Or's 'one or two games away'", () => {
    let total = 0;
    let matches = 0;
    for (const score of scores(200_000)) {
      total += nachosForScore(score);
      matches++;
    }
    const perChest = matches / chestsFilled(total);
    expect(
      perChest,
      `a chest every ${perChest.toFixed(1)} matches. Below 2.5 the chest stops being worth ` +
        `walking towards; above 4.5 it stops being close.`,
    ).toBeGreaterThan(2.5);
    expect(perChest).toBeLessThan(4.5);
  });
});
