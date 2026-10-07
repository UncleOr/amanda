/**
 * The numbers behind the admin panel's statistics screen.
 *
 * Or: *"in the admin panel give me statistics too — how many games each user
 * played, how many wins, losses, app usage, purchases, user behaviour
 * (abandoning mid-game for instance), how many playground games, what users
 * like most. Think of lots of information and statistics I can get."*
 *
 * ═══ EVERY NUMBER HERE IS COUNTED, NOT ESTIMATED ═══
 *
 * All of it comes out of `events` (see events.ts), which the game writes as
 * things happen. That is the whole reason the table exists: before it, four
 * of the six things he asked for had never been recorded at all, and the
 * other two were spread across tables that were never meant to be asked this.
 *
 * ═══ AND WHY THE QUERIES LOOK CRUDE ═══
 *
 * They read rows and count them in TypeScript rather than asking Postgres to
 * group. PostgREST — which is what the service key talks to — has no GROUP BY,
 * so a real aggregate needs a database function and a migration for every
 * question. At this size (a few thousand rows) reading them is instant and
 * every new question Or has is ten lines here instead of a deploy. If this
 * ever stops being true the answer is a materialised view, and the shape of
 * what is returned will not have to change.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATALOG } from "./content.js";

/** How far back the headline numbers look. */
const WINDOW_DAYS = 30;
/** Nothing older than this is read at all; it would not change an answer. */
const HARD_LIMIT = 20000;

interface EventRow {
  player_id: string | null;
  kind: string;
  at: string;
  data: Record<string, unknown>;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/** `{ "2026-10-07": 4, … }` for the last `days` days, zeroes included. */
function byDay(rows: EventRow[], days: number): Array<{ day: string; n: number }> {
  const out = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) out.set(daysAgo(i).slice(0, 10), 0);
  for (const r of rows) {
    const day = r.at.slice(0, 10);
    if (out.has(day)) out.set(day, (out.get(day) ?? 0) + 1);
  }
  return [...out].map(([day, n]) => ({ day, n }));
}

function countBy<T>(rows: T[], key: (r: T) => string | null): Array<{ id: string; n: number }> {
  const tally = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k === null) continue;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  return [...tally]
    .map(([id, n]) => ({ id, n }))
    .sort((a, b) => b.n - a.n);
}

/**
 * Everything the overview screen shows.
 *
 * One read of the events table and one of the players, then all of the
 * arithmetic — rather than a dozen round trips, each of which is a chance for
 * the screen to be half-loaded.
 */
