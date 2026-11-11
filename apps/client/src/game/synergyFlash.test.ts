/**
 * **A bonus you have to notice for yourself is not a reward.**
 *
 * Or: *"and generally in the game (and in the tutorial too) when there are
 * three of the same series — do some sound effect and a glow animation so it
 * looks like the thing was received."*
 *
 * The board has lit those cells green since October, and that is a STATE: it
 * says the bonus is ON and says nothing at the instant it switches on. The
 * instant is the part worth anything, because it is the one moment the
 * player did something clever.
 *
 * There is no jsdom here, so the hook's own body cannot be run. What is
 * pinned is the rule that makes it safe — the one that is easy to get wrong
 * and impossible to see from a desk — plus the wiring, because a hook nobody
 * calls is a feature nobody has.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const HOOK = read("./synergyFlash.ts");

describe("the moment three of a family lock together", () => {
  it("is silent the first time it sees a board", () => {
    /*
     * ⚠ THE BUG THIS AVOIDS, AND IT WOULD HAVE SHIPPED. A board arrives
     * already arranged far more often than you would think — coming back
     * from the result screen, a rematch, a lesson dealing its hand, the
     * playground loading a saved side — and firing on the first sight of
     * one is the game congratulating the player for something they did two
     * minutes ago, or never did at all.
     */
    expect(HOOK, "the first board is celebrated").toContain("if (!was) return;");
    expect(HOOK).toContain("const before = useRef<ReadonlySet<string> | null>(null)");
  });

  it("makes one noise for the moment, not one per cell", () => {
    /*
     * Completing a trio lights THREE cells at once — the two that were
     * waiting and the one just placed — so a sound per cell is three
     * overlapping copies of the same chord, which is a mess rather than
     * three times the reward.
     */
    const body = HOOK.slice(HOOK.indexOf("const added"));
    expect(body.match(/sfx\.play/g) ?? []).toHaveLength(1);
    expect(body).toContain("added.length");
  });

  it("has a sound of its own, and not one of the three it could be mistaken for", () => {
    const sfxSrc = read("./sfx.ts");
    expect(sfxSrc, "the sound does not exist").toContain('| "synergy"');
    expect(sfxSrc).toContain("synergy: () => {");
    expect(HOOK).toContain('sfx.play("synergy")');
  });
});

describe("and it reaches the board", () => {
  it("is computed where the lit set is, and handed down", () => {
    const app = read("../App.tsx");
    expect(app).toContain("useSynergyFlash(mySynergy)");
    expect(app, "the board is never told").toContain("synergyNew={synergyFlash}");
  });

  it("marks the cells without replacing the ring that is already on them", () => {
    const grid = read("../components/BoardGrid.tsx");
    expect(grid).toContain("slot--synergy-new");
    /*
     * ⚠ THE RING IS `::after` AND THE BURST IS `::before`. On the same
     * pseudo-element the celebration would REPLACE the thing being
     * celebrated for as long as it lasted — the green ring blinking off and
     * back on, which reads as a glitch rather than a reward.
     */
    const css = read("../styles/chests.css");
    expect(css).toContain(".slot--synergy::after");
    expect(css).toContain(".slot--synergy-new::before");
  });
});
