/**
 * **כיעורי — the card that is so ugly that looking at it costs you.**
 *
 * Or, with a photograph of a keyring from his own house: *"its power:
 * monsters that SEE it — in its line, with nothing in between them — lose
 * power, even when it is not shooting."*
 *
 * ═══ MEASURED AS DAMAGE DONE, NEVER AS A MULTIPLIER SET ═══
 *
 * Every test here runs the same battle twice — once with the gaze and once
 * with an identical card without it — and compares how much health the
 * victim's target lost. A test that read `powerMult` would pass on a number
 * nothing multiplies, which is a failure this engine has had before:
 * `armorGain` is a legal ability on a card and no handler has ever matched
 * it, and nothing noticed for months.
 *
 * So the question is always "did its blows land softer", never "was the
 * multiplier applied".
 *
 * ═══ AND THE THIRD CONDITION IS THE WHOLE CARD ═══
 *
 * Same lane and the other side are the easy two. The one that makes this
 * different from every other aura in the game is the CLEAR LINE: one body
 * between the two and the look is broken, whoever that body belongs to. It
 * is the only ability on the board a player answers by MOVING a card rather
 * than by killing one — so most of this file is about what stands in the
 * way.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import type { Ability, Card } from "@amanda/shared";

const BASE = {
  seriesId: "furries",
  number: 1,
  rarity: "common",
  elements: ["electric"],
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

const card = (
  id: string,
  over: Partial<{
    hp: number;
    power: number;
    moveSpeed: number;
    range: "melee" | "ranged" | "sniper";
    abilities: Ability[];
  }> = {},
): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    flying: false,
    targeting: "lane",
    stats: {
      hp: over.hp ?? 20000,
      power: over.power ?? 0,
      attackSpeed: 0.5,
      // Nothing walks in these fixtures. A board that rearranges itself
      // mid-battle cannot answer a question about what was standing where.
      moveSpeed: over.moveSpeed ?? 0,
      range: over.range ?? "ranged",
    },
    abilities: over.abilities ?? [],
  }) as unknown as Card;

const ab = (type: string, trigger: string, params: Record<string, number> = {}): Ability =>
  ({ type, trigger, params }) as unknown as Ability;

const GAZE = ab("gazeWeaken", "aura", { pct: 25 });

const CATALOG = new Map<string, Card>([
  /*
   * The two that are identical but for the one ability. Both are harmless —
   * 0 power — so every difference measured below is the GAZE and not the
   * card's own blows.
   */
  /*
   * ⚠ ENORMOUS HEALTH ON PURPOSE. The watcher is what the hitter shoots, so
   * the watcher's remaining health IS the measurement — and at 60,000 it
   * died inside the battle in BOTH runs, which made every comparison here
   * "expected 0 to be greater than 0". A victim that dies measures nothing.
   */
  ["ugly", card("ugly", { hp: 4_000_000, abilities: [GAZE] })],
  ["plain", card("plain", { hp: 4_000_000 })],
  /** The victim: all it does is hit the thing in front of it. */
  ["hitter", card("hitter", { hp: 60000, power: 1000 })],
  /** What the victim hits. Soft enough that the difference is visible. */
  ["sandbag", card("sandbag", { hp: 60000 })],
  /**
   * A body to stand in the way. Harmless, and UNKILLABLE.
   *
   * ⚠ At 60,000 it died partway through and the gaze came back on behind
   * it — so "blocked" measured as 120,986 against an unblocked 141,320,
   * which looks like a half-working aura and was a wall with normal health.
   */
  ["wall", card("wall", { hp: 4_000_000 })],
  /**
   * The same hitter, but able to shoot the length of the board.
   *
   * ⚠ THE ONLY WAY AN ENEMY CAN EVER BE THE THING IN THE WAY. Side A holds
   * columns 0–3 and side B is mirrored into 7–4 (`toArenaCol`), so with the
   * watcher at the back of A and the hitter at the front of B there is no
   * column between them that an ENEMY could occupy — everything between is
   * mine. Move the shooter to B's second row (column 6) and its own front
   * row at column 4 stands between the two, which is exactly the shape this
   * happens in during a real match: a card at the back of their board loses
   * sight of Kioory behind their own front row.
   */
  ["sniper", card("sniper", { hp: 4_000_000, power: 1000, range: "sniper" })],
]);

/**
 * Run the fight and report HOW MUCH DAMAGE THE HITTER DEALT, all battle.
 *
 * ⚠ READ OFF THE BLOWS, NOT OFF ANYBODY'S HEALTH. The first version of this
 * measured the watcher's remaining health, and the blocker tests all failed
 * for a reason that had nothing to do with the gaze: a wall placed in the
 * lane becomes the NEAREST thing in the lane, so the hitter shot the wall
 * instead and the comparison was between two different battles. Summing the
 * damage this one unit dealt is immune to who it was aimed at.
 */
