/**
 * **How a card behaves in your hand.**
 *
 * Or: *"while it is being dragged it moves in the user's hand in its own
 * way. If it is a heavy giant it is a bit 'harder' to carry. Fliers beat
 * their wings and pull ahead. Chuppy gives off a current and 'electrifies'."*
 *
 * Every card used to drag identically — a picture pinned to the pointer, with
 * a fixed four-degree tilt. The style is derived rather than listed, for the
 * same reason the walks and the deaths are: fifty-three cards, and more
 * coming, cannot each be animated by hand.
 */
import { describe, expect, it } from "vitest";
import { CATALOG, cardPool } from "../data/catalog";
import { carryOf } from "./carry";

describe("carrying a card", () => {
  it("makes a giant heavy", () => {
    expect(carryOf("giants_10_titan_king").style).toBe("heavy");
    expect(carryOf("plants_10_great_mother_tree").style).toBe("heavy");
  });

  it("never makes a flier plod, whatever else it is", () => {
    // A flying giant is still a flier: it is carrying itself.
    for (const id of cardPool())
      if (CATALOG.get(id)!.flying)
        expect(["flutter", "soar"], id).toContain(carryOf(id).style);
  });

  /*
   * Or: *"the wings you made suit insects, but dragons will of course need
   * different wings (which also sound different from insect wings)."*
   *
   * So flying is two styles, and the split is by family rather than by size
   * — a firefly and the Insect Empress beat the same way at different
   * speeds, and neither of them beats the way a dragon does.
   */
  it("gives a dragon different wings from an insect", () => {
    expect(carryOf("insects_07_aggressive_wasp").style).toBe("flutter");
    expect(carryOf("dragons_10_sky_king").style).toBe("soar");
    for (const id of cardPool()) {
      const card = CATALOG.get(id)!;
      if (!card.flying) continue;
      expect(carryOf(id).style, id).toBe(card.seriesId === "dragons" ? "soar" : "flutter");
    }
  });

  it("makes Chuppy crackle — because he is electric, not because he is Chuppy", () => {
    expect(carryOf("furries_01_chuppy").style).toBe("spark");
    expect(CATALOG.get("furries_01_chuppy")!.elements[0]).toBe("electric");
  });

  it("carries everything else steadily", () => {
    // A plant that WALKS. The thorn sprout used to stand in for "everything
    // else" and it no longer can: it has no move speed, so it is one of the
    // cards that now resists being lifted. See `root` in carry.ts.
    expect(carryOf("plants_05_creeping_vine").style).toBe("steady");
  });

  /*
   * Or's two missing feelings: *"a drag 'feel' (flies fast, WOBBLES, slow,
   * heavy, RESISTS, etc.)"*. Both are derived, like every other style —
   * a slime wobbles because it is a slime, and anything rooted resists
   * because standing still is what being rooted means.
   */
  it("wobbles a slime", () => {
    expect(carryOf("slimes_01_basic_slime").style).toBe("ooze");
    expect(carryOf("slimes_05_sticky_rug").style).toBe("ooze");
  });

  it("makes anything rooted resist being lifted", () => {
    expect(carryOf("plants_01_thorn_sprout").style).toBe("root");
    for (const id of cardPool()) {
      const card = CATALOG.get(id)!;
      if (card.flying || card.seriesId === "slimes") continue;
      if (card.elements[0] === "electric") continue;
      if (card.stats.hp >= 1600 || card.midBoss) continue;
      expect(carryOf(id).style, id).toBe(card.stats.moveSpeed === 0 ? "root" : "steady");
    }
  });

  it("is slower to answer the harder it is to carry", () => {
    // `pull` IS the weight: how hard the card is dragged toward the pointer
    // each frame. A giant is late to every turn.
    expect(carryOf("giants_10_titan_king").pull).toBeLessThan(
      carryOf("plants_05_creeping_vine").pull,
    );
    expect(carryOf("insects_07_aggressive_wasp").pull).toBeGreaterThan(
      carryOf("plants_05_creeping_vine").pull,
    );
  });

  it("lets only the flier run ahead of your thumb", () => {
    expect(carryOf("insects_07_aggressive_wasp").lead).toBeGreaterThan(
      carryOf("giants_10_titan_king").lead,
    );
    expect(carryOf("giants_10_titan_king").lead).toBe(0);
  });

  it("answers for a card it has never heard of", () => {
    // The crumb demon, an action card id, a typo: the drag must not throw.
    expect(carryOf("no_such_card").style).toBe("steady");
  });

  it("gives every card in the game a way of being carried", () => {
    for (const id of cardPool()) {
      const c = carryOf(id);
      expect(c.pull, id).toBeGreaterThan(0);
      expect(c.damp, id).toBeGreaterThan(0);
    }
  });
});

/**
 * The feel, rather than the constants.
 *
 * `pull` and `damp` are only numbers until they are run: what Or asked for
 * is that a giant is HARDER TO CARRY, which means visibly further behind
 * your thumb at the same moment. This is the same spring useDrag runs, over
 * the same ten frames, for a giant and for a wasp.
 */
function behindAfter(cardId: string, frames: number): number {
  const { pull, damp } = carryOf(cardId);
  // The pointer jumps 500px and stays there; the card chases it.
  const target = 500;
  let x = 0;
  let v = 0;
  for (let i = 0; i < frames; i++) {
    v = (v + (target - x) * pull) * damp;
    x += v;
  }
  return Math.abs(target - x);
}

describe("the weight you can feel", () => {
  it("leaves a giant further behind your thumb than a vine", () => {
    expect(behindAfter("giants_10_titan_king", 10)).toBeGreaterThan(
      behindAfter("plants_05_creeping_vine", 10),
    );
  });

  it("leaves the one that RESISTS furthest behind of all", () => {
    // Measured over the ten frames the spring really runs: 259px for a
    // rooted card, 227 for a giant, 76 for a vine.
    const rooted = behindAfter("plants_01_thorn_sprout", 10);
    expect(rooted).toBeGreaterThan(behindAfter("giants_10_titan_king", 10));
    expect(rooted).toBeGreaterThan(behindAfter("plants_05_creeping_vine", 10));
  });

  it("gets a flier there first", () => {
    expect(behindAfter("insects_07_aggressive_wasp", 10)).toBeLessThan(
      behindAfter("plants_05_creeping_vine", 10),
    );
  });

  it("brings every one of them home in the end", () => {
    // A card that never catches up is a card you cannot place.
    for (const id of cardPool()) expect(behindAfter(id, 90), id).toBeLessThan(1);
  });
});
