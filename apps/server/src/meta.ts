/**
 * The progression loop: nachos, chests they fill, and the daily challenges.
 *
 * Or: *"we have to create a situation where the player is always one or two
 * games away from some goal."* The two counters that do it live here, and both
 * of them are decided by this process from a battle it has in its hands —
 * never from a number a browser sent.
 *
 * ═══ WHY THE SERVER RE-RUNS A SOLO MATCH ═══
 *
 * Most of the playing in this game is against the bot, and that match is
 * simulated entirely in the browser — the server never sees it. Until now that
 * was fine, because a bot match was worth nothing. The moment it pays nachos
 * and moves a challenge along, "I won with a score of 9" becomes a sentence
 * worth lying about.
 *
 * So the client does not report an outcome. It reports the two boards and the
 * seed, and `factsFor` runs the same deterministic engine the real match uses
 * and reads the outcome off the result. The strongest thing a player can do by
 * hand is send a weak opponent board, which is why solo pays fewer trophies
 * (see SOLO_TROPHY_SHARE) and why the arena ladder stays mostly a thing you
 * climb against people.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  challengesFor,
  nachoChestKind,
  nachosForScore,
  progressFrom,
  type Challenge,
  type MatchFacts,
  type Pools,
  NACHOS_PER_CHEST,
} from "@amanda/shared";
import { buildReport, type BattleResult, type Placement } from "@amanda/engine";
import { CATALOG, SERIES_NAMES } from "./content.js";
import { rollChest } from "./progress.js";
import { db } from "./supabase.js";
import { deliver } from "./shop.js";

/** Side B is mirrored into the far half of the arena; x = 3 is the front row. */
const FRONT_X = 3;
const BACK_X = 0;

/**
 * The names a challenge may put in a sentence.
 *
 * Built once. The catalogue does not change while the process is up, and
 * `challengesFor` is called after every single match.
 */
const POOLS: Pools = {
  cards: [...CATALOG.values()]
    .filter((c) => c.id !== "crumb_demon" && c.launch)
    .map((c) => ({ id: c.id, he: c.name.he })),
  series: [...SERIES_NAMES].map(([id, he]) => ({ id, he })),
};

/** What is being asked of everybody today. */
export function liveChallenges(now: Date = new Date()): Challenge[] {
  return challengesFor(POOLS, now);
}

/**
 * Read one side's performance off a finished battle.
 *
 * `placements` is that side's own board as it was built, which is where the
 * row a card was put in comes from — the result knows where units ENDED UP,
 * and a challenge that says "put a Lions card in the front row" is about the
 * choice you made, not about where the thing had walked to by the end.
 */
export function factsFor(
  result: BattleResult,
  owner: "A" | "B",
  placements: Placement[],
): MatchFacts {
  const report = buildReport(result, CATALOG);
  const real = placements.filter((p) => p.cardId !== "crumb_demon");
  const seriesAt = (x: number) =>
    real
      .filter((p) => p.x === x)
      .map((p) => CATALOG.get(p.cardId)?.seriesId)
      .filter((s): s is string => Boolean(s));
  return {
    won: result.winner === owner,
    score: report.grades[owner].score,
    cardIds: real.map((p) => p.cardId),
    frontSeries: seriesAt(FRONT_X),
    backSeries: seriesAt(BACK_X),
  };
}

/** What one finished match gave a player, for the screen to celebrate. */
export interface MetaAward {
  nachos: number;
  /**
   * The lifetime count AFTER this match.
   *
   * Here rather than worked out by the screen, because the screen's copy of
   * the account is the one from before the match — the only number on it that
   * would be wrong. The bar is this modulo NACHOS_PER_CHEST.
   */
  total: number;
  /** Chests the nacho bar filled, as kinds. Usually none, sometimes one. */
  chests: string[];
  /** Challenges that moved, by id, with where they now stand. */
  moved: Array<{ id: string; progress: number; need: number; done: boolean }>;
}

const NONE: MetaAward = { nachos: 0, total: 0, chests: [], moved: [] };

/**
 * Pay out a finished match: nachos, any chest they filled, challenge progress.
 *
 * Deliberately NOT part of recordMatch. recordMatch is fire-and-forget and its
 * failures are logged and swallowed, which is right for trophies; this returns
 * what it gave so that the result screen can show it, and an online match
 * awaits it while a solo match's HTTP response waits for it.
 */
export async function awardMatch(
  sb: SupabaseClient,
  playerId: string,
  facts: MatchFacts,
  now: Date = new Date(),
): Promise<MetaAward> {
  try {
    const nachos = nachosForScore(facts.score);
    const { chests, total } = await addNachos(sb, playerId, nachos);
    const moved = await advanceChallenges(sb, playerId, facts, now);
    return { nachos, total, chests, moved };
  } catch (err) {
    // A match that finished matters more than a counter that did not move.
    console.error("[meta] could not award the match", err);
    return NONE;
  }
}

/**
 * The same thing for a caller that has no database client in its hand.
 *
 * The match server does not and should not: a match that finished matters more
 * than a row that did not save, so it hands this off and carries on, exactly
 * as it does with recordMatch.
 */
export function awardMeta(playerId: string, facts: MatchFacts): Promise<MetaAward> {
  const sb = db();
  return sb ? awardMatch(sb, playerId, facts) : Promise.resolve(NONE);
}

/**
 * Add to the lifetime count, and mint any chest the bar just filled.
 *
 * The bar is `nachos % NACHOS_PER_CHEST` and the chests already handed over
 * are counted separately, so changing the bar size changes what is DRAWN and
 * never what is OWED — see the migration.
 */
