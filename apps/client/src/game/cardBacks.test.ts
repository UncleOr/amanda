/**
 * **The card-back picker is not the shop, and it is not the roadmap.**
 *
 * It used to list all eleven backs with the unowned ones greyed and
 * padlocked, on the grounds that wanting one is the point.
 *
 * Or: *"in the deck builder, in the card-back picker, I don't need to see
 * everything that could be or WILL BE in the shop. Don't forget that one day
 * at Hanukkah we'll suddenly bring out a Hanukkah back or something. Only
 * what I have."*
 *
 * The second half is the one that makes this a test rather than a tidy-up: a
 * back added to the list for a date is announced to every player the moment
 * it deploys, named and greyed, weeks before it is meant to exist. So this
 * pins the rule with a back nobody owns — the shape a seasonal one would
 * have — rather than only with today's list.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CARD_BACKS, DEFAULT_BACK, myBacks, ownsBack } from "@amanda/shared";

const BUILDER = readFileSync(
  fileURLToPath(new URL("../components/DeckBuilder.tsx", import.meta.url)),
  "utf8",
);

/** Every back that has to be bought — the shape a holiday one would have. */
const paid = CARD_BACKS.filter((b) => !b.free);

describe("which backs a player may wear", () => {
  it("gives a new player the free ones and nothing else", () => {
    const got = myBacks([]).map((b) => b.id);
    expect(got).toEqual(CARD_BACKS.filter((b) => b.free).map((b) => b.id));
    expect(got.length, "there are free ones to start with").toBeGreaterThan(1);
  });

  /*
   * THE ONE THIS EXISTS FOR. Not "the list is shorter" — that a back which
   * is in the data and owned by nobody cannot be seen by anybody.
   */
  it("never shows a back that has not been bought", () => {
    const seen = new Set(myBacks([]).map((b) => b.id));
    for (const b of paid) expect(seen.has(b.id), `${b.id} is for sale, not for showing`).toBe(false);
  });

  it("adds one the moment it is owned, and only that one", () => {
    const first = paid[0]!;
    const got = myBacks([first.item!]).map((b) => b.id);
    expect(got).toContain(first.id);
    for (const other of paid.slice(1)) expect(got).not.toContain(other.id);
  });

  /*
   * A deck is allowed to be wearing a back its owner no longer holds — a
   * gift that lapsed, an item moved in the shop. The picker still has to
   * show what the deck is wearing, or it silently disagrees with the deck.
   */
  it("keeps whatever the deck is already wearing", () => {
    const lost = paid[0]!;
    expect(myBacks([], lost.id).map((b) => b.id)).toContain(lost.id);
    expect(ownsBack(lost, []), "and it is still not owned").toBe(false);
  });

  it("agrees with ownsBack, every time", () => {
    const items = [paid[0]!.item!];
    for (const b of CARD_BACKS) {
      expect(myBacks(items).includes(b)).toBe(ownsBack(b, items));
    }
  });

  it("always leaves something to wear", () => {
    expect(myBacks([]).map((b) => b.id)).toContain(DEFAULT_BACK);
  });
});

describe("the picker that draws them", () => {
  it("draws the owned list, not the catalogue", () => {
    expect(BUILDER).toContain("myBacks(items, back)");
    expect(BUILDER, "the whole list has no business in this screen").not.toContain("CARD_BACKS");
    expect(BUILDER, "and nothing is drawn as locked any more").not.toContain("is-locked");
  });

  /* A list of one is not a choice, so there is no way into it. */
  it("offers no way in when there is nothing to choose", () => {
    expect(BUILDER).toContain("{backs.length > 1 && (");
  });
});
