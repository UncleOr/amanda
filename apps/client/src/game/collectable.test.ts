import { describe, expect, it } from "vitest";
import { AMANDA_CARD, collectableCards, isCollectable, UNCOLLECTABLE } from "@amanda/shared";
import { collectable, collectableBySeries } from "../data/catalog";

/*
 * Two cards are not prizes, and three different places used to decide that
 * for themselves. These pin the one rule they all ask now.
 */

const card = (id: string, seriesId: string) => ({ id, seriesId });

describe("what can be won", () => {
  it("includes an ordinary monster", () => {
    expect(isCollectable(card("dragons_04_x", "dragons"))).toBe(true);
  });

  it("excludes the filler the clock puts on your board", () => {
    expect(isCollectable(card("crumb_demon", "system"))).toBe(false);
  });

  /*
   * Or: *"right now Amanda cannot be won (and certainly cannot be played)."*
   * She was in the chest pool and in the album's total, which is why the
   * album could never reach its own maximum.
   */
  it("excludes Amanda, who is the opponent", () => {
    expect(isCollectable(card(AMANDA_CARD, "legends"))).toBe(false);
  });

  it("names her by the same id amandaBoard does", () => {
    // Written out in collectable.ts rather than imported, to keep the two
    // modules from importing each other. If that constant ever moves, this
    // is what notices.
    expect(UNCOLLECTABLE.has(AMANDA_CARD)).toBe(true);
  });

  it("excludes anything else synthesised into the system series", () => {
    expect(isCollectable(card("some_future_filler", "system"))).toBe(false);
  });
});

describe("the whole album", () => {
  it("is the catalog minus the two that are not prizes", () => {
    const catalog = [
      card("dragons_01_x", "dragons"),
      card("plants_01_x", "plants"),
      card("crumb_demon", "system"),
      card(AMANDA_CARD, "legends"),
    ];
    expect(collectableCards(catalog).map((c) => c.id)).toEqual([
      "dragons_01_x",
      "plants_01_x",
    ]);
  });
});

describe("against the real card data", () => {
  /*
   * Deliberately no number in here. "51" would be right today and wrong the
   * next time Or draws a card, and a test that has to be edited every time
   * content is added is a test people learn to edit without reading. These
   * assert the INVARIANT instead: that the two counts the game shows cannot
   * disagree, and that a family with nothing winnable in it counts as none.
   */
  it("counts the same album twice and gets the same answer", () => {
    const sizes = collectableBySeries();
    const total = [...sizes.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(collectable().length);
  });

  it("has nothing to win on the legends shelf while Amanda is the opponent", () => {
    expect(collectableBySeries().get("legends")).toBe(0);
  });

  it("leaves every other family alone", () => {
    for (const [id, n] of collectableBySeries()) {
      if (id !== "legends") expect(n).toBeGreaterThan(0);
    }
  });
});
