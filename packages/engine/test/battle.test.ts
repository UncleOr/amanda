import { describe, expect, it } from "vitest";
import { elementMultiplier, runBattle, type BattleSetup } from "../src/index.js";
import { catalogOf, testCard } from "./helpers.js";

describe("element multipliers", () => {
  it("water beats fire, fire is weak to water, unrelated is neutral", () => {
    expect(elementMultiplier("water", "fire")).toBe(1.5);
    expect(elementMultiplier("fire", "water")).toBe(0.75);
    expect(elementMultiplier("fire", "air")).toBe(1);
  });
});

describe("core combat", () => {
  it("a strong melee attacker destroys the enemy King and wins", () => {
    const attacker = testCard({ id: "attacker", power: 50, moveSpeed: 2, hp: 500 });
    const tinyKing = testCard({ id: "tiny_king", hp: 20, power: 1, attackSpeed: 5 });
    const setup: BattleSetup = {
      seed: 1,
      catalog: catalogOf(attacker, tinyKing),
      a: { owner: "A", placements: [{ cardId: "attacker", x: 3, y: 1 }] },
      b: { owner: "B", placements: [{ cardId: "tiny_king", x: 1, y: 1, king: true }] },
    };
    const result = runBattle(setup);
    expect(result.winner).toBe("A");
    // King HP was 20 × 5 = 100; it must be dead.
    const king = result.finalUnits.find((u) => u.isKing);
    expect(king?.alive).toBe(false);
  });

  it("knockback pushes the target away from the attacker", () => {
    const knocker = testCard({
      id: "knocker",
      power: 5,
      moveSpeed: 0,
      hp: 1000,
      abilities: [{ type: "knockback", trigger: "onHit", params: { slots: 2 } }],
    });
    const dummy = testCard({ id: "dummy", power: 1, moveSpeed: 0, hp: 1000 });
    const setup: BattleSetup = {
      seed: 1,
      catalog: catalogOf(knocker, dummy),
      a: { owner: "A", placements: [{ cardId: "knocker", x: 3, y: 0 }] },
      b: { owner: "B", placements: [{ cardId: "dummy", x: 3, y: 0 }] },
    };
    const result = runBattle(setup);
    const pushed = result.finalUnits.find((u) => u.cardId === "dummy")!;
    // Dummy started at arena col 4; a +2 knockback should shove it further away.
    expect(pushed.col).toBeGreaterThan(5);
  });

  it("splitOnDeath spawns child units when the parent dies", () => {
    const attacker = testCard({ id: "attacker", power: 50, moveSpeed: 2, hp: 500 });
    const splitter = testCard({
      id: "splitter",
      hp: 20,
      power: 5,
      abilities: [
        {
          type: "splitOnDeath",
          trigger: "onDeath",
          params: { count: 2, childHp: 10, childPower: 5 },
        },
      ],
    });
    const setup: BattleSetup = {
      seed: 1,
      catalog: catalogOf(attacker, splitter),
      a: { owner: "A", placements: [{ cardId: "attacker", x: 3, y: 1 }] },
      b: { owner: "B", placements: [{ cardId: "splitter", x: 3, y: 1 }] },
    };
    const result = runBattle(setup);
    expect(result.events.some((e) => e.type === "split")).toBe(true);
    /*
     * Marked by a FLAG, not by a fake card id. A child used to be given
     * cardId "__spawn__", which meant the renderer found no card behind it
     * and drew a grey box with no artwork, no name and no walk — Or: *"they
     * look like little squares and they just move, with no motion of their
     * own."*
     *
     * A child of a splitter is a smaller splitter, so it carries the
     * parent's card and `flags.spawned` is what says it is a piece.
     */
    const spawned = result.finalUnits.filter((u) => u.flags.spawned);
    expect(spawned.length).toBe(2);
    for (const child of spawned) expect(child.cardId, "drawn as its parent").toBe("splitter");
  });

  it("a revealed Ground-Floor card fights on after the top card dies", () => {
    const attacker = testCard({ id: "attacker", power: 50, moveSpeed: 2, hp: 500 });
    const top = testCard({ id: "top", hp: 20, power: 5 });
    const bottom = testCard({ id: "bottom", hp: 300, power: 40 });
    const setup: BattleSetup = {
      seed: 1,
      catalog: catalogOf(attacker, top, bottom),
      a: { owner: "A", placements: [{ cardId: "attacker", x: 3, y: 1 }] },
      b: { owner: "B", placements: [{ cardId: "top", x: 3, y: 1, below: "bottom" }] },
    };
    const result = runBattle(setup);
    const reveal = result.events.find((e) => e.type === "reveal");
    expect(reveal?.revealedCardId).toBe("bottom");
  });
});

describe("King bonus", () => {
  it("a card in the King slot gets ×3 HP and ×3 Power", () => {
    const grunt = testCard({ id: "grunt", hp: 100, power: 10, moveSpeed: 0 });
    const setup: BattleSetup = {
      seed: 1,
      catalog: catalogOf(grunt),
      a: { owner: "A", placements: [{ cardId: "grunt", x: 1, y: 1, king: true }] },
      b: { owner: "B", placements: [{ cardId: "grunt", x: 3, y: 0 }] },
    };
    const king = runBattle(setup).finalUnits.find((u) => u.isKing)!;
    expect(king.maxHp).toBe(300);
    expect(king.power).toBe(30);
  });
});

describe("no draws", () => {
  it("a timeout is always broken by a tiebreak (never null)", () => {
    // Two identical, harmless Kings → nobody dies → timeout → must still pick a winner.
    const king = testCard({ id: "peace_king", hp: 100, power: 0, moveSpeed: 0 });
    const setup: BattleSetup = {
      seed: 5,
      catalog: catalogOf(king),
      a: { owner: "A", placements: [{ cardId: "peace_king", x: 1, y: 1, king: true }] },
      b: { owner: "B", placements: [{ cardId: "peace_king", x: 1, y: 1, king: true }] },
    };
    const result = runBattle(setup);
    expect(result.winner === "A" || result.winner === "B").toBe(true);
  });
});

describe("determinism", () => {
  it("same setup + seed produces a byte-identical event log", () => {
    const makeSetup = (): BattleSetup => {
      const attacker = testCard({ id: "attacker", power: 50, moveSpeed: 2, hp: 500 });
      const splitter = testCard({
        id: "splitter",
        hp: 20,
        power: 5,
        abilities: [
          {
            type: "splitOnDeath",
            trigger: "onDeath",
            params: { count: 3, childHp: 10, childPower: 5 },
          },
        ],
      });
      const king = testCard({ id: "king", hp: 100, power: 10, attackSpeed: 3 });
      return {
        seed: 42,
        catalog: catalogOf(attacker, splitter, king),
        a: {
          owner: "A",
          placements: [
            { cardId: "attacker", x: 3, y: 0 },
            { cardId: "attacker", x: 3, y: 2 },
            { cardId: "king", x: 1, y: 1, king: true },
          ],
        },
        b: {
          owner: "B",
          placements: [
            { cardId: "splitter", x: 3, y: 0 },
            { cardId: "splitter", x: 3, y: 2 },
            { cardId: "king", x: 1, y: 1, king: true },
          ],
        },
      };
    };

    const a = runBattle(makeSetup());
    const b = runBattle(makeSetup());
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.winner).toBe(b.winner);
    expect(a.ticks).toBe(b.ticks);
  });
});
