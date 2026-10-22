/**
 * The shop, and the gifts.
 *
 * Or: "let's add a shop too (free for now) where you can buy avatars, emoji,
 * different card skins and so on. The shop will of course look like a petrol
 * station convenience store." And: "give me an option to assign specific cards
 * to a user, and to release a new card and hand it out free to everybody, or
 * by any filter I want, including scheduling it."
 *
 * ═══ EVERY WAY SOMETHING REACHES A PLAYER GOES THROUGH ONE FUNCTION ═══
 *
 * `deliver` below. Buying, a gift to one person, a mass promotion, a holiday
 * present that goes out on a timer — all of them end up there. That is on
 * purpose: "what can a player receive" is a question with one answer, and the
 * day a new kind of thing becomes sellable it becomes grantable in the same
 * commit rather than three weeks later.
 *
 * Diamonds are spent HERE and nowhere else. A browser cannot reach any of
 * these tables (see the migration): a client that could insert its own
 * player_items row would simply not spend anything.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ARENAS,
  givesSomething,
  isCardPack,
  packPrice,
  israelDay,
  type GrantFilters,
  type GrantGives,
} from "@amanda/shared";
import { grantChest, rollChest } from "./progress.js";
import { TODAY_CARD, cardsForSale } from "./cardShelf.js";
import { offersFor } from "./offers.js";
import { refreshAlbumPowerSoon } from "./albumPower.js";
import { track } from "./events.js";

export interface ShopItem {
  id: string;
  kind: string;
  name: { he: string; en?: string };
  blurb?: { he: string; en?: string } | null;
  grants: Record<string, unknown>;
  price_diamonds: number;
  price_cents: number | null;
  art: string | null;
  sort: number;
  /**
   * On sale: pay this instead, until `sale_until`.
   *
   * Or asked for *"sales"* in the admin panel. The full price stays in
   * `price_diamonds` on purpose — a sale that overwrites the old number is a
   * price change, and the thing that makes a sale work is seeing what it was.
   */
  sale_price_diamonds?: number | null;
  sale_until?: string | null;
  /**
   * How many of this card the player already holds.
   *
   * Only ever set on the card shelf, which is the one part of this shop that
   * is about a card you ALREADY own — so "do I need another" is the question
   * the page has to answer, and it cannot be answered without this number.
   * See cardShelf.ts.
   */
  copies?: number;
}

/**
 * What this item costs right now, and what it says it costs.
 *
 * One function, used by the shelf and by the till, because a sale that is
 * shown and not charged (or charged and not shown) is the worst possible bug
 * in a shop a child spends diamonds in.
 */
export function priceNow(
  item: { price_diamonds?: number | null; sale_price_diamonds?: number | null; sale_until?: string | null },
  now = new Date().toISOString(),
): { pay: number; was: number | null } {
  const full = item.price_diamonds ?? 0;
  const sale = item.sale_price_diamonds;
  // A sale with no end never ends, which is a price and not a sale — so an
  // end date is required for one to count.
  if (sale === null || sale === undefined || !item.sale_until) return { pay: full, was: null };
  if (item.sale_until < now) return { pay: full, was: null };
  if (sale >= full) return { pay: full, was: null };
  return { pay: sale, was: full };
}

/**
 * What is for sale right now.
 *
 * "Right now" is the point: an item with a window sits in the table all along
 * and simply is not offered outside it, so a weekend event is a pair of dates
 * rather than somebody remembering to switch it on and off again.
 */
export async function shopWindow(
  sb: SupabaseClient,
  now: string = new Date().toISOString(),
): Promise<ShopItem[]> {
  const { data } = await sb
    .from("shop_items")
    .select(
      "id, kind, name, blurb, grants, price_diamonds, price_cents, art, sort, sale_price_diamonds, sale_until",
    )
    .eq("active", true)
    .or(`available_from.is.null,available_from.lte.${now}`)
    .or(`available_until.is.null,available_until.gte.${now}`)
    .order("sort")
    .order("id");
  return (data ?? []) as ShopItem[];
}

/** What this player already holds, so the shop can say "yours". */
export async function ownedItems(sb: SupabaseClient, playerId: string): Promise<string[]> {
  const { data } = await sb.from("player_items").select("item_id").eq("player_id", playerId);
  return (data ?? []).map((r) => r.item_id as string);
}

