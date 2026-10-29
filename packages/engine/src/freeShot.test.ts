/**
 * **A card that cannot go anywhere can still fire.**
 *
 * Or, after being offered the obvious fix for cards queuing up behind one
 * another — letting a blocked card step sideways into a free lane:
 *
 * > *"No. Part of the wisdom is building the board so that you do not put
 * > someone walking behind someone static. That is fine. But they can still
 * > shoot even if they do not move. Say it has a range of 2 — it should shoot
 * > at someone approaching it. Your shots always 'go round' a friend on the
 * > way to the enemy."*
 *
 * Two rules, and the first of them was already true: targeting has never
 * looked at allies, so a shooter behind a wall of its own fires over it. It is
 * pinned here anyway, because it is a promise now rather than an accident.
 *
 * The second was not. Lane discipline only lifted when the lane was EMPTY, so
 * a card whose own lane held something it could not reach — and could not walk
 * to, being static, rooted, or stuck behind its own — stood and watched an
 * enemy cross inside its reach. 21,961 of 281,570 living-unit ticks over 60
 * battles of the real catalogue were exactly that.
 *
 * Every test builds its own cards, so a balance change to a real card can
 * never turn one of these green while the rule itself is broken.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { Ability, Card } from "@amanda/shared";
import type { BoardInput } from "./setup.js";

const BASE = {
  seriesId: "dragons",
  number: 1,
  rarity: "common",
  elements: ["fire"],
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

const card = (
  id: string,
  over: Partial<{
    hp: number;
    power: number;
    move: number;
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
      hp: over.hp ?? 50000,
      power: over.power ?? 0,
      attackSpeed: 1,
      moveSpeed: over.move ?? 0,
      range: over.range ?? "melee",
    },
    abilities: over.abilities ?? [],
  }) as unknown as Card;

const dive = { type: "dive", trigger: "onSpawn", params: {} } as unknown as Ability;

const CATALOG = new Map<string, Card>([
  /** Fires three columns. Cannot take a step. */
  ["shooter", card("shooter", { power: 200, range: "ranged" })],
  ["walker", card("walker", { power: 200, move: 1.2 })],
  /** Fires three columns AND can walk — so being stuck is its own fault. */
  ["runner", card("runner", { power: 200, move: 1.2, range: "ranged" })],
  ["wall", card("wall", { hp: 200000 })],
  /** Something to be shot at: it cannot move and cannot answer. */
  ["dummy", card("dummy", { hp: 20000 })],
  ["king", card("king", { hp: 60000, power: 200 })],
  ["diver", card("diver", { hp: 10000, power: 200, move: 1, abilities: [dive] })],
  ["plain", card("plain", { hp: 10000, power: 200, move: 1 })],
  ["guard", card("guard", { hp: 4000, power: 200, move: 1 })],
  ["sentry", card("sentry", { hp: 4000, power: 200, range: "ranged" })],
]);

type Place = BoardInput["placements"];

function fight(a: Place, b: Place, recordFrames = false) {
  const r = runBattle({
    a: { owner: "A", placements: a },
    b: { owner: "B", placements: b },
    seed: 1,
    catalog: CATALOG,
    synergies: [],
    recordFrames,
  });
  /** How much damage a side's units have taken, by card id. */
  const hurt = (owner: "A" | "B") => {
    const m = new Map<string, number>();
    for (const u of r.finalUnits)
      if (u.owner === owner) m.set(u.cardId, Math.round(u.maxHp - Math.max(0, u.hp)));
    return m;
  };
  return { r, hurt, unit: (id: string) => r.finalUnits.find((u) => u.cardId === id)! };
}

