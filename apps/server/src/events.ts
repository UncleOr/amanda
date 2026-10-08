/**
 * Writing down what happened, so the admin panel can be asked about it.
 *
 * Or: *"in the admin panel give me statistics too — how many games each user
 * played, how many wins, losses, app usage, purchases, user behaviour
 * (abandoning mid-game for instance), how many playground games, what users
 * like most. Think of lots of information and statistics I can get."*
 *
 * None of that was answerable, and the reason was not that the queries were
 * hard. The game was not writing it down: `matches` holds PvP games only and
 * had five rows against fifty players, because every game against the
 * computer, every playground session, every quit and every app open left no
 * trace.
 *
 * ═══ EVERY WRITE HERE IS ALLOWED TO FAIL ═══
 *
 * Nothing in this file is awaited by anything that matters and nothing throws
 * out of it. A statistic is worth exactly as much as a statistic; a match
 * result, a purchase or a chest is worth a great deal more, and none of them
 * may ever be lost, delayed or made to fail because the thing counting them
 * had a bad minute. Hence `void track(...)` at every call site and a catch
 * that keeps its mouth shut.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "./supabase.js";

/**
 * What is worth counting.
 *
 * Kept as a union rather than free strings so that a typo is a build error
 * rather than a statistic that is quietly always zero — which is the failure
 * mode of every analytics system that has ever been written.
 */
export type EventKind =
  /** The game was opened. One a visit, which makes it the usage number. */
  | "open"
  /** A match ENDED, however it ended. The mode says which kind. */
  | "match"
  /** Somebody left while a match was still running. */
  | "quit"
  /**
   * A playground session ended.
   *
   * Its own kind rather than a kind of match, because this is the one event
   * the browser reports and a browser that may report matches may report
   * WINS. The playground has no result and no reward, so a forged one is
   * worth nothing — see FROM_BROWSER in api.ts.
   */
  | "playground"
  /** Something was bought from the shop. */
  | "buy"
  /** A chest was opened. */
  | "chest"
  /** A challenge reward was taken. */
  | "claim"
  /**
   * A screen crashed on somebody's phone.
   *
   * Or has hit "error showing the battle" twice, and both times the actual
   * error went to `console.error` — which on the phone a child is playing on
   * is nowhere. A crash nobody can read is a crash that gets reported as "it
   * did the thing again".
   */
  | "crash"
  /**
   * Somebody used the admin panel.
   *
   * There are endpoints behind that panel which mint currency, suspend a
   * child and delete an account, and until now none of them left a trace. A
   * tool that can do those things without a record of who did them is not a
   * tool anybody should be comfortable handing to a second person.
   */
  | "admin";

/** How big a `data` bag may be. See the client-facing endpoint. */
export const MAX_EVENT_BYTES = 800;

/**
 * Write one down. Never throws, never awaited for correctness.
 *
 * `playerId` may be null: a guest who opens the game and plays the computer
 * is a real person having a real session, and leaving them out would make the
 * usage numbers describe only the people who signed up.
 */
export function track(
  sb: SupabaseClient | null,
  playerId: string | null,
  kind: EventKind,
  data: Record<string, unknown> = {},
): void {
  const client = sb ?? db();
  if (!client) return;
  void client
    .from("events")
    .insert({ player_id: playerId, kind, data })
    .then(
      () => undefined,
      () => undefined,
    );
}
