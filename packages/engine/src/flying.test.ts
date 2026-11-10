/**
 * **Do the flyers actually fly?**
 *
 * Or: *"and confirming with you that the flyers really do fly (and advance
 * even when somebody is blocking them)."*
 *
 * A fair question, because "it flies" is written on the card as a fact and
 * the only place it is true is a handful of `if (!u.flying)` lines in
 * simulate.ts. Nothing on screen says a flyer passed over anything; what a
 * player sees is one card further forward than another, which is also what
 * a faster card looks like.
 *
 * So this measures it rather than reading it. Two units, identical in every
 * number, one of them flying, each stuck behind an ally that will not move:
 * the difference in how far they get is the whole of what the word means.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import type { Card } from "@amanda/shared";

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
  over: Partial<{ hp: number; power: number; move: number; flying: boolean }> = {},
): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    flying: over.flying ?? false,
    stats: {
      hp: over.hp ?? 4000,
      power: over.power ?? 10,
      attackSpeed: 3,
      moveSpeed: over.move ?? 1.5,
      range: "melee",
    },
    abilities: [],
  }) as unknown as Card;

const CATALOG = new Map<string, Card>([
  ["walker", card("walker")],
  ["flyer", card("flyer", { flying: true })],
  // A wall of its own side: it does not move, so anything behind it on the
  // ground has to stop and wait.
  ["ally_wall", card("ally_wall", { move: 0, hp: 9000 })],
  // The same wall, in the air. Or: *"'flying in place' means he does not
  // move, but walkers can pass under him?"* This is the card that answers it.
  ["ally_hover", card("ally_hover", { move: 0, hp: 9000, flying: true })],
  // Something to walk towards, far away and harmless, so the only thing
  // deciding where anybody ends up is the wall.
  ["far", card("far", { hp: 90000, power: 0, move: 0 })],
]);

/** How far the mover got, as a column, after a full battle. */
function reached(
  mover: "walker" | "flyer",
  infront: "ally_wall" | "ally_hover" | null = "ally_wall",
): number {
  const placements: BoardInput["placements"] = [
    // The mover at the back, its own wall directly in front of it.
    { cardId: mover, x: 0, y: 0 },
    ...(infront ? [{ cardId: infront, x: 1, y: 0 }] : []),
  ];
  const r = runBattle({
    a: { owner: "A", placements },
    // In the SAME lane, which matters: a target in another lane makes
    // everybody drift sideways out from behind the wall, and then the
    // measurement is of lane drift rather than of flying.
    b: { owner: "B", placements: [{ cardId: "far", x: 3, y: 0 }] },
    seed: 1,
    catalog: CATALOG,
    synergies: [],
  });
  return r.finalUnits.find((u) => u.cardId === mover)!.col;
}

