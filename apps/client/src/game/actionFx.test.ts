/**
 * **A card you spend should say what it bought.**
 *
 * Or: *"when you activate dark corners, full refuel, energy boost, there
 * should be a vibration like that and a happier sound, and the card or cards
 * that improved should glow for a moment. And on every card you activate
 * there should be a vibration and a fitting sound."*
 *
 * Two different things are checked here and only one of them is about code.
 *
 * WHICH SQUARES LIT. `improvedBy` is the only honest answer to "what did
 * that card do", and it is a pure function of the board, so it is tested as
 * one. The failure it exists to stop is a glow that says MORE than the card
 * did — a full board flashing for a card that touched one square teaches a
 * seven-year-old the wrong thing about the card, which is worse than no glow
 * at all.
 *
 * THAT THE FLASH REACHES THE SCREEN. There is no jsdom here, so the chain
 * from the set to the class to the keyframes is read out of the source as
 * text. It is four files, and every one of them is a place a refactor drops
 * a prop silently: nothing throws when a glow stops appearing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACTION_FX, LIT_MS, improvedBy } from "./actionFx";
import { ACTIVE_ACTIONS, CORNER_KEYS } from "../data/catalog";

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");

/** A board with something on it, and a King. */
const BOARD = {
  placements: { "0-0": "slime", "2-1": "lava", "3-3": "jellyfish" },
  king: "titan_king",
};

describe("what a card lights up", () => {
  it("lights everything the energy boost reached, the King included", () => {
    /*
     * +50 power goes to every card on the board AND to the crown — see
     * `buffFor` in BoardGrid, which calls it for KING_KEY too. Leaving the
     * King dark would say the one card that matters most was left out of the
     * thing you just paid for.
     */
    expect(improvedBy("energy_boost", BOARD).sort()).toEqual(
      ["0-0", "2-1", "3-3", "king"].sort(),
    );
  });

  it("and nothing at all when the board is empty", () => {
    expect(improvedBy("energy_boost", { placements: {}, king: null })).toEqual([]);
  });

  it("lights the four corners for dark corners, full or not", () => {
    /*
     * The card changes the SQUARES, not the cards standing on them — an
     * empty corner that lights up is telling you where the next card should
     * go, which is the only use the card has while it is empty.
     */
    expect(improvedBy("dark_corners", BOARD).sort()).toEqual([...CORNER_KEYS].sort());
    expect(improvedBy("dark_corners", { placements: {}, king: null }).sort()).toEqual(
      [...CORNER_KEYS].sort(),
    );
  });

  it("lights only the square the refuel was pointed at", () => {
    expect(improvedBy("full_refuel", BOARD, "2-1")).toEqual(["2-1"]);
    // Aimed at nothing yet: the card is still armed, and nothing has changed.
    expect(improvedBy("full_refuel", BOARD)).toEqual([]);
  });

  it("lights nothing for a card that improved no card", () => {
    /*
     * ⚠ GROUND FLOOR IS A BOOST THAT IS NOT A GLOW, and that is the
     * distinction this whole function exists to hold. It buys four slots
     * that could go anywhere — so it sounds and feels like the other three,
     * because it bought the same KIND of thing, and it lights nothing,
     * because the glow is about CARDS and it has not touched one.
     */
    expect(improvedBy("ground_floor", BOARD)).toEqual([]);
    // And neither does anything aimed at the other side.
    expect(improvedBy("radioactive_eraser", BOARD, "1-1")).toEqual([]);
    expect(improvedBy("sandstorm", BOARD)).toEqual([]);
  });
});

