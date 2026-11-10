/**
 * How much of the screen the on-screen keyboard is covering, as a CSS value.
 *
 * ═══ WHAT OR SAW ═══
 *
 * *"By the way — when the keyboard opens it gets really small and ugly.
 * Maybe we should make our own keyboard that fits the screen? There isn't
 * much to type."*
 *
 * Measured by shrinking the window to what a keyboard leaves of a landscape
 * phone — 844 wide and about 190 tall — and looking: the home screen is not
 * redrawn smaller, it is CUT IN HALF. Everything keeps its size, because the
 * type scale is `clamp(13px, 3.6vh, 16px)` and at that height every step is
 * sitting on its floor; the layout is `height: 100dvh` with `overflow:
 * hidden`, so the bottom half simply stops existing. The field you are typing
 * into can be in the half that is gone.
 *
 * ═══ TWO HALVES, AND THIS IS THE SECOND ═══
 *
 * The first is `interactive-widget=overlays-content` on the viewport meta in
 * index.html. Without it the browser SHRINKS the page to fit above the
 * keyboard, which is the cut in half above. With it the page keeps its full
 * height and the keyboard simply lies on top — nothing reflows, nothing
 * squashes, and the game behind stays exactly the game.
 *
 * Which leaves one problem, and it is this file: a dialog centred in the
 * window is now centred behind the keyboard. `visualViewport` is the only
 * thing that knows how tall the keyboard actually is — it is the part of the
 * page you can SEE, as against the part that exists — so the difference is
 * the answer, and it goes out as a custom property for the stylesheet to use.
 *
 * ⚠ NOT A HEIGHT, AN INSET. `--kb` is how many pixels are covered at the
 * bottom, 0 when nothing is. Everything that reads it treats it as padding,
 * so a browser that has never heard of `visualViewport` gets 0 and the exact
 * behaviour it had before this existed.
 */

/** Below this many pixels it is the address bar or a rounding error, not a keyboard. */
const MIN = 80;

export function watchKeyboard(): void {
  const vv = window.visualViewport;
  if (!vv) return;

  let last = -1;
  const measure = () => {
    /*
     * The gap between the page and what is visible of it. `offsetTop` is
     * there because a browser that pans rather than resizes moves the visual
     * viewport DOWN the page instead of shortening it, and without it that
     * case measures as no keyboard at all.
     */
    const covered = window.innerHeight - vv.height - vv.offsetTop;
    const kb = covered > MIN ? Math.round(covered) : 0;
    // Only on change: this fires on every scroll and every pinch, and setting
    // a custom property invalidates style for the whole document.
    if (kb === last) return;
    last = kb;
    document.documentElement.style.setProperty("--kb", `${kb}px`);
    // A class as well as the number, for anything that wants to change shape
    // rather than move — there is nothing today, and the day there is, it
    // should not have to compare a string against "0px".
    document.documentElement.classList.toggle("kb-open", kb > 0);
  };

  measure();
  vv.addEventListener("resize", measure);
  vv.addEventListener("scroll", measure);
}
