/**
 * Daily, weekly and monthly challenges: the other clock.
 *
 * Or asked for them alongside nachos, and the two are deliberately different
 * shapes. A nacho bar fills from ANY match — it is the reward for playing at
 * all. A challenge asks for something in particular ("win with a score of 8",
 * "put a Lions card in the front row"), which is the reward for playing a
 * certain way, and it is the thing that makes a player open the album between
 * matches instead of pressing "again".
 *
 * ═══ WHY THEY ARE COMPUTED FROM THE DATE AND NOT STORED ═══
 *
 * There is no table of challenge definitions, and there is no job that writes
 * tomorrow's three rows at midnight. The set for a given day IS a function of
 * that day: `challengesFor(pools, date)` returns the same six challenges in
 * every browser and on the server, for everybody, forever.
 *
 * Three things fall out of that and all three matter:
 *
 *   NOTHING CAN BE MISSED. A scheduled job that does not run leaves a day
 *   with no challenges in it. This cannot: the day defines them.
 *
 *   THE SERVER AND THE CLIENT AGREE BY CONSTRUCTION. The screen shows what
 *   the server is counting, without the screen having to ask what that is.
 *
 *   HOD AND HIS FATHER GET THE SAME ONES. Challenges that differ per player
 *   are a solitary feature; the same three for everybody is something two
 *   people in the same house can talk about.
 *
 * The cost is that Or cannot hand-write "today's challenge" from the admin
 * panel. When he wants that, the right shape is an override row that this
 * function consults — not a table that replaces it.
 *
 * ═══ THE DAY ENDS IN ISRAEL ═══
 *
 * Every period boundary is computed in `Asia/Jerusalem`, not in UTC and not in
 * the browser's zone. A daily challenge that turns over at 3am local time
 * because a server is in Virginia is a daily challenge that a child loses
 * halfway through an evening.
 */

export type Period = "daily" | "weekly" | "monthly";

/**
 * What a challenge asks for.
 *
 * Each one is checked against a single finished match, so every goal here is
 * answerable from "the board I built and how it went" — see `MatchFacts`.
 */
export type Goal =
  /** Build a board containing this card. */
  | { kind: "playCard"; cardId: string }
  /** Build a board with a card of this series in the front row / back row. */
  | { kind: "placeSeries"; seriesId: string; row: "front" | "back" }
  /** Finish a match graded at least this well. */
  | { kind: "score"; least: number }
  /** Win. */
  | { kind: "win" }
  /** Play, however it goes. */
  | { kind: "play" };

export interface Challenge {
  /** Stable for as long as the challenge is live: "d:2026-10-07:1". */
  id: string;
  period: Period;
  goal: Goal;
  /** How many matches have to satisfy the goal. */
  need: number;
  /** What it pays. */
  reward: { diamonds?: number; nachos?: number };
  /** The sentence shown to the player. Or's words — see docs/COPY.md. */
  he: string;
}

/* ─────────────────────────── when a period ends ────────────────────────── */

/**
 * The calendar date in Israel, as "2026-10-07".
 *
 * `sv-SE` because that locale formats a date as ISO, which is the one thing
 * `toLocaleDateString` can be relied on for across engines.
 */
export function israelDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * The key for each period, which is also what seeds the choice.
 *
 * The week starts on SUNDAY, because that is when a week starts in Israel —
 * a Monday-based week would turn the weekly challenge over in the middle of
 * the school week.
 */
export function periodKey(period: Period, now: Date = new Date()): string {
  const day = israelDay(now);
  if (period === "monthly") return day.slice(0, 7);
  if (period === "daily") return day;
  // Walk back to the Sunday on or before this date, in plain calendar
  // arithmetic so no timezone can move it.
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d));
  at.setUTCDate(at.getUTCDate() - at.getUTCDay());
  return at.toISOString().slice(0, 10);
}

/**
 * The first Israeli day that is NOT in this period, as "2026-10-08".
 *
 * A date rather than an instant on purpose: the authority on which challenges
 * are live is `periodKey`, which only ever consults the calendar date, so a
 * countdown that disagreed with it by a few hours would be lying about which
 * set is live. This is what the screen counts down to, rendered as midnight in
 * Israel.
 */
export function periodEndsOn(period: Period, now: Date = new Date()): string {
  const day = israelDay(now);
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d));
  if (period === "daily") at.setUTCDate(at.getUTCDate() + 1);
  else if (period === "weekly") at.setUTCDate(at.getUTCDate() + (7 - at.getUTCDay()));
  else at.setUTCMonth(at.getUTCMonth() + 1, 1);
  return at.toISOString().slice(0, 10);
}

/* ──────────────────────────── choosing the set ─────────────────────────── */

