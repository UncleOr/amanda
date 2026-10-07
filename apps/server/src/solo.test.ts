import { describe, expect, it } from "vitest";
import type { Placement } from "@amanda/engine";
import { soloResult } from "./solo.js";
import { factsFor } from "./meta.js";

/**
 * The path a match against the computer takes to become worth something.
 *
 * It is the only path in the game where the browser reports a match the
 * server never saw, so everything it hands over is suspect by construction.
 * Two pieces do the work and neither had a test:
 *
 *   `soloResult` takes the request apart and REPLAYS the battle, so the
 *   outcome is the engine's rather than the browser's.
 *
 *   `factsFor` reads one side's performance off that replay, and it is the
 *   thing that decides what gets paid.
 *
 * The failure that would hurt most is silent: reading the WRONG SIDE's grade.
 * Everybody would still be paid, nothing would throw, and every player would
 * be rewarded for how well their opponent played. That is the first test
 * below, and it is why the boards in these fixtures are deliberately lopsided
 * — against two equal boards, reading the wrong side looks exactly like
 * reading the right one.
 */

const DRAGON = "dragons_03_thunderwing";
const GIANT = "giants_01_stone_colossus";
const EGG = "dragons_02_obsidian_egg";
const FILLER = "crumb_demon";

/** Every slot that is not the King's 2x2, in board order. */
function slots(): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++) if (!(x >= 1 && x <= 2 && y >= 1 && y <= 2)) out.push({ x, y });
  return out;
}

/** A full board of one card, with a King in the middle. */
function boardOf(cardId: string, king = cardId): Placement[] {
  return [{ cardId: king, x: 1, y: 1, king: true }, ...slots().map((s) => ({ cardId, ...s }))];
}

const strong = boardOf(GIANT);
const weak = boardOf(EGG);

describe("replaying a reported match", () => {
  it("gives the same answer every time, which is the whole premise", () => {
    const once = soloResult({ seed: 4242, mine: strong, theirs: weak });
    const twice = soloResult({ seed: 4242, mine: strong, theirs: weak });
    expect("error" in once).toBe(false);
    expect("error" in twice).toBe(false);
    if ("error" in once || "error" in twice) return;
    expect(twice.result.winner).toBe(once.result.winner);
    expect(twice.result.ticks).toBe(once.result.ticks);
  });

  it("refuses a card that is not in the catalogue", () => {
    const sneaky = [...strong];
    sneaky[1] = { cardId: "a_card_i_invented", x: 0, y: 0 };
    expect(soloResult({ seed: 1, mine: sneaky, theirs: weak })).toEqual({ error: "bad board" });
  });

  it("refuses a placement off the board", () => {
    for (const bad of [
      { cardId: GIANT, x: 9, y: 0 },
      { cardId: GIANT, x: 0, y: -1 },
      { cardId: GIANT, x: 1.5, y: 0 },
    ])
      expect(soloResult({ seed: 1, mine: [bad], theirs: weak })).toEqual({ error: "bad board" });
  });

  it("refuses an empty board and an impossibly large one", () => {
    expect(soloResult({ seed: 1, mine: [], theirs: weak })).toEqual({ error: "bad board" });
    const huge = Array.from({ length: 400 }, () => ({ cardId: GIANT, x: 0, y: 0 }));
    expect(soloResult({ seed: 1, mine: huge, theirs: weak })).toEqual({ error: "bad board" });
  });

  it("refuses a request with no seed to replay from", () => {
    expect(soloResult({ mine: strong, theirs: weak })).toEqual({ error: "no seed" });
    expect(soloResult({ seed: "soon", mine: strong, theirs: weak })).toEqual({ error: "no seed" });
    expect(soloResult(null)).toEqual({ error: "מה?" });
  });
});

