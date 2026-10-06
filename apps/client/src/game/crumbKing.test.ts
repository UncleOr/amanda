import { describe, expect, it } from "vitest";
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
 * No King at all is the honest state: the side fights on and loses on damage
 * at the end of a real battle (measured: 45.0s, kingHp) instead of forfeiting
 * before the first second.
 */
describe("the crown never goes to a crumb", () => {
  it("a board of nothing but crumbs produces no King", () => {
    const locked = fillGs({ ...base }, []);
    expect(locked.king).toBeNull();
    // and the board really is all filler, which is what made this reachable
    expect(new Set(Object.values(locked.placements))).toEqual(new Set(["crumb_demon"]));
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

  it("and crowns nobody when crumbs are all there is", () => {
    const placements: Record<string, string> = {};
    for (let x = 0; x < 4; x++) placements[cellKey(x, 0)] = "crumb_demon";
    expect(resolveKing(null, placements).king).toBeNull();
  });
});
