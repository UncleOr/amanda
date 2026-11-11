/**
 * **Every square a lesson points at has to exist.**
 *
 * Or: *"tutorial stage 3 gets stuck in the middle and does not explain
 * action cards."*
 *
 * ═══ ONE DELETED BUTTON, FIVE STRANDED STEPS ═══
 *
 * Five steps across the three lessons pointed at `.take-action` — a button
 * that was removed when the action card in your hand BECAME the button.
 * icons.test.ts holds the removal (*"is gone from the hand as a separate
 * button"*), so one test guarded that the thing was gone while five tutorial
 * steps went on waiting for it.
 *
 * And a scripted step is `patient`: it waits for its target however long that
 * takes rather than skipping, which is right — the opening lines are spoken
 * before the board is painted — and is exactly what turns a dead selector
 * into a lesson that stops dead. Everything from "take the x-ray" onwards was
 * unreachable, which is the whole of the part that explains action cards.
 *
 * ⚠ THE FAILURE IS INVISIBLE FROM A DESK. Nothing throws, nothing logs, the
 * ring simply never appears and Amanda goes quiet — and the only way to find
 * it is to walk the lesson, which is what Or did. So it is checked here
 * instead: a class a lesson names must be a class the app writes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCRIPTS } from "./lessonScript";

/* fileURLToPath, not .pathname: this repository lives under a Hebrew
   directory name and a URL percent-encodes it. */
const SRC = fileURLToPath(new URL("..", import.meta.url));

/** Every .tsx in the app, as one string. Where class names are written. */
function allMarkup(dir: string): string {
  let out = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out += allMarkup(full);
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test."))
      out += readFileSync(full, "utf8");
  }
  return out;
}
const MARKUP = allMarkup(SRC);

/** The bare class names in a selector. Attribute parts are left alone. */
const classesIn = (selector: string): string[] =>
  [...selector.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]!);

describe("what a lesson points at", () => {
  for (const [stage, steps] of Object.entries(SCRIPTS)) {
    it(`stage ${stage} names only classes the game actually writes`, () => {
      for (const step of steps) {
        if (!step.target) continue;
        for (const cls of classesIn(step.target)) {
          expect(
            MARKUP.includes(cls),
            `${step.id} points at ".${cls}", which no component writes — that step waits for ever`,
          ).toBe(true);
        }
      }
    });
  }

  it("still knows where the action card's own button is", () => {
    /*
     * The specific one that broke, named rather than left to the sweep
     * above: if the control is renamed again, this says which lesson lines
     * go quiet, and the sweep says only that something did.
     */
    const takes = Object.values(SCRIPTS)
      .flat()
      .filter((s) => s.awaits?.kind === "action" && s.awaits.where === "bar");
    expect(takes.length, "no lesson takes an action card any more").toBeGreaterThan(0);
    for (const step of takes)
      expect(step.target, `${step.id} does not point at the card's own button`).toBe(
        ".hand .action-card__use",
      );
  });

  it("has a step that explains action cards in the stage Or walks", () => {
    /*
     * Stage three is the one with the action cards in it, and the complaint
     * was that it never got there. Two of them: take the x-ray, then use it.
     */
    const three = SCRIPTS[3]!;
    expect(three.some((s) => s.awaits?.kind === "action" && s.awaits.id === "xray")).toBe(true);
    expect(three.some((s) => s.awaits?.kind === "action" && s.awaits.id === "energy_boost")).toBe(
      true,
    );
  });
});