describe("a card that flies", () => {
  const wall = (): number => {
    const r = runBattle({
      a: { owner: "A", placements: [{ cardId: "ally_wall", x: 1, y: 0 }] },
      b: { owner: "B", placements: [{ cardId: "far", x: 3, y: 0 }] },
      seed: 1,
      catalog: CATALOG,
      synergies: [],
    });
    return r.finalUnits.find((u) => u.cardId === "ally_wall")!.col;
  };

  it("does not queue up behind its own front line", () => {
    const walked = reached("walker");
    const flew = reached("flyer");
    const stuckAt = wall();
    // The walker is held behind the wall; the flyer is past it. Stated as
    // "past the thing that stopped the other one" rather than as two
    // numbers, so tuning the follow gap cannot quietly make it pass.
    /*
     * Measured: the walker finishes at column 0.00 — it never leaves the
     * square it started on, because its own wall is one column ahead of it
     * — and the flyer finishes at 2.40, which is as far forward as the
     * enemy's reach allows.
     */
    expect(walked, "the walker is behind the wall").toBeLessThan(stuckAt);
    expect(flew, "the flyer is past it").toBeGreaterThan(stuckAt);
  });

  it("gets further than the identical card that cannot", () => {
    // Identical in every stat but one. If this is ever equal, flying has
    // stopped meaning anything on the board.
    expect(reached("flyer")).toBeGreaterThan(reached("walker"));
  });

  it("changes lanes through its own side as well", () => {
    /*
     * The second half of `!u.flying`, and the one nobody would notice
     * missing: on the ground a unit may not drift into a lane one of its
     * own is standing in, so a card trying to spread out can be boxed in
     * by its own board. A flyer goes over.
     */
    const src = readSource();
    expect(src, "lane drift checks it").toContain("// On the ground you cannot walk through your own; in the air you can.");
    expect(src.match(/if \(!u\.flying\)/g) ?? [], "forward and sideways").toHaveLength(2);
  });

  it("does nothing for the hovering card's OWN movement", () => {
    /*
     * ═══ "WHAT IS STATIC FLYING? HE SHOULD FLY, SHOULDN'T HE?" ═══
     *
     * Or, reading the Typhoon Dragon's card on 10 November 2026. The card
     * says תנועה: מעופף, במקום — "flying, in place" — and he is right that
     * it reads as a contradiction. It is worse than that: in the engine it
     * is not a contradiction, it is NOTHING.
     *
     * Both halves of `flying` hang off movement. `driftTowardLane` is called
     * only when `effectiveMoveSpeed(u) > 0`, and `moveUnit` — which holds
     * the other `if (!u.flying)` — is called under the same condition. A
     * card with moveSpeed 0 reaches neither, so the flag is read by nobody.
     *
     * Measured below rather than argued: the same card ALONE on its side,
     * flying and not flying, fights a bit-identical battle. Five cards are
     * in this position today — Torch, the Typhoon Dragon, the Sky King, the
     * Insect Empress and the Floating Brain.
     *
     * ⚠ AND THIS WAS OVERSTATED WHEN IT WAS WRITTEN, SO THE CORRECTION
     * BELONGS HERE RATHER THAN IN A COMMIT NOBODY WILL READ AGAIN. It said
     * the flag was "read by nobody". That stopped being true an hour later:
     * Or answered the question with a rule — *"he does not move, but walkers
     * can pass under him"* — and `blockingAlly` now reads `flying` on every
     * ally ahead in the lane. So a hovering card no longer walls in its own
     * side, which is the test above this one.
     *
     * What is still true, and is all this one claims, is that the flag does
     * nothing for the hovering card's OWN movement: both branches that use
     * it for the unit itself sit behind `effectiveMoveSpeed(u) > 0`.
     *
     * ⚠ AND THE OBVIOUS FIX IS A TRAP, WHICH IS WHY IT IS WRITTEN DOWN
     * HERE. Giving the Typhoon a moveSpeed does not make him fly; it makes
     * him walk out of his own lane towards whatever he is shooting at,
     * stand in front of the wall that was covering him, and die. Measured
     * on his real numbers — 580hp against one ordinary attacker — he went
     * from surviving the battle and dealing 18,431 to being killed partway
     * through for 3,500. An 81% cut, from a change that reads on paper like
     * a buff.
     *
     * So this test is not here because the behaviour is right. It is here
     * so that the day somebody makes flying mean something while hovering,
     * this fails and says so, instead of five cards quietly changing.
     */
    const fly = runBattle({
      a: { owner: "A", placements: [{ cardId: "ally_wall", x: 0, y: 0 }] },
      b: { owner: "B", placements: [{ cardId: "far", x: 3, y: 1 }] },
      seed: 7,
      catalog: new Map(CATALOG).set("ally_wall", card("ally_wall", { move: 0, hp: 9000, flying: true })),
      synergies: [],
    });
    const ground = runBattle({
      a: { owner: "A", placements: [{ cardId: "ally_wall", x: 0, y: 0 }] },
      b: { owner: "B", placements: [{ cardId: "far", x: 3, y: 1 }] },
      seed: 7,
      catalog: CATALOG,
      synergies: [],
    });
    const shape = (r: ReturnType<typeof runBattle>) => {
      const u = r.finalUnits.find((x) => x.cardId === "ally_wall")!;
      return { col: u.col, lanes: u.lanes.join(","), hp: u.hp, ticks: r.ticks };
    };
    expect(shape(fly), "a hovering card is not using its wings for anything").toEqual(
      shape(ground),
    );
  });

  it("is not a wall for its own side either", () => {
    /*
     * ═══ "WALKERS CAN PASS UNDER HIM" ═══
     *
     * Or, giving the word a meaning the engine did not have: *"'flying in
     * place' means he does not move, but walkers can pass under him?"*
     *
     * They could not. `blockingAlly` counted every living body ahead in the
     * lane, and nothing in it asked whether that body was standing on the
     * floor — so a hovering Typhoon Dragon or Sky King held up the whole
     * lane behind it exactly as a Stone Colossus does. Measured before the
     * fix: a walker with a clear lane reaches 2.40, and behind a HOVERING
     * ally it reached 0.00 — the same 0.00 as behind a standing one. It
     * never left the square it started on.
     *
     * That is the one reading of "flying" that costs the card nothing and
     * its owner a whole unit, and it was the reading in the code.
     *
     * Across 600 real-catalogue battles with that exact shape forced onto
     * the board — a static flyer at the front of a lane, a Rock Troll
     * behind it — the troll's mean final column went 3.17 → 4.17, a full
     * column further, every battle. Outcomes moved by two battles in six
     * hundred, so the rule frees a unit without moving the balance.
     */
    const clear = reached("walker", null);
    const underHover = reached("walker", "ally_hover");
    const behindWall = reached("walker", "ally_wall");
    expect(underHover, "it is still queued behind something in the air").toBe(clear);
    /*
     * ⚠ AND THE OTHER HALF, WHICH IS WHAT KEEPS THIS A RULE ABOUT FLYING
     * RATHER THAN A DELETED QUEUE. Lane discipline is Or's own: *"part of
     * the wisdom is building the board so that you do not put someone
     * walking behind someone static."* A card on the GROUND still blocks.
     */
    expect(behindWall, "the ground queue is gone, which was never the ask").toBeLessThan(clear);
  });

  it("still stops to fight what is in front of it", () => {
    /*
     * The other half of Or's question. "Advances even when somebody is
     * blocking them" is about its OWN side — a flyer that also ignored
     * enemies would sail past the board into an empty corner and the game
     * would have no front line at all.
     */
    const r = runBattle({
      a: { owner: "A", placements: [{ cardId: "flyer", x: 0, y: 0 }] },
      b: { owner: "B", placements: [{ cardId: "far", x: 3, y: 0 }] },
      seed: 1,
      catalog: CATALOG,
      synergies: [],
    });
    const hits = r.events.filter((e) => e.type === "attack");
    expect(hits.length, "it engaged rather than flew past").toBeGreaterThan(0);
  });
});

function readSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node:fs").readFileSync(
    require("node:url").fileURLToPath(new URL("./simulate.ts", import.meta.url)),
    "utf8",
  ) as string;
}

/**
 * **And the enemy's side of the same word.**
 *
 * Or, asked whether an enemy flyer should stop a walker the way an ally one
 * no longer does: *"if the enemy is walking to the King — a hovering card
 * does not stop him. If the enemy gets stuck on people he has to kill on the
 * way — then yes, they stop until they kill one another."*
 *
 * Two stops, and the engine only ever had one. He is separating them:
 *
 *   PICKED IT  → walk to arm's length and fight. Unchanged, and it is the
 *                only thing that has ever physically stopped a unit here.
 *   SHIELDING  → "kill me before you may touch the crown". A thing in the
 *                air is not that, and never was.
 *
 * So the change is narrow on purpose and the two tests below are the two
 * halves of his sentence.
 *
 * ═══ AND IT IS THE BIGGER OF THE TWO HALVES, MEASURED ═══
 *
 * 600 real-catalogue battles, eight or nine random cards a side, same seeds
 * before and after:
 *
 *   winner changed                  11 of 600   (1.8%)
 *   anything changed at all         84 of 600
 *   who it favoured                 A 305/295 -> 304/296, i.e. neither
 *   mean length                     219.3 -> 212.8 ticks
 *   decided by a crown falling      482 -> 492, on the clock 80 -> 70
 *
 * The own-side half moved two battles in six hundred; this one moves eleven.
 * The direction is the rule doing exactly what it says: more battles end
 * with a King down and fewer run out the clock, because attackers reach the
 * crown instead of standing under something they cannot walk round.
 */
