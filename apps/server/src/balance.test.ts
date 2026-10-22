/**
 * **A card that heals faster than you can hit is not hard, it is impossible.**
 *
 * Or: *"let's weaken the Mother Tree's health a bit. There's almost no chance
 * against it."*
 *
 * He is describing arithmetic rather than a feeling. The tree regenerated 120
 * health a second, and a card's damage is power divided by attack speed — so
 * NINETEEN of the fifty-one collectable cards did less than 120 a second and
 * could not kill it one on one. Not "struggled to". Could not: their damage
 * arrived slower than the healing, so its health went up while they hit it.
 *
 * Which is why its health was never the whole story — 2,400 is not an unusual
 * number, the Titan King has 2,500 — and why this file is about the regen.
 *
 * ═══ THE RULE, AND WHY IT IS A SHARE RATHER THAN A CEILING ═══
 *
 * A fixed cap (say "no more than 80 a second") ages badly: it is measured
 * against a catalogue that changes every time Or draws a card. A SHARE is
 * measured against the game as it actually is on the day the test runs — the
 * same reason cardCost.ts prints its distribution instead of asserting a
 * number.
 */
import { describe, expect, it } from "vitest";
import { COMBAT, collectableCards } from "@amanda/shared";
import type { Card } from "@amanda/shared";
import { CATALOG } from "./content.js";

/** Damage a second, the way the engine works it out (combat.ts). */
function dps(card: Card): number {
  return card.stats.attackSpeed > 0
    ? (card.stats.power * COMBAT.damageMultiplier) / card.stats.attackSpeed
    : 0;
}

/** Health a second a card gives back to ITSELF, with nothing else on the board. */
function selfHeal(card: Card): number {
  let heal = 0;
  for (const a of card.abilities) {
    if (a.type !== "regen") continue;
    const n = a.params?.hpPerSecond;
    if (typeof n === "number") heal += n;
  }
  return heal;
}

/** Amanda is not collectable and is not meant to be fair. */
const POOL = collectableCards([...CATALOG.values()]).filter((c) => c.id !== "legends_01_amanda");

const healers = POOL.filter((c) => selfHeal(c) > 0);

describe("a card that heals itself", () => {
  it("there are some, or this file is measuring nothing", () => {
    expect(healers.length).toBeGreaterThan(0);
  });

  it("can be killed by at least three quarters of the game", () => {
    for (const healer of healers) {
      const heal = selfHeal(healer);
      const can = POOL.filter((c) => dps(c) > heal).length;
      const share = can / POOL.length;
      expect(
        share,
        `${healer.id} heals ${heal}/s and only ${can} of ${POOL.length} cards out-damage that`,
      ).toBeGreaterThanOrEqual(0.75);
    }
  });

  /*
   * The one that sent Or to write the message. At 120 a second it was 63% of
   * the catalogue, which is the test above failing — and nothing was watching.
   */
  it("is true of the Mother Tree, which is where this came from", () => {
    const tree = CATALOG.get("plants_10_great_mother_tree")!;
    expect(selfHeal(tree)).toBeLessThanOrEqual(80);
    expect(tree.stats.hp).toBeLessThanOrEqual(2200);
  });
});
