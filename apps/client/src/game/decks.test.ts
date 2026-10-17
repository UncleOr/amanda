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

/** What the database hands a brand-new player (db/migrations, grant_starter_album). */
const STARTER = [
  "furries_01_chuppy",
  "dragons_01_flame_dragon",
  "giants_01_stone_colossus",
  "insects_01_ant_soldier",
  "plants_01_thorn_sprout",
  "slimes_01_basic_slime",
];

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
   * The budget is a trade, not a wall, and this is the size of the trade.
   *
   * It used to assert NINE of the top price plus seven cheap ones, which fit
   * in 55 and is the deck Or called "too easy". At 47 that costs 52 and does
   * not fit — which is the whole point of moving it — so the test moves to
   * the number that is now true: SIX at the top price and ten cheap ones is
   * 40, and still leaves change.
   */
  it("allows six of your best and ten cheap ones, but not nine", () => {
    const sorted = collectable().slice().sort((a, b) => cardCost(b) - cardCost(a));
    const best = sorted.filter((c) => cardCost(c) === 5).slice(0, 2).map((c) => c.id);
    const cheap = sorted.filter((c) => cardCost(c) === 1).map((c) => c.id);
    // two cards at 5, three times over = six at the top price
    const six = [...best, ...best, ...best];
    expect(six).toHaveLength(6);
    expect(deckCost([...six, ...cheap.slice(0, 10)], of)).toBeLessThanOrEqual(deckBudget());

    // And nine of them no longer fits, which is the change Or asked for.
    const three = sorted.filter((c) => cardCost(c) === 5).slice(0, 3).map((c) => c.id);
    const nine = [...three, ...three, ...three];
    expect(deckCost([...nine, ...cheap.slice(0, 7)], of)).toBeGreaterThan(deckBudget());
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
