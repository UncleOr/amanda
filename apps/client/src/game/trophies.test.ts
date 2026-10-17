/**
 * **Or's trophy spec, clause by clause.**
 *
 * He wrote the whole economy out in one message, and the trophy part was four
 * sentences:
 *
 * > *"Trophies — plus or minus, by win or loss. You should get more trophies
 * > if you win with a high score, and more trophies if you win against a
 * > person. But a loss takes trophies off you. It's a global variable per
 * > user."*
 *
 * Every `it` below is one of those clauses, named after it. That is the point
 * of this file: `trophiesFor` is now the ONLY place that answers "what did
 * this match do to my trophies", called from exactly one place (meta.ts), and
 * a single point of authority wants its rules pinned where they can be read
 * rather than inferred from a thirty-line function.
 *
 * meta.test.ts covers the plumbing — the daily ceiling, the floor at zero,
 * the high-water mark. This covers the arithmetic.
 */
import { describe, expect, it } from "vitest";
import { TUNED, trophiesFor, type Opponent } from "@amanda/shared";

const PERSON: Opponent = { kind: "stranger" };
const FRIEND: Opponent = { kind: "friend" };
const HARD: Opponent = { kind: "bot", level: "hard" };
const NORMAL: Opponent = { kind: "bot", level: "normal" };
const EASY: Opponent = { kind: "bot", level: "easy" };

/** An ordinary game, which is the grade the bonus measures from. */
const MIDDLING = TUNED.trophyScoreFrom;

const won = (opponent: Opponent, score = MIDDLING) =>
  trophiesFor({ won: true, score, opponent });
const lost = (opponent: Opponent, score = 3) =>
  trophiesFor({ won: false, score, opponent });

describe("plus or minus, by win or loss", () => {
  it("is positive for a win and negative for a loss", () => {
    for (const o of [PERSON, FRIEND, HARD, NORMAL]) {
      expect(won(o)).toBeGreaterThan(0);
      expect(lost(o)).toBeLessThan(0);
    }
  });

  it("takes less than it gives, so an evening moves forward on balance", () => {
    for (const o of [PERSON, FRIEND, HARD, NORMAL]) {
      expect(Math.abs(lost(o))).toBeLessThan(won(o));
    }
  });
});

describe("more if you win with a high score", () => {
  it("pays more for a 10 than for a 6", () => {
    expect(won(PERSON, 10)).toBeGreaterThan(won(PERSON, 6));
    expect(won(HARD, 10)).toBeGreaterThan(won(HARD, 6));
  });

  it("never pays less for a better game", () => {
    for (const o of [PERSON, HARD, NORMAL]) {
      for (let s = 1; s < 10; s++) {
        expect(won(o, s + 1)).toBeGreaterThanOrEqual(won(o, s));
      }
    }
  });

  /*
   * The bonus starts ABOVE average, and this is the clause that says why.
   *
   * `score` is the 1–10 grade the battle report already computes, and five is
   * an ordinary game. Paying a bonus for an ordinary game is paying a bonus
   * for turning up — the number goes up, the player notices nothing, and the
   * base rate has quietly moved instead. Only the part above average earns.
   */
  it("pays exactly the base for an ordinary game, and for a bad one", () => {
    expect(won(PERSON, MIDDLING)).toBe(TUNED.trophiesPerWin);
    expect(won(PERSON, 1)).toBe(TUNED.trophiesPerWin);
    expect(won(HARD, MIDDLING)).toBe(TUNED.soloTrophiesHard);
  });

  it("does not pay the bonus for a LOSS, however good the score was", () => {
    // You can lose a 9/10 — the opponent's board was simply better. It is
    // still a loss, and the fall is the same size as any other.
    expect(lost(PERSON, 9)).toBe(lost(PERSON, 1));
    expect(lost(HARD, 9)).toBe(lost(HARD, 1));
  });
});

describe("more if you win against a person", () => {
  it("beats the hardest setting of the machine, even at a perfect score", () => {
    expect(won(PERSON, MIDDLING)).toBeGreaterThan(won(HARD, 10));
  });

  it("treats a friend and a stranger alike — both are a person", () => {
    expect(won(FRIEND, 8)).toBe(won(PERSON, 8));
    expect(lost(FRIEND)).toBe(lost(PERSON));
  });

  /*
   * The bonus is halved against a machine for the same reason the base is:
   * the opponent board is generated, so a high score against it measures the
   * generator as much as it measures the player.
   */
  it("gives a person the full score bonus and a bot half of it", () => {
    const full = won(PERSON, 10) - won(PERSON, MIDDLING);
    const half = won(HARD, 10) - won(HARD, MIDDLING);
    expect(full).toBe((10 - MIDDLING) * TUNED.trophiesPerScorePoint);
    expect(half).toBe(Math.floor(full / 2));
  });

  it("ranks the three settings in the order they are named", () => {
    expect(won(HARD)).toBeGreaterThan(won(NORMAL));
    expect(won(NORMAL)).toBeGreaterThan(won(EASY));
  });
});

/*
 * ═══ THE EASY BOT IS ZERO IN BOTH DIRECTIONS ═══
 *
 * It loses 83% of the time; a ladder that moves on those matches is a ladder
 * made of them. And since nothing is paid for beating it, nothing is taken
 * for losing to it either — it is the setting you learn on.
 *
 * The first version of trophiesFor() read `base + scoreBonus(...)` and so
 * paid 2 trophies for a good game against it, because the bonus was added
 * before anything asked whether the match counted at all. meta.test.ts
 * caught it. These are the cases that keep it caught.
 */
describe("the easy bot, which does not move the ladder at all", () => {
  it("pays nothing for a win, at every single score", () => {
    for (let s = 1; s <= 10; s++) expect(won(EASY, s)).toBe(0);
  });

  it("costs nothing for a loss, at every single score", () => {
    for (let s = 1; s <= 10; s++) expect(lost(EASY, s)).toBe(0);
  });
});

describe("what it does with nonsense", () => {
  /*
   * `score` arrives from a battle report, and a battle that ended in a way
   * nobody foresaw can produce a NaN — a division by a total that was zero.
   * A NaN here would be written into the trophy column and the account would
   * be unrecoverable from the client, so it is worth one branch.
   */
  it("still pays the base when the score is not a number", () => {
    expect(trophiesFor({ won: true, score: NaN, opponent: PERSON })).toBe(
      TUNED.trophiesPerWin,
    );
    expect(trophiesFor({ won: true, score: Infinity, opponent: PERSON })).toBe(
      TUNED.trophiesPerWin,
    );
  });

  it("returns a whole number for every input it can be handed", () => {
    for (const o of [PERSON, FRIEND, HARD, NORMAL, EASY]) {
      for (let s = 0; s <= 11; s += 0.5) {
        for (const w of [true, false]) {
          const got = trophiesFor({ won: w, score: s, opponent: o });
          expect(Number.isInteger(got)).toBe(true);
        }
      }
    }
  });
});
