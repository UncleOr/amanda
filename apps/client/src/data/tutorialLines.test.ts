import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TUTORIAL_LINES, line, setTutorialOverrides } from "./tutorialLines";

/**
 * The braces are the part that fails quietly.
 *
 * `line()` replaces an unfilled slot with nothing rather than throwing, which
 * is right — an admin who deletes a brace should get a shorter sentence, not a
 * child staring at a crash. The cost is that a TYPO is also a shorter
 * sentence: `{crad}` does not raise anything, it just evaporates, and the line
 * reads "here's the first card — . it's thick." on somebody's first match.
 *
 * So the slots are checked here instead, in both directions.
 */
const coach = readFileSync(fileURLToPath(new URL("../game/coach.ts", import.meta.url)), "utf8");
const SLOT = /\{(\w+)\}/g;

describe("the tutorial's lines", () => {
  it("declares every slot its own text uses", () => {
    for (const l of TUTORIAL_LINES) {
      const used = [...l.he.matchAll(SLOT)].map((m) => m[1]!);
      for (const slot of used) expect(l.vars, `${l.id} uses {${slot}}`).toContain(slot);
    }
  });

  it("uses every slot it declares", () => {
    for (const l of TUTORIAL_LINES) {
      const used = new Set([...l.he.matchAll(SLOT)].map((m) => m[1]!));
      for (const v of l.vars) expect([...used], `${l.id} declares {${v}}`).toContain(v);
    }
  });

  it("has no two lines under one id", () => {
    const ids = TUTORIAL_LINES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /*
   * Every id the coach asks for has to exist here, or it says nothing at all
   * — `line()` returns "" for an unknown id and the step is drawn empty.
   */
  it("covers every id the coach asks for", () => {
    const asked = [...coach.matchAll(/\bline\("([\w-]+)"/g)].map((m) => m[1]!);
    expect(asked.length).toBeGreaterThan(5);
    const known = new Set(TUTORIAL_LINES.map((l) => l.id));
    for (const id of asked) expect(known, `coach.ts asks for "${id}"`).toContain(id);
  });

  it("fills the slots it is given and drops the ones it is not", () => {
    expect(line("tank", { card: "גולם אבן" })).toContain("גולם אבן");
    // A missing value leaves a sentence, not a brace.
    expect(line("tank")).not.toContain("{");
  });

  it("prefers an override, and forgets it when the row goes", () => {
    setTutorialOverrides([{ id: "king", he: "עכשיו שים מלך." }]);
    expect(line("king")).toBe("עכשיו שים מלך.");
    setTutorialOverrides([]);
    expect(line("king")).toBe(TUTORIAL_LINES.find((l) => l.id === "king")!.he);
  });

  it("ignores an override that is only whitespace", () => {
    setTutorialOverrides([{ id: "king", he: "   " }]);
    expect(line("king")).toBe(TUTORIAL_LINES.find((l) => l.id === "king")!.he);
    setTutorialOverrides([]);
  });
});
