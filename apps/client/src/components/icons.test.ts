/**
 * **Buttons that are pictures still have names.**
 *
 * Or: *"swap words for icons wherever you can — binning a card, taking an
 * action card, challenges, playground, more modes. 'Play with a friend' and
 * 'play with a bot' do not need words either: put a play icon on a picture
 * of a friend or of a robot and it is understood. On the King's square you
 * do not need to write King — a crown image is enough, and not an emoji but
 * the game's own icon. FIGHT, FROM THE BIN, ACTION CARDS can all be icons.
 * Instead of REVEALED — an eye icon. Got the idea? Like that on
 * everything."*
 *
 * Every one of those had its icon ALREADY, sitting next to a word that said
 * the same thing. Taking the word out is a one-line change and it is the
 * easy half; the half that rots is what the word was quietly also doing.
 *
 *   A SCREEN READER needs a name, and a button whose only content is an
 *   `<svg aria-hidden>` has none at all.
 *
 *   THE TUTORIAL points at CSS selectors, and a lesson that says "bin it"
 *   rings a button it finds by class. That still works — but only because
 *   the classes were kept.
 *
 * So this file checks the thing a screenshot cannot: that every button that
 * lost its words kept its name.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const APP = read("../App.tsx");
const HOME = read("./HomeScreen.tsx");
const GRID = read("./BoardGrid.tsx");
const QUESTS = read("./Challenges.tsx");

/**
 * The opening tag of the JSX element this marker sits in.
 *
 * ⚠ The end of the tag is NOT the next ">". Every one of these buttons has
 * an `onClick={() => …}` in it, and a naive scan stops at that arrow — which
 * cut the tag in half and reported a missing title that was right there.
 * Depth-counting the braces skips anything inside an expression.
 */
function elementWith(src: string, marker: string): string {
  const at = src.indexOf(marker);
  expect(at, `not found: ${marker}`).toBeGreaterThan(-1);
  const open = src.lastIndexOf("<", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0 && i > open) return src.slice(open, i + 1);
  }
  return src.slice(open);
}

describe("a button whose words became a picture", () => {
  const cases: Array<[string, string, string]> = [
    // [what it is, the source it lives in, the marker that finds it]
    ["binning a card", APP, 'className="hand__discard"'],
    ["taking one back", APP, 'className="hand__bin"'],
    ["the fight button", APP, "btn-fight--icon"],
    ["the empty crown", GRID, 'className="slot__hint slot__hint--king"'],
    ["the challenges door", QUESTS, 'className="quests__open"'],
    ["more modes", HOME, 'className="btn-modes"'],
    ["the playground", HOME, 'className="btn-lab"'],
  ];

  for (const [what, src, marker] of cases) {
    it(`${what} still says what it is`, () => {
      const el = elementWith(src, marker);
      expect(el, "a title, for a mouse").toContain("title=");
      expect(el, "and an accessible name, for everybody else").toContain("aria-label=");
    });
  }

  it("the two ways to play are a picture and a play badge", () => {
    expect(HOME.match(/className="pick__go"/g) ?? [], "one on each card").toHaveLength(2);
    // The words are gone from the face of the card and kept on the button.
    const bot = elementWith(HOME, 'aria-label={t("s3bf0b5c"');
    expect(bot).toContain("title=");
  });

  it("the opponent's board says it is open with an eye", () => {
    const el = elementWith(APP, 'className="side__revealed"');
    expect(el).toContain("aria-label=");
    const after = APP.slice(APP.indexOf('className="side__revealed"'));
    expect(after.slice(0, 400), "and the eye is the icon").toContain('<Icon name="eye"');
  });

  it("no button was left with an icon and no name at all", () => {
    /*
     * The general version of every case above, and the one that catches the
     * NEXT word somebody deletes: a button whose entire content is an icon
     * and which carries neither a title nor an aria-label is a button a
     * screen reader announces as "button".
     */
    for (const src of [APP, HOME, GRID, QUESTS]) {
      for (const m of src.matchAll(/<button\b[^>]*>\s*(\{\/\*[\s\S]*?\*\/\}\s*)?<Icon\b[^>]*\/>\s*<\/button>/g)) {
        expect(m[0], m[0].slice(0, 120)).toMatch(/aria-label=|title=/);
      }
    }
  });
});