describe("a card that cannot move still shoots", () => {
  it("fires at what it can reach when its own lane holds only what it cannot", () => {
    /*
     * The shooter sits at the back of lane 0 (column 0) with a reach of three
     * columns. Its own lane holds a dummy at the far wall — column 7, six
     * columns away, which it can neither hit nor walk to. One lane over,
     * another dummy stands exactly three columns off: inside its reach, and
     * the only thing in the battle it can actually do something about.
     */
    const { hurt } = fight(
      [{ cardId: "shooter", x: 0, y: 0 }],
      [
        { cardId: "dummy", x: 0, y: 0 },
        { cardId: "dummy", x: 3, y: 1 },
      ],
    );
    expect(hurt("B").get("dummy"), "it stood there doing nothing").toBeGreaterThan(0);
  });

  it("and so does one queued behind its own", () => {
    /*
     * ⚠ THE CASE OR NAMED, and the reason this rule exists rather than the
     * one he turned down. A shooter that can walk, stuck behind a wall of its
     * own, is in exactly the predicament of a static card: it cannot get any
     * nearer to the thing in its lane, and the lane is not empty, so nothing
     * ever lifted its eyes to the enemy standing inside its reach.
     */
    const { r } = fight(
      [
        { cardId: "wall", x: 3, y: 0 },
        { cardId: "runner", x: 0, y: 0 },
      ],
      [
        { cardId: "dummy", x: 0, y: 0 },
        { cardId: "dummy", x: 3, y: 1 },
      ],
    );
    const beside = r.finalUnits.find((u) => u.owner === "B" && u.lanes.includes(1))!;
    const queued = r.finalUnits.find((u) => u.cardId === "runner")!;
    expect(queued.col, "it was never blocked, so this proves nothing").toBeLessThan(3);
    expect(beside.hp, "blocked, and therefore silent").toBeLessThan(beside.maxHp);
  });

  it("but one that is still advancing keeps its lane", () => {
    /*
     * ⚠ THE LIMIT OF THE RULE, AND WHY IT IS A LIMIT. A free shot is only
     * taken by a card that got no nearer this tick. A card on the march is
     * busy marching: it does not swing at things beside it on the way past,
     * which is the lane discipline that makes a battle readable.
     *
     * The walker starts at column 0 and has a dummy of its own at the far end
     * of lane 0. The dummy in lane 1 is passed within arm's reach.
     */
    const { r } = fight(
      [{ cardId: "walker", x: 0, y: 0 }],
      [
        { cardId: "dummy", x: 0, y: 0 },
        { cardId: "dummy", x: 1, y: 1 },
      ],
    );
    // Both dummies share a card id, so they are told apart by lane.
    const mine = r.finalUnits.find((u) => u.owner === "B" && u.lanes.includes(0))!;
    const passed = r.finalUnits.find((u) => u.owner === "B" && u.lanes.includes(1))!;
    expect(mine.hp, "it fought what is in front of it").toBeLessThan(mine.maxHp);
    expect(passed.hp, "it swung at something it walked past").toBe(passed.maxHp);
  });

  it("a King answers what stops one column short of it", () => {
    /*
     * The King is the card this matters most to: it is static by rule, it is
     * two columns wide, and an enemy that halts just outside its reach in a
     * lane it does not own used to leave it standing. Measured in the swallow
     * test next door — the King now helps kill the thing eating its board.
     */
    const king: Place = [{ cardId: "king", x: 1, y: 1, king: true }];
    // One out at the wall in a lane the King owns — far beyond its reach, and
    // what it used to spend the battle aiming at — and one that walked up to
    // the next lane and stopped a column short.
    const them: Place = [
      { cardId: "dummy", x: 0, y: 1 },
      { cardId: "dummy", x: 3, y: 0 },
    ];
    const { r } = fight(king, them);
    const near = r.finalUnits.find((u) => u.owner === "B" && u.lanes.includes(0))!;
    const far = r.finalUnits.find((u) => u.owner === "B" && u.lanes.includes(1))!;
    expect(near.hp, "the crown stood and watched").toBeLessThan(near.maxHp);
    expect(far.hp, "it reached something it should not reach").toBe(far.maxHp);
  });

  it("shoots over its own, never through them", () => {
    /*
     * Or: *"your shots always go round a friend on the way to the enemy."*
     *
     * A wall of 200,000 health stands in front of the shooter in its own lane,
     * and the enemy stands behind the wall. The shot reaches the enemy and the
     * wall is untouched — the second half being the part worth pinning, since
     * "shoots whatever is nearest" would have it shooting its own wall.
     */
    const { hurt } = fight(
      [
        { cardId: "wall", x: 3, y: 0 },
        { cardId: "shooter", x: 2, y: 0 },
      ],
      [{ cardId: "dummy", x: 3, y: 0 }],
    );
    expect(hurt("B").get("dummy"), "the wall ate the shot").toBeGreaterThan(0);
    expect(hurt("A").get("wall"), "it shot its own wall").toBe(0);
  });
});

