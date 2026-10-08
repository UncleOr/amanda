/**
 * What is happening in this process, right now.
 *
 * Or: *"zero thinking ahead from you about what should be in an interface
 * that has to run a fucking online game."*
 *
 * He is right and this is the clearest example. The game knows, at every
 * moment, how many sockets are open, how many people are waiting to be
 * paired, how many rooms are sitting on a code and how many matches are
 * actually being played. All four live in `index.ts` as plain variables, and
 * not one of them was visible anywhere. Running a live game with none of that
 * on a screen means the first you hear of matchmaking being broken is a child
 * saying "it's stuck".
 *
 * ═══ WHY A REGISTERED PROBE AND NOT AN IMPORT ═══
 *
 * `index.ts` is the entry point: it imports the API, which is where the admin
 * panel's endpoints live. So the API cannot import `index.ts` back without a
 * cycle. The entry hands this module a function that reads its own variables,
 * and the API calls it — which also keeps the counting in the one file that
 * owns the things being counted.
 *
 * Nothing here is stored. These are facts about a running process and they
 * stop being true when it restarts, which is exactly right: a database column
 * saying "12 people online" after a deploy is a lie somebody would act on.
 */

export interface LiveCounts {
  /** Open sockets, including two tabs belonging to one person. */
  sockets: number;
  /** Distinct signed-in players connected right now. */
  online: number;
  /** People waiting to be paired with a stranger. */
  queue: number;
  /** Rooms open on a code, waiting for a friend. */
  rooms: number;
  /** Matches being played this second. */
  matches: number;
}

const NONE: LiveCounts = { sockets: 0, online: 0, queue: 0, rooms: 0, matches: 0 };

let probe: (() => LiveCounts) | null = null;

/** Called once by the entry point, with a reader for its own state. */
export function reportLiveWith(fn: () => LiveCounts): void {
  probe = fn;
}

export function liveCounts(): LiveCounts {
  try {
    return probe ? probe() : NONE;
  } catch {
    // A statistics panel is never worth an exception out of a live server.
    return NONE;
  }
}

/** When this process came up, so the panel can say how long it has been fine. */
export const startedAt = Date.now();
