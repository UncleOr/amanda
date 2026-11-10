/**
 * **The result screen has to explain a zero.**
 *
 * Or, on 10 November 2026: *"I won again and got no trophies or nachos."*
 * The match — found in the events table at 18:49, `won: true`, `score: 9` —
 * was against the EASY bot, which pays nothing in either currency by his own
 * rule. Nothing was broken. The screen just said so with an empty space, and
 * an empty space is what a dead server looks like too: the same symptom, six
 * days earlier, really was the server being gone.
 *
 * There is no jsdom here, so this pins the wiring: the component stops
 * returning null on that case, and the sentence is said only when it is the
 * whole story.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const PAYOUT = read("./Payout.tsx");

describe("a win that paid nothing", () => {
  it("no longer draws nothing at all", () => {
    /*
     * ⚠ THE EARLY RETURN IS THE BUG. Every reason a match can be worth
     * showing has to be in this list, and `noStakes` was the one that was
     * not — so the component went home before it could say anything.
     */
    const at = PAYOUT.indexOf("!award.cappedOut");
    expect(at, "the empty-match guard is gone — check this test still means something").toBeGreaterThan(
      -1,
    );
    const guard = PAYOUT.slice(at, PAYOUT.indexOf("return null;", at));
    expect(guard, "a stakeless match still draws nothing").toContain("!award.noStakes");
  });

  it("says which zero it is, and only when that is the whole story", () => {
    /*
     * Not said over a challenge that finished on the same match: something
     * real moved, and "this one was for practice" under it would read as if
     * that had not counted either. And never confused with the daily
     * ceiling — telling a child the wrong reason is worse than none.
     */
    expect(PAYOUT).toContain("award.noStakes && !award.nachos && !award.trophies");
    expect(PAYOUT, "the ceiling still has its own sentence").toContain("award.cappedOut &&");
  });

  it("is also said BEFORE the match, which is the half that stops the question", () => {
    expect(read("./HomeScreen.tsx"), "the easy bot still promises nothing about its pay").toMatch(
      /note: t\("[a-z0-9]+", "[^"]*בלי גביעים/,
    );
  });
});
