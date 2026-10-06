import { describe, expect, it } from "vitest";
import { TAUNTS, TAUNT_LIMITS, tauntById } from "@amanda/shared";

/*
 * The list is Or's to rewrite — he is the copywriter. These do not check his
 * words; they check that the list stays a list the code can rely on, so that
 * rewriting a line can never quietly break sending it.
 */
describe("the things a player may say", () => {
  it("every id is unique", () => {
    const ids = TAUNTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every line has words and an emoji in both languages", () => {
    for (const t of TAUNTS) {
      expect(t.he.trim(), t.id).not.toBe("");
      expect(t.en.trim(), t.id).not.toBe("");
      expect(t.emoji.trim(), t.id).not.toBe("");
    }
  });

  it("there is something to say during a match and something at the end", () => {
    expect(TAUNTS.some((t) => t.when === "always")).toBe(true);
    expect(TAUNTS.some((t) => t.when === "end")).toBe(true);
  });

  it("only ids from the list resolve — anything else is somebody poking the socket", () => {
    expect(tauntById(TAUNTS[0]!.id)).toBeDefined();
    expect(tauntById("taunt.nope")).toBeUndefined();
    expect(tauntById("")).toBeUndefined();
    expect(tauntById("__proto__")).toBeUndefined();
  });

  it("the limits are limits", () => {
    expect(TAUNT_LIMITS.gapSeconds).toBeGreaterThan(0);
    expect(TAUNT_LIMITS.perMatch).toBeGreaterThan(0);
  });
});
