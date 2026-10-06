import { describe, expect, it } from "vitest";
import { __testing } from "./useMatch";
import { CATALOG } from "../data/catalog";
import { DECK } from "@amanda/shared";

const { matchDeck, generateAiPlan } = __testing;

/*
 * "חפיסה זהה" — the same cards, both sides, no excuses.
 *
 * The mode is one promise and these are the ways it could quietly break it:
 * a deck that is not reproducible from its seed, a deck that leaks the
 * player's album into it, or a computer that builds out of its own cards
 * anyway. Each of those would leave the mode looking like it worked.
 */
describe("mirror mode", () => {
  it("the same seed deals exactly the same deck, in the same order", () => {
    expect(matchDeck(null, 12345)).toEqual(matchDeck(null, 12345));
  });

  it("different seeds deal different decks", () => {
    expect(matchDeck(null, 1)).not.toEqual(matchDeck(null, 2));
  });

  it("ignores the album — a deck built from what you own is not a shared deck", () => {
    const rich = new Map(
      [...CATALOG.keys()].slice(0, 3).map((id) => [id, { cardId: id, copies: 9, level: 9 }]),
    );
    const poor = new Map([
      [[...CATALOG.keys()][0]!, { cardId: [...CATALOG.keys()][0]!, copies: 1, level: 1 }],
    ]);
    expect(matchDeck(rich as never, 777)).toEqual(matchDeck(poor as never, 777));
  });

  it("still uses the album when there is no seed — ordinary matches are unchanged", () => {
    const only = [...CATALOG.keys()].slice(0, 4);
    const album = new Map(only.map((id) => [id, { cardId: id, copies: 2, level: 1 }]));
    const deck = matchDeck(album as never);
    const monsters = deck.filter((id) => CATALOG.has(id));
    expect(monsters.length).toBeGreaterThan(0);
    for (const id of monsters) expect(only).toContain(id);
  });

  it("deals a full deck", () => {
    const deck = matchDeck(null, 999);
    expect(deck.filter((id) => CATALOG.has(id)).length).toBe(DECK.size);
  });

  it("the computer builds out of the deck it was handed, and nothing else", () => {
    const deck = matchDeck(null, 4242);
    const monsters = new Set(deck.filter((id) => CATALOG.has(id)));
    for (const p of generateAiPlan(deck)) {
      expect(monsters.has(p.cardId)).toBe(true);
    }
  });

  it("…and without a deck it goes back to drawing its own", () => {
    const deck = matchDeck(null, 4242);
    const monsters = new Set(deck.filter((id) => CATALOG.has(id)));
    // Not a guarantee of difference on any single card, but across a whole
    // board an independent draw practically never lands inside the same 18.
    const independent = generateAiPlan();
    const outside = independent.filter((p) => !monsters.has(p.cardId));
    expect(outside.length).toBeGreaterThan(0);
  });
});
