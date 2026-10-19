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
import { TUNED } from "./tunables.js";

export const DECK_RULES = {
  /**
   * ═══ EIGHTEEN CHOSEN, FIFTEEN DEALT ═══
   *
   * Or: *"18 cards in a deck (leave the budget at 50). Only 15 (+5 action
   * cards) reach the match deck. That means 3 cards you put in the deck
   * don't arrive. That means you have 2 action cards to bin and 2 monsters
   * to bin — unless you put a fill card in, and then you can bin more."*
   *
   * The arithmetic is his and it checks out: the board is sixteen cells
   * minus the King's 2x2, so thirteen monsters go down including the crown.
   * Fifteen dealt leaves two to bin; five action cards against three bar
   * slots leaves two more.
   *
   * What the split BUYS is the thing he was asking about before it: *"there
   * needs to be some number of cards that are in your deck and don't
   * actually reach the match — so that if you put in only Mother Tree and
   * she's your one card with a lot of health, there's a chance she doesn't
   * arrive at all and you're stuck with some cactus as King."* A deck that
   * is dealt whole is a promise that every card in it turns up, and a
   * promise like that makes one great card worth more than a plan.
   */
  size: 18,
  /**
   * How many of them are dealt into one match. The other three stay home.
   */
  dealt: 15,
  /** What those sixteen may cost between them. */
  /*
   * ═══ THE BUDGET, AND THE FLOOR UNDER IT ═══
   *
   * Or: *"I think we should lower the deck budget a bit, it's too easy.
   * Let's try 40 instead of 55 (this is the kind of thing I need control
   * over from the admin panel)."*
   *
   * The dial is built — see `deckBudget()` and tunables.ts — and he can put
   * it on 40 from the panel in a second. It does not SHIP on 40, and this is
   * the measurement rather than an opinion:
   *
   *   a new player owns six cards, three copies each, eighteen to pick from
   *   the cheapest legal sixteen of those costs 47
   *
   * At 40 nobody who installed the game today can save a deck at all. Not a
   * weaker deck — no deck. 47 is the floor.
   *
   * It ships at 50. Or: *"47 is odd. Make it 48 or 50 and we'll adjust
   * later. I was just building a really strong deck — we need to think
   * about how to solve that properly."* Which is the right instinct: the
   * budget is a blunt tool for a problem that is really about the PRICES,
   * and three of air above the floor is room to move without a deploy.
   *
   * Nothing here is read directly. `deckBudget()` reads TUNED at call time
   * so the panel moves the next deck rather than the next deploy.
   */
  /*
   * ═══ SIXTY, AND OR ASKED FOR FIFTY ═══
   *
   * He said *"leave the budget at 50"*, and fifty cannot hold eighteen
   * cards. Measured rather than argued: the starter six cost 4, 5, 4, 2, 1
   * and 3, the rules allow three of each, and that is exactly eighteen
   * entries costing 57 altogether. There is no cheaper legal eighteen,
   * because there is no other card to reach for.
   *
   * So fifty-seven is the floor, the same way forty-seven was the floor for
   * sixteen — and sixty is three above it, which is the same three of air
   * the old fifty had. Anything less than 57 means a new player cannot save
   * a deck, and "fill it for me" hands them something illegal.
   *
   * Nothing reads this directly: deckBudget() asks TUNED at call time, so
   * Or can put it back to fifty-seven, or anywhere above it, from the admin
   * panel without a deploy.
   */
  budget: 60,
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

/**
 * What a deck may cost, right now.
 *
 * A function and not a constant because the admin panel turns it: see
 * TUNED.deckBudget in tunables.ts. Everything that checks a deck goes
 * through here so the panel cannot move one check and leave another behind.
 */
export function deckBudget(): number {
  return TUNED.deckBudget;
}

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
  if (cost > deckBudget()) out.push({ kind: "overBudget", cost });
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
  if (spent + cardCost(card) > deckBudget()) return false;
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
 * ═══ TWO PASSES, AND THE SECOND ONE IS THE GUARANTEE ═══
 *
 * The first is round-robin: one of each cheapest-first, then a second of
 * each, then a third, so a thin album WIDENS before it repeats and a wide
 * one never repeats at all. That is the deck a player would rather be
 * handed.
 *
 * It is also not always possible. Widening spends on the dear cards early,
 * and lowering the budget to 47 made the starter album fail at exactly that:
 * three passes over six cards reach fifteen cards for 44, and every card
 * left either costs more than the three remaining or is already in three
 * times. Fifteen is not a legal deck, so "fill it for me" handed a brand new
 * player something they could not save.
 *
 * The second pass is the one that cannot fail: take the sixteen cheapest
 * COPIES outright. For the starter six that is 1,1,1,2,2,2,3,3,3,4,4,4,4,4,4
 * and a 5 — sixteen cards for exactly 47. Uglier, and it exists so that the
 * answer is never "no deck".
 *
 * Which is also why the budget cannot go below 47 without this returning
 * short again. The dial in the admin panel says so.
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
  for (let round = 0; round < DECK_RULES.maxCopies && out.length < DECK_RULES.size; round++) {
    for (const { id, card } of priced) {
      if (out.length >= DECK_RULES.size) break;
      if (!canAdd(id, card, out, spent)) continue;
      out.push(id);
      spent += cardCost(card);
    }
  }
  if (out.length >= DECK_RULES.size) return out;

  /*
   * Short. Start again and take the cheapest copies, in order, with no
   * preference for variety — see the note above. Everything this produces
   * is still checked by `canAdd`, so it cannot return something illegal; it
   * can only return something short, and only when no legal deck exists at
   * all for this album and budget.
   */
  const copies: Array<{ id: string; card: Card }> = [];
  for (let n = 0; n < DECK_RULES.maxCopies; n++) for (const c of priced) copies.push(c);
  copies.sort((a, b) => cardCost(a.card) - cardCost(b.card));

  const flat: string[] = [];
  let paid = 0;
  for (const { id, card } of copies) {
    if (flat.length >= DECK_RULES.size) break;
    if (!canAdd(id, card, flat, paid)) continue;
    flat.push(id);
    paid += cardCost(card);
  }
  return flat.length > out.length ? flat : out;
}

/** A deck for somebody who has never opened the builder. */
export function starterDeck(owned: readonly string[], of: (id: string) => Card | undefined): Deck {
  return { id: "auto", name: "", cards: autoDeck(owned, of), back: DEFAULT_BACK };
}
