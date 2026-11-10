/**
 * **The screen minus the holes, as rectangles.**
 *
 * ═══ WHY A TUTORIAL NEEDS THIS AT ALL ═══
 *
 * The dimming in Tutorial.tsx is not a picture: four panels around the lit
 * thing swallow every tap that lands on them, so "only the lit thing is
 * pressable" is true rather than suggested. Four panels is all one hole
 * needs — above it, below it, and the two strips beside it.
 *
 * Then Or asked for the thing that breaks that arithmetic:
 *
 *   *"in the tutorial you only see the free squares, but the CARD has to be
 *   lit too, so you can see what you are putting down. And there has to be a
 *   drag option."*
 *
 * Both halves need the same thing. A card you cannot see is a card you are
 * placing blind; and a card under a wall cannot start a drag, because the
 * drag begins with a pointerdown ON the card (game/useDrag.ts) and the wall
 * eats it. So a placing step has TWO holes — the card in your hand and the
 * square it is going to — and two holes cannot be described by four panels.
 *
 * ═══ A GRID, NOT A CLIP PATH ═══
 *
 * The obvious answer is one sheet with a `clip-path` cut through it. It is
 * also the answer that loses the rounded corners the hole is drawn with, and
 * puts the maths somewhere nothing can test.
 *
 * So: cut the screen along every hole edge, keep the cells of that grid that
 * are not inside a hole, and glue the survivors back together along each row.
 * One hole gives back the same four panels this replaced — which is the
 * first thing the test checks.
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const inside = (x: number, y: number, r: Rect): boolean =>
  x > r.left && x < r.left + r.width && y > r.top && y < r.top + r.height;

/**
 * Everything of a `w`×`h` screen that is NOT one of `holes`.
 *
 * Holes outside the screen, or with no size, are ignored rather than
 * producing a negative strip — an element can exist and be nowhere (a
 * collapsed drawer, a panel mid-open), and Tutorial.tsx already treats that
 * as "no target".
 */
export function wallsAround(holes: readonly Rect[], w: number, h: number): Rect[] {
  const real = holes.filter((r) => r.width > 0 && r.height > 0);
  if (!real.length) return [{ top: 0, left: 0, width: w, height: h }];

  const cut = (lo: number, hi: number, edges: number[]): number[] =>
    [...new Set([lo, hi, ...edges.filter((v) => v > lo && v < hi)])].sort((a, b) => a - b);
  const xs = cut(0, w, real.flatMap((r) => [r.left, r.left + r.width]));
  const ys = cut(0, h, real.flatMap((r) => [r.top, r.top + r.height]));

  const out: Rect[] = [];
  for (let j = 0; j + 1 < ys.length; j++) {
    const top = ys[j]!;
    const height = ys[j + 1]! - top;
    /*
     * Run along the row and only close a wall when a hole interrupts it, so
     * a row with nothing in it comes back as one rectangle rather than as
     * however many columns the other rows happened to need.
     */
    let left: number | null = null;
    for (let i = 0; i + 1 < xs.length; i++) {
      const x0 = xs[i]!;
      const x1 = xs[i + 1]!;
      const blocked = real.some((r) => inside((x0 + x1) / 2, top + height / 2, r));
      if (blocked) {
        if (left !== null) out.push({ top, left, width: x0 - left, height });
        left = null;
      } else if (left === null) {
        left = x0;
      }
    }
    if (left !== null) out.push({ top, left, width: xs[xs.length - 1]! - left, height });
  }
  return out.filter((r) => r.width > 0 && r.height > 0);
}
