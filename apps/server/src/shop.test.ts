import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { israelDay, packPrice } from "@amanda/shared";
import { audienceOf, boughtToday, buy, priceNow, runGrant, shopWindow, type ShopItem } from "./shop.js";
import { offersFor } from "./offers.js";
import { cardsForSale } from "./cardShelf.js";

/**
 * The two things in this file that cannot be allowed to be wrong.
 *
 *   NOBODY IS CHARGED TWICE, AND NOBODY GETS SOMETHING FOR NOTHING. Two taps
 *   a moment apart must not buy two things for the price of one.
 *
 *   A GIFT IS NOT HANDED OUT TWICE. A scheduled present is run by a timer,
 *   and timers fire twice — a restart at the wrong moment, two instances, a
 *   person pressing the button while the clock is also firing. "Everybody
 *   gets a free legendary" happening twice is not a mistake that can be taken
 *   back.
 *
 * Both are properties of the code, not of Postgres, so they are testable here
 * against a stand-in database. The schema's own constraints were checked
 * separately against the live project.
 */

/**
 * A small stand-in for supabase-js.
 *
 * It models the one thing these tests turn on: an `update` with an `eq` on a
 * column only matches while that column still holds the value it was read at.
 * That is the whole double-charge defence, so a stub that ignored it would
 * make the test green and the bug real.
 */
function fakeDb(seed: {
  players?: Record<string, { diamonds: number }>;
  items?: Record<string, Record<string, unknown>>;
  owned?: Array<{ player_id: string; item_id: string }>;
  receipts?: Array<{ grant_id: string; player_id: string }>;
  grants?: Record<string, Record<string, unknown>>;
  cards?: Array<{ player_id: string; card_id: string; copies: number }>;
  /** Sealed chests: won in a match (no bought_day) or bought today. */
  chests?: Array<Record<string, unknown>>;
}) {
  const players = { ...(seed.players ?? {}) };
  const items = seed.items ?? {};
  const owned = [...(seed.owned ?? [])];
  const receipts = [...(seed.receipts ?? [])];
  const grants = seed.grants ?? {};
  const cards = [...(seed.cards ?? [])];
  const chests = [...(seed.chests ?? [])];

  function table(name: string) {
    const filters: Record<string, unknown> = {};
    const api: Record<string, unknown> = {};
    const chain = () => api;

    api.select = chain;
    api.order = chain;
    api.in = (col: string, vals: unknown[]) => {
      filters[`in:${col}`] = vals;
      return api;
    };
    api.or = chain;
    api.not = chain;
    api.is = chain;
    api.lte = chain;
    api.gte = chain;
    api.lt = chain;
    api.gt = chain;
    api.eq = (col: string, val: unknown) => {
      filters[col] = val;
      return api;
    };

    const rowsOf = (): Record<string, unknown>[] => {
      if (name === "players")
        return Object.entries(players).map(([id, p]) => ({ id, ...p, trophies: 0 }));
      if (name === "shop_items")
        return Object.entries(items).map(([id, i]) => ({ id, active: true, ...i }));
      if (name === "player_items") return owned as Record<string, unknown>[];
      if (name === "grant_receipts") return receipts as Record<string, unknown>[];
      if (name === "grants")
        return Object.entries(grants).map(([id, g]) => ({ id, active: true, ...g }));
      if (name === "player_cards") return cards as Record<string, unknown>[];
      if (name === "chests") return chests;
      return [];
    };
    const matching = () =>
      rowsOf().filter((r) =>
        Object.entries(filters).every(([k, v]) =>
          k.startsWith("in:")
            ? (v as unknown[]).includes(r[k.slice(3)])
            : r[k] === v,
        ),
      );

    api.maybeSingle = () => Promise.resolve({ data: matching()[0] ?? null });
    api.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: matching(), count: matching().length, error: null });

    api.update = (patch: Record<string, unknown>) => {
      /*
       * Applied LAZILY, when the call is awaited or `.select()`ed.
       *
       * supabase-js attaches the `.eq()` filters AFTER `.update()`, so a stub
       * that wrote at `update()` time would write to every row — which made
       * the double-charge test pass while the defence it is testing did
       * nothing at all. The whole point of the test is that the filters are
       * in place by the time the write happens.
       */
      const u = { ...api } as Record<string, unknown>;
      let done = false;
      const apply = () => {
        if (done) return [] as Record<string, unknown>[];
        done = true;
        const hit = matching();
        for (const row of hit) {
          if (name === "players" && typeof row.id === "string")
            players[row.id] = { ...players[row.id]!, ...(patch as { diamonds: number }) };
          if (name === "grants" && typeof row.id === "string")
            grants[row.id] = { ...grants[row.id], ...patch };
        }
        return hit;
      };
      u.eq = (col: string, val: unknown) => {
        filters[col] = val;
        return u;
      };
      u.select = () => Promise.resolve({ data: apply(), error: null });
      u.then = (resolve: (v: unknown) => unknown) => {
        apply();
        return resolve({ data: null, error: null });
      };
      return u;
    };

    api.insert = (row: Record<string, unknown>) => {
      if (name === "grant_receipts") {
        const dup = receipts.some(
          (r) => r.grant_id === row.grant_id && r.player_id === row.player_id,
        );
        if (dup) return Promise.resolve({ error: { message: "duplicate key" } });
        receipts.push(row as { grant_id: string; player_id: string });
      }
      if (name === "player_items") owned.push(row as { player_id: string; item_id: string });
      if (name === "chests") chests.push(row);
      return Promise.resolve({ error: null });
    };
    api.upsert = (rows: unknown) => {
      const list = Array.isArray(rows) ? rows : [rows];
      for (const r of list as Record<string, unknown>[]) {
        if (name === "player_cards") {
          const i = cards.findIndex(
            (c) => c.player_id === r.player_id && c.card_id === r.card_id,
          );
          const next = r as unknown as { player_id: string; card_id: string; copies: number };
          if (i >= 0) cards[i] = next;
          else cards.push(next);
        }
        if (name === "player_items")
          if (!owned.some((o) => o.player_id === r.player_id && o.item_id === r.item_id))
            owned.push(r as { player_id: string; item_id: string });
      }
      return Promise.resolve({ error: null });
    };
    api.delete = () => ({ or: () => Promise.resolve({ error: null }) });
    return api;
  }

  return {
    sb: { from: table } as unknown as SupabaseClient,
    state: { players, owned, receipts, cards, grants, chests },
  };
}

