/**
 * Trophies for beating the computer.
 *
 * Or: *"in the early days there will not be enough players to make progress
 * from 1v1 alone — let's give trophies for beating the bot, by difficulty
 * level (the easy one can give nothing)."*
 *
 * Which is right, and is also the one thing that makes the arena ladder
 * forgeable, so the shape below is mostly about keeping both true at once.
 *
 * ═══ WHY IT IS CAPPED PER DAY AND NOT JUST SMALLER ═══
 *
 * A solo win that pays anything and costs nothing turns the ladder into a
 * clock: play enough evenings against the computer and you arrive in the top
 * arena having never met a person. That is exactly the thing `album_power`
 * exists to keep separate from `trophies` (see albumPower.ts) — one measures
 * how long you have played, the other how well.
 *
 * A daily ceiling keeps Or's reason and loses the grind. On a night when
 * nobody is online you can still climb; on the thirtieth night you cannot
 * have climbed thirty times as far as somebody who plays people.
 *
 * ═══ AND WHY A LOSS COSTS NOTHING ═══
 *
 * Against a person a loss is −20, because somebody else won those trophies
 * and the ladder has to stay honest. Nobody wins anything when the computer
 * does, and a seven-year-old who tries the hard bot twice and drops forty
 * trophies has been taught to stop trying the hard bot.
 */
import { TUNED } from "./tunables.js";

export type BotLevel = "easy" | "normal" | "hard";

/**
 * What a win against each setting is worth.
 *
 * Read through TUNED so Or can turn them from the admin panel, and read at
 * CALL time so a change applies to the next match rather than the next deploy.
 * Easy is zero on purpose and Or asked for it: the easy bot loses 83% of the
 * time, and trophies for that would be trophies for pressing play.
 */
export function soloTrophiesFor(level: BotLevel): number {
  if (level === "hard") return TUNED.soloTrophiesHard;
  if (level === "normal") return TUNED.soloTrophiesNormal;
  return 0;
}

/**
 * The most a day of playing the computer may add.
 *
 * Deliberately about five hard wins — enough that an evening alone moves you,
 * not enough to be a way up the ladder.
 */
export function soloTrophyCap(): number {
  return TUNED.soloTrophiesPerDay;
}

/**
 * How much of a claimed daily total is actually payable.
 *
 * `already` is what this player has had from the computer today. Returns what
 * to add, which is never negative and never takes the day past the ceiling.
 */
export function withinDailyCap(already: number, want: number): number {
  return Math.max(0, Math.min(want, soloTrophyCap() - Math.max(0, already)));
}

/* ───────────────────── what the board can vouch for ───────────────────── */

/**
 * The fewest real cards a board may have and still be called anything above
 * "easy".
 *
 * ═══ MEASURED, INCLUDING THE IDEA THAT DID NOT WORK ═══
 *
 * The browser plays the bot match and tells the server which setting it was
 * on, so the server has to decide how much of that to believe. The one lie
 * worth telling is "I beat the hard bot" after beating the easy one, so the
 * question is whether the opponent board gives the setting away.
 *
 * The first attempt WEIGHED the board — rarity weights through `cardPower`,
 * the same scale an album is measured on — on the assumption that the easy
 * bot plays weaker cards. Over 3,000 generated plans per setting
 * (`.scratch/board-strength.ts`, the vite-node route bot-report.ts
 * describes), it does not:
 *
 *   easy     10 cards (no spread) · strength p01 13.0  median 17.5  p99 23.0
 *   normal   13 cards (no spread) · strength p01 18.0  median 23.0  p99 28.0
 *   hard     13 cards (no spread) · strength p01 20.0  median 23.0  p99 25.5
 *
 *   strength PER CARD:  easy 1.766 · normal 1.744 · hard 1.755
 *
 * The per-card figures are the same to within noise, and the totals OVERLAP —
 * an easy board at its 99th percentile (23.0) outweighs a normal board at its
 * 1st (18.0). A strength floor set between them turned 7% of honest normal
 * boards away, which is a real player losing real trophies to catch nobody.
 * The easy planner does not pick worse cards; it leaves three slots empty and
 * places sloppily. Its board is SHORTER, not weaker.
 *
 * So the test is the card count, where the separation is total and has no
 * spread at all: ten against thirteen, every time.
 *
 * ═══ WHAT THIS DOES NOT CATCH ═══
 *
 * Normal and hard are indistinguishable from a board — same count, same
 * weight — because what separates them is the planner's search window, and
 * where cards are PUT is not visible in a snapshot. A crafted request can
 * therefore claim "hard" after beating the normal bot and earn the difference
 * between the two, which is why that difference is small on purpose and why
 * the daily ceiling sits above it.
 */
export const REAL_BOARD_CARDS = 12;

/** Is this opponent board full enough to have come from a real setting? */
export function boardLooksReal(cards: number): boolean {
  return cards >= REAL_BOARD_CARDS;
}

/**
 * The setting to PAY for: what the browser said, capped by what the board can
 * support. Nobody lies downward, so a claim of "easy" is simply believed.
 */
export function payableLevel(claimed: BotLevel, cards: number): BotLevel {
  if (claimed === "easy") return "easy";
  return boardLooksReal(cards) ? claimed : "easy";
}
