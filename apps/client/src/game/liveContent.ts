/**
 * The things Or changed since this build shipped, applied in the browser.
 *
 * Three of them, in one request (`/api/live`):
 *
 *   PHRASES   the catchphrase lines, which are his job and were a deploy
 *   SERIES    the shelves in the album — their names and their order
 *   TUNABLES  the numbers, so this screen counts down to the same second the
 *             server does
 *
 * The cards have had this since cards.ts; this is the same idea for
 * everything else, and deliberately the same SHAPE, so there is one thing to
 * understand rather than four.
 *
 * ═══ NOTHING WAITS FOR IT ═══
 *
 * The game ships with every phrase, every series and every number it needs,
 * and is a complete game with the tables empty, the server down, or a phone
 * on no signal. This is fired off at boot and whatever it finds is applied
 * when it lands — a child pressing play must never be waiting on it.
 *
 * ═══ WHY THE TUNABLES MATTER MORE THAN THEY LOOK ═══
 *
 * They include the phase lengths, and the clock on the build screen is drawn
 * from them. The server is the authority — it decides when a phase ends — so
 * a browser holding an older number does not change the game, it just shows a
 * countdown that disagrees with it. Applying them here is what keeps the two
 * telling the same story. See packages/shared/src/tunables.ts for the much
 * sharper reason that the BATTLE maths is not on that list.
 */
import { applyPhraseOverrides, applyTunables, type PhraseOverride } from "@amanda/shared";
import { SERIES } from "../data/catalog";

const SERVER_HTTP = (
  import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? "ws://localhost:2567" : "")
)
  .replace(/^ws:/, "http:")
  .replace(/^wss:/, "https:");

interface SeriesRow {
  id: string;
  active: boolean;
  data: { name?: { he?: string; en?: string } } | null;
  sort: number | null;
}

export const liveState = { phrases: 0, series: 0, tunables: 0, loaded: false };

const listeners = new Set<() => void>();
/** Told when something has actually changed, so the album can redraw. */
export function onLiveChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Apply the series rows to the album's shelves.
 *
 * Only the parts of a series that are NOT its cards: the name, the order, and
 * whether it is on show. Which cards belong to a shelf is already answered by
 * `card_overrides.series_id`, and saying it in two places would mean two
 * answers to one question.
 *
 * A series the files do not have is ignored rather than invented. A shelf
 * with no cards is an empty shelf, and the cards themselves have their own
 * way in — so there is nothing a row could usefully create here.
 */
function applySeries(rows: readonly SeriesRow[]): number {
  let applied = 0;
  for (const row of rows) {
    const series = SERIES.find((s) => s.id === row.id);
    if (!series) continue;
    if (!row.active) {
      // Hidden, not deleted. A series that ships in the files cannot be
      // removed, and emptying its shelf is what "off" means for one.
      series.cards.length = 0;
      applied++;
      continue;
    }
    const name = row.data?.name;
    if (name?.he) series.name = { ...series.name, he: name.he };
    if (name?.en) series.name = { ...series.name, en: name.en };
    applied++;
  }
  // The order of the shelves, for the ones that were given one. Anything
  // without a row keeps the place the files gave it, which is why this sorts
  // by a looked-up number rather than reordering only the rows.
  const place = new Map(
    rows.filter((r) => r.sort !== null).map((r) => [r.id, r.sort as number]),
  );
  if (place.size) {
    const was = SERIES.map((s, i) => [s.id, i] as const);
    const fallback = new Map(was);
    SERIES.sort(
      (a, b) =>
        (place.get(a.id) ?? fallback.get(a.id) ?? 0) - (place.get(b.id) ?? fallback.get(b.id) ?? 0),
    );
  }
  return applied;
}

export async function loadLiveContent(): Promise<void> {
  if (!SERVER_HTTP) return;
  try {
    const res = await fetch(`${SERVER_HTTP}/api/live`);
    if (!res.ok) return;
    const body = (await res.json()) as {
      phrases?: PhraseOverride[];
      series?: SeriesRow[];
      tunables?: Record<string, number>;
    };
    liveState.phrases = applyPhraseOverrides(body.phrases ?? []);
    liveState.series = applySeries(body.series ?? []);
    liveState.tunables = applyTunables(body.tunables ?? {});
    liveState.loaded = true;
    if (liveState.phrases || liveState.series || liveState.tunables)
      for (const fn of listeners) fn();
  } catch {
    // The game is complete without any of this. See the note at the top.
  }
}
