/**
 * **Four cards out of your own album, and the same four all day.**
 *
 * Or: *"add cards to the card shelf in the shop"*, after *"we'll also add
 * the option to buy cards you already have, so you can upgrade."*
 *
 * The second sentence is the rule the first one has to obey. This shelf
 * sells COPIES — the thing an upgrade costs and the thing nothing in the
 * game lets you aim at — so everything on it is already in the album, and
 * the chests stay the only way to meet a card you have never had.
 *
 * Three things must hold or it is either a lie or a hole:
 *
 *   IT IS THE SAME SHELF ALL DAY. Nothing is written down; it is derived
 *   from the calendar day. If the draw wobbled, the shop would show one
 *   price and the till would charge another.
 *
 *   IT IS ONLY YOUR OWN CARDS. The id is a string anybody can type, so the
 *   till re-derives the shelf instead of believing it.
 *
 *   THE PRICE FOLLOWS WHAT THE CARD IS WORTH, not its rarity. Flame Dragon
 *   is a common with 1300 power (see cardCost.ts).
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TUNED, cardCost } from "@amanda/shared";
import { CATALOG } from "./content.js";
import { TODAY_CARD, cardForSale, cardPrice, cardsForSale } from "./cardShelf.js";

const ME = "player-1";
const DAY = new Date("2026-10-22T09:00:00Z");

/** A database with one table in it: what this player holds. */
function albumOf(rows: Array<{ card_id: string; copies: number }>): SupabaseClient {
  return {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: rows }) }),
    }),
  } as unknown as SupabaseClient;
}

/** Enough of an album to fill all four bands. */
function wideAlbum(): Array<{ card_id: string; copies: number }> {
  const byCost = new Map<number, string[]>();
  for (const c of CATALOG.values()) {
    if (c.seriesId === "system" || c.id === "legends_01_amanda") continue;
    const cost = cardCost(c);
    byCost.set(cost, [...(byCost.get(cost) ?? []), c.id]);
  }
  const rows: Array<{ card_id: string; copies: number }> = [];
  for (const ids of byCost.values())
    for (const id of ids.slice(0, 4)) rows.push({ card_id: id, copies: 2 });
  return rows;
}

describe("today's cards", () => {
  it("are four, and all of them yours", async () => {
    const album = wideAlbum();
    const shelf = await cardsForSale(albumOf(album), ME, DAY);
    expect(shelf).toHaveLength(4);
    const mine = new Set(album.map((r) => r.card_id));
    for (const item of shelf) {
      expect(item.kind).toBe("card");
      expect(mine.has((item.grants as { cardId: string }).cardId)).toBe(true);
    }
  });

  it("are four different cards", async () => {
    const shelf = await cardsForSale(albumOf(wideAlbum()), ME, DAY);
    expect(new Set(shelf.map((i) => i.id)).size).toBe(4);
  });

  it("say how many you already have", async () => {
    // The whole reason this shelf exists: you are adding to a pile, and
    // nobody can decide on a pile they cannot count.
    const shelf = await cardsForSale(albumOf(wideAlbum()), ME, DAY);
    for (const item of shelf) expect(item.copies).toBe(2);
  });

  it("are the same four all day", async () => {
    const album = albumOf(wideAlbum());
    const morning = await cardsForSale(album, ME, new Date("2026-10-22T04:00:00Z"));
    const evening = await cardsForSale(album, ME, new Date("2026-10-22T19:00:00Z"));
    expect(evening.map((i) => i.id)).toEqual(morning.map((i) => i.id));
  });

  it("turn over tomorrow", async () => {
    const album = albumOf(wideAlbum());
    /*
     * Not "are different" — a draw is allowed to repeat a card by chance,
     * and a test that demands otherwise is a test that fails one morning
     * for no reason. Over a fortnight, a shelf that never moved would be.
     */
    const days = new Set<string>();
    for (let d = 1; d <= 14; d++) {
      const shelf = await cardsForSale(album, ME, new Date(`2026-11-${String(d).padStart(2, "0")}`));
      days.add(shelf.map((i) => i.id).join());
    }
    expect(days.size).toBeGreaterThan(7);
  });

  it("are not the same four for everybody", async () => {
    const album = albumOf(wideAlbum());
    const mine = await cardsForSale(album, ME, DAY);
    const theirs = await cardsForSale(album, "player-2", DAY);
    expect(theirs.map((i) => i.id)).not.toEqual(mine.map((i) => i.id));
  });

  it("is empty for an album with nothing in it", async () => {
    expect(await cardsForSale(albumOf([]), ME, DAY)).toEqual([]);
  });

  it("gives a beginner a shelf out of the few cards they have", async () => {
    // The starter album is eight cards and most of them are cheap, so some
    // bands are empty. A short shelf is right; no shelf would be wrong.
    const starter = [
      { card_id: "furries_01_chuppy", copies: 1 },
      { card_id: "dragons_01_flame_dragon", copies: 3 },
      { card_id: "plants_01_thorn_sprout", copies: 2 },
    ];
    const shelf = await cardsForSale(albumOf(starter), ME, DAY);
    expect(shelf.length).toBeGreaterThan(0);
    expect(shelf.length).toBeLessThanOrEqual(3);
  });
});

