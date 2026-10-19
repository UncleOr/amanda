/**
 * **A beginner's album, and the budget that hangs off it.**
 *
 * Or, looking at a deck he had just built: *"you're really overdoing it. The
 * decks are now really strong and it ruins it. It cost me 46 and I have
 * change left for another 3-card and another 1-card, which fills 18 for 50.
 * And I could have done it for less."*
 *
 * The budget could not fix that by itself, and the arithmetic is the reason:
 * a new player had six cards, the rules allow three of each, and that is
 * exactly eighteen entries. Their only possible deck cost 57, so no budget
 * below 57 was legal — and 57 out of a possible 90 buys most of the best
 * cards in the game. The number that was fair to a beginner had to be
 * generous to everybody else.
 *
 * Two cheap cards break that tie, and these pin both ends of it: the album
 * the database hands out, and the fact that a budget now sits between what
 * a beginner must spend and what a deck could cost.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DECK_RULES, STARTER_ALBUM, autoDeck, cardCost, deckBudget, deckIsLegal } from "@amanda/shared";
import { CATALOG, collectable } from "../data/catalog";

const of = (id: string) => CATALOG.get(id);
const owned = [...STARTER_ALBUM];

/** The cheapest legal deck somebody with this album can put together. */
function floor(album: string[]): number {
  const copies: number[] = [];
  for (let n = 0; n < DECK_RULES.maxCopies; n++)
    for (const id of album) copies.push(cardCost(of(id)!));
  copies.sort((a, b) => a - b);
  return copies.slice(0, DECK_RULES.size).reduce((a, b) => a + b, 0);
}

describe("the album a new player is handed", () => {
  it("is the same list the database hands out", () => {
    const dir = fileURLToPath(new URL("../../../../db/migrations", import.meta.url));
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      .filter((s) => s.includes("function public.grant_starter_album"))
      .pop()!;
    const granted = [...sql.matchAll(/'([a-z0-9_]+_\d\d_[a-z0-9_]+)'/g)].map((m) => m[1]!);
    expect(granted.sort()).toEqual([...owned].sort());
  });

  it("is cards that exist", () => {
    for (const id of owned) expect(of(id), id).toBeTruthy();
  });

  /*
   * THE ONE THE BUDGET HANGS ON. Enough cards that the cheapest legal deck
   * is well under the budget — which is what gives a beginner a choice and
   * what lets the budget be a real constraint on everybody else.
   */
  it("can build a deck for a lot less than the budget", () => {
    expect(floor(owned)).toBeLessThan(deckBudget());
  });

  it("leaves a beginner room to choose", () => {
    const built = autoDeck(owned, of);
    expect(built).toHaveLength(DECK_RULES.size);
    expect(deckIsLegal({ name: "שלי", cards: built }, of)).toBe(true);
  });
});

describe("the budget", () => {
  const price = (ids: string[]) => ids.reduce((a, id) => a + cardCost(of(id)!), 0);
  const nOf = (pick: "cheapest" | "dearest") => {
    const sorted = collectable()
      .slice()
      .sort((a, b) => (pick === "cheapest" ? cardCost(a) - cardCost(b) : cardCost(b) - cardCost(a)));
    const out: string[] = [];
    for (let n = 0; n < DECK_RULES.maxCopies && out.length < DECK_RULES.size; n++)
      for (const c of sorted) if (out.length < DECK_RULES.size) out.push(c.id);
    return out;
  };

  /*
   * A budget that cannot buy the dearest deck and can buy more than the
   * cheapest one is a trade. Outside that it is either decoration or a wall.
   */
  it("sits between the cheapest deck and the dearest", () => {
    const low = price(nOf("cheapest"));
    const high = price(nOf("dearest"));
    expect(deckBudget()).toBeGreaterThan(low);
    expect(deckBudget()).toBeLessThan(high);
  });

  it("is near the middle of that, rather than near the top", () => {
    const low = price(nOf("cheapest"));
    const high = price(nOf("dearest"));
    const where = (deckBudget() - low) / (high - low);
    expect(where, "a budget in the top third is not a budget").toBeLessThan(0.6);
  });
});
