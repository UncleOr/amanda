import { describe, expect, it } from "vitest";
import { __testing } from "./useMatch";

const { rotateFrontLanes, generateAiPlan } = __testing;

describe("Sandstorm — shuffles the opponent's front row", () => {
  it("moves every front-row card to a different lane", () => {
    const plan = [
      { cardId: "a", x: 3, y: 0 },
      { cardId: "b", x: 3, y: 1 },
      { cardId: "c", x: 3, y: 2 },
      { cardId: "d", x: 0, y: 3 }, // back row — must not move
    ];
    const before = plan.map((p) => p.y);
    const moved = rotateFrontLanes(plan);
    expect(moved).toBe(3);
    plan.slice(0, 3).forEach((p, i) => expect(p.y).not.toBe(before[i]));
    expect(plan[3]!.y).toBe(3); // back row untouched
  });

  it("is a permutation — no two cards collide in the same lane", () => {
    const plan = [0, 1, 2, 3].map((y) => ({ cardId: `c${y}`, x: 3, y }));
    rotateFrontLanes(plan);
    expect(new Set(plan.map((p) => p.y)).size).toBe(4);
  });

  it("does nothing when the opponent has fewer than two front cards", () => {
    const plan = [{ cardId: "a", x: 3, y: 1 }];
    expect(rotateFrontLanes(plan)).toBe(0);
    expect(plan[0]!.y).toBe(1);
  });

  it("the AI always fills its whole front row, so Sandstorm has targets", () => {
    for (let i = 0; i < 20; i++) {
      const front = generateAiPlan().filter((p) => !p.king && p.x === 3);
      expect(front.length).toBe(4);
    }
  });
});
