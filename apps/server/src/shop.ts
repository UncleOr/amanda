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
import { ARENAS, givesSomething, type GrantFilters, type GrantGives } from "@amanda/shared";
import { grantChest, rollChest } from "./progress.js";
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
export async function shopWindow(sb: SupabaseClient): Promise<ShopItem[]> {
  const now = new Date().toISOString();
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

/** Buy one thing. Returns a message for the player, or null. */
export async function buy(
  sb: SupabaseClient,
  playerId: string,
  itemId: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const { data: item } = await sb
    .from("shop_items")
    .select(
      "id, kind, grants, price_diamonds, active, available_from, available_until, sale_price_diamonds, sale_until",
    )
    .eq("id", itemId)
    .maybeSingle();

  if (!item || !item.active) return "הפריט הזה לא בחנות.";
  if (item.available_from && item.available_from > now) return "עוד לא.";
  if (item.available_until && item.available_until < now) return "זה כבר נגמר.";

  const { data: already } = await sb
    .from("player_items")
    .select("item_id")
    .eq("player_id", playerId)
    .eq("item_id", itemId)
    .maybeSingle();
  if (already) return "זה כבר שלך.";

  // The same function the shelf used to draw the price, so the number on the
  // tile and the number taken out of the purse cannot drift apart.
  const price = priceNow(item, now).pay;
  const { data: me } = await sb.from("players").select("diamonds").eq("id", playerId).maybeSingle();
  const have = me?.diamonds ?? 0;
  if (have < price) return `חסרים ${price - have} יהלומים.`;

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
    if (!paid?.length) return "משהו השתנה באותו רגע. נסה שוב.";
  }

  await sb.from("player_items").insert({ player_id: playerId, item_id: itemId, source: "bought" });
  // Some items ARE the thing (a card, a chest) rather than a thing you wear.
  await deliver(sb, playerId, (item.grants ?? {}) as GrantGives, "bought");
  /*
   * What was bought, and what was actually paid.
   *
   * `paid` rather than the list price, because the two differ during a sale
   * and the interesting question — "did the sale sell anything" — needs the
   * number that was charged at the moment it was charged. The list price is
   * still in the shop row if it is ever wanted.
   */
  track(sb, playerId, "buy", { item: itemId, kind: item.kind ?? null, paid: price });
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
