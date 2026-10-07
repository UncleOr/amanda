/**
 * Nachos: the small reward that is always nearly enough.
 *
 * Or's ask, in his words: *"we have to create a situation where the player is
 * always one or two games away from some goal. Always 3 trophies, or 2
 * diamonds, or 3 cards away from getting something."*
 *
 * Trophies alone cannot do that. A win is +30 and a loss is −20, so after a
 * bad evening you are further from the next arena than when you started, and
 * the thing you are walking towards walks away from you. Nachos only ever go
 * UP, and they go up after a loss too — so there is always a bar that moved.
 *
 * ═══ WHY IT IS THE SCORE AND NOT THE RESULT ═══
 *
 * Every battle already ends with a 1–10 mark for each side (`Grade` in
 * packages/engine/src/report.ts) built from five measured things: did you win,
 * how fast, how well you traded, how much of your board fought, how much came
 * home. Paying out on THAT rather than on win/lose means a good loss is worth
 * something and a scraped win is worth less than a clean one — which is the
 * difference between "play more" and "win more", and a seven-year-old playing
 * his father needs the first one.
 */

/** 1–10, as `Grade.score` gives it. */
export type Score = number;

/**
 * How many nachos a performance is worth. 0, 1, 2 or 3 — Or's numbers.
 *
 * The bands are not even, because the scale is not even: a loss is capped at
 * 6 by the grader (`capped = min(weighted, 0.55)`), so the top band is a
 * winner's band by construction and the 3–5 band is where a decent loss and a
 * scrappy win both land. Nothing here needs to know whether you won; the
 * grade already does.
 *
 * Average over a realistic spread of matches: about 1.5 a match.
 */
export function nachosForScore(score: Score): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(score)) return 0;
  if (score >= 9) return 3;
  if (score >= 6) return 2;
  if (score >= 3) return 1;
  return 0;
}

/**
 * How many nachos fill one chest.
 *
 * ═══ A THEORY THAT WAS MEASURED AND THROWN AWAY ═══
 *
 * This number was first chosen as SEVEN, on the following argument. Or's
 * condition was that nothing should ever be "lined up" — that you should never
 * come back to an empty bar — and the bar empties by subtracting its size, so
 * landing flush on a multiple is the thing to avoid. A match pays 0, 1, 2 or
 * 3; six is divisible by two of those and seven by none of them; therefore
 * seven lands flush far less often. It is a tidy argument and it is wrong.
 *
 * Measured over three hundred thousand matches, the share of chests that leave
 * the bar at exactly zero is **54.9% for every bar size tried** — 4, 5, 6, 7,
 * 8, 9, 10 and 11, the same number to one decimal place. The reason is that
 * the step distribution decides it and the bar size cannot: a step of 1 that
 * crosses the line ALWAYS lands on it, and the chance of hitting any distant
 * number exactly is about one over the mean step, whatever the number is.
 * Divisibility never enters into it.
 *
 * ═══ SO WHAT ACTUALLY KEEPS IT UNSYNCED ═══
 *
 * Not this constant. It is that there are SEVERAL bars running at different
 * speeds and they cannot all be empty at once: the nacho bar fills about every
 * three matches, the arena needs a few wins, a daily challenge turns over at
 * midnight, a weekly one on Sunday, and card copies accumulate towards an
 * upgrade on their own clock. Or's own sentence had it right the first time —
 * *"3 trophies, or 2 diamonds, or 3 cards"* — the word doing the work is "or".
 *
 * ═══ WHY FIVE ═══
 *
 * Freed from the divisibility argument, the only thing left to choose on is
 * rhythm, and that is a measurement too. At 1.5 nachos a match: a bar of 5 is
 * a chest every 3.3 matches, 7 is every 4.6, 10 is every 6.6. Or asked for
 * "one or two games away". Five is the one that is actually that: after any
 * single match the bar has moved a fifth to three fifths of the way, so the
 * chest is visibly close from the moment the last one was opened.
 */
export const NACHOS_PER_CHEST = 5;

/** Where the bar is, given the nachos collected since the last chest. */
export interface NachoBar {
  /** How many are in the bar right now, 0..NACHOS_PER_CHEST-1. */
  have: number;
  /** How many fill it. */
  need: number;
  /** How many more are wanted. Never zero — a full bar has already paid out. */
  toGo: number;
  /** 0..1, for drawing it. */
  fraction: number;
}

export function nachoBar(total: number): NachoBar {
  const have = ((total % NACHOS_PER_CHEST) + NACHOS_PER_CHEST) % NACHOS_PER_CHEST;
  return {
    have,
    need: NACHOS_PER_CHEST,
    toGo: NACHOS_PER_CHEST - have,
    fraction: have / NACHOS_PER_CHEST,
  };
}

/** How many chests a lifetime nacho count has filled. */
export function chestsFilled(total: number): number {
  return Math.floor(Math.max(0, total) / NACHOS_PER_CHEST);
}

/**
 * Which chest the nth nacho chest is.
 *
 * Mostly wood, every third silver, every ninth gold — so the bar is not just
 * "another one of those", there is a better one a countable distance away. The
 * same shape as the win ladder in the server's recordMatch, deliberately: two
 * rhythms that disagree would make neither of them legible.
 */
export function nachoChestKind(index: number): "wood" | "silver" | "gold" {
  const n = index + 1;
  if (n % 9 === 0) return "gold";
  if (n % 3 === 0) return "silver";
  return "wood";
}
