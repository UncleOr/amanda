/**
 * **What one match does to your trophies.**
 *
 * Or, laying out the whole economy in one message:
 *
 * > *"Trophies — plus or minus, by win or loss. You should get more trophies
 * > if you win with a high score, and more trophies if you win against a
 * > person. But a loss takes trophies off you. It's a global variable per
 * > user."*
 *
 * ═══ WHY THIS FILE EXISTS AT ALL ═══
 *
 * Because it was two rules in two files that did not know about each other.
 * An online match was paid by `recordMatch` in progress.ts — a flat +30 for
 * the winner, −20 for the loser, and the score never entered into it. A bot
 * match was paid by `awardMatch` in meta.ts, from a different set of
 * numbers, under a daily ceiling the online path had never heard of.
 *
 * Two places that both answer "what did this match do to my trophies" is one
 * place too many: it is how a win against a person ended up worth the same
 * whether it was a rout or a coin toss, and it is why "more for a better
 * game" could not be added without writing it twice.
 *
 * So this is the only answer, and both callers ask it.
 *
 * ═══ THE SHAPE ═══
 *
 *     a person      win   30 + up to 5 for the score
 *                   loss  −20
 *     the hard bot  win   12 + up to 2
 *                   loss  −6
 *     the normal bot win   8 + up to 2
 *                   loss  −4
 *     the easy bot  win    0        loss  0
 *
 * **A person is worth more than the hardest bot** by a factor of about
 * three, which is the ordering Or asked for and the reason the ladder means
 * anything: the bot is always available and never surprised.
 *
 * **The score bonus starts at six.** `score` is the 1–10 grade the battle
 * report already computes, and five is an ordinary game — paying a bonus for
 * an ordinary game is paying a bonus for turning up. Only the part above
 * average earns, so a perfect 10 is worth five more against a person and the
 * median win is worth exactly the base.
 *
 * **The easy bot is zero in both directions.** It loses 83% of the time; a
 * ladder that moves on those matches is a ladder made of them.
 *
 * ═══ AND WHY A LOSS IS SMALLER THAN A WIN ═══
 *
 * So that an evening of playing moves forward on balance. Or asked for the
 * fall — *"that way it's also possible to go DOWN arenas"* — and a ladder
 * you can only climb is a counter, not a ladder. But a child who loses two
 * in a row should not be further back than when they started the evening.
 */
import { TUNED } from "./tunables.js";
// The one definition, from the file that already had it.
import type { BotLevel } from "./soloTrophies.js";

/** Who the match was against. A person is worth more than any machine. */
export type Opponent =
  | { kind: "bot"; level: BotLevel }
  | { kind: "friend" }
  | { kind: "stranger" };

/** What a win against this opponent is worth before the score is counted. */
function baseWin(opponent: Opponent): number {
  if (opponent.kind !== "bot") return TUNED.trophiesPerWin;
  if (opponent.level === "hard") return TUNED.soloTrophiesHard;
  if (opponent.level === "normal") return TUNED.soloTrophiesNormal;
  return 0;
}

/**
 * The extra for playing well, which only an above-average game earns.
 *
 * Halved against a machine for the same reason the base is: the opponent
 * board is generated, so a high score against it measures the generator as
 * much as the player.
 */
function scoreBonus(score: number, opponent: Opponent): number {
  if (!Number.isFinite(score)) return 0;
  const over = Math.max(0, Math.round(score) - TUNED.trophyScoreFrom);
  const full = over * TUNED.trophiesPerScorePoint;
  return opponent.kind === "bot" ? Math.floor(full / 2) : full;
}

/**
 * How many trophies this match is worth. Negative for a loss.
 *
 * The caller adds it to the player's pile and clamps at zero — a child who
 * has just started cannot go into debt.
 */
export function trophiesFor(opts: {
  won: boolean;
  /** The 1–10 grade for this player's side, from the battle report. */
  score: number;
  opponent: Opponent;
}): number {
  const { won, score, opponent } = opts;
  const base = baseWin(opponent);
  /*
   * The easy bot moves nothing in either direction, and the bonus does not
   * sneak past that.
   *
   * The test caught this: `base + scoreBonus(...)` paid 2 trophies for a
   * good game against the setting that pays nothing, because the bonus was
   * added before anybody asked whether this match counts at all. It loses
   * 83% of the time; a ladder that moves on those matches is a ladder made
   * of them.
   */
  if (base === 0) return 0;
  if (won) return base + scoreBonus(score, opponent);
  // Nothing is paid for a win against the easy bot, so nothing is taken for
  // a loss to it either — it is the setting you learn on.
  if (opponent.kind === "bot") return -Math.floor(base / 2);
  return -TUNED.trophiesPerLoss;
}
