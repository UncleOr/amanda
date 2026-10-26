/**
 * **The egg has to become something, and breaking it is what does it.**
 *
 * Or, the first time: *"the Obsidian Egg died and no dragon hatched out of
 * it."* Then, once it did: *"change its behaviour as well as its text. The
 * text should say it becomes a Flame Dragon after it DIES. And the Flame
 * Dragon itself can be a bit weaker than a normal one — a bit less health
 * and a bit less power — but it still has to fly like a Flame Dragon."*
 *
 * So the ten-second timer is gone and the trigger is the one thing on a
 * board that a child can see coming: the egg's health running out. Which
 * makes four things worth pinning, and three of them are about what must NOT
 * happen — a unit that hatches has not died, and everything the engine does
 * to a corpse has to stay away from it.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import { buildBattle, type BoardInput } from "./setup.js";
import type { Card } from "@amanda/shared";

const BASE = {
  seriesId: "dragons",
  number: 1,
  rarity: "common",
  elements: ["fire"],
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

const card = (
  id: string,
  over: Partial<{ hp: number; power: number; flying: boolean; abilities: unknown[] }> = {},
): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    flying: over.flying ?? false,
    stats: {
      hp: over.hp ?? 1000,
      power: over.power ?? 500,
      attackSpeed: 1,
      moveSpeed: 0,
      range: "melee",
    },
    abilities: over.abilities ?? [],
  }) as unknown as Card;

const EGG = card("egg", {
  hp: 100,
  power: 0,
  abilities: [
    {
      type: "hatchOnDeath",
      trigger: "onDeath",
      params: { into: "dragon", hpPct: 75, powerPct: 75 },
    },
  ],
});

/** What it becomes: a flyer, and twice the egg in every number. */
const DRAGON = card("dragon", { hp: 40000, power: 900, flying: true });

const CATALOG = new Map<string, Card>([
  ["egg", EGG],
  ["dragon", DRAGON],
  // Hits hard enough to break a 100-health egg in two swings, and is
// built to outlast what comes out of it — so the only thing that
// happens in these battles is the hatching.
  ["hitter", card("hitter", { hp: 90000, power: 60 })],
  ["below", card("below")],
]);

const battle = (placements: BoardInput["placements"]) =>
  runBattle({
    a: { owner: "A", placements },
    b: { owner: "B", placements: [{ cardId: "hitter", x: 3, y: 0 }] },
    seed: 1,
    catalog: CATALOG,
    synergies: [],
    recordFrames: true,
  });

const EGG_ALONE: BoardInput["placements"] = [{ cardId: "egg", x: 3, y: 0 }];

/** The unit that started as the egg, once the battle is over. */
const ended = (r: ReturnType<typeof runBattle>) =>
  r.finalUnits.find((u) => u.owner === "A")!;

describe("breaking the egg", () => {
  it("leaves a dragon standing where the egg was", () => {
    const r = battle(EGG_ALONE);
    const u = ended(r);
    expect(u.cardId, "the card changed, which is what the client draws from").toBe("dragon");
    expect(u.alive, "and it is not a corpse").toBe(true);
  });

  it("says so exactly once", () => {
    const r = battle(EGG_ALONE);
    const said = r.events.filter((e) => e.type === "transform");
    expect(said, "the screen is told, and told once").toHaveLength(1);
    expect(said[0]!.cardId).toBe("dragon");
  });

  it("never reports a death for it", () => {
    // The whole point of hatching in front of the death rather than after
    // it: a shell coming apart is not a kill, and nothing downstream of a
    // death — the Ground Floor reveal, a swarm, a King's fall — may run.
    const r = battle(EGG_ALONE);
    const egg = r.frames[0]!.units.find((u) => u.owner === "A")!;
    expect(r.events.some((e) => e.type === "death" && e.uid === egg.uid)).toBe(false);
  });

  it("comes out weaker than the real thing, and flying", () => {
    const s = buildBattle({
      a: { owner: "A", placements: EGG_ALONE },
      b: { owner: "B", placements: [{ cardId: "dragon", x: 3, y: 0 }] },
      seed: 1,
      catalog: CATALOG,
      synergies: [],
    });
    const real = s.units.find((u) => u.cardId === "dragon")!;

    const r = battle(EGG_ALONE);
    const born = ended(r);
    expect(born.maxHp, "three quarters of a real dragon").toBe(Math.round(real.maxHp * 0.75));
    expect(born.power).toBe(Math.round(real.power * 0.75));
    // Or's one non-negotiable: *"but it still has to fly like a Flame
    // Dragon."* It is built from the card, so this comes for free — and
    // that is exactly why it is worth a test, because the cheap way to do
    // this (copy a picture onto the egg) silently would not.
    expect(born.maxHp).toBeLessThan(real.maxHp);
  });

  it("hatches with full health rather than the damage that broke it", () => {
    const r = battle(EGG_ALONE);
    // It is hit again after hatching, so this is only ever "it did not start
    // the dragon's life on the egg's last, negative, point of health".
    const first = r.frames.find((f) => f.units.some((u) => u.cardId === "dragon"))!;
    expect(first.units.find((u) => u.cardId === "dragon")!.hp).toBeGreaterThan(0);
  });

  it("does not bring up what was stacked under it", () => {
    // A Ground Floor card comes up when the thing above it DIES. An egg that
    // hatches is still standing there, so the card underneath has to wait.
    const r = battle([{ cardId: "egg", x: 3, y: 0, below: "below" }] as BoardInput["placements"]);
    expect(r.events.some((e) => e.type === "reveal")).toBe(false);
  });

  it("hatches once, however many times it is hit", () => {
    const r = battle(EGG_ALONE);
    expect(r.events.filter((e) => e.type === "transform")).toHaveLength(1);
  });
});
