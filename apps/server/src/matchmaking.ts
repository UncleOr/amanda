/**
 * Who gets paired with whom.
 *
 * ═══ WHAT THIS REPLACES ═══
 *
 * One variable holding one socket: whoever turned up first was paired with
 * whoever turned up second, and nothing else was ever considered. That is the
 * thing Or complained about — "there must not be a situation where all his
 * cards are fourteen levels stronger than mine" — and the design that answers
 * it has been written down in docs/META.md since the beginning without ever
 * being built.
 *
 * ═══ TWO NUMBERS, AND ONLY ONE OF THEM RELAXES ═══
 *
 * TROPHIES are skill. The window around them starts narrow and widens the
 * longer somebody waits, because a player who is better than everybody
 * currently online still has to play somebody.
 *
 * ALBUM POWER is how much you have. Its limit does NOT widen, ever. A board
 * built from cards half again as strong is decided before the first tick, and
 * no amount of waiting makes that a game. Or: "better to wait another five
 * seconds than play a battle that was decided before it started."
 *
 * ═══ AND NOBODY WAITS FOREVER ═══
 *
 * After PATIENCE seconds the trophy window is wide enough to include anybody.
 * The album limit still holds — so in the worst case a player waits for
 * somebody with a comparable album rather than being handed a hopeless one.
 * A guest with no account has no numbers at all and is matched with anybody,
 * because they have nothing to be outmatched on.
 */
import { albumsComparable } from "@amanda/shared";

export interface Waiting<T> {
  who: T;
  /** Null for a guest — no account, no numbers, no constraints. */
  trophies: number | null;
  albumPower: number | null;
  since: number;
}

/** How wide the trophy window starts, in trophies. */
const TROPHY_WINDOW_START = 120;
/** How much it widens per second of waiting. */
const TROPHY_WINDOW_PER_SECOND = 40;
/** After this long, trophies stop narrowing the search at all. */
export const PATIENCE_SECONDS = 25;

/** How far apart two trophy counts may be, for somebody who has waited this long. */
export function trophyWindow(waitedMs: number): number {
  const seconds = waitedMs / 1000;
  if (seconds >= PATIENCE_SECONDS) return Number.POSITIVE_INFINITY;
  return TROPHY_WINDOW_START + TROPHY_WINDOW_PER_SECOND * seconds;
}

/**
 * Would these two make a fair board, given how long they have each waited?
 *
 * The trophy window is the WIDER of the two players' windows: if one of them
 * has been waiting half a minute, their patience should count for both,
 * otherwise a newcomer's narrow window keeps rejecting the person who has
 * been waiting longest.
 */
export function wouldPair<T>(a: Waiting<T>, b: Waiting<T>, now: number): boolean {
  if (a.who === b.who) return false;

  // A guest has no record to be outmatched on, and refusing to pair them
  // would leave them queuing against a number they do not have.
  const bothRated =
    a.trophies !== null && b.trophies !== null && a.albumPower !== null && b.albumPower !== null;
  if (!bothRated) return true;

  if (!albumsComparable(a.albumPower!, b.albumPower!)) return false;

  const window = Math.max(trophyWindow(now - a.since), trophyWindow(now - b.since));
  return Math.abs(a.trophies! - b.trophies!) <= window;
}

/**
 * The best partner for the person who has waited longest.
 *
 * Longest-waiting first on purpose: picking the closest pair anywhere in the
 * queue gives the tidiest matches and lets one unlucky player sit there while
 * better-matched pairs form around them.
 */
export function findPair<T>(queue: Array<Waiting<T>>, now: number): [Waiting<T>, Waiting<T>] | null {
  if (queue.length < 2) return null;
  const byWait = [...queue].sort((x, y) => x.since - y.since);

  for (const first of byWait) {
    let best: Waiting<T> | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const other of byWait) {
      if (other === first || !wouldPair(first, other, now)) continue;
      const gap =
        first.trophies === null || other.trophies === null
          ? 0
          : Math.abs(first.trophies - other.trophies);
      if (gap < bestGap) {
        best = other;
        bestGap = gap;
      }
    }
    if (best) return [first, best];
  }
  return null;
}
