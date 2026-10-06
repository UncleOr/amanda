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
};

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