const ME = "player-1";
/**
 * The instant every purchase in this file happens at.
 *
 * Pinned because the price now depends on the DAY: one item per kind is on
 * offer, drawn from the calendar date (offers.ts). Without this the expected
 * numbers below would be right today and wrong tomorrow.
 */
const NOW = new Date("2026-10-22T09:00:00Z");

/**
 * What the shop SHOWS for this item right now — the number on the tile.
 *
 * Every assertion about money below is written against this rather than
 * against a literal, and that is the property worth testing: one item per
 * kind is marked down for the day (offers.ts), and what must never happen is
 * the shelf saying one number and the till taking another. The arithmetic of
 * the discount itself is pinned in offers.test.ts, with literals.
 */
async function shown(sb: SupabaseClient, itemId: string, shelf: ShopItem[] = []): Promise<number> {
  const window = offersFor([...(await shopWindow(sb, NOW.toISOString())), ...shelf], NOW);
  const item = window.find((i) => i.id === itemId);
  if (!item) throw new Error(`${itemId} is not in the window`);
  return priceNow(item, NOW.toISOString()).pay;
}

describe("buying", () => {
  const hat = { kind: "avatar", grants: { avatar: "av_yeti" }, price_diamonds: 100 };

  it("takes the diamonds and hands the thing over", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 250 } },
      items: { "avatar.yeti": hat },
    });
    const pay = await shown(sb, "avatar.yeti");
    expect(await buy(sb, ME, "avatar.yeti", NOW)).toBeNull();
    expect(state.players[ME]!.diamonds).toBe(250 - pay);
    expect(state.owned.some((o) => o.item_id === "avatar.yeti")).toBe(true);
  });

  it("refuses when there are not enough, and charges nothing", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 40 } },
      items: { "avatar.yeti": hat },
    });
    // The one code that carries a value: how many are missing.
    expect(await buy(sb, ME, "avatar.yeti", NOW)).toBe(`shop.poor:${(await shown(sb, "avatar.yeti")) - 40}`);
    expect(state.players[ME]!.diamonds).toBe(40);
    expect(state.owned).toHaveLength(0);
  });

  it("will not sell the same thing twice", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 500 } },
      items: { "avatar.yeti": hat },
      owned: [{ player_id: ME, item_id: "avatar.yeti" }],
    });
    expect(await buy(sb, ME, "avatar.yeti", NOW)).toBe("shop.owned");
    expect(state.players[ME]!.diamonds).toBe(500);
  });

  it("two taps a moment apart buy one thing, not two", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 150 } },
      items: { "avatar.yeti": hat },
    });
    // Both read the same balance before either writes — which is exactly the
    // race. The `.eq("diamonds", have)` on the charge is what settles it.
    const pay = await shown(sb, "avatar.yeti");
    const [a, b] = await Promise.all([buy(sb, ME, "avatar.yeti", NOW), buy(sb, ME, "avatar.yeti", NOW)]);
    expect([a, b].filter((r) => r === null)).toHaveLength(1);
    expect(state.players[ME]!.diamonds).toBe(150 - pay);
  });

  it("refuses an item that is not in the shop", async () => {
    const { sb } = fakeDb({ players: { [ME]: { diamonds: 500 } }, items: {} });
    expect(await buy(sb, ME, "avatar.nope", NOW)).toBe("shop.gone");
  });

  it("refuses one whose window has closed, however it is asked for", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 500 } },
      items: {
        "avatar.yeti": { ...hat, available_until: "2000-01-01T00:00:00.000Z" },
      },
    });
    expect(await buy(sb, ME, "avatar.yeti", NOW)).toBe("shop.ended");
    expect(state.players[ME]!.diamonds).toBe(500);
  });
});

