/**
 * **A prize the size of the prize.**
 *
 * Or: *"when you take a challenge or anything with diamonds or nachos, make
 * it so that it is not one diamond flying up to the bar but MANY diamonds,
 * by the number I got."*
 *
 * There is no jsdom here, so what can be pinned is the rule that decides how
 * many there are — which is the part with a number in it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("./reward.ts", import.meta.url)), "utf8");

/** The rule itself, lifted out of the module so it can be run here. */
function tokensFor(amount: number): number {
  return Math.max(1, Math.min(Math.round(amount), 14));
}

describe("how many fly", () => {
  it("is one each, for a prize anybody could count", () => {
    expect(tokensFor(1)).toBe(1);
    expect(tokensFor(3)).toBe(3);
    expect(tokensFor(12)).toBe(12);
  });

  it("stops at fourteen, because past that it is a swarm and not a number", () => {
    expect(tokensFor(40)).toBe(14);
    expect(tokensFor(900)).toBe(14);
  });

  it("is never nothing, however small the prize", () => {
    expect(tokensFor(0)).toBe(1);
    expect(tokensFor(-5)).toBe(1);
  });

  it("is the rule the module actually uses", () => {
    expect(SRC).toContain("Math.max(1, Math.min(Math.round(amount), 14))");
    expect(SRC).toContain("Array.from({ length: count }, (_, i) => one(i))");
  });

  it("says the number once, on the first one", () => {
    // Fourteen coins each carrying "+40" is fourteen prizes.
    expect(SRC).toContain('i === 0 ? `<b class="fly__amount">+${amount}</b>` : ""');
  });

  it("still resolves when there is nowhere to fly to", () => {
    // The caller refreshes the purse on this promise; a prize that cannot be
    // animated must still be a prize that is taken.
    expect(SRC).toContain("if (!target || still) return Promise.resolve();");
  });
});