/** Add copies of cards to an album, reading before writing. */
async function addCards(
  sb: SupabaseClient,
  playerId: string,
  cards: Array<{ cardId: string; copies: number }>,
): Promise<void> {
  for (const c of cards) {
    const copies = Math.max(1, Math.floor(c.copies || 1));
    const { data } = await sb
      .from("player_cards")
      .select("copies")
      .eq("player_id", playerId)
      .eq("card_id", c.cardId)
      .maybeSingle();
    await sb.from("player_cards").upsert(
      { player_id: playerId, card_id: c.cardId, copies: (data?.copies ?? 0) + copies },
      { onConflict: "player_id,card_id" },
    );
  }
}

/**
 * Hand something over. The one door.
 *
 * `source` is kept on the row because "what did people pay for" and "what did
 * we give away" are different questions, and this is the only place that can
 * ever answer either.
 */
export async function deliver(
  sb: SupabaseClient,
  playerId: string,
  gives: GrantGives,
  source: string,
): Promise<void> {
  if (gives.cards?.length) await addCards(sb, playerId, gives.cards);

  if (gives.diamonds) {
    const { data } = await sb.from("players").select("diamonds").eq("id", playerId).maybeSingle();
    await sb
      .from("players")
      .update({ diamonds: Math.max(0, (data?.diamonds ?? 0) + gives.diamonds) })
      .eq("id", playerId);
  }

  if (gives.items?.length) {
    await sb.from("player_items").upsert(
      gives.items.map((item_id) => ({ player_id: playerId, item_id, source })),
      { onConflict: "player_id,item_id", ignoreDuplicates: true },
    );
  }

  if (gives.chest) await grantChest(sb, playerId, rollChest(gives.chest));

  // The album changed, so what it is worth changed. Not awaited: see
  // albumPower.ts for why a stale total beats a failed delivery.
  if (gives.cards?.length || gives.chest) refreshAlbumPowerSoon(sb, playerId);
}

/**
 * ═══ THE THINGS YOU CAN BUY MORE THAN ONCE ═══
 *
 * Everything else in this shop is a possession: `player_items` holds one row
 * per item and the till refuses anything already in it, which is right for an
 * avatar and nonsense for these two.
 *
 * A CHEST is not a thing you own, it is a thing that happens to you — and Or
 * capped it himself: *"up to one chest of each kind every day."*
 *
 * A CARD you already have is the whole point of buying it: copies are the
 * upgrade currency, so the second one is worth exactly as much as the first.
 * Or: *"we'll also add the option to buy cards you already have, so you can
 * upgrade."*
 *
 * Neither writes a `player_items` row, because that row IS the refusal.
 */
const REPEATABLE = new Set(["chest", "card"]);

/**
 * ═══ WHAT A SHOP ROW ACTUALLY HANDS OVER ═══
 *
 * `grants` is deliberately open — "a new kind of thing to sell should be a
 * row, not a migration" — and the price of that is that two places write it
 * in two shapes. The admin panel (AdminShop.tsx) writes what the PICTURE
 * needs, because that is what it is choosing: `{cardId}` for a card and
 * `{kind}` for a chest. `deliver` reads what a GIFT gives: `{cards: [...]}`
 * and `{chest}`.
 *
 * Nothing noticed while neither was sellable. The moment a chest and a card
 * became buyable, a row made in the panel would have taken the diamonds and
 * handed over nothing at all — silently, because an empty GrantGives is a
 * perfectly valid gift of nothing.
 *
 * So the till translates. The panel writes the canonical shape now as well,
 * but rows already in the table do not rewrite themselves and an old build
 * of the panel is a thing that exists.
 */
export function shopGives(kind: string, grants: Record<string, unknown>): GrantGives {
  const g = { ...grants } as GrantGives & { kind?: unknown; cardId?: unknown; copies?: unknown };
  if (!g.chest && typeof g.kind === "string") g.chest = g.kind;
  /*
   * Only for a CARD. A skin carries a cardId too — it is a different look
   * for a card you already have — and handing one over would be giving away
   * the card itself every time somebody bought its coat.
   */
  if (!g.cards && kind === "card" && typeof g.cardId === "string")
    g.cards = [{ cardId: g.cardId, copies: Math.max(1, Number(g.copies) || 1) }];
  return g;
}

