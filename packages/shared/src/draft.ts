/**
 * Draft: what you don't take goes to the opponent.
 *
 * Or's whole description of the mode, and the blurb on the shelf, is one
 * sentence: *"מה שלא לקחת הולך ליריב."* Everything here follows from taking
 * that literally.
 *
 * ═══ WHY A PACK IS TWO CARDS AND NOT THREE ═══
 *
 * Three is the shape most card games use, and it does not fit his sentence.
 * With three, you take one and TWO go to the opponent — which is not a draft,
 * it is a handicap: after fifteen picks they have thirty cards and you have
 * fifteen. The usual fix is to burn the third, and then "what you don't take
 * goes to the opponent" is false for half of what you did not take.
 *
 * With two it is exactly true, exactly fair, and exactly one decision: this
 * one for me, that one for them. A child does not need the rule explained,
 * because the rule is what the screen does.
 *
 * ═══ AND IT IS THE WHOLE DECK, NOT A FLOURISH ON TOP OF ONE ═══
 *
 * Fifteen monsters are dealt into a match (DECK_RULES.dealt), so there are
 * fifteen packs. Drafting six and dealing the other nine would be shorter and
 * would make the mode a garnish — the match would mostly be decided by cards
 * nobody chose. Every monster on both boards is chosen here, by you.
 *
 * ⚠ Fifteen taps before a match is the cost, and it is the one number worth
 * arguing about. It is `DRAFT_ROUNDS`, it is derived from the deck size
 * rather than picked, and it is one line to change.
 *
 * Action cards are NOT drafted. They are the small change of a deck — a
 * freeze, an extra draw — and choosing between two of them is a decision
 * about nothing. Both sides get their usual five.
 */

import { DECK_RULES } from "./decks.js";

/** How many cards are on the table each time you choose. */
export const DRAFT_PACK = 2;

/**
 * How many times you choose.
 *
 * Derived, not picked: every monster that reaches a board is drafted, so this
 * is however many monsters a deck deals.
 */
export const DRAFT_ROUNDS = DECK_RULES.dealt;

/**
 * What one side ends up holding, and what the other does.
 *
 * `mine` and `theirs` are always the same length and never share a card: the
 * two halves of the same pile.
 */
export interface DraftResult {
  mine: string[];
  theirs: string[];
}

/**
 * Deal the packs.
 *
 * Deterministic from `rnd` so a draft can be replayed — the same seed deals
 * the same choices, which is what lets a test say "this draft, this pick,
 * that deck" instead of running it a hundred times and hoping.
 *
 * Every card appears at most once across every pack. Seeing the same monster
 * in two packs would make "what you don't take goes to the opponent" a lie:
 * you would pass on it and meet it anyway.
 */
export function dealPacks(pool: readonly string[], rounds: number, rnd: () => number): string[][] {
  const bag = [...pool];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  const packs: string[][] = [];
  for (let r = 0; r < rounds; r++) {
    const pack = bag.slice(r * DRAFT_PACK, r * DRAFT_PACK + DRAFT_PACK);
    // A short pool runs out rather than repeating itself. Better a draft of
    // nine packs than one where the same card is offered twice.
    if (pack.length < DRAFT_PACK) break;
    packs.push(pack);
  }
  return packs;
}

/**
 * Split the packs by what was taken.
 *
 * `picked[i]` is the card taken from pack `i`. Anything else in that pack is
 * the opponent's — which is the whole mode, in one line.
 */
export function splitDraft(packs: readonly string[][], picked: readonly string[]): DraftResult {
  const mine: string[] = [];
  const theirs: string[] = [];
  packs.forEach((pack, i) => {
    const took = picked[i];
    if (took === undefined) return;
    for (const id of pack) (id === took ? mine : theirs).push(id);
  });
  return { mine, theirs };
}
