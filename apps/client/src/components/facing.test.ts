/**
 * **Nobody fights backwards.**
 *
 * Or: *"the artwork on the cards should face the direction of the attack.
 * Which means that if the head faces right — as it does on most of the
 * cards — then when it belongs to the enemy it should be flipped."*
 *
 * Every card was drawn facing right, and the board has two sides: A advances
 * to the right, B to the left. So half of every battle was monsters looking
 * over their shoulders at their own King.
 *
 * Arena.tsx already had the convention in four places — the walk cycles, the
 * death throws, the knockback dust — all written `owner === "A" ? 1 : -1`.
 * The sprite was the one thing that had never been told. Read out of the
 * source, because there is no canvas here to photograph.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ARENA = readFileSync(fileURLToPath(new URL("./Arena.tsx", import.meta.url)), "utf8");

describe("a unit's artwork", () => {
  it("is mirrored for the side that attacks leftwards", () => {
    expect(ARENA).toContain('sprite.scale.set(fu.owner === "A" ? s : -s, s)');
  });

  it("is flipped on the sprite, not on the thing that lunges", () => {
    /*
     * `art` is written to every frame — the lunge, the shake, the squash of
     * a walk cycle all set `g.art.scale`. A flip parked there survives
     * exactly one tick.
     */
    const line = ARENA.slice(ARENA.indexOf("sprite.scale.set(fu.owner"));
    expect(line.slice(0, 60)).not.toContain("art.scale");
  });

  it("uses the same left-right convention as everything else in the file", () => {
    // If somebody ever flips the board, this is the string to grep for.
    expect(ARENA.match(/owner === "A" \? /g) ?? []).not.toHaveLength(0);
  });
});
