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
  arenaFor,
  challengesFor,
  familyOpen,
  isCollectable,
  israelDay,
  nachoChestKind,
  nachosFor,
  progressFrom,
  soloTrophiesFor,
  stopsReached,
  trophiesFor,
  SIMULATION,
  type Card,
  type Opponent,
  withinDailyCap,
  type BotLevel,
  type Challenge,
  type MatchFacts,
  type Pools,
  NACHOS_PER_CHEST,
} from "@amanda/shared";
import { buildReport, type BattleResult, type Placement } from "@amanda/engine";
import { CATALOG, SERIES_NAMES, SYNERGIES } from "./content.js";
import { bestTrophiesOf, rollChest } from "./progress.js";
import { db } from "./supabase.js";
import { track } from "./events.js";
import { deliver } from "./shop.js";

/** Side B is mirrored into the far half of the arena; x = 3 is the front row. */
const FRONT_X = 3;
const BACK_X = 0;

/**
 * The names a challenge may put in a sentence, for a player at one rung.
 *
 * ⚠ AND IT IS A RUNG AND NOT A PLAYER. Or: *"the challenges have to match
 * the arena I am in. I have a challenge to fight with the Leviathan and I
 * have not even reached the Pool."* The pool is filtered by `familyOpen` —
 * the same gate the chests, the album and the bot's board already ask — so a
 * challenge can only name a family you have been introduced to.
 *
 * Cached per ARENA rather than per player, which is both cheaper and more
 * honest: what a challenge may mention changes seven times in the life of an
 * account and not with every trophy. `challengesFor` runs after every single
 * match, so building this each time would walk the catalogue for nothing.
 */
const POOLS_AT = new Map<string, Pools>();

function poolsFor(best: number): Pools {
  const rung = arenaFor(best).id;
  const had = POOLS_AT.get(rung);
  if (had) return had;
  const built = buildPools(best);
  POOLS_AT.set(rung, built);
  return built;
}

function buildPools(best: number): Pools {
  const playable = [...CATALOG.values()].filter(
    (c) =>
      c.id !== "crumb_demon" && c.launch && isCollectable(c) && familyOpen(c.seriesId, best),
  );
  /*
   * ═══ A FAMILY WITH NOTHING YOU CAN PLAY IS NOT A CHALLENGE ═══
   *
   * The card pool has always filtered on `launch`. The SERIES pool did not,
   * and it took every name in the catalogue — including the legends, whose
   * only card is Amanda. She is `launch: false` and, since the day she was
   * correctly taken out of the chest pool, uncollectable too.
   *
   * So "put a card from the Legendaries in the back row" has been a daily
   * challenge nobody could ever complete. Found on the live site, in the
   * challenge list of a brand-new account, while checking something else.
   *
   * A series earns its place by having a card you could put on a board.
   */
  const families = new Set(playable.map((c) => c.seriesId));
  return {
    cards: playable.map((c) => ({ id: c.id, he: c.name.he, en: c.name.en })),
    series: [...SERIES_NAMES]
      .filter(([id]) => families.has(id))
      .map(([id, name]) => ({ id, ...name })),
  };
}

/**
 * What is being asked of a player who has climbed this far.
 *
 * `best` rather than current trophies, for the reason it is always best: a
 * family you have met does not become unmet after a bad evening, and a
 * challenge list that shrank on a loss would be the game taking something
 * away twice.
 */
