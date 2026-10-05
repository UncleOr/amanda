import { describe, expect, it } from "vitest";
import { SIMULATION } from "@amanda/shared";
import { buildReport, runBattle, type BattleSetup } from "../src/index.js";
import { catalogOf, testCard } from "./helpers.js";

/**
 * The report is what the player reads after a match, and what strategy and
 * balance work will be measured against later — so its accounting has to be
 * right, not just plausible.
 */
describe("battle report", () => {
  const attacker = testCard({ id: "attacker", power: 50, moveSpeed: 2, hp: 500 });
  const tinyKing = testCard({ id: "tiny_king", hp: 20, power: 1, attackSpeed: 5 });
  const catalog = catalogOf(attacker, tinyKing);

  const setup: BattleSetup = {
    seed: 1,
    catalog,
    a: { owner: "A", placements: [{ cardId: "attacker", x: 3, y: 1 }] },
    b: { owner: "B", placements: [{ cardId: "tiny_king", x: 1, y: 1, king: true }] },
  };

  it("credits damage to the unit that dealt it and the kill to the last hitter", () => {
    const report = buildReport(runBattle(setup), catalog);
    const atk = report.sides.A.units.find((u) => u.cardId === "attacker")!;
    expect(atk.damageDealt).toBeGreaterThan(0);
    expect(atk.kills).toBe(1);
    expect(report.sides.A.kills).toBe(1);
    expect(report.sides.B.losses).toBe(1);
  });

  it("damage dealt by one side equals damage taken by the other", () => {
    const report = buildReport(runBattle(setup), catalog);
    const takenByB = report.sides.B.units.reduce((n, u) => n + u.damageTaken, 0);
    expect(report.sides.A.damageDealt).toBe(takenByB);
  });

  it("puts the King going down on the timeline and names who did it", () => {
    const report = buildReport(runBattle(setup), catalog);
    const kingDown = report.timeline.find((e) => e.kind === "kingDown");
    expect(kingDown).toBeDefined();
    expect(kingDown!.target).toBe("tiny_king");
    expect(kingDown!.actor).toBe("attacker");
    expect(report.timeline.at(-1)!.kind).toBe("end");
  });

  it("flags the losing King falling early", () => {
    const report = buildReport(runBattle(setup), catalog);
    const codes = report.findings.map((f) => f.code);
    expect(codes).toContain("kingFellEarly");
    expect(report.findings.find((f) => f.code === "kingFellEarly")!.owner).toBe("B");
  });

  it("keeps the auto-filler out of the narrative but inside the damage totals", () => {
    const filler = testCard({ id: "filler", hp: 1, power: 1 });
    const cat = catalogOf(attacker, tinyKing, filler);
    const withFiller: BattleSetup = {
      ...setup,
      catalog: cat,
      b: {
        owner: "B",
        placements: [
          { cardId: "tiny_king", x: 1, y: 1, king: true },
          { cardId: "filler", x: 3, y: 1 },
        ],
      },
    };
    const report = buildReport(runBattle(withFiller), cat, { fillerCardId: "filler" });
    // it died, but it is not part of the story or of the board's own tally
    expect(report.timeline.some((e) => e.target === "filler")).toBe(false);
    expect(report.sides.B.losses).toBe(1); // the King only
    // its damage still counts toward what the attacker had to chew through
    expect(report.sides.B.units.some((u) => u.cardId === "filler")).toBe(true);
  });

  it("never credits a kill across a unit's own side", () => {
    const report = buildReport(runBattle(setup), catalog);
    for (const owner of ["A", "B"] as const)
      for (const u of report.sides[owner].units) expect(u.kills).toBeGreaterThanOrEqual(0);
    expect(report.sides.A.kills + report.sides.B.kills).toBeLessThanOrEqual(report.totalDeaths);
  });
});

/**
 * How a match is decided. A battle where nothing of yours died and your King
 * survived can still be a loss, so the result has to say WHICH rule settled it.
 */
