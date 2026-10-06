import { describe, expect, it } from "vitest";
import { SKINS, skinsFor, spriteFor, type Skin } from "./skins";

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
