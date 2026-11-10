/**
 * **Are the archetypes actually spread, or is most of the shelf one card?**
 *
 * Or: *"and confirming with you that all the abilities are spread so that I
 * have all sorts of interesting combinations across all the cards (sniper —
 * hunts the King, sniper — avenger, flying — avenger, walking — avenger and
 * so on)."*
 *
 * A fair question to ask and an unfair one to answer by reading the files,
 * so it is measured. What came back the first time it was run was worse than
 * it looks from the album:
 *
 *     targeting   lane 34 · king 5 · invader 5 · champion 3 · wallbreaker 3
 *                 sniperHunter 2 · avenger 1 · bodyguard 0
 *     range       melee 43 · ranged 9 · sniper 1
 *
 * Two thirds of the launched cards do the default thing, the AVENGER is one
 * card, and there is ONE SNIPER IN THE GAME. So three of the four
 * combinations he named by way of example are not thin — they are
 * arithmetically impossible: "sniper — avenger" needs a second sniper
 * before it can need anything else.
 *
 * ⚠ THIS FILE IS NOT A TARGET, IT IS A RATCHET. It does not say what the
 * spread should be — that is Or's, card by card. It says that the modes
 * which have been EARNED stay alive, so the next card edit cannot quietly
 * take the last avenger out of the game and leave a filter button that
 * finds nothing.
 */
import { describe, expect, it } from "vitest";
import { TARGETINGS, type Targeting } from "@amanda/shared";
import { CATALOG } from "./catalog";

const LIVE = [...CATALOG.values()].filter((c) => c.launch !== false);
const of = (t: Targeting) => LIVE.filter((c) => (c.targeting ?? "lane") === t);
const moves = (c: (typeof LIVE)[number]) =>
  c.flying ? (c.stats.moveSpeed > 0 ? "flies" : "hovers") : c.stats.moveSpeed > 0 ? "walks" : "still";

describe("every way of choosing a target is on a real card", () => {
  it("has at least one card, so no mode is a rule nobody plays", () => {
    for (const t of TARGETINGS) {
      expect(of(t).length, `nothing in the game is "${t}" — a dead mode and a dead filter`).toBeGreaterThan(0);
    }
  });

  it("is not all one card: the default does not own the whole shelf", () => {
    /*
     * 33 of 53 as this is written, which is why "straight ahead" is the one
     * mode with no button in the deck builder. If it ever climbs back over
     * three quarters, the modes have been quietly eaten.
     */
    const plain = of("lane").length / LIVE.length;
    expect(plain, `${Math.round(plain * 100)}% of the shelf just walks forwards`).toBeLessThan(0.75);
  });
});

describe("the combinations Or asked for by name", () => {
  /*
   * His four examples, as a table. Each one is a (targeting, shape) pair
   * that a player should be able to find a card for. The ones that do not
   * exist yet are listed as `false` rather than left out, so this file says
   * what is missing instead of only what is there.
   */
  const WANTED: ReadonlyArray<readonly [string, Targeting, string, boolean]> = [
    ["sniper that hunts the King", "king", "sniper", true],
    ["bodyguard at close range", "bodyguard", "melee", true],
    ["bodyguard with a sniper's reach", "bodyguard", "sniper", true],
    ["avenger in the air", "avenger", "melee", true],
    /*
     * ⚠ THIS LINE WAS `false` FOR ONE DAY, and it is the whole reason the
     * table is written as a table. "Sniper — avenger" needed a second
     * sniper before it could need anything else; the Mother Machine is it,
     * and she is the avenger as well — a turret that does not start fights
     * and finishes them.
     */
    ["sniper that avenges", "avenger", "sniper", true],
  ];

  for (const [what, targeting, range, should] of WANTED) {
    it(`${should ? "exists" : "is still missing"}: ${what}`, () => {
      const found = of(targeting).some((c) => c.stats.range === range);
      expect(found, should ? "this combination went away" : "this exists now — tick it to true").toBe(
        should,
      );
    });
  }

  it("has an avenger in the air and one standing still, and not yet one that walks", () => {
    const shapes = new Set(of("avenger").map(moves));
    expect(shapes.has("flies"), "the flying avenger went away").toBe(true);
    expect(shapes.has("still"), "the standing avenger went away").toBe(true);
    /*
     * ⚠ THE ONE OF OR'S FOUR EXAMPLES THAT IS STILL MISSING, and it is
     * missing on purpose. The Stone Colossus was going to be it — it
     * already returns damage, and measured it cost nothing: zero winners
     * changed in six hundred battles. He took it off the list for a reason
     * that has nothing to do with balance:
     *
     *   *"except the Stone Colossus, which should be the most ordinary
     *   giant there is: he walks and he kills the King."*
     *
     * Which is a description of the DEFAULT, and the default already does
     * it — a lane card whose lane has been cleared falls through to hunting
     * the crown (see pickTarget). Giving him a mode would have put the
     * plainest card in the game into an archetype filter.
     *
     * So this records a gap rather than a wish, and it stays until Or
     * names the card.
     */
    expect(shapes.has("walks"), "there is a walking avenger now — tick this over").toBe(false);
  });
});
