/**
 * A deck you built, kept, named and put a back on.
 *
 * Or: *"you pick X cards from the ones you have and only those are in the
 * deck… there should be a way to save at least 3 decks, each with a unique
 * name and a unique card-back design… deck building is a significant part of
 * the appeal. I want YouTubers showing what decks they built."*
 *
 * ═══ THE RULES, IN ONE PLACE ═══
 *
 * Everything that decides whether a deck is legal is here, as pure functions,
 * because three different things need the same answer and must not disagree:
 * the builder (greying out a card you cannot afford), the save (refusing a
 * deck that is over), and the match (refusing to field one). A rule written
 * three times is a rule with three versions.
 *
 * ═══ THE NUMBERS, AND WHERE THEY CAME FROM ═══
 *
 * Or approved both: *"16 and 55 sounds reasonable."* docs/DECK.md has the
 * arithmetic. The short version:
 *
 *   SIXTEEN, because the board holds twelve monster slots. Twelve exactly
 *   would kill the bin — if you choose twelve and there are twelve places
 *   there is no longer a "throw it away or place it" decision, only a where.
 *   Eighteen, today's number, is a lot of taps before every match. Sixteen
 *   leaves four spare: the bin is still a decision, and nearly everything you
 *   chose reaches the board — which matters, because a card you CHOSE and
 *   never saw is a different kind of annoying from a random one.
 *
 *   FIFTY-FIVE out of a possible eighty, and the honest part is why it is not
 *   47, which is what an average deck costs. The starter album is six cards,
 *   and the CHEAPEST legal deck anybody can build from them is 50. A budget
 *   tuned to fairness would tell a child who has just installed the game that
 *   his deck is illegal.
 */
import { cardCost } from "./cardCost.js";
import type { Card } from "./schemas/card.js";
import { DEFAULT_BACK } from "./cardBacks.js";

export const DECK_RULES = {
  /** Monster cards in a built deck. */
  size: 16,
  /** What those sixteen may cost between them. */
  budget: 55,
  /**
   * How many times one card may appear.
   *
   * Three, and it is the starter album that sets it: six cards cannot fill
   * sixteen slots at two apiece. Deliberately NOT tied to how many copies you
   * own — copies are the upgrade currency ("you need X copies to level it
   * up"), and spending them twice would make levelling a card a reason not to
   * play it.
   */
  maxCopies: 3,
  /** How many decks a player may keep. Or asked for at least three. */
  maxDecks: 3,
  /** The longest a deck's name may be. */
  nameMax: 18,
} as const;

export interface Deck {
  id: string;
  name: string;
  /** Sixteen card ids, duplicates allowed. */
  cards: string[];
  /** A CardBack id. */
  back: string;
}

/** What a deck costs, by the prices in cardCost.ts. */
export function deckCost(cards: readonly string[], of: (id: string) => Card | undefined): number {
  let total = 0;
  for (const id of cards) {
    const card = of(id);
    if (card) total += cardCost(card);
  }
  return total;
}

export type DeckFault =
  | { kind: "tooFew"; have: number }
  | { kind: "tooMany"; have: number }
  | { kind: "overBudget"; cost: number }
  | { kind: "tooManyCopies"; cardId: string }
  | { kind: "unknownCard"; cardId: string }
  | { kind: "noName" };

/**
 * Everything wrong with this deck, or nothing.
 *
 * A list rather than a boolean: the builder shows what is wrong WHILE you
 * build, and "invalid" is not something anybody can act on.
 */
export function deckFaults(
  deck: Pick<Deck, "name" | "cards">,
  of: (id: string) => Card | undefined,
): DeckFault[] {
  const out: DeckFault[] = [];
  if (!deck.name.trim()) out.push({ kind: "noName" });
  if (deck.cards.length < DECK_RULES.size) out.push({ kind: "tooFew", have: deck.cards.length });
  if (deck.cards.length > DECK_RULES.size) out.push({ kind: "tooMany", have: deck.cards.length });

  const seen = new Map<string, number>();
  for (const id of deck.cards) {
    if (!of(id)) {
      out.push({ kind: "unknownCard", cardId: id });
      continue;
    }
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    if (n === DECK_RULES.maxCopies + 1) out.push({ kind: "tooManyCopies", cardId: id });
  }

  const cost = deckCost(deck.cards, of);
  if (cost > DECK_RULES.budget) out.push({ kind: "overBudget", cost });
  return out;
}

export function deckIsLegal(
  deck: Pick<Deck, "name" | "cards">,
  of: (id: string) => Card | undefined,
): boolean {
  return deckFaults(deck, of).length === 0;
}

/**
 * May this card be added right now?
 *
 * The builder asks this for every card in the album on every render, which is
 * why it takes the counts rather than recomputing them fifty-one times.
 */
export function canAdd(
  cardId: string,
  card: Card | undefined,
  chosen: readonly string[],
  spent: number,
): boolean {
  if (!card) return false;
  if (chosen.length >= DECK_RULES.size) return false;
  if (spent + cardCost(card) > DECK_RULES.budget) return false;
  let copies = 0;
  for (const id of chosen) if (id === cardId) copies++;
  return copies < DECK_RULES.maxCopies;
}

/**
 * A legal deck built out of whatever this player owns.
 *
 * Three things need this and none of them is "being lazy": the button that
 * fills a deck for somebody who does not want to build one, the deck a new
 * player is given so their first match is not an empty board, and the
 * fallback when a saved deck stops being legal because a card was rebalanced.
 *
 * Cheapest-first, because the budget is the binding constraint: a greedy
 * expensive pass runs out at eleven cards and has to back out. This one
 * cannot fail to fill sixteen slots as long as the album holds at least six
 * cards — which the starter album does, exactly.
 */
export function autoDeck(
  owned: readonly string[],
  of: (id: string) => Card | undefined,
): string[] {
  const priced = owned
    .map((id) => ({ id, card: of(id) }))
    .filter((c): c is { id: string; card: Card } => !!c.card)
    .sort((a, b) => cardCost(a.card) - cardCost(b.card));

  const out: string[] = [];
  let spent = 0;
  // Up to maxCopies passes: one of each cheapest-first, then a second, then a
  // third — so a thin album widens before it repeats, and a wide one never
  // repeats at all.
  for (let round = 0; round < DECK_RULES.maxCopies && out.length < DECK_RULES.size; round++) {
    for (const { id, card } of priced) {
      if (out.length >= DECK_RULES.size) break;
      if (!canAdd(id, card, out, spent)) continue;
      out.push(id);
      spent += cardCost(card);
    }
  }
  return out;
}

/** A deck for somebody who has never opened the builder. */
export function starterDeck(owned: readonly string[], of: (id: string) => Card | undefined): Deck {
  return { id: "auto", name: "", cards: autoDeck(owned, of), back: DEFAULT_BACK };
}
