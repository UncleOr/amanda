/**
 * The numbers Or may turn from the admin panel, and only these.
 *
 * ═══ WHY THIS IS A SHORT LIST AND NOT "EDIT config.ts FROM A FORM" ═══
 *
 * config.ts holds three very different kinds of number, and only one of them
 * belongs in a form.
 *
 *   STRUCTURE. The board is 4×4, the arena is eight columns, a tick is a
 *   thirtieth of a second. Changing one of these does not rebalance the game,
 *   it breaks it — the geometry is baked into the engine, the layout and the
 *   replay format at once.
 *
 *   BATTLE MATHS. The King's ×3 health, the deck size, Amanda's guard
 *   density. These are safe to change in principle and dangerous to change
 *   HERE, and the reason is the netcode: the server simulates a battle and
 *   both browsers replay it from the same seed. If one side has a newer value
 *   than the other, the replay disagrees with the result — so the game shows
 *   one player winning a match the server recorded as a loss. A deploy
 *   changes everybody at once; a database row does not.
 *
 *   PACING AND REWARD. How long each phase lasts, what a win is worth. The
 *   server is the authority on both, no simulation depends on them, and a
 *   browser with a stale value is at worst a second out on a countdown it
 *   does not control anyway.
 *
 * Only the third kind is here. The second kind will be too, once the result
 * message carries the values it was computed with — until then it would be a
 * dial labelled "desync the game".
 *
 * Every entry says what it DOES, because "trophies on a win" explains itself
 * and the ones that do not are exactly the ones that get turned by accident.
 */
import { PHASES } from "./config.js";

/**
 * Trophies, in one place.
 *
 * They were in two: `TROPHIES` in config.ts said 25 and −20 and was imported
 * by nothing at all, while the server used its own TROPHIES_PER_WIN = 30 and
 * TROPHIES_PER_LOSS = 20. The config one was dead code that looked
 * authoritative, which is the worst kind. This is now the only one.
 */
export const TUNED = {
  trophiesPerWin: 30,
  trophiesPerLoss: 20,
  /*
   * Beating the computer, by setting. See soloTrophies.ts for why these are
   * much smaller than a win against a person, why losing to it costs nothing,
   * and why a day of it is capped.
   */
  soloTrophiesNormal: 8,
  soloTrophiesHard: 12,
  soloTrophiesPerDay: 60,
  /*
   * ═══ AN UPGRADE COSTS DIAMONDS AS WELL AS COPIES ═══
   *
   * Or, asking for the upgrade button: *"'3/4 cards to upgrade', and then an
   * upgrade button (+ what the diamond cost is)."*
   *
   * There was no diamond cost — an upgrade took copies and nothing else —
   * and the bracket is the interesting half of that sentence. Copies arrive
   * on their own from chests, so an upgrade you can afford is an upgrade you
   * simply take; there is no decision in it. Diamonds are the one thing you
   * spend somewhere ELSE, so a price in diamonds is what turns "upgrade this
   * card" into a choice against the shop.
   *
   * `levelDiamonds` multiplies this by the level being left, so going 1→2 is
   * 10 and 9→10 is 90: four hundred and fifty to take one card all the way,
   * against the hundreds a season of chests pays out. Cheap enough that a
   * seven-year-old is never stuck, dear enough to be a decision.
   *
   * Tunable, because this is exactly the number Or will want to move once
   * they have played a week with it. It is the price of the FIRST upgrade;
   * see `levelDiamonds` for how it climbs from there.
   */
  diamondsPerLevel: 10,
  /*
   * What sixteen cards may cost between them.
   *
   * Or: *"I think we should lower the deck budget a bit, it's too easy.
   * Let's try 40 (this is the kind of thing I need control over from the
   * admin panel)."*
   *
   * 47 and not 40, and the floor is measured rather than argued: a new
   * player owns six cards at three copies each, and the cheapest legal
   * sixteen of those costs 47. At 40 nobody who installed the game today can
   * save a deck at all. The dial below goes down to 16 so he can try 40 the
   * moment the testers have a chest or two in them — see decks.ts.
   */
  deckBudget: 60,
  /*
   * ═══ MORE TROPHIES FOR A BETTER GAME ═══
   *
   * Or: *"you should get more trophies if you win with a high score."*
   *
   * `score` is the 1–10 grade the battle report already computes. Only the
   * part ABOVE `trophyScoreFrom` earns, because five is an ordinary game and
   * paying a bonus for an ordinary game is paying a bonus for turning up.
   *
   * At 5 and 1: a perfect ten is worth five more trophies against a person
   * and two more against a bot (halved there — see trophies.ts). The median
   * win is worth exactly the base, which is the point.
   */
  trophyScoreFrom: 5,
  trophiesPerScorePoint: 1,
};