describe("a gift is handed out once", () => {
  const gift = {
    name: "מתנה לחג",
    gives: { cards: [{ cardId: "furries_01_chuppy", copies: 2 }], diamonds: 50 },
    filters: {},
  };

  it("reaches everybody the first time", async () => {
    const { sb, state } = fakeDb({
      players: { a: { diamonds: 0 }, b: { diamonds: 0 } },
      grants: { g1: gift },
    });
    const report = await runGrant(sb, "g1", async () => {});
    expect(report.sent).toBe(2);
    expect(report.skipped).toBe(0);
    expect(state.players.a!.diamonds).toBe(50);
    expect(state.cards.filter((c) => c.card_id === "furries_01_chuppy")).toHaveLength(2);
  });

  it("and gives nothing at all the second time", async () => {
    const { sb, state } = fakeDb({
      players: { a: { diamonds: 0 }, b: { diamonds: 0 } },
      grants: { g1: gift },
    });
    await runGrant(sb, "g1", async () => {});
    const second = await runGrant(sb, "g1", async () => {});
    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(2);
    // The diamonds from the first run, and not a single one from the second.
    expect(state.players.a!.diamonds).toBe(50);
  });

  it("gives the people who were missed, and only them", async () => {
    const { sb, state } = fakeDb({
      players: { a: { diamonds: 0 }, b: { diamonds: 0 } },
      grants: { g1: gift },
      receipts: [{ grant_id: "g1", player_id: "a" }],
    });
    const report = await runGrant(sb, "g1", async () => {});
    expect(report.sent).toBe(1);
    expect(report.skipped).toBe(1);
    expect(state.players.a!.diamonds).toBe(0);
    expect(state.players.b!.diamonds).toBe(50);
  });

  it("refuses an empty gift rather than quietly sending nothing", async () => {
    const { sb } = fakeDb({
      players: { a: { diamonds: 0 } },
      grants: { g1: { name: "ריקה", gives: {}, filters: {} } },
    });
    expect((await runGrant(sb, "g1", async () => {})).error).toBe("המתנה ריקה.");
  });

  it("refuses one that has been switched off", async () => {
    const { sb } = fakeDb({
      players: { a: { diamonds: 0 } },
      grants: { g1: { ...gift, active: false } },
    });
    expect((await runGrant(sb, "g1", async () => {})).error).toBe("המתנה הזאת כבויה.");
  });
});