/**
 * Which of today's one-a-day items this player has already taken.
 *
 * Asked by the shelf as well as the till, so that "come back tomorrow" is
 * drawn from the same answer that would refuse the purchase — a shop that
 * offers something it will not sell is worse than one that sells nothing.
 */
export async function boughtToday(sb: SupabaseClient, playerId: string): Promise<string[]> {
  const { data } = await sb
    .from("chests")
    .select("bought_item")
    .eq("player_id", playerId)
    .eq("bought_day", israelDay(new Date()));
  return (data ?? []).map((r) => r.bought_item as string).filter(Boolean);
}

/** Buy one thing. Returns a message for the player, or null. */
export async function buy(
  sb: SupabaseClient,
  playerId: string,
  itemId: string,
  /**
   * The instant this purchase happens at, threaded rather than taken three
   * times.
   *
   * It decides the price (a sale ends), the offer (one per kind, per day)
   * and which day a chest counts against — and a purchase at 23:59:59 used
   * to read the clock separately for each of those. Tests pin it; everything
   * else leaves it alone.
   */
  at: Date = new Date(),
  /**
   * How many copies, for a card. One of CARD_PACKS; anything else is one.
   *
   * Or: *"say I am 6 Flame Dragons short of an upgrade — I will buy a pack
   * of 10."* Only a card can come in a pack: an avatar bought ten times is
   * one avatar.
   */
  count = 1,
): Promise<string | null> {
  const now = at.toISOString();
  /*
   * Today's card shelf is not in the table — it is worked out from the
   * player's own album and the calendar day (cardShelf.ts) — so it is asked
   * first, and asked HERE rather than believed from the request: an id is a
   * string anybody can type, and the shelf is the only thing that says this
   * player may buy a copy of this card today.
   */
  const cards = itemId.startsWith(TODAY_CARD) ? await cardsForSale(sb, playerId, at) : [];
  const shelf = cards.find((i) => i.id === itemId) ?? null;
  const { data: row } = shelf
    ? { data: null }
    : await sb
        .from("shop_items")
        .select(
          "id, kind, grants, price_diamonds, active, available_from, available_until, sale_price_diamonds, sale_until",
        )
        .eq("id", itemId)
        .maybeSingle();
  const item = shelf
    ? { ...shelf, active: true, available_from: null, available_until: null }
    : row;

  if (!item || !item.active) return "shop.gone";
  if (item.available_from && item.available_from > now) return "shop.notYet";
  if (item.available_until && item.available_until < now) return "shop.ended";

  const repeatable = REPEATABLE.has(item.kind as string);
  if (!repeatable) {
    const { data: already } = await sb
      .from("player_items")
      .select("item_id")
      .eq("player_id", playerId)
      .eq("item_id", itemId)
      .maybeSingle();
    if (already) return "shop.owned";
  }

  /*
   * One of each kind a day. Checked before the money and again by nothing
   * afterwards: two taps a second apart can both get past this, and the
   * balance guard below is what stops the second one paying — it reads a
   * balance that has already changed and returns "retry".
   */
  const day = israelDay(at);
  if (item.kind === "chest") {
    const { data: todays } = await sb
      .from("chests")
      .select("id")
      .eq("player_id", playerId)
      .eq("bought_item", itemId)
      .eq("bought_day", day)
      .maybeSingle();
    if (todays) return "shop.tomorrow";
  }

  /*
   * ═══ WHAT IT COSTS, INCLUDING TODAY'S OFFER ═══
   *
   * `priceNow` is the same function the shelf drew the tile with, so a sale
   * cannot be shown and not charged. What it needs is the row AS THE SHOP
   * SHOWED IT — one item per kind is marked down for the day, and that
   * marking lives in offers.ts rather than in the table.
   *
   * So the window is read again and run through the same function. It costs
   * one indexed query on a path that already does several, and it buys the
   * only property that matters here: the number on the tile and the number
   * taken out of the purse are worked out by one piece of code, from one
   * input, twice.
   *
   * The card shelf comes along when a card is being bought, because the card
   * offer is drawn from the four cards THIS player was shown.
   */
  const priced =
    offersFor([...(await shopWindow(sb, now)), ...cards], at).find((i) => i.id === itemId) ??
    (item as ShopItem);
  /*
   * A pack, if one was asked for and this is a thing that comes in packs.
   * `packPrice` is in shared so the chips on the item's page and the till
   * are the same arithmetic rather than two copies of it.
   */
  const pack = item.kind === "card" && isCardPack(count) ? count : 1;
  const price = packPrice(priceNow(priced, now).pay, pack);
  const { data: me } = await sb.from("players").select("diamonds").eq("id", playerId).maybeSingle();
  const have = me?.diamonds ?? 0;
  // The one refusal a code alone cannot carry: it has to say how many.
  if (have < price) return `shop.poor:${price - have}`;

  /*
   * Take the payment FIRST, and only against the balance we just read.
   *
   * `.eq("diamonds", have)` is the whole safety here: if anything else changed
   * the balance between the read and this write — a chest opening, a gift —
   * no row matches, nothing is charged, and the player is told to try again.
   * Without it, two taps a moment apart buy two things for the price of one.
   */
  if (price > 0) {
    const { data: paid } = await sb
      .from("players")
      .update({ diamonds: have - price })
      .eq("id", playerId)
      .eq("diamonds", have)
      .select("id");
    if (!paid?.length) return "retry";
  }

  if (!repeatable)
    await sb.from("player_items").insert({ player_id: playerId, item_id: itemId, source: "bought" });

  const one = shopGives(item.kind as string, (item.grants ?? {}) as Record<string, unknown>);
  // A pack is the same grant, as many times over. The copies are what an
  // upgrade spends, and leftovers count towards the next one.
  const gives: GrantGives =
    pack > 1 && one.cards?.length
      ? { ...one, cards: one.cards.map((c) => ({ ...c, copies: c.copies * pack })) }
      : one;
  if (item.kind === "chest" && gives.chest) {
    /*
     * ═══ A BOUGHT CHEST ARRIVES SHUT ═══
     *
     * `deliver` would roll it and hand over the contents, which is right for
     * a gift — the inbox has already said what it is — and wrong for this.
     * The chest is what was bought; opening it on the home screen, with the
     * lid and the cards coming out one at a time, is the thing the money was
     * for. So it is sealed here the same way a chest won in a match is
     * (progress.ts), with its contents rolled now and read when it opens.
     *
     * `bought_item` and `bought_day` are what make it one a day. They are
     * written in the same row as the chest, so there is no second table to
     * fall out of step with.
     */
    await sb.from("chests").insert({
      player_id: playerId,
      kind: gives.chest,
      opened_at: null,
      contents: rollChest(gives.chest),
      bought_item: itemId,
      bought_day: day,
    });
    // Everything else it may also hand over — an item, diamonds, a card.
    await deliver(sb, playerId, { ...gives, chest: undefined }, "bought");
  } else {
    // Some items ARE the thing (a card) rather than a thing you wear.
    await deliver(sb, playerId, gives, "bought");
  }
  /*
   * What was bought, and what was actually paid.
   *
   * `paid` rather than the list price, because the two differ during a sale
   * and the interesting question — "did the sale sell anything" — needs the
   * number that was charged at the moment it was charged. The list price is
   * still in the shop row if it is ever wanted.
   */
  track(sb, playerId, "buy", {
    item: itemId,
    kind: item.kind ?? null,
    paid: price,
    ...(pack > 1 ? { pack } : {}),
  });
  return null;
}

