import { describe, expect, it } from "vitest";
import { SIMULATION, PHASES } from "@amanda/shared";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import type { Card } from "@amanda/shared";

/*
 * A battle that has stopped happening.
 *
 * Or: *"in the battle, make sure that if for 3-5 seconds no card moved and no
 * card fired and no card lost health — the match ends automatically. I just
 * waited 20 seconds."*
 *
 * The position is reachable: everything that could move is dead, and what is
 * left is static and out of reach of anything. The clock then spends the rest
 * of its 58 seconds showing a photograph. Sudden death does not rescue it
 * either — escalation multiplies damage, and multiplying damage that is never
 * dealt is still nothing.
 *
 * The cards are built by hand rather than taken from the catalogue, so a
 * balance change to a real card can never quietly turn these green.
 */
const BASE: Omit<Card, "id" | "name" | "stats" | "abilities"> = {
  seriesId: "test",
  number: 1,
  rarity: "common",
  elements: ["earth"],
  flying: false,
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

function card(id: string, hp: number, power: number, moveSpeed: number): Card {
  return {
    ...BASE,
    id,
    name: { he: id, en: id },
    stats: { hp, power, attackSpeed: 1, moveSpeed, range: "melee" },
    abilities: [],
  } as Card;
}

const CATALOG = new Map(
  [
    // Rooted and harmless: cannot walk towards anything, cannot hurt it if
    // it got there. Two of these can never resolve a battle between them.
    card("statue", 10_000, 0, 0),
    // Rooted but armed, with a real King to chew on.
    card("turret", 10_000, 400, 0),
    card("meat", 5_000_000, 0, 0),
  ].map((c) => [c.id, c]),
);

const LANES = 8;
const run = (a: BoardInput, b: BoardInput) =>
  runBattle({ seed: 7, catalog: CATALOG, synergies: [], a, b, lanes: LANES });

const statues = (owner: "A" | "B", x: number): BoardInput =>
  ({
    owner,
    placements: [{ cardId: "statue", x, y: 3, king: true }],
  }) as BoardInput;

describe("a battle that has stopped happening", () => {
  it("ends early instead of running the clock out on a still picture", () => {
    const res = run(statues("A", 1), statues("B", 1));

    const full = SIMULATION.totalBattleTicks;
    // The detector needs its three seconds before it can know, plus a tick
    // or two of slack for the first frame.
    const cap = Math.round(SIMULATION.ticksPerSecond * (SIMULATION.stalemateSeconds + 2));

    expect(res.ticks).toBeLessThan(full);
    expect(res.ticks).toBeLessThanOrEqual(cap);
  });

  it("still produces a winner, decided the way the clock would have", () => {
    const res = run(statues("A", 1), statues("B", 1));
    expect(["A", "B"]).toContain(res.winner);
    // The same resolution path a timeout takes, so cutting the wait cannot
    // change WHO won — only how long you sit watching nothing.
    expect(["kingHp", "totalHp", "aliveCount", "coinFlip"]).toContain(res.winReason);
  });

  /*
   * ═══ THE HALF THAT MATTERS MORE ═══
   *
   * A check that ends battles early is only safe if it cannot end one that
   * is still going. A turret grinding a huge King down changes one number
   * per tick and nothing else — no movement, no deaths, no reveals — which
   * is the thinnest "something is happening" the game can produce, and the
   * closest a real fight ever gets to looking like a photograph.
   */
  it("does not cut short a fight where the only thing happening is damage", () => {
    const grinding: BoardInput = {
      owner: "A",
      placements: [
        { cardId: "meat", x: 1, y: 3, king: true },
        { cardId: "statue", x: 3, y: 3 },
      ],
    } as BoardInput;
    const shooting: BoardInput = {
      owner: "B",
      placements: [
        { cardId: "meat", x: 1, y: 3, king: true },
        { cardId: "turret", x: 3, y: 3 },
      ],
    } as BoardInput;

    const res = run(grinding, shooting);
    const full = SIMULATION.totalBattleTicks;
    // It ran a long way past the stalemate window, because hp kept moving.
    expect(res.ticks).toBeGreaterThan(SIMULATION.ticksPerSecond * (SIMULATION.stalemateSeconds + 3));
    expect(res.ticks).toBeLessThanOrEqual(full);
  });
});

describe("the build phase", () => {
  /*
   * A pin on the number rather than on a behaviour: it is the one Or asked
   * to cut, and the one most likely to drift back up by accident.
   */
  it("is the shortened one", () => {
    expect(PHASES.build.seconds).toBe(45);
  });
});
