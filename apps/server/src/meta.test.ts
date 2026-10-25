import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NACHOS_PER_CHEST, TUNED, type MatchFacts } from "@amanda/shared";
import { awardMatch, claim, liveChallenges, standings } from "./meta.js";

/**
 * The three things here that cannot be allowed to be wrong.
 *
 *   A CHEST IS NOT MINTED TWICE. The nacho bar fills on a schedule nobody
 *   controls, and the count and the chest are two writes. If the second match
 *   after a crash re-mints the chest the first one already gave, the bar stops
 *   meaning anything.
 *
 *   A REWARD IS NOT CLAIMED TWICE. Two taps on a slow connection are two
 *   requests, and this one pays diamonds.
 *
 *   A CHALLENGE THAT IS NOT LIVE PAYS NOTHING. The id is computed from the
 *   date, so yesterday's id is a perfectly well-formed string that a client
 *   can send today.
 *
 * All three are properties of the code rather than of Postgres, so they are
 * testable against a stand-in — as long as the stand-in models the one thing
 * they turn on, which is that a filtered update only matches rows that still
 * satisfy the filter.
 */

interface Row {
  [k: string]: unknown;
}

/**
 * A small stand-in for supabase-js, modelling `eq`, `in`, `is`, `update`,
 * `upsert` and `insert` over four tables.
 *
 * Like the shop's, the update is applied LAZILY — supabase-js attaches the
 * filters after `.update()`, so a stub that wrote immediately would write to
 * every row and make the double-claim test pass while the guard did nothing.
 */
function fakeDb(seed: {
  players?: Record<
    string,
    {
      nachos?: number;
      nacho_chests?: number;
      diamonds?: number;
      trophies?: number;
      best_trophies?: number;
      solo_day?: string | null;
      solo_trophies?: number;
    }
  >;
  challenges?: Row[];
  cards?: Row[];
  /** `{ player_id, friend_id, status }` rows, as the real table holds them. */
  friends?: Row[];
}) {
  const players: Record<string, Row> = {};
  for (const [id, p] of Object.entries(seed.players ?? {}))
    players[id] = {
      nachos: 0,
      nacho_chests: 0,
      diamonds: 0,
      trophies: 0,
      best_trophies: 0,
      solo_day: null,
      solo_trophies: 0,
      ...p,
    };
  const challenges: Row[] = [...(seed.challenges ?? [])];
  const chests: Row[] = [];
  const cards: Row[] = [...(seed.cards ?? [])];
  const friends: Row[] = [...(seed.friends ?? [])];

  function table(name: string) {
    const filters: Array<(r: Row) => boolean> = [];
    const api: Record<string, unknown> = {};
    const chain = () => api;

    api.select = chain;
    api.order = chain;
    api.limit = chain;
    api.not = chain;
    /*
     * `.or()` is ignored everywhere except `friends`, and the exception is
     * the point.
     *
     * A friendship is stored one way round, so the lookup asks for both —
     * `and(player_id.eq.me,friend_id.eq.them),and(player_id.eq.them,...)`.
     * A stub that waved that through would pass a query that matched every
     * friendship in the table, which is exactly the bug worth catching here:
     * it would make strangers into friends and pay nachos for losing to
     * them. So for this one table the filter is really applied.
     *
     * Everywhere else it stays a no-op, because the tests that rely on it
     * are about the filtered UPDATE and nothing turns on the or-clause.
     */
    api.or = (clause: string) => {
      if (name === "friends") filters.push(matchesOr(clause));
      return api;
    };
    api.lte = chain;
    api.gte = chain;
    api.eq = (col: string, val: unknown) => {
      filters.push((r) => r[col] === val);
      return api;
    };
    api.in = (col: string, vals: unknown[]) => {
      filters.push((r) => vals.includes(r[col]));
      return api;
    };
    api.is = (col: string, val: unknown) => {
      filters.push((r) => (val === null ? r[col] == null : r[col] === val));
      return api;
    };

    const rowsOf = (): Row[] => {
      if (name === "players") return Object.entries(players).map(([id, p]) => ({ id, ...p }));
      if (name === "player_challenges") return challenges;
      if (name === "chests") return chests;
      if (name === "player_cards") return cards;
      if (name === "friends") return friends;
      return [];
    };
    const matching = () => rowsOf().filter((r) => filters.every((f) => f(r)));

    /*
     * Reads hand back a COPY, which is not a detail.
     *
     * Handing back the live object made the raced-claim test pass with the
     * guard removed: the second claim's `row` was the same object the first
     * claim had just written `claimed_at` onto, so it bailed out at the read
     * instead of reaching the update. Postgres gives a caller a snapshot, and
     * the whole point of the guard is what happens when two callers hold the
     * same stale one.
     */
    const copy = (r: Row) => ({ ...r });
    api.maybeSingle = () => Promise.resolve({ data: matching().map(copy)[0] ?? null });
    api.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: matching().map(copy), count: matching().length, error: null });

    api.update = (patch: Row) => {
      const u = { ...api } as Record<string, unknown>;
      let done = false;
      const apply = () => {
        if (done) return [] as Row[];
        done = true;
        const hit = matching();
        for (const row of hit) {
          if (name === "players" && typeof row.id === "string")
            Object.assign(players[row.id]!, patch);
          else Object.assign(row, patch);
        }
        return hit;
      };
      for (const key of ["eq", "in", "is"] as const) {
        const original = api[key] as (...a: unknown[]) => unknown;
        u[key] = (...a: unknown[]) => {
          original(...a);
          return u;
        };
      }
      u.select = () => Promise.resolve({ data: apply(), error: null });
      u.then = (resolve: (v: unknown) => unknown) => {
        apply();
        return resolve({ data: null, error: null });
      };
      return u;
    };

    api.insert = (row: Row) => {
      if (name === "chests") chests.push(row);
      return Promise.resolve({ error: null });
    };
    api.upsert = (rows: unknown) => {
      for (const r of (Array.isArray(rows) ? rows : [rows]) as Row[]) {
        if (name !== "player_challenges") continue;
        const i = challenges.findIndex(
          (c) => c.player_id === r.player_id && c.challenge_id === r.challenge_id,
        );
        if (i >= 0) challenges[i] = { ...challenges[i], ...r };
        else challenges.push({ ...r });
      }
      return Promise.resolve({ error: null });
    };
    return api;
  }

  return {
    sb: { from: table } as unknown as SupabaseClient,
    state: { players, challenges, chests, friends },
  };
}

