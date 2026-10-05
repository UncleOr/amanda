import { describe, expect, it } from "vitest";
import { CATALOG } from "../data/catalog";
import { __testing } from "./useMatch";

/**
 * The computer opponent has to field a real board. A match where it shows up
 * with two cards is not a game — and the battle report from a live playtest
 * showed exactly that.
 */
describe("the computer's board", () => {
  it("places a full set of monsters, not a handful", () => {
    for (let i = 0; i < 20; i++) {
      const plan = __testing.generateAiPlan();
      const king = plan.filter((p) => p.king);
      const reals = plan.filter((p) => !p.king);
      expect(king).toHaveLength(1);
      expect(reals.length).toBeGreaterThanOrEqual(7);
    }
  });

  it("never puts two cards on the same cell", () => {
    for (let i = 0; i < 20; i++) {
      const plan = __testing.generateAiPlan().filter((p) => !p.king);
      const keys = plan.map((p) => `${p.x}-${p.y}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("mans its front row", () => {
    for (let i = 0; i < 20; i++) {
      const front = __testing.generateAiPlan().filter((p) => !p.king && p.x === 3);
      expect(front.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("holds the two guard posts with cards that will not wander off them", () => {
    let staticPosts = 0;
    let posts = 0;
    for (let i = 0; i < 20; i++)
      for (const p of __testing.generateAiPlan()) {
        if (p.king || p.x !== 3 || (p.y !== 1 && p.y !== 2)) continue;
        posts++;
        if ((CATALOG.get(p.cardId)?.stats.moveSpeed ?? 1) === 0) staticPosts++;
      }
    expect(posts).toBeGreaterThan(0);
    // a mover on a post walks off it and takes the King's shield with it
    expect(staticPosts / posts).toBeGreaterThan(0.9);
  });

  it("never wastes a static melee card in the back row", () => {
    let backRow = 0;
    let wasted = 0;
    for (let i = 0; i < 20; i++)
      for (const p of __testing.generateAiPlan()) {
        if (p.king || p.x !== 0) continue;
        backRow++;
        const c = CATALOG.get(p.cardId);
        if (c && c.stats.moveSpeed === 0 && c.stats.range === "melee") wasted++;
      }
    expect(backRow).toBeGreaterThan(0);
    expect(wasted / backRow).toBeLessThan(0.1);
  });
});
