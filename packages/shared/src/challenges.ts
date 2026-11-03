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
  | { kind: "play" }
  /*
   * ═══ THE SEVEN THAT ASK FOR SOMETHING HARDER ═══
   *
   * Or: *"the challenges are a bit unsuited to the game. We need more
   * varied and more challenging ones. I have just finished a challenge to
   * play 8 games in a month. It is the 2nd of the month."*
   *
   * The first five above can all be satisfied by playing, which is the
   * whole problem: a challenge that a player cannot help finishing is a
   * receipt, not a goal. Every one of these asks for a DECISION — how to
   * win, what to crown, what to put together — and can be read off one
   * finished match (see MatchFacts).
   */
  /** Win by bringing the crown down, rather than on the clock. */
  | { kind: "crush" }
  /** Win in under this many seconds. */
  | { kind: "fastWin"; seconds: number }
  /** Win while losing no more than this many of your own cards. */
  | { kind: "hold"; lost: number }
  /** Have enough of one family on the board for its bonus to be live. */
  | { kind: "family"; seriesId: string }
  /** Put a card of this family on the crown. */
  | { kind: "crown"; seriesId: string }
  /** Field a card of this rarity. */
  | { kind: "rarity"; rarity: string }
  /** Fill every slot on the board yourself, with no Crumb Demons. */
  | { kind: "fullBoard" }
  /**
   * Win with a Crumb Demon on your board.
   *
   * Or: *"do a challenge for winning with a Crumb Demon on the board too."*
   *
   * The mirror of `fullBoard`, and the pair of them is the nicest thing in
   * this list: one asks you to leave nothing empty, the other asks you to
   * leave a square empty ON PURPOSE and win anyway. A Crumb Demon is not a
   * card anybody chose — it is what the panic drops into a slot nobody
   * filled — so this is a handicap you set yourself.
   */
  | { kind: "crumbWin" };

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
  /**
   * === AND THE SAME SENTENCE IN ENGLISH ===
   *
   * Or, with the challenges panel open in an English game: *"the challenges
   * are in Hebrew."*
   *
   * They were, and nothing could have translated them. Every other string
   * in the game is either in docs/COPY.md by id or carries `en` beside its
   * `he` in a data file; a challenge is BUILT, at run time, out of a
   * template and a card's name. There was no id to translate and no column
   * to put one in.
   *
   * So the templates say both, and the pools carry both names. `say()` in
   * the client picks one, like it does everywhere else.
   */
  en: string;
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

/**
 * A deterministic stream of numbers from a key.
 *
 * Exported because the shop draws today's cards the same way the day draws
 * its challenges (apps/server/src/cardShelf.ts), and "the same for everyone,
 * every time, with nothing stored" is a property worth having once rather
 * than twice.
 */
export function stream(key: string): () => number {
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
  /** Collectable cards: id and name, in both languages. */
  cards: ReadonlyArray<{ id: string; he: string; en: string }>;
  /** Series: id and name, in both languages. */
  series: ReadonlyArray<{ id: string; he: string; en: string }>;
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
    /*
     * ⚠ THE PERIOD, because a month is not a long week.
     *
     * Or: *"I have just finished a challenge to play 8 games in a month. It
     * is the 2nd of the month."* The counting templates were shared between
     * weekly and monthly and drew from the SAME range, so a month could ask
     * for eight games — which is a Tuesday. Every template that counts
     * matches now scales what it asks for by the period it is in.
     */
    period: Period,
  ): {
    goal: Goal;
    need: number;
    reward: Challenge["reward"];
    he: string;
    en: string;
  } | null;
}

function oneOf<T>(pick: () => number, xs: ReadonlyArray<T>): T | undefined {
  return xs.length ? xs[Math.floor(pick() * xs.length) % xs.length] : undefined;
}

/**
 * A series name with its article off, for when the name is used as an
 * adjective rather than as a name.
 *
 * Every English series name begins with "The" — The Giants, The Slimes — which
 * is right when the series is the subject and wrong the moment a card belongs
 * to it: "Put a The Giants card in the back row" went out on a challenge and
 * was read off the screen in a trailer frame. Hebrew does not have the problem,
 * because there the name follows a preposition that already carries the
 * article.
 */
function attr(name: string): string {
  return name.replace(/^The\s+/i, "");
}

/**
 * The same name with the article that fits in front of it.
 *
 * ⚠ AND THIS IS THE SECOND HALF OF THE BUG ABOVE. Taking "The" off the
 * front fixed "a The Insects card" into "a Insects card", which is wrong in
 * a quieter way and went out on the live site for a month. Ten families, one
 * of them beginning with a vowel, so nine rows read correctly and the tenth
 * read like a typo — which is exactly how it was missed.
 *
 * Hebrew does not need this: `מ${s.he}` already carries its own article.
 */
