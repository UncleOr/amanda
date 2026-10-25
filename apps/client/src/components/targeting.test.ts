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
  it("has exactly one card that aims at the opponent", () => {
    const enemy = [...ACTIONS.keys()].filter(isEnemyTargeted);
    expect(enemy).toEqual(["radioactive_eraser"]);
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
