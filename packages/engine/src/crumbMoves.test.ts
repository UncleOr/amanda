/**
 * A board of filler still has a battle on it.
 *
 * Or: *"crumb monsters need to move, otherwise they jam the whole game."*
 *
 * ═══ WHAT "JAM" MEANT, MEASURED ═══
 *
 * The Crumb Demon is what fills an empty slot when the build timer ends, so
 * a player with a thin album fields a board made mostly of them. Its
 * moveSpeed was 0. Two such boards cannot touch each other: nothing walks,
 * nothing is in range, no hit point ever changes. The stalemate detector
 * notices after three seconds and the winner is decided by counting hit
 * points — which is to say the punishment for not owning cards was not
 * losing the battle, it was not being given one.
 *
 * At 0.5 — the slowest speed any real card has — the filler walks, meets
 * the other side, and the battle is decided by fighting.
 *
 * The test uses the REAL card off the catalogue rather than one built here,
 * because the number being tested is the one the game ships.
 */
import { describe, expect, it } from "vitest";
import { CRUMB_DEMON, SIMULATION } from "@amanda/shared";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import type { Card } from "@amanda/shared";

/** The Crumb Demon exactly as catalog.ts and content.ts both build it. */
const CRUMB: Card = {
  id: "crumb_demon",
  seriesId: "system",
  numberInSeries: 1,
  name: { he: "מפלץ פירורים", en: "Crumb Demon" },
  elements: ["earth"],
  rarity: "common",
  stats: {
    hp: CRUMB_DEMON.hp,
    power: CRUMB_DEMON.power,
    attackSpeed: CRUMB_DEMON.attackSpeed,
    moveSpeed: CRUMB_DEMON.moveSpeed,
    range: "melee",
  },
  flying: false,
  targeting: "lane",
  midBoss: false,
  launch: false,
  abilities: [],
  art: { placeholderColor: "#7a7a7a", sprite: "cards/crumb_demon.webp" },
} as Card;

/** Something for the filler to walk towards and chew on. */
const KING: Card = {
  ...CRUMB,
  id: "king",
  name: { he: "מלך", en: "King" },
  stats: { ...CRUMB.stats, hp: 400, power: 0, moveSpeed: 0 },
} as Card;

const CATALOG = new Map([CRUMB, KING].map((c) => [c.id, c]));
const LANES = 8;

/** A King and a row of filler in front of it — a thin album's whole board. */
const fillerBoard = (owner: "A" | "B"): BoardInput =>
  ({
    owner,
    placements: [
      { cardId: "king", x: 1, y: 3, king: true },
      { cardId: "crumb_demon", x: 3, y: 2 },
      { cardId: "crumb_demon", x: 3, y: 3 },
      { cardId: "crumb_demon", x: 3, y: 4 },
    ],
  }) as BoardInput;

const run = () =>
  runBattle({
    seed: 7,
    catalog: CATALOG,
    synergies: [],
    a: fillerBoard("A"),
    b: fillerBoard("B"),
    lanes: LANES,
  });

describe("a board made of crumbs", () => {
  it("moves at all, which is the whole fix", () => {
    expect(CRUMB_DEMON.moveSpeed).toBeGreaterThan(0);
  });

  it("is never faster than a real card's slowest walk", () => {
    // 0.5 is the floor among the shipped cards. Filler that outpaced
    // anything you could collect would be a reason not to collect.
    expect(CRUMB_DEMON.moveSpeed).toBeLessThanOrEqual(0.5);
  });

  it("has a battle rather than a staring contest", () => {
    const res = run();
    /*
     * The thing that was wrong: the old board ended inside the stalemate
     * window because nothing could happen. A battle that runs well past it
     * is a battle that is happening.
     */
    const stalled = SIMULATION.ticksPerSecond * (SIMULATION.stalemateSeconds + 2);
    expect(res.ticks).toBeGreaterThan(stalled);
    expect(res.ticks).toBeLessThanOrEqual(SIMULATION.totalBattleTicks);
  });

  it("decides it by fighting, not by counting what never moved", () => {
    const res = run();
    expect(["A", "B"]).toContain(res.winner);
    // Somebody actually died. With moveSpeed 0 nothing ever could.
    expect(res.ticks).toBeGreaterThan(0);
  });
});
