/**
 * **The shelf is a shelf again, and the item has a page.**
 *
 * Or, on the shop: *"you should be able to go into every item and see its
 * details and its full picture... say, all the explanation that is under
 * every avatar (call them avatars, not faces). When you open a monster pack
 * you see all its emoji. The sentences under the catchphrases are stupid —
 * better to just write the phrase itself."*
 *
 * Four complaints, one cause: a 66-pixel tile was carrying a picture, a
 * name, a sentence and a price, so everything on it was too small to be
 * read and the picture — which is the thing being sold — was a thumbnail.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EMOJI } from "@amanda/shared";

const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
const SHOP = read("./Shop.tsx");
const DEET = read("./ShopDetail.tsx");

describe("the shelf", () => {
  it("opens the item instead of buying from the tile", () => {
    expect(SHOP).toContain("onClick={() => setLooking(item.id)}");
    expect(SHOP, "the price on a tile is a label now").toContain('<span\n                              className={`good__buy');
  });

  /* The blurb moved; a sentence under a 66px tile is a grey smear. */
  it("carries no blurb any more", () => {
    expect(SHOP).not.toContain("good__blurb");
    expect(DEET, "it lives here, where there is room to read it").toContain("deet__blurb");
  });

  it("calls them avatars", () => {
    expect(SHOP).toContain('"אוואטרים"');
    expect(SHOP).not.toContain('"פרצופים"');
  });
});

describe("the item's own page", () => {
  it("draws the thing at a size you can look at", () => {
    expect(DEET).toContain("deet__art");
    expect(DEET, "a card is the card").toContain("<CardView cardId={cardId}");
    expect(DEET, "a back is the back").toContain("<CardBack size=\"medium\"");
    expect(DEET, "and a phrase is the phrase").toContain("<Plaque phrase={phrase} />");
  });

  /*
   * Or: *"when you open a monster pack you see all its emoji."* The shelf
   * draws the first one because a tile fits one.
   */
  it("shows everything in an emoji pack", () => {
    expect(DEET).toContain("EMOJI.filter((e) => e.pack === pack)");
    const packs = new Set(EMOJI.filter((e) => e.pack).map((e) => e.pack));
    expect(packs.size, "there are packs to open").toBeGreaterThan(0);
    for (const p of packs)
      expect(EMOJI.filter((e) => e.pack === p).length, `${p} has more than one in it`).toBeGreaterThan(1);
  });

  /* A catchphrase's name IS the phrase, drawn above it. */
  it("does not say a phrase twice", () => {
    expect(DEET).toContain("{!phrase && <h2 className=\"deet__name\">");
  });

  it("is the only place a purchase can be made", () => {
    const buys = [...SHOP.matchAll(/void take\(item\)/g)];
    expect(buys, "one call, from the detail").toHaveLength(1);
    expect(SHOP).toContain("onBuy={() => void take(item).then(() => setLooking(null))}");
  });
});