export function liveChallenges(now: Date = new Date(), best = 0): Challenge[] {
  return challengesFor(poolsFor(best), now);
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
  /*
   * ═══ THE SEVEN HARDER QUESTIONS ═══
   *
   * Or: *"the challenges are a bit unsuited to the game. We need more varied
   * and more challenging ones."* Every one of the new goals is answerable
   * from the same two things this function already has — the board as it was
   * BUILT and the battle as it ran — and none of them needs a second row in
   * a table or a second pass over the match.
   */
  const cards = real.map((p) => CATALOG.get(p.cardId)).filter((c): c is Card => !!c);
  /** Families with enough cards on the board for the bonus to be live. */
  const byFamily = new Map<string, number>();
  for (const c of cards) byFamily.set(c.seriesId, (byFamily.get(c.seriesId) ?? 0) + 1);
  const synergies = [...byFamily]
    .filter(([id, n]) => n >= (SYNERGY_AT.get(id) ?? Infinity))
    .map(([id]) => id);
  /** Your own dead, counted off the battle rather than off the board. */
  const mine = new Set(result.finalUnits.filter((u) => u.owner === owner).map((u) => u.uid));
  const lost = result.events.filter(
    (e) => e.type === "death" && !!e.uid && mine.has(e.uid),
  ).length;
  const crown = placements.find((p) => p.king);
  return {
    won: result.winner === owner,
    score: report.grades[owner].score,
    cardIds: real.map((p) => p.cardId),
    frontSeries: seriesAt(FRONT_X),
    backSeries: seriesAt(BACK_X),
    seconds: result.ticks / SIMULATION.ticksPerSecond,
    // The crown fell. `winReason` says how the WINNER was decided, and this
    // is the one value of it that is not a tiebreak.
    kingDown: result.winReason === "kingDown",
    lost,
    placed: real.length,
    rarities: [...new Set(cards.map((c) => c.rarity))],
    kingSeries: crown ? (CATALOG.get(crown.cardId)?.seriesId ?? null) : null,
    synergies,
    /*
     * A Crumb Demon on the board, which is the same board fact as "a square
     * was left empty": the filler goes into every empty slot the moment the
     * board locks (solo.ts), so it is in `placements` and not in `real`.
     *
     * Read off the difference between those two rather than scanned for a
     * second time, so it cannot disagree with `placed` about one board.
     */
    crumbs: placements.length > real.length,
  };
}

/**
 * How many of a family it takes for its bonus to be live.
 *
 * Read off the series data rather than fixed at three: the threshold is a
 * per-family number (series.synergy.threshold) and a challenge that says
 * "play with the family bonus" has to mean the same thing the battle does.
 */
const SYNERGY_AT = new Map(SYNERGIES.map((s) => [s.seriesId, s.threshold]));

