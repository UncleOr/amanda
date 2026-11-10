/**
 * **The end of a match is a place you can leave from.**
 *
 * Two of Or's asks on 10 November 2026, both of them the same shape as the
 * chest line before them: a sentence on the result screen NAMES a thing, and
 * naming a thing you then have to go and find yourself is the long way round
 * to something already won.
 *
 *   *"at the end of a battle, when you press '3 challenges completed', take
 *   me to the challenges."*
 *
 *   *"a challenges window that doesn't close after taking, so I can take
 *   more."*
 *
 * ⚠ NEITHER CAN BE CLICKED IN A TEST and neither could be clicked by hand
 * here either — both need a FINISHED, UNCLAIMED challenge on a real account,
 * which is a day of playing or a write to Or's own rows. So they are held at
 * the source, the way every other wiring in this project is: the thing that
 * breaks them is somebody deleting a prop or putting `panel.close()` back,
 * and that is exactly what text catches.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const PAYOUT = read("./Payout.tsx");
const RESULT = read("./ResultScreen.tsx");
const APP = read("../App.tsx");
const CHALLENGES = read("./Challenges.tsx");

describe("the challenges line on the result screen", () => {
  it("is a button, not a sentence", () => {
    /*
     * It was a <span> with an icon in it. The chest beside it had been a
     * button since the day Or asked the same thing about chests, which is
     * the whole reason this one stood out: two lines side by side, one of
     * them a door and the other a label, and nothing on either saying which.
     */
    const at = PAYOUT.indexOf("payout__bit--quest");
    expect(at, "the challenge chip is gone — rename it here too").toBeGreaterThan(-1);
    const around = PAYOUT.slice(Math.max(0, at - 200), at + 400);
    expect(around, "still a span").toContain("<button");
    expect(around, "nothing to press").toContain("onChallenges?.()");
  });

  it("opens the panel that is already mounted above every phase", () => {
    // `panel` is App's one overlay, rendered outside the phase switch — so
    // it opens over the result screen exactly as it opens over the home
    // screen, with no second copy of the list anywhere.
    expect(RESULT).toContain('onChallenges={() => panel.show("challenges")}');
  });
});

describe("taking a prize from the challenges panel", () => {
  it("does not close the panel any more", () => {
    /*
     * ⚠ THE ASSERTION IS ABOUT `onTaking` AND NOTHING ELSE. The panel has a
     * perfectly good `panel.close()` on its backdrop and on its × — this is
     * not "the word close may not appear", which would pass the day somebody
     * deletes the × and fail the day somebody adds a keyboard escape.
     */
    const at = APP.indexOf("onTaking={");
    expect(at, "onTaking is gone from the challenges panel").toBeGreaterThan(-1);
    const handler = APP.slice(at, at + 600);
    expect(handler, "it still closes on taking").not.toContain("panel.close()");
    expect(handler, "nothing gets out of the prize's way").toContain("setFlying(true)");
    /*
     * And it must come back. A flight that is cut short — no target to fly
     * to, reduced motion, an animation interrupted by a reload — still has
     * to put the sheet back, or the panel is transparent for the rest of the
     * session. `finally`, never `then`.
     */
    expect(handler, "a cut-short flight leaves the sheet clear for ever").toContain(
      "finally(() => setFlying(false))",
    );
  });

  it("hands the caller something to wait on", () => {
    // The promise IS the feature: it is what lets the sheet go clear for
    // exactly as long as the token is in the air instead of for ever or not
    // at all. Before this, onTaking took nothing and the caller could only
    // close.
    expect(CHALLENGES).toContain("onTaking?: (landed: Promise<void>) => void;");
    expect(CHALLENGES).toContain("onTaking?.(landed);");
    // After the flight is created, not before — otherwise there is no
    // promise to hand over and the caller gets undefined.
    expect(CHALLENGES.indexOf("const landed =")).toBeLessThan(
      CHALLENGES.indexOf("onTaking?.(landed);"),
    );
  });

  it("gets out of the way with the glass, not with the list", () => {
    /*
     * The modal itself stays solid and pressable the whole time. A list that
     * fades under the thumb reaching for the next "take" reads as a bug, and
     * the token is z-index 210 — it flies over the sheet regardless.
     */
    const css = read("../styles/modals.css");
    const at = css.indexOf(".modal-overlay--peek");
    expect(at, "the see-through sheet is gone").toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at));
    expect(rule, "it should only change the backdrop").toContain("background:");
    expect(rule, "the list must not be touched").not.toContain("opacity");
    expect(rule, "the list must stay pressable").not.toContain("pointer-events");
  });
});

describe("won and lost, at a glance", () => {
  it("gives the two endings different colours, not just different borders", () => {
    /*
     * Or: *"make the visual between winning and losing more distinct. Right
     * now the background looks identical at first glance."*
     *
     * They were both `var(--panel)` with a one-pixel border between them,
     * and under 560px of height — which is every landscape phone, his
     * included — the illustration stops being the top of the card and
     * becomes a 42% wash, where two different paintings stop reading as two
     * different paintings.
     */
    const album = read("../styles/album.css");
    for (const [side, token] of [
      ["win", "--wash-win"],
      ["lose", "--wash-lose"],
    ] as const) {
      const at = album.indexOf(`.result__card--${side} {`);
      expect(at, `the ${side} card rule is gone`).toBeGreaterThan(-1);
      const rule = album.slice(at, album.indexOf("}", at));
      expect(rule, `the ${side} card has no wash of its own`).toContain(token);
    }
    const tokens = read("../styles/tokens.css");
    // In the palette, not written out at the two places that use them —
    // "about twenty panel backgrounds differing by 1–3%" is how the last
    // round of this started. See .claude/skills/amanda-ui.
    expect(tokens).toContain("--wash-win:");
    expect(tokens).toContain("--wash-lose:");
  });

  it("and turns the picture up for one and down for the other", () => {
    const battle = read("../styles/battle.css");
    const win = battle.slice(battle.indexOf(".result__card--win .result__scene"));
    const lose = battle.slice(battle.indexOf(".result__card--lose .result__scene"));
    // Colour is what survives behind a veil, so colour is what has to differ.
    expect(win.slice(0, win.indexOf("}")), "the win is not lifted").toContain("saturate(1.2)");
    expect(lose.slice(0, lose.indexOf("}")), "the loss is not drained").toContain("saturate(0.3)");
    // And the short-window case, which is the one Or actually plays in.
    expect(battle).toContain(".result__card--win .result__scene { opacity: 0.55; }");
    expect(battle).toContain(".result__card--lose .result__scene { opacity: 0.3; }");
  });
});
