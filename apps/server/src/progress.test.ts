import { describe, expect, it } from "vitest";
import { CHESTS, rollChest } from "./progress.js";
import { CATALOG } from "./content.js";

/**
 * Chest contents are worth real things, so the rules are pinned here. None of
 * this touches a database — it is the rolling that matters.
 */
describe("chests", () => {
  it("gives the number of cards the chest promises", () => {
    for (const kind of Object.keys(CHESTS)) {
      const won = rollChest(kind);
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
        const rarities = rollChest(kind).cards.map((id) => CATALOG.get(id)?.rarity);
        expect(rarities, `${kind} promised ${want} and gave ${rarities.join()}`).toContain(want);
      }
    }
  });

  it("never hands out the filler card as a prize", () => {
    for (let i = 0; i < 200; i++) {
      for (const id of rollChest("gold").cards) expect(id).not.toBe("crumb_demon");
    }
  });

  it("an unknown chest kind still gives something rather than nothing", () => {
    const won = rollChest("not-a-chest");
    expect(won.cards.length).toBe(CHESTS.wood!.cards);
  });
});
