/**
 * **The tutorial bubble is never off the screen and never under the top bar.**
 *
 * Or, with a photograph of it: *"part of the tutorial is hidden."* The first
 * line of Amanda's bubble was cut in half, with the app's top bar and the
 * phone's status bar lying across it.
 *
 * ═══ WHY A DESKTOP BROWSER NEVER SHOWED IT ═══
 *
 * `.tut` is `position: fixed; inset: 0`, so it is laid out against the
 * VIEWPORT, while everything else in the app lives inside a wrapper padded by
 * `env(safe-area-inset-*)`. On a desktop those insets are zero and the two
 * agree exactly. In the Android WebView they do not: the status bar is real,
 * the app's bar sits under it, and a bubble placed at `top: 10` is beneath
 * both of them.
 *
 * It only bites when NEITHER band clears the target, because that is the only
 * branch that used to return `top: EDGE`. One step does that: the one that
 * lights up both albums, where the target is the whole board.
 *
 * The numbers below are measured from the real screen — Or's landscape phone
 * at 832x384, the board as `.boards` actually reports it, and the top bar at
 * 40px tall. The old code returned `top: 10` for this and the bug was visible
 * in a photograph; the test is the same question asked in arithmetic.
 *
 * `place` works off the live DOM for one thing only — the height of
 * `.topbar` — so each test says what the bar is, and the no-bar case is the
 * honest fallback rather than a crash.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { place, type Spot } from "./Tutorial";

/** Or's landscape phone. */
const W = 832;
const H = 384;
/** How tall the app's top bar measures on it. */
const BAR = 40;
/** The gap `place` keeps between the bar and the bubble. */
const GAP = 14;
const EDGE = 10;

function screen(barHeight: number | null) {
  vi.stubGlobal("window", { innerWidth: W, innerHeight: H });
  vi.stubGlobal("document", {
    querySelector: (sel: string) => {
      if (sel !== ".topbar" || barHeight === null) return null;
      return {
        getBoundingClientRect: () => ({
          top: 0,
          bottom: barHeight,
          height: barHeight,
          left: 0,
          right: W,
          width: W,
        }),
      };
    },
  });
}

/** The bubble, as it measures on that screen: 380 wide, 103 tall. */
const BW = 380;
const BH = 103;

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("the bubble stays on the screen", () => {
  /*
   * The exact case from the photograph. `.boards` fills the screen, so there
   * is no band above it and no band below it that a 103px bubble fits in.
   */
  const WHOLE_BOARD: Spot = { top: 58, left: 60, width: 712, height: 274 };

  it("never goes under the top bar, even when nothing clears the target", () => {
    screen(BAR);
    const at = place(WHOLE_BOARD, BW, BH);
    expect(at.top).toBeGreaterThanOrEqual(BAR + GAP);
  });

  it("is fully on the screen in that same case", () => {
    screen(BAR);
    const at = place(WHOLE_BOARD, BW, BH);
    expect(at.top).toBeGreaterThanOrEqual(0);
    expect(at.left).toBeGreaterThanOrEqual(0);
    expect(at.left + (at.width ?? BW)).toBeLessThanOrEqual(W);
  });

  /*
   * The regression itself, stated as the number that was wrong. The old
   * last-resort branch returned `top: EDGE` — 10 — which is 44px above where
   * the bar ends.
   */
  it("does not return the old top: 10", () => {
    screen(BAR);
    expect(place(WHOLE_BOARD, BW, BH).top).not.toBe(EDGE);
  });

  it("falls back to the plain edge when there is no bar to measure", () => {
    screen(null);
    const at = place(WHOLE_BOARD, BW, BH);
    expect(at.top).toBeGreaterThanOrEqual(EDGE);
  });

  /*
   * A bar that is not rendered must not reserve space: `.app--teaching` can
   * take it off some screens, and reserving 54px for something that is not
   * there would push every bubble down for no reason.
   */
  it("reserves nothing for a bar of zero height", () => {
    screen(0);
    expect(place(WHOLE_BOARD, BW, BH).top).toBeGreaterThanOrEqual(EDGE);
  });
});

describe("the ordinary cases still work", () => {
  it("sits below a target near the top", () => {
    screen(BAR);
    const spot: Spot = { top: 60, left: 300, width: 100, height: 60 };
    const at = place(spot, BW, BH);
    expect(at.top).toBe(spot.top + spot.height + GAP);
  });

  it("sits above a target near the bottom, and clear of the bar", () => {
    screen(BAR);
    const spot: Spot = { top: 260, left: 300, width: 100, height: 100 };
    const at = place(spot, BW, BH);
    expect(at.top + BH).toBeLessThanOrEqual(spot.top - GAP + 0.001);
    expect(at.top).toBeGreaterThanOrEqual(BAR + GAP);
  });

  /*
   * Beside, narrowed. The board on a landscape phone leaves no band above or
   * below but plenty of width — the fix for Or's older complaint, *"on some
   * screens the little panel hides the thing I need to do"* — so this keeps
   * that working while the top-bar clamp is added around it.
   */
  it("goes beside a tall target, narrower, rather than on top of it", () => {
    screen(BAR);
    const tall: Spot = { top: 60, left: 520, width: 211, height: 275 };
    const at = place(tall, BW, BH);
    expect(at.width).toBeDefined();
    expect(at.width!).toBeLessThanOrEqual(BW);
    // Clear of the target on one side or the other.
    const right = at.left + (at.width ?? BW);
    expect(right <= tall.left || at.left >= tall.left + tall.width).toBe(true);
    expect(at.top).toBeGreaterThanOrEqual(BAR + GAP);
  });

  it("never places a bubble that starts off the left edge", () => {
    screen(BAR);
    for (const left of [0, 5, 40, 400, 700, 820]) {
      const spot: Spot = { top: 100, left, width: 60, height: 60 };
      expect(place(spot, BW, BH).left).toBeGreaterThanOrEqual(0);
    }
  });
});
