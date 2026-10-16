/**
 * The things the server can refuse, named.
 *
 * ═══ WHY CODES AND NOT SENTENCES ═══
 *
 * The server used to return the Hebrew sentence itself and the client printed
 * it. That works exactly until the game has two languages, which it now does:
 * Or, going through the English build — *"not all the texts are translated."*
 * Most of what he found was in the client and is fixed; the rest was here,
 * where a request that fails answers in Hebrew whoever asked it.
 *
 * The server cannot translate, and should not have to. It does not know who
 * is asking or what language they chose, and threading a locale through every
 * endpoint to reach a dozen error paths is the tail wagging the dog. What it
 * knows is WHY it refused — so that is what it says, and the client, which
 * does know the language, turns it into words.
 *
 * meta.ts already did this for the challenge claims ("expired", "notDone",
 * "claimed"). This is the same idea with a name.
 *
 * ═══ THE CODES ARE A PROMISE ═══
 *
 * They go over the wire, so an old client can receive a new code. Adding one
 * is free; RENAMING one breaks every client still running the old build,
 * which on a phone can be weeks. Rename nothing — add, and leave the old one
 * mapped.
 *
 * The words live in the client, in game/serverError.ts, so they go through
 * the same copy document as every other string Or edits.
 */

export const SERVER_ERRORS = [
  // ── friends ──
  /** You asked to befriend yourself. */
  "friend.self",
  /** Adding friends needs a real account. */
  "friend.needAccount",
  /** The other player has no account to befriend. */
  "friend.theyNeedAccount",
  /** You have not played them, which is the rule for adding anybody. */
  "friend.notPlayed",
  "friend.already",
  "friend.pending",
  /** Too many of your requests are still unanswered. */
  "friend.tooMany",
  /** The request being accepted or declined is gone. */
  "friend.noRequest",
  /**
   * No such code — or one you may not use.
   *
   * Deliberately ONE code for both. A field that answers "that code does
   * not exist" differently from "that is not yours" is a field you can ask
   * questions with, 887 million at a time.
   */
  "friend.codeUnknown",

  // ── upgrading a card ──
  /*
   * These were English developer strings — "you do not have that card",
   * "already at the top" — sent straight to a child's screen. serverError.ts
   * had already noticed the leak and closed it with a generic message; this
   * is the other half, so the screen can say what actually happened.
   */
  /** Not enough copies yet. Carries `short`: how many are missing. */
  "level.copies",
  /** Level 10. There is nowhere above it. */
  "level.max",
  /** The album has no such card, which means it is not yours to upgrade. */
  "level.notYours",

  // ── reports ──
  "report.needAccount",
  /** A bug report with nothing in it. */
  "report.empty",
  "report.whoAbout",
  "report.self",
  "report.notRegistered",
  "report.notPlayed",
  /** Rate limit: too many reports from one player in an hour. */
  "report.tooMany",

  // ── shop ──
  "shop.gone",
  "shop.notYet",
  "shop.ended",
  "shop.owned",
  /** Not enough diamonds. Carries `short`: how many are missing. */
  "shop.poor",

  // ── anything that failed on the way to the database ──
  /** Nothing is wrong with the request; it just did not work. Try again. */
  "retry",
] as const;

export type ServerError = (typeof SERVER_ERRORS)[number];

/**
 * An error a code alone cannot carry.
 *
 * Only one so far: "you are short N diamonds" needs N. Shaped as an object so
 * the next one does not need a second mechanism — and so the client can tell
 * a code from a legacy sentence by its type.
 */
export interface ServerErrorWithValue {
  code: ServerError;
  value: number;
}

export function errorWithValue(code: ServerError, value: number): ServerErrorWithValue {
  return { code, value };
}

const KNOWN = new Set<string>(SERVER_ERRORS);

/** Is this one of ours, or a sentence from a server that has not updated? */
export function isServerError(x: unknown): x is ServerError {
  return typeof x === "string" && KNOWN.has(x);
}