/**
 * Enough of PostgREST's `or=` grammar to mean what the friends lookup means:
 * a comma-separated list of `col.eq.value` terms and `and(...)` groups, where
 * a row matches if it satisfies ANY term.
 *
 * Splitting on top-level commas only — `and(a.eq.1,b.eq.2)` is one term, not
 * two, and a split that does not know that turns an AND into an OR and makes
 * the test pass for the wrong reason.
 */
function matchesOr(clause: string): (r: Row) => boolean {
  const terms: string[] = [];
  let depth = 0;
  let at = 0;
  for (let i = 0; i <= clause.length; i++) {
    const c = clause[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (i === clause.length || (c === "," && depth === 0)) {
      terms.push(clause.slice(at, i));
      at = i + 1;
    }
  }
  const one = (term: string) => {
    const [col, op, ...rest] = term.split(".");
    if (op !== "eq") throw new Error("fakeDb only knows eq in or(): " + term);
    const want = rest.join(".");
    return (r: Row) => String(r[col!]) === want;
  };
  const tests = terms.map((term) => {
    const group = /^and\((.*)\)$/s.exec(term.trim());
    if (!group) return one(term.trim());
    const inner = group[1]!.split(",").map((t) => one(t.trim()));
    return (r: Row) => inner.every((f) => f(r));
  });
  return (r) => tests.some((f) => f(r));
}

const ME = "player-1";
const DAY = new Date("2026-10-07T12:00:00Z");

const facts = (over: Partial<MatchFacts> = {}): MatchFacts => ({
  won: true,
  score: 10,
  cardIds: [],
  frontSeries: [],
  backSeries: [],
  ...over,
});

/*
 * ═══ PAID FOR WHO YOU PLAYED, NOT FOR HOW WELL ═══
 *
 * These tests used to read `facts({ score: 10 })` and expect three, because
 * nachos were paid off the 1-10 grade. Or replaced that rule — *"a match
 * against the easy bot gives no nachos. A win against the medium bot — 2. A
 * win against the hard bot or a friend — 3. A loss to a friend — one"* — and
 * the replacement sat in shared, exported and never called, while the old
 * rule carried on paying. The score is now irrelevant here, so it is gone
 * from every case below rather than left in looking meaningful.
 */
describe("nachos", () => {
  it("pays by the opponent, and nothing at all for the easy bot", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: {} } });
    expect((await awardMatch(sb, ME, facts(), DAY, "hard")).nachos).toBe(3);
    expect((await awardMatch(sb, ME, facts(), DAY, "normal")).nachos).toBe(2);
    expect((await awardMatch(sb, ME, facts({ score: 10 }), DAY, "easy")).nachos).toBe(0);
    expect(state.players[ME]!.nachos).toBe(5);
  });

  it("pays nothing for losing to a machine, however close it was", async () => {
    const { sb } = fakeDb({ players: { [ME]: {} } });
    for (const level of ["easy", "normal", "hard"] as const) {
      expect((await awardMatch(sb, ME, facts({ won: false, score: 9 }), DAY, level)).nachos).toBe(0);
    }
  });

  /*
   * The one rule in the whole economy that pays for losing, and the reason
   * `awardMatch` takes an opponent id at all. Or: *"a loss to a friend — one
   * nacho. At this stage I want to encourage games against friends."*
   */
  it("pays a nacho for losing to a friend, and nothing for losing to a stranger", async () => {
    const mate = "00000000-0000-4000-8000-0000000000ff";
    const friends = fakeDb({
      players: { [ME]: {} },
      friends: [{ player_id: ME, friend_id: mate, status: "accepted" }],
    });
    expect((await awardMatch(friends.sb, ME, facts({ won: false }), DAY, undefined, mate)).nachos)
      .toBe(1);

    const nobody = fakeDb({ players: { [ME]: {} } });
    expect((await awardMatch(nobody.sb, ME, facts({ won: false }), DAY, undefined, mate)).nachos)
      .toBe(0);
  });

  /*
   * A friendship that has been ASKED for is not a friendship.
   *
   * A mutation found this: dropping `.eq("status", "accepted")` from the
   * lookup broke nothing, which meant an unanswered request paid the friend
   * rate. It is a small sum, but it is a sum anybody can mint — send a
   * request to a stranger, never wait for an answer, and every loss to them
   * is worth a nacho. The `friends` table holds a pending row from the
   * moment somebody asks, so this is the only thing standing between those
   * two cases.
   */
  it("does not count a friend request that has not been accepted", async () => {
    const mate = "00000000-0000-4000-8000-0000000000ff";
    for (const pending of [
      { player_id: ME, friend_id: mate, status: "pending" },
      { player_id: mate, friend_id: ME, status: "pending" },
    ]) {
      const { sb } = fakeDb({ players: { [ME]: {} }, friends: [pending] });
      expect((await awardMatch(sb, ME, facts({ won: false }), DAY, undefined, mate)).nachos)
        .toBe(0);
    }
  });

  it("mints a chest when the bar fills, and not before", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { nachos: NACHOS_PER_CHEST - 3, nacho_chests: 0 } },
    });
    // Two short of the line: still nothing.
    expect((await awardMatch(sb, ME, facts(), DAY, "normal")).chests).toEqual([]);
    expect(state.chests).toHaveLength(0);
    // And over it.
    expect((await awardMatch(sb, ME, facts(), DAY, "hard")).chests).toEqual(["wood"]);
    expect(state.chests).toHaveLength(1);
    expect(state.chests[0]!.opened_at).toBeNull();
  });

  /*
   * The guard this test exists for: the count of chests PAID is kept beside
   * the lifetime count, so the second match after a chest does not look at
   * `nachos / 5` and conclude that one is owed all over again.
   */
  it("does not mint the same chest twice", async () => {
    const mate = "00000000-0000-4000-8000-0000000000ff";
    const { sb, state } = fakeDb({
      players: { [ME]: { nachos: NACHOS_PER_CHEST, nacho_chests: 1 } },
      friends: [{ player_id: mate, friend_id: ME, status: "accepted" }],
    });
    /*
     * The bar is at zero, so it takes a full bar's worth to fill it again.
     * A loss to a friend is the only match that pays exactly one, which
     * makes it the only way to walk the bar up a nacho at a time.
     */
    for (let i = 0; i < NACHOS_PER_CHEST; i++)
      await awardMatch(sb, ME, facts({ won: false }), DAY, undefined, mate);
    expect(state.players[ME]!.nachos).toBe(NACHOS_PER_CHEST * 2);
    expect(state.chests).toHaveLength(1);
  });

  it("hands over every chest at once when several were filled", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: {} } });
    // A reward big enough to fill more than one bar in a single go.
    await awardMatch(sb, ME, facts(), DAY, "hard");
    const { sb: sb2, state: s2 } = fakeDb({
      players: { [ME]: { nachos: NACHOS_PER_CHEST * 4 - 1, nacho_chests: 1 } },
    });
    await awardMatch(sb2, ME, facts(), DAY, "hard");
    expect(s2.chests.length).toBe(3);
    expect(state.chests.length).toBeLessThanOrEqual(1);
  });
});