/** What one finished match gave a player, for the screen to celebrate. */
export interface MetaAward {
  nachos: number;
  /** Trophies this match added. Only ever from beating the computer. */
  trophies: number;
  /**
   * True when the day's ceiling on solo trophies is why `trophies` is zero,
   * so the screen can say so rather than looking broken.
   */
  cappedOut: boolean;
  /**
   * This opponent pays nothing, however well you play.
   *
   * ═══ WHY A ZERO HAS TO EXPLAIN ITSELF ═══
   *
   * Or: *"I won again and got no trophies or nachos."* He had, and the
   * server had done exactly what he asked for — the match was against the
   * EASY bot, which is zero in both currencies by his own rule (*"a match
   * against the easy bot gives no nachos"*, and the easy bot "loses 83% of
   * the time; a ladder that moves on those matches is a ladder made of
   * them").
   *
   * So nothing was broken and the report was still right: a win that pays
   * nothing and says nothing is indistinguishable from a bug, and he spent
   * his evening reporting one. The ceiling already had this courtesy —
   * `cappedOut` exists so the screen can say why a zero is a zero — and the
   * opponent needed it too.
   *
   * Derived from the rules rather than from the word "easy": it asks what a
   * PERFECT win against this opponent would pay. A level tuned to zero
   * later gets the sentence for free.
   */
  noStakes: boolean;
  /**
   * Prize-tunnel stations this match opened. Almost always 0, sometimes 1.
   *
   * Or: *"and if there is a message at the end of the match, the button
   * takes me to the tunnel and there I collect the prize and get the cool
   * effect and the dopamine and everything."* So the result screen can say
   * a station opened, and pressing it is pressing the door — the same rule
   * the chest line and the challenges line already follow.
   *
   * ⚠ IT IS AN EVENT, NOT A STATE. "How many prizes are sitting there" is a
   * different question with a different home: the chip on the home screen
   * carries that badge for as long as they are unclaimed. This is the
   * moment, and it passes.
   */
  tunnel: number;
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

const NONE: MetaAward = {
  nachos: 0,
  trophies: 0,
  cappedOut: false,
  noStakes: false,
  tunnel: 0,
  total: 0,
  chests: [],
  moved: [],
};

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
  /** Set for a match against the computer; left out for one against a person. */
  botLevel?: BotLevel,
  /**
   * The other player's id, for a match against a person.
   *
   * Only used to tell a friend from a stranger, which changes exactly one
   * number: a LOSS to a friend pays a nacho and a loss to a stranger pays
   * nothing. Left out, everybody is a stranger — which is the safe way round,
   * since the worst it can do is fail to pay a nacho.
   */
  opponentId?: string | null,
  /**
   * The double card was played: this match is worth twice as much.
   *
   * Or: *"Double — if you played it, it doubles the amount of trophies you
   * win or lose in the match (only in matches with trophies)."*
   *
   * ⚠ BOTH DIRECTIONS, WHICH IS WHAT MAKES IT A DECISION. A card that only
   * doubled the winnings would be a card you always play; one that doubles
   * the fall as well is a bet, and a bet is the thing Or asked for.
   *
   * "Only in matches with trophies" needs no code: a match worth nothing is
   * worth nothing twice, and `moveTrophies` already leaves on a zero.
   *
   * ⚠ WHERE THIS IS BELIEVED FROM, WHICH IS NOT THE SAME IN BOTH MODES.
   * ONLINE the match server SAW the card played — it passes through the
   * socket, so the flag is the server's own observation and cannot be
   * forged by a browser. SOLO it is the browser's claim, because an action
   * card played during the prep leaves no mark on the battle for the replay
   * to check it against. The exposure is precisely one thing: a modified
   * client claiming it only on matches it won. What bounds it is that solo
   * trophies are capped per day anyway (withinDailyCap), so the most it can
   * buy is reaching that cap sooner.
   */
  doubled = false,
): Promise<MetaAward> {
  try {
    const opponent = await whoThatWas(sb, playerId, botLevel, opponentId);
    /*
     * ═══ NACHOS ARE PAID FOR WHO YOU PLAYED, NOT HOW WELL ═══
     *
     * Or, settling it: *"a match against the easy bot gives no nachos. A win
     * against the medium bot — 2. A win against the hard bot or a friend —
     * 3. A loss to a friend — one nacho; at this stage I want to encourage
     * games against friends."*
     *
     * This line used to read `nachosForScore(facts.score)`, and that is the
     * bug this fixes: `nachosFor` was written to his rule, documented at
     * length, exported — and never called. The old rule was still live, so
     * the easy bot was still paying three nachos for a good board and the
     * cheapest way to fill the bar was the opponent who could not fight
     * back. Written and wired are not the same thing.
     */
    const nachos = nachosFor(opponent, facts.won);
    const { chests, total } = await addNachos(sb, playerId, nachos);
    const moved = await advanceChallenges(sb, playerId, facts, now);
    /*
     * ═══ ONE PLACE DECIDES WHAT A MATCH DOES TO YOUR TROPHIES ═══
     *
     * Or, setting out the economy: *"trophies — plus or minus by win or
     * loss. More if you win with a high score, more if you win against a
     * person. A loss takes trophies off you. It's a global variable per
     * user."*
     *
     * It used to be two rules in two files. A match against a PERSON was
     * paid in progress.ts by recordMatch — flat +30 and −20, the score
     * never entering into it — and a match against the computer was paid
     * here from different numbers. "More for a better game" could not be
     * added without writing it twice, and a rout against a person was
     * worth exactly what a coin-toss win was worth.
     *
     * `trophiesFor` is the only answer now, and this is the only caller.
     * recordMatch no longer touches trophies at all.
     */
    const won = await moveTrophies(sb, playerId, facts, opponent, now, doubled);
    /*
     * Write the match down. Every finished match comes through here —
     * against a person and against the computer — which makes this the one
     * place "how many games has this child played" can be answered from.
     *
     * The cards go with it because Or asked what players LIKE: a card that
     * keeps turning up on winning boards is the answer, and the only way to
     * know is to have kept the boards. Ids only, which the game already
     * knows about every player who plays it.
     */
    track(sb, playerId, "match", {
      mode: botLevel ? "bot" : "online",
      ...(botLevel ? { level: botLevel } : {}),
      won: facts.won,
      score: facts.score,
      cards: facts.cardIds,
      nachos,
      trophies: won?.gave ?? 0,
    });
    return {
      nachos,
      total,
      chests,
      moved,
      trophies: won?.gave ?? 0,
      cappedOut: won?.cappedOut ?? false,
      tunnel: won?.tunnel ?? 0,
      // Asked of the rules, not of the level's name: what would a flawless
      // win against this opponent have been worth? Nothing, for the easy bot.
      noStakes:
        nachosFor(opponent, true) === 0 &&
        trophiesFor({ won: true, score: 10, opponent }) === 0,
    };
  } catch (err) {
    // A match that finished matters more than a counter that did not move.
    console.error("[meta] could not award the match", err);
    return NONE;
  }
}

