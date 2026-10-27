/**
 * **The take button, and the name that used to sit on top of it.**
 *
 * Or: *"sometimes the action card's name is too long and then the name part
 * covers the take button — sort it so it doesn't cover it."*
 *
 * The arrow was placed at `bottom: 34%`, a percentage chosen against a name
 * plate that was assumed to stay one line tall. The plate is anchored to the
 * bottom and grows UPWARDS, and `.card--large .card__name` clamps to two
 * lines, so a long name lifted the plate into the arrow.
 *
 * Measured in the browser with the real stylesheet at the real sizes:
 *
 *   | where              | name                 | plate | arrow buried |
 *   | battle hand 92×120 | one line             |  36px |      0       |
 *   | battle hand 92×120 | "Radioactive Eraser" |  51px |     11px     |
 *   | playground 46×60   | ANY name             |  51px |  31px of 36  |
 *
 * — which also found the worse one nobody reported: in the playground the
 * arrow is three-quarters buried whatever the card is called, because every
 * name wraps on a card 46px wide.
 *
 * There is no DOM here, so these read the stylesheet. What they are really
 * guarding is that the arrow's position stays DERIVED from the plate's
 * height rather than guessed against it — a percentage that happens to work
 * today is exactly how this came back the first time.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CSS = readFileSync(
  fileURLToPath(new URL("../styles/actions.css", import.meta.url)),
  "utf8",
);

/**
 * Every rule body written against `selector`, joined.
 *
 * Not the FIRST one: `.action-card` and `.action-card .card__plate` each
 * already had a rule earlier in this file (the gold border, the gold plate
 * gradient), so taking the first match tested the wrong block and failed on
 * a stylesheet that was correct. What is being asked here is "is this
 * declared anywhere for this selector", which is what the cascade answers.
 */
function rule(selector: string): string {
  const bodies: string[] = [];
  let at = CSS.indexOf(selector);
  while (at > -1) {
    const open = CSS.indexOf("{", at);
    bodies.push(CSS.slice(open + 1, CSS.indexOf("}", open)));
    at = CSS.indexOf(selector, at + selector.length);
  }
  expect(bodies.length, `no rule for ${selector}`).toBeGreaterThan(0);
  return bodies.join(" ");
}

describe("the name plate on an action card", () => {
  it("is one line, so it cannot grow into the arrow", () => {
    const name = rule(".action-card .card__name");
    expect(name).toContain("white-space: nowrap");
    expect(name).toContain("-webkit-line-clamp: 1");
    expect(name, "and says so rather than chopping mid-word").toContain("text-overflow: ellipsis");
  });

  it("is a fixed band rather than however tall its contents are", () => {
    expect(rule(".action-card .card__plate")).toContain("height: var(--plate-h)");
  });

  it("publishes that height for the arrow to read", () => {
    expect(rule(".action-card {")).toContain("--plate-h:");
  });
});

describe("the arrow that spends the card", () => {
  it("is positioned from the plate's height, not from a percentage", () => {
    const use = rule(".action-card__use {");
    expect(use).toContain("bottom: calc(var(--plate-h)");
    expect(
      /bottom:\s*\d+%/.test(use),
      "a percentage is the bug: it knows nothing about the plate",
    ).toBe(false);
  });

  /*
   * The playground's held card is 46×60 (lab.css). Fixing the plate alone
   * took it from 31px buried to 15, because a 36px disc over a 36px plate
   * needs more card than that. A container query rather than another phone
   * breakpoint: what matters is the size of THIS card, and the same card is
   * 104×135 on a wide screen and wants the full-size arrow there.
   */
  it("shrinks itself on a card too small to hold it", () => {
    /*
     * The container is declared in lab.css, beside the three explicit sizes
     * `.lab__held` is given, because that sheet owns the class. Declaring it
     * next to the query would put one bare class in two stylesheets, which
     * collisions.test.ts catches — and did, on the first run of this.
     */
    const LAB = readFileSync(
      fileURLToPath(new URL("../lab.css", import.meta.url)),
      "utf8",
    );
    expect(LAB).toContain("container-type: size");
    expect(CSS).toContain("@container (max-height: 100px)");
    const small = CSS.slice(CSS.indexOf("@container (max-height: 100px)"));
    expect(small).toContain("--plate-h: 20px");
    expect(small).toContain("width: 26px");
  });

  it("gets the top row out of its way on that card", () => {
    // 46px of width, minus a badge at each end, leaves less than 26px of
    // middle — so on this one card the furniture goes and the control stays.
    const small = CSS.slice(CSS.indexOf("@container (max-height: 100px)"));
    expect(small).toContain(".action-card .card__top { display: none; }");
  });
});