/**
 * Diamonds to take a card from `level` to the next.
 *
 * ═══ IT GETS DEARER, AND NOT IN A STRAIGHT LINE ═══
 *
 * Or: *"note that upgrading from 1 to 2 for 10 diamonds is fine, but it
 * should go up gradually, so that 4 to 5 is already expensive and not a
 * freebie."*
 *
 * It was `10 x level` — 10, 20, 30, 40 — which is a straight line, and a
 * straight line is exactly what he is describing as wrong: the tenth
 * upgrade should not feel like the first one four times over.
 *
 * Geometric at 1.6, which is not a new number: it is the same growth
 * `levelCost` already uses for the COPIES an upgrade costs (LEVELS.
 * costGrowth). The two prices of one upgrade now climb together instead of
 * one flattening out under the other.
 *
 *     level  1->2   2->3   3->4   4->5   5->6   ...   9->10
 *     copies    4      7     11     17     27           172
 *     gems     10     16     26     41     66           430
 *
 * Four to five is 41 diamonds and seventeen copies, against a chest that
 * pays 5 to 40. That is the "not a freebie" he asked for.
 *
 * Here rather than beside `levelCost` in config.ts because it reads TUNED,
 * and tunables.ts already imports config.ts — a cycle between the two would
 * be a strange way to find out that a constant moved. Read at CALL time, so
 * the dial changes the next upgrade rather than the next deploy.
 */
export function levelDiamonds(level: number): number {
  const base = TUNED.diamondsPerLevel;
  return Math.round(base * Math.pow(1.6, Math.max(1, level) - 1));
}

export interface Tunable {
  id: string;
  he: string;
  /** What changing it actually does, in a sentence. */
  note: string;
  min: number;
  max: number;
  step: number;
  get(): number;
  set(v: number): void;
}

/** Clamp on the way in, so a bad row cannot break a match. */
function clamp(v: number, t: Pick<Tunable, "min" | "max">): number {
  return Math.min(t.max, Math.max(t.min, v));
}

/*
 * PHASES is an `as const` export, but at runtime it is an ordinary object and
 * these setters write to it in place. That is deliberate: everything in the
 * game imports the same object, so one write is seen everywhere without a
 * single component subscribing to anything.
 */
/*
 * `as const` makes `seconds: 90` the literal TYPE 90, not `number`, so merely
 * stripping `readonly` is not enough to assign 85 to it. This widens the
 * property as well — which is exactly as true at runtime, where the object has
 * always been an ordinary one with an ordinary number in it.
 */
const seconds = (phase: { readonly seconds: number }) => phase as { seconds: number };

