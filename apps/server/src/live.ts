/**
 * The things Or can change without a deploy, loaded into this process.
 *
 * Or: *"in the admin interface I need to be able to manage everything… and
 * think what else needs managing and add it."* Cards already had this
 * (cards.ts); these are the three that did not.
 *
 *   PHRASES   the catchphrase lines. He writes the copy, and until now every
 *             word he changed was a deploy.
 *   SERIES    the shelf a card sits on: its name, its place in the album.
 *   TUNABLES  the numbers — what a win is worth, how long a phase lasts.
 *
 * ═══ WHY THE SERVER LOADS THEM AT ALL ═══
 *
 * Two of the three it needs for itself. The TUNABLES decide what a match
 * pays and how long its phases run, and the server is the authority on both —
 * a browser with a newer number than this process would count down to a
 * different second than the one the result was computed at. The PHRASES it
 * needs because it checks what a chest is allowed to contain against the list
 * of phrases that exist (progress.ts), so a line Or adds tonight has to be
 * grantable tonight.
 *
 * SERIES it does not need and loads anyway, for one reason: /api/live is one
 * request and the browser needs all three. A second endpoint to save this
 * process reading nine rows it ignores is a worse trade than the rows.
 *
 * ═══ REFRESHED WHEN TOLD, NOT POLLED ═══
 *
 * At boot, and again whenever the admin panel saves. An edit is a thing
 * somebody did; there is no reason to ask the database every thirty seconds
 * whether it has happened yet. Same arrangement as cards.ts.
 */
import { applyPhraseOverrides, applyTunables, type PhraseOverride } from "@amanda/shared";
import { db } from "./supabase.js";

export const liveState = {
  phrases: 0,
  series: 0,
  tunables: 0,
  lastError: null as string | null,
  loadedAt: null as string | null,
};

/** The series rows, as the browser will want them. The server itself ignores them. */
export interface SeriesOverride {
  id: string;
  active: boolean;
  data: Record<string, unknown>;
  sort: number | null;
}
let seriesRows: SeriesOverride[] = [];
export function seriesOverrides(): SeriesOverride[] {
  return seriesRows;
}

let phraseRows: PhraseOverride[] = [];
export function phraseOverrides(): PhraseOverride[] {
  return phraseRows;
}

let tunableRows: Record<string, number> = {};
export function tunableValues(): Record<string, number> {
  return tunableRows;
}

/**
 * Pull all three and apply the two that belong to this process.
 *
 * Every failure is swallowed on purpose. With no database, a broken table or
 * a row in a shape an older build does not understand, the game is exactly
 * what it shipped as — which is a complete game. Nothing in here is allowed
 * to be the reason a child cannot play, and a server that refuses to start
 * because a catchphrase is malformed would be exactly that.
 */
export async function refreshLive(): Promise<void> {
  const sb = db();
  if (!sb) return;
  try {
    const [phrases, series, tunables] = await Promise.all([
      sb.from("phrase_overrides").select("id, active, data"),
      sb.from("series_overrides").select("id, active, data, sort").order("sort"),
      sb.from("tunables").select("id, value"),
    ]);

    phraseRows = (phrases.data ?? []) as PhraseOverride[];
    liveState.phrases = applyPhraseOverrides(phraseRows);

    seriesRows = (series.data ?? []) as SeriesOverride[];
    liveState.series = seriesRows.length;

    // `numeric` comes back from PostgREST as a string often enough to be worth
    // not trusting: Number() here rather than a cast, and a value that is not
    // a number is dropped by applyTunables rather than becoming NaN seconds.
    tunableRows = Object.fromEntries(
      (tunables.data ?? []).map((r) => [String(r.id), Number(r.value)]),
    );
    liveState.tunables = applyTunables(tunableRows);

    liveState.lastError = null;
    liveState.loadedAt = new Date().toISOString();
  } catch (err) {
    liveState.lastError = (err as Error).message;
  }
}