describe("who a gift reaches", () => {
  it("everybody, when nothing narrows it", async () => {
    const { sb } = fakeDb({ players: { a: { diamonds: 0 }, b: { diamonds: 0 } } });
    expect(await audienceOf(sb, {})).toHaveLength(2);
  });

  it("leaves out whoever already holds the card being given", async () => {
    const { sb } = fakeDb({
      players: { a: { diamonds: 0 }, b: { diamonds: 0 } },
      cards: [{ player_id: "a", card_id: "furries_01_chuppy", copies: 1 }],
    });
    expect(await audienceOf(sb, { missingCardId: "furries_01_chuppy" })).toEqual(["b"]);
  });
});

/**
 * A sale is shown and charged by the same function, and these are the four
 * ways a half-written one could quietly become a permanent price cut.
 *
 * Or asked for *"sales"* in the admin panel. The danger in a shop a child
 * spends diamonds in is not that a sale fails to apply — it is that it
 * applies forever, or that the tile says one number and the till takes
 * another. Both of those are this function being wrong, which is why the
 * shelf and the till both call it rather than each doing the arithmetic.
 */
describe("what an item costs right now", () => {
  const SOON = "2030-01-01T00:00:00.000Z";
  const PAST = "2020-01-01T00:00:00.000Z";
  const NOW = "2026-10-07T00:00:00.000Z";

  it("is the full price when there is no sale", () => {
    expect(priceNow({ price_diamonds: 120 }, NOW)).toEqual({ pay: 120, was: null });
  });

  it("is the sale price while the sale is on, and says what it was", () => {
    expect(
      priceNow({ price_diamonds: 120, sale_price_diamonds: 80, sale_until: SOON }, NOW),
    ).toEqual({ pay: 80, was: 120 });
  });

  it("goes back to the full price by itself once the date passes", () => {
    expect(
      priceNow({ price_diamonds: 120, sale_price_diamonds: 80, sale_until: PAST }, NOW),
    ).toEqual({ pay: 120, was: null });
  });

  /*
   * A discount with no end never ends, which is a price change wearing a
   * sale's clothes — and it would show a struck-through "was" forever.
   */
  it("ignores a discount with no end date", () => {
    expect(
      priceNow({ price_diamonds: 120, sale_price_diamonds: 80, sale_until: null }, NOW),
    ).toEqual({ pay: 120, was: null });
  });

  /* A "sale" that costs more is a typo, and it must not be charged. */
  it("never charges more than the full price", () => {
    expect(
      priceNow({ price_diamonds: 120, sale_price_diamonds: 150, sale_until: SOON }, NOW),
    ).toEqual({ pay: 120, was: null });
  });

  it("allows a free giveaway", () => {
    expect(
      priceNow({ price_diamonds: 120, sale_price_diamonds: 0, sale_until: SOON }, NOW),
    ).toEqual({ pay: 0, was: 120 });
  });
});

/**
 * ═══ THE FIRST THINGS IN THIS SHOP YOU CAN BUY TWICE ═══
 *
 * Or: *"we'll add the option to buy chests too — up to one chest of each kind
 * every day. We'll also add the option to buy cards you already have, so you
 * can upgrade."*
 *
 * Everything the shop sold until now was a possession, and `player_items`
 * holding one row per item was the whole refusal. Neither of these is a
 * possession: a chest is opened and gone, and a second copy of a card is the
 * reason to buy one.
 */
