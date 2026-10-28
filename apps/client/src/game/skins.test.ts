import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SKINS, artUrl, skinsFor, spriteFor, type Skin } from "./skins";

/**
 * The rule that must survive every future skin: a skin changes how a card
 * LOOKS and nothing else. These pin the resolver's behaviour now, while the
 * list is still empty and changing it is free.
 */
describe("card skins", () => {
  const vintage: Skin = {
    id: "furries_01_chuppy:vintage",
    cardId: "furries_01_chuppy",
    name: { he: "וינטג'", en: "Vintage" },
    sprite: "cards/furries_01_chuppy_vintage.webp",
  };

  it("uses the card's own art when nothing is equipped", () => {
    expect(spriteFor("furries_01_chuppy", "cards/a.webp", null)).toBe("cards/a.webp");
    expect(spriteFor("furries_01_chuppy", "cards/a.webp")).toBe("cards/a.webp");
  });

  it("uses the skin's art when one is equipped", () => {
    SKINS[vintage.id] = vintage;
    expect(spriteFor("furries_01_chuppy", "cards/a.webp", vintage.id)).toBe(vintage.sprite);
    delete SKINS[vintage.id];
  });

  it("refuses a skin that belongs to a different card", () => {
    SKINS[vintage.id] = vintage;
    // equipping Chuppy's skin on a dragon must not redress the dragon
    expect(spriteFor("dragons_01_flame_dragon", "cards/d.webp", vintage.id)).toBe("cards/d.webp");
    delete SKINS[vintage.id];
  });

  it("falls back to the card's art for an unknown skin id", () => {
    expect(spriteFor("furries_01_chuppy", "cards/a.webp", "no such skin")).toBe("cards/a.webp");
  });

  it("lists only the skins for the card asked about", () => {
    SKINS[vintage.id] = vintage;
    expect(skinsFor("furries_01_chuppy")).toHaveLength(1);
    expect(skinsFor("dragons_01_flame_dragon")).toHaveLength(0);
    delete SKINS[vintage.id];
  });
});

/**
 * **A picture Or uploaded is a whole address; one that shipped is a path.**
 *
 * The "replace the picture" button in the admin panel puts the file in a
 * Supabase bucket and writes `https://…` into `art.sprite`, where every other
 * card holds `cards/whatever.webp`. Four places in this app used to turn a
 * sprite into a URL by writing `BASE_URL + sprite` themselves.
 */
describe("where a card's picture is", () => {
  it("puts a shipped path under the app's own base", () => {
    expect(artUrl("cards/dragons_01_flame_dragon.webp")).toBe(
      `${import.meta.env.BASE_URL}cards/dragons_01_flame_dragon.webp`,
    );
  });

  it("leaves an uploaded picture exactly as it is", () => {
    const up = "https://iiviygfltyrsonioyqxm.supabase.co/storage/v1/object/public/card-art/x.webp";
    expect(artUrl(up)).toBe(up);
    expect(artUrl("//cdn.example.com/x.webp")).toBe("//cdn.example.com/x.webp");
  });

  /*
   * ⚠ THE ONE THAT WOULD BE SILENT. Prefixing an absolute URL produces
   * "/amanda/https://…", which is a 404 drawn as a blank card — in the
   * battle, the album, the log and the detail modal at once, with no error
   * anywhere and nothing in the panel to suggest the upload went wrong. So
   * the rule is not "artUrl exists", it is "nobody builds one by hand".
   */
  it("is the only way any of them builds a card's URL", () => {
    const root = fileURLToPath(new URL("../components/", import.meta.url));
    for (const file of ["Arena.tsx", "BattleLog.tsx", "CardDetailModal.tsx", "CardView.tsx"]) {
      const src = readFileSync(root + file, "utf8");
      const byHand = src.match(/BASE_URL\}\$\{(sprite|spriteFor)/g) ?? [];
      expect(byHand, `${file} builds a sprite URL by hand`).toHaveLength(0);
      expect(src, `${file} does not use artUrl`).toContain("artUrl(");
    }
  });
});
