import { useEffect, useRef, useState } from "react";
import { sfx } from "./sfx";
import { haptics } from "./haptics";

/**
 * **The moment three of a family lock together.**
 *
 * Or: *"and generally in the game (and in the tutorial too) when there are
 * three of the same series — do some sound effect and a glow animation so it
 * looks like the thing was received."*
 *
 * ═══ A STATE WAS BEING DRAWN WHERE AN EVENT BELONGED ═══
 *
 * The board has lit those cells green since October, and that is a STATE: it
 * says the bonus is ON. What it has never said is the INSTANT it switched on
 * — and the instant is the part worth anything, because it is the one moment
 * the player did something clever. A reward you have to notice for yourself
 * by comparing the board to how it looked a second ago is not a reward.
 *
 * So this watches the lit set and answers one question: which cells just
 * joined it. The sound and the burst hang off that.
 *
 * ⚠ IT MUST NOT FIRE ON THE FIRST SIGHT OF A BOARD. A board arrives already
 * arranged more often than you would think — coming back from the result
 * screen, a rematch, a lesson that deals a hand, the playground loading a
 * saved side — and celebrating a bonus the player did not just make is the
 * game congratulating them for nothing. The first set is recorded in silence.
 */
export function useSynergyFlash(lit: ReadonlySet<string>): ReadonlySet<string> {
  const [flash, setFlash] = useState<ReadonlySet<string>>(() => new Set());
  /** What was lit last time. `null` until the first board has been seen. */
  const before = useRef<ReadonlySet<string> | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const was = before.current;
    before.current = lit;
    if (!was) return; // the first board is recorded, never celebrated
    const added = [...lit].filter((cell) => !was.has(cell));
    if (!added.length) return;
    /*
     * One noise per MOMENT, not per cell. Completing a trio lights three
     * cells at once — the two that were waiting and the one just placed —
     * and three overlapping copies of the same chord is a mess rather than
     * three times the reward.
     */
    sfx.play("synergy");
    haptics.buzz("gems");
    setFlash(new Set(added));
    window.clearTimeout(timer.current);
    // Long enough for the burst to finish; the steady green ring is still
    // underneath it and stays for as long as the bonus does.
    timer.current = window.setTimeout(() => setFlash(new Set()), 900);
  }, [lit]);

  return flash;
}
