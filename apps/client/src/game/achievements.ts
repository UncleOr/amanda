/**
 * What the player has earned, and telling Google about it.
 *
 * Or approved the eighteen in docs/ACHIEVEMENTS.md. This is the half that
 * decides WHICH are earned; the half that reports them lives behind
 * `bridge`, which does nothing at all on the web.
 *
 * ═══ WHY THE DECIDING IS A PURE FUNCTION ═══
 *
 * `earned()` takes a snapshot and returns ids. It touches no globals, talks
 * to nothing, and can therefore be tested — which matters more here than
 * usual, because the thing it drives cannot be: Play Games does not exist in
 * a browser, and the Android wrapper that would carry it has to be built on
 * a machine that is not this one.
 *
 * So the rule is: everything that can be decided in JavaScript is decided
 * here and pinned by tests, and the native side is left with one job it
 * cannot get wrong — pass this id on.
 *
 * ═══ THE IDS ARE THE ICON FILENAMES ═══
 *
 * `taught` is store/achievements/taught.png. Google issues its own opaque
 * ids (`CgkI...`) when the achievements are created in the console, and
 * PLAY_IDS below is where those go. Keeping our own names as the primary
 * ones means this file stays readable, and a missing mapping is a silent
 * no-op rather than a wrong unlock.
 */
import { ARENAS } from "@amanda/shared";

/** Everything the decision needs, and nothing else. */
export interface Snapshot {
  /** The tutorial has been finished, both lessons. */
  tutorialDone: boolean;
  trophies: number;
  /** Card ids the album holds. */
  album: Set<string>;
  /** Series id → how many of that series exist in the game. */
  seriesSizes: Map<string, number>;
  /** Series id of each owned card, to count a complete family. */
  seriesOf: (cardId: string) => string | undefined;
}

/** What a finished match adds, when there was one. */
export interface MatchOutcome {
  won: boolean;
  /** A touching trio of one family was lit on your board. */
  synergy: boolean;
  /**
   * Your King finished on full health.
   *
   * The one achievement on Or's list that needed new code, and it is worth
   * it: every other one rewards persistence, and this one rewards a board
   * built so that nothing ever reached the crown.
   */
  kingUntouched: boolean;
  /** This match was against a friend rather than the bot or a stranger. */
  againstFriend: boolean;
}

export const ACHIEVEMENTS = [
  "taught",
  "first_win",
  "arena_court",
  "arena_station",
  "arena_alley",
  "arena_fuel",
  "cards_10",
  "album_half",
  "album_full",
  "family",
  "chuppy",
  "legend",
  "trio",
  "untouched_king",
  "wins_10",
  "wins_50",
  "chests_10",
  "friend",
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number];

/** Which arena achievement each rung of the ladder unlocks. */
const ARENA_ACHIEVEMENT: Record<string, AchievementId> = {
  court: "arena_court",
  station: "arena_station",
  alley: "arena_alley",
  fuel: "arena_fuel",
};

/** The card that is its own achievement, and the family that is nearly empty. */
const CHUPPY = "furries_01_chuppy";
const LEGENDS = "legends";

/**
 * Everything earned by the state in this snapshot.
 *
 * Returns the full set every time rather than a difference. Unlocking an
 * achievement that is already unlocked is free and idempotent on Google's
 * side, and "what is true now" is a far easier thing to be right about than
 * "what changed since last time" — which needs a memory, and a memory that
 * is wrong once is wrong forever.
 */
export function earned(s: Snapshot, m?: MatchOutcome): AchievementId[] {
  const out: AchievementId[] = [];

  if (s.tutorialDone) out.push("taught");

  // The ladder, read from the same table the game ranks you with.
  for (const arena of ARENAS) {
    const id = ARENA_ACHIEVEMENT[arena.id];
    if (id && s.trophies >= arena.from) out.push(id);
  }

  // The album.
  const n = s.album.size;
  let total = 0;
  for (const size of s.seriesSizes.values()) total += size;
  if (n >= 10) out.push("cards_10");
  if (total && n >= Math.ceil(total / 2)) out.push("album_half");
  if (total && n >= total) out.push("album_full");

  // A complete family. Counted per series rather than "ten of something",
  // because two of the seven families are one card long today — and a rule
  // that says "ten" would quietly make those two impossible.
  const bySeries = new Map<string, number>();
  for (const cardId of s.album) {
    const sid = s.seriesOf(cardId);
    if (sid) bySeries.set(sid, (bySeries.get(sid) ?? 0) + 1);
  }
  for (const [sid, have] of bySeries) {
    const size = s.seriesSizes.get(sid) ?? 0;
    // Families of one are not an achievement; `chuppy` and `legend` are
    // those two cards' own achievements and this would duplicate them.
    if (size >= 2 && have >= size) {
      out.push("family");
      break;
    }
  }

  if (s.album.has(CHUPPY)) out.push("chuppy");
  for (const cardId of s.album) {
    if (s.seriesOf(cardId) === LEGENDS) {
      out.push("legend");
      break;
    }
  }

  // And what this match did, if a match just ended.
  if (m) {
    if (m.won) out.push("first_win");
    if (m.synergy) out.push("trio");
    if (m.won && m.kingUntouched) out.push("untouched_king");
    if (m.againstFriend) out.push("friend");
  }

  return out;
}

/* ───────────── telling Google ───────────── */

/**
 * Our id → the id Google issued.
 *
 * Filled in from the Play Console once the eighteen are created there. An id
 * that is not here is simply not reported: a missing mapping must never
 * unlock the wrong achievement, and on the web every one of them is missing
 * anyway.
 */
export const PLAY_IDS: Partial<Record<AchievementId, string>> = {};

/** What the Android wrapper provides. Absent in a browser, which is the point. */
interface Bridge {
  unlock(playId: string): void;
  increment(playId: string, steps: number): void;
}

function bridge(): Bridge | null {
  const w = window as unknown as { AmandaGames?: Bridge };
  return w.AmandaGames ?? null;
}

/** Report everything true right now. Silent and free when there is no bridge. */
export function report(s: Snapshot, m?: MatchOutcome): void {
  const b = bridge();
  if (!b) return;
  for (const id of earned(s, m)) {
    const playId = PLAY_IDS[id];
    if (playId) b.unlock(playId);
  }
}

/**
 * One more win, one more chest.
 *
 * Incremental achievements keep their count on GOOGLE's side, which is why
 * `wins_10`, `wins_50` and `chests_10` are not decided by `earned` above.
 *
 * The account this game keeps has trophies, diamonds, nachos and an album —
 * and no lifetime count of wins OR of chests opened. The first draft of this
 * file decided `chests_10` from a `chestsOpened` field, and the field did
 * not exist; the test counting the total was what noticed. Without Play
 * Games all three would have needed a new column.
 */
export function step(id: AchievementId, by = 1): void {
  const b = bridge();
  const playId = PLAY_IDS[id];
  if (b && playId) b.increment(playId, by);
}
