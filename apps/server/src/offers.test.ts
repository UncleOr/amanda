/**
 * **One thing from each shelf, cheaper, today.**
 *
 * Or: *"and offers at the top of the shop. One product from each category."*
 *
 * The numbers here are literals on purpose. Everything else that touches a
 * price asks `priceNow` and compares what the shelf showed against what the
 * till took — which proves they agree and proves nothing about what either
 * of them is. This file is the other half: what the discount actually IS.
 */
import { describe, expect, it } from "vitest";
import { offersFor } from "./offers.js";
import { priceNow, type ShopItem } from "./shop.js";

const NOW = new Date("2026-10-22T09:00:00Z");
const AT = NOW.toISOString();

const item = (id: string, kind: string, price: number, extra: Partial<ShopItem> = {}): ShopItem => ({
  id,
  kind,
  name: { he: id },
  blurb: null,
  grants: {},
  price_diamonds: price,
  price_cents: null,
  art: null,
  sort: 0,
  ...extra,
});

/** A shop with several of everything. */
const SHOP: ShopItem[] = [
  item("avatar.a", "avatar", 150),
  item("avatar.b", "avatar", 250),
  item("avatar.c", "avatar", 150),
  item("phrase.a", "phrase", 120),
  item("phrase.b", "phrase", 80),
  item("chest.wood", "chest", 80),
  item("chest.gold", "chest", 500),
];

const deals = (items: ShopItem[], now = NOW) =>
  offersFor(items, now).filter((i) => priceNow(i, now.toISOString()).was !== null);

describe("today's offers", () => {
  it("are one per category, no more and no fewer", () => {
    const got = deals(SHOP);
    expect(got).toHaveLength(3);
    expect(new Set(got.map((i) => i.kind))).toEqual(new Set(["avatar", "phrase", "chest"]));
  });

  it("leave every other price exactly as it was", () => {
    const after = offersFor(SHOP, NOW);
    const cut = new Set(deals(SHOP).map((i) => i.id));
    for (const i of after) {
      if (cut.has(i.id)) continue;
      expect(priceNow(i, AT).pay, i.id).toBe(i.price_diamonds);
    }
  });

  it("take something off, and show what it was", () => {
    for (const i of deals(SHOP)) {
      const { pay, was } = priceNow(i, AT);
      expect(was, i.id).toBe(i.price_diamonds);
      expect(pay, i.id).toBeLessThan(was!);
      // Never more than 40% off: a thing you saved a week for being half
      // price the next day is a worse lesson than the shop is worth.
      expect(pay, i.id).toBeGreaterThanOrEqual(Math.round((was! * 0.6) / 10) * 10);
    }
  });

  it("are round numbers", () => {
    for (const i of deals(SHOP)) expect(priceNow(i, AT).pay % 10, i.id).toBe(0);
  });

  it("end at midnight in Israel", () => {
    for (const i of deals(SHOP)) expect(i.sale_until).toBe("2026-10-23T00:00:00+03:00");
  });

  it("are the same all day and different tomorrow", () => {
    const morning = deals(SHOP, new Date("2026-10-22T04:00:00Z")).map((i) => i.id);
    const evening = deals(SHOP, new Date("2026-10-22T20:00:00Z")).map((i) => i.id);
    expect(evening).toEqual(morning);

    /*
     * Over a fortnight, not against tomorrow: a draw is allowed to land on
     * the same item twice in a row, and a test that forbids it is a test
     * that fails one morning for no reason.
     */
    const seen = new Set<string>();
    for (let d = 1; d <= 14; d++)
      for (const i of deals(SHOP, new Date(`2026-11-${String(d).padStart(2, "0")}`)))
        seen.add(i.id);
    expect(seen.size).toBeGreaterThan(3);
  });

  it("is this, today — the arithmetic itself", () => {
    // The one place a number is written down. If the draw or the cuts
    // change, this is the test that says so.
    const got = Object.fromEntries(deals(SHOP).map((i) => [i.id, priceNow(i, AT).pay]));
    // 250 less 30%, 120 less 40%, 80 less 25%, each rounded down to a round
    // number. The cut is drawn per item, for the day.
    expect(got).toEqual({ "avatar.b": 170, "phrase.a": 70, "chest.wood": 60 });
  });
});

describe("a sale Or set himself", () => {
  const his = item("avatar.b", "avatar", 250, {
    sale_price_diamonds: 99,
    sale_until: "2099-01-01T00:00:00Z",
  });
  const shop = SHOP.map((i) => (i.id === "avatar.b" ? his : i));

  it("is that category's offer", () => {
    const avatars = deals(shop).filter((i) => i.kind === "avatar");
    expect(avatars.map((i) => i.id)).toEqual(["avatar.b"]);
  });

  it("is charged at the price he set, untouched", () => {
    const after = offersFor(shop, NOW).find((i) => i.id === "avatar.b")!;
    expect(priceNow(after, AT)).toEqual({ pay: 99, was: 250 });
  });

  it("does not stop the other shelves having one", () => {
    expect(deals(shop)).toHaveLength(3);
  });
});

describe("what cannot be put on offer", () => {
  it("a free item", () => {
    expect(deals([item("free.one", "emoji", 0)])).toHaveLength(0);
  });

  it("one too cheap for a discount to be a number", () => {
    expect(deals([item("tiny.one", "emoji", 10)])).toHaveLength(0);
  });

  it("an empty shop", () => {
    expect(offersFor([], NOW)).toEqual([]);
  });
});