export const TUNABLES: Tunable[] = [
  {
    id: "phases.build",
    he: "שניות בנייה",
    note: "כמה זמן יש לבנות את הלוח. קצר מדי והמשחק מלחיץ, ארוך מדי והוא נגרר.",
    min: 20,
    max: 180,
    step: 5,
    get: () => PHASES.build.seconds,
    set: (v) => (seconds(PHASES.build).seconds = v),
  },
  {
    id: "phases.panic",
    he: "שניות פאניקה",
    note: "הזמן שבו המלך של היריב נחשף ועוד אפשר להגיב. כאן חיים הקאונטרים.",
    min: 5,
    max: 60,
    step: 1,
    get: () => PHASES.panic.seconds,
    set: (v) => (seconds(PHASES.panic).seconds = v),
  },
  {
    id: "phases.battle",
    he: "שניות קרב",
    note: "אורך הקרב. קרב שנגמר בזמן מוכרע בשובר-שוויון, אז זה משנה מי מנצח.",
    min: 15,
    max: 120,
    step: 5,
    get: () => PHASES.battle.seconds,
    set: (v) => (seconds(PHASES.battle).seconds = v),
  },
  {
    id: "trophies.win",
    he: "גביעים על ניצחון",
    note: "כמה עולים בניצחון — וגם כמה מהר מטפסים בין הארנות.",
    min: 1,
    max: 200,
    step: 1,
    get: () => TUNED.trophiesPerWin,
    set: (v) => (TUNED.trophiesPerWin = v),
  },
  {
    id: "trophies.solo.normal",
    he: "גביעים על ניצחון מול בוט רגיל",
    note: "בהרבה פחות מניצחון מול אדם, אחרת הארנות מודדות שעות ולא מיומנות. הבוט הקליל תמיד נותן אפס.",
    min: 0,
    max: 30,
    step: 1,
    get: () => TUNED.soloTrophiesNormal,
    set: (v) => (TUNED.soloTrophiesNormal = v),
  },
  {
    id: "trophies.solo.hard",
    he: "גביעים על ניצחון מול בוט קשה",
    note: "הפער בינו לבין הרגיל הוא הדבר היחיד שבקשה מזויפת יכולה להרוויח — השרת לא יכול להבדיל ביניהם מהלוח. כדאי שיישאר קטן.",
    min: 0,
    max: 30,
    step: 1,
    get: () => TUNED.soloTrophiesHard,
    set: (v) => (TUNED.soloTrophiesHard = v),
  },
  {
    id: "trophies.solo.perDay",
    he: "תקרת גביעים יומית מול הבוט",
    note: "הכי הרבה שיום של משחק מול המחשב יכול להוסיף. בלי תקרה אפשר להגיע לארנה העליונה בלי לפגוש אף אחד.",
    min: 0,
    max: 500,
    step: 5,
    get: () => TUNED.soloTrophiesPerDay,
    set: (v) => (TUNED.soloTrophiesPerDay = v),
  },
  {
    id: "levels.diamonds",
    he: "יהלומים לשדרוג",
    note: "המחיר ביהלומים לשדרוג הראשון. משם הוא מטפס פי 1.6 לרמה, כמו מחיר העותקים. 10 = 10 לרמה 2, 41 לרמה 5, 430 לרמה 10.",
    min: 0,
    max: 100,
    step: 1,
    get: () => TUNED.diamondsPerLevel,
    set: (v) => (TUNED.diamondsPerLevel = v),
  },
  {
    id: "trophies.scorePoint",
    he: "גביעים לכל נקודת ציון",
    note: "כמה גביעים מוסיפה כל נקודת ציון מעל 5. 1 = ניצחון בציון 10 שווה 5 גביעים נוספים מול בן אדם, 2 מול בוט. אפס מבטל את הבונוס.",
    min: 0,
    max: 10,
    step: 1,
    get: () => TUNED.trophiesPerScorePoint,
    set: (v) => (TUNED.trophiesPerScorePoint = v),
  },
  {
    id: "decks.budget",
    he: "תקציב דק",
    note: "כמה 18 הקלפים יכולים לעלות ביחד. מתחת ל-57 שחקן חדש לא יכול לבנות דק בכלל — האלבום ההתחלתי הוא שישה קלפים, מותר שלושה מכל אחד, וזה בדיוק 18 קלפים שעולים 57.",
    /*
     * The floor, not a taste. Six starter cards at 4+5+4+2+1+3, three of
     * each, is exactly eighteen entries for 57 — there is no cheaper legal
     * deck because there is no other card to reach for. The dial used to
     * go down to 16 so Or could try 40; with eighteen cards that setting
     * would hand a new player a deck they cannot save, so the dial no
     * longer goes there.
     */
    min: 57,
    max: 80,
    step: 1,
    get: () => TUNED.deckBudget,
    set: (v) => (TUNED.deckBudget = v),
  },
  {
    id: "trophies.loss",
    he: "גביעים על הפסד",
    note: "כמה יורדים בהפסד. פחות מניצחון, אחרת ערב של משחק לא מתקדם לשום מקום.",
    min: 0,
    max: 200,
    step: 1,
    get: () => TUNED.trophiesPerLoss,
    set: (v) => (TUNED.trophiesPerLoss = v),
  },
];

const BY_ID = new Map(TUNABLES.map((t) => [t.id, t]));

/** Everything as it stands now, for the admin panel to show. */
export function readTunables(): Record<string, number> {
  return Object.fromEntries(TUNABLES.map((t) => [t.id, t.get()]));
}

/**
 * Apply a saved set.
 *
 * Unknown ids are ignored and values out of range are clamped rather than
 * refused. This runs at boot on the server and in every browser, and a stale
 * row written by an older version of the panel must never be the reason a
 * child cannot play. Returns how many were applied, for the health check.
 */
export function applyTunables(values: Record<string, unknown>): number {
  let applied = 0;
  for (const [id, raw] of Object.entries(values)) {
    const t = BY_ID.get(id);
    if (!t || typeof raw !== "number" || !Number.isFinite(raw)) continue;
    t.set(clamp(raw, t));
    applied++;
  }
  return applied;
}
