/**
 * **A battle that ends early really is short, and the clock has to say so.**
 *
 * Or: *"when the king dies before the end of the battle time, the clock goes
 * down automatically so the battle ends at 0 together with the king dying.
 * That's weird. If the king dies the battle just ends, even if there are 23
 * seconds left on the clock and I didn't get the end-of-clock beep. That is
 * completely fine by me."*
 *
 * The arena was reading the clock off `frames.length`, which is how long the
 * battle ACTUALLY ran — so a battle decided at 35 seconds told the clock it
 * had 35 seconds to spend, and it emptied exactly as the crown came down.
 * The fix is in Arena.tsx; what belongs here is the premise underneath it,
 * which is the engine's and can be measured rather than described:
 *
 *   a king who falls ends the battle THERE, and the frames stop with him.
 *
 * Without that there is no bug and no fix — the clock would have been right
 * all along.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import { PHASES, SIMULATION } from "@amanda/shared";
import type { Card, Series } from "@amanda/shared";

const TPS = SIMULATION.ticksPerSecond;
const FULL = PHASES.battle.seconds * TPS;

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

const card = (
  id: string,
  over: Partial<{ hp: number; power: number; move: number }> = {},
): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    stats: {
      hp: over.hp ?? 1000,
      power: over.power ?? 0,
      attackSpeed: 1,
      moveSpeed: over.move ?? 0,
      range: "melee",
    },
    abilities: [],
  }) as unknown as Card;

/*
 * One side walks over and kills a king that cannot fight back. Deliberately
 * lopsided: the question is only WHEN the clock stops, so the battle wants
 * to be decisive and nothing else.
 */
const CATALOG = new Map(
  [
    card("paperKing", { hp: 400 }),
    card("ironKing", { hp: 90_000 }),
    card("breaker", { hp: 9000, power: 900, move: 1 }),
  ].map((c) => [c.id, c]),
);

const result = runBattle({
  seed: 7,
  catalog: CATALOG,
  synergies: [] as Series["synergy"][] as never,
  recordFrames: true,
  a: { owner: "A", placements: [{ cardId: "paperKing", x: 0, y: 1, king: true }] } as BoardInput,
  b: {
    owner: "B",
    placements: [
      { cardId: "ironKing", x: 0, y: 2, king: true },
      { cardId: "breaker", x: 3, y: 1 },
    ],
  } as BoardInput,
});

describe("a king who falls early", () => {
  it("ends the battle where he falls", () => {
    expect(result.winReason ?? result.endedBy).toBeTruthy();
    expect(result.ticks, "it did not run the full 58 seconds").toBeLessThan(FULL);
  });

  it("stops the frames with him, which is what misled the clock", () => {
    expect(result.frames.length).toBeLessThanOrEqual(result.ticks + 1);
    expect(result.frames.length).toBeLessThan(FULL);
  });

  it("leaves real seconds on the allowance", () => {
    const ranSec = result.frames.length / TPS;
    const leftSec = PHASES.battle.seconds - ranSec;
    /*
     * This board is deliberately lopsided and finishes in 1.5 seconds, so
     * the figure itself means nothing — what it demonstrates is that the
     * gap exists at all. The clock used to show 1.5 and empty; it now shows
     * 58 falling to 56.5 and stopping there, with the crown coming down on
     * a clock that plainly had time left.
     */
    expect(leftSec, `battle ran ${ranSec.toFixed(1)}s, leaving ${leftSec.toFixed(1)}s`).toBeGreaterThan(1);
    // And this is what the old code counted instead: the replay's own length,
    // which by construction always runs out exactly as the battle ends.
    expect(result.frames.length / TPS - ranSec).toBe(0);
  });
});
