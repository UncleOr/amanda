import { describe, expect, it } from "vitest";
import {
  DECK_RULES,
  deckBudget,
  autoDeck,
  canAdd,
  cardCost,
  deckCost,
  deckFaults,
  deckIsLegal,
  STARTER_ALBUM,
} from "@amanda/shared";
import { CATALOG, collectable } from "../data/catalog";

/*
 * The deck rules, against the real cards.
 *
 * The two numbers Or approved are 16 and 55, and the whole point of them is
 * that they bind — so these tests are mostly about the two players at the
 * ends of the range: a child who installed the game an hour ago, and
 * somebody with everything.
 */

const of = (id: string) => CATALOG.get(id);
const all = () => collectable().map((c) => c.id);

/*
 * What the database hands a brand-new player.
 *
 * Read from shared rather than written out again: it was a second copy of
 * the list in grant_starter_album, and the day the album grew by two cards
 * this file would have gone on measuring the old one. starterAlbum.test.ts
 * checks that list against the migration itself.
 */
const STARTER = [...STARTER_ALBUM];

const deck = (cards: string[], name = "שלי") => ({ name, cards });

describe("the rules", () => {
  it("wants exactly sixteen", () => {
    expect(deckFaults(deck(autoDeck(all(), of).slice(0, 15)), of)).toContainEqual({
      kind: "tooFew",
      have: 15,
    });
    const seventeen = [...autoDeck(all(), of), "plants_01_thorn_sprout"];
    expect(deckFaults(deck(seventeen), of).some((f) => f.kind === "tooMany")).toBe(true);
  });

  it("refuses a deck with no name", () => {
    expect(deckFaults(deck(autoDeck(all(), of), "  "), of)).toContainEqual({ kind: "noName" });
  });

  it("refuses a fourth copy of the same card", () => {
    const four = Array(4).fill("plants_01_thorn_sprout");
    const rest = autoDeck(all(), of).slice(0, 12);
    const faults = deckFaults(deck([...four, ...rest]), of);
    expect(faults.some((f) => f.kind === "tooManyCopies")).toBe(true);
  });

  it("refuses a card that is not in the game", () => {
    const faults = deckFaults(deck([...autoDeck(all(), of).slice(0, 15), "not_a_card"]), of);
    expect(faults).toContainEqual({ kind: "unknownCard", cardId: "not_a_card" });
  });
});

describe("the budget", () => {
  /*
   * The whole reason the budget exists. Sixteen of the dearest cards is 80,
   * and 55 has to stop it.
   */
  it("stops a deck of nothing but the strongest", () => {
    const dearest = collectable()
      .slice()
      .sort((a, b) => cardCost(b) - cardCost(a))
      .slice(0, 6)
      .map((c) => c.id);
    const greedy = [...dearest, ...dearest, ...dearest].slice(0, DECK_RULES.size);
    expect(deckCost(greedy, of)).toBeGreaterThan(DECK_RULES.budget);
    expect(deckIsLegal(deck(greedy), of)).toBe(false);
  });

  /*
   * ═══ THE BUDGET IS A TRADE, NOT A WALL ═══
   *
   * This used to assert an arithmetic: nine cards at the top price plus
   * seven cheap ones, which fits in 55 and not in 47. Then the deck went
   * from sixteen cards to eighteen and the budget from 50 to 60, and it
   * failed for a reason that had nothing to do with what it is for.
   *
   * What it is FOR is that the budget bites and does not strangle: you can
   * have some of your best cards and not all of them. So it works out where
   * the line actually falls today and checks that the line is somewhere
   * sensible, which stays true the next time Or moves either number.
   */
  it("lets you have some of your best cards, and not a deck of them", () => {
    const sorted = collectable().slice().sort((a, b) => cardCost(b) - cardCost(a));
    const top = cardCost(sorted[0]!);
    const dear = sorted.filter((c) => cardCost(c) === top).map((c) => c.id);
    const cheapest = cardCost(sorted[sorted.length - 1]!);
    const cheap = sorted.filter((c) => cardCost(c) === cheapest).map((c) => c.id);

    /** A legal-shaped deck with k of the dearest cards and cheap ones after. */
    const mix = (k: number) => {
      const out: string[] = [];
      for (let n = 0; n < DECK_RULES.maxCopies && out.length < k; n++)
        for (const id of dear) if (out.length < k) out.push(id);
      for (let n = 0; n < DECK_RULES.maxCopies && out.length < DECK_RULES.size; n++)
        for (const id of cheap) if (out.length < DECK_RULES.size) out.push(id);
      return out;
    };

    let most = 0;
    for (let k = 0; k <= DECK_RULES.size; k++) {
      const d = mix(k);
      if (d.length === DECK_RULES.size && deckCost(d, of) <= deckBudget()) most = k;
    }
    expect(most, "some of the good ones have to fit, or the budget is a wall").toBeGreaterThan(2);
    expect(most, "and not all of them, or it is not a budget").toBeLessThan(DECK_RULES.size);
  });

  it("will not let you add a card you cannot afford", () => {
    const sorted = collectable().slice().sort((a, b) => cardCost(b) - cardCost(a));
    const dear = sorted[0]!;
    const chosen: string[] = [];
    let spent = 0;
    // Fill up to just under the budget with the dearest card, three at a time.
    for (const c of sorted) {
      for (let k = 0; k < DECK_RULES.maxCopies; k++) {
        if (!canAdd(c.id, c, chosen, spent)) continue;
        chosen.push(c.id);
        spent += cardCost(c);
      }
    }
    expect(spent).toBeLessThanOrEqual(DECK_RULES.budget);
    expect(canAdd(dear.id, dear, chosen, spent)).toBe(false);
  });
});

describe("a brand-new player", () => {
  /*
   * The calibration that set the budget at 55 rather than 47. His six cards
   * price at 4+5+4+2+1+3 and the cheapest sixteen he can assemble from them
   * is 50 — a fairer budget would have told him his deck was illegal before
   * he had played a match.
   */
  it("can build a legal deck out of the starter six", () => {
    const built = autoDeck(STARTER, of);
    expect(built).toHaveLength(DECK_RULES.size);
    expect(deckIsLegal(deck(built), of)).toBe(true);
    expect(deckCost(built, of)).toBeLessThanOrEqual(DECK_RULES.budget);
  });

  it("uses all six rather than three of two", () => {
    const built = autoDeck(STARTER, of);
    expect(new Set(built).size).toBe(STARTER.length);
  });
});

describe("the automatic deck", () => {
  it("fills sixteen legal slots from the whole collection", () => {
    const built = autoDeck(all(), of);
    expect(built).toHaveLength(DECK_RULES.size);
    expect(deckIsLegal(deck(built), of)).toBe(true);
  });

  it("does not repeat a card when the album is wide enough not to", () => {
    expect(new Set(autoDeck(all(), of)).size).toBe(DECK_RULES.size);
  });

  it("gives an empty deck rather than a broken one when there is nothing to use", () => {
    expect(autoDeck([], of)).toEqual([]);
  });
});