function blows(
  watcher: "ugly" | "plain",
  extra: {
    mine?: BoardInput["placements"];
    theirs?: BoardInput["placements"];
    /** Which shooter, and where. `hitter` at the front of B by default. */
    shooter?: { cardId: "hitter" | "sniper"; x: number; y: number };
  } = {},
  watcherAt = { x: 0, y: 0 },
): number {
  const shooter = extra.shooter ?? { cardId: "hitter" as const, x: 3, y: 0 };
  const r = runBattle({
    a: {
      owner: "A",
      placements: [{ cardId: watcher, ...watcherAt }, ...(extra.mine ?? [])],
    },
    b: { owner: "B", placements: [shooter, ...(extra.theirs ?? [])] },
    seed: 1,
    catalog: CATALOG,
    synergies: [],
  });
  const who = r.finalUnits.find((u) => u.owner === "B" && u.cardId === shooter.cardId);
  let total = 0;
  for (const e of r.events)
    if (e.type === "hit" && e.uid === who?.uid) total += e.damage ?? 0;
  return total;
}

describe("looking at it is what costs you", () => {
  /*
   * ⚠ THE SHAPE OF EVERY TEST HERE. The hitter shoots the only thing of A's
   * in its lane, which is the watcher itself — so the watcher's REMAINING
   * HEALTH is the measurement. More left means the blows landed softer,
   * which means the gaze reached the hitter.
   */
  it("takes a quarter off anything that can see it", () => {
    const weakened = blows("ugly");
    const full = blows("plain");
    expect(weakened).toBeLessThan(full);
    /*
     * A quarter off every blow, so a quarter off the total. Checked as a
     * RANGE rather than an exact figure because armour is subtracted after
     * the multiplier and the sudden-death escalation climbs through the
     * second half of the battle — both land in the same arithmetic.
     *
     * Measured on this fixture: 141,320 blows down to 105,986. Exactly 25.0%,
     * which is what `pct: 25` promises and is worth knowing the next time
     * somebody changes how armour is applied.
     */
    const off = (full - weakened) / full;
    expect(off, `${(off * 100).toFixed(1)}% off`).toBeGreaterThan(0.2);
    expect(off, `${(off * 100).toFixed(1)}% off`).toBeLessThan(0.32);
  });

  it("and it does not have to be shooting for that to happen", () => {
    // `ugly` has 0 power in this catalog — it cannot shoot at all. The whole
    // card is the aura, which is what Or asked for in those words.
    expect(CATALOG.get("ugly")!.stats.power).toBe(0);
    expect(blows("ugly")).toBeLessThan(blows("plain"));
  });
});

describe("and one body in the way breaks it", () => {
  it("an enemy standing between them switches it off", () => {
    /*
     * The wall goes on THEIR side, between the hitter at 3 and the watcher
     * at 0. With it there the hitter should be hitting at full strength
     * again — the difference against `plain` collapses to nothing.
     */
    const far = { cardId: "sniper" as const, x: 1, y: 0 }; // column 6
    // First: with the lane clear, the sniper at the back IS weakened. Without
    // this line the test below would pass on a gaze that never reached it.
    expect(blows("ugly", { shooter: far })).toBeLessThan(blows("plain", { shooter: far }));
    // And now their own front row, at column 4, stands between the two.
    const wall = [{ cardId: "wall", x: 3, y: 0 }];
    expect(blows("ugly", { shooter: far, theirs: wall })).toBe(
      blows("plain", { shooter: far, theirs: wall }),
    );
  });

  it("and so does one of its OWN, which reads as a flaw and is the point", () => {
    /*
     * ⚠ THE DECISION WORTH ARGUING ABOUT. A stare does not care whose
     * shoulder is in front of it. Making only enemies block would be kinder
     * and would delete the card: with your own front row free to stand
     * anywhere, the gaze would be on permanently and there would be nothing
     * to place.
     *
     * This way the card has to be given an EMPTY LANE, which is the same
     * lane the enemy can march down — and that tension is the card.
     */
    const blocked = blows("ugly", { mine: [{ cardId: "wall", x: 1, y: 0 }] });
    const plain = blows("plain", { mine: [{ cardId: "wall", x: 1, y: 0 }] });
    expect(blocked).toBe(plain);
  });

  it("but a body in another lane blocks nothing", () => {
    const clear = blows("ugly", { mine: [{ cardId: "wall", x: 1, y: 2 }] });
    const plain = blows("plain", { mine: [{ cardId: "wall", x: 1, y: 2 }] });
    expect(clear).toBeLessThan(plain);
  });
});

describe("and it is one lane, not the board", () => {
  it("leaves a monster in another lane alone", () => {
    /*
     * The watcher moves to lane 2 and the hitter stays in lane 0, so they
     * are nowhere near each other. Every other aura in this game that
     * reaches "allies" reaches all of them; this one is a LINE, and a card
     * that quietly weakened the whole enemy board would be a different and
     * much worse card.
     */
    const far = blows("ugly", {}, { x: 0, y: 2 });
    const plain = blows("plain", {}, { x: 0, y: 2 });
    expect(far).toBe(plain);
  });
});
