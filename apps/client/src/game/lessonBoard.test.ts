/**
 * **The lesson's board holds only the squares Amanda has talked about.**
 *
 * Or, after the third time the tutorial came back wrong: *"this tutorial.
 * No. Claude just cannot crack it and it always comes out bad. Maybe it is
 * worth rethinking the whole approach. Not hiding an existing board, but
 * building a new board where only what you can click appears."*
 *
 * ═══ WHY DIMMING WAS NEVER GOING TO WORK ═══
 *
 * The old tutorial was a dark layer with a hole in it over the real build
 * screen. In the photograph he sent, that is twenty slots, all dimmed, one
 * ringed — and a seven-year-old still has to find the lit one among twenty.
 * An empty slot is a drop target as well, so the dark ones were never just
 * decoration.
 *
 * `squaresBy` is the replacement, and it is derived rather than written: the
 * board holds exactly the squares the steps so far have named. The reason it
 * is derived is the failure it replaces — a hand-written list beside the
 * script drifts the first time a step moves, and the symptom is Amanda
 * pointing at a square that was never drawn.
 *
 * So these tests are about the two properties that make it safe to derive:
 * it never shrinks, and it never misses a square a step is about to require.
 * The second one is the whole contract. If it can fail, the lesson can ask a
 * child to put a card on a square that is not there.
 */
import { describe, expect, it } from "vitest";
import { LESSON_1, LESSON_2, SCRIPTS, squaresBy } from "./lessonScript";

/** Every square a step genuinely requires the player to be able to press. */
function needs(step: (typeof LESSON_1)[number]): string[] {
  if (step.awaits?.kind === "cell") return [...step.awaits.cells];
  if (step.awaits?.kind === "king") return ["king"];
  return [];
}

describe.each(Object.entries(SCRIPTS))("lesson %s", (_n, steps) => {
  /*
   * THE CONTRACT. A step that waits for a card on square 3-1 is a step that
   * cannot be completed unless 3-1 is on the screen — so if this ever fails,
   * the lesson is unfinishable and the child is stuck.
   */
  it("always draws the square the step is waiting for", () => {
    steps.forEach((step, i) => {
      const drawn = squaresBy(steps, i);
      for (const key of needs(step)) {
        expect(drawn.has(key), `step ${i} (${step.id}) waits for ${key}, which is not drawn`).toBe(
          true,
        );
      }
    });
  });

  /*
   * A square that appears and then vanishes is worse than one that was never
   * there: it is a card the child put down and can no longer see.
   */
  it("never takes a square away again", () => {
    let before = new Set<string>();
    steps.forEach((_step, i) => {
      const now = squaresBy(steps, i);
      for (const key of before) expect(now.has(key), `${key} disappeared at step ${i}`).toBe(true);
      before = new Set(now);
    });
  });

  it("starts smaller than it ends", () => {
    const first = squaresBy(steps, 0).size;
    const last = squaresBy(steps, steps.length - 1).size;
    expect(last).toBeGreaterThan(first);
  });

  /*
   * Twenty squares is the board the dimming had to hide. The whole point is
   * that a lesson never shows a full one — if it did, this would be the old
   * screen with the lights left on.
   */
  it("never shows the whole board", () => {
    const CELLS_ON_A_BOARD = 4 * 4 - 4 + 1; // sixteen, less the King's 2x2, plus the crown
    expect(squaresBy(steps, steps.length - 1).size).toBeLessThan(CELLS_ON_A_BOARD);
  });
});

/*
 * The first square of the first lesson is the one a child sees first, ever.
 * It is the guard post, because that is the step Or wrote first — and if a
 * refactor ever makes the lesson open on an empty board, this says so.
 */
describe("the first thing a child ever sees", () => {
  it("is one square, not a board", () => {
    // Step 0 points at both albums, which is not a square — so the board is
    // still empty, and the first SQUARE arrives with the first card.
    expect(squaresBy(LESSON_1, 1).size).toBe(1);
    expect([...squaresBy(LESSON_1, 1)]).toEqual(["3-1"]);
  });

  it("and the second lesson opens on its own first square too", () => {
    const atFirstCell = LESSON_2.findIndex((s) => s.awaits?.kind === "cell");
    expect(squaresBy(LESSON_2, atFirstCell).size).toBeLessThanOrEqual(2);
  });
});
