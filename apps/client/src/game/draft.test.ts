import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DECK_RULES, DRAFT_PACK, DRAFT_ROUNDS, dealPacks, splitDraft } from "@amanda/shared";
import { cardPool, CATALOG } from "../data/catalog";

/**
 * **Draft: what you don't take goes to the opponent.**
 *
 * Or's whole specification of the mode is that sentence, so these tests are
 * mostly one assertion said in different ways — because the sentence is easy
 * to break by accident and impossible to notice breaking from inside a match.
 */

/** A fixed generator, so a failure is the same failure twice. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const POOL = cardPool().filter((id) => CATALOG.has(id));

describe("dealing the packs", () => {
  it("deals one pack per card a deck will play", () => {
    // Not a number somebody liked: every monster that reaches a board is
    // chosen here, so the count is the deck's.
    expect(DRAFT_ROUNDS).toBe(DECK_RULES.dealt);
    expect(dealPacks(POOL, DRAFT_ROUNDS, rng(7))).toHaveLength(DRAFT_ROUNDS);
  });

  it("puts two cards on the table and not three", () => {
    /*
     * The pack size IS the fairness. With three, one comes to you and TWO go
     * to the opponent — fifteen against thirty. With two it is one each, and
     * "what you don't take goes to them" is exactly true.
     */
    expect(DRAFT_PACK).toBe(2);
    for (const pack of dealPacks(POOL, DRAFT_ROUNDS, rng(7))) expect(pack).toHaveLength(2);
  });

  it("never offers the same card twice", () => {
    // Passing on a monster and meeting it anyway would make the rule a lie.
    const seen = dealPacks(POOL, DRAFT_ROUNDS, rng(11)).flat();
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("offers only cards the game would have dealt", () => {
    for (const id of dealPacks(POOL, DRAFT_ROUNDS, rng(3)).flat())
      expect(CATALOG.has(id), id).toBe(true);
  });

  it("deals the same draft twice from the same seed", () => {
    expect(dealPacks(POOL, DRAFT_ROUNDS, rng(99))).toEqual(dealPacks(POOL, DRAFT_ROUNDS, rng(99)));
  });

  it("runs out rather than repeating itself", () => {
    // A pool of five cards is two packs and a card left over, not three packs
    // where one card appears twice.
    const packs = dealPacks(["a", "b", "c", "d", "e"], 9, rng(5));
    expect(packs).toHaveLength(2);
    expect(new Set(packs.flat()).size).toBe(4);
  });
});

describe("what you don't take", () => {
  const packs = dealPacks(POOL, DRAFT_ROUNDS, rng(21));
  const took = packs.map((p) => p[0]!);

  it("goes to the opponent, every time", () => {
    const { mine, theirs } = splitDraft(packs, took);
    expect(mine).toEqual(took);
    expect(theirs).toEqual(packs.map((p) => p[1]!));
  });

  it("leaves both sides holding the same number of cards", () => {
    const { mine, theirs } = splitDraft(packs, took);
    expect(mine).toHaveLength(theirs.length);
    expect(mine).toHaveLength(DRAFT_ROUNDS);
  });

  it("gives nobody a card the other side also has", () => {
    const { mine, theirs } = splitDraft(packs, took);
    for (const id of mine) expect(theirs).not.toContain(id);
  });

  it("follows the choice rather than the position", () => {
    // Taking the second card of every pack hands over the first.
    const other = packs.map((p) => p[1]!);
    const { mine, theirs } = splitDraft(packs, other);
    expect(mine).toEqual(other);
    expect(theirs).toEqual(packs.map((p) => p[0]!));
  });

  it("counts nothing from a pack that was never answered", () => {
    const half = took.slice(0, 4);
    const { mine, theirs } = splitDraft(packs, half);
    expect(mine).toHaveLength(4);
    expect(theirs).toHaveLength(4);
  });
});

/* ───────────────────────── the wiring ───────────────────────── */

const MATCH = readFileSync(fileURLToPath(new URL("./useMatch.ts", import.meta.url)), "utf8");

describe("the match it starts", () => {
  /*
   * ⚠ THE ONE THAT WOULD MAKE THE MODE POINTLESS AND LOOK FINE. If the bot's
   * board were planned from the usual random pool, every pick would still
   * work, the screen would still read, and the cards you passed on would
   * simply never turn up. The mode would be a slower way to get a random
   * deck.
   */
  it("plans the opponent's board from the cards you passed on", () => {
    const start = MATCH.slice(MATCH.indexOf("const startDraft"));
    const body = start.slice(0, start.indexOf("const startMirror"));
    expect(body).toContain("generateAiPlan(result.theirs");
  });

  it("gives you the ones you took", () => {
    const start = MATCH.slice(MATCH.indexOf("const startDraft"));
    const body = start.slice(0, start.indexOf("const startMirror"));
    expect(body).toContain("...result.mine");
  });
});
