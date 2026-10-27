/**
 * **Poison wears off.**
 *
 * Or: *"and I don't know who is spreading poison, but it is at too high a
 * spread and for too long. Every monster is poisoned the whole game — that
 * is what the green bubbles on them mean, isn't it? Let's meter it."*
 *
 * It is, and he had read the code off the screen. `dotStacks` and `dotDps`
 * were only ever added to — nothing decremented them, cleared them or timed
 * them out — so anything poisoned once kept burning until the clock ran out
 * fifty-eight seconds later. The client draws its bubbles from health lost
 * with no blow behind it, so the bubbles were telling the truth.
 *
 * Six of the sixty-one collectable cards poison on hit, up to eight stacks
 * of as much as fifty: four hundred damage a second, for ever, against a
 * catalogue whose middle card has 525 health.
 *
 * Five stacks now, and five seconds counted from the LAST hit. This measures
 * the second half of that, which is the half that did not exist.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import type { Card, Series } from "@amanda/shared";

const TPS = 30;

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
  over: Partial<{ hp: number; power: number; move: number; abilities: Card["abilities"] }> = {},
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
    abilities: over.abilities ?? [],
  }) as unknown as Card;

/*
 * ═══ A BOARD WHERE THE ONLY THING THAT CAN HURT ANYBODY IS THE POISON ═══
 *
 * The question is "does the burning stop", so after the poisoner is gone
 * there must be nothing else on the board able to take a point off the
 * target. It cannot move, both Kings are out of reach and have no power,
 * and the stinger is the only other thing alive.
 *
 * The numbers are chosen so the stinger gets one hit in and then dies: it
 * out-lives a single swing of the target's and not two. One stack, 100 a
 * second, is enough to see and small enough that the target lives — which
 * is itself the point of metering it.
 */
const CATALOG = new Map(
  [
    card("king", { hp: 90_000 }),
    card("target", { hp: 20_000, power: 3000 }),
    card("stinger", {
      hp: 5000,
      power: 1,
      move: 1,
      abilities: [
        { type: "stackingDot", trigger: "onHit", params: { dotPerStack: 100 } } as never,
      ],
    }),
  ].map((c) => [c.id, c]),
);

const board = (owner: "A" | "B", cardId: string): BoardInput =>
  ({
    owner,
    placements: [
      { cardId: "king", x: 0, y: 1, king: true },
      { cardId, x: 3, y: 0 },
    ],
  }) as BoardInput;

const r = runBattle({
  seed: 3,
  catalog: CATALOG,
  synergies: [] as Series["synergy"][] as never,
  recordFrames: true,
  a: board("A", "target"),
  b: board("B", "stinger"),
});

/** The target's health at a tick, read off the recorded frames. */
function hpAt(tick: number): number {
  let last = Number.NaN;
  for (const f of r.frames) {
    if (f.tick > tick) break;
    const u = f.units.find((x) => x.cardId === "target");
    if (u) last = u.hp;
  }
  return last;
}

const stinger = r.finalUnits.find((u) => u.cardId === "stinger")!;
const died = r.events.find((e) => e.type === "death" && e.uid === stinger.uid)!;

describe("a poisoned card stops being poisoned", () => {
  it("has something to measure: one hit lands, then the poisoner dies", () => {
    expect(died, "the stinger was supposed to die").toBeDefined();
    expect(died.tick, "after it got a hit in").toBeGreaterThan(1);
    expect(hpAt(died.tick), "and the hit poisoned").toBeLessThan(20_000);
  });

  it("keeps burning after the poisoner is gone", () => {
    // The half of the old behaviour that was the point, and is kept: a
    // poisoner can die and still finish what it started.
    expect(hpAt(died.tick + 2 * TPS)).toBeLessThan(hpAt(died.tick));
  });

  it("and then stops, instead of burning for the rest of the battle", () => {
    /*
     * Measured: the hit lands at tick 1, the target loses 100 a second, and
     * it stops at tick 150 — five seconds to the tick — at 19,502 and stays
     * there. Two windows, both well past the expiry; if poison is ever
     * permanent again the second one loses as much as the first.
     */
    expect(hpAt(180) - hpAt(240), "nothing is still burning it").toBe(0);
    expect(hpAt(240)).toBeGreaterThan(19_000);
  });

  it("leaves the target alive, which is what metered means", () => {
    expect(r.finalUnits.find((u) => u.cardId === "target")!.alive).toBe(true);
  });
});
