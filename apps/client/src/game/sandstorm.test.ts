import { describe, expect, it } from "vitest";
import { __testing } from "./useMatch";

const { rotateFrontLanes, generateAiPlan } = __testing;

/*
 * The rule changed, and the tests changed with it.
 *
 * Sandstorm used to rotate all four front lanes by a random offset. Or spotted
 * what that meant: whatever you put in front of your King to protect it got
 * thrown out to the edge of the board, so one epic card cancelled the single
 * decision the whole board is built around. Now it swaps WITHIN pairs — the
 * two guard posts with each other, the two outer lanes with each other — so it
 * still wrecks your matchups and still cannot un-guard a King.
 *
 * These tests exist to keep that promise, so the important one is the second.
 */
describe("Sandstorm — swaps the opponent's front row within its pairs", () => {
  it("swaps the two guard lanes with each other", () => {
    const plan = [
      { cardId: "guardA", x: 3, y: 1 },
      { cardId: "guardB", x: 3, y: 2 },
    ];
    expect(rotateFrontLanes(plan)).toBe(2);
    expect(plan.find((p) => p.cardId === "guardA")!.y).toBe(2);
    expect(plan.find((p) => p.cardId === "guardB")!.y).toBe(1);
  });

  it("never moves a guard out of a guard post, or an outsider into one", () => {
    const plan = [0, 1, 2, 3].map((y) => ({ cardId: `c${y}`, x: 3, y }));
    rotateFrontLanes(plan);
    const laneOf = (id: string) => plan.find((p) => p.cardId === id)!.y;
    // The two that were guarding are still guarding…
    expect([laneOf("c1"), laneOf("c2")].sort()).toEqual([1, 2]);
    // …and the two that were outside are still outside.
    expect([laneOf("c0"), laneOf("c3")].sort()).toEqual([0, 3]);
  });

  it("still moves every front-row card, so the card visibly does something", () => {
    const plan = [0, 1, 2, 3].map((y) => ({ cardId: `c${y}`, x: 3, y }));
    const before = plan.map((p) => p.y);
    expect(rotateFrontLanes(plan)).toBe(4);
    plan.forEach((p, i) => expect(p.y).not.toBe(before[i]));
  });

  it("is a permutation — no two cards collide in the same lane", () => {
    const plan = [0, 1, 2, 3].map((y) => ({ cardId: `c${y}`, x: 3, y }));
    rotateFrontLanes(plan);
    expect(new Set(plan.map((p) => p.y)).size).toBe(4);
  });

  it("leaves the rows behind the front alone", () => {
    const plan = [
      { cardId: "front", x: 3, y: 1 },
      { cardId: "back", x: 0, y: 3 },
      { cardId: "mid", x: 2, y: 2 },
    ];
    rotateFrontLanes(plan);
    expect(plan.find((p) => p.cardId === "back")!.y).toBe(3);
    expect(plan.find((p) => p.cardId === "mid")!.y).toBe(2);
  });

  it("does nothing when the opponent has fewer than two front cards", () => {
    const plan = [{ cardId: "a", x: 3, y: 1 }];
    expect(rotateFrontLanes(plan)).toBe(0);
    expect(plan[0]!.y).toBe(1);
  });

  it("a lone card in a pair still slides across, and stays in its half", () => {
    const plan = [
      { cardId: "guard", x: 3, y: 1 },
      { cardId: "outer", x: 3, y: 0 },
    ];
    expect(rotateFrontLanes(plan)).toBe(2);
    expect(plan.find((p) => p.cardId === "guard")!.y).toBe(2); // still a guard post
    expect(plan.find((p) => p.cardId === "outer")!.y).toBe(3); // still outside
  });

  it("the AI always fills its whole front row, so Sandstorm has targets", () => {
    for (let i = 0; i < 20; i++) {
      const front = generateAiPlan().filter((p) => !p.king && p.x === 3);
      expect(front.length).toBe(4);
    }
  });
});
