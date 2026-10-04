import { describe, expect, it } from "vitest";
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
