/**
 * ═══ THE CARDS ON THE SHELF ═══
 *
 * Or: *"we'll also add the option to buy cards you already have, so you can
 * upgrade."* And then: *"add cards to the card shelf in the shop."*
 *
 * The first sentence is the whole design and it is easy to read past. Not
 * "sell cards" — sell COPIES, of cards you already have, because copies are
 * what an upgrade costs and they only ever arrive by luck. Four copies to
 * take a card from 1 to 2, seventeen to go from 4 to 5 (LEVELS.costGrowth),
 * and nothing in the game lets you aim at them.
 *
 * So this shelf cannot be used to collect. Everything on it is already in
 * your album; the chests stay the only way to meet a card you have never
 * had, which is the part of this game that is a surprise.
 *
 * ═══ WHY IT IS NOT ROWS IN A TABLE ═══
 *
 * Every other thing in the shop is a `shop_items` row Or edits from the
 * panel, and that is right for an avatar: there are six, he named them, and
 * they do not change. A card shelf cannot work that way. It is different for
 * every player — it is THEIR album — and it has to turn over, or there is no
 * reason to look at it twice.
 *
 * So it is derived, the same way the daily challenges are: from the calendar
 * day and a stable hash, with nothing written down anywhere. The same four
 * cards all day, a different four tomorrow, and no job to run at midnight.
 *
 * What Or keeps is the PRICE, through TUNED.cardShelfPrice — the one thing
 * on this shelf that is a decision rather than a consequence.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { TUNED, cardCost, israelDay, stream } from "@amanda/shared";
import type { Card } from "@amanda/shared";
import { CATALOG } from "./content.js";
import type { ShopItem } from "./shop.js";

/** Every id on this shelf begins with it, which is how the till knows one. */
export const TODAY_CARD = "card.today.";

/**
 * What a copy costs, as a multiple of the cheapest one.
 *
 * Indexed by the card's DECK cost, 1 to 5 — what the card is worth on a
 * board, measured from its own stats (cardCost.ts) — and deliberately not by
 * its rarity. The argument is written out there and it is one card long:
 * Flame Dragon is a common with 1300 power, and pricing by rarity would sell
 * it for the price of a thorn sprout.
 *
 * Five times, not ten: this is a copy of a card you already own, not the
 * card, and the dearest thing in the shop should not be a single copy.
 */
const BY_COST = [0, 1, 1.5, 2.2, 3.3, 5] as const;

/** Four slots, each taking a card in this band of deck cost. */
const SLOTS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [3, 3],
  [4, 4],
  [5, 5],
];

/** What one copy of this card costs today. */
export function cardPrice(card: Pick<Card, "stats"> & { cost?: number }): number {
  const mult = BY_COST[cardCost(card)] ?? 1;
  return Math.round((TUNED.cardShelfPrice * mult) / 10) * 10;
}

/** One card, dressed as something the shop can draw and sell. */
function asItem(card: Card, copies: number, level: number, sort: number): ShopItem {
  return {
    id: `${TODAY_CARD}${card.id}`,
    kind: "card",
    name: card.name,
    /*
     * No blurb. The card IS the blurb — ShopDetail draws it full size with
     * its own stats on it — and a sentence under a picture of the thing it
     * describes is the clutter Or took off these tiles in the first place.
     */
    blurb: null,
    grants: { cardId: card.id, copies: 1 },
    price_diamonds: cardPrice(card),
    price_cents: null,
    art: null,
    sort,
    /** How many you hold, so "do I need this" is answerable on the page. */
    copies,
    /*
     * And what level it is at. Or: *"in the shop itself, show me under every
     * card how many out of how many I have towards the next upgrade. In this
     * format: מטמיע הצורות X5 | 6/10"* — the level is the X5, and what the
     * next one costs is worked out from it (levelCost).
     */
    level,
  };
}

/**
 * Today's cards for this player.
 *
 * Deterministic: the same four all day, for them, from their album as it is
 * right now. Buying one does not change the shelf — a copy more of a card
 * you own is still a card you own — which is what makes it safe for the till
 * to work this out again at the moment of payment and expect the same answer.
 */
export async function cardsForSale(
  sb: SupabaseClient,
  playerId: string,
  now: Date = new Date(),
): Promise<ShopItem[]> {
  const { data } = await sb
    .from("player_cards")
    .select("card_id, copies, level")
    .eq("player_id", playerId);
  if (!data?.length) return [];

  /** The album, as cards, in a fixed order so the draw cannot wobble. */
  const album = data
    .map((r) => ({
      card: CATALOG.get(r.card_id as string),
      copies: (r.copies as number) ?? 0,
      level: (r.level as number) ?? 1,
    }))
    .filter((c): c is { card: Card; copies: number; level: number } => !!c.card)
    .sort((a, b) => a.card.id.localeCompare(b.card.id));
  if (!album.length) return [];

  const pick = stream(`shop:${israelDay(now)}:${playerId}`);
  const taken = new Set<string>();
  const out: ShopItem[] = [];
  for (const [low, high] of SLOTS) {
    const band = album.filter(
      (c) => !taken.has(c.card.id) && cardCost(c.card) >= low && cardCost(c.card) <= high,
    );
    /*
     * A number is drawn for every slot whether or not it is filled, so a
     * player whose album has nothing in one band still gets the same cards
     * in the others as they would have tomorrow. Drawing only when there is
     * something to draw would make the whole shelf shift the day a player
     * won their first epic.
     */
    const n = pick();
    if (!band.length) continue;
    const got = band[Math.floor(n * band.length) % band.length]!;
    taken.add(got.card.id);
    out.push(asItem(got.card, got.copies, got.level, out.length));
  }
  return out;
}

/**
 * One of today's cards, by the id the browser sent back.
 *
 * The till asks for this rather than trusting the id: `card.today.` plus a
 * real card id is a thing anybody can type, and without this a player could
 * buy a copy of a card they have never owned — or of Amanda.
 */
export async function cardForSale(
  sb: SupabaseClient,
  playerId: string,
  itemId: string,
  now: Date = new Date(),
): Promise<ShopItem | null> {
  if (!itemId.startsWith(TODAY_CARD)) return null;
  const shelf = await cardsForSale(sb, playerId, now);
  return shelf.find((i) => i.id === itemId) ?? null;
}
