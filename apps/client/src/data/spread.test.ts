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
import { ROUND_THE_BACK, TARGETINGS, type Targeting } from "@amanda/shared";
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

/**
 * ═══ AND THE DIVERS, WHICH WERE A BUTTON THAT FOUND NOTHING ═══
 *
 * Or, 22 November 2026, having pressed the filter that had just been built
 * for him: *"I filtered by divers. I do not have a single card? So it
 * should be divers/diggers — and let there be plants (roots?) and giants
 * and so on that do the same thing, say 1 in every series. It is exactly
 * the same action, just with a different name according to the series."*
 *
 * The filter was right and the shelf was empty. Measured on the live
 * database that evening: the account holding 49 cards owned ZERO of the
 * three, and one player in the top eight owned any at all. Three cards
 * across ten families — rare, epic, and a common in the fourteenth series
 * — is a button that returns nothing for nearly everyone who presses it.
 *
 * ⚠ A RATCHET LIKE THE REST OF THIS FILE. It does not say which card in a
 * family should go round the back; it says the families that HAVE one keep
 * one, and that nobody is ever handed the wrong word for it.
 */
describe("going round the back is something most families can do", () => {
  const RTB = new Set<string>(ROUND_THE_BACK);
  const divers = LIVE.filter((c) => c.abilities.some((a) => RTB.has(a.type)));

  it("is on a card in every family big enough to spare one", () => {
    /*
     * Two of the ten are a single card each — the Demon King, who does not
     * move, and Amanda herself — and a family of one has no card to spare
     * without becoming a different card. Everything with a real shelf has
     * one, and this asks the CATALOGUE rather than the launch roster: a
     * family that has written its diver has written it, whether or not the
     * card has been let out of the gate yet.
     */
    const all = [...CATALOG.values()];
    for (const family of new Set(all.map((c) => c.seriesId))) {
      const shelf = all.filter((c) => c.seriesId === family);
      if (shelf.length < 3) continue;
      expect(
        shelf.some((c) => c.abilities.some((a) => RTB.has(a.type))),
        `nothing in "${family}" goes round the back — a whole family with no way past a front row`,
      ).toBe(true);
    }
  });

  it("is on the SHELF in almost every family, which is the part he pressed", () => {
    /*
     * ⚠ THE DISTINCTION THAT COST AN HOUR. A card can exist, be balanced,
     * have its art, and still be `launch: false` — held back for a content
     * update — and a held-back card cannot be won, so it is not on anybody's
     * shelf and not behind anybody's filter.
     *
     * That is exactly why the shelf was empty when Or pressed it: of the
     * three divers that existed, the plants' dandelion was held back, and
     * the other two were an epic and a rare.
     *
     * The one family still short is THE PLANTS, and not for want of a card:
     * the dandelion that burrows is written, drawn and waiting on a release
     * flag, and its only launched family member that moves is the creeping
     * vine — which is the tutorial opponent's whole board, including its
     * King. Giving the vine a way past the front row put four of three
     * hundred tutorial runs into a loss, which is the one thing a lesson
     * may never do, and the suite caught it. So the plants wait for the
     * flag rather than for a card that is wrong.
     */
    const families = new Set(LIVE.map((c) => c.seriesId));
    const withOne = [...families].filter((f) =>
      LIVE.some((c) => c.seriesId === f && c.abilities.some((a) => RTB.has(a.type))),
    );
    expect(withOne.length, `only ${withOne.join(", ")} can go round the back`).toBeGreaterThanOrEqual(7);
  });

  it("calls it digging on land and diving in water, never the other way", () => {
    /*
     * Or, cutting eight names back to two: *"make it either DIGGING for
     * the land ones or DIVING for the water ones."*
     *
     * ⚠ THE TRAP THIS CATCHES is the one the fallback creates. The card
     * editor digs by default and names only the families that live in
     * water, which is right for every family written so far and silently
     * wrong the day a second water family arrives: its cards would be
     * given "burrow", and a shark that DIGS is the exact thing the two
     * words exist to prevent.
     */
    const WATER = new Set(["sea"]);
    for (const c of divers) {
      const ability = c.abilities.find((a) => RTB.has(a.type))!;
      expect(
        ability.type,
        `${c.name.he} is a ${c.seriesId} card calling it "${ability.type}"`,
      ).toBe(WATER.has(c.seriesId) ? "dive" : "burrow");
    }
  });

  it("is a handful of cards and not half the game", () => {
    // It bypasses the whole board. One per family is a tactic; a shelf of
    // them is a game where the front row stopped mattering.
    expect(divers.length).toBeLessThanOrEqual(LIVE.length / 5);
  });
});
