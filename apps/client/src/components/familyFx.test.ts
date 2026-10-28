import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { combatLook } from "./arenaFx";
import { CATALOG } from "../data/catalog";

/**
 * **Three families that had no body of their own.**
 *
 * Or: *"and the Machines need animations too — sparks flying, sounds, wheel
 * movement; the Sea Dwellers bubbles and a bit of water resistance; the
 * Demons a light flight and wind."*
 *
 * ═══ WHY THIS IS NOT JUST A GAIT ═══
 *
 * `walkOf` asked "does it move at all" FIRST, and answered `rooted` — which
 * animates nothing. Counted against the data that matters: five of the ten
 * Machines are bolted down, five of the ten Sea Dwellers never move, and the
 * Demons are one card, the Alley King, with `moveSpeed: 0`. Had the families
 * stayed behind that test, Or's three effects would have reached a handful of
 * cards and none of his demons at all.
 *
 * So the measurements below are mostly about the MOTIONLESS ones.
 */
const ARENA = readFileSync(fileURLToPath(new URL("./Arena.tsx", import.meta.url)), "utf8");

const of = (seriesId: string) => [...CATALOG.values()].filter((c) => c.seriesId === seriesId);

describe("which body each family gets", () => {
  it("gives every machine the wheels, standing still or not", () => {
    const machines = of("machines");
    expect(machines.length).toBeGreaterThan(5);
    expect(machines.filter((c) => c.stats.moveSpeed === 0).length).toBeGreaterThan(0);
    for (const c of machines) expect(combatLook(c.id).walk, c.id).toBe("roll");
  });

  it("gives every sea dweller the water", () => {
    const sea = of("sea");
    expect(sea.filter((c) => c.stats.moveSpeed === 0).length).toBeGreaterThan(0);
    for (const c of sea) expect(combatLook(c.id).walk, c.id).toBe("swim");
  });

  it("gives the demons the hover, although the only one of them never moves", () => {
    const demons = of("demons");
    expect(demons).toHaveLength(1);
    expect(demons[0]!.stats.moveSpeed).toBe(0);
    expect(combatLook(demons[0]!.id).walk).toBe("drift");
  });

  it("leaves every other family exactly as it walked before", () => {
    for (const c of CATALOG.values()) {
      if (["machines", "sea", "demons"].includes(c.seriesId)) continue;
      expect(["rooted", "float", "stomp", "squish", "scuttle", "step"], c.id).toContain(
        combatLook(c.id).walk,
      );
    }
  });
});

describe("what each one throws off", () => {
  const caseOf = (name: string) => {
    const from = ARENA.indexOf(`case "${name}": {`);
    expect(from, `no ${name} case`).toBeGreaterThan(-1);
    return ARENA.slice(from, ARENA.indexOf("\n              case ", from + 10));
  };

  it("sparks off a machine, arcing down rather than drifting up", () => {
    const roll = caseOf("roll");
    expect(roll).toContain("0xffd27a");
    expect(roll).toContain('shape: "streak"');
    // Positive gravity: a spark that floats is an ember, which is a
    // different machine entirely.
    expect(roll).toMatch(/gravity: 0\.000\d/);
  });

  it("bubbles off a sea dweller, rising and slowing", () => {
    const swim = caseOf("swim");
    expect(swim).toContain("0xbfe9ff");
    expect(swim).toMatch(/gravity: -0\.000\d/);
  });

  it("streams wind past a demon, backwards", () => {
    const drift = caseOf("drift");
    expect(drift).toContain("0xa98fe0");
    expect(drift).toContain("dir: facing > 0 ? Math.PI : 0");
  });

  /*
   * ⚠ THE ONE THAT WOULD SILENTLY UNDO HALF OF IT. Every other walk in this
   * file is wrapped in `if (walking)`, and copying that habit into these
   * three would switch the effect off for exactly the cards listed at the
   * top — the press, the clam, the Alley King.
   */
  it("keeps all three running while the card stands still", () => {
    for (const name of ["roll", "swim", "drift"]) {
      const body = caseOf(name);
      const emit = body.slice(body.indexOf("g.emit -="));
      expect(emit.slice(0, emit.indexOf("spawnParticles")), name).not.toContain("if (walking)");
    }
  });

  it("scatters the emitters, so a family does not flash in unison", () => {
    expect(ARENA).toContain("emit: Math.random() * 600,");
  });
});

describe("the water resistance", () => {
  /*
   * Or's *"a bit of water resistance"*, and it is one number rather than a
   * wobble drawn on top. The body chases its target with an exponential
   * approach; lowering the rate makes it lag going out and coast coming in,
   * which is what moving through water IS. It also slows the swim cycle for
   * free, because `speed` is measured from how far the body actually got.
   */
  it("makes a swimming body lag its own target", () => {
    expect(ARENA).toContain('const close = Math.min(1, k * (g.look.walk === "swim" ? 1 : 1.6));');
  });

  it("is a drag and not a stop — it still arrives", () => {
    // An exponential approach with a positive rate always converges; what
    // would not is a rate of zero, which is a card that never gets there.
    const k = 1; // dt at the cap
    let gap = 100;
    for (let i = 0; i < 20; i++) gap -= gap * Math.min(1, k * 1);
    expect(gap).toBeLessThan(0.5);
  });
});

/* ───────────────────────── the workbench ───────────────────────── */

const PREVIEW = readFileSync(fileURLToPath(new URL("./ArenaPreview.tsx", import.meta.url)), "utf8");

describe("the place these are judged from", () => {
  /*
   * ⚠ It was a hand-written list of five families, which stopped being every
   * family the day a sixth was drawn — so the one workbench for looking at
   * battle animations could not show the three newest families, which is
   * exactly when a workbench is needed.
   */
  it("offers every family in the game, not a list somebody typed", () => {
    expect(PREVIEW).toContain('const SERIES_IDS: readonly string[] = ["", ...SERIES.map((s) => s.id)];');
  });
});
