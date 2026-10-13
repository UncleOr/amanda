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
import type { BattleResult, Owner } from "@amanda/engine";

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

/* ───────────── reading a finished battle ───────────── */

/**
 * What the match that just ended was worth, read from the battle itself.
 *
 * ═══ WHY FROM THE RESULT AND NOT FROM THE SCREEN ═══
 *
 * Both of the things this decides are visible on the board while you play —
 * the lit trio glows, and the King's health bar is right there — and reading
 * them from App's state would have been shorter. It would also have been
 * wrong by the time it ran: this is called when the result ARRIVES, and by
 * then `m.placements` is whatever survived the round being cleared.
 *
 * `BattleResult` is the one thing that cannot have moved on. It is what the
 * server and the client both ran, it is already in hand, and it carries the
 * answer to both questions.
 */
export function outcomeOf(
  result: BattleResult,
  side: Owner,
  againstFriend: boolean,
): MatchOutcome {
  const mine = result.finalUnits.filter((u) => u.owner === side);
  return {
    won: result.winner === side,
    /*
     * The engine marks every unit that was in a touching group of its family
     * when the board locked (`setup.ts` sets `flags.synergy`, and that is the
     * same flag the +20% rides on). So the achievement asks the battle what
     * was lit rather than recomputing the rule a third time.
     */
    synergy: mine.some((u) => u.flags.synergy === true),
    kingUntouched: kingWasUntouched(result, side),
    againstFriend,
  };
}

/**
 * Did your King come through without being hit even once?
 *
 * ═══ EVENTS, NOT THE HEALTH BAR ═══
 *
 * `king.hp === king.maxHp` is the obvious test and it is a lie: `healAura`
 * is in the game (abilities.ts), several cards carry it, and a King that was
 * beaten down and then healed back up finishes on full health having very
 * much been touched. Or's own words for this one were *"a win without the
 * King taking damage"* — damage, not health.
 *
 * So it reads the damage events. A hit that did nothing — a zero after
 * mitigation — is not damage and does not count against it.
 */
export function kingWasUntouched(result: BattleResult, side: Owner): boolean {
  const king = result.finalUnits.find((u) => u.isKing && u.owner === side);
  // No King on the board at all is not an untouched King.
  if (!king) return false;
  return !result.events.some(
    (e) => e.type === "hit" && e.targetUid === king.uid && (e.damage ?? 0) > 0,
  );
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

/**
 * ═══ THE PLUGIN, LOADED ONLY IF IT IS THERE ═══
 *
 * `@modbender/capacitor-play-games` — checked on the npm registry rather
 * than assumed: v0.5.0, published a month ago, peered to `@capacitor/core`
 * ^8. It exposes `unlockAchievement` and `incrementAchievement`, which is
 * exactly the two calls this file needs, and it means the native half is a
 * maintained plugin rather than a hundred lines of Java that could not be
 * compiled on this machine.
 *
 * It is a 0.x, and that is worth saying out loud. The mitigation is the
 * shape of this file: everything that decides anything is above, in a pure
 * function with tests, and the plugin is reached through one `await import`
 * that is allowed to fail. If it breaks or is dropped, what is lost is the
 * reporting, not the game.
 *
 * Imported dynamically, never statically, so that the web build does not
 * carry a native plugin it can never call — and so a browser, where there
 * is no plugin at all, takes the quiet path instead of throwing on load.
 */
type Games = {
  unlockAchievement(o: { id: string }): Promise<unknown>;
  incrementAchievement(o: { id: string; steps?: number; amount?: number }): Promise<unknown>;
};

let games: Games | null | undefined;

async function plugin(): Promise<Games | null> {
  if (games !== undefined) return games;
  try {
    /*
     * The specifier is a variable on purpose.
     *
     * The package is not installed yet — it arrives with the Android
     * wrapper, and until then a static import would fail `tsc` and a
     * bundler would try to resolve something that is not there. Written
     * this way the web build is unaffected and this file is already
     * complete, so installing the package is the only step left.
     */
    const specifier = "@modbender/capacitor-play-games";
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      PlayGames?: Games;
    };
    games = mod.PlayGames ?? null;
  } catch {
    // A browser, or a build without the plugin. Both are normal.
    games = null;
  }
  return games;
}

/**
 * Report everything true right now. Silent and free where there is no
 * plugin, which is every browser the game runs in today.
 *
 * Nothing awaits this and nothing reads its result: an achievement that
 * fails to register is a disappointment, and an achievement that blocks the
 * result screen is a bug.
 */
export function report(s: Snapshot, m?: MatchOutcome): void {
  void (async () => {
    const g = await plugin();
    if (!g) return;
    const ids = earned(s, m);
    /*
     * ═══ THE ONE LINE THAT MAKES THIS DEBUGGABLE FROM A PHONE ═══
     *
     * Deliberately not behind DEV. The wrapper loads the LIVE site, so the
     * build running on Or's phone IS the production one — a dev-only log
     * would be invisible in the only place it is ever needed.
     *
     * It costs nothing in a browser, because a browser never gets here: no
     * plugin, and the line above has already returned. So this prints on a
     * device and nowhere else, which is exactly where the question "did it
     * decide nothing, or did it decide something and fail to send it?" gets
     * asked.
     */
    console.info("[play-games] earned:", ids.join(", ") || "(none)");
    for (const id of ids) {
      const playId = PLAY_IDS[id];
      if (!playId) continue;
      try {
        await g.unlockAchievement({ id: playId });
      } catch {
        /* one failing unlock must not stop the rest */
      }
    }
  })();
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
  const playId = PLAY_IDS[id];
  if (!playId) return;
  void (async () => {
    const g = await plugin();
    if (!g) return;
    try {
      await g.incrementAchievement({ id: playId, steps: by });
    } catch {
      /* best effort, like report */
    }
  })();
}
