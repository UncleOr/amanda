/**
 * What kinds of thing the shop sells.
 *
 * ═══ WHY THIS LIST EXISTS, AND WHAT IT COST NOT TO HAVE IT ═══
 *
 * Or: *"there is no way to buy card backs in the shop."*
 *
 * There wasn't, and nothing was unfinished. Six card backs were in
 * `shop_items`, active, priced 100-180, with Hebrew names and blurbs, and the
 * database had allowed `kind = 'back'` since the decks migration. The server
 * sent them. They never appeared, because the SHOP SCREEN kept its own list
 * of shelves and `back` was not on it — so every one of those rows was
 * filtered out of the render and nothing anywhere said so.
 *
 * Three places described the same closed set and none of them was the source:
 * a check constraint in Postgres, a union in the client's ShopItem, and an
 * array of shelves in Shop.tsx. Two of the three knew about `back`.
 *
 * This is the source now. The union is derived from it, and the shelves are
 * built from a `Record<ShopKind, ...>` — so a kind with no shelf is a
 * TYPE ERROR rather than six goods that quietly fall on the floor.
 *
 * Adding a kind: put it here, give it a label in Shop.tsx (the compiler will
 * insist), and widen the `shop_items_kind_check` constraint.
 */
export const SHOP_KINDS = [
  "avatar",
  "emoji",
  "skin",
  "back",
  "card",
  "chest",
  "phrase",
] as const;

/** One of the things the shop sells. Mirrors `shop_items_kind_check`. */
export type ShopKind = (typeof SHOP_KINDS)[number];

const KNOWN = new Set<string>(SHOP_KINDS);

/** Is this a kind this build knows how to draw? */
export function isShopKind(kind: string): kind is ShopKind {
  return KNOWN.has(kind);
}


/**
 * === WHICH ONE YOU ARE ACTUALLY WEARING ===
 *
 * Or: *"in the shop, instead of YOURS wouldn't EQUIPPED be better?"* — and
 * then, when it turned out those are two different facts: *"yes, put a mark
 * on the item that is equipped now."*
 *
 * Owning and wearing come apart the moment you own two of a kind, which is
 * the whole point of a shop that sells six avatars. A tile that says only
 * "owned" leaves a player counting their own face to work out which one is
 * on their chip.
 *
 * Three of the seven kinds can be worn, and each keeps its choice somewhere
 * different — the avatar and the catchphrase on the PLAYER, the card back
 * on the DECK. That is why this takes a bag of three ids rather than an
 * account: the one place that knows all three is the screen.
 */
export interface Wearing {
  /** `players.avatar`. */
  avatar?: string | null;
  /** `players.catchphrase`, an id from catchphrases.ts. */
  phrase?: string | null;
  /** The active deck's `back`, an id from cardBacks.ts. */
  back?: string | null;
}

/**
 * Is this shop item the one in use?
 *
 * `grants` is the item's own payload — `{ avatar }` for a face — and the
 * other two are matched by the item id, which is what `item` on a card back
 * and on a catchphrase already points at.
 *
 * Anything else (an emoji pack, a chest, a card) is never "worn": a pack is
 * a set of faces you may send and a chest is a thing that opens.
 */
export function isWearing(
  item: { id: string; kind: string; grants?: unknown },
  worn: Wearing,
  /** id -> the thing it grants, for the kinds matched by item id. */
  lookup: { backOf(itemId: string): string | null; phraseOf(itemId: string): string | null },
): boolean {
  if (item.kind === "avatar") {
    const avatar = (item.grants as { avatar?: string } | undefined)?.avatar;
    return !!avatar && avatar === worn.avatar;
  }
  if (item.kind === "back") {
    const back = lookup.backOf(item.id);
    return !!back && back === worn.back;
  }
  if (item.kind === "phrase") {
    const phrase = lookup.phraseOf(item.id);
    return !!phrase && phrase === worn.phrase;
  }
  return false;
}

/** Can this kind be worn at all? Decides whether "use it now" is offered. */
export function isWearable(kind: string): boolean {
  return kind === "avatar" || kind === "back" || kind === "phrase";
}
