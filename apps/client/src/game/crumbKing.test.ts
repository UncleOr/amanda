import { describe, expect, it } from "vitest";
import { CRUMB_DEMON, KING } from "@amanda/shared";
import { __testing } from "./useMatch";

const { fillGs, resolveKing, cellKey } = __testing;
const base = { deck: [], hand: null, discard: [], placements: {}, king: null };

/**
 * A crumb demon must never wear the crown.
 *
 * Or and Hod played Amanda mode together: "Hod immediately saw that he lost,
 * even though the game supposedly ran for 16.6 seconds." The server agreed —
 * it recorded a battle one tick long.
 *
 * The cause: a player who places nothing has their board filled with Crumb
 * Demons (1 HP filler), and the King was then chosen as "the best card on the
 * board" — which by that point was a crumb. A King dying ends the battle at
 * once, so the crumb King died on the first tick. In Amanda mode the two
 * players share one side, so it ended HIS PARTNER'S battle too.
 *
 * No King at all WAS the answer: the side fought on and lost on damage at the
 * end of a real battle (measured: 45.0s, kingHp) instead of forfeiting before
 * the first second.
 *
 * ═══ AND OR OVERRULED IT, SO THE RULE MOVED ═══
 *
 * *"I started a match without placing a King and saw I had no Crumb Demon in
 * the King slot — there has to be a King, otherwise it's strange."* He is
 * right about the screen: every other empty cell fills at the buzzer and the
 * one with a crown drawn around it stayed a hole.
 *
 * What stops the original bug coming back with it is the King slot's own
 * arithmetic, which this file now pins: ×3 HP plus a flat hundred per
 * account level (KING in config.ts). A crumb on the crown is not a 1 HP
 * crumb; it is a weak King. The thing that must never return is the ONE-TICK
 * forfeit, so that is what is tested, rather than the absence of a crown.
 *
 * `resolveKing` is unchanged and still passes over crumbs — promoting a
 * crumb while a real card sits on the board would still be wrong. The crumb
 * only reaches the crown when there is nothing else at all.
 */
describe("the crown never goes to a crumb", () => {
  it("fills the empty crown rather than leaving a hole", () => {
    const locked = fillGs({ ...base }, []);
    expect(locked.king).toBe("crumb_demon");
    // and the board really is all filler, which is what made this reachable
    expect(new Set(Object.values(locked.placements))).toEqual(new Set(["crumb_demon"]));
  });

  /*
   * The guard on the bug this file was written for. A King on 1 HP dies to
   * the first thing that touches it and ends the battle before the first
   * second — which is what Hod saw. The slot's multiplier and the flat HP
   * per account level are what make a crumb King survivable, so if either
   * is ever tuned to nothing, this is the line that says so.
   */
  it("a crumb on the crown is still a King, not a one-tick forfeit", () => {
    expect(KING.hpMultiplier).toBeGreaterThanOrEqual(3);
    expect(KING.hpPerAccountLevel).toBeGreaterThan(0);
    const crumbKingHp = CRUMB_DEMON.hp * KING.hpMultiplier + KING.hpPerAccountLevel;
    // Comfortably more than the hardest single hit in the game.
    expect(crumbKingHp).toBeGreaterThan(100);
  });

  it("one real card among the crumbs wears the crown instead", () => {
    const s = { ...base, placements: { [cellKey(0, 0)]: "insects_01_ant_soldier" } };
    const locked = fillGs(s, []);
    expect(locked.king).toBe("insects_01_ant_soldier");
  });

  it("resolveKing passes over crumbs however many there are", () => {
    const placements: Record<string, string> = {};
    for (let x = 0; x < 4; x++) placements[cellKey(x, 0)] = "crumb_demon";
    placements[cellKey(0, 3)] = "giants_01_stone_colossus";
    expect(resolveKing(null, placements).king).toBe("giants_01_stone_colossus");
  });

  /*
   * resolveKing itself still says "nobody". The crumb is put on the crown
   * one level up, in fillGs, so that the promotion rule stays about REAL
   * cards and the filling rule stays about filling.
   */
  it("and crowns nobody when crumbs are all there is", () => {
    const placements: Record<string, string> = {};
    for (let x = 0; x < 4; x++) placements[cellKey(x, 0)] = "crumb_demon";
    expect(resolveKing(null, placements).king).toBeNull();
  });
});