/**
 * Who that match was against: a bot at a named level, a friend, or a stranger.
 *
 * The friend question costs one small query, and only for a match against a
 * person — a bot is known from its argument. It is worth the query because
 * "a loss to a friend is worth a nacho" is the one rule in the whole economy
 * that pays for losing, and Or put it there deliberately: *"at this stage I
 * want to encourage games against friends."* A rule that cannot tell a friend
 * from a stranger is a rule that never fires.
 *
 * Any failure answers "stranger". That is the safe direction — the worst it
 * costs is a single nacho that should have been paid, against a crash in the
 * payout path of a match that has already finished.
 */
async function whoThatWas(
  sb: SupabaseClient,
  playerId: string,
  botLevel?: BotLevel,
  opponentId?: string | null,
): Promise<Opponent> {
  if (botLevel) return { kind: "bot", level: botLevel };
  if (!opponentId) return { kind: "stranger" };
  try {
    const { data } = await sb
      .from("friends")
      .select("player_id")
      .eq("status", "accepted")
      .or(
        `and(player_id.eq.${playerId},friend_id.eq.${opponentId}),` +
          `and(player_id.eq.${opponentId},friend_id.eq.${playerId})`,
      )
      .limit(1);
    return data?.length ? { kind: "friend" } : { kind: "stranger" };
  } catch {
    return { kind: "stranger" };
  }
}

/**
 * Add what this match was worth, and say how much was actually given.
 *
 * The daily ceiling applies to what a BOT pays and to nothing else: it is
 * there so an evening against the computer cannot forge the ladder (see
 * soloTrophies.ts). A win against a person is not capped, and a LOSS is
 * never capped in either case — a ceiling on what you can lose would mean
 * the ladder stops being honest once you have played enough.
 */