describe("an enemy card in the air", () => {
  /** Where the attacker finished, and what it spent the battle hitting. */
  function run(guard: "ally_wall" | "ally_hover") {
    const r = runBattle({
      a: { owner: "A", placements: [{ cardId: "walker", x: 0, y: 1 }] },
      b: {
        owner: "B",
        placements: [
          // The crown, and one body in front of it in the same lane.
          { cardId: "far", x: 1, y: 1, king: true },
          { cardId: guard, x: 3, y: 1 },
        ],
      },
      seed: 3,
      catalog: CATALOG,
      synergies: [],
    });
    const mine = r.finalUnits.find((u) => u.cardId === "walker")!.uid;
    const hit = new Set(
      r.events
        .filter((e) => e.type === "attack" && e.uid === mine)
        .map((e) => r.finalUnits.find((u) => u.uid === e.targetUid)?.cardId),
    );
    return { hit, col: r.finalUnits.find((u) => u.cardId === "walker")!.col };
  }

  it("does not shield the crown behind it", () => {
    /*
     * ⚠ THE WHOLE RULE, IN ONE COMPARISON. The same board twice, the guard
     * on the ground and then in the air. On the ground the attacker never
     * reaches the King — it has to go through the guard first. In the air
     * the guard is not a door, so the King is what it walks to.
     */
    const ground = run("ally_wall");
    const air = run("ally_hover");
    expect(ground.hit.has("ally_wall"), "a body in the way is fought").toBe(true);
    expect(ground.hit.has("far"), "the crown is shielded by a body").toBe(false);
    expect(air.hit.has("far"), "the crown is still shielded by something in the air").toBe(true);
    // And it physically got further, which is the thing a player sees.
    expect(air.col).toBeGreaterThan(ground.col);
  });

  it("is still fought when it is the nearest thing in the lane", () => {
    /*
     * ⚠ AND THIS IS THE HALF THAT KEEPS THE RULE HONEST — the worry that
     * held this change up for a day: if a walker simply passed under
     * anything hovering, every hovering card would be untouchable by melee,
     * the Sky King at 1,450hp included.
     *
     * It is not, because only the SHIELD changed. With no crown behind it,
     * a hovering card is the nearest thing in the lane and is picked like
     * anything else — and then the ordinary stop applies and the two of
     * them fight it out, which is Or's second sentence exactly.
     */
    const r = runBattle({
      a: { owner: "A", placements: [{ cardId: "walker", x: 0, y: 0 }] },
      b: { owner: "B", placements: [{ cardId: "ally_hover", x: 3, y: 0 }] },
      seed: 3,
      catalog: CATALOG,
      synergies: [],
    });
    const mine = r.finalUnits.find((u) => u.cardId === "walker")!.uid;
    const hits = r.events.filter((e) => e.type === "attack" && e.uid === mine);
    expect(hits.length, "a walker flew past a hovering card instead of fighting it").toBeGreaterThan(
      0,
    );
  });
});
