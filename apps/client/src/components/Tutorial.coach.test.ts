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
