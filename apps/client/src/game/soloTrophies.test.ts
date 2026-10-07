import { describe, expect, it } from "vitest";
import {
  REAL_BOARD_CARDS,
  TUNED,
  boardLooksReal,
  payableLevel,
  soloTrophiesFor,
  withinDailyCap,
} from "@amanda/shared";
import { CATALOG } from "../data/catalog";
import { __testing } from "./useMatch";

describe("what beating the computer is worth", () => {
  it("is nothing for the easy bot — Or asked for that explicitly", () => {
    expect(soloTrophiesFor("easy")).toBe(0);
  });

  it("is less than beating a person, by a long way", () => {
    expect(soloTrophiesFor("hard")).toBeLessThan(TUNED.trophiesPerWin / 2);
  });

  it("rewards the harder setting more", () => {
    expect(soloTrophiesFor("hard")).toBeGreaterThan(soloTrophiesFor("normal"));
  });
});

describe("the day's ceiling", () => {
  it("pays in full while there is room", () => {
    expect(withinDailyCap(0, 12)).toBe(12);
  });

  it("pays only what is left, and then nothing", () => {
    const cap = TUNED.soloTrophiesPerDay;
    expect(withinDailyCap(cap - 5, 12)).toBe(5);
    expect(withinDailyCap(cap, 12)).toBe(0);
    expect(withinDailyCap(cap + 100, 12)).toBe(0);
  });

  it("never pays a negative number, whatever it is handed", () => {
    for (const [already, want] of [
      [-10, 5],
      [0, -5],
      [1e9, 12],
    ] as const)
      expect(withinDailyCap(already, want)).toBeGreaterThanOrEqual(0);
  });
});

/**
 * ═══ THE PART THAT KEEPS "I BEAT THE HARD BOT" HONEST ═══
 *
 * The browser plays the solo match and tells the server which setting it was
 * on. The server does not simply believe it: it caps the claim by how full the
 * opponent board is, so a board that could only have come from the easy bot is
 * paid as easy whatever it was called.
 *
 * These tests run the REAL planner rather than inventing boards, because the
 * whole rule rests on a measured difference between what the settings produce
 * — and the day somebody retunes the easy bot to build a full board, this
 * should fail rather than quietly start paying for it.
 */
describe("the board has to vouch for the setting", () => {
  const realCards = (plan: Array<{ cardId: string }>) =>
    plan.filter((p) => p.cardId !== "crumb_demon" && CATALOG.has(p.cardId)).length;

  /** How often each setting's own boards pass the "looks real" test. */
  function passRate(level: "easy" | "normal" | "hard", runs = 400): number {
    let passed = 0;
    for (let i = 0; i < runs; i++)
      if (boardLooksReal(realCards(__testing.generateAiPlan(undefined, level)))) passed++;
    return passed / runs;
  }

  it("never mistakes an easy board for a real one", () => {
    expect(
      passRate("easy"),
      `the easy bot is now building boards of ${REAL_BOARD_CARDS} cards or more, which is what ` +
        `soloTrophies.ts uses to tell it apart. Either the easy planner changed, or the ` +
        `threshold needs re-measuring — see .scratch/board-strength.ts.`,
    ).toBe(0);
  });

  /*
   * This is the one that caught the first version of the rule. That version
   * also WEIGHED the board, and the weight distributions overlap — it was
   * turning 7% of honest normal boards away and paying them as the easy bot.
   * The card count has no spread at all, so this is exactly 1 rather than
   * nearly 1.
   */
  it("never turns a real board away", () => {
    for (const level of ["normal", "hard"] as const)
      expect(passRate(level), `${level} boards are being paid as easy`).toBe(1);
  });

  it("pays an easy-looking board as easy, whatever the browser called it", () => {
    const cards = realCards(__testing.generateAiPlan(undefined, "easy"));
    expect(payableLevel("hard", cards)).toBe("easy");
    expect(payableLevel("normal", cards)).toBe("easy");
  });

  it("believes a claim of easy without looking — nobody lies downward", () => {
    const cards = realCards(__testing.generateAiPlan(undefined, "hard"));
    expect(payableLevel("easy", cards)).toBe("easy");
  });

  it("lets a real board keep the setting it claims", () => {
    const cards = realCards(__testing.generateAiPlan(undefined, "hard"));
    expect(payableLevel("hard", cards)).toBe("hard");
  });

  it("is not fooled by a board padded out with filler", () => {
    // Ten real cards and six Crumb Demons is still the easy bot's board, and
    // the filler is exactly what a locked board is padded with.
    const padded = [
      ...__testing.generateAiPlan(undefined, "easy"),
      ...Array.from({ length: 6 }, () => ({ cardId: "crumb_demon" })),
    ];
    expect(payableLevel("hard", realCards(padded))).toBe("easy");
  });
});
