import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

/**
 * ═══ TEN DEATHS AND SIX WALKS ═══
 *
 * Or: *"the shooting, the dying, the movement — all of it has to be much more
 * fun and impressive."*
 *
 * Every card died the same death and walked the same walk: fourteen dots in
 * the family's colour, and a slide across the floor. Both are derived now,
 * for the same reason everything else here is — fifty-three cards, and more
 * coming, cannot each be animated by hand.
 */
describe("how a card dies", () => {
  it("is decided by what it is made of", () => {
    expect(combatLook("dragons_01_flame_dragon").dies).toBe("ash");
    expect(combatLook("giants_01_stone_colossus").dies).toBe("crumble");
    expect(combatLook("dragons_03_thunderwing").dies).toBe("zap");
    expect(combatLook("plants_06_toxic_mushroom").dies).toBe("melt");
    expect(combatLook("dragons_09_typhoon_dragon").dies).toBe("gust");
  });

  it("never falls through to the generic one by accident", () => {
    // "pop" is the old death, kept for `variable` — the element that IS
    // "could be anything". Any OTHER card landing on it is an element that
    // was added without a death to go with it.
    for (const id of cardPool()) {
      const card = CATALOG.get(id)!;
      if (combatLook(id).dies !== "pop") continue;
      expect(card.elements[0], `${id} has no death of its own`).toBe("variable");
    }
  });
});

describe("how a card walks", () => {
  it("does not, when it cannot move", () => {
    expect(combatLook("slimes_05_sticky_rug").walk).toBe("rooted");
  });

  it("floats when it flies, whatever family it is in", () => {
    expect(combatLook("insects_07_aggressive_wasp").walk).toBe("float");
  });

  it("squashes if it is a slime and scurries if it is an insect", () => {
    expect(combatLook("slimes_01_basic_slime").walk).toBe("squish");
    expect(combatLook("insects_01_ant_soldier").walk).toBe("scuttle");
  });

  it("stomps when it is big enough to shake the ground", () => {
    expect(combatLook("giants_03_hill_giant").walk).toBe("stomp");
    expect(combatLook("giants_03_hill_giant").weight).toBeGreaterThan(0.5);
  });

  it("gives everything else an ordinary step", () => {
    expect(combatLook("dragons_07_gold_horn").walk).toBe("step");
  });

  /*
   * Most of this catalogue does not move at all — the board is small and a
   * wall that walks away from the King is not a wall. Worth pinning, because
   * "nothing in the battle moves" would otherwise look like the walk code
   * being broken rather than like the cards being what they are.
   */
  it("leaves the majority rooted, which is what the cards say", () => {
    const walks = cardPool().map((id) => combatLook(id).walk);
    expect(walks.filter((w) => w === "rooted").length).toBeGreaterThan(walks.length / 2);
    expect(new Set(walks).size, "and the ones that do move do not all move alike")
      .toBeGreaterThan(2);
  });

  it("weighs every card between nothing and a Titan", () => {
    for (const id of cardPool()) {
      const look = combatLook(id);
      expect(look.weight, id).toBeGreaterThanOrEqual(0);
      expect(look.weight, id).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * ═══ THE THIRD WAVE ═══
 *
 * Or: *"what else can be improved in the animations?"* Four more, and these
 * are the ones that live in Arena.tsx rather than in the look table — so
 * what can be pinned here is that each of them exists and is wired to the
 * thing it is supposed to answer to.
 */
describe("the battle floor and the camera", () => {
  const ARENA = readFileSync(
    fileURLToPath(new URL("./Arena.tsx", import.meta.url)),
    "utf8",
  );

  it("gives every unit a shadow, under the card and not inside it", () => {
    expect(ARENA).toContain("shadow: Graphics");
    expect(ARENA).toContain("g.half * 1.06");
  });

  it("shrinks the shadow as the body leaves the ground", () => {
    expect(ARENA).toContain("const spread = 1 - lift / 26");
  });

  it("winds up before it strikes", () => {
    // `attack` pulls back; `hit` throws forward. Both halves, or it is just
    // a lunge with extra steps.
    expect(ARENA).toContain("actor.offX = -(dx / d) * back");
    expect(ARENA).toContain("hitter.offX = (ax / ad) * hitter.half");
  });

  it("shakes the field, not the clock", () => {
    expect(ARENA).toContain("unitLayer.x = ox");
    expect(ARENA, "the UI layer stays still").not.toContain("uiLayer.x = ox");
  });

  it("shows a unit that is nearly dead, sooner for a King", () => {
    expect(ARENA).toContain("const hurtAt = g.isKing ? 0.34 : 0.25");
  });

  it("rate-limits every sound it plays", () => {
    for (const call of [...ARENA.matchAll(/hear\("(\w+)", (\d+)\)/g)]) {
      expect(Number(call[2]), `${call[1]} plays too freely`).toBeGreaterThanOrEqual(80);
    }
    expect([...ARENA.matchAll(/hear\(/g)].length).toBeGreaterThan(3);
  });
});

/**
 * ═══ THE ABILITIES, ON THE SCREEN ═══
 *
 * Or: *"yes, let's do the abilities."* A card being healed, a card burning
 * from poison and a card whose armour ate the blow all looked like nothing
 * happening at all.
 *
 * Healing and poison are read off the HEALTH in the frames rather than from
 * events, and that is the part worth pinning: healing arrives a thirtieth of
 * a point at a time from three different sources, so there is nothing to
 * emit an event for without emitting thirty a second — and watching the
 * number instead catches every source, including ones nobody has written.
 */
describe("abilities you can see", () => {
  const ARENA = readFileSync(
    fileURLToPath(new URL("./Arena.tsx", import.meta.url)),
    "utf8",
  );

  it("reads healing off the health, not off an event", () => {
    expect(ARENA).toContain("const moved = fu.hp - g.wasHp");
    expect(ARENA).toContain("if (moved > 0) g.healed += moved");
  });

  it("calls a fall with no blow behind it poison", () => {
    expect(ARENA).toContain("g.burned += -moved");
    // A blow accounts for its own share, so what is left over is the poison.
    expect(ARENA).toContain("target.burned = Math.max(0, target.burned - damage)");
  });

  it("waits until there is a whole number worth saying", () => {
    // "+2" floating off a card every tick is noise.
    expect(ARENA).toContain("if (g.healed >= 60)");
    expect(ARENA).toContain("if (g.burned >= 60)");
  });

  it("draws what the armour stopped, and only when it is worth saying", () => {
    expect(ARENA).toContain("absorbed > damage * 0.15 && absorbed > 20");
  });

  it("gives thorns their own colour instead of an ordinary blow", () => {
    expect(ARENA).toContain("ev.reflected === true");
    expect(ARENA).toContain("extra.reflected");
  });

  it("writes healing with a plus and damage with a minus", () => {
    expect(ARENA).toContain('`${extra.healed ? "+" : "-"}${amount}${mark}`');
  });
});
