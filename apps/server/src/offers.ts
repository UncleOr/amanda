/**
 * ═══ ONE THING FROM EACH SHELF, CHEAPER, TODAY ═══
 *
 * Or: *"and offers at the top of the shop. One product from each category."*
 *
 * A shop whose prices never move is a price list. What makes somebody look
 * at a shop again is that something is cheaper than it was yesterday — and
 * the reason it has to be one per CATEGORY rather than three at random is
 * that a strip of four avatars is a sale on avatars, not a reason to look.
 *
 * ═══ NOTHING NEW IS INVENTED HERE ═══
 *
 * `sale_price_diamonds` and `sale_until` have been on every shop row since
 * the admin panel got sales, and `priceNow` — the one function the shelf and
 * the till both use to decide what a thing costs — already reads them. So an
 * offer is not a new kind of price: it is the ordinary sale fields, filled in
 * for the day, on the one row per kind that was drawn for it.
 *
 * Which means the till needs no new rule. It asks `priceNow` what this costs,
 * the same as it always has, and gets the offer price because the row it is
 * holding has been through here.
 *
 * ═══ AND OR'S OWN SALE ALWAYS WINS ═══
 *
 * If he has put a sale on something from the panel, that item IS its
 * category's offer and its price is left exactly as he set it. A generated
 * discount that quietly overwrote a price he chose would be the shop
 * disagreeing with its owner.
 */
import { israelDay, periodEndsOn, stream } from "@amanda/shared";
import { priceNow, type ShopItem } from "./shop.js";

/**
 * How much comes off, as a percentage.
 *
 * Four of them rather than one, drawn per item, because a shop where
 * everything is 25% off reads as a rule and a shop where one thing is 40%
 * off reads as a find. Nothing above 40: this is a game a seven-year-old
 * saves diamonds in for a week, and a thing he saved for being half price
 * the day after he bought it is a worse lesson than the shop is worth.
 */
const CUTS = [20, 25, 30, 40] as const;

/** The smallest an offer may be, so a free item cannot be "on sale". */
const FLOOR = 10;

/**
 * Today's offers: the same items, with one per kind marked down.
 *
 * Pure, and the same answer all day for everybody — it is drawn from the
 * calendar day alone, so the shelf and the till cannot disagree about what
 * is on offer or by how much.
 *
 * The CARD shelf is per player (cardShelf.ts), so when its items are in the
 * list the card offer is per player too. That is the one kind where this is
 * true, and it is true for the same reason the shelf is.
 */
export function offersFor(items: ShopItem[], now: Date = new Date()): ShopItem[] {
  const day = israelDay(now);
  // Midnight in Israel, as a date — the same boundary everything else daily
  // in this game turns on (periodKey in challenges.ts).
  const until = `${periodEndsOn("daily", now)}T00:00:00+03:00`;

  const byKind = new Map<string, ShopItem[]>();
  for (const item of items) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);

  const chosen = new Map<string, ShopItem>();
  for (const [kind, row] of byKind) {
    if (!row.length) continue;
    /*
     * A sale Or set himself is this kind's offer, already priced. If he has
     * set several, the first in the shelf's own order wins — an arbitrary
     * tie-break, but a stable one, and every one of them is still on sale
     * wherever it sits.
     */
    const his = row.find((i) => priceNow(i, now.toISOString()).was !== null);
    if (his) {
      chosen.set(his.id, his);
      continue;
    }
    // Sorted by id so the draw cannot wobble when the shelf is reordered.
    const pool = [...row].sort((a, b) => a.id.localeCompare(b.id));
    const pick = stream(`offer:${day}:${kind}`);
    const one = pool[Math.floor(pick() * pool.length) % pool.length]!;
    const cut = CUTS[Math.floor(pick() * CUTS.length) % CUTS.length]!;
    const full = one.price_diamonds ?? 0;
    if (full <= FLOOR) continue;
    // Rounded DOWN to a round number: 250 less 30% is 175, and a shop that
    // rounds that to 180 has taken five diamonds back from the offer it just
    // made. Down, always, in the customer's favour.
    const pay = Math.max(FLOOR, Math.floor((full * (100 - cut)) / 100 / 10) * 10);
    if (pay >= full) continue;
    chosen.set(one.id, { ...one, sale_price_diamonds: pay, sale_until: until });
  }

  return items.map((i) => chosen.get(i.id) ?? i);
}
