import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aboutPlayer, overview } from "./stats.js";

/**
 * The statistics screen, against known events.
 *
 * Or asked for *"lots of information and statistics"*, and a wrong statistic
 * is worse than a missing one: nobody checks a number on a dashboard, they
 * act on it. The two that would cost the most to get wrong are the ones most
 * easily got wrong, so both are pinned here —
 *
 *   THE WIN RATE, which is wins over MATCHES and not over events. Counting a
 *     quit or a chest in that denominator makes a game look harder than it is
 *     and would send Or tuning the bot down for no reason.
 *   THE QUIT RATE, which is quits over everything that was STARTED — the
 *     matches that finished plus the ones that did not. Over finished matches
 *     alone it can exceed 100%, which is not a rate at all.
 */
function fakeDb(events: Array<Record<string, unknown>>, players: Array<Record<string, unknown>>) {
  const table = (name: string) => {
    const api: Record<string, unknown> = {};
    const chain = () => api;
    for (const k of ["select", "order", "gte", "lte", "eq", "limit", "in", "is", "or", "not"])
      api[k] = chain;
    const rows = name === "events" ? events : name === "players" ? players : [];
    // The real client is a thenable that resolves to { data, error }.
    api.then = (resolve: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve);
    api.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    return api;
  };
  return { from: table } as unknown as SupabaseClient;
}

const NOW = new Date().toISOString();
const ev = (kind: string, data: Record<string, unknown> = {}, player = "p1") => ({
  player_id: player,
  kind,
  at: NOW,
  data,
});

describe("the overview", () => {
  it("counts wins and losses out of matches, not out of everything that happened", async () => {
    const r = (await overview(
      fakeDb(
        [
          ev("match", { mode: "bot", won: true, score: 8, cards: ["a", "b"] }),
          ev("match", { mode: "bot", won: false, score: 3, cards: ["a"] }),
          ev("match", { mode: "online", won: true, score: 9, cards: ["b"] }),
          // None of these are matches and none may reach the win rate.
          ev("open"),
          ev("chest", { cards: 3, fresh: 1 }),
          ev("buy", { item: "avatar.x", paid: 40 }),
        ],
        [{ id: "p1", created_at: NOW, nickname: "הוד", tutorial_done: true, diamonds: 5 }],
      ),
    )) as Record<string, Record<string, number>>;

    expect(r.play!.matches).toBe(3);
    expect(r.play!.wins).toBe(2);
    expect(r.play!.losses).toBe(1);
    expect(r.play!.winRate).toBe(67);
    expect(r.play!.vsBot).toBe(2);
    expect(r.play!.vsPeople).toBe(1);
  });

  /*
   * Two finished and two abandoned is half, not two-thirds and not 100%.
   * Measured against matches STARTED, which is the only denominator that
   * cannot produce a rate above 100.
   */
  it("measures abandonment against the matches that were started", async () => {
    const r = (await overview(
      fakeDb(
        [
          ev("match", { mode: "bot", won: true, score: 7, cards: [] }),
          ev("match", { mode: "bot", won: false, score: 2, cards: [] }),
          ev("quit", { phase: "build", mode: "bot" }),
          ev("quit", { phase: "build", mode: "online" }),
        ],
        [],
      ),
    )) as Record<string, Record<string, number | Array<{ id: string; n: number }>>>;

    expect(r.behaviour!.quits).toBe(2);
    expect(r.behaviour!.quitRate).toBe(50);
    expect(r.behaviour!.quitPhase).toEqual([{ id: "build", n: 2 }]);
  });

  it("does not divide by zero on a game nobody has played", async () => {
    const r = (await overview(fakeDb([], []))) as Record<string, Record<string, number>>;
    expect(r.play!.winRate).toBe(0);
    expect(r.behaviour!.quitRate).toBe(0);
    expect(r.play!.meanScore).toBe(0);
  });

  /*
   * The two taste lists have to be able to disagree. A card everybody plays
   * and nobody wins with is the thing this pair exists to show, so the
   * winners list must count only winning boards.
   */
  it("separates the cards that get played from the cards that win", async () => {
    const r = (await overview(
      fakeDb(
        [
          ev("match", { mode: "bot", won: false, score: 2, cards: ["loser", "loser"] }),
          ev("match", { mode: "bot", won: false, score: 2, cards: ["loser"] }),
          ev("match", { mode: "bot", won: true, score: 9, cards: ["winner"] }),
        ],
        [],
      ),
    )) as unknown as { taste: { played: Array<{ id: string; n: number }>; winners: Array<{ id: string; n: number }> } };

    expect(r.taste.played[0]).toMatchObject({ id: "loser", n: 3 });
    expect(r.taste.winners.map((c) => c.id)).toEqual(["winner"]);
  });
});

describe("one player", () => {
  it("counts their own matches, quits and spending", async () => {
    const r = (await aboutPlayer(
      fakeDb(
        [
          ev("match", { mode: "bot", won: true, score: 8, cards: ["x"] }),
          ev("match", { mode: "online", won: false, score: 4, cards: ["x", "y"] }),
          ev("quit", { phase: "battle" }),
          ev("playground", { cards: 4 }),
          ev("buy", { item: "phrase.goodluck", paid: 80 }),
          ev("open"),
        ],
        [{ id: "p1", nickname: "הוד" }],
      ),
      "p1",
    )) as unknown as Record<string, number | Array<{ id: string; n: number }>>;

    expect(r.matches).toBe(2);
    expect(r.wins).toBe(1);
    expect(r.losses).toBe(1);
    expect(r.winRate).toBe(50);
    expect(r.playground).toBe(1);
    expect(r.quits).toBe(1);
    expect(r.diamondsSpent).toBe(80);
    expect(r.opens).toBe(1);
  });
});