describe("the till asks the shelf, not the request", () => {
  it("finds a card that is on it", async () => {
    const album = albumOf(wideAlbum());
    const shelf = await cardsForSale(album, ME, DAY);
    const got = await cardForSale(album, ME, shelf[0]!.id, DAY);
    expect(got?.id).toBe(shelf[0]!.id);
  });

  it("refuses a real card that is not on today's shelf", async () => {
    const album = albumOf([{ card_id: "dragons_01_flame_dragon", copies: 1 }]);
    expect(await cardForSale(album, ME, `${TODAY_CARD}giants_10_titan_king`, DAY)).toBeNull();
  });

  it("refuses a card the player has never owned", async () => {
    // The id is a string anybody can type. Without the re-derivation this
    // is a free copy of any card in the game.
    const album = albumOf([{ card_id: "dragons_01_flame_dragon", copies: 1 }]);
    expect(await cardForSale(album, ME, `${TODAY_CARD}legends_01_amanda`, DAY)).toBeNull();
  });

  it("refuses an id that is not one of these at all", async () => {
    expect(await cardForSale(albumOf(wideAlbum()), ME, "avatar.yeti", DAY)).toBeNull();
  });
});

describe("what a copy costs", () => {
  const card = (id: string) => CATALOG.get(id)!;

  it("follows what the card is worth on a board, not its rarity", () => {
    const flame = card("dragons_01_flame_dragon");
    const sprout = card("plants_01_thorn_sprout");
    // Both common. One of them hits for 1300.
    expect(flame.rarity).toBe(sprout.rarity);
    expect(cardPrice(flame)).toBeGreaterThan(cardPrice(sprout));
  });

  it("climbs with the deck cost and never inverts it", () => {
    const seen = new Map<number, number>();
    for (const c of CATALOG.values()) seen.set(cardCost(c), cardPrice(c));
    const costs = [...seen.keys()].sort((a, b) => a - b);
    for (let i = 1; i < costs.length; i++)
      expect(seen.get(costs[i]!)!).toBeGreaterThan(seen.get(costs[i - 1]!)!);
  });

  it("starts at the dial Or can turn", () => {
    const before = TUNED.cardShelfPrice;
    try {
      TUNED.cardShelfPrice = 200;
      // Read at call time, so the panel moves the next purchase rather than
      // the next deploy.
      expect(cardPrice({ stats: { hp: 200, power: 10, attackSpeed: 1, moveSpeed: 1, range: "melee" } } as never)).toBe(200);
    } finally {
      TUNED.cardShelfPrice = before;
    }
  });

  it("never sells a copy for less than a random one out of a chest", () => {
    // A gold chest is 500 diamonds for eight cards, so a copy you did not
    // choose already costs about 62. A chosen one must not be cheaper.
    for (const c of CATALOG.values()) {
      if (c.seriesId === "system") continue;
      expect(cardPrice(c), c.id).toBeGreaterThanOrEqual(60);
    }
  });
});

/**
 * Or: *"in the shop itself, show me under every card how many out of how many
 * I have towards the next upgrade."* The level is half of that answer — what
 * the next one costs is worked out from it (levelCost).
 */
describe("the level on a card in the shop", () => {
  it("is the level the player actually has it at", async () => {
    const album = [
      { card_id: "dragons_01_flame_dragon", copies: 6, level: 5 },
      { card_id: "plants_01_thorn_sprout", copies: 2, level: 1 },
    ];
    const shelf = await cardsForSale(albumOf(album), ME, DAY);
    for (const item of shelf) {
      const id = (item.grants as { cardId: string }).cardId;
      expect(item.level, id).toBe(album.find((a) => a.card_id === id)!.level);
    }
  });

  it("is one when the album row has never been levelled", async () => {
    const shelf = await cardsForSale(albumOf([{ card_id: "furries_01_chuppy", copies: 1 }]), ME, DAY);
    expect(shelf[0]!.level).toBe(1);
  });
});
