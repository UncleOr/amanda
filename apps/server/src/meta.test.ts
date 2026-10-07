import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NACHOS_PER_CHEST, type MatchFacts } from "@amanda/shared";
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
  players?: Record<string, { nachos?: number; nacho_chests?: number; diamonds?: number }>;
  challenges?: Row[];
  cards?: Row[];
}) {
  const players: Record<string, Row> = {};
  for (const [id, p] of Object.entries(seed.players ?? {}))
    players[id] = { nachos: 0, nacho_chests: 0, diamonds: 0, ...p };
  const challenges: Row[] = [...(seed.challenges ?? [])];
  const chests: Row[] = [];
  const cards: Row[] = [...(seed.cards ?? [])];

  function table(name: string) {
    const filters: Array<(r: Row) => boolean> = [];
    const api: Record<string, unknown> = {};
    const chain = () => api;

    api.select = chain;
    api.order = chain;
    api.or = chain;
    api.not = chain;
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

  return { sb: { from: table } as unknown as SupabaseClient, state: { players, challenges, chests } };
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

describe("nachos", () => {
  it("pays by the grade, and a collapse pays nothing", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: {} } });
    expect((await awardMatch(sb, ME, facts({ score: 10 }), DAY)).nachos).toBe(3);
    expect((await awardMatch(sb, ME, facts({ score: 1 }), DAY)).nachos).toBe(0);
    expect(state.players[ME]!.nachos).toBe(3);
  });

  it("mints a chest when the bar fills, and not before", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { nachos: NACHOS_PER_CHEST - 3, nacho_chests: 0 } },
    });
    // Two short of the line: still nothing.
    expect((await awardMatch(sb, ME, facts({ score: 5 }), DAY)).chests).toEqual([]);
    expect(state.chests).toHaveLength(0);
    // And over it.
    expect((await awardMatch(sb, ME, facts({ score: 10 }), DAY)).chests).toEqual(["wood"]);
    expect(state.chests).toHaveLength(1);
    expect(state.chests[0]!.opened_at).toBeNull();
  });

  /*
   * The guard this test exists for: the count of chests PAID is kept beside
   * the lifetime count, so the second match after a chest does not look at
   * `nachos / 5` and conclude that one is owed all over again.
   */
  it("does not mint the same chest twice", async () => {
    const { sb, state } = fakeDb({
      players: { [ME]: { nachos: NACHOS_PER_CHEST, nacho_chests: 1 } },
    });
    // The bar is at zero, so it takes a full bar's worth to fill it again —
    // one nacho a match, NACHOS_PER_CHEST matches, exactly one chest.
    for (let i = 0; i < NACHOS_PER_CHEST; i++) await awardMatch(sb, ME, facts({ score: 4 }), DAY);
    expect(state.players[ME]!.nachos).toBe(NACHOS_PER_CHEST * 2);
    expect(state.chests).toHaveLength(1);
  });

  it("hands over every chest at once when several were filled", async () => {
    const { sb, state } = fakeDb({ players: { [ME]: {} } });
    // A reward big enough to fill more than one bar in a single go.
    await awardMatch(sb, ME, facts({ score: 10 }), DAY);
    const { sb: sb2, state: s2 } = fakeDb({
      players: { [ME]: { nachos: NACHOS_PER_CHEST * 4 - 1, nacho_chests: 1 } },
    });
    await awardMatch(sb2, ME, facts({ score: 10 }), DAY);
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