describe("a chest on the shelf", () => {
  const chest = { kind: "chest", grants: { chest: "wood" }, price_diamonds: 80 };
  const today = israelDay(NOW);

  it("arrives shut, with its contents already rolled", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 100 } },
      items: { "chest.wood": chest },
    });
    const pay = await shown(sb, "chest.wood");
    expect(await buy(sb, ME, "chest.wood", NOW)).toBeNull();
    expect(state.players[ME]!.diamonds).toBe(100 - pay);
    expect(state.chests).toHaveLength(1);
    const got = state.chests[0]!;
    expect(got.kind).toBe("wood");
    // Shut: opening it on the home screen is what was paid for.
    expect(got.opened_at).toBeNull();
    expect((got.contents as { cards: string[] }).cards.length).toBeGreaterThan(0);
  });

  it("is not written into the things you own", async () => {
    // A `player_items` row IS the "already yours" refusal, so writing one
    // would make tomorrow's chest unbuyable for ever.
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 100 } },
      items: { "chest.wood": chest },
    });
    await buy(sb, ME, "chest.wood", NOW);
    expect(state.owned).toHaveLength(0);
  });

  it("refuses the second one today, and charges nothing for it", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 500 } },
      items: { "chest.wood": chest },
      chests: [
        { player_id: ME, kind: "wood", bought_item: "chest.wood", bought_day: today },
      ],
    });
    expect(await buy(sb, ME, "chest.wood", NOW)).toBe("shop.tomorrow");
    expect(state.players[ME]!.diamonds).toBe(500);
    expect(state.chests).toHaveLength(1);
  });

  it("sells a different kind on the same day", async () => {
    // "One of each kind", not one chest.
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 500 } },
      items: {
        "chest.wood": chest,
        "chest.gold": { kind: "chest", grants: { chest: "gold" }, price_diamonds: 500 },
      },
      chests: [
        { player_id: ME, kind: "wood", bought_item: "chest.wood", bought_day: today },
      ],
    });
    expect(await buy(sb, ME, "chest.gold", NOW)).toBeNull();
    expect(state.chests).toHaveLength(2);
  });

  it("does not count yesterday's, or one won in a match", async () => {
    const { sb } = fakeDb({
      players: { [ME]: { diamonds: 500 } },
      items: { "chest.wood": chest },
      chests: [
        // Yesterday's purchase.
        { player_id: ME, kind: "wood", bought_item: "chest.wood", bought_day: "2020-01-01" },
        // One won in a match: no purchase on it at all.
        { player_id: ME, kind: "wood", bought_item: null, bought_day: null },
      ],
    });
    expect(await buy(sb, ME, "chest.wood", NOW)).toBeNull();
  });

  it("tells the shelf what has already been taken today", async () => {
    const { sb } = fakeDb({
      players: { [ME]: { diamonds: 500 } },
      items: { "chest.wood": chest },
      chests: [
        { player_id: ME, kind: "wood", bought_item: "chest.wood", bought_day: today },
        { player_id: ME, kind: "gold", bought_item: "chest.gold", bought_day: "2020-01-01" },
      ],
    });
    // The shelf and the till read the same day, so a chest cannot be offered
    // and then refused.
    expect(await boughtToday(sb, ME)).toEqual(["chest.wood"]);
  });
});

describe("a card you already have", () => {
  const card = {
    kind: "card",
    grants: { cards: [{ cardId: "dragons_01_flame_dragon", copies: 1 }] },
    price_diamonds: 60,
  };

  it("can be bought again, because copies are the upgrade", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 200 } },
      items: { "card.flame": card },
      cards: [{ player_id: ME, card_id: "dragons_01_flame_dragon", copies: 2 }],
    });
    const pay = await shown(sb, "card.flame");
    expect(await buy(sb, ME, "card.flame", NOW)).toBeNull();
    expect(state.cards[0]!.copies).toBe(3);
    // And again, with no daily cap: only chests have one.
    expect(await buy(sb, ME, "card.flame", NOW)).toBeNull();
    expect(state.cards[0]!.copies).toBe(4);
    expect(state.players[ME]!.diamonds).toBe(200 - pay * 2);
  });
});

