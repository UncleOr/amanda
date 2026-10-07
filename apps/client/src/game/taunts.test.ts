import { describe, expect, it } from "vitest";
import { EMOJI, TAUNTS, TAUNT_LIMITS, emojiById, tauntById } from "@amanda/shared";

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

  it("every line has words in both languages and a face", () => {
    for (const t of TAUNTS) {
      expect(t.he.trim(), t.id).not.toBe("");
      expect(t.en.trim(), t.id).not.toBe("");
      expect(t.face.trim(), t.id).not.toBe("");
    }
  });

  /*
   * The faces used to be unicode characters and are now drawings this game
   * owns, some of which are bought. A sentence everybody is allowed to say
   * must not arrive wearing a picture only some people have — so every face
   * named by a taunt has to be in the FREE set, and this is what says so.
   */
  it("wears only a face that everybody has", () => {
    const free = new Set(EMOJI.filter((e) => e.free).map((e) => e.id));
    for (const t of TAUNTS)
      expect(
        free.has(t.face),
        `${t.id} wears "${t.face}", which is not a free emoji. Either pick a free face ` +
          `or make that one free — a line everybody can send cannot need a purchase to draw.`,
      ).toBe(true);
  });

  it("names a face that actually exists", () => {
    for (const t of TAUNTS) expect(emojiById(t.face), `${t.id} wears "${t.face}"`).toBeDefined();
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
