/**
 * **Do the flyers actually fly?**
 *
 * Or: *"and confirming with you that the flyers really do fly (and advance
 * even when somebody is blocking them)."*
 *
 * A fair question, because "it flies" is written on the card as a fact and
 * the only place it is true is a handful of `if (!u.flying)` lines in
 * simulate.ts. Nothing on screen says a flyer passed over anything; what a
 * player sees is one card further forward than another, which is also what
 * a faster card looks like.
 *
 * So this measures it rather than reading it. Two units, identical in every
 * number, one of them flying, each stuck behind an ally that will not move:
 * the difference in how far they get is the whole of what the word means.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
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
  over: Partial<{ hp: number; power: number; move: number; flying: boolean }> = {},
): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    flying: over.flying ?? false,
    stats: {
      hp: over.hp ?? 4000,
      power: over.power ?? 10,
      attackSpeed: 3,
      moveSpeed: over.move ?? 1.5,
      range: "melee",
    },
    abilities: [],
  }) as unknown as Card;

const CATALOG = new Map<string, Card>([
  ["walker", card("walker")],
  ["flyer", card("flyer", { flying: true })],
  // A wall of its own side: it does not move, so anything behind it on the
  // ground has to stop and wait.
  ["ally_wall", card("ally_wall", { move: 0, hp: 9000 })],
  // Something to walk towards, far away and harmless, so the only thing
  // deciding where anybody ends up is the wall.
  ["far", card("far", { hp: 90000, power: 0, move: 0 })],
]);

/** How far the mover got, as a column, after a full battle. */
function reached(mover: "walker" | "flyer"): number {
  const placements: BoardInput["placements"] = [
    // The mover at the back, its own wall directly in front of it.
    { cardId: mover, x: 0, y: 0 },
    { cardId: "ally_wall", x: 1, y: 0 },
  ];
  const r = runBattle({
    a: { owner: "A", placements },
    // In the SAME lane, which matters: a target in another lane makes
    // everybody drift sideways out from behind the wall, and then the
    // measurement is of lane drift rather than of flying.
    b: { owner: "B", placements: [{ cardId: "far", x: 3, y: 0 }] },
    seed: 1,
    catalog: CATALOG,
    synergies: [],
  });
  return r.finalUnits.find((u) => u.cardId === mover)!.col;
}

describe("a card that flies", () => {
  const wall = (): number => {
    const r = runBattle({
      a: { owner: "A", placements: [{ cardId: "ally_wall", x: 1, y: 0 }] },
      b: { owner: "B", placements: [{ cardId: "far", x: 3, y: 0 }] },
      seed: 1,
      catalog: CATALOG,
      synergies: [],
    });
    return r.finalUnits.find((u) => u.cardId === "ally_wall")!.col;
  };

  it("does not queue up behind its own front line", () => {
    const walked = reached("walker");
    const flew = reached("flyer");
    const stuckAt = wall();
    // The walker is held behind the wall; the flyer is past it. Stated as
    // "past the thing that stopped the other one" rather than as two
    // numbers, so tuning the follow gap cannot quietly make it pass.
    /*
     * Measured: the walker finishes at column 0.00 — it never leaves the
     * square it started on, because its own wall is one column ahead of it
     * — and the flyer finishes at 2.40, which is as far forward as the
     * enemy's reach allows.
     */
    expect(walked, "the walker is behind the wall").toBeLessThan(stuckAt);
    expect(flew, "the flyer is past it").toBeGreaterThan(stuckAt);
  });

  it("gets further than the identical card that cannot", () => {
    // Identical in every stat but one. If this is ever equal, flying has
    // stopped meaning anything on the board.
    expect(reached("flyer")).toBeGreaterThan(reached("walker"));
  });

  it("changes lanes through its own side as well", () => {
    /*
     * The second half of `!u.flying`, and the one nobody would notice
     * missing: on the ground a unit may not drift into a lane one of its
     * own is standing in, so a card trying to spread out can be boxed in
     * by its own board. A flyer goes over.
     */
    const src = readSource();
    expect(src, "lane drift checks it").toContain("// On the ground you cannot walk through your own; in the air you can.");
    expect(src.match(/if \(!u\.flying\)/g) ?? [], "forward and sideways").toHaveLength(2);
  });

  it("still stops to fight what is in front of it", () => {
    /*
     * The other half of Or's question. "Advances even when somebody is
     * blocking them" is about its OWN side — a flyer that also ignored
     * enemies would sail past the board into an empty corner and the game
     * would have no front line at all.
     */
    const r = runBattle({
      a: { owner: "A", placements: [{ cardId: "flyer", x: 0, y: 0 }] },
      b: { owner: "B", placements: [{ cardId: "far", x: 3, y: 0 }] },
      seed: 1,
      catalog: CATALOG,
      synergies: [],
    });
    const hits = r.events.filter((e) => e.type === "attack");
    expect(hits.length, "it engaged rather than flew past").toBeGreaterThan(0);
  });
});

function readSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node:fs").readFileSync(
    require("node:url").fileURLToPath(new URL("./simulate.ts", import.meta.url)),
    "utf8",
  ) as string;
}
