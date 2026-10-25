/**
 * **Hebrew drawn into a canvas, and a button that means one press.**
 *
 * Two rules that live in Arena.tsx and useMatch.ts, both found by Or playing
 * and both invisible from the code unless you already know to look.
 *
 * ═══ THE CANVAS DOES NOT KNOW WHICH WAY HEBREW RUNS ═══
 *
 * Or: *"it said THE KING IS DEAD and the exclamation mark was at the
 * beginning. Do not forget RTL in Hebrew."*
 *
 * A canvas lays text out with the Unicode bidi algorithm, which has to be
 * told which way the PARAGRAPH runs; the default is left-to-right. Under
 * those rules a trailing "!" is a neutral at the end of the line, and in a
 * line that reads right-to-left that is the left end — where a Hebrew
 * sentence starts.
 *
 * The rest of the app never shows this because the document is `dir="rtl"`.
 * A canvas inherits none of that, so every Hebrew string drawn into one has
 * to say so for itself. The next person to add one will not know, which is
 * what this test is for.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ARENA = readFileSync(fileURLToPath(new URL("./Arena.tsx", import.meta.url)), "utf8");
const MATCH = readFileSync(
  fileURLToPath(new URL("../game/useMatch.ts", import.meta.url)),
  "utf8",
);

describe("text drawn into the arena", () => {
  /**
   * Read out of the source as numbers rather than matched as text, because
   * the source holds the ESCAPE \u2014 a backslash, a u, four digits \u2014 and a test
   * written with the character itself passes on an empty file.
   */
  const codePointOf = (name: string): number | null => {
    const key = name + ' = "';
    const at = ARENA.indexOf(key);
    if (at < 0) return null;
    // Exactly the six characters of an escape: a backslash, a u, four digits.
    const esc = ARENA.slice(at + key.length, at + key.length + 6);
    return esc.startsWith("\\u") ? parseInt(esc.slice(2), 16) : null;
  };

  it("has a right-to-left isolate to wrap it in", () => {
    // U+2067 opens an isolate and U+2069 closes it. An ISOLATE rather than an
    // embedding, so a Latin word inside cannot leak its direction outward
    // into whatever is drawn beside it.
    expect(codePointOf("RTL_ISOLATE")).toBe(0x2067);
    expect(codePointOf("POP_ISOLATE")).toBe(0x2069);
  });

  /*
   * Every `new Text({ text: ... })` whose content can be Hebrew. Numbers are
   * deliberately NOT wrapped — a damage floater reads "-250" in any language
   * and forcing it right-to-left would move the minus sign.
   */
  it("wraps every string that can be Hebrew", () => {
    /*
     * `new Text({` … `text:` — with whatever stands between them.
     *
     * What stands between them is usually a COMMENT, and the pattern used to
     * allow only whitespace, so the two Texts that explain themselves were
     * the two this test never read. Both happen to be correct; the point is
     * that writing a line of explanation above `text:` quietly excused the
     * string below it from the only rule this file exists to enforce.
     */
    const texts = [
      ...ARENA.matchAll(/new Text\(\{(?:\s*\/\/[^\n]*|\s*\/\*[\s\S]*?\*\/|\s)*text:\s*([^,\n]+)/g),
    ].map((m) => m[1]!.trim());
    /*
     * The guard used to be `toBeGreaterThan(3)`, which is a number that goes
     * stale: deleting the verdict caption from the ending took the count to
     * exactly 3 and failed a test that had found nothing wrong. Worse, it
     * would have passed while the regex matched four calls out of seven.
     *
     * Counting the `new Text(` in the file and demanding the SAME number
     * fails for the thing actually worth failing for — a Text the pattern
     * cannot see — and never for one more or one fewer.
     */
    const declared = [...ARENA.matchAll(/new Text\(/g)].length;
    expect(declared, "no Text calls found at all — did the shape change?").toBeGreaterThan(0);
    expect(texts.length, "a `new Text(` the pattern could not read — check its shape").toBe(
      declared,
    );

    for (const expr of texts) {
      // A template of digits, or an empty string, needs no direction.
      if (/^`?-?\$\{|^""$/.test(expr)) continue;
      expect(expr, `${expr} is drawn without rtl() — a canvas will lay it out left-to-right`)
        .toContain("rtl(");
    }
  });
});

/**
 * ═══ ONE PRESS ═══
 *
 * Or: *"in all the tutorials you have to press 'start battle' twice and it
 * is strange. Once is enough."*
 *
 * The lesson's fight button used to step the phases — build to panic on the
 * first press, the battle on the second — because a lesson has no clock and
 * that was how the old lesson two reached the panic phase at all. So Amanda
 * said "press start battle", the player pressed, and the button was still
 * there.
 *
 * Reaching panic is a thing a STEP asks for now. This is the rule that keeps
 * the two apart, because the tempting fix next time is to put the branch
 * back.
 */
describe("the fight button in a lesson", () => {
  it("goes straight to the battle, without asking the lesson", () => {
    const line = MATCH.slice(MATCH.indexOf("toBattle: playground"));
    const decl = line.slice(0, line.indexOf("\n"));
    expect(decl, "toBattle branches on the lesson again — that is the second press").not.toMatch(
      /lesson\s*>\s*0/,
    );
  });

  it("leaves a separate door to the panic phase", () => {
    expect(MATCH).toContain("const toPanic");
    expect(MATCH).toMatch(/toPanic:\s*\(\)\s*=>\s*void;/);
  });
});
