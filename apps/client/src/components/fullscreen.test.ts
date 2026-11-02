/**
 * **The battle takes the whole screen, and so does what follows it.**
 *
 * Or: *"the battle screen, and the screen at the end of the battle, are not
 * full screen. Fix it."*
 *
 * Measured on the phone he plays on, 844x390: the result card came to 560x333
 * — two thirds of the width, with 142 pixels of background down each side —
 * and the field to 583 wide, because a 40px bar and 16px of padding came off
 * the HEIGHT first and a field that keeps its shape pays for that in width.
 *
 * Three rules hold it, and they are in three different places, which is why
 * they are pinned together here:
 *
 *   1. the app says which screens are immersive  (App.tsx)
 *   2. the bar stops being a row and floats      (topbar.css)
 *   3. the field is drawn to the screen's shape  (Arena.tsx)
 *
 * The first two are read out of the source, because there is no browser here
 * to measure. The third is arithmetic and is measured properly.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENA } from "@amanda/shared";
import { columnWidth } from "./Arena";

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const APP = read("../App.tsx");
const TOPBAR = read("../styles/topbar.css");
const BATTLE = read("../styles/battle.css");
const ARENA_SRC = read("./Arena.tsx");

/** The phone this game is played on, held sideways. */
const PHONE = { w: 844, h: 390 };
const CELL = 72;
const HEAD = 26;

describe("which screens take the whole window", () => {
  it("is the battle and the result, and nothing else", () => {
    const list = APP.slice(APP.indexOf("const IMMERSIVE ="), APP.indexOf("\n", APP.indexOf("const IMMERSIVE =")));
    expect(list).toContain('"battle"');
    expect(list).toContain('"result"');
    // The build phase is NOT one of them: you need the clock and the bar
    // while you are placing cards.
    expect(list).not.toContain('"build"');
    expect(list).not.toContain('"panic"');
  });

  it("and the app says so in a class the sheets can see", () => {
    expect(APP).toMatch(/IMMERSIVE\.includes\(m\.phase\)\s*\?\s*" app--immersive"/);
  });
});

describe("the top bar on those screens", () => {
  it("floats instead of taking a row", () => {
    const rule = TOPBAR.slice(TOPBAR.indexOf(".app--immersive .topbar {"));
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("background: none");
  });

  it("still lets its buttons be pressed", () => {
    /*
     * ⚠ THE WAY OUT MUST ALWAYS WORK. The bar is made click-through so the
     * battle underneath it is not blocked by an invisible strip — which
     * would also swallow the exit button if the buttons were not handed
     * their clicks back.
     */
    expect(TOPBAR).toContain(".app--immersive .topbar > * { pointer-events: auto; }");
  });

  it("keeps the safe area clear, so a notch never eats the exit", () => {
    const rule = TOPBAR.slice(TOPBAR.indexOf(".app--immersive .topbar {"));
    expect(rule).toContain("env(safe-area-inset-top");
    expect(rule).toContain("env(safe-area-inset-left");
  });
});

describe("the two screens themselves", () => {
  it("lose the padding that was framing them", () => {
    expect(BATTLE).toContain(".app--immersive .battle { padding: 0; }");
    expect(BATTLE).toContain(".app--immersive .result { padding: 0; }");
  });

  it("let the result card fill the window", () => {
    const rule = BATTLE.slice(BATTLE.indexOf(".app--immersive .result__card {"));
    expect(rule).toContain("width: 100%");
    expect(rule).toContain("max-width: none");
    // ⚠ MIN-height. The battle report opens inside this card and is taller
    // than any phone; a fixed height clips it (the card hides its overflow).
    expect(rule.slice(0, rule.indexOf("}"))).toContain("min-height: 100%");
    expect(rule.slice(0, rule.indexOf("}"))).not.toMatch(/\n\s*height: 100%/);
  });

  it("but keep the buttons a readable width", () => {
    // A row of controls stretched across 844 pixels is a toolbar. This is a
    // card telling a child how it went.
    expect(BATTLE).toMatch(/\.app--immersive \.result__body \{[^}]*width: min\(560px/);
  });
});

describe("the field is drawn to the shape of the screen", () => {
  const spread = (lanes: number, w = PHONE.w, h = PHONE.h) => columnWidth(lanes, w, h) / CELL;

  it("fills Or's phone in an ordinary battle", () => {
    const colw = columnWidth(ARENA.lanes, PHONE.w, PHONE.h);
    const w = ARENA.width * colw;
    const h = ARENA.lanes * CELL + HEAD;
    // Within a percent of the screen's own shape — which is the whole point:
    // `object-fit: contain` has nothing left to letterbox.
    expect(Math.abs(w / h - PHONE.w / PHONE.h)).toBeLessThan(0.02);
  });

  it("which is a quarter again at most, and never a squeeze", () => {
    expect(spread(ARENA.lanes)).toBeGreaterThan(1);
    expect(spread(ARENA.lanes)).toBeLessThanOrEqual(1.25);
    // ⚠ Amanda mode is eight lanes — a nearly square field — and wants 2.26.
    // It is capped and keeps a letterbox, which is the honest answer: the
    // alternative is cropping a lane off the bottom of the screen.
    expect(spread(8)).toBe(1.25);
  });

  it("and leaves the cells square on a screen that is not wide enough", () => {
    // A tablet, or a phone held upright. Letterboxed above and below, which
    // costs nothing, rather than squeezed, which would distort the board.
    expect(spread(ARENA.lanes, 1024, 768)).toBe(1);
    expect(spread(ARENA.lanes, 390, 844)).toBe(1);
  });

  it("is the same number the grid lines are drawn with", () => {
    /*
     * The one place in the file that steps by a column rather than a lane.
     * Left on CELL it drew eight lines across a field that is now wider,
     * stopping short of the right-hand edge — the kind of thing that is
     * obvious on a screen and invisible in a diff.
     */
    expect(ARENA_SRC).toContain("bg.moveTo(c * COLW, HEAD).lineTo(c * COLW, H)");
    expect(ARENA_SRC).not.toMatch(/moveTo\(c \* CELL/);
  });

  it("is measured once, from the window the battle is given", () => {
    expect(ARENA_SRC).toContain(
      "useState(() => columnWidth(LANES, window.innerWidth, window.innerHeight))",
    );
  });
});