describe("everything else is still bought once", () => {
  it("refuses an avatar you own", async () => {
    const { sb } = fakeDb({
      players: { [ME]: { diamonds: 500 } },
      items: { "avatar.yeti": { kind: "avatar", grants: {}, price_diamonds: 100 } },
      owned: [{ player_id: ME, item_id: "avatar.yeti" }],
    });
    expect(await buy(sb, ME, "avatar.yeti", NOW)).toBe("shop.owned");
  });
});

/**
 * The panel writes one shape and the till reads another, and nothing noticed
 * while neither a chest nor a card could be bought. See shopGives.
 */
describe("a row made in the admin panel", () => {
  it("hands over the chest it chose, written the panel's way", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 300 } },
      // What AdminShop used to write: {kind}, not {chest}.
      items: { "chest.old": { kind: "chest", grants: { kind: "silver" }, price_diamonds: 200 } },
    });
    expect(await buy(sb, ME, "chest.old", NOW)).toBeNull();
    expect(state.chests).toHaveLength(1);
    expect(state.chests[0]!.kind).toBe("silver");
  });

  it("hands over the card it chose", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 300 } },
      // The panel picks a card by id, because that is what the picture needs.
      items: {
        "card.one": {
          kind: "card",
          grants: { cardId: "dragons_01_flame_dragon" },
          price_diamonds: 60,
        },
      },
    });
    expect(await buy(sb, ME, "card.one", NOW)).toBeNull();
    expect(state.cards).toEqual([
      { player_id: ME, card_id: "dragons_01_flame_dragon", copies: 1 },
    ]);
  });

  it("does not give away the card when a SKIN for it is bought", async () => {
    // A skin carries a cardId too: it is a coat for a card you have.
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 300 } },
      items: {
        "skin.one": {
          kind: "skin",
          grants: { cardId: "dragons_01_flame_dragon", skin: "gold" },
          price_diamonds: 60,
        },
      },
    });
    expect(await buy(sb, ME, "skin.one", NOW)).toBeNull();
    expect(state.cards).toHaveLength(0);
    expect(state.owned.some((o) => o.item_id === "skin.one")).toBe(true);
  });
});

/**
 * ═══ AND THE CARDS ON THE SHELF ═══
 *
 * Today's cards are not rows in a table (cardShelf.ts): they are four cards
 * out of this player's own album, drawn from the calendar day. Which means
 * the till is the only thing standing between "an id is a string" and a free
 * copy of anything in the game.
 */
describe("buying one of today's cards", () => {
  const album = [
    { player_id: ME, card_id: "dragons_01_flame_dragon", copies: 2 },
    { player_id: ME, card_id: "plants_01_thorn_sprout", copies: 1 },
    { player_id: ME, card_id: "giants_10_titan_king", copies: 1 },
  ];

  it("adds a copy and charges what the shelf showed", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { diamonds: 900 } }, cards: [...album] });
    const shelf = await cardsForSale(sb, ME, NOW);
    expect(shelf.length).toBeGreaterThan(0);
    const buying = shelf[0]!;
    const was = state.cards.find(
      (c) => c.card_id === (buying.grants as { cardId: string }).cardId,
    )!.copies;

    const pay = await shown(sb, buying.id, shelf);
    expect(await buy(sb, ME, buying.id, NOW)).toBeNull();
    expect(state.players[ME]!.diamonds).toBe(900 - pay);
    expect(
      state.cards.find((c) => c.card_id === (buying.grants as { cardId: string }).cardId)!.copies,
    ).toBe(was + 1);
  });

  it("leaves nothing in player_items, so it can be bought again", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { diamonds: 900 } }, cards: [...album] });
    const shelf = await cardsForSale(sb, ME, NOW);
    await buy(sb, ME, shelf[0]!.id, NOW);
    expect(state.owned).toHaveLength(0);
    expect(await buy(sb, ME, shelf[0]!.id, NOW)).toBeNull();
  });

  it("refuses a card that is not on today's shelf, and charges nothing", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { diamonds: 900 } }, cards: [...album] });
    // A card nobody in this test owns. The id is well-formed; that is the point.
    expect(await buy(sb, ME, "card.today.insects_10_insect_empress", NOW)).toBe("shop.gone");
    expect(state.players[ME]!.diamonds).toBe(900);
    expect(state.cards).toHaveLength(3);
  });

  it("refuses when there are not enough diamonds", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { diamonds: 10 } }, cards: [...album] });
    const shelf = await cardsForSale(sb, ME, NOW);
    expect(await buy(sb, ME, shelf[0]!.id, NOW)).toMatch(/^shop\.poor:/);
    expect(state.players[ME]!.diamonds).toBe(10);
  });
});

