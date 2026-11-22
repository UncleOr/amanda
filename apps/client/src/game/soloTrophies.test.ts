import { describe, expect, it } from "vitest";
import {
  MOST_REMOVABLE,
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

  /**
   * ⚠ THE CEILING SHIPS TURNED OFF, SO THIS TURNS IT ON.
   *
   * Or, 11 November: *"give me unlimited trophies against the bot too. There
   * are not enough users right now to limit it."* He is right about today;
   * the rule is right about a ladder with strangers on it. So it stays
   * written and stays tested, and `TUNED.soloTrophiesPerDay` is one dial in
   * the admin panel — 0 means off.
   */
  const withCeiling = (cap: number, run: () => void) => {
    const was = TUNED.soloTrophiesPerDay;
    TUNED.soloTrophiesPerDay = cap;
    try {
      run();
    } finally {
      TUNED.soloTrophiesPerDay = was;
    }
  };

  it("is off as it ships, and pays whatever the match was worth", () => {
    expect(TUNED.soloTrophiesPerDay, "the ceiling is back on by default").toBe(0);
    // However much of the day has already been played.
    expect(withinDailyCap(0, 12)).toBe(12);
    expect(withinDailyCap(1e9, 12)).toBe(12);
  });

  it("pays only what is left, and then nothing, once it is turned on", () => {
    withCeiling(60, () => {
      const cap = TUNED.soloTrophiesPerDay;
      expect(withinDailyCap(cap - 5, 12)).toBe(5);
      expect(withinDailyCap(cap, 12)).toBe(0);
      expect(withinDailyCap(cap + 100, 12)).toBe(0);
    });
  });

  it("never pays a negative number, whatever it is handed", () => {
    for (const cap of [0, 60])
      withCeiling(cap, () => {
        for (const [already, want] of [
          [-10, 5],
          [0, -5],
          [1e9, 12],
        ] as const)
          expect(withinDailyCap(already, want)).toBeGreaterThanOrEqual(0);
      });
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

/**
 * ═══ AND THE PART THAT KEPT "I BEAT THE HARD BOT" FROM BEING PAID ═══
 *
 * Or, 22 November 2026: *"I had a bug just now — I beat the HARD bot and it
 * told me you do not get trophies against the easy bot."*
 *
 * Both halves of that were real and the copy was the smaller one. The hard
 * planner builds thirteen cards, the floor is twelve, and the Eraser and the
 * Thief each take one card OFF the opponent's board — the hole refilled by a
 * Crumb Demon, which is deliberately not counted. Two enemy-targeted action
 * cards, which is an ordinary hand, and a won hard match arrived at the
 * server looking like the easy bot: no trophies, no nachos, and a sentence
 * about a setting he had not chosen.
 *
 * So the board is now counted as it was DEALT, and these are the arithmetic.
 */
describe("the cards you took off their board still count as theirs", () => {
  const HARD = 13;

  it("pays the hard bot after the Eraser and the Thief have both landed", () => {
    // The exact hand Or was playing: two cards that cross the midline.
    expect(payableLevel("hard", HARD - 2, 2)).toBe("hard");
    expect(payableLevel("hard", HARD - 2, 0), "this was the bug").toBe("easy");
  });

  it("survives a whole hand of them", () => {
    expect(payableLevel("hard", HARD - 5, 5)).toBe("hard");
  });

  it("does not let a claim buy more than an action deck could take", () => {
    /*
     * Ten is five cards at two each, and the two that reach across the
     * midline take one apiece. A request claiming more than the game can
     * do gets the ten and no more — so an EMPTY board claiming a thousand
     * removals still only reaches ten, which is under the floor.
     */
    expect(payableLevel("hard", 0, MOST_REMOVABLE)).toBe("easy");
    expect(payableLevel("hard", 0, 9999)).toBe("easy");
    // And three cards claiming fifty is three plus ten, which IS what a
    // hard board looks like after a whole hand — the clamp is the cap, not
    // a rejection. Written down because it looks like a hole and is the
    // same board an honest player would have sent.
    expect(payableLevel("hard", REAL_BOARD_CARDS - MOST_REMOVABLE, 50)).toBe("hard");
    expect(payableLevel("hard", REAL_BOARD_CARDS - MOST_REMOVABLE - 1, 50)).toBe("easy");
  });

  it("ignores nonsense without throwing", () => {
    for (const n of [-5, 0.5, Number.NaN])
      expect(payableLevel("hard", HARD, n), String(n)).toBe("hard");
    expect(payableLevel("hard", 0, -5)).toBe("easy");
  });

  it("still believes a claim of easy, which nobody makes to gain", () => {
    expect(payableLevel("easy", HARD, 10)).toBe("easy");
  });
});
