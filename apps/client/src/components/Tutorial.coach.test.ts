/**
 * **Amanda's band and the game are never in the same pixels.**
 *
 * This replaces Tutorial.place.test.ts, which guarded a function that no
 * longer exists — and the reason it no longer exists is worth keeping.
 *
 * ═══ WHAT THE OLD TEST WAS PROTECTING ═══
 *
 * `place()` decided where a floating bubble could go: below the target,
 * above it, beside it and narrower, and then a last branch whose own comment
 * said *"overlapping a board that fills the screen is unavoidable and
 * fine"*. The test pinned the worst case — the bubble must not land under
 * the top bar — because Or had photographed exactly that.
 *
 * It was a good test of a bad idea. A bubble floating over a screen laid out
 * for somebody who already knows the game has to find a gap, and on a
 * 832x384 landscape phone there often is none. Three rounds of fixes, three
 * photographs, one branch each.
 *
 * ═══ WHAT REPLACES IT ═══
 *
 * The band is docked at the foot of the screen and `.app--teaching` gives up
 * exactly its height. Overlap is now impossible the way two boxes side by
 * side cannot overlap — nothing is calculated, so nothing can be calculated
 * wrong on a screen nobody tried.
 *
 * That property rests on two numbers agreeing, in two different rules, in
 * one file. THAT is what can break, and it breaks silently: the band keeps
 * working and quietly sits on top of the board again. So it is what this
 * reads.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const CSS = readFileSync(here("../styles/album.css"), "utf8");
const TUT = readFileSync(here("./Tutorial.tsx"), "utf8");

/** Every declaration written for a selector, across all of its rules. */
function declarations(selector: string): string {
  const found: string[] = [];
  for (let at = CSS.indexOf(selector + " {"); at > -1; at = CSS.indexOf(selector + " {", at + 1)) {
    found.push(CSS.slice(at, CSS.indexOf("}", at)));
  }
  expect(found.length, `no rule for ${selector}`).toBeGreaterThan(0);
  return found.join("\n");
}

describe("the height the game gives up", () => {
  it("is one number, named once", () => {
    expect(declarations(":root")).toContain("--coach-h");
  });

  /*
   * The pair. If either side stops referring to the variable — a px value
   * pasted into one of them, say — they drift and the band is back on top of
   * the board, with nothing failing anywhere.
   */
  it("is what the app reserves while a lesson runs", () => {
    expect(declarations(".app--teaching")).toMatch(/padding-block-end:\s*var\(--coach-h\)/);
  });

  it("is exactly how tall the band is", () => {
    const band = declarations(".tut__coach");
    expect(band).toMatch(/height:\s*var\(--coach-h\)/);
    expect(band).toMatch(/max-height:\s*var\(--coach-h\)/);
  });
});

describe("where the band sits", () => {
  it("is pinned to the foot of the screen, across its whole width", () => {
    const band = declarations(".tut__coach");
    expect(band).toMatch(/position:\s*fixed/);
    expect(band).toMatch(/inset-block-end:\s*0/);
    expect(band).toMatch(/inset-inline:\s*0/);
  });

  /*
   * The dimming is a 9999px box-shadow and the walls that make it true are
   * `pointer-events: auto`. Without a stacking order above both, the words
   * are read through a dark sheet and the button cannot be pressed.
   */
  it("is above the dimming and the walls", () => {
    expect(declarations(".tut__coach")).toMatch(/z-index:\s*[2-9]/);
  });

  /*
   * A phone with a home indicator eats the bottom of the screen. The band is
   * the one thing in the app that touches that edge.
   */
  it("keeps clear of the home indicator", () => {
    expect(declarations(".tut__coach")).toContain("env(safe-area-inset-bottom)");
  });
});

describe("and nothing floats any more", () => {
  /*
   * The whole point. A reintroduced `place()` — or any style object written
   * onto the bubble from JavaScript — is the old architecture coming back,
   * and it would pass every test above.
   */
  it("exports no placement function", () => {
    expect(TUT).not.toMatch(/export function place\b/);
  });

  it("does not position the bubble from JavaScript", () => {
    const bubble = TUT.slice(TUT.indexOf('className="tut__bubble'));
    expect(bubble.slice(0, 400)).not.toContain("style=");
  });
});

/**
 * ═══ A MODAL OPENED DURING A LESSON HAS TO BE REACHABLE ═══
 *
 * Or, with a photograph of the exit dialog greyed out behind the teaching
 * layer: *"if you press exit at the top it is supposed to cover the tutorial
 * and let me press."*
 *
 * The exit BUTTON is deliberately left alive while teaching (topbar.css), so
 * the player could ask to leave — and then could not answer the question,
 * because the modal layer sat below the teaching one. The only way out of
 * the tutorial was the one thing the tutorial would not let them reach.
 *
 * Three numbers in three files, and nothing fails when they drift: the
 * dialog simply appears, greyed, and does not respond to a finger. So they
 * are read rather than remembered.
 */
describe("what sits above what", () => {
  const TOPBAR = readFileSync(here("../styles/topbar.css"), "utf8");
  const MODALS = readFileSync(here("../styles/modals.css"), "utf8");
  const OPENING = readFileSync(here("../styles/opening.css"), "utf8");

  const zOf = (css: string, selector: string): number => {
    const at = css.indexOf(selector + " {");
    expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
    const body = css.slice(at, css.indexOf("}", at));
    const m = /z-index:\s*(\d+)/.exec(body);
    expect(m, `${selector} has no z-index`).not.toBeNull();
    return Number(m![1]);
  };

  it("puts a modal above the teaching layer and above the bar", () => {
    const modal = zOf(MODALS, ".modal-overlay");
    expect(modal).toBeGreaterThan(zOf(CSS, ".tut"));
    expect(modal).toBeGreaterThan(zOf(TOPBAR, ".topbar"));
  });

  /*
   * And the opening film still covers everything, including a dialog. It is
   * the one thing in the game that is allowed to.
   */
  it("leaves the opening film on top of all of it", () => {
    expect(zOf(OPENING, ".opening")).toBeGreaterThan(zOf(MODALS, ".modal-overlay"));
  });
});

/**
 * ═══ ONE CONTROL IN THE BAND, NOT TWO ═══
 *
 * Or: *"the 'I know how to play' is confusing. People press it instead of
 * pressing in the middle. Get rid of it. Whoever wants to — will press exit
 * at the top."*
 *
 * It sat beside Amanda's words, under the button that moves the lesson on,
 * and it ENDED the tutorial. Two controls a few pixels apart, one the way
 * forward and one the way out, is a choice nobody asked to be given — and
 * the whole point of this band is that there is one thing to press.
 *
 * The exit button at the top is the way out: alive during a lesson on
 * purpose, it asks first, and it does not mark the tutorial finished, so
 * stopping and coming back resumes. The link never did that.
 *
 * Pinned because it is the kind of thing that comes back as a kindness.
 */
describe("the band's controls", () => {
  it("has no way to quit inside it", () => {
    expect(TUT).not.toContain("tut__skip");
    expect(TUT, "the quit callback existed only for that button").not.toContain("onQuit");
  });

  /*
   * And exactly one button in the markup: the next one, which is already
   * conditional on the step having nothing else to do.
   */
  it("renders one button, and only when there is nothing on the board to do", () => {
    const buttons = [...TUT.matchAll(/<button/g)];
    expect(buttons).toHaveLength(1);
    expect(TUT).toContain('{!step.awaits && step.press !== "target" && (');
  });
});
