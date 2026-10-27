/**
 * **The rules of a club that are about children rather than about clubs.**
 *
 * These test packages/shared, which has no test runner of its own — shared
 * logic is exercised from here, the same way cardPacks.test.ts and
 * challengePools.test.ts do.
 *
 * Or spelled the feature out in one message and then set its tone: *"you do
 * not need to write all these explanations to the user. The user sees only
 * buttons."* Which is true of the screen and emphatically not true of the
 * rules underneath it — these are the three that would be worth a bug
 * report each, so they are the three with tests.
 */
import { describe, expect, it } from "vitest";
import {
  CLUB_CHALLENGES,
  CLUB_CODE_LENGTH,
  CLUB_EMBLEMS,
  WARNINGS_BEFORE_REMOVAL,
  canSpare,
  checkClubName,
  checkMessage,
  isFreeEmblem,
} from "@amanda/shared";
import { periodKey } from "@amanda/shared";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("what never gets posted", () => {
  it("lets an ordinary sentence through", () => {
    expect(checkMessage("בואו נשחק").ok).toBe(true);
    expect(checkMessage("i have a spare flame dragon").ok).toBe(true);
  });

  it("stops the words, in both languages", () => {
    expect(checkMessage("אתה חרא").ok).toBe(false);
    expect(checkMessage("you are a bitch").ok).toBe(false);
  });

  /*
   * The half a plain list misses. A seven-year-old who gets "fuck" refused
   * tries "f u c k" within about four seconds, and a filter that falls for
   * that teaches them it can be beaten rather than that it is there.
   */
  it("is not fooled by padding the word out", () => {
    for (const trick of ["f u c k", "f.u.c.k", "fuuuuck", "F-U-C-K"]) {
      expect(checkMessage(trick).ok, trick).toBe(false);
    }
  });

  /*
   * And the half that is not about language at all: a child being moved off
   * a chat somebody is reading and onto one nobody is.
   */
  it("stops a way to be contacted somewhere else", () => {
    expect(checkMessage("whatsapp me").reason).toBe("contact");
    expect(checkMessage("052-1234567").reason).toBe("contact");
    expect(checkMessage("me@example.com").reason).toBe("contact");
    expect(checkMessage("https://discord.gg/x").reason).toBe("contact");
  });

  it("holds the club's name to the same rule", () => {
    expect(checkClubName("הדרקונים").ok).toBe(true);
    expect(checkClubName("").ok).toBe(false);
    expect(checkClubName("x".repeat(40)).ok).toBe(false);
    expect(checkClubName("the shit club").ok).toBe(false);
  });

  it("warns once and removes on the second", () => {
    // Or: "a second warning throws the person out of the club."
    expect(WARNINGS_BEFORE_REMOVAL).toBe(2);
  });
});

describe("giving a card away", () => {
  /*
   * Or: *"you only donate a card if you already have it — this slows down
   * your next upgrade but a card will never be taken from you and never
   * downgraded."*
   *
   * `copies` is the spare change ABOVE the level a card is already at, so
   * this predicate reading nothing else is the guarantee: there is no
   * expression here that could reach a level.
   */
  it("needs a spare copy, and reads nothing but copies", () => {
    expect(canSpare({ copies: 1 })).toBe(true);
    expect(canSpare({ copies: 0 })).toBe(false);
    expect(canSpare(undefined)).toBe(false);
  });
});

describe("the club's challenges", () => {
  it("is one of each cadence and no more, so the popup is not a wall", () => {
    const byPeriod = new Map<string, number>();
    for (const c of CLUB_CHALLENGES) byPeriod.set(c.period, (byPeriod.get(c.period) ?? 0) + 1);
    expect(byPeriod.get("daily")).toBe(1);
    expect(byPeriod.get("monthly")).toBe(1);
    expect(CLUB_CHALLENGES.length).toBeLessThanOrEqual(4);
  });

  it("pays a better chest for a longer haul", () => {
    const worth = { wood: 1, silver: 2, gold: 3 };
    const day = CLUB_CHALLENGES.find((c) => c.period === "daily")!;
    const month = CLUB_CHALLENGES.find((c) => c.period === "monthly")!;
    expect(worth[month.chest]).toBeGreaterThan(worth[day.chest]);
  });

  /*
   * ⚠ THE ONE THAT KEEPS CLUBS FROM BEING A PRINTING PRESS.
   *
   * Or left this open: *"club challenges reward all the club's members with
   * chests — we need to decide how to do this cleverly so there are not too
   * many prizes."* The answer is that the reward does not scale with how
   * many people wear the badge, only with how many played — which is a
   * property of the server (claimClubChest checks club_contributions), and
   * what can be held here is that the targets are club-wide SUMS rather
   * than per-person ones, so a bigger club finishes sooner and does not
   * thereby earn more each.
   */
  it("has targets a club shares rather than each member repeating", () => {
    for (const c of CLUB_CHALLENGES) {
      expect(c.target, c.id).toBeGreaterThan(5);
    }
  });

  it("uses the same calendar as the personal challenges", () => {
    /*
     * There WAS a second copy of this here for about ten minutes, with its
     * own timezone arithmetic and its own idea of when a week starts. Two
     * functions that must agree about "today" and do not is how a club
     * challenge would roll over on a different evening from the daily one
     * beside it. So the test is on the import, not on the output.
     */
    const src = readFileSync(
      fileURLToPath(new URL("../../../packages/shared/src/clubs.ts", import.meta.url)),
      "utf8",
    );
    expect(src).toContain('from "./challenges.js"');
    expect(src, "and not a second definition").not.toContain("export function periodKey");

    const at = new Date("2026-10-28T09:00:00Z");
    expect(periodKey("daily", at)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(periodKey("monthly", at)).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("the code and the emblems", () => {
  it("is six digits, like a friend code", () => {
    expect(CLUB_CODE_LENGTH).toBe(6);
  });

  it("knows which emblems come free with a club", () => {
    for (const id of CLUB_EMBLEMS) expect(isFreeEmblem(id)).toBe(true);
    expect(isFreeEmblem("robot"), "that one is bought").toBe(false);
  });
});