/** A small, stable hash. The same answer in every engine, which is the point. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A deterministic stream of numbers from a key. */
function stream(key: string): () => number {
  let s = hash(key) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** The names this module is deliberately not allowed to know on its own. */
export interface Pools {
  /** Collectable cards: id and Hebrew name. */
  cards: ReadonlyArray<{ id: string; he: string }>;
  /** Series: id and Hebrew name. */
  series: ReadonlyArray<{ id: string; he: string }>;
}

/**
 * What a challenge can ask for, and what it is worth.
 *
 * `make` is handed a 0..1 stream and the pools it may draw from, so a template
 * can name a particular card without this file knowing a single card id — the
 * catalogue lives in the client and the server, not here. A template that
 * cannot be built from the pools it was given returns null and is skipped.
 */
interface Template {
  /** Which periods it is allowed to appear in. */
  periods: Period[];
  make(
    pick: () => number,
    pools: Pools,
  ): { goal: Goal; need: number; reward: Challenge["reward"]; he: string } | null;
}

function oneOf<T>(pick: () => number, xs: ReadonlyArray<T>): T | undefined {
  return xs.length ? xs[Math.floor(pick() * xs.length) % xs.length] : undefined;
}

/*
 * The drafts below are mine; the words are Or's.
 *
 * He is a copywriter and has asked to write the strings himself. These say the
 * right thing in roughly the right register so the screen can be built and
 * looked at, and every one of them is expected to be rewritten.
 */
const TEMPLATES: Template[] = [
  {
    periods: ["daily", "weekly"],
    make: (pick, pools) => {
      const card = oneOf(pick, pools.cards);
      if (!card) return null;
      const need = pick() < 0.5 ? 1 : 2;
      return {
        goal: { kind: "playCard", cardId: card.id },
        need,
        reward: { nachos: need },
        he: need === 1 ? `לשחק משחק עם ${card.he}` : `לשחק ${need} משחקים עם ${card.he}`,
      };
    },
  },
  {
    periods: ["daily", "weekly"],
    make: (pick, pools) => {
      const s = oneOf(pick, pools.series);
      if (!s) return null;
      const row = pick() < 0.5 ? "front" : "back";
      return {
        goal: { kind: "placeSeries", seriesId: s.id, row },
        need: 1,
        reward: { nachos: 1 },
        he: row === "front" ? `לשים קלף מ${s.he} בשורה הקדמית` : `לשים קלף מ${s.he} בשורה האחורית`,
      };
    },
  },
  {
    periods: ["daily", "weekly", "monthly"],
    make: (pick) => {
      const least = 7 + Math.floor(pick() * 3); // 7, 8 or 9
      return {
        goal: { kind: "score", least },
        need: 1,
        reward: { diamonds: least * 2 },
        he: `לסיים משחק עם ציון ${least} ומעלה`,
      };
    },
  },
  {
    periods: ["daily"],
    make: (pick) => {
      const need = 2 + Math.floor(pick() * 2); // 2 or 3
      return {
        goal: { kind: "win" },
        need,
        reward: { diamonds: need * 5 },
        he: `לנצח ב-${need} משחקים`,
      };
    },
  },
  {
    periods: ["weekly", "monthly"],
    make: (pick) => {
      const need = 8 + Math.floor(pick() * 8) * 2; // 8..22, even
      return {
        goal: { kind: "play" },
        need,
        reward: { diamonds: need * 3 },
        he: `לשחק ${need} משחקים`,
      };
    },
  },
  {
    periods: ["weekly", "monthly"],
    make: (pick) => {
      const need = 5 + Math.floor(pick() * 6); // 5..10
      return {
        goal: { kind: "win" },
        need,
        reward: { diamonds: need * 6 },
        he: `לנצח ב-${need} משחקים`,
      };
    },
  },
];

/** How many of each period are live at once. */
const HOW_MANY: Record<Period, number> = { daily: 3, weekly: 2, monthly: 1 };

const LETTER: Record<Period, string> = { daily: "d", weekly: "w", monthly: "m" };

/**
 * The challenges live in one period, for everybody.
 *
 * Deterministic in `key`, so this is safe to call on every render and after
 * every finished match without anything being written down.
 */
export function challengesIn(period: Period, key: string, pools: Pools): Challenge[] {
  const usable = TEMPLATES.filter((t) => t.periods.includes(period));
  if (!usable.length) return [];
  const pick = stream(`${period}:${key}`);
  const out: Challenge[] = [];
  /*
   * Walk the templates from a seeded offset rather than drawing each one at
   * random. Drawing would give the same template twice — three identical
   * "win N matches" is a bad day — and would sometimes come up short.
   */
  const start = Math.floor(pick() * usable.length);
  for (let n = 0; out.length < HOW_MANY[period] && n < usable.length; n++) {
    const i = (start + n) % usable.length;
    const built = usable[i]!.make(pick, pools);
    if (built) out.push({ id: `${LETTER[period]}:${key}:${i}`, period, ...built });
  }
  return out;
}

/** Everything live right now: three daily, two weekly, one monthly. */
export function challengesFor(pools: Pools, now: Date = new Date()): Challenge[] {
  return (["daily", "weekly", "monthly"] as Period[]).flatMap((p) =>
    challengesIn(p, periodKey(p, now), pools),
  );
}

/* ─────────────────────── did this match satisfy it? ────────────────────── */

/**
 * Everything about one finished match that a challenge may ask about.
 *
 * Built by the SERVER from a battle it re-ran itself, never from a claim the
 * client made — a challenge that pays diamonds is a challenge worth lying to.
 */
export interface MatchFacts {
  won: boolean;
  /** The 1–10 grade for this player's side. */
  score: number;
  /** Every card on the board, repeats included. */
  cardIds: string[];
  /** Series of the cards in the front row (x = 3) and the back row (x = 0). */
  frontSeries: string[];
  backSeries: string[];
}

/** How much one finished match moves this challenge along. Always 0 or 1. */
export function progressFrom(goal: Goal, facts: MatchFacts): 0 | 1 {
  switch (goal.kind) {
    case "play":
      return 1;
    case "win":
      return facts.won ? 1 : 0;
    case "score":
      return facts.score >= goal.least ? 1 : 0;
    case "playCard":
      return facts.cardIds.includes(goal.cardId) ? 1 : 0;
    case "placeSeries":
      return (goal.row === "front" ? facts.frontSeries : facts.backSeries).includes(goal.seriesId)
        ? 1
        : 0;
  }
}
