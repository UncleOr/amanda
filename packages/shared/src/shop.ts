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
