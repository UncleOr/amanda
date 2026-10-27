/**
 * **The clock stops being dragged down by the battle.**
 *
 * Or: *"when the king dies before the end of the battle time, the clock goes
 * down automatically so the battle ends at 0 together with the king dying.
 * That's weird. If the king dies the battle just ends, even if there are 23
 * seconds left on the clock and I didn't get the end-of-clock beep. That is
 * completely fine by me."*
 *
 * He is describing the code exactly. The arena read
 *
 *     const totalSec = frames.length / SIMULATION.ticksPerSecond;
 *
 * and `frames.length` is how long the battle ACTUALLY ran — the engine stops
 * the moment a king falls (simulate.ts runs `while !ended && winner ===
 * null`). So a battle decided at 35 seconds produced 1,050 frames and the
 * clock was told it had 35 seconds to spend: it started at 35 rather than
 * 58, and emptied precisely as the crown came down.
 *
 * There is no DOM and no WebGL here, so this reads the arena's source. The
 * numbers below are the engine's own, which CAN be run.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PHASES, SIMULATION } from "@amanda/shared";

const ARENA = readFileSync(
  fileURLToPath(new URL("./Arena.tsx", import.meta.url)),
  "utf8",
);

/** The body of the ticker callback, where the countdown is computed. */
const TICKER = ARENA.slice(ARENA.indexOf("app.ticker.add((ticker)"));

describe("the battle clock", () => {
  it("counts the allowance, not the length of the replay", () => {
    expect(TICKER).toContain("const totalSec = PHASES.battle.seconds;");
    expect(
      TICKER.includes("totalSec = frames.length"),
      "frames.length is the battle's real length, which is the bug",
    ).toBe(false);
  });

  it("stops when the replay does, instead of running on under the victory", () => {
    /*
     * ⚠ The half that is easy to miss. `elapsed` keeps climbing after the
     * last frame — the ticker runs on through the announcement and the
     * explosions — so reading it raw would have the clock carry on down
     * from the 23 seconds the king left on it, and start beeping partway
     * through the win. That is the reported bug arriving four seconds late.
     */
    expect(TICKER).toContain("const played = Math.min(elapsed, playbackMs);");
    expect(TICKER).toContain("totalSec - played / 1000");
  });

  it("leaves the end-of-clock sting to the clock", () => {
    // Already true before this change, and worth holding: a crown coming
    // down has the battle's own noise behind it.
    expect(TICKER).toContain('if (endedBy !== "king") sfx.play("timeUp")');
  });
});

describe("what the clock is counting", () => {
  it("is 58 seconds, and the engine agrees", () => {
    expect(PHASES.battle.seconds).toBe(58);
    expect(PHASES.battle.seconds * SIMULATION.ticksPerSecond).toBe(1740);
  });

  /*
   * The premise of the whole fix: a battle CAN be shorter than its
   * allowance, which is why the clock needed its own source of truth.
   */
  it("and a battle that ends early really does come back short", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../../../packages/engine/src/simulate.ts", import.meta.url)),
      "utf8",
    );
    expect(src).toContain("while (!state.ended && state.winner === null && state.tick < totalTicks)");
  });
});
