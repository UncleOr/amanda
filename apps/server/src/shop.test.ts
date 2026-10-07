import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { audienceOf, buy, priceNow, runGrant } from "./shop.js";

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
}) {
  const players = { ...(seed.players ?? {}) };
  const items = seed.items ?? {};
  const owned = [...(seed.owned ?? [])];
  const receipts = [...(seed.receipts ?? [])];
  const grants = seed.grants ?? {};
  const cards = [...(seed.cards ?? [])];

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
    state: { players, owned, receipts, cards, grants },
  };
}

const ME = "player-1";

describe("buying", () => {
  const hat = { kind: "avatar", grants: { avatar: "av_yeti" }, price_diamonds: 100 };

  it("takes the diamonds and hands the thing over", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 250 } },
      items: { "avatar.yeti": hat },
    });
    expect(await buy(sb, ME, "avatar.yeti")).toBeNull();
    expect(state.players[ME]!.diamonds).toBe(150);
    expect(state.owned.some((o) => o.item_id === "avatar.yeti")).toBe(true);
  });

  it("refuses when there are not enough, and charges nothing", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 40 } },
      items: { "avatar.yeti": hat },
    });
    expect(await buy(sb, ME, "avatar.yeti")).toBe("חסרים 60 יהלומים.");
    expect(state.players[ME]!.diamonds).toBe(40);
    expect(state.owned).toHaveLength(0);
  });

  it("will not sell the same thing twice", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 500 } },
      items: { "avatar.yeti": hat },
      owned: [{ player_id: ME, item_id: "avatar.yeti" }],
    });
    expect(await buy(sb, ME, "avatar.yeti")).toBe("זה כבר שלך.");
    expect(state.players[ME]!.diamonds).toBe(500);
  });

  it("two taps a moment apart buy one thing, not two", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 150 } },
      items: { "avatar.yeti": hat },
    });
    // Both read the same balance before either writes — which is exactly the
    // race. The `.eq("diamonds", have)` on the charge is what settles it.
    const [a, b] = await Promise.all([buy(sb, ME, "avatar.yeti"), buy(sb, ME, "avatar.yeti")]);
    expect([a, b].filter((r) => r === null)).toHaveLength(1);
    expect(state.players[ME]!.diamonds).toBe(50);
  });

  it("refuses an item that is not in the shop", async () => {
    const { sb } = fakeDb({ players: { [ME]: { diamonds: 500 } }, items: {} });
    expect(await buy(sb, ME, "avatar.nope")).toBe("הפריט הזה לא בחנות.");
  });

  it("refuses one whose window has closed, however it is asked for", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 500 } },
      items: {
        "avatar.yeti": { ...hat, available_until: "2000-01-01T00:00:00.000Z" },
      },
    });
    expect(await buy(sb, ME, "avatar.yeti")).toBe("זה כבר נגמר.");
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
