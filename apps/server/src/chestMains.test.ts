import { describe, expect, it } from "vitest";
import { CHESTS, rollChest } from "./progress.js";
import { CATALOG } from "./content.js";
import { STARTER_ALBUM, isCollectable, mainsOf } from "@amanda/shared";

/**
 * **The card a family introduces itself with.**
 *
 * Or: *"pick which 2 from each series are the main ones, THAT ARE THE FIRST
 * ONES YOU GET, and that also say their own name when you tap them."*
 *
 * ═══ WHY THE DRAW HAD TO CHANGE AND NOT JUST THE SOUND TABLE ═══
 *
 * Reaching an arena is the one moment in this game built to feel like an
 * introduction — the Garage says *here are the Machines* — and the chest
 * behind it drew by rarity from all ten of them. So the Machines introduced
 * themselves as the Bolt Mine about as often as anything else: a card that
 * does not move, has no voice, and means nothing to a seven-year-old. The
 * two cards that say their own name were the two you were least likely to
 * meet first, which is the sentence above failing in both directions at
 * once.
 *
 * A chest draw that lands on a family this album holds nothing of is now
 * handed back as one of that family's mains. These measure that it happens,
 * that it stops happening, and that it cost nothing else.
 */
const TOP = 9999;
const seriesOf = (id: string) => CATALOG.get(id)!.seriesId;

/** The families an album already holds. */
const met = (owned: Iterable<string>) => new Set([...owned].map(seriesOf));

/**
 * The cards a run of chests paid out from families this album has none of,
 * in the order they came out, one list per family per chest.
 *
 * Per CHEST rather than pooled, because the claim is about order: the first
 * card out of a family is the one that introduces it, and a gold chest is
 * eight cards, so meeting a family and drawing from it again before you have
 * opened anything is routine.
 */
function introductions(owned: Set<string>, rounds: number): Array<[string, string[]]> {
  const knew = met(owned);
  const out: Array<[string, string[]]> = [];
  for (let i = 0; i < rounds; i++) {
    const byFamily = new Map<string, string[]>();
    for (const id of rollChest(TOP, "gold", new Set(owned)).cards) {
      const s = seriesOf(id);
      if (knew.has(s)) continue;
      byFamily.set(s, [...(byFamily.get(s) ?? []), id]);
    }
    for (const [s, ids] of byFamily) out.push([s, ids]);
  }
  return out;
}

/** The album a child actually has when the first new family opens. */
const starter = () => new Set<string>([...STARTER_ALBUM]);