/**
 * Who a gift reaches.
 *
 * Returns ids, and the SAME function answers both "show me how many" and
 * "send it" — so the number Or is shown before pressing the button is the
 * number that gets it, not an estimate made by different code.
 */
export async function audienceOf(sb: SupabaseClient, filters: GrantFilters): Promise<string[]> {
  let q = sb.from("players").select("id, trophies, created_at, last_seen_at");

  // An arena IS a trophy band (see arenas.ts), so it narrows the same column.
  const arena = filters.arenaId ? ARENAS.find((a) => a.id === filters.arenaId) : undefined;
  const min = Math.max(filters.minTrophies ?? 0, arena?.from ?? 0);
  if (min > 0) q = q.gte("trophies", min);
  const next = arena ? ARENAS[ARENAS.indexOf(arena) + 1] : undefined;
  const maxes = [filters.maxTrophies, next ? next.from - 1 : undefined].filter(
    (n): n is number => typeof n === "number",
  );
  if (maxes.length) q = q.lte("trophies", Math.min(...maxes));

  if (filters.joinedBefore) q = q.lt("created_at", filters.joinedBefore);
  if (filters.joinedAfter) q = q.gt("created_at", filters.joinedAfter);
  if (filters.activeWithinDays) {
    const since = new Date(Date.now() - filters.activeWithinDays * 86_400_000).toISOString();
    q = q.gte("last_seen_at", since);
  }

  const { data } = await q;
  let ids = (data ?? []).map((p) => p.id as string);

  // "Only people who do not have it yet", so a present is a present.
  if (filters.missingCardId && ids.length) {
    const { data: have } = await sb
      .from("player_cards")
      .select("player_id")
      .eq("card_id", filters.missingCardId)
      .in("player_id", ids);
    const skip = new Set((have ?? []).map((r) => r.player_id as string));
    ids = ids.filter((id) => !skip.has(id));
  }

  return ids;
}

