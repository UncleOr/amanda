/**
 * **Flying is forwards. Hovering is on the spot.**
 *
 * Or, after an evening on what the Typhoon Dragon's card says: *"just call it
 * hovering instead of flying. In English too. Flying is forwards, hovering is
 * in place."*
 *
 * The card said תנועה: מעופף, במקום — "movement: flying, in place" — which is
 * a contradiction in two words, and he is the one who writes the words. One
 * flag in the data still, but two words on the screen, and which one a card
 * gets is decided by the only thing a player can actually see: whether it
 * ever moves.
 *
 * What this holds is that the split is made in ONE place and that every
 * screen asks it, because the way this goes wrong is four screens each
 * deciding for themselves and one of them being forgotten.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hovers } from "@amanda/shared";
import { CATALOG } from "../data/catalog";
import englishCatalogue from "../../../../data/copy.en.json";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const EN = englishCatalogue as Record<string, string | string[]>;

describe("the one question behind the two words", () => {
  it("is flying with nowhere to go, and nothing else", () => {
    expect(hovers({ flying: true, stats: { moveSpeed: 0 } } as never)).toBe(true);
    // Flying AND moving is the other word.
    expect(hovers({ flying: true, stats: { moveSpeed: 1.5 } } as never)).toBe(false);
    // And a card on the ground is neither, however still it stands.
    expect(hovers({ flying: false, stats: { moveSpeed: 0 } } as never)).toBe(false);
  });

  it("is five real cards, and they are the ones Or was looking at", () => {
    /*
     * Read off the catalogue rather than written down, so a card that joins
     * them — or one that is given a speed — shows up here rather than in a
     * screenshot. The Typhoon Dragon is the one that started it.
     */
    const hovering = [...CATALOG.values()].filter((c) => hovers(c)).map((c) => c.id);
    expect(hovering).toContain("dragons_09_typhoon_dragon");
    expect(hovering.sort()).toEqual([
      "dragons_03_thunderwing",
      "dragons_09_typhoon_dragon",
      "dragons_10_sky_king",
      "insects_10_insect_empress",
      "slimes_07_floating_brain",
    ]);
  });
});

describe("every screen that says the word", () => {
  /*
   * Four places a player meets it, and they must all ask the same question.
   * Written as a list because the failure mode is one of them being missed:
   * a card badged מרחף in the detail panel and מעופף on its own face is the
   * same contradiction in a new spelling.
   */
  const SCREENS: ReadonlyArray<readonly [string, string]> = [
    ["../components/CardDetailModal.tsx", "the badge and the movement row"],
    ["../components/CardView.tsx", "the icon on the card face"],
    ["./coach.ts", "what Amanda says about a card in your hand"],
  ];

  for (const [file, what] of SCREENS) {
    it(`asks it rather than deciding for itself — ${what}`, () => {
      const src = read(file);
      expect(src, `${file} says מעופף without asking`).toContain("hovers(");
      /*
       * ⚠ AND NOT A HAND-ROLLED COPY OF THE PREDICATE. `flying && moveSpeed
       * === 0` written out here is what makes the five screens drift apart
       * the day the rule gains a third case.
       */
      expect(src, `${file} rolls its own`).not.toMatch(/flying\s*&&\s*[\w.]*stats\.moveSpeed/);
    });
  }

  it("and the admin panel can set it, which it could not", () => {
    /*
     * The hole the ask uncovered. "מעופף" wrote a moveSpeed as well as the
     * flag and "נייח" wrote a zero and took the flag off, so the one
     * combination that is five real cards was the one combination this panel
     * could not make. Opening the Typhoon Dragon and pressing either button
     * would have turned him into a different card, silently.
     */
    const src = read("../components/CardEditor.tsx");
    expect(src).toContain('{ id: "hovers", he: "מרחף"');
    expect(src).toContain('flying: to === "flies" || to === "hovers"');
    expect(src).toContain('moveSpeed: to === "still" || to === "hovers" ? 0 : speed');
  });
});

describe("and it is both languages, because he asked for both", () => {
  it("says Hovers in English wherever it says מרחף in Hebrew", () => {
    /*
     * Or: *"in English too."* The Hebrew is a literal in the component and
     * the English is looked up by the same id (see game/copy.ts), so a new
     * Hebrew string with no English row is a card that reads מרחף for him
     * and nothing at all for an English player — which is the exact shape of
     * the 193 strings still waiting, and the reason this is checked rather
     * than assumed.
     */
    const ids = new Set<string>();
    for (const file of [
      "../components/CardDetailModal.tsx",
      "../components/CardView.tsx",
      "./coach.ts",
    ]) {
      for (const m of read(file).matchAll(/\bt\(\s*"([a-z][0-9a-f]{7})",\s*"([^"]*מרחף[^"]*)"/g)) {
        ids.add(m[1]!);
      }
    }
    // Four: the badge and the movement row on the detail panel, the title on
    // the card face, and Amanda's line in the tutorial.
    expect(ids.size, "no hovering strings found — did the wording change?").toBe(4);
    for (const id of ids) {
      const en = EN[id];
      expect(en, `${id} says מרחף and has no English`).toBeDefined();
      expect(String(en).toLowerCase(), `${id} is not about hovering`).toContain("hover");
    }
  });
});
