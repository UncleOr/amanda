import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENAS, atArena } from "@amanda/shared";

/**
 * **The arena tab, as a screen rather than as a rule.**
 *
 * `arenaOverrides.test.ts` has the rule — one family, one arena, resolved as
 * a whole set. These are about what Or sees while he is choosing: that the
 * taken families are actually drawn as taken, and that the sentence saying
 * where a family already lives is sayable in Hebrew.
 */
const SRC = readFileSync(fileURLToPath(new URL("./AdminArenas.tsx", import.meta.url)), "utf8");

describe("blocking a family that is already somewhere", () => {
  it("draws the taken ones as unselectable, and says where they are", () => {
    // Or: *"(packs that are already in another arena are blocked)"*.
    expect(SRC).toContain("const blocked = takenBy !== undefined && takenBy !== arena.id;");
    expect(SRC).toContain("disabled={blocked}");
  });

  it("leaves an arena able to keep the family it already has", () => {
    // `takenBy !== arena.id` is the whole of it: without that half, every
    // arena would arrive with its own family greyed out and unselectable,
    // and the first save of a name would quietly clear it.
    expect(SRC).toContain("takenBy !== arena.id");
  });

  /*
   * ⚠ ב AND ה COLLAPSE. "ב" + "המוסך" is "בהמוסך", which is not a word. Or
   * caught this exact mistake on the home screen once — *"עוד 150 להמגרש"* —
   * and `atArena` is the function that came out of it. Writing the
   * preposition by hand anywhere is how it comes back.
   */
  it("says where in Hebrew somebody would actually say it", () => {
    expect(SRC).toContain("atArena(where.name.he)");
    expect(SRC).not.toMatch(/כבר ב\$\{/);
  });

  it("and every arena name survives the preposition", () => {
    for (const a of ARENAS) expect(atArena(a.name.he).startsWith("בה")).toBe(false);
  });
});

describe("what the screen asks for", () => {
  it("offers the name, the lock line and the story, in both languages", () => {
    // Or: *"and a name and text in Hebrew and English."*
    expect(SRC).toContain('{ key: "name"');
    expect(SRC).toContain('{ key: "tease"');
    expect(SRC).toContain('{ key: "story"');
    expect(SRC).toContain('"he"');
    expect(SRC).toContain('"en"');
  });

  /*
   * Every other tab borrows `.gifts`, which is a 380px column beside the
   * rest. Measured in the browser: the story arrived in a 153px box showing
   * 86 of its 248 pixels. The stories are the point of this screen.
   */
  it("does not borrow the narrow two-column grid the other tabs use", () => {
    expect(SRC).not.toContain('className="gifts"');
    expect(SRC).toContain('className="arenas"');
  });

  it("will not save a blank Hebrew name, lock line or story", () => {
    expect(SRC).toContain("if (!draft[w.key].he.trim()) return say");
  });

  /*
   * The panel reads ARENAS to decide which families are taken, so a save
   * that only reached the database would leave the next row down still
   * offering a family that has just been claimed.
   */
  it("applies a save to this browser's own ladder straight away", () => {
    expect(SRC).toContain("applyArenaOverrides([{ id: arena.id, data: draft }]);");
    expect(SRC).toContain("sortSeriesByAppearance();");
  });

  it("does not pretend to edit the trophy numbers", () => {
    // They are Or's seven, and they are the one field in an arena that the
    // arenas around it depend on. Shown, not edited.
    expect(SRC).toContain("גביעים");
    expect(SRC).not.toContain('"from"');
  });
});
