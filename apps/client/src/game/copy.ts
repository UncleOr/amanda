/**
 * Copy that Or can change without a deploy.
 *
 * Every player-visible string already has an id (`docs/copy.map.json`, 547 of
 * them). The database holds OVERRIDES only — a row means Or changed his mind —
 * so the game still ships with all of its own words and works perfectly with
 * no network, no account and no database. That is deliberate: a child opening
 * the game must never be waiting on a fetch to find out what the buttons say.
 *
 * Two kinds of string, and the difference is not cosmetic:
 *
 *   CARD TEXT lives in `data/*.json` and is parsed into plain objects at boot.
 *   An override walks the same path the copy map recorded and writes the new
 *   words straight into the parsed object, so it takes effect on the spot.
 *
 *   SCREEN TEXT is written into the components as literals. Nothing can change
 *   those at runtime without turning all 547 into lookups, so an override is
 *   saved and baked in on the next deploy (`pnpm copy:pull`). The admin says
 *   so per string rather than letting Or wonder why nothing happened.
 *
 * Several rows under one id are several versions of the same line, chosen at
 * random each time it is shown — Or's "about ten sentences that have a few
 * options, one for everything else".
 */
import { SERIES, ACTIONS, CATALOG } from "../data/catalog";

/** id → the lines Or wrote for it. Empty until the fetch comes back. */
let overrides: Record<string, string[]> = {};
/** Bumped whenever overrides land, so React can be told to look again. */
let version = 0;
const listeners = new Set<() => void>();

export function copyVersion(): number {
  return version;
}
export function onCopyChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * One of the lines for this id, or the one the game shipped with.
 *
 * Re-rolled on every call, which is the point for the handful of ids that
 * carry several — the caller decides how long to hold on to the answer (see
 * `useLine` in App.tsx, which settles one per screen).
 */
export function line(id: string, shipped: string): string {
  const mine = overrides[id];
  if (!mine?.length) return shipped;
  return mine[Math.floor(Math.random() * mine.length)]!;
}

/** Every line for an id, for the admin screen. */
export function linesFor(id: string): string[] {
  return overrides[id] ?? [];
}

/** Where the server lives. Derived from the socket address, as elsewhere. */
const SERVER_HTTP = (
  import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? "ws://localhost:2567" : "")
)
  .replace(/^ws:/, "http:")
  .replace(/^wss:/, "https:");

interface CopyEntry {
  id: string;
  section: string;
  text: string;
  where: { kind: "json" | "source"; file: string; path?: (string | number)[]; line?: number };
}

/** Walk a path like ["cards", 3, "name", "he"] and write the new words in. */
function setAt(root: unknown, path: (string | number)[], text: string): boolean {
  let node = root as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const step = path[i]!;
    const next = node[step];
    if (next === null || typeof next !== "object") return false;
    node = next as Record<string | number, unknown>;
  }
  const last = path[path.length - 1]!;
  if (typeof node[last] !== "string") return false;
  node[last] = text;
  return true;
}

/**
 * The parsed object a copy-map file refers to.
 *
 * The series files parse into SERIES in the same shape they have on disk, so
 * a path recorded against the file works against the parsed object unchanged.
 * Action cards are a map rather than the array the file holds, so that one is
 * rebuilt into an array-shaped view first.
 */
function rootFor(file: string): unknown {
  const series = file.match(/data\/series\/(.+)\.json$/);
  if (series) {
    const index = Number(series[1]!.split("-")[0]) || 0;
    return SERIES.find((s) => s.seriesNumber === index) ?? null;
  }
  if (file.endsWith("data/action-cards.json")) return { cards: [...ACTIONS.values()] };
  return null;
}

/**
 * Apply the card-text overrides to the data already parsed into memory.
 *
 * Returns how many landed. Screen text is counted as skipped rather than
 * failed — it is not a problem, it is simply waiting for a deploy.
 */
export function applyToCards(map: CopyEntry[]): { applied: number; deferred: number } {
  let applied = 0;
  let deferred = 0;
  for (const entry of map) {
    const text = overrides[entry.id]?.[0];
    if (text === undefined) continue;
    if (entry.where.kind !== "json" || !entry.where.path) {
      deferred++;
      continue;
    }
    const root = rootFor(entry.where.file);
    if (root && setAt(root, entry.where.path, text)) applied++;
    else deferred++;
  }
  // CATALOG holds the very same card objects the series hold, so nothing has
  // to be rebuilt — but say so, because it looks like an omission.
  void CATALOG;
  return { applied, deferred };
}

/**
 * Fetch the overrides and tell anyone listening.
 *
 * Fire and forget, like the account: nothing waits for it, nothing reports a
 * failure, and a game with no server simply uses its own words.
 */
export async function loadCopy(): Promise<void> {
  if (!SERVER_HTTP) return;
  try {
    const res = await fetch(`${SERVER_HTTP}/api/copy`);
    if (!res.ok) return;
    const body = (await res.json()) as { copy?: Record<string, string[]> };
    overrides = body.copy ?? {};
    if (Object.keys(overrides).length === 0) return;
    const map = (await import("../../../../docs/copy.map.json")).default as CopyEntry[];
    applyToCards(map);
    version++;
    for (const fn of listeners) fn();
  } catch {
    /* the game shipped with every string it needs */
  }
}