describe("nothing in front, something behind", () => {
  /*
   * The diver seen from the other side.
   *
   * Every card picks its target from what is IN FRONT of it, so the card that
   * surfaces behind the enemy line was not merely hard to answer — it was
   * unanswerable. A board of four that could all shoot took it from full
   * health to full health.
   */
  const THEIRS: Place = [
    { cardId: "sentry", x: 0, y: 0 },
    { cardId: "sentry", x: 1, y: 0 },
    { cardId: "guard", x: 2, y: 0 },
    { cardId: "guard", x: 3, y: 0 },
  ];

  it("they turn round and fight the thing that came up behind them", () => {
    const diver = fight([{ cardId: "diver", x: 0, y: 0 }], THEIRS).unit("diver");
    expect(diver.hp, "nothing could touch it").toBeLessThan(diver.maxHp);
  });

  it("which still leaves going round the back worth doing", () => {
    /*
     * ⚠ ANSWERABLE IS NOT UNDONE, and the difference is whether the board it
     * landed behind has anything else to do. Turning round is the LAST thing
     * a card does — only when nothing at all stands in front of it — so a
     * defence that is busy at its own front never turns, and the thing at its
     * back eats it.
     *
     * Here A holds their line with a wall they cannot chew through. Measured:
     * the diver kills three of the four and takes 15,088 health off that board
     * without being touched; the identical card without the ability walks at
     * them from the front and manages 731.
     */
    const line: Place = [{ cardId: "wall", x: 3, y: 0 }];
    const damage = (id: string) => {
      const { r } = fight([...line, { cardId: id, x: 0, y: 1 }], THEIRS);
      return r.finalUnits
        .filter((u) => u.owner === "B")
        .reduce((n, u) => n + (u.maxHp - Math.max(0, u.hp)), 0);
    };
    expect(damage("diver")).toBeGreaterThan(5 * damage("plain"));
  });

  it("says so on the frame, so the screen can turn the artwork too", () => {
    /*
     * Everything on the board takes its direction from the side it belongs
     * to — the artwork, the walk, the death throw — so a card fighting the
     * other way would be drawn looking at the empty board in front of it
     * while something ate it from behind. The screen cannot work it out: the
     * frame carries it. See `turned` on FrameUnit, and Arena's `facingOf`.
     */
    const { r } = fight([{ cardId: "diver", x: 0, y: 0 }], THEIRS, true);
    const diver = r.finalUnits.find((u) => u.cardId === "diver")!;
    const turned = r.frames.filter((f) =>
      f.units.some((u) => u.uid === diver.uid && u.turned === true),
    );
    expect(turned.length, "no frame says it is turned round").toBeGreaterThan(0);
    // And the defenders turn too, once there is nothing left in front of them.
    const theirs = r.frames.at(-1)!.units.filter((u) => u.owner === "B");
    expect(theirs.some((u) => u.turned === true)).toBe(true);
  });

  it("and a turn is only ever made toward something real", () => {
    /*
     * ⚠ NO OSCILLATION. A card turns only when there is something strictly
     * behind it and nothing at all in front, and after turning, that something
     * is in front — so the condition cannot be true twice in a row for the
     * same enemy. With one enemy left and the diver behind it, the battle
     * finishes rather than running the clock out with a card spinning in
     * place.
     */
    const { r, unit } = fight(
      [{ cardId: "diver", x: 0, y: 0 }],
      [{ cardId: "guard", x: 3, y: 3 }],
    );
    expect(unit("guard").alive, "the diver never finished it").toBe(false);
    expect(r.ticks, "it spent the battle turning round").toBeLessThan(1700);
  });
});