async function addNachos(
  sb: SupabaseClient,
  playerId: string,
  add: number,
): Promise<{ chests: string[]; total: number }> {
  const { data } = await sb
    .from("players")
    .select("nachos, nacho_chests")
    .eq("id", playerId)
    .maybeSingle();
  if (add <= 0) return { chests: [], total: data?.nachos ?? 0 };
  const nachos = (data?.nachos ?? 0) + add;
  const paid = data?.nacho_chests ?? 0;
  const earned = Math.floor(nachos / NACHOS_PER_CHEST);
  const owed = Math.max(0, earned - paid);

  const kinds: string[] = [];
  for (let i = 0; i < owed; i++) kinds.push(nachoChestKind(paid + i));
  /*
   * The count is written BEFORE the chests are handed over, and that order is
   * the idempotency. If this process dies halfway, the player is short a chest
   * — annoying, fixable, and visible in the logs. The other order would mint
   * the same chest on every match until the write succeeded.
   */
  await sb.from("players").update({ nachos, nacho_chests: paid + owed }).eq("id", playerId);
  for (const kind of kinds) {
    await sb.from("chests").insert({
      player_id: playerId,
      kind,
      opened_at: null,
      contents: rollChest(kind, await albumOf(sb, playerId)),
    });
  }
  return { chests: kinds, total: nachos };
}

/** Which cards this player already has, for weighting a chest towards copies. */
async function albumOf(sb: SupabaseClient, playerId: string): Promise<Set<string>> {
  const { data } = await sb.from("player_cards").select("card_id").eq("player_id", playerId);
  return new Set((data ?? []).map((r) => r.card_id as string));
}

/** Move every live challenge this match satisfied. */
async function advanceChallenges(
  sb: SupabaseClient,
  playerId: string,
  facts: MatchFacts,
  now: Date,
): Promise<MetaAward["moved"]> {
  const live = liveChallenges(now).filter((c) => progressFrom(c.goal, facts) > 0);
  if (!live.length) return [];

  const { data } = await sb
    .from("player_challenges")
    .select("challenge_id, progress")
    .eq("player_id", playerId)
    .in(
      "challenge_id",
      live.map((c) => c.id),
    );
  const at = new Map((data ?? []).map((r) => [r.challenge_id as string, r.progress as number]));

  const moved: MetaAward["moved"] = [];
  const rows = live.map((c) => {
    // Capped at `need`: a challenge that keeps counting past its goal would
    // show "7/3" on the screen and tempt somebody to pay out the difference.
    const progress = Math.min(c.need, (at.get(c.id) ?? 0) + 1);
    moved.push({ id: c.id, progress, need: c.need, done: progress >= c.need });
    return {
      player_id: playerId,
      challenge_id: c.id,
      progress,
      updated_at: now.toISOString(),
    };
  });
  await sb.from("player_challenges").upsert(rows, { onConflict: "player_id,challenge_id" });
  return moved;
}

/** One live challenge, with where this player stands on it. */
export interface ChallengeStanding extends Challenge {
  progress: number;
  done: boolean;
  claimed: boolean;
}

/** Everything live, and how far along this player is. */
export async function standings(
  sb: SupabaseClient,
  playerId: string | null,
  now: Date = new Date(),
): Promise<ChallengeStanding[]> {
  const live = liveChallenges(now);
  if (!playerId) return live.map((c) => ({ ...c, progress: 0, done: false, claimed: false }));
  const { data } = await sb
    .from("player_challenges")
    .select("challenge_id, progress, claimed_at")
    .eq("player_id", playerId)
    .in(
      "challenge_id",
      live.map((c) => c.id),
    );
  const rows = new Map((data ?? []).map((r) => [r.challenge_id as string, r]));
  return live.map((c) => {
    const row = rows.get(c.id);
    const progress = Math.min(c.need, row?.progress ?? 0);
    return { ...c, progress, done: progress >= c.need, claimed: Boolean(row?.claimed_at) };
  });
}

/**
 * Take the reward for a finished challenge.
 *
 * ═══ THE DOUBLE-CLAIM GUARD ═══
 *
 * The same shape as the shop's double-charge guard: the update says
 * `.is("claimed_at", null)` and the row is only paid out if that update
 * actually matched something. Two taps on a slow connection send two
 * requests; the second one changes no rows and pays nothing.
 */
export async function claim(
  sb: SupabaseClient,
  playerId: string,
  challengeId: string,
  now: Date = new Date(),
): Promise<{ ok: true; gave: Challenge["reward"] } | { ok: false; why: string }> {
  const challenge = liveChallenges(now).find((c) => c.id === challengeId);
  // Not live: either it has expired, or it was never real. Both are "no".
  if (!challenge) return { ok: false, why: "expired" };

  const { data: row } = await sb
    .from("player_challenges")
    .select("progress, claimed_at")
    .eq("player_id", playerId)
    .eq("challenge_id", challengeId)
    .maybeSingle();
  if (!row || (row.progress ?? 0) < challenge.need) return { ok: false, why: "notDone" };
  if (row.claimed_at) return { ok: false, why: "claimed" };

  const { data: won } = await sb
    .from("player_challenges")
    .update({ claimed_at: now.toISOString() })
    .eq("player_id", playerId)
    .eq("challenge_id", challengeId)
    .is("claimed_at", null)
    .select("challenge_id");
  if (!won?.length) return { ok: false, why: "claimed" };

  if (challenge.reward.diamonds)
    await deliver(sb, playerId, { diamonds: challenge.reward.diamonds }, "challenge");
  if (challenge.reward.nachos) await addNachos(sb, playerId, challenge.reward.nachos);
  return { ok: true, gave: challenge.reward };
}