describe("challenges", () => {
  it("moves the ones this match satisfied, and caps them at the goal", async () => {
    const { sb } = fakeDb({ players: { [ME]: {} } });
    const playing = liveChallenges(DAY).find((c) => c.goal.kind === "play");
    if (!playing) return; // no "play N matches" live today; nothing to assert
    for (let i = 0; i < playing.need + 5; i++)
      await awardMatch(sb, ME, facts({ score: 4 }), DAY);
    const now = await standings(sb, ME, DAY);
    const mine = now.find((c) => c.id === playing.id)!;
    expect(mine.progress).toBe(playing.need);
    expect(mine.done).toBe(true);
  });

  it("shows a guest the same challenges, at zero", async () => {
    const { sb } = fakeDb({});
    const guest = await standings(sb, null, DAY);
    expect(guest).toHaveLength(6);
    expect(guest.every((c) => c.progress === 0 && !c.claimed)).toBe(true);
  });

  it("refuses to pay for one that is not finished", async () => {
    const { sb } = fakeDb({ players: { [ME]: {} } });
    const one = liveChallenges(DAY)[0]!;
    expect(await claim(sb, ME, one.id, DAY)).toEqual({ ok: false, why: "notDone" });
  });

  it("refuses an id that is not live today", async () => {
    const { sb } = fakeDb({ players: { [ME]: {} } });
    const yesterday = liveChallenges(new Date("2026-10-06T12:00:00Z"))[0]!;
    const result = await claim(sb, ME, yesterday.id, DAY);
    expect(result).toEqual({ ok: false, why: "expired" });
  });

  /*
   * ═══ THE CHEST A CHALLENGE FILLED, SAID OUT LOUD ═══
   *
   * Or: *"I just got a fifth nacho, the nachos reset, but I didn't get a
   * chest."* It HAD been minted — this is from his own row, where the silver
   * chest's `earned_at` is the same tenth of a second as the claim. `claim`
   * called addNachos and dropped the answer, so the only thing that reached
   * the screen was the reward printed on the challenge, which can say "3
   * nachos" and cannot say "and the chest those three just paid for".
   *
   * The assertion that matters is the RETURNED list, not the table: the row
   * was always written correctly, and a test that only checked the table
   * would have passed throughout the bug.
   */
  it("hands back the chest its nachos filled", async () => {
    const one = liveChallenges(DAY).find((c) => c.reward.nachos)!;
    const { sb, state } = fakeDb({
      players: { [ME]: { nachos: NACHOS_PER_CHEST - one.reward.nachos!, nacho_chests: 0 } },
      challenges: [{ player_id: ME, challenge_id: one.id, progress: one.need, claimed_at: null }],
    });
    const paid = await claim(sb, ME, one.id, DAY);
    expect(paid.ok).toBe(true);
    expect(paid.ok && paid.chests).toEqual(["wood"]);
    expect(state.chests).toHaveLength(1);
  });

  it("says nothing about chests when the bar did not fill", async () => {
    const one = liveChallenges(DAY).find((c) => c.reward.nachos)!;
    const { sb } = fakeDb({
      players: { [ME]: { nachos: 0, nacho_chests: 0 } },
      challenges: [{ player_id: ME, challenge_id: one.id, progress: one.need, claimed_at: null }],
    });
    const paid = await claim(sb, ME, one.id, DAY);
    expect(paid.ok && paid.chests).toEqual([]);
  });

  it("pays once, and the second tap pays nothing", async () => {
    const one = liveChallenges(DAY).find((c) => c.reward.diamonds)!;
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 0 } },
      challenges: [
        { player_id: ME, challenge_id: one.id, progress: one.need, claimed_at: null },
      ],
    });
    const first = await claim(sb, ME, one.id, DAY);
    expect(first.ok).toBe(true);
    expect(state.players[ME]!.diamonds).toBe(one.reward.diamonds);

    const second = await claim(sb, ME, one.id, DAY);
    expect(second).toEqual({ ok: false, why: "claimed" });
    expect(state.players[ME]!.diamonds).toBe(one.reward.diamonds);
  });

  /*
   * The same thing, but RACED — which is the case the `.is("claimed_at", null)`
   * on the update exists for. Sequentially, the read above the update catches
   * it; two requests in flight at once both read null and both get past that
   * read, and only the filtered update can tell them apart. Removing that one
   * clause makes this test pay out twice and leaves the test above green.
   */
  it("pays once when both taps are in the air at the same time", async () => {
    const one = liveChallenges(DAY).find((c) => c.reward.diamonds)!;
    const { sb, state } = fakeDb({
      players: { [ME]: { diamonds: 0 } },
      challenges: [{ player_id: ME, challenge_id: one.id, progress: one.need, claimed_at: null }],
    });
    const both = await Promise.all([
      claim(sb, ME, one.id, DAY),
      claim(sb, ME, one.id, DAY),
    ]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(state.players[ME]!.diamonds).toBe(one.reward.diamonds);
  });
});

