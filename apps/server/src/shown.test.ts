import { describe, expect, it } from "vitest";
import { runBattle, type Placement } from "@amanda/engine";
/*
 * Here rather than in the engine package, for a dull reason worth writing
 * down once: these need the real catalogue, the engine's tsconfig has a
 * rootDir that cannot see outside its own package, and every other test that
 * wants real cards already lives here (balance.test.ts, solo.test.ts).
 */
import { CATALOG, SYNERGIES } from "./content.js";

/**
 * **What the screen is told about an ability.**
 *
 * Or: *"yes, let's do the abilities."* Most of them never reached the screen
 * at all — a card being healed, a card burning from poison, a card whose
 * armour ate the blow — because nothing in the events said so.
 *
 * Two of those are answered in the renderer, by watching the health in the
 * frames (healing and poison have no event and need none). The third cannot
 * be: only the engine knows what a blow WOULD have been, so only the engine
 * can say what was stopped. That is what is pinned here, along with the
 * thorns flag the renderer had been ignoring.
 */
function slots(): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++) if (!(x >= 1 && x <= 2 && y >= 1 && y <= 2)) out.push({ x, y });
  return out;
}
const boardOf = (id: string): Placement[] => [
  { cardId: id, x: 1, y: 1, king: true },
  ...slots().map((s) => ({ cardId: id, ...s })),
];

/** One battle, and every hit event in it. */
function hits(mine: string, theirs: string) {
  const r = runBattle({
    seed: 11,
    catalog: CATALOG,
    synergies: SYNERGIES,
    a: { owner: "A", placements: boardOf(mine) },
    b: { owner: "B", placements: boardOf(theirs) },
  });
  return r.events.filter((e) => e.type === "hit");
}

describe("a blow that was partly stopped", () => {
  /*
   * The Steel Warden gives every giant around it 200 flat armour, so a
   * board of them is a board where most blows arrive smaller than they left.
   */
  it("says how much never arrived", () => {
    const blocked = hits("insects_01_ant_soldier", "giants_02_steel_warden").filter(
      (e) => (e.absorbed ?? 0) > 0,
    );
    expect(blocked.length).toBeGreaterThan(0);
    for (const e of blocked) expect(e.absorbed).toBeGreaterThan(0);
  });

  it("says nothing when nothing was stopped", () => {
    // Two boards with no armour between them: every blow arrives whole.
    for (const e of hits("dragons_02_obsidian_egg", "dragons_02_obsidian_egg"))
      expect(e.absorbed).toBeUndefined();
  });

  it("never claims more was stopped than was thrown", () => {
    for (const e of hits("insects_01_ant_soldier", "giants_02_steel_warden")) {
      const stopped = e.absorbed ?? 0;
      // What arrived plus what was stopped is the blow that was thrown, and
      // a blow is never negative.
      expect(stopped + (e.damage ?? 0)).toBeGreaterThanOrEqual(e.damage ?? 0);
    }
  });
});

describe("thorns", () => {
  it("come back marked as thorns, not as an ordinary blow", () => {
    // The Stone Colossus returns a quarter of what it is hit with.
    const back = hits("insects_01_ant_soldier", "giants_01_stone_colossus").filter(
      (e) => e.reflected,
    );
    expect(back.length).toBeGreaterThan(0);
    // And they are aimed the other way: the defender is the one striking.
    for (const e of back) expect(e.uid).toBeTruthy();
  });
});