export interface RunReport {
  sent: number;
  skipped: number;
  error?: string;
}

/**
 * Send a gift out.
 *
 * ═══ WHY THE RECEIPTS TABLE EXISTS ═══
 *
 * A scheduled gift is run by a timer, and timers fire twice — a process
 * restarts at the wrong moment, two instances come up, somebody presses the
 * button while the clock is also firing. "Everybody gets a free legendary"
 * happening twice is not a bug that can be taken back.
 *
 * So every delivery writes a receipt, and the receipts are read first. The
 * second run finds them and gives nothing. `skipped` in the report is that
 * number, and it being large is the system working rather than failing.
 */
export async function runGrant(
  sb: SupabaseClient,
  grantId: string,
  notify: (playerId: string, grantName: string) => Promise<void>,
): Promise<RunReport> {
  const { data: g } = await sb
    .from("grants")
    .select("id, name, gives, filters, active")
    .eq("id", grantId)
    .maybeSingle();
  /*
   * These three stay in Hebrew, and that is not an oversight.
   *
   * Every other refusal in this file became a code because a player reads it
   * and a player may be reading in English. `runGrant` is called from
   * admin.ts and nowhere else — it is Or pressing "send this gift", one
   * adult, in Hebrew, where a sentence that explains itself is worth more
   * than a code the panel would have to translate back.
   */
  if (!g) return { sent: 0, skipped: 0, error: "אין מתנה כזאת." };
  if (!g.active) return { sent: 0, skipped: 0, error: "המתנה הזאת כבויה." };

  const gives = (g.gives ?? {}) as GrantGives;
  if (!givesSomething(gives)) return { sent: 0, skipped: 0, error: "המתנה ריקה." };

  const audience = await audienceOf(sb, (g.filters ?? {}) as GrantFilters);
  if (!audience.length) {
    await sb
      .from("grants")
      .update({ executed_at: new Date().toISOString(), recipients: 0 })
      .eq("id", grantId);
    return { sent: 0, skipped: 0 };
  }

  const { data: receipts } = await sb
    .from("grant_receipts")
    .select("player_id")
    .eq("grant_id", grantId)
    .in("player_id", audience);
  const already = new Set((receipts ?? []).map((r) => r.player_id as string));

  let sent = 0;
  for (const playerId of audience) {
    if (already.has(playerId)) continue;
    // The receipt goes FIRST. A crash after it gives one person nothing; a
    // crash before it could give everybody twice.
    const { error } = await sb
      .from("grant_receipts")
      .insert({ grant_id: grantId, player_id: playerId });
    if (error) continue; // somebody else got there first — which is the point
    await deliver(sb, playerId, gives, "grant");
    await notify(playerId, g.name as string);
    sent++;
  }

  await sb
    .from("grants")
    .update({
      executed_at: new Date().toISOString(),
      recipients: already.size + sent,
    })
    .eq("id", grantId);

  return { sent, skipped: already.size };
}