function one(name: string): string {
  return `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}`;
}

/*
 * ═══ THE SENTENCES, AND THE FOUR RULES THEY NOW KEEP ═══
 *
 * These were drafts — written to say the right thing in roughly the right
 * register so the screen could be built and looked at. Or, who is a
 * copywriter: *"go over the sentences and write them better."*
 *
 * What was wrong with them was not the words one at a time. It was that
 * twelve sentences had been written twelve separate times, so a player
 * reading nine rows down a panel had to parse nine different shapes. The
 * rules below are what the pass settled on, and a new template keeps them.
 *
 *   1. THE VERB FIRST, AND A VERB THAT MEANS SOMETHING. Hebrew runs
 *      right-to-left and the eye lands on the first word, so that word is
 *      the one worth spending. Five of the twelve opened with `לשחק` — the
 *      emptiest verb in a game that is entirely about playing. They open
 *      with `להילחם`, `להפיל`, `להכתיר`, `להדליק`, `למלא` now.
 *
 *   2. THE ROW ALREADY SAYS IT, SO THE SENTENCE DOES NOT. Beside every
 *      sentence sits a bar, a `3/5`, a gem and a period tab. A sentence
 *      that also carried the count said the same number twice — and said
 *      it worst where it mattered most: `לנצח 3 פעמים ולאבד כל פעם לא
 *      יותר מ-4 קלפים` is a sentence about arithmetic, not about a battle.
 *      The sentence describes ONE battle; the bar says how many.
 *
 *      ⚠ EXCEPT `play` AND `win`, where the count IS the goal. "Fight 60
 *      battles" is the whole task; "crown a Dragon" is the task and 20 is
 *      how often. Strip the number from the first and nothing is left.
 *
 *   3. THE GAME'S OWN WORDS, NOT THE ENGINE'S. The family bonus is the
 *      thing the tutorial calls `הסינרגיה נדלקת`, so a challenge asks to
 *      LIGHT one. The empty cells fill with `מפלצי פירורים`, a creature
 *      with a name and a face, so the full-board challenge names them
 *      rather than saying "by yourself". A match is a `קרב`.
 *
 *   4. SHORT, AND THIS ONE IS MEASURED. `.quests__what` is the `1fr` of a
 *      three-column row and it wraps; every sentence that takes a second
 *      line makes its row taller, on a screen that is 390 pixels tall with
 *      four rows and a header on it.
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
        he: `לצאת לקרב עם ${card.he}`,
        en: `Take ${card.en} into battle`,
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
        // `בחזית` and `מאחור` are the words Amanda uses in the tutorial;
        // `בשורה הקדמית` is the word the board file uses.
        he: row === "front" ? `לשים קלף מ${s.he} בחזית` : `לשים קלף מ${s.he} מאחור`,
        en:
          row === "front"
            ? `Put ${one(attr(s.en))} card up front`
            : `Put ${one(attr(s.en))} card at the back`,
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
        he: `לסיים קרב בציון ${least} ומעלה`,
        en: `Finish a battle on ${least} or better`,
      };
    },
  },
  {
    periods: ["daily", "weekly", "monthly"],
    make: (pick, _pools, period) => {
      // A day, a week of evenings, a month of them.
      const need = span(pick, period, [3, 5], [18, 30], [60, 90]);
      return {
        goal: { kind: "play" },
        need,
        reward: { diamonds: need * 3 },
        // Rule 2's exception: the count IS the goal here, so it stays.
        he: `להילחם ב-${need} קרבות`,
        en: `Fight ${need} battles`,
      };
    },
  },
  {
    periods: ["daily", "weekly", "monthly"],
    make: (pick, _pools, period) => {
      const need = span(pick, period, [2, 3], [10, 16], [35, 55]);
      return {
        goal: { kind: "win" },
        need,
        reward: { diamonds: need * 6 },
        he: `לנצח ב-${need} קרבות`,
        en: `Win ${need} battles`,
      };
    },
  },

  /* ═══ and the seven that ask for a decision ═══ */
  {
    periods: ["daily", "weekly", "monthly"],
    make: (pick, _pools, period) => {
      const need = span(pick, period, [1, 2], [5, 8], [18, 26]);
      return {
        goal: { kind: "crush" },
        need,
        reward: { diamonds: need * 8 },
        he: `להפיל מלך`,
        en: `Bring a King down`,
      };
    },
  },
  {
    periods: ["daily", "weekly", "monthly"],
    make: (pick, _pools, period) => {
      // The battle itself is fifteen seconds of simulated time at most, so
      // these are the matches that END early — a crown down in the first
      // exchange rather than a board that outlasted the clock.
      const seconds = 6 + Math.floor(pick() * 4); // 6..9
      const need = span(pick, period, [1, 1], [3, 5], [12, 18]);
      return {
        goal: { kind: "fastWin", seconds },
        need,
        reward: { diamonds: need * 10 },
        he: `לנצח תוך ${seconds} שניות`,
        en: `Win inside ${seconds} seconds`,
      };
    },
  },
  {
    periods: ["daily", "weekly", "monthly"],
    make: (pick, _pools, period) => {
      const lost = 2 + Math.floor(pick() * 3); // 2..4
      const need = span(pick, period, [1, 1], [3, 5], [12, 18]);
      return {
        goal: { kind: "hold", lost },
        need,
        reward: { diamonds: need * 9 },
        he: `לנצח ולאבד עד ${lost} קלפים`,
        en: `Win losing ${lost} cards at most`,
      };
    },
  },
  {
    periods: ["daily", "weekly", "monthly"],
    make: (pick, pools, period) => {
      const s = oneOf(pick, pools.series);
      if (!s) return null;
      const need = span(pick, period, [1, 2], [4, 7], [15, 22]);
      return {
        goal: { kind: "family", seriesId: s.id },
        need,
        reward: { diamonds: need * 7 },
        // The tutorial's own name for this moment is `הסינרגיה נדלקת`, so
        // the challenge asks the player to light one.
        he: `להדליק בונוס משפחה של ${s.he}`,
        en: `Light the ${attr(s.en)} family bonus`,
      };
    },
  },
  {
    periods: ["daily", "weekly", "monthly"],
    make: (pick, pools, period) => {
      const s = oneOf(pick, pools.series);
      if (!s) return null;
      const need = span(pick, period, [1, 2], [4, 6], [14, 20]);
      return {
        goal: { kind: "crown", seriesId: s.id },
        need,
        reward: { diamonds: need * 6 },
        he: `להכתיר קלף מ${s.he}`,
        en: `Crown ${one(attr(s.en))} card`,
      };
    },
  },
  {
    periods: ["daily", "weekly", "monthly"],
    make: (pick, _pools, period) => {
      const need = span(pick, period, [1, 2], [4, 7], [16, 24]);
      return {
        goal: { kind: "rarity", rarity: "epic" },
        need,
        reward: { diamonds: need * 7 },
        // Deliberately the same shape as the card template above it: both
        // of them ask for one thing to be fielded, so both read alike.
        he: `לצאת לקרב עם קלף אפי`,
        en: `Take an epic card into battle`,
      };
    },
  },
  {
    periods: ["daily", "weekly", "monthly"],
    make: (pick, _pools, period) => {
      const need = span(pick, period, [1, 2], [4, 7], [16, 24]);
      return {
        goal: { kind: "fullBoard" },
        need,
        reward: { diamonds: need * 8 },
        // Naming the Crumb Demons says what "by yourself" meant, in a
        // creature the player met in the tutorial and has a face for.
        he: `למלא את הלוח בלי מפלצי פירורים`,
        en: `Fill the board, no Crumb Demons`,
      };
    },
  },
  {
    /*
     * ═══ AND THE ONE THAT ASKS FOR THE OPPOSITE ═══
     *
     * Or: *"do a challenge for winning with a Crumb Demon on the board
     * too."*
     *
     * Read it next to the template above it. One says fill every square
     * yourself; this one says leave one empty and win anyway. Same board,
     * opposite instruction, and a child who has both live at once has to
     * decide which evening is which — which is the most a challenge can ask
     * of a game this short.
     *
     * ⚠ THEY CANNOT BOTH BE SATISFIED BY ONE MATCH, and that is deliberate
     * rather than a clash: `fullBoard` wants `placed >= 13` and this wants
     * a filler on the board, which is `placed < 13`. Nine are live at a
     * time out of thirteen, so the day they both come up is a day with a
     * real choice in it.
     */
    periods: ["daily", "weekly", "monthly"],
    make: (pick, _pools, period) => {
      const need = span(pick, period, [1, 2], [5, 8], [18, 26]);
      return {
        goal: { kind: "crumbWin" },
        need,
        reward: { diamonds: need * 7 },
        he: `לנצח עם מפלץ פירורים על הלוח`,
        en: `Win with a Crumb Demon on the board`,
      };
    },
  },
];

