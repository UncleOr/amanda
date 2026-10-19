import { describe, expect, it } from "vitest";
import { ACTION_DECK_COUNT, ACTIONS, PASSIVE_ACTIONS } from "../data/catalog";
import { DECK_RULES } from "@amanda/shared";
import { __testing } from "./useMatch";

/**
 * A Fill card drops a whole formation onto the board at once. Drawing one
 * should feel like luck — picking the four action cards at random from the
 * whole list put 1.8 of them in an average deck, and sometimes four.
 */
describe("the action cards in a match deck", () => {
  const decks = Array.from({ length: 400 }, () => __testing.matchDeck());
  const fillCounts = decks.map(
    (d) => d.filter((id) => (PASSIVE_ACTIONS as readonly string[]).includes(id)).length,
  );

  it("never holds more than one Fill card", () => {
    expect(Math.max(...fillCounts)).toBeLessThanOrEqual(1);
  });

  it("often holds none at all", () => {
    const without = fillCounts.filter((n) => n === 0).length;
    expect(without).toBeGreaterThan(decks.length * 0.3);
    expect(without).toBeLessThan(decks.length * 0.7);
  });

  /*
   * Or set the shape of a match deck: *"only 15 (+5 action cards) reach the
   * match deck. That means 3 cards you put in the deck don't arrive, and
   * you have 2 action cards to bin and 2 monsters to bin."* Read from the
   * constants, because the next tuning pass moves them and this test is
   * about the deal being WHOLE, not about fifteen.
   */
  it("deals the action cards and the monsters it is meant to", () => {
    for (const deck of decks) {
      const actions = deck.filter((id) => ACTIONS.has(id));
      expect(actions).toHaveLength(ACTION_DECK_COUNT);
      expect(deck).toHaveLength(DECK_RULES.dealt + ACTION_DECK_COUNT);
      // no duplicate action cards in one deck
      expect(new Set(actions).size).toBe(actions.length);
    }
  });
});
