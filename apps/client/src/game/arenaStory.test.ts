/**
 * **The story of an arena, told to somebody who has been there.**
 *
 * Or: *"after you open the arena — tapping any arena should tell the story
 * of the arena in two lines... The story of each arena can only be seen
 * after you have reached it once."*
 *
 * Two rules in one sentence, and the second is the one worth pinning: ONCE.
 * Trophies go down as well as up, and a story you have read is not something
 * the ladder can take back.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENAS } from "@amanda/shared";

const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
const TRACK = read("../components/ArenaTrack.tsx");

describe("every rung has a story", () => {
  it("is written for all of them, in both languages", () => {
    for (const a of ARENAS) {
      expect(a.story?.he, a.id).toBeTruthy();
      expect(a.story?.en, a.id).toBeTruthy();
    }
  });

  /* It is the place, not the picture: longer than the one-line tease. */
  it("says more than the tease on the locked card", () => {
    for (const a of ARENAS) expect(a.story.he.length, a.id).toBeGreaterThan(a.tease.he.length);
  });

  it("has no unfinished note left in it", () => {
    for (const a of ARENAS) {
      expect(a.story.he, a.id).not.toMatch(/\[|TODO|XXX/);
      expect(a.story.en, a.id).not.toMatch(/\[|TODO|XXX/);
    }
  });
});

describe("when it can be read", () => {
  /*
   * THE ONE THAT MATTERS. `trophies` is where you are; `best` is where you
   * have been. Reading the first would hide a story again the moment a
   * player lost two matches.
   */
  it("is measured against the high-water mark, not today's trophies", () => {
    expect(TRACK).toContain("const reached = best >= a.from;");
    expect(TRACK, "the old rule read the live count").not.toContain(
      "const reached = trophies >= a.from;",
    );
  });

  it("does not answer a tap on a rung you have not reached", () => {
    expect(TRACK).toContain("onClick={reached ? () => setTelling(");
  });

  /*
   * ═══ IT IS A SHEET NOW, NOT A ROW THAT GROWS ═══
   *
   * Or: *"when you press an arena a popup should REALLY open: a big picture
   * of the arena… make it bigger, in short."* The story used to replace the
   * one-line tease inside the row, in grey, at 10px on a phone.
   */
  it("opens the arena's own sheet, one at a time", () => {
    expect(TRACK).toContain("<ArenaStory arena={tale}");
    expect(TRACK).toContain("useState<string | null>(null)");
    expect(TRACK, "the story is not told in the row any more").not.toContain("say(a.story)");
  });

  it("will not open a rung you have only tapped the id of", () => {
    // `telling` is state and state can hold anything; the guard is here.
    expect(TRACK).toContain("a.id === telling && best >= a.from");
  });
});

/**
 * ═══ AND THE ARENA IS GROUND NOW ═══
 *
 * Or: *"a picture of the new cards you can get in this arena, add a caption
 * at the bottom — cards from the Slime series get +20% power in the Court!
 * (and of course implement it too)."*
 *
 * Two of those three are pinned in the engine (ground.test.ts). This is the
 * third: the sentence on the screen has to be the same 20% the battle uses,
 * or the game is lying to a seven-year-old about a number he can count.
 */
describe("the sheet", () => {
  const STORY = read("../components/ArenaStory.tsx");
  const CSS = read("../lab.css");

  it("draws the arena at the size it was painted", () => {
    expect(STORY).toContain("story__art");
    expect(STORY).toContain(`arena/${"${arena.id}"}.webp`);
  });

  /*
   * Or: *"the picture in the arena doesn't really show the location. I would
   * turn the picture into a sort of gif that runs in a loop with a small
   * animation."*
   *
   * The paintings are 1152x576 and the window is a band — 780x142 on a phone
   * held sideways — so a still shows a third of the place and the rest is
   * never seen by anybody. It is an <img> that walks its own height past the
   * window and back.
   */
  it("moves, so the whole place comes past", () => {
    expect(STORY).toContain('className="story__pan"');
    expect(CSS).toContain("@keyframes story-pan");
    expect(CSS, "it travels the full height of the painting").toContain(
      "object-position: 50% 100%",
    );
  });

  it("opens on the middle of the painting, not its top edge", () => {
    expect(CSS).toContain("0% { object-position: 50% 50%; }");
  });

  it("holds still for anybody who has asked their phone to stop moving things", () => {
    const reduced = CSS.slice(CSS.indexOf("prefers-reduced-motion"));
    expect(reduced).toContain(".story__pan { animation: none;");
  });

  it("shows the family that lives there", () => {
    expect(STORY).toContain("ground__cards");
    expect(STORY).toContain("c.seriesId === seriesId");
  });

  it("takes the percentage from the engine's own number", () => {
    expect(STORY).toContain("ARENA_POWER_BONUS");
    // Quoting Or in a comment is fine; printing it on the screen is not.
    expect(STORY, "a hand-typed 20 is a promise nothing keeps").not.toContain("+20% עוצמה");
  });

  it("says it in Or's words", () => {
    expect(STORY).toContain("קלפים מסדרת {0} מקבלים {1} +{2}% עוצמה!");
  });
});
