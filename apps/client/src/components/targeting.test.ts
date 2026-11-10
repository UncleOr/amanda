/**
 * **The side you are being asked to pick from is the side you can click.**
 *
 * Or: *"the card destroyer does not work. I have no way to delete the
 * opponent's cards."*
 *
 * The handler had been fixed for this card twice — once for reading the wrong
 * board, once for guarding a board it should not guard — and neither fix did
 * anything, because nothing ever reached it. One line of CSS took
 * `pointer-events` off the opponent's half for every card being aimed: right
 * for the four that aim at your own board, and silently impossible for the
 * one that aims at theirs, with the bar still asking for it.
 *
 * Which is why this test is about the STYLESHEET. There is no jsdom here and
 * nothing to click; what can be pinned is that the rule names both cases and
 * that the class it depends on is actually set.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACTIONS, TARGET_EFFECTS, isEnemyTargeted } from "../data/catalog";

const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
const CSS = read("../styles/board.css");
const APP = read("../App.tsx");

describe("aiming an action card", () => {
  it("has two cards that aim at the opponent, and only one of them stays there", () => {
    const enemy = [...ACTIONS.keys()].filter(isEnemyTargeted);
    expect(enemy).toEqual(["radioactive_eraser", "thief"]);
  });

  it("hands the thief's aim back across the midline for its second press", () => {
    /*
     * ═══ THE ONLY CARD THAT TOUCHES BOTH BOARDS ═══
     *
     * Or: *"you activate the card, then one press on theirs + one press on
     * an empty square."* Every other targeted card belongs to one side for
     * its whole life, so `isEnemyTargeted` was enough to say which grid is
     * armed. It is not enough for this one: after the first press the aim
     * is on YOUR board, looking for somewhere to put what it took.
     *
     * Pinned at the source because there is no jsdom here and nothing to
     * click — the same reason the rest of this file reads the stylesheet.
     * What breaks it is somebody simplifying the condition back to
     * `isEnemyTargeted(m.targeting)` on either grid, and that is what these
     * two lines catch.
     */
    expect(APP, "your board is never armed for the second press").toContain(
      "(!isEnemyTargeted(m.targeting) || m.stealing !== null)",
    );
    expect(APP, "theirs stays armed and the second press lands on it").toContain(
      "isEnemyTargeted(m.targeting) && m.stealing === null",
    );
    // And the squares that answer are the EMPTY ones, which is the opposite
    // of every other card here.
    expect(APP).toContain("targetEmpty={m.stealing !== null}");
    expect(read("./BoardGrid.tsx")).toContain("targetEmpty ? !occ : !!occ");
  });

  it("marks which side is live", () => {
    expect(APP).toContain('" build--targeting-enemy"');
    expect(APP).toContain("isEnemyTargeted(m.targeting)");
  });

  it("dims the opponent only when the pick is on your own board", () => {
    expect(CSS).toContain(".build--targeting:not(.build--targeting-enemy) .side--enemy");
    expect(CSS, "and never the half being picked from").not.toMatch(
      /^\.build--targeting \.side--enemy,/m,
    );
  });

  it("dims your own side when the pick is on theirs", () => {
    expect(CSS).toContain(".build--targeting-enemy .side--me");
  });

  it("keeps the hand and the action bar out of the way either way", () => {
    expect(CSS).toContain(".build--targeting .hand");
    expect(CSS).toContain(".build--targeting .actions");
  });

  /* A card that targets a board must say which one, or this all falls over. */
  it("names a board for every targeted effect", () => {
    for (const [id, action] of ACTIONS) {
      if (!(action.effect in TARGET_EFFECTS)) continue;
      expect(["own", "enemy"], id).toContain(TARGET_EFFECTS[action.effect]);
    }
  });
});
