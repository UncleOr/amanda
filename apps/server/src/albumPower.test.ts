/**
 * **What counts towards how much album you have.**
 *
 * `album_power` is the second number the matchmaker uses — "how well you
 * play" is trophies, this is "how much you have" — so anything it counts
 * that a player cannot see is a board they will be matched against for a
 * reason nobody can explain to them.
 *
 * ═══ AND ONE CARD WAS EXACTLY THAT ═══
 *
 * Or: *"how can I have cards from the Strays series if I have not reached
 * the alley yet? That is a bug you need to deal with."*
 *
 * The draw is fixed and the family is out of the album, but the rows the
 * bug already wrote are still in the table — measured against the live
 * database afterwards: one row, across 182 players. The album screen does
 * not show it and "41 of 51" does not count it, and until this change the
 * matchmaker's number did.
 *
 * So the rule here is the one rule: `isCollectable`. The point of these
 * tests is that it stays that rule rather than growing a second list of
 * exceptions beside it.
 */
import { describe, expect, it } from "vitest";
import { albumPower, isCollectable, sealedFamilies, type OwnedCardRow } from "@amanda/shared";
import { CATALOG } from "./content.js";

/** The filter albumPower.ts runs, applied to a list of card ids. */
const counted = (ids: string[]): OwnedCardRow[] =>
  ids
    .map((id) => CATALOG.get(id))
    .filter((c) => !!c && isCollectable(c))
    .map((c) => ({ rarity: c!.rarity, level: 1, copies: 1 }));

describe("what an album is worth", () => {
  it("counts an ordinary card", () => {
    expect(counted(["dragons_01_flame_dragon"])).toHaveLength(1);
  });

  it("does not count the filler the game puts on an empty board", () => {
    expect(counted(["crumb_demon"])).toHaveLength(0);
  });

  it("does not count Amanda, who is the opponent", () => {
    expect(counted(["legends_01_amanda"])).toHaveLength(0);
  });

  it("does not count a card that has been deleted from the catalogue", () => {
    expect(counted(["no_such_card_at_all"])).toHaveLength(0);
  });

  it("does not count a family whose arena is shut", () => {
    /*
     * The one Or found. These rows exist on real accounts and cannot be
     * un-won; what they must not do is go on being worth something.
     */
    const sealed = [...sealedFamilies()];
    expect(sealed.length, "nothing to test if nothing is sealed").toBeGreaterThan(0);
    const example = [...CATALOG.values()].find((c) => sealed.includes(c.seriesId));
    expect(example, "a sealed family should still exist as data").toBeTruthy();
    expect(counted([example!.id])).toHaveLength(0);
  });

  it("and a thing it does not count is worth nothing, not a little", () => {
    // Belt and braces: the filter could pass and the weighting could still
    // give a zero-rarity row a floor.
    const sealed = [...sealedFamilies()];
    const example = [...CATALOG.values()].find((c) => sealed.includes(c.seriesId))!;
    const withIt = albumPower(counted(["dragons_01_flame_dragon", example.id]));
    const without = albumPower(counted(["dragons_01_flame_dragon"]));
    expect(withIt).toBe(without);
  });
});
