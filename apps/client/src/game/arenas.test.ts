import { describe, expect, it } from "vitest";
import { ARENAS, arenaFor, arenaProgress, toArena } from "@amanda/shared";

/*
 * ל and ה collapse in Hebrew, and a string concatenation does not know that.
 * Or caught "עוד 150 להמגרש" on the home screen — correct code, broken
 * language. These keep every arena name sayable.
 */
describe("to an arena, in Hebrew", () => {
  it("collapses the article: המגרש becomes למגרש", () => {
    expect(toArena("המגרש")).toBe("למגרש");
  });

  it("just prefixes a name that has no article at the front", () => {
    expect(toArena("חדר המשחקים")).toBe("לחדר המשחקים");
    expect(toArena("תחנת הרכבת")).toBe("לתחנת הרכבת");
  });

  it("never produces להe — every real arena name reads correctly", () => {
    for (const a of ARENAS) expect(toArena(a.name.he).startsWith("לה")).toBe(false);
  });
});

describe("the ladder", () => {
  it("a new player is in the first arena", () => {
    expect(arenaFor(0).id).toBe(ARENAS[0]!.id);
  });

  it("climbs as trophies climb, and never past the end", () => {
    expect(arenaFor(ARENAS[1]!.from).id).toBe(ARENAS[1]!.id);
    expect(arenaFor(999999).id).toBe(ARENAS[ARENAS.length - 1]!.id);
  });

  it("progress stays between 0 and 1, and is full at the top", () => {
    for (const t of [0, 75, 150, 900, 999999]) {
      const p = arenaProgress(t);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(arenaProgress(999999)).toBe(1);
  });
});
