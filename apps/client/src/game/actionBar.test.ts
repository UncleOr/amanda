/**
 * **The action drawer: one press to play, and then it gets out of the way.**
 *
 * Or, two changes in one breath:
 *
 *   1. *"You can see what an action card does before you take it. Once it is
 *      in the bar, pressing it PLAYS it. Without the middle step of looking
 *      at what it does and pressing 'use'. We are in a game against the
 *      clock."*
 *   2. *"After you use a card the bar closes. In the tutorial too — notice
 *      that in stage three, from the moment you use an action card the bar
 *      is open, the whole board is small and you cannot tell what is going
 *      on."*
 *
 * Both are rules about a screen, and there is no DOM here, so both are read
 * out of the source. That is weaker than driving the thing — but what broke
 * here is not behaviour under load, it is a wire that gets reconnected to
 * the wrong place by somebody tidying a component, and a wire is exactly
 * what reading catches.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APP = readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");
const CHIP = APP.slice(APP.indexOf("{m.actionBar.map("), APP.indexOf("{interactive && m.playground"));

describe("a card in the bar", () => {
  /*
   * The middle step, in full: tap the little card, read the full card, press
   * the button on it. And on a landscape phone — the only screen that
   * matters — that was not one path among several. The row of buttons under
   * the chip is display:none at that width (rooms.css), so it was the only
   * way to play any action card in the game.
   */
  it("is played by pressing it", () => {
    expect(CHIP, "the card's own press must play it").toMatch(/onClick=\{live \? \(\) => playAction/);
    expect(CHIP, "not open a window about it").not.toContain("onClick={() => setActionDetail");
  });

  it("has no button under it to press instead", () => {
    expect(APP).not.toContain("action-chip__main");
    expect(APP).not.toContain("action-chip__row");
  });

  /*
   * And nothing else on it. The card's own ℹ corner, measured in the drawer
   * at 52x68 on a landscape phone, came out 18px wide with 16 of them
   * hanging off the edge of the card — a second target beside the one you
   * are aiming at, in a drawer whose whole job is now one press. What the
   * card does is read in the hand, before you decide to keep it.
   */
  it("has nothing else on it to hit by accident", () => {
    expect(CHIP).not.toContain("onInfo");
  });

  /*
   * A card that cannot be played must not answer a press — and must say
   * which of the three reasons it is: spent, passive, or too late for a
   * freeze. Silence plus a dimmed face is not an answer.
   */
  it("says nothing when it is live and one word when it is not", () => {
    expect(CHIP).toContain("{!live && (");
    expect(CHIP).toContain("action-chip__state");
    expect(CHIP, "a dead card must not fire").toContain("live ? () => playAction(a.id) : undefined");
  });
});

describe("the drawer, once a card has been played", () => {
  /*
   * The open drawer takes 104px off the bottom of the boards, deliberately:
   * it floats over them and would otherwise cover the row of slots you
   * still need. That trade is right while you are choosing a card and wrong
   * the moment you have played one, because what the card just did happened
   * ON the board.
   */
  it("shuts itself", () => {
    const fn = APP.slice(APP.indexOf("const playAction"), APP.indexOf("const playAction") + 200);
    expect(fn).toContain("m.activateAction(id)");
    expect(fn).toContain("setActionsOpen(false)");
  });

  /*
   * And a round starts with it shut. `actionsOpen` outlives the match it
   * belongs to: caught walking stage three of the tutorial, which opened
   * with the board 104px short because the playground before it had left
   * the drawer up.
   */
  it("starts every round shut", () => {
    const fx = APP.slice(APP.indexOf('if (m.phase === "countdown")'));
    expect(fx.slice(0, 120)).toContain("setActionsOpen(false)");
  });

  /*
   * EVERY way in. The chip and the full card's own button are two doors to
   * the same room, and a second door that does not close the drawer is the
   * bug coming back half-fixed.
   */
  it("shuts itself whichever way the card was played", () => {
    const calls = [...APP.matchAll(/m\.activateAction\(/g)];
    expect(calls, "the only call is the one inside playAction").toHaveLength(1);
  });
});
