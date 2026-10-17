/**
 * **Every kind of thing the shop sells has somewhere to stand.**
 *
 * Or: *"there is no way to buy card backs in the shop."*
 *
 * There wasn't, and the reason is the only reason worth writing a test about.
 * Nothing was unfinished: six card backs were in `shop_items`, active, priced
 * 100-180, with Hebrew names and blurbs, and the database had allowed
 * `kind = 'back'` since the decks migration. The server loaded them and sent
 * them. The shop screen then filtered them out, because it looped over its
 * own hand-written list of shelves and `back` was not on it.
 *
 * Three places described the same closed set — a check constraint in
 * Postgres, a union in `ShopItem`, and an array of shelves in Shop.tsx — and
 * none of them was the source. Two of the three knew about `back`. Nothing
 * failed, nothing logged, and the only symptom was an absence: goods that
 * were paid for, described and shipped, and that nobody could see.
 *
 * `SHOP_KINDS` is the source now and `SHELF_LABELS` is a `Record<ShopKind,
 * string>`, so a kind with no label does not compile. This covers the one
 * gap the compiler still cannot: the ORDER list, which is an array again and
 * so is free to be one short in exactly the old way.
 */
import { describe, expect, it } from "vitest";
import { SHOP_KINDS, isShopKind } from "@amanda/shared";
import { SHELF_ORDER } from "../components/Shop";

describe("the shop has a shelf for everything it sells", () => {
  it("names every kind, exactly once", () => {
    expect([...SHELF_ORDER].sort()).toEqual([...SHOP_KINDS].sort());
    expect(new Set(SHELF_ORDER).size).toBe(SHELF_ORDER.length);
  });

  /*
   * The two Or asked about by name, pinned on their own so a failure says
   * WHICH shelf went missing rather than printing two sorted arrays.
   */
  it("still has a shelf for card backs", () => {
    expect(SHELF_ORDER).toContain("back");
  });

  it("still has a shelf for card skins", () => {
    expect(SHELF_ORDER).toContain("skin");
  });
});

describe("knowing a kind when it arrives", () => {
  it("recognises every kind in the list", () => {
    for (const kind of SHOP_KINDS) expect(isShopKind(kind)).toBe(true);
  });

  /*
   * A kind this build has never heard of is a perfectly ordinary thing: Or
   * can add a row through the admin panel, and the shop sends what the
   * database holds. The answer has to be "no" rather than a throw — an
   * unknown kind should cost that one item its shelf, not the whole screen.
   */
  it("says no to one it has never heard of, without throwing", () => {
    for (const nonsense of ["", "BACK", "sticker", "back ", "__proto__", "toString"]) {
      expect(isShopKind(nonsense)).toBe(false);
    }
  });
});
