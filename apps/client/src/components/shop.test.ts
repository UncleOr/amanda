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
import { SHELF_ORDER } from "./Shop";

const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
const SHOP = read("./Shop.tsx");
const DEET = read("./ShopDetail.tsx");

describe("the shelf", () => {
  it("opens the item instead of buying from the tile", () => {
    // The tile is a door; the only till is on the item's own page.
    expect(SHOP).toContain("onOpen={() => setLooking(item.id)}");
    // And the price is a label, not a second button: `.good__buy` is a
    // <span> inside the tile.
    expect(SHOP).toMatch(/<span\s+className=\{`good__buy/);
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
    // Its name IS the phrase. The plaque shows it and deet__phrase says it;
    // a third copy as a heading was the clutter Or took off the shelf.
    expect(DEET).toContain("{phrase ? (");
    expect(DEET).toContain('<p className="deet__phrase">{say(phrase)}</p>');
  });

  it("is the only place a purchase can be made", () => {
    const buys = [...SHOP.matchAll(/void take\(item\)/g)];
    expect(buys, "one call, from the detail").toHaveLength(1);
    expect(SHOP).toContain("onBuy={() => void take(item).then(() => setLooking(null))}");
  });
});

/**
 * ═══ THE SHELF THAT IS NOT A POSSESSION ═══
 *
 * Or: *"in the shop add chests… and add the text of the full sentence to
 * the catchphrases (because in the picture you only see part of it), and add
 * whatever is needed."*
 *
 * A chest is the first thing in this shop that is not yours after you buy
 * it: you open it and it is gone, and there is another one tomorrow. So the
 * shelf cannot answer it with "שלך" — it has to say when.
 */
describe("a chest on the shelf", () => {
  it("asks whether today's has been taken, not whether it is owned", () => {
    expect(SHOP).toContain("today.includes(item.id)");
    expect(SHOP).toContain('t("s52f7e9a", "מחר")');
  });

  it("tells the item's page as well, so the two cannot disagree", () => {
    expect(SHOP).toContain("taken={today.includes(item.id)}");
    expect(DEET).toContain('t("s3df89df", "לקחת היום. תחזור מחר")');
  });

  it("does not offer a buy button for one already taken", () => {
    expect(DEET).toContain(") : taken ? (");
  });
});

describe("a catchphrase", () => {
  /*
   * The plaque holds the line to one row by shrinking the type and stops at
   * 62% (Plaque.tsx), so a long phrase is cut. That is right for the goods
   * and wrong for knowing what you are buying.
   */
  it("is written out in full under the plaque", () => {
    expect(DEET).toContain('<p className="deet__phrase">{say(phrase)}</p>');
  });

  it("leaves every other item with its name as a heading", () => {
    expect(DEET).toContain("<h2 className=\"deet__name\">{say(item.name)}</h2>");
  });
});

/**
 * The card shelf. Or: *"add cards to the card shelf in the shop"*, after
 * *"the option to buy cards you already have, so you can upgrade."*
 */
describe("the card shelf", () => {
  it("is near the top, with the chests", () => {
    // The two shelves that change: one of each chest a day, four of your own
    // cards drawn fresh. Everything under them was there last week too.
    expect(SHELF_ORDER.slice(0, 2)).toEqual(["chest", "card"]);
  });

  it("says how many copies you already hold", () => {
    expect(DEET).toContain("item.copies !== undefined");
    expect(DEET).toContain('tf("s0ea3644", "יש לך {0}", item.copies)');
  });
});

/**
 * ═══ THE OFFERS, AT THE TOP ═══
 *
 * Or: *"and offers at the top of the shop. One product from each category."*
 *
 * Nothing about WHICH is decided here — the server marks one row per kind
 * for the day (offers.ts) and both sides read it through the same
 * `priceNow`. What this screen must get right is that it draws the same
 * tile it would draw on the shelf, and that it does not offer you something
 * you cannot take.
 */
describe("the offers strip", () => {
  it("is the first thing in the shop", () => {
    expect(SHOP.indexOf("aisle--deals")).toBeLessThan(SHOP.indexOf("SECTIONS.map"));
  });

  it("asks the price, rather than deciding who is on offer", () => {
    expect(SHOP).toContain("priceNow(i).was !== null");
  });

  it("leaves out anything you could not buy anyway", () => {
    // A tile at the top of the shop saying "שלך" is the clutter the strip
    // exists to cut through.
    expect(SHOP).toContain("!owned.includes(i.id)");
    expect(SHOP).toContain("!today.includes(i.id)");
  });

  it("draws the same tile as the shelf below it", () => {
    // One component, used twice. A tile that said one price in the strip
    // and another on the shelf would be the shop arguing with itself.
    expect([...SHOP.matchAll(/<Good\b/g)]).toHaveLength(2);
    expect([...SHOP.matchAll(/function Good\(/g)]).toHaveLength(1);
  });
});