describe("meeting a family", () => {
  it("introduces it with one of its mains, every time", () => {
    const runs = introductions(starter(), 150);
    const families = new Set(runs.map(([s]) => s));
    /*
     * Four of the five unmet families, and never the same four — the Demons
     * are one epic card and turn up a few times in a thousand draws, which
     * is why they have a test of their own below rather than a looser bound
     * here.
     */
    expect(families.size, "the unmet families barely came up at all").toBeGreaterThan(3);
    for (const [seriesId, ids] of runs)
      expect(mainsOf(seriesId), `${seriesId} introduced itself as ${ids[0]}`).toContain(ids[0]!);
  });

  it("gives the second main before anything else, inside the same chest", () => {
    const pairs = introductions(starter(), 150).filter(([, ids]) => ids.length > 1);
    expect(pairs.length, "no chest ever gave two from one new family").toBeGreaterThan(5);
    for (const [seriesId, ids] of pairs)
      expect(mainsOf(seriesId), `second card was ${ids[1]}`).toContain(ids[1]!);
  });

  /*
   * Two families are one card each, and both are the awkward case: there is
   * no second main to fall back to, and the swap must not invent one or
   * quietly give up and hand over whatever was drawn.
   */
  it("introduces a one-card family with the one card it has", () => {
    for (const [seriesId, only] of [
      // Chuppy is handed to everybody on day one, so the only way to see
      // him being met is an album without him.
      ["furries", "furries_01_chuppy"],
      // The Alley King is one epic in a pool of seventy-five: rare enough
      // that a hundred chests can miss him entirely.
      ["demons", "demons_01_alley_king"],
    ] as const) {
      const owned = starter();
      owned.delete(only);
      /*
       * ⚠ A THOUSAND CHESTS, AND THE NUMBER IS NOT CAUTION. The Alley King
       * is one epic card in a pool of seventy-five: about one draw in three
       * hundred. At 300 chests this test failed roughly one run in ten —
       * which is the worst kind of red, because it is red about nothing.
       * Eight thousand draws puts the expected count near twenty-five, and
       * the chance of seeing none past any number worth writing down.
       */
      const runs = introductions(owned, 1000).filter(([s]) => s === seriesId);
      expect(runs.length, `${only} never came out of 1000 gold chests`).toBeGreaterThan(0);
      for (const [, ids] of runs) expect(ids[0]).toBe(only);
    }
  });

  /*
   * ⚠ THE HALF THAT WOULD BE A DIFFERENT BUG. A swap that kept applying
   * would mean a family you own nine cards of still pays out the same two
   * forever — the album would stop at twenty cards and the upgrade economy
   * with it.
   */
  it("stops the moment you own anything from that family", () => {
    /*
     * ⚠ THE HALF THAT WOULD BE A DIFFERENT BUG, and the shape it takes is
     * not the obvious one. A swap that forgot to ask whether the family was
     * already MET would look harmless against a full album — both mains are
     * owned, so there is nothing to swap to — and would quietly redirect
     * EVERY draw from a half-collected family onto the one main still
     * missing. The album would stall one card short of each family and the
     * upgrade economy, which runs on duplicates, with it.
     *
     * So this is measured against an album that holds a whole family except
     * one of its mains.
     */
    const owned = new Set([...CATALOG.values()].filter(isCollectable).map((c) => c.id));
    const missing = mainsOf("slimes")[1]!;
    owned.delete(missing);
    const slimes: string[] = [];
    for (let i = 0; i < 200; i++)
      for (const id of rollChest(TOP, "gold", new Set(owned)).cards)
        if (seriesOf(id) === "slimes") slimes.push(id);
    expect(slimes.length).toBeGreaterThan(40);
    const share = slimes.filter((id) => id === missing).length / slimes.length;
    expect(share, `${missing} was ${Math.round(share * 100)}% of every slime drawn`).toBeLessThan(
      0.5,
    );
  });

  it("leaves a present alone, because a present has no album to compare to", () => {
    // Shop grants and gifts pass no `owned`. They are not rewards for an
    // album and must not quietly become an introduction to one.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) for (const id of rollChest(TOP, "gold").cards) seen.add(id);
    expect(seen.size).toBeGreaterThan(30);
  });
});

describe("what the guarantee on the lid still promises", () => {
  /*
   * The guaranteed card cannot be swapped — a common main in place of a
   * promised epic is a broken promise — so it is drawn from the families
   * you have met instead. Both halves have to hold at once.
   */
  it("keeps its rarity, with most of the catalogue unmet", () => {
    const owned = new Set<string>([...STARTER_ALBUM]);
    for (const kind of ["silver", "gold"] as const) {
      const want = CHESTS[kind]!.guarantees!;
      for (let i = 0; i < 200; i++) {
        const rarities = rollChest(TOP, kind, new Set(owned)).cards.map(
          (id) => CATALOG.get(id)!.rarity,
        );
        expect(rarities, `${kind} promised ${want}`).toContain(want);
      }
    }
  });

  it("draws it from a family you already know", () => {
    const owned = new Set<string>([...STARTER_ALBUM]);
    const known = new Set([...owned].map(seriesOf));
    for (let i = 0; i < 200; i++) {
      const first = rollChest(TOP, "gold", new Set(owned)).cards[0]!;
      expect(known, `guaranteed card came from ${seriesOf(first)}`).toContain(seriesOf(first));
    }
  });

  it("still gives one when no family you know has that rarity", () => {
    // One card, from one family, and it is common. The epic has to come
    // from somewhere rather than the chest arriving a card short.
    const owned = new Set<string>(["insects_01_ant_soldier"]);
    for (let i = 0; i < 50; i++) {
      const won = rollChest(TOP, "gold", new Set(owned));
      expect(won.cards.length).toBe(CHESTS.gold!.cards);
      expect(won.cards.map((id) => CATALOG.get(id)!.rarity)).toContain("epic");
    }
  });
});
