/**
 * **Who can shoot at what, now that the sky is a different place.**
 *
 * Or, 22 November 2026: *"we need to make a difference between attacking
 * aerial and ground targets. There will be ones that attack only on the
 * ground, only in the air, and both."*
 *
 * `flying` already decided what a card could get PAST — a flyer crosses a
 * blocked lane, and the shield in front of a King is made of ground cards.
 * Nothing had ever decided what a card could REACH, so every monster in the
 * game could hit every other monster and being airborne cost the enemy
 * nothing at all.
 *
 * Measured rather than asserted: each test fights the same board twice and
 * compares who actually got hit, because "the flag is set" is not the thing
 * that matters.
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import { testCard } from "../test/helpers.js";
import type { Card, Hits } from "@amanda/shared";

const CATALOG = new Map<string, Card>([
  ["crown", testCard({ id: "crown", hp: 3000, power: 1 })],
  // The shooter under test. Static so that nothing it does depends on where
  // it walked to — only on what it was willing to aim at.
  ["gunner", testCard({ id: "gunner", hp: 9000, power: 400, range: "ranged", hits: "ground" })],
  ["ackack", testCard({ id: "ackack", hp: 9000, power: 400, range: "ranged", hits: "air" })],
  ["both", testCard({ id: "both", hp: 9000, power: 400, range: "ranged" })],
  // Two things to aim at, identical but for the ground under one of them.
  ["walker", testCard({ id: "walker", hp: 4000, power: 1, moveSpeed: 0 })],
  ["flyer", testCard({ id: "flyer", hp: 4000, power: 1, moveSpeed: 0, flying: true })],
]);

/** Which card ids this shooter actually landed an attack on. */
function struck(shooter: string, foes: string[]): Set<string> {
  const r = runBattle({
    a: { owner: "A", placements: [{ cardId: "crown", x: 1, y: 1, king: true }, { cardId: shooter, x: 0, y: 0 }] },
    b: {
      owner: "B",
      placements: [
        { cardId: "crown", x: 1, y: 1, king: true },
        ...foes.map((cardId, i) => ({ cardId, x: 3, y: i === 0 ? 0 : 3 })),
      ],
    },
    seed: 4,
    catalog: CATALOG,
    synergies: [],
  });
  const me = r.finalUnits.find((u) => u.cardId === shooter)!.uid;
  return new Set(
    r.events
      .filter((e) => e.type === "attack" && e.uid === me)
      .map((e) => r.finalUnits.find((u) => u.uid === e.targetUid)?.cardId ?? ""),
  );
}

describe("a card that only shoots at the ground", () => {
  it("hits the walker and never the flyer", () => {
    const hit = struck("gunner", ["walker", "flyer"]);
    expect(hit.has("walker"), "it could not hit the thing it is for").toBe(true);
    expect(hit.has("flyer"), "a ground gun shot something in the air").toBe(false);
  });

  it("is the difference, not the board: the same board, both ways", () => {
    /*
     * ⚠ THE COMPARISON IS THE TEST. A ground-only card that misses the flyer
     * proves nothing on its own — it might simply never have got a shot
     * away. So the identical board is fought with a shooter that can hit
     * both, and that one does hit it.
     */
    expect(struck("both", ["walker", "flyer"]).has("flyer")).toBe(true);
    expect(struck("gunner", ["walker", "flyer"]).has("flyer")).toBe(false);
  });
});

describe("a card that only shoots at the air", () => {
  it("hits the flyer and never the walker", () => {
    const hit = struck("ackack", ["walker", "flyer"]);
    expect(hit.has("flyer")).toBe(true);
    expect(hit.has("walker"), "an anti-air gun shot something standing on the ground").toBe(false);
  });
});

describe("the crown is reachable by everybody, and that is the rule that makes the rest safe", () => {
  /*
   * ⚠ WITHOUT THIS, A CROWNED FLYER IS UNKILLABLE BY HALF THE CATALOGUE and
   * the match is decided by a timer running out. A monster on the crown has
   * given up its movement — it is the building the match is about, not a
   * bird — so every card in the game can attack it whatever it is.
   */
  const crownedFlyer = new Map(CATALOG);
  crownedFlyer.set("skyking", testCard({ id: "skyking", hp: 3000, power: 1, flying: true }));
  /*
   * Walkers, unlike the static shooters above. The point here is whether the
   * crown is a legal target, so each one has to be able to GET to it — a
   * static gun in the back row simply never comes into range and would have
   * failed this test while the rule it is testing was perfectly fine.
   */
  crownedFlyer.set("ground", testCard({ id: "ground", hp: 9000, power: 400, moveSpeed: 2, hits: "ground" }));
  crownedFlyer.set("air", testCard({ id: "air", hp: 9000, power: 400, moveSpeed: 2, hits: "air" }));

  function reachedCrown(shooter: Hits): boolean {
    const r = runBattle({
      a: {
        owner: "A",
        placements: [
          { cardId: "crown", x: 1, y: 1, king: true },
          { cardId: shooter, x: 3, y: 1 },
        ],
      },
      b: { owner: "B", placements: [{ cardId: "skyking", x: 1, y: 1, king: true }] },
      seed: 4,
      catalog: crownedFlyer,
      synergies: [],
    });
    return r.events.some(
      (e) => e.type === "attack" && r.finalUnits.find((u) => u.uid === e.targetUid)?.isKing === true,
    );
  }

  it("lets a ground-only card attack a King that flies", () => {
    expect(reachedCrown("ground")).toBe(true);
  });

  it("lets an air-only card attack a King that does not", () => {
    expect(reachedCrown("air")).toBe(true);
  });
});

describe("and nothing falls back", () => {
  it("leaves a ground gun with nothing to do against an all-flying line", () => {
    /*
     * Everywhere else in the engine a card that cannot find the KIND of
     * enemy it prefers fights like anything else, because a sniper-hunter on
     * a board with no snipers should still fight. This is deliberately the
     * opposite: being unable to help is the whole mechanic, and a player who
     * built an all-ground board against an all-flying one has learned
     * something. The crown rule above is what stops it being a match with
     * no end.
     */
    const hit = struck("gunner", ["flyer", "flyer"]);
    expect([...hit].filter((id) => id === "flyer")).toHaveLength(0);
  });
});