/**
 * ═══ A PACK OF COPIES ═══
 *
 * Or: *"say I am 6 Flame Dragons short of an upgrade — I will buy a pack of
 * 10 Flame Dragons, then upgrade, and I will also have +2 towards the next
 * upgrade."*
 */
describe("buying a pack of a card", () => {
  const album = [{ player_id: ME, card_id: "dragons_01_flame_dragon", copies: 2 }];

  it("adds that many copies and charges the pack price", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { diamonds: 9000 } }, cards: [...album] });
    const shelf = await cardsForSale(sb, ME, NOW);
    const flame = shelf.find(
      (i) => (i.grants as { cardId: string }).cardId === "dragons_01_flame_dragon",
    )!;
    const unit = await shown(sb, flame.id, shelf);

    expect(await buy(sb, ME, flame.id, NOW, 10)).toBeNull();
    expect(state.cards[0]!.copies, "two, and ten more").toBe(12);
    expect(state.players[ME]!.diamonds).toBe(9000 - packPrice(unit, 10));
  });

  it("is cheaper than pressing buy ten times", async () => {
    const { sb } = fakeDb({ players: { [ME]: { diamonds: 9000 } }, cards: [...album] });
    const shelf = await cardsForSale(sb, ME, NOW);
    const flame = shelf[0]!;
    const unit = await shown(sb, flame.id, shelf);
    expect(packPrice(unit, 10)).toBeLessThan(unit * 10);
  });

  it("refuses to sell a pack of anything that is not a card", async () => {
    // Ten avatars is one avatar.
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 900 } },
      items: { "avatar.yeti": { kind: "avatar", grants: { avatar: "av_yeti" }, price_diamonds: 100 } },
    });
    const pay = await shown(sb, "avatar.yeti");
    expect(await buy(sb, ME, "avatar.yeti", NOW, 10)).toBeNull();
    expect(state.players[ME]!.diamonds, "charged for one").toBe(900 - pay);
    expect(state.owned).toHaveLength(1);
  });

  it("treats a count that is not a pack as one copy", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { diamonds: 9000 } }, cards: [...album] });
    const shelf = await cardsForSale(sb, ME, NOW);
    const flame = shelf.find(
      (i) => (i.grants as { cardId: string }).cardId === "dragons_01_flame_dragon",
    )!;
    const unit = await shown(sb, flame.id, shelf);
    // 7 is not on the shelf, and 10000 is a request rather than a pack.
    expect(await buy(sb, ME, flame.id, NOW, 7)).toBeNull();
    expect(state.cards[0]!.copies).toBe(3);
    expect(await buy(sb, ME, flame.id, NOW, 10000)).toBeNull();
    expect(state.cards[0]!.copies).toBe(4);
    expect(state.players[ME]!.diamonds).toBe(9000 - unit * 2);
  });

  it("still refuses a pack of a card that is not on today's shelf", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { diamonds: 9000 } }, cards: [...album] });
    expect(await buy(sb, ME, "card.today.insects_10_insect_empress", NOW, 10)).toBe("shop.gone");
    expect(state.players[ME]!.diamonds).toBe(9000);
  });
});