describe("every card a player can press", () => {
  it("has a sound and a buzz of its own", () => {
    // Against the list of cards that EXIST, not a list written here: the
    // thing that goes wrong is a card being added and this file forgotten.
    for (const id of ACTIVE_ACTIONS) expect(ACTION_FX[id], `${id} has no entry`).toBeDefined();
  });

  it("and the map holds nothing that is not a card", () => {
    for (const id of Object.keys(ACTION_FX))
      expect(ACTIVE_ACTIONS as readonly string[], `${id} is not a playable card`).toContain(id);
  });

  it("never gives the happy sound to something done to the opponent", () => {
    /*
     * The one confusion that would actually cost something: a child learns
     * what a card does by what it sounds like, and the four below are the
     * four that hurt somebody.
     */
    for (const id of ["radioactive_eraser", "sandstorm", "time_freeze", "xray"]) {
      expect(ACTION_FX[id]!.sound, id).not.toBe("boost");
      expect(ACTION_FX[id]!.buzz, id).toBe("hex");
    }
  });

  it("and gives it to all three Or named", () => {
    for (const id of ["dark_corners", "full_refuel", "energy_boost"])
      expect(ACTION_FX[id], id).toEqual({ sound: "boost", buzz: "boost" });
  });
});

describe("and the flash gets to the screen", () => {
  const MATCH = read("./useMatch.ts");
  const APP = read("../App.tsx");
  const GRID = read("../components/BoardGrid.tsx");
  const CSS = read("../styles/chests.css");

  it("is set when a card is spent and put out again after a moment", () => {
    expect(MATCH).toContain("lightUp(improvedBy(id, gsRef.current, target))");
    expect(MATCH).toContain(
      "litTimer.current = window.setTimeout(() => setLit(new Set()), LIT_MS)",
    );
    // Cleared FIRST, so an earlier card's timer cannot switch a later card's
    // glow off halfway through.
    const up = MATCH.indexOf("const lightUp");
    const body = MATCH.slice(up, up + 400);
    expect(body.indexOf("window.clearTimeout")).toBeLessThan(body.indexOf("setLit(new Set(keys))"));
  });

  it("and never outlives the board it was drawn on", () => {
    // A match that ends, and a player who leaves in the middle of one.
    expect(MATCH).toContain("useEffect(() => () => window.clearTimeout(litTimer.current), [])");
    const round = MATCH.slice(MATCH.indexOf("const clearRound"));
    expect(round.slice(0, 1800)).toContain("setLit(new Set())");
  });

  it("reaches the board, and the board marks the square", () => {
    expect(APP).toContain("lit={m.lit}");
    expect(MATCH).toContain("    lit,");
    expect(GRID).toContain('`${lit?.has(key) ? " slot--lit" : ""}`');
    // The crown is a square like any other here — the energy boost reaches it.
    expect(GRID).toContain('`${lit?.has(KING_KEY) ? " slot--lit" : ""}`');
  });

  it("is drawn for exactly as long as the timer holds it", () => {
    /*
     * ⚠ TWO NUMBERS FOR ONE DURATION. The class comes off after LIT_MS and
     * the animation runs for whatever the CSS says; if they drift, the glow
     * either stops mid-flash or sits finished on the square. Neither is
     * visible in a diff.
     */
    const rule = CSS.slice(CSS.indexOf(".slot--lit {"));
    const secs = /animation: slot-lit ([\d.]+)s/.exec(rule);
    expect(secs, "no slot-lit animation").not.toBeNull();
    expect(Number(secs![1]) * 1000).toBe(LIT_MS);
  });

  it("flashes rather than fades, and is not the family-bonus ring", () => {
    const from = CSS.indexOf("@keyframes slot-lit");
    const rule = CSS.slice(from, from + 700);
    // Fast in, slow out: the shape of a struck thing. A flash whose peak is
    // in the middle is a lamp being turned up.
    const peak = /(\d+)% \{\s*filter: brightness\(1\.\d+\)/.exec(rule);
    expect(peak, "no bright frame").not.toBeNull();
    expect(Number(peak![1])).toBeLessThan(35);
    // Gold, where three of a family touching is green — one means "a number
    // went up", the other means "a rule is satisfied".
    expect(rule).toMatch(/rgba\(255, 2\d\d,/);
    expect(CSS.slice(CSS.indexOf(".slot--synergy::after"))).toContain("rgba(110, 231, 140");
    // And it ends, where the ring repeats forever.
    expect(rule).not.toContain("infinite");
  });

  it("and leaves the flash out for anyone who asked for less motion", () => {
    expect(CSS).toContain(".slot--lit { animation: none; }");
  });
});