/**
 * ═══ BEATING THE COMPUTER ═══
 *
 * Or asked for trophies from the bot because "in the early days there will
 * not be enough players to make progress from 1v1 alone". The two things that
 * have to hold for that not to turn the arena ladder into a clock are the
 * ceiling and the zero, and both are here.
 */
describe("trophies from the computer", () => {
  /*
   * This one caught a real bug when trophiesFor() was written, and it is
   * worth saying which: the first version read `base + scoreBonus(...)`,
   * so a 10/10 against the setting that pays nothing paid 2. The bonus had
   * been added before anything asked whether this match counts at all.
   * "However well it went" is in the name because that is the half that
   * broke.
   */
  it("pays nothing for the easy bot, however well it went", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: {} } });
    const got = await awardMatch(sb, ME, facts({ score: 10 }), DAY, "easy");
    expect(got.trophies).toBe(0);
    expect(state.players[ME]!.trophies).toBe(0);
    // ...and the easy bot pays no nachos either, which is the other half of
    // "it does not move anything": it is the setting you learn on.
    expect(got.nachos).toBe(0);
  });

  it("pays more for the hard bot than the ordinary one", async () => {
    const one = fakeDb({ players: { [ME]: {} } });
    const two = fakeDb({ players: { [ME]: {} } });
    const normal = await awardMatch(one.sb, ME, facts(), DAY, "normal");
    const hard = await awardMatch(two.sb, ME, facts(), DAY, "hard");
    // facts() is a 10/10, so both carry the bonus for playing well — halved
    // against a machine, because a high score against a generated board
    // measures the generator as much as the player.
    const bonus = Math.floor((10 - TUNED.trophyScoreFrom) * TUNED.trophiesPerScorePoint / 2);
    expect(normal.trophies).toBe(TUNED.soloTrophiesNormal + bonus);
    expect(hard.trophies).toBe(TUNED.soloTrophiesHard + bonus);
    expect(hard.trophies).toBeGreaterThan(normal.trophies);
  });

  /*
   * ═══ A LADDER YOU CAN ONLY CLIMB IS A COUNTER ═══
   *
   * This used to assert that losing to the computer cost nothing, and the
   * argument was sound: nobody wins anything when the machine does, and a
   * seven-year-old who tries the hard bot twice and drops forty trophies has
   * been taught to stop trying it.
   *
   * Or: *"if I lose I should lose some trophies (not as many as you earn for
   * a win, but still some) — that way it's also possible to go DOWN
   * arenas."* The half I had not weighed. So it costs half of what the same
   * bot pays, and these three cases are what "half, and gently" means.
   */
  it("costs half of what the same bot pays for a win", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { trophies: 100 } } });
    const got = await awardMatch(sb, ME, facts({ won: false, score: 4 }), DAY, "hard");
    /*
     * The fall is RETURNED, not just written.
     *
     * It used to return 0 here and quietly subtract, which meant the result
     * screen could not tell a loss that cost six trophies from a loss that
     * cost nothing. Or asked to be able to go down arenas; a drop nobody is
     * shown is a drop that reads as a bug the next time the arena changes.
     */
    expect(got.trophies).toBe(-Math.floor(TUNED.soloTrophiesHard / 2));
    expect(state.players[ME]!.trophies).toBe(100 - Math.floor(TUNED.soloTrophiesHard / 2));
  });

  it("costs nothing for the easy bot, which pays nothing either", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { trophies: 100 } } });
    await awardMatch(sb, ME, facts({ won: false, score: 4 }), DAY, "easy");
    expect(state.players[ME]!.trophies).toBe(100);
  });

  it("never pushes a new player below zero", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { trophies: 2 } } });
    await awardMatch(sb, ME, facts({ won: false, score: 4 }), DAY, "hard");
    expect(state.players[ME]!.trophies).toBe(0);
  });

  /*
   * ═══ THIS TEST USED TO ASSERT THE OPPOSITE ═══
   *
   * It was called "pays nothing at all for a match against a person — the
   * match server did that", and it was true: recordMatch in progress.ts
   * paid a flat +30 / −20 and this function stayed out of it.
   *
   * Two functions answering "what did this match do to my trophies" is how
   * a win against a person ended up worth the same whether it was a rout or
   * a coin toss — the score never reached the code that paid. There is one
   * answer now (trophiesFor) and one caller, and recordMatch only READS the
   * pile. So the assertion flips with the rule.
   */
  it("pays for a match against a person, and pays more than any bot", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: {} } });
    const got = await awardMatch(sb, ME, facts(), DAY);
    const full = (10 - TUNED.trophyScoreFrom) * TUNED.trophiesPerScorePoint;
    expect(got.trophies).toBe(TUNED.trophiesPerWin + full);
    expect(state.players[ME]!.trophies).toBe(TUNED.trophiesPerWin + full);
    // A person is worth more than the hardest setting of the machine, which
    // is the whole reason the ladder means anything.
    expect(got.trophies).toBeGreaterThan(TUNED.soloTrophiesHard);
  });

  it("takes trophies for a loss to a person, and does not cap the fall", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { trophies: 100 } } });
    const got = await awardMatch(sb, ME, facts({ won: false, score: 3 }), DAY);
    expect(got.trophies).toBe(-TUNED.trophiesPerLoss);
    expect(state.players[ME]!.trophies).toBe(100 - TUNED.trophiesPerLoss);
    // Smaller than a win, so an evening of playing moves forward on balance.
    expect(TUNED.trophiesPerLoss).toBeLessThan(TUNED.trophiesPerWin);
  });

  it("stops at the day's ceiling, and says that is why", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: {} } });
    let paid = 0;
    // Far more wins than the ceiling can possibly cover.
    for (let i = 0; i < 40; i++) {
      const got = await awardMatch(sb, ME, facts(), DAY, "hard");
      paid += got.trophies;
    }
    expect(paid).toBe(TUNED.soloTrophiesPerDay);
    expect(state.players[ME]!.trophies).toBe(TUNED.soloTrophiesPerDay);
    // The last one of those was trimmed, and the screen is told so.
    const after = await awardMatch(sb, ME, facts(), DAY, "hard");
    expect(after.trophies).toBe(0);
    expect(after.cappedOut).toBe(true);
    // And the rest of the loop is untouched by the ceiling — a hard-bot win
    // is three nachos whether or not the trophies were trimmed.
    expect(after.nachos).toBe(3);
  });

  it("starts again tomorrow, without anything having to clear it", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: {} } });
    for (let i = 0; i < 40; i++) await awardMatch(sb, ME, facts(), DAY, "hard");
    expect(state.players[ME]!.solo_trophies).toBe(TUNED.soloTrophiesPerDay);

    const tomorrow = new Date("2026-10-08T12:00:00Z");
    const bonus = Math.floor((10 - TUNED.trophyScoreFrom) * TUNED.trophiesPerScorePoint / 2);
    const fresh = await awardMatch(sb, ME, facts(), tomorrow, "hard");
    expect(fresh.trophies).toBe(TUNED.soloTrophiesHard + bonus);
    // Yesterday's counter was never cleared — it was simply not read.
    expect(state.players[ME]!.solo_day).toBe("2026-10-08");
    expect(state.players[ME]!.solo_trophies).toBe(TUNED.soloTrophiesHard + bonus);
  });

  it("carries the best-ever mark up with it", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: { trophies: 90, best_trophies: 90 } } });
    const bonus = Math.floor((10 - TUNED.trophyScoreFrom) * TUNED.trophiesPerScorePoint / 2);
    await awardMatch(sb, ME, facts(), DAY, "hard");
    expect(state.players[ME]!.best_trophies).toBe(90 + TUNED.soloTrophiesHard + bonus);
  });
});
