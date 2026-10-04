import { describe, expect, it } from "vitest";
import { __testing } from "./useMatch";

const { fillGs, cellKey } = __testing;
const base = { deck: [], hand: null, discard: [], placements: {}, king: null };

describe("fillGs — end-of-build board lock", () => {
  it("a Fill card fills an empty King slot instead of stealing a placed card", () => {
    const s = { ...base, placements: { [cellKey(3, 0)]: "dragons_01_flame_dragon" } };
    const out = fillGs(s, ["fill_lava"]);
    expect(out.king).toBe("dragons_04_lava");
    // the card the player placed stays exactly where they put it
    expect(out.placements[cellKey(3, 0)]).toBe("dragons_01_flame_dragon");
  });

  it("keeps a King the player chose and still fills the rest", () => {
    const s = { ...base, king: "dragons_10_sky_king" };
    const out = fillGs(s, ["fill_lava"]);
    expect(out.king).toBe("dragons_10_sky_king");
    expect(Object.values(out.placements).filter((c) => c === "dragons_04_lava")).toHaveLength(3);
  });

  it("without a Fill card it still promotes a placed card to King", () => {
    const s = { ...base, placements: { [cellKey(3, 0)]: "dragons_01_flame_dragon" } };
    const out = fillGs(s, []);
    expect(out.king).toBe("dragons_01_flame_dragon");
  });

  it("fills every remaining slot with Crumb Demons", () => {
    const out = fillGs({ ...base, king: "dragons_10_sky_king" }, []);
    expect(Object.keys(out.placements)).toHaveLength(12);
    expect(Object.values(out.placements).every((c) => c === "crumb_demon")).toBe(true);
  });
});
