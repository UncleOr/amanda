/**
 * Cards Or has changed, applied to the catalogue in the browser.
 *
 * The server is the authority — it decides who won a battle and both clients
 * replay its answer — so the only thing that matters here is that the browser
 * ends up with the same cards the server fought with. A mismatch does not look
 * wrong, it makes the replay disagree with the result, which is worse.
 *
 * OVERRIDES, not a catalogue. data/series/*.json is still where cards come
 * from; a row means one was edited or invented. With none, the game is exactly
 * what it ships as — which is also what happens with no network, and is the
 * reason nothing here is awaited before the game starts.
 */
import { CardSchema, type Card } from "@amanda/shared";
import { CATALOG, SERIES } from "../data/catalog";

const SERVER_HTTP = (
  import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? "ws://localhost:2567" : "")
)
  .replace(/^ws:/, "http:")
  .replace(/^wss:/, "https:");

interface Row {
  id: string;
  series_id: string;
  active: boolean;
  data: unknown;
}

const listeners = new Set<() => void>();
export function onCardsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const cardOverrideState = { applied: 0, hidden: 0, loaded: false };

/**
 * Put a card into the catalogue AND into its series.
 *
 * Both, because they are two views of the same thing and the game uses each
 * for different work: the album walks SERIES, a battle looks up CATALOG. A
 * card that reached only one of them would exist in the album and vanish when
 * played, or the reverse.
 */
function place(card: Card, seriesId: string): void {
  CATALOG.set(card.id, card);
  const series = SERIES.find((s) => s.id === seriesId);
  if (!series) return;
  const at = series.cards.findIndex((c) => c.id === card.id);
  if (at >= 0) series.cards[at] = card;
  else series.cards.push(card);
}

function remove(id: string): void {
  CATALOG.delete(id);
  for (const s of SERIES) {
    const at = s.cards.findIndex((c) => c.id === id);
    if (at >= 0) s.cards.splice(at, 1);
  }
}

/** Fetch and apply. Never throws, never blocks, never required. */
export async function loadCardOverrides(): Promise<void> {
  if (!SERVER_HTTP) return;
  try {
    const res = await fetch(`${SERVER_HTTP}/api/cards`);
    if (!res.ok) return;
    const body = (await res.json()) as { cards?: Row[] };
    const rows = body.cards ?? [];
    cardOverrideState.loaded = true;
    if (!rows.length) return;

    let applied = 0;
    let hidden = 0;
    for (const row of rows) {
      if (!row.active) {
        remove(row.id);
        hidden++;
        continue;
      }
      /*
       * Validated with the engine's own schema, exactly as the server does.
       * Not trust — agreement: if the two sides disagreed about whether a card
       * is valid they would disagree about the battle, and the client is the
       * one that would be wrong in front of a child.
       */
      const parsed = CardSchema.safeParse(row.data);
      if (!parsed.success) continue;
      place(parsed.data, row.series_id);
      applied++;
    }
    cardOverrideState.applied = applied;
    cardOverrideState.hidden = hidden;
    if (applied || hidden) for (const fn of listeners) fn();
  } catch {
    /* the game keeps the cards it shipped with */
  }
}
