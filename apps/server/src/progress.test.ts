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

  /*
   * ⚠ THIS USED TO POINT AT A LOCKED ARENA AND BROKE WHEN THERE WAS NONE.
   * Fright Alley was shut, so "a family whose arena is shut" had a live
   * example; Or unlocked it, and the assertion had nothing left to stand on.
   * It shuts a door itself now, which is what it should always have done —
   * the rule is permanent and the content is not.
   */
  it("never gives a family whose arena is shut, to anybody", () => {
    const arena = ARENAS.find((a) => a.introduces && a.from > 0)!;
    const before = arena.locked;
    arena.locked = true;
    try {
      expect(drawn(TOP, 400).has(arena.introduces!)).toBe(false);
    } finally {
      arena.locked = before;
    }
  });

  it("adds the machines at the Garage, and not at the Station", () => {
    // The first family in the game that is in nobody's starter album, so
    // this is the first rung where "here is where you meet them" is true.
    expect(drawn(at("garage").from).has("machines")).toBe(true);
    expect(drawn(at("station").from).has("machines")).toBe(false);
  });

  it("adds the sea dwellers at the Pool, and not at the Garage", () => {
    expect(drawn(at("pool").from).has("sea")).toBe(true);
    expect(drawn(at("garage").from).has("sea")).toBe(false);
  });

  it("still draws from everything that IS open at the top", () => {
    expect([...drawn(TOP)].sort()).toEqual([
      "demons",
      "dragons",
      "furries",
      "giants",
      "insects",
      "machines",
      "plants",
      "sea",
      "slimes",
    ]);
  });
});
