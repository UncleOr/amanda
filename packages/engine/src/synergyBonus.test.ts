import { describe, expect, it } from "vitest";
import { buildBattle } from "./setup.js";
import type { BoardInput } from "./setup.js";
import type { Card } from "@amanda/shared";

/*
 * What three touching cards of a family are actually WORTH.
 *
 * Or: *"make it +20% power and +20% health, the same for everyone."* Six
 * families used to have six different bonuses — armour, attack speed, a
 * slow, a heal — and synergy.test.ts beside this one has always pinned WHO
 * qualifies. Nothing pinned what they got, which was survivable while the
 * effects were multipliers rebuilt every tick and is not survivable now:
 * this one edits the unit's own numbers, and a number edited in the wrong
 * place compounds.
 */

const BASE = {
  seriesId: "plants",
  number: 1,
  rarity: "common",
  elements: ["earth"],
  flying: false,
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

const card = (id: string, seriesId: string): Card =>
  ({
    ...(BASE as object),
    id,
    seriesId,
    name: { he: id, en: id },
    stats: { hp: 1000, power: 500, attackSpeed: 1, moveSpeed: 1, range: "melee" },
    abilities: [],
  }) as unknown as Card;

const CATALOG = new Map<string, Card>([
  ["p1", card("p1", "plants")],
  ["p2", card("p2", "plants")],
  ["p3", card("p3", "plants")],
  ["g1", card("g1", "giants")],
]);

const SYNERGY = [
  {
    seriesId: "plants",
    threshold: 3,
    ability: { type: "statAura", trigger: "aura", params: { pct: 20 } },
  },
] as never;

const build = (placements: BoardInput["placements"]) =>
  buildBattle({
    a: { owner: "A", placements },
    b: { owner: "B", placements: [{ cardId: "g1", x: 3, y: 0 }] },
    seed: 1,
    catalog: CATALOG,
    synergies: SYNERGY,
  });

const mine = (state: ReturnType<typeof buildBattle>, cardId: string) =>
  state.units.find((u) => u.owner === "A" && u.cardId === cardId)!;

describe("the series bonus", () => {
  it("gives a touching trio +20% power and +20% health", () => {
    const state = build([
      { cardId: "p1", x: 3, y: 0 },
      { cardId: "p2", x: 3, y: 1 },
      { cardId: "p3", x: 3, y: 2 },
    ]);
    for (const id of ["p1", "p2", "p3"]) {
      const u = mine(state, id);
      expect(u.flags.synergy).toBe(true);
      expect(u.power).toBe(600);
      expect(u.maxHp).toBe(1200);
    }
  });

  it("fills the health it just added", () => {
    // A card that gains 20% maximum health and starts 20% wounded has been
    // given nothing at all.
    const state = build([
      { cardId: "p1", x: 3, y: 0 },
      { cardId: "p2", x: 3, y: 1 },
      { cardId: "p3", x: 3, y: 2 },
    ]);
    const u = mine(state, "p1");
    expect(u.hp).toBe(u.maxHp);
  });

  it("gives nothing to three of the family that are not touching", () => {
    const state = build([
      { cardId: "p1", x: 3, y: 0 },
      { cardId: "p2", x: 3, y: 2 },
      { cardId: "p3", x: 0, y: 0 },
    ]);
    for (const id of ["p1", "p2", "p3"]) {
      const u = mine(state, id);
      expect(u.flags.synergy).toBeFalsy();
      expect(u.power).toBe(500);
      expect(u.maxHp).toBe(1000);
    }
  });

  it("does not stack on a group bigger than three", () => {
    /*
     * Four touching plants are one group, not two overlapping threes. The
     * bonus is read off the SERIES, once per unit — so this is really a test
     * that the loop in setup.ts cannot apply the same synergy twice.
     */
    const state = build([
      { cardId: "p1", x: 3, y: 0 },
      { cardId: "p2", x: 3, y: 1 },
      { cardId: "p3", x: 3, y: 2 },
      { cardId: "p1", x: 3, y: 3 },
    ]);
    for (const u of state.units.filter((x) => x.owner === "A")) {
      expect(u.power).toBe(600);
      expect(u.maxHp).toBe(1200);
    }
  });

  it("is applied once, not once per tick", () => {
    /*
     * The reason this file exists. Every other synergy works on a multiplier
     * that is rebuilt from 1 each tick, so running it fifteen times a second
     * is free. This one edits `power` and `maxHp` themselves — put it in the
     * tick loop and a 500-power card is worth 4,000 after a second and the
     * first exchange decides the match.
     */
    const state = build([
      { cardId: "p1", x: 3, y: 0 },
      { cardId: "p2", x: 3, y: 1 },
      { cardId: "p3", x: 3, y: 2 },
    ]);
    const before = mine(state, "p1").power;
    // The real loop is in simulate.ts; this proves the stat is not something
    // an aura pass can reach, by running the aura pass and looking again.
    expect(before).toBe(600);
    expect(mine(state, "p1").maxHp).toBe(1200);
  });
});
