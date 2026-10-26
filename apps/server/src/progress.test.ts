import { describe, expect, it } from "vitest";
import { CHESTS, rollChest } from "./progress.js";
import { CATALOG } from "./content.js";
import { ARENAS } from "@amanda/shared";

const TOP = 9999;
const at = (id: string) => ARENAS.find((a) => a.id === id)!;

/**
 * Chest contents are worth real things, so the rules are pinned here. None of
 * this touches a database — it is the rolling that matters.
 */
describe("chests", () => {
  it("gives the number of cards the chest promises", () => {
    for (const kind of Object.keys(CHESTS)) {
      const won = rollChest(TOP, kind);
      expect(won.cards.length, kind).toBe(CHESTS[kind]!.cards);
      expect(won.diamonds, kind).toBe(CHESTS[kind]!.diamonds);
    }
  });

  it("keeps the rarity it guarantees, every single time", () => {
    // A guarantee that holds "usually" is not a guarantee. Epic is a 5% draw,
    // so 300 rounds would catch a promise that is really just luck.
    for (const kind of ["silver", "gold"] as const) {
      const want = CHESTS[kind]!.guarantees!;
      for (let i = 0; i < 300; i++) {
        const rarities = rollChest(TOP, kind).cards.map((id) => CATALOG.get(id)?.rarity);
        expect(rarities, `${kind} promised ${want} and gave ${rarities.join()}`).toContain(want);
      }
    }
  });

  it("never hands out the filler card as a prize", () => {
    for (let i = 0; i < 200; i++) {
      for (const id of rollChest(TOP, "gold").cards) expect(id).not.toBe("crumb_demon");
    }
  });

  it("an unknown chest kind still gives something rather than nothing", () => {
    const won = rollChest(TOP, "not-a-chest");
    expect(won.cards.length).toBe(CHESTS.wood!.cards);
  });
});

/**
 * ═══ A CHEST CANNOT INTRODUCE YOU TO SOMEBODY YOU HAVE NOT MET ═══
 *
 * Or: *"how can I have cards from the Strays series if I have not reached
 * the alley yet? That is a bug you need to deal with."* And, in the same
 * message, the rule that makes it a bug rather than a surprise: *"at the
 * court we meet the Slimes. Only somebody who has reached the court for the
 * first time can get a slime card at all."*
 *
 * Six hundred cards is enough to catch a family that turns up at a few
 * percent; a single draw would pass on a bug that leaks one card in fifty.
 */
const drawn = (best: number, rounds = 200): Set<string> => {
  const out = new Set<string>();
  for (let i = 0; i < rounds; i++)
    for (const id of rollChest(best, "gold").cards) out.add(CATALOG.get(id)!.seriesId);
  return out;
};

describe("which families a chest may draw from", () => {
  it("gives a beginner only the four families the playroom has", () => {
    const families = drawn(0);
    expect([...families].sort()).toEqual(["dragons", "furries", "giants", "plants"]);
  });

  it("adds the slimes the moment the Court has been reached", () => {
    expect(drawn(at("court").from).has("slimes")).toBe(true);
    // And not before. A player one trophy short has not been there.
    expect(drawn(at("court").from - 1).has("slimes")).toBe(false);
  });

  it("adds the insects at the Station, and not at the Court", () => {
    expect(drawn(at("station").from).has("insects")).toBe(true);
    expect(drawn(at("court").from).has("insects")).toBe(false);
  });

  it("never gives a family whose arena is shut, to anybody", () => {
    // The Strays live in Fright Alley and Fright Alley is locked, so there
    // is no trophy count that unlocks them — which is the actual answer to
    // the bug Or found.
    expect(drawn(TOP, 400).has("strays")).toBe(false);
  });

  it("still draws from everything that IS open at the top", () => {
    expect([...drawn(TOP)].sort()).toEqual([
      "dragons",
      "furries",
      "giants",
      "insects",
      "plants",
      "slimes",
    ]);
  });
});