export async function overview(sb: SupabaseClient): Promise<Record<string, unknown>> {
  const since = daysAgo(WINDOW_DAYS);
  const [{ data: events }, { data: players }] = await Promise.all([
    sb
      .from("events")
      .select("player_id, kind, at, data")
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(HARD_LIMIT),
    sb
      .from("players")
      .select("id, nickname, created_at, last_seen_at, trophies, diamonds, nachos, tutorial_done"),
  ]);

  const rows = (events ?? []) as EventRow[];
  const people = players ?? [];
  const of = (kind: string) => rows.filter((r) => r.kind === kind);

  const matches = of("match");
  const opens = of("open");
  const quits = of("quit");
  const buys = of("buy");
  const chests = of("chest");
  const playground = of("playground");

  const won = matches.filter((m) => m.data.won === true).length;
  const bot = matches.filter((m) => m.data.mode === "bot");
  const online = matches.filter((m) => m.data.mode === "online");

  /*
   * ═══ "WHAT DO PLAYERS LIKE MOST" ═══
   *
   * Three different questions wearing one coat, so it answers all three.
   *
   *   WHICH CARDS THEY PLAY. Every card on every board of every finished
   *     match. This is taste, and it is the only one of the three that is
   *     about the game rather than about the shop.
   *   WHICH CARDS WIN. The same count over winning boards only. The gap
   *     between the two lists is the balance problem: a card everybody plays
   *     and nobody wins with is a card that LOOKS good.
   *   WHAT THEY SPEND ON. Purchases, which is the only one they pay for.
   */
  const played = new Map<string, number>();
  const winners = new Map<string, number>();
  for (const m of matches) {
    const cards = Array.isArray(m.data.cards) ? (m.data.cards as string[]) : [];
    for (const id of cards) {
      played.set(id, (played.get(id) ?? 0) + 1);
      if (m.data.won === true) winners.set(id, (winners.get(id) ?? 0) + 1);
    }
  }
  const named = (tally: Map<string, number>) =>
    [...tally]
      .map(([id, n]) => ({ id, he: CATALOG.get(id)?.name.he ?? id, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);

  const day = 86_400_000;
  const activeSince = (ms: number) =>
    new Set(
      rows.filter((r) => Date.parse(r.at) > Date.now() - ms && r.player_id).map((r) => r.player_id),
    ).size;

  return {
    windowDays: WINDOW_DAYS,
    /* ── people ── */
    people: {
      total: people.length,
      withNickname: people.filter((p) => p.nickname).length,
      finishedTutorial: people.filter((p) => p.tutorial_done).length,
      newThisWeek: people.filter((p) => Date.parse(p.created_at) > Date.now() - 7 * day).length,
      activeToday: activeSince(day),
      activeThisWeek: activeSince(7 * day),
    },
    /* ── how much the game is being played ── */
    play: {
      matches: matches.length,
      wins: won,
      losses: matches.length - won,
      winRate: matches.length ? Math.round((won / matches.length) * 100) : 0,
      vsBot: bot.length,
      vsPeople: online.length,
      playground: playground.length,
      byLevel: countBy(bot, (m) => (typeof m.data.level === "string" ? m.data.level : null)),
      /* The average grade the server gave. Falling means the game got harder
         or the players got worse, and both are worth knowing about. */
      meanScore: matches.length
        ? Math.round(
            (matches.reduce((n, m) => n + (Number(m.data.score) || 0), 0) / matches.length) * 10,
          ) / 10
        : 0,
    },
    /* ── behaviour ── */
    behaviour: {
      opens: opens.length,
      quits: quits.length,
      /*
       * The one number on this screen that is a WARNING rather than a
       * measurement: matches abandoned as a share of matches started. A
       * quarter of them is a game people are bailing out of, and the phase
       * breakdown below says which part they are bailing out of.
       */
      quitRate: matches.length + quits.length
        ? Math.round((quits.length / (matches.length + quits.length)) * 100)
        : 0,
      quitPhase: countBy(quits, (q) => (typeof q.data.phase === "string" ? q.data.phase : null)),
      quitMode: countBy(quits, (q) => (typeof q.data.mode === "string" ? q.data.mode : null)),
      installed: opens.filter((o) => o.data.installed === true).length,
    },
    /* ── the economy ── */
    economy: {
      purchases: buys.length,
      diamondsSpent: buys.reduce((n, b) => n + (Number(b.data.paid) || 0), 0),
      chestsOpened: chests.length,
      cardsFromChests: chests.reduce((n, c) => n + (Number(c.data.cards) || 0), 0),
      /*
       * How many of those cards were ones the player did not already have.
       * The single best measure of whether collecting still feels like
       * collecting: as it falls towards zero, a chest becomes a handful of
       * duplicates and the loop is finished.
       */
      newCardsFromChests: chests.reduce((n, c) => n + (Number(c.data.fresh) || 0), 0),
      claims: of("claim").length,
      bestSellers: countBy(buys, (b) => (typeof b.data.item === "string" ? b.data.item : null)).slice(0, 10),
      diamondsHeld: people.reduce((n, p) => n + (p.diamonds ?? 0), 0),
    },
    /* ── taste ── */
    taste: { played: named(played), winners: named(winners) },
    /* ── the shape of the last month ── */
    daily: {
      opens: byDay(opens, 14),
      matches: byDay(matches, 14),
    },
  };
}

/**
 * The same questions, about one person.
 *
 * Or asked for *"how many games each user played, how many wins, losses"* —
 * per user, which is a different screen from the one above. Reached from the
 * users tab, so it is only ever asked about somebody already being looked at.
 */
export async function aboutPlayer(
  sb: SupabaseClient,
  playerId: string,
): Promise<Record<string, unknown>> {
  const [{ data: events }, { data: player }, { data: cards }] = await Promise.all([
    sb
      .from("events")
      .select("player_id, kind, at, data")
      .eq("player_id", playerId)
      .order("at", { ascending: false })
      .limit(5000),
    sb
      .from("players")
      .select("id, nickname, created_at, last_seen_at, trophies, best_trophies, diamonds, nachos, tutorial_done")
      .eq("id", playerId)
      .maybeSingle(),
    sb.from("player_cards").select("card_id, copies, level").eq("player_id", playerId),
  ]);

  const rows = (events ?? []) as EventRow[];
  const matches = rows.filter((r) => r.kind === "match");
  const won = matches.filter((m) => m.data.won === true).length;
  const quits = rows.filter((r) => r.kind === "quit");
  const buys = rows.filter((r) => r.kind === "buy");

  const played = new Map<string, number>();
  for (const m of matches)
    for (const id of Array.isArray(m.data.cards) ? (m.data.cards as string[]) : [])
      played.set(id, (played.get(id) ?? 0) + 1);

  return {
    player,
    matches: matches.length,
    wins: won,
    losses: matches.length - won,
    winRate: matches.length ? Math.round((won / matches.length) * 100) : 0,
    vsBot: matches.filter((m) => m.data.mode === "bot").length,
    vsPeople: matches.filter((m) => m.data.mode === "online").length,
    playground: rows.filter((r) => r.kind === "playground").length,
    opens: rows.filter((r) => r.kind === "open").length,
    quits: quits.length,
    quitPhase: countBy(quits, (q) => (typeof q.data.phase === "string" ? q.data.phase : null)),
    chests: rows.filter((r) => r.kind === "chest").length,
    purchases: buys.length,
    diamondsSpent: buys.reduce((n, b) => n + (Number(b.data.paid) || 0), 0),
    claims: rows.filter((r) => r.kind === "claim").length,
    cardsHeld: (cards ?? []).length,
    bestCard: (cards ?? []).slice().sort((a, b) => (b.level ?? 1) - (a.level ?? 1))[0] ?? null,
    favourites: [...played]
      .map(([id, n]) => ({ id, he: CATALOG.get(id)?.name.he ?? id, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8),
    /* The last twenty things they did, in order. The one view on this screen
       that is a story rather than a number — "played three, quit, left" is a
       sentence no aggregate says. */
    recent: rows.slice(0, 20).map((r) => ({ kind: r.kind, at: r.at, data: r.data })),
  };
}