/**
 * How much a period asks for.
 *
 * Three ranges, one per period, and the seeded stream picks inside the one
 * that applies. Written as a helper rather than as a number in each template
 * because the bug Or found was a template that did not know which period it
 * was being built for — and a helper that TAKES the period cannot have it.
 */
function span(
  pick: () => number,
  period: Period,
  daily: [number, number],
  weekly: [number, number],
  monthly: [number, number],
): number {
  const [lo, hi] = period === "daily" ? daily : period === "weekly" ? weekly : monthly;
  return lo + Math.floor(pick() * (hi - lo + 1));
}

/**
 * How many of each period are live at once.
 *
 * Or: *"we need more challenges and another challenge and more variety."*
 * Four, three and two — nine live at a time out of thirteen templates, so two
 * days running are never the same list and a player who finishes the day's
 * four still has the week's three to work on.
 */
const HOW_MANY: Record<Period, number> = { daily: 4, weekly: 3, monthly: 2 };

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
    const built = usable[i]!.make(pick, pools, period);
    if (built) out.push({ id: `${LETTER[period]}:${key}:${i}`, period, ...built });
  }
  return out;
}

/**
 * Everything live right now: three daily, two weekly, one monthly.
 *
 * ═══ THE POOL IS PER PLAYER NOW; THE ID IS NOT ═══
 *
 * Or: *"the challenges have to match the arena I am in. I have a challenge
 * to fight with the Leviathan and I have not even reached the Pool."*
 *
 * The same bug the bot decks had, in the last place that still drew from the
 * whole catalogue: a challenge names a card, the pool of names was every
 * launch card in the game, and `familyOpen` was never asked. So a player in
 * the Games Room was sent after a card that cannot be in their album, cannot
 * come out of their chests and cannot be fielded against them — an errand
 * with no door.
 *
 * The CALLER now hands in a pool already filtered to the families this player
 * has met (apps/server/src/meta.ts). The id deliberately does not say which
 * pool it came from, and that is the decision worth writing down.
 *
 * ⚠ PUTTING THE RUNG IN THE ID COSTS A REWARD SOMEBODY EARNED. It is the
 * tidier design — one id, one challenge, for ever — and it was written that
 * way first. Then: `claim` finds a challenge by id in the player's current
 * list, so a challenge finished at the Games Room and not yet claimed
 * becomes "expired" the moment its owner reaches the Pitch. Early rungs come
 * fast — 150 trophies is five wins — so that is not a rare day, it is the
 * first evening.
 *
 * What the id costs instead: a slot can change which card it names while a
 * player's progress stays on it, so climbing mid-period can leave a
 * half-finished challenge pointing at a different monster. That errs
 * GENEROUS — the task is still a real task and you are part way through it —
 * and being generous on a rare edge beats taking back a prize that was won.
 */
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
  /** How long the battle ran, in seconds. */
  seconds: number;
  /** The match ended with a crown down rather than on the clock. */
  kingDown: boolean;
  /** How many of this player's own cards died. */
  lost: number;
  /** Real cards placed, Crumb Demons not counted. */
  placed: number;
  /** Rarities on the board. */
  rarities: string[];
  /** The family of the card on the crown, if there was one. */
  kingSeries: string | null;
  /** Families with enough cards on the board for the bonus to be live. */
  synergies: string[];
  /**
   * A Crumb Demon ended up on this player's board.
   *
   * Which is the same thing as "a square was left empty", because the filler
   * is dropped into every empty slot the moment a board locks (solo.ts). It
   * is read as `placements.length > real.length` rather than counted a
   * second way, so it cannot disagree with `placed` about the same board.
   */
  crumbs: boolean;
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
    case "crush":
      return facts.won && facts.kingDown ? 1 : 0;
    case "fastWin":
      return facts.won && facts.seconds <= goal.seconds ? 1 : 0;
    case "hold":
      return facts.won && facts.lost <= goal.lost ? 1 : 0;
    case "family":
      return facts.synergies.includes(goal.seriesId) ? 1 : 0;
    case "crown":
      return facts.kingSeries === goal.seriesId ? 1 : 0;
    case "rarity":
      return facts.rarities.includes(goal.rarity) ? 1 : 0;
    case "fullBoard":
      return facts.placed >= FULL_BOARD ? 1 : 0;
    case "crumbWin":
      // ⚠ AND THE WIN IS THE WHOLE POINT. Leaving a square empty is free;
      // leaving it empty and winning anyway is the challenge. Without the
      // win this is "lose a match badly", which happens on its own.
      return facts.won && facts.crumbs ? 1 : 0;
  }
}

/**
 * A board with nothing left empty.
 *
 * Twelve cells plus the crown. An empty cell is filled with a Crumb Demon
 * when the panic ends (config.ts), and those are not counted — so this is
 * "you placed everything yourself", which is a thing to aim at in the last
 * ten seconds rather than a thing that happens.
 */
export const FULL_BOARD = 13;
