/**
 * **The special squares: the roll, the gate, the fog and the colours.**
 *
 * Or, 11 November 2026: *"1-3 random ones on every board (ours and the
 * opponent's) with a unique colour and icon. Possible for any card except
 * the King. The opponent sees your positions and you see his according to
 * the reveal stage."* And then: *"pressing a square (ours or the opponent's)
 * opens a popup that shows what is in it."*
 *
 * What the eight squares DO is measured in the engine (squares.test.ts
 * there, fourteen tests, each against the same board without the square).
 * This is the other half: the rules about the board rather than about the
 * battle, and the wiring that puts them on a screen.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  SQUARES,
  SQUARE_KINDS,
  TUNED,
  cellCapacity,
  fogSquares,
  placeableCells,
  rollSquares,
  squaresOpen,
  type SquareKind,
} from "@amanda/shared";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** A fixed, boring die, so a roll can be checked rather than sampled. */
const steady = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("rolling a board's squares", () => {
  it("never puts one under the crown", () => {
    /*
     * ⚠ Or: *"possible for any card except the King."* The crown is already
     * the most consequential square on the board; a mirror maze or a pancake
     * house under it would decide a match before a card had been placed.
     * Checked by rolling a lot rather than by reading placeableCells, so a
     * change to either one has to agree with the other.
     */
    const crown = new Set(["1-1", "1-2", "2-1", "2-2"]);
    for (const c of placeableCells()) expect(crown.has(c), `${c} is the crown`).toBe(false);
    for (let seed = 0; seed < 200; seed++) {
      const rnd = steady([seed / 200, (seed * 7) % 200 / 200, (seed * 13) % 200 / 200]);
      for (const cell of Object.keys(rollSquares(rnd, 3)))
        expect(crown.has(cell), `rolled ${cell}`).toBe(false);
    }
  });

  it("gives at most one of each kind", () => {
    /*
     * Two black holes on one board is x1.69 on everything for leaving two
     * cells empty, and two pancake houses is a board that cannot be built
     * on. It also means the icon on a cell is enough to know what is there.
     */
    for (let seed = 1; seed < 120; seed++) {
      const rnd = steady([seed / 120, (seed * 3) % 120 / 120, (seed * 29) % 120 / 120, 0.5]);
      const kinds = Object.values(rollSquares(rnd, 8));
      expect(new Set(kinds).size).toBe(kinds.length);
    }
  });

  it("rolls between one and the dial, and never two on one cell", () => {
    for (let seed = 1; seed < 60; seed++) {
      const rnd = steady([seed / 60, (seed * 11) % 60 / 60, (seed * 17) % 60 / 60]);
      const got = rollSquares(rnd);
      const n = Object.keys(got).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(TUNED.squaresPerBoard);
    }
  });
});

describe("when they are allowed at all", () => {
  it("opens at the second arena and not before", () => {
    // Or: *"from arena 2 or 3"*. The second opens at 150 trophies.
    expect(squaresOpen(0)).toBe(false);
    expect(squaresOpen(TUNED.squaresFromTrophies - 1)).toBe(false);
    expect(squaresOpen(TUNED.squaresFromTrophies)).toBe(true);
  });

  it("is a dial, so it can be turned off without a deploy", () => {
    const was = TUNED.squaresFromTrophies;
    try {
      TUNED.squaresFromTrophies = 1e9;
      expect(squaresOpen(100000)).toBe(false);
    } finally {
      TUNED.squaresFromTrophies = was;
    }
  });

  it("is the one gate every board goes through", () => {
    /*
     * ⚠ A second place that decided this would be a second answer. The
     * client rolls a board in exactly one function, and that function asks
     * the gate — see rollBoardSquares in useMatch.
     */
    const src = read("./useMatch.ts");
    expect(src).toContain("function rollBoardSquares(best: number): Squares");
    expect(src).toContain("if (!squaresOpen(best) || TUNED.squaresPerBoard <= 0) return {};");
    // And the modes that must not have them say so, each for its own reason.
    expect(src, "a lesson got squares").toContain("placements: {}, king: null, squares: {} }");
  });
});