async function moveTrophies(
  sb: SupabaseClient,
  playerId: string,
  facts: MatchFacts,
  opponent: Opponent,
  now: Date,
  doubled = false,
): Promise<{ gave: number; cappedOut: boolean; tunnel: number }> {
  /*
   * ⚠ DOUBLED BEFORE THE CAP, NOT AFTER. The daily cap on bot trophies is a
   * ceiling on what a day can pay; doubling after it would lift the ceiling,
   * which is not what the card says and not what the cap is for. Doubling
   * first means the card gets you to the same ceiling in half the matches,
   * which is exactly "twice as much, twice as fast".
   *
   * And a match worth nothing is still worth nothing — "only in matches with
   * trophies" is the line below, which was already there.
   */
  const worth = trophiesFor({ won: facts.won, score: facts.score, opponent }) * (doubled ? 2 : 1);
  if (worth === 0) return { gave: 0, cappedOut: false, tunnel: 0 };

  const today = israelDay(now);
  const { data } = await sb
    .from("players")
    .select("trophies, best_trophies, solo_day, solo_trophies")
    .eq("id", playerId)
    .maybeSingle();

  let gave = worth;
  let cappedOut = false;
  const already = data?.solo_day === today ? (data?.solo_trophies ?? 0) : 0;
  if (worth > 0 && opponent.kind === "bot") {
    gave = withinDailyCap(already, worth);
    cappedOut = gave < worth;
    if (gave <= 0) return { gave: 0, cappedOut: true, tunnel: 0 };
  }

  // Never below zero. A child who has just started cannot go into debt.
  const trophies = Math.max(0, (data?.trophies ?? 0) + gave);
  /*
   * ═══ AND DID THIS MATCH WALK PAST A PRIZE STATION ═══
   *
   * Or: *"could something be taken from the prize tunnel automatically? I
   * need to go in and take it myself — and if there is a message at the end
   * of a match, the button takes me to the tunnel and there I collect the
   * prize and get the cool effect and the dopamine and everything."*
   *
   * Nothing is ever taken automatically and never was: the only thing in the
   * game that hands a station over is `claimStop`, and the only thing that
   * calls it is a finger on that tile (apps/server/src/tunnel.ts). His first
   * question has always had the answer he wanted.
   *
   * The second half did not exist. Crossing a station was silent — the track
   * simply had one more tile lit the next time you happened to open it — so
   * the moment the thing was EARNED and the moment it was seen had nothing
   * to do with each other, which is the whole of what he is describing.
   *
   * ⚠ MEASURED OFF `best_trophies`, NOT OFF `trophies`. The high-water mark
   * only goes up, which is what makes a station open exactly once in a
   * lifetime: a player who crosses 600, falls back to 550 and climbs again
   * has not earned it twice, and would otherwise be told so twice.
   */
  const bestBefore = data?.best_trophies ?? 0;
  const bestAfter = Math.max(bestBefore, trophies);
  const tunnel = stopsReached(bestAfter) - stopsReached(bestBefore);
  await sb
    .from("players")
    .update({
      trophies,
      // Only ever goes up: it is the high-water mark the arena celebration
      // is measured against, so each arena pays exactly once in a lifetime
      // however many times you fall back through it.
      best_trophies: bestAfter,
      ...(gave > 0 && opponent.kind === "bot"
        ? { solo_day: today, solo_trophies: already + gave }
        : {}),
    })
    .eq("id", playerId);
  return { gave, cappedOut, tunnel };
}



/**
 * The same thing for a caller that has no database client in its hand.
 *
 * The match server does not and should not: a match that finished matters more
 * than a row that did not save, so it hands this off and carries on, exactly
 * as it does with recordMatch.
 */
export function awardMeta(
  playerId: string,
  facts: MatchFacts,
  /** The other player, so a loss to a friend can pay what Or asked it to. */
  opponentId?: string | null,
  /** The double card, as the MATCH SERVER saw it played. See awardMatch. */
  doubled = false,
): Promise<MetaAward> {
  const sb = db();
  return sb
    ? awardMatch(sb, playerId, facts, new Date(), undefined, opponentId, doubled)
    : Promise.resolve(NONE);
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
    .select("nachos, nacho_chests, best_trophies, trophies")
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
   * Read once, not once per chest. Both are only needed when a chest is
   * actually being minted, which is one match in five — and the album one
   * was being fetched inside the loop below, so filling three bars at once
   * read it three times.
   */
  const [album, items] = owed > 0 ? await Promise.all([albumOf(sb, playerId), itemsOf(sb, playerId)]) : [undefined, undefined];
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
      contents: rollChest(
        Math.max(data?.best_trophies ?? 0, data?.trophies ?? 0),
        kind,
        album,
        items,
      ),
    });
  }
  return { chests: kinds, total: nachos };
}

/** Which cards this player already has, for weighting a chest towards copies. */
async function albumOf(sb: SupabaseClient, playerId: string): Promise<Set<string>> {
  const { data } = await sb.from("player_cards").select("card_id").eq("player_id", playerId);
  return new Set((data ?? []).map((r) => r.card_id as string));
}

