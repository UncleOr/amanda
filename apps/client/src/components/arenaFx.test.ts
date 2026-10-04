import { describe, expect, it } from "vitest";
import { CATALOG, cardPool } from "../data/catalog";
import { combatLook } from "./arenaFx";

/**
 * The battle effects are derived from card data rather than hand-authored, so
 * these lock the derivation: if a card's element, range or abilities change, the
 * way it fights in the arena changes with it — and nothing silently loses its
 * animation by falling through to a default.
 */
describe("combatLook", () => {
  it("shoots when ranged and lunges when melee", () => {
    expect(combatLook("dragons_04_lava").attack).toBe("projectile");
    expect(combatLook("dragons_03_thunderwing").attack).toBe("projectile");
    expect(combatLook("giants_01_stone_colossus").attack).toBe("lunge");
  });

  it("takes its shape and colour from the element", () => {
    expect(combatLook("dragons_03_thunderwing").shape).toBe("bolt");
    expect(combatLook("plants_06_toxic_mushroom").shape).toBe("blob");
    expect(combatLook("dragons_09_typhoon_dragon").shape).toBe("gust");
    // fire is #e2492f
    expect(combatLook("dragons_04_lava").color).toBe(0xe2492f);
  });

  it("gives a sniper a faster shot than a lobber", () => {
    const sniper = combatLook("dragons_03_thunderwing");
    const ranged = combatLook("dragons_04_lava");
    expect(sniper.flightMs).toBeLessThan(ranged.flightMs);
  });

  it("puts a ground ring only under units that carry an aura", () => {
    expect(combatLook("plants_03_healing_bloom").aura?.kind).toBe("heal");
    expect(combatLook("giants_01_stone_colossus").aura).toBeNull();
  });

  it("bobs only the flyers", () => {
    expect(combatLook("insects_07_aggressive_wasp").flying).toBe(true);
    expect(combatLook("giants_01_stone_colossus").flying).toBe(false);
  });

  it("bursts in its own series colour", () => {
    // dragons #ff6a3d vs slimes #2fc5c0 — deaths read as a family
    expect(combatLook("dragons_01_flame_dragon").death).toBe(0xff6a3d);
    expect(combatLook("slimes_01_basic_slime").death).toBe(0x2fc5c0);
  });

  it("resolves a look for every launch card", () => {
    for (const id of cardPool()) {
      const look = combatLook(id);
      const card = CATALOG.get(id)!;
      expect(look.attack).toBe(card.stats.range === "melee" ? "lunge" : "projectile");
      expect(look.death).toBeGreaterThan(0);
    }
  });
});