describe("what the other side may see of yours", () => {
  const all = Object.fromEntries(
    placeableCells().map((c, i) => [c, SQUARE_KINDS[i % SQUARE_KINDS.length]!]),
  ) as Record<string, SquareKind>;

  it("is the front column while you are building", () => {
    const seen = fogSquares(all, "build");
    for (const cell of Object.keys(seen)) expect(cell.startsWith("3-")).toBe(true);
    expect(Object.keys(seen).length).toBe(4);
  });

  it("is three columns once panic starts, and everything after", () => {
    const panic = Object.keys(fogSquares(all, "panic"));
    expect(panic.every((c) => Number(c.split("-")[0]) >= 1)).toBe(true);
    expect(panic.length).toBeGreaterThan(4);
    expect(Object.keys(fogSquares(all, "battle")).length).toBe(Object.keys(all).length);
  });

  it("is the same rule the cards follow, and lifted by the same x-ray", () => {
    /*
     * Or: *"the opponent sees your positions and you see his according to
     * the reveal stage."* Two copies of a fog rule is how they come apart,
     * so this one is applied where the hook already knows the phase and
     * whether an x-ray is up — not in the screen that draws the board.
     */
    const src = read("./useMatch.ts");
    expect(src).toContain("xrayActive || playground ? foeSquaresRef.current : fogSquares(");
  });
});

describe("the bunker is the only cell that holds more than one", () => {
  it("is three deep, and everywhere else is one", () => {
    expect(cellCapacity({ "0-0": "bunker" }, "0-0")).toBe(TUNED.bunkerDepth);
    expect(cellCapacity({ "0-0": "hospital" }, "0-0")).toBe(1);
    expect(cellCapacity(undefined, "0-0")).toBe(1);
  });

  it("stacks for free, where the Ground Floor ability has to be paid for", () => {
    /*
     * ⚠ THE TWO RULES MUST NOT MERGE. Stacking has cost a slot since the
     * Ground Floor ability existed; the bunker is a property of the SQUARE
     * and costs nothing — so the branch that handles it must not fall
     * through into the one that spends a slot.
     */
    const src = read("./useMatch.ts");
    const at = src.indexOf("const cap = cellCapacity(s.squares, key);");
    expect(at, "the bunker branch is gone").toBeGreaterThan(-1);
    const branch = src.slice(at, src.indexOf("if (pile.length) return;", at));
    expect(branch, "the bunker spends a stacking slot").not.toContain("setStackSlots");
    expect(branch).toContain("if (1 + pile.length >= cap) return;");
  });
});

describe("one colour each, in one place", () => {
  it("has a name, a sentence, an icon and a colour for every kind", () => {
    for (const kind of SQUARE_KINDS) {
      const def = SQUARES[kind];
      expect(def.he.length, `${kind} has no name`).toBeGreaterThan(1);
      expect(def.note.length, `${kind} does not say what it does`).toBeGreaterThan(10);
      expect(def.icon.length).toBeGreaterThan(1);
      expect(def.colour, `${kind} has no colour`).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // No two kinds share a colour, or the board stops reading at a glance.
    const colours = SQUARE_KINDS.map((k) => SQUARES[k].colour.toLowerCase());
    expect(new Set(colours).size).toBe(colours.length);
  });

  it("paints the board from that same table", () => {
    /*
     * ⚠ CSS CANNOT READ A TYPESCRIPT FILE, so the eight colours are written
     * out twice and this is what stops them drifting. A kind that is amber
     * on the board and green in the panel explaining it is worse than no
     * colour at all.
     */
    const css = read("../styles/squares.css");
    for (const kind of SQUARE_KINDS) {
      expect(css, `.slot--square-${kind} has no rule`).toContain(`.slot--square-${kind} {`);
      const at = css.indexOf(`.slot--square-${kind} {`);
      const rule = css.slice(at, css.indexOf("}", at));
      expect(rule.toLowerCase(), `${kind} is a different colour in CSS`).toContain(
        SQUARES[kind].colour.toLowerCase(),
      );
    }
  });

  it("names an icon the game actually has", () => {
    const icons = read("../components/Icon.tsx");
    for (const kind of SQUARE_KINDS)
      expect(icons, `${kind} wants an icon that does not exist`).toContain(
        `"${SQUARES[kind].icon}"`,
      );
  });
});

describe("and a tap opens the panel", () => {
  it("is wired from both boards, with the fog answered for theirs", () => {
    /*
     * Or: *"pressing a square (ours or the opponent's) opens a popup that
     * shows what is in it."* ⚠ The square and the card on it are two facts
     * — the ground was rolled before the match, the card was placed during
     * it — so a square you can see holding a card you cannot is a real
     * state, and the panel says so rather than showing an empty one.
     */
    const app = read("../App.tsx");
    expect(app.match(/onSquareInfo=/g) ?? [], "only one board asks").toHaveLength(2);
    expect(app).toContain("hidden: !shown");
    expect(app).toContain("<SquareInfo");
  });
});
