/**
 * **One match is paid once.**
 *
 * Or: *"I have some strange bug on my account — every match I get TWO
 * chests, and they have the same things in them, but they don't really add
 * up."*
 *
 * Two chests and a nacho count that moved once is the signature of one match
 * being reported twice, in parallel: `addNachos` on the server reads the
 * count, works out what is owed and writes it back, so two reports that
 * arrive together both read the old count, both decide a chest is owed, both
 * mint one, and both write the same new total.
 *
 * There is no DOM here to mount a battle screen twice in, so this reads the
 * source for the two halves of the guard. They are an ORDER rule and a
 * lifetime rule, which is exactly what a later tidy-up undoes by accident.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("./useMatch.ts", import.meta.url)), "utf8");

describe("reporting a match to the server", () => {
  it("happens behind a flag, before the call and not after", () => {
    const fn = SRC.slice(SRC.indexOf("const finishBattle"), SRC.indexOf("void reportSolo("));
    expect(fn, "the guard").toContain("if (reportedRef.current) return;");
    expect(fn, "and it is raised before the request leaves").toContain(
      "reportedRef.current = true;",
    );
  });

  /*
   * Set before the await, not inside the .then: two calls in the same tick
   * are the case being defended against, and a flag raised in a promise
   * callback is raised after both of them have already gone out.
   */
  it("raises the flag synchronously", () => {
    const i = SRC.indexOf("reportedRef.current = true;");
    const j = SRC.indexOf("void reportSolo(");
    expect(i).toBeGreaterThan(-1);
    expect(i, "the flag goes up first").toBeLessThan(j);
    expect(SRC.slice(i, j), "and nothing is awaited in between").not.toContain("await");
  });

  /* And a new match can be paid for. */
  it("is cleared when a match is cleared", () => {
    const fn = SRC.slice(SRC.indexOf("const clearMatch = useCallback"), SRC.indexOf("const startOnline"));
    expect(fn).toContain("reportedRef.current = false;");
  });

  it("only ever pays a real match", () => {
    const fn = SRC.slice(SRC.indexOf("const finishBattle"), SRC.indexOf("void reportSolo("));
    expect(fn, "not the playground, a lesson or the Amanda preview").toContain(
      "if (!boards || onlineRef.current || practice) return;",
    );
  });
});
