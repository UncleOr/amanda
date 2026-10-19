/**
 * **Eighteen chosen, fifteen dealt.**
 *
 * Or: *"18 cards in a deck. Only 15 (+5 action cards) reach the match deck.
 * That means 3 cards you put in the deck don't arrive. That means you have 2
 * action cards to bin and 2 monsters to bin — unless you put a fill card in,
 * and then you can bin more."*
 *
 * And before it, the reason: *"there needs to be some number of cards that
 * are in your deck and don't actually reach the match — so that if you put
 * in only Mother Tree and she's your one card with a lot of health, there's
 * a chance she doesn't arrive at all and you're stuck with some cactus as
 * King."*
 *
 * A built deck used to be dealt WHOLE, which made that impossible: every
 * card you chose turned up, so one great card was worth more than a plan.
 */
import { describe, expect, it } from "vitest";
import { DECK_RULES } from "@amanda/shared";
import { ACTIONS, ACTION_DECK_COUNT, ACTION_SLOTS, CATALOG } from "../data/catalog";
import { __testing } from "./useMatch";

const { matchDeck } = __testing;
/** Eighteen distinct monsters, the way a built deck is eighteen entries. */
const built = [...CATALOG.keys()].filter((id) => id !== "crumb_demon").slice(0, DECK_RULES.size);
const deal = () => matchDeck(null, undefined, built);
const monstersOf = (d: string[]) => d.filter((id) => CATALOG.has(id));

describe("what reaches the match", () => {
  it("deals fewer monsters than the deck holds", () => {
    expect(DECK_RULES.dealt).toBeLessThan(DECK_RULES.size);
    for (let i = 0; i < 20; i++) expect(monstersOf(deal())).toHaveLength(DECK_RULES.dealt);
  });

  it("deals only cards that are in the deck", () => {
    for (let i = 0; i < 20; i++)
      for (const id of monstersOf(deal())) expect(built).toContain(id);
  });

  /*
   * THE ONE THIS EXISTS FOR. A card you chose is not a card you are promised
   * — over enough matches the same card has to be left at home sometimes,
   * or "fifteen of eighteen" is only a number.
   */
  it("leaves a different three behind each time", () => {
    const missed = new Map<string, number>();
    for (let i = 0; i < 300; i++) {
      const dealt = new Set(monstersOf(deal()));
      for (const id of built) if (!dealt.has(id)) missed.set(id, (missed.get(id) ?? 0) + 1);
    }
    expect(missed.size, "every card in the deck can be the one that stays home").toBe(built.length);
    // Three of eighteen is a sixth, so nobody should be sitting out half the time.
    for (const [id, n] of missed) expect(n, id).toBeLessThan(300 * 0.4);
  });

  it("deals the action cards whole, and more of them than fit in the bar", () => {
    for (let i = 0; i < 20; i++) {
      const actions = deal().filter((id) => ACTIONS.has(id));
      expect(actions).toHaveLength(ACTION_DECK_COUNT);
      expect(new Set(actions).size, "and never the same one twice").toBe(actions.length);
    }
    expect(ACTION_DECK_COUNT, "two to bin").toBeGreaterThan(ACTION_SLOTS);
  });

  /*
   * Or's arithmetic, which is the reason for the numbers: the board is
   * sixteen cells minus the King's 2x2, so thirteen monsters go down
   * including the crown, and what is dealt above that is what the bin is
   * for.
   */
  it("leaves something over for the bin, on both halves", () => {
    const CELLS = 16 - 4 + 1; // the board, less the King's block, plus the crown
    expect(DECK_RULES.dealt - CELLS, "monsters to bin").toBe(2);
    expect(ACTION_DECK_COUNT - ACTION_SLOTS, "action cards to bin").toBe(2);
  });
});
