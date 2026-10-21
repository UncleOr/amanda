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

const TRACK = readFileSync(
  fileURLToPath(new URL("../components/ArenaTrack.tsx", import.meta.url)),
  "utf8",
);

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

  it("shows the story in place of the tease, and only one at a time", () => {
    expect(TRACK).toContain("{told ? say(a.story) : say(a.tease)}");
    expect(TRACK).toContain("useState<string | null>(null)");
  });
});
