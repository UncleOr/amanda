/**
 * **The result screen has to explain a zero.**
 *
 * Or, on 10 November 2026: *"I won again and got no trophies or nachos."*
 * The match — found in the events table at 18:49, `won: true`, `score: 9` —
 * was against the EASY bot, which pays nothing in either currency by his own
 * rule. Nothing was broken. The screen just said so with an empty space, and
 * an empty space is what a dead server looks like too: the same symptom, six
 * days earlier, really was the server being gone.
 *
 * There is no jsdom here, so this pins the wiring: the component stops
 * returning null on that case, and the sentence is said only when it is the
 * whole story.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const PAYOUT = read("./Payout.tsx");

describe("a win that paid nothing", () => {
  it("no longer draws nothing at all", () => {
    /*
     * ⚠ THE EARLY RETURN IS THE BUG. Every reason a match can be worth
     * showing has to be in this list, and `noStakes` was the one that was
     * not — so the component went home before it could say anything.
     */
    const at = PAYOUT.indexOf("!award.cappedOut");
    expect(at, "the empty-match guard is gone — check this test still means something").toBeGreaterThan(
      -1,
    );
    const guard = PAYOUT.slice(at, PAYOUT.indexOf("return null;", at));
    expect(guard, "a stakeless match still draws nothing").toContain("!award.noStakes");
  });

  it("says which zero it is, and only when that is the whole story", () => {
    /*
     * Not said over a challenge that finished on the same match: something
     * real moved, and "this one was for practice" under it would read as if
     * that had not counted either. And never confused with the daily
     * ceiling — telling a child the wrong reason is worse than none.
     */
    expect(PAYOUT).toContain("award.noStakes && !award.nachos && !award.trophies");
    expect(PAYOUT, "the ceiling still has its own sentence").toContain("award.cappedOut &&");
  });

  it("is also said BEFORE the match, which is the half that stops the question", () => {
    expect(read("./HomeScreen.tsx"), "the easy bot still promises nothing about its pay").toMatch(
      /note: t\("[a-z0-9]+", "[^"]*בלי גביעים/,
    );
  });
});

/**
 * **A station that opened is a door, not a prize.**
 *
 * Or: *"could something be taken from the prize tunnel automatically? I need
 * to go in and take it myself — and if there is a message at the end of a
 * match, the button takes me to the tunnel and there I collect the prize and
 * get the cool effect and the dopamine and everything."*
 *
 * The first half was already true and had always been: the only thing in the
 * game that hands a station over is `claimStop` on the server, and the only
 * thing that calls it is a finger on that tile. The second half did not
 * exist — crossing a station was silent, so the moment it was earned and the
 * moment it was seen had nothing to do with each other.
 */
describe("a prize station that just opened", () => {
  it("is a line on the result screen at all", () => {
    expect(PAYOUT, "crossing a station is still silent").toContain("(award.tunnel ?? 0) > 0");
    // And it counts as a reason to draw the row, like every other event.
    const at = PAYOUT.indexOf("!award.cappedOut");
    const guard = PAYOUT.slice(at, PAYOUT.indexOf("return null;", at));
    expect(guard, "the row goes home before it can say so").toContain("!award.tunnel");
  });

  it("opens the tunnel rather than paying anything out", () => {
    /*
     * ⚠ THE WHOLE POINT, AND IT IS CHECKED ON BOTH SIDES. This component
     * may only OPEN the panel — the prize is taken on the tile, where the
     * effect and the noise are. A payout here would be the automatic grant
     * Or was asking about, arriving by the back door.
     */
    expect(PAYOUT).toContain("onTunnel?.()");
    expect(PAYOUT, "the result screen is handing the prize over itself").not.toMatch(
      /claimStop|tunnelGives/,
    );
    // And the screen gives it a real door to open.
    expect(read("./ResultScreen.tsx")).toContain('onTunnel={() => panel.show("tunnel")}');
  });

  it("is the third line on that row to work this way, and looks like one", () => {
    // The chest and the challenges are already buttons for the same reason;
    // a station that was styled as plain text would read as a notification
    // rather than as somewhere to go.
    expect(read("../styles/home-layout.css")).toContain(".payout__bit--tunnel");
  });
});
