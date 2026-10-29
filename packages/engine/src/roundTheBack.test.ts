/**
 * **The card that goes round the back.**
 *
 * Or: *"I want another movement ability too: dive / teleport / burrow (it is
 * the same thing, but one for the machines and one for the sea creatures and
 * one for the plants). It basically bypasses everyone and reaches the back
 * part of the board, and then turns around and attacks backwards."*
 *
 * Three names, one mechanic, and the thing worth pinning is not that a flag
 * gets set: it is that the card ENDS UP somewhere else and hits things no
 * ordinary card of the same stats could reach. So every test here compares
 * it against an identical card without the ability.
 */
import { describe, expect, it } from "vitest";
import { ARENA } from "@amanda/shared";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import type { Ability, Card } from "@amanda/shared";

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
  over: Partial<{ hp: number; power: number; move: number; abilities: Ability[] }> = {},
): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    flying: false,
    targeting: "lane",
    stats: {
      hp: over.hp ?? 40000,
      power: over.power ?? 0,
      attackSpeed: 0.5,
      moveSpeed: over.move ?? 0,
      range: "melee",
    },
    abilities: over.abilities ?? [],
  }) as unknown as Card;

const spawn = (type: string): Ability => ({ type, trigger: "onSpawn", params: {} }) as unknown as Ability;

const CATALOG = new Map<string, Card>([
  ["plain", card("plain", { power: 300, move: 1 })],
  ["diver", card("diver", { power: 300, move: 1, abilities: [spawn("dive")] })],
  ["teleporter", card("teleporter", { power: 300, move: 1, abilities: [spawn("teleport")] })],
  ["burrower", card("burrower", { power: 300, move: 1, abilities: [spawn("burrow")] })],
  /** A front line thick enough that nothing walks through it. */
  ["wall", card("wall", { hp: 200000 })],
  /** The thing hiding at the back, which only something behind can touch. */
  ["artillery", card("artillery", { hp: 9000 })],
]);

/** B keeps a wall at the front and something soft at the very back. */
const ENEMIES: BoardInput["placements"] = [
  { cardId: "wall", x: 3, y: 0 },
  { cardId: "wall", x: 2, y: 0 },
  { cardId: "artillery", x: 0, y: 0 },
];

function fight(attacker: string) {
  const r = runBattle({
    a: { owner: "A", placements: [{ cardId: attacker, x: 0, y: 0 }] },
    b: { owner: "B", placements: ENEMIES },
    seed: 1,
    catalog: CATALOG,
    synergies: [],
  });
  const me = r.finalUnits.find((u) => u.cardId === attacker)!;
  const hp = new Map(r.finalUnits.map((u) => [u.cardId, Math.round(Math.max(0, u.hp))]));
  return { me, hp, events: r.events };
}

describe("dive, teleport and burrow", () => {
  it("start the battle at the far end of the enemy's board", () => {
    /*
     * A is placed at its own back row (x 0 → column 0) and comes up at
     * column 7, which is as far as the arena goes. Measured at the dig
     * rather than at the end, because it does not stay there — it walks
     * home from the back, which is the other half of the ability.
     */
    for (const id of ["diver", "teleporter", "burrower"]) {
      const dig = fight(id).events.find((e) => e.type === "dig");
      expect(dig?.col, id).toBe(ARENA.width - 1);
      expect(fight(id).me.col, `${id} finished in their half`).toBeGreaterThan(4);
    }
    expect(fight("plain").me.col, "and the ordinary card does not").toBeLessThan(4);
  });

  it("and are facing the other way when they get there", () => {
    expect(fight("diver").me.facing).toBe(-1);
    expect(fight("plain").me.facing).toBe(1);
  });

  it("say so once, so the screen can show it", () => {
    const digs = fight("burrower").events.filter((e) => e.type === "dig");
    expect(digs).toHaveLength(1);
    expect(digs[0]!.col).toBe(ARENA.width - 1);
    expect(fight("plain").events.filter((e) => e.type === "dig")).toHaveLength(0);
  });

  it("reach the thing the wall was protecting, which nothing else can", () => {
    /*
     * The whole point, measured: two walls of 200,000 health stand between
     * the attacker and the artillery. An identical card without the ability
     * spends the entire battle on the first wall and never touches it.
     */
    expect(fight("plain").hp.get("artillery"), "the wall holds").toBe(9000);
    expect(fight("diver").hp.get("artillery")!, "the diver is behind it").toBeLessThan(9000);
  });

  it("are the same mechanic under three names", () => {
    // Or asked for one per family. If these ever differ, one of them has
    // been given a rule of its own and the cards stop being comparable.
    const [a, b, c] = ["diver", "teleporter", "burrower"].map((id) => fight(id).hp.get("artillery"));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("do not walk off into an empty board once they are through", () => {
    /*
     * ⚠ THE STALL, WHICH THIS ABILITY WOULD HAVE REINTRODUCED. Facing home
     * means that once it has cleared everything between itself and its own
     * side there is nothing "ahead" of it at all — and a unit with no
     * target walks to the wall and stands there. It faces about once.
     */
    const r = runBattle({
      a: { owner: "A", placements: [{ cardId: "diver", x: 0, y: 0 }] },
      // One soft thing, at the FRONT, so the diver comes up behind it,
      // walks home past it and then has to turn round to find it again.
      b: { owner: "B", placements: [{ cardId: "artillery", x: 3, y: 3 }] },
      seed: 1,
      catalog: CATALOG,
      synergies: [],
    });
    const prey = r.finalUnits.find((u) => u.cardId === "artillery")!;
    expect(prey.hp, "it found its way back to the only enemy there is").toBeLessThan(9000);
  });
});
