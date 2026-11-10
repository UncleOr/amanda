/**
 * **The dimming has to be true, not a picture — now with two holes in it.**
 *
 * Or: *"in the tutorial you only see the free squares, but the card has to
 * be lit too, so you can see what you are putting down. And there has to be
 * a drag option."*
 *
 * The second half is the one that can break silently. A wall over the card
 * does not look like anything; it just means the pointerdown that starts a
 * drag never reaches the card, and the only way to place anything is a tap.
 * So what is pinned here is coverage in BOTH directions: every hole is
 * genuinely open, and every pixel that is not a hole is genuinely walled.
 */
import { describe, expect, it } from "vitest";
import { wallsAround, type Rect } from "./spotWalls";

const W = 844;
const H = 390;
const covered = (walls: Rect[], x: number, y: number): boolean =>
  walls.some((r) => x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height);

describe("the screen minus the holes", () => {
  it("is the whole screen when there is nothing lit", () => {
    expect(wallsAround([], W, H)).toEqual([{ top: 0, left: 0, width: W, height: H }]);
    // A target that exists but has no size — a collapsed drawer, a panel
    // mid-open — is not a target, and must not punch a zero-width hole.
    expect(wallsAround([{ top: 10, left: 10, width: 0, height: 40 }], W, H)).toEqual([
      { top: 0, left: 0, width: W, height: H },
    ]);
  });

  it("is the same four panels as before for one hole", () => {
    const hole = { top: 100, left: 200, width: 80, height: 80 };
    const walls = wallsAround([hole], W, H);
    expect(walls).toHaveLength(4);
    expect(walls.map((r) => r.height).reduce((a, b) => a + b)).toBe(H + 80 * 2 - 80);
  });

  it("leaves both holes open and walls everything else", () => {
    /* A placing step: the card in the hand column, the square on the board. */
    const card: Rect = { top: 90, left: 40, width: 120, height: 170 };
    const cell: Rect = { top: 150, left: 600, width: 70, height: 70 };
    const walls = wallsAround([card, cell], W, H);

    for (const hole of [card, cell]) {
      expect(covered(walls, hole.left + hole.width / 2, hole.top + hole.height / 2)).toBe(false);
    }
    // And a sample of everywhere else — the corners, the band between the
    // two holes, and the strip above each of them.
    for (const [x, y] of [
      [2, 2],
      [W - 2, H - 2],
      [400, 200],
      [card.left + 10, card.top - 20],
      [cell.left + 10, cell.top - 20],
      [card.left - 20, card.top + 10],
    ] as const) {
      expect(covered(walls, x, y), `(${x},${y}) is live`).toBe(true);
    }
  });

  it("never overlaps a hole, however the two are arranged", () => {
    /*
     * ⚠ THE FAILURE THIS IS FOR: a wall that merely CLIPS the card still
     * swallows the pointerdown if the finger lands in the clipped part, and
     * the card then looks lit and refuses to be dragged. Checked by
     * walking a grid over every wall rather than by checking centres.
     */
    const a: Rect = { top: 40, left: 30, width: 140, height: 200 };
    const b: Rect = { top: 200, left: 120, width: 300, height: 120 }; // overlapping a
    for (const holes of [[a, b], [b, a], [a], [b]]) {
      for (const wall of wallsAround(holes, W, H)) {
        for (const hole of holes) {
          const gap =
            wall.left >= hole.left + hole.width ||
            hole.left >= wall.left + wall.width ||
            wall.top >= hole.top + hole.height ||
            hole.top >= wall.top + wall.height;
          expect(gap, `wall ${JSON.stringify(wall)} sits over ${JSON.stringify(hole)}`).toBe(true);
        }
      }
    }
  });
});
