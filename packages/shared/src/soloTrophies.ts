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
 * ═══ AND WHAT A LOSS COSTS ═══
 *
 * It used to cost nothing, and the argument was a good one: nobody wins
 * anything when the computer does, and a seven-year-old who tries the hard
 * bot twice and drops forty trophies has been taught to stop trying the
 * hard bot.
 *
 * Or: *"if I lose I should lose some trophies (not as many as you earn for
 * a win, but still lose some) — that way it's also possible to go DOWN
 * arenas."* Which is the half I had not weighed: a ladder you can only
 * climb is not a ladder, it is a counter, and an arena you cannot fall out
 * of is a badge for having played rather than for playing well.
 *
 * So: half of what the same bot pays for a win, rounded down. Easy costs
 * nothing because easy pays nothing — it is the setting you learn on.
 *
 *     easy    win 0    loss 0
 *     normal  win 8    loss 4
 *     hard    win 12   loss 6
 *
 * Against a person it stays −20 (TUNED.trophiesPerLoss, in the admin
 * panel): somebody else won those, so the ladder has to carry the full
 * weight of it.
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
 * What losing to the computer costs. Derived from what winning pays, so
 * there is one number per difficulty to turn and the two can never drift
 * into a setting that pays less for a win than it takes for a loss.
 */
export function soloTrophiesLost(level: BotLevel): number {
  return Math.floor(soloTrophiesFor(level) / 2);
}

/**
 * The most a day of playing the computer may add, or 0 for no ceiling at all.
 *
 * It was about five hard wins — enough that an evening alone moves you, not
 * enough to be a way up the ladder. That is the right shape for a ladder with
 * people on it, and the wrong one for a ladder with two.
 *
 * Or: *"give me unlimited trophies against the bot too. There are not enough
 * users right now to limit it."* So the default is OFF, and it is one dial in
 * the admin panel — the day there are strangers on the board he turns it back
 * on without a deploy. Nothing else about the ceiling was removed: the code
 * below still works, still has its tests, and is one number from being live.
 */
export function soloTrophyCap(): number {
  return TUNED.soloTrophiesPerDay;
}

/**
 * How much of a claimed daily total is actually payable.
 *
 * `already` is what this player has had from the computer today. Returns what
 * to add, which is never negative and never takes the day past the ceiling.
 *
 * ⚠ ZERO MEANS NO CEILING, WHICH IS THE OPPOSITE OF WHAT IT USED TO MEAN. A
 * cap of 0 would otherwise read as "a day of playing the computer pays
 * nothing", which is a setting nobody would ever want and which the slider
 * could reach. "Off" is the only sane reading of a disabled limit.
 */
export function withinDailyCap(already: number, want: number): number {
  if (soloTrophyCap() <= 0) return Math.max(0, want);
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
 * ═══ THE MOST ENEMY CARDS THE GAME CAN LEGITIMATELY TAKE OFF A BOARD ═══
 *
 * The action deck holds five cards, and the ones that reach across the
 * midline — the Radioactive Eraser and the Thief — take one each. The
 * freeze-the-placing effect the code still supports takes two. So five of
 * the worst case is ten, and anything past that is not a card being played.
 */
export const MOST_REMOVABLE = 10;

/**
 * The setting to PAY for: what the browser said, capped by what the board can
 * support. Nobody lies downward, so a claim of "easy" is simply believed.
 *
 * ═══ AND THE BOARD IS COUNTED AS IT WAS DEALT, NOT AS IT ARRIVED ═══
 *
 * Or, 22 November 2026: *"I had a bug just now — I beat the HARD bot and it
 * told me you do not get trophies against the easy bot."*
 *
 * He had, and the sentence was the smaller half of it: the match paid
 * nothing. The hard bot plans thirteen cards and this floor is twelve, so
 * there is exactly ONE card of slack — and the Eraser and the Thief each
 * take one off that board, with the empty cell refilled by a Crumb Demon
 * that `realCards` deliberately does not count. Two enemy-targeted action
 * cards in one match, which is a normal hand and exactly what he had been
 * testing all evening, and a won hard match is scored as the easy bot:
 * zero trophies, zero nachos, and a line of copy explaining a setting he
 * had not chosen.
 *
 * So the count that matters is how many the board STARTED with, and
 * `removed` carries the difference. It is the browser's word, clamped to
 * what an action deck can actually do — and it is worth being clear about
 * what that costs, because this file's whole job is not trusting the
 * browser: a forged request can now claim ten removals and send a board
 * ten cards thinner than a real one.
 *
 * What makes that acceptable is the comparison. The battle is still
 * replayed and a claimed win that the replay scores as a loss still pays
 * nothing, so the forgery buys an EASIER match at the same rate — not a
 * free one. Weighed against it: every honest player who uses the two cards
 * the game dealt them is paid zero and told something untrue. That is a
 * real child on a real evening, and the cheat is a stranger who would have
 * to rewrite the request anyway.
 */
export function payableLevel(claimed: BotLevel, cards: number, removed = 0): BotLevel {
  if (claimed === "easy") return "easy";
  // ⚠ NaN GUARDED FIRST. It arrives from `Number(body.removedFoeCards)` on a
  // request that did not send one, every comparison against it is false, and
  // without this line a board of thirteen becomes NaN and is paid as easy —
  // which is the bug this function was just fixed for, reintroduced by the
  // fix. Found by the test, on the value an older client sends.
  const took = Number.isFinite(removed) ? Math.max(0, Math.floor(removed)) : 0;
  const dealt = cards + Math.min(took, MOST_REMOVABLE);
  return boardLooksReal(dealt) ? claimed : "easy";
}
