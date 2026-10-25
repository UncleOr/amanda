/**
 * **The egg has to become something.**
 *
 * Or: *"the Obsidian Egg died and no dragon hatched out of it."*
 *
 * It never could have. `delayedTransform` added `powerBonus` to the unit's
 * power and set a flag, and that was all of it — no event, and nothing that
 * could reach a screen. The card promises a dragon; the game produced a
 * slightly stronger egg, silently, at a moment nothing marked.
 *
 * So the thing to pin is not "power went up" — that always worked, and a
 * test of it would have passed throughout the bug. It is that the unit is a
 * DIFFERENT CARD afterwards, and that it said so.
 */
import { describe, expect, it } from "vitest";
import { buildBattle, type BoardInput } from "./setup.js";
import { runDelayed } from "./abilities.js";
import { SIMULATION, type Card } from "@amanda/shared";

const BASE = {
  seriesId: "dragons",
  number: 1,
  rarity: "common",
  elements: ["fire"],
  flying: false,
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

const card = (id: string, abilities: unknown[] = []): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    stats: { hp: 1000, power: 500, attackSpeed: 1, moveSpeed: 0, range: "melee" },
    abilities,
  }) as unknown as Card;

const EGG = card("egg", [
  {
    type: "delayedTransform",
    trigger: "delayed",
    params: { afterSeconds: 10, powerBonus: 1500, into: "dragon" },
  },
]);

const CATALOG = new Map<string, Card>([
  ["egg", EGG],
  ["dragon", card("dragon")],
  ["plain", card("plain")],
]);

const placements: BoardInput["placements"] = [
  { cardId: "egg", x: 3, y: 0 },
  { cardId: "plain", x: 3, y: 1 },
];

const battle = () =>
  buildBattle({
    a: { owner: "A", placements },
    b: { owner: "B", placements: [{ cardId: "plain", x: 3, y: 0 }] },
    seed: 1,
    catalog: CATALOG,
    synergies: [],
  });

const egg = (s: ReturnType<typeof buildBattle>) => s.units.find((u) => u.owner === "A" && u.uid.length > 0 && u.cardId === "egg" )!;

describe("the egg hatches", () => {
  it("is still an egg before its time", () => {
    const s = battle();
    s.tick = Math.floor(9 * SIMULATION.ticksPerSecond);
    runDelayed(s, egg(s));
    const u = s.units.find((x) => x.owner === "A" && x.cardId === "egg");
    expect(u, "nine seconds in, nothing has happened").toBeDefined();
    expect(s.events.some((e) => e.type === "transform")).toBe(false);
  });

  it("becomes the card it promised, and says so", () => {
    const s = battle();
    const before = egg(s);
    const power = before.power;
    s.tick = Math.floor(10 * SIMULATION.ticksPerSecond);
    runDelayed(s, before);

    // The half that always worked.
    expect(before.power).toBe(power + 1500);
    /*
     * And the half that did not. `cardId` is what every frame carries to
     * the client and what the client draws from, so this one line is the
     * difference between a dragon appearing and an egg getting stronger.
     */
    expect(before.cardId, "it is a dragon now").toBe("dragon");

    const said = s.events.filter((e) => e.type === "transform");
    expect(said, "and the screen is told exactly once").toHaveLength(1);
    expect(said[0]!.uid).toBe(before.uid);
    expect(said[0]!.cardId, "carrying what it became").toBe("dragon");
  });

  it("hatches once, not once per tick", () => {
    const s = battle();
    const u = egg(s);
    for (let t = 10; t < 14; t++) {
      s.tick = Math.floor(t * SIMULATION.ticksPerSecond);
      runDelayed(s, u);
    }
    expect(s.events.filter((e) => e.type === "transform")).toHaveLength(1);
    expect(u.power, "and the bonus is paid once").toBe(500 + 1500);
  });
});