/** And which shop items, so a chest never hands over one they already hold. */
async function itemsOf(sb: SupabaseClient, playerId: string): Promise<Set<string>> {
  const { data } = await sb.from("player_items").select("item_id").eq("player_id", playerId);
  return new Set((data ?? []).map((r) => r.item_id as string));
}

/** Move every live challenge this match satisfied. */
async function advanceChallenges(
  sb: SupabaseClient,
  playerId: string,
  facts: MatchFacts,
  now: Date,
): Promise<MetaAward["moved"]> {
  /*
   * ⚠ THE SAME LIST THE PLAYER IS LOOKING AT. Now that a challenge depends
   * on how far somebody has climbed, every one of the three places that
   * touches challenges has to ask with the SAME rung — this one, the
   * standings on the screen, and the claim. Advancing against a different
   * list would credit a match to a goal the player cannot see, and the id is
   * the only thing the two sides share.
   */
  const live = liveChallenges(now, await bestTrophiesOf(sb, playerId)).filter(
    (c) => progressFrom(c.goal, facts) > 0,
  );
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
    const was = at.get(c.id) ?? 0;
    // Capped at `need`: a challenge that keeps counting past its goal would
    // show "7/3" on the screen and tempt somebody to pay out the difference.
    const progress = Math.min(c.need, was + 1);
    /*
     * ═══ "DONE" MEANS "DONE BY THIS MATCH" ═══
     *
     * Or: *"at the end of a match it said 'challenge completed' but I hadn't
     * completed any challenge and I didn't get anything either."*
     *
     * It was `progress >= c.need`, which is true of a finished challenge
     * for ever — and a challenge stays finished until it is CLAIMED, which
     * is a separate button on a separate screen. So every match after the
     * one that finished it announced it again, and nothing arrived, because
     * nothing was owed: the reward comes from claiming.
     *
     * Crossing the line is an event and the result screen reports events.
     * `was < need` is what makes this one.
     */
    moved.push({ id: c.id, progress, need: c.need, done: was < c.need && progress >= c.need });
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
  // A guest has climbed nothing, which is the right list to show them: the
  // four families of the Games Room, and nothing they cannot reach.
  const best = playerId ? await bestTrophiesOf(sb, playerId) : 0;
  const live = liveChallenges(now, best);
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
): Promise<
  { ok: true; gave: Challenge["reward"]; chests: string[] } | { ok: false; why: string }
> {
  const challenge = liveChallenges(now, await bestTrophiesOf(sb, playerId)).find(
    (c) => c.id === challengeId,
  );
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
  /*
   * ═══ THE CHEST THAT WAS MINTED AND NEVER MENTIONED ═══
   *
   * Or: *"I just got a fifth nacho, the nachos reset, but I didn't get a
   * chest."* And a few minutes later: *"after I opened and closed it I saw
   * the chest, but it didn't appear straight away."*
   *
   * Both halves of one line. `addNachos` does the right thing — it filled
   * the bar, minted a silver chest and wrote it to the table — and this
   * threw the answer on the floor. `claim` returned `gave`, the reward as
   * WRITTEN on the challenge, which says "3 nachos" and cannot say "and the
   * chest those three nachos just filled".
   *
   * So the bar emptied in front of him with nothing to show for it. The
   * chest was real the whole time, sitting on the shelf, waiting to be
   * stumbled on — which is exactly how a game teaches someone it is buggy:
   * the thing it owes you arrives, silently, somewhere you were not looking.
   *
   * A match has always reported this (`awardMatch` returns `chests`). A
   * challenge pays in the same nachos and fills the same bar; it has to
   * answer the same question.
   */
  const filled = challenge.reward.nachos
    ? await addNachos(sb, playerId, challenge.reward.nachos)
    : { chests: [] as string[] };
  // Which challenges actually get finished, and which sit there all week.
  track(sb, playerId, "claim", {
    id: challengeId,
    period: challenge.period,
    diamonds: challenge.reward.diamonds ?? 0,
  });
  return { ok: true, gave: challenge.reward, chests: filled.chests };
}