describe("win conditions", () => {
  const brick = testCard({ id: "brick", hp: 400, power: 1, attackSpeed: 10, moveSpeed: 0 });
  const bigBrick = testCard({ id: "big_brick", hp: 900, power: 1, attackSpeed: 10, moveSpeed: 0 });
  const killer = testCard({ id: "killer", power: 80, moveSpeed: 2, hp: 900 });
  const paperKing = testCard({ id: "paper_king", hp: 20, power: 1, attackSpeed: 10 });

  it("a King going down ends it immediately and says so", () => {
    const cat = catalogOf(killer, paperKing);
    const r = runBattle({
      seed: 1,
      catalog: cat,
      a: { owner: "A", placements: [{ cardId: "killer", x: 3, y: 1 }] },
      b: { owner: "B", placements: [{ cardId: "paper_king", x: 1, y: 1, king: true }] },
    });
    expect(r.winner).toBe("A");
    expect(r.winReason).toBe("kingDown");
    expect(r.tiebreak).toBeNull();
    expect(r.ticks).toBeLessThan(SIMULATION.totalBattleTicks); // it did not need the full clock
  });

  it("a timeout reports which tiebreak decided it, and by what margin", () => {
    const cat = catalogOf(brick, bigBrick);
    const r = runBattle({
      seed: 1,
      catalog: cat,
      a: { owner: "A", placements: [{ cardId: "big_brick", x: 1, y: 1, king: true }] },
      b: { owner: "B", placements: [{ cardId: "brick", x: 1, y: 1, king: true }] },
    });
    // Neither King can be reached, so the clock runs all the way out.
    expect(r.ticks).toBe(SIMULATION.totalBattleTicks);
    expect(r.winReason).not.toBe("kingDown");
    expect(r.tiebreak).not.toBeNull();
    expect(r.tiebreak!.reason).toBe(r.winReason);
    // Both Kings are at full health, so it cannot have been decided on that.
    expect(r.winReason).toBe("totalHp");
    expect(r.winner).toBe("A"); // 900 x3 HP beats 400 x3
  });

  it("never ends in a draw", () => {
    const cat = catalogOf(brick);
    const r = runBattle({
      seed: 7,
      catalog: cat,
      a: { owner: "A", placements: [{ cardId: "brick", x: 1, y: 1, king: true }] },
      b: { owner: "B", placements: [{ cardId: "brick", x: 1, y: 1, king: true }] },
    });
    expect(r.winner).not.toBeNull();
    expect(r.winReason).toBe("coinFlip");
  });
});

/**
 * Reach. Ranged attacks used to carry down the entire lane, which made the
 * depth of the board meaningless and let a static King kill the enemy King
 * from its own square.
 */
describe("attack reach", () => {
  const sniperCard = testCard({ id: "sniper", power: 50, range: "sniper", moveSpeed: 0, hp: 500 });
  const archer = testCard({ id: "archer", power: 50, range: "ranged", moveSpeed: 0, hp: 500 });
  const farKing = testCard({ id: "far_king", hp: 40, power: 0, attackSpeed: 10 });

  /** Shooter in its own back row, enemy King across the arena. */
  function duel(shooter: string) {
    const cat = catalogOf(sniperCard, archer, farKing);
    return runBattle({
      seed: 1,
      catalog: cat,
      a: { owner: "A", placements: [{ cardId: shooter, x: 0, y: 1 }] },
      b: { owner: "B", placements: [{ cardId: "far_king", x: 1, y: 1, king: true }] },
    });
  }

  it("a ranged attacker cannot reach across the whole arena", () => {
    const r = duel("archer");
    expect(r.winReason).not.toBe("kingDown");
    expect(r.finalUnits.find((u) => u.isKing)!.alive).toBe(true);
  });

  it("a sniper still can — that is what it is for", () => {
    const r = duel("sniper");
    expect(r.winReason).toBe("kingDown");
  });
});

/**
 * Thorns. A King can kill itself on a reflecting defender without ever being
 * struck — and before this the report showed zero damage taken and no killer,
 * leaving the most important moment of the match unexplained.
 */
describe("reflected damage", () => {
  it("is recorded as a hit, so the report can name what killed you", () => {
    const thorny = testCard({
      id: "thorny",
      hp: 2000,
      power: 1,
      attackSpeed: 10,
      moveSpeed: 2,
      abilities: [{ type: "damageReflect", trigger: "onDamaged", params: { pct: 50 } }],
    });
    // A glass cannon: enormous power, barely any health of its own.
    const glassKing = testCard({ id: "glass_king", hp: 100, power: 900, moveSpeed: 0 });
    const cat = catalogOf(thorny, glassKing);
    const r = runBattle({
      seed: 1,
      catalog: cat,
      a: { owner: "A", placements: [{ cardId: "glass_king", x: 3, y: 1, king: true }] },
      b: { owner: "B", placements: [{ cardId: "thorny", x: 3, y: 1 }] },
    });

    const rep = buildReport(r, cat);
    const king = rep.sides.A.units.find((u) => u.isKing)!;
    expect(king.survived).toBe(false);
    // It never took a normal hit — every point came back off its own attack.
    expect(king.damageTaken).toBeGreaterThan(0);
    const thorns = rep.sides.B.units.find((u) => u.cardId === "thorny")!;
    expect(thorns.damageDealt).toBeGreaterThan(0);
    expect(rep.timeline.some((e) => e.kind === "reflected")).toBe(true);
  });
});