describe("which difficulty the board will vouch for", () => {
  it("believes a full opponent board", () => {
    const got = soloResult({ seed: 7, mine: weak, theirs: strong, level: "hard" });
    expect("error" in got).toBe(false);
    if ("error" in got) return;
    expect(got.level).toBe("hard");
  });

  it("pays a short opponent board as the easy bot, whatever it claims", () => {
    // Ten real cards is the easy planner's board. See REAL_BOARD_CARDS.
    const short = [strong[0]!, ...strong.slice(1, 10)];
    for (const claimed of ["hard", "normal"] as const) {
      const got = soloResult({ seed: 7, mine: weak, theirs: short, level: claimed });
      expect("error" in got).toBe(false);
      if ("error" in got) return;
      expect(got.level).toBe("easy");
    }
  });

  it("does not let filler pad a short board into a full one", () => {
    const padded = [
      strong[0]!,
      ...strong.slice(1, 10),
      ...slots().slice(9).map((s) => ({ cardId: FILLER, ...s })),
    ];
    const got = soloResult({ seed: 7, mine: weak, theirs: padded, level: "hard" });
    expect("error" in got).toBe(false);
    if ("error" in got) return;
    expect(got.level).toBe("easy");
  });

  it("treats an unrecognised setting as the one that pays nothing", () => {
    for (const claimed of [undefined, "", "HARD", "impossible", 3])
      expect(
        (soloResult({ seed: 7, mine: weak, theirs: strong, level: claimed }) as { level: string })
          .level,
      ).toBe("easy");
  });
});

describe("reading a side's performance off the replay", () => {
  /** Stone colossi against obsidian eggs: side A should win comfortably. */
  const replay = soloResult({ seed: 99, mine: strong, theirs: weak });
  if ("error" in replay) throw new Error(replay.error);

  it("grades the side it was asked about, not the other one", () => {
    const mine = factsFor(replay.result, "A", strong);
    const theirs = factsFor(replay.result, "B", weak);
    expect(mine.won).toBe(replay.result.winner === "A");
    expect(theirs.won).toBe(replay.result.winner === "B");
    expect(mine.won).not.toBe(theirs.won);
    /*
     * The grades have to differ, or this test cannot tell the two sides
     * apart and the bug it exists for would slip straight through.
     */
    expect(mine.score).not.toBe(theirs.score);
    expect(mine.score).toBeGreaterThan(theirs.score);
  });

  it("lists the cards that were on the board, repeats and all", () => {
    const facts = factsFor(replay.result, "A", strong);
    expect(facts.cardIds).toHaveLength(strong.length);
    expect(new Set(facts.cardIds)).toEqual(new Set([GIANT]));
  });

  it("leaves the filler out — nobody chose it", () => {
    const withFiller: Placement[] = [
      ...strong.slice(0, 8),
      ...slots().slice(7).map((s) => ({ cardId: FILLER, ...s })),
    ];
    const facts = factsFor(replay.result, "A", withFiller);
    expect(facts.cardIds).not.toContain(FILLER);
    expect(facts.cardIds).toHaveLength(8);
  });

  /*
   * A challenge can say "put a Lions card in the front row", and the row it
   * means is the one you PUT it in. The result knows where units ended up,
   * which after a battle is somewhere else entirely — so these come off the
   * placements, and this is the test that says so.
   */
  it("reads the rows off the board that was built, not where units ended up", () => {
    const mixed: Placement[] = [
      { cardId: GIANT, x: 1, y: 1, king: true },
      { cardId: DRAGON, x: 3, y: 0 }, // front row
      { cardId: DRAGON, x: 3, y: 3 }, // front row
      { cardId: EGG, x: 0, y: 0 }, // back row
      ...slots()
        .filter((s) => s.x !== 3 && s.x !== 0)
        .map((s) => ({ cardId: GIANT, ...s })),
    ];
    const facts = factsFor(replay.result, "A", mixed);
    expect(facts.frontSeries).toEqual(["dragons", "dragons"]);
    expect(facts.backSeries).toEqual(["dragons"]);
    expect(facts.frontSeries).not.toContain("giants");
  });

  it("gives a score inside the scale the nacho bands expect", () => {
    for (const side of ["A", "B"] as const) {
      const { score } = factsFor(replay.result, side, side === "A" ? strong : weak);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    }
  });
});
