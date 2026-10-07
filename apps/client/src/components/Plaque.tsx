import { useLayoutEffect, useRef, useState } from "react";
import type { Catchphrase } from "@amanda/shared";

/**
 * A catchphrase, on the plaque it always sits on.
 *
 * Or: *"the phrases need to be on a designed sort of plaque — in the shop, in
 * the settings screen, and when they appear."* One component for all three,
 * which is the point of him saying all three: a line that looks like a banner
 * when you buy it and like a paragraph when it is shown is two different
 * things with the same words. This way the thing on the versus screen IS the
 * thing you chose in the profile IS the thing you saw in the shop.
 *
 * ═══ IT IS NARROW ON PURPOSE ═══
 *
 * Or again: *"and they need to be much narrower. Not taking up the whole
 * width of the screen like that."* The plaque sizes to its words and stops —
 * a banner that stretches edge to edge is a table row, and the shape is half
 * of what makes it read as a trophy rather than as text.
 *
 * The treatment comes from the phrase itself (`style`), so a gold one looks
 * gold wherever it turns up, and adding a style is a token rather than a
 * component.
 *
 * ═══ AND IT IS ALWAYS ONE LINE ═══
 *
 * Or: *"the phrase I chose as my catchphrase is too long and does not fit on
 * one line. Fix it."*
 *
 * A ribbon that wraps is not a ribbon. The words were allowed to wrap because
 * the alternative looked like capping the length of what he is allowed to
 * write — and the number of characters that fit is not a property of the
 * sentence, it is a property of whatever box the plaque happens to be in: the
 * versus screen, a shop tile and the profile list are three different widths,
 * and a phone is a fourth.
 *
 * So nothing is capped and nothing is cut. The line is held on one row and
 * the TYPE shrinks to meet it, by the exact ratio it is overflowing by —
 * `scrollWidth / clientWidth`, which is the overflow measured rather than
 * guessed. Down to 62%, below which it stops being readable and a long line
 * is better served by Or choosing a shorter one.
 */
export function Plaque({
  phrase,
  size = "normal",
}: {
  phrase: Catchphrase;
  /** `big` on the versus screen, where it is the loudest thing on display. */
  size?: "normal" | "big";
}) {
  const root = useRef<HTMLSpanElement>(null);
  const words = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  /*
   * Measure, then shrink — in a layout effect, so the browser never paints
   * the overflowing size first.
   *
   * ═══ IT MEASURES ITSELF AT FULL SIZE, ALWAYS ═══
   *
   * `scrollWidth / clientWidth` is the overflow AT THE CURRENT SIZE, so
   * measuring a plaque that has already been shrunk reports no overflow at
   * all. The first version of this did exactly that and settled back on 1
   * every time: shrink, re-measure, "it fits now", grow, repeat. Writing the
   * scale back to 1 on the element and THEN reading scrollWidth forces the
   * browser to lay the full-size line out first, so every measurement is of
   * the same thing.
   *
   * ═══ AND IT IS NOT A ResizeObserver ═══
   *
   * The obvious tool, and the wrong one here: this effect CHANGES the size of
   * the thing it would be observing, so every correction wakes it up again —
   * a loop that only stops because the answer stops changing, after spinning
   * through a few layouts each time.
   *
   * What actually makes the available width change is outside: the window, a
   * rotated phone. So that is what it listens to.
   */
  useLayoutEffect(() => {
    const fit = () => {
      const box = root.current;
      const el = words.current;
      if (!box || !el) return;
      box.style.setProperty("--pl-scale", "1");
      // Reading scrollWidth flushes the layout above, so this is the line at
      // full size whatever it was drawn at a moment ago.
      const over = el.scrollWidth / Math.max(1, el.clientWidth);
      const next = over > 1.02 ? Math.max(0.62, 1 / over) : 1;
      box.style.setProperty("--pl-scale", String(next));
      setScale(next);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [phrase.he, size]);

  return (
    <span
      ref={root}
      className={`plaque plaque--${phrase.style}${size === "big" ? " plaque--big" : ""}`}
      style={{ ["--pl-scale" as string]: scale }}
    >
      {/* The two ends. Drawn as elements rather than ::before/::after so the
          notch can be given the style's own colour without repeating every
          treatment twice in CSS. */}
      <i className="plaque__end" aria-hidden="true" />
      <span className="plaque__words" ref={words}>
        {phrase.he}
      </span>
      <i className="plaque__end" aria-hidden="true" />
    </span>
  );
}
