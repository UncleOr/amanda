/**
 * **The crown's own answer.**
 *
 * Or: *"and confirming with you that there is an option for somebody who
 * shoots whoever is shooting at the King (both as a sniper and at close
 * range)."*
 *
 * There was not. Seven targeting modes and not one of them looked at the
 * crown: `avenger` is the nearest thing in the list and it is a different
 * card — it replies to what hit ME. So this is the eighth, and it is the
 * only DEFENSIVE one: every other mode chooses a victim, this one chooses
 * something to stop, and it is the only one whose answer depends on
 * something that happened to a third card.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { Card } from "@amanda/shared";

const BASE = {
  seriesId: "machines",
  number: 1,
  rarity: "common",
  elements: ["metal"],
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

const card = (
  id: string,
  over: Partial<{
    hp: number;
    power: number;
    move: number;
    range: "melee" | "ranged" | "sniper";
    targeting: string;
  }> = {},
): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    flying: false,
    targeting: over.targeting ?? "lane",
    stats: {
      hp: over.hp ?? 4000,
      power: over.power ?? 200,
      attackSpeed: 3,
      moveSpeed: over.move ?? 0,
      range: over.range ?? "melee",
    },
    abilities: [],
  }) as unknown as Card;

const CATALOG = new Map<string, Card>([
  ["crown", card("crown", { hp: 20000, power: 1 })],
  // Two enemies: one walks in and hits the crown, one sits in its own lane
  // and never goes near it.
  ["raider", card("raider", { move: 1.6, power: 300, targeting: "king" })],
  ["bystander", card("bystander", { hp: 9000, power: 1 })],
  // The guard, in both of the ranges Or named.
  ["guard_melee", card("guard_melee", { move: 1.6, targeting: "bodyguard" })],
  ["guard_sniper", card("guard_sniper", { range: "sniper", targeting: "bodyguard" })],
  ["guard_lane", card("guard_lane", { move: 1.6 })],
]);

/** What this guard spent the battle hitting. */
function hitBy(guard: "guard_melee" | "guard_sniper" | "guard_lane"): Set<string> {
  const r = runBattle({
    a: {
      owner: "A",
      placements: [
        { cardId: "crown", x: 1, y: 1, king: true },
        { cardId: guard, x: 0, y: 0 },
      ],
    },
    b: {
      owner: "B",
      placements: [
        { cardId: "raider", x: 3, y: 1 },
        { cardId: "bystander", x: 3, y: 0 },
      ],
    },
    seed: 5,
    catalog: CATALOG,
    synergies: [],
  });
  const byUid = new Map(r.finalUnits.map((u) => [u.uid, u]));
  const mine = r.finalUnits.find((u) => u.cardId === guard)!.uid;
  return new Set(
    r.events
      .filter((e) => e.type === "attack" && e.uid === mine)
      .map((e) => byUid.get(e.targetUid!)?.cardId ?? "?"),
  );
}

describe("a card told to watch the crown", () => {
  it("goes for whatever hit the King, at close range", () => {
    /*
     * ⚠ THE CONTROL IS THE POINT OF THIS TEST. The guard sits in lane 0
     * with a perfectly good enemy standing opposite it, and the raider is
     * in lane 1 — so an ordinary card never looks at the raider at all.
     * Both are measured, because "it attacked the raider" only means
     * something next to "and it would not have".
     */
    expect(hitBy("guard_melee"), "the bodyguard ignored the King's attacker").toContain("raider");
    expect(hitBy("guard_lane"), "an ordinary card went for it anyway").not.toContain("raider");
  });

  it("does it as a sniper too, which is the half Or asked about", () => {
    expect(hitBy("guard_sniper")).toContain("raider");
  });

  it("does nothing until the crown is actually hit", () => {
    /*
     * It is a REPLY, like the avenger — `struckKing` is set where the blow
     * LANDS, not where it is aimed, so a card that marched at the crown and
     * died on the way never earns the guard's attention. Without an attacker
     * the guard is simply a lane card, which is the fallback every one of
     * these modes has and the reason none of them can strand a unit.
     */
    const r = runBattle({
      a: {
        owner: "A",
        placements: [
          { cardId: "crown", x: 1, y: 1, king: true },
          { cardId: "guard_melee", x: 0, y: 0 },
        ],
      },
      // Nobody moves, so nobody reaches the crown.
      b: { owner: "B", placements: [{ cardId: "bystander", x: 3, y: 0 }] },
      seed: 5,
      catalog: CATALOG,
      synergies: [],
    });
    const mine = r.finalUnits.find((u) => u.cardId === "guard_melee")!.uid;
    const hits = r.events.filter((e) => e.type === "attack" && e.uid === mine);
    expect(hits.length, "a guard with nothing to guard against stood still").toBeGreaterThan(0);
  });
});
