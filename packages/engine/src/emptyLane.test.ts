import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { BattleEvent } from "./types.js";
import type { BoardInput } from "./setup.js";
import type { Card, Series } from "@amanda/shared";

/**
 * A cleared lane is not the end of the fight.
 *
 * Or, after a game: *"we just had another match that ended with all the
 * attackers in a straight line reaching the end and attacking nothing, and
 * the Kings neither moving nor attacking. If there is nothing to attack in
 * your lane you should start attacking the King or the guards."*
 *
 * It was a real stall and it was in `pickTarget`: a unit whose own lane held
 * no enemy returned NO target, walked to the far wall and stood there for the
 * rest of the battle. Two boards could clear opposite lanes and the match
 * would run out the clock with a dozen units staring at nothing.
 *
 * ═══ LANES ARE READ FROM THE SPAWN EVENTS, NOT FROM THE FINAL UNITS ═══
 *
 * `finalUnits` carries where everybody ENDED UP, and the whole subject here
 * is units changing lane. Asking a final snapshot which lane somebody was in
 * when they swung gives the wrong answer in both directions — it was the
 * first thing these tests got wrong.
 */

function card(id: string, hp: number, power: number, moveSpeed = 1): Card {
  return {
    id,
    seriesId: "t",
    numberInSeries: 1,
    name: { he: id, en: id },
    elements: ["earth"],
    rarity: "common",
    stats: { hp, power, attackSpeed: 1, moveSpeed, range: "melee" },
    flying: false,
    targeting: "lane",
    midBoss: false,
    launch: true,
    abilities: [] as never,
    art: { placeholderColor: "#fff", sprite: null },
  } as Card;
}

const KING = card("king", 4000, 100, 0);
const HITTER = card("hitter", 1200, 300);
const CATALOG = new Map([KING, HITTER].map((c) => [c.id, c]));

/** A King, and a hitter on the front row of each named lane. */
function board(owner: "A" | "B", lanes: number[]): BoardInput {
  return {
    owner,
    placements: [
      { cardId: "king", x: 1, y: 1, king: true },
      ...lanes.map((y) => ({ cardId: "hitter", x: 3, y })),
    ],
  } as BoardInput;
}

function fight(a: BoardInput, b: BoardInput) {
  const r = runBattle({
    seed: 7,
    catalog: CATALOG,
    synergies: [] as Series["synergy"][] as never,
    a,
    b,
    recordFrames: false,
  });
  /** Where each unit started, which is what a spawn event records. */
  const spawnLane = new Map<string, number[]>();
  for (const e of r.events as BattleEvent[])
    if (e.type === "spawn" && e.uid && e.lanes) spawnLane.set(e.uid, e.lanes);
  return { ...r, spawnLane };
}

describe("a unit whose lane is empty", () => {
  /*
   * A's hitter is in lane 0 and B has nothing there — B's only units are its
   * King (the middle two lanes) and a hitter in lane 3. Before the fix, A's
   * unit walked to the wall and the battle ran the full clock with nobody
   * touching it.
   */
  it("goes and finds something instead of walking into the wall", () => {
    const r = fight(board("A", [0]), board("B", [3]));
    const mine = r.finalUnits.find((u) => u.owner === "A" && !u.isKing)!;
    const swung = r.events.some((e) => e.type === "attack" && e.uid === mine.uid);
    expect(swung, "the unit in the empty lane never attacked anything").toBe(true);
  });

  it("and the enemy King feels it", () => {
    const r = fight(board("A", [0]), board("B", [3]));
    const theirKing = r.finalUnits.find((u) => u.owner === "B" && u.isKing)!;
    expect(
      theirKing.hp,
      "nothing ever reached the enemy King, which is the stall this fixes",
    ).toBeLessThan(theirKing.maxHp);
  });

  /*
   * The other half of the fix, and the reason it is not simply "pick
   * anything". `gapAhead` measures along the column axis and knows nothing
   * about lanes, so a unit that targets something three lanes away would
   * otherwise reach across the board and hit it without moving at all.
   */
  it("walks over before it swings, rather than reaching across the board", () => {
    const r = fight(board("A", [0]), board("B", [3]));
    const mine = r.finalUnits.find((u) => u.owner === "A" && !u.isKing)!;
    const started = r.spawnLane.get(mine.uid)!;
    expect(started).toEqual([0]);
    expect(
      mine.lanes.some((l) => !started.includes(l)),
      `it attacked from lane ${mine.lanes}, the lane it started in — it never moved across`,
    ).toBe(true);
  });

  /*
   * The lane discipline that makes a battle readable is untouched: the
   * fallback only ever runs when there is nothing left in the lane to be
   * disciplined about. With a full front row on both sides nobody wanders,
   * and the opening exchanges are all lane-against-lane.
   */
  it("does not wander while its own lane still has somebody in it", () => {
    const r = fight(board("A", [0, 1, 2, 3]), board("B", [0, 1, 2, 3]));
    const opening = r.events.filter((e) => e.type === "hit" && e.tick < 60);
    expect(opening.length, "nobody hit anybody in the first two seconds").toBeGreaterThan(0);
    for (const hit of opening) {
      const by = r.spawnLane.get(hit.uid ?? "");
      const on = r.spawnLane.get(hit.targetUid ?? "");
      // Kings sit across the middle two lanes and are nobody's lane-mate in
      // the ordinary sense; the front rows are what this is about.
      if (!by || !on) continue;
      const byKing = r.finalUnits.find((u) => u.uid === hit.uid)?.isKing;
      const onKing = r.finalUnits.find((u) => u.uid === hit.targetUid)?.isKing;
      if (byKing || onKing) continue;
      expect(
        by.some((l) => on.includes(l)),
        `a unit from lane ${by} hit a unit from lane ${on} in the opening exchange, ` +
          `while its own lane was still occupied`,
      ).toBe(true);
    }
  });
});
